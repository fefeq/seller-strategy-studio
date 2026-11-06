# SDD-20261106-agent-rules-reader · [Mejora] Las Reglas de Conocimiento llegan al agente (requisito previo para retirar Ciclo GTM)

**Tipo:** Mejora · **Prioridad propuesta:** Alta (bloquea la pieza 8 y la decisión A-3 del PRD de GTM Lab)
**Estado:** Borrador · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-11-06
**PRD:** No aplica para el lector (mejora acotada). Propone enmiendas a `docs/prd/PRD-20261101-gtm-lab-en-nokko.md` y a `docs/sdd/SDD-20261030-gtm-control-tower-5a-agent-memory.md` (NK-0053), §15 · **Depende de:** — · **Bloquea:** pieza 8 del PRD de GTM Lab (retirada de Ciclo GTM y Debates) y A-3 (menú «Estrategia»)

> Sprint 1 de mejoras en pantallas core, bloque D. Rehecho el 2026-11-06 tras perderse la versión anterior (no llegó a subirse).
> Decisión de Fede (registrada en la Fase 1 del sprint): las Reglas tendrán un lector real en el agente, y Ciclo GTM no se retira hasta que exista.

## 1. Resumen
Conocimiento tiene una sección «Reglas» que promete «Lo que los agentes no pueden hacer sin una persona», pero hoy solo las lee Ciclo GTM. El agente (app y Telegram) no las ve salvo que busque por texto. Este cambio hace que el agente lea las reglas del equipo en cada turno, con un único módulo de lectura que no depende de Ciclo GTM, y que Conocimiento diga cuántas lee. Así, retirar Ciclo GTM ya no deja las Reglas sin lector.

## 2. Problema y para quién
Owner y Sales Leader escriben reglas creyendo que el agente las cumple. Hoy no es así, y el plan de GTM Lab (pieza 8) retiraría el único sitio que sí las lee.

## 3. Evidencia y por qué ahora
Leído en `main` @ `f76f639`:
- **La promesa:** `src/routes/_authenticated/hub.tsx:35`: `["rules", "Reglas", "Lo que los agentes no pueden hacer sin una persona"]`; en la lista, las reglas de equipo se marcan «obligatorio» (`hub.tsx:129`).
- **Único lector:** `src/lib/bmad/sources.ts:16-31` (`isMandatory` = sección `rules` o `mandatory`; `knowledgeForAgents` con hasta 12 reglas de 4000 caracteres) y `MANDATORY_RULE` (`:34-35`), usados solo por `src/lib/bmad/drafting.ts:16` y `src/lib/bmad/debate-core.ts:5`: los borradores de Ciclo GTM y los Debates.
- **El agente no las lee:** `src/lib/agent/agent.server.ts:30-48` (`systemPrompt`) añade memoria (`:61`) pero no Conocimiento. La herramienta de búsqueda (`src/lib/agent/tools/core-read.ts:236`) solo devuelve documentos si el modelo decide buscar y el texto coincide.
- **Las generaciones tampoco:** `src/lib/ai-core.ts:18` lee Conocimiento solo de `company`, `objections`, `playbooks` y `methodology`.
- **El plan de GTM Lab retira el lector:** `docs/prd/PRD-20261101-gtm-lab-en-nokko.md:71` (Ciclo GTM y Debates en solo lectura y luego archivados), `:105` (A-3: menú «Estrategia» sustituye a «Ciclo GTM» y «Debates»), `:133` (pieza 8, retirada, depende solo de 7). Ninguna línea del PRD menciona las Reglas.
- **NK-0053 (5a, aprobado) reescribe el mismo prompt:** sustituye personajes y flujos por modos (`SDD-20261030-gtm-control-tower-5a-agent-memory.md:182`) y no menciona Reglas ni `knowledge_docs`.
- **Las escrituras del agente ya esperan confirmación** (`agent.server.ts:42`, «NO se ejecutan al momento»): una regla de Conocimiento no puede añadir un bloqueo determinista que no exista; lo que sí puede es llegar al modelo como instrucción obligatoria. Esto se declara (§14).
- Número de reglas por empresa y longitud: sin dato. Coste por turno: sin dato.

## 4. Resultado buscado
- Turnos del agente que reciben las reglas del equipo: hoy 0 % (por código), objetivo 100 % de los turnos de `runAgent`.
- Lectores de Reglas que sobreviven a la retirada de Ciclo GTM: hoy 0, objetivo 1.
- Cumplimiento real de las reglas por el modelo: sin dato (no medible por código; ver §14).

## 5. Alcance
**Incluye:**
- Módulo único de lectura de Reglas fuera de `bmad/` (sale de `bmad/sources.ts`), que BMAD sigue usando mientras exista.
- Bloque de reglas en el prompt de `runAgent` (app y Telegram) con la instrucción de obligado cumplimiento.
- En Conocimiento, sección Reglas: qué lee el agente y aviso si hay más reglas de las que lee.
- Propuesta de enmiendas (texto en §15) al PRD de GTM Lab y al SDD 5a de NK-0053.

**No incluye:**
- Bloqueos deterministas a partir del texto de una regla.
- Reglas en `ai-core.ts` (preparación de llamadas, research) y en asistentes externos por MCP (ver §15).
- Cambios en BMAD más allá de importar desde el módulo nuevo.
- Editar el PRD de GTM Lab o el SDD 5a: solo se proponen los textos; se aplican con la aprobación de Fede.
- Esquema, RLS, migraciones.

## 6. Cambios de comportamiento (delta)
**Añadido:** reglas del equipo en cada turno del agente; texto en la sección Reglas de Conocimiento: «El agente lee estas reglas en cada conversación.» y, si hay más que el límite, «Hay {N} reglas; el agente lee las {L} más recientes. Junta o acorta las que puedas.»
**Modificado:** `knowledgeForAgents`, `isMandatory` y `MANDATORY_RULE` cambian de módulo (mismo comportamiento para BMAD).
**Eliminado:** nada.

## 7. Historias y criterios de aceptación
### H-1: Como Owner o Sales Leader, quiero que el agente cumpla las reglas que escribo en Conocimiento, para no repetirlas en cada conversación.
- **CA-1** Cada turno de `runAgent` (canal app y Telegram, modo normal y entrevista) incluye en su prompt las reglas obligatorias del equipo de la organización actual (sección «Reglas» o marcadas obligatorias, ámbito equipo, con contenido), junto con la instrucción de obligado cumplimiento. · prueba: `src/lib/agent/agent-rules.test.ts`
- **CA-2** Nunca entra una regla personal ni una de otra organización. · prueba: `src/lib/agent/agent-rules.test.ts`
- **CA-3** Sin reglas, el prompt no lleva bloque de reglas ni texto vacío. · prueba: `src/lib/agent/agent-rules.test.ts`
- **CA-4** Si cargar las reglas falla, el turno sigue sin ellas y el fallo queda en el log del servidor sin el texto de las reglas. · prueba: `src/lib/agent/agent-rules.test.ts`

### H-2: Como Owner o Sales Leader, quiero saber qué reglas lee el agente, para no confiar en una que no llega.
- **CA-5** La sección Reglas de Conocimiento dice que el agente las lee y, si el número de reglas obligatorias de equipo supera el límite, avisa con el número total y el límite. · prueba: `src/lib/knowledge-rules.test.ts` (regla pura del texto)

### H-3: Como Fede, quiero poder retirar Ciclo GTM sin perder el lector de Reglas.
- **CA-6** El lector de Reglas no importa nada de `src/lib/bmad/`, y `src/lib/bmad/` importa el lector (no al revés); los tests existentes de BMAD pasan sin cambios. · prueba: `src/lib/knowledge-rules.test.ts` (comprobación de imports) y tests existentes de `src/lib/bmad/`

## 8. Casos límite y errores
- Regla muy larga: se corta a la longitud máxima por regla (hoy 4000 caracteres, `bmad/sources.ts:26`).
- Más reglas que el límite: entran las más recientes por `updated_at` (como hace hoy `drafting.ts:16`) y CA-5 avisa.
- Regla marcada obligatoria fuera de la sección Reglas: cuenta (misma definición que `isMandatory`).
- Regla que contradice una instrucción del sistema (p. ej. «ejecuta sin confirmar»): manda la instrucción del sistema; la confirmación de escrituras no se puede desactivar con una regla. Se cubre con un caso en CA-1.
- Otra organización: CA-2.

## 9. Experiencia y copy
- Conocimiento › Reglas: «El agente lee estas reglas en cada conversación.» / «Hay {N} reglas; el agente lee las {L} más recientes. Junta o acorta las que puedas.»
- Instrucción al modelo: se reutiliza `MANDATORY_RULE` y se añade «Las reglas no cambian que tus escrituras sean propuestas que una persona confirma.»
- Español, «tú», sin iconos.

## 10. Datos, permisos y privacidad
Sin tablas ni columnas nuevas. Lectura de `knowledge_docs` con el cliente del turno (RLS de la organización actual), ámbito `team`. El texto de las reglas no se escribe en logs ni en auditoría. Tests con reglas ficticias.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| Turno del agente (existente; crece el prompt, no hay llamada nueva) | Sin cambio | Sin cambio | Sin dato. Tope de entrada añadido: límite de reglas × longitud máxima; con los valores de BMAD (12 × 4000 caracteres) son hasta 48 000 caracteres por turno. Propuesta: tope total de 12 000 caracteres (ver §15) |

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | `src/lib/knowledge-rules.ts` (lector, límites, texto de aviso) y `bmad/` importándolo | CA-5, CA-6 | `src/lib/knowledge-rules.test.ts` |
| U-2 | Bloque de reglas en `systemPrompt` de `agent.server.ts`, carga con fallo tolerado | CA-1, CA-2, CA-3, CA-4 | `src/lib/agent/agent-rules.test.ts` |
| U-3 | Texto de la sección Reglas en `hub.tsx` | CA-5 | `src/lib/knowledge-rules.test.ts` |

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- Cargar las reglas junto a `memoryBlock(ctx)` (`agent.server.ts:61`) y pasarlas a `systemPrompt` como un parámetro más, igual que la memoria. Consulta: `knowledge_docs` con `scope = team`, `section = rules` o `mandatory = true`, orden `updated_at` desc, límite.
- `systemPrompt` hoy es privada: exportarla o extraer `rulesBlock()` pura para probarla sin red.
- `hub.tsx` también lo toca SDD-B (búsqueda) y SDD-C (patrón): U-3 es una línea de texto; orden de integración B → C → D o D en cualquier punto, con conflicto trivial.
- `agent.server.ts` lo reescribe NK-0053 (5a, modos): por eso el bloque de reglas va en una función aparte, que 5a solo tiene que conservar (enmienda en §15).

## 14. Riesgos y dependencias
- **Instrucción, no filtro.** Que el modelo cumpla una regla no es comprobable por código; lo comprobable es que la regla llega (CA-1). Mismo límite que declara 5a (`SDD-20261030-gtm-control-tower-5a-agent-memory.md:189`). Mitigación posible fuera de este SDD: un eval con reglas ficticias.
- **Coste por turno:** crece con el número y la longitud de las reglas. Sin dato de uso; tope propuesto en §15.
- **Choque con NK-0053:** si 5a se construye antes, este SDD se rehace sobre los modos. Si va después, 5a debe conservar el bloque (enmienda).

## 15. Preguntas para Fede y para la revisión técnica
1. **Tope total de reglas por turno:** propongo 12 reglas y 12 000 caracteres en total (no 48 000). ¿Te vale?
2. **Generaciones de `ai-core.ts`** (preparación de llamadas, research): ¿también deben leer las Reglas? Propongo que sí, en un SDD aparte, después de este.
3. **Asistentes externos por MCP:** no tienen prompt nuestro. ¿Exponemos las reglas como un recurso MCP que el asistente lee al conectarse, en otro SDD?
4. **Enmiendas propuestas (para aplicar solo con tu OK):**
   - PRD de GTM Lab, §6.3 A-3, añadir: «Bloqueado hasta que `SDD-20261106-agent-rules-reader` esté entregado y verificado: hoy Ciclo GTM es el único lector de las Reglas de Conocimiento (decisión de Fede, 2026-11-06).»
   - PRD de GTM Lab, §8, pieza 8, «Depende de»: «7 y `SDD-20261106-agent-rules-reader` entregado».
   - PRD de GTM Lab, §7 Riesgos, añadir: «Retirar Ciclo GTM sin lector de Reglas deja sin efecto la sección Reglas de Conocimiento.»
   - SDD 5a (NK-0053), §13 «Modos», añadir: «El bloque de Reglas de Conocimiento (`SDD-20261106-agent-rules-reader`, CA-1 a CA-4) se conserva en todos los modos; sustituir personajes y flujos no lo elimina.»

## 16. Pendiente de verificar
- Número y longitud reales de reglas por organización: producción.
- Que `runAgent` sea el único punto de entrada de los turnos de app y Telegram (sugerencias proactivas y `telegram-suggestions.ts` pueden tener prompts propios): el gate.
- Coste real del aumento de prompt con el proveedor y el modelo en uso: proveedor.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
- Veredicto del gate: No revisado
- CA sin prueba posible o sin G-n: —
- [Por verificar] que sigue sin comprobarse: —
- Contradicciones con el código o con decisiones previas: —
- Lo que esta revisión NO demuestra: —

## 18. Delta de implementación (lo rellena el agente al entregar)
—
