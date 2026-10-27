// M-3 and M-4 of the audit: reading the setup data must fail loudly, and must not hand out bookkeeping columns.
import { describe, expect, it } from "vitest";
import { loadSetupData, loadSetupGuideExtras, loadSetupSnoozes, type Db } from "@/lib/org-data";

type Res = { data?: unknown; error?: { message: string } | null; count?: number };
function fakeDb(results: Record<string, Res>): Db {
  const from = (table: string) => {
    const r = { data: [], error: null, ...results[table] } as Res;
    const b: unknown = new Proxy(function () {}, {
      get: (_t, k: string) => {
        if (k === "then") return (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(r).then(res, rej);
        if (k === "maybeSingle") return () => Promise.resolve({ ...r, data: Array.isArray(r.data) ? null : r.data });
        return () => b;
      },
    });
    return b;
  };
  return { from } as unknown as Db;
}

describe("loadSetupData (M-3, M-4)", () => {
  it("M-3: a failed query throws instead of reading as an empty table", async () => {
    for (const table of ["organizations", "segments", "icp_profiles", "positioning", "messaging_pillars", "quotas", "accounts", "deals"]) {
      await expect(loadSetupData(fakeDb({ [table]: { data: null, error: { message: `boom ${table}` } } }), "o1"), table).rejects.toThrow(`boom ${table}`);
    }
  });

  it("M-3: the postponements and the activity throw too, so a failed read is not «nothing postponed» or «no activity»", async () => {
    await expect(loadSetupSnoozes(fakeDb({ setup_step_snoozes: { data: null, error: { message: "no snoozes" } } }), "o1")).rejects.toThrow("no snoozes");
    await expect(loadSetupGuideExtras(fakeDb({ deals: { data: null, error: { message: "no deals" } } }), "o1")).rejects.toThrow("no deals");
    await expect(loadSetupGuideExtras(fakeDb({ organizations: { data: null, error: { message: "no org" } } }), "o1")).rejects.toThrow("no org");
  });

  it("M-4: the positioning handed out has none of the bookkeeping columns (last_human_edit_at, copy_status, field_sources)", async () => {
    const row = { id: "p1", category: "CRM", copy_status: { tagline: {} }, field_sources: { category: {} }, last_human_edit_at: "2026-10-26T10:00:00Z" };
    const d = await loadSetupData(fakeDb({ positioning: { data: row } }), "o1");
    expect(d.positioning).toEqual({ id: "p1", category: "CRM" });
    expect(JSON.stringify(d.positioning)).not.toContain("last_human_edit_at");
  });

  it("with every query fine it reads the data as before", async () => {
    const d = await loadSetupData(fakeDb({ organizations: { data: { currency: "EUR" } }, accounts: { count: 2 }, deals: { count: 1 } }), "o1");
    expect(d).toMatchObject({ currency: "EUR", accounts: 2, deals: 1, positioning: null });
  });
});
