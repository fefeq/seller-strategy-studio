// Revenue metrics from Stripe subscriptions. Pure so the sync, Métricas and the agent compute MRR,
// customers and churn the same way. Stripe amounts come in the currency's smallest unit (cents);
// prices billed every week, quarter or year are normalised to a month. Subscriptions in another
// currency than the company's are reported apart, never converted.

export type StripePrice = {
  currency: string;
  unit_amount: number | null;
  unit_amount_decimal?: string | null;
  billing_scheme?: string | null;
  recurring: { interval: "day" | "week" | "month" | "year"; interval_count: number; usage_type?: "licensed" | "metered" | null } | null;
  transform_quantity?: unknown;
};

export type StripeCoupon = { percent_off: number | null; amount_off: number | null; currency: string | null; duration: "forever" | "once" | "repeating" };

export type StripeSubscription = {
  id: string;
  customer: string | { id: string };
  status: "active" | "past_due" | "trialing" | "canceled" | "unpaid" | "incomplete" | "incomplete_expired" | "paused";
  currency: string;
  start_date: number;
  created: number;
  canceled_at: number | null;
  ended_at: number | null;
  trial_start?: number | null;
  trial_end?: number | null;
  items: { data: { quantity: number | null; price: StripePrice }[]; has_more?: boolean };
  discounts?: ({ coupon?: StripeCoupon | null } | string)[] | null;
  discount?: { coupon?: StripeCoupon | null } | null;
};

/** Currencies Stripe counts in whole units (no cents). */
const ZERO_DECIMAL = new Set(["bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf"]);
export const fromMinor = (amount: number, currency: string) => (ZERO_DECIMAL.has(currency.toLowerCase()) ? amount : amount / 100);

/** How many times a period fits in a month: a yearly price is 1/12 a month, a weekly one 52/12. */
const PER_MONTH: Record<string, number> = { day: 365 / 12, week: 52 / 12, month: 1, year: 1 / 12 };

/** Monthly amount of one subscription item, in major units, or null when it can't be computed (tiered or metered price). */
export function itemMonthly(item: { quantity: number | null; price: StripePrice }): number | null {
  const p = item.price;
  if (!p.recurring) return 0;
  const unit = p.unit_amount ?? (p.unit_amount_decimal != null ? Number(p.unit_amount_decimal) : null);
  // Tiered, usage-based or transformed prices depend on usage Stripe only knows at invoice time.
  if (unit == null || !Number.isFinite(unit) || p.billing_scheme === "tiered" || p.recurring.usage_type === "metered" || p.transform_quantity) return null;
  const perMonth = (PER_MONTH[p.recurring.interval] ?? 1) / Math.max(1, p.recurring.interval_count || 1);
  return fromMinor(unit, p.currency) * (item.quantity ?? 1) * perMonth;
}

const coupons = (s: StripeSubscription): StripeCoupon[] => {
  const list = (s.discounts ?? []).map((d) => (typeof d === "string" ? null : d.coupon ?? null)).filter((c): c is StripeCoupon => !!c);
  if (!list.length && s.discount?.coupon) list.push(s.discount.coupon);
  // A one-off discount doesn't lower the recurring revenue.
  return list.filter((c) => c.duration !== "once");
};

/** MRR of one subscription after recurring discounts; `unknown` counts items that couldn't be priced. */
export function subscriptionMrr(s: StripeSubscription): { mrr: number; unknown: number } {
  let mrr = 0;
  let unknown = 0;
  for (const it of s.items.data) {
    const m = itemMonthly(it);
    if (m == null) unknown++;
    else mrr += m;
  }
  // Stripe lists 10 items per subscription; the rest are not summed and count as unknown.
  if (s.items.has_more) unknown++;
  // A fixed discount comes off each invoice: per month it is the discount over the months the invoice covers.
  const rec = s.items.data.find((i) => i.price.recurring)?.price.recurring;
  const invoiceMonths = rec ? Math.max(1, rec.interval_count || 1) / (PER_MONTH[rec.interval] ?? 1) : 1;
  for (const c of coupons(s)) {
    if (c.percent_off != null) mrr *= 1 - c.percent_off / 100;
    else if (c.amount_off != null && (!c.currency || c.currency === s.currency)) mrr -= fromMinor(c.amount_off, s.currency) / invoiceMonths;
  }
  return { mrr: Math.max(0, mrr), unknown };
}

/** When the customer started paying: the end of the trial when there was one. */
export const payingSince = (s: StripeSubscription) => Math.max(s.start_date, s.trial_end ?? 0);
/** A trial cancelled before it ended never paid: not a lost customer. */
export const endedInTrial = (s: StripeSubscription) => s.trial_end != null && (s.ended_at ?? s.canceled_at ?? 0) <= s.trial_end;

const customerId = (s: StripeSubscription) => (typeof s.customer === "string" ? s.customer : s.customer.id);
const PAYING = new Set(["active", "past_due"]);

export type StripeMetrics = {
  currency: string;
  mrr: number;
  arr: number;
  activeCustomers: number;
  trialing: number;
  newCustomers: number;
  newMrr: number;
  churnedCustomers: number;
  churnedMrr: number;
  /** Customers lost in the window over customers paying at its start; null without a base. */
  logoChurnPct: number | null;
  /** MRR lost over MRR at the window's start; null without a base. */
  revenueChurnPct: number | null;
  unpricedItems: number;
  /** Other currencies: MRR and customers, not converted. */
  otherCurrencies: Record<string, { mrr: number; customers: number }>;
  windowDays: number;
};

/**
 * MRR and customers today, and what came in and went out in the last `windowDays`. A customer counts
 * as paying with an active or past_due subscription (Stripe's own MRR does the same); trials apart.
 */
export function stripeMetrics(subs: StripeSubscription[], currency: string, now = new Date(), windowDays = 30): StripeMetrics {
  const cur = currency.toLowerCase();
  const since = now.getTime() / 1000 - windowDays * 86_400;
  const mine = subs.filter((s) => s.currency.toLowerCase() === cur);
  const paying = mine.filter((s) => PAYING.has(s.status));
  let unpriced = 0;
  const mrrOf = (s: StripeSubscription) => {
    const r = subscriptionMrr(s);
    unpriced += r.unknown;
    return r.mrr;
  };
  const mrr = paying.reduce((t, s) => t + mrrOf(s), 0);
  const payingCustomers = new Set(paying.map(customerId));

  const started = paying.filter((s) => payingSince(s) >= since);
  const lost = mine.filter((s) => s.status === "canceled" && !endedInTrial(s) && (s.ended_at ?? s.canceled_at ?? 0) >= since);
  // A customer who cancelled one subscription but still pays another is not churned (a plan change is
  // a cancel plus a new subscription): only customers with nothing left count, and only their MRR.
  const churned = new Set(lost.map(customerId).filter((c) => !payingCustomers.has(c)));
  const churnedMrr = lost.filter((s) => churned.has(customerId(s))).reduce((t, s) => t + subscriptionMrr(s).mrr, 0);
  const lostCustomers = new Set(lost.map(customerId));
  const newCustomers = new Set(
    started.map(customerId).filter((c) => !lostCustomers.has(c) && !paying.some((s) => customerId(s) === c && payingSince(s) < since)),
  );
  const newMrr = started.filter((s) => newCustomers.has(customerId(s))).reduce((t, s) => t + subscriptionMrr(s).mrr, 0);

  const baseCustomers = payingCustomers.size - newCustomers.size + churned.size;
  const baseMrr = mrr - newMrr + churnedMrr;

  const otherCurrencies: StripeMetrics["otherCurrencies"] = {};
  for (const s of subs.filter((x) => x.currency.toLowerCase() !== cur && PAYING.has(x.status))) {
    const k = s.currency.toUpperCase();
    otherCurrencies[k] ??= { mrr: 0, customers: 0 };
    otherCurrencies[k].mrr += subscriptionMrr(s).mrr;
  }
  for (const k of Object.keys(otherCurrencies)) {
    otherCurrencies[k].customers = new Set(subs.filter((x) => x.currency.toUpperCase() === k && PAYING.has(x.status)).map(customerId)).size;
  }

  const r2 = (x: number) => Math.round(x * 100) / 100;
  return {
    currency: currency.toUpperCase(),
    mrr: r2(mrr),
    arr: r2(mrr * 12),
    activeCustomers: payingCustomers.size,
    trialing: new Set(mine.filter((s) => s.status === "trialing").map(customerId)).size,
    newCustomers: newCustomers.size,
    newMrr: r2(newMrr),
    churnedCustomers: churned.size,
    churnedMrr: r2(churnedMrr),
    logoChurnPct: baseCustomers > 0 ? (churned.size / baseCustomers) * 100 : null,
    revenueChurnPct: baseMrr > 0 ? (churnedMrr / baseMrr) * 100 : null,
    unpricedItems: unpriced,
    otherCurrencies: Object.fromEntries(Object.entries(otherCurrencies).map(([k, v]) => [k, { mrr: r2(v.mrr), customers: v.customers }])),
    windowDays,
  };
}

/**
 * Only restricted keys (rk_): a secret key (sk_) can charge, refund and delete in the customer's Stripe,
 * and Nokko only needs to read. The shape only: Stripe says whether it works.
 */
export function checkStripeKey(raw: string): { ok: true; key: string; live: boolean; restricted: true } | { ok: false; error: string } {
  const key = raw.trim();
  if (/^sk_(live|test)_/.test(key)) return { ok: false, error: "Esa es una clave secreta con permisos completos. Crea una clave restringida de solo lectura (empieza por rk_live_) y pega esa." };
  const m = /^rk_(live|test)_[A-Za-z0-9]{10,}$/.exec(key);
  if (!m) return { ok: false, error: "Esa no parece una clave de Stripe. Copia la clave restringida completa: empieza por rk_live_ (o rk_test_ para probar)." };
  return { ok: true, key, live: m[1] === "live", restricted: true };
}
