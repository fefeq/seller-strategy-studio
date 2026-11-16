// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({
  handlers: new Map<string, (arg: unknown) => Promise<unknown>>(),
  result: {
    researched: 2,
    prepped: 3,
    cooling: 4,
    notes: ["SYNTHETIC-ERROR-159", "SYNTHETIC-TITLE-159"],
    extra: "SYNTHETIC-EXTRA-159",
  },
  notify: vi.fn(),
}));
vi.mock("inngest", () => ({
  Inngest: class {
    createFunction(config: { id: string }, handler: (arg: unknown) => Promise<unknown>) {
      fake.handlers.set(config.id, handler);
      return handler;
    }
  },
}));
vi.mock("inngest/edge", () => ({ serve: () => async () => new Response() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));
vi.mock("@/lib/inngest/tasks.server", () => ({
  maintainSuggestions: async () => ({ detected: 0 }),
  maintainStripe: async () => ({ skipped: true }),
  maintainPosthog: async () => ({ ok: true }),
  maintainSignals: async () => ({ added: 0 }),
  leadsToEnrich: async () => [],
}));
vi.mock("@/lib/discoveries.server", () => ({ discoverForOrg: async () => ({ added: 0 }) }));
vi.mock("@/lib/autopilot.server", () => ({ autopilotForOrg: async () => fake.result }));
vi.mock("@/lib/notices.server", () => ({ notifyAutopilot: fake.notify }));
import { inngestHandler } from "./functions.server";

describe("NK-0159 durable autopilot boundary", () => {
  it("persists only counts inside the step and final output while preserving the notifier input", async () => {
    inngestHandler();
    const run = fake.handlers.get("org-maintenance");
    if (!run) throw new Error("Missing maintenance handler");
    const outputs = new Map<string, unknown>();
    const out = await run({
      event: { data: { org_id: "synthetic-org" } },
      step: {
        run: async (name: string, fn: () => Promise<unknown>) => {
          const value = await fn();
          outputs.set(name, value);
          return value;
        },
      },
    });
    const serialized = JSON.stringify({ step: outputs.get("autopilot"), final: out });
    expect(serialized).not.toContain("SYNTHETIC-ERROR-159");
    expect(serialized).not.toContain("SYNTHETIC-TITLE-159");
    expect(serialized).not.toContain("SYNTHETIC-EXTRA-159");
    expect(outputs.get("autopilot")).toEqual({
      researched: 2,
      prepped: 3,
      cooling: 4,
      noteCount: 2,
    });
    expect(out).toMatchObject({ autopilot: outputs.get("autopilot") });
    expect(fake.notify).toHaveBeenCalledWith({}, "synthetic-org", fake.result);
    expect(fake.result.notes).toEqual(["SYNTHETIC-ERROR-159", "SYNTHETIC-TITLE-159"]);
  });
});
