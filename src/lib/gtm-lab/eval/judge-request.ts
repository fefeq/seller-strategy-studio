// The eval judge, as in gtm-lab@44f385b scripts/eval-suggest.mjs judgeCase (:182-192): same model, rubric, system
// text, schema and user message, so every pass is scored by the same instrument (NK-0048 CA-16). Pure: no I/O on
// import; the network call lives only in scripts/gtm-lab/. The original used client.messages.create (no betas).
import {
  ANTHROPIC_MESSAGES_URL,
  anthropicHeaders,
  type Env,
  type HttpRequest,
} from "./anthropic-http";
import { parseOrNull, textOf, type AnthropicMessage } from "./anthropic-http";

export const JUDGE_MODEL = "claude-opus-5-5";

const RUBRIC = [
  "Concreta. 1: valdría para cualquier producto. 3: menciona el sector, pero con frases genéricas. 5: solo tiene sentido para este proyecto: usa su cliente, su problema y sus alternativas.",
  "Coherente. 1: contradice los pasos previos (otro segmento, otro objetivo). 3: es compatible, pero ignora algo relevante del contexto. 5: se apoya en los pasos previos relevantes y no contradice ninguno.",
  "Accionable. 1: el founder tendría que reescribirla entera. 3: sirve de base, pero hay que recortar o completar bastante: texto largo, avisos repetidos o elementos de relleno. 5: cada campo se puede usar tal cual, con retoques menores: es breve; los corchetes señalan solo lo que falta comprobar, no sustituyen contenido y nunca van dentro de un texto pensado para publicarse (titular, mensaje); y las pruebas son pruebas, no advertencias.",
].join("\n");

// Exact text approved in docs/gtm-lab/evaluacion/criterio.md §2.
export const JUDGE_SYSTEM = [
  "Eres un evaluador de sugerencias de una herramienta que ayuda a founders B2B a preparar su estrategia de go-to-market.",
  "Recibes el paso que el founder está rellenando, el contexto que ya escribió y la sugerencia que le propuso la herramienta.",
  "Valora la sugerencia solo con ese contexto; no uses conocimiento externo sobre el sector para premiarla o castigarla.",
  "Para cada criterio, escribe primero un motivo breve que cite la sugerencia y después una nota del 1 al 5 según la rúbrica.",
  "Marca «invención» si la sugerencia afirma como hechos clientes, resultados, testimonios o datos de mercado que no aparecen en el contexto. Las propuestas prudentes y lo señalado entre corchetes para comprobar no son invenciones.",
  `Rúbrica:\n${RUBRIC}`,
].join("\n");

const score = {
  type: "object",
  properties: { motivo: { type: "string" }, nota: { type: "integer", enum: [1, 2, 3, 4, 5] } },
  required: ["motivo", "nota"],
  additionalProperties: false,
};
export const JUDGE_SCHEMA = {
  type: "object",
  properties: {
    concreta: score,
    coherente: score,
    accionable: score,
    invencion: {
      type: "object",
      properties: { motivo: { type: "string" }, hay: { type: "boolean" } },
      required: ["motivo", "hay"],
      additionalProperties: false,
    },
  },
  required: ["concreta", "coherente", "accionable", "invencion"],
  additionalProperties: false,
};

export interface Verdict {
  concreta: { motivo: string; nota: number };
  coherente: { motivo: string; nota: number };
  accionable: { motivo: string; nota: number };
  invencion: { motivo: string; hay: boolean };
}

/** Request body: the step text the generator received (no system prompt) plus the suggestion. */
export function judgeBody(caseUser: string, output: unknown): Record<string, unknown> {
  return {
    model: JUDGE_MODEL,
    max_tokens: 8000,
    output_config: { format: { type: "json_schema", schema: JUDGE_SCHEMA } },
    system: JUDGE_SYSTEM,
    messages: [
      {
        role: "user",
        content: `${caseUser}\n\n# Sugerencia de la herramienta\n\n${JSON.stringify(output, null, 2)}`,
      },
    ],
  };
}

/** Full HTTP request, or null without ANTHROPIC_API_KEY. No anthropic-beta: the original used messages.create. */
export function judgeRequest(caseUser: string, output: unknown, env: Env): HttpRequest | null {
  const headers = anthropicHeaders(env);
  return headers
    ? { url: ANTHROPIC_MESSAGES_URL, headers, body: judgeBody(caseUser, output) }
    : null;
}

/** The verdict only counts when the judge finished normally, as in the original. */
export function judgeVerdict(message: AnthropicMessage): Verdict | null {
  const text = textOf(message);
  return message.stop_reason === "end_turn" && text !== null
    ? (parseOrNull(text) as Verdict | null)
    : null;
}
