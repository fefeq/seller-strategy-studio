// CRM pieces ported from the Postin CRM (pure; tested in crm.test.ts): the unified timeline of an account or
// deal, email templates with variables, offer versions built from the deal lines, and the calendar month grid.
import { dealTotals, type DealLine } from "@/lib/deal-lines";

export type TimelineKind = "email" | "call" | "meeting" | "note" | "linkedin" | "whatsapp" | "other" | "task" | "stage" | "offer";
export const KIND_LABEL: Record<TimelineKind, string> = {
  email: "Email", call: "Llamada", meeting: "Reunión", note: "Nota", linkedin: "LinkedIn", whatsapp: "WhatsApp", other: "Otro", task: "Tarea", stage: "Etapa", offer: "Oferta",
};
export const ACTIVITY_KINDS = ["email", "call", "meeting", "note", "linkedin", "whatsapp", "other"] as const;

export type TimelineItem = { id: string; kind: TimelineKind; at: string; title: string; body: string | null; link?: string | null };

type Act = { id: string; kind: string; subject: string; body: string; occurred_at: string };
type Call = { id: string; title: string; occurred_at: string | null; summary: string | null; created_at: string };
type Meeting = { id: string; title: string; scheduled_at: string | null; notes: string | null; created_at: string };
type Task = { id: string; title: string; due_date: string | null; done: boolean; created_at: string };
type Stage = { deal_id: string; from_stage: string | null; to_stage: string; changed_at: string };
type Offer = { id: string; version: number; status: string; recurring_total: number | string; created_at: string };

/** Everything that happened with an account or deal, newest first. Future meetings and open tasks go to the calendar, not here. */
export function buildTimeline(x: { activities?: Act[]; calls?: Call[]; meetings?: Meeting[]; tasks?: Task[]; stages?: Stage[]; offers?: Offer[]; stageLabel?: (k: string) => string; now?: Date }): TimelineItem[] {
  const now = (x.now ?? new Date()).toISOString();
  const lab = x.stageLabel ?? ((k: string) => k);
  const out: TimelineItem[] = [];
  for (const a of x.activities ?? []) out.push({ id: `a:${a.id}`, kind: (a.kind in KIND_LABEL ? a.kind : "other") as TimelineKind, at: a.occurred_at, title: a.subject || KIND_LABEL[a.kind as TimelineKind] || "Actividad", body: a.body || null });
  for (const c of x.calls ?? []) out.push({ id: `c:${c.id}`, kind: "call", at: c.occurred_at ?? c.created_at, title: c.title, body: c.summary });
  for (const m of x.meetings ?? []) { const at = m.scheduled_at ?? m.created_at; if (at <= now) out.push({ id: `m:${m.id}`, kind: "meeting", at, title: m.title, body: m.notes }); }
  for (const t of x.tasks ?? []) if (t.done) out.push({ id: `t:${t.id}`, kind: "task", at: t.due_date ?? t.created_at, title: `Hecho: ${t.title}`, body: null });
  for (const s of x.stages ?? []) out.push({ id: `s:${s.deal_id}:${s.changed_at}`, kind: "stage", at: s.changed_at, title: s.from_stage ? `${lab(s.from_stage)} → ${lab(s.to_stage)}` : `Creado en ${lab(s.to_stage)}`, body: null });
  for (const o of x.offers ?? []) out.push({ id: `o:${o.id}`, kind: "offer", at: o.created_at, title: `Oferta v${o.version} · ${OFFER_STATUS[o.status as OfferStatus] ?? o.status}`, body: null });
  return out.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

/** Days since the last real touch (activity, call or past meeting); null without any. */
export function daysSinceTouch(items: TimelineItem[], now = new Date()): number | null {
  const t = items.find((i) => i.kind !== "stage" && i.kind !== "offer" && i.kind !== "task");
  return t ? Math.floor((now.getTime() - new Date(t.at).getTime()) / 86_400_000) : null;
}

/** {{nombre}}, {{empresa}}, {{deal}}, {{remitente}}: replaced when known, left visible when not so nothing is sent half-filled unnoticed. */
export function fillTemplate(text: string, vars: Record<string, string | null | undefined>): string {
  return text.replace(/\{\{\s*([a-záéíóúñ_]+)\s*\}\}/gi, (m, k: string) => { const v = vars[k.toLowerCase()]; return v ? v : m; });
}
export const missingVars = (text: string) => [...new Set([...text.matchAll(/\{\{\s*([a-záéíóúñ_]+)\s*\}\}/gi)].map((m) => m[1].toLowerCase()))];

export type OfferStatus = "draft" | "sent" | "accepted" | "rejected";
export const OFFER_STATUS: Record<OfferStatus, string> = { draft: "Borrador", sent: "Enviada", accepted: "Aceptada", rejected: "Rechazada" };

/** A new offer version: a frozen copy of the deal lines with their yearly recurring and one-off totals. */
export function offerFromLines(lines: DealLine[], existingVersions: number[]) {
  const t = dealTotals(lines);
  return {
    version: (existingVersions.length ? Math.max(...existingVersions) : 0) + 1,
    lines: lines.map((l) => ({ name: l.name, quantity: Number(l.quantity), unit_price: Number(l.unit_price), discount_pct: Number(l.discount_pct ?? 0), billing: l.billing })),
    recurring_total: Math.round(t.amount * 100) / 100,
    one_off_total: Math.round(t.oneOff * 100) / 100,
  };
}

/** Monday-first weeks covering a month, as YYYY-MM-DD strings (null = padding day of another month). */
export function monthGrid(month: string): (string | null)[][] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

/** Owners whose deals a team filter shows: "" = everyone (null), "mine" = the teams I belong to or lead, else that team. */
export function teamOwners(filter: string, teams: { id: string; lead_id: string | null }[], members: { team_id: string; user_id: string }[], me: string): Set<string> | null {
  if (!filter) return null;
  const ids = filter === "mine"
    ? teams.filter((t) => t.lead_id === me || members.some((m) => m.team_id === t.id && m.user_id === me)).map((t) => t.id)
    : [filter];
  const out = new Set<string>([me]);
  for (const t of teams) if (ids.includes(t.id) && t.lead_id) out.add(t.lead_id);
  for (const m of members) if (ids.includes(m.team_id)) out.add(m.user_id);
  if (filter !== "mine") out.delete(me), members.some((m) => m.team_id === filter && m.user_id === me) || teams.some((t) => t.id === filter && t.lead_id === me) ? out.add(me) : null;
  return out;
}
