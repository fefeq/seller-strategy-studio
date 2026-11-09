import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  TOOLS,
  canUseTool,
  executeTool,
  getTool,
  summarizeAction,
  type ToolCtx,
} from "@/lib/agent/tools";
import { TITLES } from "@/lib/mcp/tools/agent-tools";
import { DEAL_SOURCE_KEYS, DEAL_SOURCE_LABELS } from "@/lib/deal-source";
import { canActOnSuggestion } from "@/lib/suggestion-board";

// A fake Supabase client: records every query (table, operation, filters, payload) and answers from `reply`.
type Q = {
  table: string;
  op: "select" | "insert" | "update" | "upsert" | "delete";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the fake records whatever each tool wrote
  payload?: any;
  filters: unknown[][];
  head?: boolean;
};
type Reply = { data?: unknown; error?: { message: string } | null; count?: number } | undefined;
function fakeDb(reply: (q: Q) => Reply = () => undefined) {
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
            const res = { data: r.data ?? null, error: r.error ?? null, count: r.count ?? null };
            return (res1: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
              Promise.resolve(res).then(res1, rej);
          }
          return (...args: unknown[]) => {
            if (prop === "insert" || prop === "update" || prop === "upsert" || prop === "delete") {
              q.op = prop;
              q.payload = args[0];
            } else if (prop === "select") {
              if (q.op === "select") q.head = !!(args[1] as { head?: boolean } | undefined)?.head;
            } else if (!["single", "maybeSingle", "order", "limit"].includes(prop))
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
const OTHER = "22222222-2222-4222-8222-222222222222";
const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ctxWith = (db: ToolCtx["db"], roles = ["ae"]): ToolCtx => ({
  db,
  orgId: ORG,
  userId: ME,
  roles,
  currency: "EUR",
});
const eq = (q: Q, col: string, val: unknown) =>
  q.filters.some(([op, c, v]) => op === "eq" && c === col && v === val);
const writes = (log: Q[], table?: string) =>
  log.filter((q) => q.op !== "select" && (!table || q.table === table));
/** Every query reads or writes only the caller's company: the rule that keeps Telegram (privileged client) safe. */
function expectScoped(log: Q[]) {
  for (const q of log) {
    if (q.op === "insert" || q.op === "upsert")
      expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- payloads are recorded untyped by the fake
        [q.payload].flat().every((p: any) => p.org_id === ORG),
        `${q.op} ${q.table}`,
      ).toBe(true);
    else expect(eq(q, "org_id", ORG), `${q.op} ${q.table}`).toBe(true);
  }
}

describe("agent registry", () => {
  it("has unique names, an object schema, a summary for every write and an MCP title for every tool", () => {
    const names = TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const t of TOOLS) {
      expect(t.input instanceof z.ZodObject, t.name).toBe(true);
      expect(t.description.length, t.name).toBeGreaterThan(10);
      if (t.kind === "write") expect(typeof t.summarize, t.name).toBe("function");
      expect(TITLES[t.name], t.name).toBeTruthy();
    }
    expect(names.length).toBeGreaterThanOrEqual(67);
  });

  it("limits decisions to the roles the database allows", () => {
    expect(canUseTool(getTool("decide_approval")!, ["deal_desk"])).toBe(true);
    expect(canUseTool(getTool("decide_approval")!, ["ae"])).toBe(false);
    expect(canUseTool(getTool("assign_suggestion")!, ["sales_leader"])).toBe(true);
    expect(canUseTool(getTool("assign_suggestion")!, ["sdr"])).toBe(false);
  });

  it("applies the suggestion visibility rule in code (own, unassigned, or any for leaders)", () => {
    expect(canActOnSuggestion({ user_id: null }, ME, ["ae"])).toBe(true);
    expect(canActOnSuggestion({ user_id: ME }, ME, ["ae"])).toBe(true);
    expect(canActOnSuggestion({ user_id: OTHER }, ME, ["ae"])).toBe(false);
    expect(canActOnSuggestion({ user_id: OTHER }, ME, ["sales_leader"])).toBe(true);
  });
});

describe("update_deal behaves like the Pipeline screen", () => {
  const deal = { id: ID(1), name: "Acme", amount: 60000, meddpicc: {} };

  it("sends Ganado to Aprobaciones instead of moving the deal", async () => {
    const { db, log } = fakeDb((q) =>
      q.table === "deals" && q.op === "select"
        ? { data: deal }
        : q.table === "approvals"
          ? { data: q.op === "select" ? [] : { id: ID(9) } }
          : undefined,
    );
    const r = (await executeTool(ctxWith(db), "update_deal", { deal_id: ID(1), stage: "won" })) as {
      mensaje: string;
    };
    const ap = writes(log, "approvals")[0];
    expect(ap.payload).toMatchObject({ kind: "stage_change", title: "Marcar como Ganado: Acme" });
    expect(JSON.parse(ap.payload.evidence)).toEqual({ deal_id: ID(1), stage: "won" });
    expect(writes(log, "deals")).toHaveLength(0);
    expect(r.mensaje).toContain("Aprobaciones");
    expectScoped(log);
  });

  const pendingWon = {
    id: ID(8),
    kind: "stage_change",
    status: "pending",
    evidence: JSON.stringify({ deal_id: ID(1), stage: "won" }),
  };

  it("does not create a second Ganado request while one is pending (SDD deal-won-duplicate-approvals CA-2)", async () => {
    const { db, log } = fakeDb((q) =>
      q.table === "deals" && q.op === "select"
        ? { data: deal }
        : q.table === "approvals"
          ? { data: q.op === "select" ? [pendingWon] : { id: ID(9) } }
          : undefined,
    );
    const r = (await executeTool(ctxWith(db), "update_deal", { deal_id: ID(1), stage: "won" })) as {
      mensaje: string;
    };
    expect(writes(log, "approvals")).toHaveLength(0);
    expect(writes(log, "deals")).toHaveLength(0);
    expect(r.mensaje).toContain("Ya está pendiente de aprobación");
  });

  it("refuses any other stage while a Ganado request is pending (CA-6)", async () => {
    const { db, log } = fakeDb((q) =>
      q.table === "deals"
        ? { data: q.op === "select" ? deal : { id: ID(1), name: "Acme", stage: "proposal" } }
        : q.table === "approvals"
          ? { data: q.op === "select" ? [pendingWon] : { id: ID(9) } }
          : undefined,
    );
    await expect(
      executeTool(ctxWith(db), "update_deal", { deal_id: ID(1), stage: "Propuesta" }),
    ).rejects.toThrow(/solicitud pendiente/);
    expect(writes(log, "deals")).toHaveLength(0);
  });

  it("still lets the agent edit other fields of a deal with a pending Ganado request", async () => {
    const { db, log } = fakeDb((q) =>
      q.table === "deals"
        ? { data: q.op === "select" ? deal : { id: ID(1), name: "Acme", stage: "proposal" } }
        : q.table === "approvals"
          ? { data: q.op === "select" ? [pendingWon] : { id: ID(9) } }
          : q.table === "deal_lines"
            ? { count: 0 }
            : undefined,
    );
    await executeTool(ctxWith(db), "update_deal", { deal_id: ID(1), close_date: "2026-12-01" });
    expect(writes(log, "deals")).toHaveLength(1);
    expect(writes(log, "approvals")).toHaveLength(0);
  });

  it("moves to an open stage with its probability and warns about missing MEDDPICC", async () => {
    const { db, log } = fakeDb((q) =>
      q.table === "deals"
        ? { data: q.op === "select" ? deal : { id: ID(1), name: "Acme", stage: "proposal" } }
        : undefined,
    );
    const r = (await executeTool(ctxWith(db), "update_deal", {
      deal_id: ID(1),
      stage: "Propuesta",
    })) as { mensaje?: string };
    const up = writes(log, "deals")[0];
    expect(up.payload).toMatchObject({ stage: "proposal", probability: 60 });
    expect(r.mensaje).toMatch(/falta/);
    expectScoped(log);
  });

  it("does not overwrite the amount of a deal priced by its product lines", async () => {
    const { db, log } = fakeDb((q) =>
      q.table === "deals" ? { data: deal } : q.table === "deal_lines" ? { count: 2 } : undefined,
    );
    await expect(
      executeTool(ctxWith(db), "update_deal", { deal_id: ID(1), amount: 5 }),
    ).rejects.toThrow(/líneas de producto/);
    expect(writes(log)).toHaveLength(0);
  });

  // SDD-20261027 strategic-suggestions-engine, F0 · H-2 (CA-8, CA-9, CA-10): the same loss fields as the Pipeline dialog.
  it("CA-8: moving to Perdido can carry the reason (fixed list), free text and competitor", async () => {
    const { db, log } = fakeDb((q) =>
      q.table === "deals"
        ? {
            data:
              q.op === "select"
                ? { ...deal, stage: "negotiation" }
                : { id: ID(1), name: "Acme", stage: "lost" },
          }
        : undefined,
    );
    await executeTool(ctxWith(db), "update_deal", {
      deal_id: ID(1),
      stage: "lost",
      lost_reason: "price",
      lost_reason_detail: " Pidieron un 30 % menos ",
      lost_competitor: "Rival Uno",
    });
    expect(writes(log, "deals")[0].payload).toMatchObject({
      stage: "lost",
      probability: 0,
      lost_reason: "price",
      lost_reason_detail: "Pidieron un 30 % menos",
      lost_competitor: "Rival Uno",
    });
    expectScoped(log);
  });

  it("CA-10: moving to Perdido with no reason saves it as lost and writes no loss fields (counted as sin dato)", async () => {
    const { db, log } = fakeDb((q) =>
      q.table === "deals"
        ? {
            data:
              q.op === "select"
                ? { ...deal, stage: "negotiation" }
                : { id: ID(1), name: "Acme", stage: "lost" },
          }
        : undefined,
    );
    await executeTool(ctxWith(db), "update_deal", { deal_id: ID(1), stage: "lost" });
    const p = writes(log, "deals")[0].payload;
    expect(p).toMatchObject({ stage: "lost" });
    expect(Object.keys(p).some((k) => k.startsWith("lost_"))).toBe(false);
  });

  it("CA-9: the reason can be completed on a deal that is already lost, touching only what was sent", async () => {
    const { db, log } = fakeDb((q) =>
      q.table === "deals"
        ? {
            data:
              q.op === "select"
                ? { ...deal, stage: "lost" }
                : { id: ID(1), name: "Acme", stage: "lost" },
          }
        : undefined,
    );
    await executeTool(ctxWith(db), "update_deal", { deal_id: ID(1), lost_competitor: "Rival Dos" });
    expect(writes(log, "deals")[0].payload).toEqual({ lost_competitor: "Rival Dos" });
    expectScoped(log);
  });

  it("a reason outside the list, or a loss reason on a deal that is not lost, is refused and writes nothing", async () => {
    const open = fakeDb((q) =>
      q.table === "deals" ? { data: { ...deal, stage: "demo" } } : undefined,
    );
    await expect(
      executeTool(ctxWith(open.db), "update_deal", { deal_id: ID(1), lost_reason: "price" }),
    ).rejects.toThrow(/solo se guarda en deals perdidos/);
    expect(writes(open.log)).toHaveLength(0);
    const bad = fakeDb((q) =>
      q.table === "deals" ? { data: { ...deal, stage: "lost" } } : undefined,
    );
    await expect(
      executeTool(ctxWith(bad.db), "update_deal", { deal_id: ID(1), lost_reason: "caro" }),
    ).rejects.toThrow(/Elige uno de la lista/);
    expect(writes(bad.log)).toHaveLength(0);
  });

  it("refuses a deal from another company", async () => {
    const { db, log } = fakeDb();
    await expect(
      executeTool(ctxWith(db), "update_deal", { deal_id: ID(1), health: "red" }),
    ).rejects.toThrow(/No encuentro ese deal/);
    expect(writes(log)).toHaveLength(0);
  });
});

describe("decide_approval", () => {
  const approval = {
    id: ID(5),
    kind: "stage_change",
    title: "Marcar como Ganado: Acme",
    status: "pending",
    evidence: JSON.stringify({ deal_id: ID(1), stage: "won" }),
  };

  it("claims the approval before moving the deal, with the won stage probability", async () => {
    const { db, log } = fakeDb((q) => {
      if (q.table === "approvals" && q.op === "select") return { data: approval };
      if (q.table === "approvals" && q.op === "update") return { data: [{ id: ID(5) }] };
      if (q.table === "deals") return { data: { id: ID(1) } };
    });
    const r = (await executeTool(ctxWith(db, ["deal_desk"]), "decide_approval", {
      approval_id: ID(5),
      decision: "apply",
    })) as { mensaje: string };
    const claim = log.findIndex((q) => q.table === "approvals" && q.op === "update");
    const move = log.findIndex((q) => q.table === "deals" && q.op === "update");
    expect(claim).toBeGreaterThan(-1);
    expect(move).toBeGreaterThan(claim);
    expect(eq(log[claim], "status", "pending")).toBe(true);
    expect(log[move].payload).toEqual({ stage: "won", probability: 100 });
    expect(r.mensaje).toContain("Aplicada");
    expectScoped(log);
  });

  it("puts the approval back to pending when the deal cannot be moved", async () => {
    const { db, log } = fakeDb((q) => {
      if (q.table === "approvals" && q.op === "select") return { data: approval };
      if (q.table === "approvals" && q.op === "update") return { data: [{ id: ID(5) }] };
      if (q.table === "deals") return { error: { message: "boom" } };
    });
    await expect(
      executeTool(ctxWith(db, ["owner"]), "decide_approval", {
        approval_id: ID(5),
        decision: "apply",
      }),
    ).rejects.toThrow(/sigue pendiente/);
    const ups = writes(log, "approvals");
    expect(ups.at(-1)?.payload).toEqual({ status: "pending" });
  });

  it("is refused to roles that cannot decide", async () => {
    const { db } = fakeDb();
    await expect(
      executeTool(ctxWith(db, ["ae"]), "decide_approval", { approval_id: ID(5), decision: "skip" }),
    ).rejects.toThrow(/rol/);
  });
});

describe("ids must belong to the caller's company", () => {
  it("log_touch refuses an account it cannot find in the company", async () => {
    const { db, log } = fakeDb();
    await expect(
      executeTool(ctxWith(db), "log_touch", { account_id: ID(3), channel: "email" }),
    ).rejects.toThrow(/No encuentro esa cuenta/);
    expect(writes(log)).toHaveLength(0);
    expectScoped(log);
  });

  it("update_account refuses a segment of another company and an empty change", async () => {
    const { db } = fakeDb((q) => (q.table === "accounts" ? { data: { id: ID(3) } } : undefined));
    await expect(
      executeTool(ctxWith(db), "update_account", { account_id: ID(3), segment_id: ID(4) }),
    ).rejects.toThrow(/segmento/);
    await expect(executeTool(ctxWith(db), "update_account", { account_id: ID(3) })).rejects.toThrow(
      /qué cambiar/,
    );
  });

  it("update_account takes a country as ISO code or name; the single rule decides (see accounts.normalize.test.ts)", () => {
    const t = getTool("update_account")!;
    expect(t.input.safeParse({ account_id: ID(3), country: "mx" }).success).toBe(true);
    expect(t.input.safeParse({ account_id: ID(3), country: "Mexico" }).success).toBe(true);
  });
});

describe("assign_deal", () => {
  const replyFor =
    (owner: string | null, member = true) =>
    (q: Q): Reply => {
      if (q.table === "deals" && q.op === "select")
        return { data: { id: ID(1), owner_id: owner, name: "Acme" } };
      if (q.table === "org_members") return { data: member ? [{ user_id: OTHER }] : [] };
      if (q.table === "deals") return { data: { id: ID(1) } };
    };
  it("lets a member hand over their own deal but not take someone else's", async () => {
    const mine = fakeDb(replyFor(ME));
    await executeTool(ctxWith(mine.db), "assign_deal", { deal_id: ID(1), owner_id: OTHER });
    expect(writes(mine.log, "deals")[0].payload).toEqual({ owner_id: OTHER });
    expectScoped(mine.log);
    const theirs = fakeDb(replyFor(OTHER));
    await expect(
      executeTool(ctxWith(theirs.db), "assign_deal", { deal_id: ID(1), owner_id: ME }),
    ).rejects.toThrow(/Owner o Sales Leader/);
    const leader = fakeDb(replyFor(OTHER));
    await executeTool(ctxWith(leader.db, ["sales_leader"]), "assign_deal", {
      deal_id: ID(1),
      owner_id: null,
    });
    expect(writes(leader.log, "deals")).toHaveLength(1);
  });
  it("refuses an owner who is not in the team", async () => {
    const { db } = fakeDb(replyFor(ME, false));
    await expect(
      executeTool(ctxWith(db), "assign_deal", { deal_id: ID(1), owner_id: OTHER }),
    ).rejects.toThrow(/no es miembro/);
  });
});

describe("deal lines", () => {
  it("refuses a product that is no longer for sale and invalid values, like the line editor", async () => {
    const { db } = fakeDb((q) =>
      q.table === "deals"
        ? { data: { id: ID(1) } }
        : q.table === "products"
          ? {
              data: {
                id: ID(2),
                name: "Plan Pro",
                price: 100,
                cost: null,
                billing: "monthly",
                active: false,
              },
            }
          : undefined,
    );
    await expect(
      executeTool(ctxWith(db), "add_deal_line", { deal_id: ID(1), product_id: ID(2) }),
    ).rejects.toThrow(/ya no está a la venta/);
    await expect(
      executeTool(ctxWith(db, ["deal_desk"]), "add_deal_line", { deal_id: ID(1), name: "Setup" }),
    ).rejects.toThrow(/precio unitario/);
    await expect(
      executeTool(ctxWith(db, ["deal_desk"]), "add_deal_line", {
        deal_id: ID(1),
        name: "Setup",
        unit_price: 500,
        billing: "one_off",
        discount_pct: 120,
      }),
    ).rejects.toThrow(/entre 0 y 100/);
  });
  it("adds a catalogue line with its price, cost and billing of today", async () => {
    const { db, log } = fakeDb((q) =>
      q.table === "deals"
        ? { data: { id: ID(1) } }
        : q.table === "products"
          ? {
              data: {
                id: ID(2),
                name: "Plan Pro",
                price: 100,
                cost: 20,
                billing: "monthly",
                active: true,
              },
            }
          : q.table === "deal_lines"
            ? { data: { id: ID(7) } }
            : undefined,
    );
    await executeTool(ctxWith(db), "add_deal_line", {
      deal_id: ID(1),
      product_id: ID(2),
      quantity: 3,
    });
    expect(writes(log, "deal_lines")[0].payload).toMatchObject({
      product_id: ID(2),
      name: "Plan Pro",
      unit_price: 100,
      unit_cost: 20,
      billing: "monthly",
      quantity: 3,
      deal_id: ID(1),
    });
    expectScoped(log);
  });
});

describe("people", () => {
  it("create_person never duplicates an email or LinkedIn and needs one of them", async () => {
    const { db, log } = fakeDb((q) =>
      q.table === "people" && q.op === "select"
        ? { data: [{ email: "ana@acme.com", linkedin_url: null }] }
        : undefined,
    );
    const r = (await executeTool(ctxWith(db), "create_person", {
      full_name: "Ana",
      email: " ANA@acme.com ",
    })) as { duplicada?: boolean };
    expect(r.duplicada).toBe(true);
    expect(writes(log)).toHaveLength(0);
    await expect(
      executeTool(ctxWith(db), "create_person", { full_name: "Sin datos" }),
    ).rejects.toThrow(/email o su LinkedIn/);
  });
});

describe("meetings", () => {
  it("update_meeting with notes writes the same call-log row as the meeting screen", async () => {
    const m = {
      id: ID(8),
      title: "Demo",
      account_id: ID(3),
      deal_id: null,
      scheduled_at: "2026-10-20T10:00:00Z",
      notes: null,
      next_steps: null,
      call_notes: {},
    };
    const { db, log } = fakeDb((q) =>
      q.table === "meetings" ? { data: q.op === "select" ? m : { id: ID(8) } } : undefined,
    );
    await executeTool(ctxWith(db), "update_meeting", {
      meeting_id: ID(8),
      notes: "Le preocupa la integración",
    });
    const call = writes(log, "calls")[0];
    expect(call.op).toBe("upsert");
    expect(call.payload).toMatchObject({ id: ID(8), account_id: ID(3), title: "Demo" });
    expect(call.payload.summary).toContain("integración");
    expectScoped(log);
  });
});

describe("summaries the user confirms", () => {
  it("say what will happen in plain Spanish", () => {
    expect(getTool("update_deal")!.summarize!({ deal_id: ID(1), stage: "won" })).toBe(
      "Actualizar el deal: pedir aprobación para pasar a Ganado",
    );
    expect(
      getTool("decide_suggestion")!.summarize!({ suggestion_id: ID(1), decision: "snooze" }),
    ).toBe("Posponer la sugerencia 3 días");
    expect(
      getTool("update_account")!.summarize!({ account_id: ID(1), tier: "A", health: "red" }),
    ).toBe("Actualizar la cuenta: tier, health");
    expect(
      getTool("create_lead")!.summarize!({ company: "Acme", contact_name: "Ana", stage: "mql" }),
    ).toBe("Dar de alta el lead «Acme» (Ana) en MQL");
  });
});

describe("fixes from review", () => {
  const product = {
    id: ID(2),
    name: "Plan Pro",
    price: 100,
    cost: 20,
    billing: "monthly",
    active: true,
  };
  const lineReply = (q: Q): Reply =>
    q.table === "deals"
      ? { data: { id: ID(1) } }
      : q.table === "products"
        ? { data: product }
        : q.table === "deal_lines"
          ? { data: { id: ID(7), deal_id: ID(1), name: "Plan Pro" } }
          : undefined;

  it("only pricing roles set prices, costs or discounts on lines (the trigger Telegram skips)", async () => {
    const ae = fakeDb(lineReply);
    await expect(
      executeTool(ctxWith(ae.db), "add_deal_line", {
        deal_id: ID(1),
        name: "Setup",
        unit_price: 1,
        billing: "annual",
      }),
    ).rejects.toThrow(/Deal Desk/);
    await expect(
      executeTool(ctxWith(ae.db), "add_deal_line", {
        deal_id: ID(1),
        product_id: ID(2),
        discount_pct: 50,
      }),
    ).rejects.toThrow(/Deal Desk/);
    await expect(
      executeTool(ctxWith(ae.db), "update_deal_line", { line_id: ID(7), unit_price: 0 }),
    ).rejects.toThrow(/Deal Desk/);
    await executeTool(ctxWith(ae.db), "add_deal_line", {
      deal_id: ID(1),
      product_id: ID(2),
      quantity: 2,
    });
    await executeTool(ctxWith(ae.db), "update_deal_line", { line_id: ID(7), quantity: 4 });
    expect(writes(ae.log, "deal_lines")).toHaveLength(2);
    const desk = fakeDb(lineReply);
    await executeTool(ctxWith(desk.db, ["deal_desk"]), "update_deal_line", {
      line_id: ID(7),
      discount_pct: 15,
    });
    expect(writes(desk.log, "deal_lines")[0].payload).toEqual({ discount_pct: 15 });
  });

  it("applies a stage-change approval whose evidence is not structured, like the screen", async () => {
    const { db, log } = fakeDb((q) =>
      q.table === "approvals"
        ? {
            data:
              q.op === "select"
                ? {
                    id: ID(5),
                    kind: "stage_change",
                    title: "Antigua",
                    status: "pending",
                    evidence: "texto libre",
                  }
                : [{ id: ID(5) }],
          }
        : undefined,
    );
    const r = (await executeTool(ctxWith(db, ["owner"]), "decide_approval", {
      approval_id: ID(5),
      decision: "apply",
    })) as { estado: string };
    expect(r.estado).toBe("applied");
    expect(writes(log, "deals")).toHaveLength(0);
  });

  it("checks ids in the tools that already existed", async () => {
    const { db, log } = fakeDb();
    await expect(
      executeTool(ctxWith(db), "create_meeting", { title: "Demo", account_id: ID(3) }),
    ).rejects.toThrow(/esa cuenta/);
    await expect(
      executeTool(ctxWith(db), "create_stakeholder", { account_id: ID(3), name: "Ana" }),
    ).rejects.toThrow(/esa cuenta/);
    await expect(
      executeTool(ctxWith(db), "create_task", { title: "Llamar", owner_id: OTHER }),
    ).rejects.toThrow(/no es miembro/);
    await expect(
      executeTool(ctxWith(db), "create_deal", { name: "Nuevo", account_id: ID(3) }),
    ).rejects.toThrow(/esa cuenta/);
    expect(writes(log)).toHaveLength(0);
  });

  it("search_knowledge hides other people's personal docs", async () => {
    const { db } = fakeDb(() => ({
      data: [
        { section: "playbooks", title: "Equipo", body: "x", scope: "team", created_by: OTHER },
        { section: "skills", title: "Mío", body: "x", scope: "personal", created_by: ME },
        { section: "skills", title: "De otro", body: "x", scope: "personal", created_by: OTHER },
      ],
    }));
    const r = (await executeTool(ctxWith(db), "search_knowledge", { query: "x" })) as {
      title: string;
    }[];
    expect(r.map((d) => d.title)).toEqual(["Equipo", "Mío"]);
  });

  it("update_account clears a text field with null, as the screen saves it", async () => {
    const { db, log } = fakeDb((q) =>
      q.table === "accounts" ? { data: { id: ID(3), name: "Acme" } } : undefined,
    );
    await executeTool(ctxWith(db), "update_account", { account_id: ID(3), industry: "  " });
    expect(writes(log, "accounts")[0].payload).toEqual({ industry: null });
  });

  describe("update_account writes field_sources with the real origin (NK-0022)", () => {
    const AT = "2026-10-01T00:00:00Z";
    const PERSON = {
      source: "persona",
      kind: "persona",
      confirmed: true,
      confirmedBy: OTHER,
      at: AT,
      confirmedAt: AT,
    };
    const account = (extra: Record<string, unknown> = {}) =>
      fakeDb((q) =>
        q.table === "accounts"
          ? {
              data: {
                id: ID(3),
                name: "Acme",
                industry: null,
                size: null,
                country: null,
                notes: null,
                linkedin_url: null,
                field_sources: {},
                ...extra,
              },
            }
          : undefined,
      );
    const sent = (log: Q[]) =>
      writes(log, "accounts")[0]!.payload as {
        field_sources?: Record<string, Record<string, unknown>>;
      } & Record<string, unknown>;

    it("CA-4: a valid source is stored as confirmed by whoever confirmed", async () => {
      const { db, log } = account();
      await executeTool(ctxWith(db), "update_account", {
        account_id: ID(3),
        industry: "Fintech",
        source: "apollo",
      });
      const p = sent(log);
      expect(p).not.toHaveProperty("source");
      expect(p.field_sources?.industry).toMatchObject({
        source: "apollo",
        kind: "fuente",
        confirmed: true,
        confirmedBy: ME,
      });
      expect(p.field_sources?.industry?.at).toEqual(p.field_sources?.industry?.confirmedAt);
    });
    it("CA-4: an invalid source is refused by the tool schema, which is what validates a proposal before the pending action exists", () => {
      const schema = getTool("update_account")!.input;
      for (const source of ["persona", "sin_dato", "manual", "Apollo", ""])
        expect(schema.safeParse({ account_id: ID(3), industry: "X", source }).success, source).toBe(
          false,
        );
      for (const source of ["ia", "apollo", "clay", "parallel", "web"])
        expect(schema.safeParse({ account_id: ID(3), industry: "X", source }).success, source).toBe(
          true,
        );
    });
    it("CA-4: without a source it is ia; a source that is not valid is refused and nothing is written", async () => {
      const a = account();
      await executeTool(ctxWith(a.db), "update_account", { account_id: ID(3), notes: "Texto" });
      expect(sent(a.log).field_sources?.notes).toMatchObject({
        source: "ia",
        kind: "ia",
        confirmed: true,
        confirmedBy: ME,
      });
      for (const source of ["persona", "sin_dato", "manual", ""]) {
        const b = account();
        await expect(
          executeTool(ctxWith(b.db), "update_account", {
            account_id: ID(3),
            industry: "X",
            source,
          }),
        ).rejects.toThrow();
        expect(writes(b.log)).toEqual([]);
      }
    });
    it("CA-3: every accepted source is stored as itself, never as persona", async () => {
      for (const source of ["ia", "apollo", "clay", "parallel", "web"]) {
        const { db, log } = account();
        await executeTool(ctxWith(db), "update_account", {
          account_id: ID(3),
          industry: "Fintech",
          size: "51-200",
          country: "ES",
          notes: "n",
          source,
        });
        const marks = sent(log).field_sources;
        expect(Object.keys(marks ?? {}).sort(), source).toEqual([
          "country",
          "industry",
          "notes",
          "size",
        ]);
        for (const m of Object.values(marks ?? {})) {
          expect(m.source).toBe(source);
          expect(m.kind).not.toBe("persona");
          expect(m.confirmedBy).toBe(ME);
        }
      }
    });
    it("CA-4: works with any client (the privileged one of Telegram too) and keeps the marks of fields that do not change", async () => {
      const { db, log } = account({
        field_sources: { size: { source: "clay", at: AT }, industry: PERSON },
        industry: "Logística",
      });
      await executeTool({ ...ctxWith(db), userId: OTHER }, "update_account", {
        account_id: ID(3),
        country: "Spain",
        source: "clay",
      });
      const p = sent(log);
      expect(p.country).toBe("ES");
      expect(p.field_sources?.country).toMatchObject({ source: "clay", confirmedBy: OTHER });
      expect(p.field_sources?.size).toEqual({ source: "clay", at: AT });
      expect(p.field_sources?.industry).toEqual(PERSON);
    });
    it("the mark is read right before writing, scoped to the company", async () => {
      const { db, log } = account();
      await executeTool(ctxWith(db), "update_account", { account_id: ID(3), industry: "Fintech" });
      const read = log.find((q) => q.table === "accounts" && q.op === "select")!;
      expect(eq(read, "org_id", ORG)).toBe(true);
      expect(log.indexOf(read)).toBeLessThan(log.indexOf(writes(log, "accounts")[0]!));
    });
    it("a mark it cannot read (no `at`) survives the rewrite of field_sources", async () => {
      const odd = { source: "apollo" };
      const { db, log } = account({ field_sources: { notes: odd } });
      await executeTool(ctxWith(db), "update_account", { account_id: ID(3), industry: "Fintech" });
      expect(sent(log).field_sources?.notes).toEqual(odd);
      expect(sent(log).field_sources?.industry).toMatchObject({ source: "ia" });
    });
    it("CA-6: a cleared tracked field loses its mark, the others stay", async () => {
      const { db, log } = account({
        industry: "Logística",
        field_sources: { industry: PERSON, size: { source: "clay", at: AT } },
      });
      await executeTool(ctxWith(db), "update_account", {
        account_id: ID(3),
        industry: "  ",
        source: "apollo",
      });
      const p = sent(log);
      expect(p.industry).toBeNull();
      expect(p.field_sources).toEqual({ size: { source: "clay", at: AT } });
    });
    it("CA-7: the same value, also after normalizing, leaves the mark alone even if it is a person's", async () => {
      const { db, log } = account({
        country: "ES",
        industry: "Fintech",
        field_sources: { country: PERSON, industry: PERSON },
      });
      await executeTool(ctxWith(db), "update_account", {
        account_id: ID(3),
        country: "España",
        industry: " fintech ",
        source: "apollo",
      });
      // Nothing reaches the database: trigger 0058 would otherwise see the new raw text («fintech») with no
      // field_sources change and stamp «persona» over the person's mark.
      expect(writes(log, "accounts")).toEqual([]);
    });
    it("CA-7: a stored legacy size written again is not sent either, so its mark cannot be stamped", async () => {
      const { db, log } = account({ size: "51-200", field_sources: { size: PERSON } });
      await executeTool(ctxWith(db), "update_account", {
        account_id: ID(3),
        size: "51-200",
        source: "apollo",
      });
      expect(writes(log, "accounts")).toEqual([]);
    });
    it("CA-7: when every value is equal nothing is written and the result says so, it does not claim a save", async () => {
      const { db, log } = account({
        size: "Muchos",
        industry: "Fintech",
        field_sources: { size: PERSON },
      });
      const r = (await executeTool(ctxWith(db), "update_account", {
        account_id: ID(3),
        size: "muchos",
        industry: "fintech",
        source: "apollo",
      })) as { mensaje?: string };
      expect(writes(log, "accounts")).toEqual([]);
      expect(r.mensaje ?? "").toMatch(/sin cambios/i);
      expect(r.mensaje ?? "").toMatch(/no se ha guardado/i);
      expect(r.mensaje ?? "").not.toMatch(/se guarda/i);
      expect(r.mensaje).toBe(
        "Sin cambios: la cuenta ya tenía esos valores y no se ha guardado nada.",
      );
    });
    it("a real change to a size that is not a headcount still shows its warning, not «Sin cambios»", async () => {
      const { db, log } = account({ size: "11–50 empleados" });
      const r = (await executeTool(ctxWith(db), "update_account", {
        account_id: ID(3),
        size: "Muchos",
      })) as { mensaje?: string };
      expect(writes(log, "accounts")).toHaveLength(1);
      expect(r.mensaje ?? "").toMatch(/Tamaño «Muchos»/);
      expect(r.mensaje ?? "").not.toMatch(/sin cambios/i);
    });
    it("an equal unnormalizable size dropped next to a real change shows no warning for the dropped field", async () => {
      const { db, log } = account({ size: "Muchos", industry: "Fintech" });
      const r = (await executeTool(ctxWith(db), "update_account", {
        account_id: ID(3),
        size: "muchos",
        industry: "Retail",
      })) as { mensaje?: string };
      expect(writes(log, "accounts")).toHaveLength(1);
      expect(r.mensaje).toBeUndefined();
    });
    it("CA-7: with one field changed and one equal, only the changed one gets a new mark", async () => {
      const { db, log } = account({
        country: "ES",
        industry: "Logística",
        field_sources: { country: PERSON, industry: PERSON },
      });
      await executeTool(ctxWith(db), "update_account", {
        account_id: ID(3),
        country: "Spain",
        industry: "Fintech",
        source: "web",
      });
      const p = sent(log);
      expect(p).not.toHaveProperty("country");
      expect(p.field_sources?.country).toEqual(PERSON);
      expect(p.field_sources?.industry).toMatchObject({ source: "web", confirmedBy: ME });
    });
    it("untracked columns alone do not send field_sources", async () => {
      const { db, log } = account();
      await executeTool(ctxWith(db), "update_account", { account_id: ID(3), tier: "A" });
      expect(sent(log)).toEqual({ tier: "A" });
    });
    it("CA-5: the tools that hand values to update_account tell it which source to pass", () => {
      for (const [name, hint] of [
        ["apollo_enrich_account", "source: apollo"],
        ["clay_enrich_account", "source: clay"],
        ["enrich_accounts_table", "source: parallel"],
        ["complete_account", "source"],
      ] as const)
        expect(getTool(name)!.description, name).toContain(hint);
    });
  });
});

describe("edit, delete, confirm and undo from the agent (SDD field-actions U-5)", () => {
  const seg = { id: ID(20), name: "Pymes" };
  const icp = { id: ID(21), name: "Agencias", segment_id: ID(20) };
  const countOf = (n: number) => (q: Q) => (q.head ? { count: n } : undefined);

  it("CA-13: every write is proposed first (a write tool, with a summary), and the reads change nothing", () => {
    for (const name of [
      "update_icp",
      "update_pillar",
      "delete_segment",
      "delete_icp",
      "delete_pillar",
      "confirm_fields",
      "undo_change",
    ]) {
      expect(getTool(name)!.kind, name).toBe("write");
      expect(typeof getTool(name)!.summarize, name).toBe("function");
    }
    for (const name of ["check_delete", "list_recent_changes"])
      expect(getTool(name)!.kind, name).toBe("read");
  });

  it("CA-14: deleting is the Owner's in code too: another role gets the screen's reason and nothing is deleted", async () => {
    const { db, log } = fakeDb((q) =>
      q.table === "icp_profiles" && q.op === "select" ? { data: icp } : countOf(0)(q),
    );
    await expect(
      executeTool(ctxWith(db, ["sales_leader"]), "delete_icp", { id: icp.id, name: "Agencias" }),
    ).rejects.toThrow("Solo el Owner puede borrar.");
    expect(writes(log)).toHaveLength(0);
  });

  it("CA-6: a segment in use is not deleted and the error says where it is used", async () => {
    const { db, log } = fakeDb((q) =>
      q.table === "segments" && q.op === "select" && !q.head ? { data: seg } : countOf(3)(q),
    );
    await expect(
      executeTool(ctxWith(db, ["owner"]), "delete_segment", { id: seg.id, name: "Pymes" }),
    ).rejects.toThrow(/Se usa en: 3 deals/);
    expect(writes(log)).toHaveLength(0);
  });

  it("an unused segment is deleted by the Owner, scoped to the company, saying it can be undone", async () => {
    const { db, log } = fakeDb((q) =>
      q.table === "segments" && q.op === "select" && !q.head ? { data: seg } : countOf(0)(q),
    );
    const r = (await executeTool(ctxWith(db, ["owner"]), "delete_segment", {
      id: seg.id,
      name: "pymes",
    })) as { mensaje: string };
    expect(writes(log, "segments")).toHaveLength(1);
    expect(writes(log, "segments")[0]!.op).toBe("delete");
    expect(r.mensaje).toContain("24 horas");
    expectScoped(log);
  });

  it("deleting refuses when the name shown to the person is not the element's", async () => {
    const { db, log } = fakeDb((q) =>
      q.table === "segments" && q.op === "select" && !q.head ? { data: seg } : countOf(0)(q),
    );
    await expect(
      executeTool(ctxWith(db, ["owner"]), "delete_segment", { id: seg.id, name: "Otro" }),
    ).rejects.toThrow(/El nombre no coincide/);
    expect(writes(log)).toHaveLength(0);
  });

  it("an ICP in use is archived (same delete, with the use named) and check_delete says it beforehand", async () => {
    const { db } = fakeDb((q) =>
      q.table === "icp_profiles" && q.op === "select" ? { data: icp } : countOf(5)(q),
    );
    const plan = (await executeTool(ctxWith(db, ["owner"]), "check_delete", {
      kind: "icp",
      id: icp.id,
    })) as { se_puede: boolean; accion: string; texto: string[] };
    expect(plan).toMatchObject({ se_puede: true, accion: "Archivar" });
    expect(plan.texto.join(" ")).toContain("5 cuentas, 5 leads");
  });

  it("any member can edit an ICP; countries are normalized and unknown ones are refused", async () => {
    const { db, log } = fakeDb((q) =>
      q.table === "icp_profiles"
        ? { data: q.op === "select" ? { id: icp.id } : { id: icp.id, name: "Agencias" } }
        : undefined,
    );
    await executeTool(ctxWith(db, ["ae"]), "update_icp", {
      icp_id: icp.id,
      fields: { countries: ["España", "fr"], min_employees: 10 },
    });
    expect(writes(log, "icp_profiles")[0]!.payload).toEqual({
      countries: ["ES", "FR"],
      min_employees: 10,
    });
    await expect(
      executeTool(ctxWith(db, ["ae"]), "update_icp", {
        icp_id: icp.id,
        fields: { countries: ["Atlantis"] },
      }),
    ).rejects.toThrow(/No reconozco estos países/);
    await expect(
      executeTool(ctxWith(db, ["ae"]), "update_icp", { icp_id: icp.id, fields: {} }),
    ).rejects.toThrow(/qué cambiar/);
    expectScoped(log);
  });

  it("confirm_fields marks only fields with a value, with who and when, scoped to the company", async () => {
    const row = {
      id: ID(30),
      org_id: ORG,
      title: "Ahorro",
      pain: "",
      message: "Menos coste",
      proof: null,
      field_sources: {},
    };
    const { db, log } = fakeDb((q) =>
      q.table === "messaging_pillars" ? { data: row } : undefined,
    );
    const r = (await executeTool(ctxWith(db, ["ae"]), "confirm_fields", {
      kind: "pillar",
      id: ID(30),
      fields: ["title", "pain", "message"],
    })) as { mensaje: string };
    const up = writes(log, "messaging_pillars")[0]!;
    expect(Object.keys(up.payload.field_sources)).toEqual(["title", "message"]);
    expect(up.payload.field_sources.title).toMatchObject({
      confirmed: true,
      confirmedBy: ME,
      kind: "sin_dato",
    });
    expect(r.mensaje).toContain("Sin valor, no confirmados: pain");
    expectScoped(log);
  });

  it("confirm_fields refuses untracked fields and rows without the provenance column", async () => {
    const { db } = fakeDb((q) =>
      q.table === "messaging_pillars" ? { data: { id: ID(30), title: "x" } } : undefined,
    );
    await expect(
      executeTool(ctxWith(db, ["ae"]), "confirm_fields", {
        kind: "pillar",
        id: ID(30),
        fields: ["position"],
      }),
    ).rejects.toThrow(/no se pueden confirmar/);
    await expect(
      executeTool(ctxWith(db, ["ae"]), "confirm_fields", {
        kind: "pillar",
        id: ID(30),
        fields: ["title"],
      }),
    ).rejects.toThrow(/todavía no está activada/);
  });

  it("CA-14: undoing a delete is the Owner's, and a failed undo points to the screen", async () => {
    const entry = {
      id: ID(40),
      table_name: "icp_profiles",
      row_id: ID(21),
      op: "delete",
      before: { name: "Agencias" },
      changed_at: new Date().toISOString(),
      undone_at: null,
    };
    const { db } = fakeDb((q) => (q.table === "field_edit_log" ? { data: entry } : undefined));
    await expect(
      executeTool(ctxWith(db, ["ae"]), "undo_change", { change_id: ID(40) }),
    ).rejects.toThrow("Solo el Owner puede deshacer un borrado.");
    const rpcDb = {
      ...db,
      rpc: async () => ({ error: { message: "No encuentro ese cambio" } }),
    } as unknown as ToolCtx["db"];
    await expect(
      executeTool(ctxWith(rpcDb, ["owner"]), "undo_change", { change_id: ID(40) }),
    ).rejects.toThrow(/Hazlo en Estrategia/);
  });

  it("undo is refused after the 24 hours", async () => {
    const old = {
      id: ID(41),
      table_name: "messaging_pillars",
      row_id: ID(30),
      op: "update",
      before: { title: "x" },
      changed_at: new Date(Date.now() - 25 * 3_600_000).toISOString(),
      undone_at: null,
    };
    const { db } = fakeDb((q) => (q.table === "field_edit_log" ? { data: old } : undefined));
    await expect(
      executeTool(ctxWith(db, ["owner"]), "undo_change", { change_id: ID(41) }),
    ).rejects.toThrow(/pasaron más de 24 horas/);
  });
});

describe("get_setup_status guide (SDD strategy-setup-guided-next-step, CA-3, CA-7, CA-9, CA-10)", () => {
  it("returns the same next step as the screen, skipping a snoozed one, and only reads its own company", async () => {
    const { db, log } = fakeDb((q) =>
      q.table === "setup_step_snoozes"
        ? {
            data: [
              {
                step_id: "positioning",
                snoozed_until: "2999-01-01T23:59:59.999Z",
                created_at: "2026-10-26T09:00:00Z",
              },
            ],
          }
        : undefined,
    );
    const r = (await getTool("get_setup_status")!.run(ctxWith(db, ["owner"]), {})) as {
      guia: {
        mensaje: { stepId: string; why: string; start: string };
        pospuestos: { paso: string }[];
      };
    };
    expect(r.guia.mensaje.stepId).toBe("icp");
    expect(r.guia.mensaje.why).toContain("priorizar");
    expect(r.guia.mensaje.start).toBe("Empezar");
    expect(r.guia.pospuestos).toHaveLength(1);
    expect(log.some((q) => q.table === "setup_step_snoozes")).toBe(true);
    expectScoped(log.filter((q) => q.table !== "organizations")); // organizations is read by its own id
  });
  it("recommends a step the caller's role can complete", async () => {
    const { db } = fakeDb();
    const r = (await getTool("get_setup_status")!.run(ctxWith(db, ["ae"]), {})) as {
      guia: { mensaje: { stepId: string } };
    };
    expect(r.guia.mensaje.stepId).toBe("accounts");
  });
  it("CA-8: an AE's status lists only what an AE can complete as missing and says the rest is outside their role", async () => {
    const { db } = fakeDb();
    type Est = {
      missing: { id: string }[];
      next: { id: string } | null;
      fuera_de_tu_rol: string[];
    };
    const ae = (
      (await getTool("get_setup_status")!.run(ctxWith(db, ["ae"]), {})) as { estado: Est }
    ).estado;
    expect(ae.missing.map((i) => i.id)).toEqual(["accounts", "deals"]);
    expect(ae.next?.id).toBe("accounts");
    expect(ae.fuera_de_tu_rol).toHaveLength(6);
    const owner = (
      (await getTool("get_setup_status")!.run(ctxWith(db, ["owner"]), {})) as { estado: Est }
    ).estado;
    expect(owner.missing).toHaveLength(8);
    expect(owner.next?.id).toBe("positioning");
    expect(owner.fuera_de_tu_rol).toEqual([]);
  });
});

describe("segments: acquisition motion", () => {
  it("CA-2: upsert_segment saves it for the caller's company and clears it with null", async () => {
    const { db, log } = fakeDb((q) =>
      q.op === "update" || q.op === "insert" ? { data: { id: ID(5) } } : undefined,
    );
    await executeTool(ctxWith(db, ["sales_leader"]), "upsert_segment", {
      segment_id: ID(5),
      name: "Pymes",
      acquisition_motion: "plg",
    });
    await executeTool(ctxWith(db, ["sales_leader"]), "upsert_segment", {
      segment_id: ID(5),
      name: "Pymes",
      acquisition_motion: null,
    });
    const ups = writes(log, "segments");
    expect(ups[0]!.payload).toMatchObject({ acquisition_motion: "plg" });
    expect(ups[1]!.payload).toMatchObject({ acquisition_motion: null });
    expect(ups[0]!.payload).not.toHaveProperty("motion");
    expectScoped(log);
  });

  it("CA-1: the sales-model values are not valid as acquisition motion", async () => {
    const { db, log } = fakeDb();
    await expect(
      executeTool(ctxWith(db, ["owner"]), "upsert_segment", {
        name: "Pymes",
        acquisition_motion: "inside",
      }),
    ).rejects.toThrow();
    expect(writes(log)).toHaveLength(0);
  });

  it("CA-2: only owner and sales_leader may write it", () => {
    for (const r of ["ae", "marketing", "sdr"])
      expect(canUseTool(getTool("upsert_segment")!, [r]), r).toBe(false);
    for (const r of ["owner", "sales_leader"])
      expect(canUseTool(getTool("upsert_segment")!, [r]), r).toBe(true);
  });

  it("CA-4: list_segments reads only the caller's company and selects both motions", async () => {
    const { db, log } = fakeDb((q) =>
      q.table === "segments"
        ? { data: [{ id: ID(5), name: "Pymes", motion: "plg", acquisition_motion: null }] }
        : undefined,
    );
    const r = await executeTool(ctxWith(db), "list_segments", {});
    expect(r).toEqual([{ id: ID(5), name: "Pymes", motion: "plg", acquisition_motion: null }]);
    expect(writes(log)).toHaveLength(0);
    expectScoped(log);
    expect(getTool("list_segments")!.kind).toBe("read");
  });
});

describe("get_funnel_diagnosis", () => {
  const seg = {
    id: ID(5),
    name: "Pymes",
    acv_min: 0,
    acv_max: null,
    win_rate_target: null,
    cac_target: null,
    gross_margin_pct: null,
    payback_months: null,
    acquisition_motion: null,
  };

  it("CA-8: reads only the caller's company, writes nothing and calls no provider", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { db, log } = fakeDb((q) => (q.table === "segments" ? { data: [seg] } : undefined));
    const r = (await executeTool(ctxWith(db), "get_funnel_diagnosis", { quarter: "2026-Q3" })) as {
      quarter: string;
      segments: { phases: { id: string; status: string }[] }[];
    };
    expect(r.quarter).toBe("2026-Q3");
    expect(r.segments).toHaveLength(1);
    expect(r.segments[0]!.phases.find((p) => p.id === "acquisition")!.status).toBe("sin_datos");
    expect(writes(log)).toHaveLength(0);
    expect(new Set(log.map((q) => q.table))).toEqual(
      new Set([
        "segments",
        "deals",
        "leads",
        "trials",
        "cac_costs",
        "posthog_connections",
        "stripe_snapshots",
        // SDD-20261109 CA-10 (authorised by the coordinator): the year's budget rows feed the one margin chain.
        "segment_budget_quarters",
      ]),
    );
    expectScoped(log);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("CA-8: rows of another company that a privileged client might return never reach the caller's quarter filter (every query carries org_id and the quarter)", async () => {
    const { db, log } = fakeDb();
    await executeTool(ctxWith(db), "get_funnel_diagnosis", { quarter: "2026-Q3" });
    for (const t of ["leads", "trials"]) {
      const q = log.find((x) => x.table === t)!;
      expect(eq(q, "org_id", ORG), t).toBe(true);
      expect(
        q.filters.some(([op]) => op === "gte"),
        t,
      ).toBe(true);
      expect(
        q.filters.some(([op]) => op === "lt"),
        t,
      ).toBe(true);
    }
    expect(
      eq(
        log.find((x) => x.table === "cac_costs")!,
        "period",
        "2026-Q3",
      ),
    ).toBe(true);
  });

  it("is a read tool open to every role, with a title, and rejects a quarter that is not AAAA-QN", async () => {
    const t = getTool("get_funnel_diagnosis")!;
    expect(t.kind).toBe("read");
    expect(t.roles).toBeUndefined();
    expect(TITLES.get_funnel_diagnosis).toBeTruthy();
    const { db } = fakeDb();
    await expect(
      executeTool(ctxWith(db), "get_funnel_diagnosis", { quarter: "2026-T3" }),
    ).rejects.toThrow();
  });

  it("CA-8 (structure): the diagnosis code imports no provider, gateway or sync module", async () => {
    const { readFileSync } = await import("node:fs");
    for (const f of ["src/lib/funnel-diagnosis.ts", "src/lib/funnel-diagnosis-data.ts"]) {
      const src = readFileSync(f, "utf8");
      const imports = [...src.matchAll(/from "([^"]+)"/g)].map((m) => m[1]!);
      for (const i of imports)
        expect(i, `${f} imports ${i}`).not.toMatch(
          /gateway|\.server|posthog|stripe|apollo|clay|firecrawl|apify|parallel|perplexity|jev|inngest|ai-core/i,
        );
      expect(src, f).not.toMatch(/\bfetch\(/);
    }
  });

  it("CA-8 (structure): the MCP manifest lists it, and list_segments, as read-only tools", async () => {
    const { readFileSync } = await import("node:fs");
    const manifest = JSON.parse(readFileSync(".lovable/mcp/manifest.json", "utf8"));
    const tools: { name: string; annotations: { readOnlyHint: boolean } }[] = manifest.mcp.tools;
    for (const n of ["get_funnel_diagnosis", "list_segments"])
      expect(tools.find((t) => t.name === n)?.annotations.readOnlyHint, n).toBe(true);
  });
});

describe("create_icp goes through the one country and size rule (NK-0019)", () => {
  it("saves countries as ISO codes, aliases included", async () => {
    const { db, log } = fakeDb((q) =>
      q.table === "icp_profiles" ? { data: { id: ID(900) } } : undefined,
    );
    await executeTool(ctxWith(db, ["owner"]), "create_icp", {
      name: "Agencias",
      countries: ["es", "uk"],
      min_employees: 10,
    });
    expect(writes(log, "icp_profiles")[0]!.payload).toMatchObject({
      countries: ["ES", "GB"],
      min_employees: 10,
    });
  });
  it("refuses a country it does not recognise and writes nothing", async () => {
    const { db, log } = fakeDb();
    await expect(
      executeTool(ctxWith(db, ["owner"]), "create_icp", { name: "Agencias", countries: ["xx"] }),
    ).rejects.toThrow(/xx/i);
    expect(writes(log, "icp_profiles")).toEqual([]);
  });
});

describe("decide_suggestion says where a test or a commercial action is accepted (NK-0041, CA-5; string check, weak)", () => {
  it("the agent's description and the MCP manifest say they are accepted from Sugerencias", async () => {
    const { readFileSync } = await import("node:fs");
    const manifest = JSON.parse(readFileSync(".lovable/mcp/manifest.json", "utf8"));
    const m = (manifest.mcp.tools as { name: string; description: string }[]).find(
      (t) => t.name === "decide_suggestion",
    );
    for (const d of [getTool("decide_suggestion")!.description, m?.description ?? ""])
      expect(d).toMatch(/prueba.*acción comercial.*se aceptan desde Sugerencias/);
  });
});

// SDD-20261109-metrics-strategy-no-estimates · U-4 · CA-10: get_funnel_diagnosis takes its payback margin from the one
// chain (won deals with lines read with gross_margin) and its output carries no cost, margin nor CAC, so it needs no
// role guard; every read stays scoped to the caller's company.
describe("NK-0094 get_funnel_diagnosis: one margin chain, no costs in the output", () => {
  const seg = {
    id: ID(5),
    name: "Pymes",
    acv_min: 0,
    acv_max: null,
    win_rate_target: null,
    cac_target: null,
    gross_margin_pct: null,
    payback_months: 12,
    acquisition_motion: "slg",
  };
  const won = {
    segment_id: ID(5),
    amount: 6000,
    gross_margin: 1500,
    stage: "won",
    close_date: "2026-08-10",
    closed_at: "2026-08-10T10:00:00Z",
    updated_at: "2026-08-10T10:00:00Z",
    created_at: "2026-07-01T10:00:00Z",
  };
  const reply = (q: Q) =>
    q.table === "segments"
      ? { data: [seg] }
      : q.table === "deals"
        ? { data: [won] }
        : q.table === "cac_costs"
          ? { data: [{ segment_id: ID(5), channel: "Eventos", amount: 6000 }] }
          : undefined;
  type Out = {
    segments: { phases: { id: string; measures: { id: string; value: number | null }[] }[] }[];
  };

  it("D15: the payback uses the margin of the won deal with lines (25 %), not a 100 % margin", async () => {
    const { db, log } = fakeDb(reply);
    const r = (await executeTool(ctxWith(db), "get_funnel_diagnosis", {
      quarter: "2026-Q3",
    })) as Out;
    const payback = r.segments[0]!.phases.find((p) => p.id === "revenue")!.measures.find(
      (m) => m.id === "payback",
    )!;
    // 6000 / (6000 × 25 % / 12) = 48
    expect(payback.value).toBe(48);
    expectScoped(log);
  });

  it("CA-10: the budget's real margin of the quarter beats the deals' one; the budget read is scoped and of the year", async () => {
    const budget = {
      segment_id: ID(5),
      period: "2026-Q3",
      plan_revenue: null,
      plan_cost_to_serve: null,
      plan_acquisition: null,
      plan_new_customers: null,
      actual_revenue: 100,
      actual_cost_to_serve: 50,
    };
    const { db, log } = fakeDb((q) =>
      q.table === "segment_budget_quarters" ? { data: [budget] } : reply(q),
    );
    const r = (await executeTool(ctxWith(db), "get_funnel_diagnosis", {
      quarter: "2026-Q3",
    })) as Out;
    const payback = r.segments[0]!.phases.find((p) => p.id === "revenue")!.measures.find(
      (m) => m.id === "payback",
    )!;
    // 6000 / (6000 × 50 % / 12) = 24
    expect(payback.value).toBe(24);
    const q = log.find((x) => x.table === "segment_budget_quarters")!;
    expect(eq(q, "org_id", ORG)).toBe(true);
    expect(q.filters).toContainEqual([
      "in",
      "period",
      ["2026-Q1", "2026-Q2", "2026-Q3", "2026-Q4"],
    ]);
    expectScoped(log);
  });

  it("CA-10: no key «cost», «gross_margin», «margin» or «cac» anywhere in its output", async () => {
    const { db } = fakeDb(reply);
    const r = await executeTool(ctxWith(db), "get_funnel_diagnosis", { quarter: "2026-Q3" });
    const keys = new Set<string>();
    const walk = (v: unknown) => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object")
        for (const [k, x] of Object.entries(v)) {
          keys.add(k);
          walk(x);
        }
    };
    walk(r);
    for (const k of ["cost", "gross_margin", "margin", "cac"]) expect(keys.has(k), k).toBe(false);
  });
});

// SDD-20261109-rules-write-permissions (NK-0095) U-3 · CA-11: drive_import_to_knowledge with the privileged client (Telegram,
// decidePending, applySetupItems, decideSuggestionCore all go through executeTool) refuses Reglas for anyone but the Owner or
// a Sales Leader. Google Drive is mocked for this file (no other case here touches Drive); drive-core keeps its real code,
// importToKnowledge is only wrapped to see the roles it receives.
const nk95 = vi.hoisted(() => ({ getFile: vi.fn(), downloadText: vi.fn() }));
vi.mock("@/lib/google-drive", () => ({
  DriveError: class DriveError extends Error {
    status = 0;
  },
  getFile: nk95.getFile,
  downloadText: nk95.downloadText,
  exportText: vi.fn(),
  downloadBytes: vi.fn(),
  copyAs: vi.fn(),
  createFolder: vi.fn(),
  createGoogleDoc: vi.fn(),
  deleteFile: vi.fn(),
  findByAppProperty: vi.fn(async () => []),
  listChildren: vi.fn(async () => []),
  listFiles: vi.fn(async () => []),
}));
vi.mock("@/lib/drive-core", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/drive-core")>();
  return {
    ...real,
    importToKnowledge: vi.fn((...a: Parameters<typeof real.importToKnowledge>) =>
      real.importToKnowledge(...a),
    ),
  };
});

describe("drive_import_to_knowledge: Reglas only for the Owner or a Sales Leader (NK-0095, CA-11)", () => {
  const ROOT = "folder-root-1";
  const FILE = "file-guia-1";
  const RULE = /Reglas.*solo.*Owner.*Sales Leader/i;
  const driveDb = () =>
    fakeDb((q) =>
      q.table === "drive_folders"
        ? { data: { folder_id: ROOT, name: "Empresa Ficticia", created_by_app: true } }
        : q.table === "knowledge_docs" && q.op === "insert"
          ? { data: { id: ID(950), title: "Guía de prueba" } }
          : undefined,
    );
  const spy = async () => vi.mocked((await import("@/lib/drive-core")).importToKnowledge);
  const setup = async () => {
    (await spy()).mockClear();
    nk95.getFile.mockReset();
    nk95.downloadText.mockReset();
    nk95.getFile.mockImplementation(async (id: string) =>
      id === ROOT
        ? { id: ROOT, name: "Empresa Ficticia", mimeType: "application/vnd.google-apps.folder" }
        : { id: FILE, name: "Guía de prueba.txt", mimeType: "text/plain", parents: [ROOT] },
    );
    nk95.downloadText.mockResolvedValue("Texto ficticio de la guía.");
  };

  it("an ae (privileged client, no RLS) gets BINDING_WRITE_DENIED: no Drive read, no insert", async () => {
    await setup();
    const { BINDING_WRITE_DENIED } = await import("@/lib/knowledge-rules");
    const { db, log } = driveDb();
    await expect(
      executeTool(ctxWith(db, ["ae"]), "drive_import_to_knowledge", {
        file: FILE,
        section: "rules",
      }),
    ).rejects.toThrow(BINDING_WRITE_DENIED);
    expect(await spy()).not.toHaveBeenCalled();
    expect(nk95.getFile).not.toHaveBeenCalled();
    expect(writes(log, "knowledge_docs")).toEqual([]);
  });

  it("a sales_leader reaches importToKnowledge with their roles and the rule is inserted in the company", async () => {
    await setup();
    const { db, log } = driveDb();
    await executeTool(ctxWith(db, ["sales_leader"]), "drive_import_to_knowledge", {
      file: FILE,
      section: "rules",
    });
    expect(await spy()).toHaveBeenCalledWith({ db, orgId: ORG, userId: ME }, FILE, "rules", [
      "sales_leader",
    ]);
    expect(writes(log, "knowledge_docs")[0]!.payload).toMatchObject({
      org_id: ORG,
      section: "rules",
      scope: "team",
    });
  });

  it("an ae still imports into another section", async () => {
    await setup();
    const { db, log } = driveDb();
    await executeTool(ctxWith(db, ["ae"]), "drive_import_to_knowledge", {
      file: FILE,
      section: "company",
    });
    expect(writes(log, "knowledge_docs")).toHaveLength(1);
  });

  it("the tool's description and its copy in the MCP manifest say Reglas is for the Owner and Sales Leaders", async () => {
    const { readFileSync } = await import("node:fs");
    const description = getTool("drive_import_to_knowledge")!.description;
    expect(description).toMatch(RULE);
    const manifest = JSON.parse(readFileSync(".lovable/mcp/manifest.json", "utf8"));
    const m = (manifest.mcp.tools as { name: string; description: string }[]).find(
      (t) => t.name === "drive_import_to_knowledge",
    );
    expect(m?.description).toContain(description);
  });
});

// SDD-20261109-new-deal-source U-1 (NK-0123) CA-1, CA-2, CA-3, CA-4, CA-7: create_deal takes an optional, validated origin and
// always sends it (null when unknown), so the database default never decides it.
describe("create_deal source", () => {
  // The registry types its shape as the zod core type; the schema is a regular z.object, so this cast only reaches .description.
  const registrySource = () =>
    (getTool("create_deal")!.input as unknown as z.ZodObject<{ source: z.ZodType }>).shape.source;
  const dealInsert = (log: Q[]) => writes(log, "deals")[0]!.payload;
  const run = (args: Record<string, unknown>) => {
    const h = fakeDb((q) =>
      q.table === "deals" && q.op === "insert"
        ? { data: { id: ID(50), name: "Acme", account_id: ID(3) } }
        : q.op === "select"
          ? { data: { id: ID(3) } }
          : undefined,
    );
    return executeTool(ctxWith(h.db), "create_deal", {
      name: "Acme",
      account_id: ID(3),
      ...args,
    }).then(() => h.log);
  };
  it("CA-1: saves the origin it is given", async () => {
    const log = await run({ source: "inbound" });
    expect(dealInsert(log)).toMatchObject({ source: "inbound" });
    expectScoped(log);
  });
  it("CA-1: sends null, with the key present, for null and for no source", async () => {
    for (const args of [{ source: null }, {}]) {
      const log = await run(args);
      expect(dealInsert(log)).toHaveProperty("source", null);
      expectScoped(log);
    }
  });
  it("CA-2: refuses anything that is not one of the six keys and writes nothing", async () => {
    for (const source of ["outbound ", "Sin origen", "—", "Entrada de leads"]) {
      // The account exists, so only the source can make it fail.
      const { db, log } = fakeDb((q) => (q.op === "select" ? { data: { id: ID(3) } } : undefined));
      await expect(
        executeTool(ctxWith(db), "create_deal", { name: "Acme", account_id: ID(3), source }),
      ).rejects.toThrow();
      expect(writes(log), source).toEqual([]);
    }
  });
  it("CA-3: the pending action says the origin, and says nothing without it", () => {
    expect(summarizeAction("create_deal", { name: "Acme", source: "partner" })).toContain(
      "origen Partner",
    );
    expect(summarizeAction("create_deal", { name: "Acme" })).not.toMatch(/origen/i);
    expect(summarizeAction("create_deal", { name: "Acme", source: null })).not.toMatch(/origen/i);
  });
  it("CA-7: the description lists every key with its label", () => {
    const d = registrySource().description!;
    for (const [k, l] of Object.entries(DEAL_SOURCE_LABELS)) {
      expect(d).toContain(k);
      expect(d).toContain(l);
    }
  });
  it("CA-4: the MCP manifest has source with exactly the six keys, the same description, optional, title kept", async () => {
    const { readFileSync } = await import("node:fs");
    const manifest = JSON.parse(readFileSync(".lovable/mcp/manifest.json", "utf8"));
    const t = (
      manifest.mcp.tools as {
        name: string;
        title: string;
        inputSchema: {
          required?: string[];
          properties: Record<
            string,
            { description?: string; enum?: string[]; anyOf?: { enum?: string[] }[] }
          >;
        };
      }[]
    ).find((x) => x.name === "create_deal")!;
    const s = t.inputSchema.properties.source;
    expect(s).toBeDefined();
    const keys = s!.enum ?? s!.anyOf?.flatMap((a) => a.enum ?? []) ?? [];
    expect([...keys].sort()).toEqual([...DEAL_SOURCE_KEYS].sort());
    expect(s!.description).toBe(registrySource().description);
    expect(t.title).toBe("Crear deal");
    expect(t.inputSchema.required ?? []).not.toContain("source");
  });
});
