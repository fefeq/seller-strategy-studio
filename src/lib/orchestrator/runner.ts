// Orchestrator runner: executes a need with the services the planner picked, falls back to the next one on
// failure, logs the estimated spend and returns one result plus a «Fuentes» line. Shared by screens and agent.
// Only imported from server code (functions handlers and agent tools): gateways read secrets at call time.
import type { ToolCtx } from "@/lib/agent/tool-kit";
import { enrichAccount as apolloEnrich, findCompanies as apolloCompanies, findPeople as apolloPeople, revealToAccount } from "@/lib/apollo-gateway";
import { enrichAccount as clayEnrich, findCompanies as clayCompanies, findPeople as clayPeople } from "@/lib/clay-gateway";
import type { AccountDraft, CompanyQuery, EnrichChange } from "@/lib/clay";
import { budgetState, planFor, sourcesLine, CAPABILITIES, type Need, type Service } from "./planner";
import { DEFAULT_LEVELS, levelsFor, nextCursor, revealCost, type Cursor } from "./search";

const ENV: Partial<Record<Service, string[]>> = {
  apollo: ["APOLLO_API_KEY"], clay: ["CLAY_API_KEY"], parallel: ["PARALLEL_API_KEY"], firecrawl: ["FIRECRAWL_API_KEY"],
  perplexity: ["PERPLEXITY_API_KEY"], apify: ["APIFY_API_KEY"], drive: ["GOOGLE_DRIVE_API_KEY"],
};

export function connectedServices(): Service[] {
  return (Object.keys(ENV) as Service[]).filter((s) => ENV[s]!.every((k) => !!process.env[k]));
}

export type Trigger = "manual" | "automatic";
export type Used = { service: Service; cost: number };

export async function monthBudget(c: ToolCtx) {
  const start = new Date(); start.setUTCDate(1); start.setUTCHours(0, 0, 0, 0);
  const [{ data: b }, { data: rows }] = await Promise.all([
    c.db.from("org_budgets").select("monthly_limit").eq("org_id", c.orgId).maybeSingle(),
    c.db.from("integration_usage").select("cost").eq("org_id", c.orgId).gte("created_at", start.toISOString()),
  ]);
  const spent = (rows ?? []).reduce((s: number, r: { cost: number | string }) => s + Number(r.cost || 0), 0);
  const limit = b?.monthly_limit == null ? null : Number(b.monthly_limit);
  return { spent, limit, ...budgetState(spent, limit) };
}

export async function logUsage(c: ToolCtx, need: Need, used: Used[], trigger: Trigger) {
  if (!used.length) return;
  const { error } = await c.db.from("integration_usage").insert(used.map((u) => ({ org_id: c.orgId, user_id: c.userId, service: u.service, need, trigger, cost: u.cost })));
  if (error) console.error("integration_usage insert failed", error.message);
}

async function planNeed(c: ToolCtx, need: Need, trigger: Trigger, depth: "quick" | "deep" = "quick") {
  const b = await monthBudget(c);
  return planFor({ need, connected: connectedServices(), depth, budget: { remaining: b.remaining, automatic: trigger === "automatic", paused: b.paused } });
}

export type CompleteResult = { changes: EnrichChange[]; found: boolean; used: Used[]; sources: string; tried: string[]; blocked: string | null };

/** «Completar datos de una cuenta»: tries the planned services in order and merges what each adds (first one wins per field). */
export async function completeAccount(c: ToolCtx, accountId: string, trigger: Trigger = "manual"): Promise<CompleteResult> {
  const plan = await planNeed(c, "enrich_account", trigger);
  const steps = plan.steps.filter((s) => s.service === "apollo" || s.service === "clay");
  if (!steps.length) return { changes: [], found: false, used: [], sources: "", tried: [], blocked: plan.blocked ?? "Ningún servicio conectado puede completar cuentas ahora." };
  const used: Used[] = [];
  const tried: string[] = [];
  const byField = new Map<string, EnrichChange>();
  let found = false;
  let lastError: string | null = null;
  for (const s of steps) {
    try {
      const r = s.service === "apollo" ? await apolloEnrich(c, accountId) : await clayEnrich(c, accountId);
      used.push({ service: s.service, cost: s.cost });
      tried.push(s.service);
      if (r.found) found = true;
      for (const ch of r.changes) if (!byField.has(ch.field)) byField.set(ch.field, ch);
      // Stop once every empty field has a value; otherwise the next service may fill the gaps.
      if (found && [...byField.values()].filter((x) => x.empty).length >= 3) break;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      tried.push(s.service);
      if (/dominio/i.test(lastError)) break; // same precondition for every service
    }
  }
  await logUsage(c, "enrich_account", used, trigger);
  if (!used.length && lastError) throw new Error(lastError);
  return { changes: [...byField.values()], found, used, sources: sourcesLine(used), tried, blocked: null };
}

/** Wraps a core that already combines web sources (research, signals) so its spend is logged and labelled. */
export async function trackedRun<T>(c: ToolCtx, need: Need, trigger: Trigger, run: () => Promise<T>): Promise<T & { via: string }> {
  const plan = await planNeed(c, need, trigger);
  if (plan.blocked && trigger === "automatic") throw new Error(plan.blocked);
  const out = await run();
  const used = plan.steps.filter((s) => s.service === "firecrawl" || s.service === "perplexity").map((s) => ({ service: s.service, cost: s.cost }));
  await logUsage(c, need, used, trigger);
  return { ...out, via: sourcesLine(used) };
}

export const NEED_LABEL = Object.fromEntries(Object.entries(CAPABILITIES).map(([k, v]) => [k, v.label])) as Record<Need, string>;

// ---------------- Key people (find_stakeholders) ----------------

export type KeyPerson = {
  key: string; name: string; title: string | null; linkedin: string | null; location: string | null;
  /** Apollo hides surname and contact until revealed (costs credits); Clay rows can be added as they are. */
  apolloId: string | null; hasEmail: boolean; hasPhone: boolean; existingId: string | null;
};
export type PeopleResult = { service: "apollo" | "clay" | null; rows: KeyPerson[]; cursor: Cursor | null; sources: string; blocked: string | null; masked: boolean };

/** «Buscar personas clave»: Apollo's free search first; if it fails or finds nobody, Clay. «Traer más» keeps the same service. */
export async function findKeyPeople(c: ToolCtx, a: { accountId: string; titles?: string[]; levels?: string[]; cursor?: Cursor | null }, trigger: Trigger = "manual"): Promise<PeopleResult> {
  const plan = await planNeed(c, "find_stakeholders", trigger);
  const costOf = (s: Service) => plan.steps.find((x) => x.service === s)?.cost ?? 0;
  const order = (a.cursor ? [a.cursor.service] : plan.steps.map((s) => s.service)).filter((s): s is "apollo" | "clay" => s === "apollo" || s === "clay");
  if (!order.length) return { service: null, rows: [], cursor: null, sources: "", blocked: plan.blocked ?? "Ningún servicio conectado puede buscar personas ahora.", masked: false };
  const levels = a.levels ?? DEFAULT_LEVELS;
  let lastError: string | null = null;
  const used: Used[] = [];
  for (const s of order) {
    try {
      if (s === "apollo") {
        const page = a.cursor?.service === "apollo" ? a.cursor.page : 1;
        const r = await apolloPeople(c, { accountId: a.accountId, page, query: { titles: a.titles, seniorities: levelsFor("apollo", levels) } });
        used.push({ service: s, cost: costOf(s) });
        if (!r.rows.length && !a.cursor && order.length > 1) continue;
        await logUsage(c, "find_stakeholders", used, trigger);
        return { service: s, masked: true, cursor: nextCursor(s, r.hasMore, page, null), sources: sourcesLine(used), blocked: null,
          rows: r.rows.map((p) => ({ key: p.apolloId, name: p.name, title: p.title, linkedin: null, location: null, apolloId: p.apolloId, hasEmail: p.hasEmail, hasPhone: p.hasPhone, existingId: null })) };
      }
      const searchId = a.cursor?.service === "clay" ? a.cursor.searchId : undefined;
      const r = await clayPeople(c, { accountId: a.accountId, searchId, limit: 10, query: searchId ? undefined : { titles: a.titles, seniority: levelsFor("clay", levels) } });
      used.push({ service: s, cost: costOf(s) });
      await logUsage(c, "find_stakeholders", used, trigger);
      return { service: s, masked: false, cursor: nextCursor(s, r.hasMore, 1, r.searchId), sources: sourcesLine(used), blocked: null,
        rows: r.rows.map((p, i) => ({ key: p.linkedin_url ?? `${p.name}-${i}`, name: p.name, title: p.title, linkedin: p.linkedin_url, location: p.location, apolloId: null, hasEmail: false, hasPhone: false, existingId: p.existingId })) };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      if (/dominio/i.test(lastError)) break;
    }
  }
  await logUsage(c, "find_stakeholders", used, trigger);
  if (used.length) return { service: null, rows: [], cursor: null, sources: sourcesLine(used), blocked: null, masked: false };
  throw new Error(lastError ?? "No se ha podido buscar personas.");
}

/** Adds Apollo results to the map: reveals name, email and LinkedIn (and the mobile if asked), logging the spend. */
export async function revealKeyPeople(c: ToolCtx, a: { accountId: string; apolloIds: string[]; phone?: boolean; webhookBase?: string }) {
  const r = await revealToAccount(c, a);
  const cost = revealCost(r.length, !!a.phone);
  await logUsage(c, a.phone ? "find_phone" : "find_email", [{ service: "apollo", cost }], "manual");
  return { people: r, sources: sourcesLine([{ service: "apollo", cost }]) };
}

// ---------------- ICP companies (icp_companies) ----------------

export type IcpCompany = AccountDraft & { existingId: string | null };
export type CompaniesResult = { service: "apollo" | "clay" | null; rows: IcpCompany[]; cursor: Cursor | null; sources: string; blocked: string | null; deep: boolean };

/** «Buscar empresas por ICP»: quick search in Apollo, then Clay. Parallel (deep, minutes) is offered separately. */
export async function findIcpCompanies(c: ToolCtx, a: { query: CompanyQuery; cursor?: Cursor | null }, trigger: Trigger = "manual"): Promise<CompaniesResult> {
  const plan = await planNeed(c, "icp_companies", trigger);
  const deep = plan.steps.some((s) => s.service === "parallel");
  const costOf = (s: Service) => plan.steps.find((x) => x.service === s)?.cost ?? 0;
  const order = (a.cursor ? [a.cursor.service] : plan.steps.map((s) => s.service)).filter((s): s is "apollo" | "clay" => s === "apollo" || s === "clay");
  if (!order.length) return { service: null, rows: [], cursor: null, sources: "", deep, blocked: plan.blocked ?? (deep ? null : "Ningún servicio conectado puede buscar empresas ahora.") };
  let lastError: string | null = null;
  const used: Used[] = [];
  for (const s of order) {
    try {
      if (s === "apollo") {
        const page = a.cursor?.service === "apollo" ? a.cursor.page : 1;
        const r = await apolloCompanies(c, { page, query: { keywords: a.query.keywords, countries: a.query.countries, minEmployees: a.query.minEmployees, maxEmployees: a.query.maxEmployees } });
        used.push({ service: s, cost: costOf(s) });
        if (!r.rows.length && !a.cursor && order.length > 1) continue;
        await logUsage(c, "icp_companies", used, trigger);
        return { service: s, rows: r.rows, cursor: nextCursor(s, r.hasMore, page, null), sources: sourcesLine(used), blocked: null, deep };
      }
      const searchId = a.cursor?.service === "clay" ? a.cursor.searchId : undefined;
      const r = await clayCompanies(c, { searchId, limit: 10, query: searchId ? undefined : a.query });
      used.push({ service: s, cost: costOf(s) });
      await logUsage(c, "icp_companies", used, trigger);
      return { service: s, rows: r.rows, cursor: nextCursor(s, r.hasMore, 1, r.searchId), sources: sourcesLine(used), blocked: null, deep };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  await logUsage(c, "icp_companies", used, trigger);
  if (used.length) return { service: null, rows: [], cursor: null, sources: sourcesLine(used), blocked: null, deep };
  throw new Error(lastError ?? "No se ha podido buscar empresas.");
}
