// NK-0171 SDD 3: rules a play proposed by the assistant must pass before it is saved. Pure.
import {
  SOURCE_REGISTRY,
  validateTestDesign,
  type CitedMessage,
  type FreshnessWindow,
  type Step,
} from "./model";
import { copiesHashed } from "./fingerprints";
import { ANNEX_FINGERPRINTS } from "./fingerprints.data";

export type Proposal = {
  name: string;
  trigger: string;
  window: FreshnessWindow;
  steps: Step[];
  message: CitedMessage;
  test: { n: number; k: number; base: number };
  verifiedOnly: boolean;
};
type Check = { ok: true } | { ok: false; reason: string };
const no = (reason: string): Check => ({ ok: false, reason });

export function checkProposal(p: Proposal): Check {
  if (!p.name.trim() || p.name.length > 200)
    return no("El play necesita un nombre de hasta 200 caracteres.");
  if (!p.trigger.trim()) return no("El play necesita un disparador verificable.");
  if (!(p.window.backDays > 0) || !(p.window.forwardDays >= 0))
    return no("La ventana de frescura necesita un número de días positivo.");
  if (!p.steps.length) return no("El play necesita al menos un paso de evidencia.");
  for (const s of p.steps)
    if (!(s.source in SOURCE_REGISTRY)) return no(`Fuente desconocida en el paso ${s.n}.`);
  if (!p.message.claims.length || !p.message.built.trim() || !p.message.ask.trim())
    return no("El mensaje necesita hechos, lo construido y una petición.");
  for (const c of p.message.claims)
    if (!p.steps.some((s) => s.n === c.step))
      return no(`La afirmación «${c.text}» cita un paso que no existe.`);
  const t = validateTestDesign(p.test);
  if (!t.ok) return t;
  for (const text of [
    p.name,
    p.trigger,
    p.message.built,
    p.message.ask,
    ...p.message.claims.map((c) => c.text),
  ])
    if (copiesHashed(text, ANNEX_FINGERPRINTS))
      return no("El texto copia un play de otra empresa; reescríbelo con palabras propias.");
  return { ok: true };
}
