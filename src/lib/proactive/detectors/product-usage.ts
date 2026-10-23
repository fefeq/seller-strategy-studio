import { isProductQualified, isUsageDrop, PQL_MIN_USERS } from "@/lib/product-usage";
import type { Detector, Snapshot, Suggestion } from "../types";

/** Accounts with a won deal (by the company's won stages, else «won»). */
function customers(s: Snapshot) {
  const won = new Set((s.stages ?? []).filter((x) => x.kind === "won").map((x) => x.key));
  if (!won.size) won.add("won");
  return new Set(s.deals.filter((d) => d.account_id && won.has(d.stage)).map((d) => d.account_id!));
}
const month = (d: Date) => d.toISOString().slice(0, 7);
const week = (d: Date) => { const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7))); return t.toISOString().slice(0, 10); };

/** Product-qualified: a non-customer account (or a company not in Nokko yet) with a growing team in the product. */
export const productQualified: Detector = (s) => {
  const cust = customers(s);
  const byId = new Map(s.accounts.map((a) => [a.id, a]));
  return (s.usage ?? []).flatMap((u): Suggestion[] => {
    if (u.account_id) {
      const acc = byId.get(u.account_id);
      if (!acc || !isProductQualified(u, cust.has(acc.id))) return [];
      return [{
        detector: "product_qualified",
        dedupe_key: `pql:${acc.id}:${month(s.now)}`,
        priority: 2 as const,
        title: `${acc.name}: ${u.active_users_7d} personas usan el producto esta semana`,
        body: `Antes eran ${u.active_users_prev_7d}. Aún no es cliente: es un lead cualificado por producto. Contacta ahora con quien más lo usa y propón el plan de equipo.`,
        link: `/accounts/${acc.id}`,
        action: null,
        user_id: acc.owner_id,
      }];
    }
    if (u.active_users_7d < PQL_MIN_USERS || u.active_users_7d < u.active_users_prev_7d) return [];
    return [{
      detector: "product_qualified",
      dedupe_key: `pql_new:${u.domain}`,
      priority: 3 as const,
      title: `${u.domain} usa el producto y no está en Nokko`,
      body: `${u.active_users_7d} personas de ${u.domain} lo han usado esta semana. Crea la cuenta para trabajarla.`,
      link: null,
      action: { tool: "create_account", args: { name: u.domain, domain: u.domain } },
      user_id: null,
    }];
  });
};

/** Churn risk: a customer whose weekly active users halved. */
export const usageDrop: Detector = (s) => {
  const cust = customers(s);
  const byId = new Map(s.accounts.map((a) => [a.id, a]));
  return (s.usage ?? []).flatMap((u) => {
    const acc = u.account_id ? byId.get(u.account_id) : undefined;
    if (!acc || !isUsageDrop(u, cust.has(acc.id))) return [];
    return [{
      detector: "usage_drop",
      dedupe_key: `usage_drop:${acc.id}:${week(s.now)}`,
      priority: (u.active_users_7d === 0 ? 1 : 2) as 1 | 2,
      title: `${acc.name}: el uso del producto cae (${u.active_users_prev_7d} → ${u.active_users_7d} personas)`,
      body: "Es cliente y esta semana lo usa la mitad de gente o menos que la anterior. Llama a tu contacto para entender qué ha cambiado antes de la renovación.",
      link: `/accounts/${acc.id}`,
      action: null,
      user_id: acc.owner_id,
    }];
  });
};
