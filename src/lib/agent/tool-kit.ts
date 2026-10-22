// Types and helpers shared by every tool module of the agent registry (src/lib/agent/tools.ts).
// Tools also run with the privileged client (Telegram, cron), where RLS does not apply: every query
// scopes org_id explicitly and every id the model passes is checked to belong to the caller's company.
import { z } from "zod";
import type { Db } from "@/lib/org-data";
import type { Role } from "@/lib/roles";
import { sortStages, stageByLabel, type Stage } from "@/lib/stages";

export type ToolCtx = { db: Db; orgId: string; userId: string; roles: string[]; currency: string };

export type AgentTool<S extends z.ZodTypeAny = z.ZodTypeAny> = {
  name: string;
  description: string;
  kind: "read" | "write";
  roles?: Role[]; // allowed roles; undefined = every member
  input: S;
  summarize?: (args: z.infer<S>) => string;
  /** Write tools may return { mensaje } to tell the user something after confirming (a warning, where it went). */
  run: (ctx: ToolCtx, args: z.infer<S>) => Promise<unknown>;
};

export const def = <S extends z.ZodTypeAny>(t: AgentTool<S>) => t as unknown as AgentTool;
export const STAGE_ARG = z.string().min(1).describe("Clave o nombre de una etapa de la empresa (list_stages); por defecto: discovery, qualified, demo, proposal, negotiation, won, lost");
export const DATE_ARG = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha en formato AAAA-MM-DD").describe("AAAA-MM-DD");
export const HEALTH = z.enum(["green", "yellow", "red"]);

export const ok = <T>(r: { data: T; error: { message: string } | null }) => { if (r.error) throw new Error(r.error.message); return r.data; };
export const like = (q: string) => `%${q.replace(/[%_,()]/g, " ").trim()}%`;
export const isLeader = (roles: string[]) => roles.some((r) => r === "owner" || r === "sales_leader");
/** Who may set prices, costs and discounts on deal lines (the deal_lines_scope trigger, which privileged clients skip). */
export const canPrice = (roles: string[]) => roles.some((r) => r === "owner" || r === "sales_leader" || r === "deal_desk");
/** Optional text where an empty value clears the field (null), as the screens save it. */
export const clearable = (max: number) => z.string().max(max).transform((v) => (v.trim() ? v.trim() : null)).optional();
/** Long AI texts are cut so a reply (and a Telegram message) stays readable. */
export const clip = (s: string | null | undefined, n = 4000) => (s && s.length > n ? `${s.slice(0, n)}…` : s ?? null);
/** Drops undefined keys so a patch only touches what the user asked to change. */
export const defined = <T extends Record<string, unknown>>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;

type OrgTable = "accounts" | "deals" | "leads" | "meetings" | "people" | "stakeholders" | "segments" | "tasks" | "products" | "deal_lines" | "mutual_action_items" | "suggestions" | "approvals";

/** The row with this id in the caller's company (selected columns), or a clear error naming what was missing. */
export async function mustFind<T = Record<string, unknown>>(c: ToolCtx, table: OrgTable, id: string, what: string, cols = "id"): Promise<T> {
  const { data, error } = await (c.db.from(table) as any).select(cols).eq("org_id", c.orgId).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`No encuentro ${what} en esta empresa. Búscalo primero con search o con la herramienta de listado.`);
  return data as T;
}

/** Names of the company's accounts by id; embedded joins are not used so another company's row can never leak. */
export async function accountNames(c: ToolCtx, ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const list = [...new Set(ids.filter((x): x is string => !!x))];
  if (!list.length) return new Map();
  const { data } = await c.db.from("accounts").select("id,name").eq("org_id", c.orgId).in("id", list);
  return new Map((data ?? []).map((a) => [a.id, a.name]));
}

/** Throws unless the user is a member of the caller's company (owners of deals, tasks, suggestions). */
export async function mustBeMember(c: ToolCtx, userId: string) {
  const { data } = await c.db.from("org_members").select("user_id").eq("org_id", c.orgId).eq("user_id", userId).limit(1);
  if (!data?.length) throw new Error("Esa persona no es miembro de esta empresa. Consulta el equipo en Equipo.");
}

/** The company's stages (the default seven if it has none yet). */
export async function orgStages(c: ToolCtx): Promise<Stage[]> {
  const { data } = await c.db.from("deal_stages").select("key,label,position,kind,board_group,probability").eq("org_id", c.orgId);
  return sortStages((data ?? []) as Stage[]);
}

/** A stage the agent named, by key or label, as the company's key; refuses one the company doesn't have. */
export async function resolveStage(c: ToolCtx, raw: string): Promise<{ key: string; probability: number; kind: Stage["kind"]; stages: Stage[] }> {
  const stages = await orgStages(c);
  const key = stageByLabel(raw, stages);
  const st = stages.find((s) => s.key === key);
  if (!st) throw new Error(`La etapa «${raw}» no existe en esta empresa. Etapas: ${stages.map((s) => `${s.label} (${s.key})`).join(", ")}.`);
  return { key: st.key, probability: st.probability, kind: st.kind, stages };
}

/** The org's account with this name (case-insensitive), created if missing: same rule as lead intake. */
export async function accountByName(c: ToolCtx, name: string, segmentId?: string): Promise<string> {
  if (!name.trim()) throw new Error("Falta el nombre de la cuenta del deal.");
  // % and _ are escaped; PostgREST reads * as a wildcard, so it becomes a one-character wildcard and the
  // exact (case-insensitive) match is checked here: «A*B» never links the deal to another account.
  const pattern = name.replace(/[\\%_]/g, (ch) => `\\${ch}`).replace(/\*/g, "_");
  const { data: candidates } = await c.db.from("accounts").select("id,name").eq("org_id", c.orgId).ilike("name", pattern).limit(20);
  const found = (candidates ?? []).find((a) => a.name.trim().toLowerCase() === name.trim().toLowerCase());
  if (found?.id) return found.id;
  const created = ok(await c.db.from("accounts").insert({ org_id: c.orgId, name, ...(segmentId ? { segment_id: segmentId } : {}) }).select("id").single());
  if (!created?.id) throw new Error("No se ha podido crear la cuenta del deal.");
  return created.id;
}
