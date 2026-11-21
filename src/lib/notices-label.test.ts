// SDD-20261118-ux-legibilidad-pantallas-diarias · U-6 · CA-10 (gate round 2): the «Avisos» label of the mobile top
// bar has a bounded width. Below sm the number is capped at «9+» (like the bottom bar badge), so a 3-digit count can
// not push «Menú» off the screen; from sm up the full label and the real number stay. The aria-label keeps the count.
import { describe, expect, it } from "vitest";
import { noticeLabels } from "./notices-label";

describe("noticeLabels", () => {
  it("nothing unread and nothing running: «Avisos»", () => {
    expect(noticeLabels(0, 0)).toEqual({ short: "Avisos", label: "Avisos" });
  });
  it("up to 9 unread: the number as is", () => {
    expect(noticeLabels(9, 0)).toEqual({ short: "Avisos · 9", label: "Avisos · 9" });
  });
  it("10 or more unread: «9+» in the short label, the real number in the long one", () => {
    expect(noticeLabels(14, 0)).toEqual({ short: "Avisos · 9+", label: "Avisos · 14" });
    expect(noticeLabels(1234, 0).short).toBe("Avisos · 9+");
  });
  it("running jobs win over unread, and say «en marcha» only in the long label", () => {
    expect(noticeLabels(14, 3)).toEqual({ short: "Avisos · 3", label: "Avisos · 3 en marcha" });
    expect(noticeLabels(0, 12)).toEqual({ short: "Avisos · 9+", label: "Avisos · 12 en marcha" });
  });
});
