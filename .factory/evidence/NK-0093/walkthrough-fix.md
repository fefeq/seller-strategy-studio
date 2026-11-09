# NK-0093 walkthrough fix: /leads blank while loading, double fetch

Branch fix/nk-0093-leads-pending, base 4e6c645.

## Cause
1. The route loader awaits the leads query and the route had no pendingComponent, so nothing painted until it finished.
2. The default QueryClient staleTime is 0, so the screen refetched on mount the data the loader had just fetched (requests at 0.9 s and 9.1 s).

## Fix
- `src/components/leads/leads-pending.tsx` (new): Page + ScreenState skeleton "cards"; set as `pendingComponent` with `pendingMs: 0` in `leads.index.tsx`.
- `leadsQuery` in `src/hooks/use-leads.ts`: `staleTime: 30_000`, shared by loader and component. Invalidation of the "leads" key still refreshes live.
- Error path untouched: the query still throws, `settle` in the loader still lets the screen show ScreenState error + Reintentar.

## Evidence
- Test: `src/hooks/leads-loading.test.tsx` (3 tests: one fetch after loader + mount; pending renders the skeleton; route wiring guard).
- Fail-first: `node scripts/factory/fail-first.mjs --base 4e6c645 --file src/hooks/leads-loading.test.tsx` -> OK (fails on base).
- Mutation: staleTime 30_000 -> 0 makes "does not refetch on mount" fail (2 others pass); reverted.
- tsc 0; full vitest green; eslint 0 errors on touched files.

## NOT claimed
- No real browser or network timing measured; the 0.9 s / 9.1 s figures were not re-measured.
- The wiring test is a source guard, not a router render of the pending phase.
- staleTime 30 s means data changed elsewhere (other user, no invalidation) can be up to 30 s old on re-entry; mutations here invalidate.
- Other screens (home, accounts, pipeline, deals) have the same default staleTime 0 and were not changed.
- Leads error rendering has no new test here (covered by earlier NK-0093 work).

## Ronda 2 (base dfc0ba9): /leads blank on direct open or reload

### Cause
`/_authenticated` is `ssr: false` and had no pendingComponent: until its `beforeLoad` session check answered, nothing painted, and the child's `LeadsPending` (round 1) could not render yet. Reproduced with the real router: body was an empty `<div />`.

### Fix (smallest)
- `src/components/app-pending.tsx` (new): ScreenState skeleton in a padded container (role=status, "Cargando…").
- `src/routes/_authenticated/route.tsx`: `pendingComponent: AppPending`, `pendingMs: 0`. Only these lines; session check, use-me and `__root` untouched. Loaders of home/accounts/pipeline unchanged.

### Evidence
- Test `src/test/leads-first-load.test.tsx`: real `routeTree`, `createMemoryHistory` at `/leads`, supabase mocked with a session check (`getUser`) that never answers and a leads request that never answers; asserts `role=status` and "Cargando" in the DOM (findByRole, default timeout).
- Fail-first: `node scripts/factory/fail-first.mjs --base dfc0ba9 --file src/test/leads-first-load.test.tsx` -> OK; failure is the empty body (`<div />`), not a setup error.
- Mutation: `pendingMs: 0` -> `60000` makes the test fail; reverted.
- tsc, full vitest, eslint on touched files: see final run in the report.

### NOT claimed
- Not run in a real browser or against the SSR/Vercel build: jsdom client render only. The reported empty SSR HTML (Suspense markers) is assumed to be fixed because a server render of an `ssr:false` route uses its pendingComponent; not verified on a deployment.
- The test simulates the slow first load with a session check that never answers, not an actual page reload or hydration.
- The skeleton is generic (no sidebar shell); the app shell itself still appears only after the session check.
- Possible flash of the skeleton on other screens while the guard runs was not measured; full vitest is green.
