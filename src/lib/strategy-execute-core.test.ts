// F3: the database side with a recording fake client (CA-32, CA-33, CA-34, CA-37, CA-38, CA-39). Fictional data only.
import { describe, expect, it } from "vitest";
import {
  applyChange,
  createExperimentFromSuggestion,
  createTaskFromSuggestion,
  markDoneByHand,
  proposeChange,
  rejectChange,
  undoChange,
} from "./strategy-execute-core";
import { buildStrategySuggestion } from "./strategy-suggestions";
import type { Db } from "./org-data";

type Q = {
  table: string;
  op: "select" | "insert" | "update" | "delete";
  payload?: Record<string, unknown>;
  filters: unknown[][];
};
type Reply = { data?: unknown; error?: { message: string } | null } | undefined;
function fakeDb(reply: (q: Q) => Reply = () => undefined) {
  const log: Q[] = [];
  const from = (table: string) => {
    const q: Q = { table, op: "select", filters: [] };
    const proxy: object = new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === "then") {
            log.push(q);
            const r = reply(q) ?? {};
            return (a: (v: unknown) => unknown, b: (e: unknown) => unknown) =>
              Promise.resolve({ data: r.data ?? null, error: r.error ?? null }).then(a, b);
          }
          return (...args: unknown[]) => {
            if (prop === "insert" || prop === "update" || prop === "delete") {
              q.op = prop;
              q.payload = args[0] as Record<string, unknown>;
            } else if (!["select", "single", "maybeSingle", "order", "limit"].includes(prop))
              q.filters.push([prop, ...args]);
            return proxy;
          };
        },
      },
    );
    return proxy;
  };
  return { db: { from } as unknown as Db, log };
}
const ORG = "org-1",
  ME = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-10-27T10:00:00Z");
const writes = (log: Q[], table?: string) =>
  log.filter((q) => q.op !== "select" && (!table || q.table === table));
const payload = {
  table: "icp_profiles" as const,
  op: "update" as const,
  id: "i1",
  values: { industries: "Logística" },
};
const sug = (
  change?: typeof payload,
  action: "strategy_change" | "experiment" = "strategy_change",
) => ({
  id: "s1",
  strategy: buildStrategySuggestion({
    element: "icp",
    kind: "change",
    action_type: action,
    cause: "x",
    priority: 2,
    title: "t",
    body: "b",
    evidence: [{ table: "deals", id: "d1", label: "D" }],
    ...(change ? { change } : {}),
  }).strategy,
});
const change = (o: Record<string, unknown> = {}) => ({
  id: "c1",
  suggestion_id: "s1",
  element: "icp",
  op: "update",
  target_table: "icp_profiles",
  target_id: "i1",
  values: { industries: "Logística" },
  base: { industries: "Salud" },
  previous: null,
  status: "pending",
  applied_at: null,
  undo_until: null,
  ...o,
});
const target = (industries: string, marks: unknown = {}) => ({ industries, field_sources: marks });
const auto = { industries: { source: "apollo", at: "2026-09-01T00:00:00Z" } };
const person = {
  industries: { source: "persona", kind: "persona", confirmed: true, at: "2026-09-01T00:00:00Z" },
};
const ctx = (db: Db, roles = ["sales_leader"]) => ({ db, orgId: ORG, userId: ME, roles });
const byTable = (map: Record<string, Reply | ((q: Q) => Reply)>) => (q: Q) => {
  const r = map[`${q.table}:${q.op}`] ?? map[q.table];
  return typeof r === "function" ? r(q) : r;
};

describe("CA-32 / CA-37: accepting saves a pending proposal, linked to the suggestion, and never writes the target", () => {
  it("update proposal: reads the current value, inserts it pending with the base, links it, changes nothing else", async () => {
    const { db, log } = fakeDb(
      byTable({
        "icp_profiles:select": { data: target("Salud", auto) },
        "strategy_changes:select": { data: null },
        "strategy_changes:insert": { data: { id: "c1" } },
      }),
    );
    expect(await proposeChange(ctx(db), sug(payload))).toBe("c1");
    expect(writes(log).map((q) => `${q.table}:${q.op}`)).toEqual([
      "strategy_changes:insert",
      "strategy_links:insert",
    ]);
    expect(writes(log, "strategy_changes")[0]!.payload).toMatchObject({
      org_id: ORG,
      suggestion_id: "s1",
      element: "icp",
      op: "update",
      target_table: "icp_profiles",
      target_id: "i1",
      values: { industries: "Logística" },
      base: { industries: "Salud" },
    });
    expect(writes(log, "strategy_links")[0]!.payload).toEqual({
      org_id: ORG,
      suggestion_id: "s1",
      kind: "change",
      ref_id: "c1",
    });
  });
  it("without a payload it is a manual proposal; twice for the same suggestion creates one", async () => {
    const a = fakeDb(
      byTable({
        "strategy_changes:select": { data: null },
        "strategy_changes:insert": { data: { id: "c2" } },
      }),
    );
    await proposeChange(ctx(a.db), sug());
    expect(writes(a.log, "strategy_changes")[0]!.payload).toMatchObject({
      op: "manual",
      target_table: null,
      values: {},
    });
    const b = fakeDb(byTable({ "strategy_changes:select": { data: { id: "c2" } } }));
    expect(await proposeChange(ctx(b.db), sug())).toBe("c2");
    expect(writes(b.log)).toEqual([]);
  });
  it("only «cambio de estrategia» suggestions propose changes", async () => {
    const { db, log } = fakeDb();
    expect(await proposeChange(ctx(db), sug(undefined, "experiment"))).toBeNull();
    expect(log).toEqual([]);
  });
});

describe("CA-33 / CA-39: only an explicit confirmation writes, with the origin and an undo window", () => {
  it("applies: claims the proposal pending→applied, then writes values and field_sources with the origin", async () => {
    const { db, log } = fakeDb(
      byTable({
        "strategy_changes:select": { data: change() },
        "icp_profiles:select": { data: target("Salud", auto) },
        "strategy_changes:update": { data: [{ id: "c1" }] },
        "icp_profiles:update": { data: [{ id: "i1" }] },
      }),
    );
    const r = await applyChange(ctx(db), "c1", { now: NOW });
    expect(r.ok).toBe(true);
    const claim = writes(log, "strategy_changes")[0]!;
    expect(claim.payload).toMatchObject({
      status: "applied",
      undo_until: "2026-10-28T10:00:00.000Z",
      decided_by: ME,
    });
    expect(claim.filters).toContainEqual(["eq", "status", "pending"]);
    const w = writes(log, "icp_profiles")[0]!;
    expect(w.payload).toMatchObject({
      industries: "Logística",
      field_sources: { industries: { source: "strategic_review" } },
    });
    expect(w.filters).toContainEqual(["eq", "org_id", ORG]);
  });
  it("if the write fails the proposal goes back to pending and the person is told nothing changed", async () => {
    const { db, log } = fakeDb(
      byTable({
        "strategy_changes:select": { data: change() },
        "icp_profiles:select": { data: target("Salud", auto) },
        "strategy_changes:update": { data: [{ id: "c1" }] },
        "icp_profiles:update": { error: { message: "rls" } },
      }),
    );
    const r = await applyChange(ctx(db), "c1", { now: NOW });
    expect(r).toMatchObject({ ok: false, code: "write" });
    expect(writes(log, "strategy_changes").pop()!.payload).toMatchObject({
      status: "pending",
      undo_until: null,
    });
  });
  it("another process already moved it: nothing is written", async () => {
    const { db, log } = fakeDb(
      byTable({
        "strategy_changes:select": { data: change() },
        "icp_profiles:select": { data: target("Salud", auto) },
        "strategy_changes:update": { data: [] },
      }),
    );
    expect(await applyChange(ctx(db), "c1", { now: NOW })).toMatchObject({
      ok: false,
      code: "status",
    });
    expect(writes(log, "icp_profiles")).toEqual([]);
  });
  it("rejecting and marking by hand never touch the target table", async () => {
    const a = fakeDb(
      byTable({
        "strategy_changes:select": { data: change() },
        "strategy_changes:update": { data: [{ id: "c1" }] },
      }),
    );
    expect((await rejectChange(ctx(a.db), "c1", NOW)).ok).toBe(true);
    expect(writes(a.log, "icp_profiles")).toEqual([]);
    const b = fakeDb(
      byTable({
        "strategy_changes:select": {
          data: change({ op: "manual", target_table: null, target_id: null }),
        },
        "strategy_changes:update": { data: [{ id: "c1" }] },
      }),
    );
    expect((await markDoneByHand(ctx(b.db), "c1", NOW)).ok).toBe(true);
    expect(writes(b.log).every((q) => q.table === "strategy_changes")).toBe(true);
  });
  it("creating a record: inserts with org_id and the origin, then keeps its id for undo", async () => {
    const { db, log } = fakeDb(
      byTable({
        "strategy_changes:select": { data: change({ op: "create", target_id: null, base: {} }) },
        "strategy_changes:update": { data: [{ id: "c1" }] },
        "icp_profiles:insert": { data: { id: "new-1" } },
      }),
    );
    expect((await applyChange(ctx(db), "c1", { now: NOW })).ok).toBe(true);
    expect(writes(log, "icp_profiles")[0]).toMatchObject({
      op: "insert",
      payload: { org_id: ORG, industries: "Logística" },
    });
    expect(writes(log, "strategy_changes").pop()!.payload).toEqual({ target_id: "new-1" });
  });
  it("undo within the window writes the previous value back", async () => {
    const applied = change({
      status: "applied",
      previous: { values: { industries: "Salud" }, sources: auto },
      undo_until: "2026-10-28T10:00:00.000Z",
    });
    const { db, log } = fakeDb(
      byTable({
        "strategy_changes:select": { data: applied },
        "icp_profiles:select": {
          data: target("Logística", { industries: { source: "strategic_review", at: "t" } }),
        },
        "icp_profiles:update": { data: [{ id: "i1" }] },
        "strategy_changes:update": { data: [{ id: "c1" }] },
      }),
    );
    expect((await undoChange(ctx(db), "c1", NOW)).ok).toBe(true);
    expect(writes(log, "icp_profiles")[0]!.payload).toMatchObject({
      industries: "Salud",
      field_sources: auto,
    });
    expect(writes(log, "strategy_changes")[0]!.payload).toMatchObject({ status: "undone" });
  });
});

describe("CA-34: a person's value is not replaced without their explicit confirmation", () => {
  const setup = () =>
    fakeDb(
      byTable({
        "strategy_changes:select": { data: change() },
        "icp_profiles:select": { data: target("Salud", person) },
        "strategy_changes:update": { data: [{ id: "c1" }] },
        "icp_profiles:update": { data: [{ id: "i1" }] },
      }),
    );
  it("without the confirmation: pending, nothing written", async () => {
    const { db, log } = setup();
    expect(await applyChange(ctx(db), "c1", { now: NOW })).toMatchObject({
      ok: false,
      code: "needs_confirmation",
      fields: ["industries"],
    });
    expect(writes(log)).toEqual([]);
  });
  it("with it: applied", async () =>
    expect((await applyChange(ctx(setup().db), "c1", { now: NOW, overwrite: true })).ok).toBe(
      true,
    ));
});

describe("CA-38: a role that cannot apply sees the proposal and nothing is written", () => {
  it("apply, reject and undo are refused for an AE", async () => {
    const { db, log } = fakeDb(
      byTable({
        "strategy_changes:select": {
          data: change({
            status: "applied",
            previous: { values: {}, sources: {} },
            undo_until: "2026-10-28T10:00:00.000Z",
          }),
        },
        "icp_profiles:select": { data: target("Logística") },
      }),
    );
    expect(await applyChange(ctx(db, ["ae"]), "c1", { now: NOW })).toMatchObject({ ok: false });
    expect(await rejectChange(ctx(db, ["ae"]), "c1", NOW)).toMatchObject({
      ok: false,
      code: "role",
    });
    expect(await undoChange(ctx(db, ["ae"]), "c1", NOW)).toMatchObject({ ok: false });
    expect(writes(log)).toEqual([]);
  });
});

describe("CA-35 / CA-36 / CA-37: experiment and task come from the edited draft and are linked to the suggestion", () => {
  it("experiment: starts as idea, needs the metric, links", async () => {
    const { db, log } = fakeDb(byTable({ gtm_experiments: { data: { id: "e1" } } }));
    await expect(
      createExperimentFromSuggestion(ctx(db), "s1", {
        title: "t",
        hypothesis: "h",
        metric: "",
        review_on: "2026-11-10",
      }),
    ).rejects.toThrow(/métrica/);
    expect(writes(log)).toEqual([]);
    expect(
      await createExperimentFromSuggestion(ctx(db), "s1", {
        title: "t",
        hypothesis: "h",
        metric: "respuesta",
        review_on: "2026-11-10",
      }),
    ).toBe("e1");
    expect(writes(log, "gtm_experiments")[0]!.payload).toMatchObject({
      org_id: ORG,
      status: "idea",
      metric: "respuesta",
      review_on: "2026-11-10",
    });
    expect(writes(log, "strategy_links")[0]!.payload).toEqual({
      org_id: ORG,
      suggestion_id: "s1",
      kind: "experiment",
      ref_id: "e1",
    });
  });
  it("task: owner, date and deal as edited, source «strategy», linked", async () => {
    const { db, log } = fakeDb(byTable({ tasks: { data: { id: "t1" } } }));
    await createTaskFromSuggestion(ctx(db), "s1", {
      title: "Revisar etapa",
      owner_id: ME,
      due_date: "2026-10-30",
      deal_id: "d9",
    });
    expect(writes(log, "tasks")[0]!.payload).toEqual({
      org_id: ORG,
      title: "Revisar etapa",
      owner_id: ME,
      due_date: "2026-10-30",
      deal_id: "d9",
      source: "strategy",
    });
    expect(writes(log, "strategy_links")[0]!.payload).toEqual({
      org_id: ORG,
      suggestion_id: "s1",
      kind: "task",
      ref_id: "t1",
    });
  });
});

describe("CA-39: nothing is sent to anyone", () => {
  it("the execution modules never call a messaging or network API", async () => {
    const fs = await import("node:fs");
    for (const f of ["strategy-execute.ts", "strategy-execute-core.ts"])
      expect(fs.readFileSync(`src/lib/${f}`, "utf8")).not.toMatch(
        /fetch\(|telegram|resend|sendEmail|ai-gateway/i,
      );
  });
});
