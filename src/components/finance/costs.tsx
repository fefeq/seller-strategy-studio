import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency, useMe } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, Pick } from "@/components/fields";
import { DateField } from "@/components/date-field";
import { askConfirm } from "@/components/confirm-dialog";
import { errorText } from "@/lib/errors";
import { COST_CATEGORIES, monthlyCost, monthOf, type CostCategory } from "@/lib/finance";
import { useFinanceRefresh, type FinanceData } from "./data";
import { Card, Muted, NumberInput } from "./ui";

const EMPTY = { name: "", category: "people" as CostCategory, amount: null as number | null, starts_on: new Date().toISOString().slice(0, 8) + "01", ends_on: null as string | null, segment_id: "" };

export function FinanceCosts({ d }: { d: FinanceData }) {
  const { money } = useCurrency();
  const { data: me } = useMe();
  const isOwner = me?.roles.includes("owner");
  const refresh = useFinanceRefresh();
  const [f, setF] = useState(EMPTY);
  const lines = d.lines.map((l) => ({ ...l, amount: Number(l.amount) }));
  const now = monthlyCost(lines, monthOf(new Date()));
  const seg = (id: string | null) => d.segments.find((s) => s.id === id)?.name;

  async function add() {
    if (!f.name.trim() || f.amount == null) return toast.error("Pon un nombre y el importe mensual.");
    const { error } = await supabase.from("finance_cost_lines").insert({ name: f.name.trim(), category: f.category, amount: f.amount, starts_on: f.starts_on, ends_on: f.ends_on, segment_id: f.segment_id || null });
    if (error) return toast.error(errorText(error));
    setF(EMPTY); refresh();
  }
  async function end(id: string) {
    const { error } = await supabase.from("finance_cost_lines").update({ ends_on: new Date().toISOString().slice(0, 10) }).eq("id", id);
    if (error) return toast.error(errorText(error));
    refresh();
  }
  async function remove(id: string, name: string) {
    if (!(await askConfirm(`Borrar «${name}»`, { body: "Desaparece también de los meses pasados. Si solo ha dejado de pagarse, mejor termínalo.", confirmLabel: "Borrar" }))) return;
    const { error } = await supabase.from("finance_cost_lines").delete().eq("id", id);
    if (error) return toast.error(errorText(error));
    refresh();
  }

  return (
    <div className="space-y-6">
      <Card title={`Costes de este mes: ${money(now.total)}`} sub="Marketing y Ventas cuentan como captación (CAC). Coste de servir e Infraestructura, como coste de servir del segmento.">
        <div className="flex flex-wrap gap-2 text-xs">
          {Object.entries(now.byCategory).map(([k, v]) => <span key={k} className="rounded-full bg-paper-sunk px-2.5 py-1">{COST_CATEGORIES[k as CostCategory]} · {money(v ?? 0)}</span>)}
        </div>
      </Card>
      <Card title="Añadir coste mensual">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Nombre"><Input value={f.name} placeholder="p. ej. Sueldos, HubSpot, Google Ads" onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Tipo"><Pick value={f.category} options={COST_CATEGORIES} onChange={(v) => setF({ ...f, category: v as CostCategory })} /></Field>
          <Field label="Importe al mes"><NumberInput ariaLabel="Importe al mes" value={f.amount} onChange={(n) => setF({ ...f, amount: n })} /></Field>
          <Field label="Desde"><DateField aria-label="Desde" value={f.starts_on} onChange={(iso) => setF({ ...f, starts_on: iso ?? EMPTY.starts_on })} /></Field>
          <Field label="Hasta (opcional)"><DateField aria-label="Hasta" value={f.ends_on} onChange={(iso) => setF({ ...f, ends_on: iso })} /></Field>
          <Field label="Segmento (opcional)"><Pick value={f.segment_id} options={Object.fromEntries([["", "Toda la empresa"], ...d.segments.map((s) => [s.id, s.name])])} onChange={(v) => setF({ ...f, segment_id: v })} /></Field>
        </div>
        <Button className="mt-4" onClick={add}>Añadir coste</Button>
      </Card>
      <Card title="Líneas de coste">
        {lines.length === 0 ? <Muted>Sin costes todavía. Empieza por el equipo y las herramientas.</Muted> : (
          <ul className="divide-y text-sm">
            {lines.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span className="min-w-0 flex-1 break-words"><span className="font-medium">{l.name}</span> <span className="text-ink-mid">· {COST_CATEGORIES[l.category as CostCategory] ?? l.category}{seg(l.segment_id) ? ` · ${seg(l.segment_id)}` : ""}</span></span>
                <span className="font-mono text-xs text-muted-foreground">desde {l.starts_on}{l.ends_on ? ` hasta ${l.ends_on}` : ""}</span>
                <span className="w-28 text-right tabular-nums">{money(l.amount)}</span>
                {!l.ends_on && <Button size="sm" variant="ghost" onClick={() => end(l.id)}>Terminar hoy</Button>}
                {isOwner && <Button size="sm" variant="ghost" onClick={() => remove(l.id, l.name)}>Borrar</Button>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
