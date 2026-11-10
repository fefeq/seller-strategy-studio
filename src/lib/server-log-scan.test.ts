// @vitest-environment node
// NK-0104 CA-5, widened by NK-0118 + NK-0121: a console.error|warn|log must not carry a slice of a body or model output
// (`.slice(`) nor the whole error (`, e)` / `, err)` / `, error)`). Use safeErrorLog(e) or lengths and status instead.
// Scope (NK-0121): every non-test source file under src/lib/** (the *.server.ts files, but also the provider gateways
// such as firecrawl.ts or google-drive.ts and *.functions.ts, which talk to providers and are not named *.server.ts)
// plus every src/**/*.functions.ts. Criterion: a file anywhere in src/lib is server-side code that handles provider
// bodies or model output, and a *.functions.ts outside it runs on the server too; the scan reads text, so a pure file
// with no console call costs nothing. The exception list is closed and now empty: a new entry needs a reason that is
// not "pending".
// NK-0131: the scope now also covers every non-test source file under src/routes/api/** (public routes such as the
// proactive job, the Telegram webhook and the lead intake run on the server and log provider failures). Tests there
// carry the `-` prefix (-name.test.ts), which the test filter already excludes.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..", "..");
const LIB = join(import.meta.dirname);

const SRC = join(ROOT, "src");
const API = join(SRC, "routes", "api");
const isTest = (n: string) => /\.test\.tsx?$/.test(n);

function sourceFiles(dir: string, keep: (name: string) => boolean): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? sourceFiles(p, keep) : keep(n) ? [p] : [];
  });
}

/** src/lib/** and src/routes/api/** (non-test .ts/.tsx) plus every src/**\/*.functions.ts, without duplicates. */
function scannedFiles(): string[] {
  const lib = sourceFiles(LIB, (n) => /\.tsx?$/.test(n) && !isTest(n));
  const api = sourceFiles(API, (n) => /\.tsx?$/.test(n) && !isTest(n));
  const fns = sourceFiles(SRC, (n) => n.endsWith(".functions.ts"));
  return [...new Set([...lib, ...api, ...fns])];
}

/** Every console.error|warn|log call: its text up to the matching parenthesis, whitespace collapsed. */
function consoleCalls(src: string): string[] {
  const out: string[] = [];
  const re = /console\.(?:error|warn|log)\(/g;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    let depth = 1;
    let i = m.index + m[0].length;
    for (; i < src.length && depth > 0; i++) {
      const ch = src[i];
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
    }
    out.push(src.slice(m.index, i).replace(/\s+/g, " "));
  }
  return out;
}

function isUnsafeLog(call: string): boolean {
  return /\.slice\(/.test(call) || /,\s*(?:e|err|error)\s*\)$/.test(call);
}

// file -> exact call -> reason (never "pending"). Closed list, empty since NK-0118 + NK-0121: it can only shrink.
const EXCEPTIONS: Record<string, Record<string, string>> = {};

describe("server logs carry no body, output or whole error (NK-0104 CA-5, NK-0118/0121 CA-2)", () => {
  const files = scannedFiles().map((f) => ({
    rel: relative(ROOT, f).split("\\").join("/"),
    src: readFileSync(f, "utf8"),
  }));

  it("finds the server files and the provider gateways (NK-0121 scope)", () => {
    const rels = files.map((f) => f.rel);
    expect(files.length).toBeGreaterThan(20);
    for (const gateway of [
      "src/lib/memory.server.ts",
      "src/lib/firecrawl.ts",
      "src/lib/apollo-gateway.ts",
      "src/lib/perplexity.ts",
      "src/lib/apify-gateway.ts",
      "src/lib/clay-gateway.ts",
      "src/lib/parallel-gateway.ts",
      "src/lib/google-drive.ts",
      "src/lib/ai.functions.ts",
    ])
      expect(rels).toContain(gateway);
  });

  it("finds every public API route and no test file there (NK-0131 scope)", () => {
    const api = files.map((f) => f.rel).filter((r) => r.startsWith("src/routes/api/"));
    for (const route of [
      "src/routes/api/public/jobs/proactive.ts",
      "src/routes/api/public/telegram/webhook.ts",
      "src/routes/api/public/leads.ts",
      "src/routes/api/public/accounts.ts",
      "src/routes/api/public/inngest.ts",
      "src/routes/api/public/apollo/phone-webhook.ts",
    ])
      expect(api).toContain(route);
    expect(api.filter((r) => /\.test\.tsx?$/.test(r) || /\/-[^/]*$/.test(r))).toEqual([]);
  });

  it("the exception list is empty or every reason is not «pending»", () => {
    const pending = Object.entries(EXCEPTIONS).flatMap(([file, calls]) =>
      Object.entries(calls)
        .filter(([, why]) => /pending|pendiente/i.test(why))
        .map(([call]) => `${file}: ${call}`),
    );
    expect(pending).toEqual([]);
  });

  it("no unsafe console call outside the closed exception list", () => {
    const found = files.flatMap((f) =>
      consoleCalls(f.src)
        .filter(isUnsafeLog)
        .filter((c) => !(c in (EXCEPTIONS[f.rel] ?? {})))
        .map((c) => `${f.rel}: ${c}`),
    );
    expect(found).toEqual([]);
  });

  it("every exception still matches an unsafe call and has a reason (no stale entries)", () => {
    const stale: string[] = [];
    for (const [file, calls] of Object.entries(EXCEPTIONS)) {
      const f = files.find((x) => x.rel === file);
      const present = f ? consoleCalls(f.src).filter(isUnsafeLog) : [];
      for (const [call, why] of Object.entries(calls))
        if (!present.includes(call) || !why.trim()) stale.push(`${file}: ${call}`);
    }
    expect(stale).toEqual([]);
  });

  it("the scan itself flags the three NK-0104 patterns", () => {
    expect(isUnsafeLog('console.error("x", e)')).toBe(true);
    expect(isUnsafeLog("console.error(`x ${body.slice(0, 500)}`)")).toBe(true);
    expect(isUnsafeLog('console.error("x", raw.slice(0, 300))')).toBe(true);
    expect(isUnsafeLog('console.error("x", safeErrorLog(e))')).toBe(false);
    expect(isUnsafeLog('console.error("x", res.status, body.length)')).toBe(false);
  });
});
