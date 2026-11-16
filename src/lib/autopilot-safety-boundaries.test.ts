// @vitest-environment node
import { expect, it, vi } from "vitest";
import { ask } from "@/lib/ai-gateway";
import { autopilotForOrg } from "@/lib/autopilot.server";
import type { Db } from "@/lib/org-data";
it("a completed paid response with failed ledger persistence never calls a fallback provider", async () => {
  vi.stubEnv("OPENROUTER_API_KEY", "synthetic-not-a-secret");
  vi.stubEnv("GEMINI_API_KEY", "synthetic-not-a-secret");
  const fetcher = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "synthetic" } }],
          usage: { is_byok: false, cost: 0.02 },
        }),
        { status: 200 },
      ),
  );
  vi.stubGlobal("fetch", fetcher);
  try {
    await expect(
      ask("synthetic", "example.com", {
        onCost: async () => {
          throw new Error("Synthetic ledger failure");
        },
      }),
    ).rejects.toThrow("Synthetic ledger failure");
    expect(fetcher).toHaveBeenCalledOnce();
  } finally {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  }
});
it("the real pilot leaves unknown meeting and cooling work pending without IA or completion markers", async () => {
  const writes: { table: string; value: Record<string, unknown> }[] = [];
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const now = new Date("2026-11-15T08:00:00Z");
  const rows: Record<string, unknown> = {
    org_members: { user_id: "u" },
    organizations: { currency: "EUR" },
    lead_settings: { autopilot_action_threshold: 0 },
    meetings: [
      {
        id: "m",
        title: "Synthetic example.com",
        scheduled_at: "2026-11-15T09:00:00Z",
        ai_brief: null,
        created_by: "u",
      },
    ],
    accounts: [
      {
        id: "a",
        name: "Synthetic example.com",
        tier: "A",
        is_target: true,
        owner_id: "u",
        created_at: "2026-01-01T00:00:00Z",
      },
    ],
  };
  const db = {
    from: (table: string) => {
      let write: Record<string, unknown> | undefined;
      const q = {
        select: () => q,
        eq: () => q,
        is: () => q,
        gte: () => q,
        gt: () => q,
        lte: () => q,
        limit: () => q,
        order: () => q,
        in: () => q,
        insert: (value: Record<string, unknown>) => {
          write = value;
          writes.push({ table, value });
          return q;
        },
        update: (value: Record<string, unknown>) => {
          write = value;
          writes.push({ table, value });
          return q;
        },
        maybeSingle: async () => ({ data: rows[table] ?? null, error: null }),
        single: async () => ({ data: write ? { id: "pending" } : rows[table], error: null }),
        then: (resolve: (r: unknown) => void) => resolve({ data: rows[table] ?? [], error: null }),
      };
      return q;
    },
  } as unknown as Db;
  try {
    const r = await autopilotForOrg(db, "org", now);
    expect(
      writes.filter((w) => w.table === "agent_pending_actions").map((w) => w.value.tool),
    ).toEqual(["autopilot_prepare_meeting", "autopilot_review_account"]);
    expect(writes.some((w) => w.table === "meetings" && "auto_prepped_at" in w.value)).toBe(false);
    expect(writes.some((w) => w.table === "suggestions")).toBe(false);
    expect(r.prepped).toBe(0);
    expect(r.cooling).toBe(0);
    expect(fetcher).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
  }
});
