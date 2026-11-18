// SDD-20261118-ux-legibilidad-pantallas-diarias · U-6 · CA-10: on the mobile top bar «Buscar» is as wide as its word
// and the three actions keep a fixed gap. Before, the button was 44 px wide (`size-11`) while «Buscar» is wider, so it
// spilled onto «Avisos». This reads the source like the other source-reading tests; the gap and the absence of
// truncation at 375 px are measured in the browser (SDD sections 16 and 17). The file name starts with «-» so the
// router does not take it for a route.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const route = readFileSync(resolve(__dirname, "./route.tsx"), "utf8");
const bar = route.slice(
  route.indexOf('aria-label="Buscar"') - 200,
  route.indexOf('aria-label="Buscar"') + 300,
);
const row = route.slice(
  route.indexOf("flex h-14 items-center"),
  route.indexOf("flex h-14 items-center") + 120,
);

describe("mobile top bar", () => {
  it("«Buscar» sizes itself by its word, with a 44 px minimum", () => {
    expect(bar).toContain("min-w-11");
    expect(bar).toContain("px-2");
    expect(bar).not.toMatch(/\bsize-11\b/);
    expect(bar).toContain("min-h-11");
  });
  it("the actions are 12 px apart at every width", () => {
    expect(row).toContain("gap-3");
    expect(row).not.toContain("gap-1 ");
    expect(row).not.toContain("min-[400px]:gap-3");
  });
});
