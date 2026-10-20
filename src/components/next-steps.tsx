import { Link } from "@tanstack/react-router";
import { ArrowRight, Compass } from "lucide-react";
import { useCycle } from "@/hooks/use-cycle";
import { useAgent } from "@/components/agent";
import { getPersona } from "@/lib/bmad/personas";
import { getWorkflow } from "@/lib/bmad/workflows";
import { PHASES } from "@/lib/bmad/phases";

/** Hub card: current cycle phase + prioritized next steps, each launching the right agent workflow. */
export function NextSteps() {
  const { data } = useCycle();
  const { open } = useAgent();
  if (!data) return null;
  const phase = PHASES.find((p) => p.id === data.phase)!;
  const idx = PHASES.findIndex((p) => p.id === data.phase);
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow flex items-center gap-1.5"><Compass className="size-3.5" /> ¿Qué hago ahora?</p>
          <h3 className="mt-1 text-2xl">Fase actual: {phase.label}</h3>
        </div>
        <Link to="/cycle" className="py-2 text-xs text-signal md:py-0">Ver Ciclo GTM →</Link>
      </div>
      <div className="mb-4 flex gap-1">
        {PHASES.map((p, i) => (
          <div key={p.id} className="min-w-0 flex-1">
            <div className={`h-1.5 rounded ${i < idx ? "bg-primary" : i === idx ? "bg-signal" : "bg-muted"}`} />
            <p className={`mt-1 truncate text-[11px] ${i === idx ? "font-medium" : "hidden text-muted-foreground sm:block"}`}>{p.label}</p>
          </div>
        ))}
      </div>
      {data.steps.length === 0 && <p className="text-sm text-muted-foreground">Todo al día en tu parte del ciclo.</p>}
      <div className="space-y-2">
        {data.steps.slice(0, 4).map((s) => {
          const p = getPersona(s.persona);
          const w = getWorkflow(s.workflow);
          const artifact = s.id.startsWith("approve_") || s.id.startsWith("draft_");
          return (
            <div key={s.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
              <div className="min-w-0">
                <p className="break-words text-sm font-medium">{s.title}</p>
                <p className="text-xs text-muted-foreground">{s.why} · con {p?.name} ({p?.title})</p>
              </div>
              {artifact && s.id.startsWith("approve_")
                ? <Link to="/cycle" className="-my-2 flex shrink-0 items-center gap-1 px-2 py-2 text-xs text-signal md:my-0 md:px-0 md:py-0">Revisar <ArrowRight className="size-3" /></Link>
                : <button onClick={() => open({ personaId: s.persona, workflowId: s.workflow, prompt: `${w?.label ?? s.title}: empecemos.` })} className="-my-2 flex shrink-0 items-center gap-1 px-2 py-2 text-xs text-signal md:my-0 md:px-0 md:py-0">Empezar <ArrowRight className="size-3" /></button>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
