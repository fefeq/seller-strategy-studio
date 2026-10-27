-- SDD-20261027 strategic-suggestions-engine, F0 (H-1 and H-2).
-- VERIFIED LOCALLY on an in-process Postgres (PGlite) with two fictional companies: src/lib/strategy-f0.pg.test.ts runs every check
-- below on a replica of suggestions and deals (columns and policies of 0007/0013 and types.ts). NOT applied to any real database:
-- apply it first on a copy, because the replica is not the database itself (the real deals table has triggers the replica lacks).
-- Numbering: 0068. 0059 (Drive) and 0062, 0064 to 0067 (guided next step) belong to other open branches, so this one skips them.
-- What it does (additive; no existing row changes, every new column is nullable):
--   1. suggestions.strategy jsonb: element, kind, evidence (each item with table, id, label and link), evidence_level, sample_size,
--      action_type, fingerprint. A strategy_* detector MUST carry a valid one (CA-1); with no evidence it can only be «missing_data»
--      asking to complete data (CA-2); the level must follow the fixed rule, under 5 source records low, 5 to 9 medium, 10 or more
--      high, and the sample can never be smaller than the evidence listed (CA-3). The existing (org_id, dedupe_key) unique key and the
--      RLS of suggestions are reused unchanged.
--   2. strategy_decisions: append-only log of accept / postpone / dismiss with who, when and an optional reason (CA-4), by company.
--   3. deals.lost_reason (fixed list), lost_reason_detail (free text), lost_competitor (free text) (CA-8 to CA-10). The reason list was
--      validated by Fede on 2026-10-27 (SDD question 5): changing it means a new migration for the check below and src/lib/loss-reasons.ts.
--      The competitor is free text until the competitors entity (SDD 7b) exists.

-- 1. Strategic suggestions ---------------------------------------------------------------------------------------------------------
ALTER TABLE public.suggestions ADD COLUMN IF NOT EXISTS strategy jsonb;
COMMENT ON COLUMN public.suggestions.strategy IS 'Only for strategy_* detectors: {element, kind, evidence:[{table,id,label,link}], evidence_level, sample_size, action_type, fingerprint}; see strategy_meta_valid.';

CREATE OR REPLACE FUNCTION public.strategy_meta_valid(m jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE n int; len int; lvl text;
BEGIN
  IF m IS NULL OR jsonb_typeof(m) <> 'object' THEN RETURN false; END IF;
  IF jsonb_typeof(m->'evidence') IS DISTINCT FROM 'array' THEN RETURN false; END IF;
  IF coalesce(m->>'element', '') NOT IN ('icp','segment','positioning','competitor','product_price','pipeline','experiment') THEN RETURN false; END IF;
  IF coalesce(m->>'kind', '') NOT IN ('create','change','validate','close','missing_data') THEN RETURN false; END IF;
  IF coalesce(m->>'action_type', '') NOT IN ('strategy_change','experiment','commercial_action','data_to_complete') THEN RETURN false; END IF;
  IF coalesce(m->>'fingerprint', '') = '' THEN RETURN false; END IF;
  IF jsonb_typeof(m->'sample_size') IS DISTINCT FROM 'number' OR (m->>'sample_size') !~ '^[0-9]+$' THEN RETURN false; END IF;
  n := (m->>'sample_size')::int;
  len := jsonb_array_length(m->'evidence');
  IF n < len THEN RETURN false; END IF;
  lvl := CASE WHEN n >= 10 THEN 'high' WHEN n >= 5 THEN 'medium' ELSE 'low' END;
  IF m->>'evidence_level' IS DISTINCT FROM lvl THEN RETURN false; END IF;
  IF len = 0 AND (m->>'kind' <> 'missing_data' OR m->>'action_type' <> 'data_to_complete') THEN RETURN false; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(m->'evidence') e
    WHERE jsonb_typeof(e) <> 'object' OR coalesce(e->>'table', '') = '' OR coalesce(e->>'id', '') = '' OR coalesce(e->>'label', '') = '' OR coalesce(e->>'link', '') = ''
  ) THEN RETURN false; END IF;
  RETURN true;
END $$;

ALTER TABLE public.suggestions DROP CONSTRAINT IF EXISTS suggestions_strategy_valid;
ALTER TABLE public.suggestions ADD CONSTRAINT suggestions_strategy_valid CHECK (detector NOT LIKE 'strategy\_%' OR public.strategy_meta_valid(strategy));
ALTER TABLE public.suggestions DROP CONSTRAINT IF EXISTS suggestions_strategy_detector;
ALTER TABLE public.suggestions ADD CONSTRAINT suggestions_strategy_detector CHECK (strategy IS NULL OR detector LIKE 'strategy\_%');

-- 2. Decision log --------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.strategy_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL DEFAULT public.current_org() REFERENCES public.organizations(id) ON DELETE CASCADE,
  suggestion_id uuid NOT NULL REFERENCES public.suggestions(id), -- no cascade: a suggestion with decisions cannot be deleted on its own (the log is a record); deleting the company still removes both
  decision text NOT NULL CONSTRAINT strategy_decisions_decision CHECK (decision IN ('accepted','postponed','dismissed')),
  reason text CONSTRAINT strategy_decisions_reason CHECK (reason IS NULL OR length(reason) <= 500),
  remind_at timestamptz,
  evidence_fingerprint text NOT NULL,
  decided_by uuid NOT NULL DEFAULT auth.uid(),
  decided_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS strategy_decisions_suggestion_idx ON public.strategy_decisions (suggestion_id, decided_at);
CREATE INDEX IF NOT EXISTS strategy_decisions_org_idx ON public.strategy_decisions (org_id, decided_at DESC);
-- Append-only for the app: read and insert, never update or delete (the table is a record of who decided what and when).
REVOKE ALL ON public.strategy_decisions FROM anon, authenticated;
GRANT SELECT, INSERT ON public.strategy_decisions TO authenticated;
GRANT ALL ON public.strategy_decisions TO service_role;
ALTER TABLE public.strategy_decisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org read" ON public.strategy_decisions;
CREATE POLICY "org read" ON public.strategy_decisions FOR SELECT TO authenticated
  USING (org_id = public.current_org() AND public.is_org_member(org_id) AND EXISTS (SELECT 1 FROM public.suggestions s WHERE s.id = suggestion_id AND s.org_id = strategy_decisions.org_id));
DROP POLICY IF EXISTS "org insert" ON public.strategy_decisions;
CREATE POLICY "org insert" ON public.strategy_decisions FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(org_id) AND decided_by = auth.uid() AND decided_at = now() AND EXISTS (SELECT 1 FROM public.suggestions s WHERE s.id = suggestion_id AND s.org_id = strategy_decisions.org_id AND s.strategy->>'fingerprint' = strategy_decisions.evidence_fingerprint));
COMMENT ON TABLE public.strategy_decisions IS 'Who accepted, postponed or dismissed a strategic suggestion, when and why; keeps the evidence fingerprint at that moment.';

-- 3. Loss reason and competitor on deals ---------------------------------------------------------------------------------------------
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS lost_reason text;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS lost_reason_detail text;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS lost_competitor text;
ALTER TABLE public.deals DROP CONSTRAINT IF EXISTS deals_lost_reason_list;
ALTER TABLE public.deals ADD CONSTRAINT deals_lost_reason_list CHECK (lost_reason IS NULL OR lost_reason IN ('price','competitor','no_decision','no_budget','no_product_fit','bad_timing','contact_change','other'));
ALTER TABLE public.deals DROP CONSTRAINT IF EXISTS deals_lost_reason_detail_len;
ALTER TABLE public.deals ADD CONSTRAINT deals_lost_reason_detail_len CHECK (lost_reason_detail IS NULL OR length(lost_reason_detail) <= 500);
ALTER TABLE public.deals DROP CONSTRAINT IF EXISTS deals_lost_competitor_len;
ALTER TABLE public.deals ADD CONSTRAINT deals_lost_competitor_len CHECK (lost_competitor IS NULL OR length(lost_competitor) <= 200);
COMMENT ON COLUMN public.deals.lost_reason IS 'Why the deal was lost (fixed list); null = sin dato. Only read for deals in stage lost.';
COMMENT ON COLUMN public.deals.lost_reason_detail IS 'Free text that goes with the loss reason (up to 500 characters).';
COMMENT ON COLUMN public.deals.lost_competitor IS 'Competitor the deal was lost to, free text until the competitors entity exists (SDD 7b).';
