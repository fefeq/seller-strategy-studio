// @vitest-environment node
// SDD-20261106-agent-rules-reader (NK-0087), CA-4/CA-5 and §10: draft_followup and prepare_meeting_brief send the team's
// rules through ask(). When the provider answers an HTTP error whose body quotes the rule, no console.* argument and no
// thrown error may carry it; the fall-back decision still reads the body. Real ask(), stubbed fetch, fictional rule.
import { inspect } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const RULE = "REGLA-FICTICIA-ASK-41b2 nunca damos precio por email";
const MARK = "REGLA-FICTICIA-ASK-41b2";
const h = vi.hoisted(() => ({ chain: ["openrouter"] as string[] }));

vi.mock("@/lib/gemini", async (orig) => ({
  ...(await orig<typeof import("@/lib/gemini")>()),
  aiProviders: () => h.chain,
}));

import { ask, ProviderError, providerErrorBody } from "@/lib/ai-gateway";

const sent: string[] = [];
/** The provider rejects and quotes the part of the request that carries the rule. */
function stub(status: number, extra = "") {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_u: unknown, init?: RequestInit) => {
      const req = typeof init?.body === "string" ? init.body : "";
      sent.push(req);
      const i = req.indexOf(MARK);
      const quote = i >= 0 ? req.slice(i, i + 80) : "";
      return new Response(
        JSON.stringify({ error: { message: `Content rejected: ${quote}${extra}`, code: status } }),
        { status, headers: { "content-type": "application/json" } },
      );
    }),
  );
}

const logs: unknown[][] = [];
beforeEach(() => {
  vi.restoreAllMocks();
  logs.length = 0;
  sent.length = 0;
  for (const m of ["error", "warn", "log", "info", "debug", "trace"] as const)
    vi.spyOn(console, m).mockImplementation((...a: unknown[]) => void logs.push(a));
  vi.stubEnv("LOVABLE_API_KEY", "test-not-a-key");
  vi.stubEnv("OPENROUTER_API_KEY", "test-not-a-key");
  vi.stubEnv("GEMINI_API_KEY", "test-not-a-key");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/** Every logged argument, serialized at full depth both ways. */
const serialized = (xs: unknown[]) =>
  xs
    .map((x) => {
      let json = "";
      try {
        json = JSON.stringify(x) ?? "";
      } catch {
        json = "";
      }
      return `${inspect(x, { depth: null, showHidden: true })}\n${json}`;
    })
    .join("\n");

describe("ask(): provider error quoting the rule (CA-5, §10)", () => {
  it.each([
    ["gemini", 400, "Gemini error"],
    ["openrouter", 400, "OpenRouter error"],
    ["lovable", 500, "AI gateway error"],
    ["lovable", 403, "AI gateway 403"],
  ] as const)(
    "%s HTTP %i: logged without the body, thrown without it",
    async (p, status, label) => {
      h.chain = [p];
      stub(status);
      const thrown = await ask(`Reglas:\n${RULE}`, "Escribe el seguimiento.").then(
        () => null,
        (e: unknown) => e,
      );
      expect(thrown).toBeInstanceOf(Error);
      expect(sent.some((b) => b.includes(MARK))).toBe(true); // the rule really went to the provider
      expect(logs.map((a) => a[0])).toContain(label);
      const out = serialized(logs.flat());
      expect(out).toContain(String(status));
      expect(out).not.toContain(MARK);
      expect(serialized([thrown])).not.toContain(MARK);
    },
  );

  it("the fall-back decision still reads the body (invalid key on 400 moves on)", async () => {
    h.chain = ["gemini", "openrouter"];
    stub(400, " API key not valid");
    await ask(`Reglas:\n${RULE}`, "x").catch(() => undefined);
    expect(sent).toHaveLength(2);
    expect(serialized(logs.flat())).not.toContain(MARK);
  });

  it("ProviderError keeps the body for the caller but never serializes it", () => {
    const e = new ProviderError("La IA rechazó la petición.", 400, RULE, "gemini");
    expect(providerErrorBody(e)).toBe(RULE);
    expect(e.status).toBe(400);
    expect(serialized([e, { e }])).not.toContain(MARK);
  });
});

describe("ProviderError has no property, getter or symbol that reaches the body (NK-0087)", () => {
  const make = () => new ProviderError("OpenRouter rechazó la petición.", 400, RULE, "openrouter");
  const wrappers: [string, () => unknown][] = [
    ["bare", make],
    ["as cause", () => new Error("wrapper", { cause: make() })],
    ["in AggregateError", () => new AggregateError([make()], "agg")],
    ["in object", () => ({ ctx: "x", err: make() })],
  ];
  it.each(wrappers)("%s: inspect with showHidden, getters and depth null", (_n, w) => {
    expect(inspect(w(), { showHidden: true, getters: true, depth: null })).not.toContain(MARK);
  });

  it("no own or inherited key or symbol yields the body", () => {
    const e = make();
    const keys: (string | symbol)[] = [];
    for (let o: object | null = e; o && o !== Error.prototype; o = Object.getPrototypeOf(o))
      keys.push(...Reflect.ownKeys(o));
    const values = keys.map((k) => {
      try {
        return String((e as unknown as Record<string | symbol, unknown>)[k]);
      } catch {
        return "";
      }
    });
    expect(values.join("\n")).not.toContain(MARK);
  });
});
