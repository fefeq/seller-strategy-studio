import { createFileRoute } from "@tanstack/react-router";

// Public account intake (Sales Navigator via Make/n8n, CRMs): same per-company key as leads, but the
// connection must be of kind «accounts». Review mode keeps every batch in quarantine until approved.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Lead-Key, Authorization",
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: CORS });
const MAX_BODY = 1_000_000;

async function sourceFor(request: Request) {
  const url = new URL(request.url);
  const bearer = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  const key = (url.searchParams.get("key") ?? request.headers.get("X-Lead-Key") ?? bearer ?? "").trim();
  if (!/^gtm_[A-Za-z0-9]{24,64}$/.test(key)) return null;
  const { hashLeadKey } = await import("@/lib/leads-ingest");
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { data } = await db.from("lead_sources").select("id,org_id,active,received_count,kind,mode,max_per_request,daily_limit,day_count,day_date").eq("token_hash", await hashLeadKey(key)).maybeSingle();
  if (!data || !data.active || !data.org_id || data.kind !== "accounts") return null;
  return { db, source: data as typeof data & { org_id: string } };
}

function records(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    for (const k of ["accounts", "cuentas", "companies", "empresas", "data", "items"]) if (Array.isArray(b[k])) return b[k] as unknown[];
    return [b];
  }
  return [];
}

export const Route = createFileRoute("/api/public/accounts")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => ((await sourceFor(request)) ? json({ ok: true }) : json({ ok: false, error: "Clave no válida" }, 401)),
      POST: async ({ request }) => {
        if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY) return json({ ok: false, error: "Envío demasiado grande" }, 413);
        const found = await sourceFor(request);
        if (!found) return json({ ok: false, error: "Clave no válida" }, 401);
        const { db, source } = found;
        let body: unknown = null;
        try { body = JSON.parse(await request.text()); } catch { return json({ ok: false, error: "El envío debe ser JSON" }, 400); }
        const { asTextRecord, accountQuarantineRows } = await import("@/lib/import-batch");
        const recs = records(body).slice(0, 501).map(asTextRecord).filter((r) => Object.keys(r).length);
        if (!recs.length) return json({ ok: false, error: "No se encontró ninguna cuenta en el envío" }, 400);
        if (recs.length > 500) return json({ ok: false, error: "Máximo 500 cuentas por envío" }, 413);

        const existing: { name: string; domain: string | null }[] = [];
        for (let from = 0; ; from += 1000) {
          const { data } = await db.from("accounts").select("name,domain").eq("org_id", source.org_id).order("id").range(from, from + 999);
          existing.push(...(data ?? []));
          if (!data || data.length < 1000) break;
        }
        const { data: segments } = await db.from("segments").select("id,name").eq("org_id", source.org_id);
        const rows = accountQuarantineRows(recs, segments ?? [], existing);
        if (new URL(request.url).searchParams.get("test") === "1")
          return json({ ok: true, test: true, received: recs.length, rows: rows.map((r) => ({ line: r.line, summary: r.summary, action: r.action, reason: r.reason })) });

        const { enforceLimits, quarantine } = await import("@/lib/intake.server");
        const over = await enforceLimits(db, source, recs.length);
        if (over) return json({ ok: false, error: over.error }, over.status);
        const batchId = await quarantine(db, source, "accounts", rows);
        if (source.mode === "review")
          return json({ ok: true, received: recs.length, queued: true, batch_id: batchId, message: "Recibido: queda pendiente de revisar en Nokko" }, 202);

        // Direct mode: insert the new ones now and keep the batch so it can be undone.
        let created = 0;
        const { data: pending } = await db.from("import_rows").select("id,raw").eq("batch_id", batchId).eq("action", "new");
        for (const r of (pending ?? []) as { id: string; raw: Record<string, string | null> }[]) {
          const { data: acc, error } = await db.from("accounts").insert({
            org_id: source.org_id, name: String(r.raw.name), domain: r.raw.domain ?? null, industry: r.raw.industry ?? null, size: r.raw.size ?? null,
            tier: r.raw.tier ?? null, segment_id: r.raw.segment_id ?? null, notes: r.raw.notes ?? null, is_target: true,
          }).select("id").single();
          if (error) { await db.from("import_rows").update({ status: "error", error: error.message.slice(0, 300) }).eq("id", r.id); continue; }
          await db.from("account_plans").insert({ org_id: source.org_id, account_id: acc.id });
          await db.from("import_rows").update({ status: "applied", applied_at: new Date().toISOString(), result: { status: "created", accountId: acc.id, accountCreated: true, leadId: null, dealId: null } }).eq("id", r.id);
          created++;
        }
        await db.from("import_rows").update({ status: "discarded" }).eq("batch_id", batchId).eq("status", "pending");
        await db.from("import_batches").update({ status: created ? "approved" : "discarded", created_count: created, decided_at: new Date().toISOString() }).eq("id", batchId);
        return json({ ok: true, received: recs.length, saved: created, skipped: rows.filter((r) => r.action === "skip").length });
      },
    },
  },
});
