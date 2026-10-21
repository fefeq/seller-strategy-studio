import { describe, expect, it } from "vitest";
import { flattenPayload, mapStage, normalizeLead, parseAmount, parseDate } from "./leads";
import { actuals } from "./pipeline-real";

const lead = (rec: Record<string, unknown>) => {
  const r = normalizeLead(rec);
  if ("error" in r) throw new Error(r.error);
  return r.lead;
};

describe("each lead becomes an account with stage and date", () => {
  it("reads company, stage and entry date from Spanish columns", () => {
    const l = lead({ Empresa: "Acme", Etapa: "Propuesta", Fecha: "15/03/2026", Importe: "12.500 €" });
    expect(l.company).toBe("Acme");
    expect(l.stage).toBe("proposal");
    expect(l.enteredAt?.slice(0, 10)).toBe("2026-03-15");
    expect(l.amount).toBe(12500);
  });
  it("derives the company from a corporate email when no company is sent", () => {
    const l = lead({ email: "Ana@Acme-Logistics.com" });
    expect(l.domain).toBe("acme-logistics.com");
    expect(l.company).toBe("Acme-logistics");
  });
  it("rejects a lead with no way to identify the company", () => {
    expect("error" in normalizeLead({ email: "ana@gmail.com" })).toBe(true);
  });
  it("without a stage, new leads enter as Nuevo and existing ones keep theirs", () => {
    const l = lead({ company: "Acme" });
    expect(l.stage).toBe("new");
    expect(l.stageGiven).toBe(false);
  });
});

describe("stage mapping from CRMs and forms", () => {
  it("maps CRM stage names", () => {
    expect(mapStage("closedwon").stage).toBe("won");
    expect(mapStage("Closed Lost").stage).toBe("lost");
    expect(mapStage("appointmentscheduled").stage).toBe("demo");
    expect(mapStage("Negociación").stage).toBe("negotiation");
  });
  it("lead statuses stay on the Leads screen: Nuevo, Contactado, MQL, SQL, Descartado", () => {
    expect(mapStage("MQL").stage).toBe("mql");
    expect(mapStage("marketingqualifiedlead").stage).toBe("mql");
    expect(mapStage("salesqualifiedlead").stage).toBe("sql");
    expect(mapStage("Contactado").stage).toBe("contacted");
    expect(mapStage("subscriber").stage).toBe("new");
    expect(mapStage("Unqualified").stage).toBe("disqualified");
    expect(mapStage("No cualificado").stage).toBe("disqualified");
  });
  it("an opportunity or any sales stage enters the pipeline as a deal", () => {
    expect(mapStage("Oportunidad").stage).toBe("discovery");
    expect(mapStage("Cualificado").stage).toBe("qualified");
    expect(mapStage("Perdido").stage).toBe("lost");
  });
  it("flags unknown stages and falls back to the default", () => {
    expect(mapStage("xyz", "qualified")).toEqual({ stage: "qualified", recognized: false });
  });
});

describe("dates and amounts", () => {
  it("parses Unix seconds and ISO", () => {
    expect(parseDate(1767225600)?.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(parseDate("2026-02-10")?.toISOString().slice(0, 10)).toBe("2026-02-10");
    expect(parseDate("31/02/2026")).toBeNull();
  });
  it("parses European and US number formats", () => {
    expect(parseAmount("1.234,50")).toBe(1234.5);
    expect(parseAmount("$12,000")).toBe(12000);
  });
});

describe("payload shapes", () => {
  it("Typeform answers use question titles", () => {
    const recs = flattenPayload({ form_response: { token: "t1", definition: { fields: [{ id: "a", title: "¿Cuál es tu empresa?" }] }, answers: [{ field: { id: "a" }, type: "text", text: "Globex" }] } });
    expect(lead(recs[0]).company).toBe("Globex");
    expect(lead(recs[0]).externalId).toBe("t1");
  });
  it("Tally fields use labels", () => {
    const recs = flattenPayload({ data: { submissionId: "s1", fields: [{ label: "Empresa", value: "Initech" }, { label: "Email", value: "bob@initech.io" }] } });
    expect(lead(recs[0]).company).toBe("Initech");
  });
  it("accepts a batch of leads", () => {
    expect(flattenPayload({ leads: [{ company: "A" }, { company: "B" }] })).toHaveLength(2);
  });
});

describe("real numbers for the calculator", () => {
  const now = new Date("2026-06-30T00:00:00Z");
  const d = (stage: string, amount: number, created: string, closed: string | null) => ({ segment_id: null, amount, stage, close_date: null, closed_at: closed, updated_at: closed ?? created, created_at: created });
  const deals = [
    d("won", 10000, "2026-01-01T00:00:00Z", "2026-01-31T00:00:00Z"),
    d("won", 30000, "2026-02-01T00:00:00Z", "2026-04-02T00:00:00Z"),
    d("lost", 50000, "2026-03-01T00:00:00Z", "2026-03-20T00:00:00Z"),
    d("proposal", 99000, "2026-05-01T00:00:00Z", null),
  ];
  it("ACV is the average won deal", () => expect(actuals(deals, now).acv).toBe(20000));
  it("win rate is won / (won + lost)", () => expect(actuals(deals, now).winRate).toBeCloseTo(66.67, 1));
  it("cycle is the median days from entry to won", () => expect(actuals(deals, now).cycleDays).toBe(45));
  it("falls back to open deals for ACV when nothing is won", () => {
    const a = actuals([deals[3]], now);
    expect(a.acv).toBe(99000);
    expect(a.acvSource).toBe("abiertos");
    expect(a.winRate).toBeNull();
  });
});

describe("CSV column mapping (preview)", () => {
  it("says which field each column fills, so «fecha» is visibly the entry date", async () => {
    const { columnMapping } = await import("./leads");
    expect(columnMapping(["empresa", "etapa", "fecha", "importe", "notas"])).toEqual({ empresa: "company", etapa: "stage", fecha: "enteredAt", importe: "amount", notas: null });
    expect(columnMapping(["Empresa", "Fecha de cierre"])["Fecha de cierre"]).toBe("closeDate");
  });
  it("a column the person reassigns reaches the importer as that field", async () => {
    const { applyColumnMapping, normalizeLead } = await import("./leads");
    const rows = [{ empresa: "Acme", etapa: "Discovery", fecha: "15/11/2026", importe: "500", notas: "x" }];
    const mapped = applyColumnMapping(rows, { empresa: "company", etapa: "stage", fecha: "closeDate", importe: "amount", notas: null });
    expect(mapped[0]).toEqual({ company: "Acme", stage: "Discovery", close_date: "15/11/2026", amount: "500" });
    const r = normalizeLead(mapped[0]);
    if ("error" in r) throw new Error(r.error);
    expect(r.lead.closeDate).toBe("2026-11-15");
  });
  it("warns when rows will create deals and nothing fills the close date", async () => {
    const { columnMapping, dealsWithoutCloseDate } = await import("./leads");
    const rows = [{ empresa: "Acme", etapa: "Discovery", fecha: "15/11/2026" }];
    expect(dealsWithoutCloseDate(rows, columnMapping(Object.keys(rows[0])), "new")).toBe(true);
    expect(dealsWithoutCloseDate([{ empresa: "Acme", etapa: "Nuevo" }], columnMapping(["empresa", "etapa"]), "new")).toBe(false);
  });
});

describe("CSV mapping keeps the importer's rescue rules", () => {
  it("takes the first non-empty column of a field and still finds an email in an ignored column", async () => {
    const { applyColumnMapping } = await import("./leads");
    const out = applyColumnMapping([{ a: "", b: "Acme", c: "ana@acme.com" }], { a: "company", b: "company", c: null });
    expect(out[0].company).toBe("Acme");
    expect(Object.values(out[0])).toContain("ana@acme.com");
  });
});
