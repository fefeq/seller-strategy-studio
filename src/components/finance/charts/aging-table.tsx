// Receivables aging of the Finance Dashboard (components/cfo/ArAgingTable.tsx), ported: aging rail, bucket
// legend, «Solo en riesgo», sort by age / value / A–Z and the risk chip; Nokko adds «Marcar cobrada».
import { useMemo, useState } from "react";
import { AGING_LABEL, type AgingBucket } from "@/lib/finance";

export type AgingRow = { id: string; customer: string; number: string; amount: number; daysPastDue: number; bucket: AgingBucket };
type SortKey = "daysPastDue" | "amount" | "customer";
type Risk = "low" | "medium" | "high" | "critical";
const RISK_META: Record<Risk, { label: string; color: string }> = {
  low: { label: "Al día", color: "var(--mint)" },
  medium: { label: "Vigilar", color: "var(--signal)" },
  high: { label: "Alto", color: "var(--ember)" },
  critical: { label: "Crítico", color: "var(--destructive)" },
};
const riskOf = (days: number): Risk => (days > 90 ? "critical" : days > 60 ? "high" : days > 30 ? "medium" : "low");

export function ArAgingTable({ rows: all, buckets, total, money, onPaid }: {
  rows: AgingRow[]; buckets: Record<AgingBucket, { count: number; amount: number }>; total: number;
  money: (n: number, compact?: boolean) => string; onPaid: (id: string) => void;
}) {
  const [sort, setSort] = useState<SortKey>("daysPastDue");
  const [onlyRisk, setOnlyRisk] = useState(false);
  const rows = useMemo(() => {
    let r = [...all];
    if (onlyRisk) r = r.filter((i) => riskOf(i.daysPastDue) === "high" || riskOf(i.daysPastDue) === "critical");
    r.sort((a, b) => (sort === "customer" ? a.customer.localeCompare(b.customer) : (b[sort] as number) - (a[sort] as number)));
    return r;
  }, [all, sort, onlyRisk]);
  const keys = Object.keys(AGING_LABEL) as AgingBucket[];

  return (
    <div className="fin-chart">
      <div className="flex gap-px overflow-hidden rounded-sm bg-[var(--grid-line)]">
        {keys.map((k, i) => (
          <div key={k} className="relative h-1.5" title={`${AGING_LABEL[k]}: ${money(buckets[k].amount)}`}
            style={{ width: `${total ? (buckets[k].amount / total) * 100 : 0}%`, background: `color-mix(in oklab, ${i <= 1 ? "var(--signal)" : i === 2 ? "var(--ember-soft)" : "var(--destructive)"} ${90 - i * 6}%, transparent)` }} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
        {keys.map((k) => (
          <div key={k} className="flex items-baseline gap-1.5"><span className="text-[10px] tabular-nums text-ink-faint">{AGING_LABEL[k]}</span><span className="text-[10.5px] tabular-nums text-[var(--ink-dim)]">{money(buckets[k].amount, true)}</span></div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <button type="button" aria-pressed={onlyRisk} onClick={() => setOnlyRisk((v) => !v)}
          className="min-h-11 rounded-md border px-2.5 py-1 text-[12px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] sm:min-h-0"
          style={{ borderColor: onlyRisk ? "var(--signal)" : "var(--border)", color: onlyRisk ? "var(--signal)" : "var(--ink-faint)", background: onlyRisk ? "color-mix(in oklab, var(--signal) 12%, transparent)" : "transparent" }}>
          Solo en riesgo
        </button>
        <div role="group" aria-label="Ordenar cobros" className="flex items-center gap-1">
          <span className="eyebrow" aria-hidden>Orden</span>
          {([["daysPastDue", "Antigüedad"], ["amount", "Importe"], ["customer", "A–Z"]] as [SortKey, string][]).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={sort === k} onClick={() => setSort(k)} className="min-h-11 rounded px-1.5 py-0.5 text-[12px] font-medium sm:min-h-0" style={{ color: sort === k ? "var(--signal)" : "var(--ink-faint)" }}>{l}</button>
          ))}
        </div>
      </div>
      <div className="mt-3 max-h-[430px] overflow-auto">
        {rows.length === 0 ? <p className="py-4 text-sm text-muted-foreground">{all.length ? "Nada en riesgo." : "No hay nada pendiente de cobro."}</p> : (
          <table className="w-full min-w-[520px] border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b">
                {["Cliente", "Tramo", "Días", "Importe", "Riesgo", ""].map((h, i) => <th key={i} scope="col" className="eyebrow whitespace-nowrap pb-2 pl-3 pt-1 font-medium first:pl-0" style={{ textAlign: i >= 2 && i <= 3 ? "right" : "left" }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((inv) => {
                const meta = RISK_META[riskOf(inv.daysPastDue)];
                return (
                  <tr key={inv.id} className="border-b border-border/40 last:border-0 hover:bg-muted/40">
                    <th scope="row" className="py-2 pr-3 text-left align-top font-normal"><div className="text-[12.5px] leading-tight text-foreground">{inv.customer}</div><div className="text-[9.5px] tabular-nums text-ink-faint">{inv.number || "Sin número"}</div></th>
                    <td className="whitespace-nowrap py-2 pr-3 align-top text-[11px] tabular-nums text-[var(--ink-dim)]">{AGING_LABEL[inv.bucket]}</td>
                    <td className="py-2 pr-3 text-right align-top text-[11px] tabular-nums text-[var(--ink-dim)]">{inv.daysPastDue > 0 ? inv.daysPastDue : "—"}</td>
                    <td className="py-2 pr-3 text-right align-top text-[12px] tabular-nums text-foreground">{money(inv.amount, true)}</td>
                    <td className="py-2 pr-3 align-top">
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm px-1.5 py-0.5 text-[9.5px] uppercase tracking-wider" style={{ color: meta.color, background: `color-mix(in oklab, ${meta.color} 12%, var(--surface))`, border: `1px solid color-mix(in oklab, ${meta.color} 32%, transparent)` }}>
                        <span style={{ width: 4, height: 4, borderRadius: 999, background: meta.color, display: "inline-block" }} />{meta.label}
                      </span>
                    </td>
                    <td className="py-2 text-right align-top"><button className="text-[11px] text-ink-mid underline underline-offset-2 hover:text-ink" onClick={() => onPaid(inv.id)}>Marcar cobrada</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
