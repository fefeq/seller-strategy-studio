// Target accounts from a CSV (a Sales Navigator or Excel export). Pure: the mapping the preview shows,
// and the rows to insert after deduplicating against the file itself and the accounts already there,
// so the setup step and Cuentas import the same way.

import { normKey } from "@/lib/leads";

export type AccountField = "name" | "domain" | "industry" | "size" | "tier" | "segment" | "notes";

export const ACCOUNT_FIELD_LABELS: Record<AccountField, string> = {
  name: "Nombre de la cuenta",
  domain: "Dominio / web",
  industry: "Sector",
  size: "Tamaño",
  tier: "Tier (A, B, C)",
  segment: "Segmento",
  notes: "Notas",
};

const ALIASES: Record<AccountField, string[]> = {
  name: [
    "name",
    "nombre",
    "empresa",
    "company",
    "company_name",
    "account",
    "account_name",
    "cuenta",
    "organizacion",
    "organization",
    "razon_social",
  ],
  domain: [
    "domain",
    "dominio",
    "website",
    "web",
    "url",
    "sitio_web",
    "company_website",
    "pagina_web",
  ],
  industry: ["industry", "industria", "sector", "vertical"],
  size: [
    "size",
    "tamano",
    "employees",
    "empleados",
    "headcount",
    "company_size",
    "numero_de_empleados",
    "tamano_de_empresa",
  ],
  tier: ["tier", "prioridad_cuenta", "nivel"],
  segment: ["segment", "segmento"],
  notes: ["notes", "notas", "comentarios", "why", "por_que", "motivo"],
};

export function accountColumnMapping(headers: string[]): Record<string, AccountField | null> {
  const out: Record<string, AccountField | null> = Object.fromEntries(
    headers.map((h) => [h, null]),
  );
  const taken = new Set<AccountField>();
  for (const f of Object.keys(ALIASES) as AccountField[]) {
    const hit = headers.find((h) => out[h] == null && ALIASES[f].includes(normKey(h)));
    if (hit) {
      out[hit] = f;
      taken.add(f);
    }
  }
  return out;
}

// One domain rule for the whole app (leads, accounts, duplicates): see leads.ts.
export { cleanDomain } from "./leads";
import { cleanDomain } from "./leads";

export type AccountRow = {
  name: string;
  domain: string | null;
  industry: string | null;
  size: string | null;
  tier: string | null;
  segment_id: string | null;
  notes: string | null;
  is_target: true;
};

export type AccountImportPlan = {
  rows: AccountRow[];
  /** Rows not imported, with the reason, so the person can see what happened to each one. */
  skipped: { line: number; name: string; reason: string }[];
};

export function planAccountImport(
  csv: Record<string, string>[],
  mapping: Record<string, AccountField | null>,
  segments: { id: string; name: string }[],
  existing: { name: string; domain: string | null }[],
): AccountImportPlan {
  const col = (f: AccountField) => Object.entries(mapping).find(([, x]) => x === f)?.[0];
  const get = (r: Record<string, string>, f: AccountField) => {
    const c = col(f);
    const v = c ? (r[c] ?? "").trim() : "";
    return v || null;
  };
  const seenNames = new Set(existing.map((a) => a.name.trim().toLowerCase()));
  const seenDomains = new Set(
    existing.map((a) => cleanDomain(a.domain)).filter(Boolean) as string[],
  );
  const segByName = new Map(segments.map((s) => [s.name.trim().toLowerCase(), s.id]));
  const plan: AccountImportPlan = { rows: [], skipped: [] };
  csv.forEach((r, i) => {
    const line = i + 2; // header is line 1
    const domain = cleanDomain(get(r, "domain"));
    const name = (get(r, "name") ?? domain ?? "").slice(0, 200);
    if (!name) return plan.skipped.push({ line, name: "—", reason: "sin nombre ni dominio" });
    if ((domain && seenDomains.has(domain)) || seenNames.has(name.toLowerCase()))
      return plan.skipped.push({ line, name, reason: "ya existe" });
    const tier = get(r, "tier")?.toUpperCase().slice(0, 1) ?? null;
    const segName = get(r, "segment");
    plan.rows.push({
      name,
      domain,
      industry: get(r, "industry"),
      size: get(r, "size"),
      tier: tier && ["A", "B", "C"].includes(tier) ? tier : null,
      segment_id: segName ? (segByName.get(segName.toLowerCase()) ?? null) : null,
      notes: get(r, "notes"),
      is_target: true,
    });
    seenNames.add(name.toLowerCase());
    if (domain) seenDomains.add(domain);
  });
  return plan;
}
