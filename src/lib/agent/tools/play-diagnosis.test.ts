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
import { DEFAULT_RULES_READ_FAILED, defaultRules } from "@/lib/default-rules";
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

describe("save_play_plan (CA-11)", () => {
  it("is a write for Owner and Sales Leader, with the same answers as diagnose_play_teams and its summary", () => {
    const t = getTool("save_play_plan")!;
    expect(t.kind).toBe("write");
    expect(t.roles).toEqual(["owner", "sales_leader"]);
    expect(t.summarize!(NO_ANSWERS)).toBe(
      "Guardar el plan de equipos de plays como sugerencias (no activa ningún play)",
    );
    const d = getTool("diagnose_play_teams")!;
    for (const args of [
      { bottleneck: null },
      { bottleneck: "reuniones", wanted: ["senales-de-cuenta"] },
    ])
      expect(t.input.parse(args)).toEqual(d.input.parse(args));
    for (const bad of [{ bottleneck: "x" }, { bottleneck: null, wanted: ["x"] }])
      expect(t.input.safeParse(bad).success).toBe(false);
    expect(toolsFor(["ae"]).map((x) => x.name)).not.toContain("save_play_plan");
    expect(toolsFor(["sales_leader"]).map((x) => x.name)).toContain("save_play_plan");
  });

  it("an AE is refused by executeTool and nothing is read or written", async () => {
    const { out, log } = run({}, "save_play_plan", NO_ANSWERS, ["ae"]);
    await expect(out).rejects.toThrow("Tu rol no permite esta acción");
    expect(log).toEqual([]);
  });

  it("creates one suggestion per play of the plan, with the fields of section 9, and activates nothing", async () => {
    const w: World = {};
    const { out, log } = await save(w);
    expect(out).toEqual({
      mensaje: `Te he dejado 3 sugerencias nuevas en Sugerencias. ${NOTHING_ACTIVATED}`,
      creadas: 3,
      reabiertas: 0,
      ya_abiertas: 0,
      de_otra_persona: 0,
      pospuestas: 0,
      descartadas: 0,
      cambiadas_por_otra_persona: 0,
    });
    const upsert = writes(log).find((q) => q.op === "upsert")!;
    expect(upsert.table).toBe("suggestions");
    expect(upsert.options).toEqual({ onConflict: "org_id,dedupe_key", ignoreDuplicates: true });
    expect(upsert.selected).toBe("dedupe_key");
    const byKey = new Map(w.suggestions!.map((r) => [r.dedupe_key, r]));
    expect([...byKey.keys()]).toEqual([
      K("hubspot-account-tiering-scoring"),
      K("signals-in-crm-with-decay"),
      K("closed-lost-revival"),
    ]);
    expect(byKey.get(K("signals-in-crm-with-decay"))).toMatchObject({
      org_id: ORG,
      user_id: ME,
      detector: "plays_diagnosis",
      priority: 2,
      status: "pending",
      title: `Activa «${T_SIG}»`,
      body: "Del plan de tu diagnóstico de plays. Avanza: Reactivar perdidos, Señales de cuenta. Al aprobarla se activa este play; nada más.",
      link: "/plays?vista=equipos",
      action: {
        tool: "set_play_enabled",
        args: { play_id: "signals-in-crm-with-decay", enabled: true },
      },
    });
    expect(byKey.get(K("hubspot-account-tiering-scoring"))!.title).toBe(`Activa «${T_TIER}»`);
    expect(byKey.get(K("closed-lost-revival"))!.body).toBe(
      "Del plan de tu diagnóstico de plays. Avanza: Reactivar perdidos. Al aprobarla se activa este play; nada más.",
    );
    for (const r of w.suggestions!) {
      expect(r.priority).not.toBe(1);
      expect(r.title).not.toMatch(/Paso|\d/);
      expect(r.body).not.toMatch(/Paso|\d/);
      expect(r.title).not.toContain((r.action as { args: { play_id: string } }).args.play_id);
    }
    expect(writes(log).map((q) => q.table)).toEqual(["suggestions"]);
    expect(log.some((q) => q.table === "play_states" && q.op !== "select")).toBe(false);
    expectScoped(log);
  });

  it("names the play by its catalogue title in the title, the body, the mensaje and resumen, never by its id", async () => {
    const w: World = { suggestions: [srow("signals-in-crm-with-decay", { status: "dismissed" })] };
    const { out } = await save(w);
    expect(out.mensaje).toContain(`No he vuelto a dejar lo que descartaste: «${T_SIG}».`);
    expect(out.mensaje).not.toContain("signals-in-crm-with-decay");
    expect(w.suggestions!.find((r) => r.dedupe_key === K("closed-lost-revival"))!.title).toBe(
      `Activa «${T_CLR}»`,
    );
    const d = await diagnose({});
    expect(d.resumen).toContain(`2. ${T_SIG} (Reactivar perdidos, Señales de cuenta)`);
    expect(d.resumen).not.toContain("signals-in-crm-with-decay");
  });

  it("repeating the same plan does not duplicate: same keys, nothing new, and says they were open", async () => {
    const w: World = {};
    await save(w);
    const { out, log } = await save(w);
    expect(w.suggestions).toHaveLength(3);
    expect(out).toMatchObject({ creadas: 0, reabiertas: 0, ya_abiertas: 3 });
    expect(out.mensaje).toBe(
      `No he dejado ninguna sugerencia nueva. Ya estaban abiertas: «${T_TIER}», «${T_SIG}», «${T_CLR}». ${NOTHING_ACTIVATED}`,
    );
    expect(writes(log)).toEqual([]);
  });

  it("counts the rows the table really inserted or reopened: 1 dismissed + 1 approved reopened + 1 without row is «2», not «3»", async () => {
    const w: World = {
      suggestions: [
        srow("hubspot-account-tiering-scoring", { status: "dismissed" }),
        srow("signals-in-crm-with-decay", { status: "approved", user_id: OTHER_PERSON }),
      ],
    };
    const { out } = await save(w);
    expect(out).toMatchObject({ creadas: 1, reabiertas: 1, descartadas: 1 });
    expect(total(out)).toBe(3);
    expect(out.mensaje).toBe(
      `Te he dejado 2 sugerencias nuevas en Sugerencias. No he vuelto a dejar lo que descartaste: «${T_TIER}». ${NOTHING_ACTIVATED}`,
    );
    expect(
      w.suggestions!.find((r) => r.dedupe_key === K("hubspot-account-tiering-scoring"))!.status,
    ).toBe("dismissed");
  });

  it("one new suggestion is said in singular", async () => {
    const w: World = {
      suggestions: [srow("hubspot-account-tiering-scoring"), srow("signals-in-crm-with-decay")],
    };
    const { out } = await save(w);
    expect(out.mensaje.startsWith("Te he dejado una sugerencia nueva en Sugerencias. ")).toBe(true);
  });

  it("a reopened row is yours, pending, with the current text and action, through a guarded update", async () => {
    const w: World = {
      suggestions: [
        srow("signals-in-crm-with-decay", {
          status: "resolved",
          user_id: OTHER_PERSON,
          snoozed_until: "2026-11-02T00:00:00.000Z",
          action: { tool: "set_play_enabled", args: { play_id: "otro", enabled: false } },
        }),
      ],
    };
    const { out, log } = await save(w);
    expect(out.reabiertas).toBe(1);
    const r = w.suggestions!.find((x) => x.dedupe_key === K("signals-in-crm-with-decay"))!;
    expect(r).toMatchObject({
      status: "pending",
      user_id: ME,
      snoozed_until: null,
      notified_at: null,
      title: `Activa «${T_SIG}»`,
      body: "Del plan de tu diagnóstico de plays. Avanza: Reactivar perdidos, Señales de cuenta. Al aprobarla se activa este play; nada más.",
      action: {
        tool: "set_play_enabled",
        args: { play_id: "signals-in-crm-with-decay", enabled: true },
      },
    });
    expect(r.updated_at).not.toBe("2026-11-01T08:00:00.000Z");
    const upd = writes(log).find((q) => q.op === "update")!;
    expect(eq(upd, "id", `row-signals-in-crm-with-decay`)).toBe(true);
    expect(eq(upd, "status", "resolved")).toBe(true);
    expect(eq(upd, "org_id", ORG)).toBe(true);
    expect(upd.selected).toBe("id");
    expect(writes(log).every((q) => q.table === "suggestions")).toBe(true);
  });

  it("pending of another person is only «de otra persona»; pending without owner is «ya abierta»", async () => {
    const w: World = {
      suggestions: [
        srow("hubspot-account-tiering-scoring", { user_id: OTHER_PERSON }),
        srow("signals-in-crm-with-decay", { user_id: null }),
      ],
    };
    const { out } = await save(w);
    expect(out).toMatchObject({ creadas: 1, de_otra_persona: 1, ya_abiertas: 1 });
    expect(out.mensaje).toBe(
      `Te he dejado una sugerencia nueva en Sugerencias. Ya estaban abiertas: «${T_SIG}». Están abiertas a nombre de otra persona y no las verás en tu Sugerencias: «${T_TIER}». ${NOTHING_ACTIVATED}`,
    );
    expect(occurrences(out.mensaje, T_TIER)).toBe(1);
    expect(
      w.suggestions!.find((r) => r.dedupe_key === K("hubspot-account-tiering-scoring"))!.user_id,
    ).toBe(OTHER_PERSON);
  });

  it("snoozed, also of another person, is only «pospuesta» and is not touched", async () => {
    const w: World = {
      suggestions: [
        srow("closed-lost-revival", {
          status: "snoozed",
          user_id: OTHER_PERSON,
          snoozed_until: "2999-01-01T00:00:00.000Z",
        }),
      ],
    };
    const { out } = await save(w);
    expect(out).toMatchObject({ creadas: 2, pospuestas: 1, de_otra_persona: 0, ya_abiertas: 0 });
    expect(out.mensaje).toContain(
      `Están pospuestas y no se pueden aprobar hasta que despierten: «${T_CLR}».`,
    );
    expect(occurrences(out.mensaje, T_CLR)).toBe(1);
    expect(w.suggestions!.find((r) => r.dedupe_key === K("closed-lost-revival"))).toMatchObject({
      status: "snoozed",
      user_id: OTHER_PERSON,
    });
  });

  it("a row another person created between the read and the upsert, and one another person decided before the update, are «cambiadas»", async () => {
    const w: World = {
      suggestions: [srow("closed-lost-revival", { status: "approved" })],
      beforeUpsert: (store) => {
        if (!store.some((r) => r.dedupe_key === K("signals-in-crm-with-decay")))
          store.push(srow("signals-in-crm-with-decay", { id: "race-1", user_id: OTHER_PERSON }));
      },
      beforeUpdate: (store, q) => {
        const id = q.filters.find(([op, c]) => op === "eq" && c === "id")?.[2];
        const hit = store.find((r) => r.id === id);
        if (hit && hit.dedupe_key === K("closed-lost-revival")) hit.status = "dismissed";
      },
    };
    const { out } = await save(w);
    expect(out).toMatchObject({ creadas: 1, reabiertas: 0, cambiadas_por_otra_persona: 2 });
    expect(total(out)).toBe(3);
    expect(out.mensaje).toBe(
      `Te he dejado una sugerencia nueva en Sugerencias. Otra persona las cambió mientras guardaba: «${T_SIG}», «${T_CLR}». ${NOTHING_ACTIVATED}`,
    );
    // The row of the other person is not overwritten, and the decision of the other person stands.
    expect(w.suggestions!.find((r) => r.id === "race-1")!.user_id).toBe(OTHER_PERSON);
    expect(w.suggestions!.find((r) => r.dedupe_key === K("closed-lost-revival"))!.status).toBe(
      "dismissed",
    );
  });

  it("every state at once: each play is in exactly one of the seven categories, named once, and they add up to the plan", async () => {
    const plan = await diagnose({ states: SEVEN }, SEVEN_ANSWERS);
    if (!plan.ready) throw new Error("expected ready");
    const a = plan.activation;
    expect(a).toHaveLength(7);
    const [created, reopened, mine, others, snoozed, dismissed, raced] = a.map(
      (s) => s.play_id,
    ) as [string, string, string, string, string, string, string];
    const w: World = {
      states: SEVEN,
      suggestions: [
        srow(reopened, { status: "approved" }),
        srow(mine),
        srow(others, { user_id: OTHER_PERSON }),
        srow(snoozed, { status: "snoozed", snoozed_until: "2999-01-01T00:00:00.000Z" }),
        srow(dismissed, { status: "dismissed" }),
        srow(raced, { status: "resolved" }),
      ],
      beforeUpdate: (store, q) => {
        const id = q.filters.find(([op, c]) => op === "eq" && c === "id")?.[2];
        const hit = store.find((r) => r.id === id);
        if (hit && hit.dedupe_key === K(raced)) hit.status = "approved";
      },
    };
    const { out } = await save(w, SEVEN_ANSWERS);
    expect(out).toMatchObject({
      creadas: 1,
      reabiertas: 1,
      ya_abiertas: 1,
      de_otra_persona: 1,
      pospuestas: 1,
      descartadas: 1,
      cambiadas_por_otra_persona: 1,
    });
    expect(total(out)).toBe(a.length);
    const title = (id: string) => CATALOG.find((p) => p.id === id)!.title;
    expect(out.mensaje).toBe(
      [
        "Te he dejado 2 sugerencias nuevas en Sugerencias.",
        `Ya estaban abiertas: «${title(mine)}».`,
        `Están abiertas a nombre de otra persona y no las verás en tu Sugerencias: «${title(others)}».`,
        `Están pospuestas y no se pueden aprobar hasta que despierten: «${title(snoozed)}».`,
        `No he vuelto a dejar lo que descartaste: «${title(dismissed)}».`,
        `Otra persona las cambió mientras guardaba: «${title(raced)}».`,
        NOTHING_ACTIVATED,
      ].join(" "),
    );
    for (const id of [mine, others, snoozed, dismissed, raced])
      expect(occurrences(out.mensaje, `«${title(id)}»`), id).toBe(1);
    for (const id of [created, reopened]) expect(out.mensaje).not.toContain(title(id));
    expect(new Set(w.suggestions!.map((r) => r.dedupe_key)).size).toBe(w.suggestions!.length);
  });

  it("the probe of gate pass 3: save, approve one and enable another in /plays, save again: no repeated or numbered titles", async () => {
    const w: World = {};
    await save(w);
    // 2.º: the suggestion of «Señales…» is approved (its play gets enabled) and «Tiering…» is enabled from /plays.
    w.suggestions!.find((r) => r.dedupe_key === K("signals-in-crm-with-decay"))!.status =
      "approved";
    w.states = [
      { play_id: "signals-in-crm-with-decay", enabled: true },
      { play_id: "hubspot-account-tiering-scoring", enabled: true },
    ];
    const { out } = await save(w);
    expect(out).toMatchObject({ creadas: 1, ya_abiertas: 1 });
    expect(total(out)).toBe(2);
    const titles = w.suggestions!.map((r) => r.title);
    expect(new Set(titles).size).toBe(titles.length);
    for (const t of titles) expect(t).toMatch(/^Activa «[^«»\d]+»$/);
    // A third time changes nothing.
    const third = await save(w);
    expect(third.out).toMatchObject({ creadas: 0, ya_abiertas: 2 });
    expect(w.suggestions!.map((r) => r.title)).toEqual(titles);
  });

  it("recomputes with the data of the moment: a play enabled since the proposal leaves the plan", async () => {
    const w: World = { states: [{ play_id: "hubspot-account-tiering-scoring", enabled: true }] };
    await save(w);
    expect(w.suggestions!.map((r) => r.dedupe_key)).not.toContain(
      K("hubspot-account-tiering-scoring"),
    );
  });

  it("voice and rules failing do not stop the save; it does not even read them", async () => {
    const w: World = { voiceError: true, rulesError: true };
    const { out, log } = await save(w);
    expect(out.creadas).toBe(3);
    expect(log.some((q) => q.table === "knowledge_docs")).toBe(false);
  });

  it("a failed play_states read says so and writes nothing", async () => {
    const { out, log } = run({ statesError: true }, "save_play_plan");
    await expect(out).rejects.toThrow(SAVE_PLAYS_FAILED);
    expect(writes(log)).toEqual([]);
  });

  it("a failed suggestions read throws and writes nothing", async () => {
    const { out, log } = run({ suggestionsReadError: true }, "save_play_plan");
    await expect(out).rejects.toThrow();
    expect(writes(log)).toEqual([]);
  });

  it("a company that is not ready gets «Todavía no puedo guardar un plan: falta …» and nothing is written", async () => {
    const { out, log } = run({ diagnosis: null }, "save_play_plan");
    await expect(out).rejects.toThrow(
      "Todavía no puedo guardar un plan: falta Diagnóstico GTM sin hacer.",
    );
    expect(writes(log)).toEqual([]);
  });

  it("with nothing to activate it says so and writes nothing", async () => {
    const all = CATALOG.map((p) => ({ play_id: p.id, enabled: true }));
    const { out, log } = run({ states: all }, "save_play_plan");
    await expect(out).rejects.toThrow(NOTHING_TO_ACTIVATE);
    expect(writes(log)).toEqual([]);
  });

  it("never activates: the module imports no toggle nor plays.functions and calls no activation", () => {
    const src = srcOf("play-diagnosis.ts");
    const specifiers = [...src.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]!);
    for (const s of specifiers) expect(s).not.toMatch(/toggle|plays\.functions/);
    expect(src).not.toMatch(/togglePlay|setPlayEnabled|executeTool\(|from\("play_states"\)/);
  });
});

describe("add_default_rules (CA-14)", () => {
  it("is a write for Owner and Sales Leader, with no input and its summary", () => {
    const t = getTool("add_default_rules")!;
    expect(t.kind).toBe("write");
    expect(t.roles).toEqual(["owner", "sales_leader"]);
    expect(Object.keys((t.input as z.ZodObject<z.ZodRawShape>).shape)).toEqual([]);
    expect(t.summarize!({})).toBe("Añadir las reglas base que falten a Reglas");
    expect(toolsFor(["ae"]).map((x) => x.name)).not.toContain("add_default_rules");
  });

  it("adds the nine to an empty Reglas and says how many", async () => {
    const { out, log } = run({}, "add_default_rules", {});
    expect(await out).toEqual({
      added: 9,
      titles: defaultRules().map((r) => r.title),
      mensaje: "He añadido 9 reglas base a Reglas.",
    });
    const ins = writes(log);
    expect(ins.map((q) => [q.table, q.op])).toEqual([["knowledge_docs", "insert"]]);
    expect((ins[0]!.payload as unknown[]).length).toBe(9);
    expectScoped(log);
  });

  it("with every base rule present it adds none and says so", async () => {
    const { out, log } = run(
      { docs: ruleDocs(defaultRules().map((r) => r.title)) },
      "add_default_rules",
      {},
    );
    expect(await out).toEqual({
      added: 0,
      titles: [],
      mensaje: "Ya tenías todas las reglas base.",
    });
    expect(writes(log)).toEqual([]);
  });

  it("one missing rule is said in singular (coordinator's copy decision, extended)", async () => {
    const have = defaultRules()
      .map((r) => r.title)
      .slice(1);
    const { out } = run({ docs: ruleDocs(have) }, "add_default_rules", {});
    expect(((await out) as { mensaje: string }).mensaje).toBe("He añadido 1 regla base a Reglas.");
  });

  it("a failed read throws DEFAULT_RULES_READ_FAILED and writes nothing", async () => {
    const { out, log } = run({ rulesError: true }, "add_default_rules", {});
    await expect(out).rejects.toThrow(DEFAULT_RULES_READ_FAILED);
    expect(writes(log)).toEqual([]);
  });

  it("an AE is refused", async () => {
    const { out, log } = run({}, "add_default_rules", {}, ["ae"]);
    await expect(out).rejects.toThrow("Tu rol no permite esta acción");
    expect(log).toEqual([]);
  });
});

describe("the measure of G-1 (CA-15)", () => {
  it("PLAYS_DIAGNOSIS_DETECTOR is plays_diagnosis and the saved rows carry it", async () => {
    expect(PLAYS_DIAGNOSIS_DETECTOR).toBe("plays_diagnosis");
    const w: World = {};
    await save(w);
    for (const r of w.suggestions!) expect(r.detector).toBe(PLAYS_DIAGNOSIS_DETECTOR);
  });

  it("no source file outside tests and diagnosis.ts writes a plays_diagnosis detector (regression guard)", () => {
    const root = path.resolve(__dirname, "../../..");
    const re = /detector:\s*["']plays_diagnosis["']/;
    const hits = (readdirSync(root, { recursive: true }) as string[])
      .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f))
      .filter((f) => !f.endsWith(path.join("plays", "diagnosis.ts")))
      .filter((f) => re.test(readFileSync(path.join(root, f), "utf8")));
    expect(hits).toEqual([]);
    expect(re.test('{ detector: "plays_diagnosis" }')).toBe(true);
  });
});

describe("titles and manifest (CA-18)", () => {
  const NAMES = {
    diagnose_play_teams: "Diagnosticar equipos de plays",
    save_play_plan: "Guardar el plan de equipos de plays",
    add_default_rules: "Añadir las reglas base",
  };
  it("have their MCP titles and are once in the registry, right after get_onboarding_status", () => {
    const names = TOOLS.map((t) => t.name);
    for (const [n, title] of Object.entries(NAMES)) {
      expect(TITLES[n], n).toBe(title);
      expect(
        names.filter((x) => x === n),
        n,
      ).toHaveLength(1);
    }
    const at = names.indexOf("get_onboarding_status");
    expect(names.slice(at + 1, at + 4)).toEqual(Object.keys(NAMES));
  });
});

const descriptionOf = (n: string) => getTool(n)!.description;
const wordSources = () => [
  descriptionOf("diagnose_play_teams"),
  descriptionOf("save_play_plan"),
  descriptionOf("add_default_rules"),
  getWorkflow("plays_diagnosis")!.instructions,
];

describe("words of the tools and the flow (CA-19)", () => {
  it("never «Equipo»/«Equipos» capitalised unless followed by « de plays»", () => {
    for (const s of wordSources()) expect(s).not.toMatch(/\bEquipos?\b(?! de plays)/);
  });
  it("never calls a team of plays an agent", () => {
    for (const s of wordSources()) expect(s).not.toMatch(/equipos? de plays[^.]*\bagentes?\b/i);
  });
  it("never usted, ustedes, vos or vosotros", () => {
    for (const s of wordSources()) expect(s).not.toMatch(/\b(usted|ustedes|vos|vosotros)\b/i);
  });
});

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
  it("save_play_plan says to use the same answers and that it activates no play", () => {
    const d = descriptionOf("save_play_plan");
    expect(d).toContain("usa las mismas respuestas que diagnose_play_teams");
    expect(d).toContain("no activa ningún play");
  });
  it("resumen with voice examples missing says not to paste them in the chat", async () => {
    const out = await diagnose({ docs: voiceDocs(2) });
    expect(out.voz).toEqual({ ok: true, ejemplos: 2, faltan: 1 });
    expect(out.resumen).toContain("no los pegues en el chat");
  });
});
