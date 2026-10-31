# SDD-20261028-field-sources-on-tracked-writers · [Mejora] Los escritores de campos rastreados envían su origen antes de aplicar la migración 0058

**Tipo:** Mejora (SDD corto sin PRD) · **Prioridad propuesta:** Alta (bloquea pasar 0058 a preproducción; la fija Fede)
**Estado:** Aprobado (Fede, 2026-10-29, confirmado por él en el chat con las objeciones de la segunda pasada del gate sobre el texto abiertas como deuda salvo las decididas en la sección 15; antes aprobado el 2026-10-28, retirada y reaprobada el 2026-10-29; cuerpo corregido con las decisiones de Fede del 2026-10-28; secciones 15 y 17) · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-10-28
**PRD:** No aplica (mejora acotada; cierra el riesgo R1 de la verificación de 0058 de NK-0006) · **Depende de:** `docs/sdd/SDD-20261028-field-write-paths-normalization.md` (NK-0018). Orden: solo U-2 (Apollo, Clay, Completar cuenta y Parallel) se implementa después de NK-0018, porque ambos tocan `clay.tsx`, `apollo.tsx` y `applyAutoChanges` (`orchestrator/runner.ts`); U-1, U-3, U-4 y U-5 no dependen de NK-0018. Archivos que tocan las ramas de los dos tickets (comprobado con `git diff` de ambas el 2026-10-29): `src/lib/field-proposals.ts`, `src/lib/field-proposals.test.ts` y `src/lib/AGENTS.md`; quien integre segundo resuelve esos conflictos. NK-0018 toca `parallel.ts`, no `parallel.tsx` y de `docs/sdd/SDD-20261025-universal-field-definitions.md` (U-3, migración 0058).
**Ticket:** NK-0022 (PROMOTED en el ledger del checkout principal, con este SDD enlazado; brief en `.factory/briefs/NK-0022.md`; rama `feat/field-sources-writers` con 3 commits, EN PAUSA por decisión de Fede el 2026-10-29 hasta corregir este SDD). Depende además del ticket NK-0018.

> Nivel elegido: SDD corto sin PRD. Es código de aplicación, sin cambio de esquema ni de RLS (la migración 0058 no cambia). Un PRD no añadiría nada: el objetivo ya está en el PRD de la iniciativa (origen y confirmación de cada dato). Lo que sí añadiría el nivel «Feature» sería un PRD de una página, sin valor aquí.

## 1. Resumen
La migración 0058 (no verificada en preproducción) hace que un `UPDATE` con sesión de persona que cambie un campo rastreado, sin enviar `field_sources`, quede marcado «persona» y confirmado. Seis escritores guardan valores que no son de la persona sin enviar `field_sources`. Este SDD hace que cada uno envíe su origen real, para que el trigger no actúe, y añade un test de contrato que impide un escritor nuevo sin origen.

## 2. Problema y para quién
El founder que aplica un enriquecimiento (Apollo, Clay, Parallel, Completar cuenta), acepta un cambio del Agente o deja que Nokko encuentre el LinkedIn de una cuenta vería después el dato como «escrito por una persona». Eso rompe la regla «un valor sin marca es sin dato, nunca de persona» y vuelve poco fiable lo que la pantalla dice sobre el origen.

## 3. Evidencia y por qué ahora
- **Verificación de 0058** en un Postgres 17 local con datos ficticios (2026-10-28): 34 comprobaciones PASS. Con sesión de persona y sin `field_sources`, el trigger sella `kind persona, confirmed true, confirmedBy` en industry, size, country, notes y linkedin_url; con `field_sources` modificado en el mismo UPDATE se guarda tal cual; con `field_sources` idéntico al actual el trigger **sí** actúa. Evidencia: `docs/sdd/annex/migration-0058-verification-20261028.md` (secciones «Resultados de la ejecución» y «Auditoría R1»; copia del informe de la sesión de verificación, sin cambios).
- **Auditoría de escritores** (solo lectura, rama `feat/universal-field-normalization` @ 8524c92), `UPDATE` con cliente de persona sin `field_sources`:
  - `src/components/apollo.tsx:296`, `src/components/clay.tsx:279`, `src/components/parallel.tsx:224` (incluye `notes`), `src/components/orchestrator/complete-account.tsx:50`: `patch` de `enrichPatch` sin `field_sources`.
  - `src/lib/agent/tools/accounts.ts` `update_account` (el `update` está en `:126` en 8524c92 y en `:244` en 4b21dc3): `ctx.db` es `context.supabase` en el Agente y el MCP (`src/lib/agent.functions.ts:19`) y el cliente de servicio en Telegram (`telegram/webhook.ts:39-56`). También recibe valores de otros orígenes: propuestas aceptadas (`field-proposals.ts:48` → `agent.functions.ts:178`), herramientas de Apollo, Clay, Parallel y completar datos (`agent/tools/apollo.ts:36`, `clay.ts:51`, `parallel.ts:65`, `needs.ts:13`) y `applySetupItems` (`agent.functions.ts:110`).
  - `src/lib/apify-core.ts:32` (`companyLinkedin`): guarda el `linkedin_url` hallado por búsqueda web con el `db` que recibe; los llamadores le pasan el cliente del usuario (`web-research.functions.ts`, `agent/tools/web.ts`, `apify.functions.ts:28-29`, `agent/tools/linkedin.ts:16` y `:38`) o el de servicio (`web-research-core.ts:145`). Además sobrescribe cualquier `linkedin_url` que no sea de empresa, incluido el de una persona (`apify-core.ts:25-32`, `apify.ts:22-26`). **No hay aprobación humana del valor.**
- **Ya seguros:** `applyAutoChanges` (`src/lib/orchestrator/runner.ts:140`, envía `field_sources` con `stampSources`; sus llamadores usan cliente de servicio), los cuatro updates de `fit-fields.tsx` (envían `field_sources`), `icp-editor.tsx:78` (edición manual: sellar «persona» es correcto), los INSERT (importación, API pública, `create_account`, `create_icp`: el trigger es solo `BEFORE UPDATE`). `core-write.ts`, `pipeline.ts` y `new-deal.tsx` solo leen o insertan en `accounts` (comprobado: sin `update`).
- **Cuentas ya selladas por error:** no aplica; 0058 no está aplicada en ningún entorno.
- **Cuántas cuentas o campos se verán afectados:** sin dato (no se ha consultado la base).
- Por qué ahora: 0058 está lista y verificada en local; lo único que impide aplicarla en preproducción es este riesgo.

## 4. Resultado buscado
- Con 0058 aplicada, ningún camino de la lista guarda un campo rastreado con marca «persona» si no lo escribió una persona. Medición: los tests de CA-1 a CA-10 y, tras aplicar 0058 en preproducción, una consulta de solo lectura (`kind = 'persona'` con `confirmedBy` en cuentas actualizadas por esos caminos desde la entrega).
- Línea base: **sin dato**.

## 5. Alcance
**Incluye:**
- Apollo, Clay y Completar cuenta (pantallas, con casillas): al aplicar lo elegido guardan `field_sources` con el origen real, confirmado por quien aprobó.
- Parallel (botón único, hasta 25 cuentas): guarda el origen sin confirmar. Si el único cambio es `notes` y esa columna no tenía marca, envía igualmente `field_sources` de `notes` con origen Parallel, no confirmado, para que el trigger de 0058 no lo selle como «persona» (decidido por Fede, 2026-10-29).
- `update_account` (Agente, MCP, Telegram, propuestas aceptadas, onboarding): recibe un `source` validado y lo guarda con la confirmación de quien aprobó.
- `companyLinkedin` (LinkedIn hallado por búsqueda web), todos sus llamadores.
- Un registro de puntos de escritura con test de contrato.

**No incluye:**
- Cambios en la migración 0058, en RLS o en el esquema.
- Los escritores seguros ni `icp-editor` (edición manual). `icp-editor.tsx:78` guarda como «persona» confirmada los criterios que propone la IA (`countries`, `min_employees`, `max_employees`): decidido por Fede el 2026-10-29, va en un ticket aparte, no aquí.
- Reescribir marcas ya existentes (no hay backfill).
- La normalización de tamaño y país (NK-0018).
- Cambios de pantalla o de copy (se muestra el origen con `sourceText` y `originOf`; solo se añade la etiqueta de Parallel).
- Aplicar 0058 en preproducción o producción (decisión de Fede, después de este SDD).

## 6. Cambios de comportamiento (delta)
**Añadido:** cada guardado de un campo rastreado desde estos caminos envía `field_sources`; argumento `source` en `update_account`; registro de puntos de escritura.
**Modificado:**
- Apollo, Clay, Completar cuenta (casillas): antes sin `field_sources` (con 0058 quedaría «persona») → origen del proveedor, `confirmed true`, `confirmedBy` y `confirmedAt` de quien aprobó.
- Parallel: antes sin `field_sources` → origen `parallel`, `confirmed false` (el botón no confirma por campo); `notes`, que mezcla texto de la persona con el de Parallel, pierde la marca en vez de atribuirse.
- `update_account`: antes sin origen → el `source` recibido (por defecto `ia`), `confirmed true` por quien confirmó.
- LinkedIn hallado por búsqueda web: antes sobrescribía cualquier URL que no fuera de empresa, incluida la de una persona → solo escribe si el campo está vacío o su valor no es de persona; origen `web`, `confirmed false`.
**Eliminado:** nada.

## 7. Historias y criterios de aceptación
Objetivo cubierto: G-2 «confirma sus datos» (`docs/prd/PRD-20261028-ux-onboarding-coherencia.md:25`); este SDD evita que un dato no confirmado figure como confirmado por una persona.

### H-1: Como founder, quiero que un dato que aprobé desde Apollo, Clay o Completar cuenta siga mostrando su origen y que yo lo confirmé.
- **CA-1** CUANDO aplico con casillas campos de Apollo, Clay o Completar cuenta, el sistema DEBE guardar junto a cada valor el origen del proveedor (en Completar cuenta, el `source` de la propuesta), `confirmed true`, `confirmedBy` = mi usuario y `confirmedAt`. · cubre G-2 · prueba: `src/lib/field-writers.test.ts` (nuevo), sobre la función pura de cada camino
- **CA-2** CUANDO aplico Parallel, el sistema DEBE guardar industry, size y country con origen `parallel` y `confirmed false`, y DEBE quitar la marca de `notes` si el valor cambia. · cubre G-2 · prueba: `src/lib/field-writers.test.ts`
- **CA-3** El sistema NO DEBE guardar `source persona` ni `kind persona` en ningún valor aplicado desde Apollo, Clay, Parallel, Completar cuenta o `companyLinkedin`. · cubre G-2 · prueba: `src/lib/field-writers.test.ts`

### H-2: Como founder, quiero que lo que el Agente guarda, venga de la IA o de un proveedor, muestre su origen real.
- **CA-4** CUANDO se ejecuta `update_account` (confirmado por una persona) con un `source` válido, el sistema DEBE guardar para cada campo rastreado escrito ese `source`, `confirmed true` y `confirmedBy` = quien confirmó; sin `source`, `ia`. Un `source` válido es uno de una lista cerrada de orígenes que se declara en un solo sitio (el registro de puntos de escritura, a partir de los orígenes que ya usa el código); uno no válido DEBE rechazarse al proponer, antes de crear la acción pendiente (decidido por Fede, 2026-10-29). Aplica con cualquier cliente de base de datos (incluido el de servicio de Telegram). · cubre G-2 · prueba: `src/lib/agent-tools.test.ts`
- **CA-5** CUANDO una propuesta de campo se acepta o una herramienta del Agente guarda valores de Apollo, Clay, Parallel o de la web, el sistema DEBE pasar a `update_account` el `source` de esa propuesta. · cubre G-2 · prueba: `src/lib/field-proposals.test.ts` y `src/lib/agent-tools.test.ts`
- **CA-6** SI `update_account` deja vacío un campo rastreado, ENTONCES el sistema DEBE quitar su marca. · prueba: `src/lib/agent-tools.test.ts`
- **CA-7** SI el valor que se escribe es igual al guardado (también tras normalizar, como «Spain» y «ES»), ENTONCES el sistema NO DEBE cambiar la marca de ese campo, aunque sea de persona. · cubre G-2 · prueba: `src/lib/agent-tools.test.ts` y `src/lib/field-writers.test.ts`

### H-3: Como founder, quiero que el LinkedIn que Nokko encuentra solo nunca figure como escrito por mí ni pise lo que escribí yo.
- **CA-8** CUANDO `companyLinkedin` encuentra una URL por búsqueda web, el sistema DEBE guardarla solo si el campo está vacío o su valor no es de persona (la marca `kind persona` en `field_sources`; no se interpreta la URL ni ningún perfil de LinkedIn), con origen `web`, `kind fuente` y `confirmed false`, con el cliente admin (decidido por Fede, 2026-10-29); y DEBE leer `field_sources` antes de escribir y no ignorar el error del guardado. · prueba: `src/lib/apify-core.test.ts` (nuevo)

### H-4: Como equipo de producto, queremos que ningún punto de escritura nuevo vuelva a sellar «persona» por accidente.
- **CA-9** CUANDO existe un `update` o `upsert` de `accounts` o `icp_profiles` que toca columnas rastreadas y no está en el registro de puntos de escritura (uno por punto, no por archivo, con su forma: «envía origen», «columnas no rastreadas», «edición manual»), el test DEBE fallar; un quinto `update` en `fit-fields.tsx` también. Hoy DEBE fallar con los seis puntos de la sección 3. · prueba: `src/lib/field-writers.test.ts` (nuevo)
- **CA-10** El sistema DEBE partir de un `field_sources` leído justo antes de escribir y conservar las marcas de los campos que no cambian; un campo que cambia DEBE llevar marca nueva o quedar sin marca, nunca conservar la vieja. · cubre G-2 · prueba: `src/lib/field-writers.test.ts`

## 8. Casos límite y errores
- Cuenta sin marcas previas (`{}`): solo se crea la marca de los campos escritos (CA-10).
- Otra empresa (multitenant): sin cambios de política; la lectura previa va filtrada por RLS (cliente) y por `org_id` (servicio). Si la empresa activa cambia entre la lectura y la escritura, el `update` afecta a 0 filas: el código lo trata como error y no lo ignora.
- Guardados concurrentes: la lectura previa reduce la ventana, pero una lectura antigua puede devolver una marca de otro origen sobre un valor recién escrito por una persona. Se limita con CA-10 y se acepta el resto; es una atribución falsa, no solo una marca perdida. [Por verificar] si hace falta una comparación del valor antes de escribir.
- `field_sources` enviado idéntico al actual hace que el trigger actúe y selle «persona»: toda marca nueva lleva `at`, así que difiere (CA-1, CA-4).
- Falla la lectura previa: no se guarda el valor sin su origen y se muestra `errorText()` (qué pasó + qué hacer).
- NK-0018 descarta el tamaño no numérico de Parallel: la marca de `size` solo se pone si `size` sigue en el patch.

## 9. Experiencia y copy
Sin pantallas ni textos nuevos. Solo la etiqueta «Parallel» en `SOURCE_LABEL` (hoy se vería «Automático · parallel»). Los errores usan `errorText()`.

## 10. Datos, permisos y privacidad
Sin columnas ni políticas nuevas. Se escribe `accounts.field_sources` (existente, 0046). Roles: los mismos que hoy editan cuentas. Pruebas con datos ficticios.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| ninguna | — | — | — |

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | Constructores puros en `provenance.ts` (origen confirmado por quien aprueba, origen sin confirmar, quitar marcas) y etiqueta de Parallel | CA-3, CA-7, CA-10 | `src/lib/provenance.test.ts` |
| U-2 | Apollo, Clay, Completar cuenta y Parallel: cada `apply` pasa a función pura que lee `field_sources` y arma el patch con marcas; se amplía el tipo de `review` con `source`; el componente solo llama a la función | CA-1, CA-2, CA-3 | `src/lib/field-writers.test.ts` (nuevo) |
| U-3 | `update_account` con `source` validado; `proposalSuggestion` y las herramientas de Apollo, Clay, Parallel y completar datos lo pasan | CA-4, CA-5, CA-6, CA-7 | `src/lib/agent-tools.test.ts`, `src/lib/field-proposals.test.ts` |
| U-4 | `companyLinkedin`: solo escribe campo vacío o no de persona, lee `field_sources`, no ignora el error | CA-8 | `src/lib/apify-core.test.ts` (nuevo) |
| U-5 | Registro de puntos de escritura y test de contrato | CA-9 | `src/lib/field-writers.test.ts` |

Orden: U-1, luego U-2 a U-4 (independientes entre sí), U-5 al final. Solo U-2 se implementa después de NK-0018 (ver cabecera).

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- `stampSources` y `confirmSources` (`src/lib/provenance.ts`) ya existen; componerlas conserva el origen y añade quién y cuándo. `originOf` deduce `fuente` para `parallel` (caso por defecto) e `ia` para `ia` (`provenance.test.ts:28`).
- Enviar `field_sources` modificado con el cliente de la persona basta; no hace falta cliente de servicio en `companyLinkedin` (la política «org update» deja a cualquier miembro escribir cualquier columna de su empresa, `0002_multitenant_organizations.sql:121`, y FitFields ya lo hace). Fede pidió cliente admin; el resultado exigido es el mismo.
- Completar cuenta: `job.result.review` ya guarda `SourcedChange` con `source` y `quote` (`job-runner.server.ts:109`, `runner.ts:46`); el tipo `Job` del componente los descarta y `enrichPatch` también (`clay.ts:165-167`): ampliar el tipo y no usar `enrichPatch` para construir la marca.
- El registro de CA-9 cuenta puntos de escritura. Telegram usa el cliente de servicio (`telegram/webhook.ts:39-56`): con `field_sources` enviado, CA-4 también lo cubre.
- Alternativa descartada: cambiar el trigger para distinguir proveedor de persona; el trigger no ve el origen del valor y 0058 ya está verificada.

## 14. Riesgos y dependencias
- Solape con NK-0018 en `clay.tsx`, `parallel.tsx`, `apollo.tsx` y `runner.ts`: implementar después y rebasar las pruebas. La rama avanza (otra sesión la movió a 4b21dc3 durante la revisión): las líneas citadas pueden desplazarse.
- Carrera entre dos aplicaciones: ver sección 8.
- Si un punto de escritura se olvida, 0058 lo sellaría «persona»; CA-9 lo detecta, no lo impide en ejecución.
- Cualquier miembro puede escribir una marca «confirmada por X»; ya pasa hoy y este SDD no lo cambia.
- Depende de 0058 solo al aplicarla; el código funciona igual antes.

## 15. Preguntas para Fede y para la revisión técnica
- Resuelta el 2026-10-29: la evidencia de 0058 ya está copiada en `docs/sdd/annex/migration-0058-verification-20261028.md` (regla 7 de `GROUND-RULES.md`).


**Decididas por Fede el 2026-10-29 sobre las objeciones de la segunda pasada del gate:**
- (C2) Parallel que solo cambia `notes` sin marca previa: se envía el origen real del proveedor (Parallel), no confirmado. Recogido en el alcance.
- `icp-editor.tsx:78`: ticket aparte; fuera de este SDD. Recogido en «No incluye».
- Cuando la persona dicta el valor al Agente: se mantiene `ia` confirmada.

- CA-4: `source` válido = lista cerrada declarada en el registro de puntos de escritura; uno no válido se rechaza al proponer. Recogido en CA-4.
- CA-8: «no es de persona» = marca `kind persona` en `field_sources`, sin interpretar URLs; cliente admin. Recogido en CA-8.

**Pendiente de hacer, sin decisión abierta:** actualizar `src/lib/AGENTS.md:54` («only an empty field is written») para reflejar la regla de CA-8 y el registro de puntos de escritura; lo hace quien implemente U-4/U-5.

**Siguen abiertas:** ninguna de producto.

## 16. Pendiente de verificar
- Cuántas cuentas quedarían afectadas: sin dato (consulta de solo lectura a preproducción, con OK de Fede).
- Si hace falta comparar el valor antes de escribir para cerrar la carrera de la sección 8.
- Que la etiqueta «Parallel» y las deducciones de `originOf` se muestran bien en pantalla.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Informe del gate, copiado sin editar (2026-10-28, rama en 8524c92; durante la revisión otra sesión avanzó la rama a 4b21dc3).

- **Veredicto del gate:** Objeciones

La objeción principal (C1) es que `update_account` no es solo «el Agente cambia algo». También guarda los valores de Apollo, Clay y Parallel y las propuestas que se aceptan desde Sugerencias. Si CA-4 sella todo como `source ia`, esos valores quedarían como «Deducido» y se perdería su fuente real.

- **CA sin prueba posible o sin G-n:**
  - CA-1 a CA-8 no citan ningún G-n. El propio SDD dice que el objetivo está en el PRD de la iniciativa (SDD:8). Ese PRD tiene G-2, «confirma sus datos», medido en % de campos «Confirmado» (`docs/prd/PRD-20261028-ux-onboarding-coherencia.md:25`). Esta mejora mueve esa métrica directamente, así que debería citarlo.
  - CA-1, CA-2, CA-3 y CA-8 citan `src/lib/field-writers.test.ts` sin marcarlo «(nuevo)». Solo CA-7 lo marca, y el archivo no existe.
  - CA-1 a CA-3 piden ver qué envían cuatro componentes React a Supabase. Un escaneo de texto en un test de `src/lib` no lo demuestra. Hace falta un test de componente: jsdom y Testing Library están disponibles (`vitest.config.ts:8`, ejemplo en `src/components/connections-panel.test.tsx`). Otra opción es sacar cada `apply` a una función pura. El SDD no dice cuál usar.
  - CA-7 es viable y fallaría hoy solo si el registro se comprueba en cada punto de escritura y no por archivo. Por archivo, `fit-fields.tsx` pasaría con un quinto `update` sin `field_sources`, porque el archivo ya contiene esa palabra (líneas 32, 40, 53 y 66). Además, CA-7 no puede detectar el error semántico de C1: el valor llega como argumentos de una acción, no como un `update` en el código.
  - Falta un CA para «un campo cuyo valor no cambia no recibe marca nueva». Sin él, se reescribe con `ia` o con el proveedor una marca «persona» que ya existía. Pasa cuando `update_account` recibe el mismo valor, o cuando la normalización de NK-0018 deja igual el valor guardado («Spain» y «ES»).

- **[Por verificar] que sigue sin comprobarse:**
  - Comprobado, ya no está pendiente: `source` sí llega a la pantalla de Completar cuenta. `job-runner.server.ts:109` guarda en `result.review` los `SourcedChange` con `source` y `quote` (`runner.ts:46`, `:92`, `:71`), y `complete-account.tsx:25` lee `result`. Lo que falla es el tipo: `Job` declara `review?: EnrichChange[]` (`complete-account.tsx:13`) y `enrichPatch` descarta `source` (`clay.ts:165-167`). La implementación tiene que ampliar el tipo y no usar `enrichPatch` para construir la marca.
  - Comprobado, ya no está pendiente: `originOf` da `parallel` como `fuente` porque es el caso por defecto, e `ia` como `ia` (`provenance.ts:17`; el test ya existe en `provenance.test.ts:28`). `SOURCE_LABEL` no tiene `parallel` (`provenance.ts:10`), así que se mostraría «Automático · parallel» en minúscula (`provenance.ts:83`).
  - Sigue sin comprobar: cuántas cuentas quedarían afectadas. Sin dato.
  - Sigue sin comprobar: si en una carrera entre dos aplicaciones basta con leer `field_sources` justo antes de escribir (SDD:74).
  - Sigue sin comprobar: la evidencia de 0058 está fuera del repo. Existe (`migration-0058-plan.md:72` y `:165-175`, «34 comprobaciones, todas PASS»), pero mientras no se copie a `docs/sdd/annex/` no cumple la regla 7 de GROUND-RULES.
  - Sigue sin comprobar: el ticket. El ledger llega a NK-0017, pero el SDD del que depende ya se presenta como NK-0018 (`SDD-20261028-field-write-paths-normalization.md:6`).

- **Contradicciones con el código o con decisiones previas:**
  - **C1 (bloqueante).** CA-4 y U-3 sellan `source ia` en todo lo que guarda `update_account`, pero esa herramienta recibe valores de otros orígenes:
    - Las propuestas de campo guardan como acción `update_account` con el valor de Apollo, Clay o web (`field-proposals.ts:48`). Al aceptarlas desde Sugerencias o Telegram se ejecutan con `executeTool` (`agent.functions.ts:178`).
    - Las herramientas del Agente para Apollo, Clay, Parallel y completar datos mandan guardar con `update_account` (`agent/tools/apollo.ts:36`, `clay.ts:51`, `parallel.ts:65`, `needs.ts:13`).
    - `applySetupItems` también lo ejecuta (`agent.functions.ts:110`).
    - Además, el SDD dice que `ctx.db` es el cliente de la persona. Es cierto en el Agente y en el MCP, pero Telegram usa el cliente de servicio (`telegram/webhook.ts:39-56`).

    Hace falta que `update_account` reciba el origen (por ejemplo, un `source` validado en los argumentos, que `proposalSuggestion` rellenaría) o separar los caminos. Hay que decidir también qué pasa cuando la persona dicta el valor al Agente: ¿`ia` o `persona`?
  - **C2.** CA-3 marca todo `notes` como `parallel` y confirmado. Pero `enrichPatch` concatena las notas que escribió la persona con la línea de Parallel (`parallel.ts:182-183`), así que el texto de la persona pasaría a «Automático · Parallel». Lo mismo con «confirmado por quien aprobó»: en Parallel no hay casillas por campo, el botón aplica hasta 25 cuentas de golpe (`parallel.tsx:217-226`). Eso contradice «tras aprobar con casillas» (SDD:49) e infla G-2.
  - **C3.** El trigger se comporta como dice el SDD (`0058_field_sources_generic.sql:24-37`): si `field_sources` cambia, devuelve `NEW` intacto; si es idéntico (la comparación jsonb no depende del orden de las claves), aplica el bucle. La consecuencia que el SDD no recoge es que, cuando el escritor envía `field_sources` modificado, un campo cambiado sin marca nueva conserva la marca vieja sobre el valor nuevo. Por eso la carrera de SDD:109 no tiene «el mismo efecto que hoy»: una lectura antigua puede volver a poner, sobre un valor que acaba de escribir una persona en FitFields (`fit-fields.tsx:52-53`), la marca de otro origen. Es una atribución falsa, no una marca perdida.
  - **C4.** Citas.
    - `src/lib/agent/tools/accounts.ts:100` no es `update_account`. En 8524c92 la herramienta empieza en `:91` y el `update` está en `:126`.
    - Durante esta revisión otra sesión hizo el commit 4b21dc3 (prettier, merge de NK-0006) sobre esta misma rama. Ahora `apollo.tsx:296` está en `:587` y el `update` de `update_account` en `accounts.ts:244`.
    - Las demás citas son correctas en 8524c92: `clay.tsx:279`, `parallel.tsx:224`, `complete-account.tsx:50`, `apify-core.ts:32`, `runner.ts:140` y `agent.functions.ts:19`.
  - **C5.** `companyLinkedin` no solo rellena un campo vacío. Sobrescribe cualquier `linkedin_url` que no sea de empresa, incluido uno escrito por una persona (`apify-core.ts:25-32`, `apify.ts:22-26`). Eso choca con `src/lib/AGENTS.md:54` («only an empty field is written»). Con CA-6, además, el valor de la persona pasaría a «web» sin confirmar. Por otro lado, `loadAccount` no lee `field_sources` (`apify-core.ts:18`) y el error del `update` se ignora.
  - **C6.** El SDD da como llamadores de `companyLinkedin` solo `web-research.functions.ts` y `agent/tools/web.ts`. Faltan: `apify.functions.ts:28-29` (cliente del usuario), `agent/tools/linkedin.ts:16` y `:38` (`accountPostsCore` y `accountJobsCore`, que también llegan por el MCP con el token del usuario), `web-research-core.ts:145` (`runSignalRefresh`, cliente de servicio). Corregir dentro de `companyLinkedin` los cubre a todos, pero la sección 3 está incompleta.
  - **Sin contradicción con NK-0018** más allá del solape que ya declara el SDD. Sí conviene notar que NK-0018 descarta el tamaño no numérico de Parallel, de modo que la marca de `size` solo debe ponerse si el campo sigue en el patch.

- **Escritores no listados que encontraste:**
  - No hay escritores directos nuevos de columnas rastreadas. Busqué en todo `src` `update`, `upsert` y `.rpc`, y las funciones SQL de `drizzle/migrations`: `apply_account_assignment` solo toca `owner_id` (`0029_account_assignment.sql:82`) y no hay `supabase/migrations`. Los demás `update` de `accounts` tocan columnas no rastreadas: `quick-actions.tsx:60`, `abm.tsx:60` y `:64`, `accounts.$id.tsx:71` y `:75`, `autopilot.server.ts:27`, `web-research-core.ts:131`, `leads-ingest.ts:54` y `lead-tasks.server.ts:59`.
  - Sí faltan caminos indirectos hacia `update_account` con valores que no son de IA: aceptar una propuesta de campo (`field-proposals.ts:48` → `agent.functions.ts:178`), por la app o por Telegram (`telegram/webhook.ts:59`), y `applySetupItems` (`agent.functions.ts:110`).
  - Llamadores de `companyLinkedin` no citados: `apify.functions.ts:29`, `agent/tools/linkedin.ts:16` y `:38`, `web-research-core.ts:145`.
  - Sobre la pregunta 6: el cliente de la persona basta en `companyLinkedin`. La política «org update» deja a cualquier miembro escribir cualquier columna de su empresa (`0002_multitenant_organizations.sql:121`), no hay restricciones por columna sobre `field_sources` y FitFields ya lo escribe con el cliente del navegador. No veo motivo técnico para el cliente de servicio. Dos matices: si cambia la empresa activa entre la lectura y la escritura, el `update` afecta a 0 filas sin error. Y que cualquier miembro pueda escribir una marca «confirmada por X» ya pasa hoy; este SDD no lo cambia.

- **Lo que esta revisión NO demuestra:**
  - Solo leyó código. No ejecutó `scripts/factory/gate.mjs`, ni tests, ni `flake.mjs`: no hay código que probar y el encargo no permitía escribir en el repo, y vitest y el gate crean cachés y worktrees.
  - No aplicó 0058 en ninguna base. La conducta del trigger la deduce leyendo la función y la evidencia externa, que no reprodujo.
  - No probó RLS en ejecución.
  - No hizo segunda máquina ni soak.
  - No comprobó que CA-7 falle de verdad en el commit base, porque el test no existe.
  - La rama cambió durante la revisión (8524c92 → 4b21dc3, hecho por otra sesión en el mismo worktree). Las líneas citadas pueden volver a moverse.
  - No hay cifras de negocio: cuentas afectadas, sin dato.
  - No encontró datos de clientes en el SDD.


### Segunda pasada del gate (2026-10-29), copiada sin editar
**Veredicto de la segunda pasada:** Objeciones

**Objeciones de la primera pasada:**
- C1: cerrada en parte. Las herramientas de Apollo, Clay, Parallel y `needs` son de lectura y no llaman a `update_account` (`needs.ts:12-13`, `agent/tools/apollo.ts:36`). El `source` lo pone el modelo. El SDD no define qué `source` son válidos; solo lo hace el brief (`.factory/briefs/NK-0022.md:15`). Sigue abierto qué pasa cuando la persona dicta el valor (SDD:123).
- C2: abierta. Parallel puede generar un cambio que solo toca `notes` (`parallel.ts:181-183`). Si `notes` no tenía marca, el `field_sources` que se envía es idéntico al guardado. Entonces el trigger lo sella como «persona» (`0058:24`, `:28-32`). SDD:81 no cubre este caso.
- C3: cerrada (SDD:80, CA-10).
- C4: abierta. En d02114b, `apollo.tsx:296` es `variant="outline"`; el `update` está en la `:589`.
- C5: parcial. No se sabe si «no es de persona» habla de un perfil `/in/` o de la marca `kind persona` (SDD:21 frente a :53). Además choca con `src/lib/AGENTS.md:54` («only an empty field is written») y el SDD no dice que esa regla se actualice.
- C6: cerrada. Las faltas de G-n siguen parciales: CA-6, CA-8 y CA-9 no citan G-2.
- Ticket: abierta. SDD:6 dice «LOGGED, sin brief». En realidad el ledger tiene NK-0022 en PROMOTED con el SDD enlazado, el brief existe y `feat/field-sources-writers` ya tiene 3 commits (368f3ff…e1470ac), con el SDD en Borrador.
- Anexo de 0058: cerrada. Pero la pregunta de SDD:122 sigue preguntando si se copia, y ya está copiado.

**CA sin prueba posible o sin G-n:**
- CA-5: lo que hace el modelo no se puede probar de forma automática.
- CA-4: «`source` no válido» no está definido.
- CA-8: el texto es ambiguo.
- U-1 nombra `provenance.test.ts` (SDD:99), pero ningún CA cita ese archivo.
- Que los componentes llamen a las funciones puras no lo prueba ningún test y no está declarado.

**[Por verificar] que sigue sin comprobarse:**
- Cuántas cuentas se ven afectadas: sin dato.
- La carrera entre dos aplicaciones (SDD:80).
- Las propuestas de campo ya guardadas no llevan `source` (`field-proposals.ts:48`); al aceptarlas quedarían como `ia`. Sin dato de cuántas hay.

**Contradicciones con el código o con decisiones previas:**
- Fede pidió el cliente admin para `companyLinkedin`, pero CA-8 acepta cualquier cliente (SDD:109).
- Orden con NK-0018: SDD:5 dice que todo el SDD va después, SDD:105 dice que solo U-2. U-1, U-3 y U-4 ya están sobre d02114b, que no incluye NK-0018: la base de NK-0018 (fc45f3a, merge adc93bf) no es ancestro de d02114b.
- Archivos compartidos con NK-0018 que el SDD no declara: `field-proposals.ts` y su test, y `src/lib/AGENTS.md`. Al revés, NK-0018 no toca `parallel.tsx`, aunque SDD:5 y :115 lo dicen.

**Escritores no listados:**
- `icp-editor.tsx:78`: al pulsar Guardar se guardan los criterios que propuso la IA (`refine`, `icp-editor.tsx:85-91`: `countries`, `min_employees`, `max_employees`) y quedan como «persona» confirmada. SDD:22 lo da por correcto sin tratar este caso.
- No encontré otros `update`/`upsert` de columnas rastreadas, ni SQL que las escriba.

**Lo que esta revisión NO demuestra:**
- No ejecuté tests, `gate.mjs` ni la migración 0058, y no consulté la base ni el RLS.
- No miré los worktrees; solo el log de las ramas.
- No sé si el registro de CA-9 comprueba la «forma» de cada punto o solo que esté declarado.
- No sé cómo se comporta el modelo con el `source`.

## 18. Delta de implementación (lo rellena el agente al entregar)
Sin empezar.
