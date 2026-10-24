// Inicio briefing (pure, tested): what Nokko did on its own since yesterday and what comes today.
// «Necesita tu decisión» reuses the suggestions digest; this module only counts and words the other two blocks.

export type BriefItem = { text: string; link: string | null };

export type AutoWorkInput = {
  since: string; // ISO; rows older than this are ignored
  usage: { trigger: string; need: string | null; cost: number | string; created_at: string }[];
  leads: { enriched_at: string | null }[];
  memories: { learned: boolean; created_at: string }[];
  signals: { found_at: string }[];
  suggestions: { created_at: string; detector: string }[];
  jobs: { status: string; finished_at: string | null }[];
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** «Lo que hice solo desde ayer», most valuable first; empty array when nothing happened. */
export function autoWork(i: AutoWorkInput, money: (n: number) => string): BriefItem[] {
  const after = (iso: string | null | undefined) => !!iso && iso >= i.since;
  const auto = i.usage.filter((u) => u.trigger === "automatic" && after(u.created_at));
  const spent = auto.reduce((s, u) => s + Number(u.cost || 0), 0);
  const leads = i.leads.filter((l) => after(l.enriched_at)).length;
  const completed = auto.filter((u) => u.need === "enrich_account").length;
  const learned = i.memories.filter((m) => m.learned && after(m.created_at)).length;
  const signals = i.signals.filter((s) => after(s.found_at)).length;
  const detected = i.suggestions.filter((s) => after(s.created_at) && s.detector !== "lead_enriched").length;
  const jobs = i.jobs.filter((j) => j.status === "done" && after(j.finished_at)).length;
  const out: BriefItem[] = [];
  if (leads) out.push({ text: `Preparé ${plural(leads, "lead nuevo", "leads nuevos")}: su cuenta, sus datos, las personas clave y una propuesta de etapa.`, link: "/leads" });
  if (completed) out.push({ text: `Completé los datos de ${plural(completed, "cuenta", "cuentas")}${spent > 0 ? ` (gasto automático: ${money(spent)})` : ""}.`, link: "/accounts" });
  else if (spent > 0) out.push({ text: `Gasto automático en servicios: ${money(spent)}.`, link: "/integrations" });
  if (signals) out.push({ text: `Encontré ${plural(signals, "novedad", "novedades")} en tus cuentas.`, link: "/accounts" });
  if (detected) out.push({ text: `Detecté ${plural(detected, "asunto nuevo", "asuntos nuevos")} que merecen tu atención.`, link: "/inbox" });
  if (learned) out.push({ text: `Aprendí ${plural(learned, "cosa nueva", "cosas nuevas")} sobre el negocio y el equipo.`, link: "/memory" });
  if (jobs) out.push({ text: `Terminé ${plural(jobs, "tarea larga", "tareas largas")} en segundo plano.`, link: null });
  return out;
}

export type TodayInput = {
  today: string; // YYYY-MM-DD (local)
  userId: string;
  leader: boolean;
  meetings: { id: string; title: string; scheduled_at: string | null; account_id: string | null }[];
  tasks: { title: string; due_date: string | null; done: boolean; owner_id: string | null }[];
  deals: { name: string; close_date: string | null; owner_id: string | null; stage: string; closed: boolean }[];
  leads: { company: string; next_step_at: string | null; owner_id: string | null; stage: string }[];
};

const time = (iso: string) => new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

/** «Hoy»: meetings, tasks due or overdue, deals whose close date has come, lead follow-ups due. Scoped to the person unless leader. */
export function todayItems(i: TodayInput): BriefItem[] {
  const mine = (owner: string | null) => i.leader || owner === i.userId || owner === null;
  const out: BriefItem[] = [];
  for (const m of i.meetings.filter((m) => m.scheduled_at?.slice(0, 10) === i.today).sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? "")))
    out.push({ text: `${time(m.scheduled_at!)} · ${m.title}`, link: m.account_id ? `/accounts/${m.account_id}` : null });
  const tasks = i.tasks.filter((t) => !t.done && t.due_date && t.due_date <= i.today && (t.owner_id === i.userId || (i.leader && !t.owner_id) || t.owner_id === null));
  const late = tasks.filter((t) => t.due_date! < i.today).length;
  if (tasks.length) out.push({ text: `${plural(tasks.length, "tarea", "tareas")} para hoy${late ? `, ${late} con retraso` : ""}: ${tasks.slice(0, 2).map((t) => t.title).join(" · ")}${tasks.length > 2 ? "…" : ""}`, link: null });
  const closing = i.deals.filter((d) => !d.closed && d.close_date && d.close_date <= i.today && mine(d.owner_id));
  if (closing.length) out.push({ text: `${plural(closing.length, "deal debería cerrar", "deals deberían cerrar")} hoy o ya: ${closing.slice(0, 2).map((d) => d.name).join(" · ")}${closing.length > 2 ? "…" : ""}. Actualiza la fecha o la etapa.`, link: "/deals" });
  const follow = i.leads.filter((l) => l.next_step_at && l.next_step_at <= i.today && l.stage !== "opportunity" && l.stage !== "disqualified" && mine(l.owner_id));
  if (follow.length) out.push({ text: `${plural(follow.length, "seguimiento de lead", "seguimientos de leads")}: ${follow.slice(0, 3).map((l) => l.company).join(" · ")}${follow.length > 3 ? "…" : ""}`, link: "/leads" });
  return out;
}

/** Start of the «desde ayer» window: yesterday at 00:00 local time. */
export function briefingSince(now = new Date()): string {
  const d = new Date(now); d.setDate(d.getDate() - 1); d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
