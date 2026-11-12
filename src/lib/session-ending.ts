// NK-0150: «Cerrar sesión» is a window (cancel, logout request, SIGNED_OUT) in which the signed-in person's data
// must not be read again: the session is still valid until the logout request ends, so any refetch (a save, a
// finished job) would go out with the previous user's org id and token. A tiny store, like account-switch.ts.
import { useSyncExternalStore } from "react";
import { useSwitchingAccount } from "@/lib/account-switch";

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
