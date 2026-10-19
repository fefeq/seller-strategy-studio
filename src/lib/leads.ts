// Turns whatever a form, automation or CRM sends into one normalized lead. Pure so the
// public link, the CSV import and the tests all agree on the same rules.
import { DEAL_STAGES } from "@/lib/roles";

export type DealStage = (typeof DEAL_STAGES)[number]["id"];

export type NormalizedLead = {
  company: string;
  domain: string | null;
  email: string | null;
  fullName: string | null;
  title: string | null;
  linkedin: string | null;
  stage: DealStage;
  /** False when the payload had no stage (then existing deals keep theirs). */
  stageGiven: boolean;
  stageRecognized: boolean;
  /** When the lead entered (deal created_at). */
  enteredAt: string | null;
  /** Expected or actual close date (YYYY-MM-DD). */
  closeDate: string | null;
  amount: number | null;
  externalId: string | null;
  dealName: string | null;
  segment: string | null;
  source: string | null;
};

export const STAGE_PROBABILITY: Record<DealStage, number> = { discovery: 10, qualified: 25, demo: 40, proposal: 60, negotiation: 80, won: 100, lost: 0 };

const FREEMAIL = new Set(["gmail.com", "googlemail.com", "hotmail.com", "hotmail.es", "outlook.com", "outlook.es", "live.com", "yahoo.com", "yahoo.es", "icloud.com", "me.com", "proton.me", "protonmail.com", "aol.com", "gmx.com", "msn.com"]);

/** "¿Nombre de tu Empresa?" → "nombre_de_tu_empresa" */
export function normKey(k: string) {
  return k.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

// Exact aliases first; `contains` words catch long form questions ("¿Cuál es tu empresa?").
const FIELDS: { key: keyof NormalizedLead | "firstName" | "lastName"; exact: string[]; contains?: string[] }[] = [
  { key: "externalId", exact: ["external_id", "id", "lead_id", "deal_id", "hs_object_id", "record_id", "dealid", "id_externo", "submission_id", "response_id"] },
  { key: "email", exact: ["email", "e_mail", "correo", "correo_electronico", "work_email", "email_address", "mail"], contains: ["email", "correo", "e_mail"] },
  { key: "domain", exact: ["domain", "dominio", "website", "web", "sitio_web", "company_domain", "company_website", "url", "pagina_web"], contains: ["dominio", "website", "sitio_web", "pagina_web"] },
  { key: "company", exact: ["company", "empresa", "company_name", "nombre_empresa", "organization", "organizacion", "account", "account_name", "cuenta", "compania", "org_name"], contains: ["empresa", "company", "compania", "organizacion", "organization"] },
  { key: "firstName", exact: ["first_name", "firstname", "nombre_pila"] },
  { key: "lastName", exact: ["last_name", "lastname", "apellido", "apellidos"] },
  { key: "fullName", exact: ["name", "full_name", "nombre", "nombre_completo", "contact_name", "contacto"], contains: ["nombre", "name"] },
  { key: "title", exact: ["title", "job_title", "cargo", "puesto", "position", "rol", "role", "jobtitle"], contains: ["cargo", "puesto", "job_title"] },
  { key: "linkedin", exact: ["linkedin", "linkedin_url", "linkedin_profile"], contains: ["linkedin"] },
  { key: "stage", exact: ["stage", "etapa", "dealstage", "deal_stage", "fase", "estado", "status", "lifecyclestage", "lead_status"] },
  { key: "enteredAt", exact: ["date", "fecha", "created_at", "createdate", "created", "fecha_entrada", "fecha_alta", "fecha_lead", "submitted_at", "add_time", "signup_date", "lead_date", "entered_at"] },
  { key: "closeDate", exact: ["close_date", "closedate", "fecha_cierre", "expected_close_date", "cierre", "won_time", "close_time"] },
  { key: "amount", exact: ["amount", "importe", "value", "valor", "deal_value", "acv", "arr", "presupuesto", "budget", "revenue", "monto"], contains: ["importe", "presupuesto", "budget"] },
  { key: "dealName", exact: ["deal_name", "dealname", "oportunidad", "nombre_oportunidad", "opportunity", "title_deal", "deal"] },
  { key: "segment", exact: ["segment", "segmento"] },
  { key: "source", exact: ["source", "origen", "fuente", "utm_source", "lead_source", "canal"] },
];

const STAGE_WORDS: [DealStage, string[]][] = [
  ["won", ["won", "ganado", "ganada", "closedwon", "closed_won", "cerrado_ganado", "cerrada_ganada", "customer", "cliente", "firmado", "signed"]],
  ["lost", ["lost", "perdido", "perdida", "closedlost", "closed_lost", "cerrado_perdido", "descartado", "unqualified", "no_cualificado", "rejected"]],
  ["negotiation", ["negotiation", "negociacion", "contract", "contrato", "contractsent", "contract_sent", "legal", "decisionmakerboughtin", "decision_maker_bought_in"]],
  ["proposal", ["proposal", "propuesta", "quote", "presupuesto", "oferta", "presentationscheduled", "presentation_scheduled"]],
  ["demo", ["demo", "poc", "trial", "prueba", "piloto", "pilot", "appointmentscheduled", "appointment_scheduled", "evaluacion"]],
  ["qualified", ["qualified", "cualificado", "cualificada", "sql", "qualifiedtobuy", "qualified_to_buy", "opportunity", "oportunidad"]],
  ["discovery", ["discovery", "descubrimiento", "lead", "new", "nuevo", "nueva", "mql", "subscriber", "contacted", "contactado", "open", "abierto", "salesqualifiedlead", "marketingqualifiedlead", "inbound"]],
];

export function mapStage(raw: unknown, fallback: DealStage = "discovery"): { stage: DealStage; recognized: boolean } {
  if (raw == null || String(raw).trim() === "") return { stage: fallback, recognized: true };
  const k = normKey(String(raw));
  if (DEAL_STAGES.some((s) => s.id === k)) return { stage: k as DealStage, recognized: true };
  const label = DEAL_STAGES.find((s) => normKey(s.label) === k);
  if (label) return { stage: label.id, recognized: true };
  for (const [stage, words] of STAGE_WORDS) if (words.includes(k)) return { stage, recognized: true };
  for (const [stage, words] of STAGE_WORDS) if (words.some((w) => w.length > 3 && k.includes(w))) return { stage, recognized: true };
  return { stage: fallback, recognized: false };
}

/** Accepts ISO dates, dd/mm/yyyy (Spanish order), and Unix seconds/milliseconds. */
export function parseDate(raw: unknown): Date | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number" || /^\d{9,13}$/.test(String(raw).trim())) {
    const n = Number(raw);
    const d = new Date(n < 1e11 ? n * 1000 : n);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const s = String(raw).trim();
  const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[ T](\d{1,2}):(\d{2}))?$/);
  if (dmy) {
    const [, dd, mm, yyyy, hh, mi] = dmy;
    const d = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh ?? 12), Number(mi ?? 0)));
    return d.getUTCMonth() === Number(mm) - 1 ? d : null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T12:00:00Z`);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "1.234,50 €" / "$12,000" / "12000" → number. */
export function parseAmount(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number") return Number.isFinite(raw) && raw >= 0 ? raw : null;
  let s = String(raw).replace(/[^\d.,-]/g, "");
  if (!s) return null;
  const lastComma = s.lastIndexOf(","), lastDot = s.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else if (lastComma >= 0) s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  else if (lastDot >= 0 && /^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function cleanDomain(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#\s]/)[0];
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s) ? s : null;
}

export function domainFromEmail(email: string | null) {
  const d = email?.split("@")[1]?.toLowerCase();
  return d && !FREEMAIL.has(d) ? d : null;
}

function companyFromDomain(domain: string) {
  const base = domain.split(".")[0];
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function textValue(v: unknown): string | null {
  if (v == null) return null;
  if (Array.isArray(v)) return v.map(textValue).filter(Boolean).join(", ") || null;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return textValue(o.label ?? o.value ?? o.name ?? o.text ?? null);
  }
  const s = String(v).trim();
  return s || null;
}

/**
 * Splits a request body into flat key→value records, one per lead. Understands a plain object,
 * arrays, `{ leads: [...] }`, CRM-style `properties`, Typeform, Tally and Webflow webhooks.
 */
export function flattenPayload(body: unknown): Record<string, unknown>[] {
  if (body == null || typeof body !== "object") return [];
  if (Array.isArray(body)) return body.flatMap(flattenPayload);
  const b = body as Record<string, any>;
  if (Array.isArray(b.leads)) return b.leads.flatMap(flattenPayload);
  if (Array.isArray(b.records)) return b.records.flatMap(flattenPayload);

  // Typeform
  if (b.form_response?.answers) {
    const titles: Record<string, string> = Object.fromEntries((b.form_response.definition?.fields ?? []).map((f: any) => [f.id, f.title ?? f.ref]));
    const out: Record<string, unknown> = { response_id: b.form_response.token, submitted_at: b.form_response.submitted_at, ...(b.form_response.hidden ?? {}) };
    for (const a of b.form_response.answers) {
      const key = titles[a.field?.id] ?? a.field?.ref ?? a.field?.id;
      const v = a[a.type] ?? a.text ?? a.email;
      out[key] = a.type === "choice" ? v?.label : a.type === "choices" ? v?.labels : v;
    }
    return [out];
  }
  // Tally
  if (Array.isArray(b.data?.fields)) {
    const out: Record<string, unknown> = { submission_id: b.data.submissionId ?? b.data.responseId, submitted_at: b.data.createdAt ?? b.createdAt };
    for (const f of b.data.fields) {
      let v = f.value;
      if (Array.isArray(f.options) && Array.isArray(v)) v = v.map((id: string) => f.options.find((o: any) => o.id === id)?.text ?? id);
      out[f.label ?? f.key] = v;
    }
    return [out];
  }
  // Webflow (v2 payload.data, v1 data)
  if (b.payload?.data && typeof b.payload.data === "object") return [{ submission_id: b.payload.id, submitted_at: b.payload.submittedAt, ...b.payload.data }];
  if (b.data && typeof b.data === "object" && !Array.isArray(b.data) && (b.name || b.site || b.d)) return [{ submission_id: b._id ?? b.id, submitted_at: b.d, ...b.data }];
  // CRM-style objects keep fields under `properties`.
  if (b.properties && typeof b.properties === "object") {
    const props = Object.fromEntries(Object.entries(b.properties).map(([k, v]: [string, any]) => [k, v && typeof v === "object" && "value" in v ? v.value : v]));
    return [{ id: b.id ?? b.objectId, ...props }];
  }
  return [b];
}

/** Picks known fields from a flat record. Returns an error message when no company can be identified. */
export function normalizeLead(rec: Record<string, unknown>, opts: { defaultStage?: DealStage; source?: string } = {}): { lead: NormalizedLead } | { error: string } {
  const entries = Object.entries(rec).map(([k, v]) => [normKey(k), v] as const).filter(([k]) => k);
  const picked: Record<string, string> = {};
  const used = new Set<string>();
  for (const f of FIELDS) {
    const hit = entries.find(([k, v]) => !used.has(k) && f.exact.includes(k) && textValue(v));
    if (hit) { picked[f.key] = textValue(hit[1])!; used.add(hit[0]); }
  }
  for (const f of FIELDS) {
    if (picked[f.key] || !f.contains) continue;
    const hit = entries.find(([k, v]) => !used.has(k) && f.contains!.some((w) => k.includes(w)) && textValue(v));
    if (hit) { picked[f.key] = textValue(hit[1])!; used.add(hit[0]); }
  }
  // An email typed into an unlabeled field still counts.
  if (!picked.email) {
    const hit = entries.find(([k, v]) => !used.has(k) && /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(textValue(v) ?? ""));
    if (hit) picked.email = textValue(hit[1])!;
  }

  const email = picked.email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(picked.email) ? picked.email.toLowerCase() : null;
  const domain = cleanDomain(picked.domain) ?? domainFromEmail(email);
  const company = (picked.company?.slice(0, 200) || (domain ? companyFromDomain(domain) : "")).trim();
  if (!company) return { error: "Falta la empresa: envía «empresa», un dominio/web o un email corporativo." };

  const fullName = picked.fullName ?? ([picked.firstName, picked.lastName].filter(Boolean).join(" ") || null);
  const { stage, recognized } = mapStage(picked.stage, opts.defaultStage ?? "discovery");
  const entered = parseDate(picked.enteredAt);
  const close = parseDate(picked.closeDate);
  return {
    lead: {
      company,
      domain,
      email,
      fullName: fullName?.slice(0, 200) ?? null,
      title: picked.title?.slice(0, 200) ?? null,
      linkedin: picked.linkedin?.includes("linkedin.") ? picked.linkedin.slice(0, 300) : null,
      stage,
      stageGiven: !!picked.stage,
      stageRecognized: recognized,
      enteredAt: entered ? entered.toISOString() : null,
      closeDate: close ? close.toISOString().slice(0, 10) : null,
      amount: parseAmount(picked.amount),
      externalId: picked.externalId?.slice(0, 200) ?? null,
      dealName: picked.dealName?.slice(0, 200) ?? null,
      segment: picked.segment?.slice(0, 100) ?? null,
      source: (picked.source ?? opts.source ?? null)?.slice(0, 100) ?? null,
    },
  };
}

export const LEAD_LIMITS = { maxBodyBytes: 256 * 1024, maxLeads: 200 } as const;
