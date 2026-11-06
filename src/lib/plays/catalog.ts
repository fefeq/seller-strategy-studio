import type { GateDef } from "./types";

// Code catalogue of the 28 reference plays (PRD-20261106-plays-gtm, section 3). It lives in code, not in the database: it changes with
// each SDD and the tests watch it. Per-company state (enabled or not) is the only thing stored (play_states). Titles are our own words.

export const MOTIONS = [
  "entrante",
  "saliente",
  "producto",
  "cuentas",
  "reactivacion",
  "mercado",
] as const;
export type PlayMotion = (typeof MOTIONS)[number];

export const CHANNELS = [
  "email",
  "linkedin",
  "reunion",
  "llamada",
  "web",
  "producto",
  "crm",
] as const;
export type PlayChannel = (typeof CHANNELS)[number];

export const STATUSES = ["activo", "parcial", "planificado", "bloqueado"] as const;
export type PlayStatus = (typeof STATUSES)[number];

/** What blocks a play: a pending decision or an external source NOKKO does not have. */
export const BLOCKERS = [
  "linkedin_d2",
  "proveedor_datos",
  "decision_gtm",
  "fuente_externa",
] as const;
export type PlayBlocker = (typeof BLOCKERS)[number];

/** The only things a play may produce. There is no automatic send, by type and by test (G-3). */
export const OUTPUTS = ["suggestion", "task", "draft"] as const;
export type PlayOutput = (typeof OUTPUTS)[number];

export type Play = {
  id: string;
  title: string;
  motion: PlayMotion[];
  channels: PlayChannel[];
  status: PlayStatus;
  blockedBy?: PlayBlocker;
  /** Data the play needs, in words. */
  needs: string[];
  /** Ids of existing proactive rules (`detector: "<id>"` in src/lib/proactive/detectors) that belong to this play. */
  detectors: string[];
  /** True only for plays that already exist as proactive rules: they keep today's behaviour with no row in play_states. */
  defaultEnabled: boolean;
  outputs: PlayOutput[];
  /** Gates of the play. Empty in the SDD that creates the catalogue: the logic of each play is built by SDD 2 to 9. */
  gates: GateDef[];
  /** Number of the SDD of the PRD (section 8) that builds the play. */
  sdd: number;
};

type Seed = Omit<Play, "defaultEnabled" | "gates" | "outputs"> & { outputs?: PlayOutput[] };

const seed = (s: Seed): Play => ({
  ...s,
  outputs: s.outputs ?? ["suggestion"],
  defaultEnabled: s.detectors.length > 0,
  gates: [],
});

export const CATALOG: Play[] = [
  seed({
    id: "meeting-prep-and-follow-up",
    title: "Preparación y seguimiento de reuniones",
    motion: ["entrante", "cuentas"],
    channels: ["reunion", "email"],
    status: "parcial",
    needs: ["Reuniones con fecha", "Notas de llamada", "Contacto de la reunión"],
    detectors: ["meeting_no_prep", "meeting_no_notes"],
    outputs: ["suggestion", "draft"],
    sdd: 4,
  }),
  seed({
    id: "meeting-form-orchestration",
    title: "Orquestación del formulario de reunión",
    motion: ["entrante"],
    channels: ["web", "reunion", "email"],
    status: "parcial",
    needs: ["Leads de entrada", "Eventos del lead", "Asistencia a la reunión"],
    detectors: ["late_lead"],
    outputs: ["suggestion", "task"],
    sdd: 4,
  }),
  seed({
    id: "closed-lost-revival",
    title: "Reactivación de deals perdidos",
    motion: ["reactivacion"],
    channels: ["email", "crm"],
    status: "parcial",
    needs: ["Motivo de pérdida", "Fecha de cierre", "Algo que haya cambiado en la cuenta"],
    detectors: [],
    outputs: ["suggestion", "draft"],
    sdd: 3,
  }),
  seed({
    id: "signals-in-crm-with-decay",
    title: "Señales en el CRM con caída en el tiempo",
    motion: ["cuentas"],
    channels: ["crm", "web"],
    status: "parcial",
    needs: ["Señales de cuenta con fecha de publicación", "Peso por tipo de señal"],
    detectors: [],
    sdd: 2,
  }),
  seed({
    id: "signal-activation",
    title: "Activación de señales",
    motion: ["cuentas", "saliente"],
    channels: ["crm", "email"],
    status: "parcial",
    needs: ["Señales de cuenta", "Modelo de señales con peso y caída"],
    detectors: ["account_signal"],
    outputs: ["suggestion", "task"],
    sdd: 2,
  }),
  seed({
    id: "call-transcript-signal-extraction",
    title: "Extracción de señales de las llamadas",
    motion: ["cuentas"],
    channels: ["llamada", "crm"],
    status: "parcial",
    needs: ["Llamadas guardadas", "Notas de llamada", "Esquema fijo de extracción"],
    detectors: [],
    sdd: 5,
  }),
  seed({
    id: "pain-qualified-segments",
    title: "Segmentos cualificados por dolor",
    motion: ["cuentas", "mercado"],
    channels: ["llamada", "crm"],
    status: "planificado",
    needs: ["Dolor literal extraído de las llamadas", "Segmentos"],
    detectors: [],
    sdd: 5,
  }),
  seed({
    id: "hubspot-account-tiering-scoring",
    title: "Tiering y puntuación de cuentas",
    motion: ["cuentas"],
    channels: ["crm"],
    status: "parcial",
    needs: ["Deals ganados", "Puntuación por encaje con el ICP", "Tier de cuenta"],
    detectors: [],
    sdd: 6,
  }),
  seed({
    id: "crm-hygiene",
    title: "Higiene del CRM",
    motion: ["cuentas"],
    channels: ["crm"],
    status: "parcial",
    needs: ["Cuentas y personas", "Reglas de duplicados", "Catálogo de campos"],
    detectors: ["account_missing_key"],
    sdd: 6,
  }),
  seed({
    id: "plg-to-sales",
    title: "Del uso de producto a ventas",
    motion: ["producto"],
    channels: ["producto", "email"],
    status: "parcial",
    needs: ["Altas y pruebas (trials)", "Uso de producto", "Encaje con el ICP"],
    detectors: ["product_qualified", "usage_drop", "trial_conversion"],
    outputs: ["suggestion", "task"],
    sdd: 7,
  }),
  seed({
    id: "product-sign-up-outreach",
    title: "Contacto a cada registro de producto",
    motion: ["producto", "entrante"],
    channels: ["email", "producto"],
    status: "parcial",
    needs: ["Registros nuevos (trials)", "Flujo de leads"],
    detectors: [],
    outputs: ["draft"],
    sdd: 7,
  }),
  seed({
    id: "multi-thread-inbound-leads",
    title: "Varios contactos en un lead entrante",
    motion: ["entrante", "cuentas"],
    channels: ["email", "crm"],
    status: "parcial",
    // The extra contact needs Apollo/Clay or LinkedIn (PRD), but CA-3 reserves `blockedBy` for blocked plays: it stays a need.
    needs: ["Interlocutores de la cuenta", "Contacto adicional vía Apollo o Clay"],
    detectors: ["no_decision_maker"],
    outputs: ["suggestion", "task"],
    sdd: 7,
  }),
  seed({
    id: "website-visitor-de-anonymization",
    title: "Identificar visitas anónimas de la web",
    motion: ["entrante"],
    channels: ["web"],
    status: "bloqueado",
    blockedBy: "proveedor_datos",
    needs: ["Fuente de visitas identificadas"],
    detectors: [],
    sdd: 8,
  }),
  seed({
    id: "review-site-intent-scoring",
    title: "Intención desde sitios de reseñas",
    motion: ["cuentas", "saliente"],
    channels: ["web"],
    status: "bloqueado",
    blockedBy: "proveedor_datos",
    needs: ["Alertas de intención de sitios de reseñas"],
    detectors: [],
    sdd: 8,
  }),
  seed({
    id: "new-hire-tracking",
    title: "Seguimiento de fichajes y cambios de puesto",
    motion: ["saliente", "cuentas"],
    channels: ["linkedin"],
    status: "bloqueado",
    blockedBy: "linkedin_d2",
    needs: ["Cambios de puesto de las personas clave"],
    detectors: [],
    sdd: 8,
  }),
  seed({
    id: "hiring-signal-monitoring",
    title: "Vigilancia de ofertas de empleo",
    motion: ["cuentas", "saliente"],
    channels: ["linkedin", "web"],
    status: "bloqueado",
    blockedBy: "linkedin_d2",
    needs: ["Ofertas de empleo de cada cuenta", "Apify activo"],
    detectors: [],
    sdd: 8,
  }),
  seed({
    id: "funding-signal-scraping",
    title: "Señales de financiación",
    motion: ["cuentas", "saliente"],
    channels: ["web"],
    status: "bloqueado",
    blockedBy: "fuente_externa",
    needs: ["Revisión semanal de fuentes de financiación por ICP"],
    detectors: [],
    sdd: 8,
  }),
  seed({
    id: "tech-stack-signal-detection",
    title: "Señales de tecnología de la cuenta",
    motion: ["cuentas", "saliente"],
    channels: ["web"],
    status: "bloqueado",
    blockedBy: "proveedor_datos",
    needs: ["Tecnología de cada cuenta y sus altas y bajas"],
    detectors: [],
    sdd: 8,
  }),
  seed({
    id: "brand-mentions-monitoring",
    title: "Menciones de marca",
    motion: ["saliente"],
    channels: ["linkedin"],
    status: "bloqueado",
    blockedBy: "linkedin_d2",
    needs: ["Monitorización de menciones"],
    detectors: [],
    sdd: 8,
  }),
  seed({
    id: "competitor-post-engagers",
    title: "Quién interactúa con publicaciones de competidores",
    motion: ["saliente"],
    channels: ["linkedin"],
    status: "bloqueado",
    blockedBy: "linkedin_d2",
    needs: ["Personas que interactúan con los competidores"],
    detectors: [],
    sdd: 8,
  }),
  seed({
    id: "target-account-exec-posts",
    title: "Publicaciones de ejecutivos de cuentas objetivo",
    motion: ["cuentas", "saliente"],
    channels: ["linkedin"],
    status: "bloqueado",
    blockedBy: "linkedin_d2",
    needs: ["Lista de vigilancia de ejecutivos"],
    detectors: [],
    sdd: 8,
  }),
  seed({
    id: "founder-connections-mining",
    title: "Red de conexiones del fundador",
    motion: ["saliente"],
    channels: ["linkedin"],
    status: "bloqueado",
    blockedBy: "linkedin_d2",
    needs: ["Exportación de LinkedIn de la propia persona"],
    detectors: [],
    sdd: 8,
  }),
  seed({
    id: "webinar-attendee-capture",
    title: "Captura de asistentes a webinars y eventos",
    motion: ["entrante"],
    channels: ["email", "web"],
    status: "bloqueado",
    blockedBy: "fuente_externa",
    needs: ["Herramienta de webinars sin decidir", "Importación de leads"],
    detectors: [],
    sdd: 8,
  }),
  seed({
    id: "automated-reply-enrichment",
    title: "Enriquecimiento automático de respuestas",
    motion: ["entrante", "saliente"],
    channels: ["email"],
    status: "bloqueado",
    blockedBy: "fuente_externa",
    needs: ["Bandeja de respuestas entrantes"],
    detectors: [],
    sdd: 8,
  }),
  seed({
    id: "abm-ads",
    title: "ABM: del ICP al mercado total",
    motion: ["cuentas", "mercado"],
    channels: ["web", "crm"],
    status: "bloqueado",
    blockedBy: "fuente_externa",
    needs: ["ICP", "Cuentas descubiertas", "Plataformas de anuncios (fuera de alcance)"],
    detectors: [],
    sdd: 8,
  }),
  seed({
    id: "public-records-signals",
    title: "Señales de registros públicos",
    motion: ["mercado", "cuentas"],
    channels: ["web"],
    status: "bloqueado",
    blockedBy: "decision_gtm",
    needs: ["Consulta de registros públicos por calendario"],
    detectors: [],
    sdd: 9,
  }),
  seed({
    id: "public-filings-qualification",
    title: "Cualificación con registros públicos",
    motion: ["mercado", "cuentas"],
    channels: ["web"],
    status: "bloqueado",
    blockedBy: "decision_gtm",
    needs: ["Hecho de registro público sobre la cuenta"],
    detectors: [],
    sdd: 9,
  }),
  seed({
    id: "local-business-tam",
    title: "Mercado local desde directorios",
    motion: ["mercado"],
    channels: ["web"],
    status: "bloqueado",
    blockedBy: "decision_gtm",
    needs: ["Directorios de negocios locales"],
    detectors: [],
    sdd: 9,
  }),
];

/** The play that owns a proactive detector, or undefined when the rule belongs to no play (always on). */
export function detectorOwner(detector: string): string | undefined {
  return CATALOG.find((p) => p.detectors.includes(detector))?.id;
}
