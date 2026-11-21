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

const menu = route.slice(
  route.indexOf('aria-controls="mobile-nav"'),
  route.indexOf('aria-controls="mobile-nav"') + 250,
);

describe("mobile top bar", () => {
  it("«Buscar» sizes itself by its word, with a 44 px minimum", () => {
    expect(bar).toContain("min-w-11");
    expect(bar).toContain("px-1");
    expect(bar).toContain("text-sm");
    expect(bar).not.toMatch(/\bsize-11\b/);
    expect(bar).toContain("min-h-11");
  });
  // Measured in the browser (2026-11-18): gap-3 at every width pushed «Menú» ~40 px past the right edge at 360 and
  // 375 px (the page became wider than the screen; gate finding 6). The gap and the side padding only grow from 400 px.
  it("below 400 px the bar is tight (4 px gaps, 10 px sides) and only grows from 400 px", () => {
    expect(row).toContain("gap-1");
    expect(row).toContain("min-[400px]:gap-3");
    expect(row).toContain("px-2.5");
    expect(row).toContain("min-[400px]:px-4");
    expect(row).not.toMatch(/(^|\s)gap-3(\s|")/);
  });
  // Measured at 360 px with the widest short label («Avisos · 9+»): px-3 and -mr-1 left the page 2 px wider than the screen.
  it("«Menú» hangs 8 px into the side padding so «Avisos · 9+» fits at 360 px", () => {
    expect(menu).toContain("-mr-2");
    expect(menu).toContain("px-1");
  });
  // Measured 2026-11-21 in the real app at 360 px with «Avisos · 9+»: with the drawer open «Cerrar» (5 px wider than
  // «Menú») left the page 366 px wide and cut its last letter. Below 400 px «Buscar» steps aside while the drawer is
  // open and «Avisos» takes its auto margin so both stay right-aligned; from 400 px nothing changes.
  it("with the drawer open, below 400 px «Buscar» steps aside and «Avisos» keeps the bar right-aligned", () => {
    const search = route.slice(
      route.indexOf('aria-label="Buscar"'),
      route.indexOf("Buscar\n", route.indexOf('aria-label="Buscar"')),
    );
    expect(search).toContain('navOpen ? "hidden min-[400px]:flex" : "flex"');
    const notices = route.slice(
      route.indexOf("<NotificationCenter"),
      route.indexOf("<NotificationCenter") + 200,
    );
    expect(notices).toContain('navOpen ? "ml-auto shrink-0 min-[400px]:ml-0" : "shrink-0"');
  });
});
