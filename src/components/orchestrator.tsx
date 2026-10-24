// Need-based actions: the user asks «Completar datos», Nokko picks the services and says which it used and the cost.
import { useEffect, useRef, useState } from "react";
import { startBackgroundJob } from "@/lib/background.functions";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { JobProgress, useJob, type BgJob } from "@/components/background";
import { freshResult } from "@/lib/jobs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, Pick } from "@/components/fields";
import { CountryPick } from "@/components/country-pick";
import { CompanyLogo } from "@/components/company-logo";
import { IcpListButton } from "@/components/parallel";
import { orchestrateRevealPeople, orchestratorStatus, type orchestrateIcpCompanies, type orchestrateKeyPeople } from "@/lib/orchestrator.functions";
import { DEFAULT_LEVELS, LEVELS, LEVEL_LABEL, type Level } from "@/lib/orchestrator/search";
import { MAX_REVEAL } from "@/lib/apollo";
import { icpCompanyQuery } from "@/lib/icp";
import { ENRICH_LABEL, enrichPatch, type EnrichChange, type EnrichField } from "@/lib/clay";
import { countryName } from "@/lib/assignment";
import { errorText } from "@/lib/errors";
import { useMe } from "@/hooks/use-me";

type Job = { id: string; status: string; step: string | null; finished_at: string | null; result: { review?: EnrichChange[]; sources?: string; body?: string | null } | null };

/** «Completar datos» runs in the background: empty fields are written, values that differ wait here for a person. */
export function CompleteAccount({ account, onSaved }: { account: { id: string; domain: string | null }; onSaved: () => void }) {
  const start = useServerFn(startBackgroundJob);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [picked, setPicked] = useState<EnrichField[]>([]);
  const key = ["account-job", "complete_account", account.id];
  const { data: job } = useQuery({
    queryKey: key,
    queryFn: async () => (await supabase.from("background_jobs").select("id,status,step,finished_at,result").eq("kind", "complete_account").eq("target_id", account.id).order("created_at", { ascending: false }).limit(1).maybeSingle()).data as Job | null,
    refetchInterval: (q) => (q.state.data && ["queued", "running"].includes((q.state.data as Job).status) ? 2500 : false),
  });
  const running = busy || (!!job && ["queued", "running"].includes(job.status));
  const prev = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (prev.current && ["queued", "running"].includes(prev.current) && job?.status === "done") {
      onSaved();
      qc.invalidateQueries({ queryKey: ["orchestrator-status"] });
      setPicked((job.result?.review ?? []).map((c) => c.field));
    }
    prev.current = job?.status;
  }, [job?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  function go() {
    setBusy(true);
    toast.success("En marcha. Te aviso cuando termine; puedes seguir trabajando.");
    start({ data: { kind: "complete_account", input: { accountId: account.id } } })
      .catch((e) => toast.error(errorText(e)))
      .finally(() => { setBusy(false); qc.invalidateQueries({ queryKey: key }); });
    setTimeout(() => qc.invalidateQueries({ queryKey: key }), 900);
  }
  async function apply(review: EnrichChange[]) {
    const patch = enrichPatch(review, picked);
    if (!Object.keys(patch).length) return;
    const { error } = await supabase.from("accounts").update(patch).eq("id", account.id);
    if (error) return toast.error(errorText(error));
    toast.success("Cuenta actualizada.");
    setDismissed(job?.id ?? null);
    onSaved();
  }
  const show = (c: EnrichChange, v: string | null) => (v && c.field === "country" ? countryName(v) : v);

  if (!account.domain) return <p className="text-xs text-muted-foreground">Añade el dominio de la cuenta para que Nokko pueda completarla.</p>;
  if (running) return <p className="text-sm text-muted-foreground">Trabajando · {job?.step ?? "en cola"}…</p>;
  const review = job?.status === "done" && job.id !== dismissed && job.finished_at && Date.now() - new Date(job.finished_at).getTime() < 24 * 3_600_000 ? job.result?.review ?? [] : [];
  if (!review.length) return <Button variant="outline" size="sm" onClick={go}>Completar datos</Button>;
  return (
    <div className="space-y-2 border-t pt-3">
      <p className="eyebrow">Datos distintos a los tuyos</p>
      {review.map((c) => (
        <label key={c.field} className="flex items-start gap-2 text-sm">
          <Checkbox className="mt-0.5" checked={picked.includes(c.field)} onCheckedChange={(v) => setPicked((p) => (v ? [...p, c.field] : p.filter((x) => x !== c.field)))} />
          <span className="min-w-0"><span className="font-medium">{ENRICH_LABEL[c.field]}:</span> {show(c, c.proposed)}{c.current && <span className="block text-xs text-muted-foreground">Ahora: {show(c, c.current)}</span>}</span>
        </label>
      ))}
      {job?.result?.body && <p className="font-mono text-xs text-muted-foreground">{job.result.body}</p>}
      <div className="flex gap-2"><Button size="sm" onClick={() => apply(review)} disabled={!picked.length}>Aplicar</Button><Button size="sm" variant="ghost" onClick={() => setDismissed(job!.id)}>Mantener los míos</Button></div>
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

// ---------------- «Buscar personas clave» (account map) ----------------

type PeopleRes = Awaited<ReturnType<typeof orchestrateKeyPeople>>;
type PeopleJob = { search?: PeopleRes; criteria?: { titles: string[]; levels: Level[] } };
const splitList = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

export function KeyPeopleButton({ accountId, hasDomain, onAdded }: { accountId: string; hasDomain: boolean; onAdded: () => void }) {
  const search = useSearch({ strict: false }) as { people?: string };
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  // From the notice («Encontré 4 personas clave…»): the link opens the results straight away.
  useEffect(() => { if (search.people) { setOpen(true); void navigate({ to: ".", search: ((s: Record<string, unknown>) => ({ ...s, people: undefined })) as never, replace: true }); } }, [search.people]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline" disabled={!hasDomain} title={hasDomain ? undefined : "Añade el dominio de la cuenta para buscar personas"}>Buscar personas clave</Button></DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>Buscar personas clave</DialogTitle></DialogHeader>
        {open && <KeyPeople accountId={accountId} onAdded={onAdded} />}
      </DialogContent>
    </Dialog>
  );
}

function KeyPeople({ accountId, onAdded }: { accountId: string; onAdded: () => void }) {
  const reveal = useServerFn(orchestrateRevealPeople);
  const qc = useQueryClient();
  const { job, running, start, cancel } = useJob<"key_people", PeopleJob>("key_people", { targetId: accountId, onDone: () => { setPicked(new Set()); qc.invalidateQueries({ queryKey: ["orchestrator-status"] }); } });
  const [dismissed, setDismissed] = useState<string | null>(null);
  const done = freshResult<BgJob<PeopleJob>>(job, dismissed);
  const res = done?.result?.search ?? null;
  const [titles, setTitles] = useState("");
  const [levels, setLevels] = useState<Level[]>(DEFAULT_LEVELS);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<Map<string, string>>(new Map());
  const [phone, setPhone] = useState(false);
  const [busy, setBusy] = useState(false);
  // The last search's criteria come back with its results.
  const loaded = useRef<string | null>(null);
  useEffect(() => {
    if (!done || loaded.current === done.id) return;
    loaded.current = done.id;
    const c = done.result?.criteria;
    if (c) { setTitles(c.titles.join(", ")); if (c.levels.length) setLevels(c.levels); }
  }, [done?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function run(more: boolean) {
    if (more && (!res?.cursor || !job)) return;
    void start({ accountId, titles: splitList(titles), levels, cursor: more ? res!.cursor : null, ...(more ? { prevJobId: job!.id } : {}) });
  }

  async function add() {
    if (!res) return;
    const chosen = res.rows.filter((p) => picked.has(p.key));
    if (!chosen.length) return;
    setBusy(true);
    try {
      const next = new Map(added);
      if (res.masked) {
        const r = await reveal({ data: { accountId, apolloIds: chosen.map((p) => p.apolloId!), phone } });
        for (const x of r.people) next.set(x.contact.apolloId, x.contact.email ? `${x.contact.name} · ${x.contact.email}` : `${x.contact.name} · sin email`);
        toast.success(`${r.people.length} ${r.people.length === 1 ? "persona añadida" : "personas añadidas"} al mapa. ${r.sources}.${phone ? " Los móviles llegan en unos minutos." : ""}`);
      } else {
        const { error } = await supabase.from("stakeholders").insert(chosen.map((p) => ({ account_id: accountId, name: p.name, title: p.title, linkedin_url: p.linkedin })));
        if (error) throw error;
        for (const p of chosen) next.set(p.key, `${p.name} · añadida`);
        toast.success(`${chosen.length} ${chosen.length === 1 ? "persona añadida" : "personas añadidas"} al mapa de poder.`);
      }
      setAdded(next);
      setPicked(new Set());
      onAdded();
      qc.invalidateQueries({ queryKey: ["orchestrator-status"] });
    } catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  }

  const max = res?.masked ? MAX_REVEAL : 50;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Dime qué cargos buscas y Nokko elige la fuente: primero la gratuita y, si no encuentra a nadie, otra. Trabaja en segundo plano: puedes cerrar esta ventana y te aviso al terminar.</p>
      <Field label="Cargos"><Input value={titles} placeholder="Head of Sales, CFO, Operations" onChange={(e) => setTitles(e.target.value)} /></Field>
      <div>
        <p className="eyebrow mb-2">Nivel</p>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {LEVELS.map((s) => <label key={s} className="flex items-center gap-2 text-sm"><Checkbox checked={levels.includes(s)} onCheckedChange={(v) => setLevels(v ? [...levels, s] : levels.filter((x) => x !== s))} />{LEVEL_LABEL[s]}</label>)}
        </div>
      </div>
      {running ? <JobProgress job={job} onCancel={cancel} /> : (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => run(false)}>{res ? "Buscar de nuevo" : "Buscar personas"}</Button>
          {res && <button type="button" className="text-sm underline underline-offset-4" onClick={() => setDismissed(done!.id)}>Limpiar resultados</button>}
        </div>
      )}
      {!running && job?.status === "failed" && <p className="text-sm text-muted-foreground">La última búsqueda falló: {job.error}</p>}
      {res?.blocked && <p className="text-sm text-muted-foreground">{res.blocked}</p>}
      {res && !res.blocked && res.rows.length === 0 && <p className="text-sm text-muted-foreground">No hay personas con esos criterios en esta empresa. Prueba con otros cargos.</p>}
      {res && res.rows.length > 0 && (
        <div className="space-y-3">
          {res.masked && <p className="text-xs text-muted-foreground">Esta fuente oculta el apellido y el contacto hasta añadir a la persona; añadirla cuesta unos 0,02 € por persona (máximo {MAX_REVEAL} a la vez).</p>}
          <ul className="divide-y border-t">
            {res.rows.map((p) => {
              const done = added.get(p.key) ?? (p.existingId ? "Ya está en el mapa" : null);
              return (
                <li key={p.key} className="flex items-start gap-3 py-2 text-sm">
                  {!done ? <Checkbox aria-label={`Elegir ${p.name}`} className="mt-0.5" disabled={!picked.has(p.key) && picked.size >= max} checked={picked.has(p.key)} onCheckedChange={(v) => { const n = new Set(picked); v ? n.add(p.key) : n.delete(p.key); setPicked(n); }} /> : <span className="w-4" />}
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{done && added.has(p.key) ? done : p.name}</span>{p.title && <span className="text-muted-foreground"> · {p.title}</span>}
                    <span className="block text-xs text-muted-foreground">
                      {done ?? (res.masked ? [p.hasEmail ? "tiene email" : "sin email conocido", p.hasPhone ? "tiene teléfono" : null].filter(Boolean).join(" · ") : <>{p.location}{p.linkedin && <> · <a href={p.linkedin} target="_blank" rel="noreferrer" className="underline">LinkedIn</a></>}</>)}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="font-mono text-xs text-muted-foreground">{res.sources}</p>
          <div className="flex flex-wrap items-center gap-3">
            {res.cursor && <Button variant="outline" size="sm" disabled={busy || running} onClick={() => run(true)}>Traer más</Button>}
            {res.masked && <label className="flex items-center gap-2 text-sm"><Checkbox checked={phone} onCheckedChange={(v) => setPhone(!!v)} />Pedir también el móvil (cuesta más)</label>}
            <Button disabled={busy || !picked.size} onClick={add}>Añadir {picked.size || ""} al mapa</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- «Buscar empresas por ICP» (Cuentas) ----------------

type CompaniesRes = Awaited<ReturnType<typeof orchestrateIcpCompanies>>;

type CompaniesJob = { search?: CompaniesRes; query?: { keywords?: string[]; countries?: string[]; minEmployees?: number | null; maxEmployees?: number | null } };

export function IcpCompaniesButton() {
  const search = useSearch({ strict: false }) as { icp?: string | number };
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [deepOpen, setDeepOpen] = useState(false);
  useEffect(() => { if (search.icp) { setOpen(true); void navigate({ to: ".", search: ((s: Record<string, unknown>) => ({ ...s, icp: undefined })) as never, replace: true }); } }, [search.icp]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button variant="outline">Buscar empresas por ICP</Button></DialogTrigger>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader><DialogTitle>Buscar empresas por ICP</DialogTitle></DialogHeader>
          {open && <IcpCompanies onDeep={() => { setOpen(false); setDeepOpen(true); }} />}
        </DialogContent>
      </Dialog>
      <IcpListButton open={deepOpen} onOpenChange={setDeepOpen} hideTrigger />
    </>
  );
}

function IcpCompanies({ onDeep }: { onDeep: () => void }) {
  const qc = useQueryClient();
  const { job, running, start, cancel } = useJob<"icp_companies", CompaniesJob>("icp_companies", { onDone: () => { setPicked(new Set()); qc.invalidateQueries({ queryKey: ["orchestrator-status"] }); } });
  const [dismissed, setDismissed] = useState<string | null>(null);
  const done = freshResult<BgJob<CompaniesJob>>(job, dismissed);
  const [keywords, setKeywords] = useState("");
  const [countries, setCountries] = useState<string[]>([]);
  const [minEmp, setMinEmp] = useState("");
  const [maxEmp, setMaxEmp] = useState("");
  const [imported, setImported] = useState<Map<string, string>>(new Map());
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState(false);
  const [busy, setBusy] = useState(false);
  const { data: icps = [] } = useQuery({ queryKey: ["clay-icps"], queryFn: async () => (await supabase.from("icp_profiles").select("*").order("name")).data ?? [] });
  const res = done?.result?.search ? { ...done.result.search, rows: done.result.search.rows.map((r) => (r.domain && imported.has(r.domain) ? { ...r, existingId: imported.get(r.domain)! } : r)) } : null;
  const loaded = useRef<string | null>(null);
  useEffect(() => {
    if (!done || loaded.current === done.id) return;
    loaded.current = done.id;
    const q = done.result?.query;
    if (q) { setKeywords((q.keywords ?? []).join(", ")); setCountries(q.countries ?? []); setMinEmp(q.minEmployees ? String(q.minEmployees) : ""); setMaxEmp(q.maxEmployees ? String(q.maxEmployees) : ""); }
  }, [done?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function useIcp(id: string) {
    const icp = icps.find((i) => i.id === id);
    if (!icp) return;
    const q = icpCompanyQuery(icp).query;
    setKeywords((q.keywords ?? []).join(", "));
    setCountries(q.countries ?? []);
    setMinEmp(q.minEmployees ? String(q.minEmployees) : "");
    setMaxEmp(q.maxEmployees ? String(q.maxEmployees) : "");
    toast.success(`Criterios cargados desde «${icp.name}». Revísalos antes de buscar.`);
  }

  function run(more: boolean) {
    if (more && (!res?.cursor || !job)) return;
    void start({ cursor: more ? res!.cursor : null, query: { keywords: splitList(keywords), countries, minEmployees: Number(minEmp) || null, maxEmployees: Number(maxEmp) || null }, ...(more ? { prevJobId: job!.id } : {}) });
  }

  async function importPicked() {
    if (!res) return;
    const chosen = res.rows.filter((r) => r.domain && picked.has(r.domain) && !r.existingId);
    if (!chosen.length) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.from("accounts").insert(chosen.map((r) => ({ name: r.name, domain: r.domain, industry: r.industry, size: r.size, country: r.country, notes: r.description, is_target: target }))).select("id,domain");
      if (error) throw error;
      await supabase.from("account_plans").insert((data ?? []).map((a) => ({ account_id: a.id })));
      setImported(new Map([...imported, ...(data ?? []).filter((a) => a.domain).map((a) => [a.domain!, a.id] as [string, string])]));
      setPicked(new Set());
      qc.invalidateQueries({ queryKey: ["accounts"] });
      toast.success(`${data?.length ?? 0} cuentas añadidas.`);
    } catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  }

  const rows = res?.rows ?? [];
  const selectable = rows.filter((r) => r.domain && !r.existingId);
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Describe a tu cliente ideal y Nokko busca empresas en la fuente más rápida y barata que tengas conectada; si no encuentra, prueba otra. Trabaja en segundo plano: puedes cerrar esta ventana y te aviso al terminar.</p>
      {icps.length > 0 && <Field label="Partir de un ICP"><Pick aria-label="Partir de un ICP" value="" options={{ "": "Elige un ICP…", ...Object.fromEntries(icps.map((i) => [i.id, i.name])) }} onChange={useIcp} /></Field>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Palabras clave (sector o producto, mejor en inglés)"><Input value={keywords} placeholder="payments, logistics, B2B SaaS" onChange={(e) => setKeywords(e.target.value)} /></Field>
        <Field label="Países">
          <CountryPick aria-label="Añadir país" value={null} empty="Añadir país…" onChange={(v) => v && !countries.includes(v) && setCountries([...countries, v])} />
          {countries.length > 0 && <p className="mt-1 flex flex-wrap gap-2 text-sm">{countries.map((c) => <button key={c} type="button" className="underline" aria-label={`Quitar ${countryName(c)}`} onClick={() => setCountries(countries.filter((x) => x !== c))}>{countryName(c)} ×</button>)}</p>}
        </Field>
        <Field label="Empleados mín."><Input inputMode="numeric" value={minEmp} onChange={(e) => setMinEmp(e.target.value.replace(/\D/g, ""))} /></Field>
        <Field label="Empleados máx."><Input inputMode="numeric" value={maxEmp} onChange={(e) => setMaxEmp(e.target.value.replace(/\D/g, ""))} /></Field>
      </div>
      {running ? <JobProgress job={job} onCancel={cancel} /> : (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => run(false)}>{res ? "Buscar de nuevo" : "Buscar empresas"}</Button>
          {res && <button type="button" className="text-sm underline underline-offset-4" onClick={() => setDismissed(done!.id)}>Limpiar resultados</button>}
          <button type="button" className="text-sm underline" onClick={onDeep}>Buscar a fondo (25–100 empresas, tarda minutos)</button>
        </div>
      )}
      {!running && job?.status === "failed" && <p className="text-sm text-muted-foreground">La última búsqueda falló: {job.error}</p>}
      {res?.blocked && <p className="text-sm text-muted-foreground">{res.blocked}</p>}
      {res && !res.blocked && rows.length === 0 && <p className="text-sm text-muted-foreground">No hay empresas con esos criterios. Prueba a quitar alguno o busca a fondo.</p>}
      {rows.length > 0 && (
        <div className="space-y-3">
          <div className="overflow-x-auto border-t">
            <table className="w-full text-sm">
              <thead className="text-left"><tr>{["", "Empresa", "Sector", "Tamaño", "País", ""].map((h, i) => <th key={i} className="eyebrow px-2 py-2">{h}</th>)}</tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.domain ?? r.name}-${i}`} className="border-t align-top">
                    <td className="px-2 py-2">{r.domain && !r.existingId && <Checkbox aria-label={`Elegir ${r.name}`} checked={picked.has(r.domain)} onCheckedChange={(v) => { const n = new Set(picked); v ? n.add(r.domain!) : n.delete(r.domain!); setPicked(n); }} />}</td>
                    <td className="px-2 py-2"><CompanyLogo domain={r.domain} size={16} className="mr-1.5" /><span className="font-medium">{r.name}</span><span className="block break-all text-xs text-muted-foreground">{r.domain ?? "sin dominio"}{r.location ? ` · ${r.location}` : ""}</span>{r.description && <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">{r.description}</span>}</td>
                    <td className="px-2 py-2">{r.industry}</td>
                    <td className="whitespace-nowrap px-2 py-2">{r.size}</td>
                    <td className="px-2 py-2">{r.country ? countryName(r.country) : ""}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-xs">{r.existingId ? <Link to="/accounts/$id" params={{ id: r.existingId }} className="underline">Ya está en Nokko</Link> : !r.domain ? <span className="text-muted-foreground">Sin dominio</span> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="font-mono text-xs text-muted-foreground">{res?.sources}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" size="sm" disabled={!selectable.length} onClick={() => setPicked(picked.size === selectable.length ? new Set() : new Set(selectable.map((r) => r.domain!)))}>{picked.size === selectable.length && selectable.length ? "Quitar selección" : "Elegir todas"}</Button>
            {res?.cursor && <Button variant="outline" size="sm" disabled={busy || running} onClick={() => run(true)}>Traer más</Button>}
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={target} onCheckedChange={(v) => setTarget(!!v)} />Marcar como objetivo ABM</label>
            <Button disabled={busy || !picked.size} onClick={importPicked}>Añadir {picked.size || ""} {picked.size === 1 ? "cuenta" : "cuentas"}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
