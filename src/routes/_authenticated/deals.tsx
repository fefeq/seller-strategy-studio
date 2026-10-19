import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/hooks/use-me";
import { Page, HealthDot } from "@/components/page";
import { Field, Pick } from "@/components/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DEAL_STAGES, MEDDPICC } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/deals")({
  validateSearch: (s: Record<string, unknown>) => ({ deal: typeof s.deal === "string" ? s.deal : undefined }),
  head: () => ({ meta: [{ title: "Pipeline — GTM Brain" }, { name: "description", content: "Pipeline por etapas, forecast y cualificación MEDDPICC." }, { property: "og:title", content: "Pipeline — GTM Brain" }, { property: "og:description", content: "Pipeline por etapas, forecast y cualificación MEDDPICC." }] }),
  component: Deals,
});


function Deals() {
  const { money: eur } = useCurrency();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const qc = useQueryClient();
  const { data: deals = [] } = useQuery({
    queryKey: ["deals"],
    queryFn: async () => (await supabase.from("deals").select("*, accounts(name)").order("created_at")).data ?? [],
  });
  const open = deals.filter((d) => d.stage !== "won" && d.stage !== "lost");
  const selected = deals.find((d) => d.id === search.deal);

  async function move(id: string, stage: string) {
    const prob: Record<string, number> = { discovery: 10, qualified: 25, demo: 40, proposal: 60, negotiation: 80, won: 100, lost: 0 };
    if (stage === "won") {
      await supabase.from("approvals").insert({ kind: "stage_change", title: `Marcar como Ganado: ${deals.find((d) => d.id === id)?.name}`, evidence: JSON.stringify({ deal_id: id, stage }) });
      toast.info("Enviado a Aprobaciones: mover a Ganado requiere aprobación.");
      qc.invalidateQueries();
      return;
    }
    await supabase.from("deals").update({ stage, probability: prob[stage] }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["deals"] });
  }

  return (
    <Page eyebrow="Pipeline y forecast" title="Pipeline">
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Kpi label="Pipeline abierto" v={eur(open.reduce((s, d) => s + Number(d.amount ?? 0), 0))} />
        <Kpi label="Forecast ponderado" v={eur(open.reduce((s, d) => s + Number(d.amount ?? 0) * (d.probability ?? 0) / 100, 0))} />
        <Kpi label="Ganado" v={eur(deals.filter((d) => d.stage === "won").reduce((s, d) => s + Number(d.amount ?? 0), 0))} />
      </div>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {DEAL_STAGES.map((st) => {
          const col = deals.filter((d) => d.stage === st.id);
          return (
            <div key={st.id} className="w-64 shrink-0 rounded-lg bg-muted/60 p-2"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => move(e.dataTransfer.getData("id"), st.id)}>
              <div className="flex justify-between px-2 py-2"><span className="eyebrow">{st.label}</span><span className="font-mono text-xs">{eur(col.reduce((s, d) => s + Number(d.amount ?? 0), 0))}</span></div>
              <div className="space-y-2">
                {col.map((d) => (
                  <button key={d.id} draggable onDragStart={(e) => e.dataTransfer.setData("id", d.id)}
                    onClick={() => navigate({ search: { deal: d.id } })}
                    className="block w-full rounded-md border bg-card p-3 text-left text-sm hover:border-signal">
                    <span className="font-medium">{d.name}</span>
                    <span className="block text-xs text-muted-foreground">{d.accounts?.name}</span>
                    <span className="mt-2 flex items-center justify-between"><span className="font-mono text-xs">{eur(Number(d.amount ?? 0))}</span><HealthDot value={d.health} /></span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <Sheet open={!!selected} onOpenChange={(o) => !o && navigate({ search: { deal: undefined } })}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          {selected && <DealDetail deal={selected} onSaved={() => qc.invalidateQueries({ queryKey: ["deals"] })} />}
        </SheetContent>
      </Sheet>
    </Page>
  );
}

function Kpi({ label, v }: { label: string; v: string }) {
  return <div className="rounded-lg border bg-card p-5"><p className="eyebrow">{label}</p><p className="mt-2 font-display text-4xl">{v}</p></div>;
}

function DealDetail({ deal, onSaved }: { deal: any; onSaved: () => void }) {
  const { money: eur, symbol } = useCurrency();
  const [d, setD] = useState(deal);
  useEffect(() => setD(deal), [deal]);
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
    if (error) return toast.error(error.message);
    toast.success("Deal guardado"); onSaved();
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
    toast.success("Solicitud enviada a Deal Desk");
  }

  return (
    <div className="space-y-6">
      <SheetHeader><SheetTitle className="font-display text-3xl font-normal">{d.name}</SheetTitle></SheetHeader>
      {d.account_id && <Link to="/accounts/$id" params={{ id: d.account_id }} className="text-sm text-signal">Abrir cuenta y Account Plan →</Link>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nombre"><Input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></Field>
        <Field label={`Importe (${symbol})`}><Input type="number" value={d.amount ?? 0} onChange={(e) => setD({ ...d, amount: Number(e.target.value) })} /></Field>
        <Field label="Fecha de cierre"><Input type="date" value={d.close_date ?? ""} onChange={(e) => setD({ ...d, close_date: e.target.value })} /></Field>
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
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{label}</span>
                <div className="flex gap-1">
                  {[0, 1, 2, 3].map((n) => (
                    <button key={n} onClick={() => setD({ ...d, meddpicc: { ...m, [k]: { ...m[k], score: n } } })}
                      className={`size-6 rounded font-mono text-xs ${(m[k]?.score ?? 0) === n ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{n}</button>
                  ))}
                </div>
              </div>
              <Textarea rows={1} placeholder={q} className="mt-2 text-sm" value={m[k]?.note ?? ""} onChange={(e) => setD({ ...d, meddpicc: { ...m, [k]: { score: m[k]?.score ?? 0, note: e.target.value } } })} />
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-2"><Button onClick={save}>Guardar deal</Button><Button variant="outline" onClick={requestDiscount}>Pedir descuento</Button></div>

      <div>
        <h3 className="mb-2 text-2xl">Mutual Action Plan</h3>
        <div className="space-y-1.5">
          {items.map((i) => (
            <label key={i.id} className="flex items-center gap-3 rounded-md border p-2.5 text-sm">
              <Checkbox checked={i.done} onCheckedChange={(v) => toggle(i.id, !!v)} />
              <span className={i.done ? "line-through opacity-60" : ""}>{i.title}</span>
              <span className="ml-auto font-mono text-xs text-muted-foreground">{i.owner_side} · {i.due_date ?? "sin fecha"}</span>
            </label>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <Input placeholder="Hito (p. ej. revisión de seguridad)" value={newItem} onChange={(e) => setNewItem(e.target.value)} />
          <Input type="date" className="w-40" value={due} onChange={(e) => setDue(e.target.value)} />
          <select className="rounded-md border bg-background px-2 text-sm" value={side} onChange={(e) => setSide(e.target.value)}><option value="nosotros">Nosotros</option><option value="cliente">Cliente</option></select>
          <Button disabled={!newItem} onClick={addItem}>+</Button>
        </div>
      </div>
    </div>
  );
}
