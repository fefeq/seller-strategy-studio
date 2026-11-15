// A+ (PLAN-UX-20261115): what NOKKO reads out of LinkedIn data it already pays for. Pure, tested.
// Growth signals from open job offers (which teams hire, how senior) and engagement from posts (likes).
import type { Job, Post } from "@/lib/apify";

export type HiringTeam = "Ventas" | "Marketing" | "Ingeniería" | "Producto" | "Datos" | "Operaciones" | "Finanzas" | "Personas" | "Atención al cliente" | "Otros";

const TEAM_RULES: [HiringTeam, RegExp][] = [
  ["Ventas", /\b(sales|ventas|account executive|sdr|bdr|business development|comercial|account manager)\b/i],
  ["Marketing", /\b(marketing|growth|seo|content|brand|demand gen|comunicaci[oó]n)\b/i],
  ["Datos", /\b(data|datos|analytics|analyst|bi|machine learning|ml|ai engineer)\b/i],
  ["Ingeniería", /\b(engineer|developer|desarrollador|ingenier(?:o|a|os|as|[ií]a)|devops|backend|frontend|full ?stack|software|sre|qa)\b/i],
  ["Producto", /\b(product|producto|ux|ui|designer|dise[nñ]ador)\b/i],
  ["Atención al cliente", /\b(customer success|support|soporte|atenci[oó]n al cliente|cs manager)\b/i],
  ["Finanzas", /\b(finance|finanzas|accountant|contable|controller|cfo)\b/i],
  ["Personas", /\b(hr|people|talent|recruit|rrhh|recursos humanos)\b/i],
  ["Operaciones", /\b(operations|operaciones|ops|logistic|log[ií]stica|supply)\b/i],
];

export function hiringTeam(title: string): HiringTeam {
  return TEAM_RULES.find(([, re]) => re.test(title))?.[0] ?? "Otros";
}

const SENIOR = /\b(head|director|directora|vp|vice president|chief|c[teo]o|jefe|jefa)\b/i;

export type HiringSignals = {
  total: number;
  byTeam: { team: HiringTeam; count: number }[];
  senior: number;
  /** One line a founder can read; null without offers (never an invented trend). */
  headline: string | null;
};

export function hiringSignals(jobs: Pick<Job, "title" | "level">[]): HiringSignals {
  const counts = new Map<HiringTeam, number>();
  let senior = 0;
  for (const j of jobs) {
    const t = hiringTeam(j.title);
    counts.set(t, (counts.get(t) ?? 0) + 1);
    if (SENIOR.test(j.title) || /director|executive/i.test(j.level ?? "")) senior++;
  }
  const byTeam = [...counts.entries()].map(([team, count]) => ({ team, count })).sort((a, b) => b.count - a.count);
  const top = byTeam.filter((t) => t.team !== "Otros").slice(0, 2);
  const headline = jobs.length
    ? `${jobs.length} ${jobs.length === 1 ? "oferta abierta" : "ofertas abiertas"} en 30 días` +
      (top.length ? `; contrata sobre todo en ${top.map((t) => `${t.team} (${t.count})`).join(" y ")}` : "") +
      (senior ? `; ${senior} de perfil directivo` : "") + "."
    : null;
  return { total: jobs.length, byTeam, senior, headline };
}

export type Engagement = { posts: number; avgLikes: number | null; top: { url: string; likes: number } | null };

/** Engagement of own (non-repost) posts; no posts = null average, never zero. */
export function engagement(posts: Pick<Post, "url" | "likes" | "repost">[]): Engagement {
  const own = posts.filter((p) => !p.repost);
  const measured = own.filter((p): p is typeof p & { likes: number } => p.likes != null);
  if (!measured.length) return { posts: own.length, avgLikes: null, top: null };
  const total = measured.reduce((s, p) => s + p.likes, 0);
  const best = measured.reduce((a, b) => (b.likes > a.likes ? b : a));
  return { posts: own.length, avgLikes: Math.round(total / measured.length), top: { url: best.url, likes: best.likes } };
}

// ---- Cambios de cargo (A+) ----
export type CurrentRole = { title: string; company: string; since: string | null };

const blank = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();
const plain = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/** Current role from a LinkedIn profile scrape (harvestapi~linkedin-profile-scraper): the first experience with no end date. */
export function currentRole(raw: unknown): CurrentRole | null {
  const p = (Array.isArray(raw) ? raw[0] : raw) as Record<string, any> | undefined;
  if (!p || typeof p !== "object") return null;
  const exp = (Array.isArray(p.experience) ? p.experience : []) as Record<string, any>[];
  const open = exp.find((e) => !e?.endDate || /present|actualidad|hoy/i.test(blank(e?.endDate?.text ?? e?.endDate)));
  const title = blank(open?.position ?? open?.title);
  const company = blank(open?.companyName ?? p.currentPosition?.[0]?.companyName);
  if (!title && !company) return null;
  return { title, company, since: blank(open?.startDate?.text ?? open?.startDate) || null };
}

export type RoleChange = { changed: boolean; companyChanged: boolean; before: { title: string; company: string }; now: CurrentRole } | null;

/** Compare what NOKKO stores with LinkedIn; null when LinkedIn gave no current role (unknown, never «sin cambios»). */
export function roleChange(stored: { title: string | null; company: string | null }, now: CurrentRole | null): RoleChange {
  if (!now) return null;
  const before = { title: blank(stored.title), company: blank(stored.company) };
  const companyChanged = !!before.company && !!now.company && !plain(now.company).includes(plain(before.company)) && !plain(before.company).includes(plain(now.company));
  const titleChanged = !!before.title && !!now.title && plain(before.title) !== plain(now.title);
  return { changed: companyChanged || titleChanged, companyChanged, before, now };
}
