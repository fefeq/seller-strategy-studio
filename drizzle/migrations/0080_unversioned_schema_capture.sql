-- NOKKO · Salida de Lovable A (NK-0057, U-0), captura del esquema sin versionar.
-- Diez tablas y una función existían en la base de «Seller Strategy Studio» sin ninguna migración en el repo
-- (inventario: docs/sdd/annex/esquema-sin-versionar-20261106.md). Esta migración las versiona con la definición leída del
-- catálogo de la base real el 2026-11-08 (solo catálogo, ningún dato de filas).
--
-- Es idempotente: sobre la base actual no cambia nada (todo existe ya) y sobre una base vacía crea el esquema entero.
-- Los permisos (GRANT) no se fijan aquí: la base real da a anon, authenticated y service_role todos los privilegios por
-- defecto, y recortarlos es una decisión pendiente de Fede (anexo §6). Con RLS activado y sin políticas para anon, esa
-- concesión no da acceso por la API.

create or replace function public.is_finance_member(_org uuid) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select public.has_org_role(_org, 'owner') or public.has_org_role(_org, 'sales_leader')
$$;


create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid default public.current_org() references public.organizations(id) on delete cascade,
  kind text not null default 'note' check (kind in ('email', 'call', 'meeting', 'note', 'linkedin', 'whatsapp', 'other')),
  subject text not null default '' check (length(subject) <= 200),
  body text not null default '',
  occurred_at timestamptz not null default now(),
  account_id uuid references public.accounts(id) on delete cascade,
  person_id uuid references public.people(id) on delete set null,
  deal_id uuid references public.deals(id) on delete cascade,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists activities_account_idx on public.activities using btree (account_id, occurred_at desc);
create index if not exists activities_deal_idx on public.activities using btree (deal_id, occurred_at desc);
alter table public.activities enable row level security;
drop trigger if exists activities_audit on public.activities;
create trigger activities_audit before insert or update on public.activities for each row execute function public.set_audit();
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'activities' and policyname = 'org delete owner') then
    create policy "org delete owner" on public.activities
      for delete to authenticated
      using (org_id = public.current_org() and public.has_org_role(org_id, 'owner'));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'activities' and policyname = 'org insert') then
    create policy "org insert" on public.activities
      for insert to authenticated
      with check (public.is_org_member(org_id));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'activities' and policyname = 'org read') then
    create policy "org read" on public.activities
      for select to authenticated
      using (org_id = public.current_org() and public.is_org_member(org_id));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'activities' and policyname = 'org update') then
    create policy "org update" on public.activities
      for update to authenticated
      using (org_id = public.current_org() and public.is_org_member(org_id))
      with check (public.is_org_member(org_id));
  end if;
end $$;

create table if not exists public.deal_offers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid default public.current_org() references public.organizations(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  version integer not null default 1,
  title text not null default '' check (length(title) <= 200),
  lines jsonb not null default '[]'::jsonb,
  recurring_total numeric not null default 0,
  one_off_total numeric not null default 0,
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'rejected')),
  valid_until date,
  notes text not null default '',
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (deal_id, version)
);
alter table public.deal_offers enable row level security;
drop trigger if exists deal_offers_audit on public.deal_offers;
create trigger deal_offers_audit before insert or update on public.deal_offers for each row execute function public.set_audit();
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'deal_offers' and policyname = 'org delete owner') then
    create policy "org delete owner" on public.deal_offers
      for delete to authenticated
      using (org_id = public.current_org() and public.has_org_role(org_id, 'owner'));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'deal_offers' and policyname = 'org insert') then
    create policy "org insert" on public.deal_offers
      for insert to authenticated
      with check (public.is_org_member(org_id));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'deal_offers' and policyname = 'org read') then
    create policy "org read" on public.deal_offers
      for select to authenticated
      using (org_id = public.current_org() and public.is_org_member(org_id));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'deal_offers' and policyname = 'org update') then
    create policy "org update" on public.deal_offers
      for update to authenticated
      using (org_id = public.current_org() and public.is_org_member(org_id))
      with check (public.is_org_member(org_id));
  end if;
end $$;

create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid default public.current_org() references public.organizations(id) on delete cascade,
  name text not null check (length(btrim(name)) >= 1 and length(btrim(name)) <= 120),
  subject text not null default '',
  body text not null default '',
  stage text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.email_templates enable row level security;
drop trigger if exists email_templates_audit on public.email_templates;
create trigger email_templates_audit before insert or update on public.email_templates for each row execute function public.set_audit();
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'email_templates' and policyname = 'org delete owner') then
    create policy "org delete owner" on public.email_templates
      for delete to authenticated
      using (org_id = public.current_org() and public.has_org_role(org_id, 'owner'));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'email_templates' and policyname = 'org insert') then
    create policy "org insert" on public.email_templates
      for insert to authenticated
      with check (public.is_org_member(org_id));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'email_templates' and policyname = 'org read') then
    create policy "org read" on public.email_templates
      for select to authenticated
      using (org_id = public.current_org() and public.is_org_member(org_id));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'email_templates' and policyname = 'org update') then
    create policy "org update" on public.email_templates
      for update to authenticated
      using (org_id = public.current_org() and public.is_org_member(org_id))
      with check (public.is_org_member(org_id));
  end if;
end $$;

create table if not exists public.finance_cost_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid default public.current_org() references public.organizations(id) on delete cascade,
  name text not null check (length(btrim(name)) >= 1 and length(btrim(name)) <= 120),
  category text not null default 'other' check (category in ('people', 'marketing', 'sales', 'tools', 'infra', 'cogs', 'other')),
  amount numeric not null check (amount >= 0),
  starts_on date not null default (date_trunc('month', now()))::date,
  ends_on date,
  segment_id uuid references public.segments(id) on delete set null,
  notes text not null default '',
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);
alter table public.finance_cost_lines enable row level security;
drop trigger if exists finance_cost_lines_audit on public.finance_cost_lines;
create trigger finance_cost_lines_audit before insert or update on public.finance_cost_lines for each row execute function public.set_audit();
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'finance_cost_lines' and policyname = 'finance delete owner') then
    create policy "finance delete owner" on public.finance_cost_lines
      for delete to authenticated
      using (org_id = public.current_org() and public.has_org_role(org_id, 'owner'));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'finance_cost_lines' and policyname = 'finance insert') then
    create policy "finance insert" on public.finance_cost_lines
      for insert to authenticated
      with check ((org_id = public.current_org() and public.is_finance_member(org_id)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'finance_cost_lines' and policyname = 'finance read') then
    create policy "finance read" on public.finance_cost_lines
      for select to authenticated
      using (org_id = public.current_org() and public.is_finance_member(org_id));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'finance_cost_lines' and policyname = 'finance update') then
    create policy "finance update" on public.finance_cost_lines
      for update to authenticated
      using (org_id = public.current_org() and public.is_finance_member(org_id))
      with check (public.is_finance_member(org_id));
  end if;
end $$;

create table if not exists public.finance_invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid default public.current_org() references public.organizations(id) on delete cascade,
  number text not null default '' check (length(number) <= 60),
  account_id uuid references public.accounts(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  issued_on date not null default current_date,
  due_on date,
  amount numeric not null check (amount >= 0),
  paid_on date,
  notes text not null default '',
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.finance_invoices enable row level security;
drop trigger if exists finance_invoices_audit on public.finance_invoices;
create trigger finance_invoices_audit before insert or update on public.finance_invoices for each row execute function public.set_audit();
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'finance_invoices' and policyname = 'finance delete owner') then
    create policy "finance delete owner" on public.finance_invoices
      for delete to authenticated
      using (org_id = public.current_org() and public.has_org_role(org_id, 'owner'));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'finance_invoices' and policyname = 'finance insert') then
    create policy "finance insert" on public.finance_invoices
      for insert to authenticated
      with check ((org_id = public.current_org() and public.is_finance_member(org_id)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'finance_invoices' and policyname = 'finance read') then
    create policy "finance read" on public.finance_invoices
      for select to authenticated
      using (org_id = public.current_org() and public.is_finance_member(org_id));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'finance_invoices' and policyname = 'finance update') then
    create policy "finance update" on public.finance_invoices
      for update to authenticated
      using (org_id = public.current_org() and public.is_finance_member(org_id))
      with check (public.is_finance_member(org_id));
  end if;
end $$;

create table if not exists public.finance_months (
  id uuid primary key default gen_random_uuid(),
  org_id uuid default public.current_org() references public.organizations(id) on delete cascade,
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  revenue numeric check (revenue is null or revenue >= 0),
  costs numeric check (costs is null or costs >= 0),
  cash_end numeric,
  notes text not null default '',
  closed_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, month)
);
alter table public.finance_months enable row level security;
drop trigger if exists finance_months_audit on public.finance_months;
create trigger finance_months_audit before insert or update on public.finance_months for each row execute function public.set_audit();
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'finance_months' and policyname = 'finance delete owner') then
    create policy "finance delete owner" on public.finance_months
      for delete to authenticated
      using (org_id = public.current_org() and public.has_org_role(org_id, 'owner'));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'finance_months' and policyname = 'finance insert') then
    create policy "finance insert" on public.finance_months
      for insert to authenticated
      with check ((org_id = public.current_org() and public.is_finance_member(org_id)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'finance_months' and policyname = 'finance read') then
    create policy "finance read" on public.finance_months
      for select to authenticated
      using (org_id = public.current_org() and public.is_finance_member(org_id));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'finance_months' and policyname = 'finance update') then
    create policy "finance update" on public.finance_months
      for update to authenticated
      using (org_id = public.current_org() and public.is_finance_member(org_id))
      with check (public.is_finance_member(org_id));
  end if;
end $$;

create table if not exists public.finance_settings (
  org_id uuid primary key default public.current_org() references public.organizations(id) on delete cascade,
  opening_cash numeric not null default 0,
  cash_as_of date,
  horizon_months integer not null default 12 check (horizon_months >= 3 and horizon_months <= 36),
  annual_discount_pct numeric not null default 0 check (annual_discount_pct >= 0 and annual_discount_pct <= 90),
  include_pipeline boolean not null default true,
  plan_assumptions jsonb not null default '{}'::jsonb,
  scenario_spread_pct numeric not null default 25 check (scenario_spread_pct >= 0 and scenario_spread_pct <= 90),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.finance_settings enable row level security;
drop trigger if exists finance_settings_audit on public.finance_settings;
create trigger finance_settings_audit before insert or update on public.finance_settings for each row execute function public.set_audit();
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'finance_settings' and policyname = 'finance delete owner') then
    create policy "finance delete owner" on public.finance_settings
      for delete to authenticated
      using (org_id = public.current_org() and public.has_org_role(org_id, 'owner'));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'finance_settings' and policyname = 'finance insert') then
    create policy "finance insert" on public.finance_settings
      for insert to authenticated
      with check ((org_id = public.current_org() and public.is_finance_member(org_id)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'finance_settings' and policyname = 'finance read') then
    create policy "finance read" on public.finance_settings
      for select to authenticated
      using (org_id = public.current_org() and public.is_finance_member(org_id));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'finance_settings' and policyname = 'finance update') then
    create policy "finance update" on public.finance_settings
      for update to authenticated
      using (org_id = public.current_org() and public.is_finance_member(org_id))
      with check (public.is_finance_member(org_id));
  end if;
end $$;

create table if not exists public.forecast_snapshots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid default public.current_org() references public.organizations(id) on delete cascade,
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  assumptions jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.forecast_snapshots enable row level security;
drop trigger if exists forecast_snapshots_audit on public.forecast_snapshots;
create trigger forecast_snapshots_audit before insert or update on public.forecast_snapshots for each row execute function public.set_audit();
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'forecast_snapshots' and policyname = 'finance delete owner') then
    create policy "finance delete owner" on public.forecast_snapshots
      for delete to authenticated
      using (org_id = public.current_org() and public.has_org_role(org_id, 'owner'));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'forecast_snapshots' and policyname = 'finance insert') then
    create policy "finance insert" on public.forecast_snapshots
      for insert to authenticated
      with check ((org_id = public.current_org() and public.is_finance_member(org_id)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'forecast_snapshots' and policyname = 'finance read') then
    create policy "finance read" on public.forecast_snapshots
      for select to authenticated
      using (org_id = public.current_org() and public.is_finance_member(org_id));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'forecast_snapshots' and policyname = 'finance update') then
    create policy "finance update" on public.forecast_snapshots
      for update to authenticated
      using (org_id = public.current_org() and public.is_finance_member(org_id))
      with check (public.is_finance_member(org_id));
  end if;
end $$;

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  org_id uuid default public.current_org() references public.organizations(id) on delete cascade,
  name text not null check (length(btrim(name)) >= 1 and length(btrim(name)) <= 80),
  lead_id uuid,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.teams enable row level security;
drop trigger if exists teams_audit on public.teams;
create trigger teams_audit before insert or update on public.teams for each row execute function public.set_audit();
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'teams' and policyname = 'leaders delete') then
    create policy "leaders delete" on public.teams
      for delete to authenticated
      using (org_id = public.current_org() and public.is_finance_member(org_id));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'teams' and policyname = 'leaders insert') then
    create policy "leaders insert" on public.teams
      for insert to authenticated
      with check (public.is_finance_member(org_id));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'teams' and policyname = 'leaders update') then
    create policy "leaders update" on public.teams
      for update to authenticated
      using (org_id = public.current_org() and public.is_finance_member(org_id))
      with check (public.is_finance_member(org_id));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'teams' and policyname = 'org read') then
    create policy "org read" on public.teams
      for select to authenticated
      using (org_id = public.current_org() and public.is_org_member(org_id));
  end if;
end $$;

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid default public.current_org() references public.organizations(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, user_id)
);
alter table public.team_members enable row level security;
drop trigger if exists team_members_audit on public.team_members;
create trigger team_members_audit before insert or update on public.team_members for each row execute function public.set_audit();
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'team_members' and policyname = 'leaders delete') then
    create policy "leaders delete" on public.team_members
      for delete to authenticated
      using (org_id = public.current_org() and public.is_finance_member(org_id));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'team_members' and policyname = 'leaders insert') then
    create policy "leaders insert" on public.team_members
      for insert to authenticated
      with check (public.is_finance_member(org_id));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'team_members' and policyname = 'leaders update') then
    create policy "leaders update" on public.team_members
      for update to authenticated
      using (org_id = public.current_org() and public.is_finance_member(org_id))
      with check (public.is_finance_member(org_id));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'team_members' and policyname = 'org read') then
    create policy "org read" on public.team_members
      for select to authenticated
      using (org_id = public.current_org() and public.is_org_member(org_id));
  end if;
end $$;
