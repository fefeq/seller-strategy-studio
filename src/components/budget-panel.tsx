import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useCurrency, useMe } from "@/hooks/use-me";
import { supabase } from "@/integrations/supabase/client";
import { annualFromQuarters, quartersOfYear, segmentBudget, type SegmentBudgetRow } from "@/lib/segment-budget";
import { Deviation } from "@/components/budget-quarters";
import { ScreenState } from "@/components/page";
import { DataMark } from "@/components/metrics/data-mark";
import { MARGIN_ASSUMED, MARGIN_NON_POSITIVE, SHARED_EQUAL, acvMark, inferredMark } from "@/components/metrics/mark-text";

const fmt1 = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 1 });
const pct = (n: number | null) => (n == null ? "—" : `${Math.round(n)}%`);

/** Annual plan vs actual per segment (sum of the quarters entered in Estrategia GTM) → real margin and payback. */
export function BudgetPanel({ year }: { year: number }) {
  const { money } = useCurrency();
  const { data: me } = useMe();
  const orgId = me?.currentOrg?.org_id;
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["segment-coverage", orgId, "budget-panel", year],
    enabled: !!orgId,
    queryFn: async () => {
      const [s, d, b, c] = await Promise.all([
        supabase.from("segments").select("id,name,acv_min,acv_max,win_rate_target,cac_target,gross_margin_pct,payback_months").order("acv_min"),
        supabase.from("deals").select("segment_id,amount,stage,close_date,closed_at,updated_at,created_at"),
        supabase.from("segment_budget_quarters").select("*").in("period", quartersOfYear(year)),
        supabase.from("cac_costs").select("segment_id,channel,amount,period").in("period", quartersOfYear(year)),
      ]);
      const failed = s.error ?? d.error ?? b.error ?? c.error;
      if (failed) throw failed;
      return { segments: s.data ?? [], deals: d.data ?? [], budgets: annualFromQuarters(b.data ?? [], year), costs: c.data ?? [] };
    },
  });
  const rows = useMemo(() => (data ? segmentBudget(data.segments, data.deals, data.budgets, data.costs, year) : []), [data, year]);
  const sum = (f: (r: SegmentBudgetRow) => number | null) => rows.reduce((s, r) => s + (f(r) ?? 0), 0);
  const planRev = sum((r) => r.plan.revenue), realRev = sum((r) => r.actual.revenue);
  // Revenue-weighted average of each segment's margin (already limited to quarters with revenue and cost).
  const withMargin = rows.filter((r) => r.actual.margin != null && r.actual.revenue);
  const weight = withMargin.reduce((s, r) => s + r.actual.revenue!, 0);
  const realMargin = weight ? withMargin.reduce((s, r) => s + r.actual.margin! * r.actual.revenue!, 0) / weight : null;

  return (
    <section className="rounded-lg border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <h3 className="text-2xl">Presupuesto por segmento · {year}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Suma de los cuatro trimestres. Se apunta por trimestre en{" "}
            <Link to="/strategy" search={{ tab: "budget" }} className="underline">Estrategia GTM → Presupuesto vs real</Link>.
            El margen real (ingresos − coste de servir) sustituye al margen objetivo en todos los paybacks.
          </p>
        </div>
        {/* No totals until the budget answers (never a 0 that looks like data). */}
        {data && <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2 text-right text-sm">
          <div>
            <p className="font-mono">{money(realRev)} <span className="text-muted-foreground">/ {money(planRev)}</span></p>
            <p className="text-xs text-muted-foreground">ingresos reales / presupuesto{planRev ? ` · ${Math.round((realRev / planRev) * 100)}%` : ""}</p>
          </div>
          <div>
            <p className="font-mono">{pct(realMargin)}</p>
            <p className="text-xs text-muted-foreground">margen bruto real</p>
          </div>
        </div>}
      </div>
      <ScreenState isPending={isPending} error={error} refetch={refetch} skeleton="table">
      {rows.length === 0 && <p className="text-sm text-muted-foreground">No hay segmentos. Créalos en <Link to="/strategy" className="underline">Estrategia GTM</Link>.</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="sticky left-0 z-10 bg-background py-2 pr-3 font-normal">Segmento</th>
              <th className="px-2 py-2 text-right font-normal">Ingresos</th>
              <th className="px-2 py-2 text-right font-normal">Margen bruto</th>
              <th className="px-2 py-2 text-right font-normal">Gasto de captación</th>
              <th className="px-2 py-2 text-right font-normal">CAC</th>
              <th className="px-2 py-2 text-right font-normal">Payback</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              // Margin 0 % or below: the payback (Infinity or negative) is replaced by «Sin dato», neutral tone.
              const noReal = r.paybackMarginBasis.actual === "no_positivo";
              const noPlan = r.paybackMarginBasis.plan === "no_positivo";
              const acv = acvMark(r.acvSource, r.acvRangeBasis);
              return (
              <tr key={r.segment.id} className="border-b border-dashed align-top">
                <td className="sticky left-0 z-10 max-w-40 bg-background py-2 pr-3 sm:max-w-none">
                  <p className="font-medium">{r.segment.name}</p>
                  <p className="text-[11px] text-muted-foreground">margen en el payback: {pct(r.margin.pct)} {r.margin.source === "real" ? "(real)" : r.margin.source === "plan" ? "(presupuestado)" : r.margin.source === "objetivo" ? "(objetivo)" : ""}</p>
                </td>
                <Cmp real={r.actual.revenue != null ? money(r.actual.revenue) : "—"} plan={r.plan.revenue != null ? money(r.plan.revenue) : "—"} dev={<Deviation real={r.actual.revenue} plan={r.plan.revenue} />} />
                <Cmp real={pct(r.actual.margin)} plan={pct(r.plan.margin)} dev={<Deviation real={r.actual.margin} plan={r.plan.margin} points />} />
                <Cmp real={r.actual.acquisition ? money(r.actual.acquisition) : "—"} plan={r.plan.acquisition != null ? money(r.plan.acquisition) : "—"} dev={<Deviation real={r.actual.acquisition || null} plan={r.plan.acquisition} lowerIsBetter />} marks={r.sharedSplit === "partes_iguales" && <Mark {...SHARED_EQUAL} />} />
                <Cmp real={r.actual.cac != null ? money(r.actual.cac) : "—"} plan={r.plan.cac != null ? money(r.plan.cac) : "—"} dev={<Deviation real={r.actual.cac} plan={r.plan.cac} lowerIsBetter />} marks={r.inferredWonInPeriod > 0 && <Mark {...inferredMark(r.inferredWonInPeriod, r.wonInPeriod)} />} />
                <Cmp
                  real={noReal ? <DataMark {...MARGIN_NON_POSITIVE} /> : r.actual.payback != null ? `${fmt1(r.actual.payback)} m` : "—"}
                  plan={<>{noPlan ? <DataMark {...MARGIN_NON_POSITIVE} /> : r.plan.payback != null ? `${fmt1(r.plan.payback)} m` : "—"}{r.payback.target != null ? ` · obj. ${r.payback.target} m` : ""}</>}
                  dev={noReal || noPlan ? null : <Deviation real={r.actual.payback} plan={r.plan.payback} lowerIsBetter />}
                  tone={noReal ? "" : r.payback.realOk === false ? "text-signal" : r.payback.realOk ? "text-success" : ""}
                  marks={<>
                    {(r.paybackMarginBasis.actual === "supuesto_100" || r.paybackMarginBasis.plan === "supuesto_100") && <Mark {...MARGIN_ASSUMED} />}
                    {(r.actual.payback != null || r.plan.payback != null || r.acvRangeBasis === "sin_rango") && acv && <Mark {...acv} />}
                  </>}
                />
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </ScreenState>
    </section>
  );
}

function Cmp({ real, plan, dev, tone = "", marks }: { real: ReactNode; plan: ReactNode; dev: ReactNode; tone?: string; marks?: ReactNode }) {
  return (
    <td className="px-2 py-2 text-right">
      <p className={`font-mono text-xs ${tone}`}>{real}</p>
      <p className="text-[11px] text-muted-foreground">presup. {plan}</p>
      <p className="font-mono text-[10px]">{dev}</p>
      {marks}
    </td>
  );
}

/** A data mark under a table figure (SDD-20261106-metrics-honest-data CA-5 to CA-8). */
function Mark(p: React.ComponentProps<typeof DataMark>) {
  return <DataMark {...p} className="block text-[10px] text-muted-foreground" />;
}
