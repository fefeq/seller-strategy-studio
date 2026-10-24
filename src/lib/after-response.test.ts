import { describe, expect, it, vi } from "vitest";
import { afterResponse, requestCtx } from "./after-response.server";

describe("afterResponse", () => {
  it("returns before the work finishes and hands the work to waitUntil", async () => {
    let done = false;
    const waitUntil = vi.fn();
    requestCtx.run({ waitUntil }, () => afterResponse("t", async () => { await new Promise((r) => setTimeout(r, 20)); done = true; }));
    expect(done).toBe(false);
    expect(waitUntil).toHaveBeenCalledTimes(1);
    await waitUntil.mock.calls[0][0];
    expect(done).toBe(true);
  });
  it("never throws when the work fails", async () => {
    const waitUntil = vi.fn();
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    requestCtx.run({ waitUntil }, () => afterResponse("t", async () => { throw new Error("boom"); }));
    await expect(waitUntil.mock.calls[0][0]).resolves.toBeUndefined();
    err.mockRestore();
  });
});
