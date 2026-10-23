// Customers, renewals, health and expansion. Pure so the agent tools and the renewal_upcoming and
// customer_at_risk detectors agree on who is a customer, when they renew and what is at risk.
//
// A customer is an account with at least one won deal. Nokko does not link accounts to Stripe
// customers, so payment signals are reported as unknown, never guessed. The renewal date is an
// estimate: the next anniversary of the close of a won deal that has an annual line. Nothing here
// produces a numeric score: health is a level plus the evidence of each signal, and a missing
// signal is «sin datos», never a zero.
import { latestOf } from "@/lib/scoring";

const DAY = 86_400_000;

/** PROVISIONAL defaults until the company sets its own (lead_settings.sla: renewal_window_days, quiet_customer_days). */
export const DEFAULT_RENEWAL_WINDOW_DAYS = 90;
export const DEFAULT_QUIET_DAYS = 60;

export type CustomerSettings = { renewalWindowDays: number; quietDays: number; renewalSource: "empresa" | "defecto"; quietSource: "empresa" | "defecto" };

const positive = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

/** The company overrides live next to the lead limits and stale_deal_days in lead_settings.sla. */
export function readCustomerSettings(raw: unknown): CustomerSettings {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const w = positive(o.renewal_window_days);
  const q = positive(o.quiet_customer_days);
  return {
    renewalWindowDays: w ?? DEFAULT_RENEWAL_WINDOW_DAYS, renewalSource: w ? "empresa" : "defecto",
    quietDays: q ?? DEFAULT_QUIET_DAYS, quietSource: q ? "empresa" : "defecto",
  };
}

export type WonDeal = { id: string; name: string; account_id: string | null; stage: string; amount: number | null; closed_at: string | null; close_date: string | null; updated_at: string; owner_id?: string | null };
export type DealLine = { deal_id: string; billing: string; product_id?: string | null };

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const startOfDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/** Next anniversary of `from` on or after today (UTC), so a renewal due today still shows. 29 Feb falls back to 28 Feb in common years. */
export function nextAnniversary(from: Date, now: Date): Date {
  const today = startOfDay(now);
  const at = (year: number) => {
    const leap = new Date(Date.UTC(year, 1, 29)).getUTCMonth() === 1;
    const day = from.getUTCMonth() === 1 && from.getUTCDate() === 29 && !leap ? 28 : from.getUTCDate();
    return new Date(Date.UTC(year, from.getUTCMonth(), day));
  };
  const candidate = at(today.getUTCFullYear());
  return candidate.getTime() >= today.getTime() ? candidate : at(today.getUTCFullYear() + 1);
}

export const wonKeysOf = (stages?: { key: string; kind: string }[] | null): Set<string> => {
  const keys = (stages ?? []).filter((s) => s.kind === "won").map((s) => s.key);
  return new Set(keys.length ? keys : ["won"]);
};

/** Won deals that belong to an account: the customers' contracts. */
export const wonDeals = <T extends { stage: string; account_id: string | null }>(deals: T[], wonKeys: Set<string>) =>
  deals.filter((d) => wonKeys.has(d.stage) && !!d.account_id);

/** Account ids that are customers. */
export const customerIds = (deals: { stage: string; account_id: string | null }[], wonKeys: Set<string>) => new Set(wonDeals(deals, wonKeys).map((d) => d.account_id as string));

export type Renewal = { account_id: string; deal_id: string; deal: string; renews_on: string; days_left: number; amount: number | null; owner_id: string | null; within_window: boolean };

/**
 * One renewal per customer: the soonest anniversary among its won deals that have an annual line.
 * Monthly and one-off deals have no renewal date. Sorted by days left.
 */
export function customerRenewals(deals: WonDeal[], lines: DealLine[], wonKeys: Set<string>, now: Date, windowDays: number): Renewal[] {
  const annual = new Set(lines.filter((l) => l.billing === "annual").map((l) => l.deal_id));
  const today = startOfDay(now).getTime();
  const best = new Map<string, Renewal>();
  for (const d of wonDeals(deals, wonKeys)) {
    if (!annual.has(d.id)) continue;
    const base = d.closed_at ?? d.close_date;
    const from = base ? new Date(base) : null;
    if (!from || Number.isNaN(from.getTime())) continue;
    const next = nextAnniversary(from, now);
    const r: Renewal = {
      account_id: d.account_id as string, deal_id: d.id, deal: d.name, renews_on: isoDay(next), days_left: Math.round((next.getTime() - today) / DAY),
      amount: d.amount == null ? null : Number(d.amount), owner_id: d.owner_id ?? null, within_window: Math.round((next.getTime() - today) / DAY) <= windowDays,
    };
    const cur = best.get(r.account_id);
    if (!cur || r.days_left < cur.days_left) best.set(r.account_id, r);
  }
  return [...best.values()].sort((a, b) => a.days_left - b.days_left);
}

export type SignalState = "ok" | "vigilar" | "riesgo" | "sin datos";
export type HealthSignal = { id: "cuenta" | "actividad" | "pago"; estado: SignalState; evidencia: string };
export type HealthLevel = "sano" | "vigilar" | "riesgo" | "sin datos";

export type HealthInput = { accountHealth: string | null; lastActivityAt: string | null; quietDays: number; now: Date };

const HEALTH_TEXT: Record<string, string> = { green: "verde", yellow: "amarilla", red: "roja" };

/** Health of a customer account from what Nokko knows. The payment signal is always unknown: Stripe is not linked to accounts. */
export function customerHealth(i: HealthInput): { nivel: HealthLevel; senales: HealthSignal[] } {
  const cuenta: HealthSignal = i.accountHealth && HEALTH_TEXT[i.accountHealth]
    ? { id: "cuenta", estado: i.accountHealth === "red" ? "riesgo" : i.accountHealth === "yellow" ? "vigilar" : "ok", evidencia: `Salud ${HEALTH_TEXT[i.accountHealth]} en la ficha de la cuenta` }
    : { id: "cuenta", estado: "sin datos", evidencia: "La ficha de la cuenta no tiene salud marcada" };

  let actividad: HealthSignal;
  if (!i.lastActivityAt || Number.isNaN(new Date(i.lastActivityAt).getTime())) {
    actividad = { id: "actividad", estado: "sin datos", evidencia: "No hay toques, reuniones, llamadas ni deals registrados" };
  } else {
    const idle = Math.max(0, Math.floor((startOfDay(i.now).getTime() - startOfDay(new Date(i.lastActivityAt)).getTime()) / DAY));
    actividad = idle > i.quietDays
      ? { id: "actividad", estado: "riesgo", evidencia: `${idle} días sin actividad (límite: ${i.quietDays})` }
      : { id: "actividad", estado: "ok", evidencia: `Última actividad hace ${idle} días (límite: ${i.quietDays})` };
  }

  const pago: HealthSignal = { id: "pago", estado: "sin datos", evidencia: "Stripe no está vinculado a las cuentas: no se sabe si hay pagos fallidos" };
  const senales = [cuenta, actividad, pago];
  const known = senales.filter((s) => s.estado !== "sin datos");
  const nivel: HealthLevel = senales.some((s) => s.estado === "riesgo") ? "riesgo" : senales.some((s) => s.estado === "vigilar") ? "vigilar" : known.length ? "sano" : "sin datos";
  return { nivel, senales };
}

/** Latest activity of each account from touches, calls, past meetings and deal updates. */
export function lastActivityByAccount(rows: { account_id: string | null; at: string | null }[], now: Date): Map<string, string> {
  const out = new Map<string, string>();
  const limit = now.toISOString();
  for (const r of rows) {
    if (!r.account_id || !r.at || r.at > limit) continue;
    out.set(r.account_id, latestOf(out.get(r.account_id), r.at) as string);
  }
  return out;
}

export type ExpansionRow = { account_id: string; whitespace: string | null; open_deals: number; not_contracted: string[] };

/**
 * Customers with something to grow: whitespace written in the account plan or active catalogue products
 * they have not bought. A customer with neither is left out.
 */
export function expansionOpportunities(
  customers: Set<string>,
  plans: { account_id: string; whitespace: string | null }[],
  openDealsByAccount: Map<string, number>,
  contracted: Map<string, Set<string>>,
  products: { id: string; name: string }[],
): ExpansionRow[] {
  const ws = new Map(plans.map((p) => [p.account_id, (p.whitespace ?? "").trim() || null]));
  const rows: ExpansionRow[] = [];
  for (const id of customers) {
    const bought = contracted.get(id) ?? new Set<string>();
    const missing = products.filter((p) => !bought.has(p.id)).map((p) => p.name);
    const whitespace = ws.get(id) ?? null;
    if (!whitespace && !missing.length) continue;
    rows.push({ account_id: id, whitespace, open_deals: openDealsByAccount.get(id) ?? 0, not_contracted: missing });
  }
  // Accounts with written whitespace first, then without an open deal (nobody is working them), then by name of the id for a stable order.
  return rows.sort((a, b) => Number(!!b.whitespace) - Number(!!a.whitespace) || a.open_deals - b.open_deals || a.account_id.localeCompare(b.account_id));
}
