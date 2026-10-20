// Scale-adaptive track per deal (BMAD's "smallest safe path"), driven by ACV, and stage exit criteria.
import { recommendMotion } from "@/lib/metrics";
import { MEDDPICC } from "@/lib/roles";

export type Track = "light" | "standard" | "full";

export const TRACKS: Record<Track, { label: string; description: string }> = {
  light: { label: "Ligero (PLG)", description: "ACV < 5K: sin plan de cuenta, cualificación mínima." },
  standard: { label: "Estándar (inside)", description: "ACV 5K–50K: MEDDPICC ligero." },
  full: { label: "Completo (field/strategic)", description: "ACV > 50K: plan de cuenta completo y plan de acción conjunto." },
};

export function trackFor(acv: number | null | undefined): Track {
  const m = recommendMotion(Number(acv ?? 0));
  return m === "plg" ? "light" : m === "inside" ? "standard" : "full";
}

type Key = (typeof MEDDPICC)[number][0];
// Criteria required to ENTER each stage, per track.
const GATES: Record<Track, Partial<Record<string, Key[]>>> = {
  light: { qualified: ["identify_pain"], proposal: ["economic_buyer"] },
  standard: { qualified: ["identify_pain"], demo: ["metrics", "champion"], proposal: ["economic_buyer", "decision_criteria"], negotiation: ["decision_process"] },
  full: { qualified: ["identify_pain", "metrics"], demo: ["champion", "decision_criteria"], proposal: ["economic_buyer", "decision_process", "competition"], negotiation: ["paper_process"] },
};
const ORDER = ["discovery", "qualified", "demo", "proposal", "negotiation", "won"];

export function covered(v: unknown) {
  if (!v) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "object") {
    const o = v as { score?: number; note?: string };
    return (o.score ?? 0) >= 2 || !!o.note?.trim();
  }
  return false;
}

/** Missing MEDDPICC criteria (labels) to move a deal into `toStage`, cumulative over skipped stages. */
export function stageGate(deal: { amount: number | null; meddpicc: Record<string, unknown> | null }, toStage: string) {
  const track = trackFor(deal.amount);
  const idx = ORDER.indexOf(toStage);
  if (idx < 0) return { track, missing: [] as string[] };
  const keys = new Set<Key>();
  for (const st of ORDER.slice(0, idx + 1)) for (const k of GATES[track][st] ?? []) keys.add(k);
  const m = deal.meddpicc ?? {};
  const missing = MEDDPICC.filter(([k]) => keys.has(k) && !covered(m[k])).map(([, label]) => label);
  return { track, missing };
}
