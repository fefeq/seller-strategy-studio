# NK-0107 result (SDD-20261109-deals-no-source, units U-1..U-4)

Base 577ee72cb4f35555db9b5530215ccee70c55e3b6, branch feat/nk-0107-deals-no-source.

## Fail first (node scripts/factory/fail-first.mjs, all five "fail-first proven"; per-test read on a base worktree)
| Test file | On base | Per test |
|---|---|---|
| src/lib/deals-source-default.pg.test.ts (CA-1, CA-2) | fails | control test passes (insert leaves outbound, as designed); the 3 tests after the migration fail (file 0083 missing) |
| src/lib/deal-source.test.ts (CA-3 + guard) | fails | whole file: module does not exist |
| src/components/deal-source-field.test.tsx (CA-4a) | fails | whole file: component does not exist |
| src/lib/advisor.test.ts (CA-5) | fails | whole file: imports AI_NO_SOURCE (does not exist). The assertion itself was not seen failing on its own on base |
| src/lib/revops.test.ts (CA-6) | fails | the source guard test fails; the null-source grouping test PASSES on base (regression guard, as the SDD says "sin regresión") |

## Mutations (each turned the test red, then restored)
- remove `drop default` in 0083 -> deals-source-default.pg: 2 failed
- field sends "" instead of null -> deal-source-field: 1 failed
- advisor back to "—" -> advisor.test: 1 failed
- revops.ts back to the "—" literal -> revops.test: 1 failed

## Checks
- tsc --noEmit: 0
- vitest full: 252 files, 4569 tests (base 249 / 4545). One full run had 1 failure in money-notices.pg.test.ts (unrelated; passes alone 17/17 and passed in the previous full run): looks like load flakiness, not investigated.
- eslint on touched files: 0 on all except src/lib/revops.ts and src/lib/revops.test.ts, which already had 31 prettier errors on the base (brief says 0; not reformatted to keep the diff to the SDD). My added lines there are prettier-clean.
- Journal: entry idx 81 with when 1794398400000 for 0083 (the base has no 0082, so the position is 81); migrations-journal.test.ts passes. The reviewer re-seals if 0082 (NK-0070) lands first.

## NOT claimed
- CA-4b (what "Guardar" sends in deals.tsx) is not tested: it is the walkthrough. Not run in a browser; what Pick paints, mobile/dark not checked.
- Migration 0083 only run on PGlite with a reduced deals table; not applied to a real database; the live default is not checked; 0012 trigger not replicated.
- Existing 'outbound' rows are not corrected and their count is unknown (D-1).
- Free-text sources are not normalized; field-catalog.ts untouched; "Nuevo deal", account tab and create_deal still send no source (they now save null).
- docs/BASE-DE-DATOS.md / 0080 check for outside writers that rely on the default was not done.
- No push, merge or deploy.
