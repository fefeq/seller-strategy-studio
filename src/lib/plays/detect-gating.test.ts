import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { detect } from "@/lib/proactive";
import type { Snapshot } from "@/lib/proactive/types";
import { syncSuggestions, type Db } from "@/lib/org-data";
import { CATALOG } from "./catalog";
import { detectorsOf, disabledPlayIds } from "./gating";

// Fictional reference snapshot (no client data) that makes rules of six plays and several always-on rules fire at once.
const NOW = new Date("2026-11-06T10:00:00Z");
const H = 3_600_000;
const D = 24 * H;
const iso = (ms: number) => new Date(ms).toISOString();
const reference = (): Snapshot => ({
  now: NOW,
  orgId: "o1",
  setup: {
    currency: "EUR",
    segments: [],
    icps: [],
    positioning: null,
    pillars: [],
    quotas: [],
    accounts: 3,
    deals: 2,
    quarter: "2026-Q4",
  },
  members: [{ user_id: "u-owner", role: "owner" }],
  accounts: [
    {
      id: "a1",
      name: "Cuenta Ficticia Uno",
      is_target: true,
      owner_id: "u1",
      created_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "a2",
      name: "Cuenta Ficticia Dos",
      is_target: false,
      owner_id: "u1",
      created_at: "2026-01-02T00:00:00Z",
    },
    {
      id: "a3",
      name: "Cuenta Ficticia Tres",
      is_target: false,
      owner_id: null,
      created_at: "2026-01-03T00:00:00Z",
    },
  ],
  stakeholders: [{ account_id: "a1", buying_role: "champion" }],
  deals: [
    {
      id: "d1",
      name: "Trato frío",
      stage: "demo",
      amount: 1000,
      close_date: "2026-10-01",
      updated_at: iso(NOW.getTime() - 60 * D),
      owner_id: "u1",
      meddpicc: {},
      account_id: "a1",
    },
    {
      id: "d2",
      name: "Trato ganado",
      stage: "won",
      amount: 500,
      close_date: "2026-09-01",
      updated_at: iso(NOW.getTime() - 5 * D),
      owner_id: "u1",
      meddpicc: {},
      account_id: "a2",
    },
  ],
  meetings: [
    {
      id: "m1",
      title: "Reunión sin preparar",
      scheduled_at: iso(NOW.getTime() + 10 * H),
      ai_brief: null,
      account_id: "a1",
      created_by: "u1",
    },
    {
      id: "m2",
      title: "Reunión sin notas",
      scheduled_at: iso(NOW.getTime() - 5 * H),
      ai_brief: "x",
      account_id: "a1",
      created_by: "u1",
      notes: null,
      call_notes: null,
    },
  ],
  registrations: [],
  trials: [
    ...Array.from({ length: 10 }, () => ({
      segment_id: "g1",
      signed_up_at: iso(NOW.getTime() - 10 * D),
      activated_at: null,
      converted_at: null,
      mrr: null,
    })),
    ...Array.from({ length: 10 }, () => ({
      segment_id: "g2",
      signed_up_at: iso(NOW.getTime() - 10 * D),
      activated_at: iso(NOW.getTime() - 9 * D),
      converted_at: iso(NOW.getTime() - 8 * D),
      mrr: 10,
    })),
  ],
  segments: [
    { id: "g1", name: "Segmento Ficticio Uno" },
    { id: "g2", name: "Segmento Ficticio Dos" },
  ],
  leads: [
    {
      id: "l1",
      company: "Lead Ficticio",
      stage: "new",
      stage_entered_at: iso(NOW.getTime() - 40 * D),
      next_step_at: null,
      owner_id: "u1",
      account_id: null,
    },
  ],
  signals: [
    {
      id: "s1",
      account_id: "a1",
      title: "Ronda ficticia",
      kind: "funding",
      summary: "Resumen",
      relevance: "Relevancia",
      url: "https://ejemplo.test/a",
      found_at: iso(NOW.getTime() - 2 * D),
    },
  ],
  usage: [
    {
      domain: "empresa-nueva.test",
      account_id: null,
      active_users_7d: 20,
      active_users_prev_7d: 5,
    },
    { domain: "cuenta-dos.test", account_id: "a2", active_users_7d: 2, active_users_prev_7d: 10 },
  ],
  fitKey: {
    accounts: [{ id: "a3", domain: null }],
    contacts: [{ account_id: "a3", email: "persona@dominio-ficticio.test" }],
  },
});

const summary = (s: Snapshot) => detect(s).map((x) => `${x.detector} ${x.dedupe_key}`);

// What detect() returned on `reference()` at the base commit (47ec72c), recorded before the change: twelve suggestions from nine rules of
// six plays plus three always-on rules.
const BASE = [
  "stale_deal stale_deal:d1:2026-09-07",
  "past_close_date past_close_date:d1:2026-10-01",
  "meeting_no_prep meeting_no_prep:m1",
  "no_decision_maker no_decision_maker:a1",
  "trial_conversion trial_conversion:g1:2026-11",
  "setup_incomplete setup_incomplete:positioning",
  "late_lead late_lead:l1:new:2026-09-27",
  "meeting_no_notes meeting_no_notes:m2",
  "account_missing_key missing_domain:a3:8ce2cf85",
  "account_signal signal:s1",
  "product_qualified pql_new:empresa-nueva.test",
  "usage_drop usage_drop:a2:2026-11-02",
];

describe("detect() with every play enabled (CA-11, G-3)", () => {
  it("returns exactly what it returned before the change, in the same order", () => {
    expect(summary(reference())).toEqual(BASE);
  });

  it("is identical with no play_states rows: disabledPlayIds of no rows is empty, so nothing is filtered", () => {
    expect(disabledPlayIds([])).toEqual([]);
    expect(summary({ ...reference(), disabledPlays: disabledPlayIds([]) })).toEqual(BASE);
  });

  it("is identical when the rows only say enabled, or only mention plays that run no rule", () => {
    expect(
      disabledPlayIds([
        { play_id: "crm-hygiene", enabled: true },
        { play_id: "plg-to-sales", enabled: true },
      ]),
    ).toEqual([]);
    expect(
      disabledPlayIds([
        { play_id: "brand-mentions-monitoring", enabled: false },
        { play_id: "closed-lost-revival", enabled: false },
      ]),
    ).toEqual([]);
  });

  it("covers the nine rules that belong to plays, so the reference really exercises the gate", () => {
    const owned = CATALOG.flatMap((p) => p.detectors);
    const fired = new Set(detect(reference()).map((x) => x.detector));
    for (const d of owned) expect(fired.has(d), d).toBe(true);
  });
});

describe("detect() with a paused play (CA-12, G-3)", () => {
  it("drops only the suggestions whose detector belongs to the paused play and keeps every other one, in order", () => {
    const out = summary({ ...reference(), disabledPlays: ["meeting-prep-and-follow-up"] });
    expect(out).toEqual(
      BASE.filter((x) => !x.startsWith("meeting_no_prep ") && !x.startsWith("meeting_no_notes ")),
    );
  });

  it("does that for each play with rules, and never touches the always-on rules", () => {
    for (const p of CATALOG.filter((x) => x.detectors.length > 0)) {
      const out = summary({ ...reference(), disabledPlays: [p.id] });
      expect(out, p.id).toEqual(BASE.filter((x) => !p.detectors.includes(x.split(" ")[0]!)));
      for (const always of ["stale_deal", "past_close_date", "setup_incomplete"])
        expect(
          out.some((x) => x.startsWith(`${always} `)),
          `${p.id} ${always}`,
        ).toBe(true);
    }
  });

  it("filters before the dedupe, so a paused play never hides another rule's suggestion with the same key", () => {
    const out = detect({
      ...reference(),
      disabledPlays: CATALOG.filter((p) => p.detectors.length > 0).map((p) => p.id),
    });
    expect(out.map((x) => x.detector).sort()).toEqual([
      "past_close_date",
      "setup_incomplete",
      "stale_deal",
    ]);
  });

  it("reads the paused plays from the play_states rows", () => {
    expect(
      disabledPlayIds([
        { play_id: "meeting-prep-and-follow-up", enabled: false },
        { play_id: "crm-hygiene", enabled: true },
        { play_id: "a-future-play", enabled: false },
      ]),
    ).toEqual(["meeting-prep-and-follow-up"]);
    expect([...detectorsOf(["plg-to-sales"])].sort()).toEqual([
      "product_qualified",
      "trial_conversion",
      "usage_drop",
    ]);
    expect(detectorsOf([]).size).toBe(0);
  });

  it("closes the pending suggestions of that detector at the next sync and keeps them in the history", async () => {
    const store: Row[] = [];
    const db = fakeDb(store);
    await syncSuggestions(db, "o1", detect(reference()));
    const prep = store.find((r) => r.dedupe_key === "meeting_no_prep:m1")!;
    const notes = store.find((r) => r.dedupe_key === "meeting_no_notes:m2")!;
    expect([prep.status, notes.status]).toEqual(["pending", "pending"]);
    await syncSuggestions(
      db,
      "o1",
      detect({ ...reference(), disabledPlays: ["meeting-prep-and-follow-up"] }),
    );
    expect([prep.status, notes.status]).toEqual(["resolved", "resolved"]);
    expect(store.some((r) => r.dedupe_key === "meeting_no_prep:m1")).toBe(true); // still there: history
    expect(store.find((r) => r.dedupe_key === "late_lead:l1:new:2026-09-27")!.status).toBe(
      "pending",
    ); // the rest is untouched
  });
});

describe("loadSnapshot feeds the gate (U-5)", () => {
  const src = readFileSync("src/lib/org-data.ts", "utf8").replace(/\s+/g, "");
  it("reads play_states of the company with an explicit org_id (Telegram and cron use the privileged client)", () => {
    expect(src).toMatch(/from\("play_states"\)\.select\("play_id,enabled"\)\.eq\("org_id",orgId\)/);
  });
  it("leaves every rule on when that read fails, and adds the field only when a play is paused", () => {
    expect(src).toContain("disabledPlayIds(playStates.error?[]:(playStates.data??[]))");
    expect(src).toContain("...(disabledPlays.length?{disabledPlays}:{})");
  });
  it("is the only place that builds a Snapshot for detect(): the three callers go through it", () => {
    for (const f of [
      "src/lib/agent.functions.ts",
      "src/lib/inngest/tasks.server.ts",
      "src/routes/api/public/jobs/proactive.ts",
    ]) {
      expect(readFileSync(f, "utf8").replace(/\s+/g, ""), f).toMatch(
        /detect\((await)?(loadSnapshot|snap)/,
      );
    }
  });
});

type Row = {
  id: string;
  org_id: string;
  dedupe_key: string;
  detector: string;
  status: string;
  title: string;
  body: string | null;
  snoozed_until: string | null;
};

/** The slice of the Supabase client syncSuggestions uses on `suggestions`, as in setup-snooze-suggestions.test.ts. */
function fakeDb(store: Row[]): Db {
  const from = () => {
    let op: "select" | "update" | "upsert" = "select";
    let patch: Partial<Row> = {};
    let incoming: Partial<Row>[] = [];
    const filters: ((r: Row) => boolean)[] = [];
    const b: Record<string, unknown> = {
      select: () => b,
      update: (p: Partial<Row>) => {
        op = "update";
        patch = p;
        return b;
      },
      upsert: (rows: Partial<Row>[]) => {
        op = "upsert";
        incoming = rows;
        return b;
      },
      eq: (c: keyof Row, v: unknown) => (filters.push((r) => r[c] === v), b),
      in: (c: keyof Row, vs: unknown[]) => (filters.push((r) => vs.includes(r[c])), b),
      not: (c: keyof Row, _o: string, v: string) => {
        const vs = v.slice(1, -1).split(",");
        filters.push((r) => !vs.includes(String(r[c])));
        return b;
      },
      lte: (c: keyof Row, v: string) => (filters.push((r) => r[c] != null && String(r[c]) <= v), b),
      then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
        const hit = store.filter((r) => filters.every((f) => f(r)));
        if (op === "upsert")
          for (const n of incoming)
            if (!store.some((r) => r.org_id === n.org_id && r.dedupe_key === n.dedupe_key))
              store.push({
                id: `s${store.length + 1}`,
                status: "pending",
                snoozed_until: null,
                body: null,
                ...n,
              } as Row);
        if (op === "update") for (const r of hit) Object.assign(r, patch);
        return Promise.resolve({
          data: op === "select" ? hit.map((r) => ({ ...r })) : null,
          error: null,
        }).then(res, rej);
      },
    };
    return b;
  };
  return { from } as unknown as Db;
}
