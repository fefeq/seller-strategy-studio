// NK-0011 U-2: a manual search only spends on the kinds it was asked for (CA-6) and never moves the weekly clock (CA-11).
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/orchestrator/runner", () => ({ findIcpCompanies: vi.fn(), findKeyPeople: vi.fn() }));

type Call = { table: string; method: string; args: unknown[] };

/** A Supabase stand-in: every chain resolves to empty data and each call is recorded. */
function fakeDb() {
  const calls: Call[] = [];
  const chain = (table: string): unknown =>
    new Proxy(
      {},
      {
        get(_t, method: string) {
          if (method === "then") return (ok: (v: unknown) => unknown) => ok({ data: null, error: null });
          return (...args: unknown[]) => {
            calls.push({ table, method, args });
            return chain(table);
          };
        },
      },
    );
  const db = { from: (table: string) => chain(table) };
  return { db, calls };
}

async function run(opts: Parameters<typeof import("./discoveries.server").discoverForOrg>[3]) {
  const { discoverForOrg } = await import("./discoveries.server");
  const { db, calls } = fakeDb();
  await discoverForOrg(db as never, "org-1", new Date("2026-11-08T10:00:00Z"), opts);
  return calls;
}
const touched = (calls: Call[], table: string) => calls.some((c) => c.table === table);
const clockMoved = (calls: Call[]) => calls.some((c) => c.table === "job_locks" && c.method === "upsert");

describe("Descubiertos manual search scope (NK-0011)", () => {
  it("a manual search never moves the weekly clock, whatever its scope (CA-11)", async () => {
    expect(clockMoved(await run({ force: true, trigger: "manual", userId: "u-1" }))).toBe(false);
    expect(clockMoved(await run({ force: true, trigger: "manual", userId: "u-1", scope: { kinds: ["competitor"] } }))).toBe(false);
  });

  it("the weekly automatic search still marks its week", async () => {
    expect(clockMoved(await run({}))).toBe(true);
  });

  it("only competitors: no ICP, account or people lookups (CA-6)", async () => {
    const calls = await run({ force: true, trigger: "manual", userId: "u-1", scope: { kinds: ["competitor"] } });
    expect(touched(calls, "icp_profiles")).toBe(false);
    expect(touched(calls, "accounts")).toBe(false);
    expect(touched(calls, "positioning")).toBe(true);
  });

  it("companies or contacts read the ICPs of this company only", async () => {
    const calls = await run({ force: true, trigger: "manual", userId: "u-1", scope: { kinds: ["company"], icpIds: ["icp-1"] } });
    const icp = calls.filter((c) => c.table === "icp_profiles" && c.method === "eq");
    expect(icp.length).toBeGreaterThan(0);
    expect(icp.every((c) => c.args[0] === "org_id" && c.args[1] === "org-1")).toBe(true);
  });
});
