import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency, useMe } from "@/hooks/use-me";
import { Pick } from "@/components/fields";
import { quarterOf, quarterRange } from "@/lib/metrics";
import { quartersUpTo } from "@/lib/cac";
import { paybackByQuarter, type QuarterPayback, type SegLike } from "@/lib/segment-coverage";
import { withPeriodMargin } from "@/lib/segment-budget";

const fmt1 = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 1 });

/** Segments, won deals, costs and budget margins of the last `count` quarters → real payback per segment and quarter. */
export function usePaybackQuarters(count: number) {
  const { data: me } = useMe();
  const orgId = me?.currentOrg?.org_id;
  const quarters = quartersUpTo(quarterOf(new Date()), count);
  const { data: segs = [] } = useQuery({ queryKey: ["segments"], queryFn: async () => (await supabase.from("segments").select("*").order("acv_min")).data ?? [] });
  const { data: deals = [] } = useQuery({ queryKey: ["deals-real"], queryFn: async () => (await supabase.from("deals").select("segment_id,amount,stage,close_date,closed_at,updated_at,created_at")).data ?? [] });
  const { data: costs = [] } = useQuery({
    queryKey: ["segment-coverage", orgId, "payback-quarters", count],
    enabled: !!orgId,
    queryFn: async () => (await supabase.from("cac_costs").select("segment_id,channel,amount,period").in("period", quarters)).data ?? [],
  });
  const years = [...new Set(quarters.map((q) => Number(q.slice(0, 4))))];
  const { data: budgets = [] } = useQuery({
    queryKey: ["segment-coverage", orgId, "budget-quarters", years.join()],
    enabled: !!orgId,
    queryFn: async () => (await supabase.from("segment_budget_quarters").select("*").in("period", years.flatMap((y) => [1, 2, 3, 4].map((n) => `${y}-Q${n}`)))).data ?? [],
  });
  const rows = useMemo(
    () => paybackByQuarter(segs as SegLike[], deals, costs, quarters, quarterRange, (q) => withPeriodMargin(segs as SegLike[], budgets, q)),
    [segs, deals, costs, budgets, quarters.join()],
  );
  return { quarters, rows, segs };
}

/** Real payback per segment and quarter (real CAC only) against each segment's target payback. */
export function PaybackQuarters() {
  const { money } = useCurrency();
  const [count, setCount] = useState("4");
  const { quarters, rows, segs } = usePaybackQuarters(Number(count));
  const anyReal = rows.some((r) => Object.values(r.byQuarter).some((c) => c.status === "real"));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <h3 className="text-2xl">Payback real por trimestre</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Meses que tarda cada segmento en recuperar lo que cuesta captar un cliente: CAC real del trimestre (costes de Métricas / deals ganados) entre el margen mensual del ACV del segmento. El margen sale del presupuesto de ese trimestre o de su año (real o, si no hay, presupuestado). Verde = dentro del objetivo; rojo = fuera.
          </p>
        </div>
        <div className="w-44"><Pick value={count} options={{ "4": "Últimos 4 trimestres", "8": "Últimos 8 trimestres" }} onChange={setCount} /></div>
      </div>

      {segs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay segmentos todavía. Créalos en la pestaña «Motions por segmento».</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-4 py-2.5 font-normal">Segmento</th>
                {quarters.map((q) => <th key={q} className="px-3 py-2.5 text-right font-normal">{q}</th>)}
                <th className="px-4 py-2.5 text-right font-normal">Objetivo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.segment.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{r.segment.name}</td>
                  {quarters.map((q) => <Cell key={q} c={r.byQuarter[q]} target={r.target} money={money} />)}
                  <td className="px-4 py-3 text-right font-mono text-xs">{r.target != null ? `${r.target} m` : <span className="text-muted-foreground">sin objetivo</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!anyReal && segs.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Aún no hay payback real en ningún trimestre: hace falta apuntar costes en <Link to="/metrics" className="underline">Métricas → CAC real</Link> y tener deals ganados en ese mismo trimestre.
        </p>
      )}
    </div>
  );
}

export function Cell({ c, target, money }: { c: QuarterPayback; target: number | null; money: (n: number) => string }) {
  if (c.status !== "real" || c.payback == null) {
    return (
      <td className="px-3 py-3 text-right">
        <p className="font-mono text-xs text-muted-foreground">—</p>
        <p className="text-[11px] text-muted-foreground">{c.status === "no_wins" ? `${money(c.cost)} · 0 ganados` : "sin costes"}</p>
      </td>
    );
  }
  const tone = c.ok === false ? "text-signal" : c.ok ? "text-success" : "";
  const diff = target != null ? c.payback - target : null;
  return (
    <td className="px-3 py-3 text-right">
      <p className={`font-display text-xl ${tone}`}>{fmt1(c.payback)} m</p>
      <p className="text-[11px] text-muted-foreground">
        CAC {money(Math.round(c.cac ?? 0))} · {c.customers} {c.customers === 1 ? "ganado" : "ganados"}
        {diff != null && <span className={tone}> · {diff > 0 ? "+" : ""}{fmt1(diff)} m</span>}
      </p>
    </td>
  );
}
