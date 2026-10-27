// SDD-20261027 F4 on the screen: the review panel (CA-40, CA-43..CA-46). Fictional data; supabase and the server function are mocked.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildStrategySuggestion } from "@/lib/strategy-suggestions";

const h = vi.hoisted(() => ({
  roles: ["owner"] as string[],
  last: null as Record<string, unknown> | null,
  run: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => {
  const chain = (): object =>
    new Proxy(
      {},
      {
        get: (_t, p) =>
          p === "then"
            ? (f: (v: unknown) => unknown) => Promise.resolve({ data: h.last, error: null }).then(f)
            : () => chain(),
      },
    );
  return { supabase: { from: () => chain() } };
});
vi.mock("@/hooks/use-me", () => ({
  useMe: () => ({ data: { user: { id: "u1" }, roles: h.roles, currentOrg: { org_id: "o1" } } }),
}));
vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-start")>()),
  useServerFn: (f: unknown) => f,
}));
vi.mock("@/lib/strategy.functions", () => ({ requestStrategyReview: h.run }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

import { StrategyReviewPanel } from "@/components/strategy-review";

const sug = buildStrategySuggestion({
  element: "icp",
  kind: "change",
  action_type: "strategy_change",
  cause: "review:1",
  priority: 2,
  title: "Revisa el ICP de SaaS",
  body: "Dos pérdidas. Lo invalidaría: si bajan.",
  evidence: [{ table: "deals", id: "d1", label: "Deal 1" }],
});
const wrap = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <StrategyReviewPanel />
    </QueryClientProvider>,
  );
beforeEach(() => {
  h.roles = ["owner"];
  h.last = null;
  h.run.mockReset();
});

describe("StrategyReviewPanel", () => {
  it("shows nothing but a notice to roles that may not ask (CA-40)", () => {
    h.roles = ["ae"];
    wrap();
    expect(screen.queryByRole("button", { name: /pedir revisión/i })).toBeNull();
    expect(screen.getByText(/Owner y el Sales Leader/)).toBeTruthy();
  });
  it("asks with the normal mode and low effort by default, and «A fondo» only when ticked (CA-43, SDD uso de LLM)", async () => {
    h.run.mockResolvedValue({
      status: "fresh",
      notice: null,
      created_at: "2026-10-27T10:00:00Z",
      suggestions: [],
    });
    wrap();
    fireEvent.click(screen.getByRole("button", { name: /pedir revisión/i }));
    await waitFor(() =>
      expect(h.run).toHaveBeenCalledWith({ data: { mode: "normal", depth: "low" } }),
    );
    fireEvent.click(screen.getByLabelText(/revisión crítica/i));
    fireEvent.click(screen.getByLabelText(/a fondo/i));
    fireEvent.click(screen.getByRole("button", { name: /pedir revisión/i }));
    await waitFor(() =>
      expect(h.run).toHaveBeenLastCalledWith({ data: { mode: "critical", depth: "medium" } }),
    );
  });
  it("shows the last review with level, evidence and the notice when the data did not change (CA-41, CA-44)", async () => {
    h.last = {
      created_at: "2026-10-26T10:00:00Z",
      mode: "normal",
      depth: "low",
      suggestions: [sug],
    };
    h.run.mockResolvedValue({
      status: "reused",
      notice:
        "Los datos no han cambiado desde la última revisión: te mostramos esa, sin gastar IA.",
      created_at: "2026-10-26T10:00:00Z",
      suggestions: [sug],
    });
    wrap();
    expect(await screen.findByText("Revisa el ICP de SaaS")).toBeTruthy();
    expect(screen.getByText(/Evidencia:/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /pedir revisión/i }));
    expect(await screen.findByText(/no han cambiado/i)).toBeTruthy();
  });
  it("keeps the last review on screen and explains the failure (CA-45, CA-46)", async () => {
    h.last = {
      created_at: "2026-10-26T10:00:00Z",
      mode: "normal",
      depth: "low",
      suggestions: [sug],
    };
    h.run.mockRejectedValue(new Error("Failed to fetch"));
    wrap();
    await screen.findByText("Revisa el ICP de SaaS");
    fireEvent.click(screen.getByRole("button", { name: /pedir revisión/i }));
    await waitFor(() => expect(h.run).toHaveBeenCalled());
    expect(screen.getByText("Revisa el ICP de SaaS")).toBeTruthy();
  });
});
