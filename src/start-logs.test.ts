// @vitest-environment node
// NK-0142: the request middleware in src/start.ts logged the whole error. The witness in the thrown error must not
// reach any console argument; the log keeps its label; the response (CA-3) is the error page, and an error that carries
// a statusCode is still rethrown untouched. Fictional witness, no customer data.
import { inspect } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const WITNESS = "SECRET-START-ERROR-123";
const h = vi.hoisted(() => ({ middleware: null as null | { server: unknown } }));

vi.mock("@tanstack/react-start", () => ({
  createMiddleware: () => ({
    server: (fn: unknown) => {
      h.middleware = { server: fn };
      return h.middleware;
    },
  }),
  createCsrfMiddleware: () => ({}),
  createStart: (fn: unknown) => fn,
}));
vi.mock("@/integrations/supabase/auth-attacher", () => ({ attachSupabaseAuth: {} }));

const logs: unknown[][] = [];
beforeEach(() => {
  logs.length = 0;
  for (const m of ["error", "warn", "log", "info", "debug", "trace"] as const)
    vi.spyOn(console, m).mockImplementation((...a: unknown[]) => void logs.push(a));
});
afterEach(() => vi.restoreAllMocks());

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

type Run = (a: { next: () => Promise<unknown> }) => Promise<unknown>;
async function middleware(): Promise<Run> {
  await import("./start");
  return h.middleware!.server as Run;
}

describe("src/start.ts error middleware logs carry no whole error (NK-0142)", () => {
  it("a thrown error: the witness does not reach the log, the response is the error page", async () => {
    const run = await middleware();
    const res = (await run({
      next: async () => {
        throw new Error(`next said ${WITNESS}`);
      },
    })) as Response;
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain(WITNESS);
    expect(logs.length).toBeGreaterThan(0);
    expect(serialized(logs.flat())).not.toContain(WITNESS);
  });

  it("an error with a statusCode is rethrown as it was and nothing is logged", async () => {
    const run = await middleware();
    const err = Object.assign(new Error(WITNESS), { statusCode: 401 });
    await expect(
      run({
        next: async () => {
          throw err;
        },
      }),
    ).rejects.toBe(err);
    expect(logs).toEqual([]);
  });
});
