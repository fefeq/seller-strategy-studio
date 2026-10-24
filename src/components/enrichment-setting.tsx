import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { errorText } from "@/lib/errors";
import { readAutoEnrichment } from "@/lib/enrichment";
import type { Json } from "@/integrations/supabase/types";

/** Company switch: fill sector, size and country of new accounts from their own website. On by default; Owner and Sales Leader change it. */
export function EnrichmentSetting({ canEdit, orgId }: { canEdit: boolean; orgId: string }) {
  const qc = useQueryClient();
  const { data: on = true } = useQuery({
    queryKey: ["enrichment-setting", orgId],
    queryFn: async () => {
      const { data } = await supabase.from("lead_settings").select("sla").eq("org_id", orgId).maybeSingle();
      return readAutoEnrichment(data?.sla);
    },
  });

  async function change(next: boolean) {
    // The same json holds the lead limits and the cold-deal threshold: keep whatever else is there.
    const { data: current } = await supabase.from("lead_settings").select("sla").eq("org_id", orgId).maybeSingle();
    const prev: { [k: string]: Json | undefined } = current?.sla && typeof current.sla === "object" && !Array.isArray(current.sla) ? { ...current.sla } : {};
    if (next) delete prev.auto_enrichment; else prev.auto_enrichment = false;
    const { error } = await supabase.from("lead_settings").upsert({ org_id: orgId, sla: prev, updated_at: new Date().toISOString() }, { onConflict: "org_id" });
    if (error) return toast.error(errorText(error));
    toast.success(next ? "Nokko rellenará sector, tamaño y país de las cuentas nuevas." : "Nokko ya no rellenará datos de las cuentas nuevas.");
    qc.invalidateQueries({ queryKey: ["enrichment-setting", orgId] });
  }

  return (
    <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm" title="Lee la web de la empresa del lead y rellena solo lo que está vacío. Nunca cambia lo que escribiste tú.">
      <Switch checked={on} disabled={!canEdit} onCheckedChange={change} aria-label="Rellenar datos de la cuenta automáticamente" />
      Rellenar datos de la cuenta
    </label>
  );
}
