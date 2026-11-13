// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { titleLogViolations } from "../../scripts/server-title-log-scan";

describe("NK-0160 title-only log carriers", () => {
  it.each([
    'const notes = []; notes.push(meeting.title); console.warn("notes", notes);',
    'const notes = [person.name]; console.info("notes", notes);',
    'const notes = []; notes.push(`Meeting ${meeting.title}`); const alias = notes; console.debug(alias);',
    'const out = { notes: [] }; out.notes.push(person.name); console.log(out.notes.join(";"));',
    'const bag = {}; bag.last = meeting.title; console.error(bag);',
  ])("detects private text without any error message: %s", (source) => {
    expect(titleLogViolations(source)).toEqual([1]);
  });
  it.each([
    'const notes = []; notes.push(meeting.title); console.warn("notes", { count: notes.length });',
    'const notes = [person.name]; console.log(notes.length);',
    '// console.log(person.name)\nconst n = 1;',
    'console.warn("failed", error instanceof Error ? error.name : "unknown");',
  ])("allows counts and error classification: %s", (source) => {
    expect(titleLogViolations(source)).toEqual([]);
  });
  it("guards actual server sources and the suggestions hook without logging source contents", () => {
    const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      return entry.isDirectory() ? walk(path) : /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path) ? [path] : [];
    });
    const files = [...walk("src/lib"), ...walk("src/routes/api"), "src/server.ts", "src/start.ts", "src/components/suggestions.tsx"];
    const violations = files.flatMap((file) => titleLogViolations(readFileSync(file, "utf8")).map((line) => `${file}:${line}`));
    expect(violations).toEqual([]);
  });
});