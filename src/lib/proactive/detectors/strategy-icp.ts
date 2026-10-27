// F1 · ICP rules (SDD-20261027 H-3): CA-12 won deals outside every ICP, CA-13 an ICP nothing fits for 90 days. Fixed rules, no AI (CA-24).
import { accountFit, type IcpProfile } from "@/lib/scoring";
import { buildStrategySuggestion } from "@/lib/strategy-suggestions";
import { DAY, type Detector } from "../types";

export const MIN_WON_UNCOVERED = 2;
export const ICP_IDLE_DAYS = 90;

const norm = (x: string | null | undefined) => (x ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const asIcp = (i: { id: string; industries: string | null; company_size: string | null; geography: string | null; anti_icp: string | null; segment_id: string | null }): IcpProfile => ({ id: i.id, segment_id: null, industries: i.industries, company_size: i.company_size, geography: i.geography, anti_icp: i.anti_icp });
const criterion = (a: Parameters<typeof accountFit>[0], icp: IcpProfile, id: "industry" | "size") => accountFit(a, [icp]).criteria.find((c) => c.id === id)?.status;

/** CA-12: at least 2 won deals whose accounts share a sector, size or country that no ICP includes → create or extend an ICP. */
export const icpUncoveredWins: Detector = (s) => {
  const d = s.strategy;
  if (!d) return [];
  const accounts = new Map(d.accounts.map((a) => [a.id, a]));
  const icps = d.icps.map(asIcp);
  const won = d.deals.filter((x) => x.stage === "won" && x.account_id && accounts.has(x.account_id));
  const out = [];
  for (const dim of ["industry", "size", "country"] as const) {
    const groups = new Map<string, { label: string; deals: typeof won }>();
    for (const w of won) {
      const a = accounts.get(w.account_id!)!;
      const v = a[dim];
      if (!norm(v)) continue;
      const g = groups.get(norm(v)) ?? { label: v!.trim(), deals: [] };
      g.deals.push(w);
      groups.set(norm(v), g);
    }
    for (const [key, g] of groups) {
      if (g.deals.length < MIN_WON_UNCOVERED) continue;
      const sample = accounts.get(g.deals[0].account_id!)!;
      const covered = d.icps.some((icp, i) => dim === "country"
        ? icp.countries.some((c) => norm(c) === key) || norm(icp.geography).includes(key)
        : criterion(sample, icps[i], dim) === "match");
      if (covered) continue;
      const dimLabel = { industry: "sector", size: "tamaño", country: "país" }[dim];
      const evidence = g.deals.flatMap((x) => [{ table: "deals", id: x.id, label: x.name }, { table: "accounts", id: x.account_id!, label: accounts.get(x.account_id!)!.name }]);
      out.push(buildStrategySuggestion({
        element: "icp", kind: "create", action_type: "strategy_change", cause: `uncovered_win:${dim}:${key}`, priority: 2,
        title: `${g.deals.length} deals ganados comparten ${dimLabel} «${g.label}» y ningún ICP lo incluye`,
        body: `Crea un ICP nuevo o amplía uno existente con ${dimLabel} «${g.label}». Los deals y cuentas de origen están en la evidencia.`,
        evidence, sample_size: Math.max(g.deals.length, evidence.length), link: "/strategy?tab=icp",
      }));
    }
  }
  return out;
};

/** CA-13: an ICP older than 90 days with no account (and so no lead or deal of one) that fits it → review or archive. */
export const icpIdle: Detector = (s) => {
  const d = s.strategy;
  if (!d) return [];
  return d.icps.flatMap((icp) => {
    if (s.now.getTime() - new Date(icp.created_at).getTime() <= ICP_IDLE_DAYS * DAY) return [];
    if (!(icp.industries ?? "").trim() && !(icp.company_size ?? "").trim()) return []; // nothing to compare: setup_incomplete covers it
    const p = asIcp(icp);
    const fits = d.accounts.some((a) => (criterion(a, p, "industry") === "match" || criterion(a, p, "size") === "match") && accountFit(a, [p]).criteria.find((c) => c.id === "anti_icp")?.status !== "miss");
    if (fits) return [];
    return [buildStrategySuggestion({
      element: "icp", kind: "close", action_type: "strategy_change", cause: `idle:${icp.id}`, priority: 3,
      title: `El ICP «${icp.name}» lleva más de ${ICP_IDLE_DAYS} días sin ninguna cuenta que encaje`,
      body: `Ninguna cuenta (y por tanto ningún lead ni deal enlazado a una cuenta) encaja con este ICP. Revísalo o archívalo.`,
      evidence: [{ table: "icp_profiles", id: icp.id, label: icp.name }], sample_size: Math.max(1, d.accounts.length), link: "/strategy?tab=icp",
    })];
  });
};
