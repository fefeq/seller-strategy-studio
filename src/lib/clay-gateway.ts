// Clay through the Lovable connector gateway, plus the three cores the screens (clay.functions.ts),
// the agent and MCP share. Server-only usage: reads LOVABLE_API_KEY / CLAY_API_KEY inside the calls.
import type { ToolCtx } from "@/lib/agent/tool-kit";
import { mustFind } from "@/lib/agent/tool-kit";
import {
  MAX_PAGE,
  clayErrorText,
  companyFilters,
  companyToAccount,
  enrichChanges,
  existingByDomain,
  existingStakeholder,
  peopleFilters,
  personToStakeholder,
  type AccountDraft,
  type ClayCompany,
  type ClayPerson,
  type ClayQuota,
  type CompanyQuery,
  type EnrichChange,
  type PeopleQuery,
  type StakeholderDraft,
} from "@/lib/clay";
import { canonicalCurrent, normalizeDraft } from "@/lib/apollo";
import { cleanDomain } from "@/lib/leads";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/clay";

function headers() {
  const lovable = process.env["LOVABLE_API_KEY"];
  const clay = process.env["CLAY_API_KEY"];
  if (!lovable || !clay)
    throw new Error("Clay no está conectado a Nokko. Pide al Owner que lo conecte en Conexiones.");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${lovable}`,
    "X-Connection-Api-Key": clay,
  };
}

async function clay(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown },
  retry = true,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the Clay response is untyped JSON; callers read the fields they need
): Promise<any> {
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    method: init.method,
    headers: headers(),
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (res.status === 429 && retry) {
    const wait = Math.min(Number(res.headers.get("retry-after")) || 2, 8);
    await new Promise((r) => setTimeout(r, wait * 1000 + Math.random() * 400));
    return clay(path, init, false);
  }
  if (!res.ok) {
    const raw = await res.text();
    console.error(`Clay ${init.method} ${path} [${res.status}]: ${raw.slice(0, 500)}`);
    let msg = raw;
    try {
      msg = String(JSON.parse(raw).message ?? raw);
    } catch {
      /* plain text */
    }
    throw new Error(clayErrorText(res.status, msg));
  }
  return res.json();
}

type Page<T> = { searchId: string; rows: T[]; hasMore: boolean; quota: ClayQuota };

async function search<T>(
  source: "companies" | "people",
  filters: Record<string, unknown> | null,
  searchId: string | undefined,
  limit: number,
): Promise<Page<T>> {
  let id = searchId;
  if (!id) {
    const created = await clay("/search/filters-mode", {
      method: "POST",
      body: { source_type: source, filters },
    });
    id = String(created.search_id ?? "");
    if (!id) throw new Error("Clay no ha abierto la búsqueda. Vuelve a probar.");
  }
  const r = await clay(`/search/filters-mode/${encodeURIComponent(id)}/run`, {
    method: "POST",
    body: { limit: Math.max(1, Math.min(MAX_PAGE, Math.floor(limit))) },
  });
  return {
    searchId: id,
    rows: (r.data ?? []) as T[],
    hasMore: !!r.has_more,
    quota: (r.period_quota ?? null) as ClayQuota,
  };
}

const industriesCache: { at: number; list: string[] } = { at: 0, list: [] };
/** LinkedIn industries Clay accepts in the sector filter (cached for an hour). */
export async function clayIndustries(): Promise<string[]> {
  if (industriesCache.list.length && Date.now() - industriesCache.at < 3_600_000)
    return industriesCache.list;
  const r = await clay("/search/filters-mode/fields?source_type=companies", { method: "GET" });
  const f = ((r.fields ?? []) as { name: string; allowed_values?: string[] }[]).find(
    (x) => x.name === "industries",
  );
  industriesCache.list = f?.allowed_values ?? [];
  industriesCache.at = Date.now();
  return industriesCache.list;
}

export type CompanyHit = AccountDraft & { existingId: string | null };
export async function findCompanies(
  c: ToolCtx,
  a: { query?: CompanyQuery; searchId?: string; limit?: number },
): Promise<Page<CompanyHit>> {
  const filters = a.searchId ? null : companyFilters(a.query ?? {});
  const page = await search<ClayCompany>("companies", filters, a.searchId, a.limit ?? 10);
  const { data } = await c.db
    .from("accounts")
    .select("id,domain")
    .eq("org_id", c.orgId)
    .not("domain", "is", null)
    .limit(5000);
  const has = existingByDomain(data ?? []);
  return {
    ...page,
    rows: page.rows.map((r) => {
      const d = normalizeDraft(companyToAccount(r));
      return { ...d, existingId: has(d.domain) };
    }),
  };
}

export type PersonHit = StakeholderDraft & { existingId: string | null };
/** `company` searches a company that is not an account yet (Descubiertos), by its domain. */
export async function findPeople(
  c: ToolCtx,
  a: {
    accountId: string;
    company?: { name: string; domain: string };
    query?: PeopleQuery;
    searchId?: string;
    limit?: number;
  },
): Promise<Page<PersonHit> & { account: string }> {
  const acc = a.company
    ? { id: null, ...a.company }
    : await mustFind<{ id: string; name: string; domain: string | null }>(
        c,
        "accounts",
        a.accountId,
        "esa cuenta",
        "id,name,domain",
      );
  const filters = a.searchId ? null : peopleFilters(acc.domain, a.query ?? {});
  const page = await search<ClayPerson>("people", filters, a.searchId, a.limit ?? 10);
  const { data } = acc.id
    ? await c.db
        .from("stakeholders")
        .select("id,name,linkedin_url")
        .eq("org_id", c.orgId)
        .eq("account_id", acc.id)
    : { data: [] };
  const has = existingStakeholder(data ?? []);
  return {
    ...page,
    account: acc.name,
    rows: page.rows.map((r) => {
      const p = personToStakeholder(r);
      return { ...p, existingId: has(p) };
    }),
  };
}

export type Enrichment = {
  found: boolean;
  company: AccountDraft | null;
  changes: EnrichChange[];
  quota: ClayQuota;
};
export async function enrichAccount(c: ToolCtx, accountId: string): Promise<Enrichment> {
  const acc = await mustFind<{
    id: string;
    domain: string | null;
    industry: string | null;
    size: string | null;
    country: string | null;
    notes: string | null;
  }>(c, "accounts", accountId, "esa cuenta", "id,domain,industry,size,country,notes");
  const domain = cleanDomain(acc.domain);
  if (!domain)
    throw new Error("La cuenta no tiene dominio. Añádelo (empresa.com) para completarla con Clay.");
  const page = await search<ClayCompany>(
    "companies",
    { include_company_identifiers: [domain] },
    undefined,
    1,
  );
  const hit = page.rows[0];
  if (!hit) return { found: false, company: null, changes: [], quota: page.quota };
  const company = normalizeDraft(companyToAccount(hit));
  return {
    found: true,
    company,
    changes: enrichChanges(canonicalCurrent(acc), company),
    quota: page.quota,
  };
}
