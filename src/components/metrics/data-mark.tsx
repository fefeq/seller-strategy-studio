// Data mark of /metrics (SDD-20261106-metrics-honest-data CA-10): «Real», «Real · origen», «Estimado · motivo» or
// «Sin dato · motivo», with the state in `data-mark`. SDD-20261106-ux-metrics-data-state U-2: keeps the signature of
// A and delegates its look to DataState (same words, same attribute).
import { DataState } from "@/components/data-state";

export type DataMarkState = "real" | "estimado" | "sin_dato";
export type DataMarkProps =
  { state: "real"; reason?: string | null } | { state: "estimado" | "sin_dato"; reason: string };

export function DataMark(p: DataMarkProps & { className?: string }) {
  return p.state === "real" ? (
    <DataState state="real" reason={p.reason ?? undefined} className={p.className} />
  ) : (
    <DataState state={p.state} reason={p.reason} className={p.className} />
  );
}
