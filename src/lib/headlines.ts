import { formatRatio } from "@/lib/coverage";
import { CATALOG } from "@/lib/plays/catalog";
import { effectiveState } from "@/lib/plays/status";
// Screen headlines written as conclusions with the number inside (Nokko voice: «31 cuentas llevan
// 21 días sin contacto»). Pure: each screen passes the data it already has. When there is no data
// the headline falls back to the section name, so a number is never invented.

type Money = (n: number) => string;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Inicio: the most urgent thing first — deals at risk, then changes awaiting approval, then today's meetings, then the open pipeline. */
export function homeHeadline(p: {
  riskDeals: number;
  riskAmount: number;
  pendingApprovals: number;
  meetingsToday: number;
  openDeals: number;
  openAmount: number;
  money: Money;
  fallback: string;
}) {
  if (p.riskDeals > 0)
    return `${plural(p.riskDeals, "deal en riesgo", "deals en riesgo")}: ${p.money(p.riskAmount)} en juego`;
  if (p.pendingApprovals > 0)
    return `${plural(p.pendingApprovals, "cambio espera", "cambios esperan")} tu aprobación`;
  if (p.meetingsToday > 0) return `Hoy tienes ${plural(p.meetingsToday, "reunión", "reuniones")}`;
  if (p.openDeals > 0)
    return `${p.money(p.openAmount)} en ${plural(p.openDeals, "deal abierto", "deals abiertos")}, ninguno en riesgo`;
  return p.fallback;
}

/** Pipeline: open value, then deals past their close date, then deals gone cold. */
export function pipelineHeadline(p: {
  openDeals: number;
  openAmount: number;
  overdue: number;
  cold?: number;
  money: Money;
}) {
  if (p.openDeals === 0) return "Pipeline";
  if (p.overdue > 0)
    return `${p.money(p.openAmount)} abiertos, ${plural(p.overdue, "deal con el cierre vencido", "deals con el cierre vencido")}`;
  if (p.cold)
    return `${p.money(p.openAmount)} abiertos, ${plural(p.cold, "deal enfriado", "deals enfriados")} sin actividad`;
  return `${p.money(p.openAmount)} abiertos en ${plural(p.openDeals, "deal", "deals")}, todos en fecha y con actividad`;
}

/** Métricas: pipeline coverage of the quarter's quota (healthy band 3–4x). */
export function metricsHeadline(p: {
  quota: number;
  ratio: number;
  status: "low" | "healthy" | "high";
}) {
  if (!p.quota) return "Métricas";
  const x = formatRatio(p.ratio);
  if (p.status === "low") return `Cobertura de ${x}: falta pipeline para la cuota del trimestre`;
  if (p.status === "high") return `Cobertura de ${x}: sobra pipeline, revisa su calidad`;
  return `Cobertura de ${x}: el pipeline cubre la cuota del trimestre`;
}

/** Leads: open leads that are stuck longer than their stage allows or with a follow-up overdue. */
export function leadsHeadline(p: { open: number; late: number }) {
  if (p.open === 0) return "Leads";
  if (p.late > 0)
    return `${plural(p.late, "lead lleva", "leads llevan")} más días de los previstos sin avanzar`;
  return `${plural(p.open, "lead abierto", "leads abiertos")}, todos al día`;
}

/** Cuentas: accounts whose health is red. */
export function accountsHeadline(p: { total: number; atRisk: number }) {
  if (p.total === 0) return "Cuentas";
  if (p.atRisk > 0) return `${plural(p.atRisk, "cuenta", "cuentas")} en riesgo de ${p.total}`;
  return `${plural(p.total, "cuenta", "cuentas")}, ninguna en riesgo`;
}

/** Sugerencias: what is waiting for a decision, and how much of it is urgent. */
export function suggestionsHeadline(p: { pending: number; urgent: number }) {
  if (p.pending === 0) return "No hay sugerencias pendientes";
  if (p.urgent > 0)
    return `${plural(p.pending, "sugerencia espera", "sugerencias esperan")} tu decisión, ${p.urgent} ${p.urgent === 1 ? "urgente" : "urgentes"}`;
  return `${plural(p.pending, "sugerencia espera", "sugerencias esperan")} tu decisión`;
}

/** An open deal is overdue when its close date is before today. */
export function isOverdue(closeDate: string | null | undefined, now = new Date()) {
  return !!closeDate && closeDate < now.toISOString().slice(0, 10);
}

/** Plays GTM: how many of the catalogue's plays NOKKO already has data for (not blocked) and how many the company has activated. Without the company's state, the section name. */
export function playsHeadline(rows: { play_id: string; enabled: boolean }[] | null | undefined) {
  if (!rows) return "Plays GTM";
  const byId = new Map(rows.map((r) => [r.play_id, r]));
  const withData = CATALOG.filter((p) => p.status !== "bloqueado").length;
  const on = CATALOG.filter((p) => effectiveState(p, byId.get(p.id)).enabled).length;
  return `${withData} de ${CATALOG.length} plays con datos de NOKKO; ${on} ${on === 1 ? "activado" : "activados"}`;
}
