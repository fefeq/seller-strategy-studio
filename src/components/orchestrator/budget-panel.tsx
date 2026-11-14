import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { orchestratorStatus } from "@/lib/orchestrator.functions";
import { errorText } from "@/lib/errors";
import { useMe } from "@/hooks/use-me";

export const NAMES: Record<string, string> = { apollo: "Apollo", clay: "Clay", parallel: "Parallel", firecrawl: "Firecrawl", perplexity: "Perplexity", apify: "Apify", drive: "Google Drive" };
export const eur = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;

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
    const { error } = await supabase.from("org_budgets").upsert({ monthly_limit: n, updated_at: new Date().toISOString() }, { onConflict: "org_id" });
    if (error) return toast.error(errorText(error));
    toast.success(n === null ? "Sin límite mensual." : `Límite mensual: ${eur(n)}.`);
    setLimit(null);
    qc.invalidateQueries({ queryKey: ["orchestrator-status"] });
  }

  if (!s) return null;
  const rows = Object.entries(s.byService).sort((a, b) => b[1].cost - a[1].cost);
  const state = s.paused ? "En pausa: lo automático espera al mes que viene" : s.warn ? "Cerca del límite" : "Dentro del límite";
  const others = Object.entries(s.otherCurrencies ?? {});
  return (
    <section className="mb-10">
      {s.paused ? (
        <p role="alert" className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
          Has llegado al 100 % del límite mensual. Lo automático con coste está en pausa; lo que pides tú sigue funcionando.
        </p>
      ) : s.warn ? (
        <p role="alert" className="mb-4 rounded-lg border bg-warning/20 p-3 text-sm">
          Has superado el 80 % del límite mensual. Al llegar al 100 % se pausará lo automático con coste.
        </p>
      ) : null}
      <p className="eyebrow">Nokko elige las fuentes</p>
      <h2 className="text-3xl">Gasto en integraciones este mes</h2>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Pides lo que necesitas y Nokko decide qué servicios usar, de más barato a más completo, y cambia a otro si uno falla. Al llegar al 80 % del límite avisa; al 100 % pausa lo automático, pero lo que pides tú sigue funcionando.</p>
      <div className="mt-4 grid gap-6 md:grid-cols-3">
        <div>
          <p className="font-display text-4xl">{eur(s.spent)}</p>
          <p className="text-sm text-muted-foreground">{s.limit == null ? "Sin límite mensual" : `de ${eur(s.limit)} · ${Math.round(s.pct * 100)} % · ${state}`}</p>
          {s.automatic > 0 && <p className="text-xs text-muted-foreground">{eur(s.automatic)} en trabajo automático.</p>}
          {others.map(([cur, v]) => (
            <p key={cur} className="text-xs text-muted-foreground">Además {v.toFixed(2).replace(".", ",")} {cur}, sin convertir: no hay un tipo de cambio verificado.</p>
          ))}
          {s.complete === false && <p className="text-xs font-medium">Presupuesto incompleto{s.unknown ? `: ${s.unknown} cargo${s.unknown === 1 ? "" : "s"} sin dato de coste` : ""}.</p>}
        </div>
        <div className="text-sm">
          <p className="eyebrow">Por servicio</p>
          {rows.length ? rows.map(([k, v]) => <p key={k} className="flex justify-between border-b py-1"><span>{NAMES[k] ?? k} · {v.calls}</span><span className="font-mono">{eur(v.cost)}{v.unknown ? ` + ${v.unknown} sin dato` : ""}</span></p>) : <p className="text-muted-foreground">Aún sin consumo este mes.</p>}
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
