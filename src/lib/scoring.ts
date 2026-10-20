// Lead and account scoring: ICP fit (the bigger part) plus recent activity. Pure so the Leads
// and Cuentas screens, the agent and the proactive engine rank the same way. Every criterion
// says whether it matched, missed or is unknown, so the UI can show why and never invents a
// number: with nothing known about the fit, the fit is null, not 0.

export const FIT_WEIGHT = 0.7;
export const ACTIVITY_WEIGHT = 0.3;

export type IcpProfile = {
  id?: string;
  segment_id: string | null;
  industries: string | null;
  company_size: string | null;
  geography?: string | null;
  anti_icp: string | null;
};

export type AccountFitInput = {
  segment_id: string | null;
  industry: string | null;
  size: string | null;
  tier?: string | null;
  name?: string | null;
};

export type CriterionStatus = "match" | "miss" | "unknown";
export type Criterion = { id: "segment" | "industry" | "size" | "anti_icp" | "tier"; label: string; status: CriterionStatus; weight: number; note: string };

export type Fit = {
  /** 0–100 over the criteria we could check; null when none could be checked. */
  score: number | null;
  known: number;
  total: number;
  criteria: Criterion[];
  /** Which ICP the account was compared against (by index in the input list). */
  icpIndex: number | null;
};

const DAY = 86_400_000;
const STOP = new Set(["con", "sin", "para", "por", "que", "los", "las", "del", "the", "and", "una", "uno", "unos", "unas", "más", "mas", "menos", "entre", "hasta", "desde", "empleados", "empleado", "personas", "trabajadores", "empresas", "empresa", "sector", "sectores", "companies", "company"]);

/** Lowercase, accent-free words of 3+ letters, minus connectors, so "Fintech, logística" matches "fintech". */
export function tokens(text: string | null | undefined): Set<string> {
  if (!text) return new Set();
  const norm = text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  // Singular form so "consultoras" matches "consultora" and "agencias" matches "agencia".
  const stem = (w: string) => (w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w);
  return new Set(norm.split(/[^a-z0-9+]+/).filter((w) => w.length >= 3 && !STOP.has(w)).map(stem));
}

const overlap = (a: Set<string>, b: Set<string>) => [...a].filter((t) => b.has(t));

/** Numbers in a text, with k/mil suffixes ("50-500", "1k+", "más de 200 empleados"). */
export function numbersIn(text: string | null | undefined): number[] {
  if (!text) return [];
  const out: number[] = [];
  for (const m of text.toLowerCase().matchAll(/(\d+(?:[.,]\d+)?)\s*(k|mil)?/g)) {
    const n = Number(m[1].replace(",", "."));
    if (Number.isFinite(n)) out.push(m[2] ? n * 1000 : n);
  }
  return out;
}

function sizeCriterion(icpSize: string | null, accountSize: string | null): Pick<Criterion, "status" | "note"> {
  if (!icpSize || !accountSize) return { status: "unknown", note: !icpSize ? "El ICP no fija tamaño" : "La cuenta no tiene tamaño" };
  const want = numbersIn(icpSize);
  const have = numbersIn(accountSize);
  if (want.length && have.length) {
    const n = have[0];
    const lo = Math.min(...want);
    const hi = want.length > 1 ? Math.max(...want) : /\+|m[aá]s de|desde|>/.test(icpSize.toLowerCase()) ? Infinity : /menos de|hasta|</.test(icpSize.toLowerCase()) ? -Infinity : lo;
    const ok = hi === -Infinity ? n <= lo : hi === lo ? Math.abs(n - lo) <= lo * 0.5 : n >= lo && n <= hi;
    return { status: ok ? "match" : "miss", note: `${accountSize} frente a ${icpSize}` };
  }
  const common = overlap(tokens(icpSize), tokens(accountSize));
  if (common.length) return { status: "match", note: `Coincide en ${common.join(", ")}` };
  return { status: "miss", note: `${accountSize} frente a ${icpSize}` };
}

function fitAgainst(a: AccountFitInput, icp: IcpProfile, segmentNames?: Map<string, string>): Fit {
  const criteria: Criterion[] = [];
  const segName = (id: string | null) => (id && segmentNames?.get(id)) || null;

  if (!icp.segment_id || !a.segment_id) criteria.push({ id: "segment", label: "Segmento", status: "unknown", weight: 2, note: !a.segment_id ? "La cuenta no tiene segmento" : "El ICP no tiene segmento" });
  else criteria.push({ id: "segment", label: "Segmento", status: a.segment_id === icp.segment_id ? "match" : "miss", weight: 2, note: a.segment_id === icp.segment_id ? `Está en ${segName(a.segment_id) ?? "el segmento del ICP"}` : `Está en ${segName(a.segment_id) ?? "otro segmento"}, el ICP es ${segName(icp.segment_id) ?? "otro"}` });

  if (!icp.industries || !a.industry) criteria.push({ id: "industry", label: "Sector", status: "unknown", weight: 2, note: !a.industry ? "La cuenta no tiene sector" : "El ICP no fija sector" });
  else {
    const common = overlap(tokens(a.industry), tokens(icp.industries));
    criteria.push({ id: "industry", label: "Sector", status: common.length ? "match" : "miss", weight: 2, note: common.length ? `Coincide en ${common.join(", ")}` : `${a.industry} no está entre los sectores del ICP` });
  }

  criteria.push({ id: "size", label: "Tamaño", weight: 1, ...sizeCriterion(icp.company_size, a.size) });

  if (!icp.anti_icp) criteria.push({ id: "anti_icp", label: "Anti-ICP", status: "unknown", weight: 2, note: "El ICP no define anti-ICP" });
  else {
    const mine = new Set([...tokens(a.industry), ...tokens(a.size), ...tokens(a.name)]);
    const hit = overlap(tokens(icp.anti_icp), mine);
    criteria.push({ id: "anti_icp", label: "Anti-ICP", status: hit.length ? "miss" : "match", weight: 2, note: hit.length ? `Coincide con el anti-ICP en ${hit.join(", ")}` : "No coincide con el anti-ICP" });
  }

  const tier = (a.tier ?? "").toUpperCase();
  criteria.push({ id: "tier", label: "Tier", weight: 1, status: tier === "A" ? "match" : tier === "C" ? "miss" : "unknown", note: tier === "A" ? "Tier A" : tier === "C" ? "Tier C" : tier === "B" ? "Tier B no decide" : "Sin tier" });

  const known = criteria.filter((c) => c.status !== "unknown");
  const total = known.reduce((s, c) => s + c.weight, 0);
  const got = known.filter((c) => c.status === "match").reduce((s, c) => s + c.weight, 0);
  return { score: total ? Math.round((got / total) * 100) : null, known: known.length, total: criteria.length, criteria, icpIndex: null };
}

/** Fit against the ICP of the account's segment when there is one, else the best fit among all ICPs. */
export function accountFit(a: AccountFitInput, icps: IcpProfile[], segmentNames?: Map<string, string>): Fit {
  if (!icps.length) return { score: null, known: 0, total: 0, criteria: [], icpIndex: null };
  const own = a.segment_id ? icps.findIndex((i) => i.segment_id === a.segment_id) : -1;
  if (own >= 0) return { ...fitAgainst(a, icps[own], segmentNames), icpIndex: own };
  let best: Fit | null = null;
  icps.forEach((icp, i) => {
    const f = { ...fitAgainst(a, icp, segmentNames), icpIndex: i };
    if (!best || (f.score ?? -1) > (best.score ?? -1) || ((f.score ?? -1) === (best.score ?? -1) && f.known > best.known)) best = f;
  });
  return best!;
}

// ---------- Activity ----------

/** 100 for something this week, down to 0 with nothing ever. */
export function recencyScore(lastAt: string | null | undefined, now = new Date()): number {
  if (!lastAt) return 0;
  const days = (now.getTime() - new Date(lastAt).getTime()) / DAY;
  if (days <= 7) return 100;
  if (days <= 14) return 75;
  if (days <= 30) return 50;
  if (days <= 60) return 25;
  return 10;
}

export const latestOf = (...dates: (string | null | undefined)[]): string | null =>
  dates.reduce<string | null>((best, d) => (d && (!best || d > best) ? d : best), null);

export type AccountActivityInput = {
  /** Last touch, meeting, call or deal update, whichever is latest. */
  lastActivityAt: string | null;
  openDeals: number;
};

/** Recency wins; an open deal keeps the account at least warm. */
export function accountActivity(a: AccountActivityInput, now = new Date()): number {
  return Math.max(recencyScore(a.lastActivityAt, now), a.openDeals > 0 ? 40 : 0);
}

const STAGE_PROGRESS: Record<string, number> = { new: 20, contacted: 40, mql: 60, sql: 80, opportunity: 100, disqualified: 0 };

export type LeadActivityInput = {
  stage: string;
  stage_entered_at: string;
  updated_at?: string | null;
  next_step_at: string | null;
  late: boolean;
};

/** Stage progress plus recency, minus delay, plus a scheduled follow-up. */
export function leadActivity(l: LeadActivityInput, now = new Date()): number {
  if (l.stage === "disqualified") return 0;
  const progress = STAGE_PROGRESS[l.stage] ?? 20;
  const recency = recencyScore(latestOf(l.stage_entered_at, l.updated_at), now);
  let score = progress * 0.6 + recency * 0.4;
  if (l.late) score -= 25;
  if (l.next_step_at && l.next_step_at >= now.toISOString().slice(0, 10)) score += 10;
  return Math.max(0, Math.min(100, Math.round(score)));
}

// ---------- Combined ----------

export type Band = "alto" | "medio" | "bajo" | "sin_datos";
export type Score = { fit: Fit; activity: number; total: number | null; band: Band };

export function band(total: number | null): Band {
  if (total == null) return "sin_datos";
  return total >= 70 ? "alto" : total >= 40 ? "medio" : "bajo";
}
export const BAND_LABEL: Record<Band, string> = { alto: "Alto", medio: "Medio", bajo: "Bajo", sin_datos: "Sin datos de encaje" };

/** Fit weighs 70 %, activity 30 %. With no fit data the total is null: activity alone must not rank a company. */
export function combine(fit: Fit, activity: number): Score {
  const total = fit.score == null ? null : Math.round(fit.score * FIT_WEIGHT + activity * ACTIVITY_WEIGHT);
  return { fit, activity, total, band: band(total) };
}

export function scoreAccount(a: AccountFitInput & AccountActivityInput, icps: IcpProfile[], now = new Date(), segmentNames?: Map<string, string>): Score {
  return combine(accountFit(a, icps, segmentNames), accountActivity(a, now));
}

export type LeadScoreInput = LeadActivityInput & {
  segment_id: string | null;
  company: string;
  account_id: string | null;
};

/** A lead with an account inherits that account's fit; without one we only know its segment and name. */
export function scoreLead(l: LeadScoreInput, icps: IcpProfile[], accounts: Map<string, AccountFitInput>, now = new Date(), segmentNames?: Map<string, string>): Score {
  const acc = l.account_id ? accounts.get(l.account_id) : undefined;
  const fitInput: AccountFitInput = acc
    ? { ...acc, segment_id: acc.segment_id ?? l.segment_id }
    : { segment_id: l.segment_id, industry: null, size: null, tier: null, name: l.company };
  return combine(accountFit(fitInput, icps, segmentNames), leadActivity(l, now));
}

/** Highest first; unknown totals last, then by activity. */
export function byScore<T>(get: (x: T) => Score) {
  return (a: T, b: T) => {
    const sa = get(a), sb = get(b);
    if (sa.total == null && sb.total == null) return sb.activity - sa.activity;
    if (sa.total == null) return 1;
    if (sb.total == null) return -1;
    return sb.total - sa.total || sb.activity - sa.activity;
  };
}

export function fitText(f: Fit): string {
  if (f.score == null) return "Sin datos para medir el encaje";
  const matched = f.criteria.filter((c) => c.status === "match").map((c) => c.label);
  const missed = f.criteria.filter((c) => c.status === "miss").map((c) => c.label);
  const parts: string[] = [];
  if (matched.length) parts.push(`encaja en ${matched.join(", ").toLowerCase()}`);
  if (missed.length) parts.push(`no encaja en ${missed.join(", ").toLowerCase()}`);
  return `${parts.join("; ")} (${f.known} de ${f.total} criterios)`;
}
