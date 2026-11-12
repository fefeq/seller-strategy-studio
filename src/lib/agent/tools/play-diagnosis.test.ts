// SDD-20261112-diagnosis-in-chat U-2, read part (session 1): playStateRows reports a failed read, and planFor builds the plan with the same
// reads as the tools will. A fake Supabase client records every query; companies and people are fictitious.
import { describe, expect, it } from "vitest";
import type { ToolCtx } from "@/lib/agent/tools";
import { planFor } from "@/lib/agent/tools/play-diagnosis";
import { playStateRows } from "@/lib/agent/tools/plays";

type Q = {
  table: string;
  op: "select" | "insert" | "update" | "upsert" | "delete" | "rpc";
  payload?: unknown;
  selected?: string;
  filters: unknown[][];
};
type Reply = { data?: unknown; error?: { message: string } | null } | undefined;
function fakeDb(
  reply: (q: Q) => Reply = () => undefined,
  rpc: (name: string, args: unknown) => Reply = () => ({ data: null }),
) {
  const log: Q[] = [];
  const from = (table: string) => {
    const q: Q = { table, op: "select", filters: [] };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the fake query builder is a Proxy
    const proxy: any = new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === "then") {
            log.push(q);
            const r = reply(q) ?? {};
            const res = { data: r.data ?? null, error: r.error ?? null };
            return (a: (v: unknown) => unknown, b: (e: unknown) => unknown) =>
              Promise.resolve(res).then(a, b);
          }
          return (...args: unknown[]) => {
            if (prop === "insert" || prop === "update" || prop === "upsert" || prop === "delete") {
              q.op = prop;
              q.payload = args[0];
            } else if (prop === "select") q.selected = String(args[0] ?? "");
            else if (!["single", "maybeSingle", "order", "limit"].includes(prop))
              q.filters.push([prop, ...args]);
            return proxy;
          };
        },
      },
    );
    return proxy;
  };
  const rpcFn = async (name: string, args: unknown) => {
    log.push({ table: name, op: "rpc", payload: args, filters: [] });
    const r = rpc(name, args);
    return { data: r?.data ?? null, error: r?.error ?? null };
  };
  return { db: { from, rpc: rpcFn } as unknown as ToolCtx["db"], log };
}

const ORG = "org-1";
const ME = "11111111-1111-4111-8111-111111111111";
const ctxWith = (db: ToolCtx["db"], roles: string[] = ["owner"]): ToolCtx => ({
  db,
  orgId: ORG,
  userId: ME,
  roles,
  currency: "EUR",
});
const eq = (q: Q, col: string, val: unknown) =>
  q.filters.some(([op, c, v]) => op === "eq" && c === col && v === val);
const writes = (log: Q[]) => log.filter((q) => q.op !== "select" && q.op !== "rpc");
/** Every query reads only the caller's company: the rule that keeps Telegram (privileged client) safe. */
function expectScoped(log: Q[]) {
  for (const q of log) {
    if (q.op === "rpc") expect((q.payload as { _org?: string })._org, q.table).toBe(ORG);
    else
      expect(
        eq(q, "org_id", ORG) || (q.table === "organizations" && eq(q, "id", ORG)),
        `${q.op} ${q.table}`,
      ).toBe(true);
  }
}

const diag = (motion = "inside_sales") => ({
  input: { model: "b2b", acv: 9000, friction: "committee", stage: "early" },
  result: {
    archetype: "B",
    name: "Arquetipo ficticio",
    motion,
    nextStep: "Define tu ICP",
    active: ["x"],
    discarded: [],
    forced: [],
    star: "z",
  },
});
const POS = [
  "best_customers",
  "alternatives",
  "differentiation",
  "value",
  "trend",
  "target_customer",
  "need",
  "category",
  "key_benefit",
  "competitive_alternative",
  "differentiator",
  "one_liner",
  "elevator_pitch",
];
const fullPositioning = Object.fromEntries(POS.map((k) => [k, `texto ${k}`]));
const icps = [{ industries: "a", company_size: "b", why_fit: "c", anti_icp: "d" }];

type World = {
  states?: { play_id: string; enabled: boolean }[];
  statesError?: boolean;
  setupError?: boolean;
  diagnosis?: unknown;
  positioning?: unknown;
  icps?: unknown;
};
/** A ready company by default (diagnosis, positioning and ICP); each test changes what it needs. */
const world =
  (w: World = {}) =>
  (q: Q): Reply => {
    if (q.table === "play_states")
      return w.statesError ? { error: { message: "boom" } } : { data: w.states ?? [] };
    if (q.table === "icp_profiles")
      return w.setupError ? { error: { message: "setup down" } } : { data: w.icps ?? icps };
    if (q.table === "positioning")
      return { data: "positioning" in w ? w.positioning : fullPositioning };
    return undefined;
  };
const rpcOf = (w: World) => () => ({ data: "diagnosis" in w ? w.diagnosis : diag() });

describe("playStateRows reports a failed read", () => {
  it("a good read: ok true and the rows by play id, read with the company filter", async () => {
    const { db, log } = fakeDb(
      world({
        states: [
          { play_id: "crm-hygiene", enabled: true },
          { play_id: "closed-lost-revival", enabled: false },
        ],
      }),
    );
    const r = await playStateRows(ctxWith(db));
    expect(r.ok).toBe(true);
    expect([...r.rows.keys()]).toEqual(["crm-hygiene", "closed-lost-revival"]);
    expect(r.rows.get("crm-hygiene")!.enabled).toBe(true);
    expect(log).toHaveLength(1);
    expect(log[0]!.table).toBe("play_states");
    expect(log[0]!.selected).toBe("play_id,enabled");
    expect(eq(log[0]!, "org_id", ORG)).toBe(true);
  });

  it("an empty table is ok true with no rows (a company that never changed a play)", async () => {
    const r = await playStateRows(ctxWith(fakeDb(world()).db));
    expect(r).toEqual({ ok: true, rows: new Map() });
  });

  it("a failed read is ok false and no rows, never «all defaults» passed off as a good read", async () => {
    const { db } = fakeDb(world({ statesError: true }));
    const r = await playStateRows(ctxWith(db));
    expect(r.ok).toBe(false);
    expect(r.rows.size).toBe(0);
  });
});

describe("planFor: the plan the tools will show and save", () => {
  it("a ready company with no rows gets scenario A of the SDD, and reads without writing", async () => {
    const w: World = {};
    const { db, log } = fakeDb(world(w), rpcOf(w));
    const out = await planFor(ctxWith(db), { bottleneck: null, wanted: [] });
    if (!out.playsOk) throw new Error("expected the plays to be readable");
    expect(out.status.ready).toBe(true);
    if (!out.result.ready) throw new Error("expected a ready result");
    expect(out.result.proposed.map((t) => t.id)).toEqual([
      "priorizar-cuentas-y-crm",
      "reactivar-perdidos",
      "senales-de-cuenta",
    ]);
    expect(out.result.alreadyActive.map((t) => t.id)).toEqual(["reuniones"]);
    expect(out.result.activation.map((a) => a.play_id)).toEqual([
      "hubspot-account-tiering-scoring",
      "signals-in-crm-with-decay",
      "closed-lost-revival",
    ]);
    expect(writes(log)).toEqual([]);
    expectScoped(log);
  });

  it("uses the company's rows: a play already enabled leaves the plan", async () => {
    const w: World = { states: [{ play_id: "hubspot-account-tiering-scoring", enabled: true }] };
    const { db } = fakeDb(world(w), rpcOf(w));
    const out = await planFor(ctxWith(db), { bottleneck: null, wanted: [] });
    if (!out.playsOk || !out.result.ready) throw new Error("expected a ready plan");
    expect(out.result.activation.map((a) => a.play_id)).not.toContain(
      "hubspot-account-tiering-scoring",
    );
  });

  it("uses the answers: a bottleneck goes first", async () => {
    const w: World = {};
    const { db } = fakeDb(world(w), rpcOf(w));
    const out = await planFor(ctxWith(db), { bottleneck: "aprender-de-llamadas", wanted: [] });
    if (!out.playsOk || !out.result.ready) throw new Error("expected a ready plan");
    expect(out.result.proposed[0]!.id).toBe("aprender-de-llamadas");
  });

  it("the archetype comes from the company's diagnosis: a plg motion fits entrantes-y-producto", async () => {
    const w: World = { diagnosis: diag("plg") };
    const { db } = fakeDb(world(w), rpcOf(w));
    const out = await planFor(ctxWith(db), { bottleneck: null, wanted: [] });
    if (!out.playsOk || !out.result.ready) throw new Error("expected a ready plan");
    expect(out.result.proposed.map((t) => t.id)).toContain("entrantes-y-producto");
  });

  it("a failed play_states read gives playsOk false and no plan", async () => {
    const w: World = { statesError: true };
    const { db } = fakeDb(world(w), rpcOf(w));
    const out = await planFor(ctxWith(db), { bottleneck: null, wanted: [] });
    expect(out).toEqual({ playsOk: false });
  });

  it("a company that is not ready (no diagnosis) gets what is missing and no teams", async () => {
    const w: World = { diagnosis: null };
    const { db } = fakeDb(world(w), rpcOf(w));
    const out = await planFor(ctxWith(db), { bottleneck: "reuniones", wanted: [] });
    if (!out.playsOk) throw new Error("expected the plays to be readable");
    expect(out.status.ready).toBe(false);
    expect(out.result).toEqual({ ready: false, missing: ["Diagnóstico GTM sin hacer"] });
  });

  it("only the segments missing does not block: it still proposes", async () => {
    const w: World = {};
    const { db } = fakeDb(world(w), rpcOf(w));
    const out = await planFor(ctxWith(db), { bottleneck: null, wanted: [] });
    if (!out.playsOk) throw new Error("expected the plays to be readable");
    // The fake company has no segments: the status lists it in missing but it does not block ready.
    expect(out.status.missing).toContain("Segmentos sin rango de ACV");
    expect(out.result.ready).toBe(true);
  });

  it("a failed setup read throws instead of inventing a plan", async () => {
    const w: World = { setupError: true };
    const { db } = fakeDb(world(w), rpcOf(w));
    await expect(planFor(ctxWith(db), { bottleneck: null, wanted: [] })).rejects.toThrow();
  });

  it("does not read voice or rules: only onboarding, setup and play_states tables are touched", async () => {
    const w: World = {};
    const { db, log } = fakeDb(world(w), rpcOf(w));
    await planFor(ctxWith(db), { bottleneck: null, wanted: [] });
    expect(log.map((q) => q.table)).not.toContain("knowledge_docs");
    expect(log.map((q) => q.table)).toContain("play_states");
  });
});
