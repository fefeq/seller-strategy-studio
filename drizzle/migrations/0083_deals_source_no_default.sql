-- SDD-20261109-deals-no-source U-1 (NK-0107). Verified only on PGlite (src/lib/deals-source-default.pg.test.ts); NOT applied to any real database.
-- A deal created without a source used to be stored as 'outbound' because of the column default (0001). Without the default it stays null,
-- which Métricas and the form read as «Sin origen». No rows are rewritten: an 'outbound' put by the default cannot be told from a chosen one.
-- Before applying (read only, Fede): select column_default from information_schema.columns where table_schema = 'public' and table_name = 'deals' and column_name = 'source';  -- expect 'outbound'::text
-- After applying: the same query returns null.
alter table public.deals alter column source drop default;
-- rollback: alter table public.deals alter column source set default 'outbound';
