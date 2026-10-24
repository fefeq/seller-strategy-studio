import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency, useMe } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DateField } from "@/components/date-field";
import { Field } from "@/components/fields";
import { errorText } from "@/lib/errors";
import { forecast, monthLabel, monthOf, recurringPlans, type PlanAssumption } from "@/lib/finance";
import type { Json } from "@/integrations/supabase/types";
import { forecastInput, useFinanceRefresh, type FinanceData } from "./data";
import { Card, Muted, NumberInput } from "./ui";

type Form = { opening_cash: number | null; cash_as_of: string | null; horizon_months: number | null; annual_discount_pct: number | null; scenario_spread_pct: number | null; include_pipeline: boolean };
const BLANK: PlanAssumption = { customers: 0, adds: 0, churn_pct: 0, annual_share_pct: 0 };

export function FinanceForecast({ d }: { d: FinanceData }) {
  const { money } = useCurrency();
  const { data: me } = useMe();
  const refresh = useFinanceRefresh();
  const s = d.settings;
  const initial = (): Form => ({ opening_cash: s ? Number(s.opening_cash) : null, cash_as_of: s?.cash_as_of ?? null, horizon_months: s?.horizon_months ?? 12, annual_discount_pct: s ? Number(s.annual_discount_pct) : 0, scenario_spread_pct: s ? Number(s.scenario_spread_pct) : 25, include_pipeline: s?.include_pipeline ?? true });
  const [f, setF] = useState<Form>(initial);
  const [plans, setPlans] = useState<Record<string, PlanAssumption>>(d.assumptions);
  const [busy, setBusy] = useState(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setF(initial()); setPlans(d.assumptions); }, [d.settings]);
  const recurring = recurringPlans(d.products);

  const draft: FinanceData = useMemo(() => ({
    ...d, assumptions: plans,
    settings: { ...(s ?? ({} as NonNullable<FinanceData["settings"]>)), opening_cash: f.opening_cash ?? 0, cash_as_of: f.cash_as_of, horizon_months: f.horizon_months ?? 12, annual_discount_pct: f.annual_discount_pct ?? 0, scenario_spread_pct: f.scenario_spread_pct ?? 25, include_pipeline: f.include_pipeline },
  }), [d, plans, f, s]);
  const today = monthOf(new Date());
  const fc = useMemo(() => forecast(forecastInput(draft, today)), [draft, today]);

  async function save() {
    const h = Math.min(36, Math.max(3, Math.round(f.horizon_months ?? 12)));
    setBusy(true);
    const { error } = await supabase.from("finance_settings").upsert({
      org_id: me!.currentOrg!.org_id, opening_cash: f.opening_cash ?? 0, cash_as_of: f.cash_as_of ?? new Date().toISOString().slice(0, 10), horizon_months: h,
      annual_discount_pct: Math.min(90, Math.max(0, f.annual_discount_pct ?? 0)), scenario_spread_pct: Math.min(90, Math.max(0, f.scenario_spread_pct ?? 25)),
      include_pipeline: f.include_pipeline, plan_assumptions: plans as unknown as Json,
    }, { onConflict: "org_id" });
    setBusy(false);
    if (error) return toast.error(errorText(error));
    toast.success("Previsión guardada."); refresh();
  }
  async function snapshot() {
    const { error } = await supabase.from("forecast_snapshots").insert({ month: today, assumptions: { settings: f, plans } as unknown as Json, summary: fc.summary as unknown as Json });
    if (error) return toast.error(errorText(error));
    toast.success(`Foto de ${monthLabel(today)} guardada: podrás comparar la previsión con lo que pase.`); refresh();
  }
  const setPlan = (id: string, k: keyof PlanAssumption, v: number | null) => setPlans((p) => ({ ...p, [id]: { ...(p[id] ?? BLANK), [k]: v ?? 0 } }));

  return (
    <div className="space-y-6">
      <Card title="Punto de partida" sub="La caja que tienes hoy y cómo quieres ver la previsión.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Caja en el banco"><NumberInput ariaLabel="Caja en el banco" value={f.opening_cash} onChange={(n) => setF({ ...f, opening_cash: n })} /></Field>
          <Field label="A fecha de"><DateField aria-label="Fecha de la caja" value={f.cash_as_of} onChange={(iso) => setF({ ...f, cash_as_of: iso })} /></Field>
          <Field label="Meses a prever (3–36)"><NumberInput ariaLabel="Meses a prever" step="1" value={f.horizon_months} onChange={(n) => setF({ ...f, horizon_months: n })} /></Field>
          <Field label="Descuento por pago anual (%)"><NumberInput ariaLabel="Descuento anual" value={f.annual_discount_pct} onChange={(n) => setF({ ...f, annual_discount_pct: n })} /></Field>
          <Field label="Margen de escenarios (± %)"><NumberInput ariaLabel="Margen de escenarios" value={f.scenario_spread_pct} onChange={(n) => setF({ ...f, scenario_spread_pct: n })} /></Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm"><Checkbox checked={f.include_pipeline} onCheckedChange={(v) => setF({ ...f, include_pipeline: !!v })} />Sumar el pipeline ponderado</label>
        </div>
      </Card>

      <Card title="Planes" sub="Cada plan sale de Productos. Indica cuántos clientes tiene hoy y cómo crees que evoluciona cada mes.">
        {recurring.length === 0 ? (
          <Muted>Aún no hay planes con precio recurrente. Créalos en <Link to="/products" className="underline underline-offset-2">Productos</Link> (o apruébalos en el onboarding) y aparecerán aquí.</Muted>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="text-left text-ink-mid"><th className="py-2 font-normal">Plan</th><th className="font-normal">Clientes hoy</th><th className="font-normal">Altas al mes</th><th className="font-normal">Bajas al mes (%)</th><th className="font-normal">Pagan anual (%)</th></tr></thead>
              <tbody>
                {recurring.map((p) => {
                  const a = plans[p.id] ?? BLANK;
                  return (
                    <tr key={p.id} className="border-t">
                      <td className="py-2 pr-3"><span className="font-medium">{p.name}</span><span className="block text-xs text-muted-foreground">{money(p.price)} {p.billing === "annual" ? "al año" : "al mes"}</span></td>
                      <td className="pr-2"><NumberInput ariaLabel={`Clientes hoy de ${p.name}`} value={a.customers} onChange={(n) => setPlan(p.id, "customers", n)} /></td>
                      <td className="pr-2"><NumberInput ariaLabel={`Altas al mes de ${p.name}`} value={a.adds} onChange={(n) => setPlan(p.id, "adds", n)} /></td>
                      <td className="pr-2"><NumberInput ariaLabel={`Bajas al mes de ${p.name}`} value={a.churn_pct} onChange={(n) => setPlan(p.id, "churn_pct", n)} /></td>
                      <td>{p.billing === "annual" ? <span className="text-xs text-muted-foreground">Plan anual</span> : <NumberInput ariaLabel={`Pagan anual en ${p.name}`} value={a.annual_share_pct} onChange={(n) => setPlan(p.id, "annual_share_pct", n)} />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2"><Button onClick={save} disabled={busy}>Guardar previsión</Button><Button variant="outline" onClick={snapshot}>Guardar foto de este mes</Button></div>
      </Card>

      <Card title="Mes a mes" sub="Ingresos de los planes más el pipeline ponderado (importe anual / 12 × probabilidad desde su fecha de cierre).">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm tabular-nums">
            <thead><tr className="text-left text-ink-mid"><th className="py-2 font-normal">Mes</th><th className="font-normal">Planes</th><th className="font-normal">Pipeline</th><th className="font-normal">Costes</th><th className="font-normal">Neto</th><th className="font-normal">Caja</th></tr></thead>
            <tbody>
              {fc.months.map((m) => (
                <tr key={m.month} className="border-t">
                  <td className="py-1.5">{monthLabel(m.month)}</td><td>{money(m.plans)}</td><td>{money(m.pipeline)}</td><td>{money(m.costs)}</td>
                  <td className={m.net < 0 ? "text-signal" : "text-success"}>{money(m.net)}</td><td className={m.cash.base < 0 ? "text-signal" : ""}>{money(m.cash.base)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {d.snapshots.length > 0 && (
        <Card title="Fotos guardadas" sub="Cómo veías el futuro cada mes, frente a la previsión de hoy.">
          <ul className="space-y-1.5 text-sm">
            {d.snapshots.map((x) => {
              const sm = (x.summary ?? {}) as { mrrEnd?: number; cashEnd?: number };
              return <li key={x.id} className="flex flex-wrap justify-between gap-2 border-b pb-1.5 last:border-0"><span>{monthLabel(x.month)}</span><span className="text-ink-mid">Ingresos al final {money(sm.mrrEnd ?? 0)} (hoy {money(fc.summary.mrrEnd)}) · caja al final {money(sm.cashEnd ?? 0)} (hoy {money(fc.summary.cashEnd)})</span></li>;
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
