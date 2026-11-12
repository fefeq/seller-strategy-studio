/** Browser storage that never breaks a screen: it may be missing (SSR, Node 26 without --localstorage-file) or throw (blocked, quota). */
export type StorageKind = "local" | "session";

function area(kind: StorageKind): Storage | null {
  try {
    const s = kind === "local" ? globalThis.localStorage : globalThis.sessionStorage;
    return typeof s === "undefined" || s === null ? null : s;
  } catch {
    return null;
  }
}

/** The stored value, or null when absent or when the storage is not usable. */
export function storageGet(kind: StorageKind, key: string): string | null {
  try {
    return area(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** True only when the value was written. A false is not an error: the caller keeps working without persistence. */
export function storageSet(kind: StorageKind, key: string, value: string): boolean {
  try {
    const s = area(kind);
    if (!s) return false;
    s.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function storageRemove(kind: StorageKind, key: string): void {
  try {
    area(kind)?.removeItem(key);
  } catch {
    /* nothing to remove, or blocked: both leave the key unusable anyway */
  }
}
