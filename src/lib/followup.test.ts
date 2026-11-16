import { describe, expect, it } from "vitest";
import { FOLLOWUP_STEPS, followupDraft, followupPatch, followupStatus } from "./followup";

const now = new Date("2026-10-20T12:00:00Z");
const ago = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();
const lead = (o: Partial<Parameters<typeof followupStatus>[0]> = {}) => ({
  stage: "contacted",
  contacted_at: ago(0),
  next_step_at: null,
  contact_name: "Marta López",
  company: "Acme",
  ...o,
});

describe("which touch is due", () => {
  it("day 3, 7 and 14 after the first contact, and nothing before", () => {
    expect(followupStatus(lead({ contacted_at: ago(2) }), now).due).toBeNull();
    expect(followupStatus(lead({ contacted_at: ago(3) }), now).due?.id).toBe("nudge");
    expect(followupStatus(lead({ contacted_at: ago(9) }), now).due?.id).toBe("value");
    expect(followupStatus(lead({ contacted_at: ago(14) }), now).due?.id).toBe("breakup");
  });
  it("knows the next step and its date", () => {
    const s = followupStatus(lead({ contacted_at: ago(4) }), now);
    expect(s.next).toEqual({ step: FOLLOWUP_STEPS[1], date: "2026-10-23" });
    expect(followupStatus(lead({ contacted_at: ago(15) }), now).next).toBeNull();
  });
  it("stops when the lead advanced, was never contacted, or the sequence is over", () => {
    expect(followupStatus(lead({ stage: "mql", contacted_at: ago(5) }), now).reason).toBe(
      "advanced",
    );
    expect(followupStatus(lead({ stage: "new", contacted_at: null }), now).reason).toBe(
      "not_contacted",
    );
    expect(followupStatus(lead({ contacted_at: ago(21) }), now)).toMatchObject({
      due: null,
      reason: "ended",
    });
  });
  it("a follow-up scheduled in the future pauses the sequence", () => {
    const s = followupStatus(lead({ contacted_at: ago(8), next_step_at: "2026-10-25" }), now);
    expect(s.due).toBeNull();
    expect(s.reason).toBe("scheduled");
    expect(
      followupStatus(lead({ contacted_at: ago(8), next_step_at: "2026-10-19" }), now).due?.id,
    ).toBe("value");
  });
});

describe("drafts", () => {
  const ctx = {
    positioning: { key_benefit: "Cerrar el mes sin perseguir a nadie." },
    pillars: [{ title: "a", message: "el CRM se actualiza con evidencia, no con recordatorios" }],
  };
  it("use the first name, the positioning and a pillar; tú, no exclamation marks", () => {
    const d3 = followupDraft(FOLLOWUP_STEPS[0], lead(), ctx);
    expect(d3).toBe(
      "Hola, Marta. Te escribí hace unos días sobre cerrar el mes sin perseguir a nadie. ¿Tiene sentido verlo esta semana o prefieres que lo deje para más adelante?",
    );
    const d7 = followupDraft(FOLLOWUP_STEPS[1], lead(), ctx);
    expect(d7).toContain(
      "Una idea concreta para Acme: el CRM se actualiza con evidencia, no con recordatorios.",
    );
    const d14 = followupDraft(FOLLOWUP_STEPS[2], lead(), ctx);
    expect(d14).toContain("No quiero insistir.");
    for (const d of [d3, d7, d14]) {
      expect(d).not.toMatch(/!/);
      expect(d.split(/\s+/).length).toBeLessThan(45);
    }
  });
  it("works without a name or any setup", () => {
    expect(followupDraft(FOLLOWUP_STEPS[0], lead({ contact_name: null }))).toMatch(
      /^Hola\. Te escribí hace unos días\. /,
    );
    expect(followupDraft(FOLLOWUP_STEPS[1], lead({ contact_name: null }))).toContain(
      "resolver lo que hablamos",
    );
  });
});

describe("what approving a step records", () => {
  it("logs the touch and schedules the next one from the first contact", () => {
    expect(followupPatch(FOLLOWUP_STEPS[0], ago(4), now)).toEqual({
      next_step: "Seguimiento día 3 enviado; toca el día 7",
      next_step_at: "2026-10-23",
    });
    expect(followupPatch(FOLLOWUP_STEPS[2], ago(14), now)).toEqual({
      next_step: "Seguimiento día 14 enviado; si no responde, descartar",
      next_step_at: "2026-10-27",
    });
  });
});
