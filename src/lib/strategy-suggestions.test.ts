// SDD-20261027 strategic-suggestions-engine, F0 · H-1 (sugerencia estratégica con evidencia y decisión). Fictional data only.
import { describe, expect, it } from "vitest";
import {
  buildStrategySuggestion, decisionRecord, evidenceFingerprint, evidenceLevel, EVIDENCE_LEVEL_RULE, isVisible, levelLabel, MAX_OPEN_STRATEGY,
  limitStrategy, openStrategy, parseStrategy, reconcile, sampleLabel, STRATEGY_STATUS_LABEL, type StrategyRow,
} from "./strategy-suggestions";

const ev = (n: number) => Array.from({ length: n }, (_, i) => ({ table: "deals", id: `d${i + 1}`, label: `Deal ${i + 1}` }));
const base = { element: "icp" as const, kind: "create" as const, action_type: "strategy_change" as const, cause: "won_sector", priority: 2 as const, title: "Crea un ICP", body: "Tus ventas se concentran en un sector que ningún ICP incluye." };

describe("CA-1: cada sugerencia guarda elemento, tipo, evidencia con enlace, nivel, acción, prioridad y estado", () => {
  it("builds the stored shape: detector strategy_*, dedupe key by element and cause, meta with every field, no owner", () => {
    const s = buildStrategySuggestion({ ...base, evidence: ev(6) });
    expect(s.detector).toBe("strategy_icp");
    expect(s.dedupe_key).toBe("strategy_icp:won_sector");
    expect(s.user_id).toBeNull();
    expect(s.priority).toBe(2);
    expect(s.strategy).toMatchObject({ element: "icp", kind: "create", action_type: "strategy_change", evidence_level: "medium", sample_size: 6 });
    expect(s.strategy.evidence).toHaveLength(6);
    expect(s.strategy.evidence[0]).toEqual({ table: "deals", id: "d1", label: "Deal 1", link: "/deals?deal=d1" });
    expect(s.strategy.fingerprint).toBe(evidenceFingerprint(ev(6)));
  });
  it("every evidence item carries a link to its source record; a source with no known link must bring its own", () => {
    expect(() => buildStrategySuggestion({ ...base, evidence: [{ table: "mystery", id: "x", label: "?" }] })).toThrow(/enlace/i);
    const s = buildStrategySuggestion({ ...base, evidence: [{ table: "mystery", id: "x", label: "?", link: "/strategy?tab=icp" }] });
    expect(s.strategy.evidence[0]!.link).toBe("/strategy?tab=icp");
  });
  it("parseStrategy accepts what the builder writes and refuses anything incomplete", () => {
    const s = buildStrategySuggestion({ ...base, evidence: ev(3) });
    expect(parseStrategy(s.strategy)).toEqual(s.strategy);
    expect(parseStrategy({ ...s.strategy, element: "nope" })).toBeNull();
    expect(parseStrategy({ ...s.strategy, evidence: [{ table: "deals", id: "d1", label: "x" }] })).toBeNull();
    expect(parseStrategy(null)).toBeNull();
  });
  it("the six states have a Spanish word", () => {
    expect(STRATEGY_STATUS_LABEL).toMatchObject({ pending: "Nueva", approved: "Aceptada", snoozed: "Pospuesta", dismissed: "Descartada", resolved: "Resuelta" });
  });
});

describe("CA-2: sin ningún registro de la empresa como evidencia, solo se muestra como «falta dato»", () => {
  it("empty evidence turns any kind and action into missing_data / data_to_complete, never a recommendation", () => {
    const s = buildStrategySuggestion({ ...base, evidence: [] });
    expect(s.strategy.kind).toBe("missing_data");
    expect(s.strategy.action_type).toBe("data_to_complete");
    expect(s.strategy.sample_size).toBe(0);
    expect(s.strategy.evidence_level).toBe("low");
  });
  it("a row with no evidence that claims to be a recommendation does not parse", () => {
    const s = buildStrategySuggestion({ ...base, evidence: [] });
    expect(parseStrategy({ ...s.strategy, kind: "create" })).toBeNull();
    expect(parseStrategy({ ...s.strategy, action_type: "experiment" })).toBeNull();
  });
});

describe("CA-3: nivel de evidencia con regla fija y visible, y tamaño de la muestra", () => {
  it("low under 5 records, medium from 5 to 9, high from 10", () => {
    expect([0, 1, 4].map(evidenceLevel)).toEqual(["low", "low", "low"]);
    expect([5, 7, 9].map(evidenceLevel)).toEqual(["medium", "medium", "medium"]);
    expect([10, 11, 40].map(evidenceLevel)).toEqual(["high", "high", "high"]);
  });
  it("the level is always derived from the sample; a stored level that disagrees does not parse", () => {
    const s = buildStrategySuggestion({ ...base, evidence: ev(10) });
    expect(s.strategy.evidence_level).toBe("high");
    expect(parseStrategy({ ...s.strategy, evidence_level: "low" })).toBeNull();
  });
  it("a sample larger than the listed evidence is kept (the list may show the first records only), a smaller one is rejected", () => {
    const s = buildStrategySuggestion({ ...base, evidence: ev(3), sample_size: 12 });
    expect(s.strategy.sample_size).toBe(12);
    expect(s.strategy.evidence_level).toBe("high");
    expect(() => buildStrategySuggestion({ ...base, evidence: ev(3), sample_size: 2 })).toThrow();
  });
  it("shows the level as a word, the rule in words and the sample size", () => {
    expect([levelLabel("low"), levelLabel("medium"), levelLabel("high")]).toEqual(["Baja", "Media", "Alta"]);
    expect(EVIDENCE_LEVEL_RULE).toBe("Baja: menos de 5 registros de origen. Media: de 5 a 9. Alta: 10 o más.");
    expect(sampleLabel(0)).toBe("Sin registros de origen");
    expect(sampleLabel(1)).toBe("Muestra: 1 registro");
    expect(sampleLabel(8)).toBe("Muestra: 8 registros");
  });
});

describe("CA-4: decidir registra fecha, autor y motivo opcional", () => {
  const now = new Date("2026-10-27T10:00:00Z");
  const s = buildStrategySuggestion({ ...base, evidence: ev(5) });
  it("accept, postpone and dismiss each produce the record and the new status", () => {
    const a = decisionRecord({ decision: "accept", by: "u1", now, fingerprint: s.strategy.fingerprint });
    expect(a).toMatchObject({ decision: "accepted", status: "approved", decided_by: "u1", decided_at: "2026-10-27T10:00:00.000Z", reason: null, remind_at: null });
    const p = decisionRecord({ decision: "postpone", by: "u1", now, fingerprint: s.strategy.fingerprint, reason: "  Tras la reunión del jueves " });
    expect(p).toMatchObject({ decision: "postponed", status: "snoozed", reason: "Tras la reunión del jueves", remind_at: "2026-10-30T10:00:00.000Z" });
    const d = decisionRecord({ decision: "dismiss", by: "u2", now, fingerprint: s.strategy.fingerprint, reason: "No aplica" });
    expect(d).toMatchObject({ decision: "dismissed", status: "dismissed", decided_by: "u2", reason: "No aplica" });
  });
  it("a custom reminder date is respected; an empty or too long reason is stored as nothing or rejected", () => {
    const p = decisionRecord({ decision: "postpone", by: "u1", now, fingerprint: "f", remindAt: new Date("2026-11-15T08:00:00Z") });
    expect(p.remind_at).toBe("2026-11-15T08:00:00.000Z");
    expect(decisionRecord({ decision: "accept", by: "u1", now, fingerprint: "f", reason: "   " }).reason).toBeNull();
    expect(() => decisionRecord({ decision: "accept", by: "u1", now, fingerprint: "f", reason: "x".repeat(501) })).toThrow(/500/);
  });
  it("the record keeps the fingerprint of the evidence at the moment of the decision (needed by CA-5 and CA-6)", () => {
    expect(decisionRecord({ decision: "dismiss", by: "u1", now, fingerprint: "abc" }).evidence_fingerprint).toBe("abc");
  });
});

const row = (over: Partial<StrategyRow> = {}): StrategyRow => ({
  id: "s1", dedupe_key: "strategy_icp:won_sector", status: "pending", priority: 2, created_at: "2026-10-01T00:00:00Z", snoozed_until: null,
  strategy: buildStrategySuggestion({ ...base, evidence: ev(5) }).strategy, decided_fingerprint: null, ...over,
});

describe("CA-5: descartada sin evidencia nueva, no vuelve a mostrarse", () => {
  const now = new Date("2026-10-27T10:00:00Z");
  const fp = row().strategy.fingerprint;
  it("a dismissed suggestion stays hidden while the detector keeps finding the same evidence", () => {
    const existing = row({ status: "dismissed", decided_fingerprint: fp });
    const found = buildStrategySuggestion({ ...base, evidence: ev(5) });
    expect(reconcile(existing, found, now)).toEqual({ action: "keep" });
    expect(isVisible(existing, now)).toBe(false);
  });
  it("it comes back as new when the evidence changed since the dismissal (a new deal, a different record)", () => {
    const existing = row({ status: "dismissed", decided_fingerprint: fp });
    const found = buildStrategySuggestion({ ...base, evidence: ev(6) });
    const r = reconcile(existing, found, now);
    expect(r).toMatchObject({ action: "reopen", patch: { status: "pending", snoozed_until: null } });
    expect((r as { patch: { strategy: unknown } }).patch.strategy).toEqual(found.strategy);
  });
  it("it stays hidden when records only drop out of the evidence (nothing new)", () => {
    const existing = row({ status: "dismissed", decided_fingerprint: fp });
    expect(reconcile(existing, buildStrategySuggestion({ ...base, evidence: ev(5).slice(0, 4), sample_size: 5 }), now)).toEqual({ action: "keep" });
    const snoozed = row({ status: "snoozed", snoozed_until: "2026-10-30T10:00:00Z", decided_fingerprint: fp });
    expect(reconcile(snoozed, buildStrategySuggestion({ ...base, evidence: ev(5).slice(1), sample_size: 5 }), now)).toEqual({ action: "keep" });
  });
  it("a brand new key is inserted; an open one with new evidence only refreshes its evidence", () => {
    const found = buildStrategySuggestion({ ...base, evidence: ev(6) });
    expect(reconcile(null, found, now)).toEqual({ action: "insert" });
    expect(reconcile(row(), found, now)).toMatchObject({ action: "refresh", patch: { strategy: found.strategy } });
    expect(reconcile(row(), buildStrategySuggestion({ ...base, evidence: ev(5) }), now)).toEqual({ action: "keep" });
  });
  it("an accepted suggestion is never reopened or rewritten by a detector", () => {
    const existing = row({ status: "approved", decided_fingerprint: fp });
    expect(reconcile(existing, buildStrategySuggestion({ ...base, evidence: ev(8) }), now)).toEqual({ action: "keep" });
  });
});

describe("CA-6: pospuesta, oculta hasta su fecha o hasta que cambie su evidencia", () => {
  const fp = row().strategy.fingerprint;
  it("is hidden before the reminder date and visible from it", () => {
    const snoozed = row({ status: "snoozed", snoozed_until: "2026-10-30T10:00:00Z", decided_fingerprint: fp });
    expect(isVisible(snoozed, new Date("2026-10-29T10:00:00Z"))).toBe(false);
    expect(isVisible(snoozed, new Date("2026-10-30T10:00:00Z"))).toBe(true);
  });
  it("the detector re-finding the same evidence keeps it asleep; changed evidence wakes it up", () => {
    const now = new Date("2026-10-28T10:00:00Z");
    const snoozed = row({ status: "snoozed", snoozed_until: "2026-10-30T10:00:00Z", decided_fingerprint: fp });
    expect(reconcile(snoozed, buildStrategySuggestion({ ...base, evidence: ev(5) }), now)).toEqual({ action: "keep" });
    expect(reconcile(snoozed, buildStrategySuggestion({ ...base, evidence: ev(7) }), now)).toMatchObject({ action: "reopen", patch: { status: "pending", snoozed_until: null } });
  });
  it("fingerprint ignores order and repeats, and changes when a record is added or swapped", () => {
    const a = ev(3);
    expect(evidenceFingerprint([...a].reverse())).toBe(evidenceFingerprint(a));
    expect(evidenceFingerprint([...a, a[0]!])).toBe(evidenceFingerprint(a));
    expect(evidenceFingerprint(ev(4))).not.toBe(evidenceFingerprint(a));
    expect(evidenceFingerprint([{ table: "accounts", id: "d1", label: "x" }])).not.toBe(evidenceFingerprint([{ table: "deals", id: "d1", label: "x" }]));
  });
});

describe("CA-7: como máximo 7 sugerencias estratégicas abiertas por empresa, por prioridad", () => {
  const now = new Date("2026-10-27T10:00:00Z");
  const many = Array.from({ length: 10 }, (_, i) => row({ id: `s${i}`, priority: ((i % 3) + 1) as 1 | 2 | 3, created_at: `2026-10-${String(10 + i).padStart(2, "0")}T00:00:00Z` }));
  it("caps at 7, most urgent first, newest first inside a priority", () => {
    const open = openStrategy(many, now);
    expect(MAX_OPEN_STRATEGY).toBe(7);
    expect(open).toHaveLength(7);
    expect(open.map((r) => r.priority)).toEqual([...open.map((r) => r.priority)].sort());
    const p1 = open.filter((r) => r.priority === 1);
    expect(p1.map((r) => r.id)).toEqual(["s9", "s6", "s3", "s0"]);
  });
  it("hidden (snoozed, dismissed, resolved, accepted) rows do not take a slot", () => {
    const rows = [...many.slice(0, 7), row({ id: "z1", status: "dismissed" }), row({ id: "z2", status: "snoozed", snoozed_until: "2026-12-01T00:00:00Z" }), row({ id: "z3", status: "resolved" })];
    expect(openStrategy(rows, now)).toHaveLength(7);
    expect(openStrategy(rows, now).some((r) => r.id.startsWith("z"))).toBe(false);
  });
  it("a missing-data suggestion competes for the same 7 slots", () => {
    const md = row({ id: "md", priority: 1, strategy: buildStrategySuggestion({ ...base, evidence: [] }).strategy });
    expect(openStrategy([...many, md], now)).toHaveLength(7);
  });
});

describe("CA-7 on the mixed list the screen reads", () => {
  const now = new Date("2026-10-27T10:00:00Z");
  const meta = buildStrategySuggestion({ ...base, evidence: ev(5) }).strategy;
  it("keeps every operational suggestion and only the 7 most urgent strategic ones", () => {
    const op = Array.from({ length: 3 }, (_, i) => ({ id: `o${i}`, strategy: null, priority: 2, created_at: "2026-10-20T00:00:00Z" }));
    const st = Array.from({ length: 9 }, (_, i) => ({ id: `s${i}`, strategy: meta, priority: i < 2 ? 1 : 3, created_at: `2026-10-${String(10 + i).padStart(2, "0")}T00:00:00Z` }));
    const out = limitStrategy([...op, ...st], now);
    expect(out.filter((r) => r.id.startsWith("o"))).toHaveLength(3);
    const kept = out.filter((r) => r.id.startsWith("s"));
    expect(kept).toHaveLength(7);
    expect(kept.some((r) => r.id === "s0") && kept.some((r) => r.id === "s1")).toBe(true);
  });
});
