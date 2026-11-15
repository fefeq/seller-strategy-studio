// Won deals of a period exactly as the CAC counts them (date = closed_at, else last update; segment = explicit, else by amount).
// Pure so the "Deals ganados" panel, CAC and payback always agree on which deals count and where.
import { assignSegment, type DealLike, type SegLike } from "@/lib/segment-coverage";

export type WonDealLike = DealLike & { id: string; name: string; account_id?: string | null };
export type WonIssue = "sin_fecha" | "sin_importe" | "sin_segmento";

export const WON_ISSUE_LABEL: Record<WonIssue, string> = {
  sin_fecha: "Sin fecha de cierre: se usa la última modificación",
  sin_importe: "Sin valor: no cuenta para el ACV",
  sin_segmento: "Sin segmento: no reparte CAC",
};

/** Date stored for a day picked in the UI: midday UTC so the quarter never shifts with the time zone. */
export const closedAtFromDay = (day: string) => `${day}T12:00:00Z`;

/** Today as YYYY-MM-DD in the person's own time zone. */
export const localDay = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
/** A won deal cannot close on a day that has not arrived (Fede, 2026-11-08). */
export const isFutureDay = (day: string, now = new Date()) => day > localDay(now);
export const FUTURE_WON_DAY =
  "Un deal ganado no puede tener una fecha de cierre futura. Elige hoy o un día anterior.";

export function wonDealRows<T extends WonDealLike>(
  deals: T[],
  segments: SegLike[],
  range: { start: Date; end: Date },
) {
  return deals
    .filter((d) => d.stage === "won")
    .map((d) => {
      const at = d.closed_at ?? d.updated_at;
      const segmentId = assignSegment(d, segments);
      const manual = !!d.segment_id && segments.some((s) => s.id === d.segment_id);
      const issues: WonIssue[] = [];
      if (!d.closed_at) issues.push("sin_fecha");
      if (!(Number(d.amount) > 0)) issues.push("sin_importe");
      if (!segmentId) issues.push("sin_segmento");
      return {
        deal: d,
        closedOn: new Date(at).toISOString().slice(0, 10),
        at: new Date(at),
        dateSource: d.closed_at ? ("cierre" as const) : ("estimada" as const),
        segmentId,
        segmentSource: manual ? ("manual" as const) : segmentId ? ("importe" as const) : null,
        issues,
      };
    })
    .filter((r) => r.at >= range.start && r.at < range.end)
    .sort((a, b) => b.at.getTime() - a.at.getTime());
}

export type WonDealRow = ReturnType<typeof wonDealRows>[number];

/** Count and value per segment (the CAC denominator), plus deals that no segment receives. */
export function wonSummary(rows: WonDealRow[], segments: SegLike[]) {
  const bySegment = segments.map((s) => {
    const xs = rows.filter((r) => r.segmentId === s.id);
    return {
      segment: s,
      deals: xs.length,
      amount: xs.reduce((t, r) => t + Number(r.deal.amount ?? 0), 0),
    };
  });
  return {
    bySegment,
    unassigned: rows.filter((r) => !r.segmentId).length,
    total: { deals: rows.length, amount: rows.reduce((t, r) => t + Number(r.deal.amount ?? 0), 0) },
    withIssues: rows.filter((r) => r.issues.length).length,
  };
}
