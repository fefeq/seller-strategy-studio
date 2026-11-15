// C1: Connections state for the active company. Returns presence booleans, who/when and month usage only — never a secret.
// The agent has no tool here: secrets never reach it (guarded in connections.test.ts by the catalogue rule).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Db } from "@/lib/org-data";
import { userCtx } from "@/lib/agent.functions";
import { SERVICES, monthUsage } from "@/lib/connections";
import { fetchAll } from "@/lib/fetch-all";
import { errorText } from "@/lib/errors";

const BROKEN = "La conexión tiene un error: revísala en su tarjeta.";
/** Free checks still hit shared credentials: one per user and service every 15 s (per server instance). */
const lastTest = new Map<string, number>();

export type ConnectionRow = {
  id: string;
  present: boolean;
  by: string | null;
  at: string | null;
  lastError: string | null;
  usage: { uses: number; byCurrency: Record<string, number>; unknown: number };
};

export const connectionsStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ConnectionRow[]> => {
    const c = await userCtx(context.supabase as Db, context.userId);
    const db = context.supabase;
    const now = new Date();
    const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const [usage, stripe, posthog, mailbox] = await Promise.all([
      fetchAll<{ service: string; cost: number | null; currency: string; created_at: string }>((a, b) =>
        db.from("integration_usage").select("service,cost,currency,created_at").eq("org_id", c.orgId).gte("created_at", since).order("id").range(a, b),
      ),
      db.from("stripe_connections").select("connected_by,created_at,status,last_error").eq("org_id", c.orgId).maybeSingle(),
      db.from("posthog_connections").select("created_by,created_at,status,last_error").eq("org_id", c.orgId).maybeSingle(),
      db.from("mailbox_links").select("user_id,linked_at,status").eq("org_id", c.orgId).maybeSingle(),
    ]);
    for (const r of [stripe, posthog, mailbox]) if (r.error) throw new Error(errorText(r.error));
    const rows = usage.rows;
    const company: Record<string, { by: string | null; at: string | null; err: string | null; ok: boolean } | null> = {
      stripe_connections: stripe.data ? { by: stripe.data.connected_by, at: stripe.data.created_at, err: stripe.data.status === "active" && !stripe.data.last_error ? null : BROKEN, ok: stripe.data.status !== "disconnected" } : null,
      posthog_connections: posthog.data ? { by: posthog.data.created_by, at: posthog.data.created_at, err: posthog.data.status === "active" && !posthog.data.last_error ? null : BROKEN, ok: posthog.data.status !== "disconnected" } : null,
      mailbox_links: mailbox.data ? { by: mailbox.data.user_id, at: mailbox.data.linked_at, err: mailbox.data.status === "active" ? null : BROKEN, ok: mailbox.data.status !== "disconnected" } : null,
    };
    const ids = [...new Set(Object.values(company).map((x) => x?.by).filter((x): x is string => !!x))];
    const names = new Map<string, string>();
    if (ids.length) {
      const { data } = await db.from("profiles").select("id,full_name").in("id", ids);
      for (const p of data ?? []) names.set(p.id, p.full_name ?? "");
    }
    return SERVICES.map((s) => {
      const u = monthUsage(rows, s, now);
      if (s.source.kind === "shared")
        return { id: s.id, present: !!process.env[s.source.env], by: "NOKKO", at: null, lastError: null, usage: u };
      const row = company[s.source.table];
      return {
        id: s.id,
        present: !!row?.ok,
        by: row?.by ? names.get(row.by) || "Un miembro del equipo" : null,
        at: row?.at ?? null,
        lastError: row?.ok ? row.err : null,
        usage: u,
      };
    });
  });

/** «Probar conexión»: a free, non-destructive credential check. Answers ok/detail only. */
export const testConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().max(40) }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: boolean; detail: string; at: string }> => {
    await userCtx(context.supabase as Db, context.userId); // member of an active company
    const at = new Date().toISOString();
    const s = SERVICES.find((x) => x.id === data.id);
    if (!s) return { ok: false, detail: "Servicio desconocido.", at };
    if (s.source.kind === "company") throw new Error("Esta conexión se comprueba desde su tarjeta, más abajo.");
    const k = `${context.userId}:${s.id}`;
    if (Date.now() - (lastTest.get(k) ?? 0) < 15_000) throw new Error("Acabas de probarla: espera unos segundos.");
    lastTest.set(k, Date.now());
    const key = process.env[s.source.env];
    if (!key) return { ok: false, detail: "Sin conectar en NOKKO.", at };
    try {
      if (s.source.gateway) {
        const lov = process.env["LOVABLE_API_KEY"];
        if (!lov) return { ok: false, detail: "Falta la configuración del servidor.", at };
        const r = await fetch("https://connector-gateway.lovable.dev/api/v1/verify_credentials", {
          method: "POST",
          headers: { Authorization: `Bearer ${lov}`, "X-Connection-Api-Key": key },
          signal: AbortSignal.timeout(10_000),
        });
        if (!r.ok) return { ok: false, detail: `La comprobación respondió ${r.status}.`, at };
        const j = (await r.json().catch(() => ({}))) as { outcome?: string };
        if (j.outcome === "failed") return { ok: false, detail: "Las credenciales no son válidas.", at };
        return { ok: true, detail: j.outcome === "skipped" ? "Conectada (este servicio no permite comprobación)." : "Conectada y verificada.", at };
      }
      if (s.id === "openrouter") {
        const r = await fetch("https://openrouter.ai/api/v1/key", { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10_000) });
        return r.ok ? { ok: true, detail: "Conectada y verificada.", at } : { ok: false, detail: `La comprobación respondió ${r.status}.`, at };
      }
      return { ok: true, detail: "Clave presente; este servicio no tiene una comprobación gratuita.", at };
    } catch {
      return { ok: false, detail: "No he podido comprobarla ahora (red o tiempo de espera).", at };
    }
  });
