import { describe, expect, it } from "vitest";
import { BASE_PLAYS } from "./playbooks/base";
import { acceptableAdaptation, adaptPrompt, missingPlays } from "./playbooks/adapt";

describe("base library", () => {
  it("has the five plays, in Nokko's voice", () => {
    expect(BASE_PLAYS.map((p) => p.id)).toEqual([
      "discovery",
      "objections",
      "demo",
      "negotiation",
      "proposal",
    ]);
    for (const p of BASE_PLAYS) {
      expect(p.body).not.toMatch(/!/);
      expect(p.body).not.toMatch(/usted/i);
      expect(p.body.length).toBeGreaterThan(800);
      expect(p.body).toMatch(/«.+»/); // markers for the adaptation
    }
  });
  it("knows which plays a company still lacks, by title", () => {
    expect(missingPlays([]).length).toBe(5);
    expect(
      missingPlays([{ title: "demo: tres minutos sobre su problema", section: "playbooks" }]).map(
        (p) => p.id,
      ),
    ).toEqual(["discovery", "objections", "negotiation", "proposal"]);
  });
  it("builds the adaptation prompt with the base and the context", () => {
    const p = JSON.parse(adaptPrompt(BASE_PLAYS[0], { producto: "X" }));
    expect(p.playbook).toBe("Discovery: qué preguntar y en qué orden");
    expect(p.contexto_empresa).toEqual({ producto: "X" });
    expect(p.base).toContain("1. Contexto");
  });
  it("rejects adaptations that lost the structure or kept markers", () => {
    const play = BASE_PLAYS[0];
    const good = play.body.replace(/«[^»]*»/g, "la gestión de leads");
    expect(acceptableAdaptation(play, good)).toBe(true);
    expect(
      acceptableAdaptation(
        play,
        good.replace("1. Contexto", "Intro").replace("2. Dolor", "Pain").replace("3. Impacto", "x"),
      ),
    ).toBe(false);
    expect(acceptableAdaptation(play, play.body)).toBe(false);
    expect(acceptableAdaptation(play, "corto")).toBe(false);
  });
});
