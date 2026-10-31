# Migraciones 0071, 0072 y 0073: pendientes en la base de Lovable Cloud

**Fecha:** 2026-11-01 · **Preparado por:** el coordinador, para que las aplique Fede, Dani o Lovable. **No se ha aplicado nada.**
**Fuente del estado:** consultas de solo lectura, solo recuentos y metadatos, al esquema de la base de Lovable Cloud el 2026-11-01 (conector de Lovable). Código leído en `origin/main` (`6976fa8`).

## Qué se midió
| Migración | Qué crea | Estado en la base de Lovable Cloud |
|---|---|---|
| 0068 | Registro de decisiones y RPC `decide_strategy_suggestion` | **Aplicada** |
| 0069 | Columnas de cierre en `gtm_experiments` | **Aplicada** (4 de 4 columnas) |
| 0070 | `strategy_changes` y `strategy_links` | **Aplicada** |
| **0071** | `segments.acquisition_motion` y reescritura de `create_organization_full` | **No aplicada** (`segments` solo tiene `motion`) |
| **0072** | Tabla `strategy_reviews` (revisión estratégica con IA, F4) | **No aplicada** (la tabla no existe) |
| **0073** | Disparador `suggestions_strategy_guard` y RPC con `set_config` | **No aplicada** (`suggestions` no tiene ningún disparador) |

**Efecto probable hoy, sin verificar en la aplicación:** la revisión estratégica con IA falla (no hay tabla); los segmentos nuevos no guardan «motion de adquisición»; un miembro puede saltarse el registro de decisiones escribiendo en `suggestions` desde el navegador.

## Orden recomendado
**0072 → 0071 → 0073.** Las tres son independientes entre sí. 0073 va al final porque cambia el comportamiento de la RPC de decisión.

Antes de empezar: hay una copia de seguridad diaria de Lovable (la última que se vio es del 2026-10-29, 7:41 UTC; solo se puede restaurar sobre el mismo proyecto, no descargar). No sustituye a una exportación, que solo puede lanzar Fede.

## 0072: `strategy_reviews` (la más simple)
- **Hace:** crea una tabla nueva con RLS (solo Owner y Sales Leader leen e insertan). No toca nada existente.
- **Antes:** comprobar que no existe (`select to_regclass('public.strategy_reviews');` debe dar `null`).
- **Después:** `select to_regclass('public.strategy_reviews');` da la tabla; `select count(*) from pg_policies where tablename='strategy_reviews';` da 2; un Owner pide una revisión en la app y aparece una fila.
- **Deshacer:** `DROP TABLE IF EXISTS public.strategy_reviews;` (vacía al principio, no se pierde nada).

## 0071: `acquisition_motion` (la que más cuidado pide)
- **Hace:** añade `segments.acquisition_motion` (nullable, con CHECK de cuatro valores) y **sustituye `create_organization_full`** para rellenarlo en las plantillas.
- **Riesgo:** la función `create_organization_full` actual de la base puede no coincidir con la del repo (su versión base es la 0056; el propio SQL dice que `create_organization` se aplicó antes del historial). Un `CREATE OR REPLACE` pisaría la versión viva.
- **Antes (obligatorio):** sacar la definición viva y compararla con la de 0056: `select pg_get_functiondef('public.create_organization_full(text,text,text,text)'::regprocedure);`. Si difiere en algo que no sea lo que añade 0071, parar y avisar.
- **Después:** `select column_name from information_schema.columns where table_name='segments' and column_name='acquisition_motion';` da una fila; `select conname from pg_constraint where conname='segments_acquisition_motion_check';` da una fila. La función viva debe contener `acquisition_motion`. **No** crear una empresa de prueba en producción para verificarlo: es dato real.
- **Deshacer:** `ALTER TABLE public.segments DROP COLUMN acquisition_motion;` y restaurar `create_organization_full` desde 0056.
- **Sin verificar:** la cabecera de la migración dice que no se había ejecutado en un Postgres local (`src/lib/migrations.pg.test.ts` con PGlite) cuando se escribió; no sé si esa prueba la cubre hoy.

## 0073: disparador de seguridad (la que cambia comportamiento)
- **Hace:** `suggestions_strategy_guard` rechaza, para los roles `authenticated` y `anon`, decidir una sugerencia estratégica (`status`, `snoozed_until`) sin pasar por `decide_strategy_suggestion`, y reescribe esa función para activar un ajuste local de transacción (`nokko.strategy_decision`) alrededor de su único UPDATE. `service_role` y `postgres` no están sujetos. No reescribe filas ni añade CHECK.
- **Antes:** confirmar que 0068 está aplicada (sí). La cabecera dice «VERIFIED LOCALLY on PGlite: `src/lib/strategy-f0.pg.test.ts`; NOT applied to any real database; apply it first on a copy». Hacerlo primero en una copia si se puede.
- **Después:** `select tgname from pg_trigger where tgname='suggestions_strategy_guard';` da una fila. En la aplicación, con un usuario normal: aceptar, posponer y descartar una sugerencia estratégica sigue funcionando (pasa por la RPC). Si tras aplicarla falla alguna decisión legítima, deshacer (abajo).
- **Prueba opcional del rechazo:** en una transacción que se descarta (`begin; set local role authenticated; …; rollback;`), un `update suggestions set status='approved'` sobre una fila estratégica debe fallar con `42501`. Solo con cuidado y sobre una fila que no importe.
- **Deshacer:** `DROP TRIGGER IF EXISTS suggestions_strategy_guard ON public.suggestions; DROP FUNCTION IF EXISTS public.suggestions_strategy_guard();` y volver a ejecutar la versión de `decide_strategy_suggestion` de 0068. Sin pérdida de datos. El guion completo está en `docs/sdd/rollback-strategic-suggestions.sql` (no es una migración).

## Cómo aplicarlas
**[Por verificar]** cómo se aplicaron las anteriores (0058, 0060, 0061, 0068 a 0070): el repo no lo dice. Dos vías posibles sobre Lovable Cloud:
1. **SQL editor** del proyecto (Database → Manage → SQL editor), pegando el archivo de `drizzle/migrations/` tal cual. Lo ejecuta una persona con acceso, con la sesión de Fede.
2. **El agente de Lovable** (chat del proyecto), pidiéndole que aplique ese archivo como migración. Consume créditos del espacio de trabajo.

Tras aplicarlas, el registro `_journal.json` del repo ya las incluye; no hay otro registro que actualizar a mano, salvo que `drizzle` lleve el suyo en la base (`drizzle.__drizzle_migrations`, sin comprobar).

## Lo que esta nota NO demuestra
- Nada de lo que hay dentro de la aplicación o de Telegram; solo el esquema.
- Que la definición viva de `create_organization_full` difiera o no de 0056.
- Que 0071 y 0073 se apliquen sin error en la base real: ninguna se ha ejecutado contra ella.
