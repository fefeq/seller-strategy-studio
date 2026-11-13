import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { describeError } from "./error-capture";

const WITNESS = "TESTIGO-cliente-7731";
const src = (p: string) => readFileSync(p, "utf8");

describe("logs and step output carry no customer or provider text", () => {
  it("NK-0158: describeError keeps the name and stack frames, never the message or the cause value", () => {
    const e = new Error(`fallo con ${WITNESS}`, { cause: new TypeError(`causa ${WITNESS}`, { cause: WITNESS }) });
    const out = describeError(e);
    expect(out).not.toContain(WITNESS);
    expect(out).toMatch(/^Error/);
    expect(out).toContain("caused by: TypeError");
    expect(out).toMatch(/\n\s+at /);
  });

  it("NK-0162: the visible body of an account research never shows the raw error message", () => {
    const s = src("src/lib/autopilot.server.ts");
    expect(s).not.toMatch(/No pude investigar la web: \$\{\(e as Error\)/);
    expect(s).toContain("No pude investigar la web: ${errorText(e)}");
  });

  it("NK-0160/NK-0161: the suggestions hook uses safe storage and does not log the error object", () => {
    const s = src("src/components/suggestions.tsx");
    expect(s).not.toMatch(/sessionStorage\.(getItem|setItem)\(k\b/);
    expect(s).toContain('storageSet("session", k');
    expect(s).not.toMatch(/background recheck failed", e\)/);
  });
});
