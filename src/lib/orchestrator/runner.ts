// Orchestrator runner: executes a need with the services the planner picked, falls back to the next one on
// failure, logs the estimated spend and returns one result plus a «Fuentes» line. Shared by screens and agent.
// Only imported from server code (functions handlers and agent tools): gateways read secrets at call time.
import type { ToolCtx } from "@/lib/agent/tool-kit";
import { enrichAccount as apolloEnrich } from "@/lib/apollo-gateway";
import { enrichAccount as clayEnrich } from "@/lib/clay-gateway";
import type { EnrichChange } from "@/lib/clay";
import { budgetState, planFor, sourcesLine, CAPABILITIES, type Need, type Service } from "./planner";

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
