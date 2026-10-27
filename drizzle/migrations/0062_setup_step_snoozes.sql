-- VERIFIED LOCALLY 2026-10-27 on an in-process Postgres (PGlite) with two fictional companies: src/lib/migrations.pg.test.ts runs
-- every check below on a replica of the real catalog (see src/test/pg-harness.ts for what it does and does not model).
-- NOT yet applied to the real database: apply it on a copy first, since the replica is not the database itself.
-- Checks (all pass in the test):
--   1. a member of company A can read and write A's snoozes (org_id fills from current_org());
--   2. a member of company A cannot read, update or delete company B's snoozes;
--   3. snoozed_by always equals the signed-in person, even if the client sends another one;
--   4. deleting a company deletes its snoozes;
--   5. only a role that can complete the step may snooze or clear it (public.can_complete_setup_step, which mirrors STEP_ROLES in
--      src/lib/setup-guide.ts; the test runs the function for every step and role against STEP_ROLES so the two cannot drift);
--   6. anon gets nothing and authenticated only SELECT, INSERT, UPDATE and DELETE (Supabase grants everything to new tables).
-- It changes no existing data: one new table and one function. It can be run again: the policies are dropped and recreated.

CREATE TABLE IF NOT EXISTS public.setup_step_snoozes (
  org_id uuid NOT NULL DEFAULT public.current_org() REFERENCES public.organizations(id) ON DELETE CASCADE,
  step_id text NOT NULL,
  snoozed_until timestamptz NOT NULL,
  snoozed_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, step_id)
);
COMMENT ON TABLE public.setup_step_snoozes IS 'A setup step the company postponed: no reminders for it until snoozed_until. Done/pending is derived from data and never stored here.';

ALTER TABLE public.setup_step_snoozes ENABLE ROW LEVEL SECURITY;
-- Supabase grants every privilege on a new public table to anon and authenticated; RLS blocks their writes but TRUNCATE skips RLS.
REVOKE ALL ON public.setup_step_snoozes FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.setup_step_snoozes TO authenticated;
GRANT ALL ON public.setup_step_snoozes TO service_role;

-- Who may postpone or clear a step: the roles that can complete it (STEP_ROLES in src/lib/setup-guide.ts, which the app also uses to
-- pick the next step). Security definer so the policies can read org_members; a step id it does not know is refused.
CREATE OR REPLACE FUNCTION public.can_complete_setup_step(_org uuid, _step text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members m
    WHERE m.org_id = _org AND m.user_id = auth.uid()
      AND CASE
        WHEN _step IN ('positioning', 'icp', 'pillars') THEN m.role::text IN ('owner', 'sales_leader', 'marketing')
        WHEN _step IN ('segments', 'benchmarks', 'quota') THEN m.role::text IN ('owner', 'sales_leader')
        WHEN _step IN ('accounts', 'deals') THEN true
        ELSE false
      END
  )
$$;
REVOKE ALL ON FUNCTION public.can_complete_setup_step(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_complete_setup_step(uuid, text) TO authenticated;

DROP POLICY IF EXISTS "Members read their company snoozes" ON public.setup_step_snoozes;
CREATE POLICY "Members read their company snoozes" ON public.setup_step_snoozes FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS "Members snooze in their company" ON public.setup_step_snoozes;
CREATE POLICY "Members snooze in their company" ON public.setup_step_snoozes FOR INSERT TO authenticated
  WITH CHECK (public.can_complete_setup_step(org_id, step_id) AND snoozed_by = auth.uid());
DROP POLICY IF EXISTS "Members change snoozes in their company" ON public.setup_step_snoozes;
CREATE POLICY "Members change snoozes in their company" ON public.setup_step_snoozes FOR UPDATE TO authenticated
  USING (public.can_complete_setup_step(org_id, step_id))
  WITH CHECK (public.can_complete_setup_step(org_id, step_id) AND snoozed_by = auth.uid());
DROP POLICY IF EXISTS "Members clear snoozes in their company" ON public.setup_step_snoozes;
CREATE POLICY "Members clear snoozes in their company" ON public.setup_step_snoozes FOR DELETE TO authenticated
  USING (public.can_complete_setup_step(org_id, step_id));
