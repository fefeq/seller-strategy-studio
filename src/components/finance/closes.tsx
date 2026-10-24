import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { errorText } from "@/lib/errors";
import { actualMonth, addMonths, monthLabel, monthOf, monthStatus } from "@/lib/finance";
import { useFinanceRefresh, type FinanceData } from "./data";
import { Card, NumberInput } from "./ui";

const STATUS = { closed: "Cerrado", open: "Abierto", projected: "Futuro" } as const;

/** Monthly close: the live figures (invoices and cost lines) become the month's official numbers until reopened. */
export function FinanceCloses({ d }: { d: FinanceData }) {
  const { money } = useCurrency();
  const refresh = useFinanceRefresh();
  const today = monthOf(new Date());
  const months = Array.from({ length: 7 }, (_, i) => addMonths(today, i - 6)).reverse();
  const lines = d.lines.map((l) => ({ ...l, amount: Number(l.amount) }));
  const invoices = d.invoices.map((i) => ({ ...i, amount: Number(i.amount) }));
  const [edit, setEdit] = useState<Record<string, { revenue: number | null; costs: number | null; cash_end: number | null }>>({});

  async function close(m: string) {
    const live = actualMonth(m, invoices, [], lines);
    const e = edit[m] ?? { revenue: live.revenue, costs: live.costs, cash_end: null };
    const { error } = await supabase.from("finance_months").upsert({ org_id: d.settings?.org_id ?? undefined, month: m, revenue: e.revenue, costs: e.costs, cash_end: e.cash_end, closed_at: new Date().toISOString() }, { onConflict: "org_id,month" });
    if (error) return toast.error(errorText(error));
    toast.success(`${monthLabel(m)} cerrado.`); refresh();
  }
  async function reopen(m: string) {
    const { error } = await supabase.from("finance_months").update({ closed_at: null }).eq("month", m);
    if (error) return toast.error(errorText(error));
    refresh();
  }

  return (
    <Card title="Cierres de mes" sub="Al cerrar un mes, sus cifras quedan fijas para Plan vs real y la previsión. Puedes corregirlas antes de cerrar o reabrirlo.">
      <ul className="divide-y text-sm">
        {months.map((m) => {
          const st = monthStatus(m, d.months, today);
          const a = actualMonth(m, invoices, d.months, lines);
          const row = d.months.find((x) => x.month === m);
          const e = edit[m] ?? { revenue: a.revenue, costs: a.costs, cash_end: row?.cash_end != null ? Number(row.cash_end) : null };
          const set = (k: keyof typeof e) => (n: number | null) => setEdit((p) => ({ ...p, [m]: { ...e, [k]: n } }));
          return (
            <li key={m} className="grid gap-2 py-3 sm:grid-cols-[6rem_1fr_auto] sm:items-center">
              <div><span className="font-medium">{monthLabel(m)}</span><span className={`block text-xs ${st === "closed" ? "text-success" : "text-muted-foreground"}`}>{STATUS[st]}</span></div>
              {st === "closed" ? (
                <p className="tabular-nums text-ink-mid">Ingresos {money(a.revenue)} · costes {money(a.costs)} · cobrado {money(a.collected)}{row?.cash_end != null ? ` · caja ${money(Number(row.cash_end))}` : ""}</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <label className="text-xs text-ink-mid">Ingresos<NumberInput ariaLabel={`Ingresos de ${monthLabel(m)}`} value={e.revenue} onChange={set("revenue")} /></label>
                  <label className="text-xs text-ink-mid">Costes<NumberInput ariaLabel={`Costes de ${monthLabel(m)}`} value={e.costs} onChange={set("costs")} /></label>
                  <label className="text-xs text-ink-mid">Caja final<NumberInput ariaLabel={`Caja final de ${monthLabel(m)}`} value={e.cash_end} onChange={set("cash_end")} /></label>
                </div>
              )}
              {st === "closed" ? <Button size="sm" variant="ghost" onClick={() => reopen(m)}>Reabrir</Button> : <Button size="sm" variant="outline" onClick={() => close(m)}>Cerrar mes</Button>}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
