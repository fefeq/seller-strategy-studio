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

import { startBackgroundJob } from "@/lib/background.functions";
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
    const per = 3; // selection size (equals MAX_FILES); the partial-fit case is covered in src/lib/onboarding-sources.test.ts
    const shown = () =>
      listed()
        .filter((t) => /\.pdf/.test(t))
        .map((t) => t.replace(/\s*pendiente.*$/, ""));
    // D-S8-2: derived from MAX_FILES, not a literal. Selections that still fit accumulate...
    let have = 0;
    while (have + per <= MAX_FILES) {
      add(...names(have + 1, per).map(pdf));
      have += per;
      await waitFor(() => expect(shown()).toHaveLength(have));
    }
    // ...and the next selection goes past MAX_FILES.
    const last = names(have + 1, per);
    add(...last.map(pdf));
    await waitFor(() => expect(state.error).toHaveBeenCalled());
    const all = [...names(1, have), ...last];
    expect(shown()).toEqual(all.slice(0, MAX_FILES));
    const dropped = all.slice(MAX_FILES);
    expect(state.error.mock.calls[0]?.[0]).toContain(dropped.join(", "));
    expect(state.error.mock.calls[0]?.[0]).toContain(`${MAX_FILES} documentos`);
  });
});

describe("SourcesStep: «Hacer solo el diagnóstico» (NK-0009 CA-4)", () => {
  it("calls onSkip and never starts a reading", () => {
    const onSkip = vi.fn();
    const onStarted = vi.fn();
    vi.mocked(startBackgroundJob).mockClear();
    render(<SourcesStep depth="express" onStarted={onStarted} onSkip={onSkip} />);
    fireEvent.click(screen.getByRole("button", { name: "Hacer solo el diagnóstico" }));
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(startBackgroundJob).not.toHaveBeenCalled();
    expect(onStarted).not.toHaveBeenCalled();
  });

  it("is enabled with no sources and explains what is left for later", () => {
    render(<SourcesStep depth="express" onStarted={() => {}} onSkip={() => {}} />);
    expect(
      (screen.getByRole("button", { name: "Hacer solo el diagnóstico" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    expect(
      screen.getByText(
        "Sin fuentes, Nokko no te propone ICP ni posicionamiento: los completas después en Estrategia.",
      ),
    ).toBeTruthy();
  });
});
