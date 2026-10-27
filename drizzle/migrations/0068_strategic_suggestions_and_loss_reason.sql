-- SDD-20261027 strategic-suggestions-engine, F0 (H-1 and H-2).
-- VERIFIED LOCALLY on an in-process Postgres (PGlite) with two fictional companies: src/lib/strategy-f0.pg.test.ts runs every check
-- below on a replica of suggestions and deals (columns and policies of 0007/0013 and types.ts). NOT applied to any real database:
-- apply it first on a copy, because the replica is not the database itself (the real deals table has triggers the replica lacks).
-- Numbering: 0068. 0059 (Drive) and 0062, 0064 to 0067 (guided next step) belong to other open branches, so this one skips them.
-- Locking and old rows: every CHECK is added NOT VALID (no full-table scan under the exclusive lock) and validated in its own
-- statement. The three deals columns and suggestions.strategy are new and null, so their checks always validate. The strategy_* check
-- is validated only if no existing strategy_* row breaks it; otherwise it stays NOT VALID (still enforced on every new write) and a
-- NOTICE says so, so the migration never fails on rows it did not create. Before applying on a copy:
--   select count(*) from public.suggestions where detector like 'strategy\_%';
-- ROLLBACK (manual, the migration is additive; it only loses the new data): see the commented script at the end of this file.
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
ALTER TABLE public.suggestions ADD CONSTRAINT suggestions_strategy_valid CHECK (detector NOT LIKE 'strategy\_%' OR public.strategy_meta_valid(strategy)) NOT VALID;
ALTER TABLE public.suggestions DROP CONSTRAINT IF EXISTS suggestions_strategy_detector;
ALTER TABLE public.suggestions ADD CONSTRAINT suggestions_strategy_detector CHECK (strategy IS NULL OR detector LIKE 'strategy\_%') NOT VALID;
-- strategy is a brand new column (all null), so this one always validates.
ALTER TABLE public.suggestions VALIDATE CONSTRAINT suggestions_strategy_detector;
-- Validate the strategy_* check only when no existing row breaks it (a failed VALIDATE would abort the whole migration).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.suggestions WHERE detector LIKE 'strategy\_%' AND NOT public.strategy_meta_valid(strategy)) THEN
    RAISE NOTICE 'suggestions_strategy_valid left NOT VALID: existing strategy_* rows without valid strategy data. New writes are still checked; fix or delete those rows, then run: ALTER TABLE public.suggestions VALIDATE CONSTRAINT suggestions_strategy_valid;';
  ELSE
    ALTER TABLE public.suggestions VALIDATE CONSTRAINT suggestions_strategy_valid;
  END IF;
END $$;

-- 2. Decision log --------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.strategy_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL DEFAULT public.current_org() REFERENCES public.organizations(id) ON DELETE CASCADE,
  suggestion_id uuid NOT NULL REFERENCES public.suggestions(id) ON DELETE RESTRICT, -- a suggestion with decisions cannot be deleted (the log is a record)
  decision text NOT NULL CONSTRAINT strategy_decisions_decision CHECK (decision IN ('accepted','postponed','dismissed')),
  reason text CONSTRAINT strategy_decisions_reason CHECK (reason IS NULL OR length(reason) <= 500),
  remind_at timestamptz,
  evidence_fingerprint text NOT NULL, -- always copied from the suggestion by the trigger below; whatever the client sends is ignored
  decided_by uuid NOT NULL DEFAULT auth.uid(),
  decided_at timestamptz NOT NULL DEFAULT now() -- always set by the trigger below
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
-- decided_at and evidence_fingerprint are not the client's to write: the trigger overwrites both on every insert (date = the database
-- clock, fingerprint = the one stored on the suggestion), so a forged value never reaches reconcile. SECURITY INVOKER: reading the
-- suggestion goes through the caller's RLS, so a suggestion the caller cannot see is refused here too.
CREATE OR REPLACE FUNCTION public.strategy_decisions_stamp() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE fp text;
BEGIN
  SELECT s.strategy->>'fingerprint' INTO fp FROM public.suggestions s WHERE s.id = NEW.suggestion_id AND s.org_id = NEW.org_id;
  IF fp IS NULL THEN RAISE EXCEPTION 'strategy_decisions: the suggestion does not exist or has no strategy data' USING ERRCODE = '23514'; END IF;
  NEW.evidence_fingerprint := fp;
  NEW.decided_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS strategy_decisions_stamp ON public.strategy_decisions;
CREATE TRIGGER strategy_decisions_stamp BEFORE INSERT ON public.strategy_decisions FOR EACH ROW EXECUTE FUNCTION public.strategy_decisions_stamp();
DROP POLICY IF EXISTS "org insert" ON public.strategy_decisions;
CREATE POLICY "org insert" ON public.strategy_decisions FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(org_id) AND decided_by = auth.uid() AND EXISTS (SELECT 1 FROM public.suggestions s WHERE s.id = suggestion_id AND s.org_id = strategy_decisions.org_id));

-- 2b. Atomic decision: the status change and the log row are one transaction (CA-4). SECURITY INVOKER on purpose: for a signed-in user
-- the RLS of suggestions (visibility, company) and the insert policy (decided_by = auth.uid()) apply as always; the privileged client
-- (Telegram, cron) passes the user it acts for. Returns the new status, or null when the suggestion was no longer pending.
CREATE OR REPLACE FUNCTION public.decide_strategy_suggestion(p_suggestion_id uuid, p_org_id uuid, p_decision text, p_reason text, p_remind_at timestamptz, p_by uuid)
RETURNS text LANGUAGE plpgsql SET search_path = public AS $$
DECLARE st text; dec text; fp text; reason text := nullif(btrim(coalesce(p_reason, '')), ''); remind timestamptz;
BEGIN
  IF p_decision NOT IN ('accept','postpone','dismiss') THEN RAISE EXCEPTION 'decide_strategy_suggestion: unknown decision %', p_decision USING ERRCODE = '22023'; END IF;
  IF reason IS NOT NULL AND length(reason) > 500 THEN RAISE EXCEPTION 'decide_strategy_suggestion: reason over 500 characters' USING ERRCODE = '22001'; END IF;
  st := CASE p_decision WHEN 'accept' THEN 'approved' WHEN 'postpone' THEN 'snoozed' ELSE 'dismissed' END;
  dec := CASE p_decision WHEN 'accept' THEN 'accepted' WHEN 'postpone' THEN 'postponed' ELSE 'dismissed' END;
  IF p_decision = 'postpone' THEN remind := coalesce(p_remind_at, now() + interval '3 days'); END IF;
  UPDATE public.suggestions SET status = st, snoozed_until = remind, updated_at = now()
    WHERE id = p_suggestion_id AND org_id = p_org_id AND status = 'pending' AND detector LIKE 'strategy\_%' AND strategy IS NOT NULL
    RETURNING strategy->>'fingerprint' INTO fp;
  IF NOT FOUND THEN RETURN NULL; END IF;
  INSERT INTO public.strategy_decisions (org_id, suggestion_id, decision, reason, remind_at, evidence_fingerprint, decided_by)
    VALUES (p_org_id, p_suggestion_id, dec, reason, remind, fp, p_by); -- any error here undoes the update above
  RETURN st;
END $$;
REVOKE ALL ON FUNCTION public.decide_strategy_suggestion(uuid, uuid, text, text, timestamptz, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_strategy_suggestion(uuid, uuid, text, text, timestamptz, uuid) TO authenticated, service_role;
COMMENT ON TABLE public.strategy_decisions IS 'Who accepted, postponed or dismissed a strategic suggestion, when and why; keeps the evidence fingerprint at that moment.';

-- 3. Loss reason and competitor on deals ---------------------------------------------------------------------------------------------
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS lost_reason text;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS lost_reason_detail text;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS lost_competitor text;
ALTER TABLE public.deals DROP CONSTRAINT IF EXISTS deals_lost_reason_list;
ALTER TABLE public.deals ADD CONSTRAINT deals_lost_reason_list CHECK (lost_reason IS NULL OR lost_reason IN ('price','competitor','no_decision','no_budget','no_product_fit','bad_timing','contact_change','other')) NOT VALID;
ALTER TABLE public.deals VALIDATE CONSTRAINT deals_lost_reason_list;
ALTER TABLE public.deals DROP CONSTRAINT IF EXISTS deals_lost_reason_detail_len;
ALTER TABLE public.deals ADD CONSTRAINT deals_lost_reason_detail_len CHECK (lost_reason_detail IS NULL OR length(lost_reason_detail) <= 500) NOT VALID;
ALTER TABLE public.deals VALIDATE CONSTRAINT deals_lost_reason_detail_len;
ALTER TABLE public.deals DROP CONSTRAINT IF EXISTS deals_lost_competitor_len;
ALTER TABLE public.deals ADD CONSTRAINT deals_lost_competitor_len CHECK (lost_competitor IS NULL OR length(lost_competitor) <= 200) NOT VALID;
ALTER TABLE public.deals VALIDATE CONSTRAINT deals_lost_competitor_len;
COMMENT ON COLUMN public.deals.lost_reason IS 'Why the deal was lost (fixed list); null = sin dato. Only read for deals in stage lost.';
COMMENT ON COLUMN public.deals.lost_reason_detail IS 'Free text that goes with the loss reason (up to 500 characters).';
COMMENT ON COLUMN public.deals.lost_competitor IS 'Competitor the deal was lost to, free text until the competitors entity exists (SDD 7b).';

-- ROLLBACK (manual; run only to undo this migration, it deletes the data written since). Order matters. Not part of the migration.
-- DROP FUNCTION IF EXISTS public.decide_strategy_suggestion(uuid, uuid, text, text, timestamptz, uuid);
-- DROP TABLE IF EXISTS public.strategy_decisions;            -- also drops its trigger and policies
-- DROP FUNCTION IF EXISTS public.strategy_decisions_stamp();
-- ALTER TABLE public.suggestions DROP CONSTRAINT IF EXISTS suggestions_strategy_valid, DROP CONSTRAINT IF EXISTS suggestions_strategy_detector;
-- DROP FUNCTION IF EXISTS public.strategy_meta_valid(jsonb);
-- ALTER TABLE public.suggestions DROP COLUMN IF EXISTS strategy;
-- ALTER TABLE public.deals DROP CONSTRAINT IF EXISTS deals_lost_reason_list, DROP CONSTRAINT IF EXISTS deals_lost_reason_detail_len, DROP CONSTRAINT IF EXISTS deals_lost_competitor_len;
-- ALTER TABLE public.deals DROP COLUMN IF EXISTS lost_reason, DROP COLUMN IF EXISTS lost_reason_detail, DROP COLUMN IF EXISTS lost_competitor;
