// Fase F: dictation and read-aloud with the browser's own speech engine (Web Speech API): no provider, no spend.
// Pure rules (tested): what may be read aloud and what a dictation may put in the box. Voice never sends nor confirms.
import { looksLikeSecret } from "@/lib/agent/secret-guard";

const DELETION = /\b(borra\w*|elimin\w*|suprim\w*|delete\w*|deshacer guardado)\b/i;

/** Markdown → plain sentences for the speech engine (links keep their text, code and tables are skipped). */
export function speakableText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^\|.*\|$/gm, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`[^`]*`/g, " ")
    .replace(/[*_#>~]+/g, "")
    .replace(/https?:\/\/\S+/g, "enlace")
    .replace(/\s+/g, " ")
    .trim();
}

export type SpeakVerdict = { ok: true; text: string } | { ok: false; reason: string };

/** Never read aloud anything that looks like a secret or talks about deleting. */
export function canSpeak(md: string): SpeakVerdict {
  if (looksLikeSecret(md))
    return { ok: false, reason: "No leo en voz alta textos que parecen claves o contraseñas." };
  if (DELETION.test(md))
    return { ok: false, reason: "Los borrados no se leen en voz alta: revísalo en pantalla." };
  const text = speakableText(md);
  return text
    ? { ok: true, text: text.slice(0, 2000) }
    : { ok: false, reason: "No hay texto que leer." };
}

export type DictationVerdict = { ok: true; text: string } | { ok: false; reason: string };

/** A dictation only fills the box (never sends). Secrets are dropped; deletions must be typed, not dictated. */
export function acceptDictation(transcript: string): DictationVerdict {
  const t = transcript.trim();
  if (!t) return { ok: false, reason: "No he entendido nada. Prueba otra vez." };
  if (looksLikeSecret(t))
    return {
      ok: false,
      reason:
        "He descartado el dictado: parecía una clave. Las claves se conectan en Conexiones, nunca por voz.",
    };
  if (DELETION.test(t))
    return {
      ok: false,
      reason: "Los borrados no se piden por voz: escríbelo para confirmar en pantalla.",
    };
  return { ok: true, text: t };
}
