// Reads a company's subscriptions from Stripe with its restricted key (kept in Vault, read back only
// with the service role) and stores what they add up to in stripe_snapshots. Runs when the Owner
// connects or asks to sync, and every few hours from the proactive job.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { stripeMetrics, type StripeSubscription } from "@/lib/stripe/metrics";

type Admin = SupabaseClient<Database>;

const API = "https://api.stripe.com/v1";
// Pinned so the response shape (discounts with their coupon) doesn't change under us.
const STRIPE_VERSION = "2024-06-20";
const MAX_PAGES = 50; // 5.000 subscriptions; beyond that the figures say they are partial.
export const SYNC_EVERY_HOURS = 6;

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

export async function fetchSubscriptions(key: string, fetcher: typeof fetch = fetch): Promise<{ subs: StripeSubscription[]; truncated: boolean }> {
  const subs: StripeSubscription[] = [];
  let after: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const q = new URLSearchParams({ status: "all", limit: "100" });
    q.append("expand[]", "data.discounts");
    if (after) q.set("starting_after", after);
    let res: Response;
    try {
      res = await fetcher(`${API}/subscriptions?${q}`, { headers: { Authorization: `Bearer ${key}`, "Stripe-Version": STRIPE_VERSION } });
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

/** Syncs one company. Never throws: the outcome is written on its connection. */
export async function syncStripeOrg(db: Admin, orgId: string, now = new Date(), fetcher: typeof fetch = fetch): Promise<{ ok: boolean; error?: string }> {
  const { data: key, error: keyError } = await db.rpc("stripe_key_for", { _org: orgId });
  if (keyError || !key) return { ok: false, error: "Esta empresa no tiene Stripe conectado." };
  const { data: org } = await db.from("organizations").select("currency").eq("id", orgId).maybeSingle();
  const currency = org?.currency ?? "EUR";
  try {
    const { subs, truncated } = await fetchSubscriptions(key as string, fetcher);
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

/** Every company whose last sync is older than SYNC_EVERY_HOURS (or never ran). */
export async function runStripeSyncs(db: Admin, now = new Date()): Promise<{ synced: number; failed: number }> {
  const before = new Date(now.getTime() - SYNC_EVERY_HOURS * 3_600_000).toISOString();
  const { data } = await db.from("stripe_connections").select("org_id").or(`last_synced_at.is.null,last_synced_at.lt.${before}`).limit(100);
  let synced = 0;
  let failed = 0;
  for (const c of data ?? []) {
    const r = await syncStripeOrg(db, c.org_id, now);
    if (r.ok) synced++;
    else failed++;
  }
  return { synced, failed };
}
