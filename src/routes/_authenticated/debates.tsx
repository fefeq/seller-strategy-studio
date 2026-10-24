import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MessagesSquare, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { Page, Empty } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DEBATE_LEVELS, canConvene, withRebuttal, type DebateLevel } from "@/lib/bmad/teams";
import { PERSONAS, getPersona } from "@/lib/bmad/personas";
import { useJob } from "@/components/background";
import { errorText } from "@/lib/errors";

export const Route = createFileRoute("/_authenticated/debates")({
  // debate: link from the notice «Debate listo…» straight to it.
  validateSearch: (s: Record<string, unknown>): { debate?: string } => (typeof s.debate === "string" ? { debate: s.debate } : {}),
  head: () => ({ meta: [
    { title: "Debates — Nokko" },
    { name: "description", content: "Mesas de debate entre agentes: C-Levels, Sales, Marketing, Partners o todos a la vez, con acuerdos y acciones." },
    { property: "og:title", content: "Debates — Nokko" },
    { property: "og:description", content: "Mesas de debate multiagente por niveles con acuerdos y acciones." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: DebatesPage,
});

type Synth = { summary: string; agreements: string[]; disagreements: string[]; risks: string[]; actions: { title: string; owner_persona: string; due_in_days: number }[] };
type Debate = { id: string; level: string; topic: string; participants: string[]; turns: { persona: string; round: number; text: string }[]; synthesis: Synth; created_at: string };
const LEVELS = Object.keys(DEBATE_LEVELS) as DebateLevel[];

// Below lg the history sits under the form/result; bring the result into view after a tap.
function revealOnMobile(el: HTMLElement | null) {
  if (el && typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
    requestAnimationFrame(() => el.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
}

function DebatesPage() {
  const { data: me } = useMe();
  const roles = me?.roles ?? [];
  const qc = useQueryClient();
  const search = Route.useSearch();
  const [level, setLevel] = useState<DebateLevel>(canConvene("c_level", roles) ? "c_level" : "sales");
  const [participants, setParticipants] = useState<string[]>(DEBATE_LEVELS[level].participants);
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("");
  const [selected, setSelected] = useState<string | null>(search.debate ?? null);
  const [creating, setCreating] = useState(!search.debate);
  useEffect(() => { if (search.debate) { setSelected(search.debate); setCreating(false); } }, [search.debate]);
  const debateJob = useJob("debate", {
    onDone: async (j) => {
      await qc.invalidateQueries({ queryKey: ["debates"] });
      const id = (j.result as { debateId?: string } | null)?.debateId;
      if (id) { setSelected(id); setCreating(false); revealOnMobile(mainRef.current); }
    },
  });
  const busy = debateJob.running;
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => setParticipants(DEBATE_LEVELS[level].participants), [level]);

  const { data: debates = [] } = useQuery({
    queryKey: ["debates", me?.currentOrg?.org_id], enabled: !!me?.currentOrg,
    queryFn: async () => ((await supabase.from("debates").select("id,level,topic,participants,turns,synthesis,created_at").order("created_at", { ascending: false }).limit(30)).data ?? []) as unknown as Debate[],
  });
  const { data: subjects } = useQuery({
    queryKey: ["debate-subjects"],
    queryFn: async () => {
      const [d, a, art] = await Promise.all([
        supabase.from("deals").select("id,name").not("stage", "in", "(won,lost)").order("updated_at", { ascending: false }).limit(30),
        supabase.from("accounts").select("id,name").order("name").limit(50),
        supabase.from("gtm_artifacts").select("id,title,version").neq("status", "archived").order("updated_at", { ascending: false }).limit(20),
      ]);
      return { deals: d.data ?? [], accounts: a.data ?? [], artifacts: art.data ?? [] };
    },
  });
  const current = debates.find((d) => d.id === selected);

  async function start() {
    if (!topic.trim()) return toast.error("Escribe el tema del debate.");
    const [subjectType, subjectId] = subject ? subject.split(":") : [null, null];
    void debateJob.start({ level, topic: topic.trim(), subjectType: (subjectType as "deal" | "account" | "artifact" | null) ?? null, subjectId: subjectId ?? null, participants }, `Debate: ${topic.trim().slice(0, 80)}`);
    setTopic("");
  }

  async function toTask(a: Synth["actions"][number]) {
    const due = new Date(Date.now() + a.due_in_days * 86_400_000).toISOString().slice(0, 10);
    const { error } = await supabase.from("tasks").insert({ title: a.title, due_date: due, owner_id: me?.user.id, source: "debate", notes: `Del debate: ${current?.topic ?? ""} (responsable sugerido: ${getPersona(a.owner_persona)?.name ?? a.owner_persona})` });
    if (error) return toast.error(errorText(error));
    toast.success("Tarea creada.");
  }

  return (
    <Page eyebrow="Debate multiagente" title="Debates" actions={<Button onClick={() => { setCreating(true); setSelected(null); revealOnMobile(mainRef.current); }}><Plus className="size-4" /> Nuevo debate</Button>}>
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="order-2 space-y-1.5 lg:order-1">
          <p className="eyebrow mb-2">Historial</p>
          {debates.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay debates.</p>}
          {debates.map((d) => (
            <button key={d.id} onClick={() => { setSelected(d.id); setCreating(false); revealOnMobile(mainRef.current); }} className={`w-full min-w-0 break-words rounded-md border p-2.5 text-left text-sm hover:bg-accent ${selected === d.id ? "border-primary" : ""}`}>
              <span className="font-mono text-[10px] uppercase text-muted-foreground">{DEBATE_LEVELS[d.level as DebateLevel]?.label} · {new Date(d.created_at).toLocaleDateString("es-ES")}</span>
              <p className="line-clamp-2">{d.topic}</p>
            </button>
          ))}
        </aside>
        <section ref={mainRef} className="order-1 min-w-0 scroll-mt-20 lg:order-2">
          {creating && (
            <div className="space-y-5 rounded-lg border bg-card p-5">
              <div>
                <p className="eyebrow mb-2">1. Nivel</p>
                <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
                  {LEVELS.map((l) => {
                    const allowed = canConvene(l, roles);
                    return (
                      <button key={l} disabled={!allowed} onClick={() => setLevel(l)} title={allowed ? "" : "Solo Owner o Sales Leader"} className={`rounded-md border p-3 text-left disabled:opacity-40 ${level === l ? "border-primary bg-accent" : "hover:bg-accent"}`}>
                        <p className="text-sm font-medium">{DEBATE_LEVELS[l].label}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">{DEBATE_LEVELS[l].purpose}</p>
                        {!allowed && <p className="mt-1 text-[11px] font-medium md:hidden">Solo Owner o Sales Leader</p>}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="eyebrow mb-2">2. Participantes</p>
                <div className="flex flex-wrap gap-1.5">
                  {PERSONAS.map((p) => {
                    const on = participants.includes(p.id);
                    return <button key={p.id} title={`${p.title} · inspirado en ${p.inspiredBy}`} onClick={() => setParticipants((x) => on ? x.filter((i) => i !== p.id) : [...x, p.id])} className={`min-h-9 rounded-none border px-3 py-2 text-left text-xs md:min-h-0 md:py-1 ${on ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>{p.name} <span className="opacity-70">· {p.title}</span></button>;
                  })}
                </div>
                {!withRebuttal(participants) && <p className="mt-1.5 text-xs text-muted-foreground">Con más de 5 participantes se hace una sola ronda para contener el coste.</p>}
              </div>
              <div>
                <p className="eyebrow mb-2">3. Tema</p>
                <Textarea rows={3} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="P. ej. «¿Entramos en el segmento enterprise este año?» o «Cómo desatascar este deal»" />
                <select className="mt-2 h-10 w-full md:h-9 rounded-md border bg-background px-2 text-sm" value={subject} onChange={(e) => setSubject(e.target.value)}>
                  <option value="">Sin sujeto concreto (pregunta libre)</option>
                  {subjects?.deals.length ? <optgroup label="Deals">{subjects.deals.map((d) => <option key={d.id} value={`deal:${d.id}`}>{d.name}</option>)}</optgroup> : null}
                  {subjects?.accounts.length ? <optgroup label="Cuentas">{subjects.accounts.map((d) => <option key={d.id} value={`account:${d.id}`}>{d.name}</option>)}</optgroup> : null}
                  {subjects?.artifacts.length ? <optgroup label="Documentos">{subjects.artifacts.map((d) => <option key={d.id} value={`artifact:${d.id}`}>{d.title} v{d.version}</option>)}</optgroup> : null}
                </select>
              </div>
              <Button className="h-auto min-h-10 whitespace-normal py-2 text-center md:min-h-0 md:whitespace-nowrap" onClick={start} disabled={busy || participants.length < 2}>{busy ? <><Loader2 className="size-4 animate-spin" /> Debatiendo en segundo plano · {debateJob.job?.step ?? "en cola"}</> : <><MessagesSquare className="size-4" /> Empezar debate</>}</Button>
              {busy && <p className="text-xs text-muted-foreground">Puedes salir de aquí: te aviso cuando termine. <button type="button" className="underline" onClick={debateJob.cancel}>Cancelar</button></p>}
            </div>
          )}
          {!creating && !current && <Empty>Elige un debate del historial o crea uno nuevo.</Empty>}
          {!creating && current && (
            <div className="space-y-6">
              <div>
                <p className="eyebrow">{DEBATE_LEVELS[current.level as DebateLevel]?.label}</p>
                <h2 className="mt-1 break-words text-3xl">{current.topic}</h2>
              </div>
              <div className="rounded-lg border bg-card p-5">
                <h3 className="text-xl">Síntesis del moderador</h3>
                <p className="mt-2 text-sm">{current.synthesis.summary}</p>
                <div className="mt-4 grid gap-4 md:grid-cols-3 text-sm">
                  <List title="Acuerdos" items={current.synthesis.agreements} />
                  <List title="Desacuerdos" items={current.synthesis.disagreements} />
                  <List title="Riesgos" items={current.synthesis.risks} />
                </div>
                <p className="eyebrow mb-2 mt-5">Próximos pasos</p>
                <div className="space-y-1.5">
                  {current.synthesis.actions.map((a, i) => (
                    <div key={i} className="flex flex-col items-start gap-2 rounded border p-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                      <span className="min-w-0 break-words">{a.title} <span className="text-xs text-muted-foreground">· {getPersona(a.owner_persona)?.name ?? a.owner_persona} · {a.due_in_days} días</span></span>
                      <Button size="sm" variant="outline" className="shrink-0" onClick={() => toTask(a)}>Crear tarea</Button>
                    </div>
                  ))}
                </div>
              </div>
              {[1, 2].map((round) => {
                const turns = current.turns.filter((t) => t.round === round);
                if (!turns.length) return null;
                return (
                  <div key={round}>
                    <p className="eyebrow mb-2">{round === 1 ? "Ronda 1 · Posturas" : "Ronda 2 · Réplicas"}</p>
                    <div className="grid gap-3 md:grid-cols-2">
                      {turns.map((t, i) => {
                        const p = getPersona(t.persona);
                        return (
                          <div key={i} className="rounded-lg border bg-card p-4">
                            <p className="text-sm font-medium">{p?.name} <span className="font-normal text-muted-foreground">· {p?.title}</span></p>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{t.text}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </Page>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="eyebrow mb-1">{title}</p>
      {items.length ? <ul className="list-disc space-y-1 pl-4">{items.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p className="text-muted-foreground">—</p>}
    </div>
  );
}
