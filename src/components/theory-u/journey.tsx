import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Empty, ScreenState } from "@/components/page";
import { Field } from "@/components/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { nextPhase, phaseIndex, U_PHASES } from "@/lib/theory-u";
import { synthesizeJourney } from "@/lib/ai.functions";
import { errorText } from "@/lib/errors";

// Vertical offset per phase to draw the U: down the left, bottom, up the right.
// Only from sm: on phones the phases stack in one column.
const DEPTH = ["sm:mt-0", "sm:mt-16", "sm:mt-32", "sm:mt-16", "sm:mt-0"];

// Below lg the list/editor stack, so bring the target into view after a tap.
function revealOnMobile(el: HTMLElement | null) {
  if (el && typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
    requestAnimationFrame(() => el.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
}

const NO_JOURNEYS: { id: string; title: string; phase: string }[] = [];

export function UJourney() {
  const qc = useQueryClient();
  const [selId, setSelId] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const journeys = useQuery({
    queryKey: ["u_journeys"],
    queryFn: async () => {
      const { data, error } = await supabase.from("u_journeys").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  // Only read once answered: ScreenState draws the empty text and the list after the first answer.
  const list = journeys.data ?? NO_JOURNEYS;
  const counts = useQuery({
    queryKey: ["u_counts", selId],
    enabled: !!selId,
    queryFn: async () => {
      const [n, e] = await Promise.all([
        supabase.from("sensing_notes").select("id", { count: "exact", head: true }).eq("journey_id", selId!),
        supabase.from("gtm_experiments").select("id", { count: "exact", head: true }).eq("journey_id", selId!),
      ]);
      const failed = n.error ?? e.error;
      if (failed) throw failed;
      return { notes: n.count ?? 0, experiments: e.count ?? 0 };
    },
  });
  useEffect(() => { if (!selId && list[0]) setSelId(list[0].id); }, [list, selId]);
  const sel = list.find((j) => j.id === selId);

  async function add() {
    const { data, error } = await supabase.from("u_journeys").insert({ title: "Nuevo recorrido U" }).select().single();
    if (error) return toast.error(errorText(error));
    await qc.invalidateQueries({ queryKey: ["u_journeys"] });
    setSelId(data.id);
    revealOnMobile(editorRef.current);
  }

  return (
    <ScreenState isPending={journeys.isPending} error={journeys.error} refetch={journeys.refetch} skeleton="cards">
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <div className="space-y-2">
        <Button size="sm" className="w-full" onClick={add}>+ Nuevo recorrido</Button>
        {list.map((j) => (
          <button key={j.id} onClick={() => { setSelId(j.id); revealOnMobile(editorRef.current); }} className={`block w-full min-w-0 break-words rounded-md border bg-card p-3 text-left text-sm ${selId === j.id ? "border-signal" : ""}`}>
            <span className="font-medium">{j.title}</span>
            <span className="block font-mono text-xs text-muted-foreground">{U_PHASES[phaseIndex(j.phase)]?.label}</span>
          </button>
        ))}
      </div>
      <div ref={editorRef} className="min-w-0 scroll-mt-20">
        {sel ? <JourneyEditor key={sel.id} journey={sel} counts={counts} /> : (
          <Empty>Un recorrido U guía al equipo por 5 movimientos para replantear la estrategia comercial: co-iniciar, co-percibir, presencing, co-crear y co-evolucionar. Crea el primero.</Empty>
        )}
      </div>
    </div>
    </ScreenState>
  );
}

type Counts = Pick<UseQueryResult<{ notes: number; experiments: number }>, "data" | "isPending" | "error" | "refetch">;

function JourneyEditor({ journey, counts }: { journey: any; counts: Counts }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(journey.title);
  const [intention, setIntention] = useState(journey.intention);
  const [answers, setAnswers] = useState<Record<string, string>>(journey.answers ?? {});
  const [view, setView] = useState<string>(journey.phase);
  const [busy, setBusy] = useState(false);
  const phaseRef = useRef<HTMLDivElement>(null);
  const synth = useServerFn(synthesizeJourney);
  const current = phaseIndex(journey.phase);
  const phase = U_PHASES[phaseIndex(view)] ?? U_PHASES[0];

  async function save(patch: Record<string, unknown> = {}) {
    const { error } = await supabase.from("u_journeys").update({ title, intention, answers, ...patch }).eq("id", journey.id);
    if (error) { toast.error(errorText(error)); return false; }
    qc.invalidateQueries({ queryKey: ["u_journeys"] });
    return true;
  }
  async function advance() {
    const next = nextPhase(journey.phase);
    if (!next) return;
    if (await save({ phase: next })) { setView(next); toast.success(`Fase: ${U_PHASES[phaseIndex(next)].label}.`); }
  }
  async function runSynth() {
    if (!(await save())) return;
    setBusy(true);
    try { await synth({ data: { journeyId: journey.id } }); qc.invalidateQueries({ queryKey: ["u_journeys"] }); }
    catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 rounded-lg border bg-card p-5 md:grid-cols-[1fr_2fr]">
        <Field label="Recorrido"><Input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => save()} /></Field>
        <Field label="Intención / pregunta que nos convoca"><Input value={intention} placeholder="Ej.: ¿Cómo dejamos de competir en precio en mid-market?" onChange={(e) => setIntention(e.target.value)} onBlur={() => save()} /></Field>
      </div>

      <div className="relative rounded-lg border bg-card px-4 pb-6 pt-5">
        <svg className="pointer-events-none absolute inset-x-[10%] top-10 hidden h-40 sm:block w-[80%] text-border" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden>
          <path d="M0 0 C 0 45, 100 45, 100 0" fill="none" stroke="currentColor" strokeWidth="0.6" strokeDasharray="1.5 1.5" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="relative -mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:snap-none sm:grid-cols-5 sm:overflow-visible sm:px-0 sm:pb-0">
          {U_PHASES.map((p, i) => {
            const state = i < current ? "done" : i === current ? "current" : "todo";
            return (
              <button key={p.key} onClick={() => { setView(p.key); revealOnMobile(phaseRef.current); }} className={`${DEPTH[i]} w-[42vw] max-w-48 shrink-0 snap-start break-words rounded-lg border p-3 text-left sm:w-auto sm:min-w-0 sm:max-w-none transition-colors ${view === p.key ? "border-signal bg-signal/5" : "bg-background hover:border-foreground/30"}`}>
                <span className={`font-mono text-[10px] uppercase ${state === "current" ? "text-signal" : "text-muted-foreground"}`}>{i + 1} · {state === "done" ? "Hecho" : state === "current" ? "Ahora" : "Pendiente"}</span>
                <span className="mt-1 block text-[15px] font-semibold leading-tight">{p.label}</span>
                <span className="block text-xs text-muted-foreground">{p.tagline}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div ref={phaseRef} className="scroll-mt-20 space-y-4 rounded-lg border bg-card p-5">
        <div>
          <h3 className="text-2xl">{phase.label}</h3>
          <p className="max-w-3xl text-sm text-muted-foreground">{phase.description}</p>
          {/* No number until u_counts answers; a failed count says so instead of showing 0. */}
          {phase.key === "co_sensing" && <ScreenState isPending={counts.isPending} error={counts.error} refetch={counts.refetch} skeleton="line"><p className="mt-2 font-mono text-xs text-muted-foreground">{counts.data?.notes} notas de sensing vinculadas · regístralas en la pestaña Sensing</p></ScreenState>}
          {phase.key === "co_creating" && <ScreenState isPending={counts.isPending} error={counts.error} refetch={counts.refetch} skeleton="line"><p className="mt-2 font-mono text-xs text-muted-foreground">{counts.data?.experiments} prototipos vinculados · gestiónalos en la pestaña Prototipos</p></ScreenState>}
        </div>
        {phase.prompts.map((q, i) => {
          const k = `${phase.key}.${i}`;
          return <Field key={k} label={q}><Textarea rows={3} value={answers[k] ?? ""} onChange={(e) => setAnswers({ ...answers, [k]: e.target.value })} onBlur={() => save()} /></Field>;
        })}
        <div className="flex flex-wrap gap-2">
          {phaseIndex(view) === current && nextPhase(journey.phase) && <Button className="h-auto min-h-10 whitespace-normal py-2 text-left md:min-h-0 md:whitespace-nowrap" onClick={advance}>Avanzar a {U_PHASES[current + 1].label}</Button>}
          <Button variant="outline" onClick={runSynth} disabled={busy}>{busy ? "Sintetizando…" : "Sintetizar con IA"}</Button>
        </div>
      </div>

      {journey.ai_synthesis && (
        <div className="rounded-lg border bg-card p-5">
          <p className="eyebrow mb-2">Síntesis del recorrido</p>
          <pre className="whitespace-pre-wrap font-sans text-sm">{journey.ai_synthesis}</pre>
        </div>
      )}
    </div>
  );
}
