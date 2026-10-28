#!/usr/bin/env node
// Flake protocol (README layer 3): rerun a failing test file in isolation on the new commit and on the base, N times.
// Fails on both -> logged as flake. Fails only on the new commit -> blocking regression, with its exact signature.
// usage: flake.mjs --ticket NK-0001 --base <commit> --file src/lib/x.test.ts [--runs 3]
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, symlinkSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

const ROOT = resolve(import.meta.dirname, "../..");
const o = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 2) o[argv[i].slice(2)] = argv[i + 1];
if (!o.ticket || !o.base || !o.file) {
  console.error("usage: flake.mjs --ticket NK-0001 --base <commit> --file <test file> [--runs 3]");
  process.exit(2);
}
const runs = Number(o.runs ?? 3);
const sh = (cmd, cwd = ROOT) => spawnSync(cmd, { cwd, shell: true, encoding: "utf8", maxBuffer: 1 << 28 });

const tip = sh("git rev-parse HEAD").stdout.trim();
const wt = resolve(mkdtempSync(resolve(tmpdir(), "nk-flake-")), "base");
const add = sh(`git worktree add --detach ${JSON.stringify(wt)} ${o.base}`);
if (add.status !== 0) {
  console.error(add.stderr);
  process.exit(2);
}
symlinkSync(resolve(ROOT, "node_modules"), resolve(wt, "node_modules"));

const attempt = (cwd) => Array.from({ length: runs }, () => sh(`npx vitest run ${JSON.stringify(o.file)}`, cwd));
const onTip = attempt(ROOT);
const onBase = attempt(wt);
sh(`git worktree remove --force ${JSON.stringify(wt)}`);

const fails = (rs) => rs.filter((r) => r.status !== 0).length;
const sig = (rs) => (rs.find((r) => r.status !== 0)?.stdout ?? "").split("\n").filter((l) => /FAIL|AssertionError|Error:/.test(l)).slice(0, 5).join("\n");
const tipFails = fails(onTip);
const baseFails = fails(onBase);
const verdict = tipFails === 0 ? "PASSES_ON_TIP" : baseFails > 0 ? "FLAKE" : "REGRESSION";
const dir = resolve(ROOT, ".factory/evidence", o.ticket);
mkdirSync(dir, { recursive: true });
const out = { file: o.file, tip, base: o.base, runs, tipFails, baseFails, verdict, signature: sig(onTip) };
writeFileSync(resolve(dir, `flake-${o.file.replace(/\W+/g, "-")}.json`), JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify(out, null, 2));
process.exit(verdict === "REGRESSION" ? 1 : 0);
