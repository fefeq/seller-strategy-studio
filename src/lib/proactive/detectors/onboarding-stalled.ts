import { inactive } from "@/lib/setup-guide";
import { onboardingDone } from "@/lib/onboarding";
import type { Detector } from "../types";

const BODY: Record<string, string> = {
  depth: "Lo dejaste antes de elegir tus fuentes. Te quedan unos minutos.",
  sources: "Lo dejaste antes de elegir tus fuentes. Te quedan unos minutos.",
  reading: "Nokko terminó de leer o sigue leyendo. Revisa lo que encontró.",
  diagnosis: "Te falta el diagnóstico GTM: son cuatro respuestas.",
  blocks: "Tu propuesta está lista. Aprueba o salta los bloques que quedan.",
};

/**
 * An owner or sales leader left the onboarding halfway for over a day (the same threshold as the setup guide). Goes to its person, to
 * Sugerencias only: priority 2, never 1, because priority 1 is what reaches Telegram (and a reopened one has no notified_at).
 * Guests and other roles do not get it. Without the field or the team in the snapshot, nothing.
 */
export const onboardingStalled: Detector = (s) => {
  if (!s.onboarding || !s.members) return [];
  const leaders = new Set(s.members.filter((m) => m.role === "owner" || m.role === "sales_leader").map((m) => m.user_id));
  return s.onboarding
    .filter((o) => !onboardingDone(o) && leaders.has(o.user_id) && inactive(o.updated_at, s.now))
    .map((o) => ({
      detector: "onboarding_stalled",
      dedupe_key: `onboarding_stalled:${o.user_id}:${o.step}`,
      priority: 2,
      title: "Retoma tu onboarding",
      body: BODY[o.step] ?? BODY.sources!,
      link: "/onboarding",
      action: null,
      user_id: o.user_id,
    }));
};
