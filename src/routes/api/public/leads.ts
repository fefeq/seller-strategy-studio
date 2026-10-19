import { createFileRoute } from "@tanstack/react-router";

// Public lead intake: forms, Zapier/Make and CRM webhooks post here with a per-company secret key.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Lead-Key, Authorization",
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: CORS });

async function sourceFor(request: Request) {
  const url = new URL(request.url);
  const bearer = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  const key = (url.searchParams.get("key") ?? request.headers.get("X-Lead-Key") ?? bearer ?? "").trim();
  if (!/^gtm_[A-Za-z0-9]{24,64}$/.test(key)) return null;
  const { hashLeadKey } = await import("@/lib/leads-ingest");
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { data } = await db.from("lead_sources").select("id,org_id,active,default_stage,received_count").eq("token_hash", await hashLeadKey(key)).maybeSingle();
  if (!data || !data.active || !data.org_id) return null;
  return { db, source: data as typeof data & { org_id: string } };
}

async function readBody(request: Request): Promise<unknown> {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/x-www-form-urlencoded") || type.includes("multipart/form-data")) {
    const form = await request.formData();
    const out: Record<string, unknown> = {};
    form.forEach((v, k) => { if (typeof v === "string") out[k] = v; });
    return out;
  }
  const text = await request.text();
  try { return JSON.parse(text); } catch { return null; }
}

export const Route = createFileRoute("/api/public/leads")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      // Lets tools verify the link without sending a lead.
      GET: async ({ request }) => ((await sourceFor(request)) ? json({ ok: true }) : json({ ok: false, error: "Clave no válida" }, 401)),
      POST: async ({ request }) => {
        const { LEAD_LIMITS, flattenPayload, normalizeLead } = await import("@/lib/leads");
        const len = Number(request.headers.get("content-length") ?? 0);
        if (len > LEAD_LIMITS.maxBodyBytes) return json({ ok: false, error: "Envío demasiado grande" }, 413);
        const found = await sourceFor(request);
        if (!found) return json({ ok: false, error: "Clave no válida" }, 401);
        const { db, source } = found;

        const body = await readBody(request);
        const records = flattenPayload(body);
        if (!records.length) return json({ ok: false, error: "No se encontró ningún lead en el envío" }, 400);
        if (records.length > LEAD_LIMITS.maxLeads) return json({ ok: false, error: `Máximo ${LEAD_LIMITS.maxLeads} leads por envío` }, 413);

        const { ingestLead } = await import("@/lib/leads-ingest");
        const { data: segments } = await db.from("segments").select("id,name").eq("org_id", source.org_id);
        const ctx = { orgId: source.org_id, sourceId: source.id, segments: segments ?? [] };
        const results: { status: string; error?: string }[] = [];
        for (const rec of records) {
          const n = normalizeLead(rec, { defaultStage: source.default_stage as never });
          if ("error" in n) {
            results.push({ status: "error", error: n.error });
            await db.from("lead_events").insert({ org_id: source.org_id, lead_source_id: source.id, channel: "link", status: "error", summary: "Lead sin empresa", error: n.error });
            continue;
          }
          try {
            const r = await ingestLead(db, ctx, n.lead);
            const warn = n.lead.stageRecognized ? null : "Etapa no reconocida: se usó la etapa por defecto";
            results.push({ status: r.status, ...(warn ? { error: warn } : {}) });
            await db.from("lead_events").insert({ org_id: source.org_id, lead_source_id: source.id, channel: "link", status: r.status, summary: r.summary, error: warn, account_id: r.accountId, deal_id: r.dealId });
          } catch (e) {
            const msg = (e as Error).message.slice(0, 300);
            console.error("lead ingest failed", msg);
            results.push({ status: "error", error: "No se pudo guardar el lead" });
            await db.from("lead_events").insert({ org_id: source.org_id, lead_source_id: source.id, channel: "link", status: "error", summary: n.lead.company, error: msg });
          }
        }
        await db.from("lead_sources").update({ received_count: source.received_count + records.length, last_received_at: new Date().toISOString() }).eq("id", source.id);
        const ok = results.filter((r) => r.status !== "error").length;
        return json({ ok: ok > 0, received: records.length, saved: ok, results }, ok > 0 ? 200 : 422);
      },
    },
  },
});
