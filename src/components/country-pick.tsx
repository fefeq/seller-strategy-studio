import { Pick } from "@/components/fields";
import { COUNTRY_CODES, countryName } from "@/lib/assignment";

/** Country select (ISO codes, Spanish names): España and EE. UU. first, then LatAm, Europe and the rest. */
export function countryOptions(empty = "Sin país"): Record<string, string> {
  return { "": empty, ...Object.fromEntries(COUNTRY_CODES.map((c) => [c, countryName(c)])) };
}

export function CountryPick({ value, onChange, empty, "aria-label": ariaLabel }: { value: string | null; onChange: (v: string | null) => void; empty?: string; "aria-label"?: string }) {
  return <Pick aria-label={ariaLabel} value={value ?? ""} options={countryOptions(empty)} onChange={(v) => onChange(v || null)} />;
}
