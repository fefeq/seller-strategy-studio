-- Account assignment (roadmap Fase A, 7). The company sets rules (segment and/or country or region →
-- people), Nokko proposes who takes each account without owner balancing the load by tier, and the
-- Owner or Sales Leader approves an edited table. Approving moves the open deals and leads with the
-- account and tells each person what they received.

-- Where the account is (ISO 3166-1 alpha-2). The region (España, LatAm, EE. UU., resto de Europa) is
-- derived from it in src/lib/assignment.ts.
alter table public.accounts add column country text check (country is null or country ~ '^[A-Z]{2}$');
comment on column public.accounts.country is 'ISO 3166-1 alpha-2 country code; region derived in the app';

-- Optional maximum of accounts per person (only the Owner edits members, as for roles).
alter table public.org_members add column max_accounts integer check (max_accounts is null or max_accounts >= 0);
comment on column public.org_members.max_accounts is 'Maximum accounts this person can own; null = no limit';

create table public.account_assignment_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org() references public.organizations(id) on delete cascade,
  position integer not null default 0,
  -- A rule with a deleted segment would silently become «any account»: it goes with the segment.
  segment_id uuid references public.segments(id) on delete cascade,
  region text check (region in ('es', 'latam', 'us', 'europe', 'other')),
  country text check (country is null or country ~ '^[A-Z]{2}$'),
  members uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
comment on table public.account_assignment_rules is 'Who takes accounts of a segment and/or country or region; first rule by position wins';
create index account_assignment_rules_org on public.account_assignment_rules (org_id, position);

grant select, insert, update, delete on public.account_assignment_rules to authenticated;
grant all on public.account_assignment_rules to service_role;
alter table public.account_assignment_rules enable row level security;
create policy "org read" on public.account_assignment_rules for select to authenticated
  using (org_id = public.current_org() and public.is_org_member(org_id));
create policy "leaders insert" on public.account_assignment_rules for insert to authenticated
  with check (org_id = public.current_org() and (public.has_org_role(org_id, 'owner') or public.has_org_role(org_id, 'sales_leader')));
create policy "leaders update" on public.account_assignment_rules for update to authenticated
  using (org_id = public.current_org() and (public.has_org_role(org_id, 'owner') or public.has_org_role(org_id, 'sales_leader')));
create policy "leaders delete" on public.account_assignment_rules for delete to authenticated
  using (org_id = public.current_org() and (public.has_org_role(org_id, 'owner') or public.has_org_role(org_id, 'sales_leader')));

-- Approves an assignment in one transaction: [{account_id, user_id}, …]. Checks the caller's role,
-- that accounts and people belong to the company, that the people can own accounts and that no
-- maximum is exceeded; then sets the owner, moves the open deals (open stages of the company) and
-- open leads (Nuevo…SQL) to the new owner (closed ones stay with whoever closed them), and leaves
-- each person a suggestion «Te han asignado N cuentas» (not the approver: they know).
create or replace function public.apply_account_assignment(_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  _org uuid := public.current_org();
  _me uuid := auth.uid();
  _at timestamptz := now();
  n_acc int; n_deals int; n_leads int; bad text;
begin
  if _org is null or not (public.has_org_role(_org, 'owner') or public.has_org_role(_org, 'sales_leader')) then
    raise exception 'Solo el Owner o el Sales Leader pueden aprobar el reparto de cuentas.' using errcode = '42501';
  end if;
  if jsonb_typeof(_rows) is distinct from 'array' or jsonb_array_length(_rows) = 0 then
    raise exception 'No hay cuentas que asignar.' using errcode = '22023';
  end if;
  create temp table _assign on commit drop as
    select distinct on ((x->>'account_id')::uuid) (x->>'account_id')::uuid as account_id, (x->>'user_id')::uuid as user_id
    from jsonb_array_elements(_rows) x;
  if exists (select 1 from _assign t where not exists (select 1 from public.accounts a where a.id = t.account_id and a.org_id = _org)) then
    raise exception 'Una de las cuentas ya no existe o no es de esta empresa. Vuelve a proponer el reparto.' using errcode = '22023';
  end if;
  if exists (select 1 from _assign t where not exists (select 1 from public.org_members m where m.org_id = _org and m.user_id = t.user_id and m.role::text in ('ae', 'sdr', 'cs', 'sales_leader', 'owner'))) then
    raise exception 'Una de las personas no puede llevar cuentas en esta empresa (roles: AE, SDR, CS, Sales Leader u Owner).' using errcode = '22023';
  end if;
  -- Maximums once applied: what each person already owns (outside this assignment) plus what they get.
  select string_agg(coalesce(nullif(p.full_name, ''), p.email, 'Una persona') || ' (máximo ' || m.max_accounts || ')', ', ') into bad
  from public.org_members m
  left join public.profiles p on p.id = m.user_id
  where m.org_id = _org and m.max_accounts is not null
    and (select count(*) from public.accounts a where a.org_id = _org and a.owner_id = m.user_id and a.id not in (select account_id from _assign))
      + (select count(*) from _assign t where t.user_id = m.user_id) > m.max_accounts
    and exists (select 1 from _assign t where t.user_id = m.user_id);
  if bad is not null then
    raise exception 'El reparto supera el máximo de cuentas de: %.', bad using errcode = '22023';
  end if;

  update public.accounts a set owner_id = t.user_id from _assign t
    where a.id = t.account_id and a.org_id = _org and a.owner_id is distinct from t.user_id;
  get diagnostics n_acc = row_count;
  update public.deals d set owner_id = t.user_id from _assign t
    where d.account_id = t.account_id and d.org_id = _org and d.owner_id is distinct from t.user_id
      and d.stage in (select s.key from public.deal_stages s where s.org_id = _org and s.kind = 'open');
  get diagnostics n_deals = row_count;
  update public.leads l set owner_id = t.user_id from _assign t
    where l.account_id = t.account_id and l.org_id = _org and l.owner_id is distinct from t.user_id
      and l.stage in ('new', 'contacted', 'mql', 'sql');
  get diagnostics n_leads = row_count;

  insert into public.suggestions (org_id, user_id, detector, dedupe_key, priority, title, body, link, action, status)
  select _org, g.user_id, 'account_assigned', 'account_assigned:' || g.user_id || ':' || to_char(_at, 'YYYYMMDDHH24MISSMS'), 2,
    case when g.n = 1 then 'Te han asignado 1 cuenta' else 'Te han asignado ' || g.n || ' cuentas' end,
    g.names || case when g.n > 10 then ' y ' || (g.n - 10) || ' más' else '' end || '. Sus deals y leads abiertos pasan a ser tuyos.',
    '/accounts', null, 'pending'
  from (
    select x.user_id, count(*) as n, string_agg(x.name, ', ' order by x.name) filter (where x.rn <= 10) as names
    from (
      select t.user_id, a.name, row_number() over (partition by t.user_id order by a.name) as rn
      from _assign t join public.accounts a on a.id = t.account_id
    ) x
    group by x.user_id
  ) g
  where g.user_id is distinct from _me
  on conflict (org_id, dedupe_key) do nothing;

  return jsonb_build_object('accounts', n_acc, 'deals', n_deals, 'leads', n_leads);
end $$;
revoke all on function public.apply_account_assignment(jsonb) from public, anon;
grant execute on function public.apply_account_assignment(jsonb) to authenticated;
