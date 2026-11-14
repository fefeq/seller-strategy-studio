CREATE TABLE public.inbox_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  user_id uuid NOT NULL,
  gmail_id text NOT NULL,
  thread_id text,
  lead_id uuid,
  received_at timestamptz NOT NULL,
  kind text NOT NULL CHECK (kind IN ('human','auto')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, gmail_id)
);
GRANT SELECT ON public.inbox_replies TO authenticated;
GRANT ALL ON public.inbox_replies TO service_role;
ALTER TABLE public.inbox_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY inbox_replies_owner_read ON public.inbox_replies FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.lead_replied_marks (
  org_id uuid NOT NULL,
  lead_id uuid NOT NULL,
  replied_at timestamptz NOT NULL,
  PRIMARY KEY (org_id, lead_id)
);
GRANT SELECT ON public.lead_replied_marks TO authenticated;
GRANT ALL ON public.lead_replied_marks TO service_role;
ALTER TABLE public.lead_replied_marks ENABLE ROW LEVEL SECURITY;
CREATE POLICY lead_replied_marks_member_read ON public.lead_replied_marks FOR SELECT TO authenticated USING (public.is_org_member(org_id));

ALTER TABLE public.mailbox_links ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;
ALTER TABLE public.mailbox_links ADD COLUMN IF NOT EXISTS replies_count integer NOT NULL DEFAULT 0;