-- 0082 (NK-0070, SDD-20261109-rls-price-suggestions-and-notices, U-2): a member can only mark their notices as read.
-- Until now `authenticated` had UPDATE on the whole table (0049:21), so a member could rewrite title, body, link, dedupe_key...
-- of their own notices. The app only changes read_at from the browser (notification-center.tsx); every other write uses
-- service_role or security definer functions (notices.server.ts, notify_job_end, money_notify), which are not affected.
-- The table-level revoke also removes any column-level UPDATE grant that already existed. The policies are not touched.
-- No begin/commit of its own, like the other migrations. Not applied by the agent: Fede applies it after precheck 3 (SDD §13).
revoke update on public.notifications from authenticated, anon;
grant update (read_at) on public.notifications to authenticated;

-- Rollback (NOT run by the migration). Reapply EXACTLY what SDD §13 precheck 3 (comprobación previa 3) noted for
-- `authenticated` and `anon` before applying 0082 (table and column privileges), not the repo's 0049:21 by assumption.
-- Repo case:
--   revoke update (read_at) on public.notifications from authenticated;
--   grant update on public.notifications to authenticated;
-- plus whatever precheck 3 showed, for example if `anon` had it:
--   grant update on public.notifications to anon;
