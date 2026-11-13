import { describe, expect, it, vi } from "vitest";
import { executeCustomPlay, type ExecutionPorts, type StepReceipt } from "./execution";
import type { Proposal } from "./propose";

const proposal: Proposal = {
  name: "Play sintético", trigger: "Aviso público fechado",
  window: { backDays: 30, forwardDays: 0 },
  steps: [
    { n: 1, source: "news", question: "¿Qué cambió?", returns: ["event_date"] },
    { n: 2, source: "web", question: "¿Qué dice la fuente?", returns: ["event_date"] },
  ],
  message: { claims: [{ text: "Cambio con fuente", step: 1 }], built: "Comparación", ask: "¿La revisas?" },
  test: { n: 2, k: 1, base: 2 }, verifiedOnly: false,
};
const now = new Date("2026-11-13T23:36:00Z");
const receipt = (step: number): StepReceipt => ({ step, evidenceCount: 1, suggestionCount: 0 });
function fixture() {
  const ports: ExecutionPorts = {
    load: vi.fn().mockResolvedValue({ status: "active", member: true, archived: false, proposal,
      sources: { services: ["firecrawl"], driveFolder: false, posthog: false } }),
    claim: vi.fn().mockResolvedValue(true),
    release: vi.fn().mockResolvedValue(undefined),
    checkpoint: vi.fn().mockResolvedValue(null),
    guard: vi.fn().mockResolvedValue({ active: true, cancelled: false, budgetPaused: false }),
    runStep: vi.fn().mockImplementation(async ({ step }) => receipt(step.n)),
    pause: vi.fn().mockResolvedValue(undefined),
  };
  return { ports, run: () => executeCustomPlay(ports, { orgId: "synthetic-org", playId: "synthetic-play", runId: "synthetic-run", userId: "synthetic-user", trigger: "automatic", now }) };
}

describe("NK-0171 U-4a: bounded, resumable execution boundary", () => {
  it("a non-active play makes zero provider calls", async () => {
    const f = fixture(); vi.mocked(f.ports.load).mockResolvedValueOnce({ status: "paused", member: true, archived: false, proposal, sources: { services: ["firecrawl"], driveFolder: false, posthog: false } });
    expect((await f.run()).status).toBe("skipped");
    expect(f.ports.claim).not.toHaveBeenCalled(); expect(f.ports.runStep).not.toHaveBeenCalled();
  });
  it("an unavailable source never simulates execution", async () => {
    const f = fixture(); vi.mocked(f.ports.load).mockResolvedValueOnce({ status: "active", member: true, archived: false, proposal, sources: { services: [], driveFolder: false, posthog: false } });
    expect((await f.run()).status).toBe("blocked"); expect(f.ports.runStep).not.toHaveBeenCalled();
  });
  it("removed members cannot execute with privileged access", async () => {
    const f = fixture(); vi.mocked(f.ports.load).mockResolvedValueOnce({ status: "active", member: false, archived: false, proposal, sources: { services: ["firecrawl"], driveFolder: false, posthog: false } });
    expect((await f.run()).status).toBe("skipped"); expect(f.ports.claim).not.toHaveBeenCalled();
  });
  it("a competing database lease prevents all provider calls", async () => {
    const f = fixture(); vi.mocked(f.ports.claim).mockResolvedValueOnce(false);
    expect((await f.run()).status).toBe("busy"); expect(f.ports.runStep).not.toHaveBeenCalled(); expect(f.ports.release).not.toHaveBeenCalled();
  });
  it("completed steps are reused, not paid for again", async () => {
    const f = fixture(); vi.mocked(f.ports.checkpoint).mockResolvedValueOnce(receipt(1));
    expect(await f.run()).toEqual({ status: "done", completedSteps: 2, evidenceCount: 2, suggestionCount: 0 });
    expect(f.ports.runStep).toHaveBeenCalledTimes(1);
    expect(vi.mocked(f.ports.runStep).mock.calls[0]?.[0].step.n).toBe(2);
    expect(f.ports.release).toHaveBeenCalledTimes(1);
  });
  it("automatic work stops at the budget limit before the next step", async () => {
    const f = fixture(); vi.mocked(f.ports.guard).mockResolvedValueOnce({ active: true, cancelled: false, budgetPaused: true });
    expect((await f.run()).status).toBe("blocked"); expect(f.ports.runStep).not.toHaveBeenCalled();
  });
  it("Q-6: manual work is not stopped by the budget limit", async () => {
    const f = fixture(); vi.mocked(f.ports.guard).mockResolvedValue({ active: true, cancelled: false, budgetPaused: true });
    expect((await executeCustomPlay(f.ports, { orgId: "synthetic-org", playId: "synthetic-play", runId: "synthetic-run", userId: "synthetic-user", trigger: "manual", now })).status).toBe("done");
    expect(f.ports.runStep).toHaveBeenCalledTimes(2);
  });
  it("pausing during execution stops subsequent steps", async () => {
    const f = fixture(); vi.mocked(f.ports.guard).mockResolvedValueOnce({ active: true, cancelled: false, budgetPaused: false }).mockResolvedValueOnce({ active: false, cancelled: false, budgetPaused: false });
    expect((await f.run()).completedSteps).toBe(1); expect(f.ports.runStep).toHaveBeenCalledTimes(1);
  });
  it("a provider denial is persisted and never retried or bypassed", async () => {
    const f = fixture(); vi.mocked(f.ports.runStep).mockRejectedValueOnce({ status: 403, message: "synthetic denial" });
    expect((await f.run()).status).toBe("paused");
    expect(f.ports.runStep).toHaveBeenCalledTimes(1);
    expect(f.ports.pause).toHaveBeenCalledWith(expect.objectContaining({ orgId: "synthetic-org", playId: "synthetic-play" }), "provider_denied");
    expect(f.ports.release).toHaveBeenCalledTimes(1);
  });
  it("refusals in a successful response stop the whole execution", async () => {
    const f = fixture(); vi.mocked(f.ports.runStep).mockRejectedValueOnce({ refusal: true });
    expect((await f.run()).status).toBe("paused"); expect(f.ports.runStep).toHaveBeenCalledTimes(1);
    expect(f.ports.pause).toHaveBeenCalledWith(expect.anything(), "refusal");
  });
  it("duplicate step ids block ambiguous checkpoints", async () => {
    const f = fixture(); vi.mocked(f.ports.load).mockResolvedValueOnce({ status: "active", member: true, archived: false, proposal: { ...proposal, steps: [proposal.steps[0], proposal.steps[0]] }, sources: { services: ["firecrawl"], driveFolder: false, posthog: false } });
    expect((await f.run()).status).toBe("blocked"); expect(f.ports.claim).not.toHaveBeenCalled();
  });
  it("durable outputs contain only counts and status, not customer text", async () => {
    const f = fixture(); const out = await f.run();
    expect(Object.keys(out).sort()).toEqual(["completedSteps", "evidenceCount", "status", "suggestionCount"]);
    expect(JSON.stringify(out)).not.toContain(proposal.name);
  });
});