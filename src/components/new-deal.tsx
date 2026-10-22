import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/hooks/use-me";
import { Field, Pick } from "@/components/fields";
import { DateField } from "@/components/date-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { applySetupItems } from "@/lib/agent.functions";
import { errorText } from "@/lib/errors";
import { firstOpenStage, stageOptions } from "@/lib/stages";
import { useStages } from "@/components/stage-settings";
import { useProducts } from "@/components/deal-lines";
import { BILLING_SUFFIX, dealTotals, lineFromProduct, type Billing } from "@/lib/deal-lines";

/**
 * New deal from the pipeline itself, with account, segment and stage at birth. It goes through the same
 * create_deal tool as the setup and the agent, so the account is found by name or created.
 */
export function NewDealButton() {
  const qc = useQueryClient();
  const { symbol, money } = useCurrency();
  const apply = useServerFn(applySetupItems);
  const { stages } = useStages();
  const { data: products = [] } = useProducts();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    name: "",
    account: "",
    segment: "",
    stage: "",
    amount: "",
    close: null as string | null,
    product: "",
  });
  const product = products.find((p) => p.id === f.product);
  const productAmount = product ? dealTotals([lineFromProduct(product)]).amount : null;
  const { data } = useQuery({
    queryKey: ["new-deal-options"],
    enabled: open,
    queryFn: async () => {
      const [a, s] = await Promise.all([
        supabase.from("accounts").select("id,name").order("name").limit(1000),
        supabase.from("segments").select("id,name").order("name"),
      ]);
      return { accounts: a.data ?? [], segments: s.data ?? [] };
    },
  });
  async function create() {
    setBusy(true);
    try {
      const existing = data?.accounts.find(
        (a) => a.name.trim().toLowerCase() === f.account.trim().toLowerCase(),
      );
      const args = Object.fromEntries(
        Object.entries({
          name: f.name.trim(),
          account_id: existing?.id,
          account_name: existing ? undefined : f.account.trim() || undefined,
          segment_id: f.segment || undefined,
          stage: f.stage || firstOpenStage(stages).key,
          amount: product ? undefined : f.amount === "" ? undefined : Number(f.amount.replace(",", ".")),
          product_id: product?.id,
          close_date: f.close ?? undefined,
        }).filter(([, v]) => v !== undefined),
      );
      const [r] = await apply({ data: { items: [{ tool: "create_deal", args }] } });
      if (!r?.ok) throw new Error(r?.error ?? "No se ha podido crear el deal.");
      toast.success(
        `Deal «${f.name.trim()}» creado${f.close ? "" : ". Ponle fecha de cierre para que cuente en la cobertura"}.`,
      );
      setF({ name: "", account: "", segment: "", stage: "", amount: "", close: null, product: "" });
      setOpen(false);
      qc.invalidateQueries();
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>+ Nuevo deal</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo deal</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Nombre del deal">
              <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </Field>
          </div>
          <Field label="Cuenta">
            <Input
              list="new-deal-accounts"
              placeholder="Existente o nueva"
              value={f.account}
              onChange={(e) => setF({ ...f, account: e.target.value })}
            />
            <datalist id="new-deal-accounts">
              {data?.accounts.map((a) => (
                <option key={a.id} value={a.name} />
              ))}
            </datalist>
          </Field>
          <Field label="Segmento">
            <Pick
              value={f.segment}
              options={{
                "": "Sin segmento",
                ...Object.fromEntries((data?.segments ?? []).map((s) => [s.id, s.name])),
              }}
              onChange={(v) => setF({ ...f, segment: v })}
            />
          </Field>
          <Field label="Etapa">
            <Pick
              value={f.stage || firstOpenStage(stages).key}
              options={stageOptions(stages)}
              onChange={(v) => setF({ ...f, stage: v })}
            />
          </Field>
          <Field label="Producto (opcional)">
            <Pick
              value={f.product}
              options={{ "": "Sin producto", ...Object.fromEntries(products.filter((p) => p.active).map((p) => [p.id, `${p.name} · ${money(Number(p.price))}${BILLING_SUFFIX[p.billing as Billing]}`])) }}
              onChange={(v) => setF({ ...f, product: v, name: f.name || products.find((p) => p.id === v)?.name || "" })}
            />
          </Field>
          <Field label={`Importe (ACV, ${symbol})`}>
            {productAmount != null ? (
              <p className="flex h-10 items-center font-mono text-sm md:h-9">{money(productAmount)} · del producto</p>
            ) : (
              <Input
                type="number"
                inputMode="decimal"
                value={f.amount}
                onChange={(e) => setF({ ...f, amount: e.target.value })}
              />
            )}
          </Field>
          <Field label="Fecha de cierre">
            <DateField value={f.close} onChange={(iso) => setF({ ...f, close: iso })} />
          </Field>
        </div>
        <p className="text-xs text-muted-foreground">
          Si la cuenta no existe, se crea con ese nombre.
        </p>
        <Button disabled={busy || !f.name.trim()} onClick={create}>
          {busy ? "Creando…" : "Crear deal"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
