import { DAY, isoDate, OPEN, type Detector } from "../types";

/** Open deal whose close date already passed → propose moving it 30 days. */
export const pastCloseDate: Detector = (s) => {
  const today = isoDate(s.now);
  return s.deals
    .filter((d) => OPEN(d.stage) && d.close_date && d.close_date < today)
    .map((d) => ({
      detector: "past_close_date",
      dedupe_key: `past_close_date:${d.id}:${d.close_date}`,
      priority: 1,
      title: `La fecha de cierre de ${d.name} ya pasó (${d.close_date})`,
      body: "Actualiza la fecha para que el forecast sea fiable. Propuesta: moverla 30 días.",
      link: "/deals",
      action: {
        tool: "update_deal",
        args: { deal_id: d.id, close_date: isoDate(new Date(s.now.getTime() + 30 * DAY)) },
      },
      user_id: d.owner_id,
    }));
};
