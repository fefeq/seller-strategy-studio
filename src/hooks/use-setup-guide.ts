import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { assertSessionOpen, retryWhileOpen, useSessionQuiet } from "@/lib/session-ending";
import { useSetup } from "@/hooks/use-setup";
import { invalidateSetup } from "@/hooks/setup-invalidation";
import { loadSetupGuideExtras, loadSetupSnoozes } from "@/lib/org-data";
import { errorText } from "@/lib/errors";
import {
  canCompleteStep,
  guideState,
  nextFor,
  nextMessage,
  nudgeDue,
  parseSnoozeDate,
  reopenedSteps,
  reopenedText,
  type GuideMember,
  type Snooze,
} from "@/lib/setup-guide";

/** Session-scoped flag: each place (Inicio, the agent) shows the offer once per session, until the person acts on it or closes it. */
export type OfferScope = "home" | "agent";
const nudgeKey = (orgId: string | undefined, scope: OfferScope) =>
  `nokko-guide-${scope}:${orgId ?? ""}`;
export function nudgeSeen(orgId: string | undefined, scope: OfferScope): boolean {
  try {
    return sessionStorage.getItem(nudgeKey(orgId, scope)) === "1";
  } catch {
    return false;
  }
}
export function markNudgeSeen(orgId: string | undefined, scope: OfferScope) {
  try {
    sessionStorage.setItem(nudgeKey(orgId, scope), "1");
  } catch {
    /* sessionStorage can be blocked: the offer may repeat, never break */
  }
}

const NO_SNOOZES: Snooze[] = [];

/**
 * The guide of «Configura tu estrategia» for the signed-in person: state per step, next step, who can do what, snooze and nudge.
 * It is mounted in the sidebar of every screen, so it queries only what the screen needs and only while steps are pending:
 * nothing once the strategy is complete, the snoozes (one query) to pick the next step, the activity of the data (seven more)
 * only with `activity` (Inicio's nudge), and the members only when a pending step is not the person's to complete.
 */
export function useSetupGuide({ activity = false }: { activity?: boolean } = {}) {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const setup = useSetup();
  const orgId = me?.currentOrg?.org_id;
  const userId = me?.user.id;
  const role = me?.roles[0] ?? null;
  // NK-0150: off while the person signs out or the tab changes account, so no refetch goes out with the previous user's ids.
  const quiet = useSessionQuiet();

  const pendingIds = setup.data
    ? setup.data.status.items.filter((i) => !i.done).map((i) => i.id)
    : [];
  const hasPending = pendingIds.length > 0;
  const needsMembers = pendingIds.some((id) => !canCompleteStep(id, role));

  const snoozesQ = useQuery({
    queryKey: ["setup-guide", "snoozes", orgId],
    enabled: !!orgId && hasPending && !quiet,
    retry: retryWhileOpen(2),
    queryFn: ({ signal }) => {
      assertSessionOpen();
      return loadSetupSnoozes(supabase, orgId!, signal);
    },
  });
  const activityQ = useQuery({
    queryKey: ["setup-guide", "activity", orgId],
    enabled: !!orgId && hasPending && activity && !quiet,
    retry: retryWhileOpen(2),
    queryFn: ({ signal }) => {
      assertSessionOpen();
      return loadSetupGuideExtras(supabase, orgId!, signal);
    },
  });
  const membersQ = useQuery({
    queryKey: ["setup-guide-members", orgId],
    enabled: !!orgId && needsMembers && !quiet,
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }): Promise<GuideMember[]> => {
      assertSessionOpen();
      const { data: rows } = await supabase
        .from("org_members")
        .select("user_id,role")
        .eq("org_id", orgId!)
        .abortSignal(signal);
      const ids = (rows ?? []).map((r) => r.user_id);
      const { data: profiles } = ids.length
        ? await supabase.from("profiles").select("id,full_name").in("id", ids).abortSignal(signal)
        : { data: [] as { id: string; full_name: string | null }[] };
      const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
      return (rows ?? []).map((r) => ({
        user_id: r.user_id,
        role: String(r.role),
        name: names.get(r.user_id) ?? null,
      }));
    },
  });
  const extras = {
    isError: snoozesQ.isError || activityQ.isError,
    isLoading: hasPending && (snoozesQ.isLoading || activityQ.isLoading),
    dataUpdatedAt: Math.max(snoozesQ.dataUpdatedAt, activityQ.dataUpdatedAt),
    snoozes: snoozesQ.data ?? NO_SNOOZES,
    activityAt: activityQ.data?.activityAt ?? null,
  };

  const now = useMemo(() => new Date(), [setup.dataUpdatedAt, extras.dataUpdatedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  // Until the snoozes arrive a snoozed step would flash as the next one, so there is no guide yet.
  const guide = useMemo(
    () =>
      setup.data && !(hasPending && snoozesQ.isPending)
        ? guideState(setup.data.data, extras.snoozes, now)
        : null,
    [setup.data, extras.snoozes, now, hasPending, snoozesQ.isPending],
  );
  const members = membersQ.data ?? [];

  // The step the person just finished (here or in any screen): shown as «Hecho: …» with the next step. Cleared when they act on it.
  const doneRef = useRef<Set<string> | null>(null);
  const [justDone, setJustDone] = useState<string | null>(null);
  useEffect(() => {
    if (!guide) return;
    const done = new Set(guide.steps.filter((s) => s.state === "done").map((s) => s.id));
    const before = doneRef.current;
    doneRef.current = done;
    if (!before) return;
    const added = [...done].filter((id) => !before.has(id));
    const reopened = reopenedSteps(before, guide);
    if (added.length) setJustDone(added[added.length - 1]!);
    else if (reopened.length) setJustDone(null);
    // CA-5: an edit that un-completes a step says so. The fixed id makes the copies of this hook in other components share one notice.
    if (reopened.length)
      toast.info(reopenedText(reopened), {
        id: `setup-reopened:${reopened.map((s) => s.id).join(",")}`,
      });
  }, [guide]);

  const message = guide ? nextMessage(guide, role, justDone, members) : null;
  const nudge = !!guide && nudgeDue(guide, role, extras.activityAt, now);
  // Last known state stays on screen when a refresh fails; the caller says so.
  const stale = (setup.isError || extras.isError) && !!guide;

  const refresh = useCallback(() => invalidateSetup(qc), [qc]);

  /** CA-7: postpone a step until a day the person picks. Only a role that can complete the step may postpone it. created_at is rewritten on every postponement: it is the time of the person's last act on the step, which the nudge counts as activity (M-1). */
  const snooze = useCallback(
    async (stepId: string, day: string) => {
      if (!orgId || !userId) return false;
      if (!canCompleteStep(stepId, role)) {
        toast.error("Tu rol no puede posponer este paso.");
        return false;
      }
      const until = parseSnoozeDate(day, new Date());
      if (!until) {
        toast.error("Elige una fecha futura.");
        return false;
      }
      const { error } = await supabase.from("setup_step_snoozes").upsert(
        {
          org_id: orgId,
          step_id: stepId,
          snoozed_until: until,
          snoozed_by: userId,
          created_at: new Date().toISOString(),
        },
        { onConflict: "org_id,step_id" },
      );
      if (error) {
        toast.error(errorText(error));
        return false;
      }
      setJustDone(null);
      await refresh();
      return true;
    },
    [orgId, userId, role, refresh],
  );

  // Clearing a postponement ends it now instead of deleting the row: the detector keys the returning suggestion on the day it ended.
  const unsnooze = useCallback(
    async (stepId: string) => {
      if (!orgId || !userId) return;
      const { error } = await supabase
        .from("setup_step_snoozes")
        .update({
          snoozed_until: new Date().toISOString(),
          snoozed_by: userId,
          created_at: new Date().toISOString(),
        })
        .eq("org_id", orgId)
        .eq("step_id", stepId);
      if (error) toast.error(errorText(error));
      else await refresh();
    },
    [orgId, userId, refresh],
  );

  const nextStep = guide ? nextFor(guide, role) : null;

  return {
    orgId,
    guide,
    nextStep,
    message,
    role,
    members,
    nudge,
    stale,
    isLoading: setup.isLoading || extras.isLoading,
    justDone,
    clearJustDone: () => setJustDone(null),
    snooze,
    unsnooze,
    refresh,
  };
}
