// NK-0133 CA-2: Cobertura writes its multiples with the es-ES decimal comma («2,5x», never «2.5x»), in the total and on
// each segment card. Fictional data, no network.
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { dealRow, segRow, type FakeDb } from "@/test/metrics-mocks";

const db = vi.hoisted((): FakeDb => ({ tables: {} }));
vi.mock("@/integrations/supabase/client", async () =>
  (await import("@/test/metrics-mocks")).fakeSupabaseModule(db),
);
vi.mock("@tanstack/react-router", async () =>
  (await import("@/test/metrics-mocks")).fakeRouterModule(),
);
vi.mock("@/hooks/use-me", async () => (await import("@/test/metrics-mocks")).fakeUseMeModule());

import { SegmentCoverage } from "@/components/segment-coverage";

db.tables = {
  segments: [segRow({ id: "a", name: "Segmento ficticio" })],
  deals: [dealRow({ segment_id: "a", amount: 25000, stage: "demo", close_date: "2026-12-01" })],
  cac_costs: [],
  segment_targets: [{ segment_id: "a", amount: 10000 }],
  segment_budget_quarters: [],
};

describe("Cobertura multiples use the decimal comma", () => {
  it("the total and the segment card say 2,5x", async () => {
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <SegmentCoverage quarter="2026-Q4" />
      </QueryClientProvider>,
    );
    await screen.findByText("Segmento ficticio");
    expect(screen.getByText("2,5x total")).toBeInTheDocument();
    expect(screen.getAllByText("2,5x").length).toBeGreaterThan(0);
    expect(container.textContent).not.toMatch(/\d\.\dx/);
  });
});
