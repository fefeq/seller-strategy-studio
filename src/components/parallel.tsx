// Parallel on the screens: the deep report of an account (cited, with confidence), lists of companies that match
// the ICP to import as accounts, and the enrichment table. Long runs are polled here while the screen is open
import { CompanyLogo } from "@/components/company-logo";
// (and by Inngest when it is answering, so they also finish with nobody watching).
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty } from "@/components/page";
import { SaveToDriveButton } from "@/components/drive";
import { errorText } from "@/lib/errors";
import { countryName } from "@/lib/assignment";
import { cleanDomain } from "@/lib/leads";
import { ageText } from "@/lib/web-research";
import { REPORT_FIELDS, enrichPatch, reportMarkdown, type EnrichRow, type ListEntity, type Report } from "@/lib/parallel";
import { checkRunFn, enrichTableFn, startIcpListFn, startReportFn } from "@/lib/parallel.functions";

type Run = { id: string; kind: string; label: string; status: string; result: any; error: string | null; created_at: string; finished_at: string | null; account_id: string | null };

/** Checks running runs every few seconds while mounted; refreshes the list when one ends. */
function usePollRuns(runs: Run[], queryKey: unknown[]) {
  const check = useServerFn(checkRunFn);
  const qc = useQueryClient();
  const running = runs.filter((r) => r.status === "running").map((r) => r.id).join(",");
  useEffect(() => {
    if (!running) return;
    let stop = false;
    const tick = async () => {
      for (const id of running.split(",")) {
        const r = await check({ data: { id } }).catch(() => null);
        if (r && r.status !== "running") qc.invalidateQueries({ queryKey });
      }
    };
    void tick();
    const t = setInterval(() => { if (!stop) void tick(); }, 8_000);
    return () => { stop = true; clearInterval(t); };
  }, [running]);
}

const CONF: Record<string, string> = { low: "confianza baja", medium: "confianza media", high: "confianza alta" };

/** Account tab «Informe»: the deep report with sources per section. */
export function AccountReportTab({ accountId, accountName }: { accountId: string; accountName: string }) {
  const start = useServerFn(startReportFn);
  const qc = useQueryClient();
  const key = ["account-report", accountId];
  const { data: runs = [] } = useQuery({ queryKey: key, queryFn: async () => ((await supabase.from("research_runs").select("id,kind,label,status,result,error,created_at,finished_at,account_id").eq("account_id", accountId).eq("kind", "account_report").order("created_at", { ascending: false }).limit(5)).data ?? []) as Run[] });
  usePollRuns(runs, key);
  const [busy, setBusy] = useState(false);
  const latest = runs[0];
  const done = runs.find((r) => r.status === "done");
  const report = done?.result?.report as Report | undefined;
  async function go() {
    setBusy(true);
    try { const r = await start({ data: { accountId } }); toast.success(r.already ? "Ya hay un informe en marcha para esta cuenta." : "Investigando a fondo. Tarda de 2 a 5 minutos; puedes salir de la pantalla, te aviso al terminar."); qc.invalidateQueries({ queryKey: key }); }
    catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">Informe profundo con Parallel: negocio, finanzas, dirección, prioridades, tecnología, cómo compran, competencia, riesgos y oportunidades para nosotros. Cada sección lleva sus fuentes y el nivel de confianza.</p>
        <div className="flex flex-wrap gap-2">
          {report && <SaveToDriveButton title={`Informe de cuenta · ${accountName}`} accountId={accountId} markdown={() => reportMarkdown(accountName, report, new Date(done!.finished_at ?? done!.created_at))} />}
          <Button variant="outline" onClick={go} disabled={busy || latest?.status === "running"}>{latest?.status === "running" ? "Investigando…" : report ? "Actualizar informe" : busy ? "Lanzando…" : "Investigar a fondo"}</Button>
        </div>
      </div>
      {latest?.status === "running" && <p className="text-sm">Investigando desde {ageText(latest.created_at)}. Suele tardar de 2 a 5 minutos.</p>}
      {latest?.status === "failed" && <p className="text-sm text-destructive">{latest.error ?? "La investigación no ha podido terminar."}</p>}
      {!report && latest?.status !== "running" && <Empty>Aún no hay informe de esta cuenta. Pulsa «Investigar a fondo».</Empty>}
      {report && (
        <div className="space-y-5 border-t pt-4">
          <p className="eyebrow">Investigado {ageText(done!.finished_at ?? done!.created_at)}</p>
          {REPORT_FIELDS.map(([k, label]) => {
            const f = report[k];
            return (
              <section key={k} className="text-sm">
                <h3 className="font-display text-xl">{label}{f.confidence && <span className="ml-2 font-mono text-xs text-muted-foreground">{CONF[f.confidence]}</span>}</h3>
                <p className="mt-1 whitespace-pre-wrap">{f.value}</p>
                {f.sources.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Fuentes: {f.sources.map((s, i) => <span key={s.url}>{i > 0 && " · "}<a href={s.url} target="_blank" rel="noreferrer" className="underline">{s.title}</a></span>)}</p>}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Cuentas: «Buscar cuentas por ICP» → a list run, then review and import the companies. */
export function IcpListButton(props: { open?: boolean; onOpenChange?: (v: boolean) => void; hideTrigger?: boolean } = {}) {
  const start = useServerFn(startIcpListFn);
  const qc = useQueryClient();
  const [ownOpen, setOwnOpen] = useState(false);
  const open = props.open ?? ownOpen;
  const setOpen = props.onOpenChange ?? setOwnOpen;
  const [icpId, setIcpId] = useState("");
  const [criteria, setCriteria] = useState("");
  const [count, setCount] = useState(25);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const key = ["icp-lists"];
  const { data } = useQuery({
    queryKey: key, enabled: open,
    queryFn: async () => {
      const [runs, icps, accs] = await Promise.all([
        supabase.from("research_runs").select("id,kind,label,status,result,error,created_at,finished_at,account_id").eq("kind", "icp_list").order("created_at", { ascending: false }).limit(5),
        supabase.from("icp_profiles").select("id,industries,company_size,geography"),
        supabase.from("accounts").select("domain").not("domain", "is", null).limit(10000),
      ]);
      return { runs: (runs.data ?? []) as Run[], icps: icps.data ?? [], domains: new Set((accs.data ?? []).map((a) => cleanDomain(a.domain)).filter(Boolean) as string[]) };
    },
  });
  usePollRuns(data?.runs ?? [], key);
  const [viewId, setViewId] = useState<string | null>(null);
  const view = data?.runs.find((r) => r.id === viewId) ?? data?.runs.find((r) => r.status === "done");
  // «Ya en Nokko» is rechecked against today's accounts (imports since the search count).
  const entities = ((view?.status === "done" ? (view.result?.entities ?? []) : []) as ListEntity[]).map((e) => ({ ...e, existingId: e.existingId ?? (e.domain && data?.domains.has(e.domain) ? "yes" : null) }));
  const { data: known = [] } = useAccountOptions(entities.length > 0);
  const marked = markKnown(entities, known);
  const fresh = marked.filter((e) => !e.existingId);

  async function go() {
    setBusy(true);
    try { await start({ data: { icpId: icpId || null, criteria, count } }); toast.success(`Buscando ${count} empresas. Tarda de 5 a ${count > 25 ? 50 : 25} minutos; te aviso al terminar.`); qc.invalidateQueries({ queryKey: key }); }
    catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  }
  async function importPicked() {
    const rows = fresh.filter((e) => picked[e.url || e.name]).map((e) => ({ name: e.name, domain: e.domain }));
    if (!rows.length) return;
    const { error } = await supabase.from("accounts").insert(rows);
    if (error) return toast.error(errorText(error));
    toast.success(`${rows.length} ${rows.length === 1 ? "cuenta importada" : "cuentas importadas"}.`);
    setPicked({}); qc.invalidateQueries({ queryKey: ["accounts"] }); qc.invalidateQueries({ queryKey: key });
  }
  const icpLabel = (i: { industries: string | null; company_size: string | null; geography: string | null }) => [i.industries, i.company_size, i.geography].filter(Boolean).join(" · ") || "ICP sin datos";
  return <>
    {!props.hideTrigger && <Button variant="outline" onClick={() => setOpen(true)}>Buscar cuentas por ICP</Button>}
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader className="text-left">
          <DialogTitle>Buscar empresas por ICP a fondo</DialogTitle>
          <DialogDescription>Parallel busca empresas reales que encajen con tu perfil de cliente ideal. Revisa la lista y elige cuáles importar como cuentas.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 sm:grid-cols-[1fr_8rem]">
          <select aria-label="ICP" className="h-9 rounded-md border bg-background px-2 text-sm" value={icpId} onChange={(e) => setIcpId(e.target.value)}>
            <option value="">Sin ICP: solo los criterios</option>
            {(data?.icps ?? []).map((i) => <option key={i.id} value={i.id}>{icpLabel(i)}</option>)}
          </select>
          <select aria-label="Cuántas empresas" className="h-9 rounded-md border bg-background px-2 text-sm" value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {[25, 50, 100].map((n) => <option key={n} value={n}>{n} empresas</option>)}
          </select>
          <Textarea className="sm:col-span-2" rows={2} placeholder="Criterios adicionales: «Serie A en los últimos 12 meses», «usan HubSpot», «más de 50 empleados en España»…" value={criteria} onChange={(e) => setCriteria(e.target.value)} />
        </div>
        <Button onClick={go} disabled={busy || (!icpId && !criteria.trim())}>{busy ? "Lanzando…" : "Buscar empresas"}</Button>
        {(data?.runs ?? []).length > 0 && (
          <div className="space-y-1 border-t pt-3 text-sm">
            <p className="eyebrow">Búsquedas</p>
            {data!.runs.map((r) => (
              <button key={r.id} className={`block w-full text-left ${view?.id === r.id ? "font-medium" : ""}`} onClick={() => setViewId(r.id)}>
                {r.label} · <span className="text-muted-foreground">{r.status === "running" ? `buscando desde ${ageText(r.created_at)}` : r.status === "failed" ? `falló: ${r.error ?? ""}` : `${(r.result?.entities ?? []).length} empresas`}</span>
              </button>
            ))}
          </div>
        )}
        {view?.status === "done" && (
          <div className="space-y-2 border-t pt-3">
            {entities.length === 0 ? <Empty>Parallel no ha encontrado empresas con esos criterios.</Empty> : <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm">{fresh.length} nuevas · {entities.length - fresh.length} ya están en Nokko</p>
                <span className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setPicked(Object.fromEntries(fresh.map((e) => [e.url || e.name, true])))}>Marcar todas</Button>
                  <Button size="sm" onClick={importPicked} disabled={!Object.values(picked).some(Boolean)}>Importar {Object.values(picked).filter(Boolean).length || ""} como cuentas</Button>
                </span>
              </div>
              <ul className="divide-y border-t">
                {entities.map((e) => (
                  <li key={e.url || e.name} className="flex items-center gap-2 py-2 text-sm">
                    <Checkbox disabled={!!e.existingId} checked={!!picked[e.url || e.name]} onCheckedChange={(c) => setPicked({ ...picked, [e.url || e.name]: !!c })} />
                    <span className="min-w-0 flex-1 break-words"><CompanyLogo domain={e.domain} size={16} className="mr-1.5" />{e.name} {e.url && <a href={e.url} target="_blank" rel="noreferrer" className="ml-1 font-mono text-xs text-muted-foreground underline">{e.domain ?? e.url}</a>}</span>
                    {e.existingId && <span className="font-mono text-[10px] uppercase text-muted-foreground">ya en Nokko</span>}
                  </li>
                ))}
              </ul>
            </>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  </>;
}

type Acc = { id: string; name: string; domain: string | null; industry: string | null; size: string | null; country: string | null; notes: string | null };

/** Cuentas: complete up to 25 accounts at once; only empty fields are filled, funding and tools go to notes. */
export function EnrichTableButton() {
  const run = useServerFn(enrichTableFn);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<(EnrichRow & { name: string })[] | null>(null);
  const { data: accs = [] } = useQuery({ queryKey: ["accounts-enrich"], enabled: open, queryFn: async () => ((await supabase.from("accounts").select("id,name,domain,industry,size,country,notes").order("created_at", { ascending: false }).limit(300)).data ?? []) as Acc[] });
  const missing = useMemo(() => accs.filter((a) => !a.industry || !a.size || !a.country), [accs]);
  useEffect(() => { if (open && !Object.keys(sel).length) setSel(Object.fromEntries(missing.slice(0, 10).map((a) => [a.id, true]))); }, [open, missing.length]);
  const chosen = Object.entries(sel).filter(([, v]) => v).map(([k]) => k);
  async function go() {
    setBusy(true); setRows(null);
    try { setRows(await run({ data: { accountIds: chosen.slice(0, 25) } })); } catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  }
  async function apply() {
    let n = 0;
    for (const r of rows ?? []) {
      const a = accs.find((x) => x.id === r.account_id);
      if (!a) continue;
      const patch = enrichPatch(a, r);
      if (!Object.keys(patch).length) continue;
      const { error } = await supabase.from("accounts").update(patch).eq("id", a.id);
      if (error) { toast.error(errorText(error)); break; }
      n++;
    }
    toast.success(n ? `${n} ${n === 1 ? "cuenta completada" : "cuentas completadas"}. Solo se han rellenado los campos vacíos.` : "No había campos vacíos que rellenar.");
    setRows(null); qc.invalidateQueries({ queryKey: ["accounts"] }); qc.invalidateQueries({ queryKey: ["accounts-enrich"] });
  }
  return <>
    <Button variant="outline" onClick={() => setOpen(true)}>Completar cuentas</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader className="text-left">
          <DialogTitle>Completar cuentas con Parallel</DialogTitle>
          <DialogDescription>Sector, tamaño, país, financiación y herramientas de hasta 25 cuentas a la vez, con su fuente. Solo se rellenan los campos vacíos; financiación y herramientas van a las notas.</DialogDescription>
        </DialogHeader>
        {!rows && <>
          <p className="text-sm">{chosen.length} elegidas {chosen.length > 25 && <span className="text-destructive">(máximo 25)</span>} · {missing.length} con datos sin completar</p>
          <ul className="max-h-72 divide-y overflow-y-auto border-t">
            {accs.map((a) => (
              <li key={a.id} className="flex items-center gap-2 py-1.5 text-sm">
                <Checkbox checked={!!sel[a.id]} onCheckedChange={(c) => setSel({ ...sel, [a.id]: !!c })} />
                <span className="min-w-0 flex-1 break-words">{a.name}{a.domain && <span className="ml-1 font-mono text-xs text-muted-foreground">{a.domain}</span>}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{[!a.industry && "sector", !a.size && "tamaño", !a.country && "país"].filter(Boolean).join(", ") || "completa"}</span>
              </li>
            ))}
          </ul>
          <Button onClick={go} disabled={busy || !chosen.length || chosen.length > 25}>{busy ? "Investigando (unos segundos por cada 5 cuentas)…" : `Completar ${chosen.length}`}</Button>
        </>}
        {rows && (
          <div className="space-y-3">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead><tr className="border-b"><th className="py-1 pr-2">Cuenta</th><th className="pr-2">Sector</th><th className="pr-2">Tamaño</th><th className="pr-2">País</th><th className="pr-2">Financiación</th><th className="pr-2">Herramientas</th><th>Fuente</th></tr></thead>
                <tbody>{rows.map((r) => (
                  <tr key={r.account_id} className="border-b align-top">
                    <td className="py-1 pr-2 font-medium">{r.name}</td><td className="pr-2">{r.industry ?? "—"}</td><td className="pr-2">{r.size ?? "—"}</td><td className="pr-2">{r.country ? countryName(r.country) : "—"}</td><td className="pr-2">{r.funding ?? "—"}</td><td className="pr-2">{r.technology ?? "—"}</td>
                    <td>{r.source_url ? <a className="underline" href={r.source_url} target="_blank" rel="noreferrer">ver</a> : "—"}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="flex gap-2"><Button onClick={apply}>Aplicar a las cuentas</Button><Button variant="ghost" onClick={() => setRows(null)}>Descartar</Button></div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  </>;
}
