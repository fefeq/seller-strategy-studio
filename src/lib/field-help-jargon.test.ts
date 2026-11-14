// Ola 0.6: MEDDPICC and ABM have their own definition in the help catalogue (not the generic fallback).
import { describe, expect, it } from "vitest";
import { resolveHelp } from "./field-help";

describe("jargon help", () => {
  it("MEDDPICC is defined", () => {
    const h = resolveHelp("MEDDPICC");
    expect(h.generic).toBe(false);
    expect(h.description).toMatch(/Metrics/);
    expect(h.description).toMatch(/Champion/);
  });
  it("ABM is defined", () => {
    const h = resolveHelp("ABM");
    expect(h.generic).toBe(false);
    expect(h.description).toMatch(/Account-Based Marketing/);
  });
});
