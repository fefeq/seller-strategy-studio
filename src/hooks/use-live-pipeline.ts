import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isSessionQuiet } from "@/lib/session-ending";

// Everything that reads deals or leads; refreshed when a lead arrives or a deal changes anywhere.
const KEYS = new Set(["deals", "deal-lines", "deal-stages", "products", "deals-real", "metrics", "segment-coverage", "home", "accounts", "people", "lead-events", "lead-sources", "setup", "suggestions", "leads"]);

/** Keeps pipeline, metrics and the strategy calculator live for the current company. */
export function useLivePipeline(orgId: string | null | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!orgId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        // NK-0169: no refetch with the previous account while signing out or switching.
        if (isSessionQuiet()) return;
        void qc.invalidateQueries({ predicate: (q) => KEYS.has(String(q.queryKey[0])) });
      }, 600);
    };
    const channel = supabase
      .channel(`pipeline-${orgId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "deals", filter: `org_id=eq.${orgId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "leads", filter: `org_id=eq.${orgId}` }, refresh)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "lead_events", filter: `org_id=eq.${orgId}` }, refresh)
      .subscribe();
    return () => { clearTimeout(timer); supabase.removeChannel(channel); };
  }, [orgId, qc]);
}
