-- SDD-20261027 strategic-suggestions-engine, F3 (H-5): turning an accepted suggestion into a pending change, a task or an experiment.
-- New tables only: nothing existing is altered. Never applied to a real database from the implementation branch.

-- 1. Pending strategy changes: a proposal that does not touch the current value until a person confirms it (CA-32, CA-33).
CREATE TABLE IF NOT EXISTS public.strategy_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL DEFAULT public.current_org() REFERENCES public.organizations(id) ON DELETE CASCADE,
  suggestion_id uuid NOT NULL UNIQUE REFERENCES public.suggestions(id) ON DELETE CASCADE,
  element text NOT NULL CONSTRAINT strategy_changes_element CHECK (element IN ('icp','segment','positioning','competitor','product_price')),
  op text NOT NULL CONSTRAINT strategy_changes_op CHECK (op IN ('create','update','manual')),
  target_table text CONSTRAINT strategy_changes_table CHECK (target_table IS NULL OR target_table IN ('icp_profiles','segments','positioning','products')),
  target_id uuid,
  "values" jsonb NOT NULL DEFAULT '{}'::jsonb,
  base jsonb NOT NULL DEFAULT '{}'::jsonb,
  previous jsonb,
  status text NOT NULL DEFAULT 'pending' CONSTRAINT strategy_changes_status CHECK (status IN ('pending','applied','undone','rejected','done_by_hand')),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_by uuid,
  decided_at timestamptz,
  applied_at timestamptz,
  undo_until timestamptz,
  CONSTRAINT strategy_changes_shape CHECK (
    (op = 'manual' AND target_table IS NULL) OR (op = 'create' AND target_table IS NOT NULL) OR (op = 'update' AND target_table IS NOT NULL AND target_id IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS strategy_changes_org_idx ON public.strategy_changes (org_id, status, created_at DESC);

-- 2. Link from a suggestion to what it originated: a change, a task or an experiment (CA-37).
CREATE TABLE IF NOT EXISTS public.strategy_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL DEFAULT public.current_org() REFERENCES public.organizations(id) ON DELETE CASCADE,
  suggestion_id uuid NOT NULL REFERENCES public.suggestions(id) ON DELETE CASCADE,
  kind text NOT NULL CONSTRAINT strategy_links_kind CHECK (kind IN ('change','task','experiment')),
  ref_id uuid NOT NULL,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, ref_id)
);
CREATE INDEX IF NOT EXISTS strategy_links_suggestion_idx ON public.strategy_links (suggestion_id);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['strategy_changes','strategy_links'] LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "org read" ON public.%I', t);
    EXECUTE format('CREATE POLICY "org read" ON public.%I FOR SELECT TO authenticated USING (org_id = public.current_org() AND public.is_org_member(org_id))', t);
    EXECUTE format('DROP POLICY IF EXISTS "org insert" ON public.%I', t);
    EXECUTE format('CREATE POLICY "org insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_org_member(org_id) AND EXISTS (SELECT 1 FROM public.suggestions s WHERE s.id = suggestion_id AND s.org_id = %I.org_id))', t, t);
  END LOOP;
END $$;
-- Only the roles that can change strategy (and deal desk for products) move a change on; no deletes for the app.
GRANT UPDATE ON public.strategy_changes TO authenticated;
DROP POLICY IF EXISTS "leaders update" ON public.strategy_changes;
CREATE POLICY "leaders update" ON public.strategy_changes FOR UPDATE TO authenticated
  USING (org_id = public.current_org() AND (public.has_org_role(org_id, 'owner') OR public.has_org_role(org_id, 'sales_leader') OR (target_table = 'products' AND public.has_org_role(org_id, 'deal_desk'))))
  WITH CHECK (org_id = public.current_org());
COMMENT ON TABLE public.strategy_changes IS 'Pending, applied or undone change proposed by an accepted strategic suggestion; "values" is what would be written, "base" what the field held when it was proposed, "previous" what to restore on undo.';
COMMENT ON TABLE public.strategy_links IS 'What an accepted strategic suggestion originated: a strategy change, a task or an experiment.';
