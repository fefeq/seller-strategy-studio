// Org-scoped loaders. Every query filters org_id explicitly so they are safe with
// both the user's RLS client and the privileged server client (cron, Telegram).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { quarterOf } from "@/lib/metrics";
import type { SetupData } from "@/lib/setup-schema";
import type { FitKeyData, Snapshot } from "@/lib/proactive/types";
import { disabledPlayIds } from "@/lib/plays/gating";
import { CATALOG } from "@/lib/plays/catalog";
import { reopenable } from "@/lib/plays/reopen";
import { readStaleDays } from "@/lib/stale";
import { readSla } from "@/lib/lead-funnel";
import { NOTES_UNTIL_MS } from "@/lib/call-notes";
import { fetchAll } from "@/lib/fetch-all";
import type { Json } from "@/integrations/supabase/types";
import { jsonObject } from "@/lib/json";
import { latestActivity, type Snooze } from "@/lib/setup-guide";

export type Db = SupabaseClient<Database>;

export async function loadSetupData(db: Db, orgId: string): Promise<SetupData> {
  const [org, seg, icp, pos, pil, quo, acc, deals] = await Promise.all([
    db.from("organizations").select("currency").eq("id", orgId).maybeSingle(),
    db.from("segments").select("name,acv_min,acv_max,win_rate_target,ae_quota").eq("org_id", orgId),
    db.from("icp_profiles").select("industries,company_size,why_fit,anti_icp").eq("org_id", orgId),
    db.from("positioning").select("*").eq("org_id", orgId).limit(1).maybeSingle(),
    db.from("messaging_pillars").select("title,message").eq("org_id", orgId),
    db.from("quotas").select("period,amount").eq("org_id", orgId),
    db.from("accounts").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    db.from("deals").select("id", { count: "exact", head: true }).eq("org_id", orgId),
  ]);
  // A failed query is not an empty table: with empty data every step would read as pending and the guide would tell the person to redo
  // work they did. Throwing lets the screen keep the last known state (useSetup) and the agent say it could not read.
  for (const r of [org, seg, icp, pos, pil, quo, acc, deals])
    if (r.error) throw new Error(r.error.message);
  return {
    currency: org.data?.currency ?? null,
    segments: (seg.data ?? []) as SetupData["segments"],
    icps: icp.data ?? [],
    positioning: pos.data
      ? (({ copy_status: _copy, field_sources: _fs, last_human_edit_at: _edit, ...p }) => p)(
          pos.data,
        )
      : null,
    pillars: pil.data ?? [],
    quotas: (quo.data ?? []).map((q) => ({ period: q.period, amount: Number(q.amount) })),
    accounts: acc.count ?? 0,
    deals: deals.count ?? 0,
    quarter: quarterOf(new Date()),
  };
}

/** Extra reads for the strategic rules (F1). A failed read leaves its list empty: a rule never fires on data it could not read. */
async function loadStrategyData(
  db: Db,
  orgId: string,
): Promise<import("@/lib/proactive/types").StrategyData> {
  const [icps, accounts, deals, history, products, lines, costs, budgets, experiments] =
    await Promise.all([
      db
        .from("icp_profiles")
        .select(
          "id,name,industries,company_size,geography,countries,anti_icp,segment_id,created_at",
        )
        .eq("org_id", orgId),
      fetchAll((a, b) =>
        db
          .from("accounts")
          .select("id,name,industry,size,country,segment_id,tier")
          .eq("org_id", orgId)
          .order("id")
          .range(a, b),
      ).then((r) => ({ data: r.rows })),
      fetchAll((a, b) =>
        db
          .from("deals")
          .select(
            "id,name,stage,amount,account_id,segment_id,close_date,created_at,closed_at,updated_at,lost_reason,lost_competitor",
          )
          .eq("org_id", orgId)
          .order("id")
          .range(a, b),
      ).then((r) => ({ data: r.rows })),
      fetchAll((a, b) =>
        db
          .from("deal_stage_history")
          .select("deal_id,from_stage,to_stage,changed_at")
          .eq("org_id", orgId)
          .order("changed_at")
          .range(a, b),
      ).then((r) => ({ data: r.rows })),
      db.from("products").select("id,name,active,created_at").eq("org_id", orgId),
      fetchAll((a, b) =>
        db
          .from("deal_lines")
          .select("id,deal_id,product_id,name,discount_pct,unit_price,created_at")
          .eq("org_id", orgId)
          .order("id")
          .range(a, b),
      ).then((r) => ({ data: r.rows })),
      db.from("cac_costs").select("segment_id,period").eq("org_id", orgId),
      db
        .from("segment_budget_quarters")
        .select("segment_id,period,plan_revenue")
        .eq("org_id", orgId),
      db
        .from("gtm_experiments")
        .select(
          "id,title,status,hypothesis,metric,target,result,learning,success_threshold,close_rule,review_on,ends_on,decision",
        )
        .eq("org_id", orgId)
        .eq("status", "running"),
    ]);
  return {
    icps: (icps.data ?? []).map((i) => ({ ...i, countries: i.countries ?? [] })),
    accounts: accounts.data ?? [],
    deals: deals.data ?? [],
    history: history.data ?? [],
    products: products.data ?? [],
    lines: (lines.data ?? []).map((l) => ({
      ...l,
      discount_pct: Number(l.discount_pct),
      unit_price: Number(l.unit_price),
    })),
    costs: costs.data ?? [],
    budgets: budgets.data ?? [],
    experiments: experiments.data ?? [],
  };
}

/**
 * Snoozed setup steps of the company and, only when asked, the latest change a person made in the data the setup steps read
 * (SDD strategy-setup-guided-next-step). The activity needs one query per table, so screens that don't nudge leave it out.
 */
async function readSetupGuide(
  db: Db,
  orgId: string,
  withActivity: boolean,
  signal?: AbortSignal, // NK-0150: a cancelled query (sign-out, account switch) aborts reads that have not left yet
): Promise<{ snoozes: Snooze[]; activityAt: string | null }> {
  // Only changes a signed-in person made (migration 0064): enrichments, syncs and triggers do not move last_human_edit_at. Empty = unknown.
  const newest = (
    table:
      | "positioning"
      | "segments"
      | "quotas"
      | "accounts"
      | "deals"
      | "icp_profiles"
      | "messaging_pillars",
  ) => {
    const q = db
      .from(table)
      .select("last_human_edit_at")
      .eq("org_id", orgId)
      .not("last_human_edit_at", "is", null)
      .order("last_human_edit_at", { ascending: false })
      .limit(1);
    return (signal ? q.abortSignal(signal) : q).maybeSingle().then((r) => {
      if (r.error) throw new Error(r.error.message);
      return r.data?.last_human_edit_at ?? null;
    });
  };
  const snoozeQuery = db
    .from("setup_step_snoozes")
    .select("step_id,snoozed_until,created_at")
    .eq("org_id", orgId);
  const signedUpAt = () => {
    const q = db.from("organizations").select("created_at").eq("id", orgId);
    return (signal ? q.abortSignal(signal) : q).maybeSingle().then((r) => {
      if (r.error) throw new Error(r.error.message);
      return r.data?.created_at ?? null;
    });
  };
  const [snoozes, ...stamps] = await Promise.all([
    signal ? snoozeQuery.abortSignal(signal) : snoozeQuery,
    ...(withActivity
      ? [
          signedUpAt(),
          newest("positioning"),
          newest("segments"),
          newest("quotas"),
          newest("accounts"),
          newest("deals"),
          newest("icp_profiles"),
          newest("messaging_pillars"),
        ]
      : []),
  ]);
  if (snoozes.error) throw new Error(snoozes.error.message); // a failed read is not «nothing postponed»
  const rows = snoozes.data ?? [];
  // Postponing a step is the person's last act on the guide, so it counts as activity.
  // stamps[0] is the company's sign-up date: the fallback when no person ever edited anything the steps read (existing rows have no
  // last_human_edit_at until someone edits them), so a company that never came back still gets the nudge.
  const [signedUp, ...edits] = stamps;
  const activityAt = withActivity
    ? (latestActivity([...edits, ...rows.map((r) => r.created_at)]) ?? signedUp ?? null)
    : null;
  return {
    snoozes: rows.map((r) => ({ step_id: r.step_id, snoozed_until: r.snoozed_until })),
    activityAt,
  };
}

/** Just the snoozes: one query. Enough to pick the next step. */
export const loadSetupSnoozes = async (
  db: Db,
  orgId: string,
  signal?: AbortSignal,
): Promise<Snooze[]> => (await readSetupGuide(db, orgId, false, signal)).snoozes;
/** Snoozes plus the latest activity (eight queries): for the inactivity nudge and the proactive snapshot. */
export const loadSetupGuideExtras = (db: Db, orgId: string, signal?: AbortSignal) =>
  readSetupGuide(db, orgId, true, signal);

/** `fitKey: false` skips the domain-proposal data (extra queries) for callers that never use it, like the per-lead follow-up. */
export async function loadSnapshot(
  db: Db,
  orgId: string,
  now = new Date(),
  opts: { fitKey?: boolean } = {},
): Promise<Snapshot> {
  const [
    setup,
    deals,
    meetings,
    accounts,
    sh,
    regs,
    trials,
    segs,
    leads,
    leadSettings,
    stages,
    members,
    signals,
    usage,
    guide,
    playStates,
    onboarding,
  ] = await Promise.all([
    loadSetupData(db, orgId),
    fetchAll((a, b) =>
      db
        .from("deals")
        .select(
          "id,name,stage,amount,close_date,updated_at,created_at,closed_at,segment_id,owner_id,meddpicc,account_id",
        )
        .eq("org_id", orgId)
        .order("id")
        .range(a, b),
    ).then((r) => ({ data: r.rows, error: null })),
    db
      .from("meetings")
      .select("id,title,scheduled_at,ai_brief,account_id,created_by,notes,call_notes")
      .eq("org_id", orgId)
      .gte("scheduled_at", new Date(now.getTime() - NOTES_UNTIL_MS).toISOString()),
    fetchAll((a, b) =>
      db
        .from("accounts")
        .select("id,name,is_target,owner_id,created_at")
        .eq("org_id", orgId)
        .order("id")
        .range(a, b),
    ).then((r) => ({ data: r.rows, error: null })),
    db.from("stakeholders").select("account_id,buying_role").eq("org_id", orgId),
    db.from("deal_registrations").select("id,account_name,status,expires_at").eq("org_id", orgId),
    db
      .from("trials")
      .select("segment_id,signed_up_at,activated_at,converted_at,mrr")
      .eq("org_id", orgId),
    db
      .from("segments")
      .select("id,name,acv_min,acv_max,win_rate_target,cac_target,gross_margin_pct,payback_months")
      .eq("org_id", orgId),
    fetchAll((a, b) =>
      db
        .from("leads")
        .select(
          "id,company,stage,stage_entered_at,next_step_at,owner_id,account_id,contacted_at,contact_name,email",
        )
        .eq("org_id", orgId)
        .in("stage", ["new", "contacted", "mql", "sql"])
        .order("id")
        .range(a, b),
    ).then((r) => ({ data: r.rows, error: null })),
    db.from("lead_settings").select("sla").eq("org_id", orgId).maybeSingle(),
    db
      .from("deal_stages")
      .select("key,label,position,kind,board_group,probability")
      .eq("org_id", orgId),
    db.from("org_members").select("user_id,role").eq("org_id", orgId),
    db
      .from("account_signals")
      .select("id,account_id,title,kind,summary,relevance,url,found_at")
      .eq("org_id", orgId)
      .gte("found_at", new Date(now.getTime() - 14 * 86_400_000).toISOString())
      .limit(200),
    db
      .from("product_usage")
      .select("domain,account_id,active_users_7d,active_users_prev_7d")
      .eq("org_id", orgId)
      .order("active_users_7d", { ascending: false })
      .limit(500),
    loadSetupGuideExtras(db, orgId),
    db.from("play_states").select("play_id,enabled").eq("org_id", orgId),
    db.from("onboarding_sessions").select("user_id,step,updated_at").eq("org_id", orgId),
  ]);
  // Plays the company paused. A failed read (say, the table is not migrated yet) leaves every rule on, exactly as before the Plays GTM.
  const disabledPlays = disabledPlayIds(playStates.error ? [] : (playStates.data ?? []));
  const strategy = await loadStrategyData(db, orgId);
  const fitKey = opts.fitKey === false ? undefined : await loadFitKeyData(db, orgId);
  // NK-0173: effective verification state of each lead's email, for the draft gate. A failed read
  // leaves the state out: the gate then treats the address as unverified (marked), never blocked.
  const leadRows = leads.data ?? [];
  const leadEmails = [
    ...new Set(
      leadRows.map((l) => l.email?.trim().toLowerCase()).filter((e): e is string => !!e),
    ),
  ];
  let leadEmailStatus = new Map<string, import("@/lib/email-verification").EmailStatus>();
  if (leadEmails.length) {
    const { data: vrows, error: vErr } = await db
      .from("email_verifications")
      .select("email,status,checked_at")
      .eq("org_id", orgId)
      .in("email", leadEmails);
    if (!vErr) {
      const { effectiveEmailStatus } = await import("@/lib/email-verification");
      leadEmailStatus = new Map(
        leadEmails.map((e) => {
          // Narrow cast: PostgREST types status as string; the table CHECK limits it to EmailStatus.
          const row = ((vrows ?? []).find((v) => v.email === e) ??
            null) as import("@/lib/email-verification").EmailVerification | null;
          return [e, effectiveEmailStatus(e, row, now)];
        }),
      );
    }
  }
  return {
    now,
    orgId,
    setup,
    strategy,
    ...(fitKey ? { fitKey } : {}),
    ...(disabledPlays.length ? { disabledPlays } : {}),
    // Each person's onboarding row (the person's client sees only theirs). A failed read leaves the field out: no reminder, like play_states.
    ...(onboarding.error ? {} : { onboarding: onboarding.data ?? [] }),
    setupSnoozes: guide.snoozes,
    setupActivityAt: guide.activityAt,
    stages: (stages.data ?? []) as import("@/lib/stages").Stage[],
    deals: (deals.data ?? []).map((d) => ({ ...d, meddpicc: jsonObject(d.meddpicc) })),
    meetings: meetings.data ?? [],
    accounts: accounts.data ?? [],
    members: (members.data ?? []).map((m) => ({ user_id: m.user_id, role: String(m.role) })),
    stakeholders: sh.data ?? [],
    registrations: regs.data ?? [],
    trials: trials.data ?? [],
    segments: segs.data ?? [],
    leads: leadRows.map((l) => ({
      ...l,
      email_status: l.email?.trim()
        ? leadEmailStatus.get(l.email.trim().toLowerCase())
        : undefined,
    })),
    leadSla: readSla(leadSettings.data?.sla),
    cycleDeals: (deals.data ?? []).map((d) => ({ ...d, meddpicc: jsonObject(d.meddpicc) })),
    cycleSegments: segs.data ?? [],
    staleDays: readStaleDays(leadSettings.data?.sla),
    signals: signals.data ?? [],
    usage: usage.data ?? [],
  };
}

/** Account domains and the emails of contacts linked to an account (people, stakeholders, open leads), paged and always by company. */
async function loadFitKeyData(db: Db, orgId: string): Promise<FitKeyData> {
  const [accounts, people, stakeholders, leads] = await Promise.all([
    fetchAll((a, b) =>
      db.from("accounts").select("id,domain").eq("org_id", orgId).order("id").range(a, b),
    ),
    fetchAll((a, b) =>
      db
        .from("people")
        .select("id,account_id,email")
        .eq("org_id", orgId)
        .not("account_id", "is", null)
        .not("email", "is", null)
        .order("id")
        .range(a, b),
    ),
    fetchAll((a, b) =>
      db
        .from("stakeholders")
        .select("id,account_id,email")
        .eq("org_id", orgId)
        .not("email", "is", null)
        .order("id")
        .range(a, b),
    ),
    fetchAll((a, b) =>
      db
        .from("leads")
        .select("id,account_id,email")
        .eq("org_id", orgId)
        .in("stage", ["new", "contacted", "mql", "sql"])
        .not("account_id", "is", null)
        .not("email", "is", null)
        .order("id")
        .range(a, b),
    ),
  ]);
  const contacts = [...people.rows, ...stakeholders.rows, ...leads.rows].flatMap((c) =>
    c.account_id ? [{ account_id: c.account_id, email: c.email }] : [],
  );
  return { accounts: accounts.rows, contacts };
}

/**
 * Detectors whose suggestion reopens as soon as it is found again after the system closed it as «resolved»: the setup steps.
 * The rules of the plays are not here: theirs reopen only when the play was resumed after the closing (reopenable, plays/reopen.ts;
 * SDD-20261109-plays-no-reopen), so a company that never paused a play sees no closed suggestion come back nor any repeated notice.
 */
const REOPENABLE = new Set(["setup_incomplete", "onboarding_stalled"]);
const PLAY_DETECTORS = new Set(CATALOG.flatMap((p) => p.detectors));

/**
 * Saves what the detectors found and closes what no longer applies. A pending suggestion the user worked
 * on with «Resolver» (touched) closes as done by the user ("approved"); the rest close as "resolved"
 * (solved on its own), so the metrics can tell them apart.
 */
export async function syncSuggestions(
  db: Db,
  orgId: string,
  found: import("@/lib/proactive/types").Suggestion[],
  touched: string[] = [],
  opts: { onboardingSeen?: string[] } = {},
) {
  // Strategic suggestions (strategy_* detectors) carry evidence and keep their own decisions: they are written, reopened and
  // left alone by syncStrategySuggestions (CA-5, CA-6) and never auto-closed here.
  const { isStrategySuggestion, syncStrategySuggestions, STRATEGY_DETECTOR_LIKE } =
    await import("@/lib/strategy-core");
  const strategic = found.filter(isStrategySuggestion);
  found = found.filter((f) => !isStrategySuggestion(f));
  await syncStrategySuggestions(db, orgId, strategic);
  if (found.length) {
    await db.from("suggestions").upsert(
      // email_block is not a column: it only feeds the email_draft_blocks registry below.
      found.map((f) => {
        const { email_block: _drop, ...row } = f;
        return { ...row, org_id: orgId, action: f.action as unknown as Json };
      }),
      { onConflict: "org_id,dedupe_key", ignoreDuplicates: true },
    );
  }
  // NK-0173: every blocked draft leaves a registry row (surface, state, reason) — never the address.
  const emailBlocks = found.filter((f) => f.email_block);
  if (emailBlocks.length) {
    const { recordEmailDraftBlock } = await import("@/lib/email-verification-writer");
    for (const f of emailBlocks) {
      if (!f.email_block) continue;
      await recordEmailDraftBlock(db, orgId, {
        surface: "followup_sequence",
        status: f.email_block.status,
        reason: f.email_block.reason,
      });
    }
  }
  const keys = new Set(found.map((f) => f.dedupe_key));
  // A setup step comes and goes (the order changed, the step was reopened by an edit, the quota's quarter turned): the same key is emitted
  // again and the unique (company, key) would keep the row we closed as «resolved» closed forever. Reopen those. A dismissed one stays
  // dismissed: the person said no, and a postponement that ended already produces a key of its own.
  const again = found.filter((f) => REOPENABLE.has(f.detector)).map((f) => f.dedupe_key);
  if (again.length)
    await db
      .from("suggestions")
      .update({
        status: "pending",
        snoozed_until: null,
        notified_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("org_id", orgId)
      .in("dedupe_key", again)
      .eq("status", "resolved");
  // Rules of the plays: a closed suggestion comes back only if its play was resumed after the closing. A failed read of play_states
  // reopens nothing (reopening by mistake sends the notice again; not reopening only delays it to the next sync).
  const playKeys = found.filter((f) => PLAY_DETECTORS.has(f.detector)).map((f) => f.dedupe_key);
  if (playKeys.length) {
    const [{ data: closedRows, error: closedErr }, { data: states, error: statesErr }] =
      await Promise.all([
        db
          .from("suggestions")
          .select("id,dedupe_key,detector,updated_at,snoozed_until")
          .eq("org_id", orgId)
          .eq("status", "resolved")
          .in("dedupe_key", playKeys),
        db.from("play_states").select("play_id,enabled,updated_at").eq("org_id", orgId),
      ]);
    if (!closedErr && !statesErr && closedRows?.length) {
      const now = new Date();
      const decided = reopenable(states ?? [], closedRows, now);
      for (const c of closedRows) {
        const r = decided.get(c.id);
        if (!r) continue;
        await db
          .from("suggestions")
          .update({
            status: r.status,
            snoozed_until: r.snoozed_until,
            notified_at: null,
            updated_at: now.toISOString(),
          })
          .eq("org_id", orgId)
          .eq("id", c.id)
          .eq("status", "resolved");
      }
    }
  }
  // The weekly report, the AI's setup questions, the «te han asignado cuentas» notices and the plan of a plays diagnosis (asked for by a person,
  // NK-0153) are not detectors: they stay until the user decides on them.
  const { data: open } = await db
    .from("suggestions")
    .select("id,dedupe_key,status,title,body")
    .eq("org_id", orgId)
    .in("status", ["pending", "snoozed"])
    .not(
      "detector",
      "in",
      "(weekly_report,setup_question,account_assigned,lead_enriched,discoveries,account_researched,meeting_prepped,account_cooling,field_proposal,onboarding_stalled,plays_diagnosis)",
    )
    .not("detector", "like", STRATEGY_DETECTOR_LIKE);
  // An open suggestion keeps its key but its numbers move (coverage, amounts): refresh its text so it
  // never contradicts the screen it links to.
  for (const u of staleTexts(open ?? [], found))
    await db
      .from("suggestions")
      .update({ title: u.title, body: u.body ?? "" })
      .eq("id", u.id);
  const { done, resolved } = splitClosed(
    (open ?? []).filter((o) => !keys.has(o.dedupe_key)),
    touched,
  );
  const at = new Date().toISOString();
  if (done.length)
    await db.from("suggestions").update({ status: "approved", updated_at: at }).in("id", done);
  if (resolved.length)
    await db.from("suggestions").update({ status: "resolved", updated_at: at }).in("id", resolved);
  // The reminders of the onboarding are closed per owner, never by the generic rule above: a sync only sees the rows its client can read
  // (a leader's own client reads just their row), so «not found» says nothing about someone else's. Closed only when the owner's row was
  // read (onboardingSeen) and its key is no longer found (finished, moved on or changed step), with the same state rule as the generic close.
  const seen = opts.onboardingSeen ?? [];
  if (seen.length) {
    const { data: stalled } = await db
      .from("suggestions")
      .select("id,dedupe_key,status")
      .eq("org_id", orgId)
      .eq("detector", "onboarding_stalled")
      .in("status", ["pending", "snoozed"])
      .in("user_id", seen);
    const closing = splitClosed(
      (stalled ?? []).filter((o) => !keys.has(o.dedupe_key)),
      touched,
    );
    if (closing.done.length)
      await db
        .from("suggestions")
        .update({ status: "approved", updated_at: at })
        .eq("org_id", orgId)
        .in("id", closing.done);
    if (closing.resolved.length)
      await db
        .from("suggestions")
        .update({ status: "resolved", updated_at: at })
        .eq("org_id", orgId)
        .in("id", closing.resolved);
  }
  // Wake up snoozed ones whose time has come.
  await db
    .from("suggestions")
    .update({ status: "pending", snoozed_until: null })
    .eq("org_id", orgId)
    .eq("status", "snoozed")
    .lte("snoozed_until", new Date().toISOString());
}

/** Open suggestions whose detector now says something different (same key, new title or body). */
export function staleTexts(
  open: { id: string; dedupe_key: string; title: string | null; body: string | null }[],
  found: { dedupe_key: string; title: string; body: string | null }[],
) {
  const byKey = new Map(found.map((f) => [f.dedupe_key, f]));
  return open.flatMap((o) => {
    const f = byKey.get(o.dedupe_key);
    return f && (f.title !== o.title || (f.body ?? null) !== (o.body ?? null))
      ? [{ id: o.id, title: f.title, body: f.body ?? null }]
      : [];
  });
}

/** Splits suggestions that stopped applying: pending ones the user opened with «Resolver» → done by the user; the rest → solved on their own. */
export function splitClosed(stale: { id: string; status: string }[], touched: string[]) {
  const t = new Set(touched);
  const done = stale.filter((o) => o.status === "pending" && t.has(o.id)).map((o) => o.id);
  const resolved = stale.filter((o) => !done.includes(o.id)).map((o) => o.id);
  return { done, resolved };
}
