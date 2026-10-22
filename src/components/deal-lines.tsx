import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency, useMe } from "@/hooks/use-me";
import { Pick } from "@/components/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errorText } from "@/lib/errors";
import { confirmed } from "@/lib/save";
import { BILLING_LABELS, BILLING_SUFFIX, checkLineField, dealTotals, isOneOff, lineCost, lineFromProduct, lineRevenue, type Billing, type DealLine, type Product } from "@/lib/deal-lines";

/** The company's catalogue, active and not. Key "products". */
export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id,name,description,sku,price,cost,billing,active").order("name");
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });
}

export type SavedLine = DealLine & { id: string };

/** Lines of one deal, oldest first. Key ["deal-lines", dealId]. */
export function useDealLines(dealId: string | undefined) {
  return useQuery({
    queryKey: ["deal-lines", dealId],
    enabled: !!dealId,
    queryFn: async () => {
      const { data, error } = await supabase.from("deal_lines").select("id,product_id,name,quantity,unit_price,unit_cost,discount_pct,billing").eq("deal_id", dealId!).order("created_at");
      if (error) throw error;
      return (data ?? []) as SavedLine[];
    },
  });
}

type NumField = "quantity" | "unit_price" | "discount_pct" | "unit_cost";
const FIELDS: [NumField, string][] = [["quantity", "Cantidad"], ["unit_price", "Precio"], ["discount_pct", "Dto. %"], ["unit_cost", "Coste"]];

/**
 * What the deal includes. The database recomputes the deal's amount (one year) and margin after every
 * change, so the sheet only refreshes; the copied price and cost can be adjusted per deal.
 */
export function DealLinesEditor({ dealId, orgId }: { dealId: string; orgId: string | undefined }) {
  const qc = useQueryClient();
  const { money, symbol } = useCurrency();
  const { data: lines = [] } = useDealLines(dealId);
  const { data: products = [] } = useProducts();
  const [productId, setProductId] = useState("");
  const [busy, setBusy] = useState(false);
  const active = products.filter((p) => p.active);
  // Same rule as the database: price, cost and discount are for Owner, Sales Leader and Deal Desk.
  const { data: me } = useMe();
  const canPrice = (me?.roles ?? []).some((r) => r === "owner" || r === "sales_leader" || r === "deal_desk");

  async function run(fn: () => Promise<unknown>): Promise<boolean> {
    setBusy(true);
    let saved = false;
    try {
      await fn();
      saved = true;
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
      await qc.invalidateQueries({ queryKey: ["deal-lines", dealId] });
      qc.invalidateQueries({ queryKey: ["deals"] });
    }
    return saved;
  }
  async function add() {
    const p = products.find((x) => x.id === productId);
    if (!p || busy) return;
    await run(() => confirmed(supabase.from("deal_lines").insert({ ...lineFromProduct(p), deal_id: dealId, ...(orgId ? { org_id: orgId } : {}) } as never).select("id")));
    setProductId("");
  }
  function setField(l: SavedLine, field: NumField, input: HTMLInputElement) {
    const cur = l[field] == null || l[field] === "" ? null : Number(l[field]);
    const r = checkLineField(field, input.value);
    if (!r.ok) {
      input.value = cur == null ? "" : String(cur);
      return toast.error(r.error);
    }
    if (r.value === cur) return;
    const before = input.value;
    void run(() => confirmed(supabase.from("deal_lines").update({ [field]: r.value } as never).eq("id", l.id).select("id"))).then((saved) => {
      if (!saved && input.value === before) input.value = cur == null ? "" : String(cur);
    });
  }

  const t = dealTotals(lines);
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h3 className="text-2xl">Qué incluye</h3>
        <Link to="/products" className="text-xs text-signal">Catálogo →</Link>
      </div>
      {lines.length > 0 && (
        <div className="space-y-2">
          {lines.map((l) => {
            const rev = lineRevenue(l);
            const cost = lineCost(l);
            return (
              <div key={`${l.id}-${l.quantity}-${l.unit_price}-${l.discount_pct}-${l.unit_cost}`} className="rounded-md border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 break-words font-medium">{l.name} <span className="text-xs font-normal text-muted-foreground">· {BILLING_LABELS[l.billing as Billing]}</span></span>
                  <Button size="icon" variant="ghost" aria-label={`Quitar ${l.name}`} disabled={busy} onClick={() => run(() => confirmed(supabase.from("deal_lines").delete().eq("id", l.id).select("id")))}><Trash2 className="size-4" /></Button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {FIELDS.map(([field, label]) => (
                    <label key={field} className="space-y-1 text-xs text-muted-foreground">
                      <span>{label}{field === "unit_price" || field === "unit_cost" ? ` (${symbol}${BILLING_SUFFIX[l.billing as Billing]})` : ""}</span>
                      <Input
                        inputMode="decimal"
                        className="h-9"
                        placeholder={field === "unit_cost" ? "sin coste" : undefined}
                        defaultValue={l[field] == null ? "" : String(l[field])}
                        readOnly={busy || (field !== "quantity" && !canPrice)}
                        title={field !== "quantity" && !canPrice ? "Lo fija Deal Desk: pide el descuento desde el deal." : undefined}
                        onBlur={(e) => setField(l, field, e.currentTarget)}
                        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                      />
                    </label>
                  ))}
                </div>
                <p className="mt-2 flex justify-between text-xs">
                  <span className="text-muted-foreground">{isOneOff(l) ? `${money(rev)} una vez · fuera del ACV` : `${money(rev)} al año`}</span>
                  {isOneOff(l) ? <span className="text-muted-foreground">no cuenta en el margen</span> : <span className={cost == null ? "text-muted-foreground" : rev - cost >= 0 ? "text-success" : "text-destructive"}>{cost == null ? "sin coste: el deal queda sin margen" : `margen ${money(rev - cost)}`}</span>}
                </p>
              </div>
            );
          })}
          <div className="grid grid-cols-3 gap-2 rounded-md bg-muted/50 p-3 text-sm">
            <div><p className="text-xs text-muted-foreground">Importe (ACV)</p><p className="font-mono">{money(t.amount)}</p>{t.oneOff > 0 && <p className="text-[11px] text-muted-foreground">+ {money(t.oneOff)} pago único</p>}</div>
            <div><p className="text-xs text-muted-foreground">Margen</p><p className="font-mono">{t.margin == null ? "—" : money(t.margin)}</p></div>
            <div><p className="text-xs text-muted-foreground">Margen %</p><p className="font-mono">{t.marginPct == null ? "—" : `${Math.round(t.marginPct)} %`}</p></div>
          </div>
          <p className="text-xs text-muted-foreground">
            El importe del deal (ACV) es la suma de las líneas recurrentes en un año; los pagos únicos se suman aparte y no cuentan en el ACV ni en el margen.
            {t.unknownCost ? ` ${t.unknownCost === 1 ? "Una línea no tiene" : `${t.unknownCost} líneas no tienen`} coste: sin él no hay margen del deal.` : ""}
          </p>
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <div className="min-w-0 flex-1">
          <Pick
            aria-label="Producto para añadir al deal"
            value={productId}
            disabled={busy || active.length === 0}
            options={{ "": active.length ? "Añadir un producto…" : "Aún no hay productos en el catálogo", ...Object.fromEntries(active.map((p) => [p.id, `${p.name} · ${money(Number(p.price))}${BILLING_SUFFIX[p.billing as Billing]}`])) }}
            onChange={setProductId}
          />
        </div>
        <Button variant="outline" disabled={busy || !productId} onClick={add}>Añadir</Button>
      </div>
    </div>
  );
}
