// One place that calls Gemini generateContent (server-only: reads GEMINI_API_KEY). Adds the two resilience rules the
// raw call needs: one retry on transient errors, and a retry without thinkingConfig when the model rejects it.
import { geminiModel, GEMINI_BASE, withoutThinking } from "@/lib/gemini";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function geminiGenerate(body: unknown): Promise<Response> {
  const call = (b: unknown) => fetch(`${GEMINI_BASE}/models/${geminiModel(process.env)}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": process.env["GEMINI_API_KEY"] ?? "", "Content-Type": "application/json" },
    body: JSON.stringify(b),
  });
  let res = await call(body);
  if (res.status === 429 || res.status === 503 || res.status === 500) {
    const text = await res.clone().text().catch(() => "");
    if (!/quota|billing|exceeded your current/i.test(text)) { await wait(1500); res = await call(body); }
  }
  if (res.status === 400 && /thinking/i.test(await res.clone().text().catch(() => ""))) res = await call(withoutThinking(body));
  return res;
}
