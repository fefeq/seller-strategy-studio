alter table public.background_jobs drop constraint if exists background_jobs_kind_check;
alter table public.background_jobs add constraint background_jobs_kind_check check (kind in ('battlecard', 'stakeholder_research', 'account_signals', 'drive_import', 'complete_account'));
alter table public.background_jobs add column if not exists target_type text;
alter table public.background_jobs add column if not exists target_id uuid;
alter table public.background_jobs add column if not exists step text;
create index if not exists background_jobs_target on public.background_jobs (org_id, target_type, target_id, created_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org() references public.organizations(id) on delete cascade,
  user_id uuid not null,
  job_id uuid references public.background_jobs(id) on delete set null,
  kind text not null check (kind in ('done', 'failed', 'needs_decision', 'autopilot')),
  title text not null check (length(title) <= 300),
  body text check (length(body) <= 1000),
  link text check (length(link) <= 500),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user on public.notifications (user_id, created_at desc);
grant select, update on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "own read" on public.notifications for select to authenticated
  using (user_id = auth.uid() and public.is_org_member(org_id));
create policy "own mark read" on public.notifications for update to authenticated
  using (user_id = auth.uid() and public.is_org_member(org_id))
  with check (user_id = auth.uid());
alter publication supabase_realtime add table public.notifications;

-- Every background job that ends leaves a notice for the person who launched it.
create or replace function public.notify_job_end() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('done', 'failed') and old.status is distinct from new.status then
    insert into public.notifications (org_id, user_id, job_id, kind, title, body, link)
    values (
      new.org_id, new.user_id, new.id,
      case when new.status = 'failed' then 'failed'
           when coalesce((new.result->>'needs_decision')::boolean, false) then 'needs_decision'
           else 'done' end,
      left(case when new.status = 'failed' then new.label || ': no se ha podido terminar'
                else coalesce(new.result->>'title', new.label || ': listo') end, 300),
      left(case when new.status = 'failed' then new.error else new.result->>'body' end, 1000),
      left(new.result->>'link', 500)
    );
  end if;
  return new;
end $$;
create trigger background_jobs_notify after update on public.background_jobs
  for each row execute function public.notify_job_end();