import type { Detector } from "../types";
import { followupDraft, followupPatch, followupStatus } from "@/lib/followup";
import { emailBlockReason, emailGateMark } from "@/lib/email-status";

/**
 * Contacted lead without an answer → the day-3, day-7 or day-14 touch is due: the suggestion carries
 * a draft; approving it records the touch on the lead and schedules the next one. One suggestion per
 * lead and step, so a dismissed step never comes back.
 * Email gate (NK-0173): an invalid or catch-all address blocks the draft (suggestion with the reason,
 * no action); an unverified or unverifiable one keeps it with a visible mark; no address = as before.
 */
export const followupSequence: Detector = (s) =>
  (s.leads ?? []).flatMap((l) => {
    const st = followupStatus({ stage: l.stage, contacted_at: l.contacted_at ?? null, next_step_at: l.next_step_at, contact_name: l.contact_name, company: l.company }, s.now);
    if (!st.due || !l.contacted_at) return [];
    const status = l.email?.trim() ? (l.email_status ?? "unverified") : null;
    const reason = status ? emailBlockReason(status) : null;
    if (reason && status) {
      const blocked: import("../types").Suggestion = {
        detector: "followup_sequence",
        dedupe_key: `followup:${l.id}:${st.due.id}`,
        priority: 2,
        title: `${l.company}: seguimiento del ${st.due.label.toLowerCase()} bloqueado por el email`,
        body: `${reason} Cuando tengas otra dirección, retomo la secuencia.`,
        link: "/leads",
        action: null,
        user_id: l.owner_id,
        email_block: { status, reason },
      };
      return [blocked];
    }
    const draft = followupDraft(st.due, { stage: l.stage, contacted_at: l.contacted_at, next_step_at: l.next_step_at, contact_name: l.contact_name, company: l.company }, { positioning: s.setup.positioning, pillars: s.setup.pillars });
    const patch = followupPatch(st.due, l.contacted_at, s.now);
    const mark = status ? emailGateMark(status) : null;
    return [{
      detector: "followup_sequence",
      dedupe_key: `followup:${l.id}:${st.due.id}`,
      priority: 2 as const,
      title: `${l.company}: toca el seguimiento del ${st.due.label.toLowerCase()} (${st.daysSinceContact} días sin respuesta)`,
      body: `Borrador (${st.due.purpose}):\n«${draft}»\n\nEnvíalo desde tu email o LinkedIn. Al aprobar, apunto el envío en el lead y programo ${st.next ? `el siguiente para el ${patch.next_step_at}` : "la revisión final"}. Pídeme en el agente una versión adaptada si quieres cambiar el tono.${mark ? `\n\nMarca: ${mark}.` : ""}`,
      link: "/leads",
      action: { tool: "update_lead", args: { lead_id: l.id, ...patch } },
      user_id: l.owner_id,
    }];
  });
