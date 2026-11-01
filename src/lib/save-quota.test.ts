import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import type { Db } from "@/lib/org-data";
import { saveQuota } from "./save-quota";

const db = (error: unknown) => {
  const writes: unknown[] = [];
  const supabase = {
    from: (t: string) => ({
      upsert: async (row: unknown, opts: unknown) => {
        writes.push({ t, row, opts });
        return { error };
      },
    }),
  } as unknown as Db;
  return { supabase, writes };
};
const input = { orgId: "org-1", userId: "u-1", period: "2026-Q4", amount: 100 };
const seeded = () => {
  const qc = new QueryClient();
  for (const k of [["setup", "org-1"], ["setup-guide", "snoozes", "org-1"], ["metrics"]])
    qc.setQueryData(k, 1);
  return qc;
};
const stale = (qc: QueryClient, key: unknown[]) => qc.getQueryState(key)!.isInvalidated;

describe("saveQuota", () => {
  it("CA-1: on success writes the quota and refreshes the guide and the metrics", async () => {
    const qc = seeded();
    const { supabase, writes } = db(null);
    expect(await saveQuota(supabase, qc, input)).toBeNull();
    expect(writes).toEqual([
      {
        t: "quotas",
        row: { org_id: "org-1", user_id: "u-1", period: "2026-Q4", amount: 100 },
        opts: { onConflict: "org_id,user_id,period" },
      },
    ]);
    expect(stale(qc, ["setup", "org-1"])).toBe(true);
    expect(stale(qc, ["setup-guide", "snoozes", "org-1"])).toBe(true);
    expect(stale(qc, ["metrics"])).toBe(true);
  });

  it("CA-1: on error returns it and refreshes nothing", async () => {
    const qc = seeded();
    const err = { message: "boom" };
    expect(await saveQuota(db(err).supabase, qc, input)).toBe(err);
    for (const k of [["setup", "org-1"], ["setup-guide", "snoozes", "org-1"], ["metrics"]])
      expect(stale(qc, k)).toBe(false);
  });
});
