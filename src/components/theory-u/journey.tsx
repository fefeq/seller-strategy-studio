import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Empty } from "@/components/page";
import { Field } from "@/components/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { nextPhase, phaseIndex, U_PHASES } from "@/lib/theory-u";
import { synthesizeJourney } from "@/lib/ai.functions";

// Vertical offset per phase to draw the U: down the left, bottom, up the right.
const DEPTH = ["mt-0", "mt-16", "mt-32", "mt-16", "mt-0"];

export function UJourney() {
  const qc = useQueryClient();
  const [selId, setSelId] = useState<string | null>(null);
  const { data: list = [] } = useQuery({
    queryKey: ["u_journeys"],
    queryFn: async () => (await supabase.from("u_journeys").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: counts } = useQuery({
    queryKey: ["u_counts", selId],
    enabled: !!selId,
    queryFn: async () => {
      const [n, e] = await Promise.all([
        supabase.from("sensing_notes").select("id", { count: "exact", head: true }).eq("journey_id", selId!),
        supabase.from("gtm_experiments").select("id", { count: "exact", head: true }).eq("journey_id", selId!),
      ]);
      return { notes: n.count ?? 0, experiments: e.count ?? 0 };
    },
  });
  useEffect(() => { if (!selId && list[0]) setSelId(list[0].id); }, [list, selId]);
  const sel = list.find((j) => j.id === selId);

  async function add() {
    const { data, error } = await supabase.from("u_journeys").insert({ title: "Nuevo recorrido U" }).select().single();
    if (error) return toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["u_journeys"] });
    setSelId(data.id);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <div className="space-y-2">
        <Button size="sm" className="w-full" onClick={add}>+ Nuevo recorrido</Button>
        {list.map((j) => (
          <button key={j.id} onClick={() => setSelId(j.id)} className={`block w-full rounded-md border bg-card p-3 text-left text-sm ${selId === j.id ? "border-signal" : ""}`}>
            <span className="font-medium">{j.title}</span>
            <span className="block font-mono text-xs text-muted-foreground">{U_PHASES[phaseIndex(j.phase)]?.label}</span>
          </button>
        ))}
      </div>
      {sel ? <JourneyEditor key={sel.id} journey={sel} counts={counts} /> : (
        <Empty>Un recorrido U guía al equipo por 5 movimientos para replantear la estrategia comercial: co-iniciar, co-percibir, presencing, co-crear y co-evolucionar. Crea el primero.</Empty>
      )}
    </div>
  );
}

function JourneyEditor({ journey, counts }: { journey: any; counts?: { notes: number; experiments: number } }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(journey.title);
  const [intention, setIntention] = useState(journey.intention);
  const [answers, setAnswers] = useState<Record<string, string>>(journey.answers ?? {});
  const [view, setView] = useState<string>(journey.phase);
  const [busy, setBusy] = useState(false);
  const synth = useServerFn(synthesizeJourney);
  const current = phaseIndex(journey.phase);
  const phase = U_PHASES[phaseIndex(view)] ?? U_PHASES[0];

  async function save(patch: Record<string, unknown> = {}) {
    const { error } = await supabase.from("u_journeys").update({ title, intention, answers, ...patch } as any).eq("id", journey.id);
    if (error) { toast.error(error.message); return false; }
    qc.invalidateQueries({ queryKey: ["u_journeys"] });
    return true;
  }
  async function advance() {
    const next = nextPhase(journey.phase);
    if (!next) return;
    if (await save({ phase: next })) { setView(next); toast.success(`Fase: ${U_PHASES[phaseIndex(next)].label}`); }
  }
  async function runSynth() {
    if (!(await save())) return;
    setBusy(true);
    try { await synth({ data: { journeyId: journey.id } }); qc.invalidateQueries({ queryKey: ["u_journeys"] }); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 rounded-lg border bg-card p-5 md:grid-cols-[1fr_2fr]">
        <Field label="Recorrido"><Input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => save()} /></Field>
        <Field label="Intención / pregunta que nos convoca"><Input value={intention} placeholder="Ej.: ¿Cómo dejamos de competir en precio en mid-market?" onChange={(e) => setIntention(e.target.value)} onBlur={() => save()} /></Field>
      </div>

      <div className="relative rounded-lg border bg-card px-4 pb-6 pt-5">
        <svg className="pointer-events-none absolute inset-x-[10%] top-10 h-40 w-[80%] text-border" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden>
          <path d="M0 0 C 0 45, 100 45, 100 0" fill="none" stroke="currentColor" strokeWidth="0.6" strokeDasharray="1.5 1.5" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="relative grid grid-cols-5 gap-2">
          {U_PHASES.map((p, i) => {
            const state = i < current ? "done" : i === current ? "current" : "todo";
            return (
              <button key={p.key} onClick={() => setView(p.key)} className={`${DEPTH[i]} rounded-lg border p-3 text-left transition-colors ${view === p.key ? "border-signal bg-signal/5" : "bg-background hover:border-foreground/30"}`}>
                <span className={`font-mono text-[10px] uppercase ${state === "current" ? "text-signal" : "text-muted-foreground"}`}>{i + 1} · {state === "done" ? "Hecho" : state === "current" ? "Ahora" : "Pendiente"}</span>
                <span className="mt-1 block font-display text-lg leading-tight">{p.label}</span>
                <span className="block text-xs text-muted-foreground">{p.tagline}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-4 rounded-lg border bg-card p-5">
        <div>
          <h3 className="text-2xl">{phase.label}</h3>
          <p className="max-w-3xl text-sm text-muted-foreground">{phase.description}</p>
          {phase.key === "co_sensing" && <p className="mt-2 font-mono text-xs text-muted-foreground">{counts?.notes ?? 0} notas de sensing vinculadas · regístralas en la pestaña Sensing</p>}
          {phase.key === "co_creating" && <p className="mt-2 font-mono text-xs text-muted-foreground">{counts?.experiments ?? 0} prototipos vinculados · gestiónalos en la pestaña Prototipos</p>}
        </div>
        {phase.prompts.map((q, i) => {
          const k = `${phase.key}.${i}`;
          return <Field key={k} label={q}><Textarea rows={3} value={answers[k] ?? ""} onChange={(e) => setAnswers({ ...answers, [k]: e.target.value })} onBlur={() => save()} /></Field>;
        })}
        <div className="flex flex-wrap gap-2">
          {phaseIndex(view) === current && nextPhase(journey.phase) && <Button onClick={advance}>Avanzar a {U_PHASES[current + 1].label} <ArrowRight className="size-4" /></Button>}
          <Button variant="outline" onClick={runSynth} disabled={busy}><Sparkles className="size-4" /> {busy ? "Sintetizando…" : "Sintetizar con IA"}</Button>
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
