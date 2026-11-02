// @vitest-environment node
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  APPROVED_USD,
  ledgerPath,
  loadLedger,
  lockPath,
  openRun,
  recordManualCost,
  withRun,
  type EvalPass,
} from "./budget";

let dir: string;
const NOW = () => new Date("2026-11-02T10:00:00.000Z");

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "nk48-budget-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function seed(pass: EvalPass, spentUsd: number, extra: Record<string, unknown> = {}) {
  writeFileSync(
    ledgerPath(dir, pass),
    JSON.stringify({ ...loadLedger(dir, pass), spentUsd, ...extra }, null, 2),
  );
}

describe("approved amounts (NK-0048 CA-14)", () => {
  it("are the constants Fede approved, frozen", () => {
    expect(APPROVED_USD).toEqual({ pilot: 1, reference: 1.5, full: 2 });
    expect(Object.isFrozen(APPROVED_USD)).toBe(true);
  });

  it("cannot be changed from the environment", () => {
    process.env["GTM_LAB_EVAL_CAP"] = "100";
    try {
      const run = openRun(dir, "pilot", { now: NOW, pid: 1 });
      expect(run.ok && run.run.capUsd).toBe(1);
      if (run.ok) run.run.close();
    } finally {
      delete process.env["GTM_LAB_EVAL_CAP"];
    }
  });
});

describe("start rule", () => {
  it("a new pass starts with the whole approved amount as its cap", () => {
    const opened = openRun(dir, "reference", { now: NOW, pid: 1 });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.run.capUsd).toBe(1.5);
    opened.run.close();
  });

  it("does not start when nothing is left, and leaves no lock behind", () => {
    seed("full", 2);
    const opened = openRun(dir, "full", { now: NOW, pid: 1 });
    expect(opened.ok).toBe(false);
    if (opened.ok) return;
    expect(opened.message).toMatch(/no queda saldo/);
    expect(existsSync(lockPath(dir, "full"))).toBe(false);
  });

  it("does not start when the spend went past the approved amount", () => {
    seed("pilot", 1.03);
    expect(openRun(dir, "pilot", { now: NOW, pid: 1 }).ok).toBe(false);
  });

  it("does not start while the pass is in «sin dato»", () => {
    seed("pilot", 0.1, { noData: { reason: "talleres/north-metric: coste nulo", at: "x" } });
    const opened = openRun(dir, "pilot", { now: NOW, pid: 1 });
    expect(opened.ok).toBe(false);
    if (opened.ok) return;
    expect(opened.message).toMatch(/sin dato/);
    expect(opened.message).toMatch(/record-cost/);
  });

  it("the cap of a later run is what is left", () => {
    seed("full", 1.25);
    const opened = openRun(dir, "full", { now: NOW, pid: 1 });
    expect(opened.ok && opened.run.capUsd).toBe(0.75);
    if (opened.ok) opened.run.close();
  });
});

describe("one run at a time per pass", () => {
  it("an existing lock stops the start and says pid, time and the file to delete", () => {
    writeFileSync(
      lockPath(dir, "pilot"),
      JSON.stringify({ pid: 4242, at: "2026-11-02T09:00:00.000Z" }),
    );
    const opened = openRun(dir, "pilot", { now: NOW, pid: 1 });
    expect(opened.ok).toBe(false);
    if (opened.ok) return;
    expect(opened.message).toContain("4242");
    expect(opened.message).toContain("2026-11-02T09:00:00.000Z");
    expect(opened.message).toContain(lockPath(dir, "pilot"));
    expect(existsSync(lockPath(dir, "pilot"))).toBe(true);
  });

  it("the lock holds pid and time while running", () => {
    const opened = openRun(dir, "pilot", { now: NOW, pid: 77 });
    expect(JSON.parse(readFileSync(lockPath(dir, "pilot"), "utf8"))).toEqual({
      pid: 77,
      at: "2026-11-02T10:00:00.000Z",
    });
    expect(openRun(dir, "pilot", { now: NOW, pid: 78 }).ok).toBe(false);
    if (opened.ok) opened.run.close();
  });

  it("other passes are not blocked", () => {
    const a = openRun(dir, "pilot", { now: NOW, pid: 1 });
    const b = openRun(dir, "full", { now: NOW, pid: 1 });
    expect(a.ok && b.ok).toBe(true);
    if (a.ok) a.run.close();
    if (b.ok) b.run.close();
  });

  it("the lock is released in finally, also when the run throws", async () => {
    await expect(
      withRun(dir, "pilot", { now: NOW, pid: 1 }, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(existsSync(lockPath(dir, "pilot"))).toBe(false);
  });
});

describe("cap during a run (rules of gtm-lab eval-suggest.mjs)", () => {
  it("the call in progress may go past the cap; the run stops right after", async () => {
    await withRun(dir, "pilot", { now: NOW, pid: 1 }, async (run) => {
      expect(run.record(0.6, "a")).toBe("ok");
      expect(run.overCap()).toBe(false);
      expect(run.record(0.5, "b")).toBe("ok");
      expect(run.overCap()).toBe(true);
    });
    expect(loadLedger(dir, "pilot").spentUsd).toBeCloseTo(1.1);
  });

  it("the judge is skipped once the generation is past the cap", async () => {
    await withRun(dir, "pilot", { now: NOW, pid: 1 }, async (run) => {
      run.record(0.9, "gen");
      expect(run.canJudge()).toBe(true);
      run.record(0.2, "gen");
      expect(run.canJudge()).toBe(false);
    });
  });

  it("the ledger is written after every call", async () => {
    await withRun(dir, "full", { now: NOW, pid: 1 }, async (run) => {
      run.record(0.25, "a");
      expect(loadLedger(dir, "full").spentUsd).toBeCloseTo(0.25);
      run.record(0.25, "b");
      expect(loadLedger(dir, "full").spentUsd).toBeCloseTo(0.5);
    });
    expect(loadLedger(dir, "full").runs).toHaveLength(1);
  });

  it("all runs of a pass add up to at most the approved amount plus one call", async () => {
    for (let i = 0; i < 5; i++) {
      await withRun(dir, "pilot", { now: NOW, pid: 1 }, async (run) => {
        while (!run.overCap()) run.record(0.3, "call");
      }).catch(() => undefined);
    }
    expect(loadLedger(dir, "pilot").spentUsd).toBeLessThanOrEqual(1 + 0.3 + 1e-9);
  });
});

describe("null cost («sin dato»)", () => {
  it("puts the pass in «sin dato», stops it and blocks the next start", async () => {
    await withRun(dir, "pilot", { now: NOW, pid: 1 }, async (run) => {
      expect(run.record(null, "talleres/north-metric")).toBe("no-data");
      expect(run.overCap()).toBe(true);
    });
    expect(loadLedger(dir, "pilot").noData?.reason).toContain("talleres/north-metric");
    expect(openRun(dir, "pilot", { now: NOW, pid: 1 }).ok).toBe(false);
  });

  it("is lifted only by a manual cost with source, approver and date, which adds to the spend", async () => {
    await withRun(dir, "pilot", { now: NOW, pid: 1 }, async (run) => {
      run.record(0.1, "a");
      run.record(null, "b");
    });
    const result = recordManualCost(dir, "pilot", {
      costUsd: 0.05,
      source: "panel de OpenRouter",
      approvedBy: "Fede",
      date: "2026-11-02",
    });
    expect(result.ok).toBe(true);
    const ledger = loadLedger(dir, "pilot");
    expect(ledger.noData).toBeNull();
    expect(ledger.spentUsd).toBeCloseTo(0.15);
    expect(ledger.manual).toEqual([
      { costUsd: 0.05, source: "panel de OpenRouter", approvedBy: "Fede", date: "2026-11-02" },
    ]);
    const opened = openRun(dir, "pilot", { now: NOW, pid: 1 });
    expect(opened.ok && opened.run.capUsd).toBeCloseTo(0.85);
    if (opened.ok) opened.run.close();
  });

  it.each([
    [{ costUsd: -1, source: "panel", approvedBy: "Fede", date: "2026-11-02" }],
    [{ costUsd: Number.NaN, source: "panel", approvedBy: "Fede", date: "2026-11-02" }],
    [{ costUsd: 0.1, source: "", approvedBy: "Fede", date: "2026-11-02" }],
    [{ costUsd: 0.1, source: "panel", approvedBy: " ", date: "2026-11-02" }],
    [{ costUsd: 0.1, source: "panel", approvedBy: "Fede", date: "ayer" }],
  ])("rejects an incomplete manual cost %j", (entry) => {
    expect(recordManualCost(dir, "pilot", entry).ok).toBe(false);
    expect(loadLedger(dir, "pilot").manual).toEqual([]);
  });

  it("a manual cost is refused while a run holds the lock", () => {
    const opened = openRun(dir, "pilot", { now: NOW, pid: 1 });
    const result = recordManualCost(dir, "pilot", {
      costUsd: 0.05,
      source: "panel",
      approvedBy: "Fede",
      date: "2026-11-02",
    });
    expect(result.ok).toBe(false);
    if (opened.ok) opened.run.close();
  });
});
