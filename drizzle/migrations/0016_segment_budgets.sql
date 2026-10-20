create table public.segment_budgets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid default public.current_org() references public.organizations(id) on delete cascade,
  segment_id uuid not null references public.segments(id) on delete cascade,
  year integer not null check (year between 2000 and 2100),
  plan_revenue numeric check (plan_revenue >= 0),
  plan_cost_to_serve numeric check (plan_cost_to_serve >= 0),
  plan_acquisition numeric check (plan_acquisition >= 0),
  plan_new_customers integer check (plan_new_customers >= 0),
  actual_revenue numeric check (actual_revenue >= 0),
  actual_cost_to_serve numeric check (actual_cost_to_serve >= 0),
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint segment_budgets_unique unique (org_id, segment_id, year)
);
comment on table public.segment_budgets is 'Annual plan vs actual per segment: revenue and cost to serve give the real gross margin used by payback; acquisition spend and new customers give the planned CAC';
grant select, insert, update, delete on public.segment_budgets to authenticated;
grant all on public.segment_budgets to service_role;
alter table public.segment_budgets enable row level security;
create trigger segment_budgets_audit before insert or update on public.segment_budgets for each row execute function public.set_audit();
create policy "org read" on public.segment_budgets for select to authenticated
  using (org_id = public.current_org() and public.is_org_member(org_id));
create policy "budget insert" on public.segment_budgets for insert to authenticated
  with check (public.has_org_role(org_id,'owner') or public.has_org_role(org_id,'sales_leader'));
create policy "budget update" on public.segment_budgets for update to authenticated
  using (org_id = public.current_org() and (public.has_org_role(org_id,'owner') or public.has_org_role(org_id,'sales_leader')));
create policy "org delete owner" on public.segment_budgets for delete to authenticated
  using (org_id = public.current_org() and public.has_org_role(org_id,'owner'));