import { expect, it, vi } from "vitest";
import type { ToolCtx } from "@/lib/agent/tool-kit";
const execute = vi.hoisted(() => vi.fn(async () => ({ mensaje: "Resultado sintético" })));
vi.mock("@/lib/agent/tools", () => ({ executeTool: execute, getTool: () => ({}) }));
import { decidePending } from "@/lib/agent.functions";

it("two concurrent confirmations run the same action once and cancellation cannot undo a claim", async () => {
  let status = "pending";
  const db = {
    from: () => {
      let update: Record<string, unknown> | undefined;
      let conditional = false;
      const q = {
        select: () => q,
        eq: (key: string, value: unknown) => {
          if (key === "status" && value === "pending") conditional = true;
          return q;
        },
        update: (value: Record<string, unknown>) => {
          update = value;
          return q;
        },
        maybeSingle: async () => ({
          data: {
            id: "a",
            status,
            tool: "synthetic",
            args: {},
            summary: "Sintética",
            result: "",
            conversation_id: null,
          },
        }),
        then: (resolve: (v: unknown) => void) => {
          if (conditional && status !== "pending") return resolve({ data: [], error: null });
          if (update?.status) status = String(update.status);
          resolve({ data: [{ id: "a" }], error: null });
        },
      };
      return q;
    },
  };
  const ctx = {
    db,
    orgId: "org",
    userId: "user",
    roles: ["owner"],
    currency: "EUR",
  } as unknown as ToolCtx;
  const results = await Promise.all([
    decidePending(ctx, "a", "confirm"),
    decidePending(ctx, "a", "confirm"),
    decidePending(ctx, "a", "cancel"),
  ]);
  expect(execute).toHaveBeenCalledOnce();
  expect(status).toBe("confirmed");
  expect(results.some((r) => r.status === "cancelled")).toBe(false);
});
