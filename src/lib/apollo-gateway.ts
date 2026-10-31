// Apollo.io through the Lovable connector gateway, plus the cores the screens (apollo.functions.ts),
// the agent and MCP share. Server-only usage: env vars are read inside the calls.
import type { ToolCtx } from "@/lib/agent/tool-kit";
import { mustFind, ok } from "@/lib/agent/tool-kit";
import {
  enrichChanges,
  existingByDomain,
  existingStakeholder,
  type AccountDraft,
  type EnrichChange,
} from "@/lib/clay";
import {
  APOLLO_PUBLISHED_URL,
  APOLLO_WEBHOOK_PATH,
  MAX_REVEAL,
  apolloErrorText,
  companyParams,
  matchDetails,
  matchToContact,
  normalizeDraft,
  canonicalCurrent,
  orgToAccount,
  peopleParams,
  searchPersonPreview,
  type ApolloCompanyQuery,
  type ApolloMatch,
  type ApolloOrg,
  type ApolloPeopleQuery,
  type ApolloSearchPerson,
  type PersonPreview,
  type RevealedContact,
} from "@/lib/apollo";
import { cleanDomain } from "@/lib/leads";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/apollo";

function headers() {
  const lovable = process.env["LOVABLE_API_KEY"];
  const apollo = process.env["APOLLO_API_KEY"];
  if (!lovable || !apollo)
    throw new Error(
      "Apollo no está conectado a Nokko. Pide al Owner que lo conecte en Conexiones.",
    );
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${lovable}`,
    "X-Connection-Api-Key": apollo,
  };
}

async function apollo(
  path: string,
  params: [string, string][],
  body?: unknown,
  retry = true,
): Promise<any> {
  const url = new URL(`${GATEWAY_URL}${path}`);
  for (const [k, v] of params) url.searchParams.append(k, v);
  const res = await fetch(url, {
    method: "POST",
    headers: headers(),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 429 && retry) {
    const wait = Math.min(Number(res.headers.get("retry-after")) || 2, 8);
    await new Promise((r) => setTimeout(r, wait * 1000 + Math.random() * 400));
    return apollo(path, params, body, false);
  }
  if (!res.ok) {
    const raw = await res.text();
    console.error(`Apollo ${path} [${res.status}]: ${raw.slice(0, 500)}`);
    throw new Error(apolloErrorText(res.status, raw));
  }
  return res.json();
}

/** Webhook URL (with its secret) Apollo posts phones to. `base` comes from the request host when there is one. */
function webhookUrl(base?: string) {
  const secret = process.env["APOLLO_WEBHOOK_SECRET"];
  if (!secret)
    throw new Error(
      "Falta configurar la recepción de teléfonos de Apollo. Avisa al equipo de Nokko.",
    );
  return `${base ?? `${APOLLO_PUBLISHED_URL}${APOLLO_WEBHOOK_PATH}`}?secret=${encodeURIComponent(secret)}`;
}

async function bulkMatch(
  details: Record<string, string>[],
  phone: boolean,
  webhookBase?: string,
): Promise<(RevealedContact | null)[]> {
  if (!details.length) return [];
  if (details.length > MAX_REVEAL)
    throw new Error(`Apollo revela como máximo ${MAX_REVEAL} personas a la vez. Elige menos.`);
  const params: [string, string][] = [["reveal_personal_emails", "false"]];
  if (phone) params.push(["reveal_phone_number", "true"], ["webhook_url", webhookUrl(webhookBase)]);
  const r = await apollo("/api/v1/people/bulk_match", params, { details });
  return ((r.matches ?? []) as (ApolloMatch | null)[]).map(matchToContact);
}

/** Marks a phone as requested for this company (the webhook fills it in a few minutes). */
async function requestPhone(c: ToolCtx, p: RevealedContact, stakeholderId: string | null) {
  ok(
    await c.db.from("phone_reveals").upsert(
      {
        org_id: c.orgId,
        apollo_person_id: p.apolloId,
        stakeholder_id: stakeholderId,
        name: p.name,
        status: "pending",
        phones: [],
        requested_by: c.userId,
        requested_at: new Date().toISOString(),
        received_at: null,
      },
      { onConflict: "org_id,apollo_person_id" },
    ),
  );
}

export type PeoplePage = { account: string; page: number; hasMore: boolean; rows: PersonPreview[] };
/** `company` searches a company that is not an account yet (Descubiertos), by its domain. */
export async function findPeople(
  c: ToolCtx,
  a: {
    accountId: string;
    company?: { name: string; domain: string };
    query?: ApolloPeopleQuery;
    page?: number;
  },
): Promise<PeoplePage> {
  const acc =
    a.company ??
    (await mustFind<{ id: string; name: string; domain: string | null }>(
      c,
      "accounts",
      a.accountId,
      "esa cuenta",
      "id,name,domain",
    ));
  const page = a.page ?? 1;
  const r = await apollo(
    "/api/v1/mixed_people/api_search",
    peopleParams(acc.domain, a.query ?? {}, page),
  );
  const rows = ((r.people ?? []) as ApolloSearchPerson[])
    .map(searchPersonPreview)
    .filter((x): x is PersonPreview => !!x);
  const total = Number(r.total_entries ?? r.pagination?.total_entries ?? 0);
  return { account: acc.name, page, hasMore: total > page * 25 && rows.length > 0, rows };
}

export type RevealResult = {
  contact: RevealedContact;
  stakeholderId: string;
  created: boolean;
  phone: "requested" | "cached" | "pending" | "no";
};

/** Reveals people found in search and adds (or completes) them on the account's stakeholder map. */
export async function revealToAccount(
  c: ToolCtx,
  a: { accountId: string; apolloIds: string[]; phone?: boolean; webhookBase?: string },
): Promise<RevealResult[]> {
  const acc = await mustFind<{ id: string; domain: string | null }>(
    c,
    "accounts",
    a.accountId,
    "esa cuenta",
    "id,domain",
  );
  const ids = [...new Set(a.apolloIds)].slice(0, MAX_REVEAL);
  const matches = (
    await bulkMatch(
      ids.map((id) => ({ id })),
      !!a.phone,
      a.webhookBase,
    )
  ).filter((m): m is RevealedContact => !!m);
  const { data: existing } = await c.db
    .from("stakeholders")
    .select("id,name,linkedin_url,email,title")
    .eq("org_id", c.orgId)
    .eq("account_id", acc.id);
  const has = existingStakeholder(existing ?? []);
  const out: RevealResult[] = [];
  for (const m of matches) {
    const found = has({
      name: m.name,
      title: m.title,
      linkedin_url: m.linkedin_url,
      location: m.location,
    });
    let stakeholderId = found;
    if (found) {
      const cur = (existing ?? []).find((s) => s.id === found)!;
      const patch = {
        ...(m.email && !cur.email ? { email: m.email } : {}),
        ...(m.linkedin_url && !cur.linkedin_url ? { linkedin_url: m.linkedin_url } : {}),
        ...(m.title && !cur.title ? { title: m.title } : {}),
      };
      if (Object.keys(patch).length)
        ok(await c.db.from("stakeholders").update(patch).eq("org_id", c.orgId).eq("id", found));
    } else {
      const row = ok(
        await c.db
          .from("stakeholders")
          .insert({
            org_id: c.orgId,
            account_id: acc.id,
            name: m.name,
            title: m.title,
            email: m.email,
            linkedin_url: m.linkedin_url,
          })
          .select("id")
          .single(),
      );
      if (!row?.id) throw new Error("No se ha podido añadir a la persona al mapa.");
      stakeholderId = row.id;
    }
    if (a.phone) await requestPhone(c, m, stakeholderId!);
    out.push({
      contact: m,
      stakeholderId: stakeholderId!,
      created: !found,
      phone: a.phone ? "requested" : "no",
    });
  }
  return out;
}

/** Reveals the email (and optionally the mobile) of a stakeholder already on a map. */
export async function revealStakeholder(
  c: ToolCtx,
  a: { stakeholderId: string; phone?: boolean; webhookBase?: string },
): Promise<{
  found: boolean;
  contact: RevealedContact | null;
  phone: "requested" | "cached" | "pending" | "no";
  phoneNumber: string | null;
}> {
  const s = await mustFind<{
    id: string;
    name: string;
    email: string | null;
    linkedin_url: string | null;
    title: string | null;
    phone: string | null;
    account_id: string;
  }>(
    c,
    "stakeholders",
    a.stakeholderId,
    "esa persona",
    "id,name,email,linkedin_url,title,phone,account_id",
  );
  const acc = await mustFind<{ domain: string | null }>(
    c,
    "accounts",
    s.account_id,
    "la cuenta de esa persona",
    "id,domain",
  );
  if (a.phone) {
    // Cache first: a delivered phone costs nothing to reuse; a pending one is on its way.
    const { data: prev } = await c.db
      .from("phone_reveals")
      .select("status,phones")
      .eq("org_id", c.orgId)
      .eq("stakeholder_id", s.id)
      .order("requested_at", { ascending: false })
      .limit(1);
    const last = prev?.[0];
    const cached =
      last?.status === "delivered"
        ? (((last.phones as { number: string }[] | null) ?? [])[0]?.number ?? null)
        : null;
    if (cached) {
      if (!s.phone)
        ok(
          await c.db
            .from("stakeholders")
            .update({ phone: cached })
            .eq("org_id", c.orgId)
            .eq("id", s.id),
        );
      return { found: true, contact: null, phone: "cached", phoneNumber: cached };
    }
    if (last?.status === "pending")
      return { found: true, contact: null, phone: "pending", phoneNumber: null };
  }
  const [m] = await bulkMatch(
    [
      matchDetails({
        name: s.name,
        email: s.email,
        linkedin_url: s.linkedin_url,
        domain: cleanDomain(acc.domain),
      }),
    ],
    !!a.phone,
    a.webhookBase,
  );
  if (!m) return { found: false, contact: null, phone: "no", phoneNumber: null };
  const patch = {
    ...(m.email && m.email !== s.email ? { email: m.email } : {}),
    ...(m.linkedin_url && !s.linkedin_url ? { linkedin_url: m.linkedin_url } : {}),
    ...(m.title && !s.title ? { title: m.title } : {}),
  };
  if (Object.keys(patch).length)
    ok(await c.db.from("stakeholders").update(patch).eq("org_id", c.orgId).eq("id", s.id));
  if (a.phone) await requestPhone(c, m, s.id);
  return { found: true, contact: m, phone: a.phone ? "requested" : "no", phoneNumber: null };
}

export type CompanyHit = AccountDraft & { existingId: string | null };
export async function findCompanies(
  c: ToolCtx,
  a: { query: ApolloCompanyQuery; page?: number },
): Promise<{ page: number; hasMore: boolean; rows: CompanyHit[] }> {
  const page = a.page ?? 1;
  const r = await apollo("/api/v1/mixed_companies/search", companyParams(a.query, page));
  const orgs = [
    ...((r.organizations ?? []) as ApolloOrg[]),
    ...((r.accounts ?? []) as ApolloOrg[]),
  ];
  const { data } = await c.db
    .from("accounts")
    .select("id,domain")
    .eq("org_id", c.orgId)
    .not("domain", "is", null)
    .limit(5000);
  const has = existingByDomain(data ?? []);
  const totalPages = Number(r.pagination?.total_pages ?? 0);
  return {
    page,
    hasMore: totalPages > page,
    rows: orgs.map((o) => {
      const d = normalizeDraft(orgToAccount(o));
      return { ...d, existingId: has(d.domain) };
    }),
  };
}

export type ApolloEnrichment = {
  found: boolean;
  company: AccountDraft | null;
  changes: EnrichChange[];
};
export async function enrichAccount(c: ToolCtx, accountId: string): Promise<ApolloEnrichment> {
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
    throw new Error(
      "La cuenta no tiene dominio. Añádelo (empresa.com) para completarla con Apollo.",
    );
  const r = await apollo("/api/v1/organizations/bulk_enrich", [["domains[]", domain]]);
  const org = ((r.organizations ?? []) as (ApolloOrg | null)[])[0];
  if (!org) return { found: false, company: null, changes: [] };
  const company = normalizeDraft(orgToAccount(org));
  return { found: true, company, changes: enrichChanges(canonicalCurrent(acc), company) };
}
