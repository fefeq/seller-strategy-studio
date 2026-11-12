// @vitest-environment node
// NK-0164 CA-1: one limit of documents per reading, shared by the client and the server schema.
import { describe, expect, it } from "vitest";
import { MAX_FILES, mergeFiles } from "./onboarding-sources";
import { onboardingReadInput } from "./onboarding-read-input";

const file = (n: number) => ({
  filename: `doc-${n}.pdf`,
  dataUrl: "data:application/pdf;base64,AAAA",
});
const input = (n: number) => ({
  depth: "express" as const,
  files: Array.from({ length: n }, (_, i) => file(i + 1)),
});

describe("onboarding_read documents limit (NK-0164 CA-1)", () => {
  it("the server schema accepts MAX_FILES documents and rejects one more", () => {
    expect(onboardingReadInput.safeParse(input(MAX_FILES)).success).toBe(true);
    const over = onboardingReadInput.safeParse(input(MAX_FILES + 1));
    expect(over.success).toBe(false);
    if (!over.success) {
      expect(over.error.issues[0]?.code).toBe("too_big");
      expect(over.error.issues[0]?.path).toEqual(["files"]);
    }
  });

  it("mergeFiles and the schema agree: what mergeFiles keeps the schema accepts", () => {
    const added = Array.from({ length: MAX_FILES + 2 }, (_, i) => file(i + 1));
    const { files, dropped } = mergeFiles([], added);
    expect(files).toHaveLength(MAX_FILES);
    expect(dropped).toHaveLength(2);
    expect(onboardingReadInput.safeParse({ depth: "express", files }).success).toBe(true);
  });

  it("the limit is 3 (what the reading and the request size were built for)", () => {
    expect(MAX_FILES).toBe(3);
  });
});
