ALTER TABLE public.inbox_replies ADD COLUMN IF NOT EXISTS classify_status text NOT NULL DEFAULT 'pending' CHECK (classify_status IN ('pending','reserved','done','failed','skipped'));
CREATE INDEX IF NOT EXISTS inbox_replies_classify_idx ON public.inbox_replies (classify_status, received_at);

CREATE TABLE public.inbox_reply_derived (
  reply_id uuid PRIMARY KEY REFERENCES public.inbox_replies(id) ON DELETE CASCADE,
  org_id uuid NOT NULL,
  user_id uuid NOT NULL,
  state text NOT NULL,
  category text,
  confidence numeric,
  brake text,
  proposal text,
  draft text,
  referred_name text,
  referred_email text,
  return_date date,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
GRANT SELECT ON public.inbox_reply_derived TO authenticated;
GRANT ALL ON public.inbox_reply_derived TO service_role;
ALTER TABLE public.inbox_reply_derived ENABLE ROW LEVEL SECURITY;
CREATE POLICY inbox_reply_derived_owner_read ON public.inbox_reply_derived FOR SELECT TO authenticated USING (user_id = auth.uid() AND expires_at > now());

CREATE TABLE public.inbox_reply_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  operation text NOT NULL CHECK (operation IN ('classification','draft')),
  outcome text NOT NULL CHECK (outcome IN ('completed','failed')),
  input_tokens integer,
  output_tokens integer,
  cost_usd numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.inbox_reply_receipts TO authenticated;
GRANT ALL ON public.inbox_reply_receipts TO service_role;
ALTER TABLE public.inbox_reply_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY inbox_reply_receipts_member_read ON public.inbox_reply_receipts FOR SELECT TO authenticated USING (public.is_org_member(org_id));