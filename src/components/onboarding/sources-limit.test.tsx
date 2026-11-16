// NK-0164 CA-2: past the limit the notice says the real number and how to go on (exact copy).
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ error: vi.fn(), uploads: [] as string[] }));

vi.mock("@/hooks/use-me", () => ({
  useMe: () => ({ data: { user: { id: "user-1" }, currentOrg: { org_id: "org-1", website: "" } } }),
}));
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
vi.mock("@/components/drive", () => ({ DriveSetupButton: () => null, DriveRefButton: () => null }));
vi.mock("@/lib/background.functions", () => ({ startBackgroundJob: vi.fn() }));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: (m: string) => state.error(m), info: vi.fn() },
}));

import { MAX_SOURCES } from "@/lib/onboarding-files-limit";
import { SourcesStep } from "./sources";

const pdf = (name: string) => new File(["%PDF-1.4 prueba"], name, { type: "application/pdf" });
const add = (...files: File[]) =>
  fireEvent.change(document.getElementById("ob-files") as HTMLInputElement, { target: { files } });
const listed = () =>
  Array.from(document.querySelectorAll("ul li"))
    .map((li) => li.textContent ?? "")
    .filter((t) => /\.pdf/.test(t))
    .map((t) => t.replace(/\s*(subiendo|lista|error al subir).*$/, ""));

beforeEach(() => {
  state.error.mockReset();
  state.uploads.length = 0;
});
afterEach(cleanup);

describe("SourcesStep: documents limit notice (NK-0164 CA-2)", () => {
  it("one selection past the limit: mergeRefs cuts it and the notice has the exact copy", async () => {
    render(<SourcesStep depth="express" onStarted={() => {}} />);
    const names = Array.from({ length: MAX_SOURCES + 2 }, (_, i) => `doc-${i + 1}.pdf`);
    add(...names.map(pdf));
    await waitFor(() => expect(state.error).toHaveBeenCalled());
    expect(listed()).toEqual(names.slice(0, MAX_SOURCES));
    expect(state.error.mock.calls[0]?.[0]).toBe(
      "Una lectura admite hasta 20 documentos entre archivos y Drive. Se quedan fuera: doc-21.pdf, doc-22.pdf. Quita alguno de la lista si quieres añadirlos.",
    );
    await waitFor(() => expect(state.uploads).toHaveLength(MAX_SOURCES));
  });
});
