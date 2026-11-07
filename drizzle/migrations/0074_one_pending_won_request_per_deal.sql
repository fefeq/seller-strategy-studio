-- SDD-20261031-deal-won-duplicate-approvals (CA-3): a deal can have only one pending «pass to Ganado» request.
-- The deal id lives inside the evidence text ({"deal_id":"…","stage":"won"}), so the guarantee is a partial unique
-- index on that id. substring(… from regex) is immutable, which an index expression needs, and unlike a jsonb cast it
-- never fails on evidence that is not JSON. lower() makes an upper-case id collide with its lower-case twin.
-- If the check below finds duplicates, resolve them first from Aprobaciones (apply or skip all but one): CREATE INDEX
-- would fail, and changing `status` from SQL here would hit the approvals guard, which needs a signed-in user.
--
-- Before applying (read-only check, must return no rows; duplicates would make CREATE INDEX fail):
--   select lower(substring(evidence from '"deal_id"\s*:\s*"([0-9a-fA-F-]{36})"')) as deal_id, org_id, count(*)
--   from public.approvals where kind = 'stage_change' and status = 'pending'
--   group by 1, 2 having count(*) > 1;
create unique index if not exists approvals_one_pending_stage_change_per_deal
  on public.approvals (org_id, (lower(substring(evidence from '"deal_id"\s*:\s*"([0-9a-fA-F-]{36})"'))))
  where kind = 'stage_change'
    and status = 'pending'
    and substring(evidence from '"deal_id"\s*:\s*"([0-9a-fA-F-]{36})"') is not null;
