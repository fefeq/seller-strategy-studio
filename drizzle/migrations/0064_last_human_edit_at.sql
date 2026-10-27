-- VERIFIED LOCALLY 2026-10-27 on an in-process Postgres (PGlite): src/lib/migrations.pg.test.ts runs every check below on a
-- replica of the real catalog (see src/test/pg-harness.ts). NOT yet applied to the real database: apply it on a copy first.
-- Why: the inactivity nudge of «Configura tu estrategia» (SDD strategy-setup-guided-next-step, CA-6) must count only what a person
-- changed. updated_at also moves with enrichments, syncs and triggers, and set_audit keeps the previous updated_by when no one is
-- signed in, so neither can tell them apart.
-- Checks (all pass in the test):
--   1. an insert or update by a signed-in person stamps last_human_edit_at with now();
--   2. an update with no signed-in person (service role: enrichments, syncs) leaves it as it was, while updated_at moves;
--   3. an insert with no signed-in person leaves it empty;
--   4. it exists on the seven tables the setup steps read: positioning, segments, quotas, accounts, deals, icp_profiles, messaging_pillars;
--   5. the column is not writable on purpose: a value sent by the client is overwritten by the trigger.
-- Known limit: work an app server function does with the person's own session (auth.uid() set) counts as theirs. Existing rows stay
-- empty (unknown) until someone edits them; the nudge treats unknown as no activity data and does not fire.
-- It changes no existing data: seven nullable columns and one trigger function with seven triggers.

CREATE OR REPLACE FUNCTION public.stamp_human_edit()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.last_human_edit_at := now();
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.last_human_edit_at := OLD.last_human_edit_at;
  ELSE
    NEW.last_human_edit_at := NULL;
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['positioning', 'segments', 'quotas', 'accounts', 'deals', 'icp_profiles', 'messaging_pillars'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS last_human_edit_at timestamptz', t);
    EXECUTE format('COMMENT ON COLUMN public.%I.last_human_edit_at IS %L', t, 'Last time a signed-in person inserted or changed this row; never moved by automated processes.');
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', t || '_stamp_human_edit', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.stamp_human_edit()', t || '_stamp_human_edit', t);
  END LOOP;
END $$;
