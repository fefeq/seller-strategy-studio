import { describe, expect, it } from "vitest";
import { detect, digest } from "./proactive";
import type { Snapshot } from "./proactive/types";
import { setupStatus, type SetupData } from "@/lib/setup-schema";
import { canUseTool, getTool, toolsFor } from "@/lib/agent/tools";
import { proposalItems, type SetupProposal } from "@/lib/setup-extraction";

const NOW = new Date("2026-10-20T10:00:00Z");
const fullPos = {
  best_customers: "a",
  alternatives: "a",
  differentiation: "a",
  value: "a",
  trend: "a",
  target_customer: "a",
  need: "a",
  category: "a",
  key_benefit: "a",
  competitive_alternative: "a",
  differentiator: "a",
  one_liner: "a",
  elevator_pitch: "a",
};
const setup = (o: Partial<SetupData> = {}): SetupData => ({
  currency: "EUR",
  segments: [{ name: "SMB", acv_min: 5000, acv_max: 50000, win_rate_target: 25, ae_quota: 600000 }],
  icps: [{ industries: "SaaS", company_size: "50-200", why_fit: "x", anti_icp: "y" }],
  positioning: fullPos,
  pillars: [
    { title: "a", message: "m" },
    { title: "b", message: "m" },
    { title: "c", message: "m" },
  ],
  quotas: [{ period: "2026-Q4", amount: 100000 }],
  accounts: 1,
  deals: 1,
  quarter: "2026-Q4",
  ...o,
});
const snap = (o: Partial<Snapshot> = {}): Snapshot => ({
  now: NOW,
  orgId: "o",
  setup: setup(),
  deals: [],
  meetings: [],
  accounts: [],
  stakeholders: [],
  registrations: [],
  trials: [],
  segments: [],
  ...o,
});
const deal = (o: Partial<Snapshot["deals"][number]>) => ({
  id: "d1",
  name: "Acme",
  stage: "demo",
  amount: 400000,
  close_date: "2026-12-01",
  updated_at: NOW.toISOString(),
  owner_id: "u1",
  meddpicc: {},
  account_id: null,
  ...o,
});
const keys = (s: Snapshot) => detect(s).map((x) => x.detector);

describe("setup completeness", () => {
  it("full data is 100%", () => expect(setupStatus(setup()).pct).toBe(100));
  it("missing quota costs 15 points and is the next step", () => {
    const st = setupStatus(setup({ quotas: [] }));
    expect(st.pct).toBe(85);
    expect(st.next?.id).toBe("quota");
  });
  it("a quota from another quarter does not count", () =>
    expect(setupStatus(setup({ quotas: [{ period: "2026-Q3", amount: 5 }] })).next?.id).toBe(
      "quota",
    ));
  it("positioning is not done while the Dunford framework is empty", () => {
    const st = setupStatus(setup({ positioning: { ...fullPos, best_customers: "", trend: null } }));
    expect(st.items.find((i) => i.id === "positioning")?.done).toBe(false);
  });
  it("a win rate target of 0 counts as filled", () =>
    expect(
      setupStatus(
        setup({
          segments: [
            { name: "Enterprise", acv_min: 50000, acv_max: null, win_rate_target: 0, ae_quota: 0 },
          ],
        }),
      ).items.find((i) => i.id === "benchmarks")?.done,
    ).toBe(true));
  it("needs three pillars with message", () =>
    expect(setupStatus(setup({ pillars: [{ title: "a", message: "m" }] })).next?.id).toBe(
      "pillars",
    ));
});

describe("detectors", () => {
  it("a delayed lead proposes a follow-up task; one on time does not", () => {
    const lead = (o: object) => ({
      id: "l1",
      company: "Acme",
      stage: "contacted",
      stage_entered_at: new Date(NOW.getTime() - 4 * 864e5).toISOString(),
      next_step_at: null,
      owner_id: "u1",
      account_id: null,
      ...o,
    });
    const s = detect(snap({ leads: [lead({})] })).find((x) => x.detector === "late_lead");
    expect(s?.action?.tool).toBe("create_task");
    expect(
      keys(
        snap({
          leads: [lead({ stage_entered_at: new Date(NOW.getTime() - 2 * 864e5).toISOString() })],
        }),
      ),
    ).not.toContain("late_lead");
    expect(
      keys(
        snap({
          leads: [lead({ stage_entered_at: NOW.toISOString(), next_step_at: "2026-10-19" })],
        }),
      ),
    ).toContain("late_lead");
  });
  it("follow-up sequence: day 3, 7 and 14 on contacted leads, with a draft and the lead update", () => {
    const ago = (n: number) => new Date(NOW.getTime() - n * 864e5).toISOString();
    const contacted = (n: number) => ({
      id: "l1",
      company: "Acme",
      stage: "contacted",
      stage_entered_at: ago(n),
      contacted_at: ago(n),
      contact_name: "Ana Ruiz",
      next_step_at: null,
      owner_id: "u1",
      account_id: null,
    });
    expect(keys(snap({ leads: [contacted(2)] }))).not.toContain("followup_sequence");
    const d3 = detect(snap({ leads: [contacted(3)] })).find(
      (x) => x.detector === "followup_sequence",
    );
    expect(d3?.dedupe_key).toBe("followup:l1:nudge");
    expect(d3?.body).toContain("Hola, Ana.");
    expect(d3?.action).toEqual({
      tool: "update_lead",
      args: {
        lead_id: "l1",
        next_step: "Seguimiento día 3 enviado; toca el día 7",
        next_step_at: ago(-4).slice(0, 10),
      },
    });
    expect(
      detect(snap({ leads: [contacted(14)] })).find((x) => x.detector === "followup_sequence")
        ?.dedupe_key,
    ).toBe("followup:l1:breakup");
    // While the sequence runs, the late-lead rule stays quiet; after it ends, it takes over.
    expect(keys(snap({ leads: [contacted(5)] }))).not.toContain("late_lead");
    expect(keys(snap({ leads: [contacted(22)] }))).toEqual(expect.arrayContaining(["late_lead"]));
    expect(keys(snap({ leads: [contacted(22)] }))).not.toContain("followup_sequence");
  });
  it("stale deal after 14 days proposes a task, not before", () => {
    expect(
      keys(
        snap({ deals: [deal({ updated_at: new Date(NOW.getTime() - 13 * 864e5).toISOString() })] }),
      ),
    ).not.toContain("stale_deal");
    const s = detect(
      snap({ deals: [deal({ updated_at: new Date(NOW.getTime() - 15 * 864e5).toISOString() })] }),
    ).find((x) => x.detector === "stale_deal");
    expect(s?.action?.tool).toBe("create_task");
    expect(s?.user_id).toBe("u1");
  });
  it("the stale threshold follows the segment's real cycle, or the company's own number", () => {
    const ago = (n: number) => new Date(NOW.getTime() - n * 864e5).toISOString();
    const seg = {
      id: "mid",
      name: "Mid",
      acv_min: 10000,
      acv_max: 100000,
      win_rate_target: null,
      cac_target: null,
      gross_margin_pct: null,
      payback_months: null,
    };
    const won = [
      {
        id: "w1",
        stage: "won",
        amount: 50000,
        segment_id: "mid",
        close_date: null,
        created_at: ago(200),
        closed_at: ago(80),
        updated_at: ago(80),
      },
      {
        id: "w2",
        stage: "won",
        amount: 60000,
        segment_id: "mid",
        close_date: null,
        created_at: ago(150),
        closed_at: ago(30),
        updated_at: ago(30),
      },
    ];
    const idle = (n: number, staleDays: number | null = null) => {
      const d = deal({ amount: 50000, updated_at: ago(n) });
      return detect(
        snap({
          deals: [d],
          cycleDeals: [...won, { ...d, segment_id: "mid", closed_at: null, created_at: ago(40) }],
          cycleSegments: [seg],
          staleDays,
        }),
      ).find((x) => x.detector === "stale_deal");
    };
    // 120-day cycle → 30-day threshold: 20 idle days is fine, 31 is cold.
    expect(idle(20)).toBeUndefined();
    expect(idle(31)?.body).toContain("30 días, un cuarto del ciclo real de 120 días");
    expect(idle(31)?.priority).toBe(2);
    expect(idle(61)?.priority).toBe(1);
    // The company's own number wins.
    expect(idle(20, 10)?.body).toContain("10 días, fijado por la empresa");
  });
  it("past close date proposes moving it 30 days", () => {
    const s = detect(snap({ deals: [deal({ close_date: "2026-10-01" })] })).find(
      (x) => x.detector === "past_close_date",
    );
    expect(s?.action).toEqual({
      tool: "update_deal",
      args: { deal_id: "d1", close_date: "2026-11-19" },
    });
  });
  it("won deals are ignored by deal detectors", () =>
    expect(
      keys(
        snap({
          deals: [
            deal({ stage: "won", close_date: "2026-01-01", updated_at: "2026-01-01T00:00:00Z" }),
          ],
        }),
      ).filter((k) => k !== "low_coverage"),
    ).toEqual([]));
  it("coverage below 3x is flagged; 3x is healthy", () => {
    expect(keys(snap({ deals: [deal({ amount: 290000 })] }))).toContain("low_coverage");
    expect(keys(snap({ deals: [deal({ amount: 300000 })] }))).not.toContain("low_coverage");
  });
  it("late-stage deal with more than 2 MEDDPICC gaps", () => {
    expect(keys(snap({ deals: [deal({ stage: "proposal" })] }))).toContain("meddpicc_gaps");
    const m = {
      metrics: "x",
      economic_buyer: "x",
      decision_criteria: "x",
      decision_process: "x",
      paper_process: "x",
      identify_pain: "x",
    };
    expect(keys(snap({ deals: [deal({ stage: "proposal", meddpicc: m })] }))).not.toContain(
      "meddpicc_gaps",
    );
  });
  it("meeting in next 36h without brief offers to prepare it", () => {
    const m = {
      id: "m1",
      title: "Demo",
      scheduled_at: new Date(NOW.getTime() + 864e5).toISOString(),
      ai_brief: null,
      account_id: null,
      created_by: "u1",
    };
    expect(
      detect(snap({ meetings: [m] })).find((x) => x.detector === "meeting_no_prep")?.action?.tool,
    ).toBe("prepare_meeting_brief");
    expect(
      keys(
        snap({
          meetings: [{ ...m, scheduled_at: new Date(NOW.getTime() + 3 * 864e5).toISOString() }],
        }),
      ),
    ).not.toContain("meeting_no_prep");
  });
  it("past meeting without notes asks for the five lines, linked to that meeting", () => {
    const m = {
      id: "m1",
      title: "Discovery",
      scheduled_at: new Date(NOW.getTime() - 5 * 3_600_000).toISOString(),
      ai_brief: "x",
      account_id: "a1",
      created_by: "u1",
      notes: null,
      call_notes: {},
    };
    const s = detect(snap({ meetings: [m] })).find((x) => x.detector === "meeting_no_notes");
    expect(s?.link).toBe("/accounts/a1?tab=meetings&meeting=m1");
    expect(s?.action).toBeNull();
    expect(
      keys(snap({ meetings: [{ ...m, call_notes: { dolor: "Pierden leads" } }] })),
    ).not.toContain("meeting_no_notes");
    expect(
      keys(
        snap({
          meetings: [{ ...m, scheduled_at: new Date(NOW.getTime() - 9 * 864e5).toISOString() }],
        }),
      ),
    ).not.toContain("meeting_no_notes");
  });
  it("unowned accounts with two people who can take them: one reminder to the Owner, keyed on the newest", () => {
    const members = [
      { user_id: "own", role: "owner" },
      { user_id: "ae1", role: "ae" },
      { user_id: "mk", role: "marketing" },
    ];
    const accounts = [
      {
        id: "a1",
        name: "Acme",
        is_target: false,
        owner_id: null,
        created_at: "2026-10-01T00:00:00Z",
      },
      {
        id: "a2",
        name: "Beta",
        is_target: false,
        owner_id: null,
        created_at: "2026-10-10T00:00:00Z",
      },
      {
        id: "a3",
        name: "Gamma",
        is_target: false,
        owner_id: "ae1",
        created_at: "2026-10-12T00:00:00Z",
      },
    ];
    const s = detect(snap({ accounts, members })).find((x) => x.detector === "unassigned_accounts");
    expect(s).toMatchObject({
      dedupe_key: "unassigned_accounts:a2",
      title: "2 cuentas sin responsable",
      user_id: "own",
      link: "/accounts/assignment",
    });
    expect(keys(snap({ accounts, members: [members[0], members[2]] }))).not.toContain(
      "unassigned_accounts",
    );
    expect(keys(snap({ accounts: [accounts[2]], members }))).not.toContain("unassigned_accounts");
    expect(keys(snap({ accounts }))).not.toContain("unassigned_accounts");
  });
  it("target account without decision maker", () => {
    const accounts = [{ id: "a1", name: "Acme", is_target: true, owner_id: null }];
    expect(
      keys(snap({ accounts, stakeholders: [{ account_id: "a1", buying_role: "champion" }] })),
    ).toContain("no_decision_maker");
    expect(
      keys(snap({ accounts, stakeholders: [{ account_id: "a1", buying_role: "decision_maker" }] })),
    ).not.toContain("no_decision_maker");
  });
  it("incomplete setup suggests the next item", () =>
    expect(
      detect(snap({ setup: setup({ quotas: [] }) })).find((x) => x.detector === "setup_incomplete")
        ?.dedupe_key,
    ).toBe("setup_incomplete:quota"));
  it("setup suggestion follows the fixed order, not the weight (CA-3)", () => {
    // quota weighs 15, segments 10: segments comes first in the order.
    const found = detect(snap({ setup: setup({ quotas: [], segments: [] }) })).find(
      (x) => x.detector === "setup_incomplete",
    );
    expect(found?.dedupe_key).toBe("setup_incomplete:segments");
    expect(found?.body).toContain("recomendarte el motion");
  });
  it("a snoozed setup step gets no suggestion until its date, and the next step takes its place (CA-7)", () => {
    const s = snap({
      setup: setup({ quotas: [], pillars: [] }),
      setupSnoozes: [{ step_id: "pillars", snoozed_until: "2026-11-05T23:59:59.999Z" }],
    });
    expect(detect(s).find((x) => x.detector === "setup_incomplete")?.dedupe_key).toBe(
      "setup_incomplete:quota",
    );
    expect(
      detect({ ...s, now: new Date("2026-11-06T08:00:00Z") }).find(
        (x) => x.detector === "setup_incomplete",
      )?.dedupe_key,
    ).toBe("setup_incomplete:pillars:1793923199"); // keyed by the instant the postponement ended (epoch seconds), so it is a new suggestion even if the old one was closed
  });
  it("a company that left the guide for over a day gets the setup suggestion at top priority (CA-6)", () => {
    const base = snap({ setup: setup({ quotas: [] }) });
    expect(
      detect({ ...base, setupActivityAt: "2026-10-18T08:00:00Z" }).find(
        (x) => x.detector === "setup_incomplete",
      )?.priority,
    ).toBe(1);
    expect(
      detect({ ...base, setupActivityAt: "2026-10-20T09:30:00Z" }).find(
        (x) => x.detector === "setup_incomplete",
      )?.priority,
    ).toBe(3);
  });
  describe("the setup suggestion follows the real roles (CA-8)", () => {
    const team = [
      { user_id: "ae1", role: "ae" },
      { user_id: "mk1", role: "marketing" },
      { user_id: "sl1", role: "sales_leader" },
      { user_id: "own1", role: "owner" },
    ];
    const setupOf = (
      o: Partial<SetupData>,
      members?: Snapshot["members"],
      extra: Partial<Snapshot> = {},
    ) =>
      detect(snap({ setup: setup(o), members, ...extra })).find(
        (x) => x.detector === "setup_incomplete",
      );
    it("a step only leaders complete goes to the Owner, so an AE never sees it", () => {
      const f = setupOf({ quotas: [] }, team);
      expect(f?.dedupe_key).toBe("setup_incomplete:quota");
      expect(f?.user_id).toBe("own1");
    });
    it("without an Owner it goes to the Sales Leader; a step Marketing can do goes to the first of Owner, Sales Leader, Marketing", () => {
      expect(
        setupOf(
          { quotas: [] },
          team.filter((m) => m.role !== "owner"),
        )?.user_id,
      ).toBe("sl1");
      expect(
        setupOf(
          { pillars: [] },
          team.filter((m) => m.role === "marketing" || m.role === "ae"),
        )?.user_id,
      ).toBe("mk1");
    });
    it("a step open to every role stays unassigned: any member may take it", () => {
      const f = setupOf({ deals: 0 }, team);
      expect(f?.dedupe_key).toBe("setup_incomplete:deals");
      expect(f?.user_id).toBeNull();
    });
    it("no suggestion when nobody on the team can complete the next step", () => {
      expect(setupOf({ quotas: [] }, [{ user_id: "ae1", role: "ae" }])).toBeUndefined();
    });
    it("the inactivity priority does not depend on a role", () => {
      expect(
        setupOf({ quotas: [] }, team, { setupActivityAt: "2026-10-18T08:00:00Z" })?.priority,
      ).toBe(1);
      expect(
        setupOf({ deals: 0 }, team, { setupActivityAt: "2026-10-18T08:00:00Z" })?.priority,
      ).toBe(1);
    });
  });
  it("digest returns top 3 by priority", () => {
    const d = digest([
      { priority: 3, created_at: "1" },
      { priority: 1, created_at: "1" },
      { priority: 2, created_at: "1" },
      { priority: 1, created_at: "2" },
    ]);
    expect(d.map((x) => x.priority)).toEqual([1, 1, 2]);
  });
});

describe("agent tool permissions", () => {
  it("only owner can change currency", () => {
    expect(canUseTool(getTool("set_currency")!, ["owner"])).toBe(true);
    expect(canUseTool(getTool("set_currency")!, ["ae"])).toBe(false);
  });
  it("only owner and sales leader set quotas", () => {
    expect(canUseTool(getTool("set_quota")!, ["sales_leader"])).toBe(true);
    expect(canUseTool(getTool("set_quota")!, ["marketing"])).toBe(false);
  });
  it("an AE gets read tools and deal writes but not strategy writes", () => {
    const names = toolsFor(["ae"]).map((t) => t.name);
    expect(names).toContain("update_deal");
    expect(names).not.toContain("update_positioning");
  });
});

describe("setup proposal mapping", () => {
  const p: SetupProposal = {
    summary: "",
    currency: "USD",
    positioning: { one_liner: "X", need: null },
    segments: [
      {
        name: "smb",
        acv_min: 1,
        acv_max: 2,
        motion: "inside",
        win_rate_target: null,
        ae_quota: null,
      },
    ],
    icps: [],
    pillars: [],
    target_accounts: [{ name: "Acme", domain: null, why: null }],
    questions: [],
  };
  it("maps to tool calls, updating existing segments by name and skipping nulls", () => {
    const items = proposalItems(
      p,
      [{ id: "11111111-1111-1111-1111-111111111111", name: "SMB" }],
      "EUR",
    );
    expect(items.map((i) => i.tool)).toEqual([
      "set_currency",
      "update_positioning",
      "upsert_segment",
      "create_account",
    ]);
    expect(items[1].args).toEqual({ fields: { one_liner: "X" } });
    expect(items[2].args).toMatchObject({ segment_id: "11111111-1111-1111-1111-111111111111" });
    expect(items[2].args).not.toHaveProperty("ae_quota");
  });
  it("same currency is not proposed", () =>
    expect(proposalItems(p, [], "USD")[0].tool).toBe("update_positioning"));
});

describe("segment proposals", () => {
  it("flag a range with mín = máx and keep priority and note out of the name", async () => {
    const { segmentRangeWarning } = await import("@/lib/setup-extraction");
    expect(segmentRangeWarning(6000, 6000)).toMatch(/iguales/);
    expect(segmentRangeWarning(1428, 14280)).toBeNull();
    const p: SetupProposal = {
      summary: "",
      currency: null,
      positioning: {},
      icps: [],
      pillars: [],
      target_accounts: [],
      questions: [],
      segments: [
        {
          name: "Agencias de marca personal",
          priority: 1,
          notes: "ACV por cuenta",
          acv_min: 6000,
          acv_max: 6000,
          motion: "inside",
          win_rate_target: null,
          ae_quota: null,
        },
      ],
    };
    const [item] = proposalItems(p, [], "EUR");
    expect(item.label).toBe("Agencias de marca personal");
    expect(item.detail).toMatch(/Prioridad 1/);
    expect(item.detail).toMatch(/iguales/);
    expect(item.args).toMatchObject({ priority: 1, notes: "ACV por cuenta" });
  });
});

describe("proposal item summaries", () => {
  it("follow the edited values instead of the original text", async () => {
    const { itemDetail } = await import("@/lib/setup-extraction");
    expect(
      itemDetail("upsert_segment", {
        name: "Agencias",
        acv_min: 1428,
        acv_max: 14280,
        motion: "inside",
      }),
    ).toBe("ACV 1428–14280 · inside");
    expect(
      itemDetail("upsert_segment", {
        name: "Agencias",
        acv_min: 6000,
        acv_max: 6000,
        motion: "inside",
      }),
    ).toMatch(/iguales/);
    expect(itemDetail("create_account", { name: "Acme" })).toBeNull();
  });
});

describe("product usage detectors", () => {
  const accounts = [
    { id: "a1", name: "Acme", is_target: false, owner_id: "u1" },
    { id: "a2", name: "Beta", is_target: false, owner_id: "u2" },
  ];
  it("flags a growing non-customer and a company not in Nokko", () => {
    const s = snap({
      accounts,
      usage: [
        { domain: "acme.com", account_id: "a1", active_users_7d: 4, active_users_prev_7d: 2 },
        { domain: "new.io", account_id: null, active_users_7d: 5, active_users_prev_7d: 1 },
      ],
    });
    const found = detect(s).filter((x) => x.detector === "product_qualified");
    expect(found.map((x) => x.dedupe_key)).toEqual(["pql:a1:2026-10", "pql_new:new.io"]);
    expect(found[1]!.action).toEqual({
      tool: "create_account",
      args: { name: "new.io", domain: "new.io" },
    });
  });
  it("does not flag customers as product-qualified but warns when their usage halves", () => {
    const s = snap({
      accounts,
      deals: [deal({ account_id: "a2", stage: "won" })],
      usage: [
        { domain: "beta.com", account_id: "a2", active_users_7d: 0, active_users_prev_7d: 6 },
        { domain: "acme.com", account_id: "a1", active_users_7d: 1, active_users_prev_7d: 6 },
      ],
    });
    const k = detect(s).filter(
      (x) => x.detector === "product_qualified" || x.detector === "usage_drop",
    );
    expect(k.map((x) => [x.detector, x.dedupe_key, x.priority])).toEqual([
      ["usage_drop", "usage_drop:a2:2026-10-19", 1],
    ]);
  });
});

// ---- Telegram messages for a suggestion (NK-0041, CA-4): what the urgent notice and the daily digest offer ----
import { digestMessage, urgentMessage } from "./telegram-suggestions";
import { buildStrategySuggestion, STRATEGY_ACTIONS } from "./strategy-suggestions";

const strategyOf = (action_type: (typeof STRATEGY_ACTIONS)[number]) =>
  buildStrategySuggestion({
    element: "pipeline",
    kind: "validate",
    action_type,
    cause: "c",
    priority: 1,
    title: "t",
    body: "b",
    evidence: [{ table: "deals", id: "d1", label: "Deal 1" }],
  }).strategy;
const urgent = (o: Record<string, unknown> = {}) => ({
  id: "s1",
  title: "Título",
  body: "Cuerpo",
  action: null,
  strategy: null as unknown,
  ...o,
});
const texts = (rows: { text: string }[][]) => rows.map((r) => r.map((b) => b.text));

describe("Telegram messages: suggestions that need no form (unchanged behaviour)", () => {
  it("urgent notice: «Hecho», «En 3 días» and «Descartar», text is title and body", () => {
    const m = urgentMessage(urgent());
    expect(m.text).toBe("Título\nCuerpo");
    expect(texts(m.buttons)).toEqual([["Hecho", "En 3 días", "Descartar"]]);
    expect(m.buttons[0]!.map((b) => b.data)).toEqual([
      "s:s1:approve",
      "s:s1:snooze",
      "s:s1:dismiss",
    ]);
  });
  it("urgent notice with an action to run says «Aprobar y hacer»", () => {
    const m = urgentMessage(urgent({ action: { tool: "update_task", args: {} } }));
    expect(texts(m.buttons)).toEqual([["Aprobar y hacer", "En 3 días", "Descartar"]]);
  });
  it("a strategic suggestion that changes strategy or asks for data is unchanged too", () => {
    for (const t of ["strategy_change", "data_to_complete"] as const) {
      const m = urgentMessage(urgent({ strategy: strategyOf(t) }));
      expect(m.text).toBe("Título\nCuerpo");
      expect(texts(m.buttons)).toEqual([["Hecho", "En 3 días", "Descartar"]]);
    }
  });
  it("digest: numbered titles and «Hecho n» + «Posponer n» per line", () => {
    const m = digestMessage(
      [
        { id: "a", title: "Uno", strategy: null },
        { id: "b", title: "Dos", strategy: strategyOf("data_to_complete") },
      ],
      "Ana",
    );
    expect(m.text).toBe(
      "Buenos días, Ana. 3 cosas para hoy:\n\n1. Uno\n2. Dos\n\nPulsa para gestionarlas o pregúntame lo que quieras.",
    );
    expect(texts(m.buttons)).toEqual([
      ["Hecho 1", "Posponer 1"],
      ["Hecho 2", "Posponer 2"],
    ]);
    expect(m.buttons[1]!.map((b) => b.data)).toEqual(["s:b:approve", "s:b:snooze"]);
  });
  it("digest with nothing and no name", () => {
    expect(digestMessage([], "")).toEqual({
      text: "Buenos días. Nada urgente hoy. ¿En qué te ayudo?",
      buttons: [],
    });
  });
});

describe("Telegram messages: a test or a commercial action is completed in the app (CA-4)", () => {
  for (const t of ["experiment", "commercial_action"] as const) {
    it(`${t}: the urgent notice offers only «En 3 días» and «Descartar» and sends to Sugerencias`, () => {
      const m = urgentMessage(
        urgent({ strategy: strategyOf(t), action: { tool: "update_task", args: {} } }),
      );
      expect(texts(m.buttons)).toEqual([["En 3 días", "Descartar"]]);
      expect(m.buttons[0]!.some((b) => b.data.endsWith(":approve"))).toBe(false);
      expect(m.text).toBe("Título\nCuerpo\nComplétala en Sugerencias.");
    });
    it(`${t}: the digest offers only «Posponer n» and marks the line`, () => {
      const m = digestMessage(
        [
          { id: "a", title: "Uno", strategy: null },
          { id: "b", title: "Dos", strategy: strategyOf(t) },
        ],
        "",
      );
      expect(m.text).toContain("1. Uno\n2. Dos (se completa en Sugerencias)\n");
      expect(texts(m.buttons)).toEqual([["Hecho 1", "Posponer 1"], ["Posponer 2"]]);
      expect(m.buttons.flat().filter((b) => b.data === "s:b:approve")).toEqual([]);
    });
  }
});

describe("the proactive route fetches strategy for the rows it sends (structure)", () => {
  it("the three suggestion selects of notifyUrgent and sendDigests bring `strategy`", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/routes/api/public/jobs/proactive.ts", "utf8").replace(/\s+/g, "");
    const selects = [...src.matchAll(/from\("suggestions"\)\.select\("([^"]+)"\)/g)].map(
      (m) => m[1]!,
    );
    expect(selects).toHaveLength(3);
    for (const s of selects) expect(s.split(","), s).toContain("strategy");
  });
});

// ---- NK-0042: the price filter goes in the query, before limit, in the two queries that can carry a price suggestion ----
describe("the proactive route hides price suggestions in the query (structure)", () => {
  it("the urgent query and the digest query apply the visibility filter before `.limit(`; the assigned one does not need it", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/routes/api/public/jobs/proactive.ts", "utf8").replace(/\s+/g, "");
    const queries = [
      ...src.matchAll(
        /(applyPriceVisibility\()?db\.from\("suggestions"\)\.select\("[^"]+"\)(.*?)\.limit\(\d+\)/g,
      ),
    ];
    expect(queries).toHaveLength(3);
    expect(queries.filter((q) => q[1]).length).toBe(2);
    for (const q of queries) {
      if (q[0]!.includes("account_assigned")) continue; // that query already filters by detector
      expect(q[0], q[0]).toMatch(/^applyPriceVisibility\(.*,canSee,?\)\.limit\(/);
    }
  });
  it('roles are read once per run with `.in("user_id"` and crossed by organisation and person, not through channelCtx', async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/routes/api/public/jobs/proactive.ts", "utf8");
    expect(src).toContain("loadMemberRoles(");
    expect(src).not.toContain("channelCtx");
  });
});
