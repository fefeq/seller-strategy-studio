// Offer versions of a deal (from the Postin CRM): each one freezes the deal lines as they are today, so you can
// see what was sent and what the client accepted. No costs are copied.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { Pick } from "@/components/fields";
import { useDealLines } from "@/components/deal-lines";
import { errorText } from "@/lib/errors";
import { OFFER_STATUS, offerFromLines, type OfferStatus } from "@/lib/crm";

export function DealOffers({ dealId, dealName }: { dealId: string; dealName: string }) {
  const qc = useQueryClient();
  const { money } = useCurrency();
  const { data: lines = [] } = useDealLines(dealId);
  const { data: offers = [] } = useQuery({ queryKey: ["offers", dealId], queryFn: async () => (await supabase.from("deal_offers").select("*").eq("deal_id", dealId).order("version", { ascending: false })).data ?? [] });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["offers", dealId] }); qc.invalidateQueries({ queryKey: ["timeline"] }); };

  async function create() {
    if (!lines.length) return toast.error("Añade primero las líneas de producto del deal.");
    const o = offerFromLines(lines, offers.map((x) => x.version));
    const valid = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    const { error } = await supabase.from("deal_offers").insert({ deal_id: dealId, title: `${dealName} · v${o.version}`, lines: o.lines, recurring_total: o.recurring_total, one_off_total: o.one_off_total, valid_until: valid });
    if (error) return toast.error(errorText(error));
    toast.success(`Oferta v${o.version} creada.`); refresh();
  }
  async function setStatus(id: string, status: string) {
    const { error } = await supabase.from("deal_offers").update({ status }).eq("id", id);
    if (error) return toast.error(errorText(error));
    refresh();
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-2xl">Ofertas</h3>
        <Button size="sm" variant="outline" onClick={create}>Crear oferta con las líneas actuales</Button>
      </div>
      {offers.length === 0 ? <p className="text-sm text-muted-foreground">Sin ofertas. Cada versión guarda las líneas tal como están al crearla.</p> : (
        <ul className="space-y-2">
          {offers.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border p-2.5 text-sm">
              <span className="font-medium">v{o.version}</span>
              <span className="min-w-0 flex-1 text-ink-mid">{money(Number(o.recurring_total))} al año{Number(o.one_off_total) ? ` + ${money(Number(o.one_off_total))} único` : ""}{o.valid_until ? ` · válida hasta ${o.valid_until}` : ""}</span>
              <div className="w-36"><Pick aria-label={`Estado de la oferta v${o.version}`} value={o.status} options={OFFER_STATUS} onChange={(v) => setStatus(o.id, v as OfferStatus)} /></div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
