// Notices outside the app (server-only, admin client): Telegram for the people who linked it, following each
// person's preference and night silence (pure rules in src/lib/jobs.ts), plus the autopilot's «Lo hice solo».
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { DEFAULT_PREFS, telegramDecision, telegramText, type NoticePrefs } from "@/lib/jobs";
import { SITE_URL } from "@/lib/site";

type Admin = SupabaseClient<Database>;
type Notice = {
  id: string;
  org_id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  job_id: string | null;
};

const MEMBERS_PAGE = 1000; // PostgREST caps a response; page so a long membership list is never silently cut

/** Memberships of these users, all pages. A cut list would make `member.has` false and drop legitimate notices without a trace. */
async function membershipsOf(db: Admin, users: string[]) {
  const all: { org_id: string; user_id: string }[] = [];
  for (let from = 0; ; from += MEMBERS_PAGE) {
    const { data, error } = await db
      .from("org_members")
      .select("org_id,user_id")
      .in("user_id", users)
      .order("org_id")
      .order("user_id")
      .range(from, from + MEMBERS_PAGE - 1);
    if (error) return { data: null, error };
    all.push(...(data ?? []));
    if ((data ?? []).length < MEMBERS_PAGE) return { data: all, error: null };
  }
}

async function deliver(db: Admin, list: Notice[], now: Date) {
  const { telegramConfigured, sendText } = await import("@/lib/telegram.server");
  if (!list.length || !telegramConfigured()) return 0;
  const users = [...new Set(list.map((n) => n.user_id))];
  const jobIds = [...new Set(list.map((n) => n.job_id).filter(Boolean))] as string[];
  const [{ data: links }, { data: prefs }, { data: jobs }, { data: members, error: membersError }] =
    await Promise.all([
      db
        .from("channel_links")
        .select("user_id,chat_id")
        .eq("channel", "telegram")
        .in("user_id", users)
        .not("chat_id", "is", null),
      db
        .from("notification_prefs")
        .select("user_id,telegram,quiet_from,quiet_to,timezone")
        .in("user_id", users),
      jobIds.length
        ? db.from("background_jobs").select("id,kind").in("id", jobIds)
        : Promise.resolve({ data: [] as { id: string; kind: string }[] }),
      membershipsOf(db, users),
    ]);
  if (membersError) {
    console.error("telegram notices skipped: membership query failed", membersError.message);
    return 0;
  } // without membership nothing can be checked, so nothing leaves; unsent notices stay for the next run
  const chat = new Map((links ?? []).map((l) => [l.user_id, l.chat_id!]));
  const pref = new Map((prefs ?? []).map((p) => [p.user_id, p as unknown as NoticePrefs]));
  const kindOf = new Map((jobs ?? []).map((j) => [j.id, j.kind]));
  const member = new Set((members ?? []).map((m) => `${m.org_id}:${m.user_id}`));
  let sent = 0;
  for (const n of list) {
    const chatId = chat.get(n.user_id);
    if (!chatId) continue;
    if (!member.has(`${n.org_id}:${n.user_id}`)) continue; // no longer in the company of the notice: nothing leaves, whatever its kind
    const decision = telegramDecision(
      n,
      n.job_id ? (kindOf.get(n.job_id) ?? null) : null,
      pref.get(n.user_id) ?? DEFAULT_PREFS,
      now,
    );
    if (decision !== "send") continue;
    try {
      await sendText(chatId, telegramText(n, SITE_URL));
      await db.from("notifications").update({ telegram_sent_at: now.toISOString() }).eq("id", n.id);
      sent++;
    } catch (e) {
      console.error("telegram notice failed", n.id, (e as Error).message);
    }
  }
  return sent;
}

const COLS = "id,org_id,user_id,kind,title,body,link,job_id";

/** Right after a background job ends: its notice goes to Telegram now, unless held by the night silence. */
export async function deliverJobNotice(db: Admin, jobId: string, now = new Date()) {
  const { data } = await db
    .from("notifications")
    .select(COLS)
    .eq("job_id", jobId)
    .is("telegram_sent_at", null)
    .order("created_at", { ascending: false })
    .limit(1);
  return deliver(db, (data ?? []) as Notice[], now).catch((e) => {
    console.error("deliverJobNotice", e);
    return 0;
  });
}

/** Hourly: notices held during the night (last 12 h) go out once the silence ends. */
export async function flushHeldNotices(db: Admin, now = new Date()) {
  const { data } = await db
    .from("notifications")
    .select(COLS)
    .is("telegram_sent_at", null)
    .gte("created_at", new Date(now.getTime() - 12 * 3_600_000).toISOString())
    .order("created_at")
    .limit(300);
  return deliver(db, (data ?? []) as Notice[], now).catch((e) => {
    console.error("flushHeldNotices", e);
    return 0;
  });
}

/** After an automatic autopilot run that did something: «Lo hice solo» for the company's Owner and Sales Leaders. */
export async function notifyAutopilot(
  db: Admin,
  orgId: string,
  out: { researched: number; prepped: number; cooling: number },
  now = new Date(),
) {
  const parts = [
    out.researched &&
      `investigué ${out.researched} ${out.researched === 1 ? "cuenta nueva" : "cuentas nuevas"}`,
    out.prepped && `preparé ${out.prepped} ${out.prepped === 1 ? "reunión" : "reuniones"}`,
    out.cooling &&
      `repasé ${out.cooling} ${out.cooling === 1 ? "cuenta que se enfría" : "cuentas que se enfrían"}`,
  ].filter(Boolean) as string[];
  if (!parts.length) return 0;
  const { data: leaders } = await db
    .from("org_members")
    .select("user_id")
    .eq("org_id", orgId)
    .in("role", ["owner", "sales_leader"]);
  const users = [...new Set((leaders ?? []).map((l) => l.user_id))];
  if (!users.length) return 0;
  const title = `Lo hice solo: ${parts.join(", ")}.`;
  const { data, error } = await db
    .from("notifications")
    .insert(
      users.map((u) => ({
        org_id: orgId,
        user_id: u,
        kind: "autopilot",
        title,
        body: "Lo tienes en Inicio y en Sugerencias.",
        link: "/home",
      })),
    )
    .select(COLS);
  if (error) {
    console.error("notifyAutopilot", error.message);
    return 0;
  }
  return deliver(db, (data ?? []) as Notice[], now);
}
