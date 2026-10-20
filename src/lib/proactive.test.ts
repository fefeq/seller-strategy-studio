import { describe, expect, it } from "vitest";
import { detect, digest } from "./proactive";
import type { Snapshot } from "./proactive/types";
import { setupStatus, type SetupData } from "@/lib/setup-schema";
import { canUseTool, getTool, toolsFor } from "@/lib/agent/tools";
import { proposalItems, type SetupProposal } from "@/lib/setup-extraction";

const NOW = new Date("2026-10-20T10:00:00Z");
const fullPos = { target_customer: "a", need: "a", category: "a", key_benefit: "a", competitive_alternative: "a", differentiator: "a", one_liner: "a", elevator_pitch: "a" };
const setup = (o: Partial<SetupData> = {}): SetupData => ({
  currency: "EUR",
  segments: [{ name: "SMB", acv_min: 5000, acv_max: 50000, win_rate_target: 25, ae_quota: 600000 }],
  icps: [{ industries: "SaaS", company_size: "50-200", why_fit: "x", anti_icp: "y" }],
  positioning: fullPos,
  pillars: [{ title: "a", message: "m" }, { title: "b", message: "m" }, { title: "c", message: "m" }],
  quotas: [{ period: "2026-Q4", amount: 100000 }],
  accounts: 1, deals: 1, quarter: "2026-Q4", ...o,
});
const snap = (o: Partial<Snapshot> = {}): Snapshot => ({
  now: NOW, orgId: "o", setup: setup(), deals: [], meetings: [], accounts: [], stakeholders: [], registrations: [], trials: [], segments: [], ...o,
});
const deal = (o: Partial<Snapshot["deals"][number]>) => ({ id: "d1", name: "Acme", stage: "demo", amount: 400000, close_date: "2026-12-01", updated_at: NOW.toISOString(), owner_id: "u1", meddpicc: {}, account_id: null, ...o });
const keys = (s: Snapshot) => detect(s).map((x) => x.detector);

describe("setup completeness", () => {
  it("full data is 100%", () => expect(setupStatus(setup()).pct).toBe(100));
  it("missing quota costs 15 points and is the next step", () => {
    const st = setupStatus(setup({ quotas: [] }));
    expect(st.pct).toBe(85);
    expect(st.next?.id).toBe("quota");
  });
  it("a quota from another quarter does not count", () => expect(setupStatus(setup({ quotas: [{ period: "2026-Q3", amount: 5 }] })).next?.id).toBe("quota"));
  it("needs three pillars with message", () => expect(setupStatus(setup({ pillars: [{ title: "a", message: "m" }] })).next?.id).toBe("pillars"));
});

describe("detectors", () => {
  it("a delayed lead proposes a follow-up task; one on time does not", () => {
    const lead = (o: object) => ({ id: "l1", company: "Acme", stage: "contacted", stage_entered_at: new Date(NOW.getTime() - 4 * 864e5).toISOString(), next_step_at: null, owner_id: "u1", account_id: null, ...o });
    const s = detect(snap({ leads: [lead({})] })).find((x) => x.detector === "late_lead");
    expect(s?.action?.tool).toBe("create_task");
    expect(keys(snap({ leads: [lead({ stage_entered_at: new Date(NOW.getTime() - 2 * 864e5).toISOString() })] }))).not.toContain("late_lead");
    expect(keys(snap({ leads: [lead({ stage_entered_at: NOW.toISOString(), next_step_at: "2026-10-19" })] }))).toContain("late_lead");
  });
  it("stale deal after 14 days proposes a task, not before", () => {
    expect(keys(snap({ deals: [deal({ updated_at: new Date(NOW.getTime() - 13 * 864e5).toISOString() })] }))).not.toContain("stale_deal");
    const s = detect(snap({ deals: [deal({ updated_at: new Date(NOW.getTime() - 15 * 864e5).toISOString() })] })).find((x) => x.detector === "stale_deal");
    expect(s?.action?.tool).toBe("create_task");
    expect(s?.user_id).toBe("u1");
  });
  it("past close date proposes moving it 30 days", () => {
    const s = detect(snap({ deals: [deal({ close_date: "2026-10-01" })] })).find((x) => x.detector === "past_close_date");
    expect(s?.action).toEqual({ tool: "update_deal", args: { deal_id: "d1", close_date: "2026-11-19" } });
  });
  it("won deals are ignored by deal detectors", () => expect(keys(snap({ deals: [deal({ stage: "won", close_date: "2026-01-01", updated_at: "2026-01-01T00:00:00Z" })] })).filter((k) => k !== "low_coverage")).toEqual([]));
  it("coverage below 3x is flagged; 3x is healthy", () => {
    expect(keys(snap({ deals: [deal({ amount: 290000 })] }))).toContain("low_coverage");
    expect(keys(snap({ deals: [deal({ amount: 300000 })] }))).not.toContain("low_coverage");
  });
  it("late-stage deal with more than 2 MEDDPICC gaps", () => {
    expect(keys(snap({ deals: [deal({ stage: "proposal" })] }))).toContain("meddpicc_gaps");
    const m = { metrics: "x", economic_buyer: "x", decision_criteria: "x", decision_process: "x", paper_process: "x", identify_pain: "x" };
    expect(keys(snap({ deals: [deal({ stage: "proposal", meddpicc: m })] }))).not.toContain("meddpicc_gaps");
  });
  it("meeting in next 36h without brief offers to prepare it", () => {
    const m = { id: "m1", title: "Demo", scheduled_at: new Date(NOW.getTime() + 864e5).toISOString(), ai_brief: null, account_id: null, created_by: "u1" };
    expect(detect(snap({ meetings: [m] })).find((x) => x.detector === "meeting_no_prep")?.action?.tool).toBe("prepare_meeting_brief");
    expect(keys(snap({ meetings: [{ ...m, scheduled_at: new Date(NOW.getTime() + 3 * 864e5).toISOString() }] }))).not.toContain("meeting_no_prep");
  });
  it("target account without decision maker", () => {
    const accounts = [{ id: "a1", name: "Acme", is_target: true, owner_id: null }];
    expect(keys(snap({ accounts, stakeholders: [{ account_id: "a1", buying_role: "champion" }] }))).toContain("no_decision_maker");
    expect(keys(snap({ accounts, stakeholders: [{ account_id: "a1", buying_role: "decision_maker" }] }))).not.toContain("no_decision_maker");
  });
  it("incomplete setup suggests the next item", () => expect(detect(snap({ setup: setup({ quotas: [] }) })).find((x) => x.detector === "setup_incomplete")?.dedupe_key).toBe("setup_incomplete:quota"));
  it("digest returns top 3 by priority", () => {
    const d = digest([{ priority: 3, created_at: "1" }, { priority: 1, created_at: "1" }, { priority: 2, created_at: "1" }, { priority: 1, created_at: "2" }]);
    expect(d.map((x) => x.priority)).toEqual([1, 1, 2]);
  });
});

describe("agent tool permissions", () => {
  it("only owner can change currency", () => {
    expect(canUseTool(getTool("set_currency")!, ["owner"])).toBe(true);
    expect(canUseTool(getTool("set_currency")!, ["ae"])).toBe(false);
  });
  it("only owner and sales leader set quotas", () => {
    expect(canUseTool(getTool("set_quota")!, ["sales_leader"])).toBe(true);
    expect(canUseTool(getTool("set_quota")!, ["marketing"])).toBe(false);
  });
  it("an AE gets read tools and deal writes but not strategy writes", () => {
    const names = toolsFor(["ae"]).map((t) => t.name);
    expect(names).toContain("update_deal");
    expect(names).not.toContain("update_positioning");
  });
});

describe("setup proposal mapping", () => {
  const p: SetupProposal = {
    summary: "", currency: "USD", positioning: { one_liner: "X", need: null } as any,
    segments: [{ name: "smb", acv_min: 1, acv_max: 2, motion: "inside", win_rate_target: null, ae_quota: null }],
    icps: [], pillars: [], target_accounts: [{ name: "Acme", domain: null, why: null }], questions: [],
  };
  it("maps to tool calls, updating existing segments by name and skipping nulls", () => {
    const items = proposalItems(p, [{ id: "11111111-1111-1111-1111-111111111111", name: "SMB" }], "EUR");
    expect(items.map((i) => i.tool)).toEqual(["set_currency", "update_positioning", "upsert_segment", "create_account"]);
    expect(items[1].args).toEqual({ fields: { one_liner: "X" } });
    expect(items[2].args).toMatchObject({ segment_id: "11111111-1111-1111-1111-111111111111" });
    expect(items[2].args).not.toHaveProperty("ae_quota");
  });
  it("same currency is not proposed", () => expect(proposalItems(p, [], "USD")[0].tool).toBe("update_positioning"));
});
