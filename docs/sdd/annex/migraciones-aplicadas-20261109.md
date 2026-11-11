# Migraciones 0081, 0082 y 0083 aplicadas en Lovable Cloud

**Fecha:** 2026-11-09. **Aplicadas por:** el coordinador, con la autorización de Fede en el chat: «aplícalas tú».
**Vía:** conector de Lovable (`query_database`) sobre el proyecto «Seller Strategy Studio» (`284b5305-…`, base Supabase activa).
Cada migración se aplicó con una comprobación antes y otra después. Todas las consultas fueron de metadatos o recuentos: no se leyó ni se modificó ninguna fila de cliente.

## Antes (solo lectura)

| Comprobación | Resultado | Lo que espera el SDD |
|---|---|---|
| `knowledge_docs.mandatory` | existe, `boolean not null default false` | existe (0081 es un no-op ahí) |
| Políticas de `knowledge_docs` | `org delete owner`, `org insert`, `org read`, `org update` (todas permisivas); RLS activo | las de 0002, sin restrictivas |
| `has_org_role` | `has_org_role(uuid, app_role)`, security definer; `app_role` incluye `owner` y `sales_leader` | firma compatible con los literales de 0081 |
| `knowledge_doc_is_binding` | no existe | no existe |
| Privilegios de tabla en `notifications` (comprobación previa 3 de NK-0070) | `anon` y `authenticated`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, **UPDATE** (los valores por defecto de Supabase) | los anota para la vuelta atrás |
| UPDATE por columna en `notifications` | `anon` y `authenticated` en las 12 columnas | idem |
| Políticas de `notifications` | `own mark read` (UPDATE), `own read` (SELECT) | sin cambios |
| `deals.source` default | `'outbound'::text` | `'outbound'::text` |
| Recuentos | `knowledge_docs` 4 (1 regla de equipo, 0 obligatorios); `deals` 0; `notifications` 0 | — |
| `drizzle.__drizzle_migrations` | 77 filas (`max id` 78) | no se toca (igual que con 0071–0073; ver NK-0085) |

## Aplicación y comprobación posterior

- **0081** (`0081_knowledge_binding_writers.sql`, NK-0095):
  - Se crean las dos políticas restrictivas `knowledge binding insert` y `knowledge binding update`. Las cuatro permisivas no cambian.
  - `knowledge_doc_is_binding(text,text,boolean)` queda `immutable` con `search_path=public`. `anon` no la puede ejecutar y `authenticated` sí.
  - La función evalúa bien:

    | Llamada | Resultado |
    |---|---|
    | (`rules`, `team`, false) | true |
    | (`company`, `team`, true) | true |
    | (`rules`, `personal`, true) | false |
    | (`company`, `team`, false) | false |

  - Siguen siendo 4 documentos.
  - Desde ahora, NK-0096 (las Reglas en los lectores de IA) está en vigor en la base.
- **0082** (`0082_notifications_read_only.sql`, NK-0070):
  - `authenticated` y `anon` ya no tienen UPDATE de tabla.
  - `authenticated` tiene UPDATE solo sobre `read_at`, y `anon` no tiene UPDATE en ninguna columna.
  - `service_role`, las políticas y las funciones `notify_job_end` y `money_notify` (security definer) no cambian.
- **0083** (`0083_deals_source_no_default.sql`, NK-0107): `deals.source` ya no tiene valor por defecto (`null`) y sigue siendo nullable.

## Vuelta atrás (no ejecutar salvo que haga falta)
```sql
-- 0083
alter table public.deals alter column source set default 'outbound';
-- 0082: restaura exactamente lo anotado arriba (Supabase dio UPDATE de tabla a los dos roles)
revoke update (read_at) on public.notifications from authenticated;
grant update on public.notifications to authenticated, anon;
-- 0081
drop policy if exists "knowledge binding update" on public.knowledge_docs;
drop policy if exists "knowledge binding insert" on public.knowledge_docs;
drop function if exists public.knowledge_doc_is_binding(text, text, boolean);
-- la columna mandatory ya existía antes: no se borra
```

## Lo que esta nota NO demuestra
- **Comportamiento en la app:**
  - que un AE no pueda crear ni editar Reglas;
  - que un Owner sí pueda;
  - que «Leer todo» funcione;
  - que un deal nuevo quede «Sin origen».

  No se creó ninguna empresa ni ningún dato de prueba en producción. Esto se comprobó en PGlite y en el walkthrough con base simulada, no aquí.
- **Registro de `drizzle`:** no se actualizó, porque las aplicaciones anteriores tampoco lo hacían. Sigue pendiente NK-0085.

## 0084 (2026-11-10)

**Vía:** conector de Lovable (`query_database`) sobre el proyecto «Seller Strategy Studio», antes del merge de PR #123. Registro del coordinador; el tracker no consultó la base.
**Qué añade:** las políticas de voz de la SDD `SDD-20261110-company-voice-and-escalation-rules.md` (CA-3, §10).

### Antes (registro del coordinador)
- Políticas de `knowledge_docs`: las 4 permisivas y 2 restrictivas «knowledge binding» (0081).
- Documentos de voz: 0.
- Secciones en uso: `company`, `methodology`, `playbooks`, `rules`.
- `has_org_role(uuid, app_role)` disponible.

### Aplicación
- Se crean dos políticas restrictivas para `authenticated`:
  - `knowledge voice insert`
  - `knowledge voice update`
- `with_check` de ambas:
  ```sql
  ((section <> 'voice') OR ((mandatory IS NOT TRUE) AND (has_org_role(org_id,'owner') OR has_org_role(org_id,'sales_leader'))))
  ```
- Los 4 documentos no cambian.

### Vuelta atrás
```sql
drop policy if exists "knowledge voice insert" on public.knowledge_docs;
drop policy if exists "knowledge voice update" on public.knowledge_docs;
```

### Lo que esta nota NO demuestra
- El comportamiento en la app de la voz (lectura por todo el equipo, edición solo por Owner o Sales Leader, bloqueo de `mandatory`). No se ha verificado en la app.

## NK-0085 · Registro `drizzle.__drizzle_migrations` (2026-11-10)

**Autorización:** Fede, «si» (2026-11-10).

**Antes:**
- El registro tenía 77 filas (max `id` 78) y la última era la de `0076_platform_admins_skip_creator`.
- Su `hash` es el sha256 del archivo SQL. Comprobado con 0072, 0075 y 0076.
- Las nueve migraciones siguientes del journal (idx 75 a 83: 0074, 0078, 0077, 0079, 0080, 0081, 0082, 0083, 0084) estaban aplicadas en la base real, comprobado objeto a objeto, pero no figuraban en el registro.

**Hecho:**
- Se insertaron 9 filas `(hash = sha256 del archivo, created_at = when del journal)` mediante el `query_database` de Lovable.
- No se tocó ninguna otra tabla.

**Después:**
- El registro tiene 86 filas, 86 hashes distintos y max `created_at` 1794484800000, que es el de la 0084.
- Hay más filas que entradas en el journal (84) porque el registro ya tenía 2 filas de más antes de este cambio. Esas filas no se han tocado.

**Vuelta atrás:** borrar las 9 filas por su `hash`.

## 0085 (2026-11-10/11)

**Qué:** índice único de reglas de equipo, para cerrar NK-0136 (dos sesiones o pestañas pueden duplicar reglas).

**Antes (pre-check en vivo):** 0 grupos duplicados por `(org_id, lower(btrim(title)))` en `section = 'rules'` y `scope = 'team'`. El índice no existía.

**Aplicado:** mediante `query_database` de Lovable, antes del merge de PR #125.

**Después (reportado por el coordinador):**
- Índice: `CREATE UNIQUE INDEX knowledge_docs_team_rule_title_uniq ON public.knowledge_docs USING btree (org_id, lower(btrim(title))) WHERE ((section = 'rules') AND (scope = 'team'))`.
- Los 4 documentos existentes no cambian.
- Fila nueva en el registro de migraciones: hash `deef5a51…`, `created_at` 1794571200000. El registro pasa a 87 filas (las 86 de la sección anterior más esta).

**Vuelta atrás:**
```sql
drop index if exists public.knowledge_docs_team_rule_title_uniq;
-- y borrar la fila del registro con hash deef5a51… (creada por esta migración)
```

**Lo que esta nota NO demuestra:**
- El comportamiento en la app (que la segunda regla con el mismo título se rechace con mensaje claro). No se ha verificado en la app.
- Los datos de «después» (índice, 4 documentos, registro) son los que reporta el coordinador; el tracker no los ha consultado en la base.
