import { createFileRoute, Link } from "@tanstack/react-router";
import { DriveSetupButton } from "@/components/drive";
import { useEffect, useMemo, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency, useMe } from "@/hooks/use-me";
import { useSetup } from "@/hooks/use-setup";
import { useAgent } from "@/components/agent";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { applySetupItems, extractSetup, undoSetupItems } from "@/lib/agent.functions";
import type { UndoRef } from "@/lib/setup-undo";
import { FIELD_LABELS, itemDetail, proposalItems, type ProposalItem, type SetupProposal } from "@/lib/setup-extraction";
import { DUNFORD_FIELDS, POSITIONING_FIELDS, SETUP_ITEMS } from "@/lib/setup-schema";
import { quarterOf } from "@/lib/metrics";
import { firstOpenStage, stageOptions } from "@/lib/stages";
import { useStages } from "@/components/stage-settings";
import { Pick } from "@/components/fields";
import { errorText, isNetworkError } from "@/lib/errors";
import { DateField } from "@/components/date-field";
import { AiProgress } from "@/components/ai-progress";
import { AccountImport } from "@/components/account-import";
import { questionSuggestions } from "@/lib/setup-questions";
import { askConfirm } from "@/components/confirm-dialog";

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
          <dl className="mt-4 grid max-w-3xl gap-3 text-sm sm:grid-cols-3">
            <div className="border-t border-hairline pt-2"><dt className="font-medium">Lo rellena la IA · 1-2 min</dt><dd className="text-muted-foreground">Si ya tienes web, deck o documentos. Propone todo de una vez y revisas punto por punto antes de guardar.</dd></div>
            <div className="border-t border-hairline pt-2"><dt className="font-medium">Entrevista · 10-15 min</dt><dd className="text-muted-foreground">Si lo tienes en la cabeza y no escrito. El agente te pregunta lo que falta, de uno en uno.</dd></div>
            <div className="border-t border-hairline pt-2"><dt className="font-medium">Paso a paso · 15-20 min</dt><dd className="text-muted-foreground">Si quieres controlar cada campo. Un formulario por hito.</dd></div>
          </dl>
          <p className="mt-3 max-w-3xl text-xs text-muted-foreground">Al combinarlas no se borra nada sin que lo veas: la IA actualiza los campos que tú aceptas (segmentos con el mismo nombre se actualizan; ICP, pilares y cuentas se añaden), y en Paso a paso partes de lo que ya está guardado.</p>
          <Tabs value={tab} onValueChange={setTab} className="mt-6">
            <TabsList>
              <TabsTrigger value="ai">Lo rellena la IA</TabsTrigger>
              <TabsTrigger value="interview">Entrevista</TabsTrigger>
              <TabsTrigger value="wizard">Paso a paso</TabsTrigger>
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
                <span aria-hidden className={`w-4 shrink-0 ${i.done ? "text-success" : "text-muted-foreground"}`}>{i.done ? "✓" : "·"}</span>
                <div><p className={i.done ? "text-muted-foreground line-through" : ""}>{i.label}</p>{!i.done && <p className="text-xs text-muted-foreground">Desbloquea: {i.unlocks}</p>}</div>
              </li>
            ))}
          </ul>
          <div className="mt-5 border-t border-hairline pt-4 text-sm">
            <p className="font-medium">Trabaja con Nokko desde Claude, ChatGPT o Codex</p>
            <p className="mt-1 text-xs text-muted-foreground">Conecta tu asistente por MCP: consulta pipeline, leads y estrategia sin salir de él. Lo que quiera cambiar te llega aquí para confirmar.</p>
            <Link to="/team" hash="mcp" className="mt-2 inline-block text-xs underline">Conectar mi asistente</Link>
          </div>
        </aside>
      </div>
    </Page>
  );
}

// ---------------- AI fill ----------------

// Same limit the server applies (extractSetup), shown before pasting rather than after.
const TEXT_LIMIT = 40_000;

function AiFill({ proposal, setProposal, onWizard }: { proposal: SetupProposal | null; setProposal: (p: SetupProposal | null) => void; onWizard: () => void }) {
  const extract = useServerFn(extractSetup);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [files, setFiles] = useState<{ filename: string; dataUrl: string }[]>([]);
  const [busy, setBusy] = useState(false);

  async function onFiles(list: FileList | null) {
    const arr = Array.from(list ?? []).slice(0, 3);
    const read = await Promise.all(arr.map(async (f) => {
      if (f.size > 8 * 1024 * 1024) { toast.error(`${f.name} supera 8 MB.`); return null; }
      if (/^text\/|\.md$|\.csv$/i.test(f.type || f.name)) { const body = await f.text(); setText((t) => `${t}\n\n--- ${f.name} ---\n${body.slice(0, 20000)}`); return null; }
      const dataUrl = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(f); });
      return { filename: f.name, dataUrl };
    }));
    setFiles(read.filter(Boolean) as any);
  }

  const [expanded, setExpanded] = useState(false);
  const { data: me } = useMe();
  async function run() {
    setBusy(true);
    try {
      const p = await extract({ data: { url, text, files } });
      setProposal(p);
      // The AI's follow-up questions outlive the proposal: they wait in Sugerencias until someone answers or drops them.
      const orgId = me?.currentOrg?.org_id;
      const rows = orgId ? questionSuggestions(p.questions ?? []).map((r) => ({ ...r, org_id: orgId })) : [];
      if (rows.length) {
        const { error } = await supabase.from("suggestions").upsert(rows, { onConflict: "org_id,dedupe_key", ignoreDuplicates: true });
        if (error) toast.error(`No he podido guardar las preguntas de la IA en Sugerencias: ${errorText(error)}`);
      }
    }
    catch (e) { toast.error(isNetworkError(e) ? "La propuesta tardó demasiado y el navegador cortó la conexión. Prueba con solo la web o con menos texto, sin archivos, o desde el ordenador." : errorText(e)); }
    finally { setBusy(false); }
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
        {files.length > 0 && <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">{files.map((f) => f.filename).join(", ")}</p>}
        <div className="mt-2"><DriveSetupButton onText={(name, body) => setText((t) => `${t}\n\n--- ${name} (Google Drive) ---\n${body}`.slice(0, TEXT_LIMIT))} /></div>
      </div>
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="setup-text" className="text-sm font-medium">O pega lo que tengas</label>
          <button type="button" className="text-xs underline-offset-2 hover:underline" onClick={() => setExpanded((x) => !x)}>{expanded ? "Reducir" : "Ampliar"}</button>
        </div>
        <Textarea id="setup-text" className="mt-1" rows={expanded ? 30 : 12} maxLength={TEXT_LIMIT} placeholder="Descripción del producto, clientes ideales, competidores, precios… Puedes pegar varias páginas." value={text} onChange={(e) => setText(e.target.value)} />
        <p className={`mt-1 text-right font-mono text-[11px] ${text.length > TEXT_LIMIT * 0.9 ? "text-destructive" : "text-muted-foreground"}`}>{text.length.toLocaleString("es-ES")} / {TEXT_LIMIT.toLocaleString("es-ES")} caracteres</p>
      </div>
      {busy ? (
        <AiProgress typicalSeconds={60} stages={[url.trim() ? "Leyendo tu web" : "Leyendo lo que has pegado", files.length ? "Leyendo los documentos" : "Extrayendo producto y clientes", "Proponiendo posicionamiento e ICP", "Proponiendo segmentos y mensajes"]} />
      ) : (
        <Button className="h-auto min-h-10 whitespace-normal py-2 text-center md:min-h-8" onClick={run} disabled={!url.trim() && !text.trim() && !files.length}>
          Proponer mi estrategia
        </Button>
      )}
      <p className="text-xs text-muted-foreground">La IA propone y tú revisas cada punto antes de guardarlo.</p>
    </div>
  );
}

function ProposalReview({ proposal, onReset, onWizard }: { proposal: SetupProposal; onReset: () => void; onWizard: () => void }) {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const apply = useServerFn(applySetupItems);
  const segsQ = useQuery({ queryKey: ["segments-min", me?.currentOrg?.org_id], queryFn: async () => (await supabase.from("segments").select("id,name")).data ?? [] });
  // A stable array: a fresh [] on every render while loading re-ran the effects below in a loop.
  const segs = useMemo(() => segsQ.data ?? [], [segsQ.data]);
  const base = useMemo(() => proposalItems(proposal, segs, me?.currentOrg?.currency ?? null), [proposal, segs, me]);
  const [items, setItems] = useState<ProposalItem[]>([]);
  const [off, setOff] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<{ label: string; group: string; ok: boolean; error?: string; undo?: UndoRef | null }[] | null>(null);
  const [undone, setUndone] = useState(false);
  const undo = useServerFn(undoSetupItems);
  const isOwner = (me?.roles ?? []).includes("owner");
  async function undoBatch() {
    const refs = (saved ?? []).flatMap((x) => (x.undo ? [x.undo] : []));
    if (!refs.length) return;
    if (!(await askConfirm(`¿Deshacer los ${refs.length} elementos que creó este guardado?`, { body: "Lo que se actualizó (posicionamiento, segmentos que ya existían, moneda) se queda como está.", confirmLabel: "Deshacer" }))) return;
    setBusy(true);
    try {
      const r = await undo({ data: { refs } });
      setUndone(true);
      toast[r.failed ? "warning" : "success"](`${r.undone} elementos borrados${r.failed ? ` · ${r.failed} no se han podido borrar` : ""}.`);
      qc.invalidateQueries();
    } catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  }
  // Rebuild the cards from the proposal until the person edits one or saves: a background refresh must
  // not overwrite their edits, and a saved batch must not be saveable twice.
  const touched = useRef(false);
  useEffect(() => { if (!touched.current) setItems(base); }, [base]);

  const groups = [...new Set(items.map((i) => i.group))];
  const chosen = items.filter((i) => !off.has(i.key));

  async function save() {
    setBusy(true);
    try {
      const r = await apply({ data: { items: chosen.map(({ tool, args }) => ({ tool, args })) } });
      const bad = r.filter((x) => !x.ok);
      // Say what was written, item by item, not just how many.
      touched.current = true;
      setSaved(r.map((x, i) => ({ label: chosen[i]?.label ?? x.tool, group: chosen[i]?.group ?? "", ok: x.ok, error: x.error, undo: x.undo })));
      toast[bad.length ? "warning" : "success"](`${r.length - bad.length} guardados${bad.length ? ` · ${bad.length} con error` : ""}. Abajo tienes el detalle.`);
      qc.invalidateQueries();
    } catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  }

  const setArg = (key: string, path: string[], value: string) => { touched.current = true; setItems((list) => list.map((i) => {
    if (i.key !== key) return i;
    const args = structuredClone(i.args) as any;
    let o = args; for (const p of path.slice(0, -1)) o = o[p];
    const last = path[path.length - 1];
    o[last] = typeof o[last] === "number" ? (value === "" ? undefined : Number(value)) : value;
    return { ...i, args };
  })); };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-5">
        <p className="eyebrow">Resumen</p>
        <p className="mt-1">{proposal.summary}</p>
        {proposal.questions.length > 0 && (
          <div className="mt-3 text-sm"><p className="font-medium">Para afinar, me falta saber:</p><ul className="mt-1 list-disc pl-5 text-muted-foreground">{proposal.questions.map((q) => <li key={q}>{q}</li>)}</ul><p className="mt-1 text-xs text-muted-foreground">Las he dejado en <Link to="/inbox" className="underline">Sugerencias</Link>: siguen ahí aunque guardes o descartes esta propuesta.</p></div>
        )}
      </div>
      {saved && (
        <div className="rounded-lg border bg-card p-5 text-sm">
          <p className="eyebrow">Qué se ha guardado</p>
          <ul className="mt-2 space-y-1">
            {saved.map((x, i) => <li key={i} className={x.ok ? "" : "text-destructive"}>{x.ok ? "✓" : "✗"} {x.group ? `${x.group} · ` : ""}{x.label}{x.error ? ` — ${x.error}` : ""}</li>)}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">Para cambiar algo, edítalo en <Link to="/strategy" className="underline">Estrategia</Link> o en Paso a paso. Deshacer borra lo que este guardado creó; lo que actualizó en su sitio no vuelve atrás.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={onReset}>Cerrar esta propuesta</Button>
            {saved.some((x) => x.undo) && !undone && (isOwner
              ? <Button size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={undoBatch}>Deshacer este guardado</Button>
              : <span className="self-center text-xs text-muted-foreground">Deshacer el guardado lo puede hacer el Owner.</span>)}
            {undone && <span className="self-center text-xs text-muted-foreground">Guardado deshecho.</span>}
          </div>
        </div>
      )}
      {groups.map((g) => (
        <section key={g}>
          <h3 className="mb-2 text-xl">{g}</h3>
          <div className="space-y-2">
            {items.filter((i) => i.group === g).map((i) => (
              <div key={i.key} className={`rounded-lg border bg-card p-4 ${off.has(i.key) ? "opacity-50" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="font-medium">{i.label}</p><p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{itemDetail(i.tool, i.args) ?? i.detail}</p></div>
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
        <Button className="order-last col-span-2 sm:order-none" onClick={save} disabled={busy || !chosen.length || !!saved}>{busy ? "Guardando…" : saved ? "Guardado" : `Guardar ${chosen.length} elementos`}</Button>
        <Button variant="outline" onClick={onWizard}><span className="sm:hidden">Seguir paso a paso</span><span className="hidden sm:inline">Completar el resto paso a paso</span></Button>
        <Button variant="ghost" onClick={onReset}>Empezar de nuevo</Button>
      </div>
    </div>
  );
}

const LONG_FIELDS = new Set(["why_fit", "anti_icp", "message", "pain", "proof", "notes", "elevator_pitch", "short_pitch", "best_customers", "alternatives", "differentiation", "value", "trend", "need", "key_benefit", "differentiator", "competitive_alternative", "target_customer", "why"]);

function Field({ label, value, onChange }: { label: string; value: unknown; onChange: (v: string) => void }) {
  // Decided by the field, not by the length of its value: a name stays a one-line field even when the
  // AI made it long, and reopening the editor never switches the type.
  const long = LONG_FIELDS.has(label);
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
      <Button className="mt-4" onClick={() => open({ mode: "interview", prompt: "Quiero completar la configuración de mi estrategia GTM. Empieza por lo más importante que falte." })}>Empezar entrevista</Button>
    </div>
  );
}

// ---------------- Wizard ----------------

function Wizard({ proposal }: { proposal: SetupProposal | null }) {
  const { data: setup } = useSetup();
  // Fixed order and numbering: «paso 2» is always the same step. Saving moves to the next pending one
  // after the current, never skipping one that is still missing.
  const [stepId, setStepId] = useState<string | null>(null);
  const stepsRef = useRef<HTMLDivElement>(null);
  const isDone = (id: string) => !!setup?.status.items.find((x) => x.id === id)?.done;
  const firstPending = SETUP_ITEMS.find((i) => !isDone(i.id))?.id ?? SETUP_ITEMS[0].id;
  const curId = stepId ?? firstPending;
  const cur = SETUP_ITEMS.find((i) => i.id === curId) ?? SETUP_ITEMS[0];
  // Mobile: the steps are one swipeable row; keep the current one in view.
  useEffect(() => {
    const box = stepsRef.current;
    const el = box?.querySelector<HTMLElement>("[data-active]");
    if (box && el && box.scrollWidth > box.clientWidth) box.scrollTo({ left: el.offsetLeft - box.clientWidth / 2 + el.offsetWidth / 2, behavior: "smooth" });
  }, [curId]);
  if (!setup) return null;
  const done = isDone(cur.id);
  const nextPending = () => {
    const idx = SETUP_ITEMS.findIndex((i) => i.id === cur.id);
    const after = [...SETUP_ITEMS.slice(idx + 1), ...SETUP_ITEMS.slice(0, idx)].find((i) => !isDone(i.id) && i.id !== cur.id);
    setStepId(after?.id ?? cur.id);
  };

  return (
    <div className="rounded-lg border bg-card p-5">
      <div ref={stepsRef} className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
        {SETUP_ITEMS.map((i, idx) => (
          <button key={i.id} data-active={i.id === cur.id || undefined} onClick={() => setStepId(i.id)} className={`min-h-8 shrink-0 whitespace-nowrap rounded-none border px-3 py-1.5 text-xs md:min-h-0 md:py-1 ${i.id === cur.id ? "bg-primary text-primary-foreground" : isDone(i.id) ? "text-muted-foreground line-through" : ""}`}>{idx + 1}. {i.label.split(" (")[0]}</button>
        ))}
      </div>
      <div className="mt-5">
        <h3 className="text-2xl">{cur.label} {done && <span className="ml-2 align-middle text-xs text-success">Completado</span>}</h3>
        <p className="mt-1 text-sm text-muted-foreground">Desbloquea: {cur.unlocks}</p>
        <div className="mt-4"><StepPanel key={cur.id} id={cur.id} done={done} link={cur.link} proposal={proposal} onSaved={nextPending} /></div>
      </div>
    </div>
  );
}

// Steps whose form creates a new record. Once done, they show what exists and only open the form on purpose,
// so an empty «ICP principal» form doesn't invite a duplicate.
const CREATE_STEPS: Record<string, { what: string; add: string }> = {
  icp: { what: "Ya tienes al menos un ICP completo.", add: "Crear otro ICP" },
  pillars: { what: "Ya tienes tres pilares de mensaje.", add: "Añadir pilares" },
  quota: { what: "Ya tienes cuota para este trimestre.", add: "Cambiar mi cuota" },
  accounts: { what: "Ya tienes cuentas objetivo.", add: "Añadir más cuentas" },
  deals: { what: "Ya tienes al menos un deal.", add: "Crear otro deal" },
};

function StepPanel({ id, done, link, proposal, onSaved }: { id: string; done: boolean; link: string; proposal: SetupProposal | null; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const create = CREATE_STEPS[id];
  if (done && create && !open) {
    return (
      <div className="space-y-3 text-sm">
        <p>{create.what} Puedes revisarlo en <Link to={link} className="underline">{link === "/strategy" ? "Estrategia" : link === "/metrics" ? "Métricas" : link === "/accounts" ? "Cuentas" : "Pipeline"}</Link>.</p>
        <Button variant="outline" onClick={() => setOpen(true)}>{create.add}</Button>
      </div>
    );
  }
  return <StepForm id={id} proposal={proposal} onSaved={onSaved} />;
}

const SEG_COLS = [["acv_min", "ACV mín."], ["acv_max", "ACV máx."], ["win_rate_target", "Win rate %"], ["ae_quota", "Cuota anual AE"]] as const;

function StepForm({ id, proposal, onSaved }: { id: string; proposal: SetupProposal | null; onSaved: () => void }) {
  const apply = useServerFn(applySetupItems);
  const qc = useQueryClient();
  const { data: setup } = useSetup();
  const { currency, symbol } = useCurrency();
  const { stages } = useStages();
  const segsQ = useQuery({ queryKey: ["segments-full"], queryFn: async () => (await supabase.from("segments").select("id,name,acv_min,acv_max,win_rate_target,ae_quota").order("acv_min")).data ?? [] });
  const segs = useMemo(() => segsQ.data ?? [], [segsQ.data]);
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
    else if (id === "deals") setV({ name: "", account_name: "", segment_id: "", stage: "", amount: "", close_date: "" });
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
      case "deals": return [{ tool: "create_deal", args: Object.fromEntries(Object.entries({ name: v.name, account_name: v.account_name?.trim() || undefined, segment_id: v.segment_id || undefined, stage: v.stage || undefined, amount: num(v.amount), close_date: v.close_date || undefined }).filter(([, x]) => x !== undefined)) }];
    }
    return [];
  }

  async function save() {
    setBusy(true);
    try {
      const r = await apply({ data: { items: items() } });
      const bad = r.filter((x) => !x.ok);
      if (bad.length) toast.error(errorText(bad[0].error)); else { toast.success("Guardado."); onSaved(); }
      qc.invalidateQueries();
    } catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  }

  const inp = (k: string, label: string, opts: { area?: boolean; type?: string } = {}) => (
    <label key={k} className="text-sm">{label}
      {opts.area ? <Textarea className="mt-1" rows={2} value={v[k] ?? ""} onChange={(e) => setV({ ...v, [k]: e.target.value })} /> : <Input className="mt-1" type={opts.type} value={v[k] ?? ""} onChange={(e) => setV({ ...v, [k]: e.target.value })} />}
    </label>
  );
  const setRow = (i: number, k: string, x: string) => setV({ ...v, rows: v.rows.map((r: any, j: number) => (j === i ? { ...r, [k]: x } : r)) });

  return (
    <div className="space-y-3">
      {id === "positioning" && <div className="grid gap-3 sm:grid-cols-2">{POSITIONING_FIELDS.map(([k, l]) => inp(k, l, { area: k === "elevator_pitch" || DUNFORD_FIELDS.some(([d]) => d === k) }))}</div>}
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
        {(() => {
          // The step only counts as done when every segment has its values: say which ones are missing, so a
          // template segment the company doesn't use isn't a silent blocker.
          const empty = (x: unknown) => x == null || String(x).trim() === "";
          const missing = (v.rows ?? []).filter((r: any) => (id === "segments" ? empty(r.acv_min) && empty(r.acv_max) : empty(r.win_rate_target) || empty(r.ae_quota))).map((r: any) => r.name);
          return missing.length ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Para completar este paso, {id === "segments" ? "cada segmento necesita un ACV mínimo o máximo" : "cada segmento necesita win rate y cuota (0 vale si no aplica)"}. Faltan: {missing.join(", ")}. Si alguno no es tuyo, por ejemplo uno de la plantilla, elimínalo en <Link to="/strategy" className="underline">Estrategia GTM</Link>.
            </p>
          ) : null;
        })()}
      </>)}
      {id === "quota" && <div className="max-w-xs">{inp("amount", `Tu cuota para ${quarterOf(new Date())} (${symbol})`, { type: "number" })}<p className="mt-1 text-xs text-muted-foreground">Importe de deals ganados (ACV nuevo) que tienes que cerrar en el trimestre, en {currency}. No es MRR ni número de deals. Las cuotas del resto del equipo se fijan en Métricas.</p></div>}
      {id === "accounts" && <div className="grid gap-6 md:grid-cols-2">
        <div><p className="mb-2 text-sm font-medium">Desde un CSV</p><AccountImport onDone={(n) => n > 0 && onSaved()} /></div>
        <label className="block text-sm"><span className="font-medium">O escribe una cuenta por línea</span><Textarea className="mt-1" rows={5} value={v.names ?? ""} onChange={(e) => setV({ ...v, names: e.target.value })} /><span className="mt-1 block text-xs text-muted-foreground">Se crean como cuentas objetivo solo con el nombre; completa sector y tamaño en su ficha para que puntúen.</span></label>
      </div>}
      {id === "deals" && <div className="grid gap-3 sm:grid-cols-3">{inp("name", "Nombre del deal")}{inp("account_name", "Cuenta (se crea si no existe)")}<label className="text-sm">Segmento<div className="mt-1"><Pick value={v.segment_id ?? ""} options={{ "": "Sin segmento", ...Object.fromEntries(segs.map((x) => [x.id, x.name])) }} onChange={(x) => setV({ ...v, segment_id: x })} /></div></label><label className="text-sm">Etapa<div className="mt-1"><Pick value={v.stage || firstOpenStage(stages).key} options={stageOptions(stages)} onChange={(x) => setV({ ...v, stage: x })} /></div></label>{inp("amount", `Importe (ACV, ${symbol})`, { type: "number" })}<label className="text-sm">Fecha de cierre<div className="mt-1"><DateField value={v.close_date || null} onChange={(iso) => setV({ ...v, close_date: iso ?? "" })} /></div></label></div>}
      <Button onClick={save} disabled={busy}>{busy ? "Guardando…" : "Guardar y seguir"}</Button>
    </div>
  );
}
