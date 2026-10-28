#!/usr/bin/env node
// Author proof, "fail first": the new test must FAIL on the base commit, otherwise it proves nothing.
// Copies the test file onto a detached worktree of the base and runs it there. Exit 0 only if it fails on base.
// usage: fail-first.mjs --base <commit> --file src/lib/x.test.ts
import { spawnSync } from "node:child_process";
import { mkdtempSync, copyFileSync, mkdirSync, symlinkSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { tmpdir } from "node:os";

const ROOT = resolve(import.meta.dirname, "../..");
const o = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 2) o[argv[i].slice(2)] = argv[i + 1];
if (!o.base || !o.file) {
  console.error("usage: fail-first.mjs --base <commit> --file <test file>");
  process.exit(2);
}
const sh = (cmd, cwd = ROOT) => spawnSync(cmd, { cwd, shell: true, encoding: "utf8", maxBuffer: 1 << 28 });
const wt = resolve(mkdtempSync(resolve(tmpdir(), "nk-ff-")), "base");
if (sh(`git worktree add --detach ${JSON.stringify(wt)} ${o.base}`).status !== 0) process.exit(2);
symlinkSync(resolve(ROOT, "node_modules"), resolve(wt, "node_modules"));
mkdirSync(dirname(resolve(wt, o.file)), { recursive: true });
copyFileSync(resolve(ROOT, o.file), resolve(wt, o.file));
const r = sh(`npx vitest run ${JSON.stringify(o.file)}`, wt);
sh(`git worktree remove --force ${JSON.stringify(wt)}`);
const failed = r.status !== 0;
console.log(failed ? `OK: ${o.file} fails on base ${o.base.slice(0, 12)} (fail-first proven)` : `NOT PROVEN: ${o.file} passes on base ${o.base.slice(0, 12)}; it proves nothing`);
process.exit(failed ? 0 : 1);
