// SDD-20261109-metrics-sin-dato-rest · U-4 · CA-4: the Self-service funnel says what is missing instead of «—»
// (no sign-ups, nobody activated, no purchases). Fictional data, no network.
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
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

import { SelfServiceFunnel } from "@/components/self-service-funnel";

const trial = (o: Record<string, unknown>) => ({
  id: "t1",
  segment_id: "s1",
  signed_up_at: "2026-11-02T10:00:00Z",
  activated_at: null,
  converted_at: null,
  mrr: null,
  source: "Manual",
  ...o,
});
const show = async (trials: object[]) => {
  db.tables = { trials, segments: [{ id: "s1", name: "Segmento ficticio" }] };
  const out = render(
    <QueryClientProvider client={new QueryClient()}>
      <SelfServiceFunnel quarter="2026-Q4" />
    </QueryClientProvider>,
  );
  await screen.findByText("Funnel self-service 2026-Q4");
  await screen.findByText("Activación", { selector: "p.eyebrow" });
  return out;
};
const kpi = (label: string) => screen.getByText(label, { selector: "p.eyebrow" }).parentElement!;

describe("CA-4 no sign-ups in the period", () => {
  it("Activación and Prueba → pago say «Sin dato · sin registros en el periodo»; no dash", async () => {
    const { container } = await show([]);
    for (const label of ["Activación", "Prueba → pago"])
      expect(
        within(kpi(label)).getByText("Sin dato · sin registros en el periodo"),
      ).toHaveAttribute("data-mark", "sin_dato");
    expect(
      within(kpi("Tiempo hasta la compra")).getByText("Sin dato · sin compras"),
    ).toHaveAttribute("data-mark", "sin_dato");
    expectDataMarks(container);
    expectNoBareDash(container, []);
  });
  it("the hints say «sin dato» inside the text", async () => {
    await show([]);
    expect(
      within(kpi("Tiempo hasta la compra")).getByText("Mediana · activación en sin dato"),
    ).toBeInTheDocument();
    expect(
      within(kpi("Prueba → pago")).getByText("0 clientes · activados → pago: sin activados"),
    ).toBeInTheDocument();
  });
});

describe("CA-4 sign-ups but nobody activated or bought", () => {
  it("the table says «Sin dato · sin activados» and «Sin dato · sin compras»", async () => {
    const { container } = await show([trial({})]);
    const row = screen.getByText("Segmento ficticio").closest("tr")!;
    const cells = [...row.querySelectorAll("td")].map((c) => c.textContent);
    expect(cells[4]).toBe("Sin dato · sin activados");
    expect(cells[5]).toBe("Sin dato · sin compras");
    expect(
      within(kpi("Tiempo hasta la compra")).getByText("Mediana · activación en sin dato"),
    ).toBeInTheDocument();
    expectNoBareDash(container, []);
  });
});

describe("CA-4 a complete funnel", () => {
  it("shows its figures and no mark", async () => {
    const { container } = await show([
      trial({
        activated_at: "2026-11-03T10:00:00Z",
        converted_at: "2026-11-12T10:00:00Z",
        mrr: 50,
      }),
    ]);
    expect(container.querySelectorAll("[data-mark]")).toHaveLength(0);
    expect(within(kpi("Tiempo hasta la compra")).getByText("10.0 d")).toBeInTheDocument();
    expectNoBareDash(container, []);
  });
});
