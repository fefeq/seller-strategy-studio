// @vitest-environment node
// SDD-20261106-agent-rules-reader (NK-0069), U-1: the one reader of the team's Conocimiento rules.
// CA-1a (rulesBlock), CA-2 (explicit org/scope/rule filters, also in memory), CA-3 (agent limits, BMAD unchanged),
// CA-6 (how many rules the agent reads) and CA-7 (no dependency on src/lib/bmad/). Fictional rules only.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as bmadSources from "@/lib/bmad/sources";
import {
  AGENT_RULE_LIMITS,
  COMPANY_LIMIT,
  MANDATORY_LIMIT,
  MANDATORY_RULE,
  RULES_READ_FAILED,
  RULES_TRUNCATED_NOTICE,
  isMandatory,
  knowledgeForAgents,
  loadAgentRules,
  pickRules,
  rulesBlock,
  rulesCoverage,
  rulesNotice,
} from "@/lib/knowledge-rules";

const CONFIRM =
  "Las reglas no cambian que tus escrituras sean propuestas que una persona confirma.";
const ORG = "org-1";

type Call = { table: string; calls: unknown[][] };
type Row = {
  org_id: string | null;
  title: string;
  body: string;
  section: string;
  scope: string;
  mandatory: boolean;
};
/** A fake client that records every call of the query and answers with `rows`, or fails the way Supabase does. */
function fakeDb(answer: { rows?: Row[]; error?: { message: string }; throws?: boolean }) {
  const log: Call[] = [];
  const from = (table: string) => {
    const q: Call = { table, calls: [] };
    log.push(q);
    const proxy: object = new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === "then") {
            if (answer.throws)
              return (_ok: unknown, fail: (e: unknown) => unknown) =>
                Promise.reject(new Error("network down")).then(undefined, fail);
            return (ok: (v: unknown) => unknown) =>
              Promise.resolve({
                data: answer.error ? null : (answer.rows ?? []),
                error: answer.error ?? null,
              }).then(ok);
          }
          return (...args: unknown[]) => {
            q.calls.push([prop, ...args]);
            return proxy;
          };
        },
      },
    );
    return proxy;
  };
  return { db: { from } as unknown as Parameters<typeof loadAgentRules>[0]["db"], log };
}
const rule = (n: number, over: Partial<Row> = {}): Row => ({
  org_id: ORG,
  title: `Regla ${n}`,
  body: `Texto de la regla ficticia ${n}.`,
  section: "rules",
  scope: "team",
  mandatory: false,
  ...over,
});

describe("rulesBlock (CA-1a)", () => {
  it("is a data block reglas_obligatorias, apart from the system «Reglas:», with MANDATORY_RULE and the confirmation sentence", () => {
    const block = rulesBlock([
      { titulo: "Descuentos", texto: "Nunca ofrecemos descuentos sin aprobación." },
    ]);
    expect(block).toContain("reglas_obligatorias");
    expect(block).toContain("Nunca ofrecemos descuentos sin aprobación.");
    expect(block).toContain(MANDATORY_RULE);
    expect(block).toContain(CONFIRM);
    expect(block).not.toMatch(/^\s*Reglas:/m);
  });

  it("is empty without rules", () => {
    expect(rulesBlock([])).toBe("");
  });
});

describe("loadAgentRules filters explicitly (CA-2)", () => {
  it("asks for this company's team rules (section rules or marked mandatory), newest first, without a row window", async () => {
    const { db, log } = fakeDb({ rows: [rule(1)] });
    const r = await loadAgentRules({ db, orgId: ORG });
    expect(r).toEqual({
      ok: true,
      rules: [{ titulo: "Regla 1", texto: "Texto de la regla ficticia 1." }],
    });
    expect(log).toHaveLength(1);
    const q = log[0]!;
    expect(q.table).toBe("knowledge_docs");
    expect(q.calls).toContainEqual(["eq", "org_id", ORG]);
    expect(q.calls).toContainEqual(["eq", "scope", "team"]);
    expect(q.calls).toContainEqual(["or", "section.eq.rules,mandatory.eq.true"]);
    expect(q.calls).toContainEqual(["order", "updated_at", { ascending: false }]);
    // No .limit(): empty rules or other sections must never take the place of a real rule (BMAD reads a 60-doc window).
    expect(q.calls.some((c) => c[0] === "limit" || c[0] === "range")).toBe(false);
  });

  it("drops rows of another company, personal docs and non-rules even if the client returns them (privileged client)", async () => {
    const { db } = fakeDb({
      rows: [
        rule(1, { org_id: "org-2", title: "Ajena" }),
        rule(2, { scope: "personal", title: "Personal" }),
        rule(3, { section: "company", title: "No es regla" }),
        rule(4, { org_id: null, title: "Sin empresa" }),
        rule(5, { section: "company", mandatory: true, title: "Marcada" }),
        rule(6, { title: "Propia" }),
      ],
    });
    const r = await loadAgentRules({ db, orgId: ORG });
    expect(r.ok && r.rules.map((x) => x.titulo)).toEqual(["Marcada", "Propia"]);
  });

  it("reports a failure (error returned or thrown) instead of an empty list", async () => {
    expect(
      await loadAgentRules({ db: fakeDb({ error: { message: "boom" } }).db, orgId: ORG }),
    ).toEqual({ ok: false, rules: [] });
    expect(await loadAgentRules({ db: fakeDb({ throws: true }).db, orgId: ORG })).toEqual({
      ok: false,
      rules: [],
    });
    expect(RULES_READ_FAILED).toBe(
      "No he podido leer las reglas del equipo. Respondo sin ellas; vuelve a intentarlo en un momento.",
    );
  });
});

describe("same order as the Conocimiento screen (CA-6, tie on updated_at)", () => {
  type Dated = Row & { id: string; updated_at: string };
  /** A fake that sorts like PostgREST by the .order() calls it receives (ascending unless told otherwise). */
  function sortingDb(rows: Dated[]) {
    const from = () => {
      const orders: [keyof Dated, boolean][] = [];
      const proxy: object = new Proxy(
        {},
        {
          get(_t, prop: string) {
            if (prop === "then") {
              const sorted = rows.slice().sort((a, b) => {
                for (const [col, asc] of orders) {
                  const c = String(a[col]).localeCompare(String(b[col]));
                  if (c) return asc ? c : -c;
                }
                return 0;
              });
              return (ok: (v: unknown) => unknown) =>
                Promise.resolve({ data: sorted, error: null }).then(ok);
            }
            return (...args: unknown[]) => {
              if (prop === "order")
                orders.push([
                  args[0] as keyof Dated,
                  (args[1] as { ascending?: boolean } | undefined)?.ascending ?? true,
                ]);
              return proxy;
            };
          },
        },
      );
      return proxy;
    };
    return { from } as unknown as Parameters<typeof loadAgentRules>[0]["db"];
  }

  it("breaks a tie on updated_at by id, as the screen does, so both pick the same rule", async () => {
    const at = "2026-11-01T00:00:00Z";
    // The client returns them in the opposite order of the screen's id tiebreak.
    const rows: Dated[] = [
      {
        ...rule(2, { title: "Regla B" }),
        id: "bbbbbbbb-0000-4000-8000-000000000002",
        updated_at: at,
      },
      {
        ...rule(1, { title: "Regla A" }),
        id: "aaaaaaaa-0000-4000-8000-000000000001",
        updated_at: at,
      },
    ];
    const limits = { maxRules: 1, maxChars: 12_000 };
    const r = await loadAgentRules({ db: sortingDb(rows), orgId: ORG }, limits);
    // The screen reads .order("updated_at", desc).order("id") (hub-screen.tsx) and counts with pickRules.
    const screen = rows
      .slice()
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at) || a.id.localeCompare(b.id));
    expect(r.ok && r.rules.map((x) => x.titulo)).toEqual(
      pickRules(screen, limits).rules.map((x) => x.titulo),
    );
    expect(r.ok && r.rules[0]?.titulo).toBe("Regla A");
  });
});

describe("agent limits (CA-3)", () => {
  it("are the ones Fede decided: 12 rules and 12 000 characters in total", () => {
    expect(AGENT_RULE_LIMITS).toEqual({ maxRules: 12, maxChars: 12_000 });
  });

  it("reads the 12 most recent non-empty rules among all of them", () => {
    const docs = [rule(0, { body: "   " }), ...Array.from({ length: 15 }, (_, i) => rule(i + 1))];
    const p = pickRules(docs, AGENT_RULE_LIMITS);
    expect(p.rules.map((r) => r.titulo)).toEqual(
      Array.from({ length: 12 }, (_, i) => `Regla ${i + 1}`),
    );
    expect(p.total).toBe(15);
    expect(p.read).toBe(12);
  });

  it("never passes maxChars in total (title + text): the rule that does not fit enters cut and the rest stay out", () => {
    const docs = [
      rule(1, { body: "a".repeat(7000) }),
      rule(2, { body: "b".repeat(7000) }),
      rule(3),
    ];
    const p = pickRules(docs, AGENT_RULE_LIMITS);
    const used = p.rules.reduce((s, r) => s + r.titulo.length + r.texto.length, 0);
    expect(used).toBeLessThanOrEqual(12_000);
    expect(p.rules).toHaveLength(2);
    expect(p.rules[0]!.texto).toHaveLength(7000);
    expect(p.rules[1]!.texto.length).toBeLessThan(7000);
    expect(p.read).toBe(1);
    expect(p.total).toBe(3);
  });

  it("leaves BMAD as it was: 12 rules cut at 4000 characters each, no total limit", () => {
    const docs = Array.from({ length: 14 }, (_, i) => ({
      ...rule(i + 1, { body: "x".repeat(5000) }),
    }));
    const k = knowledgeForAgents(docs);
    expect(MANDATORY_LIMIT).toBe(12);
    expect(COMPANY_LIMIT).toBe(5);
    expect(k.reglas_obligatorias).toHaveLength(12);
    expect(k.reglas_obligatorias.every((r) => r.texto.length === 4000)).toBe(true);
  });
});

describe("how many rules the agent reads (CA-6)", () => {
  it("counts N = team rules with text, L = rules that enter complete", () => {
    const docs = [
      rule(1),
      rule(2, { body: "  " }),
      rule(3, { scope: "personal" }),
      rule(4, { section: "company" }),
      rule(5, { section: "company", mandatory: true }),
    ];
    expect(rulesCoverage(docs, AGENT_RULE_LIMITS)).toEqual({ read: 2, total: 2 });
    expect(rulesNotice(rulesCoverage(docs, AGENT_RULE_LIMITS), false)).toBeNull();
  });

  it("warns when not every rule enters complete (more than 12, or one cut by the character limit)", () => {
    const many = Array.from({ length: 14 }, (_, i) => rule(i + 1));
    expect(rulesNotice(rulesCoverage(many, AGENT_RULE_LIMITS), false)).toBe(
      "El agente lee 12 de 14 reglas completas (las más recientes). Junta o acorta las que puedas.",
    );
    const cut = [rule(1), rule(2, { body: "z".repeat(13_000) })];
    expect(rulesCoverage(cut, AGENT_RULE_LIMITS)).toEqual({ read: 1, total: 2 });
    expect(rulesNotice(rulesCoverage(cut, AGENT_RULE_LIMITS), false)).toBe(
      "El agente lee 1 de 2 reglas completas (las más recientes). Junta o acorta las que puedas.",
    );
  });

  it("does not give L of N when the list was not fully loaded", () => {
    const many = Array.from({ length: 14 }, (_, i) => rule(i + 1));
    expect(rulesNotice(rulesCoverage(many, AGENT_RULE_LIMITS), true)).toBe(RULES_TRUNCATED_NOTICE);
    expect(RULES_TRUNCATED_NOTICE).toBe("Puede haber más reglas de las que se han cargado.");
  });
});

describe("independent of Ciclo GTM (CA-7)", () => {
  const source = readFileSync(
    fileURLToPath(new URL("./knowledge-rules.ts", import.meta.url)),
    "utf8",
  );
  // Static imports and re-exports, dynamic import() and require(), as in gtm-lab/core/boundaries.test.ts.
  const importsOf = (text: string) =>
    [
      /^\s*(?:import|export)\b[^"';]*?from\s*["']([^"']+)["']/gm,
      /^\s*import\s*["']([^"']+)["']/gm,
      /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
      /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
    ].flatMap((re) => [...text.matchAll(re)].map((m) => m[1] ?? ""));

  it("knowledge-rules.ts imports nothing from src/lib/bmad/", () => {
    expect(importsOf(source).filter((s) => /(^|\/)bmad(\/|$)/.test(s))).toEqual([]);
  });

  it("the check catches every kind of import (positive control)", () => {
    const sample = [
      'import { x } from "@/lib/bmad/sources";',
      'export * from "./bmad/sources";',
      'const m = await import("@/lib/bmad/drafting");',
      'const r = require("../bmad/sources");',
    ].join("\n");
    expect(importsOf(sample).filter((s) => /(^|\/)bmad(\/|$)/.test(s))).toHaveLength(4);
  });

  it("bmad/sources.ts re-exports the same reader", () => {
    expect(bmadSources.knowledgeForAgents).toBe(knowledgeForAgents);
    expect(bmadSources.isMandatory).toBe(isMandatory);
    expect(bmadSources.MANDATORY_RULE).toBe(MANDATORY_RULE);
    expect(bmadSources.MANDATORY_LIMIT).toBe(MANDATORY_LIMIT);
    expect(bmadSources.COMPANY_LIMIT).toBe(COMPANY_LIMIT);
  });
});
