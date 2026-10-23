-- Inngest: new leads are enriched once in the background (enriched_at marks it), and long tasks run as
-- background jobs the person follows from the app (realtime toast when done).
alter table public.leads add column if not exists enriched_at timestamptz;

create table public.background_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org() references public.organizations(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  kind text not null check (kind in ('battlecard', 'stakeholder_research', 'account_signals', 'drive_import')),
  label text not null default '' check (length(label) <= 300),
  input jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index background_jobs_user on public.background_jobs (user_id, created_at desc);
grant select, insert on public.background_jobs to authenticated;
grant all on public.background_jobs to service_role;
alter table public.background_jobs enable row level security;
create policy "own read" on public.background_jobs for select to authenticated
  using (user_id = auth.uid() and public.is_org_member(org_id));
create policy "own insert" on public.background_jobs for insert to authenticated
  with check (user_id = auth.uid() and status = 'queued' and org_id = public.current_org() and public.is_org_member(org_id));
alter publication supabase_realtime add table public.background_jobs;