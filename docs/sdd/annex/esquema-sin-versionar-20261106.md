# Anexo · Esquema real sin migración en el repo (2026-11-06)

**Para:** Salida de Lovable A (NK-0057), unidad U-0 · **Estado:** Inventario medido, **no es una migración** · **Fecha:** 2026-11-06

## 1. Qué es esto
Al comparar la base del proyecto «Seller Strategy Studio» de Lovable con `drizzle/migrations` de `main` (`a6597a0`) aparecen **10 tablas y 1 función** que existen en la base y no tiene ninguna migración del repo. El registro de migraciones de la base (`drizzle.__drizzle_migrations`) tiene **dos filas sin archivo** (ids 59 y 60, `created_at` 1792876584274 y 1792877078462, hashes `57613cc2…` y `a74745eb…`) que probablemente las crearon; es una **inferencia**, no se leyó su SQL.

Límites de la medición:
- Solo catálogo (`information_schema`, `pg_catalog`); ningún dato de filas.
- No se confirmó que ese proyecto sea el de producción.
- No se miraron secuencias, comentarios ni objetos de otros esquemas. Las vistas son 0 y el único tipo enumerado de `public` es `app_role` (versionado).
- Lo de abajo es una **transcripción del catálogo**, no un volcado. **No sirve como migración**: para generarla, usar `pg_dump --schema-only` sobre esas tablas (§5).

## 2. Función sin versionar
`public.is_finance_member(_org uuid) returns boolean`, `language sql stable security definer set search_path to 'public'`:
`select public.has_org_role(_org, 'owner') or public.has_org_role(_org, 'sales_leader')`.
Es la única función de `public` sin `CREATE FUNCTION` en el repo (las demás, `set_audit`, `has_org_role`, `is_org_member` y `current_org`, sí están versionadas). En el repo existe `accounts_clear_field_sources` y no en la base: puede estar retirada.

## 3. Tablas
Todas tienen RLS activado (sin `force`), un trigger `<tabla>_audit` `BEFORE INSERT OR UPDATE ... EXECUTE FUNCTION set_audit()`, `org_id uuid default current_org()` con FK a `organizations(id) ON DELETE CASCADE`, y columnas de auditoría `created_by`, `updated_by`, `created_at`, `updated_at` (salvo `finance_settings`, que usa `org_id` como clave primaria y no tiene `id`).

| Tabla | Columnas propias (tipo, por defecto) | Restricciones e índices propios | Políticas |
|---|---|---|---|
| `activities` | `kind text not null default 'note'`, `subject text not null default ''`, `body text not null default ''`, `occurred_at timestamptz not null default now()`, `account_id`, `person_id`, `deal_id` (uuid, nulos) | `kind` ∈ email, call, meeting, note, linkedin, whatsapp, other; `length(subject) <= 200`; FK `account_id` → `accounts` (cascade), `deal_id` → `deals` (cascade), `person_id` → `people` (set null); índices `(account_id, occurred_at desc)` y `(deal_id, occurred_at desc)` | `org read`, `org insert`, `org update` (miembro); `org delete owner` (solo owner) |
| `deal_offers` | `deal_id uuid not null`, `version int not null default 1`, `title text not null default ''`, `lines jsonb not null default '[]'`, `recurring_total numeric not null default 0`, `one_off_total numeric not null default 0`, `status text not null default 'draft'`, `valid_until date`, `notes text not null default ''` | `status` ∈ draft, sent, accepted, rejected; `length(title) <= 200`; `unique (deal_id, version)`; FK `deal_id` → `deals` (cascade) | igual que `activities` |
| `email_templates` | `name text not null`, `subject text not null default ''`, `body text not null default ''`, `stage text` | `1 <= length(btrim(name)) <= 120` | igual que `activities` |
| `finance_cost_lines` | `name text not null`, `category text not null default 'other'`, `amount numeric not null`, `starts_on date not null default date_trunc('month', now())::date`, `ends_on date`, `segment_id uuid`, `notes text not null default ''` | `amount >= 0`; `category` ∈ people, marketing, sales, tools, infra, cogs, other; `ends_on is null or ends_on >= starts_on`; `1 <= length(btrim(name)) <= 120`; FK `segment_id` → `segments` (set null) | `finance read/insert/update` con `is_finance_member`; `finance delete owner` |
| `finance_invoices` | `number text not null default ''`, `account_id`, `deal_id` (uuid), `issued_on date not null default current_date`, `due_on date`, `amount numeric not null`, `paid_on date`, `notes text not null default ''` | `amount >= 0`; `length(number) <= 60`; FK `account_id` → `accounts` (set null), `deal_id` → `deals` (set null) | igual que `finance_cost_lines` |
| `finance_months` | `month text not null`, `revenue numeric`, `costs numeric`, `cash_end numeric`, `notes text not null default ''`, `closed_at timestamptz` | `month ~ '^\d{4}-(0[1-9]|1[0-2])$'`; `revenue >= 0` o nulo; `costs >= 0` o nulo; `unique (org_id, month)` | igual que `finance_cost_lines` |
| `finance_settings` | `org_id uuid primary key not null default current_org()`, `opening_cash numeric not null default 0`, `cash_as_of date`, `horizon_months int not null default 12`, `annual_discount_pct numeric not null default 0`, `include_pipeline boolean not null default true`, `plan_assumptions jsonb not null default '{}'`, `scenario_spread_pct numeric not null default 25` | `3 <= horizon_months <= 36`; `0 <= annual_discount_pct <= 90`; `0 <= scenario_spread_pct <= 90` | igual que `finance_cost_lines` |
| `forecast_snapshots` | `month text not null`, `assumptions jsonb not null default '{}'`, `summary jsonb not null default '{}'` | `month ~ '^\d{4}-(0[1-9]|1[0-2])$'` | igual que `finance_cost_lines` |
| `teams` | `name text not null`, `lead_id uuid` | `1 <= length(btrim(name)) <= 80` | `org read` (miembro); `leaders insert/update/delete` con `is_finance_member` |
| `team_members` | `team_id uuid not null`, `user_id uuid not null` | `unique (team_id, user_id)`; FK `team_id` → `teams` (cascade) | `org read` (miembro); `leaders insert/update/delete` con `is_finance_member` |

Detalle de las políticas: todas son para el rol `authenticated`. Lectura: `org_id = current_org() AND is_org_member(org_id)` (o `is_finance_member` en las financieras). Inserción: `with check is_org_member(org_id)` (o `org_id = current_org() AND is_finance_member(org_id)`). Borrado en `activities`, `deal_offers`, `email_templates` y las `finance_*`: `org_id = current_org() AND has_org_role(org_id, 'owner')`.

## 4. Permisos y observaciones
- `anon`, `authenticated` y `service_role` tienen todos los privilegios (incluido `TRUNCATE`, `REFERENCES` y `TRIGGER`) sobre las 10 tablas. `0057_finance_grants.sql` solo concede lo mínimo a `authenticated` y `service_role` sobre las cuatro `finance_*`: los privilegios reales son más amplios que los versionados. Con RLS activado y sin políticas para `anon`, esa concesión no da acceso por la API; **no se verificó** qué haría un cliente con acceso SQL directo, y `TRUNCATE` no está sujeto a RLS.
- `activities`, `deal_offers`, `email_templates`, `teams` y `team_members` no tienen política `FOR ALL` ni de borrado fuera de owner o de quien es `is_finance_member`.
- La base de datos refleja lo que aplicó Lovable. Si esas dos filas de migración se reaplicaran sobre una base nueva, el resultado no está probado.

## 5. Cómo generar la migración versionada (para NK-0057 U-0)
Requiere la cadena de conexión de la base, que NO está en este repo ni en esta sesión:
```bash
pg_dump --schema-only --no-owner --no-privileges \
  -t public.activities -t public.deal_offers -t public.email_templates \
  -t public.finance_cost_lines -t public.finance_invoices -t public.finance_months \
  -t public.finance_settings -t public.forecast_snapshots -t public.teams -t public.team_members \
  "$DATABASE_URL" > capture.sql
```
Añadir a mano `is_finance_member` (§2) y los grants reales. Después: aplicar `capture.sql` sobre una base vacía con las migraciones 0000–0076 y comparar el catálogo con el de la base real antes de numerarla (número libre desde 0079) y de sellar el diario con `reseal-journal.mjs`.

## 6. Qué decide Fede
- Si NK-0057 U-0 incluye este rescate o va como trabajo previo aparte.
- Si se recortan los privilegios de `anon` a su estado versionado al capturar o se deja tal cual hasta medir el riesgo.
