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
let tables: Record<string, Row[]>;
const updates: { id: unknown; patch: Row }[] = [];

/** A chainable, awaitable stand-in for a PostgREST query: filters by is(null) and in(), records update().eq("id"). */
function query(table: string) {
  let rows = table === "notifications" ? notifications : tables[table] ?? [];
  let patch: Row | null = null;
  const q: Record<string, unknown> = {};
  const chain = () => q;
  Object.assign(q, {
    select: chain, not: chain, order: chain, limit: chain, gte: chain,
    is: (col: string, v: unknown) => { rows = rows.filter((r) => (r[col] ?? null) === v); return q; },
    in: (col: string, vals: unknown[]) => { rows = rows.filter((r) => vals.includes(r[col])); return q; },
    eq: (col: string, v: unknown) => {
      if (patch) { updates.push({ id: v, patch }); for (const r of notifications) if (r[col] === v) Object.assign(r, patch); return q; }
      rows = rows.filter((r) => r[col] === v); return q;
    },
    update: (p: Row) => { patch = p; return q; },
    then: (ok: (v: { data: Row[]; error: null }) => unknown) => Promise.resolve({ data: patch ? [] : rows, error: null }).then(ok),
  });
  return q;
}
const admin = { from: (t: string) => query(t) } as unknown as Parameters<typeof flushHeldNotices>[0];

const money = (id: string, user: string): Row => ({
  id, org_id: ORG, user_id: user, kind: "money", title: "Hay leads nuevos en SQL.", body: "Míralos en Leads.", link: "/leads?vista=lista", job_id: null, telegram_sent_at: null,
});

beforeEach(() => {
  sendText.mockClear();
  updates.length = 0;
  notifications = [money("n1", MEMBER), money("n2", FORMER)];
  tables = {
    channel_links: [{ user_id: MEMBER, chat_id: "chat-member", channel: "telegram" }, { user_id: FORMER, chat_id: "chat-former", channel: "telegram" }],
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
