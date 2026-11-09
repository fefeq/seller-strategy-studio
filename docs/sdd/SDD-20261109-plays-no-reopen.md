# SDD-20261109-plays-no-reopen · [Bug] Las sugerencias cerradas de los plays solo se reabren cuando el play se reanudó

**Tipo:** Bug (comportamiento de sugerencias y avisos, sin migración) · **Prioridad propuesta:** Alta (en todas las empresas, hoy reabre sugerencias cerradas y reenvía avisos de prioridad 1 por Telegram)
**Estado:** Borrador · **Pide:** Fede (Sprint 3) · **Aprueba:** Fede · **Fecha:** 2026-11-09
**Tickets:** NK-0077 (reapertura sin pausa) y NK-0078 (falta la prueba de `syncSuggestions` sin filas en `play_states`)
**PRD:** No aplica (bug) · **Depende de:** `SDD-20261106-plays-library-core.md` (Plays GTM 1, en `main`)

> Nivel elegido: SDD corto. El cambio es solo de código, pero cambia qué sugerencias ve cada empresa y qué avisos salen por Telegram (datos), así que según la tabla de `nokko-shape` lleva SDD.
> Números de línea comprobados en `main` `1fef724`.

## 1. Resumen
Desde Plays GTM 1, `syncSuggestions` reabre (vuelve a `pending`, borra `snoozed_until` y `notified_at`) cualquier sugerencia «resuelta» de los 9 detectores de los plays cada vez que el detector la vuelve a encontrar, en todas las empresas y aunque nadie haya pausado nunca un play. Este SDD limita esa reapertura al único caso que la justificó: el play se **reanudó después** de que se cerrara la sugerencia. Sin filas en `play_states`, `syncSuggestions` se comporta exactamente como antes de Plays GTM 1.

## 2. Problema y para quién
Owner, Sales Leader y cada miembro con Telegram enlazado: una sugerencia que el sistema cerró porque dejó de aplicarse (por ejemplo, un lead que salió de retraso y volvió a retrasarse) reaparece como nueva y, si es de prioridad 1, se reenvía por Telegram. Antes de Plays GTM 1 la clave única `(org_id, dedupe_key)` la dejaba cerrada.

## 3. Evidencia y por qué ahora
- `src/lib/org-data.ts:377`: `REOPENABLE = new Set(["setup_incomplete", ...CATALOG.flatMap((p) => p.detectors)])`. Antes era solo `setup_incomplete` (`git log -L`: commit `b6b5c9b`, «fix(plays): resuming a play reopens the suggestions its pause closed»).
- Los detectores de los plays (`src/lib/plays/catalog.ts:80`, `:91`, `:123`, `:164`, `:174`, `:197`): `meeting_no_prep`, `meeting_no_notes`, `late_lead`, `account_signal`, `account_missing_key`, `product_qualified`, `usage_drop`, `trial_conversion`, `no_decision_maker` (9).
- `src/lib/org-data.ts:406-419`: toda clave encontrada de esos detectores con `status = 'resolved'` pasa a `pending` con `snoozed_until: null` y `notified_at: null`, filtrando solo por `org_id`, `dedupe_key` y `status`. No lee `play_states`.
- `src/lib/org-data.ts:443-447`: una sugerencia `pending` o `snoozed` que el detector deja de encontrar se cierra como `resolved` con `updated_at` de ese momento. Así se cierran tanto las que se resuelven solas como las de un play pausado (`detect()` salta sus reglas, `src/lib/plays/gating.ts`, `org-data.ts:295-298`). La actualización no toca `snoozed_until`: el valor queda guardado en la fila.
- Un tercer escritor cierra como `resolved` una sugerencia de detector de play: `src/lib/autopilot.server.ts:64` cierra `meeting_no_prep:<id>` (`pending`/`snoozed` → `resolved`) con `updated_at` del momento al preparar la reunión. Sella `updated_at` como cualquier otro cierre, así que no rompe la regla. En el código no hay ningún escritor que mueva `updated_at` de una fila que sigue `resolved` (gate, revisión de los 47 `from("suggestions")`).
- `src/routes/api/public/jobs/proactive.ts:179-227` (`notifyUrgent`): envía por Telegram las sugerencias pendientes con `notified_at` nulo (las de prioridad 1 y las asignadas) y después marca `notified_at`. Al borrar `notified_at`, una reapertura vuelve a avisar.
- `play_states` (`drizzle/migrations/0077_plays_library_core.sql`): clave `(org_id, play_id)`, `enabled`, `updated_at` que el trigger `play_states_stamp` pone a `now()` en cada inserción y actualización. Solo Owner y Sales Leader escriben (políticas «leaders insert/update»); todos los miembros leen. El único escritor del código es `togglePlay` (`src/lib/plays/toggle.ts:22-27`). **Marcador de reanudación:** una fila con `enabled = true` cuyo `updated_at` es posterior al `updated_at` de la sugerencia cerrada. No hace falta migración.
- Llamadores de `syncSuggestions`: `src/lib/agent.functions.ts:249` (cliente de la persona, RLS), `src/lib/inngest/tasks.server.ts:17` y `src/routes/api/public/jobs/proactive.ts:79` (cliente admin).
- Prueba existente: `src/lib/plays/pause-resume-suggestions.test.ts:91-100` comprueba la reapertura **sin** simular `play_states` (el fake solo conoce `suggestions`); por eso el gate de Plays GTM 1 abrió NK-0078.
- Uso real: sin dato (no se ha medido cuántas sugerencias se reabrieron ni cuántos avisos se reenviaron desde el merge de Plays GTM 1).

## 4. Resultado buscado
- Una empresa sin filas en `play_states` no ve ninguna sugerencia de esos 9 detectores reabierta por `syncSuggestions` y no recibe ningún aviso repetido por esa causa.
- Una empresa que pausa y reanuda un play recupera las sugerencias que la pausa cerró, como hoy.
- Línea base: sin dato. Métrica de seguimiento: no se propone; el resultado lo prueban los CA.

## 5. Alcance
**Incluye:**
- `syncSuggestions` (`src/lib/org-data.ts:377-419`): la reapertura de los detectores de plays pasa por una regla pura nueva y lee `play_states` de la empresa.
- Regla pura `reopenable(...)` en `src/lib/plays/gating.ts` (o archivo nuevo `src/lib/plays/reopen.ts`), con su test.
- Reescritura del fake y los casos de `src/lib/plays/pause-resume-suggestions.test.ts` para que simule `play_states`.
- Una línea en `src/lib/AGENTS.md` (entrada de Plays GTM, `:68`) y el comentario de `REOPENABLE`.

**No incluye** (el brief lo copia a «Movimientos prohibidos»):
- Migraciones ni cambios en `play_states`, `suggestions` o sus políticas.
- Cambiar `setup_incomplete` (sigue reabriéndose como hoy, `org-data.ts:408-419`).
- Volver a cerrar o tocar sugerencias ya reabiertas desde el merge de Plays GTM 1 (no hay forma de distinguirlas; §14).
- Cambiar `notifyUrgent`, la prioridad de los detectores, `detect()` o `disabledPlayIds`.
- Las sugerencias estratégicas (`strategy_*`, `syncStrategySuggestions`).
- Guardar historial de pausas y reanudaciones.

## 6. Cambios de comportamiento (delta)
**Añadido:** regla pura que decide qué sugerencias cerradas de un detector de play se reabren; lectura de `play_states` (`play_id, enabled, updated_at`) dentro de `syncSuggestions`.
**Modificado:**
- Sugerencia `resolved` de un detector de play encontrada otra vez: siempre se reabre → se reabre solo si su play tiene fila con `enabled = true` y `updated_at` posterior al `updated_at` de la sugerencia.
- Al reabrir por reanudación: `snoozed_until` se borraba → se conserva si sigue en el futuro (la sugerencia vuelve como `snoozed`); si ya pasó o es nulo, vuelve como `pending` con `snoozed_until` nulo (D-2).
- `notified_at`: se borraba en toda reapertura → solo se borra en la reapertura por reanudación (D-1); nunca en otro caso.
**Eliminado:** la reapertura incondicional de los 9 detectores.

## 7. Historias y criterios de aceptación
### H-1: Como miembro, quiero que una sugerencia cerrada no vuelva sola ni me avise otra vez, salvo que mi empresa haya reanudado su play.
- **CA-1** (NK-0078, sin filas) Con `play_states` vacío para la empresa, una sugerencia de `meeting_no_prep` en `resolved` con `notified_at` relleno y `snoozed_until` relleno, encontrada de nuevo por `syncSuggestions`, sigue `resolved` con los mismos `notified_at`, `snoozed_until` y `updated_at`. Igual para los 9 detectores del catálogo (la prueba los recorre desde `CATALOG`). · prueba: `src/lib/plays/pause-resume-suggestions.test.ts` (falla hoy: `org-data.ts:406-419` la reabre)
- **CA-2** (fila sin reanudación) Con una fila del play `enabled = true` cuyo `updated_at` es **anterior** al cierre de la sugerencia (el play se activó o reanudó antes y la sugerencia se cerró después, por resolverse sola), la sugerencia sigue `resolved` y `notified_at` no cambia. · prueba: mismo archivo (falla hoy)
- **CA-3** (play pausado) Con la fila `enabled = false`, nada se reabre (además, `detect()` no emite sus claves; la prueba las pasa igualmente a `syncSuggestions` para fijar la regla). · prueba: mismo archivo (falla hoy)
- **CA-4** (reanudación) Pausa → `syncSuggestions` sin la clave (se cierra como `resolved`) → fila `enabled = true` con `updated_at` posterior → `syncSuggestions` con la clave: la sugerencia vuelve a `pending` con `notified_at` nulo. Otra sugerencia del mismo detector cerrada **después** de la reanudación sigue `resolved` en esa misma llamada. · prueba: mismo archivo (guarda de regresión del caso de `b6b5c9b`, más el control; el control falla hoy)
- **CA-5** (snooze al reanudar) Si la sugerencia estaba `snoozed` con `snoozed_until` futuro cuando la pausa la cerró, al reanudar vuelve como `snoozed` con el mismo `snoozed_until`; si `snoozed_until` ya pasó, vuelve como `pending` con `snoozed_until` nulo. · prueba: mismo archivo (falla hoy: se borra el snooze)
- **CA-6** (controles intactos) Una `dismissed` o `approved` de un detector de play no se reabre nunca, tampoco tras reanudar; una de un detector que no es de play (`stale_deal`) sigue cerrada; `setup_incomplete` se reabre como hoy (a `pending`, `snoozed_until` y `notified_at` nulos) sin depender de `play_states`. **Carrera:** si el fake cambia la fila a `dismissed` (o `snoozed` por la persona) entre la lectura de las cerradas y la escritura de la reapertura, la fila sigue `dismissed` (la escritura filtra `status = 'resolved'`). · prueba: mismo archivo (guarda; el caso de carrera falla si U-2 escribe solo por `id`)
- **CA-7** (otra empresa) Con el cliente admin (sin RLS, como el cron), una fila de `play_states` reanudada de la empresa B no reabre nada de la empresa A: la lectura filtra por `org_id` y la regla recibe solo filas de la empresa. · prueba: mismo archivo
- **CA-8** (lectura fallida) Si la lectura de `play_states` devuelve error, ninguna sugerencia de un detector de play se reabre (falla cerrado para reabrir) y el resto de `syncSuggestions` sigue (inserta, cierra, despierta los aplazados). · prueba: mismo archivo
- **CA-9** (regla pura) `reopenable(rows, closed, now)` devuelve, para cada sugerencia cerrada de un detector de play, `null` (no reabrir) o `{ status, snoozed_until }`; tabla de casos con CA-1 a CA-5 y CA-7; nunca devuelve reapertura sin fila `enabled = true` posterior al cierre; ignora filas de plays fuera del catálogo y detectores que no son de ningún play. Compara instantes con `Date.parse`, nunca cadenas con `<`/`>`: la tabla incluye un caso con `play_states.updated_at` en el formato de PostgREST (`2026-11-09T10:00:00.123456+00:00`) y el `updated_at` de la sugerencia en el de `toISOString()` (`2026-11-09T10:00:00.123Z`), con microsegundos. · prueba: `src/lib/plays/reopen.test.ts` (nuevo; la función no existe)

## 8. Casos límite y errores
- **Cierre natural y reanudación posterior:** si una sugerencia se cerró sola en T1, el play se pausó en T2 y se reanudó en T3, y en T4 el detector la vuelve a encontrar, se reabre. No se distingue de una cerrada por la pausa sin historial de pausas; se acepta porque el asunto vuelve a ser cierto y hubo una acción explícita sobre el play (§16, lo que no se afirma).
- **Reanudar dos veces o reescribir la fila con el mismo valor:** cada escritura sella `updated_at` (`play_states_stamp`); vale como reanudación si `enabled = true`. Hoy solo `togglePlay` escribe y la pantalla ofrece «Activar» solo a un play no activo (`src/components/plays/plays-panel.tsx:131`, `:158`: el botón invierte `p.enabled`).
- **Activar por primera vez un play sin fila:** los 9 detectores son de plays con `defaultEnabled` verdadero (`src/lib/AGENTS.md:68`); una primera fila `enabled = true` escrita a mano después de un cierre natural reabriría. Riesgo aceptado: es una acción explícita de Owner o Sales Leader.
- **Reloj:** `play_states.updated_at` es `now()` de la base; el `updated_at` de la sugerencia cerrada lo pone el servidor (`new Date().toISOString()`, `org-data.ts:443`). Un desfase de segundos solo importa si alguien reanuda en el mismo instante en que se cierra; sin dato de desfase real.
- **Varias empresas por persona:** `syncSuggestions` recibe `orgId` y la lectura filtra por él con cualquier cliente (admin o RLS); los miembros leen `play_states` (política «members read»). Esa política exige además `org_id = current_org()` (`0077:31`): con el cliente de la persona, si `orgId` no fuera su empresa actual, la lectura devolvería 0 filas sin error y no se reabriría nada (dirección segura). CA-7 lo prueba con el cliente admin.
- **Avisos al reanudar (consecuencia de D-1):** reanudar un play borra `notified_at` de las sugerencias de prioridad 1 que la pausa cerró; `notifyUrgent` las vuelve a enviar por Telegram (3 por persona y pasada, `proactive.ts:179-227`). Es lo esperado y el walkthrough debe verlo.
- **Sugerencia asignada a otra persona:** la regla no mira `user_id`; la visibilidad sigue igual.

## 9. Experiencia y copy
Sin textos nuevos. El mensaje de `togglePlay` («Sus sugerencias pendientes se cerrarán en la siguiente sincronización y quedan en el historial», `toggle.ts:32`) sigue siendo cierto.

## 10. Datos, permisos y privacidad
Sin tablas, columnas, políticas ni GRANT nuevos. `syncSuggestions` añade una lectura `select play_id, enabled, updated_at from play_states where org_id = $1`; con el cliente de la persona la permite «members read» (`0077`), con el admin no hay RLS y el filtro por `org_id` es explícito. Pruebas con ids y claves ficticios.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| ninguna | — | — | — |

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | Regla pura `reopenable` (detector → play desde `CATALOG`; fila `enabled = true` y `updated_at` > cierre; conserva snooze futuro) | CA-9 | `src/lib/plays/reopen.test.ts` (no existe la función) |
| U-2 | `syncSuggestions`: separa `setup_incomplete` (igual que hoy) de los detectores de plays; para estos, lee las cerradas `resolved` con esas claves (`id, dedupe_key, detector, updated_at, snoozed_until`) y `play_states` de la empresa, aplica `reopenable` y actualiza cada una con `.eq("org_id", orgId).eq("id", id).eq("status", "resolved")` y `status`, `snoozed_until`, `notified_at: null`, `updated_at`; con error de lectura no reabre ninguna. Fake de `pause-resume-suggestions.test.ts` ampliado con la tabla `play_states` y `updated_at`; comentario de `REOPENABLE` y línea en `src/lib/AGENTS.md` | CA-1 a CA-8 (incluido el caso de carrera de CA-6) | `src/lib/plays/pause-resume-suggestions.test.ts`: el caso de CA-1 (sin filas → nada cambia) falla en `1fef724` |

Orden: U-1 y luego U-2. Cada U escribe primero su test, lo ve fallar en `1fef724` y después el código.

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- El caso actual `pause-resume-suggestions.test.ts:91-100` («comes back when the play is resumed») deja de ser válido tal cual: sin filas no debe reabrir. Se reescribe como CA-4 con filas de `play_states` en el fake; no se borra la intención (pausa → reanudación → vuelve). El caso de controles (`:102-121`) sigue y se amplía con CA-6.
- El fake necesita `from("play_states")`, `updated_at` en las filas de `suggestions` y un modo de error para CA-8; las fechas se fijan a mano, sin `Date.now()` implícito (o con `vi.setSystemTime`).
- La escritura de cada reapertura lleva `org_id`, `id` y `status = 'resolved'`: `syncSuggestions` corre a la vez desde el cron (`proactive.ts:79`), Inngest (`tasks.server.ts:17`) y el navegador (`agent.functions.ts:249`), y `decideSuggestion` actualiza por `id` sin filtrar por estado (`agent.functions.ts:341-352`). Sin el filtro, una sugerencia descartada entre la lectura y la escritura se reabriría.
- Mantener una única consulta a `play_states` por llamada; no reutilizar `Snapshot.disabledPlays` (no lleva `updated_at` y `syncSuggestions` no recibe el snapshot).
- Alternativa descartada: marcar en la sugerencia el motivo del cierre (pausa vs. resuelta sola). Exigiría una columna nueva (migración) o reutilizar `body`; el marcador de `play_states.updated_at` basta para D-1.
- Alternativa descartada: quitar los detectores de plays de `REOPENABLE` sin más. Rompe el caso de pausa y reanudación que motivó `b6b5c9b`.

## 14. Riesgos y dependencias
- **Sugerencias ya reabiertas** desde el merge de Plays GTM 1 (`dc19f11`) se quedan como estén; no se reparan (no se distingue una reabierta de una nueva). Número afectado: sin dato; se puede medir antes de entregar con un recuento de solo lectura (`suggestions` de esos 9 detectores con `status = 'pending'` y `created_at` anterior al merge) [Por verificar, lo hace Fede o el coordinador con su OK].
- **Avisos ya reenviados:** no se pueden deshacer.
- **Avisos al reanudar:** cada reanudación reenvía por Telegram las de prioridad 1 que la pausa cerró (§8); lo espera el walkthrough.
- Archivos compartidos en el Sprint 3: `src/lib/org-data.ts` solo lo toca este SDD [Por verificar al fijar el sprint]; `src/lib/AGENTS.md` lo tocan varios (cada uno su línea).

## 15. Preguntas para Fede y para la revisión técnica
**Decisión del coordinador (delegación de Fede, 2026-11-09):** D-1 y D-2 (conservar el aplazamiento vigente al reanudar).

**Decisiones:**
- **D-1.** Una sugerencia cerrada de un detector de play se reabre **solo** cuando su play se reanudó después del cierre (fila de `play_states` con `enabled = true` y `updated_at` posterior). Sin filas en `play_states` nada cambia. `notified_at` solo se borra en ese caso de reanudación.
- **D-2** (decisión del coordinador por delegación de Fede, 2026-11-09). Al reanudar se conserva un aplazamiento que siga vigente (vuelve como `snoozed` con su `snoozed_until`), porque NK-0077 lo cita como pérdida («pierden snooze al reanudar») y el valor sigue en la fila.
- **D-3** (del autor). Si la lectura de `play_states` falla, no se reabre ninguna sugerencia de play (al contrario que `loadSnapshot`, que falla abierto para detectar): reabrir por error reenvía avisos; no reabrir solo retrasa una sugerencia hasta la siguiente sincronización.
- **D-4** (del autor). Sin migración: `play_states.updated_at` ya es el marcador.

**Para Fede:** ninguna (D-2 cerrada por el coordinador).

**Para la revisión técnica (respondidas por el gate, pasada 1):**
2. ¿Otro escritor de `suggestions.updated_at` sobre filas `resolved`? En el código, no. `autopilot.server.ts:64` también cierra como `resolved` (§3), pero sella `updated_at` como un cierre más. Queda solo el trigger de la base viva (§16).
3. ¿`notifyUrgent` tiene otra condición que evite el reenvío? No: filtra solo `pending`, prioridad 1 y `notified_at is null` (`proactive.ts:179-227`).

## 16. Pendiente de verificar
- [Por verificar] Que la base viva no tiene un trigger que actualice `suggestions.updated_at` en cada `UPDATE` (en el repo no hay ninguno: `0073` solo crea `suggestions_strategy_guard`, que no toca `updated_at` fuera de las estratégicas). Lo comprueba Fede o el coordinador con una consulta de solo lectura a `pg_trigger`.
- [Por verificar] Que `play_states` (0077) está aplicada en la base viva; si no lo está, la lectura falla y aplica D-3 (nada se reabre), que coincide con el comportamiento previo a Plays GTM 1.

**Lo que NO se afirma:**
- No se distingue una sugerencia cerrada por la pausa de una que se cerró sola antes de una pausa y reanudación posteriores (§8).
- No se reparan las sugerencias ya reabiertas ni los avisos ya reenviados.
- No se afirma cuántas empresas o sugerencias se vieron afectadas: sin dato.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Un agente `nokko-gate` con contexto fresco lee este SDD y el código, y devuelve su informe. El coordinador lo copia aquí sin editarlo. El gate no aprueba el SDD: informa; la aprobación es de Fede.
- Veredicto del gate (pasada 1, 2026-11-09, `.factory/evidence/sprint3-sdd-gate/gate-pass1.md`): CAMBIOS (0 bloqueantes, 1 mayor, 4 menores). El informe completo está en ese archivo; aquí, cada hallazgo y cómo se resolvió.

### §17 Gate · pasada 1: hallazgos y resolución
| Hallazgo | Resolución |
|---|---|
| **MAYOR P-M1** U-2 actualiza por `id` sin filtrar por estado: carrera que rompe CA-6 | U-2 y §13: cada escritura lleva `.eq("org_id", orgId).eq("id", id).eq("status", "resolved")`. CA-6 añade el caso de carrera (la fila pasa a `dismissed` entre lectura y escritura y sigue `dismissed`). |
| **MENOR P-m1** Comparar instantes, no textos | CA-9 exige `Date.parse` e incluye un caso con formato PostgREST (`+00:00`, microsegundos) frente a `toISOString()` (`Z`). |
| **MENOR P-m2** Falta `autopilot.server.ts:64` como escritor que cierra `resolved` | Añadido a §3; pregunta 2 de §15 respondida con él. |
| **MENOR P-m3** §8 «Varias empresas» incompleto | §8 explica que «members read» exige `current_org()` y que, con otro `orgId`, la lectura da 0 filas y no se reabre nada; CA-7 se prueba con el cliente admin. |
| **MENOR P-m4** Reenvío de avisos al reanudar | Dicho en §8 y §14 para que el walkthrough lo espere. |
| Decisión del coordinador: Plays D-2 | Registrada en §15 como decisión del coordinador por delegación de Fede (2026-11-09); pregunta a Fede retirada. |

## 18. Delta de implementación (lo rellena el agente al entregar)
Pendiente.
