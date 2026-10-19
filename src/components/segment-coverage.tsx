import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency, useMe } from "@/hooks/use-me";
import { Input } from "@/components/ui/input";
import { quarterRange } from "@/lib/metrics";
import { segmentCoverage, type SegmentCoverageRow } from "@/lib/segment-coverage";

const pct = (n: number) => `${Math.round(n * 100)}%`;
const ACV_SOURCE = { ganados: "media de ganados", abiertos: "media de abiertos", rango: "punto medio del rango" };

/** Real coverage, deals, opportunities and payback per segment vs its quarterly target. */
export function SegmentCoverage({ quarter }: { quarter: string }) {
  const { money } = useCurrency();
  const { data: me } = useMe();
  const orgId = me?.currentOrg?.org_id;
  const canEdit = me?.roles.some((r) => r === "owner" || r === "sales_leader");
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["segment-coverage", orgId, quarter],
    enabled: !!orgId,
    queryFn: async () => {
      const [s, d, t] = await Promise.all([
        supabase.from("segments").select("id,name,acv_min,acv_max,win_rate_target,cac_target,gross_margin_pct,payback_months").order("acv_min"),
        supabase.from("deals").select("segment_id,amount,stage,close_date,closed_at,updated_at,created_at"),
        supabase.from("segment_targets").select("segment_id,amount").eq("period", quarter),
      ]);
      return { segments: s.data ?? [], deals: d.data ?? [], targets: Object.fromEntries((t.data ?? []).map((x) => [x.segment_id, Number(x.amount)])) as Record<string, number> };
    },
  });
  const rows = useMemo(() => (data ? segmentCoverage(data.segments, data.deals, data.targets, quarterRange(quarter)) : []), [data, quarter]);
  const total = rows.reduce((a, r) => ({ target: a.target + r.target, pipeline: a.pipeline + r.pipeline, won: a.won + r.won.amount }), { target: 0, pipeline: 0, won: 0 });

  async function setTarget(segmentId: string, amount: number) {
    const { error } = await supabase.from("segment_targets").upsert({ org_id: orgId!, segment_id: segmentId, period: quarter, amount }, { onConflict: "org_id,segment_id,period" });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["segment-coverage"] });
  }

  return (
    <section className="rounded-lg border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-2xl">Cobertura por segmento · {quarter}</h3>
          <p className="mt-1 text-xs text-muted-foreground">Real frente a objetivo. Cobertura = pipeline abierto que cierra este trimestre / objetivo del segmento (sana entre 3x y 4x). Los deals sin segmento se asignan por su importe.</p>
        </div>
        {total.target > 0 && (
          <div className="text-right text-sm">
            <p className="font-mono">{(total.pipeline / total.target).toFixed(1)}x total</p>
            <p className="text-xs text-muted-foreground">{money(total.won)} ganado de {money(total.target)}</p>
          </div>
        )}
      </div>
      {rows.length === 0 && <p className="text-sm text-muted-foreground">No hay segmentos. Créalos en <Link to="/strategy" className="underline">Estrategia GTM</Link>.</p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((r) => <SegmentCard key={r.segment.id} r={r} money={money} canEdit={!!canEdit} quarter={quarter} onTarget={(v) => setTarget(r.segment.id, v)} />)}
      </div>
    </section>
  );
}

function SegmentCard({ r, money, canEdit, quarter, onTarget }: { r: SegmentCoverageRow; money: (n: number) => string; canEdit: boolean; quarter: string; onTarget: (v: number) => void }) {
  const cov = r.coverage;
  const tone = !cov ? "text-muted-foreground" : cov.status === "low" ? "text-signal" : cov.status === "healthy" ? "text-success" : "text-foreground";
  return (
    <div className="rounded-md border p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{r.segment.name}</p>
          <p className="text-[11px] text-muted-foreground">ACV {money(r.acv)} · {ACV_SOURCE[r.acvSource]}</p>
        </div>
        <div className="text-right">
          <p className={`font-display text-3xl ${tone}`}>{cov ? `${cov.ratio.toFixed(1)}x` : "—"}</p>
          <p className={`text-[11px] ${tone}`}>{!cov ? "Sin objetivo" : cov.status === "low" ? "Baja (<3x)" : cov.status === "healthy" ? "Sana (3–4x)" : "Alta (>4x)"}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">Objetivo {quarter}</span>
        {canEdit
          ? <Input type="number" min={0} className="h-8 w-36 text-right" defaultValue={r.target || ""} key={`${r.segment.id}-${quarter}-${r.target}`} placeholder="Importe" onBlur={(e) => e.target.value !== "" && Number(e.target.value) !== r.target && onTarget(Number(e.target.value))} />
          : <span className="font-mono">{r.target ? money(r.target) : "—"}</span>}
      </div>
      <div className="mt-3 space-y-2">
        <Metric label="Pipeline abierto" real={money(r.pipeline)} target={r.target ? money(r.target * 3) + " (3x)" : null} progress={r.target ? r.pipeline / (r.target * 3) : null} />
        <Metric label="Deals ganados" real={`${r.won.deals} · ${money(r.won.amount)}`} target={r.won.target != null ? `${r.won.target} deals` : null} progress={r.won.target ? r.won.deals / r.won.target : null} hint={r.won.attainment != null ? `${pct(r.won.attainment)} del objetivo` : undefined} />
        <Metric label="Oportunidades creadas" real={`${r.opps.created} (${r.opps.open} abiertas)`} target={r.opps.target != null ? `${r.opps.target}` : null} progress={r.opps.target ? r.opps.created / r.opps.target : null} hint={r.opps.target == null && r.target ? "Falta win rate objetivo" : undefined} />
        <Metric label="Win rate" real={r.winRate.real != null ? pct(r.winRate.real) : "—"} target={r.winRate.target != null ? `${r.winRate.target}%` : null} progress={r.winRate.real != null && r.winRate.target ? r.winRate.real / (r.winRate.target / 100) : null} />
        <div className="flex items-center justify-between border-t pt-2 text-sm">
          <span>Payback CAC</span>
          <span className="font-mono text-xs">
            <span className={r.payback.ok === false ? "text-signal" : r.payback.ok ? "text-success" : ""}>{r.payback.real != null ? `${r.payback.real.toFixed(1)} m` : "—"}</span>
            <span className="text-muted-foreground"> / obj. {r.payback.target != null ? `${r.payback.target} m` : "—"}</span>
          </span>
        </div>
        {r.payback.real == null && <p className="text-[11px] text-muted-foreground">Añade el CAC objetivo del segmento para calcular el payback.</p>}
      </div>
    </div>
  );
}

function Metric({ label, real, target, progress, hint }: { label: string; real: string; target: string | null; progress: number | null; hint?: string }) {
  return (
    <div className="text-sm">
      <div className="flex justify-between gap-2"><span>{label}</span><span className="font-mono text-xs">{real}<span className="text-muted-foreground"> / {target ?? "—"}</span></span></div>
      <div className="mt-1 h-1.5 rounded bg-muted"><div className={`h-full rounded ${progress != null && progress >= 1 ? "bg-success" : "bg-primary"}`} style={{ width: `${progress != null ? Math.min(100, Math.round(progress * 100)) : 0}%` }} /></div>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
