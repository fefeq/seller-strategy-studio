// Product data from each company's own PostHog (tested in product-usage.test.ts): the HogQL queries Nokko
// runs, how their rows become trials (self-service funnel) and usage per company domain, the account
// match, the trend, and the thresholds of the product-led suggestions.
import { cleanDomain } from "@/lib/leads";
import { FREE_MAIL_DOMAINS } from "./free-mail";

export const POSTHOG_HOSTS = {
  eu: "https://eu.posthog.com",
  us: "https://us.posthog.com",
} as const;

/** PostHog Cloud region (eu/us) or a self-hosted https address → the API host; null if not valid. */
export function posthogHost(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  if (s === "eu" || s === "us") return POSTHOG_HOSTS[s];
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (
    u.protocol !== "https:" ||
    /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(u.hostname)
  )
    return null;
  // The ingestion hosts (eu.i.posthog.com) do not serve the query API.
  const host = u.hostname
    .replace(/^(eu|us)\.i\.posthog\.com$/, "$1.posthog.com")
    .replace(/^app\.posthog\.com$/, "us.posthog.com");
  return `https://${host}${u.port ? `:${u.port}` : ""}`;
}

/** A personal key with read access (phx_); the public project token (phc_) cannot read. */
export function checkPosthogKey(
  raw: string,
): { ok: true; key: string } | { ok: false; error: string } {
  const key = raw.trim();
  if (key.startsWith("phc_"))
    return {
      ok: false,
      error:
        "Esa es la clave pública del proyecto (phc_), que no permite leer datos. Crea una clave personal (empieza por phx_) con permiso de lectura de consultas.",
    };
  if (!/^phx_[A-Za-z0-9]{20,}$/.test(key))
    return {
      ok: false,
      error:
        "Esa no parece una clave personal de PostHog. Copia la clave completa: empieza por phx_.",
    };
  return { ok: true, key };
}

export const projectIdOk = (raw: string) => /^[0-9]{1,12}$/.test(raw.trim());
export const domainPropertyOk = (raw: string) => /^[A-Za-z0-9_$]{1,80}$/.test(raw.trim());

export function companyDomain(raw: string | null | undefined): string | null {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  const d = cleanDomain(s.includes("@") ? s.split("@").pop()! : s);
  return d && d.includes(".") && !FREE_MAIL_DOMAINS.has(d) ? d : null;
}

export type HogQL = { query: string; values: Record<string, string> };

/** Per person: first sign-up, activation and payment events in the last year (people with a sign-up only). */
export function funnelQuery(ev: {
  signup: string;
  activation?: string | null;
  paid?: string | null;
}): HogQL {
  return {
    query: `SELECT person_id AS pid, any(person.properties.email) AS email,
  minIf(timestamp, event = {signup}) AS signed_up, minIf(timestamp, event = {activation}) AS activated, minIf(timestamp, event = {paid}) AS paid
FROM events
WHERE timestamp > now() - INTERVAL 365 DAY AND event IN ({signup}, {activation}, {paid})
GROUP BY person_id
HAVING countIf(event = {signup}) > 0
ORDER BY signed_up DESC
LIMIT 5000`,
    values: {
      signup: ev.signup,
      activation: ev.activation || "__nokko_none__",
      paid: ev.paid || "__nokko_none__",
    },
  };
}

/** Active people per company domain (email domain, or a person property holding the domain). */
export function usageQuery(domainProperty?: string | null): HogQL {
  const expr =
    domainProperty && domainPropertyOk(domainProperty)
      ? `lower(toString(person.properties.${domainProperty.trim()}))`
      : "lower(splitByChar('@', toString(person.properties.email))[2])";
  return {
    query: `SELECT ${expr} AS domain,
  uniqIf(person_id, timestamp > now() - INTERVAL 7 DAY) AS wau,
  uniqIf(person_id, timestamp <= now() - INTERVAL 7 DAY AND timestamp > now() - INTERVAL 14 DAY) AS prev,
  uniq(person_id) AS mau, count() AS events, max(timestamp) AS last_seen
FROM events
WHERE timestamp > now() - INTERVAL 30 DAY
GROUP BY domain
HAVING domain != ''
ORDER BY wau DESC, events DESC
LIMIT 3000`,
    values: {},
  };
}

export const EVENTS_QUERY: HogQL = {
  query:
    "SELECT event, count() AS n FROM events WHERE timestamp > now() - INTERVAL 30 DAY GROUP BY event ORDER BY n DESC LIMIT 100",
  values: {},
};

type Result = { columns?: string[]; results?: unknown[][] };
const rowsOf = (r: Result) =>
  (r.results ?? []).map(
    (row) =>
      Object.fromEntries((r.columns ?? []).map((c, i) => [c, row[i]])) as Record<string, unknown>,
  );

/** ClickHouse returns 1970 for «never happened»: those are null. */
export function when(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v);
  const d = new Date(
    /[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s.replace(" ", "T") : `${s.replace(" ", "T")}Z`,
  );
  return Number.isNaN(d.getTime()) || d.getUTCFullYear() < 2001 ? null : d.toISOString();
}

export type TrialRow = {
  posthog_person_id: string;
  email: string;
  company: string;
  signed_up_at: string;
  activated_at: string | null;
  converted_at: string | null;
};

export function funnelRows(r: Result): TrialRow[] {
  return rowsOf(r).flatMap((x) => {
    const signed = when(x.signed_up);
    const pid = String(x.pid ?? "").trim();
    if (!signed || !pid) return [];
    const email = String(x.email ?? "")
      .trim()
      .toLowerCase();
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
    return [
      {
        posthog_person_id: pid,
        email: validEmail,
        company: companyDomain(validEmail) ?? "",
        signed_up_at: signed,
        activated_at: when(x.activated),
        converted_at: when(x.paid),
      },
    ];
  });
}

export type UsageRow = {
  domain: string;
  active_users_7d: number;
  active_users_prev_7d: number;
  active_users_30d: number;
  events_30d: number;
  last_seen_at: string | null;
};

export function usageRows(r: Result): UsageRow[] {
  const byDomain = new Map<string, UsageRow>();
  for (const x of rowsOf(r)) {
    const domain = companyDomain(String(x.domain ?? ""));
    if (!domain) continue;
    const row: UsageRow = {
      domain,
      active_users_7d: Number(x.wau) || 0,
      active_users_prev_7d: Number(x.prev) || 0,
      active_users_30d: Number(x.mau) || 0,
      events_30d: Number(x.events) || 0,
      last_seen_at: when(x.last_seen),
    };
    const prev = byDomain.get(domain); // www.acme.com and acme.com are one company
    byDomain.set(
      domain,
      prev
        ? {
            domain,
            active_users_7d: prev.active_users_7d + row.active_users_7d,
            active_users_prev_7d: prev.active_users_prev_7d + row.active_users_prev_7d,
            active_users_30d: prev.active_users_30d + row.active_users_30d,
            events_30d: prev.events_30d + row.events_30d,
            last_seen_at:
              [prev.last_seen_at, row.last_seen_at].filter(Boolean).sort().pop() ?? null,
          }
        : row,
    );
  }
  return [...byDomain.values()];
}

export const eventNames = (r: Result) =>
  rowsOf(r)
    .map((x) => String(x.event ?? ""))
    .filter(Boolean);

/** Account id for each usage domain (same company domain). */
export function matchAccounts(
  usage: UsageRow[],
  accounts: { id: string; domain: string | null }[],
): (UsageRow & { account_id: string | null })[] {
  const byDomain = new Map<string, string>();
  for (const a of accounts) {
    const d = companyDomain(a.domain);
    if (d && !byDomain.has(d)) byDomain.set(d, a.id);
  }
  return usage.map((u) => ({ ...u, account_id: byDomain.get(u.domain) ?? null }));
}

export type Trend = "up" | "down" | "flat" | "new" | "inactive";
export function usageTrend(wau: number, prev: number): Trend {
  if (wau === 0 && prev === 0) return "inactive";
  if (prev === 0) return "new";
  if (wau >= prev * 1.25) return "up";
  if (wau <= prev * 0.75) return "down";
  return "flat";
}
export const TREND_LABEL: Record<Trend, string> = {
  up: "sube",
  down: "baja",
  flat: "estable",
  new: "nuevo esta semana",
  inactive: "sin uso",
};

/** Thresholds of the product-led suggestions. */
export const PQL_MIN_USERS = 3;
export const DROP_MIN_PREV_USERS = 3;

export type UsageSignal = {
  domain: string;
  account_id: string | null;
  active_users_7d: number;
  active_users_prev_7d: number;
};

/** An account that is not a customer yet with a growing team inside the product: sell now. */
export const isProductQualified = (u: UsageSignal, isCustomer: boolean) =>
  !isCustomer && u.active_users_7d >= PQL_MIN_USERS && u.active_users_7d >= u.active_users_prev_7d;
/** A customer whose weekly active users halved (or went to zero): churn risk. */
export const isUsageDrop = (u: UsageSignal, isCustomer: boolean) =>
  isCustomer &&
  u.active_users_prev_7d >= DROP_MIN_PREV_USERS &&
  u.active_users_7d <= u.active_users_prev_7d / 2;
