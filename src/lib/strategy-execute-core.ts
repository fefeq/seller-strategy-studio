// Database side of executing a strategic suggestion (SDD-20261027 F3). Takes the client and the company explicitly, like the agent
// tools; the user's own client keeps RLS on, so a role that may not write a table cannot write it here either (CA-38). The rules
// are pure, in strategy-execute.ts. Never sends a message to anyone and never changes data without a confirmation call (CA-39).
import type { Db } from "@/lib/org-data";
import type { Json } from "@/integrations/supabase/types";
import { parseStrategy } from "@/lib/strategy-suggestions";
import {
  HAS_SOURCES, WRITABLE, baseOf, canApplyChange, experimentDraftIssues, planApply, planUndo, undoUntil,
  type ChangeTable, type CurrentRow, type ExperimentDraft, type StoredChange, type TaskDraft, type Value,
} from "@/lib/strategy-execute";

type Ctx = { db: Db; orgId: string; userId: string; roles: string[] };
// The four tables are a closed list (WRITABLE) chosen at run time; the generated types cannot express a dynamic table name.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = { from: (t: string) => any };
const loose = (db: Db) => db as unknown as Loose;

async function readRow(ctx: Ctx, table: ChangeTable, id: string): Promise<CurrentRow> {
  const cols = [...WRITABLE[table], ...(HAS_SOURCES[table] ? ["field_sources"] : [])].join(",");
  const { data } = await loose(ctx.db).from(table).select(cols).eq("id", id).eq("org_id", ctx.orgId).maybeSingle();
  if (!data) return null;
  const { field_sources, ...values } = data as Record<string, unknown>;
  return { values: values as Record<string, Value>, field_sources };
}

const CHANGE_COLS = "id,suggestion_id,element,op,target_table,target_id,values,base,previous,status,applied_at,undo_until";
type ChangeRow = StoredChange & { id: string; suggestion_id: string };
async function readChange(ctx: Ctx, id: string): Promise<ChangeRow> {
  const { data } = await ctx.db.from("strategy_changes").select(CHANGE_COLS).eq("id", id).eq("org_id", ctx.orgId).maybeSingle();
  if (!data) throw new Error("No encuentro esa propuesta.");
  return data as unknown as ChangeRow;
}
const link = (ctx: Ctx, suggestion_id: string, kind: "change" | "task" | "experiment", ref_id: string) =>
  ctx.db.from("strategy_links").insert({ org_id: ctx.orgId, suggestion_id, kind, ref_id });

/**
 * CA-32: accepting a suggestion that changes ICP, segment, positioning, competitor or product saves a pending proposal and reads the
 * current value only to remember it. Idempotent per suggestion. Without a payload it is a manual proposal (nothing to write).
 */
export async function proposeChange(ctx: Ctx, s: { id: string; strategy: unknown }) {
  const meta = parseStrategy(s.strategy);
  if (!meta || meta.action_type !== "strategy_change" || meta.element === "experiment") return null;
  const { data: existing } = await ctx.db.from("strategy_changes").select("id").eq("suggestion_id", s.id).eq("org_id", ctx.orgId).maybeSingle();
  if (existing) return (existing as unknown as { id: string }).id;
  const p = meta.change;
  const row = p?.op === "update" && p.id ? await readRow(ctx, p.table, p.id) : null;
  const { data, error } = await ctx.db.from("strategy_changes").insert({
    org_id: ctx.orgId, suggestion_id: s.id, element: meta.element, op: p ? p.op : "manual", target_table: p?.table ?? null, target_id: p?.id ?? null,
    values: (p?.values ?? {}) as unknown as Json, base: (p ? baseOf(p, row) : {}) as unknown as Json, created_by: ctx.userId,
  }).select("id").single();
  if (error || !data) throw new Error("No pude guardar la propuesta. La sugerencia quedó aceptada; inténtalo de nuevo.");
  const id = (data as unknown as { id: string }).id;
  await link(ctx, s.id, "change", id);
  return id;
}

export type ApplyResult = { ok: true; message: string } | { ok: false; code: string; message: string; fields?: string[] };

/** CA-33, CA-34, CA-38, CA-39: applies a confirmed proposal with the origin «Revisión estratégica» and an undo window of 24 hours. */
export async function applyChange(ctx: Ctx, id: string, opts: { overwrite?: boolean; now?: Date } = {}): Promise<ApplyResult> {
  const now = opts.now ?? new Date();
  const c = await readChange(ctx, id);
  const row = c.target_table && c.target_id ? await readRow(ctx, c.target_table, c.target_id) : null;
  const plan = planApply(c, row, ctx.roles, ctx.userId, now, opts.overwrite);
  if (!plan.ok) return { ok: false, code: plan.code, message: plan.message, ...(plan.fields ? { fields: plan.fields } : {}) };
  const at = now.toISOString();
  const { data: claimed } = await ctx.db.from("strategy_changes")
    .update({ status: "applied", applied_at: at, undo_until: undoUntil(now), decided_by: ctx.userId, decided_at: at, previous: plan.previous as unknown as Json })
    .eq("id", id).eq("org_id", ctx.orgId).eq("status", "pending").select("id");
  if (!claimed?.length) return { ok: false, code: "status", message: "Esta propuesta ya no está pendiente." };
  const patch = { ...plan.values, ...(plan.field_sources ? { field_sources: plan.field_sources } : {}) } as Record<string, unknown>;
  const q = c.op === "create"
    ? loose(ctx.db).from(c.target_table!).insert({ ...patch, org_id: ctx.orgId }).select("id").single()
    : loose(ctx.db).from(c.target_table!).update(patch).eq("id", c.target_id).eq("org_id", ctx.orgId).select("id");
  const { data: written, error } = await q;
  const ok = !error && (c.op === "create" ? !!written : Array.isArray(written) && written.length > 0);
  if (!ok) {
    await ctx.db.from("strategy_changes").update({ status: "pending", applied_at: null, undo_until: null, decided_by: null, decided_at: null, previous: null }).eq("id", id).eq("org_id", ctx.orgId);
    return { ok: false, code: "write", message: "No pude aplicar el cambio; no se ha modificado nada. Comprueba que tu rol puede editar esa parte de la estrategia." };
  }
  if (c.op === "create") await ctx.db.from("strategy_changes").update({ target_id: (written as { id: string }).id }).eq("id", id).eq("org_id", ctx.orgId);
  return { ok: true, message: "Aplicado con origen «Revisión estratégica». Puedes deshacerlo durante 24 horas." };
}

/** Rejecting leaves the value as it is. Manual proposals are closed with markDoneByHand. */
export async function rejectChange(ctx: Ctx, id: string, now = new Date()): Promise<ApplyResult> {
  const c = await readChange(ctx, id);
  if (!canApplyChange(ctx.roles, c.target_table)) return { ok: false, code: "role", message: "Tu rol puede ver la propuesta, pero no decidirla." };
  const { data } = await ctx.db.from("strategy_changes").update({ status: "rejected", decided_by: ctx.userId, decided_at: now.toISOString() }).eq("id", id).eq("org_id", ctx.orgId).eq("status", "pending").select("id");
  return data?.length ? { ok: true, message: "Propuesta descartada; el valor actual no cambia." } : { ok: false, code: "status", message: "Esta propuesta ya no está pendiente." };
}

export async function markDoneByHand(ctx: Ctx, id: string, now = new Date()): Promise<ApplyResult> {
  const c = await readChange(ctx, id);
  if (c.op !== "manual") return { ok: false, code: "status", message: "Esta propuesta sí tiene un valor que aplicar." };
  if (!canApplyChange(ctx.roles, null)) return { ok: false, code: "role", message: "Tu rol puede ver la propuesta, pero no decidirla." };
  const { data } = await ctx.db.from("strategy_changes").update({ status: "done_by_hand", decided_by: ctx.userId, decided_at: now.toISOString() }).eq("id", id).eq("org_id", ctx.orgId).eq("status", "pending").select("id");
  return data?.length ? { ok: true, message: "Marcada como hecha a mano." } : { ok: false, code: "status", message: "Esta propuesta ya no está pendiente." };
}

export async function undoChange(ctx: Ctx, id: string, now = new Date()): Promise<ApplyResult> {
  const c = await readChange(ctx, id);
  const row = c.target_table && c.target_id ? await readRow(ctx, c.target_table, c.target_id) : null;
  const plan = planUndo(c, row, ctx.roles, now);
  if (!plan.ok) return { ok: false, code: "undo", message: plan.message };
  const t = loose(ctx.db).from(c.target_table!);
  const { data, error } = plan.remove
    ? await t.delete().eq("id", c.target_id).eq("org_id", ctx.orgId).select("id")
    : await t.update({ ...plan.values, ...(plan.field_sources ? { field_sources: plan.field_sources } : {}) }).eq("id", c.target_id).eq("org_id", ctx.orgId).select("id");
  if (error || !data?.length) return { ok: false, code: "undo", message: "No pude deshacerlo; no se ha modificado nada. Deshacer un alta pide ser Owner." };
  await ctx.db.from("strategy_changes").update({ status: "undone", decided_by: ctx.userId, decided_at: now.toISOString() }).eq("id", id).eq("org_id", ctx.orgId);
  return { ok: true, message: "Deshecho." };
}

/** CA-35: creates the experiment from the (edited) draft and links it to the suggestion (CA-37). Starts as «Idea»: starting it is the person's call. */
export async function createExperimentFromSuggestion(ctx: Ctx, suggestionId: string, d: ExperimentDraft) {
  const issues = experimentDraftIssues(d);
  if (issues.length) throw new Error(`Antes de guardar, completa ${issues.join(", ")}.`);
  const { data, error } = await ctx.db.from("gtm_experiments").insert({ org_id: ctx.orgId, title: d.title, hypothesis: d.hypothesis, metric: d.metric, review_on: d.review_on, status: "idea" }).select("id").single();
  if (error || !data) throw new Error("No pude crear el experimento. La sugerencia quedó aceptada; inténtalo de nuevo.");
  await link(ctx, suggestionId, "experiment", data.id);
  return data.id;
}

/** CA-36: creates the task with the (edited) owner and date and links it to the suggestion (CA-37). */
export async function createTaskFromSuggestion(ctx: Ctx, suggestionId: string, d: TaskDraft) {
  if (!d.title.trim()) throw new Error("Escribe el título de la tarea.");
  const { data, error } = await ctx.db.from("tasks").insert({ org_id: ctx.orgId, title: d.title, owner_id: d.owner_id, due_date: d.due_date || null, deal_id: d.deal_id, source: "strategy" }).select("id").single();
  if (error || !data) throw new Error("No pude crear la tarea. La sugerencia quedó aceptada; inténtalo de nuevo.");
  await link(ctx, suggestionId, "task", data.id);
  return data.id;
}

