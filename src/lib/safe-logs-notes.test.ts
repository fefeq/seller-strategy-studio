// @vitest-environment node
// NK-0149 gate rework: autopilotForOrg and discoverForOrg collect notes from (e as Error).message plus a meeting
// title or an ICP name, and used to log the whole array. The notes are still returned as before, but no console.*
// argument may carry the error text or the customer-written text, only counts. Fictional witnesses.
import { inspect } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const WITNESS_ERROR = "WITNESS-ERROR-7f3a";
const WITNESS_TITLE = "WITNESS-TITLE-Reunion-Secreta";

vi.mock("@/lib/ai-core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai-core")>()),
  meetingBriefCore: () => Promise.reject(new Error(WITNESS_ERROR)),
}));

vi.mock("@/lib/orchestrator/runner", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/orchestrator/runner")>()),
  findIcpCompanies: () => Promise.reject(new Error(WITNESS_ERROR)),
}));

import { autopilotForOrg } from "@/lib/autopilot.server";
import { discoverForOrg } from "@/lib/discoveries.server";

type Db = Parameters<typeof autopilotForOrg>[0];

/** A db whose every query resolves to `rows[table]`, or rejects with the witness error for the tables in `failing`. */
function fakeDb(failing: string[], rows: Record<string, unknown[]> = {}): Db {
  const chain = (table: string): unknown =>
    new Proxy(
      {},
      {
        get: (_t, p) => {
          const settle = () =>
            failing.includes(table)
              ? Promise.reject(new Error(WITNESS_ERROR))
              : Promise.resolve({ data: rows[table] ?? null, error: null, count: 0 });
          if (p === "then")
            return (f: (v: unknown) => unknown, r?: (e: unknown) => unknown) => settle().then(f, r);
          if (p === "maybeSingle" || p === "single") return () => settle();
          return () => chain(table);
        },
      },
    );
  return { from: (t: string) => chain(t) } as unknown as Db;
}

const logs: unknown[][] = [];
beforeEach(() => {
  logs.length = 0;
  for (const m of ["error", "warn", "log", "info", "debug", "trace"] as const)
    vi.spyOn(console, m).mockImplementation((...a: unknown[]) => void logs.push(a));
});
afterEach(() => vi.restoreAllMocks());

const serialized = () => inspect(logs, { depth: 8, maxStringLength: Infinity, maxArrayLength: null });

describe("notes never carry error text or customer text into console.* (NK-0149 gate rework)", () => {
  it("autopilotForOrg: an error thrown while reading is returned in the notes, not logged", async () => {
    const out = await autopilotForOrg(fakeDb(["accounts", "meetings", "account_touches"]), "org-1");
    expect(out.notes.length).toBeGreaterThan(0);
    expect(out.notes.join(" ")).toContain(WITNESS_ERROR);
    expect(logs.some((a) => a[0] === "autopilot notes")).toBe(true);
    expect(serialized()).not.toContain(WITNESS_ERROR);
  });

  it("autopilotForOrg: a meeting title (customer text) is returned in the notes, not logged", async () => {
    const soon = new Date(Date.now() + 3_600_000).toISOString();
    const db = fakeDb([], {
      meetings: [
        { id: "m1", title: WITNESS_TITLE, scheduled_at: soon, ai_brief: null, account_id: null, created_by: "u1" },
      ],
    });
    const out = await autopilotForOrg(db, "org-1");
    expect(out.notes.join(" ")).toContain(WITNESS_TITLE);
    expect(logs.some((a) => a[0] === "autopilot notes")).toBe(true);
    expect(serialized()).not.toContain(WITNESS_TITLE);
    expect(serialized()).not.toContain(WITNESS_ERROR);
  });

  it("autopilotForOrg: the log keeps only the count", async () => {
    const out = await autopilotForOrg(fakeDb(["accounts", "meetings", "account_touches"]), "org-1");
    const call = logs.find((a) => a[0] === "autopilot notes");
    expect(call?.[1]).toBe("org-1");
    expect(call?.[2]).toEqual({ count: out.notes.length });
  });

  it("discoverForOrg: an error thrown while searching is returned in the notes, not logged", async () => {
    const out = await discoverForOrg(fakeDb(["icp_profiles", "positioning"]), "org-1", new Date(), {
      force: true,
    });
    expect(out.notes.join(" ")).toContain(WITNESS_ERROR);
    const call = logs.find((a) => a[0] === "discoveries notes");
    expect(call?.[2]).toEqual({ count: out.notes.length });
    expect(serialized()).not.toContain(WITNESS_ERROR);
  });

  it("discoverForOrg: an ICP name (customer text) is returned in the notes, not logged", async () => {
    const db = fakeDb(["companies", "contacts"], {
      icp_profiles: [{ id: "i1", name: WITNESS_TITLE, criteria: {}, active: true }],
    });
    const out = await discoverForOrg(db, "org-1", new Date(), { force: true });
    expect(out.notes.join(" ")).toContain(`«${WITNESS_TITLE}»`);
    expect(logs.some((a) => a[0] === "discoveries notes")).toBe(true);
    expect(serialized()).not.toContain(WITNESS_TITLE);
    expect(serialized()).not.toContain(WITNESS_ERROR);
  });
});
