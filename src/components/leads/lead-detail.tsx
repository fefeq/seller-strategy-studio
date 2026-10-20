import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/hooks/use-me";
import type { Lead, LeadsData } from "@/hooks/use-leads";
import { Field, Pick } from "@/components/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DISQUALIFIED, LEAD_STAGES, delayText, leadDelay, leadStageLabel } from "@/lib/lead-funnel";
import { errorText } from "@/lib/errors";
import { ScoreDetail } from "@/components/score";
import type { Score } from "@/lib/scoring";

const STAGE_OPTS = Object.fromEntries([...LEAD_STAGES, DISQUALIFIED].map((s) => [s.id, s.label]));
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) : "—");

export function LeadDetail({ lead, data, score, canDelete, onClose }: { lead: Lead; data: LeadsData; score?: Score; canDelete: boolean; onClose: () => void }) {
  const { symbol } = useCurrency();
  const qc = useQueryClient();
  const [f, setF] = useState(lead);
  useEffect(() => setF(lead), [lead]);
  const set = <K extends keyof Lead>(k: K, v: Lead[K]) => setF((p) => ({ ...p, [k]: v }));
  const delay = leadDelay(lead, data.sla);
  const converted = lead.stage === "opportunity";

  async function save() {
    const { data: saved, error } = await supabase.from("leads").update({
      company: f.company.trim() || lead.company,
      contact_name: f.contact_name || null,
      email: f.email || null,
      title: f.title || null,
      stage: converted ? lead.stage : f.stage,
      source: f.source || null,
      segment_id: f.segment_id || null,
      owner_id: f.owner_id || null,
      amount: f.amount == null || (f.amount as unknown) === "" ? null : Number(f.amount),
      next_step: f.next_step ?? "",
      next_step_at: f.next_step_at || null,
      notes: f.notes ?? "",
      disqualified_reason: f.stage === "disqualified" ? f.disqualified_reason || null : null,
    }).eq("id", lead.id).select("deal_id").single();
    if (error) return toast.error(errorText(error));
    toast.success(!converted && f.stage === "opportunity" && saved?.deal_id ? "Convertido en oportunidad: ya está en Pipeline" : "Lead guardado");
    qc.invalidateQueries({ queryKey: ["leads"] });
    qc.invalidateQueries({ queryKey: ["deals"] });
  }

  async function remove() {
    if (!confirm(`¿Borrar el lead ${lead.company}? Su oportunidad, si la tiene, se mantiene en Pipeline.`)) return;
    const { error } = await supabase.from("leads").delete().eq("id", lead.id);
    if (error) return toast.error(errorText(error));
    qc.invalidateQueries({ queryKey: ["leads"] });
    onClose();
  }

  const timeline: [string, string | null][] = [
    ["Entró", lead.created_at], ["Contactado", lead.contacted_at], ["MQL", lead.mql_at], ["SQL", lead.sql_at], ["Oportunidad", lead.opportunity_at],
    ...(lead.disqualified_at ? [["Descartado", lead.disqualified_at] as [string, string]] : []),
  ];

  return (
    <div className="space-y-5">
      <SheetHeader>
        <p className="eyebrow pr-10">{leadStageLabel(lead.stage)} · {Math.floor(delay.daysInStage)} días en la etapa</p>
        <SheetTitle className="break-words pr-10 text-3xl">{lead.company}</SheetTitle>
      </SheetHeader>
      {delay.late && <p className="rounded-md bg-signal/10 p-3 text-sm text-signal">Con retraso: {delayText(delay)}.</p>}
      {converted && lead.deal_id && (
        <p className="rounded-md bg-muted p-3 text-sm">Ya es una oportunidad. <Link to="/deals" search={{ deal: lead.deal_id }} className="font-medium underline">Abrir en Pipeline →</Link></p>
      )}

      {score && <ScoreDetail score={score} />}

      <ol className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {timeline.map(([label, at]) => (
          <li key={label} className={`rounded-md border p-2 text-xs ${at ? "" : "opacity-40"}`}><p className="eyebrow">{label}</p><p>{fmt(at)}</p></li>
        ))}
      </ol>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Etapa">{converted ? <p className="text-sm">Oportunidad</p> : <Pick value={f.stage} options={STAGE_OPTS} onChange={(v) => set("stage", v)} />}</Field>
        <Field label="Responsable"><Pick value={f.owner_id ?? ""} options={{ "": "Sin asignar", ...Object.fromEntries(data.members.map((m) => [m.id, m.full_name])) }} onChange={(v) => set("owner_id", v || null)} /></Field>
        <Field label="Empresa"><Input value={f.company} onChange={(e) => set("company", e.target.value)} /></Field>
        <Field label="Contacto"><Input value={f.contact_name ?? ""} onChange={(e) => set("contact_name", e.target.value)} /></Field>
        <Field label="Email"><Input value={f.email ?? ""} onChange={(e) => set("email", e.target.value)} /></Field>
        <Field label="Cargo"><Input value={f.title ?? ""} onChange={(e) => set("title", e.target.value)} /></Field>
        <Field label="Origen"><Input value={f.source ?? ""} onChange={(e) => set("source", e.target.value)} /></Field>
        <Field label="Segmento"><Pick value={f.segment_id ?? ""} options={{ "": "Sin segmento", ...Object.fromEntries(data.segments.map((s) => [s.id, s.name])) }} onChange={(v) => set("segment_id", v || null)} /></Field>
        <Field label={`Valor estimado (${symbol})`}><Input type="number" value={f.amount ?? ""} onChange={(e) => set("amount", e.target.value === "" ? null : Number(e.target.value))} /></Field>
        <Field label="Próximo seguimiento"><Input type="date" value={f.next_step_at ?? ""} onChange={(e) => set("next_step_at", e.target.value || null)} /></Field>
        <div className="sm:col-span-2"><Field label="Próximo paso"><Input value={f.next_step ?? ""} onChange={(e) => set("next_step", e.target.value)} placeholder="Llamada de cualificación, enviar caso de éxito…" /></Field></div>
        {f.stage === "disqualified" && <div className="sm:col-span-2"><Field label="Motivo del descarte"><Input value={f.disqualified_reason ?? ""} onChange={(e) => set("disqualified_reason", e.target.value)} placeholder="Sin presupuesto, fuera de ICP, sin respuesta…" /></Field></div>}
        <div className="sm:col-span-2"><Field label="Notas"><Textarea rows={4} value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></Field></div>
      </div>
      {!converted && f.stage === "opportunity" && <p className="text-xs text-muted-foreground">Al guardar se creará su deal en Discovery dentro de la Pipeline.</p>}
      <div className="flex gap-2">
        <Button className="flex-1" onClick={save}>Guardar</Button>
        {canDelete && <Button variant="ghost" onClick={remove}>Borrar</Button>}
      </div>
    </div>
  );
}
