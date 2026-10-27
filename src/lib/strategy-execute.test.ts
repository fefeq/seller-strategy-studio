// F3 (SDD-20261027, H-5): CA-32..CA-39 on the pure rules. Fictional data only.
import { describe, expect, it } from "vitest";
import { UNDO_HOURS, WRITABLE, baseOf, canApplyChange, experimentDraft, experimentDraftIssues, parseChange, personFields, planApply, planUndo, taskDraft, undoUntil, type ChangePayload, type StoredChange } from "@/lib/strategy-execute";
import { buildStrategySuggestion, parseStrategy } from "@/lib/strategy-suggestions";
import { sourceText } from "@/lib/provenance";
import { icpUncoveredWins } from "@/lib/proactive/detectors/strategy-icp";
import type { Snapshot } from "@/lib/proactive/types";

const NOW = new Date("2026-10-27T10:00:00Z");
const BY = "u1";
const payload: ChangePayload = { table: "icp_profiles", op: "update", id: "i1", values: { industries: "Logística" } };
const stored = (o: Partial<StoredChange> = {}): StoredChange => ({ op: "update", target_table: "icp_profiles", target_id: "i1", values: { industries: "Logística" }, base: { industries: "Salud" }, previous: null, status: "pending", applied_at: null, undo_until: null, ...o });
const row = (industries: string | null, marks: unknown = {}) => ({ values: { industries }, field_sources: marks });
const person = { industries: { source: "persona", kind: "persona", confirmed: true, at: "2026-09-01T00:00:00Z" } };
const auto = { industries: { source: "apollo", at: "2026-09-01T00:00:00Z" } };
const LEADER = ["sales_leader"];

describe("CA-32 accepting saves a pending proposal and does not change the current value", () => {
  it("the base only remembers what the field holds now", () => {
    const r = row("Salud", auto);
    expect(baseOf(payload, r)).toEqual({ industries: "Salud" });
    expect(r.values.industries).toBe("Salud"); // read, never written
  });
  it("only whitelisted fields can be proposed; anything else makes the payload invalid", () => {
    expect(parseChange(payload)).toEqual(payload);
    expect(parseChange({ ...payload, values: { org_id: "x" } })).toBeNull();
    expect(parseChange({ table: "deals", op: "update", id: "d", values: { amount: 1 } })).toBeNull();
    expect(parseChange({ ...payload, id: undefined })).toBeNull();
    expect(Object.keys(WRITABLE)).toEqual(["icp_profiles", "segments", "positioning", "products"]);
  });
  it("the strategy stored with a suggestion carries its payload and still validates", () => {
    const s = buildStrategySuggestion({ element: "icp", kind: "change", action_type: "strategy_change", cause: "x", priority: 2, title: "t", body: "b", evidence: [{ table: "deals", id: "d1", label: "D" }], change: payload });
    expect(parseStrategy(s.strategy)?.change).toEqual(payload);
  });
  it("CA-12's rule now brings the ICP it would create, from the data of the won deals", () => {
    const snap = { now: NOW, orgId: "o", setup: {} as Snapshot["setup"], deals: [], meetings: [], accounts: [], stakeholders: [], registrations: [], trials: [], segments: [], strategy: {
      icps: [], accounts: [{ id: "a1", name: "A1", industry: "Logística", size: null, country: null, segment_id: null, tier: null }, { id: "a2", name: "A2", industry: "Logística", size: null, country: null, segment_id: null, tier: null }],
      deals: ["d1", "d2"].map((id, i) => ({ id, name: id, stage: "won", amount: 1, account_id: `a${i + 1}`, segment_id: null, close_date: null, created_at: NOW.toISOString(), closed_at: null, updated_at: NOW.toISOString(), lost_reason: null, lost_competitor: null })),
      history: [], products: [], lines: [], costs: [], budgets: [] } } as Snapshot;
    expect(icpUncoveredWins(snap)[0].strategy!.change).toMatchObject({ table: "icp_profiles", op: "create", values: { industries: "Logística" } });
  });
});

describe("CA-33 confirming applies it with origin «Revisión estratégica» and allows undo for 24 hours", () => {
  const plan = () => { const p = planApply(stored(), row("Salud", auto), LEADER, BY, NOW); if (!p.ok) throw new Error(p.message); return p; };
  it("writes the value and marks it with the origin", () => {
    const p = plan();
    expect(p.values).toEqual({ industries: "Logística" });
    expect(sourceText(p.field_sources!.industries)).toContain("Revisión estratégica");
    expect(p.previous).toEqual({ values: { industries: "Salud" }, sources: auto });
  });
  const applied = () => stored({ status: "applied", previous: plan().previous, undo_until: undoUntil(NOW) });
  it("undo window is 24 hours", () => {
    expect(UNDO_HOURS).toBe(24);
    expect(undoUntil(NOW)).toBe("2026-10-28T10:00:00.000Z");
  });
  it("undo within the window restores value and mark", () => {
    const u = planUndo(applied(), row("Logística", plan().field_sources), LEADER, new Date("2026-10-28T09:59:00Z"));
    expect(u).toMatchObject({ ok: true, remove: false, values: { industries: "Salud" } });
    expect(u.ok && u.field_sources).toEqual(auto);
  });
  it("not after 24 hours, and not if the value was edited since", () => {
    expect(planUndo(applied(), row("Logística"), LEADER, new Date("2026-10-28T10:01:00Z"))).toMatchObject({ ok: false, message: expect.stringContaining("24 horas") });
    expect(planUndo(applied(), row("Otra"), LEADER, NOW)).toMatchObject({ ok: false, message: expect.stringContaining("editó") });
  });
  it("a value that had no mark gets none back; a created record is removed on undo", () => {
    const p = planApply(stored(), row("Salud", {}), LEADER, BY, NOW, true);
    if (!p.ok) throw new Error(p.message);
    const u = planUndo(stored({ status: "applied", previous: p.previous, undo_until: undoUntil(NOW) }), row("Logística", p.field_sources), LEADER, NOW);
    expect(u.ok && u.field_sources).toEqual({});
    const c = planUndo(stored({ op: "create", status: "applied", previous: { values: { industries: null }, sources: {} }, undo_until: undoUntil(NOW) }), row("Logística"), LEADER, NOW);
    expect(c).toMatchObject({ ok: true, remove: true });
  });
  it("a proposal made on an old value is stale: it is not applied over a newer one", () => {
    expect(planApply(stored(), row("Cambiado después", auto), LEADER, BY, NOW)).toMatchObject({ ok: false, code: "stale" });
  });
});

describe("CA-34 a value written or confirmed by a person is not replaced without their confirmation", () => {
  it("a person's value waits for an explicit confirmation of the replacement", () => {
    const p = planApply(stored(), row("Salud", person), LEADER, BY, NOW);
    expect(p).toMatchObject({ ok: false, code: "needs_confirmation", fields: ["industries"] });
    expect(planApply(stored(), row("Salud", person), LEADER, BY, NOW, true).ok).toBe(true);
  });
  it("a confirmed automatic value counts as the person's; an unconfirmed one does not; no mark is not known to be automatic", () => {
    expect(personFields("icp_profiles", row("x", { industries: { source: "apollo", at: "t", confirmed: true } }), ["industries"])).toEqual(["industries"]);
    expect(personFields("icp_profiles", row("x", auto), ["industries"])).toEqual([]);
    expect(personFields("icp_profiles", row("x", {}), ["industries"])).toEqual(["industries"]);
    expect(personFields("icp_profiles", row(null, {}), ["industries"])).toEqual([]);
  });
  it("a table without marks (products) is read as the person's", () => {
    expect(personFields("products", { values: { price: 10 } }, ["price"])).toEqual(["price"]);
  });
});

describe("CA-35 an accepted test becomes an experiment draft, editable before saving", () => {
  const s = { title: "Probar otro asunto", body: "Creemos que el asunto corto responde más.", strategy: { evidence: [{ table: "deals", id: "d1" }] } };
  it("fills title, hypothesis and review date from the suggestion; the metric is never invented", () => {
    const d = experimentDraft(s, NOW);
    expect(d).toMatchObject({ title: "Probar otro asunto", hypothesis: "Creemos que el asunto corto responde más.", metric: "", review_on: "2026-11-10" });
    expect(experimentDraftIssues(d)).toEqual(["la métrica"]);
    expect(experimentDraftIssues({ ...d, metric: "respuesta" })).toEqual([]);
  });
});

describe("CA-36 an accepted commercial action becomes a task draft with owner and date", () => {
  it("owner is who accepts, date in 3 days, the first cited deal; all editable", () => {
    const d = taskDraft({ title: "Revisar etapa", body: "b", strategy: { evidence: [{ table: "accounts", id: "a1" }, { table: "deals", id: "d9" }] } }, BY, NOW);
    expect(d).toEqual({ title: "Revisar etapa", owner_id: BY, due_date: "2026-10-30", deal_id: "d9" });
    expect(taskDraft({ title: "t", body: null, strategy: { evidence: [] } }, BY, NOW).deal_id).toBeNull();
  });
});

describe("CA-38 a role that cannot apply sees the proposal and cannot apply it", () => {
  it("owner and sales_leader change strategy; others do not", () => {
    for (const r of ["owner", "sales_leader"]) expect(canApplyChange([r], "icp_profiles")).toBe(true);
    for (const r of ["ae", "sdr", "marketing", "deal_desk"]) expect(canApplyChange([r], "icp_profiles")).toBe(false);
  });
  it("prices and catalog also belong to deal desk, the same roles as canPrice", async () => {
    const { canPrice } = await import("@/lib/agent/tool-kit");
    for (const r of ["owner", "sales_leader", "deal_desk", "ae", "sdr", "viewer"]) expect(canApplyChange([r], "products")).toBe(canPrice([r]));
  });
  it("planApply and planUndo refuse with a message, without touching anything", () => {
    expect(planApply(stored(), row("Salud", auto), ["ae"], BY, NOW)).toMatchObject({ ok: false, code: "role" });
    expect(planUndo(stored({ status: "applied", previous: { values: {}, sources: {} }, undo_until: undoUntil(NOW) }), row("Logística"), ["ae"], NOW)).toMatchObject({ ok: false });
  });
  it("a manual proposal has nothing to apply", () => {
    expect(planApply(stored({ op: "manual", target_table: null }), null, LEADER, BY, NOW)).toMatchObject({ ok: false, code: "manual" });
  });
});
