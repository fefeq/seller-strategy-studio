// @vitest-environment node
// NK-0104 + NK-0117: memory.server, jev.server and setup-extract.server logged the whole error, the provider's body or
// the model's output. A witness text that sits in the error message, the provider body or the model output must not
// reach any console.* argument. Fictional witness, no customer data.
import { inspect } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const WITNESS = "SECRET-PROMPT-123";
const h = vi.hoisted(() => ({ askImpl: null as null | (() => Promise<string>) }));

vi.mock("@/lib/ai-gateway", async (orig) => ({
  ...(await orig<typeof import("@/lib/ai-gateway")>()),
  ask: () => (h.askImpl ? h.askImpl() : Promise.reject(new Error("no ask impl"))),
}));
vi.mock("@/lib/gemini", async (orig) => ({
  ...(await orig<typeof import("@/lib/gemini")>()),
  aiProviders: () => ["lovable"],
}));

import { learnFrom, memoryBlock, rememberDecision } from "@/lib/memory.server";
import { askJev } from "@/lib/jev.server";
import { extractSetupCore } from "@/lib/setup-extract.server";
import type { ToolCtx } from "@/lib/agent/tool-kit";

const logs: unknown[][] = [];
beforeEach(() => {
  logs.length = 0;
  h.askImpl = null;
  for (const m of ["error", "warn", "log", "info", "debug", "trace"] as const)
    vi.spyOn(console, m).mockImplementation((...a: unknown[]) => void logs.push(a));
  vi.stubEnv("LOVABLE_API_KEY", "test-not-a-key");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

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

/** A db whose every call throws an error whose message quotes the witness. */
const failingCtx = (): ToolCtx =>
  ({
    orgId: "org-test",
    userId: "user-test",
    db: {
      from: () => {
        throw new Error(`db rejected: ${WITNESS}`);
      },
    },
  }) as unknown as ToolCtx;

describe("memory.server logs no error text (NK-0104 CA-1)", () => {
  it("memoryBlock", async () => {
    expect(await memoryBlock(failingCtx())).toBe("");
    expect(logs.length).toBeGreaterThan(0);
    expect(serialized(logs.flat())).not.toContain(WITNESS);
  });

  it("learnFrom", async () => {
    h.askImpl = () => Promise.reject(new Error(`model said: ${WITNESS}`));
    const ctx = {
      ...failingCtx(),
      db: {
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({ order: () => ({ limit: async () => ({ data: [] }) }) }),
            }),
          }),
        }),
      },
    } as unknown as ToolCtx;
    expect(
      await learnFrom(ctx, {
        source: "chat",
        text: "Texto ficticio suficientemente largo para que se intente aprender algo.",
      }),
    ).toEqual({ added: 0, replaced: 0 });
    expect(logs.length).toBeGreaterThan(0);
    expect(serialized(logs.flat())).not.toContain(WITNESS);
  });

  it("rememberDecision", async () => {
    await rememberDecision(failingCtx(), { title: "t" }, "approve");
    expect(logs.length).toBeGreaterThan(0);
    expect(serialized(logs.flat())).not.toContain(WITNESS);
  });
});

describe("jev.server logs status and length, not the provider body (NK-0104 CA-2)", () => {
  it("HTTP 500 quoting the witness", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(`{"error":"echo ${WITNESS}"}`, { status: 500 })),
    );
    await askJev({ model: "m", state: {}, questions: {} }).catch(() => undefined);
    const out = serialized(logs.flat());
    expect(logs.length).toBeGreaterThan(0);
    expect(out).toContain("500");
    expect(out).not.toContain(WITNESS);
  });
});

describe("setup-extract.server logs length and error name, not the model output (NK-0104 CA-3)", () => {
  it("invalid JSON output quoting the witness", async () => {
    h.askImpl = async () => `not json ${WITNESS}`;
    await expect(
      extractSetupCore({ orgName: "Acme", currency: "EUR" }, { url: "", site: "", text: "x" }),
    ).rejects.toThrow();
    expect(logs.length).toBeGreaterThan(0);
    expect(serialized(logs.flat())).not.toContain(WITNESS);
  });

  it("output that starts with the witness: a JSON.parse error message would quote it", async () => {
    h.askImpl = async () => `${WITNESS} not json`;
    // V8 quotes only about the first 10 characters of the text, so the witness prefix is what a leaked message carries.
    const prefix = WITNESS.slice(0, 8);
    // Precondition: the SyntaxError message really contains the prefix, so logging e.message would leak it.
    expect(() => JSON.parse(`${WITNESS} not json`)).toThrow(prefix);
    await expect(
      extractSetupCore({ orgName: "Acme", currency: "EUR" }, { url: "", site: "", text: "x" }),
    ).rejects.toThrow();
    expect(logs.length).toBeGreaterThan(0);
    expect(serialized(logs.flat())).not.toContain(prefix);
    expect(serialized(logs.flat())).not.toContain(WITNESS);
  });
});
