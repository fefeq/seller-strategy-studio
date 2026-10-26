-- NOT VERIFIED: written without a database to run it on (SDD strategy-setup-guided-next-step, U-2).
-- Dani: apply it first on a test environment and check, with two fictional companies, that
--   1. a member of company A can read and write A's snoozes (org_id fills from current_org());
--   2. a member of company A cannot read, update or delete company B's snoozes;
--   3. snoozed_by always equals the signed-in person, even if the client sends another one;
--   4. deleting a company deletes its snoozes.
-- It changes no existing data: one new table. Which roles may snooze which step is enforced in the app
-- (src/lib/setup-guide.ts, STEP_ROLES); the database only guarantees the company boundary and who wrote it.

CREATE TABLE IF NOT EXISTS public.setup_step_snoozes (
  org_id uuid NOT NULL DEFAULT public.current_org() REFERENCES public.organizations(id) ON DELETE CASCADE,
  step_id text NOT NULL,
  snoozed_until timestamptz NOT NULL,
  snoozed_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, step_id)
);
COMMENT ON TABLE public.setup_step_snoozes IS 'A setup step the company postponed: no reminders for it until snoozed_until. Done/pending is derived from data and never stored here.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.setup_step_snoozes TO authenticated;
GRANT ALL ON public.setup_step_snoozes TO service_role;
ALTER TABLE public.setup_step_snoozes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read their company snoozes" ON public.setup_step_snoozes FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));
CREATE POLICY "Members snooze in their company" ON public.setup_step_snoozes FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(org_id) AND snoozed_by = auth.uid());
CREATE POLICY "Members change snoozes in their company" ON public.setup_step_snoozes FOR UPDATE TO authenticated
  USING (public.is_org_member(org_id))
  WITH CHECK (public.is_org_member(org_id) AND snoozed_by = auth.uid());
CREATE POLICY "Members clear snoozes in their company" ON public.setup_step_snoozes FOR DELETE TO authenticated
  USING (public.is_org_member(org_id));
