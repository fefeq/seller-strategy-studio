-- Google Drive: each company connects its own Google account (SDD drive-per-company-account, U-1; SDD
-- connections-bring-your-own-account, U-1/U-2). One row per company; the refresh token is stored sealed by
-- server code (secret-box) and the browser never reads it (column grants only). Only the Owner connects,
-- and only server code writes after that check. Number 0058 is already used (0058_field_sources_generic, in main); this file is 0059 and its journal entry has idx 59.
create table public.drive_connections (
  org_id uuid primary key default public.current_org() references public.organizations(id) on delete cascade,
  google_email text not null check (google_email like '%@%'),
  refresh_token_enc text not null,
  status text not null default 'active' check (status in ('active', 'error', 'no_response')),
  last_error text,
  connected_by uuid,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
revoke all on public.drive_connections from anon, authenticated;
grant select (org_id, google_email, status, last_error, connected_by, connected_at, updated_at) on public.drive_connections to authenticated;
grant all on public.drive_connections to service_role;
alter table public.drive_connections enable row level security;
create policy "org read" on public.drive_connections for select to authenticated
  using (org_id = public.current_org() and public.is_org_member(org_id));

-- Who connected, changed or disconnected which account, and when (shared by every provider in Conexiones).
create table public.connection_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org() references public.organizations(id) on delete cascade,
  provider text not null check (provider ~ '^[a-z0-9_]{2,40}$'),
  action text not null check (action in ('connected', 'changed', 'disconnected', 'failed')),
  actor uuid,
  detail text not null default '',
  created_at timestamptz not null default now()
);
create index connection_events_org on public.connection_events (org_id, created_at desc);
revoke all on public.connection_events from anon, authenticated;
grant select on public.connection_events to authenticated;
grant all on public.connection_events to service_role;
alter table public.connection_events enable row level security;
create policy "org read" on public.connection_events for select to authenticated
  using (org_id = public.current_org() and public.is_org_member(org_id));
