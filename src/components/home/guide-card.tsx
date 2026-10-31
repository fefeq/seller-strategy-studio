import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { useOnboarding } from "@/hooks/use-onboarding";
import { Button } from "@/components/ui/button";
import { SEARCH_JOB_KINDS, currentStep, guideKey, guideSteps, showGuide, type GuideStepId } from "@/lib/guide";

/** «Primeros pasos» in Inicio: onboarding → first search → Métricas. */
export function GuideCard() {
  const { data: me } = useMe();
  const orgId = me?.currentOrg?.org_id;
  const { data: onboarding } = useOnboarding();
  const [metricsSeen, setMetricsSeen] = useState(false);
  const [hidden, setHidden] = useState(true);

  // Browser storage is read after hydration so server and client render the same first frame.
  useEffect(() => {
    if (!orgId) return;
    setMetricsSeen(localStorage.getItem(guideKey(orgId, "metrics")) === "1");
    setHidden(localStorage.getItem(guideKey(orgId, "hidden")) === "1");
  }, [orgId]);

  const { data: searched = false } = useQuery({
    queryKey: ["guide-searched", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const [jobs, found] = await Promise.all([
        supabase.from("background_jobs").select("id", { count: "exact", head: true }).in("kind", SEARCH_JOB_KINDS),
        supabase.from("discoveries").select("id", { count: "exact", head: true }),
      ]);
      return (jobs.count ?? 0) + (found.count ?? 0) > 0;
    },
  });

  const steps = guideSteps({ onboardingStep: onboarding?.step, searched, metricsSeen });
  if (!orgId || !showGuide(steps, hidden)) return null;
  const cur = currentStep(steps);
  const doneCount = steps.filter((s) => s.done).length;

  function hide() {
    localStorage.setItem(guideKey(orgId!, "hidden"), "1");
    setHidden(true);
  }

  const action = (id: GuideStepId, primary: boolean) => {
    const variant = primary ? "default" : "ghost";
    switch (id) {
      case "onboarding": return <Button size="sm" variant={variant} asChild><Link to="/onboarding">{onboarding ? "Seguir" : "Empezar"}</Link></Button>;
      case "search": return <Button size="sm" variant={variant} asChild><Link to="/discoveries">Buscar</Link></Button>;
      case "metrics": return <Button size="sm" variant={variant} asChild><Link to="/metrics">Ver Métricas</Link></Button>;
    }
  };

  return (
    <section className="mb-8 rounded-xl border bg-card p-5 shadow-xs" aria-labelledby="guide-title">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="eyebrow">Primeros pasos · {doneCount} de {steps.length}</p>
          <h2 id="guide-title" className="mt-1 text-xl">{cur ? cur.title : "Todo listo"}</h2>
        </div>
        <button className="text-xs text-ink-mid hover:text-ink" onClick={hide}>Ocultar guía</button>
      </div>
      <div className="mt-3 h-2 max-w-md overflow-hidden rounded-full bg-paper-sunk">
        <div className="h-full rounded-full bg-lime transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>
      <ol className="mt-4 grid gap-2 md:grid-cols-2">
        {steps.map((s, i) => {
          const isCur = cur?.id === s.id;
          return (
            <li key={s.id} className={`flex min-w-0 items-start gap-3 rounded-lg border p-3 ${isCur ? "border-lime bg-lime-soft" : ""}`}>
              <span aria-hidden className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${s.done ? "bg-lime text-lime-foreground" : isCur ? "border-2 border-lime" : "border text-muted-foreground"}`}>
                {s.done ? "✓" : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${s.done ? "text-muted-foreground line-through" : ""}`}>
                  {s.title}<span className="sr-only">{s.done ? " (hecho)" : isCur ? " (paso actual)" : ""}</span>
                </p>
                {!s.done && <p className="mt-0.5 text-xs text-muted-foreground">{s.body}</p>}
                {!s.done && <div className="mt-2">{action(s.id, isCur)}</div>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
