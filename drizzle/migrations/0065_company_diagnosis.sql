-- VERIFIED LOCALLY 2026-10-27 on an in-process Postgres (PGlite): src/lib/migrations.pg.test.ts runs every check below.
-- NOT yet applied to the real database: apply it on a copy first.
-- Why: the GTM diagnosis lives in onboarding_sessions.diagnosis, and that table's policy («Own onboarding in my company», 0052) lets a
-- person read only their own row, so the rest of the company never sees it (SDD strategy-setup-guided-next-step, section 6).
-- Sharing the whole row would also share the proposal, findings and opinions, so the policy is not widened: this function returns
-- only the diagnosis.
-- Checks (all pass in the test):
--   1. a member of the company gets the diagnosis of a colleague when they have none of their own;
--   2. their own diagnosis wins over a colleague's, and among colleagues the most recently updated wins;
--   3. a person outside the company gets nothing, and neither does anon;
--   4. the table's policy is unchanged: a member still cannot read a colleague's row (proposal, findings) directly.
-- It changes no existing data: one function.

CREATE OR REPLACE FUNCTION public.company_diagnosis(_org uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT s.diagnosis
  FROM public.onboarding_sessions s
  WHERE s.org_id = _org AND s.diagnosis IS NOT NULL AND public.is_org_member(_org)
  ORDER BY (s.user_id = auth.uid()) DESC, s.updated_at DESC
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.company_diagnosis(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.company_diagnosis(uuid) TO authenticated;
