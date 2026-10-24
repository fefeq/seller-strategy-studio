// Variance waterfall of the Finance Dashboard (components/cfo/VarianceWaterfall.tsx), ported: planned margin →
// one bar per variance (mint favourable, ember unfavourable) → real margin, with connectors, staged reveal and
// selectable bars. Nokko's lines: revenue, cost to serve and acquisition of the quarter.
import { useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { scaleLinear } from "d3-scale";
import type { Variance } from "@/lib/finance";
import { useMeasure, useStage } from "./motion";

export type WaterfallStep = { key: string; label: string; short: string; impact: number; start: number; end: number; kind: "anchor" | "delta" };

/** Steps from plan vs real: impact on the margin is +revenue variance and −cost variance. */
export function buildSteps(rows: Variance[]): WaterfallStep[] {
  const margin = rows.find((r) => r.key === "margin");
  if (!margin) return [];
  const steps: WaterfallStep[] = [{ key: "plan", label: "Margen previsto", short: "Plan", impact: margin.plan, start: 0, end: margin.plan, kind: "anchor" }];
  let cursor = margin.plan;
  const SHORT: Record<string, string> = { revenue: "Ingresos", cost_to_serve: "Servir", acquisition: "Captación" };
  for (const r of rows.filter((x) => x.key !== "margin")) {
    const impact = r.key === "revenue" ? r.diff : -r.diff;
    steps.push({ key: r.key, label: r.label, short: SHORT[r.key] ?? r.label, impact, start: cursor, end: cursor + impact, kind: "delta" });
    cursor += impact;
  }
  steps.push({ key: "real", label: "Margen real", short: "Real", impact: margin.actual, start: 0, end: margin.actual, kind: "anchor" });
  return steps;
}

export function VarianceWaterfall({ steps, money, selected, onSelect }: { steps: WaterfallStep[]; money: (n: number, compact?: boolean) => string; selected: string | null; onSelect: (k: string | null) => void }) {
  const { ref, width } = useMeasure<HTMLDivElement>();
  const height = 236;
  const m = { top: 22, right: 60, bottom: 38, left: 8 };
  const innerW = Math.max(120, width - m.left - m.right);
  const innerH = height - m.top - m.bottom;
  const y = useMemo(() => {
    const vals = steps.flatMap((s) => [s.start, s.end, 0]);
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const pad = (hi - lo) * 0.05 || 1;
    return scaleLinear().domain([lo - pad, hi + pad]).range([innerH, 0]);
  }, [steps, innerH]);
  const bandW = innerW / Math.max(1, steps.length);
  const barW = Math.min(46, bandW * 0.56);
  const started = useStage(60);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);

  return (
    <div ref={ref} className="fin-chart relative" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} className="block">
          <g transform={`translate(${m.left},${m.top})`}>
            {y.ticks(4).map((t) => (
              <g key={t} transform={`translate(0,${y(t)})`}>
                <line x2={innerW} stroke={t === 0 ? "var(--axis-line)" : "var(--grid-line)"} strokeOpacity={t === 0 ? 1 : 0.85} strokeDasharray={t === 0 ? undefined : "2 4"} />
                <text x={innerW + 8} dy="0.32em" className="tabular-nums" fontSize={9.5} fill="var(--ink-faint)">{money(t, true)}</text>
              </g>
            ))}
            {steps.map((s, i) => {
              const cx = i * bandW + bandW / 2;
              const top = y(Math.max(s.start, s.end));
              const bottom = y(Math.min(s.start, s.end));
              const h = Math.max(2, bottom - top);
              const isAnchor = s.kind === "anchor";
              const favourable = s.impact >= 0;
              const fill = isAnchor ? "var(--signal-soft)" : favourable ? "var(--mint)" : "var(--ember)";
              const isSel = selected === s.key;
              const dim = selected !== null && !isSel;
              const grows = s.end >= s.start;
              const pick = () => !isAnchor && onSelect(isSel ? null : s.key);
              return (
                <g key={s.key}>
                  {i > 0 && !isAnchor && (
                    <line x1={(i - 1) * bandW + bandW / 2 + barW / 2} x2={cx - barW / 2} y1={y(s.start)} y2={y(s.start)} stroke="var(--connector)" strokeWidth={1} strokeDasharray="3 2"
                      style={{ opacity: started ? 0.8 : 0, transition: `opacity 300ms ease-out ${140 + i * 130}ms` }} />
                  )}
                  <g className={isAnchor ? "" : "cursor-pointer focus:outline-none"} onClick={pick}
                    {...(!isAnchor ? {
                      role: "button", tabIndex: 0, "aria-pressed": isSel,
                      "aria-label": `${s.label}: desvío ${favourable ? "favorable" : "desfavorable"} de ${money(Math.abs(s.impact), true)} sobre el margen.`,
                      onFocus: () => setFocusedKey(s.key), onBlur: () => setFocusedKey((k) => (k === s.key ? null : k)),
                      onKeyDown: (e: ReactKeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } },
                    } : { "aria-hidden": true })}>
                    <rect x={cx - bandW / 2} y={0} width={bandW} height={innerH} fill="transparent" />
                    <rect x={cx - barW / 2} y={top} width={barW} height={h} rx={2} fill={fill}
                      style={{ transformBox: "fill-box", transformOrigin: grows ? "center bottom" : "center top", transform: started ? "scaleY(1)" : "scaleY(0)", opacity: started ? (dim ? 0.28 : 1) : 0, transition: `transform 520ms cubic-bezier(0.22,1,0.36,1) ${i * 130}ms, opacity 300ms ease-out ${i * 130}ms` }} />
                    {focusedKey === s.key && <rect x={cx - barW / 2 - 2} y={top - 2} width={barW + 4} height={h + 4} rx={3} fill="none" stroke="var(--ring)" strokeWidth={2} />}
                    {isSel && <rect x={cx - barW / 2 - 3} y={top - 3} width={barW + 6} height={h + 6} rx={4} fill="none" stroke="var(--signal)" strokeWidth={1.25} />}
                    <text x={cx} y={grows ? top - 7 : bottom + 13} textAnchor="middle" className="tabular-nums" fontSize={9.5} fill={isAnchor ? "var(--foreground)" : fill}
                      style={{ opacity: started ? (dim ? 0.4 : 1) : 0, transition: `opacity 340ms ease-out ${240 + i * 130}ms` }}>
                      {isAnchor ? money(s.end, true) : `${s.impact >= 0 ? "+" : "−"}${money(Math.abs(s.impact), true)}`}
                    </text>
                  </g>
                  <text x={cx} y={innerH + 18} textAnchor="middle" fontSize={9} fill={isSel ? "var(--foreground)" : "var(--ink-faint)"} style={{ opacity: started ? 1 : 0, transition: `opacity 340ms ease-out ${200 + i * 130}ms` }}>{s.short}</text>
                </g>
              );
            })}
          </g>
        </svg>
      )}
    </div>
  );
}
