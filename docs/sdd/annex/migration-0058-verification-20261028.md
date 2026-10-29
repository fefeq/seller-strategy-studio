# Plan de verificación — migración 0058 `field_sources_generic`

Estado: **NOT VERIFIED, no aplicada en ningún sitio.** Este documento es solo un plan; no se ha creado ninguna rama de BD ni se ha ejecutado SQL.
Fuentes leídas: `drizzle/migrations/0058_field_sources_generic.sql`, `0046_field_sources_auto_enrich.sql` (trigger anterior), `0001`/`0002`/`0048` (icp_profiles y RLS), `src/lib/AGENTS.md` («Origin and confirmation (U-3)»), `src/integrations/supabase/types.ts`.

## Conclusión

La migración es pequeña y aditiva (una columna con default, una función, tres triggers), pero **cambia de forma silenciosa lo que significa un `UPDATE` hecho con sesión**: pasa de «borrar la marca» a «marcar como persona y confirmado». El riesgo real no es el SQL, es **qué escritores automáticos corren con el JWT de una persona** y quedarían marcados como «persona». Eso hay que medirlo antes de aplicar (ver Riesgos R1). Se puede probar entera en una rama de BD con 2 organizaciones ficticias.

## 1. Qué cambia

| Objeto | Antes | Después |
|---|---|---|
| `icp_profiles.field_sources` | no existe | `jsonb NOT NULL DEFAULT '{}'` (+ comentario). Filas existentes quedan en `{}` |
| `accounts_clear_field_sources()` + trigger `accounts_clear_field_sources` (0046) | cambio sin tocar `field_sources` → borra la marca del campo | **eliminados** |
| `track_field_sources()` (genérica, campos por `TG_ARGV`) | no existe | nueva |
| Trigger `accounts_track_field_sources` | no existe | BEFORE UPDATE, campos `industry,size,country,notes,linkedin_url` |
| Trigger `icp_profiles_track_field_sources` | no existe | BEFORE UPDATE, campos `countries,geography,min_employees,max_employees,company_size` |

Regla nueva (solo si el UPDATE **no** cambia `field_sources`; si lo cambia se respeta tal cual):
- Campo cambiado + `auth.uid()` no nulo + valor no vacío (`null`, `""`, `[]`) → marca `{source:persona, kind:persona, confirmed:true, confirmedBy:uid, at, confirmedAt}`.
- Campo cambiado + valor vacío → se elimina la marca.
- Campo cambiado + `auth.uid()` nulo (service role / cron / Inngest con cliente admin) → se elimina la marca (igual que antes).

No toca RLS ni datos existentes. La función no es `SECURITY DEFINER`, `search_path = public`.

## 2. Qué falta para poder ejecutarlo

1. **Rama de BD aislada.** Las herramientas de Supabase conectadas permiten `create_branch`, pero el proyecto del repo es `mlmixujbmtlkqvtjkcpg` (el mismo que usa Lovable/producción; el MCP `nokko` ni siquiera resuelve ahora el host: `ENOTFOUND`). Hace falta que Fede confirme: (a) que las ramas de BD están disponibles en su plan y de qué proyecto cuelga, (b) coste de la rama (las ramas de Supabase se facturan por hora). Alternativa sin coste ni riesgo para el proyecto: Postgres local (Docker / `supabase start`) aplicando 0001→0059 en orden.
2. **Cómo se aplican las migraciones en este repo.** `supabase/` solo tiene `config.toml`; las migraciones viven en `drizzle/migrations/` y el `meta/` solo llega al snapshot 0057 (el journal ya lista 0058 y 0059 sin snapshot). No hay script de «apply» en `package.json`. Hay que saber si las aplica Lovable al sincronizar o alguien a mano. Para la rama aislada: aplicar los `.sql` en orden con `psql` o `apply_migration` en la rama.
3. **Base con el esquema real.** Una rama de Supabase creada desde migraciones de `supabase/migrations` no tendría el esquema (están en `drizzle/`). Una rama sin datos de producción + aplicar 0001–0059 es lo más limpio. Orden dependiente: 0058 requiere `accounts.field_sources` (0046), `icp_profiles` columnas de 0048, `is_org_member`, `current_org` (0002).
4. **Usuarios de prueba ficticios**: 2 usuarios en `auth.users` (A y B), 2 organizaciones, 2 cuentas, 2 perfiles ICP. Se simulan sesiones con `set local role authenticated; set local request.jwt.claims = '{"sub":"<uuid>","role":"authenticated"}';` (así `auth.uid()` funciona en `execute_sql`/psql).
5. **Regenerar `types.ts`** tras aplicar: hoy `icp_profiles` no tiene `field_sources` (solo `accounts`); `field-coverage.test.ts` pedirá binding para la columna nueva. Eso es un cambio de código aparte (SDD/PR), no de esta verificación.

## 3. Datos de prueba (todo ficticio)

Prefijo `ZZ-TEST` en nombres; UUIDs fijos inventados; nada copiado de producción.
```sql
-- (en la rama, como rol postgres)
-- org A / org B, usuarios uA / uB, miembros, current_org_id en profiles
-- accounts: 'ZZ-TEST Alfa' (org A), 'ZZ-TEST Beta' (org B), con industry/size/country/notes/linkedin_url rellenos y field_sources = '{}' y también uno con marca previa {"industry":{"source":"apollo"}}
-- icp_profiles: 'ZZ-TEST ICP A' (org A), 'ZZ-TEST ICP B' (org B), con countries '{ES,MX}', geography 'LATAM', min/max_employees 10/200, company_size '11-50'
```
(El script exacto se escribe en la fase de ejecución, tras el OK, porque depende del esquema real de `organizations`/`org_members`/`profiles`.)

## 4. Casos a probar

Todos como transacción con `ROLLBACK` al final, salvo que se pida inspección posterior. Esperado entre corchetes.

**Pre-chequeos (antes de 0058)**
- P1. `select tgname from pg_trigger where tgrelid='public.accounts'::regclass and not tgisinternal;` → existe `accounts_clear_field_sources`.
- P2. Con service role (sin claims): `update accounts set industry='X' where name='ZZ-TEST Alfa'` → marca de `industry` borrada (baseline).

**Persona con sesión (accounts)**
- C1. `authenticated` como uA: `update accounts set industry='Software' …` → `field_sources->'industry'` = `{source:persona, kind:persona, confirmed:true, confirmedBy:uA, at, confirmedAt}`.
- C2. Igual para `size`, `country`, `notes`, `linkedin_url` (el check de `linkedin_url` exige `https://…linkedin.com/`).
- C3. Cambiar dos campos a la vez → ambas marcas; un campo no cambiado conserva su marca previa (no se toca).
- C4. UPDATE que no cambia ningún campo rastreado (p. ej. `is_target`) → `field_sources` idéntico.
- C5. Mismo valor (`industry` = valor actual) → no se re-sella (`IS DISTINCT FROM` falso).

**Borrado de marca**
- B1. uA: `update accounts set industry=''` → marca de `industry` eliminada, no sellada. Repetir con `NULL` y, en icp_profiles, `countries='{}'`.
- B2. Valor `0` en `min_employees` (número, no vacío) → **se sella como persona**; confirmar que es el comportamiento deseado (decisión D3).

**Ruta de servicio (auth.uid() nulo)**
- S1. Sin claims (rol postgres/`service_role`): cambiar `industry` sin tocar `field_sources` → marca eliminada, no sellada.
- S2. Igual en `icp_profiles.countries`.
- S3. `service_role` con claims `role=service_role` y sin `sub` → `auth.uid()` nulo, mismo resultado.

**UPDATE que también cambia `field_sources` (applyAutoChanges, FitFields)**
- F1. uA y service: `update accounts set industry='X', field_sources = field_sources || '{"industry":{"source":"apollo","kind":"fuente","confirmed":false}}'` → se guarda exactamente lo enviado, sin sello.
- F2. UPDATE que envía `field_sources` idéntico al actual pero cambia el campo → el trigger **sí** actúa (porque `field_sources` no cambió). Caso límite a documentar: un escritor que reenvía el mismo `field_sources` pierde la protección.

**icp_profiles**
- I1. Como en C1/B1/S1 para `countries` (text[]), `geography`, `min_employees`, `max_employees`, `company_size`.
- I2. Campos no rastreados (`name`, `why_fit`) no generan marca.
- I3. Fila existente: `field_sources = '{}'` tras la migración.

**RLS icp_profiles (no se tocó; verificar que no se rompió)**
- R1. uA: `select` de ICP de org B → 0 filas.
- R2. uA: `update icp_profiles … where id = <B>` → 0 filas afectadas; el trigger no se ejecuta sobre B (comprobar que `field_sources` de B sigue en `{}`).
- R3. uA: `insert` con `org_id` de B → error por `with check`.
- R4. `delete` por miembro no owner → 0 filas; por owner → ok.
- R5. `select polname, cmd from pg_policy where polrelid='public.icp_profiles'::regclass;` idéntico antes y después.

**Despliegue / idempotencia**
- D1. Aplicar 0058 dos veces seguidas → sin error (`IF NOT EXISTS`, `DROP … IF EXISTS`, `CREATE OR REPLACE`).
- D2. `select proname from pg_proc where proname in ('accounts_clear_field_sources','track_field_sources');` → solo la segunda.
- D3. Insert de cuenta/ICP nuevos no dispara nada (triggers solo en UPDATE).

## 5. Consultas de comprobación

```sql
-- triggers y funciones
select c.relname, t.tgname, pg_get_triggerdef(t.oid)
from pg_trigger t join pg_class c on c.oid=t.tgrelid
where c.relname in ('accounts','icp_profiles') and not t.tgisinternal;

select proname from pg_proc where pronamespace='public'::regnamespace
  and proname in ('accounts_clear_field_sources','track_field_sources');

-- columna
select column_name, data_type, column_default, is_nullable
from information_schema.columns
where table_schema='public' and table_name='icp_profiles' and column_name='field_sources';

-- marcas
select name, jsonb_pretty(field_sources) from accounts where name like 'ZZ-TEST%';
select name, jsonb_pretty(field_sources) from icp_profiles where name like 'ZZ-TEST%';

-- RLS
select polname, polcmd, pg_get_expr(polqual, polrelid) as using_,
       pg_get_expr(polwithcheck, polrelid) as check_
from pg_policy where polrelid='public.icp_profiles'::regclass order by 1;

-- sin marcas persona inesperadas tras operar solo con service
select count(*) from accounts
where exists (select 1 from jsonb_each(field_sources) e where e.value->>'kind'='persona');

-- advisors de Supabase (get_advisors: security) antes/después, comparar
```

## 6. Riesgos

- **R1 (alto, no se resuelve con SQL): escritores automáticos con JWT de persona.** Cualquier `UPDATE` hecho con el cliente de navegador o con el cliente «de usuario» en una server function ve `auth.uid()` y quedaría sellado `persona + confirmed` aunque el valor lo haya puesto Nokko (aplicar sugerencias, aprobación del onboarding vía `applySetupItems`, import de Apollo, `applyAutoChanges`, agente `update_account`). Solo los que usan el cliente admin o envían `field_sources` están a salvo. **Antes de aplicar hay que listar escritores de las 5+5 columnas y comprobar con qué cliente corren.** (`applyAutoChanges` está en `autopilot.server.ts`, `inngest/lead-tasks.server.ts`, `inngest/job-runner.server.ts`, `orchestrator/runner.ts`; no he verificado qué cliente usa cada uno.) Si alguno usa JWT de persona sin enviar `field_sources`, su dato queda como «confirmado por persona» y rompe la regla «sin dato nunca persona».
- **R2 (medio): ICP.** Onboarding (`applySetupItems`, el mismo camino que Configuración) escribe `countries`, `company_size`, etc. con sesión; esa aprobación humana sí es de persona, pero los valores propuestos por IA que la persona solo aprobó quedan sellados «persona» sin `quote`/origen IA. Decisión D2.
- **R3 (medio): `field_sources` reenviado igual** (F2) anula el trigger sin querer; formularios que copian el registro y reenvían todo (`mergeServerEdits`) podrían hacerlo.
- **R4 (bajo): valor `0`/`false`** cuenta como «no vacío» (solo se excluyen `null`, `""`, `[]`).
- **R5 (bajo): `to_jsonb(NEW) -> f` con nombre de campo inexistente** devuelve NULL en ambos lados → no-op silencioso; un typo en `TG_ARGV` no falla. Los 10 nombres coinciden con columnas reales (`linkedin_url` 0034, `countries`/`min_employees`/… 0048, `geography`/`company_size` 0001); `notes` de accounts no lo he localizado en las migraciones leídas → confirmar en el esquema real de la rama (`\d accounts`).
- **R6 (bajo): lock/rendimiento.** Trigger BEFORE UPDATE por fila, sin `WHEN`; coste despreciable. `ADD COLUMN … DEFAULT '{}'` es metadato en PG ≥ 11, sin reescritura.
- **R7: deriva de tipos/tests.** `types.ts` sin `icp_profiles.field_sources`; `field-coverage.test.ts` fallará hasta regenerar y añadir binding.
- **R8: PostgREST schema cache.** Tras aplicar, recargar (`notify pgrst, 'reload schema'`) o la API no verá la columna nueva.

## 7. Orden de rollback

Solo en la rama (descartable: `delete_branch` o `reset_branch`, lo más limpio). Si hubiera que revertir a mano:
1. `DROP TRIGGER IF EXISTS icp_profiles_track_field_sources ON public.icp_profiles;`
2. `DROP TRIGGER IF EXISTS accounts_track_field_sources ON public.accounts;`
3. Recrear la función y el trigger de 0046 (`accounts_clear_field_sources`) — texto en `0046_field_sources_auto_enrich.sql` líneas 5-20.
4. `DROP FUNCTION IF EXISTS public.track_field_sources();`
5. `ALTER TABLE public.icp_profiles DROP COLUMN IF EXISTS field_sources;` — **ojo**: destruye marcas ya escritas en ICP; solo si no se necesita conservarlas (exportar antes `select id, field_sources from icp_profiles where field_sources <> '{}'`).
6. Las marcas `persona` ya escritas en `accounts.field_sources` por el trigger nuevo **no se revierten solas**; si hiciera falta, limpiarlas con una consulta dirigida (`kind='persona' and confirmedBy is not null` y `at` posterior a la fecha de aplicación). Esto es la razón de no aplicar nunca primero en producción.

## 8. Decisiones de Fede

- **D1. Dónde se verifica:** rama de Supabase (coste, vinculada al proyecto `mlmixujbmtlkqvtjkcpg`) vs Postgres local con 0001–0059. Recomendación: local/rama sin datos reales; en ningún caso producción.
- **D2. ICP aprobado vía onboarding:** ¿sellar como `persona` lo que la IA propuso y la persona aprobó, o exigir que el cliente envíe `field_sources` (kind `ia`, confirmed) y que el trigger solo cubra ediciones manuales?
- **D3. Valor `0` / `false`:** ¿cuenta como dato de persona? (hoy sí).
- **D4. Autorizar la ejecución:** crear la rama, aplicar 0058 y correr los casos de la sección 4 con datos ficticios. Nada se ha hecho todavía.
- **D5. Quién regenera `types.ts` y añade el binding de `icp_profiles.field_sources`** (SDD/PR aparte) y cuándo se aplica en preproducción.
- **D6. Cómo se aplican realmente las migraciones** (Lovable vs manual) para definir el paso a preproducción, con 0059 pendiente detrás.

## 9. Siguiente paso propuesto (con tu OK)

1. Auditar escritores (R1) — solo lectura de código; puede hacerlo la sesión `auditar-otros-escritores` si ya cubre esto.
2. Con OK a D1+D4: preparar script de datos ficticios + script de casos (rollback por caso) y ejecutarlo en la rama; devolver tabla esperado/obtenido.

---

# RESULTADOS DE LA EJECUCIÓN (2026-10-28, Postgres 17 local en Docker, datos ficticios `ZZ-TEST`)

Decisiones de Fede aplicadas: D1 = Postgres local; D2 = el cliente envía `field_sources` (sin cambio en la migración); D3 = `0`/`false` cuentan como dato; D4 = ejecutar ya.
Entorno: contenedor `nokko-0058-test` (puerto 54999, BD `t58`), stubs mínimos de `auth` (`auth.uid()` desde `request.jwt.claims`) y roles `anon/authenticated/service_role`; migraciones 0001→0057 aplicadas (solo fallan `supabase_realtime`, irrelevante, y 0057 por tablas finance inexistentes). Nada tocó producción, Supabase ni Vercel.

## Resultado: 0058 se comporta como dice la cabecera. 34 comprobaciones, todas PASS tras corregir dos fallos de mi arnés.

| Caso | Resultado |
|---|---|
| P2/P3 baseline 0046: service y persona borran la marca | PASS |
| 0058 aplicada dos veces seguidas (idempotencia) | PASS, sin errores |
| Triggers/funciones: `accounts_clear_field_sources` eliminada, `track_field_sources` + 2 triggers nuevos; `icp_profiles.field_sources jsonb NOT NULL '{}'`, filas previas en `{}` | PASS |
| RLS de `icp_profiles` antes/después (4 políticas) | idéntico |
| C1-C5 persona con sesión en accounts: industry, size, country, notes, linkedin_url → `kind persona`, `confirmed true`, `confirmedBy` = uid, `at` ISO; dos campos a la vez; campos no tocados conservan su marca; campo no rastreado y mismo valor no sellan | PASS |
| B1 valor `''`, `NULL` y `{}` borran la marca (no sellan) | PASS |
| B2 `min_employees = 0` sella persona; `NULL` borra | PASS (D3) |
| S1-S3 service_role y postgres sin `auth.uid()`: marca eliminada, resto intacta; también icp_profiles | PASS |
| F1 UPDATE que envía `field_sources` propio (persona y service, accounts e icp): se guarda tal cual, sin sello | PASS |
| I1-I2 icp_profiles: countries, geography, min/max_employees, company_size sellan; name/why_fit no | PASS |
| R1 miembro de A ve solo su ICP; no ve cuentas de B | PASS |
| R2 update sobre ICP de B → 0 filas, B intacto | PASS |
| R3 insert con `org_id` de B → error RLS (`new row violates row-level security policy`) | PASS (error esperado) |
| R4 delete: miembro de B sobre ICP de A no borra; owner de A borra el suyo | PASS |
| Rollback de la sección 7 (en orden) deja el estado de 0046 y se puede reaplicar 0058 | PASS |

## Correcciones al plan y hallazgos nuevos

1. **Corrección de F2/R3 (estaba invertido).** Reenviar un `field_sources` *idéntico* al actual **no** desactiva el trigger: el guard solo sale si `field_sources` *cambia*. Resultado real: persona con sesión que reenvía el mismo `field_sources` → se sella `persona`; service que lo reenvía igual → se borra la marca. Consecuencia para R1: un formulario o escritor que copia el registro entero con sesión de persona sella como persona todo campo que cambie, aunque venga de Nokko. Solo protege enviar un `field_sources` modificado.
2. **`accounts.country` no tiene migración activa.** Existe en `types.ts` pero 0029 lo deja comentado (líneas 9-10). Una BD reconstruida desde `drizzle/migrations` no lo tiene y `0058` no fallaría (`to_jsonb(NEW)->'country'` da NULL, no-op silencioso), pero el comportamiento de country no se aplicaría. Lo añadí a mano en el entorno local para probar. Esto es una **deriva migraciones ↔ producción** que Fede debe conocer (¿se aplicó a mano o por Lovable?).
3. **0057 no es reproducible desde las migraciones**: referencia `finance_cost_lines`/`finance_invoices`, que ningún `.sql` crea. Misma deriva.
4. **Orden de triggers**: `accounts_audit` / `icp_profiles_audit` (`set_audit()`, BEFORE INSERT/UPDATE) corren antes del nuevo (orden alfabético) y no interfieren.
5. **R1 sigue abierto**: la auditoría de qué escritores usan JWT de persona sin enviar `field_sources` no está hecha (no hay nota de la sesión `auditar-otros-escritores` en las carpetas compartidas). Es el único bloqueo real para aplicar en preproducción.
6. Sin verificar aquí: PostgREST/`supabase_realtime`, advisors de Supabase y el comportamiento con el JWT real de Supabase (usé claims simulados; `auth.uid()` real lee el mismo `request.jwt.claims`).

## Estado del entorno
Contenedor `nokko-0058-test` creado por mí (Docker Desktop arrancado por mí también). Con 0058 reaplicada tras el rollback. Descartable: `docker rm -f nokko-0058-test`.

---

# AUDITORÍA R1 — escritores de accounts e icp_profiles (solo lectura, rama feat/universal-field-normalization @ 8524c92)

Criterio: `UPDATE` de industry/size/country/notes/linkedin_url (accounts) o countries/geography/min_employees/max_employees/company_size (icp_profiles) hecho con JWT de persona (`auth.uid()` no nulo) **sin** enviar `field_sources`. Tras 0058 queda sellado `persona + confirmed`. (Los INSERT no disparan el trigger.)

## A. Quedarían sellados «persona» sin que el valor sea de la persona (hallazgos R1)
| # | Escritor | Por qué |
|---|---|---|
| 1 | `components/apollo.tsx:296` (`apply`) | navegador, `enrichPatch` solo devuelve campos; sin `field_sources`. Valor de Apollo → sellado persona |
| 2 | `components/clay.tsx:279` | igual (Clay) |
| 3 | `components/parallel.tsx:224` | igual (Parallel, incluye `notes`); varias cuentas en bucle |
| 4 | `components/orchestrator/complete-account.tsx:50` | igual; valores de «completar cuenta» con revisión humana |
| 5 | `lib/agent/tools/accounts.ts:100` `update_account` | `ctx.db = context.supabase` (`agent.functions.ts:19`) = JWT de persona; solo tras confirmar, pero valor propuesto por la IA → sellado persona |
| 6 | `lib/apify-core.ts:32` (linkedin_url hallado por búsqueda web) | `db` viene del usuario cuando lo llaman `web-research.functions.ts` y `agent/tools/web.ts` (`researchAccountCore`/`refreshSignalsCore`) → sellado persona sin que nadie lo escribiera ni confirmara. **El más grave: ni siquiera hay aprobación humana del valor** |

Nota: en 1-4 la persona marca casillas (`picked`) y en 5 confirma la acción: hay aprobación humana, pero el origen real (fuente/IA) se pierde y queda «escrito por persona». Antes de 0058 esos mismos casos dejaban «sin dato»; no es peor en calidad del dato, pero cambia el significado de «persona».

## B. Seguros (o sin cambio)
- `orchestrator/runner.ts:140` `applyAutoChanges` envía `field_sources` (`stampSources`); sus llamadores usan cliente admin (`job-runner.server.ts` `db: Admin`; `autopilot/discoveries/lead-tasks` con `db` de servicio; `channel-ctx.server.ts` admin) → sin sello y con la marca que manda el código.
- `components/account/fit-fields.tsx` (4 updates) envían `field_sources` (personEdit/confirm) → respetado tal cual (ver nota F2 abajo).
- `components/icp-editor.tsx:78` envía `...rest` del `select("*")` (incluirá `field_sources` sin cambios): el trigger actúa y sella persona los campos que la persona cambió a mano → correcto, es edición manual.
- INSERT (no dispara): `imports.functions.ts:95`, `routes/api/public/accounts.ts:74`, `create_icp` (agente/onboarding), `icp-editor` «Nuevo ICP».
- Updates a columnas no rastreadas: `quick-actions.tsx`, `abm.tsx`, `accounts.$id.tsx` (health/tier), `leads-ingest`, `lead-tasks` (domain), `autopilot`/`web-research-core` (fechas).
- Servicio sin `auth.uid()`: seguirá borrando la marca (igual que hoy).

## C. No encontrado / por confirmar
- No hay ningún `UPDATE` a `icp_profiles` desde onboarding/`applySetupItems`: el onboarding/Configuración crea ICP con INSERT (`create_icp`), así que **D2 (ICP aprobado por onboarding) no se ve afectada por el trigger** hoy; solo `icp-editor` actualiza (edición manual).
- No he trazado el flujo `new-deal.tsx`/`setup/*` por si hacen `update` indirecto vía `applySetupItems` sobre accounts; el grep de `from("accounts").update` en `src` no lo muestra.
- Revisar `src/lib/agent/tools/core-write.ts` y `pipeline.ts` (aparecen en la lista de ficheros que tocan `accounts`) si hacen update de los campos rastreados; el grep por `.from("accounts").update` no los listó, pero pueden usar otra forma (`mustFind`+helpers).

## Qué haría falta antes de aplicar 0058 (propuesta, sin implementar)
1. Para 1-4: que el cliente envíe `field_sources` (`stampSources` con `kind fuente/ia`, `confirmed true` por la aprobación del usuario) junto al patch; así el trigger no actúa.
2. Para 5: que `update_account` fije `field_sources` con `kind ia` y `confirmed` por la persona que aprobó (o aceptar «persona» y decidirlo explícitamente).
3. Para 6: pasar el cliente admin a `linkedinCompanyUrl` o enviar `field_sources` `kind fuente, confirmed false`.
4. Test de contrato: un test que falle si un escritor de columnas rastreadas no incluye `field_sources` (los 6 anteriores lo harían fallar hoy).
