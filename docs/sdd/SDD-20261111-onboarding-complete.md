# SDD-20261111-onboarding-complete · [Feature] Onboarding completo y proactivo, revalidado contra GTM Lab

**Tipo:** Feature (sin migración) · **Prioridad propuesta:** Media (es la fila 0 del PRD de diagnóstico: el SDD 4, «diagnóstico en el asistente», no empieza sin esto; el resto del ticket original ya está hecho u obsoleto)
**Estado:** Borrador (P-1 y P-2 decididas por Fede el 2026-11-11, §15; gate pasada 1 aplicada, §17) · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-11-11
**Ticket:** NK-0009 (LOGGED; decisión D-9 de Fede del 2026-11-06: «revalidar contra GTM Lab; lo cubierto se absorbe y el resto va a la épica de encaje de personas»)
**PRD:** `docs/prd/PRD-20261110-diagnostico-y-equipos-de-plays.md` §8 fila 0 («base del diagnóstico»; cubre la condición previa de G-1) y `docs/prd/PRD-20261028-ux-onboarding-coherencia.md` (G-4) · **Sustituye a:** `docs/sdd/SDD-20261025-onboarding-flow-end-to-end.md` (Borrador, nunca aprobado; queda como histórico) · **Depende de:** nada sin entregar · **Coordina con:** SDD 4 del PRD de diagnóstico (`diagnosis-in-chat`, sin redactar), que consume lo que este SDD expone; GTM Lab SDD 3 (`PRD-20261101-gtm-lab-en-nokko` §8 fila 3, sin redactar), que trae el perfil y los pasos obligatorios del proyecto principal

> Un SDD dice cómo se verifica que está bien hecho. Cada criterio de aceptación (CA-n) tiene una prueba automática que lo nombra.
> Nivel elegido: SDD sin PRD nuevo. Es una feature, pero ya cuelga de dos PRD aprobados (el de diagnóstico, fila 0, y el de UX y onboarding, G-4); un PRD propio repetiría su problema y sus objetivos.
> Números de línea comprobados en `main` @ `6435439` (rama `docs/sprint7-sdd-nk0009`, sin cambios en `src/`), el 2026-11-11.

## 1. Resumen
El ticket NK-0009 se escribió el 2026-10-25, antes de GTM Lab. Revalidado hoy: de sus 11 criterios, 7 ya están hechos en `main`, 1 queda obsoleto por GTM Lab y 3 siguen pendientes, uno de ellos a medias (§3.2); además falta algo que el ticket no pedía: el diagnóstico sin fuentes. Este SDD cierra solo lo pendiente y lo que el diagnóstico (SDD 4) necesita del onboarding:
1. **Una sola definición** de «onboarding terminado» por persona, y un **estado de la empresa** (diagnóstico GTM y piezas de estrategia) en una función pura.
2. **Diagnóstico sin fuentes:** hoy no se llega al paso «Diagnóstico» sin una propuesta leída; una empresa sin web o con la lectura fallida se queda sin arquetipo.
3. **El agente lo lee:** una herramienta de lectura `get_onboarding_status` (agente, Telegram y MCP) con el estado de la empresa, sin propuesta ni hallazgos.
4. **Proactivo:** un aviso en Sugerencias cuando una persona deja el onboarding a medias más de un día.

Sin migración, sin llamadas de IA nuevas y sin tocar los bloques ni lo que escriben (lo reescribe GTM Lab).

## 2. Problema y para quién
Founder, Owner o Sales Leader que empieza el onboarding y lo deja a medias, o que no tiene web ni documentos que leer. Y el diagnóstico de plays (SDD 4), que necesita saber qué sabe NOKKO de la empresa antes de proponer equipos de plays: hoy el agente no puede leer el arquetipo ni el estado del onboarding (§3.1, hallazgos 5 y 6).

## 3. Evidencia y por qué ahora
### 3.1 Qué hay hoy (leído en `main` @ `6435439`)
1. **Tres «terminado» distintos.**
   - `src/lib/guide.ts:13`: el paso «Completa el onboarding» de «Primeros pasos» está hecho si `onboardingStep === "roadmap"`.
   - `src/lib/onboarding.ts:124-126` `showRoadmapCard`: la tarjeta de Inicio se oculta con `completed_at`, que también escribe el botón «Ocultar» (`src/components/onboarding/home-card.tsx:28`) y el recorrido de invitados (`src/routes/_authenticated/onboarding.tsx:32`). `completed_at` significa «oculto o terminado como invitado», no «terminado».
   - `src/lib/onboarding.ts:129-131` `blocksDecided`: habilita «Ver tu roadmap» (`src/components/onboarding/blocks.tsx:160`); es una regla del paso, no de terminado.
2. **El diagnóstico exige propuesta.** `onboarding.tsx:51`: `diagnosis` y `blocks` solo son alcanzables con `proposal`; `roadmap`, con diagnóstico. Pero `onboarding.tsx:68` ya prevé guardar el diagnóstico sin propuesta (`step: proposal ? "blocks" : "roadmap"`): ese camino hoy no se puede recorrer. Si la lectura falla o no hay fuentes, no hay arquetipo.
3. **La sesión es por persona.** `drizzle/migrations/0052_onboarding_sessions.sql`: `UNIQUE (org_id, user_id)` y política «Own onboarding in my company» (solo tu fila). `src/hooks/use-onboarding.ts:21`: `upsert` con `onConflict: "org_id,user_id"`.
4. **El diagnóstico ya es de la empresa en Inicio.** `drizzle/migrations/0065_company_diagnosis.sql`: función `company_diagnosis(_org)` (`SECURITY DEFINER`, solo devuelve `diagnosis`, el tuyo primero y si no el más reciente de un compañero). La usa `home-card.tsx:21`. Está en los tipos generados (`src/integrations/supabase/types.ts:5491`) y en `docs/BASE-DE-DATOS.md:121`. **Aplicada en la base de datos real:** `company_diagnosis(uuid)` existe como función `SECURITY DEFINER`, con `EXECUTE` para `authenticated` = true y para `anon` = false (comprobación de solo lectura del coordinador, 2026-11-11). `service_role` también tiene `EXECUTE` (`has_function_privilege` = true, misma comprobación), así que con el cliente de servicio la función **no da error: devuelve `null`**, porque `is_org_member` usa `auth.uid()` (`drizzle/migrations/0002_multitenant_organizations.sql:42`), que ahí es nulo. La cabecera de la migración («NOT yet applied») está desactualizada.
5. **El agente no ve el diagnóstico.** Ninguna herramienta de `src/lib/agent/tools/` lee `company_diagnosis` ni `onboarding_sessions` (`grep`); `companyContext` (`src/lib/bmad/drafting.ts:12`) lee artefactos, Conocimiento, segmentos, cuotas y miembros, no el diagnóstico.
6. **El diagnóstico guarda lo que el SDD 4 necesita.** `onboarding.tsx:68` guarda `{ input, result }`: `input` = modelo, ticket anual, fricción y etapa (`src/lib/gtm-diagnosis.ts:9`); `result` = arquetipo, nombre, `motion`, marcos activos y descartados, siguiente paso (`gtm-diagnosis.ts:32-41`).
7. **Ningún aviso por onboarding a medias.** `src/lib/proactive/detectors/` no tiene detector de onboarding. Lo más cercano es `setup-incomplete.ts:10-32` (siguiente dato de estrategia, con `inactive` de 1 día, `src/lib/setup-guide.ts:162-172`), que mide la estrategia guardada, no el recorrido.
8. **Avisos de la lectura: ya existen.** Al terminar, `onboarding.server.ts:85` devuelve un aviso con `needs_decision: true` y enlace `/onboarding`; si falla, `src/lib/inngest/job-runner.server.ts:110-122` marca el trabajo `failed` con `errorText` y lo entrega como aviso; sin presupuesto, `onboarding.server.ts:25` para con «qué pasó + qué hacer».
9. **El roadmap final es estático.** `src/components/onboarding/steps.tsx:74-108`: dos listas fijas («Nokko hará solo», «Te toca a ti»).
10. **GTM Lab no está conectado.** `src/lib/gtm-lab/` (núcleo y metodología, NK-0048, Hecho) no tiene tablas ni pantalla; fuera de su carpeta solo lo importan `src/lib/ai-pinned.ts` y `src/lib/knowledge-rules.test.ts`. El perfil (7 preguntas, `src/lib/gtm-lab/methodology/framework.yaml:7-17`) y los pasos obligatorios (los que no llevan `optional: true`, `framework.yaml:24-68`; regla en `src/lib/gtm-lab/core/progress.ts:49-56` `strategyDocReady`) existen como código, sin datos por empresa. Las tablas `gtm_lab_*` son del GTM Lab SDD 3, que depende de «Lovable A y B» (`PRD-20261101` §8 fila 3) y no tiene SDD.
11. **Equipos de plays: no leen la empresa.** `src/lib/plays/recommend.ts:12` `recommendablePlays(catalog)` y `src/lib/plays/teams.ts` (`PLAY_TEAMS`) ordenan por catálogo, sin datos de la empresa. Elegir equipos por empresa es del SDD 4.

12. **«Completo» para posicionamiento e ICP ya está definido** en `src/lib/setup-schema.ts` y es la regla de la guía y del medidor de Estrategia:
   - Posicionamiento (`:50-51`): los 13 campos de `POSITIONING_FIELDS` (`:26-36`: los cinco de Dunford de `:18-24` más cliente objetivo, necesidad, categoría, beneficio clave, alternativa competitiva, diferenciador, frase de una línea y elevator pitch) con texto no vacío (`filled`, `:38`).
   - ICP (`:52-53`): al menos un ICP con `industries`, `company_size`, `why_fit` y `anti_icp` no vacíos.
   - `setupStatus` (`:68-75`) devuelve esos dos ítems con su `done`.

13. **Qué cliente usa cada canal del agente.** Telegram y los trabajos programados construyen el contexto con el cliente de servicio: `channelCtx(admin, …)` devuelve `db: admin` (`src/lib/agent/channel-ctx.server.ts:6-15`). MCP usa el cliente de la persona (`src/lib/mcp/context.ts:10`, `supabaseForUser`). La app, también el de la persona (`agent.functions.ts`).
14. **Cómo se cierran las sugerencias.** `syncSuggestions` (`src/lib/org-data.ts:386`) cierra como `resolved` toda sugerencia abierta cuya clave el detector no vuelve a emitir (`:457-483`), salvo los detectores excluidos en `:462-466`. Una sugerencia `resolved` solo se reabre si su detector está en `REOPENABLE` (`:378`, hoy solo `setup_incomplete`); el `upsert` con `ignoreDuplicates` (`:400-403`) no la reabre. Lo llaman la app al abrir Sugerencias (`agent.functions.ts:248-249`, con el cliente de la persona), `src/lib/inngest/tasks.server.ts:16-17` y el cron `src/routes/api/public/jobs/proactive.ts:79-80`.

**Uso real del onboarding:** sin dato (no hay eventos de sesión; `onboarding_sessions` solo guarda el estado actual).

### 3.2 Revalidación del ticket original contra `main` y GTM Lab
| CA original (`SDD-20261025-onboarding-flow-end-to-end`) | Hoy | Evidencia |
|---|---|---|
| CA-1 Retomar donde lo dejé, en cualquier dispositivo | **Hecho** por persona. Que un segundo miembro vea el mismo estado choca con la sesión por persona y no se pide aquí | `use-onboarding.ts:21`; `onboarding.tsx:27` |
| CA-2 Al abandonar, conservar hallazgos sin aplicarlos | **Hecho**: nada se aplica sin «Aprobar bloque»; solo una lectura nueva vacía la propuesta | `onboarding.server.ts:28`; `blocks.tsx:64-75` |
| CA-3 Recordatorio a 1 día en Inicio y Agente | **Pendiente** para el recorrido (existe para la estrategia: `setup_incomplete`) | §3.1 hallazgo 7 → H-4 |
| CA-4 Avisar al terminar la lectura | **Hecho** | §3.1 hallazgo 8 |
| CA-5 Avisar si la lectura falla o se pausa | **Hecho** | §3.1 hallazgo 8 |
| CA-6 Una definición de terminado | **Pendiente** | §3.1 hallazgo 1 → H-1 |
| CA-7 Resumen Confirmado/Deducido/Supuesto y siguientes pasos con estado | **Obsoleto.** Los pasos con estado los da el tablero de GTM Lab («Capa de tareas», `PRD-20261101` §6.1); el nivel por dato era de NK-0028, superado | `PRD-20261101` §6.1 y §6.2 fila 2 |
| CA-8 Diagnóstico disponible para la empresa y el Agente | **A medias**: la empresa sí (0065, Inicio); el agente no | §3.1 hallazgos 4 y 5 → H-3 |
| CA-9 Añadir una fuente sin perder lo aprobado | **Hecho**: lo aprobado ya está en las tablas de estrategia y `protectManual` no lo repropone; las fuentes se acumulan (NK-0007 CA-12) | `onboarding.ts:58-82`; `src/lib/AGENTS.md:62` |
| CA-10 Un dato nuevo que contradice uno tuyo se propone, no se sobrescribe | **Hecho** | `onboarding.ts:58-82`; `blocks.tsx:39-42` |
| CA-11 Recorrido corto para invitados | **Hecho** | `src/components/onboarding/guest.tsx:9-37`; `onboarding.tsx:30-34` |
| (§5 original) «Roadmap con estado» y «propagar el diagnóstico» | Roadmap: **obsoleto** (GTM Lab). Diagnóstico: H-3 | — |
| (nuevo) Diagnóstico sin fuentes | **Pendiente**, no estaba en el ticket | §3.1 hallazgo 2 → H-2 |

**Qué significa hoy «completo y proactivo»:**
- **Completo:** cada persona termina el recorrido con su diagnóstico GTM aunque no tenga fuentes, hay una sola forma de saber si lo terminó y la empresa (y el agente) saben qué falta para el diagnóstico de plays. No significa más bloques ni más preguntas: el contenido estratégico lo rehace GTM Lab desde el proyecto principal y archiva la Estrategia actual (`PRD-20261101` §6.1 «Datos existentes» y A-6).
- **Proactivo:** NOKKO te avisa si dejaste el recorrido a medias; los avisos de la lectura ya existen.

**Por qué ahora:** el PRD de diagnóstico pone NK-0009 como requisito del SDD 4 (§8 fila 0) y los SDD 1, 2 y 3 de esa iniciativa ya están entregados (NK-0127, NK-0140 y NK-0128, SHIPPED en el ledger).

## 4. Resultado buscado
- **G-4** (PRD-20261028): % de empresas que llegan a «onboarding terminado» en 7 días. Línea base: sin dato. Este SDD fija la definición (H-1) que lo hace medible; no lo instrumenta.
- **Condición previa de G-1** (PRD-20261110: diagnósticos terminados con al menos un equipo propuesto): el SDD 4 puede saber, por herramienta, si la empresa tiene lo mínimo para empezar. Indicador interno: el agente lee el estado sin abrir propuesta ni hallazgos (CA-7, CA-8). Línea base: no existe.
- Personas avisadas por onboarding a medias: sin dato; se verá en `suggestions` (`detector = 'onboarding_stalled'`) tras la entrega.

## 5. Alcance
**Incluye:**
- `src/lib/onboarding.ts`: `onboardingDone`, `stepReachable` y `companyOnboardingStatus` (puras, §13); `guide.ts:13` y `onboarding.tsx:51` pasan a usarlas.
- `src/components/onboarding/sources.tsx` y `reading.tsx`: una acción «Hacer solo el diagnóstico» que lleva al paso «Diagnóstico» sin propuesta.
- Herramienta de lectura `get_onboarding_status` (nuevo `src/lib/agent/tools/onboarding.ts`), su título en `TITLES` y el manifiesto regenerado con el extractor.
- Detector `onboarding_stalled` (nuevo `src/lib/proactive/detectors/onboarding-stalled.ts`), campo opcional `onboarding` en `Snapshot` y su lectura en `loadSnapshot` (solo `user_id`, `step`, `updated_at`).
- `syncSuggestions` (`src/lib/org-data.ts`): `onboarding_stalled` fuera del cierre genérico, cierre explícito por dueño (CA-13) y `onboarding_stalled` en `REOPENABLE`; los tres llamadores pasan qué filas de onboarding se leyeron.
- `companyDiagnosisFor(c)` en `src/lib/agent/tools/onboarding.ts` (CA-7).
- Una línea en `AGENTS.md` (párrafo «Onboarding (/onboarding)») y en `src/lib/AGENTS.md` sobre la definición única y la herramienta.

**No incluye** (el brief lo copia a «Movimientos prohibidos»):
- Migraciones, tablas, columnas, políticas, funciones SQL o GRANTs. `onboarding_sessions`, su política y `company_diagnosis` no cambian.
- Cambiar los seis bloques, sus niveles, `protectManual`, `applySetupItems`/`undoSetupItems`, `setup-extract.server.ts` o la lectura `onboarding_read` (lo que escriben en Estrategia lo reescribe GTM Lab).
- Niveles por dato, caducidad, los cuatro bloques de contexto o el bloqueo de objetivos de NK-0028 (rechazado).
- El roadmap con estado o tareas (tablero de GTM Lab).
- Preguntas sobre tareas o cuello de botella, elegir equipos de plays, voz o reglas en el onboarding (SDD 4, SDD 5 y NK-0128).
- Compartir la sesión entre miembros (un solo onboarding por empresa).
- Cambiar `showRoadmapCard`, el botón «Ocultar» o el significado guardado de `completed_at`.
- Cambiar `setup_incomplete` ni silenciarlo mientras haya un onboarding a medias.
- Cambiar cómo `syncSuggestions` trata a cualquier otro detector.
- Llamadas de IA nuevas.
- Editar `.lovable/mcp/manifest.json` a mano.

## 6. Cambios de comportamiento (delta)
**Añadido:** `onboardingDone`, `stepReachable`, `companyOnboardingStatus`; acción «Hacer solo el diagnóstico»; herramienta `get_onboarding_status`; sugerencia «Retoma tu onboarding» tras un día sin avanzar.
**Modificado:** el paso «Diagnóstico» es alcanzable sin propuesta (antes: solo con propuesta); «Primeros pasos» y la ruta usan las funciones puras en vez de reglas sueltas, con el mismo resultado.
**Eliminado:** la regla de alcance escrita dentro de `onboarding.tsx:51`.

## 7. Historias y criterios de aceptación
### H-1: Como Owner, quiero que NOKKO tenga una sola idea de «terminé el onboarding», para que la guía, el agente y el diagnóstico digan lo mismo.
- **CA-1** `onboardingDone(session)` devuelve `true` si y solo si `session?.step === "roadmap"`; `false` para `null`, `undefined` y cualquier otro paso, aunque `completed_at` tenga valor (ese campo significa «tarjeta oculta», §3.1 hallazgo 1). · cubre G-4 · prueba: `src/lib/onboarding.test.ts` (falla hoy: la función no existe)
- **CA-2** `guideSteps` marca hecho el paso «onboarding» con `onboardingDone` (mismo resultado que hoy para `"roadmap"`, `"blocks"` y `null`), y `guide.ts` no compara `"roadmap"` por su cuenta (guarda de fuente: el texto `=== "roadmap"` no aparece en `src/lib/guide.ts`). · cubre G-4 · prueba: `src/lib/guide.test.ts` (la guarda falla hoy)

### H-2: Como founder sin web ni documentos (o con la lectura fallida), quiero hacer mi diagnóstico GTM igualmente, para no quedarme sin arquetipo.
- **CA-3** `stepReachable(step, { readJobId, hasProposal, hasDiagnosis })`: `depth` y `sources` siempre; `reading` con `readJobId`; `diagnosis` siempre (con o sin fuentes, CA-4); `blocks` solo con `hasProposal`; `roadmap` solo con `hasDiagnosis`. Tabla de verdad completa en la prueba. `onboarding.tsx` usa `stepReachable` y no define su propia regla (guarda de fuente: no contiene `const reachable =`). · cubre G-4 · prueba: `src/lib/onboarding.test.ts` (falla hoy)
- **CA-4** En «Tus fuentes» hay un botón «Hacer solo el diagnóstico» que, sin lanzar ninguna lectura (no llama a la función que crea el trabajo `onboarding_read`), llama a `onSkip`, y la ruta guarda `step: "diagnosis"`. En «Nokko lee», si el trabajo terminó en `failed`, se ofrece el mismo botón. Además, en la barra de pasos, pulsar «4. Diagnóstico» sin propuesta está habilitado, guarda `step: "diagnosis"` y no lanza ninguna lectura. Los dos caminos se mantienen (§9). · cubre G-4 · prueba: `src/components/onboarding/sources.test.tsx` (caso nuevo; falla hoy), `src/components/onboarding/reading.test.tsx` (nuevo; falla hoy) y `src/routes/_authenticated/onboarding.test.tsx` (nuevo, con `useMe` y `useOnboarding` simulados; falla hoy: el botón está deshabilitado sin propuesta)
- **CA-5** Al usar el diagnóstico sin propuesta, se guarda `{ input, result }` y `step: "roadmap"` (el camino que ya escribe `onboarding.tsx:68`), y `onboardingDone` pasa a `true`. · cubre G-4 · prueba: `src/lib/onboarding.test.ts` (sobre `nextStepAfterDiagnosis(hasProposal)`, extraída de `onboarding.tsx:68`; falla hoy)

### H-3: Como Owner, quiero que el agente sepa qué sabe NOKKO de mi empresa y qué falta, para que el diagnóstico de plays parta de ahí y no me pregunte lo que ya contesté.
- **CA-6** `companyOnboardingStatus({ mine, companyDiagnosis, setup })` (pura) devuelve:
  - `mine`: `{ step, done }` con `done = onboardingDone(mine)`;
  - `diagnosis`: `null` o `{ archetype, name, motion, stage, nextStep }` leídos de `{ input, result }` con `jsonObject`; un jsonb mal formado da `null`, nunca lanza;
  - `strategy`: `{ positioning, icp, segments }` en booleano, tomados del `done` de los ítems de `setupStatus(setup)` con ese id (`src/lib/setup-schema.ts:50-55`, `:68-75`; definición en §3.1 hallazgo 12). No se reimplementa la regla: si cambia en `setup-schema.ts`, cambia aquí;
  - `missing`: lista en palabras, en este orden, de lo que falta: «Diagnóstico GTM sin hacer», «Posicionamiento sin completar», «ICP sin completar», «Segmentos sin rango de ACV»;
  - `ready: boolean` (opción B, decisión de Fede del 2026-11-11, §15.1; con B siempre se puede calcular, así que no hace falta `null`): `ready = diagnosis !== null && strategy.positioning && strategy.icp`. «Hacer solo el diagnóstico» (H-2) por sí solo **no** pone `ready` a `true`. Los segmentos salen en `missing` pero no bloquean. Tabla de verdad en la prueba: solo con los tres a `true` es `true`; con un diagnóstico mal formado (`diagnosis: null`) es `false` aunque posicionamiento e ICP estén completos; con 12 de los 13 campos de posicionamiento es `false`; con un ICP sin `anti_icp` y otro completo es `true`.
  - `companyOnboardingStatus` importa `SETUP_ITEMS`/`setupStatus` de `setup-schema.ts` y no repite los nombres de los 13 campos (guarda de fuente: `onboarding.ts` no contiene `"elevator_pitch"` ni `"anti_icp"`).
  · cubre G-4 y condición de G-1 · prueba: `src/lib/onboarding.test.ts` (falla hoy)
- **CA-7** `get_onboarding_status` es `kind: "read"`, sin `roles`, con entrada `z.object({})`. `executeTool(ctx, "get_onboarding_status", {})` devuelve el resultado de `companyOnboardingStatus` construido con: la fila de la persona (`onboarding_sessions` filtrado por `c.orgId` y `c.userId`, columnas `step,diagnosis` solamente), el diagnóstico de la empresa de `companyDiagnosisFor(c)` y `loadSetupData(c.db, c.orgId)`. `expectScoped(log)` pasa y no hay escrituras.
  `companyDiagnosisFor(c)`:
  1. Llama al RPC `company_diagnosis` con `_org: c.orgId`.
  2. Si devuelve `null` **o error**, aplica la misma regla en código: `onboarding_sessions` filtrado por `org_id = c.orgId` y `diagnosis` no nulo, con `select("user_id,diagnosis,updated_at")` y ninguna otra columna; primero la fila de `c.userId`, si no la de `updated_at` más reciente. Con el cliente de la persona la política solo devuelve su fila (equivale a `home-card.tsx:23`); con el cliente de servicio (Telegram, §3.1 hallazgo 13), todas las de la empresa, como manda `src/lib/AGENTS.md:7` para el código privilegiado.
  3. Solo si todo falla, `null`.
  Casos de prueba: (a) contexto de la persona con RPC que devuelve un diagnóstico → ese; (b) contexto privilegiado (doble sin `auth.uid()`: el RPC devuelve `null`) con la fila de un compañero con diagnóstico y la propia sin él → el del compañero; (c) RPC con error y fila propia con diagnóstico → el propio; (d) todo falla → `diagnosis: null` y «Diagnóstico GTM sin hacer» en `missing`. · cubre condición de G-1 · prueba: `src/lib/agent/tools/onboarding.test.ts` (nuevo; falla hoy)
- **CA-8** (privacidad) La salida de `get_onboarding_status` no contiene las claves `proposal`, `findings`, `opinions`, `sources`, `block_status` ni `read_job_id`, ni el ticket anual (`acv`) en ningún nivel; la consulta a `onboarding_sessions` no pide esas columnas (se comprueba el `select` registrado). El caso de prueba usa un diagnóstico ficticio con `input.acv: 12345` y comprueba que la salida serializada (`JSON.stringify`) no contiene `12345` ni `12.345`, así falla si un cambio futuro devuelve `discarded`, que escribe el ticket en texto (`gtm-diagnosis.ts:54-55`). Una lectura fallida nunca es un error de la herramienta: se aplica la caída de CA-7 y, si todo falla, `diagnosis: null` con su `missing`. · cubre condición de G-1 · prueba: `src/lib/agent/tools/onboarding.test.ts`
- **CA-9** `TITLES.get_onboarding_status` = «Ver el estado del onboarding»; la herramienta está una vez en el registro y en `.lovable/mcp/manifest.json` aparece una vez con ese `title` y `readOnlyHint: true`. Ejecutar `node node_modules/@lovable.dev/mcp-js/dist/cli/extract-manifest.cjs .` sobre el árbol entregado no deja diff, y las demás entradas del manifiesto (`jq` por `name`) son iguales en `6435439` y en el commit final. · prueba: `src/lib/agent/tools/onboarding.test.ts` (título, registro y manifiesto; falla hoy) y comandos del gate (extractor y `jq`)

### H-4: Como Owner o Sales Leader que dejó el onboarding a medias, quiero que NOKKO me lo recuerde, para terminarlo sin tener que acordarme.
- **CA-10** `onboardingStalled(snapshot)` devuelve, por cada fila de `snapshot.onboarding` con `step !== "roadmap"`, cuyo `user_id` sea miembro con rol `owner` o `sales_leader` en `snapshot.members` y con `inactive(updated_at, now)` (`setup-guide.ts:170`, más de 1 día): una sugerencia con `detector: "onboarding_stalled"`, `dedupe_key: "onboarding_stalled:<user_id>:<step>"`, `user_id` de esa persona, `link: "/onboarding"`, `action: null`, título y cuerpo del §9 según el paso. Sin `snapshot.onboarding` (campo ausente), sin `members` o con la fila de un miembro sin esos roles: ninguna. Una fila de hace menos de un día: ninguna. · cubre G-4 · prueba: `src/lib/proactive.test.ts` (casos nuevos; fallan hoy)
- **CA-11** El detector está registrado: `detect({ ...snapshot base, members: [{ user_id: "u-owner", role: "owner" }], onboarding: [{ user_id: "u-owner", step: "blocks", updated_at: <hace 2 días> }] })` devuelve una sugerencia con `detector: "onboarding_stalled"`. · cubre G-4 · prueba: `src/lib/proactive.test.ts` (falla hoy: no está en `DETECTORS`, `proactive/index.ts:36`).
  Guardas (hoy ya pasan, no son fail-first): `"onboarding_stalled"` en la lista «always-on» de `src/lib/plays/catalog.test.ts:82-94` (`detectorOwner` devuelve `undefined` para cualquier id fuera de un play, `catalog.ts:476-477`), y la salida de `detect(reference())` de `src/lib/plays/detect-gating.test.ts` no cambia (`reference()` no trae `onboarding`).
- **CA-12** `loadSnapshot` lee `onboarding_sessions` con `.select("user_id,step,updated_at").eq("org_id", orgId)` y lo pone en `snapshot.onboarding`; si la lectura falla, el campo no se incluye (ninguna sugerencia, como `play_states` en `org-data.ts:298-299`). · prueba: `src/lib/org-data-onboarding.test.ts` (nuevo, con el doble de base de datos de `src/lib/fit-key-sources.test.ts`; falla hoy)
- **CA-13** (el refresco de otro líder no cierra tu recordatorio) `syncSuggestions(db, orgId, found, touched, { onboardingSeen })`, donde `onboardingSeen` son los `user_id` de `snapshot.onboarding` (vacío si el campo falta):
  - las sugerencias `onboarding_stalled` quedan fuera del cierre genérico (lista de `org-data.ts:462-466`);
  - se cierran como `resolved` solo las abiertas de `onboarding_stalled` cuyo `user_id` está en `onboardingSeen` y cuya clave no está en `found` (su dueño terminó, avanzó en el último día o cambió de paso);
  - `onboarding_stalled` entra en `REOPENABLE` (`org-data.ts:378`), para que la misma clave vuelva si la persona se para otra vez en el mismo paso (una descartada sigue descartada).
  Con el `syncSuggestions` real y el doble de `src/lib/plays/pause-resume-suggestions.test.ts` (ampliado con `user_id`), y sugerencias ficticias:
  - (a) un sync **sin** la fila de la Owner en `onboardingSeen` (el refresco de la Sales Leader) **no** cierra el recordatorio de la Owner;
  - (b) un sync con su fila terminada (`step = "roadmap"`) **sí** lo cierra;
  - (c) un sync con su fila atascada en otro paso cierra la clave vieja y deja abierta la nueva;
  - (d) tras (b), si vuelve a pararse en el mismo paso, la sugerencia se reabre como `pending`.
  Los tres llamadores (`agent.functions.ts:249`, `tasks.server.ts:17`, `proactive.ts:80`) pasan `onboardingSeen`. · cubre G-4 · prueba: `src/lib/onboarding-stalled-sync.test.ts` (nuevo; (a) falla en cuanto el detector existe, como muestra la sonda del gate `probe-onboarding-stalled-close.test.ts`)

## 8. Casos límite y errores
- **Sin web, sin documentos o con lectura fallida:** «Hacer solo el diagnóstico» (CA-4); el ticket anual empieza en 0 porque no hay segmento propuesto (`onboarding.tsx:45-50`), y la persona lo escribe.
- **Diagnóstico sin fuentes (H-2):** la persona tiene arquetipo pero no propuesta, así que posicionamiento e ICP suelen estar vacíos y `ready` es `false` con «Posicionamiento sin completar» e «ICP sin completar» en `missing`; los completa en Estrategia (o con la guía «Configura tu estrategia»). H-2 sigue haciendo falta: sin arquetipo no hay `ready` nunca.
- **Lectura en marcha y la persona salta al diagnóstico:** el trabajo sigue y escribe `findings` y `proposal` en su fila (`onboarding.server.ts:32`, `:84`); `step` no cambia por el trabajo, así que la persona sigue donde estaba y «Aprobar» queda alcanzable cuando llegue la propuesta (CA-3). Sin conflicto de datos.
- **Dos miembros con diagnóstico distinto:** el estado de la empresa toma el tuyo y si no el más reciente (regla de `company_diagnosis`, sin cambios). `get_onboarding_status` lo dice tal cual; reconciliarlos es del SDD 4.
- **Contexto del agente con el cliente de servicio (Telegram):** `company_diagnosis` devuelve `null` siempre (§3.1 hallazgo 4). `companyDiagnosisFor` aplica la misma regla en código con ese cliente, así que un Sales Leader sin diagnóstico propio recibe por Telegram el de la empresa, igual que en la app (CA-7 b). MCP y la app usan el cliente de la persona y el RPC responde.
- **Snapshot con el cliente de la persona** (`agent.functions.ts:248`): la política solo devuelve su fila. Con el cliente de servicio (`proactive.ts:79`), todas las de la empresa. Cada sugerencia va a su dueño (`user_id`). Como Owner y Sales Leader ven las sugerencias del equipo (`0013`) y abrir Sugerencias lanza un sync con su propio cliente, ese sync no ve la fila del otro líder. Sin CA-13, el cierre genérico de `syncSuggestions` cerraría como `resolved` el recordatorio del otro, y no volvería nunca (§3.1 hallazgo 14; sonda del gate). Con CA-13 solo se cierra cuando la fila de su dueño se leyó y ya no está atascada.
- **Los líderes ven el recordatorio de otros líderes** (decisión del coordinador, 2026-11-11): la Owner verá «Retoma tu onboarding» de la Sales Leader y al revés, porque ya ven las sugerencias del equipo (`0013`). Es aceptable y no se filtra.
- **Invitados:** guardan `step: "roadmap"` al terminar (`onboarding.tsx:32`), así que no reciben recordatorio; si lo dejan a medias tampoco, porque CA-10 solo avisa a Owner y Sales Leader (el resto no ve el recorrido completo).
- **Persona que ocultó la tarjeta (`completed_at`) sin terminar:** sigue recibiendo el recordatorio (CA-1: ocultar no es terminar). Si molesta, la descarta en Sugerencias y la clave `onboarding_stalled:<user>:<step>` no vuelve hasta que cambie de paso.
- **Otra empresa (multitenant):** todas las lecturas filtran por `c.orgId` u `orgId`; la política de `onboarding_sessions` y `company_diagnosis` exigen ser miembro.

## 9. Experiencia y copy
Español, «tú», sin iconos, estados con palabra. Fede revisa los textos en la aprobación.
- Dos caminos al diagnóstico sin fuentes, y se mantienen los dos: el paso «4. Diagnóstico» de la barra (para quien ya sabe a dónde va) y el botón «Hacer solo el diagnóstico» (para quien no tiene fuentes y no se le ocurre saltar).
- Botón en «Tus fuentes» y en una lectura fallida: «Hacer solo el diagnóstico». Ayuda debajo: «Sin fuentes, Nokko no te propone ICP ni posicionamiento: los completas después en Estrategia.»
- Sugerencia `onboarding_stalled`, título: «Retoma tu onboarding». Cuerpo según el paso:
  - `depth` o `sources`: «Lo dejaste antes de elegir tus fuentes. Te quedan unos minutos.»
  - `reading`: «Nokko terminó de leer o sigue leyendo. Revisa lo que encontró.»
  - `diagnosis`: «Te falta el diagnóstico GTM: son cuatro respuestas.»
  - `blocks`: «Tu propuesta está lista. Aprueba o salta los bloques que quedan.»
- Herramienta, título MCP: «Ver el estado del onboarding». `description`: «Solo lee. Dice en qué paso del onboarding está la persona, el diagnóstico GTM de la empresa (arquetipo, motion, etapa y siguiente paso), qué piezas de la estrategia faltan y si hay lo mínimo para el diagnóstico de plays. No devuelve la propuesta ni los hallazgos.»
- Sin errores nuevos: un fallo de guardado pasa por `errorText` como hoy (`use-onboarding.ts:22`).

## 10. Datos, permisos y privacidad
- **Sin migración.** Por qué no hace falta: el diagnóstico de la empresa ya se comparte con `company_diagnosis` (0065) sin abrir la política por persona; el estado de la estrategia ya es de la empresa (`loadSetupData`); «terminado» por persona se deduce de `step`, que ya existe; el recordatorio lee tres columnas existentes. Una tabla de estado de onboarding por empresa duplicaría lo que GTM Lab SDD 3 va a guardar (perfil y pasos del proyecto principal).
- **Con la opción B (decisión de Fede) no hay migración.** La opción D, descartada, la habría necesitado en un SDD aparte (§15.1, nota).
- **Permisos:** sin cambios. Cada persona solo ve y escribe su sesión; el diagnóstico de la empresa lo ve cualquier miembro (ya hoy, en Inicio); `get_onboarding_status` no tiene `roles` porque solo devuelve lo que un miembro ya ve.
- **Privacidad:** la herramienta no devuelve propuesta, hallazgos, opiniones, fuentes ni el ticket anual (CA-8): pueden contener textos de los documentos de la empresa. Pruebas con datos ficticios.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| Ninguna | Reglas puras (`onboardingDone`, `stepReachable`, `companyOnboardingStatus`, `onboardingStalled`) | — | — |

`get_onboarding_status` es una herramienta más del registro; no añade llamadas. Tokens que suma al contexto del agente: sin dato.

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | `onboardingDone`, `stepReachable`, `nextStepAfterDiagnosis` en `onboarding.ts`; `guide.ts` y `onboarding.tsx` las usan | CA-1, CA-2, CA-3, CA-5 | `src/lib/onboarding.test.ts`, `src/lib/guide.test.ts` |
| U-2 | «Hacer solo el diagnóstico» en `SourcesStep` y en `ReadingStep` con trabajo fallido; barra de pasos con «Diagnóstico» alcanzable | CA-4 | `src/components/onboarding/sources.test.tsx`, `src/components/onboarding/reading.test.tsx`, `src/routes/_authenticated/onboarding.test.tsx` |
| U-3 | `companyOnboardingStatus`, `companyDiagnosisFor` y `get_onboarding_status` (`tools/onboarding.ts`, registro, `TITLES`, manifiesto por extractor); líneas en `AGENTS.md` y `src/lib/AGENTS.md` | CA-6, CA-7, CA-8, CA-9 | `src/lib/onboarding.test.ts`, `src/lib/agent/tools/onboarding.test.ts` |
| U-4 | `Snapshot.onboarding`, lectura en `loadSnapshot`, detector `onboardingStalled` en `DETECTORS` (y guarda «always-on»); `syncSuggestions` con cierre por dueño, `REOPENABLE` y `onboardingSeen` en los tres llamadores | CA-10, CA-11, CA-12, CA-13 | `src/lib/proactive.test.ts`, `src/lib/org-data-onboarding.test.ts`, `src/lib/onboarding-stalled-sync.test.ts` |

U-2 y U-3 dependen de U-1. U-4 es independiente. U-3 ya no espera: P-1 está decidida (opción B).

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- Firmas: `onboardingDone(s: { step: string | null } | null | undefined): boolean`; `stepReachable(step: Step, i: { readJobId: string | null; hasProposal: boolean; hasDiagnosis: boolean }): boolean`; `nextStepAfterDiagnosis(hasProposal: boolean): "blocks" | "roadmap"`; `companyOnboardingStatus({ mine, companyDiagnosis, setup }: { mine: { step: string | null; diagnosis: unknown } | null; companyDiagnosis: unknown; setup: SetupData })`. `Step` sale de `STEPS` (`onboarding.tsx:15`); para no importar una ruta desde `src/lib`, mover la lista de ids a `onboarding.ts` y dejar las etiquetas en la ruta.
- `companyOnboardingStatus` lee el diagnóstico con `jsonObject` (`src/lib/json.ts`), nunca con `as any`; recibe ya el resultado de `companyDiagnosisFor`.
- `companyDiagnosisFor` no necesita saber qué cliente tiene: la regla en código devuelve lo mismo que el RPC con cualquiera de los dos (con el de la persona, la política la reduce a su fila, que es la caída de `home-card.tsx:23`). Por eso no se añade un indicador «privilegiado» a `ToolCtx`.
- `syncSuggestions` recibe `onboardingSeen` como quinto parámetro opcional (`{ onboardingSeen?: string[] }`); sin él, ninguna sugerencia `onboarding_stalled` se cierra. Así un llamador que no lo pase nunca cierra el recordatorio de otro.
- La herramienta sigue el patrón de `src/lib/agent/tools/plays.ts` (`stateRows`, fallo = sin filas) y sus pruebas el de `plays.test.ts` (`expectScoped`, `writes(log)`, título y manifiesto).
- El detector reutiliza `inactive` e `INACTIVITY_MS` de `setup-guide.ts:162-172` (1 día, decisión de Fede del 2026-10-25); no define otro umbral.
- `Snapshot.onboarding?: { user_id: string; step: string; updated_at: string }[]` opcional, como `setupSnoozes` (`src/lib/proactive/types.ts:8-9`), para que las instantáneas antiguas sigan valiendo.
- Alternativas descartadas: (1) compartir la sesión entre miembros: rompe la política de 0052 y la clave única, y GTM Lab traerá el proyecto por empresa; (2) un `completed_at` «de verdad» con migración para separar «oculto» de «terminado»: `step` ya lo dice sin migrar; (3) añadir el diagnóstico a `companyContext`: lo leen todos los redactores en cada turno y el SDD 4 solo lo necesita bajo demanda.

## 14. Riesgos, dependencias y walkthrough
**Riesgos:**
- **Doble aviso:** a un Owner con el onboarding a medias le pueden llegar `onboarding_stalled` y `setup_incomplete` el mismo día. Son acciones distintas (recorrido y dato), pero si molesta, se decide después con datos de uso (§15, P-3).
- **Riesgo aceptado por Fede con la opción B (2026-11-11):** GTM Lab archivará la Estrategia actual y reescribirá posicionamiento e ICP desde el proyecto principal (`PRD-20261101` §6.1 «Datos existentes», A-6 y A-7). Entre el archivo y la primera publicación, `strategy.positioning` y `strategy.icp` pueden volver a `false` y `ready` pasar a `false` en empresas que ya lo tenían; el SDD 4 debe decirlo con palabras («falta…»), no fallar. A-7 prevé archivar solo cuando el proyecto principal tenga hechos los pasos que publica, lo que acorta ese hueco. Con B solo cambian la fórmula de `ready` y la tabla de verdad de CA-6; el resto del SDD es igual que con A.
- **Listón alto de posicionamiento:** «completo» exige los 13 campos (`setup-schema.ts:50-51`), no solo los cinco de Dunford. Es la regla vigente de la guía y del medidor, y se reutiliza tal cual; si en uso real bloquea demasiadas empresas, se cambia en `setup-schema.ts` con su propio ticket, no aquí.
- **Manifiesto en caché** de asistentes MCP: no verán la herramienta hasta refrescar; no rompe nada.

**Dependencias:** ninguna sin entregar. El SDD 4 depende de este (CA-6 a CA-9).

**Walkthrough** (`nokko-walkthrough`, móvil y escritorio, claro y oscuro, empresa y personas ficticias):
1. Owner nuevo en `/onboarding` → «Exprés» → en «Tus fuentes», «Hacer solo el diagnóstico» → paso «Diagnóstico» sin propuesta; responde y pulsa «Usar este diagnóstico» → «Tu roadmap». En la red, ninguna llamada que cree `onboarding_read`.
2. Inicio → «Primeros pasos» marca «Completa el onboarding» como hecho; la tarjeta de estrategia enseña el arquetipo.
3. Agente: «¿en qué punto está mi onboarding y qué falta para el diagnóstico de plays?» → responde con arquetipo, etapa, piezas que faltan y si está listo, sin citar textos de la propuesta.
4. Otro miembro (Sales Leader) sin diagnóstico propio pregunta lo mismo en la app y por Telegram → en los dos recibe el diagnóstico de la empresa.
5. Lectura con una URL inaccesible que haga fallar el trabajo → en «Nokko lee» aparece «Hacer solo el diagnóstico».
6. Sesión dejada en «blocks» con `updated_at` de hace más de un día (datos de prueba) → tras el ciclo de sugerencias, «Retoma tu onboarding» en Sugerencias de esa persona, con enlace a `/onboarding`. Un AE de la misma empresa no la ve. Otro líder (Sales Leader) sí la ve, como el resto de sugerencias del equipo (aceptado, §8), y abrir su Sugerencias **no** la cierra: sigue `pending` para la Owner.
7. Móvil por debajo de md: el botón nuevo sin desplazamiento lateral; la barra inferior no lo tapa.
8. Consola y red sin errores.

## 15. Preguntas para Fede y para la revisión técnica
**Decisiones del autor (para que Fede las confirme o cambie):**
- **D-1.** Sin migración (§10).
- **D-2.** «Terminado» = `step === "roadmap"`; `completed_at` sigue significando «tarjeta oculta» y no se toca (§3.1 hallazgo 1).
- **D-3.** CA-7 del ticket original (roadmap con estado y niveles) se da por obsoleto: lo cubre el tablero de GTM Lab.
- **D-4.** El recordatorio va solo a Sugerencias, con el umbral de 1 día ya decidido; Telegram sigue sus reglas actuales para avisos, sin cambios.
- **D-5.** El recordatorio no se envía a invitados ni a roles distintos de Owner y Sales Leader.

**Decisiones de Fede (2026-11-11, transmitidas por el coordinador):**
- **P-1. Sustituto de NK-0028 = opción B:** «A + posicionamiento e ICP»: el diagnóstico de plays necesita el diagnóstico GTM de la empresa (`company_diagnosis`) MÁS posicionamiento e ICP completos antes de proponer equipos. Recoge el riesgo aceptado (§14). Aplicado en CA-6 y §15.1.
- **P-2. Sí:** «close NK-0009 with this SDD, no separate “épica de encaje de personas”». NK-0009 se cierra con este SDD; lo que el §3.2 marca como hecho u obsoleto no genera tickets nuevos.

**Pregunta abierta para Fede:**
- **P-3** (puede esperar a la entrega): si te molesta el doble aviso (`onboarding_stalled` y `setup_incomplete`), ¿silenciamos uno mientras el otro esté abierto?

**Para la revisión técnica:** resuelta en la pasada 1 (Telegram usa el cliente de servicio y MCP el de la persona; §3.1 hallazgo 13).

### 15.1 Sustituto de NK-0028 (decidido por Fede el 2026-11-11: opción B)
NK-0028 (contexto por bloques con nivel de confianza) está REJECTED en el ledger desde el 2026-11-10: lo sustituyen «el perfil y los pasos obligatorios del proyecto principal» de GTM Lab (`PRD-20261101` §6.2 fila 2). Ese sustituto aún no existe: no hay tablas `gtm_lab_*` ni pantalla (§3.1 hallazgo 10). El diagnóstico de plays (SDD 4) necesita un mínimo antes de proponer equipos; esto es lo que NK-0028 iba a dar y dónde está hoy:

| Dato que cubría NK-0028 (`SDD-20261030-…-2-context-onboarding.md` §10) | Dónde está hoy | ¿Lo necesita el SDD 4? |
|---|---|---|
| Modelo de negocio y etapa | Diagnóstico GTM (`input.model`, `input.stage`), por persona y compartido por `company_diagnosis` | Sí: el arquetipo y el `motion` ordenan qué equipos tienen sentido (p. ej. «Entrantes y producto» en PLG) |
| Precio de referencia y datos de partida (clientes, MRR) | Ticket anual en el diagnóstico; clientes y MRR, sin sitio (Stripe solo da churn de empresa) | No para proponer equipos |
| Capacidad (horas por semana) | Sin sitio (era del control tower 1b) | Quizá, para no proponer más equipos de los que se pueden atender; sin decidir |
| Anti-ICP y límites de plataforma | Anti-ICP en el ítem «icp» de Estrategia; límites de LinkedIn como regla de producto | No |
| Público con nivel de evidencia | Sin sitio (control tower 1a) | No |
| Alternativa competitiva | `positioning.alternatives` / `competitive_alternative` | No para proponer equipos |
| Perfil de GTM Lab (producto, problema, clientes posibles, alternativas, diferencial, evidencia, objetivo a 12 meses) | Solo como código (`framework.yaml:7-17`), sin datos por empresa | Daría contexto a las preguntas del SDD 4; no es imprescindible |

**Opciones que se presentaron a Fede:** A (solo el diagnóstico GTM), **B (A más posicionamiento e ICP completos, elegida)**, C (perfil y pasos obligatorios del proyecto principal de GTM Lab) y D (perfil propio con migración).

*Nota sobre C y D (no aplican; Fede eligió B):* con C, `ready` no se podría calcular hasta que existan las tablas `gtm_lab_*` y tendría que ser `null` («sin dato»), nunca `false`, y el SDD 4 esperaría. Con D, la migración iría en otro SDD, con vuelta atrás, comprobación previa, número en el journal y prueba de RLS con dos empresas; este SDD solo leería ese perfil. Pasar de B a C cuando exista el proyecto principal será su propio SDD: solo cambiaría `companyOnboardingStatus`.

**Decisión de Fede (P-1, 2026-11-11):** opción **B**, «A + posicionamiento e ICP»: el diagnóstico de plays necesita el diagnóstico GTM de la empresa (`company_diagnosis`) más posicionamiento e ICP completos, con «completo» definido por `setup-schema.ts:50-53` (§3.1 hallazgo 12). Sin migración. Riesgo aceptado: GTM Lab puede archivar y reescribir posicionamiento e ICP más adelante (§14). Pasar a C cuando exista el proyecto principal queda para entonces, con su propio SDD.

## 16. Pendiente de verificar
- [Por verificar, gate] CA-9: el extractor no deja diff y las demás entradas del manifiesto no cambian.
- [Por verificar, walkthrough] Que el recordatorio llega a su dueño, que un AE no lo ve y que el refresco de otro líder no lo cierra (paso 6).
- [Por verificar, walkthrough] Telegram con el cliente de servicio devuelve el diagnóstico de la empresa (paso 4).
- [Por verificar] Diferencias entre `production` y `main` en el onboarding: este análisis solo leyó `main`.

**Lo que NO se afirma:**
- No se afirma cuántas empresas abandonan el onboarding ni en qué paso: sin dato.
- No se afirma que la opción B baste para un buen diagnóstico de plays: es la decisión de Fede, no un resultado medido.
- No se afirma cuántas empresas cumplen hoy `ready` (diagnóstico más los 13 campos de posicionamiento y un ICP completo): sin dato.
- No se afirma que el onboarding esté «completo» en contenido: los bloques y lo que escriben quedan como están hasta GTM Lab.
- No se afirma que los 7 criterios marcados «Hecho» en el §3.2 funcionen en producción: se leyó el código de `main`, no se ejecutó nada.
- No se afirma el coste en tokens de la herramienta nueva: sin dato.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Un agente `nokko-gate` con contexto fresco lee este SDD y el código, y devuelve su informe. El coordinador lo copia aquí sin editarlo. El gate no aprueba el SDD: informa; la aprobación es de Fede.
- Veredicto del gate: pasada 1, CAMBIOS (1 bloqueante, 3 mayores, 4 menores; revisó `64893a9`, antes de la decisión B de Fede en `812f83c`). Resueltos en el texto (tabla de abajo). Pasada 2: pendiente.
- CA sin prueba posible o sin G-n: CA-11 no fallaba primero (G-M1, resuelto).
- [Por verificar] que sigue sin comprobarse: el comportamiento real de Telegram y la RLS real de `suggestions` (el gate se basó en `0013` del repo).
- Contradicciones con el código o con decisiones previas: CA-7 frente a CA-8 en la caída del RPC (G-M2, resuelto).
- Lo que esta revisión NO demuestra: no se ejecutaron `gate.mjs` ni `flake.mjs` (el diff es solo documento); el detector no existe, así que la sonda de G-B1 usa una sugerencia con ese `detector` y el `syncSuggestions` real; pantalla en móvil sin ver.

### §17 Gate · pasada 1: hallazgos y resolución
Informe: `.factory/evidence/sprint7-sdd-gate/gate-pass1.md` (2026-11-11, HEAD `64893a9`). Todas las citas `archivo:línea` comprobadas correctas en `6435439`; los 9 archivos de test citados pasan en la base (154 tests); el extractor no deja diff en la base.

| Hallazgo | Resolución |
|---|---|
| **BLOQUEANTE G-B1** El sync de un líder (su cliente solo lee su fila) cerraba para siempre el recordatorio de otro: cierre genérico de `syncSuggestions` y sin `REOPENABLE` (sonda `probe-onboarding-stalled-close.test.ts`) | CA-13 nuevo: `onboarding_stalled` fuera del cierre genérico; cierre explícito solo si la fila del dueño se leyó (`onboardingSeen`, por `user_id`) y ya no está atascada; `onboarding_stalled` en `REOPENABLE`; prueba con el `syncSuggestions` real y el doble de `pause-resume-suggestions.test.ts`, casos (a) a (d). §3.1 hallazgo 14, §5, §8, §13, U-4 y walkthrough paso 6. |
| **MAYOR G-M1** CA-11 pasaba hoy y nada probaba que el detector estuviera en `DETECTORS` | CA-11 pasa a `detect()` con una fila atascada que debe devolver `onboarding_stalled` (falla hoy). La lista «always-on» y `detect(reference())` quedan rotuladas como guardas. |
| **MAYOR G-M2** Por Telegram (cliente de servicio) el RPC devuelve `null` y la herramienta decía «sin hacer»; CA-7 y CA-8 se contradecían ante un error del RPC | `companyDiagnosisFor(c)`: RPC y, ante `null` **o error**, la misma regla en código (`select("user_id,diagnosis,updated_at")`, filtrado por empresa, la propia primero, si no la más reciente); solo si todo falla, `null`. Casos (a) a (d) en CA-7, incluido el contexto privilegiado. Hecho vivo (coordinador, 2026-11-11): `service_role` tiene `EXECUTE` y el RPC devuelve `null` con él (§3.1 hallazgo 4). Quitado el riesgo «sin aplicar en producción» y el [Por verificar] del cliente por canal (§3.1 hallazgo 13). |
| **MAYOR G-M3** `ready` no aguantaba las opciones C y D | Fede eligió B (2026-11-11): `ready: boolean`, que con B siempre se puede calcular. Se dice explícitamente que con B solo cambian la fórmula de `ready` y la tabla de CA-6, y que «Hacer solo el diagnóstico» por sí solo no pone `ready` a `true`. C y D pasan a una nota en §15.1; el diseño de migración de D se retira del §10. |
| **MENOR G-m1** CA-8 solo miraba claves | CA-8 usa `input.acv: 12345` y comprueba que la salida serializada no contiene `12345` ni `12.345`. |
| **MENOR G-m2** Los líderes ven el recordatorio de otros líderes | Decisión del coordinador (2026-11-11): aceptable, porque ya ven las sugerencias del equipo. Dicho en §8; el paso 6 del walkthrough anota qué ve otro líder y que su refresco no lo cierra. |
| **MENOR G-m3** Actualizar §16 y §3.1 hallazgo 4 con el hecho vivo | Hecho: 0065 aplicada, función `SECURITY DEFINER`, `EXECUTE` para `authenticated` y `service_role`, no para `anon`. |
| **MENOR G-m4** «Diagnóstico» alcanzable también desde la barra | CA-4 comprueba además que pulsar «4. Diagnóstico» sin propuesta guarda el paso y no lanza la lectura (`src/routes/_authenticated/onboarding.test.tsx`). §9 decide mantener los dos caminos. |

## 18. Delta de implementación (lo rellena el agente al entregar)
Sin entrega todavía.
