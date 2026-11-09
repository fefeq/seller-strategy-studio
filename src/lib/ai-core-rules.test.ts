// @vitest-environment node
// SDD-20261109-rules-in-ai-readers (NK-0096), U-1 and U-2. The five generations of ai-core.ts read the team's rules with the
// common reader (loadAgentRules, AGENT_RULE_LIMITS) and put rulesBlock in their system text, by any entry: with a scope (agent,
// Telegram, autopilot, background) and with scope = null (screens, org taken from the row read under RLS). A failed read is
// said before the saved and returned text (CA-3) and in the agent tools' `mensaje` (CA-4); logs never carry a rule (CA-6).
// Fake client, fictional rules, accounts and people.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolCtx } from "@/lib/agent/tools";
import { RULES_READ_FAILED, rulesBlock } from "@/lib/knowledge-rules";

const h = vi.hoisted(() => ({
  asks: [] as { system: string; user: string }[],
  askThrows: null as Error | null,
}));

vi.mock("@/lib/ai-gateway", async (orig) => ({
  ...(await orig<typeof import("@/lib/ai-gateway")>()),
  ask: async (system: string, user: string) => {
    h.asks.push({ system, user });
    if (h.askThrows) throw h.askThrows;
    return "Texto del modelo.";
  },
}));
// researchStakeholderCore searches the web first: no provider is called in tests.
vi.mock("@/lib/web-search", () => ({ searchBoth: async () => [] }));
vi.mock("@tanstack/react-start", () => {
  const chain: object = new Proxy(() => chain, { get: () => () => chain, apply: () => chain });
  return { createServerFn: () => chain };
});
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));

import {
  callTeardownCore,
  listeningCoachingCore,
  meetingBriefCore,
  proposalCore,
  researchStakeholderCore,
  type AiScope,
} from "@/lib/ai-core";
import { executeTool } from "@/lib/agent/tools";

const ORG = "org-1";
const OTHER = "org-2";
const ME = "11111111-1111-4111-8111-111111111111";
const ACCOUNT = "22222222-2222-4222-8222-222222222222";
const MEETING = "44444444-4444-4444-8444-444444444444";
const PERSON = "66666666-6666-4666-8666-666666666666";
const MARK = "MARCA-REGLA-Q7X";
const RULE = {
  titulo: "Descuentos",
  texto: `Nunca ofrecemos descuentos en la primera llamada. ${MARK}`,
};
const OTHER_ORG_TEXT = "Regla de otra empresa ZETA-OTRA-ORG";
const PERSONAL_TEXT = "Nota personal ZETA-PERSONAL";

type Q = {
  table: string;
  op: string;
  select?: string;
  payload?: unknown;
  filters: unknown[][];
};
type Reply = { data?: unknown; error?: { message: string } | null; throws?: boolean } | undefined;

/** Keeps only the selected columns, as PostgREST does, so a column the code does not select never reaches it. */
function project(data: unknown, cols: string | undefined): unknown {
  if (!cols || cols.trim() === "*" || data === null || typeof data !== "object") return data;
  const keys = cols.split(",").map((c) => c.trim());
  const one = (row: Record<string, unknown>) =>
    Object.fromEntries(keys.filter((k) => k in row).map((k) => [k, row[k]]));
  return Array.isArray(data) ? data.map(one) : one(data as Record<string, unknown>);
}

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
                Promise.reject(new Error(`fetch failed ${MARK}`)).then(undefined, fail);
            return (ok: (v: unknown) => unknown) =>
              Promise.resolve({
                data: q.op === "select" ? project(r.data ?? null, q.select) : (r.data ?? null),
                error: r.error ?? null,
                count: null,
              }).then(ok);
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
// What a privileged client could get back if a filter were missing: neither may reach the model.
const otherOrgRow = { ...ruleRow, org_id: OTHER, title: "Otra", body: OTHER_ORG_TEXT };
const personalRow = { ...ruleRow, title: "Mía", body: PERSONAL_TEXT, scope: "personal" };

type Rules = "ok" | "none" | "error" | "throws";
const isRulesRead = (q: Q) =>
  q.table === "knowledge_docs" &&
  q.filters.some((f) => f[0] === "or" && String(f[1]).includes("section.eq.rules"));

/** Fake company data. `org` = the org_id the rows carry (null = rows without org_id, e.g. not found). */
function world(rules: Rules, org: string | null = ORG) {
  const withOrg = <T extends object>(row: T) => (org ? { ...row, org_id: org } : row);
  return (q: Q): Reply => {
    if (isRulesRead(q)) {
      if (rules === "error")
        return { error: { message: "permission denied for table knowledge_docs" } };
      if (rules === "throws") return { throws: true };
      return { data: rules === "ok" ? [ruleRow, otherOrgRow, personalRow] : [] };
    }
    if (q.op !== "select") return undefined;
    if (q.table === "knowledge_docs") return { data: [] };
    if (q.table === "meetings")
      return {
        data: withOrg({
          id: MEETING,
          title: "Reunión ficticia",
          objective: "Validar el dolor",
          attendees: "Ana Prueba",
          agenda: null,
          desired_outcome: null,
          scheduled_at: "2026-11-10T10:00:00Z",
          questions: null,
          objections: null,
          ai_brief: null,
          notes: "Notas ficticias de la llamada.",
          next_steps: null,
          call_notes: null,
          listening_level: null,
          listening_reflection: null,
          account_id: ACCOUNT,
          deal_id: null,
        }),
      };
    if (q.table === "stakeholders")
      return {
        data: withOrg({
          id: PERSON,
          account_id: ACCOUNT,
          name: "Ana Prueba",
          title: "CEO",
          linkedin_url: null,
          buying_role: null,
          support: null,
          priorities: null,
          research: null,
        }),
      };
    if (q.table === "accounts")
      return org
        ? { data: { id: ACCOUNT, org_id: org, name: "Empresa Ficticia", domain: "ficticia.test" } }
        : undefined;
    return undefined;
  };
}

type Out = { text: string; rulesRead?: boolean };
type Core = {
  name: string;
  run: (db: ToolCtx["db"], scope: AiScope) => Promise<Out>;
  /** Where the text is saved (proposalCore saves nothing). */
  saved: { table: string; field: string } | null;
};
const CORES: Core[] = [
  {
    name: "meetingBriefCore",
    run: async (db, s) => {
      const r = await meetingBriefCore(db, MEETING, s);
      return { ...r, text: r.brief };
    },
    saved: { table: "meetings", field: "ai_brief" },
  },
  {
    name: "callTeardownCore",
    run: (db, s) => callTeardownCore(db, MEETING, s),
    saved: { table: "meetings", field: "call_review" },
  },
  { name: "proposalCore", run: (db, s) => proposalCore(db, ACCOUNT, s), saved: null },
  {
    name: "researchStakeholderCore",
    run: (db, s) => researchStakeholderCore(db, PERSON, s),
    saved: { table: "stakeholders", field: "research" },
  },
  {
    name: "listeningCoachingCore",
    run: (db, s) => listeningCoachingCore(db, MEETING, s),
    saved: { table: "meetings", field: "listening_coaching" },
  },
];
const SCOPE: AiScope = { orgId: ORG, userId: ME };
const MODES = [
  ["with scope (agent, Telegram, autopilot, background)", SCOPE],
  ["with scope = null (screens)", null],
] as const;

const savedText = (log: Q[], core: Core) => {
  if (!core.saved) return null;
  const u = log.find((q) => q.table === core.saved!.table && q.op === "update");
  return (u?.payload as Record<string, string> | undefined)?.[core.saved.field] ?? "(no guardado)";
};

let logs: string[] = [];
beforeEach(() => {
  h.asks.length = 0;
  h.askThrows = null;
  delete process.env["APIFY_API_KEY"];
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

describe.each(CORES)("$name with the team's rules (CA-1, CA-2)", (core) => {
  it.each(MODES)("%s: the system text is today's plus rulesBlock", async (_m, scope) => {
    const none = fakeDb(world("none"));
    await core.run(none.db, scope);
    const today = h.asks[0]!.system;
    expect(today).not.toContain("reglas_obligatorias");

    const { db, log } = fakeDb(world("ok"));
    const out = await core.run(db, scope);
    expect(h.asks).toHaveLength(2);
    expect(h.asks[1]!.system).toBe(`${today}\n${rulesBlock([RULE])}`);
    // Another company's rule and a personal note never reach the model, even if a client returned them.
    expect(h.asks[1]!.system).not.toContain(OTHER_ORG_TEXT);
    expect(h.asks[1]!.system).not.toContain(PERSONAL_TEXT);
    const read = log.find(isRulesRead)!;
    expect(read).toBeDefined();
    expect(read.filters).toContainEqual(["eq", "org_id", ORG]);
    expect(read.filters).toContainEqual(["eq", "scope", "team"]);
    expect(out.rulesRead).toBe(true);
    expect(out.text).toContain("Texto del modelo.");
    expect(out.text).not.toContain(RULES_READ_FAILED);
    if (core.saved) expect(savedText(log, core)).toBe(out.text);
    // The org_id read only to pick the rules never goes into the coaching prompt (the meeting fields are spread there).
    if (core.name === "listeningCoachingCore") expect(h.asks[1]!.user).not.toContain("org_id");
  });

  it("with a scope, reads the rules of scope.orgId, not of the row", async () => {
    const { db, log } = fakeDb(world("ok", OTHER));
    await core.run(db, SCOPE);
    expect(log.find(isRulesRead)!.filters).toContainEqual(["eq", "org_id", ORG]);
  });

  it("with scope = null, reads the rules of the org of the row read under RLS", async () => {
    const { db, log } = fakeDb(world("ok", OTHER));
    await core.run(db, null);
    expect(log.find(isRulesRead)!.filters).toContainEqual(["eq", "org_id", OTHER]);
  });
});

describe.each(CORES)("$name when the rules cannot be read (CA-3)", (core) => {
  it.each([
    ["error returned by Supabase", "error", SCOPE, ORG],
    ["exception", "throws", SCOPE, ORG],
    ["no org_id to read with", "ok", null, null],
  ] as const)(
    "%s: generates without rules and warns before the text",
    async (_n, rules, scope, org) => {
      // org null: rows without org_id (for proposalCore, the account is not found): no org to read the rules of,
      // which is a failure, never «no rules».
      const { db, log } = fakeDb(world(rules, org));
      const out = await core.run(db, scope);
      expect(h.asks).toHaveLength(1);
      expect(h.asks[0]!.system).not.toContain("reglas_obligatorias");
      expect(out.rulesRead).toBe(false);
      expect(out.text.startsWith(`${RULES_READ_FAILED}\n\n`)).toBe(true);
      expect(out.text).toContain("Texto del modelo.");
      if (core.saved) expect(savedText(log, core)).toBe(out.text);
      if (org === null) expect(log.find(isRulesRead)).toBeUndefined();
      expect(logs.join("\n")).not.toContain(MARK);
    },
  );
});

describe("researchStakeholderCore puts the warning before the web note (CA-3)", () => {
  it("warning, blank line, then the web note", async () => {
    const out = await researchStakeholderCore(fakeDb(world("error")).db, PERSON, SCOPE);
    expect(
      out.text.startsWith(`${RULES_READ_FAILED}\n\n_No he encontrado resultados en internet`),
    ).toBe(true);
  });
});

describe.each(CORES)("$name: no server log carries a rule (CA-6)", (core) => {
  it.each([
    ["rules read, AI answers", "ok"],
    ["rules read fails", "error"],
    ["rules read throws", "throws"],
  ] as const)("%s", async (_n, rules) => {
    await core.run(fakeDb(world(rules)).db, SCOPE);
    expect(logs.join("\n")).not.toContain(MARK);
  });

  it("the AI call fails with an error whose message carries the rule", async () => {
    h.askThrows = new Error(`Proveedor caído: ${RULE.texto}`);
    await expect(core.run(fakeDb(world("ok")).db, SCOPE)).rejects.toThrow();
    expect(logs.join("\n")).not.toContain(MARK);
  });
});

// ---------- U-2: the agent tools that wrap those cores (CA-4) ----------
const ctxWith = (db: ToolCtx["db"]): ToolCtx => ({
  db,
  orgId: ORG,
  userId: ME,
  roles: ["ae"],
  currency: "EUR",
});
type ToolOut = { ok?: boolean; mensaje?: string; borrador?: string };
const WRITE_TOOLS = [
  [
    "research_stakeholder",
    { stakeholder_id: PERSON },
    "Investigación de Ana Prueba guardada en su ficha.",
  ],
  [
    "review_call",
    { meeting_id: MEETING },
    "Revisión de «Reunión ficticia» guardada en la reunión.",
  ],
  [
    "listening_coaching",
    { meeting_id: MEETING },
    "Coaching de escucha de «Reunión ficticia» guardado en la reunión.",
  ],
] as const;

describe("agent tools say when the rules were not read (CA-4)", () => {
  it.each(WRITE_TOOLS)(
    "%s: same result as today when the rules were read",
    async (tool, args, today) => {
      const out = (await executeTool(ctxWith(fakeDb(world("ok")).db), tool, args)) as ToolOut;
      expect(out).toEqual({ ok: true, mensaje: today });
    },
  );

  it.each(WRITE_TOOLS)(
    "%s: mensaje carries the warning and today's text",
    async (tool, args, today) => {
      const out = (await executeTool(ctxWith(fakeDb(world("throws")).db), tool, args)) as ToolOut;
      expect(out.ok).toBe(true);
      expect(out.mensaje).toContain(RULES_READ_FAILED);
      expect(out.mensaje).toContain(today);
    },
  );

  it("draft_proposal: same result as today when the rules were read", async () => {
    const out = (await executeTool(ctxWith(fakeDb(world("ok")).db), "draft_proposal", {
      account_id: ACCOUNT,
    })) as ToolOut;
    expect(out).toEqual({ borrador: "Texto del modelo." });
  });

  it("draft_proposal: the draft starts with the warning once and mensaje is the warning", async () => {
    const out = (await executeTool(ctxWith(fakeDb(world("error")).db), "draft_proposal", {
      account_id: ACCOUNT,
    })) as ToolOut;
    expect(out.borrador).toBe(`${RULES_READ_FAILED}\n\nTexto del modelo.`);
    expect(out.mensaje).toBe(RULES_READ_FAILED);
  });
});
