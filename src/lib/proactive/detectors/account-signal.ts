import { ACTIONABLE_SIGNALS, SIGNAL_LABEL, type SignalKind } from "@/lib/web-research";
import { DAY, type Detector } from "../types";

/** A recent news signal (funding, hiring, launch…) on an account: a reason to reach out now. Kept for 7 days. */
export const accountSignal: Detector = (s) => {
  const byId = new Map(s.accounts.map((a) => [a.id, a]));
  return (s.signals ?? [])
    .filter(
      (x) =>
        ACTIONABLE_SIGNALS.includes(x.kind as SignalKind) &&
        s.now.getTime() - new Date(x.found_at).getTime() <= 7 * DAY,
    )
    .flatMap((x) => {
      const acc = byId.get(x.account_id);
      if (!acc) return [];
      return [
        {
          detector: "account_signal",
          dedupe_key: `signal:${x.id}`,
          priority: (acc.is_target || x.kind === "risk" ? 2 : 3) as 2 | 3,
          title:
            `${SIGNAL_LABEL[x.kind as SignalKind] ?? "Novedad"} en ${acc.name}: ${x.title}`.slice(
              0,
              200,
            ),
          body: [
            x.summary,
            x.relevance ? `Por qué importa: ${x.relevance}` : "",
            `Fuente: ${x.url}`,
          ]
            .filter(Boolean)
            .join("\n"),
          link: `/accounts/${acc.id}?tab=signals`,
          action: null,
          user_id: acc.owner_id,
        },
      ];
    });
};
