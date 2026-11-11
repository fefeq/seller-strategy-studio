// Activate or pause a play from any Plays GTM panel (kept apart so the catalogue and the teams share one copy). It writes through
// setPlayEnabled, which re-checks role and block on the server, and refreshes the company's play states so every panel shows the change.
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PLAY_STATES_KEY } from "./use-play-states";
import { errorText } from "@/lib/errors";
import { setPlayEnabled } from "@/lib/plays.functions";

/** `busy` is the id of the play being written, or null. */
export function usePlayToggle() {
  const qc = useQueryClient();
  const toggle = useServerFn(setPlayEnabled);
  const [busy, setBusy] = useState<string | null>(null);

  async function flip(id: string, enabled: boolean) {
    setBusy(id);
    try {
      const r = await toggle({ data: { play_id: id, enabled } });
      toast.success(r.mensaje);
      await qc.invalidateQueries({ queryKey: PLAY_STATES_KEY });
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  return { busy, flip };
}
