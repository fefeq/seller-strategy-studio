import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { invalidateSetup } from "./setup-invalidation";

const seed = (qc: QueryClient, ...keys: unknown[][]) => keys.forEach((k) => qc.setQueryData(k, 1));
const stale = (qc: QueryClient, key: unknown[]) => qc.getQueryState(key)!.isInvalidated;

describe("invalidateSetup", () => {
  it("CA-1: invalidates the setup and guide queries of every org and leaves the rest alone", async () => {
    const qc = new QueryClient();
    seed(
      qc,
      ["setup", "org-1"],
      ["setup", "org-2"],
      ["setup-guide", "snoozes", "org-1"],
      ["setup-guide", "activity", "org-1"],
      ["accounts"],
      ["metrics"],
    );
    await invalidateSetup(qc);
    for (const k of [
      ["setup", "org-1"],
      ["setup", "org-2"],
      ["setup-guide", "snoozes", "org-1"],
      ["setup-guide", "activity", "org-1"],
    ])
      expect(stale(qc, k), JSON.stringify(k)).toBe(true);
    expect(stale(qc, ["accounts"])).toBe(false);
    expect(stale(qc, ["metrics"])).toBe(false);
  });
});
