import { beforeEach, describe, expect, it, vi } from "vitest";

const found = vi.hoisted(() => ({
  items: [] as { title: string; url: string; snippet: string; date: null; source: string }[],
}));
vi.mock("@/lib/web-search", () => ({ searchBoth: async () => found.items }));

vi.mock("@/lib/apify-gateway", () => ({ runActor: async () => [] }));

// companyLinkedin reads and saves with the admin client (SDD CA-8); each fakeDb below is registered as that client.
const admin = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/integrations/supabase/client.server", () => ({
  get supabaseAdmin() {
    return admin.current;
  },
}));

import type { Db } from "@/lib/org-data";
import { accountJobsCore, accountPostsCore, companyLinkedin } from "./apify-core";

const AT = "2026-10-01T00:00:00Z";
const ORG = "org-1";
const URL = "https://www.linkedin.com/company/acme-demo/";
const ACC = {
  id: "acc-1",
  org_id: ORG,
  name: "Acme Demo",
  domain: "acme-demo.test",
  linkedin_url: null as string | null,
};

type Row = { linkedin_url: string | null; field_sources: unknown } & Partial<typeof ACC>;
type Call = { op: "select" | "update"; payload?: unknown; filters: unknown[][] };
/** A fake Supabase client that records the select and the update of accounts. */
function fakeDb(
  row: Row,
  updateError: { message: string } | null = null,
  rows = 1,
  readError: { message: string } | null = null,
) {
  const calls: Call[] = [];
  const from = (table: string) => {
    expect(table).toBe("accounts");
    const c: Call = { op: "select", filters: [] };
    const proxy: object = new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === "then") {
            calls.push(c);
            const res =
              c.op === "update"
                ? {
                    data: updateError ? null : Array.from({ length: rows }, () => ({ id: ACC.id })),
                    error: updateError,
                  }
                : { data: readError ? null : row, error: readError };
            return (a: (v: unknown) => unknown, b: (e: unknown) => unknown) =>
              Promise.resolve(res).then(a, b);
          }
          return (...args: unknown[]) => {
            if (prop === "update") {
              c.op = "update";
              c.payload = args[0];
            } else if (prop === "eq") c.filters.push(["eq", ...args]);
            return proxy;
          };
        },
      },
    );
    return proxy;
  };
  const db = { from } as unknown as Db;
  admin.current = db;
  return {
    db,
    calls,
    update: () => calls.find((x) => x.op === "update"),
  };
}

beforeEach(() => {
  found.items = [
    { title: "Acme Demo | LinkedIn", url: URL, snippet: "", date: null, source: "web" },
  ];
});

describe("companyLinkedin writes the origin (NK-0022, CA-3, CA-8)", () => {
  it("saves a found page with web / fuente / not confirmed, never as persona, scoped to the company", async () => {
    const { db, update } = fakeDb({
      linkedin_url: null,
      field_sources: { size: { source: "clay", at: AT } },
    });
    expect(await companyLinkedin(db, ACC)).toBe(URL);
    const p = update()!.payload as {
      linkedin_url: string;
      field_sources: Record<string, Record<string, unknown>>;
    };
    expect(p.linkedin_url).toBe(URL);
    expect(p.field_sources.linkedin_url).toMatchObject({
      source: "web",
      kind: "fuente",
      confirmed: false,
    });
    expect(p.field_sources.linkedin_url).not.toHaveProperty("confirmedBy");
    expect(p.field_sources.size).toEqual({ source: "clay", at: AT });
    expect(update()!.filters).toEqual(
      expect.arrayContaining([
        ["eq", "org_id", ORG],
        ["eq", "id", ACC.id],
      ]),
    );
  });
  it("reads field_sources right before writing", async () => {
    const { db, calls } = fakeDb({ linkedin_url: null, field_sources: {} });
    await companyLinkedin(db, ACC);
    expect(calls.map((c) => c.op)).toEqual(["select", "update"]);
  });
  it("does not overwrite a value a person wrote, even if it is not a company page", async () => {
    const person = {
      source: "persona",
      kind: "persona",
      confirmed: true,
      confirmedBy: "u1",
      at: AT,
      confirmedAt: AT,
    };
    const { db, update } = fakeDb({
      linkedin_url: "https://www.linkedin.com/in/someone-demo/",
      field_sources: { linkedin_url: person },
    });
    await companyLinkedin(db, {
      ...ACC,
      linkedin_url: "https://www.linkedin.com/in/someone-demo/",
    });
    expect(update()).toBeUndefined();
  });
  it("replaces a non-company value that is not a person's", async () => {
    const { db, update } = fakeDb({
      linkedin_url: "https://www.linkedin.com/in/x/",
      field_sources: { linkedin_url: { source: "clay", at: AT } },
    });
    await companyLinkedin(db, { ...ACC, linkedin_url: "https://www.linkedin.com/in/x/" });
    expect((update()!.payload as { linkedin_url: string }).linkedin_url).toBe(URL);
  });
  it("does not search or write when the saved page is already a company page", async () => {
    const { db, calls } = fakeDb({ linkedin_url: URL, field_sources: {} });
    expect(await companyLinkedin(db, { ...ACC, linkedin_url: URL })).toBe(URL);
    expect(calls).toEqual([]);
  });
  it("does not ignore the error of the save, nor an update that touched no row", async () => {
    await expect(
      companyLinkedin(
        fakeDb({ linkedin_url: null, field_sources: {} }, { message: "boom" }).db,
        ACC,
      ),
    ).rejects.toThrow("boom");
    await expect(
      companyLinkedin(fakeDb({ linkedin_url: null, field_sources: {} }, null, 0).db, ACC),
    ).rejects.toThrow();
  });
});

describe("companyLinkedin when the read or the save fails (NK-0022 gate)", () => {
  it("a failed read of field_sources writes nothing: the update would replace every mark", async () => {
    const f = fakeDb({ linkedin_url: null, field_sources: {} }, null, 1, {
      message: "read failed",
    });
    await expect(
      companyLinkedin(f.db, { ...ACC, linkedin_url: "https://www.linkedin.com/in/someone/" }),
    ).rejects.toThrow("read failed");
    expect(f.update()).toBeUndefined();
  });
  it("a caller that only reads still gets the page when the save fails, and the error is logged", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const row = { ...ACC, field_sources: {} };
    const user = fakeDb(row);
    fakeDb(row, { message: "boom" }); // the admin client that fails the save
    expect((await accountJobsCore(user.db, ACC.id)).linkedin).toBe(URL);
    expect(log).toHaveBeenCalledWith("LinkedIn page lookup failed", "boom");
    log.mockRestore();
  });

  it("a mark it cannot read survives the rewrite of field_sources", async () => {
    const odd = { source: "apollo" };
    const { db, update } = fakeDb({ linkedin_url: null, field_sources: { notes: odd } });
    await companyLinkedin(db, ACC);
    const marks = (update()!.payload as { field_sources: Record<string, unknown> }).field_sources;
    expect(marks.notes).toEqual(odd);
    expect(marks.linkedin_url).toMatchObject({ source: "web", confirmed: false });
  });

  it("saves and reads with the admin client, never with the client it was given (CA-8, decision of Fede)", async () => {
    const mine = fakeDb({ linkedin_url: null, field_sources: {} });
    const given = new Proxy(
      {},
      {
        get: () => {
          throw new Error("the given client must not be used");
        },
      },
    ) as unknown as Db;
    expect(await companyLinkedin(given, ACC)).toBe(URL);
    expect(mine.calls.map((c) => c.op)).toEqual(["select", "update"]);
  });

  it("a person's value is only the kind persona mark: a company URL without it is replaced, a /in/ URL is not interpreted", async () => {
    const person = {
      source: "persona",
      kind: "persona",
      confirmed: true,
      confirmedBy: "u1",
      at: AT,
      confirmedAt: AT,
    };
    const keep = fakeDb({
      linkedin_url: "https://www.linkedin.com/company/other/",
      field_sources: { linkedin_url: person },
    });
    await companyLinkedin(keep.db, { ...ACC, linkedin_url: "https://www.linkedin.com/in/x/" });
    expect(keep.update()).toBeUndefined();
    const replace = fakeDb({ linkedin_url: "https://www.linkedin.com/in/x/", field_sources: {} });
    await companyLinkedin(replace.db, { ...ACC, linkedin_url: "https://www.linkedin.com/in/x/" });
    expect(replace.update()).toBeDefined();
  });

  it("a person mark without `at` (unreadable) still protects the value", async () => {
    const f = fakeDb({
      linkedin_url: "https://www.linkedin.com/in/someone-demo/",
      field_sources: { linkedin_url: { source: "persona", kind: "persona", confirmed: true } },
    });
    await companyLinkedin(f.db, {
      ...ACC,
      linkedin_url: "https://www.linkedin.com/in/someone-demo/",
    });
    expect(f.update()).toBeUndefined();
  });

  it("a legacy mark {source: persona} with no kind and no `at` still protects the value", async () => {
    const f = fakeDb({
      linkedin_url: "https://www.linkedin.com/in/someone-demo/",
      field_sources: { linkedin_url: { source: "persona" } },
    });
    await companyLinkedin(f.db, {
      ...ACC,
      linkedin_url: "https://www.linkedin.com/in/someone-demo/",
    });
    expect(f.update()).toBeUndefined();
  });

  it.each([
    ["null", null],
    ["bogus", "bogus"],
    ["empty", ""],
  ])(
    "a source persona mark with an invalid kind (%s) and no `at` still protects the value",
    async (_n, kind) => {
      const f = fakeDb({
        linkedin_url: "https://www.linkedin.com/in/someone-demo/",
        field_sources: { linkedin_url: { source: "persona", kind } },
      });
      await companyLinkedin(f.db, {
        ...ACC,
        linkedin_url: "https://www.linkedin.com/in/someone-demo/",
      });
      expect(f.update()).toBeUndefined();
    },
  );

  it.each(["ia", "fuente", "supuesto"])(
    "a mark of kind %s without `at` does not protect the value, even with source persona",
    async (kind) => {
      const f = fakeDb({
        linkedin_url: "https://www.linkedin.com/in/someone-demo/",
        field_sources: { linkedin_url: { source: "persona", kind } },
      });
      await companyLinkedin(f.db, {
        ...ACC,
        linkedin_url: "https://www.linkedin.com/in/someone-demo/",
      });
      expect(f.update()).toBeDefined();
    },
  );

  // Fails without the LinkedinSaveError throw (the save error is lost) and also if accountPostsCore reads through
  // linkedinForReading (the screen would get the page and no error): the only test that pins that second path.
  it("accountPostsCore propagates a failed save instead of reading past it: the screen shows the error", async () => {
    const user = fakeDb({ ...ACC, field_sources: {} });
    fakeDb({ ...ACC, field_sources: {} }, { message: "boom" }); // the admin client that fails the save
    await expect(accountPostsCore(user.db, ACC.id)).rejects.toThrow("boom");
  });
});
