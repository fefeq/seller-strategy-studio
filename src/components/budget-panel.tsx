import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useCurrency, useMe } from "@/hooks/use-me";
import { supabase } from "@/integrations/supabase/client";
import { annualFromQuarters, quartersOfYear, segmentBudget, type SegmentBudgetRow } from "@/lib/segment-budget";
import { Deviation } from "@/components/budget-quarters";

const fmt1 = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 1 });
const pct = (n: number | null) => (n == null ? "—" : `${Math.round(n)}%`);

/** Annual plan vs actual per segment (sum of the quarters entered in Estrategia GTM) → real margin and payback. */
export function BudgetPanel({ year }: { year: number }) {
  const { money } = useCurrency();
  const { data: me } = useMe();
  const orgId = me?.currentOrg?.org_id;
  const { data } = useQuery({
    queryKey: ["segment-coverage", orgId, "budget-panel", year],
    enabled: !!orgId,
    queryFn: async () => {
      const [s, d, b, c] = await Promise.all([
        supabase.from("segments").select("id,name,acv_min,acv_max,win_rate_target,cac_target,gross_margin_pct,payback_months").order("acv_min"),
        supabase.from("deals").select("segment_id,amount,stage,close_date,closed_at,updated_at,created_at"),
        supabase.from("segment_budget_quarters").select("*").in("period", quartersOfYear(year)),
        supabase.from("cac_costs").select("segment_id,channel,amount,period").in("period", quartersOfYear(year)),
      ]);
      return { segments: s.data ?? [], deals: d.data ?? [], budgets: annualFromQuarters(b.data ?? [], year), costs: c.data ?? [] };
    },
  });
  const rows = useMemo(() => (data ? segmentBudget(data.segments, data.deals, data.budgets, data.costs, year) : []), [data, year]);
  const sum = (f: (r: SegmentBudgetRow) => number | null) => rows.reduce((s, r) => s + (f(r) ?? 0), 0);
  const planRev = sum((r) => r.plan.revenue), realRev = sum((r) => r.actual.revenue);
  const realCost = sum((r) => r.actual.costToServe);
  const realMargin = realRev ? ((realRev - realCost) / realRev) * 100 : null;

  return (
    <section className="rounded-lg border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <h3 className="text-2xl">Presupuesto por segmento · {year}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Suma de los cuatro trimestres. Se apunta por trimestre en{" "}
            <Link to="/strategy" className="underline">Estrategia GTM → Presupuesto vs real</Link>.
            El margen real (ingresos − coste de servir) sustituye al margen objetivo en todos los paybacks.
          </p>
        </div>
        <div className="flex items-center gap-5 text-right text-sm">
          <div>
            <p className="font-mono">{money(realRev)} <span className="text-muted-foreground">/ {money(planRev)}</span></p>
            <p className="text-xs text-muted-foreground">ingresos reales / presupuesto{planRev ? ` · ${Math.round((realRev / planRev) * 100)}%` : ""}</p>
          </div>
          <div>
            <p className="font-mono">{pct(realMargin)}</p>
            <p className="text-xs text-muted-foreground">margen bruto real</p>
          </div>
        </div>
      </div>
      {rows.length === 0 && <p className="text-sm text-muted-foreground">No hay segmentos. Créalos en <Link to="/strategy" className="underline">Estrategia GTM</Link>.</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-2 pr-3 font-normal">Segmento</th>
              <th className="px-2 py-2 text-right font-normal">Ingresos</th>
              <th className="px-2 py-2 text-right font-normal">Margen bruto</th>
              <th className="px-2 py-2 text-right font-normal">Gasto de captación</th>
              <th className="px-2 py-2 text-right font-normal">CAC</th>
              <th className="px-2 py-2 text-right font-normal">Payback</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.segment.id} className="border-b border-dashed align-top">
                <td className="py-2 pr-3">
                  <p className="font-medium">{r.segment.name}</p>
                  <p className="text-[11px] text-muted-foreground">margen en el payback: {pct(r.margin.pct)} {r.margin.source === "real" ? "(real)" : r.margin.source === "plan" ? "(presupuestado)" : r.margin.source === "objetivo" ? "(objetivo)" : ""}</p>
                </td>
                <Cmp real={r.actual.revenue != null ? money(r.actual.revenue) : "—"} plan={r.plan.revenue != null ? money(r.plan.revenue) : "—"} dev={<Deviation real={r.actual.revenue} plan={r.plan.revenue} />} />
                <Cmp real={pct(r.actual.margin)} plan={pct(r.plan.margin)} dev={<Deviation real={r.actual.margin} plan={r.plan.margin} points />} />
                <Cmp real={r.actual.acquisition ? money(r.actual.acquisition) : "—"} plan={r.plan.acquisition != null ? money(r.plan.acquisition) : "—"} dev={<Deviation real={r.actual.acquisition || null} plan={r.plan.acquisition} lowerIsBetter />} />
                <Cmp real={r.actual.cac != null ? money(r.actual.cac) : "—"} plan={r.plan.cac != null ? money(r.plan.cac) : "—"} dev={<Deviation real={r.actual.cac} plan={r.plan.cac} lowerIsBetter />} />
                <Cmp
                  real={r.actual.payback != null ? `${fmt1(r.actual.payback)} m` : "—"}
                  plan={`${r.plan.payback != null ? `${fmt1(r.plan.payback)} m` : "—"}${r.payback.target != null ? ` · obj. ${r.payback.target} m` : ""}`}
                  dev={<Deviation real={r.actual.payback} plan={r.plan.payback} lowerIsBetter />}
                  tone={r.payback.realOk === false ? "text-signal" : r.payback.realOk ? "text-success" : ""}
                />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Cmp({ real, plan, dev, tone = "" }: { real: string; plan: string; dev: React.ReactNode; tone?: string }) {
  return (
    <td className="px-2 py-2 text-right">
      <p className={`font-mono text-xs ${tone}`}>{real}</p>
      <p className="text-[11px] text-muted-foreground">presup. {plan}</p>
      <p className="font-mono text-[10px]">{dev}</p>
    </td>
  );
}
