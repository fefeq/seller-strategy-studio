-- SDD-20261027 strategic-suggestions-engine, F2 (H-4): experiments get a success threshold, a close rule, a review date and a decision.
-- Additive: existing experiments keep every value and get the new columns empty (CA-31). RLS, grants and audit trigger of 0003 stay as they are.
ALTER TABLE public.gtm_experiments ADD COLUMN IF NOT EXISTS success_threshold text NOT NULL DEFAULT '';
ALTER TABLE public.gtm_experiments ADD COLUMN IF NOT EXISTS close_rule text NOT NULL DEFAULT '';
ALTER TABLE public.gtm_experiments ADD COLUMN IF NOT EXISTS review_on date;
ALTER TABLE public.gtm_experiments ADD COLUMN IF NOT EXISTS decision text;
ALTER TABLE public.gtm_experiments ADD COLUMN IF NOT EXISTS decided_at timestamptz;
ALTER TABLE public.gtm_experiments ADD COLUMN IF NOT EXISTS decided_by uuid;
ALTER TABLE public.gtm_experiments ADD COLUMN IF NOT EXISTS change_element text;
ALTER TABLE public.gtm_experiments ADD COLUMN IF NOT EXISTS change_note text NOT NULL DEFAULT '';
ALTER TABLE public.gtm_experiments DROP CONSTRAINT IF EXISTS gtm_experiments_decision_list;
ALTER TABLE public.gtm_experiments ADD CONSTRAINT gtm_experiments_decision_list CHECK (decision IS NULL OR decision IN ('scale','adjust','close'));
ALTER TABLE public.gtm_experiments DROP CONSTRAINT IF EXISTS gtm_experiments_change_element_list;
ALTER TABLE public.gtm_experiments ADD CONSTRAINT gtm_experiments_change_element_list CHECK (change_element IS NULL OR change_element IN ('icp','segment','positioning','product_price'));
ALTER TABLE public.gtm_experiments DROP CONSTRAINT IF EXISTS gtm_experiments_texts_len;
ALTER TABLE public.gtm_experiments ADD CONSTRAINT gtm_experiments_texts_len CHECK (length(success_threshold) <= 500 AND length(close_rule) <= 500 AND length(change_note) <= 500);
COMMENT ON COLUMN public.gtm_experiments.close_rule IS 'When the experiment is closed and on what evidence (free text, up to 500 characters). Empty = not defined.';
COMMENT ON COLUMN public.gtm_experiments.decision IS 'Decision at the review: scale, adjust or close. Null = pending.';
COMMENT ON COLUMN public.gtm_experiments.change_element IS 'Element a strategy change is proposed on when the experiment is decided (icp, segment, positioning, product_price).';
