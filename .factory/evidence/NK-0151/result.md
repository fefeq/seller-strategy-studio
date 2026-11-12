# NK-0151 · result

Base 7fe9aedec2f1ae6253c7c9b91d70270e4a24fc4d. Branch feat/nk-0151-home-onboarding-card.

## Change
`src/components/onboarding/home-card.tsx`: the ghost button «Seguir con el onboarding» renders only when `!onboardingDone(session)` (import from `@/lib/onboarding`). With the onboarding done the card keeps the existing «Completar con IA» (/setup) and «Hazme las preguntas». No new text.

## Test
`src/components/onboarding/home-card.test.tsx` (real card, hooks mocked, fictitious data): CA-1, CA-2 (6 steps: depth, sources, reading, diagnosis, blocks, null), CA-3 source guard (2 tests).

## Fail first
`node scripts/factory/fail-first.mjs --base 7fe9aede... --file src/components/onboarding/home-card.test.tsx` -> OK, fails on base. Reviewed per test on base (9 tests): FAIL = CA-1; FAIL = guard «uses onboardingDone». PASS on base (by nature): the 6 CA-2 cases (regression: behaviour unchanged) and guard «does not copy the rule» (negative guard). Their value is shown by the mutations.

## Mutations (on the fix, each restored)
- M1 inline `session?.step === "roadmap"`: both guards fail.
- M2 button always shown: CA-1 and guard fail.
- M3 button never shown: 6 CA-2 cases and guard fail.
- M4 condition inverted: CA-1 and 6 CA-2 cases fail.

## Checks
eslint 0 and prettier clean on both touched files (format in its own commit); tsc 0; full vitest: see final message.

## NOT claimed
- No visual or browser check of Inicio; the card is tested with mocked hooks.
- «Siguiente acción útil» is the actions already on the card; no new link to Estrategia or the guide step was added.
- The source guard is a regex on the file text, not an AST check.
- The `completed_at` («Ocultar») logic and `showRoadmapCard` are unchanged.
- Not pushed, merged or deployed.
