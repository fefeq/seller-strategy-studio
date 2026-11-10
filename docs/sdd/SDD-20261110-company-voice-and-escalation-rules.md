# SDD-20261110-company-voice-and-escalation-rules · [Feature] Voz de la empresa, regla «Escalar» y reglas por defecto

**Tipo:** Feature · **Prioridad propuesta:** Media (los plays que redactan hoy no tienen la voz de la empresa; las reglas por defecto reducen el riesgo de borradores fuera de tono o promesas sin base)
**Estado:** Aprobado (2026-11-10, por delegación de Fede: «si ejecuta todo vos»; dos pasadas de `nokko-gate`, objeciones de la segunda resueltas en el texto sin tercera pasada) · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-11-10
**Ticket:** NK-0126 (iniciativa; este es su SDD 3)
**PRD:** `docs/prd/PRD-20261110-diagnostico-y-equipos-de-plays.md` (cubre G-4 y G-5) · **Depende de:** `SDD-20261106-agent-rules-reader.md` (NK-0087, Hecho), `SDD-20261109-rules-write-permissions.md` (NK-0095, Hecho en código; ver §14) y `SDD-20261109-rules-in-ai-readers.md` (NK-0096)

> Un SDD dice cómo se verifica que está bien hecho. Cada criterio de aceptación (CA-n) tiene una prueba automática que lo nombra.

## 1. Resumen
Tres piezas sin pantalla nueva, sobre Conocimiento (`knowledge_docs`):
1. **Voz:** una sección «Voz» donde Owner y Sales Leader guardan tres mensajes reales de la empresa; los textos que redactan el agente y los plays la usan como molde.
2. **Escalar:** un tipo de regla («Escalar a una persona cuando…») dentro de las Reglas actuales, que el agente lee aparte para parar y preguntar.
3. **Reglas por defecto:** un conjunto base de reglas Nunca, Siempre y Escalar, redactado por nosotros y aprobado por Fede, que un Owner o Sales Leader puede añadir a su empresa con una acción explícita.

## 2. Problema y para quién
Los borradores de seguimiento, reunión y reactivación no conocen cómo escribe la empresa, y las Reglas solo dicen qué no hacer, no cuándo pasar el caso a una persona. Para Owner y Sales Leader, que escriben las reglas que el agente de todo el equipo obedece.

## 3. Evidencia y por qué ahora
Leído en `main` @ `aa368b62` (código de `d3eeba1`), el 2026-11-10:
- `src/lib/knowledge-rules.ts:18`: una regla es un documento de equipo con `mandatory` o de sección `rules` (`isMandatory`); `:87` (`pickRules`) y `:142` (`loadAgentRules`) el agente solo lee documentos de equipo vinculantes; `:143` la consulta trae sección `rules` **o** `mandatory = true` de cualquier sección; `Rule` (`:71`) solo conserva `titulo` y `texto`; `rulesBlock` (`:119`) los entrega al modelo como datos en `reglas_obligatorias`. No hay noción de tipo de regla.
- `src/lib/knowledge-rules.ts:30` (`BINDING_WRITERS = owner, sales_leader`) y `:43` (`canEditDoc`): solo esos roles escriben documentos vinculantes. La base de datos lo repite en la migración `0081_knowledge_binding_writers.sql`, que `docs/BASE-DE-DATOS.md:45` dice **no aplicada a la base real**. **[Por verificar]**
- `src/lib/screen-sections.ts:4-13`: `HUB_SECTIONS` = company, objections, playbooks, methodology, campaigns, skills, rules, drive. No existe «voz».
- `src/lib/playbooks/library-core.ts:20` (`createLibraryCore`) y `src/lib/playbooks.functions.ts`: precedente de una acción explícita, solo de Owner y Sales Leader, que inserta lo que falta en `knowledge_docs` sin duplicar por título. Se reutiliza el patrón para las reglas por defecto.
- NK-0095: «cualquier miembro puede escribir en Conocimiento» salvo lo vinculante; un documento de sección «voz» no es vinculante y hoy lo escribiría cualquier miembro (RLS de `0002_multitenant_organizations.sql:128`). Borrar es solo del Owner (`0002:130`; pantalla `hub-screen.tsx:210`, `canDelete`).
- `0081_knowledge_binding_writers.sql:12-29`: función `knowledge_doc_is_binding(section, scope, mandatory)` y dos políticas **restrictivas** `to authenticated`, solo de `insert` y `update`, con `has_org_role(org_id, 'owner' | 'sales_leader')`; no usan `current_org()`. El cliente de servicio salta la RLS y el código repite la regla.
- `src/components/hub/doc-editor.tsx:35`: `canMark` deja a un líder marcar «obligatorio» en cualquier sección, también en una de voz.
- Ni la importación de Drive (`src/lib/agent/tools/drive.ts:99-105`, `checkImportAllowed`) ni ninguna herramienta del agente escriben hoy en una sección `voice`.
- La decisión 22 del PRD pone la voz en Conocimiento, solo equipo; la 23, «Escalar» como tipo de Regla; la 24, reglas por defecto redactadas por Claude y aprobadas por Fede.
- Sin datos de uso: líneas base «sin dato».

**Por qué ahora:** el diagnóstico (SDD 4 de la iniciativa) captura voz y reglas; sin este SDD no tendría dónde guardarlas ni cómo leerlas.

## 4. Resultado buscado
Referencia al PRD:
- G-4: empresas con reglas base aprobadas. Línea base: sin dato. Fuente: `knowledge_docs` (sección `rules`).
- G-5: este SDD mide solo empresas con tres mensajes de voz (`knowledge_docs`, sección `voice`). Línea base: sin dato. La parte «borradores que la leen» no se puede medir aquí (`play_runs` solo guarda ids); queda para el SDD 4, que registrará el contexto usado.

## 5. Alcance
**Incluye:**
- Sección `voice` en Conocimiento (documentos de equipo, no vinculantes) con aviso de privacidad.
- Crear y editar en la sección `voice` limitado a Owner y Sales Leader, en pantalla y en base de datos; borrar sigue siendo solo del Owner (sin cambios).
- Lector `loadVoice` que entrega hasta tres ejemplos al agente y a los textos que redactan.
- Tipo de regla «Escalar»: convención de título más lectura aparte en `rulesBlock`.
- `defaultRules()` y la acción «Añadir reglas base» de Owner y Sales Leader, sin duplicar por título.
- Texto de las reglas por defecto para aprobación (§9).

**No incluye:** (es el límite que el brief copia a «Movimientos prohibidos»)
- El diagnóstico en chat o asistente guiado (SDD 4 y 5 de la iniciativa).
- Inferir la voz desde correos o publicaciones.
- Mostrar la voz fuera del equipo ni exportarla.
- Cambiar la columna `mandatory`, el esquema de `knowledge_docs` o las Reglas existentes.
- Aplicar reglas por defecto de forma automática o a empresas existentes sin acción de un líder.
- Pantallas nuevas.

## 6. Cambios de comportamiento (delta)
**Añadido:** sección Voz; lector de voz; regla «Escalar»; reglas por defecto y su acción.
**Modificado:** `HUB_SECTIONS` incluye `voice`; `pickRules` marca las reglas «Escalar» y `rulesBlock` las entrega aparte; `canEditDoc` incluye `voice` entre lo que escriben solo Owner y Sales Leader; el editor no ofrece «obligatorio» en `voice`.
**Eliminado:** nada.

## 7. Historias y criterios de aceptación
### H-1: Como Owner o Sales Leader, quiero guardar tres mensajes reales de mi empresa para que los borradores suenen como nosotros.
- **CA-1** La sección «Voz» existe en Conocimiento y guarda documentos de equipo. Un documento de voz nunca es obligatorio: el editor no ofrece la casilla en `voice`, la base de datos rechaza `section = 'voice'` con `mandatory = true` y un filtro propio en `pickRules` y en la consulta de `loadAgentRules` excluye `voice` aunque llegue marcado. `isMandatory` e `isBindingDoc` **no** cambian, para seguir alineados con `knowledge_doc_is_binding` (0081) y con la tabla compartida `src/test/knowledge-binding-cases.ts`. BMAD (`knowledgeForAgents`, `:54`) queda fuera: la base de datos ya impide que una voz se marque obligatoria · cubre G-5 · prueba: `src/lib/knowledge-rules.test.ts` y `src/lib/knowledge-voice.pg.test.ts`
- **CA-2** Solo Owner y Sales Leader crean o editan documentos de `voice`; el resto los ve de solo lectura con el motivo en palabras; borrar sigue siendo solo del Owner, como en el resto de Conocimiento · cubre G-5 · prueba: `src/components/hub/hub-screen.test.tsx` y `src/lib/knowledge-rules.test.ts`
- **CA-3** La base de datos aplica CA-1 y CA-2 con dos políticas restrictivas nuevas (`insert` y `update`, `to authenticated`) sobre `section = 'voice'` con `has_org_role(org_id, 'owner' | 'sales_leader')`, sin tocar `knowledge_doc_is_binding`. Drive y las herramientas del agente no admiten `voice` como sección destino (guarda de regresión: las listas cerradas de `agent/tools/drive.ts:6`, `drive.functions.ts:8` y `background.functions.ts:49` ya la rechazan) · cubre G-5 · prueba: `src/lib/knowledge-voice.pg.test.ts` (arnés de `src/lib/knowledge-binding.pg.test.ts`) y `src/lib/agent-tools.test.ts`
- **CA-4** `loadVoice` devuelve como máximo tres ejemplos de la empresa (`orgId` del contexto de confianza), filtrados por `org_id` y `scope = 'team'` en la consulta y otra vez en memoria, y excluye `mandatory = true`; funciona con el cliente de usuario y con el de servicio; un fallo de lectura se informa y no se interpreta como «sin voz» · cubre G-5 · prueba: `src/lib/knowledge-voice.test.ts`
- **CA-5** Los textos que redactan el agente (`draft_followup`, `prepare_meeting_brief`) y las generaciones de `ai-core` reciben la voz como datos de apoyo, nunca como instrucción de sistema, y el prompt dice que copie la forma, no el contenido · cubre G-5 · prueba: `src/lib/ai-core-rules.test.ts` y `src/lib/agent-tools.test.ts`
- **CA-6** Los logs y errores nunca incluyen el texto de un ejemplo de voz (errores con `safeErrorLog`); las evidencias se revisan a mano en el gate · cubre G-5 · prueba: `src/lib/knowledge-voice.test.ts`
- **CA-6b** `search_knowledge` (`src/lib/agent/tools/core-read.ts:576-596`) no devuelve documentos de `voice`, para que la voz no salga por el agente ni por MCP a asistentes externos; el agente la recibe solo vía `loadVoice` · cubre G-5 · prueba: `src/lib/agent-tools.test.ts`
- **CA-6c** Cada ejemplo se corta a `VOICE_MAX_CHARS` (constante; el valor lo fija el brief, no es cifra de negocio) y, si se corta, el texto lo dice · cubre G-5 · prueba: `src/lib/knowledge-voice.test.ts`

### H-2: Como Owner o Sales Leader, quiero reglas «Escalar» para que el agente pare y pregunte a una persona en los casos que decido.
- **CA-7** `pickRules` marca como regla de escalado (`Rule.escalar = true`) un documento de equipo **de la sección `rules`** cuyo título empieza por «Escalar» (sin distinguir mayúsculas ni espacios iniciales); un documento obligatorio de otra sección con ese título sigue siendo regla normal · cubre G-4 · prueba: `src/lib/knowledge-rules.test.ts`
- **CA-8** `rulesBlock` entrega las reglas de escalado en una lista aparte con esta instrucción: con una persona delante, «no sigas: dilo y pide que lo decida una persona»; en trabajos sin persona, «no lo resuelvas: empieza el resultado con la línea "Necesita a una persona: <condición>"». `rulesBlock(rules, { withPerson })` recibe el modo del llamador: con persona, `runAgent` (app y Telegram), MCP y las generaciones de `ai-core` lanzadas desde una pantalla; sin persona, `library-core` y los trabajos en segundo plano (`job-runner`). No hay esquema nuevo de «pendiente». La prueba solo comprueba el texto del bloque en cada modo y qué modo pasa cada llamador · cubre G-4 · prueba: `src/lib/knowledge-rules.test.ts` y `src/lib/ai-core-rules.test.ts`
- **CA-9** Las reglas de escalado cuentan dentro de `AGENT_RULE_LIMITS` (12 reglas, 12.000 caracteres en total, `knowledge-rules.ts:75`) y el aviso de reglas truncadas sigue funcionando; los límites de BMAD no cambian · cubre G-4 · prueba: `src/lib/knowledge-rules.test.ts`

### H-3: Como Owner o Sales Leader, quiero añadir reglas base seguras con una acción para no empezar de cero.
- **CA-10** `defaultRules()` devuelve exactamente las reglas del §9 (tres Nunca, tres Siempre, tres Escalar) en español, «tú», sin nombres ni datos de clientes · cubre G-4 · prueba: `src/lib/default-rules.test.ts`
- **CA-11** La acción «Añadir reglas base» solo la ejecutan Owner y Sales Leader, compara títulos solo dentro de la sección `rules` de la empresa activa, inserta las que faltan y puede repetirse sin duplicar. Si la lectura previa falla, no inserta nada y avisa (no copia el fallo de `createLibraryCore`, que trata una lectura fallida como «nada existe», `library-core.ts:24-27`) · cubre G-4 · prueba: `src/lib/default-rules.test.ts`
- **CA-12** (guarda de regresión, no fail-first: hoy ya es cierto) Ninguna regla por defecto se crea sin esa acción: abrir Conocimiento no inserta nada y `create_organization` no se cambia · cubre G-4 · prueba: `src/lib/default-rules.test.ts`

## 8. Casos límite y errores
- **Otra empresa:** `loadVoice` y la acción filtran por `org_id`; un ejemplo de otra empresa nunca llega (CA-4, CA-11).
- **Menos de tres ejemplos:** se usan los que haya; con cero, los borradores siguen como hoy.
- **Más de tres:** se leen los tres más recientes (decidido por delegación de Fede).
- **Ejemplo muy largo:** se corta a `VOICE_MAX_CHARS` y se avisa (CA-6c).
- **Título «Escalar» escrito distinto** («escalar», espacios): se compara sin distinguir mayúsculas y sin espacios iniciales (CA-7).
- **Fallo de lectura:** se avisa «No he podido leer la voz» y el borrador sale sin ella, nunca como si no existiera (CA-4).
- **Miembro sin rol cargado:** no escribe, como en `canEditDoc` (CA-2).
- **Migración 0081 sin aplicar:** la protección de base de datos de CA-3 depende de ella (§14).

## 9. Experiencia y copy
Textos propuestos; Fede los aprueba.
- Sección: «Voz». Pista: «Pega tres mensajes reales que hayáis escrito y que representen cómo habláis. Quita nombres y datos de personas antes de pegar.»
- Solo lectura: «Solo el Owner o un Sales Leader pueden escribir la voz de la empresa. Pídeselo a uno de ellos.»
- Botón: «Añadir reglas base». Resultado: «Se han añadido N reglas base. Revísalas y edítalas.»; si ya estaban: «Ya tenías todas las reglas base.»
- Error de voz: «No he podido leer la voz de tu empresa. Este borrador no la usa; reinténtalo.»

**Reglas por defecto** (aprobadas por delegación de Fede el 2026-11-10; CA-10 exige estos textos literales; el contenido es revisión humana, no automática; título de cada documento en negrita):
- **Nunca enviar ni publicar:** nunca envíes, publiques ni cambies datos sin que una persona lo confirme; todo sale como borrador o sugerencia.
- **Nunca inventar:** nunca inventes cifras, testimonios, nombres ni fechas; si falta un dato, dilo.
- **Nunca exponer datos de clientes:** nunca pegues textos, correos ni nombres de clientes en ejemplos, borradores ni resúmenes que vaya a leer otra persona.
- **Siempre solo datos de la empresa:** usa solo lo que está en la empresa; si no está escrito, pregunta.
- **Siempre fuente y fecha:** cita de dónde sale cada dato y cuándo se publicó.
- **Siempre voz de la empresa:** redacta con la voz guardada y, ante la duda, más corto.
- **Escalar cuando haya precio, descuento o condiciones:** si el texto necesita una cifra o condición que no está escrita, para y pregunta a una persona.
- **Escalar ante una queja, un asunto legal o una baja:** si el contacto reclama, menciona un asunto legal o pide que no le escribas más, para y pasa el caso a una persona.
- **Escalar cuando falte el ICP:** si no puedes saber si la cuenta encaja, para y pide a una persona que decida.

## 10. Datos, permisos y privacidad
- **Sin columnas nuevas.** La voz es un documento de `knowledge_docs` con `section = 'voice'` y `scope = 'team'`. Una migración añade dos políticas **restrictivas** (`insert` y `update`, `to authenticated`), como las de la 0081: pasan si `section <> 'voice'`, o si la persona es `owner` o `sales_leader` (`has_org_role(org_id, …)`) y `mandatory` no es `true`. No amplía `knowledge_doc_is_binding`, que cambiaría lo que significa «vinculante». Borrar sigue siendo del Owner (0002). Los GRANTs ya existen.
- Los documentos de equipo los ve todo miembro de la empresa (RLS actual): la voz queda visible para todo el equipo; el aviso de pegado pide quitar datos de personas.
- Un documento personal nunca llega al agente (`knowledge-rules.ts:26`, `:87`, `:142`); la voz es siempre de equipo.
- Ningún ejemplo real en código, pruebas, fixtures, logs ni evidencias: los tests usan ejemplos ficticios.
- La migración se aplica y verifica como indica `docs/sdd/EXECUTION.md`; no se toca la base real desde este SDD.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| Ninguna nueva. La voz se añade como contexto a las llamadas que ya existen (`draft_followup`, `prepare_meeting_brief`, generaciones de `ai-core`) | regla → caché → modelo barato; sin cambios | Sin cambios | Sin dato; el contexto añadido aumenta los tokens de entrada **[Por verificar]** |

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | Sección `voice`, `canEditDoc` para `voice`, sin casilla «obligatorio» en `voice`, exclusión en `pickRules`/`loadAgentRules`, aviso en `hub-screen` | CA-1, CA-2 | `src/lib/knowledge-rules.test.ts` y `src/components/hub/hub-screen.test.tsx` |
| U-2 | Migración con dos políticas restrictivas para `voice`; Drive y agente no admiten `voice` | CA-1, CA-3 | `src/lib/knowledge-voice.pg.test.ts` |
| U-3 | `loadVoice`, corte por ejemplo, exclusión en `search_knowledge` y entrega a `draft_followup`, `prepare_meeting_brief` y `ai-core` | CA-4, CA-5, CA-6, CA-6b, CA-6c | `src/lib/knowledge-voice.test.ts`, `src/lib/ai-core-rules.test.ts`, `src/lib/agent-tools.test.ts` |
| U-4 | Tipo «Escalar» en `knowledge-rules.ts` y `rulesBlock` | CA-7, CA-8, CA-9 | `src/lib/knowledge-rules.test.ts` |
| U-5 | `defaultRules()` y acción «Añadir reglas base» (patrón de `createLibraryCore`, sin su lectura sin error) | CA-10, CA-11, CA-12 | `src/lib/default-rules.test.ts` |

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- **Escalar como convención de título** (sin migración): alternativa descartada, una columna `kind` en `knowledge_docs`, porque exige migración y cambiar las políticas; si el gate ve fallos por títulos mal escritos, reconsiderarla. BMAD (`bmad/drafting.ts:21`) no pasa por `rulesBlock`: allí una regla «Escalar» sigue siendo regla normal (aceptado; Ciclo GTM se retira con GTM Lab).
- Reutiliza `isBindingDoc`/`BINDING_WRITERS`; añade `voice` en una lista `WRITER_ONLY_SECTIONS` junto a `rules`.
- `loadVoice` imita a `loadAgentRules`: filtra por empresa y alcance en consulta y en memoria, informa del fallo y no registra texto.
- Pantalla: la sección entra en `HUB_SECTIONS` y en `sectionOf`; no hay ruta nueva.
- Tras tocar herramientas del agente: `node node_modules/@lovable.dev/mcp-js/dist/cli/extract-manifest.cjs .` y `TITLES`.

## 14. Riesgos y dependencias
- **Voz visible a todo el equipo:** son mensajes reales; mitigación en el aviso, pero el riesgo existe (decisión abierta 2 del PRD, pregunta 1 de §15).
- **0081 sin aplicar:** hasta que se aplique en la base real, un miembro que no sea líder podría escribir reglas y, con la migración de esta SDD, también voz escribiendo directo. NK-0096 «no es efectivo» según el SDD de NK-0095. Hay que ordenar la aplicación de ambas migraciones.
- **Convención de título:** una regla «Escalar» con un título distinto se lee como regla obligatoria normal; sigue protegiendo, pero sin el aviso de parada.
- **Contexto más largo:** más tokens en cada redacción; sin dato de coste.
- **Reglas por defecto que se vuelven obsoletas:** versión única; se edita a mano.
- Coordina con el SDD 4 de la iniciativa, que usará `defaultRules()` y `loadVoice`.

## 15. Preguntas para Fede y para la revisión técnica
Resueltas por delegación de Fede («ejecuta todo vos», 2026-11-10):
1. Lectura de la voz: todo el equipo (decisión 22 del PRD); el aviso pide quitar datos de personas.
2. Reglas por defecto: los nueve textos del §9.
3. Migración 0081: debe aplicarse antes o junto con la de este SDD; se registra como requisito de entrega.
4. «Escalar»: convención de título dentro de la sección `rules`.

## 16. Pendiente de verificar
- Estado real de la migración 0081 en la base viva (producción o Lovable Cloud).
- Coste de añadir la voz al contexto de las llamadas de IA.
- Valor de `VOICE_MAX_CHARS` (lo fija el brief).

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
### Primera pasada (2026-11-10, informe del gate copiado sin editar)
**Veredicto: hay objeciones.** Encontré 4 contradicciones de fondo con el código: el borrado de la voz por el Sales Leader, el doc marcado `mandatory` en Voz, el límite de CA-9 y el patrón de la 0081 mal descrito. Hay que corregirlas antes de aprobar el SDD.

**CA sin prueba posible o sin G-n**
- Todos los CA tienen G-n.
- **CA-13**, segunda mitad («ninguna regla base permite lo contrario de la salida solo-borrador»): es un juicio semántico. Un test automático solo puede buscar palabras clave. Mejor cambiarlo por una comprobación de textos fijos o por una revisión humana declarada.
- **CA-3:** el archivo de prueba debería seguir la convención `.pg.test.ts` con el arnés de `src/lib/knowledge-binding.pg.test.ts`. El nombre `knowledge-voice-rls.test.ts` no indica que corra contra Postgres. La parte «el código con cliente de servicio también lo comprueba» no tiene escritor que probar: ni Drive (`src/lib/drive.functions.ts:15`, `src/lib/agent/tools/drive.ts:7`) ni ninguna herramienta del agente escriben en `voice`. O se dice explícitamente que esos caminos no admiten `voice`, o la prueba no existe.
- **CA-2 y CA-3:** «Sales Leader borra» no se puede probar en verde (ver contradicciones).

**[Por verificar] que sigue sin comprobarse**
- Si la 0081 está aplicada en una base viva. No consulté la base. `docs/BASE-DE-DATOS.md:45` y la cabecera de `docs/sdd/SDD-20261109-rules-write-permissions.md` (línea 4) dicen que no.
- Los commits `aa368b62`/`d3eeba1`: el directorio no es un repo git, así que no pude comprobarlos.
- Coste en tokens de la voz, orden de los ejemplos (más recientes o manual) y límite de corte por ejemplo: siguen abiertos.
- El contenido de la 0081 ya lo comprobé (abajo), así que ese [Por verificar] de §10/§16 queda cerrado.

**Contradicciones con el código o con decisiones previas**
1. **§3 «`knowledge-rules.ts:56` el agente solo lee docs de equipo»:** es inexacto. La línea 56 es el filtro `company` de `knowledgeForAgents`. El filtro de equipo del agente está en `:87` (`pickRules`) y en `:142` (`loadAgentRules`). El resto de §3 es correcto: `:18`, `:30`, `:43`, `:119`, `screen-sections.ts:4-13`, `library-core.ts:20`, `playbooks.functions.ts:11` (comprobación de rol), `0002:128` (insert permisivo) y `BASE-DE-DATOS.md:45`.
2. **§10 «con `org_id` por `current_org()`, siguiendo el patrón de la 0081»:** falso. La 0081 añade dos políticas RESTRICTIVE, solo para `insert` y `update`, `to authenticated`. Usan la función `knowledge_doc_is_binding(section, scope, mandatory)` y `has_org_role(org_id,'owner'|'sales_leader')`, sin `current_org()` (`0081:12-29`). Para `voice` lo fiel sería una función o condición propia, no ampliar `knowledge_doc_is_binding`, que cambiaría lo que significa «vinculante». Y dos políticas restrictivas de insert/update.
3. **CA-2 «Owner y Sales Leader … borran»:** el borrado es solo del Owner, en la base (`0002:130`, «org delete owner») y en la pantalla (`hub-screen.tsx:210`, `canDelete`). Una política restrictiva no puede dar permisos, así que el Sales Leader nunca podrá borrar voz sin tocar la 0002. Eso sale del alcance.
4. **CA-1 «no llegan como obligatorias»:** un líder puede marcar `mandatory` en un doc de Voz (`doc-editor.tsx:35`, `canMark`). En ese caso `isMandatory` (`:18`) y `loadAgentRules` (`:143`, `or section.eq.rules,mandatory.eq.true`) lo leen como regla. El SDD no dice si se oculta el marcador en `voice` o se excluye en el lector.
5. **CA-9:** mezcla dos límites distintos. `MANDATORY_LIMIT` y los 4000 caracteres por regla son de BMAD (`knowledgeForAgents`, `:51-59`, sin total). `rulesBlock` recibe lo que corta `AGENT_RULE_LIMITS` (12 reglas, 12.000 caracteres en total, `:75`). Hay que elegir uno de los dos.
6. **«Escalar» en `rulesBlock`:** se puede hacer, porque `Rule` conserva `titulo` y `pickRules` nunca corta el título. Pero hay tres huecos:
   - `Rule` no lleva `section`, así que CA-7 («documento de Reglas») no se distingue de un doc obligatorio de otra sección que se titule «Escalar…».
   - BMAD (`bmad/drafting.ts:21`) no pasa por `rulesBlock`: allí la regla «Escalar» seguiría como regla normal.
   - `rulesBlock` también alimenta trabajos sin persona delante (`library-core.ts:39`, `ai-core.ts:37`) y MCP (`mcp/tools/rules.ts:17`). En esos casos «para y pregunta» no tiene comportamiento definido.
7. **Patrón de `createLibraryCore` para las reglas base:** no comprueba el `error` de la lectura (`library-core.ts:24-27`). Si la lectura falla, cuenta como «nada existe» e insertaría duplicados, justo lo que CA-11 prohíbe. Además deduplica por título en todas las secciones (`adapt.ts:9`). El SDD debe decir que eso no se copia.
8. **`loadVoice` con cliente de servicio:** sí puede imitar a `loadAgentRules`: filtro por `org_id` y `scope='team'` en la consulta y otra vez en memoria (`:141-151`). No rompe RLS ni amplía quién lee, porque la voz ya es visible para todo el equipo (`0002:127`). Riesgos:
   - El `orgId` tiene que salir del contexto de confianza.
   - Para no registrar texto, conviene `safeErrorLog` (`library-core.ts:58`) en lugar de `error.message`.
   - Si sigue la consulta de `loadAgentRules`, debe excluir `mandatory=true` (punto 4).

**Lo que esta revisión NO demuestra**
- Revisé solo el documento, sin diff de código. No ejecuté `gate.mjs` ni `flake.mjs` (no hay nada que ejecutar), ni tests, ni segunda máquina, ni soak.
- No consulté la base viva (estado de la 0081 y de las políticas reales) ni el historial git.
- No valido el contenido ni el tono de las nueve reglas del §9: lo decide Fede.
- No mido el coste de tokens. No compruebo que el arnés `.pg` admita la política nueva sin cambios.

### Cambios tras la primera pasada (autor)
§3 con las líneas correctas y lo que hace la 0081; borrar sigue siendo solo del Owner; un documento de voz nunca es obligatorio (editor, base de datos y lector); CA-3 en `knowledge-voice.pg.test.ts` con el arnés de `knowledge-binding.pg.test.ts` y sin escritor de servicio (Drive y agente no admiten `voice`); dos políticas restrictivas propias sin tocar `knowledge_doc_is_binding`; CA-9 sobre `AGENT_RULE_LIMITS`; «Escalar» solo en la sección `rules`, marcado en `pickRules`, con comportamiento definido para trabajos sin persona y BMAD fuera de alcance; reglas base sin la lectura sin error de `createLibraryCore` y deduplicando solo en `rules`; CA-13 eliminado (textos fijos en CA-10 y revisión humana); `loadVoice` con `orgId` de confianza, exclusión de `mandatory` y `safeErrorLog`.

### Segunda pasada (2026-11-10, informe del gate copiado sin editar)
**Veredicto: hay objeciones.** Los 8 puntos de fondo de la primera pasada están resueltos en §3-§16, salvo dos citas residuales. Han aparecido 5 problemas nuevos que conviene cerrar antes de aprobar.

**Objeciones de la primera pasada que siguen abiertas**
- Punto 1, solo en parte. §10 (l.111) sigue citando `knowledge-rules.ts:56` para «un documento personal nunca llega al agente». La línea 56 es el filtro `company` de BMAD; el filtro de equipo está en `:26` (`isBindingDoc`), `:87` y `:142`. Hay dos citas más desplazadas: CA-9 (l.73) pone `:73` donde `AGENT_RULE_LIMITS` está en `:75`, y §3 (l.21) pone `Rule` en `:70` cuando está en `:71`.

**Problemas nuevos**
1. **Dónde se excluye `voice` de las reglas (CA-1, l.63).** El SDD no dice en qué función se hace. Si se hace en `isMandatory` (`:18`), también cambia `isBindingDoc` y deja de coincidir con `knowledge_doc_is_binding` de la 0081. La tabla de casos compartida `src/test/knowledge-binding-cases.ts`, que pasan `knowledge-rules.test.ts` y `knowledge-binding.pg.test.ts:177`, se separaría. Además `knowledgeForAgents` (BMAD, `:54`) seguiría leyendo una voz marcada como obligatoria si se cuela por el cliente de servicio. Hay que fijarlo: un filtro en `pickRules` + `loadAgentRules`, y BMAD declarado.
2. **CA-8 (l.72) no define cómo se elige el modo.** No dice qué firma toma `rulesBlock` ni qué llamador usa el modo «sin persona». `ai-core` lo llaman tanto pantallas con una persona delante como el autopilot sin ella. MCP (`mcp/tools/rules.ts:17`) lo usa un asistente que maneja una persona, así que clasificarlo como «sin persona» es discutible. «Marcado como pendiente de una persona» no tiene soporte en el esquema: `library-core.ts:61` inserta directamente. El test solo podrá comprobar el texto del prompt.
3. **La voz llega por un camino no declarado.** `search_knowledge` (`src/lib/agent/tools/core-read.ts:576-596`) devuelve cualquier documento de equipo, voz incluida, al agente y, a través del registro, a asistentes externos por MCP. Choca con «no incluye: mostrar la voz fuera del equipo» (l.51) y con CA-5. Hay que decir si se excluye o se acepta.
4. **G-5 (l.37) no se puede medir con este SDD.** Usa `play_runs` como fuente, pero esa tabla solo guarda ids y nada en el SDD registra que un borrador leyera la voz.
5. **Dos CA no pueden fallar antes sobre la base (GROUND-RULES regla 5).** CA-12 (l.78): «crear empresa no inserta nada» ya es cierto hoy, y `create_organization` es una función de base de datos (RPC) que un `default-rules.test.ts` unitario no ejercita. CA-3, en la parte de «Drive/agente no admiten `voice`»: las tres listas cerradas de secciones (`agent/tools/drive.ts:6`, `drive.functions.ts:8`, `background.functions.ts:49`) ya la rechazan. Esas partes son guardas de regresión y el SDD debería decirlo.

**CA sin prueba posible o sin G-n**
- Todos los CA tienen G-n.
- CA-6, la parte de «evidencias»: no se puede automatizar.
- CA-10: el texto se fija con una comparación literal, pero su contenido depende de una aprobación «por delegación» (l.97). No consta un OK explícito de Fede a los nueve textos.
- Límite de corte por ejemplo (§8, l.84): ningún CA lo cubre.

**[Por verificar] abiertos**
- Si la 0081 está aplicada en la base viva. `docs/BASE-DE-DATOS.md:45` y la cabecera del SDD de NK-0095 dicen que no.
- Los commits `aa368b62`/`d3eeba1`: el directorio no es un repo git.
- Orden y número de ejemplos de voz, y límite de corte.
- Coste en tokens.

**Lo que esta revisión NO demuestra**
- Solo revisé el documento y el código citado. No ejecuté `gate.mjs` ni `flake.mjs`, porque no hay diff. No ejecuté tests, segunda máquina ni soak.
- No consulté la base viva ni el SQL de `create_organization`.
- No he validado que el arnés `.pg` admita la nueva migración junto a la 0081, ni el tono o la idoneidad de las nueve reglas.

### Cambios tras la segunda pasada (autor)
Citas corregidas (`:26`/`:87`/`:142`, `:75`, `:71`); la exclusión de `voice` va en un filtro propio de `pickRules` y `loadAgentRules`, sin tocar `isMandatory`/`isBindingDoc`, y BMAD queda declarado; `rulesBlock(rules, { withPerson })` con el modo de cada llamador y sin esquema de «pendiente»; CA-6b excluye `voice` de `search_knowledge`; G-5 se limita a empresas con voz y la parte de lectura pasa al SDD 4; CA-12 y la parte de Drive de CA-3 declaradas guardas de regresión; CA-6c fija el corte por ejemplo; evidencias revisadas a mano. No se ha hecho una tercera pasada.

### Delegación
Fede, en el chat del 2026-11-10: «si ejecuta todo vos». Es la base de las decisiones del §15, de los textos del §9 y de la aprobación de este SDD. Fede puede cambiar cualquiera de ellos antes del GO.

## 18. Delta de implementación (lo rellena el agente al entregar)
—
