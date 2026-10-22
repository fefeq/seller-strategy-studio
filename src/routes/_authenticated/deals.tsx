import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency, useMe } from "@/hooks/use-me";
import { Page, HealthDot } from "@/components/page";
import { Field, Pick } from "@/components/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAgent } from "@/components/agent";
import { MEDDPICC } from "@/lib/roles";
import { stageGate, TRACKS } from "@/lib/bmad/tracks";
import { errorText } from "@/lib/errors";
import { mergeServerEdits } from "@/lib/merge-edits";
import { isOverdue, pipelineHeadline } from "@/lib/headlines";
import { staleDeals, staleThreshold } from "@/lib/stale";
import { actuals } from "@/lib/pipeline-real";
import { StaleSettings, useStaleSettings } from "@/components/stale-settings";
import { DateField } from "@/components/date-field";
import { NewDealButton } from "@/components/new-deal";
import { StageSettings, useStages } from "@/components/stage-settings";
import { stageOptions, stagePath, stageProbability } from "@/lib/stages";

export const Route = createFileRoute("/_authenticated/deals")({
  validateSearch: (s: Record<string, unknown>) => ({ deal: typeof s.deal === "string" ? s.deal : undefined }),
  head: () => ({ meta: [{ title: "Pipeline — Nokko" }, { name: "description", content: "Pipeline por etapas, forecast y cualificación MEDDPICC." }, { property: "og:title", content: "Pipeline — Nokko" }, { property: "og:description", content: "Pipeline por etapas, forecast y cualificación MEDDPICC." }] }),
  component: Deals,
});


function Deals() {
  const { money: eur } = useCurrency();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  // With the agent docked beside it («Resolver»), the deal panel must not block the agent.
  const { docked: agentDocked } = useAgent();
  const qc = useQueryClient();
  const { data: deals = [] } = useQuery({
    queryKey: ["deals"],
    queryFn: async () => (await supabase.from("deals").select("*, accounts(name)").order("created_at")).data ?? [],
  });
  const open = deals.filter((d) => d.stage !== "won" && d.stage !== "lost");
  const selected = deals.find((d) => d.id === search.deal);
  const { data: me } = useMe();
  const { data: staleCfg } = useStaleSettings();
  const now = new Date();
  const cold = new Map(staleDeals(deals, staleCfg?.segments ?? [], staleCfg?.staleDays ?? null, now).map((r) => [r.deal.id, r]));
  const coldCount = [...cold.values()].filter((r) => r.stale).length;
  const companyThreshold = staleThreshold(actuals(deals, now).cycleDays, staleCfg?.staleDays ?? null);
  const canEditStale = (me?.roles ?? []).some((r) => r === "owner" || r === "sales_leader");
  const { stages } = useStages();

  async function move(id: string, stage: string) {
    const deal = deals.find((d) => d.id === id);
    if (deal && stage !== "lost") {
      const gate = stageGate({ amount: deal.amount, meddpicc: deal.meddpicc as Record<string, unknown> | null }, stage, stagePath(stages));
      if (gate.missing.length) toast.warning(`Camino ${TRACKS[gate.track].label}: para esta etapa falta ${gate.missing.join(", ")}.`, { description: "Puedes moverlo igualmente; completa la cualificación MEDDPICC del deal.", duration: 8000 });
    }
    if (stage === "won") {
      await supabase.from("approvals").insert({ kind: "stage_change", title: `Marcar como Ganado: ${deals.find((d) => d.id === id)?.name}`, evidence: JSON.stringify({ deal_id: id, stage }) });
      toast.info("Enviado a Aprobaciones: mover a Ganado requiere aprobación.");
      qc.invalidateQueries();
      return;
    }
    const { error } = await supabase.from("deals").update({ stage, probability: stageProbability(stage, stages) }).eq("id", id);
    if (error) toast.error(errorText(error));
    qc.invalidateQueries({ queryKey: ["deals"] });
  }

  return (
    <Page eyebrow="Pipeline" title={pipelineHeadline({ openDeals: open.length, openAmount: open.reduce((s, d) => s + Number(d.amount ?? 0), 0), overdue: open.filter((d) => isOverdue(d.close_date)).length, cold: coldCount, money: eur })} actions={<>
      {me?.currentOrg?.org_id && <StaleSettings staleDays={staleCfg?.staleDays ?? null} cycleDays={actuals(deals, now).cycleDays} canEdit={canEditStale} orgId={me.currentOrg.org_id} />}
      <Button variant="outline" asChild><Link to="/leads/entrada">Conectar leads reales</Link></Button>
      <StageSettings canEdit={canEditStale} />
      <NewDealButton />
    </>}>
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Kpi label="Pipeline abierto" v={eur(open.reduce((s, d) => s + Number(d.amount ?? 0), 0))} />
        <Kpi label="Forecast ponderado" v={eur(open.reduce((s, d) => s + Number(d.amount ?? 0) * (d.probability ?? 0) / 100, 0))} />
        <Kpi label="Ganado" v={eur(deals.filter((d) => d.stage === "won").reduce((s, d) => s + Number(d.amount ?? 0), 0))} />
      </div>
      <p className="mb-4 text-xs text-muted-foreground">Un deal se da por enfriado a los {companyThreshold.days} días sin actividad ({companyThreshold.source === "empresa" ? "fijado por la empresa" : companyThreshold.source === "ciclo" ? `un cuarto del ciclo real de ${companyThreshold.cycleDays} días` : "por defecto, aún sin ciclo real"}); cada segmento usa su propio ciclo cuando lo tiene.</p>
      <p className="mb-2 text-xs text-muted-foreground md:hidden">Desliza para ver todas las etapas. Abre un deal para cambiar su etapa.</p>
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-4 md:snap-none">
        {stages.map((st) => {
          const col = deals.filter((d) => d.stage === st.key);
          return (
            <div key={st.key} className="w-[80vw] max-w-72 shrink-0 snap-start rounded-lg bg-muted/60 p-2 md:w-64 md:max-w-none"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => move(e.dataTransfer.getData("id"), st.key)}>
              <div className="flex justify-between gap-3 px-2 py-2"><span className="eyebrow">{st.label}</span><span className="shrink-0 font-mono text-xs">{eur(col.reduce((s, d) => s + Number(d.amount ?? 0), 0))}</span></div>
              <div className="space-y-2">
                {col.map((d) => (
                  <button key={d.id} draggable onDragStart={(e) => e.dataTransfer.setData("id", d.id)}
                    onClick={() => navigate({ search: { deal: d.id } })}
                    className={`block w-full rounded-md border bg-card p-3 text-left text-sm hover:border-signal ${cold.get(d.id)?.stale ? "border-signal/60" : ""}`}>
                    <span className="break-words font-medium">{d.name}</span>
                    {d.accounts?.name && d.accounts.name.trim().toLowerCase() !== d.name.trim().toLowerCase() && <span className="block text-xs text-muted-foreground">{d.accounts.name}</span>}
                    {cold.get(d.id)?.stale && <span className="mt-1 block text-[11px] text-signal">Enfriado: {cold.get(d.id)!.idleDays} días sin actividad (umbral {cold.get(d.id)!.threshold.days})</span>}
                    <span className="mt-2 flex items-center justify-between"><span className="font-mono text-xs">{eur(Number(d.amount ?? 0))}</span><HealthDot value={d.health} /></span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <Sheet open={!!selected} onOpenChange={(o) => !o && navigate({ search: { deal: undefined } })} modal={!agentDocked}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl" onInteractOutside={agentDocked ? (e) => e.preventDefault() : undefined}>
          {selected && <DealDetail deal={selected} onMove={(stage) => move(selected.id, stage)} onSaved={() => qc.invalidateQueries({ queryKey: ["deals"] })} />}
        </SheetContent>
      </Sheet>
    </Page>
  );
}

function Kpi({ label, v }: { label: string; v: string }) {
  return <div className="rounded-lg border bg-card p-5"><p className="eyebrow">{label}</p><p className="mt-2 font-display text-4xl">{v}</p></div>;
}

function DealDetail({ deal, onMove, onSaved }: { deal: any; onMove: (stage: string) => Promise<void>; onSaved: () => void }) {
  const { money: eur, symbol } = useCurrency();
  const { stages } = useStages();
  const [d, setD] = useState(deal);
  // When the deal refreshes (stage change, realtime, save), keep what the person is still editing.
  const server = useRef(deal);
  useEffect(() => {
    const prev = server.current;
    server.current = deal;
    if (prev === deal) return;
    setD((cur: any) => (prev.id !== deal.id ? deal : mergeServerEdits(cur, prev, deal)));
  }, [deal]);
  const m: Record<string, { score: number; note: string }> = d.meddpicc ?? {};
  const qc = useQueryClient();
  const { data: items = [] } = useQuery({
    queryKey: ["map", deal.id],
    queryFn: async () => (await supabase.from("mutual_action_items").select("*").eq("deal_id", deal.id).order("due_date")).data ?? [],
  });
  const [newItem, setNewItem] = useState(""); const [due, setDue] = useState(""); const [side, setSide] = useState("nosotros");
  const { data: lookups = { segments: [], partners: [] } } = useQuery({
    queryKey: ["deal-lookups"],
    queryFn: async () => {
      const [s, p] = await Promise.all([supabase.from("segments").select("id,name"), supabase.from("partners").select("id,name")]);
      return { segments: s.data ?? [], partners: p.data ?? [] };
    },
  });
  const total = MEDDPICC.reduce((s, [k]) => s + (m[k]?.score ?? 0), 0);

  async function save() {
    const { error } = await supabase.from("deals").update({ name: d.name, amount: d.amount, close_date: d.close_date || null, probability: d.probability, health: d.health, meddpicc: d.meddpicc, forecast_category: d.forecast_category, source: d.source, segment_id: d.segment_id || null, partner_id: d.partner_id || null }).eq("id", d.id);
    if (error) return toast.error(errorText(error));
    toast.success("Deal guardado."); onSaved();
  }
  async function addItem() {
    await supabase.from("mutual_action_items").insert({ deal_id: deal.id, title: newItem, due_date: due || null, owner_side: side });
    setNewItem(""); setDue(""); qc.invalidateQueries({ queryKey: ["map", deal.id] });
  }
  async function toggle(id: string, done: boolean) {
    await supabase.from("mutual_action_items").update({ done }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["map", deal.id] });
  }
  async function requestDiscount() {
    await supabase.from("approvals").insert({ kind: "discount", title: `Descuento para ${d.name}`, evidence: `Importe: ${eur(Number(d.amount ?? 0))}. Justificación: añade el contexto en la cuenta.` });
    toast.success("Solicitud enviada a Deal Desk.");
  }

  return (
    <div className="space-y-6">
      <SheetHeader><SheetTitle className="break-words pr-10 font-display text-3xl">{d.name}</SheetTitle></SheetHeader>
      {d.account_id && <Link to="/accounts/$id" params={{ id: d.account_id }} className="text-sm text-signal">Abrir cuenta y plan →</Link>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Same path as drag & drop: MEDDPICC gate, Ganado → Aprobaciones. Saved immediately, not with "Guardar deal". */}
        <Field label="Etapa"><Pick value={deal.stage} options={stageOptions(stages, true)} onChange={(v) => { if (v !== deal.stage) void onMove(v); }} /></Field>
        <Field label="Nombre"><Input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></Field>
        <Field label={`Importe (${symbol})`}><Input type="number" value={d.amount ?? 0} onChange={(e) => setD({ ...d, amount: Number(e.target.value) })} /></Field>
        <Field label="Fecha de cierre"><DateField value={d.close_date} onChange={(iso) => setD({ ...d, close_date: iso })} /></Field>
        <Field label="Probabilidad (%)"><Input type="number" min={0} max={100} value={d.probability ?? 0} onChange={(e) => setD({ ...d, probability: Number(e.target.value) })} /></Field>
        <Field label="Salud"><Pick value={d.health} options={{ green: "Sano", yellow: "Atención", red: "En riesgo" }} onChange={(v) => setD({ ...d, health: v })} /></Field>
        <Field label="Categoría de forecast"><Pick value={d.forecast_category ?? "pipeline"} options={{ commit: "Commit", best_case: "Best case", pipeline: "Pipeline", omitted: "Omitido" }} onChange={(v) => setD({ ...d, forecast_category: v })} /></Field>
        <Field label="Fuente"><Pick value={d.source ?? "outbound"} options={{ outbound: "Outbound", inbound: "Inbound", partner: "Partner", plg: "Producto (PLG)", event: "Evento", referral: "Referido" }} onChange={(v) => setD({ ...d, source: v })} /></Field>
        <Field label="Segmento"><Pick value={d.segment_id ?? ""} options={Object.fromEntries([["", "—"], ...lookups.segments.map((s) => [s.id, s.name])])} onChange={(v) => setD({ ...d, segment_id: v })} /></Field>
        <Field label="Partner"><Pick value={d.partner_id ?? ""} options={Object.fromEntries([["", "—"], ...lookups.partners.map((s) => [s.id, s.name])])} onChange={(v) => setD({ ...d, partner_id: v })} /></Field>
      </div>
      {d.slip_count > 0 && <p className="text-xs text-signal">La fecha de cierre se ha retrasado {d.slip_count} {d.slip_count === 1 ? "vez" : "veces"}.</p>}

      <div>
        <div className="mb-2 flex items-baseline justify-between"><h3 className="text-2xl">MEDDPICC</h3><span className="font-mono text-sm">{total}/24</span></div>
        <div className="space-y-2">
          {MEDDPICC.map(([k, label, q]) => (
            <div key={k} className={`rounded-md border p-3 ${(m[k]?.score ?? 0) === 0 ? "border-signal/50" : ""}`}>
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 text-sm font-medium">{label}</span>
                <div className="flex shrink-0 gap-1">
                  {[0, 1, 2, 3].map((n) => (
                    <button key={n} onClick={() => setD({ ...d, meddpicc: { ...m, [k]: { ...m[k], score: n } } })}
                      className={`size-9 rounded md:size-6 font-mono text-xs ${(m[k]?.score ?? 0) === n ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{n}</button>
                  ))}
                </div>
              </div>
              <Textarea rows={1} placeholder={q} className="mt-2 md:text-sm" value={m[k]?.note ?? ""} onChange={(e) => setD({ ...d, meddpicc: { ...m, [k]: { score: m[k]?.score ?? 0, note: e.target.value } } })} />
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-2"><Button onClick={save}>Guardar deal</Button><Button variant="outline" onClick={requestDiscount}>Pedir descuento</Button></div>

      <div>
        <h3 className="mb-2 text-2xl">Plan de acción conjunto</h3>
        <div className="space-y-1.5">
          {items.map((i) => (
            <label key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border p-2.5 text-sm">
              <Checkbox checked={i.done} onCheckedChange={(v) => toggle(i.id, !!v)} />
              <span className={`min-w-0 flex-1 break-words ${i.done ? "line-through opacity-60" : ""}`}>{i.title}</span>
              <span className="w-full pl-7 font-mono text-xs text-muted-foreground sm:ml-auto sm:w-auto sm:pl-0">{i.owner_side} · {i.due_date ?? "sin fecha"}</span>
            </label>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-[1fr_auto_auto] gap-2 sm:flex">
          <Input placeholder="Hito (p. ej. revisión de seguridad)" className="col-span-3 sm:col-span-1" value={newItem} onChange={(e) => setNewItem(e.target.value)} />
          <DateField aria-label="Fecha del hito" className="w-full sm:w-40" value={due || null} onChange={(iso) => setDue(iso ?? "")} />
          <select className="h-10 rounded-md border bg-background px-2 text-base md:h-auto md:text-sm" value={side} onChange={(e) => setSide(e.target.value)}><option value="nosotros">Nosotros</option><option value="cliente">Cliente</option></select>
          <Button disabled={!newItem} onClick={addItem}>+</Button>
        </div>
      </div>
    </div>
  );
}
