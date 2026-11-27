-- 0109: Company currency for assistant expenses.
-- Additive only: no table, column or row is dropped. Every new table has row level security.
-- The assistant still creates pending actions; record_assistant_expense is only called by the
-- server after a person confirms the action (agent confirmation flow is unchanged).

-- 1. Currency configured per organization, with who/when it changed
alter table public.organizations add column if not exists currency text;
alter table public.organizations add column if not exists currency_changed_by uuid;
alter table public.organizations add column if not exists currency_changed_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'organizations_currency_format') then
    alter table public.organizations
      add constraint organizations_currency_format check (currency is null or currency ~ '^[A-Z]{3}$') not valid;
  end if;
end $$;

-- 2. History of currency changes
create table public.org_currency_changes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  old_currency text,
  new_currency text,
  changed_by uuid,
  changed_at timestamptz not null default now()
);
create index org_currency_changes_org_idx on public.org_currency_changes (org_id);
grant select on public.org_currency_changes to authenticated;
grant all on public.org_currency_changes to service_role;
alter table public.org_currency_changes enable row level security;
create policy "org read" on public.org_currency_changes for select to authenticated
  using (org_id = public.current_org() and public.is_org_member(org_id));

-- 3. Who may change the currency: the owner (the company administrator role)
create or replace function public.can_manage_org_currency(_org uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select public.has_org_role(_org, 'owner') $$;
revoke all on function public.can_manage_org_currency(uuid) from public, anon;
grant execute on function public.can_manage_org_currency(uuid) to authenticated, service_role;

create or replace function public.guard_org_currency()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.currency is distinct from old.currency then
    if auth.uid() is not null and not public.can_manage_org_currency(new.id) then
      raise exception 'Solo el dueño de la empresa puede cambiar la moneda';
    end if;
    new.currency := upper(nullif(trim(coalesce(new.currency, '')), ''));
    if new.currency is not null and new.currency !~ '^[A-Z]{3}$' then
      raise exception 'La moneda debe tener tres letras, por ejemplo USD';
    end if;
    new.currency_changed_by := auth.uid();
    new.currency_changed_at := now();
    insert into public.org_currency_changes (org_id, old_currency, new_currency, changed_by)
      values (new.id, old.currency, new.currency, auth.uid());
  else
    -- nobody can forge who/when changed it
    new.currency_changed_by := old.currency_changed_by;
    new.currency_changed_at := old.currency_changed_at;
  end if;
  return new;
end $$;
create trigger organizations_guard_currency before update on public.organizations
  for each row execute function public.guard_org_currency();

-- 4. Assistant expenses (currency always taken from the organization)
create table public.assistant_expenses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  amount numeric not null check (amount > 0 and amount <> 'NaN'::numeric),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  description text not null default '',
  action_id text,
  idempotency_key text not null,
  needs_currency_review boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (org_id, idempotency_key)
);
create index assistant_expenses_org_idx on public.assistant_expenses (org_id);
grant select on public.assistant_expenses to authenticated;
grant all on public.assistant_expenses to service_role;
alter table public.assistant_expenses enable row level security;
create policy "org read" on public.assistant_expenses for select to authenticated
  using (org_id = public.current_org() and public.is_org_member(org_id));

create or replace function public.enforce_assistant_expense_currency()
returns trigger language plpgsql security definer set search_path = public as $$
declare org_cur text;
begin
  select currency into org_cur from public.organizations where id = new.org_id;
  if org_cur is null then
    raise exception 'La empresa no tiene moneda configurada';
  end if;
  if new.currency is distinct from org_cur then
    raise exception 'El gasto no está en la moneda de la empresa';
  end if;
  return new;
end $$;
create trigger assistant_expenses_currency before insert or update on public.assistant_expenses
  for each row execute function public.enforce_assistant_expense_currency();

-- 5. Rejected expenses: only the owner of that company sees them
create table public.assistant_expense_rejections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  idempotency_key text not null,
  amount numeric,
  received_currency text,
  expected_currency text,
  reason text not null,
  message text not null,
  seen_at timestamptz,
  created_at timestamptz not null default now(),
  unique (org_id, idempotency_key)
);
create index assistant_expense_rejections_org_idx on public.assistant_expense_rejections (org_id);
grant select on public.assistant_expense_rejections to authenticated;
grant update (seen_at) on public.assistant_expense_rejections to authenticated;
grant all on public.assistant_expense_rejections to service_role;
alter table public.assistant_expense_rejections enable row level security;
create policy "owner read" on public.assistant_expense_rejections for select to authenticated
  using (org_id = public.current_org() and public.has_org_role(org_id, 'owner'));
create policy "owner mark seen" on public.assistant_expense_rejections for update to authenticated
  using (org_id = public.current_org() and public.has_org_role(org_id, 'owner'))
  with check (org_id = public.current_org() and public.has_org_role(org_id, 'owner'));

-- 6. Single entry point for the server after confirmation. Idempotent per key.
create or replace function public.record_assistant_expense(
  _org uuid,
  _amount numeric,
  _currency text,
  _idempotency_key text,
  _description text default '',
  _action_id text default null,
  _created_by uuid default null
)
returns text language plpgsql security definer set search_path = public as $$
declare
  org_cur text;
  incoming text := upper(nullif(trim(coalesce(_currency, '')), ''));
  key text := nullif(trim(coalesce(_idempotency_key, '')), '');
  why text;
  msg text := 'Un gasto del asistente no se guardó porque no venía en la moneda de tu empresa o el monto no era válido. Revisa la acción antes de repetirla.';
begin
  if _org is null or key is null then
    raise exception 'Faltan datos del gasto';
  end if;
  if exists (select 1 from public.assistant_expenses where org_id = _org and idempotency_key = key) then
    return 'duplicate';
  end if;
  if exists (select 1 from public.assistant_expense_rejections where org_id = _org and idempotency_key = key) then
    return 'rejected';
  end if;

  select currency into org_cur from public.organizations where id = _org;

  if _amount is null or _amount = 'NaN'::numeric or _amount <= 0 then
    why := 'invalid_amount';
  elsif org_cur is null then
    why := 'missing_org_currency';
  elsif incoming is null then
    why := 'missing_currency';
  elsif incoming <> org_cur then
    why := 'currency_mismatch';
  end if;

  if why is not null then
    insert into public.assistant_expense_rejections
      (org_id, idempotency_key, amount, received_currency, expected_currency, reason, message)
      values (_org, key, _amount, incoming, org_cur, why, msg)
      on conflict (org_id, idempotency_key) do nothing;
    return 'rejected';
  end if;

  insert into public.assistant_expenses (org_id, amount, currency, description, action_id, idempotency_key, created_by)
    values (_org, _amount, org_cur, coalesce(_description, ''), _action_id, key, _created_by)
    on conflict (org_id, idempotency_key) do nothing;
  if not found then
    return 'duplicate';
  end if;
  return 'saved';
end $$;
revoke all on function public.record_assistant_expense(uuid, numeric, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.record_assistant_expense(uuid, numeric, text, text, text, text, uuid) to service_role;

-- 7. Old expenses in euros: back up, mark for review, never convert or delete.
do $$
declare
  t text;
  backup text;
  n_before bigint; n_after bigint;
  s_before numeric; s_after numeric;
  eur_n bigint; backup_n bigint; unmarked bigint;
begin
  for t in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public'
      and tb.table_type = 'BASE TABLE'
      and c.column_name in ('org_id', 'amount', 'currency')
      and (c.table_name ilike '%expense%' or c.table_name ilike '%spend%')
      and c.table_name not in ('assistant_expenses', 'assistant_expense_rejections')
      and c.table_name not ilike '%backup%'
    group by c.table_name
    having count(distinct c.column_name) = 3
  loop
    execute format('select count(*), coalesce(sum(amount), 0) from public.%I', t) into n_before, s_before;
    execute format('select count(*) from public.%I where upper(currency) = ''EUR''', t) into eur_n;

    backup := left(t, 40) || '_eur_backup_0109';
    execute format('create table if not exists public.%I as select * from public.%I where upper(currency) = ''EUR''', backup, t);
    execute format('alter table public.%I enable row level security', backup);
    execute format('revoke all on public.%I from anon, authenticated', backup);
    execute format('grant all on public.%I to service_role', backup);
    execute format('select count(*) from public.%I', backup) into backup_n;
    if backup_n <> eur_n then
      raise exception 'Copia incompleta de % (% de %)', t, backup_n, eur_n;
    end if;

    execute format('alter table public.%I add column if not exists needs_currency_review boolean not null default false', t);
    execute format('update public.%I set needs_currency_review = true where upper(currency) = ''EUR'' and not needs_currency_review', t);

    execute format('select count(*), coalesce(sum(amount), 0) from public.%I', t) into n_after, s_after;
    if n_after <> n_before or s_after <> s_before then
      raise exception 'Los gastos de % cambiaron al marcarlos (% / %)', t, n_before, n_after;
    end if;
    execute format('select count(*) from public.%I where upper(currency) = ''EUR'' and not needs_currency_review', t) into unmarked;
    if unmarked > 0 then
      raise exception 'Quedaron % gastos en euros sin marcar en %', unmarked, t;
    end if;
    raise notice 'Tabla %: % registros, % en euros marcados para revisar', t, n_after, eur_n;
  end loop;
end $$;
