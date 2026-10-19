create table public.gtm_advisories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid default public.current_org() references public.organizations(id) on delete cascade,
  goal text not null,
  horizon text not null default 'quarter',
  result jsonb not null default '{}'::jsonb,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.gtm_advisories to authenticated;
grant all on public.gtm_advisories to service_role;
alter table public.gtm_advisories enable row level security;
create index gtm_advisories_org_idx on public.gtm_advisories (org_id, created_at desc);
create trigger gtm_advisories_audit before insert or update on public.gtm_advisories for each row execute function public.set_audit();
create policy "leaders read" on public.gtm_advisories for select to authenticated
  using (org_id = public.current_org() and (public.has_org_role(org_id, 'owner') or public.has_org_role(org_id, 'sales_leader')));
create policy "leaders insert" on public.gtm_advisories for insert to authenticated
  with check (public.has_org_role(org_id, 'owner') or public.has_org_role(org_id, 'sales_leader'));
create policy "org delete owner" on public.gtm_advisories for delete to authenticated
  using (org_id = public.current_org() and public.has_org_role(org_id, 'owner'));