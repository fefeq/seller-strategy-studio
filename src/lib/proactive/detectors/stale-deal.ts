import { DAY, isoDate, OPEN, type Detector } from "../types";

/** Open deal with no update in 14+ days → prepare a follow-up task. */
export const staleDeal: Detector = (s) =>
  s.deals
    .filter((d) => OPEN(d.stage) && s.now.getTime() - new Date(d.updated_at).getTime() >= 14 * DAY)
    .map((d) => {
      const days = Math.floor((s.now.getTime() - new Date(d.updated_at).getTime()) / DAY);
      return {
        detector: "stale_deal",
        dedupe_key: `stale_deal:${d.id}:${isoDate(new Date(d.updated_at))}`,
        priority: days >= 30 ? 1 : 2,
        title: `${d.name} lleva ${days} días sin actividad`,
        body: "Te propongo crear una tarea para retomar el contacto en los próximos 2 días.",
        link: "/deals",
        action: { tool: "create_task", args: { title: `Retomar contacto: ${d.name}`, deal_id: d.id, due_date: isoDate(new Date(s.now.getTime() + 2 * DAY)), owner_id: d.owner_id } },
        user_id: d.owner_id,
      };
    });
