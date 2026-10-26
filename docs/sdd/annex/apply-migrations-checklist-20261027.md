# Aplicar las migraciones 0058, 0060 y 0061 · lista de comprobación

Para quien las aplica desde Lovable (decisión de Fede, 2026-10-27: sin pasar por Dani). Las tres añaden columnas con valor por defecto, una tabla, dos funciones y disparadores. No cambian ni borran datos existentes. Están verificadas en una réplica local del catálogo real (`src/lib/migrations.pg.test.ts`, 18 pruebas), pero **no se han aplicado nunca a la base real**.

## Orden y dependencias
1. `0058_field_sources_generic.sql`: columna `icp_profiles.field_sources`, función `track_field_sources`, y sustituye el disparador de `accounts`.
2. `0060_field_edit_log.sql`: tabla `field_edit_log`, `log_field_edit`, `undo_field_edit` y cuatro disparadores. No depende de la 0058.
3. `0061_field_sources_strategy.sql`: `field_sources` en `positioning`, `messaging_pillars` y `segments`, con disparadores. **Depende de la 0058** (usa `track_field_sources`).

Se pueden volver a ejecutar sin romper nada (`IF NOT EXISTS`, `DROP ... IF EXISTS`, `CREATE OR REPLACE`).

## Numeración
Otras ramas abiertas añaden también migraciones con estos números: `0059_org_connections` o `0059_drive_connections` (conexiones) y `0060_setup_step_snoozes` (guía de estrategia). Los archivos tienen nombres distintos, así que no se pisan, pero el orden y `drizzle/migrations/meta/_journal.json` chocarán al fusionar: renumera en el orden en que se fusionen. Las tres de este PR no dependen de ninguna de esas.

## 1. Antes de aplicar (solo lectura)
Todo esto debe dar lo que se indica; si no, para.
```sql
-- 0058 no aplicada: field_sources solo existe en accounts de estas cuatro tablas
select table_name from information_schema.columns
where table_schema = 'public' and column_name = 'field_sources' and table_name in ('accounts','icp_profiles','positioning','messaging_pillars','segments');
-- esperado: solo «accounts»

-- 0060 no aplicada
select to_regclass('public.field_edit_log');           -- esperado: null

-- disparador actual de accounts
select tgname from pg_trigger where tgrelid = 'public.accounts'::regclass and not tgisinternal;
-- esperado: accounts_audit, accounts_clear_field_sources
```

## 2. Aplicar
Primero 0058, comprobar el bloque 3a; después 0060 y 0061, y comprobar 3b y 3c.

## 3. Después de aplicar (solo lectura)
```sql
-- 3a · tras la 0058
select tgname from pg_trigger where tgrelid = 'public.accounts'::regclass and not tgisinternal;
-- esperado: accounts_audit, accounts_track_field_sources (ya no accounts_clear_field_sources)
select tgname from pg_trigger where tgrelid = 'public.icp_profiles'::regclass and not tgisinternal;
-- esperado: icp_profiles_audit, icp_profiles_track_field_sources
select column_name, is_nullable, column_default from information_schema.columns
where table_schema='public' and table_name='icp_profiles' and column_name='field_sources';
-- esperado: NO, '{}'::jsonb

-- 3b · tras la 0060
select relrowsecurity from pg_class where oid = 'public.field_edit_log'::regclass;   -- esperado: true
select policyname, cmd from pg_policies where tablename = 'field_edit_log';          -- esperado: una política «org read» (SELECT)
select tgname from pg_trigger where not tgisinternal and tgname like '%_log_edit';
-- esperado: icp_profiles_log_edit, messaging_pillars_log_edit, positioning_log_edit, segments_log_edit
select has_function_privilege('anon', 'public.undo_field_edit(uuid)', 'execute');          -- esperado: false
select has_function_privilege('authenticated', 'public.undo_field_edit(uuid)', 'execute'); -- esperado: true
select grantee, string_agg(privilege_type, ',' order by privilege_type) from information_schema.table_privileges
where table_schema='public' and table_name='field_edit_log' and grantee in ('anon','authenticated') group by grantee;
-- esperado: solo authenticated con SELECT (anon, nada). Supabase da todos los permisos a una tabla nueva y la 0060 los
-- retira con REVOKE; si salen más, aplica solo esas dos líneas: revoke all on public.field_edit_log from anon, authenticated;
-- grant select on public.field_edit_log to authenticated;

-- 3c · tras la 0061
select table_name from information_schema.columns
where table_schema='public' and column_name='field_sources' and table_name in ('positioning','messaging_pillars','segments') order by 1;
-- esperado: messaging_pillars, positioning, segments
select count(*) from public.positioning where field_sources <> '{}'::jsonb;   -- esperado: 0 (ningún valor existente se lee como de una persona)
select count(*) from public.field_edit_log;                                    -- esperado: 0 justo después de aplicar
```

## 4. Prueba en la app (con una empresa de prueba, nunca con datos de clientes)
1. **Procedencia (0058):** en una cuenta, cambia el sector. Debe aparecer «Escrito por ti · Confirmado». Borra el valor: la marca desaparece.
2. **ICP:** en Estrategia → ICP, cambia los países y guarda. Debe aparecer «Confirmado» en el bloque. Sal sin guardar un cambio: debe preguntar.
3. **Registro de cambios (0060):** edita un pilar. Debe aparecer en «Cambios de las últimas 24 horas» (abajo en Estrategia). Pulsa «Deshacer»: vuelve el texto anterior.
4. **Borrado:** crea un segmento vacío y bórralo como Owner: aviso con «Deshacer» durante 15 segundos y también en el panel. Prueba con un segmento que tenga cuentas: no debe dejar borrar y debe nombrar dónde se usa. Con un usuario que no sea Owner: «Borrar» sale desactivado con el motivo.
5. **Archivar:** borra un ICP como Owner y recupéralo desde el panel.
6. **Procedencia en estrategia (0061):** edita un campo del posicionamiento y de un segmento; en posicionamiento y pilares aparece «Confirmar» por campo y por bloque.
7. **Agente:** pide «borra el pilar X». Debe llamar antes a `check_delete`, proponer la acción y ejecutarla solo al aprobarla; si no eres Owner, debe decir «Solo el Owner puede borrar.».

Si algo no coincide, anótalo con la consulta o el paso exacto y para antes de aplicar la siguiente.

## Revertir (solo si hace falta; destruye lo que se haya confirmado desde la 0061)
```sql
-- 0061
drop trigger if exists positioning_track_field_sources on public.positioning;
drop trigger if exists messaging_pillars_track_field_sources on public.messaging_pillars;
drop trigger if exists segments_track_field_sources on public.segments;
alter table public.positioning drop column if exists field_sources;
alter table public.messaging_pillars drop column if exists field_sources;
alter table public.segments drop column if exists field_sources;
-- 0060
drop trigger if exists segments_log_edit on public.segments;
drop trigger if exists icp_profiles_log_edit on public.icp_profiles;
drop trigger if exists positioning_log_edit on public.positioning;
drop trigger if exists messaging_pillars_log_edit on public.messaging_pillars;
drop function if exists public.undo_field_edit(uuid);
drop function if exists public.log_field_edit();
drop table if exists public.field_edit_log;
-- 0058: vuelve el disparador de accounts de la 0046
drop trigger if exists accounts_track_field_sources on public.accounts;
drop trigger if exists icp_profiles_track_field_sources on public.icp_profiles;
drop function if exists public.track_field_sources();
alter table public.icp_profiles drop column if exists field_sources;
create or replace function public.accounts_clear_field_sources() returns trigger language plpgsql set search_path = public as $$
declare f text;
begin
  if new.field_sources is distinct from old.field_sources then return new; end if;
  foreach f in array array['industry','size','country','notes','linkedin_url'] loop
    if (to_jsonb(new) -> f) is distinct from (to_jsonb(old) -> f) then new.field_sources := new.field_sources - f; end if;
  end loop;
  return new;
end $$;
create trigger accounts_clear_field_sources before update on public.accounts for each row execute function public.accounts_clear_field_sources();
```
Si revierte la 0058 o la 0061, el código sigue funcionando: la confirmación por campo se deja de ofrecer porque las filas no traen `field_sources`. Si revierte la 0060, «Deshacer» y el panel de cambios fallan con un mensaje, pero editar y borrar siguen funcionando.
