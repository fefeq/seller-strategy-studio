// @vitest-environment node
// SDD-20261121-agent-turn-metrics (NK-0191), U-3 and U-4: runAgent and the autopilot threshold rule leave one agent_turns
// row per turn (CA-6, CA-7, CA-9, CA-10, CA-13, CA-14, CA-15). Fake client and a simulated stream: no provider is
// called and nothing is written anywhere. Every name and figure here is fictional.
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolCtx } from "@/lib/agent/tools";

type StreamOpts = {
  system: string;
  tools: Record<string, { execute: (args: unknown) => Promise<unknown> }>;
  includeRawChunks?: boolean;
  onChunk?: (e: { chunk: { type: string; rawValue?: unknown } }) => unknown;
};
type Stream = { text: Promise<string>; steps?: Promise<unknown>; response?: Promise<unknown> };

const h = vi.hoisted(() => ({
  chain: ["openrouter"] as string[],
  streams: [] as ((o: never) => unknown)[],
  calls: [] as unknown[],
  after: [] as Promise<unknown>[],
  providerFetch: [] as ((url: string, init?: RequestInit) => Promise<unknown>)[],
}));

vi.mock("ai", () => ({
  streamText: (o: never) => {
    h.calls.push(o);
    const next = h.streams.shift();
    return next ? next(o) : { text: Promise.resolve("Respuesta del modelo.") };
  },
  tool: (t: unknown) => t,
  jsonSchema: () => ({}),
  stepCountIs: () => undefined,
}));
vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: (o: { fetch?: (url: string, init?: RequestInit) => Promise<unknown> }) => {
    if (o.fetch) h.providerFetch.push(o.fetch);
    return { chat: () => ({}), responses: () => ({}) };
  },
}));
vi.mock("@/lib/gemini", async (orig) => ({
  ...(await orig<typeof import("@/lib/gemini")>()),
  aiProviders: () => h.chain,
}));
vi.mock("@/lib/memory.server", () => ({
  memoryBlock: async () => "",
  learnFrom: async () => undefined,
  rememberDecision: async () => undefined,
}));
// Like the real afterResponse: the work starts at once, nobody waits for it and a failure is only logged.
vi.mock("@/lib/after-response.server", () => ({
  afterResponse: (label: string, work: () => Promise<unknown>) => {
    h.after.push(
      Promise.resolve()
        .then(work)
        .catch(() => console.error(`afterResponse ${label}`)),
    );
  },
}));
vi.mock("@tanstack/react-start", () => {
  const chain: object = new Proxy(() => chain, { get: () => () => chain, apply: () => chain });
  return { createServerFn: () => chain };
});
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));

import { runAgent } from "@/lib/agent/agent.server";
import * as agentFunctions from "@/lib/agent.functions";

const ORG = "00000000-0000-4000-8000-0000000000aa";
const ME = "00000000-0000-4000-8000-0000000000a1";
const CONV = "00000000-0000-4000-8000-0000000000c1";
const ACTION = "00000000-0000-4000-8000-0000000000d1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ASKED = "¿Qué propongo a Cliente Ficticio SL esta semana?";
const SECRET_ERROR = "el proveedor citó a Cliente Ficticio SL en su error";

type Q = { table: string; op: string; payload?: unknown; filters: unknown[][] };
type Reply =
  | { data?: unknown; error?: { message: string; code?: string } | null; throws?: boolean }
  | { hang: true }
  | undefined;
/** Records every query; `reply` answers per table and operation. */
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
            const r = reply(q) ?? defaults(q) ?? {};
            if ("hang" in r) return () => new Promise(() => undefined);
            if (r.throws)
              return (_ok: unknown, fail: (e: unknown) => unknown) =>
                Promise.reject(new Error(`fetch failed: ${SECRET_ERROR}`)).then(undefined, fail);
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
const defaults = (q: Q): Reply => {
  if (q.table === "knowledge_docs") return { data: [] };
  if (q.table === "agent_pending_actions" && q.op === "insert") return { data: { id: ACTION } };
  if (q.table === "agent_pending_actions") return { data: [] };
  if (q.table === "lead_settings") return { data: { autopilot_action_threshold: 0 } };
  return undefined;
};
const ctxWith = (db: ToolCtx["db"], roles = ["ae"]): ToolCtx => ({
  db,
  orgId: ORG,
  userId: ME,
  roles,
  currency: "EUR",
});
const turn = (
  db: ToolCtx["db"],
  over: Partial<Parameters<typeof runAgent>[1]> = {},
): ReturnType<typeof runAgent> =>
  runAgent(ctxWith(db), {
    conversationId: CONV,
    text: ASKED,
    channel: "app",
    mode: "chat",
    orgName: "Empresa Ficticia",
    ...over,
  });

type TurnRow = Record<string, unknown>;
const inserts = (log: Q[], table: string) =>
  log.filter((q) => q.table === table && q.op === "insert");
/** Waits for the work handed to afterResponse and returns the agent_turns rows written. */
async function turnRows(log: Q[]): Promise<TurnRow[]> {
  await Promise.all(h.after);
  return inserts(log, "agent_turns").map((q) => q.payload as TurnRow);
}
const providerError = (statusCode?: number) =>
  Object.assign(new Error(SECRET_ERROR), {
    ...(statusCode ? { statusCode } : {}),
    responseBody: `{"error":"${SECRET_ERROR}"}`,
  });
const failing = (statusCode?: number) => (): Stream => {
  const text = Promise.reject(providerError(statusCode));
  text.catch(() => undefined);
  return { text };
};
/** A stream whose model proposes one task (a write tool) and then writes `said`. */
const proposing =
  (said: string, then?: () => never) =>
  (o: StreamOpts): Stream => ({
    text: (async () => {
      await o.tools["create_task"]!.execute({ title: "Tarea ficticia" });
      then?.();
      return said;
    })(),
  });

let logs: string[] = [];
beforeEach(() => {
  h.chain = ["openrouter"];
  h.streams.length = 0;
  h.calls.length = 0;
  h.after.length = 0;
  h.providerFetch.length = 0;
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
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/** No request, answer or error text may reach the row or the logs. */
function expectNoText(rows: TurnRow[]) {
  const all = `${JSON.stringify(rows)}\n${logs.join("\n")}`;
  expect(all).not.toContain("Cliente Ficticio");
  expect(all).not.toContain("Respuesta del modelo");
  for (const row of rows)
    for (const [key, value] of Object.entries(row))
      if (typeof value === "string" && !UUID.test(value))
        expect(["channel", "mode", "provider", "model", "cost_kind", "outcome"], key).toContain(
          key,
        );
}

describe("runAgent leaves one row per turn", () => {
  it("CA-1/CA-15: a turn whose stream only has text leaves one row, with steps and tokens empty", async () => {
    const { db, log } = fakeDb();
    const out = await turn(db);
    expect(out.text).toBe("Respuesta del modelo.");
    const rows = await turnRows(log);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      id: expect.stringMatching(UUID),
      org_id: ORG,
      user_id: ME,
      conversation_id: CONV,
      channel: "app",
      mode: "chat",
      provider: "openrouter",
      model: null,
      attempts: 1,
      steps: null,
      duration_ms: expect.any(Number),
      input_tokens: null,
      output_tokens: null,
      cost_usd: null,
      cost_kind: "unknown",
      outcome: "answered",
      error_status: null,
      proposed_count: 0,
    });
    expectNoText(rows);
  });

  it("CA-2/CA-3: steps, tokens, model and the cost OpenRouter reports in its raw chunks reach the row", async () => {
    h.streams.push((o: StreamOpts): Stream => {
      expect(o.includeRawChunks).toBe(true);
      o.onChunk?.({ chunk: { type: "text-delta" } });
      o.onChunk?.({ chunk: { type: "raw", rawValue: { choices: [{ delta: {} }] } } });
      o.onChunk?.({ chunk: { type: "raw", rawValue: { usage: { is_byok: false, cost: 0.002 } } } });
      o.onChunk?.({ chunk: { type: "raw", rawValue: { usage: { is_byok: false, cost: 0.003 } } } });
      return {
        text: Promise.resolve("Respuesta del modelo."),
        steps: Promise.resolve([
          { usage: { inputTokens: 100, outputTokens: 10 } },
          { usage: { inputTokens: 200, outputTokens: 20 } },
        ]),
        response: Promise.resolve({ modelId: "vendor/model-x" }),
      };
    });
    const { db, log } = fakeDb();
    await turn(db);
    const [row] = await turnRows(log);
    expect(row).toMatchObject({
      provider: "openrouter",
      model: "vendor/model-x",
      steps: 2,
      input_tokens: 300,
      output_tokens: 30,
      cost_usd: expect.closeTo(0.005, 10),
      cost_kind: "measured",
    });
  });

  it("CA-3: a step whose chunk brought no cost leaves the whole turn unknown", async () => {
    h.streams.push((o: StreamOpts): Stream => {
      o.onChunk?.({ chunk: { type: "raw", rawValue: { usage: { is_byok: false, cost: 0.002 } } } });
      return {
        text: Promise.resolve("Respuesta del modelo."),
        steps: Promise.resolve([
          { usage: { inputTokens: 100, outputTokens: 10 } },
          { usage: { inputTokens: 200, outputTokens: 20 } },
        ]),
      };
    });
    const { db, log } = fakeDb();
    await turn(db);
    const [row] = await turnRows(log);
    expect(row).toMatchObject({
      steps: 2,
      input_tokens: 300,
      cost_usd: null,
      cost_kind: "unknown",
    });
  });

  it("CA-2: a provider that is not OpenRouter gives tokens if it reports them and never a cost", async () => {
    h.chain = ["gemini"];
    h.streams.push((o: StreamOpts): Stream => {
      expect(o.includeRawChunks).toBeFalsy();
      return {
        text: Promise.resolve("Respuesta del modelo."),
        steps: Promise.resolve([{ usage: { inputTokens: 900, outputTokens: 100 } }]),
      };
    });
    const { db, log } = fakeDb();
    await turn(db);
    const [row] = await turnRows(log);
    expect(row).toMatchObject({
      provider: "gemini",
      input_tokens: 900,
      output_tokens: 100,
      cost_usd: null,
      cost_kind: "unknown",
    });
  });

  it("CA-2: the OpenRouter request asks for the cost and keeps its routing", async () => {
    const sent: string[] = [];
    vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) => {
      sent.push(String(init?.body));
      return new Response("{}");
    });
    const { db } = fakeDb();
    await turn(db);
    expect(h.providerFetch).toHaveLength(1);
    await h.providerFetch[0]!("https://provider.invalid/chat", {
      method: "POST",
      body: JSON.stringify({ model: "x", messages: [] }),
    });
    const body = JSON.parse(sent[0]!) as Record<string, unknown>;
    expect(body["usage"]).toEqual({ include: true });
    expect(body["messages"]).toEqual([]);
  });

  it("CA-9: a chunk reader that blows up never breaks the turn: the cost is just unknown", async () => {
    h.streams.push((o: StreamOpts): Stream => {
      const hostile = { type: "raw" } as { type: string; rawValue?: unknown };
      Object.defineProperty(hostile, "rawValue", {
        get() {
          throw new Error(SECRET_ERROR);
        },
      });
      expect(() => o.onChunk?.({ chunk: hostile })).not.toThrow();
      return { text: Promise.resolve("Respuesta del modelo."), steps: Promise.resolve([{}]) };
    });
    const { db, log } = fakeDb();
    expect((await turn(db)).text).toBe("Respuesta del modelo.");
    const rows = await turnRows(log);
    expect(rows[0]).toMatchObject({ outcome: "answered", cost_usd: null, cost_kind: "unknown" });
    expectNoText(rows);
  });

  it("CA-4: when a provider fails and the next answers, the row names who answered and counts both", async () => {
    h.chain = ["openrouter", "gemini"];
    h.streams.push(failing(429));
    const { db, log } = fakeDb();
    const out = await turn(db);
    expect(out.text).toBe("Respuesta del modelo.");
    const rows = await turnRows(log);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      provider: "gemini",
      attempts: 2,
      outcome: "answered",
      error_status: null,
    });
    expectNoText(rows);
  });

  it("CA-5: a turn that proposes a change is `proposed`; one with no text and no proposal is `empty`", async () => {
    h.streams.push(proposing("He propuesto una tarea."));
    const a = fakeDb();
    await turn(a.db);
    expect((await turnRows(a.log))[0]).toMatchObject({ outcome: "proposed", proposed_count: 1 });

    h.after.length = 0;
    h.streams.push((): Stream => ({ text: Promise.resolve("   ") }));
    const b = fakeDb();
    const out = await turn(b.db);
    expect(out.text).toBe("No he podido generar respuesta.");
    expect((await turnRows(b.log))[0]).toMatchObject({ outcome: "empty", proposed_count: 0 });

    h.after.length = 0;
    h.streams.push(proposing(""));
    const c = fakeDb();
    expect((await turn(c.db)).text).toBe(
      "He preparado estas acciones. Confírmalas para ejecutarlas.",
    );
    expect((await turnRows(c.log))[0]).toMatchObject({ outcome: "proposed", proposed_count: 1 });
  });

  it("CA-5: a message that looks like a secret is `refused`, reaches no provider and is not stored", async () => {
    const { db, log } = fakeDb();
    const out = await turn(db, {
      text: "mi clave es sk-ant-api03-FICTICIAFICTICIAFICTICIAFICTICIA",
    });
    const { SECRET_REFUSAL } = await import("@/lib/agent/secret-guard");
    expect(out).toEqual({ text: SECRET_REFUSAL, pending: [] });
    expect(h.calls).toHaveLength(0);
    expect(inserts(log, "agent_messages")).toEqual([]);
    const rows = await turnRows(log);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      outcome: "refused",
      provider: "none",
      attempts: 0,
      steps: null,
      conversation_id: CONV,
    });
    expect(JSON.stringify(rows)).not.toContain("FICTICIA");
  });
});

describe("CA-6: a turn that fails anywhere leaves a `failed` row with no error text", () => {
  it("CA-6: no AI configured: provider `none`, no attempt, no status", async () => {
    h.chain = ["lovable"];
    vi.stubEnv("LOVABLE_API_KEY", "");
    const { db, log } = fakeDb();
    await expect(turn(db)).rejects.toThrow("La IA no está configurada");
    const rows = await turnRows(log);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      outcome: "failed",
      provider: "none",
      attempts: 0,
      steps: null,
      input_tokens: null,
      output_tokens: null,
      cost_usd: null,
      cost_kind: "unknown",
      error_status: null,
    });
    expectNoText(rows);
  });

  it("CA-6: the reads before the model fail: provider `none`", async () => {
    const { db, log } = fakeDb((q) =>
      q.table === "agent_messages" && q.op === "select" ? { throws: true } : undefined,
    );
    await expect(turn(db)).rejects.toThrow();
    const rows = await turnRows(log);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ outcome: "failed", provider: "none", attempts: 0 });
    expectNoText(rows);
  });

  it("CA-6: the provider fails: its name, the HTTP status and nothing of its message", async () => {
    h.streams.push(failing(429));
    const { db, log } = fakeDb();
    await expect(turn(db)).rejects.toThrow();
    const rows = await turnRows(log);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      outcome: "failed",
      provider: "openrouter",
      attempts: 1,
      error_status: 429,
      steps: null,
    });
    expectNoText(rows);
  });

  it("CA-6: an error with no HTTP status leaves the status empty, not zero", async () => {
    h.streams.push(failing());
    const { db, log } = fakeDb();
    await expect(turn(db)).rejects.toThrow();
    const rows = await turnRows(log);
    expect(rows[0]).toMatchObject({
      outcome: "failed",
      provider: "openrouter",
      error_status: null,
    });
    expectNoText(rows);
  });

  it("CA-6: every provider of the chain fails: the last one tried and both attempts", async () => {
    h.chain = ["openrouter", "gemini"];
    h.streams.push(failing(503), failing(500));
    const { db, log } = fakeDb();
    await expect(turn(db)).rejects.toThrow();
    const rows = await turnRows(log);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      outcome: "failed",
      provider: "gemini",
      attempts: 2,
      error_status: 500,
    });
  });

  it("CA-5/CA-6: failing after proposing is still `failed`, and keeps the count of what it proposed", async () => {
    h.streams.push(
      proposing("", () => {
        throw providerError(500);
      }),
    );
    const { db, log } = fakeDb();
    await expect(turn(db)).rejects.toThrow();
    const rows = await turnRows(log);
    expect(rows[0]).toMatchObject({ outcome: "failed", proposed_count: 1, error_status: 500 });
    expectNoText(rows);
  });

  it("CA-6: the final saves fail after the model answered: `failed` with the provider that answered", async () => {
    const { db, log } = fakeDb((q) =>
      q.table === "agent_messages" &&
      q.op === "insert" &&
      (q.payload as { role?: string }).role === "assistant"
        ? { throws: true }
        : undefined,
    );
    await expect(turn(db)).rejects.toThrow();
    const rows = await turnRows(log);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      outcome: "failed",
      provider: "openrouter",
      attempts: 1,
      error_status: null,
    });
    expectNoText(rows);
  });
});

describe("CA-7: the turn id travels with what the turn did", () => {
  it("CA-7: the proposed action and the tool call carry the id of the turn row", async () => {
    h.streams.push(proposing("He propuesto una tarea."));
    const { db, log } = fakeDb();
    const out = await turn(db);
    expect(out.pending).toEqual([
      {
        id: ACTION,
        tool: "create_task",
        summary: "Crear la tarea «Tarea ficticia»",
        status: "pending",
      },
    ]);
    const [row] = await turnRows(log);
    const turnId = row!["id"];
    expect(turnId).toMatch(UUID);
    const actions = inserts(log, "agent_pending_actions").map((q) => q.payload as TurnRow);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      tool: "create_task",
      conversation_id: CONV,
      turn_id: turnId,
    });
    const calls = inserts(log, "agent_tool_calls").flatMap((q) => q.payload as TurnRow[]);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ tool: "create_task", outcome: "pending", turn_id: turnId });
  });

  it("CA-7: proposing works while the turn row does not exist yet: the action is written first", async () => {
    h.streams.push(proposing("He propuesto una tarea."));
    const { db, log } = fakeDb();
    await turn(db);
    await turnRows(log);
    const at = (table: string) => log.findIndex((q) => q.table === table && q.op === "insert");
    expect(at("agent_pending_actions")).toBeGreaterThanOrEqual(0);
    expect(at("agent_pending_actions")).toBeLessThan(at("agent_turns"));
  });

  it("CA-7: two turns get two different ids", async () => {
    const { db, log } = fakeDb();
    await turn(db);
    await turn(db);
    const rows = await turnRows(log);
    expect(rows).toHaveLength(2);
    expect(rows[0]!["id"]).not.toBe(rows[1]!["id"]);
  });
});

describe("measuring changes nothing for the person", () => {
  it.each([
    ["error returned by Supabase", { error: { message: SECRET_ERROR, code: "42P01" } }],
    ["exception", { throws: true }],
  ] as const)(
    "CA-9: the row cannot be saved (%s): the answer arrives and the log has no text",
    async (_name, reply) => {
      const { db, log } = fakeDb((q) => (q.table === "agent_turns" ? reply : undefined));
      const out = await turn(db);
      expect(out.text).toBe("Respuesta del modelo.");
      await Promise.all(h.after);
      expect(inserts(log, "agent_turns")).toHaveLength(1);
      expect(logs.join("\n")).toContain("agent turn failed");
      expectNoText([]);
    },
  );

  it("CA-9: a failed turn whose row cannot be saved still throws its own error, not the save's", async () => {
    h.streams.push(failing(429));
    const { db } = fakeDb((q) => (q.table === "agent_turns" ? { throws: true } : undefined));
    await expect(turn(db)).rejects.toThrow(
      "OpenRouter tiene demasiadas peticiones; inténtalo en un momento.",
    );
    await Promise.all(h.after);
    expectNoText([]);
  });

  it("CA-10: runAgent returns without waiting for the row to be saved", async () => {
    const { db, log } = fakeDb((q) => (q.table === "agent_turns" ? { hang: true } : undefined));
    const out = await turn(db);
    expect(out.text).toBe("Respuesta del modelo.");
    // The insert has started (or will, on the next tick) and never finishes; the answer is already here.
    await new Promise((r) => setTimeout(r, 0));
    expect(inserts(log, "agent_turns")).toHaveLength(1);
  });

  it("CA-14: a Telegram turn leaves the same row as an app turn, with its channel", async () => {
    const stream = (): Stream => ({
      text: Promise.resolve("Respuesta del modelo."),
      steps: Promise.resolve([{ usage: { inputTokens: 50, outputTokens: 5 } }]),
      response: Promise.resolve({ modelId: "vendor/model-x" }),
    });
    h.streams.push(stream);
    const app = fakeDb();
    await turn(app.db, { channel: "app" });
    const [appRow] = await turnRows(app.log);
    h.after.length = 0;
    h.streams.push(stream);
    const tg = fakeDb();
    await turn(tg.db, { channel: "telegram" });
    const [tgRow] = await turnRows(tg.log);
    expect(tgRow!["channel"]).toBe("telegram");
    expect(appRow!["channel"]).toBe("app");
    const comparable = ({ id: _id, duration_ms: _ms, channel: _channel, ...rest }: TurnRow) => rest;
    expect(comparable(tgRow!)).toEqual(comparable(appRow!));
    expect(Object.keys(tgRow!).sort()).toEqual(Object.keys(appRow!).sort());
    expect(tgRow).toMatchObject({ org_id: ORG, user_id: ME, steps: 1, input_tokens: 50 });
  });

  it("CA-1: interview mode is recorded as such", async () => {
    const { db, log } = fakeDb();
    await turn(db, { mode: "interview" });
    expect((await turnRows(log))[0]).toMatchObject({ mode: "interview" });
  });
});

describe("CA-13: the autopilot threshold rule is a turn without a model", () => {
  type Rule = (
    ctx: ToolCtx,
    input: { conversationId: string; text: string; mode: "chat" | "interview" },
  ) => Promise<{ text: string; pending: unknown[] } | null>;
  const rule = () =>
    (agentFunctions as unknown as { autopilotChatTurn?: Rule }).autopilotChatTurn as Rule;
  const ask = (db: ToolCtx["db"], text: string, roles = ["owner"]) =>
    rule()(ctxWith(db, roles), { conversationId: CONV, text, mode: "chat" });

  it("CA-13: proposing a threshold leaves provider `none`, no tokens and cost 0 measured", async () => {
    expect(rule()).toBeTypeOf("function");
    const { db, log } = fakeDb();
    const out = await ask(db, "cambia el umbral a 5 EUR");
    // What the person reads does not change.
    expect(out?.text).toBe(
      "Umbral actual del piloto: 0 EUR por acción. Todo requiere confirmación.\n\nCambio propuesto, todavía no guardado. Confirma la acción para aplicarlo.",
    );
    expect(h.calls).toHaveLength(0);
    const rows = await turnRows(log);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      id: expect.stringMatching(UUID),
      org_id: ORG,
      user_id: ME,
      conversation_id: CONV,
      channel: "app",
      mode: "chat",
      provider: "none",
      model: null,
      attempts: 0,
      steps: null,
      duration_ms: expect.any(Number),
      input_tokens: null,
      output_tokens: null,
      cost_usd: 0,
      cost_kind: "measured",
      outcome: "proposed",
      error_status: null,
      proposed_count: 1,
    });
    const action = inserts(log, "agent_pending_actions")[0]!.payload as TurnRow;
    expect(action).toEqual({
      org_id: ORG,
      user_id: ME,
      conversation_id: CONV,
      tool: "set_autopilot_threshold",
      args: { threshold: 5, currency: "EUR" },
      summary: "Cambiar umbral del piloto a 5 EUR por acción",
      turn_id: rows[0]!["id"],
    });
    expect(inserts(log, "agent_messages")[0]!.payload).toEqual([
      { conversation_id: CONV, role: "user", content: "cambia el umbral a 5 EUR" },
      { conversation_id: CONV, role: "assistant", content: out!.text },
    ]);
  });

  it("CA-13: reading the threshold is `answered`, also cost 0 measured", async () => {
    const { db, log } = fakeDb();
    const out = await ask(db, "pendientes", ["ae"]);
    expect(out?.text).toBe(
      "Umbral actual del piloto: 0 EUR por acción. Todo requiere confirmación.\n\nNo tienes acciones pendientes.",
    );
    const rows = await turnRows(log);
    expect(rows[0]).toMatchObject({
      outcome: "answered",
      provider: "none",
      proposed_count: 0,
      cost_usd: 0,
      cost_kind: "measured",
      input_tokens: null,
      output_tokens: null,
    });
    expect(inserts(log, "agent_pending_actions")).toEqual([]);
  });

  it("CA-13/CA-6: a refusal of the rule is a `failed` turn and keeps its own message", async () => {
    const { db, log } = fakeDb();
    await expect(ask(db, "cambia el umbral a 5 EUR", ["ae"])).rejects.toThrow(
      "Solo Owner y Sales Leader pueden cambiar el umbral. Puedes consultarlo.",
    );
    const rows = await turnRows(log);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ outcome: "failed", provider: "none", proposed_count: 0 });
    await expect(ask(fakeDb().db, "cambia el umbral a 5 USD")).rejects.toThrow(
      "Indica el umbral en la moneda de tu empresa; no se convierten importes.",
    );
  });

  it("CA-13: any other message is not the rule's: no answer and no row", async () => {
    const { db, log } = fakeDb();
    expect(await ask(db, ASKED)).toBeNull();
    expect(await turnRows(log)).toEqual([]);
    expect(log).toEqual([]);
  });

  it("CA-13: sendAgentMessage answers through the exported rule, before the model", () => {
    const src = readFileSync("src/lib/agent.functions.ts", "utf8");
    const handler = src.slice(src.indexOf("export const sendAgentMessage"));
    const body = handler.slice(0, handler.indexOf("export const decideAgentAction"));
    expect(body).toMatch(/await autopilotChatTurn\(/);
    expect(body.indexOf("autopilotChatTurn(")).toBeLessThan(body.indexOf("runAgent("));
    expect(body).not.toContain("localAutopilotRequest");
  });
});
