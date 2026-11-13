import { DAY, isoDate, OPEN, type Detector } from "../types";
import { staleDeals, thresholdText } from "@/lib/stale";

/**
 * Open deal idle for longer than its segment's threshold (a quarter of the real cycle, 14–60 days,
 * or the company's own number) → prepare a follow-up task.
 */
export const staleDeal: Detector = (s) => {
  const cycleDeals =
    s.cycleDeals ??
    s.deals.map((d) => ({
      id: d.id,
      stage: d.stage,
      amount: d.amount,
      close_date: d.close_date,
      closed_at: null as string | null,
      updated_at: d.updated_at,
      created_at: d.updated_at,
      segment_id: null as string | null,
    }));
  const cold = new Map(
    staleDeals(cycleDeals, s.cycleSegments ?? [], s.staleDays ?? null, s.now)
      .filter((r) => r.stale)
      .map((r) => [r.deal.id, r]),
  );
  return s.deals
    .filter((d) => OPEN(d.stage) && cold.has(d.id))
    .map((d) => {
      const { idleDays: days, threshold } = cold.get(d.id)!;
      return {
        detector: "stale_deal",
        dedupe_key: `stale_deal:${d.id}:${isoDate(new Date(d.updated_at))}`,
        priority: days >= threshold.days * 2 ? 1 : 2,
        title: `${d.name} lleva ${days} días sin actividad`,
        body: `Se da por enfriado a los ${thresholdText(threshold)}. Te propongo crear una tarea para retomar el contacto en los próximos 2 días.`,
        link: "/deals",
        action: {
          tool: "create_task",
          args: {
            title: `Retomar contacto: ${d.name}`,
            deal_id: d.id,
            due_date: isoDate(new Date(s.now.getTime() + 2 * DAY)),
            owner_id: d.owner_id,
          },
        },
        user_id: d.owner_id,
      };
    });
};
