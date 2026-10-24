import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { useMe } from "@/hooks/use-me";
import { errorText } from "@/lib/errors";
import { jsonObject } from "@/lib/json";
import { AiFill } from "@/components/setup/ai-fill";
import { DepthStep, DiagnosisStep, RoadmapStep, type Depth } from "@/components/onboarding/steps";
import type { SetupProposal } from "@/lib/setup-extraction";
import type { Diagnosis, DiagnosisInput } from "@/lib/gtm-diagnosis";

const STEPS = [["depth", "Profundidad"], ["sources", "Tus fuentes y propuesta"], ["diagnosis", "Diagnóstico"], ["roadmap", "Tu roadmap"]] as const;
type Step = (typeof STEPS)[number][0];

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Crea tu estrategia GTM — Nokko" }, { name: "description", content: "De tu web y tus documentos a una estrategia GTM aprobada, a tu ritmo." }, { property: "og:title", content: "Crea tu estrategia GTM — Nokko" }, { property: "og:description", content: "De tu web y tus documentos a una estrategia GTM aprobada, a tu ritmo." }] }),
  component: Onboarding,
});

function Onboarding() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const orgId = me?.currentOrg?.org_id;
  const { data: session } = useQuery({
    queryKey: ["onboarding", orgId],
    enabled: !!orgId,
    queryFn: async () => (await supabase.from("onboarding_sessions").select("*").eq("org_id", orgId!).eq("user_id", me!.user.id).maybeSingle()).data,
  });
  const [proposal, setProposal] = useState<SetupProposal | null>(null);
  const step = ((session?.step as Step) ?? "depth");
  const diag = jsonObject(session?.diagnosis ?? null) as unknown as { input: DiagnosisInput; result: Diagnosis } | null;

  async function save(patch: { step?: Step; depth?: Depth; diagnosis?: Json; completed_at?: string }) {
    const { error } = await supabase.from("onboarding_sessions").upsert({ org_id: orgId!, user_id: me!.user.id, ...session && { depth: session.depth }, ...patch, updated_at: new Date().toISOString() }, { onConflict: "org_id,user_id" });
    if (error) return toast.error(errorText(error));
    qc.invalidateQueries({ queryKey: ["onboarding", orgId] });
  }

  const firstAcv = proposal?.segments?.find((s) => s.acv_min != null)?.acv_min ?? 0;
  return (
    <Page eyebrow="Onboarding" title="Tu estrategia GTM, a tu ritmo">
      <ol className="mb-8 flex flex-wrap gap-x-6 gap-y-2 border-b border-hairline pb-3 text-sm">
        {STEPS.map(([id, l], n) => (
          <li key={id}><button onClick={() => save({ step: id })} className={id === step ? "font-semibold text-ink underline underline-offset-4" : "text-ink-mid"}>{n + 1}. {l}</button></li>
        ))}
      </ol>
      {step === "depth" && <DepthStep value={(session?.depth as Depth) ?? null} onPick={(depth) => save({ depth, step: "sources" })} />}
      {step === "sources" && (
        <div className="space-y-4">
          <p className="text-sm text-ink-mid">Dale todo lo que tengas: web, business plan, P&L, decks, battlecards o documentos de Drive. Revisas y apruebas cada bloque antes de guardar nada.</p>
          <AiFill proposal={proposal} setProposal={setProposal} onWizard={() => save({ step: "diagnosis" })} />
          <Button variant="outline" onClick={() => save({ step: "diagnosis" })}>Seguir al diagnóstico</Button>
        </div>
      )}
      {step === "diagnosis" && (
        <DiagnosisStep
          initial={diag?.input ?? { model: "b2b", acv: Number(firstAcv) || 0, friction: "self_serve", stage: "early" }}
          onDone={(input, result) => save({ step: "roadmap", diagnosis: { input, result } as unknown as Json })}
        />
      )}
      {step === "roadmap" && <RoadmapStep diagnosis={diag?.result ?? null} />}
    </Page>
  );
}
