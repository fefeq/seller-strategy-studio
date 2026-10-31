import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const LEDGER = resolve(__dirname, "../../scripts/factory/ledger.mjs");

let root: string;

function run(...args: string[]) {
  const r = spawnSync("node", [LEDGER, ...args], {
    encoding: "utf8",
    env: { ...process.env, FACTORY_DIR: join(root, ".factory") },
  });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

function doc(path: string, estado: string) {
  writeFileSync(join(root, path), `# Doc\n\n**Estado:** ${estado} · **Pide:** Fede\n`);
}

function id(out: string) {
  return /NK-\d+/.exec(out)![0];
}

const GO = ["--go", "Fede", "--owner", "test-session"];

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "nokko-ledger-"));
  mkdirSync(join(root, ".factory"));
  mkdirSync(join(root, "docs/sdd"), { recursive: true });
  mkdirSync(join(root, "docs/prd"), { recursive: true });
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("ledger promote guard", () => {
  it("lets a bug through without SDD", () => {
    const t = id(run("log", "Fix typo in empty state", "--kind", "bug").out);
    expect(run("promote", t, ...GO).code).toBe(0);
  });

  it("blocks a feature with no SDD linked", () => {
    const t = id(run("log", "Add saved views", "--kind", "feature").out);
    const r = run("promote", t, ...GO);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/needs an approved SDD/);
  });

  it("blocks a feature whose SDD is still a draft", () => {
    doc("docs/sdd/SDD-a.md", "Borrador");
    const t = id(run("log", "Add saved views", "--kind", "feature", "--sdd", "docs/sdd/SDD-a.md").out);
    const r = run("promote", t, ...GO);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/Borrador/);
  });

  it("promotes a feature once its SDD is approved", () => {
    doc("docs/sdd/SDD-a.md", "Aprobado (Fede, 2026-10-28)");
    const t = id(run("log", "Add saved views", "--kind", "feature", "--sdd", "docs/sdd/SDD-a.md").out);
    expect(run("promote", t, ...GO).code).toBe(0);
  });

  it("blocks when a linked PRD is not approved even if the SDD is", () => {
    doc("docs/sdd/SDD-a.md", "Aprobado");
    doc("docs/prd/PRD-a.md", "Borrador");
    const t = id(
      run("log", "Add saved views", "--kind", "feature", "--sdd", "docs/sdd/SDD-a.md", "--prd", "docs/prd/PRD-a.md").out,
    );
    const r = run("promote", t, ...GO);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/PRD/);
  });

  it("checks a bug's SDD only when one is linked", () => {
    doc("docs/sdd/SDD-b.md", "Borrador");
    const t = id(run("log", "Fix RLS gap on leads", "--kind", "bug", "--sdd", "docs/sdd/SDD-b.md").out);
    expect(run("promote", t, ...GO).code).toBe(1);
  });

  it("links docs later with `doc` and then allows promote", () => {
    doc("docs/sdd/SDD-a.md", "Aprobado");
    const t = id(run("log", "Add saved views", "--kind", "feature").out);
    expect(run("doc", t, "--sdd", "docs/sdd/SDD-a.md").code).toBe(0);
    expect(run("promote", t, ...GO).code).toBe(0);
  });

  it("rejects a link to a file that does not exist", () => {
    const t = id(run("log", "Add saved views", "--kind", "feature").out);
    expect(run("doc", t, "--sdd", "docs/sdd/missing.md").code).toBe(1);
  });
});
