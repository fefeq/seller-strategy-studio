# SDD-20261101-price-suggestions-visibility-server · [Bug] Las sugerencias de precio llegan por Telegram y se pueden decidir sin tener el rol

**Tipo:** Bug · **Prioridad propuesta:** Media (toca permisos; hoy hay 0 sugerencias de precio en la base: ver sección 3)
**Estado:** Borrador · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-11-01
**PRD:** No aplica (bug) · **Depende de:** — · **Ticket:** NK-0042. La protección a nivel de base de datos queda fuera: NK-0044 (necesita migración).
**SDD que corrige:** CA-19 de `SDD-20261027-strategic-suggestions-engine` (una sugerencia de precio solo la leen los roles que pueden ver precios).

> Un SDD dice cómo se verifica que está bien hecho. Cada criterio de aceptación (CA-n) debe poder tener una prueba automática que lo nombre.
> Nivel elegido: SDD corto, sin PRD. Toca permisos (quién ve y decide qué), pero no esquema ni RLS.

## 1. Resumen
Las sugerencias de precio (detector `strategy_product_price` con causa `price:`) solo deben verlas Owner, Sales Leader y Deal Desk (CA-19). La lista, el tablero, la herramienta del agente y el correo diario ya lo respetan. Pero Telegram las envía a cualquier persona vinculada de la empresa, y `decideSuggestionCore` deja decidir una por su id sin comprobar el rol. Este SDD aplica la misma regla en esas dos rutas del servidor.

## 2. Problema y para quién
Una persona sin rol de precios que tenga Telegram vinculado puede recibir una sugerencia de precio, y si la recibe primero ella, la empresa pierde el aviso para quien sí debía verlo. Además, quien conozca el id puede aceptarla, aplazarla o descartarla.

## 3. Evidencia y por qué ahora
Leído el 2026-11-01 sobre `origin/main` (`992effd`); no reproducido **[Por verificar]**. Salió de la segunda pasada del gate del SDD de NK-0041.
- Regla: `needsPriceAccess`, `PRICE_ROLES = ["owner","sales_leader","deal_desk"]` y `canViewStrategy` en `src/lib/strategy-suggestions.ts` (~línea 417-427). Una sugerencia es de precio si `detector === "strategy_product_price"` y su `dedupe_key` empieza por `strategy_product_price:price:`.
- Aplicada hoy en: la lista y la tarjeta (`src/components/suggestions.tsx`), el tablero (`src/components/suggestion-board.tsx`), `list_suggestions` del agente (`src/lib/agent/tools/core-read.ts`), y el correo diario, que la excluye con `not("dedupe_key","like","strategy_product_price:price:%")` (`src/lib/daily-email.server.ts`).
- **No aplicada** en: el aviso urgente de Telegram (`notifyUrgent`, `src/routes/api/public/jobs/proactive.ts:177-222`) ni el resumen diario (`sendDigests`, desde la línea 227). Ambos seleccionan por empresa, estado y asignación (`user_id is null` o la persona), no por rol. El aviso marca `notified_at` tras enviar, así que solo recibe cada sugerencia la primera persona vinculada que el bucle encuentre.
- **No aplicada** en `decideSuggestionCore` (`src/lib/agent.functions.ts`): `canActOnSuggestion` (`src/lib/suggestion-board.ts:7`) solo mira la asignación (`!s.user_id || s.user_id === userId || canSeeTeam(roles)`). Ese núcleo lo usan Telegram (`s:<id>:…`), la herramienta `decide_suggestion` del agente y `decidePending`.
- Contexto con roles disponible: `channelCtx` (`src/lib/channel-ctx.server.ts`) devuelve `roles`.
- Medido el 2026-10-31 en la base de Lovable (solo recuentos): las 3 sugerencias estratégicas que hay son de tipo `data_to_complete`; **ninguna es de precio**. El hueco no ha afectado a nadie todavía.
- **Residual que este SDD no cierra:** la política RLS de `suggestions` deja a cualquier miembro leer las filas visibles para él desde el navegador; el filtro de precio es de interfaz y de servidor, no de base de datos. Cerrarlo exige una migración (NK-0044).

## 4. Resultado buscado
- Una sugerencia de precio no se envía por Telegram a quien no puede verla, ni consume su aviso, y no se puede decidir por id sin el rol.
- Medición: las pruebas de CA-1 a CA-4 pasan en `main`. Línea base de sugerencias de precio afectadas: 0 (sección 3).

## 5. Alcance
**Incluye:** `decideSuggestionCore`; `notifyUrgent` y `sendDigests` (con una función pura de filtrado en `src/lib/telegram-suggestions.ts`).
**No incluye** (límite que el brief copia a «Movimientos prohibidos»):
- Migraciones, RLS, `drizzle/`; una política o vista que oculte las de precio en la base (NK-0044).
- Cambiar quién puede ver precios (`PRICE_ROLES`) ni `canViewStrategy`.
- El correo diario, la lista, el tablero y el agente: ya cumplen.
- Otros detectores estratégicos o sugerencias operativas.

## 6. Cambios de comportamiento (delta)
**Añadido:** comprobación de rol en `decideSuggestionCore` y en los avisos de Telegram para las sugerencias de precio.
**Modificado:** el aviso urgente y el resumen filtran por el rol de cada persona vinculada antes de enviar y antes de marcar `notified_at`.
**Eliminado:** nada.

## 7. Historias y criterios de aceptación
### H-1: Como Owner, quiero que las sugerencias de precio solo las vean y decidan quienes tienen rol de precios, para no filtrar precios a quien no debe.
- **CA-1** CUANDO `decideSuggestionCore` recibe cualquier decisión sobre una sugerencia de precio de una persona sin ninguno de los roles `owner`, `sales_leader` o `deal_desk`, el sistema DEBE responder como si no existiera («Sugerencia no encontrada») y NO DEBE registrar nada · prueba: `src/lib/decide-suggestion.test.ts` *(ampliar; aceptar, aplazar y descartar)*
- **CA-2** CUANDO la persona tiene alguno de esos roles, el sistema DEBE decidir como hoy · prueba: `src/lib/decide-suggestion.test.ts` *(guarda de regresión, no falla primero)*
- **CA-3** El aviso urgente de Telegram NO DEBE enviar una sugerencia de precio a una persona vinculada sin esos roles, y NO DEBE marcar `notified_at` por ello, de modo que una persona con rol aún pueda recibirla; para el resto de sugerencias sigue igual · prueba: `src/lib/telegram-suggestions.test.ts` o `src/lib/proactive.test.ts` *(por nombrar; función pura de filtrado)*
- **CA-4** El resumen diario de Telegram NO DEBE listar una sugerencia de precio a quien no tiene esos roles; el resto sigue igual · prueba: mismo archivo *(por nombrar)*

## 8. Casos límite y errores
- Persona con varios roles, o con rol en otra empresa: se usan los roles de la empresa actual (`ctx.roles`, el contexto que ya resuelve `channelCtx`).
- Persona sin roles cargados (error al leerlos): trata como sin permiso, no como con él.
- Una sugerencia de precio asignada a quien no tiene el rol (asignación previa o manual): no se le muestra ni deja decidir; sigue visible para el equipo con rol.
- Botones de Telegram ya enviados antes del cambio con una sugerencia de precio: responden «Sugerencia no encontrada» a quien no tenga el rol.
- Otra empresa: toda lectura sigue filtrada por `org_id`.

## 9. Experiencia y copy
Sin textos nuevos. La respuesta de CA-1 es la que ya da una sugerencia que no existe: «Sugerencia no encontrada».

## 10. Datos, permisos y privacidad
Sin tablas ni columnas nuevas, sin cambios de RLS ni GRANTs. Solo se añaden lecturas de roles ya disponibles en el contexto. El filtro es de aplicación, no de base de datos (ver 3, residual). Ningún dato de clientes en pruebas: sugerencias y roles ficticios.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| Ninguna | — | — | — |

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | `decideSuggestionCore` comprueba `canViewStrategy` con los roles del contexto | CA-1 (CA-2 guarda) | `src/lib/decide-suggestion.test.ts` |
| U-2 | Telegram: filtrado por rol en el aviso urgente y el resumen, con función pura | CA-3, CA-4 | `src/lib/telegram-suggestions.test.ts` *(por nombrar)* |

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- `decideSuggestionCore` ya recibe `ctx.roles`; la comprobación va junto a `canActOnSuggestion` y lanza el mismo error de «no encontrada».
- En `notifyUrgent` y `sendDigests` hay que leer los roles de cada persona vinculada. Opciones: llamar a `channelCtx` (ya lo usa el webhook) o leer `org_members` para esa persona y empresa; el gate debe validar cuál cuesta menos consultas y no rompe la ejecución del trabajo.
- El filtro de CA-3 debe ir antes del envío y antes del `update notified_at`: si no, una persona sin rol consume el aviso de las demás.
- Una sola regla: reutilizar `canViewStrategy`; no copiar `PRICE_ROLES`.
- Alternativa descartada: ocultar las de precio en la base con una política o vista (NK-0044), porque exige migración y el destino de la base sigue sin decidir.

## 14. Riesgos y dependencias
- El filtro de servidor no protege la lectura directa desde el navegador mientras RLS no cambie (NK-0044).
- Leer los roles de cada persona vinculada añade consultas al trabajo periódico; pocas personas hoy (sin dato de cuántas hay vinculadas).
- `notifyUrgent` marca `notified_at` global por sugerencia; con el filtro, una sugerencia de precio puede quedar sin enviar si ninguna persona vinculada tiene el rol: efecto buscado.

## 15. Preguntas para Fede y para la revisión técnica
- **P-1.** ¿El error para quien no tiene el rol es «Sugerencia no encontrada» (igual que una que no existe) o un aviso explícito de «no tienes acceso»? **Recomiendo «no encontrada»:** no confirma que existe una sugerencia de precio.
- **P-2.** ¿La protección en la base (NK-0044) se hace después de decidir el destino de la base? **Recomiendo sí:** exige migración y hoy no hay ninguna sugerencia de precio.

## 16. Pendiente de verificar
1. Reproducir el hueco con una persona sin rol y Telegram vinculado: nadie lo ha hecho; solo hay lectura de código.
2. Cuántas personas vinculadas por empresa hay (coste de leer roles en el trabajo periódico): sin dato.
3. Que ninguna otra ruta del servidor (por ejemplo el MCP, las acciones pendientes del agente) lleve una sugerencia de precio a quien no tiene el rol.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Un agente `nokko-gate` con contexto fresco lee este SDD y el código, y devuelve su informe. El coordinador lo copia aquí sin editarlo. El gate no aprueba el SDD: informa; la aprobación es de Fede.
- Veredicto del gate: No revisado
- CA sin prueba posible o sin G-n: pendiente
- [Por verificar] que sigue sin comprobarse: pendiente
- Contradicciones con el código o con decisiones previas: pendiente
- Lo que esta revisión NO demuestra: pendiente

## 18. Delta de implementación (lo rellena el agente al entregar)
Sin entrega todavía.
