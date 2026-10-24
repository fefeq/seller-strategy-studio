import { createOpenAI } from "@ai-sdk/openai";
import { jsonSchema, stepCountIs, streamText, tool, type ModelMessage } from "ai";
import { z } from "zod";
import { aiProvider, fixGeminiStream, geminiAgentModel, GEMINI_OPENAI_BASE, geminiErrorMessage, sanitizeSchema, withThoughtSignatures } from "@/lib/gemini";
import { createLovableAiGatewayRunIdFetch } from "./run-id";
import { summarizeAction, toolsFor, type ToolCtx } from "./tools";
import { ROLES, type Role } from "@/lib/roles";
import { getPersona } from "@/lib/bmad/personas";
import { getWorkflow } from "@/lib/bmad/workflows";

const MODEL = "openai/gpt-6-astra";

export type AgentChannel = "app" | "telegram";
export type AgentMode = "chat" | "interview";
export type PendingAction = { id: string; tool: string; summary: string; status: string; result?: string };

function personaPrompt(personaId?: string | null, workflowId?: string | null) {
  const p = getPersona(personaId);
  const w = getWorkflow(workflowId);
  let s = "";
  if (p) s += `\nPERSONAJE: eres ${p.name}, ${p.title} del equipo GTM (personaje inspirado en ${p.inspiredBy}; no digas que eres esa persona real). ${p.tone} Tu foco: ${p.focus} Tu menú: ${p.menu.map((m) => `${m.code} ${m.label}`).join(" · ")}. Si te piden algo fuera de tu foco, ayuda igualmente y sugiere el agente adecuado.`;
  if (w) s += `\nFLUJO ACTIVO: ${w.label}. ${w.instructions}${w.produces ? ` Este flujo genera un documento del Ciclo GTM: cuando tengas lo necesario, propón crear el borrador con la herramienta draft_artifact (kind=${w.produces}).` : ""}`;
  return s;
}

function systemPrompt(ctx: ToolCtx, channel: AgentChannel, mode: AgentMode, orgName: string, personaId?: string | null, workflowId?: string | null) {
  const role = ctx.roles.map((r) => ROLES[r as Role]?.label ?? r).join(", ");
  const today = new Date().toISOString().slice(0, 10);
  const base = `Eres Nokko, el copiloto comercial de ${orgName}. Hablas en español neutro (tú), directo y breve; empiezas por la conclusión, sin signos de exclamación ni emoji. Hoy es ${today}. El usuario es ${role}. Moneda: ${ctx.currency}.${personaPrompt(personaId, workflowId)}
- Usa get_cycle_status para saber en qué fase del Ciclo GTM está la empresa y qué documentos aprobados existen; básate en ellos.
Reglas:
- Usa las herramientas para consultar datos reales antes de responder; nunca inventes cifras ni ids.
- Para cambiar datos usa las herramientas de escritura: NO se ejecutan al momento, quedan como propuesta que el usuario confirma. Di claramente qué has propuesto y que debe confirmarlo.
- Si necesitas un id, búscalo primero con "search" o "list_deals".
- Sé proactivo: al final, si ves un riesgo o un siguiente paso evidente, propónlo en una línea.
${channel === "telegram" ? "- Estás en Telegram: respuestas cortas, sin tablas; usa listas simples." : "- Puedes usar markdown (listas, negritas, tablas pequeñas)."}`;
  if (mode !== "interview") return base;
  return `${base}
MODO ENTREVISTA DE CONFIGURACIÓN: tu objetivo es completar la estrategia GTM de la empresa con la mínima fricción.
- Empieza llamando a get_setup_status y pregunta SOLO por lo que falta, empezando por lo de mayor peso.
- Una pregunta (o un bloque pequeño relacionado) por turno. Ofrece una propuesta por defecto que el usuario pueda aceptar con "sí".
- En cuanto tengas una respuesta, propón guardarla con la herramienta adecuada (update_positioning, create_icp, upsert_segment, create_pillar, set_quota, create_account).
- Cuando todo esté completo, felicítale y sugiere el siguiente paso útil.`;
}

/** Runs one agent turn. Write tools create pending actions instead of executing. */
export async function runAgent(ctx: ToolCtx, opts: { conversationId: string; text: string; channel: AgentChannel; mode: AgentMode; orgName: string; signal?: AbortSignal; personaId?: string | null; workflowId?: string | null }) {
  const gemini = aiProvider(process.env) === "gemini";
  const apiKey = gemini ? process.env["GEMINI_API_KEY"] : process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("La IA no está configurada");

  const { data: hist } = await ctx.db.from("agent_messages").select("role,content").eq("conversation_id", opts.conversationId).order("created_at", { ascending: false }).limit(30);
  const history: ModelMessage[] = (hist ?? []).reverse().map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  await ctx.db.from("agent_messages").insert({ conversation_id: opts.conversationId, role: "user", content: opts.text });

  const pending: PendingAction[] = [];
  const tools = Object.fromEntries(
    toolsFor(ctx.roles).map((t) => [
      t.name,
      tool({
        description: t.description + (t.kind === "write" ? " (Requiere confirmación del usuario.)" : ""),
        // Gemini rejects some JSON-Schema keywords (format, pattern…): hand it a sanitized schema, still validated with zod.
        inputSchema: gemini
          ? jsonSchema<unknown>(sanitizeSchema(z.toJSONSchema(t.input, { io: "input", unrepresentable: "any" })) as never, { validate: (v) => { const r = t.input.safeParse(v); return r.success ? { success: true as const, value: r.data } : { success: false as const, error: r.error }; } })
          : t.input,
        execute: async (args: unknown) => {
          if (t.kind === "read") {
            try { return await t.run(ctx, args as never); } catch (e) { return { error: (e as Error).message }; }
          }
          const summary = summarizeAction(t.name, args);
          const { data, error } = await ctx.db.from("agent_pending_actions").insert({ org_id: ctx.orgId, user_id: ctx.userId, conversation_id: opts.conversationId, tool: t.name, args: args as any, summary }).select("id").single();
          if (error) return { error: error.message };
          pending.push({ id: data.id, tool: t.name, summary, status: "pending" });
          return { status: "pendiente_de_confirmacion", resumen: summary };
        },
      }),
    ]),
  );

  const runId = createLovableAiGatewayRunIdFetch();
  const provider = gemini
    ? createOpenAI({
        baseURL: GEMINI_OPENAI_BASE,
        apiKey,
        fetch: (async (url: RequestInfo | URL, init?: RequestInit) => fixGeminiStream(await fetch(url, typeof init?.body === "string" ? { ...init, body: withThoughtSignatures(init.body) } : init))) as typeof fetch,
      })
    : createOpenAI({
        baseURL: "https://ai.gateway.lovable.dev/v1",
        apiKey,
        headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
        fetch: runId.fetch,
      });

  let text = "";
  try {
    const result = streamText({
      model: gemini ? provider.chat(geminiAgentModel(process.env)) : provider.responses(MODEL),
      system: systemPrompt(ctx, opts.channel, opts.mode, opts.orgName, opts.personaId, opts.workflowId),
      messages: [...history, { role: "user", content: opts.text }],
      tools,
      stopWhen: stepCountIs(12),
      abortSignal: opts.signal,
      ...(gemini ? {} : { providerOptions: { openai: { store: false, forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", include: ["reasoning.encrypted_content"] } } }),
    });
    text = (await result.text).trim();
  } catch (e) {
    const msg = String((e as any)?.statusCode ?? "");
    console.error("Agent error", e);
    if (gemini && /^(400|401|403|404|429|5\d\d)$/.test(msg)) throw new Error(geminiErrorMessage(Number(msg), String((e as any)?.responseBody ?? "")));
    if (msg === "402") throw new Error("Sin créditos de IA disponibles. Añade créditos en Ajustes → Planes y créditos.");
    if (msg === "429") throw new Error("Demasiadas peticiones, inténtalo en un momento.");
    if (msg === "403") throw new Error("El uso de IA está bloqueado para este espacio de trabajo.");
    throw new Error("El agente no pudo responder. Inténtalo de nuevo.");
  }
  if (!text) text = pending.length ? "He preparado estas acciones. Confírmalas para ejecutarlas." : "No he podido generar respuesta.";

  await ctx.db.from("agent_messages").insert({ conversation_id: opts.conversationId, role: "assistant", content: text });
  await ctx.db.from("agent_conversations").update({ updated_at: new Date().toISOString() }).eq("id", opts.conversationId);
  return { text, pending };
}
