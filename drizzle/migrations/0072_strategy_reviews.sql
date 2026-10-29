-- SDD-20261027 strategic-suggestions-engine, F4 (H-6): stored AI strategic reviews. New table only: nothing existing is altered.
-- One row per review (append-only): the input fingerprint lets the next request reuse it without a new AI call (CA-44), and
-- the suggestions of the last review stay visible when the budget runs out or the AI fails (CA-45, CA-46).
-- Never applied to a real database from the implementation branch.
CREATE TABLE IF NOT EXISTS public.strategy_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL DEFAULT public.current_org() REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  mode text NOT NULL CONSTRAINT strategy_reviews_mode CHECK (mode IN ('normal','critical')),
  depth text NOT NULL CONSTRAINT strategy_reviews_depth CHECK (depth IN ('low','medium')),
  input_fingerprint text NOT NULL CONSTRAINT strategy_reviews_fp CHECK (length(input_fingerprint) = 8),
  suggestions jsonb NOT NULL DEFAULT '[]'::jsonb CONSTRAINT strategy_reviews_max7 CHECK (jsonb_typeof(suggestions) = 'array' AND jsonb_array_length(suggestions) <= 7),
  cost numeric NOT NULL DEFAULT 0 CONSTRAINT strategy_reviews_cost CHECK (cost >= 0)
);
CREATE INDEX IF NOT EXISTS strategy_reviews_org_idx ON public.strategy_reviews (org_id, created_at DESC);

REVOKE ALL ON public.strategy_reviews FROM anon, authenticated;
GRANT SELECT, INSERT ON public.strategy_reviews TO authenticated;
GRANT ALL ON public.strategy_reviews TO service_role;
ALTER TABLE public.strategy_reviews ENABLE ROW LEVEL SECURITY;
-- Only the roles allowed to ask for a review (CA-40) read or write them; no updates or deletes for the app.
DROP POLICY IF EXISTS "leaders read" ON public.strategy_reviews;
CREATE POLICY "leaders read" ON public.strategy_reviews FOR SELECT TO authenticated
  USING (org_id = public.current_org() AND (public.has_org_role(org_id, 'owner') OR public.has_org_role(org_id, 'sales_leader')));
DROP POLICY IF EXISTS "leaders insert" ON public.strategy_reviews;
CREATE POLICY "leaders insert" ON public.strategy_reviews FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org() AND created_by = auth.uid() AND (public.has_org_role(org_id, 'owner') OR public.has_org_role(org_id, 'sales_leader')));
