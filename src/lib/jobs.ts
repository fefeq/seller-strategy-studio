// Background jobs → notices (pure; tested). How a finished task reads in the notification centre.
import { ENRICH_LABEL, type EnrichField } from "@/lib/clay";

export type JobNotice = { title: string; body: string | null; link: string; needs_decision: boolean };

type Change = { field: EnrichField; empty: boolean; proposed: string | null };
type CompleteOut = { changes: Change[]; found: boolean; sources: string; blocked: string | null };

const list = (fields: EnrichField[]) => fields.map((f) => ENRICH_LABEL[f]?.toLowerCase() ?? f).join(", ");

/** «Completar datos» run in the background: empty fields were written; differing ones wait for a person. */
export function completeNotice(account: { id: string; name: string }, out: CompleteOut, written: EnrichField[]): JobNotice {
  const link = `/accounts/${account.id}`;
  if (out.blocked) return { title: `No he completado ${account.name}`, body: out.blocked, link, needs_decision: false };
  const review = out.changes.filter((c) => !c.empty && c.proposed).map((c) => c.field);
  if (!out.found || (!written.length && !review.length))
    return { title: `${account.name}: no encontré datos nuevos`, body: out.sources || null, link, needs_decision: false };
  const parts: string[] = [];
  if (written.length) parts.push(`Completé ${list(written)}`);
  if (review.length) parts.push(`${written.length ? "y hay" : "Hay"} ${review.length === 1 ? "un dato distinto" : `${review.length} datos distintos`} a lo que tenías (${list(review)}): revísalo`);
  return { title: `${account.name}: ${parts.join(" ")}.`, body: out.sources || null, link, needs_decision: review.length > 0 };
}

/** A second click on the same task for the same record reuses the one already running. */
export function activeJobFor<J extends { kind: string; target_id: string | null; status: string }>(jobs: J[], kind: string, targetId: string): J | null {
  return jobs.find((j) => j.kind === kind && j.target_id === targetId && (j.status === "queued" || j.status === "running")) ?? null;
}

export const unreadCount = (rows: { read_at: string | null }[]) => rows.filter((r) => !r.read_at).length;
