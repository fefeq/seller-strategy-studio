# SDD-20261101-company-linkedin-reread-with-user-client · [Mejora] `companyLinkedin` comprueba con el cliente de la persona antes de escribir con el cliente admin

**Tipo:** Mejora (el ledger la registró como feature) · **Prioridad propuesta:** Baja (defensa en profundidad; riesgo aceptado por Fede mientras tanto)
**Estado:** Aplazado (Fede, 2026-11-01): no se construye por ahora · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-11-01
**PRD:** No aplica (mejora acotada) · **Depende de:** — · **Ticket:** NK-0037
**Decisión previa:** Fede decidió el 2026-10-29 que `companyLinkedin` guarde con el cliente admin, siempre filtrado por el `org_id` de la cuenta (SDD `field-sources-on-tracked-writers`, U-4), y el 2026-10-31 aprobó este ticket como SDD corto con gate propio.

> Un SDD dice cómo se verifica que está bien hecho. Cada criterio de aceptación (CA-n) debe poder tener una prueba automática que lo nombre.
> Nivel elegido: SDD corto, sin PRD. Cambia quién autoriza una escritura con el cliente de servicio, sin tocar esquema ni RLS.

## 1. Resumen
Cuando `companyLinkedin` encuentra la página de LinkedIn de una cuenta, la guarda con el cliente admin (que salta RLS). La cuenta le llega ya cargada por quien la llama, pero la función no vuelve a comprobar con el cliente de la persona que esa cuenta existe y es suya antes de escribir. Este SDD añade esa lectura previa con el cliente que recibe, y si no ve la cuenta, no escribe.

## 2. Problema y para quién
La escritura con el cliente de servicio confía en el `id` y el `org_id` que trae el objeto `acc`. Hoy todos los llamadores lo cargan con `loadAccount` (cliente del llamador y filtro de empresa), así que no hay un fallo conocido. Pero un llamador futuro o una cuenta que cambie entre la carga y la escritura (por ejemplo, borrada o movida) podría llevar al cliente admin a escribir donde la persona no tiene acceso.

## 3. Evidencia y por qué ahora
Leído el 2026-11-01 sobre `origin/main` (`b1ab55c`); no reproducido **[Por verificar]**.
- `src/lib/apify-core.ts:80-139` (`companyLinkedin(_db, acc)`): busca con `searchBoth`; carga `supabaseAdmin`; lee `linkedin_url,field_sources` filtrando por `org_id` e `id`; si hay un valor escrito por una persona, devuelve la URL sin guardar; si no, escribe con el cliente admin también filtrado por `org_id` e `id`. El primer parámetro, el cliente de quien llama, se llama `_db` y **no se usa**.
- Llamadores: `linkedinForReading` (`apify-core.ts:63-71`), `accountPostsCore` (`:177-186`) y los núcleos que cargan la cuenta con `loadAccount(db, accountId, scope)` (`apify-core.ts:44-51`), que usa el cliente del llamador y `inOrg(scope)`. Usan estos núcleos las pantallas (`src/lib/apify.functions.ts`), las herramientas del agente (`src/lib/agent/tools/linkedin.ts`) y `src/lib/ai-core.ts:102`.
- NK-0022 dejó el filtro por `org_id` en la lectura y la escritura admin, y una prueba de «la cuenta ya no está en esta empresa» (el filtro de la **escritura** está cubierto; el de la **lectura** admin sobrevive a una mutación, NK-0036).
- Qué cliente pasa cada llamador (de la persona o admin): **[Por verificar]** (los trabajos y Telegram usan el cliente de servicio; si `_db` ya es admin, la comprobación no añade protección).

## 4. Resultado buscado
- `companyLinkedin` no escribe con el cliente admin si el cliente que recibe no ve la cuenta.
- Medición: las pruebas de CA-1 a CA-3 pasan en `main`. Casos afectados hoy: sin dato (no hay fallo conocido).

## 5. Alcance
**Incluye:** `companyLinkedin` en `src/lib/apify-core.ts` y sus pruebas.
**No incluye** (límite que el brief copia a «Movimientos prohibidos»):
- Cambiar el cliente que usan los llamadores, `loadAccount`, el filtro por `org_id` ni el uso del cliente admin (decisión de Fede del 2026-10-29).
- Migraciones, RLS, `drizzle/`.
- Los menores del gate de NK-0022 (incluida la prueba del filtro `org_id` de la lectura admin): NK-0036.
- Otros escritores con el cliente admin.

## 6. Cambios de comportamiento (delta)
**Añadido:** lectura previa de la cuenta con el cliente recibido, antes de cualquier escritura admin.
**Modificado:** si esa lectura no devuelve la cuenta, la función devuelve la URL encontrada sin guardarla.
**Eliminado:** nada.

## 7. Historias y criterios de aceptación
### H-1: Como Owner, quiero que el cliente de servicio solo escriba en cuentas que el cliente de quien llama también ve, para que una cuenta ajena no se modifique por error.
- **CA-1** CUANDO el cliente recibido no devuelve la cuenta (por no existir, no ser visible o dar error), `companyLinkedin` NO DEBE escribir con el cliente admin y DEBE devolver la URL encontrada · prueba: `src/lib/apify-core.test.ts` *(ampliar)*
- **CA-2** CUANDO el cliente recibido sí ve la cuenta, el sistema DEBE comportarse como hoy (guardar con origen web, sin confirmar; no pisar un valor de persona) · prueba: `src/lib/apify-core.test.ts` *(guarda de regresión, no falla primero)*
- **CA-3** La lectura previa DEBE ir filtrada por el `id` y el `org_id` de la cuenta · prueba: `src/lib/apify-core.test.ts` *(ampliar)*

## 8. Casos límite y errores
- La cuenta ya no está en la empresa entre la carga y la escritura: sin cambios, lo cubre el aviso actual («la cuenta ya no está en esta empresa»).
- Cliente de servicio como cliente recibido (trabajos, Telegram): la lectura previa pasa y el efecto es el de hoy; la comprobación no protege en ese caso.
- Sin búsqueda con resultado: sin cambios, sale antes.
- Otra empresa: toda lectura y escritura sigue filtrada por `org_id`.

## 9. Experiencia y copy
Sin textos nuevos.

## 10. Datos, permisos y privacidad
Sin tablas ni columnas nuevas, sin cambios de RLS ni GRANTs. Una lectura más, con el cliente de quien llama, de una cuenta que ya podía leer. Ningún dato de clientes en pruebas: cuentas ficticias.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| Ninguna (la búsqueda web existente no cambia) | — | — | — |

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | Lectura previa con el cliente recibido y no escribir si no ve la cuenta | CA-1, CA-3 (CA-2 guarda) | `src/lib/apify-core.test.ts` |

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- El parámetro `_db` de `companyLinkedin(_db, acc)` pasa a usarse; el comentario «The client the caller passes is not used here (kept for callers)» deja de ser cierto y se actualiza.
- La lectura previa va antes de `searchBoth` o justo antes del cliente admin, lo que cueste menos peticiones; el gate decide. Si va después de la búsqueda, no se ahorra el coste de Apify; si va antes, se gasta una lectura aunque ya hubiera URL guardada (`saved` sale antes de todo).
- Reutilizar el patrón de `loadAccount` (`inOrg` con el `AiScope`), sin copiarlo.

## 14. Riesgos y dependencias
- Valor bajo si todos los llamadores ya cargan la cuenta con el cliente de la persona: es defensa en profundidad.
- No protege cuando el cliente recibido es el de servicio.
- Una lectura más por cada búsqueda que acabe en escritura: coste despreciable.

## 15. Preguntas para Fede y para la revisión técnica
- **P-1.** ¿Si el cliente de la persona no ve la cuenta, la función devuelve la URL sin guardar (CA-1) o lanza `LinkedinSaveError`? **Recomiendo devolver la URL sin guardar:** es lo que hace ya cuando un valor es de persona, y quien solo lee la página no pierde el resultado.
- **P-2.** ¿Se hace ahora, o primero se revisa qué cliente pasa cada llamador? **Recomiendo revisar a la vez, en el brief:** el autor lista qué cliente pasa cada llamador y, si todos son de servicio, se para y se te cuenta.

## 16. Pendiente de verificar
1. Qué cliente pasa cada llamador de `companyLinkedin` (persona o servicio): sin comprobar.
2. Reproducir un caso en que el objeto `acc` no coincida con lo que ve la persona: nadie lo ha hecho.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Un agente `nokko-gate` con contexto fresco lee este SDD y el código, y devuelve su informe. El coordinador lo copia aquí sin editarlo. El gate no aprueba el SDD: informa; la aprobación es de Fede.
- Veredicto del gate: Objeciones (primera pasada, 2026-11-01, copiada abajo). No se corrigió el texto: Fede aplazó el SDD tras el informe.
- CA sin prueba posible o sin G-n: pendiente
- [Por verificar] que sigue sin comprobarse: pendiente
- Contradicciones con el código o con decisiones previas: pendiente
- Lo que esta revisión NO demuestra: pendiente

### Primera pasada del gate (2026-11-01), copiada sin editar
Revisó `origin/main` en `b1ab55c`. No ejecutó tests ni `gate.mjs`: no hay código que probar, solo el SDD.

**Veredicto: Objeciones.** Hay tres objeciones de fondo y una menor; no hay objeciones sobre el resto. El §16.1 queda respondido y la respuesta es mixta, no «todos de servicio». Sobre el código, la mejora tiene valor real pero estrecho.

**O-1. El SDD choca con dos tests de `apify-core.test.ts` que ya existen y no los menciona.**
- `src/lib/apify-core.test.ts:193-205`, «saves and reads with the admin client, never with the client it was given (CA-8, decision of Fede)», pasa un `Proxy` que lanza al tocar cualquier propiedad. Con la lectura previa, ese test falla.
- `:165-172` usa el mismo `fakeDb` como cliente recibido y como admin, con `readError`, y espera `rejects.toThrow("read failed")`. Con CA-1 y P-1 recomendada (devolver la URL sin lanzar), la primera lectura falla antes y devuelve la URL, así que ese test también falla.
- `:117` y `:204` afirman `["select","update"]`. Pasarían a tener un `select` más.
- La regla 6 dice que el gate no debilita aserciones. El SDD debe nombrar estos tests como «se reescriben» (la inversión del `:193` es el cambio de la decisión de Fede, con su OK explícito) y listarlos en §5 y §12.
- `src/lib/AGENTS.md:55` dice «reads and saves with the admin client». También hay que actualizarlo, y el §13 solo menciona el comentario del código.

**O-2. P-1 está mal planteada y su recomendación contradice NK-0022.**
- La analogía «es lo que hace ya cuando un valor es de persona» es falsa. Ese caso es una no-escritura legítima. «No veo la cuenta» o «error de lectura» es una anomalía.
- El código actual trata las anomalías equivalentes lanzando `LinkedinSaveError(msg, url)` (`apify-core.ts:103-108` y `:133-138`). Con eso, `linkedinForReading` (`:64-71`) ya devuelve la URL a quien solo lee.
- NK-0022 CA-8 exige «no ignorar el error del guardado», y el test `:239-243` («does not hide a failed save») lo fija.
- Devolver la URL en silencio, sobre todo ante un error transitorio del cliente de la persona, esconde un fallo. Lo coherente es lanzar `LinkedinSaveError(…, url)` y mantener la URL en el error. Ahí CA-1 cambia de «devolver la URL» a «lanzar con la URL».

**O-3. El §3 y el §2 tienen afirmaciones erróneas o incompletas.**
- `src/lib/ai-core.ts:102` no pasa por `companyLinkedin`. Solo importa `profilePosts` (`:100-105`), que no llama a `companyLinkedin`. Hay que quitarlo de la lista.
- Falta `linkedinSignalItems` (`apify-core.ts:212-215`), que llama a `linkedinForReading` con un `acc` que no sale de `loadAccount`. Lo carga `refreshSignalsCore` en `web-research-core.ts:95`. Es el camino con más llamadores, y ninguno está citado.
- El §2 dice que una cuenta «borrada o movida» entre la carga y la escritura podría llevar al admin a escribir donde no debe. Eso ya lo cubre la lectura admin filtrada por `org_id` e `id` (`:96-108`) y la escritura (`:130-138`). Es el propio caso del §8, primer punto. Lo único que la lectura previa añade es esto: membresía revocada en esa ventana; cambio de empresa activa (`current_org()`); un futuro llamador con un `acc` fabricado.
- Líneas del SDD: `apify-core.ts:80-139` es en realidad `:80-140`, y `:63-71` es `:64-71`. Son off-by-one sin importancia.

**Menor.** NK-0022 SDD:186 ya advertía de que, si cambia la empresa activa entre la lectura y la escritura, el cliente de persona afecta a 0 filas. La mejora lo reintroduce para los llamadores de persona: la URL se descarta y la siguiente llamada vuelve a buscar y a gastar Apify. Falta en §8.

**(1) Afirmaciones de la sección 3, comprobadas:** correctas las de `_db` sin uso (línea 80; comentario en `:78`), la lectura y escritura admin (`:95-132`), `loadAccount` (`:44-51`), `accountPostsCore` (`:177-186`) y la evidencia de NK-0022 (la escritura está cubierta por los tests `:107-112` y `:158-160`; la lectura admin sobrevive a la mutación M5: `gate-mutations.log:90-110` muestra «Tests 13 passed (13)» al quitar el `.eq("org_id")`).

**(2) Qué cliente pasa cada llamador (§16.1). Es mixto.** La mejora protege a los llamadores de persona y es redundante para los de servicio.
- Cliente de persona (RLS): pantalla `accountJobs` (`apify.functions.ts:23-30` y `userCtx`, `agent.functions.ts:16-35`); pantalla de refresco de señales, sin `scope` (`web-research.functions.ts:25-26`); agente en la app: `linkedin_company_posts`, `company_job_postings` (`agent/tools/linkedin.ts:16-17` y `:38-39`) y `refresh_signals` (`agent/tools/web.ts:43-44`); MCP (`mcp/context.ts:10`, `mcp/supabase.ts:20-27`, token del usuario con clave publicable).
- Cliente de servicio (admin): Telegram con las mismas herramientas de LinkedIn (`webhook.ts:19,86`, `channel-ctx.server.ts:15`); trabajo `account_signals` (`job-runner.server.ts:86-89`, también cuando lo lanza una pantalla, `background.functions.ts:135-136`); cron `runSignalRefresh` (`web-research-core.ts:145`, `proactive.ts:16,133`); `maintainSignals` (`tasks.server.ts:39-46`); flujo de leads (`lead-tasks.server.ts:83`).

**(3) ¿Se puede probar con `apify-core.test.ts`?** Sí es posible: los fakes ya distinguen cliente recibido y admin cuando se crean dos `fakeDb`. CA-1 («no existe» o «da error») necesita un ajuste, porque `fakeDb` devuelve siempre `row`. CA-3 se prueba comprobando los filtros de la lectura del cliente recibido. CA-1 y CA-3 fallan hoy (por lectura, no ejecutado); CA-2 es una guarda válida. P-1 cambia CA-1: su prueba pasa de «devuelve URL» a «lanza con `url`».

**(4) Riesgo de dejar sin guardar una URL legítima, y duplicado de `loadAccount`.** La política de `accounts` exige lo mismo para leer y actualizar (`0002_multitenant_organizations.sql:120-122`); no hay rol que vea la cuenta y no pueda escribirla. Los casos reales son el cambio de empresa activa, la membresía revocada y un error transitorio. La lectura previa repite la misma consulta con el mismo cliente segundos después (entre las dos, la espera de `searchBoth`, de hasta 10 s); en los llamadores admin es pura redundancia. No se puede reutilizar `loadAccount` tal cual: pide un `AiScope` y lanza un error genérico que no distingue «no existe» de «fallo».

**(5) Contradicciones con decisiones previas.** Con la decisión del 2026-10-29 el SDD respeta el guardado, pero contradice el test `:193` y `AGENTS.md:55` (O-1). CA-8 de NK-0022 choca con CA-1 y P-1 recomendada (O-2). NK-0022 SDD:186 advertía del caso de 0 filas al cambiar la empresa activa (Menor).

**(6) Alcance y nivel.** Coherente: «mejora acotada» es SDD corto sin PRD. Lo desalineado es el alcance (§5 y §12): hay que sumar los tests `:117`, `:165` y `:193` y `AGENTS.md:55`, y el SDD debe decir que hay llamadores sin protección y que la mejora es redundante en los de servicio.

**(7) P-1 y P-2.** P-1 mal planteada: hay que recomendar `LinkedinSaveError` con `url`. P-2 ya está contestada por esta revisión: hay llamadores de persona y de servicio. La pregunta real para Fede es si el valor estrecho justifica tocar dos tests y una decisión suya.

**CA sin prueba posible:** ninguno. **[Por verificar]:** §16.2 sin reproducir; la política viva de `accounts` en la base (solo leyó `0002`); que `requireSupabaseAuth` entrega siempre el cliente con token de usuario.

**Lo que esta revisión NO demuestra:** que CA-1 y CA-3 fallen hoy (razonamiento, no ejecución); que el resto de la suite siga verde tras el cambio; que no haya más llamadores fuera de `src/`, `supabase`, `scripts` y `docs`; la política viva de RLS, el comportamiento real con dos empresas, la segunda máquina y el soak.

### Decisión de Fede (2026-11-01): aplazar
Tras el informe del gate, Fede decidió **no construir NK-0037 por ahora** (recomendación del autor). Razones: la comprobación solo protege a los llamadores de persona (pantallas, agente en la app, MCP) y es redundante para los de servicio (Telegram, trabajos, cron, leads), que son la mayoría de las rutas; obliga a reescribir el test que fija su decisión del 2026-10-29 («guarda y lee con el cliente admin, nunca con el que le pasan», `apify-core.test.ts:193`) y a cambiar `AGENTS.md:55`; y no hay ningún fallo conocido.

**Para reabrir:** si aparece un llamador de persona que construya `acc` sin pasar por `loadAccount`, o un caso real de cuenta ajena escrita con el cliente admin. Entonces el SDD se reescribe con lo que dijo el gate: lanzar `LinkedinSaveError(…, url)` en vez de devolver la URL, reescribir los tests `:117`, `:165`, `:193` y `:204`, actualizar `AGENTS.md:55`, y reflejar la tabla de llamadores. El ticket NK-0037 sigue abierto en el ledger como `LOGGED`.

## 18. Delta de implementación (lo rellena el agente al entregar)
Sin entrega todavía.
