// Daily briefing email (server-only, admin client: every query filters by the company and the person).
// The hourly job calls runDailyEmails; each member of a company gets their own email, about their current
// company, at their hour (8:00 local by default), once per local day (job_locks daily_email:<user>:<day>).
// The words come from src/lib/briefing.ts, so Inicio and the email say the same.
import type { Db } from "@/lib/org-data";
import { autoWork, todayItems } from "@/lib/briefing";
import { digest } from "@/lib/proactive";
import { formatMoney } from "@/lib/money";
import { DEFAULT_DAILY, dailyEmailBody, dailyEmailDue, dailySubject, localClock, type DailyContent, type DailyPrefs } from "@/lib/daily-email";
import { safeErrorLog } from "@/lib/agent/safe-error-log";

const BASE = () => process.env["APP_URL"] || "https://nokko.ai";
const MAX_PER_RUN = 300;

export async function buildDailyContent(db: Db, userId: string, orgId: string, now: Date, prefs: DailyPrefs): Promise<DailyContent> {
  const clock = localClock(now, prefs.timezone);
  const since = new Date(now.getTime() - (24 * 60 + clock.minutes) * 60_000).toISOString(); // yesterday 00:00 local
  const dayStart = new Date(now.getTime() - clock.minutes * 60_000);
  const dayEnd = new Date(dayStart.getTime() + 24 * 3_600_000);
  const mineOrOpen = `user_id.is.null,user_id.eq.${userId}`;
  const [org, prof, member, stages, usage, leads, memories, signals, news, jobs, meetings, tasks, deals, followups, approvals, pending, open] = await Promise.all([
    db.from("organizations").select("name,currency").eq("id", orgId).maybeSingle(),
    db.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
    db.from("org_members").select("role").eq("org_id", orgId).eq("user_id", userId),
    db.from("deal_stages").select("key,kind").eq("org_id", orgId),
    db.from("integration_usage").select("trigger,need,cost,created_at").eq("org_id", orgId).gte("created_at", since).limit(1000),
    db.from("leads").select("enriched_at").eq("org_id", orgId).gte("enriched_at", since).limit(500),
    db.from("memories").select("learned,created_at").eq("org_id", orgId).or(mineOrOpen).gte("created_at", since).limit(500),
    db.from("account_signals").select("found_at").eq("org_id", orgId).gte("found_at", since).limit(500),
    db.from("suggestions").select("created_at,detector").eq("org_id", orgId).eq("status", "pending").or(mineOrOpen).gte("created_at", since).limit(500),
    db.from("background_jobs").select("status,finished_at").eq("org_id", orgId).eq("user_id", userId).gte("finished_at", since).limit(200),
    db.from("meetings").select("id,title,scheduled_at,account_id").eq("org_id", orgId).gte("scheduled_at", dayStart.toISOString()).lt("scheduled_at", dayEnd.toISOString()).order("scheduled_at").limit(20),
    db.from("tasks").select("title,due_date,done,owner_id").eq("org_id", orgId).eq("done", false).lte("due_date", clock.day).limit(200),
    db.from("deals").select("name,close_date,owner_id,stage").eq("org_id", orgId).lte("close_date", clock.day).limit(500),
    db.from("leads").select("company,next_step_at,owner_id,stage").eq("org_id", orgId).lte("next_step_at", clock.day).limit(500),
    db.from("approvals").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "pending"),
    db.from("agent_pending_actions").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("user_id", userId).eq("status", "pending"),
    db.from("suggestions").select("title,priority,created_at").eq("org_id", orgId).eq("status", "pending").or(mineOrOpen).not("dedupe_key", "like", "strategy_product_price:price:%").limit(200),
  ]);
  const currency = org.data?.currency ?? "EUR";
  const money = (n: number) => (n < 1 ? new Intl.NumberFormat("es-ES", { style: "currency", currency, minimumFractionDigits: 2 }).format(n) : formatMoney(n, currency, true));
  const leader = (member.data ?? []).some((m) => m.role === "owner" || m.role === "sales_leader");
  const closedKeys = new Set((stages.data ?? []).filter((s) => s.kind !== "open").map((s) => s.key));
  // todayItems prints times with the server clock (UTC on the worker): shift meetings to local wall time first.
  const shift = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + clock.offsetMin * 60_000).toISOString() : iso);
  const auto = autoWork({ since, usage: usage.data ?? [], leads: leads.data ?? [], memories: memories.data ?? [], signals: signals.data ?? [], suggestions: news.data ?? [], jobs: jobs.data ?? [] }, money);
  const today = todayItems({
    today: clock.day, userId, leader,
    meetings: (meetings.data ?? []).map((m) => ({ ...m, scheduled_at: shift(m.scheduled_at) })),
    tasks: tasks.data ?? [], leads: followups.data ?? [],
    deals: (deals.data ?? []).map((d) => ({ ...d, closed: closedKeys.has(d.stage) || d.stage === "won" || d.stage === "lost" })),
  });
  const decisions = [
    ...digest(open.data ?? [], 3).map((s) => s.title),
    ...(leader && approvals.count ? [`${approvals.count} ${approvals.count === 1 ? "aprobación pendiente" : "aprobaciones pendientes"}`] : []),
    ...(pending.count ? [`${pending.count} ${pending.count === 1 ? "acción del agente por confirmar" : "acciones del agente por confirmar"}`] : []),
  ];
  return { name: prof.data?.full_name?.split(" ")[0] ?? "", orgName: org.data?.name ?? "Nokko", auto, decisions, today, hour: prefs.daily_email_hour };
}

async function sendOne(db: Db, userId: string, email: string, orgId: string, now: Date, prefs: DailyPrefs, key?: string) {
  const content = await buildDailyContent(db, userId, orgId, now, prefs);
  const { text, html } = dailyEmailBody(content, BASE());
  const { sendEmail } = await import("@/lib/email.server");
  return sendEmail({ to: [email], subject: dailySubject(content), text, html, idempotencyKey: key });
}

/** Everyone whose hour has come and who has not had today's email yet (bounded per run). */
export async function runDailyEmails(db: Db, now = new Date()): Promise<{ sent: number; failed: number; skipped?: string }> {
  const { emailConfigured } = await import("@/lib/email.server");
  if (!emailConfigured()) return { sent: 0, failed: 0, skipped: "resend not connected" };
  const { data: people } = await db.from("profiles").select("id,email,current_org_id").not("email", "is", null).not("current_org_id", "is", null).limit(2000);
  const ids = (people ?? []).map((p) => p.id);
  const { data: prefRows } = ids.length ? await db.from("notification_prefs").select("user_id,daily_email,daily_email_hour,timezone").in("user_id", ids) : { data: [] };
  const prefsOf = new Map((prefRows ?? []).map((p) => [p.user_id, p]));
  let sent = 0, failed = 0;
  for (const p of people ?? []) {
    if (sent + failed >= MAX_PER_RUN) break;
    const prefs = { ...DEFAULT_DAILY, ...(prefsOf.get(p.id) ?? {}) } as DailyPrefs;
    const { due, day } = dailyEmailDue(prefs, now);
    if (!due) continue;
    // Still a member of that company? (current_org_id can point to a company they left.)
    const { data: m } = await db.from("org_members").select("user_id,organizations!inner(archived_at)").eq("org_id", p.current_org_id!).eq("user_id", p.id).is("organizations.archived_at", null).limit(1);
    if (!m?.length) continue;
    // Claim today's send first; a second run in the same hour finds the row and skips.
    const lock = `daily_email:${p.id}:${day}`;
    const { error: claimed } = await db.from("job_locks").insert({ name: lock, last_run_at: now.toISOString() });
    if (claimed) continue;
    try {
      const r = await sendOne(db, p.id, p.email!, p.current_org_id!, now, prefs, lock);
      if (r.sent) { sent++; continue; }
      failed++;
      // Resend refused for a reason that will not fix itself in an hour (unverified domain, bad key): keep the claim.
      if (r.status && r.status !== 429 && r.status < 500) { console.error("daily email refused", p.id, r.status); continue; }
    } catch (e) { failed++; console.error("daily email failed", p.id, safeErrorLog(e)); }
    await db.from("job_locks").delete().eq("name", lock); // transient: the next hourly run (inside the window) retries
  }
  return { sent, failed };
}

/** «Envíamelo ahora»: today's email to the person asking, about their current company. */
export async function sendDailyEmailNow(db: Db, userId: string, orgId: string, now = new Date()) {
  const [{ data: prof }, { data: prefs }] = await Promise.all([
    db.from("profiles").select("email").eq("id", userId).maybeSingle(),
    db.from("notification_prefs").select("daily_email,daily_email_hour,timezone").eq("user_id", userId).maybeSingle(),
  ]);
  if (!prof?.email) throw new Error("Tu usuario no tiene email.");
  const r = await sendOne(db, userId, prof.email, orgId, now, { ...DEFAULT_DAILY, ...(prefs ?? {}) } as DailyPrefs);
  if (!r.sent) {
    if (r.status === 403 && /domain/i.test(r.error ?? "")) throw new Error("Resend todavía no tiene verificado el dominio nokko.ai. Añádelo y verifícalo en tu cuenta de Resend y vuelve a probar.");
    throw new Error(r.error ? `No se pudo enviar: ${r.error}` : "No se pudo enviar el email.");
  }
  return { to: prof.email };
}
