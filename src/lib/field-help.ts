import { FIELD_HELP, type HelpEntry } from "@/lib/field-help-data";

export type { HelpEntry };

/** What the help of one field resolves to: the entry plus whether it is specific or the generic fallback. */
export type ResolvedHelp = HelpEntry & { label: string; generic: boolean };

/**
 * Lookup key for a label: accents, case, parentheses («(opcional)», «(€)»), a leading «1.» numbering,
 * anything after « · » and punctuation do not change which help a field gets.
 */
export function normalizeLabel(label: string): string {
  return label
    .split(" · ")[0]
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/^\s*\d+\.\s*/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const INDEX = new Map<string, HelpEntry>();
for (const e of FIELD_HELP) for (const l of e.labels) INDEX.set(normalizeLabel(l), e);

/** Help for a field, by its label or an explicit key; unknown fields get a generic help so none is left without it. */
export function resolveHelp(label: string, key?: string): ResolvedHelp {
  const hit = (key && INDEX.get(normalizeLabel(key))) || INDEX.get(normalizeLabel(label));
  if (hit) return { ...hit, label, generic: false };
  return {
    labels: [label],
    label,
    generic: true,
    description: `Dato «${label}» de este formulario.`,
    goal: "Nokko lo guarda y lo usa como contexto en sus análisis, sugerencias y en el agente.",
  };
}

export type PromptContext = { company?: string | null; website?: string | null; value?: string | null };

/** The text «Copiar prompt» puts in the clipboard, ready to paste in ChatGPT, Claude or any other assistant. */
export function buildPrompt(help: ResolvedHelp, ctx: PromptContext = {}): string {
  const who = ctx.company ? ` para ${ctx.company}${ctx.website ? ` (${ctx.website})` : ""}` : "";
  const value = ctx.value?.trim();
  return [
    "Actúa como experto en go-to-market B2B.",
    `Estoy rellenando el campo «${help.label}» en Nokko, mi herramienta de estrategia comercial${who}.`,
    `Qué es: ${help.description}`,
    `Para qué se usa: ${help.goal}`,
    help.example ? `Ejemplo de respuesta: ${help.example}` : null,
    value ? `Lo que tengo escrito ahora: «${value}». Mejóralo si hace falta.` : null,
    `Tarea: ${help.ask ?? `escribe el contenido de «${help.label}»${who}.`}`,
    `Formato: ${help.format ?? "solo el texto listo para pegar en el campo, en español, sin introducción ni explicaciones."}`,
    "Si te falta información, búscala en la web de la empresa o hazme como máximo 3 preguntas antes de responder.",
  ].filter(Boolean).join("\n");
}
