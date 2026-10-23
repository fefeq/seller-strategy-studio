import type { Detector } from "../types";
import { customerHealth, customerIds, lastActivityByAccount, readCustomerSettings, wonKeysOf } from "@/lib/customers";

/**
 * A customer (account with a won deal) whose evidence points at risk: a red account health or no
 * activity for longer than the company's limit → propose a task to review it. The key carries the
 * risk signals, so a dismissed reminder returns only when a different signal fires. Accounts with no
 * known signal stay quiet: «sin datos» is not a risk.
 */
export const customerAtRisk: Detector = (s) => {
  const settings = s.customerSettings ?? readCustomerSettings(null);
  const customers = customerIds(s.deals, wonKeysOf(s.stages));
  if (!customers.size) return [];
  const activity = lastActivityByAccount(s.activity ?? [], s.now);
  const health = new Map((s.accountHealth ?? []).map((a) => [a.id, a.health]));
  return s.accounts
    .filter((a) => customers.has(a.id))
    .flatMap((a) => {
      const h = customerHealth({ accountHealth: health.get(a.id) ?? null, lastActivityAt: activity.get(a.id) ?? null, quietDays: settings.quietDays, now: s.now });
      if (h.nivel !== "riesgo") return [];
      const risks = h.senales.filter((x) => x.estado === "riesgo");
      return [{
        detector: "customer_at_risk",
        dedupe_key: `customer_at_risk:${a.id}:${risks.map((x) => x.id).sort().join(",")}`,
        priority: (risks.length > 1 ? 1 : 2) as 1 | 2,
        title: `${a.name} es un cliente en riesgo`,
        body: `${risks.map((x) => x.evidencia).join(". ")}. Te propongo crear una tarea para revisar la cuenta esta semana.`,
        link: "/accounts",
        action: { tool: "create_task", args: { title: `Revisar cliente en riesgo: ${a.name}`, account_id: a.id, due_date: new Date(s.now.getTime() + 3 * 86_400_000).toISOString().slice(0, 10), owner_id: a.owner_id } },
        user_id: a.owner_id,
      }];
    });
};
