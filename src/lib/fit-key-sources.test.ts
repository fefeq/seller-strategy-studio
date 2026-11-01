import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// NK-0012 · CA-3. A coarse net over sources, like setup-write-guard.test.ts: it checks that the entry points ask
// fit-key.ts what is missing and that no entry point words its own «falta el dominio». It proves no behaviour:
// fit-key.test.ts, autopilot.test.ts and planner.test.ts do. It does not import the modules, so it fails by assertion on a base without them.

const root = path.resolve(__dirname, "../..");
const read = (f: string) => readFileSync(path.join(root, f), "utf8");
/** Comments out of the way: a call named in a comment is not a call. */
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const ENTRY_POINTS = [
  "src/lib/apollo-gateway.ts",
  "src/lib/clay-gateway.ts",
  "src/lib/web-research-core.ts",
  "src/lib/orchestrator/runner.ts",
  "src/lib/autopilot.ts",
  "src/lib/apollo.ts",
  "src/lib/inngest/lead-tasks.server.ts",
];

describe("fit-key entry points", () => {
  it.each(ENTRY_POINTS)("%s asks fit-key (requireKey( or missingKey( is called)", (f) => {
    expect(code(read(f))).toMatch(/\b(requireKey|missingKey)\(/);
  });
  it("the three provider entry points use requireKey, which throws the typed error", () => {
    for (const f of [
      "src/lib/apollo-gateway.ts",
      "src/lib/clay-gateway.ts",
      "src/lib/web-research-core.ts",
    ])
      expect(code(read(f)), f).toMatch(/\brequireKey\(/);
  });
  it("only the two pure functions with their own tests keep the literal «no tiene dominio»", () => {
    const withLiteral = [...ENTRY_POINTS, "src/lib/clay.ts"].filter((f) =>
      /no tiene dominio/.test(read(f)),
    );
    expect(withLiteral.sort()).toEqual(["src/lib/apollo.ts", "src/lib/clay.ts"]);
    expect((read("src/lib/apollo.ts").match(/no tiene dominio/g) ?? []).length).toBe(1);
    expect((read("src/lib/clay.ts").match(/no tiene dominio/g) ?? []).length).toBe(1);
  });
  it("the domain-proposal data is read per company, paged, and skipped by the per-lead follow-up (CA-7)", () => {
    const org = code(read("src/lib/org-data.ts"));
    const fn = org.slice(
      org.indexOf("async function loadFitKeyData"),
      org.indexOf("const REOPENABLE"),
    );
    expect(fn).toMatch(/fetchAll/);
    for (const table of ["accounts", "people", "stakeholders", "leads"])
      expect(fn, table).toMatch(
        new RegExp(`from\\("${table}"\\)[^\\n]*\\.eq\\("org_id", orgId\\)`),
      );
    expect(code(read("src/lib/inngest/lead-tasks.server.ts"))).toMatch(
      /loadSnapshot\(db, orgId, now, \{ fitKey: false \}\)/,
    );
  });
  it("the account key message still says «dominio» for the loops that cut on /dominio/i", () => {
    expect(read("src/lib/orchestrator/runner.ts").match(/\/dominio\/i\.test\(/g)?.length).toBe(3);
  });
});
