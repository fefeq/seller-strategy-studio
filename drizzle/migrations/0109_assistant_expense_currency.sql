-- Gastos del asistente en la moneda de la empresa.
-- Sólo agrega: columnas nuevas en organizations, tablas nuevas con RLS y funciones.
-- No borra tablas, columnas ni datos. No cambia importes existentes.

-- 1. Monedas reconocidas (códigos de tres letras)
create or replace function public.is_known_currency(_code text)
returns boolean language sql immutable set search_path = public
as $$ select upper(coalesce(_code, '')) in (
  'COP','MXN','USD','EUR','ARS','CLP','PEN','BRL','UYU','PYG','BOB','GTQ','CRC','DOP','HNL','NIO','PAB','VES','GBP','CAD'
) $$;

-- 2. Moneda en la ficha de la empresa
alter table public.organizations add column if not exists currency text;
alter table public.organizations add column if not exists currency_set_by uuid;
alter table public.organizations add column if not exists currency_set_at timestamptz;
alter table public.organizations drop constraint if exists organizations_currency_known;
alter table public.organizations add constraint organizations_currency_known check (currency is null or public.is_known_currency(currency));

-- La moneda sólo cambia desde set_org_currency (nunca con un update directo desde el navegador)
create or replace function public.guard_org_currency()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.currency is distinct from old.currency
     or new.currency_set_by is distinct from old.currency_set_by
     or new.currency_set_at is distinct from old.currency_set_at then
    if coalesce(current_setting('app.org_currency_change', true), '') <> 'on' then
      raise exception 'La moneda de la empresa sólo se cambia desde su ajuste';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists organizations_guard_currency on public.organizations;
create trigger organizations_guard_currency before update on public.organizations for each row execute function public.guard_org_currency();

-- 3. Registro de quién cambió la moneda y cuándo
create table public.org_currency_changes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  old_currency text,
  new_currency text not null,
  had_expenses boolean not null default false,
  changed_by uuid not null,
  changed_at timestamptz not null default now()
);
create index org_currency_changes_org_idx on public.org_currency_changes (org_id);
grant select on public.org_currency_changes to authenticated;
grant all on public.org_currency_changes to service_role;
alter table public.org_currency_changes enable row level security;
create policy "org read" on public.org_currency_changes for select to authenticated using (org_id = public.current_org() and public.is_org_member(org_id));

-- 4. Gastos confirmados del asistente
create table public.assistant_expenses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org() references public.organizations(id) on delete cascade,
  action_id text not null,
  amount numeric not null check (amount > 0),
  currency text not null check (public.is_known_currency(currency)),
  description text not null default '',
  needs_review boolean not null default false,
  review_reason text not null default '',
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (org_id, action_id)
);
create index assistant_expenses_org_idx on public.assistant_expenses (org_id);
-- Solo lectura desde el navegador; se anota a través de record_assistant_expense.
grant select on public.assistant_expenses to authenticated;
grant all on public.assistant_expenses to service_role;
alter table public.assistant_expenses enable row level security;
create policy "org read" on public.assistant_expenses for select to authenticated using (org_id = public.current_org() and public.is_org_member(org_id));

-- 5. Elegir o cambiar la moneda (sólo el dueño)
create or replace function public.set_org_currency(_currency text, _confirm_with_expenses boolean default false)
returns text language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); o uuid := public.current_org(); cur text; old_cur text; has_exp boolean;
begin
  if u is null then raise exception 'No autenticado'; end if;
  if o is null or not public.is_org_member(o) then raise exception 'Selecciona una empresa primero'; end if;
  if not public.has_org_role(o, 'owner') then
    raise exception 'Sólo el dueño de la empresa puede elegir o cambiar la moneda';
  end if;
  cur := upper(trim(coalesce(_currency, '')));
  if not public.is_known_currency(cur) then raise exception 'Esa moneda no está reconocida'; end if;
  select currency into old_cur from public.organizations where id = o for update;
  if old_cur = cur then return cur; end if;
  select exists (select 1 from public.assistant_expenses where org_id = o) into has_exp;
  if old_cur is not null and has_exp and not coalesce(_confirm_with_expenses, false) then
    raise exception 'Tu empresa ya tiene gastos anotados en %. Confirma el cambio para seguir.', old_cur;
  end if;
  perform set_config('app.org_currency_change', 'on', true);
  update public.organizations set currency = cur, currency_set_by = u, currency_set_at = now() where id = o;
  perform set_config('app.org_currency_change', 'off', true);
  -- Los gastos en otra moneda quedan marcados para revisar; su importe no cambia.
  update public.assistant_expenses
    set needs_review = true, review_reason = 'Anotado en ' || currency || ' antes del cambio a ' || cur
    where org_id = o and currency <> cur and not needs_review;
  insert into public.org_currency_changes (org_id, old_currency, new_currency, had_expenses, changed_by)
    values (o, old_cur, cur, has_exp, u);
  return cur;
end $$;
revoke all on function public.set_org_currency(text, boolean) from public, anon;
grant execute on function public.set_org_currency(text, boolean) to authenticated;

-- 6. Anotar un gasto ya confirmado. La moneda sale de la ficha guardada, no del navegador.
create or replace function public.record_assistant_expense(_action_id text, _amount numeric, _currency text default null, _description text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); o uuid := public.current_org(); org_cur text; cur text; aid text; new_id uuid;
begin
  if u is null then raise exception 'No autenticado'; end if;
  if o is null or not public.is_org_member(o) then raise exception 'Selecciona una empresa antes de anotar gastos'; end if;
  aid := trim(coalesce(_action_id, ''));
  if aid = '' or length(aid) > 200 then raise exception 'Falta la marca de la acción del asistente'; end if;
  select currency into org_cur from public.organizations where id = o;
  if org_cur is null then raise exception 'Elige la moneda de tu empresa antes de anotar el primer gasto'; end if;
  if _amount is null or _amount <= 0 then raise exception 'La cifra del gasto debe ser mayor a cero'; end if;
  cur := upper(trim(coalesce(_currency, org_cur)));
  if not public.is_known_currency(cur) then raise exception 'La moneda del gasto no está reconocida'; end if;
  if cur <> org_cur then
    raise exception 'Este gasto llegó en % y tu empresa trabaja en %. No se guardó.', cur, org_cur;
  end if;
  insert into public.assistant_expenses (org_id, action_id, amount, currency, description, created_by)
    values (o, aid, _amount, cur, left(coalesce(_description, ''), 500), u)
    on conflict (org_id, action_id) do nothing
    returning id into new_id;
  if new_id is null then
    select id into new_id from public.assistant_expenses where org_id = o and action_id = aid;
  end if;
  return new_id;
end $$;
revoke all on function public.record_assistant_expense(text, numeric, text, text) from public, anon;
grant execute on function public.record_assistant_expense(text, numeric, text, text) to authenticated;

-- 7. Totales separados por moneda (nunca suma monedas distintas)
create or replace function public.assistant_expense_totals()
returns table (currency text, total numeric, expenses bigint, to_review bigint)
language sql stable security invoker set search_path = public as $$
  select e.currency, sum(e.amount), count(*), count(*) filter (where e.needs_review)
  from public.assistant_expenses e
  where e.org_id = public.current_org()
  group by e.currency
  order by e.currency
$$;
revoke all on function public.assistant_expense_totals() from public, anon;
grant execute on function public.assistant_expense_totals() to authenticated;

-- 8. Gastos viejos en euros: sólo se marcan para revisar. Cantidad e importes quedan iguales.
do $$
declare t text;
begin
  foreach t in array array['expenses','spend_entries','finance_expenses','agent_spend','agent_expenses','spend_ledger'] loop
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = t and column_name = 'currency') then
      execute format('alter table public.%I add column if not exists currency_needs_review boolean not null default false', t);
      execute format('update public.%I set currency_needs_review = true where upper(currency::text) = ''EUR'' and not currency_needs_review', t);
    end if;
  end loop;
end $$;
