// Pending proposals (SDD universal-field-definitions, CA-9): when an automatic process finds a different value for
// a field that already has one, the value is not replaced; it becomes a suggestion the person accepts or dismisses.
// The suggestion's action is update_account, so accepting writes it like any other edit. Pure and tested.
import { countryName } from "@/lib/assignment";
import { ENRICH_LABEL, type EnrichField } from "@/lib/clay";
import { normalizeForSave } from "@/lib/field-normalize";
import type { Suggestion } from "@/lib/proactive/types";
import {
  ACCOUNT_SOURCES,
  autoWriteDecision,
  originOf,
  readSources,
  SOURCE_LABEL,
  type AccountSource,
} from "@/lib/provenance";

export const PROPOSAL_DETECTOR = "field_proposal";

/** Notes are not proposed: a provider's description would differ from anything a person wrote, every time. */
export const PROPOSABLE_FIELDS: readonly EnrichField[] = ["industry", "size", "country"];

export type FieldProposal = {
  field: EnrichField;
  current: string | null;
  proposed: string;
  source: string;
};

const canon = (field: EnrichField, v: string) =>
  (field === "size" || field === "country"
    ? String(normalizeForSave("accounts", field, v).value ?? "")
    : v.trim()
  ).toLowerCase();

/** The one rule: write an empty field, offer a different value, ignore the same value in another format. */
export function fieldProposalDecision(
  field: EnrichField,
  current: string | null | undefined,
  proposed: string | null | undefined,
): ReturnType<typeof autoWriteDecision> {
  const d = autoWriteDecision(current, proposed);
  if (d !== "propose") return d;
  return canon(field, current!) === canon(field, proposed!) ? "same" : "propose";
}

/**
 * What an automatic run does with the changes it found: write the empty fields, offer a different value for a
 * filled one, ignore the same value in another format. A filled field is never replaced here (CA-6).
 */
export function splitAutoChanges<
  T extends { field: EnrichField; current: string | null; proposed: string; empty: boolean },
>(changes: T[]): { fill: T[]; offers: T[] } {
  return {
    fill: changes.filter(
      (ch) => ch.empty && fieldProposalDecision(ch.field, ch.current, ch.proposed) === "write",
    ),
    offers: changes.filter(
      (ch) =>
        PROPOSABLE_FIELDS.includes(ch.field) &&
        fieldProposalDecision(ch.field, ch.current, ch.proposed) === "propose",
    ),
  };
}

/** FNV-1a, so the same proposed value always has the same key and a dismissed one never comes back. */
export const hash = (s: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
};

export const proposalKey = (accountId: string, field: EnrichField, proposed: string) =>
  `${PROPOSAL_DETECTOR}:${accountId}:${field}:${hash(canon(field, proposed))}`;

const shown = (field: EnrichField, v: string) => (field === "country" ? countryName(v) || v : v);

export function proposalSuggestion(
  acc: { id: string; name: string; owner_id: string | null },
  p: FieldProposal,
  marks: unknown,
): Suggestion {
  const label = ENRICH_LABEL[p.field].toLowerCase();
  const whose =
    originOf(readSources(marks)[p.field])?.kind === "persona"
      ? "lo escribiste tú"
      : "no consta quién lo escribió";
  const from = SOURCE_LABEL[p.source] ?? p.source;
  return {
    detector: PROPOSAL_DETECTOR,
    dedupe_key: proposalKey(acc.id, p.field, p.proposed),
    priority: 3,
    title:
      `${ENRICH_LABEL[p.field]} de ${acc.name}: ¿cambiar a «${shown(p.field, p.proposed)}»?`.slice(
        0,
        200,
      ),
    body: `En ${acc.name} tienes ${label} «${shown(p.field, p.current ?? "")}» (${whose}). ${from} propone «${shown(p.field, p.proposed)}». Si lo aceptas, se sustituye. Si no, se queda el tuyo y no vuelvo a proponer este valor.`,
    link: `/accounts/${acc.id}`,
    // The source travels with the value so update_account stores where it came from (a source it would refuse is left out).
    action: {
      tool: "update_account",
      args: {
        account_id: acc.id,
        [p.field]: p.proposed,
        ...((ACCOUNT_SOURCES as readonly string[]).includes(p.source)
          ? { source: p.source as AccountSource }
          : {}),
      },
    },
    user_id: acc.owner_id,
  };
}
