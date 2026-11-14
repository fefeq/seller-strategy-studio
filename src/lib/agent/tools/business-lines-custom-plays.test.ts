// NK-0167 SDD 4 + NK-0171: assistant tools for business lines (never the ticket) and custom-play controls.
import { describe, expect, it, vi } from "vitest";
import { getTool, type ToolCtx } from "@/lib/agent/tools";
import { TITLES } from "@/lib/mcp/tools/agent-tools";

function db(rows: Record<string, unknown[]>) {
  const from = (table: string) => {
    const q: Record<string, unknown> = {};
    const chain = () => q;
    for (const m of ["select", "eq", "in", "order", "limit", "is"]) q[m] = chain;
    q.then = (a: (v: unknown) => unknown) => Promise.resolve({ data: rows[table] ?? [], error: null }).then(a);
    return q;
  };
  return { from } as unknown as ToolCtx["db"];
}
const ctx = (d: ToolCtx["db"], roles = ["member"]): ToolCtx => ({ db: d, orgId: "o1", userId: "u1", roles, currency: "EUR" });

describe("list_business_lines", () => {
  it("never returns the annual ticket and marks the primary line", async () => {
    const out = await getTool("list_business_lines")!.run(ctx(db({ business_lines: [
      { id: "a", org_id: "o1", name: "Enterprise", is_primary: true, position: 0, model: "b2b", acv: 80000, friction: "committee", stage: "scale" },
      { id: "b", org_id: "o2", name: "Ajena", is_primary: false, position: 1, model: "b2b", acv: 6000, friction: "self_serve", stage: "early" },
    ] })), {}) as Array<Record<string, unknown>>;
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ nombre: "Enterprise", principal: true });
    expect(JSON.stringify(out)).not.toMatch(/80000|80\.000|acv/);
  });
});

describe("custom play tools", () => {
  it("lists plays with state, no definition text", async () => {
    const out = await getTool("list_custom_plays")!.run(ctx(db({ custom_plays: [
      { id: "p", key: "k", name: "R-1", status: "pausado", execution_pause: null, first_activated_at: null, test_sample: null, test_successes: null, org_id: "o1", definition: { trigger: "secreto" } },
    ], custom_play_runs: [{ play_id: "p", status: "done", created_at: "2026-11-14" }] })), {}) as Array<Record<string, unknown>>;
    expect(out[0]).toMatchObject({ nombre: "R-1", estado: "pausado", ultima_ejecucion: { estado: "done" } });
    expect(JSON.stringify(out)).not.toContain("secreto");
  });
  it("activate and pause are confirmed writes only for Owner and Sales Leader", async () => {
    for (const n of ["activate_custom_play", "pause_custom_play"]) {
      const t = getTool(n)!;
      expect(t.kind).toBe("write");
      expect(t.roles).toEqual(["owner", "sales_leader"]);
      await expect(t.run(ctx(db({})), { play_id: "00000000-0000-0000-0000-000000000000" })).rejects.toThrow(/Owner o un Sales Leader/);
    }
  });
  it("every new tool has an MCP title", () => {
    for (const n of ["list_business_lines", "list_custom_plays", "activate_custom_play", "pause_custom_play"]) expect(TITLES[n]).toBeTruthy();
  });
});
void vi;
