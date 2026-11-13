// Orchestrator: the user asks for a need, Nokko picks the services. Pure (tested in planner.test.ts).
// Catalogue of needs → services with rough cost (EUR), speed and quality; the planner orders them.

import type { KeyEntity, KeyNeed } from "@/lib/fit-key";

export type Service =
  | "apollo"
  | "clay"
  | "parallel"
  | "firecrawl"
  | "perplexity"
  | "apify"
  | "drive"
  | "posthog"
  | "stripe"
  | "ai";
export type Need =
  | "research_account"
  | "find_stakeholders"
  | "enrich_account"
  | "enrich_contact"
  | "find_email"
  | "find_phone"
  | "news_signals"
  | "icp_companies"
  | "case_studies"
  | "competitors"
  | "read_document";

export type NeedKey = { entity: KeyEntity; need?: KeyNeed } | null;
/**
 * The key each need asks fit-key for before any provider is called (exhaustive by type). Account needs need the
 * account domain; contact needs, an identifiable person; the rest search by topic or read a file and need none.
 */
export const NEED_KEYS: Record<Need, NeedKey> = {
  research_account: { entity: "cuenta", need: "research_account" },
  find_stakeholders: { entity: "cuenta", need: "find_stakeholders" },
  enrich_account: { entity: "cuenta", need: "enrich_account" },
  enrich_contact: { entity: "persona" },
  find_email: { entity: "persona" },
  find_phone: { entity: "persona" },
  news_signals: null,
  icp_companies: null,
  case_studies: null,
  competitors: null,
  read_document: null,
};

export type Option = { service: Service; cost: number; speed: 1 | 2 | 3; quality: 1 | 2 | 3 };

export const CAPABILITIES: Record<Need, { label: string; options: Option[] }> = {
  research_account: {
    label: "Investigar una cuenta",
    options: [
      { service: "firecrawl", cost: 0.02, speed: 3, quality: 2 },
      { service: "perplexity", cost: 0.01, speed: 3, quality: 2 },
      { service: "parallel", cost: 0.3, speed: 1, quality: 3 },
    ],
  },
  find_stakeholders: {
    label: "Encontrar stakeholders",
    options: [
      { service: "apollo", cost: 0, speed: 3, quality: 2 },
      { service: "clay", cost: 0.1, speed: 2, quality: 3 },
      { service: "firecrawl", cost: 0.02, speed: 2, quality: 1 },
    ],
  },
  enrich_account: {
    label: "Completar datos de una cuenta",
    options: [
      { service: "apollo", cost: 0.02, speed: 3, quality: 2 },
      { service: "parallel", cost: 0.05, speed: 2, quality: 3 },
      { service: "clay", cost: 0.1, speed: 2, quality: 3 },
    ],
  },
  enrich_contact: {
    label: "Completar datos de un contacto",
    options: [
      { service: "apollo", cost: 0.02, speed: 3, quality: 2 },
      { service: "clay", cost: 0.1, speed: 2, quality: 3 },
    ],
  },
  find_email: {
    label: "Conseguir un email",
    options: [
      { service: "apollo", cost: 0.02, speed: 3, quality: 3 },
      { service: "clay", cost: 0.1, speed: 2, quality: 3 },
    ],
  },
  find_phone: {
    label: "Conseguir un teléfono",
    options: [{ service: "apollo", cost: 0.15, speed: 1, quality: 3 }],
  },
  news_signals: {
    label: "Noticias y señales",
    options: [
      { service: "perplexity", cost: 0.01, speed: 3, quality: 2 },
      { service: "firecrawl", cost: 0.02, speed: 3, quality: 2 },
      { service: "apify", cost: 0.05, speed: 1, quality: 2 },
    ],
  },
  icp_companies: {
    label: "Buscar empresas por ICP",
    options: [
      { service: "apollo", cost: 0.05, speed: 3, quality: 2 },
      { service: "parallel", cost: 0.3, speed: 1, quality: 3 },
      { service: "clay", cost: 0.2, speed: 2, quality: 3 },
    ],
  },
  case_studies: {
    label: "Casos de éxito",
    options: [
      { service: "perplexity", cost: 0.01, speed: 3, quality: 2 },
      { service: "firecrawl", cost: 0.02, speed: 3, quality: 2 },
    ],
  },
  competitors: {
    label: "Analizar competidores",
    options: [
      { service: "perplexity", cost: 0.01, speed: 3, quality: 2 },
      { service: "firecrawl", cost: 0.02, speed: 3, quality: 2 },
      { service: "apify", cost: 0.05, speed: 1, quality: 3 },
    ],
  },
  read_document: {
    label: "Leer un documento",
    options: [{ service: "drive", cost: 0, speed: 3, quality: 3 }],
  },
};

export type PlanInput = {
  need: Need;
  connected: Service[];
  /** Services that already answered this need for this record (cached data counts as free). */
  alreadyHave?: Service[];
  depth?: "quick" | "deep";
  budget: { remaining: number; automatic: boolean; paused: boolean };
};
export type Plan = {
  steps: Option[];
  skipped: { service: Service; reason: string }[];
  blocked: string | null;
};

/** Orders the services for a need: free/cached first; quick favours speed, deep favours quality; respects the budget. */
export function planFor(input: PlanInput): Plan {
  const cap = CAPABILITIES[input.need];
  const skipped: Plan["skipped"] = [];
  if (input.budget.automatic && input.budget.paused)
    return {
      steps: [],
      skipped,
      blocked:
        "Límite mensual alcanzado: lo automático está en pausa hasta el mes que viene o hasta que el Owner lo suba.",
    };
  const usable = cap.options.filter((o) => {
    if (!input.connected.includes(o.service)) {
      skipped.push({ service: o.service, reason: "no conectado" });
      return false;
    }
    if (input.alreadyHave?.includes(o.service)) {
      skipped.push({ service: o.service, reason: "ya hay datos" });
      return false;
    }
    // Q-6 (NK-0173): manual actions are never paused by the limit — the person confirmed the cost;
    // they still log their spend. Only automatic work skips options over the remaining budget.
    if (input.budget.automatic && o.cost > input.budget.remaining) {
      skipped.push({ service: o.service, reason: "sin presupuesto" });
      return false;
    }
    return true;
  });
  const deep = input.depth === "deep";
  const score = (o: Option) =>
    (o.cost === 0 ? 100 : 0) +
    (deep ? o.quality * 10 + o.speed : o.speed * 10 + o.quality) -
    o.cost;
  const steps = [...usable].sort((a, b) => score(b) - score(a));
  return {
    steps,
    skipped,
    blocked: steps.length ? null : "Ningún servicio conectado puede cubrir esto ahora.",
  };
}

/** Budget state: warn at 80 %, pause automatic work at 100 %; manual requests are never paused (planFor enforces it). */
export function budgetState(spent: number, limit: number | null) {
  if (!limit || limit <= 0) return { remaining: Infinity, warn: false, paused: false, pct: 0 };
  const pct = spent / limit;
  return { remaining: Math.max(0, limit - spent), warn: pct >= 0.8, paused: pct >= 1, pct };
}

export function sourcesLine(used: { service: Service; cost: number }[]) {
  if (!used.length) return "";
  const total = used.reduce((s, u) => s + u.cost, 0);
  const names = [...new Set(used.map((u) => u.service))]
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join(", ");
  return `Fuentes: ${names} · coste aprox. ${total.toFixed(2).replace(".", ",")} €`;
}
