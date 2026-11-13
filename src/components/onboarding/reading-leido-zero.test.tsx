// NK-0156 rework: a source with no findings must not render a stray «0» (React prints a bare number 0).
import { cleanup, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Finding } from "@/lib/onboarding";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { status: "done", step: null, error: null } }),
        }),
      }),
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

const findings: Finding[] = [
  { at: "2026-11-12T10:00:00Z", text: "Vendes software a pymes.", source: "plan.pdf" },
];

async function renderDone(sources: string[]) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ReadingStep
        jobId="job-1"
        findings={findings}
        sources={sources}
        onNext={() => {}}
        onBack={() => {}}
        onSkip={() => {}}
        onChange={async () => {}}
      />
    </QueryClientProvider>,
  );
  await screen.findByRole("button", { name: "Seguir a tu diagnóstico" });
  return within(screen.getByRole("list", { name: "Fuentes" })).getAllByRole("listitem");
}

describe("source rows with no findings", () => {
  it("do not render a bare 0 after the support text", async () => {
    const rows = await renderDone(["plan.pdf", "notas.pdf"]);
    const empty = rows.find((r) => r.textContent?.includes("Sin hallazgos propios"))!;
    expect(empty).toBeTruthy();
    expect(empty.textContent).toContain("No atribuí ningún hallazgo a esta fuente por separado.");
    expect(empty.textContent).not.toMatch(/separado\.\s*0/);
    expect(empty.innerHTML).not.toMatch(/<\/p>\s*0\s*$/);
    for (const r of rows) expect(r.textContent).not.toContain("0 hallazgos");
  });

  it("never end a row with a stray digit when the count is 0", async () => {
    const rows = await renderDone(["plan.pdf", "notas.pdf", "otro.pdf"]);
    const zero = rows.filter((r) => r.textContent?.includes("Sin hallazgos propios"));
    expect(zero).toHaveLength(2);
    for (const r of zero) expect(r.textContent).not.toMatch(/\d\s*$/);
  });
});
