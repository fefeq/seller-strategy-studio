import type { QueryClient } from "@tanstack/react-query";

/** Refresh «Configura tu estrategia» after something it counts was saved. «setup» goes by prefix: it covers every org in the cache. */
export function invalidateSetup(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ["setup"] }),
    qc.invalidateQueries({ queryKey: ["setup-guide"] }),
  ]);
}
