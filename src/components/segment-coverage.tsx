import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency, useMe } from "@/hooks/use-me";
import { Input } from "@/components/ui/input";
import { ScreenState } from "@/components/page";
import { quarterRange } from "@/lib/metrics";
import { segmentCoverage, type SegmentCoverageRow } from "@/lib/segment-coverage";
import { quartersOfYear, type MarginSource } from "@/lib/segment-budget";
import { WIN_RATE_WINDOWS } from "@/lib/unit-economics";
import { errorText } from "@/lib/errors";
import { pct } from "@/lib/money";
import { DataMark } from "@/components/metrics/data-mark";
import { figureMark, inferredMark, noClosedDeals } from "@/components/metrics/mark-text";
import { figureTone } from "@/components/metrics/mark-text";
import { FigureNote, FigureValue } from "@/components/metrics/figure";
import { ExplanationFold } from "@/components/explanation-fold";

const MARGIN_LABEL: Record<MarginSource, string> = {
  real: "margen real",
  deals: "margen de los deals ganados",
  plan: "margen presupuestado",
  objetivo: "margen objetivo",
};

/**
 * Segments, deals, targets, acquisition costs and budget rows of a quarter; shared by the coverage and CAC panels.
 * segmentCoverage runs the one margin chain with the budget rows and the deals' margins (SDD-20261109 D15).
 */
export function useSegmentCoverageData(quarter: string) {
  const { data: me } = useMe();
  const orgId = me?.currentOrg?.org_id;
  const year = Number(quarter.slice(0, 4));
  return useQuery({
    queryKey: ["segment-coverage", orgId, quarter],
    enabled: !!orgId,
    queryFn: async () => {
      const [s, d, t, c, b] = await Promise.all([
        supabase
          .from("segments")
          .select(
            "id,name,acv_min,acv_max,win_rate_target,cac_target,gross_margin_pct,payback_months",
          )
          .order("acv_min"),
        supabase
          .from("deals")
          .select(
            "segment_id,amount,stage,close_date,closed_at,updated_at,created_at,gross_margin",
          ),
        supabase.from("segment_targets").select("segment_id,amount").eq("period", quarter),
        supabase.from("cac_costs").select("id,segment_id,channel,amount").eq("period", quarter),
        supabase.from("segment_budget_quarters").select("*").in("period", quartersOfYear(year)),
      ]);
      const failed = s.error ?? d.error ?? t.error ?? c.error ?? b.error;
      if (failed) throw failed;
      return {
        segments: s.data ?? [],
        budgetRows: b.data ?? [],
        deals: d.data ?? [],
        costs: c.data ?? [],
        targets: Object.fromEntries(
          (t.data ?? []).map((x) => [x.segment_id, Number(x.amount)]),
        ) as Record<string, number>,
      };
    },
  });
}

/** Real coverage, deals, opportunities and payback per segment vs its quarterly target. */
export function SegmentCoverage({ quarter }: { quarter: string }) {
  const { money } = useCurrency();
  const { data: me } = useMe();
  const orgId = me?.currentOrg?.org_id;
  const canEdit = me?.roles.some((r) => r === "owner" || r === "sales_leader");
  const qc = useQueryClient();
  const { data, isPending, error, refetch } = useSegmentCoverageData(quarter);
  const rows = useMemo(
    () =>
      data
        ? segmentCoverage(
            data.segments,
            data.deals,
            data.targets,
            quarterRange(quarter),
            data.costs,
            data.budgetRows,
          )
        : [],
    [data, quarter],
  );
  const total = rows.reduce(
    (a, r) => ({
      target: a.target + r.target,
      pipeline: a.pipeline + r.pipeline,
      won: a.won + r.won.amount,
    }),
    { target: 0, pipeline: 0, won: 0 },
  );

  async function setTarget(segmentId: string, amount: number) {
    const { error } = await supabase
      .from("segment_targets")
      .upsert(
        { org_id: orgId!, segment_id: segmentId, period: quarter, amount },
        { onConflict: "org_id,segment_id,period" },
      );
    if (error) return toast.error(errorText(error));
    qc.invalidateQueries({ queryKey: ["segment-coverage"] });
  }

  return (
    <section className="rounded-lg border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-2xl">Cobertura por segmento · {quarter}</h3>
          <ExplanationFold kind="calculo" className="mt-1">
            <p className="text-xs text-muted-foreground">
              Real frente a objetivo. Cobertura = pipeline abierto que cierra este trimestre /
              objetivo del segmento (sana entre 3x y 4x). Los deals sin segmento se asignan por su
              importe.
            </p>
          </ExplanationFold>
        </div>
        {total.target > 0 && (
          <div className="text-right text-sm">
            <p className="font-mono">{(total.pipeline / total.target).toFixed(1)}x total</p>
            <p className="text-xs text-muted-foreground">
              {money(total.won)} ganado de {money(total.target)}
            </p>
          </div>
        )}
      </div>
      <ScreenState isPending={isPending} error={error} refetch={refetch} skeleton="cards">
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No hay segmentos. Créalos en{" "}
            <Link to="/strategy" className="underline">
              Estrategia GTM
            </Link>
            .
          </p>
        )}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => (
            <SegmentCard
              key={r.segment.id}
              r={r}
              money={money}
              canEdit={!!canEdit}
              quarter={quarter}
              onTarget={(v) => setTarget(r.segment.id, v)}
            />
          ))}
        </div>
      </ScreenState>
    </section>
  );
}

function SegmentCard({
  r,
  money,
  canEdit,
  quarter,
  onTarget,
}: {
  r: SegmentCoverageRow;
  money: (n: number) => string;
  canEdit: boolean;
  quarter: string;
  onTarget: (v: number) => void;
}) {
  const cov = r.coverage;
  const tone = !cov
    ? "text-muted-foreground"
    : cov.status === "low"
      ? "text-signal"
      : cov.status === "healthy"
        ? "text-success"
        : "text-foreground";
  const f = r.figures;
  const acv = figureMark(f.acv);
  const winRate =
    r.winRate.real != null
      ? { value: r.winRate.real, state: "real", reason: null }
      : noClosedDeals(quarter);
  return (
    <div className="rounded-md border p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="break-words font-medium">{r.segment.name}</p>
          {r.inferredDeals > 0 && (
            <DataMark
              {...inferredMark(r.inferredDeals, r.assignedDeals, true)}
              className="block text-xs text-muted-foreground"
            />
          )}
          <p className="text-xs text-muted-foreground">
            ACV{r.acv != null ? ` ${money(r.acv)}` : ""}
            {acv && (
              <>
                {" "}
                · <DataMark {...acv} />
              </>
            )}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className={`font-display text-3xl ${tone}`}>
            {cov ? `${cov.ratio.toFixed(1)}x` : "—"}
          </p>
          <p className={`text-xs ${tone}`}>
            {!cov
              ? "Sin objetivo"
              : cov.status === "low"
                ? "Baja (<3x)"
                : cov.status === "healthy"
                  ? "Sana (3–4x)"
                  : "Alta (>4x)"}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 text-sm">
        <span className="whitespace-nowrap text-muted-foreground">Objetivo {quarter}</span>
        {canEdit ? (
          <Input
            type="number"
            min={0}
            className="h-10 w-32 text-right md:h-8"
            defaultValue={r.target || ""}
            key={`${r.segment.id}-${quarter}-${r.target}`}
            placeholder="Importe"
            onBlur={(e) =>
              e.target.value !== "" &&
              Number(e.target.value) !== r.target &&
              onTarget(Number(e.target.value))
            }
          />
        ) : (
          <span className="font-mono">{r.target ? money(r.target) : "—"}</span>
        )}
      </div>
      <div className="mt-3 space-y-2">
        <Metric
          label="Pipeline abierto"
          real={money(r.pipeline)}
          target={r.target ? money(r.target * 3) + " (3x)" : null}
          progress={r.target ? r.pipeline / (r.target * 3) : null}
        />
        <Metric
          label="Deals ganados"
          real={`${r.won.deals} · ${money(r.won.amount)}`}
          target={r.won.target != null ? `${r.won.target} deals` : null}
          progress={r.won.target ? r.won.deals / r.won.target : null}
          hint={r.won.attainment != null ? `${pct(r.won.attainment)} del objetivo` : undefined}
        />
        <Metric
          label="Oportunidades creadas"
          real={`${r.opps.created} (${r.opps.open} abiertas)`}
          target={r.opps.target != null ? `${r.opps.target}` : null}
          progress={r.opps.target ? r.opps.created / r.opps.target : null}
          hint={r.opps.target == null && r.target ? "Falta win rate objetivo" : undefined}
        />
        <Metric
          label={`Win rate · ${WIN_RATE_WINDOWS.trimestre.label(quarter)}`}
          real={<FigureValue f={winRate} show={(n) => pct(n)} />}
          target={r.winRate.target != null ? `${r.winRate.target}%` : null}
          progress={
            r.winRate.real != null && r.winRate.target
              ? r.winRate.real / (r.winRate.target / 100)
              : null
          }
        />
        <div className="flex items-center justify-between gap-2 border-t pt-2 text-sm">
          <span>CAC</span>
          <span className="font-mono text-xs">
            <FigureValue f={f.cac} show={money} />
            <span className="text-muted-foreground">
              {" "}
              / obj. {r.cac.target != null ? money(r.cac.target) : "—"}
            </span>
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 text-sm">
          <span>Payback real</span>
          <span className="font-mono text-xs">
            <FigureValue
              f={f.payback}
              show={(n) => `${n.toFixed(1)} m`}
              className={figureTone(f.payback, r.payback.ok)}
            />
            <span className="text-muted-foreground">
              {" "}
              / obj. {r.payback.target != null ? `${r.payback.target} m` : "—"}
            </span>
          </span>
        </div>
        <FigureNote f={f.payback} className="block text-xs text-muted-foreground" />
        {(() => {
          const m = f.margin;
          return m.source && m.value != null ? (
            <p className="text-xs text-muted-foreground">
              Con {MARGIN_LABEL[m.source]} del {Math.round(m.value)}%
              {m.source === "objetivo" ? (
                <>
                  {" "}
                  · apunta ingresos y coste de servir en «
                  <Link to="/strategy" search={{ tab: "budget" }} className="underline">
                    Presupuesto por segmento
                  </Link>
                  »
                </>
              ) : (
                ""
              )}
            </p>
          ) : null;
        })()}
        {f.cac.value == null && (
          <p className="text-xs text-muted-foreground">
            {r.cac.cost > 0 || r.sharedSplit === "sin_reparto" ? (
              "Hay costes pero ningún deal ganado este trimestre: aún no hay CAC real."
            ) : (
              <>
                Introduce los costes en «<CacRealLink />» para calcular el CAC y el payback reales.
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

function Metric({
  label,
  real,
  target,
  progress,
  hint,
}: {
  label: string;
  real: ReactNode;
  target: string | null;
  progress: number | null;
  hint?: string;
}) {
  return (
    <div className="text-sm">
      <div className="flex flex-wrap justify-between gap-x-2">
        <span className="min-w-0">{label}</span>
        <span className="ml-auto font-mono text-xs">
          {real}
          <span className="text-muted-foreground"> / {target ?? "—"}</span>
        </span>
      </div>
      <div className="mt-1 h-1.5 rounded bg-muted">
        <div
          className={`h-full rounded ${progress != null && progress >= 1 ? "bg-success" : "bg-primary"}`}
          style={{ width: `${progress != null ? Math.min(100, Math.round(progress * 100)) : 0}%` }}
        />
      </div>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** «CAC real» lives in Métricas › CAC y presupuesto (SDD-20261106-metrics-honest-data CA-11). */
function CacRealLink() {
  return (
    <Link to="/metrics" search={{ seccion: "economia" }} className="underline">
      CAC real
    </Link>
  );
}
