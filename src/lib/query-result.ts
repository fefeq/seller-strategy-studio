/** Rows of a PostgREST read; throws its error (for errorText) so a failed read never looks like an empty list. */
export function rowsOrThrow<T>(res: { data: T[] | null; error: unknown }): T[] {
  if (res.error) throw res.error;
  return res.data ?? [];
}
