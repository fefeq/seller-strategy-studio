# Migración 0109 aplicada en Lovable Cloud

**Fecha:** 2026-11-22. **Aplicada por:** el coordinador, con la autorización de Fede en el chat («Sí, migra y abre PR»).
**Vía:** conector de Lovable (`query_database`) sobre el proyecto «Seller Strategy Studio», en una sola transacción, con el texto de `drizzle/migrations/0109_agent_turns.sql` (NK-0191, `docs/sdd/SDD-20261121-agent-turn-metrics.md`).
Todas las comprobaciones fueron de metadatos o recuentos: no se leyó ni se modificó ninguna fila.

## Antes (solo lectura)
| Comprobación | Resultado |
|---|---|
| `to_regclass('public.agent_turns')` | null |
| Columnas `turn_id` en `public` | ninguna |
| `is_org_member` | existe, `(_org uuid)` |
| Nombres de los cuatro índices nuevos | libres |
| Recuentos | `agent_tool_calls` 0, `agent_pending_actions` 4, `agent_conversations` 4 |
| `drizzle.__drizzle_migrations` | 110 filas; no se toca (igual que en aplicaciones anteriores) |

## Después (solo lectura)
| Comprobación | Resultado |
|---|---|
| `agent_turns` | existe, 19 columnas, 14 `CHECK`, 0 filas |
| RLS | activa; políticas `own turns read` (SELECT) y `own turns insert` (INSERT) |
| Permisos de tabla | `authenticated`: INSERT, SELECT. `anon`: ninguno. `service_role` y `postgres`: todos. `sandbox_exec` (rol de la plataforma): INSERT, SELECT |
| `turn_id` | en `agent_pending_actions` y `agent_tool_calls`, nulo en las 4 filas existentes |
| Índices | los cuatro creados |
| `agent_pending_actions` | sigue con 4 filas |

## Vuelta atrás (no ejecutar salvo que haga falta; borra los turnos registrados)
```sql
drop index if exists public.agent_pending_actions_turn_idx;
alter table public.agent_pending_actions drop column if exists turn_id;
drop index if exists public.agent_tool_calls_turn_idx;
alter table public.agent_tool_calls drop column if exists turn_id;
drop table if exists public.agent_turns;
```
Con el código de NK-0191 publicado, quitar las columnas vuelve al camino degradado (reintento sin `turn_id`), que no está comprobado contra la base real.

## Lo que esta nota NO demuestra
- Que la app publicada escriba filas en `agent_turns`: el código de NK-0191 aún no está en `main` ni publicado.
- Que la API de datos ya vea las columnas nuevas (caché de esquema): se verá con el primer turno real.
- Que el coste llegue medido: depende del proveedor que responda en producción.
