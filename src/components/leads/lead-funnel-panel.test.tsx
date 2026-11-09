// SDD-20261109-metrics-sin-dato-rest · U-4 · CA-4: the lead funnel says «Sin dato · ningún lead llegó a esta etapa»
// where no lead reached a step, instead of «—». Fictional data, no network.
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { expectDataMarks, expectNoBareDash } from "@/test/data-marks";

const h = vi.hoisted(() => ({ leads: [] as Record<string, unknown>[] }));
vi.mock("@tanstack/react-router", async () =>
  (await import("@/test/metrics-mocks")).fakeRouterModule(),
);
vi.mock("@/hooks/use-me", async () => (await import("@/test/metrics-mocks")).fakeUseMeModule());
vi.mock("@/hooks/use-leads", async () => {
  const { DEFAULT_LEAD_SLA } = await import("@/lib/lead-funnel");
  return {
    useLeads: () => ({
      data: {
        leads: h.leads,
        deals: [],
        segments: [{ id: "s1", name: "Segmento ficticio" }],
        sla: DEFAULT_LEAD_SLA,
        members: [],
      },
      isPending: false,
      error: null,
      refetch: vi.fn(),
    }),
  };
});

import { LeadFunnelPanel } from "@/components/leads/lead-funnel-panel";

const lead = (id: string, o: Record<string, unknown> = {}) => ({
  id,
  stage: "new",
  created_at: "2026-11-02T00:00:00Z",
  stage_entered_at: "2026-11-02T00:00:00Z",
  contacted_at: null,
  mql_at: null,
  sql_at: null,
  opportunity_at: null,
  next_step_at: null,
  deal_id: null,
  segment_id: "s1",
  source: null,
  ...o,
});
const card = (label: string) => screen.getByText(label, { selector: "p.eyebrow" }).parentElement!;
const NONE = "Sin dato · ningún lead llegó a esta etapa";

describe("CA-4 median days of a step nobody reached", () => {
  it("all four cards carry the mark and no dash remains", () => {
    h.leads = [lead("l1"), lead("l2")];
    const { container } = render(<LeadFunnelPanel quarter="2026-Q4" />);
    for (const label of ["Hasta MQL", "Hasta SQL", "Hasta oportunidad", "Hasta ganado"])
      expect(within(card(label)).getByText(NONE)).toHaveAttribute("data-mark", "sin_dato");
    expect(expectDataMarks(container)).toEqual([NONE, NONE, NONE, NONE]);
    expectNoBareDash(container, []);
  });
  it("a step some lead reached shows its days, the others keep the mark", () => {
    h.leads = [
      lead("l1", {
        stage: "mql",
        contacted_at: "2026-11-03T00:00:00Z",
        mql_at: "2026-11-04T00:00:00Z",
      }),
    ];
    const { container } = render(<LeadFunnelPanel quarter="2026-Q4" />);
    expect(within(card("Hasta MQL")).getByText("2.0 d")).toBeInTheDocument();
    expect(within(card("Hasta SQL")).getByText(NONE)).toBeInTheDocument();
    expect(expectDataMarks(container)).toEqual([NONE, NONE, NONE]);
  });
});
