import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Empty } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, Pick } from "@/components/fields";
import { BUYING_ROLES } from "@/lib/roles";
import { callTeardown, generateMeetingBrief, listeningCoaching } from "@/lib/ai.functions";
import {
  CALL_NOTE_FIELDS,
  callLogEntry,
  filledCount,
  normalizeCallNotes,
  type CallNotes,
} from "@/lib/call-notes";
import { useAgent } from "@/components/agent";
import { AiText } from "@/components/ai-text";
import { LevelPicker } from "@/components/theory-u/listening";
import { errorText } from "@/lib/errors";
import { learnFromMeeting } from "@/lib/memory.functions";
import { useRevealOnMobile } from "@/components/account/stakeholders-tab";
import type { Tables, TablesUpdate } from "@/integrations/supabase/types";

export const MEETING_FIELDS = [
  ["objective", "Objetivo"],
  ["attendees", "Asistentes"],
  ["agenda", "Agenda"],
  ["questions", "Preguntas de discovery"],
  ["objections", "Objeciones esperadas"],
  ["materials", "Materiales"],
  ["desired_outcome", "Resultado deseado"],
] as const;

export function MeetingsTab({
  accountId,
  openMeetingId,
  list,
  stakeholders,
  deals,
  onChange,
}: {
  accountId: string;
  openMeetingId?: string;
  list: Tables<"meetings">[];
  stakeholders: Tables<"stakeholders">[];
  deals: Tables<"deals">[];
  onChange: () => void;
}) {
  // The meeting being edited: a loose draft (form strings, free-shaped call_notes) until it is saved.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [sel, setSel] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [coachBusy, setCoachBusy] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  const { open: openAgent } = useAgent();
  const teardown = useServerFn(callTeardown);
  // Opened from a suggestion: select that meeting once the list is there.
  const opened = useRef<string | null>(null);
  useEffect(() => {
    if (!openMeetingId || opened.current === openMeetingId) return;
    const m = list.find((x) => x.id === openMeetingId);
    if (m) {
      opened.current = openMeetingId;
      setSel(m);
    }
  }, [openMeetingId, list]);
  const lines: CallNotes = normalizeCallNotes(sel?.call_notes);
  const setLine = (k: keyof CallNotes, v: string) =>
    setSel({ ...sel, call_notes: { ...(sel.call_notes ?? {}), [k]: v } });
  const detailRef = useRevealOnMobile(sel?.id);
  const brief = useServerFn(generateMeetingBrief);
  const coach = useServerFn(listeningCoaching);
  const learnMeeting = useServerFn(learnFromMeeting);
  async function add() {
    const { data, error } = await supabase
      .from("meetings")
      .insert({
        account_id: accountId,
        title: "Nueva reunión",
        scheduled_at: new Date(Date.now() + 864e5).toISOString(),
      })
      .select()
      .single();
    if (error) return toast.error(errorText(error));
    setSel(data);
    onChange();
  }
  async function save() {
    const { id, title, scheduled_at, deal_id, ...rest } = sel;
    const call_notes = normalizeCallNotes(rest.call_notes);
    const payload: Record<string, unknown> = {
      title,
      scheduled_at,
      deal_id: deal_id || null,
      listening_level: rest.listening_level ?? null,
      listening_reflection: rest.listening_reflection ?? "",
      notes: rest.notes ?? null,
      call_notes,
      next_steps: call_notes.siguiente ?? rest.next_steps ?? null,
    };
    for (const [k] of MEETING_FIELDS) payload[k] = rest[k];
    const { error } = await supabase
      .from("meetings")
      .update(payload as TablesUpdate<"meetings">)
      .eq("id", id);
    if (error) {
      toast.error(errorText(error));
      return false;
    }
    // The call log (Llamadas tab, call prep, score) gets the five lines and the free notes.
    const log = callLogEntry({ notes: rest.notes, next_steps: rest.next_steps, call_notes });
    if (log.hasContent) {
      await supabase.from("calls").upsert({
        id,
        account_id: accountId,
        deal_id: deal_id || null,
        title,
        occurred_at: scheduled_at,
        summary: log.summary,
        next_steps: log.next_steps,
      });
      // Nokko remembers what matters from the notes (in the background; it never blocks saving).
      void learnMeeting({ data: { meetingId: id } }).catch(() => undefined);
    }
    toast.success("Reunión guardada.");
    onChange();
    return true;
  }
  async function genBrief() {
    await save();
    setBusy(true);
    try {
      const r = await brief({ data: { meetingId: sel.id } });
      setSel({ ...sel, ai_brief: r.brief });
      onChange();
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function genTeardown() {
    if (!(await save())) return;
    setReviewBusy(true);
    try {
      const r = await teardown({ data: { meetingId: sel.id } });
      setSel({ ...sel, call_review: r.text });
      onChange();
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setReviewBusy(false);
    }
  }
  // Hand the teardown to the agent so the deal updates come back as actions to confirm.
  function updateDealWithAgent() {
    const deal = deals.find((d) => d.id === sel.deal_id);
    if (!deal) return;
    const review = String(sel.call_review ?? "").slice(0, 2500);
    openAgent({
      fresh: true,
      docked: true,
      mode: "chat",
      personaId: null,
      workflowId: null,
      prompt: `Actualiza el deal «${deal.name}» (id ${deal.id}) con lo que salió de la reunión «${sel.title}».\n\nDesmontaje de la llamada:\n${review}\n\nPrepara como acciones para que las confirme: los campos de MEDDPICC que las notas permiten rellenar (solo con lo que dicen las notas, sin suponer nada) y una tarea para el próximo paso acordado con su fecha. Si falta la fecha del próximo paso, dímelo en vez de inventarla.`,
    });
  }
  async function genCoaching() {
    if (!(await save())) return;
    setCoachBusy(true);
    try {
      const r = await coach({ data: { meetingId: sel.id } });
      setSel({ ...sel, listening_coaching: r.text });
      onChange();
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setCoachBusy(false);
    }
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <div className="space-y-2">
        <Button size="sm" className="w-full" onClick={add}>
          + Planificar reunión
        </Button>
        {list.map((m) => (
          <button
            key={m.id}
            onClick={() => setSel(m)}
            className={`block w-full rounded-md border bg-card p-3 text-left text-sm ${sel?.id === m.id ? "border-signal" : ""}`}
          >
            <span className="break-words font-medium">{m.title}</span>
            <span className="block font-mono text-xs text-muted-foreground">
              {m.scheduled_at
                ? new Date(m.scheduled_at).toLocaleString("es-ES", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : ""}
            </span>
          </button>
        ))}
      </div>
      {sel ? (
        <div ref={detailRef} className="scroll-mt-20 space-y-4 rounded-lg border bg-card p-5">
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Título">
              <Input
                value={sel.title}
                onChange={(e) => setSel({ ...sel, title: e.target.value })}
              />
            </Field>
            <Field label="Fecha y hora">
              <Input
                type="datetime-local"
                value={
                  sel.scheduled_at ? new Date(sel.scheduled_at).toISOString().slice(0, 16) : ""
                }
                onChange={(e) =>
                  setSel({ ...sel, scheduled_at: new Date(e.target.value).toISOString() })
                }
              />
            </Field>
            <Field label="Deal">
              <Pick
                value={sel.deal_id ?? ""}
                options={Object.fromEntries([["", "—"], ...deals.map((d) => [d.id, d.name])])}
                onChange={(v) => setSel({ ...sel, deal_id: v })}
              />
            </Field>
          </div>
          {stakeholders.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <span className="eyebrow mr-1 self-center">Añadir asistente:</span>
              {stakeholders.map((s) => (
                <button
                  key={s.id}
                  className="min-h-8 rounded-none border px-2.5 py-1.5 text-xs hover:border-signal md:min-h-0 md:py-0.5"
                  onClick={() =>
                    setSel({
                      ...sel,
                      attendees: `${sel.attendees ? sel.attendees + "\n" : ""}${s.name} — ${s.title} (${BUYING_ROLES[s.buying_role ?? ""] ?? ""})`,
                    })
                  }
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            {MEETING_FIELDS.map(([k, label]) => (
              <Field key={k} label={label}>
                <Textarea
                  rows={3}
                  value={sel[k] ?? ""}
                  onChange={(e) => setSel({ ...sel, [k]: e.target.value })}
                />
              </Field>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => save()}>Guardar</Button>
            <Button variant="outline" onClick={genBrief} disabled={busy}>
              {busy ? "Preparando…" : "Preparar llamada con IA"}
            </Button>
          </div>
          {sel.ai_brief && (
            <div>
              <p className="eyebrow mb-2">Brief generado</p>
              <AiText>{sel.ai_brief}</AiText>
            </div>
          )}
          <div className="space-y-3 border-t pt-4">
            <div>
              <p className="eyebrow">
                Después de la llamada: notas en 5 líneas · {filledCount(lines)}/5
              </p>
              <p className="text-xs text-muted-foreground">
                Una línea por pregunta, en cuanto cuelgues. Con esto la IA desmonta la llamada y te
                dice qué actualizar en el deal.
              </p>
            </div>
            <div className="space-y-2">
              {CALL_NOTE_FIELDS.map((f, i) => (
                <Field key={f.key} label={`${i + 1}. ${f.label}`}>
                  <Input
                    value={sel.call_notes?.[f.key] ?? ""}
                    placeholder={f.hint}
                    maxLength={300}
                    onChange={(e) => setLine(f.key, e.target.value)}
                  />
                </Field>
              ))}
              <Field label="Notas libres (opcional)">
                <Textarea
                  rows={3}
                  value={sel.notes ?? ""}
                  onChange={(e) => setSel({ ...sel, notes: e.target.value })}
                />
              </Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => save()}>
                Guardar notas
              </Button>
              <Button
                variant="outline"
                onClick={genTeardown}
                disabled={
                  reviewBusy || (filledCount(lines) === 0 && !String(sel.notes ?? "").trim())
                }
              >
                {reviewBusy
                  ? "Desmontando…"
                  : sel.call_review
                    ? "Volver a desmontar con IA"
                    : "Desmontar la llamada con IA"}
              </Button>
              {sel.call_review && sel.deal_id && (
                <Button variant="outline" onClick={updateDealWithAgent}>
                  Actualizar el deal con el agente
                </Button>
              )}
            </div>
            {sel.call_review && (
              <div>
                <p className="eyebrow mb-2">Desmontaje de la llamada</p>
                <AiText>{sel.call_review}</AiText>
              </div>
            )}
          </div>
          <div className="space-y-3 border-t pt-4">
            <div>
              <p className="eyebrow">Después: ¿cómo escuchaste? · Theory U</p>
              <p className="text-xs text-muted-foreground">
                Descarga → Factual → Empática → Generativa. Sé honesto: sirve para mejorar, no para
                evaluar.
              </p>
            </div>
            <LevelPicker
              value={sel.listening_level}
              onChange={(l) => setSel({ ...sel, listening_level: l })}
            />
            <Textarea
              rows={2}
              placeholder="¿En qué momento escuchaste de verdad? ¿Cuándo estabas pensando en tu pitch?"
              value={sel.listening_reflection ?? ""}
              onChange={(e) => setSel({ ...sel, listening_reflection: e.target.value })}
            />
            <Button variant="outline" size="sm" onClick={genCoaching} disabled={coachBusy}>
              {coachBusy ? "Analizando…" : "Coaching de escucha con IA"}
            </Button>
            {sel.listening_coaching && <AiText>{sel.listening_coaching}</AiText>}
          </div>
        </div>
      ) : (
        <Empty>Selecciona o planifica una reunión.</Empty>
      )}
    </div>
  );
}
