# SDD-20261106-plays-library-core · [Feature] Librería de Plays GTM: catálogo de 28 plays, puertas con motivo y activación

**Tipo:** Feature · **Prioridad propuesta:** Media
**Estado:** En curso (aprobado el 2026-11-06) · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-11-06
**PRD:** `docs/prd/PRD-20261106-plays-gtm.md` (iniciativa; este es el SDD 1 de 9) · **Depende de:** — (usa lo ya fusionado en `main`)

> Un SDD dice cómo se verifica que está bien hecho. Cada criterio de aceptación (CA-n) tiene una prueba automática que lo nombra y cita el objetivo G-n del PRD.
> Nota de proceso: en NOKKO, Dani no participa. Las secciones 15 y 16 las responde Fede y las completa Claude Code.

## 1. Resumen
Se crea el módulo `src/lib/plays/` con un **catálogo de código de los 28 plays** (id, estado real, datos que necesita, bloqueo, detectores que ya existen), un **motor de puertas** que explica cada descarte («un dato desconocido nunca pasa»), dos tablas (`play_states`: qué plays activa cada empresa; `play_runs`: registro de pasos y descartes), la pantalla `/plays` y tres herramientas del Agente y del MCP. Los plays que ya existen como reglas proactivas conservan su comportamiento de hoy. Este SDD **no implementa la lógica nueva de ningún play**: eso es de los SDD 2 a 9.

## 2. Problema y para quién
Fede no puede ver qué jugadas tiene NOKKO, cuáles están activas, cuáles faltan ni por qué un candidato se descartó (PRD sección 1). Afecta al Owner y al Sales Leader; los demás miembros solo consultan.

## 3. Evidencia y por qué ahora
Fuente: código de `main` en el commit 47ec72c, leído el 2026-11-06. Sin datos de uso: sin dato.
- `detect(s)` concatena `DETECTORS` y `STRATEGY_DETECTORS`, ejecuta cada regla sobre un `Snapshot` y deduplica por `dedupe_key` (`src/lib/proactive/index.ts`, líneas 71-76). No hay forma de apagar una regla por empresa.
- Cada sugerencia lleva `detector` en texto (`src/lib/proactive/types.ts`, tabla `suggestions`). Los identificadores reales de las reglas que se pueden asignar a plays son: `meeting_no_prep`, `meeting_no_notes`, `late_lead`, `account_signal`, `account_missing_key`, `product_qualified`, `usage_drop`, `trial_conversion`, `no_decision_maker` (literales en `src/lib/proactive/detectors/*.ts`).
- `syncSuggestions` cierra como resueltas las sugerencias pendientes que la regla ya no emite, salvo una lista fija de detectores que no auto-cierra (`src/lib/org-data.ts`, línea 373 en adelante). Pausar un play, por tanto, cierra sus pendientes.
- Patrón de herramienta del Agente: `def({ name, kind: "read"|"write", roles, input: zod, run })`; las de escritura solo crean `agent_pending_actions` hasta confirmar; los títulos viven en `TITLES` (`src/lib/mcp/tools/agent-tools.ts`) y en `.lovable/mcp/manifest.json` (`src/lib/agent/tools/strategy.ts` de ejemplo).
- Patrón de tabla nueva con RLS por empresa y por rol: migración `0072_strategy_reviews.sql`; patrón de prueba de RLS con PGlite y dos empresas ficticias: `src/lib/experiments.pg.test.ts` y `@/test/pg-harness`.
- Patrón de titulares calculados por función pura: `src/lib/headlines.ts` (tested). Navegación: `src/lib/nav.ts` (tested).
- Último archivo de migración: `0076_platform_admins_skip_creator.sql`; el diario `drizzle/migrations/meta/_journal.json` termina en idx 74. [Por verificar] el siguiente número libre al empezar (las migraciones pendientes de Lovable están en `docs/sdd/annex/migraciones-pendientes-lovable-20261101.md`).

## 4. Resultado buscado
Cubre G-1, G-2 y G-3 del PRD (no se repiten aquí). Línea base de todos: sin dato.

## 5. Alcance
**Incluye:**
- Catálogo de 28 plays en `src/lib/plays/catalog.ts` con la tabla de la sección 3 del PRD como contenido inicial (ids, estado, bloqueo, SDD).
- Motor de puertas puro `src/lib/plays/gates.ts` con resultado de tres valores (pasa, no pasa, desconocido).
- Estado efectivo de un play por empresa `src/lib/plays/status.ts` (catálogo + `play_states`).
- Tablas `play_states` y `play_runs` con RLS, y escritura de `play_runs` solo desde servidor.
- Filtro en `detect()` para que un play pausado no emita las reglas que le pertenecen.
- Pantalla `/plays` (ruta en el grupo «Estrategia» del menú), con filtro por motion y por estado y titular calculado.
- Herramientas `list_plays`, `get_play` y `set_play_enabled` en el Agente y el MCP.

**No incluye** (es el límite que el brief copia a «Movimientos prohibidos»):
- Cualquier lógica nueva de un play (señales con caída, revival, extracción de llamadas, tiering aprendido, etc.): SDD 2 a 9.
- Enviar mensajes, publicar o cambiar datos de forma automática.
- Llamadas a proveedores externos, a LinkedIn o a modelos de IA.
- Tocar `src/lib/playbooks/` ni los cinco guiones de venta.
- Tocar reglas proactivas que no pertenecen a un play (`stale_deal`, `past_close_date`, `low_coverage`, `meddpicc_gaps`, `setup_incomplete`, `registration_expiring`, `unassigned_accounts`, `followup_sequence` y las estratégicas): siguen siempre activas.
- Cambiar el esquema de `suggestions` o de `account_signals`.
- Aplicar migraciones a la base de datos real (lo hace Fede, como en SDD anteriores).

## 6. Cambios de comportamiento (delta)
**Añadido:** librería de plays visible en `/plays`; activar y pausar plays; registro de pasos y descartes; tres herramientas del Agente y del MCP.
**Modificado:** `detect(s)` (antes: ejecuta siempre todas las reglas; después: omite las reglas de un play pausado; sin filas en `play_states`, resultado idéntico al actual).
**Eliminado:** nada.

## 7. Historias y criterios de aceptación

### H-1: Como miembro del equipo, quiero ver los 28 plays con su estado real y lo que les falta, para saber qué tiene NOKKO y qué no.
- **CA-1** El catálogo contiene exactamente 28 plays con `id` único, título en español, al menos un motion, al menos un canal, estado (`activo`, `parcial`, `planificado` o `bloqueado`), lista de datos que necesita y SDD que lo desarrolla · cubre G-1 · prueba: `src/lib/plays/catalog.test.ts`
- **CA-2** Cada play con detectores nombra solo detectores que existen: el identificador aparece como literal `detector: "<id>"` en `src/lib/proactive/detectors/` · cubre G-1 · prueba: `src/lib/plays/catalog.test.ts`
- **CA-3** Cada play `bloqueado` declara `blockedBy` con uno de `linkedin_d2`, `proveedor_datos`, `decision_gtm` o `fuente_externa`; ningún otro estado lo declara · cubre G-1 · prueba: `src/lib/plays/catalog.test.ts`
- **CA-4** Ningún play figura como `activo` si no tiene al menos un detector o una salida implementada: en este SDD ninguno es `activo` · cubre G-1 · prueba: `src/lib/plays/catalog.test.ts`
- **CA-5** La pantalla `/plays` lista los 28 plays, filtra por motion y por estado, y muestra el estado con palabra, no con icono ni solo con color · cubre G-1 · prueba: `src/lib/plays/view.test.ts` (filtros puros) y recorrido con `nokko-walkthrough`
- **CA-6** El titular de `/plays` es una conclusión calculada por función pura a partir del catálogo y de `play_states` («N de 28 plays con datos de NOKKO; M activados»); sin datos, cae al nombre de la sección, nunca a una cifra inventada · cubre G-1 · prueba: `src/lib/headlines.test.ts`
- **CA-7** `/plays` aparece en el menú del grupo «Estrategia» y en la paleta ⌘K · cubre G-1 · prueba: `src/lib/nav.test.ts`

### H-2: Como Owner o Sales Leader, quiero activar y pausar un play, para decidir qué jugadas trabajan en mi empresa.
- **CA-8** Solo `owner` y `sales_leader` pueden activar o pausar; el resto ve la acción deshabilitada con el motivo · cubre G-3 · prueba: `src/lib/plays/status.test.ts` (regla pura) y `src/lib/plays.pg.test.ts` (RLS)
- **CA-9** Un play `bloqueado` o `planificado` no se puede activar, ni desde la pantalla ni llamando directamente a la función de servidor ni desde el Agente; el error explica qué lo bloquea y qué hay que decidir · cubre G-3 · prueba: `src/lib/plays/status.test.ts`
- **CA-10** Sin fila en `play_states`, el estado de activación es el `defaultEnabled` del catálogo: `true` solo para los plays que ya existen como regla proactiva (conservan su comportamiento de hoy), `false` para el resto · cubre G-3 · prueba: `src/lib/plays/status.test.ts`
- **CA-11** Con todas las reglas de plays activadas (sin filas), `detect(snapshot)` devuelve exactamente lo mismo que antes del cambio sobre un snapshot ficticio de referencia · cubre G-3 · prueba: `src/lib/plays/detect-gating.test.ts`
- **CA-12** Con un play pausado, `detect` no emite las sugerencias cuyo `detector` pertenece a ese play y sí emite todas las demás; las sugerencias pendientes de ese detector se cierran en la siguiente sincronización y quedan en el historial · cubre G-3 · prueba: `src/lib/plays/detect-gating.test.ts`
- **CA-13** Una empresa no ve ni modifica los `play_states` de otra · cubre G-3 · prueba: `src/lib/plays.pg.test.ts`

### H-3: Como Fede, quiero que cada candidato descartado por un play tenga un motivo, para poder corregir la regla en vez de adivinar.
- **CA-14** `runGates` devuelve «pasa» solo si todas las puertas dan «pasa»; si alguna no, devuelve «descartado» con la clave de la primera que falló y su motivo en español · cubre G-2 · prueba: `src/lib/plays/gates.test.ts`
- **CA-15** Una puerta con resultado «desconocido» nunca pasa: el candidato se descarta con el motivo «dato desconocido» y el nombre del dato que falta · cubre G-2 · prueba: `src/lib/plays/gates.test.ts`
- **CA-16** Cada paso o descarte puede registrarse en `play_runs` con empresa, play, tabla y id del sujeto, resultado, clave y motivo del descarte y fecha; nunca guarda textos, nombres ni emails de clientes (solo ids) · cubre G-2 · prueba: `src/lib/plays/run-log.test.ts`
- **CA-17** `play_runs` solo se escribe desde código de servidor; los miembros leen los de su empresa; nadie edita ni borra desde la app · cubre G-2 · prueba: `src/lib/plays.pg.test.ts`

### H-4: Como usuario del Agente o de un asistente externo, quiero consultar y activar plays por conversación, con confirmación.
- **CA-18** `list_plays` y `get_play` (lectura, cualquier miembro) devuelven catálogo + estado de la empresa; `set_play_enabled` (escritura, `owner` y `sales_leader`) solo crea una acción pendiente y no cambia nada hasta confirmar · cubre G-3 · prueba: `src/lib/agent/tools/plays.test.ts`
- **CA-19** Las tres herramientas tienen título en `TITLES` y entrada en `.lovable/mcp/manifest.json`, y filtran por `org_id` de forma explícita (Telegram y cron usan el cliente privilegiado) · cubre G-3 · prueba: `src/lib/agent/tools/plays.test.ts` y `src/lib/agent-tools.test.ts`
- **CA-20** Las salidas posibles de un play son solo `suggestion`, `task` y `draft`; el tipo y una prueba impiden declarar un envío automático (`send`) en cualquier play del catálogo · cubre G-3 · prueba: `src/lib/plays/catalog.test.ts`

## 8. Casos límite y errores
- Empresa sin ninguna fila en `play_states`: todo según `defaultEnabled` (CA-10, CA-11).
- Play que pasa a `bloqueado` en el catálogo después de estar activado: el estado efectivo es «bloqueado» y no emite; la fila se conserva (prueba en `status.test.ts`, incluida en CA-9).
- Dos pestañas activan y pausan a la vez: gana la última escritura; la fila guarda `updated_by` y `updated_at`.
- Usuario sin empresa actual o sin rol: no ve filas (RLS, CA-13).
- Error de red al activar: mensaje por `errorText()` («qué pasó + qué hacer»), nunca el texto crudo.
- Catálogo con id repetido o play sin motion: falla `catalog.test.ts` (CA-1).

## 9. Experiencia y copy
- Menú: «Plays GTM» en «Estrategia». Pantalla: tarjetas con título, motion, canal, estado en palabra (Parcial, Planificado, Bloqueado, Activo), qué datos necesita y, si está bloqueado, el motivo y la decisión que lo desbloquea.
- Estados con palabra: «Activado», «Pausado», «Bloqueado: falta una decisión de LinkedIn», «Bloqueado: falta un proveedor de datos», «Bloqueado: falta decidir a qué GTM sirve NOKKO».
- Texto de pantalla vacía de actividad: «Aún no hay pasos ni descartes registrados para este play».
- Texto al intentar activar un play bloqueado: «No puedes activar este play todavía: [motivo]. [Qué decidir].»
- Español, «tú», sin iconos. No se nombra a Frontal en la interfaz de producto.

## 10. Datos, permisos y privacidad
Migración nueva (sin tocar migraciones aplicadas), con GRANTs, RLS y el patrón de `0072_strategy_reviews.sql`. Nunca aplicada a la base real desde la rama.
- `play_states`: `org_id uuid NOT NULL DEFAULT public.current_org()` (FK a `organizations`), `play_id text NOT NULL`, `enabled boolean NOT NULL`, `settings jsonb NOT NULL DEFAULT '{}'`, `updated_by uuid DEFAULT auth.uid()`, `updated_at timestamptz NOT NULL DEFAULT now()`, clave primaria `(org_id, play_id)`. Lectura: miembros de la empresa. Insert y update: `owner` y `sales_leader` de la empresa. Sin delete desde la app.
- `play_runs`: `id uuid PK`, `org_id` igual que arriba, `play_id text`, `subject_table text`, `subject_id uuid`, `outcome text CHECK IN ('pass','drop')`, `gate_key text`, `drop_reason text`, `created_at timestamptz`. `outcome='drop'` exige `drop_reason`. Lectura: miembros. Escritura: solo `service_role`. Índice `(org_id, play_id, created_at DESC)`.
- `play_id` en las dos tablas no lleva CHECK contra el catálogo (el catálogo vive en código y crece); la validación está en la función de servidor y en la prueba.
- `settings` queda vacío en este SDD; lo usan los SDD siguientes (por ejemplo las ventanas de caída). Nada de secretos en él.
- Privacidad: `play_runs` guarda ids, nunca texto de lead, persona ni cuenta. Datos ficticios en pruebas y fixtures. Sin datos de clientes en logs.
- Roles: los de `org_members` (owner, sales_leader, resto), igual que `strategy_reviews`.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| Ninguna | regla determinista | — | Sin coste de IA ni de proveedor |

Una llamada no declarada aquí no se implementa.

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | Catálogo de 28 plays, tipos, salidas permitidas | CA-1, CA-2, CA-3, CA-4, CA-20 | `src/lib/plays/catalog.test.ts` |
| U-2 | Motor de puertas con «desconocido nunca pasa» y modelo del registro | CA-14, CA-15, CA-16 | `src/lib/plays/gates.test.ts`, `src/lib/plays/run-log.test.ts` |
| U-3 | Estado efectivo, `defaultEnabled`, permisos y bloqueos | CA-8, CA-9, CA-10 | `src/lib/plays/status.test.ts` |
| U-4 | Migración `play_states` y `play_runs`, RLS, entrada en el diario | CA-13, CA-17 (y CA-8 en RLS) | `src/lib/plays.pg.test.ts`, `src/lib/migrations-journal.test.ts` |
| U-5 | Filtro de plays pausados en `detect()` y carga de `play_states` en la sincronización | CA-11, CA-12 | `src/lib/plays/detect-gating.test.ts` |
| U-6 | Herramientas del Agente y del MCP, títulos y manifiesto | CA-18, CA-19 | `src/lib/agent/tools/plays.test.ts` |
| U-7 | Pantalla `/plays`, menú, paleta y titular | CA-5, CA-6, CA-7 | `src/lib/plays/view.test.ts`, `src/lib/headlines.test.ts`, `src/lib/nav.test.ts` |

Orden: U-1 → U-2 → U-3 → U-4 → U-5 → U-6 → U-7. Un PR en borrador por SDD, commits por unidad.

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- **Catálogo.** Tipo `Play = { id; title; motion: Motion[]; channels: Channel[]; status; blockedBy?; needs: string[]; detectors: string[]; defaultEnabled: boolean; outputs: ("suggestion"|"task"|"draft")[]; gates: GateDef[]; sdd: number }`. `id` en kebab-case ASCII con los slugs de la tabla del PRD. Textos propios, no copiados de Frontal.
- **Reparto de detectores a plays (inicial):** `meeting-prep-and-follow-up` → `meeting_no_prep`, `meeting_no_notes`; `meeting-form-orchestration` → `late_lead`; `signal-activation` → `account_signal`; `crm-hygiene` → `account_missing_key`; `plg-to-sales` → `product_qualified`, `usage_drop`, `trial_conversion`; `multi-thread-inbound-leads` → `no_decision_maker`. Solo estos plays llevan `defaultEnabled: true`. Un detector pertenece a un solo play (prueba).
- **Filtro en `detect()`.** Añadir al `Snapshot` un campo opcional `disabledPlays?: string[]` (como ya hacen otros campos opcionales) y filtrar el resultado por `x.detector` según `detectorsOf(disabledPlays)`. Así `detect(s)` sin el campo se comporta igual (CA-11). `detect()` se llama desde `src/lib/inngest/tasks.server.ts` (línea 16, con `loadSnapshot(db, orgId)`) y desde `src/lib/agent.functions.ts` (línea 249, con `snap`). La carga de `play_states` debe ir en `loadSnapshot` para que ambas rutas la compartan [Por verificar] que no haya un tercer constructor de snapshot.
- **Puertas.** `type GateResult = { v: "pass" } | { v: "fail"; reason: string } | { v: "unknown"; missing: string }`. `runGates(gates, subject)` evalúa en orden y corta en la primera que no pasa. Función pura sin E/S; quien la llama escribe `play_runs`.
- **Estado efectivo.** `effectiveState(play, row)` devuelve `{ enabled, label, canEnable, reason }`. Un play `bloqueado` o `planificado` nunca está `enabled` aunque la fila diga lo contrario.
- **Pantalla.** Ruta `src/routes/_authenticated/plays.tsx` (solo configuración y diseño) con el panel en `src/components/plays/`; lectura con el cliente del navegador (RLS) y `queryOptions` como las pantallas principales. Titular en `src/lib/headlines.ts`.
- **Agente y MCP.** Módulo `src/lib/agent/tools/plays.ts` ensamblado en `src/lib/agent/tools.ts`; reutiliza `effectiveState` para decidir igual que la pantalla (no lógica paralela).
- **Alternativa descartada:** guardar el catálogo en la base de datos. Se descarta porque el catálogo cambia con el código (cada SDD lo actualiza) y así las pruebas lo vigilan; en la base solo va el estado por empresa.
- **Alternativa descartada:** crear una tabla de «ejecuciones» para todas las reglas existentes. Fuera de alcance; `play_runs` solo registra lo que escriban los plays nuevos.

## 14. Riesgos y dependencias
- Pausar un play cierra sus pendientes por el comportamiento de `syncSuggestions` (sección 3). Aceptado y documentado en CA-12.
- El filtro toca `detect()`, que corre en cada sincronización de todas las empresas: CA-11 es la red de seguridad; el PR debe adjuntar la salida de esa prueba.
- La migración debe ir al final del diario y respetar `src/lib/migrations-journal.ts`; entre ramas, otro SDD puede reclamar el mismo número ([Por verificar] al abrir el PR).
- Riesgo de producto: catálogo con 28 plays y la mayoría sin ejecución. Por eso el estado va en palabra y ninguno es `activo` (CA-4).
- Dependencias: ninguna de código no fusionado.

## 15. Preguntas para Fede y para la revisión técnica
1. ¿Apruebas el nombre «Plays GTM» y el módulo `src/lib/plays/`, distinto de los «playbooks» de venta?
2. ¿Quieres que cualquier miembro pueda activar plays o solo Owner y Sales Leader (propuesto, como Revisión estratégica)?
3. ¿Mostramos los plays bloqueados en `/plays` (propuesto, para que se vea qué falta) o los ocultamos hasta desbloquearse?
4. Revisión técnica: ¿el filtro por `detector` en `detect()` es suficiente o hay reglas que emiten sugerencias con otro `detector`? (por ejemplo las que pasan por `buildStrategySuggestion`; no se tocan aquí).
5. Revisión técnica: ¿conviene que `play_runs` tenga retención? Propuesta: sin retención en este SDD; se decide con datos reales de volumen (sin dato).

## 16. Pendiente de verificar
| [Por verificar] | Quién o qué lo comprueba | Resultado (Claude Code, 2026-11-06) |
|---|---|---|
| Número libre de migración y última entrada del diario | Claude Code al empezar, contra `main` y el anexo de migraciones pendientes | **Resuelto: 0077.** `origin/main` (47ec72c) termina en `0076_platform_admins_skip_creator` (idx 74); el anexo solo cubre 0071 a 0073. Ninguna rama remota ni worktree local usa 0077. Aviso: dos ramas sin fusionar (worktrees locales) llevan un `0074_*` cada una (`money_moment_notices`, `one_pending_won_request_per_deal`), así que quien fusione segundo debe volver a sellar su `when`. La entrada nueva es idx 75, `when` 1793966400000; `check-migration-journal.mjs` contra `origin/main`: sin errores. |
| Que `loadSnapshot` sea el único constructor de `Snapshot` (llamadas conocidas: `tasks.server.ts:16`, `agent.functions.ts:249`) | Claude Code en U-5, con búsqueda en todo `src/` | **Resuelto: sí.** `detect(` se llama en tres sitios, los tres con un snapshot de `loadSnapshot`: `agent.functions.ts:249`, `inngest/tasks.server.ts:16` y `routes/api/public/jobs/proactive.ts:78` (este tercero no estaba en la lista). `inngest/lead-tasks.server.ts:356` también llama a `loadSnapshot`, pero no pasa por `detect()`. No hay otro sitio que construya un `Snapshot` fuera de pruebas. Lo vigila `detect-gating.test.ts`. |
| Que ningún detector asignado a un play emita con un `detector` distinto del literal | Claude Code en U-1 (prueba CA-2) | **Resuelto para los nueve asignados:** cada uno aparece como literal `detector: "<id>"` en `src/lib/proactive/detectors/` (`catalog.test.ts`). **No comprobado:** las reglas que pasan por `buildStrategySuggestion` (pregunta 4 de la sección 15, de la revisión técnica); no pertenecen a ningún play y no se tocan. |
| Estado de Apify, G2 y recepción de email en producción (afecta a la tabla del PRD, no a este SDD) | Fede, en producción | **Sin comprobar.** No afecta al código de este SDD. |

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Un agente `nokko-gate` con contexto fresco lee este SDD y el código, y devuelve su informe. El coordinador lo copia aquí sin editarlo. El gate no aprueba el SDD: informa; la aprobación es de Fede.
- Veredicto del gate: No revisado
- CA sin prueba posible o sin G-n: {pendiente}
- [Por verificar] que sigue sin comprobarse: {pendiente}
- Contradicciones con el código o con decisiones previas: {pendiente}
- Lo que esta revisión NO demuestra: {pendiente}

## 18. Delta de implementación (lo rellena el agente al entregar)
Rama `feat/plays-library-core`, commits por unidad (U-1 a U-7). La migración `0077_plays_library_core.sql` está escrita y probada en PGlite; **no se ha aplicado a ninguna base real**.

**Decisiones mías que el SDD no fijaba (revísalas):**
- **Motions y canales.** El PRD no asigna motion ni canal a cada play. Usé un conjunto cerrado propio (`entrante`, `saliente`, `producto`, `cuentas`, `reactivacion`, `mercado`; y siete canales) y reparto yo cada play. El tipo se llama `PlayMotion` para no confundirlo con `segments.motion` ni `segments.acquisition_motion`. Es lo más opinable del catálogo.
- **Mapa de estados.** `parcial` = los 11 parciales del PRD; `planificado` = `pain-qualified-segments` («nuevo interno»); `bloqueado` = los 16 externos, con el bloqueo del PRD mapeado a uno de los cuatro valores de CA-3. `multi-thread-inbound-leads` figura `parcial` y **sin** `blockedBy` aunque el PRD le pone un bloqueo (contacto adicional vía Apollo, Clay o LinkedIn): CA-3 reserva `blockedBy` a los bloqueados, así que ese dato va en `needs`.
- **Textos de `fuente_externa`.** La sección 9 no da el texto de ese bloqueo; escribí «Bloqueado: falta una fuente externa» y «Decide qué fuente o herramienta externa se conecta».
- **Puertas vacías.** `Play.gates` existe, pero ningún play declara puertas todavía (la lógica de cada play es de los SDD 2 a 9). `GateDef` y `GateResult` viven en `src/lib/plays/types.ts`.
- **`play_runs`.** `subject_table` y `subject_id` son `NOT NULL` (CA-16 los exige). `runRow` rechaza además un motivo con «@» o de más de 200 caracteres, para que un descarte no arrastre datos de una persona.
- **Escritura de la pantalla.** La activación pasa por la función de servidor `setPlayEnabled` (`src/lib/plays.functions.ts`) y comparte con la herramienta del Agente el núcleo `togglePlay` (`src/lib/plays/toggle.ts`): así CA-9 se cumple en la pantalla, en una llamada directa y en el Agente, con las mismas palabras. En el Agente, el rechazo ocurre al confirmar la acción pendiente, no al proponerla (el registro no valida antes de crear la acción pendiente).
- **Pausa sobre un play bloqueado.** Pausar un play bloqueado o planificado está permitido (solo activar se rechaza).
- **Fallo abierto.** `loadSnapshot` ignora un error al leer `play_states` y deja todas las reglas encendidas, como hoy. Así el código puede desplegarse antes que la migración sin romper la sincronización; mientras no se aplique 0077, `/plays` muestra los plays con su valor por defecto y activar da error.
- **Tipos generados.** Añadí a mano `play_runs` y `play_states` a `src/integrations/supabase/types.ts` (al estilo del generado) y a `INFRASTRUCTURE_TABLES` de `field-coverage.ts`, como ya hizo `strategy_reviews`. Conviene regenerar los tipos tras aplicar la migración.
- **Orden de herramientas.** Las tres herramientas van al final del registro (`...PLAY_TOOLS`) para no mover el orden que ve el modelo. El manifiesto MCP se regeneró con el CLI (solo suma las tres).

**Lo que NO está hecho o verificado:**
- CA-5: el recorrido con `nokko-walkthrough` no se ha hecho; la pantalla compila (`vite build`) y sus reglas están probadas, pero no la he visto en un navegador (exige sesión).
- CA-11 es una prueba de no regresión: pasa también sobre la base por su naturaleza. CA-12 y el resto de pruebas fallaron antes de implementar.
- Sección 17: sin rellenar (la hace el gate).
- Lint: `eslint .` ya falla en `origin/main` por reglas de prettier en ficheros existentes; los ficheros nuevos o tocados no añaden errores.
- La migración no se ha probado contra el esquema real de Lovable Cloud, solo contra PGlite.

