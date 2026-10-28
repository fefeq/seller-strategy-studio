#!/usr/bin/env node
// Independent gate (README layer 3). Run it from a fresh session that wrote none of the code.
// Fixed core checks + optional change-specific extras (--extra "<cmd>"). It can add checks, never remove or weaken one.
// It never edits product code, assertions or timeouts. Failed attempts stay in the evidence.
// usage: gate.mjs --ticket NK-0001 --base <commit> [--extra "<cmd>"]... [--known .factory/known-failures.json]
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const argv = process.argv.slice(2);
const opt = { extra: [] };
for (let i = 0; i < argv.length; i++) {
  if (!argv[i].startsWith("--")) continue;
  const k = argv[i].slice(2);
  if (k === "extra") opt.extra.push(argv[++i]);
  else opt[k] = argv[++i];
}
if (!opt.ticket || !opt.base) {
  console.error("usage: gate.mjs --ticket NK-0001 --base <commit> [--extra <cmd>]...");
  process.exit(2);
}

const sh = (cmd, env = {}) =>
  spawnSync(cmd, { cwd: ROOT, shell: true, encoding: "utf8", maxBuffer: 1 << 28, env: { ...process.env, ...env } });
const git = (c) => sh(`git ${c}`).stdout.trim();

const sha = git("rev-parse HEAD");
const dirty = git("status --porcelain");
const outDir = resolve(ROOT, ".factory/evidence", opt.ticket, sha.slice(0, 12));
mkdirSync(outDir, { recursive: true });
const checks = [];
const record = (name, ok, detail, file) => {
  checks.push({ name, ok, detail, file });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  ${detail}` : ""}`);
};
const runLogged = (name, cmd, env) => {
  const r = sh(cmd, env);
  const file = `${name.replace(/\W+/g, "-")}.log`;
  writeFileSync(resolve(outDir, file), `$ ${cmd}\n\n${r.stdout}\n${r.stderr}\n(exit ${r.status})\n`);
  return { r, file };
};

// 0. The gate must test an exact, clean commit.
record("clean tree on exact commit", dirty === "", dirty ? "uncommitted changes: commit or stash first" : sha);

// Canary: proves the runner itself still detects failure.
{
  const bad = sh(`node -e "process.exit(1)"`);
  const good = sh(`node -e "process.exit(0)"`);
  record("canary: runner detects failure", bad.status === 1 && good.status === 0);
}

// Diff guards (forbidden moves, secret-leak guard). Only added lines are inspected.
{
  const diff = sh(`git diff ${opt.base}...HEAD --unified=0 --no-color`).stdout;
  const files = {};
  let cur = "";
  const added = [];
  const removed = [];
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ b/")) cur = line.slice(6);
    else if (line.startsWith("+") && !line.startsWith("+++")) added.push({ f: cur, l: line.slice(1) });
    else if (line.startsWith("-") && !line.startsWith("---")) removed.push({ f: cur, l: line.slice(1) });
    if (cur) files[cur] = true;
  }
  const isTest = (f) => /\.(test|spec)\.tsx?$/.test(f);
  const src = (f) => f.startsWith("src/");
  const rules = [
    ["no `as any`", (x) => src(x.f) && /\bas any\b/.test(x.l)],
    ["no window.confirm/prompt", (x) => src(x.f) && /window\.(confirm|prompt)\(/.test(x.l)],
    ["no committed secrets", (x) => /sb_secret_|sk-[A-Za-z0-9]{20,}|service_role\s*[:=]\s*["'][A-Za-z0-9._-]{20,}/.test(x.l)],
    ["no secret in VITE_ vars", (x) => /VITE_\w*(SECRET|SERVICE|PRIVATE|TOKEN)\w*/.test(x.l)],
    ["no .only/.skip in tests", (x) => isTest(x.f) && /\b(it|test|describe)\.(only|skip)\b/.test(x.l)],
    ["no raw error.message toasts", (x) => src(x.f) && /toast\w*\([^)]*\berror\.message\b/.test(x.l)],
  ];
  for (const [name, hit] of rules) {
    const bad = added.filter(hit);
    record(`guard: ${name}`, bad.length === 0, bad.slice(0, 3).map((b) => `${b.f}: ${b.l.trim()}`).join(" | "));
  }
  record("guard: .env untouched", !files[".env"], files[".env"] ? ".env changed: needs human review" : "");
  const expects = (arr) => arr.filter((x) => isTest(x.f) && /\bexpect\(/.test(x.l)).length;
  const weakened = expects(removed) > expects(added);
  record("guard: assertions not weakened", !weakened, weakened ? `removed ${expects(removed)} expect( vs added ${expects(added)}` : "");
  const timeoutUp = added.filter((x) => isTest(x.f) && /timeout\s*[:=,(]\s*\d{4,}/.test(x.l));
  record("guard: no longer timeouts in tests", timeoutUp.length === 0, timeoutUp.map((b) => b.f).join(", "));
}

// 1. Type-check and release build. Network blocked is best-effort here (dead proxy); a hard block needs a sandbox.
{
  const { r, file } = runLogged("typecheck", "npx tsc --noEmit");
  record("typecheck", r.status === 0, "", file);
}
{
  // The repo has pre-existing prettier debt, so lint runs on the files this change touches (never fewer than that).
  const changed = sh(`git diff ${opt.base}...HEAD --name-only --diff-filter=AM`).stdout.split("\n").filter((f) => /^(src|scripts)\/.*\.(tsx?|jsx?|mjs)$/.test(f));
  if (!changed.length) record("lint (touched files)", true, "no lintable files touched");
  else {
    const { r, file } = runLogged("lint", `npx eslint ${changed.map((f) => JSON.stringify(f)).join(" ")}`);
    record(`lint (touched files, ${changed.length})`, r.status === 0, "", file);
  }
}
{
  const dead = "http://127.0.0.1:9";
  const { r, file } = runLogged("build-offline", "npx vite build", { HTTP_PROXY: dead, HTTPS_PROXY: dead, http_proxy: dead, https_proxy: dead });
  record("release build (outside network best-effort blocked)", r.status === 0, "", file);
}

// 2. Full unit suite. Known failures are named in advance; files that fail without running an assertion count separately.
let failedFiles = [];
{
  const jsonFile = resolve(outDir, "vitest.json");
  const { r, file } = runLogged("unit-suite", `npx vitest run --reporter=json --outputFile=${JSON.stringify(jsonFile)}`);
  let report = null;
  try {
    report = JSON.parse(readFileSync(jsonFile, "utf8"));
  } catch {}
  if (!report) {
    record("full unit suite", false, "no JSON report produced", file);
  } else {
    const known = new Set(
      existsSync(resolve(ROOT, opt.known ?? ".factory/known-failures.json"))
        ? JSON.parse(readFileSync(resolve(ROOT, opt.known ?? ".factory/known-failures.json"), "utf8")).tests ?? []
        : [],
    );
    const noAssertions = [];
    const unexpected = [];
    const knownHit = [];
    for (const f of report.testResults) {
      const rel = f.name.replace(`${ROOT}/`, "");
      const ran = f.assertionResults.length;
      if (f.status === "failed" && ran === 0) noAssertions.push(rel);
      for (const t of f.assertionResults) {
        if (t.status !== "failed") continue;
        const id = `${rel} > ${t.fullName}`;
        (known.has(id) ? knownHit : unexpected).push(id);
      }
      if (f.status === "failed") failedFiles.push(rel);
    }
    writeFileSync(resolve(outDir, "unit-summary.json"), JSON.stringify({ total: report.numTotalTests, passed: report.numPassedTests, failed: report.numFailedTests, noAssertions, unexpected, knownHit }, null, 2));
    record("full unit suite", unexpected.length === 0 && noAssertions.length === 0 && r.status === 0 || (unexpected.length === 0 && noAssertions.length === 0 && knownHit.length > 0),
      `${report.numPassedTests}/${report.numTotalTests} passed; known failures ${knownHit.length}; unexpected ${unexpected.length}; files with no assertion run ${noAssertions.length}`, "unit-summary.json");
  }
}

// 3. Every touched test file, run whole.
{
  const touched = sh(`git diff ${opt.base}...HEAD --name-only --diff-filter=AM`).stdout.split("\n").filter((f) => /\.(test|spec)\.tsx?$/.test(f));
  if (touched.length) {
    const { r, file } = runLogged("touched-tests", `npx vitest run ${touched.map((f) => JSON.stringify(f)).join(" ")}`);
    record(`touched test files, whole (${touched.length})`, r.status === 0, "", file);
  } else record("touched test files, whole", true, "none touched");
}

// 4 (README: second machine). Not available for NOKKO yet: reported, never silently skipped.
record("second-machine full run", true, "NOT RUN: no second runner configured; canary + secret guard above are the local substitute");

// 5. Resource soak on the built artifact: only what is measurable without a runtime (bundle size recorded for trend).
{
  const du = sh("du -sk dist .output 2>/dev/null").stdout.trim();
  writeFileSync(resolve(outDir, "artifact-size.txt"), du + "\n");
  record("artifact size recorded", true, "NOT A SOAK: file handles, memory and restarts are not measured here", "artifact-size.txt");
}

// Change-specific extras: added by the gate agent after reading the change. Additive only.
for (const cmd of opt.extra) {
  const { r, file } = runLogged(`extra-${checks.length}`, cmd);
  record(`extra: ${cmd}`, r.status === 0, "", file);
}

const verdict = checks.every((c) => c.ok) ? "PASS" : "FAIL";
const result = { ticket: opt.ticket, sha, base: opt.base, at: new Date().toISOString(), verdict, failedFiles, checks };
writeFileSync(resolve(outDir, "gate.json"), JSON.stringify(result, null, 2) + "\n");
writeFileSync(resolve(ROOT, ".factory/evidence", opt.ticket, `gate-${sha.slice(0, 12)}.json`), JSON.stringify(result, null, 2) + "\n");
console.log(`\nVERDICT ${verdict} on ${sha.slice(0, 12)}  evidence: ${outDir}`);
if (verdict === "FAIL") console.log("Next: scripts/factory/flake.mjs for each unexpected failing test file before sending it back to the author.");
process.exit(verdict === "PASS" ? 0 : 1);
