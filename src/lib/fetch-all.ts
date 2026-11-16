/**
 * Reads every row of a list in pages, so screens and detectors never stop silently at the
 * backend's 1000-row default. `page(from, to)` must return the same ordered query with `.range(from, to)`.
 * `max` is a safety ceiling; when it is hit `truncated` is true so the screen can say so.
 */
export const PAGE = 1000;

export async function fetchAll<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  max = 20_000,
): Promise<{ rows: T[]; truncated: boolean }> {
  const rows: T[] = [];
  for (let from = 0; from < max; from += PAGE) {
    const { data, error } = await page(from, Math.min(from + PAGE, max) - 1);
    if (error) throw new Error(error.message);
    const got = data ?? [];
    rows.push(...got);
    if (got.length < PAGE) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}
