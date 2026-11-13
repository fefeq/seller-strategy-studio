-- NK-0044 + NK-0081. Additive: two RESTRICTIVE policy sets and one helper; existing policies untouched.
-- Rollback:
--   DROP POLICY "price roles read" ON public.suggestions; DROP POLICY "price roles update" ON public.suggestions;
--   DROP POLICY "blocked plays stay off insert" ON public.play_states; DROP POLICY "blocked plays stay off update" ON public.play_states;
--   DROP FUNCTION public.play_enable_allowed(text);
CREATE POLICY "price roles read" ON public.suggestions AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT (detector = 'strategy_product_price' AND coalesce(dedupe_key,'') LIKE 'strategy_product_price:price:%')
    OR public.has_org_role(org_id,'owner') OR public.has_org_role(org_id,'sales_leader') OR public.has_org_role(org_id,'deal_desk'));
CREATE POLICY "price roles update" ON public.suggestions AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT (detector = 'strategy_product_price' AND coalesce(dedupe_key,'') LIKE 'strategy_product_price:price:%')
    OR public.has_org_role(org_id,'owner') OR public.has_org_role(org_id,'sales_leader') OR public.has_org_role(org_id,'deal_desk'));

-- Blocked and planned plays (mirror of src/lib/plays/catalog.ts, kept in sync by a test).
CREATE OR REPLACE FUNCTION public.play_enable_allowed(_play_id text) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT _play_id NOT IN ('pain-qualified-segments','website-visitor-de-anonymization','review-site-intent-scoring','new-hire-tracking','hiring-signal-monitoring','funding-signal-scraping','tech-stack-signal-detection','brand-mentions-monitoring','competitor-post-engagers','target-account-exec-posts','founder-connections-mining','webinar-attendee-capture','automated-reply-enrichment','abm-ads','public-records-signals','public-filings-qualification','local-business-tam')
$$;
CREATE POLICY "blocked plays stay off insert" ON public.play_states AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT enabled OR public.play_enable_allowed(play_id));
CREATE POLICY "blocked plays stay off update" ON public.play_states AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (true) WITH CHECK (NOT enabled OR public.play_enable_allowed(play_id));