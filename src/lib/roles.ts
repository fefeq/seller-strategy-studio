export const ROLES = {
  owner: { label: "GTM Owner / RevOps", focus: "Aprobaciones, reglas, skills y salud del sistema" },
  sales_leader: { label: "Sales Leader", focus: "Pipeline, forecast y deals en riesgo" },
  marketing: { label: "Marketing / Demand Gen", focus: "Campañas, fuentes y rendimiento" },
  sdr: { label: "SDR / BDR", focus: "Cola de leads, secuencias y research" },
  ae: { label: "Account Executive", focus: "Mis deals, planes de cuenta y reuniones" },
  se: { label: "Sales Engineer", focus: "Demos técnicas y POCs por deal" },
  cs: { label: "Customer Success / AM", focus: "Salud de cuentas, renovación y expansión" },
  deal_desk: { label: "Deal Desk / Finanzas / Legal", focus: "Descuentos y contratos" },
  enablement: { label: "Sales Enablement", focus: "Playbooks, objeciones y battlecards" },
} as const;
export type Role = keyof typeof ROLES;

export const DEAL_STAGES = [
  { id: "discovery", label: "Discovery" },
  { id: "qualified", label: "Cualificado" },
  { id: "demo", label: "Demo / POC" },
  { id: "proposal", label: "Propuesta" },
  { id: "negotiation", label: "Negociación" },
  { id: "won", label: "Ganado" },
  { id: "lost", label: "Perdido" },
] as const;

export const MEDDPICC = [
  ["metrics", "Metrics", "¿Qué impacto cuantificable busca el cliente?"],
  ["economic_buyer", "Economic buyer", "¿Quién firma y tiene presupuesto?"],
  ["decision_criteria", "Decision criteria", "¿Con qué criterios evaluarán?"],
  ["decision_process", "Decision process", "¿Qué pasos y plazos hay hasta decidir?"],
  ["paper_process", "Paper process", "¿Legal, compras, seguridad?"],
  ["identify_pain", "Identify pain", "¿Qué dolor urgente resolvemos?"],
  ["champion", "Champion", "¿Quién vende por nosotros dentro?"],
  ["competition", "Competition", "¿Contra quién competimos (incl. no hacer nada)?"],
] as const;

export const BUYING_ROLES: Record<string, string> = {
  decision_maker: "Decisor",
  champion: "Champion",
  influencer: "Influenciador",
  blocker: "Bloqueador",
  user: "Usuario",
};
export const SUPPORT: Record<string, string> = {
  advocate: "A favor",
  neutral: "Neutral",
  skeptic: "Escéptico",
  opponent: "En contra",
};
export const SOURCES: Record<string, string> = {
  cold_list: "Lista fría",
  post_engager: "Interacción en post",
  website_visitor: "Visita web",
  referral: "Referido",
  inbound: "Inbound",
};
export const CAMPAIGN_RESULTS: Record<string, string> = {
  sent: "Enviado",
  opened: "Abierto",
  replied: "Respondió",
  booked: "Reservó reunión",
  bounced: "Rebotado",
  unsubscribed: "Baja",
};

/** Only owners may delete records. */
export function canDelete(roles: string[]) {
  return roles.includes("owner");
}
/** Who may apply or skip approvals. */
export function canDecideApprovals(roles: string[]) {
  return roles.some((r) => r === "owner" || r === "sales_leader" || r === "deal_desk");
}
