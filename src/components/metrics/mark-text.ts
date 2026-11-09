// Words of the data marks (SDD-20261106-metrics-honest-data §6; SDD-20261109-metrics-strategy-no-estimates §9).
// Since SDD-20261109 the reasons come from the Figures of src/lib/unit-economics.ts: figureMark only adapts a
// Figure to DataMark, it never composes a reason of its own. /strategy and Inicio use it too.
import type { DataMarkProps } from "@/components/metrics/data-mark";

/** A Figure (or any {state, reason}) as the props of its mark. A planned figure has no mark. */
export function figureMark(f: { state: string; reason: string | null }): DataMarkProps | null {
  if (f.state === "real") return { state: "real", reason: f.reason };
  if (f.state === "estimado") return { state: "estimado", reason: f.reason ?? "" };
  if (f.state === "sin_dato") return { state: "sin_dato", reason: f.reason ?? "falta un dato" };
  return null;
}

/** The mark only when the figure is not plainly real: «Estimado · …» or «Sin dato · …». */
export function caveatMark(f: { state: string; reason: string | null }): DataMarkProps | null {
  return f.state === "estimado" || f.state === "sin_dato" ? figureMark(f) : null;
}

/** CA-8 (SDD-20261109 D7): the shared cost is not split when nobody was won. */
export const SHARED_NOT_SPLIT: DataMarkProps = {
  state: "sin_dato",
  reason: "nadie ganó: el compartido no se reparte",
};

/** CA-5: N of M deals assigned to the segment by their amount. */
export const inferredMark = (n: number, m: number, deals = false): DataMarkProps => ({
  state: "estimado",
  reason: `${n} de ${m}${deals ? " deals" : ""} asignados por importe`,
});

/** A win rate with no closed deal in its window. */
export const noClosedDeals = (window: string) => ({
  value: null,
  state: "sin_dato" as const,
  reason: `ningún deal cerrado en ${window}`,
});

/** Green or red only for a real or estimated figure with a target; neutral otherwise. */
export function figureTone(f: { value: number | null; state: string }, ok: boolean | null) {
  if (f.value == null || (f.state !== "real" && f.state !== "estimado")) return "";
  return ok === false ? "text-signal" : ok ? "text-success" : "";
}
