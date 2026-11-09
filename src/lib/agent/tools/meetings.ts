// Meetings and calls: list and detail, the meeting form fields, the AI call teardown and listening coaching
// (same core as the meeting screen) and calls logged without a meeting.
import { z } from "zod";
import { callLogEntry, filledCount, needsCallNotes, normalizeCallNotes } from "@/lib/call-notes";
import { RULES_READ_FAILED } from "@/lib/knowledge-rules";
import { accountNames, clip, def, defined, mustFind, ok, type AgentTool } from "../tool-kit";

const FORM_FIELDS = [
  "objective",
  "attendees",
  "agenda",
  "questions",
  "objections",
  "materials",
  "desired_outcome",
] as const;
const optText = z.string().max(4000).optional();
const scope = (c: { orgId: string; userId: string }) => ({ orgId: c.orgId, userId: c.userId });

export const MEETING_TOOLS: AgentTool[] = [
  def({
    name: "list_meetings",
    kind: "read",
    description:
      "Lista reuniones: próximas (por defecto), pasadas o sin notas (pasaron hace entre 2 horas y 7 días y no tienen notas, como el recordatorio de Sugerencias). Filtra por cuenta o deal.",
    input: z.object({
      when: z.enum(["upcoming", "past", "no_notes"]).optional(),
      account_id: z.string().uuid().optional(),
      deal_id: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(50).optional(),
    }),
    run: async (c, a) => {
      const when = a.when ?? "upcoming";
      const now = new Date();
      let q = c.db
        .from("meetings")
        .select("id,title,scheduled_at,objective,account_id,deal_id,ai_brief,notes,call_notes")
        .eq("org_id", c.orgId);
      if (a.account_id) q = q.eq("account_id", a.account_id);
      if (a.deal_id) q = q.eq("deal_id", a.deal_id);
      q =
        when === "upcoming"
          ? q.gte("scheduled_at", now.toISOString()).order("scheduled_at")
          : q.lt("scheduled_at", now.toISOString()).order("scheduled_at", { ascending: false });
      const rows = ok(await q.limit(when === "no_notes" ? 200 : (a.limit ?? 20))) ?? [];
      const list = (when === "no_notes" ? rows.filter((m) => needsCallNotes(m, now)) : rows).slice(
        0,
        a.limit ?? 20,
      );
      const names = await accountNames(
        c,
        list.map((m) => m.account_id),
      );
      return list.map((m) => ({
        id: m.id,
        titulo: m.title,
        fecha: m.scheduled_at,
        cuenta: (m.account_id && names.get(m.account_id)) ?? null,
        cuenta_id: m.account_id,
        deal_id: m.deal_id,
        objetivo: m.objective,
        tiene_preparacion: !!m.ai_brief,
        lineas_de_notas: filledCount(normalizeCallNotes(m.call_notes)),
        notas_libres: !!(m.notes ?? "").trim(),
      }));
    },
  }),
  def({
    name: "get_meeting",
    kind: "read",
    description:
      "Detalle de una reunión: objetivo, asistentes, agenda, preguntas, objeciones, materiales, resultado deseado, notas en 5 líneas, notas libres, preparación de llamada, revisión de la llamada y coaching de escucha.",
    input: z.object({ meeting_id: z.string().uuid() }),
    run: async (c, a) => {
      const m = ok(
        await c.db
          .from("meetings")
          .select("*")
          .eq("org_id", c.orgId)
          .eq("id", a.meeting_id)
          .maybeSingle(),
      );
      if (!m) return { error: "Reunión no encontrada en esta empresa" };
      const names = await accountNames(c, [m.account_id]);
      return {
        id: m.id,
        titulo: m.title,
        fecha: m.scheduled_at,
        cuenta: (m.account_id && names.get(m.account_id)) ?? null,
        cuenta_id: m.account_id,
        deal_id: m.deal_id,
        ...Object.fromEntries(FORM_FIELDS.map((f) => [f, m[f]])),
        notas_en_5_lineas: normalizeCallNotes(m.call_notes),
        notas_libres: m.notes,
        proximos_pasos: m.next_steps,
        preparacion: clip(m.ai_brief),
        revision_de_la_llamada: clip(m.call_review),
        coaching_de_escucha: clip(m.listening_coaching),
        nivel_de_escucha: m.listening_level,
      };
    },
  }),
  def({
    name: "update_meeting",
    kind: "write",
    description: `Actualiza una reunión: título, fecha (ISO 8601), deal, notas libres y los campos de preparación (${FORM_FIELDS.join(", ")}). Las 5 líneas de notas van con save_call_notes. Con notas, la llamada queda registrada en el historial de la cuenta.`,
    input: z.object({
      meeting_id: z.string().uuid(),
      title: z.string().min(1).max(300).optional(),
      scheduled_at: z.string().optional(),
      deal_id: z.string().uuid().nullable().optional(),
      notes: optText,
      ...(Object.fromEntries(FORM_FIELDS.map((f) => [f, optText])) as Record<
        (typeof FORM_FIELDS)[number],
        typeof optText
      >),
    }),
    summarize: (a) =>
      `Actualizar la reunión: ${Object.keys(defined({ ...a, meeting_id: undefined })).join(", ") || "sin cambios"}`,
    run: async (c, a) => {
      const { meeting_id, ...rest } = a;
      const m = await mustFind<any>(
        c,
        "meetings",
        meeting_id,
        "esa reunión",
        "id,title,account_id,deal_id,scheduled_at,notes,next_steps,call_notes",
      );
      if (rest.deal_id) await mustFind(c, "deals", rest.deal_id, "ese deal");
      const patch = defined(rest);
      if (!Object.keys(patch).length) throw new Error("No has indicado qué cambiar de la reunión.");
      ok(
        await c.db
          .from("meetings")
          .update(patch)
          .eq("org_id", c.orgId)
          .eq("id", meeting_id)
          .select("id")
          .single(),
      );
      // Same call-log row the meeting screen rewrites on every save with content (title, date and deal follow).
      const next = { ...m, ...patch };
      const log = callLogEntry(next);
      if (log.hasContent)
        await c.db.from("calls").upsert({
          id: m.id,
          org_id: c.orgId,
          account_id: next.account_id,
          deal_id: next.deal_id,
          title: next.title,
          occurred_at: next.scheduled_at,
          summary: log.summary,
          next_steps: log.next_steps,
        });
      return { ok: true, meeting: next.title };
    },
  }),
  def({
    name: "review_call",
    kind: "write",
    description:
      "Revisión de la llamada con IA: compara las notas (5 líneas o libres) con el objetivo, la preparación y el MEDDPICC del deal, y dice qué funcionó, qué falta y qué actualizar. Se guarda en la reunión. Necesita notas.",
    input: z.object({ meeting_id: z.string().uuid() }),
    summarize: () => "Revisar la llamada con IA y guardar la revisión en la reunión",
    run: async (c, a) => {
      await mustFind(c, "meetings", a.meeting_id, "esa reunión");
      const { callTeardownCore } = await import("@/lib/ai-core");
      const r = await callTeardownCore(c.db, a.meeting_id, scope(c));
      // A failed read of the rules is never silent (SDD-20261109-rules-in-ai-readers, CA-4).
      const done = `Revisión de «${r.title}» guardada en la reunión.`;
      return { ok: true, mensaje: r.rulesRead ? done : `${done} ${RULES_READ_FAILED}` };
    },
  }),
  def({
    name: "listening_coaching",
    kind: "write",
    description:
      "Coaching de escucha con IA sobre una reunión (nivel de escucha que reflejan las notas, momentos para escuchar más hondo, prácticas y preguntas abiertas). Se guarda en la reunión. Necesita notas o reflexión.",
    input: z.object({ meeting_id: z.string().uuid() }),
    summarize: () => "Generar el coaching de escucha de la reunión y guardarlo",
    run: async (c, a) => {
      await mustFind(c, "meetings", a.meeting_id, "esa reunión");
      const { listeningCoachingCore } = await import("@/lib/ai-core");
      const r = await listeningCoachingCore(c.db, a.meeting_id, scope(c));
      const done = `Coaching de escucha de «${r.title}» guardado en la reunión.`;
      return { ok: true, mensaje: r.rulesRead ? done : `${done} ${RULES_READ_FAILED}` };
    },
  }),
  def({
    name: "log_call",
    kind: "write",
    description:
      "Registra una llamada que no estaba planificada como reunión, en el historial de la cuenta (cuenta para la actividad de la puntuación y para la preparación de llamada).",
    input: z.object({
      account_id: z.string().uuid(),
      title: z.string().min(1).max(300),
      summary: optText,
      next_steps: optText,
      occurred_at: z.string().optional().describe("ISO 8601; por defecto, ahora"),
      deal_id: z.string().uuid().optional(),
    }),
    summarize: (a) => `Registrar la llamada «${a.title}»`,
    run: async (c, a) => {
      await mustFind(c, "accounts", a.account_id, "esa cuenta");
      if (a.deal_id) await mustFind(c, "deals", a.deal_id, "ese deal");
      return ok(
        await c.db
          .from("calls")
          .insert({
            org_id: c.orgId,
            account_id: a.account_id,
            deal_id: a.deal_id ?? null,
            title: a.title,
            summary: a.summary ?? null,
            next_steps: a.next_steps ?? null,
            occurred_at: a.occurred_at ?? new Date().toISOString(),
          })
          .select("id,title")
          .single(),
      );
    },
  }),
];
