import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Circle, FileText, Loader2, MessageSquare, Sparkles, ListChecks } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { useSetup } from "@/hooks/use-setup";
import { useAgent } from "@/components/agent";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { applySetupItems, extractSetup } from "@/lib/agent.functions";
import { FIELD_LABELS, proposalItems, type ProposalItem, type SetupProposal } from "@/lib/setup-extraction";
import { POSITIONING_FIELDS, SETUP_ITEMS } from "@/lib/setup-schema";
import { quarterOf } from "@/lib/metrics";

export const Route = createFileRoute("/_authenticated/setup")({
  head: () => ({ meta: [{ title: "Configuración guiada — Nokko" }, { name: "description", content: "Completa tu estrategia GTM con IA, una entrevista o paso a paso." }, { property: "og:title", content: "Configuración guiada — Nokko" }, { property: "og:description", content: "Completa tu estrategia GTM con IA, una entrevista o paso a paso." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: SetupPage,
});

function SetupPage() {
  const { data: setup } = useSetup();
  const [proposal, setProposal] = useState<SetupProposal | null>(null);
  const [tab, setTab] = useState("ai");
  const st = setup?.status;
  return (
    <Page eyebrow="Onboarding" title="Configura tu estrategia">
      <div className="mb-8 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          <p className="max-w-2xl text-muted-foreground">Elige cómo quieres hacerlo. Puedes combinar las tres vías: todas guardan en el mismo sitio y el progreso se actualiza solo.</p>
          <Tabs value={tab} onValueChange={setTab} className="mt-6">
            <TabsList>
              <TabsTrigger value="ai"><Sparkles className="mr-1.5 size-4" /> Lo rellena la IA</TabsTrigger>
              <TabsTrigger value="interview"><MessageSquare className="mr-1.5 size-4" /> Entrevista</TabsTrigger>
              <TabsTrigger value="wizard"><ListChecks className="mr-1.5 size-4" /> Paso a paso</TabsTrigger>
            </TabsList>
            <TabsContent value="ai" className="mt-6"><AiFill proposal={proposal} setProposal={setProposal} onWizard={() => setTab("wizard")} /></TabsContent>
            <TabsContent value="interview" className="mt-6"><Interview /></TabsContent>
            <TabsContent value="wizard" className="mt-6"><Wizard proposal={proposal} /></TabsContent>
          </Tabs>
        </div>
        <aside className="h-fit rounded-lg border bg-card p-5">
          <p className="eyebrow">Progreso</p>
          <p className="mt-1 font-display text-5xl">{st?.pct ?? 0}%</p>
          <div className="mt-2 h-2 rounded bg-muted"><div className="h-full rounded bg-primary transition-all" style={{ width: `${st?.pct ?? 0}%` }} /></div>
          <ul className="mt-4 space-y-2.5 text-sm">
            {st?.items.map((i) => (
              <li key={i.id} className="flex gap-2">
                {i.done ? <Check className="mt-0.5 size-4 shrink-0 text-success" /> : <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
                <div><p className={i.done ? "text-muted-foreground line-through" : ""}>{i.label}</p>{!i.done && <p className="text-xs text-muted-foreground">Desbloquea: {i.unlocks}</p>}</div>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </Page>
  );
}

// ---------------- AI fill ----------------

function AiFill({ proposal, setProposal, onWizard }: { proposal: SetupProposal | null; setProposal: (p: SetupProposal | null) => void; onWizard: () => void }) {
  const extract = useServerFn(extractSetup);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [files, setFiles] = useState<{ filename: string; dataUrl: string }[]>([]);
  const [busy, setBusy] = useState(false);

  async function onFiles(list: FileList | null) {
    const arr = Array.from(list ?? []).slice(0, 3);
    const read = await Promise.all(arr.map(async (f) => {
      if (f.size > 8 * 1024 * 1024) { toast.error(`${f.name} supera 8 MB`); return null; }
      if (/^text\/|\.md$|\.csv$/i.test(f.type || f.name)) { const body = await f.text(); setText((t) => `${t}\n\n--- ${f.name} ---\n${body.slice(0, 20000)}`); return null; }
      const dataUrl = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(f); });
      return { filename: f.name, dataUrl };
    }));
    setFiles(read.filter(Boolean) as any);
  }

  async function run() {
    setBusy(true);
    try { setProposal(await extract({ data: { url, text, files } })); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  if (proposal) return <ProposalReview proposal={proposal} onReset={() => setProposal(null)} onWizard={onWizard} />;
  return (
    <div className="space-y-4 rounded-lg border bg-card p-5">
      <div>
        <label className="text-sm font-medium">Web de la empresa</label>
        <Input className="mt-1" placeholder="https://tuempresa.com" value={url} onChange={(e) => setUrl(e.target.value)} />
      </div>
      <div>
        <label className="text-sm font-medium">Documentos (PDF, deck exportado, notas)</label>
        <Input className="mt-1" type="file" multiple accept=".pdf,.txt,.md,.csv" onChange={(e) => onFiles(e.target.files)} />
        {files.length > 0 && <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><FileText className="size-3" /> {files.map((f) => f.filename).join(", ")}</p>}
      </div>
      <div>
        <label className="text-sm font-medium">O pega lo que tengas</label>
        <Textarea className="mt-1" rows={5} placeholder="Descripción del producto, clientes ideales, competidores, precios…" value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <Button className="h-auto min-h-10 whitespace-normal py-2 text-center md:min-h-8" onClick={run} disabled={busy || (!url.trim() && !text.trim() && !files.length)}>
        {busy ? <><Loader2 className="size-4 animate-spin" /> Analizando (puede tardar un minuto)…</> : <><Sparkles className="size-4" /> Proponer mi estrategia</>}
      </Button>
      <p className="text-xs text-muted-foreground">La IA propone y tú revisas cada punto antes de guardarlo.</p>
    </div>
  );
}

function ProposalReview({ proposal, onReset, onWizard }: { proposal: SetupProposal; onReset: () => void; onWizard: () => void }) {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const apply = useServerFn(applySetupItems);
  const { data: segs = [] } = useQuery({ queryKey: ["segments-min", me?.currentOrg?.org_id], queryFn: async () => (await supabase.from("segments").select("id,name")).data ?? [] });
  const base = useMemo(() => proposalItems(proposal, segs, me?.currentOrg?.currency ?? null), [proposal, segs, me]);
  const [items, setItems] = useState<ProposalItem[]>([]);
  const [off, setOff] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setItems(base), [base]);

  const groups = [...new Set(items.map((i) => i.group))];
  const chosen = items.filter((i) => !off.has(i.key));

  async function save() {
    setBusy(true);
    try {
      const r = await apply({ data: { items: chosen.map(({ tool, args }) => ({ tool, args })) } });
      const bad = r.filter((x) => !x.ok);
      toast[bad.length ? "warning" : "success"](`${r.length - bad.length} guardados${bad.length ? ` · ${bad.length} con error: ${bad[0].error}` : ""}`);
      qc.invalidateQueries();
      if (!bad.length) onReset();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  const setArg = (key: string, path: string[], value: string) => setItems((list) => list.map((i) => {
    if (i.key !== key) return i;
    const args = structuredClone(i.args) as any;
    let o = args; for (const p of path.slice(0, -1)) o = o[p];
    const last = path[path.length - 1];
    o[last] = typeof o[last] === "number" ? (value === "" ? undefined : Number(value)) : value;
    return { ...i, args };
  }));

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-5">
        <p className="eyebrow">Resumen</p>
        <p className="mt-1">{proposal.summary}</p>
        {proposal.questions.length > 0 && (
          <div className="mt-3 text-sm"><p className="font-medium">Para afinar, me falta saber:</p><ul className="mt-1 list-disc pl-5 text-muted-foreground">{proposal.questions.map((q) => <li key={q}>{q}</li>)}</ul></div>
        )}
      </div>
      {groups.map((g) => (
        <section key={g}>
          <h3 className="mb-2 text-xl">{g}</h3>
          <div className="space-y-2">
            {items.filter((i) => i.group === g).map((i) => (
              <div key={i.key} className={`rounded-lg border bg-card p-4 ${off.has(i.key) ? "opacity-50" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="font-medium">{i.label}</p><p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{i.detail}</p></div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" variant={off.has(i.key) ? "outline" : "default"} onClick={() => setOff((s) => { const n = new Set(s); n.has(i.key) ? n.delete(i.key) : n.add(i.key); return n; })}>{off.has(i.key) ? "Descartado" : "Aceptar"}</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(editing === i.key ? null : i.key)}>Editar</Button>
                  </div>
                </div>
                {editing === i.key && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {Object.entries(i.args).flatMap(([k, v]) => v && typeof v === "object"
                      ? Object.entries(v as Record<string, unknown>).map(([k2, v2]) => <Field key={`${k}.${k2}`} label={k2} value={v2} onChange={(x) => setArg(i.key, [k, k2], x)} />)
                      : k === "segment_id" || typeof v === "boolean" ? [] : [<Field key={k} label={k} value={v} onChange={(x) => setArg(i.key, [k], x)} />])}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
      <div className="sticky bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-10 -mx-4 grid grid-cols-2 gap-2 border-t bg-background px-4 py-3 sm:bottom-4 sm:mx-0 sm:flex sm:flex-wrap sm:items-center sm:rounded-lg sm:border sm:bg-card sm:p-3 sm:shadow-sm">
        <Button className="order-last col-span-2 sm:order-none" onClick={save} disabled={busy || !chosen.length}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Guardar {chosen.length} elementos</Button>
        <Button variant="outline" onClick={onWizard}><span className="sm:hidden">Seguir paso a paso</span><span className="hidden sm:inline">Completar el resto paso a paso</span></Button>
        <Button variant="ghost" onClick={onReset}>Empezar de nuevo</Button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: unknown; onChange: (v: string) => void }) {
  const long = typeof value === "string" && value.length > 60;
  return (
    <label className="text-xs text-muted-foreground">{FIELD_LABELS[label] ?? label}
      {long ? <Textarea rows={3} defaultValue={String(value ?? "")} onBlur={(e) => onChange(e.target.value)} /> : <Input type={typeof value === "number" ? "number" : "text"} defaultValue={String(value ?? "")} onBlur={(e) => onChange(e.target.value)} />}
    </label>
  );
}

// ---------------- Interview ----------------

function Interview() {
  const { open } = useAgent();
  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="text-2xl">Entrevista con el agente</h3>
      <p className="mt-2 max-w-xl text-muted-foreground">El agente mira qué te falta y te hace una pregunta cada vez, con una propuesta que puedes aceptar con un «sí». Cada respuesta queda como acción para confirmar con un clic.</p>
      <Button className="mt-4" onClick={() => open({ mode: "interview", prompt: "Quiero completar la configuración de mi estrategia GTM. Empieza por lo más importante que falte." })}><MessageSquare className="size-4" /> Empezar entrevista</Button>
    </div>
  );
}

// ---------------- Wizard ----------------

function Wizard({ proposal }: { proposal: SetupProposal | null }) {
  const { data: setup } = useSetup();
  const ordered = useMemo(() => {
    const done = new Set(setup?.status.items.filter((i) => i.done).map((i) => i.id));
    return [...SETUP_ITEMS.filter((i) => !done.has(i.id)), ...SETUP_ITEMS.filter((i) => done.has(i.id))];
  }, [setup]);
  const [step, setStep] = useState(0);
  const cur = ordered[Math.min(step, ordered.length - 1)];
  if (!cur || !setup) return null;
  const done = setup.status.items.find((i) => i.id === cur.id)?.done;
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex flex-wrap gap-1.5">
        {ordered.map((i, idx) => {
          const d = setup.status.items.find((x) => x.id === i.id)?.done;
          return <button key={i.id} onClick={() => setStep(idx)} className={`min-h-8 rounded-none border px-3 py-1.5 text-xs md:min-h-0 md:py-1 ${idx === step ? "bg-primary text-primary-foreground" : d ? "text-muted-foreground line-through" : ""}`}>{idx + 1}. {i.label.split(" (")[0]}</button>;
        })}
      </div>
      <div className="mt-5">
        <h3 className="text-2xl">{cur.label} {done && <span className="ml-2 align-middle text-xs text-success">Completado</span>}</h3>
        <p className="mt-1 text-sm text-muted-foreground">Desbloquea: {cur.unlocks}</p>
        <div className="mt-4"><StepForm id={cur.id} proposal={proposal} onSaved={() => setStep((s) => Math.min(s + 1, ordered.length - 1))} /></div>
      </div>
    </div>
  );
}

const SEG_COLS = [["acv_min", "ACV mín."], ["acv_max", "ACV máx."], ["win_rate_target", "Win rate %"], ["ae_quota", "Cuota anual AE"]] as const;

function StepForm({ id, proposal, onSaved }: { id: string; proposal: SetupProposal | null; onSaved: () => void }) {
  const apply = useServerFn(applySetupItems);
  const qc = useQueryClient();
  const { data: setup } = useSetup();
  const { data: segs = [] } = useQuery({ queryKey: ["segments-full"], queryFn: async () => (await supabase.from("segments").select("id,name,acv_min,acv_max,win_rate_target,ae_quota").order("acv_min")).data ?? [] });
  const [v, setV] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const pos = setup?.data.positioning ?? {};
    if (id === "positioning") setV(Object.fromEntries(POSITIONING_FIELDS.map(([k]) => [k, pos[k] || proposal?.positioning?.[k] || ""])));
    else if (id === "icp") { const p = proposal?.icps[0]; setV({ name: p?.name ?? "ICP principal", industries: p?.industries ?? "", company_size: p?.company_size ?? "", why_fit: p?.why_fit ?? "", anti_icp: p?.anti_icp ?? "" }); }
    else if (id === "pillars") setV({ rows: [0, 1, 2].map((i) => ({ title: proposal?.pillars[i]?.title ?? "", message: proposal?.pillars[i]?.message ?? "" })) });
    else if (id === "segments" || id === "benchmarks") setV({ rows: segs.map((s) => { const p = proposal?.segments.find((x) => x.name.toLowerCase() === s.name.toLowerCase()); return { ...s, win_rate_target: s.win_rate_target ?? p?.win_rate_target ?? "", ae_quota: s.ae_quota ?? p?.ae_quota ?? "", acv_min: s.acv_min ?? "", acv_max: s.acv_max ?? "" }; }) });
    else if (id === "quota") setV({ amount: "" });
    else if (id === "accounts") setV({ names: (proposal?.target_accounts ?? []).map((a) => a.name).join("\n") });
    else if (id === "deals") setV({ name: "", amount: "", close_date: "" });
  }, [id, proposal, setup, segs]);

  const num = (x: any) => (x === "" || x == null ? undefined : Number(x));
  function items(): { tool: string; args: Record<string, unknown> }[] {
    switch (id) {
      case "positioning": return [{ tool: "update_positioning", args: { fields: Object.fromEntries(Object.entries(v).filter(([, x]) => String(x).trim())) } }];
      case "icp": return [{ tool: "create_icp", args: v }];
      case "pillars": return v.rows.filter((r: any) => r.title.trim()).map((r: any) => ({ tool: "create_pillar", args: r }));
      case "segments": case "benchmarks": return v.rows.map((r: any) => ({ tool: "upsert_segment", args: Object.fromEntries(Object.entries({ segment_id: r.id, name: r.name, acv_min: num(r.acv_min), acv_max: num(r.acv_max), win_rate_target: num(r.win_rate_target), ae_quota: num(r.ae_quota) }).filter(([, x]) => x !== undefined)) }));
      case "quota": return [{ tool: "set_quota", args: { amount: Number(v.amount), period: quarterOf(new Date()) } }];
      case "accounts": return String(v.names ?? "").split("\n").map((n) => n.trim()).filter(Boolean).map((name) => ({ tool: "create_account", args: { name, is_target: true } }));
      case "deals": return [{ tool: "create_deal", args: Object.fromEntries(Object.entries({ name: v.name, amount: num(v.amount), close_date: v.close_date || undefined }).filter(([, x]) => x !== undefined)) }];
    }
    return [];
  }

  async function save() {
    setBusy(true);
    try {
      const r = await apply({ data: { items: items() } });
      const bad = r.filter((x) => !x.ok);
      if (bad.length) toast.error(bad[0].error); else { toast.success("Guardado"); onSaved(); }
      qc.invalidateQueries();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  const inp = (k: string, label: string, opts: { area?: boolean; type?: string } = {}) => (
    <label key={k} className="text-sm">{label}
      {opts.area ? <Textarea className="mt-1" rows={2} value={v[k] ?? ""} onChange={(e) => setV({ ...v, [k]: e.target.value })} /> : <Input className="mt-1" type={opts.type} value={v[k] ?? ""} onChange={(e) => setV({ ...v, [k]: e.target.value })} />}
    </label>
  );
  const setRow = (i: number, k: string, x: string) => setV({ ...v, rows: v.rows.map((r: any, j: number) => (j === i ? { ...r, [k]: x } : r)) });

  return (
    <div className="space-y-3">
      {id === "positioning" && <div className="grid gap-3 sm:grid-cols-2">{POSITIONING_FIELDS.map(([k, l]) => inp(k, l, { area: k === "elevator_pitch" }))}</div>}
      {id === "icp" && <div className="grid gap-3 sm:grid-cols-2">{inp("name", "Nombre")}{inp("industries", "Sectores")}{inp("company_size", "Tamaño de empresa")}{inp("why_fit", "Por qué encaja", { area: true })}{inp("anti_icp", "Anti-ICP (a quién NO venderle)", { area: true })}</div>}
      {id === "pillars" && v.rows?.map((r: any, i: number) => (
        <div key={i} className="grid gap-2 sm:grid-cols-[1fr_2fr]"><Input placeholder={`Pilar ${i + 1}`} value={r.title} onChange={(e) => setRow(i, "title", e.target.value)} /><Input placeholder="Mensaje" value={r.message} onChange={(e) => setRow(i, "message", e.target.value)} /></div>
      ))}
      {(id === "segments" || id === "benchmarks") && (<>
        <div className="space-y-3 md:hidden">{v.rows?.map((r: any, i: number) => (
          <div key={r.id} className="border-t border-hairline pt-2">
            <p className="text-sm font-medium">{r.name}</p>
            <div className="mt-2 grid grid-cols-2 gap-2">{SEG_COLS.map(([k, l]) => (
              <label key={k} className="text-xs text-muted-foreground">{l}<Input className="mt-1" type="number" inputMode="decimal" value={r[k]} onChange={(e) => setRow(i, k, e.target.value)} /></label>
            ))}</div>
          </div>
        ))}{!v.rows?.length && <p className="text-sm text-muted-foreground">No hay segmentos. Créalos en <Link to="/strategy" className="underline">Estrategia GTM</Link>.</p>}</div>
        <div className="hidden overflow-x-auto md:block"><table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1">Segmento</th>{SEG_COLS.map(([k, l]) => <th key={k}>{l}</th>)}</tr></thead>
          <tbody>{v.rows?.map((r: any, i: number) => (
            <tr key={r.id}><td className="py-1 pr-2">{r.name}</td>{SEG_COLS.map(([k]) => <td key={k} className="pr-2"><Input type="number" value={r[k]} onChange={(e) => setRow(i, k, e.target.value)} /></td>)}</tr>
          ))}</tbody>
        </table>{!v.rows?.length && <p className="text-sm text-muted-foreground">No hay segmentos. Créalos en <Link to="/strategy" className="underline">Estrategia GTM</Link>.</p>}</div>
      </>)}
      {id === "quota" && <div className="max-w-xs">{inp("amount", `Tu cuota para ${quarterOf(new Date())}`, { type: "number" })}<p className="mt-1 text-xs text-muted-foreground">Las cuotas del resto del equipo se fijan en Métricas.</p></div>}
      {id === "accounts" && <label className="block text-sm">Una cuenta por línea<Textarea className="mt-1" rows={5} value={v.names ?? ""} onChange={(e) => setV({ ...v, names: e.target.value })} /></label>}
      {id === "deals" && <div className="grid gap-3 sm:grid-cols-3">{inp("name", "Nombre del deal")}{inp("amount", "Importe", { type: "number" })}{inp("close_date", "Fecha de cierre", { type: "date" })}</div>}
      <Button onClick={save} disabled={busy}>{busy && <Loader2 className="size-4 animate-spin" />} Guardar y seguir</Button>
    </div>
  );
}
