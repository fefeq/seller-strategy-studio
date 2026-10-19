create table public.segments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  acv_min numeric default 0, acv_max numeric,
  motion text not null default 'inside',
  cycle_days int, sdr_per_ae numeric, ae_per_se numeric,
  cac_target numeric, payback_months int, notes text default '',
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.icp_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  segment_id uuid references public.segments(id) on delete set null,
  industries text default '', company_size text default '', geography text default '', tech_stack text default '',
  growth_stage text default '', hiring_signals text default '', funding_signals text default '', adoption text default '',
  anti_icp text default '', why_fit text default '',
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.positioning (
  id uuid primary key default gen_random_uuid(),
  best_customers text default '', alternatives text default '', differentiation text default '', value text default '', trend text default '',
  target_customer text default '', need text default '', product_name text default '', category text default '', key_benefit text default '',
  competitive_alternative text default '', differentiator text default '',
  tagline text default '', one_liner text default '', short_pitch text default '', elevator_pitch text default '',
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.messaging_pillars (
  id uuid primary key default gen_random_uuid(),
  title text not null, pain text default '', message text default '', proof text default '',
  position int not null default 0,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.quotas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, period text not null, amount numeric not null default 0,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (user_id, period)
);

create table public.deal_stage_history (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  from_stage text, to_stage text not null,
  changed_at timestamptz not null default now(), changed_by uuid
);

create table public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null, partner_type text not null default 'referral',
  margin_pct numeric default 0, contact text default '', status text not null default 'active', notes text default '',
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.deal_registrations (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  account_name text not null,
  deal_id uuid references public.deals(id) on delete set null,
  status text not null default 'pending',
  expires_at date, notes text default '',
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.account_touches (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  channel text not null default 'email', occurred_at timestamptz not null default now(), notes text default '',
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

alter table public.deals add column source text default 'outbound';
alter table public.deals add column forecast_category text default 'pipeline';
alter table public.deals add column segment_id uuid references public.segments(id) on delete set null;
alter table public.deals add column partner_id uuid references public.partners(id) on delete set null;
alter table public.deals add column slip_count int not null default 0;
alter table public.deals add column closed_at timestamptz;
alter table public.accounts add column is_target boolean not null default false;
alter table public.accounts add column abm_tier text default '2';
alter table public.accounts add column segment_id uuid references public.segments(id) on delete set null;

do $$
declare t text;
begin
  foreach t in array array['segments','icp_profiles','positioning','messaging_pillars','quotas','partners','deal_registrations','account_touches'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.set_audit()', t||'_audit', t);
    execute format('create policy "read all" on public.%I for select to authenticated using (true)', t);
    execute format('create policy "delete owner only" on public.%I for delete to authenticated using (public.has_role(auth.uid(),''owner''))', t);
    if t = 'quotas' then
      execute format('create policy "leaders insert" on public.%I for insert to authenticated with check (public.has_role(auth.uid(),''owner'') or public.has_role(auth.uid(),''sales_leader''))', t);
      execute format('create policy "leaders update" on public.%I for update to authenticated using (public.has_role(auth.uid(),''owner'') or public.has_role(auth.uid(),''sales_leader''))', t);
    else
      execute format('create policy "insert auth" on public.%I for insert to authenticated with check (true)', t);
      execute format('create policy "update auth" on public.%I for update to authenticated using (true)', t);
    end if;
  end loop;
end $$;

grant select, insert on public.deal_stage_history to authenticated;
grant all on public.deal_stage_history to service_role;
alter table public.deal_stage_history enable row level security;
create policy "read all" on public.deal_stage_history for select to authenticated using (true);

create or replace function public.track_deal_changes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.deal_stage_history (deal_id, from_stage, to_stage, changed_by) values (new.id, null, new.stage, auth.uid());
    return new;
  end if;
  if new.stage is distinct from old.stage then
    insert into public.deal_stage_history (deal_id, from_stage, to_stage, changed_by) values (new.id, old.stage, new.stage, auth.uid());
    if new.stage in ('won','lost') then
      update public.deals set closed_at = now() where id = new.id and closed_at is null;
    end if;
  end if;
  return new;
end $$;
create trigger deals_track after insert or update on public.deals for each row execute function public.track_deal_changes();

create or replace function public.count_slips()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.close_date is not null and new.close_date is not null and new.close_date > old.close_date then
    new.slip_count := coalesce(old.slip_count,0) + 1;
  end if;
  return new;
end $$;
create trigger deals_slip before update on public.deals for each row execute function public.count_slips();

insert into public.deal_stage_history (deal_id, from_stage, to_stage, changed_at)
select id, null, stage, created_at from public.deals;

insert into public.segments (name, acv_min, acv_max, motion, cycle_days, sdr_per_ae, ae_per_se, cac_target, payback_months) values
('SMB', 0, 5000, 'plg', 14, null, null, 500, 6),
('Mid-market', 5000, 50000, 'inside', 60, 2.5, null, 15000, 12),
('Enterprise', 50000, 250000, 'field', 135, 2, 2.5, 100000, 24),
('Strategic', 250000, null, 'strategic', 270, 2, 2, null, null);

insert into public.positioning default values;