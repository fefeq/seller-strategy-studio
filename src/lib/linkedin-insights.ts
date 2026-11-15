// A+ (PLAN-UX-20261115): what NOKKO reads out of LinkedIn data it already pays for. Pure, tested.
// Growth signals from open job offers (which teams hire, how senior) and engagement from posts (likes).
import type { Job, Post } from "@/lib/apify";

export type HiringTeam = "Ventas" | "Marketing" | "Ingeniería" | "Producto" | "Datos" | "Operaciones" | "Finanzas" | "Personas" | "Atención al cliente" | "Otros";

const TEAM_RULES: [HiringTeam, RegExp][] = [
  ["Ventas", /\b(sales|ventas|account executive|sdr|bdr|business development|comercial|account manager)\b/i],
  ["Marketing", /\b(marketing|growth|seo|content|brand|demand gen|comunicaci[oó]n)\b/i],
  ["Datos", /\b(data|datos|analytics|analyst|bi|machine learning|ml|ai engineer)\b/i],
  ["Ingeniería", /\b(engineer|developer|desarrollador|ingenier|devops|backend|frontend|full ?stack|software|sre|qa)\b/i],
  ["Producto", /\b(product|producto|ux|ui|designer|dise[nñ]ador)\b/i],
  ["Atención al cliente", /\b(customer success|support|soporte|atenci[oó]n al cliente|cs manager)\b/i],
  ["Finanzas", /\b(finance|finanzas|accountant|contable|controller|cfo)\b/i],
  ["Personas", /\b(hr|people|talent|recruit|rrhh|recursos humanos)\b/i],
  ["Operaciones", /\b(operations|operaciones|ops|logistic|log[ií]stica|supply)\b/i],
];

export function hiringTeam(title: string): HiringTeam {
  return TEAM_RULES.find(([, re]) => re.test(title))?.[0] ?? "Otros";
}

const SENIOR = /\b(head|director|vp|vice president|chief|c[teo]o|lead|principal|jefe|responsable)\b/i;

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
  if (!own.length) return { posts: 0, avgLikes: null, top: null };
  const total = own.reduce((s, p) => s + p.likes, 0);
  const best = own.reduce((a, b) => (b.likes > a.likes ? b : a));
  return { posts: own.length, avgLikes: Math.round(total / own.length), top: { url: best.url, likes: best.likes } };
}
