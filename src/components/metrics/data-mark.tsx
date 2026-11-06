// Minimal data mark of /metrics (SDD-20261106-metrics-honest-data CA-10): «Real», «Real · origen»,
// «Estimado · motivo» or «Sin dato · motivo», with the state in `data-mark`. SDD-C2 gives it its visual form
// (DataState) without changing the words or dropping the attribute.

export type DataMarkState = "real" | "estimado" | "sin_dato";
export type DataMarkProps =
  { state: "real"; reason?: string | null } | { state: "estimado" | "sin_dato"; reason: string };

const WORD: Record<DataMarkState, string> = {
  real: "Real",
  estimado: "Estimado",
  sin_dato: "Sin dato",
};

export function DataMark(p: DataMarkProps & { className?: string }) {
  return (
    <span data-mark={p.state} className={p.className}>
      {p.reason ? `${WORD[p.state]} · ${p.reason}` : WORD[p.state]}
    </span>
  );
}
