-- Lead intake: per-company secret links that any tool (forms, Zapier/Make, CRM webhooks) can post to.
create table public.lead_sources (
  id uuid primary key default gen_random_uuid(),
  org_id uuid default public.current_org() references public.organizations(id) on delete cascade,
  name text not null,
  token_hash text not null unique,
  token_hint text not null default '',
  active boolean not null default true,
  default_stage text not null default 'discovery',
  received_count integer not null default 0,
  last_received_at timestamptz,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.lead_sources to authenticated;
grant all on public.lead_sources to service_role;
alter table public.lead_sources enable row level security;
create trigger lead_sources_audit before insert or update on public.lead_sources for each row execute function public.set_audit();
create policy "org read" on public.lead_sources for select to authenticated
  using (org_id = public.current_org() and public.is_org_member(org_id));
create policy "leaders insert" on public.lead_sources for insert to authenticated
  with check (public.has_org_role(org_id,'owner') or public.has_org_role(org_id,'sales_leader') or public.has_org_role(org_id,'marketing'));
create policy "leaders update" on public.lead_sources for update to authenticated
  using (org_id = public.current_org() and (public.has_org_role(org_id,'owner') or public.has_org_role(org_id,'sales_leader') or public.has_org_role(org_id,'marketing')));
create policy "org delete owner" on public.lead_sources for delete to authenticated
  using (org_id = public.current_org() and public.has_org_role(org_id,'owner'));

-- One row per received lead (link or CSV) so the team sees what came in and what failed.
create table public.lead_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid default public.current_org() references public.organizations(id) on delete cascade,
  lead_source_id uuid references public.lead_sources(id) on delete set null,
  channel text not null default 'link',
  status text not null,
  summary text not null default '',
  error text,
  account_id uuid references public.accounts(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  received_at timestamptz not null default now()
);
create index lead_events_org_idx on public.lead_events (org_id, received_at desc);
grant select, insert on public.lead_events to authenticated;
grant all on public.lead_events to service_role;
alter table public.lead_events enable row level security;
create policy "org read" on public.lead_events for select to authenticated
  using (org_id = public.current_org() and public.is_org_member(org_id));
create policy "org insert" on public.lead_events for insert to authenticated
  with check (org_id = public.current_org() and public.is_org_member(org_id));

-- Deals remember where they came from so repeated sends update instead of duplicating.
alter table public.deals add column external_id text;
alter table public.deals add column lead_source_id uuid references public.lead_sources(id) on delete set null;
create unique index deals_org_external_uniq on public.deals (org_id, external_id) where external_id is not null and external_id <> '';
create index accounts_org_domain_idx on public.accounts (org_id, lower(domain));

-- Live updates for the pipeline and the calculator.
alter publication supabase_realtime add table public.deals;
alter publication supabase_realtime add table public.lead_events;