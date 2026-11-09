// NK-0110 / NK-0114: one session validator. Nothing in src outside session-check.ts asks the server for the
// user on its own (a direct getUser() costs a GET /auth/v1/user and ignores the validated, shared answer).
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(__dirname, "..");
const files = (readdirSync(SRC, { recursive: true, encoding: "utf8" }) as string[])
  .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.(ts|tsx)$/.test(f))
  .filter((f) => !f.split(path.sep).includes("test"))
  .map((f) => f.split(path.sep).join("/"));

describe("no direct auth.getUser( outside the shared validator", () => {
  it("only src/lib/session-check.ts calls auth.getUser(", () => {
    // The scan really sees the tree (an empty list would pass vacuously).
    expect(files.length).toBeGreaterThan(100);
    expect(files).toContain("lib/session-check.ts");
    const offenders = files.filter(
      (f) =>
        f !== "lib/session-check.ts" &&
        /auth\s*\.\s*getUser\s*\(/.test(readFileSync(path.join(SRC, f), "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});
