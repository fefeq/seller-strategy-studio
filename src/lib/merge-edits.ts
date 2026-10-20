/**
 * A form copy of a server record that refreshes in the background (realtime, a stage change):
 * take the new server values, but keep every field the person changed since the previous server copy.
 */
export function mergeServerEdits<T extends Record<string, unknown>>(current: T, prevServer: T, nextServer: T): T {
  const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);
  const out = { ...nextServer } as Record<string, unknown>;
  for (const k of Object.keys(current)) if (!same(current[k], prevServer[k])) out[k] = current[k];
  return out as T;
}
