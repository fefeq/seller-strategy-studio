// @vitest-environment node
// SDD-20261110-company-voice-and-escalation-rules (NK-0128) U-5 · CA-10, CA-11, CA-12: the base rules (three Nunca, three
// Siempre, three Escalar) and the action that adds the missing ones to the active company. Fictional ids and titles only.
import { readdirSync, readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BINDING_WRITE_DENIED, AGENT_RULE_LIMITS, pickRules } from "@/lib/knowledge-rules";
import {
  DEFAULT_RULES_READ_FAILED,
  DEFAULT_RULES_SAVE_FAILED,
  addDefaultRulesCore,
  defaultRules,
} from "@/lib/default-rules";

const ORG = "org-1";
const OTHER = "org-2";
const ME = "11111111-1111-4111-8111-111111111111";

// The nine texts of §9, literal: CA-10 compares them as written in the approved SDD (the bodies start as the SDD gives them).
const EXPECTED = [
  [
    "Nunca enviar ni publicar",
    "nunca envíes, publiques ni cambies datos sin que una persona lo confirme; todo sale como borrador o sugerencia.",
  ],
  [
    "Nunca inventar",
    "nunca inventes cifras, testimonios, nombres ni fechas; si falta un dato, dilo.",
  ],
  [
    "Nunca exponer datos de clientes",
    "nunca pegues textos, correos ni nombres de clientes en ejemplos, borradores ni resúmenes que vaya a leer otra persona.",
  ],
  [
    "Siempre solo datos de la empresa",
    "usa solo lo que está en la empresa; si no está escrito, pregunta.",
  ],
  ["Siempre fuente y fecha", "cita de dónde sale cada dato y cuándo se publicó."],
  ["Siempre voz de la empresa", "redacta con la voz guardada y, ante la duda, más corto."],
  [
    "Escalar cuando haya precio, descuento o condiciones",
    "si el texto necesita una cifra o condición que no está escrita, para y pregunta a una persona.",
  ],
  [
    "Escalar ante una queja, un asunto legal o una baja",
    "si el contacto reclama, menciona un asunto legal o pide que no le escribas más, para y pasa el caso a una persona.",
  ],
  [
    "Escalar cuando falte el ICP",
    "si no puedes saber si la cuenta encaja, para y pide a una persona que decida.",
  ],
] as const;

describe("defaultRules (CA-10)", () => {
  it("is exactly the nine rules of §9, in order: three Nunca, three Siempre, three Escalar", () => {
    expect(defaultRules().map((r) => [r.title, r.body])).toEqual(EXPECTED);
    const kinds = defaultRules().map((r) => r.title.split(" ")[0]);
    expect(kinds).toEqual([
      ...Array(3).fill("Nunca"),
      ...Array(3).fill("Siempre"),
      ...Array(3).fill("Escalar"),
    ]);
  });

  it("has unique titles and no text that uses another form of address", () => {
    const titles = defaultRules().map((r) => r.title.toLowerCase());
    expect(new Set(titles).size).toBe(9);
    for (const r of defaultRules())
      expect(`${r.title} ${r.body}`).not.toMatch(/\b(usted|ustedes|vos|vosotros)\b/i);
  });

  it("carries no names, emails, links or figures (no client data)", () => {
    for (const r of defaultRules())
      expect(`${r.title} ${r.body}`).not.toMatch(/@|https?:|www\.|\d/);
  });

  it("returns a fresh list each time: changing one does not change the next", () => {
    const a = defaultRules();
    a[0]!.title = "Cambiada";
    a.pop();
    expect(defaultRules()).toHaveLength(9);
    expect(defaultRules()[0]!.title).toBe("Nunca enviar ni publicar");
  });

  it("the three «Escalar» ones are read as escalation rules by the reader, and only those", () => {
    const docs = defaultRules().map((r) => ({ ...r, section: "rules", scope: "team" }));
    const { rules } = pickRules(docs, AGENT_RULE_LIMITS);
    expect(rules).toHaveLength(9);
    expect(rules.filter((r) => r.escalar).map((r) => r.titulo)).toEqual(
      EXPECTED.slice(6).map((e) => e[0]),
    );
  });
});

type Existing = { org_id: string; section: string; title: string };
type Call = { table: string; calls: unknown[][]; insert?: Record<string, unknown>[] };
/** A fake client that remembers what was inserted, so a second run sees it. `read` decides what the title read answers. */
function fakeDb(
  o: {
    existing?: Existing[];
    readError?: boolean;
    readThrows?: boolean;
    insertError?: boolean;
  } = {},
) {
  const store: Existing[] = [...(o.existing ?? [])];
  const log: Call[] = [];
  const from = (table: string) => {
    const q: Call = { table, calls: [] };
    log.push(q);
    const proxy: object = new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === "then") {
            if (q.insert) {
              if (o.insertError)
                return (ok: (v: unknown) => unknown) =>
                  Promise.resolve({ data: null, error: { message: "SECRETO-BD detalle" } }).then(
                    ok,
                  );
              store.push(...q.insert.map((r) => r as unknown as Existing));
              return (ok: (v: unknown) => unknown) =>
                Promise.resolve({ data: null, error: null }).then(ok);
            }
            if (o.readThrows)
              return (_ok: unknown, fail: (e: unknown) => unknown) =>
                Promise.reject(new Error("red caída")).then(undefined, fail);
            if (o.readError)
              return (ok: (v: unknown) => unknown) =>
                Promise.resolve({ data: null, error: { message: "permiso denegado" } }).then(ok);
            // Answers every row (the privileged client does not filter): the core must filter in memory too.
            return (ok: (v: unknown) => unknown) =>
              Promise.resolve({ data: store.slice(), error: null }).then(ok);
          }
          return (...args: unknown[]) => {
            q.calls.push([prop, ...args]);
            if (prop === "insert") q.insert = [args[0]].flat() as Record<string, unknown>[];
            return proxy;
          };
        },
      },
    );
    return proxy;
  };
  return { db: { from } as unknown as Parameters<typeof addDefaultRulesCore>[0]["db"], log, store };
}
const ctx = (db: ReturnType<typeof fakeDb>["db"], roles: string[] = ["owner"]) => ({
  db,
  orgId: ORG,
  userId: ME,
  roles,
});
const inserts = (log: Call[]) => log.filter((c) => c.insert).flatMap((c) => c.insert!);
let logs: string[] = [];
beforeEach(() => {
  logs = [];
  for (const m of ["error", "warn", "log", "info"] as const)
    vi.spyOn(console, m).mockImplementation((...a: unknown[]) => {
      logs.push(a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" "));
    });
});

describe("addDefaultRulesCore: who and what (CA-11)", () => {
  it.each([[["ae"]], [["sdr", "csm"]], [[]]])(
    "roles %j: refused with the writers' text, and the database is not even read",
    async (roles) => {
      const { db, log } = fakeDb();
      await expect(addDefaultRulesCore(ctx(db, roles))).rejects.toThrow(BINDING_WRITE_DENIED);
      expect(log).toHaveLength(0);
    },
  );

  it.each([["owner"], ["sales_leader"], ["ae", "sales_leader"]])(
    "%s adds the nine to the active company as team rules",
    async (...roles) => {
      const { db, log } = fakeDb();
      const r = await addDefaultRulesCore(ctx(db, roles));
      expect(r).toEqual({ added: 9, titles: EXPECTED.map((e) => e[0]) });
      const rows = inserts(log);
      expect(rows).toHaveLength(9);
      for (const [i, row] of rows.entries())
        expect(row).toEqual({
          org_id: ORG,
          section: "rules",
          title: EXPECTED[i]![0],
          body: EXPECTED[i]![1],
          scope: "team",
          created_by: ME,
          updated_by: ME,
        });
      expect(log.filter((c) => c.insert)).toHaveLength(1);
    },
  );

  it("reads the titles of this company's Reglas section only, in the query", async () => {
    const { db, log } = fakeDb();
    await addDefaultRulesCore(ctx(db));
    const read = log.find((c) => !c.insert)!;
    expect(read.table).toBe("knowledge_docs");
    expect(read.calls).toContainEqual(["eq", "org_id", ORG]);
    expect(read.calls).toContainEqual(["eq", "section", "rules"]);
  });

  it("skips the ones already there, ignoring case and spaces, and adds the rest", async () => {
    const { db, log } = fakeDb({
      existing: [
        { org_id: ORG, section: "rules", title: "Nunca inventar" },
        { org_id: ORG, section: "rules", title: "  siempre FUENTE y fecha " },
      ],
    });
    const r = await addDefaultRulesCore(ctx(db));
    expect(r.added).toBe(7);
    expect(inserts(log).map((x) => x.title)).not.toContain("Nunca inventar");
    expect(inserts(log).map((x) => x.title)).not.toContain("Siempre fuente y fecha");
  });

  it("a title that exists only in another section or in another company does not count (privileged client returns them)", async () => {
    const { db } = fakeDb({
      existing: [
        { org_id: ORG, section: "company", title: "Nunca inventar" },
        { org_id: OTHER, section: "rules", title: "Siempre fuente y fecha" },
      ],
    });
    expect((await addDefaultRulesCore(ctx(db))).added).toBe(9);
  });

  it("all there: inserts nothing and says zero", async () => {
    const { db, log } = fakeDb({
      existing: EXPECTED.map((e) => ({ org_id: ORG, section: "rules", title: e[0] })),
    });
    expect(await addDefaultRulesCore(ctx(db))).toEqual({ added: 0, titles: [] });
    // Not even an empty insert is sent.
    expect(log.some((c) => c.calls.some((x) => x[0] === "insert"))).toBe(false);
  });

  it("can be repeated without duplicating", async () => {
    const f = fakeDb();
    expect((await addDefaultRulesCore(ctx(f.db))).added).toBe(9);
    expect((await addDefaultRulesCore(ctx(f.db))).added).toBe(0);
    expect(f.store).toHaveLength(9);
  });
});

describe("addDefaultRulesCore: failures (CA-11)", () => {
  it.each([
    ["error returned", { readError: true }],
    ["exception", { readThrows: true }],
  ])("a failed read (%s) inserts nothing and says so, never as «nothing exists»", async (_n, o) => {
    const { db, log } = fakeDb(o);
    await expect(addDefaultRulesCore(ctx(db))).rejects.toThrow(DEFAULT_RULES_READ_FAILED);
    expect(inserts(log)).toHaveLength(0);
  });

  it("a failed insert says it in our words, not the database's, and logs no rule text", async () => {
    const { db } = fakeDb({ insertError: true });
    const err = await addDefaultRulesCore(ctx(db)).catch((e: Error) => e);
    expect((err as Error).message).toBe(DEFAULT_RULES_SAVE_FAILED);
    expect(logs.join("\n")).not.toContain("SECRETO-BD");
    expect(logs.join("\n")).not.toContain("nunca inventes");
  });

  it("the two texts are Spanish and say what happened and what to do", () => {
    expect(DEFAULT_RULES_READ_FAILED).toMatch(/No he podido leer/);
    expect(DEFAULT_RULES_READ_FAILED).toMatch(/reinténtalo/);
    expect(DEFAULT_RULES_SAVE_FAILED).toMatch(/No he podido guardar/);
    expect(DEFAULT_RULES_SAVE_FAILED).toMatch(/reinténtalo/);
  });
});

// NK-0136 CA-1: two sessions of the same company press «Añadir reglas base» at the same time. Both read before either writes, so
// the title check alone cannot stop them: the database does (migration 0085, a unique index), and the loser must read again, not fail.
/** A fake that models the unique index of 0085 on (org_id, lower(btrim(title))) for team rules, with an atomic batch insert. */
function racingDb(seed: Existing[] = []) {
  const store: Existing[] = [...seed];
  let reads = 0;
  let inserts = 0;
  const key = (r: Existing) => `${r.org_id}|${r.title.trim().toLowerCase()}`;
  const from = () => {
    let batch: Existing[] | undefined;
    const proxy: object = new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === "then")
            return (ok: (v: unknown) => unknown) => {
              if (batch) {
                inserts++;
                const seen = new Set(store.map(key));
                const clash =
                  batch.some((r) => seen.has(key(r))) ||
                  new Set(batch.map(key)).size < batch.length;
                if (clash)
                  return Promise.resolve({
                    data: null,
                    error: {
                      code: "23505",
                      message: "duplicate key value violates unique constraint",
                    },
                  }).then(ok);
                store.push(...batch);
                return Promise.resolve({ data: null, error: null }).then(ok);
              }
              reads++;
              const snapshot = store.slice();
              // Yield so the other session reads before this one writes.
              return new Promise((r) => setTimeout(r, 0))
                .then(() => ({ data: snapshot, error: null }))
                .then(ok);
            };
          return (...args: unknown[]) => {
            if (prop === "insert") batch = [args[0]].flat() as Existing[];
            return proxy;
          };
        },
      },
    );
    return proxy;
  };
  return {
    db: { from } as unknown as Parameters<typeof addDefaultRulesCore>[0]["db"],
    store,
    counts: () => ({ reads, inserts }),
  };
}

describe("addDefaultRulesCore: two sessions at once (NK-0136 CA-1)", () => {
  it("both calls succeed and the company ends with each base rule exactly once", async () => {
    const f = racingDb();
    const [a, b] = await Promise.all([
      addDefaultRulesCore(ctx(f.db)),
      addDefaultRulesCore(ctx(f.db, ["sales_leader"])),
    ]);
    expect(f.store).toHaveLength(9);
    expect(new Set(f.store.map((r) => r.title.toLowerCase())).size).toBe(9);
    // Whoever lost the race reports what it really added: between them, nine.
    expect(a.added + b.added).toBe(9);
    expect([a.added, b.added].sort()).toEqual([0, 9]);
  });

  it("the loser reads again after the conflict and adds only what is still missing", async () => {
    const f = racingDb();
    const [a, b] = await Promise.all([
      addDefaultRulesCore(ctx(f.db)),
      addDefaultRulesCore(ctx(f.db)),
    ]);
    expect(f.counts().reads).toBe(3);
    expect(f.store).toHaveLength(9);
    expect(a.titles.length + b.titles.length).toBe(9);
  });

  it("a conflict that persists after the retries is reported in our words, not the database's", async () => {
    // A database that rejects every insert as a duplicate while the read never shows it: it must not loop forever.
    const stuck = {
      from: () => {
        const p: object = new Proxy(
          {},
          {
            get(_t, prop: string) {
              if (prop === "then")
                return (ok: (v: unknown) => unknown) =>
                  Promise.resolve({ data: [], error: null }).then(ok);
              return () => {
                if (prop === "insert")
                  return {
                    then: (ok: (v: unknown) => unknown) =>
                      Promise.resolve({
                        data: null,
                        error: { code: "23505", message: "SECRETO-BD" },
                      }).then(ok),
                  };
                return p;
              };
            },
          },
        );
        return p;
      },
    } as unknown as Parameters<typeof addDefaultRulesCore>[0]["db"];
    const err = await addDefaultRulesCore(ctx(stuck)).catch((e: Error) => e);
    expect((err as Error).message).toBe(DEFAULT_RULES_SAVE_FAILED);
    expect(logs.join("\n")).not.toContain("SECRETO-BD");
  });

  it("any other insert error is not retried", async () => {
    const { db, log } = fakeDb({ insertError: true });
    await expect(addDefaultRulesCore(ctx(db))).rejects.toThrow(DEFAULT_RULES_SAVE_FAILED);
    expect(log.filter((c) => c.insert)).toHaveLength(1);
  });
});

// CA-12 · regression guard, not fail-first (true today): no base rule is created by anything but the explicit action.
describe("no base rule is created without the action (CA-12, source guard)", () => {
  const read = (f: string) => readFileSync(f, "utf8");
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory()
        ? walk(`${dir}/${e.name}`)
        : /\.(ts|tsx)$/.test(e.name) && !/\.test\./.test(e.name)
          ? [`${dir}/${e.name}`]
          : [],
    );

  it("only the action's own files and the screen's button use the core or the list", () => {
    const users = walk("src")
      .filter((f) => /\b(addDefaultRulesCore|defaultRules)\b/.test(read(f)))
      .sort();
    // play-diagnosis.ts: NK-0153 CA-14 / D-S8-1 (add_default_rules is a confirmed write; the core re-checks the role).
    expect(users).toEqual([
      "src/lib/agent/tools/play-diagnosis.ts",
      "src/lib/default-rules.functions.ts",
      "src/lib/default-rules.ts",
    ]);
    const screen = walk("src")
      .filter((f) => /\baddDefaultRules\b/.test(read(f)))
      .sort();
    expect(screen).toEqual([
      "src/components/hub/hub-screen.tsx",
      "src/lib/default-rules.functions.ts",
    ]);
  });

  it("no migration (create_organization included) seeds any of the nine titles", () => {
    const dir = "drizzle/migrations";
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")))
      for (const [title] of EXPECTED)
        expect(read(`${dir}/${f}`), `${f}: ${title}`).not.toContain(title);
  });
});
