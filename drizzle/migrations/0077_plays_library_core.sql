-- SDD-20261106 plays-library-core (U-4): per-company state of the Plays GTM and their step/drop log. New tables only: nothing existing is altered.
-- play_states: which plays a company has enabled (the catalogue itself lives in code, src/lib/plays/catalog.ts, so play_id has no CHECK against it).
--   Members read; only owner and sales_leader insert and update; no delete from the app.
-- play_runs: one row per step or drop, with ids only (never text, names or emails of leads, people or accounts). Members read; written only by the server.
-- Never applied to a real database from the implementation branch.
CREATE TABLE IF NOT EXISTS public.play_states (
  org_id uuid NOT NULL DEFAULT public.current_org() REFERENCES public.organizations(id) ON DELETE CASCADE,
  play_id text NOT NULL,
  enabled boolean NOT NULL,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, play_id)
);

-- Who and when come from the session, never from the client (two tabs: last write wins and says who).
CREATE OR REPLACE FUNCTION public.play_states_stamp() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  NEW.updated_by := coalesce(auth.uid(), NEW.updated_by);
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS play_states_stamp ON public.play_states;
CREATE TRIGGER play_states_stamp BEFORE INSERT OR UPDATE ON public.play_states FOR EACH ROW EXECUTE FUNCTION public.play_states_stamp();

REVOKE ALL ON public.play_states FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.play_states TO authenticated;
GRANT ALL ON public.play_states TO service_role;
ALTER TABLE public.play_states ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "members read" ON public.play_states;
CREATE POLICY "members read" ON public.play_states FOR SELECT TO authenticated
  USING (org_id = public.current_org() AND public.is_org_member(org_id));
DROP POLICY IF EXISTS "leaders insert" ON public.play_states;
CREATE POLICY "leaders insert" ON public.play_states FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org() AND (public.has_org_role(org_id, 'owner') OR public.has_org_role(org_id, 'sales_leader')));
DROP POLICY IF EXISTS "leaders update" ON public.play_states;
CREATE POLICY "leaders update" ON public.play_states FOR UPDATE TO authenticated
  USING (org_id = public.current_org() AND (public.has_org_role(org_id, 'owner') OR public.has_org_role(org_id, 'sales_leader')))
  WITH CHECK (org_id = public.current_org() AND (public.has_org_role(org_id, 'owner') OR public.has_org_role(org_id, 'sales_leader')));

CREATE TABLE IF NOT EXISTS public.play_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL DEFAULT public.current_org() REFERENCES public.organizations(id) ON DELETE CASCADE,
  play_id text NOT NULL,
  subject_table text NOT NULL,
  subject_id uuid NOT NULL,
  outcome text NOT NULL CONSTRAINT play_runs_outcome CHECK (outcome IN ('pass','drop')),
  gate_key text,
  drop_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT play_runs_drop_reason CHECK (outcome <> 'drop' OR (drop_reason IS NOT NULL AND length(btrim(drop_reason)) > 0))
);
CREATE INDEX IF NOT EXISTS play_runs_org_play_idx ON public.play_runs (org_id, play_id, created_at DESC);

REVOKE ALL ON public.play_runs FROM anon, authenticated;
GRANT SELECT ON public.play_runs TO authenticated;
GRANT ALL ON public.play_runs TO service_role;
ALTER TABLE public.play_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "members read" ON public.play_runs;
CREATE POLICY "members read" ON public.play_runs FOR SELECT TO authenticated
  USING (org_id = public.current_org() AND public.is_org_member(org_id));
