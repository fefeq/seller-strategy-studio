// Autopilot (server-only, admin client, always filtered by company): proposes (pending, with estimated cost) the paid research of new accounts, prepares the
// meetings of the next 36 hours and reviews accounts that are cooling down. Bounded per run (AUTOPILOT_LIMITS),
// each item marked so it is done once; web research goes through the orchestrator budget (automatic work pauses
// at 100 %). Nokko only writes empty fields and suggestions: nothing is sent or overwritten.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { accountsToResearch, coolingAccounts, meetingsToPrep, weekKey } from "@/lib/autopilot";
import { safeErrorLog } from "@/lib/agent/safe-error-log";
import { autopilotSpendProposals } from "@/lib/autopilot";
import { errorText } from "@/lib/errors";
import { runAutopilotAction } from "@/lib/autopilot-threshold";
import { spendEstimateLine, spendEstimate, withEstimate } from "@/lib/agent/spend-confirm";
import { decidePending } from "@/lib/agent.functions";
import type { Json } from "@/integrations/supabase/types";

type Admin = SupabaseClient<Database>;
const DAY = 86_400_000;

export async function autopilotForOrg(db: Admin, orgId: string, now = new Date()) {
  const out = { researched: 0, prepped: 0, cooling: 0, notes: [] as string[] };
  const actor =
    (
      await db
        .from("org_members")
        .select("user_id")
        .eq("org_id", orgId)
        .eq("role", "owner")
        .limit(1)
        .maybeSingle()
    ).data?.user_id ?? "";
  const { data: org } = await db
    .from("organizations")
    .select("currency")
    .eq("id", orgId)
    .maybeSingle();
  const ctx = { db, orgId, userId: actor, roles: ["owner"], currency: org?.currency ?? "EUR" };
  const settings = await db.from("lead_settings").select("autopilot_action_threshold").eq("org_id", orgId).maybeSingle();
  const threshold = settings.error ? 0 : Number(settings.data?.autopilot_action_threshold ?? 0);
  async function gated(tool: string, args: Record<string, string>, key: string, userId: string, label: string) {
    if (!userId) return "pending";
    // spendEstimateLine is the same visible estimate used by the new-account proposals.
    const line = await spendEstimateLine(db, orgId, tool);
    const estimate = await spendEstimate(db, orgId, tool, ctx.currency);
    return runAutopilotAction(estimate.value, threshold, {
      propose: async () => {
        const { data, error } = await db.from("agent_pending_actions").insert({ org_id: orgId, user_id: userId,
          tool, args: { ...args, autopilot_key: key } as Json, source: "autopilot",
          summary: withEstimate(`Piloto automático · ${label}`, tool, line).slice(0, 500),
        }).select("id").single();
        if (error?.code === "23505") return null;
        if (error) throw error;
        if (!data?.id) throw new Error("No se pudo reservar la acción pendiente. Reintenta.");
        return data.id;
      },
      execute: async id => {
        const roles = await db.from("org_members").select("role").eq("org_id", orgId).eq("user_id", userId);
        if (roles.error || !roles.data?.length) throw new Error("La persona ya no pertenece a esta empresa.");
        const result = await decidePending({ ...ctx, userId, roles: roles.data.map(r => r.role) }, id, "confirm");
        if (result.status !== "confirmed") throw new Error(result.result || "La preparación no se completó.");
      },
    });
  }

  // 1 · New accounts: complete empty fields and research the web into the empty parts of the account plan.
  try {
    const { data: accs } = await db
      .from("accounts")
      .select("id,name,domain,created_at,auto_researched_at,owner_id")
      .eq("org_id", orgId)
      .is("auto_researched_at", null)
      .gte("created_at", new Date(now.getTime() - 14 * DAY).toISOString())
      .limit(50);
    const autoEnrich =
      (await db.from("lead_settings").select("auto_enrich").eq("org_id", orgId).maybeSingle()).data
        ?.auto_enrich !== false;

    for (const a of accountsToResearch(accs ?? [], now)) {
      const acc = (accs ?? []).find((x) => x.id === a.id);
      if (!acc) continue;
      // Spending is never automatic: each paid step becomes a pending action with its estimated cost,
      // run only when the person confirms it (decidePending). No permanent per-company permission.
      const proposals = autopilotSpendProposals(acc, autoEnrich);
      const owner = acc.owner_id ?? actor;
      const lines: string[] = [];
      let executed = 0;
      for (const pr of proposals) {
        try {
          const state = await gated(pr.tool, { account_id: a.id }, `new-account:${a.id}:${pr.tool}`, owner, `${pr.label} «${acc.name}»`);
          if (state === "executed") executed++;
          lines.push(`${pr.label}: ${state === "executed" ? "ejecutado" : "pendiente"}.`);
        } catch (e) {
          console.error("autopilot proposal", safeErrorLog(e));
          // NK-0162: the visible text never carries the raw error; the proposal could not be left pending.
          if (pr.tool === "research_account") lines.push(`No pude investigar la web: ${errorText(e)}`);
        }
      }
      if (executed === proposals.length && executed > 0) {
        const marked = await db.from("accounts").update({ auto_researched_at: now.toISOString() }).eq("org_id", orgId).eq("id", a.id);
        if (marked.error) throw marked.error;
        out.researched++;
        continue;
      }
      if (!lines.length) continue;
      await db.from("suggestions").upsert(
        {
          org_id: orgId,
          detector: "account_researched",
          dedupe_key: `account_researched:${a.id}`,
          priority: 3,
          title: `Cuenta nueva ${acc.name}: investigación pendiente de tu confirmación`.slice(0, 200),
          body: `Confirma las acciones pendientes en Hoy → Pendientes del agente:\n${lines.join("\n")}`.slice(0, 4000),
          link: `/accounts/${a.id}`,
          user_id: acc.owner_id,
        },
        { onConflict: "org_id,dedupe_key", ignoreDuplicates: true },
      );
    }
  } catch (e) {
    out.notes.push(`Investigación: ${(e as Error).message}`);
  }

  // 2 · Meetings of the next 36 hours without call prep: prepared the day before.
  try {
    const { data: ms } = await db
      .from("meetings")
      .select("id,title,scheduled_at,ai_brief,account_id,created_by")
      .eq("org_id", orgId)
      .gt("scheduled_at", now.toISOString())
      .lte("scheduled_at", new Date(now.getTime() + 1.5 * DAY).toISOString())
      .limit(50);
    for (const m of meetingsToPrep(ms ?? [], now)) {
      const meta = (ms ?? []).find(x => x.id === m.id);
      if (!meta) continue;
      try {
        const state = await gated("autopilot_prepare_meeting", { meeting_id: m.id }, `meeting:${m.id}`, meta.created_by ?? actor, `Preparar reunión «${meta.title}»`);
        if (state === "executed") out.prepped++;
      } catch (e) {
        out.notes.push(`Reunión ${meta.title}: ${errorText(e)}`);
      }
    }
  } catch (e) {
    out.notes.push(`Reuniones: ${(e as Error).message}`);
  }

  // 3 · Accounts that matter and went quiet: one review per account and week, with a proposed next move.
  try {
    const since = new Date(now.getTime() - 180 * DAY).toISOString();
    const [accs, touches, calls, meetings, deals, sla] = await Promise.all([
      db
        .from("accounts")
        .select("id,name,is_target,tier,owner_id,created_at")
        .eq("org_id", orgId)
        .limit(2000),
      db
        .from("account_touches")
        .select("account_id,occurred_at")
        .eq("org_id", orgId)
        .gte("occurred_at", since)
        .limit(5000),
      db
        .from("calls")
        .select("account_id,occurred_at")
        .eq("org_id", orgId)
        .gte("occurred_at", since)
        .limit(5000),
      db
        .from("meetings")
        .select("account_id,scheduled_at")
        .eq("org_id", orgId)
        .gte("scheduled_at", since)
        .limit(5000),
      db
        .from("deals")
        .select("account_id,name,amount,stage,updated_at")
        .eq("org_id", orgId)
        .limit(5000),
      db.from("lead_settings").select("sla").eq("org_id", orgId).maybeSingle(),
    ]);
    const { data: st } = await db.from("deal_stages").select("key,kind").eq("org_id", orgId);
    const closed = new Set(
      (st ?? [])
        .filter((s) => s.kind !== "open")
        .map((s) => s.key)
        .concat(["won", "lost"]),
    );
    const allDeals = deals.data ?? [];
    const cold = coolingAccounts(
      {
        accounts: accs.data ?? [],
        activity: [
          ...(touches.data ?? []).map((t) => ({ account_id: t.account_id, at: t.occurred_at })),
          ...(calls.data ?? []).map((c) => ({ account_id: c.account_id, at: c.occurred_at })),
          ...(meetings.data ?? []).map((m) => ({ account_id: m.account_id, at: m.scheduled_at })),
          ...allDeals.map((d) => ({ account_id: d.account_id, at: d.updated_at })),
        ],
        openDeals: allDeals.filter((d) => !closed.has(d.stage)),
        thresholdDays:
          Number((sla.data?.sla as Record<string, unknown> | null)?.["cooling_account_days"]) ||
          null,
      },
      now,
    );
    const week = weekKey(now);
    const { data: done } = await db
      .from("suggestions")
      .select("dedupe_key")
      .eq("org_id", orgId)
      .in(
        "dedupe_key",
        cold.map((c) => `account_cooling:${c.id}:${week}`),
      );
    const doneKeys = new Set((done ?? []).map((d) => d.dedupe_key));
    for (const c of cold.filter(x => !doneKeys.has(`account_cooling:${x.id}:${week}`))) {
      const state = await gated("autopilot_review_account", { account_id: c.id, week }, `cooling:${c.id}:${week}`, c.owner_id ?? actor, `Repasar cuenta «${c.name}»`);
      if (state === "executed") out.cooling++;
    }
  } catch (e) {
    out.notes.push(`Cuentas que se enfrían: ${(e as Error).message}`);
  }

  if (out.notes.length) console.warn("autopilot notes", orgId, { count: out.notes.length });
  return out;
}
