import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const DIR = resolve(__dirname, "../../scripts/factory");

// Quotes the value with the factory helper and echoes it back through a real shell, as the scripts do.
function roundTrip(value: string) {
  const script = `
    import { spawnSync } from "node:child_process";
    import { shq } from ${JSON.stringify(resolve(DIR, "shell.mjs"))};
    const r = spawnSync("printf %s " + shq(process.argv[1]), { shell: true, encoding: "utf8" });
    process.stdout.write(r.stdout);
  `;
  return spawnSync("node", ["--input-type=module", "-e", script, value], {
    encoding: "utf8",
    env: { ...process.env, id: "EXPANDED" },
  }).stdout;
}

describe("factory shell quoting", () => {
  it.each([
    "src/routes/_authenticated/accounts.$id.tsx",
    "a file with spaces.ts",
    "it's quoted.ts",
    'double "quotes".ts',
    "back`tick`.ts",
    "$(echo run).ts",
  ])("passes %s to the shell unchanged", (name) => {
    expect(roundTrip(name)).toBe(name);
  });

  it("no factory script builds a shell command with JSON.stringify", () => {
    for (const f of readdirSync(DIR).filter((n) => n.endsWith(".mjs"))) {
      const src = readFileSync(resolve(DIR, f), "utf8");
      const inCommand = src.match(/`[^`]*\$\{[^}]*JSON\.stringify[^`]*`/g) ?? [];
      expect(inCommand, f).toEqual([]);
    }
  });
});
