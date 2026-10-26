// The guide of «Configura tu estrategia»: which step comes next, who can do it, what is snoozed.
// Pure and tested. It only consumes setupStatus (the single definition of «completo», SDD universal-field-definitions)
// and never stores a step's state: done is derived from data, so it can't drift from the data.
// The order is SETUP_ITEMS' order (positioning → deals), the same in the wizard, Inicio, the proactive detector and the agent.
import { SETUP_ITEMS, setupStatus, type SetupData } from "@/lib/setup-schema";
import { ROLES, type Role } from "@/lib/roles";

export type StepState = "done" | "pending" | "snoozed";
export type Snooze = { step_id: string; snoozed_until: string };
export type GuideMember = { user_id: string; role: string; name?: string | null };

/** Roles that can complete each step: the roles of the agent tools that write it (src/lib/agent/tools/strategy.ts, core-write.ts; tested against the registry). */
const LEADERS: Role[] = ["owner", "sales_leader"];
const WITH_MARKETING: Role[] = ["owner", "sales_leader", "marketing"];
export const STEP_ROLES: Record<string, Role[] | "all"> = {
  positioning: WITH_MARKETING,
  icp: WITH_MARKETING,
  segments: LEADERS,
  benchmarks: LEADERS,
  pillars: WITH_MARKETING,
  quota: LEADERS,
  accounts: "all",
  deals: "all",
};

/** Why each step matters, in one sentence. */
export const STEP_WHY: Record<string, string> = {
  positioning: "Así Nokko sabrá qué diferencia contar en llamadas, propuestas y mensajes.",
  icp: "Así Nokko sabrá a qué empresas priorizar y a quién investigar.",
  segments: "Así Nokko podrá recomendarte el motion de venta según el ACV de cada segmento.",
  benchmarks: "Así Nokko podrá calcular tu capacidad y el payback con tus objetivos reales.",
  pillars: "Así Nokko tendrá la narrativa de tus mensajes para outbound y demos.",
  quota: "Así Nokko podrá medir la cobertura de pipeline y el forecast de este trimestre.",
  accounts: "Así Nokko podrá armar planes de cuenta, ABM y reuniones sobre tus cuentas objetivo.",
  deals: "Así Nokko podrá calcular métricas, avisarte de riesgos y aconsejarte sobre tu pipeline.",
};

export const STATE_LABEL: Record<StepState, string> = { done: "Completado", pending: "Pendiente", snoozed: "Pospuesto" };

export function canCompleteStep(stepId: string, role: string | null | undefined): boolean {
  const roles = STEP_ROLES[stepId];
  if (!roles) return false;
  return roles === "all" || (!!role && (roles as string[]).includes(role));
}

export type GuideStep = {
  id: string;
  label: string;
  unlocks: string;
  why: string;
  link: string;
  weight: number;
  state: StepState;
  snoozedUntil: string | null;
};

export type Guide = {
  steps: GuideStep[];
  pct: number;
  /** First step in the fixed order that is pending (not done, not snoozed). Null when nothing needs doing now. */
  next: GuideStep | null;
  pending: GuideStep[];
  snoozed: GuideStep[];
  /** Every step is done. */
  complete: boolean;
};

const active = (s: Snooze, now: Date) => new Date(s.snoozed_until).getTime() > now.getTime();

export function guideState(d: SetupData, snoozes: Snooze[], now: Date): Guide {
  const st = setupStatus(d);
  const until = new Map(snoozes.filter((s) => active(s, now)).map((s) => [s.step_id, s.snoozed_until]));
  const steps: GuideStep[] = st.items.map((i) => {
    const snoozedUntil = !i.done ? until.get(i.id) ?? null : null;
    return {
      id: i.id, label: i.label, unlocks: i.unlocks, why: STEP_WHY[i.id] ?? `Desbloquea: ${i.unlocks}.`, link: i.link, weight: i.weight,
      state: i.done ? "done" : snoozedUntil ? "snoozed" : "pending", snoozedUntil,
    };
  });
  const pending = steps.filter((s) => s.state === "pending");
  return { steps, pct: st.pct, next: pending[0] ?? null, pending, snoozed: steps.filter((s) => s.state === "snoozed"), complete: steps.every((s) => s.state === "done") };
}

/** The step to recommend to someone with this role: the first pending one they can complete. */
export function nextFor(guide: Guide, role: string | null | undefined): GuideStep | null {
  return guide.pending.find((s) => canCompleteStep(s.id, role)) ?? null;
}

/** The steps a role sees: those it can complete, plus the pending ones it can't (shown with who can). A person never sees a done step hidden. */
export function stepsFor(guide: Guide, role: string | null | undefined): GuideStep[] {
  return guide.steps.filter((s) => canCompleteStep(s.id, role) || s.state !== "done");
}

/** Members whose role can complete the step (CA-8: «quién de la empresa puede»). */
export function whoCan(stepId: string, members: GuideMember[]): GuideMember[] {
  return members.filter((m) => canCompleteStep(stepId, m.role));
}

export function whoCanText(stepId: string, members: GuideMember[]): string {
  const people = whoCan(stepId, members);
  const names = people.map((m) => m.name?.trim()).filter((n): n is string => !!n);
  if (names.length) return `Lo puede completar ${names.slice(0, 3).join(", ")}${names.length > 3 ? " y otras personas" : ""}.`;
  const roles = STEP_ROLES[stepId];
  if (!roles || roles === "all") return "Lo puede completar cualquier persona de la empresa.";
  return `Lo puede completar una persona con rol ${roles.map((r) => ROLES[r].label).join(" o ")}.`;
}

export type NextMessage = { stepId: string | null; title: string; why: string; start: string | null; later: string | null; link: string | null };

/** The message shown after finishing a step, in Inicio and in the agent. Same text for the same state (CA-3). */
export function nextMessage(guide: Guide, role: string | null | undefined, justDone?: string | null, members: GuideMember[] = []): NextMessage {
  const doneStep = justDone ? guide.steps.find((s) => s.id === justDone && s.state === "done") : undefined;
  const lead = doneStep ? `Hecho: ${doneStep.label.split(" (")[0].toLowerCase()}. ` : "";
  const step = nextFor(guide, role);
  if (step) {
    return { stepId: step.id, title: `${lead}Siguiente: ${step.label.split(" (")[0].toLowerCase()}.`, why: step.why, start: "Empezar", later: "Más tarde", link: step.link };
  }
  if (guide.complete) return { stepId: null, title: `${lead}Ya tienes tu estrategia completa.`, why: COMPLETE_TEXT, start: null, later: null, link: null };
  const other = guide.pending[0];
  if (other) return { stepId: null, title: `${lead}Lo que queda no es de tu rol.`, why: `Falta ${other.label.split(" (")[0].toLowerCase()}. ${whoCanText(other.id, members)}`, start: null, later: null, link: null };
  return { stepId: null, title: `${lead}Los pasos que quedan están pospuestos.`, why: `Vuelven a avisarte el ${guide.snoozed.map((s) => s.snoozedUntil).filter(Boolean).sort()[0]?.slice(0, 10) ?? "día que elegiste"}.`, start: null, later: null, link: null };
}

/** CA-2: what Nokko does by itself and what is left for the person once nothing is pending. */
export const COMPLETE_TEXT =
  "Nokko vigila tus deals, reuniones y cuentas y te propone qué hacer en Sugerencias. A ti te toca confirmar lo que propone, mantener tu pipeline al día y revisar tu estrategia cuando cambie tu mercado.";

export const INACTIVITY_MS = 86_400_000; // 1 day, decided by Fede (2026-10-25)

/** CA-6: nudge when steps are pending and nothing in the setup data changed for more than a day. No data of activity = no nudge. */
export function nudgeDue(guide: Guide, role: string | null | undefined, lastActivityAt: string | null, now: Date): boolean {
  if (!nextFor(guide, role) || !lastActivityAt) return false;
  return now.getTime() - new Date(lastActivityAt).getTime() > INACTIVITY_MS;
}

/** Latest of the timestamps, ignoring empties. */
export function latestActivity(stamps: (string | null | undefined)[]): string | null {
  const t = stamps.filter((s): s is string => !!s).sort();
  return t.length ? t[t.length - 1]! : null;
}

/** CA-7: a snooze date must be a real day after today. Returns the end of that day (ISO) or null. */
export function parseSnoozeDate(input: string, now: Date): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return null;
  const end = new Date(`${input}T23:59:59.999Z`);
  if (Number.isNaN(end.getTime()) || end.toISOString().slice(0, 10) !== input) return null;
  return end.getTime() > now.getTime() && input > now.toISOString().slice(0, 10) ? end.toISOString() : null;
}

export const SETUP_STEP_IDS = SETUP_ITEMS.map((i) => i.id);
