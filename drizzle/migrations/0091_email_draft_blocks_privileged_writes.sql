-- NK-0173: only the privileged client writes blocked-draft rows (PRD). Members keep read access.
-- Rollback (manual): GRANT INSERT ON public.email_draft_blocks TO authenticated;
--   CREATE POLICY "company draft block insert" ON public.email_draft_blocks FOR INSERT TO authenticated
--   WITH CHECK (org_id = public.current_org() AND public.is_org_member(org_id));
DROP POLICY IF EXISTS "company draft block insert" ON public.email_draft_blocks;
REVOKE INSERT ON public.email_draft_blocks FROM authenticated;