# SDD-20261101-price-suggestions-rls · [Bug] La base deja a cualquier miembro leer y decidir las sugerencias de precio desde el navegador

**Tipo:** Bug (permisos, con migración) · **Prioridad propuesta:** Media (hoy hay 0 sugerencias de precio: ver sección 3)
**Estado:** Aplazado (Fede, 2026-11-01): no se construye hasta decidir el destino de la base · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-11-01
**PRD:** No aplica (bug) · **Depende de:** NK-0042 (ya en `main`: filtro de servidor) · **Ticket:** NK-0044
**SDD que completa:** `SDD-20261101-price-suggestions-visibility-server` (NK-0042), que dejó fuera esta protección por exigir migración.

> Un SDD dice cómo se verifica que está bien hecho. Cada criterio de aceptación (CA-n) debe poder tener una prueba automática que lo nombre.
> Nivel elegido: SDD corto, con una migración (0074). Toca RLS, así que según la tabla de `nokko-shape` exige SDD.

## 1. Resumen
Las sugerencias de precio solo deben verlas y decidirlas Owner, Sales Leader y Deal Desk. NK-0042 lo aplica en el servidor (Telegram, `decideSuggestionCore`, memoria), pero la política de seguridad de `suggestions` deja a cualquier miembro que vea la fila leerla desde el navegador, y decidirla con la función `decide_strategy_suggestion`. Este SDD mueve la regla a la base de datos con una migración que cambia dos políticas de `suggestions` y una de `strategy_changes`.

## 2. Problema y para quién
Un miembro sin rol de precios puede, con el cliente del navegador, leer el título y el cuerpo de una sugerencia de precio y aceptarla, aplazarla o descartarla, saltándose el filtro de la aplicación. También ve en las propuestas de Inbox que existe una propuesta de «Producto y precio».

## 3. Evidencia y por qué ahora
Leído el 2026-11-01 sobre `origin/main` (`b22cafd`); no probado contra una base **[Por verificar]**. Salió del gate de NK-0042.
- Política de lectura de `suggestions` (`drizzle/migrations/0013_suggestions_team_visibility.sql`): `org_id = current_org() AND is_org_member(org_id) AND (user_id IS NULL OR user_id = auth.uid() OR owner OR sales_leader)`. No distingue sugerencias de precio. La de actualización tiene el mismo `USING` y `WITH CHECK`.
- `decide_strategy_suggestion` (0068, reescrita en 0073) es SECURITY INVOKER: su `UPDATE` pasa por esa política. Si la fila no se puede leer, el `UPDATE` afecta a 0 filas y la función devuelve `NULL`.
- `strategy_decisions` ya depende de la visibilidad de la sugerencia: su política de lectura exige `EXISTS (SELECT 1 FROM suggestions …)`, que se evalúa con la política de `suggestions` de quien consulta (0068:86-88).
- `strategy_changes` y `strategy_links`: política de lectura de toda la empresa, sin rol (`0070_strategy_execution.sql:50-51`). Aceptar una sugerencia de precio con rol crea una fila en `strategy_changes` con elemento `product_price` que cualquier miembro ve en Inbox («Producto y precio · Pendiente de confirmar»): revela que existe y cuándo, sin título ni valores.
- La sincronización de sugerencias con el cliente del usuario inserta con `upsert(…, { onConflict: "org_id,dedupe_key", ignoreDuplicates: true })` (`src/lib/strategy-core.ts:144-151`): un conflicto con una fila oculta se ignora, no falla **[Por verificar]** con una prueba real.
- Regla de precio: `PRICE_DETECTOR`, `PRICE_DEDUPE_PREFIX` (`strategy_product_price:price:`) y `PRICE_ROLES = owner, sales_leader, deal_desk` en `src/lib/strategy-suggestions.ts`.
- Medido el 2026-11-01 en la base de Lovable (solo recuentos): 0 sugerencias de precio, 0 cambios propuestos. No hay datos que migrar ni que ocultar hoy.

## 4. Resultado buscado
- Un miembro sin rol de precios no puede leer ni decidir una sugerencia de precio con el cliente del navegador, ni ve las propuestas de producto y precio.
- Medición: las pruebas de CA-1 a CA-6 pasan en una base PGlite con la migración aplicada. Línea base: 0 filas afectadas.

## 5. Alcance
**Incluye:** la migración `0074_price_suggestions_rls.sql` (políticas de `suggestions` y de `strategy_changes`), su prueba PGlite y la entrada del `_journal.json`.
**No incluye** (límite que el brief copia a «Movimientos prohibidos»):
- Aplicar la migración en la base de Lovable: la aplica Fede o el coordinador con su OK, tras el gate (sección 13).
- Ampliar la regla a otras causas del detector de precio (NK-0045).
- Cambiar `PRICE_ROLES`, el filtro de servidor de NK-0042 o la interfaz.
- Ocultar el conteo «Detecté N asuntos nuevos» ni los datos de `strategy_links` (solo ids).
- Borrar o cambiar filas existentes: la migración no reescribe datos.

## 6. Cambios de comportamiento (delta)
**Añadido:** la política de lectura y de actualización de `suggestions` excluye las de precio para quien no tiene `owner`, `sales_leader` ni `deal_desk`; la de lectura de `strategy_changes` excluye el elemento `product_price` para esos mismos roles.
**Modificado:** nada más; los demás permisos de `suggestions` y `strategy_changes` quedan como están.
**Eliminado:** nada.

## 7. Historias y criterios de aceptación
### H-1: Como Owner, quiero que la base impida a un miembro sin rol de precios leer o decidir una sugerencia de precio, para que no dependa de la aplicación.
- **CA-1** CUANDO un usuario `authenticated` sin ninguno de los roles `owner`, `sales_leader` o `deal_desk` consulta `suggestions`, NO DEBE recibir las filas de precio (`detector = 'strategy_product_price'` y `dedupe_key LIKE 'strategy_product_price:price:%'`), aunque sean suyas o no tengan asignada a nadie · prueba: `src/lib/strategy-price-rls.pg.test.ts` *(por crear, PGlite, como `strategy-f0.pg.test.ts`)*
- **CA-2** CUANDO el usuario tiene alguno de esos roles, DEBE leerlas como hoy (sujeto a la visibilidad por asignación de 0013) · prueba: mismo archivo *(guarda de regresión, no falla primero)*
- **CA-3** CUANDO un usuario sin esos roles llama a `decide_strategy_suggestion` sobre una de precio, la función DEBE devolver `NULL` y NO DEBE crear ninguna decisión ni cambiar el estado · prueba: mismo archivo
- **CA-4** CUANDO un usuario sin esos roles consulta `strategy_decisions` o `strategy_changes`, NO DEBE ver las decisiones de sugerencias de precio ni los cambios con elemento `product_price` · prueba: mismo archivo
- **CA-5** CUANDO un usuario sin esos roles ejecuta la sincronización de sugerencias estratégicas (insertar con `ON CONFLICT DO NOTHING` sobre una clave de precio ya existente), NO DEBE fallar ni crear duplicados · prueba: mismo archivo
- **CA-6** `service_role` y `postgres` NO DEBEN verse afectados: leen y deciden como hoy (trabajos, Telegram, cron) · prueba: mismo archivo *(guarda)*

## 8. Casos límite y errores
- Persona con varios roles: basta uno de los tres.
- La sugerencia de precio asignada a quien no tiene el rol: tampoco la lee (CA-1).
- Tras revocar el rol a alguien: deja de ver las de precio en la siguiente consulta.
- Una de precio ya decidida: igual de oculta para quien no tiene el rol.
- La aplicación (NK-0042) sigue filtrando en el servidor: la política es una segunda capa, no sustituye al filtro.
- Otra empresa: toda política sigue filtrada por `org_id`/`current_org()`.

## 9. Experiencia y copy
Sin textos nuevos. Para quien no tiene el rol, una sugerencia de precio deja de existir en pantalla, como ya ocurre con el filtro de la aplicación.

## 10. Datos, permisos y privacidad
Una migración que reescribe políticas (`DROP POLICY` + `CREATE POLICY`), sin tablas ni columnas nuevas, sin reescribir filas y sin tocar GRANTs. Rollback: volver a crear las políticas de 0013 y 0070 (se deja el guion comentado al final de la migración, como 0073). Ningún dato de clientes en pruebas: filas y roles ficticios.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| Ninguna | — | — | — |

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | Migración `0074_price_suggestions_rls.sql` y entrada en `_journal.json` (sin aplicarla en ninguna base real) | CA-1 a CA-6 | `src/lib/strategy-price-rls.pg.test.ts` |

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- Propuesta de SQL (el autor la escribe y la prueba; no se aplica a mano):
  - `DROP POLICY "org read"` y `"org update"` de `suggestions` y recrearlas añadiendo, en `USING` y en `WITH CHECK`, `AND (NOT (detector = 'strategy_product_price' AND dedupe_key LIKE 'strategy_product_price:price:%') OR has_org_role(org_id,'owner') OR has_org_role(org_id,'sales_leader') OR has_org_role(org_id,'deal_desk'))`.
  - `DROP POLICY "org read"` de `strategy_changes` y recrearla con `AND (element <> 'product_price' OR (los tres roles))`.
  - Política de inserción de `suggestions` («org insert»): el gate debe decir si hace falta cambiarla; la sincronización inserta con el cliente del usuario.
- Numeración: `0074` sigue a `0073` (`origin/main`); comprobar `_journal.json` y los números reservados por otras ramas antes de fijarla.
- Aplicación en producción: la base de Lovable no usa `drizzle-kit migrate` (la última vez se aplicó pegando el SQL con el conector); se aplica tras el gate, con comprobación previa (la función y las políticas vivas coinciden con 0013 y 0070) y posterior (políticas nuevas, 0 filas cambiadas), y una prueba con un usuario sin rol dentro de una transacción que se descarta, como en 0073.
- Alternativa descartada: una vista que oculte las filas y quitar el acceso a la tabla; cambia demasiado de la aplicación.

## 14. Riesgos y dependencias
- Una política mal escrita puede ocultar sugerencias que no son de precio o romper `refreshSuggestions` para los miembros: lo cubren CA-2, CA-5 y las pruebas existentes de la suite, y el gate debe pasar `strategy-f0.pg.test.ts` y `migrations.pg.test.ts` con la migración.
- Las políticas de `suggestions` pueden haber cambiado en la base viva respecto a 0013 (se aplicaron a mano migraciones fuera del registro): se comprueba antes de aplicar.
- Las propuestas de otras causas del detector (`review:`, `experiment:`) siguen sin protección (NK-0045).
- Aplicar una migración a la base de Lovable es una acción sobre producción: la hace Fede o el coordinador con su OK explícito.

## 15. Preguntas para Fede y para la revisión técnica
- **P-1.** ¿La migración se aplica en cuanto pase el gate, o esperas a decidir el destino de la base? **Recomiendo aplicarla cuando pase el gate:** hoy no hay ninguna sugerencia de precio, así que el riesgo de datos es nulo, y la protección sigue la regla que ya aprobaste.
- **P-2.** ¿Se oculta también el elemento `product_price` de `strategy_changes` (CA-4)? **Recomiendo sí:** es lo que hoy revela que existe una propuesta de precio.

## 16. Pendiente de verificar
1. Que las políticas vivas de `suggestions` y `strategy_changes` en la base de Lovable son las de 0013 y 0070: se comprueba antes de aplicar.
2. Que el cliente del usuario puede insertar en `suggestions` sin conflicto con filas ocultas (CA-5), con una prueba real.
3. Que el valor del elemento es exactamente `product_price` en `strategy_changes` y que no hay otro elemento relacionado con precio.
4. Que `has_org_role` acepta `deal_desk` (el tipo `app_role`): 0070 ya lo usa.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Un agente `nokko-gate` con contexto fresco lee este SDD y el código, y devuelve su informe. El coordinador lo copia aquí sin editarlo. El gate no aprueba el SDD: informa; la aprobación es de Fede.
- Veredicto del gate: Objeciones (primera pasada, 2026-11-01, copiada abajo): 2 bloqueantes y 3 importantes. El texto no se corrigió: Fede aplazó el SDD tras el informe.
- CA sin prueba posible o sin G-n: pendiente
- [Por verificar] que sigue sin comprobarse: pendiente
- Contradicciones con el código o con decisiones previas: pendiente
- Lo que esta revisión NO demuestra: pendiente

### Primera pasada del gate (2026-11-01), copiada sin editar
Revisado sobre `origin/main` en `b22cafd21d21b6496fe9f769029318a8208c3f81`. Solo lectura sobre el repo y las bases: no editó, no commiteó y no ejecutó migraciones del repo. Sí ejecutó una sonda propia en memoria con PGlite (no es una base real), `scratchpad/gate44/probe.mjs`. Reproduce las políticas de 0007, 0013 y 0070 más las propuestas en §13, con usuarios ficticios. Es un modelo mínimo, no el esquema real.

**Veredicto: Objeciones (bloqueantes: 2; importantes: 3).** La política propuesta en §13 oculta bien las filas de precio, pero rompe dos flujos que hoy funcionan. Ninguno está cubierto por los CA y uno desmiente un [Por verificar] del SDD.

**B-1. La sincronización de un miembro sin rol falla (respuesta a la duda sobre `ON CONFLICT DO NOTHING`).**
- Con la política propuesta, `INSERT ... ON CONFLICT DO NOTHING` falla con `42501` cuando la fila propuesta es de precio. Falla aunque no haya conflicto y aunque no haya `RETURNING`. El motivo es que `ON CONFLICT` exige que la fila nueva cumpla la política de lectura. Lo ve en la sonda; no lo confirmó contra la documentación de PostgreSQL.
- Prueba en la sonda (PGlite 0.5.11, PostgreSQL 18.6; versión de la base de Lovable: sin dato): clave de precio existente y oculta: `42501`; clave de precio nueva: `42501`; lote con una fila de precio y otra no: `42501`, y no entra ninguna; lote sin filas de precio: entra.
- `refreshSuggestions` (`src/lib/agent.functions.ts:246-250`) hace `detect(snap)` sin filtrar por rol. Un miembro sin rol tiene, por tanto, candidatos de precio en cada refresco. Su fila existente está oculta, así que `syncStrategySuggestions` (`src/lib/strategy-core.ts:122-134`) la trata como «insert».
- El `upsert` de `strategy-core.ts:144-151` no comprueba el error. El lote entero se pierde en silencio, también las sugerencias estratégicas que no son de precio.
- Hoy hay 0 sugerencias de precio, pero este fallo no depende de filas existentes: salta en cuanto el detector encuentre un candidato.
- El SDD afirma lo contrario en §3 («se ignora, no falla») y en §16.2. Es falso con el SQL propuesto. CA-5 describe el comportamiento correcto, pero el SQL de §13 no lo cumple.
- Con «org insert» sin tocar, también pasa esto (mismo efecto que una política permisiva que se suma): un miembro sin rol puede insertar filas de precio (la sonda lo confirma sin `RETURNING`: inserta 1 fila y se vuelve invisible para él); esa fila la ven luego Owner, Sales Leader y Deal Desk como si fuera legítima (suplantación); y un `INSERT` simple con la clave de otra fila oculta devuelve `23505`, así que hay un oráculo de existencia (la clave lleva el id del producto).
- Opciones, a decidir: (a) cambio de código: que `syncStrategySuggestions` descarte los candidatos de precio si el usuario no tiene rol, y que compruebe el error del `upsert`; (b) un disparador `BEFORE INSERT` en la propia migración que devuelva `NULL` cuando un miembro sin rol inserta una fila de precio. Probó (b) en la sonda: el lote entra sin las filas de precio y sin error, y el `INSERT` simple con clave duplicada devuelve 0 filas (no `23505`). La opción (a) cambia el alcance de la sección 5 («solo migración»). La (b) lo mantiene.

**B-2. Ocultar `strategy_changes.element = 'product_price'` rompe «Aceptar» para causas que no son de precio.**
- `element = 'product_price'` no equivale a «sugerencia de precio». `productUnsold` emite `catalog:unsold:…` con el mismo elemento (`src/lib/proactive/detectors/strategy-product.ts:75`). Esa sugerencia no es de precio según `needsPriceAccess` y NK-0042 la deja visible. `review:` y `experiment:` (NK-0045) también pueden ser de `product_price`.
- `proposeChange` (`src/lib/strategy-execute-core.ts:47-50`) inserta en `strategy_changes` con `.select("id").single()`, es decir, con `RETURNING`. Con la política propuesta, el `INSERT ... RETURNING` falla con `42501` para el miembro sin rol (lo ve en la sonda; la política de inserción de 0070:53 sí lo deja pasar sin `RETURNING`).
- Esa persona acepta `catalog:unsold` y la decisión ya queda registrada en `decide_strategy_suggestion`. Después `proposeChange` lanza «No pude guardar la propuesta» (`strategy-execute-core.ts:51`) y queda aceptada sin propuesta. Un reintento tampoco encuentra la fila oculta (`strategy-execute-core.ts:43`).
- Contradice además el SDD padre, que dice que los roles sin permiso ven la propuesta y no la aplican (F3-2 y CA-38).
- La regla debe colgar de la sugerencia de origen, no del elemento. Lo limpio es una función `SECURITY DEFINER` estable, `is_price_suggestion(suggestion_id)`, y `strategy_changes` oculta cuando es de precio y el usuario no tiene rol. P-2 está mal planteada: pregunta por el elemento y no por la causa.

**I-1. «org insert».** Sí deja insertar filas de precio a un miembro sin rol (`0007_agent_proactive_channels.sql:99`: solo `is_org_member`). Sí importa, por la suplantación y el oráculo descritos en B-1. Cualquiera de las dos opciones de B-1 lo resuelve; el SDD debe decirlo en vez de dejarlo como pregunta abierta en §13.

**I-2. `DROP POLICY` y `CREATE POLICY` en dos pasos.** Si la aplicación pegada con el conector no es atómica, hay una ventana sin política de lectura en `suggestions` (fail-closed: nadie lee). `ALTER POLICY` o una transacción explícita la evitan. §13 debe exigirlo.

**I-3. Numeración 0074 ocupada.** `feat/money-notices` (NK-0030, estado PROMOTED, no fusionada, 6 commits por delante de `main`) ya tiene `0074_money_moment_notices.sql`. Su `_journal.json` usa `idx` 73 y `when` 1793836000000. Hoy `main` termina en 0073 (`idx` 71, `when` 1793706400000) y 0072 (`idx` 72, `when` 1793749600000). El orden manda `when`, no el número. `migrations-journal.ts` rechaza dos archivos con el mismo número, y `src/lib/AGENTS.md:57` dice que quien fusiona segundo renumera y re-estampa. El SDD debe fijar quién toma 0074 y que el `when` de la nueva entrada supere 1793749600000, y 1793836000000 si money-notices entra antes.

**CA sin prueba posible o sin etiqueta correcta (regla 5).** El harness `src/test/pg-harness.ts` replica `auth.uid()`, `current_org()`, `is_org_member`, `has_org_role` y `service_role` con `bypassrls`. Todos los CA se pueden probar en PGlite. Pero: CA-5 pasa hoy y no falla primero (es guarda; con el SQL de §13 fallaría después de la migración, y eso es lo que debe detectar: un lote con una fila de precio y otra no, hecho por un miembro sin rol). CA-1, CA-3 y CA-4 fallan hoy y son válidos (hace falta sembrar usuarios `sales_leader` y `deal_desk`, que `seed` no trae). CA-2 y CA-6 están bien etiquetados como guarda. La réplica de `strategy-f0.pg.test.ts:66-68` no es fiel a 0013 (su «org update» tiene un `WITH CHECK` solo con `is_org_member`): el test debe ejecutar los archivos reales (0013, 0068, 0070, 0073 y la nueva) y no copiar políticas a mano. Faltan CA: `UPDATE` directo de una fila de precio debe afectar 0 filas; `WITH CHECK` (mover una fila visible a clave de precio debe fallar); aceptar `catalog:unsold` sin rol debe seguir funcionando de punta a punta; un miembro sin rol no puede insertar una fila de precio ni obtener `23505`; revocar el rol corta el acceso. §8 «Persona con varios roles» no es posible: `org_members` tiene `unique (org_id, user_id)` y una sola columna `role`.

**[Por verificar] que sigue sin comprobarse:** las políticas vivas en la base de Lovable (en el repo solo hay tres políticas en `suggestions`, «org read», «org insert» y «org update», y ninguna `FOR ALL` ni para `anon`; cualquier política extra permisiva anularía la restricción: debe listarse `pg_policy` antes de aplicar); Realtime (el repo no publica `suggestions`; la base viva no se consultó); las cifras de la sección 3 (0 sugerencias de precio, 0 cambios), no comprobadas por el gate.

**Otras rutas de lectura:** `strategy_links` (lectura de toda la empresa; muestra `created_by` y `created_at`, no «solo ids»); `strategy_decisions` (se oculta sola por 0068:86-88); `strategy_changes.values` y `base` (hoy `{}` en las manuales; un detector futuro con carga de precio quedaría legible por todos); `memories` (NK-0042 ya no guarda memoria de precio); `strategy_reviews` (solo Owner y Sales Leader, más estricto); el conteo «Detecté N» de Inicio sale del navegador y cambiará con la RLS, el del correo no (quedarán dos números distintos); el `LIKE` con guion bajo solo sobreoculta.

**Contradicciones.** Con NK-0042, decisión 5 de §15: la protección en base se hace después de decidir el destino de la base; el P-1 de este SDD recomienda aplicar al pasar el gate sin citar esa decisión. El argumento de P-1 («riesgo de datos nulo») omite B-1 y B-2: el riesgo es de comportamiento y aparece con el primer candidato de precio, no con filas existentes. Con el SDD padre: F3-2 y CA-38 dicen que el rol sin permiso ve la propuesta; ocultar todo `product_price` lo contradice para `catalog:unsold`.

**Lo que esta revisión NO demuestra:** el comportamiento de la base de Lovable (políticas, GRANTs, versión de PostgreSQL, publicación Realtime y las cifras de la sección 3); cómo se comporta PostgREST ni supabase-js (asumió que `upsert` con `ignoreDuplicates` genera `ON CONFLICT DO NOTHING` sin `RETURNING`); que el JWT real de Supabase dé el mismo `auth.uid()` que el harness; que las políticas finales sean correctas (no existen todavía y probó solo versiones suyas); no ejecutó `strategy-f0.pg.test.ts`, `migrations.pg.test.ts` ni la suite del repo; no es aprobación.

### Decisión de Fede (2026-11-01): aplazar
Tras el informe del gate, Fede decidió **no construir NK-0044 por ahora**, hasta decidir el destino de la base (recomendación del autor, coherente con la decisión 5 de la sección 15 del SDD de NK-0042). Razones: la política propuesta **rompe dos flujos que hoy funcionan** (B-1 y B-2); arreglarlo exige un disparador y una función de base de datos nuevos; el número 0074 lo ocupa `feat/money-notices` (NK-0030); hoy hay 0 sugerencias de precio, el servidor ya filtra desde NK-0042 y la herramienta es interna. El ticket NK-0044 sigue abierto en el ledger como `LOGGED`.

**Diseño corregido que dejó el gate, para cuando se reabra** (no está probado contra la base real):
1. **No ocultar solo la lectura.** Con solo cambiar las políticas de lectura y actualización, la sincronización de un miembro sin rol falla entera con `42501` (`ON CONFLICT DO NOTHING` exige que la fila nueva cumpla la política de lectura). Añadir un disparador `BEFORE INSERT` en `suggestions` que devuelva `NULL` cuando un miembro sin rol inserte una fila de precio: el gate lo probó en PGlite y el lote entra sin las filas de precio, sin error y sin el oráculo `23505`. También evita que un miembro sin rol inserte filas de precio suplantadas.
2. **`strategy_changes` por causa, no por elemento.** Ocultar `element = 'product_price'` rompe «Aceptar» en sugerencias que no son de precio (`catalog:unsold`). La regla debe colgar de la sugerencia de origen mediante una función `SECURITY DEFINER` estable, `is_price_suggestion(suggestion_id)`.
3. **Atómica.** `ALTER POLICY` o una transacción explícita, no `DROP POLICY` y `CREATE POLICY` separados.
4. **Numeración y `_journal.json`:** fijar el número (0074 lo tiene `feat/money-notices`) y que el `when` supere 1793749600000, y 1793836000000 si money-notices entra antes.
5. **Pruebas PGlite:** ejecutar los archivos reales de migración (0013, 0068, 0070, 0073 y la nueva), sembrar `sales_leader` y `deal_desk`, y añadir los CA que faltan: `UPDATE` directo de una fila de precio, `WITH CHECK`, aceptar `catalog:unsold` sin rol de punta a punta, inserción de precio y `23505`, y revocar el rol. Quitar «persona con varios roles» (`org_members` es único por `(org_id, user_id)`).
6. **Aplicar en la base de Lovable:** listar `pg_policy` antes y exigir las tres políticas de `suggestions` conocidas, probar con un usuario sin rol en una transacción que se descarta y comprobar que su sincronización no falla.
7. P-1 y P-2 se reformulan: citar la decisión de NK-0042 y preguntar por causa, no por elemento.

## 18. Delta de implementación (lo rellena el agente al entregar)
Sin entrega todavía.
