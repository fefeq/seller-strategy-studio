import { Trash2 } from "lucide-react";
import { IconText } from "@/components/icon-text";
import { useEffect, useState } from "react";
import { useLeadTouched } from "@/components/background";
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
import { FOLLOWUP_STEPS, followupStatus } from "@/lib/followup";
import { DateField } from "@/components/date-field";
import { EntityCombobox, useAccountOptions } from "@/components/entity-combobox";
import { QualificationPanel } from "@/components/leads/lead-qualification";
import { LeadFlowPanel } from "@/components/leads/lead-flow";
import { askConfirm } from "@/components/confirm-dialog";
import { EmailVerificationMark, useEmailVerifications } from "@/components/email-verification";

const STAGE_OPTS = Object.fromEntries([...LEAD_STAGES, DISQUALIFIED].map((s) => [s.id, s.label]));
const fmt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

export function LeadDetail({
  lead,
  data,
  score,
  canDelete,
  onClose,
}: {
  lead: Lead;
  data: LeadsData;
  score?: Score;
  canDelete: boolean;
  onClose: () => void;
}) {
  const { symbol } = useCurrency();
  const qc = useQueryClient();
  const [f, setF] = useState(lead);
  const verification = useEmailVerifications([f.email]);
  const touchLead = useLeadTouched();
  useEffect(() => setF(lead), [lead]);
  const set = <K extends keyof Lead>(k: K, v: Lead[K]) => setF((p) => ({ ...p, [k]: v }));
  const { data: accounts = [] } = useAccountOptions();
  const delay = leadDelay(lead, data.sla);
  const converted = lead.stage === "opportunity";

  async function save() {
    const { data: saved, error } = await supabase
      .from("leads")
      .update({
        company: f.company.trim() || lead.company,
        account_id: f.account_id ?? null,
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
      })
      .eq("id", lead.id)
      .select("deal_id")
      .single();
    if (error) return toast.error(errorText(error));
    touchLead(lead.id);
    toast.success(
      !converted && f.stage === "opportunity" && saved?.deal_id
        ? "Convertido en oportunidad: ya está en Pipeline"
        : "Lead guardado",
    );
    qc.invalidateQueries({ queryKey: ["leads"] });
    qc.invalidateQueries({ queryKey: ["deals"] });
  }

  async function remove() {
    if (
      !(await askConfirm(`¿Borrar el lead ${lead.company}?`, {
        body: "Su oportunidad, si la tiene, se mantiene en Pipeline.",
        confirmLabel: "Borrar",
      }))
    )
      return;
    const { error } = await supabase.from("leads").delete().eq("id", lead.id);
    if (error) return toast.error(errorText(error));
    qc.invalidateQueries({ queryKey: ["leads"] });
    onClose();
  }

  const timeline: [string, string | null][] = [
    ["Entró", lead.created_at],
    ["Contactado", lead.contacted_at],
    ["MQL", lead.mql_at],
    ["SQL", lead.sql_at],
    ["Oportunidad", lead.opportunity_at],
    ...(lead.disqualified_at ? [["Descartado", lead.disqualified_at] as [string, string]] : []),
  ];

  return (
    <div className="space-y-5">
      <SheetHeader>
        <p className="eyebrow pr-10">
          {leadStageLabel(lead.stage)} · {Math.floor(delay.daysInStage)}{" "}
          {Math.floor(delay.daysInStage) === 1 ? "día" : "días"} en la etapa
        </p>
        <SheetTitle className="break-words pr-10 text-3xl">{lead.company}</SheetTitle>
      </SheetHeader>
      {delay.late && (
        <p className="rounded-md bg-signal/10 p-3 text-sm text-signal">
          Con retraso: {delayText(delay)}.
        </p>
      )}
      {converted && lead.deal_id && (
        <p className="rounded-md bg-muted p-3 text-sm">
          Ya es una oportunidad.{" "}
          <Link to="/deals" search={{ deal: lead.deal_id }} className="font-medium underline">
            Abrir en Pipeline →
          </Link>
        </p>
      )}

      {!converted && <LeadFlowPanel lead={lead} />}
      {!converted && <QualificationPanel lead={lead} data={data} />}
      {score && <ScoreDetail score={score} />}
      <FollowupLine lead={lead} />

      <ol className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {timeline.map(([label, at]) => (
          <li key={label} className={`rounded-md border p-2 text-xs ${at ? "" : "opacity-40"}`}>
            <p className="eyebrow">{label}</p>
            <p>{fmt(at)}</p>
          </li>
        ))}
      </ol>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Etapa">
          {converted ? (
            <p className="text-sm">Oportunidad</p>
          ) : (
            <Pick value={f.stage} options={STAGE_OPTS} onChange={(v) => set("stage", v)} />
          )}
        </Field>
        <Field label="Responsable">
          <Pick
            value={f.owner_id ?? ""}
            options={{
              "": "Sin asignar",
              ...Object.fromEntries(data.members.map((m) => [m.id, m.full_name])),
            }}
            onChange={(v) => set("owner_id", v || null)}
          />
        </Field>
        <Field label="Empresa">
          <EntityCombobox
            items={accounts}
            value={f.company}
            selectedId={f.account_id ?? null}
            onChange={(t, a) => setF((p) => ({ ...p, company: t, account_id: a?.id ?? null }))}
            noun="cuenta nueva"
            logos
            ariaLabel="Empresa"
          />
        </Field>
        <Field label="Contacto">
          <Input
            value={f.contact_name ?? ""}
            onChange={(e) => set("contact_name", e.target.value)}
          />
        </Field>
        <Field label="Email">
          <Input value={f.email ?? ""} onChange={(e) => set("email", e.target.value)} />
          <EmailVerificationMark
            email={f.email}
            rows={verification.data}
            error={verification.error}
          />
        </Field>
        <Field label="Cargo">
          <Input value={f.title ?? ""} onChange={(e) => set("title", e.target.value)} />
        </Field>
        <Field label="Origen">
          <Input value={f.source ?? ""} onChange={(e) => set("source", e.target.value)} />
        </Field>
        <Field label="Segmento">
          <Pick
            value={f.segment_id ?? ""}
            options={{
              "": "Sin segmento",
              ...Object.fromEntries(data.segments.map((s) => [s.id, s.name])),
            }}
            onChange={(v) => set("segment_id", v || null)}
          />
        </Field>
        <Field label={`Valor estimado (${symbol})`}>
          <Input
            type="number"
            value={f.amount ?? ""}
            onChange={(e) => set("amount", e.target.value === "" ? null : Number(e.target.value))}
          />
        </Field>
        <Field label="Próximo seguimiento">
          <DateField value={f.next_step_at} onChange={(iso) => set("next_step_at", iso)} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Próximo paso">
            <Input
              value={f.next_step ?? ""}
              onChange={(e) => set("next_step", e.target.value)}
              placeholder="Llamada de cualificación, enviar caso de éxito…"
            />
          </Field>
        </div>
        {f.stage === "disqualified" && (
          <div className="sm:col-span-2">
            <Field label="Motivo del descarte">
              <Input
                value={f.disqualified_reason ?? ""}
                onChange={(e) => set("disqualified_reason", e.target.value)}
                placeholder="Sin presupuesto, fuera de ICP, sin respuesta…"
              />
            </Field>
          </div>
        )}
        <div className="sm:col-span-2">
          <Field label="Notas">
            <Textarea
              rows={4}
              value={f.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
            />
          </Field>
        </div>
      </div>
      {!converted && f.stage === "opportunity" && (
        <p className="text-xs text-muted-foreground">
          Al guardar se creará su deal en la primera etapa del pipeline.
        </p>
      )}
      <div className="flex gap-2">
        <Button className="flex-1" onClick={save}>
          Guardar
        </Button>
        {canDelete && (
          <Button variant="ghost" onClick={remove}>
            <IconText icon={Trash2}>Borrar</IconText>
          </Button>
        )}
      </div>
    </div>
  );
}

/** Where the day-3/7/14 sequence stands for a contacted lead. */
function FollowupLine({ lead }: { lead: Lead }) {
  const st = followupStatus(lead);
  if (lead.stage !== "contacted") return null;
  const done = FOLLOWUP_STEPS.filter(
    (s) =>
      st.daysSinceContact != null &&
      st.daysSinceContact >= s.day &&
      !(st.due && st.due.id === s.id),
  );
  return (
    <p className="rounded-md bg-muted p-3 text-sm">
      <span className="eyebrow mr-2">Seguimientos</span>
      {st.reason === "not_contacted" &&
        "Pon la fecha de contacto para arrancar la secuencia día 3 / 7 / 14."}
      {st.reason === "ended" &&
        `Secuencia terminada: ${st.daysSinceContact} días sin respuesta. Muévelo o descártalo.`}
      {st.reason === "scheduled" &&
        `En pausa hasta el seguimiento programado del ${fmt(lead.next_step_at)}.`}
      {st.reason == null && st.due && (
        <>
          Toca el <strong>{st.due.label.toLowerCase()}</strong> ({st.daysSinceContact} días sin
          respuesta). El borrador está en Sugerencias.
        </>
      )}
      {st.reason == null && !st.due && st.next && (
        <>
          Siguiente: {st.next.step.label.toLowerCase()} el {fmt(st.next.date)}.
        </>
      )}
      {done.length > 0 && st.reason == null && (
        <span className="ml-2 text-xs text-muted-foreground">
          Pasados: {done.map((s) => s.label.toLowerCase()).join(", ")}.
        </span>
      )}
    </p>
  );
}
