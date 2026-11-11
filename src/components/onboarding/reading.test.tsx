// NK-0009 CA-4: a failed reading offers «Hacer solo el diagnóstico». The real step with a fictitious job; the database is replaced.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ job: { status: "failed", step: null, error: "La web no responde." } as { status: string; step: string | null; error: string | null } }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.job }) }) }) }) },
}));
vi.mock("@/hooks/use-me", () => ({ useMe: () => ({ data: { roles: ["owner"], user: { id: "user-ana" } } }) }));
vi.mock("@/components/confirm-dialog", () => ({ askConfirm: vi.fn(), askText: vi.fn(), askUnsaved: vi.fn() }));

import { ReadingStep } from "./reading";

afterEach(cleanup);

function show(status: string, onSkip = vi.fn()) {
  state.job = { status, step: null, error: status === "failed" ? "La web no responde." : null };
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ReadingStep jobId="job-1" findings={[]} sources={["Web · https://ejemplo.test"]} onNext={() => {}} onBack={() => {}} onSkip={onSkip} onChange={async () => {}} />
    </QueryClientProvider>,
  );
  return onSkip;
}

describe("ReadingStep: «Hacer solo el diagnóstico» (NK-0009 CA-4)", () => {
  it("is offered when the job failed and calls onSkip", async () => {
    const onSkip = show("failed");
    fireEvent.click(await screen.findByRole("button", { name: "Hacer solo el diagnóstico" }));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("is offered when the job was cancelled", async () => {
    show("cancelled");
    expect(await screen.findByRole("button", { name: "Hacer solo el diagnóstico" })).toBeTruthy();
  });

  it("is not offered when the reading is done (the normal button leads to the diagnosis)", async () => {
    show("done");
    expect(await screen.findByRole("button", { name: "Seguir a tu diagnóstico" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Hacer solo el diagnóstico" })).toBeNull();
  });
});
