// Orchestrator runner: executes a need with the services the planner picked, falls back to the next one on
// failure, logs the estimated spend and returns one result plus a «Fuentes» line. Shared by screens and agent.
// Only imported from server code (functions handlers and agent tools): gateways read secrets at call time.
import type { ToolCtx } from "@/lib/agent/tool-kit";
import type { Json } from "@/integrations/supabase/types";
import { normalizeProposed } from "@/lib/apollo";
import {
  enrichAccount as apolloEnrich,
  findCompanies as apolloCompanies,
  findPeople as apolloPeople,
  revealToAccount,
} from "@/lib/apollo-gateway";
import {
  enrichAccount as clayEnrich,
  findCompanies as clayCompanies,
  findPeople as clayPeople,
} from "@/lib/clay-gateway";
import type { AccountDraft, CompanyQuery, EnrichChange, EnrichField } from "@/lib/clay";
import {
  budgetState,
  planFor,
  sourcesLine,
  CAPABILITIES,
  type Need,
  type Service,
} from "./planner";
import { DEFAULT_LEVELS, levelsFor, nextCursor, revealCost, type Cursor } from "./search";
import { missingKey } from "@/lib/fit-key";
import { safeErrorLog } from "@/lib/agent/safe-error-log";
import { logUsage, type Trigger, type Used } from "./usage";

export type { Trigger, Used } from "./usage";
export { logUsage } from "./usage";

const ENV: Partial<Record<Service, string[]>> = {
  apollo: ["APOLLO_API_KEY"],
  clay: ["CLAY_API_KEY"],
  parallel: ["PARALLEL_API_KEY"],
  firecrawl: ["FIRECRAWL_API_KEY"],
  perplexity: ["PERPLEXITY_API_KEY"],
  apify: ["APIFY_API_KEY"],
  drive: ["GOOGLE_DRIVE_API_KEY"],
};

export function connectedServices(): Service[] {
  return (Object.keys(ENV) as Service[]).filter((s) => ENV[s]!.every((k) => !!process.env[k]));
}

export async function monthBudget(c: ToolCtx) {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const [{ data: b }, { data: rows }, { data: receipts }] = await Promise.all([
    c.db.from("org_budgets").select("monthly_limit").eq("org_id", c.orgId).maybeSingle(),
    c.db
      .from("integration_usage")
      .select("cost,currency,cost_kind")
      .eq("org_id", c.orgId)
      .gte("created_at", start.toISOString()),
    // Email classification charges (NK-0174) live in their own receipts, measured in USD.
    c.db
      .from("inbox_reply_receipts")
      .select("cost_usd")
      .eq("org_id", c.orgId)
      .gte("created_at", start.toISOString()),
  ]);
  const { spendTotals } = await import("@/lib/spend");
  const t = spendTotals([
    ...(rows ?? []).map((r) => ({
      cost: r.cost == null ? null : Number(r.cost),
      currency: r.currency,
      cost_kind: r.cost_kind as "measured" | "estimate" | "unknown",
    })),
    ...(receipts ?? []).map((r) => ({
      cost: r.cost_usd == null ? null : Number(r.cost_usd),
      currency: "USD",
      cost_kind: (r.cost_usd == null ? "unknown" : "measured") as "measured" | "unknown",
    })),
  ]);
  // The limit is in EUR. Without a verified exchange rate, other currencies are never converted: they are shown
  // as their own subtotal and the consumption is marked incomplete (decision of Fede, SDD pieza B.5).
  const spent = t.totals["EUR"] ?? 0;
  const otherCurrencies = Object.fromEntries(Object.entries(t.totals).filter(([k]) => k !== "EUR"));
  const complete = t.complete && Object.keys(otherCurrencies).length === 0;
  const limit = b?.monthly_limit == null ? null : Number(b.monthly_limit);
  return { spent, limit, otherCurrencies, unknown: t.unknown, complete, ...budgetState(spent, limit) };
}

async function planNeed(
  c: ToolCtx,
  need: Need,
  trigger: Trigger,
  depth: "quick" | "deep" = "quick",
) {
  const b = await monthBudget(c);
  return planFor({
    need,
    connected: connectedServices(),
    depth,
    budget: { remaining: b.remaining, automatic: trigger === "automatic", paused: b.paused },
  });
}

export type SourcedChange = EnrichChange & { source: string; quote?: string };
export type CompleteResult = {
  changes: SourcedChange[];
  found: boolean;
  used: Used[];
  sources: string;
  tried: string[];
  blocked: string | null;
};

const WEB_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["industry", "size", "country", "notes"],
  properties: Object.fromEntries(
    ["industry", "size", "country", "notes"].map((f) => [
      f,
      {
        type: "object",
        additionalProperties: false,
        required: ["value", "quote"],
        properties: {
          value: { type: "string", description: "Valor breve; cadena vacía si la web no lo dice" },
          quote: {
            type: "string",
            description: "Frase copiada literalmente de la web que lo demuestra; vacía si no hay",
          },
        },
      },
    ]),
  ),
};

/** Last source: the company's own website. Only values backed by a literal quote found in the page survive. */
async function webFallback(
  c: ToolCtx,
  accountId: string,
  fields: EnrichField[],
): Promise<SourcedChange[]> {
  const { data: acc } = await c.db
    .from("accounts")
    .select("name,domain")
    .eq("org_id", c.orgId)
    .eq("id", accountId)
    .maybeSingle();
  if (!acc || missingKey("cuenta", acc, "research_account").length) return [];
  const [{ readCompanySite }, { ask }, { quoteFound }] = await Promise.all([
    import("@/lib/web-research-core"),
    import("@/lib/ai-gateway"),
    import("@/lib/provenance"),
  ]);
  const site = await readCompanySite(acc.domain!, 20_000); // missingKey above guarantees a corporate domain
  const raw = await ask(
    "Extraes datos de empresa SOLO de su web. Para cada campo copia literalmente la frase que lo demuestra. Si la web no lo dice, deja valor y cita vacíos. Nunca deduzcas ni inventes. industry = sector en español; size = nº de empleados o rango; country = país de la sede; notes = qué hace la empresa en 1-2 frases en español.",
    site.text,
    { effort: "low", schema: { name: "web_company", schema: WEB_SCHEMA } },
  );
  let parsed: Record<string, { value: string; quote: string }> = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  return fields.flatMap((f) => {
    const v = parsed[f];
    if (!(v?.value?.trim() && quoteFound(v.quote, site.text))) return [];
    // Size and country go through the single rule: what does not fit is not proposed (SDD field-write-paths-normalization).
    const change = normalizeProposed({
      field: f,
      current: null,
      proposed: v.value.trim().slice(0, f === "notes" ? 600 : 120),
      empty: true,
      source: "web",
      quote: v.quote.trim().slice(0, 300),
    });
    return change ? [change] : [];
  });
}

/** «Completar datos de una cuenta»: Apollo, then Clay, then the company website as last source; first one wins per field. */
export async function completeAccount(
  c: ToolCtx,
  accountId: string,
  trigger: Trigger = "manual",
): Promise<CompleteResult> {
  const plan = await planNeed(c, "enrich_account", trigger);
  const steps = plan.steps.filter((s) => s.service === "apollo" || s.service === "clay");
  const webStep = plan.steps.find((s) => s.service === "firecrawl");
  if (!steps.length && !webStep)
    return {
      changes: [],
      found: false,
      used: [],
      sources: "",
      tried: [],
      blocked: plan.blocked ?? "Ningún servicio conectado puede completar cuentas ahora.",
    };
  const used: Used[] = [];
  const tried: string[] = [];
  const byField = new Map<string, SourcedChange>();
  let found = false;
  let lastError: string | null = null;
  for (const s of steps) {
    try {
      const r =
        s.service === "apollo" ? await apolloEnrich(c, accountId) : await clayEnrich(c, accountId);
      used.push({ service: s.service, cost: s.cost });
      tried.push(s.service);
      if (r.found) found = true;
      for (const ch of r.changes)
        if (!byField.has(ch.field)) byField.set(ch.field, { ...ch, source: s.service });
      // Stop once every empty field has a value; otherwise the next service may fill the gaps.
      if (found && [...byField.values()].filter((x) => x.empty).length >= 3) break;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      tried.push(s.service);
      if (/dominio/i.test(lastError)) break; // same precondition for every service
    }
  }
  if (webStep && !(lastError && /dominio/i.test(lastError))) {
    const { data: acc } = await c.db
      .from("accounts")
      .select("industry,size,country,notes")
      .eq("org_id", c.orgId)
      .eq("id", accountId)
      .maybeSingle();
    const left = (["industry", "size", "country", "notes"] as EnrichField[]).filter(
      (f) => !(acc as Record<string, string | null> | null)?.[f]?.trim() && !byField.has(f),
    );
    if (left.length) {
      try {
        const web = await webFallback(c, accountId, left);
        used.push({ service: "firecrawl", cost: webStep.cost });
        tried.push("firecrawl");
        if (web.length) found = true;
        for (const ch of web) byField.set(ch.field, ch);
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        tried.push("firecrawl");
      }
    }
  }
  await logUsage(c, "enrich_account", used, trigger);
  if (!used.length && lastError) throw new Error(lastError);
  return {
    changes: [...byField.values()],
    found,
    used,
    sources: sourcesLine(used),
    tried,
    blocked: null,
  };
}

/** Writes the empty fields an automatic run found, stamped «Automático · fuente · fecha». Returns the field names written. */
export async function applyAutoChanges(
  c: ToolCtx,
  accountId: string,
  found: SourcedChange[],
  at: string,
): Promise<EnrichField[]> {
  const { stampSources } = await import("@/lib/provenance");
  const { proposalSuggestion, splitAutoChanges } = await import("@/lib/field-proposals");
  // Size and country are canonical or not written at all, whatever source produced them.
  const changes = found.flatMap((ch) => normalizeProposed(ch) ?? []);
  // Only an empty field is written; what a person (or an older process) left there is never replaced.
  const { fill, offers } = splitAutoChanges(changes);
  if (!fill.length && !offers.length) return [];
  const { data: acc } = await c.db
    .from("accounts")
    .select("name,owner_id,field_sources")
    .eq("org_id", c.orgId)
    .eq("id", accountId)
    .maybeSingle();
  // A different value for a filled field becomes a pending suggestion; a dismissed value never returns (same key).
  if (acc && offers.length) {
    const rows = offers.map((ch) => {
      const sug = proposalSuggestion(
        { id: accountId, name: acc.name, owner_id: acc.owner_id },
        { field: ch.field, current: ch.current, proposed: ch.proposed, source: ch.source },
        acc.field_sources,
      );
      // email_block is not a column: strip it before writing (it only feeds the draft-block registry).
      const { email_block: _drop, ...row } = sug;
      return { ...row, org_id: c.orgId, action: sug.action as unknown as Json };
    });
    const { error: e } = await c.db
      .from("suggestions")
      .upsert(rows, { onConflict: "org_id,dedupe_key", ignoreDuplicates: true });
    if (e) console.error("field proposals", safeErrorLog(e));
  }
  if (!fill.length) return [];
  const patch: Record<string, unknown> = Object.fromEntries(
    fill.map((ch) => [ch.field, ch.proposed]),
  );
  patch.field_sources = stampSources(
    acc?.field_sources,
    fill.map((ch) => ({ field: ch.field, source: ch.source, quote: ch.quote })),
    at,
  );
  const { error } = await c.db
    .from("accounts")
    .update(patch as never)
    .eq("org_id", c.orgId)
    .eq("id", accountId);
  if (error) throw new Error(error.message);
  return fill.map((ch) => ch.field);
}

/** Wraps a core that already combines web sources (research, signals) so its spend is logged and labelled. */
export async function trackedRun<T>(
  c: ToolCtx,
  need: Need,
  trigger: Trigger,
  run: () => Promise<T>,
): Promise<T & { via: string }> {
  const plan = await planNeed(c, need, trigger);
  if (plan.blocked && trigger === "automatic") throw new Error(plan.blocked);
  const out = await run();
  const used = plan.steps
    .filter((s) => s.service === "firecrawl" || s.service === "perplexity")
    .map((s) => ({ service: s.service, cost: s.cost }));
  await logUsage(c, need, used, trigger);
  return { ...out, via: sourcesLine(used) };
}

export const NEED_LABEL = Object.fromEntries(
  Object.entries(CAPABILITIES).map(([k, v]) => [k, v.label]),
) as Record<Need, string>;

// ---------------- Key people (find_stakeholders) ----------------

export type KeyPerson = {
  key: string;
  name: string;
  title: string | null;
  linkedin: string | null;
  location: string | null;
  /** Apollo hides surname and contact until revealed (costs credits); Clay rows can be added as they are. */
  apolloId: string | null;
  hasEmail: boolean;
  hasPhone: boolean;
  existingId: string | null;
};
export type PeopleResult = {
  service: "apollo" | "clay" | null;
  rows: KeyPerson[];
  cursor: Cursor | null;
  sources: string;
  blocked: string | null;
  masked: boolean;
};

/** «Buscar personas clave»: Apollo's free search first; if it fails or finds nobody, Clay. «Traer más» keeps the same service. */
/** `company` (name + domain) searches a company that is not an account yet; the caller then passes the ICP's titles/levels. */
export async function findKeyPeople(
  c: ToolCtx,
  a: {
    accountId: string;
    company?: { name: string; domain: string };
    titles?: string[];
    levels?: string[];
    cursor?: Cursor | null;
  },
  trigger: Trigger = "manual",
): Promise<PeopleResult> {
  const plan = await planNeed(c, "find_stakeholders", trigger);
  const costOf = (s: Service) => plan.steps.find((x) => x.service === s)?.cost ?? 0;
  const order = (a.cursor ? [a.cursor.service] : plan.steps.map((s) => s.service)).filter(
    (s): s is "apollo" | "clay" => s === "apollo" || s === "clay",
  );
  if (!order.length)
    return {
      service: null,
      rows: [],
      cursor: null,
      sources: "",
      blocked: plan.blocked ?? "Ningún servicio conectado puede buscar personas ahora.",
      masked: false,
    };
  // Without explicit titles/levels, the ICP of the account's segment says who to look for.
  if (!a.company && !a.cursor && !a.titles?.length && !a.levels?.length) {
    const { icpForSegment, icpPeopleQuery } = await import("@/lib/icp");
    const [{ data: acc }, { data: icps }] = await Promise.all([
      c.db
        .from("accounts")
        .select("segment_id")
        .eq("org_id", c.orgId)
        .eq("id", a.accountId)
        .maybeSingle(),
      c.db
        .from("icp_profiles")
        .select("segment_id,target_titles,seniorities")
        .eq("org_id", c.orgId)
        .order("created_at"),
    ]);
    const p = icpPeopleQuery(icpForSegment(icps ?? [], acc?.segment_id));
    a = { ...a, titles: p.titles, levels: p.levels };
  }
  const levels = a.levels ?? DEFAULT_LEVELS;
  let lastError: string | null = null;
  const used: Used[] = [];
  for (const s of order) {
    try {
      if (s === "apollo") {
        const page = a.cursor?.service === "apollo" ? a.cursor.page : 1;
        const r = await apolloPeople(c, {
          accountId: a.accountId,
          company: a.company,
          page,
          query: { titles: a.titles, seniorities: levelsFor("apollo", levels) },
        });
        used.push({ service: s, cost: costOf(s) });
        if (!r.rows.length && !a.cursor && order.length > 1) continue;
        await logUsage(c, "find_stakeholders", used, trigger);
        return {
          service: s,
          masked: true,
          cursor: nextCursor(s, r.hasMore, page, null),
          sources: sourcesLine(used),
          blocked: null,
          rows: r.rows.map((p) => ({
            key: p.apolloId,
            name: p.name,
            title: p.title,
            linkedin: null,
            location: null,
            apolloId: p.apolloId,
            hasEmail: p.hasEmail,
            hasPhone: p.hasPhone,
            existingId: null,
          })),
        };
      }
      const searchId = a.cursor?.service === "clay" ? a.cursor.searchId : undefined;
      const r = await clayPeople(c, {
        accountId: a.accountId,
        company: a.company,
        searchId,
        limit: 10,
        query: searchId ? undefined : { titles: a.titles, seniority: levelsFor("clay", levels) },
      });
      used.push({ service: s, cost: costOf(s) });
      await logUsage(c, "find_stakeholders", used, trigger);
      return {
        service: s,
        masked: false,
        cursor: nextCursor(s, r.hasMore, 1, r.searchId),
        sources: sourcesLine(used),
        blocked: null,
        rows: r.rows.map((p, i) => ({
          key: p.linkedin_url ?? `${p.name}-${i}`,
          name: p.name,
          title: p.title,
          linkedin: p.linkedin_url,
          location: p.location,
          apolloId: null,
          hasEmail: false,
          hasPhone: false,
          existingId: p.existingId,
        })),
      };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      if (/dominio/i.test(lastError)) break;
    }
  }
  await logUsage(c, "find_stakeholders", used, trigger);
  if (used.length)
    return {
      service: null,
      rows: [],
      cursor: null,
      sources: sourcesLine(used),
      blocked: null,
      masked: false,
    };
  throw new Error(lastError ?? "No se ha podido buscar personas.");
}

/** Adds Apollo results to the map: reveals name, email and LinkedIn (and the mobile if asked). The gateway core logs the spend. */
export async function revealKeyPeople(
  c: ToolCtx,
  a: { accountId: string; apolloIds: string[]; phone?: boolean; webhookBase?: string },
) {
  const r = await revealToAccount(c, a);
  const cost = revealCost(r.length, !!a.phone);
  return { people: r, sources: sourcesLine([{ service: "apollo", cost }]) };
}

// ---------------- ICP companies (icp_companies) ----------------

export type IcpCompany = AccountDraft & { existingId: string | null };
export type CompaniesResult = {
  service: "apollo" | "clay" | null;
  rows: IcpCompany[];
  cursor: Cursor | null;
  sources: string;
  blocked: string | null;
  deep: boolean;
};

/** «Buscar empresas por ICP»: quick search in Apollo, then Clay. Parallel (deep, minutes) is offered separately. */
export async function findIcpCompanies(
  c: ToolCtx,
  a: { query: CompanyQuery; cursor?: Cursor | null },
  trigger: Trigger = "manual",
): Promise<CompaniesResult> {
  const plan = await planNeed(c, "icp_companies", trigger);
  const deep = plan.steps.some((s) => s.service === "parallel");
  const costOf = (s: Service) => plan.steps.find((x) => x.service === s)?.cost ?? 0;
  const order = (a.cursor ? [a.cursor.service] : plan.steps.map((s) => s.service)).filter(
    (s): s is "apollo" | "clay" => s === "apollo" || s === "clay",
  );
  if (!order.length)
    return {
      service: null,
      rows: [],
      cursor: null,
      sources: "",
      deep,
      blocked:
        plan.blocked ?? (deep ? null : "Ningún servicio conectado puede buscar empresas ahora."),
    };
  let lastError: string | null = null;
  const used: Used[] = [];
  for (const s of order) {
    try {
      if (s === "apollo") {
        const page = a.cursor?.service === "apollo" ? a.cursor.page : 1;
        const r = await apolloCompanies(c, {
          page,
          query: {
            keywords: a.query.keywords,
            countries: a.query.countries,
            minEmployees: a.query.minEmployees,
            maxEmployees: a.query.maxEmployees,
          },
        });
        used.push({ service: s, cost: costOf(s) });
        if (!r.rows.length && !a.cursor && order.length > 1) continue;
        await logUsage(c, "icp_companies", used, trigger);
        return {
          service: s,
          rows: r.rows,
          cursor: nextCursor(s, r.hasMore, page, null),
          sources: sourcesLine(used),
          blocked: null,
          deep,
        };
      }
      const searchId = a.cursor?.service === "clay" ? a.cursor.searchId : undefined;
      const r = await clayCompanies(c, {
        searchId,
        limit: 10,
        query: searchId ? undefined : a.query,
      });
      used.push({ service: s, cost: costOf(s) });
      await logUsage(c, "icp_companies", used, trigger);
      return {
        service: s,
        rows: r.rows,
        cursor: nextCursor(s, r.hasMore, 1, r.searchId),
        sources: sourcesLine(used),
        blocked: null,
        deep,
      };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  await logUsage(c, "icp_companies", used, trigger);
  if (used.length)
    return {
      service: null,
      rows: [],
      cursor: null,
      sources: sourcesLine(used),
      blocked: null,
      deep,
    };
  throw new Error(lastError ?? "No se ha podido buscar empresas.");
}
