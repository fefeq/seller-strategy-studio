// SDD field-actions-edit-delete-confirm, CA-12: in the AI fill, adding files keeps the ones already listed.
// The real component with fictitious files; the server function, Drive, router and toast are replaced.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ error: vi.fn() }));

vi.mock("@/hooks/use-me", () => ({ useMe: () => ({ data: { currentOrg: { website: "" }, roles: ["owner"] } }) }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (f: unknown) => f }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
}));
vi.mock("@/components/drive", () => ({ DriveSetupButton: () => null }));
vi.mock("@/lib/agent.functions", () => ({ applySetupItems: vi.fn(), extractSetup: vi.fn(), undoSetupItems: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: (m: string) => state.error(m) } }));

import { AiFill } from "./ai-fill";

const pdf = (name: string) => new File(["%PDF-1.4 prueba"], name, { type: "application/pdf" });
const add = (...files: File[]) => fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, { target: { files } });
const draw = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AiFill proposal={null} setProposal={() => {}} onWizard={() => {}} />
    </QueryClientProvider>,
  );

beforeEach(() => state.error.mockReset());
afterEach(cleanup);

describe("AiFill: adding files keeps the ones already listed (CA-12)", () => {
  it("two files added one after the other are both listed", async () => {
    draw();
    add(pdf("plan-negocio.pdf"));
    await waitFor(() => expect(screen.getByText(/plan-negocio\.pdf/)).toBeTruthy());
    add(pdf("deck-ventas.pdf"));
    await waitFor(() => expect(screen.getByText(/plan-negocio\.pdf, deck-ventas\.pdf/)).toBeTruthy());
  });

  it("past the 3 the server reads it keeps what was listed and says what was left out", async () => {
    draw();
    add(pdf("a.pdf"), pdf("b.pdf"));
    await waitFor(() => expect(screen.getByText(/a\.pdf, b\.pdf/)).toBeTruthy());
    add(pdf("c.pdf"), pdf("d.pdf"));
    await waitFor(() => expect(state.error).toHaveBeenCalled());
    expect(screen.getByText(/a\.pdf, b\.pdf, c\.pdf$/)).toBeTruthy();
    expect(state.error.mock.calls[0]?.[0]).toContain("d.pdf");
  });
});
