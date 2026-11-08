// SDD-20261106-metrics-honest-data · U-2 · CA-1 (texts), CA-2: Embudo and Perdidos speak about the selected
// quarter when empty; Cohortes and Tendencias say their window does not depend on the quarter. Fictional data.
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { RDeal } from "@/lib/revops";

vi.mock("@/integrations/supabase/client", () => {
  const chain = (): object =>
    new Proxy(
      {},
      {
        get: (_t, p) =>
          p === "then"
            ? (f: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(f)
            : () => chain(),
      },
    );
  return { supabase: { from: () => chain() } };
});
vi.mock("@/hooks/use-me", () => ({
  useMe: () => ({ data: { roles: ["owner"], currentOrg: { org_id: "o1", currency: "EUR" } } }),
  useCurrency: () => ({ currency: "EUR", symbol: "€", money: (n: number) => `${n} €` }),
}));

import {
  RevopsCohorts,
  RevopsFunnel,
  RevopsLost,
  RevopsTrends,
} from "@/components/metrics/revops-panels";

beforeAll(() => {
  // recharts' ResponsiveContainer needs it; jsdom has none.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

const wrap = (ui: React.ReactNode) =>
  render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);
const path = ["discovery", "demo", "proposal"];
const label = (k: string) => k;
const deal: RDeal = {
  id: "d1",
  stage: "won",
  amount: 1000,
  created_at: "2025-03-01T10:00:00Z",
  closed_at: "2025-04-01T10:00:00Z",
  source: null,
  segment_id: null,
};

describe("CA-1 empty texts with the quarter", () => {
  it("Embudo without deals created in T", () => {
    wrap(<RevopsFunnel deals={[]} history={[]} path={path} label={label} quarter="2026-Q4" />);
    expect(screen.getByText("Sin deals creados en 2026-Q4")).toBeInTheDocument();
    expect(screen.queryByText(/Aún no hay deals/)).toBeNull();
  });
  it("Perdidos without lost deals in T", () => {
    wrap(<RevopsLost deals={[]} history={[]} path={path} label={label} quarter="2026-Q4" />);
    expect(screen.getByText("Ningún deal perdido en 2026-Q4")).toBeInTheDocument();
    expect(screen.queryByText(/todavía/)).toBeNull();
  });
});

describe("CA-2 windows that do not depend on the quarter", () => {
  it("Cohortes says «Todo el histórico · no depende del trimestre»", () => {
    wrap(<RevopsCohorts deals={[deal]} />);
    expect(screen.getByText("Todo el histórico · no depende del trimestre")).toBeInTheDocument();
  });
  it("Tendencias says «Últimas 12 semanas · no depende del trimestre»", () => {
    wrap(<RevopsTrends deals={[deal]} />);
    expect(screen.getByText("Últimas 12 semanas · no depende del trimestre")).toBeInTheDocument();
  });
});
