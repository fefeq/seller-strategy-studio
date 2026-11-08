-- NK-0030 (SDD-20261030 money-moment-notices): a notice «money» when a lead enters SQL or a deal turns won, from any write path.
-- Fixed text, one notice per person, type, company and UTC hour (dedupe_key), and a failing notice never reverts the write.

-- 1. kind admits 'money'. Only the CHECK that constrains notifications.kind alone is replaced (found by table and column, not by name, in case
-- another environment named it differently); any other CHECK that merely mentions kind is left as it is.
do $$ declare c text; begin
  for c in select conname from pg_constraint
    where conrelid = 'public.notifications'::regclass and contype = 'c'
      and conkey = array[(select attnum from pg_attribute where attrelid = 'public.notifications'::regclass and attname = 'kind')]
  loop
    execute format('alter table public.notifications drop constraint %I', c);
  end loop;
end $$;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('done', 'failed', 'needs_decision', 'autopilot', 'money'));

-- 2. one notice per (person, key); existing rows have a null key and never collide.
alter table public.notifications add column if not exists dedupe_key text;
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.notifications'::regclass and conname = 'notifications_user_dedupe_key') then
    alter table public.notifications add constraint notifications_user_dedupe_key unique (user_id, dedupe_key);
  end if;
end $$;

-- 3. the notice itself. _kind is 'lead_sql' or 'deal_won'; _at picks the hour of the key (now() by default; explicit only in tests).
-- Recipients: Owner and Sales Leader of the company plus the responsible if a member; archived companies and rows without company are ignored.
create or replace function public.money_notify(_org uuid, _kind text, _entity uuid, _owner uuid, _at timestamptz default now())
returns void language plpgsql security definer set search_path = public as $$
declare _title text; _body text; _link text;
begin
  if _org is null then return; end if;
  if _kind = 'lead_sql' then
    _title := 'Hay leads nuevos en SQL.'; _body := 'Míralos en Leads.'; _link := '/leads?vista=lista';
  elsif _kind = 'deal_won' then
    _title := 'Hay deals nuevos como Ganados.'; _body := 'Míralos en Pipeline.'; _link := '/deals';
  else
    raise exception 'money_notify: unknown kind';
  end if;
  insert into public.notifications (org_id, user_id, kind, title, body, link, dedupe_key)
  select _org, m.user_id, 'money', _title, _body, _link,
         'money:' || _kind || ':' || _org || ':' || to_char(date_trunc('hour', _at at time zone 'UTC'), 'YYYY-MM-DD"T"HH24"Z"')
  from public.org_members m
  where m.org_id = _org
    and (m.role in ('owner', 'sales_leader') or m.user_id = _owner)
    and exists (select 1 from public.organizations o where o.id = _org and o.archived_at is null)
  order by m.user_id
  on conflict (user_id, dedupe_key) do nothing;
end $$;
revoke execute on function public.money_notify(uuid, text, uuid, uuid, timestamptz) from public, anon, authenticated;

-- 4. trigger functions: security definer so a write by authenticated can reach money_notify; the block swallows any failure
-- (a failing notice never reverts the write) and warns with the SQLSTATE only, never with data of the row.
create or replace function public.money_lead_sql_trg() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    perform public.money_notify(new.org_id, 'lead_sql', new.id, new.owner_id);
  exception when others then
    raise warning 'money_lead_sql_trg failed (sqlstate %)', sqlstate;
  end;
  return null;
end $$;

-- Event date of a deal: closed_at when the row is an insert with a value or closed_at changed to a value, else now().
-- Only a close within the last 24 hours notifies.
create or replace function public.money_deal_won_trg() returns trigger
language plpgsql security definer set search_path = public as $$
declare _at timestamptz;
begin
  begin
    _at := case
      when tg_op = 'INSERT' then coalesce(new.closed_at, now())
      when new.closed_at is distinct from old.closed_at and new.closed_at is not null then new.closed_at
      else now() end;
    if _at >= now() - interval '24 hours' then
      perform public.money_notify(new.org_id, 'deal_won', new.id, new.owner_id);
    end if;
  exception when others then
    raise warning 'money_deal_won_trg failed (sqlstate %)', sqlstate;
  end;
  return null;
end $$;

drop trigger if exists money_lead_sql_ins on public.leads;
create trigger money_lead_sql_ins after insert on public.leads
  for each row when (new.stage = 'sql') execute function public.money_lead_sql_trg();
drop trigger if exists money_lead_sql_upd on public.leads;
create trigger money_lead_sql_upd after update on public.leads
  for each row when (new.stage = 'sql' and old.stage is distinct from new.stage) execute function public.money_lead_sql_trg();
drop trigger if exists money_deal_won_ins on public.deals;
create trigger money_deal_won_ins after insert on public.deals
  for each row when (new.stage = 'won') execute function public.money_deal_won_trg();
drop trigger if exists money_deal_won_upd on public.deals;
create trigger money_deal_won_upd after update on public.deals
  for each row when (new.stage = 'won' and old.stage is distinct from new.stage) execute function public.money_deal_won_trg();
