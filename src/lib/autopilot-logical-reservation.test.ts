// @vitest-environment node
import { expect, it, vi } from "vitest";
import type { ToolCtx } from "@/lib/agent/tool-kit";
const state = vi.hoisted(() => ({ keys: new Set<string>(), calls: 0 }));
vi.mock("@/lib/ai-core", () => ({
  meetingBriefCore: async () => {
    state.calls++;
    return { brief: "Synthetic example.com" };
  },
  accountContext: async () => "",
}));
import { executeAutopilotAi } from "@/lib/autopilot-ai.server";
it("different confirmed actions for the same company meeting make one paid call", async () => {
  state.keys.clear();
  state.calls = 0;
  // The admin client reads its settings when first used; synthetic values keep this test independent of the host. fetch is stubbed below, so nothing leaves the process.
  vi.stubEnv("SUPABASE_URL", "https://example.invalid");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "synthetic");
  vi.stubGlobal("fetch", async (_url: unknown, init?: RequestInit) => {
    const row = JSON.parse(String(init?.body)) as { name: string };
    if (state.keys.has(row.name))
      return new Response(JSON.stringify({ code: "23505", message: "synthetic duplicate" }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      });
    state.keys.add(row.name);
    return new Response("", { status: 201 });
  });
  const db = {
    from: () => {
      const q = {
        select: () => q,
        eq: () => q,
        in: () => q,
        update: () => q,
        maybeSingle: async () => ({
          data: { id: "meeting", user_id: "u", ai_brief: null },
          error: null,
        }),
        then: (resolve: (r: unknown) => void) => resolve({ error: null }),
      };
      return q;
    },
  } as unknown as ToolCtx["db"];
  const c = { db, orgId: "org", userId: "u", roles: ["owner"], currency: "EUR" } as ToolCtx;
  const r = await Promise.all([
    executeAutopilotAi(c, "autopilot_prepare_meeting", { meeting_id: "meeting" }),
    executeAutopilotAi(c, "autopilot_prepare_meeting", { meeting_id: "meeting" }),
  ]);
  expect(state.calls).toBe(1);
  expect(r.some((x) => x.mensaje.includes("No se ha repetido"))).toBe(true);
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
