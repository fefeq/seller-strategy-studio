// Apify rules that need no network (tested in apify.test.ts): which robots (Actors) Nokko runs and how much
// each run may spend, LinkedIn/G2 links, and how raw results become posts, job offers and reviews.
import type { NewsItem } from "@/lib/web-research";

/** Robots used, chosen for no-cookie access and pay-per-result pricing. maxUsd caps the spend of one run. */
export const ACTORS = {
  companyPosts: { id: "harvestapi~linkedin-company-posts", maxUsd: 0.05 },
  profilePosts: { id: "harvestapi~linkedin-profile-posts", maxUsd: 0.03 },
  jobs: { id: "valig~linkedin-jobs-scraper", maxUsd: 0.05 },
  g2: { id: "automation-lab~g2-scraper", maxUsd: 0.3 },
} as const;

const slugOf = (raw: string, kind: "company" | "in" | "school" | "showcase") => {
  let u: URL;
  try { u = new URL(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`); } catch { return null; }
  if (!/(^|\.)linkedin\.com$/i.test(u.hostname)) return null;
  const m = u.pathname.match(new RegExp(`^/${kind}/([^/?#]+)`, "i"));
  return m?.[1] ? decodeURIComponent(m[1]) : null;
};

/** Canonical LinkedIn company page (https://www.linkedin.com/company/<slug>/), or null. */
export function linkedinCompanyUrl(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const slug = slugOf(raw, "company") ?? slugOf(raw, "showcase") ?? slugOf(raw, "school");
  return slug ? `https://www.linkedin.com/company/${encodeURIComponent(slug)}/` : null;
}

/** Canonical LinkedIn profile (https://www.linkedin.com/in/<slug>/), or null. */
export function linkedinProfileUrl(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const slug = slugOf(raw, "in");
  return slug ? `https://www.linkedin.com/in/${encodeURIComponent(slug)}/` : null;
}

/** The first LinkedIn company page among search results. */
export const pickLinkedinCompany = (results: { url: string }[]) => results.map((r) => linkedinCompanyUrl(r.url)).find((u): u is string => !!u) ?? null;

const clipText = (s: unknown, n: number) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
};

export type Post = { url: string; text: string; date: string | null; author: string; repost: boolean; likes: number | null };

/** LinkedIn posts (company or person), newest first, without empty ones. */
export function postItems(raw: unknown, max = 10): Post[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: Post[] = [];
  for (const p of list as Record<string, any>[]) {
    const url = String(p?.linkedinUrl ?? p?.shareLinkedinUrl ?? "");
    const text = clipText(p?.content, 1200);
    if (!/^https:\/\//.test(url) || !text) continue;
    out.push({ url, text, date: p?.postedAt?.date ?? null, author: String(p?.author?.name ?? ""), repost: !!p?.repostedBy, likes: p?.engagement?.likes == null || !Number.isFinite(Number(p.engagement.likes)) ? null : Number(p.engagement.likes) });
  }
  return out.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")).slice(0, max);
}

export type Job = { url: string; title: string; location: string; date: string | null; level: string; description: string };

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/** Job offers of this company only (by LinkedIn page when known, else exact name), newest first. */
export function jobItems(raw: unknown, company: string, companyUrl?: string | null, max = 15): Job[] {
  const want = linkedinCompanyUrl(companyUrl);
  const list = (Array.isArray(raw) ? raw : []) as Record<string, any>[];
  return list
    .filter((j) => {
      const page = linkedinCompanyUrl(String(j?.companyUrl ?? ""));
      return want && page ? page === want : norm(String(j?.companyName ?? "")) === norm(company);
    })
    .filter((j) => /^https:\/\//.test(String(j?.url ?? "")) && String(j?.title ?? "").trim())
    .map((j) => ({ url: String(j.url).split("?")[0]!, title: clipText(j.title, 160), location: clipText(j.location, 80), date: j.postedDate ?? null, level: clipText(j.experienceLevel, 40), description: clipText(j.description, 500) }))
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
    .slice(0, max);
}

/** Posts and job offers in the shape the signal classifier reads. */
export function linkedinNews(posts: Post[], jobs: Job[]): NewsItem[] {
  return [
    ...posts.filter((p) => !p.repost).map((p) => ({ title: clipText(p.text, 140), url: p.url, snippet: clipText(p.text, 600), date: p.date, source: "LinkedIn" })),
    ...jobs.map((j) => ({ title: `Oferta de empleo: ${j.title}${j.location ? ` (${j.location})` : ""}`, url: j.url, snippet: [j.level, j.description].filter(Boolean).join(" · "), date: j.date, source: "LinkedIn Empleo" })),
  ];
}

/** A G2 product's reviews page from a G2 link or slug; null for anything else. */
export function g2ReviewsUrl(raw: string): string | null {
  const s = raw.trim();
  const m = s.match(/^(?:https?:\/\/)?(?:www\.)?g2\.com\/products\/([a-z0-9-]+)/i);
  return m?.[1] ? `https://www.g2.com/products/${m[1].toLowerCase()}/reviews` : null;
}

export type Review = { url: string | null; title: string; rating: number | null; text: string; date: string | null; country: string; switchedReason: string };

export function reviewItems(raw: unknown, max = 50): Review[] {
  const list = (Array.isArray(raw) ? raw : []) as Record<string, any>[];
  return list
    .filter((r) => String(r?.reviewText ?? "").trim())
    .map((r) => ({ url: r.url ?? null, title: clipText(r.title, 160), rating: Number.isFinite(Number(r.starRating)) ? Number(r.starRating) : null, text: clipText(r.reviewText, 1500), date: r.publishedAt ?? null, country: clipText(r.country, 40), switchedReason: clipText(r.switchedReason, 300) }))
    .slice(0, max);
}

/** The G2 product that best matches the competitor name (exact name first, else the first result). */
export function pickG2Product(products: unknown, name: string): { name: string; url: string } | null {
  const list = ((Array.isArray(products) ? products : []) as Record<string, any>[]).filter((p) => p?.slug && p?.name);
  const exact = list.find((p) => norm(p.name) === norm(name)) ?? list.find((p) => norm(p.name).startsWith(norm(name))) ?? list[0];
  return exact ? { name: String(exact.name), url: `https://www.g2.com/products/${exact.slug}/reviews` } : null;
}

/** Average stars of the reviews, one decimal; null without ratings. */
export function averageRating(reviews: Review[]): number | null {
  const r = reviews.map((x) => x.rating).filter((x): x is number => x !== null);
  return r.length ? Math.round((r.reduce((a, b) => a + b, 0) / r.length) * 10) / 10 : null;
}

/** Spanish «qué pasó + qué hacer» for a failed Apify call. */
export function apifyErrorText(status: number, body = ""): string {
  if (/usage|limit|exceeded|credit|insufficient|payment/i.test(body) && (status === 402 || status === 403 || status === 429)) return "Se ha agotado el saldo mensual de Apify. Amplía el plan o espera al próximo mes.";
  if (status === 401) return "La conexión con Apify no es válida. Vuelve a conectarla en Integraciones.";
  if (status === 402) return "Se ha agotado el saldo mensual de Apify. Amplía el plan o espera al próximo mes.";
  if (status === 404) return "El robot de Apify no está disponible ahora mismo. Inténtalo más tarde.";
  if (status === 408 || status === 504) return "Apify ha tardado demasiado. Vuelve a probar en un momento.";
  if (status === 400) return "Apify no ha aceptado la búsqueda. Revisa el enlace o el nombre.";
  if (status === 429) return "Apify está limitando las peticiones. Inténtalo en un minuto.";
  return "Apify no ha respondido. Inténtalo de nuevo en un momento.";
}
