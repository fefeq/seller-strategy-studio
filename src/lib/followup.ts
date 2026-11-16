// Follow-up sequence for contacted leads that have not answered: day 3, day 7 and day 14 after the
// first contact. Pure so the Leads screen, the detector and the agent agree on which touch is due,
// and the draft is a template from the company's own positioning (the AI version lives in the agent).

export const FOLLOWUP_STEPS = [
  {
    day: 3,
    id: "nudge",
    label: "Día 3",
    purpose: "un detalle concreto, sin repetir el primer mensaje",
  },
  { day: 7, id: "value", label: "Día 7", purpose: "una idea útil apoyada en un pilar de mensaje" },
  {
    day: 14,
    id: "breakup",
    label: "Día 14",
    purpose: "cerrar el hilo con elegancia y dejar la puerta abierta",
  },
] as const;
export type FollowupStep = (typeof FOLLOWUP_STEPS)[number];
/** After the last step plus this margin the sequence is over: the late-lead rule and the discard take over. */
export const SEQUENCE_END_DAYS = 21;

const DAY = 86_400_000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export type FollowupLead = {
  stage: string;
  contacted_at: string | null;
  next_step_at: string | null;
  contact_name?: string | null;
  company: string;
  /** NK-0174: a human reply from the exact contact was detected; the sequence stops while the lead stays in Contactado. */
  replied?: boolean;
};

export type FollowupStatus = {
  /** Step that is due now (its day has passed and the sequence is still open). */
  due: FollowupStep | null;
  /** Next step still ahead, with its date. */
  next: { step: FollowupStep; date: string } | null;
  daysSinceContact: number | null;
  /** Reason there is nothing to do, for the UI. */
  reason: "not_contacted" | "advanced" | "scheduled" | "ended" | "replied" | null;
};

/** The sequence runs only while the lead sits in Contactado; a scheduled future follow-up pauses it. */
export function followupStatus(l: FollowupLead, now = new Date()): FollowupStatus {
  if (l.stage !== "contacted")
    return {
      due: null,
      next: null,
      daysSinceContact: null,
      reason: l.stage === "new" ? "not_contacted" : "advanced",
    };
  if (!l.contacted_at)
    return { due: null, next: null, daysSinceContact: null, reason: "not_contacted" };
  if (l.replied) return { due: null, next: null, daysSinceContact: null, reason: "replied" };
  const start = new Date(l.contacted_at);
  const days = Math.floor((now.getTime() - start.getTime()) / DAY);
  const at = (day: number) => isoDay(new Date(start.getTime() + day * DAY));
  const ahead = FOLLOWUP_STEPS.find((s) => s.day > days);
  const next = ahead ? { step: ahead, date: at(ahead.day) } : null;
  if (days >= SEQUENCE_END_DAYS)
    return { due: null, next: null, daysSinceContact: days, reason: "ended" };
  if (l.next_step_at && l.next_step_at > isoDay(now))
    return { due: null, next, daysSinceContact: days, reason: "scheduled" };
  const due = [...FOLLOWUP_STEPS].reverse().find((s) => days >= s.day) ?? null;
  return { due, next, daysSinceContact: days, reason: null };
}

export type DraftContext = {
  positioning?: Record<string, string | null> | null;
  pillars?: { title: string; message: string | null }[];
};

const firstName = (name: string | null | undefined) => (name ?? "").trim().split(/\s+/)[0] || null;
const trimDot = (s: string) => s.trim().replace(/[.!]+$/, "");

/** Short, in «tú», no exclamation marks, no emoji; one real thing per message. Under ~45 words. */
export function followupDraft(
  step: FollowupStep,
  lead: FollowupLead,
  ctx: DraftContext = {},
): string {
  const name = firstName(lead.contact_name);
  const hi = name ? `Hola, ${name}.` : "Hola.";
  const benefit = ctx.positioning?.key_benefit ? trimDot(ctx.positioning.key_benefit) : null;
  const pillar = (ctx.pillars ?? []).find((p) => p.message?.trim());
  switch (step.id) {
    case "nudge":
      return `${hi} Te escribí hace unos días${benefit ? ` sobre ${lowerFirst(benefit)}` : ""}. ¿Tiene sentido verlo esta semana o prefieres que lo deje para más adelante?`;
    case "value":
      return pillar?.message
        ? `${hi} Una idea concreta para ${lead.company}: ${trimDot(pillar.message)}. Si os encaja, te lo enseño en 15 minutos.`
        : `${hi} Una idea concreta para ${lead.company}: ${benefit ? lowerFirst(benefit) : "resolver lo que hablamos"} sin cambiar cómo trabajáis hoy. Si os encaja, te lo enseño en 15 minutos.`;
    case "breakup":
      return `${hi} No quiero insistir. Si ahora no es el momento, cierro el hilo y vuelvo dentro de unos meses. Si te interesa, dime un día y lo vemos.`;
  }
}

const lowerFirst = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s);

/** What the approval of a step records on the lead: the touch and the date of the next one. */
export function followupPatch(
  step: FollowupStep,
  contactedAt: string,
  now = new Date(),
): { next_step: string; next_step_at: string } {
  const start = new Date(contactedAt);
  const ahead = FOLLOWUP_STEPS.find((s) => s.day > step.day);
  const nextDate = ahead
    ? new Date(start.getTime() + ahead.day * DAY)
    : new Date(now.getTime() + 7 * DAY);
  return {
    next_step: ahead
      ? `Seguimiento ${step.label.toLowerCase()} enviado; toca el ${ahead.label.toLowerCase()}`
      : `Seguimiento ${step.label.toLowerCase()} enviado; si no responde, descartar`,
    next_step_at: isoDay(nextDate),
  };
}
