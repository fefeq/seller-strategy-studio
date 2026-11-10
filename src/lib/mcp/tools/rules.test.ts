// @vitest-environment node
// SDD-20261109-rules-in-ai-readers (NK-0096), U-5 (CA-9, CA-10, CA-11). External assistants read the active company's team
// rules with the MCP tool get_team_rules (read-only, own tool of the server, not of the agent registry), and the server's
// instructions tell them to. CA-10 is checked against the server's tool list in code, not the manifest: the manifest is
// regenerated when the sprint is integrated (brief NK-0096, contract). Fake client, fictional rules and company.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolContext } from "@lovable.dev/mcp-js";
import type { ToolCtx } from "@/lib/agent/tools";
import {
  ESCALAR_NO_PERSON,
  ESCALAR_WITH_PERSON,
  RULES_READ_FAILED,
  rulesBlock,
} from "@/lib/knowledge-rules";

const h = vi.hoisted(() => ({ ctx: null as unknown }));
vi.mock("@/lib/mcp/context", async (orig) => ({
  ...(await orig<typeof import("@/lib/mcp/context")>()),
  mcpCtx: async () => h.ctx,
}));

import mcp from "@/lib/mcp/index";
import { TOOLS } from "@/lib/agent/tools";
import { RULES_MCP_INSTRUCTION, teamRules, teamRulesText } from "@/lib/mcp/tools/rules";

const ORG = "org-1";
const OTHER = "org-2";
const MARK = "MARCA-REGLA-MCP5";
const RULE = { titulo: "Descuentos", texto: `Nunca ofrecemos descuentos sin dirección. ${MARK}` };
const OTHER_ORG_TEXT = "Regla de otra empresa ZETA-OTRA-ORG";
const PERSONAL_TEXT = "Nota personal ZETA-PERSONAL";

type Q = { table: string; filters: unknown[][] };
type Reply = { data?: unknown; error?: { message: string } | null; throws?: boolean };
function fakeDb(reply: Reply) {
  const log: Q[] = [];
  const from = (table: string) => {
    const q: Q = { table, filters: [] };
    const proxy: object = new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === "then") {
            log.push(q);
            if (reply.throws)
              return (_ok: unknown, fail: (e: unknown) => unknown) =>
                Promise.reject(new Error(`fetch failed ${MARK}`)).then(undefined, fail);
            return (ok: (v: unknown) => unknown) =>
              Promise.resolve({ data: reply.data ?? null, error: reply.error ?? null }).then(ok);
          }
          return (...args: unknown[]) => {
            if (prop !== "select") q.filters.push([prop, ...args]);
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
const rows = [
  ruleRow,
  { ...ruleRow, org_id: OTHER, title: "Otra", body: OTHER_ORG_TEXT },
  { ...ruleRow, title: "Mía", body: PERSONAL_TEXT, scope: "personal" },
];
const ctxWith = (db: ToolCtx["db"]) => ({
  db,
  orgId: ORG,
  userId: "11111111-1111-4111-8111-111111111111",
  roles: ["ae"],
  currency: "EUR",
  orgName: "Empresa Ficticia",
});

let logs: string[] = [];
beforeEach(() => {
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

describe("teamRulesText answers get_team_rules (CA-9)", () => {
  it("with rules: the rulesBlock of the active company's team rules, read with explicit filters", async () => {
    const { db, log } = fakeDb({ data: rows });
    const out = await teamRulesText(ctxWith(db));
    expect(out).toBe(rulesBlock([RULE]));
    expect(out).not.toContain(OTHER_ORG_TEXT);
    expect(out).not.toContain(PERSONAL_TEXT);
    expect(log[0]!.table).toBe("knowledge_docs");
    expect(log[0]!.filters).toContainEqual(["eq", "org_id", ORG]);
    expect(log[0]!.filters).toContainEqual(["eq", "scope", "team"]);
    expect(logs.join("\n")).not.toContain(MARK);
  });

  it("without rules: says there are none in the company", async () => {
    expect(await teamRulesText(ctxWith(fakeDb({ data: [] }).db))).toBe(
      "No hay reglas obligatorias de equipo en Empresa Ficticia.",
    );
  });

  it.each([
    [
      "error returned by Supabase",
      { error: { message: "permission denied for table knowledge_docs" } },
    ],
    ["exception", { throws: true }],
  ] as const)(
    "%s: answers RULES_READ_FAILED without throwing; the log has no rule",
    async (_n, reply) => {
      await expect(teamRulesText(ctxWith(fakeDb(reply).db))).resolves.toBe(RULES_READ_FAILED);
      expect(logs.join("\n")).not.toContain(MARK);
    },
  );

  it("the tool: title, description, read-only annotations and a text answer", async () => {
    expect(teamRules.name).toBe("get_team_rules");
    expect(teamRules.title).toBe("Reglas del equipo");
    expect(teamRules.description).toBe(
      "Reglas obligatorias que el equipo escribió en Conocimiento para la empresa activa. Léelas antes de redactar textos o proponer acciones y cúmplelas.",
    );
    expect(teamRules.annotations).toEqual({
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
    });
    h.ctx = ctxWith(fakeDb({ data: rows }).db);
    const res = await teamRules.handler({}, {} as ToolContext);
    expect(res).toEqual({ content: [{ type: "text", text: rulesBlock([RULE]) }] });
  });
});

describe("the MCP server lists it and tells assistants to call it (CA-10, CA-11)", () => {
  it("get_team_rules is one of the server's tools, read-only, and not an agent registry tool", () => {
    const tool = mcp.tools.find((t) => t.name === "get_team_rules");
    expect(tool?.annotations?.readOnlyHint).toBe(true);
    expect(TOOLS.map((t) => t.name)).not.toContain("get_team_rules");
    const names = mcp.tools.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("the instructions carry the sentence that names get_team_rules", () => {
    expect(RULES_MCP_INSTRUCTION).toBe(
      "Antes de redactar textos para la empresa o proponer acciones, llama a get_team_rules y cumple sus reglas_obligatorias.",
    );
    expect(mcp.instructions).toContain(RULES_MCP_INSTRUCTION);
  });
});

// SDD-20261110-company-voice-and-escalation-rules (NK-0128) U-4 · CA-8: an external assistant is handled by a person, so the
// «Escalar» rules come with the instruction to stop and ask for a person to decide.
describe("get_team_rules with an «Escalar» rule (NK-0128, CA-8)", () => {
  it("answers the block in the with-person mode", async () => {
    const esc = {
      ...ruleRow,
      title: "Escalar ante una queja",
      body: "Pasa el caso a una persona.",
    };
    const out = await teamRulesText(ctxWith(fakeDb({ data: [ruleRow, esc] }).db));
    expect(out).toBe(
      rulesBlock([RULE, { titulo: esc.title, texto: esc.body, escalar: true }], {
        withPerson: true,
      }),
    );
    expect(out).toContain(ESCALAR_WITH_PERSON);
    expect(out).not.toContain(ESCALAR_NO_PERSON);
  });
});
