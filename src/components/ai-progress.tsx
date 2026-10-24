import { useEffect, useState } from "react";

/**
 * What a long AI call is doing while the person waits. The server does not stream its steps, so the
 * stages advance with time and say so («normalmente»); the elapsed seconds are real. It never claims
 * the work goes on if the person leaves: the result comes back to this screen.
 */
export function AiProgress({
  stages,
  typicalSeconds,
  className = "",
}: {
  stages: string[];
  typicalSeconds: number;
  className?: string;
}) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const t = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  const per = Math.max(1, typicalSeconds / Math.max(1, stages.length));
  const current = Math.min(stages.length - 1, Math.floor(seconds / per));
  const late = seconds > typicalSeconds * 1.5;
  return (
    <div
      className={`rounded-md border bg-muted/40 p-3 text-sm ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1">{stages[current]}…</span>
        <span className="shrink-0 font-mono text-xs text-muted-foreground">{seconds} s</span>
      </div>
      <ol className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
        {stages.map((s, i) => (
          <li
            key={s}
            className={
              i < current
                ? "text-muted-foreground line-through"
                : i === current
                  ? "font-medium"
                  : "text-muted-foreground"
            }
          >
            {i + 1}. {s}
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs text-muted-foreground">
        {late
          ? "Está tardando más de lo normal, pero sigue trabajando. Si pasan varios minutos, vuelve a intentarlo con menos texto."
          : `Normalmente tarda unos ${typicalSeconds < 60 ? `${typicalSeconds} segundos` : `${Math.round(typicalSeconds / 60)} min`}. Mantén esta pantalla abierta: el resultado aparece aquí.`}
      </p>
    </div>
  );
}
