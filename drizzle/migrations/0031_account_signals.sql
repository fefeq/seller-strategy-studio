-- Firecrawl: recent news and signals per account (funding, hiring, launches…), found on demand or by the
-- hourly job for ABM target accounts. accounts.signals_checked_at throttles the automatic refresh.
alter table public.accounts add column if not exists signals_checked_at timestamptz;

create table public.account_signals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org() references public.organizations(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  url text not null check (url ~ '^https?://' and length(url) <= 2000),
  title text not null check (length(title) between 1 and 500),
  summary text not null default '',
  relevance text not null default '',
  kind text not null default 'other' check (kind in ('funding', 'hiring', 'launch', 'leadership', 'partnership', 'expansion', 'results', 'risk', 'other')),
  source text not null default '',
  published_at timestamptz,
  found_at timestamptz not null default now(),
  constraint account_signals_unique unique (org_id, account_id, url)
);
create index account_signals_recent on public.account_signals (org_id, found_at desc);
grant select, insert, update, delete on public.account_signals to authenticated;
grant all on public.account_signals to service_role;
alter table public.account_signals enable row level security;
create policy "org read" on public.account_signals for select to authenticated
  using (org_id = public.current_org() and public.is_org_member(org_id));
create policy "org insert" on public.account_signals for insert to authenticated
  with check (public.is_org_member(org_id));
create policy "org update" on public.account_signals for update to authenticated
  using (org_id = public.current_org() and public.is_org_member(org_id))
  with check (public.is_org_member(org_id));
create policy "org delete owner" on public.account_signals for delete to authenticated
  using (org_id = public.current_org() and public.has_org_role(org_id, 'owner'));