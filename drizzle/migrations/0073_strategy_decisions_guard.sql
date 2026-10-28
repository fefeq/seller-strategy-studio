-- SDD-20261027 strategic-suggestions-engine, F0 follow-up (second audit, finding 2): a member could skip the decision log from the browser.
-- VERIFIED LOCALLY on an in-process Postgres (PGlite): src/lib/strategy-f0.pg.test.ts. NOT applied to any real database: apply it first on
-- a copy. It adds no CHECK constraint and rewrites no row, so there is nothing to validate and previous rows cannot make it fail.
-- Numbering: 0072 is taken by the open F4 branch (0072_strategy_reviews), so this one is 0073; its `when` sits between main's last
-- entry and F4's, so F4 can still merge after it. If F4 merges first, only this entry's `when` needs re-stamping.
--
-- The hole: the "org update" policy of suggestions (0007/0013) lets any member who can see a row update ANY column from the browser,
-- so `status` could go from pending to approved/dismissed/snoozed with no strategy_decisions row, and "org insert" could create a
-- strategy_* row already decided. CA-4 (decide once, with a record) then held only for the app's own path.
--
-- Why a trigger on transitions and not on who calls:
--   * refreshSuggestions (agent.functions.ts) runs the strategic sync (syncStrategySuggestions) with the SIGNED-IN USER's client, not the
--     privileged one, and it must insert rows, refresh their evidence and reopen a dismissed or postponed one (CA-5, CA-6); the wake of
--     postponed rows (org-data.ts) does the same. A rule "members cannot touch status or strategy" would break all of that.
--   * What a member must not do directly is DECIDE: leave `pending` for approved / snoozed / dismissed / resolved, or move
--     snoozed_until, without the log. Those are the only transitions refused. Moving back to `pending` (reopen, wake) stays open.
-- The mechanism: the trigger refuses those transitions for the roles the browser uses (authenticated, anon) unless the transaction-local
-- setting nokko.strategy_decision is 'on'. Only decide_strategy_suggestion (SECURITY INVOKER, so RLS still applies) switches it on, around
-- its single UPDATE, and switches it off again before the log insert. Why this and not SECURITY DEFINER on the function: DEFINER would
-- skip the RLS of suggestions and need its own visibility check, a second copy of the rule. Why not a role check alone: the function
-- runs as the caller's role. The setting cannot be set from the browser: PostgREST only runs the functions of the exposed schema and
-- has no way to run set_config or SET. service_role (server jobs, Telegram) and postgres are not subject to the guard: they are not
-- the browser, and the app code that uses them already goes through the same function.
-- Rules for a strategy_* row written by a browser role without the setting:
--   INSERT: status must be 'pending' and snoozed_until null.
--   UPDATE: detector cannot change; status and snoozed_until can only move to (pending, null) and only from pending, snoozed or
--           dismissed; the evidence (strategy) of a row that is not pending cannot change (an accepted one is never touched).
-- Not covered, on purpose: a member can still change `strategy` of a PENDING row (the sync does that with their client to refresh
-- evidence) and can reopen a dismissed or postponed one; neither skips the log of a decision.
-- Operational suggestions (detector not strategy_*) are untouched. ROLLBACK: see the commented script at the end.

CREATE OR REPLACE FUNCTION public.suggestions_strategy_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN RETURN NEW; END IF; -- service_role, postgres: not the browser
  IF coalesce(current_setting('nokko.strategy_decision', true), '') = 'on' THEN RETURN NEW; END IF; -- decide_strategy_suggestion only
  IF TG_OP = 'INSERT' THEN
    IF NEW.detector LIKE 'strategy\_%' AND (NEW.status <> 'pending' OR NEW.snoozed_until IS NOT NULL) THEN
      RAISE EXCEPTION 'suggestions: a strategic suggestion is created pending; it is decided with decide_strategy_suggestion' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.detector NOT LIKE 'strategy\_%' AND NEW.detector NOT LIKE 'strategy\_%' THEN RETURN NEW; END IF;
  IF NEW.detector IS DISTINCT FROM OLD.detector THEN
    RAISE EXCEPTION 'suggestions: the detector of a strategic suggestion cannot change' USING ERRCODE = '42501';
  END IF;
  IF (NEW.status IS DISTINCT FROM OLD.status OR NEW.snoozed_until IS DISTINCT FROM OLD.snoozed_until)
     AND NOT (NEW.status = 'pending' AND NEW.snoozed_until IS NULL AND OLD.status IN ('pending', 'snoozed', 'dismissed')) THEN
    RAISE EXCEPTION 'suggestions: a strategic suggestion is decided with decide_strategy_suggestion, which records who decided and why' USING ERRCODE = '42501';
  END IF;
  IF OLD.status <> 'pending' AND NEW.status <> 'pending' AND NEW.strategy IS DISTINCT FROM OLD.strategy THEN
    RAISE EXCEPTION 'suggestions: the evidence of a decided strategic suggestion cannot change' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS suggestions_strategy_guard ON public.suggestions;
CREATE TRIGGER suggestions_strategy_guard BEFORE INSERT OR UPDATE OF detector, status, snoozed_until, strategy ON public.suggestions
  FOR EACH ROW EXECUTE FUNCTION public.suggestions_strategy_guard();

-- decide_strategy_suggestion as in 0068 (same signature, same grants), plus the setting around its one UPDATE. Not edited in 0068: that
-- migration is already in main.
CREATE OR REPLACE FUNCTION public.decide_strategy_suggestion(p_suggestion_id uuid, p_org_id uuid, p_decision text, p_reason text, p_remind_at timestamptz, p_by uuid)
RETURNS text LANGUAGE plpgsql SET search_path = public AS $$
DECLARE st text; dec text; fp text; reason text := nullif(btrim(coalesce(p_reason, '')), ''); remind timestamptz; n int;
BEGIN
  IF p_decision NOT IN ('accept','postpone','dismiss') THEN RAISE EXCEPTION 'decide_strategy_suggestion: unknown decision %', p_decision USING ERRCODE = '22023'; END IF;
  IF reason IS NOT NULL AND length(reason) > 500 THEN RAISE EXCEPTION 'decide_strategy_suggestion: reason over 500 characters' USING ERRCODE = '22001'; END IF;
  st := CASE p_decision WHEN 'accept' THEN 'approved' WHEN 'postpone' THEN 'snoozed' ELSE 'dismissed' END;
  dec := CASE p_decision WHEN 'accept' THEN 'accepted' WHEN 'postpone' THEN 'postponed' ELSE 'dismissed' END;
  IF p_decision = 'postpone' THEN remind := coalesce(p_remind_at, now() + interval '3 days'); END IF;
  PERFORM set_config('nokko.strategy_decision', 'on', true); -- transaction-local; read by suggestions_strategy_guard
  UPDATE public.suggestions SET status = st, snoozed_until = remind, updated_at = now()
    WHERE id = p_suggestion_id AND org_id = p_org_id AND status = 'pending' AND detector LIKE 'strategy\_%' AND strategy IS NOT NULL
    RETURNING strategy->>'fingerprint' INTO fp;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM set_config('nokko.strategy_decision', 'off', true); -- only that one UPDATE is exempt
  IF n = 0 THEN RETURN NULL; END IF;
  INSERT INTO public.strategy_decisions (org_id, suggestion_id, decision, reason, remind_at, evidence_fingerprint, decided_by)
    VALUES (p_org_id, p_suggestion_id, dec, reason, remind, fp, p_by); -- any error here undoes the update above
  RETURN st;
END $$;
REVOKE ALL ON FUNCTION public.decide_strategy_suggestion(uuid, uuid, text, text, timestamptz, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_strategy_suggestion(uuid, uuid, text, text, timestamptz, uuid) TO authenticated, service_role;

-- ROLLBACK (manual; run only to undo this migration, it loses no data). Not part of the migration.
-- DROP TRIGGER IF EXISTS suggestions_strategy_guard ON public.suggestions;
-- DROP FUNCTION IF EXISTS public.suggestions_strategy_guard();
-- then re-run the CREATE OR REPLACE FUNCTION public.decide_strategy_suggestion block of 0068_strategic_suggestions_and_loss_reason.sql
-- (the version without the set_config lines); leaving this one in place is harmless once the trigger is gone.
