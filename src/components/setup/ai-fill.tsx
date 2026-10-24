import { Link } from "@tanstack/react-router";
import { DriveSetupButton } from "@/components/drive";
import { useEffect, useMemo, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { applySetupItems, extractSetup, undoSetupItems } from "@/lib/agent.functions";
import type { UndoRef } from "@/lib/setup-undo";
import { FIELD_LABELS, itemDetail, proposalItems, type ProposalItem, type SetupProposal } from "@/lib/setup-extraction";
import { errorText, isNetworkError } from "@/lib/errors";
import { AiProgress } from "@/components/ai-progress";
import { questionSuggestions } from "@/lib/setup-questions";
import { askConfirm } from "@/components/confirm-dialog";

// ---------------- AI fill ----------------

// Same limit the server applies (extractSetup), shown before pasting rather than after.
export const TEXT_LIMIT = 40_000;

export function AiFill({ proposal, setProposal, onWizard }: { proposal: SetupProposal | null; setProposal: (p: SetupProposal | null) => void; onWizard: () => void }) {
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
    setFiles(read.filter((x): x is { filename: string; dataUrl: string } => !!x));
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

export function ProposalReview({ proposal, onReset, onWizard }: { proposal: SetupProposal; onReset: () => void; onWizard: () => void }) {
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
    const args = structuredClone(i.args);
    let o: Record<string, unknown> = args; for (const p of path.slice(0, -1)) o = o[p] as Record<string, unknown>;
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

export const LONG_FIELDS = new Set(["why_fit", "anti_icp", "message", "pain", "proof", "notes", "elevator_pitch", "short_pitch", "best_customers", "alternatives", "differentiation", "value", "trend", "need", "key_benefit", "differentiator", "competitive_alternative", "target_customer", "why"]);

export function Field({ label, value, onChange }: { label: string; value: unknown; onChange: (v: string) => void }) {
  // Decided by the field, not by the length of its value: a name stays a one-line field even when the
  // AI made it long, and reopening the editor never switches the type.
  const long = LONG_FIELDS.has(label);
  return (
    <label className="text-xs text-muted-foreground">{FIELD_LABELS[label] ?? label}
      {long ? <Textarea rows={3} defaultValue={String(value ?? "")} onBlur={(e) => onChange(e.target.value)} /> : <Input type={typeof value === "number" ? "number" : "text"} defaultValue={String(value ?? "")} onBlur={(e) => onChange(e.target.value)} />}
    </label>
  );
}
