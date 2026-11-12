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
// NK-0142: the scope also covers src/server.ts and src/start.ts (the request entry points), and the unsafe patterns now
// include a bare console.error(e) (no label before it), a `new Error(` built inside the call, any `.message` and a
// variable derived from a `.message` (const m = e.message; destructured { message }) used in the call. `.message.length`
// is allowed (a length is what the safe logs keep). The derived-variable rule is a text heuristic: it follows
// assignments in the same file by name, not data flow, so a variable renamed through a function or an object is not seen
// (documented limit, covered by the safe-logs tests that drive the real failures).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..", "..");
const LIB = join(import.meta.dirname);

const SRC = join(ROOT, "src");
const ENTRY_POINTS = [join(SRC, "server.ts"), join(SRC, "start.ts")];
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
  return [...new Set([...lib, ...api, ...fns, ...ENTRY_POINTS])];
}

/** Every console.error|warn|log call: its text up to the matching parenthesis, whitespace collapsed. */
function consoleCalls(source: string): string[] {
  // Comments are not calls (a line that starts with // or a /* */ block).
  const src = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
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

/** Names that hold (a piece of) an error message in this file: `const m = e.message`, `{ message }`, `{ message: m }`. */
function messageVariables(src: string): string[] {
  const names = new Set<string>();
  for (const m of src.matchAll(
    /\b(?:const|let|var)\s+(\w+)(?:\s*:[^=]+)?\s*=[^;]*?\.message\b(?!\.length)/g,
  ))
    if (m[1]) names.add(m[1]);
  for (const m of src.matchAll(/\b(?:const|let|var)\s*\{([^}]*)\}\s*=/g))
    for (const part of (m[1] ?? "").split(",")) {
      const [key, alias] = part.split(":").map((x) => x.trim());
      if (key === "message" && (alias || key)) names.add(alias || key);
    }
  return [...names];
}

/**
 * NK-0149 (gate rework): collections that collect message text and are logged later as a whole.
 * `notes.push(`x: ${(e as Error).message}`)`, `out.notes.push(e.message)`, `bag[k] = e.message`, `bag.k = e.message`
 * and `bag = [e.message]` all make `notes` / `out.notes` / `bag` a carrier: a console call that names it (and not just
 * its `.length`) logs the error text, and anything interpolated next to it (a meeting title, an ICP name).
 * Same documented limit as messageVariables: by name in the same file, not data flow.
 */
function messageCarriers(src: string): string[] {
  const names = new Set<string>();
  const hasMessage = (t: string) => /\.message\b(?!\.length)/.test(t);
  for (const m of src.matchAll(
    /([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\.push\(([\s\S]{0,400}?)\)\s*;/g,
  ))
    if (m[1] && hasMessage(m[2] ?? "")) names.add(m[1]);
  for (const m of src.matchAll(
    /([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)(?:\[[^\]]*\])?\s*=[^=>][^;]{0,400};/g,
  ))
    if (m[1] && hasMessage(m[0].slice(m[0].indexOf("=")))) names.add(m[1]);
  return [...names];
}

/** `derived` = message variables to look for; empty when the message rule does not apply to the file (see MESSAGE_SCOPE). */
function isUnsafeLog(call: string, derived: string[] | null = []): boolean {
  return (
    /\.slice\(/.test(call) ||
    /[(,]\s*(?:e|err|error)\s*\)$/.test(call) ||
    /\bnew Error\(/.test(call) ||
    (derived !== null && /\.message\b(?!\.length)/.test(call)) ||
    (derived ?? []).some((v) =>
      new RegExp(`(?<![\\w.])${v.replace(/\./g, "\\.")}\\b(?!\\.length)`).test(
        call.replace(/^console\.\w+\(/, "").replace(/"[^"]*"|'[^']*'/g, '""'),
      ),
    )
  );
}

// The `.message` rules (a `.message` or a variable derived from it in a console call) apply to every scanned file:
// src/lib/** since NK-0149 (the 28 calls NK-0142 listed now log safeErrorLog or a length), the entry points and
// src/routes/api/** since NK-0142, and every *.functions.ts. A log that needs a readable text uses a literal label.
const inMessageScope = (_rel: string) => true;
const derivedFor = (f: { rel: string; src: string }) =>
  inMessageScope(f.rel) ? [...messageVariables(f.src), ...messageCarriers(f.src)] : null;

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
        .filter((c) => isUnsafeLog(c, derivedFor(f)))
        .filter((c) => !(c in (EXCEPTIONS[f.rel] ?? {})))
        .map((c) => `${f.rel}: ${c}`),
    );
    expect(found).toEqual([]);
  });

  it("every exception still matches an unsafe call and has a reason (no stale entries)", () => {
    const stale: string[] = [];
    for (const [file, calls] of Object.entries(EXCEPTIONS)) {
      const f = files.find((x) => x.rel === file);
      const present = f ? consoleCalls(f.src).filter((c) => isUnsafeLog(c, derivedFor(f))) : [];
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

  it("the scan itself flags the NK-0142 patterns and lets the safe forms through", () => {
    expect(isUnsafeLog("console.error(error)")).toBe(true);
    expect(isUnsafeLog("console.error(consumeLastCapturedError() ?? new Error(`x ${body}`))")).toBe(
      true,
    );
    expect(isUnsafeLog('console.error("x", error.message)')).toBe(true);
    expect(isUnsafeLog('console.error("x", e2?.message)')).toBe(true);
    expect(isUnsafeLog('console.error("x", error.message.length)')).toBe(false);
    expect(isUnsafeLog('console.error("x", safeErrorLog(error))')).toBe(false);
    expect(isUnsafeLog("console.error(`x ${msg}`)", ["msg"])).toBe(true);
    expect(isUnsafeLog('console.error("x", msg)', ["msg"])).toBe(true);
    expect(isUnsafeLog('console.error("x", msg.length)', ["msg"])).toBe(false);
    expect(isUnsafeLog('console.error("x", obj.msg)', ["msg"])).toBe(false);
    expect(isUnsafeLog('console.error("x", msg)')).toBe(false);
  });

  it("finds the variables derived from a message", () => {
    const src = [
      "const a = e.message;",
      "let b = String((err as Error).message).slice(0, 5);",
      "const { message } = error;",
      "const { message: c, code } = error;",
      "const n = e.message.length;",
      "const ok = res.status;",
    ].join("\n");
    expect(messageVariables(src).sort()).toEqual(["a", "b", "c", "message"]);
  });

  it("finds the collections that gather a message (NK-0149 gate rework)", () => {
    const src = [
      "notes.push(`Empresas: ${(e as Error).message}`);",
      "out.notes.push(`Reunión ${meta.title}: ${(e as Error).message}`);",
      "bag[k] = err.message;",
      "info.last = e.message;",
      "const arr = [e.message];",
      "counts.push(rows.length);",
      "sizes.push(e.message.length);",
      "const ok = res.status;",
    ].join("\n");
    expect(messageCarriers(src).sort()).toEqual(["arr", "bag", "info.last", "notes", "out.notes"]);
  });

  it("flags a console call that logs a collection of messages, not its length (NK-0149 gate rework)", () => {
    expect(isUnsafeLog('console.warn("autopilot notes", orgId, out.notes)', ["out.notes"])).toBe(
      true,
    );
    expect(isUnsafeLog('console.warn("discoveries notes", orgId, notes)', ["notes"])).toBe(true);
    expect(isUnsafeLog('console.warn(`n ${notes.join("; ")}`)', ["notes"])).toBe(true);
    expect(
      isUnsafeLog('console.warn("notes", orgId, { count: out.notes.length })', ["out.notes"]),
    ).toBe(false);
    expect(isUnsafeLog('console.warn("notes", orgId, notes.length)', ["notes"])).toBe(false);
    expect(isUnsafeLog('console.warn("notes", orgId, other.notes)', ["notes"])).toBe(false);
  });

  it("ignores console calls written in comments", () => {
    expect(
      consoleCalls("// a plain console.error(error) here\n/* console.log(e) */\nconst x = 1;"),
    ).toEqual([]);
    expect(consoleCalls("foo();\nconsole.error(error);")).toEqual(["console.error(error)"]);
  });

  it("the message rule is off outside its scope and on inside it", () => {
    expect(isUnsafeLog('console.error("x", e.message)', null)).toBe(false);
    expect(isUnsafeLog('console.error("x", e.message)', [])).toBe(true);
    expect(inMessageScope("src/routes/api/public/leads.ts")).toBe(true);
    expect(inMessageScope("src/server.ts")).toBe(true);
    expect(inMessageScope("src/lib/memory.server.ts")).toBe(true);
    expect(inMessageScope("src/lib/inngest/tasks.server.ts")).toBe(true);
  });

  it("covers the two entry points", () => {
    const rels = files.map((f) => f.rel);
    expect(rels).toContain("src/server.ts");
    expect(rels).toContain("src/start.ts");
  });
});
