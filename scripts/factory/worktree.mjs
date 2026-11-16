#!/usr/bin/env node
// One isolated git worktree per job, from the exact base commit. Never the live checkout.
// usage: worktree.mjs --ticket NK-0001 --slug <slug> --base <commit>
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const o = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 2) o[argv[i].slice(2)] = argv[i + 1];
if (!o.ticket || !o.slug || !o.base) {
  console.error("usage: worktree.mjs --ticket NK-0001 --slug <slug> --base <commit>");
  process.exit(2);
}
const dir = resolve(ROOT, `../seller-strategy-studio-${o.slug}`);
const branch = `feat/${o.slug}`;
const r = spawnSync(`git worktree add -b ${branch} ${JSON.stringify(dir)} ${o.base}`, {
  cwd: ROOT,
  shell: true,
  stdio: "inherit",
});
if (r.status === 0)
  console.log(
    `\nworktree: ${dir}\nbranch:   ${branch}\nbase:     ${o.base}\nNext: cd there, install deps (bun install), then write the failing test first.`,
  );
process.exit(r.status ?? 1);
