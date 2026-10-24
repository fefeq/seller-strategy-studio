// Jev (TypeSafe System One) through the Lovable AI Gateway: typed judgments, buffered JSON, no generated text.
// Server-only (reads LOVABLE_API_KEY inside the call). Errors come back in Spanish with what to do.

import { aiProvider, buildGenerateRequest, extractText, geminiErrorMessage, jevAnswerSchema, jevPrompt, JEV_SYSTEM, normalizeJevAnswers } from "@/lib/gemini";

export class JevError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export async function askJev(request: { model: string; state: unknown; questions: Record<string, unknown> }): Promise<unknown> {
  if (aiProvider(process.env) === "gemini") return askGeminiJudgments(request);
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

/** Same typed judgments through Gemini structured output (own key); returns the `{answers}` shape Jev returns. */
async function askGeminiJudgments(request: { state: unknown; questions: Record<string, unknown> }): Promise<unknown> {
  const body = buildGenerateRequest(JEV_SYSTEM, jevPrompt(request), { effort: "low", schema: { name: "qualification", schema: jevAnswerSchema(request.questions) } });
  const { geminiGenerate } = await import("@/lib/gemini.server");
  const res = await geminiGenerate(body);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`Gemini judgments failed [${res.status}]: ${text.slice(0, 500)}`);
    throw new JevError(geminiErrorMessage(res.status, text), res.status);
  }
  try { return normalizeJevAnswers(extractText(await res.json()), request.questions); }
  catch (e) { throw new JevError((e as Error).message, 502); }
}
