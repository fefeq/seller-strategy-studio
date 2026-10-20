import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency, useMe } from "@/hooks/use-me";
import { Input } from "@/components/ui/input";
import { quartersOfYear, segmentBudget, type SegmentBudgetRow } from "@/lib/segment-budget";

type Field = "plan_revenue" | "plan_cost_to_serve" | "plan_acquisition" | "plan_new_customers" | "actual_revenue" | "actual_cost_to_serve";

const fmt1 = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 1 });
const pct = (n: number | null) => (n == null ? "—" : `${Math.round(n)}%`);

/** Annual plan vs actual per segment (revenue, cost to serve, acquisition) → real margin and payback. */
export function BudgetPanel({ year }: { year: number }) {
  const { money } = useCurrency();
  const { data: me } = useMe();
  const orgId = me?.currentOrg?.org_id;
  const canEdit = !!me?.roles.some((r) => r === "owner" || r === "sales_leader");
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["segment-coverage", orgId, "budget-panel", year],
    enabled: !!orgId,
    queryFn: async () => {
      const [s, d, b, c] = await Promise.all([
        supabase.from("segments").select("id,name,acv_min,acv_max,win_rate_target,cac_target,gross_margin_pct,payback_months").order("acv_min"),
        supabase.from("deals").select("segment_id,amount,stage,close_date,closed_at,updated_at,created_at"),
        supabase.from("segment_budgets").select("*").eq("year", year),
        supabase.from("cac_costs").select("segment_id,channel,amount,period").in("period", quartersOfYear(year)),
      ]);
      return { segments: s.data ?? [], deals: d.data ?? [], budgets: b.data ?? [], costs: c.data ?? [] };
    },
  });
  const rows = useMemo(() => (data ? segmentBudget(data.segments, data.deals, data.budgets, data.costs, year) : []), [data, year]);
  const sum = (f: (r: SegmentBudgetRow) => number | null) => rows.reduce((s, r) => s + (f(r) ?? 0), 0);
  const planRev = sum((r) => r.plan.revenue), realRev = sum((r) => r.actual.revenue);
  const realCost = sum((r) => r.actual.costToServe);
  const realMargin = realRev ? ((realRev - realCost) / realRev) * 100 : null;

  async function save(segmentId: string, field: Field, value: string, current: number | null) {
    const v = value === "" ? null : Number(value);
    if (v != null && (!Number.isFinite(v) || v < 0)) return toast.error("Introduce un importe válido");
    if (field === "plan_new_customers" && v != null && !Number.isInteger(v)) return toast.error("Los clientes deben ser un número entero");
    if (v === current) return;
    const { error } = await supabase.from("segment_budgets").upsert(
      { org_id: orgId!, segment_id: segmentId, year, [field]: v } as { org_id: string; segment_id: string; year: number } & Partial<Record<Field, number | null>>,
      { onConflict: "org_id,segment_id,year" },
    );
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["segment-coverage"] });
  }

  return (
    <section className="rounded-lg border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <h3 className="text-2xl">Presupuesto por segmento · {year}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Apunta lo presupuestado y lo real del año: ingresos, coste de servir (soporte, infraestructura, éxito de cliente) y gasto de captación.
            El margen real (ingresos − coste de servir) sustituye al margen objetivo en todos los paybacks; el gasto y los clientes reales salen de «CAC real» y de los deals ganados.
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
      <div className="grid gap-4 lg:grid-cols-2">
        {rows.map((r) => <BudgetCard key={r.segment.id} r={r} year={year} money={money} canEdit={canEdit} onSave={(f, v, cur) => save(r.segment.id, f, v, cur)} />)}
      </div>
      {!canEdit && <p className="mt-3 text-xs text-muted-foreground">Solo Owner y Sales Leader pueden editar el presupuesto.</p>}
    </section>
  );
}

function BudgetCard({ r, year, money, canEdit, onSave }: { r: SegmentBudgetRow; year: number; money: (n: number) => string; canEdit: boolean; onSave: (f: Field, v: string, current: number | null) => void }) {
  const input = (field: Field, value: number | null, label: string) =>
    canEdit
      ? <Input type="number" min={0} aria-label={`${label} · ${r.segment.name}`} className="ml-auto h-7 w-24 text-right text-xs" key={`${field}-${year}-${value ?? ""}`} defaultValue={value ?? ""} placeholder="—" onBlur={(e) => onSave(field, e.target.value, value)} />
      : <span className="font-mono text-xs">{value == null ? "—" : field === "plan_new_customers" ? value : money(value)}</span>;
  const auto = (v: string) => <span className="font-mono text-xs">{v}</span>;
  const dev = (real: number | null, plan: number | null, lowerIsBetter = false) => {
    if (real == null || !plan) return <span className="text-muted-foreground">—</span>;
    const d = (real - plan) / plan;
    const good = lowerIsBetter ? d <= 0 : d >= 0;
    return <span className={good ? "text-success" : "text-signal"}>{d > 0 ? "+" : ""}{Math.round(d * 100)}%</span>;
  };
  const pb = (n: number | null, ok: boolean | null) => (n == null ? "—" : <span className={ok === false ? "text-signal" : ok ? "text-success" : ""}>{fmt1(n)} m</span>);
  const rowsDef: [string, React.ReactNode, React.ReactNode, React.ReactNode][] = [
    ["Ingresos anuales", input("plan_revenue", r.plan.revenue, "Ingresos presupuestados"), input("actual_revenue", r.actual.revenue, "Ingresos reales"), dev(r.actual.revenue, r.plan.revenue)],
    ["Coste de servir", input("plan_cost_to_serve", r.plan.costToServe, "Coste de servir presupuestado"), input("actual_cost_to_serve", r.actual.costToServe, "Coste de servir real"), dev(r.actual.costToServe, r.plan.costToServe, true)],
    ["Margen bruto", auto(pct(r.plan.margin)), auto(pct(r.actual.margin)), r.actual.margin != null && r.plan.margin != null ? <span className={r.actual.margin >= r.plan.margin ? "text-success" : "text-signal"}>{r.actual.margin >= r.plan.margin ? "+" : ""}{fmt1(r.actual.margin - r.plan.margin)} pt</span> : <span className="text-muted-foreground">—</span>],
    ["Gasto de captación", input("plan_acquisition", r.plan.acquisition, "Gasto de captación presupuestado"), auto(r.actual.acquisition ? money(r.actual.acquisition) : "—"), dev(r.actual.acquisition || null, r.plan.acquisition, true)],
    ["Clientes nuevos", input("plan_new_customers", r.plan.newCustomers, "Clientes nuevos presupuestados"), auto(String(r.actual.newCustomers)), dev(r.actual.newCustomers, r.plan.newCustomers)],
    ["CAC", auto(r.plan.cac != null ? money(r.plan.cac) : "—"), auto(r.actual.cac != null ? money(r.actual.cac) : "—"), dev(r.actual.cac, r.plan.cac, true)],
  ];
  return (
    <div className="rounded-md border p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{r.segment.name}</p>
          <p className="text-[11px] text-muted-foreground">ACV {money(r.acv)} · margen usado en el payback: {pct(r.margin.pct)} {r.margin.source === "real" ? "(real)" : r.margin.source === "plan" ? "(presupuestado)" : r.margin.source === "objetivo" ? "(objetivo)" : ""}</p>
        </div>
      </div>
      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] text-muted-foreground">
            <th className="py-1 font-normal" />
            <th className="py-1 text-right font-normal">Presupuesto</th>
            <th className="py-1 text-right font-normal">Real</th>
            <th className="py-1 pl-2 text-right font-normal">Desvío</th>
          </tr>
        </thead>
        <tbody>
          {rowsDef.map(([label, plan, real, d]) => (
            <tr key={label} className="border-t border-dashed">
              <td className="py-1 pr-2 text-xs">{label}</td>
              <td className="py-1 text-right">{plan}</td>
              <td className="py-1 text-right">{real}</td>
              <td className="whitespace-nowrap py-1 pl-2 text-right font-mono text-xs">{d}</td>
            </tr>
          ))}
          <tr className="border-t font-medium">
            <td className="py-1.5 pr-2 text-xs">Payback</td>
            <td className="py-1.5 text-right font-mono text-xs">{pb(r.plan.payback, r.payback.planOk)}</td>
            <td className="py-1.5 text-right font-mono text-xs">{pb(r.actual.payback, r.payback.realOk)}</td>
            <td className="whitespace-nowrap py-1.5 pl-2 text-right font-mono text-xs text-muted-foreground">{r.payback.target != null ? `obj. ${r.payback.target} m` : "sin obj."}</td>
          </tr>
        </tbody>
      </table>
      {r.actual.payback == null && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          {r.actual.acquisition > 0 ? `Hay gasto de captación en ${year} pero ningún deal ganado: aún no hay payback real.` : <>Para el payback real, apunta el gasto en «CAC real» y gana algún deal en {year}.</>}
        </p>
      )}
    </div>
  );
}
