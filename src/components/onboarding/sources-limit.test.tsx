// NK-0164 CA-2: past the limit the notice says the real number and how to go on (exact copy).
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ error: vi.fn() }));

vi.mock("@/hooks/use-me", () => ({ useMe: () => ({ data: { currentOrg: { website: "" } } }) }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (f: unknown) => f }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
}));
vi.mock("@/components/drive", () => ({ DriveSetupButton: () => null, DriveRefButton: () => null }));
vi.mock("@/lib/background.functions", () => ({ startBackgroundJob: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: (m: string) => state.error(m) } }));

import { MAX_FILES } from "@/lib/onboarding-sources";
import { SourcesStep } from "./sources";

const pdf = (name: string) => new File(["%PDF-1.4 prueba"], name, { type: "application/pdf" });
const add = (...files: File[]) =>
  fireEvent.change(document.getElementById("ob-files") as HTMLInputElement, { target: { files } });
const listed = () =>
  Array.from(document.querySelectorAll("ul li"))
    .map((li) => li.textContent ?? "")
    .filter((t) => /\.pdf/.test(t))
    .map((t) => t.replace(/\s*pendiente.*$/, ""));

beforeEach(() => state.error.mockReset());
afterEach(cleanup);

describe("SourcesStep: documents limit notice (NK-0164 CA-2)", () => {
  it("one selection past the limit: mergeFiles cuts it and the notice has the exact copy", async () => {
    render(<SourcesStep depth="express" onStarted={() => {}} />);
    const names = Array.from({ length: MAX_FILES + 2 }, (_, i) => `doc-${i + 1}.pdf`);
    add(...names.map(pdf));
    await waitFor(() => expect(state.error).toHaveBeenCalled());
    expect(listed()).toEqual(names.slice(0, MAX_FILES));
    expect(state.error.mock.calls[0]?.[0]).toBe(
      `Una lectura admite hasta 3 documentos. Se quedan fuera: ${names.slice(MAX_FILES).join(", ")}. Para añadir más, súbelos a Drive y elígelos desde ahí, o pega su texto.`,
    );
  });
});
