import { DAY, type Detector } from "../types";

/** Meeting in the next 36h without an AI Call Prep → offer to generate it. */
export const meetingNoPrep: Detector = (s) =>
  s.meetings
    .filter((m) => {
      if (!m.scheduled_at || (m.ai_brief ?? "").trim()) return false;
      const t = new Date(m.scheduled_at).getTime() - s.now.getTime();
      return t > 0 && t <= 1.5 * DAY;
    })
    .map((m) => ({
      detector: "meeting_no_prep",
      dedupe_key: `meeting_no_prep:${m.id}`,
      priority: 1,
      title: `Reunión «${m.title}» sin Call Prep`,
      body: `Es el ${new Date(m.scheduled_at!).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Madrid" })}. Te preparo el brief con IA.`,
      link: m.account_id ? `/accounts/${m.account_id}` : null,
      action: { tool: "prepare_meeting_brief", args: { meeting_id: m.id } },
      user_id: m.created_by,
    }));
