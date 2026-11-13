# PRD-20261113-verificacion-de-email · [Iniciativa] Verificación de email antes de contactar

**Tipo:** Iniciativa (cuatro SDD con orden y dependencias; el ticket está registrado como `kind: feature`, `.factory/ledger.json:5054`: se mantiene el nivel Iniciativa porque hay cuatro SDD con dependencias entre sí y una dependencia externa (NK-0171); si Fede prefiere tratarlo como feature, la alternativa más ligera es reducirlo a los SDD 1 a 3 y dejar el 4 como petición dentro de NK-0171. El tipo del ticket lo corrige `nokko-tracker`, no este documento) · **Prioridad propuesta:** Media (la parte que no gasta nada nuevo, guardar el estado que Apollo ya devuelve, es pequeña y barata; el verificador independiente solo se justifica si esa primera parte demuestra que hace falta; sin datos de uso, es una apuesta declarada)
**Estado:** Borrador · **Pide:** Fede (análisis de las funciones públicas de Glider, 2026-11-12) · **Aprueba:** Fede · **Fecha:** 2026-11-13
**Ticket:** NK-0173 (LOGGED, `.factory/ledger.json:5052`; `sdd` y `prd` aún vacíos)
**SDD que lo desarrollan:** pendientes (sección 8): cuatro
**Depende de (no está en `main`):** `docs/prd/PRD-20261112-plays-a-medida.md` (NK-0171, Borrador, rama `docs/sprint8-prd-plays-a-medida` @ d58a1f8). Ese PRD **no** exige un email verificado: su paso de contacto se resuelve con Clay o Apollo «si el play lo pide» y, si no hay contacto, se dice «sin dato» (`PRD-20261112-plays-a-medida.md:155`). Este PRD define qué significa «verificado» y **propone** un parámetro de puerta opcional para las recetas; añadirlo a NK-0171 es una petición a Fede (Q-7), no un requisito existente.

> Un PRD dice qué se quiere y por qué. No dice cómo se construye ni cómo se prueba: eso es del SDD.

## Resumen para aprobar (Fede)
- **Hoy NOKKO no verifica ningún email.** Apollo devuelve un estado del email en cada revelado y el código lo lee y lo tira (`apollo.ts:223,233,247`; no se guarda en ninguna tabla). No hay estado de verificación en `stakeholders`, `leads` ni `people`.
- **Propuesta en dos pasos.** Primero guardar y enseñar lo que Apollo ya devuelve en un revelado que ya pagas (sin proveedor nuevo y, según lo que se lee en el código, sin gasto extra). Después, solo si ese primer paso muestra huecos (por ejemplo, muchos contactos sin estado), decidir un verificador independiente con datos, que es un SDD aparte porque exige un gateway nuevo.
- **Cinco estados cerrados:** verificado, catch-all, no verificable, inválido, sin verificar (sección 6.1).
- **Regla de no enviar:** NOKKO prepara y otras herramientas envían. Regla graduada (propuesta del coordinador, 6.5): un contacto «inválido» o «catch-all» no recibe ningún borrador automático ni de agente/MCP, con el motivo a la vista, en **todas** las superficies que generan borradores (agente/MCP `draft_followup`, el detector `followup_sequence`, los plays de `main`, las recetas de NK-0171). «Sin verificar» y «no verificable» **sí** lo reciben, con una marca visible. Exigir «solo verificado» es un parámetro opcional de un play o receta (Q-7), no una regla general.
- **Ningún gasto oculto.** Cada verificación pasa por una necesidad del orquestador y escribe en `integration_usage`. Hallazgos previos: hoy los revelados de Apollo desde las pantallas y desde el agente **no** registran su gasto (3.4), y el planificador **también pausa lo manual con coste** al llegar al límite, al contrario de lo que dicen un comentario y `src/lib/AGENTS.md:41` (3.4, Q-6). El SDD 2 lo cierra.
- **Qué decides tú:** siete preguntas abiertas con recomendación (sección 6.3), entre ellas la ventana de re-verificación (**[Por decidir]**), la retención de la fila, si lo manual con coste se pausa al límite y si añadimos una puerta opcional a NK-0171.
- **Lo que no sabemos:** qué valores concretos devuelve Apollo y si distingue catch-all; el precio y la cobertura de cualquier verificador; el análisis de Glider es una página de marketing de un competidor, sin verificar (sección 7.1).

## 1. Problema
Un vendedor que usa NOKKO puede acabar con un borrador de mensaje dirigido a un email que nadie ha comprobado: el email viene de un revelado, de un CSV, de la ingesta de leads o de una edición a mano, y la ficha no dice si esa dirección existe, si el dominio acepta cualquier cosa (catch-all) o si la comprobación no fue posible. Escribir a una dirección inválida o dudosa daña la reputación del buzón desde el que se envía, y NOKKO no lo envía pero sí sugiere el mensaje. Las recetas de plays a medida (NK-0171) resuelven el contacto con Clay o Apollo y no tienen hoy ningún estado que decir sobre esa dirección: si en el futuro quisieran exigir un contacto comprobado, no tendrían de dónde sacarlo.

## 2. Para quién
- **Owner y Sales Leader:** deciden el proveedor y la ventana de re-verificación; aprueban los gastos que se pidan fuera de lo ya aprobado.
- **Cualquier miembro** que busca personas, revela contactos o pide un borrador (hoy cualquier miembro puede revelar, `apollo.functions.ts:27-35`): ve el estado y el motivo cuando un borrador se bloquea.
- **El agente y el servidor MCP:** responden con el estado y no ofrecen un borrador que la regla bloquea.

## 3. Evidencia y por qué ahora
Leído en solo lectura sobre `origin/main` @ 36b4b1b (2026-11-13). Fuente del ticket: Fede, 2026-11-12, análisis de las funciones públicas de Glider (Email Finder, Reverse Email Lookup, Email Verification con catch-all, B2B Enrichment). Son afirmaciones de la página de marketing de un competidor, **sin verificar**; solo aportan la idea de qué estados mostrar.

### 3.1 Qué hace hoy el código con el email
| Pregunta | Respuesta comprobada | Dónde |
|---|---|---|
| ¿Apollo devuelve estado del email? | Sí: `ApolloMatch.email_status` (texto libre o null) y `RevealedContact.emailStatus` | `src/lib/apollo.ts:216-236`, `matchToContact` copia `emailStatus` en `:247` |
| ¿Se guarda o se enseña? | No. Ninguna otra referencia a `emailStatus` o `email_status` en `src/` ni en `drizzle/`; las pantallas y el agente leen solo `contact.email` (`src/components/apollo.tsx:364,520`, `src/lib/agent/tools/apollo.ts:146-153`) | grep del 2026-11-13 |
| ¿Qué valores devuelve Apollo? | **[Por verificar]**: el código no los enumera ni los prueba; hace falta una respuesta real o la documentación de Apollo | `apollo.ts:223` |
| ¿La búsqueda de personas da estado? | No: solo `has_email` (bool) en el resultado, oculto el contacto hasta revelar | `apollo.ts:187,210`; la búsqueda es gratis (`apollo.ts:32`) |
| ¿Cómo se revela y qué cuesta? | `people/bulk_match` por la pasarela de conectores de Lovable, hasta 10 personas por llamada, `reveal_personal_emails=false`; el móvil es opcional y asíncrono | `apollo-gateway.ts:36,89-101`, `apollo.ts:36` |
| ¿Cuánto cuesta un revelado? | El código lo estima en 0,02 EUR por persona (0,17 con móvil), **estimado**, no medido | `orchestrator/search.ts:24-27`; el planificador declara sus costes como «rough cost» (`planner.ts:2`) |
| ¿El revelado sobrescribe emails? | Al añadir al mapa, solo rellena un email vacío de una persona existente (`apollo-gateway.ts:201`); al revelar un stakeholder ya existente, **sustituye** su email si es distinto (`:310`) | ver riesgo en 7 |
| Teléfono | Asíncrono: se guarda una fila `phone_reveals` pendiente y Apollo entrega al webhook, que rellena `phone_reveals` y `stakeholders.phone`; si ya hay un teléfono entregado se reutiliza sin pagar | `apollo-gateway.ts:104-121,268-295`, `src/routes/api/public/apollo/phone-webhook.ts:11-52`, `drizzle/migrations/0030_apollo_phone_reveals.sql` |
| ¿Clay trae emails? | No. `ClayPerson` y `StakeholderDraft` no tienen campo de email; Clay busca empresas y personas y completa cuentas | `src/lib/clay.ts:75-88,110-115`, `src/lib/clay-gateway.ts:140-178` |
| ¿Hay una necesidad de «verificar»? | No. Existe `find_email` con opciones Apollo y Clay en `CAPABILITIES`, pero solo se usa como etiqueta del registro de gasto del revelado de Apollo; ningún código ejecuta Clay para `find_email` | `planner.ts:83-89`, `runner.ts:483` |

### 3.2 Qué proveedores puede llamar NOKKO hoy
- **Cableados:** Apollo, Clay, Parallel, Firecrawl, Perplexity, Apify y Drive. `Service` (`planner.ts:6-16`) añade `posthog`, `stripe` y `ai`; el estado «conectado» sale de variables de entorno de la plataforma (`runner.ts:31-43`, `connectedServices()` no recibe empresa). Apollo y Clay van por `connector-gateway.lovable.dev` (`apollo-gateway.ts:36`, `clay-gateway.ts:28`).
- **FullEnrich: no está cableado.** No existe en `src/` ni en `drizzle/` (grep sin resultados). Solo figura en el SDD aprobado `SDD-20261030-gtm-control-tower-4a-data-sources.md` (enmienda del 2026-10-31: CA-32 y CA-33) como proveedor futuro de enriquecimiento y revelado, con la condición de no enviarle URLs de LinkedIn y de pedir aprobación explícita antes de revelar contactos. Ese SDD cita un registro `src/lib/connections.ts` que **no existe** en `main`.
- **Hunter: no está cableado ni citado en ningún documento del repositorio salvo el ticket NK-0173.**
- Por tanto, **entre lo que NOKKO puede llamar hoy, solo Apollo devuelve un estado de email**, y solo dentro de un revelado.

### 3.3 Dónde se guardan los contactos y cómo se enseñan
- **Tres tablas con email, sin estado de verificación y sin procedencia por campo:**
  - `stakeholders` (personas de una cuenta; `email`, `phone`, `linkedin_url`, `org_id`): `drizzle/migrations/0000_migration.sql:96-106`, tipos en `src/integrations/supabase/types.ts:4676`.
  - `leads` (`email`, `contact_name`, `person_id`): `drizzle/migrations/0012_lead_funnel.sql:2-30`.
  - `people` (`email`; índice único actual `people_org_email_uniq (org_id, lower(email))`, `0002_multitenant_organizations.sql:144-146`, que sustituyó al de `0000_migration.sql:156`). `stakeholders.org_id` y `phone` no están en `0000:96-106`; los confirman los tipos `types.ts:4676-4700`.
- **Entrada de emails:** edición a mano (`src/components/account/stakeholders-tab.tsx:171-175`, que **no** pasa a minúsculas, y `src/components/leads/lead-dialogs.tsx:61`); CSV e ingesta de leads, donde solo se comprueba el formato con una expresión regular y se pasa a minúsculas (`src/lib/leads.ts:718-720`); los revelados de Apollo; y las herramientas de escritura del agente y de MCP: `update_stakeholder` y creación de personas/stakeholders (`src/lib/agent/tools/accounts.ts:396,514,556`), `core-write.ts:398,599` y `create_lead` (`pipeline.ts:66-72`). Como no todos normalizan, la clave de la verificación (email en minúsculas, sin espacios) se aplica **al leer y al escribir**, no solo al guardar.
- **Procedencia:** `field_sources` existe solo en `accounts`, `icp_profiles`, `positioning`, `messaging_pillars` y `segments` (`drizzle/migrations/0046:1`, `0058:14`, `0061:14-16`; `src/lib/provenance.ts:1-4`). **No existe en `stakeholders`, `leads` ni `people`.** La regla «un escritor automático solo rellena campos vacíos» (`autoWriteDecision`, `src/lib/AGENTS.md:55`) está documentada para cuentas.
- **Presentación:** la ficha del stakeholder muestra un campo de texto de email; `quick-actions.tsx:272,348` abre `mailto:`. No hay badge ni estado.
- **Herramientas del agente y de MCP:** `apollo_find_people` (lectura, devuelve `tiene_email`, también en `agent/tools/needs.ts:74`), `apollo_reveal_contacts` y `apollo_reveal_stakeholder` (escritura: esperan la confirmación de la persona, gastan créditos), `clay_find_people` (lectura) en `src/lib/agent/tools/apollo.ts:28-182` y `clay.ts`. El servidor MCP genera sus herramientas desde el mismo registro (`src/lib/AGENTS.md:17`; títulos en `TITLES`, `src/lib/mcp/tools/agent-tools.ts:14`).
- **Borradores: inventario completo de superficies que producen un texto para enviar** (NOKKO no envía; `mailto:` abre el cliente de correo de la persona, `quick-actions.tsx:272,348`):
  1. `draft_followup` del agente y de MCP (lectura, `core-read.ts:514`): carga el lead **sin** el campo `email` (`core-read.ts:528-534`), así que hoy no puede aplicar ninguna regla sobre la dirección.
  2. El detector **automático** `followup_sequence` (`src/lib/proactive/detectors/followup-sequence.ts:9-20`; cuerpo «Borrador (…) Envíalo desde tu email o LinkedIn»), registrado en `src/lib/proactive/index.ts:12,48`, invocado también por `followupStep` (`src/lib/inngest/lead-tasks.server.ts:354-360`) y documentado en `src/lib/AGENTS.md:22`. Es la superficie automática principal.
  3. La biblioteca de plays que ya existe en `main`, con salida `draft` (`src/lib/plays/catalog.ts:40,93,121,228`).
  4. Las recetas de NK-0171 (futuras).

### 3.4 Presupuesto y registro de gasto
- Tabla `integration_usage` (`service`, `need`, `trigger` manual o automático, `cost`) y `org_budgets` (`drizzle/migrations/0041_orchestrator_budget_usage.sql:1-34`), con RLS por empresa.
- El orquestador elige servicios por necesidad (`planner.ts:51-129`), consulta el presupuesto (`runner.ts:48-66,83-96`): aviso al 80 %, pausa el trabajo automático al 100 %. Registra el gasto con `logUsage` (`runner.ts:68-81`).
- **Hallazgo (corrige una premisa de la primera versión): lo manual con coste también se pausa.** `planFor` descarta cualquier opción con `cost > budget.remaining` sea cual sea el disparador (`planner.ts:165-167`) y `budgetState` pone `remaining = 0` al 100 % (`planner.ts:188`). La sonda del gate (`.factory/evidence/NK-0173/prd-gate-pass1-manual-budget-probe.ts`) lo confirma: un `find_email` **manual** con el presupuesto al 100 % devuelve `steps` vacío. El comentario de `planner.ts:184` («manual requests are never paused») y `src/lib/AGENTS.md:41` («pauses only automatic work») son erróneos para necesidades con coste. El test existente solo cubre `find_stakeholders`, cuyo Apollo cuesta 0 (`planner.test.ts:26-41`). Por tanto, hoy **un revelado o una verificación manual con coste se bloquearía** al llegar al límite si pasa por `planNeed`. Además, `revealKeyPeople` **no consulta** el presupuesto: llama a `logUsage` sin `planNeed` (`runner.ts:477-485`).
- **Hallazgo (registro):** solo `revealKeyPeople` registra el gasto de un revelado (`runner.ts:477-485`, llamado desde `orchestrator.functions.ts:44-52`). Los otros caminos llaman directamente a `revealToAccount` o `revealStakeholder` **sin** `logUsage`: las pantallas (`apollo.functions.ts:27-35`) y las herramientas del agente (`agent/tools/apollo.ts:141,168`). Tampoco hay registro de gasto en la capa del agente ni de MCP (grep de `logUsage` e `integration_usage`). Es decir, hoy parte del gasto de Apollo no entra en `org_budgets`. **[Por verificar]** con datos reales de `integration_usage`; lo que sí se comprueba es que esas rutas no llaman al registro.
- Regla de la casa: las acciones nuevas con proveedor pasan por el orquestador, nunca directas a un gateway (`src/lib/AGENTS.md:41`; la misma línea contiene la afirmación errónea de arriba).

### 3.5 Privacidad
- RLS por empresa en las tablas de contactos y de gasto; las claves de proveedor son de la plataforma, no por empresa (decisión C-1 del PRD de plays).
- Un log del servidor no puede llevar cuerpos ni cortes de texto de proveedor ni el error entero: `src/lib/server-log-scan.test.ts` lo vigila en todo `src/lib/**` y `src/routes/api/**`; `safeErrorLog` solo guarda nombre, longitud y estado (`src/lib/agent/safe-error-log.ts`). Un email es dato personal: nunca va a un log, a un ejemplo ni a un fixture.

### 3.6 Lo que dice el PRD de plays a medida (Borrador, `d58a1f8`)
- «Contacto: quién y por qué canal, resuelto con Clay o Apollo si el play lo pide; si no hay contacto, se dice sin dato» (línea 155).
- «Contacto verificado propio: NOKKO sigue usando Clay y Apollo para encontrar contacto; no se construye un proveedor de contactos» (línea 84, no-objetivo). Este PRD lo respeta: no construye un proveedor de contactos.
- Decisión 13 de Fede (2026-11-12), contacto de personas de la UE: «Permitirlo con aviso en la verificación manual», sin interruptor por empresa (línea 105; «Aviso de UE», línea 162).
- «No se afirma la calidad de los datos de contacto de Clay o Apollo» (línea 249).
- **Contradicción que debe corregir el dueño de NK-0171:** ese PRD dice que el gasto de proveedor «ya lo registra `trackedRun`/`logUsage`» (línea 80 y C-13, línea 141). El hallazgo 3.4 de este PRD lo contradice para los revelados de Apollo de pantallas y agente, que no llaman a `logUsage`. Este PRD no edita el de plays.
- **Ojo con el nombre:** en ese PRD «verificación manual» es la **revisión humana del borrador**, no una comprobación del email. Aquí se usa «verificación de email» para la comprobación con proveedor y «verificación manual» solo para la revisión humana, para no mezclarlas.

**Por qué ahora:** el PRD de plays a medida (cola del sprint siguiente, NK-0171) añade recetas cuyo paso de contacto depende de un email fiable; definir el estado antes de construir esos SDD evita que cada receta invente el suyo. Y el primer paso de esta iniciativa aprovecha un dato que NOKKO ya paga y descarta. Sin datos de uso: todas las líneas base son «sin dato».

## 4. Objetivos
| ID | Objetivo | Cómo se mide | Línea base | Fuente |
|---|---|---|---|---|
| G-1 | Que cada contacto con email tenga un estado de verificación visible | Contactos (emails distintos en `stakeholders`, `leads` y `people`) con estado vigente distinto de «sin verificar», sobre contactos con email | Sin dato (no existe) | Base de datos, tras el lanzamiento (tabla nueva del SDD 1) |
| G-2 | Que ninguna superficie que genera borradores (las cuatro de 3.3) produzca un borrador automático o de agente/MCP para un contacto «inválido» o «catch-all»; y que «sin verificar» y «no verificable» lleven siempre una marca visible | Borradores generados sobre contactos en esos estados, por superficie | Sin dato; se verifica por prueba: debe ser 0 | Prueba automática de la regla pura |
| G-3 | Que ninguna verificación ni revelado de Apollo gaste sin quedar registrado en `integration_usage`; y que lo **automático** pase por el presupuesto. Lo manual con coste: según Q-6 (recomendado: se registra siempre, nunca se bloquea) | Verificaciones y revelados sin fila en `integration_usage`; acciones automáticas que no consultan `planNeed` | Sin dato; se verifica por prueba: debe ser 0 | Prueba automática del adaptador y de los caminos de revelado |
| G-4 | Que un estado nunca sobreviva a un cambio del email ni a su caducidad | Casos de prueba: email editado, ventana vencida, valor de proveedor desconocido | Sin dato; se verifica por prueba: debe ser 0 casos que salgan «verificado» | Prueba automática de la función pura de estado efectivo |
| G-5 | Poder decidir con datos si hace falta un verificador independiente | Reparto de estados de los contactos revelados con Apollo tras el primer paso | Sin dato (no existe) | Base de datos, tras el lanzamiento |

Nunca hay línea base estimada. G-2, G-3 y G-4 son invariantes: se prueban, no se miden con datos de uso. **No se mide la tasa de rebote:** NOKKO no envía y no recibe rebotes; cualquier cifra de rebote exigiría otra herramienta o un registro nuevo (ver 7.1). Lo que sí exigiría **registro nuevo** es contar cuántos borradores se bloquean por estado: se propone un registro de «borrador bloqueado» con el motivo, sin el email, en el SDD 3.

## 5. No-objetivos
- **Enviar:** ni un motor de envío ni envío automático. NOKKO prepara y otras herramientas envían.
- **Calentar buzones** ni gestionar reputación de dominio de envío.
- **Base de datos de contactos propia** ni revender datos (coherente con `PRD-20261112-plays-a-medida.md:84`).
- **Encontrar emails por patrón o adivinarlos** (el «Email Finder» de Glider): fuera. Este PRD verifica un email que ya existe.
- **Búsqueda inversa de email** («Reverse Email Lookup»): fuera.
- **Detectar rebotes o respuestas:** fuera (es el ticket NK-0174, bandeja de respuestas, aparte).
- **Cambiar el email de un contacto:** el verificador nunca escribe `stakeholders.email`, `leads.email` ni `people.email`.
- **Verificar teléfonos.**
- **Verificación masiva automática de toda la base:** solo bajo demanda o dentro del paso de contacto de un play activo (6.2).
- **Marca de procedencia por campo en `stakeholders`, `leads` y `people`:** no se extiende `field_sources` a esas tablas aquí.
- **Aplicar a Postin:** NOKKO y Postin son productos separados.

## 6. Decisiones tomadas y abiertas
Aún no hay decisiones de Fede sobre este PRD: todo lo de abajo es **propuesta** que confirma al aprobar. La única decisión previa que aplica es la 13 del PRD de plays (UE).

### 6.1 Estados de verificación (propuesta: conjunto cerrado)
| Estado (texto en la interfaz) | Significado | ¿Permite sugerir un borrador? |
|---|---|---|
| **Verificado** | Un proveedor confirmó que el buzón acepta correo, en la fecha `checked_at` | Sí, mientras esté vigente |
| **Catch-all** (aceptado pero no garantizado) | El dominio acepta cualquier dirección: no se puede confirmar que el buzón exista | No: se bloquea con el motivo |
| **No verificable** | El proveedor no pudo decidir (tiempo agotado, servidor que bloquea comprobaciones, respuesta que no se sabe mapear) | No automática; ver 6.2 y pregunta 3 |
| **Inválido** | El proveedor dice que la dirección no existe o no recibe correo (formato, dominio sin correo, buzón inexistente) | No: se bloquea con el motivo |
| **Sin verificar** | Nunca se ha comprobado **este valor de email**, o la comprobación caducó | No automática |

Reglas de diseño que fija este PRD:
- **El estado pertenece a una dirección, no a una fila.** Se guarda por empresa y por email normalizado (minúsculas, como ya hace `leads.ts:718-720` y el índice único actual de `people`, `people_org_email_uniq`, `0002_multitenant_organizations.sql:144-146`; se normaliza también al leer, 3.3), en una **tabla nueva** con RLS por empresa (el SDD 1 define el esquema). Así una dirección presente en un stakeholder, un lead y una persona tiene un solo estado, y no se añaden columnas a tres tablas.
- **Estado efectivo:** función pura `(fila, ahora, ventana) → estado`. Con una fila por (empresa, email), un email nuevo es otra clave: no existe fila y el estado es «sin verificar»; no hay «email que no coincide». Si `checked_at` es anterior a la ventana, el estado efectivo es «sin verificar». **Decisión de este PRD:** `checked_at` se guarda **en la propia fila** (no hay forma de enlazar un contacto con su email anterior, así que no se muestra ninguna «última comprobación» de un email distinto). Al caducar se enseña «sin verificar» y, como dato secundario, la fecha y el estado de esa misma dirección.
- **Cerrado por defecto:** un valor de proveedor que el mapeo no reconoce **nunca** produce «verificado»; produce «no verificable» y guarda el valor literal (corto) para poder auditarlo.
- **Quién escribe:** solo código de servidor tras comprobar la empresa (igual que `companyLinkedin`, `src/lib/AGENTS.md:56`). Ningún miembro puede marcar «verificado» desde el navegador. La fila guarda el proveedor, el origen (`revelado_apollo` o `verificador`), la fecha y quién lo pidió; **no** guarda texto de mensajes. Los trabajos en segundo plano y el agente por Telegram corren con el cliente privilegiado, por lo que **insertan `org_id` explícito**; el valor por defecto `current_org()` es solo un respaldo (regla del `AGENTS.md` raíz).
- **Mapeo de los valores de Apollo a estos cinco estados: [Por verificar].** No se afirma que Apollo distinga catch-all; si no lo hace, «catch-all» solo lo producirá un verificador independiente. Conseguir una respuesta real o la documentación de Apollo es la **primera tarea del SDD 1**, con un mapeo tolerante (valor desconocido o ausente = «no verificable», nunca «verificado») que no bloquea el resto.

### 6.2 Cuándo se verifica, qué cuesta y quién lo aprueba (propuesta)
| Momento | Qué pasa | Gasto |
|---|---|---|
| **Al revelar con Apollo** | Se guarda el estado que ya viene en la respuesta (`emailStatus`), mapeado a los cinco estados. Hoy solo se revelan **stakeholders**: `revealStakeholder` recibe `stakeholderId` (`apollo-gateway.ts:237-260`) y no hay revelado de `leads` ni de `people`, así que en el primer paso **ningún lead puede llegar a «verificado»** | Ninguno extra según el código: la llamada `bulk_match` ya se hace (`apollo-gateway.ts:99`). **[Por verificar]** que el plan de Apollo lo incluya sin crédito aparte |
| **Bajo demanda** (botón en la ficha, herramienta del agente) | Pide la comprobación al verificador independiente (si existe, SDD 2b) o repite el revelado de Apollo si procede | Sí. Herramienta de escritura: muestra el coste estimado antes y espera la confirmación; igual que los revelados (`agent/tools/apollo.ts:126-182`). Si pasa por `planNeed` tal como está, se bloquearía al 100 % del límite (3.4): ver Q-6 |
| **Antes de un borrador** | Si el estado no es vigente, **no verifica en silencio**: devuelve «falta verificar», con el coste, y propone la acción | Ninguno hasta que la persona acepte |
| **Dentro del paso de contacto de un play activo** | Puede verificar sin pedir confirmación por contacto, porque la persona aprobó el play. Disparador «automático»: el orquestador lo pausa al 100 % del límite mensual | Sí, registrado como `automatic` |
| **En la ingesta de leads o el CSV** | **No** verifica. Solo la comprobación de formato que ya existe | Ninguno |

- **Cada verificación es una necesidad del orquestador**, no una llamada directa: se añade `verify_email` a `Need` y a `NEED_KEYS` (persona; el tipo es exhaustivo, el compilador obliga, `planner.ts:17-47`), un servicio a `Service` y a `ENV` (`planner.ts:6-16`, `runner.ts:31-39`) y su entrada en `CAPABILITIES`. Pasa por `planNeed` y `logUsage` (`runner.ts:68-96`).
- **Sin gasto oculto:** además, el SDD 2 hace que los revelados de Apollo desde pantalla y agente también registren su gasto (hallazgo 3.4). Es un arreglo previo, no una mejora opcional. **Requisito del SDD 2 (propuesta, pendiente de Q-6):** las acciones manuales ignoran `remaining` en `planFor` pero **siguen registrando** el gasto, y se corrigen el comentario de `planner.ts:184` y `src/lib/AGENTS.md:41`. Si Fede prefiere pausar lo manual al límite, entonces se corrige solo la documentación y la interfaz explica el bloqueo. En ambos casos `revealKeyPeople` (que hoy no consulta el presupuesto) se alinea con la decisión.
- **Costes:** los de `CAPABILITIES` y `revealCost` son estimaciones de código, no medidas. El coste real de un verificador es **sin dato** hasta elegirlo.

### 6.3 Preguntas abiertas para Fede (con recomendación)
**Decisión del coordinador (propuesta; Fede confirma al aprobar):** regla graduada de 6.5 (bloqueo solo para «inválido» y «catch-all»; «sin verificar» y «no verificable» pasan con marca visible; «solo verificado» como parámetro opcional de play o receta).

| # | Pregunta | Recomendación |
|---|---|---|
| Q-1 | ¿Empezamos solo con el estado que Apollo ya devuelve (SDD 1 a 3) y decidimos el verificador independiente después, con el reparto real de estados? | **Sí.** No cuesta proveedor nuevo y da el dato (G-5) para decidir. El riesgo es que Apollo no distinga catch-all; se acepta y se dice en la pantalla |
| Q-2 | ¿Qué proveedor para el verificador independiente (SDD 2b) cuando toque? | **No elegir ahora.** Entre lo cableado solo Apollo devuelve estado. FullEnrich tiene condiciones en 4a pero no existe en el código, y **4a CA-32 exige la credencial propia de cada organización, mientras que el criterio 4 de 6.4 propone credencial de la plataforma**: son dos fuentes que se contradicen y la pregunta es tuya (recomendación: decidirlo con el proveedor elegido, no antes); Hunter no está en ningún documento. Criterios en 6.4 |
| Q-3 | Con la regla graduada de 6.5, ¿confirmas que «sin verificar» y «no verificable» pasan con marca visible (también en el detector automático) y que «inválido» y «catch-all» se bloquean sin forma de saltarlo? | **Sí.** En el primer paso ningún lead puede llegar a «verificado» (6.2), así que exigir verificado apagaría todos los seguimientos automáticos de leads |
| Q-4 | ¿Qué ventana de re-verificación? | **[Por decidir]: tú la fijas.** No hay dato para recomendar un número. Propongo que sea una constante en código (parámetro del SDD 1), no un ajuste por empresa |
| Q-5 | ¿Qué se guarda y cuándo se borra la fila de verificación (dato personal: email normalizado)? | **Recomendación:** guardar solo email normalizado, estado, valor literal corto, proveedor, origen, `checked_at` y quién lo pidió; borrar la fila cuando ningún contacto de la empresa use ese email (al borrar el contacto, de forma diferida y comprobable) y siempre al borrar la empresa. Sin plazo numérico propuesto: [Por decidir] |
| Q-6 | Lo manual con coste ¿se pausa al llegar al límite (comportamiento actual) o no (lo que dice `AGENTS.md:41`)? | **Que no se pause** y siempre se registre el gasto: la persona decide y confirma el coste antes. Es requisito del SDD 2. Si prefieres pausar, se corrige la documentación y se explica el bloqueo en pantalla |
| Q-7 | ¿Pedimos a NK-0171 un parámetro de puerta opcional por play o receta («solo contacto verificado»)? | **Sí, como parámetro opcional** que decide el SDD 4 de NK-0171; por defecto, la regla graduada de 6.5. **No es un requisito existente de ese PRD**: añadirlo es una petición tuya al dueño de NK-0171 |

### 6.4 Criterios para elegir proveedor del verificador (SDD 2b)
Se evalúa con el mismo método para cualquier candidato, sin asumir ninguno:
1. **Estados:** distingue catch-all de verificado y de «no se pudo». Sin esto no sirve para el objetivo.
2. **Coste por comprobación y por resultado dudoso:** si cobra los «no verificable» y los catch-all. Sin dato hasta pedirlo.
3. **Entrada:** nombre, empresa o dominio y email; **nunca URLs de LinkedIn** (regla R-5 del PRD de control tower, citada en 4a CA-33).
4. **Encaje técnico:** pasarela de conectores de Lovable (como Apollo y Clay) o API directa (como Firecrawl); credencial de la plataforma, no por empresa.
5. **Tratamiento de datos personales:** dónde procesa, contrato de encargado, retención. El email sale de NOKKO hacia un tercero: es un tratamiento más.
6. **Límites de tasa y tamaño de lote**, para encajar con el reintento y con el máximo de 10 de `bulkMatch` si se reutiliza el patrón.
**Recomendación entre lo ya integrado: Apollo** (única fuente cableada con estado). **Coste de un proveedor nuevo:** un gateway propio con su servicio, variable de entorno, mapeo de estados y pruebas; es el SDD 2b, **sin estimación de tamaño** porque no hay proveedor elegido.

### 6.5 Regla de no enviar (propuesta, graduada)
**Decisión del coordinador (propuesta; Fede confirma al aprobar).** La regla cubre **todas** las superficies que producen un borrador (inventario en 3.3) y es graduada, para no apagar en silencio los seguimientos automáticos: en el primer paso ningún lead puede llegar a «verificado» (solo se revelan stakeholders, la ingesta nunca verifica y el verificador independiente está aplazado).
| Estado efectivo | Borrador automático (`followup_sequence`, plays de `main`, recetas) | Borrador pedido (agente, MCP, botón) |
|---|---|---|
| **Inválido** | Bloqueado, con el motivo visible | Bloqueado, con el motivo; sin forma de saltarlo en esta versión |
| **Catch-all** | Bloqueado, con el motivo visible | Bloqueado, con el motivo |
| **Sin verificar / no verificable** | **Pasa con marca visible** («email sin verificar») | Pasa con marca visible; el agente ofrece verificar (6.2) |
| **Verificado vigente** | Pasa | Pasa |
- El motivo se dice en una frase y con qué hacer («ese email es catch-all: busca otro contacto o confirma el email por otro canal»).
- **Exigir «solo verificado»** es un parámetro **opcional** de un play o receta, que decide el SDD 4 de NK-0171 (Q-7); no es la regla general.
- La regla es **código puro con tabla de pruebas** y una sola función compartida por todas las superficies, no una instrucción al modelo: el modelo no decide si un borrador sale (coherente con la regla de `src/lib/AGENTS.md:7`: la regla pura vive en código y las escrituras esperan confirmación).
- **Un destinatario sin email** no es un caso de esta regla: sigue como hoy («sin dato»).

### 6.6 UE y datos personales (propuesta, sin conclusión legal)
- Se mantiene la decisión 13 del PRD de plays: contacto de personas de la UE permitido con aviso en la verificación manual (revisión humana), sin interruptor por empresa. Este PRD **no** lo modifica ni decide cómo se detecta que un contacto es de la UE (eso es del SDD de motor de plays; `stakeholders` no tiene país: columnas en `types.ts:4676-4700`).
- **Novedad que hay que decir en claro:** verificar envía la dirección de email de una persona a un tercero. Es un tratamiento adicional al de buscarla. Sin revisión legal por ahora (decisión 14 del PRD de plays, línea 106); queda como riesgo aceptado a confirmar por Fede en 7.2.
- La fila de verificación guarda el email normalizado porque es la clave; vive bajo RLS por empresa, se borra con la empresa. Qué se guarda y cuándo se borra el resto es la pregunta abierta **Q-5** (con recomendación); sin plazo de retención propuesto aquí. Una fila cuyo email ya no tiene ningún contacto sería un dato personal guardado sin finalidad.

## 7. Riesgos y dependencias
- **Depende de NK-0171 (Borrador, no aprobado):** si el PRD de plays cambia el paso de contacto, el SDD 4 de esta iniciativa se reajusta. Esta iniciativa no bloquea a NK-0171: sus recetas ya dicen «sin dato» cuando no hay contacto. El SDD 4 **propone** un cambio a NK-0171 (parámetro de puerta opcional, Q-7), no cumple un requisito suyo. Además, el PRD de plays afirma que el gasto de Apollo ya se registra (líneas 80 y 141), lo que 3.4 contradice; debe corregirlo su dueño.
- **Apollo puede no distinguir catch-all.** Entonces el primer paso solo cubre verificado, inválido y no verificable, y catch-all depende de Q-2. Se enseña tal cual.
- **`revealStakeholder` sustituye el email** (`apollo-gateway.ts:310`) mientras que `revealToAccount` solo rellena vacíos (`:201`). Con el estado ligado al valor del email, un cambio invalida el estado solo; pero la sustitución en sí es un comportamiento a revisar en el SDD 2 (**[Por decidir]**: si debe ser una propuesta y no una escritura).
- **Gasto de Apollo no registrado hoy** (3.4): arreglarlo cambia el consumo visible de `org_budgets` y puede acercar antes el límite. Hay que avisarlo al desplegar.
- **Pausa de lo manual con coste** (3.4): hoy `planFor` ya bloquearía un `find_email` manual al 100 %; si el SDD 2 lleva los revelados y verificaciones manuales por `planNeed` sin el arreglo de Q-6, se pararían todos al llegar al límite, incluido el botón «Verificar».
- **Apagado silencioso de seguimientos:** una regla «solo verificado» general apagaría todos los seguimientos automáticos de leads (6.5); por eso se propone la graduada.
- **Dos veces el mismo email en tablas distintas:** la tabla por email lo resuelve; el coste es una unión más al pintar fichas.
- **Falsa seguridad:** «verificado» significa que el buzón aceptó correo en una fecha, no que la persona lo lea ni que quiera recibir el mensaje. La interfaz no usa palabras como «seguro» o «garantizado».
- **Dependencia de proveedor:** cambios de plan o de esquema de Apollo pueden vaciar `email_status`; el mapeo cerrado por defecto lo degrada a «no verificable».
- **Datos personales a un tercero** (6.6).

### 7.1 Lo que NO se afirma
- No se afirma que Glider verifique emails, ni con qué calidad: es su página de marketing, sin verificar.
- No se afirma qué valores devuelve Apollo en `email_status`, ni que distinga catch-all, ni que el estado venga sin coste extra en todos los planes.
- No se afirma la calidad de los emails de Apollo ni de Clay (igual que `PRD-20261112-plays-a-medida.md:249`).
- No se afirma que FullEnrich ni Hunter ofrezcan verificación con catch-all, ni su precio, ni su encaje con la pasarela de Lovable: no hay código ni documentación suya en el repositorio.
- No se afirma qué proporción de contactos de ninguna empresa tiene hoy un email válido ni qué parte de lo revelado se ha perdido por no guardar el estado: sin dato.
- No se afirma que bajen los rebotes ni que suba la respuesta: NOKKO no envía ni mide rebotes.
- No se afirma que el gasto de Apollo sin registrar sea grande: solo que esas rutas no llaman al registro.
- No se afirma ninguna conclusión legal (RGPD, encargado de tratamiento, consentimiento).

### 7.2 Riesgos que confirma Fede al aprobar
- Enviar emails de personas, incluidas de la UE, a un verificador de terceros, sin revisión legal por ahora (6.6).
- Aceptar que el primer paso quizá no distinga catch-all (Q-1).
- Que el arreglo del registro de gasto de Apollo cambie lo que se ve en presupuesto.
- La regla graduada de 6.5 y la respuesta a Q-6 (lo manual con coste).

## 8. Orden de entrega
Cada SDD se redacta uno a uno con `nokko-shape` cuando apruebes este PRD. Sin asignar sprint: lo decides tú.

| # | SDD (propuesto) | Tipo | Depende de | Cubre |
|---|---|---|---|---|
| 1 | `SDD-…-email-verification-model`: tabla nueva por empresa y email normalizado con RLS; conjunto cerrado de estados; función pura de estado efectivo y ventana como parámetro; mapeo cerrado por defecto de `email_status` de Apollo; regla pura de «¿puede sugerirse un borrador?» graduada (6.5) con tabla de pruebas; `checked_at` en la fila; `org_id` explícito en toda escritura; retención según Q-5; **primera tarea: obtener los valores reales de `email_status` de Apollo (respuesta real o documentación) y fijar un mapeo tolerante** | Feature (esquema y datos: SDD completo) | — | G-2, G-4 |
| 2 | `SDD-…-email-verification-apollo`: guardar `emailStatus` al revelar (`apollo-gateway.ts:164-318`); arreglar el registro de gasto de los revelados por pantalla y agente (G-3); **requisito: las acciones manuales ignoran `remaining` en `planFor` pero siguen registrando el gasto (Q-6), `revealKeyPeople` se alinea (`runner.ts:477-485`), y se corrigen `planner.ts:184` y `AGENTS.md:41`**; necesidad `verify_email` en el orquestador solo si el SDD 2b la exige; decidir qué hace `:310` | Feature | 1 | G-1, G-3, G-5 |
| 3 | `SDD-…-email-verification-surfacing`: estado y fecha junto al email en stakeholders, leads y personas, resultados de revelado, respuestas del agente y de MCP (`estado_email`, títulos en `TITLES`), bloqueo con motivo según 6.5 en `draft_followup` (cargar `email`, `core-read.ts:528-534`), en el detector `followup_sequence` (`followup-sequence.ts:9-20`, `lead-tasks.server.ts:354-360`) y en los plays de `main` (`catalog.ts`), marca visible para «sin verificar» y «no verificable», registro de «borrador bloqueado» sin el email, botón y herramienta «Verificar» con coste previo | Feature | 1, 2 | G-1, G-2 |
| 4 | `SDD-…-email-verification-plays`: paso de contacto de las recetas (NK-0171): **si Fede acepta Q-7**, parámetro de puerta opcional «solo verificado» por receta (por defecto, la regla graduada de 6.5); verificación dentro del play activo con presupuesto automático, aviso de UE sin cambios | Feature | 1, 2, 3; SDD del motor de NK-0171; respuesta a Q-7 | G-2, G-3 |
| 2b | `SDD-…-email-verifier-gateway` (solo si G-5 lo justifica y Fede elige proveedor): gateway nuevo, `Service`, `ENV`, mapeo de estados, pruebas; criterios en 6.4 | Feature | 1, 2 y decisión de Fede | G-1 |

El 2b queda **fuera de la tanda** hasta decidir Q-1 y Q-2. El SDD 4 no puede empezar hasta que el motor de plays de NK-0171 exista.

## 9. Registro del gate
- Pasada 1: FAIL (0 BLOCKER, 3 MAJOR, 10 MINOR), informe `.factory/evidence/NK-0173/prd-gate-pass1.md` sobre `16b75e8`. Corregido en <sha>; pasada 2 pendiente.

## 10. Aprobación
- [ ] Fede aprueba el PRD (primer GO de dirección), incluidas las propuestas de la sección 6 y los riesgos de 7.2. Fecha: {…}
- Al aprobar, el Estado pasa a «Aprobado». Después se redactan los SDD con `nokko-shape`.
