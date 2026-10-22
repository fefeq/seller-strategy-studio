// Account assignment: who takes each account without an owner. Pure and deterministic (same input, same
// proposal, no AI cost): the company's rules pick the people (segment and/or country or region), and
// within a rule the account goes to whoever carries the least load (accounts weighted by tier),
// respecting each person's optional maximum. The screen, the detector and the tests share it.

export const REGIONS = {
  es: "España",
  latam: "LatAm",
  us: "EE. UU.",
  europe: "Resto de Europa",
  other: "Resto del mundo",
} as const;
export type Region = keyof typeof REGIONS;

const LATAM = ["AR", "BO", "BR", "CL", "CO", "CR", "CU", "DO", "EC", "GT", "HN", "MX", "NI", "PA", "PE", "PR", "PY", "SV", "UY", "VE"];
const EUROPE = ["AD", "AL", "AT", "BA", "BE", "BG", "BY", "CH", "CY", "CZ", "DE", "DK", "EE", "FI", "FR", "GB", "GR", "HR", "HU", "IE", "IS", "IT", "LI", "LT", "LU", "LV", "MC", "MD", "ME", "MK", "MT", "NL", "NO", "PL", "PT", "RO", "RS", "SE", "SI", "SK", "SM", "UA", "VA", "XK"];
const OTHER = ["AE", "AU", "CA", "CN", "IL", "IN", "JP", "KR", "MA", "NZ", "SA", "SG", "TR", "ZA"];

/** Countries offered in the account form: the four markets first, then the rest. ISO 3166-1 alpha-2. */
export const COUNTRY_CODES = ["ES", "US", ...LATAM, ...EUROPE, ...OTHER];

/** Spanish name of a country code (Intl knows them all; falls back to the code). */
export function countryName(code: string | null | undefined): string {
  if (!code) return "";
  try {
    return new Intl.DisplayNames(["es"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Region a country belongs to; null when the account has no country. */
export function regionOf(country: string | null | undefined): Region | null {
  const c = (country ?? "").trim().toUpperCase();
  if (!c) return null;
  if (c === "ES") return "es";
  if (c === "US") return "us";
  if (LATAM.includes(c)) return "latam";
  if (EUROPE.includes(c)) return "europe";
  return "other";
}

/** Roles that can own accounts (the Owner and Sales Leader too: small teams sell). */
export const ELIGIBLE_ROLES = ["ae", "sdr", "cs", "sales_leader", "owner"] as const;
export const isEligible = (role: string) => (ELIGIBLE_ROLES as readonly string[]).includes(role);
export const canApproveAssignment = (roles: string[]) => roles.some((r) => r === "owner" || r === "sales_leader");

/** An A account weighs three times a C one; no tier counts as B. */
export const TIER_WEIGHT: Record<string, number> = { A: 3, B: 2, C: 1 };
export const tierWeight = (tier: string | null | undefined) => TIER_WEIGHT[(tier ?? "").toUpperCase()] ?? 2;

export type AssignAccount = { id: string; name: string; tier: string | null; segment_id: string | null; country: string | null; owner_id: string | null };
export type AssignMember = { user_id: string; name: string; role: string; max_accounts: number | null };
export type AssignRule = { id: string; position: number; segment_id: string | null; region: Region | null; country: string | null; members: string[] };

/** «Mid-market · LatAm», «Cualquier cuenta»… */
export function ruleLabel(r: Pick<AssignRule, "segment_id" | "region" | "country">, segNames: Map<string, string>): string {
  const parts = [
    r.segment_id ? segNames.get(r.segment_id) ?? "Segmento" : null,
    r.country ? countryName(r.country) : r.region ? REGIONS[r.region] : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Cualquier cuenta";
}

/** A rule fits an account when every criterion it sets matches (an empty rule fits everything). */
export function ruleMatches(r: Pick<AssignRule, "segment_id" | "region" | "country">, a: Pick<AssignAccount, "segment_id" | "country">): boolean {
  if (r.segment_id && r.segment_id !== a.segment_id) return false;
  if (r.country && r.country.toUpperCase() !== (a.country ?? "").toUpperCase()) return false;
  if (!r.country && r.region && regionOf(a.country) !== r.region) return false;
  return true;
}

export type Load = { accounts: number; weight: number };
/** candidates: people under their maximum the account could have gone to. */
export type ProposalRow = { account_id: string; account: string; tier: string | null; user_id: string; rule: string; reason: string; candidates: number; before: Load; after: Load };
export type Unassigned = { account_id: string; account: string; reason: string };

/**
 * The proposal. Only accounts without owner are assigned; owned accounts count towards each person's
 * load. Accounts go heaviest first (A before C, then by name) so the big ones spread out. The first
 * rule that fits (by position) picks the candidates; with no rules at all, every eligible person is a
 * candidate. Among candidates under their maximum, the lowest load wins (ties: fewer accounts, then
 * name).
 */
export function proposeAssignment(input: { accounts: AssignAccount[]; members: AssignMember[]; rules: AssignRule[]; segNames?: Map<string, string> }) {
  const segNames = input.segNames ?? new Map<string, string>();
  const eligible = input.members.filter((m) => isEligible(m.role));
  const byId = new Map(eligible.map((m) => [m.user_id, m]));
  const load = new Map<string, Load>(eligible.map((m) => [m.user_id, { accounts: 0, weight: 0 }]));
  for (const a of input.accounts) {
    const l = a.owner_id ? load.get(a.owner_id) : undefined;
    if (l) { l.accounts++; l.weight += tierWeight(a.tier); }
  }
  const rules = [...input.rules].sort((x, y) => x.position - y.position);
  const pending = input.accounts
    .filter((a) => !a.owner_id)
    .sort((x, y) => tierWeight(y.tier) - tierWeight(x.tier) || x.name.localeCompare(y.name, "es") || x.id.localeCompare(y.id));
  const rows: ProposalRow[] = [];
  const unassigned: Unassigned[] = [];
  for (const a of pending) {
    const rule = rules.find((r) => ruleMatches(r, a));
    if (rules.length && !rule) {
      unassigned.push({ account_id: a.id, account: a.name, reason: "Ninguna regla encaja (segmento o país)." });
      continue;
    }
    const pool = (rule ? rule.members : eligible.map((m) => m.user_id)).filter((id) => byId.has(id));
    if (!pool.length) {
      unassigned.push({ account_id: a.id, account: a.name, reason: rule ? `La regla «${ruleLabel(rule, segNames)}» no tiene personas que puedan llevar cuentas.` : "No hay nadie en el equipo que pueda llevar cuentas." });
      continue;
    }
    const open = pool.filter((id) => { const max = byId.get(id)!.max_accounts; return max == null || load.get(id)!.accounts < max; });
    if (!open.length) {
      unassigned.push({ account_id: a.id, account: a.name, reason: `Todas las personas de «${rule ? ruleLabel(rule, segNames) : "el equipo"}» han llegado a su máximo de cuentas.` });
      continue;
    }
    const pick = [...open].sort((x, y) => {
      const lx = load.get(x)!, ly = load.get(y)!;
      return lx.weight - ly.weight || lx.accounts - ly.accounts || byId.get(x)!.name.localeCompare(byId.get(y)!.name, "es") || x.localeCompare(y);
    })[0];
    const before = { ...load.get(pick)! };
    const after = { accounts: before.accounts + 1, weight: before.weight + tierWeight(a.tier) };
    load.set(pick, after);
    const label = rule ? ruleLabel(rule, segNames) : "Sin reglas";
    // Say a tie when there is one: the name only breaks it, it is not «the least load».
    const tied = open.filter((id) => id !== pick && load.get(id)!.weight === before.weight && load.get(id)!.accounts === before.accounts).length;
    const why = open.length === 1 ? "única persona disponible" : tied ? `empata en carga con ${tied === 1 ? "otra persona" : `${tied} personas`} y se desempata por nombre` : `es quien menos carga lleva de ${open.length}`;
    const reason = `${rule ? `Regla «${label}»` : "Sin reglas: todo el equipo"}; ${why} (${before.accounts} cuenta${before.accounts === 1 ? "" : "s"}, carga ${before.weight}).`;
    rows.push({ account_id: a.id, account: a.name, tier: a.tier, user_id: pick, rule: label, reason, candidates: open.length, before, after });
  }
  return { rows, unassigned, load };
}

/**
 * Re-checks an edited proposal before approving: each row needs an eligible person and the maximums
 * must hold once every row is applied. Returns the messages to show; empty means it can be approved.
 */
export function validateAssignment(rows: { account_id: string; account: string; user_id: string }[], members: AssignMember[], accounts: Pick<AssignAccount, "owner_id">[]): string[] {
  const byId = new Map(members.filter((m) => isEligible(m.role)).map((m) => [m.user_id, m]));
  const count = new Map<string, number>();
  for (const a of accounts) if (a.owner_id) count.set(a.owner_id, (count.get(a.owner_id) ?? 0) + 1);
  const errors: string[] = [];
  for (const r of rows) {
    if (!byId.has(r.user_id)) { errors.push(`«${r.account}»: elige una persona que pueda llevar cuentas.`); continue; }
    count.set(r.user_id, (count.get(r.user_id) ?? 0) + 1);
  }
  for (const [id, n] of count) {
    const m = byId.get(id);
    if (m?.max_accounts != null && n > m.max_accounts && rows.some((r) => r.user_id === id)) errors.push(`${m.name} pasaría a ${n} cuentas y su máximo es ${m.max_accounts}.`);
  }
  return errors;
}
