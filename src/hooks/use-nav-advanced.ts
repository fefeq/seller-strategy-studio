import { useEffect, useState } from "react";
import { readAdvanced, saveAdvanced } from "@/lib/nav-advanced";

export function useNavAdvanced(userId: string | undefined) {
  const [state, setState] = useState<{ userId: string | undefined; value: boolean }>({ userId: undefined, value: false });
  useEffect(() => {
    setState({ userId, value: readAdvanced(window.localStorage, userId) });
  }, [userId]);
  const value = state.userId === userId && state.value;
  function setValue(next: boolean) {
    setState({ userId, value: next });
    saveAdvanced(window.localStorage, userId, next);
  }
  return [value, setValue] as const;
}