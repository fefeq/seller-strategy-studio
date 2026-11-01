import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// NK-0008 · CA-2. A coarse net, per file and not per path: a screen that writes something «Configura tu estrategia» counts must also
// refresh the guide. It reads sources (same pattern as field-coverage.test.ts) and never imports the helper, so it fails by assertion on a base without it.

const root = path.resolve(__dirname, "../..");
const SCOPE = ["src/components", "src/routes", "src/hooks"];

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

/** Comments out of the way: a call named in a comment is not a call. */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const ALL_TABLES = "accounts|deals|quotas|icp_profiles|segments|positioning|messaging_pillars";
const UPDATE_TABLES = "quotas|icp_profiles|segments|positioning|messaging_pillars"; // an update of accounts or deals does not change the guide: it only counts rows
const SERVER_WRITERS = ["decideDiscovery", "decideSuggestion", "applySetupItems", "decideAgentAction", "undoImport"];

const writesRe = new RegExp(
  `\\.from\\(\\s*["'\`](?:${ALL_TABLES})["'\`]\\s*\\)\\s*\\.(?:insert|upsert|delete)\\(|\\.from\\(\\s*["'\`](?:${UPDATE_TABLES})["'\`]\\s*\\)\\s*\\.update\\(`,
);
const serverRe = new RegExp(`\\b(?:${SERVER_WRITERS.join("|")})\\s*[,)(]|\\buseServerFn\\(\\s*(?:${SERVER_WRITERS.join("|")})\\b`);
/** The CALL counts, not the import. */
const refreshesRe = /\binvalidateSetup\(|invalidateQueries\(\s*\{\s*queryKey:\s*\["setup"\]\s*,?\s*\}\s*\)|invalidateQueries\(\s*\)/;

export const isWriter = (src: string) => writesRe.test(code(src)) || serverRe.test(code(src));
export const refreshes = (src: string) => refreshesRe.test(code(src));

/** Exceptions, each with its reason (SDD §7 CA-2). */
const EXCEPTIONS: Record<string, string> = {
  "src/components/won-deals-panel.tsx": "inserts deals: covered by realtime, «setup» is in KEYS of use-live-pipeline.ts",
  "src/components/account/calls-deals-tabs.tsx": "inserts deals: covered by realtime, «setup» is in KEYS of use-live-pipeline.ts",
};

const sources = () =>
  SCOPE.flatMap((d) => walk(path.join(root, d)))
    .map((f) => path.relative(root, f))
    .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) && !f.includes(`routes${path.sep}api${path.sep}`));
const read = (f: string) => readFileSync(path.join(root, f), "utf8");

describe("the guide refreshes where setup data is written (CA-2)", () => {
  it("the detector knows a writer, a call and a mere import", () => {
    const w = `await supabase\n  .from("accounts")\n  .insert(rows);`;
    expect(isWriter(w)).toBe(true);
    expect(isWriter(`supabase.from("accounts").update({ a: 1 })`)).toBe(false);
    expect(isWriter(`supabase.from("segments").update({ a: 1 })`)).toBe(true);
    expect(isWriter(`const decide = useServerFn(decideDiscovery);`)).toBe(true);
    expect(refreshes(`import { invalidateSetup } from "@/hooks/setup-invalidation";`)).toBe(false);
    expect(refreshes(`// invalidateSetup(qc)`)).toBe(false);
    expect(refreshes(`invalidateSetup(qc);`)).toBe(true);
    expect(refreshes(`qc.invalidateQueries({ queryKey: ["setup"] });`)).toBe(true);
    expect(refreshes(`qc.invalidateQueries({\n  queryKey: ["setup"],\n});`)).toBe(true);
    expect(refreshes(`qc.invalidateQueries();`)).toBe(true);
    expect(refreshes(`qc.invalidateQueries({ queryKey: ["accounts"] });`)).toBe(false);
  });

  it("every file that writes a table of the guide, or calls a server writer, refreshes it", () => {
    const bad = sources()
      .filter((f) => !(f in EXCEPTIONS))
      .filter((f) => { const s = read(f); return isWriter(s) && !refreshes(s); });
    expect(bad).toEqual([]);
  });

  it("the exceptions are real writers (none is stale)", () => {
    for (const f of Object.keys(EXCEPTIONS)) expect(isWriter(read(f)), f).toBe(true);
  });

  // The net is per file: icp-editor.tsx already refreshed «setup» when saving, yet its delete did not. These anchors tie each site of CA-1 to its own call.
  const ANCHORS: { site: string; file: string; re: RegExp }[] = [
    { site: "Métricas: la cuota sale por saveQuota", file: "src/routes/_authenticated/metrics.tsx", re: /\bsaveQuota\(/ },
    { site: "Cuentas: la cuenta individual sale por createAccount", file: "src/routes/_authenticated/accounts.index.tsx", re: /\bcreateAccount\(/ },
    { site: "Apollo", file: "src/components/apollo.tsx", re: /\.from\("accounts"\)\s*\.insert\([\s\S]{0,900}invalidateSetup\(/ },
    { site: "Clay", file: "src/components/clay.tsx", re: /\.from\("accounts"\)\s*\.insert\([\s\S]{0,900}invalidateSetup\(/ },
    { site: "Parallel: importar empresas encontradas", file: "src/components/parallel.tsx", re: /\.from\("accounts"\)\.insert\(rows\)[\s\S]{0,500}invalidateSetup\(/ },
    { site: "Empresas del ICP", file: "src/components/orchestrator/icp-companies.tsx", re: /\.from\("accounts"\)\s*\.insert\([\s\S]{0,900}invalidateSetup\(/ },
    { site: "Descubrimientos: aceptar", file: "src/routes/_authenticated/discoveries.tsx", re: /await decide\(\{[\s\S]{0,400}invalidateSetup\(/ },
    { site: "«Hacer» sobre una sugerencia", file: "src/components/suggestion-deck.tsx", re: /await decide\(\{[\s\S]{0,600}invalidateSetup\(/ },
    { site: "Borrar el único ICP", file: "src/components/icp-editor.tsx", re: /<DeleteElement[\s\S]{0,200}kind="icp"[\s\S]{0,400}invalidateSetup\(/ },
  ];
  it.each(ANCHORS)("CA-1 anchor: $site", ({ file, re }) => {
    expect(re.test(code(read(file)))).toBe(true);
  });

  it("the quota is no longer written straight from the screen", () => {
    expect(/\.from\(\s*["']quotas["']\s*\)\s*\.upsert\(/.test(code(read("src/routes/_authenticated/metrics.tsx")))).toBe(false);
  });
});
