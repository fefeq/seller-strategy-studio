// Which Inngest events a lead's current state emits (pure, tested): new and not enriched → enrichment;
// always its stage (cancels the follow-up wait when it leaves Contactado); in Contactado → the sequence.
import { EV, type NokkoEvent } from "@/lib/inngest/events";

export function leadEvents(orgId: string, l: { id: string; stage: string; contacted_at: string | null; enriched_at: string | null; created_at: string }, now = new Date()): NokkoEvent[] {
  const out: NokkoEvent[] = [];
  if (!l.enriched_at && now.getTime() - new Date(l.created_at).getTime() < 48 * 3_600_000) out.push({ name: EV.leadCreated, data: { org_id: orgId, lead_id: l.id } });
  out.push({ name: EV.leadChanged, data: { org_id: orgId, lead_id: l.id, stage: l.stage } });
  if (l.stage === "contacted" && l.contacted_at) out.push({ name: EV.leadContacted, data: { org_id: orgId, lead_id: l.id, contacted_at: l.contacted_at } });
  return out;
}
