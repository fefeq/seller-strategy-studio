# SDD-20261101-fit-data-7a-llave-minima-revalidado · [Mejora] Llave mínima comprobada en un solo sitio y completado asistido del dominio (NK-0012)

**Tipo:** Mejora (el original era «Feature»; revalidado, lo que cabe hoy es acotado y sin esquema) · **Prioridad propuesta:** Media
**Estado:** Borrador · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-11-01
**PRD:** `docs/prd/PRD-20261028-ux-onboarding-coherencia.md` (G-5) · **Depende de:** `SDD-20261025-universal-field-definitions` (U-1 a U-4 hechas; 0058 sin aplicar en producción hasta donde consta, ver §16) y `SDD-20261025-field-actions-edit-delete-confirm` (U-1 a U-5 hechas)
**Ticket:** NK-0012 (`LOGGED`). Este SDD **sustituye el alcance** de `SDD-20261025-fit-data-7a-llave-minima-y-completado` y **no lo reescribe**: el original solo se toca (cabecera «Sustituido por…») con aprobación de Fede.

> Nivel elegido (`nokko-shape`): **SDD corto, sin PRD nuevo.** El PRD de la iniciativa ya fija G-5 y su línea base es una consulta, no un documento. «Solo ticket» se queda corto: hay una regla nueva (qué es una llave) que debe valer igual en pantalla, Agente y automatismos. «PRD + SDD» no añade nada una vez que lo que exige esquema (competidores, vínculo de personas, resultados de terceros) se queda en 7b y 7c.

## 1. Resumen
El 7a original sigue **vigente en su intención** pero está **desfasado en tres cosas**: la mitad de sus «Por verificar» ya se resuelven en el código, dos de sus premisas son falsas hoy (`alreadyHave` no se usa; el país y el tamaño ya se normalizan) y dos de sus CA chocan con lo que `main` hace en la entrada de leads. Este SDD lo recorta a lo que **no necesita esquema ni migración**: un módulo puro de llave mínima, una declaración de qué llaves necesita cada necesidad de enriquecimiento con un único mensaje de «falta X», una lista única de correo personal y la propuesta de dominio para cuentas que no lo tienen. Lo demás (competidores, vínculo `people`–`stakeholders`, resultados de terceros) sigue en 7b y 7c.

## 2. Problema y para quién
Founder: pide investigar una cuenta y recibe un error distinto según la pantalla, o nada si lo lanza un automatismo que la salta en silencio. Equipo: la regla «qué hace falta para investigar» está repartida en seis sitios y la lista de correo personal, en cuatro, con contenido distinto.

## 3. Evidencia y por qué ahora
Leído el 2026-11-01 sobre `origin/main` (`11bc398`). No he ejecutado tests, la app ni consultado la base de datos.

### 3.1 Qué cambió en `main` desde el 2026-10-25 y su efecto sobre 7a
- **Quitar la UI multiempresa (#53):** no choca. 7a no cita ninguna pantalla de empresas. Sigue valiendo la regla de `src/lib/AGENTS.md:47`: los núcleos compartidos filtran por empresa e insertan `org_id` explícitamente; el módulo nuevo es puro y no toca la base de datos.
- **NK-0006/0018/0019/0020/0035 (país y tamaño):** hacen **obsoleto el hallazgo 1** del original («`country` y `size` son texto libre sin normalizar»). Hoy se normalizan al guardar (`src/lib/field-normalize.ts`; Descubiertos: `discoveries.functions.ts:46-49`; Clay, Apollo, web y Parallel: `d17fba7`). El «tamaño y país → valores normalizados» del delta del original está **hecho**.
- **NK-0038/0040/0041/0042/0036 (sugerencias):** no cambian 7a, pero dan un **patrón reutilizable** para «propón y espera»: `src/lib/field-proposals.ts` (clave estable por valor, descartado no vuelve) y los detectores de `src/lib/proactive/detectors/` (p. ej. `setup-incomplete.ts`).
- **NK-0008 y NK-0046:** sin relación.
- **Archivos que cita 7a en §13:** `planner.ts`, `leads-ingest.ts`, `lead-qualification.ts`, `autopilot.server.ts`, `stakeholders-tab.tsx`, `discoveries.server.ts` y `lead-tasks.server.ts` **no tienen commits desde el 2026-10-25**; `runner.ts`, `apollo.ts` y `clay.ts` solo por normalización de país/tamaño y formato (`git log --since=2026-10-25`).

### 3.2 Revalidación hallazgo a hallazgo
| Hallazgo del original | Veredicto | Evidencia (archivo:línea) |
|---|---|---|
| 1. Cuentas, 22 columnas; país y tamaño libres; sin ciudad ni ingresos | **Parcialmente obsoleto.** Hoy son 23 columnas (`last_human_edit_at`); país y tamaño ya se normalizan; sigue sin ciudad, ingresos ni descripción | `src/integrations/supabase/types.ts:245-270`; `field-normalize.ts`; `discoveries.functions.ts:46-49` |
| 2. Dominio como llave | **Vigente y más amplio.** No lo exigen solo Apollo y el investigador: Clay (personas), Clay y Apollo (completar cuenta), investigación web y el flujo de leads. Parallel **no** lo exige | `apollo.ts:55-58`, `clay.ts:190-197`, `clay-gateway.ts:195`, `apollo-gateway.ts:364`, `web-research-core.ts:44`, `lead-tasks.server.ts:63,89`; Parallel: `parallel.ts:86` (dominio opcional); autopilot: `autopilot.ts:8-11` y `autopilot.test.ts:8-18` |
| 3. `people` y `stakeholders` sin vínculo **[Por verificar]** | **Resuelto: no hay vínculo.** Ninguna tabla tiene la FK de la otra. Pasa a 7c | `types.ts:3656-3674` (`people`), `:4571-4590` (`stakeholders`) |
| 4. Sin nombre/apellido, teléfono ni ubicación en `people` | **Vigente en el dato; la necesidad no está probada.** Apollo ya parte el nombre al llamar | `types.ts:3656-3674`; `apollo.ts:262-266` |
| 5. Leads, 34 columnas; email personal; sin vínculo estable | **Vigente.** Hoy la entrada de leads **ya crea la cuenta y la persona** y escribe el dominio sin preguntar | `types.ts:2857-2892`; `leads-ingest.ts:50-70`; `lead-tasks.server.ts:35-59` |
| 6. Competidores sin entidad | **Vigente, pasa a 7b.** Siguen en texto; `knownCompetitors` está en `discoveries.ts:28`, no en `.server.ts` | `discoveries.ts:28-35`; `discoveries.functions.ts:72-74` |
| 7. ICP con campos de búsqueda | **Vigente, no se toca.** | — |
| 8. «El planificador salta lo ya tenido» | **Falso hoy.** `alreadyHave` existe en la firma y en el filtro, pero **ningún llamador lo pasa** | `planner.ts:39,52`; `runner.ts:88-94` (`planNeed`). Pasa a 7c (CA-16 original) |

### 3.3 Revalidación CA a CA del original
| CA original | Veredicto | Evidencia / motivo |
|---|---|---|
| CA-1 definir y comprobar llave mínima | **Vigente, sin hacer.** No existe módulo de llave; cada integración lanza su propio error | los seis sitios del hallazgo 2; `planner.ts:5-37` no declara llaves |
| CA-2 decir qué falta, por qué y ofrecer completarlo | **Vigente, a medias.** El texto «La cuenta no tiene dominio. Añádelo…» existe pero es un error sin oferta; el flujo de leads lo deja en «skipped» | `apollo.ts:58`, `lead-tasks.server.ts:63` |
| CA-3 misma comprobación desde pantalla, Agente y automático | **Vigente, sin hacer.** El autopilot filtra por dominio en otro sitio; el Agente va por `needs.ts` → `runner.ts` | `autopilot.ts:11`, `agent/tools/needs.ts` |
| CA-4 proponer dominio desde URL web o email corporativo | **Vigente, reformulado.** `accounts` **no tiene columna de web** (`types.ts:245-270`): la fuente real es el email corporativo de sus contactos o una URL que escribe la persona (`cleanDomain`, `leads.ts:208`) | — |
| CA-5 lead con email corporativo sin cuenta → **proponer** vincular o crear | **Contradice `main`.** Hoy se vincula por dominio exacto y se crea la cuenta **automáticamente**; pasar a «proponer» frena la entrada de leads. Ver P-3 | `leads-ingest.ts:50-57`, `lead-tasks.server.ts:35-59` |
| CA-6 email personal no deriva dominio y se pide la empresa | **Hecho en lo esencial, con un hueco real.** `corporateDomain` descarta correo personal, pero su lista **no incluye `outlook.es`** (sí lo tienen `leads.ts:45` y `product-usage.ts:32`): un lead de `@outlook.es` crearía una cuenta con ese dominio y lanzaría búsquedas sobre él **[por lectura; no ejecutado]**. La «empresa» siempre existe: `leads.company` es obligatorio (`types.ts:2861`) | `lead-flow.ts:56-60`; listas en `leads.ts:45`, `lead-flow.ts:56`, `lead-qualification.ts:28`, `product-usage.ts:32` |
| CA-7 conservar nombre completo y permitir nombre/apellido | **Mitad hecha, mitad sin necesidad probada.** Se conserva el nombre completo (`people.full_name`, `stakeholders.name`); partir en dos columnas es esquema, y ningún proveedor lo exige. Ver P-4 | `types.ts:3664,4580` |

### 3.4 Qué exige cada proveedor (resuelve un «Por verificar» del original)
Leído en el código, no en documentación del proveedor:
- **Apollo, personas de una cuenta:** dominio (`apollo.ts:55-60`). **Apollo, identificar a una persona:** id, email, LinkedIn, o nombre **más** dominio (`apollo.ts:273-277`): coincide **exactamente** con la llave de persona validada por Fede.
- **Clay:** dominio para personas y para completar la cuenta (`clay.ts:190-197`, `clay-gateway.ts:195`).
- **Parallel:** nombre; el dominio es opcional (`parallel.ts:78-88`).
- **Investigación web (Firecrawl/Perplexity):** dominio (`web-research-core.ts:44`).
- **Lusha:** **no aparece en `src/`** (búsqueda hecha): el original lo cita sin código que lo respalde. Se retira de la lista.
- Perplexity (como proveedor suelto), Apify y Firecrawl más allá de `web-research-core.ts`: **[Por verificar]**.

### 3.5 Línea base
Sin dato: no medida. Las consultas de solo lectura están en §16.

**Apuesta declarada:** no hay datos de uso; la prioridad se apoya en el código de `main` y en la petición de Fede.

## 4. Resultado buscado
G-5 del PRD, con las métricas replanteadas para que se puedan medir **hoy** (todas por consulta de solo lectura, ver §16; siempre con N; empresas internas, de demo y de prueba las decide Fede, P-7):
- **M-1.** % de cuentas con dominio válido que no es de correo personal. Línea base: **sin dato**.
- **M-2.** % de leads con cuenta vinculada y esa cuenta con dominio. Línea base: **sin dato**.
- **M-3.** Nº de peticiones de enriquecimiento fallidas en 30 días con mensaje de falta de dominio (`background_jobs.error`, `types.ts:602`). Línea base: **sin dato**. **[Por verificar]** que el error de Apollo/Clay llega a esa columna.
- Se **retira** «competidores con dominio» de este SDD: depende de 7b. El 0 del original («no existe la entidad») sigue siendo cierto (no hay tabla; `types.ts` solo tiene `lost_competitor` en deals).

## 5. Alcance
**Incluye:**
- Módulo puro `src/lib/fit-key.ts` con la llave mínima de cuenta, persona y lead, y su comprobación.
- Lista única de correo personal (`src/lib/free-mail.ts`) que sustituye las cuatro actuales.
- Declaración de llaves por necesidad en `planner.ts` y un único mensaje de «falta X», usado por los seis sitios actuales.
- Propuesta de dominio para cuentas sin él, como sugerencia que la persona acepta o descarta.
- Consultas de línea base (solo lectura).

**No incluye** (límite para «Movimientos prohibidos» del brief):
- **Migraciones, RLS, columnas nuevas, `drizzle/`, `BASELINE_MAX`.** Este SDD **no propone ninguna**. Si Fede decide P-6 (procedencia del dominio) o P-4 (nombre/apellido), eso exige migración y **depende de la salida de Lovable, hoy pausada, o de aplicarse a mano en Lovable Cloud**; no se hace aquí.
- Entidad Competidor y alta manual (7b).
- Vínculo `people`–`stakeholders`, identidad única, resultados de terceros con origen y `alreadyHave` (7c).
- Cambiar la entrada de leads (P-3) ni el orden o el coste de los proveedores.
- Contratar proveedores; LinkedIn solo por API oficial (NOKKO no analiza ni puntúa perfiles).
- Backfill de dominios de cuentas existentes: no se escribe nada masivamente; lo hace la persona al aceptar una propuesta.

## 6. Cambios de comportamiento (delta)
**Añadido:** comprobación de llave antes de gastar en un proveedor; mensaje único «Para investigar a *X* falta el dominio»; sugerencia «Propuesta de dominio» por cuenta.
**Modificado:** los seis errores sueltos por falta de dominio pasan a un solo mensaje con salida; las cuatro listas de correo personal pasan a una (**cambia el comportamiento de `@outlook.es` en el flujo de leads**: deja de derivar dominio); un dominio de correo personal en una cuenta cuenta como «falta la llave».
**Eliminado:** los «Por verificar» resueltos (§3.4); Lusha de la lista de proveedores; la dependencia de §3 hallazgo 8 (`alreadyHave`).

## 7. Historias y criterios de aceptación
Trazabilidad con el original: la columna «Orig.» dice qué CA del 7a original cubre; 7b y 7c citan CA-1, 2, 3, 6 y 7 «en 7a» (`7b §8`, `7c §8`) y deben seguir resolviendo a esa numeración.

### H-1: Como founder, quiero saber qué falta para que NOKKO investigue una cuenta, persona o lead, y que me lo diga igual venga de donde venga la petición.
- **CA-1** `missingKey(entity, record)` DEBE devolver la lista de llaves que faltan y el motivo, con estas reglas: **cuenta** = nombre + (dominio válido que no sea de correo personal **o** LinkedIn de empresa); **persona** = id de proveedor, email o LinkedIn, **o** nombre + cuenta con dominio válido (misma regla que `matchDetails`, `apollo.ts:273-277`); **lead** = cuenta vinculada con dominio válido (persona opcional; ver P-2) · cubre G-5 · Orig. CA-1 · prueba: `src/lib/fit-key.test.ts`
- **CA-2** SI falta una llave, ENTONCES el sistema NO DEBE llamar al proveedor ni gastar presupuesto, y DEBE devolver el mensaje «Para investigar a *X* falta *dato*» con lo que puedes hacer (escribirlo o aceptar la propuesta, si la hay) · cubre G-5 · Orig. CA-2 · prueba: `src/lib/orchestrator/runner.test.ts` (caso nuevo: sin dominio, el proveedor simulado no se invoca)
- **CA-3** CADA `Need` de `planner.ts` DEBE declarar las llaves que exige (`NEED_KEYS: Record<Need, …>`, exhaustivo por tipo), y los seis puntos que hoy lanzan su error propio (`apollo.ts:58`, `clay.ts:196`, `clay-gateway.ts:195`, `apollo-gateway.ts:364`, `web-research-core.ts:44`, `lead-tasks.server.ts:63,89`) DEBEN usar el mensaje de CA-2, igual desde pantalla, Agente y automatismos · cubre G-5 · Orig. CA-3 · prueba: `src/lib/orchestrator/planner.test.ts` (cada `Need` tiene llaves) y `src/lib/fit-key-entrypoints.test.ts` (nuevo; los seis mensajes salen de `fit-key.ts`: el texto cambia en una sola línea y los seis tests lo siguen)

### H-2: Como founder, quiero que NOKKO deduzca la llave que pueda, sin equivocarse de empresa.
- **CA-4** Hay UNA lista de correo personal (`src/lib/free-mail.ts`) y `leads.ts`, `lead-flow.ts`, `lead-qualification.ts` y `product-usage.ts` la usan; `corporateDomain("ana@outlook.es")` DEBE ser `null` (rojo hoy: `lead-flow.ts:56`) · cubre G-5 · Orig. CA-6 · prueba: `src/lib/free-mail.test.ts` (nuevo, incluye `outlook.es`, `hotmail.es`, `msn.com`) y `src/lib/lead-flow.test.ts` (caso nuevo)
- **CA-5** Una cuenta cuyo dominio es de correo personal DEBE tratarse como «falta el dominio» en `missingKey` y NUNCA se propone como dominio · cubre G-5 · Orig. CA-6 (segunda mitad) · prueba: `src/lib/fit-key.test.ts`
- **CA-6** `proposeDomain(contactos)` DEBE devolver el dominio corporativo más frecuente entre los emails de los contactos de la cuenta (personas, stakeholders y leads vinculados), o `null` si no hay ninguno corporativo; en empate no elige · cubre G-5 · Orig. CA-4 · prueba: `src/lib/fit-key.test.ts`
- **CA-7** CUANDO una cuenta no tiene dominio y `proposeDomain` da uno, el sistema DEBE crear una sugerencia «Propuesta de dominio» con acción `update_account` (`agent/tools/accounts.ts:219`), con clave estable por cuenta y dominio para que lo descartado no vuelva; SI otra cuenta de la empresa ya tiene ese dominio, NO DEBE proponerlo y DEBE avisar del posible duplicado (`duplicateOf`, `match.ts:63`), sin fusionar nunca · cubre G-5 · Orig. CA-4 y §8 «dominio duplicado» · prueba: `src/lib/proactive/detectors/account-missing-key.test.ts` (nuevo)
- **CA-8** La entrada de leads DEBE seguir vinculando por dominio corporativo exacto y creando la cuenta sin preguntar, como hoy (decisión P-3); queda fijado con una prueba de caracterización · cubre G-5 · Orig. CA-5 (reinterpretado) · prueba: `src/lib/lead-flow.test.ts` (caso de caracterización) y, para el camino del servidor, `src/lib/leads-ingest.test.ts` (nuevo, con la base simulada)
- **CA-9** Una persona con un solo nombre DEBE aceptarse; `missingKey` solo exige apellido si ningún proveedor lo pide, y hoy ninguno lo pide (`apollo.ts:262-266`) · cubre G-5 · Orig. CA-7 (reducido) · prueba: `src/lib/fit-key.test.ts`

## 8. Casos límite y errores
- Cuenta con dominio con mayúsculas, `www.` o ruta: se normaliza con `cleanDomain` antes de comprobar (CA-1).
- Contactos con varios dominios corporativos empatados (p. ej. matriz y filial): no se propone ninguno (CA-6).
- Dominio ya en otra cuenta: aviso, nunca fusión (CA-7; `AGENTS.md:23`).
- Cuenta sin dominio **y** sin propuesta posible: sigue «Falta el dominio»; la persona lo escribe o añade un contacto con email corporativo (CA-2).
- Registros históricos sin llave: se listan como «Faltan datos» sin bloquear su uso (CA-1; la lista visible es de la pantalla de Cuentas, **fuera** de este SDD: ver P-1).
- Presupuesto agotado: regla actual (pausa al 100 % de lo automático, `planner.ts:49,62-66`); la comprobación de llave va **antes**, así que una cuenta sin llave ni siquiera consume la consulta de presupuesto.
- Rol sin permiso para editar: aceptar la propuesta pasa por `update_account`, que ya respeta roles.
- Otra empresa (multitenant): `proposeDomain` solo ve datos que le pasa quien lo llama, ya filtrados por empresa (`src/lib/AGENTS.md:47`).

## 9. Experiencia y copy
«Para investigar a *Acme* falta el dominio. Lo he deducido del email de sus contactos: *acme.com*. ¿Lo confirmas?» Sin propuesta: «Para investigar a *Acme* falta el dominio. Escríbelo (acme.com) o añade un contacto con email de empresa.» Estados con palabra: «Completa», «Falta *dato*», «Propuesta». «Tú», sin iconos, datos de ejemplo ficticios (acme.com).

## 10. Datos, permisos y privacidad
- **No se añaden tablas, columnas, políticas ni migraciones.** Nada de esto depende de la salida de Lovable.
- Se leen emails de contactos para deducir un dominio; **no se envía nada a terceros** por este cambio. Que la comprobación de llave evite llamadas reduce los datos enviados.
- **Observado, no cambiado:** el encargo a Parallel incluye la ficha de **nuestra** empresa (`one_liner`, `category`, `target_customer`) además de nombre, dominio y país de la cuenta (`parallel.ts:78-88`). Qué se envía a Apollo, Clay y los demás: **[Por verificar]**.
- El dominio **no está en la lista de campos con procedencia** del trigger 0058 (`industry, size, country, notes, linkedin_url`; sin aplicar hasta donde consta): un dominio aceptado desde la propuesta se guarda sin marca de origen. Ver P-6.
- Ningún dato de clientes en pruebas ni en ejemplos.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| ninguna | regla (normalización y frecuencia de dominios) | — | — |

Este SDD no añade llamadas a IA. Las existentes (investigación, `aiProviders()` en `src/lib/gemini.ts`) no cambian; solo se evitan cuando falta la llave.

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | `free-mail.ts` (lista única, cuatro usuarios) y `fit-key.ts` (`missingKey`, reglas de cuenta, persona y lead) | CA-1, CA-4, CA-5, CA-9 | `src/lib/free-mail.test.ts` (`outlook.es`) y `src/lib/fit-key.test.ts` |
| U-2 | `NEED_KEYS` en `planner.ts`, comprobación antes del proveedor y mensaje único en los seis sitios | CA-2, CA-3 | `src/lib/orchestrator/runner.test.ts` (el proveedor no se invoca sin dominio) |
| U-3 | `proposeDomain`, detector de sugerencia «Propuesta de dominio» y prueba de caracterización de la entrada de leads | CA-6, CA-7, CA-8 | `src/lib/proactive/detectors/account-missing-key.test.ts` |

Orden: U-1 → U-2 → U-3 (U-2 y U-3 consumen U-1). U-1 y U-2 son independientes de NK-0047 y de los demás tickets abiertos que yo sepa; **[Por verificar]** con la coordinadora que nadie más toca `planner.ts`, `runner.ts`, `lead-flow.ts` ni `leads.ts`.

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- Reutilizar: `cleanDomain` (`leads.ts:208`), `matchDetails` (`apollo.ts:261-282`; ideal: que `missingKey(persona)` lo llame o comparta la regla, para que no diverjan), `duplicateOf` (`match.ts:63`), `field-proposals.ts` como molde de clave estable y de «no vuelve lo descartado».
- La lista de correo personal más completa hoy es `FREE_EMAIL_DOMAINS` (`product-usage.ts:32`, 24 dominios, incluye `outlook.es`, `msn.com`, `mail.com`, `yandex.com`); las otras tres son subconjuntos. Partir de esa y revisar que ningún dominio corporativo legítimo caiga dentro (p. ej. `telefonica.net`, `terra.es` son proveedores de acceso, pero hay empresas con dominio propio parecido: decisión del gate o de Fede si se quita alguno).
- `lead-qualification.ts` usa su lista para marcar `personal` en el contexto de IA (`:70`): al unificar cambia su entrada en casos de `hotmail.es`/`outlook.es`; el test existente de cualificación debe seguir en verde.
- Descartado: columna `website` en `accounts` (esquema, depende de Lovable) y proponer la vinculación de leads (rompe la entrada automática, ver P-3).
- Un guarda por archivo estilo `setup-write-guard.test.ts` (NK-0008) sería red gruesa para «nadie lanza un error propio de falta de dominio»; CA-3 usa pruebas por mensaje y no ese guarda. Decisión del gate.

## 14. Riesgos y dependencias
- **Cambio visible:** los leads de `@outlook.es` dejan de crear una cuenta con dominio `outlook.es`. Es una corrección, pero la anuncia el delta.
- **Cuentas ya creadas con un dominio de correo personal:** `missingKey` las marca como «falta el dominio»; **cuántas hay: sin dato** (consulta Q4 de §16). No se corrigen solas.
- **Orden con 7b y 7c:** 7a no depende de esquema; 7c-U-4 (identidad única) y 7b (competidores) sí, y por tanto de Lovable. Recomendado: 7a primero (P-1).
- **Numeración:** 7b y 7c apuntan a los CA-1, 2, 3, 6 y 7 del original; si Fede aprueba este SDD hay que añadir en ellos «numeración del 7a original» o remapear. No lo hago sin su aprobación.
- Las tres partes repiten literalmente §3 a §6 (hallazgos, delta y tabla de llave): al aprobar este SDD conviene que 7b y 7c recorten lo suyo. Fuera de este ticket.

## 15. Preguntas para Fede y para la revisión técnica
**P-1. ¿Recortamos 7a a lo que no necesita esquema y dejamos competidores, vínculo de personas y resultados de terceros en 7b/7c?** Mi recomendación: **sí.** Porque así 7a se entrega sin esperar a Lovable (que está pausada), y lo que sí necesita migración (7c-U-4, 7b-U-3) se decide con el mismo plan de aplicación manual. Lo que añadiría el original completo: un único ticket grande con una migración dentro.

**P-2. ¿Relajamos la llave del lead a «cuenta con dominio» (persona opcional)?** La tabla actual la validaste tal cual («persona + cuenta, ambas vinculadas»). Mi recomendación: **sí, relajarla.** Porque el flujo real solo crea persona si hay email (`leads-ingest.ts:59-70`) y lo que de verdad bloquea el enriquecimiento es la cuenta sin dominio (`lead-tasks.server.ts:63,89`); exigir persona dejaría fuera leads válidos sin email. Si prefieres mantenerla, CA-1 cambia una línea.

**P-3. En la entrada de leads, ¿mantenemos vincular/crear cuenta automáticamente (CA-8) o pasamos a «proponer» como pedía el CA-5 original?** Mi recomendación: **mantener lo automático** cuando el dominio corporativo coincide exactamente y **proponer solo** en cuentas que ya existen sin dominio (CA-7). Porque la entrada de leads es un camino automático y sin nadie delante (`lead-tasks.server.ts:35-59`); pedir confirmación ahí paraliza el embudo, y el riesgo que quería evitar el CA-5 (una cuenta equivocada) está más cubierto por la lista única de correo personal (CA-4).

**P-4. ¿Retiramos «nombre y apellido por separado» (CA-7 original)?** Mi recomendación: **sí, retirarlo ahora.** Porque es esquema (columnas nuevas = migración, depende de Lovable), ningún proveedor lo exige hoy (Apollo parte el nombre al llamar, `apollo.ts:262-266`) y no hay dato de que su ausencia haya fallado ninguna búsqueda. Se reabre si una consulta de M-3 muestra fallos por eso.

**P-5. Un dominio de correo personal escrito a mano en una cuenta, ¿se rechaza al escribir o solo cuenta como «falta la llave»?** Mi recomendación: **solo contar como «falta»** en este ticket y abrir otro para rechazarlo al escribir. Porque hay al menos seis escritores de `accounts.domain` (formulario de Cuentas, `create_account`/`update_account`, importación, Apollo, Clay, Parallel, Descubiertos) y tocarlos todos amplía mucho el alcance; con el aviso de CA-2 la persona ya lo ve.

**P-6. ¿Queremos procedencia (origen y confirmación) también para `accounts.domain`?** Mi recomendación: **no ahora.** Porque exige ampliar la lista del trigger de 0058 (una migración, **que depende de la salida de Lovable, hoy pausada, o de aplicarse a mano en Lovable Cloud**) y 0058 ni siquiera consta como aplicada. Mientras tanto, un dominio aceptado desde la propuesta queda sin marca; es honesto con lo que hay («sin marca = sin dato», `SDD-20261028-field-sources-on-tracked-writers`).

**P-7. Medición: ¿quién ejecuta las consultas de §16 y qué empresas se excluyen (internas, demo, prueba)?** Mi recomendación: **tú, en el editor SQL de Lovable Cloud** (el rol del editor ve todas las empresas), excluyendo las que marques tú con su id. Porque el conector `nokko` no conectaba (`ENOTFOUND` en las notas de NK-0006) y yo no tengo acceso a esa base; sin ese filtro M-1 y M-2 se contaminan con datos de prueba.

## 16. Pendiente de verificar
**Consultas de solo lectura para la línea base (no ejecutadas; Lovable Cloud, editor SQL; solo recuentos, sin valores ni nombres):**
- **Q1 (M-1).** `select count(*) as cuentas, count(*) filter (where nullif(btrim(domain),'') is not null) as con_dominio, count(*) filter (where nullif(btrim(linkedin_url),'') is not null) as con_linkedin, count(*) filter (where nullif(btrim(domain),'') is null and nullif(btrim(linkedin_url),'') is null) as sin_llave from public.accounts;` (añadir `where org_id <> all(:excluidas)`).
- **Q2 (M-2).** `select count(*) as leads, count(*) filter (where l.account_id is not null) as con_cuenta, count(*) filter (where nullif(btrim(a.domain),'') is not null) as con_cuenta_con_dominio from public.leads l left join public.accounts a on a.id = l.account_id;`
- **Q3 (cuántos duplicados y cuántos dominios de correo personal).** Dominios repetidos: `select count(*) from (select org_id, lower(domain) from public.accounts where nullif(btrim(domain),'') is not null group by 1,2 having count(*) > 1) t;` y dominios personales: `select count(*) from public.accounts where lower(domain) = any (array['gmail.com','googlemail.com','hotmail.com','hotmail.es','outlook.com','outlook.es','live.com','msn.com','yahoo.com','yahoo.es','icloud.com','me.com','proton.me','protonmail.com','aol.com','gmx.com']);`
- **Q4 (cuentas creadas por el hueco de `outlook.es`).** `select count(*) from public.accounts where lower(domain) in ('outlook.es','hotmail.es');`
- **Q5 (M-3).** `select count(*), min(created_at), max(created_at) from public.background_jobs where status = 'failed' and error ilike '%no tiene dominio%' and created_at > now() - interval '30 days';` (los nombres exactos de columnas, en `types.ts:602-620`).
- **Q6 (solape `people`/`stakeholders`, para 7c).** `select count(*) from public.stakeholders s join public.people p on p.org_id = s.org_id and lower(p.email) = lower(s.email) where s.email is not null;` y los de `linkedin_url`.

**[Por verificar]:**
- Requisitos de Perplexity, Apify y Firecrawl más allá de `web-research-core.ts` (§3.4).
- Qué datos se envían a Apollo y Clay (solo está leído Parallel, `parallel.ts:78-88`); base legal de los datos de contacto (no es de código).
- Que el error de Apollo/Clay por falta de dominio llega a `background_jobs.error` (M-3).
- Que `outlook.es` crea de verdad una cuenta con ese dominio en `lead-tasks.server.ts` (leído en `lead-flow.ts:56-60` y `lead-tasks.server.ts:30,47`; **no ejecutado**).
- Que `production` coincide con `main`.
- Estado real de 0058 en cada base (el SDD universal dice «sin aplicar»; hay una sesión de verificación aparte, y no la he consultado).
- Que nadie más está tocando `planner.ts`, `runner.ts`, `lead-flow.ts` ni `leads.ts`.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Un agente `nokko-gate` con contexto fresco lee este SDD y el código, y devuelve su informe. El coordinador lo copia aquí sin editarlo. El gate no aprueba el SDD: informa; la aprobación es de Fede.
- Veredicto del gate: **No revisado.**
- CA sin prueba posible o sin G-n: —
- [Por verificar] que sigue sin comprobarse: —
- Contradicciones con el código o con decisiones previas: —
- Lo que esta revisión NO demuestra: —

## 18. Delta de implementación (lo rellena el agente al entregar)
Sin entrega todavía.
