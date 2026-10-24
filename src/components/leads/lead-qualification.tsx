import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useJob, useLeadTouched } from "@/components/background";
import type { Lead, LeadsData } from "@/hooks/use-leads";
import { Field } from "@/components/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PROPOSAL_LABEL, qualificationView, readQualSettings, readQualification, type QualSettings, type QualView } from "@/lib/lead-qualification";
import { leadStageLabel } from "@/lib/lead-funnel";
import { errorText } from "@/lib/errors";
import type { Json } from "@/integrations/supabase/types";

/** The stored Jev answers read with the company's weights; null when the lead was never qualified. */
export function leadQualView(lead: Lead, settings: QualSettings): QualView | null {
  const q = readQualification(lead.qualification);
  return q ? qualificationView(q, settings, lead.stage) : null;
}

/** One short line for the lead card: the proposed step, only when it changes something. */
export function QualTag({ view }: { view: QualView | null }) {
  if (!view?.move) return null;
  return (
    <span className={`font-mono text-[11px] ${view.move === "disqualified" ? "text-muted-foreground" : "text-ink"}`} title={view.reason}>
      IA: {view.move === "disqualified" ? "descartar" : `pasar a ${PROPOSAL_LABEL[view.move]}`} · {view.total}{view.review ? " · revisar" : ""}
    </span>
  );
}

/** Jev qualification runs in the background (up to 25 leads per run); the notice says what it proposes. */
function useQualify() {
  const qc = useQueryClient();
  const { job, running, start } = useJob("qualify_leads", { onDone: () => qc.invalidateQueries({ queryKey: ["leads"] }) });
  const go = (ids?: string[]) => start(ids ? { ids } : {});
  return { go, busy: running, job };
}

/** Qualifies the open leads that have no qualification yet (up to 25 per run). */
export function QualifyPending({ pending }: { pending: number }) {
  const { go, busy } = useQualify();
  if (!pending && !busy) return null;
  return <Button variant="outline" disabled={busy} onClick={() => go()}>{busy ? "Calificando en segundo plano…" : `Calificar con IA (${pending > 25 ? "25 de " : ""}${pending})`}</Button>;
}

export function QualificationPanel({ lead, data }: { lead: Lead; data: LeadsData }) {
  const qc = useQueryClient();
  const touchLead = useLeadTouched();
  const { go, busy } = useQualify();
  const view = leadQualView(lead, data.qualSettings);
  const segName = (id: string | null) => data.segments.find((s) => s.id === id)?.name;

  async function apply(patch: Partial<Lead>, done: string) {
    const { error } = await supabase.from("leads").update(patch).eq("id", lead.id);
    if (error) return toast.error(errorText(error));
    touchLead(lead.id);
    toast.success(done);
    qc.invalidateQueries({ queryKey: ["leads"] });
  }

  if (!view) {
    return (
      <div className="rounded-lg border bg-card p-4">
        <p className="eyebrow">Calificación con IA</p>
        <p className="mt-1 text-sm text-muted-foreground">Sin calificar. La IA juzga el encaje con tu ICP, la intención de compra y el cargo, y propone la etapa.</p>
        <Button variant="outline" className="mt-3" disabled={busy} onClick={() => go([lead.id])}>{busy ? "Calificando…" : "Calificar ahora"}</Button>
      </div>
    );
  }
  const proposedSeg = !lead.segment_id && view.segmentId ? segName(view.segmentId) : null;
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="eyebrow">Calificación con IA</p>
        <p className="font-display text-3xl">{view.total}<span className="ml-2 text-sm text-muted-foreground">{PROPOSAL_LABEL[view.proposal]}</span></p>
      </div>
      <p className="mt-1 text-sm">{view.reason}{view.review && <span className="ml-1 text-signal">Revísalo: la IA no lo tiene claro.</span>}</p>
      <ul className="mt-3 space-y-1.5 text-xs">
        {view.parts.map((p) => (
          <li key={p.id} className="grid grid-cols-[9rem_2.5rem_1fr] gap-2">
            <span className="font-medium">{p.label}</span>
            <span className="font-mono">{p.value ?? "—"}</span>
            <span className="text-muted-foreground">{p.level ?? (p.id === "fit" ? "Sin datos de la empresa para juzgarlo" : "Sin cargo")}{p.value != null && <span className="ml-1">· peso {p.weight}</span>}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        {view.move && <Button size="sm" onClick={() => apply(view.move === "disqualified" ? { stage: "disqualified", disqualified_reason: view.reason } : { stage: view.move! }, view.move === "disqualified" ? "Lead descartado." : `Lead pasado a ${leadStageLabel(view.move!)}.`)}>{view.move === "disqualified" ? "Descartar" : `Pasar a ${leadStageLabel(view.move)}`}</Button>}
        {proposedSeg && <Button size="sm" variant="outline" onClick={() => apply({ segment_id: view.segmentId }, `Segmento ${proposedSeg} asignado.`)}>Asignar segmento {proposedSeg}</Button>}
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => go([lead.id])}>{busy ? "Calificando…" : "Volver a calificar"}</Button>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">Calificado el {new Date(lead.qualified_at ?? "").toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}. Vuelve a calificar si cambias sus notas, su cargo o los datos de la empresa.</p>
    </div>
  );
}

export function QualSettingsDialog({ settings, canEdit, orgId }: { settings: QualSettings; canEdit: boolean; orgId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<QualSettings>(settings);
  const w = (k: keyof QualSettings["weights"]) => (e: React.ChangeEvent<HTMLInputElement>) => setV((p) => ({ ...p, weights: { ...p.weights, [k]: Number(e.target.value) } }));

  async function save() {
    const clean = readQualSettings(v);
    const { error } = await supabase.from("lead_settings").upsert({ org_id: orgId, qualification: clean as unknown as Json, updated_at: new Date().toISOString() }, { onConflict: "org_id" });
    if (error) return toast.error(errorText(error));
    toast.success("Pesos guardados: las propuestas se recalculan sin volver a usar la IA.");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["leads"] });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setV(settings); }}>
      <DialogTrigger asChild><Button variant="outline">Pesos de la calificación</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>¿Cómo se califica un lead?</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">La IA juzga tres cosas; tú decides cuánto pesa cada una y desde qué nota se propone MQL o SQL. Para SQL hace falta, además, que se conozca el encaje y que pida hablar del producto. Cambiar esto no gasta IA.</p>
        <div className="grid grid-cols-3 gap-3">
          {([["fit", "Encaje con el ICP"], ["intent", "Intención"], ["authority", "Poder de decisión"]] as const).map(([k, label]) => (
            <Field key={k} label={label}>{canEdit ? <Input type="number" min={0} max={100} value={v.weights[k]} onChange={w(k)} /> : <p className="font-mono">{settings.weights[k]}</p>}</Field>
          ))}
          <Field label="MQL desde">{canEdit ? <Input type="number" min={0} max={100} value={v.mql} onChange={(e) => setV((p) => ({ ...p, mql: Number(e.target.value) }))} /> : <p className="font-mono">{settings.mql}</p>}</Field>
          <Field label="SQL desde">{canEdit ? <Input type="number" min={0} max={100} value={v.sql} onChange={(e) => setV((p) => ({ ...p, sql: Number(e.target.value) }))} /> : <p className="font-mono">{settings.sql}</p>}</Field>
        </div>
        {canEdit ? <Button className="w-full" onClick={save}>Guardar pesos</Button> : <p className="text-xs text-muted-foreground">Solo Owner, Sales Leader o Marketing pueden cambiar los pesos.</p>}
      </DialogContent>
    </Dialog>
  );
}
