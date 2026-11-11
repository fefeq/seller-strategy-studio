// @vitest-environment node
// NK-0142 (same pattern as NK-0104/0118/0131): src/server.ts logged the whole error and the body of the swallowed
// h3 response; src/lib/error-capture.ts (loaded by server.ts) expands every Error argument of console.error into
// stack + message, so a witness in the error or in the body reached the log. The witness must not reach any console
// argument, the log keeps its label, and the response (CA-3) is the same. Fictional witness, no customer data.
import { inspect } from "node:util";
import { consumeLastCapturedError } from "@/lib/error-capture";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const WITNESS = "SECRET-SERVER-ERROR-123";
const h = vi.hoisted(() => ({
  handler: null as null | (() => Promise<Response>),
}));

vi.mock("@tanstack/react-start/server-entry", () => ({
  default: { fetch: () => (h.handler ? h.handler() : Promise.resolve(new Response("ok"))) },
}));
vi.mock("@/lib/after-response.server", async () => {
  const { AsyncLocalStorage } = await import("node:async_hooks");
  return { requestCtx: new AsyncLocalStorage() };
});

const logs: unknown[][] = [];
vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => void logs.push(a));
(["warn", "log", "info", "debug", "trace"] as const).map((m) =>
  vi.spyOn(console, m).mockImplementation((...a: unknown[]) => void logs.push(a)),
);

type Server = { fetch: (r: Request, env: unknown, ctx: unknown) => Promise<Response> };
let server: Server;
beforeAll(async () => {
  // Imported after the spies, so the wrapper that error-capture installs calls the spy like the real one calls the console.
  server = (await import("./server")).default as Server;
});
beforeEach(() => {
  logs.length = 0;
  h.handler = null;
  consumeLastCapturedError(); // nothing recorded by an earlier test
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

function expectSafeLog() {
  const out = serialized(logs.flat());
  expect(logs.length).toBeGreaterThan(0);
  expect(out).not.toContain(WITNESS);
}

const req = () => new Request("http://localhost/x");

describe("src/server.ts logs carry no whole error or body (NK-0142)", () => {
  it("the handler throws: the error text does not reach the log, the response is the error page", async () => {
    h.handler = async () => {
      throw new Error(`handler said ${WITNESS}`);
    };
    const res = await server.fetch(req(), {}, null);
    expect(res.status).toBe(500);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).not.toContain(WITNESS);
    expectSafeLog();
  });

  it("h3 swallows the error into a JSON 500: neither its body nor a captured error reaches the log", async () => {
    h.handler = async () => {
      // h3 logs the original error through console.error (error-capture records it) and answers with this body.
      console.error(new Error(`captured said ${WITNESS}`));
      logs.length = 0; // that call is the test's stand-in for h3, not the code under test
      return new Response(
        JSON.stringify({ unhandled: true, message: "HTTPError", note: WITNESS }),
        {
          status: 500,
          headers: { "content-type": "application/json" },
        },
      );
    };
    const res = await server.fetch(req(), {}, null);
    expect(res.status).toBe(500);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).not.toContain(WITNESS);
    expectSafeLog();
  });

  it("h3 swallows the error and nothing was captured: the body does not reach the log", async () => {
    h.handler = async () =>
      new Response(JSON.stringify({ unhandled: true, message: "HTTPError", note: WITNESS }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    const res = await server.fetch(req(), {}, null);
    expect(res.status).toBe(500);
    expect(res.headers.get("content-type")).toContain("text/html");
    expectSafeLog();
  });
});
