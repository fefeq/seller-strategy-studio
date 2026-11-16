// Monday pipeline report: who moved last week, who went cold, and what to do first. Pure so the
// app (Sugerencias and Inicio), Telegram and email all say exactly the same thing.
import { stageIndex, stageLabel, type Stage } from "@/lib/stages";
import { staleDeals } from "@/lib/stale";
import type { DealLike, SegLike } from "@/lib/segment-coverage";
import { isOpenLeadStage, leadDelay, type LeadSla } from "@/lib/lead-funnel";

const DAY = 86_400_000;

/** ISO date of the Monday that starts the week containing `now` (UTC). */
export function weekStart(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

export type ReportDeal = DealLike & {
  id: string;
  name: string;
  owner_id: string | null;
  account_name?: string | null;
};
export type StageChange = {
  deal_id: string;
  from_stage: string | null;
  to_stage: string;
  changed_at: string;
};
export type ReportLead = {
  id: string;
  company: string;
  stage: string;
  created_at: string;
  sql_at: string | null;
  opportunity_at: string | null;
  stage_entered_at: string;
  next_step_at: string | null;
};

export type WeeklyReportInput = {
  now: Date;
  deals: ReportDeal[];
  history: StageChange[];
  leads: ReportLead[];
  segments: SegLike[];
  staleDays: number | null;
  leadSla: LeadSla;
  money: (n: number) => string;
  /** The company's stages; the default seven when missing. */
  stages?: Stage[] | null;
};

export type WeeklyReport = {
  weekOf: string;
  headline: string;
  advanced: { id: string; name: string; from: string; to: string }[];
  won: { id: string; name: string; amount: number }[];
  lost: { id: string; name: string }[];
  cold: { id: string; name: string; idleDays: number; threshold: number; isNew: boolean }[];
  overdue: { id: string; name: string; close_date: string }[];
  leads: { entered: number; toSql: number; toOpportunity: number; late: number };
  openAmount: number;
  openCount: number;
  todo: string[];
};

export function weeklyReport(i: WeeklyReportInput): WeeklyReport {
  const weekOf = weekStart(i.now);
  const since = new Date(i.now.getTime() - 7 * DAY);
  const sinceIso = since.toISOString();
  const byId = new Map(i.deals.map((d) => [d.id, d]));

  // Last stage change of each deal in the week; forward moves only (won/lost listed apart).
  const lastMove = new Map<string, StageChange>();
  for (const h of i.history) {
    if (h.changed_at < sinceIso) continue;
    const prev = lastMove.get(h.deal_id);
    if (!prev || h.changed_at > prev.changed_at) lastMove.set(h.deal_id, h);
  }
  const advanced: WeeklyReport["advanced"] = [];
  for (const [id, h] of lastMove) {
    const d = byId.get(id);
    if (
      !d ||
      h.to_stage === "won" ||
      h.to_stage === "lost" ||
      !h.from_stage ||
      h.from_stage === "lost"
    )
      continue;
    if (stageIndex(h.to_stage, i.stages) > stageIndex(h.from_stage, i.stages))
      advanced.push({
        id,
        name: d.name,
        from: stageLabel(h.from_stage, i.stages),
        to: stageLabel(h.to_stage, i.stages),
      });
  }
  const closedThisWeek = (stage: "won" | "lost") =>
    i.deals.filter((d) => d.stage === stage && (d.closed_at ?? d.updated_at) >= sinceIso);
  const won = closedThisWeek("won").map((d) => ({
    id: d.id,
    name: d.name,
    amount: Number(d.amount ?? 0),
  }));
  const lost = closedThisWeek("lost").map((d) => ({ id: d.id, name: d.name }));

  const cold = staleDeals(i.deals, i.segments, i.staleDays, i.now)
    .filter((r) => r.stale)
    .map((r) => ({
      id: r.deal.id,
      name: r.deal.name,
      idleDays: r.idleDays,
      threshold: r.threshold.days,
      isNew: r.idleDays - r.threshold.days < 7,
    }))
    .sort((a, b) => b.idleDays - a.idleDays);

  const today = i.now.toISOString().slice(0, 10);
  const open = i.deals.filter((d) => d.stage !== "won" && d.stage !== "lost");
  const overdue = open
    .filter((d) => d.close_date && d.close_date < today)
    .map((d) => ({ id: d.id, name: d.name, close_date: d.close_date! }))
    .sort((a, b) => a.close_date.localeCompare(b.close_date));

  const leads = {
    entered: i.leads.filter((l) => l.created_at >= sinceIso).length,
    toSql: i.leads.filter((l) => l.sql_at && l.sql_at >= sinceIso).length,
    toOpportunity: i.leads.filter((l) => l.opportunity_at && l.opportunity_at >= sinceIso).length,
    late: i.leads.filter((l) => isOpenLeadStage(l.stage) && leadDelay(l, i.leadSla, i.now).late)
      .length,
  };

  const todo: string[] = [];
  for (const c of cold.slice(0, 3))
    todo.push(`Retomar ${c.name}: ${c.idleDays} días sin actividad.`);
  for (const o of overdue.slice(0, 2))
    todo.push(`Actualizar la fecha de cierre de ${o.name} (venció el ${o.close_date}).`);
  if (leads.late > 0)
    todo.push(
      `Mover o descartar ${leads.late} ${leads.late === 1 ? "lead que lleva" : "leads que llevan"} más días de los previstos en su etapa.`,
    );
  if (!todo.length)
    todo.push(
      open.length
        ? "Nada urgente: dedica la semana a avanzar los deals abiertos."
        : "Sin deals abiertos: entra leads nuevos o crea el primer deal.",
    );

  const openAmount = open.reduce((s, d) => s + Number(d.amount ?? 0), 0);
  const moved = advanced.length + won.length;
  const headline =
    !i.deals.length && !i.leads.length
      ? "Semana sin actividad: aún no hay pipeline"
      : `${moved} ${moved === 1 ? "deal avanzó" : "deals avanzaron"} y ${cold.length} ${cold.length === 1 ? "se enfrió" : "se enfriaron"}${won.length ? `; ${won.length === 1 ? "1 ganado" : `${won.length} ganados`}` : ""}`;

  return {
    weekOf,
    headline,
    advanced,
    won,
    lost,
    cold,
    overdue,
    leads,
    openAmount,
    openCount: open.length,
    todo: todo.slice(0, 5),
  };
}

/** Plain text for Telegram and email (and the suggestion body), under ~1.500 characters. */
export function reportText(r: WeeklyReport, money: (n: number) => string): string {
  const lines: string[] = [];
  lines.push(
    `Pipeline abierto: ${money(r.openAmount)} en ${r.openCount} ${r.openCount === 1 ? "deal" : "deals"}.`,
  );
  if (r.won.length)
    lines.push(`Ganados: ${r.won.map((w) => `${w.name} (${money(w.amount)})`).join(", ")}.`);
  if (r.lost.length) lines.push(`Perdidos: ${r.lost.map((l) => l.name).join(", ")}.`);
  lines.push("");
  lines.push(
    r.advanced.length ? `Avanzaron (${r.advanced.length}):` : "Ningún deal cambió de etapa.",
  );
  for (const a of r.advanced.slice(0, 6)) lines.push(`· ${a.name}: ${a.from} → ${a.to}`);
  if (r.advanced.length > 6) lines.push(`· y ${r.advanced.length - 6} más`);
  lines.push("");
  lines.push(r.cold.length ? `Enfriados (${r.cold.length}):` : "Ningún deal enfriado.");
  for (const c of r.cold.slice(0, 6))
    lines.push(
      `· ${c.name}: ${c.idleDays} días sin actividad${c.isNew ? " (nuevo esta semana)" : ""}`,
    );
  if (r.cold.length > 6) lines.push(`· y ${r.cold.length - 6} más`);
  if (r.overdue.length) {
    lines.push("");
    lines.push(
      `Con el cierre vencido (${r.overdue.length}): ${r.overdue
        .slice(0, 4)
        .map((o) => o.name)
        .join(", ")}${r.overdue.length > 4 ? "…" : ""}.`,
    );
  }
  lines.push("");
  lines.push(
    `Leads: ${r.leads.entered} nuevos, ${r.leads.toSql} a SQL, ${r.leads.toOpportunity} a oportunidad${r.leads.late ? `, ${r.leads.late} con retraso` : ""}.`,
  );
  lines.push("");
  lines.push("Qué hacer primero:");
  r.todo.forEach((t, n) => lines.push(`${n + 1}. ${t}`));
  return lines.join("\n").trim();
}
