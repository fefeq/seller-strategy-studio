import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import type { Db } from "@/lib/org-data";
import { createAccount } from "./create-account";

const db = (error: unknown) => {
  const writes: { t: string; row: unknown }[] = [];
  const supabase = {
    from: (t: string) => ({
      insert: (row: unknown) => {
        writes.push({ t, row });
        return {
          select: () => ({ single: async () => ({ data: error ? null : { id: "acc-1" }, error }) }),
          then: (r: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(r),
        };
      },
    }),
  } as unknown as Db;
  return { supabase, writes };
};
const seeded = () => {
  const qc = new QueryClient();
  qc.setQueryData(["setup", "org-1"], 1);
  qc.setQueryData(["setup-guide", "snoozes", "org-1"], 1);
  return qc;
};
const stale = (qc: QueryClient, key: unknown[]) => qc.getQueryState(key)!.isInvalidated;

describe("createAccount", () => {
  it("CA-1: on success inserts the account and its plan, returns the id and refreshes the guide", async () => {
    const qc = seeded();
    const { supabase, writes } = db(null);
    expect(
      await createAccount(supabase, qc, { name: "Empresa Demo", domain: "demo.test" }),
    ).toEqual({ id: "acc-1", error: null });
    expect(writes).toEqual([
      { t: "accounts", row: { name: "Empresa Demo", domain: "demo.test" } },
      { t: "account_plans", row: { account_id: "acc-1" } },
    ]);
    expect(stale(qc, ["setup", "org-1"])).toBe(true);
    expect(stale(qc, ["setup-guide", "snoozes", "org-1"])).toBe(true);
  });

  it("CA-1: on error returns it, creates no plan and refreshes nothing", async () => {
    const qc = seeded();
    const err = { message: "boom" };
    const { supabase, writes } = db(err);
    expect(await createAccount(supabase, qc, { name: "x", domain: "" })).toEqual({
      id: null,
      error: err,
    });
    expect(writes.map((w) => w.t)).toEqual(["accounts"]);
    expect(stale(qc, ["setup", "org-1"])).toBe(false);
  });
});
