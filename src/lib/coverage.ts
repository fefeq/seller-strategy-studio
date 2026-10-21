// Quarter pipeline coverage, computed in one place. Métricas, the low_coverage suggestion and the
// GTM Advisor used to compute it on their own and showed three different numbers for the same
// quarter. Coverage counts open deals whose close date falls in the quarter; open deals with no
// close date are reported apart, because they are pipeline that no quarter can count yet.

import { coverage, quarterRange } from "@/lib/metrics";

export type CoverageDeal = {
  stage: string;
  amount: number | string | null;
  close_date: string | null;
};

export type QuarterCoverage = {
  quota: number;
  /** Open pipeline with a close date inside the quarter. */
  pipeline: number;
  ratio: number;
  status: "low" | "healthy" | "high";
  /** Open deals with no close date: not counted in any quarter. */
  undated: { count: number; amount: number };
  /** Every open deal, dated or not. */
  totalOpen: number;
  /** Pipeline still missing to reach 3x; 0 when covered. */
  gapTo3x: number;
};

const isOpen = (stage: string) => stage !== "won" && stage !== "lost";
const amountOf = (d: CoverageDeal) => Number(d.amount ?? 0) || 0;

export function quarterCoverage(
  deals: CoverageDeal[],
  quota: number,
  quarter: string,
): QuarterCoverage {
  const { start, end } = quarterRange(quarter);
  const open = deals.filter((d) => isOpen(d.stage));
  const inQ = open.filter(
    (d) => !!d.close_date && new Date(d.close_date) >= start && new Date(d.close_date) < end,
  );
  const undated = open.filter((d) => !d.close_date);
  const pipeline = inQ.reduce((s, d) => s + amountOf(d), 0);
  const { ratio, status } = coverage(pipeline, quota);
  return {
    quota,
    pipeline,
    ratio,
    status,
    undated: { count: undated.length, amount: undated.reduce((s, d) => s + amountOf(d), 0) },
    totalOpen: open.reduce((s, d) => s + amountOf(d), 0),
    gapTo3x: Math.max(0, quota * 3 - pipeline),
  };
}

/** «0,05x» below 1 (one decimal would show 0,0x for a real 0,049x), «2,4x» above. */
export function formatRatio(ratio: number): string {
  const digits = ratio > 0 && ratio < 1 ? 2 : 1;
  return `${ratio.toLocaleString("es-ES", { minimumFractionDigits: digits, maximumFractionDigits: digits })}x`;
}
