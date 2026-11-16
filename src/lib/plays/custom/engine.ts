// NK-0171 SDD 4 (SDD-20261113-plays-a-medida-ejecucion): one run of a play. Pure: signals in, evidence and
// suggestions out. Event dates must be visible in the source (structured field or literal in the quote).
import type { NewsItem } from "@/lib/web-research";
import { emailDraftGate, type EmailStatus } from "@/lib/email-verification";
import { emailGateMark } from "@/lib/email-status";
import {
  checkFreshness,
  parseEventDate,
  validateEvidence,
  QUOTE_MAX,
  type Evidence,
  type FreshnessWindow,
  type Step,
} from "./model";

export type Provider = "firecrawl" | "perplexity" | "parallel" | "apify" | "drive";
export type TaggedItem = NewsItem & { provider: Provider };

/** Merge provider lists, dedupe by URL (first provider wins), cap at max. */
export function mergeTagged(lists: TaggedItem[][], max: number): TaggedItem[] {
  const seen = new Set<string>();
  const out: TaggedItem[] = [];
  for (const i of lists.flat()) {
    if (seen.has(i.url)) continue;
    seen.add(i.url);
    out.push(i);
    if (out.length >= max) break;
  }
  return out;
}

const LITERALS = [
  /\b\d{4}-\d{2}-\d{2}\b/g,
  /\b\d{1,2}\s+(?:de\s+)?[a-záéíóú]+\s+(?:de\s+)?\d{4}\b/gi,
  /\b[a-z]+\s+\d{1,2},?\s+\d{4}\b/gi,
];
export function signalDate(i: NewsItem): { eventDate: string | null; from: Evidence["dateFrom"] } {
  const s = parseEventDate(i.date);
  if (s) return { eventDate: s, from: "structured" };
  for (const re of LITERALS)
    for (const m of i.snippet.match(re) ?? []) {
      const d = parseEventDate(m);
      if (d) return { eventDate: d, from: "literal" };
    }
  return { eventDate: null, from: "unknown" };
}

export type Target = {
  accountId: string;
  personId: string | null;
  emailStatus: EmailStatus | null;
};
export type Suggestion = {
  accountId: string | null;
  contact: string;
  mark: string | null;
  reason: string | null;
  url: string;
};

export function runPlay(i: {
  steps: Step[];
  signalStep: number;
  window: FreshnessWindow;
  verifiedOnly: boolean;
  now: Date;
  signals: TaggedItem[];
  targets: Target[];
}) {
  const accepted: Array<{ url: string; provider: Provider; evidence: Evidence }> = [];
  const rejected: Array<{ url: string; reason: string }> = [];
  for (const s of i.signals) {
    const d = signalDate(s);
    const fr = checkFreshness({ eventDate: d.eventDate, publishedDate: null }, i.window, i.now);
    if (!fr.ok) {
      rejected.push({ url: s.url, reason: fr.reason });
      continue;
    }
    const evidence: Evidence = {
      step: i.signalStep,
      url: s.url,
      quote: s.snippet.slice(0, QUOTE_MAX),
      observedAt: i.now.toISOString(),
      eventDate: d.eventDate,
      dateFrom: d.from,
    };
    const ev = validateEvidence(evidence);
    if (!ev.ok) {
      rejected.push({ url: s.url, reason: ev.reason });
      continue;
    }
    accepted.push({ url: s.url, provider: s.provider, evidence });
  }
  const suggestions: Suggestion[] = [];
  for (const a of accepted) {
    if (!i.targets.length) {
      suggestions.push({
        accountId: null,
        contact: "sin dato",
        mark: null,
        reason: null,
        url: a.url,
      });
      continue;
    }
    for (const t of i.targets) {
      if (!t.personId || !t.emailStatus) {
        suggestions.push({
          accountId: t.accountId,
          contact: "sin dato",
          mark: null,
          reason: null,
          url: a.url,
        });
        continue;
      }
      const g = emailDraftGate(t.emailStatus, i.verifiedOnly);
      suggestions.push(
        g.allowed
          ? {
              accountId: t.accountId,
              contact: t.personId,
              mark: emailGateMark(t.emailStatus),
              reason: null,
              url: a.url,
            }
          : {
              accountId: t.accountId,
              contact: "bloqueado",
              mark: null,
              url: a.url,
              reason:
                i.verifiedOnly && t.emailStatus !== "invalid" && t.emailStatus !== "catch_all"
                  ? "Este play solo usa contactos con email verificado."
                  : "Email inválido o catch-all: no se prepara borrador.",
            },
      );
    }
  }
  return { accepted, rejected, suggestions };
}
