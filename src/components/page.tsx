import type { ReactNode } from "react";
import { FlowStrip } from "@/components/flow-strip";

export function Page({ eyebrow, title, titleAside, actions, children }: { eyebrow?: string; title: string; titleAside?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-5 md:px-10 md:py-10">
      <FlowStrip />
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b-2 border-hairline-firm pb-6 md:mb-10">
        <div className="min-w-0">
          {eyebrow && <p className="kicker">{eyebrow}</p>}
          <h1 className="lede-m mt-3 measure-lede break-words [overflow-wrap:anywhere] md:lede-l">{titleAside ? <span className="inline-flex items-center gap-3">{titleAside}<span>{title}</span></span> : title}</h1>
        </div>
        <div className="flex flex-wrap gap-2">{actions}</div>
      </div>
      {children}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="border-t border-hairline py-8 text-sm text-ink-mid">{children}</div>;
}

// Mark: el estado es una palabra en versalitas con un filete de color debajo.
const TONE: Record<string, string> = {
  green: "border-state-ok text-ink",
  yellow: "border-state-watch text-ink",
  red: "border-state-alarm text-red",
};
export function HealthDot({ value }: { value?: string | null }) {
  const label = value === "red" ? "En riesgo" : value === "yellow" ? "Atención" : "Sano";
  return <span className={`smallcaps border-b-2 pb-0.5 ${TONE[value ?? "green"] ?? TONE.green}`}>{label}</span>;
}

const KPI_SIZE = {
  hero: { box: "rounded-lg border bg-card p-5", value: "mt-2 font-display text-4xl" },
  normal: { box: "min-w-0 rounded-lg border bg-card p-5", value: "mt-2 break-words font-display text-2xl md:text-3xl" },
  compact: { box: "min-w-0 rounded-lg border bg-card px-4 py-3", value: "mt-1 break-words font-display text-2xl" },
  inline: { box: "", value: "mt-1 font-mono text-lg" },
} as const;

/**
 * The one figure card (SDD-20261031-ux-legibility-contrast). `size` keeps the density each screen had:
 * `hero` (Inicio, Pipeline), `normal` (Métricas, finanzas, self-service), `compact` (Leads, presupuesto),
 * `inline` (no card, inside a panel). `tone="signal"` colors the figure, `hintTone` colors the hint.
 */
export function Kpi({ label, value, hint, size = "normal", tone, hintTone }: { label: string; value: ReactNode; hint?: ReactNode; size?: keyof typeof KPI_SIZE; tone?: "signal"; hintTone?: "signal" | "alarm" }) {
  const k = KPI_SIZE[size];
  const hintColor = hintTone === "signal" ? "text-signal" : hintTone === "alarm" ? "text-state-alarm" : "text-muted-foreground";
  return (
    <div className={k.box}>
      <p className="eyebrow">{label}</p>
      <p className={`${k.value} ${tone === "signal" ? "text-signal" : ""}`}>{value}</p>
      {hint != null && hint !== "" && <p className={`mt-1 text-xs ${hintColor}`}>{hint}</p>}
    </div>
  );
}

/** The one titled panel; `action` is the optional link or button at the end of the title row. */
export function Panel({ title, action, children }: { title: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="min-w-0 text-2xl">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}
