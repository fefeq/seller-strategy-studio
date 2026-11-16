import { createFileRoute } from "@tanstack/react-router";
import { Page } from "@/components/page";
import { OnboardingViews } from "@/components/onboarding/views";
import { SetupCompletion } from "@/components/setup/completion";

const T = "Completa tu estrategia — Nokko";
const D = "Completa tu estrategia GTM con IA, una entrevista o paso a paso.";

// B1: the former Configuración (/setup redirects here), inside Onboarding.
export const Route = createFileRoute("/_authenticated/onboarding_/completar")({
  head: () => ({
    meta: [
      { title: T },
      { name: "description", content: D },
      { property: "og:title", content: T },
      { property: "og:description", content: D },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <Page eyebrow="Onboarding" title="Completa tu estrategia">
      <OnboardingViews completar />
      <SetupCompletion />
    </Page>
  ),
});
