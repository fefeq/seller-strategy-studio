// One normalization and validation per catalogued concept (SDD universal-field-definitions, U-2), so a value
// written on any screen, by the agent, an import or Descubiertos ends up in the same shape. Pure and tested.
// What does not fit is never dropped here: the result says «unnormalized» and keeps the original, and the
// caller decides (U-3 stores the mark). Periodo is not catalogued yet, so it is not normalized here.
import { isoFromCountry } from "@/lib/clay";
import { allowedValues, bindingOf, conceptById } from "@/lib/field-catalog";
import { employeesText, splitList } from "@/lib/icp";

export type Normalized<T> = { status: "ok"; value: T } | { status: "empty" } | { status: "unnormalized"; original: string; reason: string };

const unfit = (original: unknown, reason: string): Normalized<never> => ({ status: "unnormalized", original: String(original), reason });

/** País: ISO 3166-1 alpha-2 from a code or a Spanish/English name, limited to the countries Nokko offers. */
export function normalizeCountry(raw: string | null | undefined): Normalized<string> {
  const v = (raw ?? "").trim();
  if (!v) return { status: "empty" };
  const iso = isoFromCountry(v);
  return iso ? { status: "ok", value: iso } : unfit(v, "No reconozco ese país. Elige uno de la lista.");
}

/** Países: each element as País, without repeats; what does not fit comes back apart. */
export function normalizeCountries(raw: string[] | string | null | undefined): { value: string[]; unnormalized: string[] } {
  const items = typeof raw === "string" ? splitList(raw) : (raw ?? []).map((x) => x.trim()).filter(Boolean);
  const value: string[] = [];
  const unnormalized: string[] = [];
  for (const item of items) {
    const n = normalizeCountry(item);
    if (n.status === "ok") { if (!value.includes(n.value)) value.push(n.value); } else unnormalized.push(item);
  }
  return { value, unnormalized };
}

export type EmployeeRange = { min: number | null; max: number | null };

const EMPLOYEE_WORDS = ["empleados", "empleado", "employees", "employee", "personas", "people", "trabajadores"];
const QUALIFIERS = ["más de", "menos de", "al menos", "up to", "more than", "over", "under", "hasta", "desde", "a", "to", "y", "de"];
const MONEY = /[€$£]|(?<![\p{L}])(eur|usd|gbp|euros?|d[oó]lares?|millones?|facturaci[oó]n|ingresos|revenue|arr|mrr)(?![\p{L}])|\d\s*[mk](?![\p{L}])/iu;

const strip = (s: string, words: string[]) => words.reduce((acc, w) => acc.replace(new RegExp(`(?<![\\p{L}])${w}(?![\\p{L}])`, "giu"), " "), s);

/** «51-200 empleados», «123 empleados», «más de 500», «hasta 50» → a range. Null when the text is not only a headcount. */
export function parseEmployees(text: string | null | undefined): EmployeeRange | null {
  const s = (text ?? "").trim().toLowerCase();
  if (!s || MONEY.test(s)) return null;
  const rest = strip(strip(s, EMPLOYEE_WORDS), QUALIFIERS).replace(/[\d.,\-–—+<>:()\s]/g, "");
  if (/\p{L}/u.test(rest)) return null;
  const grouped = s.replace(/(\d)[.,](?=\d{3}\b)/g, "$1");
  if (/\d[.,]\d/.test(grouped)) return null; // a decimal is not a headcount (NK-0020)
  const nums = (grouped.match(/\d+/g) ?? []).map(Number);
  if (!nums.length || nums.length > 2 || nums.some((n) => !(n > 0))) return null;
  if (nums.length === 2) return { min: Math.min(...nums), max: Math.max(...nums) };
  const n = nums[0]!;
  if (/menos de|hasta|<|up to|under/.test(s)) return { min: null, max: n };
  if (/más de|\+|>|over|more than|al menos|desde/.test(s)) return { min: n, max: null };
  return { min: n, max: n };
}

/** «51–200 empleados», «123 empleados», «más de 500 empleados». */
export function employeesLabel(r: EmployeeRange): string | null {
  if (r.min != null && r.min === r.max) return `${r.min} empleados`;
  return employeesText(r.min, r.max);
}

/** Tamaño as the canonical text of the account (accounts.size stays text; the original is kept when it is not a headcount). */
export function normalizeSize(raw: string | null | undefined): Normalized<string> {
  const v = (raw ?? "").trim();
  if (!v) return { status: "empty" };
  const range = parseEmployees(v);
  const label = range ? employeesLabel(range) : null;
  return label ? { status: "ok", value: label } : unfit(v, "No es un número de empleados: se guarda como lo escribiste.");
}

/**
 * Importe: a number with at most two decimals. Accepts «1.234,56», «1,234.56», «€ 1200», «1 200» and numbers.
 * One separator followed by exactly three digits is thousands («1.234» = 1234); anything else is decimals.
 * Negatives are refused unless the caller allows them.
 */
export function normalizeAmount(raw: number | string | null | undefined, opts: { allowNegative?: boolean } = {}): Normalized<number> {
  if (raw === null || raw === undefined) return { status: "empty" };
  let n: number;
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return unfit(raw, "El importe no es un número.");
    n = raw;
  } else {
    let s = raw.replace(/[\s\u00a0]/g, "").replace(/[€$£]|(?<![\p{L}])(eur|usd|gbp|euros?)(?![\p{L}])/giu, "");
    if (!s) return { status: "empty" };
    const negative = /^[-−]/.test(s) || /^\(.*\)$/.test(s);
    s = s.replace(/^[-−(]+|\)$/g, "");
    if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return unfit(raw, "El importe no es un número.");
    const dots = (s.match(/\./g) ?? []).length;
    const commas = (s.match(/,/g) ?? []).length;
    let digits: string;
    if (dots && commas) {
      const dec = s.lastIndexOf(",") > s.lastIndexOf(".") ? "," : ".";
      const thou = dec === "," ? "." : ",";
      if (s.split(dec).length > 2) return unfit(raw, "El importe no es un número.");
      digits = s.split(thou).join("").replace(dec, ".");
    } else if (dots || commas) {
      const sep = dots ? "." : ",";
      const parts = s.split(sep);
      const grouped = parts.slice(1).every((p) => p.length === 3) && parts[0]!.length >= 1 && parts[0]!.length <= 3 && !/^0/.test(parts[0]!);
      if (parts.length > 2 && !grouped) return unfit(raw, "El importe no es un número.");
      digits = grouped ? parts.join("") : parts.join(".");
    } else digits = s;
    n = Number(digits);
    if (!Number.isFinite(n)) return unfit(raw, "El importe no es un número.");
    if (negative) n = -n;
  }
  if (n < 0 && !opts.allowNegative) return unfit(raw, "El importe no puede ser negativo.");
  return { status: "ok", value: Math.round(n * 100) / 100 };
}

export type SaveResult = {
  status: "ok" | "empty" | "unnormalized" | "uncatalogued";
  /** What to save: normalized when it fits, otherwise the original (trimmed when it is text). */
  value: unknown;
  original?: unknown;
  reason?: string;
};

const fromNormalized = <T>(n: Normalized<T>, raw: unknown): SaveResult =>
  n.status === "ok" ? { status: "ok", value: n.value } : n.status === "empty" ? { status: "empty", value: null } : { status: "unnormalized", value: typeof raw === "string" ? raw.trim() : raw, original: n.original, reason: n.reason };

/** The one entry point for saves: finds the concept of a column in the catalog and applies its rule (CA-3). */
export function normalizeForSave(table: string, column: string, raw: unknown): SaveResult {
  const b = bindingOf(table, column);
  if (!b) return { status: "uncatalogued", value: raw };
  switch (b.concept) {
    case "pais": return fromNormalized(normalizeCountry(raw as string | null), raw);
    case "paises": {
      const r = normalizeCountries(raw as string[] | string | null);
      if (r.unnormalized.length) return { status: "unnormalized", value: r.value, original: r.unnormalized, reason: "Hay países que no reconozco. Elige de la lista." };
      return r.value.length ? { status: "ok", value: r.value } : { status: "empty", value: [] };
    }
    case "tamano_empleados": {
      if (column === "size") return fromNormalized(normalizeSize(raw as string | null), raw);
      const n = normalizeAmount(raw as number | string | null);
      if (n.status !== "ok") return fromNormalized(n, raw);
      return Number.isInteger(n.value) && n.value > 0 ? { status: "ok", value: n.value } : { status: "unnormalized", value: raw, original: String(raw), reason: "Los empleados son un número entero mayor que 0." };
    }
    case "importe": return fromNormalized(normalizeAmount(raw as number | string | null), raw);
    case "origen_valor": return { status: "ok", value: raw };
    default: {
      if (typeof raw !== "string") return raw == null ? { status: "empty", value: null } : { status: "ok", value: raw };
      const v = raw.trim();
      if (!v) return { status: "empty", value: null };
      const allowed = allowedValues(table, column);
      if (allowed && !allowed.includes(v)) return { status: "unnormalized", value: v, original: v, reason: `${conceptById(b.concept).label}: valor fuera de la lista.` };
      return { status: "ok", value: v };
    }
  }
}
