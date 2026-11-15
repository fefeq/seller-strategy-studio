// D3: accessible 0–3 score as a radio group. 44 px targets, roving focus, arrow keys move and select.
import { useRef } from "react";

export function ScoreRadio({ label, value, onChange, max = 3 }: { label: string; value: number; onChange: (n: number) => void; max?: number }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const opts = Array.from({ length: max + 1 }, (_, i) => i);
  function key(e: React.KeyboardEvent, n: number) {
    const next = e.key === "ArrowRight" || e.key === "ArrowDown" ? n + 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? n - 1 : e.key === "Home" ? 0 : e.key === "End" ? max : null;
    if (next === null) return;
    e.preventDefault();
    const v = (next + max + 1) % (max + 1);
    onChange(v);
    refs.current[v]?.focus();
  }
  return (
    <div role="radiogroup" aria-label={`${label}: puntuación de 0 a ${max}`} className="flex shrink-0 gap-1">
      {opts.map((n) => {
        const on = value === n;
        return (
          <button
            key={n}
            ref={(el) => {
              refs.current[n] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={`${n} de ${max}`}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(n)}
            onKeyDown={(e) => key(e, n)}
            className={`size-11 rounded-md font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${on ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"}`}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}
