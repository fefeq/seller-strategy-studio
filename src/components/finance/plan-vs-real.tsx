import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency, useMe } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { askConfirm } from "@/components/confirm-dialog";
import { errorText } from "@/lib/errors";
import { cacRowsFor, costToServeFor, planVsActual, quarterOfMonth, monthOf } from "@/lib/finance";
import { useFinanceRefresh, type FinanceData } from "./data";
import { Card, Muted } from "./ui";
import { VarianceWaterfall, buildSteps } from "./charts/waterfall";

export function FinancePlanVsReal({ d }: { d: FinanceData }) {
  const { money } = useCurrency();
  const { data: me } = useMe();
  const refresh = useFinanceRefresh();
  const thisQ = quarterOfMonth(monthOf(new Date()));
  const quarters = useMemo(() => { const [y, k] = thisQ.split("-Q").map(Number); return Array.from({ length: 6 }, (_, i) => { const t = y * 4 + (k - 1) - 4 + i; return `${Math.floor(t / 4)}-Q${(t % 4) + 1}`; }); }, [thisQ]);
  const [q, setQ] = useState(thisQ);
  const [sel, setSel] = useState<string | null>(null);
  const lines = d.lines.map((l) => ({ ...l, amount: Number(l.amount) }));
  const invoices = d.invoices.map((i) => ({ ...i, amount: Number(i.amount) }));
  const r = planVsActual(q, d.budgets, invoices, d.months, lines);
  const cac = cacRowsFor(lines, q);
  const cts = costToServeFor(lines, q);

  async function sync() {
    const ok = await askConfirm(`Enviar los costes de ${q}`, { body: `Se guardan ${cac.length} filas de CAC (canal «Finanzas · …») y el coste de servir real de ${cts.length} segmentos. Si ya existían para este trimestre, se sustituyen.`, confirmLabel: "Enviar" });
    if (!ok) return;
    const org = me!.currentOrg!.org_id;
    if (cac.length) {
      const { error } = await supabase.from("cac_costs").upsert(cac.map((c) => ({ org_id: org, segment_id: c.segment_id, channel: c.channel, period: q, amount: c.amount })), { onConflict: "org_id,segment_id,channel,period" });
      if (error) return toast.error(errorText(error));
    }
    for (const c of cts) {
      const { error } = await supabase.from("segment_budget_quarters").upsert({ org_id: org, segment_id: c.segment_id, period: q, actual_cost_to_serve: c.amount }, { onConflict: "org_id,segment_id,period" });
      if (error) return toast.error(errorText(error));
    }
    toast.success("Costes enviados: el CAC, el payback y la cobertura ya los usan."); refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Trimestre" className="h-10 rounded-md border bg-card px-3 text-sm md:h-9" value={q} onChange={(e) => setQ(e.target.value)}>{quarters.map((x) => <option key={x}>{x}</option>)}</select>
        <Button variant="outline" disabled={!cac.length && !cts.length} onClick={sync}>Enviar costes a CAC y presupuesto</Button>
      </div>
      <Card title={`Plan vs real · ${q}`} sub="El plan sale de los presupuestos por segmento (Métricas → CAC y presupuesto). Lo real, de las facturas o del cierre del mes y de tus líneas de coste.">
        {!r.hasPlan && <div className="mb-4"><Muted>Aún no hay presupuesto para {q}. <Link to="/metrics" search={{ seccion: "economia" }} className="underline underline-offset-2">Fíjalo en Métricas</Link> para ver los desvíos.</Muted></div>}
        <VarianceWaterfall steps={buildSteps(r.rows)} money={money} selected={sel} onSelect={setSel} />
        {sel && (() => { const x = r.rows.find((y) => y.key === sel); return x ? <p className="mt-2 text-sm">{x.label}: plan {money(x.plan)}, real {money(x.actual)} · <span className={x.good ? "text-success" : "text-destructive"}>{x.good ? "mejor que el plan" : "peor que el plan"}</span>.</p> : null; })()}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm tabular-nums">
            <thead><tr className="text-left text-ink-mid"><th className="py-2 font-normal" /><th className="font-normal">Plan</th><th className="font-normal">Real</th><th className="font-normal">Desvío</th></tr></thead>
            <tbody>
              {r.rows.map((x) => (
                <tr key={x.key} className="border-t">
                  <td className="py-2 font-medium">{x.label}</td><td>{money(x.plan)}</td><td>{money(x.actual)}</td>
                  <td className={x.diff === 0 ? "text-ink-mid" : x.good ? "text-success" : "text-signal"}>{x.diff > 0 ? "+" : ""}{money(x.diff)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Verde: mejor que el plan (más ingresos o menos coste). Rojo: peor.</p>
      </Card>
    </div>
  );
}
