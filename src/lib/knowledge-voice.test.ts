// @vitest-environment node
// SDD-20261110-company-voice-and-escalation-rules (NK-0128) U-3 · CA-4, CA-6, CA-6c: the reader of the company's voice (up to
// three real messages), its cut per example, its failure report and its logs. Fictional messages only.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  VOICE_CUT_MARK,
  VOICE_FORM_RULE,
  VOICE_MAX_CHARS,
  VOICE_MAX_EXAMPLES,
  VOICE_READ_FAILED,
  loadVoice,
  pickVoice,
  voiceBlock,
} from "@/lib/knowledge-voice";

const ORG = "org-1";
const MARK = "MARCA-VOZ-K3Z";
type Row = {
  org_id: string | null;
  title: string;
  body: string;
  section: string;
  scope: string;
  mandatory: boolean;
};
const voice = (n: number, over: Partial<Row> = {}): Row => ({
  org_id: ORG,
  title: `Mensaje ${n}`,
  body: `Hola, te escribo por lo de la semana pasada, número ${n}.`,
  section: "voice",
  scope: "team",
  mandatory: false,
  ...over,
});

type Call = { table: string; calls: unknown[][] };
/** A fake client that records every call of the query and answers with `rows`, or fails the way Supabase does. */
function fakeDb(answer: { rows?: Row[]; error?: { message: string }; throws?: boolean }) {
  const log: Call[] = [];
  const from = (table: string) => {
    const q: Call = { table, calls: [] };
    log.push(q);
    const proxy: object = new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === "then") {
            if (answer.throws)
              return (_ok: unknown, fail: (e: unknown) => unknown) =>
                Promise.reject(new Error(`network down ${MARK}`)).then(undefined, fail);
            return (ok: (v: unknown) => unknown) =>
              Promise.resolve({
                data: answer.error ? null : (answer.rows ?? []),
                error: answer.error ?? null,
              }).then(ok);
          }
          return (...args: unknown[]) => {
            q.calls.push([prop, ...args]);
            return proxy;
          };
        },
      },
    );
    return proxy;
  };
  return { db: { from } as unknown as Parameters<typeof loadVoice>[0]["db"], log };
}

let logs: string[] = [];
beforeEach(() => {
  logs = [];
  for (const m of ["error", "warn", "log", "info"] as const)
    vi.spyOn(console, m).mockImplementation((...a: unknown[]) => {
      logs.push(
        a
          .map((x) =>
            x instanceof Error
              ? `${x.name} ${x.message}`
              : typeof x === "string"
                ? x
                : JSON.stringify(x),
          )
          .join(" "),
      );
    });
});
afterEach(() => vi.restoreAllMocks());

describe("constants and texts (§9)", () => {
  it("three examples, a fixed cut per example, and the error text of §9", () => {
    expect(VOICE_MAX_EXAMPLES).toBe(3);
    expect(Number.isInteger(VOICE_MAX_CHARS) && VOICE_MAX_CHARS > 0).toBe(true);
    expect(VOICE_READ_FAILED).toBe(
      "No he podido leer la voz de tu empresa. Este borrador no la usa; reinténtalo.",
    );
    expect(VOICE_FORM_RULE).toMatch(/forma/);
    expect(VOICE_FORM_RULE).toMatch(/no su contenido/);
  });
});

describe("pickVoice (CA-4, CA-6c)", () => {
  it("takes at most three, the first ones of a newest-first list", () => {
    const got = pickVoice([voice(1), voice(2), voice(3), voice(4), voice(5)]);
    expect(got.map((e) => e.texto.slice(-2))).toEqual(["1.", "2.", "3."]);
  });

  it("uses the ones there are: two, one, none", () => {
    expect(pickVoice([voice(1), voice(2)])).toHaveLength(2);
    expect(pickVoice([voice(1)])).toHaveLength(1);
    expect(pickVoice([])).toEqual([]);
  });

  it("leaves out personal documents, other sections, marked mandatory and empty ones, and does not count them", () => {
    const got = pickVoice([
      voice(1, { scope: "personal" }),
      voice(2, { section: "rules" }),
      voice(3, { mandatory: true }),
      voice(4, { body: "   " }),
      voice(5),
      voice(6),
    ]);
    expect(got.map((e) => e.texto.slice(-2))).toEqual(["5.", "6."]);
  });

  it("cuts each example to VOICE_MAX_CHARS and says so; one that fits is untouched", () => {
    const fits = "a".repeat(VOICE_MAX_CHARS);
    const long = "b".repeat(VOICE_MAX_CHARS + 500);
    const [a, b] = pickVoice([voice(1, { body: fits }), voice(2, { body: long })]);
    expect(a).toEqual({ texto: fits });
    expect(b!.texto).toBe(`${"b".repeat(VOICE_MAX_CHARS)}${VOICE_CUT_MARK}`);
    expect(VOICE_CUT_MARK).toMatch(/cortad/i);
  });

  it("never carries the title or the author", () => {
    expect(Object.keys(pickVoice([voice(1)])[0]!)).toEqual(["texto"]);
  });
});

describe("voiceBlock", () => {
  it("is empty without examples", () => {
    expect(voiceBlock([])).toBe("");
  });

  it("is a data block voz_de_la_empresa with the examples as JSON", () => {
    const block = voiceBlock([{ texto: "Hola, qué tal." }]);
    expect(block).toContain("voz_de_la_empresa");
    expect(block).toContain(JSON.stringify([{ texto: "Hola, qué tal." }]));
    expect(block).toMatch(/datos/);
  });
});

describe("loadVoice filters explicitly (CA-4)", () => {
  it("asks for this company's team voice that is not mandatory, newest first", async () => {
    const { db, log } = fakeDb({ rows: [voice(1)] });
    const r = await loadVoice({ db, orgId: ORG });
    expect(r).toEqual({ ok: true, examples: [{ texto: voice(1).body }] });
    expect(log).toHaveLength(1);
    const q = log[0]!;
    expect(q.table).toBe("knowledge_docs");
    expect(q.calls).toContainEqual(["eq", "org_id", ORG]);
    expect(q.calls).toContainEqual(["eq", "scope", "team"]);
    expect(q.calls).toContainEqual(["eq", "section", "voice"]);
    expect(q.calls).toContainEqual(["eq", "mandatory", false]);
    expect(q.calls).toContainEqual(["order", "updated_at", { ascending: false }]);
    expect(q.calls).toContainEqual(["order", "id"]);
  });

  it("drops rows of another company, personal docs, other sections and mandatory ones even if the client returns them (privileged client)", async () => {
    const { db } = fakeDb({
      rows: [
        voice(1, { org_id: "org-2", body: "De otra empresa" }),
        voice(2, { org_id: null, body: "Sin empresa" }),
        voice(3, { scope: "personal", body: "Personal" }),
        voice(4, { section: "rules", body: "Una regla" }),
        voice(5, { mandatory: true, body: "Obligatoria" }),
        voice(6, { body: "Propia" }),
      ],
    });
    const r = await loadVoice({ db, orgId: ORG });
    expect(r).toEqual({ ok: true, examples: [{ texto: "Propia" }] });
  });

  it("gives at most three when there are more", async () => {
    const { db } = fakeDb({ rows: [1, 2, 3, 4, 5].map((n) => voice(n)) });
    const r = await loadVoice({ db, orgId: ORG });
    expect(r.ok && r.examples).toHaveLength(3);
  });

  it("no voice written is ok with no examples, not a failure", async () => {
    expect(await loadVoice({ db: fakeDb({ rows: [] }).db, orgId: ORG })).toEqual({
      ok: true,
      examples: [],
    });
  });

  it("a read failure (error returned or thrown) is reported, never read as «no voice»", async () => {
    expect(await loadVoice({ db: fakeDb({ error: { message: "boom" } }).db, orgId: ORG })).toEqual({
      ok: false,
      examples: [],
    });
    expect(await loadVoice({ db: fakeDb({ throws: true }).db, orgId: ORG })).toEqual({
      ok: false,
      examples: [],
    });
  });

  it("without a company it reads nothing and reports a failure", async () => {
    const { db, log } = fakeDb({ rows: [voice(1)] });
    expect(await loadVoice({ db, orgId: "" })).toEqual({ ok: false, examples: [] });
    expect(log).toHaveLength(0);
  });
});

describe("logs never carry the text of an example (CA-6)", () => {
  it.each([
    ["error returned", fakeDb({ error: { message: `permission denied ${MARK}` } })],
    ["exception", fakeDb({ throws: true })],
  ])("%s", async (_n, { db }) => {
    await loadVoice({ db, orgId: ORG });
    expect(logs.join("\n")).toContain("knowledge voice load failed");
    expect(logs.join("\n")).not.toContain(MARK);
  });

  it("a successful read logs nothing", async () => {
    await loadVoice({ db: fakeDb({ rows: [voice(1, { body: MARK })] }).db, orgId: ORG });
    expect(logs).toEqual([]);
  });
});
