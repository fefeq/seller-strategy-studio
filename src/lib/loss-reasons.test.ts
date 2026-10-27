// SDD-20261027 strategic-suggestions-engine, F0 · H-2 (motivo de pérdida y competidor). Fictional data only.
import { describe, expect, it } from "vitest";
import {
  competitorFromMeddpicc,
  LOSS_REASONS,
  lossBreakdown,
  lossLabel,
  needsLossPrompt,
  parseLoss,
} from "./loss-reasons";

describe("CA-8: al marcar un deal como perdido se pide motivo (lista fija + texto libre) y, opcional, competidor", () => {
  it("the fixed list is the eight reasons Fede proposed, in that order, with Spanish labels", () => {
    expect(LOSS_REASONS.map((r) => r.label)).toEqual([
      "Precio",
      "Competidor",
      "Sin decisión",
      "Sin presupuesto",
      "Sin encaje con el producto",
      "Mal momento",
      "Cambio de contacto",
      "Otro",
    ]);
    expect(new Set(LOSS_REASONS.map((r) => r.key)).size).toBe(8);
    expect(lossLabel("no_budget")).toBe("Sin presupuesto");
    expect(lossLabel(null)).toBe("Sin dato");
  });

  it("the prompt appears only when a deal moves INTO lost, not when it is already lost or moves elsewhere", () => {
    expect(needsLossPrompt("lost", "negotiation")).toBe(true);
    expect(needsLossPrompt("lost", "lost")).toBe(false);
    expect(needsLossPrompt("won", "negotiation")).toBe(false);
    expect(needsLossPrompt("demo", "lost")).toBe(false);
  });

  it("parseLoss keeps a valid reason, free text and competitor, trimmed", () => {
    expect(
      parseLoss({
        reason: "other",
        detail: "  Se fusionaron con otra empresa  ",
        competitor: "  Acme Rival ",
      }),
    ).toEqual({
      ok: true,
      patch: {
        lost_reason: "other",
        lost_reason_detail: "Se fusionaron con otra empresa",
        lost_competitor: "Acme Rival",
      },
    });
  });

  it("parseLoss rejects a reason outside the list and texts that are too long, with a message that says what to do", () => {
    const bad = parseLoss({ reason: "caro" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toMatch(/Elige uno de la lista/);
    const long = parseLoss({ reason: "price", detail: "x".repeat(501) });
    expect(long.ok).toBe(false);
  });

  it("the competitor can be proposed from the MEDDPICC «Competition» note, as text the person edits", () => {
    expect(competitorFromMeddpicc({ competition: { score: 2, note: "  Rival Uno  " } })).toBe(
      "Rival Uno",
    );
    expect(competitorFromMeddpicc({ competition: "Rival Dos" })).toBe("Rival Dos");
    expect(competitorFromMeddpicc({ competition: { score: 1, note: "" } })).toBeNull();
    expect(competitorFromMeddpicc(null)).toBeNull();
    // a long paragraph is a note, not a name: no proposal
    expect(competitorFromMeddpicc({ competition: { note: "x".repeat(81) } })).toBeNull();
  });
});

describe("CA-9: motivo y competidor se pueden completar en deals ya perdidos, sin obligar", () => {
  it("an empty form is valid and clears nothing it was not asked to: it patches only to nulls", () => {
    expect(parseLoss({})).toEqual({
      ok: true,
      patch: { lost_reason: null, lost_reason_detail: null, lost_competitor: null },
    });
  });
  it("a reason alone, or a competitor alone, is valid", () => {
    expect(parseLoss({ reason: "price" })).toEqual({
      ok: true,
      patch: { lost_reason: "price", lost_reason_detail: null, lost_competitor: null },
    });
    expect(parseLoss({ competitor: "Rival" })).toEqual({
      ok: true,
      patch: { lost_reason: null, lost_reason_detail: null, lost_competitor: "Rival" },
    });
  });
});

describe("CA-10: sin motivo, el deal cuenta como «sin dato» en el análisis", () => {
  const deals = [
    { stage: "lost", lost_reason: "price", lost_competitor: "Rival Uno" },
    { stage: "lost", lost_reason: "price", lost_competitor: " rival uno " },
    { stage: "lost", lost_reason: null, lost_competitor: null },
    { stage: "lost", lost_reason: "no_decision", lost_competitor: null },
    { stage: "won", lost_reason: null, lost_competitor: null },
    { stage: "demo", lost_reason: "price", lost_competitor: "Otro" },
  ];
  it("counts only lost deals, groups by reason and by competitor (case and spaces ignored) and counts the rest as sin dato", () => {
    const b = lossBreakdown(deals);
    expect(b.total).toBe(4);
    expect(b.noReason).toBe(1);
    expect(b.byReason).toEqual({ price: 2, no_decision: 1 });
    expect(b.noCompetitor).toBe(2);
    expect(b.byCompetitor).toEqual([{ name: "Rival Uno", count: 2 }]);
  });
  it("with no lost deals everything is zero, never an invented figure", () => {
    expect(lossBreakdown([])).toEqual({
      total: 0,
      noReason: 0,
      byReason: {},
      noCompetitor: 0,
      byCompetitor: [],
    });
  });
});
