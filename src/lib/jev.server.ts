// Jev (TypeSafe System One) through the Lovable AI Gateway: typed judgments, buffered JSON, no generated text.
// Server-only (reads LOVABLE_API_KEY inside the call). Errors come back in Spanish with what to do.

export class JevError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export async function askJev(request: { model: string; state: unknown; questions: Record<string, unknown> }): Promise<unknown> {
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
