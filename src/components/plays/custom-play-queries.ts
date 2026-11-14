import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAll } from "@/lib/fetch-all";

export const CUSTOM_PLAYS_KEY = ["custom-plays"];
export const customPlaysQuery = queryOptions({
  queryKey: CUSTOM_PLAYS_KEY,
  queryFn: async () => {
    const r = await fetchAll((a, b) => supabase.from("custom_plays").select("*").order("created_at", { ascending: false }).order("id").range(a, b));
    if (r.truncated) throw new Error("No se pudieron leer todos los plays. Acota la lista antes de continuar.");
    return r.rows;
  },
});

export function customActivityQuery(playId: string, playKey: string) {
  return queryOptions({
    queryKey: [...CUSTOM_PLAYS_KEY, "activity", playId],
    queryFn: async () => {
      const [evidence, costs, suggestions, runs] = await Promise.all([
        fetchAll((a, b) => supabase.from("custom_play_evidence").select("*").eq("play_id", playId).order("created_at", { ascending: false }).order("id").range(a, b)),
        fetchAll((a, b) => supabase.from("custom_play_costs").select("*").eq("play_key", playKey).order("created_at", { ascending: false }).order("id").range(a, b)),
        fetchAll((a, b) => supabase.from("suggestions").select("id,title,body,status,created_at").eq("detector", "custom_play").like("dedupe_key", `custom_play:${playId}:%`).order("created_at", { ascending: false }).order("id").range(a, b)),
        fetchAll((a, b) => supabase.from("custom_play_runs").select("id,status,created_at").eq("play_id", playId).order("created_at", { ascending: false }).order("id").range(a, b)),
      ]);
      if ([evidence, costs, suggestions, runs].some(r => r.truncated)) throw new Error("La actividad no se pudo leer completa. Vuelve a intentarlo.");
      return { evidence: evidence.rows, costs: costs.rows, suggestions: suggestions.rows, runs: runs.rows };
    },
  });
}