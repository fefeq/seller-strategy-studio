import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useCurrency } from "@/hooks/use-me";
import { COST_CATEGORIES, COST_TO_SERVE, arAging, forecast, monthLabel, monthlyCost, monthOf, projectPlans, recurringPlans, runwayMonths, type CostCategory } from "@/lib/finance";
import type { FlowInput } from "@/lib/finance-sankey";
import { CashFanChart } from "./charts/cash-fan";
import { SankeyFlow } from "./charts/sankey-flow";
import { forecastInput, type FinanceData } from "./data";
import { Card, Kpi, Muted } from "./ui";

/** What is still missing before the numbers mean something (also shown by onboarding and Configuración). */
export function financeSteps(d: FinanceData) {
  const plans = recurringPlans(d.products);
  return [
    { id: "cash", label: "Caja de hoy", done: !!d.settings?.cash_as_of, to: "prevision" as const },
    { id: "costs", label: "Costes mensuales (equipo, herramientas, marketing…)", done: d.lines.length > 0, to: "costes" as const },
    { id: "plans", label: "Planes y precios en Productos", done: plans.length > 0, to: null },
    { id: "assumptions", label: "Clientes, altas y bajas por plan", done: plans.length > 0 && plans.every((p) => d.assumptions[p.id]), to: "prevision" as const },
  ];
}

export function useFinanceView(d: FinanceData | undefined) {
  return useMemo(() => {
    if (!d) return null;
    const today = monthOf(new Date());
    const f = forecast(forecastInput(d, today));
    const now = f.months.find((m) => m.month === today) ?? f.months[0];
    const k = f.months.indexOf(now);
    const cashNow = k > 0 ? f.months[k - 1].cash.base : Number(d.settings?.opening_cash ?? 0);
    const burn = now ? now.costs - now.revenue : 0;
    const aging = arAging(d.invoices.map((i) => ({ ...i, amount: Number(i.amount) })), new Date().toISOString().slice(0, 10));
    return { f, now, cashNow, burn, runway: runwayMonths(cashNow, burn), aging, configured: !!d.settings?.cash_as_of || d.lines.length > 0 };
  }, [d]);
}

export function FinanceSummary({ d }: { d: FinanceData }) {
  const { money } = useCurrency();
  const v = useFinanceView(d)!;
  const steps = financeSteps(d);
  const missing = steps.filter((s) => !s.done);
  const flow = flowOf(d, v.now?.month ?? monthOf(new Date()), v.now?.pipeline ?? 0);
  return (
    <div className="space-y-6">
      {missing.length > 0 && (
        <Card title="Para que las cifras sean tuyas" sub="Todo empieza de cero: con estos datos Nokko calcula caja, meses de caja y previsión.">
          <ul className="space-y-2 text-sm">
            {steps.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className={s.done ? "text-ink-faint line-through" : ""}>{s.label}</span>
                {!s.done && (s.to ? <Link to="/finance" search={{ seccion: s.to }} className="text-sm underline underline-offset-2">Completar</Link> : <Link to="/products" className="text-sm underline underline-offset-2">Abrir Productos</Link>)}
              </li>
            ))}
          </ul>
        </Card>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Caja hoy" value={money(v.cashNow)} hint={d.settings?.cash_as_of ? `Desde ${d.settings.cash_as_of} con lo previsto` : "Indica tu caja en Previsión"} />
        <Kpi label="Gasto neto del mes" value={money(Math.max(0, v.burn))} hint={!v.configured ? "Añade tus costes" : v.burn < 0 ? `Generas ${money(-v.burn)}` : `Costes ${money(v.now?.costs ?? 0)} · ingresos ${money(v.now?.revenue ?? 0)}`} tone={v.configured && v.burn < 0 ? "good" : undefined} />
        <Kpi label="Meses de caja" value={v.runway == null ? "—" : String(v.runway)} hint={!v.configured ? "Con caja y costes" : v.runway == null ? "No consumes caja" : v.runway < 6 ? "Menos de 6 meses: actúa ya" : "Al ritmo actual"} tone={v.runway != null && v.runway < 6 ? "bad" : undefined} />
        <Kpi label="Cobros pendientes" value={money(v.aging.open)} hint={v.aging.overdue ? `${money(v.aging.overdue)} vencidos` : "Nada vencido"} tone={v.aging.overdue ? "bad" : undefined} />
      </div>
      <Card title="Caja prevista" sub={`Banda: escenario prudente a optimista (altas, bajas y pipeline ±${Number(d.settings?.scenario_spread_pct ?? 25)} %).${v.f.undated ? ` ${v.f.undated} deals sin fecha de cierre no cuentan.` : ""}`}>
        {v.configured
          ? <CashFanChart months={v.f.months} money={money} burn={v.burn} cashNow={v.cashNow} sourceNote="Entra: planes (clientes × precio, altas anuales cobradas por adelantado) y pipeline ponderado. Sale: tus líneas de coste." />
          : <Muted>Indica tu caja y tus costes y aquí verás cuántos meses te quedan.</Muted>}
        {v.f.runway.base != null && <p className="mt-3 text-sm text-signal">Con la previsión actual la caja se acaba en {monthLabel(v.f.months[v.f.runway.base].month)}{v.f.runway.high != null ? "" : " (en el escenario optimista no se acaba)"}.</p>}
        {d.stripe && <p className="mt-2 text-xs text-muted-foreground">Stripe: {money(Number(d.stripe.mrr))} de MRR real y {d.stripe.active_customers} clientes activos. Úsalo para ajustar los clientes de cada plan.</p>}
      </Card>
      <Card title={`Flujo de dinero previsto · ${monthLabel(v.now?.month ?? monthOf(new Date()))}`} sub="De dónde entra el dinero y a dónde va. Pasa por encima de una banda para seguirla.">
        {flow.revenue.length || flow.opex.length || flow.costToServe.length ? <SankeyFlow flow={flow} money={money} stateKey={JSON.stringify(flow)} active height={420} /> : <Muted>Aparece cuando haya planes con clientes o líneas de coste.</Muted>}
      </Card>
    </div>
  );
}

/** Revenue by plan (plus weighted pipeline) and costs by type for one month, as the money-flow diagram reads them. */
function flowOf(d: FinanceData, month: string, pipeline: number): FlowInput {
  const discount = Number(d.settings?.annual_discount_pct ?? 0);
  const revenue = recurringPlans(d.products).map((p) => ({ id: p.id, label: p.name, value: projectPlans([p], d.assumptions, month, 1, discount)[0]?.revenue ?? 0 })).filter((r) => r.value > 0);
  if (pipeline > 0) revenue.push({ id: "pipeline", label: "Pipeline ponderado", value: pipeline });
  const lines = d.lines.map((l) => ({ ...l, amount: Number(l.amount) }));
  const by = monthlyCost(lines, month).byCategory;
  const part = (cats: CostCategory[]) => cats.filter((c) => (by[c] ?? 0) > 0).map((c) => ({ id: c, label: COST_CATEGORIES[c], value: by[c] ?? 0 }));
  return { revenue, costToServe: part(COST_TO_SERVE), opex: part((Object.keys(COST_CATEGORIES) as CostCategory[]).filter((c) => !COST_TO_SERVE.includes(c))) };
}
