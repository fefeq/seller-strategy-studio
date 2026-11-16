// Theory U (Otto Scharmer, Presencing Institute) applied to GTM.

export const U_PHASES = [
  {
    key: "co_initiating",
    label: "Co-iniciar",
    tagline: "Escuchar lo que nos convoca",
    description:
      "Detecta la pregunta o desafío comercial que importa de verdad y reúne a las personas que tienen que estar.",
    prompts: [
      "¿Qué pregunta o desafío GTM nos convoca ahora mismo?",
      "¿Quiénes tienen que estar? (clientes, ventas, CS, producto, partners)",
      "¿Qué intención compartimos como equipo?",
    ],
  },
  {
    key: "co_sensing",
    label: "Co-percibir",
    tagline: "Observar, observar, observar",
    description:
      "Sal a los lugares de mayor potencial: entrevistas con clientes, sensing journeys, llamadas perdidas y ganadas. Suspende el juicio.",
    prompts: [
      "¿Qué clientes, mercados o equipos visitaremos?",
      "¿Qué patrones aparecen en lo que escuchamos?",
      "¿Qué supuestos nuestros se han caído?",
    ],
  },
  {
    key: "presencing",
    label: "Presencing",
    tagline: "Soltar y dejar venir",
    description:
      "Retírate y reflexiona. Conecta con lo que quiere emerger y con la intención más profunda del equipo.",
    prompts: [
      "¿Qué tenemos que soltar? (mensajes, segmentos, hábitos de venta)",
      "¿Qué futuro quiere emerger para nuestros clientes y para nosotros?",
      "¿Cuál es nuestra intención esencial? ¿Quiénes somos y cuál es nuestro trabajo?",
    ],
  },
  {
    key: "co_creating",
    label: "Co-crear",
    tagline: "Prototipar para aprender",
    description:
      "Convierte la intención en prototipos rápidos (mensajes, ofertas, motions, playbooks) y busca feedback temprano.",
    prompts: [
      "¿Qué prototipos lanzaremos en los próximos 30 días?",
      "¿Qué feedback buscaremos y de quién?",
      "¿Qué aprenderemos aunque falle?",
    ],
  },
  {
    key: "co_evolving",
    label: "Co-evolucionar",
    tagline: "Escalar desde el todo",
    description:
      "Lleva lo que funciona al sistema: playbooks, ICP, posicionamiento, métricas y rituales del equipo.",
    prompts: [
      "¿Qué prototipos escalamos al playbook?",
      "¿Qué cambia en ICP, posicionamiento y motions?",
      "¿Qué rituales y métricas lo van a sostener?",
    ],
  },
] as const;

export type UPhase = (typeof U_PHASES)[number]["key"];

export function phaseIndex(phase: string) {
  return U_PHASES.findIndex((p) => p.key === phase);
}

export function nextPhase(phase: string): UPhase | null {
  const i = phaseIndex(phase);
  if (i < 0 || i >= U_PHASES.length - 1) return null;
  return U_PHASES[i + 1].key;
}

export const LISTENING_LEVELS = {
  1: {
    label: "Descarga",
    short: "Confirmo lo que ya sé",
    description:
      "Escuchas para reconfirmar tus juicios. «Sí, ya lo sabía.» El cliente habla, tú esperas tu turno para hacer el pitch.",
  },
  2: {
    label: "Factual",
    short: "Noto lo nuevo",
    description:
      "Mente abierta: prestas atención a los datos que contradicen lo que pensabas. Haces discovery de verdad.",
  },
  3: {
    label: "Empática",
    short: "Veo con sus ojos",
    description:
      "Corazón abierto: entiendes la situación desde la perspectiva del stakeholder, sus presiones y sus miedos.",
  },
  4: {
    label: "Generativa",
    short: "Escucho lo que emerge",
    description:
      "Voluntad abierta: con el cliente descubres una posibilidad que ninguno de los dos traía. Sales de la reunión distinto de como entraste.",
  },
} as const;

export type ListeningLevel = 1 | 2 | 3 | 4;

export function listeningStats(levels: Array<number | null | undefined>) {
  const valid = levels.filter((l): l is ListeningLevel => l === 1 || l === 2 || l === 3 || l === 4);
  const distribution: Record<ListeningLevel, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const l of valid) distribution[l]++;
  const count = valid.length;
  const average = count ? valid.reduce((s, l) => s + l, 0) / count : 0;
  const deepShare = count ? (distribution[3] + distribution[4]) / count : 0;
  return { count, average, distribution, deepShare };
}

export const SENSING_KINDS: Record<string, string> = {
  interview: "Entrevista",
  journey: "Sensing journey",
  observation: "Observación",
  customer_call: "Llamada con cliente",
};

export const EXPERIMENT_STATUS: Record<string, string> = {
  idea: "Idea",
  running: "En curso",
  learned: "Aprendido",
  adopted: "Adoptado",
  discarded: "Descartado",
};

export const CASE_CLINIC_STEPS = [
  {
    key: "situation",
    label: "1 · Intención del case giver",
    minutes: 15,
    help: "Situación, stakeholders clave y qué está en juego. El resto solo escucha.",
  },
  {
    key: "edge",
    label: "Mi borde de aprendizaje",
    minutes: 0,
    help: "¿Qué tengo que aprender o soltar yo para avanzar?",
  },
  {
    key: "help_needed",
    label: "Dónde necesito ayuda",
    minutes: 0,
    help: "La pregunta concreta que lleva al grupo.",
  },
  {
    key: "mirror_image",
    label: "2 · Silencio y espejos: imagen",
    minutes: 3,
    help: "Tras 3 minutos de silencio, cada coach comparte la imagen que le vino.",
  },
  {
    key: "mirror_feeling",
    label: "Espejos: sentimiento",
    minutes: 0,
    help: "Qué sentimiento despertó la historia.",
  },
  {
    key: "mirror_gesture",
    label: "Espejos: gesto",
    minutes: 0,
    help: "Un gesto o postura que lo exprese (descríbelo).",
  },
  {
    key: "dialogue",
    label: "3 · Diálogo generativo",
    minutes: 20,
    help: "Sin consejos de manual: preguntas que abren posibilidades.",
  },
  {
    key: "closing",
    label: "4 · Cierre del case giver",
    minutes: 5,
    help: "¿Qué veo ahora que antes no veía?",
  },
  {
    key: "next_steps",
    label: "Próximos pasos",
    minutes: 0,
    help: "Prototipo o acción concreta para el deal.",
  },
] as const;
