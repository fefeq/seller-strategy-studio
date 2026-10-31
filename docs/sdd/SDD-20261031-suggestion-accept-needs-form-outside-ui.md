# SDD-20261031-suggestion-accept-needs-form-outside-ui · [Bug] Aceptar una prueba o acción comercial fuera de la app la cierra sin crear nada

**Tipo:** Bug · **Prioridad propuesta:** Media (el hueco existe en `main`, pero hoy no afecta a nadie: ver sección 3)
**Estado:** Borrador · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-10-31
**PRD:** No aplica (bug) · **Depende de:** — · **Tickets:** NK-0041 y el segundo síntoma de NK-0040 (el NK-0040 ya entregado cubre solo el formulario del cliente)
**SDD que corrige:** F3 de `SDD-20261027-strategic-suggestions-engine` (CA-35 y CA-36); sigue a `SDD-20261031-board-accept-opens-execute-form`.

> Un SDD dice cómo se verifica que está bien hecho. Cada criterio de aceptación (CA-n) debe poder tener una prueba automática que lo nombre.
> Nivel elegido: SDD corto, sin PRD. Cambia el contrato de una función del servidor que usan Telegram, el agente y el MCP, pero no toca esquema, RLS ni datos nuevos.

## 1. Resumen
Una sugerencia estratégica de tipo prueba (`experiment`) o acción comercial (`commercial_action`) debe crear un experimento o una tarea cuando se acepta, con un formulario que la persona revisa (CA-35, CA-36). La app ya lo hace en la tarjeta, el tablero y la lista. Pero `decideSuggestionCore` acepta la decisión sin borrador cuando la llaman Telegram, el agente o el MCP: la sugerencia queda aceptada y no se crea nada. Además, si el formulario tiene errores o el insert falla después de registrar la decisión, la sugerencia queda aceptada sin nada creado y no se puede recuperar. Este SDD cierra ambos huecos sin migración.

## 2. Problema y para quién
Quien acepta una de esas sugerencias desde Telegram («Hecho»), desde el asistente o desde una acción confirmada del MCP la cierra sin que se cree el experimento ni la tarea, y no vuelve a verla.

## 3. Evidencia y por qué ahora
Leído el 2026-10-31 sobre `origin/main` (`b3567db`); no reproducido en la aplicación **[Por verificar]**.
- `src/lib/agent.functions.ts:265-297`: `decideSuggestionCore`, para sugerencias `strategy_*`, llama a `decideStrategy` (registra la decisión con la RPC `decide_strategy_suggestion`) y solo después, con `execute`, crea el experimento o la tarea. Sin `execute`, `proposeChange` no hace nada para esos dos tipos y la respuesta es de éxito.
- Llamadores de `decideSuggestionCore` sin borrador (informe del gate de NK-0038): Telegram, botón `s:<id>:approve` (`src/routes/api/public/telegram/webhook.ts:59-61`); herramienta del agente `decide_suggestion` (`src/lib/agent/tools/inbox.ts:22-32`); MCP, al confirmar una acción pendiente (`src/lib/mcp/tools/agent-tools.ts:128-150`, que ejecuta la misma herramienta).
- Telegram ofrece ese botón sin filtrar por detector: aviso urgente de prioridad 1 y resumen diario (`src/routes/api/public/jobs/proactive.ts:104-116` y `133-140`; el aviso usa el texto «Hecho» y el resumen «Hecho n»). `reviewDue` (`src/lib/proactive/experiments.ts:48-49`) genera una sugerencia de prioridad 1 y tipo `commercial_action`.
- `src/lib/strategy-execute-core.ts` (`createExperimentFromSuggestion`, `createTaskFromSuggestion`): validan el borrador **después** de que la decisión ya está registrada («Antes de guardar, completa…»), y si el insert falla el mensaje dice «La sugerencia quedó aceptada; inténtalo de nuevo». El reintento devuelve «Ya estaba gestionada» y no hay forma de recrear.
- El camino de sugerencias operativas ya compensa un fallo devolviendo la fila a `pending` (`agent.functions.ts`, rama `catch` de `executeTool`); el camino estratégico no puede hacerlo igual porque la RPC deja un registro de decisión y el disparador 0073 (`decide_strategy_suggestion` es el único modo de cambiar su estado desde el navegador).
- `strategy_links` (`drizzle/migrations/0070_strategy_execution.sql:30-40`) relaciona cada sugerencia con lo que originó; `UNIQUE (kind, ref_id)`, sin unicidad por sugerencia.
- Medido el 2026-10-31 en la base de producción (solo lectura, recuentos): 0 sugerencias de esos dos tipos aceptadas; 3 estratégicas en total, las tres pendientes y de tipo `data_to_complete`. **El hueco no ha afectado a nadie todavía.**

## 4. Resultado buscado
- Aceptar una prueba o acción comercial solo se completa si se crea el experimento o la tarea (desde la app) o se redirige a la app (desde los demás canales), y nunca queda aceptada sin nada creado por una validación evitable.
- Si la sugerencia ya está aceptada y no tiene nada enlazado, se puede recuperar desde el formulario.
- Medición: las pruebas de CA-1 a CA-8 pasan en `main`. Línea base de sugerencias afectadas: 0 (sección 3).

## 5. Alcance
**Incluye:** `decideSuggestionCore` y su orden de validación; los avisos de Telegram (aviso urgente y resumen) para esos dos tipos; el texto de la herramienta `decide_suggestion` del agente.
**No incluye** (límite que el brief copia a «Movimientos prohibidos»):
- Migraciones, RLS, `drizzle/`; una RPC transaccional que decida y cree en un solo paso (descartada, ver 13).
- Cambiar `ExecuteDialog`, el tablero, la tarjeta o la baraja.
- Crear experimentos o tareas desde Telegram, el agente o el MCP con un borrador por defecto (descartado, ver 13).
- Cambiar el contrato de respuesta de `decideSuggestionCore` más allá de lo que describen los CA; el aviso del cliente sigue comparando el texto «Ya estaba gestionada» (límite conocido de NK-0040).
- Sugerencias de otros tipos (cambio de estrategia, datos a completar, operativas).

## 6. Cambios de comportamiento (delta)
**Añadido:** rechazo explicado de `approve` sin borrador para esos dos tipos; recuperación de una sugerencia aceptada sin nada enlazado; botones de Telegram distintos para esos dos tipos.
**Modificado:** la validación del borrador ocurre antes de registrar la decisión; antes se registraba y luego se validaba.
**Eliminado:** nada.

## 7. Historias y criterios de aceptación
### H-1: Como miembro o líder, quiero que Telegram, el asistente y el MCP no cierren una prueba o acción comercial sin crearla, para no perder una sugerencia por error.
- **CA-1** CUANDO `decideSuggestionCore` recibe `approve` sin borrador sobre una sugerencia estratégica de tipo `experiment` o `commercial_action` aún pendiente, el sistema NO DEBE registrar la decisión ni cambiar su estado, y DEBE devolver un mensaje que diga qué hacer («qué pasó + qué hacer», ver 9) · prueba: `src/lib/decide-suggestion.test.ts` *(ampliar; uno por tipo)*
- **CA-2** El sistema DEBE seguir aplazando y descartando esas sugerencias sin borrador, como hoy · prueba: `src/lib/decide-suggestion.test.ts` *(guarda de regresión, no falla primero)*
- **CA-3** El sistema DEBE seguir aceptando con borrador (el camino del formulario) y aceptando sin borrador las sugerencias de otros tipos, como hoy · prueba: `src/lib/decide-suggestion.test.ts` *(guarda de regresión)*
- **CA-4** El aviso urgente y el resumen diario de Telegram NO DEBEN ofrecer el botón de aceptar para esas sugerencias; DEBEN ofrecer posponer y descartar, y el texto del mensaje DEBE indicar que se completan en Sugerencias; el resto de sugerencias sigue igual · prueba: *(por nombrar; función pura que construya los botones y el texto, probada en `src/lib/proactive.test.ts`)*
- **CA-5** La descripción de la herramienta `decide_suggestion` del agente DEBE decir que las pruebas y acciones comerciales se aceptan desde Sugerencias · prueba: *(por nombrar; el archivo de pruebas de las herramientas del agente)*

### H-2: Como persona que acepta una prueba o acción comercial, quiero no quedar con la sugerencia aceptada y sin nada creado, para no perder el trabajo.
- **CA-6** CUANDO se envía `approve` con un borrador que no cumple las reglas del formulario (experimento sin hipótesis o métrica, tarea sin título), el sistema NO DEBE registrar la decisión y DEBE devolver el motivo · prueba: `src/lib/decide-suggestion.test.ts` *(ampliar; uno por tipo)*
- **CA-7** CUANDO se envía `approve` con borrador sobre una sugerencia ya aceptada, de tipo `experiment` o `commercial_action`, y sin ningún enlace de tipo `experiment` o `task` en `strategy_links`, el sistema DEBE crear lo que falta y enlazarlo sin volver a registrar la decisión · prueba: `src/lib/decide-suggestion.test.ts` *(ampliar; uno por tipo)*
- **CA-8** CUANDO la sugerencia ya está aceptada y YA tiene ese enlace, el sistema DEBE responder «Ya estaba gestionada» como hoy y NO DEBE crear nada · prueba: `src/lib/decide-suggestion.test.ts` *(guarda de regresión)*

## 8. Casos límite y errores
- Dos personas aceptan a la vez: la RPC deja pasar a una; la otra recibe «Ya estaba gestionada» (sin cambios). La recuperación de CA-7 solo actúa si no hay enlace; dos recuperaciones simultáneas podrían crear dos objetos porque `strategy_links` no es único por sugerencia: riesgo aceptado, ver 14.
- Telegram: botones ya enviados antes del cambio, con «Hecho» sobre una de esas sugerencias, reciben el mensaje de CA-1 en vez de cerrarla.
- Rol que no puede ver o decidir la sugerencia: sin cambios (`canActOnSuggestion`).
- Otra empresa: toda lectura y escritura sigue filtrada por `org_id`.
- Acción pendiente del MCP confirmada para una de esas sugerencias: la herramienta devuelve el mensaje de CA-1 y no cierra nada (comparte `decideSuggestionCore`).

## 9. Experiencia y copy
Textos en español, «tú», sin iconos, con «qué pasó + qué hacer». Propuesta (Fede ajusta):
- Rechazo (CA-1): «Esta sugerencia crea un experimento o una tarea y hay que revisarlo antes de aceptarla. Ábrela en Sugerencias, completa el formulario y acéptala allí.» (en el mensaje de la tarea, «una tarea»; en el del experimento, «un experimento».)
- Telegram (CA-4): una línea al final del mensaje: «Se completa en Sugerencias.»

## 10. Datos, permisos y privacidad
Sin tablas ni columnas nuevas, sin cambios de RLS ni GRANTs. Solo lectura adicional de `strategy_links` (ya existente, con RLS por empresa) en CA-7 **[Por verificar]** que el cliente del usuario y el de servicio pueden leerla. La decisión sigue registrándose con quién, cuándo y por qué. Ningún dato de clientes en pruebas: sugerencias ficticias.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| Ninguna | — | — | — |

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | `decideSuggestionCore`: rechazo sin borrador y validación antes de decidir | CA-1, CA-6 (CA-2, CA-3 guardas) | `src/lib/decide-suggestion.test.ts` |
| U-2 | Recuperación de una sugerencia aceptada sin enlace | CA-7 (CA-8 guarda) | `src/lib/decide-suggestion.test.ts` |
| U-3 | Telegram: botones y texto para esos dos tipos; descripción de la herramienta del agente | CA-4, CA-5 | `src/lib/proactive.test.ts` y pruebas de la herramienta *(por nombrar)* |

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- Un solo sitio decide si una sugerencia es de esos dos tipos: `parseStrategy(s.strategy)?.action_type` (`src/lib/strategy-suggestions.ts`). Hoy `executeKind` vive en un componente de cliente (`strategy-execute.tsx`); el servidor necesita su propia comprobación, sin importar el componente.
- Orden en `decideSuggestionCore` (rama estratégica): (1) si es de esos tipos y `decision === "approve"`: sin `execute` → CA-1; con `execute` → validar con `experimentDraftIssues` o el título de la tarea → CA-6; (2) solo entonces `decideStrategy`; (3) crear y enlazar. La recuperación (CA-7) va antes del «Ya estaba gestionada» de `s.status !== "pending"`, solo para `approve` con `execute` sobre estado aceptado.
- Alternativas descartadas: (a) **RPC transaccional** que decida y cree: es la única atómica, pero exige migración, y el destino de la base sigue sin decidir (Lovable en pausa); se retoma después. (b) **Crear desde un borrador por defecto en Telegram, agente o MCP**: rompe CA-35 y CA-36, que piden un borrador editable antes de guardar. (c) **Compensar volviendo a `pending`** como hace la rama operativa: la RPC deja un registro de decisión que habría que borrar y el disparador 0073 bloquea el cambio desde el navegador; arriesgado.

## 14. Riesgos y dependencias
- Quien aceptaba desde Telegram una de esas sugerencias pasa a recibir un mensaje que le remite a la app: es el efecto buscado, pero cambia el flujo.
- CA-7 puede crear duplicados si dos personas recuperan a la vez (`strategy_links` solo es único por `(kind, ref_id)`). Un índice único por sugerencia exigiría migración; no entra aquí.
- Aun así, un fallo del insert tras registrar la decisión sigue dejando la sugerencia aceptada; la diferencia es que ahora se puede recuperar (CA-7) y que los errores evitables ya no llegan a registrarla (CA-6).
- Depende de que NK-0040 (formulario) esté publicado: el cliente interpreta «Ya estaba gestionada».

## 15. Preguntas para Fede y para la revisión técnica
- **P-1.** ¿Telegram, agente y MCP rechazan y remiten a la app (CA-1), o crean con un borrador por defecto? **Recomiendo rechazar y remitir:** CA-35 y CA-36 piden un borrador editable y esos canales no pueden ofrecerlo.
- **P-2.** ¿La recuperación (CA-7) entra ahora sin migración, o esperamos a una RPC transaccional? **Recomiendo entrar ahora:** cierra el caso real sin tocar la base y no impide la RPC después.
- **P-3.** En Telegram, ¿se quita el botón de aceptar para esos dos tipos (CA-4), o se deja y devuelve el mensaje de rechazo? **Recomiendo quitarlo:** un botón que siempre falla confunde.
- **P-4.** ¿Los textos de la sección 9 valen? **Recomiendo sí**, con tu ajuste de tono.

## 16. Pendiente de verificar
1. Reproducir el hueco en la aplicación y en Telegram: nadie lo ha hecho; solo hay lectura de código.
2. Que el cliente del usuario y el de servicio pueden leer `strategy_links` en CA-7.
3. Que el agente y el MCP no tienen otro camino hacia `decideStrategy` sin pasar por `decideSuggestionCore` (el gate de NK-0038 lo dio por completo; confirmar sobre el código actual).

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Un agente `nokko-gate` con contexto fresco lee este SDD y el código, y devuelve su informe. El coordinador lo copia aquí sin editarlo. El gate no aprueba el SDD: informa; la aprobación es de Fede.
- Veredicto del gate: No revisado
- CA sin prueba posible o sin G-n: pendiente
- [Por verificar] que sigue sin comprobarse: pendiente
- Contradicciones con el código o con decisiones previas: pendiente
- Lo que esta revisión NO demuestra: pendiente

## 18. Delta de implementación (lo rellena el agente al entregar)
Sin entrega todavía.
