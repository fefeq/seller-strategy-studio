import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/hooks/use-onboarding";
import { useSetup } from "@/hooks/use-setup";
import { showRoadmapCard } from "@/lib/onboarding";
import { jsonObject } from "@/lib/json";

/** «Tu roadmap» in Inicio until the strategy is complete or the person hides it. */
export function RoadmapCard() {
  const { data: session, save } = useOnboarding();
  const { data: st } = useSetup();
  const pct = st?.status.pct ?? 0;
  if (!showRoadmapCard(session, pct)) return null;
  const diag = jsonObject(session?.diagnosis ?? null) as { result?: { archetype?: string; name?: string; nextStep?: string } } | null;
  const missing = st?.status.missing.slice(0, 3) ?? [];
  return (
    <section className="my-8 border-t-2 border-hairline-firm pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="smallcaps">Tu roadmap · estrategia al {pct} %</p>
        <button className="text-xs text-ink-mid underline underline-offset-2" onClick={() => save({ completed_at: new Date().toISOString() })}>Ocultar</button>
      </div>
      {diag?.result?.name && <p className="mt-1 text-lg">Arquetipo {diag.result.archetype}, {diag.result.name}. Primero: {diag.result.nextStep?.toLowerCase()}.</p>}
      {missing.length > 0 && <ul className="mt-2 space-y-1 text-sm">{missing.map((i) => <li key={i.id}>Falta: {i.label}</li>)}</ul>}
      <Button asChild size="sm" variant="outline" className="mt-3"><Link to="/onboarding">Seguir con el onboarding</Link></Button>
    </section>
  );
}
