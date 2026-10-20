// Strict JSON schema the AI must follow when proposing a GTM setup, and the pure
// mapping from that proposal to agent tool calls (so applying it reuses the registry).

const str = { type: ["string", "null"] };
const num = { type: ["number", "null"] };
const obj = (properties: Record<string, unknown>) => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });

export const SETUP_EXTRACTION_SCHEMA = obj({
  summary: { type: "string" },
  currency: str,
  positioning: obj({ product_name: str, target_customer: str, need: str, category: str, key_benefit: str, competitive_alternative: str, differentiator: str, one_liner: str, elevator_pitch: str, tagline: str }),
  segments: { type: "array", items: obj({ name: { type: "string" }, acv_min: num, acv_max: num, motion: { type: "string", enum: ["plg", "inside", "field", "strategic"] }, win_rate_target: num, ae_quota: num }) },
  icps: { type: "array", items: obj({ name: { type: "string" }, industries: str, company_size: str, geography: str, why_fit: str, anti_icp: str }) },
  pillars: { type: "array", items: obj({ title: { type: "string" }, pain: str, message: str, proof: str }) },
  target_accounts: { type: "array", items: obj({ name: { type: "string" }, domain: str, why: str }) },
  questions: { type: "array", items: { type: "string" } },
});

export type SetupProposal = {
  summary: string;
  currency: string | null;
  positioning: Record<string, string | null>;
  segments: { name: string; acv_min: number | null; acv_max: number | null; motion: string; win_rate_target: number | null; ae_quota: number | null }[];
  icps: { name: string; industries: string | null; company_size: string | null; geography: string | null; why_fit: string | null; anti_icp: string | null }[];
  pillars: { title: string; pain: string | null; message: string | null; proof: string | null }[];
  target_accounts: { name: string; domain: string | null; why: string | null }[];
  questions: string[];
};

export type ProposalItem = { key: string; group: string; label: string; detail: string; tool: string; args: Record<string, unknown> };

export const FIELD_LABELS: Record<string, string> = {
  product_name: "Producto", target_customer: "Cliente objetivo", need: "Necesidad", category: "Categoría", key_benefit: "Beneficio clave",
  competitive_alternative: "Alternativa competitiva", differentiator: "Diferenciador", one_liner: "Frase de una línea", elevator_pitch: "Elevator pitch",
  tagline: "Tagline", name: "Nombre", acv_min: "ACV mín.", acv_max: "ACV máx.", motion: "Modelo de venta", win_rate_target: "Win rate objetivo %", ae_quota: "Cuota anual AE",
  industries: "Sectores", company_size: "Tamaño", geography: "Geografía", why_fit: "Por qué encaja", anti_icp: "Anti-ICP", title: "Título", pain: "Dolor",
  message: "Mensaje", proof: "Prueba", domain: "Dominio", currency: "Moneda",
};

const clean = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && v !== ""));

/** Turns a proposal into reviewable items, each mapped to one tool call. Existing segments are updated by name. */
export function proposalItems(p: SetupProposal, existingSegments: { id: string; name: string }[], currentCurrency: string | null): ProposalItem[] {
  const items: ProposalItem[] = [];
  if (p.currency && /^[A-Z]{3}$/.test(p.currency) && p.currency !== currentCurrency) {
    items.push({ key: "currency", group: "Empresa", label: `Moneda: ${p.currency}`, detail: "Solo reetiqueta importes", tool: "set_currency", args: { currency: p.currency } });
  }
  const pos = clean(p.positioning ?? {}) as Record<string, string>;
  if (Object.keys(pos).length) {
    items.push({ key: "positioning", group: "Posicionamiento", label: pos.one_liner ?? "Posicionamiento", detail: Object.entries(pos).map(([k, v]) => `${FIELD_LABELS[k] ?? k}: ${v}`).join("\n"), tool: "update_positioning", args: { fields: pos } });
  }
  p.segments.forEach((s, i) => {
    const ex = existingSegments.find((e) => e.name.trim().toLowerCase() === s.name.trim().toLowerCase());
    items.push({ key: `seg${i}`, group: "Segmentos", label: s.name, detail: `ACV ${s.acv_min ?? "?"}–${s.acv_max ?? "?"} · ${s.motion}${s.win_rate_target != null ? ` · win rate ${s.win_rate_target}%` : ""}${s.ae_quota != null ? ` · cuota AE ${s.ae_quota}` : ""}`, tool: "upsert_segment", args: clean({ ...s, segment_id: ex?.id }) });
  });
  p.icps.forEach((c, i) => items.push({ key: `icp${i}`, group: "ICP", label: c.name, detail: [c.industries, c.company_size, c.why_fit && `Encaje: ${c.why_fit}`, c.anti_icp && `Anti-ICP: ${c.anti_icp}`].filter(Boolean).join(" · "), tool: "create_icp", args: clean(c) }));
  p.pillars.forEach((x, i) => items.push({ key: `pil${i}`, group: "Pilares de mensaje", label: x.title, detail: [x.pain, x.message, x.proof && `Prueba: ${x.proof}`].filter(Boolean).join(" · "), tool: "create_pillar", args: clean(x) }));
  p.target_accounts.forEach((a, i) => items.push({ key: `acc${i}`, group: "Cuentas objetivo", label: a.name, detail: a.why ?? a.domain ?? "", tool: "create_account", args: clean({ name: a.name, domain: a.domain, is_target: true }) }));
  return items;
}
