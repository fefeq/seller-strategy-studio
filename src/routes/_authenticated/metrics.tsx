import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency, useMe } from "@/hooks/use-me";
import { Page } from "@/components/page";
import { Input } from "@/components/ui/input";
import { DEAL_STAGES } from "@/lib/roles";
import { coverage, daysInStage, forecastAccuracy, quarterOf, quarterRange, stageConversion, winRate } from "@/lib/metrics";
import { SelfServiceFunnel } from "@/components/self-service-funnel";
import { SegmentCoverage } from "@/components/segment-coverage";
import { CacPanel } from "@/components/cac-panel";
import { BudgetPanel } from "@/components/budget-panel";
import { WonDealsPanel } from "@/components/won-deals-panel";
import { LeadFunnelPanel } from "@/components/leads/lead-funnel-panel";

export const Route = createFileRoute("/_authenticated/metrics")({
  head: () => ({ meta: [{ title: "Métricas RevOps — GTM Brain" }, { name: "description", content: "Cobertura, conversión, velocidad, win rate y forecast." }, { property: "og:title", content: "Métricas RevOps — GTM Brain" }, { property: "og:description", content: "Cobertura, conversión, velocidad, win rate y forecast." }] }),
  component: Metrics,
});

const pct = (n: number) => `${Math.round(n * 100)}%`;
const OPEN_ORDER = ["discovery", "qualified", "demo", "proposal", "negotiation", "won"];
const SOURCE_LABEL: Record<string, string> = { outbound: "Outbound", inbound: "Inbound", partner: "Partner", plg: "Producto (PLG)", event: "Evento", referral: "Referido" };

function Metrics() {
  const { money: eur } = useCurrency();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const orgId = me?.currentOrg?.org_id;
  const canEdit = me?.roles.some((r) => r === "owner" || r === "sales_leader");
  const [quarter, setQuarter] = useState(quarterOf(new Date()));
  const { data } = useQuery({
    queryKey: ["metrics", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const [d, h, q, p] = await Promise.all([
        supabase.from("deals").select("*"),
        supabase.from("deal_stage_history").select("deal_id,from_stage,to_stage,changed_at"),
        supabase.from("quotas").select("*"),
        supabase.from("org_members").select("user_id").eq("org_id", orgId!),
      ]);
      const ids = (p.data ?? []).map((x) => x.user_id);
      const { data: profiles } = ids.length ? await supabase.from("profiles").select("id,full_name").in("id", ids) : { data: [] };
      return { deals: d.data ?? [], history: h.data ?? [], quotas: q.data ?? [], profiles: profiles ?? [] };
    },
  });

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
      quota, cov: coverage(openInQ.reduce((s, d) => s + Number(d.amount ?? 0), 0), quota),
      conv: stageConversion(data.history, OPEN_ORDER),
      days: daysInStage(data.history),
      bySource: group((d) => d.source ?? "outbound"),
      byRep: group((d) => data.profiles.find((p) => p.id === d.owner_id)?.full_name ?? "Sin asignar"),
      slipped: open.filter((d) => d.slip_count > 0),
      slipRate: open.length ? open.filter((d) => d.slip_count > 0).length / open.length : 0,
      commit, actual, acc: forecastAccuracy(commit, actual), created,
      overall: winRate(data.deals.filter((d) => d.stage === "won").length, data.deals.filter((d) => d.stage === "lost").length),
    };
  }, [data, quarter]);

  async function setQuota(userId: string, amount: number) {
    const { error } = await supabase.from("quotas").upsert({ org_id: orgId!, user_id: userId, period: quarter, amount }, { onConflict: "org_id,user_id,period" });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["metrics"] });
  }

  const quarters = Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setMonth(d.getMonth() + (i - 2) * 3); return quarterOf(d); });

  return (
    <Page eyebrow="Revenue operations" title="Métricas" actions={
      <select className="h-9 rounded-md border bg-card px-3 text-sm" value={quarter} onChange={(e) => setQuarter(e.target.value)}>
        {quarters.map((q) => <option key={q} value={q}>{q}</option>)}
      </select>
    }>
      {m && (
        <div className="space-y-8">
          <div className="grid gap-4 md:grid-cols-4">
            <Kpi label="Cobertura de pipeline" v={m.quota ? `${m.cov.ratio.toFixed(1)}x` : "—"} hint={m.quota ? (m.cov.status === "healthy" ? "Sana (3–4x)" : m.cov.status === "low" ? "Baja: objetivo 3–4x" : "Alta: revisa calidad") : "Define cuotas abajo"} tone={m.cov.status === "low" && m.quota ? "bad" : undefined} />
            <Kpi label="Pipeline que cierra este trimestre" v={eur(m.openPipe)} hint={`Cuota total ${eur(m.quota)}`} />
            <Kpi label="Forecast comprometido vs real" v={`${eur(m.actual)} / ${eur(m.commit)}`} hint={m.commit ? `${m.acc.diff >= 0 ? "+" : ""}${pct(m.acc.diff)} · ${m.acc.accurate ? "dentro del 10%" : "fuera del 10%"}` : "Marca deals como Commit"} tone={m.commit && !m.acc.accurate ? "bad" : undefined} />
            <Kpi label="Win rate global" v={pct(m.overall)} hint={`${m.created} deals creados este trimestre`} />
          </div>

          <SegmentCoverage quarter={quarter} />
          <CacPanel quarter={quarter} />
          <WonDealsPanel quarter={quarter} />
          <BudgetPanel year={Number(quarter.slice(0, 4))} />


          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Conversión por etapa">
              {m.conv.map((c) => (
                <Bar key={c.from} label={`${lab(c.from)} → ${lab(c.to)}`} value={c.rate} right={`${pct(c.rate)} · ${c.count}`} />
              ))}
            </Panel>
            <Panel title="Velocidad: días medios por etapa">
              {OPEN_ORDER.slice(0, -1).map((s) => {
                const d = m.days[s] ?? 0;
                const max = Math.max(1, ...Object.values(m.days));
                return <Bar key={s} label={lab(s)} value={d / max} right={`${d.toFixed(1)} días`} />;
              })}
            </Panel>
            <Panel title="Win rate por fuente">
              {m.bySource.length === 0 && <Muted>Sin deals cerrados todavía.</Muted>}
              {m.bySource.map((r) => <Bar key={r.k} label={SOURCE_LABEL[r.k] ?? r.k} value={r.rate} right={`${pct(r.rate)} · ${r.won}G/${r.lost}P`} />)}
            </Panel>
            <Panel title="Win rate por rep">
              {m.byRep.length === 0 && <Muted>Sin deals cerrados todavía.</Muted>}
              {m.byRep.map((r) => <Bar key={r.k} label={r.k} value={r.rate} right={`${pct(r.rate)} · ${r.won}G/${r.lost}P`} />)}
            </Panel>
            <Panel title={`Deals que se han retrasado (${pct(m.slipRate)} del pipeline abierto)`}>
              {m.slipped.length === 0 && <Muted>Ningún deal ha movido su fecha de cierre.</Muted>}
              {m.slipped.map((d) => (
                <div key={d.id} className="flex justify-between border-b py-2 text-sm last:border-0"><span>{d.name}</span><span className="font-mono text-xs text-signal">{d.slip_count}× retrasado · cierre {d.close_date}</span></div>
              ))}
            </Panel>
            <Panel title={`Cuotas ${quarter}`}>
              {data?.profiles.map((p) => {
                const q = data.quotas.find((x) => x.user_id === p.id && x.period === quarter);
                return (
                  <div key={p.id} className="flex items-center justify-between gap-3 border-b py-2 text-sm last:border-0">
                    <span>{p.full_name}</span>
                    {canEdit
                      ? <Input type="number" className="w-36" defaultValue={q?.amount ?? ""} key={`${p.id}-${quarter}`} onBlur={(e) => e.target.value !== "" && setQuota(p.id, Number(e.target.value))} />
                      : <span className="font-mono">{q ? eur(Number(q.amount)) : "—"}</span>}
                  </div>
                );
              })}
              <Muted>Solo Owner y Sales Leader pueden fijar cuotas.</Muted>
            </Panel>
          </div>

          <LeadFunnelPanel quarter={quarter} />

          <SelfServiceFunnel quarter={quarter} />
        </div>
      )}
    </Page>
  );
}

const lab = (s: string) => DEAL_STAGES.find((x) => x.id === s)?.label ?? s;
function Kpi({ label, v, hint, tone }: { label: string; v: string; hint: string; tone?: "bad" }) {
  return <div className="rounded-lg border bg-card p-5"><p className="eyebrow">{label}</p><p className="mt-2 font-display text-3xl">{v}</p><p className={`mt-1 text-xs ${tone === "bad" ? "text-signal" : "text-muted-foreground"}`}>{hint}</p></div>;
}
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-lg border bg-card p-5"><h3 className="mb-3 text-2xl">{title}</h3>{children}</div>;
}
function Bar({ label, value, right }: { label: string; value: number; right: string }) {
  return (
    <div className="py-1.5 text-sm">
      <div className="flex justify-between"><span>{label}</span><span className="font-mono text-xs text-muted-foreground">{right}</span></div>
      <div className="mt-1 h-1.5 rounded bg-muted"><div className="h-full rounded bg-primary" style={{ width: `${Math.min(100, Math.round(value * 100))}%` }} /></div>
    </div>
  );
}
function Muted({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-xs text-muted-foreground">{children}</p>;
}
