// «Tu diagnóstico GTM»: four answers (model, annual ticket, adoption friction, stage) pick one of five
// GTM archetypes, then a stage filter switches frameworks on or off. Pure and explainable: every
// discarded framework carries the reason shown to the founder.

export type Model = "b2b" | "b2c" | "marketplace";
export type Friction = "self_serve" | "committee";
export type Stage = "idea" | "early" | "scale";
export type Archetype = "A" | "B" | "C" | "D" | "E";
export type DiagnosisInput = { model: Model; acv: number; friction: Friction; stage: Stage };

/** Ticket thresholds (annual, company currency). Defaults follow the saved market reference: PLG under 5K, field above 50K. */
export type Thresholds = { low: number; high: number };
export const DEFAULT_THRESHOLDS: Thresholds = { low: 5_000, high: 50_000 };

export const ARCHETYPES: Record<
  Archetype,
  { name: string; motion: string; frameworks: string[]; star: string }
> = {
  A: {
    name: "B2B low-touch / PLG",
    motion: "plg",
    frameworks: ["JTBD", "Posicionamiento de Dunford", "Four Fits", "Growth loops", "AARRR"],
    star: "Onboarding autoguiado y 3 experimentos Bullseye",
  },
  B: {
    name: "B2B mid-market / híbrido",
    motion: "inside_sales",
    frameworks: [
      "Matriz ICP con señales",
      "Propuesta de valor por rol",
      "Outbound con señales",
      "Founder-led sales",
      "MEDDPICC ligero",
    ],
    star: "Secuencias de prospección y guion de discovery de 30 min",
  },
  C: {
    name: "B2B Enterprise / high-touch",
    motion: "field_sales",
    frameworks: [
      "Beachhead market",
      "Comité de compra",
      "Caso de ROI",
      "ABM",
      "MEDDPICC completo",
      "Pilotos de pago",
    ],
    star: "Playbook ABM para 50 cuentas y propuesta de piloto de pago",
  },
  D: {
    name: "B2C / consumo",
    motion: "plg",
    frameworks: [
      "JTBD emocional",
      "Modelo Hooked",
      "Bullseye",
      "Retención por cohortes",
      "LTV:CAC",
    ],
    star: "Guiones de anuncios UGC y mapa del hábito",
  },
  E: {
    name: "Marketplace / plataforma bilateral",
    motion: "plg",
    frameworks: [
      "Red atómica",
      "Lado difícil",
      "Propuesta de valor doble",
      "Come for the tool",
      "Métricas de liquidez",
    ],
    star: "Plan para resolver el huevo y la gallina acotando geografía o categoría",
  },
};

export function archetypeOf(i: DiagnosisInput, t: Thresholds = DEFAULT_THRESHOLDS): Archetype {
  if (i.model === "marketplace") return "E";
  if (i.model === "b2c") return "D";
  if (i.acv >= t.high) return "C";
  if (i.acv < t.low && i.friction === "self_serve") return "A";
  if (i.acv < t.low) return "B"; // low ticket but needs setup: hybrid, never a field team
  return i.friction === "committee" && i.acv >= t.high / 2 ? "C" : "B";
}

export type Diagnosis = {
  archetype: Archetype;
  name: string;
  motion: string;
  active: string[];
  discarded: { framework: string; reason: string }[];
  forced: string[];
  nextStep: string;
  star: string;
};

const STAGE_FORCED: Record<Stage, string[]> = {
  idea: ["The Mom Test", "JTBD", "Prueba de humo (landing o preventa)"],
  early: ["Cosas que no escalan", "Van Westendorp para el primer precio"],
  scale: ["Four Fits", "Optimización del payback", "Precios por niveles"],
};
const SCALE_ONLY = ["Growth loops", "ABM", "AARRR", "Four Fits", "Optimización de precios"];

export function diagnose(
  i: DiagnosisInput,
  money: (n: number) => string = (n) => String(n),
  t: Thresholds = DEFAULT_THRESHOLDS,
): Diagnosis {
  const a = archetypeOf(i, t);
  const def = ARCHETYPES[a];
  const discarded: Diagnosis["discarded"] = [];
  if (a === "A" || a === "D")
    discarded.push({
      framework: "Playbooks Enterprise y equipo de ventas outbound",
      reason: `Tu ticket es de ${money(i.acv)} al año: un equipo de ventas costaría más de lo que deja cada cliente.`,
    });
  if (a === "C")
    discarded.push({
      framework: "SEO masivo y anuncios de consumo",
      reason: `Con un ticket de ${money(i.acv)} vendes a comités: necesitas una lista de cuentas nombradas, no volumen.`,
    });
  if (a === "E")
    discarded.push({
      framework: "Embudo de un solo lado",
      reason:
        "Un marketplace necesita liquidez en los dos lados; primero hay que resolver el lado difícil.",
    });
  let active = def.frameworks;
  if (i.stage === "idea") {
    for (const f of def.frameworks.filter((f) => SCALE_ONLY.includes(f)))
      discarded.push({
        framework: f,
        reason:
          "Aún estás validando el dolor: los canales de escala esperan a tener 10 entrevistas y señales de pago.",
      });
    active = def.frameworks.filter((f) => !SCALE_ONLY.includes(f));
  }
  const nextStep =
    i.stage === "idea"
      ? "Hacer 10 entrevistas de validación antes de abrir canales de adquisición"
      : i.stage === "early"
        ? "Conseguir los primeros 10–50 clientes con contacto directo"
        : "Auditar qué canal se satura y optimizar el payback";
  return {
    archetype: a,
    name: def.name,
    motion: def.motion,
    active,
    discarded,
    forced: STAGE_FORCED[i.stage],
    nextStep,
    star: def.star,
  };
}
