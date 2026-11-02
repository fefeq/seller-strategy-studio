// From gtm-lab@44f385b packages/core/src/ai.ts
import { allSteps, type Framework } from "./framework";
import { formFor, type Field, type ScalarField } from "./forms";
import { formatToolTotal, scoreTool, toolFor, toolIsStale, type ToolRow } from "./tools";

type JsonSchema = Record<string, unknown>;

export interface SavedDeliverableLike {
  status: "done" | "in_progress";
  data: Record<string, unknown>;
}

export interface AiRequest {
  /** Stable across projects and steps: goes first so it can be cached. */
  system: string;
  /** Step instruction plus this project's context, in a deterministic order. */
  user: string;
  schema: JsonSchema;
}

const SYSTEM = [
  "Eres un asistente que ayuda a founders de productos B2B a preparar su estrategia de go-to-market, paso a paso.",
  "Recibes el contexto que el founder ya ha escrito y el formulario del paso actual.",
  "Propón respuestas concretas para ese formulario, en español y tratando al founder de «tú».",
  "Sé breve: frases cortas y directas que el founder pueda pegar tal cual. Respeta la longitud orientativa de cada campo, que incluye las marcas y el aviso.",
  "Básate solo en el contexto recibido. No añadas detalles sobre los clientes, el producto o el mercado que no estén en él, aunque suenen plausibles. No atribuyas a clientes o pilotos resultados que el contexto no dice.",
  "No inventes datos: clientes, resultados, testimonios ni datos de mercado. Escribe «sin dato» solo en campos que piden un valor medido (por ejemplo, el valor actual) cuando no consta; en los demás campos propón una respuesta prudente. No añadas notas de «sin dato» dentro de otros textos.",
  "Las cifras que propongas tú (objetivos, umbrales, tamaños, plazos) van dentro de la marca, por ejemplo «al menos [propuesta: 80 %] de la plantilla»; no repitas la cifra fuera de ella. Usa [propuesta: …] solo para cifras. Las cifras que ya están en el contexto se escriben tal cual, sin marca.",
  "Si algo debe comprobarse antes de usarlo, añade como mucho un aviso en toda la respuesta, en una frase corta con la forma [Comprueba: …], al final del campo que lo necesite. Aparte de [propuesta: …], no uses corchetes para nada más.",
  "Los precios que propongas tú van entre [propuesta: …]. Los precios de terceros solo se citan, tal cual, si constan en el contexto.",
  "En los campos de pruebas incluye solo pruebas que estén en el contexto. Si no hay ninguna, deja la lista vacía.",
  "Habla al founder de «tú» y nunca de él en tercera persona. Sin palabras de moda ni fórmulas de relleno, sin exclamaciones, emojis ni rayas.",
  "Respeta los límites de cada campo indicados en su descripción.",
].join("\n");

export function aiInstructionFor(framework: Framework, deliverableId: string): string | undefined {
  return framework.ai[deliverableId];
}

function scalarSchema(field: ScalarField): JsonSchema {
  // The guide is for the suggestion only (SDD instrucciones-ia); the form keeps its own maximum.
  const limit =
    field.type === "long_text"
      ? "Sugerencia: unos 300 caracteres. Máximo 4000 caracteres."
      : field.type === "text"
        ? "Sugerencia: unos 150 caracteres. Máximo 200 caracteres."
        : "Máximo 200 caracteres.";
  const schema: JsonSchema = { type: "string", description: `${field.label}. ${limit}` };
  if (field.type === "select") schema.enum = field.options;
  return schema;
}

function fieldSchema(field: Field): JsonSchema {
  if (field.type !== "list") return scalarSchema(field);
  const limits = [field.min ? `Mínimo ${field.min} elementos.` : "", field.max ? `Máximo ${field.max} elementos.` : ""];
  return {
    type: "array",
    description: [`${field.label}.`, ...limits].filter(Boolean).join(" "),
    items: {
      type: "object",
      properties: Object.fromEntries(field.fields.map((sub) => [sub.id, scalarSchema(sub)])),
      required: field.fields.map((sub) => sub.id),
      additionalProperties: false,
    },
  };
}

/**
 * JSON Schema for structured outputs. Length and item limits are not supported by the API,
 * so they are stated in descriptions and enforced afterwards by validateDeliverable.
 */
export function formJsonSchema(framework: Framework, deliverableId: string): JsonSchema {
  const form = formFor(framework, deliverableId);
  if (!form) throw new Error(`"${deliverableId}" no tiene formulario`);
  return {
    type: "object",
    properties: Object.fromEntries(form.map((f) => [f.id, fieldSchema(f)])),
    required: form.map((f) => f.id),
    additionalProperties: false,
  };
}

/** Every deliverable a step depends on, directly or indirectly, in framework order. */
function prerequisites(framework: Framework, deliverableId: string): string[] {
  const byDeliverable = new Map(allSteps(framework).map((s) => [s.deliverable, s]));
  const found = new Set<string>();
  const visit = (id: string) => {
    for (const required of byDeliverable.get(id)?.requires ?? []) {
      if (!found.has(required)) {
        found.add(required);
        visit(required);
      }
    }
  };
  visit(deliverableId);
  // Deliverables a step only reads: direct ones, without their own dependencies.
  for (const used of byDeliverable.get(deliverableId)?.uses ?? []) found.add(used);
  const order = [framework.profile.id, ...allSteps(framework).map((s) => s.deliverable)];
  return order.filter((id) => found.has(id));
}

function titleOf(framework: Framework, deliverableId: string): string {
  if (deliverableId === framework.profile.id) return "Perfil del proyecto";
  return allSteps(framework).find((s) => s.deliverable === deliverableId)?.title ?? deliverableId;
}

/** Answers rendered with the form's labels and order, so the text only depends on the data. */
function render(
  framework: Framework,
  deliverableId: string,
  data: Record<string, unknown>,
  saved: ReadonlyMap<string, SavedDeliverableLike>,
): string {
  const tool = toolFor(framework, deliverableId);
  if (tool) {
    // An out-of-date ranking would mislead the model more than no ranking.
    if (toolIsStale(framework, deliverableId, saved)) return "- (puntuaciones desactualizadas: la lista cambió después de puntuar)";
    const rows = Array.isArray(data.rows) ? (data.rows as ToolRow[]) : [];
    const ranked = scoreTool(tool.spec, rows);
    return ranked.length
      ? ranked.map((r, i) => `${i + 1}. ${r.item} — ${formatToolTotal(tool.spec, r.total)}`).join("\n")
      : "- (sin puntuaciones)";
  }
  const lines: string[] = [];
  for (const field of formFor(framework, deliverableId) ?? []) {
    const value = data[field.id];
    if (field.type === "list" && Array.isArray(value)) {
      lines.push(`- ${field.label}:`);
      value.forEach((item, i) => {
        const parts = field.fields
          .map((sub) => [sub.label, (item as Record<string, unknown>)[sub.id]] as const)
          .filter(([, v]) => typeof v === "string" && v.trim())
          .map(([label, v]) => `${label}: ${String(v)}`);
        lines.push(`  ${i + 1}. ${parts.join(" | ")}`);
      });
    } else if (typeof value === "string" && value.trim()) {
      lines.push(`- ${field.label}: ${value}`);
    }
  }
  return lines.length ? lines.join("\n") : "- (sin respuestas)";
}

export function buildAiRequest(
  framework: Framework,
  deliverableId: string,
  saved: ReadonlyMap<string, SavedDeliverableLike>,
): AiRequest {
  const instruction = aiInstructionFor(framework, deliverableId);
  if (!instruction) throw new Error(`"${deliverableId}" no tiene ayuda de IA`);

  const context = prerequisites(framework, deliverableId)
    .filter((id) => saved.get(id)?.status === "done")
    .map((id) => `## ${titleOf(framework, id)}\n${render(framework, id, saved.get(id)!.data, saved)}`);

  const draft = saved.get(deliverableId);
  const user = [
    `# Paso: ${titleOf(framework, deliverableId)}`,
    instruction,
    "# Contexto del proyecto",
    context.join("\n\n") || "(sin contexto)",
    "# Borrador actual del founder",
    draft ? render(framework, deliverableId, draft.data, saved) : "(vacío)",
  ].join("\n\n");

  return { system: SYSTEM, user, schema: formJsonSchema(framework, deliverableId) };
}
