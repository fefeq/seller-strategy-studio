import type { Detector } from "../types";

/** Target account with stakeholders mapped but no decision maker. */
export const noDecisionMaker: Detector = (s) =>
  s.accounts
    .filter((a) => a.is_target)
    .filter((a) => {
      const sh = s.stakeholders.filter((x) => x.account_id === a.id);
      return sh.length > 0 && !sh.some((x) => x.buying_role === "decision_maker");
    })
    .map((a) => ({
      detector: "no_decision_maker",
      dedupe_key: `no_decision_maker:${a.id}`,
      priority: 2,
      title: `${a.name}: falta identificar al decisor`,
      body: "El mapa de stakeholders no tiene a nadie marcado como Decisor. Sin él el deal es frágil.",
      link: `/accounts/${a.id}`,
      action: null,
      user_id: a.owner_id,
    }));
