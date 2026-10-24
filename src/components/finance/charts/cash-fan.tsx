// Cash fan of the Finance Dashboard (components/cfo/CashFanChart.tsx), ported: same d3 bands (P10–P90 outer,
// P25–P75 inner), median line, reveal, hover read-out and the draggable «what-if» of extra monthly spend.
// Nokko feeds it months (the company's forecast horizon) instead of thirteen weeks.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { area, curveMonotoneX, line } from "d3-shape";
import { scaleLinear } from "d3-scale";
import { monthLabel } from "@/lib/finance";
import { useMeasure, useStage } from "./motion";

export type FanPoint = { month: string; p10: number; p25: number; base: number; p75: number; p90: number };

/** Bands from the low/base/high scenarios: P25 and P75 sit halfway between the median and each edge. */
export function fanFrom(months: { month: string; cash: { low: number; base: number; high: number } }[], extraMonthly = 0): FanPoint[] {
  return months.map((m, i) => {
    const d = extraMonthly * (i + 1);
    const low = m.cash.low - d, base = m.cash.base - d, high = m.cash.high - d;
    return { month: m.month, p10: low, p25: base - (base - low) / 2, base, p75: base + (high - base) / 2, p90: high };
  });
}

const MAX_WHATIF = 60_000;

export function CashFanChart({ months, money, burn, cashNow, sourceNote }: {
  months: { month: string; cash: { low: number; base: number; high: number } }[];
  money: (n: number, compact?: boolean) => string;
  /** Net monthly burn today (costs − revenue). */
  burn: number;
  cashNow: number;
  sourceNote?: string;
}) {
  const { ref, width } = useMeasure<HTMLDivElement>();
  const active = useStage(120);
  const [whatIf, setWhatIf] = useState(0);
  const height = 260;
  const m = { top: 16, right: 60, bottom: 26, left: 8 };
  const data = useMemo(() => fanFrom(months, whatIf), [months, whatIf]);
  const innerW = Math.max(80, width - m.left - m.right);
  const innerH = height - m.top - m.bottom;
  const n = Math.max(1, data.length);
  const x = useMemo(() => scaleLinear().domain([0, Math.max(1, n - 1)]).range([0, innerW]), [innerW, n]);
  const y = useMemo(() => {
    if (!data.length) return scaleLinear().domain([0, 1]).range([innerH, 0]);
    const lo = Math.min(0, ...data.map((d) => d.p10));
    const hi = Math.max(...data.map((d) => d.p90));
    const pad = Math.max(1, (hi - lo) * 0.12);
    return scaleLinear().domain([lo - pad, hi + pad]).range([innerH, 0]);
  }, [data, innerH]);
  const outer = useMemo(() => area<FanPoint>().x((_, i) => x(i)).y0((d) => y(d.p10)).y1((d) => y(d.p90)).curve(curveMonotoneX)(data) ?? "", [data, x, y]);
  const inner = useMemo(() => area<FanPoint>().x((_, i) => x(i)).y0((d) => y(d.p25)).y1((d) => y(d.p75)).curve(curveMonotoneX)(data) ?? "", [data, x, y]);
  const mid = useMemo(() => line<FanPoint>().x((_, i) => x(i)).y((d) => y(d.base)).curve(curveMonotoneX)(data) ?? "", [data, x, y]);
  const [hover, setHover] = useState<number | null>(null);
  const hovered = hover !== null ? data[hover] : null;
  const every = Math.ceil(n / 12);

  return (
    <div className="fin-chart flex flex-col gap-4">
      <div ref={ref} className="relative" style={{ height }}>
        {!data.length && <div className="flex h-full items-center justify-center rounded-md border border-dashed px-6 text-center text-sm text-ink-faint">Aún no hay datos de caja para prever.</div>}
        {width > 0 && data.length > 0 && (
          <svg width={width} height={height} className="block"
            onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHover(Math.min(n - 1, Math.max(0, Math.round(x.invert(e.clientX - r.left - m.left))))); }}
            onPointerLeave={() => setHover(null)}>
            <g transform={`translate(${m.left},${m.top})`}>
              {y.ticks(4).map((t) => (
                <g key={t} transform={`translate(0,${y(t)})`}>
                  <line x2={innerW} stroke={t === 0 ? "var(--axis-line)" : "var(--grid-line)"} strokeDasharray={t === 0 ? undefined : "2 4"} />
                  <text x={innerW + 8} dy="0.32em" className="tabular-nums" fontSize={9.5} fill="var(--ink-faint)">{money(t, true)}</text>
                </g>
              ))}
              <g style={{ clipPath: active ? "inset(0 0 0 0)" : "inset(0 100% 0 0)", transition: "clip-path 1.5s cubic-bezier(0.22,1,0.36,1) 0.15s" }}>
                <path d={outer} fill="var(--band-outer)" stroke="var(--band-stroke)" strokeWidth={0.75} />
                <path d={inner} fill="var(--band-inner)" stroke="var(--band-stroke)" strokeWidth={0.75} />
                <path d={mid} fill="none" stroke="var(--signal)" strokeWidth={1.75} strokeLinecap="round" />
              </g>
              {data.map((d, i) => (i % every === 0 || i === n - 1) && (
                <text key={d.month} x={x(i)} y={innerH + 16} textAnchor="middle" fontSize={9} fill={hover === i ? "var(--foreground)" : "var(--ink-faint)"}>{monthLabel(d.month)}</text>
              ))}
              {hovered && hover !== null && (
                <g>
                  <line x1={x(hover)} x2={x(hover)} y1={0} y2={innerH} stroke="var(--signal)" strokeOpacity={0.5} strokeDasharray="3 3" />
                  <circle cx={x(hover)} cy={y(hovered.base)} r={3.5} fill="var(--surface)" stroke="var(--signal)" strokeWidth={1.75} />
                </g>
              )}
            </g>
          </svg>
        )}
        {hovered && hover !== null && (
          <div className="pointer-events-none absolute top-2 rounded-md border bg-popover/95 px-3 py-2 shadow-xl" style={{ left: Math.min(Math.max(x(hover) + m.left - 70, 0), Math.max(0, width - 170)) }}>
            <div className="eyebrow">{monthLabel(hovered.month)}</div>
            <div className="mt-0.5 text-sm tabular-nums text-foreground">{money(hovered.base, true)}</div>
            <div className="mt-0.5 text-[10px] tabular-nums text-ink-faint">P10–P90 {money(hovered.p10, true)} – {money(hovered.p90, true)}</div>
          </div>
        )}
      </div>
      <WhatIfDrag value={whatIf} onChange={setWhatIf} burn={burn} cashNow={cashNow} money={money} />
      {sourceNote && <p className="text-[11px] leading-[1.6] text-ink-faint">{sourceNote}</p>}
    </div>
  );
}

/** Draggable what-if handle: extra monthly spend (a hire, a campaign) and when the cash runs out with it. */
function WhatIfDrag({ value, onChange, burn, cashNow, money }: { value: number; onChange: (v: number) => void; burn: number; cashNow: number; money: (n: number, compact?: boolean) => string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const pct = value / MAX_WHATIF;
  const setFromClientX = useCallback((clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    onChange(Math.round((p * MAX_WHATIF) / 500) * 500);
  }, [onChange]);
  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => setFromClientX(e.clientX);
    const up = () => setDragging(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [dragging, setFromClientX]);
  const total = burn + value;
  const months = total > 0 ? cashNow / total : null;
  const date = new Date();
  if (months !== null) date.setMonth(date.getMonth() + Math.floor(months));
  const tight = months !== null && months < 18;

  return (
    <div className="rounded-md border bg-[var(--surface-raised)]/50 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">¿Y si…? · gasto mensual adicional</div>
          <div className="mt-1 text-lg font-medium tabular-nums text-foreground">+{money(value, true)}<span className="ml-1.5 text-[11px] text-ink-faint">/mes</span></div>
        </div>
        <div className="text-right">
          <div className="eyebrow">La caja se acaba</div>
          <div className="mt-1 text-lg font-medium tabular-nums" style={{ color: months === null ? "var(--mint)" : tight ? "var(--ember)" : "var(--mint)" }}>
            {months === null ? "No se acaba" : date.toLocaleDateString("es-ES", { month: "short", year: "numeric" })}
          </div>
          <div className="text-[10px] tabular-nums text-ink-faint">
            {months === null ? "Generas caja" : `${months.toFixed(1).replace(".", ",")} meses`} · {money(Math.max(0, burn), true)}/mes de gasto neto{value > 0 ? ` + ${money(value, true)}/mes del supuesto` : ""}
          </div>
        </div>
      </div>
      <div ref={trackRef} role="slider" tabIndex={0} aria-label="Gasto mensual adicional" aria-valuemin={0} aria-valuemax={MAX_WHATIF} aria-valuenow={value}
        className="group relative mt-4 h-11 cursor-ew-resize touch-none rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] sm:h-9"
        onPointerDown={(e) => { e.preventDefault(); e.currentTarget.focus(); setDragging(true); setFromClientX(e.clientX); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); onChange(Math.min(MAX_WHATIF, value + 500)); }
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); onChange(Math.max(0, value - 500)); }
          if (e.key === "Home") onChange(0);
        }}>
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-[var(--grid-line)]" />
        <div className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full" style={{ width: `${pct * 100}%`, background: tight ? "var(--ember)" : "var(--signal)" }} />
        <div className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-[var(--surface)] shadow" style={{ left: `${pct * 100}%`, borderColor: tight ? "var(--ember)" : "var(--signal)" }} />
      </div>
    </div>
  );
}
