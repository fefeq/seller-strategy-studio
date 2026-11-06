-- SDD-20261106-tool-plan-real-connections, U-3 (NK-0064).
-- NOT applied to any database. The numbering (0077) was the next free one above origin/main at a43200d; check the journal and
-- renumber on integration if another branch took it. Tested on an in-process Postgres (src/lib/integrations-policies.pg.test.ts),
-- not on the deployed database: check pg_policies for public.integrations there before and after applying (SDD section 16).
--
-- Until now any member of the company could insert and update the team's tool plan; only the interface limited it to the Owner
-- (0002_multitenant_organizations.sql:121-122). From here the database enforces it, and for the company the person is working in.
-- "org read" and "org delete owner" are not touched. Platform superadmins are Owner of every company (0075), so they pass.
--
-- Rollback: drop both policies below and recreate the 0002 ones:
--   drop policy if exists "org insert" on public.integrations;
--   drop policy if exists "org update" on public.integrations;
--   create policy "org insert" on public.integrations for insert to authenticated with check (public.is_org_member(org_id));
--   create policy "org update" on public.integrations for update to authenticated
--     using (org_id = public.current_org() and public.is_org_member(org_id)) with check (public.is_org_member(org_id));

drop policy if exists "org insert" on public.integrations;
drop policy if exists "org update" on public.integrations;

create policy "org insert" on public.integrations for insert to authenticated
  with check (org_id = public.current_org() and public.has_org_role(org_id, 'owner'));
create policy "org update" on public.integrations for update to authenticated
  using (org_id = public.current_org() and public.has_org_role(org_id, 'owner'))
  with check (org_id = public.current_org() and public.has_org_role(org_id, 'owner'));
