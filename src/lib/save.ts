// Server-confirmed writes. An update that matches no row (row-level security, a row already
// deleted) comes back from PostgREST without an error, so a screen that toasts «Guardado» on
// "no error" can lie. Every save that shows «Guardado» asks for the written row back
// (`.select(...)`) and passes the result through confirmed().

export const NOT_SAVED =
  "No se ha guardado: el servidor no confirmó el cambio. Puede que tu rol no lo permita o que el registro ya no exista. Recarga la página y vuelve a intentarlo.";

type Result<T> = { data: T | T[] | null; error: unknown };

/** Returns the written row(s); throws the server error, or NOT_SAVED when nothing was written. */
export async function confirmed<T>(q: PromiseLike<Result<T>>): Promise<T> {
  const { data, error } = await q;
  if (error) throw error;
  if (data == null || (Array.isArray(data) && data.length === 0)) throw new Error(NOT_SAVED);
  return (Array.isArray(data) ? data[0] : data) as T;
}
