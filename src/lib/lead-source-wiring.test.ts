// SDD-20261118-ux-legibilidad-pantallas-diarias · U-2 · CA-4 (wiring guard, gate finding 1): both screens that split
// the lead funnel by origin go through funnelBySource, so «manual» and «Manual» cannot become two rows again.
// Reads the source like the other source-reading tests; the pure function has its own tests in lead-source.test.ts.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(__dirname, p), "utf8");
const screens: [string, string][] = [
  ["Leads screen", "../routes/_authenticated/leads.index.tsx"],
  ["lead funnel panel", "../components/leads/lead-funnel-panel.tsx"],
];

describe.each(screens)("%s", (_name, path) => {
  const src = read(path);
  it("groups by origin with funnelBySource", () => {
    expect(src).toContain("funnelBySource(");
  });
  it("does not group by the raw source text any more", () => {
    expect(src).not.toMatch(/l\.source\s*\|\|\s*"Sin origen"/);
    expect(src).not.toMatch(/funnelBy\([^)]*source/);
  });
});
