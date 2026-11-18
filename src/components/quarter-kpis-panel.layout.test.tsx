// SDD-20261118-ux-legibilidad-pantallas-diarias · U-4 · CA-7b, CA-7c, CA-7d: the quarterly KPI table keeps every
// «Sin dato · motivo» word for word and only changes how it sits: «plan» and its mark on separate lines, a minimum
// width per column, a faded edge while there is more to the right, and the current quarter scrolled into view.
// Geometry (lines per cell at 375 px) is checked in the browser, not here. Fictional data, no network.
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { segRow, type FakeDb } from "@/test/metrics-mocks";

const db = vi.hoisted((): FakeDb => ({ tables: {} }));
vi.mock("@/integrations/supabase/client", async () =>
  (await import("@/test/metrics-mocks")).fakeSupabaseModule(db),
);
vi.mock("@tanstack/react-router", async () =>
  (await import("@/test/metrics-mocks")).fakeRouterModule(),
);
vi.mock("@/hooks/use-me", async () => (await import("@/test/metrics-mocks")).fakeUseMeModule());

import { QuarterKpisPanel } from "@/components/quarter-kpis-panel";

const renderPanel = async () => {
  db.tables = {
    segments: [segRow({ id: "a", name: "Pyme", acv_min: 0, gross_margin_pct: null })],
    deals: [],
    segment_budget_quarters: [],
    cac_costs: [],
  };
  const r = render(
    <QueryClientProvider client={new QueryClient()}>
      <QuarterKpisPanel quarter="2026-Q4" />
    </QueryClientProvider>,
  );
  await screen.findByText("Payback 2026-Q4");
  return r;
};
const row = (label: string) =>
  screen.getByText(label, { selector: "td" }).closest("tr") as HTMLElement;
const classes = (el: Element | null | undefined) => (el?.className ?? "").toString().split(" ");

describe("CA-7b «plan» and its mark sit on separate lines", () => {
  it("in «Margen bruto» the plan mark is a block and the word «plan» is its own line", async () => {
    await renderPanel();
    const cell = row("Margen bruto").querySelectorAll("td")[4] as HTMLElement;
    const planLine = cell.querySelectorAll("p")[1] as HTMLElement;
    const mark = planLine.querySelector("[data-mark]");
    expect(mark, "the plan figure carries its «Sin dato» mark here").not.toBeNull();
    expect(classes(mark)).toContain("block");
    const word = [...planLine.querySelectorAll("span")].find((s) => s.textContent === "plan");
    expect(word, "the word «plan» is its own element").toBeDefined();
    expect(classes(word)).toContain("block");
  });

  it("the words of the marks do not change", async () => {
    await renderPanel();
    const marks = [...row("Margen bruto").querySelectorAll("[data-mark]")].map(
      (m) => m.textContent,
    );
    expect(marks.length).toBeGreaterThan(0);
    for (const t of marks) expect(t).toMatch(/^Sin dato · .+/);
  });
});

describe("CA-7c every column has its own minimum width", () => {
  it("the header and the body cells of the quarters carry min-w-44", async () => {
    const { container } = await renderPanel();
    const cells = [
      ...container.querySelectorAll("thead th:not(:first-child), tbody td:not(:first-child)"),
    ];
    expect(cells.length).toBeGreaterThan(0);
    for (const c of cells) expect(classes(c)).toContain("min-w-44");
  });
});

describe("CA-7d faded edge and current quarter in view", () => {
  const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
  const saved: Record<string, PropertyDescriptor | undefined> = {};
  let setLeft: number | null = null;
  let left = 0;
  const def = (name: string, d: PropertyDescriptor) => {
    saved[name] = Object.getOwnPropertyDescriptor(HTMLElement.prototype, name);
    Object.defineProperty(proto, name, { configurable: true, ...d });
  };
  const isScroller = (el: HTMLElement) => el.getAttribute("data-slot") === "scroll-fade";

  beforeEach(() => {
    setLeft = null;
    left = 0;
    def("clientWidth", {
      get() {
        return isScroller(this as HTMLElement) ? 400 : 0;
      },
    });
    def("scrollWidth", {
      get() {
        return isScroller(this as HTMLElement) ? 1000 : 0;
      },
    });
    def("offsetLeft", {
      get() {
        return (this as HTMLElement).hasAttribute("data-current") ? 600 : 0;
      },
    });
    def("offsetWidth", {
      get() {
        return (this as HTMLElement).hasAttribute("data-current") ? 150 : 0;
      },
    });
    def("scrollLeft", {
      get() {
        return left;
      },
      set(v: number) {
        if (isScroller(this as unknown as HTMLElement)) {
          setLeft = v;
          left = v;
        }
      },
    });
  });
  afterEach(() => {
    for (const [name, d] of Object.entries(saved)) {
      if (d) Object.defineProperty(proto, name, d);
      else delete proto[name];
    }
  });

  it("while there is more to the right the scroller fades its right edge", async () => {
    const { container } = await renderPanel();
    const scroller = container.querySelector('[data-slot="scroll-fade"]');
    expect(scroller).not.toBeNull();
    expect(scroller!.className).toContain("mask-image");
  });

  it("on mount the current quarter is centred: 600 - 400/2 + 150/2 = 475", async () => {
    await renderPanel();
    expect(setLeft).toBe(475);
  });

  it("after centring, content hidden to the left is signalled (gate finding 2)", async () => {
    const { container } = await renderPanel();
    const scroller = container.querySelector('[data-slot="scroll-fade"]') as HTMLElement;
    expect(scroller.getAttribute("data-start")).toBe("true");
    const sticky = [...container.querySelectorAll("tbody td:first-child, thead th:first-child")];
    expect(sticky.length).toBeGreaterThan(0);
    for (const c of sticky) expect(classes(c).join(" ")).toContain("[[data-start=true]_&]");
  });

  it("at the very start nothing is signalled to the left", async () => {
    def("scrollWidth", {
      get() {
        return isScroller(this as HTMLElement) ? 400 : 0;
      },
    });
    const { container } = await renderPanel();
    const scroller = container.querySelector('[data-slot="scroll-fade"]') as HTMLElement;
    expect(scroller.hasAttribute("data-start")).toBe(false);
  });
});
