// SDD-20261106 plays-library-core U-6 (CA-18, CA-19): list_plays, get_play and set_play_enabled in the agent registry and the MCP manifest.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TOOLS, canUseTool, executeTool, getTool, type ToolCtx } from "@/lib/agent/tools";
import { TITLES } from "@/lib/mcp/tools/agent-tools";
import { CATALOG } from "@/lib/plays/catalog";
import { APPROVAL_WORD, PHASE_WORD } from "@/lib/plays/view";

// A fake Supabase client: records every query and answers from `reply` (same idea as agent-tools.test.ts).
type Q = {
  table: string;
  op: "select" | "insert" | "update" | "upsert" | "delete";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the fake records whatever each tool wrote
  payload?: any;
  filters: unknown[][];
};
function fakeDb(
  reply: (q: Q) => { data?: unknown; error?: { message: string } | null } | undefined = () =>
    undefined,
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
              if (prop === "upsert")
                q.filters.push([
                  "onConflict",
                  (args[1] as { onConflict?: string } | undefined)?.onConflict,
                ]);
            } else if (!["select", "single", "maybeSingle", "order", "limit"].includes(prop))
              q.filters.push([prop, ...args]);
            return proxy;
          };
        },
      },
    );
    return proxy;
  };
  return { db: { from } as unknown as ToolCtx["db"], log };
}
const ORG = "org-1";
const ME = "11111111-1111-4111-8111-111111111111";
const ctxWith = (db: ToolCtx["db"], roles: string[]): ToolCtx => ({
  db,
  orgId: ORG,
  userId: ME,
  roles,
  currency: "EUR",
});
const eq = (q: Q, col: string, val: unknown) =>
  q.filters.some(([op, c, v]) => op === "eq" && c === col && v === val);
const writes = (log: Q[]) => log.filter((q) => q.op !== "select");
/** Every query reads or writes only the caller's company: the rule that keeps Telegram (privileged client) safe. */
function expectScoped(log: Q[]) {
  for (const q of log) {
    if (q.op === "insert" || q.op === "upsert") {
      const payloads = [q.payload].flat() as { org_id?: string }[];
      expect(
        payloads.every((p) => p.org_id === ORG),
        `${q.op} ${q.table}`,
      ).toBe(true);
    } else expect(eq(q, "org_id", ORG), `${q.op} ${q.table}`).toBe(true);
  }
}
const states = (rows: { play_id: string; enabled: boolean }[]) => (q: Q) =>
  q.table === "play_states" ? { data: rows } : undefined;
type PlayRow = {
  id: string;
  enabled: boolean;
  canEnable: boolean;
  label: string;
  reason: string | null;
  status: string;
};

describe("list_plays and get_play (CA-18, G-3)", () => {
  it("are read tools for any member", () => {
    for (const n of ["list_plays", "get_play"]) {
      const t = getTool(n)!;
      expect(t.kind, n).toBe("read");
      expect(t.roles, n).toBeUndefined();
      expect(canUseTool(t, ["ae"]), n).toBe(true);
    }
  });

  it("list_plays returns the 28 plays with the state of the company: rows win, the default fills the rest", async () => {
    const { db, log } = fakeDb(states([{ play_id: "crm-hygiene", enabled: false }]));
    const out = (await executeTool(ctxWith(db, ["ae"]), "list_plays", {})) as { plays: PlayRow[] };
    expect(out.plays).toHaveLength(28);
    const by = Object.fromEntries(out.plays.map((p) => [p.id, p]));
    expect(by["crm-hygiene"]).toMatchObject({ enabled: false, label: "Pausado" });
    expect(by["plg-to-sales"]).toMatchObject({ enabled: true, label: "Activado" });
    expect(by["new-hire-tracking"]).toMatchObject({
      enabled: false,
      canEnable: false,
      label: "Bloqueado: falta una decisión de LinkedIn",
    });
    expect(writes(log)).toHaveLength(0);
    expectScoped(log);
  });

  it("list_plays filters by motion and by status", async () => {
    const { db } = fakeDb();
    const blocked = (await executeTool(ctxWith(db, ["ae"]), "list_plays", {
      status: "bloqueado",
    })) as { plays: PlayRow[] };
    expect(blocked.plays.length).toBe(CATALOG.filter((p) => p.status === "bloqueado").length);
    expect(blocked.plays.every((p) => p.status === "bloqueado")).toBe(true);
    const motion = (await executeTool(ctxWith(db, ["ae"]), "list_plays", {
      motion: "producto",
    })) as { plays: PlayRow[] };
    expect(motion.plays.map((p) => p.id).sort()).toEqual(
      CATALOG.filter((p) => p.motion.includes("producto"))
        .map((p) => p.id)
        .sort(),
    );
  });

  it("get_play returns one play, and a clear error for an id that is not in the catalogue", async () => {
    const { db, log } = fakeDb(states([{ play_id: "signal-activation", enabled: false }]));
    const p = (await executeTool(ctxWith(db, ["ae"]), "get_play", {
      play_id: "signal-activation",
    })) as PlayRow & { needs: string[]; detectors: string[] };
    expect(p).toMatchObject({
      id: "signal-activation",
      enabled: false,
      detectors: ["account_signal"],
    });
    expect(p.needs.length).toBeGreaterThan(0);
    expectScoped(log);
    await expect(
      executeTool(ctxWith(db, ["ae"]), "get_play", { play_id: "no-existe" }),
    ).rejects.toThrow(/No existe el play/);
  });

  it("an empty or failing play_states read still lists the plays by default instead of failing", async () => {
    const { db } = fakeDb((q) =>
      q.table === "play_states" ? { error: { message: "relation does not exist" } } : undefined,
    );
    const out = (await executeTool(ctxWith(db, ["ae"]), "list_plays", {})) as { plays: PlayRow[] };
    expect(out.plays.find((p) => p.id === "crm-hygiene")?.enabled).toBe(true);
  });
});

// SDD-20261110-plays-phase-autonomy-deps U-4 (CA-4).
describe("phase and approval in list_plays and get_play (CA-4, G-1)", () => {
  type Phased = PlayRow & {
    phase: string;
    phaseLabel: string;
    approval: string;
    approvalLabel: string;
  };

  it("list_plays gives every play its phase and approval level with the words of the screen", async () => {
    const { db } = fakeDb();
    const out = (await executeTool(ctxWith(db, ["ae"]), "list_plays", {})) as { plays: Phased[] };
    expect(out.plays).toHaveLength(28);
    for (const p of out.plays) {
      const c = CATALOG.find((x) => x.id === p.id)!;
      expect(p.phase, p.id).toBe(c.phase);
      expect(p.phaseLabel, p.id).toBe(PHASE_WORD[c.phase]);
      expect(p.approval, p.id).toBe(c.approval);
      expect(p.approvalLabel, p.id).toBe(APPROVAL_WORD[c.approval]);
    }
  });

  it("get_play gives the same words for one play", async () => {
    const { db } = fakeDb();
    const p = (await executeTool(ctxWith(db, ["ae"]), "get_play", {
      play_id: "signal-activation",
    })) as Phased;
    expect(p).toMatchObject({
      phase: "orquestacion",
      phaseLabel: "Orquestación",
      approval: "nokko_borrador",
      approvalLabel: "NOKKO redacta, tú apruebas",
    });
  });

  it("list_plays keeps its input as it was: motion and status only, no phase filter", () => {
    const shape = (getTool("list_plays")!.input as unknown as { shape: object }).shape;
    expect(Object.keys(shape).sort()).toEqual(["motion", "status"]);
  });

  it("tells the assistant about the new fields in the descriptions", () => {
    for (const n of ["list_plays", "get_play"]) expect(getTool(n)!.description, n).toMatch(/fase/i);
  });
});

describe("set_play_enabled (CA-18, CA-9, G-3)", () => {
  const OWNER = ["owner"];
  it("is a write tool for owner and sales_leader only, with a summary", () => {
    const t = getTool("set_play_enabled")!;
    expect(t.kind).toBe("write");
    expect(t.roles).toEqual(["owner", "sales_leader"]);
    expect(canUseTool(t, ["owner"])).toBe(true);
    expect(canUseTool(t, ["sales_leader"])).toBe(true);
    expect(canUseTool(t, ["ae"])).toBe(false);
    expect(t.summarize?.({ play_id: "closed-lost-revival", enabled: true })).toBe(
      "Activar el play «Reactivación de deals perdidos»",
    );
    expect(t.summarize?.({ play_id: "crm-hygiene", enabled: false })).toBe(
      "Pausar el play «Higiene del CRM»",
    );
  });

  it("refuses a role that cannot use it before touching anything", async () => {
    const { db, log } = fakeDb();
    await expect(
      executeTool(ctxWith(db, ["ae"]), "set_play_enabled", {
        play_id: "crm-hygiene",
        enabled: false,
      }),
    ).rejects.toThrow(/rol no permite/);
    expect(log).toHaveLength(0);
  });

  it("on confirm, saves one row of the company with who decided it", async () => {
    const { db, log } = fakeDb();
    await executeTool(ctxWith(db, OWNER), "set_play_enabled", {
      play_id: "closed-lost-revival",
      enabled: true,
    });
    const w = writes(log);
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({
      table: "play_states",
      op: "upsert",
      payload: { org_id: ORG, play_id: "closed-lost-revival", enabled: true, updated_by: ME },
    });
    expect(w[0]!.filters).toContainEqual(["onConflict", "org_id,play_id"]);
    expectScoped(log);
  });

  it("a blocked or planned play cannot be activated: the error says what blocks it and what to decide, and nothing is written", async () => {
    for (const id of ["brand-mentions-monitoring", "pain-qualified-segments"]) {
      const { db, log } = fakeDb();
      await expect(
        executeTool(ctxWith(db, OWNER), "set_play_enabled", { play_id: id, enabled: true }),
        id,
      ).rejects.toThrow(/^No puedes activar este play todavía: .+\. .+\.$/);
      expect(writes(log), id).toHaveLength(0);
    }
  });

  it("refuses an id that is not in the catalogue and writes nothing", async () => {
    const { db, log } = fakeDb();
    await expect(
      executeTool(ctxWith(db, OWNER), "set_play_enabled", { play_id: "no-existe", enabled: true }),
    ).rejects.toThrow(/No existe el play/);
    expect(writes(log)).toHaveLength(0);
  });

  it("pausing a play that runs rules says its pending suggestions will close", async () => {
    const { db } = fakeDb();
    const r = (await executeTool(ctxWith(db, OWNER), "set_play_enabled", {
      play_id: "meeting-prep-and-follow-up",
      enabled: false,
    })) as { mensaje: string };
    expect(r.mensaje).toMatch(/Pausado/);
    expect(r.mensaje).toMatch(/sugerencias pendientes/);
  });
});

describe("titles and manifest (CA-19, G-3)", () => {
  const names = ["list_plays", "get_play", "set_play_enabled"];
  it("have a title in TITLES and are in the registry exactly once", () => {
    for (const n of names) {
      expect(TITLES[n], n).toBeTruthy();
      expect(
        TOOLS.filter((t) => t.name === n),
        n,
      ).toHaveLength(1);
    }
  });
  it("are in .lovable/mcp/manifest.json, the two reads as read-only and the write not", () => {
    const manifest = JSON.parse(readFileSync(".lovable/mcp/manifest.json", "utf8"));
    const tools: { name: string; title: string; annotations: { readOnlyHint: boolean } }[] =
      manifest.mcp.tools;
    const hint = (n: string) => tools.find((t) => t.name === n)?.annotations.readOnlyHint;
    expect(hint("list_plays")).toBe(true);
    expect(hint("get_play")).toBe(true);
    expect(hint("set_play_enabled")).toBe(false);
    for (const n of names) expect(tools.find((t) => t.name === n)?.title, n).toBe(TITLES[n]);
  });
});
