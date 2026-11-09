import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency, useMe } from "@/hooks/use-me";
import { useLeads } from "@/hooks/use-leads";
import { quarterRange } from "@/lib/metrics";
import {
  boardEconomics,
  pipelineBoard,
  type BoardColumn,
  type BoardGroup,
} from "@/lib/pipeline-board";
import type { QuarterBudgetLike } from "@/lib/segment-budget";
import { WIN_RATE_WINDOWS } from "@/lib/unit-economics";
import type { SegLike } from "@/lib/segment-coverage";
import { useStages } from "@/components/stage-settings";
import { Kpi, ScreenState } from "@/components/page";
import { FigureWithMark } from "@/components/metrics/figure";
import { ExplanationFold } from "@/components/explanation-fold";

const fmt1 = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 1 });
const SHOW = 5;

/** Leads → oportunidades → deals en proceso → ganados, who is in each stage, and what it does to the real CAC and payback. */
export function PipelineBoardPanel({ quarter }: { quarter: string }) {
  const { money } = useCurrency();
  const { data: me } = useMe();
  const orgId = me?.currentOrg?.org_id;
  const leads = useLeads(orgId);
  const leadsData = leads.data;
  const year = Number(quarter.slice(0, 4));
  const { data, isPending, error, refetch } = useQuery({
    // "segment-coverage" is refreshed live when deals or leads change (useLivePipeline).
    queryKey: ["segment-coverage", orgId, "pipeline-board", quarter],
    enabled: !!orgId,
    queryFn: async () => {
      const [d, s, b, c] = await Promise.all([
        supabase
          .from("deals")
          .select(
            "id,name,owner_id,segment_id,amount,stage,close_date,closed_at,updated_at,created_at,gross_margin",
          ),
        supabase
          .from("segments")
          .select(
            "id,name,acv_min,acv_max,win_rate_target,cac_target,gross_margin_pct,payback_months",
          )
          .order("acv_min"),
        supabase
          .from("segment_budget_quarters")
          .select("*")
          .in(
            "period",
            [1, 2, 3, 4].map((n) => `${year}-Q${n}`),
          ),
        supabase.from("cac_costs").select("segment_id,channel,amount,period").eq("period", quarter),
      ]);
      const failed = d.error ?? s.error ?? b.error ?? c.error;
      if (failed) throw failed;
      return {
        deals: d.data ?? [],
        segments: (s.data ?? []) as SegLike[],
        budgets: (b.data ?? []) as QuarterBudgetLike[],
        costs: c.data ?? [],
      };
    },
  });

  const { stages } = useStages();
  const view = useMemo(() => {
    if (!data || !leadsData) return null;
    const range = quarterRange(quarter);
    const board = pipelineBoard(
      leadsData.leads,
      data.deals,
      range,
      leadsData.sla,
      new Date(),
      stages,
    );
    // CAC and payback of the board are the KPI's (boardEconomics: companyCac and companyPayback, SDD-20261109 D10).
    const eco = boardEconomics({
      deals: data.deals,
      segments: data.segments,
      budgets: data.budgets,
      costs: data.costs,
      quarter,
    });
    return { board, ...eco };
  }, [data, leadsData, quarter, stages]);

  // The panel's own read decides loading and error; the leads read (shared with Leads) keeps it in loading until it answers and shows its error with its own retry.
  if (!view) {
    return (
      <section className="rounded-lg border bg-card p-5">
        <h3 className="mb-4 text-2xl">Pipeline · {quarter}</h3>
        <ScreenState
          isPending={isPending || !!leads.isPending}
          error={error ?? leads.error}
          refetch={() => {
            if (error) void refetch();
            if (leads.error) void leads.refetch();
          }}
          skeleton="cards"
        >
          {null}
        </ScreenState>
      </section>
    );
  }
  const owner = (id: string | null) =>
    id ? (leadsData?.members.find((m) => m.id === id)?.full_name ?? "—") : "Sin asignar";
  const late = view.board.reduce(
    (s, g) => s + g.columns.reduce((t, c) => t + c.items.filter((i) => i.late).length, 0),
    0,
  );
  const months = (n: number) => `${fmt1(n)} m`;

  return (
    <section className="rounded-lg border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <h3 className="text-2xl">Pipeline · {quarter}</h3>
          <ExplanationFold kind="calculo" className="mt-1">
            <p className="text-xs text-muted-foreground">
              Quién sigue en cada etapa, de lead a deal ganado. Los ganados del trimestre son los
              que dividen el gasto de captación en el CAC real; las oportunidades que cierran este
              trimestre, al win rate real, dan el CAC proyectado.
            </p>
          </ExplanationFold>
        </div>
        {late > 0 && (
          <span className="flex items-center gap-1 rounded-none bg-signal/10 px-3 py-1 text-xs text-signal">
            {late} con retraso
          </span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        {view.board.map((g) => (
          <Group key={g.id} g={g} money={money} owner={owner} />
        ))}
      </div>

      <div className="mt-5 grid gap-3 rounded-md border bg-muted/30 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          size="inline"
          label="Gasto de captación del trimestre"
          value={view.cost ? money(view.cost) : "—"}
          hint={
            view.cost ? (
              <>
                costes de «<CacRealLink />»
              </>
            ) : (
              <>
                Apúntalo en «<CacRealLink />»
              </>
            )
          }
        />
        <Kpi
          size="inline"
          label="CAC real"
          value={<FigureWithMark f={view.realCac} show={money} />}
          hint={`${view.won} ${view.won === 1 ? "deal ganado" : "deals ganados"} en ${quarter}`}
        />
        <Kpi
          size="inline"
          label="CAC proyectado"
          value={<FigureWithMark f={view.projectedCac} show={money} />}
          hint={
            view.real.winRate != null
              ? `+${view.closing.length} abiertos que cierran este trimestre × ${Math.round(view.real.winRate)}% de win rate (${WIN_RATE_WINDOWS.ultimos365.label}) ≈ ${fmt1(view.expectedWins)} clientes`
              : "Sin deals cerrados en los últimos 365 días no hay win rate real"
          }
        />
        <Kpi
          size="inline"
          label="Payback real"
          value={<FigureWithMark f={view.payback} show={months} />}
          hint="El de los KPIs trimestrales: media de los segmentos con payback, ponderada por clientes"
        />
      </div>
    </section>
  );
}

function Group({
  g,
  money,
  owner,
}: {
  g: BoardGroup;
  money: (n: number) => string;
  owner: (id: string | null) => string;
}) {
  const to = g.id === "leads" ? "/leads" : "/deals";
  return (
    <div className="rounded-md border">
      <div className="flex items-baseline justify-between border-b px-3 py-2">
        <Link to={to} className="font-medium hover:underline">
          {g.label}
        </Link>
        <span className="font-mono text-xs text-muted-foreground">
          {g.count}
          {g.amount ? ` · ${money(g.amount)}` : ""}
        </span>
      </div>
      <div className="divide-y">
        {g.columns.map((c) => (
          <Column
            key={c.stage}
            c={c}
            money={money}
            owner={owner}
            hideLabel={g.columns.length === 1}
          />
        ))}
      </div>
    </div>
  );
}

function Column({
  c,
  money,
  owner,
  hideLabel,
}: {
  c: BoardColumn;
  money: (n: number) => string;
  owner: (id: string | null) => string;
  hideLabel: boolean;
}) {
  const [all, setAll] = useState(false);
  const items = all ? c.items : c.items.slice(0, SHOW);
  return (
    <div className="px-3 py-2">
      {!hideLabel && (
        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
          <span className="eyebrow">{c.label}</span>
          <span className="font-mono">
            {c.count}
            {c.amount ? ` · ${money(c.amount)}` : ""}
          </span>
        </div>
      )}
      {c.count === 0 && <p className="py-1 text-xs text-muted-foreground">Nadie en esta etapa.</p>}
      <ul className="space-y-1.5">
        {items.map((i) => (
          <li key={i.id} className="text-sm" title={i.lateText ?? undefined}>
            <div className="flex justify-between gap-2">
              <span className={`min-w-0 truncate ${i.late ? "text-signal" : ""}`}>{i.name}</span>
              {i.amount ? (
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {money(i.amount)}
                </span>
              ) : null}
            </div>
            <p className="line-clamp-2 text-xs text-muted-foreground sm:line-clamp-none sm:truncate">
              {owner(i.ownerId)}
              {i.detail ? ` · ${i.detail}` : ""}
              {i.late && i.lateText ? <span className="text-signal"> · {i.lateText}</span> : null}
            </p>
          </li>
        ))}
      </ul>
      {c.count > SHOW && (
        <button
          className="-mx-1 mt-1 min-h-8 px-1 py-1.5 text-xs underline text-muted-foreground md:mx-0 md:min-h-0 md:px-0 md:py-0"
          onClick={() => setAll((x) => !x)}
        >
          {all ? "Ver menos" : `Ver ${c.count - SHOW} más`}
        </button>
      )}
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
