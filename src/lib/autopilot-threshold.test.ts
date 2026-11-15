import { describe, expect, it, vi } from "vitest";
import { autopilotDecision, runAutopilotAction, canChangeThreshold } from "@/lib/autopilot-threshold";

describe("per-action autopilot threshold", () => {
  it("executes below the company threshold", () => expect(autopilotDecision(0.02, 0.03)).toBe("execute"));
  it("proposes above the threshold", () => expect(autopilotDecision(0.04, 0.03)).toBe("propose"));
  it("proposes without measured cost", () => expect(autopilotDecision(null, 0.03)).toBe("propose"));
  it("zero proposes always, even measured zero", () => expect(autopilotDecision(0, 0)).toBe("propose"));
  it("compares each action, not accumulated spend", () => expect([0.02, 0.02].map(n => autopilotDecision(n, 0.03))).toEqual(["execute", "execute"]));
  it("only Owner and Sales Leader may change it", () => {
    expect(canChangeThreshold(["owner"])).toBe(true);
    expect(canChangeThreshold(["sales_leader"])).toBe(true);
    for (const role of ["marketing", "sdr", "ae", "se", "cs", "deal_desk", "enablement"]) expect(canChangeThreshold([role])).toBe(false);
  });
  it("unknown and over-threshold actions never execute or mark work done", async () => {
    for (const cost of [null, 0.04]) {
      const execute = vi.fn();
      const propose = vi.fn(async () => "id");
      await runAutopilotAction(cost, 0.03, { propose, execute });
      expect(propose).toHaveBeenCalledOnce();
      expect(execute).not.toHaveBeenCalled();
    }
  });
  it("an allowed action executes only when its durable proposal was newly reserved", async () => {
    const execute = vi.fn();
    const propose = vi.fn().mockResolvedValueOnce("id").mockResolvedValueOnce(null);
    await runAutopilotAction(0.02, 0.03, { propose, execute });
    await runAutopilotAction(0.02, 0.03, { propose, execute });
    expect(execute).toHaveBeenCalledExactlyOnceWith("id");
  });
});