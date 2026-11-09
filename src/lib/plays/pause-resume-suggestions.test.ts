// A closed suggestion of a play's rules comes back only when its play was resumed after the closing (SDD-20261109-plays-no-reopen,
// U-2; it rewrites the case of review of Plays 2026-11-08, which had no play_states). Runs the real syncSuggestions against an
// in-memory suggestions table with the unique (org_id, dedupe_key) of the real one, plus a play_states table. Ids and keys are fictional.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { syncSuggestions, type Db } from "@/lib/org-data";
import { CATALOG } from "@/lib/plays/catalog";

type Row = {
  id: string;
  org_id: string;
  dedupe_key: string;
  detector: string;
  status: string;
  title: string;
  body: string | null;
  snoozed_until: string | null;
  notified_at: string | null;
  updated_at: string;
};
type PlayRow = { org_id: string; play_id: string; enabled: boolean; updated_at: string };
type Opts = {
  plays?: PlayRow[];
  playsError?: boolean;
  /** Runs right before an update of `suggestions` that sets one of these statuses is applied: the gap between the read and the write. */
  beforeReopen?: () => void;
};

/** The slice of the Supabase client syncSuggestions uses on `suggestions` and `play_states`, with upsert-ignore-duplicates and update semantics. */
function fakeDb(store: Row[], opts: Opts = {}): Db {
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
        if (table === "play_states") {
          const rows = (opts.plays ?? []).filter((r) =>
            filters.every((f) => f(r as unknown as Row)),
          );
          return Promise.resolve(
            opts.playsError
              ? // worst case: rows came back together with the error
                { data: rows.map((r) => ({ ...r })), error: { message: "play_states read failed" } }
              : { data: rows.map((r) => ({ ...r })), error: null },
          ).then(res, rej);
        }
        if (
          op === "update" &&
          patch.status &&
          patch.status !== "resolved" &&
          patch.status !== "approved"
        ) {
          const hook = opts.beforeReopen;
          opts.beforeReopen = undefined; // once: only the first write after the read is raced
          hook?.();
        }
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

const sug = (detector: string, key: string) => ({
  detector,
  dedupe_key: key,
  priority: 2 as const,
  title: "t",
  body: "",
  link: null,
  action: null,
  user_id: null,
});
const byKey = (store: Row[], key: string) => store.find((r) => r.dedupe_key === key);
const KEY = "meeting_no_prep:m1";
const NOTIFIED = "2026-11-01T08:00:00.000Z";
const T = (h: number) => `2026-11-09T${String(h).padStart(2, "0")}:00:00.000Z`;
const at = (h: number) => vi.setSystemTime(new Date(T(h)));
const PLAY = CATALOG.find((p) => p.detectors.includes("meeting_no_prep"))!;
const play = (enabled: boolean, updated_at: string, org_id = "o1"): PlayRow => ({
  org_id,
  play_id: PLAY.id,
  enabled,
  updated_at,
});
const closedRow = (over: Partial<Row> & { detector: string; dedupe_key: string }): Row => ({
  id: `c-${over.dedupe_key}`,
  org_id: "o1",
  status: "resolved",
  title: "t",
  body: null,
  snoozed_until: "2026-11-20T00:00:00.000Z",
  notified_at: NOTIFIED,
  updated_at: T(9),
  ...over,
});
const DETECTORS = [...new Set(CATALOG.flatMap((p) => p.detectors))];

beforeEach(() => {
  vi.useFakeTimers();
  at(8);
});
afterEach(() => vi.useRealTimers());

describe("closed suggestions of a play's rules (SDD-20261109-plays-no-reopen)", () => {
  it("CA-1: with no play_states rows nothing reopens, for every detector of the catalogue", async () => {
    expect(DETECTORS.length).toBe(9);
    for (const d of DETECTORS) {
      const key = `${d}:x1`;
      const store: Row[] = [closedRow({ detector: d, dedupe_key: key })];
      at(12);
      await syncSuggestions(fakeDb(store, { plays: [] }), "o1", [sug(d, key)]);
      expect(byKey(store, key), d).toMatchObject({
        status: "resolved",
        notified_at: NOTIFIED,
        snoozed_until: "2026-11-20T00:00:00.000Z",
        updated_at: T(9),
      });
    }
  });

  it("CA-2: a row enabled before the closing is not a resumption", async () => {
    const store: Row[] = [closedRow({ detector: "meeting_no_prep", dedupe_key: KEY })];
    at(12);
    await syncSuggestions(fakeDb(store, { plays: [play(true, T(7))] }), "o1", [
      sug("meeting_no_prep", KEY),
    ]);
    expect(byKey(store, KEY)).toMatchObject({ status: "resolved", notified_at: NOTIFIED });
  });

  it("CA-3: a paused play reopens nothing", async () => {
    const store: Row[] = [closedRow({ detector: "meeting_no_prep", dedupe_key: KEY })];
    at(12);
    await syncSuggestions(fakeDb(store, { plays: [play(false, T(10))] }), "o1", [
      sug("meeting_no_prep", KEY),
    ]);
    expect(byKey(store, KEY)).toMatchObject({ status: "resolved", notified_at: NOTIFIED });
  });

  it("CA-4: pause, close, resume: it comes back unnotified; one closed after the resumption stays closed", async () => {
    const store: Row[] = [];
    const plays: PlayRow[] = [];
    const db = fakeDb(store, { plays });
    at(8);
    await syncSuggestions(db, "o1", [sug("meeting_no_prep", KEY)]);
    expect(byKey(store, KEY)?.status).toBe("pending");
    byKey(store, KEY)!.notified_at = NOTIFIED;
    plays.push(play(false, T(9))); // paused
    at(10);
    await syncSuggestions(db, "o1", []); // the rule emits nothing and the open suggestion closes
    expect(byKey(store, KEY)?.status).toBe("resolved");
    plays.splice(0, plays.length, play(true, T(11))); // resumed
    // another one of the same detector that closed on its own after the resumption
    const later = "meeting_no_prep:m2";
    store.push(
      closedRow({
        detector: "meeting_no_prep",
        dedupe_key: later,
        updated_at: "2026-11-09T11:30:00.000Z",
      }),
    );
    at(12);
    await syncSuggestions(db, "o1", [sug("meeting_no_prep", KEY), sug("meeting_no_prep", later)]);
    expect(byKey(store, KEY)).toMatchObject({
      status: "pending",
      notified_at: null,
      snoozed_until: null,
    });
    expect(byKey(store, later)).toMatchObject({ status: "resolved", notified_at: NOTIFIED });
  });

  it("CA-5: a postponement still in the future survives the resumption; a passed one is dropped", async () => {
    const future = closedRow({
      detector: "meeting_no_prep",
      dedupe_key: KEY,
      snoozed_until: "2026-11-20T00:00:00.000Z",
    });
    const past = closedRow({
      detector: "meeting_no_prep",
      dedupe_key: "meeting_no_prep:m2",
      snoozed_until: "2026-11-05T00:00:00.000Z",
    });
    const store: Row[] = [future, past];
    at(12);
    await syncSuggestions(fakeDb(store, { plays: [play(true, T(11))] }), "o1", [
      sug("meeting_no_prep", KEY),
      sug("meeting_no_prep", "meeting_no_prep:m2"),
    ]);
    expect(byKey(store, KEY)).toMatchObject({
      status: "snoozed",
      snoozed_until: "2026-11-20T00:00:00.000Z",
      notified_at: null,
    });
    expect(byKey(store, "meeting_no_prep:m2")).toMatchObject({
      status: "pending",
      snoozed_until: null,
      notified_at: null,
    });
  });

  it("CA-6: dismissed and done ones never reopen; a rule that is not a play's stays closed; setup_incomplete reopens as before", async () => {
    const store: Row[] = [
      closedRow({
        detector: "meeting_no_prep",
        dedupe_key: "meeting_no_prep:m2",
        status: "dismissed",
      }),
      closedRow({
        detector: "meeting_no_prep",
        dedupe_key: "meeting_no_prep:m3",
        status: "approved",
      }),
      closedRow({ detector: "stale_deal", dedupe_key: "stale_deal:d1" }),
      closedRow({ detector: "setup_incomplete", dedupe_key: "setup:a" }),
    ];
    at(12);
    await syncSuggestions(fakeDb(store, { plays: [play(true, T(11))] }), "o1", [
      sug("meeting_no_prep", "meeting_no_prep:m2"),
      sug("meeting_no_prep", "meeting_no_prep:m3"),
      sug("stale_deal", "stale_deal:d1"),
      sug("setup_incomplete", "setup:a"),
    ]);
    expect(byKey(store, "meeting_no_prep:m2")?.status).toBe("dismissed");
    expect(byKey(store, "meeting_no_prep:m3")?.status).toBe("approved");
    expect(byKey(store, "stale_deal:d1")?.status).toBe("resolved");
    expect(byKey(store, "setup:a")).toMatchObject({
      status: "pending",
      snoozed_until: null,
      notified_at: null,
    });
  });

  it("CA-6: setup_incomplete reopens with no play_states at all", async () => {
    const store: Row[] = [closedRow({ detector: "setup_incomplete", dedupe_key: "setup:a" })];
    at(12);
    await syncSuggestions(fakeDb(store, { plays: [] }), "o1", [sug("setup_incomplete", "setup:a")]);
    expect(byKey(store, "setup:a")).toMatchObject({
      status: "pending",
      snoozed_until: null,
      notified_at: null,
    });
  });

  it("CA-6 (race, a guard that cannot fail today): a row dismissed between the read and the write stays dismissed", async () => {
    const store: Row[] = [closedRow({ detector: "meeting_no_prep", dedupe_key: KEY })];
    at(12);
    await syncSuggestions(
      fakeDb(store, {
        plays: [play(true, T(11))],
        beforeReopen: () => {
          byKey(store, KEY)!.status = "dismissed";
        },
      }),
      "o1",
      [sug("meeting_no_prep", KEY)],
    );
    expect(byKey(store, KEY)?.status).toBe("dismissed");
  });

  it("CA-7: another company's resumed play reopens nothing here", async () => {
    const store: Row[] = [closedRow({ detector: "meeting_no_prep", dedupe_key: KEY })];
    at(12);
    await syncSuggestions(fakeDb(store, { plays: [play(true, T(11), "o2")] }), "o1", [
      sug("meeting_no_prep", KEY),
    ]);
    expect(byKey(store, KEY)).toMatchObject({ status: "resolved", notified_at: NOTIFIED });
  });

  it("CA-8: a failed read of play_states reopens nothing and the rest of the sync still runs", async () => {
    const store: Row[] = [
      closedRow({ detector: "meeting_no_prep", dedupe_key: KEY }),
      {
        ...closedRow({ detector: "stale_deal", dedupe_key: "stale_deal:d2" }),
        status: "pending",
        snoozed_until: null,
      },
      {
        ...closedRow({ detector: "stale_deal", dedupe_key: "stale_deal:d3" }),
        status: "snoozed",
        snoozed_until: "2026-11-09T09:00:00.000Z",
      },
    ];
    at(12);
    await syncSuggestions(fakeDb(store, { plays: [play(true, T(11))], playsError: true }), "o1", [
      sug("meeting_no_prep", KEY),
      sug("stale_deal", "stale_deal:d4"),
    ]);
    expect(byKey(store, KEY)?.status).toBe("resolved");
    expect(byKey(store, "stale_deal:d4")?.status).toBe("pending"); // inserted
    expect(byKey(store, "stale_deal:d2")?.status).toBe("resolved"); // closed
    expect(byKey(store, "stale_deal:d3")?.status).toBe("resolved"); // not found, so closed (the wake-up would also have run)
  });

  it("control: a dismissed or done-by-the-user suggestion stays as it is, and so does a rule that is not a play's", async () => {
    const store: Row[] = [];
    const db = fakeDb(store, { plays: [] });
    const all = [
      sug("meeting_no_prep", "meeting_no_prep:m2"),
      sug("meeting_no_prep", "meeting_no_prep:m3"),
      sug("stale_deal", "stale_deal:d1"),
    ];
    await syncSuggestions(db, "o1", all);
    byKey(store, "meeting_no_prep:m2")!.status = "dismissed";
    await syncSuggestions(db, "o1", [], [byKey(store, "meeting_no_prep:m3")!.id]);
    expect(byKey(store, "meeting_no_prep:m3")?.status).toBe("approved");
    expect(byKey(store, "stale_deal:d1")?.status).toBe("resolved");
    await syncSuggestions(db, "o1", all);
    expect(byKey(store, "meeting_no_prep:m2")?.status).toBe("dismissed");
    expect(byKey(store, "meeting_no_prep:m3")?.status).toBe("approved");
    expect(byKey(store, "stale_deal:d1")?.status).toBe("resolved");
  });
});
