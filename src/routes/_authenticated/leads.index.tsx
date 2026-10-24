import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CompanyLogo } from "@/components/company-logo";
import { useLeadTouched } from "@/components/background";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowDownToLine } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { useLeads, type Lead } from "@/hooks/use-leads";
import { Page, Empty } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { LeadDetail } from "@/components/leads/lead-detail";
import { NewLead, SlaSettings } from "@/components/leads/lead-dialogs";
import { DISQUALIFIED, LEAD_STAGES, delayText, funnelBy, leadCohort, leadDelay, leadFunnel, leadStageLabel, type LeadDelay } from "@/lib/lead-funnel";
import { quarterOf, quarterRange } from "@/lib/metrics";
import { errorText } from "@/lib/errors";
import { leadsHeadline } from "@/lib/headlines";
import { byScore, scoreLead, type Score } from "@/lib/scoring";
import { ScoreBadge } from "@/components/score";
import { QualSettingsDialog, QualTag, QualifyPending, leadQualView } from "@/components/leads/lead-qualification";

export const Route = createFileRoute("/_authenticated/leads/")({
  validateSearch: (s: Record<string, unknown>): { lead?: string; late?: true; orden?: "fecha" } => ({
    lead: typeof s.lead === "string" ? s.lead : undefined,
    late: s.late === true || s.late === "true" ? true : undefined,
    orden: s.orden === "fecha" ? "fecha" : undefined,
  }),
  head: () => ({ meta: [
    { title: "Leads — Nokko" },
    { name: "description", content: "Pipeline de leads por etapas (Nuevo, Contactado, MQL, SQL, Oportunidad) con retrasos y conversión." },
    { property: "og:title", content: "Leads — Nokko" },
    { property: "og:description", content: "Pipeline de leads por etapas con retrasos y conversión hasta oportunidad y venta." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: LeadsPage,
});

const pct = (n: number) => `${Math.round(n * 100)}%`;
const COLUMNS = [...LEAD_STAGES, DISQUALIFIED];

function LeadsPage() {
  const { data: me } = useMe();
  const orgId = me?.currentOrg?.org_id;
  const roles = me?.roles ?? [];
  const canSettings = roles.some((r) => r === "owner" || r === "sales_leader" || r === "marketing");
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const go = useNavigate();
  const touchLead = useLeadTouched();
  const qc = useQueryClient();
  const { data } = useLeads(orgId);

  const view = useMemo(() => {
    if (!data) return null;
    const now = new Date();
    const delays = new Map<string, LeadDelay>(data.leads.map((l) => [l.id, leadDelay(l, data.sla, now)]));
    const segNames = new Map(data.segments.map((s) => [s.id, s.name]));
    const scores = new Map<string, Score>(data.leads.map((l) => [l.id, scoreLead({ ...l, late: delays.get(l.id)!.late }, data.icps, data.accounts, now, segNames)]));
    const open = data.leads.filter((l) => ["new", "contacted", "mql", "sql"].includes(l.stage));
    const late = open.filter((l) => delays.get(l.id)?.late).sort((a, b) => (delays.get(b.id)!.daysInStage - delays.get(a.id)!.daysInStage));
    const quarter = quarterOf(now);
    const { start, end } = quarterRange(quarter);
    const cohort = leadCohort(data.leads, start, end);
    const funnel = leadFunnel(cohort, data.deals);
    const bySource = funnelBy(cohort, data.deals, (l) => l.source || "Sin origen");
    const quals = new Map(data.leads.map((l) => [l.id, leadQualView(l, data.qualSettings)]));
    const pending = open.filter((l) => !l.qualified_at).length;
    return { delays, scores, quals, pending, open, late, quarter, funnel, bySource };
  }, [data]);

  async function move(id: string, stage: string) {
    const lead = data?.leads.find((l) => l.id === id);
    if (!lead || lead.stage === stage) return;
    if (lead.stage === "opportunity") return toast.info("Este lead ya es una oportunidad: síguelo desde Pipeline.");
    const { data: saved, error } = await supabase.from("leads").update({ stage }).eq("id", id).select("deal_id").single();
    if (error) return toast.error(errorText(error));
    touchLead(id);
    if (stage === "opportunity" && saved?.deal_id) toast.success(`${lead.company} ya es una oportunidad en el pipeline.`, { action: { label: "Ver en Pipeline", onClick: () => go({ to: "/deals", search: { deal: saved.deal_id! } }) } });
    qc.invalidateQueries({ queryKey: ["leads"] });
    qc.invalidateQueries({ queryKey: ["deals"] });
  }

  const selected = data?.leads.find((l) => l.id === search.lead);
  const shown = (l: Lead) => !search.late || view?.delays.get(l.id)?.late;
  const segName = (id: string | null) => data?.segments.find((s) => s.id === id)?.name;
  const byDate = search.orden === "fecha";

  return (
    <Page eyebrow="Leads" title={view ? leadsHeadline({ open: view.open.length, late: view.late.length }) : "Leads"} actions={<>
      <Button variant="outline" asChild><Link to="/leads/entrada"><ArrowDownToLine className="mr-1 size-4" />Entrada de leads</Link></Button>
      {view && <QualifyPending pending={view.pending} />}
      {data && <QualSettingsDialog settings={data.qualSettings} canEdit={canSettings} orgId={orgId!} />}
      {data && <SlaSettings sla={data.sla} canEdit={canSettings} orgId={orgId!} />}
      {data && <NewLead segments={data.segments} />}
    </>}>
      {!view || !data ? <p className="text-sm text-muted-foreground">Cargando leads…</p> : (
        <div className="space-y-8">
          <div className="grid gap-4 md:grid-cols-4">
            <Kpi label="Leads abiertos" v={String(view.open.length)} hint="Nuevo, Contactado, MQL y SQL" />
            <Kpi label="Retrasados" v={String(view.late.length)} hint={view.open.length ? `${pct(view.late.length / view.open.length)} de los abiertos` : "Sin leads abiertos"} tone={view.late.length ? "bad" : undefined} />
            <Kpi label={`Lead → Oportunidad ${view.quarter}`} v={view.funnel.total ? pct(view.funnel.steps[4].fromStart) : "—"} hint={view.funnel.medianDays.opportunity != null ? `Mediana ${view.funnel.medianDays.opportunity.toFixed(1)} días hasta oportunidad` : `${view.funnel.total} leads este trimestre`} />
            <Kpi label={`Lead → Ganado ${view.quarter}`} v={view.funnel.total ? pct(view.funnel.steps[5].fromStart) : "—"} hint={`${view.funnel.steps[5].count} ganados de ${view.funnel.total} leads`} />
          </div>

          <section className="rounded-lg border bg-card p-5">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-2xl">Conversión de los leads de {view.quarter}</h2>
              <Link to="/metrics" className="text-sm underline-offset-2 hover:underline">Ver el embudo completo en Métricas →</Link>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
              {view.funnel.steps.map((s, i) => (
                <div key={s.id} className="rounded-md bg-muted/50 p-3">
                  <p className="eyebrow">{s.label}</p>
                  <p className="font-display text-3xl">{s.count}</p>
                  <p className="text-xs text-muted-foreground">{i === 0 ? "entraron" : [s.fromPrev != null && s.count > s.direct ? `${pct(s.fromPrev)} del paso anterior` : "", s.direct > 0 ? `${s.direct} entrada directa` : ""].filter(Boolean).join(" · ")}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-3xl">Pipeline de leads</h2>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm"><Switch checked={!byDate} onCheckedChange={(v) => navigate({ search: (p) => ({ ...p, orden: v ? undefined : "fecha" }) })} />Por puntuación</label>
                <label className="flex items-center gap-2 text-sm"><Switch checked={!!search.late} onCheckedChange={(v) => navigate({ search: (p) => ({ ...p, late: v || undefined }) })} />Solo retrasados</label>
              </div>
            </div>
            {data.leads.length === 0 ? <Empty>Aún no hay leads. Créalos con «+ Nuevo lead» o conecta tus formularios y tu CRM en <Link to="/leads/entrada" className="underline">Entrada de leads</Link>.</Empty> : (
              <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-4 md:snap-none">
                {COLUMNS.map((st) => {
                  const all = data.leads.filter((l) => l.stage === st.id);
                  const col = byDate ? all.filter(shown) : [...all.filter(shown)].sort(byScore((l) => view.scores.get(l.id)!));
                  const lateN = all.filter((l) => view.delays.get(l.id)?.late).length;
                  const capped = st.id === "opportunity" || st.id === "disqualified" ? col.slice(0, 25) : col;
                  return (
                    <div key={st.id} className={`w-[80vw] max-w-72 shrink-0 snap-start rounded-lg p-2 md:w-auto md:min-w-40 md:max-w-none md:flex-1 ${st.id === "disqualified" ? "bg-muted/30" : "bg-muted/60"}`}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => move(e.dataTransfer.getData("id"), st.id)}>
                      <div className="flex items-center justify-between gap-2 px-2 py-2">
                        <span className="eyebrow">{st.label}</span>
                        <span className="shrink-0 font-mono text-xs">{all.length}{lateN ? <span className="ml-1 text-signal">· {lateN} tarde</span> : null}</span>
                      </div>
                      <div className="space-y-2">
                        {capped.map((l) => {
                          const d = view.delays.get(l.id)!;
                          return (
                            <button key={l.id} draggable onDragStart={(e) => e.dataTransfer.setData("id", l.id)}
                              onClick={() => navigate({ search: (p) => ({ ...p, lead: l.id }) })}
                              className={`block w-full rounded-md border bg-card p-3 text-left text-sm hover:border-signal ${d.late ? "border-signal/60" : ""}`}>
                              <span className="flex items-start justify-between gap-2"><span className="break-words font-medium"><CompanyLogo domain={l.email} size={16} className="mr-1.5 -mt-0.5" />{l.company}</span><ScoreBadge score={view.scores.get(l.id)!} /></span>
                              {(l.contact_name || l.email) && <span className="block truncate text-xs text-muted-foreground">{l.contact_name ?? l.email}</span>}
                              <span className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                                {l.source && <span className="rounded bg-muted px-1.5 py-0.5">{l.source}</span>}
                                {segName(l.segment_id) && <span className="rounded bg-muted px-1.5 py-0.5">{segName(l.segment_id)}</span>}
                                {st.id !== "opportunity" && st.id !== "disqualified" && <span className="font-mono">{Math.floor(d.daysInStage)} d</span>}
                              </span>
                              {st.id !== "opportunity" && st.id !== "disqualified" && view.quals.get(l.id)?.move && <span className="mt-1.5 block"><QualTag view={view.quals.get(l.id)!} /></span>}
                              {d.late && <span className="mt-2 flex items-start gap-1 text-[11px] text-signal"><AlertTriangle className="mt-0.5 size-3 shrink-0" />{delayText(d)}</span>}
                              {!d.late && l.next_step_at && st.id !== "opportunity" && st.id !== "disqualified" && <span className="mt-1 block text-[11px] text-muted-foreground">Seguimiento {l.next_step_at}</span>}
                            </button>
                          );
                        })}
                        {capped.length < col.length && <p className="px-2 text-xs text-muted-foreground">+{col.length - capped.length} más</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="text-xs text-muted-foreground"><span className="md:hidden">Desliza para ver todas las etapas. </span>La puntuación es el encaje con el ICP (70 %) más la actividad reciente (30 %); ábrelo para ver por qué y la calificación con IA (encaje, intención y cargo) con la etapa que propone. Arrastra un lead o ábrelo para cambiar su etapa. Al pasarlo a Oportunidad se crea su deal en la primera etapa del pipeline.</p>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title={`Retrasos (${view.late.length})`}>
              {view.late.length === 0 ? <Muted>Ningún lead va con retraso. Los plazos actuales son: {LEAD_STAGES.slice(0, 4).map((s) => `${s.label} ${data.sla[s.id as keyof typeof data.sla]} d`).join(" · ")}.</Muted> : view.late.slice(0, 12).map((l) => (
                <button key={l.id} onClick={() => navigate({ search: (p) => ({ ...p, lead: l.id }) })} className="flex w-full flex-col items-start gap-1 border-b py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 text-left text-sm last:border-0 hover:text-signal">
                  <span className="min-w-0 break-words"><span className="font-medium">{l.company}</span> <span className="text-xs text-muted-foreground">· {leadStageLabel(l.stage)}</span></span>
                  <span className="font-mono text-xs text-signal sm:text-right">{delayText(view.delays.get(l.id)!)}</span>
                </button>
              ))}
            </Panel>
            <Panel title={`Conversión por origen · ${view.quarter}`}>
              {view.bySource.length === 0 ? <Muted>Sin leads este trimestre.</Muted> : (
                <div className="overflow-x-auto"><table className="w-full text-sm">
                  <thead className="text-left"><tr>{["Origen", "Leads", "SQL", "Oport.", "Ganado"].map((h) => <th key={h} className="eyebrow pb-2 pr-3 last:pr-0 md:pr-0">{h}</th>)}</tr></thead>
                  <tbody>{view.bySource.map((g) => (
                    <tr key={g.key} className="border-t [&>td:not(:last-child)]:pr-3 md:[&>td]:pr-0"><td className="py-2">{g.key}</td><td className="font-mono">{g.total}</td><td className="font-mono">{g.counts.sql}</td><td className="font-mono">{pct(g.toOpportunity)}</td><td className="font-mono">{pct(g.toWon)}</td></tr>
                  ))}</tbody>
                </table></div>
              )}
            </Panel>
          </div>
        </div>
      )}
      <Sheet open={!!selected} onOpenChange={(o) => !o && navigate({ search: (p) => ({ ...p, lead: undefined }) })}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {selected && data && <LeadDetail lead={selected} data={data} score={view?.scores.get(selected.id)} canDelete={roles.includes("owner")} onClose={() => navigate({ search: (p) => ({ ...p, lead: undefined }) })} />}
        </SheetContent>
      </Sheet>
    </Page>
  );
}

function Kpi({ label, v, hint, tone }: { label: string; v: string; hint: string; tone?: "bad" }) {
  return <div className="rounded-lg border bg-card p-5"><p className="eyebrow">{label}</p><p className="mt-2 font-display text-4xl">{v}</p><p className={`mt-1 text-xs ${tone === "bad" ? "text-signal" : "text-muted-foreground"}`}>{hint}</p></div>;
}
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-lg border bg-card p-5"><h3 className="mb-3 text-2xl">{title}</h3>{children}</div>;
}
function Muted({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}
