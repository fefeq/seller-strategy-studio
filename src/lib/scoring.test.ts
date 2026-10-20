import { describe, expect, it } from "vitest";
import { accountActivity, accountFit, band, byScore, combine, fitText, leadActivity, numbersIn, recencyScore, scoreAccount, scoreLead, tokens, type IcpProfile } from "./scoring";

const now = new Date("2026-10-20T12:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();

const ICP: IcpProfile = { id: "i1", segment_id: "mid", industries: "SaaS B2B, Fintech, Logística", company_size: "50-500 empleados", anti_icp: "Agencias, consultoras, freelance" };
const names = new Map([["mid", "Mid-market"], ["smb", "SMB"]]);

describe("text helpers", () => {
  it("tokens ignore accents, case and connectors", () => {
    expect([...tokens("Fintech y Logística, para empresas con más de 50 empleados")]).toEqual(["fintech", "logistica"]);
  });
  it("numbers read ranges and k suffixes", () => {
    expect(numbersIn("50-500 empleados")).toEqual([50, 500]);
    expect(numbersIn("1k+")).toEqual([1000]);
    expect(numbersIn(null)).toEqual([]);
  });
});

describe("ICP fit", () => {
  it("a full match scores 100 and names every criterion", () => {
    const f = accountFit({ segment_id: "mid", industry: "Fintech", size: "200", tier: "A", name: "Acme" }, [ICP], names);
    expect(f.score).toBe(100);
    expect(f.known).toBe(5);
    expect(f.criteria.map((c) => c.status)).toEqual(["match", "match", "match", "match", "match"]);
    expect(f.criteria[0].note).toBe("Está en Mid-market");
  });
  it("unknown criteria are left out instead of counted as zero", () => {
    const f = accountFit({ segment_id: null, industry: "Fintech", size: null, tier: null }, [ICP]);
    expect(f.known).toBe(2); // industry + anti-ICP
    expect(f.score).toBe(100);
    expect(f.criteria.find((c) => c.id === "segment")?.status).toBe("unknown");
  });
  it("with nothing to check the fit is null, never 0", () => {
    expect(accountFit({ segment_id: null, industry: null, size: null, tier: "B" }, [{ ...ICP, anti_icp: null }]).score).toBeNull();
    expect(accountFit({ segment_id: "mid", industry: "Fintech", size: "100" }, []).score).toBeNull();
  });
  it("matching the anti-ICP is a miss with double weight", () => {
    const f = accountFit({ segment_id: "mid", industry: "Agencia de marketing", size: "20", tier: null, name: "Agencias Pérez" }, [ICP], names);
    // segment 2 ✓, industry 2 ✗, size 1 ✗ (20 outside 50-500), anti 2 ✗ → 2/7
    expect(f.score).toBe(29);
    expect(f.criteria.find((c) => c.id === "anti_icp")?.note).toContain("agencia");
  });
  it("size understands ranges, open ends and words", () => {
    const size = (icp: string, acc: string) => accountFit({ segment_id: null, industry: null, size: acc }, [{ ...ICP, company_size: icp, anti_icp: null }]).criteria.find((c) => c.id === "size")?.status;
    expect(size("50-500 empleados", "120")).toBe("match");
    expect(size("50-500 empleados", "1200")).toBe("miss");
    expect(size("más de 200 empleados", "900")).toBe("match");
    expect(size("menos de 50", "120")).toBe("miss");
    expect(size("Mid-market (200)", "180")).toBe("match");
    expect(size("Mid-market", "mid-market")).toBe("match");
  });
  it("uses the ICP of the account's segment when there is one, else the best ICP", () => {
    const smb: IcpProfile = { id: "i2", segment_id: "smb", industries: "Retail", company_size: "10-50", anti_icp: null };
    expect(accountFit({ segment_id: "smb", industry: "Fintech", size: "100" }, [ICP, smb]).icpIndex).toBe(1);
    expect(accountFit({ segment_id: null, industry: "Fintech", size: "100" }, [smb, ICP]).icpIndex).toBe(1);
  });
});

describe("activity", () => {
  it("decays with time since the last contact", () => {
    expect(recencyScore(daysAgo(3), now)).toBe(100);
    expect(recencyScore(daysAgo(10), now)).toBe(75);
    expect(recencyScore(daysAgo(20), now)).toBe(50);
    expect(recencyScore(daysAgo(45), now)).toBe(25);
    expect(recencyScore(daysAgo(90), now)).toBe(10);
    expect(recencyScore(null, now)).toBe(0);
  });
  it("an open deal keeps a quiet account warm", () => {
    expect(accountActivity({ lastActivityAt: daysAgo(90), openDeals: 1 }, now)).toBe(40);
    expect(accountActivity({ lastActivityAt: daysAgo(2), openDeals: 0 }, now)).toBe(100);
  });
  it("leads climb with the stage, fall when late and rise with a scheduled follow-up", () => {
    const base = { stage_entered_at: daysAgo(1), next_step_at: null, late: false };
    expect(leadActivity({ ...base, stage: "new" }, now)).toBe(52);
    expect(leadActivity({ ...base, stage: "sql" }, now)).toBe(88);
    expect(leadActivity({ ...base, stage: "sql", late: true }, now)).toBe(63);
    expect(leadActivity({ ...base, stage: "sql", next_step_at: "2026-10-25" }, now)).toBe(98);
    expect(leadActivity({ ...base, stage: "sql", next_step_at: "2026-10-01" }, now)).toBe(88);
    expect(leadActivity({ ...base, stage: "disqualified" }, now)).toBe(0);
  });
});

describe("combined score", () => {
  it("fit weighs 70 % and activity 30 %", () => {
    const s = scoreAccount({ segment_id: "mid", industry: "Fintech", size: "200", tier: "A", lastActivityAt: daysAgo(20), openDeals: 0 }, [ICP], now);
    expect(s.fit.score).toBe(100);
    expect(s.activity).toBe(50);
    expect(s.total).toBe(85);
    expect(s.band).toBe("alto");
  });
  it("activity alone never produces a total", () => {
    const s = scoreAccount({ segment_id: null, industry: null, size: null, lastActivityAt: daysAgo(1), openDeals: 2 }, [{ ...ICP, anti_icp: null }], now);
    expect(s.total).toBeNull();
    expect(s.band).toBe("sin_datos");
  });
  it("bands split at 40 and 70", () => {
    expect(band(70)).toBe("alto");
    expect(band(69)).toBe("medio");
    expect(band(39)).toBe("bajo");
  });
  it("a lead with an account inherits its fit; without one only segment and name count", () => {
    const accounts = new Map([["a1", { segment_id: "mid", industry: "Fintech", size: "200", tier: "A", name: "Acme" }]]);
    const l = { stage: "sql", stage_entered_at: daysAgo(1), next_step_at: null, late: false, company: "Acme", segment_id: null, account_id: "a1" };
    expect(scoreLead(l, [ICP], accounts, now).fit.score).toBe(100);
    const loose = scoreLead({ ...l, account_id: null, segment_id: "mid", company: "Consultora Beta" }, [ICP], accounts, now);
    expect(loose.fit.criteria.find((c) => c.id === "anti_icp")?.status).toBe("miss");
    expect(loose.fit.score).toBe(50); // segment ✓ (2) anti ✗ (2)
  });
  it("sorts highest first and unknown totals last", () => {
    const f = (score: number | null) => ({ score, known: score == null ? 0 : 1, total: 5, criteria: [], icpIndex: null });
    const rows = [combine(f(null), 90), combine(f(40), 10), combine(f(90), 50), combine(f(null), 20)];
    expect(rows.sort(byScore((x) => x)).map((r) => [r.total, r.activity])).toEqual([[78, 50], [31, 10], [null, 90], [null, 20]]);
  });
  it("explains the fit in one line", () => {
    const f = accountFit({ segment_id: "mid", industry: "Retail", size: "200", tier: null }, [ICP], names);
    expect(fitText(f)).toBe("encaja en segmento, tamaño, anti-icp; no encaja en sector (4 de 5 criterios)");
    expect(fitText(f && { ...f, score: null })).toBe("Sin datos para medir el encaje");
  });
});
