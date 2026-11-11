// @vitest-environment node
// NK-0145 CA-1, CA-3: the base-rules title comparison must be the one of migration 0085's index, lower(btrim(title)). Postgres
// btrim removes only the normal space (U+0020); JS trim() also removes tabs, line breaks and Unicode spaces. The expected value is
// asked to a real in-process Postgres (PGlite), never written by hand. Fictional titles only.
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addDefaultRulesCore, defaultRules, normalizeRuleTitle } from "@/lib/default-rules";

let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.waitReady;
}, 60_000);
afterAll(async () => {
  await db.close();
});

const pg = async (s: string) =>
  ((await db.query("select lower(btrim($1)) as v", [s])).rows[0] as { v: string }).v;

const CASES: [string, string][] = [
  ["normal spaces", "  Nunca inventar  "],
  ["trailing tab", "Nunca inventar\t"],
  ["leading tab", "\tNunca inventar"],
  ["trailing no-break space", "Nunca inventar\u00a0"],
  ["leading no-break space", "\u00a0Nunca inventar"],
  ["tab then normal space", "Nunca inventar\t "],
  ["normal space then no-break space", " \u00a0Nunca inventar \u00a0"],
  ["line break and carriage return", "\nNunca inventar\r"],
  ["Unicode em space", " Nunca inventar "],
  ["inner spaces untouched", "Nunca   inventar"],
  ["upper case and accents", "  ESCALAR ANTE UNA QUEJA, UN ASUNTO LEGAL O UNA BAJA  "],
  ["only whitespace", " \t\u00a0 "],
  ["empty", ""],
];

describe("normalizeRuleTitle equals lower(btrim(x)) of a real Postgres (NK-0145 CA-1)", () => {
  it.each(CASES)("%s", async (_name, input) => {
    expect(normalizeRuleTitle(input)).toBe(await pg(input));
  });

  it("keeps the tab and the no-break space that btrim keeps (the proof that JS trim differs)", async () => {
    expect(await pg("a\t")).toBe("a\t");
    expect(normalizeRuleTitle("a\t")).toBe("a\t");
    expect(normalizeRuleTitle("a\u00a0")).toBe("a\u00a0");
    expect(normalizeRuleTitle(" a ")).toBe("a");
  });
});

// A fake that models the unique index with the answer of the real Postgres for each title, so JS and the index can only agree if
// the core compares with the same rule.
function fakeDb(existing: { title: string }[]) {
  const store = existing.map((e) => ({ org_id: "org-1", section: "rules", ...e }));
  const db = {
    from: () => {
      let batch: { title: string }[] | undefined;
      const p: object = new Proxy(
        {},
        {
          get(_t, prop: string) {
            if (prop === "then")
              return (ok: (v: unknown) => unknown) => {
                if (batch) {
                  store.push(...batch.map((b) => ({ org_id: "org-1", section: "rules", ...b })));
                  return Promise.resolve({ data: null, error: null }).then(ok);
                }
                return Promise.resolve({ data: store.slice(), error: null }).then(ok);
              };
            return (...args: unknown[]) => {
              if (prop === "insert") batch = [args[0]].flat() as { title: string }[];
              return p;
            };
          },
        },
      );
      return p;
    },
  };
  return { db: db as unknown as Parameters<typeof addDefaultRulesCore>[0]["db"], store };
}
const ctx = (db: Parameters<typeof addDefaultRulesCore>[0]["db"]) => ({
  db,
  orgId: "org-1",
  userId: "11111111-1111-4111-8111-111111111111",
  roles: ["owner"],
});

describe("addDefaultRulesCore compares titles as the index does (NK-0145 CA-1, CA-3)", () => {
  const first = defaultRules()[0]!.title;

  it("a stored title with a trailing tab is a different title for the index, so the rule is added", async () => {
    // Postgres keeps the tab, so the index would accept the clean title next to it: the core must not skip it.
    expect(await pg(`${first}\t`)).not.toBe(await pg(first));
    const f = fakeDb([{ title: `${first}\t` }]);
    const r = await addDefaultRulesCore(ctx(f.db));
    expect(r.titles).toContain(first);
    expect(r.added).toBe(9);
  });

  it("a stored title with a trailing no-break space is also different", async () => {
    const f = fakeDb([{ title: `${first}\u00a0` }]);
    expect((await addDefaultRulesCore(ctx(f.db))).added).toBe(9);
  });

  it("a stored title with normal spaces and other case is the same, so it is not added again", async () => {
    expect(await pg(`  ${first.toUpperCase()}  `)).toBe(await pg(first));
    const f = fakeDb([{ title: `  ${first.toUpperCase()}  ` }]);
    const r = await addDefaultRulesCore(ctx(f.db));
    expect(r.added).toBe(8);
    expect(r.titles).not.toContain(first);
  });

  it("stays idempotent: a second run adds nothing", async () => {
    const f = fakeDb([{ title: `${first}\t` }]);
    await addDefaultRulesCore(ctx(f.db));
    const again = await addDefaultRulesCore(ctx(f.db));
    expect(again).toEqual({ added: 0, titles: [] });
  });
});
