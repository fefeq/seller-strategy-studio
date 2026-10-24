import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CheckCircle2, FileText, Loader2, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { useCycle } from "@/hooks/use-cycle";
import { useAgent } from "@/components/agent";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { SaveToDriveButton } from "@/components/drive";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PHASES } from "@/lib/bmad/phases";
import { ARTIFACTS, type ArtifactKind } from "@/lib/bmad/workflows";
import { getPersona } from "@/lib/bmad/personas";
import { TRACKS } from "@/lib/bmad/tracks";
import { canUseAdvisor } from "@/lib/advisor";
import { JobProgress, useJob, type BgJob } from "@/components/background";
import { freshResult } from "@/lib/jobs";
import type { DeepReview } from "@/lib/bmad/debate-core";
import { errorText } from "@/lib/errors";

export const Route = createFileRoute("/_authenticated/cycle")({
  // artifact: link from a notice («Borrador listo…», «Revisión a fondo lista…») straight to the document.
  validateSearch: (s: Record<string, unknown>): { artifact?: string } => (typeof s.artifact === "string" ? { artifact: s.artifact } : {}),
  head: () => ({ meta: [
    { title: "Ciclo GTM — Nokko" },
    { name: "description", content: "Fases del go-to-market con documentos aprobados que alimentan cada paso: Brief, Plan, Arquitectura, ejecución y retro." },
    { property: "og:title", content: "Ciclo GTM — Nokko" },
    { property: "og:description", content: "Fases del go-to-market con documentos versionados y aprobados." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: CyclePage,
});

const PERSONA_FOR: Record<ArtifactKind, string> = { brief: "paul", plan: "reid", architecture: "benioff", readiness: "benioff", retro: "reid", winloss: "jason" };
const METHODS = [
  ["premortem", "Pre-mortem"], ["redteam", "Red team"], ["first_principles", "Primeros principios"], ["socratic", "Preguntas socráticas"], ["power_map", "Mapa de poder"],
] as const;
const STATUS: Record<string, string> = { draft: "Borrador", approved: "Aprobado", archived: "Archivado" };

// Wide markdown tables scroll inside their own box instead of widening the sheet.
const MD_COMPONENTS = { table: ({ node: _node, ...p }: any) => <div className="max-w-full overflow-x-auto"><table {...p} /></div> };

type Art = { id: string; kind: string; title: string; version: number; status: string; content: string; persona: string | null; updated_at: string; meta: any };

function CyclePage() {
  const { data: me } = useMe();
  const { data: cycle } = useCycle();
  const { open: openAgent } = useAgent();
  const qc = useQueryClient();
  const search = Route.useSearch();
  const leader = canUseAdvisor(me?.roles ?? []);
  const [selected, setSelected] = useState<string | null>(search.artifact ?? null);
  useEffect(() => { if (search.artifact) setSelected(search.artifact); }, [search.artifact]);
  const draftJob = useJob("draft_artifact", {
    onDone: (j) => {
      qc.invalidateQueries({ queryKey: ["artifacts"] }); qc.invalidateQueries({ queryKey: ["cycle"] });
      const id = (j.result as { artifactId?: string } | null)?.artifactId;
      if (id) setSelected(id);
    },
  });
  const [newKind, setNewKind] = useState<ArtifactKind | null>(null);
  const { data: arts = [] } = useQuery({
    queryKey: ["artifacts", me?.currentOrg?.org_id],
    enabled: !!me?.currentOrg,
    queryFn: async () => ((await supabase.from("gtm_artifacts").select("id,kind,title,version,status,content,persona,updated_at,meta").order("version", { ascending: false })).data ?? []) as Art[],
  });
  const phaseIdx = PHASES.findIndex((p) => p.id === cycle?.phase);
  // Retro and Win/Loss read closed deals: with none, a draft would be invented.
  const { data: closedCount = 0 } = useQuery({
    queryKey: ["closed-deals-count", me?.currentOrg?.org_id],
    enabled: !!me?.currentOrg,
    queryFn: async () => (await supabase.from("deals").select("id", { count: "exact", head: true }).in("stage", ["won", "lost"])).count ?? 0,
  });

  return (
    <Page eyebrow="Como BMAD, pero para vender" title="Ciclo GTM">
      {draftJob.running && <JobProgress className="-mt-4 mb-6" job={draftJob.job} onCancel={draftJob.cancel} />}
      <p className="-mt-4 mb-8 max-w-3xl text-muted-foreground">Cada fase produce un documento. Al aprobarlo, alimenta la siguiente fase y el contexto que usan todos los agentes. Los planes de cuenta y los deals son la ejecución; las retros cierran el ciclo.</p>
      <div className="grid gap-4 lg:grid-cols-5">
        {PHASES.map((ph, i) => {
          const kinds = ph.artifacts;
          return (
            <div key={ph.id} className={`rounded-lg border bg-card p-4 ${i === phaseIdx ? "ring-2 ring-signal" : ""}`}>
              <p className="eyebrow">{i + 1}. {ph.bmad}</p>
              <h3 className="mt-1 flex items-center gap-2 text-2xl">{ph.label} {i < phaseIdx && <CheckCircle2 className="size-4 text-success" />}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{ph.description}</p>
              {ph.id === "execution" && (
                <div className="mt-3 space-y-1.5 text-xs">
                  {Object.values(TRACKS).map((t) => <p key={t.label}><strong>{t.label}:</strong> {t.description}</p>)}
                  <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => openAgent({ personaId: "sheryl", workflowId: "weekly_plan", prompt: "PS · Plan de la semana" })}>Plan de la semana</Button>
                </div>
              )}
              {kinds.map((k) => {
                const list = arts.filter((a) => a.kind === k);
                return (
                  <div key={k} className="mt-4">
                    <div className="flex items-center justify-between gap-3"><p className="min-w-0 break-words text-sm font-medium">{ARTIFACTS[k].label}</p><span className="shrink-0 text-[10px] text-muted-foreground">{getPersona(PERSONA_FOR[k])?.name}</span></div>
                    <div className="mt-1.5 space-y-1">
                      {list.slice(0, k === "winloss" ? 5 : 3).map((a) => (
                        <button key={a.id} onClick={() => setSelected(a.id)} className="flex min-h-10 w-full items-center justify-between gap-2 rounded border px-2 py-1.5 text-left text-xs hover:bg-accent md:min-h-0">
                          <span className="truncate"><FileText className="mr-1 inline size-3" />{k === "winloss" ? a.title.replace("Win/Loss: ", "") : `v${a.version}`}</span>
                          <span className={`shrink-0 ${a.status === "approved" ? "text-success" : "text-muted-foreground"}`}>{STATUS[a.status]}</span>
                        </button>
                      ))}
                      {list.length === 0 && <p className="text-xs text-muted-foreground">Aún no hay ninguno.</p>}
                    </div>
                    {(k === "retro" || k === "winloss") && closedCount === 0
                      ? <p className="mt-1 text-xs text-muted-foreground">Necesita al menos un deal ganado o perdido. Sin cierres, el borrador sería inventado.</p>
                      : <Button size="sm" variant="ghost" className="mt-1 h-10 w-full text-xs md:h-7" onClick={() => setNewKind(k)}><Sparkles className="size-3" /> Borrador con IA</Button>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <NewDraft kind={newKind} onClose={() => setNewKind(null)} onStart={(input) => { setNewKind(null); void draftJob.start(input, `Borrador: ${ARTIFACTS[input.kind as ArtifactKind]?.label ?? "documento"}`); }} />
      <ArtifactSheet art={arts.find((a) => a.id === selected) ?? null} all={arts} leader={leader} onClose={() => setSelected(null)} onSelect={setSelected} />
    </Page>
  );
}

function NewDraft({ kind, onClose, onStart }: { kind: ArtifactKind | null; onClose: () => void; onStart: (input: { kind: string; notes: string; dealId: string | null }) => void }) {
  const [notes, setNotes] = useState("");
  const [dealId, setDealId] = useState("");
  const { data: closed = [] } = useQuery({
    queryKey: ["closed-deals"], enabled: kind === "winloss",
    queryFn: async () => (await supabase.from("deals").select("id,name,stage").in("stage", ["won", "lost"]).order("updated_at", { ascending: false }).limit(30)).data ?? [],
  });
  if (!kind) return null;
  const p = getPersona(PERSONA_FOR[kind]);
  async function go() {
    if (kind === "winloss" && !dealId) return toast.error("Elige el deal cerrado.");
    onStart({ kind: kind!, notes, dealId: dealId || null });
    setNotes(""); setDealId("");
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{ARTIFACTS[kind].label} con {p?.name}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{p?.name} usará el contexto de empresa y los documentos aprobados. Secciones: {ARTIFACTS[kind].sections.join(" · ")}.</p>
        {kind === "winloss" && (
          <select className="h-10 rounded-md border bg-background px-2 text-sm md:h-9" value={dealId} onChange={(e) => setDealId(e.target.value)}>
            <option value="">Elige un deal cerrado…</option>
            {closed.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.stage === "won" ? "Ganado" : "Perdido"})</option>)}
          </select>
        )}
        <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas o foco opcional (p. ej. «priorizamos mid-market en España este trimestre»)" />
        <Button onClick={go}>Crear borrador</Button>
        <p className="text-xs text-muted-foreground">Tarda alrededor de un minuto. Lo redacto en segundo plano y te aviso al terminar.</p>
      </DialogContent>
    </Dialog>
  );
}

function ArtifactSheet({ art, all, leader, onClose, onSelect }: { art: Art | null; all: Art[]; leader: boolean; onClose: () => void; onSelect: (id: string) => void }) {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const [edit, setEdit] = useState<string | null>(null);
  const [method, setMethod] = useState("premortem");
  const reviewJob = useJob<"deep_review", { review?: DeepReview }>("deep_review", { targetId: art?.id ?? null });
  const [dismissed, setDismissed] = useState<string | null>(null);
  const busy = reviewJob.running;
  const reviewDone = freshResult<BgJob<{ review?: DeepReview }>>(reviewJob.job, dismissed);
  const result = reviewDone?.result?.review ?? null;
  const setResult = (_: null) => { if (reviewDone) setDismissed(reviewDone.id); };
  const refresh = () => { qc.invalidateQueries({ queryKey: ["artifacts"] }); qc.invalidateQueries({ queryKey: ["cycle"] }); };
  if (!art) return null;
  const kind = art.kind as ArtifactKind;
  const nextVersion = Math.max(...all.filter((a) => a.kind === kind).map((a) => a.version)) + 1;

  async function save() {
    const { error } = await supabase.from("gtm_artifacts").update({ content: edit! }).eq("id", art!.id);
    if (error) return toast.error(errorText(error));
    setEdit(null); refresh(); toast.success("Guardado.");
  }
  async function approve() {
    if (kind !== "winloss") await supabase.from("gtm_artifacts").update({ status: "archived" }).eq("kind", kind).eq("status", "approved").neq("id", art!.id);
    const { error } = await supabase.from("gtm_artifacts").update({ status: "approved", approved_by: me?.user.id, approved_at: new Date().toISOString() }).eq("id", art!.id);
    if (error) return toast.error(errorText(error));
    refresh(); toast.success("Aprobado: ya alimenta la siguiente fase y a los agentes.");
  }
  async function runReview() {
    if (reviewDone) setDismissed(reviewDone.id);
    void reviewJob.start({ artifactId: art!.id, method });
  }
  async function applyRevision() {
    const { data, error } = await supabase.from("gtm_artifacts").insert({ kind, title: art!.title, version: nextVersion, content: result!.revised, persona: art!.persona, meta: art!.meta ?? {} }).select("id").single();
    if (error) return toast.error(errorText(error));
    setResult(null); refresh(); onSelect(data.id); toast.success(`Creada la v${nextVersion} en borrador.`);
  }
  // An approved document is never edited in place: a new version starts as a draft from it.
  async function newVersion() {
    const { data, error } = await supabase.from("gtm_artifacts").insert({ kind, title: art!.title, version: nextVersion, content: art!.content, persona: art!.persona, meta: { ...(art!.meta ?? {}), from_version: art!.version } }).select("id").single();
    if (error) return toast.error(errorText(error));
    refresh(); onSelect(data.id); toast.success(`Creada la v${nextVersion} en borrador. La v${art!.version} sigue alimentando a los agentes hasta que apruebes la nueva.`);
  }
  async function withdraw() {
    if (!window.confirm(`Retirar la aprobación de la v${art!.version}: dejará de alimentar a los agentes y la fase volverá a quedar pendiente. ¿Seguir?`)) return;
    const { error } = await supabase.from("gtm_artifacts").update({ status: "draft", approved_by: null, approved_at: null }).eq("id", art!.id);
    if (error) return toast.error(errorText(error));
    refresh(); toast.success("Aprobación retirada: el documento vuelve a borrador.");
  }
  async function remove() {
    const { error } = await supabase.from("gtm_artifacts").delete().eq("id", art!.id);
    if (error) return toast.error(errorText(error));
    refresh(); onClose();
  }

  return (
    <Sheet open onOpenChange={(o) => { if (!o) { onClose(); setEdit(null); setResult(null); } }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader className="text-left">
          <SheetTitle className="break-words pr-10 font-display text-2xl [overflow-wrap:anywhere] md:text-3xl">{art.title} · v{art.version}</SheetTitle>
          <p className="text-xs text-muted-foreground">{STATUS[art.status]}{art.status === "approved" ? " · alimenta a los agentes" : ""} · redactado con {getPersona(art.persona)?.name ?? "Nokko"} · {new Date(art.updated_at).toLocaleDateString("es-ES")}{art.meta?.from_version ? ` · parte de la v${art.meta.from_version}` : ""}</p>
        </SheetHeader>
        <div className="mt-4 flex flex-wrap gap-2">
          {art.status === "draft" && (edit === null
            ? <Button size="sm" variant="outline" onClick={() => setEdit(art.content)}>Editar</Button>
            : <><Button size="sm" onClick={save}>Guardar</Button><Button size="sm" variant="ghost" onClick={() => setEdit(null)}>Cancelar</Button></>)}
          {art.status === "draft" && leader && edit === null && <Button size="sm" onClick={approve}><CheckCircle2 className="size-4" /> Aprobar</Button>}
          {art.status === "draft" && !leader && <span className="self-center text-xs text-muted-foreground">Solo Owner o Sales Leader pueden aprobar.</span>}
          {art.status === "approved" && leader && <>
            <Button size="sm" variant="outline" onClick={newVersion}>Crear v{nextVersion} para editar</Button>
            <Button size="sm" variant="ghost" onClick={withdraw}>Retirar aprobación</Button>
          </>}
          <span className="flex w-full items-center gap-1.5 sm:ml-auto sm:w-auto">
            <select className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-xs sm:flex-none" value={method} onChange={(e) => setMethod(e.target.value)}>
              {METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <Button size="sm" variant="outline" className="shrink-0" onClick={runReview} disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />} Revisión profunda</Button>
          </span>
          <SaveToDriveButton size="sm" title={`${art.title} · v${art.version}`} markdown={`# ${art.title} · v${art.version}\n\n${art.content}`} />
          {me?.roles.includes("owner") && <Button size="sm" variant="ghost" className="text-destructive" onClick={remove}>Borrar</Button>}
        </div>
        {busy && <JobProgress className="mt-4" job={reviewJob.job} onCancel={reviewJob.cancel} />}
        {result && (
          <div className="mt-4 rounded-lg border bg-accent/40 p-4">
            <p className="text-sm font-medium">{result.summary}</p>
            <ul className="mt-2 space-y-2 text-sm">
              {result.findings.map((f, i) => <li key={i}><span className={`mr-2 rounded px-1.5 py-0.5 font-mono text-[10px] uppercase ${f.severity === "alta" ? "bg-destructive/15 text-destructive" : "bg-muted"}`}>{f.severity}</span>{f.issue} <span className="text-muted-foreground">→ {f.fix}</span></li>)}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" onClick={applyRevision}>Aceptar cambios (nueva versión)</Button><Button size="sm" variant="ghost" onClick={() => setResult(null)}>Descartar</Button></div>
          </div>
        )}
        <Sources meta={art.meta} />
        <div className="mt-6">
          {edit !== null
            ? <Textarea rows={28} className="font-mono text-base md:text-xs" value={edit} onChange={(e) => setEdit(e.target.value)} />
            : <article className="prose-sm min-w-0 space-y-2 break-words text-sm leading-relaxed [&_h2]:mt-5 [&_h2]:font-display [&_h2]:text-xl [&_li]:ml-5 [&_li]:list-disc [&_strong]:font-semibold [&_table]:w-full [&_table]:min-w-[36rem] [&_table]:text-xs md:[&_table]:min-w-0 [&_td]:border-b [&_td]:px-2 [&_td]:py-1 [&_th]:border-b [&_th]:px-2 [&_th]:py-1 [&_th]:text-left"><ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>{art.content}</ReactMarkdown></article>}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** What a draft was built from (saved by the drafting core in meta.sources). Older drafts have none. */
function Sources({ meta }: { meta: any }) {
  const src = meta?.sources as { documentos_aprobados?: string[]; obligatorios?: string[]; conocimiento?: string[] } | undefined;
  if (!src) return null;
  const rows: [string, string[] | undefined][] = [["Reglas de obligado cumplimiento", src.obligatorios], ["Conocimiento de empresa", src.conocimiento], ["Documentos aprobados", src.documentos_aprobados]];
  return (
    <details className="mt-4 rounded-md border p-3 text-xs">
      <summary className="cursor-pointer font-medium">Fuentes usadas</summary>
      <dl className="mt-2 space-y-1.5">
        {rows.map(([label, list]) => (
          <div key={label}><dt className="text-muted-foreground">{label}</dt><dd>{list?.length ? list.join(" · ") : "ninguna"}</dd></div>
        ))}
        <div><dt className="text-muted-foreground">Además</dt><dd>La configuración de la estrategia (posicionamiento, ICP, segmentos, pilares, cuotas).</dd></div>
      </dl>
    </details>
  );
}
