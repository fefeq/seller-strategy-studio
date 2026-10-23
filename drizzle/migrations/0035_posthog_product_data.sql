-- PostHog: each company connects its own PostHog (read-only personal key, stored encrypted by server code)
-- to bring its product data: self-service funnel (into trials) and product usage per company domain.
create table public.posthog_connections (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  host text not null default 'https://eu.posthog.com' check (host ~ '^https://[a-z0-9.-]+(:[0-9]+)?$'),
  project_id text not null check (project_id ~ '^[0-9]{1,12}$'),
  api_key_enc text not null,
  key_hint text not null default '',
  signup_event text,
  activation_event text,
  paid_event text,
  domain_property text check (domain_property is null or domain_property ~ '^[A-Za-z0-9_$]{1,80}$'),
  last_synced_at timestamptz,
  last_error text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Members read the settings (never the encrypted key); writes go only through server code after an owner check.
grant select (org_id, host, project_id, key_hint, signup_event, activation_event, paid_event, domain_property, last_synced_at, last_error, created_at, updated_at) on public.posthog_connections to authenticated;
grant all on public.posthog_connections to service_role;
alter table public.posthog_connections enable row level security;
create policy "org read" on public.posthog_connections for select to authenticated
  using (org_id = public.current_org() and public.is_org_member(org_id));

create table public.product_usage (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org() references public.organizations(id) on delete cascade,
  domain text not null check (length(domain) between 3 and 255),
  account_id uuid references public.accounts(id) on delete set null,
  active_users_7d integer not null default 0,
  active_users_prev_7d integer not null default 0,
  active_users_30d integer not null default 0,
  events_30d integer not null default 0,
  last_seen_at timestamptz,
  synced_at timestamptz not null default now(),
  constraint product_usage_unique unique (org_id, domain)
);
create index product_usage_account on public.product_usage (org_id, account_id);
grant select on public.product_usage to authenticated;
grant all on public.product_usage to service_role;
alter table public.product_usage enable row level security;
create policy "org read" on public.product_usage for select to authenticated
  using (org_id = public.current_org() and public.is_org_member(org_id));

alter table public.trials add column if not exists posthog_person_id text;
create unique index if not exists trials_posthog_person on public.trials (org_id, posthog_person_id) where posthog_person_id is not null;