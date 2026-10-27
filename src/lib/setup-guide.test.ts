import { afterEach, describe, expect, it } from "vitest";
import { SETUP_ITEMS, type SetupData } from "@/lib/setup-schema";
import { getTool } from "@/lib/agent/tools";
import {
  COMPLETE_TEXT, INACTIVITY_MS, STEP_ROLES, STEP_WHY, canCompleteStep, guideState, latestActivity, nextFor, nextMessage, nudgeDue,
  dayAfter, formatDay, localDay, parseSnoozeDate, stepsFor, whoCan, whoCanText,
} from "@/lib/setup-guide";

const NOW = new Date("2026-10-26T10:00:00Z");
const TZ0 = process.env.TZ;
/** Runs fn with the process in a time zone (Node re-reads TZ on change). */
const inZone = <T,>(tz: string, fn: () => T): T => { process.env.TZ = tz; try { return fn(); } finally { if (TZ0 === undefined) delete process.env.TZ; else process.env.TZ = TZ0; } };
afterEach(() => { if (TZ0 === undefined) delete process.env.TZ; else process.env.TZ = TZ0; });
const fullPos = Object.fromEntries(["best_customers", "alternatives", "differentiation", "value", "trend", "target_customer", "need", "category", "key_benefit", "competitive_alternative", "differentiator", "one_liner", "elevator_pitch"].map((k) => [k, "texto"]));
const full: SetupData = {
  currency: "EUR",
  segments: [{ name: "Seg A", acv_min: 1, acv_max: 2, win_rate_target: 20, ae_quota: 100 }],
  icps: [{ industries: "a", company_size: "b", why_fit: "c", anti_icp: "d" }],
  positioning: fullPos,
  pillars: [1, 2, 3].map((n) => ({ title: `T${n}`, message: `M${n}` })),
  quotas: [{ period: "2026-Q4", amount: 100 }],
  accounts: 1, deals: 1, quarter: "2026-Q4",
};
const empty: SetupData = { currency: "EUR", segments: [], icps: [], positioning: null, pillars: [], quotas: [], accounts: 0, deals: 0, quarter: "2026-Q4" };
const IDS = ["positioning", "icp", "segments", "benchmarks", "pillars", "quota", "accounts", "deals"];

describe("setup guide: one fixed order (CA-3)", () => {
  it("the order is the wizard order, positioning to deals", () => expect(SETUP_ITEMS.map((i) => i.id)).toEqual(IDS));
  it("the next step is the first pending in that order, not the heaviest", () => {
    // quota weighs 15 and segments 10, but segments comes first in the order.
    const g = guideState({ ...full, segments: [], quotas: [] }, [], NOW);
    expect(g.next?.id).toBe("segments");
    expect(g.pending.map((s) => s.id)).toEqual(["segments", "benchmarks", "quota"]);
  });
  it("the same data gives the same next step whoever asks (screen and agent share the rule)", () => {
    expect(guideState(empty, [], NOW).next?.id).toBe("positioning");
    expect(guideState(empty, [], NOW)).toEqual(guideState(empty, [], NOW));
  });
  it("every step has a reason and a role rule", () => {
    for (const id of IDS) { expect(STEP_WHY[id]).toBeTruthy(); expect(STEP_ROLES[id]).toBeTruthy(); }
  });
});

describe("setup guide: next-step message (CA-1, CA-2)", () => {
  it("CA-1: after a step, names the next one with why it matters and a start button", () => {
    const g = guideState({ ...full, pillars: [], quotas: [] }, [], NOW);
    const m = nextMessage(g, "owner", "icp");
    // SDD §9: «Ya tienes tu ICP. Siguiente: …. Así Nokko sabrá …»
    expect(m.title).toBe("Ya tienes tu ICP. Siguiente: escribe tus tres pilares de mensaje.");
    expect(m.why).toBe(STEP_WHY["pillars"]);
    expect(m.start).toBe("Empezar");
    expect(m.later).toBe("Más tarde");
    expect(m.link).toBe("/strategy");
  });
  it("CA-1: acronyms keep their capitals in every sentence the guide writes (ICP, ACV, AE)", () => {
    const say = (g: ReturnType<typeof guideState>, role: string, done?: string) => { const m = nextMessage(g, role, done, [{ user_id: "u1", role: "owner", name: "Ana" }]); return `${m.title} ${m.why}`; };
    const texts = [
      say(guideState({ ...full, icps: [] }, [], NOW), "owner"),
      say(guideState({ ...full, segments: [{ name: "Seg A", acv_min: null, acv_max: null, win_rate_target: 20, ae_quota: 100 }] }, [], NOW), "owner"),
      say(guideState({ ...full, segments: [{ name: "Seg A", acv_min: 1, acv_max: 2, win_rate_target: null, ae_quota: null }] }, [], NOW), "owner"),
      say(guideState({ ...full, icps: [] }, [], NOW), "ae"), // not theirs: «Falta tu ICP. Lo puede completar …»
      say(guideState({ ...full, positioning: null }, [], NOW), "owner", "icp"),
    ];
    for (const t of texts) { expect(t).not.toMatch(/\b(icp|acv|ae)\b/); }
    expect(texts[0]).toContain("define tu ICP");
    expect(texts[1]).toContain("ACV");
    expect(texts[2]).toContain("AE");
    expect(texts[3]).toContain("Falta tu ICP.");
  });
  it("CA-2: with nothing pending, says what Nokko does alone and what is left for the person", () => {
    const m = nextMessage(guideState(full, [], NOW), "owner");
    expect(guideState(full, [], NOW).complete).toBe(true);
    expect(m.stepId).toBeNull();
    expect(m.why).toBe(COMPLETE_TEXT);
    expect(m.why).toContain("Nokko vigila");
    expect(m.why).toContain("A ti te toca");
    expect(m.start).toBeNull();
  });
  it("only snoozed steps left: no next step and says when it comes back", () => {
    const g = guideState({ ...full, deals: 0 }, [{ step_id: "deals", snoozed_until: "2026-11-03T11:00:00.000Z" }], NOW);
    expect(g.next).toBeNull();
    expect(g.complete).toBe(false);
    expect(inZone("Europe/Madrid", () => nextMessage(g, "owner").why)).toContain("3 de noviembre de 2026"); // CA-7: Spanish day, never ISO
    expect(nextMessage(g, "owner").why).not.toContain("2026-11-03");
  });
});

describe("setup guide: real state per step (CA-4, CA-5)", () => {
  it("CA-4: each step is Completado, Pendiente or Pospuesto from the single definition of complete", () => {
    const g = guideState({ ...full, icps: [], deals: 0 }, [{ step_id: "deals", snoozed_until: "2026-11-03T23:59:59.999Z" }], NOW);
    const by = Object.fromEntries(g.steps.map((s) => [s.id, s.state]));
    expect(by).toMatchObject({ positioning: "done", icp: "pending", deals: "snoozed", accounts: "done" });
    expect(g.pct).toBe(75);
  });
  it("CA-5: editing data so a step is no longer complete turns it back to Pendiente", () => {
    expect(guideState(full, [], NOW).steps.find((s) => s.id === "positioning")?.state).toBe("done");
    const edited = { ...full, positioning: { ...fullPos, elevator_pitch: "  " } };
    const g = guideState(edited, [], NOW);
    expect(g.steps.find((s) => s.id === "positioning")?.state).toBe("pending");
    expect(g.next?.id).toBe("positioning");
  });
  it("a quarter change turns the quota back to Pendiente (done is derived, never stored)", () => {
    expect(guideState({ ...full, quarter: "2027-Q1" }, [], NOW).next?.id).toBe("quota");
  });
});

describe("setup guide: snooze (CA-7)", () => {
  const snooze = [{ step_id: "positioning", snoozed_until: "2026-11-10T23:59:59.999Z" }];
  it("a snoozed step is skipped until its date and the next pending one is recommended", () => {
    const g = guideState(empty, snooze, NOW);
    expect(g.steps[0]?.state).toBe("snoozed");
    expect(g.steps[0]?.snoozedUntil).toBe("2026-11-10T23:59:59.999Z");
    expect(g.next?.id).toBe("icp");
  });
  it("after the date it is pending again and comes first", () => {
    expect(guideState(empty, snooze, new Date("2026-11-11T08:00:00Z")).next?.id).toBe("positioning");
  });
  it("a snooze on a step that is already done is ignored", () => {
    expect(guideState(full, [{ step_id: "deals", snoozed_until: "2026-12-01T23:59:59.999Z" }], NOW).steps.find((s) => s.id === "deals")?.state).toBe("done");
  });
  it("accepts only a real future day", () => {
    inZone("Europe/Madrid", () => {
      expect(parseSnoozeDate("2026-10-27", NOW)).toBe("2026-10-27T11:00:00.000Z");
      expect(parseSnoozeDate("2026-10-26", NOW)).toBeNull();
      expect(parseSnoozeDate("2026-10-01", NOW)).toBeNull();
      expect(parseSnoozeDate("2026-02-31", NOW)).toBeNull();
      expect(parseSnoozeDate("mañana", NOW)).toBeNull();
    });
  });
  it("CA-7: the day the person picks is the day saved and shown, in every zone, by the wizard, the panel and the agent", () => {
    for (const tz of ["Europe/Madrid", "America/Mexico_City", "America/Argentina/Buenos_Aires", "UTC"]) {
      const stored = inZone(tz, () => parseSnoozeDate("2026-11-03", NOW));
      expect(stored, tz).not.toBeNull();
      // read back where the person is (screens) and on a UTC server (agent): the same day, in Spanish
      expect(inZone(tz, () => formatDay(stored!)), tz).toBe("3 de noviembre de 2026");
      expect(inZone("UTC", () => formatDay(stored!)), tz).toBe("3 de noviembre de 2026");
      expect(inZone(tz, () => localDay(new Date(stored!))), tz).toBe("2026-11-03");
    }
  });
  it("CA-7: the picker's minimum is tomorrow in local time, not UTC (23:30 in Madrid is already the next day in UTC)", () => {
    const lateMadrid = new Date("2026-10-26T22:30:00Z"); // 23:30 CET on the 26th, 22:30 UTC the same day
    const earlyMadrid = new Date("2026-10-26T23:30:00Z"); // 00:30 CET on the 27th, still the 26th in UTC
    expect(inZone("Europe/Madrid", () => dayAfter(lateMadrid, 1))).toBe("2026-10-27");
    expect(inZone("Europe/Madrid", () => dayAfter(earlyMadrid, 1))).toBe("2026-10-28");
    expect(inZone("Europe/Madrid", () => parseSnoozeDate("2026-10-27", earlyMadrid))).toBeNull(); // today in local time
  });
});

describe("setup guide: inactivity nudge (CA-6)", () => {
  const g = guideState(empty, [], NOW);
  it("nudges when steps are pending and more than 1 day without activity", () => {
    expect(nudgeDue(g, "owner", new Date(NOW.getTime() - INACTIVITY_MS - 1).toISOString(), NOW)).toBe(true);
  });
  it("does not nudge within the day", () => {
    expect(nudgeDue(g, "owner", new Date(NOW.getTime() - 3_600_000).toISOString(), NOW)).toBe(false);
  });
  it("does not nudge when nothing is pending, when everything pending is snoozed or without activity data", () => {
    const old = "2026-10-01T00:00:00Z";
    expect(nudgeDue(guideState(full, [], NOW), "owner", old, NOW)).toBe(false);
    expect(nudgeDue(guideState({ ...full, deals: 0 }, [{ step_id: "deals", snoozed_until: "2026-11-03T23:59:59.999Z" }], NOW), "owner", old, NOW)).toBe(false);
    expect(nudgeDue(g, "owner", null, NOW)).toBe(false);
  });
  it("latestActivity ignores empties", () => {
    expect(latestActivity([null, "2026-10-01T00:00:00Z", undefined, "2026-10-20T00:00:00Z"])).toBe("2026-10-20T00:00:00Z");
    expect(latestActivity([null])).toBeNull();
  });
});

describe("setup guide: roles (CA-8)", () => {
  const members = [{ user_id: "u1", role: "owner", name: "Ana" }, { user_id: "u2", role: "ae", name: "Beto" }, { user_id: "u3", role: "sales_leader", name: "Cris" }];
  it("a role that can't complete a step is told who in the company can", () => {
    expect(canCompleteStep("quota", "ae")).toBe(false);
    expect(whoCan("quota", members).map((m) => m.name)).toEqual(["Ana", "Cris"]);
    expect(whoCanText("quota", members)).toBe("Lo puede completar Ana, Cris.");
  });
  it("without names it says which roles", () => expect(whoCanText("quota", [])).toContain("GTM Owner / RevOps o Sales Leader"));
  it("the next step for a role is the first pending one it can complete", () => {
    const g = guideState(empty, [], NOW);
    expect(nextFor(g, "ae")?.id).toBe("accounts");
    expect(nextFor(g, "marketing")?.id).toBe("positioning");
    expect(nextMessage(g, "ae").stepId).toBe("accounts");
  });
  it("an invited role sees the steps it can do and the pending ones it can't, never done ones of others", () => {
    const g = guideState({ ...full, deals: 0, quotas: [] }, [], NOW);
    expect(stepsFor(g, "ae").map((s) => s.id)).toEqual(["quota", "accounts", "deals"]);
  });
  it("when what is left isn't theirs, the message says so and who can", () => {
    const g = guideState({ ...full, quotas: [] }, [], NOW);
    const m = nextMessage(g, "ae", null, members);
    expect(m.stepId).toBeNull();
    expect(m.why).toContain("Lo puede completar Ana, Cris.");
  });
  it("the role table matches the agent tools that write each step", () => {
    const tool: Record<string, string> = { positioning: "update_positioning", icp: "create_icp", segments: "upsert_segment", benchmarks: "upsert_segment", pillars: "create_pillar", quota: "set_quota", accounts: "create_account", deals: "create_deal" };
    for (const id of IDS) {
      const t = getTool(tool[id]!);
      expect(t, id).toBeTruthy();
      const want = STEP_ROLES[id];
      if (want === "all") expect(t!.roles ?? null, id).toBeNull();
      else expect([...(t!.roles as string[])].sort(), id).toEqual([...(want as string[])].sort());
    }
  });
});
