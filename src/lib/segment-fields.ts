// Validation of the numeric benchmarks a person types in the segment table. Pure so the table can
// refuse a bad value before it reaches the database and say which field and why, instead of
// the generic «algún valor no tiene el formato correcto».

export type SegmentNumericField =
  | "priority"
  | "acv_min"
  | "acv_max"
  | "cycle_days"
  | "sdr_per_ae"
  | "ae_per_se"
  | "win_rate_target"
  | "ae_quota"
  | "cac_target"
  | "gross_margin_pct"
  | "payback_months";

type Rule = { label: string; min: number; max?: number; integer?: boolean };

export const SEGMENT_FIELD_RULES: Record<SegmentNumericField, Rule> = {
  priority: { label: "Prioridad", min: 1, integer: true },
  acv_min: { label: "ACV mín", min: 0 },
  acv_max: { label: "ACV máx", min: 0 },
  cycle_days: { label: "Ciclo (días)", min: 0, integer: true },
  sdr_per_ae: { label: "SDR por AE", min: 0 },
  ae_per_se: { label: "AE por SE", min: 0 },
  win_rate_target: { label: "Win rate obj. %", min: 0, max: 100 },
  ae_quota: { label: "Cuota anual AE", min: 0 },
  cac_target: { label: "CAC objetivo", min: 0 },
  gross_margin_pct: { label: "Margen bruto %", min: 0, max: 100 },
  payback_months: { label: "Payback obj. (m)", min: 0, integer: true },
};

export type FieldCheck = { ok: true; value: number | null } | { ok: false; error: string };

/**
 * Parses what the person typed. Empty means "no value" (null); 0 is a real value and is kept.
 * Accepts a decimal comma («97,5») because the app is in Spanish.
 */
export function checkSegmentField(
  field: SegmentNumericField,
  raw: string,
  segmentName?: string,
): FieldCheck {
  const rule = SEGMENT_FIELD_RULES[field];
  const where = segmentName ? ` en «${segmentName}»` : "";
  const text = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (text === "") return { ok: true, value: null };
  const n = Number(text);
  if (!Number.isFinite(n))
    return { ok: false, error: `«${rule.label}»${where} tiene que ser un número.` };
  if (rule.integer && !Number.isInteger(n))
    return { ok: false, error: `«${rule.label}»${where} tiene que ser un número entero.` };
  if (n < rule.min || (rule.max != null && n > rule.max)) {
    const range = rule.max != null ? `entre ${rule.min} y ${rule.max}` : `${rule.min} o más`;
    return {
      ok: false,
      error: `«${rule.label}»${where} tiene que estar ${range}. Has escrito ${raw.trim()}.`,
    };
  }
  return { ok: true, value: n };
}

/** ACV mín must not be above ACV máx once both are known. */
export function checkAcvRange(
  min: number | null | undefined,
  max: number | null | undefined,
  segmentName?: string,
): string | null {
  if (min == null || max == null || Number(min) <= Number(max)) return null;
  return `El ACV mín${segmentName ? ` de «${segmentName}»` : ""} es mayor que el ACV máx. Corrige uno de los dos.`;
}
