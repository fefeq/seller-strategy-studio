// Need-based actions: the user asks «Completar datos», Nokko picks the services and says which it used and the cost.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { orchestrateCompleteAccount, orchestratorStatus } from "@/lib/orchestrator.functions";
import { ENRICH_LABEL, enrichPatch, type EnrichChange, type EnrichField } from "@/lib/clay";
import { countryName } from "@/lib/assignment";
import { errorText } from "@/lib/errors";
import { useMe } from "@/hooks/use-me";

type Result = { changes: EnrichChange[]; found: boolean; sources: string; blocked: string | null };

export function CompleteAccount({ account, onSaved }: { account: { id: string; domain: string | null }; onSaved: () => void }) {
  const run = useServerFn(orchestrateCompleteAccount);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [r, setR] = useState<Result | null>(null);
  const [picked, setPicked] = useState<EnrichField[]>([]);

  async function go() {
    setBusy(true);
    try {
      const out = await run({ data: { accountId: account.id } });
      setR(out);
      setPicked(out.changes.filter((c) => c.empty).map((c) => c.field));
      qc.invalidateQueries({ queryKey: ["orchestrator-status"] });
    } catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  }
  async function apply() {
    if (!r) return;
    const patch = enrichPatch(r.changes, picked);
    if (!Object.keys(patch).length) return;
    setBusy(true);
    const { error } = await supabase.from("accounts").update(patch).eq("id", account.id);
    setBusy(false);
    if (error) return toast.error(errorText(error));
    toast.success("Cuenta completada.");
    setR(null);
    onSaved();
  }
  const show = (c: EnrichChange, v: string | null) => (v && c.field === "country" ? countryName(v) : v);
  const close = <button className="underline" onClick={() => setR(null)}>Cerrar</button>;

  if (!account.domain) return <p className="text-xs text-muted-foreground">Añade el dominio de la cuenta para que Nokko pueda completarla.</p>;
  if (!r) return <Button variant="outline" size="sm" onClick={go} disabled={busy}>{busy ? "Buscando datos…" : "Completar datos"}</Button>;
  if (r.blocked) return <p className="text-sm text-muted-foreground">{r.blocked} {close}</p>;
  if (!r.found) return <p className="text-sm text-muted-foreground">No hay datos públicos de {account.domain}. {r.sources && <span className="font-mono text-xs">{r.sources}.</span>} {close}</p>;
  if (!r.changes.length) return <p className="text-sm text-muted-foreground">Nada nuevo: los datos ya coinciden. {close}</p>;
  return (
    <div className="space-y-2 border-t pt-3">
      <p className="eyebrow">Datos encontrados</p>
      {r.changes.map((c) => (
        <label key={c.field} className="flex items-start gap-2 text-sm">
          <Checkbox className="mt-0.5" checked={picked.includes(c.field)} onCheckedChange={(v) => setPicked((p) => (v ? [...p, c.field] : p.filter((x) => x !== c.field)))} />
          <span className="min-w-0"><span className="font-medium">{ENRICH_LABEL[c.field]}:</span> {show(c, c.proposed)}{c.current && <span className="block text-xs text-muted-foreground">Ahora: {show(c, c.current)}</span>}</span>
        </label>
      ))}
      <p className="font-mono text-xs text-muted-foreground">{r.sources}</p>
      <div className="flex gap-2"><Button size="sm" onClick={apply} disabled={busy || !picked.length}>Aplicar</Button><Button size="sm" variant="ghost" onClick={() => setR(null)}>Cancelar</Button></div>
    </div>
  );
}

const NAMES: Record<string, string> = { apollo: "Apollo", clay: "Clay", parallel: "Parallel", firecrawl: "Firecrawl", perplexity: "Perplexity", apify: "Apify", drive: "Google Drive" };
const eur = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;

/** Owner sets the monthly limit; everyone sees this month's spend by service. */
export function BudgetPanel() {
  const status = useServerFn(orchestratorStatus);
  const qc = useQueryClient();
  const { data: me } = useMe();
  const isOwner = !!me?.roles.includes("owner");
  const { data: s } = useQuery({ queryKey: ["orchestrator-status"], queryFn: () => status() });
  const [limit, setLimit] = useState<string | null>(null);

  async function save() {
    const v = (limit ?? "").trim().replace(",", ".");
    const n = v === "" ? null : Number(v);
    if (n !== null && (!Number.isFinite(n) || n < 0)) return toast.error("Escribe un importe en euros, por ejemplo 50.");
    const { error } = await supabase.from("org_budgets").upsert({ monthly_limit: n, updated_at: new Date().toISOString() } as any, { onConflict: "org_id" });
    if (error) return toast.error(errorText(error));
    toast.success(n === null ? "Sin límite mensual." : `Límite mensual: ${eur(n)}.`);
    setLimit(null);
    qc.invalidateQueries({ queryKey: ["orchestrator-status"] });
  }

  if (!s) return null;
  const rows = Object.entries(s.byService).sort((a, b) => b[1].cost - a[1].cost);
  const state = s.paused ? "En pausa: lo automático espera al mes que viene" : s.warn ? "Cerca del límite" : "Dentro del límite";
  return (
    <section className="mb-10">
      <p className="eyebrow">Nokko elige las fuentes</p>
      <h2 className="text-3xl">Gasto en integraciones este mes</h2>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Pides lo que necesitas y Nokko decide qué servicios usar, de más barato a más completo, y cambia a otro si uno falla. Al llegar al 80 % del límite avisa; al 100 % pausa lo automático, pero lo que pides tú sigue funcionando.</p>
      <div className="mt-4 grid gap-6 md:grid-cols-3">
        <div>
          <p className="font-display text-4xl">{eur(s.spent)}</p>
          <p className="text-sm text-muted-foreground">{s.limit == null ? "Sin límite mensual" : `de ${eur(s.limit)} · ${Math.round(s.pct * 100)} % · ${state}`}</p>
          {s.automatic > 0 && <p className="text-xs text-muted-foreground">{eur(s.automatic)} en trabajo automático.</p>}
        </div>
        <div className="text-sm">
          <p className="eyebrow">Por servicio</p>
          {rows.length ? rows.map(([k, v]) => <p key={k} className="flex justify-between border-b py-1"><span>{NAMES[k] ?? k} · {v.calls}</span><span className="font-mono">{eur(v.cost)}</span></p>) : <p className="text-muted-foreground">Aún sin consumo este mes.</p>}
          <p className="mt-2 text-xs text-muted-foreground">Conectados: {s.connected.map((c) => NAMES[c] ?? c).join(", ") || "ninguno"}.</p>
        </div>
        <div className="space-y-2">
          <p className="eyebrow">Límite mensual</p>
          {isOwner ? (
            <>
              <div className="flex gap-2"><Input aria-label="Límite mensual en euros" inputMode="decimal" placeholder="Sin límite" value={limit ?? (s.limit == null ? "" : String(s.limit))} onChange={(e) => setLimit(e.target.value)} /><Button size="sm" onClick={save} disabled={limit === null}>Guardar</Button></div>
              <p className="text-xs text-muted-foreground">Déjalo vacío para no poner límite. Importes aproximados.</p>
            </>
          ) : <p className="text-sm text-muted-foreground">Solo el Owner puede cambiarlo.</p>}
        </div>
      </div>
    </section>
  );
}
