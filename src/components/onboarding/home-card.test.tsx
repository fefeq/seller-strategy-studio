// NK-0151: the «Tu estrategia» card in Inicio offers «Seguir con el onboarding» only while the onboarding is not done.
// The real card with fictitious data; hooks, the router link, Supabase and the guide pieces are replaced.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ step: null as string | null }));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: null }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));
vi.mock("@/components/agent", () => ({ useAgent: () => ({ open: vi.fn() }) }));
vi.mock("@/hooks/use-onboarding", () => ({
  useOnboarding: () => ({
    data: { step: state.step, completed_at: null, diagnosis: null },
    save: vi.fn(),
  }),
}));
vi.mock("@/hooks/use-setup", () => ({ useSetup: () => ({ data: { status: { pct: 40 } } }) }));
vi.mock("@/hooks/use-setup-guide", () => ({
  useSetupGuide: () => ({ orgId: "org-ficticia", message: null, stale: false }),
}));
vi.mock("@/components/setup/guide", () => ({
  GuideOffer: () => null,
  NextStepMessage: () => null,
}));

import { RoadmapCard } from "./home-card";

afterEach(cleanup);

describe("RoadmapCard: «Seguir con el onboarding» (NK-0151)", () => {
  it("CA-1: with the onboarding done it does not offer to continue it, and still offers the strategy actions", () => {
    state.step = "roadmap";
    render(<RoadmapCard />);
    expect(screen.queryByText("Seguir con el onboarding")).toBeNull();
    expect(screen.getByText("Completar con IA")).toBeTruthy();
    expect(screen.getByText("Hazme las preguntas")).toBeTruthy();
  });

  it.each(["depth", "sources", "reading", "diagnosis", "blocks", null])(
    "CA-2: with the onboarding not done (step %s) the card is as before",
    (step) => {
      state.step = step;
      render(<RoadmapCard />);
      const link = screen.getByText("Seguir con el onboarding");
      expect(link.closest("a")?.getAttribute("href")).toBe("/onboarding");
      expect(screen.getByText("Completar con IA")).toBeTruthy();
    },
  );
});

describe("RoadmapCard source guard (CA-3)", () => {
  const src = readFileSync(join(process.cwd(), "src/components/onboarding/home-card.tsx"), "utf8");
  it("uses onboardingDone from the single definition", () => {
    expect(src).toMatch(/import\s*\{[^}]*\bonboardingDone\b[^}]*\}\s*from\s*"@\/lib\/onboarding"/);
    expect(src).toMatch(/onboardingDone\(/);
  });
  it("does not copy the rule", () => {
    expect(src).not.toMatch(/["']roadmap["']/);
    expect(src).not.toMatch(/\.step\s*[!=]==?/);
  });
});
