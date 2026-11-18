// SDD-20261118-ux-legibilidad-pantallas-diarias · U-3 · CA-6 (guard only): the KPI row and the funnel of Leads
// size their columns by the width they really have, not by the viewport. With the 240 px menu beside the page a
// viewport rule («md:grid-cols-6») gives 6 columns of ~80 px at ~500 px of content and the labels overlap.
// This reads the source like the other source-reading tests; it cannot prove that nothing overlaps on screen,
// that is checked in the browser (see the SDD, sections 16 and 17).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const leads = readFileSync(resolve(__dirname, "../routes/_authenticated/leads.index.tsx"), "utf8");

describe("Leads grids follow the available width", () => {
  it("the KPI row and the funnel do not use a viewport rule for 4 or 6 columns", () => {
    expect(leads).not.toMatch(/md:grid-cols-(4|5|6)\b/);
  });
  it("both use auto-fit columns with a minimum width", () => {
    const fits = leads.match(/grid-cols-\[repeat\(auto-fit,minmax\([\d.]+rem,1fr\)\)\]/g) ?? [];
    expect(fits.length).toBeGreaterThanOrEqual(2);
  });
});
