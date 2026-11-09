// NK-0093: «Drive por cuenta» must tell «no documents» from «the summaries could not be read». When the read of the cached
// summaries fails on the server, accountsOverview throws (the UI shows errorText of it) instead of returning no summaries.
// Fictional data; no network.
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/google-drive", () => ({
  DriveError: class DriveError extends Error {},
  getFile: vi.fn(),
  listChildren: vi.fn(async () => []),
  findByAppProperty: vi.fn(async () => []),
  createFolder: vi.fn(),
  createGoogleDoc: vi.fn(),
  copyAs: vi.fn(),
  deleteFile: vi.fn(),
  downloadBytes: vi.fn(),
  downloadText: vi.fn(),
  exportText: vi.fn(),
  listFiles: vi.fn(),
}));

import { accountsOverview, type DriveScope } from "@/lib/drive-core";

/** Fake db: each table answers with its rows or error; maybeSingle gives the first row (or null). */
function fakeDb(
  tables: Record<string, { rows?: unknown[]; error?: { message: string } }>,
): DriveScope["db"] {
  const chain = (table: string, single = false): object =>
    new Proxy(
      {},
      {
        get: (_t, p) =>
          p === "then"
            ? (f: (v: unknown) => unknown) => {
                const t = tables[table] ?? {};
                const rows = t.rows ?? [];
                return Promise.resolve({
                  data: t.error ? null : single ? (rows[0] ?? null) : rows,
                  error: t.error ?? null,
                }).then(f);
              }
            : () => chain(table, single || p === "maybeSingle"),
      },
    );
  return { from: (t: string) => chain(t) } as unknown as DriveScope["db"];
}
const scope = (db: DriveScope["db"]): DriveScope => ({ db, orgId: "o1", userId: "u1" });

describe("accountsOverview and the summaries read", () => {
  it("answers with no documents when there are no folders and the summaries read is fine", async () => {
    const r = await accountsOverview(
      scope(fakeDb({ drive_folders: { rows: [] }, drive_doc_summaries: { rows: [] } })),
    );
    expect(r.totals.accounts).toBe(0);
  });

  it("throws, not «no documents», when the summaries read fails", async () => {
    const db = fakeDb({
      drive_folders: { rows: [] },
      drive_doc_summaries: { error: { message: "boom" } },
    });
    await expect(accountsOverview(scope(db))).rejects.toThrow("boom");
  });
});
