import type { Play, PlayBlocker } from "./catalog";
import { APPROVAL_WORD, PHASE_WORD } from "./view";

// Effective state of a play for a company (SDD-20261106-plays-library-core, H-2): catalogue + play_states row. Pure.
// The screen, the server function and the agent tool all decide through checkToggle/effectiveState, never with parallel logic.

export type PlayStateRow = { enabled: boolean };

export type EffectiveState = {
  enabled: boolean;
  label: string;
  canEnable: boolean;
  reason: string | null;
};

/** Why a blocker stops a play (`label` goes after «Bloqueado: ») and what has to be decided to unblock it. */
const BLOCKER_TEXT: Record<PlayBlocker, { label: string; decide: string }> = {
  linkedin_d2: {
    label: "falta una integración con la API oficial de LinkedIn",
    decide: "Este play requiere una integración con la API oficial de LinkedIn",
  },
  proveedor_datos: {
    label: "falta un proveedor de datos",
    decide: "Elige el proveedor de datos para las señales externas",
  },
  decision_gtm: {
    label: "falta decidir a qué GTM sirve NOKKO",
    decide: "Decide a qué GTM sirve NOKKO",
  },
  fuente_externa: {
    label: "falta una fuente externa",
    decide: "Decide qué fuente o herramienta externa se conecta",
  },
};

const LEADERS = ["owner", "sales_leader"];

/** Only the Owner and the Sales Leader activate or pause plays (as strategy_reviews); the rest see the action disabled with this reason. */
export function canTogglePlays(roles: string[]): { ok: boolean; reason?: string } {
  return roles.some((r) => LEADERS.includes(r))
    ? { ok: true }
    : { ok: false, reason: "Solo el Owner o el Sales Leader pueden activar o pausar plays." };
}

/** What stops a play from being enabled, or null. Blocked and planned plays can never be enabled. */
function blocking(play: Play): { reason: string; decide: string; label: string } | null {
  if (play.status === "bloqueado" && play.blockedBy) {
    const t = BLOCKER_TEXT[play.blockedBy];
    return { reason: t.label, decide: t.decide, label: `Bloqueado: ${t.label}` };
  }
  if (play.status === "planificado") {
    return {
      reason: "todavía no está construido",
      decide: `Se construye en el SDD ${play.sdd} del plan de Plays GTM`,
      label: "Planificado: todavía no está construido",
    };
  }
  return null;
}

export function effectiveState(play: Play, row: PlayStateRow | null | undefined): EffectiveState {
  const b = blocking(play);
  if (b) return { enabled: false, label: b.label, canEnable: false, reason: b.reason };
  const enabled = row ? row.enabled : play.defaultEnabled;
  return { enabled, label: enabled ? "Activado" : "Pausado", canEnable: true, reason: null };
}

/** Shared by the screen, the server function and the agent tool. A leader may always pause; activating needs a play that is not blocked or planned. */
export function checkToggle(p: {
  play: Play;
  roles: string[];
  enable: boolean;
}): { ok: true } | { ok: false; error: string } {
  const who = canTogglePlays(p.roles);
  if (!who.ok) return { ok: false, error: who.reason ?? "No tienes permiso para esto." };
  if (!p.enable) return { ok: true };
  const b = blocking(p.play);
  return b
    ? { ok: false, error: `No puedes activar este play todavía: ${b.reason}. ${b.decide}.` }
    : { ok: true };
}

/** One play as the screen and the agent show it: catalogue data plus the state of the company. One function so they never answer differently. */
export function describePlay(play: Play, row: PlayStateRow | null | undefined) {
  return {
    id: play.id,
    title: play.title,
    motion: play.motion,
    channels: play.channels,
    status: play.status,
    blockedBy: play.blockedBy ?? null,
    phase: play.phase,
    phaseLabel: PHASE_WORD[play.phase],
    approval: play.approval,
    approvalLabel: APPROVAL_WORD[play.approval],
    needs: play.needs,
    detectors: play.detectors,
    outputs: play.outputs,
    sdd: play.sdd,
    ...effectiveState(play, row),
  };
}
