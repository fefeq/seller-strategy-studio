import { describe, expect, it } from "vitest";
import { buildOverview, cleanSummary, summaryState } from "./drive-overview";

const file = (id: string, modified: string, extra: Partial<{ isFolder: boolean; readable: boolean }> = {}) => ({
  id, name: id, kind: "Documento", isFolder: false, url: null, modified, readable: true, ...extra,
});

describe("summaryState", () => {
  it("keeps a summary while the file is unchanged and marks it stale once Drive shows a newer edit", () => {
    const row = { file_id: "a", summary: "x", file_modified_at: "2026-10-20T10:00:00+00:00" };
    expect(summaryState("2026-10-20T10:00:00.000Z", row)).toBe("fresh");
    expect(summaryState("2026-10-22T09:00:00.000Z", row)).toBe("stale");
    expect(summaryState("2026-10-22T09:00:00.000Z", undefined)).toBe("missing");
  });
});

describe("buildOverview", () => {
  it("lists only documents (not subfolders), newest first, and counts what still needs a summary", () => {
    const o = buildOverview(
      [
        { accountId: "acc1", accountName: "Acme", domain: null, folder: null, files: [file("old", "2026-09-01T00:00:00Z"), file("new", "2026-10-01T00:00:00Z"), file("sub", "2026-10-05T00:00:00Z", { isFolder: true })] },
        { accountId: "acc2", accountName: "Beta", domain: null, folder: null, files: [file("img", "2026-10-10T00:00:00Z", { readable: false })] },
      ],
      [{ file_id: "new", summary: "Propuesta", file_modified_at: "2026-10-01T00:00:00Z" }],
    );
    expect(o.accounts.map((a) => a.accountName)).toEqual(["Beta", "Acme"]);
    expect(o.accounts[1].docs.map((d) => [d.id, d.state])).toEqual([["new", "fresh"], ["old", "missing"]]);
    expect(o.totals).toEqual({ accounts: 2, docs: 3, pending: 1 });
    expect(o.pending).toEqual([{ fileId: "old", accountId: "acc1" }]);
  });
});

describe("cleanSummary", () => {
  it("turns the model output into one short paragraph", () => {
    expect(cleanSummary("## Resumen\n- **Propuesta** para Acme.\n- 12.000 € al año.")).toBe("Resumen Propuesta para Acme. 12.000 € al año.");
    expect(cleanSummary("x".repeat(700)).length).toBeLessThanOrEqual(601);
  });
});
