// User-facing error text. Supabase/PostgREST, auth and network errors arrive in English; this turns
// them into «what happened + what to do» in Spanish (Nokko voice). Our own messages pass through.

type ErrLike = { message?: unknown; code?: unknown; status?: unknown } | string | null | undefined;

const GENERIC = "Algo ha fallado. Vuelve a intentarlo y, si se repite, recarga la página.";

/** [test on code or message, Spanish text]. First match wins. */
const RULES: [(code: string, msg: string, status: number) => boolean, string][] = [
  [(c) => c === "23505", "Ya existe un registro con esos datos. Revisa si está duplicado o cambia el valor."],
  [(c) => c === "23503", "Hay otros datos que dependen de este registro. Quita primero esa relación y vuelve a intentarlo."],
  [(c) => c === "23502", "Falta un campo obligatorio. Complétalo y vuelve a guardar."],
  [(c) => c === "23514" || c === "22P02" || c === "22007" || c === "22008", "Algún valor no tiene el formato correcto. Revisa los campos y vuelve a guardar."],
  [(c, m) => c === "42501" || /row-level security|permission denied|not allowed|insufficient privilege/i.test(m), "Tu rol no permite hacer este cambio. Pídeselo al Owner o a un Sales Leader de la empresa."],
  [(c, m, s) => c === "PGRST301" || /jwt|session.*(expired|missing)|refresh token|not authenticated|auth session missing/i.test(m) || s === 401, "Tu sesión ha caducado. Vuelve a entrar para seguir."],
  [(c, m) => c === "PGRST116" || /no rows|0 rows|not found/i.test(m), "Ese registro ya no existe. Recarga la página para ver los datos actuales."],
  [(_c, m) => /invalid login credentials/i.test(m), "El email o la contraseña no son correctos. Revísalos o entra con Google."],
  [(_c, m) => /email not confirmed/i.test(m), "Aún no has confirmado tu email. Abre el enlace que te enviamos y vuelve a entrar."],
  [(_c, m) => /user already registered|already been registered/i.test(m), "Ya hay una cuenta con ese email. Entra con tu contraseña o con Google."],
  [(_c, m) => /password should be|password is too weak|weak password/i.test(m), "La contraseña es demasiado débil. Usa al menos 8 caracteres combinando letras y números."],
  [(_c, m, s) => s === 429 || /rate limit|too many requests/i.test(m), "Demasiados intentos seguidos. Espera un minuto y vuelve a intentarlo."],
  [(_c, m, s) => s === 402 || /payment required|credits|quota/i.test(m), "Se ha agotado el saldo de IA del espacio de trabajo. Recárgalo en Lovable y vuelve a intentarlo."],
  [(_c, m) => /failed to fetch|networkerror|network request failed|load failed|fetch failed|timeout|timed out/i.test(m), "No hay conexión con el servidor. Comprueba tu conexión y vuelve a intentarlo."],
];

/** True when the browser dropped the request (offline, or a long call cut by the device) rather than the server answering. */
export function isNetworkError(e: unknown): boolean {
  const m = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed|timeout|timed out/i.test(m);
}

/** Heuristic: our own messages are Spanish; Supabase/auth/network ones are English. */
function looksSpanish(m: string) {
  return /[áéíóúñ¿¡]/i.test(m) || /\b(no|el|la|los|las|de|del|una?|para|con|ya|tu|es|hay|está)\b/i.test(m) && !/\b(the|is|are|not|failed|error|violates|invalid|with)\b/i.test(m);
}

/** Spanish, actionable text for any error value shown to a person. */
export function errorText(e: unknown, fallback = GENERIC): string {
  const err = e as ErrLike;
  const msg = typeof err === "string" ? err : typeof err?.message === "string" ? err.message : "";
  const code = typeof err === "object" && err && typeof err.code === "string" ? err.code : "";
  const status = typeof err === "object" && err && typeof err.status === "number" ? err.status : 0;
  for (const [test, text] of RULES) if (test(code, msg, status)) return text;
  if (msg && looksSpanish(msg)) return msg;
  return fallback;
}
