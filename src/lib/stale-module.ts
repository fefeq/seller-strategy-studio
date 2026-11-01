// A lazy route chunk can fail to load when the dev server restarts or a new
// version is published while the tab is open. A single full reload fixes it.
const PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
  /Unable to preload CSS/i,
];

export const STALE_RELOAD_KEY = "nokko-stale-reload-at";
const RELOAD_WINDOW_MS = 30_000;

export function isStaleModuleError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return PATTERNS.some((p) => p.test(message));
}

/** Reload only if we have not already reloaded for this reason recently (avoids loops). */
export function shouldReloadForStaleModule(lastReloadAt: number | null, now: number): boolean {
  return lastReloadAt === null || now - lastReloadAt > RELOAD_WINDOW_MS;
}

export function reloadOnceForStaleModule(error: unknown): boolean {
  if (typeof window === "undefined" || !isStaleModuleError(error)) return false;
  let last: number | null = null;
  try {
    const raw = window.sessionStorage.getItem(STALE_RELOAD_KEY);
    last = raw ? Number(raw) : null;
  } catch {
    last = null;
  }
  const now = Date.now();
  if (!shouldReloadForStaleModule(Number.isFinite(last) ? last : null, now)) return false;
  try {
    window.sessionStorage.setItem(STALE_RELOAD_KEY, String(now));
  } catch {
    // sessionStorage unavailable: still reload once.
  }
  window.location.reload();
  return true;
}
