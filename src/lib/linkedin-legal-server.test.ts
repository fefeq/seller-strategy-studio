// Server read of the legal pause: A0: only an explicit pause blocks; missing row, read error and thrown client do not.
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  row: null as { paused: boolean } | null,
  error: null as { message: string } | null,
  throws: false,
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  get supabaseAdmin() {
    if (state.throws) throw new Error("cliente no disponible");
    const q = {
      select: () => q,
      eq: () => q,
      maybeSingle: async () => ({ data: state.row, error: state.error }),
    };
    return { from: (t: string) => (t === "platform_legal_flags" ? q : null) };
  },
}));

// setup.ts mocks this module as «not paused» for unrelated tests; here we need the real one.
const { assertLinkedinExtractionAllowed, linkedinExtractionPaused } = await vi.importActual<
  typeof import("./linkedin-legal.server")
>("./linkedin-legal.server");

beforeEach(() => {
  state.row = null;
  state.error = null;
  state.throws = false;
});

describe("linkedinExtractionPaused", () => {
  it("paused with the flag on", async () => {
    state.row = { paused: true };
    expect(await linkedinExtractionPaused()).toBe(true);
  });

  it("running only with an explicit paused = false", async () => {
    state.row = { paused: false };
    expect(await linkedinExtractionPaused()).toBe(false);
  });

  it("missing row does not block", async () => {
    expect(await linkedinExtractionPaused()).toBe(false);
  });

  it("a read error does not block (fail-open, A0)", async () => {
    state.error = { message: "caído" };
    expect(await linkedinExtractionPaused()).toBe(false);
  });

  it("a broken client does not block (fail-open, A0)", async () => {
    state.throws = true;
    expect(await linkedinExtractionPaused()).toBe(false);
  });
});

describe("assertLinkedinExtractionAllowed", () => {
  it("throws the pause text while paused", async () => {
    state.row = { paused: true };
    await expect(assertLinkedinExtractionAllowed()).rejects.toThrow("revisión legal");
  });

  it("lets it run when the flag is explicitly off", async () => {
    state.row = { paused: false };
    await expect(assertLinkedinExtractionAllowed()).resolves.toBeUndefined();
  });
});
