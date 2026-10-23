-- Parallel: long research runs (deep account report, ICP account list). The Parallel run id is kept so a
-- run that finishes while nobody is watching is picked up later; results are written by server code.
create table public.research_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org() references public.organizations(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  kind text not null check (kind in ('account_report', 'icp_list')),
  account_id uuid references public.accounts(id) on delete cascade,
  label text not null default '' check (length(label) <= 300),
  input jsonb not null default '{}'::jsonb,
  run_id text check (run_id is null or length(run_id) <= 200),
  processor text not null default 'core',
  status text not null default 'running' check (status in ('running', 'done', 'failed')),
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index research_runs_org on public.research_runs (org_id, kind, created_at desc);
create index research_runs_account on public.research_runs (account_id, created_at desc);
grant select on public.research_runs to authenticated;
grant all on public.research_runs to service_role;
alter table public.research_runs enable row level security;
create policy "org read" on public.research_runs for select to authenticated
  using (org_id = public.current_org() and public.is_org_member(org_id));
alter publication supabase_realtime add table public.research_runs;