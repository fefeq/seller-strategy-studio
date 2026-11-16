// Strict JSON schema the AI must follow when proposing a GTM setup, and the pure
// mapping from that proposal to agent tool calls (so applying it reuses the registry).

const str = { type: ["string", "null"] };
const num = { type: ["number", "null"] };
const obj = (properties: Record<string, unknown>) => ({
  type: "object",
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
});

export const SETUP_EXTRACTION_SCHEMA = obj({
  summary: { type: "string" },
  currency: str,
  quarter_quota: num,
  positioning: obj({
    best_customers: str,
    alternatives: str,
    differentiation: str,
    value: str,
    trend: str,
    product_name: str,
    target_customer: str,
    need: str,
    category: str,
    key_benefit: str,
    competitive_alternative: str,
    differentiator: str,
    one_liner: str,
    short_pitch: str,
    elevator_pitch: str,
    tagline: str,
  }),
  segments: {
    type: "array",
    items: obj({
      name: { type: "string" },
      priority: num,
      notes: str,
      acv_min: num,
      acv_max: num,
      motion: { type: "string", enum: ["plg", "inside", "field", "strategic"] },
      win_rate_target: num,
      ae_quota: num,
      gross_margin_pct: num,
    }),
  },
  icps: {
    type: "array",
    items: obj({
      name: { type: "string" },
      industries: str,
      company_size: str,
      geography: str,
      why_fit: str,
      anti_icp: str,
    }),
  },
  pillars: {
    type: "array",
    items: obj({ title: { type: "string" }, pain: str, message: str, proof: str }),
  },
  target_accounts: {
    type: "array",
    items: obj({ name: { type: "string" }, domain: str, why: str }),
  },
  questions: { type: "array", items: { type: "string" } },
  // Where each strategy block comes from and how sure the AI is (shown on the onboarding block review).
  basis: {
    type: "array",
    items: obj({
      block: {
        type: "string",
        enum: ["company", "icp", "segments", "positioning", "messages", "goals"],
      },
      level: { type: "string", enum: ["confirmed", "inferred", "assumed"] },
      source: str,
    }),
  },
});

export type SetupProposal = {
  summary: string;
  currency: string | null;
  /** New ACV to close this quarter, when the sources say it. */
  quarter_quota?: number | null;
  positioning: Record<string, string | null>;
  segments: {
    name: string;
    priority?: number | null;
    notes?: string | null;
    acv_min: number | null;
    acv_max: number | null;
    motion: string;
    win_rate_target: number | null;
    ae_quota: number | null;
    gross_margin_pct?: number | null;
  }[];
  icps: {
    name: string;
    industries: string | null;
    company_size: string | null;
    geography: string | null;
    why_fit: string | null;
    anti_icp: string | null;
  }[];
  pillars: { title: string; pain: string | null; message: string | null; proof: string | null }[];
  target_accounts: { name: string; domain: string | null; why: string | null }[];
  questions: string[];
  basis?: { block: string; level: "confirmed" | "inferred" | "assumed"; source: string | null }[];
};

export type ProposalItem = {
  key: string;
  group: string;
  label: string;
  detail: string;
  tool: string;
  args: Record<string, unknown>;
};

export const FIELD_LABELS: Record<string, string> = {
  best_customers: "Mejores clientes",
  alternatives: "Alternativas",
  differentiation: "Diferenciación",
  value: "Valor",
  trend: "Tendencia",
  product_name: "Producto",
  target_customer: "Cliente objetivo",
  need: "Necesidad",
  category: "Categoría",
  key_benefit: "Beneficio clave",
  competitive_alternative: "Alternativa competitiva",
  differentiator: "Diferenciador",
  one_liner: "Frase de una línea",
  short_pitch: "Pitch corto",
  elevator_pitch: "Elevator pitch",
  tagline: "Tagline",
  name: "Nombre",
  acv_min: "ACV mín.",
  acv_max: "ACV máx.",
  priority: "Prioridad",
  notes: "Nota",
  motion: "Modelo de venta",
  win_rate_target: "Win rate objetivo %",
  ae_quota: "Cuota anual AE",
  gross_margin_pct: "Margen bruto %",
  industries: "Sectores",
  company_size: "Tamaño",
  geography: "Geografía",
  why_fit: "Por qué encaja",
  anti_icp: "Anti-ICP",
  title: "Título",
  pain: "Dolor",
  message: "Mensaje",
  proof: "Prueba",
  domain: "Dominio",
  currency: "Moneda",
};

const clean = (o: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && v !== ""));

/** Turns a proposal into reviewable items, each mapped to one tool call. Existing segments are updated by name. */
export function proposalItems(
  p: SetupProposal,
  existingSegments: { id: string; name: string }[],
  currentCurrency: string | null,
): ProposalItem[] {
  const items: ProposalItem[] = [];
  if (p.currency && /^[A-Z]{3}$/.test(p.currency) && p.currency !== currentCurrency) {
    items.push({
      key: "currency",
      group: "Empresa",
      label: `Moneda: ${p.currency}`,
      detail: "Solo reetiqueta importes",
      tool: "set_currency",
      args: { currency: p.currency },
    });
  }
  if (p.quarter_quota != null && p.quarter_quota > 0) {
    items.push({
      key: "quota",
      group: "Cuota",
      label: `Cuota de este trimestre: ${p.quarter_quota}`,
      detail: "ACV nuevo a cerrar en el trimestre actual (tu cuota)",
      tool: "set_quota",
      args: { amount: p.quarter_quota },
    });
  }
  const pos = clean(p.positioning ?? {}) as Record<string, string>;
  if (Object.keys(pos).length) {
    const args = { fields: pos };
    items.push({
      key: "positioning",
      group: "Posicionamiento",
      label: pos.one_liner ?? "Posicionamiento",
      detail: itemDetail("update_positioning", args) ?? "",
      tool: "update_positioning",
      args,
    });
  }
  p.segments.forEach((s, i) => {
    const ex = existingSegments.find(
      (e) => e.name.trim().toLowerCase() === s.name.trim().toLowerCase(),
    );
    const args = clean({ ...s, segment_id: ex?.id });
    items.push({
      key: `seg${i}`,
      group: "Segmentos",
      label: s.name,
      detail: itemDetail("upsert_segment", args) ?? "",
      tool: "upsert_segment",
      args,
    });
  });
  p.icps.forEach((c, i) => {
    const args = clean(c);
    items.push({
      key: `icp${i}`,
      group: "ICP",
      label: c.name,
      detail: itemDetail("create_icp", args) ?? "",
      tool: "create_icp",
      args,
    });
  });
  p.pillars.forEach((x, i) => {
    const args = clean(x);
    items.push({
      key: `pil${i}`,
      group: "Pilares de mensaje",
      label: x.title,
      detail: itemDetail("create_pillar", args) ?? "",
      tool: "create_pillar",
      args,
    });
  });
  p.target_accounts.forEach((a, i) =>
    items.push({
      key: `acc${i}`,
      group: "Cuentas objetivo",
      label: a.name,
      detail: a.why ?? a.domain ?? "",
      tool: "create_account",
      args: clean({ name: a.name, domain: a.domain, is_target: true }),
    }),
  );
  return items;
}

/** A range with mín = máx is a point: the capacity and payback maths work on it as if it were a range. */
export function segmentRangeWarning(
  min: number | null | undefined,
  max: number | null | undefined,
): string | null {
  if (min == null || max == null) return null;
  if (min === max)
    return "El ACV mín y el máx son iguales: está bien si el segmento tiene un único precio; si no, ajusta la horquilla.";
  if (min > max) return "Atención: el ACV mín es mayor que el máx.";
  return null;
}

/**
 * The one-line summary of an item, rebuilt from its current args so an edit shows at once
 * (the card used to keep «ACV 6000–6000» after the fields were changed). null = keep the original text.
 */
export function itemDetail(tool: string, a: Record<string, unknown>): string | null {
  const v = (k: string) => (a[k] == null || a[k] === "" ? null : a[k]);
  switch (tool) {
    case "update_positioning":
      return Object.entries((a.fields ?? {}) as Record<string, unknown>)
        .filter(([, x]) => x != null && x !== "")
        .map(([k, x]) => `${FIELD_LABELS[k] ?? k}: ${x}`)
        .join("\n");
    case "upsert_segment": {
      const flat = segmentRangeWarning(
        v("acv_min") as number | null,
        v("acv_max") as number | null,
      );
      return `${v("priority") != null ? `Prioridad ${v("priority")} · ` : ""}ACV ${v("acv_min") ?? "?"}–${v("acv_max") ?? "?"} · ${v("motion") ?? "?"}${v("win_rate_target") != null ? ` · win rate ${v("win_rate_target")}%` : ""}${v("ae_quota") != null ? ` · cuota AE ${v("ae_quota")}` : ""}${v("notes") ? `\nNota: ${v("notes")}` : ""}${flat ? `\n${flat}` : ""}`;
    }
    case "create_icp":
      return [
        v("industries"),
        v("company_size"),
        v("why_fit") && `Encaje: ${v("why_fit")}`,
        v("anti_icp") && `Anti-ICP: ${v("anti_icp")}`,
      ]
        .filter(Boolean)
        .join(" · ");
    case "create_pillar":
      return [v("pain"), v("message"), v("proof") && `Prueba: ${v("proof")}`]
        .filter(Boolean)
        .join(" · ");
    default:
      return null;
  }
}
