# SDD-20261109-rules-in-ai-readers · [Mejora] Reglas de Conocimiento en ai-core, biblioteca de playbooks y MCP

**Tipo:** Mejora (el ledger la registra como `feature`; ver §15.1) · **Prioridad propuesta:** Alta (cierra el hueco que NK-0087 dejó fuera de alcance en su §5 y §15.4)
**Estado:** Aprobado el 2026-11-09 por delegación de Fede («sí, ese alcance, ejecuta todo tú»), gate sin objeciones · **Pide:** Fede (Sprint 2, alcance aprobado el 2026-11-09) · **Aprueba:** Fede · **Fecha:** 2026-11-09
**Ticket:** NK-0096
**PRD:** No aplica (mejora acotada: extiende a más llamadas un lector ya aprobado y entregado; la decisión de hacerlo es de Fede, 2026-11-06, y el alcance del Sprint 2, 2026-11-09) · **Depende de:** NK-0095 (`SDD-20261109-rules-write-permissions.md`: código y migración 0081 aplicada en la base real; revisión de coherencia del Sprint 2). Antes: `SDD-20261106-agent-rules-reader.md` (NK-0087, Hecho: `src/lib/knowledge-rules.ts`)· **Coordina con:** NK-0095 (`SDD-20261109-rules-write-permissions.md`), que añade exportaciones a `knowledge-rules.ts`; este SDD **no modifica** ese módulo, solo lo importa.

> Números de línea comprobados en `f59681f` (worktree `seller-strategy-studio-s2docs`, rama `docs/sprint2-sdds-20261109`; `git diff f59681f HEAD -- src` está vacío).

## 1. Resumen
Desde NK-0087 las reglas de equipo de Conocimiento llegan al turno del agente y a `draft_followup` y `prepare_meeting_brief`, pero no a las demás generaciones que redactan para la empresa. Este cambio reutiliza el mismo lector (`loadAgentRules`, `rulesBlock`, `RULES_READ_FAILED`, topes 12 reglas / 12 000 caracteres) en las cinco generaciones de `src/lib/ai-core.ts`, en la adaptación de la biblioteca de playbooks (que deja de recibir las reglas por la vía de Ciclo GTM sin `MANDATORY_RULE`) y en los avisos de los trabajos en segundo plano que las ejecutan. A los asistentes externos por MCP se les da una herramienta de solo lectura `get_team_rules` y una línea en las instrucciones del servidor, porque el SDK de MCP instalado solo sirve herramientas (§3).

## 2. Problema y para quién
Owner y Sales Leader escriben reglas («nunca ofrecemos descuentos en la primera llamada») y Conocimiento dice que el agente las lee. Pero la Preparación de llamada de la pantalla y del piloto automático, la Investigación de stakeholders, la propuesta, la revisión de llamada y el coaching de escucha se generan sin ellas; la biblioteca de playbooks las recibe sin la instrucción de obligado cumplimiento y con los límites de Ciclo GTM; y un asistente externo (Claude, ChatGPT, Codex) que redacta con datos de Nokko no tiene forma de leerlas.

## 3. Evidencia y por qué ahora
Leído en `f59681f`.

**El lector ya existe (NK-0087):**
- `src/lib/knowledge-rules.ts:102-126` (`loadAgentRules`: filtra `org_id`, `scope = 'team'` y `section = 'rules'` o `mandatory = true` en la consulta, `:110-112`, y otra vez en memoria, `:120`; devuelve `{ ok: false }` si falla, `:116-118` y `:122-124`; no registra texto de reglas). `rulesBlock` en `:88-93` (con `MANDATORY_RULE`, `:37-38`), `RULES_READ_FAILED` en `:46-47`, topes `AGENT_RULE_LIMITS` (12 reglas, 12 000 caracteres) en `:44`.
- Uso actual: `agent/agent.server.ts:115`, `:125`, `:159`; `agent/tools/core-read.ts:534-570` (`draft_followup`); `agent/tools/core-write.ts:453-477` (`prepare_meeting_brief`).
- NK-0087 dejó fuera «`ai-core.ts`, la biblioteca de playbooks, `job-runner.server.ts` y los asistentes externos por MCP» (`SDD-20261106-agent-rules-reader.md:54`) y preguntó si iban en un SDD aparte (`:123`).

**`ai-core.ts`: cinco generaciones sin reglas.**
- `accountContext` lee Conocimiento solo de las secciones `company`, `objections`, `playbooks` y `methodology` (`src/lib/ai-core.ts:18`): la sección `rules` queda fuera, y un documento obligatorio de esas secciones entra como contexto, sin `MANDATORY_RULE`.
- Generaciones que llaman a `ask`: `meetingBriefCore` (Preparación de llamada, `:38-48`, llamada en `:42`), `callTeardownCore` (revisión de llamada, `:54-73`, llamada en `:69`), `proposalCore` (borrador de propuesta / business case, `:76-83`, llamada en `:78`), `researchStakeholderCore` (Investigación de stakeholders, `:90-119`, llamada en `:112`) y `listeningCoachingCore` (coaching de escucha, `:122-138`, llamada en `:132`).
- Quién las llama:
  - pantallas, con el cliente del usuario y `scope = null` (`src/lib/ai.functions.ts:13`, `:21`, `:26`, `:31`, `:101`);
  - herramientas del agente, también por MCP y Telegram, con `scope` (`agent/tools/accounts.ts:438-452` `research_stakeholder` y `:455-467` `draft_proposal`; `agent/tools/meetings.ts:68-78` `review_call` y `:80-89` `listening_coaching`);
  - el piloto automático, con cliente privilegiado (`src/lib/autopilot.server.ts:57-61`, `meetingBriefCore` de las reuniones de las próximas 36 h);
  - el trabajo en segundo plano `stakeholder_research` (`src/lib/inngest/job-runner.server.ts:165-180`).
- Con `scope = null` no hay `orgId` en la llamada; las filas que ya se leen traen `org_id` cuando se seleccionan con `*` (`meetings`, `ai-core.ts:39`; `stakeholders`, `:91`), pero no en `callTeardownCore` (`:55`, lista de columnas sin `org_id`), `listeningCoachingCore` (`:123`) ni `proposalCore` (solo `accountId`, `:76-77`).
- `ai-core.ts` declara `type Db = any` (`:11`).

**Biblioteca de playbooks: recibe las reglas por Ciclo GTM, sin instrucción.**
- `src/lib/playbooks/library-core.ts:3` importa `companyContext` de `src/lib/bmad/drafting.ts`; `:15` lo carga; `:24` lo pasa entero como `contexto_empresa` (`adaptPrompt`, `src/lib/playbooks/adapt.ts:15-17`) con `ADAPT_SYSTEM` (`adapt.ts:13`), sin `MANDATORY_RULE`.
- `companyContext` (`bmad/drafting.ts:12-27`) lee los 60 documentos de equipo más recientes de cualquier sección (`:16`) y aplica los límites de Ciclo GTM (`knowledgeForAgents`, `knowledge-rules.ts:21-35`: 12 reglas, 4000 caracteres cada una, sin tope total, `:23` y `:28`). Si la lectura falla, `docs.data ?? []` deja las reglas vacías sin avisar (`drafting.ts:21`).
- Solo hay llamada a la IA si hay contexto aprobado (`library-core.ts:16`, `:22`); cada jugada que falta es una llamada (`:18-27`), con `effort: "low"` (`:24`).
- Log de fallo: `console.error("playbook adaptation failed", play.id, e)` (`library-core.ts:26`) registra el objeto de error entero, que NK-0087 prohíbe (`src/lib/agent/safe-error-log.ts:1-5`: ni el mensaje ni el cuerpo).
- Se ejecuta solo como trabajo en segundo plano desde Conocimiento (`src/components/hub/hub-screen.tsx:202`, `useJob("playbook_library")` → `job-runner.server.ts:413-427`). La función de servidor `createPlaybookLibrary` (`src/lib/playbooks.functions.ts:7-14`) no la llama ninguna pantalla (búsqueda en `src/`).

**`job-runner.server.ts`: no redacta nada por sí mismo.**
- Despacha a núcleos: `stakeholder_research` → `researchStakeholderCore` (`:165-180`), `playbook_library` → `createLibraryCore` (`:413-427`), `autopilot_now` → `autopilotForOrg` (`:372`), y `debate`, `draft_artifact`, `deep_review` → BMAD (`:428-479`), que ya aplica `MANDATORY_RULE` con sus propios límites (`bmad/drafting.ts:6`).
- El aviso al usuario de un trabajo terminado es `result.body`: el disparador lo copia a `notifications` (`drizzle/migrations/0049_notifications_center.sql:44`, `left(... new.result->>'body' ..., 1000)`). `stakeholder_research` hoy no devuelve `body` (`job-runner.server.ts:176-179`); `playbook_library` sí (`:420-423`).
- El log de fallo de un trabajo registra `(e as Error)?.message` (`:103`) y guarda `errorText(e)` (`:114`). Los errores de `ask` son textos fijos (`src/lib/ai-gateway.ts:93`, `:101-102`, `:145`, `:153-154`, `:161-171`; `src/lib/gemini.ts:143-153`; `openrouterErrorMessage`, `ai-gateway.ts:175-185`), y el cuerpo del proveedor se guarda aparte y no se registra (`ai-gateway.ts:37-40`, `:101`, `:153`).

**MCP: cómo está montado.**
- Servidor en `src/lib/mcp/index.ts:9-22` con `@lovable.dev/mcp-js` **3.1.1** (`node_modules/@lovable.dev/mcp-js/package.json:3`). `instructions` es un texto fijo (`index.ts:13-16`), igual para todos los usuarios y empresas.
- El SDK solo anuncia y sirve herramientas: capacidades `{ tools: { listChanged: false } }` (`node_modules/@lovable.dev/mcp-js/dist/mcp-cPwyvSCx.js:270`) y métodos `tools/list` y `tools/call` (`:65-66`, `:272`); exporta `defineMcp` y `defineTool`, sin recursos ni prompts (`dist/index.d.ts:79`). `McpDefinitionInput.instructions` es un `string` (`dist/types-BX8RawmT.d.ts:391-397`).
- Contexto: `mcpCtx` (`src/lib/mcp/context.ts:7-20`) da `db` con el token del usuario (RLS), `orgId` de su empresa activa, roles y `orgName`.
- Herramientas: las del registro del agente (`src/lib/mcp/tools/agent-tools.ts:132-181`) más cuatro propias de MCP (`list_companies` y `switch_company` en `companies.ts`, dos de métricas en `metrics.ts`; `index.ts:21`). Las del agente que llaman a la IA (`draft_followup`, `prepare_meeting_brief` y, tras este SDD, las cinco de `ai-core`) ya aplican las reglas dentro.
- El asistente externo redacta con su propio modelo y su propio prompt: Nokko no puede inyectar nada en ese prompt salvo `instructions` (fijo) y lo que devuelven las herramientas.
- El manifiesto `.lovable/mcp/manifest.json` lista el servidor y las herramientas, no las `instructions` (`manifest.json:12-18`); hay tests que lo leen (`src/lib/agent-tools.test.ts:1300-1306`, `:1334-1343`).

**Uso y coste:** número de reglas por empresa, cuántas Preparaciones de llamada, investigaciones o adaptaciones se generan y cuántas llamadas por MCP hay: sin dato.

## 4. Resultado buscado
- Generaciones de `ai-core.ts` que reciben las reglas con `MANDATORY_RULE`: hoy 0 de 5; objetivo 5 de 5, por cualquier entrada (pantalla, agente, MCP, Telegram, piloto automático, segundo plano).
- Adaptaciones de la biblioteca que reciben las reglas con `MANDATORY_RULE` y los topes del agente: hoy 0 (las reciben sin instrucción y con límites de Ciclo GTM); objetivo todas las que llaman a la IA.
- Asistentes externos con una vía para leer las reglas de la empresa activa: hoy 0; objetivo 1 (`get_team_rules`).
- Fallos de lectura de reglas que llegan a la persona en estas rutas: hoy no aplica (no se leen); objetivo 100 % con el texto de `RULES_READ_FAILED`.
- Cumplimiento real por el modelo: sin dato (§14).

## 5. Alcance
**Incluye:**
- En `src/lib/ai-core.ts`: lectura de reglas con `loadAgentRules`, bloque `rulesBlock` en el texto de sistema de `meetingBriefCore`, `callTeardownCore`, `proposalCore`, `researchStakeholderCore` y `listeningCoachingCore`; aviso si falla; `rulesRead` en el resultado.
- Herramientas del agente que envuelven esos núcleos (`research_stakeholder`, `draft_proposal`, `review_call`, `listening_coaching`): el aviso en `mensaje`.
- `job-runner.server.ts`: el aviso en `body` de `stakeholder_research` y `playbook_library`.
- Biblioteca de playbooks (`library-core.ts`): reglas del lector común en el texto de sistema, fuera del contexto de Ciclo GTM; aviso si falla; log sin texto.
- MCP: herramienta propia de solo lectura `get_team_rules` y una frase en `instructions`; manifiesto regenerado.

**No incluye:**
- Cambiar `src/lib/knowledge-rules.ts` (ni firmas ni topes). Si la implementación lo necesitara, para y pregunta (contrato con NK-0095).
- `accountContext` (`ai-core.ts:17-35`) sigue igual, también su exclusión de la sección `rules` (`:18`); por eso no cambian sus otros usuarios: `researchAccountCore` (`src/lib/web-research-core.ts:139-145`) y la revisión de cuentas que se enfrían del piloto automático (`autopilot.server.ts:104-111`) (§15.3).
- Otras llamadas a la IA fuera de `ai-core.ts`: Theory U, ICP y Asesor GTM (`ai.functions.ts:41`, `:73`, `:91`, `:138`), señales, lead scoring, onboarding, resúmenes de Drive, battlecards.
- BMAD (Ciclo GTM, Debates, `draft_artifact`): sigue con sus límites y `MANDATORY_RULE`.
- Quitar la dependencia de `library-core.ts` sobre `bmad/drafting.ts` (`companyContext`): es del inventario de la pieza 8 del PRD de GTM Lab (§14, §15.4).
- Textos de la pantalla Conocimiento (`hub-screen.tsx:53` y la casilla) (§15.2).
- Que el asistente externo obedezca: no es controlable desde Nokko (§14).
- Esquema, RLS, migraciones; quién escribe reglas (NK-0095).

## 6. Cambios de comportamiento (delta)
**Añadido:**
- Las cinco generaciones de `ai-core.ts` y las adaptaciones de la biblioteca reciben `rulesBlock` (reglas de equipo, 12 / 12 000, `MANDATORY_RULE`).
- Si la lectura falla, el texto generado empieza por «No he podido leer las reglas del equipo. Respondo sin ellas; vuelve a intentarlo en un momento.» (`RULES_READ_FAILED`), se guarde o no; las herramientas lo ponen en `mensaje`; los trabajos, en `body`.
- MCP: herramienta «Reglas del equipo» (`get_team_rules`) y la frase de instrucciones de §9.

**Modificado:**
- Biblioteca: antes las reglas iban dentro de `contexto_empresa` como `reglas_obligatorias` (12 × 4000, ventana de 60 documentos, sin instrucción) → ahora van como bloque en el sistema con el lector común; `contexto_empresa` ya no lleva `reglas_obligatorias` (el resto de `companyContext` sigue igual).
- Biblioteca: log de fallo de adaptación con `safeErrorLog` (antes, el error entero).
- `meetingBriefCore`, `callTeardownCore`, `proposalCore`, `researchStakeholderCore` y `listeningCoachingCore` devuelven además `rulesRead: boolean`; `callTeardownCore` y `listeningCoachingCore` leen también `org_id` de la reunión; `proposalCore` lee `org_id` de la cuenta.

**Eliminado:** nada.

## 7. Historias y criterios de aceptación
Sin PRD propio: no hay G-n que citar.

### H-1: Como Owner o Sales Leader, quiero que las preparaciones, investigaciones, propuestas y revisiones que genera Nokko cumplan nuestras reglas.
- **CA-1** Cada una de las cinco generaciones de `ai-core.ts` pasa a `ask` un texto de sistema que contiene `rulesBlock(reglas)` con las reglas que devuelve `loadAgentRules` con `AGENT_RULE_LIMITS`; sin reglas, el texto de sistema es el de hoy. Se prueba en los dos modos de llamada: con `scope` (agente, Telegram, piloto automático, segundo plano) y con `scope = null` (pantallas). · prueba: `src/lib/ai-core-rules.test.ts` (`vi.mock("@/lib/ai-gateway")` capturando `system`, como `src/lib/agent/agent-rules.test.ts:30`)
- **CA-2** La organización de la lectura de reglas es `scope.orgId` cuando hay `scope`, y el `org_id` de la fila ya leída (reunión, stakeholder o cuenta, leída con RLS) cuando `scope = null`; la consulta lleva los filtros explícitos de `loadAgentRules` (`org_id`, `scope = 'team'`, sección o `mandatory`). Si no hay `org_id` que usar, cuenta como fallo (CA-3), nunca como «sin reglas». · prueba: `src/lib/ai-core-rules.test.ts` (`db` falso que registra los filtros de `knowledge_docs`; caso de cuenta no encontrada en `proposalCore`)
- **CA-3** Si la lectura de reglas falla (error devuelto por Supabase, excepción, o sin `org_id`), la generación sigue sin reglas, el texto que se guarda (`meetings.ai_brief`, `meetings.call_review`, `meetings.listening_coaching`, `stakeholders.research`) y el que se devuelve empiezan por `RULES_READ_FAILED` seguido de una línea en blanco, y el resultado lleva `rulesRead: false`. En `researchStakeholderCore` el aviso va antes de la nota de búsqueda web (`ai-core.ts:116`). · prueba: `src/lib/ai-core-rules.test.ts` (los tres tipos de fallo, por núcleo; se comprueba el `update` registrado y el valor devuelto)
- **CA-4** Las herramientas del agente que envuelven esos núcleos no dejan el fallo en silencio: `research_stakeholder`, `review_call` y `listening_coaching` (escritura) devuelven un `mensaje` que contiene `RULES_READ_FAILED` además del texto actual; `draft_proposal` (lectura) devuelve el `borrador` con el aviso delante y `mensaje: RULES_READ_FAILED`. Con lectura correcta, sus resultados son los de hoy. · prueba: `src/lib/ai-core-rules.test.ts` (con `executeTool`, como `agent-rules.test.ts:242-298`)
- **CA-5** Los trabajos en segundo plano lo dicen en el aviso: `stakeholder_research` con `rulesRead: false` guarda un `result.body` que contiene `RULES_READ_FAILED`; `playbook_library` lo añade a su `body` (CA-7). Con lectura correcta, `result` es el de hoy. · prueba: `src/lib/inngest/job-runner.test.ts` (nuevo; `runBackgroundJob` con `db` falso que registra el `update` de `background_jobs`, y los núcleos simulados)
- **CA-6** En las rutas de este SDD ningún log del servidor lleva el texto de una regla: con una regla ficticia con marca única, y con la lectura y la llamada a la IA fallando (también con un `Error` cuyo `message` contiene la marca), ningún argumento de `console.error`/`console.warn`/`console.log` contiene la marca. · prueba: `src/lib/ai-core-rules.test.ts` y `src/lib/playbooks/library-core.test.ts`

### H-2: Como Owner o Sales Leader, quiero que los playbooks que Nokko adapta a mi empresa respeten las reglas.
- **CA-7** Con contexto aprobado, cada llamada de adaptación recibe en el sistema `ADAPT_SYSTEM` seguido de `rulesBlock` con el lector común (`AGENT_RULE_LIMITS`), y el `contexto_empresa` de `adaptPrompt` no contiene la clave `reglas_obligatorias`. Las reglas se leen una vez por trabajo. Sin contexto aprobado no se leen reglas ni se avisa (no hay llamada a la IA). Si la lectura falla, las adaptaciones siguen sin reglas y el resultado lleva `mensaje: RULES_READ_FAILED`, que el trabajo añade a su `body`. · prueba: `src/lib/playbooks/library-core.test.ts` (nuevo) y `src/lib/inngest/job-runner.test.ts`
- **CA-8** Si una adaptación falla, el log usa `safeErrorLog(e)` y el identificador de la jugada; nunca el objeto de error ni su mensaje. · prueba: `src/lib/playbooks/library-core.test.ts` (cubierto por la aserción de CA-6)

### H-3: Como usuario que trabaja con un asistente externo conectado a Nokko, quiero que ese asistente pueda leer las reglas de mi empresa.
- **CA-9** Existe una herramienta MCP propia `get_team_rules` («Reglas del equipo»), de solo lectura (`readOnlyHint: true`, `idempotentHint: true`, `openWorldHint: false`), disponible para cualquier miembro, que lee con `loadAgentRules` sobre `mcpCtx` y devuelve: el texto de `rulesBlock(reglas)` si hay reglas; «No hay reglas obligatorias de equipo en {empresa}.» si no hay; `RULES_READ_FAILED` si la lectura falla (sin lanzar error). · prueba: `src/lib/mcp/tools/rules.test.ts` (nuevo; prueba la función que construye la respuesta, `teamRulesText(c)`, con `db` falso)
- **CA-10** El manifiesto `.lovable/mcp/manifest.json` lista `get_team_rules` como herramienta de solo lectura, y su nombre no coincide con ninguna herramienta del registro del agente (`TOOLS`). · prueba: `src/lib/mcp/tools/rules.test.ts` (lee el manifiesto, como `agent-tools.test.ts:1300-1306`)
- **CA-11** Las `instructions` del servidor MCP contienen la frase de §9, que nombra `get_team_rules`. · prueba: `src/lib/mcp/tools/rules.test.ts` (la frase es una constante exportada, `RULES_MCP_INSTRUCTION`, y el test comprueba que `index.ts` la incluye: importando el valor por defecto si Vitest lo carga, o leyendo el fuente; ver §16)

## 8. Casos límite y errores
- **Documento obligatorio fuera de la sección `rules`** (por ejemplo, un playbook con `mandatory = true`): entra en `accountContext` como conocimiento (`ai-core.ts:18`) y también en el bloque de reglas. Se acepta el duplicado: quitarlo de `accountContext` cambiaría `researchAccountCore` y la revisión del piloto automático, que no reciben el bloque (§5).
- **Más reglas que los topes:** entran las más recientes con los topes del agente (NK-0087 CA-3). La biblioteca deja de leer hasta 12 × 4000 caracteres y pasa a 12 000 en total: puede leer menos texto de reglas que hoy.
- **Regla que choca con la estructura del playbook:** si la adaptación pierde la estructura, `acceptableAdaptation` (`adapt.ts:20`) la descarta y entra el texto base, como hoy.
- **Biblioteca sin contexto aprobado:** no hay llamada a la IA, el texto base entra tal cual y las reglas no se leen (CA-7).
- **Preparación hecha por el piloto automático con fallo de lectura:** la preparación guardada lleva el aviso (CA-3); la sugerencia «Preparé tu reunión…» (`autopilot.server.ts:66-70`) no cambia.
- **Otra empresa (multitenant):** con `scope`, la lectura filtra por `scope.orgId`; sin `scope`, por el `org_id` de la fila que ya devolvió el RLS del usuario; `loadAgentRules` vuelve a filtrar en memoria (`knowledge-rules.ts:120`). En MCP, `orgId` es la empresa activa del token (`context.ts:11-13`).
- **Rol en MCP:** cualquier miembro lee las reglas (en la app, todos los miembros las ven en Conocimiento). `get_team_rules` no pasa por `canUseTool` porque no es del registro del agente.
- **El asistente externo no llama a `get_team_rules`:** no se puede impedir (§14). Sus escrituras siguen pendientes de confirmación (`agent-tools.ts:161-178`).
- **Regla que pide saltarse la confirmación:** manda el sistema (`rulesBlock` lo dice, `knowledge-rules.ts:92`).
- **Texto ya guardado con aviso:** al volver a generar con lectura correcta se sustituye (los núcleos hacen `update` del campo entero).

## 9. Experiencia y copy
- Aviso de fallo: el literal existente `RULES_READ_FAILED` («No he podido leer las reglas del equipo. Respondo sin ellas; vuelve a intentarlo en un momento.»). No se crea otro.
- Herramienta MCP: título «Reglas del equipo»; descripción «Reglas obligatorias que el equipo escribió en Conocimiento para la empresa activa. Léelas antes de redactar textos o proponer acciones y cúmplelas.»; sin reglas: «No hay reglas obligatorias de equipo en {empresa}.».
- Frase añadida a `instructions` (`RULES_MCP_INSTRUCTION`): «Antes de redactar textos para la empresa o proponer acciones, llama a get_team_rules y cumple sus reglas_obligatorias.»
- Español, «tú», sin iconos. Ningún texto nuevo en pantallas.

## 10. Datos, permisos y privacidad
- Sin tablas, columnas, RLS ni migraciones.
- Lectura con filtros explícitos de organización y ámbito (`loadAgentRules`), también con cliente privilegiado (piloto automático, segundo plano, Telegram), como exige `src/lib/AGENTS.md:7` y `:48` («Cores shared by screens and jobs must filter by org»).
- MCP lee con el token del usuario (RLS) y además con los filtros explícitos.
- Logs: ni texto de reglas ni mensajes de error del proveedor (CA-6, CA-8; `safe-error-log.ts:1-5`). `loadAgentRules` mantiene su log actual (`knowledge-rules.ts:117`, `:123`), aceptado en NK-0087.
- Los textos guardados (`ai_brief`, `research`, etc.) no cambian de quién los ve.
- Tests con reglas, cuentas y personas ficticias.

## 11. Llamadas a IA
Ninguna llamada nueva. Todas existían; crece (o, en la biblioteca, puede bajar) el texto de entrada. `get_team_rules` no llama a la IA de Nokko: el modelo es el del asistente externo. Cada generación añade una consulta a `knowledge_docs` (no es una llamada a la IA).

| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| `meetingBriefCore` (Preparación de llamada: pantalla, piloto automático) | Sin cambio | Sin cambio (`ask` sin `effort`, `ai-core.ts:42`) | Sin dato. Entrada añadida ≤ 12 000 caracteres de reglas + texto fijo del bloque |
| `callTeardownCore` (revisión de llamada: pantalla, `review_call`) | Sin cambio | Sin cambio (`effort: "medium"`, `ai-core.ts:69`) | Sin dato. Igual |
| `proposalCore` (propuesta: pantalla, `draft_proposal`) | Sin cambio | Sin cambio (`ai-core.ts:78`) | Sin dato. Igual |
| `researchStakeholderCore` (Investigación de stakeholders: pantalla, `research_stakeholder`, trabajo `stakeholder_research`) | Sin cambio | Sin cambio (`ai-core.ts:112`) | Sin dato. Igual |
| `listeningCoachingCore` (coaching de escucha: pantalla, `listening_coaching`) | Sin cambio | Sin cambio (`ai-core.ts:132`) | Sin dato. Igual |
| Adaptación de cada playbook (`library-core.ts:24`, una por jugada que falta) | Sin cambio (regla `acceptableAdaptation` y texto base si falla) | Sin cambio (`effort: "low"`) | Sin dato. Reglas: hoy hasta 12 × 4000 caracteres dentro del contexto; después ≤ 12 000 en el sistema |
| `get_team_rules` (MCP) | No llama a la IA | — | — |

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | `ai-core.ts`: lectura de reglas por núcleo (org de `scope` o de la fila; `org_id` añadido a las selecciones de `callTeardownCore` y `listeningCoachingCore`; lectura de `org_id` de la cuenta en `proposalCore`), `rulesBlock` en el sistema, aviso y `rulesRead` | CA-1, CA-2, CA-3, CA-6 (núcleos) | `src/lib/ai-core-rules.test.ts` (hoy el sistema capturado no contiene `reglas_obligatorias` y no existe `rulesRead`) |
| U-2 | Aviso en `mensaje` de `research_stakeholder`, `review_call`, `listening_coaching` y en `borrador`/`mensaje` de `draft_proposal` | CA-4 | `src/lib/ai-core-rules.test.ts` (casos de herramientas) |
| U-3 | `library-core.ts`: reglas del lector común en el sistema, `reglas_obligatorias` fuera del contexto, una lectura por trabajo, `mensaje` si falla, log con `safeErrorLog` | CA-7, CA-8, CA-6 (biblioteca) | `src/lib/playbooks/library-core.test.ts` (hoy el sistema es `ADAPT_SYSTEM` solo y el contexto lleva `reglas_obligatorias`; el log lleva el error) |
| U-4 | `job-runner.server.ts`: `body` con el aviso en `stakeholder_research` y `playbook_library` | CA-5, CA-7 (trabajo) | `src/lib/inngest/job-runner.test.ts` (hoy `stakeholder_research` no devuelve `body`) |
| U-5 | MCP: `src/lib/mcp/tools/rules.ts` (`teamRulesText`, `teamRules`, `RULES_MCP_INSTRUCTION`), alta en `index.ts` (`tools` e `instructions`), manifiesto regenerado con `node node_modules/@lovable.dev/mcp-js/dist/cli/extract-manifest.cjs .` | CA-9, CA-10, CA-11 | `src/lib/mcp/tools/rules.test.ts` (el módulo no existe; el manifiesto no lista `get_team_rules`) |

Orden: U-1 → U-2 → U-3 → U-4 → U-5 (U-4 usa `rulesRead` de U-1 y `mensaje` de U-3).

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- En `ai-core.ts`, dos ayudas locales (no en `knowledge-rules.ts`, para no chocar con NK-0095): `rulesFor(db, orgId)` (si no hay `orgId`, devuelve `{ ok: false, rules: [] }`; si no, `loadAgentRules({ db, orgId })`) y `withRules(system, r)` (añade `\n` + bloque solo si no está vacío, como `core-read.ts:541`). El aviso se antepone con el mismo formato que NK-0087 (`core-read.ts:569`, `${RULES_READ_FAILED}\n\n${texto}`).
- Leer las reglas en paralelo con lo que cada núcleo ya lee (`Promise.all`), como `core-read.ts:534`. En `meetingBriefCore` y `researchStakeholderCore` el `org_id` llega con la primera lectura; la de reglas puede ir en paralelo con `accountContext`.
- `proposalCore` con `scope = null`: una lectura `accounts.select("org_id")` con `inOrg`; se puede hacer en paralelo con `accountContext`.
- Biblioteca: `const { reglas_obligatorias: _omit, ...context } = cc` antes de `adaptPrompt`; el sistema es `withRules(ADAPT_SYSTEM, r)`. No hace falta tocar `adapt.ts`.
- Test de `job-runner`: `runKind` no se exporta (`job-runner.server.ts:133`); se prueba por `runBackgroundJob` (`:54`) con `db` falso y `vi.mock` de `@/lib/ai-core`, `@/lib/playbooks/library-core` y `@/lib/notices.server`, o se exporta `runKind` solo para el test (decide el brief).
- MCP: herramienta propia en `src/lib/mcp/tools/rules.ts` siguiendo `metrics.ts:13-30` (`defineTool` + `mcpCtx`). No va en el registro del agente: el agente de la app ya recibe las reglas en cada turno, y meterla en `TOOLS` la añadiría al prompt de herramientas del agente sin necesidad.
- Alternativas descartadas para MCP: **recurso MCP** (el SDK 3.1.1 no sirve `resources/*`, §3); **reglas en `instructions`** (texto fijo en la definición, igual para todas las empresas y usuarios, sin acceso al usuario ni a su empresa activa, `index.ts:13-16`); **reglas añadidas a cada respuesta de herramienta** (multiplica el texto en cada llamada y el asistente las vería mezcladas con datos).

## 14. Riesgos y dependencias
- **Instrucción, no filtro:** que el modelo cumpla no se comprueba por código (mismo límite que NK-0087 §14). Mitigación fuera de este SDD: un eval con reglas ficticias.
- **MCP depende del asistente externo:** puede no llamar a `get_team_rules` aunque las `instructions` lo pidan. Lo que sí está garantizado: las herramientas de Nokko que redactan con IA (las de `ai-core` y las dos de NK-0087) aplican las reglas dentro, y las escrituras siguen pendientes de confirmación.
- **Inyección entre usuarios:** el texto de una regla se convierte en instrucción en más sitios. Lo acota NK-0095 (solo Owner y Sales Leader escriben reglas) y el bloque de datos separado del sistema.
- **Aviso guardado en el texto:** una preparación generada con fallo conserva la línea de aviso hasta que se regenere (§15.5).
- **Coste:** cada generación suma hasta 12 000 caracteres de reglas y una consulta; en la biblioteca, hasta cinco llamadas por trabajo (cinco jugadas base, `src/lib/AGENTS.md:23`) llevan el mismo bloque.
- **Dependencia de BMAD:** la biblioteca sigue importando `companyContext` de `bmad/drafting.ts` para el resto del contexto (§15.4). Retirar Ciclo GTM (pieza 8) sigue exigiendo decidir su destino.
- **Choque con NK-0095:** ninguno en `knowledge-rules.ts` (este SDD no lo modifica). Si NK-0095 cambia `loadAgentRules`, este SDD se reajusta.
- **Choque con NK-0053 (5a):** no toca `agent.server.ts`; 5a CA-38 sigue igual.

- **Dependencia de seguridad (decisión del coordinador, 2026-11-09):** este SDD multiplica los sitios donde el texto de una regla pasa a ser instrucción. No se entrega a producción antes de que la entrega de NK-0095 confirme la migración aplicada; ambos se entregan en la misma PR y el mensaje de entrega a Fede lo dice. El manifiesto MCP lo regenera este ticket sobre la rama con NK-0095 integrado.

## 15. Preguntas para Fede y para la revisión técnica
1. **Tipo:** el ledger dice `feature`; este SDD la trata como mejora acotada sin PRD (extiende un lector ya aprobado a más llamadas, sin esquema). **Recomendación:** mejora, sin PRD.
2. **Texto de Conocimiento:** la sección Reglas dice «El agente lee estas reglas en cada conversación y al redactar seguimientos y briefs de reunión.» (`hub-screen.tsx:53`), que tras este cambio se queda corto (no falso). **Recomendación:** no tocarlo en este SDD (NK-0095 cambia esa pantalla y C2 mide la casilla); si quieres el texto completo, un ticket aparte tras NK-0095.
3. **`researchAccountCore` y la revisión de cuentas que se enfrían** usan `accountContext` y redactan propuestas para el plan de cuenta, pero no están en `ai-core.ts`. **Recomendación:** fuera de este SDD; registrar un ticket de seguimiento con el mismo patrón.
4. **Biblioteca sin BMAD:** ¿quitar ya la dependencia de `companyContext` (cargar solo `loadSetupData`)? Cambiaría el contexto de la adaptación (dejarían de entrar documentos aprobados y conocimiento de empresa). **Recomendación:** no; va en el inventario de la pieza 8.
5. **Aviso dentro del texto guardado:** ¿anteponer el aviso a la preparación, investigación o revisión guardadas (como hace hoy la nota de búsqueda web, `ai-core.ts:116`), o mostrarlo solo al generar? **Recomendación:** guardarlo: quien abre la preparación al día siguiente (piloto automático) también debe saber que se hizo sin reglas.
6. **Coaching de escucha:** es coaching para el vendedor, no un texto para el cliente. **Recomendación:** incluirlo igualmente (sus «preguntas abiertas para la próxima conversación» sí llegan al cliente) y así las cinco generaciones de `ai-core.ts` se comportan igual.
7. **`get_team_rules` para cualquier rol:** **Recomendación:** sí, cualquier miembro; las reglas aplican a todos y ya las ven en Conocimiento.

**Decisiones del coordinador (2026-11-09, ejecución delegada por Fede: «sí, ese alcance, ejecuta todo tú»):** se aceptan las recomendaciones del autor para todas las preguntas: 1 mejora sin PRD; 2 el texto de la sección Reglas no se cambia aquí; 3 `researchAccountCore` y la revisión de cuentas que se enfrían van a ticket de seguimiento; 4 la dependencia de la biblioteca sobre `bmad/drafting.companyContext` se queda para la pieza 8; 5 el aviso de fallo se guarda dentro de la preparación o investigación; 6 el coaching de escucha entra; 7 `get_team_rules` para cualquier rol.

## 16. Pendiente de verificar
- **[Por verificar]** Que Vitest pueda importar `src/lib/mcp/index.ts` (usa `import.meta.env` y `auth.oauth.issuer` al cargar) para leer `instructions` en CA-11; si no, el test lee el fuente. Lo comprueba quien implemente U-5.
- **[Por verificar]** Que la CLI `extract-manifest.cjs` regenere el manifiesto en este entorno con `node_modules` enlazado. Lo comprueba quien implemente U-5.
- **[Por verificar]** Que Claude, ChatGPT y Codex lean y sigan las `instructions` del servidor y llamen a `get_team_rules`: solo con los clientes reales.
- **[Por verificar]** Número y longitud reales de reglas por empresa, volumen de generaciones y coste por llamada: producción y proveedor.
- **[Por verificar]** Que el modelo cumpla las reglas: eval aparte.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
- Veredicto del gate: No revisado
- CA sin prueba posible o sin G-n: —
- [Por verificar] que sigue sin comprobarse: —
- Contradicciones con el código o con decisiones previas: —
- Lo que esta revisión NO demuestra: —


Revisión de coherencia entre los SDD del Sprint 2: `docs/sdd/annex/sprint2-cross-sdd-gate-20261109.md`.

## 18. Delta de implementación (lo rellena el agente al entregar)
—
