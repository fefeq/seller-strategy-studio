// SDD-20261118-ux-legibilidad-pantallas-diarias · U-1 · CA-1, CA-2: the primary line note names the archetype once
// when the line carries the archetype's own name. Fictional data, no network.
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  primary: null as null | {
    label: string;
    result: { archetype: string; name: string };
    extra: number;
  },
}));

vi.mock("@tanstack/react-router", async () =>
  (await import("@/test/metrics-mocks")).fakeRouterModule(),
);
vi.mock("@/hooks/use-me", async () => (await import("@/test/metrics-mocks")).fakeUseMeModule());
vi.mock("@/hooks/use-business-lines", () => ({
  usePrimaryLine: () => ({ isLoading: false, error: null, primary: state.primary }),
}));

import { PrimaryLineNote } from "@/components/primary-line-note";

const text = (c: HTMLElement) => (c.textContent ?? "").replace(/\s+/g, " ").trim();
const count = (haystack: string, needle: string) => haystack.split(needle).length - 1;

beforeEach(() => {
  state.primary = null;
});

describe("CA-1 the archetype name is not repeated", () => {
  it("the line is called as its archetype: the name shows once and «arquetipo B» stays", () => {
    state.primary = {
      label: "Mid-market híbrido",
      result: { archetype: "B", name: "Mid-market híbrido" },
      extra: 0,
    };
    const { container } = render(<PrimaryLineNote />);
    const t = text(container);
    expect(count(t, "Mid-market híbrido")).toBe(1);
    expect(t).toContain("arquetipo B");
  });

  it("the comparison ignores case, spaces and extra whitespace", () => {
    state.primary = {
      label: "  mid-market   HÍBRIDO ",
      result: { archetype: "B", name: "Mid-market híbrido" },
      extra: 0,
    };
    const { container } = render(<PrimaryLineNote />);
    expect(count(text(container).toLowerCase(), "mid-market")).toBe(1);
  });

  it("a differently named line shows both names, as before", () => {
    state.primary = {
      label: "Línea ficticia",
      result: { archetype: "B", name: "Mid-market híbrido" },
      extra: 0,
    };
    const { container } = render(<PrimaryLineNote />);
    const t = text(container);
    expect(t).toContain("Línea ficticia");
    expect(t).toContain("arquetipo B, Mid-market híbrido");
  });

  it("keeps «N líneas más» and the «Editar líneas» link for a leader", () => {
    state.primary = {
      label: "Mid-market híbrido",
      result: { archetype: "B", name: "Mid-market híbrido" },
      extra: 2,
    };
    const { container } = render(<PrimaryLineNote />);
    const t = text(container);
    expect(t).toContain("2 líneas más");
    expect(t).toContain("Editar líneas");
    expect(count(t, "Mid-market híbrido")).toBe(1);
  });
});

describe("CA-2 without a primary line nothing changes", () => {
  it("shows the notice and the «Defínela» link", () => {
    const { container } = render(<PrimaryLineNote />);
    expect(text(container)).toContain("Aún no hay línea de negocio principal.");
    expect(text(container)).toContain("Defínela");
  });
});
