// SDD-20261111-onboarding-complete U-3 (CA-7, CA-8, CA-9): get_onboarding_status in the agent registry and the MCP manifest.
// A fake Supabase client records every query and the RPC; companies and people are fictitious.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TOOLS, canUseTool, executeTool, getTool, type ToolCtx } from "@/lib/agent/tools";
import { companyDiagnosisFor } from "@/lib/agent/tools/onboarding";
import { TITLES } from "@/lib/mcp/tools/agent-tools";

type Q = { table: string; op: "select" | "insert" | "update" | "upsert" | "delete" | "rpc"; payload?: unknown; selected?: string; filters: unknown[][] };
type Reply = { data?: unknown; error?: { message: string } | null } | undefined;
function fakeDb(reply: (q: Q) => Reply = () => undefined, rpc: (name: string, args: unknown) => Reply | "throw" = () => ({ data: null })) {
  const log: Q[] = [];
  const from = (table: string) => {
    const q: Q = { table, op: "select", filters: [] };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the fake query builder is a Proxy
    const proxy: any = new Proxy({}, {
      get(_t, prop: string) {
        if (prop === "then") {
          log.push(q);
          const r = reply(q) ?? {};
          const res = { data: r.data ?? null, error: r.error ?? null };
          return (a: (v: unknown) => unknown, b: (e: unknown) => unknown) => Promise.resolve(res).then(a, b);
        }
        return (...args: unknown[]) => {
          if (prop === "insert" || prop === "update" || prop === "upsert" || prop === "delete") { q.op = prop; q.payload = args[0]; }
          else if (prop === "select") q.selected = String(args[0] ?? "");
          else if (!["single", "maybeSingle", "order", "limit"].includes(prop)) q.filters.push([prop, ...args]);
          return proxy;
        };
      },
    });
    return proxy;
  };
  const rpcFn = async (name: string, args: unknown) => {
    log.push({ table: name, op: "rpc", payload: args, filters: [] });
    const r = rpc(name, args);
    if (r === "throw") throw new Error("rpc down");
    return { data: r?.data ?? null, error: r?.error ?? null };
  };
  return { db: { from, rpc: rpcFn } as unknown as ToolCtx["db"], log };
}

const ORG = "org-1";
const ME = "11111111-1111-4111-8111-111111111111";
const MATE = "22222222-2222-4222-8222-222222222222";
const ctxWith = (db: ToolCtx["db"], roles: string[] = ["owner"]): ToolCtx => ({ db, orgId: ORG, userId: ME, roles, currency: "EUR" });
const eq = (q: Q, col: string, val: unknown) => q.filters.some(([op, c, v]) => op === "eq" && c === col && v === val);
const writes = (log: Q[]) => log.filter((q) => q.op !== "select" && q.op !== "rpc");
function expectScoped(log: Q[]) {
  for (const q of log) {
    if (q.op === "rpc") expect((q.payload as { _org?: string })._org, q.table).toBe(ORG);
    else expect(eq(q, "org_id", ORG) || (q.table === "organizations" && eq(q, "id", ORG)), `${q.op} ${q.table}`).toBe(true);
  }
}

const diag = (acv = 12345, archetype = "B") => ({
  input: { model: "b2b", acv, friction: "committee", stage: "early" },
  result: { archetype, name: "B2B mid-market / híbrido", motion: "inside_sales", nextStep: "Define tu ICP", active: ["x"], discarded: [{ framework: "Y", reason: `Tu ticket es de ${acv} al año` }], forced: [], star: "z" },
});
const POS = ["best_customers", "alternatives", "differentiation", "value", "trend", "target_customer", "need", "category", "key_benefit", "competitive_alternative", "differentiator", "one_liner", "elevator_pitch"];
const fullPositioning = Object.fromEntries(POS.map((k) => [k, `texto ${k}`]));

type Rows = { sessions?: unknown; sessionsError?: boolean; positioning?: unknown; icps?: unknown };
/** The db answers per table; onboarding_sessions answers the person's row (maybeSingle) or the company list by the filters used. */
const replies = (r: Rows) => (q: Q): Reply => {
  if (q.table === "onboarding_sessions") {
    if (r.sessionsError) return { error: { message: "boom" } };
    const rows = (r.sessions ?? []) as { user_id: string }[];
    return { data: eq(q, "user_id", ME) ? (rows.find((x) => x.user_id === ME) ?? null) : rows };
  }
  if (q.table === "positioning") return { data: r.positioning ?? null };
  if (q.table === "icp_profiles") return { data: r.icps ?? [] };
  return undefined;
};

describe("get_onboarding_status (CA-7)", () => {
  it("is a read tool for every member with an empty input", () => {
    const t = getTool("get_onboarding_status")!;
    expect(t.kind).toBe("read");
    expect(t.roles).toBeUndefined();
    expect(canUseTool(t, ["ae"])).toBe(true);
    expect(t.input.safeParse({}).success).toBe(true);
  });

  it("(a) the person's context: the RPC diagnosis is the company's; nothing is written and every query is scoped", async () => {
    const { db, log } = fakeDb(replies({ sessions: [{ user_id: ME, step: "diagnosis", diagnosis: null }], positioning: fullPositioning, icps: [{ industries: "a", company_size: "b", why_fit: "c", anti_icp: "d" }] }), () => ({ data: diag() }));
    const out = (await executeTool(ctxWith(db), "get_onboarding_status", {})) as { diagnosis: { archetype: string; stage: string }; mine: { step: string; done: boolean }; ready: boolean; missing: string[] };
    expect(out.diagnosis.archetype).toBe("B");
    expect(out.diagnosis.stage).toBe("early");
    expect(out.mine).toEqual({ step: "diagnosis", done: false });
    expect(out.ready).toBe(true);
    expect(writes(log)).toEqual([]);
    expectScoped(log);
    const mine = log.find((q) => q.table === "onboarding_sessions" && eq(q, "user_id", ME))!;
    expect(eq(mine, "org_id", ORG)).toBe(true);
    expect(mine.selected).toBe("step,diagnosis");
  });

  it("(b) privileged context: the RPC answers null and a colleague's diagnosis is used when mine has none", async () => {
    const rows = [
      { user_id: ME, diagnosis: null, updated_at: "2026-11-10T10:00:00Z" },
      { user_id: MATE, diagnosis: diag(900, "A"), updated_at: "2026-11-09T10:00:00Z" },
    ];
    const { db, log } = fakeDb(replies({ sessions: rows }), () => ({ data: null }));
    const d = await companyDiagnosisFor(ctxWith(db));
    expect((d as ReturnType<typeof diag>).result.archetype).toBe("A");
    const q = log.find((x) => x.table === "onboarding_sessions")!;
    expect(eq(q, "org_id", ORG)).toBe(true);
    expect(q.selected).toBe("user_id,diagnosis,updated_at");
  });

  it("the person's own diagnosis wins over a more recent colleague's; without it, the most recent", async () => {
    const own = { user_id: ME, diagnosis: diag(1, "C"), updated_at: "2026-11-01T10:00:00Z" };
    const mateOld = { user_id: MATE, diagnosis: diag(1, "A"), updated_at: "2026-11-02T10:00:00Z" };
    const mateNew = { user_id: "33333333-3333-4333-8333-333333333333", diagnosis: diag(1, "D"), updated_at: "2026-11-05T10:00:00Z" };
    const pick = async (rows: unknown[]) => ((await companyDiagnosisFor(ctxWith(fakeDb(replies({ sessions: rows }), () => ({ data: null })).db))) as ReturnType<typeof diag>).result.archetype;
    expect(await pick([mateNew, own, mateOld])).toBe("C");
    expect(await pick([mateOld, mateNew])).toBe("D");
  });

  it("(c) an RPC error or a throw falls back to the person's own row", async () => {
    const rows = [{ user_id: ME, diagnosis: diag(1, "E"), updated_at: "2026-11-10T10:00:00Z" }];
    for (const rpc of [() => ({ error: { message: "no function" } }), () => "throw" as const]) {
      const d = await companyDiagnosisFor(ctxWith(fakeDb(replies({ sessions: rows }), rpc).db));
      expect((d as ReturnType<typeof diag>).result.archetype).toBe("E");
    }
  });

  it("(d) everything failing gives diagnosis null and «Diagnóstico GTM sin hacer», never a tool error", async () => {
    const { db } = fakeDb(replies({ sessionsError: true }), () => ({ error: { message: "boom" } }));
    expect(await companyDiagnosisFor(ctxWith(db))).toBeNull();
    const out = (await executeTool(ctxWith(db), "get_onboarding_status", {})) as { diagnosis: unknown; missing: string[]; ready: boolean };
    expect(out.diagnosis).toBeNull();
    expect(out.missing).toContain("Diagnóstico GTM sin hacer");
    expect(out.ready).toBe(false);
  });
});

describe("get_onboarding_status privacy (CA-8)", () => {
  const FORBIDDEN = ["proposal", "findings", "opinions", "sources", "block_status", "read_job_id"];
  const keys = (v: unknown): string[] => (v && typeof v === "object" ? Object.entries(v).flatMap(([k, x]) => [k, ...keys(x)]) : []);

  it("never returns the proposal, findings, sources or the ticket, at any level", async () => {
    const full = { user_id: ME, step: "blocks", diagnosis: diag(12345), proposal: { s: 1 }, findings: [{ text: "secreto" }], opinions: [], sources: ["Web · https://ejemplo.test"], block_status: {}, read_job_id: "j1", updated_at: "2026-11-10T10:00:00Z" };
    const { db, log } = fakeDb(replies({ sessions: [full] }), () => ({ data: diag(12345) }));
    const out = await executeTool(ctxWith(db), "get_onboarding_status", {});
    const text = JSON.stringify(out);
    for (const k of FORBIDDEN) expect(keys(out), k).not.toContain(k);
    expect(keys(out)).not.toContain("acv");
    expect(keys(out)).not.toContain("discarded");
    expect(text).not.toContain("12345");
    expect(text).not.toContain("12.345");
    expect(text).not.toContain("secreto");
    for (const q of log.filter((x) => x.table === "onboarding_sessions"))
      for (const k of FORBIDDEN) expect(q.selected, k).not.toContain(k);
    expect(log.filter((x) => x.table === "onboarding_sessions").every((x) => x.selected !== "*")).toBe(true);
  });

  it("the ticket does not leak through the fallback either", async () => {
    const rows = [{ user_id: MATE, diagnosis: diag(12345), updated_at: "2026-11-10T10:00:00Z" }];
    const out = await executeTool(ctxWith(fakeDb(replies({ sessions: rows }), () => ({ data: null })).db), "get_onboarding_status", {});
    expect(JSON.stringify(out)).not.toMatch(/12345|12\.345/);
  });
});

describe("get_onboarding_status title and manifest (CA-9)", () => {
  it("has its title and is in the registry exactly once", () => {
    expect(TITLES.get_onboarding_status).toBe("Ver el estado del onboarding");
    expect(TOOLS.filter((t) => t.name === "get_onboarding_status")).toHaveLength(1);
  });
  it("is once in .lovable/mcp/manifest.json with that title and readOnlyHint true", () => {
    const manifest = JSON.parse(readFileSync(".lovable/mcp/manifest.json", "utf8"));
    const found = manifest.mcp.tools.filter((t: { name: string }) => t.name === "get_onboarding_status");
    expect(found).toHaveLength(1);
    expect(found[0].title).toBe("Ver el estado del onboarding");
    expect(found[0].annotations.readOnlyHint).toBe(true);
  });
});
