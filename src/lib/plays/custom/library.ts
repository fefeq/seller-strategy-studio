// NK-0171 SDD 2 (SDD-20261113-plays-a-medida-biblioteca): the «De NOKKO» reference library.
// Read-only, in code. Recipes start from competitors the company declares and reach accounts only through data
// Nokko already stores (account_plans.competitors, deals.lost_competitor); with none, the signal is a company-level
// suggestion with contact «sin dato». Wording is Nokko's own (anti-copy test against the PRD annex).

import { likeness } from "@/lib/match";
import type { CitedMessage, FreshnessWindow, SourceKey, Step } from "./model";

export const ORIGIN_LABEL = { biblioteca: "De NOKKO", a_medida: "Creado para tu empresa" } as const;

export type Recipe = {
  id: string;
  title: string;
  hook: string;
  trigger: string;
  window: FreshnessWindow;
  steps: Step[];
  message: CitedMessage;
  test: { n: number; k: number; base: number };
  /** Whether the person who wrote the signal is contacted. Never for reviews or forum posts. */
  contactsAuthor: boolean;
  target: "accounts_naming_competitor" | "company_or_account_named";
};

const freeze = <T>(xs: T[]): readonly T[] => Object.freeze(xs.map((x) => Object.freeze(x)));

export const LIBRARY: readonly Recipe[] = freeze<Recipe>([
  {
    id: "nokko:r1",
    title: "Un competidor declarado cierra o abandona una línea de producto",
    hook: "Sus clientes tendrán que decidir pronto adónde migrar",
    trigger:
      "Aviso público de fin de soporte, retirada o cambio de plan en la documentación, el registro de cambios o la prensa del competidor",
    window: { backDays: 60, forwardDays: 365 },
    steps: [
      {
        n: 1,
        source: "competitors",
        question: "¿Qué competidores declara la empresa?",
        returns: ["competitor"],
      },
      {
        n: 2,
        source: "news",
        question: "¿Ha anunciado alguno una retirada o fin de soporte, y en qué fecha?",
        returns: ["event_date", "headline_kind"],
      },
      {
        n: 3,
        source: "people",
        question: "¿Quién decide en las cuentas que usan ese competidor?",
        returns: ["seniority", "department"],
      },
    ],
    message: {
      claims: [
        { text: "El competidor ha publicado la retirada del producto con fecha", step: 2 },
        { text: "Tu cuenta lo menciona en su plan o en un negocio perdido", step: 1 },
      ],
      built: "Una comparación de migración con los pasos y plazos para salir sin perder datos",
      ask: "¿Te paso la comparación para que la revise tu equipo?",
    },
    test: { n: 20, k: 2, base: 20 },
    contactsAuthor: false,
    target: "accounts_naming_competitor",
  },
  {
    id: "nokko:r2",
    title: "Las reseñas públicas de un competidor repiten el mismo motivo de queja",
    hook: "El motivo de cambio más citado se convierte en tu argumento",
    trigger:
      "Reseñas públicas recientes del competidor que repiten un motivo de cambio o una carencia",
    window: { backDays: 90, forwardDays: 0 },
    steps: [
      {
        n: 1,
        source: "competitors",
        question: "¿Qué competidores declara la empresa?",
        returns: ["competitor"],
      },
      {
        n: 2,
        source: "reviews",
        question: "¿Qué motivo de cambio se repite en sus reseñas recientes?",
        returns: ["event_date", "rating"],
      },
      {
        n: 3,
        source: "people",
        question: "¿Quién decide en las cuentas que usan ese competidor?",
        returns: ["seniority", "department"],
      },
    ],
    message: {
      claims: [
        { text: "Varias reseñas recientes del competidor señalan la misma carencia", step: 2 },
      ],
      built: "Una nota breve de cómo resolvemos esa carencia, con un caso comparable",
      ask: "¿Lo vemos quince minutos esta semana?",
    },
    test: { n: 20, k: 2, base: 20 },
    contactsAuthor: false,
    target: "accounts_naming_competitor",
  },
  {
    id: "nokko:r3",
    title: "Una empresa explica en público un problema que tu producto resuelve",
    hook: "Lo ha contado con nombre propio: hay una conversación que abrir",
    trigger:
      "Publicación firmada (medio, blog de empresa, nota de prensa o comunidad con nombre real) que describe el problema",
    window: { backDays: 45, forwardDays: 0 },
    steps: [
      {
        n: 1,
        source: "news",
        question: "¿Qué empresa o rol con nombre real describe este problema y cuándo?",
        returns: ["event_date", "headline_kind"],
      },
      {
        n: 2,
        source: "web",
        question: "¿Qué dice exactamente la publicación?",
        returns: ["event_date", "industry"],
      },
      {
        n: 3,
        source: "people",
        question: "¿Quién decide en esa empresa?",
        returns: ["seniority", "department"],
      },
    ],
    message: {
      claims: [
        { text: "La empresa ha descrito el problema en una publicación con fecha", step: 1 },
      ],
      built: "Un esquema de cómo lo resolvería tu equipo en su caso",
      ask: "¿Te encaja que te lo enseñe?",
    },
    test: { n: 20, k: 2, base: 20 },
    contactsAuthor: false,
    target: "company_or_account_named",
  },
]);

export const recipeSources = (r: Recipe): SourceKey[] => [...new Set(r.steps.map((s) => s.source))];

/** Free-text competitor list → names («A, B; C y D», one per line too). */
export function splitCompetitors(raw: string | null | undefined): string[] {
  return (raw ?? "")
    .split(/[,;\n/]|\s+y\s+|\s+and\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

const SAME = 95;
const names = (competitor: string, text: string | null) =>
  splitCompetitors(text).some((n) => likeness({ name: competitor }, { id: "", name: n }) >= SAME);

/** Accounts whose plan or lost deal names the competitor (match.ts «same» rule). Never invents. */
export function accountsForCompetitor(
  competitor: string,
  d: {
    plans: Array<{ account_id: string | null; competitors: string | null }>;
    lostDeals: Array<{ account_id: string | null; lost_competitor: string | null }>;
  },
): string[] {
  const ids = new Set<string>();
  for (const p of d.plans)
    if (p.account_id && names(competitor, p.competitors)) ids.add(p.account_id);
  for (const l of d.lostDeals)
    if (l.account_id && names(competitor, l.lost_competitor)) ids.add(l.account_id);
  return [...ids];
}

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
/** Plays that depend on declared competitors: the query names them in quotes and a signal only counts
 *  when its title, snippet or URL names one of them as a whole word. Generic news never passes. */
export function competitorQuery(base: string, competitors: string[]): string {
  return competitors.length ? `${competitors.map((c) => `"${c}"`).join(" OR ")} ${base}` : base;
}
export function namesCompetitor(
  s: { title?: string | null; snippet?: string | null; url?: string | null },
  competitors: string[],
): boolean {
  const text = fold(`${s.title ?? ""} ${s.snippet ?? ""} ${s.url ?? ""}`);
  return competitors.some((c) => {
    const n = fold(c.trim());
    if (n.length < 2) return false;
    const esc = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`).test(text);
  });
}
