// F1 · Loss rule: CA-23 a loss reason or competitor repeated in at least 3 lost deals. No AI (CA-24).
// CA-22 (competitor without a countermeasure card) is NOT here: it waits for SDD 7b (competitors are not a stored entity yet).
import { lossLabel } from "@/lib/loss-reasons";
import { buildStrategySuggestion } from "@/lib/strategy-suggestions";
import type { Detector } from "../types";

export const MIN_LOSSES = 3;
const norm = (x: string) => x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export const repeatedLoss: Detector = (s) => {
  const d = s.strategy;
  if (!d) return [];
  const lost = d.deals.filter((x) => x.stage === "lost");
  const out = [];
  const reasons = new Map<string, typeof lost>();
  for (const x of lost) if (x.lost_reason) reasons.set(x.lost_reason, [...(reasons.get(x.lost_reason) ?? []), x]);
  for (const [r, ds] of reasons) {
    if (ds.length < MIN_LOSSES) continue;
    out.push(buildStrategySuggestion({
      element: "pipeline", kind: "change", action_type: "commercial_action", cause: `loss_reason:${norm(r)}`, priority: 2,
      title: `«${lossLabel(r)}» es el motivo de ${ds.length} deals perdidos`,
      body: `El mismo motivo se repite. Decide qué cambiar para que no siga pasando; los deals están en la evidencia.`,
      evidence: ds.map((x) => ({ table: "deals", id: x.id, label: x.name })), sample_size: lost.length, link: "/deals",
    }));
  }
  const comps = new Map<string, { label: string; ds: typeof lost }>();
  for (const x of lost) {
    const c = (x.lost_competitor ?? "").trim();
    if (!c) continue;
    const g = comps.get(norm(c)) ?? { label: c, ds: [] };
    g.ds.push(x);
    comps.set(norm(c), g);
  }
  for (const [k, g] of comps) {
    if (g.ds.length < MIN_LOSSES) continue;
    out.push(buildStrategySuggestion({
      element: "competitor", kind: "change", action_type: "commercial_action", cause: `loss_competitor:${k}`, priority: 2,
      title: `Has perdido ${g.ds.length} deals frente a ${g.label}`,
      body: `El mismo competidor se repite en los deals perdidos. Prepara una respuesta; los deals están en la evidencia.`,
      evidence: g.ds.map((x) => ({ table: "deals", id: x.id, label: x.name })), sample_size: lost.length, link: "/deals",
    }));
  }
  return out;
};
