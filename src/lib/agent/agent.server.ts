import { learnFrom, memoryBlock } from "@/lib/memory.server";
import { afterResponse } from "@/lib/after-response.server";
import { createOpenAI } from "@ai-sdk/openai";
import { jsonSchema, stepCountIs, streamText, tool, type ModelMessage } from "ai";
import { z } from "zod";
import {
  aiProviders,
  fixGeminiStream,
  geminiAgentModel,
  GEMINI_OPENAI_BASE,
  geminiErrorMessage,
  OPENROUTER_BASE,
  openrouterModel,
  openrouterRouting,
  sanitizeSchema,
  shouldFallBack,
  withThoughtSignatures,
  type AiProvider,
} from "@/lib/gemini";
import { openrouterErrorMessage } from "@/lib/ai-gateway";
import { createLovableAiGatewayRunIdFetch } from "./run-id";
import { safeErrorLog } from "./safe-error-log";
import { summarizeAction, toolsFor, type ToolCtx } from "./tools";
import { ROLES, type Role } from "@/lib/roles";
import { getPersona } from "@/lib/bmad/personas";
import { getWorkflow } from "@/lib/bmad/workflows";
import { loadAgentRules, rulesBlock, RULES_READ_FAILED } from "@/lib/knowledge-rules";
import type { Json } from "@/integrations/supabase/types";

const MODEL = "openai/gpt-6-astra";

export type AgentChannel = "app" | "telegram";
export type AgentMode = "chat" | "interview";
export type PendingAction = {
  id: string;
  tool: string;
  summary: string;
  status: string;
  result?: string;
};

function personaPrompt(personaId?: string | null, workflowId?: string | null) {
  const p = getPersona(personaId);
  const w = getWorkflow(workflowId);
  let s = "";
  if (p)
    s += `\nPERSONAJE: eres ${p.name}, ${p.title} del equipo GTM (personaje inspirado en ${p.inspiredBy}; no digas que eres esa persona real). ${p.tone} Tu foco: ${p.focus} Tu menú: ${p.menu.map((m) => `${m.code} ${m.label}`).join(" · ")}. Si te piden algo fuera de tu foco, ayuda igualmente y sugiere el agente adecuado.`;
  if (w)
    s += `\nFLUJO ACTIVO: ${w.label}. ${w.instructions}${w.produces ? ` Este flujo genera un documento del Ciclo GTM: cuando tengas lo necesario, propón crear el borrador con la herramienta draft_artifact (kind=${w.produces}).` : ""}`;
  return s;
}

function systemPrompt(
  ctx: ToolCtx,
  channel: AgentChannel,
  mode: AgentMode,
  orgName: string,
  personaId?: string | null,
  workflowId?: string | null,
  memory = "",
  rules = "",
) {
  const role = ctx.roles.map((r) => ROLES[r as Role]?.label ?? r).join(", ");
  const today = new Date().toISOString().slice(0, 10);
  const base = `Eres Nokko, el copiloto comercial de ${orgName}. Hablas en español neutro (tú), directo y breve; empiezas por la conclusión, sin signos de exclamación ni emoji. Hoy es ${today}. El usuario es ${role}. Moneda: ${ctx.currency}.${personaPrompt(personaId, workflowId)}
- Usa get_cycle_status para saber en qué fase del Ciclo GTM está la empresa y qué documentos aprobados existen; básate en ellos.
Reglas:
- Usa las herramientas para consultar datos reales antes de responder; nunca inventes cifras ni ids.
- Para cambiar datos usa las herramientas de escritura: NO se ejecutan al momento, quedan como propuesta que el usuario confirma. Di claramente qué has propuesto y que debe confirmarlo.
- Si necesitas un id, búscalo primero con "search" o "list_deals".
- Sé proactivo: al final, si ves un riesgo o un siguiente paso evidente, propónlo en una línea.
- Cuando se complete un paso de la configuración de la estrategia (posicionamiento, ICP, segmentos, benchmarks, pilares, cuota, cuentas, deals), llama a get_setup_status, confirma lo hecho en una frase y propón el siguiente con su motivo tal como lo devuelve guia.mensaje. No elijas tú el siguiente paso: es el que devuelve la herramienta.
${channel === "telegram" ? "- Estás en Telegram: respuestas cortas, sin tablas; usa listas simples." : "- Puedes usar markdown (listas, negritas, tablas pequeñas)."}${memory ? `\n${memory}` : ""}${rules ? `\n${rules}` : ""}`;
  if (mode !== "interview") return base;
  return `${base}
MODO ENTREVISTA DE CONFIGURACIÓN: tu objetivo es completar la estrategia GTM de la empresa con la mínima fricción.
- Empieza llamando a get_setup_status y pregunta SOLO por lo que falta y le corresponde a su rol (estado.missing ya viene filtrado; lo de fuera_de_tu_rol no se lo preguntes), empezando por el paso de guia.mensaje (orden fijo, no por peso).
- Una pregunta (o un bloque pequeño relacionado) por turno. Ofrece una propuesta por defecto que el usuario pueda aceptar con "sí".
- En cuanto tengas una respuesta, propón guardarla con la herramienta adecuada (update_positioning, create_icp, upsert_segment, create_pillar, set_quota, create_account).
- Cuando todo esté completo, felicítale y sugiere el siguiente paso útil.`;
}

/** Runs one agent turn. Write tools create pending actions instead of executing. */
export async function runAgent(
  ctx: ToolCtx,
  opts: {
    conversationId: string;
    text: string;
    channel: AgentChannel;
    mode: AgentMode;
    orgName: string;
    signal?: AbortSignal;
    personaId?: string | null;
    workflowId?: string | null;
  },
) {
  // E3: a message that looks like a secret is never stored nor sent to the model.
  const { looksLikeSecret, SECRET_REFUSAL } = await import("./secret-guard");
  if (looksLikeSecret(opts.text)) return { text: SECRET_REFUSAL, pending: [] as PendingAction[] };
  const chain = aiProviders(process.env);
  if (chain.length === 1 && chain[0] === "lovable" && !process.env["LOVABLE_API_KEY"])
    throw new Error("La IA no está configurada");

  const { data: hist } = await ctx.db
    .from("agent_messages")
    .select("role,content")
    .eq("conversation_id", opts.conversationId)
    .order("created_at", { ascending: false })
    .limit(30);
  const history: ModelMessage[] = (hist ?? [])
    .reverse()
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  await ctx.db
    .from("agent_messages")
    .insert({ conversation_id: opts.conversationId, role: "user", content: opts.text });

  // The team's rules from Conocimiento, every turn and every mode (SDD-20261106-agent-rules-reader).
  const [memory, rules, pref] = await Promise.all([
    memoryBlock(ctx),
    loadAgentRules(ctx),
    ctx.db.from("user_agent_prefs").select("autonomy").eq("user_id", ctx.userId).maybeSingle(),
  ]);
  // E1: the person's level only shapes how Nokko proposes; confirmations stay for every level.
  const { autonomyPrompt, parseAutonomy } = await import("@/lib/autonomy");
  const level = autonomyPrompt(parseAutonomy(pref.data?.autonomy));
  const pending: PendingAction[] = [];
  const system = systemPrompt(
    ctx,
    opts.channel,
    opts.mode,
    opts.orgName,
    opts.personaId,
    opts.workflowId,
    memory,
    `${rulesBlock(rules.rules, { withPerson: true })}\n${level}`,
  );
  const messages: ModelMessage[] = [...history, { role: "user", content: opts.text }];

  // Own keys first; when one runs out of quota or fails before doing anything, the next provider answers.
  let text = "";
  for (let i = 0; i < chain.length; i++) {
    const kind = chain[i]!;
    try {
      text = await runWith(kind, ctx, opts, system, messages, pending);
      break;
    } catch (e) {
      const status = Number((e as { statusCode?: number })?.statusCode ?? 0);
      const body = String((e as { responseBody?: string })?.responseBody ?? "");
      const canFallBack =
        kind !== "lovable" &&
        i < chain.length - 1 &&
        pending.length === 0 &&
        !opts.signal?.aborted &&
        shouldFallBack(status, body);
      if (canFallBack) {
        console.warn(`Agent provider ${kind} failed (${status}); trying ${chain[i + 1]}`);
        continue;
      }
      console.error("Agent error", safeErrorLog(e));
      throw new Error(agentErrorMessage(kind, status, body));
    }
  }
  if (!text)
    text = pending.length
      ? "He preparado estas acciones. Confírmalas para ejecutarlas."
      : "No he podido generar respuesta.";
  const reply = text;
  // Fixed text, not left to the model: the person must know this answer did not follow the team's rules.
  if (!rules.ok) text = `${RULES_READ_FAILED}\n\n${text}`;

  await ctx.db
    .from("agent_messages")
    .insert({ conversation_id: opts.conversationId, role: "assistant", content: text });
  await ctx.db
    .from("agent_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", opts.conversationId);
  // Learn from what the user said (the reply gives context) after the answer is returned: never adds latency.
  if (opts.text.trim().length >= 40) {
    const learnText = `Usuario: ${opts.text}\nNokko: ${reply.slice(0, 1500)}`;
    afterResponse("chat memory", () => learnFrom(ctx, { source: "chat", text: learnText }));
  }
  return { text, pending };
}

function agentErrorMessage(kind: AiProvider, status: number, body: string) {
  if (kind === "gemini" && /^(400|401|403|404|429|5\d\d)$/.test(String(status)))
    return geminiErrorMessage(status, body);
  if (kind === "openrouter" && status) return openrouterErrorMessage(status);
  if (status === 402)
    return "Sin créditos de IA disponibles. Añade créditos en Ajustes → Planes y créditos.";
  if (status === 429) return "Demasiadas peticiones, inténtalo en un momento.";
  if (status === 403) return "El uso de IA está bloqueado para este espacio de trabajo.";
  return "El agente no pudo responder. Inténtalo de nuevo.";
}

/** One agent attempt on one provider. Throws the provider's own error (statusCode/responseBody) on failure. */
async function runWith(
  kind: AiProvider,
  ctx: ToolCtx,
  opts: { conversationId: string; signal?: AbortSignal },
  system: string,
  messages: ModelMessage[],
  pending: PendingAction[],
) {
  const gemini = kind === "gemini";
  const tools = Object.fromEntries(
    toolsFor(ctx.roles).map((t) => [
      t.name,
      tool({
        description:
          t.description + (t.kind === "write" ? " (Requiere confirmación del usuario.)" : ""),
        // Gemini rejects some JSON-Schema keywords (format, pattern…): hand it a sanitized schema, still validated with zod.
        inputSchema: gemini
          ? jsonSchema<unknown>(
              sanitizeSchema(
                z.toJSONSchema(t.input, { io: "input", unrepresentable: "any" }),
              ) as never,
              {
                validate: (v) => {
                  const r = t.input.safeParse(v);
                  return r.success
                    ? { success: true as const, value: r.data }
                    : { success: false as const, error: r.error };
                },
              },
            )
          : t.input,
        execute: async (args: unknown) => {
          if (t.kind === "read") {
            try {
              return await t.run(ctx, args as never);
            } catch (e) {
              return { error: (e as Error).message };
            }
          }
          let summary = summarizeAction(t.name, args);
          if (t.spends) {
            const { spendEstimateLine, withEstimate } = await import("./spend-confirm");
            summary = withEstimate(summary, t.name, await spendEstimateLine(ctx.db, ctx.orgId, t.name));
          }
          const { data, error } = await ctx.db
            .from("agent_pending_actions")
            .insert({
              org_id: ctx.orgId,
              user_id: ctx.userId,
              conversation_id: opts.conversationId,
              tool: t.name,
              args: args as unknown as Json,
              summary,
            })
            .select("id")
            .single();
          if (error) return { error: error.message };
          pending.push({ id: data.id, tool: t.name, summary, status: "pending" });
          return { status: "pendiente_de_confirmacion", resumen: summary };
        },
      }),
    ]),
  );

  let model;
  if (gemini) {
    const provider = createOpenAI({
      baseURL: GEMINI_OPENAI_BASE,
      apiKey: process.env["GEMINI_API_KEY"],
      fetch: (async (url: RequestInfo | URL, init?: RequestInit) =>
        fixGeminiStream(
          await fetch(
            url,
            typeof init?.body === "string"
              ? { ...init, body: withThoughtSignatures(init.body) }
              : init,
          ),
        )) as typeof fetch,
    });
    model = provider.chat(geminiAgentModel(process.env));
  } else if (kind === "openrouter") {
    // Fallback models and parameter-aware routing go into each request body (the SDK has no field for them).
    const routing = openrouterRouting(process.env);
    const provider = createOpenAI({
      baseURL: OPENROUTER_BASE,
      apiKey: process.env["OPENROUTER_API_KEY"],
      headers: { "X-Title": "Nokko" },
      fetch: (async (url: RequestInfo | URL, init?: RequestInit) => {
        if (typeof init?.body !== "string") return fetch(url, init);
        try {
          return fetch(url, {
            ...init,
            body: JSON.stringify({ ...JSON.parse(init.body), ...routing }),
          });
        } catch {
          return fetch(url, init);
        }
      }) as typeof fetch,
    });
    model = provider.chat(openrouterModel(process.env));
  } else {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("La IA no está configurada");
    const runId = createLovableAiGatewayRunIdFetch();
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: runId.fetch,
    });
    model = provider.responses(MODEL);
  }

  // The stream's own error (provider status and body); "No output generated" alone hides it.
  let streamError: unknown;
  try {
    const result = streamText({
      model,
      system,
      messages,
      tools,
      stopWhen: stepCountIs(12),
      abortSignal: opts.signal,
      maxRetries: kind === "lovable" ? 2 : 0,
      onError: ({ error }) => {
        streamError ??= error;
        console.error("Agent stream error", safeErrorLog(error));
      },
      ...(kind === "lovable"
        ? {
            providerOptions: {
              openai: {
                store: false,
                forceReasoning: true,
                reasoningEffort: "low",
                reasoningSummary: "auto",
                include: ["reasoning.encrypted_content"],
              },
            },
          }
        : {}),
    });
    return (await result.text).trim();
  } catch (caught) {
    const e = streamError ?? caught;
    // AI_RetryError wraps the real API error.
    throw (e as { lastError?: unknown })?.lastError ?? e;
  }
}
