import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useAgent } from "@/components/agent";
import { useOnboarding } from "@/hooks/use-onboarding";
import { useSetup } from "@/hooks/use-setup";
import { showRoadmapCard } from "@/lib/onboarding";
import { jsonObject } from "@/lib/json";

/** One compact strategy card in Inicio (Owner / Sales Leader) until the strategy is complete or hidden. */
export function RoadmapCard() {
  const { data: session, save } = useOnboarding();
  const { data: st } = useSetup();
  const { open: openAgent } = useAgent();
  const pct = st?.status.pct ?? 0;
  if (!st || !showRoadmapCard(session, pct)) return null;
  const diag = jsonObject(session?.diagnosis ?? null) as { result?: { archetype?: string; name?: string; nextStep?: string } } | null;
  const next = st.status.next;
  return (
    <section className="mb-8 rounded-xl border bg-card p-5 shadow-xs">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="eyebrow">Tu estrategia · {pct} %</p>
        <button className="text-xs text-ink-mid hover:text-ink" onClick={() => save({ completed_at: new Date().toISOString() })}>Ocultar</button>
      </div>
      <div className="mt-2 h-2 max-w-md overflow-hidden rounded-full bg-paper-sunk"><div className="h-full rounded-full bg-lime" style={{ width: `${pct}%` }} /></div>
      {diag?.result?.name && <p className="mt-3 text-sm text-ink-mid">Arquetipo {diag.result.archetype}, {diag.result.name}. Primero: {diag.result.nextStep?.toLowerCase()}.</p>}
      {next && <p className="mt-1 text-sm">Siguiente: <strong>{next.label}</strong> · desbloquea {next.unlocks.toLowerCase()}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild><Link to="/setup">Completar con IA</Link></Button>
        <Button variant="outline" onClick={() => openAgent({ mode: "interview", prompt: "Quiero completar la configuración de mi estrategia GTM. Empieza por lo más importante que falte." })}>Hazme las preguntas</Button>
        <Button variant="ghost" asChild><Link to="/onboarding">Seguir con el onboarding</Link></Button>
      </div>
    </section>
  );
}
