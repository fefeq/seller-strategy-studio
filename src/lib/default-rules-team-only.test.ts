import { describe, expect, it } from "vitest";
import { defaultRules, missingDefaultRuleTitles } from "./default-rules";

// NK-0177/NK-0178: a personal rule with a base title does not count as the team's base rule.
const fake = (rows: object[]) => ({
  from: () => {
    const q = { select: () => q, eq: () => q, then: (r: (v: unknown) => void) => r({ data: rows, error: null }) };
    return q;
  },
}) as never;

describe("base rules count only team rules", () => {
  it("still lists a base rule whose title only exists as a personal rule", async () => {
    const first = defaultRules()[0]!.title;
    const missing = await missingDefaultRuleTitles({ db: fake([{ org_id: "o", section: "rules", title: ` ${first.toUpperCase()} `, scope: "personal" }]), orgId: "o" });
    expect(missing).toContain(first);
    const none = await missingDefaultRuleTitles({ db: fake([{ org_id: "o", section: "rules", title: ` ${first.toUpperCase()} `, scope: "team" }]), orgId: "o" });
    expect(none).not.toContain(first);
  });
});
