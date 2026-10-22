// What «Resolver» does for a suggestion that has no ready-made action: where it takes the user (the
// exact record or step) and what it asks the agent, so the user gets a concrete proposal instead of a
// generic page. Pure, so the card and the tests agree.

import { SETUP_ITEMS } from "@/lib/setup-schema";

export type ResolvableSuggestion = { detector: string; dedupe_key: string; title: string; body: string; link: string | null };
/** side: where the agent docks; "left" when the record opens as a panel on the right (a deal), so both are visible. */
export type ResolvePlan = { to: string | null; prompt: string; side: "left" | "right" };

/** Splits a stored link ("/deals?deal=1") into the route and its search params for the router. */
export function linkTarget(link: string | null): { to: string; search: Record<string, string> } | null {
  if (!link) return null;
  const [path, query = ""] = link.split("?");
  return { to: path, search: Object.fromEntries(new URLSearchParams(query)) };
}

/** Where each setup step is edited: the strategy tab, metrics, accounts or deals. */
export const SETUP_STEP_LINK: Record<string, string> = {
  positioning: "/strategy?tab=positioning",
  icp: "/strategy?tab=icp",
  segments: "/strategy?tab=motions",
  benchmarks: "/strategy?tab=motions",
  pillars: "/strategy?tab=pillars",
  quota: "/metrics",
  accounts: "/accounts",
  account_fit: "/setup?step=account_fit",
  deals: "/deals",
};
export const setupStepLink = (id: string) => SETUP_STEP_LINK[id] ?? SETUP_ITEMS.find((i) => i.id === id)?.link ?? "/setup";

/** Rules every resolve prompt carries: real data only, questions instead of guesses, nothing changed without OK. */
export const RESOLVE_RULES = [
  "Usa solo los datos que hay en Nokko. Si falta un dato que no está en Nokko, no lo supongas: dime qué preguntar en la próxima llamada y dame un borrador de mensaje para conseguirlo.",
  "Si propones cambiar datos, prepáralos como acciones para que yo las confirme.",
  "Sé breve: primero la propuesta y después el porqué.",
].join(" ");

const MAX_BODY = 2500;
const clip = (s: string) => (s.length > MAX_BODY ? `${s.slice(0, MAX_BODY)}…` : s);
/** The id after the detector prefix in a dedupe key ("meddpicc_gaps:<id>:<stage>" → "<id>"). */
const keyPart = (key: string, i = 1) => key.split(":")[i] ?? "";

const ASK: Record<string, (s: ResolvableSuggestion) => string> = {
  meddpicc_gaps: () =>
    "Ayúdame a completar el MEDDPICC de este deal. Para cada campo que falta: si en las notas, reuniones o stakeholders de Nokko ya hay información, propón el valor como acción para que lo confirme; si no la hay, dime la pregunta exacta para la próxima llamada.",
  no_decision_maker: () =>
    "Ayúdame a identificar al decisor de esta cuenta. Revisa los stakeholders que ya tenemos y dime qué cargo suele decidir en una empresa así y por qué. No inventes nombres: dame las preguntas para que mi contacto actual me presente al decisor y un borrador de mensaje para pedirlo.",
  low_coverage: () =>
    "Propón un plan para recuperar la cobertura de pipeline este trimestre: de qué segmentos y fuentes puede salir el pipeline que falta según los datos de Nokko, y 3 acciones concretas para esta semana que pueda crear como tareas.",
  trial_conversion: () =>
    "Analiza por qué este segmento convierte peor de prueba a pago y propón 2 o 3 hipótesis con cómo comprobar cada una, y si este segmento debería seguir en self-service o pasar a venta asistida.",
  registration_expiring: () =>
    "Ayúdame a decidir si renovar o liberar este registro de partner: qué datos de Nokko apoyan cada opción (deals y actividad de la cuenta) y qué me recomiendas. Si falta información, dime qué preguntar al partner.",
  setup_incomplete: () =>
    "Ayúdame a completar este paso de la estrategia. Propón los valores a partir de lo que ya hay en Nokko y prepáralos como acciones para que los confirme; si no hay datos suficientes, hazme las preguntas mínimas para rellenarlo.",
  setup_question: () =>
    "Es una pregunta que dejó abierta la IA al proponer mi configuración. Ayúdame a responderla con lo que ya hay en Nokko; si la respuesta cambia algún dato de la estrategia, prepáralo como acción para que la confirme. Si es una decisión con varias posturas defendibles, dímelo y propón llevarla a Debates.",
  meeting_no_notes: (s) =>
    `Ayúdame a apuntar las notas de esta reunión (id ${keyPart(s.dedupe_key)}) en 5 líneas. Hazme las preguntas de una en una: qué les duele, qué les cuesta no resolverlo, quién decide y cómo, qué les frena y el próximo paso acordado (qué, quién y cuándo). Cuando conteste, guárdalas con save_call_notes para que lo confirme, usando solo mis palabras. Después dime que puedo desmontar la llamada con IA desde la reunión.`,
  unassigned_accounts: () =>
    "Hay cuentas sin responsable. Dime en pocas líneas qué les falta para repartirlas bien (país, segmento o tier) y si con el equipo y las reglas actuales alguna se quedaría sin dueño. El reparto se propone y se aprueba en esta pantalla («Proponer reparto»): no asignes cuentas tú.",
  account_assigned: () =>
    "Me acaban de asignar estas cuentas. Dime por cuál empiezo y por qué (encaje con el ICP, deals y leads abiertos, última actividad) y el primer paso concreto para cada una. Si quiero crear tareas, prepáralas como acciones para que las confirme.",
  weekly_report: () =>
    "A partir de este informe semanal, dime las 2 o 3 acciones más importantes para esta semana, con el deal o lead concreto de cada una, y prepáralas como tareas para que las confirme.",
};

/** Target page and agent prompt for a suggestion's «Resolver». */
export function resolvePlan(s: ResolvableSuggestion): ResolvePlan {
  let to = s.link;
  if (s.detector === "meddpicc_gaps" && (!to || to === "/deals")) {
    const id = keyPart(s.dedupe_key);
    to = id ? `/deals?deal=${id}` : "/deals";
  }
  if (s.detector === "setup_incomplete") to = setupStepLink(keyPart(s.dedupe_key));
  const ask = ASK[s.detector]?.(s) ?? "Ayúdame a resolver esto: propón los pasos concretos y, si hay que cambiar datos, prepáralos como acciones para que los confirme.";
  const prompt = `Resolver sugerencia: «${s.title}»\n\nDetalle:\n${clip(s.body)}\n\n${ask}\n\n${RESOLVE_RULES}`;
  const side = to?.startsWith("/deals?deal=") ? "left" : "right";
  return { to, prompt, side };
}
