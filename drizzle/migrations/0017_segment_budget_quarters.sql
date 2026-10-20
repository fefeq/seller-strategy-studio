create table public.segment_budget_quarters (
  id uuid primary key default gen_random_uuid(),
  org_id uuid default public.current_org() references public.organizations(id) on delete cascade,
  segment_id uuid not null references public.segments(id) on delete cascade,
  period text not null check (period ~ '^\d{4}-Q[1-4]$'),
  plan_revenue numeric check (plan_revenue >= 0),
  plan_cost_to_serve numeric check (plan_cost_to_serve >= 0),
  plan_acquisition numeric check (plan_acquisition >= 0),
  plan_new_customers integer check (plan_new_customers >= 0),
  actual_revenue numeric check (actual_revenue >= 0),
  actual_cost_to_serve numeric check (actual_cost_to_serve >= 0),
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint segment_budget_quarters_unique unique (org_id, segment_id, period)
);
comment on table public.segment_budget_quarters is 'Quarterly plan vs actual per segment; the annual budget is the sum of its 4 quarters';
grant select, insert, update, delete on public.segment_budget_quarters to authenticated;
grant all on public.segment_budget_quarters to service_role;
alter table public.segment_budget_quarters enable row level security;
create trigger segment_budget_quarters_audit before insert or update on public.segment_budget_quarters for each row execute function public.set_audit();
create policy "org read" on public.segment_budget_quarters for select to authenticated
  using (org_id = public.current_org() and public.is_org_member(org_id));
create policy "budget insert" on public.segment_budget_quarters for insert to authenticated
  with check (public.has_org_role(org_id,'owner') or public.has_org_role(org_id,'sales_leader'));
create policy "budget update" on public.segment_budget_quarters for update to authenticated
  using (org_id = public.current_org() and (public.has_org_role(org_id,'owner') or public.has_org_role(org_id,'sales_leader')));
create policy "org delete owner" on public.segment_budget_quarters for delete to authenticated
  using (org_id = public.current_org() and public.has_org_role(org_id,'owner'));
insert into public.segment_budget_quarters (org_id, segment_id, period, plan_revenue, plan_cost_to_serve, plan_acquisition, plan_new_customers, actual_revenue, actual_cost_to_serve)
select b.org_id, b.segment_id, b.year || '-Q' || q, b.plan_revenue / 4, b.plan_cost_to_serve / 4, b.plan_acquisition / 4,
  case when b.plan_new_customers is null then null else (b.plan_new_customers / 4) + case when q <= b.plan_new_customers % 4 then 1 else 0 end end,
  b.actual_revenue / 4, b.actual_cost_to_serve / 4
from public.segment_budgets b cross join generate_series(1, 4) as q;
comment on table public.segment_budgets is 'DEPRECATED: replaced by segment_budget_quarters (annual = sum of quarters)';