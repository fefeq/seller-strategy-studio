// SDD-20261112-diagnosis-in-chat (NK-0153) CA-13: the plays_diagnosis suggestions are asked for by a person, not emitted by a detector,
// so the generic close of syncSuggestions must leave them open. Runs the real syncSuggestions against an in-memory suggestions table:
// the double of onboarding-stalled-sync.test.ts, copied (that file is not changed). Fictitious ids.
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

/** The slice of the Supabase client syncSuggestions uses on `suggestions`, with upsert-ignore-duplicates and update semantics. */
function fakeDb(store: Row[]): Db {
  const from = (_table: string) => {
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
      not: (c: keyof Row, o: string, v: string) => {
        if (o === "like") {
          const prefix = v.replace(/%$/, "");
          filters.push((r) => !String(r[c]).startsWith(prefix));
          return b;
        }
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

const ORG = "o1";
const OWNER = "u-owner";
const FUTURE = "2999-01-01T00:00:00.000Z";
const row = (key: string, detector: string, over: Partial<Row> = {}): Row => ({
  id: `id-${key}`,
  org_id: ORG,
  user_id: OWNER,
  dedupe_key: key,
  detector,
  status: "pending",
  title: "Título ficticio",
  body: "",
  snoozed_until: null,
  notified_at: null,
  updated_at: "2026-11-10T08:00:00.000Z",
  ...over,
});
const get = (store: Row[], key: string) => store.find((r) => r.dedupe_key === key)!;
const K1 = "plays_diagnosis:signals-in-crm-with-decay";
const K2 = "plays_diagnosis:closed-lost-revival";
const OTHER = "deal_stale:d-1";

describe("syncSuggestions leaves the plays_diagnosis suggestions open (NK-0153 CA-13)", () => {
  it("a sync that finds no plays_diagnosis key does not close an open one, pending or snoozed", async () => {
    const store = [
      row(K1, "plays_diagnosis"),
      row(K2, "plays_diagnosis", { status: "snoozed", snoozed_until: FUTURE }),
    ];
    await syncSuggestions(fakeDb(store), ORG, []);
    expect(get(store, K1).status).toBe("pending");
    expect(get(store, K2).status).toBe("snoozed");
  });

  it("nor when the person touched it («Resolver»): it stays for the person to approve", async () => {
    const store = [row(K1, "plays_diagnosis")];
    await syncSuggestions(fakeDb(store), ORG, [], [`id-${K1}`]);
    expect(get(store, K1).status).toBe("pending");
  });

  it("its title and body are not rewritten by the sync", async () => {
    const store = [row(K1, "plays_diagnosis", { title: "Activa «X»", body: "Cuerpo" })];
    await syncSuggestions(fakeDb(store), ORG, []);
    expect(get(store, K1)).toMatchObject({ title: "Activa «X»", body: "Cuerpo" });
  });

  it("the rest of the detectors close as today: not found is resolved, touched is approved", async () => {
    const store = [
      row(K1, "plays_diagnosis"),
      row(OTHER, "deal_stale"),
      row("deal_stale:d-2", "deal_stale"),
    ];
    await syncSuggestions(fakeDb(store), ORG, [], ["id-deal_stale:d-2"]);
    expect(get(store, OTHER).status).toBe("resolved");
    expect(get(store, "deal_stale:d-2").status).toBe("approved");
    expect(get(store, K1).status).toBe("pending");
  });

  it("a detector that is found again stays open, also next to plays_diagnosis", async () => {
    const store = [row(K1, "plays_diagnosis"), row(OTHER, "deal_stale")];
    await syncSuggestions(fakeDb(store), ORG, [
      {
        detector: "deal_stale",
        dedupe_key: OTHER,
        priority: 2,
        title: "Título ficticio",
        body: "",
        link: "/deals",
        action: null,
      },
    ]);
    expect(get(store, OTHER).status).toBe("pending");
    expect(get(store, K1).status).toBe("pending");
  });
});
