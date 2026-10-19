create table public.segment_targets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid default public.current_org() references public.organizations(id) on delete cascade,
  segment_id uuid not null references public.segments(id) on delete cascade,
  period text not null check (period ~ '^\d{4}-Q[1-4]$'),
  amount numeric not null check (amount >= 0),
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (org_id, segment_id, period)
);
grant select, insert, update, delete on public.segment_targets to authenticated;
grant all on public.segment_targets to service_role;
alter table public.segment_targets enable row level security;
create trigger segment_targets_audit before insert or update on public.segment_targets for each row execute function public.set_audit();
create policy "org read" on public.segment_targets for select to authenticated
  using (org_id = public.current_org() and public.is_org_member(org_id));
create policy "leaders insert" on public.segment_targets for insert to authenticated
  with check (public.has_org_role(org_id,'owner') or public.has_org_role(org_id,'sales_leader'));
create policy "leaders update" on public.segment_targets for update to authenticated
  using (org_id = public.current_org() and (public.has_org_role(org_id,'owner') or public.has_org_role(org_id,'sales_leader')));
create policy "org delete owner" on public.segment_targets for delete to authenticated
  using (org_id = public.current_org() and public.has_org_role(org_id,'owner'));