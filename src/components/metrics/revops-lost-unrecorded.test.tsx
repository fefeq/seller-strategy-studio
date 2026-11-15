// NK-0092: a lost deal with no recorded move to «lost» was charged to a guessed stage and could reach the headline.
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import type { RDeal, RHistory } from "@/lib/revops";

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

import { RevopsLost } from "@/components/metrics/revops-panels";

afterEach(cleanup);

const path = ["discovery", "proposal"];
const label = (k: string) => ({ discovery: "Descubrimiento", proposal: "Propuesta" })[k] ?? k;
const lost = (id: string, amount: number): RDeal => ({
  id,
  stage: "lost",
  amount,
  created_at: "2026-10-05T12:00:00Z",
  closed_at: "2026-10-20T12:00:00Z",
  source: "inbound",
  segment_id: null,
});
const wrap = (deals: RDeal[], history: RHistory[]) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RevopsLost deals={deals} history={history} path={path} label={label} quarter="2026-Q4" />
    </QueryClientProvider>,
  );

it("with no recorded stage the headline names none and the group has a name", () => {
  wrap([lost("a", 100), lost("b", 200)], []);
  expect(
    screen.getByText(/No hay registro de la etapa en la que se perdieron/),
  ).toBeInTheDocument();
  expect(screen.queryByText(/Donde más se pierden/)).toBeNull();
  expect(screen.getByText("Etapa sin registrar")).toBeInTheDocument();
  expect(document.body.textContent).not.toContain("unrecorded");
});

it("the headline names the recorded stage even when more deals have none", () => {
  wrap(
    [lost("a", 100), lost("b", 200), lost("c", 300)],
    [
      {
        deal_id: "c",
        from_stage: "proposal",
        to_stage: "lost",
        changed_at: "2026-10-20T12:00:00Z",
      },
    ],
  );
  expect(screen.getByText(/Donde más se pierden/).textContent).toContain("Propuesta");
  expect(screen.getByText("Etapa sin registrar")).toBeInTheDocument();
});
