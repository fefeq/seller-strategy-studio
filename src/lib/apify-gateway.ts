// Apify through the Lovable connector gateway (gateway-backed: LOVABLE_API_KEY + APIFY_API_KEY, read inside the
// call). Server-only usage. Runs are synchronous and capped by result count and by spend (maxTotalChargeUsd).
import { apifyErrorText } from "@/lib/apify";

const GATEWAY = "https://connector-gateway.lovable.dev/apify";

export async function runActor(actor: { id: string; maxUsd: number }, input: object, opts: { maxItems: number; timeoutSecs?: number }): Promise<unknown[]> {
  const lovable = process.env["LOVABLE_API_KEY"];
  const key = process.env["APIFY_API_KEY"];
  if (!lovable || !key) throw new Error("Apify no está conectado en este proyecto. Conéctalo en Integraciones.");
  const p = new URLSearchParams({ timeout: String(opts.timeoutSecs ?? 75), memory: "1024", maxItems: String(opts.maxItems), maxTotalChargeUsd: String(actor.maxUsd) });
  const res = await fetch(`${GATEWAY}/acts/${actor.id}/run-sync-get-dataset-items?${p}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${lovable}`, "X-Connection-Api-Key": key, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`Apify run failed [${res.status}] ${actor.id} body ${body.length} chars`);
    throw new Error(apifyErrorText(res.status, body));
  }
  const data = await res.json().catch(() => null);
  return Array.isArray(data) ? data : [];
}
