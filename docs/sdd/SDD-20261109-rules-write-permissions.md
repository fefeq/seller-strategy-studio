# SDD-20261109-rules-write-permissions · [Mejora] Solo Owner y Sales Leader escriben Reglas y marcan documentos obligatorios

**Tipo:** Mejora (el ledger la registra como `feature`; ver §15.1) · **Prioridad propuesta:** Alta (desde NK-0087 una regla de equipo es instrucción para el agente de todos)
**Estado:** Borrador · **Pide:** Fede (Sprint 2, alcance aprobado el 2026-11-09) · **Aprueba:** Fede · **Fecha:** 2026-11-09
**Ticket:** NK-0095
**PRD:** No aplica (mejora acotada de permisos; la decisión de qué hacer ya la tomó Fede el 2026-11-06 y el alcance del Sprint 2 el 2026-11-09) · **Depende de:** `SDD-20261106-agent-rules-reader.md` (NK-0087, Hecho: define qué cuenta como regla, `isMandatory`) · **Coordina con:** NK-0096 (Reglas en ai-core, biblioteca y MCP), que también toca `src/lib/knowledge-rules.ts`

> Números de línea comprobados en `f59681f` (worktree `seller-strategy-studio-s2docs`, rama `docs/sprint2-sdds-20261109`).

## 1. Resumen
Hoy cualquier miembro de la empresa puede crear, editar y marcar como «De obligado cumplimiento» un documento de equipo, y la importación de Drive puede escribir en la sección Reglas; desde NK-0087 ese texto entra en el agente de todos como regla. Este SDD limita a Owner y Sales Leader (roles de `org_members`) la escritura de **documentos vinculantes**: documentos de equipo de la sección `rules` o con `mandatory = true`, incluido marcar o desmarcar `mandatory`. Lo impone la base de datos (dos políticas RLS restrictivas nuevas, sin tocar filas existentes), lo repite el código en los caminos con cliente privilegiado (importación de Drive en segundo plano, agente por Telegram) y la pantalla Conocimiento lo muestra (Reglas en solo lectura y casilla deshabilitada con el motivo para el resto).

## 2. Problema y para quién
Owner y Sales Leader escriben reglas que el agente cumple en cada conversación, seguimiento y preparación de reunión. Cualquier otro miembro (AE, SDR, CS…) o un archivo de Drive importado por él puede añadir o cambiar esas reglas, y el agente de todo el equipo las obedecería. Es una inyección entre usuarios que NK-0087 dejó declarada como riesgo (`SDD-20261106-agent-rules-reader.md:114`, §15.2) para este ticket.

## 3. Evidencia y por qué ahora
**Qué es una regla (NK-0087, aprobado y entregado):**
- `src/lib/knowledge-rules.ts:18`: `isMandatory = !!d.mandatory || d.section === "rules"`.
- `src/lib/knowledge-rules.ts:56`: el agente solo lee documentos con `scope === "team"` e `isMandatory`; la lectura del servidor filtra igual (`:111-112`). Un documento personal nunca llega al agente.

**Quién puede escribir hoy (base de datos):**
- `drizzle/migrations/0002_multitenant_organizations.sql:128`: inserción en `knowledge_docs` solo exige `is_org_member(org_id)`.
- `drizzle/migrations/0002_multitenant_organizations.sql:129`: actualización con `using` de empresa actual + miembro + (`scope = 'team'` o autor) y `with check (is_org_member(org_id))`: nada mira `section` ni `mandatory`.
- `drizzle/migrations/0002_multitenant_organizations.sql:130`: borrar ya es solo del Owner.
- Ninguna migración posterior toca políticas de `knowledge_docs` (búsqueda de `knowledge_docs` en `drizzle/migrations/*.sql`: solo 0000, 0002, 0020, 0022, 0028).
- La columna `mandatory` solo aparece en SQL comentado (`0022_ai_sources_and_copy_status.sql:3`, «cannot be applied: its changes are already in the database»); los tipos generados la tienen (`src/integrations/supabase/types.ts:2623`). La 0080 (captura de esquema sin versionar) no incluye `knowledge_docs`.

**Quién puede escribir hoy (pantalla):**
- `src/components/hub/doc-editor.tsx:44-61`: la casilla «De obligado cumplimiento» se ofrece en todo documento de equipo, a cualquier rol (solo se deshabilita en Reglas porque allí siempre lo es).
- `src/components/hub/doc-editor.tsx:63-68`: «Guardar» para cualquier rol.
- `src/components/hub/hub-screen.tsx:341-353`: «+ Nuevo» e «Importar de Drive» en todas las secciones, Reglas incluida, sin mirar el rol.
- `src/components/hub/hub-screen.tsx:217-242`: el guardado envía `mandatory` en cada inserción y actualización (`:227`, `:239`).
- Precedente en la misma pantalla: `canLibrary` (`hub-screen.tsx:200`) ya limita la biblioteca de playbooks a `owner`/`sales_leader`; `isOwner` (`:199`) limita «Eliminar».

**Importación de Drive y agente:**
- `src/lib/drive-core.ts:143-152`: `importToKnowledge(s, ref, section)` inserta en la sección pedida, `scope` de equipo salvo `skills`; no recibe roles (`DriveScope = { db, orgId, userId }`, `drive-core.ts:11`).
- Tres caminos lo llaman:
  1. Pantalla, en el momento: `src/lib/drive.functions.ts:24-30`, con el cliente de la persona (`scope()` en `:11-14` usa `userCtx(context.supabase, …)`), así que la RLS sí aplica.
  2. Segundo plano: `src/components/drive.tsx:101-102` lanza `drive_import` para los PDF; `src/lib/background.functions.ts:48-59` acepta `section: "rules"`, `authorize` (`:190-206`) no exige rol para `drive_import` (no está en `ORG_WIDE`, `:179-185`), y `src/lib/inngest/job-runner.server.ts:192-201` llama a `importToKnowledge` con el cliente admin (sin RLS).
  3. Agente/MCP: herramienta `drive_import_to_knowledge` (`src/lib/agent/tools/drive.ts:44-54`, `section` incluye `rules` en `:6`), sin `roles`. MCP la expone desde el mismo registro y crea una acción pendiente (`src/lib/mcp/tools/agent-tools.ts:150-153`, `:167`); se ejecuta al confirmar con `executeTool` (`src/lib/agent.functions.ts:143`). Por Telegram corre con el cliente privilegiado (`src/lib/agent/tool-kit.ts:1-3`).
- Otros escritores de `knowledge_docs` por código no escriben documentos vinculantes: battlecard (`src/lib/agent/tools/linkedin.ts:61`, `src/lib/inngest/job-runner.server.ts:146-156`, sección `objections`) y biblioteca de playbooks (`src/lib/playbooks/library-core.ts:28`, ya solo Owner/Sales Leader). Ninguno envía `mandatory`.
- Alta de empresa: `create_organization` siembra un documento de Reglas (`0002_multitenant_organizations.sql:226-230`) después de dar al creador el rol `owner` (`:201`).

**Roles y mensajes ya existentes:**
- `src/lib/agent/tool-kit.ts:37`: `isLeader` (owner o sales_leader). `src/hooks/use-me.ts:30`: `roles` es el rol en la empresa actual.
- `src/lib/errors.ts:14`: un error RLS/42501 ya se traduce a «Tu rol no permite hacer este cambio. Pídeselo al Owner o a un Sales Leader de la empresa.»
- `src/lib/save.ts:6-7`, `:12-17`: una actualización que no toca filas devuelve `NOT_SAVED`.
- Superadmins: un trigger los hace Owner de cada empresa (`AGENTS.md`; `drizzle/migrations/0075_platform_admins.sql:21`, `:34`), así que la regla no necesita caso especial.

**Uso real:** sin dato (no hay medición de cuántos documentos de Reglas u obligatorios escribió cada rol).

**Por qué ahora:** NK-0087 está en `main` (PR #113): lo que se escribe en Reglas ya cambia el comportamiento del agente para todo el equipo.

## 4. Resultado buscado
- Ningún rol distinto de Owner o Sales Leader puede crear, editar ni borrar un documento vinculante, ni convertir uno normal en vinculante (marcar `mandatory`, moverlo a `rules`, pasarlo de personal a equipo) ni desvincularlo (desmarcar `mandatory`), por ningún camino (pantalla, API con su sesión, importación de Drive inmediata o en segundo plano, agente en la app, Telegram o MCP).
- Ningún documento existente cambia.
- Línea base: sin dato (no hay registro de escrituras por rol). Métrica de seguimiento: no se propone; el resultado es binario y lo prueban los CA.

## 5. Alcance
**Incluye:**
- Migración nueva `drizzle/migrations/0081_knowledge_binding_writers.sql` (número y `when` a re-sellar al integrar, §14) con una función SQL pura, dos políticas RLS restrictivas y sus GRANT; sin cambios de filas.
- Regla pura en `src/lib/knowledge-rules.ts`: qué es un documento vinculante y quién puede escribirlo, con los textos de motivo.
- Pantalla Conocimiento (`hub-screen.tsx`, `doc-editor.tsx`, `DriveImportButton` en `src/components/drive.tsx`): Reglas en solo lectura y casilla deshabilitada con el motivo para quien no es Owner ni Sales Leader.
- `importToKnowledge` recibe los roles y rechaza antes de leer Drive; sus tres llamadores le pasan los roles; `authorize` rechaza el lanzamiento de `drive_import` a Reglas.
- Herramienta `drive_import_to_knowledge`: descripción que lo dice y rechazo al ejecutar.

**No incluye:**
- Cambiar quién borra documentos (sigue solo el Owner, `0002:130`; ver §15.2).
- Cambiar documentos existentes (ni `mandatory`, ni `section`, ni autor), ni «limpiar» reglas escritas antes por otros roles.
- Cambiar qué lee el agente o cómo (NK-0087) ni llevar reglas a ai-core, biblioteca o MCP (NK-0096).
- Limitar documentos personales (no llegan al agente) ni otras secciones no vinculantes.
- Cambiar las políticas permisivas de `knowledge_docs` de la 0002 o la lectura (`org read`).
- Nuevas herramientas del agente o de MCP para editar Conocimiento.
- Retirar la columna `mandatory` o cambiar su significado.
- Revisar los GRANT por defecto de Supabase (decisión pendiente del anexo de la 0080).

## 6. Cambios de comportamiento (delta)
**Añadido:**
- Políticas restrictivas `knowledge binding insert` y `knowledge binding update` en `knowledge_docs`.
- Función `public.knowledge_doc_is_binding(section, scope, mandatory)`.
- `isBindingDoc`, `canWriteBinding`, `canEditDoc` y los textos `BINDING_SECTION_READ_ONLY`, `BINDING_READ_ONLY`, `BINDING_MARK_ONLY_LEADERS` y `BINDING_WRITE_DENIED` en `knowledge-rules.ts`.
- Texto de solo lectura en Reglas y en documentos obligatorios para quien no es Owner ni Sales Leader.

**Modificado:**
- Casilla «De obligado cumplimiento»: activa para cualquiera → activa solo para Owner y Sales Leader; deshabilitada con motivo para el resto.
- Sección Reglas: «+ Nuevo» e «Importar de Drive» activos para cualquiera → deshabilitados con motivo para el resto.
- Editor de un documento vinculante: editable por cualquiera → solo lectura (título y contenido) para el resto; «Guardar» deshabilitado.
- `importToKnowledge(s, ref, section)` → `importToKnowledge(s, ref, section, roles)`; a `rules` solo Owner o Sales Leader.
- `authorize` de trabajos en segundo plano: `drive_import` con `section: "rules"` exige Owner o Sales Leader.

**Eliminado:** nada.

## 7. Historias y criterios de aceptación
### H-1: Como Owner o Sales Leader, quiero que solo nosotros escribamos lo que el agente de todos cumple, para que nadie cambie sus instrucciones sin nosotros.
- **CA-1** (RLS, inserción) Con la migración aplicada, un miembro `ae` de la empresa A no puede insertar un documento de equipo con `section = 'rules'` ni uno de equipo con `mandatory = true` en otra sección: error de row-level security y ninguna fila nueva. Sí puede insertar un documento de equipo no obligatorio de otra sección y un documento personal en cualquier sección. · prueba: `src/lib/knowledge-binding.pg.test.ts`
- **CA-2** (RLS, edición) Un `ae` no puede: cambiar título o contenido de una regla de equipo ni de un documento de equipo obligatorio (la actualización no toca filas y el dato sigue igual); marcar `mandatory = true` en un documento de equipo; mover un documento de equipo a `rules`; pasar a equipo un documento personal suyo de `rules` o con `mandatory = true` (estos tres, error de row-level security); desmarcar `mandatory` de un documento de equipo (no toca filas). Sí puede seguir editando un documento de equipo no vinculante con `mandatory = false`. · prueba: `src/lib/knowledge-binding.pg.test.ts`
- **CA-3** (RLS, roles que sí) El `owner` y un `sales_leader` de la empresa A pueden hacer todo lo de CA-1 y CA-2. El `sales_leader` sigue sin poder borrar (política de la 0002 intacta); el `owner` sí. · prueba: `src/lib/knowledge-binding.pg.test.ts`
- **CA-4** (multiempresa) El `owner` de la empresa B no puede insertar ni editar documentos vinculantes de la empresa A (ni ninguno, como hoy). · prueba: `src/lib/knowledge-binding.pg.test.ts`
- **CA-5** (documentos existentes) Aplicar la migración no cambia ninguna fila de `knowledge_docs` (mismas filas, mismas columnas, comparadas antes y después) y aplicarla dos veces no falla. · prueba: `src/lib/knowledge-binding.pg.test.ts`
- **CA-6** (cliente privilegiado) El rol `service_role` (cliente admin: segundo plano, Telegram) no queda limitado por las políticas; por eso los CA-9 a CA-11 lo comprueban en código. · prueba: `src/lib/knowledge-binding.pg.test.ts`
- **CA-7** (regla pura) `isBindingDoc` es verdadero solo para `scope = "team"` con `section = "rules"` o `mandatory = true`; `canWriteBinding(roles)` es verdadero solo con `owner` o `sales_leader`; `canEditDoc(doc, roles)` devuelve `{ allowed, reason }` con el motivo de §9; la misma tabla de casos que CA-1/CA-2 da el mismo resultado que el SQL. · prueba: `src/lib/knowledge-rules.test.ts`

### H-2: Como miembro que no es Owner ni Sales Leader, quiero ver por qué no puedo cambiar una regla, para no perder lo que escribo.
- **CA-8** (pantalla) Con rol `ae`: en Reglas, «+ Nuevo» e «Importar de Drive» se ven deshabilitados y debajo dice «Solo el Owner o un Sales Leader pueden escribir reglas.»; al abrir una regla de equipo o un documento de equipo obligatorio de otra sección, título y contenido son de solo lectura, «Guardar» está deshabilitado y se lee «Solo lectura: las reglas y los documentos obligatorios los escriben el Owner o un Sales Leader.»; en un documento de equipo no vinculante la casilla «De obligado cumplimiento» está deshabilitada con «Solo el Owner o un Sales Leader pueden marcarlo como obligatorio.», y al guardar se envía `mandatory: false`. Con rol `owner` y con `sales_leader`, todo activo como hoy. Mientras el rol no ha cargado, todo lo vinculante se muestra deshabilitado. · prueba: `src/components/hub/hub-screen.test.tsx`

### H-3: Como Owner, quiero que ni la importación de Drive ni el agente salten la regla, porque corren con permisos de sistema.
- **CA-9** (importación, núcleo) `importToKnowledge` con `section = "rules"` y roles sin `owner` ni `sales_leader` lanza `BINDING_WRITE_DENIED` antes de leer el archivo (no se llama a Drive ni a la IA) y no inserta; con `owner` o `sales_leader`, o con otra sección, sigue como hoy. · prueba: `src/lib/drive-core.test.ts`
- **CA-10** (segundo plano) Lanzar `drive_import` con `section: "rules"` siendo `ae` se rechaza con `BINDING_WRITE_DENIED` sin crear el trabajo; y si el rol cambió entre el lanzamiento y la ejecución, el ejecutor (cliente admin) también lo rechaza, porque pasa los roles reconstruidos por `jobCtx` (`job-runner.server.ts:29-44`). · prueba: `src/lib/background-authorize.test.ts` y `src/lib/drive-core.test.ts`
- **CA-11** (agente, Telegram y MCP) `executeTool` de `drive_import_to_knowledge` con `section: "rules"` y roles `["ae"]` falla con `BINDING_WRITE_DENIED` y no inserta, con un `db` que simula el cliente privilegiado (sin RLS); con `["sales_leader"]` llega a `importToKnowledge` con esos roles. La descripción de la herramienta dice que Reglas es solo de Owner y Sales Leader. · prueba: `src/lib/agent-tools.test.ts`

## 8. Casos límite y errores
- **Documentos de Reglas escritos antes por otros roles:** se quedan como están (CA-5) y su autor deja de poder editarlos; solo Owner o Sales Leader. Es lo buscado: la regla obliga sin importar quién la escribió (§15.3).
- **Documento personal en Reglas o con `mandatory`:** permitido para cualquiera, el agente no lo lee (`knowledge-rules.ts:56`). Pasarlo a equipo es escribir un vinculante: solo Owner o Sales Leader (CA-2).
- **Mover de sección:** la pantalla no mueve documentos, pero la API sí podría; la comprobación sobre la fila nueva lo cubre (CA-2).
- **Edición rechazada por la política de lectura previa (`using`):** PostgREST devuelve 0 filas sin error y el guardado muestra `NOT_SAVED` (`save.ts:6-7`), no el texto de rol. La pantalla no ofrece esa edición (CA-8), así que solo llega por la API (§15.5).
- **Rechazo por la comprobación de la fila nueva (`with check`):** error 42501, que `errorText` ya traduce (`errors.ts:14`).
- **Rol aún sin cargar en la pantalla:** todo lo vinculante deshabilitado hasta tener `me` (CA-8); en Owner/Sales Leader se habilita al cargar.
- **Rol cambiado con la pantalla abierta:** la base de datos decide; la pantalla se corrige al recargar `useMe`.
- **Trabajo de Drive en cola cuando cambia el rol:** el ejecutor vuelve a comprobar con los roles actuales (CA-10).
- **Acción del agente propuesta por un AE para Reglas:** la propuesta se crea (las propuestas no comprueban argumentos por rol hoy) y falla al confirmar con el motivo (CA-11). Ver §15.4.
- **Otra empresa:** sin cambios respecto a hoy; CA-4 lo fija.
- **Alta de empresa:** `create_organization` inserta la regla inicial después de hacer Owner al creador (`0002:201`, `:226-230`), así que pasa la política aunque la función no la saltara. [Por verificar] la versión viva de `create_organization(_name, _segments)` (0020/0028 están comentadas).
- **Superadmin:** es Owner por trigger; ningún caso especial.
- **Borrado:** sin cambios (solo Owner).

## 9. Experiencia y copy
Textos (español, «tú» implícito, sin iconos; los tres viven en `knowledge-rules.ts` para que pantalla, servidor y agente digan lo mismo):
- `BINDING_SECTION_READ_ONLY` (bajo la descripción de Reglas, para el resto): «Solo el Owner o un Sales Leader pueden escribir reglas.»
- `BINDING_READ_ONLY` (en el editor de un documento vinculante, para el resto): «Solo lectura: las reglas y los documentos obligatorios los escriben el Owner o un Sales Leader.»
- `BINDING_MARK_ONLY_LEADERS` (bajo la casilla deshabilitada): «Solo el Owner o un Sales Leader pueden marcarlo como obligatorio.»
- `BINDING_WRITE_DENIED` (error de servidor, importación y agente; qué pasó + qué hacer): «Solo el Owner o un Sales Leader pueden escribir en Reglas o marcar documentos como obligatorios. Pídeselo a uno de ellos.»

Patrón: acción deshabilitada con el motivo al lado, nunca escondida (mismo criterio que `src/components/field-actions.tsx:6`, `:26-30`). La etiqueta «obligatorio» de la lista (`hub-screen.tsx:381-385`) no cambia. «Guardar en Drive» sigue disponible en solo lectura (es una lectura del documento).

## 10. Datos, permisos y privacidad
**Tablas y columnas:** ninguna nueva. La migración repite `alter table public.knowledge_docs add column if not exists mandatory boolean not null default false` para que la migración no falle en una base reconstruida desde el repo (la columna solo existe en SQL comentado, `0022:3`); en la base real no hace nada. [Por verificar] que la columna viva tiene exactamente ese tipo y valor por defecto.

**Función (nueva):**
```sql
create or replace function public.knowledge_doc_is_binding(_section text, _scope text, _mandatory boolean)
returns boolean language sql immutable set search_path = public as $$
  select _scope = 'team' and (_section = 'rules' or coalesce(_mandatory, false))
$$;
revoke all on function public.knowledge_doc_is_binding(text, text, boolean) from public, anon;
grant execute on function public.knowledge_doc_is_binding(text, text, boolean) to authenticated, service_role;
```

**Políticas (nuevas, restrictivas, se suman con AND a las permisivas de la 0002):**
```sql
drop policy if exists "knowledge binding insert" on public.knowledge_docs;
create policy "knowledge binding insert" on public.knowledge_docs as restrictive for insert to authenticated
  with check (not public.knowledge_doc_is_binding(section, scope, mandatory)
              or public.has_org_role(org_id, 'owner') or public.has_org_role(org_id, 'sales_leader'));
drop policy if exists "knowledge binding update" on public.knowledge_docs;
create policy "knowledge binding update" on public.knowledge_docs as restrictive for update to authenticated
  using (not public.knowledge_doc_is_binding(section, scope, mandatory)
         or public.has_org_role(org_id, 'owner') or public.has_org_role(org_id, 'sales_leader'))
  with check (not public.knowledge_doc_is_binding(section, scope, mandatory)
              or public.has_org_role(org_id, 'owner') or public.has_org_role(org_id, 'sales_leader'));
```
- `using` mira la fila antigua (editar o desvincular un vinculante); `with check` la nueva (crear, marcar, mover a `rules`, pasar a equipo). La comprobación de la fila nueva se evalúa después del trigger `set_audit`, que rellena `org_id`.
- Por qué restrictivas y no reescribir `org insert`/`org update`: no dependen de que la base viva tenga exactamente las políticas de la 0002 (si hubiera otra permisiva, una restrictiva sigue limitando) y no tocan lo que ya funciona. Alternativa descartada en §13.
- Borrado: sin cambio (`org delete owner`, `0002:130`).

**GRANT:** la tabla ya concede `select, insert, update, delete` a `authenticated` (`0000_migration.sql:208`); la migración no los cambia. Solo añade el `revoke`/`grant` de la función. La prueba .pg comprueba que `authenticated` sigue pudiendo insertar un documento no vinculante (CA-1).

**Quién puede qué (después):**
| Acción sobre `knowledge_docs` | owner | sales_leader | resto de roles |
|---|---|---|---|
| Leer (equipo + personales propios) | sí | sí | sí |
| Crear/editar no vinculante | sí | sí | sí |
| Crear/editar/marcar/desmarcar vinculante | sí | sí | no |
| Borrar cualquiera | sí | no | no |

**Cliente privilegiado:** `service_role` salta la RLS; el código repite la regla en `importToKnowledge` y `authorize` (`src/lib/AGENTS.md`: «rules RLS or triggers give the app are enforced in code too»).

**Privacidad:** pruebas con empresas, personas y textos ficticios (`src/test/pg-harness.ts:113-124`); los logs no llevan el texto de ninguna regla ni del archivo importado.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| ninguna nueva | regla determinista | — | — |

El rechazo ocurre antes de `readFile`, así que un AE que intenta importar un PDF a Reglas ya no gasta la transcripción con IA (`drive-core.ts:124-131`).

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | Migración `0081_knowledge_binding_writers.sql` + entrada en `meta/_journal.json` (al final, `when` mayor que `1794139200000`, el de la 0080) + prueba .pg que crea `knowledge_docs` como en `types.ts:2617-2656` (Row, Insert, Update) con la RLS de la 0002 | CA-1, CA-2, CA-3, CA-4, CA-5, CA-6 | `src/lib/knowledge-binding.pg.test.ts` (sin la migración, un `ae` inserta una regla y el test falla) |
| U-2 | `isBindingDoc`, `canWriteBinding`, `canEditDoc` y textos en `knowledge-rules.ts`, con una tabla de casos compartida con el test .pg | CA-7 | `src/lib/knowledge-rules.test.ts` (las funciones no existen) |
| U-3 | `importToKnowledge(…, roles)` con rechazo previo; `drive.functions.ts`, `job-runner.server.ts` (roles de `jobCtx`) y `agent/tools/drive.ts` le pasan los roles; descripción de la herramienta | CA-9, CA-11 | `src/lib/drive-core.test.ts` (nuevo) y `src/lib/agent-tools.test.ts` (hoy importa a Reglas con roles `ae`) |
| U-4 | `authorize` rechaza `drive_import` a `rules` sin Owner/Sales Leader (exportar `authorize` o una función pura que la envuelva para probarla) | CA-10 | `src/lib/background-authorize.test.ts` (nuevo; hoy el lanzamiento se acepta) |
| U-5 | Pantalla: `hub-screen.tsx` (botones de Reglas y texto), `doc-editor.tsx` (solo lectura, casilla y `Guardar`), `DriveImportButton` acepta `disabled` y motivo | CA-8 | `src/components/hub/hub-screen.test.tsx` (con `roles: ["ae"]` en el mock de `useMe`, hoy en `:65` es `["owner"]`; los botones salen activos) |

Orden: U-1 y U-2 primero (independientes); U-3 y U-4 usan U-2; U-5 usa U-2.

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- **Arnés .pg:** `src/test/pg-harness.ts` no crea `knowledge_docs`. El test la crea con las columnas de `types.ts:2617-2630`, `org_id default current_org()`, el trigger `set_audit` del arnés, los GRANT de `0000:208-209` y las cuatro políticas de `0002:127-130` copiadas tal cual, añade un `sales_leader` a la empresa A (como `plays.pg.test.ts:27-29`) y aplica la 0081 con `migrate`. CA-5: `select md5(string_agg(t::text, ',' order by id)) from knowledge_docs t` antes y después, y segunda aplicación sin error.
- **Una sola definición:** el predicado vive en SQL (`knowledge_doc_is_binding`) y en TS (`isBindingDoc`, que reutiliza `isMandatory` de `knowledge-rules.ts:18`). Una tabla de casos exportada desde el test de U-2 (o un fixture en `src/test/`) la usan los dos tests para que no diverjan.
- **Rol líder:** `canWriteBinding` no importa de `agent/tool-kit.ts` (`knowledge-rules.ts` lo usa la pantalla); define `["owner","sales_leader"]` y `isLeader` puede seguir donde está.
- **`DriveScope`:** no añadir `roles` al tipo (lo usan todas las funciones de Drive); pasar `roles` como cuarto argumento de `importToKnowledge` solo.
- **Proponer vs ejecutar (agente):** hoy `roles` en `AgentTool` es por herramienta (`tool-kit.ts:16`), no por argumento. Separar `drive_import_to_knowledge` en dos herramientas obligaría a tocar `TITLES` y `.lovable/mcp/manifest.json`; se descarta. Rechazar al ejecutar basta para la seguridad; avisar antes es §15.4.
- **Alternativa descartada:** reescribir las políticas permisivas `org insert`/`org update` con el rol dentro. Más corto de leer, pero depende de que la base viva tenga esas políticas exactas ([Por verificar] §16) y cambia políticas que ya funcionan.
- **Alternativa descartada:** trigger `before insert or update` con mensaje propio (como `positioning_copy_guard`, `0022`, comentado). Daría el mensaje de rol también en ediciones de vinculantes, pero un trigger que lee `auth.uid()` falla con el cliente privilegiado igual que `guard_approval` (`src/lib/AGENTS.md`, «Known gap») salvo excepción explícita; la RLS restrictiva no tiene ese problema porque `service_role` la salta.
- **Documentación:** al entregar, una línea en `src/lib/AGENTS.md` (quién escribe vinculantes, RLS + código) y en `docs/BASE-DE-DATOS.md` (políticas de `knowledge_docs`).

## 14. Riesgos y dependencias
- **Numeración de migraciones:** NK-0094 y NK-0096 se redactan a la vez y pueden añadir migraciones. Quien integre en segundo lugar re-sella el número y el `when` por encima del máximo de `main` y pasa `check-migration-journal.mjs` (`src/lib/AGENTS.md`, journal append-only; reglas en `src/lib/migrations-journal.ts`). [Por verificar] la ruta del script: no está en `git ls-files` de este worktree.
- **Aplicación en la base real:** la migración no se aplica sola; la aplica una persona o el agente de Lovable (`docs/BASE-DE-DATOS.md:153`). Hasta entonces la pantalla ya se ve en solo lectura pero la API sigue abierta: entregar código y migración juntos, y anotar en la entrega si la migración está aplicada.
- **Conflicto con NK-0096:** las dos tocan `src/lib/knowledge-rules.ts`. Contrato: este SDD solo añade exportaciones nuevas y no cambia las existentes (`isMandatory`, `pickRules`, `loadAgentRules`).
- **Equipos sin Owner activo ni Sales Leader:** nadie podría actualizar las reglas salvo el Owner; en la práctica cada empresa tiene Owner (el creador). Sin dato de empresas sin Sales Leader.
- **Pérdida de edición para autores actuales:** un AE que escribió una regla deja de poder corregirla. Aceptado (§8, §15.3).
- **Riesgo residual de inyección:** un Owner o Sales Leader que importa un archivo externo a Reglas sigue convirtiendo texto externo en regla; las escrituras del agente siguen siendo propuestas (NK-0087). Fuera de alcance.

## 15. Preguntas para Fede y para la revisión técnica
1. **Nivel y tipo.** El ledger registra NK-0095 como `feature`, lo que pediría PRD + SDD. Propongo tratarla como mejora acotada (solo SDD): el qué ya lo decidió Fede el 2026-11-06 y no hay objetivos de negocio nuevos que fijar. Recomendación: solo SDD.
2. **¿Puede el Sales Leader borrar reglas?** Hoy solo el Owner borra cualquier documento (`0002:130`, `roles.ts:64-67`), y `AGENTS.md` fija que solo el Owner borra. Recomendación: no cambiarlo; el Sales Leader crea y edita, el Owner borra.
3. **Reglas escritas antes por otros roles.** Quedan como están y solo Owner/Sales Leader las editan. Alternativa: dejar al autor editar las suyas. Recomendación: no; la regla obliga al agente de todos sea cual sea el autor.
4. **¿Rechazar ya al proponer la acción del agente?** Hoy la propuesta de un AE para importar a Reglas se crea y falla al confirmar con el motivo (CA-11). Avisar antes exigiría una comprobación por argumentos en el registro de herramientas, que hoy no existe. Recomendación: dejarlo al ejecutar en este ticket (la descripción de la herramienta ya orienta al modelo) y, si molesta en uso, ticket aparte.
5. **Mensaje al editar un vinculante por la API.** La política `using` devuelve 0 filas y la persona ve `NOT_SAVED`, no el texto de rol. La pantalla no ofrece esa edición. Recomendación: aceptarlo; un trigger con mensaje propio tendría el problema del cliente privilegiado (§13).
6. **Documentos personales en Reglas.** Se siguen permitiendo a cualquiera (el agente no los lee). Recomendación: permitirlos; restringirlos no protege nada.
7. **Rol Enablement** («Playbooks, objeciones y battlecards», `roles.ts:10`): no puede marcar obligatorios. Recomendación: mantener solo Owner y Sales Leader, como dice el ticket; ampliarlo sería otra decisión.
8. **Revisión técnica:** confirmar que la RLS restrictiva se comporta igual en Supabase que en PGlite (`with check` tras triggers `before`, `using` sobre la fila antigua) y que no hay otra vía de escritura a `knowledge_docs` con cliente privilegiado que escriba `rules` o `mandatory`.

**Decisiones del coordinador (2026-11-09, ejecución delegada por Fede: «sí, ese alcance, ejecuta todo tú»):** se aceptan las recomendaciones del autor para todas las preguntas: 1 SDD sin PRD; 2 el Sales Leader no borra reglas (solo el Owner); 3 el autor sin rol no puede editar reglas que ya escribió; 4 la acción del agente se rechaza al confirmar; 5 se acepta el mensaje genérico `NOT_SAVED` por API; 6 se siguen permitiendo documentos personales en Reglas; 7 Enablement no se incluye; 8 la revisión técnica confirma el comportamiento de la RLS restrictiva. Código y migración se entregan juntos.

## 16. Pendiente de verificar
- [Por verificar] Las políticas vivas de `knowledge_docs` son las de `0002:127-130` y no hay otras (consulta de solo lectura a `pg_policies` desde el panel de base de datos de Lovable). El diseño restrictivo no depende de ello, pero la prueba .pg las copia de la 0002.
- [Por verificar] Tipo y valor por defecto de `knowledge_docs.mandatory` en la base viva (`information_schema.columns`); `types.ts:2623` solo dice `boolean` no nulo.
- [Por verificar] Versión viva de `create_organization(_name, _segments)` y si siembra una regla (0020 y 0028 están comentadas); sea cual sea, el creador ya es Owner al insertar.
- [Por verificar] Que el ejecutor de acciones confirmadas por Telegram pasa los roles de la persona en `ctx.roles` (el código de la app lo hace en `agent.functions.ts:143`; no se leyó el camino de Telegram).
- [Por verificar] Ruta de `check-migration-journal.mjs` (citado en `src/lib/AGENTS.md`, no encontrado en `git ls-files`).
- [Por verificar] Que la versión de PGlite del repo (`package.json:89`, `^0.5.11`) acepta `as restrictive` (lo demuestra el propio test de U-1 al fallar o pasar).

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Un agente `nokko-gate` con contexto fresco lee este SDD y el código, y devuelve su informe. El coordinador lo copia aquí sin editarlo. El gate no aprueba el SDD: informa; la aprobación es de Fede.
- Veredicto del gate: No revisado
- CA sin prueba posible o sin G-n: —
- [Por verificar] que sigue sin comprobarse: —
- Contradicciones con el código o con decisiones previas: —
- Lo que esta revisión NO demuestra: —

## 18. Delta de implementación (lo rellena el agente al entregar)
—
