# SDD-20261106-agent-rules-reader · [Mejora] Las Reglas de Conocimiento llegan al agente (requisito previo para retirar Ciclo GTM)

**Tipo:** Mejora · **Prioridad propuesta:** Alta (bloquea la pieza 8 y la decisión A-3 del PRD de GTM Lab)
**Estado:** Borrador (v2, corregido tras el gate; tope y enmiendas aprobados por Fede el 2026-11-06) · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-11-06
**PRD:** No aplica para el lector (mejora acotada). Propone enmiendas a `docs/prd/PRD-20261101-gtm-lab-en-nokko.md` y a `docs/sdd/SDD-20261030-gtm-control-tower-5a-agent-memory.md` (NK-0053), §15 · **Depende de:** — · **Bloquea:** pieza 8 del PRD de GTM Lab (retirada de Ciclo GTM y Debates) y A-3 (menú «Estrategia»)

> Sprint 1 de mejoras en pantallas core, bloque D. Rehecho el 2026-11-06 tras perderse la versión anterior (no llegó a subirse).
> Decisión de Fede en la Fase 1 del sprint (chat del 2026-11-06, no registrada aún en `docs/`): las Reglas tendrán un lector real en el agente, y Ciclo GTM no se retira hasta que exista. Este SDD la deja por escrito.

**Contrato con los demás SDD del sprint:** D solo toca `hub.tsx` para una línea de texto en la sección Reglas; el resto de `hub.tsx` es de B (búsqueda) y C1 (estados y URL).

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
- Textos para clientes del agente (`draft_followup`, `prepare_meeting_brief`) que reciben las reglas: hoy 0 de 2; objetivo 2 de 2.
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
- El fallo de alcance de la búsqueda del agente en Telegram (§14: ticket aparte).
- Editar el PRD de GTM Lab o el SDD 5a (solo textos propuestos).
- Esquema, RLS, migraciones.

## 6. Cambios de comportamiento (delta)
**Añadido:** reglas del equipo en cada turno del agente y en sus dos herramientas de redacción para clientes; aviso «No he podido leer las reglas del equipo. Respondo sin ellas; vuelve a intentarlo en un momento.»; en Conocimiento › Reglas: «El agente lee estas reglas en cada conversación y al redactar seguimientos y briefs de reunión.» y, si no entran todas, «El agente lee {L} de {N} reglas (las más recientes). Junta o acorta las que puedas.»
**Modificado:** `knowledgeForAgents`, `isMandatory` y `MANDATORY_RULE` viven en `src/lib/knowledge-rules.ts`; BMAD los reexporta con sus límites actuales (sin cambio de comportamiento).
**Eliminado:** nada.

## 7. Historias y criterios de aceptación
### H-1: Como Owner o Sales Leader, quiero que el agente cumpla las reglas que el equipo escribe en Conocimiento.
- **CA-1a** `rulesBlock(reglas)` devuelve el bloque de datos `reglas_obligatorias` (separado del apartado «Reglas:» del sistema, `agent.server.ts:35`) con `MANDATORY_RULE` y la frase «Las reglas no cambian que tus escrituras sean propuestas que una persona confirma.»; sin reglas devuelve cadena vacía. Probado con canal app y Telegram y modos `chat` e `interview`. · prueba: `src/lib/knowledge-rules.test.ts`
- **CA-1b** `runAgent` carga las reglas y las pasa al modelo: con `vi.mock("ai")` capturando `system` en la llamada, el prompt contiene el bloque en un turno de app y en uno de Telegram. · prueba: `src/lib/agent/agent-rules.test.ts`
- **CA-2** La lectura filtra de forma explícita por `org_id = ctx.orgId`, `scope = 'team'` y (`section = 'rules'` o `mandatory = true`), sin depender del RLS; y, si el cliente devolviera filas de otra organización o personales, no entra ninguna (filtro también en memoria). · prueba: `src/lib/knowledge-rules.test.ts` (con `db` falso que comprueba los filtros y devuelve filas ajenas)
- **CA-3** El agente lee como máximo `maxRules` reglas y `maxChars` caracteres en total (valores en §15.1), las más recientes por `updated_at` entre **todas** las reglas de la organización (no dentro de una ventana de documentos de otras secciones). BMAD conserva sus valores actuales (12 reglas, 4000 caracteres por regla, sin tope total). · prueba: `src/lib/knowledge-rules.test.ts`
- **CA-4** Si la lectura falla (error devuelto por Supabase o excepción), el turno sigue sin reglas, el agente dice «No he podido leer las reglas del equipo. Respondo sin ellas; vuelve a intentarlo en un momento.» (igual que 5a CA-18 con la memoria) y el log del servidor no incluye el texto de ninguna regla. · prueba: `src/lib/agent/agent-rules.test.ts` (los dos tipos de fallo)
- **CA-5** `draft_followup` y `prepare_meeting_brief` pasan el mismo bloque de reglas a su llamada a la IA. · prueba: `src/lib/agent/agent-rules.test.ts` (capturando el prompt de cada herramienta)

### H-2: Como Owner o Sales Leader, quiero saber qué reglas lee el agente.
- **CA-6** El texto de la sección Reglas dice que el agente las lee; si las reglas que entran (L, contando el tope de caracteres) son menos que las obligatorias de equipo (N), avisa con L y N. · prueba: `src/lib/knowledge-rules.test.ts` (regla pura del texto; que `hub.tsx` lo pinte se comprueba en el walkthrough)

### H-3: Como Fede, quiero poder retirar Ciclo GTM sin perder el lector de Reglas del agente.
- **CA-7** `src/lib/knowledge-rules.ts` no importa nada de `src/lib/bmad/` (imports estáticos, `import()` dinámicos ni `require`, como `src/lib/gtm-lab/core/boundaries.test.ts:20-28`); `bmad/sources.ts` reexporta desde él, y los tests existentes de `src/lib/bmad/` (incluido `sources.test.ts`) pasan sin cambios. · prueba: `src/lib/knowledge-rules.test.ts` y tests existentes

## 8. Casos límite y errores
- Regla más larga que el tope total: se corta y cuenta como leída parcialmente; el aviso de CA-6 lo dice («{L} de {N}»).
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
| U-4 | Texto de la sección Reglas en `hub.tsx` | CA-6 (pantalla) | walkthrough |

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- Cargar las reglas junto a `memoryBlock(ctx)` (`agent.server.ts:60`) y pasarlas a `systemPrompt` como la memoria. El bloque va en una función aparte para que 5a solo tenga que conservarla.
- Test de cableado: ningún test importa hoy `agent.server.ts`; hay que simular `ai`, `@/lib/gemini` y `memory.server`.
- El aviso de CA-4 se puede emitir como texto fijo antes de la respuesta del modelo, sin depender de que el modelo lo diga.

## 14. Riesgos y dependencias
- **Instrucción, no filtro:** que el modelo cumpla una regla no es comprobable por código; lo comprobable es que llega (CA-1a/1b). Mismo límite que declara 5a (`5a:189`). Mitigación fuera de este SDD: un eval con reglas ficticias.
- **Inyección entre usuarios:** cualquier miembro, y la importación de Drive, pueden escribir una regla de equipo que pasa a ser instrucción para todos. El daño queda acotado porque las escrituras siempre se confirman (`agent.server.ts:114-122`) y las reglas van como bloque de datos, no mezcladas con las del sistema. Limitar quién escribe en Reglas: §15.
- **Hallazgo aparte (seguridad, previo a este SDD):** la herramienta `search` del agente (`core-read.ts:236`) no filtra por `scope`/`created_by`; en Telegram, con cliente de servicio, puede devolver documentos personales de otros miembros. Propuesta: ticket propio por `nokko-intake`.
- **La biblioteca de playbooks** recibe las reglas sin `MANDATORY_RULE` y depende de `bmad/` (`library-core.ts:3`): la pieza 8 tiene que decidir su destino (enmienda en §15).
- **Coste por turno:** crece con las reglas; acotado por `maxChars`.
- **Choque con NK-0053:** si 5a se construye antes, este SDD se rehace sobre los modos; si va después, 5a conserva el bloque (enmienda).

## 15. Preguntas para Fede y para la revisión técnica
1. **Decidido por Fede (2026-11-06): `maxRules = 12`, `maxChars = 12 000`.** ~~Tope del agente:~~ propuesta original: `maxRules = 12` y `maxChars = 12 000` en total (BMAD sigue con 12 × 4000 sin tope total). ¿Te vale?
2. **Quién escribe reglas:** ¿limitamos la sección Reglas y la marca «obligatorio» a Owner y Sales Leader (otro SDD)?
3. **Decidido por Fede (2026-11-06): se registra como bug en el ledger** (búsqueda del agente en Telegram, documentos personales de otros).
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

## 18. Delta de implementación (lo rellena el agente al entregar)
—
