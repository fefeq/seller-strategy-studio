-- VERIFIED LOCALLY 2026-10-27 on in-process Postgres (PGlite) after 0064: src/lib/migrations.pg.test.ts. NOT applied to any real database.
-- Depends on 0064. Found by the independent audit: the inactivity nudge asks each of the seven setup tables for
-- «ORDER BY last_human_edit_at DESC LIMIT 1» per company, and the proactive job runs it for every company on every pass, with no index.
-- A partial index on (org_id, last_human_edit_at DESC) turns each of those into one index lookup; rows nobody has edited (the existing
-- ones until someone does) are not indexed, so it starts empty and costs nothing. Chosen over a single combined query because the
-- combined query would still scan without the index, and the index makes the seven small queries cheap.
-- CREATE INDEX takes a short write lock per table (the migration runs in a transaction, so CONCURRENTLY is not possible); these tables
-- are small per company.
-- Checks (all pass in the test): the seven indexes exist and are partial; the planner uses them for the activity query.

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['positioning', 'segments', 'quotas', 'accounts', 'deals', 'icp_profiles', 'messaging_pillars'] LOOP
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (org_id, last_human_edit_at DESC) WHERE last_human_edit_at IS NOT NULL', t || '_org_human_edit_idx', t);
  END LOOP;
END $$;
