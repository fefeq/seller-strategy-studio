# SDD-20261112-diagnosis-in-chat · [Feature] Diagnóstico de plays en el asistente: equipos priorizados, reglas base y voz

**Tipo:** Feature (sin migración) · **Prioridad propuesta:** Media (es el SDD que cierra G-1 de la iniciativa; reutiliza los SDD 1, 2 y 3 y NK-0009, todos en `main`)
**Estado:** Borrador · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-11-12
**Ticket:** NK-0153 (iniciativa NK-0126, SDD 4)
**PRD:** `docs/prd/PRD-20261110-diagnostico-y-equipos-de-plays.md` §8 fila 4 (cubre G-1, G-4 y G-5; mantiene G-2 y G-3) · **Depende de:** `SDD-20261110-plays-phase-autonomy-deps.md` (NK-0127, Hecho), `SDD-20261110-play-teams.md` (NK-0140, Hecho), `SDD-20261110-company-voice-and-escalation-rules.md` (NK-0128, Hecho) y `SDD-20261111-onboarding-complete.md` (NK-0009, Hecho; sustituto de NK-0028 = opción B) · **Coordina con:** SDD 5 de la iniciativa (`diagnosis-guided-wizard`, sin redactar), que reutilizará la función pura de este SDD con una pantalla

> Un SDD dice cómo se verifica que está bien hecho. Cada criterio de aceptación (CA-n) tiene una prueba automática que lo nombra.
> Nivel elegido: SDD completo bajo un PRD de iniciativa aprobado (fila 4 del §8). Es una feature con herramientas nuevas del agente, una escritura confirmable y una regla de priorización; un SDD corto dejaría sin fijar la regla, el contrato MCP y la medida de G-1.
> Números de línea comprobados en `main` @ `7fe9aed` (rama `docs/sprint8-sdd-diagnosis-in-chat`, sin cambios en `src/`), el 2026-11-12.

## 1. Resumen
El Owner o el Sales Leader abre el asistente desde «Equipos de plays» con «Hacer el diagnóstico de plays». El asistente comprueba primero si la empresa está lista (`get_onboarding_status`: diagnóstico GTM + posicionamiento + ICP completos); si no lo está, dice qué falta con las palabras de esa herramienta y no propone nada. Si lo está, hace dos preguntas (cuello de botella y qué otras tareas quieres resolver), y una **función pura** ordena los seis equipos de plays con motivos fijos; el modelo solo los redacta. Al final propone dos acciones confirmables: guardar el plan como **sugerencias** en Sugerencias (una por play a activar, cada una con la acción `set_play_enabled`, que solo se ejecuta si la apruebas) y añadir las reglas base que falten. La voz no se pega en el chat: el asistente dice cuántos ejemplos hay y enlaza a Conocimiento › Voz (§15, P-1). Sin migración y sin llamadas de IA nuevas.

## 2. Problema y para quién
Owner y Sales Leader (decisión 16 del PRD) ven seis equipos de plays en `/plays?vista=equipos`, siempre en el mismo orden, sin saber cuál toca a su empresa. El PRD pide que NOKKO, tras unas preguntas, proponga equipos ordenados con el motivo de cada uno, con reglas y voz puestas, sin activar nada solo (decisiones 1, 5, 8, 10 y 20).

## 3. Evidencia y por qué ahora
**Lo que ya existe (leído en `main` @ `7fe9aed`):**
1. **Estado de la empresa.** `src/lib/onboarding.ts:277` `companyOnboardingStatus` devuelve `diagnosis` (`archetype`, `name`, `motion`, `stage`, `nextStep`), `strategy`, `missing` en palabras y `ready` (`:304`: `diagnosis !== null && strategy.positioning && strategy.icp`, opción B de Fede, 2026-11-11). La herramienta `get_onboarding_status` (`src/lib/agent/tools/onboarding.ts:52-68`) la construye con `myRow` (`:42`), `companyDiagnosisFor` (`:15`) y `loadSetupData`; nunca devuelve propuesta, hallazgos ni ticket.
2. **Equipos y orden.** `src/lib/plays/teams.ts:18-55` `PLAY_TEAMS` (seis equipos con ids fijos); `:99-132` `teamPlan(team, catalog, rows)` da `steps` (recomendables, numerados, en el orden de `recommendablePlays`) y `unavailable` con motivo, y describe cada play con su `enabled`; `:135-141` palabras de la vista. `src/lib/plays/recommend.ts:12` `recommendablePlays` ordena por fase y dependencias y nunca recomienda un play bloqueado, planificado o que dependa de uno (G-3).
3. **Fases.** `src/lib/plays/catalog.ts:44` `PHASES` (fundación, captura, generación, orquestación); `src/lib/plays/view.ts:32-37` `PHASE_WORD`. `catalog.ts:80`: `defaultEnabled` es `true` para los plays que ya tienen detectores.
4. **Plan real sin filas de `play_states`** (ejecutado con `teamPlan` sobre el catálogo real, 2026-11-12): «Reuniones» tiene sus dos pasos ya activados por defecto; «Reactivar perdidos» y «Señales de cuenta» empiezan los dos por `signals-in-crm-with-decay` (no activado); «Priorizar cuentas y limpiar CRM» empieza por `hubspot-account-tiering-scoring` (fundación, no activado); «Aprender de llamadas» tiene un paso (`call-transcript-signal-extraction`) y `pain-qualified-segments` no disponible; en «Entrantes y producto» solo `product-sign-up-outreach` está sin activar.
5. **Herramientas de plays.** `src/lib/agent/tools/plays.ts:12-18` `stateRows` (lectura filtrada por `c.orgId`; un fallo = sin filas), `:48-58` `list_play_teams`, `:59-72` `set_play_enabled` (escritura, `owner` y `sales_leader`, vía `togglePlay`, que ya comprueba rol y bloqueo).
6. **El agente.** `src/lib/agent/agent.server.ts:33` `AgentMode = "chat" | "interview"`, y la columna `agent_conversations.mode` tiene `check (mode in ('chat','interview'))` (`drizzle/migrations/0007_agent_proactive_channels.sql:29`): un modo nuevo pide migración. En cambio, un **flujo** (`workflowId`) no se guarda en base de datos: `personaPrompt` (`agent.server.ts:42-51`) añade «FLUJO ACTIVO: <label>. <instructions>» desde `src/lib/bmad/workflows.ts:24-58` (`WORKFLOWS`, `getWorkflow` en `:60`), y la app lo envía en cada turno (`src/lib/agent.functions.ts:44-104`; `src/components/agent.tsx:28` `OpenOpts.workflowId`). Precedente de abrir el asistente desde una tarjeta: `src/components/onboarding/home-card.tsx:37`. La prueba de flujos (`src/lib/bmad.test.ts:69-70`) solo exige que los menús de personajes apunten a flujos existentes.
7. **Reglas del agente en cada turno.** `agent.server.ts:68` «nunca inventes cifras ni ids»; `:69` las escrituras quedan como propuesta; `:114-126` reglas del equipo (incluidas las «Escalar» de NK-0128) en cada turno y modo; `:219-243` una herramienta `read` se ejecuta, una `write` solo crea una fila en `agent_pending_actions`.
8. **Aprobar.** `src/lib/agent.functions.ts:117-161` `decidePending` ejecuta la acción confirmada con `executeTool` (`:143`) y añade `mensaje` a «Hecho: …»; `src/lib/agent/tools.ts:57-59` `canUseTool` y `:66-72` `executeTool` comprueban el rol. Por MCP, una escritura crea `agent_pending_actions` con `source 'mcp'` que se confirma en Sugerencias (`src/lib/AGENTS.md`, párrafo de asistentes externos).
9. **Sugerencias con acción.** `decideSuggestionCore` (`src/lib/agent.functions.ts:279`, permiso en `:293`) reclama la sugerencia y ejecuta su `action` (`{ tool, args }`) con `executeTool` (`:370`); si falla, vuelve a `pending`. Forma de acción: `src/lib/proactive/detectors/late-leads.ts:25`. Visibilidad: cada persona ve las suyas y las sin dueño; Owner y Sales Leader, las del equipo (`drizzle/migrations/0013*.sql`, políticas «org read» y «org update»). `syncSuggestions` (`src/lib/org-data.ts:390`) cierra cualquier sugerencia abierta que ningún detector vuelva a emitir, salvo la lista de `:470` (`weekly_report`, `setup_question`, …, `onboarding_stalled`), que son sugerencias que no salen de detectores. Telegram solo avisa de prioridad 1 (`src/routes/api/public/jobs/proactive.ts:209`).
10. **Reglas base.** `src/lib/default-rules.ts:12-49` las nueve reglas (tres Nunca, tres Siempre, tres Escalar) aprobadas en NK-0128; `:107` `addDefaultRulesCore` (comprueba rol en `:113`, compara títulos solo en Reglas, una lectura fallida no inserta nada, a prueba de carreras con 0085); `:75` `readTitles` es privada. Solo la usa la pantalla (`src/lib/default-rules.functions.ts:10`); **ninguna herramienta del agente** escribe Reglas ni Voz (`grep` de `name: "` en `src/lib/agent/tools/`).
11. **Voz.** `src/lib/knowledge-voice.ts:10` `VOICE_MAX_EXAMPLES = 3`; `:49` `loadVoice` (devuelve `ok: false` si falla, nunca «sin voz»). Escriben Voz solo Owner y Sales Leader (`src/lib/knowledge-rules.ts:45-58`, migración `0084_knowledge_voice_writers.sql`), cuya cabecera dice: «no code path writes voice with it (Drive and the agent lists refuse the section)». La guarda de NK-0128 CA-3 está en `src/lib/agent-tools.test.ts:1647-1673`. Conocimiento abre una sección con `?seccion=` (`src/routes/_authenticated/hub.tsx:9-15`; `voice` y `rules` en `src/lib/screen-sections.ts:4-13`).
12. **Lo que el chat guarda.** Cada mensaje del usuario se guarda tal cual en `agent_messages` (`agent.server.ts:110-112`) y, si tiene 40 caracteres o más, `learnFrom` lo pasa a una extracción de memoria con IA (`agent.server.ts:169-172`; `src/lib/memory.server.ts:144`). Pegar tres mensajes reales en el chat los dejaría en el historial y podría convertirlos en memorias (base de P-1).
13. **G-5, segunda parte.** NK-0128 §4 dejó para este SDD «borradores que leen la voz», porque `play_runs` solo guarda ids (columnas en `src/integrations/supabase/types.ts`, tabla `play_runs`: `play_id`, `subject_id`, `subject_table`, `outcome`, `gate_key`, `drop_reason`). Medirlo pide guardar qué contexto usó cada borrador: columna o tabla nueva (P-3).

**Uso real:** sin dato (no hay diagnósticos de plays; no hay eventos de conversación).

**Por qué ahora:** los SDD 1, 2 y 3 y NK-0009 están entregados (`.factory/ledger.json`: NK-0127, NK-0140, NK-0128 y NK-0009 SHIPPED). Es el último paso para que G-1 sea medible.

## 4. Resultado buscado
- **G-1** (diagnósticos terminados con al menos un equipo propuesto). **Definición:** un diagnóstico está terminado con equipo propuesto cuando una persona confirma `save_play_plan` y se escribe al menos una sugerencia `detector = 'plays_diagnosis'`. **Fuente:** tabla `suggestions`. **Consulta** (solo lectura, por periodo): `select count(distinct org_id) from suggestions where detector = 'plays_diagnosis' and created_at >= :desde`. **Indicadores de apoyo:** propuestas guardadas frente a canceladas, `agent_pending_actions where tool = 'save_play_plan'` agrupado por `status` (`pending`, `confirmed`, `cancelled`, `failed`); plays activados desde el diagnóstico, sugerencias `plays_diagnosis` con `status = 'approved'`. **Línea base:** 0 por construcción (ningún código escribe hoy ese `detector`; `grep` en `src/`); que no haya filas manuales en la base real queda **[Por verificar]** con una consulta de solo lectura. Diagnósticos empezados y no terminados: sin dato (las lecturas no se registran; no se instrumenta aquí).
- **G-4** (empresas con reglas base): el diagnóstico propone `add_default_rules` cuando faltan reglas base. Fuente: `knowledge_docs` (sección `rules`, títulos de `defaultRules()` comparados con `normalizeRuleTitle`). Línea base: sin dato **[Por verificar]**, consulta de solo lectura.
- **G-5** (voz): primera parte, empresas con tres ejemplos de voz (`knowledge_docs`, sección `voice`, `scope = 'team'`); el diagnóstico la comprueba y enlaza a Conocimiento › Voz. Línea base: sin dato **[Por verificar]**. Segunda parte («borradores que la leen»): **no se mide en este SDD** (§3 hallazgo 13; P-3).
- **G-2 y G-3** se mantienen: el diagnóstico no activa nada (las acciones son sugerencias y propuestas confirmables) y nunca propone un play que `recommendablePlays` excluye (CA-2, CA-11).

## 5. Alcance
**Incluye:**
- `src/lib/plays/diagnosis.ts` (nuevo, puro): `DiagnosisAnswers`, `MAX_PROPOSED_TEAMS`, `BOTTLENECK_WORD`, `prioritizeTeams`, `activationPlan` y `diagnosisSummary` (palabras fijas del §9).
- `src/lib/agent/tools/play-diagnosis.ts` (nuevo): `diagnose_play_teams` (lectura), `save_play_plan` (escritura, Owner y Sales Leader) y `add_default_rules` (escritura, Owner y Sales Leader), registrados en `src/lib/agent/tools.ts` después de `ONBOARDING_TOOLS`.
- `src/lib/agent/tools/onboarding.ts`: extraer `onboardingStatusFor(c)` (lo que hoy hace `run` en `:59-66`) para que `get_onboarding_status` y `diagnose_play_teams` usen la misma lectura; `get_onboarding_status` no cambia de salida.
- `src/lib/default-rules.ts`: exportar `missingDefaultRuleTitles(c)` sobre `readTitles` (misma lectura; lanza el mismo error), sin cambiar `addDefaultRulesCore`.
- `src/lib/org-data.ts:470`: añadir `plays_diagnosis` a la lista de sugerencias que no salen de detectores, para que la sincronización no las cierre.
- `src/lib/bmad/workflows.ts`: flujo `plays_diagnosis` con las instrucciones del §9 (sin personaje ni menú).
- `src/components/plays/play-teams-panel.tsx`: botón «Hacer el diagnóstico de plays» para Owner y Sales Leader, que abre el asistente con ese flujo.
- Títulos en `TITLES` (`src/lib/mcp/tools/agent-tools.ts`), manifiesto regenerado con el extractor, una línea en `src/lib/AGENTS.md` (párrafo de Plays GTM) y la consulta de G-1 en ese mismo párrafo.

**No incluye** (el brief lo copia a «Movimientos prohibidos»):
- Migraciones, tablas, columnas, políticas, funciones SQL o GRANTs. Un modo nuevo de agente (`agent_conversations.mode` tiene `check`, `0007:29`).
- Escribir Voz desde el agente, Telegram o MCP; recibir mensajes de voz en el chat (P-1); cambiar la guarda `agent-tools.test.ts:1647-1673` o la cabecera de 0084.
- Activar o pausar plays en bloque, o activar nada al guardar el plan: `save_play_plan` no llama a `togglePlay`, `setPlayEnabled` ni `set_play_enabled`.
- Cambiar `CATALOG`, `PLAY_TEAMS`, `teamPlan`, `recommendablePlays`, `effectiveState`, `checkToggle`, `describePlay`, `companyOnboardingStatus` (su salida) o `addDefaultRulesCore` (su comportamiento).
- Cambiar `list_plays`, `get_play`, `list_play_teams`, `set_play_enabled` o `get_onboarding_status` (entrada, salida o descripción) ni sus entradas del manifiesto.
- Medir «borradores que leen la voz» (G-5, segunda parte; P-3).
- Pantalla nueva o asistente guiado (SDD 5); guardar el diagnóstico por empresa en una tabla; reordenar la vista «Equipos de plays».
- Horas, dinero, puntuaciones o cualquier cifra que no salga de los datos (decisión 3).
- Llamadas de IA nuevas fuera del bucle del agente.
- Cambiar cómo `syncSuggestions` trata a cualquier otro `detector`.
- Usar «agente» para un equipo de plays (decisión 14); editar `.lovable/mcp/manifest.json` a mano.

## 6. Cambios de comportamiento (delta)
**Añadido:** regla pura de priorización; herramientas `diagnose_play_teams`, `save_play_plan` y `add_default_rules` (app, Telegram y MCP); flujo `plays_diagnosis`; botón «Hacer el diagnóstico de plays»; sugerencias `plays_diagnosis` con acción `set_play_enabled`.
**Modificado:** `get_onboarding_status` lee a través de `onboardingStatusFor` (misma salida); `syncSuggestions` deja abiertas las sugerencias `plays_diagnosis` como ya hace con `onboarding_stalled`.
**Eliminado:** nada.

## 7. Historias y criterios de aceptación
### H-1: Como Owner o Sales Leader, quiero que NOKKO ordene los equipos de plays para mi empresa con un motivo, para saber por cuál empezar sin que nadie invente.
- **CA-1** (no lista, no propone) `prioritizeTeams({ status, plans, answers })` con `status.ready === false` devuelve exactamente `{ ready: false, missing: status.missing }`: sin `proposed`, `later`, `alreadyActive`, `notAvailable` ni `activation`. `diagnosisSummary` de ese resultado es «Todavía no puedo proponerte equipos de plays. Falta: <missing unidos por «; »>.» seguido de los enlaces del §9; no contiene ningún título de equipo ni de play · cubre G-1 · prueba: `src/lib/plays/diagnosis.test.ts` (nuevo; falla hoy: el módulo no existe)
- **CA-2** (solo lo recomendable) Un equipo sin `steps` va a `notAvailable` con el motivo «Ningún play disponible todavía: <reason del primer `unavailable`>.», también si es el cuello de botella o lo pediste. `proposed[].next` y `activation[].play_id` solo contienen ids de `plan.steps`; con un catálogo de prueba, un play `bloqueado`, uno `planificado` y uno que depende de un `planificado` nunca aparecen en `proposed` ni en `activation`. La función no define motivos de disponibilidad propios: los copia de `teamPlan` · cubre G-3 · prueba: `src/lib/plays/diagnosis.test.ts`
- **CA-3** (orden determinista) Los equipos con algún paso sin activar se ordenan por esta clave, en este orden: (1) es el cuello de botella; (2) está en `wanted`; (3) encaja con el arquetipo (solo `entrantes-y-producto` cuando `status.diagnosis.motion === "plg"`); (4) índice en `PHASES` de la fase de `next` (el primer paso con `enabled === false`); (5) índice en `PLAY_TEAMS`. `entrantes-y-producto` con `motion !== "plg"` que no es cuello de botella ni está en `wanted` va a `later` con «No es lo habitual para tu arquetipo (<name>); dímelo si lo quieres.». El resultado es igual con `wanted` en cualquier orden y con duplicados, y dos llamadas con la misma entrada dan resultados iguales (`toEqual`). Sobre el catálogo real y sin filas, los tres escenarios del §13 dan exactamente sus tablas · cubre G-1 · prueba: `src/lib/plays/diagnosis.test.ts`
- **CA-4** (límite) `proposed` tiene como mucho `MAX_PROPOSED_TEAMS` (3) equipos, con `rank` desde 1; el resto de candidatos va a `later`, en el mismo orden, con «Lo dejamos para después: como mucho 3 equipos de plays a la vez.» · cubre G-1 · prueba: `src/lib/plays/diagnosis.test.ts`
- **CA-5** (ya activo) Un equipo con todos sus `steps` en `enabled` va a `alreadyActive` con «Todos sus plays disponibles ya están activados.» y nunca a `proposed`; si además es el cuello de botella, el motivo es «Es tu cuello de botella, pero todos sus plays disponibles ya están activados.». Sin filas, «Reuniones» está en `alreadyActive` (§3 hallazgo 4) · cubre G-1, G-2 · prueba: `src/lib/plays/diagnosis.test.ts`
- **CA-6** (plan de activación) `activation` recorre `proposed` por `rank` y, dentro de cada equipo, sus `steps` por `n`, toma los de `enabled === false`, sin repetir un play; cada entrada es `{ n, play_id, title, teams }`, con `n` desde 1 y `teams` = títulos de todos los equipos propuestos que tienen ese play entre sus pasos. En el escenario A del §13, `signals-in-crm-with-decay` sale una vez con `teams` = «Reactivar perdidos» y «Señales de cuenta» · cubre G-1 · prueba: `src/lib/plays/diagnosis.test.ts`
- **CA-7** (motivos fijos, sin E/S) Cada `proposed[].reasons` se compone solo de las frases del §9 (cuello de botella, elegido, encaje, «Empieza por «<play>», de la fase <PHASE_WORD>.» y «Activar «<play>» también avanza «<equipo>».»); ningún motivo contiene otra cifra que el número de paso. `diagnosis.ts` no importa el cliente de Supabase, `ai-gateway`, `agent.server`, `toggle.ts` ni ninguna función de servidor (guarda de fuente, como `recommend.test.ts`) · cubre G-1, G-2 · prueba: `src/lib/plays/diagnosis.test.ts`

### H-2: Como Owner o Sales Leader, quiero que el asistente lea qué tiene mi empresa antes de preguntarme, y que me diga lo que falta con palabras.
- **CA-8** (herramienta de lectura) `diagnose_play_teams` es `kind: "read"`, sin `roles`, con entrada `{ bottleneck: <id de PLAY_TEAMS> | null, wanted: <ids de PLAY_TEAMS>[] (máx. 6, por defecto []) }`; un id que no existe lo rechaza el esquema. `executeTool` devuelve `{ ...prioritizeTeams(…), voz, reglas_base, resumen }`, construido con `onboardingStatusFor(c)`, `teamPlan` de cada equipo con `stateRows(c)`, `loadVoice(c)` y `missingDefaultRuleTitles(c)`:
  - `voz` = `{ ok: true, ejemplos: n, faltan: max(0, 3 - n) }` o, si la lectura falla, `{ ok: false }` y `resumen` dice «No he podido comprobar la voz de tu empresa.» (nunca «0 ejemplos»);
  - `reglas_base` = `{ ok: true, faltan: [títulos de defaultRules() que la empresa no tiene] }` o `{ ok: false }` con «No he podido comprobar tus reglas.» en `resumen`;
  - `resumen` = `diagnosisSummary(…)`, el texto del §9.
  `expectScoped(log)` pasa y no hay escrituras (`writes(log)` vacío). Una lectura fallida de `play_states` da los valores por defecto, como `list_play_teams` · cubre G-1, G-4, G-5 · prueba: `src/lib/agent/tools/play-diagnosis.test.ts` (nuevo; falla hoy)
- **CA-9** (privacidad) Con un ejemplo de voz ficticio `VOICE_TEXT`, una regla de la empresa ficticia con cuerpo `RULE_TEXT` y un diagnóstico con `input.acv: 12345`, `JSON.stringify` de la salida no contiene `VOICE_TEXT`, `RULE_TEXT`, `12345` ni `12.345`; tampoco las claves `proposal`, `findings`, `opinions`, `sources` ni `examples`. `reglas_base.faltan` solo puede contener títulos de `defaultRules()` · cubre G-4, G-5 · prueba: `src/lib/agent/tools/play-diagnosis.test.ts`
- **CA-10** (misma lectura de estado) `get_onboarding_status` y `diagnose_play_teams` llaman a `onboardingStatusFor`; la salida de `get_onboarding_status` es igual antes y después (las pruebas de `src/lib/agent/tools/onboarding.test.ts` siguen pasando sin cambios en sus aserciones) · cubre G-1 · prueba: `src/lib/agent/tools/play-diagnosis.test.ts` (guarda de fuente) y `src/lib/agent/tools/onboarding.test.ts` (guarda de regresión, no fail-first)

### H-3: Como Owner o Sales Leader, quiero guardar el plan como sugerencias que activo yo, y añadir las reglas base, sin que nada se active solo.
- **CA-11** (guardar el plan) `save_play_plan` es `kind: "write"`, `roles: ["owner", "sales_leader"]`, misma entrada que `diagnose_play_teams`. Desde el agente solo crea una fila en `agent_pending_actions` (ruta existente, `agent.server.ts:219-243`). Al ejecutarse (`executeTool` tras confirmar):
  - recalcula con los datos del momento (no se fía de lo que dijo el modelo);
  - si `ready` es `false`, lanza «Todavía no puedo guardar un plan: falta …» y no escribe;
  - si `activation` está vacío, lanza «No hay ningún play que activar en los equipos propuestos.» y no escribe;
  - si no, hace `upsert` en `suggestions` con `onConflict: "org_id,dedupe_key"` e `ignoreDuplicates: true` de una fila por entrada de `activation`: `org_id: c.orgId`, `user_id: c.userId`, `detector: "plays_diagnosis"`, `dedupe_key: "plays_diagnosis:<play_id>"`, `priority: 2` (aserción `!== 1`: no va a Telegram), `title`/`body` del §9, `link: "/plays?vista=equipos"`, `action: { tool: "set_play_enabled", args: { play_id, enabled: true } }`;
  - devuelve `{ mensaje }` con «Te he dejado N sugerencias en Sugerencias, en orden. Ningún play se ha activado: se activa cada uno cuando apruebes su sugerencia.»
  Las únicas escrituras son en `suggestions` (`writes(log)`); nunca en `play_states`, y `play-diagnosis.ts` no importa `toggle.ts` ni `plays.functions.ts`. Repetir con el mismo plan no duplica (mismas claves). Con rol `ae`, `executeTool` lanza «Tu rol no permite esta acción» y la herramienta no está en `toolsFor(["ae"])` · cubre G-1, G-2, G-3 · prueba: `src/lib/agent/tools/play-diagnosis.test.ts`
- **CA-12** (la aprobación es la de siempre) Aprobar una sugerencia `plays_diagnosis` con `decideSuggestionCore` ejecuta `set_play_enabled` con sus `args` (doble de `executeTool`), y con un play que entretanto pasó a bloqueado la sugerencia vuelve a `pending` con el error de `checkToggle` · cubre G-2, G-3 · prueba: `src/lib/agent/tools/play-diagnosis.test.ts` (con el doble de `src/lib/plays/pause-resume-suggestions.test.ts`)
- **CA-13** (no se cierran solas) `syncSuggestions` sin ninguna clave `plays_diagnosis` en `found` no cierra una sugerencia `plays_diagnosis` abierta; el resto de detectores se cierra igual que hoy · cubre G-1 · prueba: `src/lib/plays-diagnosis-sync.test.ts` (nuevo, con el `syncSuggestions` real; falla hoy: la cierra como `resolved`)
- **CA-14** (reglas base) `add_default_rules` es `kind: "write"`, `roles: ["owner", "sales_leader"]`, entrada `z.object({})`, `summarize` = «Añadir las reglas base que falten a Reglas»; `run` llama a `addDefaultRulesCore(c)` y devuelve `{ added, titles, mensaje }` con «He añadido N reglas base a Reglas.» o, con 0, «Ya tenías todas las reglas base.». Una lectura fallida lanza `DEFAULT_RULES_READ_FAILED` y no escribe · cubre G-4 · prueba: `src/lib/agent/tools/play-diagnosis.test.ts`
- **CA-15** (medida de G-1) `PLAYS_DIAGNOSIS_DETECTOR = "plays_diagnosis"` se exporta de `diagnosis.ts` y es el único lugar de `src/` (fuera de pruebas y de la lista de `org-data.ts`) donde aparece la cadena `plays_diagnosis` como valor de `detector` (guarda de fuente) · cubre G-1 · prueba: `src/lib/agent/tools/play-diagnosis.test.ts`

### H-4: Como Owner o Sales Leader, quiero empezar el diagnóstico desde los equipos de plays y que el asistente siga siempre el mismo guion.
- **CA-16** (flujo) `getWorkflow("plays_diagnosis")` existe, sin `produces` ni `requires`, con `label` «Diagnóstico de plays» y las `instructions` literales del §9 · cubre G-1 · prueba: `src/lib/bmad.test.ts` (caso nuevo; falla hoy)
- **CA-17** (botón) En `PlayTeamsPanel`, con rol `owner` o `sales_leader`, hay un botón «Hacer el diagnóstico de plays» que llama a `useAgent().open` con `{ fresh: true, mode: "chat", workflowId: "plays_diagnosis", prompt: "Quiero hacer el diagnóstico de plays." }`; con rol `ae` el botón no aparece · cubre G-1 · prueba: `src/components/plays/play-teams-panel.test.tsx` (casos nuevos; fallan hoy)
- **CA-18** (títulos y manifiesto) `TITLES` tiene «Diagnosticar equipos de plays» (`diagnose_play_teams`), «Guardar el plan de equipos de plays» (`save_play_plan`) y «Añadir las reglas base» (`add_default_rules`); cada herramienta está una vez en `TOOLS` y en `.lovable/mcp/manifest.json`, con `readOnlyHint` `true` solo en la de lectura. Ejecutar `node node_modules/@lovable.dev/mcp-js/dist/cli/extract-manifest.cjs .` no deja diff y las demás entradas (`jq` por `name`) son iguales en `7fe9aed` y en el commit final · prueba: `src/lib/agent/tools/play-diagnosis.test.ts` y comandos del gate
- **CA-19** (palabras) En los textos de `diagnosis.ts`, las `description` de las tres herramientas y las `instructions` del flujo: no aparece «Equipo»/«Equipos» con mayúscula inicial no seguido de « de plays» (`/\bEquipos?\b(?! de plays)/`) ni «agente» referido a un equipo (`/equipos? de plays[^.]*\bagentes?\b/i`), las mismas reglas que CA-15 de NK-0140; ningún texto usa «usted» ni «vos» · cubre G-1 · prueba: `src/lib/plays/diagnosis.test.ts` y `src/lib/agent/tools/play-diagnosis.test.ts`

## 8. Casos límite y errores
- **Empresa no lista** (falta diagnóstico GTM, posicionamiento o ICP): ni lista ni ordena equipos; dice qué falta con las palabras de `companyOnboardingStatus` y enlaza (CA-1). `save_play_plan` tampoco escribe (CA-11). Riesgo aceptado de NK-0009 (§14 de su SDD): cuando GTM Lab archive la Estrategia, `ready` puede volver a `false`; el asistente lo dice, no falla.
- **Diagnóstico GTM mal formado:** `diagnosis: null`, por tanto `ready: false` (regla de NK-0009).
- **Cuello de botella ya activo o sin pasos:** CA-5 y CA-2; se dice y se pasa al siguiente.
- **«Ninguno de estos»:** `bottleneck: null`; solo cuentan `wanted`, encaje y fase.
- **Todos los equipos ya activos:** `proposed` vacío; `resumen` dice «Ya tienes activados todos los plays disponibles de los equipos de plays.» y el asistente no ofrece `save_play_plan`.
- **El plan cambia entre proponer y confirmar** (alguien activa un play): `save_play_plan` recalcula y solo deja sugerencias de lo que sigue sin activar; el `mensaje` dice cuántas.
- **Una sugerencia descartada no vuelve** con la misma clave `plays_diagnosis:<play_id>` (regla general de `suggestions`: deduplica por `(org_id, dedupe_key)`). Si se quiere otra vez, se activa en `/plays`. Dicho en el walkthrough.
- **Un play activado después en `/plays`:** su sugerencia sigue abierta; aprobarla es inocuo (`togglePlay` deja `enabled: true`). Se puede descartar. Cerrarla sola pediría un detector; fuera de alcance.
- **Telegram y trabajos** (cliente de servicio): todas las lecturas filtran por `c.orgId` (`stateRows`, `loadVoice`, `readTitles`, `companyDiagnosisFor` ya lo hacen); `save_play_plan` y `add_default_rules` escriben con `org_id: c.orgId` y `executeTool` comprueba el rol.
- **MCP:** las dos escrituras quedan como `agent_pending_actions` con `source 'mcp'` que se confirman en Sugerencias, como cualquier escritura MCP.
- **La persona pega mensajes de clientes en el chat** pese a todo: el flujo pide no hacerlo y enlaza a Voz (§9); el asistente no tiene herramienta para guardarlos. Lo que ya está escrito queda en `agent_messages` como hoy (riesgo §14).
- **Otra empresa (multitenant):** `diagnosis.ts` es puro; las herramientas leen y escriben con `c.orgId`; las sugerencias van al `user_id` de quien confirma.
- **Miembro sin rol de líder:** no ve el botón; puede preguntar al asistente por los equipos (lectura), pero no tiene `save_play_plan` ni `add_default_rules`.

## 9. Experiencia y copy
Español, «tú», sin iconos, estados con palabra. Fede revisa los textos en la aprobación.
- Botón en «Equipos de plays» (solo Owner y Sales Leader): «Hacer el diagnóstico de plays». Prompt inicial: «Quiero hacer el diagnóstico de plays.»
- Flujo `plays_diagnosis`, `label` «Diagnóstico de plays», `instructions`:
  «1) Llama a get_onboarding_status. Si ready es false, di qué falta con las palabras de missing, enlaza /onboarding para el diagnóstico GTM y /setup para posicionamiento e ICP, y no propongas equipos de plays. 2) Si está lista, pregunta una cosa por turno: primero cuál es hoy su cuello de botella, con las seis opciones de BOTTLENECK_WORD más «Ninguno de estos»; después qué otras tareas quiere resolver (puede elegir varias o ninguna). No preguntes lo que get_onboarding_status ya sabe. 3) Llama a diagnose_play_teams con sus respuestas y cuenta el resultado a partir de resumen: no añadas equipos de plays, plays, motivos ni cifras que no estén en la respuesta. 4) Si reglas_base.faltan no está vacío, propón add_default_rules. Si voz.faltan es mayor que 0, pide que pegue sus mensajes reales en Conocimiento › Voz (/hub?seccion=voice) y no aquí. 5) Propón save_play_plan con las mismas respuestas y di que nada se activa hasta que apruebe cada sugerencia.»
- `BOTTLENECK_WORD` (opciones de la primera pregunta, una por equipo):
  - `reuniones`: «Llego a las reuniones sin preparar o se quedan sin seguimiento.»
  - `reactivar-perdidos`: «Perdemos deals y no volvemos a ellos.»
  - `senales-de-cuenta`: «No sé qué cuentas se están moviendo.»
  - `aprender-de-llamadas`: «No sé qué dolores repiten los clientes en las llamadas.»
  - `priorizar-cuentas-y-crm`: «No sé a qué cuentas dedicar tiempo o no me fío del CRM.»
  - `entrantes-y-producto`: «Los registros y los leads entrantes se enfrían.»
- Motivos (`reasons`): «Es tu cuello de botella.» · «Lo has elegido tú.» · «Encaja con tu arquetipo (<name>): vendes con producto.» · «Empieza por «<play>», de la fase <Fundación|Captura|Generación|Orquestación>.» · «Activar «<play>» también avanza «<equipo>».»
- `resumen` (lista):
  - Cabecera: «Te propongo empezar por estos equipos de plays, en este orden:» y por cada uno «<rank>. <título>: <tarea> <motivos>».
  - «Plan de activación:» y por cada paso «<n>. <play> (<equipos>)».
  - «Para después:», «Ya activos:» y «No disponibles todavía:» con sus motivos, solo si tienen elementos.
  - Voz: «Tienes <n> de 3 mensajes de voz. Añade los que faltan en Conocimiento › Voz.» (si faltan) o «Tu voz está completa.»; fallo: «No he podido comprobar la voz de tu empresa.»
  - Reglas: «Te faltan <n> reglas base; puedo añadirlas si me lo confirmas.» o «Ya tienes las reglas base.»; fallo: «No he podido comprobar tus reglas.»
  - Cierre: «Nada se activa solo: te dejo cada play como sugerencia y lo activas al aprobarla.»
- Sugerencia `plays_diagnosis`: título «Activa «<play>»»; cuerpo «Paso <n> del plan de tu diagnóstico de plays. Avanza: <equipos>. Al aprobarla se activa este play; nada más.»
- Títulos MCP: «Diagnosticar equipos de plays», «Guardar el plan de equipos de plays», «Añadir las reglas base».
- Sin textos de error nuevos fuera de los citados; los errores de escritura pasan por `errorText` en `decidePending` y `decideSuggestionCore`, como hoy.

## 10. Datos, permisos y privacidad
- **Sin migración.** Por qué no hace falta: el estado de la empresa ya existe (NK-0009), los equipos son código (NK-0140), la activación es por play en `play_states` (sin cambios), las reglas base ya tienen su núcleo (NK-0128) y el plan se guarda como sugerencias, una tabla con `org_id`, RLS por empresa y aprobación ya resuelta (`0013`). El flujo no se guarda (`workflowId` va en cada turno), así que no toca el `check` de `agent_conversations.mode`. Guardar «el diagnóstico» en una tabla propia duplicaría lo que dicen las sugerencias y `agent_pending_actions`, y solo serviría a la medida de G-1, que ya tiene fuente (§4).
- **Permisos:** leer el diagnóstico, cualquier miembro (solo muestra lo que ya ve en `/plays` y en `get_onboarding_status`, más dos recuentos); guardar el plan y añadir reglas base, Owner y Sales Leader, en el registro (`roles`) y otra vez en `addDefaultRulesCore`; activar, Owner y Sales Leader, al aprobar cada sugerencia (`togglePlay`).
- **Privacidad:** la salida no lleva textos de voz, cuerpos de reglas de la empresa, propuesta, hallazgos ni ticket (CA-9). El chat no recibe mensajes de voz (P-1). Las sugerencias solo llevan textos fijos y títulos del catálogo. Pruebas con datos ficticios.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| Ninguna nueva | Regla pura (`prioritizeTeams`, `activationPlan`, `diagnosisSummary`); el modelo del agente ya existente solo pregunta y redacta | El del agente (`aiProviders`, sin cambios) | Sin dato |

El diagnóstico usa los turnos del agente que ya existe: unas cuatro o cinco respuestas por conversación (sin dato real de tokens). Las tres herramientas añaden sus descripciones al contexto de cada turno: sin dato de tokens. No hay generación extra, ni caché, ni modelo caro.

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | `src/lib/plays/diagnosis.ts`: tipos, `MAX_PROPOSED_TEAMS`, `BOTTLENECK_WORD`, `PLAYS_DIAGNOSIS_DETECTOR`, `prioritizeTeams`, `activationPlan`, `diagnosisSummary` | CA-1 a CA-7, CA-19 (textos del módulo) | `src/lib/plays/diagnosis.test.ts` |
| U-2 | `onboardingStatusFor` en `tools/onboarding.ts`; `missingDefaultRuleTitles` en `default-rules.ts`; `diagnose_play_teams` en `tools/play-diagnosis.ts` y registro | CA-8, CA-9, CA-10 | `src/lib/agent/tools/play-diagnosis.test.ts` |
| U-3 | `save_play_plan` y `add_default_rules`; `plays_diagnosis` en la lista de `org-data.ts:470` | CA-11 a CA-15 | `src/lib/agent/tools/play-diagnosis.test.ts`, `src/lib/plays-diagnosis-sync.test.ts` |
| U-4 | Flujo `plays_diagnosis` en `workflows.ts`; botón en `PlayTeamsPanel` | CA-16, CA-17 | `src/lib/bmad.test.ts`, `src/components/plays/play-teams-panel.test.tsx` |
| U-5 | `TITLES`, manifiesto por extractor, líneas en `src/lib/AGENTS.md` | CA-18, CA-19 (descripciones) | `src/lib/agent/tools/play-diagnosis.test.ts` |

U-2 y U-3 dependen de U-1. U-4 y U-5 dependen de U-2 y U-3 (nombres de herramientas).

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- Firmas: `type TeamId = (typeof PLAY_TEAMS)[number]["id"]` (o una lista `TEAM_IDS` derivada, para `z.enum`); `type DiagnosisAnswers = { bottleneck: TeamId | null; wanted: TeamId[] }`; `prioritizeTeams({ status, plans, answers, max = MAX_PROPOSED_TEAMS }: { status: Pick<ReturnType<typeof companyOnboardingStatus>, "ready" | "missing" | "diagnosis">; plans: TeamPlan[]; answers: DiagnosisAnswers; max?: number })`. `plans` llega ya calculado con `teamPlan` y las filas de la empresa: la función no lee filas ni catálogo por su cuenta.
- `onboardingStatusFor(c)` es exactamente el cuerpo actual de `run` de `get_onboarding_status` (`tools/onboarding.ts:59-66`); `get_onboarding_status` pasa a `run: (c) => onboardingStatusFor(c)`.
- `missingDefaultRuleTitles(c)` reutiliza `readTitles` y `normalizeRuleTitle`; la herramienta captura su error y devuelve `{ ok: false }`.
- `save_play_plan` reutiliza el mismo núcleo que `diagnose_play_teams` (una función interna `diagnoseFor(c, answers)`), así lo que se guarda es lo que se habría mostrado con esos datos.
- Patrón de pruebas: `fakeDb`, `expectScoped`, `writes(log)` de `src/lib/agent-tools.test.ts` y `src/lib/agent/tools/plays.test.ts`.
- `PlayTeamsPanel` ya recibe `roles`; el botón usa `canTogglePlays(roles).ok` (`status.ts:39`), que es la misma regla de «quién activa». `useAgent` tiene contexto por defecto (`agent.tsx`, `createContext` con `open` vacío), así que la prueba de la ruta `/plays` no necesita `AgentProvider`; la prueba del panel simula `useAgent`.
- Alternativas descartadas: (1) modo de agente `diagnosis`: pide migración del `check` de `0007:29` y no añade nada que el flujo no dé; (2) que el modelo ordene los equipos: no es determinista ni se puede probar; (3) guardar el plan como tareas: las tareas sin fecha no se ven en ninguna pantalla (`src/lib/briefing.ts:66` solo enseña las que vencen) y ponerles fecha sería inventarla; (4) activar el plan al confirmar: contradice la decisión 5 y P-2 de NK-0140; (5) escribir Voz desde el chat (P-1).

**Escenarios fijados por CA-3, CA-4, CA-5 y CA-6** (catálogo real, sin filas de `play_states`; fases del §3 hallazgo 4):
| Escenario | Entrada | `proposed` (rank: equipo → `next`) | `later` | `alreadyActive` | `activation` |
|---|---|---|---|---|---|
| A | arquetipo B (`motion` `inside_sales`), `bottleneck: null`, `wanted: []` | 1 `priorizar-cuentas-y-crm` → `hubspot-account-tiering-scoring` (fundación); 2 `reactivar-perdidos` → `signals-in-crm-with-decay` (captura); 3 `senales-de-cuenta` → `signals-in-crm-with-decay` (captura) | `aprender-de-llamadas` (límite); `entrantes-y-producto` (no habitual) | `reuniones` | 1 `hubspot-account-tiering-scoring`; 2 `signals-in-crm-with-decay` (Reactivar perdidos, Señales de cuenta); 3 `closed-lost-revival` |
| B | arquetipo A (`motion` `plg`), `bottleneck: "aprender-de-llamadas"`, `wanted: []` | 1 `aprender-de-llamadas` → `call-transcript-signal-extraction`; 2 `entrantes-y-producto` → `product-sign-up-outreach`; 3 `priorizar-cuentas-y-crm` → `hubspot-account-tiering-scoring` | `reactivar-perdidos`, `senales-de-cuenta` (límite) | `reuniones` | 1 `call-transcript-signal-extraction`; 2 `product-sign-up-outreach`; 3 `hubspot-account-tiering-scoring` |
| C | arquetipo C (`motion` `field_sales`), `bottleneck: "reuniones"`, `wanted: ["entrantes-y-producto"]` | 1 `entrantes-y-producto` → `product-sign-up-outreach`; 2 `priorizar-cuentas-y-crm`; 3 `reactivar-perdidos` | `senales-de-cuenta`, `aprender-de-llamadas` (límite) | `reuniones` (con el motivo de cuello de botella) | 1 `product-sign-up-outreach`; 2 `hubspot-account-tiering-scoring`; 3 `signals-in-crm-with-decay`; 4 `closed-lost-revival` |

## 14. Riesgos, dependencias y walkthrough
**Riesgos:**
- **El modelo se sale del guion** (añade un equipo o un motivo): mitigado porque el orden y los motivos salen de la herramienta (`resumen`) y el flujo prohíbe añadir; lo que se guarda se recalcula en servidor (CA-11), así que un texto mal redactado no cambia el plan. No se puede probar del todo sin ejecutar el modelo: lo mira el walkthrough.
- **Regla de encaje mínima:** solo `entrantes-y-producto` depende del arquetipo. Es una regla declarada, no medida (P-2).
- **Mensajes de clientes en el chat:** si alguien los pega igualmente, quedan en `agent_messages` y pueden pasar a memoria (`agent.server.ts:169-172`), como hoy con cualquier mensaje. Este SDD no lo empeora; cerrarlo del todo es otro ticket.
- **Sugerencias que no se cierran solas** (CA-13): pueden quedar abiertas tras activar el play en `/plays` (§8). Aceptable en fase interna.
- **Choque con plays en construcción:** si un SDD de plays cambia fases o `defaultEnabled` de los 12 plays, los escenarios del §13 fallan y obligan a revisarlos. Es intencionado.
- **Manifiesto en caché** de asistentes MCP: no verán las herramientas hasta refrescar.

**Dependencias:** NK-0127, NK-0140, NK-0128 y NK-0009, todas en `main`. Ninguna sin entregar.

**Walkthrough** (`nokko-walkthrough`, móvil y escritorio, claro y oscuro; empresa y personas ficticias, una Owner y un AE):
1. Empresa sin diagnóstico GTM: `/plays?vista=equipos` → «Hacer el diagnóstico de plays» → el asistente dice qué falta con las palabras de `missing`, enlaza `/onboarding` y `/setup`, y no nombra ningún equipo de plays. En la red, ninguna escritura.
2. Empresa lista (arquetipo B, sin filas): responde «Ninguno de estos» y ninguna otra tarea → propone «Priorizar cuentas y limpiar CRM», «Reactivar perdidos» y «Señales de cuenta» en ese orden (escenario A), dice que «Reuniones» ya está activo y que «Entrantes y producto» no es lo habitual.
3. Voz con un ejemplo: dice «Tienes 1 de 3 mensajes de voz» y enlaza a Conocimiento › Voz; no pide pegarlos en el chat.
4. Sin reglas base: propone «Añadir las reglas base»; al confirmar, aparecen en Conocimiento › Reglas; repetir no duplica.
5. Confirma «Guardar el plan» → tres sugerencias en Sugerencias, en orden, y en `/plays` ningún play ha cambiado de estado. Aprobar «Activa «Señales en el CRM con caída en el tiempo»» lo activa y se ve en los dos equipos.
6. Descarta una sugerencia y vuelve a guardar el plan: la descartada no vuelve (anotar).
7. AE: no ve el botón; si pide al asistente guardar el plan, responde que su rol no lo permite.
8. Telegram (Owner): «hazme el diagnóstico de plays» → mismo orden y mismas palabras; la confirmación funciona desde Telegram.
9. Móvil por debajo de md: el botón sin desplazamiento lateral; la barra inferior no lo tapa.
10. Consola y red sin errores; las únicas escrituras son las de los pasos 4 y 5.

## 15. Preguntas para Fede y para la revisión técnica
**Decisiones del autor (para que Fede las confirme o cambie):**
- **D-1.** Sin migración (§10).
- **D-2.** El diagnóstico es un flujo del agente (`workflowId`), no un modo nuevo.
- **D-3.** La salida es una lista de sugerencias con `set_play_enabled`, una por play del plan de activación; activar sigue siendo play a play y con aprobación (decisión 5; P-2 de NK-0140).
- **D-4.** Dos preguntas (cuello de botella, otras tareas); lo demás sale de `get_onboarding_status` y de los datos.
- **D-5.** «Lista» es la opción B de Fede (NK-0009), sin añadir condiciones.

**Preguntas abiertas para Fede (con recomendación):**
- **P-1. ¿Dónde se pegan los tres mensajes de voz?** La decisión 20 dice «pegados en el diagnóstico». Pegarlos en el chat los guarda en el historial y puede convertirlos en memorias (§3 hallazgo 12), y escribir Voz desde el agente contradice la guarda y la migración de NK-0128 (§3 hallazgo 11). **Recomiendo A:** el diagnóstico comprueba cuántos hay y te lleva a Conocimiento › Voz, donde los pegas tú. B: herramienta de escritura de voz desde el chat; exige excluir esos mensajes del historial y de la memoria y reabrir NK-0128 (más alcance y riesgo).
- **P-2. ¿Límite de 3 equipos y una sola regla de encaje** («Entrantes y producto» solo para arquetipos de producto, salvo que lo pidas)? **Recomiendo sí** a las dos; los números y la regla se cambian en una constante y una línea de `diagnosis.ts`.
- **P-3. G-5, «borradores que leen la voz»:** medirlo pide guardar el contexto que usó cada borrador (columna o tabla nueva). **Recomiendo** un ticket aparte cuando los SDD de plays construyan los plays que redactan; este SDD mide solo la primera parte de G-5.

**Para la revisión técnica:** confirmar que `decideSuggestionCore` ejecuta `set_play_enabled` con el contexto de la persona en la app y en Telegram, y que la lista de `org-data.ts:470` es el único sitio que hay que tocar para que `syncSuggestions` no cierre `plays_diagnosis`.

## 16. Pendiente de verificar
- [Por verificar, coordinador, SQL de solo lectura] Línea base de G-1 (filas `suggestions` con `detector = 'plays_diagnosis'`: se espera 0), de G-4 (empresas con las nueve reglas base) y de G-5 primera parte (empresas con tres ejemplos de voz).
- [Por verificar, gate] CA-18: el extractor no deja diff y las demás entradas del manifiesto no cambian.
- [Por verificar, gate] CA-12: la aprobación de una sugerencia `plays_diagnosis` ejecuta `set_play_enabled` por `decideSuggestionCore` en app y en Telegram.
- [Por verificar, walkthrough] Que el modelo cuenta el resultado sin añadir equipos ni motivos (pasos 2 y 8).
- [Por verificar] Diferencias entre `production` y `main` en `/plays` y en el agente: solo se leyó `main`.

**Lo que NO se afirma:**
- No se afirma que el orden propuesto sea el mejor para cada empresa: es una regla declarada (fase, cuello de botella, elección y una regla de encaje), no un resultado medido.
- No se afirma cuántas empresas están hoy «listas» para el diagnóstico: sin dato.
- No se afirma que un equipo propuesto resuelva su tarea de principio a fin: 11 de sus 12 plays son `parcial` y uno `planificado` (NK-0140 §16).
- No se mide «borradores que leen la voz» (G-5, segunda parte).
- No se afirma el coste en tokens de las herramientas nuevas ni de una conversación de diagnóstico: sin dato.
- No se afirma que el modelo nunca se salga del guion: lo que se guarda no depende de él (CA-11), lo que dice se revisa en el walkthrough.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Un agente `nokko-gate` con contexto fresco lee este SDD y el código, y devuelve su informe. El coordinador lo copia aquí sin editarlo. El gate no aprueba el SDD: informa; la aprobación es de Fede.
- Veredicto del gate: No revisado
- CA sin prueba posible o sin G-n: —
- [Por verificar] que sigue sin comprobarse: —
- Contradicciones con el código o con decisiones previas: —
- Lo que esta revisión NO demuestra: —

## 18. Delta de implementación (lo rellena el agente al entregar)
—
