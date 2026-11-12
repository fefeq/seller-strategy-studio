// SDD-20261030 money-moment-notices, U-4 (CA-11): the hourly batch sends an eligible money notice once and never to someone who is
// no longer a member of the notice's company. The Supabase client and the Telegram sender are fakes; names and ids are fictional.
import { beforeEach, expect, it, vi } from "vitest";

const sendText = vi.fn(async (_chat: string, _text: string) => undefined);
vi.mock("@/lib/telegram.server", () => ({ telegramConfigured: () => true, sendText }));

import { flushHeldNotices } from "@/lib/notices.server";

type Row = Record<string, unknown>;
const ORG = "00000000-0000-4000-8000-0000000000a1";
const MEMBER = "00000000-0000-4000-8000-0000000000a2";
const FORMER = "00000000-0000-4000-8000-0000000000a3";
const NOW = new Date("2026-07-01T10:00:00Z"); // 12:00 in Madrid: outside the night silence

let notifications: Row[];
let membersFail = false;
let tables: Record<string, Row[]>;
const updates: { id: unknown; patch: Row }[] = [];

/** A chainable, awaitable stand-in for a PostgREST query: filters by is(null) and in(), records update().eq("id"). */
function query(table: string) {
  let rows = table === "notifications" ? notifications : (tables[table] ?? []);
  let patch: Row | null = null;
  let ranged = false;
  const q: Record<string, unknown> = {};
  const chain = () => q;
  Object.assign(q, {
    select: chain,
    not: chain,
    order: chain,
    limit: chain,
    gte: chain,
    range: (from: number, to: number) => {
      ranged = true;
      rows = rows.slice(from, to + 1);
      return q;
    },
    is: (col: string, v: unknown) => {
      rows = rows.filter((r) => (r[col] ?? null) === v);
      return q;
    },
    in: (col: string, vals: unknown[]) => {
      rows = rows.filter((r) => vals.includes(r[col]));
      return q;
    },
    eq: (col: string, v: unknown) => {
      if (patch) {
        updates.push({ id: v, patch });
        for (const r of notifications) if (r[col] === v) Object.assign(r, patch);
        return q;
      }
      rows = rows.filter((r) => r[col] === v);
      return q;
    },
    update: (p: Row) => {
      patch = p;
      return q;
    },
    then: (ok: (v: { data: Row[] | null; error: { message: string } | null }) => unknown) =>
      Promise.resolve(
        table === "org_members" && membersFail
          ? { data: null, error: { message: "connection reset" } }
          : {
              data: patch ? [] : table === "org_members" && !ranged ? rows.slice(0, 1000) : rows,
              error: null,
            }, // an unpaged read is cut at 1000, like PostgREST
      ).then(ok),
  });
  return q;
}
const admin = { from: (t: string) => query(t) } as unknown as Parameters<
  typeof flushHeldNotices
>[0];

const money = (id: string, user: string): Row => ({
  id,
  org_id: ORG,
  user_id: user,
  kind: "money",
  title: "Hay leads nuevos en SQL.",
  body: "Míralos en Leads.",
  link: "/leads?vista=lista",
  job_id: null,
  telegram_sent_at: null,
});

beforeEach(() => {
  sendText.mockClear();
  updates.length = 0;
  membersFail = false;
  notifications = [money("n1", MEMBER), money("n2", FORMER)];
  tables = {
    channel_links: [
      { user_id: MEMBER, chat_id: "chat-member", channel: "telegram" },
      { user_id: FORMER, chat_id: "chat-former", channel: "telegram" },
    ],
    notification_prefs: [
      { user_id: MEMBER, telegram: "all", quiet_from: 22, quiet_to: 8, timezone: "Europe/Madrid" },
      { user_id: FORMER, telegram: "all", quiet_from: 22, quiet_to: 8, timezone: "Europe/Madrid" },
    ],
    org_members: [{ org_id: ORG, user_id: MEMBER }], // FORMER used to be in ORG and is gone
  };
});

it("CA-11: a money notice goes out once to a current member and never to a former one", async () => {
  expect(await flushHeldNotices(admin, NOW)).toBe(1);
  expect(sendText).toHaveBeenCalledTimes(1);
  expect(sendText.mock.calls[0]![0]).toBe("chat-member");
  expect(sendText.mock.calls[0]![1]).toContain("Hay leads nuevos en SQL.");
  expect(updates.map((u) => u.id)).toEqual(["n1"]); // marked as sent: only the member's
  expect(notifications.find((n) => n.id === "n1")!["telegram_sent_at"]).toBe(NOW.toISOString());
  expect(notifications.find((n) => n.id === "n2")!["telegram_sent_at"]).toBeNull();
  // the next hourly run does not send it again, and the former member still gets nothing
  expect(await flushHeldNotices(admin, new Date(NOW.getTime() + 3_600_000))).toBe(0);
  expect(sendText).toHaveBeenCalledTimes(1);
});

it("N-6: if the membership query fails nothing is sent and the failure is logged; the next run sends normally", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  try {
    membersFail = true;
    expect(await flushHeldNotices(admin, NOW)).toBe(0);
    expect(sendText).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0); // nothing is marked as sent, so the next hour still delivers
    // NK-0149: the failure is logged by its label; the error's own text is not part of the log.
    expect(log.mock.calls.some((c) => String(c[0]).includes("membership query failed"))).toBe(true);
    expect(log.mock.calls.some((c) => JSON.stringify(c).includes("connection reset"))).toBe(false);
    membersFail = false; // control: same notices, healthy query
    expect(await flushHeldNotices(admin, NOW)).toBe(1);
    expect(sendText).toHaveBeenCalledTimes(1);
  } finally {
    log.mockRestore();
  }
});

it("a membership list longer than one page is read whole: the legitimate notice still goes out", async () => {
  notifications = [money("n1", MEMBER)];
  const filler = Array.from({ length: 1500 }, (_, i) => ({
    org_id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`, // sorts before ORG, so ORG lands past the first page
    user_id: MEMBER,
  }));
  tables["org_members"] = [...filler, { org_id: ORG, user_id: MEMBER }];
  expect(await flushHeldNotices(admin, NOW)).toBe(1);
  expect(sendText).toHaveBeenCalledTimes(1);
});
