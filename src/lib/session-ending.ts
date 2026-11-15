// NK-0150: «Cerrar sesión» is a window (cancel, logout request, SIGNED_OUT) in which the signed-in person's data
// must not be read again: the session is still valid until the logout request ends, so any refetch (a save, a
// finished job) would go out with the previous user's org id and token. A tiny store, like account-switch.ts.
import { useSyncExternalStore } from "react";
import { isSwitchingAccount, useSwitchingAccount } from "@/lib/account-switch";

let ending = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const isSessionEnding = () => ending;

/** Synchronous: set before the query cache is touched or any request is made. */
export function beginSessionEnd() {
  if (ending) return;
  ending = true;
  emit();
}

export function endSessionEnd() {
  if (!ending) return;
  ending = false;
  emit();
}

/** The window is open: signing out, or the tab learned that another account signed in. Synchronous, unlike the hook. */
export const isSessionQuiet = () => ending || isSwitchingAccount();

/** Thrown by a read that found the window open when it was about to send: it never reaches the network. */
export class SessionEndedError extends Error {
  constructor() {
    super("session-ended");
    this.name = "SessionEndedError";
  }
}

/**
 * First line of a query function that reads with the signed-in person's ids. `enabled` only follows the window after
 * React re-renders, so a refetch asked in the same tick as the click (or a retry whose timer fires in between) would
 * still start; this check is synchronous and sits right before the request.
 */
export function assertSessionOpen() {
  if (isSessionQuiet()) throw new SessionEndedError();
}

/** A read that failed for a real reason. One stopped by the window above is not a failure: nothing was asked, so nothing is out of date. */
export const failedForReal = (q: { isError: boolean; error: unknown }) =>
  q.isError && !(q.error instanceof SessionEndedError);

/** React Query `retry` for those reads: up to `max` retries, none once the window is open (the next attempt would send with the previous user's ids). */
export const retryWhileOpen = (max: number) => (count: number, error: unknown) =>
  count < max && !isSessionQuiet() && !(error instanceof SessionEndedError);

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

/** True while the person is signing out or the tab is changing account: screens keep their queries off. */
export function useSessionQuiet() {
  const switching = useSwitchingAccount();
  const signingOut = useSyncExternalStore(subscribe, isSessionEnding, () => false);
  return switching || signingOut;
}
