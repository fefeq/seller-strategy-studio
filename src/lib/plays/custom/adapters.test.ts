// @vitest-environment node
import { expect, it } from "vitest";
import { buildStepPayload } from "./step-output";
import { readFileSync } from "node:fs";
import type { Proposal } from "./propose";
const p: Proposal = {
  name: "Play de prueba",
  trigger: "Retirada publicada",
  window: { backDays: 60, forwardDays: 0 },
  steps: [{ n: 1, source: "news", question: "Retirada", returns: ["event_date"] }],
  message: {
    claims: [{ text: "Nunca copiar esta afirmación sin prueba", step: 1 }],
    built: "Comparación",
    ask: "¿Lo vemos?",
  },
  test: { n: 20, k: 2, base: 20 },
  verifiedOnly: false,
};
const signal = {
  title: "Aviso",
  url: "https://example.com/news",
  snippet: "Retirada publicada el 13 de noviembre de 2026",
  date: "2026-11-13",
  source: "web",
  provider: "firecrawl" as const,
};
it("CA-3 literal fresh evidence becomes a suggestion with a cited draft, never the unproved claim", () => {
  const r = buildStepPayload({
    playId: "synthetic",
    proposal: p,
    step: p.steps[0] as Proposal["steps"][number],
    signals: [signal],
    targets: [
      { accountId: "synthetic-account", personId: "synthetic-person", emailStatus: "verified" },
    ],
    previous: [],
    now: new Date("2026-11-13T12:00:00Z"),
    last: true,
  });
  expect(r.evidence).toHaveLength(1);
  expect(r.suggestions).toHaveLength(1);
  expect(r.suggestions[0]?.body).toContain("Propuesta de mensaje (no enviada)");
  expect(r.suggestions[0]?.body).not.toContain("Nunca copiar esta afirmación");
});
it("CA-3 old/no date/contact signals never become evidence", () => {
  for (const s of [
    { ...signal, date: null, snippet: "Sin fecha" },
    { ...signal, date: "2020-01-01" },
    { ...signal, snippet: "a@example.com" },
  ]) {
    const r = buildStepPayload({
      playId: "synthetic",
      proposal: p,
      step: p.steps[0] as Proposal["steps"][number],
      signals: [s],
      targets: [],
      previous: [],
      now: new Date("2026-11-13"),
      last: true,
    });
    expect(r.evidence).toHaveLength(0);
    expect(r.suggestions).toHaveLength(0);
  }
});
it("CA-3 catch-all cannot receive a draft and missing accounts are not invented", () => {
  const input = {
    playId: "synthetic",
    proposal: p,
    step: p.steps[0] as Proposal["steps"][number],
    signals: [signal],
    previous: [],
    now: new Date("2026-11-13"),
    last: true,
  };
  const r = buildStepPayload({
    ...input,
    targets: [
      { accountId: "synthetic-account", personId: "synthetic-person", emailStatus: "catch_all" },
    ],
  });
  expect(r.suggestions[0]?.body).not.toContain("Propuesta de mensaje (no enviada)");
  const empty = buildStepPayload({ ...input, targets: [] });
  expect(empty.suggestions[0]?.link).toBe("/inbox");
  expect(empty.suggestions[0]?.body).toContain("Contacto: sin dato");
});
it("CA-6 both maintenance paths call the same custom runner", () => {
  expect(readFileSync("src/lib/inngest/functions.server.ts", "utf8")).toContain(
    "runActiveCustomPlays",
  );
  expect(readFileSync("src/routes/api/public/jobs/proactive.ts", "utf8")).toContain(
    "runActiveCustomPlays",
  );
});
