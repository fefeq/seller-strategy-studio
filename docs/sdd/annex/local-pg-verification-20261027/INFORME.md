# Verificación local de migraciones · 2026-10-27

Resultado: **las migraciones 0058, 0060, 0061, 0063 (en `main`), 0059 (PR #32) y 0062 (PR #31) se aplican bien y la seguridad por empresa (RLS) se comporta como se espera**, en un Postgres 16 local. No se usó Supabase, Lovable ni ninguna base de Postgres ni de NOKKO, y no hay datos reales.

## Cómo se hizo
- Postgres 16.15 real, aislado, con los roles `anon`, `authenticated` y `service_role`, el esquema `auth` (`auth.uid()`, `auth.jwt()`, `auth.users`) y `vault` simulados (`stubs.sql`). Repetible con `run.sh`.
- Las 62 migraciones de `main` aplicadas en orden, cada una en su transacción.
- Después, 0059 (rama `feat/connections-own-account-v2`) y 0062 (rama `feat/strategy-guided-next-step`).
- Dos empresas ficticias (A y B) con un Owner y un AE en A y un Owner en B. Datos inventados.

## Resultado por migración
| Migración | Resultado |
|---|---|
| 61 de las 62 de `main` | Aplicadas sin error |
| `0057_finance_grants.sql` | **Falla** (ver hallazgo 1) |
| 0058, 0060, 0061, 0063 | Comprobaciones 3a a 3d del checklist: todas como se esperaba |
| 0059 (Drive) | Aplicada; RLS correcta |
| 0062 (pausas de la guía) | Aplicada; las cuatro comprobaciones de su cabecera correctas |

## Comprobaciones funcionales que pasan
- Una empresa no ve, cambia ni borra datos de la otra (segmentos, registro de cambios, conexiones, pausas).
- Un AE puede editar, pero un Owner de otra empresa no puede deshacer su cambio («No encuentro ese cambio»).
- Deshacer una edición cuando hubo otra después en el mismo elemento se bloquea («cambió después»); deshacer la última edición funciona y conserva la marca de procedencia de los otros campos.
- `anon` no puede ejecutar `undo_field_edit`.
- Drive: el navegador lee estado y correo de la cuenta, pero nunca el token (`refresh_token_enc`), y no puede insertar, cambiar ni borrar; el AE (no Owner) ve el estado pero no puede modificarlo.
- Pausas: `snoozed_by` siempre es quien firma; borrar la empresa borra sus pausas y conexiones.

## Hallazgos
1. **La cadena de migraciones no construye una base nueva.** `0057_finance_grants.sql` da permisos sobre `finance_cost_lines`, `finance_invoices`, `finance_months` y `finance_settings`, que ninguna migración crea (existen en la base real, creadas fuera de las migraciones). Consecuencia: una base de pruebas nueva no se puede montar solo con las migraciones. Los permisos de finanzas quedan sin probar aquí. Decisión de Fede (con recomendación de Claude): crear la migración que falta o aceptar que esas tablas vienen de un volcado del esquema.
2. **0059 y 0062 pasan, pero la 0062 sigue marcada «NOT VERIFIED» en su cabecera.** Ahora está comprobada en local; conviene quitar esa marca en el PR #31 cuando se revise.

## Límites
- Es una simulación de la plataforma: no incluye el comportamiento de Supabase real (p. ej. `supabase_realtime` con `wal_level` lógico, tiempos, extensiones) ni los datos reales. Lo que se aplica en la base de NOKKO sigue necesitando la comprobación posterior del checklist.
- No se probó la parte de aplicación (pantallas ni Agente), solo la base de datos.
