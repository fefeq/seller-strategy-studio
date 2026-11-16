import { funnelBySegment, funnelStats } from "@/lib/self-service";
import { DAY, type Detector } from "../types";

/** Segment (≥10 signups, last 90 days) converting trial→paid at less than half the org average. */
export const trialConversion: Detector = (s) => {
  const recent = s.trials.filter(
    (t) => s.now.getTime() - new Date(t.signed_up_at).getTime() <= 90 * DAY,
  );
  const avg = funnelStats(recent).trialToPaid;
  if (!avg) return [];
  return funnelBySegment(recent)
    .filter((g) => g.segment_id && g.signups >= 10 && g.trialToPaid < avg / 2)
    .map((g) => {
      const name = s.segments.find((x) => x.id === g.segment_id)?.name ?? "Segmento";
      return {
        detector: "trial_conversion",
        dedupe_key: `trial_conversion:${g.segment_id}:${s.now.toISOString().slice(0, 7)}`,
        priority: 2,
        title: `${name} convierte de prueba a pago al ${Math.round(g.trialToPaid * 100)}% (media ${Math.round(avg * 100)}%)`,
        body: `Últimos 90 días, ${g.signups} registros. Revisa el onboarding de producto o si este segmento encaja con self-service.`,
        link: "/metrics",
        action: null,
        user_id: null,
      };
    });
};
