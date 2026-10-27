// CA-6: the activity that starts the inactivity nudge is what a person changed (last_human_edit_at, migration 0064), never updated_at.
import { describe, expect, it } from "vitest";
import { loadSetupGuideExtras, type Db } from "@/lib/org-data";

type Call = { table: string; method: string; args: unknown[] };
const TABLES = ["positioning", "segments", "quotas", "accounts", "deals", "icp_profiles", "messaging_pillars"];

function fakeDb(human: Record<string, string | null>, snoozes: { step_id: string; snoozed_until: string; created_at: string }[] = []) {
  const calls: Call[] = [];
  const from = (table: string) => {
    const b: unknown = new Proxy(function () {}, {
      get: (_t, k: string) => {
        if (k === "then") return (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve({ data: table === "setup_step_snoozes" ? snoozes : [], error: null }).then(res, rej);
        if (k === "maybeSingle") return () => Promise.resolve({ data: human[table] ? { last_human_edit_at: human[table] } : null, error: null });
        return (...args: unknown[]) => { calls.push({ table, method: k, args }); return b; };
      },
    });
    return b;
  };
  return { db: { from } as unknown as Db, calls };
}

describe("setup activity for the nudge (CA-6)", () => {
  it("reads last_human_edit_at on the seven setup tables, skipping rows with no value, and never updated_at", async () => {
    const { db, calls } = fakeDb({});
    await loadSetupGuideExtras(db, "org-1");
    for (const t of TABLES) {
      const mine = calls.filter((c) => c.table === t);
      expect(mine.find((c) => c.method === "select")?.args, t).toEqual(["last_human_edit_at"]);
      expect(mine.find((c) => c.method === "not")?.args, t).toEqual(["last_human_edit_at", "is", null]);
    }
    expect(JSON.stringify(calls)).not.toContain("updated_at");
  });

  it("the activity is the latest person edit across tables, or a snooze, and unknown when there is none", async () => {
    const a = fakeDb({ deals: "2026-10-20T09:00:00Z", accounts: "2026-10-22T09:00:00Z", quotas: null });
    expect((await loadSetupGuideExtras(a.db, "org-1")).activityAt).toBe("2026-10-22T09:00:00Z");
    const b = fakeDb({ deals: "2026-10-20T09:00:00Z" }, [{ step_id: "quota", snoozed_until: "2026-11-03T11:00:00Z", created_at: "2026-10-25T08:00:00Z" }]);
    expect((await loadSetupGuideExtras(b.db, "org-1")).activityAt).toBe("2026-10-25T08:00:00Z");
    expect((await loadSetupGuideExtras(fakeDb({}).db, "org-1")).activityAt).toBeNull();
  });
});
