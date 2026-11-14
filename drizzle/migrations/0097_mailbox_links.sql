CREATE TABLE public.mailbox_links (
  org_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'gmail' CHECK (provider = 'gmail'),
  address text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','error')),
  linked_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mailbox_links TO authenticated;
GRANT ALL ON public.mailbox_links TO service_role;
ALTER TABLE public.mailbox_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read" ON public.mailbox_links FOR SELECT TO authenticated USING (public.is_org_member(org_id));