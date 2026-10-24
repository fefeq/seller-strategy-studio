// Web research on the account page: «Investigar con la web» (plan-of-account proposals with sources)
// and the Señales tab (recent news with why it matters). Searches run on the server with Firecrawl.
import { useState } from "react";
import { BackgroundButton } from "@/components/background";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty } from "@/components/page";
import { errorText } from "@/lib/errors";
import { SIGNAL_LABEL, ageText, type SignalKind } from "@/lib/web-research";
import { refreshSignals, researchAccount } from "@/lib/web-research.functions";

export const RESEARCH_LABEL: Record<string, string> = {
  current_state: "Situación actual", pains: "Dolores", initiatives: "Iniciativas estratégicas",
  competitors: "Competencia", risks: "Riesgos", whitespace: "Whitespace / oportunidades",
};

type Research = Awaited<ReturnType<typeof researchAccount>>;

/** Proposals for the plan of account; the ticked ones are added to (never replace) what is already written. */
export function AccountResearch({ accountId, hasDomain, onApply }: { accountId: string; hasDomain: boolean; onApply: (fields: Record<string, string>) => Promise<void> }) {
  const run = useServerFn(researchAccount);
  const [busy, setBusy] = useState(false);
  const [r, setR] = useState<Research | null>(null);
  const [picked, setPicked] = useState<string[]>([]);

  async function go() {
    setBusy(true);
    try {
      const res = await run({ data: { accountId } });
      setR(res);
      setPicked(Object.keys(res.fields));
    } catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  }
  async function apply() {
    if (!r) return;
    const sources = r.sources.map((s) => `[${s.title.replace(/[[\]]/g, "")}](${s.url})`).join(", ");
    const fields = Object.fromEntries(picked.filter((k) => r.fields[k as keyof Research["fields"]]).map((k) => [k, `${r.fields[k as keyof Research["fields"]]}${sources ? `\nFuentes: ${sources}` : ""}`]));
    setBusy(true);
    try { await onApply(fields); setR(null); } finally { setBusy(false); }
  }

  if (!hasDomain) return <p className="text-xs text-muted-foreground">Añade el dominio de la cuenta para investigarla en la web.</p>;
  if (!r) return <Button variant="outline" onClick={go} disabled={busy}>{busy ? "Leyendo su web y noticias…" : "Investigar con la web"}</Button>;
  return (
    <div className="space-y-3 border-t pt-4">
      <p className="eyebrow">Lo que dice la web</p>
      {r.summary && <p className="max-w-3xl text-sm">{r.summary}</p>}
      {Object.keys(r.fields).length === 0 && <p className="text-sm text-muted-foreground">Las fuentes no dan nada concreto para el plan de cuenta.</p>}
      {Object.entries(r.fields).map(([k, v]) => (
        <label key={k} className="flex items-start gap-2 text-sm">
          <Checkbox className="mt-0.5" checked={picked.includes(k)} onCheckedChange={(c) => setPicked(c ? [...picked, k] : picked.filter((x) => x !== k))} />
          <span className="min-w-0"><span className="font-medium">{RESEARCH_LABEL[k] ?? k}:</span> <span className="whitespace-pre-wrap">{v}</span></span>
        </label>
      ))}
      {(r as { via?: string }).via && <p className="font-mono text-xs text-muted-foreground">{(r as { via?: string }).via}</p>}
      {r.sources.length > 0 && (
        <p className="text-xs text-muted-foreground">Fuentes: {r.sources.map((s, i) => <span key={s.url}>{i > 0 && " · "}<a href={s.url} target="_blank" rel="noreferrer" className="underline">{s.title}</a></span>)}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={apply} disabled={busy || !picked.length}>Añadir al plan</Button>
        <Button size="sm" variant="ghost" onClick={() => setR(null)}>Descartar</Button>
      </div>
      <p className="text-xs text-muted-foreground">Se añade debajo de lo que ya tengas escrito, con las fuentes. Lo marcado como «(hipótesis)» es deducción, no un hecho.</p>
    </div>
  );
}

/** Recent news on the account, newest first, with why it matters for selling. */
export function SignalsTab({ accountId, hasDomain }: { accountId: string; hasDomain: boolean }) {
  const refresh = useServerFn(refreshSignals);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const { data = [], refetch, isLoading } = useQuery({
    queryKey: ["account-signals", accountId],
    queryFn: async () => (await supabase.from("account_signals").select("id,title,url,kind,summary,relevance,source,published_at,found_at").eq("account_id", accountId).order("found_at", { ascending: false }).limit(50)).data ?? [],
  });
  async function go() {
    setBusy(true);
    try {
      const r = await refresh({ data: { accountId } });
      toast.success(r.added ? `${r.added} ${r.added === 1 ? "novedad nueva" : "novedades nuevas"}.` : r.checked ? "Nada nuevo con interés comercial en el último mes." : "No hay noticias de esta empresa en el último mes.");
      await refetch();
      qc.invalidateQueries({ queryKey: ["account", accountId] }); // the LinkedIn page may have been found and saved
    } catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">Noticias del último mes sobre esta cuenta: rondas, contrataciones, lanzamientos, nombramientos y casos de éxito, buscadas con Firecrawl y Perplexity, más sus publicaciones y ofertas de empleo en LinkedIn. Las cuentas objetivo ABM se revisan solas cada semana y lo importante llega a Sugerencias.</p>
        <div className="flex flex-wrap gap-1">
          <Button variant="outline" onClick={go} disabled={busy || !hasDomain} title={hasDomain ? undefined : "Añade el dominio de la cuenta"}>{busy ? "Buscando…" : "Buscar novedades"}</Button>
          <BackgroundButton size="default" disabled={busy || !hasDomain} job={() => ({ kind: "account_signals", input: { accountId } })} />
        </div>
      </div>
      {isLoading ? null : data.length === 0 ? <Empty>Aún no hay señales de esta cuenta. Pulsa «Buscar novedades».</Empty> : (
        <ul className="divide-y border-t">
          {data.map((s) => (
            <li key={s.id} className="py-3 text-sm">
              <p className="eyebrow">{SIGNAL_LABEL[s.kind as SignalKind] ?? "Novedad"} · {s.source} · {ageText(s.published_at ?? s.found_at)}</p>
              <a href={s.url} target="_blank" rel="noreferrer" className="mt-1 block font-medium underline">{s.title}</a>
              {s.summary && <p className="mt-1">{s.summary}</p>}
              {s.relevance && <p className="mt-1 text-muted-foreground">Por qué importa: {s.relevance}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
