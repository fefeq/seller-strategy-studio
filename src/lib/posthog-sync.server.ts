// Each company's own PostHog: connect (key encrypted, tested against the query API), list its events, and
// sync its product data into Nokko: people who signed up → trials (the self-service funnel in Métricas)
// and active users per company domain → product_usage (account page, suggestions, agent). Runs with the
// admin client, always filtered by the company; callers check who may do it first.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { EVENTS_QUERY, eventNames, funnelQuery, funnelRows, matchAccounts, usageQuery, usageRows, type HogQL } from "@/lib/product-usage";
import { open, seal } from "@/lib/secret-box.server";

type Admin = SupabaseClient<Database>;
export const SYNC_EVERY_HOURS = 6;
export const SYNC_BATCH = 5;
export const MANUAL_SYNC_MINUTES = 2;

export class PosthogError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export function posthogErrorText(status: number, body = ""): string {
  if (status === 401) return "PostHog no acepta la clave: puede que esté revocada o mal copiada. Crea una nueva clave personal y vuelve a conectarla.";
  if (status === 403) return "La clave no tiene permiso para leer ese proyecto. En PostHog, edita la clave personal y dale «Query: Read» en ese proyecto.";
  if (status === 404) return "No encuentro ese proyecto en PostHog. Revisa el ID del proyecto y la región (EU o US).";
  if (status === 429) return "PostHog ha limitado las peticiones. Se volverá a intentar en la próxima sincronización.";
  if (status === 400 && /event|property|field|unknown/i.test(body)) return "PostHog no entiende la consulta: revisa los eventos y la propiedad elegidos.";
  if (status === 0) return "No se ha podido conectar con PostHog. Revisa la dirección o inténtalo más tarde.";
  return "PostHog ha devuelto un error. Se volverá a intentar en la próxima sincronización.";
}

type Conn = { host: string; project_id: string; key: string };

async function hogql(c: Conn, q: HogQL): Promise<{ columns?: string[]; results?: unknown[][] }> {
  let res: Response;
  try {
    res = await fetch(`${c.host}/api/projects/${c.project_id}/query/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${c.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: { kind: "HogQLQuery", query: q.query, values: q.values }, name: "nokko" }),
      signal: AbortSignal.timeout(25_000),
    });
  } catch { throw new PosthogError(posthogErrorText(0), 0); }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`PostHog query failed [${res.status}]: ${body.slice(0, 400)}`);
    throw new PosthogError(posthogErrorText(res.status, body), res.status);
  }
  return res.json();
}

async function loadConn(db: Admin, orgId: string) {
  const { data } = await db.from("posthog_connections").select("host,project_id,api_key_enc,signup_event,activation_event,paid_event,domain_property,last_synced_at").eq("org_id", orgId).maybeSingle();
  if (!data?.api_key_enc) throw new PosthogError("Esta empresa no tiene PostHog conectado. Conéctalo en Conexiones.", 404);
  return { ...data, key: await open(data.api_key_enc) };
}

/** Saves (or replaces) the company's PostHog after checking the key can query the project. Returns its events. */
export async function connectPosthog(db: Admin, orgId: string, userId: string, input: { host: string; projectId: string; key: string }) {
  const events = eventNames(await hogql({ host: input.host, project_id: input.projectId, key: input.key }, EVENTS_QUERY));
  const row = { org_id: orgId, host: input.host, project_id: input.projectId, api_key_enc: await seal(input.key), key_hint: input.key.slice(-4), status: "ok", last_error: null, created_by: userId, updated_at: new Date().toISOString() };
  const { error } = await db.from("posthog_connections").upsert(row, { onConflict: "org_id" });
  if (error) throw new Error(error.message);
  return { events };
}

export async function listPosthogEvents(db: Admin, orgId: string) {
  const c = await loadConn(db, orgId);
  return eventNames(await hogql(c, EVENTS_QUERY));
}

/** Syncs one company. Never throws: the outcome is written on its connection. */
export async function syncPosthogOrg(db: Admin, orgId: string, now = new Date()): Promise<{ ok: boolean; error?: string; trials?: { added: number; updated: number }; usage?: { companies: number; matched: number } }> {
  try {
    const c = await loadConn(db, orgId);
    const out: { trials?: { added: number; updated: number }; usage?: { companies: number; matched: number } } = {};

    // 1) Usage per company domain (always).
    const usage = usageRows(await hogql(c, usageQuery(c.domain_property)));
    const { data: accounts } = await db.from("accounts").select("id,domain").eq("org_id", orgId).not("domain", "is", null).limit(10000);
    const matched = matchAccounts(usage, accounts ?? []);
    await db.from("product_usage").delete().eq("org_id", orgId);
    for (let i = 0; i < matched.length; i += 500) {
      const { error } = await db.from("product_usage").insert(matched.slice(i, i + 500).map((u) => ({ ...u, org_id: orgId, synced_at: now.toISOString() })));
      if (error) throw new PosthogError("No se ha podido guardar el uso del producto.", 500);
    }
    out.usage = { companies: matched.length, matched: matched.filter((m) => m.account_id).length };

    // 2) Self-service funnel, once the sign-up event is chosen.
    if (c.signup_event) {
      const rows = funnelRows(await hogql(c, funnelQuery({ signup: c.signup_event, activation: c.activation_event, paid: c.paid_event })));
      const { data: existing } = await db.from("trials").select("id,email,posthog_person_id,activated_at,converted_at,signed_up_at").eq("org_id", orgId).limit(20000);
      const byPid = new Map((existing ?? []).filter((t) => t.posthog_person_id).map((t) => [t.posthog_person_id!, t]));
      const byEmail = new Map((existing ?? []).filter((t) => t.email).map((t) => [t.email.toLowerCase(), t]));
      const inserts: Database["public"]["Tables"]["trials"]["Insert"][] = [];
      let updated = 0;
      for (const r of rows) {
        const t = byPid.get(r.posthog_person_id) ?? (r.email ? byEmail.get(r.email) : undefined);
        if (!t) { inserts.push({ ...r, org_id: orgId, source: "PostHog" }); continue; }
        // PostHog fills what it knows; it never erases dates typed by hand.
        const patch = {
          posthog_person_id: r.posthog_person_id,
          ...(r.activated_at && r.activated_at !== t.activated_at ? { activated_at: r.activated_at } : {}),
          ...(r.converted_at && r.converted_at !== t.converted_at ? { converted_at: r.converted_at } : {}),
        };
        if (t.posthog_person_id === r.posthog_person_id && Object.keys(patch).length === 1) continue;
        await db.from("trials").update(patch).eq("org_id", orgId).eq("id", t.id);
        updated++;
      }
      for (let i = 0; i < inserts.length; i += 500) {
        const { error } = await db.from("trials").insert(inserts.slice(i, i + 500));
        if (error) throw new PosthogError("No se han podido guardar las altas de PostHog.", 500);
      }
      out.trials = { added: inserts.length, updated };
    }
    await db.from("posthog_connections").update({ status: "ok", last_error: null, last_synced_at: now.toISOString() }).eq("org_id", orgId);
    return { ok: true, ...out };
  } catch (e) {
    const message = e instanceof PosthogError ? e.message : (e as Error).message || posthogErrorText(500);
    await db.from("posthog_connections").update({ status: "error", last_error: message, last_synced_at: now.toISOString() }).eq("org_id", orgId);
    return { ok: false, error: message };
  }
}

/** Hourly job: the companies whose last sync is oldest, a few at a time. */
export async function runPosthogSyncs(db: Admin, now = new Date()) {
  if (!process.env["INTEGRATION_KEYS_SECRET"]) return { skipped: "no_secret" };
  const before = new Date(now.getTime() - SYNC_EVERY_HOURS * 3_600_000).toISOString();
  const { data } = await db.from("posthog_connections").select("org_id").or(`last_synced_at.is.null,last_synced_at.lt.${before}`).order("last_synced_at", { ascending: true, nullsFirst: true }).limit(SYNC_BATCH);
  let synced = 0, failed = 0;
  for (const c of data ?? []) {
    await db.from("posthog_connections").update({ last_synced_at: now.toISOString() }).eq("org_id", c.org_id);
    const r = await syncPosthogOrg(db, c.org_id, now);
    if (r.ok) synced++; else failed++;
  }
  return { synced, failed };
}
