// @vitest-environment node
// SDD-20261106-agent-rules-reader (NK-0069), U-2: runAgent loads the team's rules and hands them to the model in every turn
// (app chat, app interview, Telegram), and says so when they could not be read (CA-1b, CA-4). U-3: draft_followup and
// prepare_meeting_brief pass the same block to their AI call and warn in `mensaje` when the read fails (CA-5). Fake client, fictional rules.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolCtx } from "@/lib/agent/tools";
import { RULES_READ_FAILED, rulesBlock } from "@/lib/knowledge-rules";

const h = vi.hoisted(() => ({
  systems: [] as string[],
  asks: [] as { system: string; user: string }[],
}));

vi.mock("ai", () => ({
  streamText: (o: { system: string }) => {
    h.systems.push(o.system);
    return { text: Promise.resolve("Respuesta del modelo.") };
  },
  tool: (t: unknown) => t,
  jsonSchema: () => ({}),
  stepCountIs: () => undefined,
}));
vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: () => ({ chat: () => ({}), responses: () => ({}) }),
}));
vi.mock("@/lib/gemini", async (orig) => ({
  ...(await orig<typeof import("@/lib/gemini")>()),
  aiProviders: () => ["openrouter"],
}));
vi.mock("@/lib/ai-gateway", async (orig) => ({
  ...(await orig<typeof import("@/lib/ai-gateway")>()),
  ask: async (system: string, user: string) => {
    h.asks.push({ system, user });
    return "Borrador del modelo.";
  },
}));
vi.mock("@/lib/memory.server", () => ({
  memoryBlock: async () => "",
  learnFrom: async () => undefined,
  rememberDecision: async () => undefined,
}));
vi.mock("@/lib/after-response.server", () => ({ afterResponse: () => undefined }));
vi.mock("@tanstack/react-start", () => {
  const chain: object = new Proxy(() => chain, { get: () => () => chain, apply: () => chain });
  return { createServerFn: () => chain };
});
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));

import { runAgent } from "@/lib/agent/agent.server";
import { executeTool } from "@/lib/agent/tools";
import { decidePending } from "@/lib/agent.functions";

const ORG = "org-1";
const ME = "11111111-1111-4111-8111-111111111111";
const RULE = {
  titulo: "Descuentos",
  texto: "Nunca ofrecemos descuentos sin aprobación de dirección.",
};

type Q = { table: string; op: string; payload?: unknown; filters: unknown[][] };
type Reply = { data?: unknown; error?: { message: string } | null; throws?: boolean } | undefined;
/** Records every query; `reply` answers per table and operation. */
function fakeDb(reply: (q: Q) => Reply) {
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
            if (r.throws)
              return (_ok: unknown, fail: (e: unknown) => unknown) =>
                Promise.reject(new Error("fetch failed")).then(undefined, fail);
            return (ok: (v: unknown) => unknown) =>
              Promise.resolve({ data: r.data ?? null, error: r.error ?? null, count: null }).then(
                ok,
              );
          }
          return (...args: unknown[]) => {
            if (["insert", "update", "upsert", "delete"].includes(prop)) {
              q.op = prop;
              q.payload = args[0];
            } else if (prop !== "select") q.filters.push([prop, ...args]);
            return proxy;
          };
        },
      },
    );
    return proxy;
  };
  return { db: { from } as unknown as ToolCtx["db"], log };
}
const ruleRow = {
  org_id: ORG,
  title: RULE.titulo,
  body: RULE.texto,
  section: "rules",
  scope: "team",
  mandatory: false,
};
const rulesOk = (q: Q): Reply => (q.table === "knowledge_docs" ? { data: [ruleRow] } : undefined);
const rulesError = (q: Q): Reply =>
  q.table === "knowledge_docs"
    ? { error: { message: "permission denied for table knowledge_docs" } }
    : undefined;
const rulesThrow = (q: Q): Reply => (q.table === "knowledge_docs" ? { throws: true } : undefined);
const ctxWith = (db: ToolCtx["db"]): ToolCtx => ({
  db,
  orgId: ORG,
  userId: ME,
  roles: ["ae"],
  currency: "EUR",
});

let logs: string[] = [];
beforeEach(() => {
  h.systems.length = 0;
  h.asks.length = 0;
  logs = [];
  for (const m of ["error", "warn", "log", "info"] as const)
    vi.spyOn(console, m).mockImplementation((...a: unknown[]) => {
      logs.push(
        a
          .map((x) =>
            x instanceof Error
              ? `${x.name} ${x.message}`
              : typeof x === "string"
                ? x
                : JSON.stringify(x),
          )
          .join(" "),
      );
    });
});

const turn = (db: ToolCtx["db"], channel: "app" | "telegram", mode: "chat" | "interview") =>
  runAgent(ctxWith(db), {
    conversationId: "conv-1",
    text: "¿Qué propongo a este cliente?",
    channel,
    mode,
    orgName: "Empresa Ficticia",
  });

describe("runAgent hands the team's rules to the model (CA-1b)", () => {
  it.each([
    ["app", "chat"],
    ["app", "interview"],
    ["telegram", "chat"],
  ] as const)("%s turn in %s mode", async (channel, mode) => {
    const { db, log } = fakeDb(rulesOk);
    const out = await turn(db, channel, mode);
    expect(h.systems).toHaveLength(1);
    const system = h.systems[0]!;
    expect(system).toContain(rulesBlock([RULE]));
    if (mode === "interview") expect(system).toContain("MODO ENTREVISTA");
    // The rules are read with this company's filter, also with Telegram's privileged client.
    const read = log.find((q) => q.table === "knowledge_docs")!;
    expect(read.filters).toContainEqual(["eq", "org_id", ORG]);
    expect(read.filters).toContainEqual(["eq", "scope", "team"]);
    expect(out.text).toBe("Respuesta del modelo.");
    expect(logs.join("\n")).not.toContain(RULE.texto);
  });
});

describe("a failed read of the rules (CA-4)", () => {
  it.each([
    ["error returned by Supabase", rulesError],
    ["exception", rulesThrow],
  ] as const)(
    "%s: the turn goes on without rules and says so; the log has no rule text",
    async (_name, reply) => {
      const { db, log } = fakeDb(reply);
      const out = await turn(db, "telegram", "chat");
      expect(h.systems).toHaveLength(1);
      expect(h.systems[0]).not.toContain("reglas_obligatorias");
      expect(out.text.startsWith(RULES_READ_FAILED)).toBe(true);
      expect(out.text).toContain("Respuesta del modelo.");
      const saved = log
        .filter((q) => q.table === "agent_messages" && q.op === "insert")
        .map((q) => q.payload as { role: string; content: string });
      expect(saved.find((m) => m.role === "assistant")?.content.startsWith(RULES_READ_FAILED)).toBe(
        true,
      );
      expect(logs.join("\n")).toContain("knowledge rules load failed");
      expect(logs.join("\n")).not.toContain(RULE.texto);
    },
  );

  it("no notice when the rules were read", async () => {
    const out = await turn(fakeDb(rulesOk).db, "app", "chat");
    expect(out.text).not.toContain(RULES_READ_FAILED);
  });
});

// ---------- U-3: the agent's own drafting tools (CA-5) ----------
const LEAD = "33333333-3333-4333-8333-333333333333";
const MEETING = "44444444-4444-4444-8444-444444444444";
const ACTION = "55555555-5555-4555-8555-555555555555";
const contacted = new Date(Date.now() - 4 * 86_400_000).toISOString();
/** Tool data on top of a rules answer. */
const withTools =
  (rules: (q: Q) => Reply) =>
  (q: Q): Reply => {
    if (q.table === "knowledge_docs") return rules(q);
    if (q.table === "leads")
      return {
        data: {
          id: LEAD,
          company: "Empresa Ficticia",
          contact_name: "Ana Prueba",
          title: "CEO",
          stage: "contacted",
          contacted_at: contacted,
          next_step_at: null,
          notes: null,
          source: null,
        },
      };
    if (q.table === "meetings")
      return { data: { id: MEETING, title: "Reunión ficticia", account_id: null } };
    if (q.table === "agent_pending_actions")
      return q.op === "update"
        ? { data: [{ id: ACTION }] }
        : {
            data: {
              id: ACTION,
              status: "pending",
              tool: "prepare_meeting_brief",
              args: { meeting_id: MEETING },
              summary: "Generar y guardar la preparación de llamada de la reunión",
              conversation_id: "conv-1",
            },
          };
    return undefined;
  };
type Followup = { borrador: string; mensaje?: string };

describe("draft_followup with the team's rules (CA-5)", () => {
  it("passes the rules block to its AI call", async () => {
    const out = (await executeTool(ctxWith(fakeDb(withTools(rulesOk)).db), "draft_followup", {
      lead_id: LEAD,
    })) as Followup;
    expect(h.asks).toHaveLength(1);
    expect(h.asks[0]!.system).toContain(rulesBlock([RULE]));
    expect(out.borrador).toBe("Borrador del modelo.");
    expect(out.mensaje).toBeUndefined();
  });

  it.each([
    ["error returned by Supabase", rulesError],
    ["exception", rulesThrow],
  ] as const)(
    "%s: drafts without rules, warns in mensaje and before the draft",
    async (_name, reply) => {
      const out = (await executeTool(ctxWith(fakeDb(withTools(reply)).db), "draft_followup", {
        lead_id: LEAD,
      })) as Followup;
      expect(h.asks).toHaveLength(1);
      expect(h.asks[0]!.system).not.toContain("reglas_obligatorias");
      expect(out.mensaje).toBe(RULES_READ_FAILED);
      expect(out.borrador.startsWith(RULES_READ_FAILED)).toBe(true);
      expect(out.borrador).toContain("Borrador del modelo.");
    },
  );
});

describe("prepare_meeting_brief with the team's rules (CA-5)", () => {
  it("passes the rules block to its AI call and saves the brief as written", async () => {
    const { db, log } = fakeDb(withTools(rulesOk));
    const out = (await executeTool(ctxWith(db), "prepare_meeting_brief", {
      meeting_id: MEETING,
    })) as { mensaje?: string };
    expect(h.asks[0]!.system).toContain(rulesBlock([RULE]));
    const saved = log.find((q) => q.table === "meetings" && q.op === "update");
    expect(saved?.payload).toEqual({ ai_brief: "Borrador del modelo." });
    expect(out.mensaje).toBeUndefined();
  });

  it.each([
    ["error returned by Supabase", rulesError],
    ["exception", rulesThrow],
  ] as const)(
    "%s: confirming it in decidePending tells the person the rules were not read",
    async (_name, reply) => {
      const { db, log } = fakeDb(withTools(reply));
      const r = await decidePending(ctxWith(db), ACTION, "confirm");
      expect(r.status).toBe("confirmed");
      expect(r.result).toContain("No he podido leer las reglas del equipo");
      expect(r.result).toContain(RULES_READ_FAILED);
      expect(h.asks).toHaveLength(1);
      const msg = log.find((q) => q.table === "agent_messages" && q.op === "insert")?.payload as
        { content: string } | undefined;
      expect(msg?.content).toContain(RULES_READ_FAILED);
      expect(logs.join("\n")).not.toContain(RULE.texto);
    },
  );
});
