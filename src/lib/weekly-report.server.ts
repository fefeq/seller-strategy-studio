// Builds the Monday report per company, stores it as a suggestion (detector weekly_report, one per
// week) and delivers it once by Telegram and email. Runs inside the hourly proactive job: on a Monday
// the first run after 06:00 UTC creates it, and the dedupe key stops the following hours.
import type { Stage } from "@/lib/stages";
import type { Db } from "@/lib/org-data";
import { readSla } from "@/lib/lead-funnel";
import { readStaleDays } from "@/lib/stale";
import { formatMoney } from "@/lib/money";
import { reportText, weekStart, weeklyReport, type WeeklyReport } from "@/lib/weekly-report";
import { safeErrorLog } from "@/lib/agent/safe-error-log";

export const WEEKLY_DETECTOR = "weekly_report";
const WEEKLY_HOUR_UTC = 6;

export const weeklyKey = (orgId: string, weekOf: string) => `${WEEKLY_DETECTOR}:${orgId}:${weekOf}`;
export const isReportTime = (now: Date) =>
  now.getUTCDay() === 1 && now.getUTCHours() >= WEEKLY_HOUR_UTC;

export async function buildOrgReport(
  db: Db,
  orgId: string,
  now = new Date(),
): Promise<{ report: WeeklyReport; text: string; currency: string }> {
  const since = new Date(now.getTime() - 8 * 86_400_000).toISOString();
  const [org, deals, hist, leads, segs, settings, stages] = await Promise.all([
    db.from("organizations").select("currency").eq("id", orgId).maybeSingle(),
    db
      .from("deals")
      .select("id,name,stage,amount,segment_id,close_date,closed_at,created_at,updated_at,owner_id")
      .eq("org_id", orgId),
    db
      .from("deal_stage_history")
      .select("deal_id,from_stage,to_stage,changed_at")
      .eq("org_id", orgId)
      .gte("changed_at", since),
    db
      .from("leads")
      .select("id,company,stage,created_at,sql_at,opportunity_at,stage_entered_at,next_step_at")
      .eq("org_id", orgId)
      .limit(2000),
    db
      .from("segments")
      .select("id,name,acv_min,acv_max,win_rate_target,cac_target,gross_margin_pct,payback_months")
      .eq("org_id", orgId),
    db.from("lead_settings").select("sla").eq("org_id", orgId).maybeSingle(),
    db
      .from("deal_stages")
      .select("key,label,position,kind,board_group,probability")
      .eq("org_id", orgId),
  ]);
  const currency = org.data?.currency ?? "EUR";
  const money = (n: number) => formatMoney(n, currency, true);
  const report = weeklyReport({
    now,
    deals: deals.data ?? [],
    history: hist.data ?? [],
    leads: leads.data ?? [],
    segments: segs.data ?? [],
    staleDays: readStaleDays(settings.data?.sla),
    leadSla: readSla(settings.data?.sla),
    money,
    stages: (stages.data ?? []) as Stage[],
  });
  return { report, text: reportText(report, money), currency };
}

/** Creates this week's report for every company (idempotent) and delivers the ones not sent yet. */
export async function runWeeklyReports(
  db: Db,
  now = new Date(),
): Promise<{ created: number; telegram: number; email: number; skipped?: string }> {
  if (!isReportTime(now))
    return { created: 0, telegram: 0, email: 0, skipped: "not monday morning" };
  const weekOf = weekStart(now);
  const { data: orgs } = await db
    .from("organizations")
    .select("id,name")
    .is("archived_at", null)
    .order("created_at")
    .limit(200);
  let created = 0,
    telegram = 0,
    email = 0;
  for (const o of orgs ?? []) {
    try {
      const key = weeklyKey(o.id, weekOf);
      const { data: existing } = await db
        .from("suggestions")
        .select("id,notified_at")
        .eq("org_id", o.id)
        .eq("dedupe_key", key)
        .maybeSingle();
      let id = existing?.id;
      let text: string | null = null;
      let title: string | null = null;
      if (!existing) {
        const built = await buildOrgReport(db, o.id, now);
        text = built.text;
        title = `Informe del lunes: ${built.report.headline}`;
        const { data: row, error } = await db
          .from("suggestions")
          .insert({
            org_id: o.id,
            detector: WEEKLY_DETECTOR,
            dedupe_key: key,
            priority: 2,
            title,
            body: text,
            link: "/deals",
            action: null,
            user_id: null,
            status: "pending",
          })
          .select("id")
          .single();
        if (error) throw error;
        id = row.id;
        created++;
      }
      if (!id || existing?.notified_at) continue;
      if (text == null || title == null) {
        const { data: row } = await db
          .from("suggestions")
          .select("title,body")
          .eq("id", id)
          .single();
        title = row?.title ?? "Informe del lunes";
        text = row?.body ?? "";
      }
      const sent = await deliver(db, o.id, o.name, title, text, id);
      telegram += sent.telegram;
      email += sent.email;
      await db.from("suggestions").update({ notified_at: now.toISOString() }).eq("id", id);
    } catch (e) {
      console.error("weekly report failed", o.id, safeErrorLog(e));
    }
  }
  return { created, telegram, email };
}

async function deliver(
  db: Db,
  orgId: string,
  orgName: string,
  title: string,
  text: string,
  suggestionId: string,
) {
  const out = { telegram: 0, email: 0 };
  const { data: members } = await db
    .from("org_members")
    .select("user_id,role")
    .eq("org_id", orgId)
    .in("role", ["owner", "sales_leader"]);
  const userIds = (members ?? []).map((m) => m.user_id);
  if (!userIds.length) return out;

  const { telegramConfigured, sendText } = await import("@/lib/telegram.server");
  if (telegramConfigured()) {
    const { data: links } = await db
      .from("channel_links")
      .select("user_id,chat_id")
      .eq("channel", "telegram")
      .eq("daily_digest", true)
      .not("chat_id", "is", null)
      .in("user_id", userIds);
    for (const l of links ?? []) {
      try {
        await sendText(l.chat_id!, `${title}\n\n${text}`, [
          [
            { text: "Visto", data: `s:${suggestionId}:approve` },
            { text: "Descartar", data: `s:${suggestionId}:dismiss` },
          ],
        ]);
        out.telegram++;
      } catch (e) {
        console.error("weekly telegram failed", safeErrorLog(e));
      }
    }
  }

  const { emailConfigured, sendEmail, textToHtml } = await import("@/lib/email.server");
  if (emailConfigured()) {
    const { data: profiles } = await db
      .from("profiles")
      .select("email")
      .in("id", userIds)
      .not("email", "is", null);
    const to = (profiles ?? []).map((p) => p.email!).filter(Boolean);
    const link = {
      href: `${process.env["APP_URL"] || "https://nokko.ai"}/deals`,
      label: "Abrir la pipeline en Nokko",
    };
    const r = await sendEmail({
      to,
      subject: `${orgName} · ${title}`,
      text: `${text}\n\n${link.label}: ${link.href}`,
      html: textToHtml(title, text, link),
    });
    if (r.sent) out.email = to.length;
  }
  return out;
}

/** «Generar ahora» (Owner / Sales Leader): this week's report replaces the pending one. No Telegram or email: that is Monday's job. */
export async function saveWeeklyReportNow(db: Db, orgId: string, now = new Date()) {
  const key = weeklyKey(orgId, weekStart(now));
  const { report, text } = await buildOrgReport(db, orgId, now);
  const title = `Informe del lunes: ${report.headline}`;
  const { error } = await db.from("suggestions").upsert(
    {
      org_id: orgId,
      detector: WEEKLY_DETECTOR,
      dedupe_key: key,
      priority: 2,
      title,
      body: text,
      link: "/deals",
      action: null,
      user_id: null,
      status: "pending",
      updated_at: now.toISOString(),
    },
    { onConflict: "org_id,dedupe_key" },
  );
  if (error) throw new Error(error.message);
  return { title };
}
