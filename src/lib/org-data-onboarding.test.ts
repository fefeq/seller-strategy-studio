// NK-0009 CA-12: loadSnapshot reads onboarding_sessions (user_id, step, updated_at only, of the company) into snapshot.onboarding;
// a failed read leaves the field out. Runs the real loadSnapshot against a recording fake; every other table answers empty. Fictitious ids.
import { describe, expect, it } from "vitest";
import { loadSnapshot, type Db } from "@/lib/org-data";

type Q = { table: string; selected?: string; filters: unknown[][] };
function fakeDb(onboarding: { data?: unknown; error?: { message: string } | null }) {
  const log: Q[] = [];
  const from = (table: string) => {
    const q: Q = { table, filters: [] };
    let single = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the fake query builder is a Proxy
    const proxy: any = new Proxy({}, {
      get(_t, prop: string) {
        if (prop === "then") {
          log.push(q);
          const res = table === "onboarding_sessions"
            ? { data: onboarding.data ?? null, error: onboarding.error ?? null }
            : { data: single ? null : [], error: null, count: 0 };
          return (a: (v: unknown) => unknown, b: (e: unknown) => unknown) => Promise.resolve(res).then(a, b);
        }
        return (...args: unknown[]) => {
          if (prop === "select") q.selected = String(args[0] ?? "");
          else if (prop === "maybeSingle" || prop === "single") single = true;
          else q.filters.push([prop, ...args]);
          return proxy;
        };
      },
    });
    return proxy;
  };
  return { db: { from } as unknown as Db, log };
}
const NOW = new Date("2026-11-11T10:00:00Z");
const ROWS = [{ user_id: "u-owner", step: "blocks", updated_at: "2026-11-09T10:00:00Z" }];

describe("loadSnapshot reads the onboarding (NK-0009 CA-12)", () => {
  it("puts the company's rows in snapshot.onboarding, reading only user_id, step and updated_at", async () => {
    const { db, log } = fakeDb({ data: ROWS });
    const snap = await loadSnapshot(db, "org-1", NOW);
    expect(snap.onboarding).toEqual(ROWS);
    const q = log.find((x) => x.table === "onboarding_sessions")!;
    expect(q.selected).toBe("user_id,step,updated_at");
    expect(q.filters.some(([op, c, v]) => op === "eq" && c === "org_id" && v === "org-1")).toBe(true);
  });

  it("a failed read leaves the field out, even if rows came back with the error", async () => {
    const snap = await loadSnapshot(fakeDb({ data: ROWS, error: { message: "boom" } }).db, "org-1", NOW);
    expect("onboarding" in snap).toBe(false);
  });
});
