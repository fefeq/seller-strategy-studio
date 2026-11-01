# SDD-20261101-fit-data-7a-llave-minima-revalidado · [Mejora] Llave mínima comprobada en un solo sitio y completado asistido del dominio (NK-0012)

**Tipo:** Mejora (el original era «Feature»; revalidado, lo que cabe hoy es acotado y sin esquema) · **Prioridad propuesta:** Media
**Estado:** Borrador (primera pasada del gate respondida; falta la segunda) · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-11-01
**PRD:** `docs/prd/PRD-20261028-ux-onboarding-coherencia.md` (G-5) · **Depende de:** `SDD-20261025-universal-field-definitions` (U-1 a U-4 hechas; 0058 sin aplicar en producción hasta donde consta, ver §16) y `SDD-20261025-field-actions-edit-delete-confirm` (U-1 a U-5 hechas)
**Ticket:** NK-0012 (`LOGGED`). Este SDD **sustituye el alcance** de `SDD-20261025-fit-data-7a-llave-minima-y-completado` y **no lo reescribe**: el original solo se toca (cabecera «Sustituido por…») con aprobación de Fede.

> Nivel elegido (`nokko-shape`): **SDD corto, sin PRD nuevo.** El PRD de la iniciativa ya fija G-5 y su línea base es una consulta, no un documento. «Solo ticket» se queda corto: hay una regla nueva (qué es una llave) que debe valer igual en pantalla, Agente y automatismos. «PRD + SDD» no añade nada una vez que lo que exige esquema (competidores, vínculo de personas, resultados de terceros) se queda en 7b y 7c.

## 1. Resumen
El 7a original sigue **vigente en su intención** pero está **desfasado en tres cosas**: parte de sus «Por verificar» ya se resuelven en el código, dos de sus premisas son falsas hoy (`alreadyHave` no se usa; el país y el tamaño ya se normalizan) y dos de sus CA chocan con lo que `main` hace en la entrada de leads. Este SDD lo recorta a lo que **no necesita esquema ni migración**: un módulo puro de llave mínima con un error tipado y un único mensaje de «falta X» en los puntos por los que pasan todas las peticiones, una lista única de correo personal y la propuesta de dominio para cuentas que no lo tienen. Lo demás (competidores, vínculo `people`–`stakeholders`, resultados de terceros) sigue en 7b y 7c.

## 2. Problema y para quién
Founder: pide investigar una cuenta y recibe un error distinto según la pantalla, o nada si lo lanza un automatismo que la salta en silencio. Equipo: la regla «qué hace falta para investigar» está repartida en varios sitios y la lista de correo personal, en cuatro, con contenido distinto.

## 3. Evidencia y por qué ahora
Leído el 2026-11-01 sobre `origin/main` (`11bc398`). No he ejecutado tests, la app ni consultado la base de datos.

### 3.1 Qué cambió en `main` desde el 2026-10-25 y su efecto sobre 7a
- **Quitar la UI multiempresa (#53, `278159b`, «Simplify company UI for single-company internal use»):** no choca. 7a no cita ninguna pantalla de empresas. Sigue valiendo la regla de `src/lib/AGENTS.md:47`: los núcleos compartidos filtran por empresa e insertan `org_id` explícitamente; `fit-key.ts` es puro y no toca la base de datos.
- **NK-0006/0018/0019/0020/0035 (país y tamaño):** hacen **obsoleto el hallazgo 1** del original («`country` y `size` son texto libre sin normalizar»). Hoy se normalizan al guardar (`src/lib/field-normalize.ts`; Descubiertos: `discoveries.functions.ts:46-49`; Clay, Apollo, web y Parallel: `d17fba7`). El «tamaño y país → valores normalizados» del delta del original está **hecho**.
- **NK-0038/0040/0041/0042 (sugerencias y precio):** dan un **patrón reutilizable** para «propón y espera»: `src/lib/field-proposals.ts` (clave estable por valor, descartado no vuelve) y los detectores de `src/lib/proactive/detectors/`. **NK-0036** es LinkedIn de empresa (`11e9b53`, `58eac68`): sin relación con 7a.
- **NK-0008 y NK-0046:** sin relación.
- **Archivos que cita 7a en §13:** `planner.ts`, `leads-ingest.ts`, `lead-qualification.ts`, `autopilot.server.ts`, `stakeholders-tab.tsx`, `discoveries.server.ts` y `src/lib/inngest/lead-tasks.server.ts` **no tienen commits desde el 2026-10-25**; `runner.ts` solo por propuestas de campo (`d451942`), normalización (`d17fba7`) y formato; `apollo.ts` y `clay.ts`, por normalización de país/tamaño y formato (`git log --since=2026-10-25`).

### 3.2 Revalidación hallazgo a hallazgo
| Hallazgo del original | Veredicto | Evidencia (archivo:línea) |
|---|---|---|
| 1. Cuentas, 22 columnas; país y tamaño libres; sin ciudad ni ingresos | **Parcialmente obsoleto.** Hoy son 23 columnas (`last_human_edit_at`); país y tamaño ya se normalizan; sigue sin ciudad, ingresos ni descripción | `src/integrations/supabase/types.ts:245-270`; `field-normalize.ts`; `discoveries.functions.ts:46-49` |
| 2. Dominio como llave | **Vigente y más amplio.** No lo exigen solo Apollo y el investigador: Clay (personas y completar cuenta), Apollo (completar cuenta), investigación web y el flujo de leads. Parallel **no** lo exige | `apollo.ts:55-58`, `clay.ts:190-197`, `clay-gateway.ts:190-195`, `apollo-gateway.ts:358-364`, `web-research-core.ts:43-44`, `inngest/lead-tasks.server.ts:63,89`; Parallel: `parallel.ts:86` (dominio opcional); autopilot: `autopilot.ts:8-11` y `autopilot.test.ts:8-18` |
| 3. `people` y `stakeholders` sin vínculo **[Por verificar]** | **Resuelto: no hay vínculo.** Ninguna tabla tiene la FK de la otra. Pasa a 7c | `types.ts:3656-3674` (`people`), `:4571-4590` (`stakeholders`) |
| 4. Sin nombre/apellido, teléfono ni ubicación en `people` | **Vigente en el dato; la necesidad no está probada.** Apollo ya parte el nombre al llamar | `types.ts:3656-3674`; `apollo.ts:262-266` |
| 5. Leads, 34 columnas; email personal; sin vínculo estable | **Vigente.** Hoy la entrada de leads **ya crea la cuenta y la persona** y escribe el dominio sin preguntar | `types.ts:2857-2892`; `leads-ingest.ts:50-70`; `inngest/lead-tasks.server.ts:35-59` |
| 6. Competidores sin entidad | **Vigente, pasa a 7b.** Siguen en texto; `knownCompetitors` está en `discoveries.ts:28`, no en `.server.ts` | `discoveries.ts:28-35`; `discoveries.functions.ts:72-74` |
| 7. ICP con campos de búsqueda | **Vigente, no se toca.** | — |
| 8. «El planificador salta lo ya tenido» | **Falso hoy.** `alreadyHave` existe en la firma y en el filtro, pero **ningún llamador lo pasa** | `planner.ts:39,52`; `runner.ts:88-94` (`planNeed`). Pasa a 7c (CA-16 original) |

### 3.3 Revalidación CA a CA del original
| CA original | Veredicto | Evidencia / motivo |
|---|---|---|
| CA-1 definir y comprobar llave mínima | **Vigente, sin hacer.** No existe módulo de llave; cada integración lanza su propio error | los sitios del hallazgo 2; `planner.ts:5-37` no declara llaves |
| CA-2 decir qué falta, por qué y ofrecer completarlo | **Vigente, a medias.** El texto «La cuenta no tiene dominio. Añádelo…» existe pero es un error sin salida; el flujo de leads lo deja en «skipped» | `apollo.ts:58`, `inngest/lead-tasks.server.ts:63` |
| CA-3 misma comprobación desde pantalla, Agente y automático | **Vigente, sin hacer.** Pero las rutas **convergen** en pocos puntos (§7, tabla de puntos de entrada) | `agent/tools/apollo.ts:41,106`, `agent/tools/clay.ts:92,120`, `apollo.functions.ts:25,48`, `clay.functions.ts:34,39` llaman a `findPeople`/`enrichAccount` de las pasarelas |
| CA-4 proponer dominio desde URL web o email corporativo | **Vigente, reformulado.** `accounts` **no tiene columna de web** (`types.ts:245-270`): la fuente real es el email corporativo de sus contactos o una URL que escribe la persona (`cleanDomain`, `leads.ts:208`) | — |
| CA-5 lead con email corporativo sin cuenta → **proponer** vincular o crear | **Contradice `main`.** Hoy se vincula por dominio exacto y se crea la cuenta **automáticamente**; pasar a «proponer» frena la entrada de leads. Ver P-3 | `leads-ingest.ts:50-57`, `inngest/lead-tasks.server.ts:35-59` |
| CA-6 email personal no deriva dominio y se pide la empresa | **Hecho en lo esencial, con un hueco real** (camino en §3.6). La «empresa» siempre existe: `leads.company` es obligatorio | `types.ts:2861`; listas en `leads.ts:45`, `lead-flow.ts:56`, `lead-qualification.ts:28`, `product-usage.ts:32` |
| CA-7 conservar nombre completo y permitir nombre/apellido | **Mitad hecha, mitad sin necesidad probada.** Se conserva el nombre completo (`people.full_name`, `stakeholders.name`); partir en dos columnas es esquema y ningún proveedor lo exige. Ver P-4 | `types.ts:3664,4580` |

### 3.4 Qué exige cada proveedor (resuelve un «Por verificar» del original)
Leído en el código, no en documentación del proveedor:
- **Apollo, personas de una cuenta:** dominio (`apollo.ts:55-60`). **Apollo, identificar a una persona:** id, email, LinkedIn, o nombre **más** dominio (`apollo.ts:253-278`): coincide **exactamente** con la llave de persona validada por Fede.
- **Clay:** dominio para personas y para completar la cuenta (`clay.ts:190-197`, `clay-gateway.ts:190-195`).
- **Parallel:** nombre; el dominio es opcional (`parallel.ts:78-88`).
- **Investigación web (Firecrawl/Perplexity):** dominio (`web-research-core.ts:43-44`).
- **Lusha:** **no aparece en `src/`** (búsqueda hecha por mí y por el gate): el original lo cita sin código que lo respalde. Se retira de la lista.
- Perplexity (como proveedor suelto), Apify y Firecrawl más allá de `web-research-core.ts`: **[Por verificar]**.
- **Ningún proveedor usa hoy `accounts.linkedin_url` para buscar personas ni completar la cuenta.** Por eso la llave **para investigar** una cuenta es el dominio, aunque la llave **de identidad** (tabla validada por Fede) admita «dominio o LinkedIn» (ver CA-1 y P-8).

### 3.5 Qué pasa hoy cuando falta la llave (gasto y paradas)
- Los errores salen **antes** de registrar coste: en `completeAccount`, el `used.push` va después de la llamada (`runner.ts:199-202`); en `findKeyPeople`, `peopleParams` lanza antes de la petición HTTP. «No llamar al proveedor ni gastar» **ya se cumple**; este SDD no lo mejora, lo fija con una prueba. El cambio real es **el mensaje, el tipo de error y el sitio de la comprobación**.
- Tres bucles se cortan leyendo el texto del error con `/dominio/i` (`runner.ts:212`, `:215`, `:458`), y dos pruebas exigen `toThrow(/dominio/)` sobre funciones puras sin nombre de cuenta (`apollo.test.ts:32` → `peopleParams`; `clay.test.ts:49` → `peopleFilters`). El mensaje nuevo **debe seguir diciendo «dominio»** cuando falta el dominio.
- Las pasarelas leen la cuenta con `"id,domain,industry,size,country,notes"`, **sin `name`** (`clay-gateway.ts:190-195`, `apollo-gateway.ts:358-364`): para decir «Para completar a *X*» hay que añadir `name` a ese `select`.
- `planNeed` no recibe `accountId` (`runner.ts:81-94`) y `findKeyPeople` admite una empresa sin cuenta (`company`, `discoveries.server.ts:91` con `accountId: ""`): comprobar **antes** de `planNeed` exigiría una lectura extra de la cuenta. La comprobación va **donde la cuenta ya se ha leído**.

### 3.6 El hueco de `outlook.es` (camino alcanzable, leído, no ejecutado)
`ingestLead` calcula el dominio con `domainFromEmail`, cuya lista (`leads.ts:45`, `:214`, `:299`) **sí** incluye `outlook.es`, y crea la cuenta con `domain` nulo (`leads-ingest.ts:53`). Después `enrichLead` calcula `emailDomain = corporateDomain(lead.email)` (`inngest/lead-tasks.server.ts:30`), cuya lista (`lead-flow.ts:56`) **no** incluye `outlook.es`, y como la cuenta no tiene dominio **lo escribe** (`inngest/lead-tasks.server.ts:59`: `if (acc && !acc.domain && emailDomain) …update({ domain: emailDomain })`). La línea 47 solo se alcanza si el lead no trae `account_id`. Resultado: una cuenta con dominio `outlook.es`, y búsquedas de personas sobre él.

### 3.7 Línea base
Sin dato: no medida. Las consultas de solo lectura están en §16.

**Apuesta declarada:** no hay datos de uso; la prioridad se apoya en el código de `main` y en la petición de Fede.

## 4. Resultado buscado
G-5 del PRD, con las métricas replanteadas para que se puedan medir **hoy** (todas por consulta de solo lectura, §16; siempre con N; las empresas internas, de demo y de prueba las decide Fede, P-7):
- **M-1.** % de cuentas con dominio válido que no es de correo personal. Línea base: **sin dato**.
- **M-2.** % de leads con cuenta vinculada y esa cuenta con dominio. Línea base: **sin dato**.
- **M-3.** Nº de peticiones de enriquecimiento fallidas en 30 días por falta de dominio (`background_jobs.error`, `types.ts:602`), contando **el texto viejo y el nuevo** para que sea comparable antes y después. Línea base: **sin dato**. **[Por verificar]** que el error de Apollo/Clay llega a esa columna.
- **M-4.** % de personas (`people`) con cuenta vinculada y esa cuenta con dominio (es la parte «personas… vinculadas a cuenta con dominio» de G-5 que el original medía y que 7a no debe dejar caer). Línea base: **sin dato**.
- Se **retira** «competidores con dominio» de este SDD: depende de 7b. El 0 del original («no existe la entidad») sigue siendo cierto (no hay tabla; `types.ts` solo tiene `lost_competitor` en deals).

## 5. Alcance
**Incluye:**
- Módulo puro `src/lib/fit-key.ts`: llave mínima de cuenta, persona y lead, `missingKey`, `requireKey` y el error tipado `MissingKeyError`.
- Lista única de correo personal (`src/lib/free-mail.ts`) que sustituye las cuatro actuales.
- Uso de `requireKey`/`missingKey` en los puntos de entrada de la tabla de CA-3 y declaración de llaves por necesidad en `planner.ts`.
- Propuesta de dominio para cuentas sin él, como sugerencia que la persona acepta o descarta, **incluida la ampliación de `Snapshot` y `loadSnapshot`** (`src/lib/proactive/types.ts`, `src/lib/org-data.ts`) que necesita (CA-7).
- Consultas de línea base (solo lectura).

**No incluye** (límite para «Movimientos prohibidos» del brief; **no** prohíbe los archivos listados arriba):
- **Migraciones, RLS, columnas nuevas, `drizzle/`, `BASELINE_MAX`.** Este SDD **no propone ninguna**. Si Fede decide P-6 (procedencia del dominio) o P-4 (nombre/apellido), eso exige migración y **depende de la salida de Lovable, hoy pausada, o de aplicarse a mano en Lovable Cloud**; no se hace aquí.
- Entidad Competidor y alta manual (7b).
- Vínculo `people`–`stakeholders`, identidad única, resultados de terceros con origen y `alreadyHave` (7c).
- Cambiar la entrada de leads (P-3), el filtro silencioso del autopilot (`autopilot.ts:11`) ni el orden o el coste de los proveedores.
- Contratar proveedores; LinkedIn solo por API oficial (NOKKO no analiza ni puntúa perfiles).
- Backfill de dominios de cuentas existentes: no se escribe nada masivamente; lo hace la persona al aceptar una propuesta.

## 6. Cambios de comportamiento (delta)
**Añadido:** error tipado `MissingKeyError` con mensaje por necesidad («Para *completar* a *X* falta el dominio…»); sugerencia «Propuesta de dominio» por cuenta (tope de 5 por pasada).
**Modificado:** los errores sueltos por falta de dominio de las pasarelas, la investigación web, `matchDetails` y el flujo de leads pasan a `requireKey`/`missingKey`; las cuatro listas de correo personal pasan a una de 23 dominios (**cambia el comportamiento de siete dominios en tres módulos y la entrada al modelo de cualificación**, §14); un dominio de correo personal en una cuenta cuenta como «falta la llave».
**No cambia (se fija con prueba):** que un proveedor no se llame ni gaste sin llave (ya es así, §3.5); la entrada automática de leads.
**Eliminado:** los «Por verificar» resueltos (§3.4); Lusha de la lista de proveedores; la premisa de `alreadyHave`.

## 7. Historias y criterios de aceptación
Convención de pruebas: cada prueba nueva se escribe **contra un stub que compila y devuelve valores incorrectos** (p. ej. `missingKey` devolviendo `[]`, `free-mail` sin los dominios nuevos), para que el rojo sea de **aserción** y no de importación rota (`GROUND-RULES`, regla 5). Lo dice el brief; ver §12.

Trazabilidad con el original: la columna «Orig.» dice qué CA del 7a original cubre. Numeración: CA-1, 2, 3, 6 y 7 del original **no** coinciden con los de aquí (el 6 viejo es el CA-4/CA-5 nuevo; el 7 viejo, el CA-9; el 4 viejo, los CA-6 y CA-7). 7b y 7c los citan «en 7a» (`7b:70-76`, `7c:68-74`); si Fede aprueba este SDD, esas referencias se actualizan con él, fuera de este ticket.

### H-1: Como founder, quiero saber qué falta para que NOKKO investigue una cuenta, persona o lead, y que me lo diga igual venga de donde venga la petición.
- **CA-1** `missingKey(entity, record, need?)` DEBE devolver la lista de llaves que faltan y el motivo. **Sin `need`** (llave de identidad, tabla validada por Fede): **cuenta** = nombre + (dominio válido que no sea de correo personal **o** LinkedIn de empresa); **persona** = id de proveedor, email o LinkedIn, **o** nombre + cuenta con dominio válido (misma regla que `matchDetails`); **lead** = cuenta vinculada con dominio válido (persona opcional; P-2). **Con `need`** (`research_account`, `enrich_account`, `find_stakeholders`): la cuenta DEBE tener **dominio** (LinkedIn solo no basta: ningún proveedor lo usa, §3.4; P-8) · cubre G-5 · Orig. CA-1 · prueba: `src/lib/fit-key.test.ts`
- **CA-2** `requireKey(entity, record, need)` DEBE lanzar `MissingKeyError` (tipo propio, con `entity` y `missing`) cuando `missingKey` no está vacío. El mensaje DEBE contener la palabra «dominio» cuando falta el dominio (los cortes de `runner.ts:212,215,458` siguen funcionando), usar el verbo de la necesidad («investigar», «completar», «buscar personas de») y el nombre de la cuenta si se conoce, o «la cuenta» si no. El mensaje NO promete una propuesta: dice «Escríbelo en la ficha (acme.com) o añade un contacto con email de empresa»; la propuesta, si existe, aparece aparte en Sugerencias (CA-7). `apollo.test.ts:32` y `clay.test.ts:49` DEBEN seguir verdes (las funciones puras `peopleParams` y `peopleFilters` no se tocan) · cubre G-5 · Orig. CA-2 · prueba: `src/lib/fit-key.test.ts`
- **CA-3** Los puntos de entrada de la tabla de abajo DEBEN usar `requireKey` o `missingKey`, y NO DEBE quedar el literal «no tiene dominio» fuera de `fit-key.ts` y de las dos funciones puras con prueba propia. Cada `Need` de `planner.ts` DEBE declarar su llave (`NEED_KEYS: Record<Need, …>`, exhaustivo por tipo) · cubre G-5 · Orig. CA-3 · prueba: `src/lib/fit-key-sources.test.ts` (nuevo; lee las fuentes con `readFileSync` como `setup-write-guard.test.ts`: es una red gruesa y se declara) y `src/lib/orchestrator/planner.test.ts` (cada `Need` tiene llave)

**Puntos de entrada (inventario cerrado):**
| Punto | Qué hace hoy | Cambia |
|---|---|---|
| `apollo-gateway.ts:358-364` (`enrichAccount`), `findPeople` `:124` | lanza error propio | **Sí**: `requireKey("cuenta", acc, need)`; añadir `name` al `select` |
| `clay-gateway.ts:190-195` (`enrichAccount`), `findPeople` `:139` | ídem | **Sí**, igual |
| `web-research-core.ts:43-44` (`researchAccountCore`) | ídem | **Sí**; cubre `agent/tools/web.ts:17` y las funciones web |
| `apollo.ts:253-278` (`matchDetails`, mensaje en `:274`) | lanza «Faltan datos para identificar a la persona» | **Sí**: usa la llave de persona de `fit-key.ts` (así existe un consumidor de esa regla) |
| `inngest/lead-tasks.server.ts:63,89` | nota «skipped» con texto propio | **Sí**: mismo texto; el estado **sigue siendo `skipped`** («no aplicaba», `lead-flow.ts:12`), no `failed` (que se reintenta) |
| `runner.ts:212,215,458` | corta los bucles leyendo `/dominio/i` | **No** (el mensaje sigue diciendo «dominio»); queda anotado para un cambio futuro a `instanceof MissingKeyError` |
| `agent/tools/apollo.ts:41,106`, `agent/tools/clay.ts:92,120`, `apollo.functions.ts:25,48`, `clay.functions.ts:34,39`, `agent/tools/needs.ts` | llaman a `findPeople`/`enrichAccount` de las pasarelas (verificado) | **No**: ya pasan por el punto que cambia |
| `apollo.ts:55-58`, `clay.ts:190-197` (`peopleParams`, `peopleFilters`) | funciones puras con `toThrow(/dominio/)` | **No** (defensa en profundidad; sus pruebas siguen) |
| `autopilot.ts:8-11` (filtro silencioso) | descarta cuentas sin dominio | **No**: sigue silencioso; esa cuenta pasa a verse en «Propuesta de dominio» (CA-7) |
| `runner.ts:141` (`webFallback`, `if (!acc?.domain) return []`), `discoveries.ts:140` (`domain: a.domain ?? ""`) | salida vacía, sin error | **No** |

### H-2: Como founder, quiero que NOKKO deduzca la llave que pueda, sin equivocarse de empresa.
- **CA-4** Hay UNA lista de correo personal (`src/lib/free-mail.ts`, **los 23 dominios de `FREE_EMAIL_DOMAINS`**) y `leads.ts`, `lead-flow.ts`, `lead-qualification.ts` y `product-usage.ts` la usan; `corporateDomain("ana@outlook.es")` DEBE ser `null` (rojo hoy: `lead-flow.ts:56`); `lead-qualification` DEBE marcar `hotmail.es` y `outlook.es` como «(correo personal)» · cubre G-5 · Orig. CA-6 · prueba: `src/lib/free-mail.test.ts` (nuevo), `src/lib/lead-flow.test.ts` (caso `outlook.es`) y `src/lib/lead-qualification.test.ts` (caso nuevo de correo personal: hoy **no existe ninguno**)
- **CA-5** Una cuenta cuyo dominio es de correo personal DEBE tratarse como «falta el dominio» en `missingKey` y NUNCA se propone como dominio · cubre G-5 · Orig. CA-6 (segunda mitad) · prueba: `src/lib/fit-key.test.ts`
- **CA-6** `proposeDomain(contactos)` DEBE devolver el dominio corporativo más frecuente entre los **emails distintos** (en minúsculas) de los contactos de la cuenta —personas, stakeholders y leads vinculados; una persona presente en `people` y en `stakeholders` con el mismo email cuenta **una** vez—, o `null` si no hay ninguno corporativo; en empate NO elige · cubre G-5 · Orig. CA-4 · prueba: `src/lib/fit-key.test.ts`
- **CA-7** El detector `accountMissingKey` DEBE crear, por cuenta sin dominio con propuesta, una sugerencia «Propuesta de dominio» con acción `update_account` (`agent/tools/accounts.ts:219`), prioridad 3, destinatario el responsable de la cuenta (o el Owner si no tiene), clave `missing_domain:<cuenta>:<hash del dominio>` (lo descartado no vuelve) y **como máximo 5 por pasada**, las cuentas más recientes primero. SI `duplicateOf({ domain }, otrasCuentas)` devuelve una coincidencia con `kind: "same"` (se llama **solo con dominio**; con un dominio igual el parecido es 100, `match.ts:34-37`), ENTONCES NO crea la propuesta con acción: crea una sugerencia sin acción cuyo texto dice «*Otra cuenta* ya tiene ese dominio: puede ser un duplicado», con enlace a esa cuenta, y nunca fusiona. Para ello `Snapshot` y `loadSnapshot` DEBEN traer, para esta regla: el dominio de las cuentas y los emails de contactos con su cuenta (personas, stakeholders y leads), siempre filtrados por `org_id` · cubre G-5 · Orig. CA-4 y §8 «dominio duplicado» · prueba: `src/lib/proactive.test.ts` (casos nuevos, la convención de `src/lib/AGENTS.md:9`)
- **CA-8** *(guard, no cuenta para el rojo de fail-first)* La entrada de leads SIGUE vinculando por dominio corporativo exacto y creando la cuenta sin preguntar, como hoy (P-3) · cubre G-5 · Orig. CA-5 (reinterpretado) · prueba: `src/lib/lead-flow.test.ts` (casos de caracterización) y `src/lib/leads.test.ts`; el camino de `leads-ingest.ts` no tiene prueba hoy y **no se añade** aquí (exigiría simular la base de datos; ver §14)
- **CA-9** Una persona con un solo nombre DEBE aceptarse: `missingKey("persona")` NO exige apellido; con solo nombre y sin cuenta con dominio, email ni LinkedIn, SÍ marca la falta · cubre G-5 · Orig. CA-7 (reducido) · prueba: `src/lib/fit-key.test.ts`

## 8. Casos límite y errores
- Cuenta con dominio con mayúsculas, `www.` o ruta: se normaliza con `cleanDomain` antes de comprobar (CA-1).
- Contactos con varios dominios corporativos empatados (p. ej. matriz y filial): no se propone ninguno (CA-6).
- Dominio ya en otra cuenta: aviso, nunca fusión (CA-7; `AGENTS.md:23`).
- Empresa sin cuenta (`findKeyPeople` con `company`): `requireKey` se llama con nombre y dominio de esa empresa; sin dominio, mismo mensaje con el nombre (CA-2).
- Cuenta sin dominio **y** sin propuesta posible: sigue «falta el dominio»; la persona lo escribe o añade un contacto con email corporativo (CA-2).
- Más de 5 cuentas sin dominio con propuesta: se muestran 5 por pasada; el resto en las siguientes, al aceptar o descartar (CA-7).
- Registros históricos sin llave: se listan como «Faltan datos» sin bloquear su uso (la lista visible es de la pantalla de Cuentas, **fuera** de este SDD).
- Presupuesto agotado: regla actual (pausa al 100 % de lo automático, `planner.ts:49,62-66`); no cambia.
- Rol sin permiso para editar: aceptar la propuesta pasa por `update_account`, que ya respeta roles.
- Otra empresa (multitenant): `loadSnapshot` filtra por `org_id` explícito (`src/lib/AGENTS.md:47`); `proposeDomain` solo ve lo que le pasan.

## 9. Experiencia y copy
Por necesidad (no un único texto): «Para **investigar** a *Acme* falta el dominio. Escríbelo en la ficha (acme.com) o añade un contacto con email de empresa.» · «Para **completar** a *Acme* falta el dominio. …» · «Para **buscar personas de** *Acme* falta el dominio. …». Sin nombre: «la cuenta». Sugerencia: «Propuesta de dominio: *acme.com* para *Acme*, deducido del email de sus contactos. ¿Lo confirmas?». Estados con palabra: «Completa», «Falta *dato*», «Propuesta». «Tú», sin iconos, datos de ejemplo ficticios.

## 10. Datos, permisos y privacidad
- **No se añaden tablas, columnas, políticas ni migraciones.** Nada de esto depende de la salida de Lovable.
- `loadSnapshot` pasa a leer `email` de `stakeholders`, `people` y `leads` y `domain` de `accounts` (con `org_id`), con RLS actual; el Snapshot vive en memoria del detector y **no se envía a terceros**. La comprobación de llave reduce, no aumenta, lo enviado a proveedores.
- **Observado, no cambiado:** el encargo a Parallel incluye la ficha de **nuestra** empresa (`one_liner`, `category`, `target_customer`) además de nombre, dominio y país de la cuenta (`parallel.ts:78-88`). Qué se envía a Apollo, Clay y los demás: **[Por verificar]**.
- El dominio **no está en la lista de campos con procedencia** del trigger 0058 (`industry, size, country, notes, linkedin_url`; sin aplicar hasta donde consta): un dominio aceptado desde la propuesta se guarda sin marca de origen. Ver P-6.
- Ningún dato de clientes en pruebas ni en ejemplos.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| ninguna | regla (normalización y frecuencia de dominios) | — | — |

Este SDD no añade llamadas a IA. Las existentes (investigación, `aiProviders()` en `src/lib/gemini.ts`) no cambian. **Sí cambia una entrada de modelo existente:** la cualificación de leads envía `dominio_email` con «(correo personal)» según la lista (`lead-qualification.ts:76`); al unificar, `hotmail.es` y `outlook.es` pasan a marcarse y los siete dominios nuevos también (CA-4). Es un cambio de dato de entrada, no una llamada nueva.

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1a | `free-mail.ts` (lista única de 23, cuatro usuarios) y guard de la entrada de leads | CA-4, CA-8 *(guard)* | `src/lib/lead-flow.test.ts`: `corporateDomain("ana@outlook.es")` es `null` (rojo real hoy, por aserción) |
| U-1b | `fit-key.ts`: `missingKey`, `requireKey`, `MissingKeyError`, `proposeDomain` y llave de persona | CA-1, CA-2, CA-5, CA-6, CA-9 | `src/lib/fit-key.test.ts` contra un stub que devuelve `[]` / no lanza |
| U-2 | Uso en los puntos de entrada, `NEED_KEYS` y `name` en el `select` de las pasarelas | CA-3 | `src/lib/fit-key-sources.test.ts` (los literales «no tiene dominio» siguen en las dos pasarelas y en `web-research-core.ts`: rojo por aserción) |
| U-3 | Ampliación de `Snapshot`/`loadSnapshot` y detector `accountMissingKey` | CA-7 | `src/lib/proactive.test.ts` contra un detector stub que devuelve `[]` |

Orden: U-1a y U-1b son independientes entre sí; U-2 y U-3 consumen U-1b. **Nota para el brief:** el commit rojo de cada unidad incluye el stub (compila, devuelve valor incorrecto) para que `scripts/factory/fail-first.mjs` pruebe un rojo de aserción y no uno de importación; `runner.test.ts` hoy solo prueba `normalizeProposed` y **no** se ha añadido ahí ninguna prueba que exija simular pasarelas (no hay pruebas de pasarela: `ls src/lib | grep gateway` solo da archivos fuente). **[Por verificar]** con la coordinadora que nadie más toca `planner.ts`, `runner.ts`, `lead-flow.ts`, `leads.ts`, `org-data.ts` ni `proactive/types.ts`.

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- Archivos: `src/lib/fit-key.ts` y `free-mail.ts` (nuevos); `apollo-gateway.ts`, `clay-gateway.ts`, `web-research-core.ts`, `apollo.ts` (`matchDetails`), `src/lib/inngest/lead-tasks.server.ts`, `lead-flow.ts`, `leads.ts`, `lead-qualification.ts`, `product-usage.ts`, `planner.ts`; para CA-7: `src/lib/proactive/types.ts` (`Snapshot`), `src/lib/org-data.ts` (`loadSnapshot`, que hoy lee `accounts` solo con `id,name,is_target,owner_id,created_at`, `stakeholders` con `account_id,buying_role` y `leads` sin email, `:102-103`), `src/lib/proactive/detectors/account-missing-key.ts` y su registro.
- Reutilizar: `cleanDomain` (`leads.ts:208`), `matchDetails`, `duplicateOf` (`match.ts:63`), `field-proposals.ts` como molde de clave estable.
- `Snapshot` ya tiene muchos campos opcionales «para que los snapshots viejos sigan funcionando»: añadir el bloque nuevo como **opcional** (`fitKey?:`), de modo que sin él la regla no dispara, igual que `strategy`.
- Prioridad 3 (la escala es 1|2|3, `proactive/types.ts:56`): por debajo de `unassigned-accounts` (2).
- Descartado: columna `website` en `accounts` (esquema, depende de Lovable); proponer la vinculación de leads (rompe la entrada automática, P-3); un guarda por archivo para «nadie lanza un error propio», salvo la red gruesa de CA-3.

## 14. Riesgos y dependencias
- **Cambio visible de la lista única (23 dominios).** Dominios que **cambian de lado** (pasan a «personal») según el módulo: `leads.ts`: `gmx.es`, `mac.com`, `mail.com`, `telefonica.net`, `terra.es`, `yandex.com`, `zoho.com`; `lead-flow.ts`: esos siete **y `outlook.es`**; `lead-qualification.ts`: esos siete, `outlook.es` y `hotmail.es`. Ninguno sale de la lista de ninguno. **Decisión del autor (no del gate):** se adoptan los 23 tal cual, porque todos son buzones de consumo o de proveedor de acceso y `product-usage.ts` ya los trata así; el riesgo conocido es que `zoho.com`, `yandex.com` y `mail.com` también son empresas (un empleado del propio proveedor usaría su dominio); Fede puede vetar alguno (P-9).
- **La cualificación de leads cambia su entrada al modelo** en esos dominios (§11). `lead-qualification.test.ts` hoy no tiene ningún caso de correo personal: CA-4 lo añade antes de tocar la lista.
- **Cuentas ya creadas con un dominio de correo personal:** `missingKey` las marca como «falta el dominio»; **cuántas hay: sin dato** (Q3 y Q4 de §16). No se corrigen solas.
- **`leads-ingest.ts` sin prueba:** CA-8 solo fija `lead-flow`/`leads`; el camino de `ingestLead` queda cubierto por lectura. Añadir una prueba exige simular la base de datos y se deja fuera.
- **Orden con 7b y 7c:** 7a no depende de esquema; 7c-U-4 (identidad única) y 7b sí, y por tanto de Lovable. Recomendado: 7a primero (P-1).
- **Hermanos:** 7b (`:71`) y 7c (`:69`) dan por hecho «rechazar como dominio de empresa (CA-6, en 7a)»; P-5 propone **no** rechazar al escribir. Si Fede acepta P-5, esas dos líneas se actualizan («tratado como falta»). También cambian las referencias de numeración (§7). Las tres partes repiten literalmente §3 a §6; al aprobar este SDD conviene que 7b y 7c recorten lo suyo. Fuera de este ticket.

## 15. Preguntas para Fede y para la revisión técnica
**P-1. ¿Recortamos 7a a lo que no necesita esquema y dejamos competidores, vínculo de personas y resultados de terceros en 7b/7c?** Mi recomendación: **sí.** Porque así 7a se entrega sin esperar a Lovable (que está pausada), y lo que sí necesita migración (7c-U-4, 7b-U-3) se decide con el mismo plan de aplicación manual. Lo que añadiría el original completo: un único ticket grande con una migración dentro.

**P-2. ¿Relajamos la llave del lead a «cuenta con dominio» (persona opcional)?** La tabla actual la validaste tal cual («persona + cuenta, ambas vinculadas»). Mi recomendación: **sí, relajarla.** Porque el flujo real solo crea persona si hay email (`leads-ingest.ts:59-70`) y lo que bloquea el enriquecimiento es la cuenta sin dominio (`inngest/lead-tasks.server.ts:63,89`); exigir persona dejaría fuera leads válidos sin email. Si prefieres mantenerla, CA-1 cambia una línea.

**P-3. En la entrada de leads, ¿mantenemos vincular/crear cuenta automáticamente (CA-8) o pasamos a «proponer» como pedía el CA-5 original?** Mi recomendación: **mantener lo automático** cuando el dominio corporativo coincide exactamente y **proponer solo** en cuentas que ya existen sin dominio (CA-7). Porque la entrada de leads es un camino automático y sin nadie delante (`inngest/lead-tasks.server.ts:35-59`); pedir confirmación ahí paraliza el embudo, y el riesgo que quería evitar el CA-5 (una cuenta equivocada) lo cubre mejor la lista única de correo personal (CA-4).

**P-4. ¿Retiramos «nombre y apellido por separado» (CA-7 original)?** Mi recomendación: **sí, retirarlo ahora.** Porque es esquema (columnas nuevas = migración, depende de Lovable), ningún proveedor lo exige hoy (Apollo parte el nombre al llamar, `apollo.ts:262-266`) y no hay dato de que su ausencia haya fallado ninguna búsqueda. Se reabre si M-3 muestra fallos por eso.

**P-5. Un dominio de correo personal escrito a mano en una cuenta, ¿se rechaza al escribir o solo cuenta como «falta la llave»?** **Ojo: 7b (`:71`) y 7c (`:69`) ya dicen «rechazar», y esta propuesta lo cambia.** Mi recomendación: **solo contar como «falta»** en este ticket y abrir otro para rechazarlo al escribir. Porque hay al menos nueve escritores de `accounts.domain` (formulario de Cuentas, `create-account.ts:13`, `create_account`/`update_account`, importación `imports.functions.ts:95`, API pública `routes/api/public/accounts.ts:74`, Apollo, Clay, Parallel `components/parallel.tsx:291`, Descubiertos) y tocarlos todos amplía mucho el alcance; con el mensaje de CA-2 la persona ya lo ve.

**P-6. ¿Queremos procedencia (origen y confirmación) también para `accounts.domain`?** Mi recomendación: **no ahora.** Porque exige ampliar la lista del trigger de 0058 (una migración, **que depende de la salida de Lovable, hoy pausada, o de aplicarse a mano en Lovable Cloud**) y 0058 ni siquiera consta como aplicada. Mientras tanto, un dominio aceptado desde la propuesta queda sin marca. Hay dos criterios opuestos en el repo sobre un valor sin marca: «sin dato, nunca persona» (`docs/sdd/annex/concept-catalog-proposal-20261025.md:73`) y «se trata como de una persona» (`SDD-20261027-strategic-suggestions-engine.md:277`); este SDD no resuelve esa contradicción, pero conviene que la veas.

**P-7. Medición: ¿quién ejecuta las consultas de §16 y qué empresas se excluyen (internas, demo, prueba)?** Mi recomendación: **tú, en el editor SQL de Lovable Cloud**, excluyendo las que marques con su id. Porque el conector `nokko` no conectaba (`ENOTFOUND`, `docs/sdd/annex/migration-0058-verification-20261028.md:29`) y yo no tengo acceso a esa base; sin ese filtro M-1 a M-4 se contaminan con datos de prueba.

**P-8. La llave de identidad de cuenta admite «dominio o LinkedIn de empresa» (tabla que validaste), pero para investigar hace falta el dominio. ¿Mantenemos las dos reglas (identidad sin necesidad, dominio con necesidad)?** Mi recomendación: **sí.** Porque ningún proveedor usa hoy `linkedin_url` para buscar personas ni completar la cuenta (§3.4); decir «completa» a una cuenta con solo LinkedIn y que luego falle sería peor que el aviso actual. No cambia tu tabla: la reinterpreta según para qué.

**P-9. ¿Adoptamos los 23 dominios de `FREE_EMAIL_DOMAINS` tal cual (incluidos `zoho.com`, `telefonica.net`, `yandex.com`, `mail.com`)?** Mi recomendación: **sí.** Porque unifica sobre la lista que `product-usage.ts` ya usa y todos son buzones de consumo; el riesgo (el propio proveedor como cuenta) es marginal y se corrige quitando un dominio de una sola lista.

## 16. Pendiente de verificar
**Consultas de solo lectura para la línea base (no ejecutadas; Lovable Cloud, editor SQL; solo recuentos, sin valores ni nombres).** Dominio normalizado: `d = split_part(regexp_replace(lower(btrim(domain)), '^(https?://)?(www\.)?', ''), '/', 1)` (Descubiertos y `update_account` guardan el dominio sin normalizar: `discoveries.functions.ts:49`, `agent/tools/accounts.ts:219`). Lista personal **de 23**: `gmail.com, googlemail.com, hotmail.com, hotmail.es, outlook.com, outlook.es, live.com, msn.com, yahoo.com, yahoo.es, icloud.com, me.com, mac.com, aol.com, proton.me, protonmail.com, gmx.com, gmx.es, mail.com, yandex.com, zoho.com, telefonica.net, terra.es`. Filtro de empresas excluidas, que **conserva** las filas con `org_id` nulo (`accounts.org_id` admite nulo, `types.ts:262`): `where org_id is null or org_id <> all(:excluidas)`.
- **Q1 (M-1).** Sobre `public.accounts` con ese filtro: total; con `d` válido (`d ~ '^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$'`) y fuera de la lista personal; con `linkedin_url` no vacío; sin ninguna de las dos.
- **Q2 (M-2).** `leads` con `account_id`, y de esos con cuenta con `d` válido y fuera de la lista.
- **Q3.** Dominios repetidos por empresa (`group by org_id, d having count(*) > 1`) y cuentas con `d` en la lista personal.
- **Q4 (el hueco de §3.6).** Cuentas con `d = 'outlook.es'`.
- **Q5 (M-3).** `background_jobs` con `status = 'failed'`, últimos 30 días y `error ilike '%no tiene dominio%' or error ilike '%falta el dominio%'` (columnas en `types.ts:602-620`).
- **Q6 (M-4).** `people` con `account_id` y esa cuenta con `d` válido y fuera de la lista.
- **Q7 (solape `people`/`stakeholders`, para 7c).** Pares con el mismo email en minúsculas dentro de la misma empresa, y lo mismo por `linkedin_url`.
- «El rol del editor SQL de Lovable Cloud ve todas las empresas» **no está verificado** (viene de una nota de otra sesión).

**[Por verificar]:**
- Requisitos de Perplexity, Apify y Firecrawl más allá de `web-research-core.ts` (§3.4).
- Qué datos se envían a Apollo y Clay (solo está leído Parallel); base legal de los datos de contacto (no es de código).
- Que el error de Apollo/Clay por falta de dominio llega a `background_jobs.error` (M-3).
- Que el camino de §3.6 ocurre en producción (leído, no ejecutado).
- Que `production` coincide con `main`; estado real de 0058 en cada base.
- Que nadie más toca los archivos de §12.
- Que las consultas de esta sección se ejecutan sin error.
- Ledger (NK-0012, NK-0047): no consultado.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Un agente `nokko-gate` con contexto fresco lee este SDD y el código, y devuelve su informe. El coordinador lo copia aquí sin editarlo. El gate no aprueba el SDD: informa; la aprobación es de Fede.

### 17.1 Primera pasada del gate (sobre `04da52c`), copiada sin editar
Veredicto: Objeciones. Dos bloqueantes, más importantes y menores. El diagnóstico de fondo aguanta: la mayoría de las premisas sobre el código son ciertas, pero U-2 y U-3 no se pueden construir ni probar tal como están escritas. Lectura sobre 04da52c (sobre 11bc398); no ejecutó tests ni leyó .env.

1. Bloqueante: U-3 (CA-6 y CA-7) necesita datos que el Snapshot no tiene, y el SDD no lo dice. Detector = (s: Snapshot) => Suggestion[] (`src/lib/proactive/types.ts`). Snapshot.accounts solo trae id,name,is_target,owner_id,created_at y loadSnapshot lo lee igual (`src/lib/org-data.ts:102`): no hay domain. stakeholders solo trae account_id,buying_role (`org-data.ts:103`): no hay emails. No hay people en el snapshot y leads no trae email. Sin ampliar Snapshot y loadSnapshot no se puede calcular proposeDomain ni el duplicado por dominio. Esos archivos no aparecen ni en §13 ni en U-3; si el brief copia «No incluye» a «Movimientos prohibidos», prohibirá justo lo que hace falta. Falta además cuántas sugerencias puede generar de golpe (una por cuenta sin dominio, a diferencia de `unassigned-accounts.ts`, que agrega), con qué prioridad y para quién (user_id). Cambio: añadir a U-3 la ampliación de Snapshot y loadSnapshot (con org_id) y fijar tope o agregación y destinatario.

2. Bloqueante: CA-2 y CA-3 no definen el contrato del error y chocan con código y pruebas que el SDD no menciona. `runner.ts:212`, `:215` y `:458` cortan los bucles con /dominio/i.test(lastError): el mensaje unificado debe seguir diciendo «dominio»; para llaves de persona o LinkedIn no lo dirá. `apollo.test.ts:32` y `clay.test.ts:49` exigen toThrow(/dominio/) y lo lanzan peopleParams(domain,q,page) y peopleFilters(domain,q), funciones puras sin nombre de cuenta; no pueden decir «Para investigar a X» sin cambiar la firma. `clay-gateway.ts:190-195` y `apollo-gateway.ts:358-364` leen la cuenta con "id,domain,industry,size,country,notes", sin name. La llave de cuenta de CA-1 admite «dominio o LinkedIn», pero los seis sitios exigen dominio (`apollo.ts:55`, `clay.ts:193`, `clay-gateway.ts:193`, `apollo-gateway.ts:361`, `web-research-core.ts:43`, `lead-tasks.server.ts:63,89`): con solo LinkedIn, missingKey diría «completa» y el proveedor fallaría. Tampoco está definido si el check llama a missingKey: si solo reutiliza el texto, una cuenta con gmail.com sigue pasando (cleanDomain acepta gmail.com) y CA-5 no tiene efecto. No dice si el fallo es throw o blocked; en leads skipped = «no aplicaba» y failed = «se reintenta» (`lead-flow.ts:12`), hoy es skipped (`lead-tasks.server.ts:63,89`). El texto de CA-2 «escribirlo o aceptar la propuesta, si la hay» no se puede producir en un error lanzado desde una función pura: hay que decir dónde se ve la propuesta (Sugerencias, asíncrona). Cambio: definir el contrato (requireKey(entity, record, need) que devuelve el mensaje o lanza error tipado), nombrar los tests existentes que deben seguir verdes, decidir cómo se resuelve «Para investigar a X» donde no hay nombre.

3. Importante: «NO DEBE llamar al proveedor ni gastar presupuesto» ya se cumple hoy. Los errores salen antes de used.push y de logUsage (`runner.ts:199-214`, `:239`); en findKeyPeople, peopleParams lanza antes de la llamada HTTP. El cambio real es el mensaje y el lugar de la comprobación, no evitar un gasto: el delta de §6 sobrevende. Comprobar antes de planNeed exige una lectura extra de la cuenta: planNeed no recibe accountId (`runner.ts:81-94`) y findKeyPeople admite company sin cuenta (`discoveries.server.ts:91`, accountId: "").

4. Importante: el inventario de «seis sitios» está incompleto. Entradas que no pasan por runner.ts: `agent/tools/apollo.ts:41,106`, `agent/tools/clay.ts:92,120`, `agent/tools/web.ts:17` (llama a researchAccountCore directo), `apollo.functions.ts:25,48`, `clay.functions.ts:34,39`. El SDD dice que el Agente va por needs.ts → runner.ts: es solo una parte; un check en runner no cubre estas rutas. Otros puntos de la regla «sin dominio» que CA-3 no toca: `autopilot.ts:11` (el filtro silencioso que §2 usa como ejemplo del problema, sin CA que lo cambie), `discoveries.ts:140`, `runner.ts:141` (webFallback), `apollo.ts:274` (mensaje de matchDetails). CA-1 define llaves de persona y lead pero ningún consumidor las usa (missingKey('persona') queda sin llamadas). Cambio: lista completa de puntos de entrada, con cuáles cambian y cuáles quedan fuera.

5. Importante: regla 5 (rojo real por aserción). Estos tests nuevos fallan solo por import roto: fit-key.test.ts (CA-1, 5, 6, 9), free-mail.test.ts (CA-4), account-missing-key.test.ts (CA-7), fit-key-entrypoints.test.ts (CA-3). `scripts/factory/fail-first.mjs` da «proven» con cualquier fallo, incluido un import roto. CA-8 es de caracterización: pasa en la base, incumple la regla 5. CA-9 es trivialmente verde sobre una función nueva. Rojos reales por aserción que sí hay: lead-flow.test.ts con outlook.es (`lead-flow.ts:56` no lo tiene) y el caso de runner.test.ts si se mockean las pasarelas. Cambio: el brief debe pedir un stub que devuelva valores incorrectos para que el rojo sea de aserción; CA-8 pasa a «guard» fuera del cómputo de fail-first o se quita como CA. runner.test.ts hoy solo prueba normalizeProposed (34 líneas, sin mocks): di cómo se mockean apollo-gateway, clay-gateway y ToolCtx.db. fit-key-entrypoints.test.ts exige simular enrichLead y las dos pasarelas: más barato un helper puro con test más una comprobación de que no quedan los literales «no tiene dominio».

6. Importante: la ruta de outlook.es y el cambio de lista es mayor de lo declarado. ingestLead usa domainFromEmail con FREEMAIL (`leads.ts:45,214,299`), que sí incluye outlook.es, y crea la cuenta con dominio null. Luego enrichLead hace if (acc && !acc.domain && emailDomain) y escribe outlook.es (`src/lib/inngest/lead-tasks.server.ts:59`): ese es el camino alcanzable. El SDD cita :30,47 y la línea 47 solo se alcanza si el lead no trae account_id. Partir de FREE_EMAIL_DOMAINS (`product-usage.ts:32`) añade a leads.ts y lead-flow.ts: mac.com, gmx.es, yandex.com, zoho.com, mail.com, telefonica.net, terra.es, hoy corporativos para esos módulos; §6 solo declara outlook.es. lead-qualification.ts gana hotmail.es y outlook.es y cambia dominio_email en la entrada al modelo (:70); §11 dice que no cambia nada de IA. El SDD dice 24 dominios y son 23. Dice que el test existente de cualificación debe seguir en verde pero lead-qualification.test.ts no tiene ningún caso de correo personal. Cambio: añadir :59, enumerar los dominios que cambian de lado, corregir 24 a 23, decidir zoho.com y telefonica.net en el SDD y no dejarlo al gate.

7. Importante: contradicciones con los SDD hermanos. 7b (`:71`) y 7c (`:69`) dicen «rechazar como dominio de empresa (CA-6, en 7a)»; P-5 propone solo contarlo como «falta»: esa decisión mueve algo que 7b y 7c ya dan por hecho y no se lo dice a Fede. §7 afirma que 7b y 7c «deben seguir resolviendo» CA-1, 2, 3, 6 y 7, pero el CA-6 nuevo es proposeDomain y el CA-7 nuevo es el detector; el CA-6 viejo pasa a CA-4 y CA-5 y el CA-7 viejo a CA-9; §14 lo admite, pero entonces «deben seguir resolviendo» es falso. PRD G-5 incluye «personas vinculadas a cuenta con dominio»; M-1 a M-3 lo dejan caer sin decirlo (§4 solo retira «competidores con dominio»).

8. Importante: CA-7 y CA-6 no son del todo medibles. «DEBE avisar del posible duplicado» no dice cómo (otra sugerencia, texto en el cuerpo) ni qué lo prueba. duplicateOf (`match.ts:63`) devuelve también «similar» (≥70) por nombre: especificar que se llama solo con domain y se exige kind: "same". «Contactos de la cuenta (personas, stakeholders y leads)»: people y stakeholders no están vinculados, así que una persona en ambas cuenta doble; define el conteo por email distinto.

9. Importante: mediciones (§4 y §16). Q5 busca '%no tiene dominio%'; tras CA-3 el texto cambia y M-3 deja de ser comparable: busca ambos textos. Q3 usa 16 dominios y la regla nueva usa 23, así que subcuenta. Q4 incluye hotmail.es, que no es parte del hueco (`lead-flow.ts:56` sí lo tiene). Los dominios se guardan sin normalizar: Descubiertos escribe det["domain"] crudo (`discoveries.functions.ts:49`) y update_account usa clearable(200) sin cleanDomain (`agent/tools/accounts.ts:219`); lower(domain) in (...) infracuenta. Solo Q1 menciona el filtro de empresas excluidas; accounts.org_id admite NULL (`types.ts:259`) y org_id <> all(...) descarta esas filas. M-1 («dominio válido que no es de correo personal») no es lo que calcula Q1 (dominio no vacío o LinkedIn). «El rol del editor ve todas las empresas» no está verificado. Cumple: todo es select y solo recuentos, sin valores, lo ejecuta Fede; no hay migración, RLS ni dato de producción propuestos (§5, §10): respeta la pausa de Lovable.

10. Importante: unidades no independientes ni acotadas. U-1 junta un arreglo ya útil (free-mail, que cambia 4 módulos) con un módulo sin consumidor hasta U-2. U-3 junta el detector con la caracterización de leads (CA-8), que no depende de U-1. Cambio: separar free-mail (U-1a) de fit-key (U-1b) y pasar CA-8 a unidad suelta o a guard.

Menores. 11: §3.1 llama a NK-0036 «sugerencias»; sus commits son LinkedIn de empresa (11e9b53, 58eac68); runner.ts también tocó d451942 (propuestas). 12: citas imprecisas: matchDetails está en `apollo.ts:253-278` (no 261-282); lead-tasks.server.ts vive en src/lib/inngest/ (pon la ruta completa); «sin marca = sin dato» no está en SDD-20261028-field-sources-on-tracked-writers sino en `docs/sdd/annex/concept-catalog-proposal-20261025.md:73`, y `SDD-20261027-strategic-suggestions-engine.md:277` trata lo no marcado como «persona» (decisiones opuestas que conviene nombrar); el ENOTFOUND está en `docs/sdd/annex/migration-0058-verification-20261028.md:29`. 13: `src/lib/AGENTS.md:9` dice que los detectores se prueban en src/lib/proactive.test.ts; un archivo en detectors/ funciona pero se aparta de la convención. 14: el mensaje «Para investigar a X…» no encaja con «completar» ni «buscar personas»; revisa el copy por necesidad.

Confirmado: cuentas tiene 23 columnas y leads 34 (`types.ts:247-269`, `:2857-2892`); alreadyHave no lo pasa nadie (`planner.ts:39,52`, `runner.ts:88-94`); no hay vínculo people/stakeholders en types.ts; Parallel no exige dominio (`parallel.ts:86`); Lusha no aparece en src/, drizzle/ ni package.json; outlook.es falta en `lead-flow.ts:56` y `lead-qualification.ts:28` y sí está en `product-usage.ts:32`; los seis errores del SDD están en las líneas citadas; los commits de NK-0006/0018/0019/0020/0035/0038/0040/0041/0042/0036/0046/0008 están en main; #53 (278159b) es «Simplify company UI for single-company internal use»; sin datos de cliente ni cifras inventadas; las 7 preguntas llevan recomendación con porqué.

No verificó: ledger (NK-0012/NK-0047), si el error de Apollo/Clay llega a background_jobs.error (M-3), que production coincida con main, estado real de 0058, qué se envía a Apollo y Clay, que ningún otro ticket toque planner.ts/runner.ts/lead-flow.ts/leads.ts, qué exigen Perplexity/Apify/Firecrawl, si los SQL de §16 corren, que outlook.es cree de verdad una cuenta con ese dominio en producción, otros escritores de accounts.domain (`create-account.ts:13`, `imports.functions.ts:95`, `routes/api/public/accounts.ts:74`, `components/parallel.tsx:291` no están en la lista de P-5), UI de Cuentas.

### 17.2 Revisión del autor (lectura propia, no es el gate)
Antes de aceptar B1, B2, B4 y B6 los comprobé en el código de `11bc398`; no he ejecutado tests:
- **B1 confirmado.** `loadSnapshot` lee `accounts` con `id,name,is_target,owner_id,created_at`, `stakeholders` con `account_id,buying_role` y `leads` con `id,company,stage,…,contact_name` sin email (`src/lib/org-data.ts:102-103`, y la consulta de `leads` de esa función); el tipo `Snapshot` coincide (`src/lib/proactive/types.ts`: `accounts`, `stakeholders`, `leads`); no hay `people`. El detector recibe solo el Snapshot (`unassigned-accounts.ts:10`).
- **B2 confirmado.** Cortes por texto: `runner.ts:212`, `:215`, `:458`; pruebas: `apollo.test.ts:32`, `clay.test.ts:49`; `select` sin `name`: `clay-gateway.ts:190-195`, `apollo-gateway.ts:358-364`; `leads` usa `skipped` (`lead-flow.ts:12`, `inngest/lead-tasks.server.ts:63,89`).
- **B3 confirmado.** `runner.ts:199-202`: `used.push` va después de la llamada; los errores salen antes.
- **B4 confirmado.** `agent/tools/apollo.ts:41,106` llaman a `findPeople`/`enrichAccount`; `apollo.functions.ts:25,48` y `clay.functions.ts:34,39` también (`clay.functions.ts:8` importa de `clay-gateway.ts`); `agent/tools/web.ts:17` llama a `researchAccountCore`. Convergen en tres puntos (dos pasarelas y la investigación web), lo que simplifica el cambio.
- **B6 confirmado.** `leads.ts:299` (`domainFromEmail`, que excluye `outlook.es`), `leads-ingest.ts:53` (inserta `lead.domain`), `inngest/lead-tasks.server.ts:30` (`corporateDomain`), `:47` y `:59` (el camino alcanzable). Comparé las cuatro listas con un script: 23 dominios en `product-usage.ts`; los que cambian de lado están enumerados en §14.
- Tampoco existen pruebas de pasarela (no hay `*gateway*.test.ts`), así que no propongo mocks nuevos (B5).

### 17.3 Respuesta del autor, punto por punto
| # | Punto del gate | Respuesta | Motivo y evidencia | Dónde queda |
|---|---|---|---|---|
| 1 | Bloqueante: U-3 necesita ampliar Snapshot/`loadSnapshot` | **Acepto** | Verificado (17.2). El «No incluye» habría prohibido lo necesario. Tope 5 por pasada, destinatario responsable u Owner, prioridad 3 | §5, §10, §12 (U-3), §13, CA-7 |
| 2 | Bloqueante: contrato del error y choque con código/pruebas | **Acepto** | Verificado (17.2). `requireKey` + `MissingKeyError`; el texto conserva «dominio»; las dos pruebas existentes se nombran y no se tocan; `name` se añade al `select` de las pasarelas; leads sigue `skipped`; la propuesta vive en Sugerencias, no en el error; llave por necesidad separada de la de identidad (P-8) | §3.5, CA-1, CA-2, CA-3, §9, P-8 |
| 3 | `NO gastar` ya se cumple; el delta sobrevende | **Acepto** | `runner.ts:199-202`. Retiro la promesa de ahorro; la prueba solo fija el comportamiento; la comprobación va donde la cuenta ya se leyó (no antes de `planNeed`) | §3.5, §6, CA-2 |
| 4 | Inventario de puntos de entrada incompleto | **Acepto** | Verificado (17.2). Tabla cerrada con qué cambia y qué no (autopilot, `webFallback`, `discoveries.ts:140` quedan fuera con motivo); la regla de persona tiene consumidor (`matchDetails`) y la de lead también (`lead-tasks`) | CA-3 (tabla), §5 |
| 5 | Rojo por aserción; CA-8 de caracterización; mocks | **Acepto, con un matiz** | Stub que compila y devuelve valor incorrecto por unidad; CA-8 pasa a *guard* fuera del cómputo; sin pruebas de pasarela existentes, sustituyo `fit-key-entrypoints.test.ts` por `fit-key-sources.test.ts` (lectura de fuentes, red gruesa declarada). Matiz: CA-9 no es trivial una vez hay stub, porque afirma tanto la aceptación como la falta | §7 (convención), CA-3, CA-8, CA-9, §12 |
| 6 | Camino de `outlook.es`; cambio de lista mayor; 23, no 24; decidir zoho/telefonica | **Acepto** | Verificado y enumerado con script. Decisión del autor: se adoptan los 23; riesgo y veto en P-9; añado el caso de correo personal a `lead-qualification.test.ts` y declaro el cambio de entrada al modelo | §3.6, CA-4, §11, §14, P-9 |
| 7 | Contradicción con 7b/7c, numeración, personas en G-5 | **Acepto** | P-5 avisa de que 7b:71 y 7c:69 dicen «rechazar»; retiro «deben seguir resolviendo» y dejo el mapeo; añado M-4 (personas con cuenta con dominio) | P-5, §7 (numeración), §4, §14 |
| 8 | CA-7/CA-6 poco medibles | **Acepto** | `duplicateOf` solo con dominio y `kind: "same"` (con dominio igual el parecido es 100, `match.ts:34-37`); aviso = sugerencia sin acción; conteo por email distinto | CA-6, CA-7 |
| 9 | Mediciones | **Acepto** | Dominio normalizado, lista de 23, ambos textos en Q5, Q4 solo `outlook.es`, filtro que conserva `org_id` nulo, M-1 alineada con Q1, rol del editor marcado «no verificado» | §4, §16 |
| 10 | Unidades no independientes | **Acepto** | U-1a (free-mail + guard), U-1b (fit-key), U-2, U-3 | §12 |
| 11 | NK-0036 y `d451942` | **Acepto** | Corregido | §3.1 |
| 12 | Citas imprecisas | **Acepto** | `matchDetails` en `apollo.ts:253-278`; ruta `src/lib/inngest/lead-tasks.server.ts`; «sin marca» con los dos criterios opuestos; `ENOTFOUND` en `docs/sdd/annex/migration-0058-verification-20261028.md:29` | §3, P-6, P-7 |
| 13 | Los detectores se prueban en `proactive.test.ts` | **Acepto** | CA-7 usa `src/lib/proactive.test.ts` | CA-7, §12 |
| 14 | Copy por necesidad | **Acepto** | Tres variantes de verbo y «la cuenta» sin nombre | CA-2, §9 |
| — | Escritores de `accounts.domain` fuera de P-5 | **Acepto** | Añado `create-account.ts:13`, `imports.functions.ts:95`, `routes/api/public/accounts.ts:74`, `components/parallel.tsx:291` | P-5 |

Rechazos: ninguno.

### 17.4 Segunda pasada del gate
Pendiente: la lanza la coordinadora.

## 18. Delta de implementación (lo rellena el agente al entregar)
Sin entrega todavía.
