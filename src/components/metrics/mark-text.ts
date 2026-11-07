// Words of the data marks of /metrics (SDD-20261106-metrics-honest-data §6, CA-5 to CA-9). Labels only: the
// numbers come unchanged from the shared functions; these say where each one comes from.
import type { DataMarkProps } from "@/components/metrics/data-mark";
import type { RangeBasis } from "@/lib/segment-coverage";
import type { BoardMarginSource } from "@/lib/pipeline-board";

/** CA-6 / CA-9: origin of an ACV. */
export function acvMark(
  source: "ganados" | "abiertos" | "rango" | null,
  rangeBasis?: RangeBasis,
): DataMarkProps | null {
  if (source === "ganados") return { state: "real", reason: "media de ganados" };
  if (source === "abiertos") return { state: "estimado", reason: "media de deals abiertos" };
  if (source !== "rango") return null;
  if (rangeBasis === "minimo_x1_5") return { state: "estimado", reason: "mínimo del rango × 1,5" };
  if (rangeBasis === "sin_rango") return { state: "sin_dato", reason: "falta rango de ACV" };
  return { state: "estimado", reason: "punto medio del rango" };
}

/** CA-7: payback computed with the 100 % margin assumed. */
export const MARGIN_ASSUMED: DataMarkProps = {
  state: "estimado",
  reason: "margen del 100 % supuesto (falta margen)",
};
/** CA-7: margin of 0 % or below; the payback (Infinity or negative) is never shown. */
export const MARGIN_NON_POSITIVE: DataMarkProps = {
  state: "sin_dato",
  reason: "margen 0 % o negativo",
};
/** CA-8: shared cost split equally because nobody was won. */
export const SHARED_EQUAL: DataMarkProps = {
  state: "estimado",
  reason: "repartido a partes iguales (nadie ganó)",
};

/** CA-5: N of M deals assigned to the segment by their amount. */
export const inferredMark = (n: number, m: number, deals = false): DataMarkProps => ({
  state: "estimado",
  reason: `${n} de ${m}${deals ? " deals" : ""} asignados por importe`,
});

/** CA-9: where the board's margin comes from. */
export function boardMarginMark(source: BoardMarginSource): DataMarkProps | null {
  if (source === "real") return { state: "real", reason: "de las cuentas" };
  if (source === "deals") return { state: "real", reason: "de deals con líneas" };
  if (source === "plan") return { state: "estimado", reason: "margen de plan" };
  if (source === "media_objetivos")
    return { state: "estimado", reason: "media de márgenes objetivo" };
  return null;
}
