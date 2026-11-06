# SDD-20261028-field-write-paths-normalization · [Bug] Tamaño y país se guardan sin la regla única en los caminos de Clay, Apollo, IA web y Parallel

**Tipo:** Bug (SDD corto) · **Prioridad propuesta:** Media (la fija Fede; sin dato de cuántas cuentas afecta)
**Estado:** Aprobado; ledger: NK-0018 SHIPPED (Fede, 2026-10-29, confirmado por él; antes constaba aprobado el 2026-10-28 vía la sesión coordinadora; el gate no ha visto los retoques de texto posteriores a la cuarta pasada, sección 17) · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-10-28
**PRD:** No aplica (bug acotado; cierra un hueco de CA-1/CA-3 de NK-0006) · **Depende de:** `docs/sdd/SDD-20261025-universal-field-definitions.md` (NK-0006)
**Ticket:** NK-0018

> Nivel elegido: SDD corto sin PRD. Es un bug que escribe datos (`accounts.size`, `accounts.country`) pero no cambia esquema ni RLS. Un PRD no añadiría nada: el objetivo (G-1) ya está en el PRD de la iniciativa. Si Fede decide incluir un backfill de datos ya guardados, ese cambio sí pediría revisar el nivel.

## 1. Resumen
NK-0006 creó `normalizeForSave` como regla única de país y tamaño. El Agente (`update_account`) y Apollo ya la usan, pero otros caminos escriben el valor crudo. Este SDD hace que los caminos de Clay, Apollo (alta y completado), «Completar cuenta» con web y Parallel guarden país y tamaño con la misma regla. No cambia el esquema ni el diseño de las pantallas; solo cambia el formato de ciertos valores mostrados (la columna «actual» de las revisiones y el texto de `proposalSuggestion`).

## 2. Problema y para quién
El founder que importa o completa cuentas con Clay, Parallel o la IA web acaba con «51-200 empleados» (guion corto) en unas cuentas y «51–200 empleados» (guion largo) en otras, y con países en texto libre que no encajan con la asignación por país. Es lo que CA-3 de NK-0006 prometía evitar.

## 3. Evidencia y por qué ahora
Auditoría de solo lectura de la rama `feat/universal-field-normalization` (HEAD f9339a4 en la auditoría; el HEAD actual es 8524c92 y las líneas citadas siguen siendo válidas), informe `field-write-audit.md`. Cada afirmación se ha vuelto a comprobar en el código el 2026-10-28:
- **Clay, medido ejecutando el código:** `employeesText("51-200 employees")` da «51-200 empleados» (`src/lib/clay.ts:93-96`); `normalizeSize` de ese texto da «51–200 empleados». «10,001+ employees» → «10001+ empleados» → canónico «más de 10001 empleados». «1001-5000 employees» → «1001-5000 empleados» → «1001–5000 empleados». El comentario de `employeesText` (`clay.ts:92`) describe el formato viejo.
- **Clay guarda sin normalizar** en: `companyToAccount` (`clay.ts:104`), insert de `importPicked` (`src/components/clay.tsx:96`), insert masivo (`src/components/orchestrator/icp-companies.tsx:97`, copia idéntica; sus filas salen del runner, que trae empresas de Apollo y de Clay, `runner.ts:6-7`, y se guardan 24 h en `job.result`), `ClayEnrich.apply` vía `enrichChanges`/`enrichPatch` (`clay.ts:149-167`, `clay.tsx:279`). El país de Clay ya sale en ISO (`isoFromCountry`, `clay.ts:105`).
- **IA web:** `webFallback` (`src/lib/orchestrator/runner.ts:58-72`) devuelve el texto del modelo (`slice(0,120)`) sin `isoFromCountry` ni `normalizeSize`; el prompt pide «país de la sede» y «nº de empleados o rango». `applyAutoChanges` (`runner.ts:140`) guarda `ch.proposed` crudo: `fieldProposalDecision` solo canoniza para comparar (`src/lib/field-proposals.ts:17`). `src/components/orchestrator/complete-account.tsx:50` aplica la revisión con `enrichPatch` sin normalizar. Comprobado ejecutando `normalizeForSave`: «España» → ES, pero «Madrid, España» queda `unnormalized`, y «unos 50» queda `unnormalized`. Es decir, hoy esos dos valores se guardarían tal cual.
- **Parallel:** `readEnrichRows` (`src/lib/parallel.ts:160-173`) pasa el país por `isoFromCountry` pero deja `size` como texto libre del modelo (`clean`, `slice(0,300)`, línea 171); `enrichPatch` (`parallel.ts:176-179`) lo escribe tal cual (`src/components/parallel.tsx:224`). «50-100» se guardaría con guion corto.
- **Casos de Clay que no son un número de empleados** (comprobado por el gate): «Self-employed» acaba «Self-employed empleados» y «0-1 employees» acaba «0-1 empleados»; ambos son `unnormalized`.
- **Ya correctos (no se tocan):** `update_account` (`src/lib/agent/tools/accounts.ts:101-118`), Apollo (`accountInsertFromApollo`, `apollo.ts:70-79`; `orgToAccount` da «N empleados», ya canónico), importación y API pública (`planAccountImport` normaliza al encolar), `create_account` (el esquema zod no admite `size` ni `country`), reglas de asignación (lista cerrada).
- **Datos guardados:** sin dato. No se ha consultado la base: no se sabe cuántas cuentas tienen hoy tamaño con guion corto ni país en texto libre.

Por qué ahora: el hueco está en los caminos de «Completar cuenta» y alta desde Clay, que se usan a diario, y cada cuenta nueva con el formato viejo ensucia los filtros y la asignación por país.

## 4. Resultado buscado
- Tras el cambio, ningún camino listado en el alcance guarda `accounts.size` o `accounts.country` que `normalizeForSave` habría cambiado. Medición: tests de CA-1 a CA-5 y, tras el despliegue, una consulta de solo lectura de cuentas creadas o actualizadas por esos caminos desde la entrega.
- Línea base actual: **sin dato** (no se ha medido en la base).

## 5. Alcance
**Incluye:**
- Una función pura `normalizeDraft(d)` en `apollo.ts` (que ya importa `normalizeForSave`) que deja `size` y `country` de un `AccountDraft` en su forma canónica o vacíos si no encajan. Solo se aplica a valores **propuestos o a insertar**, nunca al valor actual de una cuenta. La usan `clay-gateway.ts`, `apollo-gateway.ts` y la función de alta compartida (la actual `accountInsertFromApollo`, `apollo.ts:71-83`, renombrada a algo genérico; hay que tocar también su llamada en `src/components/apollo.tsx:21,83` y `apollo.test.ts:83-108`).
- Clay: tamaño canónico en el origen (`clay-gateway.ts:67`, `89-90`), y de nuevo al insertar en las dos altas (`clay.tsx:96`, `icp-companies.tsx:97`), porque las filas guardadas 24 h en `job.result` pueden traer el formato viejo.
- Clay y Apollo: función pura aparte `canonicalCurrent(account)` en `apollo.ts`: devuelve el valor actual en forma canónica **conservando el original cuando no encaja** (no lo vacía) y sin alterar si el campo está vacío, de modo que `empty` se calcula sobre el valor crudo y un campo relleno nunca pasa a parecer vacío. Los gateways la llaman antes de `enrichChanges` (`clay-gateway.ts:90`, `apollo-gateway.ts:144`). `clay.ts` no cambia. Efecto declarado: la columna «actual» de las revisiones de Clay, Apollo y «Completar cuenta» y el texto de `proposalSuggestion` pueden mostrar el valor canonizado y no el guardado.
- El Agente y MCP ven los resultados de búsqueda de Clay con el tamaño ya canónico (`agent/tools/clay.ts`, vía `clay-gateway.ts:67`): cambia el formato mostrado.
- IA web: función pura `normalizeProposed(change)` usada por `webFallback` (`runner.ts:58-72`) y `applyAutoChanges` (`runner.ts:124-140`); vale para manual y automático. `lead-tasks.server.ts:73` copia `ch.proposed` en memoria y se beneficia de normalizar en el origen.
- Parallel: `size` normalizado con `normalizeForSave` en `readEnrichRows` (no necesita `normalizeDraft`); el no numérico no se guarda.
- Un test por camino, el que falla primero, con los casos de Clay medidos arriba.
- Un test que fije que `create_account` descarta `size`/`country` al parsear (hallazgo #13).
- Actualizar `src/lib/AGENTS.md:53` (ver sección 6).

**No incluye:**
- Backfill de datos ya guardados: Fede decidió medir primero (consulta de solo lectura); si hace falta, va en otro SDD.
- Columnas de ICP (`icp_profiles.countries`, `min/max_employees`, hallazgos 15-17): Fede decidió que van en un ticket aparte.
- Nuevos esquemas, migraciones o cambios de RLS.
- Triggers y funciones SQL (por ejemplo `create_organization`): no auditados.
- Importes (`deals.amount`, `leads.amount`).
- Cambios visuales (más allá del formato de los valores mostrados, ya declarado).

## 6. Cambios de comportamiento (delta)
**Añadido:** una única normalización de país y tamaño antes de proponer o guardar el valor en los caminos del alcance.
**Modificado:** Clay: «51-200 empleados» → «51–200 empleados», y un tamaño no numérico («Self-employed», «0-1 employees») no se guarda; IA web (manual y automático): país «España» → ES, y país o tamaño no reconocido no se guarda; Parallel: «50-100» → «50–100 empleados», no numérico no se guarda.
**Regla que cambia:** `src/lib/AGENTS.md:53` dice que un valor que no encaja se conserva con el original (salvo el país). Decisión de Fede: en los caminos de proveedores externos y web (Clay, Apollo, IA web en manual y automático, Parallel) el tamaño que no es un número de empleados tampoco se guarda. El resto de caminos (`update_account`, Descubiertos, ficha, CSV) conserva el original como hoy. **Apollo pasa a la lista de proveedores:** el alta compartida y «Completar con Apollo» tampoco guardan un tamaño no numérico; en la práctica Apollo siempre da «N empleados».
**Eliminado:** el formato propio de `employeesText` de Clay como valor guardado.

## 7. Historias y criterios de aceptación
### H-1: Como founder, quiero que el tamaño y el país de una cuenta queden igual vengan de Clay, Apollo, la web o Parallel, para no corregir lo mismo dos veces.
- **CA-1** CUANDO Clay devuelve «51-200 employees», «10,001+ employees» o «1001-5000 employees», el sistema DEBE proponer y guardar «51–200 empleados», «más de 10001 empleados» y «1001–5000 empleados», al crear la cuenta y al completarla. Un tamaño de Clay que no es un número de empleados («Self-employed», «0-1 employees») NO DEBE guardarse. · cubre G-1 (NK-0006 CA-3) · prueba: `src/lib/apollo.test.ts` (sobre `normalizeDraft`, aplicado a los `AccountDraft` que produce `companyToAccount`)
- **CA-2** Las dos altas desde Clay (`clay.tsx` y `icp-companies.tsx`) DEBEN guardar `size` y `country` con la misma función compartida, que DEBE normalizar al insertar aunque la fila venga preparada con el formato viejo, y descartar el tamaño no numérico. · cubre G-1 · prueba: `src/lib/apollo.test.ts` (la función de alta). Que los dos archivos la llamen lo comprueba la revisión del diff; un test no puede probar el uso, queda declarado.
- **CA-3** CUANDO la IA web devuelve un país («España», «Madrid, España»), el sistema DEBE guardar ISO solo si lo reconoce; si no, NO DEBE escribir el país, ni en manual ni en automático. · cubre G-1 · prueba: `src/lib/orchestrator/runner.test.ts` (archivo nuevo), sobre `normalizeProposed`
- **CA-4** CUANDO la IA web devuelve un tamaño que es un número de empleados («50-100»), el sistema DEBE guardarlo canónico; el que no lo es («unos 50») NO DEBE escribirse ni proponerse. · cubre G-1 · prueba: `src/lib/orchestrator/runner.test.ts`, sobre `normalizeProposed`
- **CA-5** CUANDO Parallel devuelve un tamaño como «50-100», el sistema DEBE guardar «50–100 empleados»; uno no numérico NO DEBE guardarse. · cubre G-1 · prueba: `src/lib/parallel.test.ts`
- **CA-6** Un valor que solo difiere en formato del actual NO DEBE generar sugerencia ni cambio propuesto: ni en `applyAutoChanges` ni en las pantallas de Clay y Apollo (`canonicalCurrent` antes de `enrichChanges`); un campo ya relleno nunca se reemplaza en automático. · cubre G-1 · prueba: `src/lib/field-proposals.test.ts` (decisión «same»), `src/lib/apollo.test.ts` (`canonicalCurrent`: «51-200 empleados» frente a «51–200 empleados» → sin cambio; país actual «Madrid, España» se conserva y `empty` sigue falso, así que no se sobrescribe) y `src/lib/field-proposals.test.ts` (el filtro de campo relleno de `runner.ts:124`, extraído a `field-proposals.ts` como función pura; el test falla primero solo porque la función aún no existe, el comportamiento ya existe)
- **CA-7** El esquema de `create_account` NO DEBE aceptar `size` ni `country`: al parsear, esas claves desaparecen (zod las quita; no salta error). Quien los añada al esquema deberá pasarlos por `normalizeForSave`. · cubre G-1 · prueba: `src/lib/agent/tools/core-write.test.ts` (archivo nuevo)

## 8. Casos límite y errores
- Tamaño vacío o «N/A»: no se escribe (ya ocurre en Parallel por `clean`).
- Tamaño de Clay no numérico («Self-employed», «0-1 employees»): no se guarda.
- País o tamaño vacío o no reconocido en automático: no se escribe; en la revisión manual («Completar cuenta») el valor ya llega canónico o no aparece como propuesta.
- Cuenta con valor previo en formato viejo: `fieldProposalDecision` ya canoniza para comparar en el camino automático; en la pantalla de Clay, `enrichChanges` hoy compara solo en minúsculas (`clay.ts:153`), por eso entra CA-6.
- Multitenant: sin cambios; las consultas siguen filtrando por `org_id`.
- Fallo del modelo o de Clay: sin cambios (los caminos existentes ya devuelven vacío o error).

## 9. Experiencia y copy
La revisión de «Completar cuenta» mostrará el valor ya canónico (p. ej. «51–200 empleados»). Si un país no se reconoce, no aparece como propuesta. Sin aviso en el camino automático: lo descartado no se escribe y la cuenta queda con el campo vacío para completarlo a mano. Decisión de Fede: la revisión manual tampoco avisa; lo descartado no aparece como propuesta.

## 10. Datos, permisos y privacidad
Sin tablas ni columnas nuevas, sin cambios de RLS ni GRANTs. Escribe en `accounts.size` y `accounts.country` con los permisos de hoy. Pruebas con datos ficticios, sin datos de clientes.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| ninguna nueva | regla (el cambio es una regla pura) | — | sin dato |

El prompt de `webFallback` no se toca en este SDD; si se quisiera pedir al modelo un formato concreto, es otra decisión.

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | `normalizeDraft` en `apollo.ts`; función de alta compartida (renombrar `accountInsertFromApollo`); `canonicalCurrent`; `clay-gateway.ts` y `apollo-gateway.ts` las usan; las dos altas de Clay y `apollo.tsx:83` llaman a la alta compartida | CA-1, CA-2, CA-6 (Clay y Apollo) | `src/lib/apollo.test.ts`: «51-200 employees» → «51–200 empleados»; «10,001+ employees» → «más de 10001 empleados»; «Self-employed» → sin tamaño; `canonicalCurrent` conserva «Madrid, España». Que los gateways llamen a estas funciones lo comprueba la revisión del diff (no hay test de gateways). Las aserciones de `clay.test.ts` (`companyToAccount`, `employeesText`) **no cambian**; `apollo.test.ts:83-108` se actualiza por el renombrado |
| U-2 | `normalizeProposed(change)` pura en `apollo.ts` (junto a `normalizeDraft`; sin imports nuevos), usada por `webFallback` y `applyAutoChanges`: país ISO o no se escribe; tamaño canónico o no se escribe; filtro de campo relleno extraído (a `field-proposals.ts`, que `runner.ts` hoy importa de forma dinámica). Actualizar `src/lib/AGENTS.md:53` | CA-3, CA-4, CA-6 (automático) | `src/lib/orchestrator/runner.test.ts` (nuevo, sin IA ni red): «Madrid, España» → descartado; «España» → ES; «unos 50» → descartado; «50-100» → «50–100 empleados»; el campo relleno no se reemplaza se prueba en `field-proposals.test.ts` (ver CA-6) |
| U-3 | Parallel normaliza `size` en `readEnrichRows`; no numérico no se guarda | CA-5 | `src/lib/parallel.test.ts`: «50-100» → «50–100 empleados»; «unos 50» → sin tamaño |
| U-4 | Fijar que `create_account` descarta `size`/`country` al parsear | CA-7 | `src/lib/agent/tools/core-write.test.ts` (nuevo). **Test de regresión, no fail-first:** zod ya quita esas claves hoy, así que pasa desde el principio |

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- Normalizar **en el origen** (`companyToAccount`/`enrichChanges` y `webFallback`) cubre los hallazgos 1 a 7 sin tocar cada pantalla; es la propuesta de la auditoría.
- Importación circular: hoy no hay ciclo; aparecen dos si `clay.ts` importa `normalizeForSave`. Por eso `clay.ts` no cambia: la regla vive en `apollo.ts` (`normalizeDraft`), que ya importa clay y field-normalize, y la llaman los gateways y `runner.ts`. El gate comprobó leyendo los `import` que así no hay ciclo; **no se ha ejecutado** build ni lint de ciclos.
- Hay dos `employeesText`: el de `clay.ts:93` (texto) y el de `icp.ts` (rango → texto, usado por `field-normalize.ts`). No confundirlos.
- Descartado: normalizar en cada pantalla (duplica la regla, que es lo que NK-0006 quiso evitar).

## 14. Riesgos y dependencias
- Depende de NK-0006 (el catálogo y `normalizeForSave`), que está en PROMOTED y con la migración 0058 sin verificar.
- Cambiar la función de alta compartida y `canonicalCurrent` afectan también a Apollo (declarado en la sección 6).
- Descartar país y tamaño no reconocidos deja algunas cuentas con el campo vacío donde antes tenían texto libre; para el país `update_account` rechaza con error (`accounts.ts:110-125`) y aquí se descarta sin error, porque no hay quien lo lea. Para el tamaño es más estricta: `update_account` lo guarda tal cual con aviso. Se limita a proveedores externos y web y se escribe en `src/lib/AGENTS.md:53`.
- Los datos ya guardados no mejoran con este cambio.

## 15. Preguntas para Fede y para la revisión técnica
**Decididas por Fede el 2026-10-28:**
1. País no reconocido en automático: se descarta (no se escribe).
2. Tamaño que no es un número de empleados en automático: se descarta.
3. Backfill: se mide primero, sin escribir; si hace falta, otro SDD.
4. ICP: ticket aparte, fuera de este SDD.

5. Regla de `src/lib/AGENTS.md:53`: el tamaño no numérico no se guarda en los caminos de proveedores externos y web (Clay, Apollo, IA web en manual y automático, Parallel); el resto conserva el original.
6. Tamaño de Clay no numérico («Self-employed», «0-1 employees») y de Parallel: no se guarda.
7. Las pantallas de Clay y Apollo comparan en forma canónica (valor actual canonizado antes de `enrichChanges`).
8. Diseño: `normalizeDraft` en `apollo.ts`, `clay.ts` sin cambios (evita el ciclo).

9. La revisión manual de «Completar cuenta» no avisa de lo descartado (decidido el 2026-10-28).

**Abiertas:** ninguna de producto ni de revisión técnica; las decisiones de la lista de arriba son las de Fede.

## 16. Pendiente de verificar
- **[Por verificar]** Cuántas `accounts.size` con guion corto y cuántas `accounts.country` en texto libre hay hoy. Quién: consulta de solo lectura a la base.
- **[Por verificar]** Filas de `import_rows` encoladas antes de NK-0006 que conserven el formato viejo (hallazgos 11 y 12). Quién: consulta a la base.
- Triggers y funciones SQL: el gate leyó `drizzle/migrations/` (incluida `create_organization`, en 0002, 0020, 0028 y 0056): solo hay inserts de `name` en 0012 y 0023; ninguna escritura SQL toca `accounts.size` ni `accounts.country`. **[Por verificar]** solo las funciones creadas en la base fuera de las migraciones.
- **[Por verificar]** Hallazgos 15-17 (ICP, fuera de este SDD): leídos a nivel de línea, no ejecutados; el zod de `countries` en `create_icp` no se ha releído entero. Quedan para su ticket.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
**Los informes de abajo son de versiones anteriores del borrador; el cuerpo se revisó después de cada uno. Tras la cuarta (objeciones menores de texto) se retocó el cuerpo.**

### Gate corto del delta de formato (2026-10-29)
- Commit verificado: `adc93bfc25af336c89a3852db3e90e260a6017a3` (rama `integration/20261029-nk0018`, merge `--no-ff` de `feat/field-write-paths-normalization` 2408a43 sobre la base `fc45f3a7e1353bace009550b0e1f75fc3f0e6a90`). El código es el de `990ea2e`, ya revisado por el gate anterior, más un commit de formato prettier (`2408a43`, 11 archivos de `src/lib`).
- Veredicto del gate: **Sin objeciones.** AST idéntico en los 11 archivos (11/11 sin diferencias; el comparador marca como distinto un `===` cambiado por `!==`); `git diff e3c6327 adc93bf` es idéntico byte a byte a `git diff 990ea2e 2408a43`; tsc exit 0; build exit 0; vitest 795/795 en 97 archivos; `gate.mjs` solo FAIL por el lint previo (NK-0021).
- Lint por delta: errores que no son de prettier 7 → 7; prettier 457 (base) → 475 (`e3c6327`) → 448 (`adc93bf`). Quedan 3 errores de prettier en líneas editadas fuera de la disposición aplicada (`clay.tsx:97`, `orchestrator/icp-companies.tsx:98`, `apollo-gateway.ts:7`), ya largas en la base; encajan en NK-0021.
- Hallazgo menor de trazabilidad: los `tsc.txt`, `vitest.txt` y `vite-build.txt` del autor no indican sobre qué commit se generaron y se escribieron antes del commit `2408a43`; la ejecución del gate sobre `adc93bf` cubre ese hueco.
- Lo que esta revisión NO demuestra: la corrección funcional de CA-1 a CA-7 (viene del gate sobre `e3c6327`); segunda máquina ni soak; que el formato coincida con prettier más allá de los recuentos de lint; sobre qué commit generó el autor su evidencia.

### Gate sobre el código entregado (2026-10-29; informe completo abreviado en `side-session-notes/local_d3ccbb81…/NK-0018-gate.md`)
- Commit verificado: `e3c6327666d3d947ad2f0366c18af2a8d38f66a9` (rama `integration/20261028-nk0018`, merge `--no-ff` de `feat/field-write-paths-normalization` 990ea2e sobre la base `fc45f3a7e1353bace009550b0e1f75fc3f0e6a90`). El SDD que aprobó Fede incluía retoques de texto que el gate de las pasadas 1 a 4 no vio.
- Veredicto del gate: **Sin objeciones bloqueantes.** `gate.mjs` da FAIL solo por el lint de los 14 archivos tocados; por delta, los errores que no son de prettier son los mismos 7 que en la base. Ningún test falla.
- Medido: tsc exit 0; vitest 795/795 en 97 archivos; mutación (quitar `normalizeProposed` de `applyAutoChanges`) pone en rojo 6 de 8 tests de runner; sin ciclos de importación en 115 archivos (script propio sobre imports estáticos).
- Escritores de `accounts.size`/`country`: todos los del alcance quedan normalizados; los de fuera de alcance (`update_account`, Descubiertos, ficha, CSV, importaciones y API pública) conservan el original, como dice el SDD §5. Triggers SQL: sin auditar.
- Hallazgos (todos de severidad baja): (1) decimales: «12.5» pasa a guardarse «5–12 empleados» también desde Clay, IA web y Parallel; relacionado con NK-0020. (2) «UK», «uk» y «England» se descartan; sin alias sería otro ticket. (3) `src/lib/AGENTS.md:53` atribuye a las pantallas lo que hacen los gateways. (4) prettier: +18 errores en líneas nuevas (457 → 475); deuda previa en NK-0021.
- CA sin prueba posible o sin G-n: ninguno; CA-2, CA-3 y CA-4 quedan parciales por declaración (el uso en pantalla y `webFallback` los comprueba la lectura del diff, y el gate probó `applyAutoChanges` con un doble de base propio).
- Lo que esta revisión NO demuestra: `webFallback` con IA y red reales; pantallas y gateways con proveedores reales; app, walkthrough y móvil/escritorio; `autopilot`, `lead-tasks` y `job-runner` de punta a punta; segunda máquina y soak (no ejecutados); volumen de datos afectados, `import_rows` antiguas, funciones SQL y migración 0058.

### Cuarta pasada del gate (2026-10-28, sobre la versión corregida tras la pasada 3; contenido íntegro, formato abreviado)
- Veredicto del gate: **hay objeciones, todas menores y de texto**. Las tres objeciones de fondo de la pasada 3 están cerradas; nada obliga a cambiar el diseño.
- **(a.1) Cerrada, comprobado con `tsx`** (el gate simuló `canonicalCurrent` y `normalizeDraft` tal como las describe el SDD, con datos ficticios, y las pasó por `enrichChanges` y `fieldProposalDecision` de HEAD; no existen todavía en el repo): con `canonicalCurrent`, un país actual «Madrid, España» da `empty:false`, `propose`, no se escribe; tamaño «unos 50» → `propose`; «51-200 empleados» y «ES» sin cambios; campos vacíos → `write`. Usando `normalizeDraft` sobre el valor actual (el fallo de la pasada 3), «Madrid, España» daba `empty:true` y `write`. `autopilot.server.ts:32-33`, `job-runner.server.ts:106-108` y `lead-tasks.server.ts:69-72` llegan a los gateways a través de `completeAccount` (`runner.ts:88`), así que canonizar en `clay-gateway.ts:90` y `apollo-gateway.ts:144` cubre los tres.
- **(a.3) Cerrada.** Apollo en la lista de proveedores (secciones 6, 15.5, 14); `apollo.tsx:21` y `:83` ciertas; efecto en Agente y MCP declarado. Resto menor: el título, la sección 1 y H-1 nombraban solo Clay, web y Parallel.
- **(d) Atendida en parte:** la sección 16 conservaba «el ciclo de importación no rompa el build» y la nota de la sección 18 afirmaba que se había corregido.
- CA sin prueba posible o sin G-n: todos citan G-1 y todos tienen prueba posible. **U-4/CA-7 no puede fallar primero:** `core-write.ts:19` no es `.strict()` y zod ya quita esas claves; debe declararse regresión. U-2: el comportamiento «campo relleno no se reemplaza» ya existe (`runner.ts:124`), así que el test solo falla porque la función extraída no existe; la sección 5 mandaba el filtro a `field-proposals.ts` pero lo probaba en `runner.test.ts` (fijar un sitio). U-1, U-3 y la combinación de CA-6 («Madrid, España» y `empty:false`) sí fallan primero; para CA-2 solo «Self-employed» falla primero contra la alta actual. La sección 5 no decía en qué módulo vive `normalizeProposed`.
- **Imports:** sin ciclos (recorrido de imports estáticos, no build). El cierre de `apollo.ts` no incluye gateways, `runner.ts`, `parallel.ts`, `field-proposals.ts` ni pantallas; `parallel.ts` puede importar `field-normalize` sin ciclo; `canonicalCurrent` y `normalizeDraft` no necesitan imports nuevos.
- **Citas contra HEAD `8524c92`** (no `224b24b`): ese commit tocó `accounts.ts`: el país se rechaza al proponer, en el esquema (`accounts.ts:16-22`), y en `run` (`:113-122`, el `throw` en la 118). Aproximadas: secciones 14 (`110-125`) y 3 (`101-118`); `clay.ts:153` es el `trim`, la comparación en minúsculas está en la 154. El resto, correcto.
- [Por verificar] sin comprobar: volumen de cuentas afectadas, `import_rows` antiguas, migración 0058. **`create_organization` se cierra por lectura:** está en `drizzle/migrations/` (0002, 0020, 0028 y 0056; las pasadas 1 y 2 dijeron lo contrario); solo hay inserts de `name` en 0012 y 0023; no cubre funciones creadas en la base fuera de las migraciones.
- Contradicciones: (1) sección 16 con la entrada del ciclo; (2) sección 15 «Abiertas» decía «queda la tercera pasada»; (3) «No cambia pantallas» (sección 1) y «Cambios visuales» (sección 5) chocan con el cambio declarado en la columna «actual» y en `proposalSuggestion`: precisar que solo cambia el formato del valor; (4) sin choque con NK-0006 CA-1 si se actualiza `src/lib/AGENTS.md:53`; sin contradicciones con el `AGENTS.md` raíz. Alcance: no falta ni sobra nada.
- Lo que esta revisión NO demuestra: no ejecutó `gate.mjs` ni `flake.mjs`; `canonicalCurrent` y `normalizeDraft` son simulaciones del gate, no la implementación; los tests propuestos no existen y no se ha visto que fallen primero; solo tests de base (49 de 49 en verde, 5 archivos); sin build ni lint de ciclos; sin consulta a la base ni RLS; sin segunda máquina ni soak.
- **Tras esta pasada** se corrigieron en el cuerpo los restos de texto señalados (título, sección 1, H-1, secciones 5, 12, 15, 16 y 18, HEAD, U-4 como regresión, filtro en `field-proposals.ts`). El gate no ha visto esos retoques de texto.

### Tercera pasada del gate (2026-10-28, sobre la versión vigente en ese momento; contenido íntegro, formato abreviado)
- Veredicto del gate: **Objeciones**. Pasada 2: las objeciones 2 y 4 quedaron atendidas; la 3 con una contradicción interna; la 1 sigue sin cerrar.
- **a.1 (sin cerrar):** el SDD no nombra la función que canoniza el valor actual antes de `enrichChanges`, y `normalizeDraft` deja vacío lo que no encaja. Si se usara para el valor actual, un campo relleno pasaría a parecer vacío y se sobrescribiría en automático (comprobado con `tsx`: el país actual «Madrid, España» queda `null`, `enrichChanges` lo marca `empty:true` y `fieldProposalDecision` devuelve `write`). Eso viola la última frase de CA-6 en `autopilot.server.ts:32-33`, `job-runner.server.ts:106-108` y `lead-tasks.server.ts:69-72`. Hace falta una función pura aparte que canonice el valor actual conservando el original cuando no encaja, calcule `empty` sobre el valor crudo y tenga el test de CA-6 en `apollo.test.ts`.
- **a.2 (atendida):** `normalizeDraft` en `apollo.ts` permite un test que falla primero en `apollo.test.ts`, alimentado con `companyToAccount`; las aserciones de `clay.test.ts:25/34/62` no cambian.
- **a.3 (atendida con contradicción):** la sección 6 pone Apollo en «el resto conserva el original» y a la vez dice que el alta de Apollo deja de guardar el tamaño no numérico; lo mismo al completar con Apollo (`apollo-gateway.ts`). Apollo debe estar en la lista de proveedores, también en el texto de `src/lib/AGENTS.md:53`.
- **a.4 (atendida):** manual y automático en secciones 6, 15.5 y CA-3, más Clay y Parallel.
- **b) Imports:** sin ciclos (leyó `apollo.ts`, `field-normalize`, `field-catalog`, `icp`; nada vuelve a los gateways, `runner.ts` ni `parallel.ts`). El filtro de `runner.ts:124` se puede extraer sin ciclo, pero `field-proposals` hoy se importa dinámicamente: importarlo estático o poner la función en `field-proposals.ts`. Hueco: el SDD no dice si `parallel.ts` usa `normalizeForSave` o `normalizeDraft`.
- **c) Citas:** correctas en general. Aproximadas: `accounts.ts:101-118` (la normalización está en 110-125) y `apollo.ts:70-79` (71-83). La sección 3 sigue citando HEAD `f9339a4`; el actual es `224b24b`. Llamadores completos de `enrichChanges` y `companyToAccount`; **falta `src/components/apollo.tsx:21,83`** en `accountInsertFromApollo` (el renombrado obliga a tocarlo).
- **d) Contradicciones nuevas:** la de Apollo (a.3); la sección 14 dice que el país sigue «la misma regla que `update_account`», pero `update_account` rechaza con error (`accounts.ts:19`, `:117-118`), no descarta en silencio; al canonizar el valor actual, la columna «actual» de las revisiones de Clay, Apollo y «Completar cuenta» y el texto de `proposalSuggestion` mostrarán el valor canonizado y no el guardado, y no está declarado; la sección 16 conserva un resto («que el ciclo no rompa el build»).
- **e) Alcance:** falta `apollo.tsx:83`, la función pura que canoniza el valor actual con su test, y declarar que los resultados de búsqueda del Agente y MCP (`agent/tools/clay.ts`, vía `clay-gateway.ts:67`) cambian de formato (inofensivo, pero es un cambio). Sobra: nada.
- CA sin prueba posible o sin G-n (todos citan G-1): CA-6 Clay/Apollo (no hay función pura que probar, a.1); CA-1 «al completarla» y CA-6: que los gateways usen `normalizeDraft` solo se ve en la revisión del diff, igual que CA-2, pero el SDD solo lo declara para CA-2. CA-3, CA-4, CA-5 y CA-7 viables.
- [Por verificar] sin comprobar: volumen de cuentas afectadas, `import_rows` antiguas, `create_organization`, migración 0058.
- Lo que esta revisión NO demuestra: no ejecutó `gate.mjs` ni `flake.mjs`; solo tests de base (38 de 38 en verde); los tests propuestos no existen y no se comprobó que fallen primero; la ausencia de ciclos sale de leer imports, no de build ni lint; no consultó la base ni el RLS; sin segunda máquina ni soak.

**Tras esta pasada se corrigió el cuerpo del SDD (ver «Cambios tras la pasada 3» en la sección 18). No hay cuarta pasada.**

### Segunda pasada del gate (2026-10-28, sobre la versión revisada; contenido íntegro, formato abreviado)
- Veredicto del gate: **Objeciones**. Quedan atendidas (b), (d) y las contradicciones 4 y 7 de la primera pasada. (a), (c) y la contradicción 3 se atendieron en el texto, pero la solución choca con la sección 13. Cuatro correcciones antes de aprobar:
1. **`enrichChanges` canónico contra «`clay.ts` no importa `normalizeForSave`».** `enrichChanges` vive en `clay.ts:149-162`; comparar en forma canónica trae el ciclo, y el test de CA-6 en `clay.test.ts` obliga a meter la regla en `clay.ts`. Opciones: canonicalizar el valor actual en `clay-gateway.ts:90` y `apollo-gateway.ts:144` antes de llamar, o pasar un comparador como parámetro. `apollo-gateway.ts:144` también usa `enrichChanges`: el cambio afecta a Apollo y el SDD no lo declara.
2. **Los tests de U-1 apuntan al sitio equivocado.** `clay.test.ts:25` y `:34` prueban `companyToAccount`/`employeesText` (de `clay.ts`); con la normalización en el gateway no cambian y no pueden fallar primero. `clay-gateway.ts` no tiene test y llama a la red. Hace falta una función pura (p. ej. `normalizeDraft(d)`) en un módulo que ya importe la regla (`apollo.ts`), probada en `apollo.test.ts` y usada por el gateway y el alta. Cita errónea: la aserción de `enrichPatch` está en `clay.test.ts:62`, no en la 61.
3. **La función de alta compartida contradice CA-1.** `accountInsertFromApollo` (`apollo.ts:71-83`) guarda el tamaño no numérico con el original (comprobado: «Self-employed empleados» da `unnormalized` con ese value). Las filas de `job.result` (24 h) pasarían por ahí y CA-1 no se cumpliría. Descartarlas cambia también el alta de Apollo (en la práctica siempre da «N empleados», pero hay que declararlo) y `apollo.test.ts:83-108` al renombrar.
4. **La excepción a `src/lib/AGENTS.md:53` está mal acotada.** `webFallback` no es solo automático: `completeAccount` se llama en manual desde `orchestrator.functions.ts:14`, `job-runner.server.ts:106` y `agent/tools/needs.ts:16`, así que «unos 50» y «Madrid, España» tampoco llegarán a la revisión manual. Las secciones 6 y 15.5 y el texto previsto para AGENTS.md dicen «solo automático». Hay dos descartes más fuera del camino automático que el texto no recoge: el tamaño de Clay no numérico (decisión 6) y el de Parallel (U-3, que no es una decisión de Fede).
- CA sin prueba posible o sin G-n (todos citan G-1): CA-1 (sin test realista que falle primero, punto 2); CA-6 parte Clay (punto 1; el filtro de `runner.ts:124` sí se puede extraer, pero U-2 no nombra su caso); CA-2 aceptable (uso desde las dos pantallas por revisión del diff). CA-3 y CA-4 viables (`runner.ts` y `clay-gateway.ts` se importan sin efectos secundarios, comprobado con `tsx`). CA-5 y CA-7 viables.
- [Por verificar] sin comprobar: volumen de datos y `import_rows` antiguas; `create_organization` (no está en `drizzle/migrations/`); migración 0058; «el ciclo no rompe el build» deja de aplicar con el diseño propuesto salvo por el punto 1.
- Contradicciones: las de los puntos 1, 3 y 4; con NK-0006 CA-3, `clay.test.ts:34` no puede pasar al formato nuevo sin duplicar la regla en `clay.ts` o sin ciclo; menor: la sección 15 da por «cerrada por el gate» la cuestión del ciclo y el gate solo propuso una alternativa; menor: la sección 3 cita HEAD `f9339a4`, el actual es `224b24b` (las líneas siguen siendo válidas).
- Alcance: sobra «`complete-account.tsx` apply» (sección 5) si se normaliza en el origen. Falta declarar el efecto en `apollo-gateway.ts:144`, el renombrado en `apollo.test.ts` y que `lead-tasks.server.ts:73` copia `ch.proposed` en memoria (solo funciona si se normaliza en el origen).
- Comprobado por el gate: citas releídas y correctas salvo `clay.test.ts:61`; valores ejecutados con datos ficticios coinciden; sin ciclo si `clay-gateway.ts`, `runner.ts` o `parallel.ts` importan `field-normalize`, ni si `clay.tsx`/`icp-companies.tsx` importan `apollo.ts`; sí con `clay.ts`; 55 de 55 tests de base pasan.
- Lo que esta revisión NO demuestra: no ejecutó `gate.mjs` ni `flake.mjs`; los tests propuestos no existen, no se comprobó que fallen primero; no ejecutó build ni lint de ciclos (grafo leído, no medido); no consultó la base ni el RLS; sin segunda máquina ni soak.

### Primera pasada (versión anterior del borrador)
Informe del gate (agente `nokko-gate`, contexto fresco, 2026-10-28), copiado sin cambiar su contenido; solo se pasó la tabla de la sección 1 a viñetas y se abrevió alguna frase. Nota del coordinador: el informe se hizo sobre el HEAD `deb46ca`; el SDD citaba `f9339a4` (la auditoría).

- Veredicto del gate: **Objeciones**
- Resumen del gate: casi todo lo de la sección 3 es cierto. Impiden aprobar: (a) tres aserciones de tests existentes esperan el formato viejo y el SDD no lo dice; (b) dos archivos de test nombrados no existen y uno sería difícil de escribir tal como está el código; (c) la decisión 2 choca con `src/lib/AGENTS.md:53`; (d) faltan casos límite de Clay.

### 1. Afirmaciones de la sección 3
Valores probados con datos ficticios: coinciden con el SDD («51-200 employees» → «51-200 empleados» → «51–200 empleados»; «10,001+» → «más de 10001 empleados»; «1001-5000» → «1001–5000 empleados»; «España» → ES; «Madrid, España» y «unos 50» → `unnormalized`; Parallel «50-100» se queda tal cual; vacío frente a «unos 50» da `write`).
- Correctas: `clay.ts:92`, `93-96`, `104`, `105`; `clay.tsx:96`, `279`; `runner.ts:140`; `field-proposals.ts:17`; `parallel.ts:176`, `parallel.tsx:224`; `apollo.ts:70-79`.
- Aproximadas: `clay.ts:150-166` (`enrichChanges` 149-162, `enrichPatch` 165-167); `runner.ts:60-72` (`webFallback` 58-72); `accounts.ts:104-112` (101-118).
- `icp-companies.tsx:97`: código idéntico, pero esas filas salen del runner, que trae empresas de Apollo y de Clay (`runner.ts:6-7`); no es una alta «solo de Clay».
- `complete-account.tsx:50`: la ruta real es `src/components/orchestrator/complete-account.tsx`.
- Incorrecta: `parallel.ts:168-170`; `readEnrichRows` está en 160-173, `clean` en la 163 y `size: clean(r.size)` en la 171 (la escritura del tamaño, en `parallel.ts:179`).

### 2. Pruebas de los CA y las U
- Existen: `src/lib/clay.test.ts`, `src/lib/parallel.test.ts`, `src/lib/field-proposals.test.ts`. No existen: `src/lib/orchestrator/runner.test.ts`, `src/lib/agent/tools/core-write.test.ts`. Todos los CA citan G-1.
- Tres aserciones esperan el formato viejo: `clay.test.ts:25` («1001-5000 empleados»), `:34` («51-200 empleados») y `:61` (`enrichPatch` → «51-200 empleados»). U-1 obliga a cambiarlas y el SDD no lo declara; debe decir cuáles cambian y por qué.
- CA-3 y CA-4 (`runner.test.ts`, nuevo): `webFallback` no se exporta y llama a la IA y a la web; `runner.ts` es de servidor. Un test que falle primero exige extraer una función pura (p. ej. normalizar un `SourcedChange`) o un doble de la base como el de `accounts.normalize.test.ts`. En U-2 la columna del test no nombra ningún caso.
- CA-2: el test puede comprobar la función compartida, no que `clay.tsx` e `icp-companies.tsx` la usen (mismo hueco que el CA-1 de NK-0006).
- CA-6: `field-proposals.test.ts` cubre `fieldProposalDecision`, pero «no reemplazar un campo relleno» vive en el filtro `ch.empty` de `runner.ts:124`, que ese test no prueba.
- CA-7 (`core-write.test.ts`, nuevo): viable; zod quita las claves desconocidas, así que el test debe comprobar que `size`/`country` desaparecen al parsear, no que salte un error. «Sin pasar por la regla» es ambigua: hoy no se admiten en absoluto.

### 3. Ciclo clay.ts ↔ field-normalize.ts
- Hoy no hay ciclo (`clay.ts` solo importa `assignment`, `leads`, `dedupe`). Si `clay.ts` importa `normalizeForSave` aparecen dos: clay → field-normalize → clay y clay → field-normalize → icp → clay.
- Probablemente no rompe nada (ni `field-normalize.ts` ni `icp.ts` usan lo importado de clay al cargarse), pero es frágil. No ejecutó el build ni comprobó reglas de lint contra ciclos.
- Alternativa mínima sin módulo nuevo: reutilizar `accountInsertFromApollo` (`apollo.ts:71-83`, acepta cualquier `AccountDraft`) para las dos altas, renombrada a algo genérico; y normalizar el tamaño de origen en `clay-gateway.ts` (único que llama a `companyToAccount`/`enrichChanges`, `clay-gateway.ts:67`, `89-90`).
- Alternativa de raíz: mover `isoFromCountry` a `assignment.ts` (donde está `COUNTRY_CODES`) y reexportarlo desde clay.

### 4. Contradicciones
1. La decisión 2 choca con `src/lib/AGENTS.md:53` («A value that does not fit comes back as «unnormalized» with the original, never dropped; country is the exception»). Todos los caminos actuales conservan un tamaño no numérico: `update_account` (con aviso), `accountInsertFromApollo`, Descubiertos (`discoveries.functions.ts:48-49`), FitFields, CSV (`account-import.ts:115-118`). El SDD debe decir que AGENTS.md:53 cambia, o limitar la excepción al camino automático y escribirla ahí.
2. Casos límite de Clay sin definir: «Self-employed» acaba como «Self-employed empleados» y «0-1 employees» como «0-1 empleados»; ambos dan `unnormalized`. El SDD no dice si se descartan o se guardan.
3. `enrichChanges` compara solo en minúsculas, no con la forma canónica (`clay.ts:153`): una cuenta con «51-200 empleados» recibirá en la pantalla de Clay un cambio que solo difiere por el guion. CA-6 solo cubre `applyAutoChanges`.
4. Las filas de `icp_companies` se guardan en `job.result` durante 24 h; normalizar solo en el origen no corrige las ya guardadas al importarlas. Argumento para normalizar también al insertar (CA-2).
5. Menor: la sección 9 dice que en la revisión manual el valor «no aparece»; el CA-3 habla solo del camino automático.

### 5. Caminos de escritura que faltan
Sin hueco nuevo: `parallel.tsx:137`, Apollo al completar (`apollo.tsx:296`), `fit-fields.tsx:40/53`, Descubiertos, `leads-ingest`, `lead-tasks`, `tool-kit:95`, `accounts.index.tsx:64`. Ya en la sección 16: `imports.functions.ts:95-97` y `api/public/accounts.ts:74-77` insertan `raw.size` y dependen de normalizar al encolar. SQL: en `drizzle/migrations/` ninguna escritura toca `size`/`country` (solo el nombre en 0012 y 0023); no hay `supabase/migrations`.

- CA sin prueba posible o sin G-n: CA-3 y CA-4 (sin función pura ni test que falle primero posible tal como está); CA-2 y CA-6 (prueba incompleta); CA-7 (formulación ambigua). Todos citan G-1.
- [Por verificar] que sigue sin comprobarse: volumen real de datos y filas antiguas de `import_rows`; si el ciclo rompe el build; migración 0058; `create_organization` (no está en `drizzle/migrations`, no se revisó la base).
- Contradicciones con el código o con decisiones previas: las de la sección 4 (sobre todo `src/lib/AGENTS.md:53`).
- Lo que esta revisión NO demuestra: no ejecutó `gate.mjs` ni `flake.mjs` (no hay código); no ejecutó tests ni build, ni comprobó que los tests propuestos fallen sobre `deb46ca`; no consultó la base ni el RLS; el ciclo está razonado, no ejecutado; sin segunda máquina ni soak.

## 18. Delta de implementación (lo rellena el agente al entregar)
Sin implementar. Estado «Borrador».

**Cambios tras la pasada 3 (2026-10-28):** añadida `canonicalCurrent` (conserva el original, `empty` sobre el valor crudo) y su test; Apollo en la lista de proveedores; `apollo.tsx:83` y el efecto en Agente/MCP declarados; contradicciones de las secciones 6, 14 y 16 y la cita de HEAD corregidas. Cuarta pasada: solo objeciones menores de texto, retocadas después (el gate no ha visto esos retoques).
