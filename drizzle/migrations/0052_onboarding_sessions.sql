CREATE TABLE public.onboarding_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL DEFAULT public.current_org(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  depth text NOT NULL DEFAULT 'standard' CHECK (depth IN ('express','standard','deep')),
  step text NOT NULL DEFAULT 'depth',
  diagnosis jsonb,
  block_status jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);
GRANT SELECT, INSERT, UPDATE ON public.onboarding_sessions TO authenticated;
GRANT ALL ON public.onboarding_sessions TO service_role;
ALTER TABLE public.onboarding_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own onboarding in my company" ON public.onboarding_sessions FOR ALL TO authenticated
  USING (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = onboarding_sessions.org_id AND m.user_id = auth.uid()))
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = onboarding_sessions.org_id AND m.user_id = auth.uid()));