import type { ReactNode } from "react";

export function Card({ title, sub, actions, children }: { title: string; sub?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-xl border bg-card p-5 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0"><h3 className="text-xl">{title}</h3>{sub && <p className="mt-1 text-sm text-ink-mid">{sub}</p>}</div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "good" | "bad" }) {
  return (
    <div className="min-w-0 rounded-xl border bg-card p-5 shadow-xs">
      <p className="eyebrow">{label}</p>
      <p className={`mt-2 break-words font-display text-3xl ${tone === "bad" ? "text-signal" : ""}`}>{value}</p>
      {hint && <p className={`mt-1 text-xs ${tone === "good" ? "text-success" : tone === "bad" ? "text-signal" : "text-muted-foreground"}`}>{hint}</p>}
    </div>
  );
}

export const Muted = ({ children }: { children: ReactNode }) => <p className="text-sm text-muted-foreground">{children}</p>;

/** Plain number input that hands back a number (empty = null). */
export function NumberInput({ value, onChange, className = "", ariaLabel, step }: { value: number | null | undefined; onChange: (n: number | null) => void; className?: string; ariaLabel: string; step?: string }) {
  return (
    <input aria-label={ariaLabel} type="number" inputMode="decimal" step={step ?? "any"} className={`h-10 w-full rounded-md border bg-background px-2 text-base tabular-nums md:h-9 md:text-sm ${className}`}
      value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />
  );
}
