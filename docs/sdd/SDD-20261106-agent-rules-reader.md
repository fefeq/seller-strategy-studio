# SDD-20261106-agent-rules-reader · [Mejora] Las Reglas de Conocimiento llegan al agente (requisito previo para retirar Ciclo GTM)

**Tipo:** Mejora · **Prioridad propuesta:** Alta (bloquea la pieza 8 y la decisión A-3 del PRD de GTM Lab)
**Estado:** Aprobado por Fede el 2026-11-06 («OK a todo» en el chat, tras tres pasadas del gate y la revisión de coherencia) · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-11-06
**PRD:** No aplica para el lector (mejora acotada). Propone enmiendas a `docs/prd/PRD-20261101-gtm-lab-en-nokko.md` y a `docs/sdd/SDD-20261030-gtm-control-tower-5a-agent-memory.md` (NK-0053), §15 · **Depende de:** SDD-B U-0 (mueve `/hub` a `src/components/hub/hub-screen.tsx` y `doc-editor.tsx`, y cambia la caché `["docs"]` a `{ rows, truncated }`); se integra después de C1 · **Bloquea:** pieza 8 del PRD de GTM Lab (retirada de Ciclo GTM y Debates) y A-3 (menú «Estrategia»)

> Sprint 1 de mejoras en pantallas core, bloque D. Rehecho el 2026-11-06 tras perderse la versión anterior (no llegó a subirse).
> Decisión de Fede en la Fase 1 del sprint (chat del 2026-11-06, no registrada aún en `docs/`): las Reglas tendrán un lector real en el agente, y Ciclo GTM no se retira hasta que exista. Este SDD la deja por escrito.

> **Números de línea:** citan `f76f639`; tras B, la pantalla de `/hub` vive en `src/components/hub/` (B U-0) y el brief debe reescribir las referencias.

**Contrato del sprint:** A cambia datos y textos de datos de /metrics (las palabras de cada marca); B, la búsqueda de /hub; C1, estados de pantalla (carga, error, vacío) de /hub, /theory-u y /metrics, sección en la URL de /hub y /theory-u, vacíos y pistas de /hub y /theory-u; C2, el plegado de explicaciones en las tres pantallas y la forma visual (componente DataState) de las marcas de dato de /metrics. D toca la pantalla de /hub (`src/components/hub/` tras B) solo en los textos de la sección Reglas y de la casilla «obligatorio». Orden de integración: A → B → C1 → D → C2.

## 1. Resumen
Conocimiento tiene una sección «Reglas» que promete «Lo que los agentes no pueden hacer sin una persona», pero solo Ciclo GTM las trata como obligatorias. El agente (app y Telegram) no las ve salvo que busque por texto. Este cambio hace que el agente lea las reglas del equipo en cada turno, y también las dos herramientas suyas que redactan textos para clientes. El lector es un módulo único que no depende de Ciclo GTM, y Conocimiento dice cuántas reglas lee. Así, retirar Ciclo GTM ya no deja las Reglas sin lector **en el agente**. La biblioteca de playbooks queda pendiente (§14).

## 2. Problema y para quién
Owner y Sales Leader escriben reglas creyendo que el agente las cumple. No es así, y el plan de GTM Lab (pieza 8) retiraría el único sitio que las trata como obligatorias.

## 3. Evidencia y por qué ahora
Leído en `main` @ `f76f639` y revisado por el gate (§17).
- **La promesa:** `src/routes/_authenticated/hub.tsx:35` («Lo que los agentes no pueden hacer sin una persona»); las reglas de equipo se marcan «obligatorio» (`:129`).
- **Quién las trata como obligatorias:** solo BMAD. `src/lib/bmad/sources.ts:16-32` (`isMandatory`, `knowledgeForAgents`: hasta 12 reglas, `:13`, cortadas a 4000 caracteres, `:25`) y `MANDATORY_RULE` (`:34-35`), usados por los borradores de Ciclo GTM (`bmad/drafting.ts:6`, consulta en `:16`: los 60 documentos de equipo más recientes de cualquier sección, y después se filtran las reglas) y los Debates (`bmad/debate-core.ts:5`).
- **Quién las recibe sin tratarlas como obligatorias:** `companyContext` (que lleva `reglas_obligatorias`) también llega a la biblioteca de playbooks (`src/lib/playbooks/library-core.ts:3`, `:15`, `:24`, sin `MANDATORY_RULE`), a la herramienta `draft_artifact` (`src/lib/agent/tools/cycle.ts:34`) y a `src/lib/inngest/job-runner.server.ts:195`, `:202`, `:207`, `:214`.
- **El agente no las lee:** `src/lib/agent/agent.server.ts:30-49` (`systemPrompt`) añade memoria (`memoryBlock`, `:60`) pero no Conocimiento. La búsqueda (`agent/tools/core-read.ts:236`) solo devuelve documentos si el modelo busca y el texto coincide.
- **Herramientas del agente que redactan para clientes sin reglas:** `draft_followup` (`core-read.ts:213`, llamada a la IA en `:222`) y `prepare_meeting_brief` (`core-write.ts:400`, llamada en `:428`).
- **Las generaciones de pantalla tampoco:** `src/lib/ai-core.ts:18` (solo `company`, `objections`, `playbooks`, `methodology`).
- **Entradas de turno:** `runAgent` es la única, llamada desde `src/lib/agent.functions.ts:93-102` (app, cliente de usuario) y `src/routes/api/public/telegram/webhook.ts:99-101` (Telegram, **cliente de servicio**: `webhook.ts:19` → `src/lib/channel-ctx.server.ts:2`, `:15`). Con la clave de servicio el RLS de `knowledge_docs` (`drizzle/migrations/0002_multitenant_organizations.sql:127`) no se aplica.
- **Las escrituras del agente esperan confirmación:** `agent.server.ts:37` y `:114-122`.
- **El plan de GTM Lab retira el lector:** `PRD-20261101-gtm-lab-en-nokko.md:71`, `:105` (A-3), `:133` (pieza 8). No menciona las Reglas.
- **NK-0053 (5a, aprobado) reescribe el mismo prompt:** modos en lugar de personajes y flujos (`5a:182`), apoyados en `bmad/workflows.ts` (`5a:60`); su CA-18 obliga a avisar si falla la lectura de la memoria (`5a:80`).
- **Quién escribe reglas:** cualquier miembro (inserción en `knowledge_docs` solo exige pertenencia, `0002:128`; `hub.tsx` no limita la sección por rol; cualquiera marca un documento como obligatorio, `hub.tsx:162`); la importación de Drive puede escribir en `rules` (`agent/tools/drive.ts:6`, `background.functions.ts:33`).
- Número de reglas por empresa, longitud y coste por turno: sin dato.

## 4. Resultado buscado
- Turnos de `runAgent` que reciben las reglas del equipo: hoy 0 % por código; objetivo 100 %.
- Textos que redacta el agente con llamadas propias (`draft_followup`, seguimiento para el cliente; `prepare_meeting_brief`, preparación interna) que reciben las reglas: hoy 0 de 2; objetivo 2 de 2.
- Lectores de Reglas en el agente que sobreviven a la retirada de Ciclo GTM: hoy 0; objetivo 1.
- Cumplimiento real por el modelo: sin dato (§14).

## 5. Alcance
**Incluye:**
- Módulo `src/lib/knowledge-rules.ts` con el lector (filtros explícitos, límites como parámetros) y el texto del aviso; `bmad/sources.ts` lo reexporta y conserva sus límites actuales.
- Bloque de reglas en el prompt de `runAgent` (app y Telegram, todos los modos) y en las llamadas de `draft_followup` y `prepare_meeting_brief`.
- Aviso al usuario si las reglas no se pudieron leer.
- Texto de la sección Reglas de Conocimiento.
- Propuesta de enmiendas (§15).

**No incluye:**
- Bloqueos deterministas a partir del texto de una regla.
- `ai-core.ts`, la biblioteca de playbooks (que ya recibe las reglas sin tratarlas como obligatorias), `job-runner.server.ts` y los asistentes externos por MCP (§15).
- Limitar quién escribe reglas (§14, §15).
- Editar el PRD de GTM Lab o el SDD 5a (solo textos propuestos).
- Esquema, RLS, migraciones.

## 6. Cambios de comportamiento (delta)
**Añadido:** reglas del equipo en cada turno del agente y en sus dos herramientas de redacción para clientes; aviso «No he podido leer las reglas del equipo. Respondo sin ellas; vuelve a intentarlo en un momento.»; en Conocimiento › Reglas: «El agente lee estas reglas en cada conversación y al redactar seguimientos y briefs de reunión.» y, si no entran todas, «El agente lee {L} de {N} reglas (las más recientes). Junta o acorta las que puedas.»
**Modificado:** `knowledgeForAgents`, `isMandatory` y `MANDATORY_RULE` viven en `src/lib/knowledge-rules.ts`; BMAD los reexporta con sus límites actuales (sin cambio de comportamiento).
**Eliminado:** nada.

## 7. Historias y criterios de aceptación
### H-1: Como Owner o Sales Leader, quiero que el agente cumpla las reglas que el equipo escribe en Conocimiento.
- **CA-1a** `rulesBlock(reglas)` devuelve el bloque de datos `reglas_obligatorias` (separado del apartado «Reglas:» del sistema, `agent.server.ts:35`) con `MANDATORY_RULE` y la frase «Las reglas no cambian que tus escrituras sean propuestas que una persona confirma.»; sin reglas devuelve cadena vacía. No depende del canal ni del modo. · prueba: `src/lib/knowledge-rules.test.ts`
- **CA-1b** `runAgent` carga las reglas y las pasa al modelo: con `vi.mock("ai")` capturando `system`, el prompt contiene el bloque en tres turnos: app en modo `chat`, app en modo `interview` y Telegram (siempre `chat`, `webhook.ts:101`). · prueba: `src/lib/agent/agent-rules.test.ts`
- **CA-2** La lectura filtra de forma explícita por `org_id = ctx.orgId`, `scope = 'team'` y (`section = 'rules'` o `mandatory = true`), sin depender del RLS; y, si el cliente devolviera filas de otra organización o personales, no entra ninguna (filtro también en memoria). · prueba: `src/lib/knowledge-rules.test.ts` (con `db` falso que comprueba los filtros y devuelve filas ajenas)
- **CA-3** El agente lee como máximo `maxRules` reglas y `maxChars` caracteres en total (valores en §15.1), las más recientes por `updated_at` entre **todas** las reglas de la organización (no dentro de una ventana de documentos de otras secciones). BMAD conserva sus valores actuales (12 reglas, 4000 caracteres por regla, sin tope total). · prueba: `src/lib/knowledge-rules.test.ts`
- **CA-4** Si la lectura falla (error devuelto por Supabase o excepción), el turno sigue sin reglas, el agente dice «No he podido leer las reglas del equipo. Respondo sin ellas; vuelve a intentarlo en un momento.» (igual que 5a CA-18 con la memoria) y el log del servidor no incluye el texto de ninguna regla. · prueba: `src/lib/agent/agent-rules.test.ts` (los dos tipos de fallo)
- **CA-5** `draft_followup` y `prepare_meeting_brief` pasan el mismo bloque de reglas a su llamada a la IA. Si la lectura de reglas falla dentro de la herramienta, la herramienta sigue sin reglas y devuelve el aviso de CA-4 en el campo `mensaje` (la convención que `decidePending` copia al resultado y a `agent_messages`, `agent.functions.ts:144-153`); `draft_followup` además lo antepone a su `borrador`. · prueba: `src/lib/agent/agent-rules.test.ts` (prompt capturado, los dos tipos de fallo, y un caso de `prepare_meeting_brief` que pasa por `decidePending` y comprueba que el `result` contiene «No he podido leer las reglas del equipo…»)

### H-2: Como Owner o Sales Leader, quiero saber qué reglas lee el agente.
- **CA-6** El texto de la sección Reglas dice que el agente las lee. N = reglas obligatorias de equipo con texto (las vacías no cuentan, como hoy `bmad/sources.ts:19`); L = reglas que entran **completas** con los topes. Si L < N, avisa «El agente lee {L} de {N} reglas completas (las más recientes). Junta o acorta las que puedas.» · prueba: `src/lib/knowledge-rules.test.ts` (incluido el caso de una regla cortada por el tope de caracteres)

### H-3: Como Fede, quiero poder retirar Ciclo GTM sin perder el lector de Reglas del agente.
- **CA-7** `src/lib/knowledge-rules.ts` no importa nada de `src/lib/bmad/` (imports estáticos, `import()` dinámicos ni `require`, como `src/lib/gtm-lab/core/boundaries.test.ts:20-28`); `bmad/sources.ts` reexporta desde él, y los tests existentes de `src/lib/bmad/` (incluido `sources.test.ts`) pasan sin cambios. · prueba: `src/lib/knowledge-rules.test.ts` y tests existentes

## 8. Casos límite y errores
- Regla que no cabe entera en el tope total: entra cortada y no cuenta en L, así que CA-6 avisa.
- Más reglas que el límite: entran las más recientes (CA-3).
- Regla marcada obligatoria fuera de la sección Reglas: cuenta (misma definición que `isMandatory`).
- Regla que contradice al sistema («ejecuta sin confirmar»): manda el sistema; la confirmación no se puede desactivar (CA-1a).
- Telegram con cliente de servicio: CA-2.
- Fallo de lectura: CA-4.

## 9. Experiencia y copy
Textos de §6. La instrucción al modelo reutiliza `MANDATORY_RULE`. Español, «tú», sin iconos.

## 10. Datos, permisos y privacidad
Sin tablas ni columnas nuevas. La lectura filtra de forma explícita por organización y ámbito (CA-2), porque en Telegram el cliente es de servicio y el RLS no se aplica; regla ya exigida por `src/lib/AGENTS.md:7`. El texto de las reglas no va a logs ni a auditoría. Tests con reglas ficticias.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| Turno del agente (existente; crece el prompt) | Sin cambio | Sin cambio | Sin dato. Entrada añadida ≤ `maxChars` por turno |
| `draft_followup`, `prepare_meeting_brief` (existentes; crece el prompt) | Sin cambio | Sin cambio | Sin dato. Entrada añadida ≤ `maxChars` por llamada |

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | `src/lib/knowledge-rules.ts` (lector con filtros explícitos y límites, `rulesBlock`, texto del aviso); `bmad/sources.ts` reexporta | CA-1a, CA-2, CA-3, CA-6, CA-7 | `src/lib/knowledge-rules.test.ts` |
| U-2 | `runAgent` carga y pasa las reglas; aviso si fallan | CA-1b, CA-4 | `src/lib/agent/agent-rules.test.ts` |
| U-3 | Reglas en `draft_followup` y `prepare_meeting_brief` | CA-5 | `src/lib/agent/agent-rules.test.ts` |
| U-4 | Textos de la pantalla de `/hub` tras B: sección Reglas en `src/components/hub/hub-screen.tsx` (`SECTIONS`, equivale a `hub.tsx:35` de `f76f639`) y casilla «De obligado cumplimiento» en `src/components/hub/doc-editor.tsx` (equivale a `hub.tsx:161-164`). Casilla, dos ramas, ≤ 135 caracteres de explicación para que el bloque no pase de 160 (umbral de C2): sin Reglas «El agente lo lee en cada conversación y al redactar seguimientos y preparaciones de reunión, y el Ciclo GTM en sus documentos.»; en Reglas «Todo lo de Reglas lo es: el agente…» con la misma frase en minúscula. Aviso de CA-6 en pantalla: N y L salen de `data.rows` de la caché `["docs"]`, solo reglas de equipo, con la misma función pura del lector; se muestra solo tras responder la consulta (dentro de `ScreenState` de C1); si `truncated`, no muestra «{L} de {N}» y dice «Puede haber más reglas de las que se han cargado.» | CA-6 (pantalla) | `src/components/hub/hub-screen.test.tsx` (caso L < N y caso `truncated`) |

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- Cargar las reglas junto a `memoryBlock(ctx)` (`agent.server.ts:60`) y pasarlas a `systemPrompt` como la memoria. El bloque va en una función aparte para que 5a solo tenga que conservarla.
- Test de cableado: ningún test importa hoy `agent.server.ts`; hay que simular `ai`, `@/lib/gemini` y `memory.server`.
- El aviso de CA-4 se puede emitir como texto fijo antes de la respuesta del modelo, sin depender de que el modelo lo diga.

## 14. Riesgos y dependencias
- **Instrucción, no filtro:** que el modelo cumpla una regla no es comprobable por código; lo comprobable es que llega (CA-1a/1b). Mismo límite que declara 5a (`5a:189`). Mitigación fuera de este SDD: un eval con reglas ficticias.
- **Inyección entre usuarios:** cualquier miembro, y la importación de Drive, pueden escribir una regla de equipo que pasa a ser instrucción para todos. El daño queda acotado porque las escrituras siempre se confirman (`agent.server.ts:114-122`) y las reglas van como bloque de datos, no mezcladas con las del sistema. Limitar quién escribe en Reglas: §15.
- **La biblioteca de playbooks** recibe las reglas sin `MANDATORY_RULE` y depende de `bmad/` (`library-core.ts:3`): la pieza 8 tiene que decidir su destino (enmienda en §15).
- **Coste por turno:** crece con las reglas; acotado por `maxChars`.
- **Choque con NK-0053:** si 5a se construye antes, este SDD se rehace sobre los modos; si va después, 5a conserva el bloque (enmienda).

## 15. Preguntas para Fede y para la revisión técnica
1. **Decidido por Fede (2026-11-06): `maxRules = 12`, `maxChars = 12 000`.** ~~Tope del agente:~~ propuesta original: `maxRules = 12` y `maxChars = 12 000` en total (BMAD sigue con 12 × 4000 sin tope total). ¿Te vale?
2. **Quién escribe reglas:** ¿limitamos la sección Reglas y la marca «obligatorio» a Owner y Sales Leader (otro SDD)?
3. **Retractado (2026-11-06):** el «hallazgo» de la primera pasada sobre `search_knowledge` era falso: `core-read.ts:236-237` ya filtra en memoria `scope = team` o `created_by = userId`, con un comentario sobre Telegram, y lo prueba `agent-tools.test.ts:584-596`. Se registró como NK-0066 con tu OK antes de comprobarlo. **NK-0066 cerrado como `REJECTED` por orden de Fede (2026-11-06).**
4. **`ai-core.ts`, playbooks y MCP:** ¿SDD aparte, después de este?
5. **Enmiendas aprobadas por Fede (2026-11-06) y aplicadas** en `PRD-20261101-gtm-lab-en-nokko.md` (§6.2, §6.3 A-3, §7, §8 piezas 2 y 8) y en `SDD-20261030-gtm-control-tower-5a-agent-memory.md` (CA-38):
   - PRD de GTM Lab, §6.3 A-3: «Bloqueado hasta que `SDD-20261106-agent-rules-reader` esté entregado y verificado: hoy Ciclo GTM es el único sitio que trata las Reglas de Conocimiento como obligatorias (decisión de Fede, 2026-11-06).»
   - PRD, §8, pieza 8, «Depende de»: «7; `SDD-20261106-agent-rules-reader` entregado; e inventario de lo que importa `src/lib/bmad/` fuera de Ciclo GTM y Debates (biblioteca de playbooks, agente y modos de 5a, etapas de deals en `deals.tsx:17` y `core-write.ts:16`), con destino decidido para cada uno».
   - PRD, §6.2, fila 5a: «5a se mantiene, conservando el bloque de Reglas de Conocimiento en todos los modos»; §7 (lista de SDD a enmendar) y pieza 2: añadir 5a.
   - PRD, §7 Riesgos: «Retirar Ciclo GTM sin lector de Reglas en el agente deja sin efecto la sección Reglas de Conocimiento.»
   - SDD 5a (NK-0053), H-1, CA nuevo: «En todos los modos, el prompt del turno conserva el bloque de Reglas de Conocimiento de `SDD-20261106-agent-rules-reader` (CA-1a a CA-4).» · prueba: `agent-modes.test.ts`.

## 16. Pendiente de verificar
- Número y longitud reales de reglas por organización; coste real por turno: producción y proveedor.
- Que el modelo cumpla las reglas: eval aparte.

**Versión 4 (2026-11-06):** tercera pasada del gate: aviso de fallo de herramientas en `mensaje` y probado por `decidePending` (bloqueante 1); texto de la casilla ≤ 135 caracteres con sus dos ramas (2); dependencia de B U-0, rutas nuevas de `/hub`, aviso de CA-6 sobre `data.rows` y `truncated` (3 y coherencia 1); contrato común actualizado.

**Versión 3 (2026-11-06):** corregido tras la segunda pasada: retirado el falso hallazgo de seguridad y NK-0066 propuesto para cierre (objeción nueva 1), L = reglas completas y N sin vacías (2), texto de la casilla de `hub.tsx:163` en U-4 y en el contrato (3), modo `interview` en CA-1b, fallo dentro de herramientas en CA-5 y «textos que redacta el agente» en §4 (4).

**Versión 2 (2026-11-06):** corregido tras el gate: filtros explícitos por organización y ámbito (objeción 1), aviso de fallo alineado con 5a CA-18 (2), tope como parámetro sin cambiar BMAD y sin ventana de 60 documentos (3), prueba del cableado (4), herramientas de redacción para clientes incluidas (5), enmiendas completas al PRD (6, 7), riesgo de inyección y bloque de datos separado (8), citas (9) y CA-7 con reexportación e imports dinámicos (10). No ha tenido segunda pasada del gate.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Informe de la primera pasada (sobre v1, commit `cd0d070`), copiado sin editar:

**Veredicto del gate: Objeciones**

El objetivo del SDD se sostiene: Ciclo GTM es el único sitio que da a las Reglas una instrucción de obligado cumplimiento, y el agente no las lee. Pero hay cuatro problemas que corregir antes de aprobarlo. En Telegram el agente usa la clave de servicio, que se salta el RLS, así que el §10 se equivoca al confiar en el RLS. CA-4 contradice CA-18 de 5a, que ya está aprobado. El tope de reglas no está decidido y afecta al texto de CA-5. Y faltan enmiendas al PRD.

- **CA sin prueba posible o sin G-n:**
  - **CA-2, tal como está redactado:** con un `db` simulado no se puede probar «nunca entra una regla de otra organización» si la garantía depende del RLS. Solo se puede probar si el CA exige un filtro explícito por organización y ámbito.
  - **CA-1, en parte:** una función pura prueba que el prompt contiene las reglas. No prueba que `runAgent` las cargue y se las pase al modelo. Ningún test importa hoy `agent.server.ts`, así que hay que simular `ai`, `@/lib/gemini` y `memory.server`. Es posible, pero el SDD no lo dice.
  - **CA-5 cubre la regla del texto, no la pantalla:** la prueba pura no demuestra que `hub.tsx` muestre el aviso. Es aceptable por el patrón del repo, pero conviene declararlo.
  - **CA-6 sí es viable.** Ya hay un test que hace lo mismo: `src/lib/gtm-lab/core/boundaries.test.ts:20-28` lee los imports estáticos, los `import()` dinámicos y los `require`.
  - No hay G-n que exigir porque el SDD no tiene PRD propio.

- **[Por verificar] resueltos:**
  - **¿Es `runAgent` la única entrada de los turnos de app y Telegram? Sí.** Solo lo llaman `src/lib/agent.functions.ts:93-102` (app, con cliente de usuario, `:33`/`:67`) y `src/routes/api/public/telegram/webhook.ts:99-101` (siempre en modo `"chat"`). `src/lib/telegram-suggestions.ts:1-2` es puro: no llama a la IA ni a la base de datos. `telegram.server.ts` no tiene llamadas a la IA.
  - **El cliente del turno en Telegram es de servicio:** `webhook.ts:19` (`supabaseAdmin`) llega a `channelCtx` (`src/lib/channel-ctx.server.ts:2`, `:15`, `db: admin`). El MCP sí usa sesión de usuario (`src/lib/mcp/context.ts:10`).
  - **Límites y orden actuales:** máximo 12 reglas (`bmad/sources.ts:13`), cada una cortada a 4000 caracteres (`:25`). Orden por `updated_at` descendente, pero solo entre los 60 documentos de equipo más recientes de cualquier sección (`drafting.ts:16`); después se filtran las obligatorias (`sources.ts:20`). En total, hasta 48 000 caracteres más títulos.

- **[Por verificar] que siguen sin comprobarse:**
  - Número y longitud reales de las reglas por organización (producción).
  - Coste real por turno con el proveedor en uso.
  - Dónde quedó registrada la decisión de Fede del 2026-11-06 («Fase 1 del sprint»): no la encuentro en `docs/`.
  - Que el modelo cumpla las reglas: no se puede comprobar por código.

- **Contradicciones con el código o con decisiones previas:**
  1. **§10 (RLS):** el SDD dice que basta el RLS del cliente del turno, y en Telegram es falso (cliente de servicio, ver arriba).
  2. **§3 («único lector… usados solo por drafting y debate-core»):** es incompleto. `companyContext`, que lleva `reglas_obligatorias`, también lo usan:
     - la biblioteca de playbooks (`src/lib/playbooks/library-core.ts:3`, `:15`, `:24`), que mete las reglas en el contexto de la adaptación sin `MANDATORY_RULE`;
     - la herramienta del agente `draft_artifact` (`src/lib/agent/tools/cycle.ts:34`);
     - `src/lib/inngest/job-runner.server.ts:195`, `:202`, `:207` y `:214`.

     La tesis central sigue en pie: solo BMAD las trata como obligatorias.
  3. **CA-4 (fallo silencioso, solo log)** choca con 5a CA-18, aprobado: si falla la lectura de la memoria, el agente debe decir al usuario que no pudo consultarla y qué hacer (`SDD-20261030-…-5a-agent-memory.md:80`, `:279`).
  4. **§6 («mismo comportamiento para BMAD») frente a §15.1 (tope de 12 000 caracteres):** si el tope va en el módulo compartido, BMAD cambia. Y CA-5 («lee las {L} más recientes») sería falso si el tope de caracteres corta antes de llegar a L.
  5. **La enmienda a 5a deja incoherente el PRD:**
     - PRD §6.2 dice que 5a «se mantiene» y la única enmienda de su fila es la de 5b (`PRD-20261101-gtm-lab-en-nokko.md:90`);
     - §7 lista como SDD a enmendar «1a, 1b, 4b y 5b» (`:115`);
     - la pieza 2 tampoco incluye 5a (`:126`).
  6. **Citas erróneas:**
     - `agent.server.ts:42` debe ser `:37` («NO se ejecutan al momento»);
     - `agent.server.ts:61` debe ser `:60` (`memoryBlock`);
     - `bmad/sources.ts:26` debe ser `:25` (corte a 4000);
     - `agent.server.ts:30-48` debe ser `:30-49`;
     - `sources.ts:16-31` debe ser `:16-32`;
     - `drafting.ts:16` como «uso» del lector: el import está en `:6`; `:16` es la consulta.
     - Correctas: `hub.tsx:35` y `:129`, `core-read.ts:236`, `ai-core.ts:18`, `debate-core.ts:5`, PRD `:71`, `:105` y `:133`, 5a `:182` y `:189`.

- **Lo que esta revisión NO demuestra:**
  - **No ejecuté nada.** No hay `node_modules` en el repo, así que no corrieron Vitest, tipos ni build.
  - **`gate.mjs` no se ejecutó.** Sobre esta rama solo cambian documentos (`git diff f76f639 HEAD`: cuatro SDD) y no hay ticket NK. Por eso tampoco aplica `flake.mjs`.
  - **Segunda máquina y soak: NOT RUN.**
  - No comprobé las políticas RLS en producción, solo en `drizzle/migrations/0002_multitenant_organizations.sql:127-130`.
  - No medí coste ni latencia.
  - No hay evidencia de que el modelo obedezca las reglas.

## Objeciones detalladas

1. **El filtro por organización y ámbito tiene que ser explícito, no depender del RLS.**
   - Evidencia: en Telegram, `ctx.db` es `supabaseAdmin` (`webhook.ts:19`, `channel-ctx.server.ts:2`, `:15`). La política de lectura (`0002_multitenant_organizations.sql:127`) no se aplica con la clave de servicio. Y `src/lib/AGENTS.md:7` exige ya que cada handler filtre por `org_id` de forma explícita.
   - Corrección:
     - §10: «Consulta con `.eq("org_id", ctx.orgId).eq("scope","team")` explícitos; en Telegram el cliente es de servicio».
     - CA-2: probar que se llama a esos filtros con un `db` falso y que, con filas de otra organización o personales devueltas por el falso, no entra ninguna (filtro también en memoria).
   - Hallazgo aparte, previo a este SDD: la herramienta `search` (`core-read.ts:236`) no filtra por `scope`/`created_by`. En Telegram devuelve documentos personales de otros miembros. Merece un ticket propio.

2. **CA-4 debe alinearse con 5a CA-18.**
   - Evidencia: `5a-agent-memory.md:80`. Un fallo silencioso es justo lo que H-2 quiere evitar («no confiar en una regla que no llega»). Además, Supabase devuelve `{ error }` sin lanzar excepción.
   - Corrección: «Si la carga falla (error devuelto o excepción), el turno sigue sin reglas, el agente dice que no pudo leer las reglas del equipo y que lo reintentes, y el log no lleva el texto de las reglas». La prueba debe cubrir los dos tipos de fallo.

3. **Decidir el tope antes de aprobar, y redactar CA-5 según ese tope.**
   - Evidencia: `sources.ts:13` y `:25`; §11 y §15.1 dejan el tope abierto; §6 promete no cambiar BMAD.
   - Corrección:
     - Fijar en un CA el número y el total de caracteres que lee el agente.
     - Ponerlo como parámetro del lector, con los valores actuales de BMAD por defecto, para que CA-6 («tests de BMAD sin cambios») se mantenga.
     - Que el aviso cuente las reglas que realmente entran (L efectivo), no el máximo teórico.
     - Que el agente no herede la ventana de 60 documentos de `drafting.ts:16`: si hay más de 60 documentos de equipo más recientes que las reglas, BMAD hoy no lee ninguna. El §8 dice «como hace hoy», y no es así.

4. **CA-1 necesita una prueba del cableado, no solo de la función pura.**
   - Evidencia: `systemPrompt` es privada (`agent.server.ts:30`); `runAgent` construye el prompt en `:60-62`; ningún test importa `agent.server.ts`.
   - Corrección: separar en dos CA, o nombrar dos pruebas:
     - (a) `rulesBlock()` puro: con reglas, sin reglas, modos `chat` e `interview` y canal `telegram`;
     - (b) `runAgent` con `vi.mock("ai")` capturando `system` en `streamText`, con contexto de app y de Telegram.

5. **Hay herramientas del propio agente que redactan textos para el cliente con llamadas a la IA aparte, sin reglas.**
   - Evidencia: `draft_followup` (`core-read.ts:213`, llamada en `:222`) escribe mensajes a leads; `prepare_meeting_brief` (`core-write.ts:400`, llamada en `:428`). Ninguna está en `ai-core.ts`, así que la exclusión del §5 no las cubre. Una regla como «nunca ofrecemos descuentos» no llega al texto que el agente devuelve. Y el copy «El agente lee estas reglas en cada conversación» lo da a entender.
   - Corrección: o se incluyen (pasar el bloque de reglas a esas dos llamadas, con CA), o se declaran en «No incluye» y en §14, y el copy se matiza.

6. **Faltan enmiendas al PRD para que la de 5a sea coherente.**
   - Evidencia: PRD `:90` (§6.2, fila 5a/5b/5c), `:115` (§7), `:126` (pieza 2).
   - Corrección: añadir a §15.4:
     - §6.2: la fila 5a pasa a «5a: conservar el bloque de Reglas de Conocimiento en todos los modos»;
     - §7 y pieza 2: incluir 5a.
   - La enmienda a 5a no debería ir solo en el §13, que son sugerencias sin fuerza. Mejor como CA nuevo en H-1 de 5a, con su prueba (`agent-modes.test.ts`).

7. **La pieza 8 necesita más condiciones que el lector de Reglas.**
   - Evidencia de cosas que también dependen de `bmad/`:
     - `playbooks/library-core.ts:3` (`companyContext`, que además lleva las reglas a la adaptación de playbooks);
     - `agent.server.ts:11-12` y `:34` (personajes, flujos, `get_cycle_status`);
     - 5a CA-2: los modos se apoyan en `bmad/workflows.ts` (`5a:60`, `:182`);
     - `deals.tsx:17` y `core-write.ts:16` (`TRACKS`, `stageGate`).
   - Corrección: en «Depende de» de la pieza 8, añadir: «inventario de lo que importa `src/lib/bmad/` fuera de Ciclo GTM y Debates (playbooks, agente y modos de 5a, etapas de deals), con destino decidido para cada uno». Y en este SDD, matizar el §1: «retirar Ciclo GTM ya no deja las Reglas sin lector **en el agente**». La biblioteca de playbooks queda pendiente.

8. **Cualquier miembro escribe reglas de equipo, y esas reglas pasan a ser instrucciones de sistema para todos.**
   - Evidencia:
     - la inserción en `knowledge_docs` solo exige ser miembro (`0002:128`);
     - `hub.tsx` no limita por rol la sección Reglas; cualquiera puede marcar como obligatorio un documento de equipo (`hub.tsx:162`);
     - la importación de Drive puede escribir en `rules` (`agent/tools/drive.ts:6`, `background.functions.ts:33`), es decir, texto externo.
   - H-1 dice «Owner o Sales Leader», pero el código no lo impone. El daño queda acotado porque las escrituras siempre quedan pendientes de confirmar (`agent.server.ts:114-122`).
   - Corrección: declararlo en §14 como riesgo de inyección entre usuarios, o limitar quién escribe en Reglas en otro SDD. Además:
     - meter las reglas como bloque de datos con la clave `reglas_obligatorias` (la que nombra `MANDATORY_RULE`, `sources.ts:34-35`);
     - no mezclarlas con el apartado «Reglas:» que ya tiene el sistema (`agent.server.ts:35`), para no confundir las del sistema con las del equipo.

9. **Corregir las citas del §3 y del §8** listadas en el punto 6 de contradicciones.

10. **CA-6 es viable, pero hay que concretarlo.**
    - Evidencia: hoy `bmad/sources.test.ts:2` importa `./sources`.
    - Corrección:
      - que `bmad/sources.ts` reexporte desde el módulo nuevo (si no, ese test cambia);
      - que la comprobación cubra también los `import()` dinámicos, como hace `boundaries.test.ts:22-25`, porque el repo usa mucho `await import("@/lib/bmad/...")`.


Informe de la segunda pasada (sobre v2), copiado sin editar:

- **Veredicto del gate (segunda pasada):** Objeciones. La v2 resuelve las 10 objeciones de la primera pasada: 9 del todo y la 4 en parte. Quedan cuatro problemas. El principal: el hallazgo de seguridad que la v2 copió de la primera pasada (§14, y el ticket NK-0066 que salió de él) es falso según el código de `f76f639`.

- **Objeciones de la primera pasada:**
  1. Resuelta. CA-2 filtra de forma explícita por `org_id`, `scope` y sección, y vuelve a filtrar en memoria. El §10 dice ahora que en Telegram el cliente es de servicio. Pero el «hallazgo aparte» de esa objeción era erróneo (objeción nueva 1).
  2. Resuelta. CA-4 cubre los dos tipos de fallo y avisa con el mismo texto que pide 5a CA-18.
  3. Resuelta. §15.1 fija 12 reglas y 12 000 caracteres (decisión de Fede). BMAD conserva 12 × 4000 y el agente no hereda la ventana de 60 documentos (CA-3). L es el número de reglas que de verdad entran (CA-6).
  4. Parcial. CA-1b prueba el cableado en un turno de app y otro de Telegram, los dos en modo `chat` (Telegram siempre va en `chat`, `webhook.ts:101`). Ninguna prueba de cableado cubre el modo `interview`. CA-1a lo dice, pero `rulesBlock(reglas)` no recibe ni el modo ni el canal.
  5. Resuelta. `draft_followup` y `prepare_meeting_brief` entran en el alcance (CA-5) y el copy de §6 las nombra.
  6. Resuelta. La v2 propone las enmiendas al PRD (§6.2, §7, pieza 2) y a 5a (CA-38), y ya están aplicadas en `014ae3d`.
  7. Resuelta. §1 dice ahora «sin lector **en el agente**». La pieza 8 del PRD añade el inventario de lo que importa `bmad/` (PRD línea 134 en esta rama).
  8. Resuelta. §14 declara el riesgo de inyección entre usuarios. CA-1a separa el bloque `reglas_obligatorias` del apartado «Reglas:» del sistema (`agent.server.ts:35`).
  9. Resuelta. Todas las citas de §3 coinciden con `f76f639`.
  10. Resuelta. CA-7 pide la reexportación desde `bmad/sources.ts`, cubre los `import()` dinámicos y los `require`, y deja `sources.test.ts` sin cambios.

- **CA sin prueba posible o sin G-n:**
  - CA-6: no se puede escribir el test, porque L no está definido cuando una regla entra cortada por el tope de caracteres (objeción nueva 2).
  - CA-1a: «probado con canal app y Telegram y modos chat e interview» no aplica a una función pura que solo recibe las reglas.
  - No se exige G-n: el SDD no tiene PRD propio.

- **[Por verificar] que sigue sin comprobarse:**
  - Número y longitud reales de las reglas por organización (producción).
  - Coste real por turno con el proveedor en uso.
  - Que el modelo cumpla las reglas (solo con un eval).
  - Las políticas RLS en producción: solo las leí en `0002_multitenant_organizations.sql:127-128`.

- **Contradicciones con el código o con decisiones previas:**
  1. §14 («Hallazgo aparte»), §5 («No incluye», cuarto punto) y §15.3 dicen que la búsqueda en Conocimiento del agente no filtra por `scope`/`created_by`. Es falso: `src/lib/agent/tools/core-read.ts:237` filtra en memoria (`d.scope === "team" || d.created_by === c.userId`), lo cubre el test `src/lib/agent-tools.test.ts:584-596` («search_knowledge hides other people's personal docs») y lo exige `src/lib/AGENTS.md:7` («personal knowledge docs only for their author»). `ai-core.ts:20` aplica el mismo filtro. La herramienta en `:236` es `search_knowledge`, no `search`: `search` está en `:43` y no lee `knowledge_docs`. La decisión de Fede §15.3 y el ticket NK-0066 (`.factory/ledger.json`, commit `1fc22ca`) se tomaron sobre esa premisa falsa.
  2. `hub.tsx:163`: el texto de la casilla «De obligado cumplimiento» sigue diciendo que solo lo leen los documentos del Ciclo GTM. El SDD solo cambia una línea en la sección Reglas (contrato, línea 10), así que tras el cambio la casilla queda incompleta, y del todo falsa tras la pieza 8.
  3. Línea 8 del SDD: dice que la decisión de la Fase 1 «no está registrada aún en `docs/`». Ya está registrada: PRD A-3 (línea 105) y el estado del PRD (línea 4), commit `014ae3d`.
  4. Las citas del PRD y de 5a valen en `f76f639`, pero en esta rama se han desplazado: la pieza 8 está en la línea 134 (no en `:133`) y 5a CA-18 en la 82 (no en `:80`).

- **Lo que esta revisión NO demuestra:**
  - No ejecuté nada. No hay `node_modules`, así que no corrieron Vitest, tipos ni build, ni `gate.mjs` o `flake.mjs` (en esta rama solo cambian documentos y el ledger).
  - Segunda máquina y soak: no se ejecutaron (NOT RUN).
  - No comprobé el RLS ni los datos en producción.
  - No medí coste ni latencia.
  - No hay evidencia de que el modelo obedezca las reglas.
  - Los documentos del sprint los cotejé solo contra `hub.tsx`.
  - El mensaje relayado «1 rotular, 2 OK, 3 sí, 4 se perdió, 5 OK» no se puede asignar con seguridad a la numeración del §15. Por eso no lo uso como decisión, y §15.2 y §15.4 siguen abiertas en el documento.

**Objeciones nuevas**

1. **El hallazgo de seguridad de §14 y el ticket NK-0066 son falsos.**
   - Evidencia: `core-read.ts:236-237` (filtro en memoria tras la consulta), `agent-tools.test.ts:584-596`, `src/lib/AGENTS.md:7` y `ai-core.ts:20`.
   - Corrección:
     - Quitar el punto de §14 y el cuarto punto de «No incluye» del §5.
     - En §15.3, anotar que la premisa era errónea y proponer a Fede cerrar NK-0066 como «no es un bug», con su OK.
     - En §17, dejar constancia de que la primera pasada se equivocó en este punto.

2. **CA-6 y §8 se contradicen cuando una regla entra cortada.**
   - Evidencia: §8 (línea 76) dice que la regla cortada «cuenta como leída parcialmente» y que el aviso lo dice. CA-6 (línea 70) solo avisa si L < N. Si la regla cortada cuenta en L y L = N, no hay aviso.
   - Corrección: definir L como «reglas que entran completas». Si alguna se corta, mostrar «El agente lee {L} de {N} reglas completas…». Añadir el caso al test de `knowledge-rules.test.ts`.
   - Definir también si N cuenta las reglas sin texto (hoy `knowledgeForAgents` las descarta, `sources.ts:19`).

3. **Falta corregir el texto de la casilla de `hub.tsx:163`.**
   - Evidencia: `hub.tsx:163` dice «los agentes lo leen siempre al redactar el brief, el plan y los demás documentos del Ciclo GTM». Quien marca como obligatorio un documento fuera de Reglas solo ve ese texto.
   - Corrección:
     - Ampliar U-4 y el contrato de la línea 10 a esa línea, con un texto que nombre al agente, los seguimientos y los briefs de reunión, además del Ciclo GTM.
     - Avisar a B y C1, que también tocan `hub.tsx`.

4. **El cableado del modo `interview` y los fallos dentro de las herramientas quedan sin prueba ni definición.**
   - Evidencia: Telegram siempre va en `"chat"` (`webhook.ts:101`), y en `agent.server.ts:41-43` el bloque va dentro de `base` antes de la rama de `interview`. Además, CA-5 no dice qué pasa si la lectura de reglas falla dentro de `draft_followup` o de `prepare_meeting_brief` (`core-write.ts:400`, una herramienta de escritura que se ejecuta al confirmar).
   - Corrección:
     - CA-1b: añadir un turno de app en modo `interview`.
     - CA-1a: quitar «canal y modos», o hacer que `rulesBlock` los reciba.
     - CA-5: definir el fallo. Por ejemplo, la herramienta sigue sin reglas y devuelve el mismo aviso que CA-4 en un campo `aviso`. Probarlo en `agent-rules.test.ts`.
   - Menor: `prepare_meeting_brief` genera una preparación interna, no un texto para el cliente. Ajustar en §4 «textos para clientes» a «textos que redacta el agente».


Informe de la tercera pasada (sobre v3; sus bloqueantes se corrigen en v4), copiado sin editar:

- **Veredicto del gate (tercera pasada):** Objeciones
- **Objeciones de la segunda pasada:**
  1. Resuelta. El falso hallazgo sale del §14 y del §5, la retractación está en el §15.3 y NK-0066 consta como `REJECTED` en `.factory/ledger.json:1717`. La constancia está en el §15.3 y no en el §17, lo que basta.
  2. Parcial. CA-6 define L como reglas completas y N como reglas con texto, y prueba el caso de la regla cortada. Pero el §6 (línea 55) mantiene el texto viejo, «El agente lee {L} de {N} reglas (las más recientes)», sin «completas». Ahora hay dos textos del aviso distintos.
  3. Resuelta en este documento: U-4 y el contrato incluyen la casilla de `hub.tsx:163`. El texto nuevo, en cambio, crea dos problemas con B y C2 (bloqueantes 2 y 3).
  4. Resuelta en su redacción. CA-1b añade el modo `interview`, CA-1a no depende de canal ni modo, CA-5 define qué pasa si falla la lectura y el §4 habla de «textos que redacta el agente». Pero el campo `aviso` de CA-5 no llega al usuario (bloqueante 1).
  - Contradicciones de la segunda pasada:
    - La 3 no está corregida: la línea 8 sigue diciendo «no registrada aún en `docs/`», y está registrada en PRD `:4` y `:105`.
    - La 4 está resuelta en parte: el §3 avisa de que se leyó sobre `f76f639`, pero las citas siguen siendo `:133` (en la rama es `:134`) y 5a `:80` (en la rama es `:82`).
- **CA sin prueba posible o sin G-n:** ninguno imposible de probar. Hay dos matices:
  - La prueba de CA-5 pasaría, pero no demuestra que el aviso llegue al usuario (bloqueante 1).
  - CA-6 depende de cómo cuenta `maxChars`, que no está definido (nota 2).
  - Sin PRD propio, no se exige G-n.
- **[Por verificar] que sigue sin comprobarse:**
  - Número y longitud reales de las reglas por organización (producción).
  - Coste real por turno.
  - Que el modelo cumpla las reglas (solo con un eval).
  - Las políticas RLS en producción.
- **Contradicciones con el código o con decisiones previas:**
  1. El campo `aviso` de CA-5 no existe en el contrato de resultados: `decidePending` solo muestra `mensaje` (`src/lib/agent.functions.ts:144-148`), y la aprobación de Sugerencias igual (`:369-374`).
  2. El texto nuevo de la casilla mide 181 caracteres visibles. C2 fija el umbral en 160 y cuenta en `/hub` «ninguno» (`SDD-20261106-ux-metrics-data-state.md:38`, `:5`).
  3. B extrae `hub.tsx` a `src/components/hub/hub-screen.tsx` y `doc-editor.tsx` (`SDD-20261106-hub-search.md:115`) y se integra antes que D. Aun así, D cita `hub.tsx:35` y `:163` y dice «Depende de: —» (línea 5).
  4. Línea 8: «no registrada aún en `docs/`» es falso (PRD `:4`, `:105`).
  5. El §5 excluye «los asistentes externos por MCP», pero CA-5 mete las reglas dentro de las propias herramientas. Por tanto también les llegan a MCP (`src/lib/mcp/tools/agent-tools.ts:142`) y a la aprobación de Sugerencias de `meeting-no-prep` (`src/lib/proactive/detectors/meeting-no-prep.ts:18` → `agent.functions.ts:368`).
- **Lo que esta revisión NO demuestra:**
  - No ejecuté nada: ni Vitest, ni tipos, ni build, ni `gate.mjs` ni `flake.mjs`.
  - Segunda máquina y soak: NOT RUN.
  - No comprobé el RLS ni los datos en producción, ni medí coste o latencia.
  - No hay evidencia de que el modelo obedezca las reglas.
  - Los 181 caracteres son una cuenta a mano con el método de C2 (24 de «De obligado cumplimiento» + 1 de la expresión + 156 del texto nuevo), no el recorrido del árbol de TypeScript.
  - Comparé con los SDD hermanos solo en lo que toca a `/hub` y a la casilla.

**Objeciones bloqueantes**

1. **El aviso de CA-5 en un campo `aviso` no llega al usuario en `prepare_meeting_brief`.**
   - Evidencia:
     - `prepare_meeting_brief` es una herramienta de escritura (`core-write.ts:401`). Se ejecuta al confirmar, en `decidePending`, que solo copia `mensaje` al resultado y a `agent_messages` (`agent.functions.ts:144-153`).
     - En Sugerencias pasa lo mismo (`agent.functions.ts:369-374`).
     - En `draft_followup` (lectura) el resultado va al modelo, que puede no repetirlo.
     - El test de CA-5 pasaría y el usuario no vería nada. Va contra el propio CA-4, que es justo evitar un fallo silencioso.
   - Corrección:
     - En CA-5, usar el campo `mensaje`, que es la convención existente. En `draft_followup`, además, anteponer el aviso al `borrador` o devolverlo en `mensaje`.
     - Añadir a la prueba un caso que pase por `decidePending` y compruebe que `result` contiene «No he podido leer las reglas del equipo…».

2. **El texto nuevo de la casilla rompe la medición de C2.**
   - Evidencia:
     - U-4 (línea 100) cambia el texto a 156 caracteres. El bloque `hub.tsx:161-164` pasa de 146 a 181 visibles.
     - C2 pliega lo que pasa de 160, cuenta «/hub: ninguno» (`ux-metrics-data-state.md:38`) y su U-1 se para y escala a Fede si la nueva medición difiere (`:121`).
     - El orden de integración es D → C2.
   - Corrección:
     - Acortar el texto a 135 caracteres o menos, de modo que el bloque quede en 160 o menos. Por ejemplo: «El agente lo lee en cada conversación y al redactar seguimientos y preparaciones de reunión, y el Ciclo GTM en sus documentos.» (151 en total).
     - O acordar con C2 que ese bloque entra en su lista.
     - Decirlo en el §14.

3. **D no declara su dependencia de B y cita archivos que B mueve.**
   - Evidencia:
     - `SDD-20261106-hub-search.md:115`: tras U-0, `SECTIONS` y la casilla viven en `src/components/hub/hub-screen.tsx` y `src/components/hub/doc-editor.tsx`.
     - El informe de la tercera pasada de B lo pide (`hub-search.md:333`, `:367`).
     - D sigue con «Depende de: —» (línea 5) y U-4 cita `hub.tsx:35` y `:163`.
   - Corrección:
     - «Depende de: SDD-B U-0».
     - En U-4 y en el §3, citar las dos rutas nuevas con su equivalencia en `hub.tsx` de `f76f639`.
     - Añadir a la cabecera la misma advertencia que tiene C1.

**Notas para el brief**

1. **Un solo texto del aviso.** Unificar el §6 (línea 55) con CA-6 en «El agente lee {L} de {N} reglas completas (las más recientes). Junta o acorta las que puedas.». Los tests y el walkthrough comprueban un único literal.
2. **Definir qué cuenta en `maxChars`.** Decir si es solo `body` o también el título y el formato de `reglas_obligatorias`. De eso depende cuándo una regla «entra completa», y con ello L en CA-6.
3. **Que el lector y el contador vean el mismo conjunto.**
   - El lector no debe aplicar `.limit(maxRules)` en la consulta antes de descartar las reglas sin texto. Si lo hace, las vacías ocupan huecos y el agente lee menos de lo que cuenta la pantalla.
   - Hay que nombrar la función pura que calcula L y N, por ejemplo `rulesCoverage(docs, {maxRules, maxChars})`, y añadirla a U-1. `hub.tsx:60` ya carga todos los documentos ordenados por `updated_at`, así que la pantalla puede usarla tal cual.
4. **Copy de la casilla:** con reglas se lee «Todo lo de Reglas lo es: El agente…», con mayúscula tras los dos puntos. Ajustar el prefijo o pasar a minúscula.
5. **Unificar el nombre:** el §6 dice «briefs de reunión» y U-4 «preparaciones de reunión». El glosario usa «Preparación de llamada».
6. **Declarar el alcance real de CA-5.** Al ir dentro de las herramientas, las reglas también llegan por MCP y por Sugerencias (contradicción 5). Hay que matizar el §5 («No incluye» se refiere a las herramientas propias de MCP, no a las del agente que MCP reutiliza) o declararlo como efecto aceptado.
7. **Arreglar referencias del documento:**
   - Línea 8: quitar «no registrada aún» y citar PRD `:4` y `:105`.
   - Actualizar las citas que se han movido en la rama: PRD pieza 8 `:134`, 5a CA-18 `:82`, 5a CA-38 `:66`.
   - Añadir «Ticket: NK-0069» a la cabecera (`.factory/ledger.json:1788`).
8. **Enlazar las preguntas abiertas con sus tickets.** Las §15.2 y §15.4 ya tienen ticket en el ledger: NK-0074 («solo Owner y Sales Leader escriben Reglas…») y NK-0075 («Reglas… en ai-core, biblioteca de playbooks y MCP»), ambos `LOGGED`. Siguen siendo preguntas abiertas a Fede; enlazarlas.
9. **Mocks del test de CA-1b.** El §13 no lista todos los que necesita `runAgent`. Además de `ai`, `@/lib/gemini` y `memory.server`, hacen falta:
   - `@/lib/after-response.server`;
   - `./run-id` y `./tools` (o un `ToolCtx` con roles reales);
   - variables de entorno para `aiProviders`, porque si falta `LOVABLE_API_KEY` lanza error en `agent.server.ts:56`.
10. **Dónde se emite el aviso de CA-4.** Concretar que va en el `text` devuelto por `runAgent` y guardado en `agent_messages` (`agent.server.ts:83`), para que Telegram y la app lo muestren. Hoy, si el modelo no devuelve texto, se sustituye por un texto por defecto (`:81`); el aviso debe ir antepuesto después de ese paso.
11. **Nombre del módulo.** `knowledgeForAgents` también devuelve `conocimiento_empresa` (`bmad/sources.ts:21-27`). Al moverlo a `knowledge-rules.ts`, ese módulo cubre más que reglas. No es un problema, pero conviene decirlo en el §6 «Modificado».
12. **5a CA-38** (`SDD-20261030-…-5a-agent-memory.md:66`) exige conservar CA-1a a CA-4, no CA-5. Es coherente, porque las herramientas no dependen de los modos. Basta mencionarlo en el §14.


Revisión de coherencia entre los cinco SDD del sprint: `docs/sdd/annex/sprint1-cross-sdd-gate-20261106.md`.

## 18. Delta de implementación (lo rellena el agente al entregar)
Rama `feat/nk-0069-agent-rules-reader` sobre `731b651` (NK-0069). Decisiones que el SDD dejaba abiertas, para que el gate las valide:
- **Qué cuenta en `maxChars`:** título + texto de cada regla (lo que escribe el equipo); no cuenta el texto fijo del bloque (`MANDATORY_RULE`, cabecera, formato JSON). La regla que no cabe entra cortada y cierra la lista; las posteriores no entran.
- **Literal del aviso:** se usa el de CA-6, con «completas» («El agente lee {L} de {N} reglas completas (las más recientes). Junta o acorta las que puedas.»); el §6 conserva la versión sin «completas».
- **Texto de la sección Reglas:** se añade al de `SECTIONS` («Lo que los agentes no pueden hacer sin una persona.») la frase del §6, sin quitar la promesa existente.
- **Casilla:** `{isRules ? "Todo lo de Reglas lo es: el" : "El"} agente lo lee…`; rama sin Reglas 126 caracteres, rama de Reglas 151 visibles en pantalla; con el método de C2 (expresión = 1) el bloque mide 149 (cuenta a mano, no recorrido del árbol de TypeScript).
- **Consulta del lector:** sin `.limit()` (las vacías o de otras secciones no ocupan huecos); queda acotada por el máximo de filas por defecto de PostgREST.
- **Memoria:** `learnFrom` aprende de la respuesta del modelo sin el aviso de CA-4.
- **Alcance real de CA-5:** al ir dentro de las herramientas, las reglas también llegan cuando MCP o la aprobación de Sugerencias (`meeting-no-prep`) ejecutan esas dos herramientas (nota 6 de la tercera pasada).
