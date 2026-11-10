// NK-0133 CA-2: the lead funnel writes its percentages with the es-ES decimal comma («33,3% del total»).
// Fictional data, no network.
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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

describe("lead funnel percentages use the decimal comma", () => {
  it("one lead of three that reached Contactado reads «33,3% del total»", () => {
    h.leads = [
      lead("l1", { stage: "contacted", contacted_at: "2026-11-03T00:00:00Z" }),
      lead("l2"),
      lead("l3"),
    ];
    const { container } = render(<LeadFunnelPanel quarter="2026-Q4" />);
    expect(screen.getAllByText(/33,3% del total/).length).toBeGreaterThan(0);
    expect(container.textContent).not.toMatch(/\d\.\d%/);
  });
});
