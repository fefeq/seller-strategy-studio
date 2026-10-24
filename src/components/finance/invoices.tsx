import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency, useMe } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, Pick } from "@/components/fields";
import { DateField } from "@/components/date-field";
import { EntityCombobox } from "@/components/entity-combobox";
import { askConfirm } from "@/components/confirm-dialog";
import { errorText } from "@/lib/errors";
import { AGING_LABEL, arAging, type AgingBucket } from "@/lib/finance";
import { useFinanceRefresh, type FinanceData } from "./data";
import { Card, Muted, NumberInput } from "./ui";

const today = () => new Date().toISOString().slice(0, 10);
const plus30 = () => new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
type Form = { account: string; account_id: string | null; deal_id: string; number: string; issued_on: string; due_on: string | null; amount: number | null };
const EMPTY = (): Form => ({ account: "", account_id: null, deal_id: "", number: "", issued_on: today(), due_on: plus30(), amount: null });

export function FinanceInvoices({ d }: { d: FinanceData }) {
  const { money } = useCurrency();
  const { data: me } = useMe();
  const refresh = useFinanceRefresh();
  const [f, setF] = useState<Form>(EMPTY);
  const invoices = d.invoices.map((i) => ({ ...i, amount: Number(i.amount) }));
  const aging = arAging(invoices, today());
  const accName = (id: string | null) => d.accounts.find((a) => a.id === id)?.name ?? "Sin cuenta";
  const invoicedDeals = new Set(invoices.map((i) => i.deal_id).filter(Boolean));
  const toInvoice = d.deals.filter((x) => x.stage === "won" && !invoicedDeals.has(x.id));
  const dealsOf = d.deals.filter((x) => x.stage === "won" && (!f.account_id || x.account_id === f.account_id));

  function fromDeal(id: string) {
    const deal = d.deals.find((x) => x.id === id);
    if (!deal) return;
    setF({ ...EMPTY(), account: accName(deal.account_id), account_id: deal.account_id, deal_id: deal.id, amount: Number(deal.amount ?? 0) + Number(deal.one_off_amount ?? 0) });
    document.getElementById("new-invoice")?.scrollIntoView({ behavior: "smooth" });
  }
  async function add() {
    if (f.amount == null) return toast.error("Pon el importe de la factura.");
    const { error } = await supabase.from("finance_invoices").insert({ number: f.number.trim(), account_id: f.account_id, deal_id: f.deal_id || null, issued_on: f.issued_on, due_on: f.due_on, amount: f.amount });
    if (error) return toast.error(errorText(error));
    toast.success("Factura añadida."); setF(EMPTY()); refresh();
  }
  async function paid(id: string, on: string | null) {
    const { error } = await supabase.from("finance_invoices").update({ paid_on: on }).eq("id", id);
    if (error) return toast.error(errorText(error));
    refresh();
  }
  async function remove(id: string) {
    if (!(await askConfirm("Borrar esta factura", { confirmLabel: "Borrar" }))) return;
    const { error } = await supabase.from("finance_invoices").delete().eq("id", id);
    if (error) return toast.error(errorText(error));
    refresh();
  }

  return (
    <div className="space-y-6">
      <Card title={`Pendiente de cobro: ${money(aging.open)}`} sub="Por días de retraso (sin fecha de vencimiento cuenta a 30 días de la emisión).">
        <div className="grid gap-2 sm:grid-cols-5">
          {(Object.keys(AGING_LABEL) as AgingBucket[]).map((k) => (
            <div key={k} className={`rounded-lg border p-3 ${k !== "current" && aging.buckets[k].amount ? "border-signal/50" : ""}`}>
              <p className="eyebrow">{AGING_LABEL[k]}</p>
              <p className="mt-1 font-display text-xl tabular-nums">{money(aging.buckets[k].amount)}</p>
              <p className="text-xs text-muted-foreground">{aging.buckets[k].count} facturas</p>
            </div>
          ))}
        </div>
      </Card>

      {toInvoice.length > 0 && (
        <Card title="Deals ganados sin factura" sub="Del Pipeline: factúralos para que cuenten como ingreso real.">
          <ul className="divide-y text-sm">
            {toInvoice.slice(0, 10).map((x) => (
              <li key={x.id} className="flex flex-wrap items-center gap-3 py-2">
                <span className="min-w-0 flex-1 break-words">{x.name} <span className="text-ink-mid">· {accName(x.account_id)}</span></span>
                <span className="tabular-nums">{money(Number(x.amount ?? 0))}</span>
                <Button size="sm" variant="outline" onClick={() => fromDeal(x.id)}>Facturar</Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div id="new-invoice">
        <Card title="Nueva factura">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Cuenta"><EntityCombobox items={d.accounts} value={f.account} selectedId={f.account_id} onChange={(t, a) => setF({ ...f, account: t, account_id: a?.id ?? null })} placeholder="Busca entre tus cuentas" noun="cuenta (sin enlazar)" logos ariaLabel="Cuenta" /></Field>
            <Field label="Deal (opcional)"><Pick value={f.deal_id} options={Object.fromEntries([["", "—"], ...dealsOf.map((x) => [x.id, x.name])])} onChange={(v) => setF({ ...f, deal_id: v })} /></Field>
            <Field label="Número"><Input value={f.number} placeholder="2026-001" onChange={(e) => setF({ ...f, number: e.target.value })} /></Field>
            <Field label="Emitida"><DateField aria-label="Fecha de emisión" value={f.issued_on} onChange={(iso) => setF({ ...f, issued_on: iso ?? today() })} /></Field>
            <Field label="Vence"><DateField aria-label="Fecha de vencimiento" value={f.due_on} onChange={(iso) => setF({ ...f, due_on: iso })} /></Field>
            <Field label="Importe"><NumberInput ariaLabel="Importe" value={f.amount} onChange={(n) => setF({ ...f, amount: n })} /></Field>
          </div>
          <Button className="mt-4" onClick={add}>Añadir factura</Button>
        </Card>
      </div>

      <Card title="Facturas">
        {invoices.length === 0 ? <Muted>Sin facturas todavía.</Muted> : (
          <ul className="divide-y text-sm">
            {invoices.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span className="min-w-0 flex-1 break-words"><span className="font-medium">{i.number || "Sin número"}</span> <span className="text-ink-mid">· {accName(i.account_id)}</span></span>
                <span className="font-mono text-xs text-muted-foreground">{i.issued_on}{i.due_on ? ` · vence ${i.due_on}` : ""}</span>
                <span className="w-28 text-right tabular-nums">{money(i.amount)}</span>
                {i.paid_on
                  ? <Button size="sm" variant="ghost" title="Marcar como no cobrada" onClick={() => paid(i.id, null)}>Cobrada {i.paid_on}</Button>
                  : <Button size="sm" variant="outline" onClick={() => paid(i.id, today())}>Marcar cobrada</Button>}
                {me?.roles.includes("owner") && <Button size="sm" variant="ghost" onClick={() => remove(i.id)}>Borrar</Button>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
