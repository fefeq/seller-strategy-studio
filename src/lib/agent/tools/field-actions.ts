// Edit, delete, confirm and undo from the agent (SDD field-actions-edit-delete-confirm, U-5). The same rules as the
// screens: the role matrix of src/lib/field-actions.ts, the delete plan of src/lib/delete-rules.ts (a segment in use is
// not deleted; deleting is the Owner's), and the 24 h undo. Tools run with privileged clients too (Telegram, cron), so
// the role checks the screens get from RLS are made here in code. Write tools only run after the person confirms.
import { z } from "zod";
import { canDo, TRACKED_FIELDS, type ElementKind, type TrackedKind } from "@/lib/field-actions";
import { canUndoChange, changeText, deletePlan, type ChangeEntry, type DeleteKind, type UsageLine } from "@/lib/delete-rules";
import { normalizeCountries } from "@/lib/field-normalize";
import { confirmSources } from "@/lib/provenance";
import { def, defined, mustFind, ok, type AgentTool, type ToolCtx } from "../tool-kit";

const TABLE = { segment: "segments", icp: "icp_profiles", pillar: "messaging_pillars" } as const;
const TRACKED_TABLE = { account: "accounts", icp: "icp_profiles", positioning: "positioning", pillar: "messaging_pillars", segment: "segments" } as const;
const NOUN = { segment: "el segmento", icp: "el ICP", pillar: "el pilar de mensaje" } as const;
const ELEMENT: Record<TrackedKind, ElementKind> = { account: "company_field", icp: "icp", positioning: "positioning", pillar: "pillar", segment: "segment" };

const KEPT = [["deals", "deals"], ["accounts", "cuentas"], ["leads", "leads"], ["icp_profiles", "ICP"], ["trials", "pruebas"]] as const;
const GONE = [["segment_targets", "objetivos"], ["cac_costs", "costes de CAC"], ["segment_budget_quarters", "trimestres de presupuesto"]] as const;

async function countBySegment(c: ToolCtx, table: (typeof KEPT)[number][0] | (typeof GONE)[number][0], segmentId: string) {
  const { count, error } = await c.db.from(table).select("id", { count: "exact", head: true }).eq("org_id", c.orgId).eq("segment_id", segmentId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Where an element is used, counted in the caller's company (the screens count the same things). */
async function usageOf(c: ToolCtx, kind: DeleteKind, row: { id: string; segment_id?: string | null }): Promise<{ kept: UsageLine[]; gone: UsageLine[] }> {
  if (kind === "segment") {
    const [kept, gone] = await Promise.all([
      Promise.all(KEPT.map(async ([t, l]) => ({ label: l, count: await countBySegment(c, t, row.id) }))),
      Promise.all(GONE.map(async ([t, l]) => ({ label: l, count: await countBySegment(c, t, row.id) }))),
    ]);
    return { kept, gone };
  }
  if (kind === "icp" && row.segment_id) {
    const [accounts, leads] = await Promise.all([countBySegment(c, "accounts", row.segment_id), countBySegment(c, "leads", row.segment_id)]);
    return { kept: [{ label: "cuentas", count: accounts }, { label: "leads", count: leads }], gone: [] };
  }
  return { kept: [], gone: [] };
}

async function loadForDelete(c: ToolCtx, kind: DeleteKind, id: string) {
  const col = kind === "pillar" ? "title" : "name";
  const cols = kind === "icp" ? `id,${col},segment_id` : `id,${col}`;
  const row = await mustFind<Record<string, string | null>>(c, TABLE[kind], id, `${NOUN[kind]} que quieres borrar`, cols);
  return { id, name: String(row[col] ?? "").trim() || "Sin nombre", segment_id: (row["segment_id"] as string | null | undefined) ?? null };
}

const deleteInput = z.object({ id: z.string().uuid(), name: z.string().min(1).describe("Nombre tal como aparece en Nokko, para mostrar la confirmación") });

function deleteTool(kind: DeleteKind): AgentTool {
  const names = { segment: "delete_segment", icp: "delete_icp", pillar: "delete_pillar" } as const;
  return def({
    name: names[kind], kind: "write",
    description: `Borra ${NOUN[kind]}. Solo el Owner borra. ${kind === "segment" ? "Un segmento en uso no se borra: lo dice la herramienta. " : "Si está en uso se archiva, que es borrarlo con deshacer. "}Antes de proponerlo llama a check_delete y cuéntale al usuario qué se pierde y dónde se usa. Se puede deshacer 24 horas con undo_change.`,
    input: deleteInput,
    summarize: (a) => `${kind === "segment" ? "Borrar" : "Archivar o borrar"} ${NOUN[kind]} «${a.name}»`,
    run: async (c, a) => {
      const row = await loadForDelete(c, kind, a.id);
      if (row.name.toLowerCase() !== a.name.trim().toLowerCase()) throw new Error(`El nombre no coincide: ese elemento se llama «${row.name}». Confírmalo con el usuario.`);
      const plan = deletePlan(kind, row.name, await usageOf(c, kind, row), c.roles);
      if (!plan.allowed) throw new Error(`${plan.title}. ${plan.lines.join(" ")}`);
      const { error } = await c.db.from(TABLE[kind]).delete().eq("org_id", c.orgId).eq("id", a.id);
      if (error) throw new Error(error.message);
      return { mensaje: `Hecho: ${NOUN[kind]} «${row.name}» ${plan.confirmLabel === "Archivar" ? "archivado" : "borrado"}. Se puede deshacer durante 24 horas.` };
    },
  });
}

const ICP_PATCH = z.object({
  name: z.string().min(1).max(200).optional(), industries: z.string().optional(), company_size: z.string().optional(), geography: z.string().optional(),
  why_fit: z.string().optional(), anti_icp: z.string().optional(), hiring_signals: z.string().optional(), funding_signals: z.string().optional(),
  tech_stack: z.string().optional(), growth_stage: z.string().optional(), adoption: z.string().optional(), pains: z.string().optional(),
  min_employees: z.number().int().positive().optional(), max_employees: z.number().int().positive().optional(),
  countries: z.array(z.string()).optional().describe("países: código ISO de 2 letras o nombre"),
  search_keywords: z.array(z.string()).optional(), target_titles: z.array(z.string()).optional(),
  seniorities: z.array(z.enum(["founder", "c_suite", "vp", "head", "director", "manager"])).optional(),
});

type LogClient = { from(t: "field_edit_log"): { select(cols: string): { eq(c: string, v: string): { gte(c: string, v: string): { is(c: string, v: null): { order(c: string, o: { ascending: boolean }): Promise<{ data: ChangeEntry[] | null; error: { message: string } | null }> } }; is(c: string, v: null): unknown } } }; rpc(fn: "undo_field_edit", a: { _log: string }): Promise<{ error: { message: string } | null }> };
// The change log (migration 0060, not applied anywhere yet) is not in the generated types: one narrow cast, to remove then.
const logOf = (c: ToolCtx) => c.db as unknown as LogClient;
const NO_LOG = "El registro de cambios todavía no está activado en esta empresa (falta aplicar su migración).";

export const FIELD_ACTION_TOOLS: AgentTool[] = [
  def({
    name: "update_icp", kind: "write",
    description: "Edita un ICP existente (icp_id): solo cambia los campos que pases. Países en ISO de 2 letras o por nombre. Editar lo deja como escrito por el usuario y confirmado.",
    input: z.object({ icp_id: z.string().uuid(), name_for_confirmation: z.string().optional(), fields: ICP_PATCH }),
    summarize: (a) => `Editar el ICP${a.name_for_confirmation ? ` «${a.name_for_confirmation}»` : ""}: ${Object.keys(defined(a.fields)).join(", ") || "sin cambios"}`,
    run: async (c, a) => {
      const gate = canDo("icp", "edit", c.roles);
      if (!gate.allowed) throw new Error(gate.reason ?? "Tu rol no permite editar.");
      await mustFind(c, "icp_profiles", a.icp_id, "ese ICP");
      const patch: Record<string, unknown> = defined(a.fields);
      if (a.fields.countries) {
        const n = normalizeCountries(a.fields.countries);
        if (n.unnormalized.length) throw new Error(`No reconozco estos países: ${n.unnormalized.join(", ")}. Usa el código de 2 letras o el nombre.`);
        patch["countries"] = n.value;
      }
      if (!Object.keys(patch).length) throw new Error("No has indicado qué cambiar del ICP.");
      return ok(await c.db.from("icp_profiles").update(patch as never).eq("org_id", c.orgId).eq("id", a.icp_id).select("id,name").single());
    },
  }),
  def({
    name: "update_pillar", kind: "write",
    description: "Edita un pilar de mensaje existente (pillar_id): título, dolor, mensaje o prueba. Solo cambia lo que pases.",
    input: z.object({ pillar_id: z.string().uuid(), title: z.string().min(1).max(200).optional(), pain: z.string().optional(), message: z.string().optional(), proof: z.string().optional() }),
    summarize: (a) => `Editar el pilar de mensaje: ${Object.keys(defined({ title: a.title, pain: a.pain, message: a.message, proof: a.proof })).join(", ") || "sin cambios"}`,
    run: async (c, a) => {
      const gate = canDo("pillar", "edit", c.roles);
      if (!gate.allowed) throw new Error(gate.reason ?? "Tu rol no permite editar.");
      const { pillar_id, ...rest } = a;
      await mustFind(c, "messaging_pillars", pillar_id, "ese pilar");
      const patch = defined(rest);
      if (!Object.keys(patch).length) throw new Error("No has indicado qué cambiar del pilar.");
      return ok(await c.db.from("messaging_pillars").update(patch).eq("org_id", c.orgId).eq("id", pillar_id).select("id,title").single());
    },
  }),
  def({
    name: "check_delete", kind: "read",
    description: "Antes de borrar un segmento, ICP o pilar: dice qué se pierde, dónde se usa, si tu rol puede borrarlo y si se puede (un segmento en uso no se borra). No cambia nada.",
    input: z.object({ kind: z.enum(["segment", "icp", "pillar"]), id: z.string().uuid() }),
    run: async (c, a) => {
      const row = await loadForDelete(c, a.kind, a.id);
      const plan = deletePlan(a.kind, row.name, await usageOf(c, a.kind, row), c.roles);
      return { nombre: row.name, se_puede: plan.allowed, motivo_si_no: plan.blocked, accion: plan.confirmLabel, texto: [plan.title, ...plan.lines] };
    },
  }),
  deleteTool("segment"),
  deleteTool("icp"),
  deleteTool("pillar"),
  def({
    name: "confirm_fields", kind: "write",
    description: `Marca como confirmados campos de una cuenta, ICP, posicionamiento, pilar o segmento. Solo campos con valor. Campos: ${(Object.keys(TRACKED_FIELDS) as TrackedKind[]).map((k) => `${k}: ${TRACKED_FIELDS[k].join(", ")}`).join(" | ")}. Para posicionamiento no hace falta id.`,
    input: z.object({ kind: z.enum(["account", "icp", "positioning", "pillar", "segment"]), id: z.string().uuid().optional(), fields: z.array(z.string()).min(1).max(20) }),
    summarize: (a) => `Confirmar ${a.fields.join(", ")} (${a.kind})`,
    run: async (c, a) => {
      const gate = canDo(ELEMENT[a.kind], "confirm", c.roles);
      if (!gate.allowed) throw new Error(gate.reason ?? "Tu rol no permite confirmar.");
      const allowed = TRACKED_FIELDS[a.kind] as readonly string[];
      const bad = a.fields.filter((f) => !allowed.includes(f));
      if (bad.length) throw new Error(`Esos campos no se pueden confirmar en ${a.kind}: ${bad.join(", ")}. Válidos: ${allowed.join(", ")}.`);
      const table = TRACKED_TABLE[a.kind];
      let q = c.db.from(table).select("*").eq("org_id", c.orgId);
      if (a.id) q = q.eq("id", a.id);
      const { data, error } = await q.limit(1).maybeSingle();
      if (error) throw new Error(error.message);
      const row = data as Record<string, unknown> | null;
      if (!row) throw new Error("No encuentro ese elemento en esta empresa.");
      if (!("field_sources" in row)) throw new Error("La confirmación por campo todavía no está activada en esta empresa (falta aplicar su migración).");
      const filled = a.fields.filter((f) => { const v = row[f]; return Array.isArray(v) ? v.length > 0 : v != null && String(v).trim() !== ""; });
      if (!filled.length) throw new Error("Esos campos están vacíos: no hay nada que confirmar.");
      const field_sources = confirmSources(row["field_sources"], filled, c.userId, new Date().toISOString());
      ok(await c.db.from(table).update({ field_sources } as never).eq("org_id", c.orgId).eq("id", String(row["id"])).select("id").single());
      return { mensaje: `Confirmado: ${filled.join(", ")}.${filled.length < a.fields.length ? ` Sin valor, no confirmados: ${a.fields.filter((f) => !filled.includes(f)).join(", ")}.` : ""}` };
    },
  }),
  def({
    name: "list_recent_changes", kind: "read",
    description: "Cambios de las últimas 24 horas en segmentos, ICP, posicionamiento y pilares (ediciones y borrados) que todavía se pueden deshacer, con su id para undo_change.",
    input: z.object({}),
    run: async (c) => {
      const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
      const { data, error } = await (logOf(c).from("field_edit_log").select("id,table_name,row_id,op,before,changed_at,undone_at").eq("org_id", c.orgId).gte("changed_at", since).is("undone_at", null).order("changed_at", { ascending: false }));
      if (error) throw new Error(/field_edit_log|relation/i.test(error.message) ? NO_LOG : error.message);
      const now = new Date();
      return (data ?? []).map((e) => ({ id: e.id, cambio: changeText(e), cuando: e.changed_at, lo_puedes_deshacer: canUndoChange(e, c.roles, now).allowed }));
    },
  }),
  def({
    name: "undo_change", kind: "write",
    description: "Deshace un cambio de list_recent_changes (dentro de 24 horas). Deshacer un borrado es solo del Owner. Si el elemento cambió después, no se deshace.",
    input: z.object({ change_id: z.string().uuid(), description: z.string().optional().describe("Qué cambio es, para mostrar la confirmación") }),
    summarize: (a) => `Deshacer el cambio${a.description ? `: ${a.description}` : ""}`,
    run: async (c, a) => {
      const { data, error } = await (c.db as unknown as { from(t: "field_edit_log"): { select(cols: string): { eq(c: string, v: string): { eq(c: string, v: string): { maybeSingle(): Promise<{ data: ChangeEntry | null; error: { message: string } | null }> } } } } })
        .from("field_edit_log").select("id,table_name,row_id,op,before,changed_at,undone_at").eq("org_id", c.orgId).eq("id", a.change_id).maybeSingle();
      if (error) throw new Error(/field_edit_log|relation/i.test(error.message) ? NO_LOG : error.message);
      if (!data) throw new Error("No encuentro ese cambio en esta empresa.");
      const can = canUndoChange(data, c.roles, new Date());
      if (!can.allowed) throw new Error(can.reason ?? "No se puede deshacer.");
      const { error: e } = await logOf(c).rpc("undo_field_edit", { _log: a.change_id });
      // Telegram and cron run with the privileged client, which has no signed-in person for the function to check.
      if (e) throw new Error(`No he podido deshacerlo desde aquí: ${e.message}. Hazlo en Estrategia, «Cambios de las últimas 24 horas».`);
      return { mensaje: `Hecho: ${changeText(data).replace(/^Borraste/, "Recuperado:").replace(/^Cambiaste/, "Restaurado:")}.` };
    },
  }),
];
