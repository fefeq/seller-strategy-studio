// Sources and findings of the onboarding reading (SDD field-actions-edit-delete-confirm, U-4): adding files keeps
// the ones already listed (CA-12), removing a source says which findings depend on it and lets the person keep or
// discard them (CA-11), and a finding can be confirmed, edited or discarded (undo within 24 hours). Pure and tested.
import { z } from "zod";
import { UNDO_HOURS } from "@/lib/delete-rules";
import type { Finding } from "@/lib/onboarding";

/**
 * The most documents one reading takes, shared by the screen (mergeFiles), the job schema and the reading itself.
 * 3 because each PDF travels as a data URL in the request (up to 4 MB each): raising it is a different ticket (NK-0164).
 */
export const MAX_FILES = 3;

/** What the person is told when a reading gets more documents than it takes (client notice and server too_big). */
export const FILES_HOW_TO_GO_ON =
  "Para añadir más, súbelos a Drive y elígelos desde ahí, o pega su texto.";
export const filesLimitText = () =>
  `Una lectura admite hasta ${MAX_FILES} documentos. ${FILES_HOW_TO_GO_ON}`;

/** Input of the `onboarding_read` background job. Lives here (client-safe, zod only) so tests and the job share one schema. */
export const onboardingReadInput = z
  .object({
    depth: z.enum(["express", "standard", "deep"]),
    url: z.string().trim().max(500).default(""),
    text: z.string().max(40_000).default(""),
    files: z
      .array(
        z.object({
          filename: z.string().max(200),
          dataUrl: z.string().startsWith("data:").max(6_000_000),
        }),
      )
      .max(MAX_FILES)
      .default([]),
  })
  .refine((i) => i.url || i.text.trim() || i.files.length, "Añade una web, texto o un documento");

export type PendingFile = { filename: string; dataUrl: string };

/** CA-12: new files join the list; one with the same name replaces the older one; the cap drops the newest extras and says which. */
export function mergeFiles(prev: PendingFile[], added: PendingFile[], max = MAX_FILES): { files: PendingFile[]; dropped: string[] } {
  const files = [...prev];
  const dropped: string[] = [];
  for (const f of added) {
    const i = files.findIndex((x) => x.filename === f.filename);
    if (i >= 0) files[i] = f;
    else if (files.length < max) files.push(f);
    else dropped.push(f.filename);
  }
  return { files, dropped };
}

const core = (s: string) => s.replace(/\s*\(drive\)\s*$/i, "").trim();

/** Takes out of the pasted text the block a text file added (`--- name ---` up to the next block). */
export function removeFileText(text: string, name: string): string {
  const marker = `\n\n--- ${core(name)} ---\n`;
  const start = text.indexOf(marker);
  if (start < 0) return text;
  const next = text.indexOf("\n\n--- ", start + marker.length);
  return text.slice(0, start) + (next < 0 ? "" : text.slice(next));
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/^https?:\/\/(www\.)?/, "").replace(/[^\p{L}\p{N}.]+/gu, " ").trim();

/** The part of a source label that a finding's source text would mention: «Web · https://a.com» → «a.com», «Plan.pdf (Drive)» → «plan.pdf». */
export function sourceCore(source: string): string {
  return norm(core(source).replace(/^Web\s*·\s*/i, ""));
}

/** Indexes of the findings whose source mentions this source. A generic source («Tus fuentes») names no one, so it depends on none. */
export function findingsDependingOn(source: string, findings: Finding[]): number[] {
  const c = sourceCore(source);
  if (!c) return [];
  return findings.flatMap((f, i) => (f.source && !f.discardedAt && norm(f.source).includes(c) ? [i] : []));
}

export type RemovalChoice = "keep" | "discard";

/** CA-11: the source leaves the list; its findings are kept (marked «fuente quitada») or discarded. */
export function removeSource(state: { sources: string[]; findings: Finding[] }, source: string, choice: RemovalChoice, now: string): { sources: string[]; findings: Finding[] } {
  const deps = new Set(findingsDependingOn(source, state.findings));
  return {
    sources: state.sources.filter((s) => s !== source),
    findings: state.findings.map((f, i) => (!deps.has(i) ? f : choice === "discard" ? { ...f, discardedAt: now } : { ...f, sourceRemoved: true })),
  };
}

const at = (xs: Finding[], i: number, f: (x: Finding) => Finding) => xs.map((x, j) => (j === i ? f(x) : x));

export const confirmFinding = (xs: Finding[], i: number, by: string, now: string) => at(xs, i, (f) => ({ ...f, confirmedBy: by, confirmedAt: now }));

/** Editing always confirms (decided by Fede): what the person wrote is theirs and confirmed. An empty text is refused. */
export function editFinding(xs: Finding[], i: number, text: string, by: string, now: string): Finding[] | null {
  const t = text.trim();
  return t ? at(xs, i, (f) => ({ ...f, text: t.slice(0, 300), edited: true, confirmedBy: by, confirmedAt: now })) : null;
}

export const discardFinding = (xs: Finding[], i: number, now: string) => at(xs, i, (f) => ({ ...f, discardedAt: now }));
export const restoreFinding = (xs: Finding[], i: number) => at(xs, i, (f) => { const { discardedAt: _d, ...rest } = f; return rest; });

/** A discarded finding can come back for 24 hours. */
export function canRestore(f: Finding, now: Date): boolean {
  return !!f.discardedAt && now.getTime() - new Date(f.discardedAt).getTime() <= UNDO_HOURS * 3_600_000;
}
