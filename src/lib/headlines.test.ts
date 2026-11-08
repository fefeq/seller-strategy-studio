import { describe, expect, it } from "vitest";
import {
  accountsHeadline,
  homeHeadline,
  isOverdue,
  leadsHeadline,
  metricsHeadline,
  pipelineHeadline,
  playsHeadline,
  suggestionsHeadline,
} from "./headlines";

const money = (n: number) => `${n.toLocaleString("es-ES")} €`;

describe("headlines", () => {
  it("home puts risk first, then approvals, meetings and pipeline", () => {
    const base = {
      riskDeals: 0,
      riskAmount: 0,
      pendingApprovals: 0,
      meetingsToday: 0,
      openDeals: 0,
      openAmount: 0,
      money,
      fallback: "Hola, Ana",
    };
    expect(homeHeadline({ ...base, riskDeals: 2, riskAmount: 48000, pendingApprovals: 3 })).toBe(
      "2 deals en riesgo: 48.000 € en juego",
    );
    expect(homeHeadline({ ...base, pendingApprovals: 1 })).toBe("1 cambio espera tu aprobación");
    expect(homeHeadline({ ...base, meetingsToday: 3 })).toBe("Hoy tienes 3 reuniones");
    expect(homeHeadline({ ...base, openDeals: 5, openAmount: 120000 })).toBe(
      "120.000 € en 5 deals abiertos, ninguno en riesgo",
    );
    expect(homeHeadline(base)).toBe("Hola, Ana");
  });
  it("pipeline counts overdue deals", () => {
    expect(pipelineHeadline({ openDeals: 9, openAmount: 409500, overdue: 3, money })).toBe(
      "409.500 € abiertos, 3 deals con el cierre vencido",
    );
    expect(pipelineHeadline({ openDeals: 4, openAmount: 8000, overdue: 0, cold: 2, money })).toBe(
      "8000 € abiertos, 2 deals enfriados sin actividad",
    );
    expect(pipelineHeadline({ openDeals: 1, openAmount: 8000, overdue: 0, money })).toBe(
      "8000 € abiertos en 1 deal, todos en fecha y con actividad",
    );
    expect(pipelineHeadline({ openDeals: 0, openAmount: 0, overdue: 0, money })).toBe("Pipeline");
  });
  it("metrics reads coverage, never invents it without a quota", () => {
    expect(metricsHeadline({ quota: 200000, ratio: 2, status: "low" })).toBe(
      "Cobertura de 2,0x: falta pipeline para la cuota del trimestre",
    );
    expect(metricsHeadline({ quota: 200000, ratio: 3.5, status: "healthy" })).toMatch(
      /^Cobertura de 3,5x: el pipeline cubre/,
    );
    expect(metricsHeadline({ quota: 0, ratio: 0, status: "low" })).toBe("Métricas");
  });
  it("leads, accounts and suggestions", () => {
    expect(leadsHeadline({ open: 10, late: 4 })).toBe(
      "4 leads llevan más días de los previstos sin avanzar",
    );
    expect(leadsHeadline({ open: 1, late: 1 })).toBe(
      "1 lead lleva más días de los previstos sin avanzar",
    );
    expect(leadsHeadline({ open: 6, late: 0 })).toBe("6 leads abiertos, todos al día");
    expect(accountsHeadline({ total: 8, atRisk: 2 })).toBe("2 cuentas en riesgo de 8");
    expect(accountsHeadline({ total: 8, atRisk: 0 })).toBe("8 cuentas, ninguna en riesgo");
    expect(suggestionsHeadline({ pending: 4, urgent: 1 })).toBe(
      "4 sugerencias esperan tu decisión, 1 urgente",
    );
    expect(suggestionsHeadline({ pending: 0, urgent: 0 })).toBe("No hay sugerencias pendientes");
  });
  it("isOverdue compares calendar days", () => {
    const now = new Date("2026-10-20T10:00:00Z");
    expect(isOverdue("2026-10-19", now)).toBe(true);
    expect(isOverdue("2026-10-20", now)).toBe(false);
    expect(isOverdue(null, now)).toBe(false);
  });
});

describe("playsHeadline (CA-6, G-1)", () => {
  it("counts plays whose data NOKKO already has and the plays activated, computed from the catalogue and the company's rows", () => {
    // No rows: the six plays that already run as rules are on by default.
    expect(playsHeadline([])).toBe("12 de 28 plays con datos de NOKKO; 6 activados");
    // Pausing one of them and activating a play that has no rule yet.
    expect(
      playsHeadline([
        { play_id: "crm-hygiene", enabled: false },
        { play_id: "closed-lost-revival", enabled: true },
      ]),
    ).toBe("12 de 28 plays con datos de NOKKO; 6 activados");
    expect(playsHeadline([{ play_id: "crm-hygiene", enabled: false }])).toBe(
      "12 de 28 plays con datos de NOKKO; 5 activados",
    );
  });

  it("never counts a blocked or planned play as activated, even if a row says so", () => {
    expect(
      playsHeadline([
        { play_id: "brand-mentions-monitoring", enabled: true },
        { play_id: "pain-qualified-segments", enabled: true },
      ]),
    ).toBe("12 de 28 plays con datos de NOKKO; 6 activados");
  });

  it("uses the singular for one activated play", () => {
    const off = [
      "meeting-prep-and-follow-up",
      "meeting-form-orchestration",
      "signal-activation",
      "crm-hygiene",
      "plg-to-sales",
    ].map((play_id) => ({ play_id, enabled: false }));
    expect(playsHeadline(off)).toBe("12 de 28 plays con datos de NOKKO; 1 activado");
  });

  it("falls back to the section name while the company's state is not loaded, never to a made-up number", () => {
    expect(playsHeadline(undefined)).toBe("Plays GTM");
    expect(playsHeadline(null)).toBe("Plays GTM");
  });
});
