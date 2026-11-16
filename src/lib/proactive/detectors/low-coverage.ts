import { formatRatio, quarterCoverage } from "@/lib/coverage";
import { formatMoney } from "@/lib/money";
import type { Detector } from "../types";

/** Quarter pipeline coverage below 3x quota. Same calculation as Métricas and the Advisor (src/lib/coverage.ts). */
export const lowCoverage: Detector = (s) => {
  const quota = s.setup.quotas
    .filter((q) => q.period === s.setup.quarter)
    .reduce((a, q) => a + Number(q.amount), 0);
  if (!quota) return [];
  const cov = quarterCoverage(s.deals, quota, s.setup.quarter);
  if (cov.status !== "low") return [];
  const money = (n: number) => formatMoney(Math.round(n), s.setup.currency ?? "EUR");
  const undated = cov.undated.count
    ? ` ${cov.undated.count === 1 ? "Hay 1 deal abierto" : `Hay ${cov.undated.count} deals abiertos`} sin fecha de cierre (${money(cov.undated.amount)}) que no cuentan en ningún trimestre: ponles fecha.`
    : "";
  return [
    {
      detector: "low_coverage",
      dedupe_key: `low_coverage:${s.setup.quarter}`,
      priority: 1,
      title: `Cobertura de pipeline ${formatRatio(cov.ratio)} en ${s.setup.quarter} (objetivo 3–4x)`,
      body: `Faltan unos ${money(cov.gapTo3x)} de pipeline con cierre en el trimestre para llegar a 3x.${undated} Revisa fuentes de generación o pide al Asesor GTM un plan.`,
      link: "/metrics",
      action: null,
      user_id: null,
    },
  ];
};
