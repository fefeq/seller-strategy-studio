import { OPEN, type Detector } from "../types";
import { customerRenewals, readCustomerSettings, wonKeysOf, type WonDeal } from "@/lib/customers";

/**
 * A customer renews inside the company's window and nobody is working it (no open deal on the account)
 * → propose the renewal deal. The date is an estimate: the anniversary of the close of a won deal with
 * an annual line. The key carries the renewal date, so a dismissed reminder returns only next year.
 */
export const renewalUpcoming: Detector = (s) => {
  const settings = s.customerSettings ?? readCustomerSettings(null);
  const wonKeys = wonKeysOf(s.stages);
  // loadSnapshot fills cycleDeals with every deal row, closed_at included; older snapshots fall back to deals.
  const deals = (s.cycleDeals ?? s.deals) as unknown as (Omit<WonDeal, "closed_at"> & { closed_at?: string | null })[];
  const accounts = new Map(s.accounts.map((a) => [a.id, a]));
  const openByAccount = new Set(s.deals.filter((d) => OPEN(d.stage) && d.account_id).map((d) => d.account_id as string));
  const renewals = customerRenewals(deals.map((d) => ({ ...d, closed_at: d.closed_at ?? null })) as WonDeal[], s.dealLines ?? [], wonKeys, s.now, settings.renewalWindowDays);
  return renewals
    .filter((r) => r.within_window && !openByAccount.has(r.account_id) && accounts.has(r.account_id))
    .map((r) => {
      const acc = accounts.get(r.account_id)!;
      const when = r.days_left === 0 ? "hoy" : r.days_left === 1 ? "mañana" : `en ${r.days_left} días`;
      return {
        detector: "renewal_upcoming",
        dedupe_key: `renewal_upcoming:${r.account_id}:${r.renews_on}`,
        priority: r.days_left <= settings.renewalWindowDays / 3 ? 1 : 2,
        title: `${acc.name} renueva ${when}`,
        body: `Fecha estimada (${r.renews_on}): aniversario del cierre de «${r.deal}». No hay ningún deal abierto en la cuenta. Te propongo crear el deal de renovación para trabajarlo con tiempo.`,
        link: "/accounts",
        action: { tool: "create_deal", args: { name: `Renovación: ${acc.name}`, account_id: r.account_id, close_date: r.renews_on, ...(r.amount ? { amount: r.amount } : {}) } },
        user_id: acc.owner_id ?? r.owner_id,
      };
    });
};
