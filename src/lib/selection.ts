// D1: multi-select for Cuentas, Leads and Personas lists. Pure, tested.
export function toggle(sel: ReadonlySet<string>, id: string): Set<string> {
  const n = new Set(sel);
  if (n.has(id)) n.delete(id);
  else n.add(id);
  return n;
}
/** Select every visible id, or clear when all are already selected. */
export function toggleAll(sel: ReadonlySet<string>, visible: readonly string[]): Set<string> {
  const all = visible.length > 0 && visible.every((id) => sel.has(id));
  return all
    ? new Set([...sel].filter((id) => !visible.includes(id)))
    : new Set([...sel, ...visible]);
}
/** Keep only ids still in the list (after a filter or a refresh). */
export function prune(sel: ReadonlySet<string>, ids: readonly string[]): Set<string> {
  const keep = new Set(ids);
  return new Set([...sel].filter((id) => keep.has(id)));
}
/** CSV with a header; quotes every field so commas, quotes and line breaks survive. */
export function toCsv(
  header: readonly string[],
  rows: readonly (readonly (string | number | null | undefined)[])[],
): string {
  // Fields starting with = + - @ (after spaces) are prefixed with ' so spreadsheets never run them as formulas.
  const q = (v: string | number | null | undefined) => {
    const raw = String(v ?? "");
    const safe = typeof v === "string" && /^\s*[=+\-@]/.test(raw) ? `'${raw}` : raw;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  return [header, ...rows].map((r) => r.map(q).join(",")).join("\r\n");
}
