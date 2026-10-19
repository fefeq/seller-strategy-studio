create type public.app_role as enum ('owner','sales_leader','marketing','sdr','ae','se','cs','deal_desk','enablement');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles read" on public.profiles for select to authenticated using (true);
create policy "profiles update own" on public.profiles for update to authenticated using (auth.uid() = id);
create policy "profiles insert own" on public.profiles for insert to authenticated with check (auth.uid() = id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select, insert, update, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create policy "roles read" on public.user_roles for select to authenticated using (true);
create policy "owner manages roles ins" on public.user_roles for insert to authenticated with check (public.has_role(auth.uid(),'owner'));
create policy "owner manages roles upd" on public.user_roles for update to authenticated using (public.has_role(auth.uid(),'owner'));
create policy "owner manages roles del" on public.user_roles for delete to authenticated using (public.has_role(auth.uid(),'owner'));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), new.email);
  if not exists (select 1 from public.user_roles where role = 'owner') then
    insert into public.user_roles (user_id, role) values (new.id, 'owner');
  else
    insert into public.user_roles (user_id, role) values (new.id, 'ae');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- audit helper
create or replace function public.set_audit()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
  end if;
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  new.updated_at := now();
  return new;
end $$;

-- generic table creator via repeated DDL
create table public.knowledge_docs (
  id uuid primary key default gen_random_uuid(),
  section text not null,
  title text not null,
  body text not null default '',
  scope text not null default 'team',
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text,
  industry text,
  size text,
  tier text default 'B',
  health text default 'green',
  owner_id uuid,
  notes text default '',
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.account_plans (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null unique references public.accounts(id) on delete cascade,
  objectives text default '', current_state text default '', pains text default '',
  initiatives text default '', whitespace text default '', competitors text default '',
  risks text default '', action_plan text default '',
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.stakeholders (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  name text not null, title text default '', email text, linkedin_url text,
  buying_role text default 'influencer',
  support text default 'neutral',
  priorities text default '', research text default '',
  reports_to uuid references public.stakeholders(id) on delete set null,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.accounts(id) on delete set null,
  name text not null,
  stage text not null default 'discovery',
  amount numeric default 0,
  close_date date,
  probability int default 10,
  health text default 'green',
  owner_id uuid,
  meddpicc jsonb not null default '{}'::jsonb,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.accounts(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete set null,
  title text not null, scheduled_at timestamptz,
  objective text default '', attendees text default '', agenda text default '',
  questions text default '', objections text default '', materials text default '',
  desired_outcome text default '', notes text default '', next_steps text default '',
  ai_brief text default '',
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.mutual_action_items (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  title text not null, owner_side text default 'nosotros', due_date date, done boolean not null default false,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.people (
  id uuid primary key default gen_random_uuid(),
  full_name text not null default '',
  email text, linkedin_url text, company text, title text,
  source text default 'cold_list',
  tier text default 'B',
  sequence_stage text default 'none',
  crm_stage text default 'lead',
  account_id uuid references public.accounts(id) on delete set null,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index people_email_uniq on public.people (lower(email)) where email is not null and email <> '';
create unique index people_linkedin_uniq on public.people (lower(rtrim(regexp_replace(linkedin_url,'^https?://(www\.)?',''),'/'))) where linkedin_url is not null and linkedin_url <> '';

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null, channel text default 'email', copy text default '', list_description text default '',
  meetings_booked int not null default 0,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.campaign_results (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  result text not null default 'sent',
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (campaign_id, person_id)
);

create table public.calls (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.accounts(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete set null,
  title text not null, occurred_at timestamptz default now(),
  summary text default '', next_steps text default '',
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  kind text not null, title text not null, evidence text default '',
  status text not null default 'pending',
  decided_by uuid,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  category text not null, name text not null unique, purpose text default '',
  status text not null default 'planned',
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['knowledge_docs','accounts','account_plans','stakeholders','deals','meetings','mutual_action_items','people','campaigns','campaign_results','calls','approvals','integrations'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.set_audit()', t||'_audit', t);
    execute format('create policy "delete owner only" on public.%I for delete to authenticated using (public.has_role(auth.uid(),''owner''))', t);
    if t <> 'knowledge_docs' then
      execute format('create policy "read all" on public.%I for select to authenticated using (true)', t);
      execute format('create policy "insert auth" on public.%I for insert to authenticated with check (true)', t);
      execute format('create policy "update auth" on public.%I for update to authenticated using (true)', t);
    end if;
  end loop;
end $$;

create policy "docs read" on public.knowledge_docs for select to authenticated using (scope = 'team' or created_by = auth.uid());
create policy "docs insert" on public.knowledge_docs for insert to authenticated with check (scope = 'personal' or section <> 'skills' or public.has_role(auth.uid(),'owner') or true);
create policy "docs update" on public.knowledge_docs for update to authenticated using (scope = 'team' or created_by = auth.uid());

-- approvals: only owner/deal_desk/sales_leader can decide
create or replace function public.guard_approval()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status <> old.status then
    if not (public.has_role(auth.uid(),'owner') or public.has_role(auth.uid(),'sales_leader') or public.has_role(auth.uid(),'deal_desk')) then
      raise exception 'Solo owner, sales leader o deal desk pueden decidir aprobaciones';
    end if;
    new.decided_by := auth.uid();
  end if;
  return new;
end $$;
create trigger approvals_guard before update on public.approvals for each row execute function public.guard_approval();

insert into public.integrations (category, name, purpose) values
('Conocimiento','GitHub','Repositorio del cerebro GTM'),
('Llamadas','Fireflies','Transcripciones de llamadas'),
('Llamadas','Gong','Inteligencia conversacional'),
('CRM','Attio','CRM de personas con intención'),
('CRM','HubSpot','CRM alternativo'),
('Comunicación','Slack','Aprobaciones y alertas'),
('Email y calendario','Gmail','Emails y seguimiento'),
('Email y calendario','Google Calendar','Reuniones del Meeting Planner'),
('Enriquecimiento','Apollo','Datos de contacto'),
('Enriquecimiento','Clay','Enriquecimiento y research'),
('Enriquecimiento','LinkedIn Sales Navigator','Research de stakeholders'),
('Secuencias','Instantly','Secuencias de cold email'),
('Secuencias','Lemlist','Secuencias multicanal'),
('Firma y propuestas','DocuSign','Firma de contratos'),
('Firma y propuestas','PandaDoc','Propuestas');

insert into public.knowledge_docs (section, title, body) values
('company','ICP','Describe aquí tu cliente ideal: industria, tamaño, cargo comprador, disparadores de compra.'),
('playbooks','Discovery','1. Contexto\n2. Dolor\n3. Impacto\n4. Proceso de decisión\n5. Próximos pasos'),
('methodology','MEDDPICC','Metrics, Economic buyer, Decision criteria, Decision process, Paper process, Identify pain, Champion, Competition'),
('rules','Aprobación humana','Ningún agente envía propuestas, cambia precios ni mueve deals a "Ganado" sin aprobación de una persona.');