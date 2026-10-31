# SDD-20261101-price-suggestions-visibility-server · [Bug] Las sugerencias de precio llegan por el resumen de Telegram, se pueden decidir sin el rol y dejan una memoria visible

**Tipo:** Bug · **Prioridad propuesta:** Media (toca permisos; hoy hay 0 sugerencias de precio en la base: ver sección 3)
**Estado:** Borrador · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-11-01
**PRD:** No aplica (bug) · **Depende de:** — · **Ticket:** NK-0042. Quedan fuera: protección en la base de datos, que incluye leer y decidir desde el navegador (NK-0044, necesita migración), y ampliar la regla a otras causas del detector de precio (NK-0045).
**SDD que corrige:** CA-57 y CA-58 de `SDD-20261027-strategic-suggestions-engine` (lo que no puedes ver en pantalla no te llega por Telegram); CA-19 ya figura como «Hecho» para la pantalla.

> Un SDD dice cómo se verifica que está bien hecho. Cada criterio de aceptación (CA-n) debe poder tener una prueba automática que lo nombre.
> Nivel elegido: SDD corto, sin PRD. La tabla de `nokko-shape` solo pide SDD si el bug toca esquema, RLS o datos; este toca permisos (quién ve y decide qué) y Fede decidió el 2026-11-01 mantenerlo como SDD corto.

## 1. Resumen
Las sugerencias de precio (detector `strategy_product_price` con causa `price:`) solo deben verlas Owner, Sales Leader y Deal Desk. La lista, el tablero, la herramienta del agente y el correo diario ya lo respetan. Pero el resumen diario de Telegram las lista y ofrece «Hecho n» a cualquier persona vinculada, `decideSuggestionCore` deja decidir una por su id sin comprobar el rol, y decidirla guarda una memoria de empresa con su título que leen todos los miembros. Este SDD cierra esas tres rutas del servidor.

## 2. Problema y para quién
Una persona sin rol de precios que tenga Telegram vinculado puede recibir en su resumen diario una sugerencia de precio (con su título) y aceptarla desde allí. Quien conozca el id puede aceptarla, aplazarla o descartarla. Y cuando alguien con rol la decide, la memoria que se guarda (por ejemplo «Descartado por el equipo: … descuento del 20 %») la leen todos los miembros y llega al agente.

## 3. Evidencia y por qué ahora
Leído el 2026-11-01 sobre `origin/main` (`a930805`); no reproducido **[Por verificar]**. Salió de la segunda pasada del gate del SDD de NK-0041 y de la primera del propio SDD.
- Regla: `needsPriceAccess`, `PRICE_ROLES = ["owner","sales_leader","deal_desk"]` y `canViewStrategy` en `src/lib/strategy-suggestions.ts` (~417-427). Es de precio si `detector === "strategy_product_price"` y su `dedupe_key` empieza por `strategy_product_price:price:`.
- Aplicada hoy en: lista y tarjeta (`src/components/suggestions.tsx`), tablero (`suggestion-board.tsx`), `list_suggestions` del agente (`src/lib/agent/tools/core-read.ts:185-188`) y, con un filtro de texto para **todos** los roles, el correo diario (`src/lib/daily-email.server.ts:37`: `not("dedupe_key","like","strategy_product_price:price:%")`).
- **Resumen diario de Telegram** (`sendDigests`, `src/routes/api/public/jobs/proactive.ts:245-251`): selecciona pendientes de la empresa y la asignación, sin filtrar por prioridad ni por rol. La sugerencia de precio sale con prioridad 3 (`src/lib/proactive/detectors/strategy-product.ts:26`; `reconcile` la conserva), así que entra en el top 3 si hay menos de 3 más, y `digestMessage` ofrece «Hecho n» (aceptar) porque no necesita formulario.
- **Aviso urgente** (`notifyUrgent`, `proactive.ts:177-222`): filtra `priority = 1` (línea 197), así que **hoy no puede recibir una sugerencia de precio** (son de prioridad 3). Puede recibir de otras causas del detector (ver 5, NK-0045).
- **`decideSuggestionCore`** (`src/lib/agent.functions.ts:290` en adelante): no comprueba el rol; `canActOnSuggestion` (`src/lib/suggestion-board.ts:7`) solo mira la asignación. Lo llaman Telegram (`s:<id>:…`, `webhook.ts:63`) y la herramienta `decide_suggestion` (`inbox.ts:65-68`); `decidePending` llega a ella de forma indirecta, vía `executeTool`.
- **Memoria**: tras decidir, `rememberDecision` (`agent.functions.ts:331-334`, `src/lib/memory.ts:76-78`) guarda una memoria de ámbito `company` con el título de la sugerencia. `activeFor` (`memory.server.ts:13`) solo excluye las de ámbito `user`, y la política de lectura de `memories` (`0042_memories.sql:24`) es «empresa o propia»: la leen todos los miembros y entra en el contexto del agente.
- Medido el 2026-10-31 y el 2026-11-01 en la base de Lovable (solo recuentos): las 3 sugerencias estratégicas que existen son de tipo `data_to_complete`; **ninguna es de precio**. El gate no pudo consultar la base.

## 4. Resultado buscado
- Una sugerencia de precio no se lista ni se ofrece por Telegram a quien no puede verla, no se puede decidir por id sin el rol, y decidirla no deja una memoria legible por todos.
- Medición: las pruebas de CA-1 a CA-5 pasan en `main`. Línea base de sugerencias de precio afectadas: 0 (sección 3).

## 5. Alcance
**Incluye:** `decideSuggestionCore` (comprobación de rol y no guardar memoria de precio); `sendDigests` y `notifyUrgent` (filtro por rol en la propia consulta).
**No incluye** (límite que el brief copia a «Movimientos prohibidos»):
- Migraciones, RLS, `drizzle/`. Residual de base de datos, ticket NK-0044: la política de `suggestions` deja a cualquier miembro **leer** esas filas desde el navegador, y `decide_strategy_suggestion` está concedida a `authenticated`, es SECURITY INVOKER, no mira el rol y recibe `p_by` del cliente: quien vea la fila puede **decidirla** desde el navegador con `rpc`. Este SDD no promete cerrarlo. `strategy_decisions.reason` es de texto libre y visible por la misma RLS.
- Otras causas del detector (`review:` de la revisión estratégica con IA y `experiment:` de las propuestas de experimento, que pueden ser de `product_price`): no están protegidas en ninguna pantalla ni ruta, y las de prioridad 1 sí pueden entrar en el aviso urgente. Decisión de Fede el 2026-11-01: no ampliar la regla ahora; ticket NK-0045.
- Cambiar quién ve precios (`PRICE_ROLES`) ni `canViewStrategy`; el correo diario, la lista, el tablero y el agente, que ya cumplen (el correo excluye por literal, como hoy).
- El conteo «Detecté N asuntos nuevos» (`briefing.ts:32`, Inicio y correo), que suma sugerencias de precio: es un número, se deja.

## 6. Cambios de comportamiento (delta)
**Añadido:** comprobación de rol en `decideSuggestionCore`; filtro por rol en las consultas de Telegram; no se guarda memoria al decidir una sugerencia de precio.
**Modificado:** el resumen y el aviso urgente de Telegram dejan de incluir las sugerencias de precio para quien no tiene el rol.
**Eliminado:** la memoria de empresa que se creaba al decidir una sugerencia de precio.

## 7. Historias y criterios de aceptación
### H-1: Como Owner, quiero que las sugerencias de precio solo las vean y decidan quienes tienen rol de precios, para no filtrar precios a quien no debe.
- **CA-1** CUANDO `decideSuggestionCore` recibe cualquier decisión (aceptar, aplazar o descartar) sobre una sugerencia de precio de una persona sin ninguno de los roles `owner`, `sales_leader` o `deal_desk`, el sistema DEBE lanzar «Sugerencia no encontrada» y NO DEBE registrar nada; la comprobación DEBE ir antes de la de «Ya estaba gestionada», para no revelar que existe cuando ya está decidida · prueba: `src/lib/decide-suggestion.test.ts` *(ampliar: la fixture `strat()` debe traer `detector: "strategy_product_price"` y `dedupe_key: "strategy_product_price:price:…"`; incluye el caso de una de precio ya decidida)*
- **CA-2** CUANDO la persona tiene alguno de esos roles, el sistema DEBE decidir como hoy · prueba: `src/lib/decide-suggestion.test.ts` *(guarda de regresión, no falla primero)*. Limitación conocida, como hoy: `deal_desk` no está en los roles que ven al equipo (`canSeeTeam`), así que no decide una de precio asignada a otra persona.
- **CA-3** El resumen diario de Telegram NO DEBE incluir sugerencias de precio para una persona vinculada sin esos roles, y el filtro DEBE aplicarse en la propia consulta, antes de `limit`, para que las filtradas no ocupen los huecos del top 3; para el resto sigue igual · prueba: *(por nombrar)* función pura que construya el filtro en `src/lib/telegram-suggestions.ts` (probada con roles con y sin permiso) más una prueba estructural de `proactive.ts`, como la de `proactive.test.ts:711-721`, que exija que la consulta del resumen lo use. La lectura de roles se hace en una consulta por lote a `org_members` antes del bucle; un fallo al leerlos se trata como sin permiso.
- **CA-4** El aviso urgente aplica el mismo filtro, de forma defensiva: hoy no recibe filas de precio (prioridad 3) · prueba: la misma prueba estructural; **es una guarda**, no falla primero sobre datos reales.
- **CA-5** CUANDO se decide una sugerencia de precio (con rol), el sistema NO DEBE guardar memoria de la decisión; para el resto de sugerencias la guarda como hoy · prueba: `src/lib/decide-suggestion.test.ts` *(ampliar; falla primero: hoy se guarda)*

## 8. Casos límite y errores
- Persona con varios roles, o con rol en otra empresa: se usan los roles de la empresa actual.
- Persona sin roles cargados o error al leerlos: sin permiso, no con él.
- Una sugerencia de precio asignada a quien no tiene el rol: no se le muestra ni puede decidir; sigue disponible para quien tenga el rol.
- Botones de Telegram ya enviados con una sugerencia de precio: a quien no tenga el rol le responden «No se ha podido hacer. Sugerencia no encontrada» (Telegram añade ese prefijo, `webhook.ts:63`, a cualquier error).
- Una sugerencia de precio que ninguna persona vinculada con rol recibe: se queda sin aviso por Telegram; el efecto es el buscado.
- `notified_at` no se toca en este SDD: el filtro va en la consulta, antes de enviar y de marcar.
- Otra empresa: toda lectura sigue filtrada por `org_id`.

## 9. Experiencia y copy
Sin textos nuevos. La respuesta de CA-1 es la misma que da hoy una sugerencia que no existe.

## 10. Datos, permisos y privacidad
Sin tablas ni columnas nuevas, sin cambios de RLS ni GRANTs. El filtro es de aplicación, no de base de datos (ver 5). Las memorias de decisiones de precio que ya se hubieran guardado no se borran aquí (hoy 0 casos). Ningún dato de clientes en pruebas: sugerencias y roles ficticios.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| Ninguna | — | — | — |

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | `decideSuggestionCore`: comprobación de rol (antes de «ya gestionada») y sin memoria de precio | CA-1, CA-5 (CA-2 guarda) | `src/lib/decide-suggestion.test.ts` |
| U-2 | Telegram: filtro por rol en el resumen y en el aviso urgente, en la consulta | CA-3, CA-4 | `src/lib/telegram-suggestions.test.ts` *(por nombrar)* y `src/lib/proactive.test.ts` |

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- En `decideSuggestionCore`, la comprobación `canViewStrategy(s, ctx.roles)` va justo después de leer la fila y de `canActOnSuggestion`, antes de `s.status !== "pending"`.
- Roles en Telegram: una consulta por lote a `org_members` (`org_id`, `user_id in (…)`, `role`) antes del bucle. No usar `channelCtx` para esto: cuesta unas 3 consultas más por persona y devuelve `null` si no hay membresía, con lo que esa persona se quedaría sin ningún aviso.
- El filtro de precio debe salir de un helper común en `src/lib/strategy-suggestions.ts` (el prefijo `strategy_product_price:price:` y `PRICE_ROLES` en un solo sitio), usado por `canViewStrategy`, las consultas de Telegram y, más adelante, el correo diario; no copiar el literal.
- Filtrar en la consulta (`.not("dedupe_key","like", …)` cuando la persona no tiene el rol), no en memoria después de `limit(3)` y `limit(50)`.
- `org-data.ts:163` pone `notified_at = null` al reabrir una sugerencia: puede provocar un reenvío legítimo a quien sí tiene el rol.
- Alternativa descartada: ocultar las de precio en la base con una política o vista (NK-0044): exige migración y el destino de la base sigue sin decidir.

## 14. Riesgos y dependencias
- El filtro de servidor no protege la lectura ni la decisión directa desde el navegador mientras no cambien la RLS ni la función de decisión (NK-0044).
- Las propuestas de la revisión con IA y de experimentos sobre precio del producto siguen sin protección (NK-0045); la revisión con IA acaba de quedar disponible en la base (migración 0072 aplicada el 2026-11-01).
- La consulta de roles por lote añade una consulta al trabajo periódico; sin dato de cuántas personas hay vinculadas.

## 15. Preguntas para Fede y para la revisión técnica
**Decididas por Fede el 2026-11-01** (todas con la recomendación del autor):
1. **Memoria.** Decidir una sugerencia de precio no guarda memoria (CA-5), en este SDD.
2. **Alcance de la regla.** No se amplía ahora a otras causas del detector de precio; ticket NK-0045.
3. **Nivel.** Se mantiene como SDD corto.

4. **P-1.** El error para quien no tiene el rol es «Sugerencia no encontrada» (como una inexistente), no un aviso de «no tienes acceso»: no confirma que exista una sugerencia de precio.
5. **P-2.** La protección en la base (NK-0044) se hace después de decidir el destino de la base: exige migración y hoy no hay ninguna sugerencia de precio.

(P-1 y P-2: Fede pidió el 2026-11-01 «resuelve» y se resolvieron con la recomendación del autor; Fede puede cambiarlas al aprobar.)

**Siguen abiertas:** ninguna.

## 16. Pendiente de verificar
1. Reproducir el hueco del resumen diario con una persona sin rol y Telegram vinculado: nadie lo ha hecho; solo hay lectura de código.
2. Cuántas personas vinculadas por empresa hay (coste de leer roles): sin dato.
3. Que el texto de «No se ha podido hacer. Sugerencia no encontrada» es lo que ve la persona: lo dice el código leído (`webhook.ts:63`), sin ejecutar.
4. Que la interfaz no muestra `strategy_decisions.reason` a quien no tiene el rol: no se ha revisado (NK-0044).

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Un agente `nokko-gate` con contexto fresco lee este SDD y el código, y devuelve su informe. El coordinador lo copia aquí sin editarlo. El gate no aprueba el SDD: informa; la aprobación es de Fede.
- Veredicto del gate: Objeciones en la primera pasada (2026-11-01, copiada abajo); el texto se reescribió después (tabla de respuesta del autor); falta una segunda pasada.
- CA sin prueba posible o sin G-n: pendiente
- [Por verificar] que sigue sin comprobarse: pendiente
- Contradicciones con el código o con decisiones previas: pendiente
- Lo que esta revisión NO demuestra: pendiente

### Primera pasada del gate (2026-11-01), copiada sin editar
Lectura sobre `origin/main` `a930805`. Entre `992effd` y `a930805` solo cambian 2 archivos de `docs/`, así que las líneas valen para ambos. Es revisión por lectura de código. No ejecutó tests ni `gate.mjs`, y no tuvo acceso a la base.

**Veredicto: Objeciones.** El hueco real existe, pero el SDD lo describe con un error de fondo: el aviso urgente de Telegram hoy no puede enviar una sugerencia de precio.

1. **`notifyUrgent` filtra `priority = 1`** (`proactive.ts:197`). La única fuente de filas `price:` es `productRepeatedDiscount`, con `priority: 3` (`detectors/strategy-product.ts:26`). `reconcile` conserva `found.priority` (`strategy-suggestions.ts:400`).
   - Hoy el aviso urgente no recibe sugerencias de precio.
   - Por eso la historia de §2 («si la recibe primero ella, la empresa pierde el aviso») y la mitad de CA-3 describen algo inalcanzable con los datos actuales.
   - El §3 omite el filtro `priority = 1` al describir la selección.
2. **La exposición real es el resumen diario.** `sendDigests` (`proactive.ts:245-251`) no filtra por prioridad, así que una sugerencia de precio de prioridad 3 entra en el top 3 si hay menos de 3 más. Además, `digestMessage` ofrece «Hecho n» (`approve`) porque la sugerencia de precio no necesita formulario.
3. **`decideSuggestionCore` es un hueco real.**
   - No hay comprobación de rol en `agent.functions.ts:290`, y `canActOnSuggestion` (`suggestion-board.ts:7`) solo mira la asignación.
   - El fallo de CA-1 sobre `origin/main` se deduce del código, no se ejecutó.
4. **«No se puede decidir sin el rol» sobrepromete.** `decide_strategy_suggestion` está concedida a `authenticated` (`0073_strategy_decisions_guard.sql:~87`, la línea GRANT).
   - Es SECURITY INVOKER y no mira el rol de precios. Además `p_by` lo pone el cliente (`0068_…sql:111` y `0073:62`).
   - Quien vea la fila por RLS (`0013_suggestions_team_visibility.sql`) puede decidirla desde el navegador con `rpc`.
   - El residual de §3 solo habla de leer. Debe decir también «decidir», y el título y el §4 no deben prometer cerrarlo.
   - Esto sale de leer las migraciones. No lo probó.
5. **El filtro tras el `limit` puede dejar sin aviso a quien no tiene el rol** (detalle abajo, en el punto 5 de las respuestas). Si se filtra en memoria, las filas filtradas siguen ocupando los 3 huecos de `notifyUrgent` y se repiten en cada ejecución.

**CA sin prueba posible o mal etiquetados**
- **CA-1**: probable y fallaría hoy.
  - El `fakeDb` de `decide-suggestion.test.ts:24-55` ya permite comprobar que no hay `rpc` ni `remember` (precedente en `:160-168`).
  - La fixture `strat()` no trae `dedupe_key`, así que el test nuevo debe añadir `detector: "strategy_product_price"` y `dedupe_key: "strategy_product_price:price:…"`.
  - Falta un caso: una sugerencia de precio ya gestionada (`status != pending`) debe devolver «no encontrada», no «Ya estaba gestionada» (`:292`). Si la comprobación va después de ese `if`, filtra la existencia. El SDD no fija el orden y el CA tampoco lo cubre.
- **CA-2**: bien etiquetado como guarda.
  - Hay un caso límite: `deal_desk` no está en `LEADER_ROLES`, así que no decide una sugerencia de precio asignada a otra persona. Es «como hoy», pero contradice el §8 («sigue visible para el equipo con rol»).
- **CA-3**: no es probable con la prueba nombrada.
  - Una función pura de filtrado no prueba «no marcar `notified_at`», que ocurre en la ruta (`proactive.ts:215-218`).
  - Con un test sobre función nueva, «falla antes» solo por import ausente, lo que no cumple la regla 5.
  - Hace falta fijar primero el comportamiento actual, como hizo NK-0041, o un test estructural como `proactive.test.ts:711-721`. Ese test exige exactamente 3 `select` de `suggestions` con `strategy`. Añadir `detector,dedupe_key` o leer roles desde `org_members` no lo rompe. Un cuarto `select` de `suggestions` sí.
  - Además, hoy el aviso urgente nunca recibe filas de precio, así que el CA no falla sobre datos reales. Hay que etiquetarlo como guarda o aclarar que el fallo es solo por función ausente.
- **CA-4**: la función pura es probable, pero el cableado en la ruta queda sin prueba. Mismo comentario sobre la regla 5.
- **P-1 y §8**: la respuesta es «no encontrada» pero Telegram la envuelve como «No se ha podido hacer. Sugerencia no encontrada» (`webhook.ts:63`). El SDD (§3.9) dice que es literalmente el mismo texto que la inexistente. Aclara el prefijo.

**[Por verificar] que sigue sin comprobarse**
- **«Hoy hay 0 sugerencias de precio» y el hueco no ha afectado a nadie**: no pudo consultar la base. Sigue como declaración del autor. El §3 lo da por «medido» pero no lo verificó.
- **Reproducción del hueco**: nadie lo ha reproducido.
- **Número de personas vinculadas por empresa**: sigue sin dato.
- **Que ninguna otra ruta lleve la sugerencia a quien no tiene el rol** (§16.3): la verificó por lectura y hay rutas no cubiertas (punto 3 de las respuestas).

**Contradicciones**
- **«SDD que corrige: CA-19»**: el motivo del Telegram es CA-57 y CA-58 del SDD padre (mismas reglas de rol y «si no puedo verla en pantalla, no mostrármela en Telegram»). El padre ya registra CA-19 como «Hecho» (`SDD-20261027…:261`) y admite que el correo excluye todo precio por falta de rol (`:265`). Cita CA-57/58 como los CA incumplidos. «Decidir sin rol» no está en CA-19: el SDD lo amplía.
- **§3, «Ese núcleo lo usan … `decidePending`»**: `decidePending` (`agent.functions.ts:117-161`) no llama a `decideSuggestionCore`. Llama a `executeTool`, que puede llegar a `decide_suggestion` (`inbox.ts:65-68`). Está cubierto por U-1 pero de forma indirecta. El SDD hermano (NK-0041) repite la misma imprecisión.
- **«Correo diario … la excluye»**: la exclusión (`daily-email.server.ts:37`) es para todos, también para quien sí tiene el rol, y copia el literal en vez de reutilizar `canViewStrategy`. Choca con la regla del §13 («no copiar `PRICE_ROLES`»). Si la solución de `notifyUrgent` y `sendDigests` usa también ese `not(... like ...)`, repetirá el mismo problema.
- **Lo que el §5 deja fuera, pero afecta**: la regla `needsPriceAccess` solo cubre causas `price:`. Otras filas con el detector `strategy_product_price` no están protegidas en ninguna ruta, ni en pantalla:
  - La revisión estratégica con IA (`strategy-review.ts:240-245`, causa `review:<hash>`, prioridad 1/2/3 elegida por la IA; se guarda con `strategy-review-db.ts:97`).
  - Las propuestas de experimento (`experiments.ts:89-90`, causa `experiment:<id>`, prioridad 2, elemento `product_price` posible).
  - Las de prioridad 1 sí entran en `notifyUrgent`. Esto debería ser una pregunta P-3 o un residual explícito.
- **Otras rutas no previstas por el SDD**:
  - **`rememberDecision`** (`agent.functions.ts:331-334` y `memory.ts:76-78`): decidir una sugerencia de precio, ya con el rol, guarda una memoria de ámbito `company` con el título («Descartado por el equipo: «Producto X» se repite con descuento del 20 %…»). `activeFor` (`memory.server.ts:13`) solo excluye memorias `user`, y la política de lectura de `memories` (`0042_memories.sql:24`) es «company/account or own». Llega a cualquier miembro y al prompt del agente, aunque U-1 funcione. Es la ruta más clara que el SDD no ve.
  - **Conteo**: `autoWork` (`briefing.ts:32`) suma las sugerencias de precio en «Detecté N asuntos nuevos» en Inicio (`briefing.tsx:30`) y en el correo (`daily-email.server.ts:29`). Es solo un número. Probablemente aceptable, pero va al residual.
  - **`strategy_decisions`**: la RLS exige que se pueda ver la sugerencia (`0068:~88`), no el rol. El texto libre `reason` queda a la vista del navegador. No verificó si la interfaz lo muestra.
  - **Revisados sin hallazgo**: `refreshSuggestions` (`agent.functions.ts:246-251`) solo devuelve `{ok:true}`. `assign_suggestion` (`inbox.ts:72-95`) es solo owner y sales_leader, que tienen el rol. El MCP (`mcp/context.ts:19`, `agent-tools.ts:138-149`) usa roles correctos, y `list_suggestions` filtra (`core-read.ts:185-188`). El resumen semanal (`weekly-report.server.ts:30`) no lee sugerencias.

**Respuestas a (4), (5), (7) y (8)**
- **(4) Sin migración**: es implementable. Leer roles cuesta, por persona, +1 consulta a `org_members` (`org_id`, `user_id`, `role`), o una sola consulta por lote con `in(user_id, …)` antes del bucle.
  - Reutilizar `channelCtx` (`channel-ctx.server.ts:6-16`) cuesta +3 consultas por persona, de las que `profiles` ya está leída en el bucle y `organizations` sobra.
  - Además devuelve `null` si no hay membresía, así que la persona quedaría sin ningún aviso, no solo sin los de precio. Es un cambio de comportamiento que el SDD no prevé y que contradice el §8.
  - Su recomendación es consulta propia y por lote, no `channelCtx`.
  - El §8 («error al leer roles = sin permiso») solo se puede cumplir ahí, con la consulta propia.
  - En la ruta de decisión, `userCtx` y `channelCtx` ya lanzan o devuelven `null` si no leen roles, así que ese caso no llega al núcleo.
- **(5) `notified_at` sin marcar**: es correcto, pero solo si el filtro va en la consulta o antes de `limit(3)` y `limit(50)`.
  - Si se filtra en memoria después, las filas sin marcar de precio siguen ocupando los huecos de quien no tiene el rol cada hora (`proactive.ts:192-200`).
  - No hay reenvíos repetidos a quien no tiene el rol: se filtra antes de enviar. Un caso de borde es una sugerencia asignada a esa persona, que no recibe nadie y se relee siempre (`:199`), pero sin daño si el filtro va en la consulta.
  - `org-data.ts:163` pone `notified_at = null` al reabrir, lo que podría provocar un reenvío legítimo a quien sí tenga el rol.
- **(7) Nivel de documentación**: por la tabla de `nokko-shape` (`SKILL.md` §1), un «bug que no toca esquema, RLS ni datos» es «solo ticket con `nokko-brief` y test que falla primero», sin SDD. El SDD justifica el nivel con «toca permisos» (línea 9), un criterio que la tabla no lista.
  - La ambigüedad es genuina: es privacidad de datos de negocio.
  - Si Fede mantiene el SDD corto, el alcance es coherente (2 unidades). Pero crecerá si entran las rutas de los puntos anteriores. Decisión de Fede.
- **(8) «Sugerencia no encontrada»**: sí, es lo que lanza hoy (`agent.functions.ts:291`).
  - Un id no uuid o un error de base también produce `data` nulo, y el mismo texto.
  - Se ve en Telegram con prefijo, y en `decide-suggestion.test.ts:183` ya hay una prueba.

**Lo que esta revisión NO demuestra**
- No ejecutó ningún test, ni `gate.mjs` ni `flake.mjs` (es un SDD, no código). El fallo de CA-1 en `origin/main` es deducción por lectura.
- No consultó ninguna base: ni el recuento de sugerencias de precio, ni RLS, grants o políticas reales. Las conclusiones sobre el RPC y la política de `memories` salen del texto de las migraciones, no de la base aplicada.
- No leyó `src/components/` completo ni `strategy_decisions` en la interfaz.
- No comparó las 18 secciones con la plantilla `docs/factory/templates/sdd.md`.
- No midió el coste real de las consultas extra en el trabajo periódico ni su límite de tiempo.
- No comprobó que Telegram o la interfaz muestren exactamente los textos descritos más allá de lo que dice el código.

### Respuesta del autor a la primera pasada (2026-11-01)
Texto del autor, no del gate. Decisiones de Fede el 2026-11-01 en la sección 15.

| Objeción | Dónde queda |
|---|---|
| El aviso urgente no puede recibir precio (`priority = 1`); la exposición real es el resumen diario | Reescrito: secciones 1, 2, 3 y 7; CA-3 es el resumen; CA-4 es defensivo y se declara guarda |
| `decideSuggestionCore` sin rol; orden respecto a «ya gestionada» | CA-1 fija el orden y pide el caso de una ya decidida |
| «No se puede decidir sin el rol» sobrepromete (RPC concedida a `authenticated`) | Residual explícito en la sección 5 y NK-0044; el título y el resultado ya no lo prometen |
| Filtrar tras el `limit` deja sin hueco | CA-3 y sección 13: filtro en la consulta, antes de `limit` |
| CA-3 no probable con función pura; regla 5 | Función pura más prueba estructural como la de `proactive.test.ts:711-721`; CA-4 como guarda |
| Fixture sin `dedupe_key` | CA-1 lo exige |
| `deal_desk` y `canSeeTeam` | Limitación conocida en CA-2 |
| «No encontrada» llega con prefijo por Telegram | Sección 8 |
| CA-57/58 como CA incumplidos, no CA-19 | Cabecera corregida |
| `decidePending` no llama al núcleo | Sección 3: llega vía `executeTool` |
| El correo copia el literal para todos los roles | Sección 3 y 5; helper común en la sección 13 |
| Otras causas del detector sin protección | Decidido: no ampliar ahora, NK-0045 (secciones 5 y 15) |
| `rememberDecision` guarda una memoria legible por todos | Decidido: se cierra aquí, CA-5 (secciones 1, 3 y 7) |
| Conteo «Detecté N asuntos nuevos»; `strategy_decisions.reason` | Residual explícito (sección 5) |
| `channelCtx` cuesta más y devuelve `null` sin membresía | Consulta por lote a `org_members` (sección 13) |
| Nivel de documentación | Decidido: se mantiene el SDD corto (cabecera y sección 15) |

## 18. Delta de implementación (lo rellena el agente al entregar)
Sin entrega todavía.
