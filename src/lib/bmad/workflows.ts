// Workflows launched from persona menus. Artifact workflows produce a versioned document
// in the GTM cycle; the rest are guided agent conversations.
export type ArtifactKind = "brief" | "plan" | "architecture" | "readiness" | "retro" | "winloss";
export type PhaseId = "analysis" | "plan" | "architecture" | "execution" | "retro";

export type Workflow = {
  id: string;
  label: string;
  phase: PhaseId;
  produces?: ArtifactKind;
  requires?: ArtifactKind[]; // approved artifacts needed first
  instructions: string;
};

export const ARTIFACTS: Record<ArtifactKind, { label: string; phase: PhaseId; sections: string[] }> = {
  brief: { label: "GTM Brief", phase: "analysis", sections: ["Problema", "Mercado y tamaño", "Cliente ideal", "Alternativas actuales", "Nuestra apuesta", "Riesgos y supuestos"] },
  plan: { label: "Plan GTM", phase: "plan", sections: ["Objetivos del periodo", "Segmentos y motion por ACV", "Posicionamiento y mensajes", "Canales y fuentes de pipeline", "Cuotas y cobertura", "Apuestas y experimentos", "Fuera de alcance"] },
  architecture: { label: "Arquitectura de revenue", phase: "architecture", sections: ["Motions y etapas", "Capacidad (AEs, SDRs, SEs)", "Cobertura y pipeline necesario", "Territorios y asignación", "Playbooks por segmento", "Stack y herramientas", "Métricas y cadencias"] },
  readiness: { label: "Revisión antes de salir al mercado", phase: "architecture", sections: ["Veredicto (listo / listo con riesgos / no listo)", "Alineación plan ↔ capacidad", "Alineación mensajes ↔ ICP", "Huecos críticos", "Acciones antes de lanzar"] },
  retro: { label: "Retro trimestral", phase: "retro", sections: ["Resultado frente a objetivo", "Qué funcionó", "Qué no funcionó", "Aprendizajes de win/loss", "Cambios propuestos al Brief y al Plan"] },
  winloss: { label: "Win/Loss", phase: "retro", sections: ["Resultado y motivo principal", "Qué hicimos bien", "Qué falló", "Competencia", "Lección para el playbook"] },
};

export const WORKFLOWS: Workflow[] = [
  { id: "brief", label: "GTM Brief", phase: "analysis", produces: "brief", instructions: "Redacta el GTM Brief a partir del contexto de empresa." },
  { id: "market_research", label: "Investigar mercado", phase: "analysis", instructions: "Investiga el mercado: tamaño, tendencias, compradores y señales. Termina proponiendo qué incluir en el GTM Brief." },
  { id: "competitor", label: "Análisis de competidor", phase: "analysis", instructions: "Pregunta qué competidor analizar y haz un teardown: propuesta, precio, a quién gana, dónde es débil y cómo diferenciarnos." },
  { id: "voice_of_customer", label: "Voz del cliente", phase: "analysis", instructions: "Revisa reuniones, notas de sensing y win/loss para extraer patrones de la voz del cliente." },
  { id: "company_context", label: "Contexto de empresa", phase: "analysis", instructions: "Revisa el estado de la configuración y propone completar lo que falta del contexto de empresa." },
  { id: "plan", label: "Plan GTM", phase: "plan", produces: "plan", requires: ["brief"], instructions: "Redacta el Plan GTM a partir del Brief aprobado y los datos de la empresa." },
  { id: "validate_plan", label: "Validar plan", phase: "plan", requires: ["plan"], instructions: "Valida el Plan GTM: coherencia de objetivos, cobertura 3–4x, motion por ACV y huecos. Haz un pre-mortem breve." },
  { id: "architecture", label: "Arquitectura de revenue", phase: "architecture", produces: "architecture", requires: ["plan"], instructions: "Diseña la arquitectura de revenue que hace posible el Plan GTM." },
  { id: "capacity", label: "Plan de capacidad", phase: "architecture", instructions: "Calcula la capacidad necesaria (deals, oportunidades, AEs) con los benchmarks de los segmentos." },
  { id: "readiness", label: "Listos para salir", phase: "architecture", produces: "readiness", requires: ["plan", "architecture"], instructions: "Evalúa si Plan, Arquitectura y mensajes están alineados para salir al mercado." },
  { id: "pricing", label: "Pricing y descuentos", phase: "execution", instructions: "Revisa la política de precios y descuentos, y su impacto en margen y payback." },
  { id: "unit_economics", label: "Unit economics", phase: "plan", instructions: "Analiza CAC, payback y margen por segmento con los datos guardados." },
  { id: "deal_approval", label: "Aprobación de deal", phase: "execution", instructions: "Pide el deal y evalúa si aprobar descuento o condiciones; recomienda con números." },
  { id: "messaging", label: "Mensajes por persona", phase: "plan", instructions: "Propón mensajes por persona compradora a partir del posicionamiento y los pilares." },
  { id: "campaign", label: "Campaña", phase: "execution", instructions: "Diseña una campaña: objetivo, audiencia, mensaje, canales, métricas." },
  { id: "journey", label: "Recorrido de compra", phase: "plan", instructions: "Dibuja el recorrido de compra por etapas con contenidos y señales." },
  { id: "weekly_plan", label: "Plan de la semana", phase: "execution", instructions: "Revisa pipeline, riesgos y sugerencias; propone las 5 prioridades de la semana con dueño y crea tareas tras confirmación." },
  { id: "account_breakdown", label: "Planes de cuenta", phase: "execution", requires: ["plan"], instructions: "Divide el Plan GTM en cuentas objetivo y propone qué planes de cuenta crear primero." },
  { id: "prioritize_pipeline", label: "Priorizar pipeline", phase: "execution", instructions: "Ordena el pipeline por valor, probabilidad real y riesgo; di dónde poner el foco." },
  { id: "replan", label: "Replanificar", phase: "execution", instructions: "Algo ha cambiado a mitad de trimestre: pregunta qué y propone cómo ajustar el plan y las prioridades." },
  { id: "call_prep", label: "Call prep", phase: "execution", instructions: "Pregunta la reunión o cuenta y genera el Call Prep." },
  { id: "advance_deal", label: "Avanzar deal", phase: "execution", instructions: "Pregunta el deal, revisa qué le falta para pasar de etapa según su camino (ACV) y propone el siguiente paso." },
  { id: "deal_review", label: "Revisión de deal", phase: "execution", instructions: "Revisión de deal: MEDDPICC, riesgos, señales de slip y acciones." },
  { id: "proposal", label: "Propuesta", phase: "execution", instructions: "Estructura la propuesta comercial del deal con valor, alcance, precio y plan de acción mutuo." },
  { id: "winloss", label: "Win/Loss", phase: "retro", produces: "winloss", instructions: "Analiza un deal cerrado (ganado o perdido) y extrae lecciones." },
  { id: "customer_onboarding", label: "Onboarding de cliente", phase: "execution", instructions: "Diseña el plan de onboarding de un cliente nuevo hasta el primer valor." },
  { id: "expansion", label: "Expansión", phase: "execution", instructions: "Busca oportunidades de expansión en las cuentas actuales." },
  { id: "churn_risk", label: "Riesgo de churn", phase: "execution", instructions: "Identifica cuentas en riesgo y propone acciones de retención." },
  { id: "partner_registration", label: "Registro de oportunidad", phase: "execution", instructions: "Ayuda a registrar una oportunidad de partner (válida 90 días) y detecta conflictos." },
  { id: "cosell", label: "Co-selling", phase: "execution", instructions: "Diseña el plan de co-selling con un partner para una cuenta." },
  { id: "partner_plan", label: "Plan de partner", phase: "plan", instructions: "Propón el plan anual con un partner: objetivos, enablement, incentivos." },
  { id: "channel_conflict", label: "Conflicto de canal", phase: "execution", instructions: "Analiza un conflicto entre venta directa y partner y propone resolución." },
  { id: "retro", label: "Retro trimestral", phase: "retro", produces: "retro", instructions: "Retro del trimestre a partir de resultados y win/loss." },
];

export const getWorkflow = (id: string | null | undefined) => WORKFLOWS.find((w) => w.id === id);

/** Which required artifacts are not yet approved. */
export function missingPrereqs(w: Workflow, approved: Iterable<ArtifactKind>) {
  const set = new Set(approved);
  return (w.requires ?? []).filter((k) => !set.has(k));
}
