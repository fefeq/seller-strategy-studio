-- Registro de actividad del asistente: solo lo escribe la app (servidor) tras una accion confirmada.
-- Los miembros pueden leer los registros de su empresa, pero no crearlos, editarlos ni borrarlos.

create table if not exists public.assistant_activity_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  action_id uuid not null,
  action text not null check (length(trim(action)) > 0),
  confirmed_by uuid not null,
  confirmed_at timestamptz not null,
  executed_at timestamptz not null default now(),
  summary text not null default '',
  details jsonb not null default '{}'::jsonb,
  legacy_before_change boolean not null default false,
  legacy_marked_at timestamptz,
  created_at timestamptz not null default now()
);

-- Una sola fila por accion confirmada: un reintento o doble clic no duplica.
create unique index if not exists assistant_activity_log_action_uniq on public.assistant_activity_log (action_id);
create index if not exists assistant_activity_log_org_idx on public.assistant_activity_log (org_id, executed_at desc);

-- Copia de respaldo antes de poner o quitar la marca de anterior al cambio.
create table if not exists public.assistant_activity_log_backup (
  backup_id uuid primary key default gen_random_uuid(),
  backed_up_at timestamptz not null default now(),
  id uuid not null,
  org_id uuid not null,
  action_id uuid not null,
  action text not null,
  confirmed_by uuid not null,
  confirmed_at timestamptz not null,
  executed_at timestamptz not null,
  summary text not null,
  details jsonb not null,
  legacy_before_change boolean not null,
  legacy_marked_at timestamptz,
  created_at timestamptz not null
);

-- Permisos: los miembros solo leen; nadie desde la sesion escribe, copia ni importa.
revoke all on public.assistant_activity_log from public, anon, authenticated;
grant select on public.assistant_activity_log to authenticated;
grant all on public.assistant_activity_log to service_role;
alter table public.assistant_activity_log enable row level security;
create policy "org read" on public.assistant_activity_log for select to authenticated
  using (org_id = public.current_org() and public.is_org_member(org_id));
-- Sin politicas de insert, update ni delete para authenticated: quedan rechazadas.

revoke all on public.assistant_activity_log_backup from public, anon, authenticated;
grant all on public.assistant_activity_log_backup to service_role;
alter table public.assistant_activity_log_backup enable row level security;
-- Sin politicas para authenticated: solo la app accede a la copia.

-- Guarda: solo la app crea filas, y en una fila solo puede cambiar la marca de anterior al cambio.
create or replace function public.guard_assistant_activity_log()
returns trigger language plpgsql set search_path = public as $$
declare is_app boolean := coalesce(auth.role(), '') = 'service_role' or session_user in ('postgres', 'supabase_admin');
begin
  if not is_app then
    raise exception 'El registro de actividad solo lo escribe la app';
  end if;
  if tg_op = 'INSERT' then
    if new.org_id is null or new.action_id is null or new.confirmed_by is null or new.confirmed_at is null or coalesce(trim(new.action), '') = '' then
      raise exception 'Faltan datos de la accion confirmada';
    end if;
    new.legacy_marked_at := case when new.legacy_before_change then coalesce(new.legacy_marked_at, now()) else null end;
    return new;
  end if;
  if (new.id, new.org_id, new.action_id, new.action, new.confirmed_by, new.confirmed_at, new.executed_at, new.summary, new.details, new.created_at)
     is distinct from (old.id, old.org_id, old.action_id, old.action, old.confirmed_by, old.confirmed_at, old.executed_at, old.summary, old.details, old.created_at) then
    raise exception 'Los registros de actividad no se editan';
  end if;
  if new.legacy_before_change is distinct from old.legacy_before_change then
    new.legacy_marked_at := case when new.legacy_before_change then now() else null end;
  else
    new.legacy_marked_at := old.legacy_marked_at;
  end if;
  return new;
end $$;

drop trigger if exists assistant_activity_log_guard on public.assistant_activity_log;
create trigger assistant_activity_log_guard before insert or update on public.assistant_activity_log
  for each row execute function public.guard_assistant_activity_log();

-- Unica via de escritura: la llama el servidor despues de ejecutar una accion confirmada.
create or replace function public.record_assistant_activity(
  _action_id uuid,
  _org_id uuid,
  _action text,
  _confirmed_by uuid,
  _confirmed_at timestamptz,
  _summary text default '',
  _details jsonb default '{}'::jsonb
)
returns uuid language plpgsql security definer set search_path = public as $$
declare rid uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Solo la app puede registrar actividad';
  end if;
  if _action_id is null or _org_id is null or _confirmed_by is null or _confirmed_at is null or coalesce(trim(_action), '') = '' then
    raise exception 'Faltan datos de la accion confirmada';
  end if;
  if _confirmed_at > now() + interval '5 minutes' then
    raise exception 'La fecha de confirmacion no es valida';
  end if;
  if not exists (select 1 from public.org_members where org_id = _org_id and user_id = _confirmed_by) then
    raise exception 'Quien confirmo no pertenece a la empresa';
  end if;
  insert into public.assistant_activity_log (org_id, action_id, action, confirmed_by, confirmed_at, summary, details)
  values (_org_id, _action_id, trim(_action), _confirmed_by, _confirmed_at, coalesce(_summary, ''), coalesce(_details, '{}'::jsonb))
  on conflict (action_id) do nothing
  returning id into rid;
  if rid is null then
    select id into rid from public.assistant_activity_log where action_id = _action_id;
  end if;
  return rid;
end $$;
revoke all on function public.record_assistant_activity(uuid, uuid, text, uuid, timestamptz, text, jsonb) from public, anon, authenticated;
grant execute on function public.record_assistant_activity(uuid, uuid, text, uuid, timestamptz, text, jsonb) to service_role;

-- Poner o quitar la marca de anterior al cambio: solo la app, y siempre con copia previa.
create or replace function public.app_set_activity_legacy_mark(_id uuid, _legacy boolean)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Solo la app puede cambiar esta marca';
  end if;
  if _id is null or _legacy is null then
    raise exception 'Faltan datos';
  end if;
  insert into public.assistant_activity_log_backup (id, org_id, action_id, action, confirmed_by, confirmed_at, executed_at, summary, details, legacy_before_change, legacy_marked_at, created_at)
  select id, org_id, action_id, action, confirmed_by, confirmed_at, executed_at, summary, details, legacy_before_change, legacy_marked_at, created_at
  from public.assistant_activity_log where id = _id;
  if not found then
    return false;
  end if;
  update public.assistant_activity_log set legacy_before_change = _legacy where id = _id;
  return true;
end $$;
revoke all on function public.app_set_activity_legacy_mark(uuid, boolean) from public, anon, authenticated;
grant execute on function public.app_set_activity_legacy_mark(uuid, boolean) to service_role;
