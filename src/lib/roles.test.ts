import { describe, expect, it } from "vitest";
import { canDecideApprovals, canDelete } from "./roles";

describe("permissions", () => {
  it("only owner can delete", () => {
    expect(canDelete(["owner"])).toBe(true);
    expect(canDelete(["ae", "sales_leader"])).toBe(false);
  });
  it("owner, sales leader and deal desk decide approvals; reps do not", () => {
    expect(canDecideApprovals(["deal_desk"])).toBe(true);
    expect(canDecideApprovals(["sales_leader"])).toBe(true);
    expect(canDecideApprovals(["sdr"])).toBe(false);
  });
});
