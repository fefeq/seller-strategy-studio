-- Finanzas (solo Owner y Sales Leader) y lo que faltaba del CRM (actividades, ofertas, plantillas, equipos).

create or replace function public.is_finance_member(_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_org_role(_org, 'owner') or public.has_org_role(_org, 'sales_leader')
$$;
grant execute on function public.is_finance_member(uuid) to authenticated;

-- Ajustes de finanzas: caja, horizonte y supuestos por plan (clave = product_id).
create table public.finance_settings (
  org_id uuid primary key default public.current_org() references public.organizations(id) on delete cascade,
  opening_cash numeric not null default 0,
  cash_as_of date,
  horizon_months integer not null default 12 check (horizon_months between 3 and 36),
  annual_discount_pct numeric not null default 0 check (annual_discount_pct between 0 and 90),
  include_pipeline boolean not null default true,
  plan_assumptions jsonb not null default '{}'::jsonb,
  scenario_spread_pct numeric not null default 25 check (scenario_spread_pct between 0 and 90),
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.finance_cost_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid default public.current_org() references public.organizations(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  category text not null default 'other' check (category in ('people','marketing','sales','tools','infra','cogs','other')),
  amount numeric not null check (amount >= 0),
  starts_on date not null default date_trunc('month', now())::date,
  ends_on date,
  segment_id uuid references public.segments(id) on delete set null,
  notes text not null default '',
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);

create table public.finance_invoices (
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
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.finance_months (
  id uuid primary key default gen_random_uuid(),
  org_id uuid default public.current_org() references public.organizations(id) on delete cascade,
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  revenue numeric check (revenue is null or revenue >= 0),
  costs numeric check (costs is null or costs >= 0),
  cash_end numeric,
  notes text not null default '',
  closed_at timestamptz,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (org_id, month)
);

create table public.forecast_snapshots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid default public.current_org() references public.organizations(id) on delete cascade,
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  assumptions jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- CRM
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid default public.current_org() references public.organizations(id) on delete cascade,
  kind text not null default 'note' check (kind in ('email','call','meeting','note','linkedin','whatsapp','other')),
  subject text not null default '' check (length(subject) <= 200),
  body text not null default '',
  occurred_at timestamptz not null default now(),
  account_id uuid references public.accounts(id) on delete cascade,
  person_id uuid references public.people(id) on delete set null,
  deal_id uuid references public.deals(id) on delete cascade,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index activities_account_idx on public.activities (account_id, occurred_at desc);
create index activities_deal_idx on public.activities (deal_id, occurred_at desc);

create table public.deal_offers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid default public.current_org() references public.organizations(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  version integer not null default 1,
  title text not null default '' check (length(title) <= 200),
  lines jsonb not null default '[]'::jsonb,
  recurring_total numeric not null default 0,
  one_off_total numeric not null default 0,
  status text not null default 'draft' check (status in ('draft','sent','accepted','rejected')),
  valid_until date,
  notes text not null default '',
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (deal_id, version)
);

create table public.email_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid default public.current_org() references public.organizations(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  subject text not null default '',
  body text not null default '',
  stage text,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  org_id uuid default public.current_org() references public.organizations(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  lead_id uuid,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid default public.current_org() references public.organizations(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (team_id, user_id)
);

-- Grants
grant select, insert, update, delete on public.finance_settings, public.finance_cost_lines, public.finance_invoices, public.finance_months, public.forecast_snapshots,
  public.activities, public.deal_offers, public.email_templates, public.teams, public.team_members to authenticated;
grant all on public.finance_settings, public.finance_cost_lines, public.finance_invoices, public.finance_months, public.forecast_snapshots,
  public.activities, public.deal_offers, public.email_templates, public.teams, public.team_members to service_role;

-- RLS
alter table public.finance_settings enable row level security;
alter table public.finance_cost_lines enable row level security;
alter table public.finance_invoices enable row level security;
alter table public.finance_months enable row level security;
alter table public.forecast_snapshots enable row level security;
alter table public.activities enable row level security;
alter table public.deal_offers enable row level security;
alter table public.email_templates enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;

do $$
declare t text;
begin
  -- Finanzas: leer y escribir solo Owner y Sales Leader de la empresa activa; borrar solo Owner.
  foreach t in array array['finance_settings','finance_cost_lines','finance_invoices','finance_months','forecast_snapshots'] loop
    execute format('create policy "finance read" on public.%I for select to authenticated using (org_id = public.current_org() and public.is_finance_member(org_id))', t);
    execute format('create policy "finance insert" on public.%I for insert to authenticated with check (org_id = public.current_org() and public.is_finance_member(org_id))', t);
    execute format('create policy "finance update" on public.%I for update to authenticated using (org_id = public.current_org() and public.is_finance_member(org_id)) with check (public.is_finance_member(org_id))', t);
    execute format('create policy "finance delete owner" on public.%I for delete to authenticated using (org_id = public.current_org() and public.has_org_role(org_id, ''owner''))', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.set_audit()', t || '_audit', t);
  end loop;
  -- CRM: cualquier miembro lee y escribe; borrar solo Owner.
  foreach t in array array['activities','deal_offers','email_templates'] loop
    execute format('create policy "org read" on public.%I for select to authenticated using (org_id = public.current_org() and public.is_org_member(org_id))', t);
    execute format('create policy "org insert" on public.%I for insert to authenticated with check (public.is_org_member(org_id))', t);
    execute format('create policy "org update" on public.%I for update to authenticated using (org_id = public.current_org() and public.is_org_member(org_id)) with check (public.is_org_member(org_id))', t);
    execute format('create policy "org delete owner" on public.%I for delete to authenticated using (org_id = public.current_org() and public.has_org_role(org_id, ''owner''))', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.set_audit()', t || '_audit', t);
  end loop;
  -- Equipos: todos los ven; los gestionan Owner y Sales Leader.
  foreach t in array array['teams','team_members'] loop
    execute format('create policy "org read" on public.%I for select to authenticated using (org_id = public.current_org() and public.is_org_member(org_id))', t);
    execute format('create policy "leaders insert" on public.%I for insert to authenticated with check (public.is_finance_member(org_id))', t);
    execute format('create policy "leaders update" on public.%I for update to authenticated using (org_id = public.current_org() and public.is_finance_member(org_id)) with check (public.is_finance_member(org_id))', t);
    execute format('create policy "leaders delete" on public.%I for delete to authenticated using (org_id = public.current_org() and public.is_finance_member(org_id))', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.set_audit()', t || '_audit', t);
  end loop;
end $$;
