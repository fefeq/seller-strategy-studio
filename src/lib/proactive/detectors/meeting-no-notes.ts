import type { Detector } from "../types";
import { needsCallNotes } from "@/lib/call-notes";

/** Meeting held 2 h–7 days ago with nothing written → ask for the five-line notes while they are fresh. */
export const meetingNoNotes: Detector = (s) =>
  s.meetings
    .filter((m) => needsCallNotes(m, s.now))
    .map((m) => ({
      detector: "meeting_no_notes",
      dedupe_key: `meeting_no_notes:${m.id}`,
      priority: 2 as const,
      title: `Apunta las notas de «${m.title}» en 5 líneas`,
      body: "Qué les duele, qué les cuesta, quién decide, qué les frena y el próximo paso acordado. Con eso desmonto la llamada y te digo qué actualizar en el deal.",
      link: `/accounts/${m.account_id}?tab=meetings&meeting=${m.id}`,
      action: null,
      user_id: m.created_by,
    }));
