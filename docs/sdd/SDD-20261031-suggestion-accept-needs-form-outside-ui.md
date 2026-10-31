# SDD-20261031-suggestion-accept-needs-form-outside-ui · [Bug] Aceptar una prueba o acción comercial fuera de la app la cierra sin crear nada

**Tipo:** Bug · **Prioridad propuesta:** Media (el hueco existe en `main`, pero hoy no ha afectado a nadie: ver sección 3)
**Estado:** Borrador · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-11-01 (redactado el 2026-10-31)
**PRD:** No aplica (bug) · **Depende de:** — · **Tickets:** NK-0041 y la parte evitable del segundo síntoma de NK-0040 (el NK-0040 ya entregado cubre solo el formulario del cliente). La recuperación de una sugerencia ya aceptada queda fuera: NK-0043. La visibilidad de las sugerencias de precio queda fuera: NK-0042.
**SDD que corrige:** F3 de `SDD-20261027-strategic-suggestions-engine` (CA-35 y CA-36); sigue a `SDD-20261031-board-accept-opens-execute-form`.

> Un SDD dice cómo se verifica que está bien hecho. Cada criterio de aceptación (CA-n) debe poder tener una prueba automática que lo nombre.
> Nivel elegido: SDD corto, sin PRD. Cambia el contrato de una función del servidor que usan Telegram, el agente y el MCP, pero no toca esquema, RLS ni datos nuevos.

## 1. Resumen
Una sugerencia estratégica de tipo prueba (`experiment`) o acción comercial (`commercial_action`) debe crear un experimento o una tarea cuando se acepta, con un formulario que la persona revisa (CA-35, CA-36). La app ya lo hace en la tarjeta, el tablero y la lista. Pero `decideSuggestionCore` acepta la decisión sin borrador cuando la llaman Telegram, el agente o el MCP: la sugerencia queda aceptada y no se crea nada. Además valida el borrador después de registrar la decisión. Este SDD hace que esos canales rechacen la aceptación y remitan a la app, y que un borrador inválido no llegue a registrar la decisión. Sin migración.

## 2. Problema y para quién
Quien acepta una de esas sugerencias desde Telegram («Hecho»), desde el asistente o desde una acción confirmada del MCP la cierra sin que se cree el experimento ni la tarea, y no vuelve a verla.

## 3. Evidencia y por qué ahora
Leído el 2026-10-31 y revisado el 2026-11-01 sobre `origin/main` (`6976fa8`); no reproducido en la aplicación **[Por verificar]**.
- `src/lib/agent.functions.ts:265-297`: `decideSuggestionCore`, para sugerencias `strategy_*`, llama a `decideStrategy` (registra la decisión con la RPC `decide_strategy_suggestion`) y solo después, con `execute`, crea el experimento o la tarea. Sin `execute`, `proposeChange` no hace nada para esos dos tipos y la respuesta es de éxito.
- Llamadores de `decideSuggestionCore` sin borrador (informe del gate): Telegram, botón `s:<id>:approve` (`src/routes/api/public/telegram/webhook.ts:59-61`); herramienta del agente `decide_suggestion` (`src/lib/agent/tools/inbox.ts:22-32`); y `decidePending` (`src/lib/agent.functions.ts:113-157`), que confirma acciones pendientes del agente y del MCP (`src/lib/mcp/tools/agent-tools.ts:128-150` solo las encola) y escribe «Hecho: … {mensaje}».
- Telegram ofrece el botón de aceptar sin filtrar por detector: aviso urgente de prioridad 1 y resumen diario (`src/routes/api/public/jobs/proactive.ts:104-116` y `133-140`; el aviso usa «Hecho» o «Aprobar y hacer» y el resumen «Hecho n» y «Posponer n», sin descartar). Sus `select` (líneas 111, 113 y 133) no traen `strategy`. `reviewDue` (`src/lib/experiments.ts:47-49`) genera una sugerencia de prioridad 1 y tipo `commercial_action`.
- `src/lib/strategy-execute-core.ts` (`createExperimentFromSuggestion`, líneas ~118 y ~127; `createTaskFromSuggestion`): validan el borrador **después** de que la decisión ya está registrada.
- `src/lib/strategy-execute.ts:126`: `experimentDraftIssues` exige título, hipótesis, métrica y fecha de revisión.
- `agent.functions.ts:257`: `execute` entra sin validar forma ni tipo; el servidor no comprueba que `execute.kind` coincida con el `action_type` de la sugerencia.
- **Medido el 2026-11-01 en la base de Lovable Cloud** (solo lectura, por el conector de Lovable): 0 sugerencias de esos dos tipos aceptadas; 0 con ese tipo. En toda la base hay 3 sugerencias estratégicas, las tres pendientes y de tipo `data_to_complete`. **El hueco no ha afectado a nadie todavía.**
- **Hallazgo aparte, medido el mismo día:** en esa base las migraciones 0068 y 0070 están aplicadas, pero **0072 (`strategy_reviews`) no existe y 0073 (disparador de `suggestions`) tampoco**: `suggestions` no tiene ningún disparador. Este SDD no depende de 0073.

## 4. Resultado buscado
- Aceptar una prueba o acción comercial solo se completa si se crea el experimento o la tarea (desde la app) o se rechaza y se remite a la app (desde los demás canales), y un borrador inválido no registra ninguna decisión.
- Medición: las pruebas de CA-1 a CA-7 pasan en `main`. Línea base de sugerencias afectadas: 0 (sección 3).

## 5. Alcance
**Incluye:** `decideSuggestionCore` y su orden de validación; los avisos de Telegram (aviso urgente y resumen) para esos dos tipos; el texto de la herramienta `decide_suggestion` del agente.
**No incluye** (límite que el brief copia a «Movimientos prohibidos»):
- Migraciones, RLS, `drizzle/`; una función SQL transaccional que decida y cree en un solo paso (descartada, ver 13).
- Recuperar una sugerencia ya aceptada sin experimento ni tarea (NK-0043; hoy hay 0 casos).
- Aplicar la visibilidad de las sugerencias de precio (NK-0042).
- Cambiar `ExecuteDialog`, el tablero, la tarjeta o la baraja.
- Crear experimentos o tareas desde Telegram, el agente o el MCP con un borrador por defecto (descartado, ver 13).
- Cambiar el aviso del cliente, que sigue comparando el texto «Ya estaba gestionada» (límite conocido de NK-0040).
- Sugerencias de otros tipos (cambio de estrategia, datos a completar, operativas).

## 6. Cambios de comportamiento (delta)
**Añadido:** rechazo explicado de `approve` sin borrador para esos dos tipos, devuelto como error; validación de forma, tipo y reglas del borrador antes de registrar la decisión; botones de Telegram distintos para esos dos tipos.
**Modificado:** el borrador se valida antes de registrar la decisión; antes se registraba y luego se validaba.
**Eliminado:** el botón de aceptar en los avisos de Telegram para esos dos tipos.

## 7. Historias y criterios de aceptación
### H-1: Como miembro o líder, quiero que Telegram, el asistente y el MCP no cierren una prueba o acción comercial sin crearla, para no perder una sugerencia por error.
- **CA-1** CUANDO `decideSuggestionCore` recibe `approve` sin borrador sobre una sugerencia estratégica de tipo `experiment` o `commercial_action` aún pendiente, el sistema DEBE lanzar un error con el motivo (ver 9), NO DEBE registrar la decisión ni cambiar su estado; y los llamadores (Telegram, el agente y la confirmación de acciones) DEBEN mostrarlo como «No se ha podido hacer», no como «Hecho» · prueba: `src/lib/decide-suggestion.test.ts` *(ampliar; uno por tipo; incluir el camino de `decidePending`)*
- **CA-2** El sistema DEBE seguir aplazando y descartando esas sugerencias sin borrador, como hoy · prueba: `src/lib/decide-suggestion.test.ts` *(guarda de regresión, no falla primero)*
- **CA-3** El sistema DEBE seguir aceptando con borrador válido (el camino del formulario) y aceptando sin borrador las sugerencias de otros tipos, como hoy · prueba: `src/lib/decide-suggestion.test.ts` *(la de «otros tipos» ya existe; la de «con borrador» pasando por `decideSuggestionCore` es nueva; ambas son guardas, no fallan primero)*
- **CA-4** El aviso urgente y el resumen diario de Telegram NO DEBEN ofrecer el botón de aceptar («Hecho», «Aprobar y hacer», «Hecho n») para esas sugerencias; el aviso urgente DEBE ofrecer solo los de posponer y descartar que ya tiene, y el resumen solo «Posponer n»; el texto DEBE terminar con «Complétala en Sugerencias.»; el resto de sugerencias sigue igual · prueba: *(por nombrar; función pura que construya botones y texto, fuera del archivo de la ruta, probada en `src/lib/proactive.test.ts`; los `select` de `proactive.ts` deben traer `strategy`)*
- **CA-5** La descripción de la herramienta `decide_suggestion` del agente DEBE decir que las pruebas y acciones comerciales se aceptan desde Sugerencias · prueba: `src/lib/agent-tools.test.ts` *(prueba de cadena, débil: lo dice así; `list_suggestions` no devuelve el tipo, así que el agente lo aprende por el rechazo de CA-1)*

### H-2: Como persona que acepta una prueba o acción comercial, quiero que un borrador inválido no deje la sugerencia aceptada, para no perder el trabajo.
- **CA-6** CUANDO se envía `approve` con un borrador que no cumple las reglas del formulario (experimento sin título, hipótesis, métrica o fecha de revisión; tarea sin título), el sistema NO DEBE registrar la decisión y DEBE devolver el motivo · prueba: `src/lib/decide-suggestion.test.ts` *(ampliar; uno por tipo)*
- **CA-7** CUANDO se envía `approve` con un borrador malformado o cuyo `kind` no coincide con el `action_type` de la sugerencia, el sistema NO DEBE registrar la decisión y DEBE devolver un error comprensible · prueba: `src/lib/decide-suggestion.test.ts` *(ampliar)*

## 8. Casos límite y errores
- Dos personas aceptan a la vez: la RPC deja pasar a una; la otra recibe «Ya estaba gestionada» (sin cambios).
- Telegram: botones ya enviados antes del cambio, con «Hecho» sobre una de esas sugerencias, reciben «No se ha podido hacer» con el motivo en vez de cerrarla.
- Confirmación de una acción pendiente (agente, MCP, Telegram `a:`): `decidePending` ya traduce un error en «No se ha podido hacer»; con CA-1 deja de escribir «Hecho».
- Si el insert del experimento o de la tarea falla ya con el borrador válido, la sugerencia queda aceptada sin nada creado, como hoy. Recuperarlo es NK-0043.
- Rol que no puede ver o decidir la sugerencia: sin cambios (`canActOnSuggestion` solo mira la asignación; la visibilidad de las de precio es NK-0042).
- Otra empresa: toda lectura y escritura sigue filtrada por `org_id`.

## 9. Experiencia y copy
Textos en español, «tú», sin iconos, con «qué pasó + qué hacer» (ajustados tras el gate):
- Rechazo (CA-1), experimento: «No la he aceptado. Esta sugerencia crea un experimento y hay que revisarlo antes de aceptarla. Ábrela en Sugerencias, completa el formulario y acéptala allí.»
- Rechazo (CA-1), tarea: «No la he aceptado. Esta sugerencia crea una tarea y hay que revisarla antes de aceptarla. Ábrela en Sugerencias, completa el formulario y acéptala allí.»
- Telegram (CA-4): una línea al final del mensaje: «Complétala en Sugerencias.»

## 10. Datos, permisos y privacidad
Sin tablas ni columnas nuevas, sin cambios de RLS ni GRANTs, sin lecturas nuevas de tablas. La decisión sigue registrándose con quién, cuándo y por qué. Ningún dato de clientes en pruebas: sugerencias ficticias.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| Ninguna | — | — | — |

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | `decideSuggestionCore`: rechazo sin borrador (como error) y validación de forma, tipo y reglas antes de decidir | CA-1, CA-6, CA-7 (CA-2, CA-3 guardas) | `src/lib/decide-suggestion.test.ts` |
| U-2 | Telegram: botones y texto para esos dos tipos (función pura fuera de la ruta); descripción de la herramienta del agente | CA-4, CA-5 | `src/lib/proactive.test.ts` *(por nombrar)* y `src/lib/agent-tools.test.ts` |

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- Un solo sitio decide si una sugerencia es de esos dos tipos: `parseStrategy(s.strategy)?.action_type` (`src/lib/strategy-suggestions.ts`). Hoy `executeKind` vive en un componente de cliente (`strategy-execute.tsx`); el servidor necesita su propia comprobación, sin importar el componente.
- Orden en `decideSuggestionCore` (rama estratégica): si `decision === "approve"` y es de esos tipos: (1) sin `execute` → error de CA-1; (2) con `execute`: comprobar forma y `kind` (CA-7) y reglas de `experimentDraftIssues` o título de la tarea (CA-6); (3) solo entonces `decideStrategy`; (4) crear y enlazar.
- Pruebas: el `fakeDb` de `decide-suggestion.test.ts` devuelve la propia sugerencia en cualquier consulta; para estas pruebas basta con que la RPC no se llame, pero si se necesitara otra tabla hay que hacerlo sensible a ella.
- Alternativas descartadas: (a) **función SQL transaccional** que decida y cree: es la única atómica, pero exige migración, y el destino de la base sigue sin decidir (Lovable en pausa); se retoma después. (b) **Crear desde un borrador por defecto en Telegram, agente o MCP**: rompe CA-35 y CA-36, que piden un borrador editable. (c) **Compensar volviendo a `pending`** como hace la rama operativa (`agent.functions.ts:340-343`): la RPC deja un registro de decisión que habría que borrar. (d) **Recuperar una sugerencia aceptada sin enlace** desde el formulario: el gate vio que no tiene entrada en la app y que puede crear duplicados; queda como NK-0043.

## 14. Riesgos y dependencias
- Quien aceptaba desde Telegram una de esas sugerencias pasa a no tener el botón y a recibir un mensaje que le remite a la app: es el efecto buscado, pero cambia el flujo.
- Un fallo del insert tras registrar la decisión sigue dejando la sugerencia aceptada sin nada creado (NK-0043). Los errores evitables ya no llegan a registrarla.
- Depende de que NK-0040 (formulario) esté publicado: el cliente interpreta «Ya estaba gestionada».
- Las migraciones 0072 y 0073 de `main` no están aplicadas en la base de Lovable Cloud (sección 3): no afectan a este SDD, pero el código de F4 y el disparador de seguridad de F0 dependen de ellas.

## 15. Preguntas para Fede y para la revisión técnica
**Decididas por Fede el 2026-11-01** (todas con la recomendación del autor):
1. **P-1.** Telegram, agente y MCP rechazan y remiten a la app; no crean con un borrador por defecto.
2. **P-2 (revisada tras el gate).** La recuperación de una sugerencia ya aceptada sin enlace sale de este SDD (hoy hay 0 casos y no tiene entrada en la app): ticket aparte, NK-0043.
3. **P-3.** En Telegram se quita el botón de aceptar para esos dos tipos: el aviso urgente deja posponer y descartar, el resumen solo «Posponer n».
4. **P-4.** Los textos de la sección 9 valen; el autor corrigió la concordancia («revisarla») y añadió «No la he aceptada» y «Complétala en Sugerencias» tras el informe del gate.
5. **Rechazo como error** (no como mensaje normal), para que el agente, Telegram y la confirmación de acciones no escriban «Hecho».

**Siguen abiertas:** ninguna.

## 16. Pendiente de verificar
1. Reproducir el hueco en la aplicación y en Telegram: nadie lo ha hecho; solo hay lectura de código y la medición de la base (0 casos).
2. Barrido de rutas del servidor que usen otro cliente hacia `decideStrategy` o hacia el estado de las sugerencias, fuera de las encontradas con `git grep` (el gate no lo hizo a fondo). La edición directa de `status` desde el navegador la cerraría 0073, que no está aplicada en producción.
3. Que el recorrido de un error de `decideSuggestionCore` por `decidePending` llega a Telegram y al agente como «No se ha podido hacer»: lo dice el código leído, sin ejecutar.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Un agente `nokko-gate` con contexto fresco lee este SDD y el código, y devuelve su informe. El coordinador lo copia aquí sin editarlo. El gate no aprueba el SDD: informa; la aprobación es de Fede.
- Veredicto del gate: Objeciones en la primera pasada (2026-11-01, copiada abajo); el texto se corrigió después (tabla de respuesta del autor); falta una segunda pasada.
- Resto de campos: ver el informe copiado abajo.

### Primera pasada del gate (2026-11-01), copiada sin editar
Sobre el texto del commit `28a0519`, contrastado con `origin/main` (`6976fa8`). No ejecutó tests, `gate.mjs` ni `flake.mjs`.

**Veredicto: Objeciones.** El bug es real y la dirección es la correcta: rechazar sin borrador y validar antes de decidir. Pero hay dos defectos de fondo. CA-7 no tiene entrada en la interfaz. El mensaje de CA-1 llega engañoso por el agente y el MCP. Además hay tres citas o afirmaciones falsas.

**Sección 3, afirmación por afirmación**
- Ciertas, con línea:
  - `agent.functions.ts:265-297`.
  - `webhook.ts:59-61`.
  - `inbox.ts:22-32`.
  - `agent-tools.ts:128-150`.
  - `proactive.ts:104-116` y `133-140`, con «Hecho» y «Hecho n».
  - `strategy-execute-core.ts`: valida después de decidir (líneas 118 y 127) y los mensajes «quedó aceptada» (120 y 129).
  - `strategy_links` en `0070:30-40` con `UNIQUE (kind, ref_id)`.
  - El disparador 0073 solo deja volver a `pending` desde `pending`, `snoozed` o `dismissed`, no desde `approved`.
- Falsa: `reviewDue` no está en `src/lib/proactive/experiments.ts`, ese archivo no existe. Está en `src/lib/experiments.ts:47-49`. El contenido sí coincide: prioridad 1 y `commercial_action`.
- Imprecisa: la compensación a `pending` no está en una «rama `catch` de `executeTool`». Es el `catch` que envuelve `executeTool` dentro de `decideSuggestionCore` (`agent.functions.ts:340-343`).
- El «0 aceptadas» no lo ha comprobado. Es copia del §16.2 del SDD hermano (recuento en el SQL editor de Lovable Cloud). El conector de Supabase de esa sesión solo ve `postin-pre` y `postin-pro`, que son bases de Postin, y no las consultó. Sobre NOKKO no tiene acceso.
- Tampoco consta que 0073 esté aplicado en la base real: su propia cabecera dice «NOT applied to any real database». El razonamiento de la alternativa (c) depende de ello.

**CA sin prueba posible, o que no fallan hoy**
- CA-1 (por tipo) y CA-6 fallarían hoy, porque la RPC se llama antes. La prueba es posible, pero el `fakeDb` de `decide-suggestion.test.ts` no sirve para CA-6 y CA-7. Devuelve la propia sugerencia en cualquier `maybeSingle`, así que `strategy_links` aparecería «enlazado». Y `insert().select().single()` devuelve `data: null`. Hay que hacerlo sensible a la tabla.
- CA-2 y CA-8 están bien etiquetados como guardas. Hoy pasan, porque `agent.functions.ts:280` sale antes.
- CA-3 también es guarda. Hoy ya existe una prueba que acepta sin borrador una sugerencia de otro tipo (`decide-suggestion.test.ts:104`). Falta una prueba de «con borrador» pasando por `decideSuggestionCore`. Solo existe la de `strategy-execute-core.test.ts`.
- CA-7 fallaría hoy y es probable, pero ver la objeción 1 sobre su alcance.
- CA-4 no tiene función ni prueba nombrada. Sobre `main` «falla» solo por importación, que no cumple la regla 5 en espíritu. Debe fijar también la salida sin cambios del resto de sugerencias.
  - Los `select` de `proactive.ts:111`, `113` y `133` no traen `strategy`. Hay que añadirlo.
  - La función pura no puede vivir en el archivo de la ruta.
  - El resumen hoy no ofrece «descartar», solo `Hecho n` y `Posponer n`. CA-4 pide «posponer y descartar» y a la vez «el resto sigue igual». Hay que decidir si el resumen gana un botón.
- CA-5 ya puede nombrar su archivo: `src/lib/agent-tools.test.ts` (ya prueba `decide_suggestion` en la línea 478). Es una prueba de cadena, débil. `list_suggestions` (`core-read.ts:185-188`) no devuelve `strategy` y quita `detector`, así que el agente no puede saber qué sugerencia es una prueba.
- CA-6 dice «hipótesis o métrica». `experimentDraftIssues` también exige la fecha de revisión (`strategy-execute.ts:126`).

**Objeciones por apartado**
1. **CA-7 no es alcanzable por una persona.** La lista pide `status = "pending"` (`suggestions.tsx:96`). El tablero muestra aceptadas, pero solo pinta «Aceptar» si `open` (`suggestion-board.tsx:152`). Nada lee `strategy_links` en la interfaz. El §4 promete «se puede recuperar desde el formulario» y el §5 prohíbe tocar el tablero y el diálogo. O se amplía el alcance con interfaz, o CA-7 es código muerto, o sale de este SDD.
2. **CA-7 contradice el §8.** Hoy, si B envía mientras A está entre la decisión y el enlace (`decideStrategy`, luego el insert, luego `link`), B recibe «Ya estaba gestionada». Con CA-7, B crea un duplicado. El riesgo no es solo «dos recuperaciones simultáneas». Además, el resultado de `link()` nunca se comprueba (`strategy-execute-core.ts:33-34, 121, 130`). Si el enlace falla (por ejemplo por RLS), queda un objeto sin enlace y CA-7 crearía otro. Debe exigir comprobar el error del enlace.
3. **«Devolver un mensaje» en CA-1 es engañoso.**
   - `decidePending` (`agent.functions.ts:113-157`, no citado) marca la acción como `confirmed` y escribe «Hecho: Aprobar la sugerencia. {mensaje}». Eso llega al agente, a Telegram por `a:` y al MCP.
   - Se verá «Hecho» sin que se haya hecho nada. Hay que decidir entre lanzar error y devolver un estado, y fijarlo en un CA.
4. **El borrador no se valida de verdad.** `execute` entra sin validar (`agent.functions.ts:257`). El servidor no comprueba que `execute.kind` coincida con el `action_type` de la sugerencia. Un borrador malformado lanza `TypeError` ya después de decidir. Fechas inválidas o un `deal_id` inexistente fallan en la base, también después de decidir. El §4 promete «nunca queda aceptada por una validación evitable», y CA-6 solo cubre las reglas del formulario. Falta validar forma y tipo antes de decidir.
5. **Visibilidad.** El §8 dice «Rol que no puede ver: sin cambios (`canActOnSuggestion`)». `canActOnSuggestion` solo mira la asignación. `canViewStrategy` no se aplica ni en `decideSuggestionCore` ni en `notifyUrgent`. `daily-email.server.ts:37` sí excluye las de precio. Es preexistente y afecta al CA-58 del padre. No lo cubre este SDD.
6. **Falta definir qué pasa con `rememberDecision`.** Hoy, si falla la creación, `rememberDecision` (líneas 298-301) no se ejecuta. El SDD no dice si la recuperación debe llamarlo.

**[Por verificar] que sigue sin comprobarse**
- Reproducción en la aplicación y en Telegram (§16.1).
- Lectura de `strategy_links`, §16.2. Por el código es viable: `GRANT SELECT, INSERT` para `authenticated`, y la política es solo `org_id = current_org() AND is_org_member`, sin filtro de visibilidad. `service_role` tiene `ALL`. Insertar el enlace pasa por la política «org insert», que exige que la sugerencia sea visible. Ni el cliente de usuario ni el de servicio vuelven a decidir: el flujo de CA-7 nunca llama a la RPC. Contra una base real, sin comprobar.
- Otros caminos hacia `decideStrategy` (§16.3). Por código, el único llamador es `decideSuggestionCore`, con cuatro entradas: `decideSuggestion`, Telegram `s:`, la herramienta del agente, y `decidePending` desde la app o Telegram `a:`. El MCP solo encola. `org-data.ts:165-174` excluye las `strategy_%` del cierre automático.
- Queda abierta una edición directa de `status` desde el navegador. La cerraría 0073, que no consta aplicado. Lo único que queda por revisar son las rutas del servidor que usen otro cliente, y eso no lo ha barrido a fondo.
- Hay otro emisor del botón `s:...:approve`, `weekly-report.server.ts:78`. Es de un detector no estratégico y no afecta.

**Contradicciones**
- La cita errónea de `experiments.ts` y la del `catch` (arriba).
- §8 «la otra recibe Ya estaba gestionada» frente a CA-7 (objeción 2).
- §4 «se puede recuperar desde el formulario» frente al §5 «no cambiar tablero ni diálogo» (objeción 1).
- Parent F3 y CA-35/CA-36: sin contradicción; rechazar y remitir encaja con borrador editable. F6 está sin empezar, así que no hay decisión previa que choque, salvo CA-58 (objeción 5).

**Orden de la sección 13 (punto 4)**
- Implementable sin migración. `parseStrategy` ya existe y se puede importar. El orden validar, decidir, crear es posible.
- Qué rompe:
  - Telegram con botones ya enviados: `s:` imprime `r.message`, así que muestra el rechazo. Correcto.
  - Telegram, agente y MCP por `decidePending`: dicen «Hecho» (objeción 3).
  - Un cliente web antiguo sin diálogo: el tablero y la lista abren el formulario. La baraja lanza antes del servidor.
  - Dos accesos a la vez: duplicados con CA-7.

**Alcance y nokko-shape (punto 7).** Por la tabla, el bug (U-1, CA-1 y CA-6) cabría en un ticket más brief. El SDD corto se sostiene porque cambia el contrato entre canales y Fede decide P-1. CA-7 más Telegram y agente es más de «corto». Si CA-7 incluye interfaz, ya no es corto.

**Textos de la sección 9 (punto 8)**
- «revisarlo» concuerda mal con «una tarea»; usa «revisarla» o dos textos.
- El mensaje no dice «qué pasó»: falta «No la he aceptado».
- «Se completa en Sugerencias.» no es una acción en tuteo. Mejor «Complétala en Sugerencias.»
- Tuteo y sin iconos: correctos.

**Lo que esta revisión NO demuestra**
- Que ninguna prueba falle o pase: no ejecutó suite, `gate.mjs` ni `flake.mjs`.
- El «0 aceptadas», el estado de 0073 en la base real, ni RLS contra una base.
- El comportamiento en la aplicación, en Telegram ni en el navegador.
- La barrida de rutas del servidor fuera de las buscadas con `git grep`. Tampoco el estado de NK-0040 y NK-0041 en el ledger.
- Segunda máquina y soak: no ejecutados.

### Respuesta del autor a la primera pasada (2026-11-01)
Texto del autor, no del gate. Decisiones de Fede el 2026-11-01 (sección 15).

| Objeción | Dónde queda |
|---|---|
| CA-7 sin entrada en la app; contradice §4/§5 | CA-7 y CA-8 antiguos retirados; recuperación = NK-0043 (secciones 5 y 15) |
| CA-7 crea duplicados; `link()` no se comprueba | Retirado con la recuperación; queda anotado para NK-0043 (sección 14) |
| Mensaje de CA-1 llega como «Hecho» por `decidePending` | CA-1 pide error, y el camino de `decidePending` entra en la prueba (secciones 7 y 8) |
| Borrador sin validar (forma y `kind`) | CA-6 (reglas) y nuevo CA-7 (forma y tipo) antes de decidir |
| CA-6 omite la fecha de revisión | CA-6 enumera título, hipótesis, métrica y fecha |
| CA-4: sin función ni prueba; `select` sin `strategy`; resumen sin «descartar» | CA-4 nombra función pura fuera de la ruta, `select` con `strategy`, y el resumen deja solo «Posponer n» |
| CA-5 débil; `list_suggestions` sin tipo | Declarado débil; el agente lo aprende por el rechazo (sección 7) |
| `fakeDb` no sirve | Nota en la sección 13 |
| CA-3 sin prueba «con borrador» | CA-3 la declara nueva, como guarda |
| Visibilidad (`canViewStrategy`) | Fuera de alcance: NK-0042 (secciones 5 y 8) |
| `rememberDecision` en la recuperación | Retirado con la recuperación |
| Citas: `experiments.ts`, `catch` | Corregidas (secciones 3 y 13) |
| «0 aceptadas» sin comprobar por el gate | Comprobado de nuevo el 2026-11-01 por el conector de Lovable (sección 3) |
| 0073 sin aplicar | Confirmado: 0072 y 0073 no están en la base de Lovable (secciones 3 y 14) |
| Textos | Ajustados (sección 9) |

## 18. Delta de implementación (lo rellena el agente al entregar)
Sin entrega todavía.
