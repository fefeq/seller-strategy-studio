// The company's play_states for the /plays screen (kept apart from the panel so that file only exports components).
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const PLAY_STATES_KEY = ["play-states"];

/** The company's play_states (RLS limits them to the current company). `undefined` while loading or when the read fails: the headline then says the section name. */
export function usePlayStates() {
  return useQuery({
    queryKey: PLAY_STATES_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from("play_states").select("play_id,enabled");
      if (error) throw error;
      return data ?? [];
    },
  });
}
