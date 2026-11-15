// Raw-HTTP text helper shared by server functions and the agent. Server-only (reads secrets inside the call).
// Walks aiProviders(): OpenRouter (the company's own Gemini, Claude and GPT keys), then Gemini directly; the Lovable
// AI Gateway only when no OpenRouter key is set (its errors are terminal, never retried here).
import {
  aiProviders,
  buildGenerateRequest,
  extractText,
  geminiErrorMessage,
  geminiModel,
  GEMINI_BASE,
  OPENROUTER_BASE,
  openrouterModel,
  openrouterRouting,
  shouldFallBack,
  type AiProvider,
  type AskOpts,
} from "@/lib/gemini";

/** Response bodies of ProviderErrors, outside the error object (see ProviderError). */
const providerBodies = new WeakMap<ProviderError, string>();

/** Error from an own-key provider, with the HTTP status so the caller can decide to fall back.
 *  The response body may quote the prompt (the team's rules, SDD-20261106-agent-rules-reader §10): it is kept in a
 *  module WeakMap, read only through providerErrorBody(), so no property, getter or symbol of the error reaches it and
 *  logging or serializing the error (even inspect with getters) never prints it. */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
    body = "",
    readonly provider: AiProvider = "gemini",
  ) {
    super(message);
    providerBodies.set(this, body);
  }
}

/** The provider's response body of a ProviderError (for fall-back decisions; never log it). */
export function providerErrorBody(e: ProviderError): string {
  return providerBodies.get(e) ?? "";
}

export type TrackedAskOpts = AskOpts & { onCost?: (cost: number | null, provider: string) => Promise<void> };
export async function ask(system: string, user: string, opts: TrackedAskOpts = {}) {
  return withFallback(aiProviders(process.env), (p) =>
    p === "openrouter" ? askOpenRouter(system, user, opts) : (async () => {
      const text = p === "lovable" ? await askLovable(system, user, opts) : await askOwn(p, system, user, opts);
      await opts.onCost?.(null, p);
      return text;
    })(),
  );
}

/** Own keys only (Gemini / OpenRouter), in chain order; throws the last ProviderError if none answers. */
export async function askOwn(
  provider: Exclude<AiProvider, "lovable">,
  system: string,
  user: string,
  opts: AskOpts = {},
) {
  return provider === "gemini" ? askGemini(system, user, opts) : askOpenRouter(system, user, opts);
}

/** Runs `fn` for each provider in order; moves on only when an own-key provider fails with a fall-back status. */
export async function withFallback<T>(
  chain: AiProvider[],
  fn: (p: AiProvider) => Promise<T>,
): Promise<T> {
  let last: unknown;
  for (let i = 0; i < chain.length; i++) {
    const p = chain[i]!;
    try {
      return await fn(p);
    } catch (e) {
      last = e;
      const more = i < chain.length - 1;
      if (!(e instanceof ProviderError) || !more || !shouldFallBack(e.status, providerErrorBody(e)))
        throw e;
      console.warn(`AI provider ${p} failed (${e.status}); trying ${chain[i + 1]}`);
    }
  }
  throw last ?? new Error("La IA no está configurada");
}

async function askGemini(system: string, user: string, opts: AskOpts) {
  let res: Response;
  try {
    res = await fetch(`${GEMINI_BASE}/models/${geminiModel(process.env)}:generateContent`, {
      method: "POST",
      headers: {
        "x-goog-api-key": process.env["GEMINI_API_KEY"] ?? "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildGenerateRequest(system, user, opts)),
    });
  } catch {
    throw new ProviderError(
      "Gemini no respondió; vuelve a intentarlo en un momento.",
      0,
      "",
      "gemini",
    );
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("Gemini error", res.status, { bodyLength: body.length });
    throw new ProviderError(geminiErrorMessage(res.status, body), res.status, body, "gemini");
  }
  return extractText(await res.json());
}

async function askOpenRouter(system: string, user: string, opts: TrackedAskOpts) {
  const content = opts.files?.length
    ? [
        { type: "text", text: user },
        ...opts.files.map((f) => ({
          type: "file",
          file: { filename: f.filename, file_data: f.dataUrl },
        })),
      ]
    : user;
  let res: Response;
  try {
    res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env["OPENROUTER_API_KEY"] ?? ""}`,
        "Content-Type": "application/json",
        "X-Title": "Nokko",
      },
      body: JSON.stringify({
        model: openrouterModel(process.env),
        messages: [
          { role: "system", content: system },
          { role: "user", content },
        ],
        ...(opts.schema
          ? {
              response_format: {
                type: "json_schema",
                json_schema: { name: opts.schema.name, strict: true, schema: opts.schema.schema },
              },
            }
          : {}),
        ...openrouterRouting(process.env),
        ...(opts.onCost ? { usage: { include: true } } : {}),
      }),
    });
  } catch {
    throw new ProviderError(
      "OpenRouter no respondió; vuelve a intentarlo en un momento.",
      0,
      "",
      "openrouter",
    );
  }
  const body = await res.text().catch(() => "");
  if (!res.ok) {
    console.error("OpenRouter error", res.status, { bodyLength: body.length });
    throw new ProviderError(openrouterErrorMessage(res.status), res.status, body, "openrouter");
  }
  try {
    const json = JSON.parse(body) as {
      choices?: { message?: { content?: string } }[];
      error?: { code?: number; message?: string };
      usage?: { is_byok?: boolean; cost?: number; cost_details?: { upstream_inference_cost?: number } };
    };
    if (json.error)
      throw new ProviderError(
        openrouterErrorMessage(json.error.code ?? 502),
        json.error.code ?? 502,
        body,
        "openrouter",
      );
    const amount = json.usage?.is_byok === true ? json.usage.cost_details?.upstream_inference_cost : json.usage?.is_byok === false ? json.usage.cost : null;
    await opts.onCost?.(typeof amount === "number" && Number.isFinite(amount) && amount >= 0 ? amount : null, "openrouter");
    return json.choices?.[0]?.message?.content ?? "";
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    throw new ProviderError("OpenRouter devolvió una respuesta inválida.", 502, body, "openrouter");
  }
}

export function openrouterErrorMessage(status: number) {
  if (status === 402) return "Sin saldo en OpenRouter. Recarga créditos en openrouter.ai.";
  if (status === 401 || status === 403)
    return "La clave de OpenRouter no es válida. Revisa el secreto OPENROUTER_API_KEY.";
  if (status === 429) return "OpenRouter tiene demasiadas peticiones; inténtalo en un momento.";
  if (status === 404)
    return "Ningún modelo de OpenRouter está disponible (revisa OPENROUTER_MODEL y que tus claves estén añadidas en OpenRouter).";
  return status >= 500
    ? "OpenRouter no respondió; vuelve a intentarlo en un momento."
    : "OpenRouter rechazó la petición.";
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
      input: [
        {
          role: "user",
          content: opts.files?.length
            ? [
                { type: "input_text", text: user },
                ...opts.files.map((f) => ({
                  type: "input_file",
                  filename: f.filename,
                  file_data: f.dataUrl,
                })),
              ]
            : user,
        },
      ],
      reasoning: { effort: opts.effort ?? "low" },
      ...(opts.schema
        ? {
            text: {
              format: {
                type: "json_schema",
                name: opts.schema.name,
                strict: true,
                schema: opts.schema.schema,
              },
            },
          }
        : {}),
      store: false,
      stream: true,
    }),
  });
  if (res.status === 429) throw new Error("Demasiadas peticiones, inténtalo en un momento.");
  if (res.status === 402)
    throw new Error(
      "Sin créditos de IA disponibles. Añade créditos en Ajustes → Planes y créditos.",
    );
  if (res.status === 403) {
    const body = await res.text().catch(() => "");
    console.error("AI gateway 403", { bodyLength: body.length });
    throw new Error(
      "El uso de IA está bloqueado para este espacio de trabajo (límite o permisos). Revisa la configuración de IA.",
    );
  }
  if (!res.ok || !res.body) {
    console.error("AI gateway error", res.status, {
      bodyLength: (await res.text().catch(() => "")).length,
    });
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
      } catch {
        /* ignore partial */
      }
    }
  }
  return out;
}
