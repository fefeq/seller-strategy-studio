// NK-0093 walkthrough fix: /leads is never blank while loading and one load issues one leads request.
import { readFileSync } from "node:fs";
import { cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { leadsQuery, type LeadsData } from "@/hooks/use-leads";
import { LeadsPending } from "@/components/leads/leads-pending";

vi.mock("@/components/flow-strip", () => ({ FlowStrip: () => null }));

afterEach(cleanup);

describe("leadsQuery reuse", () => {
  it("does not refetch on mount the data the loader already fetched", async () => {
    const queryFn = vi.fn(async () => ({}) as LeadsData);
    const options = { ...leadsQuery("o1"), queryFn };
    const qc = new QueryClient();
    await qc.ensureQueryData(options);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useQuery(options), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await new Promise((r) => setTimeout(r, 30));
    expect(queryFn).toHaveBeenCalledTimes(1);
  });
});

describe("Leads pending state", () => {
  it("renders the loading state, not a blank page", () => {
    render(<LeadsPending />);
    expect(screen.getByRole("status")).toHaveAttribute("data-skeleton", "cards");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Leads");
  });

  it("is wired as the route pending component with no delay", () => {
    const src = readFileSync("src/routes/_authenticated/leads.index.tsx", "utf8");
    expect(src).toMatch(/pendingComponent:\s*LeadsPending/);
    expect(src).toMatch(/pendingMs:\s*0/);
  });
});
