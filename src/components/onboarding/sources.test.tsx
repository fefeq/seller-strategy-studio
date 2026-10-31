// SDD field-actions-edit-delete-confirm, CA-12: adding files to a list keeps the ones already listed.
// The real step with fictitious files; the router link, Drive, the background job and the toast are replaced.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ error: vi.fn() }));

vi.mock("@/hooks/use-me", () => ({ useMe: () => ({ data: { currentOrg: { website: "" } } }) }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (f: unknown) => f }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
}));
vi.mock("@/components/drive", () => ({ DriveSetupButton: () => null }));
vi.mock("@/lib/background.functions", () => ({ startBackgroundJob: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: (m: string) => state.error(m) } }));

import { MAX_FILES } from "@/lib/onboarding-sources";
import { SourcesStep } from "./sources";

const pdf = (name: string) => new File(["%PDF-1.4 prueba"], name, { type: "application/pdf" });
const add = (...files: File[]) =>
  fireEvent.change(document.getElementById("ob-files") as HTMLInputElement, { target: { files } });
const listed = () =>
  Array.from(document.querySelectorAll("ul li")).map((li) => li.textContent ?? "");

beforeEach(() => state.error.mockReset());
afterEach(cleanup);

describe("SourcesStep: adding files keeps the ones already listed (CA-12)", () => {
  it("two files added one after the other are both listed", async () => {
    render(<SourcesStep depth="express" onStarted={() => {}} />);
    add(pdf("plan-negocio.pdf"));
    await waitFor(() => expect(screen.getByText(/plan-negocio\.pdf/)).toBeTruthy());
    add(pdf("deck-ventas.pdf"));
    await waitFor(() => expect(screen.getByText(/deck-ventas\.pdf/)).toBeTruthy());
    expect(screen.getByText(/plan-negocio\.pdf/)).toBeTruthy();
    expect(listed().filter((t) => /\.pdf/.test(t))).toHaveLength(2);
  });

  it("adding the same file again does not list it twice", async () => {
    render(<SourcesStep depth="express" onStarted={() => {}} />);
    add(pdf("plan-negocio.pdf"));
    await waitFor(() => expect(screen.getByText(/plan-negocio\.pdf/)).toBeTruthy());
    add(pdf("plan-negocio.pdf"));
    await new Promise((r) => setTimeout(r, 50));
    expect(listed().filter((t) => /plan-negocio\.pdf/.test(t))).toHaveLength(1);
  });

  it("past the limit it keeps what was listed and says what was left out", async () => {
    render(<SourcesStep depth="express" onStarted={() => {}} />);
    const names = (from: number, n: number) =>
      Array.from({ length: n }, (_, k) => `doc-${from + k}.pdf`);
    // The step takes 3 files per selection; four selections go past MAX_FILES (10).
    for (const [from, n] of [
      [1, 3],
      [4, 3],
      [7, 3],
    ] as const) {
      add(...names(from, n).map(pdf));
      await waitFor(() =>
        expect(listed().filter((t) => /\.pdf/.test(t))).toHaveLength(from - 1 + n),
      );
    }
    add(...names(10, 3).map(pdf));
    await waitFor(() => expect(state.error).toHaveBeenCalled());
    expect(
      listed()
        .filter((t) => /\.pdf/.test(t))
        .map((t) => t.replace(/\s*pendiente.*$/, "")),
    ).toEqual(names(1, 10));
    expect(state.error.mock.calls[0]?.[0]).toMatch(/doc-11\.pdf, doc-12\.pdf/);
    expect(state.error.mock.calls[0]?.[0]).toContain(`${MAX_FILES} documentos`);
  });
});
