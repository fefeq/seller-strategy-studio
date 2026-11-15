import { createFileRoute } from "@tanstack/react-router";
import { safeErrorLog } from "@/lib/agent/safe-error-log";

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
  const key = (
    url.searchParams.get("key") ??
    request.headers.get("X-Lead-Key") ??
    bearer ??
    ""
  ).trim();
  if (!/^gtm_[A-Za-z0-9]{24,64}$/.test(key)) return null;
  const { hashLeadKey } = await import("@/lib/leads-ingest");
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { data } = await db
    .from("lead_sources")
    .select(
      "id,org_id,active,default_stage,received_count,kind,mode,max_per_request,daily_limit,day_count,day_date",
    )
    .eq("token_hash", await hashLeadKey(key))
    .maybeSingle();
  if (!data || !data.active || !data.org_id) return null;
  return { db, source: data as typeof data & { org_id: string } };
}

async function readBody(request: Request): Promise<unknown> {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/x-www-form-urlencoded") || type.includes("multipart/form-data")) {
    const form = await request.formData();
    const out: Record<string, unknown> = {};
    form.forEach((v, k) => {
      if (typeof v === "string") out[k] = v;
    });
    return out;
  }
  const text = await request.text();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/public/leads")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      // Lets tools verify the link without sending a lead.
      GET: async ({ request }) =>
        (await sourceFor(request))
          ? json({ ok: true })
          : json({ ok: false, error: "Clave no válida" }, 401),
      POST: async ({ request }) => {
        const { LEAD_LIMITS, flattenPayload, normalizeLead, isIntakeStage } =
          await import("@/lib/leads");
        const len = Number(request.headers.get("content-length") ?? 0);
        if (len > LEAD_LIMITS.maxBodyBytes)
          return json({ ok: false, error: "Envío demasiado grande" }, 413);
        const found = await sourceFor(request);
        if (!found) return json({ ok: false, error: "Clave no válida" }, 401);
        const { db, source } = found;
        if (source.kind !== "leads")
          return json(
            { ok: false, error: "Esta conexión es de cuentas: usa /api/public/accounts" },
            400,
          );

        const body = await readBody(request);
        const records = flattenPayload(body);
        if (!records.length)
          return json({ ok: false, error: "No se encontró ningún lead en el envío" }, 400);
        if (records.length > LEAD_LIMITS.maxLeads)
          return json({ ok: false, error: `Máximo ${LEAD_LIMITS.maxLeads} leads por envío` }, 413);
        const { leadQuarantineRows } = await import("@/lib/import-batch");
        // Test send: shows what would happen and writes nothing.
        if (new URL(request.url).searchParams.get("test") === "1") {
          const preview = leadQuarantineRows(records);
          return json({
            ok: true,
            test: true,
            received: records.length,
            rows: preview.map((r) => ({
              line: r.line,
              summary: r.summary,
              action: r.action,
              reason: r.reason,
            })),
          });
        }
        const { enforceLimits, quarantine } = await import("@/lib/intake.server");
        const over = await enforceLimits(db, source, records.length);
        if (over) return json({ ok: false, error: over.error }, over.status);
        if (source.mode === "review") {
          const batchId = await quarantine(db, source, "leads", leadQuarantineRows(records));
          return json(
            {
              ok: true,
              received: records.length,
              queued: true,
              batch_id: batchId,
              message: "Recibido: queda pendiente de revisar en Nokko",
            },
            202,
          );
        }

        const { ingestLead } = await import("@/lib/leads-ingest");
        const { data: segments } = await db
          .from("segments")
          .select("id,name")
          .eq("org_id", source.org_id);
        const { sortStages } = await import("@/lib/stages");
        const { data: stageRows } = await db
          .from("deal_stages")
          .select("key,label,position,kind,board_group,probability")
          .eq("org_id", source.org_id);
        const ctx = {
          orgId: source.org_id,
          sourceId: source.id,
          segments: segments ?? [],
          stages: sortStages((stageRows ?? []) as import("@/lib/stages").Stage[]),
        };
        const results: { status: string; error?: string }[] = [];
        const newLeads: string[] = [];
        for (const rec of records) {
          const n = normalizeLead(rec, {
            defaultStage: isIntakeStage(source.default_stage, ctx.stages)
              ? source.default_stage
              : "new",
          });
          if ("error" in n) {
            results.push({ status: "error", error: n.error });
            await db.from("lead_events").insert({
              org_id: source.org_id,
              lead_source_id: source.id,
              channel: "link",
              status: "error",
              summary: "Lead sin empresa",
              error: n.error,
            });
            continue;
          }
          try {
            const r = await ingestLead(db, ctx, n.lead);
            const warn = n.lead.stageRecognized
              ? null
              : "Etapa no reconocida: se usó la etapa por defecto";
            results.push({ status: r.status, ...(warn ? { error: warn } : {}) });
            await db.from("lead_events").insert({
              org_id: source.org_id,
              lead_source_id: source.id,
              channel: "link",
              status: r.status,
              summary: r.summary,
              error: warn,
              account_id: r.accountId,
              deal_id: r.dealId,
              lead_id: r.leadId,
            });
            if (r.status === "created" && r.leadId) newLeads.push(r.leadId);
          } catch (e) {
            const msg = (e as Error).message.slice(0, 300);
            console.error("lead ingest failed", safeErrorLog(e));
            results.push({ status: "error", error: "No se pudo guardar el lead" });
            await db.from("lead_events").insert({
              org_id: source.org_id,
              lead_source_id: source.id,
              channel: "link",
              status: "error",
              summary: n.lead.company,
              error: msg,
            });
          }
        }
        // New leads are enriched in the background (Inngest); the hourly sweep catches any that miss this.
        if (newLeads.length) {
          const { EV } = await import("@/lib/inngest/events");
          const { trySend } = await import("@/lib/inngest/send.server");
          await trySend(
            newLeads.map((id) => ({
              name: EV.leadCreated,
              data: { org_id: source.org_id, lead_id: id },
            })),
          );
        }
        const { bumpReceived } = await import("@/lib/intake.server");
        await bumpReceived(db, source, records.length);
        const ok = results.filter((r) => r.status !== "error").length;
        return json(
          { ok: ok > 0, received: records.length, saved: ok, results },
          ok > 0 ? 200 : 422,
        );
      },
    },
  },
});
