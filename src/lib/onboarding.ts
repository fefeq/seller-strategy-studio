// Onboarding rules (pure; tested): the six strategy blocks and their order per archetype, where each proposed
// item belongs, its level and source, what the person already wrote (never overwritten), the live ticker
// findings and the cost estimate shown before reading.
import { CAPABILITIES } from "@/lib/orchestrator/planner";
import type { Archetype } from "@/lib/gtm-diagnosis";
import type { ProposalItem, SetupProposal } from "@/lib/setup-extraction";
import type { Json } from "@/integrations/supabase/types";
import { jsonObject } from "@/lib/json";
import { setupStatus, type SetupData } from "@/lib/setup-schema";

export type Depth = "express" | "standard" | "deep";
export type BlockId = "company" | "icp" | "segments" | "positioning" | "messages" | "goals";
export type Level = "confirmed" | "inferred" | "assumed";
export type BlockState = {
  status: "approved" | "skipped";
  at: string;
  undo?: { table: string; id: string }[];
};
/** A finding of the reading with its source; the person may confirm, edit or discard it, and discarding is undoable for 24 hours. */
export type Finding = {
  at: string;
  text: string;
  source: string | null;
  confirmedBy?: string;
  confirmedAt?: string;
  edited?: boolean;
  discardedAt?: string;
  sourceRemoved?: boolean;
};
export type Opinion = { block: BlockId; persona: string; text: string };

export const BLOCKS: { id: BlockId; label: string; groups: string[] }[] = [
  { id: "company", label: "Empresa y moneda", groups: ["Empresa"] },
  { id: "icp", label: "ICP y cuentas objetivo", groups: ["ICP", "Cuentas objetivo"] },
  { id: "segments", label: "Segmentos y benchmarks", groups: ["Segmentos"] },
  { id: "positioning", label: "Posicionamiento", groups: ["Posicionamiento"] },
  { id: "messages", label: "Mensajes", groups: ["Pilares de mensaje"] },
  { id: "goals", label: "Objetivos y cuota", groups: ["Cuota"] },
];
export const BLOCK_LABEL = Object.fromEntries(BLOCKS.map((b) => [b.id, b.label])) as Record<
  BlockId,
  string
>;
export const LEVEL_LABEL: Record<Level, string> = {
  confirmed: "Confirmado",
  inferred: "Deducido",
  assumed: "Supuesto",
};
/** «Rehacer con IA» accepts a pasted document (positioning, notes, a transcript), not just a one-liner. */
export const REDO_HINT_MAX = 15000;

/** The archetype decides what is approved first: PLG and consumer start from the message, enterprise from the accounts. */
export function blockOrder(archetype: Archetype | null | undefined): BlockId[] {
  if (archetype === "A" || archetype === "D" || archetype === "E")
    return ["company", "positioning", "messages", "icp", "segments", "goals"];
  if (archetype === "C") return ["company", "icp", "segments", "goals", "positioning", "messages"];
  return ["company", "icp", "segments", "positioning", "messages", "goals"];
}

export function blockOf(item: Pick<ProposalItem, "group">): BlockId {
  return BLOCKS.find((b) => b.groups.includes(item.group))?.id ?? "company";
}

/** Level and source of a block as the AI stated them; without a statement the block counts as Nokko's assumption. */
export function blockBasis(
  p: SetupProposal | null,
  block: BlockId,
): { level: Level; source: string } {
  const b = p?.basis?.find((x) => x.block === block);
  if (!b) return { level: "assumed", source: "Supuesto de Nokko" };
  return {
    level: b.level,
    source: b.source?.trim() || (b.level === "assumed" ? "Supuesto de Nokko" : "Tus fuentes"),
  };
}

const filled = (v: unknown) => (typeof v === "string" ? v.trim().length > 0 : v != null);
const SEGMENT_FIELDS = ["acv_min", "acv_max", "win_rate_target", "ae_quota"] as const;

/**
 * Drops from the proposal whatever the company already has written: positioning fields with a value, segment
 * figures already set (matched by name), this quarter's quota and the same currency. Returns what was kept.
 */
export function protectManual(
  items: ProposalItem[],
  existing: Pick<SetupData, "positioning" | "segments" | "quotas" | "quarter" | "currency">,
) {
  const kept: string[] = [];
  const out: ProposalItem[] = [];
  for (const it of items) {
    if (it.tool === "update_positioning") {
      const fields = { ...((it.args.fields as Record<string, unknown>) ?? {}) };
      for (const k of Object.keys(fields))
        if (filled(existing.positioning?.[k])) {
          delete fields[k];
          kept.push(`Posicionamiento: ${k}`);
        }
      if (Object.values(fields).some(filled)) out.push({ ...it, args: { ...it.args, fields } });
      continue;
    }
    if (it.tool === "upsert_segment") {
      const name = String(it.args.name ?? "")
        .trim()
        .toLowerCase();
      const seg = existing.segments.find((s) => s.name.trim().toLowerCase() === name);
      if (!seg) {
        out.push(it);
        continue;
      }
      const args = { ...it.args };
      for (const k of SEGMENT_FIELDS)
        if (seg[k] != null && k in args) {
          delete args[k];
          kept.push(`${seg.name}: ${k}`);
        }
      if (Object.keys(args).some((k) => k !== "name" && k !== "segment_id" && filled(args[k])))
        out.push({ ...it, args });
      continue;
    }
    if (
      it.tool === "set_quota" &&
      existing.quotas.some((q) => q.period === existing.quarter && Number(q.amount) > 0)
    ) {
      kept.push("Cuota del trimestre");
      continue;
    }
    if (it.tool === "set_currency" && existing.currency && existing.currency === it.args.currency)
      continue;
    out.push(it);
  }
  return { items: out, kept };
}

/** Puts back into a proposal only the redone block, so a redo never touches what was already reviewed. */
export function mergeBlock(
  prev: SetupProposal,
  next: SetupProposal,
  block: BlockId,
): SetupProposal {
  const basis = [
    ...(prev.basis ?? []).filter((b) => b.block !== block),
    ...(next.basis ?? []).filter((b) => b.block === block),
  ];
  const pick: Record<BlockId, Partial<SetupProposal>> = {
    company: { currency: next.currency },
    icp: { icps: next.icps, target_accounts: next.target_accounts },
    segments: { segments: next.segments },
    positioning: { positioning: next.positioning },
    messages: { pillars: next.pillars },
    goals: { quarter_quota: next.quarter_quota ?? null },
  };
  return { ...prev, ...pick[block], basis };
}

/** What the ticker says once the proposal arrives. */
export function proposalFindings(p: SetupProposal): { text: string; source: string | null }[] {
  const src = (b: BlockId) => blockBasis(p, b).source;
  const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
  const out: { text: string; source: string | null }[] = [];
  if (p.positioning?.category)
    out.push({ text: `Categoría: ${p.positioning.category}`, source: src("positioning") });
  if (p.segments.length)
    out.push({
      text: `Encontrado: ${n(p.segments.length, "segmento", "segmentos")} (${p.segments.map((s) => s.name).join(", ")})`,
      source: src("segments"),
    });
  if (p.icps.length)
    out.push({
      text: `Encontrado: ${n(p.icps.length, "ICP", "ICP")} (${p.icps.map((s) => s.name).join(", ")})`,
      source: src("icp"),
    });
  const alt = p.positioning?.competitive_alternative || p.positioning?.alternatives;
  if (alt) out.push({ text: `Competidores y alternativas: ${alt}`, source: src("positioning") });
  if (p.pillars.length)
    out.push({
      text: `Encontrado: ${n(p.pillars.length, "pilar de mensaje", "pilares de mensaje")}`,
      source: src("messages"),
    });
  if (p.target_accounts.length)
    out.push({
      text: `Cuentas de ejemplo: ${p.target_accounts.map((a) => a.name).join(", ")}`,
      source: src("icp"),
    });
  if (p.quarter_quota)
    out.push({ text: `Objetivo del trimestre: ${p.quarter_quota}`, source: src("goals") });
  if (p.questions.length)
    out.push({
      text: `Me faltan ${n(p.questions.length, "dato", "datos")}: te lo pregunto en Sugerencias`,
      source: null,
    });
  return out;
}

/** Approximate spend on paid sources before reading (AI calls run on the company's own keys and are not counted). */
export function readingCost(depth: Depth, hasUrl: boolean): number {
  const cost = (need: keyof typeof CAPABILITIES, service: string) =>
    CAPABILITIES[need].options.find((o) => o.service === service)?.cost ?? 0;
  let c = hasUrl ? cost("research_account", "firecrawl") : 0;
  if (depth === "deep")
    c +=
      cost("competitors", "firecrawl") +
      cost("competitors", "perplexity") +
      cost("research_account", "parallel");
  return Math.round(c * 100) / 100;
}

/** The roadmap stays in Inicio until the strategy is complete or the person hides it. */
export function showRoadmapCard(
  session: { completed_at: string | null } | null | undefined,
  setupPct: number,
): boolean {
  return !!session && !session.completed_at && setupPct < 100;
}

/** Every block decided (approved or skipped). */
export function blocksDecided(
  order: BlockId[],
  status: Partial<Record<BlockId, BlockState>>,
  present: Set<BlockId>,
): boolean {
  return order.filter((b) => present.has(b)).every((b) => !!status[b]);
}

/** The six steps of the walkthrough, in order; the labels live in the route. */
export const STEP_IDS = ["depth", "sources", "reading", "diagnosis", "blocks", "roadmap"] as const;
export type Step = (typeof STEP_IDS)[number];

/** The one definition of «onboarding finished» per person: they reached the roadmap. `completed_at` only means «card hidden». */
export function onboardingDone(s: { step: string | null } | null | undefined): boolean {
  return s?.step === "roadmap";
}

/** Which steps the person can open. The diagnosis never needs a proposal (no sources, or a failed reading). */
export function stepReachable(
  step: Step,
  i: { readJobId: string | null; hasProposal: boolean; hasDiagnosis: boolean },
): boolean {
  if (step === "reading") return !!i.readJobId;
  if (step === "blocks") return i.hasProposal;
  if (step === "roadmap") return i.hasDiagnosis;
  return true;
}

/** After saving the diagnosis: approve the proposal if there is one, otherwise the walkthrough is done. */
export function nextStepAfterDiagnosis(hasProposal: boolean): "blocks" | "roadmap" {
  return hasProposal ? "blocks" : "roadmap";
}

export type CompanyDiagnosisSummary = {
  archetype: string;
  name: string | null;
  motion: string | null;
  stage: string | null;
  nextStep: string | null;
};

/** What the GTM diagnosis says, without the ticket or the framework lists; a malformed jsonb gives null, never throws. */
function diagnosisSummary(raw: unknown): CompanyDiagnosisSummary | null {
  const obj = jsonObject(raw as Json | null | undefined);
  const result = jsonObject((obj?.result ?? null) as Json | null);
  if (!result || typeof result.archetype !== "string" || !result.archetype) return null;
  const input = jsonObject((obj?.input ?? null) as Json | null);
  const text = (v: Json | undefined) => (typeof v === "string" && v ? v : null);
  return {
    archetype: result.archetype,
    name: text(result.name),
    motion: text(result.motion),
    stage: text(input?.stage),
    nextStep: text(result.nextStep),
  };
}

/**
 * What NOKKO knows about the company's onboarding and what is missing for the plays diagnosis. `ready` needs the GTM
 * diagnosis plus complete positioning and ICP (the rule lives in setup-schema.ts); segments are listed but do not block.
 */
export function companyOnboardingStatus({
  mine,
  companyDiagnosis,
  setup,
}: {
  mine: { step: string | null; diagnosis: unknown } | null;
  companyDiagnosis: unknown;
  setup: SetupData;
}) {
  const done = new Map(setupStatus(setup).items.map((i) => [i.id, i.done]));
  const strategy = {
    positioning: !!done.get("positioning"),
    icp: !!done.get("icp"),
    segments: !!done.get("segments"),
  };
  const diagnosis = diagnosisSummary(companyDiagnosis);
  const missing = [
    diagnosis ? null : "Diagnóstico GTM sin hacer",
    strategy.positioning ? null : "Posicionamiento sin completar",
    strategy.icp ? null : "ICP sin completar",
    strategy.segments ? null : "Segmentos sin rango de ACV",
  ].filter((x): x is string => !!x);
  return {
    mine: { step: mine?.step ?? null, done: onboardingDone(mine) },
    diagnosis,
    strategy,
    missing,
    ready: diagnosis !== null && strategy.positioning && strategy.icp,
  };
}
