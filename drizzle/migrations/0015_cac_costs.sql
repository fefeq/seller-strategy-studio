create table public.cac_costs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid default public.current_org() references public.organizations(id) on delete cascade,
  segment_id uuid references public.segments(id) on delete cascade,
  channel text not null check (length(btrim(channel)) between 1 and 60),
  period text not null check (period ~ '^\d{4}-Q[1-4]$'),
  amount numeric not null check (amount >= 0),
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint cac_costs_unique unique nulls not distinct (org_id, segment_id, channel, period)
);
comment on column public.cac_costs.segment_id is 'NULL = shared cost, allocated across segments by new customers won';
grant select, insert, update, delete on public.cac_costs to authenticated;
grant all on public.cac_costs to service_role;
alter table public.cac_costs enable row level security;
create trigger cac_costs_audit before insert or update on public.cac_costs for each row execute function public.set_audit();
create policy "org read" on public.cac_costs for select to authenticated
  using (org_id = public.current_org() and public.is_org_member(org_id));
create policy "spend insert" on public.cac_costs for insert to authenticated
  with check (public.has_org_role(org_id,'owner') or public.has_org_role(org_id,'sales_leader') or public.has_org_role(org_id,'marketing'));
create policy "spend update" on public.cac_costs for update to authenticated
  using (org_id = public.current_org() and (public.has_org_role(org_id,'owner') or public.has_org_role(org_id,'sales_leader') or public.has_org_role(org_id,'marketing')));
create policy "org delete owner" on public.cac_costs for delete to authenticated
  using (org_id = public.current_org() and public.has_org_role(org_id,'owner'));