import { createFileRoute } from "@tanstack/react-router";
import { Page } from "@/components/page";
import { useMe } from "@/hooks/use-me";
import { useOnboarding, asJson } from "@/hooks/use-onboarding";
import { jsonObject } from "@/lib/json";
import { DepthStep, DiagnosisStep, RoadmapStep } from "@/components/onboarding/steps";
import { SourcesStep } from "@/components/onboarding/sources";
import { ReadingStep } from "@/components/onboarding/reading";
import { BlocksStep } from "@/components/onboarding/blocks";
import { GuestOnboarding } from "@/components/onboarding/guest";
import type { SetupProposal } from "@/lib/setup-extraction";
import type { Diagnosis, DiagnosisInput } from "@/lib/gtm-diagnosis";
import type { BlockId, BlockState, Depth, Finding, Opinion } from "@/lib/onboarding";

const STEPS = [["depth", "Profundidad"], ["sources", "Tus fuentes"], ["reading", "Nokko lee"], ["diagnosis", "Diagnóstico"], ["blocks", "Aprobar"], ["roadmap", "Tu roadmap"]] as const;
type Step = (typeof STEPS)[number][0];

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Crea tu estrategia GTM — Nokko" }, { name: "description", content: "De tu web y tus documentos a una estrategia GTM aprobada, a tu ritmo." }, { property: "og:title", content: "Crea tu estrategia GTM — Nokko" }, { property: "og:description", content: "De tu web y tus documentos a una estrategia GTM aprobada, a tu ritmo." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Onboarding,
});

function Onboarding() {
  const { data: me } = useMe();
  const leader = !!me?.roles.some((r) => r === "owner" || r === "sales_leader");
  const pre = useOnboarding();
  const step = ((pre.data?.step as Step) ?? "depth");
  const { data: session, save } = useOnboarding({ poll: step === "reading" });

  if (me && !leader) return (
    <Page eyebrow="Bienvenida" title="Lo esencial para empezar">
      <GuestOnboarding onDone={() => save({ step: "roadmap", completed_at: new Date().toISOString() })} />
    </Page>
  );

  const diag = jsonObject(session?.diagnosis ?? null) as unknown as { input: DiagnosisInput; result: Diagnosis } | null;
  const proposal = (session?.proposal ?? null) as unknown as SetupProposal | null;
  const findings = (Array.isArray(session?.findings) ? session.findings : []) as unknown as Finding[];
  const opinions = (Array.isArray(session?.opinions) ? session.opinions : []) as unknown as Opinion[];
  const sources = (Array.isArray(session?.sources) ? session.sources : []) as unknown as string[];
  const blockStatus = (jsonObject(session?.block_status ?? null) ?? {}) as unknown as Partial<Record<BlockId, BlockState>>;
  const depth = ((session?.depth as Depth) ?? "express");

  const seg = proposal?.segments?.find((s) => s.acv_min != null);
  const initialDiag: DiagnosisInput = diag?.input ?? {
    model: "b2b",
    acv: Number(seg?.acv_min ?? 0) || 0,
    friction: seg && ["field", "strategic"].includes(seg.motion) ? "committee" : "self_serve",
    stage: "early",
  };
  const reachable = (id: Step) => id === "depth" || id === "sources" || (id === "reading" && !!session?.read_job_id) || ((id === "diagnosis" || id === "blocks") && !!proposal) || (id === "roadmap" && !!diag);

  return (
    <Page eyebrow="Onboarding" title="Tu estrategia GTM, a tu ritmo">
      <ol className="mb-8 flex flex-wrap gap-x-6 gap-y-2 border-b border-hairline pb-3 text-sm">
        {STEPS.map(([id, l], n) => (
          <li key={id}>
            <button disabled={!reachable(id)} onClick={() => save({ step: id })} className={id === step ? "font-semibold text-ink underline underline-offset-4" : reachable(id) ? "text-ink-mid" : "text-ink-faint"}>{n + 1}. {l}</button>
          </li>
        ))}
      </ol>
      {step === "depth" && <DepthStep value={(session?.depth as Depth) ?? null} onPick={(d) => save({ depth: d, step: "sources" })} />}
      {step === "sources" && (
        <SourcesStep depth={depth} onStarted={(jobId, src) => save({ step: "reading", read_job_id: jobId, sources: asJson(src) })} />
      )}
      {step === "reading" && <ReadingStep jobId={session?.read_job_id ?? null} findings={findings} sources={sources} onNext={() => save({ step: "diagnosis" })} onBack={() => save({ step: "sources" })} />}
      {step === "diagnosis" && (
        <DiagnosisStep initial={initialDiag} onDone={(input, result) => save({ step: proposal ? "blocks" : "roadmap", diagnosis: asJson({ input, result }) })} />
      )}
      {step === "blocks" && proposal && (
        <BlocksStep proposal={proposal} opinions={opinions} archetype={diag?.result.archetype ?? null} status={blockStatus}
          onStatus={(s) => save({ block_status: asJson(s) })} onDone={() => save({ step: "roadmap" })} />
      )}
      {step === "roadmap" && <RoadmapStep diagnosis={diag?.result ?? null} />}
    </Page>
  );
}
