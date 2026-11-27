-- 0109: strategy approval with its own migration number.
-- The strategy approval previously shared a number with the expenses migration.
-- This file does NOT edit or replace any existing migration (the expenses one stays untouched).
-- Everything here is idempotent: it can run twice without duplicating or deleting approvals.
-- Before applying on real data: take a backup and restore it fully on a copy first.

-- 1. Table (only created if missing; existing rows are never touched)
create table if not exists public.strategy_approvals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  status text not null default 'approved',
  approved_by uuid,
  approved_at timestamptz not null default now(),
  sections jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.strategy_approvals add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.strategy_approvals add column if not exists status text not null default 'approved';
alter table public.strategy_approvals add column if not exists approved_by uuid;
alter table public.strategy_approvals add column if not exists approved_at timestamptz not null default now();
alter table public.strategy_approvals add column if not exists sections jsonb not null default '{}'::jsonb;
alter table public.strategy_approvals add column if not exists created_at timestamptz not null default now();
alter table public.strategy_approvals add column if not exists updated_at timestamptz not null default now();

create index if not exists strategy_approvals_org_idx on public.strategy_approvals (org_id);

grant select on public.strategy_approvals to authenticated;
grant all on public.strategy_approvals to service_role;
alter table public.strategy_approvals enable row level security;

-- Read only inside the active company. No insert/update/delete policies:
-- writes only go through approve_strategy(), which checks role and company.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'strategy_approvals' and policyname = 'org read'
  ) then
    create policy "org read" on public.strategy_approvals for select to authenticated
      using (org_id = public.current_org() and public.is_org_member(org_id));
  end if;
end $$;

-- 2. Empty text: only whitespace or placeholder text counts as empty
create or replace function public.strategy_text_is_empty(_t text)
returns boolean language sql immutable set search_path = public
as $$
  select coalesce(regexp_replace(_t, '[[:space:]]', '', 'g'), '') = ''
      or lower(btrim(regexp_replace(_t, '[[:space:]]+', ' ', 'g'))) ~ '^(describe aqu|escribe aqu|ejemplo:|texto de ejemplo|lorem ipsum|por completar|completar aqu|pendiente$|tbd$|xxx|[.]{3}$|-$)'
$$;

-- 3. First incomplete section of the company strategy (null when all five are complete)
create or replace function public.strategy_missing_section(_org uuid)
returns text language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if _org is null or not public.is_org_member(_org) then
    raise exception 'No tienes acceso a esta empresa';
  end if;

  if not exists (
    select 1 from public.icp_profiles i
    where i.org_id = _org
      and not public.strategy_text_is_empty(i.name)
      and (not public.strategy_text_is_empty(i.industries) or not public.strategy_text_is_empty(i.why_fit))
  ) then return 'Cliente ideal'; end if;

  if not exists (
    select 1 from public.segments s
    where s.org_id = _org and not public.strategy_text_is_empty(s.name)
  ) then return 'Segmentos'; end if;

  if not exists (
    select 1 from public.positioning p
    where p.org_id = _org
      and (not public.strategy_text_is_empty(p.one_liner)
        or not public.strategy_text_is_empty(p.elevator_pitch)
        or not public.strategy_text_is_empty(p.differentiation))
  ) then return 'Posicionamiento'; end if;

  if not exists (
    select 1 from public.messaging_pillars m
    where m.org_id = _org
      and not public.strategy_text_is_empty(m.title)
      and not public.strategy_text_is_empty(m.message)
  ) then return 'Mensajes'; end if;

  if not exists (
    select 1 from public.segments s
    where s.org_id = _org
      and not public.strategy_text_is_empty(s.name)
      and not public.strategy_text_is_empty(s.motion)
  ) then return 'Modelos de venta'; end if;

  return null;
end $$;
revoke all on function public.strategy_missing_section(uuid) from public, anon;
grant execute on function public.strategy_missing_section(uuid) to authenticated;

-- 4. Approve: server-side role and company check, section check, one row per company
create or replace function public.approve_strategy(_org uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  u uuid := auth.uid();
  missing text;
  existing uuid;
begin
  if u is null then raise exception 'No autenticado'; end if;
  if _org is null or not (public.has_org_role(_org, 'owner') or public.has_org_role(_org, 'sales_leader')) then
    raise exception 'Solo el gerente de esta empresa puede aprobar su estrategia';
  end if;

  missing := public.strategy_missing_section(_org);
  if missing is not null then
    raise exception 'Falta completar la sección «%» antes de aprobar', missing;
  end if;

  perform pg_advisory_xact_lock(hashtext('strategy_approval:' || _org::text));

  select id into existing from public.strategy_approvals
  where org_id = _org order by approved_at desc limit 1;

  if existing is null then
    insert into public.strategy_approvals (org_id, status, approved_by, approved_at, sections)
    values (_org, 'approved', u, now(), jsonb_build_object('complete', true))
    returning id into existing;
  else
    update public.strategy_approvals
      set status = 'approved', approved_by = u, approved_at = now(), updated_at = now(),
          sections = jsonb_build_object('complete', true)
    where id = existing;
  end if;

  return existing;
end $$;
revoke all on function public.approve_strategy(uuid) from public, anon;
grant execute on function public.approve_strategy(uuid) to authenticated;
