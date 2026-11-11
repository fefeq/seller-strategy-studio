import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  APPROVALS,
  BLOCKERS,
  CATALOG,
  CHANNELS,
  MOTIONS,
  OUTPUTS,
  PHASES,
  STATUSES,
  detectorOwner,
} from "./catalog";

const DETECTORS_DIR = path.resolve(__dirname, "../proactive/detectors");
const detectorSource = readdirSync(DETECTORS_DIR)
  .filter((f) => f.endsWith(".ts"))
  .map((f) => readFileSync(path.join(DETECTORS_DIR, f), "utf8"))
  .join("\n");

describe("catalog (CA-1, G-1)", () => {
  it("holds exactly 28 plays with unique kebab-case ASCII ids", () => {
    expect(CATALOG).toHaveLength(28);
    const ids = CATALOG.map((p) => p.id);
    expect(new Set(ids).size).toBe(28);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("gives every play a Spanish title, a motion, a channel, a valid status, its needs and the SDD that builds it", () => {
    for (const p of CATALOG) {
      expect(p.title.trim().length, p.id).toBeGreaterThan(0);
      expect(p.motion.length, p.id).toBeGreaterThanOrEqual(1);
      expect(p.channels.length, p.id).toBeGreaterThanOrEqual(1);
      for (const m of p.motion) expect(MOTIONS, p.id).toContain(m);
      for (const c of p.channels) expect(CHANNELS, p.id).toContain(c);
      expect(STATUSES, p.id).toContain(p.status);
      expect(p.needs.length, p.id).toBeGreaterThanOrEqual(1);
      expect(Number.isInteger(p.sdd) && p.sdd >= 2 && p.sdd <= 9, p.id).toBe(true);
    }
  });

  it("never names Frontal in a title (the product UI does not)", () => {
    for (const p of CATALOG) expect(p.title.toLowerCase(), p.id).not.toContain("frontal");
  });
});

describe("detectors (CA-2, G-1)", () => {
  it('names only detectors that exist as a literal `detector: "<id>"` in src/lib/proactive/detectors', () => {
    for (const p of CATALOG) {
      for (const d of p.detectors) {
        expect(detectorSource.includes(`detector: "${d}"`), `${p.id} → ${d}`).toBe(true);
      }
    }
  });

  it("assigns each detector to a single play", () => {
    const all = CATALOG.flatMap((p) => p.detectors);
    expect(new Set(all).size).toBe(all.length);
    expect(detectorOwner("late_lead")).toBe("meeting-form-orchestration");
    expect(detectorOwner("stale_deal")).toBeUndefined();
  });

  it("keeps the initial split of the SDD and defaults to enabled only the plays that already run as rules", () => {
    const byId = Object.fromEntries(CATALOG.map((p) => [p.id, p]));
    expect(byId["meeting-prep-and-follow-up"]?.detectors).toEqual([
      "meeting_no_prep",
      "meeting_no_notes",
    ]);
    expect(byId["meeting-form-orchestration"]?.detectors).toEqual(["late_lead"]);
    expect(byId["signal-activation"]?.detectors).toEqual(["account_signal"]);
    expect(byId["crm-hygiene"]?.detectors).toEqual(["account_missing_key"]);
    expect(byId["plg-to-sales"]?.detectors).toEqual([
      "product_qualified",
      "usage_drop",
      "trial_conversion",
    ]);
    expect(byId["multi-thread-inbound-leads"]?.detectors).toEqual(["no_decision_maker"]);
    for (const p of CATALOG) expect(p.defaultEnabled, p.id).toBe(p.detectors.length > 0);
  });

  it("leaves the always-on rules out of every play", () => {
    const always = [
      "stale_deal",
      "past_close_date",
      "low_coverage",
      "meddpicc_gaps",
      "setup_incomplete",
      "registration_expiring",
      "unassigned_accounts",
      "followup_sequence",
      "onboarding_stalled",
    ];
    for (const d of always) expect(detectorOwner(d), d).toBeUndefined();
  });
});

describe("blocking (CA-3, G-1)", () => {
  it("makes every blocked play declare one known blocker and no other status declare it", () => {
    for (const p of CATALOG) {
      if (p.status === "bloqueado") expect(BLOCKERS, p.id).toContain(p.blockedBy);
      else expect(p.blockedBy, p.id).toBeUndefined();
    }
  });

  it("accepts only the four blockers of the SDD", () => {
    expect([...BLOCKERS].sort()).toEqual([
      "decision_gtm",
      "fuente_externa",
      "linkedin_d2",
      "proveedor_datos",
    ]);
  });
});

describe("honest status (CA-4, G-1)", () => {
  it("has no play marked active in this SDD, and an active one would need a detector or an output", () => {
    for (const p of CATALOG) expect(p.status, p.id).not.toBe("activo");
    for (const p of CATALOG.filter((x) => x.status === "activo"))
      expect(p.detectors.length + p.outputs.length, p.id).toBeGreaterThan(0);
  });

  it("states a play with a detector as partial, never planned or blocked", () => {
    for (const p of CATALOG.filter((x) => x.detectors.length > 0))
      expect(p.status, p.id).toBe("parcial");
  });
});

describe("outputs (CA-20, G-3)", () => {
  it("allows only suggestion, task and draft", () => {
    expect([...OUTPUTS].sort()).toEqual(["draft", "suggestion", "task"]);
    for (const p of CATALOG) {
      expect(p.outputs.length, p.id).toBeGreaterThanOrEqual(1);
      for (const o of p.outputs) expect(OUTPUTS, `${p.id} → ${o}`).toContain(o);
    }
  });

  it("rejects an automatic send at the type level and at run time", () => {
    // @ts-expect-error `send` is not a PlayOutput: the type is what stops a play from declaring it
    const bad: import("./catalog").PlayOutput = "send";
    expect(OUTPUTS as readonly string[]).not.toContain(bad);
    expect(CATALOG.some((p) => (p.outputs as readonly string[]).includes("send"))).toBe(false);
  });
});

// SDD-20261110-plays-phase-autonomy-deps U-1 (CA-1, CA-2, CA-5).
describe("phase and approval (CA-1, CA-2, G-1)", () => {
  it("names the four phases in order and the two approval levels", () => {
    expect([...PHASES]).toEqual(["fundacion", "captura", "generacion", "orquestacion"]);
    expect([...APPROVALS]).toEqual(["nokko_con_ayuda", "nokko_borrador"]);
  });

  it("gives all 28 plays a valid phase", () => {
    for (const p of CATALOG) expect(PHASES, p.id).toContain(p.phase);
  });

  it("gives all 28 plays a valid approval level", () => {
    for (const p of CATALOG) expect(APPROVALS, p.id).toContain(p.approval);
  });
});

describe("dependsOn (CA-5, G-1)", () => {
  const ids = new Set(CATALOG.map((p) => p.id));
  const byId = new Map(CATALOG.map((p) => [p.id, p]));
  const rank = (id: string) => PHASES.indexOf(byId.get(id)!.phase);

  it("is a list on every play and names only plays that exist, never itself", () => {
    for (const p of CATALOG) {
      expect(Array.isArray(p.dependsOn), p.id).toBe(true);
      for (const d of p.dependsOn) {
        expect(ids.has(d), `${p.id} → ${d}`).toBe(true);
        expect(d, p.id).not.toBe(p.id);
      }
    }
  });

  it("has no cycles", () => {
    const state = new Map<string, "visiting" | "done">();
    const visit = (id: string, trail: string[]) => {
      expect(state.get(id), `cycle: ${[...trail, id].join(" → ")}`).not.toBe("visiting");
      if (state.get(id) === "done") return;
      state.set(id, "visiting");
      for (const d of byId.get(id)!.dependsOn) visit(d, [...trail, id]);
      state.set(id, "done");
    };
    for (const p of CATALOG) visit(p.id, []);
  });

  it("puts each dependency in the same phase or an earlier one", () => {
    for (const p of CATALOG)
      for (const d of p.dependsOn)
        expect(rank(d), `${p.id} → ${d}`).toBeLessThanOrEqual(rank(p.id));
  });

  it("holds only the two dependencies the PRD backs (SDD section 13)", () => {
    const pairs = CATALOG.flatMap((p) => p.dependsOn.map((d) => `${p.id} → ${d}`)).sort();
    expect(pairs).toEqual([
      "pain-qualified-segments → call-transcript-signal-extraction",
      "signal-activation → signals-in-crm-with-decay",
    ]);
  });
});
