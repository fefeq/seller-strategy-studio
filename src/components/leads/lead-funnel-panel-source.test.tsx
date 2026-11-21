// SDD-20261118-ux-legibilidad-pantallas-diarias · U-2 · CA-4 (render, gate finding 1): the «Origen» split of the lead
// funnel shows «manual» and «Manual» as ONE row. Fictional data, no network.
import { fireEvent, render, screen } from "@testing-library/react";
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

const lead = (id: string, source: string | null) => ({
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
  source,
});

describe("CA-4 the «Origen» split of the lead funnel", () => {
  it("«manual», «Manual» and « Manual » are one row of three leads, under its most frequent spelling", () => {
    h.leads = [
      lead("l1", "manual"),
      lead("l2", "Manual"),
      lead("l3", " Manual "),
      lead("l4", "Origen A"),
    ];
    const { container } = render(<LeadFunnelPanel quarter="2026-Q4" />);
    fireEvent.click(screen.getByRole("button", { name: "Origen" }));
    const rows = [...container.querySelectorAll("tbody tr")].map((tr) =>
      [...tr.querySelectorAll("td")].slice(0, 2).map((td) => td.textContent),
    );
    expect(rows).toEqual([
      ["Manual", "3"],
      ["Origen A", "1"],
    ]);
  });
  it("a lead without origin counts under «Sin origen»", () => {
    h.leads = [lead("l1", null), lead("l2", "")];
    const { container } = render(<LeadFunnelPanel quarter="2026-Q4" />);
    fireEvent.click(screen.getByRole("button", { name: "Origen" }));
    const rows = [...container.querySelectorAll("tbody tr")].map((tr) =>
      [...tr.querySelectorAll("td")].slice(0, 2).map((td) => td.textContent),
    );
    expect(rows).toEqual([["Sin origen", "2"]]);
  });
});
