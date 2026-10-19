create table public.u_journeys (
  id uuid primary key default gen_random_uuid(),
  org_id uuid default public.current_org() references public.organizations(id) on delete cascade,
  title text not null default 'Nuevo recorrido U',
  intention text not null default '',
  phase text not null default 'co_initiating' check (phase in ('co_initiating','co_sensing','presencing','co_creating','co_evolving')),
  answers jsonb not null default '{}'::jsonb,
  ai_synthesis text not null default '',
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.sensing_notes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid default public.current_org() references public.organizations(id) on delete cascade,
  journey_id uuid references public.u_journeys(id) on delete set null,
  account_id uuid references public.accounts(id) on delete set null,
  interviewee text not null default '',
  kind text not null default 'interview' check (kind in ('interview','journey','observation','customer_call')),
  occurred_on date not null default current_date,
  context text not null default '',
  heard text not null default '',
  surprised text not null default '',
  emerging text not null default '',
  listening_level smallint check (listening_level between 1 and 4),
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.case_clinics (
  id uuid primary key default gen_random_uuid(),
  org_id uuid default public.current_org() references public.organizations(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete set null,
  title text not null default 'Nuevo Case Clinic',
  held_on date not null default current_date,
  case_giver text not null default '',
  coaches text not null default '',
  situation text not null default '',
  edge text not null default '',
  help_needed text not null default '',
  mirror_image text not null default '',
  mirror_feeling text not null default '',
  mirror_gesture text not null default '',
  dialogue text not null default '',
  closing text not null default '',
  next_steps text not null default '',
  status text not null default 'open' check (status in ('open','closed')),
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.gtm_experiments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid default public.current_org() references public.organizations(id) on delete cascade,
  journey_id uuid references public.u_journeys(id) on delete set null,
  title text not null default 'Nuevo prototipo',
  hypothesis text not null default '',
  prototype text not null default '',
  audience text not null default '',
  metric text not null default '',
  target text not null default '',
  result text not null default '',
  learning text not null default '',
  status text not null default 'idea' check (status in ('idea','running','learned','adopted','discarded')),
  starts_on date, ends_on date,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

alter table public.meetings add column listening_level smallint check (listening_level between 1 and 4);
alter table public.meetings add column listening_reflection text not null default '';
alter table public.meetings add column listening_coaching text not null default '';

do $$
declare t text;
begin
  foreach t in array array['u_journeys','sensing_notes','case_clinics','gtm_experiments'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create index %I on public.%I (org_id)', t || '_org_idx', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.set_audit()', t||'_audit', t);
    execute format('create policy "org read" on public.%I for select to authenticated using (org_id = public.current_org() and public.is_org_member(org_id))', t);
    execute format('create policy "org insert" on public.%I for insert to authenticated with check (public.is_org_member(org_id))', t);
    execute format('create policy "org update" on public.%I for update to authenticated using (org_id = public.current_org() and public.is_org_member(org_id)) with check (public.is_org_member(org_id))', t);
    execute format('create policy "org delete owner" on public.%I for delete to authenticated using (org_id = public.current_org() and public.has_org_role(org_id, ''owner''))', t);
  end loop;
end $$;