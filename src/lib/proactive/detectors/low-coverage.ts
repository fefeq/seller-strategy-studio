import { coverage, quarterRange } from "@/lib/metrics";
import { OPEN, type Detector } from "../types";

/** Quarter pipeline coverage below 3x quota. */
export const lowCoverage: Detector = (s) => {
  const quota = s.setup.quotas.filter((q) => q.period === s.setup.quarter).reduce((a, q) => a + Number(q.amount), 0);
  if (!quota) return [];
  const { start, end } = quarterRange(s.setup.quarter);
  const pipe = s.deals
    .filter((d) => OPEN(d.stage) && d.close_date && new Date(d.close_date) >= start && new Date(d.close_date) < end)
    .reduce((a, d) => a + Number(d.amount ?? 0), 0);
  const cov = coverage(pipe, quota);
  if (cov.status !== "low") return [];
  return [{
    detector: "low_coverage",
    dedupe_key: `low_coverage:${s.setup.quarter}`,
    priority: 1,
    title: `Cobertura de pipeline ${cov.ratio.toFixed(1)}x en ${s.setup.quarter} (objetivo 3–4x)`,
    body: `Faltan unos ${Math.round(quota * 3 - pipe).toLocaleString("es-ES")} de pipeline para llegar a 3x. Revisa fuentes de generación o pide al Asesor GTM un plan.`,
    link: "/metrics",
    action: null,
    user_id: null,
  }];
};
