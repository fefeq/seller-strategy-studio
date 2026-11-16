import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ upload: vi.fn(), remove: vi.fn(), error: vi.fn() }));
vi.mock("@/hooks/use-me", () => ({
  useMe: () => ({
    data: {
      user: { id: "synthetic-user" },
      currentOrg: { org_id: "synthetic-org", website: "" },
      roles: ["owner"],
    },
  }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { storage: { from: () => ({ upload: h.upload, remove: h.remove }) } },
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (f: unknown) => f }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock("@/components/drive", () => ({ DriveRefButton: () => null }));
vi.mock("@/lib/background.functions", () => ({ startBackgroundJob: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: h.error, info: vi.fn() } }));
import { SourcesStep } from "./sources";
const upload = (...names: string[]) =>
  fireEvent.change(document.getElementById("ob-files") as HTMLInputElement, {
    target: { files: names.map((name) => new File(["synthetic"], name, { type: "text/plain" })) },
  });
beforeEach(() => {
  vi.clearAllMocks();
  h.upload.mockResolvedValue({ error: null });
  h.remove.mockResolvedValue({ error: null });
});
afterEach(cleanup);
describe("F8: source upload lifecycle", () => {
  it("removing during upload waits for the object then deletes it", async () => {
    let finish: ((value: { error: null }) => void) | undefined;
    h.upload.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    render(<SourcesStep depth="express" onStarted={() => {}} />);
    upload("pending.txt");
    fireEvent.click(screen.getByRole("button", { name: "Quitar" }));
    expect(h.remove).not.toHaveBeenCalled();
    await act(async () => {
      finish?.({ error: null });
    });
    expect(h.remove).toHaveBeenCalledWith([h.upload.mock.calls[0]?.[0]]);
    expect(screen.queryByText("pending.txt")).toBeNull();
  });
  it("failed deletion keeps the source and reports a Spanish error", async () => {
    h.remove.mockResolvedValue({ error: { message: "permission denied", status: 403 } });
    render(<SourcesStep depth="express" onStarted={() => {}} />);
    upload("kept.txt");
    await waitFor(() => expect(screen.getByText("lista")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Quitar" }));
    await waitFor(() => expect(h.error).toHaveBeenCalled());
    expect(screen.getByText("kept.txt")).toBeTruthy();
    expect(h.error.mock.calls[0]?.[0]).not.toContain("permission denied");
  });
  it("twenty failed uploads leave all twenty slots free for a new document", async () => {
    h.upload.mockResolvedValue({ error: { message: "network request failed" } });
    render(<SourcesStep depth="express" onStarted={() => {}} />);
    upload(...Array.from({ length: 20 }, (_, i) => `failed-${i}.txt`));
    await waitFor(() => expect(screen.getAllByText("error al subir")).toHaveLength(20));
    h.upload.mockResolvedValue({ error: null });
    upload("accepted.txt");
    await waitFor(() => expect(h.upload).toHaveBeenCalledTimes(21));
    expect(screen.getByText("accepted.txt")).toBeTruthy();
  });
});
