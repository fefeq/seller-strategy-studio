alter table public.background_jobs drop constraint if exists background_jobs_kind_check;
alter table public.background_jobs add constraint background_jobs_kind_check check (kind in (
  'battlecard', 'stakeholder_research', 'account_signals', 'drive_import', 'complete_account',
  'key_people', 'icp_companies', 'qualify_leads',
  'discover', 'autopilot_now', 'weekly_report', 'posthog_sync', 'playbook_library',
  'debate', 'draft_artifact', 'deep_review', 'account_research', 'drive_summaries'
));
alter table public.background_jobs drop constraint if exists background_jobs_status_check;
alter table public.background_jobs add constraint background_jobs_status_check check (status in ('queued', 'running', 'done', 'failed', 'cancelled'));
alter table public.background_jobs add column if not exists cancel_requested boolean not null default false;
alter table public.background_jobs add column if not exists retry_of uuid references public.background_jobs(id) on delete set null;

alter table public.notifications add column if not exists telegram_sent_at timestamptz;

-- How each person wants to hear about finished work outside the app (the app itself always shows everything).
create table public.notification_prefs (
  user_id uuid primary key,
  telegram text not null default 'important' check (telegram in ('all', 'important', 'decisions', 'off')),
  quiet_from smallint not null default 22 check (quiet_from between 0 and 23),
  quiet_to smallint not null default 8 check (quiet_to between 0 and 23),
  timezone text not null default 'Europe/Madrid' check (length(timezone) <= 60),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.notification_prefs to authenticated;
grant all on public.notification_prefs to service_role;
alter table public.notification_prefs enable row level security;
create policy "own prefs read" on public.notification_prefs for select to authenticated using (user_id = auth.uid());
create policy "own prefs insert" on public.notification_prefs for insert to authenticated with check (user_id = auth.uid());
create policy "own prefs update" on public.notification_prefs for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());