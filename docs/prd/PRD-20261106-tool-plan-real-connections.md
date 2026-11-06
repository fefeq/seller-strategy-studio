# PRD-20261106-tool-plan-real-connections · [Feature] Plan de herramientas: distinguir lo que el equipo usa de lo que NOKKO conecta

**Tipo:** Feature · **Prioridad propuesta:** Media (corrige una confusión de producto y un hueco de permisos; no bloquea ningún flujo; sin datos de uso)
**Estado:** Aprobado (2026-11-06) · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-11-06
**SDD que lo desarrollan:** `docs/sdd/SDD-20261106-tool-plan-real-connections.md`
**Ticket:** NK-0064

> Un PRD dice qué se quiere y por qué. No dice cómo se construye ni cómo se prueba: eso es del SDD.

## 1. Problema
En Conexiones conviven dos listas: «Lo que se conecta hoy» (conexiones reales) y «Plan de herramientas del equipo» (etiquetas que el equipo marca a mano). Una herramienta marcada «Ya lo usamos» se lee como «NOKKO la lee», aunque no exista conexión nativa. Además, solo el Owner ve el selector de estado, pero la base de datos deja actualizar el plan a cualquier miembro.

## 2. Para quién
Owner y Sales Leader, que usan el plan para decidir qué montar; miembros del equipo, que lo leen para saber qué datos llegan a NOKKO.

## 3. Evidencia y por qué ahora
- `src/routes/_authenticated/integrations.tsx` (líneas 19-40 y 73-98): el estado es una etiqueta manual; la propia página dice «no significa que Nokko esté conectado».
- Ningún otro código lee `integrations.status` (búsqueda en `src`, solo la página y el snapshot de `src/lib/field-baseline.ts:46`).
- Políticas de `drizzle/migrations/0002_multitenant_organizations.sql:117-124`: update e insert abiertos a cualquier miembro. Ninguna migración posterior (0003-0076 en `origin/main`) menciona `integrations`.
- Datos de uso del plan: **sin dato**. La apuesta es que la confusión existe porque la tabla seed incluye herramientas sin conexión nativa (HubSpot, Gmail, Google Calendar, Gong, Fireflies) con la misma apariencia que Apollo o Clay.

## 4. Objetivos
| ID | Objetivo | Cómo se mide | Línea base | Fuente |
|---|---|---|---|---|
| G-1 | Cada fila del plan muestra, aparte del estado del equipo, si NOKKO tiene conexión con esa herramienta y de qué tipo | Prueba automática sobre el catálogo del plan | sin dato | se medirá tras el lanzamiento |
| G-2 | Marcar «Ya lo usamos» una herramienta sin conexión nativa no sugiere que NOKKO la lee | Revisión de la pantalla con el walkthrough | sin dato | se medirá tras el lanzamiento |
| G-3 | Solo el Owner puede cambiar el plan, también por API | Prueba automática de políticas con PGlite (`*.pg.test.ts`, que `origin/main` ya usa) más verificación manual en la base desplegada | miembros no-owner pueden actualizar (código de `0002`; producción por verificar) | `drizzle/migrations/0002_multitenant_organizations.sql` |

## 5. No-objetivos
- Construir conexiones nuevas (HubSpot, Gmail, Gong…): están en «Aún sin conexión nativa» y son otros trabajos.
- Cambiar «Lo que se conecta hoy» o el panel de conexiones por empresa.
- Que el plan active, desactive o sincronice nada.

## 6. Decisiones tomadas y abiertas
| Tema | Decisión | Quién y cuándo |
|---|---|---|
| ¿Bloquear «Ya lo usamos» si no hay conexión? | **No bloquear**; mostrar la conexión aparte. El plan describe lo que el equipo usa, y un equipo puede usar HubSpot sin que NOKKO lo lea. Bloquear haría el plan falso. | Fede, 2026-11-06 (al aprobar el PRD) |
| Implementar en esta sesión, sin fanout | Sí | Fede, 2026-11-06 |
| Base de implementación | `origin/main` | Fede, 2026-11-06 |
| Quién cambia el plan | Solo el Owner | Fede, 2026-11-06 (acepta la recomendación) |
| Catálogo de conexiones | El mapa nuevo convive con `WORKING` y `NOT_YET`; unificarlos queda fuera y se pide aparte | Fede, 2026-11-06 |
| Medida de G-3 | Prueba automática de políticas con PGlite más verificación manual en la base desplegada. Sustituye a «estática más manual», aceptada antes sobre una premisa falsa (el repo sí tiene pruebas de RLS con PGlite) | Fede, 2026-11-06 (confirma en el chat; SDD §15, pregunta 8) |

## 7. Riesgos y dependencias
- Restringir la política a Owner puede romper un flujo que hoy escriba como miembro (agente, MCP o importadores). Hay que comprobarlo antes de migrar.
- Las políticas de producción pueden diferir del repositorio: sin acceso a producción en este análisis.
- El catálogo de conexiones reales vive en dos sitios (lista `WORKING` de la página y, en otra rama, `PROVIDERS`). Este trabajo añade un mapa propio del plan y **no** unifica `WORKING` con él: decisión de Fede del 2026-11-06 (antes este punto pedía unificar). Riesgo asumido: pueden desalinearse.

## 8. Orden de entrega (solo iniciativas)
No aplica (una feature).

## 9. Aprobación
- [x] Fede aprueba el PRD (primer GO de dirección). Fecha: 2026-11-06
- Al aprobar, el Estado pasa a «Aprobado».
- Decisión de §6 «¿Bloquear?»: Fede aprobó el PRD con la recomendación incluida (no bloquear; etiqueta de conexión aparte), 2026-11-06.
