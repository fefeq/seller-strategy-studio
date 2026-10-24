alter table public.leads add column if not exists qualification jsonb;
alter table public.leads add column if not exists qualified_at timestamptz;
comment on column public.leads.qualification is 'Raw Jev judgments (fit, intent, authority, flags, segment); weights and proposed stage are computed in code from lead_settings.qualification';
alter table public.lead_settings add column if not exists qualification jsonb not null default '{}'::jsonb;