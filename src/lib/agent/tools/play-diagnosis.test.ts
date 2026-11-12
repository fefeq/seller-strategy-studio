// SDD-20261112-diagnosis-in-chat U-2 and U-3. Session 1: playStateRows reports a failed read, and planFor builds the plan with the same reads
// as the tools. Session 2: diagnose_play_teams, save_play_plan and add_default_rules (CA-8 to CA-11, CA-14, CA-15, CA-18 to CA-20).
// A fake Supabase client records every query; suggestions live in an in-memory table. Companies, people and texts are fictitious.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { TOOLS, executeTool, getTool, toolsFor, type ToolCtx } from "@/lib/agent/tools";
import { planFor } from "@/lib/agent/tools/play-diagnosis";
import { playStateRows } from "@/lib/agent/tools/plays";
import { getWorkflow } from "@/lib/bmad/workflows";
import { defaultRules } from "@/lib/default-rules";
import { TITLES } from "@/lib/mcp/tools/agent-tools";
import { CATALOG } from "@/lib/plays/catalog";
import {
  BOTTLENECK_WORD,
  PLAYS_DIAGNOSIS_DETECTOR,
  TEAM_IDS,
  playDiagnosisText,
  type DiagnosisResult,
} from "@/lib/plays/diagnosis";
import { PLAY_TEAMS } from "@/lib/plays/teams";

type Q = {
  table: string;
  op: "select" | "insert" | "update" | "upsert" | "delete" | "rpc";
  payload?: unknown;
  selected?: string;
  options?: unknown;
  filters: unknown[][];
};
type Reply = { data?: unknown; error?: { message: string } | null } | undefined;
function fakeDb(
  reply: (q: Q) => Reply = () => undefined,
  rpc: (name: string, args: unknown) => Reply = () => ({ data: null }),
) {
  const log: Q[] = [];
  const from = (table: string) => {
    const q: Q = { table, op: "select", filters: [] };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the fake query builder is a Proxy
    const proxy: any = new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === "then") {
            log.push(q);
            const r = reply(q) ?? {};
            const res = { data: r.data ?? null, error: r.error ?? null };
            return (a: (v: unknown) => unknown, b: (e: unknown) => unknown) =>
              Promise.resolve(res).then(a, b);
          }
          return (...args: unknown[]) => {
            if (prop === "insert" || prop === "update" || prop === "upsert" || prop === "delete") {
              q.op = prop;
              q.payload = args[0];
              if (prop === "upsert") q.options = args[1];
            } else if (prop === "select") q.selected = String(args[0] ?? "");
            else if (!["single", "maybeSingle", "order", "limit"].includes(prop))
              q.filters.push([prop, ...args]);
            return proxy;
          };
        },
      },
    );
    return proxy;
  };
  const rpcFn = async (name: string, args: unknown) => {
    log.push({ table: name, op: "rpc", payload: args, filters: [] });
    const r = rpc(name, args);
    return { data: r?.data ?? null, error: r?.error ?? null };
  };
  return { db: { from, rpc: rpcFn } as unknown as ToolCtx["db"], log };
}

const ORG = "org-1";
const ME = "11111111-1111-4111-8111-111111111111";
const ctxWith = (db: ToolCtx["db"], roles: string[] = ["owner"]): ToolCtx => ({
  db,
  orgId: ORG,
  userId: ME,
  roles,
  currency: "EUR",
});
const eq = (q: Q, col: string, val: unknown) =>
  q.filters.some(([op, c, v]) => op === "eq" && c === col && v === val);
const writes = (log: Q[]) => log.filter((q) => q.op !== "select" && q.op !== "rpc");
/** Every query reads only the caller's company: the rule that keeps Telegram (privileged client) safe. */
function expectScoped(log: Q[]) {
  for (const q of log) {
    if (q.op === "rpc") expect((q.payload as { _org?: string })._org, q.table).toBe(ORG);
    else if (q.op === "insert" || q.op === "upsert")
      expect(
        ([q.payload].flat() as { org_id?: string }[]).every((p) => p.org_id === ORG),
        `${q.op} ${q.table}`,
      ).toBe(true);
    else
      expect(
        eq(q, "org_id", ORG) || (q.table === "organizations" && eq(q, "id", ORG)),
        `${q.op} ${q.table}`,
      ).toBe(true);
  }
}

const diag = (motion = "inside_sales") => ({
  input: { model: "b2b", acv: 9000, friction: "committee", stage: "early" },
  result: {
    archetype: "B",
    name: "Arquetipo ficticio",
    motion,
    nextStep: "Define tu ICP",
    active: ["x"],
    discarded: [],
    forced: [],
    star: "z",
  },
});
const POS = [
  "best_customers",
  "alternatives",
  "differentiation",
  "value",
  "trend",
  "target_customer",
  "need",
  "category",
  "key_benefit",
  "competitive_alternative",
  "differentiator",
  "one_liner",
  "elevator_pitch",
];
const fullPositioning = Object.fromEntries(POS.map((k) => [k, `texto ${k}`]));
const icps = [{ industries: "a", company_size: "b", why_fit: "c", anti_icp: "d" }];

/** A row of the in-memory `suggestions` table (only the columns the tools read and write). */
type SRow = {
  id: string;
  org_id: string;
  user_id: string | null;
  dedupe_key: string;
  detector: string;
  status: string;
  priority: number;
  title: string;
  body: string;
  link: string | null;
  action: unknown;
  snoozed_until: string | null;
  notified_at: string | null;
  updated_at: string;
};
type Doc = { title: string; body: string; section: string; scope?: string; mandatory?: boolean };

type World = {
  states?: { play_id: string; enabled: boolean }[];
  statesError?: boolean;
  setupError?: boolean;
  diagnosis?: unknown;
  positioning?: unknown;
  icps?: unknown;
  /** The company's knowledge_docs (voice and rules); a read of a section that fails answers an error. */
  docs?: Doc[];
  voiceError?: boolean;
  rulesError?: boolean;
  /** The suggestions table, changed in place by upsert and update. */
  suggestions?: SRow[];
  suggestionsReadError?: boolean;
  /** Another person writes between the read and the write of save_play_plan. */
  beforeUpsert?: (store: SRow[]) => void;
  beforeUpdate?: (store: SRow[], q: Q) => void;
};

/** Filters eq and in of a recorded query, applied to in-memory rows. */
const matches = (q: Q) => (r: Record<string, unknown>) =>
  q.filters.every(([op, c, v]) =>
    op === "eq"
      ? r[c as string] === v
      : op === "in"
        ? (v as unknown[]).includes(r[c as string])
        : true,
  );
const pick = (r: Record<string, unknown>, cols: string) =>
  Object.fromEntries(cols.split(",").map((c) => [c.trim(), r[c.trim()]]));

/**
 * The in-memory `suggestions` table: the double of onboarding-stalled-sync.test.ts (upsert that ignores duplicates by (org_id, dedupe_key),
 * update over the filtered rows), copied and extended (CA-11): with `.select()`, upsert returns only the rows really inserted and update
 * only the rows really updated, so the counts of save_play_plan can be checked against what the table did.
 */
function suggestionsReply(w: World, q: Q): Reply {
  const store = (w.suggestions ??= []);
  if (q.op === "select") {
    if (w.suggestionsReadError) return { error: { message: "boom" } };
    return { data: store.filter(matches(q)).map((r) => ({ ...r })) };
  }
  if (q.op === "upsert") {
    w.beforeUpsert?.(store);
    const opts = (q.options ?? {}) as { onConflict?: string; ignoreDuplicates?: boolean };
    const inserted: SRow[] = [];
    for (const n of [q.payload].flat() as Partial<SRow>[]) {
      if (store.some((r) => r.org_id === n.org_id && r.dedupe_key === n.dedupe_key)) {
        if (!opts.ignoreDuplicates) return { error: { message: "duplicate key value (23505)" } };
        continue;
      }
      const row = {
        id: `s${store.length + 1}`,
        status: "pending",
        user_id: null,
        priority: 2,
        body: "",
        link: null,
        action: null,
        snoozed_until: null,
        notified_at: null,
        updated_at: "2026-11-12T10:00:00.000Z",
        ...n,
      } as SRow;
      store.push(row);
      inserted.push(row);
    }
    return { data: q.selected === undefined ? null : inserted.map((r) => pick(r, q.selected!)) };
  }
  if (q.op === "update") {
    w.beforeUpdate?.(store, q);
    const hit = store.filter(matches(q));
    for (const r of hit) Object.assign(r, q.payload);
    return { data: q.selected === undefined ? null : hit.map((r) => pick(r, q.selected!)) };
  }
  return { error: { message: `unexpected ${q.op} on suggestions` } };
}

/** A ready company by default (diagnosis, positioning and ICP); each test changes what it needs. */
const world =
  (w: World = {}) =>
  (q: Q): Reply => {
    if (q.table === "play_states")
      return w.statesError ? { error: { message: "boom" } } : { data: w.states ?? [] };
    if (q.table === "icp_profiles")
      return w.setupError ? { error: { message: "setup down" } } : { data: w.icps ?? icps };
    if (q.table === "positioning")
      return { data: "positioning" in w ? w.positioning : fullPositioning };
    if (q.table === "suggestions") return suggestionsReply(w, q);
    if (q.table === "knowledge_docs" && q.op === "select") {
      const section = q.filters.find(([op, c]) => op === "eq" && c === "section")?.[2];
      if (section === "voice" && w.voiceError) return { error: { message: "boom" } };
      if (section === "rules" && w.rulesError) return { error: { message: "boom" } };
      return {
        data: (w.docs ?? [])
          .filter((d) => d.section === section)
          .map((d) => ({ org_id: ORG, scope: "team", mandatory: false, ...d })),
      };
    }
    return undefined;
  };
const rpcOf = (w: World) => () => ({ data: "diagnosis" in w ? w.diagnosis : diag() });

describe("playStateRows reports a failed read", () => {
  it("a good read: ok true and the rows by play id, read with the company filter", async () => {
    const { db, log } = fakeDb(
      world({
        states: [
          { play_id: "crm-hygiene", enabled: true },
          { play_id: "closed-lost-revival", enabled: false },
        ],
      }),
    );
    const r = await playStateRows(ctxWith(db));
    expect(r.ok).toBe(true);
    expect([...r.rows.keys()]).toEqual(["crm-hygiene", "closed-lost-revival"]);
    expect(r.rows.get("crm-hygiene")!.enabled).toBe(true);
    expect(log).toHaveLength(1);
    expect(log[0]!.table).toBe("play_states");
    expect(log[0]!.selected).toBe("play_id,enabled");
    expect(eq(log[0]!, "org_id", ORG)).toBe(true);
  });

  it("an empty table is ok true with no rows (a company that never changed a play)", async () => {
    const r = await playStateRows(ctxWith(fakeDb(world()).db));
    expect(r).toEqual({ ok: true, rows: new Map() });
  });

  it("a failed read is ok false and no rows, never «all defaults» passed off as a good read", async () => {
    const { db } = fakeDb(world({ statesError: true }));
    const r = await playStateRows(ctxWith(db));
    expect(r.ok).toBe(false);
    expect(r.rows.size).toBe(0);
  });
});

describe("planFor: the plan the tools will show and save", () => {
  it("a ready company with no rows gets scenario A of the SDD, and reads without writing", async () => {
    const w: World = {};
    const { db, log } = fakeDb(world(w), rpcOf(w));
    const out = await planFor(ctxWith(db), { bottleneck: null, wanted: [] });
    if (!out.playsOk) throw new Error("expected the plays to be readable");
    expect(out.status.ready).toBe(true);
    if (!out.result.ready) throw new Error("expected a ready result");
    expect(out.result.proposed.map((t) => t.id)).toEqual([
      "priorizar-cuentas-y-crm",
      "reactivar-perdidos",
      "senales-de-cuenta",
    ]);
    expect(out.result.alreadyActive.map((t) => t.id)).toEqual(["reuniones"]);
    expect(out.result.activation.map((a) => a.play_id)).toEqual([
      "hubspot-account-tiering-scoring",
      "signals-in-crm-with-decay",
      "closed-lost-revival",
    ]);
    expect(writes(log)).toEqual([]);
    expectScoped(log);
  });

  it("uses the company's rows: a play already enabled leaves the plan", async () => {
    const w: World = { states: [{ play_id: "hubspot-account-tiering-scoring", enabled: true }] };
    const { db } = fakeDb(world(w), rpcOf(w));
    const out = await planFor(ctxWith(db), { bottleneck: null, wanted: [] });
    if (!out.playsOk || !out.result.ready) throw new Error("expected a ready plan");
    expect(out.result.activation.map((a) => a.play_id)).not.toContain(
      "hubspot-account-tiering-scoring",
    );
  });

  it("uses the answers: a bottleneck goes first", async () => {
    const w: World = {};
    const { db } = fakeDb(world(w), rpcOf(w));
    const out = await planFor(ctxWith(db), { bottleneck: "aprender-de-llamadas", wanted: [] });
    if (!out.playsOk || !out.result.ready) throw new Error("expected a ready plan");
    expect(out.result.proposed[0]!.id).toBe("aprender-de-llamadas");
  });

  it("the archetype comes from the company's diagnosis: a plg motion fits entrantes-y-producto", async () => {
    const w: World = { diagnosis: diag("plg") };
    const { db } = fakeDb(world(w), rpcOf(w));
    const out = await planFor(ctxWith(db), { bottleneck: null, wanted: [] });
    if (!out.playsOk || !out.result.ready) throw new Error("expected a ready plan");
    expect(out.result.proposed.map((t) => t.id)).toContain("entrantes-y-producto");
  });

  it("a failed play_states read gives playsOk false and no plan", async () => {
    const w: World = { statesError: true };
    const { db } = fakeDb(world(w), rpcOf(w));
    const out = await planFor(ctxWith(db), { bottleneck: null, wanted: [] });
    expect(out).toEqual({ playsOk: false });
  });

  it("a company that is not ready (no diagnosis) gets what is missing and no teams", async () => {
    const w: World = { diagnosis: null };
    const { db } = fakeDb(world(w), rpcOf(w));
    const out = await planFor(ctxWith(db), { bottleneck: "reuniones", wanted: [] });
    if (!out.playsOk) throw new Error("expected the plays to be readable");
    expect(out.status.ready).toBe(false);
    expect(out.result).toEqual({ ready: false, missing: ["Diagnóstico GTM sin hacer"] });
  });

  it("only the segments missing does not block: it still proposes", async () => {
    const w: World = {};
    const { db } = fakeDb(world(w), rpcOf(w));
    const out = await planFor(ctxWith(db), { bottleneck: null, wanted: [] });
    if (!out.playsOk) throw new Error("expected the plays to be readable");
    // The fake company has no segments: the status lists it in missing but it does not block ready.
    expect(out.status.missing).toContain("Segmentos sin rango de ACV");
    expect(out.result.ready).toBe(true);
  });

  it("a failed setup read throws instead of inventing a plan", async () => {
    const w: World = { setupError: true };
    const { db } = fakeDb(world(w), rpcOf(w));
    await expect(planFor(ctxWith(db), { bottleneck: null, wanted: [] })).rejects.toThrow();
  });

  it("does not read voice or rules: only onboarding, setup and play_states tables are touched", async () => {
    const w: World = {};
    const { db, log } = fakeDb(world(w), rpcOf(w));
    await planFor(ctxWith(db), { bottleneck: null, wanted: [] });
    expect(log.map((q) => q.table)).not.toContain("knowledge_docs");
    expect(log.map((q) => q.table)).toContain("play_states");
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------
// Session 2: the three tools.

const OTHER_PERSON = "22222222-2222-4222-8222-222222222222";
const T_TIER = "Tiering y puntuación de cuentas";
const T_SIG = "Señales en el CRM con caída en el tiempo";
const T_CLR = "Reactivación de deals perdidos";
const K = (playId: string) => `plays_diagnosis:${playId}`;
const PLAYS_READ_FAILED =
  "No he podido comprobar qué plays tienes activados; inténtalo de nuevo en un momento.";
const SAVE_PLAYS_FAILED = "No he podido comprobar qué plays tienes activados; no guardo el plan.";
const NOTHING_TO_ACTIVATE = "No hay ningún play que activar en los equipos propuestos.";
const NOTHING_ACTIVATED =
  "Ningún play se ha activado: se activa cada uno cuando apruebes su sugerencia.";
const NO_ANSWERS = { bottleneck: null, wanted: [] };

const run = (w: World, tool: string, args: unknown = NO_ANSWERS, roles: string[] = ["owner"]) => {
  const { db, log } = fakeDb(world(w), rpcOf(w));
  return { out: executeTool(ctxWith(db, roles), tool, args), log };
};
type Diagnosed = DiagnosisResult & {
  voz: { ok: boolean; ejemplos?: number; faltan?: number };
  reglas_base: { ok: boolean; faltan?: string[] };
  resumen: string;
};
type Saved = {
  mensaje: string;
  creadas: number;
  reabiertas: number;
  ya_abiertas: number;
  de_otra_persona: number;
  pospuestas: number;
  descartadas: number;
  cambiadas_por_otra_persona: number;
};
const diagnose = async (w: World, args: unknown = NO_ANSWERS, roles?: string[]) =>
  (await run(w, "diagnose_play_teams", args, roles).out) as Diagnosed;
const save = async (w: World, args: unknown = NO_ANSWERS, roles?: string[]) => {
  const r = run(w, "save_play_plan", args, roles);
  return { out: (await r.out) as Saved, log: r.log };
};
const COUNTS = [
  "creadas",
  "reabiertas",
  "ya_abiertas",
  "de_otra_persona",
  "pospuestas",
  "descartadas",
  "cambiadas_por_otra_persona",
] as const;
const total = (o: Saved) => COUNTS.reduce((n, k) => n + o[k], 0);
const occurrences = (text: string, part: string) => text.split(part).length - 1;
const voiceDocs = (n: number): Doc[] =>
  Array.from({ length: n }, (_, i) => ({
    title: `Voz ${i}`,
    body: `Mensaje ficticio ${i}`,
    section: "voice",
  }));
const ruleDocs = (titles: string[]): Doc[] =>
  titles.map((title) => ({ title, body: "Cuerpo ficticio", section: "rules" }));
const srow = (playId: string, o: Partial<SRow> = {}): SRow => ({
  id: `row-${playId}`,
  org_id: ORG,
  user_id: ME,
  dedupe_key: K(playId),
  detector: "plays_diagnosis",
  status: "pending",
  priority: 2,
  title: "Título anterior ficticio",
  body: "Cuerpo anterior ficticio",
  link: "/plays?vista=equipos",
  action: { tool: "set_play_enabled", args: { play_id: playId, enabled: true } },
  snoozed_until: null,
  notified_at: "2026-11-01T08:00:00.000Z",
  updated_at: "2026-11-01T08:00:00.000Z",
  ...o,
});
/** Plays enabled by default, paused in this company, so that one plan reaches seven plays (see «every state at once»). */
const SEVEN: World["states"] = [
  "meeting-form-orchestration",
  "meeting-prep-and-follow-up",
  "crm-hygiene",
  "plg-to-sales",
  "multi-thread-inbound-leads",
].map((play_id) => ({ play_id, enabled: false }));
const SEVEN_ANSWERS = {
  bottleneck: null,
  wanted: ["reuniones", "priorizar-cuentas-y-crm", "entrantes-y-producto"],
};
const srcOf = (f: string) => readFileSync(path.resolve(__dirname, f), "utf8");

describe("diagnose_play_teams (CA-8)", () => {
  it("is a read tool for every member, with the schema of the answers", () => {
    const t = getTool("diagnose_play_teams")!;
    expect(t.kind).toBe("read");
    expect(t.roles).toBeUndefined();
    expect(toolsFor(["ae"]).map((x) => x.name)).toContain("diagnose_play_teams");
    const shape = (t.input as z.ZodObject<z.ZodRawShape>).shape;
    expect(Object.keys(shape).sort()).toEqual(["bottleneck", "wanted"]);
    expect(t.input.parse({ bottleneck: null })).toEqual({ bottleneck: null, wanted: [] });
    expect(t.input.parse({ bottleneck: "reuniones", wanted: ["senales-de-cuenta"] })).toEqual({
      bottleneck: "reuniones",
      wanted: ["senales-de-cuenta"],
    });
    expect(t.input.safeParse({ bottleneck: "no-existe", wanted: [] }).success).toBe(false);
    expect(t.input.safeParse({ bottleneck: null, wanted: ["no-existe"] }).success).toBe(false);
    expect(t.input.safeParse({ bottleneck: null, wanted: [...TEAM_IDS] }).success).toBe(true);
    expect(
      t.input.safeParse({ bottleneck: null, wanted: [...TEAM_IDS, "reuniones"] }).success,
    ).toBe(false);
    expect([...TEAM_IDS]).toEqual(PLAY_TEAMS.map((x) => x.id));
  });

  it("owner, ready company: the prioritised result plus voz, reglas_base and resumen; reads only its company and writes nothing", async () => {
    const w: World = { docs: [...voiceDocs(1), ...ruleDocs(["Nunca inventar", "Otra regla"])] };
    const { db, log } = fakeDb(world(w), rpcOf(w));
    const out = (await executeTool(ctxWith(db), "diagnose_play_teams", NO_ANSWERS)) as Diagnosed;
    const plan = await planFor(ctxWith(fakeDb(world(w), rpcOf(w)).db), NO_ANSWERS);
    if (!plan.playsOk) throw new Error("expected a plan");
    const { voz, reglas_base, resumen, ...result } = out;
    expect(result).toEqual(plan.result);
    expect(voz).toEqual({ ok: true, ejemplos: 1, faltan: 2 });
    expect(reglas_base).toEqual({
      ok: true,
      faltan: defaultRules()
        .map((r) => r.title)
        .filter((t) => t !== "Nunca inventar"),
    });
    expect(resumen).toBe(
      playDiagnosisText(plan.result, {
        voz: voz as never,
        reglas: reglas_base as never,
        canAct: true,
      }),
    );
    expect(resumen).toContain("Te propongo empezar por estos equipos de plays, en este orden:");
    expect(resumen).toContain("Te faltan 8 reglas base; puedo añadirlas si me lo confirmas.");
    expect(resumen).toContain(
      "Nada se activa solo: te dejo cada play como sugerencia y lo activas al aprobarla.",
    );
    expect(writes(log)).toEqual([]);
    expectScoped(log);
  });

  it("an AE gets the same plan, and a resumen that promises no action that role cannot take", async () => {
    const w: World = { docs: ruleDocs(["Nunca inventar"]) };
    const owner = await diagnose(w);
    const { db, log } = fakeDb(world(w), rpcOf(w));
    const ae = (await executeTool(
      ctxWith(db, ["ae"]),
      "diagnose_play_teams",
      NO_ANSWERS,
    )) as Diagnosed;
    const { resumen: _a, ...aeRest } = ae;
    const { resumen: _o, ...ownerRest } = owner;
    expect(aeRest).toEqual(ownerRest);
    expect(ae.resumen).toContain(
      "Te faltan 8 reglas base; pídele a tu Owner o Sales Leader que las añada.",
    );
    expect(ae.resumen).toContain(
      "Nada se activa solo: un Owner o un Sales Leader activa cada play al aprobar su sugerencia.",
    );
    expect(ae.resumen).not.toContain("puedo añadirlas");
    expect(ae.resumen).not.toContain("te dejo cada play");
    expect(writes(log)).toEqual([]);
    expectScoped(log);
  });

  it("a failed voice read is said, never «0 ejemplos»; the rest still comes", async () => {
    const out = await diagnose({ voiceError: true });
    expect(out.voz).toEqual({ ok: false });
    expect(out.resumen).toContain("No he podido comprobar la voz de tu empresa.");
    expect(out.resumen).not.toMatch(/Tienes \d+ de 3/);
    expect(out.reglas_base.ok).toBe(true);
    expect(out.ready).toBe(true);
  });

  it("a failed rules read is said, and reglas_base is not an empty list", async () => {
    const out = await diagnose({ rulesError: true });
    expect(out.reglas_base).toEqual({ ok: false });
    expect(out.resumen).toContain("No he podido comprobar tus reglas.");
    expect(out.resumen).not.toContain("Ya tienes las reglas base.");
    expect(out.voz.ok).toBe(true);
  });

  it("a failed play_states read proposes nothing: only plays_ok false and its sentence", async () => {
    const { out, log } = run({ statesError: true }, "diagnose_play_teams");
    expect(await out).toEqual({ plays_ok: false, resumen: PLAYS_READ_FAILED });
    expect(writes(log)).toEqual([]);
  });

  it("a failed setup read throws instead of inventing a plan", async () => {
    await expect(diagnose({ setupError: true })).rejects.toThrow();
  });

  it("a company that is not ready: what is missing, no teams, and the voice and rules counts", async () => {
    const out = await diagnose(
      { diagnosis: null, docs: voiceDocs(3) },
      { bottleneck: "reuniones", wanted: [] },
    );
    expect(out).toMatchObject({ ready: false, missing: ["Diagnóstico GTM sin hacer"] });
    expect(Object.keys(out).sort()).toEqual(["missing", "ready", "reglas_base", "resumen", "voz"]);
    expect(out.resumen).toBe(
      "Todavía no puedo proponerte equipos de plays. Falta: Diagnóstico GTM sin hacer. /onboarding para el diagnóstico GTM.",
    );
    for (const t of PLAY_TEAMS) expect(out.resumen).not.toContain(t.title);
  });

  it("voice counts: three or more examples is complete; the count never passes three", async () => {
    const out = await diagnose({ docs: voiceDocs(5) });
    expect(out.voz).toEqual({ ok: true, ejemplos: 3, faltan: 0 });
    expect(out.resumen).toContain("Tu voz está completa.");
    const none = await diagnose({});
    expect(none.voz).toEqual({ ok: true, ejemplos: 0, faltan: 3 });
    expect(none.resumen).toContain("Tienes 0 de 3 mensajes de voz.");
  });

  it("uses the answers: the bottleneck goes first", async () => {
    const out = await diagnose({}, { bottleneck: "aprender-de-llamadas", wanted: [] });
    if (!out.ready) throw new Error("expected ready");
    expect(out.proposed[0]!.id).toBe("aprender-de-llamadas");
  });
});

describe("privacy of diagnose_play_teams (CA-9)", () => {
  const VOICE_TEXT = "Hola Marta, te escribo por lo del piloto ficticio de Acme Inventada";
  const RULE_TEXT = "Cuerpo de una regla privada de la empresa ficticia";
  const leaky = {
    input: { model: "b2b", acv: 12345, friction: "committee", stage: "early" },
    result: { ...diag().result },
    proposal: { texto: "propuesta ficticia" },
    findings: ["hallazgo ficticio"],
    opinions: ["opinión ficticia"],
    sources: ["fuente ficticia"],
  };
  const w = (): World => ({
    diagnosis: leaky,
    docs: [
      { title: "Voz", body: VOICE_TEXT, section: "voice" },
      { title: "Regla de la empresa", body: RULE_TEXT, section: "rules" },
    ],
  });
  it("the output carries no voice text, rule body, ACV, nor the keys of the onboarding's private parts", async () => {
    for (const roles of [["owner"], ["ae"]])
      for (const world of [w(), { ...w(), diagnosis: null }, { ...w(), statesError: true }]) {
        const s = JSON.stringify(await diagnose(world, NO_ANSWERS, roles));
        for (const bad of [VOICE_TEXT, RULE_TEXT, "12345", "12.345"]) expect(s).not.toContain(bad);
        for (const key of ["proposal", "findings", "opinions", "sources", "examples"])
          expect(s).not.toContain(`"${key}"`);
      }
  });
  it("reglas_base.faltan only holds titles of defaultRules()", async () => {
    const out = await diagnose({ docs: ruleDocs(["Regla propia ficticia", "Nunca inventar"]) });
    const base = new Set(defaultRules().map((r) => r.title));
    expect(out.reglas_base.faltan!.length).toBe(8);
    for (const t of out.reglas_base.faltan!) expect(base.has(t)).toBe(true);
  });
});

describe("the same status read (CA-10)", () => {
  it("get_onboarding_status and the plays diagnosis both read through onboardingStatusFor", () => {
    expect(srcOf("onboarding.ts")).toMatch(/run: \(c\) => onboardingStatusFor\(c\)/);
    const src = srcOf("play-diagnosis.ts");
    expect(src).toMatch(/onboardingStatusFor\(c\)/);
    expect(src).not.toMatch(/companyOnboardingStatus|loadSetupData|companyDiagnosisFor/);
  });
  it("on the same company they agree on ready and on what blocks it", async () => {
    for (const w of [{}, { diagnosis: null }, { icps: [] }] as World[]) {
      const status = (await run(w, "get_onboarding_status", {}).out) as {
        ready: boolean;
        missing: string[];
      };
      const out = await diagnose(w);
      expect(out.ready).toBe(status.ready);
      if (!out.ready)
        expect(out.missing).toEqual(status.missing.filter((m) => !m.startsWith("Segmentos")));
    }
  });
});

const descriptionOf = (n: string) => getTool(n)!.description;

describe("the rules travel with the tools for Telegram and MCP (CA-20)", () => {
  it("diagnose_play_teams says how to tell the result, what to ask first, the six options, and where voice goes", () => {
    const d = descriptionOf("diagnose_play_teams");
    expect(d).toContain("cuenta el resultado a partir de resumen");
    expect(d).toContain(
      "no añadas equipos de plays, plays, motivos ni cifras que no estén en la respuesta",
    );
    expect(d).toContain(
      "pregunta antes cuál es su cuello de botella y qué otras tareas quiere resolver",
    );
    for (const phrase of Object.values(BOTTLENECK_WORD)) expect(d).toContain(phrase);
    expect(d).toContain("los mensajes de voz se pegan en Conocimiento › Voz, nunca en el chat");
  });
  it("resumen with voice examples missing says not to paste them in the chat", async () => {
    const out = await diagnose({ docs: voiceDocs(2) });
    expect(out.voz).toEqual({ ok: true, ejemplos: 2, faltan: 1 });
    expect(out.resumen).toContain("no los pegues en el chat");
  });
});
