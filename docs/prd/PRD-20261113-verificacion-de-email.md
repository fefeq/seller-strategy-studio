# PRD-20261113-verificacion-de-email · [Iniciativa] Verificación de email antes de contactar

**Tipo:** Iniciativa (cuatro SDD con orden y dependencias; el ticket está registrado como feature) · **Prioridad propuesta:** Media (la parte que no gasta nada nuevo, guardar el estado que Apollo ya devuelve, es pequeña y barata; el verificador independiente solo se justifica si esa primera parte demuestra que hace falta; sin datos de uso, es una apuesta declarada)
**Estado:** Borrador · **Pide:** Fede (análisis de las funciones públicas de Glider, 2026-11-12) · **Aprueba:** Fede · **Fecha:** 2026-11-13
**Ticket:** NK-0173 (LOGGED, `.factory/ledger.json:5052`; `sdd` y `prd` aún vacíos)
**SDD que lo desarrollan:** pendientes (sección 8): cuatro
**Depende de (no está en `main`):** `docs/prd/PRD-20261112-plays-a-medida.md` (NK-0171, Borrador, rama `docs/sprint8-prd-plays-a-medida` @ d58a1f8). Sus recetas necesitan un contacto con email verificado antes de proponer ningún mensaje; este PRD define qué significa «verificado».

> Un PRD dice qué se quiere y por qué. No dice cómo se construye ni cómo se prueba: eso es del SDD.

## Resumen para aprobar (Fede)
- **Hoy NOKKO no verifica ningún email.** Apollo devuelve un estado del email en cada revelado y el código lo lee y lo tira (`apollo.ts:223,233,247`; no se guarda en ninguna tabla). No hay estado de verificación en `stakeholders`, `leads` ni `people`.
- **Propuesta en dos pasos.** Primero guardar y enseñar lo que Apollo ya devuelve en un revelado que ya pagas (sin proveedor nuevo y, según lo que se lee en el código, sin gasto extra). Después, solo si ese primer paso muestra huecos (por ejemplo, muchos contactos sin estado), decidir un verificador independiente con datos, que es un SDD aparte porque exige un gateway nuevo.
- **Cinco estados cerrados:** verificado, catch-all, no verificable, inválido, sin verificar (sección 6.1).
- **Regla de no enviar:** NOKKO prepara y otras herramientas envían. Un contacto «inválido» o «catch-all» no recibe sugerencia de borrador, con el motivo a la vista. Un estado caducado o ausente tampoco la recibe automática.
- **Ningún gasto oculto.** Cada verificación pasa por una necesidad del orquestador y escribe en `integration_usage`. Hallazgo previo: hoy los revelados de Apollo desde las pantallas y desde el agente **no** registran su gasto (sección 3.3); el SDD 2 lo cierra.
- **Qué decides tú:** cuatro preguntas abiertas con recomendación (sección 6.3). La ventana de re-verificación queda **[Por decidir]**.
- **Lo que no sabemos:** qué valores concretos devuelve Apollo y si distingue catch-all; el precio y la cobertura de cualquier verificador; el análisis de Glider es una página de marketing de un competidor, sin verificar (sección 7.1).

## 1. Problema
Un vendedor que usa NOKKO puede acabar con un borrador de mensaje dirigido a un email que nadie ha comprobado: el email viene de un revelado, de un CSV, de la ingesta de leads o de una edición a mano, y la ficha no dice si esa dirección existe, si el dominio acepta cualquier cosa (catch-all) o si la comprobación no fue posible. Escribir a una dirección inválida o dudosa daña la reputación del buzón desde el que se envía, y NOKKO no lo envía pero sí sugiere el mensaje. Las recetas de plays a medida (NK-0171) dan por hecho un contacto fiable y no tienen de dónde sacar esa garantía.

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
| ¿La búsqueda de personas da estado? | No: solo `has_email` (bool) en el resultado, oculto el contacto hasta revelar | `apollo.ts:187,209`; la búsqueda es gratis (`apollo.ts:32`) |
| ¿Cómo se revela y qué cuesta? | `people/bulk_match` por la pasarela de conectores de Lovable, hasta 10 personas por llamada, `reveal_personal_emails=false`; el móvil es opcional y asíncrono | `apollo-gateway.ts:36,89-101`, `apollo.ts:36` |
| ¿Cuánto cuesta un revelado? | El código lo estima en 0,02 EUR por persona (0,17 con móvil), **estimado**, no medido | `orchestrator/search.ts:24-27`; el planificador declara sus costes como «rough cost» (`planner.ts:2`) |
| ¿El revelado sobrescribe emails? | Al añadir al mapa, solo rellena un email vacío de una persona existente (`apollo-gateway.ts:201`); al revelar un stakeholder ya existente, **sustituye** su email si es distinto (`:310`) | ver riesgo en 7 |
| Teléfono | Asíncrono: se guarda una fila `phone_reveals` pendiente y Apollo entrega al webhook, que rellena `phone_reveals` y `stakeholders.phone`; si ya hay un teléfono entregado se reutiliza sin pagar | `apollo-gateway.ts:104-121,268-295`, `src/routes/api/public/apollo/phone-webhook.ts:11-52`, `drizzle/migrations/0030_apollo_phone_reveals.sql` |
| ¿Clay trae emails? | No. `ClayPerson` y `StakeholderDraft` no tienen campo de email; Clay busca empresas y personas y completa cuentas | `src/lib/clay.ts:75-88,110-115`, `src/lib/clay-gateway.ts:140-178` |
| ¿Hay una necesidad de «verificar»? | No. Existe `find_email` con opciones Apollo y Clay en `CAPABILITIES`, pero solo se usa como etiqueta del registro de gasto del revelado de Apollo; ningún código ejecuta Clay para `find_email` | `planner.ts:83-89`, `runner.ts:483` |

### 3.2 Qué proveedores puede llamar NOKKO hoy
- **Cableados:** Apollo, Clay, Parallel, Firecrawl, Perplexity, Apify y Drive. `Service` (`planner.ts:6-16`) añade `posthog`, `stripe` y `ai`; el estado «conectado» sale de variables de entorno de la plataforma (`runner.ts:31-43`, `connectedServices()` no recibe empresa). Apollo y Clay van por `connector-gateway.lovable.dev` (`apollo-gateway.ts:36`, `clay-gateway.ts:20`).
- **FullEnrich: no está cableado.** No existe en `src/` ni en `drizzle/` (grep sin resultados). Solo figura en el SDD aprobado `SDD-20261030-gtm-control-tower-4a-data-sources.md` (enmienda del 2026-10-31: CA-32 y CA-33) como proveedor futuro de enriquecimiento y revelado, con la condición de no enviarle URLs de LinkedIn y de pedir aprobación explícita antes de revelar contactos. Ese SDD cita un registro `src/lib/connections.ts` que **no existe** en `main`.
- **Hunter: no está cableado ni citado en ningún documento del repositorio salvo el ticket NK-0173.**
- Por tanto, **entre lo que NOKKO puede llamar hoy, solo Apollo devuelve un estado de email**, y solo dentro de un revelado.

### 3.3 Dónde se guardan los contactos y cómo se enseñan
- **Tres tablas con email, sin estado de verificación y sin procedencia por campo:**
  - `stakeholders` (personas de una cuenta; `email`, `phone`, `linkedin_url`, `org_id`): `drizzle/migrations/0000_migration.sql:96-106`, tipos en `src/integrations/supabase/types.ts:4676`.
  - `leads` (`email`, `contact_name`, `person_id`): `drizzle/migrations/0012_lead_funnel.sql:2-30`.
  - `people` (`email`, índice único por `lower(email)`): `0000_migration.sql:144-157`.
- **Entrada de emails:** edición a mano (`src/components/account/stakeholders-tab.tsx:171-175`, `src/components/leads/lead-dialogs.tsx:61`), CSV e ingesta de leads, donde solo se comprueba el formato con una expresión regular y se pasa a minúsculas (`src/lib/leads.ts:718-720`), y los revelados de Apollo.
- **Procedencia:** `field_sources` existe solo en `accounts`, `icp_profiles`, `positioning`, `messaging_pillars` y `segments` (`drizzle/migrations/0046:1`, `0058:14`, `0061:14-16`; `src/lib/provenance.ts:1-4`). **No existe en `stakeholders`, `leads` ni `people`.** La regla «un escritor automático solo rellena campos vacíos» (`autoWriteDecision`, `src/lib/AGENTS.md:55`) está documentada para cuentas.
- **Presentación:** la ficha del stakeholder muestra un campo de texto de email; `quick-actions.tsx:272,348` abre `mailto:`. No hay badge ni estado.
- **Herramientas del agente y de MCP:** `apollo_find_people` (lectura, devuelve `tiene_email`), `apollo_reveal_contacts` y `apollo_reveal_stakeholder` (escritura: esperan la confirmación de la persona, gastan créditos), `clay_find_people` (lectura) en `src/lib/agent/tools/apollo.ts:28-182` y `clay.ts`. El servidor MCP genera sus herramientas desde el mismo registro (`src/lib/AGENTS.md:17`; títulos en `TITLES`, `src/lib/mcp/tools/agent-tools.ts:14`).
- **Borradores:** el agente tiene `draft_followup` (lectura; devuelve solo el borrador). Carga el lead **sin** el campo `email` (`core-read.ts:530`), así que hoy no puede aplicar ninguna regla sobre la dirección. NOKKO no envía: `mailto:` abre el cliente de correo de la persona.

### 3.4 Presupuesto y registro de gasto
- Tabla `integration_usage` (`service`, `need`, `trigger` manual o automático, `cost`) y `org_budgets` (`drizzle/migrations/0041_orchestrator_budget_usage.sql:1-34`), con RLS por empresa.
- El orquestador elige servicios por necesidad (`planner.ts:51-129`), consulta el presupuesto (`runner.ts:48-66,83-96`): aviso al 80 %, pausa **solo el trabajo automático** al 100 %; lo manual no se pausa (`planner.ts:149-155,184-189`). Registra el gasto con `logUsage` (`runner.ts:68-81`).
- **Hallazgo:** solo `revealKeyPeople` registra el gasto de un revelado (`runner.ts:477-485`, llamado desde `orchestrator.functions.ts:44-52`). Los otros caminos llaman directamente a `revealToAccount` o `revealStakeholder` **sin** `logUsage`: las pantallas (`apollo.functions.ts:27-35`) y las herramientas del agente (`agent/tools/apollo.ts:141,168`). Tampoco hay registro de gasto en la capa del agente ni de MCP (grep de `logUsage` e `integration_usage`). Es decir, hoy parte del gasto de Apollo no entra en `org_budgets`. **[Por verificar]** con datos reales de `integration_usage`; lo que sí se comprueba es que esas rutas no llaman al registro.
- Regla de la casa: las acciones nuevas con proveedor pasan por el orquestador, nunca directas a un gateway (`src/lib/AGENTS.md:41`).

### 3.5 Privacidad
- RLS por empresa en las tablas de contactos y de gasto; las claves de proveedor son de la plataforma, no por empresa (decisión C-1 del PRD de plays).
- Un log del servidor no puede llevar cuerpos ni cortes de texto de proveedor ni el error entero: `src/lib/server-log-scan.test.ts` lo vigila en todo `src/lib/**` y `src/routes/api/**`; `safeErrorLog` solo guarda nombre, longitud y estado (`src/lib/agent/safe-error-log.ts`). Un email es dato personal: nunca va a un log, a un ejemplo ni a un fixture.

### 3.6 Lo que dice el PRD de plays a medida (Borrador, `d58a1f8`)
- «Contacto: quién y por qué canal, resuelto con Clay o Apollo si el play lo pide; si no hay contacto, se dice sin dato» (línea 156).
- «Contacto verificado propio: NOKKO sigue usando Clay y Apollo para encontrar contacto; no se construye un proveedor de contactos» (línea 85, no-objetivo). Este PRD lo respeta: no construye un proveedor de contactos.
- Decisión 13 de Fede (2026-11-12), contacto de personas de la UE: «Permitirlo con aviso en la verificación manual», sin interruptor por empresa (línea 106; «Aviso de UE», línea 163).
- «No se afirma la calidad de los datos de contacto de Clay o Apollo» (línea 250).
- **Ojo con el nombre:** en ese PRD «verificación manual» es la **revisión humana del borrador**, no una comprobación del email. Aquí se usa «verificación de email» para la comprobación con proveedor y «verificación manual» solo para la revisión humana, para no mezclarlas.

**Por qué ahora:** el PRD de plays a medida (cola del sprint siguiente, NK-0171) añade recetas cuyo paso de contacto depende de un email fiable; definir el estado antes de construir esos SDD evita que cada receta invente el suyo. Y el primer paso de esta iniciativa aprovecha un dato que NOKKO ya paga y descarta. Sin datos de uso: todas las líneas base son «sin dato».

## 4. Objetivos
| ID | Objetivo | Cómo se mide | Línea base | Fuente |
|---|---|---|---|---|
| G-1 | Que cada contacto con email tenga un estado de verificación visible | Contactos (emails distintos en `stakeholders`, `leads` y `people`) con estado vigente distinto de «sin verificar», sobre contactos con email | Sin dato (no existe) | Base de datos, tras el lanzamiento (tabla nueva del SDD 1) |
| G-2 | Que ningún borrador se sugiera a un contacto «inválido» o «catch-all», ni a uno sin estado vigente salvo petición expresa de la persona | Sugerencias de borrador sobre contactos en esos estados | Sin dato; se verifica por prueba: debe ser 0 | Prueba automática de la regla pura |
| G-3 | Que ninguna verificación gaste sin quedar registrada ni sin pasar por el presupuesto | Verificaciones sin fila en `integration_usage`; revelados de Apollo sin fila | Sin dato; se verifica por prueba: debe ser 0 | Prueba automática del adaptador y de los caminos de revelado |
| G-4 | Que un estado nunca sobreviva a un cambio del email ni a su caducidad | Casos de prueba: email editado, ventana vencida, valor de proveedor desconocido | Sin dato; se verifica por prueba: debe ser 0 casos que salgan «verificado» | Prueba automática de la función pura de estado efectivo |
| G-5 | Poder decidir con datos si hace falta un verificador independiente | Reparto de estados de los contactos revelados con Apollo tras el primer paso | Sin dato (no existe) | Base de datos, tras el lanzamiento |

Nunca hay línea base estimada. G-2, G-3 y G-4 son invariantes: se prueban, no se miden con datos de uso. **No se mide la tasa de rebote:** NOKKO no envía y no recibe rebotes; cualquier cifra de rebote exigiría otra herramienta o un registro nuevo (ver 7.1). Lo que sí exigiría **registro nuevo** es contar cuántos borradores se bloquean por estado: se propone un registro de «borrador bloqueado» con el motivo, sin el email, en el SDD 3.

## 5. No-objetivos
- **Enviar:** ni un motor de envío ni envío automático. NOKKO prepara y otras herramientas envían.
- **Calentar buzones** ni gestionar reputación de dominio de envío.
- **Base de datos de contactos propia** ni revender datos (coherente con `PRD-20261112-plays-a-medida.md:85`).
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
- **El estado pertenece a una dirección, no a una fila.** Se guarda por empresa y por email normalizado (minúsculas, como ya hace `leads.ts:718-720` y el índice único de `people`, `0000_migration.sql:156`), en una **tabla nueva** con RLS por empresa (el SDD 1 define el esquema). Así una dirección presente en un stakeholder, un lead y una persona tiene un solo estado, y no se añaden columnas a tres tablas.
- **Estado efectivo:** función pura `(fila, ahora, ventana) → estado`. Si el email actual no coincide con el verificado, o `checked_at` es anterior a la ventana, el estado efectivo es «sin verificar» y se muestra la última comprobación como dato secundario.
- **Cerrado por defecto:** un valor de proveedor que el mapeo no reconoce **nunca** produce «verificado»; produce «no verificable» y guarda el valor literal (corto) para poder auditarlo.
- **Quién escribe:** solo código de servidor tras comprobar la empresa (igual que `companyLinkedin`, `src/lib/AGENTS.md:56`). Ningún miembro puede marcar «verificado» desde el navegador. La fila guarda el proveedor, el origen (`revelado_apollo` o `verificador`), la fecha y quién lo pidió; **no** guarda texto de mensajes.
- **Mapeo de los valores de Apollo a estos cinco estados: [Por verificar].** No se afirma que Apollo distinga catch-all; si no lo hace, «catch-all» solo lo producirá un verificador independiente.

### 6.2 Cuándo se verifica, qué cuesta y quién lo aprueba (propuesta)
| Momento | Qué pasa | Gasto |
|---|---|---|
| **Al revelar con Apollo** | Se guarda el estado que ya viene en la respuesta (`emailStatus`), mapeado a los cinco estados | Ninguno extra según el código: la llamada `bulk_match` ya se hace (`apollo-gateway.ts:99`). **[Por verificar]** que el plan de Apollo lo incluya sin crédito aparte |
| **Bajo demanda** (botón en la ficha, herramienta del agente) | Pide la comprobación al verificador independiente (si existe, SDD 2b) o repite el revelado de Apollo si procede | Sí. Herramienta de escritura: muestra el coste estimado antes y espera la confirmación; igual que los revelados (`agent/tools/apollo.ts:126-182`) |
| **Antes de un borrador** | Si el estado no es vigente, **no verifica en silencio**: devuelve «falta verificar», con el coste, y propone la acción | Ninguno hasta que la persona acepte |
| **Dentro del paso de contacto de un play activo** | Puede verificar sin pedir confirmación por contacto, porque la persona aprobó el play. Disparador «automático»: el orquestador lo pausa al 100 % del límite mensual | Sí, registrado como `automatic` |
| **En la ingesta de leads o el CSV** | **No** verifica. Solo la comprobación de formato que ya existe | Ninguno |

- **Cada verificación es una necesidad del orquestador**, no una llamada directa: se añade `verify_email` a `Need` y a `NEED_KEYS` (persona; el tipo es exhaustivo, el compilador obliga, `planner.ts:17-47`), un servicio a `Service` y a `ENV` (`planner.ts:6-16`, `runner.ts:31-39`) y su entrada en `CAPABILITIES`. Pasa por `planNeed` y `logUsage` (`runner.ts:68-96`).
- **Sin gasto oculto:** además, el SDD 2 hace que los revelados de Apollo desde pantalla y agente también registren su gasto (hallazgo 3.4). Es un arreglo previo, no una mejora opcional.
- **Costes:** los de `CAPABILITIES` y `revealCost` son estimaciones de código, no medidas. El coste real de un verificador es **sin dato** hasta elegirlo.

### 6.3 Preguntas abiertas para Fede (con recomendación)
| # | Pregunta | Recomendación |
|---|---|---|
| Q-1 | ¿Empezamos solo con el estado que Apollo ya devuelve (SDD 1 a 3) y decidimos el verificador independiente después, con el reparto real de estados? | **Sí.** No cuesta proveedor nuevo y da el dato (G-5) para decidir. El riesgo es que Apollo no distinga catch-all; se acepta y se dice en la pantalla |
| Q-2 | ¿Qué proveedor para el verificador independiente (SDD 2b) cuando toque? | **No elegir ahora.** Entre lo cableado solo Apollo devuelve estado. FullEnrich ya tiene condiciones aprobadas en 4a pero no existe en el código; Hunter no está en ningún documento. Criterios en 6.4 |
| Q-3 | ¿Puede la persona pedir a mano un borrador para un contacto «sin verificar» o «no verificable»? | **Sí, con aviso visible**; para «inválido» y «catch-all» **no hay forma de saltar el bloqueo** en esta versión (puede escribir fuera de NOKKO) |
| Q-4 | ¿Qué ventana de re-verificación? | **[Por decidir]: tú la fijas.** No hay dato para recomendar un número. Propongo que sea una constante en código (parámetro del SDD 1), no un ajuste por empresa |

### 6.4 Criterios para elegir proveedor del verificador (SDD 2b)
Se evalúa con el mismo método para cualquier candidato, sin asumir ninguno:
1. **Estados:** distingue catch-all de verificado y de «no se pudo». Sin esto no sirve para el objetivo.
2. **Coste por comprobación y por resultado dudoso:** si cobra los «no verificable» y los catch-all. Sin dato hasta pedirlo.
3. **Entrada:** nombre, empresa o dominio y email; **nunca URLs de LinkedIn** (regla R-5 del PRD de control tower, citada en 4a CA-33).
4. **Encaje técnico:** pasarela de conectores de Lovable (como Apollo y Clay) o API directa (como Firecrawl); credencial de la plataforma, no por empresa.
5. **Tratamiento de datos personales:** dónde procesa, contrato de encargado, retención. El email sale de NOKKO hacia un tercero: es un tratamiento más.
6. **Límites de tasa y tamaño de lote**, para encajar con el reintento y con el máximo de 10 de `bulkMatch` si se reutiliza el patrón.
**Recomendación entre lo ya integrado: Apollo** (única fuente cableada con estado). **Coste de un proveedor nuevo:** un gateway propio con su servicio, variable de entorno, mapeo de estados y pruebas; es el SDD 2b, **sin estimación de tamaño** porque no hay proveedor elegido.

### 6.5 Regla de no enviar (propuesta)
- Un contacto con estado efectivo **inválido** o **catch-all** no recibe sugerencia de borrador en el agente, en MCP ni en los plays; la respuesta dice el motivo en una frase y qué hacer («ese email es catch-all: busca otro contacto o confirma el email por otro canal»).
- Un contacto **sin verificar** o **no verificable** no recibe sugerencia automática; el agente propone verificarlo (6.2).
- La regla es **código puro con tabla de pruebas**, no una instrucción al modelo: el modelo no decide si un borrador sale (coherente con las reglas «Nunca» de `src/lib/AGENTS.md`).
- **Un destinatario sin email** no es un caso de esta regla: sigue como hoy («sin dato»).

### 6.6 UE y datos personales (propuesta, sin conclusión legal)
- Se mantiene la decisión 13 del PRD de plays: contacto de personas de la UE permitido con aviso en la verificación manual (revisión humana), sin interruptor por empresa. Este PRD **no** lo modifica ni decide cómo se detecta que un contacto es de la UE (eso es del SDD de motor de plays; `stakeholders` no tiene país: columnas en `types.ts:4676-4700`).
- **Novedad que hay que decir en claro:** verificar envía la dirección de email de una persona a un tercero. Es un tratamiento adicional al de buscarla. Sin revisión legal por ahora (decisión 14 del PRD de plays); queda como riesgo aceptado a confirmar por Fede en 7.2.
- La fila de verificación guarda el email normalizado porque es la clave; vive bajo RLS por empresa, se borra con la empresa y, en el borrado de un contacto a petición, el SDD 1 define cómo se borra también su fila (**[Por decidir]**, sin plazo de retención propuesto aquí).

## 7. Riesgos y dependencias
- **Depende de NK-0171 (Borrador, no aprobado):** si el PRD de plays cambia el paso de contacto, el SDD 4 de esta iniciativa se reajusta. Esta iniciativa no bloquea a NK-0171: sus recetas ya dicen «sin dato» cuando no hay contacto.
- **Apollo puede no distinguir catch-all.** Entonces el primer paso solo cubre verificado, inválido y no verificable, y catch-all depende de Q-2. Se enseña tal cual.
- **`revealStakeholder` sustituye el email** (`apollo-gateway.ts:310`) mientras que `revealToAccount` solo rellena vacíos (`:201`). Con el estado ligado al valor del email, un cambio invalida el estado solo; pero la sustitución en sí es un comportamiento a revisar en el SDD 2 (**[Por decidir]**: si debe ser una propuesta y no una escritura).
- **Gasto de Apollo no registrado hoy** (3.4): arreglarlo cambia el consumo visible de `org_budgets` y puede activar pausas antes de lo que ven hoy los equipos. Hay que avisarlo al desplegar.
- **Dos veces el mismo email en tablas distintas:** la tabla por email lo resuelve; el coste es una unión más al pintar fichas.
- **Falsa seguridad:** «verificado» significa que el buzón aceptó correo en una fecha, no que la persona lo lea ni que quiera recibir el mensaje. La interfaz no usa palabras como «seguro» o «garantizado».
- **Dependencia de proveedor:** cambios de plan o de esquema de Apollo pueden vaciar `email_status`; el mapeo cerrado por defecto lo degrada a «no verificable».
- **Datos personales a un tercero** (6.6).

### 7.1 Lo que NO se afirma
- No se afirma que Glider verifique emails, ni con qué calidad: es su página de marketing, sin verificar.
- No se afirma qué valores devuelve Apollo en `email_status`, ni que distinga catch-all, ni que el estado venga sin coste extra en todos los planes.
- No se afirma la calidad de los emails de Apollo ni de Clay (igual que `PRD-20261112-plays-a-medida.md:250`).
- No se afirma que FullEnrich ni Hunter ofrezcan verificación con catch-all, ni su precio, ni su encaje con la pasarela de Lovable: no hay código ni documentación suya en el repositorio.
- No se afirma qué proporción de contactos de ninguna empresa tiene hoy un email válido ni qué parte de lo revelado se ha perdido por no guardar el estado: sin dato.
- No se afirma que bajen los rebotes ni que suba la respuesta: NOKKO no envía ni mide rebotes.
- No se afirma que el gasto de Apollo sin registrar sea grande: solo que esas rutas no llaman al registro.
- No se afirma ninguna conclusión legal (RGPD, encargado de tratamiento, consentimiento).

### 7.2 Riesgos que confirma Fede al aprobar
- Enviar emails de personas, incluidas de la UE, a un verificador de terceros, sin revisión legal por ahora (6.6).
- Aceptar que el primer paso quizá no distinga catch-all (Q-1).
- Que el arreglo del registro de gasto de Apollo cambie lo que se ve en presupuesto.

## 8. Orden de entrega
Cada SDD se redacta uno a uno con `nokko-shape` cuando apruebes este PRD. Sin asignar sprint: lo decides tú.

| # | SDD (propuesto) | Tipo | Depende de | Cubre |
|---|---|---|---|---|
| 1 | `SDD-…-email-verification-model`: tabla nueva por empresa y email normalizado con RLS; conjunto cerrado de estados; función pura de estado efectivo y ventana como parámetro; mapeo cerrado por defecto de `email_status` de Apollo; regla pura de «¿puede sugerirse un borrador?» con tabla de pruebas; borrado de fila al borrar la empresa | Feature (esquema y datos: SDD completo) | — | G-2, G-4 |
| 2 | `SDD-…-email-verification-apollo`: guardar `emailStatus` al revelar (`apollo-gateway.ts:164-318`); arreglar el registro de gasto de los revelados por pantalla y agente (G-3); necesidad `verify_email` en el orquestador solo si el SDD 2b la exige; decidir qué hace `:310` | Feature | 1 | G-1, G-3, G-5 |
| 3 | `SDD-…-email-verification-surfacing`: estado y fecha junto al email en stakeholders, leads y personas, resultados de revelado, respuestas del agente y de MCP (`estado_email`, títulos en `TITLES`), bloqueo con motivo en `draft_followup` (cargar `email`, `core-read.ts:530`), registro de «borrador bloqueado» sin el email, botón y herramienta «Verificar» con coste previo | Feature | 1, 2 | G-1, G-2 |
| 4 | `SDD-…-email-verification-plays`: paso de contacto de las recetas (NK-0171): exigir estado vigente «verificado» antes de proponer mensaje, verificación dentro del play activo con presupuesto automático, aviso de UE sin cambios | Feature | 1, 2, 3; SDD del motor de NK-0171 | G-2, G-3 |
| 2b | `SDD-…-email-verifier-gateway` (solo si G-5 lo justifica y Fede elige proveedor): gateway nuevo, `Service`, `ENV`, mapeo de estados, pruebas; criterios en 6.4 | Feature | 1, 2 y decisión de Fede | G-1 |

El 2b queda **fuera de la tanda** hasta decidir Q-1 y Q-2. El SDD 4 no puede empezar hasta que el motor de plays de NK-0171 exista.

## 9. Aprobación
- [ ] Fede aprueba el PRD (primer GO de dirección), incluidas las propuestas de la sección 6 y los riesgos de 7.2. Fecha: {…}
- Al aprobar, el Estado pasa a «Aprobado». Después se redactan los SDD con `nokko-shape`.
