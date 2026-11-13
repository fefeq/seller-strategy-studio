import { describe, expect, it, vi } from "vitest";
import { executeTool, type ToolCtx } from "@/lib/agent/tools";

// NK-0173 SDD 3: draft_followup applies the graduated gate (block invalid/catch-all with a reason
// and a registry row, mark unverified) and the reveal tools answer with estado_email.

vi.mock("@/lib/ai-gateway", async (orig) => ({
  ...(await orig<typeof import("@/lib/ai-gateway")>()),
  ask: async () => "Borrador de prueba.",
}));

vi.mock("@/lib/apollo-gateway", async (orig) => ({
  ...(await orig<typeof import("@/lib/apollo-gateway")>()),
  revealStakeholder: async () => ({
    found: true,
    contact: {
      apolloId: "abc123",
      name: "Persona Sintética",
      title: "CEO",
      email: "a@example.invalid",
      emailStatus: "verified",
      linkedin_url: null,
      location: null,
    },
    phone: "no",
    phoneNumber: null,
    proposedEmail: null,
  }),
}));

type Q = { table: string; op: string; payload?: unknown; filters: unknown[][] };
type Reply = { data?: unknown; error?: { message: string } | null } | undefined;
function fakeDb(reply: (q: Q) => Reply) {
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
              q.payload = args[0];
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
const LEAD = "00000000-0000-4000-8000-0000000000aa";
const ctx = (db: ToolCtx["db"]): ToolCtx => ({ db, orgId: ORG, userId: ME, roles: ["ae"], currency: "EUR" });

const leadRow = {
  id: LEAD,
  company: "Empresa Ficticia",
  contact_name: "Ana Prueba",
  title: "CEO",
  stage: "contacted",
  contacted_at: new Date(Date.now() - 4 * 86_400_000).toISOString(),
  next_step_at: null,
  notes: null,
  source: null,
  email: "ana@example.invalid",
};

function worldWith(status: string | null) {
  return (q: Q): Reply => {
    if (q.table === "leads") return { data: leadRow };
    if (q.table === "email_verifications")
      return {
        data: status
          ? { email: "ana@example.invalid", status, checked_at: new Date().toISOString() }
          : null,
      };
    if (q.table === "knowledge_docs") return { data: [] };
    if (q.table === "accounts") return { data: null };
    return { data: [] };
  };
}

describe("draft_followup email gate", () => {
  it("CA-3 an invalid email blocks the draft with the reason and registers it without the email", async () => {
    const { db, log } = fakeDb(worldWith("invalid"));
    const out = (await executeTool(ctx(db), "draft_followup", { lead_id: LEAD })) as Record<string, unknown>;
    expect(out.bloqueado).toBe(true);
    expect(out.motivo).toBe(
      "Este email es inválido: no preparo el borrador. Busca otro contacto de la cuenta.",
    );
    expect(out.borrador).toBeUndefined();
    const blocks = log.filter((q) => q.table === "email_draft_blocks" && q.op === "insert");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].payload).toMatchObject({
      org_id: ORG,
      surface: "draft_followup",
      status: "invalid",
    });
    expect(JSON.stringify(blocks[0].payload)).not.toContain("ana@example.invalid");
  });
  it("CA-3 a catch-all domain blocks too", async () => {
    const { db } = fakeDb(worldWith("catch_all"));
    const out = (await executeTool(ctx(db), "draft_followup", { lead_id: LEAD })) as Record<string, unknown>;
    expect(out.bloqueado).toBe(true);
    expect(out.motivo).toMatch(/catch-all/);
  });
  it("CA-4 an unverified email drafts with the visible mark", async () => {
    const { db, log } = fakeDb(worldWith(null));
    const out = (await executeTool(ctx(db), "draft_followup", { lead_id: LEAD })) as Record<string, unknown>;
    expect(out.bloqueado).toBeUndefined();
    expect(out.borrador).toBeTruthy();
    expect(out.marca_email).toBe("email sin verificar");
    expect(log.filter((q) => q.table === "email_draft_blocks")).toHaveLength(0);
  });
  it("CA-4 a verified email drafts with no mark", async () => {
    const { db } = fakeDb(worldWith("verified"));
    const out = (await executeTool(ctx(db), "draft_followup", { lead_id: LEAD })) as Record<string, unknown>;
    expect(out.borrador).toBeTruthy();
    expect(out.marca_email).toBeNull();
  });
});

describe("reveal tools answer with estado_email (CA-7)", () => {
  it("apollo_reveal_stakeholder maps the provider status to the closed set", async () => {
    const { db } = fakeDb(() => undefined);
    const out = (await executeTool(ctx(db), "apollo_reveal_stakeholder", {
      stakeholder_id: "00000000-0000-4000-8000-0000000000bb",
    })) as Record<string, unknown>;
    expect(out.estado_email).toBe("verificado");
  });
});
