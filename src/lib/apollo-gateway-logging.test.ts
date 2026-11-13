import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolCtx } from "@/lib/agent/tool-kit";

// NK-0173 SDD 2: reveals log their spend from every path, store the email status Apollo already
// returns, and never overwrite a saved email — a different one is only proposed.

const upserts: { rows: { org_id: string; email: string; status: string }[]; onConflict?: string }[] = [];
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => ({
      upsert: async (rows: never, opts?: { onConflict?: string }) => {
        upserts.push({ rows, onConflict: opts?.onConflict });
        return { error: null };
      },
    }),
  },
}));

import { revealStakeholder, revealToAccount } from "@/lib/apollo-gateway";

type Q = { table: string; op: string; payload?: Record<string, unknown>; filters: unknown[][] };
function fakeDb(reply: (q: Q) => { data?: unknown; error?: { message: string } | null } | undefined) {
  const log: Q[] = [];
  const from = (table: string) => {
    const q: Q = { table, op: "select", filters: [] };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- recording fake
    const proxy: any = new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === "then") {
            log.push(q);
            const r = reply(q) ?? {};
            const res = { data: r.data ?? null, error: r.error ?? null, count: null };
            return (res1: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
              Promise.resolve(res).then(res1, rej);
          }
          return (...args: unknown[]) => {
            if (prop === "insert" || prop === "update" || prop === "upsert" || prop === "delete") {
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
  return { db: { from } as unknown as ToolCtx["db"], log };
}

const ORG = "org-1";
const ME = "11111111-1111-4111-8111-111111111111";
const ctx = (db: ToolCtx["db"]): ToolCtx => ({ db, orgId: ORG, userId: ME, roles: ["ae"], currency: "EUR" });

function stubApollo(matches: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ matches }), { status: 200 })),
  );
}

beforeEach(() => {
  upserts.splice(0);
  vi.stubEnv("APOLLO_API_KEY", "test");
  vi.stubEnv("LOVABLE_API_KEY", "test");
});

const MATCH = {
  id: "abc123",
  name: "Persona Sintética",
  title: "CEO",
  email: "nueva@example.invalid",
  email_status: "verified",
  linkedin_url: null,
  city: null,
  country: null,
};

describe("reveal spend logging (CA-5)", () => {
  it("revealToAccount logs find_email with the reveal cost", async () => {
    stubApollo([MATCH, { ...MATCH, id: "def456", email: null, email_status: null }]);
    const { db, log } = fakeDb((q) => {
      if (q.table === "accounts") return { data: { id: "acc-1", domain: "example.invalid" } };
      if (q.table === "stakeholders" && q.op === "select") return { data: [] };
      if (q.table === "stakeholders" && q.op === "insert") return { data: { id: "st-1" } };
      return undefined;
    });
    const r = await revealToAccount(ctx(db), { accountId: "acc-1", apolloIds: ["abc123", "def456"] });
    expect(r).toHaveLength(2);
    const usage = log.filter((q) => q.table === "integration_usage" && q.op === "insert");
    expect(usage).toHaveLength(1);
    const rows = [usage[0].payload].flat() as { service: string; need: string; cost: number; trigger: string; org_id: string }[];
    expect(rows[0]).toMatchObject({ service: "apollo", need: "find_email", cost: 0.04, trigger: "manual", org_id: ORG });
  });
  it("revealStakeholder logs find_phone when the mobile is asked", async () => {
    stubApollo([MATCH]);
    const { db, log } = fakeDb((q) => {
      if (q.table === "stakeholders" && q.op === "select")
        return { data: { id: "st-1", name: "Persona Sintética", email: null, linkedin_url: null, title: null, phone: null, account_id: "acc-1" } };
      if (q.table === "accounts") return { data: { id: "acc-1", domain: "example.invalid" } };
      if (q.table === "phone_reveals") return { data: [] };
      return undefined;
    });
    await revealStakeholder(ctx(db), { stakeholderId: "st-1", phone: true, webhookBase: "https://example.invalid" });
    const usage = log.filter((q) => q.table === "integration_usage" && q.op === "insert");
    expect(usage).toHaveLength(1);
    const rows = [usage[0].payload].flat() as { need: string; cost: number }[];
    expect(rows[0]).toMatchObject({ need: "find_phone", cost: 0.17 });
  });
});

describe("email status storage (CA-3, CA-4)", () => {
  it("stores the mapped status for every revealed email, normalized", async () => {
    stubApollo([{ ...MATCH, email: "  NUEVA@EXAMPLE.INVALID ", email_status: "verified" }]);
    const { db } = fakeDb((q) => {
      if (q.table === "accounts") return { data: { id: "acc-1", domain: "example.invalid" } };
      if (q.table === "stakeholders" && q.op === "select") return { data: [] };
      if (q.table === "stakeholders" && q.op === "insert") return { data: { id: "st-1" } };
      return undefined;
    });
    await revealToAccount(ctx(db), { accountId: "acc-1", apolloIds: ["abc123"] });
    expect(upserts).toHaveLength(1);
    expect(upserts[0].onConflict).toBe("org_id,email");
    expect(upserts[0].rows[0]).toMatchObject({ org_id: ORG, email: "nueva@example.invalid", status: "verified" });
  });
  it("an unknown provider value is stored as unverifiable, never verified", async () => {
    stubApollo([{ ...MATCH, email_status: "extrapolated" }]);
    const { db } = fakeDb((q) => {
      if (q.table === "accounts") return { data: { id: "acc-1", domain: "example.invalid" } };
      if (q.table === "stakeholders" && q.op === "select") return { data: [] };
      if (q.table === "stakeholders" && q.op === "insert") return { data: { id: "st-1" } };
      return undefined;
    });
    await revealToAccount(ctx(db), { accountId: "acc-1", apolloIds: ["abc123"] });
    expect(upserts[0].rows[0].status).toBe("unverifiable");
  });
});

describe("keep and propose (CA-6, CA-7)", () => {
  const existing = {
    id: "st-1",
    name: "Persona Sintética",
    email: "guardado@example.invalid",
    linkedin_url: null,
    title: null,
    phone: null,
    account_id: "acc-1",
  };
  const dbFor = () =>
    fakeDb((q) => {
      if (q.table === "stakeholders" && q.op === "select") return { data: existing };
      if (q.table === "accounts") return { data: { id: "acc-1", domain: "example.invalid" } };
      return undefined;
    });
  it("a different email from Apollo is kept as a proposal, never written", async () => {
    stubApollo([MATCH]);
    const { db, log } = dbFor();
    const r = await revealStakeholder(ctx(db), { stakeholderId: "st-1" });
    expect(r.proposedEmail).toBe("nueva@example.invalid");
    const updates = log.filter((q) => q.table === "stakeholders" && q.op === "update");
    for (const u of updates) expect(u.payload).not.toHaveProperty("email");
  });
  it("an empty email is filled as today and nothing is proposed", async () => {
    stubApollo([MATCH]);
    const { db, log } = fakeDb((q) => {
      if (q.table === "stakeholders" && q.op === "select") return { data: { ...existing, email: null } };
      if (q.table === "accounts") return { data: { id: "acc-1", domain: "example.invalid" } };
      return undefined;
    });
    const r = await revealStakeholder(ctx(db), { stakeholderId: "st-1" });
    expect(r.proposedEmail).toBeNull();
    const updates = log.filter((q) => q.table === "stakeholders" && q.op === "update");
    expect(updates[0].payload).toMatchObject({ email: "nueva@example.invalid" });
  });
  it("the same email is neither written nor proposed", async () => {
    stubApollo([{ ...MATCH, email: "guardado@example.invalid" }]);
    const { db, log } = dbFor();
    const r = await revealStakeholder(ctx(db), { stakeholderId: "st-1" });
    expect(r.proposedEmail).toBeNull();
    const updates = log.filter((q) => q.table === "stakeholders" && q.op === "update");
    for (const u of updates) expect(u.payload).not.toHaveProperty("email");
  });
});
