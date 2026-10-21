import { describe, expect, it } from "vitest";
import { linkTarget, resolvePlan, RESOLVE_RULES, setupStepLink, SETUP_STEP_LINK } from "./proactive/resolve";
import { SETUP_ITEMS } from "@/lib/setup-schema";

const base = { title: "Algo pasa", body: "Detalle del problema", link: null as string | null };

describe("linkTarget", () => {
  it("splits path and search", () => {
    expect(linkTarget("/deals?deal=abc")).toEqual({ to: "/deals", search: { deal: "abc" } });
    expect(linkTarget("/accounts/1")).toEqual({ to: "/accounts/1", search: {} });
    expect(linkTarget(null)).toBeNull();
  });
});

describe("resolvePlan", () => {
  it("MEDDPICC: opens the deal itself when there is no account page", () => {
    const p = resolvePlan({ ...base, detector: "meddpicc_gaps", dedupe_key: "meddpicc_gaps:d1:proposal", link: "/deals" });
    expect(p.to).toBe("/deals?deal=d1");
    expect(p.prompt).toContain("MEDDPICC");
  });

  it("MEDDPICC: keeps the account page when the deal has one", () => {
    expect(resolvePlan({ ...base, detector: "meddpicc_gaps", dedupe_key: "meddpicc_gaps:d1:proposal", link: "/accounts/a1" }).to).toBe("/accounts/a1");
  });

  it("setup: goes to the exact step, even for old stored links", () => {
    expect(resolvePlan({ ...base, detector: "setup_incomplete", dedupe_key: "setup_incomplete:icp", link: "/setup" }).to).toBe("/strategy?tab=icp");
    expect(resolvePlan({ ...base, detector: "setup_incomplete", dedupe_key: "setup_incomplete:quota", link: "/setup" }).to).toBe("/metrics");
  });

  it("every setup step has a destination", () => {
    for (const i of SETUP_ITEMS) expect(SETUP_STEP_LINK[i.id] ?? setupStepLink(i.id)).toBeTruthy();
    expect(setupStepLink("unknown")).toBe("/setup");
  });

  it("decision maker: asks for questions and a draft, never invented names", () => {
    const p = resolvePlan({ ...base, detector: "no_decision_maker", dedupe_key: "no_decision_maker:a1", link: "/accounts/a1" });
    expect(p.to).toBe("/accounts/a1");
    expect(p.prompt).toMatch(/No inventes nombres/);
  });

  it("weekly report: asks for this week's actions", () => {
    const p = resolvePlan({ ...base, detector: "weekly_report", dedupe_key: "weekly:2026-10-19", link: "/deals" });
    expect(p.to).toBe("/deals");
    expect(p.prompt).toMatch(/acciones más importantes/);
  });

  it("all known types and unknown ones carry the title, the detail and the rules", () => {
    for (const detector of ["meddpicc_gaps", "no_decision_maker", "low_coverage", "trial_conversion", "registration_expiring", "setup_incomplete", "weekly_report", "something_new"]) {
      const p = resolvePlan({ ...base, detector, dedupe_key: `${detector}:x` });
      expect(p.prompt).toContain("«Algo pasa»");
      expect(p.prompt).toContain("Detalle del problema");
      expect(p.prompt).toContain(RESOLVE_RULES);
    }
  });

  it("keeps the prompt under the agent limit with a long report", () => {
    const p = resolvePlan({ ...base, detector: "weekly_report", dedupe_key: "w", body: "x".repeat(10_000) });
    expect(p.prompt.length).toBeLessThan(4000);
  });
});
