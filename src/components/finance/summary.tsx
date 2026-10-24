import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useCurrency } from "@/hooks/use-me";
import { arAging, forecast, monthLabel, monthOf, recurringPlans, runwayMonths } from "@/lib/finance";
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
  const chart = v.f.months.map((m) => ({ label: monthLabel(m.month), band: [m.cash.low, m.cash.high] as [number, number], base: m.cash.base }));
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
        <Kpi label="Gasto neto del mes" value={money(Math.max(0, v.burn))} hint={v.burn <= 0 ? `Generas ${money(-v.burn)}` : `Costes ${money(v.now?.costs ?? 0)} · ingresos ${money(v.now?.revenue ?? 0)}`} tone={v.burn <= 0 ? "good" : undefined} />
        <Kpi label="Meses de caja" value={v.runway == null ? "—" : String(v.runway)} hint={v.runway == null ? "No consumes caja" : v.runway < 6 ? "Menos de 6 meses: actúa ya" : "Al ritmo actual"} tone={v.runway != null && v.runway < 6 ? "bad" : undefined} />
        <Kpi label="Cobros pendientes" value={money(v.aging.open)} hint={v.aging.overdue ? `${money(v.aging.overdue)} vencidos` : "Nada vencido"} tone={v.aging.overdue ? "bad" : undefined} />
      </div>
      <Card title="Caja prevista" sub={`Banda: escenario prudente a optimista (altas, bajas y pipeline ±${Number(d.settings?.scenario_spread_pct ?? 25)} %).${v.f.undated ? ` ${v.f.undated} deals sin fecha de cierre no cuentan.` : ""}`}>
        {v.configured ? (
          <div className="h-64 w-full">
            <ResponsiveContainer>
              <ComposedChart data={chart} margin={{ left: 8, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="var(--ink-faint)" />
                <YAxis tickFormatter={(n) => money(n, true)} tick={{ fontSize: 12 }} width={70} stroke="var(--ink-faint)" />
                <Tooltip formatter={(val: number | number[]) => (Array.isArray(val) ? `${money(val[0])} – ${money(val[1])}` : money(val))} />
                <Area dataKey="band" name="Rango" stroke="none" fill="var(--lime)" fillOpacity={0.35} />
                <Line dataKey="base" name="Previsión" stroke="var(--ink)" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : <Muted>Indica tu caja y tus costes y aquí verás cuántos meses te quedan.</Muted>}
        {v.f.runway.base != null && <p className="mt-3 text-sm text-signal">Con la previsión actual la caja se acaba en {monthLabel(v.f.months[v.f.runway.base].month)}{v.f.runway.high != null ? "" : " (en el escenario optimista no se acaba)"}.</p>}
        {d.stripe && <p className="mt-2 text-xs text-muted-foreground">Stripe: {money(Number(d.stripe.mrr))} de MRR real y {d.stripe.active_customers} clientes activos. Úsalo para ajustar los clientes de cada plan.</p>}
      </Card>
    </div>
  );
}
