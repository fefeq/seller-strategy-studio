import { createFileRoute, Link } from "@tanstack/react-router";
import { RevopsCohorts, RevopsFunnel, RevopsLost, RevopsTrends } from "@/components/metrics/revops-panels";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency, useMe } from "@/hooks/use-me";
import { Page } from "@/components/page";
import { Input } from "@/components/ui/input";
import { daysInStage, forecastAccuracy, quarterOf, quarterRange, stageConversion, winRate } from "@/lib/metrics";
import { SelfServiceFunnel } from "@/components/self-service-funnel";
import { SegmentCoverage } from "@/components/segment-coverage";
import { CacPanel } from "@/components/cac-panel";
import { BudgetPanel } from "@/components/budget-panel";
import { WonDealsPanel } from "@/components/won-deals-panel";
import { LeadFunnelPanel } from "@/components/leads/lead-funnel-panel";
import { FinancePanel } from "@/components/metrics/finance-panel";
import { QuarterKpisPanel } from "@/components/quarter-kpis-panel";
import { PipelineBoardPanel } from "@/components/pipeline-board-panel";
import { errorText } from "@/lib/errors";
import { metricsHeadline } from "@/lib/headlines";
import { formatRatio, quarterCoverage } from "@/lib/coverage";
import { openStages, stageLabel, stagePath } from "@/lib/stages";
import { useStages } from "@/components/stage-settings";
import { StripeMetricsPanel } from "@/components/stripe-panel";
import { fetchAll } from "@/lib/fetch-all";
import { pct } from "@/lib/money";

export const Route = createFileRoute("/_authenticated/metrics")({
  head: () => ({ meta: [{ title: "Métricas RevOps — Nokko" }, { name: "description", content: "Cobertura, conversión, velocidad, win rate y forecast." }, { property: "og:title", content: "Métricas RevOps — Nokko" }, { property: "og:description", content: "Cobertura, conversión, velocidad, win rate y forecast." }] }),
  validateSearch: (s: Record<string, unknown>): { seccion?: Section } => ({ seccion: SECTIONS.some((x) => x.id === s.seccion) ? (s.seccion as Section) : undefined }),
  component: Metrics,
});

const SECTIONS = [
  { id: "resumen", label: "Resumen" },
  { id: "embudo", label: "Embudo" },
  { id: "rendimiento", label: "Rendimiento" },
  { id: "perdidos", label: "Perdidos" },
  { id: "cohortes", label: "Cohortes" },
  { id: "tendencias", label: "Tendencias" },
  { id: "economia", label: "CAC y presupuesto" },
  { id: "finanzas", label: "Finanzas" },
  { id: "leads", label: "Leads y self-service" },
] as const;
type Section = (typeof SECTIONS)[number]["id"];

const SOURCE_LABEL: Record<string, string> = { outbound: "Outbound", inbound: "Inbound", partner: "Partner", plg: "Producto (PLG)", event: "Evento", referral: "Referido" };

function Metrics() {
  const { money: eur, currency } = useCurrency();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const orgId = me?.currentOrg?.org_id;
  const canEdit = me?.roles.some((r) => r === "owner" || r === "sales_leader");
  const [quarter, setQuarter] = useState(quarterOf(new Date()));
  const sec: Section = Route.useSearch().seccion ?? "resumen";
  const { data } = useQuery({
    queryKey: ["metrics", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const [d, h, q, p] = await Promise.all([
        fetchAll((a, b) => supabase.from("deals").select("*").order("id").range(a, b)).then((r) => ({ data: r.rows })),
        fetchAll((a, b) => supabase.from("deal_stage_history").select("deal_id,from_stage,to_stage,changed_at").order("id").range(a, b)).then((r) => ({ data: r.rows })),
        supabase.from("quotas").select("*"),
        supabase.from("org_members").select("user_id").eq("org_id", orgId!),
      ]);
      const ids = (p.data ?? []).map((x) => x.user_id);
      const { data: profiles } = ids.length ? await supabase.from("profiles").select("id,full_name").in("id", ids) : { data: [] };
      return { deals: d.data ?? [], history: h.data ?? [], quotas: q.data ?? [], profiles: profiles ?? [] };
    },
  });

  const { stages } = useStages();
  const lab = (k: string) => stageLabel(k, stages);
  const m = useMemo(() => {
    if (!data) return null;
    const { start, end } = quarterRange(quarter);
    const inQ = (s?: string | null) => !!s && new Date(s) >= start && new Date(s) < end;
    const open = data.deals.filter((d) => d.stage !== "won" && d.stage !== "lost");
    const openInQ = open.filter((d) => inQ(d.close_date));
    const quota = data.quotas.filter((q) => q.period === quarter).reduce((s, q) => s + Number(q.amount), 0);
    const closedQ = data.deals.filter((d) => (d.stage === "won" || d.stage === "lost") && inQ(d.closed_at ?? d.updated_at));
    const wonQ = closedQ.filter((d) => d.stage === "won");
    const commit = openInQ.filter((d) => d.forecast_category === "commit").reduce((s, d) => s + Number(d.amount ?? 0), 0)
      + wonQ.reduce((s, d) => s + Number(d.amount ?? 0), 0);
    const actual = wonQ.reduce((s, d) => s + Number(d.amount ?? 0), 0);
    const group = (key: (d: any) => string) => {
      const g: Record<string, { won: number; lost: number }> = {};
      for (const d of data.deals.filter((x) => x.stage === "won" || x.stage === "lost")) {
        const k = key(d); g[k] ??= { won: 0, lost: 0 }; g[k][d.stage === "won" ? "won" : "lost"]++;
      }
      return Object.entries(g).map(([k, v]) => ({ k, ...v, rate: winRate(v.won, v.lost) }));
    };
    const created = data.history.filter((h) => !h.from_stage && inQ(h.changed_at)).length;
    return {
      openPipe: openInQ.reduce((s, d) => s + Number(d.amount ?? 0), 0),
      quota, cov: quarterCoverage(data.deals, quota, quarter),
      conv: stageConversion(data.history, stagePath(stages)),
      days: daysInStage(data.history),
      bySource: group((d) => d.source ?? "outbound"),
      byRep: group((d) => data.profiles.find((p) => p.id === d.owner_id)?.full_name ?? "Sin asignar"),
      slipped: open.filter((d) => d.slip_count > 0),
      slipRate: open.length ? open.filter((d) => d.slip_count > 0).length / open.length : 0,
      commit, actual, acc: forecastAccuracy(commit, actual), created,
      overall: winRate(data.deals.filter((d) => d.stage === "won").length, data.deals.filter((d) => d.stage === "lost").length),
    };
  }, [data, quarter, stages]);

  async function setQuota(userId: string, amount: number) {
    const { error } = await supabase.from("quotas").upsert({ org_id: orgId!, user_id: userId, period: quarter, amount }, { onConflict: "org_id,user_id,period" });
    if (error) return toast.error(errorText(error));
    qc.invalidateQueries({ queryKey: ["metrics"] });
  }

  const quarters = Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setMonth(d.getMonth() + (i - 2) * 3); return quarterOf(d); });

  return (
    <Page eyebrow={`Métricas · ${quarter}`} title={m ? metricsHeadline({ quota: m.quota, ratio: m.cov.ratio, status: m.cov.status }) : "Métricas"} actions={
      <select aria-label="Trimestre" className="h-10 rounded-md border bg-card px-3 text-sm md:h-9" value={quarter} onChange={(e) => setQuarter(e.target.value)}>
        {quarters.map((q) => <option key={q} value={q}>{q}</option>)}
      </select>
    }>
      <nav aria-label="Secciones de Métricas" className="sticky top-0 z-20 -mx-4 mb-6 flex gap-1 overflow-x-auto border-b bg-background/95 px-4 py-2 backdrop-blur md:top-14 md:mx-0 md:px-0">
        {SECTIONS.filter((x) => x.id !== "finanzas" || canEdit).map((x) => (
          <Link key={x.id} to="/metrics" search={x.id === "resumen" ? {} : { seccion: x.id }} className={`shrink-0 rounded-full px-3 py-1.5 text-sm transition-colors ${sec === x.id ? "bg-lime text-lime-foreground" : "text-ink-mid hover:bg-paper-sunk hover:text-ink"}`}>{x.label}</Link>
        ))}
      </nav>
      {m && data && (
        <div className="space-y-8">
          {sec === "embudo" && <RevopsFunnel deals={data.deals} history={data.history} path={stagePath(stages).filter((k) => k !== "won" && k !== "lost")} label={lab} />}
          {sec === "perdidos" && <RevopsLost deals={data.deals} history={data.history} path={stagePath(stages).filter((k) => k !== "won" && k !== "lost")} label={lab} />}
          {sec === "cohortes" && <RevopsCohorts deals={data.deals} />}
          {sec === "tendencias" && <RevopsTrends deals={data.deals} />}
          {sec === "resumen" && <>
          <div className="grid gap-4 md:grid-cols-4">
            <Kpi label="Cobertura de pipeline" v={m.quota ? formatRatio(m.cov.ratio) : "—"} hint={m.quota ? `${m.cov.status === "healthy" ? "Sana (3–4x)" : m.cov.status === "low" ? "Baja: objetivo 3–4x" : "Alta: revisa calidad"}${m.cov.undated.count ? ` · ${m.cov.undated.count} ${m.cov.undated.count === 1 ? "deal" : "deals"} sin fecha de cierre (${eur(m.cov.undated.amount)}) no cuentan` : ""}` : "Define cuotas abajo"} tone={m.cov.status === "low" && m.quota ? "bad" : undefined} />
            <Kpi label="Pipeline que cierra este trimestre" v={eur(m.openPipe)} hint={`Cuota total ${eur(m.quota)}`} />
            <Kpi label="Forecast comprometido vs real" v={`${eur(m.actual)} / ${eur(m.commit)}`} hint={m.commit ? `${m.acc.diff >= 0 ? "+" : ""}${pct(m.acc.diff)} · ${m.acc.accurate ? "dentro del 10%" : "fuera del 10%"}` : "Marca deals como Commit"} tone={m.commit && !m.acc.accurate ? "bad" : undefined} />
            <Kpi label="Win rate global" v={pct(m.overall)} hint={`${m.created} deals creados este trimestre`} />
          </div>

          <StripeMetricsPanel />
          <QuarterKpisPanel quarter={quarter} />
          <SegmentCoverage quarter={quarter} />
          </>}
          {sec === "economia" && <>
          <CacPanel quarter={quarter} />
          <WonDealsPanel key={quarter} quarter={quarter} />
          <BudgetPanel year={Number(quarter.slice(0, 4))} />
          </>}

          {sec === "rendimiento" && <>
          <PipelineBoardPanel quarter={quarter} />
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Conversión por etapa">
              {m.conv.map((c) => (
                <Bar key={c.from} label={`${lab(c.from)} → ${lab(c.to)}`} value={c.rate} right={`${pct(c.rate)} · ${c.count}`} />
              ))}
            </Panel>
            <Panel title="Velocidad: días medios por etapa">
              {openStages(stages).map(({ key: s }) => {
                const d = m.days[s] ?? 0;
                const max = Math.max(1, ...Object.values(m.days));
                return <Bar key={s} label={lab(s)} value={d / max} right={`${d.toFixed(1)} días`} />;
              })}
            </Panel>
            <Panel title="Win rate por fuente">
              {m.bySource.length === 0 && <Muted>Sin deals cerrados todavía. Aparecerán al marcar deals como ganados o perdidos.</Muted>}
              {m.bySource.map((r) => <Bar key={r.k} label={SOURCE_LABEL[r.k] ?? r.k} value={r.rate} right={`${pct(r.rate)} · ${r.won}G/${r.lost}P`} />)}
            </Panel>
            <Panel title="Win rate por rep">
              {m.byRep.length === 0 && <Muted>Sin deals cerrados todavía. Aparecerán al marcar deals como ganados o perdidos.</Muted>}
              {m.byRep.map((r) => <Bar key={r.k} label={r.k} value={r.rate} right={`${pct(r.rate)} · ${r.won}G/${r.lost}P`} />)}
            </Panel>
            <Panel title={`Deals que se han retrasado (${pct(m.slipRate)} del pipeline abierto)`}>
              {m.slipped.length === 0 && <Muted>Ningún deal ha movido su fecha de cierre.</Muted>}
              {m.slipped.map((d) => (
                <div key={d.id} className="flex flex-wrap justify-between gap-x-3 gap-y-0.5 border-b py-2 text-sm last:border-0"><span className="min-w-0 break-words">{d.name}</span><span className="ml-auto shrink-0 font-mono text-xs text-signal">{d.slip_count}× retrasado · cierre {d.close_date}</span></div>
              ))}
            </Panel>
            <Panel title={`Cuotas ${quarter}`}>
              {data?.profiles.map((p) => {
                const q = data.quotas.find((x) => x.user_id === p.id && x.period === quarter);
                return (
                  <div key={p.id} className="flex items-center justify-between gap-3 border-b py-2 text-sm last:border-0">
                    <span className="min-w-0 break-words">{p.full_name}</span>
                    {canEdit
                      ? <Input type="number" className="w-36 shrink-0" defaultValue={q?.amount ?? ""} key={`${p.id}-${quarter}`} onBlur={(e) => e.target.value !== "" && setQuota(p.id, Number(e.target.value))} />
                      : <span className="font-mono">{q ? eur(Number(q.amount)) : "—"}</span>}
                  </div>
                );
              })}
              <Muted>{canEdit ? `Importe en ${currency} de deals ganados (ACV nuevo) que cada persona debe cerrar en ${quarter}. La cobertura compara el pipeline con cierre en el trimestre con esta suma.` : "Solo el Owner y el Sales Leader fijan las cuotas."}</Muted>
            </Panel>
          </div>
          </>}

          {sec === "finanzas" && (canEdit ? <FinancePanel quarter={quarter} /> : <p className="text-sm text-muted-foreground">Las finanzas solo las ven el Owner y el Sales Leader de la empresa.</p>)}
          {sec === "leads" && <>
          <LeadFunnelPanel quarter={quarter} />
          <SelfServiceFunnel quarter={quarter} />
          </>}
        </div>
      )}
    </Page>
  );
}

function Kpi({ label, v, hint, tone }: { label: string; v: string; hint: string; tone?: "bad" }) {
  return <div className="min-w-0 rounded-lg border bg-card p-5"><p className="eyebrow">{label}</p><p className="mt-2 break-words font-display text-3xl">{v}</p><p className={`mt-1 text-xs ${tone === "bad" ? "text-signal" : "text-muted-foreground"}`}>{hint}</p></div>;
}
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-lg border bg-card p-5"><h3 className="mb-3 text-2xl">{title}</h3>{children}</div>;
}
function Bar({ label, value, right }: { label: string; value: number; right: string }) {
  return (
    <div className="py-1.5 text-sm">
      <div className="flex justify-between gap-3"><span className="min-w-0 break-words">{label}</span><span className="shrink-0 font-mono text-xs text-muted-foreground">{right}</span></div>
      <div className="mt-1 h-1.5 rounded bg-muted"><div className="h-full rounded bg-primary" style={{ width: `${Math.min(100, Math.round(value * 100))}%` }} /></div>
    </div>
  );
}
function Muted({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-xs text-muted-foreground">{children}</p>;
}
