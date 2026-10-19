-- 1. Organizations & membership
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid,
  created_at timestamptz not null default now()
);
create table public.org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  role public.app_role not null default 'ae',
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);
create table public.org_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role public.app_role not null default 'ae',
  invited_by uuid,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index org_invites_pending_uniq on public.org_invites (org_id, lower(email)) where accepted_at is null;

alter table public.profiles add column current_org_id uuid references public.organizations(id) on delete set null;

grant select, update on public.organizations to authenticated;
grant select, insert, update, delete on public.org_members to authenticated;
grant select, insert, delete on public.org_invites to authenticated;
grant all on public.organizations, public.org_members, public.org_invites to service_role;
alter table public.organizations enable row level security;
alter table public.org_members enable row level security;
alter table public.org_invites enable row level security;

-- 2. Helpers
create or replace function public.current_org()
returns uuid language sql stable security definer set search_path = public
as $$ select current_org_id from public.profiles where id = auth.uid() $$;

create or replace function public.is_org_member(_org uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.org_members where org_id = _org and user_id = auth.uid()) $$;

create or replace function public.has_org_role(_org uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.org_members where org_id = _org and user_id = auth.uid() and role = _role) $$;

create or replace function public.shares_org(_user uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.org_members a join public.org_members b on a.org_id = b.org_id where a.user_id = auth.uid() and b.user_id = _user) $$;

create policy "orgs read" on public.organizations for select to authenticated using (public.is_org_member(id));
create policy "orgs update" on public.organizations for update to authenticated using (public.has_org_role(id, 'owner'));
create policy "members read" on public.org_members for select to authenticated using (user_id = auth.uid() or public.is_org_member(org_id));
create policy "members insert" on public.org_members for insert to authenticated with check (public.has_org_role(org_id, 'owner'));
create policy "members update" on public.org_members for update to authenticated using (public.has_org_role(org_id, 'owner'));
create policy "members delete" on public.org_members for delete to authenticated using (public.has_org_role(org_id, 'owner') and user_id <> auth.uid());
create policy "invites read" on public.org_invites for select to authenticated using (public.is_org_member(org_id) or lower(email) = lower(auth.jwt() ->> 'email'));
create policy "invites insert" on public.org_invites for insert to authenticated with check (public.has_org_role(org_id, 'owner'));
create policy "invites delete" on public.org_invites for delete to authenticated using (public.has_org_role(org_id, 'owner'));

drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select to authenticated using (id = auth.uid() or public.shares_org(id));

-- profile can only point to orgs the user belongs to
create or replace function public.guard_current_org()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.current_org_id is not null and not exists (select 1 from public.org_members where org_id = new.current_org_id and user_id = new.id) then
    raise exception 'No perteneces a esa empresa';
  end if;
  return new;
end $$;
create trigger profiles_guard_org before update of current_org_id on public.profiles for each row execute function public.guard_current_org();

-- 3. Backfill existing data into a default organization
do $$
declare default_org uuid;
begin
  if exists (select 1 from public.profiles) then
    insert into public.organizations (name) values ('Mi empresa') returning id into default_org;
    insert into public.org_members (org_id, user_id, role)
      select default_org, p.id, coalesce((select r.role from public.user_roles r where r.user_id = p.id order by (r.role = 'owner') desc limit 1), 'ae')
      from public.profiles p;
    update public.profiles set current_org_id = default_org;
  end if;
  perform set_config('app.default_org', coalesce(default_org::text, ''), true);
end $$;

-- 4. org_id on every tenant table
do $$
declare t text; d text := current_setting('app.default_org', true);
begin
  foreach t in array array['knowledge_docs','accounts','account_plans','stakeholders','deals','meetings','mutual_action_items','people','campaigns','campaign_results','calls','approvals','integrations','segments','icp_profiles','positioning','messaging_pillars','quotas','deal_stage_history','partners','deal_registrations','account_touches'] loop
    execute format('alter table public.%I add column org_id uuid references public.organizations(id) on delete cascade', t);
    if d is not null and d <> '' then
      execute format('update public.%I set org_id = %L::uuid', t, d);
    end if;
    execute format('alter table public.%I alter column org_id set default public.current_org()', t);
    execute format('create index %I on public.%I (org_id)', t || '_org_idx', t);
    execute format('drop policy if exists "read all" on public.%I', t);
    execute format('drop policy if exists "insert auth" on public.%I', t);
    execute format('drop policy if exists "update auth" on public.%I', t);
    execute format('drop policy if exists "delete owner only" on public.%I', t);
    execute format('drop policy if exists "leaders insert" on public.%I', t);
    execute format('drop policy if exists "leaders update" on public.%I', t);
  end loop;
end $$;

drop policy if exists "docs read" on public.knowledge_docs;
drop policy if exists "docs insert" on public.knowledge_docs;
drop policy if exists "docs update" on public.knowledge_docs;

do $$
declare t text;
begin
  foreach t in array array['accounts','account_plans','stakeholders','deals','meetings','mutual_action_items','people','campaigns','campaign_results','calls','approvals','integrations','segments','icp_profiles','positioning','messaging_pillars','partners','deal_registrations','account_touches'] loop
    execute format('create policy "org read" on public.%I for select to authenticated using (org_id = public.current_org() and public.is_org_member(org_id))', t);
    execute format('create policy "org insert" on public.%I for insert to authenticated with check (public.is_org_member(org_id))', t);
    execute format('create policy "org update" on public.%I for update to authenticated using (org_id = public.current_org() and public.is_org_member(org_id)) with check (public.is_org_member(org_id))', t);
    execute format('create policy "org delete owner" on public.%I for delete to authenticated using (org_id = public.current_org() and public.has_org_role(org_id, ''owner''))', t);
  end loop;
end $$;

create policy "org read" on public.knowledge_docs for select to authenticated using (org_id = public.current_org() and public.is_org_member(org_id) and (scope = 'team' or created_by = auth.uid()));
create policy "org insert" on public.knowledge_docs for insert to authenticated with check (public.is_org_member(org_id));
create policy "org update" on public.knowledge_docs for update to authenticated using (org_id = public.current_org() and public.is_org_member(org_id) and (scope = 'team' or created_by = auth.uid())) with check (public.is_org_member(org_id));
create policy "org delete owner" on public.knowledge_docs for delete to authenticated using (org_id = public.current_org() and public.has_org_role(org_id, 'owner'));

create policy "org read" on public.quotas for select to authenticated using (org_id = public.current_org() and public.is_org_member(org_id));
create policy "leaders insert" on public.quotas for insert to authenticated with check (public.has_org_role(org_id, 'owner') or public.has_org_role(org_id, 'sales_leader'));
create policy "leaders update" on public.quotas for update to authenticated using (org_id = public.current_org() and (public.has_org_role(org_id, 'owner') or public.has_org_role(org_id, 'sales_leader')));
create policy "org delete owner" on public.quotas for delete to authenticated using (org_id = public.current_org() and public.has_org_role(org_id, 'owner'));

create policy "org read" on public.deal_stage_history for select to authenticated using (org_id = public.current_org() and public.is_org_member(org_id));

-- 5. Per-tenant uniqueness
alter table public.integrations drop constraint if exists integrations_name_key;
create unique index integrations_org_name_uniq on public.integrations (org_id, name);
alter table public.quotas drop constraint if exists quotas_user_id_period_key;
create unique index quotas_org_user_period_uniq on public.quotas (org_id, user_id, period);
drop index if exists public.people_email_uniq;
drop index if exists public.people_linkedin_uniq;
create unique index people_org_email_uniq on public.people (org_id, lower(email)) where email is not null and email <> '';
create unique index people_org_linkedin_uniq on public.people (org_id, lower(rtrim(regexp_replace(linkedin_url,'^https?://(www\.)?',''),'/'))) where linkedin_url is not null and linkedin_url <> '';

-- 6. Triggers aware of org
create or replace function public.set_audit()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.org_id := coalesce(new.org_id, public.current_org());
    if new.org_id is null then
      raise exception 'Selecciona una empresa antes de crear datos';
    end if;
  end if;
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  new.updated_at := now();
  return new;
end $$;

create or replace function public.track_deal_changes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.deal_stage_history (deal_id, from_stage, to_stage, changed_by, org_id) values (new.id, null, new.stage, auth.uid(), new.org_id);
    return new;
  end if;
  if new.stage is distinct from old.stage then
    insert into public.deal_stage_history (deal_id, from_stage, to_stage, changed_by, org_id) values (new.id, old.stage, new.stage, auth.uid(), new.org_id);
    if new.stage in ('won','lost') then
      update public.deals set closed_at = now() where id = new.id and closed_at is null;
    end if;
  end if;
  return new;
end $$;

create or replace function public.guard_approval()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status <> old.status then
    if not (public.has_org_role(new.org_id,'owner') or public.has_org_role(new.org_id,'sales_leader') or public.has_org_role(new.org_id,'deal_desk')) then
      raise exception 'Solo owner, sales leader o deal desk pueden decidir aprobaciones';
    end if;
    new.decided_by := auth.uid();
  end if;
  return new;
end $$;

-- 7. Create organization (any signed-in user) with default seed
create or replace function public.create_organization(_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare o uuid; u uuid := auth.uid();
begin
  if u is null then raise exception 'No autenticado'; end if;
  if coalesce(trim(_name), '') = '' then raise exception 'Nombre requerido'; end if;
  insert into public.organizations (name, created_by) values (trim(_name), u) returning id into o;
  insert into public.org_members (org_id, user_id, role) values (o, u, 'owner');
  update public.profiles set current_org_id = o where id = u;

  insert into public.segments (org_id, name, acv_min, acv_max, motion, cycle_days, sdr_per_ae, ae_per_se, cac_target, payback_months) values
    (o, 'SMB', 0, 5000, 'plg', 14, null, null, 500, 6),
    (o, 'Mid-market', 5000, 50000, 'inside', 60, 2.5, null, 15000, 12),
    (o, 'Enterprise', 50000, 250000, 'field', 135, 2, 2.5, 100000, 24),
    (o, 'Strategic', 250000, null, 'strategic', 270, 2, 2, null, null);
  insert into public.positioning (org_id) values (o);
  insert into public.integrations (org_id, category, name, purpose) values
    (o,'Conocimiento','GitHub','Repositorio del cerebro GTM'),
    (o,'Llamadas','Fireflies','Transcripciones de llamadas'),
    (o,'Llamadas','Gong','Inteligencia conversacional'),
    (o,'CRM','Attio','CRM de personas con intención'),
    (o,'CRM','HubSpot','CRM alternativo'),
    (o,'Comunicación','Slack','Aprobaciones y alertas'),
    (o,'Email y calendario','Gmail','Emails y seguimiento'),
    (o,'Email y calendario','Google Calendar','Reuniones del Meeting Planner'),
    (o,'Enriquecimiento','Apollo','Datos de contacto'),
    (o,'Enriquecimiento','Clay','Enriquecimiento y research'),
    (o,'Enriquecimiento','LinkedIn Sales Navigator','Research de stakeholders'),
    (o,'Secuencias','Instantly','Secuencias de cold email'),
    (o,'Secuencias','Lemlist','Secuencias multicanal'),
    (o,'Firma y propuestas','DocuSign','Firma de contratos'),
    (o,'Firma y propuestas','PandaDoc','Propuestas');
  insert into public.knowledge_docs (org_id, section, title, body) values
    (o,'company','ICP','Describe aquí tu cliente ideal: industria, tamaño, cargo comprador, disparadores de compra.'),
    (o,'playbooks','Discovery', E'1. Contexto\n2. Dolor\n3. Impacto\n4. Proceso de decisión\n5. Próximos pasos'),
    (o,'methodology','MEDDPICC','Metrics, Economic buyer, Decision criteria, Decision process, Paper process, Identify pain, Champion, Competition'),
    (o,'rules','Aprobación humana','Ningún agente envía propuestas, cambia precios ni mueve deals a "Ganado" sin aprobación de una persona.');
  return o;
end $$;
revoke all on function public.create_organization(text) from public, anon;
grant execute on function public.create_organization(text) to authenticated;

-- 8. Accept pending invites for the signed-in email
create or replace function public.accept_invites()
returns int language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); e text := lower(auth.jwt() ->> 'email'); n int := 0; first_org uuid;
begin
  if u is null or e is null then return 0; end if;
  insert into public.org_members (org_id, user_id, role)
    select i.org_id, u, i.role from public.org_invites i
    where lower(i.email) = e and i.accepted_at is null
    on conflict (org_id, user_id) do nothing;
  get diagnostics n = row_count;
  select org_id into first_org from public.org_invites where lower(email) = e and accepted_at is null order by created_at limit 1;
  update public.org_invites set accepted_at = now() where lower(email) = e and accepted_at is null;
  update public.profiles set current_org_id = coalesce(current_org_id, first_org) where id = u;
  return n;
end $$;
revoke all on function public.accept_invites() from public, anon;
grant execute on function public.accept_invites() to authenticated;

-- 9. New users: profile only (roles now live per organization)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare first_org uuid;
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), new.email);
  insert into public.org_members (org_id, user_id, role)
    select org_id, new.id, role from public.org_invites where lower(email) = lower(new.email) and accepted_at is null
    on conflict (org_id, user_id) do nothing;
  select org_id into first_org from public.org_invites where lower(email) = lower(new.email) and accepted_at is null order by created_at limit 1;
  update public.org_invites set accepted_at = now() where lower(email) = lower(new.email) and accepted_at is null;
  if first_org is not null then
    update public.profiles set current_org_id = first_org where id = new.id;
  end if;
  return new;
end $$;

comment on table public.user_roles is 'DEPRECATED: roles now live per organization in org_members';