import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAgent } from "@/components/agent";
import { useOnboarding } from "@/hooks/use-onboarding";
import { useSetup } from "@/hooks/use-setup";
import { onboardingDone, showRoadmapCard } from "@/lib/onboarding";
import { jsonObject } from "@/lib/json";
import { useSetupGuide } from "@/hooks/use-setup-guide";
import { usePrimaryLine } from "@/hooks/use-business-lines";
import { GuideOffer, NextStepMessage } from "@/components/setup/guide";

/** One compact strategy card in Inicio (Owner / Sales Leader) until the strategy is complete or hidden. */
export function RoadmapCard() {
  const { data: session, save } = useOnboarding();
  const { data: st } = useSetup();
  const { open: openAgent } = useAgent();
  const g = useSetupGuide();
  const pct = st?.status.pct ?? 0;
  // The diagnosis is the company's: your own if you have one, else the latest a colleague made (company_diagnosis, migration 0065).
  const { data: shared } = useQuery({
    queryKey: ["company-diagnosis", g.orgId],
    enabled: !!g.orgId && !!st,
    queryFn: async () => (await supabase.rpc("company_diagnosis", { _org: g.orgId! })).data,
  });
  const { primary } = usePrimaryLine(g.orgId);
  if (!st || !showRoadmapCard(session, pct)) return null;
  // The primary business line wins; the per-person diagnosis is the fallback during the transition (SDD 3).
  const diag = primary ? { result: primary.result } : (jsonObject(shared ?? session?.diagnosis ?? null) as {
    result?: { archetype?: string; name?: string; nextStep?: string };
  } | null);
  return (
    <section className="mb-8 rounded-xl border bg-card p-5 shadow-xs">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="eyebrow">Tu estrategia · {pct} %</p>
        <button
          className="text-xs text-ink-mid hover:text-ink"
          onClick={() => save({ completed_at: new Date().toISOString() })}
        >
          Ocultar
        </button>
      </div>
      <div className="mt-2 h-2 max-w-md overflow-hidden rounded-full bg-paper-sunk">
        <div className="h-full rounded-full bg-lime" style={{ width: `${pct}%` }} />
      </div>
      {diag?.result?.name && (
        <p className="mt-3 text-sm text-ink-mid">
          Arquetipo {diag.result.archetype}, {diag.result.name}. Primero:{" "}
          {diag.result.nextStep?.toLowerCase()}.
        </p>
      )}
      {g.message && (
        <div className="mt-3">
          <NextStepMessage msg={g.message} />
        </div>
      )}
      {g.stale && (
        <p className="mt-2 text-xs text-ink-mid">
          No he podido actualizar tu progreso. Muestro el último estado conocido y lo reintento.
        </p>
      )}
      <div className="mt-3">
        <GuideOffer
          scope="home"
          onlyWhenDue
          orgId={g.orgId}
          wrap={(b) => (
            <div className="border-t border-hairline pt-3 text-sm">
              <p className="eyebrow mb-1">Llevas más de un día sin avanzar</p>
              {b}
            </div>
          )}
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild>
          <Link to="/setup">Completar con IA</Link>
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            openAgent({
              mode: "interview",
              prompt:
                "Quiero completar la configuración de mi estrategia GTM. Empieza por lo más importante que falte.",
            })
          }
        >
          Hazme las preguntas
        </Button>
        {!onboardingDone(session) && (
          <Button variant="ghost" asChild>
            <Link to="/onboarding">Seguir con el onboarding</Link>
          </Button>
        )}
      </div>
    </section>
  );
}
