// SDD-20261112-diagnosis-in-chat (NK-0153) CA-12: approving a plays_diagnosis suggestion is the approval of always. It runs the real
// decideSuggestionCore and the real executeTool (set_play_enabled → togglePlay → checkToggle), with the vi.mock of decide-suggestion.test.ts.
// (a) to (c) are regression guards (decideSuggestionCore already runs any action); (d) fails first: save_play_plan saves the plan, one of its
// rows is approved, the play is enabled and no other row changes.
// The double of decide-suggestion.test.ts answers null to the claim `.update().eq("status","pending").select("id")`, so no approval there
// reaches executeTool; this file writes its own multi-row double (that file and onboarding-stalled-sync.test.ts are not changed).
// Companies, people and texts are fictitious.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeTool, type ToolCtx } from "@/lib/agent/tools";

const remember = vi.hoisted(() => vi.fn());
vi.mock("@tanstack/react-start", () => {
  const chain: object = new Proxy(() => chain, { get: () => () => chain, apply: () => chain });
  return { createServerFn: () => chain };
});
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/memory.server", () => ({ rememberDecision: remember }));

import { decideSuggestionCore } from "@/lib/agent.functions";

type Row = Record<string, unknown>;
type Write = { table: string; op: "insert" | "upsert" | "update"; payload: unknown };

/**
 * A multi-row Supabase double: every table is an in-memory list. It supports what this flow uses: select with eq/in/not/limit/order,
 * maybeSingle, head counts, upsert with onConflict (ignoreDuplicates leaves the existing row; otherwise it merges), update, insert,
 * and `.select()` after a write, which returns only the rows really inserted or updated. RPCs answer from `rpcs`.
 */
function memoryDb(tables: Record<string, Row[]>, rpcs: Record<string, unknown> = {}) {
  const writes: Write[] = [];
  let seq = 0;
  const from = (table: string) => {
    const rows = (tables[table] ??= []);
    let op: "select" | "insert" | "upsert" | "update" = "select";
    let payload: unknown = null;
    let options: { onConflict?: string; ignoreDuplicates?: boolean } = {};
    let selected: string | undefined;
    let single = false;
    let head = false;
    const filters: ((r: Row) => boolean)[] = [];
    const pick = (r: Row) =>
      !selected || selected === "*"
        ? { ...r }
        : Object.fromEntries(selected.split(",").map((c) => [c.trim(), r[c.trim()]]));
    const b: Record<string, unknown> = {
      select: (cols?: string, o?: { head?: boolean }) => {
        selected = cols ?? "*";
        head = !!o?.head;
        return b;
      },
      insert: (p: unknown) => ((op = "insert"), (payload = p), b),
      update: (p: unknown) => ((op = "update"), (payload = p), b),
      upsert: (p: unknown, o: typeof options = {}) => (
        (op = "upsert"),
        (payload = p),
        (options = o),
        b
      ),
      eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), b),
      in: (c: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[c])), b),
      not: (c: string, o: string, v: unknown) => (
        filters.push((r) => (o === "is" && v === null ? r[c] != null : r[c] !== v)),
        b
      ),
      limit: () => b,
      order: () => b,
      maybeSingle: () => ((single = true), b),
      single: () => ((single = true), b),
      then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
        let data: unknown = null;
        let count: number | null = null;
        if (op === "select") {
          const hit = rows.filter((r) => filters.every((f) => f(r)));
          if (head) count = hit.length;
          else data = single ? (hit[0] ? pick(hit[0]) : null) : hit.map(pick);
        } else {
          writes.push({ table, op, payload });
          const touched: Row[] = [];
          if (op === "update") {
            for (const r of rows.filter((x) => filters.every((f) => f(x)))) {
              Object.assign(r, payload);
              touched.push(r);
            }
          } else {
            const cols = (options.onConflict ?? "").split(",").filter(Boolean);
            for (const n of [payload].flat() as Row[]) {
              const existing = cols.length
                ? rows.find((r) => cols.every((c) => r[c] === n[c]))
                : undefined;
              if (existing && op === "upsert") {
                if (options.ignoreDuplicates) continue;
                Object.assign(existing, n);
                touched.push(existing);
                continue;
              }
              const row = {
                id: `${table}-${++seq}`,
                ...(table === "suggestions" ? { status: "pending" } : {}),
                ...n,
              };
              rows.push(row);
              touched.push(row);
            }
          }
          if (selected !== undefined)
            data = single ? (touched[0] ? pick(touched[0]) : null) : touched.map(pick);
        }
        return Promise.resolve({ data, error: null, count }).then(res, rej);
      },
    };
    return b;
  };
  const rpc = async (name: string) => ({ data: rpcs[name] ?? null, error: null });
  return { db: { from, rpc } as unknown as ToolCtx["db"], writes, tables };
}

const ORG = "org-1";
const OTHER_ORG = "org-2";
const OWNER = "11111111-1111-4111-8111-111111111111";
const AE = "33333333-3333-4333-8333-333333333333";
const ctx = (db: ToolCtx["db"], roles: string[], userId: string): ToolCtx => ({
  db,
  orgId: ORG,
  userId,
  roles,
  currency: "EUR",
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
const DIAGNOSIS = {
  input: { model: "b2b", acv: 9000, friction: "committee", stage: "early" },
  result: {
    archetype: "B",
    name: "Arquetipo ficticio",
    motion: "inside_sales",
    nextStep: "Define tu ICP",
    active: ["x"],
    discarded: [],
    forced: [],
    star: "z",
  },
};
/** A ready company (GTM diagnosis, positioning and ICP), the reads of onboardingStatusFor and loadSetupData, and the given suggestions. */
function readyCompany(suggestions: Row[] = [], playStates: Row[] = []) {
  return memoryDb(
    {
      organizations: [{ id: ORG, currency: "EUR" }],
      segments: [],
      icp_profiles: [
        { org_id: ORG, industries: "a", company_size: "b", why_fit: "c", anti_icp: "d" },
      ],
      positioning: [{ org_id: ORG, ...Object.fromEntries(POS.map((k) => [k, `texto ${k}`])) }],
      messaging_pillars: [],
      quotas: [],
      accounts: [],
      deals: [],
      onboarding_sessions: [],
      play_states: playStates,
      suggestions,
    },
    { company_diagnosis: DIAGNOSIS },
  );
}
const suggestion = (playId: string, o: Row = {}): Row => ({
  id: `sug-${playId}`,
  org_id: ORG,
  user_id: OWNER,
  dedupe_key: `plays_diagnosis:${playId}`,
  detector: "plays_diagnosis",
  status: "pending",
  priority: 2,
  title: "Título ficticio",
  body: "Cuerpo ficticio",
  link: "/plays?vista=equipos",
  action: { tool: "set_play_enabled", args: { play_id: playId, enabled: true } },
  strategy: null,
  snoozed_until: null,
  notified_at: null,
  updated_at: "2026-11-01T08:00:00.000Z",
  ...o,
});
const stateOf = (tables: Record<string, Row[]>, playId: string) =>
  tables.play_states!.find((r) => r.org_id === ORG && r.play_id === playId);

beforeEach(() => remember.mockReset());

describe("approving a plays_diagnosis suggestion (CA-12, regression guards)", () => {
  it("(a) the Owner approves it: the play is enabled in play_states and the suggestion is approved", async () => {
    const { db, tables } = readyCompany([suggestion("signals-in-crm-with-decay")]);
    const r = await decideSuggestionCore(
      ctx(db, ["owner"], OWNER),
      "sug-signals-in-crm-with-decay",
      "approve",
    );
    expect(r).toEqual({
      status: "approved",
      message: "Hecho. Señales en el CRM con caída en el tiempo: Activado.",
    });
    expect(stateOf(tables, "signals-in-crm-with-decay")).toMatchObject({
      org_id: ORG,
      play_id: "signals-in-crm-with-decay",
      enabled: true,
      updated_by: OWNER,
    });
    expect(tables.suggestions![0]!.status).toBe("approved");
  });

  it("(b) a blocked play is not enabled: the error of checkToggle comes back and the suggestion is pending again", async () => {
    const { db, tables, writes } = readyCompany([suggestion("website-visitor-de-anonymization")]);
    await expect(
      decideSuggestionCore(
        ctx(db, ["owner"], OWNER),
        "sug-website-visitor-de-anonymization",
        "approve",
      ),
    ).rejects.toThrow("No puedes activar este play todavía");
    expect(tables.suggestions![0]!.status).toBe("pending");
    expect(writes.filter((w) => w.table === "play_states")).toEqual([]);
  });

  it("(c) an AE cannot approve the Owner's suggestion: «Sugerencia no encontrada» and play_states is not written", async () => {
    const { db, tables, writes } = readyCompany([suggestion("signals-in-crm-with-decay")]);
    await expect(
      decideSuggestionCore(ctx(db, ["ae"], AE), "sug-signals-in-crm-with-decay", "approve"),
    ).rejects.toThrow("Sugerencia no encontrada");
    expect(writes).toEqual([]);
    expect(tables.suggestions![0]!.status).toBe("pending");
  });
});

describe("save the plan, then approve one of its suggestions (CA-12 (d), fails first)", () => {
  it("only that play is enabled and no other row changes", async () => {
    const foreign = suggestion("closed-lost-revival", {
      id: "foreign",
      org_id: OTHER_ORG,
      user_id: "44444444-4444-4444-8444-444444444444",
    });
    const { db, tables } = readyCompany([foreign]);
    const owner = ctx(db, ["owner"], OWNER);
    const saved = (await executeTool(owner, "save_play_plan", {
      bottleneck: null,
      wanted: [],
    })) as { creadas: number };
    expect(saved.creadas).toBe(3);
    const mine = tables.suggestions!.filter((r) => r.org_id === ORG);
    expect(mine.map((r) => r.dedupe_key)).toEqual([
      "plays_diagnosis:hubspot-account-tiering-scoring",
      "plays_diagnosis:signals-in-crm-with-decay",
      "plays_diagnosis:closed-lost-revival",
    ]);
    // Saving activated nothing.
    expect(tables.play_states).toEqual([]);

    const target = mine.find((r) => r.dedupe_key === "plays_diagnosis:signals-in-crm-with-decay")!;
    const before = structuredClone(tables.suggestions!.filter((r) => r.id !== target.id));
    const r = await decideSuggestionCore(owner, String(target.id), "approve");
    expect(r.status).toBe("approved");
    expect(target.status).toBe("approved");
    expect(tables.play_states).toEqual([
      {
        id: expect.any(String),
        org_id: ORG,
        play_id: "signals-in-crm-with-decay",
        enabled: true,
        updated_by: OWNER,
      },
    ]);
    expect(tables.suggestions!.filter((x) => x.id !== target.id)).toEqual(before);
  });
});
