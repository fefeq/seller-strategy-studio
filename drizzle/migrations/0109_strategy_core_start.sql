-- Strategy simple start: five core sections.
-- Additive only: backup of every strategy, approval log and server-side checks.
-- Nothing is dropped, emptied or overwritten.

-- 1. Backup of all strategies before the change
create table if not exists public.strategy_backups (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  reason text not null default '',
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists strategy_backups_org_idx on public.strategy_backups (org_id);
grant select on public.strategy_backups to authenticated;
grant all on public.strategy_backups to service_role;
alter table public.strategy_backups enable row level security;
create policy "org owner read" on public.strategy_backups for select to authenticated
  using (org_id = public.current_org() and public.has_org_role(org_id, 'owner'));

insert into public.strategy_backups (org_id, reason, snapshot)
select o.id, 'before_strategy_core_start', jsonb_build_object(
  'icp_profiles', coalesce((select jsonb_agg(to_jsonb(t)) from public.icp_profiles t where t.org_id = o.id), '[]'::jsonb),
  'segments', coalesce((select jsonb_agg(to_jsonb(t)) from public.segments t where t.org_id = o.id), '[]'::jsonb),
  'positioning', coalesce((select jsonb_agg(to_jsonb(t)) from public.positioning t where t.org_id = o.id), '[]'::jsonb),
  'messaging_pillars', coalesce((select jsonb_agg(to_jsonb(t)) from public.messaging_pillars t where t.org_id = o.id), '[]'::jsonb)
)
from public.organizations o;

-- 2. Approval log (written only through approve_strategy_core)
create table if not exists public.strategy_core_approvals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org() references public.organizations(id) on delete cascade,
  approved_by uuid not null,
  approved_at timestamptz not null default now(),
  sections jsonb not null default '[]'::jsonb
);
create index if not exists strategy_core_approvals_org_idx on public.strategy_core_approvals (org_id);
grant select on public.strategy_core_approvals to authenticated;
grant all on public.strategy_core_approvals to service_role;
alter table public.strategy_core_approvals enable row level security;
create policy "org read" on public.strategy_core_approvals for select to authenticated
  using (org_id = public.current_org() and public.is_org_member(org_id));

-- 3. Which of the five core sections are still empty (internal, not granted)
create or replace function public.strategy_core_missing_for(_org uuid)
returns text[] language sql stable security definer set search_path = public as $$
  select array_remove(array[
    case when exists (select 1 from public.icp_profiles where org_id = _org
      and (coalesce(trim(industries), '') <> '' or coalesce(trim(why_fit), '') <> '')) then null else 'ideal_customer' end,
    case when exists (select 1 from public.segments where org_id = _org
      and coalesce(trim(name), '') <> '') then null else 'segments' end,
    case when exists (select 1 from public.positioning where org_id = _org
      and (coalesce(trim(differentiator), '') <> '' or coalesce(trim(differentiation), '') <> '')) then null else 'positioning' end,
    case when exists (select 1 from public.positioning where org_id = _org
      and (coalesce(trim(key_benefit), '') <> '' or coalesce(trim(value), '') <> '')) then null else 'value_proposition' end,
    case when exists (select 1 from public.messaging_pillars where org_id = _org
      and coalesce(trim(message), '') <> '') then null else 'messages' end
  ], null)
$$;
revoke all on function public.strategy_core_missing_for(uuid) from public, anon, authenticated;

-- 4. Public check, always for the caller's own company
create or replace function public.strategy_core_missing()
returns text[] language plpgsql stable security definer set search_path = public as $$
declare o uuid := public.current_org();
begin
  if auth.uid() is null or o is null or not public.is_org_member(o) then
    raise exception 'Elige tu empresa para ver tu estrategia.';
  end if;
  return public.strategy_core_missing_for(o);
end $$;
revoke all on function public.strategy_core_missing() from public, anon;
grant execute on function public.strategy_core_missing() to authenticated;

-- 5. Approve: role and completeness checked on the server; never touches strategy data
create or replace function public.approve_strategy_core()
returns jsonb language plpgsql security definer set search_path = public as $$
declare o uuid := public.current_org(); u uuid := auth.uid(); missing text[];
begin
  if u is null then
    raise exception 'Entra con tu usuario para aprobar la estrategia.';
  end if;
  if o is null or not public.is_org_member(o) then
    raise exception 'Elige tu empresa antes de aprobar la estrategia.';
  end if;
  if not (public.has_org_role(o, 'owner') or public.has_org_role(o, 'sales_leader')) then
    raise exception 'Solo el gerente o quien tenga ese permiso puede aprobar la estrategia.' using errcode = '42501';
  end if;
  missing := public.strategy_core_missing_for(o);
  if coalesce(cardinality(missing), 0) > 0 then
    return jsonb_build_object('approved', false, 'missing', to_jsonb(missing));
  end if;
  insert into public.strategy_core_approvals (org_id, approved_by, sections)
  values (o, u, '["ideal_customer","segments","positioning","value_proposition","messages"]'::jsonb);
  return jsonb_build_object('approved', true, 'missing', '[]'::jsonb);
end $$;
revoke all on function public.approve_strategy_core() from public, anon;
grant execute on function public.approve_strategy_core() to authenticated;
