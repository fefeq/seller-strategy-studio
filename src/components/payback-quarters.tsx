import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency, useMe } from "@/hooks/use-me";
import { Pick } from "@/components/fields";
import { quarterOf, quarterRange } from "@/lib/metrics";
import { quartersUpTo } from "@/lib/cac";
import { paybackByQuarter, type QuarterPayback, type SegLike } from "@/lib/segment-coverage";
import type { QuarterBudgetLike } from "@/lib/segment-budget";
import { DataMark } from "@/components/metrics/data-mark";
import { FigureNote, FigureValue } from "@/components/metrics/figure";
import { figureTone, inferredMark } from "@/components/metrics/mark-text";

const fmt1 = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 1 });

/** Segments, won deals, costs and budget margins of the last `count` quarters → real payback per segment and quarter. */
export function usePaybackQuarters(count: number) {
  const { data: me } = useMe();
  const orgId = me?.currentOrg?.org_id;
  const thisQuarter = quarterOf(new Date());
  const quarters = useMemo(() => quartersUpTo(thisQuarter, count), [thisQuarter, count]);
  const { data: segs = [] } = useQuery({
    queryKey: ["segments"],
    queryFn: async () => (await supabase.from("segments").select("*").order("acv_min")).data ?? [],
  });
  const { data: deals = [] } = useQuery({
    queryKey: ["deals-real"],
    queryFn: async () =>
      (
        await supabase
          .from("deals")
          .select("segment_id,amount,stage,close_date,closed_at,updated_at,created_at,gross_margin")
      ).data ?? [],
  });
  const { data: costs = [] } = useQuery({
    queryKey: ["segment-coverage", orgId, "payback-quarters", count],
    enabled: !!orgId,
    queryFn: async () =>
      (
        await supabase
          .from("cac_costs")
          .select("segment_id,channel,amount,period")
          .in("period", quarters)
      ).data ?? [],
  });
  const years = [...new Set(quarters.map((q) => Number(q.slice(0, 4))))];
  const { data: budgets = [] } = useQuery({
    queryKey: ["segment-coverage", orgId, "budget-quarters", years.join()],
    enabled: !!orgId,
    queryFn: async () =>
      (
        await supabase
          .from("segment_budget_quarters")
          .select("*")
          .in(
            "period",
            years.flatMap((y) => [1, 2, 3, 4].map((n) => `${y}-Q${n}`)),
          )
      ).data ?? [],
  });
  const rows = useMemo(
    () =>
      // One margin chain (SDD-20261109 D15): budget rows and the deals' margins, inside paybackByQuarter.
      paybackByQuarter(
        segs as SegLike[],
        deals,
        costs,
        quarters,
        quarterRange,
        budgets as QuarterBudgetLike[],
      ),
    [segs, deals, costs, budgets, quarters],
  );
  return { quarters, rows, segs };
}

/** Real payback per segment and quarter (real CAC only) against each segment's target payback. */
export function PaybackQuarters() {
  const { money } = useCurrency();
  const [count, setCount] = useState("4");
  const { quarters, rows, segs } = usePaybackQuarters(Number(count));
  const anyReal = rows.some((r) =>
    Object.values(r.byQuarter).some((c) => c.figures.payback.value != null),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <h3 className="text-2xl">Payback real por trimestre</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Meses que tarda cada segmento en recuperar lo que cuesta captar un cliente: CAC real del
            trimestre (costes de Métricas / deals ganados) entre el margen mensual del ACV del
            segmento. El margen sale, por este orden, del presupuesto real del trimestre o del año,
            de los deals ganados con líneas, del presupuesto planificado y del margen objetivo del
            segmento. Sin ninguno, no hay payback. Verde = dentro del objetivo; rojo = fuera.
          </p>
        </div>
        <div className="w-full sm:w-44">
          <Pick
            value={count}
            options={{ "4": "Últimos 4 trimestres", "8": "Últimos 8 trimestres" }}
            onChange={setCount}
          />
        </div>
      </div>

      {segs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay segmentos todavía. Créalos en la pestaña «Modelos de venta por segmento».
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="sticky left-0 z-10 bg-background px-4 py-2.5 font-normal">
                  Segmento
                </th>
                {quarters.map((q) => (
                  <th key={q} className="px-3 py-2.5 text-right font-normal">
                    {q}
                  </th>
                ))}
                <th className="px-4 py-2.5 text-right font-normal">Objetivo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.segment.id} className="border-b last:border-0">
                  <td className="sticky left-0 z-10 bg-background px-4 py-3 font-medium">
                    {r.segment.name}
                  </td>
                  {quarters.map((q) => (
                    <Cell key={q} c={r.byQuarter[q]} target={r.target} money={money} />
                  ))}
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {r.target != null ? (
                      `${r.target} m`
                    ) : (
                      <span className="text-muted-foreground">sin objetivo</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!anyReal && segs.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Aún no hay payback real en ningún trimestre: hace falta apuntar costes en{" "}
          <Link to="/metrics" className="underline">
            Métricas → CAC real
          </Link>{" "}
          y tener deals ganados en ese mismo trimestre.
        </p>
      )}
    </div>
  );
}

export function Cell({
  c,
  target,
  money,
}: {
  c: QuarterPayback;
  target: number | null;
  money: (n: number) => string;
}) {
  const f = c.figures.payback;
  if (f.value == null) {
    // SDD-20261109 CA-7: «Sin dato · motivo», never a bare dash nor «sin costes» alone; the spend goes to the hint.
    return (
      <td className="px-3 py-3 text-right">
        <FigureValue f={f} show={() => null} className="text-xs" />
        {c.cost > 0 && (
          <p className="text-xs text-muted-foreground">
            {money(c.cost)} gastado · {c.customers} {c.customers === 1 ? "ganado" : "ganados"}
          </p>
        )}
      </td>
    );
  }
  const tone = figureTone(f, c.ok);
  const diff = target != null ? f.value - target : null;
  return (
    <td className="px-3 py-3 text-right">
      <p className={`font-display text-[22px] leading-7 ${tone}`}>{fmt1(f.value)} m</p>
      <p className="text-xs text-muted-foreground">
        CAC {money(Math.round(c.cac ?? 0))} · {c.customers}{" "}
        {c.customers === 1 ? "ganado" : "ganados"}
        {diff != null && tone && (
          <span className={tone}>
            {" "}
            · {diff > 0 ? "+" : ""}
            {fmt1(diff)} m
          </span>
        )}
      </p>
      <FigureNote f={f} className="block text-xs text-muted-foreground" />
      {c.inferredWon > 0 && (
        <DataMark
          {...inferredMark(c.inferredWon, c.wonInQuarter)}
          className="block text-xs text-muted-foreground"
        />
      )}
    </td>
  );
}
