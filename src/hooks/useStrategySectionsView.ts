import { useCallback, useEffect, useState } from "react";
import type { StrategyViewMode } from "@/lib/strategy-sections-view";

// Per-person, per-company preference. It is stored on this device only and
// never touches the saved strategy nor what other team members see.

export function strategyViewStorageKey(userId: string, orgId: string): string {
  return `nokko:strategy-view:${orgId}:${userId}`;
}

function readMode(key: string | null): StrategyViewMode {
  if (!key || typeof window === "undefined") return "core";
  try {
    return window.localStorage.getItem(key) === "all" ? "all" : "core";
  } catch {
    return "core";
  }
}

export function useStrategySectionsView(
  userId: string | null | undefined,
  orgId: string | null | undefined,
) {
  const key = userId && orgId ? strategyViewStorageKey(userId, orgId) : null;
  const [mode, setModeState] = useState<StrategyViewMode>(() => readMode(key));

  useEffect(() => {
    setModeState(readMode(key));
  }, [key]);

  const setMode = useCallback(
    (next: StrategyViewMode) => {
      setModeState(next);
      if (!key || typeof window === "undefined") return;
      try {
        window.localStorage.setItem(key, next);
      } catch {
        // Preference is optional; the screen keeps working without it.
      }
    },
    [key],
  );

  const showAll = useCallback(() => setMode("all"), [setMode]);
  const showCore = useCallback(() => setMode("core"), [setMode]);

  return { mode, setMode, showAll, showCore };
}
