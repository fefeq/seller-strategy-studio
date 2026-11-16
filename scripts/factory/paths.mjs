// Shared factory state lives in the MAIN worktree's .factory/, so every job worktree reads and writes the same ledger and evidence.
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const here = resolve(import.meta.dirname, "../..");
const out = spawnSync("git worktree list --porcelain", {
  cwd: here,
  shell: true,
  encoding: "utf8",
}).stdout;
const main =
  out
    .split("\n")
    .find((l) => l.startsWith("worktree "))
    ?.slice(9) ?? here;

export const FACTORY_DIR = resolve(process.env.FACTORY_DIR ?? resolve(main, ".factory"));
