// GTM Advisor: builds a compact snapshot of pipeline, metrics and segments for the AI,
// and defines the structured output it must return.
import { daysInStage, quarterOf, quarterRange, stageConversion, winRate } from "./metrics";
import { formatRatio, quarterCoverage } from "./coverage";
import { ROLES } from "./roles";
import { AI_NO_SOURCE } from "./deal-source";
import { WIN_RATE_WINDOWS } from "./unit-economics";
import { openStages, stagePath, type Stage } from "./stages";

/** Only Owner and Sales Leader may run the GTM advisor. */
export function canUseAdvisor(roles: string[]) {
  return roles.some((r) => r === "owner" || r === "sales_leader");
}

export const HORIZONS: Record<string, string> = {
  quarter: "Este trimestre",
  half: "Próximos 6 meses",
  year: "Próximos 12 meses",
};

export const LEVELS: Record<string, string> = { high: "Alto", medium: "Medio", low: "Bajo" };
export const WINDOWS: Record<string, string> = {
  "30d": "30 días",
  "90d": "90 días",
  "180d": "6 meses",
};

type Deal = {
  id: string;
  name: string;
  stage: string;
  amount: number | null;
  probability: number | null;
  health: string | null;
  close_date: string | null;
  closed_at: string | null;
  updated_at: string;
  source: string | null;
  segment_id: string | null;
  slip_count: number;
  forecast_category: string | null;
  meddpicc: unknown;
  partner_id: string | null;
};
type Segment = {
  id: string;
  name: string;
  acv_min: number | null;
  acv_max: number | null;
  motion: string;
  cycle_days: number | null;
  sdr_per_ae: number | null;
  ae_per_se: number | null;
  cac_target: number | null;
  payback_months: number | null;
  win_rate_target: number | null;
  ae_quota: number | null;
  gross_margin_pct: number | null;
  notes?: string | null;
};
type History = { deal_id: string; from_stage: string | null; to_stage: string; changed_at: string };
type Quota = { period: string; amount: number };

const sum = (ds: Deal[]) => ds.reduce((s, d) => s + Number(d.amount ?? 0), 0);
const r1 = (n: number) => Math.round(n * 10) / 10;
const pct = (n: number) => Math.round(n * 1000) / 10;
/** SDD-20261109 CA-12: without closed deals there is no win rate (null), never 0. winRate() keeps its 0 for others. */
const winRatePct = (won: number, lost: number) => (won + lost ? pct(winRate(won, lost)) : null);
/** The window of every win rate of the snapshot (WIN_RATE_WINDOWS.historico, as the AI reads it). */
const WIN_RATE_WINDOW = WIN_RATE_WINDOWS.historico.label.toLowerCase();

function meddpiccFilled(m: unknown) {
  if (!m || typeof m !== "object") return 0;
  return Object.values(m as Record<string, unknown>).filter((v) =>
    typeof v === "string" ? v.trim() !== "" : !!v,
  ).length;
}

export function buildSnapshot(input: {
  deals: Deal[];
  segments: Segment[];
  history: History[];
  quotas: Quota[];
  currency: string;
  now?: Date;
  stages?: Stage[] | null;
}) {
  const now = input.now ?? new Date();
  const OPEN_ORDER = stagePath(input.stages);
  const { deals, segments, history, quotas } = input;
  const open = deals.filter((d) => d.stage !== "won" && d.stage !== "lost");
  const won = deals.filter((d) => d.stage === "won");
  const lost = deals.filter((d) => d.stage === "lost");
  const quarter = quarterOf(now);
  const { start, end } = quarterRange(quarter);
  const inQ = (s: string | null) => !!s && new Date(s) >= start && new Date(s) < end;
  const openInQ = open.filter((d) => inQ(d.close_date));
  const quota = quotas
    .filter((q) => q.period === quarter)
    .reduce((s, q) => s + Number(q.amount), 0);
  // Same calculation as Métricas and the low_coverage suggestion.
  const cov = quarterCoverage(open, quota, quarter);
  const wonQ = won.filter((d) => inQ(d.closed_at ?? d.updated_at));
  const commitQ = sum(openInQ.filter((d) => d.forecast_category === "commit")) + sum(wonQ);

  const byKey = (key: (d: Deal) => string) => {
    const g: Record<string, { won: number; lost: number }> = {};
    for (const d of [...won, ...lost]) {
      const k = key(d);
      g[k] ??= { won: 0, lost: 0 };
      g[k][d.stage === "won" ? "won" : "lost"]++;
    }
    return Object.entries(g).map(([k, v]) => ({
      grupo: k,
      ganados: v.won,
      perdidos: v.lost,
      win_rate_pct: pct(winRate(v.won, v.lost)),
    }));
  };

  const days = daysInStage(history, now);

  return {
    moneda: input.currency,
    fecha: now.toISOString().slice(0, 10),
    pipeline: {
      abiertos: open.length,
      importe_abierto: sum(open),
      forecast_ponderado: Math.round(
        open.reduce((s, d) => s + (Number(d.amount ?? 0) * (d.probability ?? 0)) / 100, 0),
      ),
      por_etapa: openStages(input.stages).map((st) => ({
        etapa: st.label,
        clave: st.key,
        deals: open.filter((d) => d.stage === st.key).length,
        importe: sum(open.filter((d) => d.stage === st.key)),
      })),
      ganados: {
        deals: won.length,
        importe: sum(won),
        ticket_medio: won.length ? Math.round(sum(won) / won.length) : 0,
      },
      perdidos: { deals: lost.length, importe: sum(lost) },
      win_rate_global_pct: winRatePct(won.length, lost.length),
      ventana_win_rate: WIN_RATE_WINDOW,
      win_rate_por_fuente: byKey((d) => d.source ?? AI_NO_SOURCE),
      en_riesgo: {
        deals: open.filter((d) => d.health === "red").length,
        importe: sum(open.filter((d) => d.health === "red")),
      },
      con_retrasos_de_fecha: {
        deals: open.filter((d) => d.slip_count > 0).length,
        pct: open.length ? pct(open.filter((d) => d.slip_count > 0).length / open.length) : 0,
      },
      sin_segmento: open.filter((d) => !d.segment_id).length,
      top_abiertos: [...open]
        .sort((a, b) => Number(b.amount ?? 0) - Number(a.amount ?? 0))
        .slice(0, 12)
        .map((d) => ({
          nombre: d.name,
          etapa: d.stage,
          importe: Number(d.amount ?? 0),
          cierre: d.close_date,
          salud: d.health,
          retrasos: d.slip_count,
          meddpicc_completado: `${meddpiccFilled(d.meddpicc)}/8`,
          forecast: d.forecast_category,
        })),
    },
    trimestre: {
      periodo: quarter,
      cuota: quota,
      pipeline_que_cierra: sum(openInQ),
      cobertura: quota
        ? `${formatRatio(cov.ratio)} (${cov.status === "healthy" ? "sana, 3–4x" : cov.status === "low" ? "baja, <3x" : "alta, >4x"})`
        : "sin cuota definida",
      deals_abiertos_sin_fecha_de_cierre: {
        deals: cov.undated.count,
        importe: cov.undated.amount,
        nota: "no cuentan en la cobertura de ningún trimestre",
      },
      ganado: sum(wonQ),
      commit_mas_ganado: commitQ,
    },
    conversion_por_etapa: stageConversion(history, OPEN_ORDER).map((c) => ({
      de: c.from,
      a: c.to,
      tasa_pct: pct(c.rate),
      muestra: c.count,
    })),
    dias_medios_por_etapa: Object.fromEntries(Object.entries(days).map(([k, v]) => [k, r1(v)])),
    segmentos: segments.map((s) => {
      const sd = deals.filter((d) => d.segment_id === s.id);
      const sw = sd.filter((d) => d.stage === "won");
      const sl = sd.filter((d) => d.stage === "lost");
      return {
        nombre: s.name,
        benchmarks: {
          acv: `${s.acv_min ?? 0}–${s.acv_max ?? "sin límite"}`,
          motion: s.motion,
          ciclo_dias: s.cycle_days,
          sdr_por_ae: s.sdr_per_ae,
          ae_por_se: s.ae_per_se,
          win_rate_objetivo_pct: s.win_rate_target,
          cuota_anual_ae: s.ae_quota,
          cac_objetivo: s.cac_target,
          margen_bruto_pct: s.gross_margin_pct,
          payback_objetivo_meses: s.payback_months,
          ...(s.notes?.trim() ? { notas_y_fuentes: s.notes.trim().slice(0, 1200) } : {}),
        },
        real: {
          pipeline_abierto: sum(sd.filter((d) => d.stage !== "won" && d.stage !== "lost")),
          ganados: sw.length,
          perdidos: sl.length,
          win_rate_pct: winRatePct(sw.length, sl.length),
          ventana_win_rate: WIN_RATE_WINDOW,
          ticket_medio_ganado: sw.length ? Math.round(sum(sw) / sw.length) : null,
        },
      };
    }),
  };
}

export type AdvisorRecommendation = {
  priority: number;
  title: string;
  rationale: string;
  impact: "high" | "medium" | "low";
  effort: "high" | "medium" | "low";
  window: "30d" | "90d" | "180d";
  owner_role: string;
  kpi: string;
  target: string;
  actions: string[];
};
export type AdvisorResult = {
  summary: string;
  diagnosis: { finding: string; evidence: string }[];
  recommendations: AdvisorRecommendation[];
  risks: string[];
  data_gaps: string[];
  questions: string[];
};

/** Recommendations ordered by priority (1 first); ties broken by higher impact, then lower effort. */
export function sortRecommendations(list: AdvisorRecommendation[]) {
  const w = { high: 3, medium: 2, low: 1 } as const;
  return [...list].sort(
    (a, b) => a.priority - b.priority || w[b.impact] - w[a.impact] || w[a.effort] - w[b.effort],
  );
}

const str = { type: "string" } as const;
const lvl = { type: "string", enum: ["high", "medium", "low"] } as const;

export const ADVISOR_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "diagnosis", "recommendations", "risks", "data_gaps", "questions"],
  properties: {
    summary: str,
    diagnosis: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["finding", "evidence"],
        properties: { finding: str, evidence: str },
      },
    },
    recommendations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "priority",
          "title",
          "rationale",
          "impact",
          "effort",
          "window",
          "owner_role",
          "kpi",
          "target",
          "actions",
        ],
        properties: {
          priority: { type: "integer" },
          title: str,
          rationale: str,
          impact: lvl,
          effort: lvl,
          window: { type: "string", enum: ["30d", "90d", "180d"] },
          owner_role: { type: "string", enum: Object.keys(ROLES) },
          kpi: str,
          target: str,
          actions: { type: "array", items: str },
        },
      },
    },
    risks: { type: "array", items: str },
    data_gaps: { type: "array", items: str },
    questions: { type: "array", items: str },
  },
} as const;
