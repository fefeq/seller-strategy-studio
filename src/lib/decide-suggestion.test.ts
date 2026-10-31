// SDD-20261027 strategic-suggestions-engine, F0 · CA-4: the server join of a decision, decideSuggestionCore in agent.functions.ts:
// who may act (canActOnSuggestion, also for the privileged client of Telegram), the route of strategy_* suggestions to the atomic
// database function, the reason that travels with it, and rememberDecision. Fake client; fictional data; no network.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildStrategySuggestion } from "@/lib/strategy-suggestions";
import type { ToolCtx } from "@/lib/agent/tools";

const remember = vi.hoisted(() => vi.fn());
vi.mock("@tanstack/react-start", () => {
  const chain: object = new Proxy(() => chain, { get: () => () => chain, apply: () => chain });
  return { createServerFn: () => chain };
});
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/memory.server", () => ({ rememberDecision: remember }));

import { decideSuggestionCore } from "@/lib/agent.functions";

type Call = {
  kind: "select" | "update" | "rpc";
  table: string;
  payload?: unknown;
  filters: unknown[][];
};
function fakeDb(suggestion: Record<string, unknown> | null, rpcData: string | null = "approved") {
  const calls: Call[] = [];
  const from = (table: string) => {
    const c: Call = { kind: "select", table, filters: [] };
    calls.push(c);
    const p: object = new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === "then")
            return (f: (v: unknown) => unknown) =>
              Promise.resolve({ data: null, error: null }).then(f);
          return (...a: unknown[]) => {
            if (prop === "maybeSingle") return Promise.resolve({ data: suggestion, error: null });
            if (prop === "update") {
              c.kind = "update";
              c.payload = a[0];
            } else if (!["select", "single", "order", "limit"].includes(prop))
              c.filters.push([prop, ...a]);
            return p;
          };
        },
      },
    );
    return p;
  };
  const rpc = (name: string, args: unknown) => {
    calls.push({ kind: "rpc", table: name, payload: args, filters: [] });
    return Promise.resolve({ data: rpcData, error: null });
  };
  return { db: { from, rpc } as unknown as ToolCtx["db"], calls };
}

const ORG = "org-1",
  ME = "11111111-1111-4111-8111-111111111111",
  OTHER = "22222222-2222-4222-8222-222222222222";
const ctx = (db: ToolCtx["db"], roles = ["ae"], userId = ME): ToolCtx => ({
  db,
  orgId: ORG,
  userId,
  roles,
  currency: "EUR",
});
const b = buildStrategySuggestion({
  element: "icp",
  kind: "create",
  action_type: "strategy_change",
  cause: "c",
  priority: 2,
  title: "Crea un ICP",
  body: "t",
  evidence: [{ table: "deals", id: "d1", label: "Deal 1" }],
});
const strat = (over: Record<string, unknown> = {}) => ({
  id: "s1",
  org_id: ORG,
  user_id: null,
  status: "pending",
  detector: b.detector,
  title: b.title,
  action: null,
  strategy: b.strategy,
  ...over,
});
const operational = (over: Record<string, unknown> = {}) => ({
  id: "o1",
  org_id: ORG,
  user_id: null,
  status: "pending",
  detector: "meddpicc_gaps",
  title: "Completa MEDDPICC",
  action: null,
  strategy: null,
  ...over,
});
const rpcCall = (calls: Call[]) => calls.find((c) => c.kind === "rpc");

beforeEach(() => remember.mockReset());

describe("decideSuggestionCore: strategic suggestions", () => {
  it("approve goes to the atomic function with this company and this user, and the decision is remembered", async () => {
    const { db, calls } = fakeDb(strat(), "approved");
    const r = await decideSuggestionCore(ctx(db), "s1", "approve");
    expect(r).toMatchObject({ status: "approved", message: expect.stringMatching(/^Aceptada/) }); // F3 adds what happens next
    expect(rpcCall(calls)).toMatchObject({
      table: "decide_strategy_suggestion",
      payload: { p_suggestion_id: "s1", p_org_id: ORG, p_decision: "accept", p_by: ME },
    });
    expect(calls.some((c) => c.kind === "update")).toBe(false); // no direct status write: the function does it
    expect(remember).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: ORG }),
      expect.objectContaining({ id: "s1" }),
      "approve",
    );
  });
  it("snooze maps to postpone and is not remembered; dismiss maps to dismiss and is", async () => {
    const a = fakeDb(strat(), "snoozed");
    await decideSuggestionCore(ctx(a.db), "s1", "snooze");
    expect(rpcCall(a.calls)!.payload).toMatchObject({ p_decision: "postpone" });
    expect(remember).not.toHaveBeenCalled();
    const d = fakeDb(strat(), "dismissed");
    await decideSuggestionCore(ctx(d.db), "s1", "dismiss");
    expect(rpcCall(d.calls)!.payload).toMatchObject({ p_decision: "dismiss" });
    expect(remember).toHaveBeenCalledWith(expect.anything(), expect.anything(), "dismiss");
  });
  it("the reason typed by the person travels to the log", async () => {
    const { db, calls } = fakeDb(strat(), "dismissed");
    await decideSuggestionCore(ctx(db), "s1", "dismiss", { reason: "  No aplica  " });
    expect(rpcCall(calls)!.payload).toMatchObject({ p_reason: "No aplica" });
  });
  it("a suggestion someone else already handled is not decided again nor remembered", async () => {
    const closed = fakeDb(strat({ status: "dismissed" }));
    expect(await decideSuggestionCore(ctx(closed.db), "s1", "approve")).toEqual({
      status: "dismissed",
      message: "Ya estaba gestionada",
    });
    expect(rpcCall(closed.calls)).toBeUndefined();
    const race = fakeDb(strat(), null); // pending when read, handled by the time the function ran
    expect((await decideSuggestionCore(ctx(race.db), "s1", "approve")).message).toBe(
      "Ya estaba gestionada",
    );
    expect(remember).not.toHaveBeenCalled();
  });
  it("is searched only inside the caller's company", async () => {
    const { db, calls } = fakeDb(strat());
    await decideSuggestionCore(ctx(db), "s1", "approve");
    const sel = calls.find((c) => c.kind === "select")!;
    expect(sel.filters).toEqual(
      expect.arrayContaining([
        ["eq", "id", "s1"],
        ["eq", "org_id", ORG],
      ]),
    );
  });
});

describe("decideSuggestionCore: who may act (Telegram and the privileged client skip RLS)", () => {
  it("someone else's suggestion is refused to a plain member, before anything is written or remembered", async () => {
    const { db, calls } = fakeDb(strat({ user_id: OTHER }));
    await expect(decideSuggestionCore(ctx(db, ["ae"]), "s1", "approve")).rejects.toThrow(
      /no encontrada/,
    );
    expect(rpcCall(calls)).toBeUndefined();
    expect(remember).not.toHaveBeenCalled();
  });
  it("a leader or owner may decide it; the suggestion's own assignee and an unassigned one too", async () => {
    for (const [roles, uid] of [
      [["sales_leader"], OTHER],
      [["owner"], OTHER],
      [["ae"], ME],
      [["ae"], null],
    ] as const) {
      const { db, calls } = fakeDb(strat({ user_id: uid }), "approved");
      await decideSuggestionCore(ctx(db, [...roles]), "s1", "approve");
      expect(rpcCall(calls), `${roles} ${uid}`).toBeDefined();
    }
  });
  it("a suggestion that does not exist is «no encontrada»", async () => {
    const { db } = fakeDb(null);
    await expect(decideSuggestionCore(ctx(db), "nope", "approve")).rejects.toThrow(/no encontrada/);
  });
});

describe("decideSuggestionCore: operational suggestions keep their own path", () => {
  it("dismiss writes the status directly and never touches the strategic function", async () => {
    const { db, calls } = fakeDb(operational());
    const r = await decideSuggestionCore(ctx(db), "o1", "dismiss");
    expect(r.status).toBe("dismissed");
    expect(rpcCall(calls)).toBeUndefined();
    expect(calls.find((c) => c.kind === "update")!.payload).toMatchObject({ status: "dismissed" });
  });
});

// ---- SDD-20261031 suggestion-accept-needs-form-outside-ui (NK-0041): accepting a test or a commercial action needs the form ----
import type { ExecuteInput } from "@/lib/agent.functions";

type TCall = { kind: "select" | "update" | "insert" | "rpc"; table: string; payload?: unknown };
/** Fake that answers per table (the one above answers the suggestion to every read and gives no id on insert). */
function fakeDbByTable(
  rows: Record<string, unknown>,
  insertedId = "new-1",
  rpcData: string | null = "approved",
) {
  const calls: TCall[] = [];
  const from = (table: string) => {
    const c: TCall = { kind: "select", table };
    calls.push(c);
    let selected = false;
    const p: object = new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === "then")
            return (f: (v: unknown) => unknown) =>
              Promise.resolve({
                data: c.kind === "update" && selected ? [{ id: "x" }] : null,
                error: null,
              }).then(f);
          return (...a: unknown[]) => {
            if (prop === "maybeSingle")
              return Promise.resolve({ data: rows[table] ?? null, error: null });
            if (prop === "single")
              return Promise.resolve({
                data: c.kind === "insert" ? { id: insertedId } : null,
                error: null,
              });
            if (prop === "update" || prop === "insert") {
              c.kind = prop;
              c.payload = a[0];
            } else if (prop === "select") selected = true;
            return p;
          };
        },
      },
    );
    return p;
  };
  const rpc = (name: string, args: unknown) => {
    calls.push({ kind: "rpc", table: name, payload: args });
    return Promise.resolve({ data: rpcData, error: null });
  };
  return { db: { from, rpc } as unknown as ToolCtx["db"], calls };
}
const typed = (
  action_type: "experiment" | "commercial_action",
  over: Record<string, unknown> = {},
) => {
  const m = buildStrategySuggestion({
    element: action_type === "experiment" ? "experiment" : "pipeline",
    kind: "validate",
    action_type,
    cause: "c",
    priority: 1,
    title: "Prueba algo",
    body: "Texto de la sugerencia",
    evidence: [{ table: "deals", id: "d1", label: "Deal 1" }],
  });
  return { ...strat(), detector: m.detector, title: m.title, strategy: m.strategy, ...over };
};
const expDraft = {
  title: "Prueba",
  hypothesis: "Si hacemos X, sube Y",
  metric: "Tasa de respuesta",
  review_on: "2026-12-01",
};
const taskDraftOk = { title: "Llamar", owner_id: ME, due_date: "2026-12-01", deal_id: null };
const exec = (v: unknown) => v as ExecuteInput;
const noDecision = (calls: TCall[]) => {
  expect(calls.some((c) => c.kind === "rpc")).toBe(false);
  expect(calls.some((c) => c.kind === "insert")).toBe(false);
  expect(remember).not.toHaveBeenCalled();
};
const KINDS = [
  ["experiment", /crea un experimento/],
  ["commercial_action", /crea una tarea/],
] as const;

describe("decideSuggestionCore: a test or a commercial action is not accepted without its form (CA-1)", () => {
  for (const [type, text] of KINDS)
    it(`${type}: approve without a draft is refused with the reason and decides nothing`, async () => {
      const { db, calls } = fakeDbByTable({ suggestions: typed(type) });
      const e = await decideSuggestionCore(ctx(db), "s1", "approve").catch((x: Error) => x);
      expect(e).toBeInstanceOf(Error);
      expect((e as Error).message).toMatch(/^No la he aceptado\./);
      expect((e as Error).message).toMatch(text);
      expect((e as Error).message).toMatch(/Ábrela en Sugerencias/);
      expect((e as Error).message).not.toMatch(/\.$/); // the app and Telegram add the full stop
      noDecision(calls);
    });
});

describe("decideSuggestionCore: snooze, dismiss and other types keep working without a draft (CA-2, CA-3 guards)", () => {
  for (const [type] of KINDS)
    it(`${type}: snooze and dismiss need no draft`, async () => {
      const a = fakeDbByTable({ suggestions: typed(type) }, "n", "snoozed");
      await decideSuggestionCore(ctx(a.db), "s1", "snooze");
      expect(a.calls.find((c) => c.kind === "rpc")!.payload).toMatchObject({
        p_decision: "postpone",
      });
      const d = fakeDbByTable({ suggestions: typed(type) }, "n", "dismissed");
      await decideSuggestionCore(ctx(d.db), "s1", "dismiss");
      expect(d.calls.find((c) => c.kind === "rpc")!.payload).toMatchObject({
        p_decision: "dismiss",
      });
    });
  it("approve with a valid draft decides, creates the experiment and links it", async () => {
    const { db, calls } = fakeDbByTable({ suggestions: typed("experiment") }, "exp-1");
    await decideSuggestionCore(ctx(db), "s1", "approve", {
      execute: exec({ kind: "experiment", draft: expDraft }),
    });
    expect(calls.find((c) => c.kind === "rpc")!.payload).toMatchObject({ p_decision: "accept" });
    expect(
      calls.find((c) => c.table === "gtm_experiments" && c.kind === "insert")!.payload,
    ).toMatchObject({
      hypothesis: expDraft.hypothesis,
    });
    expect(
      calls.find((c) => c.table === "strategy_links" && c.kind === "insert")!.payload,
    ).toMatchObject({
      kind: "experiment",
      ref_id: "exp-1",
    });
  });
  it("approve with a valid draft decides, creates the task and links it", async () => {
    const { db, calls } = fakeDbByTable({ suggestions: typed("commercial_action") }, "task-1");
    await decideSuggestionCore(ctx(db), "s1", "approve", {
      execute: exec({ kind: "task", draft: taskDraftOk }),
    });
    expect(calls.find((c) => c.kind === "rpc")).toBeDefined();
    expect(calls.find((c) => c.table === "tasks" && c.kind === "insert")!.payload).toMatchObject({
      title: "Llamar",
    });
    expect(
      calls.find((c) => c.table === "strategy_links" && c.kind === "insert")!.payload,
    ).toMatchObject({
      kind: "task",
      ref_id: "task-1",
    });
  });
  it("a data or strategy-change suggestion is still accepted without a draft", async () => {
    const { db, calls } = fakeDbByTable({ suggestions: strat() });
    const r = await decideSuggestionCore(ctx(db), "s1", "approve");
    expect(r.status).toBe("approved");
    expect(calls.some((c) => c.kind === "rpc")).toBe(true);
  });
});

describe("decideSuggestionCore: an invalid draft decides nothing (CA-6)", () => {
  const bad =
    (type: "experiment" | "commercial_action", execute: unknown, msg: RegExp) => async () => {
      const { db, calls } = fakeDbByTable({ suggestions: typed(type) });
      await expect(
        decideSuggestionCore(ctx(db), "s1", "approve", { execute: exec(execute) }),
      ).rejects.toThrow(msg);
      noDecision(calls);
    };
  it(
    "experiment without hypothesis",
    bad("experiment", { kind: "experiment", draft: { ...expDraft, hypothesis: " " } }, /hipótesis/),
  );
  it(
    "experiment without metric",
    bad("experiment", { kind: "experiment", draft: { ...expDraft, metric: "" } }, /métrica/),
  );
  it(
    "experiment without review date",
    bad(
      "experiment",
      { kind: "experiment", draft: { ...expDraft, review_on: "" } },
      /fecha de revisión/,
    ),
  );
  it(
    "task without title",
    bad("commercial_action", { kind: "task", draft: { ...taskDraftOk, title: "  " } }, /título/),
  );
});

describe("decideSuggestionCore: a draft of the wrong shape or type decides nothing (CA-7)", () => {
  const bad =
    (type: "experiment" | "commercial_action" | "strategy_change", execute: unknown) =>
    async () => {
      const sug = type === "strategy_change" ? strat() : typed(type);
      const { db, calls } = fakeDbByTable({ suggestions: sug });
      await expect(
        decideSuggestionCore(ctx(db), "s1", "approve", { execute: exec(execute) }),
      ).rejects.toThrow(Error);
      noDecision(calls);
    };
  it("a task draft on an experiment", bad("experiment", { kind: "task", draft: taskDraftOk }));
  it(
    "an experiment draft on a commercial action",
    bad("commercial_action", { kind: "experiment", draft: expDraft }),
  );
  it(
    "any draft on a suggestion of another type",
    bad("strategy_change", { kind: "experiment", draft: expDraft }),
  );
  it("a draft that is not an object", async () => {
    for (const draft of [null, "texto", 7, []])
      await bad("experiment", { kind: "experiment", draft })();
  });
  it("an execute that is not an object", async () => {
    for (const e of ["experiment", 3, []]) await bad("experiment", e)();
  });
  it("fields that are not text", async () => {
    await bad("experiment", { kind: "experiment", draft: { ...expDraft, hypothesis: 5 } })();
    await bad("experiment", { kind: "experiment", draft: { ...expDraft, title: null } })();
    await bad("commercial_action", { kind: "task", draft: { ...taskDraftOk, owner_id: 3 } })();
    await bad("commercial_action", { kind: "task", draft: { ...taskDraftOk, deal_id: 9 } })();
  });
  it("dates that are not dates", async () => {
    await bad("experiment", { kind: "experiment", draft: { ...expDraft, review_on: "mañana" } })();
    await bad("experiment", {
      kind: "experiment",
      draft: { ...expDraft, review_on: "2026-13-45" },
    })();
    await bad("commercial_action", {
      kind: "task",
      draft: { ...taskDraftOk, due_date: "2026-02-31" },
    })();
  });
  it("a task may have no due date and no deal", async () => {
    const { db, calls } = fakeDbByTable({ suggestions: typed("commercial_action") }, "t");
    await decideSuggestionCore(ctx(db), "s1", "approve", {
      execute: exec({ kind: "task", draft: { ...taskDraftOk, due_date: "" } }),
    });
    expect(calls.some((c) => c.kind === "rpc")).toBe(true);
  });
});
