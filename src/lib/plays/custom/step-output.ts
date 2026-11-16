import type { TablesInsert } from "@/integrations/supabase/types";
import { runPlay, type TaggedItem, type Target } from "./engine";
import { validateMessage, type Step } from "./model";
import type { Proposal } from "./propose";
import type { PlayCost } from "./measured-ai.server";
export type StepPayload = {
  signals: TaggedItem[];
  evidence: Array<{
    url: string;
    quote: string;
    event_date: string | null;
    date_from: string;
    provider: string;
    step_number: number;
  }>;
  suggestions: Array<Pick<TablesInsert<"suggestions">, "dedupe_key" | "title" | "body" | "link">>;
  costs: PlayCost[];
  usage: Array<{ service: string; need: string; trigger: string; cost: number }>;
  sourceData?: unknown;
};
export function buildStepPayload(i: {
  playId: string;
  proposal: Proposal;
  step: Step;
  signals: TaggedItem[];
  targets: Target[];
  previous: StepPayload[];
  now: Date;
  last: boolean;
}): StepPayload {
  const r = runPlay({
    steps: i.proposal.steps,
    signalStep: i.step.n,
    window: i.proposal.window,
    verifiedOnly: i.proposal.verifiedOnly,
    now: i.now,
    signals: i.signals,
    targets: i.targets,
  });
  const evidence = r.accepted.map((a) => ({
    url: a.url,
    quote: a.evidence.quote,
    event_date: a.evidence.eventDate,
    date_from: a.evidence.dateFrom,
    provider: a.provider,
    step_number: i.step.n,
  }));
  const all = [...i.previous.flatMap((p) => p.evidence), ...evidence];
  const facts = all.map((e) => ({ step: e.step_number, eventDate: e.event_date }));
  const claimsValid = validateMessage(
    i.proposal.message,
    i.proposal.steps,
    facts,
    i.proposal.window,
    i.now,
  ).ok;
  const signals = [
    ...i.previous.flatMap((p) => p.signals),
    ...r.accepted
      .map((a) => i.signals.find((s) => s.url === a.url))
      .filter((s): s is TaggedItem => !!s),
  ];
  const accountSuggestions = i.last
    ? runPlay({
        steps: i.proposal.steps,
        signalStep: i.step.n,
        window: i.proposal.window,
        verifiedOnly: i.proposal.verifiedOnly,
        now: i.now,
        signals,
        targets: i.targets,
      }).suggestions
    : [];
  const seen = new Set<string>();
  const suggestions: StepPayload["suggestions"] = [];
  for (const s of accountSuggestions) {
    const key = `custom_play:${i.playId}:${s.accountId ?? "company"}:${s.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const cited = all.map((e) => `[Paso ${e.step_number}] «${e.quote}» — ${e.url}`).join("\n");
    // Claim text is NOT copied from the proposal: literal verified evidence is the only factual message.
    const draft =
      claimsValid && s.accountId && s.contact !== "sin dato" && !s.reason
        ? `Propuesta de mensaje (no enviada):\n${i.proposal.message.claims
            .map((c) =>
              all
                .filter((e) => e.step_number === c.step)
                .map((e) => `«${e.quote}» (${e.url})`)
                .join("\n"),
            )
            .join(
              "\n",
            )}\nPropuesta por preparar: ${i.proposal.message.built}\n${i.proposal.message.ask}`
        : "Sin borrador: faltan hechos con fecha o un contacto permitido.";
    suggestions.push({
      dedupe_key: key,
      title: `Señal del play: ${i.proposal.name}`,
      body: `${cited}\nContacto: ${s.mark ?? (s.contact === "sin dato" ? "sin dato" : s.contact === "bloqueado" ? "bloqueado" : "verificado")}\n${s.reason ?? ""}\n${draft}`,
      link: s.accountId ? `/accounts/${s.accountId}` : "/inbox",
    });
  }
  return {
    signals: r.accepted.flatMap((a) => i.signals.filter((s) => s.url === a.url)),
    evidence,
    suggestions,
    costs: [],
    usage: [],
  };
}
