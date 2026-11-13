// Onboarding sources by reference (storage path or Drive id): limits, text budget split and the real read status of
// each source. Pure and zod-free so screens, the job and tests share it.
import { MAX_SOURCES, MAX_UPLOAD_MB } from "@/lib/onboarding-files-limit";

export type SourceKind = "storage" | "drive";
export type SourceRef = { kind: SourceKind; ref: string; name: string };
export type SourceState = "full" | "partial" | "unread";
export type SourceStatus = {
  name: string;
  kind: SourceKind;
  state: SourceState;
  read: number;
  total: number;
  reason?: string;
};

/** Total characters of document text one reading sends to the AI, shared by all sources. */
export const TEXT_BUDGET = 120_000;
export const ALLOWED_UPLOAD = /\.(pdf|txt|md|csv)$/i;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

/** Adds sources without duplicates (same kind + ref), up to max; the rest are returned as dropped names. */
export function mergeRefs(prev: SourceRef[], added: SourceRef[], max = MAX_SOURCES) {
  const out = [...prev];
  const dropped: string[] = [];
  const duplicated: string[] = [];
  for (const s of added) {
    if (out.some((x) => x.kind === s.kind && x.ref === s.ref)) duplicated.push(s.name);
    else if (out.length < max) out.push(s);
    else dropped.push(s.name);
  }
  return { sources: out, dropped, duplicated };
}

/** Why an upload is refused before it starts, or null. */
export function uploadProblem(f: { name: string; size: number }): string | null {
  if (!ALLOWED_UPLOAD.test(f.name)) return `${f.name}: solo PDF, TXT, MD o CSV.`;
  if (f.size > MAX_UPLOAD_BYTES) return `${f.name} supera ${MAX_UPLOAD_MB} MB.`;
  return null;
}

/**
 * Fair split of the budget: short texts keep all they have, what they leave is shared among the long ones.
 * Returns the characters each text may use, in the same order.
 */
export function allotBudget(lengths: number[], budget = TEXT_BUDGET): number[] {
  const out = lengths.map(() => 0);
  let left = budget;
  let pending = lengths.map((_, i) => i).filter((i) => lengths[i] > 0);
  while (pending.length && left > 0) {
    const share = Math.floor(left / pending.length);
    if (share <= 0) break;
    const fits = pending.filter((i) => lengths[i] - out[i] <= share);
    if (!fits.length) {
      for (const i of pending) out[i] += share;
      left -= share * pending.length;
      break;
    }
    for (const i of fits) {
      left -= lengths[i] - out[i];
      out[i] = lengths[i];
    }
    pending = pending.filter((i) => !fits.includes(i));
  }
  return out;
}

export function statusOf(
  s: Pick<SourceRef, "name" | "kind">,
  read: number,
  total: number,
  reason?: string,
): SourceStatus {
  const state: SourceState = read <= 0 ? "unread" : read >= total ? "full" : "partial";
  return { name: s.name, kind: s.kind, state, read, total, ...(reason ? { reason } : {}) };
}

/** What the screen says about a finished source. */
export function statusLabel(s: SourceStatus): string {
  const k = (n: number) => n.toLocaleString("es-ES");
  if (s.state === "full") return "Leída entera";
  if (s.state === "partial") return `Leída en parte: ${k(s.read)} de ${k(s.total)} caracteres`;
  return `No leída${s.reason ? `: ${s.reason}` : ""}`;
}

/** Warning before launching: with n documents each one gets at least this many characters. */
export function perSourceFloor(n: number, budget = TEXT_BUDGET) {
  return n > 0 ? Math.floor(budget / n) : budget;
}

/** Storage path for an upload: <org>/<user>/<uuid>-<safe name>. */
export function storagePath(orgId: string, userId: string, id: string, name: string) {
  const safe = name.normalize("NFKD").replace(/[^\w.-]+/g, "_").slice(-120) || "documento";
  return `${orgId}/${userId}/${id}-${safe}`;
}

/** A storage ref the job may read: it must sit in the caller's own folder of that company. */
export function ownsPath(ref: string, orgId: string, userId: string) {
  const parts = ref.split("/");
  return parts.length === 3 && parts[0] === orgId && parts[1] === userId && !ref.includes("..");
}
