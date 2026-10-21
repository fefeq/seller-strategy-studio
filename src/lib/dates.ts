// Dates typed by a person, in Spanish order. The browser's native date field follows the
// browser's language, not the app's: in an English browser «22/10/2026» became 10/02/22026.
// DateField (src/components/date-field.tsx) uses these instead.

export const MIN_YEAR = 2000;
export const MAX_YEAR = 2100;

export type DateCheck = { ok: true; iso: string | null } | { ok: false; error: string };

/** «22/10/2026», «22-10-2026», «22.10.26» or «2026-10-22» → «2026-10-22». Empty → null. */
export function parseSpanishDate(raw: string): DateCheck {
  const s = raw.trim();
  if (!s) return { ok: true, iso: null };
  let y: number, m: number, d: number;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(s);
  if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (dmy)
    [d, m, y] = [
      Number(dmy[1]),
      Number(dmy[2]),
      dmy[3].length === 2 ? 2000 + Number(dmy[3]) : Number(dmy[3]),
    ];
  else return { ok: false, error: "Escribe la fecha como día/mes/año, por ejemplo 22/10/2026." };
  if (y < MIN_YEAR || y > MAX_YEAR)
    return { ok: false, error: `El año tiene que estar entre ${MIN_YEAR} y ${MAX_YEAR}.` };
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d)
    return { ok: false, error: "Esa fecha no existe. Revisa el día y el mes." };
  return { ok: true, iso: date.toISOString().slice(0, 10) };
}

/** «2026-10-22» → «22/10/2026»; anything else passes through. */
export function formatSpanishDate(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso ?? "");
}
