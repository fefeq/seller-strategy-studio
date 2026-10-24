// Jev (TypeSafe System One) through the Lovable AI Gateway: typed judgments, buffered JSON, no generated text.
// Server-only (reads LOVABLE_API_KEY inside the call). Errors come back in Spanish with what to do.

import { aiProviders, jevAnswerSchema, jevPrompt, JEV_SYSTEM, normalizeJevAnswers } from "@/lib/gemini";
import { askOwn, ProviderError, withFallback } from "@/lib/ai-gateway";

export class JevError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export async function askJev(request: { model: string; state: unknown; questions: Record<string, unknown> }): Promise<unknown> {
  // Own keys first (Gemini, OpenRouter) with structured output; Jev on the Lovable AI Gateway as last resort.
  try {
    return await withFallback(aiProviders(process.env), (p) => (p === "lovable" ? askLovableJev(request) : askOwnJudgments(p, request)));
  } catch (e) {
    if (e instanceof ProviderError) throw new JevError(e.message, e.status || 502);
    throw e;
  }
}

async function askLovableJev(request: { model: string; state: unknown; questions: Record<string, unknown> }): Promise<unknown> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new JevError("La IA no está configurada en este proyecto.", 401);
  const res = await fetch("https://ai.gateway.lovable.dev/v1/systemone", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify(request),
  });
  if (res.ok) return res.json();
  const body = await res.text().catch(() => "");
  console.error(`Jev request failed [${res.status}]: ${body.slice(0, 500)}`);
  let msg = "";
  try { msg = (JSON.parse(body) as { message?: string; error?: { message?: string } }).message ?? (JSON.parse(body) as { error?: { message?: string } }).error?.message ?? ""; } catch { /* not JSON */ }
  if (res.status === 402) throw new JevError("Sin créditos de IA disponibles. Añade créditos en Ajustes → Planes y créditos.", 402);
  if (res.status === 403) throw new JevError(`El uso de IA está bloqueado para este espacio de trabajo${msg ? `: ${msg}` : " (límite o permisos)"}.`, 403);
  if (res.status === 429) throw new JevError("Demasiadas peticiones a la IA; vuelve a intentarlo en un minuto.", 429);
  if (res.status === 404) throw new JevError("El modelo de calificación no está disponible ahora mismo.", 404);
  throw new JevError(res.status >= 500 ? "La IA no respondió; vuelve a intentarlo en un momento." : `La IA rechazó la petición${msg ? `: ${msg}` : ""}.`, res.status);
}

/** Same typed judgments through structured output on an own key; returns the `{answers}` shape Jev returns. */
async function askOwnJudgments(provider: "gemini" | "openrouter", request: { state: unknown; questions: Record<string, unknown> }): Promise<unknown> {
  const text = await askOwn(provider, JEV_SYSTEM, jevPrompt(request), { effort: "low", schema: { name: "qualification", schema: jevAnswerSchema(request.questions) } });
  try { return normalizeJevAnswers(text, request.questions); }
  catch (e) { throw new JevError((e as Error).message, 502); }
}
