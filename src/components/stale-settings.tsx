import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Field } from "@/components/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { errorText } from "@/lib/errors";
import { readStaleDays, staleThreshold, thresholdText, CYCLE_SHARE, MIN_STALE_DAYS, MAX_STALE_DAYS } from "@/lib/stale";
import type { SegLike } from "@/lib/segment-coverage";
import type { Json } from "@/integrations/supabase/types";

/** The segments with their ACV ranges and the company's own cold threshold, if set. Key "stale-settings". */
export function useStaleSettings() {
  return useQuery({
    queryKey: ["stale-settings"],
    queryFn: async () => {
      const [seg, s] = await Promise.all([
        supabase.from("segments").select("id,name,acv_min,acv_max,win_rate_target,cac_target,gross_margin_pct,payback_months"),
        supabase.from("lead_settings").select("sla").maybeSingle(),
      ]);
      return { segments: (seg.data ?? []) as SegLike[], staleDays: readStaleDays(s.data?.sla), raw: s.data?.sla };
    },
  });
}

/** Owner and Sales Leader can replace the automatic threshold (a quarter of the real cycle, 14–60 days) with their own number. */
export function StaleSettings({ staleDays, cycleDays, canEdit, orgId }: { staleDays: number | null; cycleDays: number | null; canEdit: boolean; orgId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<string>(staleDays ? String(staleDays) : "");
  const auto = staleThreshold(cycleDays, null);

  async function save() {
    const n = v.trim() === "" ? null : Math.max(1, Math.round(Number(v) || 0));
    const { data: current } = await supabase.from("lead_settings").select("sla").eq("org_id", orgId).maybeSingle();
    const prev: { [k: string]: Json | undefined } = current?.sla && typeof current.sla === "object" && !Array.isArray(current.sla) ? { ...current.sla } : {};
    if (n) prev.stale_deal_days = n; else delete prev.stale_deal_days;
    const { error } = await supabase.from("lead_settings").upsert({ org_id: orgId, sla: prev, updated_at: new Date().toISOString() }, { onConflict: "org_id" });
    if (error) return toast.error(errorText(error));
    toast.success(n ? `Un deal se da por enfriado a los ${n} días.` : "Umbral automático restablecido.");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["stale-settings"] });
    qc.invalidateQueries({ queryKey: ["leads"] });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setV(staleDays ? String(staleDays) : ""); }}>
      <DialogTrigger asChild><Button variant="outline">Umbral de enfriado</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>¿Cuándo se enfría un deal?</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          Sin un número propio, Nokko usa un cuarto del ciclo de venta real de cada segmento (entre {MIN_STALE_DAYS} y {MAX_STALE_DAYS} días). Hoy, para la empresa: <strong>{thresholdText(auto)}</strong>.
        </p>
        <Field label="Días sin actividad para darlo por enfriado (vacío = automático)">
          {canEdit ? <Input type="number" min={1} placeholder={String(auto.days)} value={v} onChange={(e) => setV(e.target.value)} /> : <p className="font-mono">{staleDays ? `${staleDays} días` : `Automático (${auto.days} días)`}</p>}
        </Field>
        {canEdit ? <Button className="w-full" onClick={save}>Guardar</Button> : <p className="text-xs text-muted-foreground">Solo Owner o Sales Leader pueden cambiar el umbral.</p>}
        <p className="text-xs text-muted-foreground">Un cuarto ({Math.round(CYCLE_SHARE * 100)} %) del ciclo: en un ciclo de 90 días, 23 días parados ya es mucho.</p>
      </DialogContent>
    </Dialog>
  );
}
