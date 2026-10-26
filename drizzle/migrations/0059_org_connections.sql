-- Connections: the accounts a company connected of its own (SDD connections-bring-your-own-account, U-1/U-2).
-- NOT VERIFIED, not applied anywhere. Holds only metadata: the visible account identifier, state, who and when.
-- There is deliberately NO credential column here: where sealed credentials live is Dani's design decision
-- (SDD question 2), so no provider can store a key or token until that table exists.
-- Members read; every write goes through server code after an Owner check (admin client), like posthog_connections.
create table public.org_connections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org() references public.organizations(id) on delete cascade,
  provider text not null check (provider ~ '^[a-z0-9_]{2,40}$'),
  status text not null default 'connected' check (status in ('connected', 'error', 'no_response')),
  account_label text not null check (length(account_label) between 1 and 120),
  account_key text not null check (length(account_key) between 1 and 120),
  connected_by uuid,
  connected_at timestamptz not null default now(),
  checked_at timestamptz,
  last_error text,
  fallback_active boolean not null default false,
  constraint org_connections_one_per_provider unique (org_id, provider)
);
create index org_connections_account on public.org_connections (provider, account_key);

revoke all on public.org_connections from anon, authenticated;
-- account_key is only for the server's cross-company check; the browser never needs it.
grant select (id, org_id, provider, status, account_label, connected_by, connected_at, checked_at, last_error, fallback_active) on public.org_connections to authenticated;
grant all on public.org_connections to service_role;
alter table public.org_connections enable row level security;
create policy "org read" on public.org_connections for select to authenticated
  using (org_id = public.current_org() and public.is_org_member(org_id));

-- Who connected, changed or disconnected each account and when (CA-10). Append-only: no update or delete grant.
create table public.org_connection_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org() references public.organizations(id) on delete cascade,
  provider text not null check (provider ~ '^[a-z0-9_]{2,40}$'),
  action text not null check (action in ('connected', 'changed', 'disconnected', 'check_failed')),
  account_label text not null default '' check (length(account_label) <= 120),
  actor uuid,
  at timestamptz not null default now()
);
create index org_connection_events_org on public.org_connection_events (org_id, at desc);

revoke all on public.org_connection_events from anon, authenticated;
grant select on public.org_connection_events to authenticated;
grant select, insert on public.org_connection_events to service_role;
alter table public.org_connection_events enable row level security;
create policy "org read" on public.org_connection_events for select to authenticated
  using (org_id = public.current_org() and public.is_org_member(org_id));
