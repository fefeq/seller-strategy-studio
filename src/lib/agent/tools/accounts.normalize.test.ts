import { describe, expect, it } from "vitest";
import { executeTool, getTool, type ToolCtx } from "@/lib/agent/tools";

// SDD universal-field-definitions, CA-1 and CA-3: update_account saves size and country through the one rule.
type Q = { table: string; op: string; payload?: unknown };
function recordingDb() {
  const log: Q[] = [];
  const from = (table: string) => {
    const q: Q = { table, op: "select" };
    const proxy: object = new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === "then") {
            log.push(q);
            const res = { data: { id: ID, name: "Acme Test" }, error: null };
            return (a: (v: unknown) => unknown, b: (e: unknown) => unknown) =>
              Promise.resolve(res).then(a, b);
          }
          return (...args: unknown[]) => {
            if (prop === "update" || prop === "insert") {
              q.op = prop;
              q.payload = args[0];
            }
            return proxy;
          };
        },
      },
    );
    return proxy;
  };
  return { db: { from } as unknown as ToolCtx["db"], log };
}
const ID = "00000000-0000-4000-8000-000000000003";
const ctx = (db: ToolCtx["db"]): ToolCtx => ({
  db,
  orgId: "org-1",
  userId: "11111111-1111-4111-8111-111111111111",
  roles: ["ae"],
  currency: "EUR",
});
// The values written; their origin mark (field_sources) is covered in agent-tools.test.ts (NK-0022).
const patchOf = (log: Q[]) => {
  const sent = log.find((q) => q.table === "accounts" && q.op === "update")?.payload as
    Record<string, unknown> | undefined;
  if (!sent) return undefined;
  const { field_sources: _marks, ...values } = sent;
  return values;
};

describe("update_account normalizes size and country on save", () => {
  it("writes «51 a 200» as the canonical headcount text", async () => {
    const { db, log } = recordingDb();
    await executeTool(ctx(db), "update_account", { account_id: ID, size: "51 a 200" });
    expect(patchOf(log)).toEqual({ size: "51–200 empleados" });
  });

  it("writes a plain headcount in the same shape", async () => {
    const { db, log } = recordingDb();
    await executeTool(ctx(db), "update_account", { account_id: ID, size: "1.200 empleados" });
    expect(patchOf(log)).toEqual({ size: "1200 empleados" });
  });

  it("does not hide a size that is not a headcount: it tells the person", async () => {
    const { db, log } = recordingDb();
    const r = (await executeTool(ctx(db), "update_account", {
      account_id: ID,
      size: "scale-up",
    })) as { mensaje?: string };
    expect(r.mensaje ?? "").toMatch(/scale-up/);
    expect(r.mensaje ?? "").toMatch(/empleados/);
    expect(r.mensaje?.match(/número de empleados/g)).toHaveLength(1);
    expect(patchOf(log)).toEqual({ size: "scale-up" });
  });

  it("keeps clearing a size and an ISO country as before", async () => {
    const { db, log } = recordingDb();
    await executeTool(ctx(db), "update_account", { account_id: ID, size: "  ", country: "es" });
    expect(patchOf(log)).toEqual({ size: null, country: "ES" });
  });

  it("accepts a country by name, as the single rule does", async () => {
    const { db, log } = recordingDb();
    await executeTool(ctx(db), "update_account", { account_id: ID, country: "España" });
    expect(patchOf(log)).toEqual({ country: "ES" });
  });

  it("refuses an unknown country naming it, and writes nothing", async () => {
    const { db, log } = recordingDb();
    await expect(
      executeTool(ctx(db), "update_account", { account_id: ID, country: "Narnia" }),
    ).rejects.toThrow(/Narnia/);
    expect(patchOf(log)).toBeUndefined();
  });

  // Agent, MCP and Telegram all validate with this schema when they propose, so the refusal must happen here and not only on confirm.
  it("refuses an unknown country when it is proposed, and accepts an ISO code or a name", () => {
    const input = getTool("update_account")!.input;
    for (const country of ["Narnia", "USA", "UK", "", "   "]) {
      expect(input.safeParse({ account_id: ID, country }).success, country).toBe(false);
    }
    for (const country of ["España", "es", "United Kingdom"]) {
      expect(input.safeParse({ account_id: ID, country }).success, country).toBe(true);
    }
    expect(input.safeParse({ account_id: ID, country: null }).success).toBe(true);
  });
});
