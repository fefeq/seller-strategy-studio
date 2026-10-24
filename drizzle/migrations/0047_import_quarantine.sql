alter table public.lead_sources
  add column kind text not null default 'leads' check (kind in ('leads','accounts')),
  add column mode text not null default 'direct' check (mode in ('review','direct')),
  add column max_per_request integer not null default 100 check (max_per_request between 1 and 500),
  add column daily_limit integer not null default 500 check (daily_limit between 1 and 20000),
  add column day_count integer not null default 0,
  add column day_date date,
  add column paused_reason text;

-- Direct entry writes straight into the pipeline: only owner or sales leader may switch it on.
create or replace function public.guard_lead_source_mode() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and new.mode = 'direct'
     and (tg_op = 'INSERT' or old.mode is distinct from 'direct')
     and not (public.has_org_role(new.org_id,'owner') or public.has_org_role(new.org_id,'sales_leader')) then
    raise exception 'Solo el Owner o el Sales Leader pueden activar la entrada directa';
  end if;
  return new;
end $$;
create trigger lead_sources_mode_guard before insert or update on public.lead_sources
  for each row execute function public.guard_lead_source_mode();

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org() references public.organizations(id) on delete cascade,
  lead_source_id uuid references public.lead_sources(id) on delete set null,
  kind text not null check (kind in ('leads','accounts')),
  status text not null default 'pending' check (status in ('pending','partial','approved','discarded','undone')),
  row_count integer not null default 0,
  created_count integer not null default 0,
  updated_count integer not null default 0,
  error_count integer not null default 0,
  decided_by uuid, decided_at timestamptz, undone_by uuid, undone_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
grant select, update, delete on public.import_batches to authenticated;
grant all on public.import_batches to service_role;
alter table public.import_batches enable row level security;
create policy "org read" on public.import_batches for select to authenticated
  using (org_id = public.current_org() and public.is_org_member(org_id));
create policy "leaders update" on public.import_batches for update to authenticated
  using (org_id = public.current_org() and (public.has_org_role(org_id,'owner') or public.has_org_role(org_id,'sales_leader') or public.has_org_role(org_id,'marketing')));
create policy "owner delete" on public.import_batches for delete to authenticated
  using (org_id = public.current_org() and public.has_org_role(org_id,'owner'));
create index import_batches_org_idx on public.import_batches(org_id, created_at desc);

create table public.import_rows (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org() references public.organizations(id) on delete cascade,
  batch_id uuid not null references public.import_batches(id) on delete cascade,
  line integer not null,
  raw jsonb not null default '{}'::jsonb,
  summary text not null default '',
  action text not null default 'new' check (action in ('new','update','skip')),
  reason text,
  status text not null default 'pending' check (status in ('pending','applied','discarded','error','undone')),
  result jsonb,
  error text,
  applied_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, update on public.import_rows to authenticated;
grant all on public.import_rows to service_role;
alter table public.import_rows enable row level security;
create policy "org read" on public.import_rows for select to authenticated
  using (org_id = public.current_org() and public.is_org_member(org_id));
create policy "leaders update" on public.import_rows for update to authenticated
  using (org_id = public.current_org() and (public.has_org_role(org_id,'owner') or public.has_org_role(org_id,'sales_leader') or public.has_org_role(org_id,'marketing')));
create index import_rows_batch_idx on public.import_rows(batch_id, line);