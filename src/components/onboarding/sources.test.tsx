// SDD field-actions-edit-delete-confirm, CA-12: adding files to a list keeps the ones already listed.
// The real step with fictitious files; the router link, Drive, the background job and the toast are replaced.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ error: vi.fn(), info: vi.fn(), uploads: [] as string[] }));

vi.mock("@/hooks/use-me", () => ({
  useMe: () => ({ data: { user: { id: "user-1" }, currentOrg: { org_id: "org-1", website: "" } } }),
}));
// Uploads go straight to the private bucket (Fase 1); here every upload succeeds and is recorded.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: async (path: string) => (state.uploads.push(path), { error: null }),
        remove: async () => ({ error: null }),
      }),
    },
  },
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (f: unknown) => f }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
}));
// The Drive picker hands back { id, name }; a button per fictitious document stands in for it.
vi.mock("@/components/drive", () => ({
  DriveSetupButton: () => null,
  DriveRefButton: ({ onPick }: { onPick: (f: { id: string; name: string }) => void }) => (
    <>
      <button onClick={() => onPick({ id: "drv-1", name: "brief" })}>drive-1</button>
      <button onClick={() => onPick({ id: "drv-2", name: "brief" })}>drive-2</button>
    </>
  ),
}));
vi.mock("@/lib/background.functions", () => ({ startBackgroundJob: vi.fn() }));
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: (m: string) => state.error(m),
    info: (m: string) => state.info(m),
  },
}));

import { startBackgroundJob } from "@/lib/background.functions";
import { MAX_SOURCES } from "@/lib/onboarding-files-limit";
import { SourcesStep } from "./sources";

const pdf = (name: string) => new File(["%PDF-1.4 prueba"], name, { type: "application/pdf" });
const add = (...files: File[]) =>
  fireEvent.change(document.getElementById("ob-files") as HTMLInputElement, { target: { files } });
const listed = () =>
  Array.from(document.querySelectorAll("ul li")).map((li) => li.textContent ?? "");

beforeEach(() => {
  state.error.mockReset();
  state.info.mockReset();
  state.uploads.length = 0;
});
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
    // New contract: each one is uploaded once to the company's own folder and kept as a storage reference.
    await waitFor(() => expect(state.uploads).toHaveLength(2));
    expect(state.uploads.every((p) => p.startsWith("org-1/user-1/"))).toBe(true);
    // A Drive document joins the list without replacing the files.
    fireEvent.click(screen.getByRole("button", { name: "drive-1" }));
    await waitFor(() => expect(screen.getByText(/brief \(Drive\)/)).toBeTruthy());
    expect(listed()).toHaveLength(3);
  });

  it("adding the same file again does not list it twice", async () => {
    render(<SourcesStep depth="express" onStarted={() => {}} />);
    add(pdf("plan-negocio.pdf"));
    await waitFor(() => expect(screen.getByText(/plan-negocio\.pdf/)).toBeTruthy());
    add(pdf("plan-negocio.pdf"));
    await new Promise((r) => setTimeout(r, 50));
    expect(listed().filter((t) => /plan-negocio\.pdf/.test(t))).toHaveLength(1);
    expect(state.uploads).toHaveLength(1);
    expect(state.info).toHaveBeenCalledWith("Ya estaba en la lista: plan-negocio.pdf.");
    // Same kind + same Drive id is the same source; another id with the same name is a different one.
    fireEvent.click(screen.getByRole("button", { name: "drive-1" }));
    fireEvent.click(screen.getByRole("button", { name: "drive-1" }));
    fireEvent.click(screen.getByRole("button", { name: "drive-2" }));
    await waitFor(() => expect(listed().filter((t) => /brief \(Drive\)/.test(t))).toHaveLength(2));
    expect(state.info).toHaveBeenLastCalledWith("Ya estaba en la lista: brief (Drive).");
  });

  it("past the limit it keeps what was listed and says what was left out", async () => {
    render(<SourcesStep depth="express" onStarted={() => {}} />);
    const names = (from: number, n: number) =>
      Array.from({ length: n }, (_, k) => `doc-${from + k}.pdf`);
    const per = 5; // selection size; MAX_SOURCES (20) is a multiple, so the last one fills the list exactly
    const shown = () =>
      listed()
        .filter((t) => /\.pdf/.test(t))
        .map((t) => t.replace(/\s*(subiendo|lista|error al subir).*$/, ""));
    // Derived from MAX_SOURCES, not a literal. Selections that still fit accumulate...
    let have = 0;
    while (have + per <= MAX_SOURCES) {
      add(...names(have + 1, per).map(pdf));
      have += per;
      await waitFor(() => expect(shown()).toHaveLength(have));
    }
    // ...and the next selection goes past MAX_SOURCES.
    const last = names(have + 1, per);
    add(...last.map(pdf));
    await waitFor(() => expect(state.error).toHaveBeenCalled());
    const all = [...names(1, have), ...last];
    expect(shown()).toEqual(all.slice(0, MAX_SOURCES));
    const dropped = all.slice(MAX_SOURCES);
    expect(state.error.mock.calls[0]?.[0]).toContain(dropped.join(", "));
    expect(state.error.mock.calls[0]?.[0]).toContain(`${MAX_SOURCES} documentos`);
    // What was left out is never uploaded.
    await waitFor(() => expect(state.uploads).toHaveLength(MAX_SOURCES));
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
