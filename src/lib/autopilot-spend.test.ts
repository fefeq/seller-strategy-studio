import { describe, expect, it } from "vitest";
import { autopilotSpendProposals } from "@/lib/autopilot";
import { SPEND_TOOLS, SPENDING_READS } from "@/lib/agent/spend-confirm";

describe("autopilot never spends on its own", () => {
  it("a new account yields only proposals of paid tools that need confirmation", () => {
    const p = autopilotSpendProposals({ id: "a" }, true).map((x) => x.tool);
    expect(p).toEqual(["complete_account", "research_account"]);
    for (const t of p) {
      expect(SPEND_TOOLS[t]).toBeTruthy();
      expect((SPENDING_READS as readonly string[]).includes(t)).toBe(true);
    }
  });
  it("without auto-enrich it only proposes the web research", () => {
    expect(autopilotSpendProposals({ id: "a" }, false).map((x) => x.tool)).toEqual([
      "research_account",
    ]);
  });
});

import { readFileSync } from "node:fs";
it("autopilot.server.ts calls no paid core directly (only pending actions)", () => {
  const src = readFileSync("src/lib/autopilot.server.ts", "utf8");
  for (const f of ["completeAccount(", "researchAccountCore(", "trackedRun(", "applyAutoChanges("])
    expect(src).not.toContain(f);
  expect(src).toContain('from("agent_pending_actions")');
});
