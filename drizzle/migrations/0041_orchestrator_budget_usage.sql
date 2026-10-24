CREATE TABLE public.org_budgets (
  org_id uuid PRIMARY KEY DEFAULT public.current_org() REFERENCES public.organizations(id) ON DELETE CASCADE,
  monthly_limit numeric CHECK (monthly_limit IS NULL OR monthly_limit >= 0),
  warn_pct numeric NOT NULL DEFAULT 0.8,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.org_budgets TO authenticated;
GRANT ALL ON public.org_budgets TO service_role;
ALTER TABLE public.org_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org read" ON public.org_budgets FOR SELECT TO authenticated USING (org_id = public.current_org() AND public.is_org_member(org_id));
CREATE POLICY "owner write" ON public.org_budgets FOR INSERT TO authenticated WITH CHECK (org_id = public.current_org() AND EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = org_budgets.org_id AND m.user_id = auth.uid() AND m.role = 'owner'));
CREATE POLICY "owner update" ON public.org_budgets FOR UPDATE TO authenticated USING (org_id = public.current_org() AND EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = org_budgets.org_id AND m.user_id = auth.uid() AND m.role = 'owner'));

CREATE TABLE public.integration_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL DEFAULT public.current_org() REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid,
  service text NOT NULL,
  need text,
  trigger text NOT NULL DEFAULT 'manual' CHECK (trigger IN ('manual','automatic')),
  cost numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX integration_usage_org_month ON public.integration_usage (org_id, created_at);
GRANT SELECT, INSERT ON public.integration_usage TO authenticated;
GRANT ALL ON public.integration_usage TO service_role;
ALTER TABLE public.integration_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org read" ON public.integration_usage FOR SELECT TO authenticated USING (org_id = public.current_org() AND public.is_org_member(org_id));
CREATE POLICY "org insert" ON public.integration_usage FOR INSERT TO authenticated WITH CHECK (org_id = public.current_org() AND public.is_org_member(org_id));