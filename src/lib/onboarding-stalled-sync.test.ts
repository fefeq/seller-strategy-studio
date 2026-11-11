// NK-0009 CA-13: the refresh of another leader does not close your onboarding reminder. Runs the real syncSuggestions against an
// in-memory suggestions table (the double of pause-resume-suggestions.test.ts, with user_id and without play_states). Fictitious ids.
import { describe, expect, it } from "vitest";
import { syncSuggestions, type Db } from "@/lib/org-data";

type Row = {
  id: string;
  org_id: string;
  user_id: string | null;
  dedupe_key: string;
  detector: string;
  status: string;
  title: string;
  body: string | null;
  snoozed_until: string | null;
  notified_at: string | null;
  updated_at: string;
};

/** The slice of the Supabase client syncSuggestions uses on `suggestions` and `play_states`, with upsert-ignore-duplicates and update semantics. */
function fakeDb(store: Row[]): Db {
  const from = (table: string) => {
    let op: "select" | "update" | "upsert" = "select";
    let patch: Partial<Row> = {};
    let incoming: Partial<Row>[] = [];
    const filters: ((r: Row) => boolean)[] = [];
    const b: Record<string, unknown> = {
      select: () => b,
      update: (p: Partial<Row>) => {
        op = "update";
        patch = p;
        return b;
      },
      upsert: (rows: Partial<Row>[]) => {
        op = "upsert";
        incoming = rows;
        return b;
      },
      eq: (c: keyof Row, v: unknown) => (filters.push((r) => r[c] === v), b),
      in: (c: keyof Row, vs: unknown[]) => (filters.push((r) => vs.includes(r[c])), b),
      not: (c: keyof Row, _o: string, v: string) => {
        const vs = v.slice(1, -1).split(",");
        filters.push((r) => !vs.includes(String(r[c])));
        return b;
      },
      lte: (c: keyof Row, v: string) => (filters.push((r) => r[c] != null && String(r[c]) <= v), b),
      then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
        const hit = store.filter((r) => filters.every((f) => f(r)));
        if (op === "upsert")
          for (const n of incoming)
            if (!store.some((r) => r.org_id === n.org_id && r.dedupe_key === n.dedupe_key))
              store.push({
                id: `s${store.length + 1}`,
                status: "pending",
                snoozed_until: null,
                notified_at: null,
                updated_at: new Date().toISOString(),
                body: null,
                ...n,
              } as Row);
        if (op === "update") for (const r of hit) Object.assign(r, patch);
        return Promise.resolve({
          data: op === "select" ? hit.map((r) => ({ ...r })) : null,
          error: null,
        }).then(res, rej);
      },
    };
    return b;
  };
  return { from } as unknown as Db;
}

const sug = (key: string, user_id: string, detector = "onboarding_stalled") => ({
  detector,
  dedupe_key: key,
  priority: 2 as const,
  title: "Retoma tu onboarding",
  body: "",
  link: "/onboarding",
  action: null,
  user_id,
});
const OWNER = "u-owner";
const LEADER = "u-leader";
const K_OWNER = `onboarding_stalled:${OWNER}:blocks`;
const K_LEADER = `onboarding_stalled:${LEADER}:blocks`;
const row = (key: string, user_id: string, over: Partial<Row> = {}): Row => ({
  id: `id-${key}`,
  org_id: "o1",
  user_id,
  dedupe_key: key,
  detector: "onboarding_stalled",
  status: "pending",
  title: "Retoma tu onboarding",
  body: "",
  snoozed_until: null,
  notified_at: "2026-11-10T08:00:00.000Z",
  updated_at: "2026-11-10T08:00:00.000Z",
  ...over,
});
const get = (store: Row[], key: string) => store.find((r) => r.dedupe_key === key);
const open = () => [row(K_OWNER, OWNER), row(K_LEADER, LEADER)];

describe("syncSuggestions and onboarding_stalled (NK-0009 CA-13)", () => {
  it("(a) a sync without the owner's row in onboardingSeen does not close the owner's reminder", async () => {
    const store = open();
    // The leader's own refresh: their client reads only their row, and they are still stalled.
    await syncSuggestions(fakeDb(store), "o1", [sug(K_LEADER, LEADER)], [], {
      onboardingSeen: [LEADER],
    });
    expect(get(store, K_OWNER)?.status).toBe("pending");
    expect(get(store, K_LEADER)?.status).toBe("pending");
  });

  it("without the option nothing of onboarding_stalled is closed", async () => {
    const store = open();
    await syncSuggestions(fakeDb(store), "o1", []);
    await syncSuggestions(fakeDb(store), "o1", [], ["id-" + K_OWNER]);
    expect(store.map((r) => r.status)).toEqual(["pending", "pending"]);
  });

  it("(b) a finished row closes the reminder as resolved, and only that owner's", async () => {
    const store = open();
    await syncSuggestions(fakeDb(store), "o1", [sug(K_LEADER, LEADER)], [], {
      onboardingSeen: [OWNER, LEADER],
    });
    expect(get(store, K_OWNER)?.status).toBe("resolved");
    expect(get(store, K_LEADER)?.status).toBe("pending");
  });

  it("(c) a row stalled at another step closes the old key and leaves the new one open", async () => {
    const store = open();
    await syncSuggestions(
      fakeDb(store),
      "o1",
      [sug(`onboarding_stalled:${OWNER}:diagnosis`, OWNER), sug(K_LEADER, LEADER)],
      [],
      { onboardingSeen: [OWNER, LEADER] },
    );
    expect(get(store, K_OWNER)?.status).toBe("resolved");
    expect(get(store, `onboarding_stalled:${OWNER}:diagnosis`)?.status).toBe("pending");
  });

  it("(d) after it closed, stalling again at the same step reopens it as pending and clears notified_at", async () => {
    const store = open();
    await syncSuggestions(fakeDb(store), "o1", [sug(K_LEADER, LEADER)], [], {
      onboardingSeen: [OWNER, LEADER],
    });
    expect(get(store, K_OWNER)?.status).toBe("resolved");
    await syncSuggestions(fakeDb(store), "o1", [sug(K_OWNER, OWNER), sug(K_LEADER, LEADER)], [], {
      onboardingSeen: [OWNER, LEADER],
    });
    expect(get(store, K_OWNER)?.status).toBe("pending");
    expect(get(store, K_OWNER)?.notified_at).toBeNull();
  });

  it("(e) one the person worked with «Resolver» closes as approved, not resolved", async () => {
    const store = open();
    await syncSuggestions(fakeDb(store), "o1", [sug(K_LEADER, LEADER)], ["id-" + K_OWNER], {
      onboardingSeen: [OWNER, LEADER],
    });
    expect(get(store, K_OWNER)?.status).toBe("approved");
    expect(get(store, K_LEADER)?.status).toBe("pending");
  });

  it("a dismissed reminder stays dismissed when its key is found again", async () => {
    const store = [row(K_OWNER, OWNER, { status: "dismissed" })];
    await syncSuggestions(fakeDb(store), "o1", [sug(K_OWNER, OWNER)], [], {
      onboardingSeen: [OWNER],
    });
    expect(get(store, K_OWNER)?.status).toBe("dismissed");
  });

  it("a snoozed reminder of a finished row also closes", async () => {
    const store = [
      row(K_OWNER, OWNER, { status: "snoozed", snoozed_until: "2026-12-01T00:00:00.000Z" }),
    ];
    await syncSuggestions(fakeDb(store), "o1", [], [], { onboardingSeen: [OWNER] });
    expect(get(store, K_OWNER)?.status).toBe("resolved");
  });

  it("any other detector keeps the generic close", async () => {
    const store = [row("stale_deal:d1", OWNER, { detector: "stale_deal" }), row(K_OWNER, OWNER)];
    await syncSuggestions(fakeDb(store), "o1", [], [], { onboardingSeen: [] });
    expect(get(store, "stale_deal:d1")?.status).toBe("resolved");
    expect(get(store, K_OWNER)?.status).toBe("pending");
  });

  it("the three callers pass onboardingSeen from the snapshot", async () => {
    const { readFileSync } = await import("node:fs");
    for (const f of [
      "src/lib/agent.functions.ts",
      "src/lib/inngest/tasks.server.ts",
      "src/routes/api/public/jobs/proactive.ts",
    ]) {
      const code = readFileSync(f, "utf8").replace(/\s+/g, "");
      expect(code, f).toMatch(/syncSuggestions\([^;]*onboardingSeen/);
    }
  });
});
