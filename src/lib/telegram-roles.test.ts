// NK-0042 (SDD-20261101 price-suggestions-visibility-server), CA-3 and CA-4: who sees price suggestions in the Telegram jobs.
// Fake clients; fictional ids; no network.
import { describe, expect, it } from "vitest";
import { applyPriceVisibility, loadMemberRoles, rolesOf } from "./telegram-roles";
import { canSeePrices, PRICE_DEDUPE_PREFIX } from "./strategy-suggestions";
import type { Db } from "./org-data";

const recordingBuilder = () => {
  const calls: unknown[][] = [];
  const q: {
    not: (...a: unknown[]) => typeof q;
    limit: (...a: unknown[]) => typeof q;
    calls: unknown[][];
  } = {
    calls,
    not: (...a) => (calls.push(["not", ...a]), q),
    limit: (...a) => (calls.push(["limit", ...a]), q),
  };
  return q;
};

describe("applyPriceVisibility: the filter is in the query", () => {
  it("without a price role the query excludes the price prefix", () => {
    const q = recordingBuilder();
    expect(applyPriceVisibility(q, false)).toBe(q);
    expect(q.calls).toEqual([["not", "dedupe_key", "like", `${PRICE_DEDUPE_PREFIX}%`]]);
    expect(PRICE_DEDUPE_PREFIX).toBe("strategy_product_price:price:");
  });
  it("with a price role the query is left as it is", () => {
    const q = recordingBuilder();
    expect(applyPriceVisibility(q, true)).toBe(q);
    expect(q.calls).toEqual([]);
  });
  it("it adds nothing after a limit: the caller limits after filtering", () => {
    const q = recordingBuilder();
    applyPriceVisibility(q, false).limit(50);
    expect(q.calls.map((c) => c[0])).toEqual(["not", "limit"]);
  });
});

const O1 = "org-1",
  O2 = "org-2",
  U1 = "u-1",
  U2 = "u-2",
  U3 = "u-3";
function fakeRoles(result: { data: unknown; error: unknown }) {
  const log: unknown[][] = [];
  const db = {
    from: (t: string) => ({
      select: (cols: string) => ({
        in: (col: string, ids: string[]) => (
          log.push([t, cols, col, ids]),
          Promise.resolve(result)
        ),
      }),
    }),
  } as unknown as Db;
  return { db, log };
}

describe("loadMemberRoles: one query for everybody, crossed by organisation and person", () => {
  it("reads org_id, user_id, role with .in(user_id) once and groups them", async () => {
    const { db, log } = fakeRoles({
      data: [
        { org_id: O1, user_id: U1, role: "owner" },
        { org_id: O1, user_id: U1, role: "ae" },
        { org_id: O2, user_id: U1, role: "ae" },
        { org_id: O1, user_id: U2, role: "ae" },
      ],
      error: null,
    });
    const roles = await loadMemberRoles(db, [U1, U2, U3, U1]);
    expect(log).toEqual([["org_members", "org_id,user_id,role", "user_id", [U1, U2, U3]]]);
    expect(rolesOf(roles, O1, U1)).toEqual(["owner", "ae"]);
    expect(rolesOf(roles, O2, U1)).toEqual(["ae"]); // the role in another organisation does not count
    expect(canSeePrices(rolesOf(roles, O1, U1))).toBe(true);
    expect(canSeePrices(rolesOf(roles, O2, U1))).toBe(false);
    expect(rolesOf(roles, O1, U3)).toEqual([]); // no row: no permission
  });
  it("an error reading roles means nobody has the permission", async () => {
    const { db } = fakeRoles({ data: null, error: { message: "boom" } });
    const roles = await loadMemberRoles(db, [U1]);
    expect(canSeePrices(rolesOf(roles, O1, U1))).toBe(false);
  });
  it("no people, no query", async () => {
    const { db, log } = fakeRoles({ data: [], error: null });
    expect((await loadMemberRoles(db, [])).size).toBe(0);
    expect(log).toEqual([]);
  });
});
