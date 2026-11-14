import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { useState } from "react";
import type { Finding } from "@/lib/onboarding";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { status: "done" } }) }) }) }) } }));
vi.mock("@/hooks/use-me", () => ({ useMe: () => ({ data: { roles: ["owner"], user: { id: "reviewer" } } }) }));
import { ReadingStep } from "./reading";
afterEach(cleanup);
const initial: Finding[] = [
  { text: "Cliente objetivo sintético", source: "plan.md", at: "2026-11-14T00:00:00Z" },
  { text: "Segundo dato sintético", source: "plan.md", at: "2026-11-14T00:00:00Z" },
];
function show(save: (patch: { findings?: Finding[]; sources?: string[] }) => void) {
  function Harness() {
    const [findings, setFindings] = useState(initial);
    return <ReadingStep jobId="synthetic-job" findings={findings} sources={["plan.md"]} onNext={() => {}} onBack={() => {}} onChange={async patch => { save(patch); if (patch.findings) setFindings(patch.findings); }} />;
  }
  render(<QueryClientProvider client={new QueryClient()}><Harness /></QueryClientProvider>);
}
it("CA-1 confirms only the selected finding", async () => {
  const save = vi.fn(); show(save);
  const buttons = await screen.findAllByRole("button", { name: "Confirmar" });
  fireEvent.click(buttons[0] as HTMLElement);
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  const fs = save.mock.calls[0]?.[0].findings as Finding[];
  expect(fs[0]?.confirmedBy).toBe("reviewer");
  expect(fs[1]?.confirmedAt).toBeUndefined();
});
it("CA-2 restores an excluded finding without confirming it", async () => {
  const save = vi.fn(); show(save);
  const buttons = await screen.findAllByRole("button", { name: "Descartar" });
  fireEvent.click(buttons[0] as HTMLElement);
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  expect(save.mock.calls[0]?.[0].findings[0].discardedAt).toEqual(expect.any(String));
  fireEvent.click(await screen.findByRole("button", { name: "Recuperar" }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(save.mock.calls[1]?.[0].findings[0].discardedAt).toBeUndefined();
  expect(save.mock.calls[1]?.[0].findings[0].confirmedAt).toBeUndefined();
});