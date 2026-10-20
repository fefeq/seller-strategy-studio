import { useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency, useMe } from "@/hooks/use-me";
import { Input } from "@/components/ui/input";
import { Pick } from "@/components/fields";
import { deviation, quarterlyBudget, quartersOfYear, type BudgetField, type SegmentBudgetRow } from "@/lib/segment-budget";
import { errorText } from "@/lib/errors";

const fmt1 = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 1 });
const pct = (n: number | null) => (n == null ? "—" : `${Math.round(n)}%`);

/** Deviation of actual vs plan in %, green when it goes the good way (red otherwise). */
export function Deviation({ real, plan, lowerIsBetter = false, points = false, prefix = "" }: { real: number | null; plan: number | null; lowerIsBetter?: boolean; points?: boolean; prefix?: string }) {
  const d = deviation(real, plan, { lowerIsBetter, points });
  if (!d) return null;
  if (d.good == null) return <span className="text-muted-foreground">{prefix}= presupuesto</span>;
  return <span className={d.good ? "text-success" : "text-signal"}>{prefix}{d.value > 0 ? "+" : ""}{points ? `${fmt1(d.value)} pt` : `${Math.round(d.value)}%`}</span>;
}

/** Plan vs actual per quarter (and year) for one segment: revenue, cost to serve, acquisition, CAC and payback. */
export function BudgetQuarters() {
  const { money } = useCurrency();
  const { data: me } = useMe();
  const orgId = me?.currentOrg?.org_id;
  const canEdit = !!me?.roles.some((r) => r === "owner" || r === "sales_leader");
  const qc = useQueryClient();
  const now = new Date().getFullYear();
  const [year, setYear] = useState(String(now));
  const [segId, setSegId] = useState("");
  // On a phone the table shows one quarter (or the year) at a time; from md every column is visible.
  const [mq, setMq] = useState("");
  const y = Number(year);
  const { data } = useQuery({
    queryKey: ["segment-coverage", orgId, "budget-quarters-tab", y],
    enabled: !!orgId,
    queryFn: async () => {
      const [s, d, b, c] = await Promise.all([
        supabase.from("segments").select("id,name,acv_min,acv_max,win_rate_target,cac_target,gross_margin_pct,payback_months").order("acv_min"),
        supabase.from("deals").select("segment_id,amount,stage,close_date,closed_at,updated_at,created_at"),
        supabase.from("segment_budget_quarters").select("*").in("period", quartersOfYear(y)),
        supabase.from("cac_costs").select("segment_id,channel,amount,period").in("period", quartersOfYear(y)),
      ]);
      return { segments: s.data ?? [], deals: d.data ?? [], rows: b.data ?? [], costs: c.data ?? [] };
    },
  });
  const qb = useMemo(() => (data ? quarterlyBudget(data.segments, data.deals, data.rows, data.costs, y) : null), [data, y]);
  const segments = data?.segments ?? [];
  const sel = segId || segments[0]?.id || "";
  const i = segments.findIndex((s) => s.id === sel);
  const cols: { key: string; label: string; r: SegmentBudgetRow | undefined; editable: boolean }[] = qb && i >= 0
    ? [...qb.quarters.map((q) => ({ key: q, label: q.slice(5), r: qb.byQuarter[q][i], editable: canEdit })), { key: "year", label: `Año ${y}`, r: qb.year[i], editable: false }]
    : [];

  async function save(period: string, field: BudgetField, value: string, current: number | null) {
    const v = value === "" ? null : Number(value);
    if (v != null && (!Number.isFinite(v) || v < 0)) return toast.error("Introduce un importe válido.");
    if (field === "plan_new_customers" && v != null && !Number.isInteger(v)) return toast.error("Los clientes deben ser un número entero.");
    if (v === current) return;
    const { error } = await supabase.from("segment_budget_quarters").upsert(
      { org_id: orgId!, segment_id: sel, period, [field]: v } as { org_id: string; segment_id: string; period: string } & Partial<Record<BudgetField, number | null>>,
      { onConflict: "org_id,segment_id,period" },
    );
    if (error) return toast.error(errorText(error));
    qc.invalidateQueries({ queryKey: ["segment-coverage"] });
  }

  const cell = (col: (typeof cols)[number], field: BudgetField, value: number | null, label: string) =>
    col.editable
      ? <Input type="number" min={0} aria-label={`${label} · ${col.key}`} className="ml-auto h-10 w-24 px-1 text-right md:h-7 md:w-[4.75rem] md:text-[11px] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" key={`${sel}-${col.key}-${field}-${value ?? ""}`} defaultValue={value ?? ""} placeholder="—" onBlur={(e) => save(col.key, field, e.target.value, value)} />
      : <span className="font-mono text-xs">{value == null ? "—" : field === "plan_new_customers" ? String(value) : money(value)}</span>;
  const val = (v: string, strong = false) => <span className={`font-mono text-xs ${strong ? "font-medium" : ""}`}>{v}</span>;
  const pb = (n: number | null, ok: boolean | null) => (n == null ? val("—") : <span className={`font-mono text-xs font-medium ${ok === false ? "text-signal" : ok ? "text-success" : ""}`}>{fmt1(n)} m</span>);

  type Line = { label: string; plan: (c: (typeof cols)[number]) => ReactNode; real: (c: (typeof cols)[number]) => ReactNode; dev: (r: SegmentBudgetRow) => ReactNode; strong?: boolean };
  const lines: Line[] = [
    { label: "Ingresos", plan: (c) => cell(c, "plan_revenue", c.r!.plan.revenue, "Ingresos presupuestados"), real: (c) => cell(c, "actual_revenue", c.r!.actual.revenue, "Ingresos reales"), dev: (r) => <Deviation real={r.actual.revenue} plan={r.plan.revenue} /> },
    { label: "Coste de servir", plan: (c) => cell(c, "plan_cost_to_serve", c.r!.plan.costToServe, "Coste de servir presupuestado"), real: (c) => cell(c, "actual_cost_to_serve", c.r!.actual.costToServe, "Coste de servir real"), dev: (r) => <Deviation real={r.actual.costToServe} plan={r.plan.costToServe} lowerIsBetter /> },
    { label: "Margen bruto", plan: (c) => val(pct(c.r!.plan.margin)), real: (c) => val(pct(c.r!.actual.margin)), dev: (r) => <Deviation real={r.actual.margin} plan={r.plan.margin} points /> },
    { label: "Gasto de captación", plan: (c) => cell(c, "plan_acquisition", c.r!.plan.acquisition, "Gasto de captación presupuestado"), real: (c) => val(c.r!.actual.acquisition ? money(c.r!.actual.acquisition) : "—"), dev: (r) => <Deviation real={r.actual.acquisition || null} plan={r.plan.acquisition} lowerIsBetter /> },
    { label: "Clientes nuevos", plan: (c) => cell(c, "plan_new_customers", c.r!.plan.newCustomers, "Clientes nuevos presupuestados"), real: (c) => val(String(c.r!.actual.newCustomers)), dev: (r) => <Deviation real={r.actual.newCustomers} plan={r.plan.newCustomers} /> },
    { label: "CAC", plan: (c) => val(c.r!.plan.cac != null ? money(c.r!.plan.cac) : "—"), real: (c) => val(c.r!.actual.cac != null ? money(c.r!.actual.cac) : "—"), dev: (r) => <Deviation real={r.actual.cac} plan={r.plan.cac} lowerIsBetter /> },
    { label: "Payback", plan: (c) => pb(c.r!.plan.payback, c.r!.payback.planOk), real: (c) => pb(c.r!.actual.payback, c.r!.payback.realOk), dev: (r) => <Deviation real={r.actual.payback} plan={r.plan.payback} lowerIsBetter />, strong: true },
  ];
  const yr = qb && i >= 0 ? qb.year[i] : undefined;
  const shownCol = cols.some((c) => c.key === mq) ? mq : (cols.find((c) => c.key === `${y}-Q${Math.floor(new Date().getMonth() / 3) + 1}`) ?? cols[0])?.key;
  const onlyMd = (c: (typeof cols)[number]) => (c.key === shownCol ? "" : "hidden md:table-cell");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <h3 className="text-2xl">Presupuesto vs real por trimestre</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Apunta lo presupuestado y lo real de cada trimestre; el año es la suma de los cuatro. El gasto de captación y los clientes reales salen de{" "}
            <Link to="/metrics" className="underline">Métricas</Link> («CAC real» y «Deals ganados»). Debajo de cada cifra real, el desvío: verde si va mejor que el presupuesto, rojo si va peor.
          </p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <div className="min-w-0 flex-1 sm:w-44 sm:flex-none"><Pick value={sel} options={Object.fromEntries(segments.map((s) => [s.id, s.name]))} onChange={setSegId} /></div>
          <div className="w-28"><Pick value={year} options={Object.fromEntries([now - 1, now, now + 1].map((n) => [String(n), String(n)]))} onChange={setYear} /></div>
        </div>
      </div>

      {segments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay segmentos todavía. Créalos en la pestaña «Modelos de venta por segmento».</p>
      ) : (
        <>
          {yr && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Kpi label={`Ingresos ${y}`} v={`${money(yr.actual.revenue ?? 0)}`} sub={<>de {money(yr.plan.revenue ?? 0)}<Deviation prefix=" · " real={yr.actual.revenue} plan={yr.plan.revenue} /></>} />
              <Kpi label="Margen bruto" v={pct(yr.actual.margin)} sub={<>presupuesto {pct(yr.plan.margin)}<Deviation prefix=" · " real={yr.actual.margin} plan={yr.plan.margin} points /></>} />
              <Kpi label="Gasto de captación" v={money(yr.actual.acquisition)} sub={<>de {money(yr.plan.acquisition ?? 0)}<Deviation prefix=" · " real={yr.actual.acquisition || null} plan={yr.plan.acquisition} lowerIsBetter /></>} />
              <Kpi label="Payback" v={yr.actual.payback != null ? `${fmt1(yr.actual.payback)} m` : "—"} sub={<>presupuesto {yr.plan.payback != null ? `${fmt1(yr.plan.payback)} m` : "—"} · objetivo {yr.payback.target != null ? `${yr.payback.target} m` : "—"}</>} />
            </div>
          )}
          <div className="flex flex-wrap gap-1.5 md:hidden" role="group" aria-label="Trimestre visible">
            {cols.map((c) => (
              <button key={c.key} type="button" onClick={() => setMq(c.key)} aria-pressed={c.key === shownCol} className={`min-h-8 rounded-none border px-3 py-1.5 text-xs ${c.key === shownCol ? "bg-primary text-primary-foreground" : ""}`}>{c.label}</button>
            ))}
          </div>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm md:min-w-[860px]">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="sticky left-0 z-10 bg-background px-3 py-2 text-left font-normal" rowSpan={2}>Concepto</th>
                  {cols.map((c) => <th key={c.key} colSpan={2} className={`px-2 pt-2 text-center font-normal ${onlyMd(c)} ${c.key === "year" ? "bg-muted/50 text-foreground" : ""}`}>{c.label}</th>)}
                </tr>
                <tr className="border-b text-[11px] text-muted-foreground">
                  {cols.map((c) => [
                    <th key={`${c.key}-p`} className={`px-1 pb-2 text-right font-normal ${onlyMd(c)} ${c.key === "year" ? "bg-muted/50" : ""}`}>Presup.</th>,
                    <th key={`${c.key}-r`} className={`px-1 pb-2 text-right font-normal ${onlyMd(c)} ${c.key === "year" ? "bg-muted/50" : ""}`}>Real</th>,
                  ])}
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.label} className={`border-b last:border-0 ${l.strong ? "font-medium" : ""}`}>
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-background px-3 py-2 text-xs">{l.label}</td>
                    {cols.map((c) => [
                      <td key={`${c.key}-p`} className={`px-1 py-1.5 text-right align-top ${onlyMd(c)} ${c.key === "year" ? "bg-muted/50" : ""}`}>{c.r && l.plan(c)}</td>,
                      <td key={`${c.key}-r`} className={`px-1 py-1.5 text-right align-top ${onlyMd(c)} ${c.key === "year" ? "bg-muted/50" : ""}`}>
                        {c.r && l.real(c)}
                        <div className="mt-0.5 font-mono text-[10px]">{c.r && l.dev(c.r)}</div>
                      </td>,
                    ])}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Payback = CAC / (ACV del segmento × margen / 12). El presupuestado usa el margen presupuestado; el real usa el margen real del trimestre (o del año si el trimestre no lo tiene).
            {yr?.payback.target != null && ` Objetivo del segmento: ${yr.payback.target} meses.`}
            {!canEdit && " Solo Owner y Sales Leader pueden editar el presupuesto."}
          </p>
        </>
      )}
    </div>
  );
}

function Kpi({ label, v, sub }: { label: string; v: string; sub: ReactNode }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <p className="eyebrow text-[10px]">{label}</p>
      <p className="font-display text-2xl">{v}</p>
      <p className="text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}
