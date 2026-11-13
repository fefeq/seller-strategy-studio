import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolCtx } from "@/lib/agent/tool-kit";
import { TEXT_BUDGET } from "@/lib/onboarding-source-refs";

const mocks = vi.hoisted(() => ({ readFile: vi.fn(), extract: vi.fn(), download: vi.fn() }));
vi.mock("@/lib/drive-core", () => ({ readFile: mocks.readFile }));
vi.mock("@/lib/orchestrator/runner", () => ({ monthBudget: async () => ({ paused: false }), logUsage: vi.fn() }));
vi.mock("@/lib/setup-extract.server", () => ({ extractSetupCore: mocks.extract }));
import { runOnboardingRead } from "@/lib/onboarding.server";

function context() {
  const writes: Record<string, unknown>[] = [];
  const chain = { update: (value: Record<string, unknown>) => { writes.push(value); return chain; }, eq: () => chain,
    then: (resolve: (value: unknown) => void) => resolve({ error: null }) };
  // A recording fake implements only the query/storage operations this job uses.
  const db = { from: () => chain, storage: { from: () => ({ download: mocks.download }) } } as unknown as ToolCtx["db"];
  return { c: { db, orgId: "org-a", userId: "user-a", orgName: "Empresa de prueba", roles: ["owner"], currency: "EUR" }, writes };
}
const drive = { kind: "drive" as const, ref: "synthetic-drive-id", name: "Documento sintético" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.extract.mockResolvedValue({ summary: "Propuesta sintética", currency: null, positioning: {}, segments: [], icps: [], pillars: [], target_accounts: [], questions: [] });
});

describe("independent verification: referenced onboarding reads", () => {
  it("F1: a 96,000-character Drive document cut at 60,000 is never full", async () => {
    mocks.readFile.mockResolvedValue({ text: "x".repeat(60_000) + "…", truncated: true, originalLength: 96_000 });
    const { c, writes } = context();
    await runOnboardingRead(c, { sources: [drive] }, async () => {});
    const states = [...writes].reverse().find((w) => Array.isArray(w.source_status))?.source_status;
    expect(states).toEqual([expect.objectContaining({ state: "partial", read: 60_000, total: 96_000 })]);
    expect(mocks.extract.mock.calls[0]?.[1].text).not.toContain("…");
  });

  it("F3: a foreign storage path is unread and never downloaded", async () => {
    const { c, writes } = context();
    await runOnboardingRead(c, { sources: [{ kind: "storage", ref: "org-b/user-a/test.txt", name: "Ajeno sintético" }] }, async () => {});
    expect(mocks.download).not.toHaveBeenCalled();
    expect([...writes].reverse().find((w) => Array.isArray(w.source_status))?.source_status).toEqual([expect.objectContaining({ state: "unread", read: 0 })]);
  });

  it("F3: writes source_status and shares the 120,000-character budget", async () => {
    mocks.readFile.mockResolvedValue({ text: "x".repeat(90_000), truncated: false, originalLength: 90_000 });
    const { c, writes } = context();
    await runOnboardingRead(c, { sources: [drive, { ...drive, ref: "second-synthetic-id", name: "Segundo sintético" }] }, async () => {});
    expect([...writes].reverse().find((w) => Array.isArray(w.source_status))?.source_status).toEqual([
      expect.objectContaining({ state: "partial", read: 60_000, total: 90_000 }),
      expect.objectContaining({ state: "partial", read: 60_000, total: 90_000 }),
    ]);
    const sent = mocks.extract.mock.calls[0]?.[1].text as string;
    expect([...sent].filter((c) => c === "x")).toHaveLength(TEXT_BUDGET);
  });

  it("F7: a read-status note does not become a finding attributed to the source", async () => {
    mocks.readFile.mockResolvedValue({ text: "Texto sintético", truncated: false, originalLength: 15 });
    const { c, writes } = context();
    await runOnboardingRead(c, { sources: [drive] }, async () => {});
    const findings = [...writes].reverse().find((w) => Array.isArray(w.findings))?.findings as { source: string | null }[];
    expect(findings.filter((f) => f.source === drive.name)).toEqual([]);
  });
});