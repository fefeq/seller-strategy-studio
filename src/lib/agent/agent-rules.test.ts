// @vitest-environment node
// SDD-20261106-agent-rules-reader (NK-0069), U-2: runAgent loads the team's rules and hands them to the model in every turn
// (app chat, app interview, Telegram), and says so when they could not be read (CA-1b, CA-4). Fake client, fictional rules.
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

import { runAgent } from "@/lib/agent/agent.server";

const ORG = "org-1";
const ME = "11111111-1111-4111-8111-111111111111";
const RULE = { titulo: "Descuentos", texto: "Nunca ofrecemos descuentos sin aprobación de dirección." };

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
              Promise.resolve({ data: r.data ?? null, error: r.error ?? null, count: null }).then(ok);
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
const ruleRow = { org_id: ORG, title: RULE.titulo, body: RULE.texto, section: "rules", scope: "team", mandatory: false };
const rulesOk = (q: Q): Reply => (q.table === "knowledge_docs" ? { data: [ruleRow] } : undefined);
const rulesError = (q: Q): Reply =>
  q.table === "knowledge_docs" ? { error: { message: "permission denied for table knowledge_docs" } } : undefined;
const rulesThrow = (q: Q): Reply => (q.table === "knowledge_docs" ? { throws: true } : undefined);
const ctxWith = (db: ToolCtx["db"]): ToolCtx => ({ db, orgId: ORG, userId: ME, roles: ["ae"], currency: "EUR" });

let logs: string[] = [];
beforeEach(() => {
  h.systems.length = 0;
  h.asks.length = 0;
  logs = [];
  for (const m of ["error", "warn", "log", "info"] as const)
    vi.spyOn(console, m).mockImplementation((...a: unknown[]) => {
      logs.push(a.map((x) => (x instanceof Error ? `${x.name} ${x.message}` : typeof x === "string" ? x : JSON.stringify(x))).join(" "));
    });
});

const turn = (db: ToolCtx["db"], channel: "app" | "telegram", mode: "chat" | "interview") =>
  runAgent(ctxWith(db), { conversationId: "conv-1", text: "¿Qué propongo a este cliente?", channel, mode, orgName: "Empresa Ficticia" });

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
  ] as const)("%s: the turn goes on without rules and says so; the log has no rule text", async (_name, reply) => {
    const { db, log } = fakeDb(reply);
    const out = await turn(db, "telegram", "chat");
    expect(h.systems).toHaveLength(1);
    expect(h.systems[0]).not.toContain("reglas_obligatorias");
    expect(out.text.startsWith(RULES_READ_FAILED)).toBe(true);
    expect(out.text).toContain("Respuesta del modelo.");
    const saved = log.filter((q) => q.table === "agent_messages" && q.op === "insert").map((q) => q.payload as { role: string; content: string });
    expect(saved.find((m) => m.role === "assistant")?.content.startsWith(RULES_READ_FAILED)).toBe(true);
    expect(logs.join("\n")).toContain("knowledge rules load failed");
    expect(logs.join("\n")).not.toContain(RULE.texto);
  });

  it("no notice when the rules were read", async () => {
    const out = await turn(fakeDb(rulesOk).db, "app", "chat");
    expect(out.text).not.toContain(RULES_READ_FAILED);
  });
});
