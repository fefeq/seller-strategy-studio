// SDD-20261027 F2 · CA-29: decideExperiment with a fake client (no database). The rules themselves are tested in experiments.test.ts.
import { describe, expect, it, vi } from "vitest";
import type { Db } from "@/lib/org-data";

const sync = vi.fn(async () => undefined);
vi.mock("@/lib/strategy-core", () => ({ syncStrategySuggestions: sync }));
import { decideExperiment } from "@/lib/experiments-core";

const NOW = new Date("2026-10-27T10:00:00Z");
const row = {
  id: "e1",
  title: "Prueba",
  status: "running",
  hypothesis: "h",
  metric: "m",
  target: "t",
  result: "",
  learning: "",
  success_threshold: "",
  close_rule: "",
  review_on: null,
  ends_on: null,
  decision: null,
};

function fake(found: unknown, updateError: unknown = null) {
  const updates: Record<string, unknown>[] = [];
  const db = {
    from: () => ({
      select: () => ({
        eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: found }) }) }),
      }),
      update: (p: Record<string, unknown>) => {
        updates.push(p);
        return { eq: () => ({ eq: async () => ({ error: updateError }) }) };
      },
    }),
  } as unknown as Db;
  return { db, updates };
}
const ctx = (db: Db) => ({ db, orgId: "o1", userId: "u1" });

describe("decideExperiment", () => {
  it("fails with a Spanish message when the experiment does not exist", async () => {
    const { db, updates } = fake(null);
    await expect(
      decideExperiment(ctx(db), "x", { decision: "close", result: "r", learning: "l" }, NOW),
    ).rejects.toThrow(/No encuentro/);
    expect(updates).toHaveLength(0);
  });
  it("does not save anything when the rule rejects the input", async () => {
    const { db, updates } = fake(row);
    await expect(
      decideExperiment(ctx(db), "e1", { decision: "close", result: "", learning: "" }, NOW),
    ).rejects.toThrow(/resultado y el aprendizaje/);
    expect(updates).toHaveLength(0);
  });
  it("close saves the decision as learned and proposes nothing without an element", async () => {
    sync.mockClear();
    const { db, updates } = fake(row);
    expect(
      await decideExperiment(
        ctx(db),
        "e1",
        { decision: "close", result: "6 %", learning: "No funcionó" },
        NOW,
      ),
    ).toEqual({ status: "learned", proposed: false });
    expect(updates[0]).toMatchObject({
      decision: "close",
      result: "6 %",
      learning: "No funcionó",
      status: "learned",
      decided_by: "u1",
    });
    expect(sync).not.toHaveBeenCalled();
  });
  it("scale with a named element becomes adopted and leaves one proposal", async () => {
    sync.mockClear();
    const { db, updates } = fake(row);
    expect(
      await decideExperiment(
        ctx(db),
        "e1",
        {
          decision: "scale",
          result: "12 %",
          learning: "Sí",
          change_element: "icp",
          change_note: "Ampliar",
        },
        NOW,
      ),
    ).toEqual({ status: "adopted", proposed: true });
    expect(updates[0]).toMatchObject({ status: "adopted" });
    expect(sync).toHaveBeenCalledTimes(1);
  });
  it("adjust keeps it running with a new review date and no decision", async () => {
    const { db, updates } = fake(row);
    expect(
      await decideExperiment(
        ctx(db),
        "e1",
        { decision: "adjust", result: "", learning: "", next_review_on: "2026-11-15" },
        NOW,
      ),
    ).toEqual({ status: "running", proposed: false });
    expect(updates[0]).toMatchObject({
      review_on: "2026-11-15",
      decision: null,
      decided_at: null,
      decided_by: null,
    });
  });
  it("a failed save does not propose anything", async () => {
    sync.mockClear();
    const { db } = fake(row, { message: "boom" });
    await expect(
      decideExperiment(
        ctx(db),
        "e1",
        { decision: "scale", result: "r", learning: "l", change_element: "icp" },
        NOW,
      ),
    ).rejects.toThrow(/No pude guardar/);
    expect(sync).not.toHaveBeenCalled();
  });
});
