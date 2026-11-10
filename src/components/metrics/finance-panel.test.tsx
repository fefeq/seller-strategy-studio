// SDD-20261109-metrics-sin-dato-rest · U-2 · CA-2: Finanzas says what is missing instead of «—». An empty quarter
// reads «Sin dato · motivo» in the real rows and «sin plan» in the budget rows; «Cobrado» is a real 0 only when
// invoices were issued in the quarter. Fictional data, no network.
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectDataMarks, expectNoBareDash } from "@/test/data-marks";
import type { FakeDb } from "@/test/metrics-mocks";

const db = vi.hoisted((): FakeDb => ({ tables: {} }));
vi.mock("@/integrations/supabase/client", async () =>
  (await import("@/test/metrics-mocks")).fakeSupabaseModule(db),
);
vi.mock("@tanstack/react-router", async () =>
  (await import("@/test/metrics-mocks")).fakeRouterModule(),
);
vi.mock("@/hooks/use-me", async () => (await import("@/test/metrics-mocks")).fakeUseMeModule());
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import { FinancePanel } from "@/components/metrics/finance-panel";

const show = async (invoices: object[] = []) => {
  db.tables = { finance_invoices: invoices };
  const out = render(
    <QueryClientProvider client={new QueryClient()}>
      <FinancePanel quarter="2026-Q4" />
    </QueryClientProvider>,
  );
  await screen.findByText("Últimos 4 trimestres");
  return out;
};
/** The cells of a row of the table «Últimos 4 trimestres», by its label. */
const cells = (label: string) => {
  const row = screen.getAllByRole("row").find((r) => r.firstElementChild?.textContent === label);
  expect(row, `row «${label}»`).toBeDefined();
  return [...row!.querySelectorAll("td")].slice(1).map((c) => c.textContent);
};
const all = (text: string) => [text, text, text, text];

beforeEach(() => {
  db.tables = {};
});

describe("CA-2 an empty quarter", () => {
  it("the real rows carry their «Sin dato · motivo» and the budget rows say «sin plan»", async () => {
    const { container } = await show();
    expect(cells("Ingresos reales")).toEqual(all("Sin dato · sin ingresos del trimestre"));
    expect(cells("Gasto real")).toEqual(all("Sin dato · sin costes apuntados"));
    expect(cells("· captación")).toEqual(all("Sin dato · sin costes apuntados"));
    expect(cells("· operativos")).toEqual(all("Sin dato · sin costes apuntados"));
    expect(cells("Margen")).toEqual(all("Sin dato · falta el ingreso real"));
    expect(cells("Margen %")).toEqual(all("Sin dato · falta el ingreso real"));
    expect(cells("ROI")).toEqual(all("Sin dato · falta ingreso o gasto"));
    expect(cells("Cobrado")).toEqual(all("Sin dato · sin cobros registrados"));
    expect(cells("Ingresos presupuestados")).toEqual(all("sin plan"));
    expect(cells("Gasto presupuestado")).toEqual(all("sin plan"));
    expect(cells("ROI presupuestado")).toEqual(all("sin plan"));
    expect(expectDataMarks(container).length).toBeGreaterThan(0);
    expectNoBareDash(container, []);
  });

  it("the five figures of the quarter say what is missing", async () => {
    const { container } = await show();
    const kpi = (label: string) =>
      screen.getByText(label, { selector: "p.eyebrow" }).parentElement!;
    expect(within(kpi("Presupuesto de gasto")).getByText("sin plan")).toBeInTheDocument();
    expect(
      within(kpi("Ingresos")).getByText("Sin dato · sin ingresos del trimestre"),
    ).toHaveAttribute("data-mark", "sin_dato");
    expect(within(kpi("Margen")).getByText("Sin dato · falta el ingreso real")).toHaveAttribute(
      "data-mark",
      "sin_dato",
    );
    expect(within(kpi("ROI")).getByText("Sin dato · falta ingreso o gasto")).toHaveAttribute(
      "data-mark",
      "sin_dato",
    );
    expectNoBareDash(container, []);
  });
});

describe("CA-2 «Cobrado»", () => {
  it("with invoices issued in the quarter and none paid it is a real 0", async () => {
    await show([{ id: "i1", amount: 100, issued_on: "2026-11-05", paid_on: null }]);
    const row = cells("Cobrado");
    expect(row[3]).toBe("0 €");
    expect(row.slice(0, 3)).toEqual(all("Sin dato · sin cobros registrados").slice(0, 3));
  });
  it("with a paid invoice it is the amount", async () => {
    await show([{ id: "i1", amount: 100, issued_on: "2026-11-05", paid_on: "2026-11-20" }]);
    expect(cells("Cobrado")[3]).toBe("100 €");
  });
});
