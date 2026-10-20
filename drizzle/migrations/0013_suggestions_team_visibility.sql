drop policy if exists "org read" on public.suggestions;
drop policy if exists "org update" on public.suggestions;
-- Everyone sees their own and unassigned suggestions; Owner and Sales Leader see and reassign the whole team's.
create policy "org read" on public.suggestions for select to authenticated
  using (org_id = public.current_org() and public.is_org_member(org_id)
    and (user_id is null or user_id = auth.uid() or public.has_org_role(org_id,'owner') or public.has_org_role(org_id,'sales_leader')));
create policy "org update" on public.suggestions for update to authenticated
  using (org_id = public.current_org() and public.is_org_member(org_id)
    and (user_id is null or user_id = auth.uid() or public.has_org_role(org_id,'owner') or public.has_org_role(org_id,'sales_leader')))
  with check (public.is_org_member(org_id)
    and (user_id is null or user_id = auth.uid() or public.has_org_role(org_id,'owner') or public.has_org_role(org_id,'sales_leader')));