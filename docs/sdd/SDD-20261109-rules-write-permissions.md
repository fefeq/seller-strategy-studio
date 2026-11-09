# SDD-20261109-rules-write-permissions · [Mejora] Solo Owner y Sales Leader escriben Reglas y marcan documentos obligatorios

**Tipo:** Mejora (el ledger la registra como `feature`; ver §15.1) · **Prioridad propuesta:** Alta (desde NK-0087 una regla de equipo es instrucción para el agente de todos)
**Estado:** Aprobado el 2026-11-09 por delegación de Fede («sí, ese alcance, ejecuta todo tú»), segunda pasada del gate sin objeciones · **Pide:** Fede (Sprint 2, alcance aprobado el 2026-11-09) · **Aprueba:** Fede · **Fecha:** 2026-11-09
**Ticket:** NK-0095
**PRD:** No aplica (mejora acotada de permisos; la decisión de qué hacer ya la tomó Fede el 2026-11-06 y el alcance del Sprint 2 el 2026-11-09) · **Depende de:** `SDD-20261106-agent-rules-reader.md` (NK-0087, Hecho: define qué cuenta como regla, `isMandatory`) · **Coordina con:** NK-0096 (Reglas en ai-core, biblioteca y MCP), que también toca `src/lib/knowledge-rules.ts` y `.lovable/mcp/manifest.json` y **depende de esta entrega** (§14); NK-0094, que comparte `src/lib/agent-tools.test.ts` y el manifiesto; NK-0093 (ya integrado), que cambió `src/lib/drive-core.ts`

> **Base de construcción:** rama `integration/sprint2-20261109` (`19beb33`), que ya contiene NK-0098 (`src/routes/_authenticated/route.tsx`, `src/lib/session-check.ts`), NK-0091 (`src/lib/advisor.ts`) y NK-0093 (`src/hooks/use-leads.ts`, `src/components/stripe-panel.tsx`, `src/lib/drive-core.ts`, `src/components/pipeline-board-panel.tsx` —solo el estado de carga/error de leads—, `src/components/leads/lead-funnel-panel.tsx`, `src/routes/_authenticated/leads.index.tsx`). Números de línea comprobados en `f59681f` (= `main`); los de `src/lib/drive-core.ts` están comprobados en `integration/sprint2-20261109`, porque NK-0093 lo reformateó y los movió. El resto de archivos que cita este SDD no cambia entre `f59681f` y esa rama (`git diff f59681f integration/sprint2-20261109`: `background.functions.ts`, `job-runner.server.ts`, `agent/tools/drive.ts`, `agent.functions.ts`, `drive.tsx`, `hub-screen.tsx`, `doc-editor.tsx`, `hub-screen.test.tsx`, `agent-tools.test.ts`, `knowledge-rules.ts`, `errors.ts`, `save.ts` y `.lovable/mcp/manifest.json` sin cambios).

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
- `src/lib/drive-core.ts:269-288` (rama de integración): `importToKnowledge(s, ref, section)` lee el archivo (`:271`) e inserta en la sección pedida (`:275`), `scope` de equipo salvo `skills` (`:280`); no recibe roles (`DriveScope = { db, orgId, userId }`, `drive-core.ts:35`).
- Tres caminos lo llaman:
  1. Pantalla, en el momento: `src/lib/drive.functions.ts:24-30`, con el cliente de la persona (`scope()` en `:11-14` usa `userCtx(context.supabase, …)`), así que la RLS sí aplica.
  2. Segundo plano: `src/components/drive.tsx:101-102` lanza `drive_import` para los PDF; `src/lib/background.functions.ts:48-59` acepta `section: "rules"`, `authorize` (`:191-253`; el único chequeo de rol es el de `ORG_WIDE` en `:206`) no exige rol para `drive_import` (no está en `ORG_WIDE`, `:179-185`), y `src/lib/inngest/job-runner.server.ts:192-201` llama a `importToKnowledge` con el cliente admin (sin RLS) y con `{ db, orgId, userId }` (`:196`): no llama a `jobCtx` (`:29-47`, que sí reconstruye `roles` desde `org_members`, `:36`, `:43`) y el ámbito que recibe `runKind` tampoco lleva roles (`:75`, `:133-138`).
  3. Agente/MCP: herramienta `drive_import_to_knowledge` (`src/lib/agent/tools/drive.ts:44-54`, `section` incluye `rules` en `:6`), sin `roles`. MCP la expone desde el mismo registro y crea una acción pendiente (`src/lib/mcp/tools/agent-tools.ts:150-153`, `:167`); se ejecuta al confirmar con `executeTool`, que tiene tres llamadores en `src/lib/agent.functions.ts`: `decidePending` (`:143`), `applySetupItems` (`:199`, cliente de la persona) y `decideSuggestionCore` (`:368`). Por Telegram, `decidePending` y `decideSuggestionCore` corren con el cliente privilegiado (`src/lib/agent/tool-kit.ts:1-3`) y con el `ctx` de `channelCtx` (`src/routes/api/public/telegram/webhook.ts:50`, `:56`, `:60`), que lee el rol de `org_members` en la empresa actual (`src/lib/channel-ctx.server.ts:11`, `:15`). Los tres quedan cubiertos porque el rechazo vive en `importToKnowledge` y en la herramienta. La descripción de la herramienta está copiada en `.lovable/mcp/manifest.json:3820-3822`, que se regenera al cambiar herramientas (`src/lib/AGENTS.md:7`).
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
- `importToKnowledge` recibe los roles y rechaza antes de leer Drive; sus tres llamadores le pasan los roles (el caso `drive_import` del ejecutor en segundo plano, los de `jobCtx(db, job)`); `authorize` rechaza el lanzamiento de `drive_import` a Reglas.
- Herramienta `drive_import_to_knowledge`: descripción que lo dice y rechazo al ejecutar.
- `.lovable/mcp/manifest.json` regenerado con `node node_modules/@lovable.dev/mcp-js/dist/cli/extract-manifest.cjs .` (nunca editado a mano), porque copia la descripción de la herramienta (`manifest.json:3822`).

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
- Ejecutor en segundo plano, caso `drive_import`: `{ db, orgId, userId }` sin roles → `jobCtx(db, job)` y `ctx.roles` a `importToKnowledge` (si la persona ya no es miembro, `jobCtx` falla con «Ya no perteneces a esta empresa.», `job-runner.server.ts:38`).
- Descripción de `drive_import_to_knowledge` (y su copia en `.lovable/mcp/manifest.json`): añade que Reglas es solo de Owner y Sales Leader.

**Eliminado:** nada.

## 7. Historias y criterios de aceptación
### H-1: Como Owner o Sales Leader, quiero que solo nosotros escribamos lo que el agente de todos cumple, para que nadie cambie sus instrucciones sin nosotros.
- **CA-1** (RLS, inserción) Con la migración aplicada, un miembro `ae` de la empresa A no puede insertar un documento de equipo con `section = 'rules'` ni uno de equipo con `mandatory = true` en otra sección: error de row-level security y ninguna fila nueva. Sí puede insertar un documento de equipo no obligatorio de otra sección y un documento personal en cualquier sección. · prueba: `src/lib/knowledge-binding.pg.test.ts`
- **CA-2** (RLS, edición) Un `ae` no puede: cambiar título o contenido de una regla de equipo ni de un documento de equipo obligatorio (la actualización no toca filas y el dato sigue igual); marcar `mandatory = true` en un documento de equipo; mover un documento de equipo a `rules`; pasar a equipo un documento personal suyo de `rules` o con `mandatory = true` (estos tres, error de row-level security); desmarcar `mandatory` de un documento de equipo (no toca filas). Sí puede seguir editando un documento de equipo no vinculante con `mandatory = false`. · prueba: `src/lib/knowledge-binding.pg.test.ts`
- **CA-3** (RLS, roles que sí) El `owner` y un `sales_leader` de la empresa A pueden hacer todo lo de CA-1 y CA-2. El `sales_leader` sigue sin poder borrar (política de la 0002 intacta); el `owner` sí. · prueba: `src/lib/knowledge-binding.pg.test.ts`
- **CA-4** (multiempresa) El `owner` de la empresa B no puede insertar ni editar documentos vinculantes de la empresa A (ni ninguno, como hoy). · prueba: `src/lib/knowledge-binding.pg.test.ts`
- **CA-5** (documentos existentes) Aplicar la migración no cambia ninguna fila de `knowledge_docs` (mismas filas, mismas columnas, comparadas antes y después) y aplicarla dos veces no falla. · prueba: `src/lib/knowledge-binding.pg.test.ts`
- **CA-6** (cliente privilegiado) El rol `service_role` (cliente admin: segundo plano, Telegram) no queda limitado por las políticas; por eso los CA-9 a CA-11 lo comprueban en código. · prueba: `src/lib/knowledge-binding.pg.test.ts`
- **CA-7** (regla pura) `isBindingDoc` es verdadero solo para `scope = "team"` con `section = "rules"` o `mandatory = true`; `canWriteBinding(roles)` es verdadero solo con `owner` o `sales_leader`; `canEditDoc(doc, roles)` devuelve `{ allowed, reason }` con el motivo de §9; la misma tabla de casos que CA-1/CA-2 (fixture compartido `src/test/knowledge-binding-cases.ts`) da el mismo resultado en TS que en el SQL. · prueba: `src/lib/knowledge-rules.test.ts` (recorre el fixture con `isBindingDoc`/`canWriteBinding`) y `src/lib/knowledge-binding.pg.test.ts` (recorre el mismo fixture con `knowledge_doc_is_binding` y las políticas); los dos juntos demuestran la equivalencia

### H-2: Como miembro que no es Owner ni Sales Leader, quiero ver por qué no puedo cambiar una regla, para no perder lo que escribo.
- **CA-8** (pantalla) Con rol `ae`: en Reglas, «+ Nuevo» e «Importar de Drive» se ven deshabilitados y debajo dice «Solo el Owner o un Sales Leader pueden escribir reglas.»; al abrir una regla de equipo o un documento de equipo obligatorio de otra sección, título y contenido son de solo lectura, «Guardar» está deshabilitado y se lee «Solo lectura: las reglas y los documentos obligatorios los escriben el Owner o un Sales Leader.»; en un documento de equipo no vinculante la casilla «De obligado cumplimiento» está deshabilitada con «Solo el Owner o un Sales Leader pueden marcarlo como obligatorio.», y al guardar se envía `mandatory: false`. Con rol `owner` y con `sales_leader`, todo activo como hoy. Mientras el rol no ha cargado, todo lo vinculante se muestra deshabilitado. · prueba: `src/components/hub/hub-screen.test.tsx`, con dos cambios en los mocks: `useMe` (hoy constante con `["owner"]`, `:64-66`) pasa a un valor por test con `vi.hoisted` para `ae`, `sales_leader`, `owner` y «sin cargar» (`data: undefined`); y el mock de `DriveImportButton` (`:70-73`, hoy un botón que ignora `disabled`) pasa `disabled` al botón y pinta el motivo, para que la prueba vea lo que vería la persona

### H-3: Como Owner, quiero que ni la importación de Drive ni el agente salten la regla, porque corren con permisos de sistema.
- **CA-9** (importación, núcleo) `importToKnowledge` con `section = "rules"` y roles sin `owner` ni `sales_leader` lanza `BINDING_WRITE_DENIED` antes de leer el archivo (no se llama a Drive ni a la IA) y no inserta; con `owner` o `sales_leader`, o con otra sección, sigue como hoy. · prueba: `src/lib/drive-core.test.ts`
- **CA-10** (segundo plano) Dos tramos, cada uno con su prueba:
  - (a) Lanzamiento: lanzar `drive_import` con `section: "rules"` siendo `ae` se rechaza con `BINDING_WRITE_DENIED` sin crear el trabajo (no hay inserción en `background_jobs`); con `owner` o `sales_leader`, o con otra sección siendo `ae`, `authorize` no lanza. · prueba: `src/lib/background-authorize.test.ts`
  - (b) Ejecución: si el rol cambió entre el lanzamiento y la ejecución, el ejecutor (cliente admin) también lo rechaza, porque el caso `drive_import` llama a `jobCtx(db, job)` y pasa `ctx.roles` a `importToKnowledge`. Con un `db` admin falso cuyo `org_members` devuelve `[{ role: "ae" }]` y un trabajo `drive_import` a `rules`, `runBackgroundJob(db, jobId)` rechaza con `BINDING_WRITE_DENIED`, deja el trabajo en `status: "failed"` con `error` igual a `BINDING_WRITE_DENIED`, no inserta en `knowledge_docs` y no llama a Drive (`@/lib/google-drive` simulado: `getFile`, `exportText`, `downloadBytes` sin llamadas); con `org_members` → `sales_leader` sí llega a la inserción. Un `importToKnowledge(…, ["owner"])` fijo en el ejecutor hace fallar esta prueba. · prueba: `src/lib/inngest/job-runner.test.ts` (si `runBackgroundJob` resulta difícil de simular, exportar `runKind` y probar el caso `drive_import` directamente, con las mismas aserciones salvo la del estado del trabajo)
- **CA-11** (agente, Telegram y MCP) `executeTool` de `drive_import_to_knowledge` con `section: "rules"` y roles `["ae"]` falla con `BINDING_WRITE_DENIED` y no inserta, con un `db` que simula el cliente privilegiado (sin RLS); con `["sales_leader"]` llega a `importToKnowledge` con esos roles. Cubre los tres llamadores de `executeTool` (`agent.functions.ts:143`, `:199`, `:368`), porque el rechazo está en la herramienta y en `importToKnowledge`. La descripción de la herramienta dice que Reglas es solo de Owner y Sales Leader, y `.lovable/mcp/manifest.json` lleva la misma descripción. · prueba: `src/lib/agent-tools.test.ts`, en un `describe` propio de NK-0095 (el archivo lo comparte NK-0094); la comprobación del manifiesto, en el mismo `describe`, lee `manifest.json` como hacen las pruebas existentes del archivo

## 8. Casos límite y errores
- **Documentos de Reglas escritos antes por otros roles:** se quedan como están (CA-5) y su autor deja de poder editarlos; solo Owner o Sales Leader. Es lo buscado: la regla obliga sin importar quién la escribió (§15.3).
- **Documento personal en Reglas o con `mandatory`:** permitido para cualquiera, el agente no lo lee (`knowledge-rules.ts:56`). Pasarlo a equipo es escribir un vinculante: solo Owner o Sales Leader (CA-2).
- **Mover de sección:** la pantalla no mueve documentos, pero la API sí podría; la comprobación sobre la fila nueva lo cubre (CA-2).
- **Edición rechazada por la política de lectura previa (`using`):** PostgREST devuelve 0 filas sin error y el guardado muestra `NOT_SAVED` (`save.ts:6-7`), no el texto de rol. La pantalla no ofrece esa edición (CA-8), así que solo llega por la API (§15.5).
- **Rechazo por la comprobación de la fila nueva (`with check`):** error 42501, que `errorText` ya traduce (`errors.ts:14`). En la importación inmediata el error llega reescrito como `new Error(error.message)` (`drive-core.ts:286`, rama de integración), sin `code`; `errorText` lo traduce igual por el texto («row-level security», `errors.ts:14`). Antes de eso, el rechazo previo de `importToKnowledge` ya da `BINDING_WRITE_DENIED`, que pasa tal cual por ser texto propio en español.
- **Rol aún sin cargar en la pantalla:** todo lo vinculante deshabilitado hasta tener `me` (CA-8); en Owner/Sales Leader se habilita al cargar.
- **Rol cambiado con la pantalla abierta:** la base de datos decide; la pantalla se corrige al recargar `useMe`.
- **Trabajo de Drive en cola cuando cambia el rol:** el ejecutor vuelve a comprobar con los roles actuales de `jobCtx` (CA-10 b). Si la persona ya no es miembro, `jobCtx` falla antes con «Ya no perteneces a esta empresa.» (`job-runner.server.ts:38`). El fallo deja en el trabajo solo `errorText(e)` (`job-runner.server.ts:112-114`), sin texto de reglas ni del archivo.
- **Acción del agente propuesta por un AE para Reglas:** la propuesta se crea (las propuestas no comprueban argumentos por rol hoy) y falla al confirmar con el motivo (CA-11). Ver §15.4.
- **Otra empresa:** sin cambios respecto a hoy; CA-4 lo fija.
- **Alta de empresa:** `create_organization` inserta la regla inicial después de hacer Owner al creador (`0002:201`, `:226-230`), así que pasa la política aunque la función no la saltara. [Por verificar] la versión viva de `create_organization(_name, _segments)` (0020/0028 están comentadas).
- **Superadmin:** es Owner por trigger; ningún caso especial.
- **Borrado:** sin cambios (solo Owner).

## 9. Experiencia y copy
Textos (español, «tú» implícito, sin iconos; los cuatro viven en `knowledge-rules.ts` para que pantalla, servidor y agente digan lo mismo):
- `BINDING_SECTION_READ_ONLY` (bajo la descripción de Reglas, para el resto): «Solo el Owner o un Sales Leader pueden escribir reglas.»
- `BINDING_READ_ONLY` (en el editor de un documento vinculante, para el resto): «Solo lectura: las reglas y los documentos obligatorios los escriben el Owner o un Sales Leader.»
- `BINDING_MARK_ONLY_LEADERS` (bajo la casilla deshabilitada): «Solo el Owner o un Sales Leader pueden marcarlo como obligatorio.»
- `BINDING_WRITE_DENIED` (error de servidor, importación y agente; qué pasó + qué hacer): «Solo el Owner o un Sales Leader pueden escribir en Reglas o marcar documentos como obligatorios. Pídeselo a uno de ellos.»

Patrón: acción deshabilitada con el motivo al lado, nunca escondida (mismo criterio que `src/components/field-actions.tsx:6`, `:26-30`). Umbral de C2 (`SDD-20261106-ux-metrics-data-state.md:84`, `:138`, 160 caracteres): el motivo bajo la casilla (`BINDING_MARK_ONLY_LEADERS`, unos 65 caracteres) va en un elemento propio, separado de la explicación actual de la casilla (unos 135), para no juntar más de 160 en un mismo texto; la prueba de CA-8 busca el motivo por su texto exacto. La etiqueta «obligatorio» de la lista (`hub-screen.tsx:381-385`) no cambia. «Guardar en Drive» sigue disponible en solo lectura (es una lectura del documento).

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

El rechazo ocurre antes de `readFile`, así que un AE que intenta importar un PDF a Reglas ya no gasta la transcripción con IA (`drive-core.ts:230-245` en la rama de integración: `ask` con el PDF en base64).

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | Migración `0081_knowledge_binding_writers.sql` (número provisional: se fija al integrar, §14) + entrada en `meta/_journal.json` (al final, `when` mayor que `1794139200000`, el de la 0080 y máximo actual de `main` y de la rama de integración) + prueba .pg que crea `knowledge_docs` como en `types.ts:2617-2656` (Row, Insert, Update) con la RLS de la 0002 | CA-1, CA-2, CA-3, CA-4, CA-5, CA-6 | `src/lib/knowledge-binding.pg.test.ts` (sin la migración, un `ae` inserta una regla y el test falla) y `src/lib/migrations-journal.test.ts` (sigue en verde con la entrada nueva) |
| U-2 | `isBindingDoc`, `canWriteBinding`, `canEditDoc` y los cuatro textos en `knowledge-rules.ts`, con la tabla de casos en `src/test/knowledge-binding-cases.ts`, compartida con el test .pg de U-1 | CA-7 | `src/lib/knowledge-rules.test.ts` (las funciones no existen) |
| U-3 | `importToKnowledge(…, roles)` con rechazo previo (`drive-core.ts:269-288`, rama de integración); `drive.functions.ts` (roles de `userCtx`) y `agent/tools/drive.ts` le pasan los roles (el `scope` de `drive.ts:9` se tipa con `ToolCtx` de `tool-kit.ts:10`, sin extender el `db: any` actual); el caso `drive_import` de `job-runner.server.ts` (`:192-201`) llama a `jobCtx(db, job)` y pasa `ctx.roles`; descripción de la herramienta; `.lovable/mcp/manifest.json` regenerado con `node node_modules/@lovable.dev/mcp-js/dist/cli/extract-manifest.cjs .` | CA-9, CA-10 (b), CA-11 | `src/lib/drive-core.test.ts` (nuevo, CA-9: hoy lee Drive e inserta en Reglas con roles `ae`), `src/lib/inngest/job-runner.test.ts` (CA-10 b: hoy el trabajo de un `ae` a `rules` llama a Drive e inserta), `src/lib/agent-tools.test.ts` (CA-11: hoy importa a Reglas con roles `ae` y la descripción no lo dice) |
| U-4 | `authorize` (`background.functions.ts:191-253`) rechaza `drive_import` a `rules` sin Owner/Sales Leader (exportar `authorize` o una función pura que la envuelva para probarla) | CA-10 (a) | `src/lib/background-authorize.test.ts` (nuevo; hoy el lanzamiento se acepta) |
| U-5 | Pantalla: `hub-screen.tsx` (botones de Reglas y texto), `doc-editor.tsx` (solo lectura, casilla y `Guardar`; el motivo de la casilla en un elemento propio, §9), `DriveImportButton` acepta `disabled` y motivo | CA-8 | `src/components/hub/hub-screen.test.tsx` (mock de `useMe` por test con `vi.hoisted`, hoy constante en `:64-66` con `["owner"]`; mock de `DriveImportButton` de `:70-73` que respeta `disabled`; con `["ae"]` los botones salen activos y el test falla) |

Orden: U-1 y U-2 primero (independientes); U-3 y U-4 usan U-2; U-5 usa U-2. Cada U escribe primero su test, lo ve fallar en la base de construcción (`integration/sprint2-20261109`) y luego el código.

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- **Arnés .pg:** `src/test/pg-harness.ts` no crea `knowledge_docs`. El test la crea con las columnas de `types.ts:2617-2630`, `org_id default current_org()`, el trigger `set_audit` del arnés, los GRANT de `0000:208-209` y las cuatro políticas de `0002:127-130` copiadas tal cual, añade un `sales_leader` a la empresa A (como `plays.pg.test.ts:27-29`) y aplica la 0081 con `migrate`. CA-5: `select md5(string_agg(t::text, ',' order by id)) from knowledge_docs t` antes y después, y segunda aplicación sin error.
- **Una sola definición:** el predicado vive en SQL (`knowledge_doc_is_binding`) y en TS (`isBindingDoc`, que reutiliza `isMandatory` de `knowledge-rules.ts:18`). La tabla de casos vive en `src/test/knowledge-binding-cases.ts` y la usan `knowledge-rules.test.ts` y `knowledge-binding.pg.test.ts`, para que no diverjan (CA-7).
- **Ejecutor en segundo plano (CA-10 b):** `src/lib/inngest/job-runner.test.ts` es nuevo (NK-0096 también lo crea para sus casos `stakeholder_research` y `playbook_library`; cada ticket va en su `describe`, y quien integre segundo añade el suyo al archivo ya existente). Simula `@/lib/google-drive` (sin llamadas), `@/lib/notices.server` (`deliverJobNotice`) y un `db` admin falso con `from(tabla)` encadenable que registra las escrituras: `background_jobs` devuelve el trabajo `drive_import` (`input: { file, section: "rules" }`), `organizations` una fila y `org_members` `[{ role: "ae" }]`. El fallo se ve en el `update` de `background_jobs` (`status: "failed"`, `error: errorText(e)`, `job-runner.server.ts:108-117`); `errorText` deja pasar `BINDING_WRITE_DENIED` porque es texto propio en español.
- **`drive-core.test.ts`:** no existe en la rama de integración (NK-0093 puso su prueba en `src/lib/drive-summaries-error.test.ts`), así que lo crea este ticket con un `describe` propio y `@/lib/google-drive` simulado.
- **Rol líder:** `canWriteBinding` no importa de `agent/tool-kit.ts` (`knowledge-rules.ts` lo usa la pantalla); define `["owner","sales_leader"]` y `isLeader` puede seguir donde está.
- **`DriveScope`:** no añadir `roles` al tipo (lo usan todas las funciones de Drive); pasar `roles` como cuarto argumento de `importToKnowledge` solo.
- **Proponer vs ejecutar (agente):** hoy `roles` en `AgentTool` es por herramienta (`tool-kit.ts:16`), no por argumento. Separar `drive_import_to_knowledge` en dos herramientas obligaría a añadir un título en `TITLES` y una herramienta más al manifiesto; se descarta. Rechazar al ejecutar basta para la seguridad; avisar antes es §15.4.
- **Manifiesto MCP:** cambiar solo la descripción de `drive_import_to_knowledge` ya cambia `.lovable/mcp/manifest.json` (la copia en `:3822`, con el sufijo «(Queda pendiente: el usuario la confirma en Nokko.)»). U-3 lo regenera con `node node_modules/@lovable.dev/mcp-js/dist/cli/extract-manifest.cjs .` y nunca lo edita a mano; el diff esperado es solo esa descripción. Contrato con NK-0096 y NK-0094 en §14.
- **Alternativa descartada:** reescribir las políticas permisivas `org insert`/`org update` con el rol dentro. Más corto de leer, pero depende de que la base viva tenga esas políticas exactas ([Por verificar] §16) y cambia políticas que ya funcionan.
- **Alternativa descartada:** trigger `before insert or update` con mensaje propio (como `positioning_copy_guard`, `0022`, comentado). Daría el mensaje de rol también en ediciones de vinculantes, pero un trigger que lee `auth.uid()` falla con el cliente privilegiado igual que `guard_approval` (`src/lib/AGENTS.md`, «Known gap») salvo excepción explícita; la RLS restrictiva no tiene ese problema porque `service_role` la salta.
- **Documentación:** al entregar, una línea en `src/lib/AGENTS.md` (quién escribe vinculantes, RLS + código) y en `docs/BASE-DE-DATOS.md` (políticas de `knowledge_docs`).

## 14. Riesgos y dependencias
- **Base de construcción:** `integration/sprint2-20261109` (NK-0098, NK-0091 y NK-0093 ya integrados). De lo que toca este ticket, solo `src/lib/drive-core.ts` cambió respecto a `f59681f` (NK-0093: resúmenes de Drive, y formato); NK-0095 toca solo `importToKnowledge` (`:269-288`) y no el bloque de resúmenes.
- **Numeración de migraciones:** en el Sprint 2 solo NK-0095 añade migración (NK-0094 y NK-0096 declaran «sin migraciones»; los briefs de NK-0091, NK-0093 y NK-0098 las prohíben). El número se fija al integrar: `0081` si `main` sigue terminando en la `0080`; si `main` ya tiene una `0081`, se usa el siguiente libre, y el `when` se re-sella por encima del máximo de `main`. Lo comprueba `src/lib/migrations-journal.test.ts` (reglas en `src/lib/migrations-journal.ts`); `check-migration-journal.mjs`, que cita `src/lib/AGENTS.md:58`, no existe en el repo.
- **Aplicación en la base real:** la migración no se aplica sola; la aplica una persona o el agente de Lovable (`docs/BASE-DE-DATOS.md:153`). Hasta entonces la pantalla ya se ve en solo lectura pero la API sigue abierta: entregar código y migración juntos, y anotar en la entrega si la migración está aplicada.
- **NK-0096 depende de esta entrega:** código y migración `0081` (o el número que se fije al integrar) aplicada en la base real. NK-0096 multiplica los sitios donde una regla es instrucción, y solo esta entrega acota quién la escribe. NK-0096 no se entrega a producción antes de que la entrega de NK-0095 confirme la migración aplicada.
- **Contrato con NK-0096 en `src/lib/knowledge-rules.ts`:** este SDD solo añade exportaciones nuevas y no cambia las existentes (`isMandatory`, `pickRules`, `loadAgentRules`, `rulesBlock`, `AGENT_RULE_LIMITS`, `RULES_READ_FAILED`).
- **Contrato del manifiesto `.lovable/mcp/manifest.json`:** NK-0095 se integra primero y lo regenera con el extractor en su rama. NK-0096 (`get_team_rules`) lo regenera después sobre la rama de integración que ya contiene NK-0095, y NK-0094 (descripciones de métricas) igual sobre la rama con los dos. Nunca se fusiona a mano: ante un conflicto, se regenera con `node node_modules/@lovable.dev/mcp-js/dist/cli/extract-manifest.cjs .` tras el merge.
- **Otros archivos compartidos del Sprint 2:** `src/lib/agent-tools.test.ts` (NK-0094 CA-10 y NK-0095 CA-11: cada uno en su `describe`, sin cambiar aserciones ajenas salvo que un CA propio lo exija, citándolo); `src/lib/inngest/job-runner.server.ts` (NK-0095 solo el caso `drive_import`, `:192-201`; NK-0096 `stakeholder_research` y `playbook_library`); `src/lib/inngest/job-runner.test.ts` (lo crean NK-0095 y NK-0096, cada uno en su `describe`). `hub-screen.tsx`, `doc-editor.tsx` y `src/components/drive.tsx` solo los cambia NK-0095.
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
- [Por verificar] Tipo y valor por defecto de `knowledge_docs.mandatory` en la base viva (`information_schema.columns`). En el repo: no nulo en Row (`types.ts:2623`) y opcional en Insert (`types.ts:2636`), así que tiene valor por defecto; `0022:3` dice `default false`. `add column if not exists` no hace nada si la columna existe, así que no bloquea.
- [Por verificar] Versión viva de `create_organization(_name, _segments)`. La última del repo (`0028:4-63`, comentada) es `security definer` (`:5`), así que no le aplica la RLS, y crea el Owner (`:12`) antes de sembrar la regla (`:55-59`).
- [Por verificar] Que la RLS restrictiva se comporta en Supabase como en PGlite (el gate lo reprodujo solo en PGlite 18.6).
- Resuelto (gate, 2026-11-09): Telegram pasa los roles de `org_members` en `ctx.roles` (`webhook.ts:50`, `:56`, `:60`; `channel-ctx.server.ts:11`, `:15`).
- Resuelto (gate): `check-migration-journal.mjs` no existe; las reglas del journal las comprueba `src/lib/migrations-journal.test.ts`. `src/lib/AGENTS.md:58` cita un script inexistente (fuera de alcance de este ticket).
- Resuelto (gate): la PGlite instalada (0.5.11, PostgreSQL 18.6) acepta `as restrictive`; `with check` ve la fila rellenada por el trigger `before`; `using` sobre la fila antigua devuelve 0 filas sin error.
- Resuelto (gate): no hay otra vía privilegiada que escriba vinculantes en `knowledge_docs` (`hub-screen.tsx:226`, `:233`; `src/components/linkedin.tsx:94`; `agent/tools/linkedin.ts:61`; `job-runner.server.ts:146-156`; `library-core.ts:28`; `drive-core.ts`); ninguna envía `mandatory`.
- Versión 2 (2026-11-09): corregida tras el gate. CA-10 partido en (a) lanzamiento, `background-authorize.test.ts`, y (b) ejecución, `src/lib/inngest/job-runner.test.ts`; U-3 hace que el caso `drive_import` llame a `jobCtx(db, job)` y pase `ctx.roles`. `.lovable/mcp/manifest.json` entra en §5 y U-3, regenerado con el extractor; §13 corregido; contrato del manifiesto con NK-0096 y NK-0094 en §14. §14: NK-0096 depende de esta entrega y el número de migración se fija al integrar. Base de construcción: `integration/sprint2-20261109`, con citas de `drive-core.ts` re-comprobadas ahí. Notas del gate incorporadas: fixture `src/test/knowledge-binding-cases.ts` (CA-7), mocks de `useMe` y `DriveImportButton` (CA-8), llamadores de `executeTool` (CA-11), cita de `authorize` (`:191-253`), «los cuatro» textos (§9), motivo de la casilla en elemento propio por el umbral de C2, `drive.ts:9` tipado con `ToolCtx`.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Informe de la primera pasada (v1), copiado sin editar:

- Veredicto del gate: Objeciones
- CA sin prueba posible o sin G-n: CA-10 solo en parte. El primer tramo (rechazo en `authorize` sin crear el trabajo) se puede probar en `src/lib/background-authorize.test.ts`. El segundo tramo («si el rol cambió, el ejecutor también lo rechaza con los roles de `jobCtx`») no se puede probar con los archivos nombrados: `drive-core.test.ts` solo prueba `importToKnowledge` con los roles que recibe, y ningún test ejecuta `runBackgroundJob`/`runKind` (`grep runBackgroundJob|job-runner` en `src/**/*.test.ts`: 0 resultados). Sin PRD, no se exige G-n.
- [Por verificar] que sigue sin comprobarse:
  - Las políticas vivas de `knowledge_docs` (hace falta consultar `pg_policies`). En el repo: `0002:112-114` y `0002:106` retiran las de la 0000, ninguna migración posterior las toca y la 0080 no menciona `knowledge_docs`.
  - El tipo y el valor por defecto vivos de `mandatory`. Resuelto en parte: es no nulo en Row (`types.ts:2623`) y opcional en Insert (`types.ts:2636`), así que tiene valor por defecto; `0022:3` dice `default false`. `add column if not exists` no hace nada si la columna existe, así que no bloquea.
  - La versión viva de `create_organization`. La última del repo (`0028:4-63`, comentada) es `security definer` (`:5`) y crea el Owner (`:12`) antes de sembrar la regla (`:55-59`). Además, como `security definer` corre como dueño de la tabla, no le aplica la RLS.
  - Resueltos:
    - Roles en Telegram: el webhook usa `channelCtx` (`src/routes/api/public/telegram/webhook.ts:50`, `:56`, y también `:60` para `decideSuggestionCore`), que lee el rol de `org_members` en la empresa actual (`src/lib/channel-ctx.server.ts:11`, `:15`).
    - `check-migration-journal.mjs`: no existe en el repo (ni en `git ls-files` ni en `scripts/factory/`). Las reglas del journal las hace cumplir `src/lib/migrations-journal.ts` con `src/lib/migrations-journal.test.ts`. `src/lib/AGENTS.md:58` cita un script que no existe.
    - PGlite y `as restrictive`: la PGlite instalada (0.5.11) es PostgreSQL 18.6. Lo reproduje en la scratchpad:
      - acepta `as restrictive`;
      - una inserción vinculante da «new row violates row-level security policy»;
      - `with check` ve la fila ya rellenada por el trigger `before`;
      - `using` sobre la fila antigua devuelve 0 filas sin error;
      - marcar `mandatory` y pasar de personal a equipo dan error de RLS.
      
      Esto contesta la primera parte de §15.8 para PGlite.
    - Otras vías privilegiadas que escriban vinculantes (segunda parte de §15.8): no hay. Escriben en `knowledge_docs`:
      - `hub-screen.tsx:226`, `:233`;
      - `linkedin.tsx:94` (objections);
      - `agent/tools/linkedin.ts:61` (objections);
      - `job-runner.server.ts:146-156` (objections);
      - `library-core.ts:28` (`play.section` es `playbooks` u `objections`, `base.ts:7`);
      - `drive-core.ts:147`.
      
      Ninguna envía `mandatory`.
- Contradicciones con el código o con decisiones previas:
  - (1) La descripción de `drive_import_to_knowledge` cambia, pero el SDD no regenera `.lovable/mcp/manifest.json`. El manifiesto copia la descripción (`manifest.json:3822`) y `src/lib/AGENTS.md:7` obliga a regenerarlo al cambiar herramientas. NK-0096 U-5 también lo regenera (`SDD-20261109-rules-in-ai-readers.md:161`), así que los dos tickets tocan el mismo archivo generado sin contrato (GROUND-RULES regla 8).
  - (2) §14 da por hecho que NK-0094 y NK-0096 pueden añadir migraciones, pero las dos las excluyen (`rules-in-ai-readers.md:80`, `:134`; `metrics-strategy-no-estimates.md:99`). No bloquea.
- Lo que esta revisión NO demuestra:
  - No consulté la base viva (políticas, columna, `create_organization`).
  - El comportamiento de la RLS restrictiva se comprobó en PGlite 18.6, no en Supabase.
  - No hay código ni tests del cambio que ejecutar.
  - No comprobé la pantalla con móvil, escritorio ni tema.
  - No comprobé que el SDD siga apartado por apartado la plantilla `docs/factory/templates/sdd.md`.
  - No medí el umbral de 160 caracteres de C2 con los textos nuevos.

**Objeciones bloqueantes**

1. **CA-10 (ejecutor en segundo plano) sin prueba posible en los archivos nombrados.** `runKind` no recibe roles: el ámbito es `{ orgId, userId }` (`src/lib/inngest/job-runner.server.ts:75`, `:133-138`) y `jobCtx` (`:29-47`) no se llama en el caso `drive_import` (`:192-201`). Un `importToKnowledge(…, ["owner"])` fijo pasaría los tests nombrados.
   - Corrección: en U-3, el caso `drive_import` llama a `jobCtx(db, job)` y pasa `ctx.roles`.
   - Añadir a CA-10 una prueba `src/lib/inngest/job-runner.test.ts`:
     - un `db` admin falso cuyo `org_members` devuelve `ae`, con un trabajo `drive_import` a `rules`;
     - debe acabar con `BINDING_WRITE_DENIED`;
     - sin inserción en `knowledge_docs` y sin llamar a Drive.
   - Alternativa: exportar `runKind` y probarlo.
2. **El manifiesto MCP queda desfasado y choca con NK-0096.**
   - Corrección: añadir `.lovable/mcp/manifest.json`, regenerado con `node node_modules/@lovable.dev/mcp-js/dist/cli/extract-manifest.cjs .`, a §5 y a U-3.
   - Corregir §13, que hoy da a entender que solo separar la herramienta toca el manifiesto.
   - Escribir el contrato con NK-0096: quien integre segundo regenera el manifiesto sobre la rama ya integrada.

**Notas para el brief**

- Las citas archivo:línea de §3, §8, §10, §12 y §13 coinciden con `f59681f`. Una cita es inexacta: `authorize` ocupa `background.functions.ts:191-253`, no `:190-206` (`:206` es el chequeo de `ORG_WIDE`). La cita de `types.ts:2617-2656` es correcta.
- §9 dice «los tres viven en `knowledge-rules.ts`», pero enumera cuatro textos.
- `executeTool` tiene más llamadores que los que cita §3: `applySetupItems` (`agent.functions.ts:199`, cliente de la persona) y `decideSuggestionCore` (`agent.functions.ts:368`; por Telegram, cliente admin, `webhook.ts:60`). Quedan cubiertos porque el rechazo vive en `importToKnowledge` y en la herramienta. Conviene nombrarlos.
- `hub-screen.test.tsx:70-73` sustituye `DriveImportButton` por un botón que ignora `disabled`. Para CA-8 hay que cambiar ese mock para que pase `disabled` y el motivo. El mock de `useMe` (`:65`) es constante: hace falta un valor por test (`vi.hoisted`) para `ae`, `sales_leader`, `owner` y «sin cargar».
- CA-7 («mismo resultado que el SQL») solo se demuestra entre `knowledge-rules.test.ts` y `knowledge-binding.pg.test.ts` juntos. Fijar en el brief la ruta del fixture compartido, por ejemplo `src/test/knowledge-binding-cases.ts`.
- Archivos compartidos con otros tickets del Sprint 2:
  - `src/lib/drive-core.ts` (el brief de NK-0093 toca `:221`, resúmenes de Drive);
  - `src/lib/agent-tools.test.ts` (también NK-0094 CA-10);
  - `.lovable/mcp/manifest.json` (NK-0096).
  
  Contrato de integración por escrito.
- `src/lib/agent/tools/drive.ts:9` ya tiene `db: any`, que es anterior a este SDD. Al añadir roles, no extenderlo; mejor tiparlo con `ToolCtx`.
- Umbral de C2 (`SDD-20261106-ux-metrics-data-state.md:84`, `:138`): el motivo bajo la casilla (unos 65 caracteres) va en un elemento propio. La explicación actual tiene unos 135, y juntos pasarían de 160.
- El error RLS en la importación inmediata se reescribe como `new Error(error.message)` (`drive-core.ts:150`), pero `errorText` lo traduce por regex (`errors.ts:14`). Y `NOT_SAVED` ya dice «Puede que tu rol no lo permita» (`save.ts:6-7`), así que §15.5 es aceptable.
- Seguridad:
  - Las políticas restrictivas son `to authenticated`.
  - `anon` no tiene políticas permisivas.
  - `service_role` las salta, y por eso existe la doble comprobación en código.
  - No hay registros nuevos; el fallo del trabajo solo guarda `BINDING_WRITE_DENIED`, sin texto de reglas ni de archivos.
  - CA-4 queda cubierto por `is_org_member(org_id)` de la 0002 más `has_org_role(org_id, …)` sobre la fila.
- Detalle de rendimiento: `set search_path` en una función SQL `immutable` impide que se inserte en línea. El coste es despreciable.


Revisión de coherencia entre los SDD del Sprint 2: `docs/sdd/annex/sprint2-cross-sdd-gate-20261109.md`.


Informe de la segunda pasada (v2), copiado sin editar:

**Veredicto del gate (segunda pasada): Sin objeciones**

**Objeciones de la primera pasada:**
- 1 (CA-10 sin prueba posible en el ejecutor): **resuelta.** CA-10 se parte en dos tramos:
  - (a) Lanzamiento, probado en `background-authorize.test.ts`.
  - (b) Ejecución, probado en `src/lib/inngest/job-runner.test.ts`. El `db` falso devuelve `org_members` → `ae`, y se comprueban `status: "failed"`, `error = BINDING_WRITE_DENIED`, que no hay inserción y que no hay llamadas a Drive. Hay además un caso positivo con `sales_leader`.
  - U-3 cambia el caso `drive_import` para que llame a `jobCtx(db, job)` y pase `ctx.roles`. Lo he comprobado: hoy `job-runner.server.ts:192-201` construye `{ db, orgId, userId }` sin roles, y `jobCtx` (`:29-47`) sí lee `roles`. Si el ejecutor fijara `["owner"]`, el caso `ae` fallaría. La prueba distingue de verdad.
- 2 (manifiesto MCP desfasado y sin contrato con NK-0096): **resuelta.**
  - `.lovable/mcp/manifest.json` entra en §5 y en U-3, regenerado con el extractor.
  - §13 está corregido: la copia está en `:3822`, con el sufijo de MCP.
  - §14 fija el orden NK-0095 → NK-0096 → NK-0094 y la regla de regenerar tras el merge, nunca a mano. Es coherente con NK-0094 §14 (`metrics-strategy-no-estimates.md:274`) y con NK-0096 §14 (`rules-in-ai-readers.md:184`).
- Contradicción no bloqueante (2) de la primera pasada (migraciones de NK-0094 y NK-0096): **resuelta** en §14.
- Notas de la primera pasada: todas incorporadas:
  - cita de `authorize`: `:191-253`;
  - «los cuatro» textos en §9;
  - llamadores de `executeTool`;
  - mocks de `useMe` y `DriveImportButton`;
  - fixture compartido;
  - `drive.ts:9` tipado con `ToolCtx`;
  - umbral de 160 caracteres de C2.

**CA sin prueba posible o sin G-n:**
- Ninguno sin prueba posible. Sin PRD no se exige G-n.
- CA-10 (a) promete «sin crear el trabajo». Si solo se prueba `authorize`, esa aserción es trivial. Va como nota.

**[Por verificar] que sigue sin comprobarse:**
- Políticas vivas de `knowledge_docs` (`pg_policies`).
- Tipo y valor por defecto vivos de `mandatory`.
- Versión viva de `create_organization`.
- Que la RLS restrictiva se comporte igual en Supabase que en PGlite 18.6.

Ninguno bloquea: la migración es aditiva e idempotente (`create or replace`, `drop policy if exists`, `add column if not exists`).

**Contradicciones con el código o con decisiones previas:**
- Ninguna que bloquee. He re-comprobado en `integration/sprint2-20261109` (`19beb33`):
  - `drive-core.ts`: `:35`, `:270`, `:271`, `:275`, `:280`, `:286`;
  - `job-runner.server.ts`: `:29-47`, `:38`, `:75`, `:108-117`, `:192-201`;
  - `background.functions.ts:191-253`;
  - `agent/tools/drive.ts:6`, `:9`, `:44-54`;
  - `manifest.json:3822`;
  - `0000:208`;
  - `0002`: `:127-130`, `:201`, `:226-230`;
  - `hub-screen.test.tsx:64-73`;
  - `hub-screen.tsx:199-200`;
  - `drive.tsx:102`;
  - las migraciones que tocan `knowledge_docs` (0000, 0002, 0020, 0022, 0028);
  - el journal (máximo `when` = `1794139200000`).
- `drive-core.test.ts` no existe en la rama de integración. Lo confirmo, así que la nota del anexo («lo crea NK-0093») queda superada por la v2.
- Inexactitud de texto heredada: la cabecera (línea 10) sigue diciendo que NK-0096 «también toca `src/lib/knowledge-rules.ts`». NK-0096 lo excluye (`rules-in-ai-readers.md:73`) y el anexo pedía corregirlo (nota 7).

**Lo que esta revisión NO demuestra:**
- No consulté la base viva.
- No reproduje la RLS en Supabase.
- No ejecuté el extractor del manifiesto. El gate de NK-0096 lo ejecutó y dio salida idéntica byte a byte.
- No hay código ni tests del cambio que ejecutar.
- No revisé la pantalla en móvil, escritorio ni tema.
- No medí los textos contra el umbral de 160 caracteres de C2.
- No comprobé el SDD contra la plantilla apartado por apartado.

## Objeciones bloqueantes

Ninguna.

## Notas para el brief

1. **Cabecera de la línea 10.** Corregir «NK-0096, que también toca `src/lib/knowledge-rules.ts`»: NK-0096 solo lo importa.
2. **`errorText` y `BINDING_WRITE_DENIED`.** `errorText` (`errors.ts:68-79`) aplica las reglas de Postgres antes que la heurística del español. El texto actual no coincide con ninguna, así que pasa tal cual y CA-10 (b) se puede afirmar. Si alguien reescribe el texto, que no meta «not allowed», «not found», «quota», «credits» ni «timeout». Conviene que CA-10 (b) compare `error` con la constante exportada.
3. **Caso positivo de CA-10 (b), `sales_leader` llega a la inserción.** `readFile` pasa por `insideCompany`/`companyFolder` (`drive-core.ts:100`, `:208-209`). El `db` falso y el mock de `@/lib/google-drive` tienen que resolver la carpeta de la empresa y devolver un archivo legible. Además, `step()` exige la cadena `update().eq().select().maybeSingle()`. Si pesa demasiado, que el brief permita la alternativa del SDD (exportar `runKind`).
4. **CA-10 (a), «sin inserción en `background_jobs`».** Solo tiene sentido si la prueba pasa por `enqueue`, que llama a `authorize` en la primera línea antes de `supabaseAdmin`. Si solo se prueba `authorize` exportada, el brief debe decir que la garantía viene de ese orden de llamadas.
5. **CA-11 y el manifiesto.** La descripción del manifiesto lleva el sufijo «(Queda pendiente: el usuario la confirma en Nokko.)». La prueba debe usar `startsWith` o `toContain` de la descripción de la herramienta, no igualdad.
6. **CA-11 y el mock de `drive-core`.** `agent-tools.test.ts` no tiene hoy ningún `vi.mock`. Un `vi.mock("@/lib/drive-core")` se aplica a todo el archivo, que comparte NK-0094. Con `drive-core` simulado, el caso `ae` solo se rechaza si el chequeo vive en la herramienta, como dice §5.
7. **Cambio en `drive_import` a otras secciones.** Al pasar a `jobCtx`, `drive_import` falla con «Ya no perteneces a esta empresa.» también fuera de Reglas, si el lanzador dejó de ser miembro. Está declarado en §6 y es deseable. Que el brief lo trate como cambio esperado, no como regresión.
8. **Propuestas del agente.** Un AE puede proponer importar a Reglas, y si la confirma un Owner o un Sales Leader se ejecuta con sus roles. Es coherente con §15.4 (aprobación humana de un líder), pero conviene escribirlo en §8.
9. **`migrations.pg.test.ts`.** No aplica todas las migraciones: cada test elige las suyas. La 0081 no rompe tests existentes aunque el arnés no cree `knowledge_docs`.
10. **Seguridad.** Sin cambios respecto a la primera pasada:
    - las políticas son `to authenticated`;
    - `service_role` las salta y por eso la doble comprobación en código;
    - `has_org_role(_org uuid, _role app_role)` acepta los literales;
    - CA-4 queda cubierto por `is_org_member` más `has_org_role` sobre la fila;
    - no hay otros escritores de vinculantes (re-comprobado con grep de `knowledge_docs` en `src`).

Archivo revisado: `/home/user/seller-strategy-studio-s2docs/docs/sdd/SDD-20261109-rules-write-permissions.md`.

## 18. Delta de implementación (lo rellena el agente al entregar)

- **2026-11-09 (integración, merge 809f8fd):** `checkImportAllowed` en `drive-core.ts` aplicada en `importToKnowledge`, `authorize`, el ejecutor (con `jobCtx`) y la herramienta del agente; `authorize` y `enqueue` exportadas para la prueba de CA-10a. En `hub-screen.test.tsx` el mock de Supabase además registra escrituras (tercer mock, no cambia lo que devuelve ni ninguna aserción; aceptado por el revisor). Migración 0081 no aplicada: antes de aplicarla, comprobar en la base viva la columna `mandatory`, las políticas de `knowledge_docs` y la firma de `has_org_role`. «Promover a equipo» sigue visible para un AE sobre datos antiguos vinculantes: la RLS lo rechaza (detalle de experiencia, ticket aparte si molesta).
—
