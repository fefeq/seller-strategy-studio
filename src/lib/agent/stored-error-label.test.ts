// NK-0142: what is stored in a database column for a failure is a label, never the message. A provider or a user can
// quote their own text in error.message, so only the name, a code and the message length are kept. Fictional witness.
import { describe, expect, it } from "vitest";
import { storedErrorLabel } from "@/lib/agent/safe-error-log";

const WITNESS = "SECRET-STORED-ERROR-123";

describe("storedErrorLabel", () => {
  it("is the name and the length: TypeError (len N)", () => {
    const e = new TypeError(`bad ${WITNESS}`);
    expect(storedErrorLabel(e)).toBe(`TypeError (len ${e.message.length})`);
  });

  it("adds a code when it is a short identifier", () => {
    const e = Object.assign(new Error("x"), { code: "ECONNRESET" });
    expect(storedErrorLabel(e)).toBe("Error ECONNRESET (len 1)");
    expect(storedErrorLabel(Object.assign(new Error("x"), { code: 42703 }))).toBe(
      "Error 42703 (len 1)",
    );
  });

  it("drops a code or a name that is not a plain identifier (it could carry text)", () => {
    const e = Object.assign(new Error("x"), { code: `see ${WITNESS}`, name: `Named ${WITNESS}` });
    const out = storedErrorLabel(e);
    expect(out).toBe("Error (len 1)");
    expect(out).not.toContain(WITNESS);
  });

  it("never carries the message, even when the code or name repeats it", () => {
    const e = new Error(WITNESS);
    expect(storedErrorLabel(e)).not.toContain(WITNESS);
  });

  it("handles a thrown value that is not an Error", () => {
    expect(storedErrorLabel(WITNESS)).toBe("string (len 0)");
    expect(storedErrorLabel(null)).toBe("null (len 0)");
  });

  it("stays within the 500 characters the column used to hold", () => {
    expect(storedErrorLabel(new Error("y".repeat(5000))).length).toBeLessThan(100);
  });
});
