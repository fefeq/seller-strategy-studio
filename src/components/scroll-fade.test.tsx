// SDD-20261118-ux-legibilidad-pantallas-diarias · U-4 · CA-7d (gate round 2): ScrollFade cleans up after itself and
// watches its content, not only its box. Fictional content, jsdom with a stub ResizeObserver.
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScrollFade } from "@/components/scroll-fade";

const observed: Element[] = [];
const disconnect = vi.fn();
class FakeRO {
  constructor(public cb: () => void) {}
  observe(el: Element) {
    observed.push(el);
  }
  disconnect = disconnect;
  unobserve() {}
}

beforeEach(() => {
  observed.length = 0;
  disconnect.mockClear();
  vi.stubGlobal("ResizeObserver", FakeRO);
});
afterEach(() => vi.unstubAllGlobals());

describe("ScrollFade lifecycle", () => {
  it("observes the scroller and its content, so a table that grows later updates the edges", () => {
    const { container } = render(
      <ScrollFade>
        <table data-testid="t" />
      </ScrollFade>,
    );
    const scroller = container.querySelector('[data-slot="scroll-fade"]')!;
    expect(observed).toContain(scroller);
    expect(observed).toContain(scroller.firstElementChild);
  });

  it("on unmount it disconnects the observer and removes its scroll listener", () => {
    const add = vi.spyOn(HTMLElement.prototype, "addEventListener");
    const remove = vi.spyOn(HTMLElement.prototype, "removeEventListener");
    const { unmount } = render(
      <ScrollFade>
        <table />
      </ScrollFade>,
    );
    // React adds its own scroll listeners on the root; ours is the one called `update`.
    const added = add.mock.calls
      .filter((c) => c[0] === "scroll" && (c[1] as { name?: string }).name === "update")
      .map((c) => c[1]);
    expect(added.length).toBeGreaterThan(0);
    unmount();
    expect(disconnect).toHaveBeenCalled();
    const removed = remove.mock.calls.filter((c) => c[0] === "scroll").map((c) => c[1]);
    for (const handler of added) expect(removed).toContain(handler);
    add.mockRestore();
    remove.mockRestore();
  });

  it("works without ResizeObserver (older browsers, jsdom)", () => {
    vi.unstubAllGlobals();
    vi.stubGlobal("ResizeObserver", undefined);
    expect(() =>
      render(
        <ScrollFade>
          <table />
        </ScrollFade>,
      ),
    ).not.toThrow();
  });

  it("does not move the scroll when nothing overflows", () => {
    const { container } = render(
      <ScrollFade>
        <table>
          <thead>
            <tr>
              <th data-current="">2026-Q4</th>
            </tr>
          </thead>
        </table>
      </ScrollFade>,
    );
    expect((container.querySelector('[data-slot="scroll-fade"]') as HTMLElement).scrollLeft).toBe(
      0,
    );
  });

  describe("centring the current element only on narrow screens (gate round 2, SDD §6)", () => {
    const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
    let left = 0;
    const saved: Record<string, PropertyDescriptor | undefined> = {};
    const def = (name: string, d: PropertyDescriptor) => {
      saved[name] = Object.getOwnPropertyDescriptor(HTMLElement.prototype, name);
      Object.defineProperty(proto, name, { configurable: true, ...d });
    };
    const mine = (el: HTMLElement) => el.getAttribute("data-slot") === "scroll-fade";
    const table = (
      <ScrollFade>
        <table>
          <thead>
            <tr>
              <th data-current="">2026-Q4</th>
            </tr>
          </thead>
        </table>
      </ScrollFade>
    );
    beforeEach(() => {
      left = 0;
      def("clientWidth", {
        get() {
          return mine(this as HTMLElement) ? 400 : 0;
        },
      });
      def("scrollWidth", {
        get() {
          return mine(this as HTMLElement) ? 1000 : 0;
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
          if (mine(this as unknown as HTMLElement)) left = v;
        },
      });
    });
    afterEach(() => {
      for (const [name, d] of Object.entries(saved)) {
        if (d) Object.defineProperty(proto, name, d);
        else delete proto[name];
      }
      vi.unstubAllGlobals();
    });

    it("on a wide screen (md and up) it leaves the scroll at the start", () => {
      vi.stubGlobal("matchMedia", () => ({ matches: false }));
      render(table);
      expect(left).toBe(0);
    });
    it("on a narrow screen it centres the current element", () => {
      vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("max-width: 767px") }));
      render(table);
      expect(left).toBe(475);
    });
  });
});
