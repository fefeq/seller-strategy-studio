import type { ReactNode } from "react";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency, useMe } from "@/hooks/use-me";
import { quartersUpTo } from "@/lib/cac";
import { quarterKpis, type KpiSide, type PaybackBasis, type QuarterKpis } from "@/lib/quarter-kpis";
import { Deviation } from "@/components/budget-quarters";
import { ScreenState } from "@/components/page";
import type { SegLike } from "@/lib/segment-coverage";
import { DataMark } from "@/components/metrics/data-mark";

const fmt1 = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 1 });
const pct = (n: number | null) => (n == null ? "—" : `${fmt1(n)}%`);

type Line = {
  label: string;
  value: (s: KpiSide) => number | null;
  show: (n: number | null) => string;
  lowerIsBetter?: boolean;
  points?: boolean;
  hint?: (k: QuarterKpis) => ReactNode;
  /** The weighted payback: labelled by quarterKpis().paybackBasis (SDD-20261106-metrics-honest-data CA-7). */
  payback?: true;
};

/** sin_dato: a weighted segment has margin ≤ 0, so the figure (Infinity or negative) is never shown. */
function basisMark(b: PaybackBasis) {
  if (b === "sin_dato")
    return <DataMark state="sin_dato" reason="un segmento tiene margen 0 % o negativo" />;
  if (b === "estimado") return <DataMark state="estimado" reason="supuestos en algún segmento" />;
  return null;
}

/** «CAC real» lives in Métricas › CAC y presupuesto (CA-11). */
function CacRealLink() {
  return (
    <Link to="/metrics" search={{ seccion: "economia" }} className="underline">
      CAC real
    </Link>
  );
}

/** Company KPIs for the selected quarter and the three before it: real vs plan, deviations in green/red. */
export function QuarterKpisPanel({ quarter }: { quarter: string }) {
  const { money } = useCurrency();
  const { data: me } = useMe();
  const orgId = me?.currentOrg?.org_id;
  const quarters = useMemo(() => quartersUpTo(quarter, 4), [quarter]);
  const years = [...new Set(quarters.map((q) => Number(q.slice(0, 4))))];

  const { data, isPending, error, refetch } = useQuery({
    // "segment-coverage" is refreshed live when deals change (useLivePipeline) and when budgets/costs are saved.
    queryKey: ["segment-coverage", orgId, "quarter-kpis", quarter],
    enabled: !!orgId,
    queryFn: async () => {
      const [s, d, b, c] = await Promise.all([
        supabase
          .from("segments")
          .select(
            "id,name,acv_min,acv_max,win_rate_target,cac_target,gross_margin_pct,payback_months",
          )
          .order("acv_min"),
        supabase
          .from("deals")
          .select("segment_id,amount,stage,close_date,closed_at,updated_at,created_at"),
        supabase
          .from("segment_budget_quarters")
          .select("*")
          .in(
            "period",
            years.flatMap((y) => [1, 2, 3, 4].map((n) => `${y}-Q${n}`)),
          ),
        supabase
          .from("cac_costs")
          .select("segment_id,channel,amount,period")
          .in("period", quarters),
      ]);
      const failed = s.error ?? d.error ?? b.error ?? c.error;
      if (failed) throw failed;
      return {
        segments: (s.data ?? []) as SegLike[],
        deals: d.data ?? [],
        budgets: b.data ?? [],
        costs: c.data ?? [],
      };
    },
  });
  const kpis = useMemo(
    () => (data ? quarterKpis(data.segments, data.deals, data.budgets, data.costs, quarters) : []),
    [data, quarters],
  );
  const current = kpis[kpis.length - 1];

  const money0 = (n: number | null) => (n == null ? "—" : money(n));
  const lines: Line[] = [
    {
      label: "Ingresos",
      value: (s) => s.revenue,
      show: money0,
      hint: (k) => (k.actual.wonAmount ? `${money(k.actual.wonAmount)} ganado en deals` : null),
    },
    { label: "Coste de servir", value: (s) => s.costToServe, show: money0, lowerIsBetter: true },
    { label: "Margen bruto", value: (s) => s.margin, show: pct, points: true },
    { label: "Gasto de captación", value: (s) => s.acquisition, show: money0, lowerIsBetter: true },
    {
      label: "Clientes nuevos",
      value: (s) => s.newCustomers,
      show: (n) => (n == null ? "—" : String(n)),
    },
    { label: "CAC", value: (s) => s.cac, show: money0, lowerIsBetter: true },
    {
      label: "Payback",
      value: (s) => s.payback,
      show: (n) => (n == null ? "—" : `${fmt1(n)} m`),
      lowerIsBetter: true,
      payback: true,
    },
  ];

  if (data && data.segments.length === 0) {
    return (
      <section className="rounded-lg border bg-card p-5">
        <h3 className="text-2xl">KPIs trimestrales</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Crea tus segmentos en{" "}
          <Link to="/strategy" className="underline">
            Estrategia GTM
          </Link>{" "}
          para ver ingresos, coste de servir, CAC y payback por trimestre.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <h3 className="text-2xl">KPIs trimestrales</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Toda la empresa, real frente a presupuesto. Ingresos y coste de servir salen de lo
            apuntado en{" "}
            <Link to="/strategy" search={{ tab: "budget" }} className="underline">
              Estrategia GTM → Presupuesto vs real
            </Link>
            ; el CAC, de los costes de «<CacRealLink />» entre los deals ganados del trimestre; el
            payback es la media de los segmentos ponderada por clientes. Verde = mejor que el plan;
            rojo = peor.
          </p>
        </div>
        {current && (
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-right text-sm">
            <Headline label={`CAC ${quarter}`} value={money0(current.actual.cac)} />
            <Headline
              label={`Payback ${quarter}`}
              value={
                current.actual.payback == null || current.paybackBasis.actual === "sin_dato"
                  ? "—"
                  : `${fmt1(current.actual.payback)} m`
              }
              mark={basisMark(current.paybackBasis.actual)}
            />
          </div>
        )}
      </div>

      <ScreenState isPending={isPending} error={error} refetch={refetch} skeleton="table">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="sticky left-0 z-10 bg-background py-2.5 pr-4 font-normal">KPI</th>
                {quarters.map((q) => (
                  <th
                    key={q}
                    className={`px-3 py-2.5 text-right font-normal ${q === quarter ? "text-foreground" : ""}`}
                  >
                    {q}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.label} className="border-b align-top last:border-0">
                  <td className="sticky left-0 z-10 bg-background py-3 pr-4 font-medium">
                    {l.label}
                  </td>
                  {kpis.map((k) => {
                    const hideReal = l.payback && k.paybackBasis.actual === "sin_dato";
                    const hidePlan = l.payback && k.paybackBasis.plan === "sin_dato";
                    const real = hideReal ? null : l.value(k.actual),
                      plan = l.value(k.plan);
                    const hint = l.payback ? basisMark(k.paybackBasis.actual) : l.hint?.(k);
                    return (
                      <td
                        key={k.quarter}
                        className={`px-3 py-3 text-right ${k.quarter === quarter ? "bg-muted/40" : ""}`}
                      >
                        <p className="font-mono">{l.show(real)}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {hidePlan ? (
                            "plan —"
                          ) : plan != null ? (
                            <>
                              plan {l.show(plan)} ·{" "}
                              <Deviation
                                real={real}
                                plan={plan}
                                lowerIsBetter={l.lowerIsBetter}
                                points={l.points}
                              />
                            </>
                          ) : (
                            "sin plan"
                          )}
                        </p>
                        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {current && current.actual.cac == null && (
          <p className="mt-3 text-xs text-muted-foreground">
            Para tener CAC y payback reales en {quarter} hacen falta costes en «<CacRealLink />» y
            deals ganados en ese trimestre.
          </p>
        )}
      </ScreenState>
    </section>
  );
}

function Headline({ label, value, mark }: { label: string; value: string; mark?: ReactNode }) {
  return (
    <div>
      <p className="font-display text-2xl">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
      {mark && <p className="text-xs text-muted-foreground">{mark}</p>}
    </div>
  );
}
