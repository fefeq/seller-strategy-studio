// F1 · Pipeline rule: CA-17 the stage that concentrates open deals and converts worst. No AI (CA-24).
import { stageConversion } from "@/lib/metrics";
import { openStages } from "@/lib/stages";
import { buildStrategySuggestion } from "@/lib/strategy-suggestions";
import { OPEN, type Detector } from "../types";

/** Fewer deals than this that reached a stage and the conversion is not a rate worth comparing (CA-25). */
export const MIN_STAGE_SAMPLE = 5;
export const MIN_CONCENTRATED = 3;
export const CONCENTRATION_SHARE = 0.3;

export const stageBottleneck: Detector = (s) => {
  const d = s.strategy;
  if (!d) return [];
  const order = openStages(s.stages).map((x) => x.key);
  const label = (k: string) => openStages(s.stages).find((x) => x.key === k)?.label ?? k;
  const open = d.deals.filter((x) => OPEN(x.stage));
  if (open.length < MIN_CONCENTRATED || order.length < 2) return [];
  const count = new Map<string, typeof open>();
  for (const x of open) count.set(x.stage, [...(count.get(x.stage) ?? []), x]);
  const [stage, here] =
    [...count.entries()]
      .filter(([k]) => order.includes(k))
      .sort((a, b) => b[1].length - a[1].length)[0] ?? [];
  if (
    !stage ||
    !here ||
    here.length < MIN_CONCENTRATED ||
    here.length / open.length < CONCENTRATION_SHARE
  )
    return [];
  const rates = stageConversion(d.history, order);
  const withSample = rates.filter((r) => r.count >= MIN_STAGE_SAMPLE);
  const mine = rates.find((r) => r.from === stage);
  const evidence = here.map((x) => ({ table: "deals", id: x.id, label: x.name }));
  if (!mine || mine.count < MIN_STAGE_SAMPLE) {
    // CA-25: not enough history to compare this stage: say what is missing instead of a rate.
    return [
      buildStrategySuggestion({
        element: "pipeline",
        kind: "missing_data",
        action_type: "data_to_complete",
        cause: `stage_bottleneck:${stage}`,
        priority: 3,
        title: `«${label(stage)}» concentra ${here.length} deals abiertos y falta historial para medir su conversión`,
        body: `Hacen falta al menos ${MIN_STAGE_SAMPLE} deals que hayan pasado por la etapa con su historial de cambios para comparar su conversión con las demás.`,
        evidence: [],
        sample_size: mine?.count ?? 0,
        link: "/deals",
      }),
    ];
  }
  const lowest = withSample.reduce((a, b) => (b.rate < a.rate ? b : a));
  if (lowest.from !== stage) return [];
  const pct = Math.round(mine.rate * 100);
  return [
    buildStrategySuggestion({
      element: "pipeline",
      kind: "change",
      action_type: "commercial_action",
      cause: `stage_bottleneck:${stage}`,
      priority: 2,
      title: `«${label(stage)}» concentra ${here.length} deals abiertos y es la etapa que menos convierte (${pct} %)`,
      body: `De ${mine.count} deals que pasaron por la etapa, el ${pct} % siguió a la siguiente. Es la conversión más baja entre las etapas con muestra. Revisa qué frena ahí a los deals abiertos.`,
      evidence,
      sample_size: Math.max(mine.count, evidence.length),
      link: "/deals",
    }),
  ];
};
