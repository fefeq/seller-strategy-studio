// @vitest-environment node
// NK-0142 (same pattern as NK-0131): the Apollo phone webhook logged error.message in two places. A witness in the
// database error must not reach any console.* argument; the log keeps its label; the answer (CA-3) is the same.
// Fictional witness, no customer data.
import { inspect } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const WITNESS = "SECRET-DB-ERROR-123";
const h = vi.hoisted(() => ({ failOn: "" as string, calls: [] as string[] }));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      const fail = table === h.failOn;
      for (const m of ["update", "eq"]) chain[m] = () => chain;
      chain["select"] = () =>
        Promise.resolve(
          fail
            ? { data: null, error: { message: `db said ${WITNESS}`, code: "23505" } }
            : { data: [{ org_id: "org-1", stakeholder_id: "st-1" }], error: null },
        );
      chain["then"] = (f: (v: unknown) => unknown) => {
        h.calls.push(table);
        return Promise.resolve(
          fail ? { error: { message: `db said ${WITNESS}`, code: "23505" } } : { error: null },
        ).then(f);
      };
      return chain;
    },
  },
}));

import { Route } from "./apollo/phone-webhook";

const logs: unknown[][] = [];
beforeEach(() => {
  logs.length = 0;
  h.calls.length = 0;
  vi.stubEnv("APOLLO_WEBHOOK_SECRET", "secret-x");
  for (const m of ["error", "warn", "log", "info", "debug", "trace"] as const)
    vi.spyOn(console, m).mockImplementation((...a: unknown[]) => void logs.push(a));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
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

type Handler = (a: { request: Request }) => Promise<Response>;
const post = (route: unknown): Handler =>
  (route as { options: { server: { handlers: { POST: Handler } } } }).options.server.handlers.POST;

const request = () =>
  new Request("http://localhost/api/public/apollo/phone-webhook?secret=secret-x", {
    method: "POST",
    body: JSON.stringify({
      people: [{ id: "p1", phone_numbers: [{ sanitized_number: "+34600000000", type: "mobile" }] }],
    }),
  });

function expectSafeLog(label: string) {
  const out = serialized(logs.flat());
  expect(logs.length).toBeGreaterThan(0);
  expect(out).toContain(label);
  expect(out).not.toContain(WITNESS);
}

describe("apollo phone webhook logs carry no error message (NK-0142)", () => {
  it("the phone_reveals update fails", async () => {
    h.failOn = "phone_reveals";
    const res = await post(Route)({ request: request() });
    expect(await res.json()).toEqual({ ok: true, people: 1, updated: 0 });
    expectSafeLog("Apollo webhook update failed");
  });

  it("the stakeholder update fails", async () => {
    h.failOn = "stakeholders";
    const res = await post(Route)({ request: request() });
    expect(await res.json()).toEqual({ ok: true, people: 1, updated: 1 });
    expectSafeLog("Apollo webhook stakeholder update failed");
  });
});
