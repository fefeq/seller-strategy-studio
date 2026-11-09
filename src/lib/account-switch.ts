// NK-0111 (D-S3-3): another tab signed in as a different user. The authenticated app must not keep running on
// the previous user's ids (not even for a frame, not even one refetch), so the whole app is replaced by a
// blocking state and the page reloads as the new user. A tiny store read by AccountSwitchGate (in __root).
import { useSyncExternalStore } from "react";

let switching = false;
const listeners = new Set<() => void>();

export const accountSwitch = {
  /** Replaceable in tests. */
  reload: () => window.location.reload(),
};

export const isSwitchingAccount = () => switching;

/** Synchronous: the flag is set before the caller touches the query cache. */
export function beginAccountSwitch() {
  if (switching) return;
  switching = true;
  listeners.forEach((l) => l());
}

export function resetAccountSwitch() {
  switching = false;
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

export function useSwitchingAccount() {
  return useSyncExternalStore(subscribe, isSwitchingAccount, () => false);
}
