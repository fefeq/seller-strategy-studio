import { describe, expect, it } from "vitest";
import { TOOLS } from "../tools";
import { connectionHref } from "./parity";

const byName = (n: string) => TOOLS.find((t) => t.name === n);

describe("E3/E4 agent tools", () => {
  it("registers onboarding-by-chat and parity tools", () => {
    for (const n of ["start_onboarding_read", "list_onboarding_blocks", "approve_onboarding_block", "list_memories", "remember", "list_rules", "list_connections", "get_advisor_recommendations"])
      expect(byName(n), n).toBeDefined();
  });
  it("onboarding writes and remember need confirmation; reads run now", () => {
    expect(byName("start_onboarding_read")?.kind).toBe("write");
    expect(byName("approve_onboarding_block")?.kind).toBe("write");
    expect(byName("remember")?.kind).toBe("write");
    expect(byName("list_connections")?.kind).toBe("read");
  });
  it("Advisor stays for Owner and Sales Leader", () => {
    expect(byName("get_advisor_recommendations")?.roles).toEqual(["owner", "sales_leader"]);
  });
  it("connection links point at the card on Conexiones", () => {
    expect(connectionHref("apollo")).toBe("/integrations#conexion-apollo");
  });
});
