CREATE TABLE public.email_draft_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL DEFAULT public.current_org() REFERENCES public.organizations(id) ON DELETE CASCADE,
  surface text NOT NULL CHECK (surface IN ('draft_followup','followup_sequence')),
  status text NOT NULL CHECK (status IN ('invalid','catch_all')),
  reason text NOT NULL CHECK (length(reason) <= 300),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.email_draft_blocks TO authenticated;
GRANT ALL ON public.email_draft_blocks TO service_role;
ALTER TABLE public.email_draft_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company draft block read" ON public.email_draft_blocks FOR SELECT TO authenticated USING (org_id = public.current_org() AND public.is_org_member(org_id));
CREATE POLICY "company draft block insert" ON public.email_draft_blocks FOR INSERT TO authenticated WITH CHECK (org_id = public.current_org() AND public.is_org_member(org_id));
COMMENT ON TABLE public.email_draft_blocks IS 'NK-0173: registry of drafts blocked by the email gate (surface, state, reason). Never stores the email address.';