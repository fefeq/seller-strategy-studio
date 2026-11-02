import { Kpi } from "@/components/page";
import { wonDealsMargin } from "@/lib/deal-lines";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency, useMe } from "@/hooks/use-me";
import { useLeads } from "@/hooks/use-leads";
import { quarterRange } from "@/lib/metrics";
import { actuals } from "@/lib/pipeline-real";
import { quarterKpis } from "@/lib/quarter-kpis";
import { closingIn, pipelineBoard, pipelineEconomics, type BoardColumn, type BoardGroup } from "@/lib/pipeline-board";
import type { SegLike } from "@/lib/segment-coverage";
import { useStages } from "@/components/stage-settings";

const fmt1 = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 1 });
const SHOW = 5;

/** Leads → oportunidades → deals en proceso → ganados, who is in each stage, and what it does to the real CAC and payback. */
export function PipelineBoardPanel({ quarter }: { quarter: string }) {
  const { money } = useCurrency();
  const { data: me } = useMe();
  const orgId = me?.currentOrg?.org_id;
  const { data: leadsData } = useLeads(orgId);
  const year = Number(quarter.slice(0, 4));
  const { data } = useQuery({
    // "segment-coverage" is refreshed live when deals or leads change (useLivePipeline).
    queryKey: ["segment-coverage", orgId, "pipeline-board", quarter],
    enabled: !!orgId,
    queryFn: async () => {
      const [d, s, b, c] = await Promise.all([
        supabase.from("deals").select("id,name,owner_id,segment_id,amount,stage,close_date,closed_at,updated_at,created_at,gross_margin"),
        supabase.from("segments").select("id,name,acv_min,acv_max,win_rate_target,cac_target,gross_margin_pct,payback_months").order("acv_min"),
        supabase.from("segment_budget_quarters").select("*").in("period", [1, 2, 3, 4].map((n) => `${year}-Q${n}`)),
        supabase.from("cac_costs").select("segment_id,channel,amount,period").eq("period", quarter),
      ]);
      return { deals: d.data ?? [], segments: (s.data ?? []) as SegLike[], budgets: b.data ?? [], costs: c.data ?? [] };
    },
  });

  const { stages } = useStages();
  const view = useMemo(() => {
    if (!data || !leadsData) return null;
    const range = quarterRange(quarter);
    const board = pipelineBoard(leadsData.leads, data.deals, range, leadsData.sla, new Date(), stages);
    const [k] = quarterKpis(data.segments, data.deals, data.budgets, data.costs, [quarter]);
    const real = actuals(data.deals);
    const segMargins = data.segments.map((s) => s.gross_margin_pct).filter((x): x is number => x != null).map(Number);
    // Real margin of the books first, then what the won deals with product lines actually carried.
    const margin = k.actual.margin ?? wonDealsMargin(data.deals, range.end).all?.pct ?? k.plan.margin ?? (segMargins.length ? segMargins.reduce((a, b) => a + b, 0) / segMargins.length : null);
    const cost = data.costs.reduce((s, c) => s + Number(c.amount || 0), 0) || null;
    const closing = closingIn(data.deals, range);
    const won = board.find((g) => g.id === "won")!.count;
    return {
      board, cost, won, closing, real, margin,
      eco: pipelineEconomics({ cost, won, closing: closing.length, winRatePct: real.winRate, acv: real.acv, marginPct: margin }),
    };
  }, [data, leadsData, quarter, stages]);

  if (!view) return null;
  const owner = (id: string | null) => (id ? leadsData?.members.find((m) => m.id === id)?.full_name ?? "—" : "Sin asignar");
  const late = view.board.reduce((s, g) => s + g.columns.reduce((t, c) => t + c.items.filter((i) => i.late).length, 0), 0);
  const months = (n: number | null) => (n == null ? "—" : `${fmt1(n)} m`);

  return (
    <section className="rounded-lg border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <h3 className="text-2xl">Pipeline · {quarter}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Quién sigue en cada etapa, de lead a deal ganado. Los ganados del trimestre son los que dividen el gasto de captación en el CAC real;
            las oportunidades que cierran este trimestre, al win rate real, dan el CAC y el payback proyectados.
          </p>
        </div>
        {late > 0 && (
          <span className="flex items-center gap-1 rounded-none bg-signal/10 px-3 py-1 text-xs text-signal">{late} con retraso</span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        {view.board.map((g) => <Group key={g.id} g={g} money={money} owner={owner} />)}
      </div>

      <div className="mt-5 grid gap-3 rounded-md border bg-muted/30 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Kpi size="inline" label="Gasto de captación del trimestre" value={view.cost ? money(view.cost) : "—"} hint={view.cost ? "costes de «CAC real»" : "Apúntalo en «CAC real», más abajo"} />
        <Kpi size="inline" label="CAC real" value={view.eco.realCac != null ? money(view.eco.realCac) : "—"} hint={`${view.won} ${view.won === 1 ? "deal ganado" : "deals ganados"} en ${quarter}`} />
        <Kpi size="inline"
          label="CAC proyectado"
          value={view.eco.projectedCac != null ? money(view.eco.projectedCac) : "—"}
          hint={view.real.winRate != null
            ? `+${view.closing.length} abiertos que cierran este trimestre × ${Math.round(view.real.winRate)}% de win rate ≈ ${fmt1(view.eco.expectedWins)} clientes`
            : "Sin deals cerrados no hay win rate real"}
        />
        <Kpi size="inline"
          label="Payback real → proyectado"
          value={`${months(view.eco.realPayback)} → ${months(view.eco.projectedPayback)}`}
          hint={view.real.acv != null && view.margin != null ? `ACV real ${money(view.real.acv)} · margen ${fmt1(view.margin)}%` : "Falta ACV o margen"}
        />
      </div>
    </section>
  );
}

function Group({ g, money, owner }: { g: BoardGroup; money: (n: number) => string; owner: (id: string | null) => string }) {
  const to = g.id === "leads" ? "/leads" : "/deals";
  return (
    <div className="rounded-md border">
      <div className="flex items-baseline justify-between border-b px-3 py-2">
        <Link to={to} className="font-medium hover:underline">{g.label}</Link>
        <span className="font-mono text-xs text-muted-foreground">{g.count}{g.amount ? ` · ${money(g.amount)}` : ""}</span>
      </div>
      <div className="divide-y">
        {g.columns.map((c) => <Column key={c.stage} c={c} money={money} owner={owner} hideLabel={g.columns.length === 1} />)}
      </div>
    </div>
  );
}

function Column({ c, money, owner, hideLabel }: { c: BoardColumn; money: (n: number) => string; owner: (id: string | null) => string; hideLabel: boolean }) {
  const [all, setAll] = useState(false);
  const items = all ? c.items : c.items.slice(0, SHOW);
  return (
    <div className="px-3 py-2">
      {!hideLabel && (
        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
          <span className="eyebrow">{c.label}</span>
          <span className="font-mono">{c.count}{c.amount ? ` · ${money(c.amount)}` : ""}</span>
        </div>
      )}
      {c.count === 0 && <p className="py-1 text-xs text-muted-foreground">Nadie en esta etapa.</p>}
      <ul className="space-y-1.5">
        {items.map((i) => (
          <li key={i.id} className="text-sm" title={i.lateText ?? undefined}>
            <div className="flex justify-between gap-2">
              <span className={`min-w-0 truncate ${i.late ? "text-signal" : ""}`}>{i.name}</span>
              {i.amount ? <span className="shrink-0 font-mono text-xs text-muted-foreground">{money(i.amount)}</span> : null}
            </div>
            <p className="line-clamp-2 text-xs text-muted-foreground sm:line-clamp-none sm:truncate">
              {owner(i.ownerId)}{i.detail ? ` · ${i.detail}` : ""}{i.late && i.lateText ? <span className="text-signal"> · {i.lateText}</span> : null}
            </p>
          </li>
        ))}
      </ul>
      {c.count > SHOW && (
        <button className="-mx-1 mt-1 min-h-8 px-1 py-1.5 text-xs underline text-muted-foreground md:mx-0 md:min-h-0 md:px-0 md:py-0" onClick={() => setAll((x) => !x)}>
          {all ? "Ver menos" : `Ver ${c.count - SHOW} más`}
        </button>
      )}
    </div>
  );
}

