# SDD-20261031-board-accept-opens-execute-form · [Bug] «Aceptar» en el tablero de equipo no crea el experimento ni la tarea

**Tipo:** Bug · **Prioridad propuesta:** Alta (está en `main`; cada aceptación afectada cierra la sugerencia sin hacer lo que promete)
**Estado:** Borrador · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-10-31
**PRD:** No aplica (bug) · **Depende de:** — · **Ticket:** NK-0038
**SDD que corrige:** F3 de `SDD-20261027-strategic-suggestions-engine` (CA-35 y CA-36), que quedó sin cumplir en una de las tres pantallas.

> Un SDD dice cómo se verifica que está bien hecho. Cada criterio de aceptación (CA-n) debe poder tener una prueba automática que lo nombre.
> Nivel elegido: SDD corto. Un bug de interfaz no exige SDD, pero lo pediste y este toca datos (una decisión que se registra y no se puede deshacer desde esta pantalla). Un PRD no añadiría nada.

## 1. Resumen
En la pestaña Equipo de `/inbox`, el botón «Aceptar» de una sugerencia estratégica de tipo prueba o acción comercial envía la decisión directamente. La sugerencia pasa a aceptada y desaparece de pendientes, pero no se crea el experimento ni la tarea que CA-35 y CA-36 prometen. La tarjeta individual sí abre el formulario y la baraja avisa de abrirla en la lista. Se corrige el tablero para que abra el mismo formulario.

## 2. Problema y para quién
Quien acepta una sugerencia desde el tablero (miembro o líder) cree que se ha creado un experimento o una tarea y no es así; la sugerencia ya no vuelve a aparecer.

## 3. Evidencia y por qué ahora
Leído el 2026-10-31 sobre `origin/main` (`dcea201`); no lo he reproducido en la aplicación **[Por verificar]**.
- `src/components/suggestion-board.tsx:162`: el botón «Aceptar» de una estratégica llama a `act(s.id, "approve")` sin mirar `executeKind(s)`. El archivo no importa `strategy-execute`.
- `src/components/strategy-execute.tsx:25-28`: `executeKind` devuelve `experiment` si `action_type` es `experiment` y `task` si es `commercial_action`.
- `src/components/suggestions.tsx:192,206`: la tarjeta abre `ExecuteDialog` cuando `executeKind(s)` no es nulo.
- `src/components/suggestion-deck.tsx:41-45`: la baraja se niega a aceptar una sugerencia así y manda a «la lista» («Ábrela en la lista para completar el experimento o la tarea antes de aceptarla.»). El enlace de la baraja lleva a `/inbox?vista=lista`, que pinta `SuggestionCard` (`inbox.tsx:48-52`) y sí abre el formulario. El tablero es la pestaña «Equipo» (`inbox.tsx:42`): el fallo está solo ahí.
- `src/lib/agent.functions.ts:282-297`: el servidor, sin borrador `execute`, registra la decisión (`decideStrategy`) y solo llama a `proposeChange`; para un experimento o una acción comercial no crea nada y responde con éxito.
- Origen del hallazgo: revisión del agente de Lovable el 2026-10-29 (su informe, no reproducido por mí). Yo comprobé el código citado.
- Cuántas sugerencias se han aceptado así en producción: **sin dato**, no se ha consultado la base.

## 4. Resultado buscado
- Desde el tablero, «Aceptar» una sugerencia de prueba o acción comercial ofrece crear el experimento o la tarea antes de decidir, como ya hacen la tarjeta individual y la lista. Que la creación llegue a hacerse depende del servidor (sección 14, NK-0040 y NK-0041).
- Medición: las pruebas de CA-1 a CA-4 pasan en la rama de trabajo. Línea base de aceptaciones afectadas: **sin dato** (ver 16.2).

## 5. Alcance
**Incluye:** el botón «Aceptar» del tablero de equipo, en la tabla (md+) y en las tarjetas del teléfono (comparten `rowActions`). Abrir `ExecuteDialog` con el motivo ya escrito en la fila.
**No incluye** (límite que el brief copia a «Movimientos prohibidos»):
- Cambios en `ExecuteDialog`, en la baraja, en la tarjeta individual o en `strategy-execute.ts`.
- Tocar `drizzle/migrations` ni RLS.
- Recuperar las sugerencias ya aceptadas sin crear nada (ver 15, P-2).
- Textos nuevos: se reutilizan los del formulario.
- Cambiar el comportamiento de las sugerencias operativas ni de las de tipo cambio de estrategia.

## 6. Cambios de comportamiento (delta)
**Añadido:** «Aceptar» en el tablero abre el formulario de creación para pruebas y acciones comerciales.
**Modificado:** antes, enviaba `approve` sin borrador y cerraba la sugerencia; después, la decisión solo se envía al confirmar el formulario, con el borrador.
**Eliminado:** nada.

## 7. Historias y criterios de aceptación
### H-1: Como miembro o líder, quiero que «Aceptar» una prueba o una acción comercial en el tablero me deje crear el experimento o la tarea, para no cerrarla sin hacer nada.
- **CA-1** CUANDO pulso «Aceptar» en el tablero sobre una sugerencia estratégica cuyo `executeKind` es `experiment` o `task`, el sistema DEBE abrir el formulario de creación y NO enviar la decisión hasta que lo confirme · prueba: `src/components/strategy-screens.test.tsx` *(ampliar; una prueba por tipo)*
- **CA-2** CUANDO confirmo el formulario, el sistema DEBE enviar `approve` con el borrador editado y el motivo escrito en la fila · prueba: `src/components/strategy-screens.test.tsx` *(ampliar; una por tipo)*
- **CA-3** SI cierro el formulario sin confirmar, ENTONCES el sistema NO DEBE enviar ninguna decisión (la sugerencia sigue pendiente; el arnés solo demuestra que `decide` no se llama, comprobado después de cerrar) · prueba: `src/components/strategy-screens.test.tsx` *(ampliar)*
- **CA-4** El sistema DEBE seguir aceptando directamente, como hoy, las sugerencias estratégicas de otro tipo y las operativas · prueba: **guarda de regresión, no falla primero**: la prueba existente «Aceptar sends the decision for that suggestion» (solo cubre `strategy_change`) más dos nuevas en `src/components/strategy-screens.test.tsx`: una operativa («Marcar como hecha» envía `approve`) y una estratégica de otro tipo (`data_to_complete`)

## 8. Casos límite y errores
- Doble clic en «Aceptar»: el formulario ya abierto no vuelve a enviar nada; el envío ocurre una vez, al confirmar (CA-2).
- Sugerencia ya gestionada por otra persona mientras el formulario está abierto: **límite conocido, no se corrige aquí.** El servidor responde «Ya estaba gestionada» sin lanzar error y `ExecuteDialog` ignora la respuesta (`strategy-execute.tsx:55-56`): muestra «creado» y cierra sin haber creado nada. Ticket NK-0040.
- Rol que no puede ver o decidir la sugerencia: sin cambios (`canActOnSuggestion`).
- Otra empresa: sin cambios, la decisión sigue filtrada por `org_id`.

## 9. Experiencia y copy
Sin textos nuevos. El formulario es el existente («Crear el experimento» / «Crear la tarea»; «Está rellenado desde la sugerencia. Edítalo y confirma: hasta entonces no se guarda nada.»).

## 10. Datos, permisos y privacidad
Sin tablas ni columnas nuevas, sin cambios de RLS ni de GRANTs. La decisión sigue registrándose con quién, cuándo y por qué. Ningún dato de clientes en pruebas: sugerencias ficticias.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| Ninguna | — | — | — |

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | El tablero abre un único `ExecuteDialog` al aceptar una prueba o acción comercial. Primero, comprobar que el diálogo se abre y se confirma en jsdom (16.4) | CA-1, CA-2, CA-3, CA-4 | `src/components/strategy-screens.test.tsx` (una prueba por tipo, `it.each`) |

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- Rama de trabajo desde `origin/main` (`dcea201`): el checkout `feat/software-factory` no contiene F3 y los números de línea no valdrían.
- Imitar `suggestions.tsx:192,206`, pero con **un solo** `ExecuteDialog` en la raíz de `SuggestionBoard`, no dentro de `rowActions`, que se pinta dos veces (tabla y tarjetas). Guardar la fila (o una copia), no solo el id, y montarlo con `key={id}`: el borrador se inicializa al montar (`strategy-execute.tsx:37-38`) y un refetch podría sacar la fila con el formulario abierto.
- `rowActions` es una sola función para la tabla y las tarjetas; la única entrada estratégica a `approve` es la línea 162.
- El botón de icono (`suggestion-board.tsx:198`) con `parseStrategy(s.strategy)` es inalcanzable (solo se pinta si no es estratégica); no se toca.
- Arnés de `strategy-screens.test.tsx`: parametrizar `action_type` en el fixture `strategic()` (hoy fijo a `strategy_change`); `metric` nace vacía (`strategy-execute.ts:125`) y el botón de crear está deshabilitado hasta escribirla; `review_on` y `due_date` salen de `new Date()` (usar `expect.any(String)` o temporizadores falsos); `supabase` está simulado con filas fijas, así que solo se prueba que `decide` no se llama.
- Alternativa descartada: que el tablero se niegue a aceptar, como la baraja. Obliga a salir de la pantalla donde la persona ya está.

## 14. Riesgos y dependencias
- El mismo hueco existe en otros tres canales, que este SDD no cierra (informe del gate, leído sobre `dcea201`; NK-0041):

| Origen | Dónde | Qué ocurre |
|---|---|---|
| Telegram, botón | `webhook.ts:59-61` | `s:<id>:approve` llama a `decideSuggestionCore(ctx,id,decision)` sin borrador |
| Telegram, aviso urgente y digest | `proactive.ts:104-116`, `133-140` | Empujan pendientes sin filtrar por detector, con botón «Hecho» |
| Agente | `inbox.ts:23-31` | Herramienta `decide_suggestion` sin `execute` |
| MCP | `agent-tools.ts:128-150` | La acción pendiente confirmada ejecuta la misma herramienta, sin borrador |

- NK-0040: `ExecuteDialog.save` ignora la respuesta del servidor (`strategy-execute.tsx:56`): si la sugerencia ya estaba gestionada, dice «creado» y cierra. En un tablero de equipo, donde varias personas ven la misma fila, es el caso más probable. Este SDD no lo arregla; tras U-1 el tablero pasa a usar este formulario, así que el caso aparece también ahí.
- Un refetch puede sacar la fila de la lista con el formulario abierto (sección 13).
- Las sugerencias ya cerradas por este fallo siguen cerradas (15.3).

## 15. Preguntas para Fede y para la revisión técnica
**Decididas por Fede el 2026-10-31 («si» a las recomendaciones del autor):**
1. **P-1.** El servidor no rechaza `approve` sin borrador en este SDD: es un cambio de contrato para Telegram, el agente y el MCP. Ticket aparte: NK-0041.
2. **§8.** «Ya estaba gestionada» y el orden registrar-antes-de-crear no se tocan aquí (no se cambia `ExecuteDialog`). Ticket aparte: NK-0040.
3. **P-2.** Las sugerencias ya aceptadas sin crear nada se miden primero con una consulta de solo lectura a producción que hace Fede (sección 16.2); después decide si se reabren.

**Siguen abiertas:** ninguna.

## 16. Pendiente de verificar
1. Reproducir el fallo en la aplicación: nadie lo ha hecho; solo hay lectura de código y el informe del agente de Lovable.
2. Cuántas sugerencias de prueba o acción comercial están aceptadas sin experimento ni tarea enlazados (CA-37): consulta de solo lectura a producción, que hace Fede.
3. ~~Qué llamadas a `decideSuggestionCore` sin borrador existen~~: cerrada con la tabla del gate (sección 14).
4. Que un diálogo de Radix se abre y se confirma bajo jsdom en el arnés de `strategy-screens.test.tsx`: ningún test de `main` lo hace todavía. Lo comprueba U-1 antes de escribir el resto de pruebas.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Un agente `nokko-gate` con contexto fresco lee este SDD y el código, y devuelve su informe. El coordinador lo copia aquí sin editarlo. El gate no aprueba el SDD: informa; la aprobación es de Fede.
- Veredicto del gate: Objeciones (primera pasada, 2026-10-31, copiada abajo). El texto del SDD aún no se ha corregido.
- Resto de campos: ver el informe copiado abajo.

### Primera pasada del gate (2026-10-31), copiada sin editar
Revisión del texto sobre `origin/main` (`dcea201`). Agente genérico con las instrucciones de `nokko-gate`, porque `nokko-gate` no estaba registrado en la sesión. No ejecutó tests ni `gate.mjs`.

**Veredicto: Objeciones.** El bug es real y el arreglo propuesto es el correcto, pero hay una afirmación falsa en la sección 3, otra falsa en la sección 8 y un CA condicional que no se puede aprobar tal cual. Todo es corregible sin rehacer el SDD.

**CA sin prueba posible o sin G-n:** ninguno es imposible de probar. No hay PRD, así que G-n no aplica. Pero:
- **CA-1 y CA-2** cubren dos tipos (`experiment` y `task`) con una sola prueba nombrada. El borrador y el diálogo son distintos en cada uno (`strategy-execute.tsx:66-79`). Pide una prueba por tipo (`it.each`), porque si no la rama `task` queda sin cubrir.
- **CA-1, CA-2 y CA-3 fallarían hoy**, por lectura de código, no por ejecución:
  - `suggestion-board.tsx:162` llama a `act(s.id,"approve")` al instante.
  - No se abre ningún diálogo, y `decide` se llama sin `execute`.
  - Los tres tests fallarían en el paso de encontrar el diálogo o en `decide` no llamado.
- **Sobre CA-2:** el fixture `strategic()` (`strategy-screens.test.tsx:62-93`) está fijado a `strategy_change`/`icp`. Hay que parametrizar `action_type`. `metric` nace vacío (`strategy-execute.ts:125`), así que «Aceptar y crear…» está deshabilitado hasta que el test la escriba. `review_on` y `due_date` dependen de `new Date()`, así que hay que usar `expect.any(String)` o fake timers.
- **CA-3:** «sigue pendiente» no se puede probar con este arnés. `supabase` está mockeado con filas fijas (líneas 11-23). Solo se prueba «`decide` no llamado», y debe afirmarse después de cerrar el diálogo, no antes.
- **CA-4** pasa hoy y pasará después, así que no es fail-first (regla 5). Es una guarda de regresión y debe etiquetarse así. Además la prueba nombrada («Aceptar sends the decision…», líneas 153-161) usa solo `strategy_change`.
  - La mitad «y las operativas» no tiene ninguna prueba. La línea 149 solo comprueba que el botón «Marcar como hecha» existe, y ningún test lo pulsa.
  - Tampoco hay fixture de `data_to_complete`.
  - Añade guardas para esas dos cosas.
- **CA-5** dice «por nombrar», pero el archivo existe: `src/lib/decide-suggestion.test.ts` (con `fakeDb`). Fallaría hoy: `approve` sin `execute` sobre `experiment` pasa por `decideStrategy` y devuelve éxito (`agent.functions.ts:284-296`). Fija el texto del rechazo, o un regex, porque «un mensaje que diga qué hacer» no es comprobable.
- **Sin precedente de jsdom:** ningún test de `origin/main` abre un Radix Dialog ni consulta `role="dialog"`. `setup.ts` solo polifila `scrollTo` y `matchMedia`. El diálogo de `task` usa `Pick`, que no leí. No he comprobado que jsdom lo aguante, y puede costar trabajo de arnés.

**[Por verificar] que sigue sin comprobarse:**
- Reproducción en la aplicación (§16.1). Solo hay lectura de código y el informe de Lovable.
- Cuántas aceptaciones afectadas hay en producción (§16.2). No hay acceso a la base y no se ha consultado.
- §16.3 (qué llamadas hay sin borrador) **ya puede cerrarse**, ver más abajo.
- No he leído `decidePending` entero, solo `agent.functions.ts:150-157`. Que la confirmación en la app de una acción de agente o MCP termina en `decide_suggestion` sin `execute` lo infiero de ahí y de `agent-tools.ts:144-149`.
- No he examinado `org-data.ts:171`, que marca sugerencias como `approved` directamente.
- No comprobé si la sugerencia del informe semanal (`weekly-report.server.ts:78`) es estratégica. Parece que no.

**Contradicciones con el código o con decisiones previas:**
1. **§3, viñeta 4, es falsa.** Dice que «la lista que el aviso nombra es justamente el tablero». No lo es.
   - El aviso de la baraja (`suggestion-deck.tsx:43-45`) manda a «la lista», y el enlace `done` apunta a `/inbox?vista=lista`.
   - Esa vista pinta `SuggestionCard` (`inbox.tsx:48-52`), que sí abre el formulario.
   - El tablero es la pestaña «Equipo» (`inbox.tsx:42`).
   - El aviso de la baraja es correcto y concuerda con la decisión (e) del padre. El bug queda solo en «Equipo».
   - Reescribe esa viñeta.
2. **§8, «Ya estaba gestionada», es falsa y choca con el alcance.** El SDD dice que el formulario «se cierra con ese mensaje».
   - `agent.functions.ts:280` y `strategy-core.ts:68` devuelven el mensaje, no lanzan error.
   - `ExecuteDialog.save` ignora la respuesta: `void r` en `strategy-execute.tsx:56`. Muestra «Experimento creado como idea, enlazado a la sugerencia.» (línea 55) y cierra, sin haber creado nada.
   - En un tablero de equipo, donde varias personas ven la misma fila, es el caso más probable.
   - §5 prohíbe tocar `ExecuteDialog`. O se amplía el alcance, con un CA nuevo, o se documenta como riesgo con ticket aparte. Hoy el SDD afirma lo contrario del código.
3. **§4, «crea el experimento o la tarea, o no acepta nada», promete más de lo que hace el servidor.**
   - `decideStrategy` registra la decisión primero (`agent.functions.ts:284`) y crea después (294-295).
   - Si el insert falla (`strategy-execute-core.ts:120,129`) queda aceptada sin nada creado. El propio mensaje de error lo dice.
   - El reintento desde el formulario cae en el punto 2.
   - Es preexistente y vale igual para `SuggestionCard`, pero no puede ser el resultado buscado de este bug.
4. **Citas imprecisas, sin importancia:**
   - `suggestion-deck.tsx:40-45` es en realidad 41-45.
   - `agent.functions.ts:288-297` es 282-297.
   - `strategy-execute.tsx:25-29` es 25-28.
5. **Verificadas como ciertas:**
   - `suggestion-board.tsx:162` y que el archivo no importa `strategy-execute` (imports 1-24).
   - `suggestions.tsx:192,206`.
   - El flujo de `decideStrategy`/`proposeChange`: devuelve `null` para `experiment` y `commercial_action` (`strategy-execute-core.ts:42`) y responde con éxito.
   - `executeKind` (`strategy-execute.tsx:25-28`).
   - El botón de la línea 198 es inalcanzable para estratégicas: `rowActions` sale antes con `open && parseStrategy` (línea 147).
   - `rowActions` se llama solo en las líneas 444 (tarjetas) y 491 (tabla), y la única entrada estratégica a `approve` es la 162.
   - La sección 4 no choca con ninguna decisión del padre. CA-35/36/37 y la decisión (e) del padre no mencionan el tablero.

**Sobre P-1 y la sección 14 (llamadas a `decideSuggestionCore` sin borrador):**

| Origen | Dónde | Qué ocurre |
|---|---|---|
| Telegram, botón | `webhook.ts:59-61` | `s:<id>:approve` llama a `decideSuggestionCore(ctx,id,decision)` |
| Telegram, aviso urgente | `proactive.ts:104-116` | Empuja las pendientes de prioridad 1 sin filtrar por detector, con el botón «Hecho». `experiments.ts:49` genera una de prioridad 1 y tipo `commercial_action`, y el digest también empuja estratégicas. |
| Telegram, digest | `proactive.ts:133-140` | Top 3 con «Hecho n». El `select` no trae `strategy`, así que no filtra. |
| Agente | `inbox.ts:23-31` (herramienta `decide_suggestion`) | Sin `execute` ni `reason`. `list_suggestions` (`core-read.ts:185-188`) incluye estratégicas y solo filtra las de precio. |
| MCP | `agent-tools.ts:128-150` | Las escrituras quedan como acción pendiente (`agent_pending_actions`). Al confirmarla se ejecuta la misma herramienta, sin borrador. |

El hueco que cubriría U-2 existe hoy en tres canales. El tablero no es el único.

Para P-1:
- Mantengo la recomendación de no meter U-2 aquí.
- Si Fede dijera que sí, los botones «Hecho» de Telegram quedarían como botones que siempre fallan para esos tipos.
- U-2 se solapa con la F6 del padre (CA-57 y CA-58).
- El servidor tampoco valida que `execute.kind` coincida con `executeKind(s)`. No es de este ticket, pero hay que tenerlo en cuenta si se abre.
- Resuelve P-1 antes de aprobar. Un CA «solo si Fede decide» no es aprobable. Si es que no, quita CA-5 y U-2, y pasa §14 a un ticket aparte.

**Nivel y alcance frente a `templates/sdd.md` y `nokko-shape`:**
- La plantilla se respeta: 18 secciones, y «Ninguna» en IA.
- Según la tabla de `nokko-shape`, un bug que no toca esquema, RLS ni datos no exige SDD. El arreglo de UI solo cambia cuándo se llama a una función existente.
- La justificación del SDD («lo pediste y toca datos») es defendible, y la regla de «propón el más ligero» no se incumple. Pero el único trozo que sí toca datos es U-2, que el propio SDD recomienda excluir.
- Con U-2 dentro, el alcance ya no es corto (cambia el contrato del servidor para Telegram, agente y MCP). Sin U-2, es coherente.
- Nota de nota técnica (§13): renderiza **un solo** `ExecuteDialog` en la raíz del tablero, no dentro de `rowActions`, que se monta dos veces (tabla y tarjetas, ambas en el DOM; el test cuenta 2 renderizaciones por fila, línea 148). Guarda la fila o un snapshot de ella, no solo el id, y móntalo con `key`. Si un refetch saca la fila de `rows` con el diálogo abierto, se perdería lo editado. Además, `useState` del borrador se inicializa al montar (`strategy-execute.tsx:37-38`).

**Lo que esta revisión NO demuestra:**
- Que algún test nuevo falle o pase. Ninguno existe, y no ejecuté la suite ni `gate.mjs`: no hay diff de código que pasarle.
- Nada de producción: aceptaciones afectadas, datos reales o comportamiento en navegador.
- Que el bug se reproduce en la aplicación.
- Que el diálogo funcione bajo jsdom en el arnés actual.
- El estado de NK-0038 en el ledger, que no consulté.
- Segunda máquina y soak: NOT RUN.
- Cualquier número de línea fuera de `dcea201`.

**Aviso para quien implemente:**
- El checkout actual (`feat/software-factory`) **no contiene F3**. Tiene `strategy-execute-core.ts` borrado y difiere de `origin/main` en 7 de los archivos clave (146 inserciones y 1363 borrados en `git diff --stat`).
- Hay que ramificar desde `dcea201`, o los números de línea y los tests no valdrán.

### Respuesta del autor a la primera pasada (2026-10-31)
Texto del autor, no del gate. Decisiones de Fede el 2026-10-31 («si» a las recomendaciones del autor): P-1 no, §8 ticket aparte, P-2 medir primero.

| Objeción | Dónde queda |
|---|---|
| §3 viñeta 4 falsa (la lista del aviso no es el tablero) | Reescrita (sección 3) |
| §8 «Ya estaba gestionada» falsa; `ExecuteDialog` ignora la respuesta | Reescrita como límite conocido; ticket NK-0040 (secciones 8 y 14) |
| §4 promete más de lo que hace el servidor | Resultado reformulado (sección 4); registro antes de crear, en NK-0040 |
| CA-1/CA-2 con una sola prueba para dos tipos | Una prueba por tipo, `it.each` (sección 7) |
| Fixture fijo a `strategy_change`, `metric` vacía, fechas | Notas de arnés en la sección 13 |
| CA-3 no demostrable con el arnés | Reformulado a lo que el arnés prueba: `decide` no se llama (sección 7) |
| CA-4 no falla primero; faltan guardas de las operativas | Etiquetado como guarda de regresión; dos pruebas nuevas (sección 7) |
| CA-5 condicional no aprobable; archivo existe | CA-5 y U-2 retirados; ticket NK-0041 (secciones 7, 12 y 14) |
| Sin precedente de Radix Dialog en jsdom | Riesgo y primera comprobación de U-1 (secciones 13 y 14) |
| §16.3 ya se puede cerrar | Cerrada con la tabla del gate (sección 14) |
| Citas de línea desplazadas | Corregidas |
| Un solo `ExecuteDialog` en la raíz, con snapshot de la fila | Nota técnica (sección 13) |
| Aviso: el checkout no contiene F3 | La rama de trabajo sale de `dcea201` (sección 13) |
| Nivel: sin U-2 el alcance sí es corto | Coherente tras retirar U-2 |

Nota del ledger: NK-0039 quedó registrado como duplicado de NK-0038 por la heurística de similitud, sin serlo; el hueco del servidor es NK-0041.

## 18. Delta de implementación (lo rellena el agente al entregar)
Sin entrega todavía.
