import { describe, expect, it } from "vitest";
import {
  DEFAULT_QUAL_SETTINGS,
  buildQualificationRequest,
  parseQualification,
  qualificationView,
  readQualSettings,
  type QualContext,
  type Qualification,
} from "./lead-qualification";

const segments = [
  { id: "s1", name: "SMB", acv_min: 0, acv_max: 15000, notes: null },
  { id: "s2", name: "Mid-market", acv_min: 15000, acv_max: 80000, notes: null },
];
const ctx: QualContext = {
  lead: {
    company: "Acme",
    contact_name: "Ana",
    email: "ana@acme.com",
    title: "VP Sales",
    source: "Demo",
    notes: "Queremos una demo",
    amount: null,
    segment_id: null,
  },
  account: null,
  icps: [
    {
      name: "SaaS",
      segment_id: "s2",
      industries: "SaaS",
      company_size: "80-500",
      geography: null,
      anti_icp: "Agencias",
      why_fit: null,
    },
  ],
  segments,
  positioning: null,
};
const s = (score: number, levels = 4, confidence = 0.9) => ({ score, levels, confidence });
const q = (o: Partial<Qualification> = {}): Qualification => ({
  v: 1,
  at: "2026-10-24T00:00:00Z",
  fit: s(3),
  intent: s(3),
  authority: s(3),
  enough_info: 0.9,
  not_buyer: 0.05,
  anti_icp: 0.05,
  segment: null,
  ...o,
});

describe("request", () => {
  it("asks authority only with a job title and the segment only for a lead without one", () => {
    expect(Object.keys(buildQualificationRequest(ctx).questions).sort()).toEqual([
      "anti_icp",
      "authority",
      "enough_info",
      "fit",
      "intent",
      "not_buyer",
      "segment",
    ]);
    const r = buildQualificationRequest({
      ...ctx,
      lead: { ...ctx.lead, title: null, segment_id: "s1" },
      icps: [],
    });
    expect(Object.keys(r.questions).sort()).toEqual(["enough_info", "intent", "not_buyer"]);
  });
  it("maps Jev's segment option back to the segment id and refuses missing answers", () => {
    const req = buildQualificationRequest(ctx);
    const answers = {
      enough_info: { noul: 0.9 },
      not_buyer: { noul: 0.1 },
      anti_icp: { noul: 0.1 },
      intent: { score: 3, confidence: 1 },
      fit: { score: 2, confidence: 0.8 },
      authority: { score: 2.5, confidence: 0.6 },
      segment: { choice: "segmento_2", confidence: 0.8 },
    };
    expect(parseQualification(req, { answers }, segments).segment).toEqual({
      id: "s2",
      confidence: 0.8,
    });
    expect(() =>
      parseQualification(req, { answers: { ...answers, intent: {} } }, segments),
    ).toThrow(/intent/);
  });
});

describe("personal mail", () => {
  const domainSent = (email: string | null) =>
    (
      buildQualificationRequest({ ...ctx, lead: { ...ctx.lead, email } }).state as {
        lead: { dominio_email?: string };
      }
    ).lead.dominio_email;
  it("marks every consumer mailbox, including hotmail.es and outlook.es, and leaves corporate domains alone", () => {
    for (const d of ["gmail.com", "hotmail.es", "outlook.es", "zoho.com", "terra.es"])
      expect(domainSent(`ana@${d}`)).toBe(`${d} (correo personal)`);
    expect(domainSent("ana@acme.com")).toBe("acme.com");
    expect(domainSent(null)).toBeUndefined();
  });
});

describe("proposal", () => {
  it("weights 50/35/15 by default: a perfect lead scores 100 and goes to SQL", () => {
    const v = qualificationView(q(), DEFAULT_QUAL_SETTINGS, "new");
    expect(v.total).toBe(100);
    expect(v.move).toBe("sql");
  });
  it("proposes MQL from 45 and SQL from 70", () => {
    // fit 2/3 = 67, intent 2/3 = 67, authority 1/3 = 33 → (67·50 + 67·35 + 33·15)/100 = 62
    expect(
      qualificationView(
        q({ fit: s(2), intent: s(2), authority: s(1) }),
        DEFAULT_QUAL_SETTINGS,
        "new",
      ),
    ).toMatchObject({ total: 62, proposal: "mql", move: "mql" });
    expect(
      qualificationView(
        q({ fit: s(1), intent: s(1), authority: s(1) }),
        DEFAULT_QUAL_SETTINGS,
        "new",
      ),
    ).toMatchObject({ total: 33, proposal: "new", move: null });
  });
  it("never goes straight to SQL without knowing the fit", () => {
    expect(qualificationView(q({ enough_info: 0.2 }), DEFAULT_QUAL_SETTINGS, "new")).toMatchObject({
      fitKnown: false,
      proposal: "mql",
    });
  });
  it("proposes discarding non-buyers and anti-ICP from 0.7", () => {
    expect(qualificationView(q({ not_buyer: 0.8 }), DEFAULT_QUAL_SETTINGS, "new").move).toBe(
      "disqualified",
    );
    expect(qualificationView(q({ anti_icp: 0.75 }), DEFAULT_QUAL_SETTINGS, "contacted").move).toBe(
      "disqualified",
    );
    expect(qualificationView(q({ not_buyer: 0.5 }), DEFAULT_QUAL_SETTINGS, "new")).toMatchObject({
      proposal: "sql",
      review: true,
    });
  });
  it("never proposes moving a lead backwards", () => {
    expect(
      qualificationView(
        q({ fit: s(2), intent: s(2), authority: s(1) }),
        DEFAULT_QUAL_SETTINGS,
        "sql",
      ).move,
    ).toBeNull();
  });
  it("recomputes with the company's weights without asking the AI again", () => {
    const set = readQualSettings({
      weights: { fit: 0, intent: 100, authority: 0 },
      mql: 30,
      sql: 90,
    });
    expect(qualificationView(q({ fit: s(0.9), intent: s(3) }), set, "new").total).toBe(100);
    expect(readQualSettings({ mql: 80, sql: 60 })).toMatchObject({ mql: 60, sql: 80 });
  });
});
