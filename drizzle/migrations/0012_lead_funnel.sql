-- Leads before they become opportunities: Nuevo → Contactado → MQL → SQL → Oportunidad (deal) or Descartado.
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid default public.current_org() references public.organizations(id) on delete cascade,
  company text not null,
  contact_name text,
  email text,
  title text,
  account_id uuid references public.accounts(id) on delete set null,
  person_id uuid references public.people(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  stage text not null default 'new' check (stage in ('new','contacted','mql','sql','opportunity','disqualified')),
  source text,
  lead_source_id uuid references public.lead_sources(id) on delete set null,
  segment_id uuid references public.segments(id) on delete set null,
  owner_id uuid,
  external_id text,
  amount numeric,
  next_step text not null default '',
  next_step_at date,
  notes text not null default '',
  disqualified_reason text,
  stage_entered_at timestamptz not null default now(),
  contacted_at timestamptz,
  mql_at timestamptz,
  sql_at timestamptz,
  opportunity_at timestamptz,
  disqualified_at timestamptz,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index leads_org_stage_idx on public.leads (org_id, stage);
create index leads_org_created_idx on public.leads (org_id, created_at);
create index leads_deal_idx on public.leads (deal_id);
create unique index leads_org_external_uniq on public.leads (org_id, external_id) where external_id is not null and external_id <> '';

grant select, insert, update, delete on public.leads to authenticated;
grant all on public.leads to service_role;
alter table public.leads enable row level security;
create policy "org read" on public.leads for select to authenticated
  using (org_id = public.current_org() and public.is_org_member(org_id));
create policy "org insert" on public.leads for insert to authenticated
  with check (public.is_org_member(org_id));
create policy "org update" on public.leads for update to authenticated
  using (org_id = public.current_org() and public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy "org delete owner" on public.leads for delete to authenticated
  using (org_id = public.current_org() and public.has_org_role(org_id,'owner'));

create trigger leads_audit before insert or update on public.leads for each row execute function public.set_audit();

-- Stamps when each stage was first reached (skipped stages get the same time) and
-- turns a lead into a deal in Discovery the moment it reaches Oportunidad.
create or replace function public.lead_stage_change()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  ord text[] := array['new','contacted','mql','sql','opportunity'];
  idx int;
  t timestamptz;
begin
  if tg_op = 'INSERT' or new.stage is distinct from old.stage then
    t := case when tg_op = 'INSERT' then coalesce(new.created_at, now()) else now() end;
    new.stage_entered_at := t;
    idx := coalesce(array_position(ord, new.stage), 0);
    if idx >= 2 then new.contacted_at := coalesce(new.contacted_at, t); end if;
    if idx >= 3 then new.mql_at := coalesce(new.mql_at, t); end if;
    if idx >= 4 then new.sql_at := coalesce(new.sql_at, t); end if;
    if idx >= 5 then new.opportunity_at := coalesce(new.opportunity_at, t); end if;
    if new.stage = 'disqualified' then new.disqualified_at := t; else new.disqualified_at := null; end if;
  end if;
  if new.stage = 'opportunity' and new.deal_id is null then
    if new.account_id is null then
      insert into public.accounts (org_id, name) values (new.org_id, new.company) returning id into new.account_id;
    end if;
    insert into public.deals (org_id, account_id, name, stage, probability, amount, source, segment_id, owner_id, lead_source_id, external_id)
    values (new.org_id, new.account_id, new.company, 'discovery', 10, new.amount, coalesce(new.source, 'Entrada de leads'), new.segment_id, new.owner_id, new.lead_source_id,
      case when new.external_id is not null and not exists (select 1 from public.deals d where d.org_id = new.org_id and d.external_id = new.external_id) then new.external_id end)
    returning id into new.deal_id;
  end if;
  return new;
end $$;
create trigger leads_stage before insert or update on public.leads for each row execute function public.lead_stage_change();

-- Per-company limits (days) per stage before a lead counts as delayed.
create table public.lead_settings (
  org_id uuid primary key default public.current_org() references public.organizations(id) on delete cascade,
  sla jsonb not null default '{"new":1,"contacted":3,"mql":5,"sql":7}'::jsonb,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.lead_settings to authenticated;
grant all on public.lead_settings to service_role;
alter table public.lead_settings enable row level security;
create policy "org read" on public.lead_settings for select to authenticated
  using (org_id = public.current_org() and public.is_org_member(org_id));
create policy "leaders insert" on public.lead_settings for insert to authenticated
  with check (public.has_org_role(org_id,'owner') or public.has_org_role(org_id,'sales_leader') or public.has_org_role(org_id,'marketing'));
create policy "leaders update" on public.lead_settings for update to authenticated
  using (org_id = public.current_org() and (public.has_org_role(org_id,'owner') or public.has_org_role(org_id,'sales_leader') or public.has_org_role(org_id,'marketing')));

alter table public.lead_events add column lead_id uuid references public.leads(id) on delete set null;
alter table public.lead_sources alter column default_stage set default 'new';

-- Deals that already came in through lead intake become converted leads.
insert into public.leads (org_id, company, account_id, deal_id, stage, source, lead_source_id, segment_id, owner_id, amount, created_at)
select d.org_id, coalesce(a.name, d.name), d.account_id, d.id, 'opportunity', d.source, d.lead_source_id, d.segment_id, d.owner_id, d.amount, d.created_at
from public.deals d left join public.accounts a on a.id = d.account_id
where d.org_id is not null and (d.lead_source_id is not null or exists (select 1 from public.lead_events e where e.deal_id = d.id));

alter publication supabase_realtime add table public.leads;