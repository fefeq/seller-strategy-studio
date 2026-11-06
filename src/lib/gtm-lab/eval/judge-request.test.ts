import { describe, expect, it } from "vitest";
import { ANTHROPIC_MESSAGES_URL } from "./anthropic-http";
import { JUDGE_MODEL, judgeBody, judgeRequest, judgeVerdict } from "./judge-request";

// NK-0048 CA-16: literal copy of gtm-lab@44f385b scripts/eval-suggest.mjs:111, :132-169 and :184-192
// (judgeCase). Do not edit: it is the reference the judge body is compared to.
// prettier-ignore
const ORIGINAL = (() => {
const JUDGE_MODEL = "claude-opus-5-5";
const RUBRIC = [
  "Concreta. 1: valdría para cualquier producto. 3: menciona el sector, pero con frases genéricas. 5: solo tiene sentido para este proyecto: usa su cliente, su problema y sus alternativas.",
  "Coherente. 1: contradice los pasos previos (otro segmento, otro objetivo). 3: es compatible, pero ignora algo relevante del contexto. 5: se apoya en los pasos previos relevantes y no contradice ninguno.",
  "Accionable. 1: el founder tendría que reescribirla entera. 3: sirve de base, pero hay que recortar o completar bastante: texto largo, avisos repetidos o elementos de relleno. 5: cada campo se puede usar tal cual, con retoques menores: es breve; los corchetes señalan solo lo que falta comprobar, no sustituyen contenido y nunca van dentro de un texto pensado para publicarse (titular, mensaje); y las pruebas son pruebas, no advertencias.",
].join("\n");

// Exact text approved in docs/evaluacion/criterio.md §2.
const JUDGE_SYSTEM = [
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
const JUDGE_SCHEMA = {
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
  return { JUDGE_MODEL, JUDGE_SYSTEM, JUDGE_SCHEMA };
})();
// prettier-ignore
function originalCreateParams(c: { request: { user: string } }, output: unknown) {
  const { JUDGE_MODEL, JUDGE_SYSTEM, JUDGE_SCHEMA } = ORIGINAL;
  return {
    model: JUDGE_MODEL,
    max_tokens: 8000,
    output_config: { format: { type: "json_schema", schema: JUDGE_SCHEMA } },
    system: JUDGE_SYSTEM,
    messages: [
      { role: "user", content: `${c.request.user}\n\n# Sugerencia de la herramienta\n\n${JSON.stringify(output, null, 2)}` },
    ],
  };
}

const CASE = {
  request: {
    user: "# Paso: Mensaje central\n\nInstrucción ficticia\n\n# Contexto del proyecto\n\n(sin contexto)",
  },
};
const OUTPUT = { headline: "Titular ficticio", message: "Mensaje ficticio" };

describe("judge request (NK-0048 CA-16)", () => {
  it("the body equals the original judgeCase parameters (messages.create: no betas to move)", () => {
    expect(judgeBody(CASE.request.user, OUTPUT)).toEqual(originalCreateParams(CASE, OUTPUT));
  });

  it("uses the original judge model, claude-opus-5-5", () => {
    expect(JUDGE_MODEL).toBe(ORIGINAL.JUDGE_MODEL);
  });

  it("goes to Anthropic direct with version header and key, and no anthropic-beta", () => {
    const request = judgeRequest(CASE.request.user, OUTPUT, {
      ANTHROPIC_API_KEY: "sk-ant-test-fake",
    });
    expect(request?.url).toBe(ANTHROPIC_MESSAGES_URL);
    expect(request?.headers).toEqual({
      "x-api-key": "sk-ant-test-fake",
      "anthropic-version": "2026-10-21",
      "content-type": "application/json",
    });
  });

  it("adds anthropic-workspace-id when ANTHROPIC_WORKSPACE_ID is set", () => {
    const request = judgeRequest(CASE.request.user, OUTPUT, {
      ANTHROPIC_API_KEY: "sk-ant-test-fake",
      ANTHROPIC_WORKSPACE_ID: "wrkspc_fake",
    });
    expect(request?.headers["anthropic-workspace-id"]).toBe("wrkspc_fake");
  });

  it("is null without a key", () => {
    expect(judgeRequest(CASE.request.user, OUTPUT, {})).toBeNull();
  });
});

describe("judge verdict", () => {
  const verdict = {
    concreta: { motivo: "m", nota: 4 },
    coherente: { motivo: "m", nota: 5 },
    accionable: { motivo: "m", nota: 4 },
    invencion: { motivo: "m", hay: false },
  };
  const message = (stop: string, text: string) => ({
    model: "claude-opus-5-5",
    stop_reason: stop,
    content: [{ type: "text", text }],
    usage: { input_tokens: 1, output_tokens: 1 },
  });

  it("counts only when the judge ended normally with JSON", () => {
    expect(judgeVerdict(message("end_turn", JSON.stringify(verdict)))).toEqual(verdict);
    expect(judgeVerdict(message("max_tokens", JSON.stringify(verdict)))).toBeNull();
    expect(judgeVerdict(message("end_turn", "no json"))).toBeNull();
  });
});
