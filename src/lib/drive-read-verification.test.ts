import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DriveScope } from "./drive-core";
import { GDOC_MIME, FOLDER_MIME, MAX_DOWNLOAD, OUTSIDE_FOLDER } from "./drive";

const h = vi.hoisted(() => ({ get: vi.fn(), export: vi.fn(), download: vi.fn() }));
vi.mock("@/lib/google-drive", async (original) => ({
  ...(await original<typeof import("./google-drive")>()),
  getFile: h.get,
  exportText: h.export,
  downloadText: h.download,
}));
import { readFile } from "./drive-core";
function scope(): DriveScope {
  const q = {
    select: () => q,
    eq: () => q,
    is: () => q,
    maybeSingle: async () => ({
      data: { folder_id: "synthetic-root", name: "Carpeta sintética", created_by_app: true },
      error: null,
    }),
  };
  return {
    db: { from: () => q } as unknown as DriveScope["db"],
    orgId: "synthetic-org",
    userId: "synthetic-user",
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  h.get.mockImplementation(async (id: string) =>
    id === "synthetic-root"
      ? { id, name: "Raíz sintética", mimeType: FOLDER_MIME }
      : { id, name: "Documento sintético", mimeType: GDOC_MIME, parents: ["synthetic-root"] },
  );
  h.export.mockResolvedValue("Texto sintético");
});
describe("F1/F3: Drive client read boundaries", () => {
  it("reports original length for 96,000 characters, not the clipped length", async () => {
    h.export.mockResolvedValue("x".repeat(96_000));
    expect(await readFile(scope(), "synthetic-document")).toEqual(
      expect.objectContaining({
        truncated: true,
        originalLength: 96_000,
        text: "x".repeat(60_000) + "…",
      }),
    );
  });
  it("outside the company folder never exports or downloads", async () => {
    h.get.mockImplementation(async (id: string) => ({
      id,
      name: "Sintético",
      mimeType: id === "synthetic-root" ? FOLDER_MIME : GDOC_MIME,
      parents: [],
    }));
    await expect(readFile(scope(), "synthetic-document")).rejects.toThrow(OUTSIDE_FOLDER);
    expect(h.export).not.toHaveBeenCalled();
    expect(h.download).not.toHaveBeenCalled();
  });
  it.each([403, 401])(
    "permission/token failure %i stops without reading content",
    async (status) => {
      h.get.mockRejectedValue(Object.assign(new Error("Fallo simulado"), { status }));
      await expect(readFile(scope(), "synthetic-document")).rejects.toMatchObject({ status });
      expect(h.export).not.toHaveBeenCalled();
      expect(h.download).not.toHaveBeenCalled();
    },
  );
  it("a binary/text file over 10 MB is rejected before downloading", async () => {
    h.get.mockImplementation(async (id: string) => ({
      id,
      name: "Sintético",
      mimeType: id === "synthetic-root" ? FOLDER_MIME : "text/plain",
      parents: ["synthetic-root"],
      size: String(MAX_DOWNLOAD + 1),
    }));
    await expect(readFile(scope(), "synthetic-document")).rejects.toThrow("demasiado grande");
    expect(h.download).not.toHaveBeenCalled();
  });
  it("an empty export is not reported as a full read", async () => {
    h.export.mockResolvedValue(" \n ");
    await expect(readFile(scope(), "synthetic-document")).rejects.toThrow("vacío");
  });
});
