// NK-0181: behaviours of «Nokko lee» that only the gate probe fixed. Fictitious job and findings; the database is replaced.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Finding } from "@/lib/onboarding";

const state = vi.hoisted(() => ({
  job: { status: "done", step: null as string | null, error: null },
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.job }) }) }),
    }),
  },
}));
vi.mock("@/hooks/use-me", () => ({
  useMe: () => ({ data: { roles: ["owner"], user: { id: "user-ana" } } }),
}));
vi.mock("@/components/confirm-dialog", () => ({
  askConfirm: vi.fn(),
  askText: vi.fn(),
  askUnsaved: vi.fn(),
}));

import { ReadingStep } from "./reading";

afterEach(cleanup);
const at = "2026-11-13T10:00:00.000Z";
const F = (text: string, source: string, discardedAt?: string): Finding => ({
  at,
  text,
  source,
  ...(discardedAt ? { discardedAt } : {}),
});
const SOURCES = ["plan.pdf", "deck.pdf"];

function view(status: string, findings: Finding[], step: string | null = null) {
  state.job = { status, step, error: null };
  const qc = new QueryClient();
  const ui = (fs: Finding[]) => (
    <QueryClientProvider client={qc}>
      <ReadingStep
        jobId="job-1"
        findings={fs}
        sources={SOURCES}
        onNext={() => {}}
        onBack={() => {}}
        onChange={async () => {}}
      />
    </QueryClientProvider>
  );
  const r = render(ui(findings));
  return (fs: Finding[]) => r.rerender(ui(fs));
}

describe("ReadingStep (NK-0181)", () => {
  it("two open panels have unique ids, each linked to its button", async () => {
    view("done", [F("Vende a pymes", "plan.pdf"), F("Precio por asiento", "deck.pdf")]);
    const buttons = await screen.findAllByRole("button", { name: /1 hallazgo/ });
    buttons.forEach((b) => fireEvent.click(b));
    const panels = screen.getAllByTestId("source-findings");
    expect(panels).toHaveLength(2);
    const ids = panels.map((p) => p.id);
    expect(new Set(ids).size).toBe(2);
    expect(buttons.map((b) => b.getAttribute("aria-controls"))).toEqual(ids);
  });

  it("no helper text while the reading is still running", async () => {
    view("running", []);
    await screen.findByText("Estoy leyendo · esperando turno");
    expect(screen.queryAllByTestId("source-hint")).toHaveLength(0);
  });

  it("the source label can shrink (min-w-0) so long names wrap", async () => {
    view("done", []);
    const label = await screen.findByText("plan.pdf");
    expect(label.className).toContain("min-w-0");
  });

  it("a step starting with spaces and «Leyendo» does not repeat the word", async () => {
    view("running", [], "   Leyendo plan.pdf");
    expect(await screen.findByText("Estoy leyendo")).toBeTruthy();
  });

  it("restoring a discarded finding does not bring its panel back open", async () => {
    const rerender = view("done", [F("Vende a pymes", "plan.pdf")]);
    fireEvent.click(await screen.findByRole("button", { name: /1 hallazgo · plan\.pdf/ }));
    expect(screen.getAllByTestId("source-findings")).toHaveLength(1);
    await act(async () => rerender([F("Vende a pymes", "plan.pdf", at)]));
    await act(async () => rerender([F("Vende a pymes", "plan.pdf")]));
    expect(await screen.findByRole("button", { name: /1 hallazgo · plan\.pdf/ })).toBeTruthy();
    expect(screen.queryAllByTestId("source-findings")).toHaveLength(0);
  });
});
