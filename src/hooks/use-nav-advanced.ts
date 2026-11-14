import { useEffect, useState } from "react";
import { readAdvanced, saveAdvanced } from "@/lib/nav-advanced";

export function useNavAdvanced(userId: string | undefined) {
  const [state, setState] = useState<{ userId: string | undefined; value: boolean }>({
    userId: undefined,
    value: false,
  });
  useEffect(() => {
    try {
      setState({ userId, value: readAdvanced(window.localStorage, userId) });
    } catch {
      setState({ userId, value: false });
    }
  }, [userId]);
  const value = state.userId === userId && state.value;
  function setValue(next: boolean) {
    setState({ userId, value: next });
    try {
      saveAdvanced(window.localStorage, userId, next);
    } catch {
      /* Storage access may be blocked. */
    }
  }
  return [value, setValue] as const;
}
