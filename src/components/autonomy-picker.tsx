// E1: the person's agent level, visible and reversible. Saved per person (RLS: own row only).
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { ConvBlocks } from "@/components/conv-blocks";
import { autonomyBlocks } from "@/lib/autonomy-blocks";
import { AUTONOMY, parseAutonomy } from "@/lib/autonomy";
import { errorText } from "@/lib/errors";

export function useAutonomy() {
  const { data: me } = useMe();
  const uid = me?.user?.id;
  return useQuery({
    queryKey: ["autonomy", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_agent_prefs").select("autonomy").eq("user_id", uid!).maybeSingle();
      if (error) throw error;
      return parseAutonomy(data?.autonomy);
    },
  });
}

export function AutonomyPicker({ compact = false }: { compact?: boolean }) {
  const { data: me } = useMe();
  const uid = me?.user?.id;
  const q = useAutonomy();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  async function pick(v: string) {
    if (!uid) return;
    const level = parseAutonomy(v);
    setBusy(true);
    const { error } = await supabase.from("user_agent_prefs").upsert({ user_id: uid, autonomy: level, updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) return toast.error(errorText(error));
    await qc.invalidateQueries({ queryKey: ["autonomy", uid] });
    toast.success(`Nivel: ${AUTONOMY[level].label}. Puedes cambiarlo cuando quieras.`);
  }
  if (q.error) return <p className="text-sm text-destructive">{errorText(q.error)}</p>;
  const blocks = autonomyBlocks(q.data);
  return <ConvBlocks blocks={compact ? blocks.filter((b) => b.kind === "chips") : blocks.filter((b) => b.kind !== "link")} onChip={pick} busy={busy || q.isLoading} />;
}
