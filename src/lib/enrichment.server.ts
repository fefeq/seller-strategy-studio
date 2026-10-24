// Server side of the account enrichment (U-1): reads the company's own website, asks the model for the
// three data points with a quote as evidence, and writes only what the rules allow. Uses the privileged
// client because it also runs from the public API, the CSV import and the cron, always scoped by org_id.
import { ask } from "./ai-gateway";
import {
  EXTRACTION_SCHEMA, EXTRACTION_SYSTEM, extractVisibleText, extractionPrompt, isBlockedHost, isFreeEmailDomain, isSafePublicHost,
  missingFields, parseExtraction, planEnrichment, readAutoEnrichment, type AccountData, type EnrichField, type SourceResult, type SourceRunner,
} from "./enrichment";

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

const PAGE_TIMEOUT_MS = 5000;
const PAGE_MAX_BYTES = 300_000;
const MAX_REDIRECTS = 3;
const ABOUT_PATHS = ["/", "/about", "/about-us", "/sobre-nosotros", "/quienes-somos", "/nosotros", "/empresa"];
/** The same company is not looked up again for this long (cost control without a cap). */
const THROTTLE_MS = 24 * 3600_000;
/** A «running» row older than this was abandoned (crashed run): the cron takes it again. */
const STALE_RUNNING_MS = 10 * 60_000;
/** Each attempt must end within this time (CA-13). */
const ATTEMPT_MS = 5 * 60_000;

function privateAddress(ip: string): boolean {
  if (/^(10\.|127\.|0\.|169\.254\.|192\.168\.)/.test(ip) || /^172\.(1[6-9]|2\d|3[01])\./.test(ip) || /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip)) return true;
  const v6 = ip.toLowerCase();
  return v6 === "::1" || v6 === "::" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80") || v6.startsWith("::ffff:");
}

/** Resolves the host and refuses private addresses. Where DNS is not available (edge runtime), fetch cannot reach private networks anyway. */
async function resolvesPublic(host: string): Promise<boolean> {
  try {
    const dns = await import("node:dns/promises");
    const res = await dns.lookup(host, { all: true });
    return res.length > 0 && res.every((r) => !privateAddress(r.address));
  } catch {
    return true;
  }
}

async function readBody(res: Response): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let out = "";
  let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    n += value.byteLength;
    out += dec.decode(value, { stream: true });
    if (n >= PAGE_MAX_BYTES) { await reader.cancel().catch(() => undefined); break; }
  }
  return out;
}

/** GET with redirects followed by hand: every hop must be a public host and never LinkedIn. */
async function fetchPage(url: string): Promise<string | null> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let u: URL;
    try { u = new URL(current); } catch { return null; }
    if (u.protocol !== "https:" || u.port || !isSafePublicHost(u.hostname) || !(await resolvesPublic(u.hostname))) return null;
    const res = await fetch(u, { redirect: "manual", signal: AbortSignal.timeout(PAGE_TIMEOUT_MS), headers: { "User-Agent": "NokkoBot/1.0 (+company data enrichment)", Accept: "text/html" } }).catch(() => null);
    if (!res) return null;
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return null;
      current = new URL(loc, u).toString();
      continue;
    }
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("text/html")) return null;
    return readBody(res).catch(() => null);
  }
  return null;
}

/** Visible text of the home page and a few «about» pages of the company's own site. */
export async function readCompanySite(domain: string): Promise<{ text: string; pages: number }> {
  const host = domain.trim().toLowerCase();
  if (!isSafePublicHost(host) || isBlockedHost(host) || isFreeEmailDomain(host)) return { text: "", pages: 0 };
  const htmls = await Promise.all(ABOUT_PATHS.map((p) => fetchPage(`https://${host}${p}`)));
  const texts = htmls.filter((h): h is string => !!h).map((h) => extractVisibleText(h, 6000));
  return { text: texts.join(" \n ").slice(0, 16000), pages: texts.length };
}

/** Web source: reads the site and keeps only what the page states explicitly. Without a domain, it does nothing (CA-15 needs a search API: not in v1). */
export const webSource: SourceRunner = {
  id: "web",
  async run({ name, domain, fields }): Promise<SourceResult> {
    if (!domain) return { patch: {} };
    const { text, pages } = await readCompanySite(domain);
    if (!text) return { patch: {}, usage: { pages: 0 } };
    const raw = await ask(EXTRACTION_SYSTEM, extractionPrompt(name, text), { effort: "low", schema: { name: "company_facts", schema: EXTRACTION_SCHEMA } });
    const all = parseExtraction(raw, text);
    const patch: Partial<Record<EnrichField, string>> = {};
    for (const f of fields) if (all[f]) patch[f] = all[f];
    return { patch, usage: { pages, model_calls: 1 } };
  },
};

/** Sources in use. A signed data provider plugs in here as {id: "provider"} (U-4, outside this SDD). */
export const SOURCES: SourceRunner[] = [webSource];

/** The company can switch enrichment off (owner or sales_leader); on by default (CA-17). */
export async function enrichmentEnabled(db: Admin, orgId: string): Promise<boolean> {
  const { data } = await db.from("lead_settings").select("sla").eq("org_id", orgId).maybeSingle();
  return readAutoEnrichment(data?.sla);
}

type Row = { id: string; org_id: string; account_id: string };

/** Does one attempt and records it. Never throws: a failure is logged in the attempt and the lead is untouched (CA-12). */
async function runAttempt(db: Admin, row: Row, sources: SourceRunner[]): Promise<void> {
  const finish = (patch: Record<string, unknown>) => db.from("account_enrichments").update({ ...patch, finished_at: new Date().toISOString() }).eq("id", row.id).eq("org_id", row.org_id);
  try {
    const { data: acc } = await db.from("accounts").select("name,domain,industry,size,country,auto_filled").eq("id", row.account_id).eq("org_id", row.org_id).maybeSingle();
    if (!acc) return void (await finish({ status: "skipped", error: "account not found" }));
    if (!acc.domain || isFreeEmailDomain(acc.domain)) return void (await finish({ status: "skipped", error: acc.domain ? "free-email domain" : "no domain" }));
    const data: AccountData & { name: string; domain: string | null } = acc;
    if (!sources.some((s) => missingFields(data, s.id).length)) return void (await finish({ status: "skipped", error: "nothing missing" }));
    const out = await Promise.race([
      planEnrichment(data, sources),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), ATTEMPT_MS)),
    ]);
    const bySource = new Map<string, Record<string, string>>();
    for (const [f, s] of Object.entries(out.marks)) bySource.set(s!, { ...(bySource.get(s!) ?? {}), [f]: out.patch[f as EnrichField]! });
    const written: Record<string, string> = {};
    const at = new Date().toISOString();
    for (const [source, patch] of bySource) {
      const { data: w } = await db.rpc("apply_account_enrichment", { _account: row.account_id, _org: row.org_id, _patch: patch, _source: source, _at: at });
      Object.assign(written, (w as Record<string, string> | null) ?? {});
    }
    await finish({
      status: out.errors.length && !Object.keys(written).length ? "failed" : "done",
      source: out.sources.join(",") || null,
      fields: written,
      usage: out.usage,
      cost_usd: null,
      error: out.errors.join(" | ") || null,
    });
  } catch (e) {
    console.error("enrichment attempt failed", row.id, e);
    try { await finish({ status: "failed", error: (e instanceof Error ? e.message : String(e)).slice(0, 300) }); } catch { /* the lead is not affected */ }
  }
}

/** Takes the row for this run; false if another run already has it. */
async function claim(db: Admin, row: Row): Promise<boolean> {
  const { data } = await db.from("account_enrichments").update({ status: "running" }).eq("id", row.id).eq("org_id", row.org_id).in("status", ["pending"]).select("id");
  return !!data?.length;
}

/**
 * Queues an attempt per account (skipping those tried in the last 24 h) and works through the queue until
 * the time budget ends; whatever is left stays pending for the cron. Never throws.
 */
export async function enrichAccounts(orgId: string, accountIds: string[], opts: { budgetMs?: number } = {}): Promise<{ queued: number; processed: number }> {
  try {
    const ids = [...new Set(accountIds)].filter(Boolean);
    if (!ids.length) return { queued: 0, processed: 0 };
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    if (!(await enrichmentEnabled(db, orgId))) return { queued: 0, processed: 0 };
    const since = new Date(Date.now() - THROTTLE_MS).toISOString();
    const { data: recent } = await db.from("account_enrichments").select("account_id").eq("org_id", orgId).in("account_id", ids).gte("created_at", since);
    const skip = new Set((recent ?? []).map((r) => r.account_id));
    const fresh = ids.filter((id) => !skip.has(id));
    if (!fresh.length) return { queued: 0, processed: 0 };
    const { data: rows } = await db.from("account_enrichments").insert(fresh.map((account_id) => ({ org_id: orgId, account_id }))).select("id,org_id,account_id");
    const processed = await work(db, rows ?? [], opts.budgetMs ?? 10_000);
    return { queued: rows?.length ?? 0, processed };
  } catch (e) {
    console.error("enrichAccounts failed", e);
    return { queued: 0, processed: 0 };
  }
}

async function work(db: Admin, rows: Row[], budgetMs: number): Promise<number> {
  const end = Date.now() + budgetMs;
  let done = 0;
  const queue = [...rows];
  // Three at a time: enough to move a CSV along without hammering the sites or the model.
  const lane = async () => {
    for (let r = queue.shift(); r && Date.now() < end; r = queue.shift()) {
      if (!(await claim(db, r))) continue;
      await runAttempt(db, r, SOURCES);
      done++;
    }
  };
  await Promise.all([lane(), lane(), lane()]);
  return done;
}

/** Cron safety net: finishes what the request did not (pending, or running too long ago to be alive). */
export async function processPendingEnrichments(db: Admin, opts: { limit?: number; budgetMs?: number } = {}): Promise<{ processed: number }> {
  try {
    const stale = new Date(Date.now() - STALE_RUNNING_MS).toISOString();
    await db.from("account_enrichments").update({ status: "pending" }).eq("status", "running").lt("created_at", stale);
    const { data: rows } = await db.from("account_enrichments").select("id,org_id,account_id").eq("status", "pending").order("created_at").limit(opts.limit ?? 50);
    const enabled = new Map<string, boolean>();
    const live: Row[] = [];
    for (const r of rows ?? []) {
      if (!enabled.has(r.org_id)) enabled.set(r.org_id, await enrichmentEnabled(db, r.org_id));
      if (enabled.get(r.org_id)) live.push(r);
      else await db.from("account_enrichments").update({ status: "skipped", error: "disabled by the company", finished_at: new Date().toISOString() }).eq("id", r.id).eq("org_id", r.org_id);
    }
    return { processed: await work(db, live, opts.budgetMs ?? 3 * 60_000) };
  } catch (e) {
    console.error("processPendingEnrichments failed", e);
    return { processed: 0 };
  }
}
