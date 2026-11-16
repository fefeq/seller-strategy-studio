import { describe, expect, it } from "vitest";
import { addDefaultRulesCore, defaultRules, missingDefaultRuleTitles } from "./default-rules";
import type { Db } from "./org-data";

describe("NK-0177 personal rules never substitute team defaults", () => {
  it("filters scope in the query and creates team defaults even when all titles exist personally", async () => {
    const filters: unknown[][] = [];
    const inserted: Record<string, unknown>[] = [];
    const rows = defaultRules().map((r) => ({
      org_id: "synthetic-org",
      section: "rules",
      title: r.title,
      scope: "personal",
    }));
    const query = {
      select: () => query,
      eq: (key: string, value: string) => {
        filters.push([key, value]);
        return query;
      },
      then: (resolve: (out: unknown) => void) => resolve({ data: rows, error: null }),
      insert: async (values: Record<string, unknown>[]) => {
        inserted.push(...values);
        return { error: null };
      },
    };
    const db = { from: () => query } as unknown as Db;
    const context = { db, orgId: "synthetic-org", userId: "synthetic-user", roles: ["owner"] };
    expect(await missingDefaultRuleTitles(context)).toHaveLength(9);
    expect(filters).toContainEqual(["scope", "team"]);
    const result = await addDefaultRulesCore(context);
    expect(result.added).toBe(9);
    expect(inserted).toHaveLength(9);
    expect(inserted.every((r) => r.scope === "team" && r.org_id === "synthetic-org")).toBe(true);
  });
});
