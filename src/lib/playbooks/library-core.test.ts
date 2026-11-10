// @vitest-environment node
// SDD-20261109-rules-in-ai-readers (NK-0096), U-3 (CA-7, CA-8, CA-6 library). The playbook library reads the team's rules once
// per job with the common reader and puts rulesBlock after ADAPT_SYSTEM; contexto_empresa no longer carries
// reglas_obligatorias. A failed read is said in `mensaje`; a failed adaptation is logged with safeErrorLog, never the error.
// Fake client (the real companyContext and loadAgentRules run on it), fictional rules and company.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolCtx } from "@/lib/agent/tool-kit";
import {
  ESCALAR_NO_PERSON,
  ESCALAR_WITH_PERSON,
  RULES_READ_FAILED,
  rulesBlock,
} from "@/lib/knowledge-rules";
import { ADAPT_SYSTEM } from "@/lib/playbooks/adapt";
import { BASE_PLAYS } from "@/lib/playbooks/base";

const h = vi.hoisted(() => ({
  asks: [] as { system: string; user: string }[],
  askThrows: null as Error | null,
}));

vi.mock("@/lib/ai-gateway", async (orig) => ({
  ...(await orig<typeof import("@/lib/ai-gateway")>()),
  ask: async (system: string, user: string) => {
    h.asks.push({ system, user });
    if (h.askThrows) throw h.askThrows;
    // The base text kept as is is an acceptable "adaptation" once the markers are gone.
    const play = (JSON.parse(user) as { base: string }).base;
    return play.replace(/[«»]/g, "");
  },
}));

import { createLibraryCore } from "@/lib/playbooks/library-core";

const ORG = "org-1";
const OTHER = "org-2";
const ME = "11111111-1111-4111-8111-111111111111";
const MARK = "MARCA-REGLA-PB9";
const RULE = { titulo: "Precios", texto: `Nunca damos precio antes de la demo. ${MARK}` };
const OTHER_ORG_TEXT = "Regla de otra empresa ZETA-OTRA-ORG";
const PERSONAL_TEXT = "Nota personal ZETA-PERSONAL";

type Q = { table: string; op: string; select?: string; payload?: unknown; filters: unknown[][] };
type Reply = { data?: unknown; error?: { message: string } | null; throws?: boolean } | undefined;

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
                Promise.reject(new Error(`fetch failed ${MARK}`)).then(undefined, fail);
            return (ok: (v: unknown) => unknown) =>
              Promise.resolve({ data: r.data ?? null, error: r.error ?? null, count: null }).then(
                ok,
              );
          }
          return (...args: unknown[]) => {
            if (["insert", "update", "upsert", "delete"].includes(prop)) {
              q.op = prop;
              q.payload = args[0];
            } else if (prop === "select") {
              if (q.op === "select") q.select = String(args[0] ?? "*");
            } else q.filters.push([prop, ...args]);
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
const otherOrgRow = { ...ruleRow, org_id: OTHER, title: "Otra", body: OTHER_ORG_TEXT };
const personalRow = { ...ruleRow, title: "Mía", body: PERSONAL_TEXT, scope: "personal" };
const isRulesRead = (q: Q) =>
  q.table === "knowledge_docs" &&
  q.op === "select" &&
  q.filters.some((f) => f[0] === "or" && String(f[1]).includes("section.eq.rules"));

type Rules = "ok" | "error" | "throws";
function world(rules: Rules, withContext = true) {
  return (q: Q): Reply => {
    if (isRulesRead(q)) {
      if (rules === "error")
        return { error: { message: "permission denied for table knowledge_docs" } };
      if (rules === "throws") return { throws: true };
      return { data: [ruleRow, otherOrgRow, personalRow] };
    }
    if (q.table === "knowledge_docs" && q.op === "select")
      // «Existing» titles (none: every play is missing) and companyContext's 60 team docs (the rule is one of them).
      return { data: q.select === "title,section" ? [] : [ruleRow] };
    if (q.table === "positioning")
      return withContext
        ? { data: { one_liner: "Software ficticio para equipos ficticios." } }
        : undefined;
    if (
      q.op === "select" &&
      ["segments", "icp_profiles", "messaging_pillars", "quotas", "gtm_artifacts"].includes(q.table)
    )
      return { data: [] };
    return undefined;
  };
}
const ctxWith = (db: ToolCtx["db"]) => ({
  db,
  orgId: ORG,
  userId: ME,
  roles: ["owner"],
  currency: "EUR",
  orgName: "Empresa Ficticia",
});

let logs: string[] = [];
let errors: unknown[][] = [];
beforeEach(() => {
  h.asks.length = 0;
  h.askThrows = null;
  logs = [];
  errors = [];
  for (const m of ["error", "warn", "log", "info"] as const)
    vi.spyOn(console, m).mockImplementation((...a: unknown[]) => {
      if (m === "error") errors.push(a);
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

describe("playbook library with the team's rules (CA-7)", () => {
  it("each adaptation gets ADAPT_SYSTEM plus rulesBlock; contexto_empresa has no reglas_obligatorias; one read per job", async () => {
    const { db, log } = fakeDb(world("ok"));
    const r = await createLibraryCore(ctxWith(db));
    expect(r.created).toHaveLength(BASE_PLAYS.length);
    expect(h.asks).toHaveLength(BASE_PLAYS.length);
    for (const a of h.asks) {
      expect(a.system).toBe(`${ADAPT_SYSTEM}\n${rulesBlock([RULE])}`);
      expect(a.system).not.toContain(OTHER_ORG_TEXT);
      expect(a.system).not.toContain(PERSONAL_TEXT);
      const ctx = (JSON.parse(a.user) as { contexto_empresa: Record<string, unknown> })
        .contexto_empresa;
      expect(ctx).not.toHaveProperty("reglas_obligatorias");
      expect(ctx).toHaveProperty("setup");
      expect(a.user).not.toContain(MARK);
    }
    const reads = log.filter(isRulesRead);
    expect(reads).toHaveLength(1);
    expect(reads[0]!.filters).toContainEqual(["eq", "org_id", ORG]);
    expect(reads[0]!.filters).toContainEqual(["eq", "scope", "team"]);
    expect(r).not.toHaveProperty("mensaje");
    expect(logs.join("\n")).not.toContain(MARK);
  });

  it("without approved context: no AI call, no rules read and no warning", async () => {
    const { db, log } = fakeDb(world("error", false));
    const r = await createLibraryCore(ctxWith(db));
    expect(r.hasContext).toBe(false);
    expect(h.asks).toHaveLength(0);
    expect(log.filter(isRulesRead)).toHaveLength(0);
    expect(r).not.toHaveProperty("mensaje");
  });

  it.each([
    ["error returned by Supabase", "error"],
    ["exception", "throws"],
  ] as const)("%s: adapts without rules and says so in mensaje", async (_n, rules) => {
    const { db } = fakeDb(world(rules));
    const r = await createLibraryCore(ctxWith(db));
    expect(h.asks).toHaveLength(BASE_PLAYS.length);
    for (const a of h.asks) expect(a.system).toBe(ADAPT_SYSTEM);
    expect(r.created.every((x) => x.adapted)).toBe(true);
    expect((r as { mensaje?: string }).mensaje).toBe(RULES_READ_FAILED);
    expect(logs.join("\n")).not.toContain(MARK);
  });
});

describe("a failed adaptation is logged without the error (CA-8, CA-6)", () => {
  it("logs the play id and safeErrorLog; never the error object or its message", async () => {
    const err = new Error(`El proveedor devolvió el prompt: ${RULE.texto}`);
    h.askThrows = err;
    const { db, log } = fakeDb(world("ok"));
    const r = await createLibraryCore(ctxWith(db));
    expect(r.created.every((x) => !x.adapted)).toBe(true);
    // The base text goes in instead.
    const inserted = log.filter((q) => q.table === "knowledge_docs" && q.op === "insert");
    expect(inserted).toHaveLength(BASE_PLAYS.length);
    const fails = errors.filter((a) => a[0] === "playbook adaptation failed");
    expect(fails.map((a) => a[1])).toEqual(BASE_PLAYS.map((p) => p.id));
    for (const a of fails) {
      expect(a.some((x) => x === err)).toBe(false);
      expect(a[2]).toEqual({ name: "Error", messageLength: err.message.length });
    }
    expect(logs.join("\n")).not.toContain(MARK);
  });
});

// SDD-20261110-company-voice-and-escalation-rules (NK-0128) U-4 · CA-8: the library runs as a background job: nobody reads the
// adaptation as it is written, so an «Escalar» rule asks for the «Necesita a una persona» line instead of a stop.
describe("playbook library with an «Escalar» rule (NK-0128, CA-8)", () => {
  it("each adaptation gets the instruction for jobs without a person", async () => {
    const esc = {
      ...ruleRow,
      title: "Escalar ante una queja",
      body: "Pasa el caso a una persona.",
    };
    const base = world("ok");
    const { db } = fakeDb((q) => (isRulesRead(q) ? { data: [ruleRow, esc] } : base(q)));
    await createLibraryCore(ctxWith(db));
    expect(h.asks.length).toBeGreaterThan(0);
    for (const a of h.asks) {
      expect(a.system).toBe(
        `${ADAPT_SYSTEM}\n${rulesBlock([RULE, { titulo: esc.title, texto: esc.body, escalar: true }], { withPerson: false })}`,
      );
      expect(a.system).toContain(ESCALAR_NO_PERSON);
      expect(a.system).not.toContain(ESCALAR_WITH_PERSON);
    }
  });
});
