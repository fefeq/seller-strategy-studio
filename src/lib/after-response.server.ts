// Work that must finish but must not delay the response (e.g. learning memories after a chat reply).
// On the published Worker the runtime puts waitUntil on each request; src/server.ts stores it per request
// here, so the promise keeps running after the answer is sent. Elsewhere (dev on Node) the promise simply
// runs on its own. Failures are logged, never thrown into the caller.
import { AsyncLocalStorage } from "node:async_hooks";
import { safeErrorLog } from "@/lib/agent/safe-error-log";

type Ctx = { waitUntil?: (p: Promise<unknown>) => void };
export const requestCtx = new AsyncLocalStorage<Ctx>();

export function afterResponse(label: string, work: () => Promise<unknown>) {
  const p = Promise.resolve().then(work).catch((e) => console.error(`afterResponse ${label}`, safeErrorLog(e)));
  const waitUntil = requestCtx.getStore()?.waitUntil;
  if (waitUntil) {
    try { waitUntil(p); } catch (e) { console.error("waitUntil", safeErrorLog(e)); }
  }
}
