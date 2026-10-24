// Raw-HTTP text helper shared by server functions and the agent. Server-only (reads secrets inside the call).
// GEMINI_API_KEY set → Google Gemini directly (own key, billed by Google); otherwise the Lovable AI Gateway.
import { aiProvider, buildGenerateRequest, extractText, geminiErrorMessage, geminiModel, GEMINI_BASE, type AskOpts } from "@/lib/gemini";

export async function ask(system: string, user: string, opts: AskOpts = {}) {
  return aiProvider(process.env) === "gemini" ? askGemini(system, user, opts) : askLovable(system, user, opts);
}

async function askGemini(system: string, user: string, opts: AskOpts) {
  const res = await fetch(`${GEMINI_BASE}/models/${geminiModel(process.env)}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": process.env["GEMINI_API_KEY"] ?? "", "Content-Type": "application/json" },
    body: JSON.stringify(buildGenerateRequest(system, user, opts)),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("Gemini error", res.status, body.slice(0, 500));
    throw new Error(geminiErrorMessage(res.status, body));
  }
  return extractText(await res.json());
}

async function askLovable(system: string, user: string, opts: AskOpts) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Lovable-API-Key": process.env["LOVABLE_API_KEY"] ?? "",
      "X-Lovable-AIG-SDK": "fetch",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      instructions: system,
      input: [{ role: "user", content: opts.files?.length ? [{ type: "input_text", text: user }, ...opts.files.map((f) => ({ type: "input_file", filename: f.filename, file_data: f.dataUrl }))] : user }],
      reasoning: { effort: opts.effort ?? "low" },
      ...(opts.schema ? { text: { format: { type: "json_schema", name: opts.schema.name, strict: true, schema: opts.schema.schema } } } : {}),
      store: false,
      stream: true,
    }),
  });
  if (res.status === 429) throw new Error("Demasiadas peticiones, inténtalo en un momento.");
  if (res.status === 402) throw new Error("Sin créditos de IA disponibles. Añade créditos en Ajustes → Planes y créditos.");
  if (res.status === 403) {
    const body = await res.text().catch(() => "");
    console.error("AI gateway 403", body.slice(0, 500));
    throw new Error("El uso de IA está bloqueado para este espacio de trabajo (límite o permisos). Revisa la configuración de IA.");
  }
  if (!res.ok || !res.body) {
    console.error("AI gateway error", res.status, (await res.text().catch(() => "")).slice(0, 500));
    throw new Error("La IA no respondió");
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const ev = JSON.parse(payload) as { type?: string; delta?: string };
        if (ev.type === "response.output_text.delta" && ev.delta) out += ev.delta;
      } catch { /* ignore partial */ }
    }
  }
  return out;
}
