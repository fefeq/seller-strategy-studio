// NK-0170: the members of the guide read as «nobody» when the query failed, and closing the session showed «out of date».
import { expect, it } from "vitest";
import { loadGuideMembers, type Db } from "@/lib/org-data";
import { SessionEndedError, failedForReal } from "@/lib/session-ending";

type Res = { data?: unknown; error?: { message: string } | null };
function fakeDb(results: Record<string, Res>): Db {
  const from = (table: string) => {
    const r = { data: [], error: null, ...results[table] } as Res;
    const b: unknown = new Proxy(function () {}, {
      get: (_t, k: string) => {
        if (k === "then")
          return (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
            Promise.resolve(r).then(res, rej);
        return () => b;
      },
    });
    return b;
  };
  return { from } as unknown as Db;
}

it("a failed read of the members throws instead of answering «nobody»", async () => {
  await expect(
    loadGuideMembers(
      fakeDb({ org_members: { data: null, error: { message: "no members" } } }),
      "o1",
    ),
  ).rejects.toMatchObject({ message: "no members" });
  await expect(
    loadGuideMembers(
      fakeDb({
        org_members: { data: [{ user_id: "u1", role: "owner" }] },
        profiles: { data: null, error: { message: "no profiles" } },
      }),
      "o1",
    ),
  ).rejects.toMatchObject({ message: "no profiles" });
});

it("members come with their role and name", async () => {
  const out = await loadGuideMembers(
    fakeDb({
      org_members: {
        data: [
          { user_id: "u1", role: "owner" },
          { user_id: "u2", role: "seller" },
        ],
      },
      profiles: { data: [{ id: "u1", full_name: "Persona Sintética" }] },
    }),
    "o1",
  );
  expect(out).toEqual([
    { user_id: "u1", role: "owner", name: "Persona Sintética" },
    { user_id: "u2", role: "seller", name: null },
  ]);
});

it("a read stopped because the session is closing is not a failure; any other error is", () => {
  expect(failedForReal({ isError: true, error: new SessionEndedError() })).toBe(false);
  expect(failedForReal({ isError: true, error: new Error("network") })).toBe(true);
  expect(failedForReal({ isError: false, error: null })).toBe(false);
});
