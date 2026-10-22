import { MEDDPICC } from "@/lib/roles";
import type { Detector } from "../types";
import { lateStages, stageLabel } from "@/lib/stages";

/** Deal in one of the company's last two open stages with fewer than 6 of 8 MEDDPICC fields filled. */
export const meddpiccGaps: Detector = (s) => {
  const late = lateStages(s.stages);
  return s.deals
    .filter((d) => late.has(d.stage))
    .map((d) => {
      const m = d.meddpicc ?? {};
      const missing = MEDDPICC.filter(([k]) => !String(m[k] ?? "").trim()).map(([, label]) => label);
      return { d, missing };
    })
    .filter(({ missing }) => missing.length > 2)
    .map(({ d, missing }) => ({
      detector: "meddpicc_gaps",
      dedupe_key: `meddpicc_gaps:${d.id}:${d.stage}`,
      priority: 2,
      title: `${d.name} está en ${stageLabel(d.stage, s.stages)} con MEDDPICC incompleto`,
      body: `Falta: ${missing.join(", ")}.`,
      link: d.account_id ? `/accounts/${d.account_id}` : `/deals?deal=${d.id}`,
      action: null,
      user_id: d.owner_id,
    }));
};
