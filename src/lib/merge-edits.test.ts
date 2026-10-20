import { describe, expect, it } from "vitest";
import { mergeServerEdits } from "./merge-edits";

describe("mergeServerEdits", () => {
  const server = { id: "d1", name: "Acme", amount: 1000, stage: "demo", meddpicc: { m: { score: 1 } } };
  it("keeps fields edited locally and takes the rest from the server", () => {
    const edited = { ...server, name: "Acme renovación", meddpicc: { m: { score: 3 } } };
    const next = { ...server, stage: "proposal", amount: 1200 };
    expect(mergeServerEdits(edited, server, next)).toEqual({ id: "d1", name: "Acme renovación", amount: 1200, stage: "proposal", meddpicc: { m: { score: 3 } } });
  });
  it("without local edits it is just the new server copy", () => {
    const next = { ...server, stage: "won" };
    expect(mergeServerEdits({ ...server }, server, next)).toEqual(next);
  });
});
