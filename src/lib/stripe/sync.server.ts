// Reads a company's subscriptions from Stripe with its restricted key (kept in Vault, read back only
// with the service role) and stores what they add up to in stripe_snapshots. Runs when the Owner
// connects or asks to sync, and every few hours from the proactive job.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { stripeMetrics, type StripeSubscription } from "@/lib/stripe/metrics";

type Admin = SupabaseClient<Database>;

const API = "https://api.stripe.com/v1";
// Pinned so the response shape (subscription.discount with its coupon) doesn't change under us.
const STRIPE_VERSION = "2024-06-20";
/** Pages of 100 per status; beyond that the figures say they are partial. */
const MAX_PAGES = 15;
const TIMEOUT_MS = 10_000;
export const SYNC_EVERY_HOURS = 6;
/** Companies per hourly run: keeps the job inside its time and request limits. */
export const SYNC_BATCH = 5;
/** «Leer ahora» at most this often, to spare the customer's Stripe rate limit. */
export const MANUAL_SYNC_MINUTES = 2;

export class StripeError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** What the person reads when Stripe refuses: never Stripe's raw English, never the key. */
export function stripeErrorText(status: number, code?: string): string {
  if (status === 401) return "Stripe no acepta la clave: puede que esté revocada o mal copiada. Crea una nueva clave restringida y vuelve a conectarla.";
  if (status === 403) return "La clave no tiene permiso para leer las suscripciones. En Stripe, edita la clave restringida y dale permiso de lectura («Read») en «Subscriptions».";
  if (status === 429) return "Stripe ha limitado las peticiones. Se volverá a intentar en la próxima sincronización.";
  if (code === "network") return "No se ha podido conectar con Stripe. Se volverá a intentar en la próxima sincronización.";
  return "Stripe ha devuelto un error al leer las suscripciones. Se volverá a intentar en la próxima sincronización.";
}

async function fetchPages(key: string, params: Record<string, string>, fetcher: typeof fetch): Promise<{ subs: StripeSubscription[]; truncated: boolean }> {
  const subs: StripeSubscription[] = [];
  let after: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const q = new URLSearchParams({ ...params, limit: "100" });
    if (after) q.set("starting_after", after);
    let res: Response;
    try {
      res = await fetcher(`${API}/subscriptions?${q}`, {
        headers: { Authorization: `Bearer ${key}`, "Stripe-Version": STRIPE_VERSION },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new StripeError(stripeErrorText(0, "network"), 0);
    }
    if (!res.ok) throw new StripeError(stripeErrorText(res.status), res.status);
    const body = (await res.json()) as { data: StripeSubscription[]; has_more: boolean };
    subs.push(...body.data);
    if (!body.has_more || !body.data.length) return { subs, truncated: false };
    after = body.data[body.data.length - 1].id;
  }
  return { subs, truncated: true };
}

/**
 * What the metrics need, and nothing older: every paying or trialing subscription, plus the cancelled
 * ones whose last period reached into the window (a subscription that ended in the window always has
 * current_period_end inside or after it). Never the whole cancelled history.
 */
export async function fetchSubscriptions(key: string, fetcher: typeof fetch = fetch, now = new Date(), windowDays = 30): Promise<{ subs: StripeSubscription[]; truncated: boolean }> {
  const since = String(Math.floor(now.getTime() / 1000) - windowDays * 86_400);
  const parts = [];
  for (const status of ["active", "past_due", "trialing"]) parts.push(await fetchPages(key, { status }, fetcher));
  parts.push(await fetchPages(key, { status: "canceled", "current_period_end[gte]": since }, fetcher));
  return { subs: parts.flatMap((p) => p.subs), truncated: parts.some((p) => p.truncated) };
}

/** Syncs one company. Never throws: the outcome is written on its connection. */
export async function syncStripeOrg(db: Admin, orgId: string, now = new Date(), fetcher: typeof fetch = fetch): Promise<{ ok: boolean; error?: string }> {
  const { data: key, error: keyError } = await db.rpc("stripe_key_for", { _org: orgId });
  if (keyError || !key) {
    const message = keyError ? "No se ha podido leer la clave guardada. Se volverá a intentar en la próxima sincronización." : "No hay ninguna clave guardada para Stripe. Vuelve a conectarla en Conexiones.";
    await db.from("stripe_connections").update({ status: "error", last_error: message, last_synced_at: now.toISOString() }).eq("org_id", orgId);
    return { ok: false, error: message };
  }
  const { data: org } = await db.from("organizations").select("currency").eq("id", orgId).maybeSingle();
  const currency = org?.currency ?? "EUR";
  try {
    const { subs, truncated } = await fetchSubscriptions(key as string, fetcher, now);
    const m = stripeMetrics(subs, currency, now);
    const { error } = await db.from("stripe_snapshots").insert({
      org_id: orgId,
      taken_at: now.toISOString(),
      currency: m.currency,
      mrr: m.mrr,
      active_customers: m.activeCustomers,
      trialing: m.trialing,
      new_customers: m.newCustomers,
      new_mrr: m.newMrr,
      churned_customers: m.churnedCustomers,
      churned_mrr: m.churnedMrr,
      logo_churn_pct: m.logoChurnPct,
      revenue_churn_pct: m.revenueChurnPct,
      window_days: m.windowDays,
      details: { subscriptions: subs.length, truncated, unpriced_items: m.unpricedItems, other_currencies: m.otherCurrencies },
    });
    if (error) throw new StripeError("No se ha podido guardar la lectura de Stripe.", 500);
    await db.from("stripe_connections").update({ status: "ok", last_error: null, last_synced_at: now.toISOString() }).eq("org_id", orgId);
    return { ok: true };
  } catch (e) {
    const message = e instanceof StripeError ? e.message : stripeErrorText(500);
    await db.from("stripe_connections").update({ status: "error", last_error: message, last_synced_at: now.toISOString() }).eq("org_id", orgId);
    return { ok: false, error: message };
  }
}

/**
 * The companies whose last sync is oldest (never first), SYNC_BATCH at a time. last_synced_at is
 * written before reading Stripe, so a company that makes the run fall over goes to the back of the
 * queue instead of blocking the others every hour.
 */
export async function runStripeSyncs(db: Admin, now = new Date()): Promise<{ synced: number; failed: number }> {
  const before = new Date(now.getTime() - SYNC_EVERY_HOURS * 3_600_000).toISOString();
  const { data } = await db
    .from("stripe_connections")
    .select("org_id")
    .or(`last_synced_at.is.null,last_synced_at.lt.${before}`)
    .order("last_synced_at", { ascending: true, nullsFirst: true })
    .limit(SYNC_BATCH);
  let synced = 0;
  let failed = 0;
  for (const c of data ?? []) {
    await db.from("stripe_connections").update({ last_synced_at: now.toISOString() }).eq("org_id", c.org_id);
    const r = await syncStripeOrg(db, c.org_id, now);
    if (r.ok) synced++;
    else failed++;
  }
  return { synced, failed };
}
