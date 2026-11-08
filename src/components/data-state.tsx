// SDD-20261106-ux-metrics-data-state · U-2 · CA-4: the one visual form of a data mark of /metrics. The words come
// from SDD-A (this file never invents them): «Real», «Real · origen», «Estimado · motivo», «Sin dato · motivo», built
// as a single string so one text node holds the whole phrase. The state is said by the word; colour only
// accompanies it in the underline, so the text colour class is the same in the three states.
import { cn } from "@/lib/utils";

export type DataStateProps =
  { state: "real"; reason?: string } | { state: "estimado" | "sin_dato"; reason: string };

const WORD = { real: "Real", estimado: "Estimado", sin_dato: "Sin dato" } as const;
const RULE = {
  real: "border-state-ok",
  estimado: "border-state-watch",
  sin_dato: "border-hairline-firm",
} as const;

export function DataState(p: DataStateProps & { className?: string }) {
  return (
    <span
      data-mark={p.state}
      data-slot="data-state"
      className={cn("border-b-2 pb-0.5 text-xs text-ink-mid", RULE[p.state], p.className)}
    >
      {p.reason ? `${WORD[p.state]} · ${p.reason}` : WORD[p.state]}
    </span>
  );
}
