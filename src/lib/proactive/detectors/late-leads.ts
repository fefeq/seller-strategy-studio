import { DAY, isoDate, type Detector } from "../types";
import { DEFAULT_LEAD_SLA, delayText, leadDelay, leadStageLabel } from "@/lib/lead-funnel";
import { followupStatus } from "@/lib/followup";

/**
 * Lead stuck past its stage limit or with an overdue follow-up → propose a follow-up task for tomorrow.
 * While the day-3/7/14 sequence runs on a contacted lead, that rule owns it (one voice per lead).
 */
export const lateLeads: Detector = (s) => {
  const sla = s.leadSla ?? DEFAULT_LEAD_SLA;
  return (s.leads ?? []).flatMap((l) => {
    const d = leadDelay(l, sla, s.now);
    if (!d.late) return [];
    const seq = followupStatus({ stage: l.stage, contacted_at: l.contacted_at ?? null, next_step_at: l.next_step_at, company: l.company }, s.now);
    if (seq.due || seq.reason === "scheduled" || (seq.next && seq.reason == null)) return [];
    const severe = d.reasons.length === 2 || (d.limit != null && d.daysInStage > d.limit * 2);
    return [{
      detector: "late_lead",
      // Stable while the lead stays in the same stage, so a dismissed one does not come back.
      dedupe_key: `late_lead:${l.id}:${l.stage}:${l.stage_entered_at.slice(0, 10)}`,
      priority: severe ? 1 : 2,
      title: `El lead ${l.company} va con retraso en ${leadStageLabel(l.stage)}`,
      body: `${delayText(d)}. Te propongo una tarea para moverlo mañana.`,
      link: "/leads",
      action: { tool: "create_task", args: { title: `Seguimiento lead ${l.company} (${leadStageLabel(l.stage)})`, due_date: isoDate(new Date(s.now.getTime() + DAY)), ...(l.account_id ? { account_id: l.account_id } : {}), owner_id: l.owner_id } },
      user_id: l.owner_id,
    }];
  });
};
