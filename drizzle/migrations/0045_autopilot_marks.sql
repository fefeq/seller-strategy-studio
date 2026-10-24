ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS auto_researched_at timestamptz;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS auto_prepped_at timestamptz;
COMMENT ON COLUMN public.accounts.auto_researched_at IS 'When Nokko researched this new account on its own (once per account).';
COMMENT ON COLUMN public.meetings.auto_prepped_at IS 'When Nokko prepared this meeting on its own the day before (null = by a person or not yet).';