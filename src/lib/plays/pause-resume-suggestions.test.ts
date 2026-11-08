// Pausing a play closes its open suggestions; resuming it makes the same keys come back. The unique (company, key) would keep them
// closed for good unless the play's rules reopen (review of Plays, 2026-11-08). Runs the real syncSuggestions against an in-memory
// suggestions table with the unique (org_id, dedupe_key) of the real one. Ids and keys are fictional.
import { describe, expect, it } from "vitest";
import { syncSuggestions, type Db } from "@/lib/org-data";

type Row = {
  id: string;
  org_id: string;
  dedupe_key: string;
  detector: string;
  status: string;
  title: string;
  body: string | null;
  snoozed_until: string | null;
};

/** The slice of the Supabase client syncSuggestions uses on `suggestions`, with upsert-ignore-duplicates and update semantics. */
function fakeDb(store: Row[]): Db {
  const from = () => {
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

describe("pausing and resuming a play", () => {
  it("a play's suggestion closed by the pause comes back when the play is resumed", async () => {
    const store: Row[] = [];
    const db = fakeDb(store);
    await syncSuggestions(db, "o1", [sug("meeting_no_prep", KEY)]);
    expect(byKey(store, KEY)?.status).toBe("pending");
    await syncSuggestions(db, "o1", []); // paused: its rule emits nothing and the open suggestion closes
    expect(byKey(store, KEY)?.status).toBe("resolved");
    await syncSuggestions(db, "o1", [sug("meeting_no_prep", KEY)]); // resumed: the same key is emitted again
    expect(byKey(store, KEY)?.status).toBe("pending");
  });

  it("controls: a dismissed or done-by-the-user suggestion stays as it is, and so does a rule that is not a play's", async () => {
    const store: Row[] = [];
    const db = fakeDb(store);
    const all = [
      sug("meeting_no_prep", "meeting_no_prep:m2"),
      sug("meeting_no_prep", "meeting_no_prep:m3"),
      sug("stale_deal", "stale_deal:d1"),
    ];
    await syncSuggestions(db, "o1", all);
    byKey(store, "meeting_no_prep:m2")!.status = "dismissed";
    await syncSuggestions(db, "o1", [], [byKey(store, "meeting_no_prep:m3")!.id]); // m3 was worked on by the user: closes as done
    expect(byKey(store, "meeting_no_prep:m3")?.status).toBe("approved");
    expect(byKey(store, "stale_deal:d1")?.status).toBe("resolved");
    await syncSuggestions(db, "o1", all);
    expect(byKey(store, "meeting_no_prep:m2")?.status).toBe("dismissed");
    expect(byKey(store, "meeting_no_prep:m3")?.status).toBe("approved");
    expect(byKey(store, "stale_deal:d1")?.status).toBe("resolved");
  });
});
