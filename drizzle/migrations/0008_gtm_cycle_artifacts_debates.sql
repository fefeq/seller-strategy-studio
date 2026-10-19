create table public.gtm_artifacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid default public.current_org() references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('brief','plan','architecture','readiness','retro','winloss')),
  title text not null default '',
  version int not null default 1,
  status text not null default 'draft' check (status in ('draft','approved','archived')),
  content text not null default '',
  meta jsonb not null default '{}'::jsonb,
  persona text,
  approved_by uuid, approved_at timestamptz,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.gtm_artifacts to authenticated;
grant all on public.gtm_artifacts to service_role;
alter table public.gtm_artifacts enable row level security;
create index gtm_artifacts_org_idx on public.gtm_artifacts (org_id, kind, created_at desc);
create trigger gtm_artifacts_audit before insert or update on public.gtm_artifacts for each row execute function public.set_audit();
create policy "org read" on public.gtm_artifacts for select to authenticated
  using (org_id = public.current_org() and public.is_org_member(org_id));
create policy "org insert" on public.gtm_artifacts for insert to authenticated
  with check (public.is_org_member(org_id) and (status = 'draft' or public.has_org_role(org_id,'owner') or public.has_org_role(org_id,'sales_leader')));
create policy "org update" on public.gtm_artifacts for update to authenticated
  using (org_id = public.current_org() and public.is_org_member(org_id))
  with check (status <> 'approved' or public.has_org_role(org_id,'owner') or public.has_org_role(org_id,'sales_leader'));
create policy "org delete owner" on public.gtm_artifacts for delete to authenticated
  using (org_id = public.current_org() and public.has_org_role(org_id,'owner'));

create table public.debates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid default public.current_org() references public.organizations(id) on delete cascade,
  level text not null check (level in ('c_level','sales','marketing','partners','all')),
  topic text not null,
  subject_type text, subject_id uuid,
  participants text[] not null default '{}',
  turns jsonb not null default '[]'::jsonb,
  synthesis jsonb not null default '{}'::jsonb,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.debates to authenticated;
grant all on public.debates to service_role;
alter table public.debates enable row level security;
create index debates_org_idx on public.debates (org_id, created_at desc);
create trigger debates_audit before insert or update on public.debates for each row execute function public.set_audit();
create policy "org read" on public.debates for select to authenticated
  using (org_id = public.current_org() and public.is_org_member(org_id));
create policy "org insert" on public.debates for insert to authenticated
  with check (public.is_org_member(org_id) and (level not in ('c_level','all') or public.has_org_role(org_id,'owner') or public.has_org_role(org_id,'sales_leader')));
create policy "org delete owner" on public.debates for delete to authenticated
  using (org_id = public.current_org() and public.has_org_role(org_id,'owner'));