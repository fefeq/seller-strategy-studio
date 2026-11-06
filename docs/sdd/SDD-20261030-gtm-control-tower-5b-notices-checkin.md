# SDD-20261030-gtm-control-tower-5b-notices-checkin · [Feature] Resumen diario, avisos críticos y check-in semanal (fase 5b)

**Tipo:** Feature · **Prioridad propuesta:** Alta
**Estado:** Aprobado por Fede el 2026-10-31 (v4, tras tres pasadas del gate; sin cuarta pasada; con los riesgos declarados del §14) · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-10-31
**PRD:** `docs/prd/PRD-20261030-gtm-control-tower.md` · **Depende de:** SDD 1a (activación y desactivación por rol: U-1 y U-7; resultados clave: U-3), SDD 5a (recuerdos y propuestas para el check-in: U-3 y U-4), SDD 1b (tareas: U-5; puertas: U-6), SDD 2 (día y hora del check-in, zona horaria y preferencias de avisos: U-1), SDD 4a (estado de las fuentes y su cadencia: U-1 y U-2) y los SDD de salida de Lovable A y B para construir · **Coordinar con:** `SDD-20261030-money-moment-notices` (Borrador: avisos de «momentos de dinero» por la misma vía de avisos y preferencias) y `SDD-20261025-theory-u-proactive-decision-support` (Borrador: sugerencias dentro de la app) · **Antes:** `SDD-20261030-gtm-control-tower-5a-agent-memory.md` · **Continúa en:** `SDD-20261030-gtm-control-tower-5c-assistant-server.md`

> Un SDD dice cómo se verifica que está bien hecho. Cada criterio de aceptación (CA-n) debe poder tener una prueba automática que lo nombre.
> Los criterios no nombran tecnología; lo técnico va en el §13 como [Sugerencia — la revisión del gate las valida].
> Las reglas transversales del PRD (§6.2, R-1 a R-10) aplican a todo este SDD. «Organización» es la empresa que usa Nokko; «cuenta» es una empresa prospecto o cliente.
> Este SDD nace de dividir el SDD 5 (v4), que reunía 62 criterios; el original, con las tres pasadas del gate, está archivado en `docs/archivado/SUPERADO-SDD-20261030-gtm-control-tower-5-agent.md`. La numeración de criterios empieza de nuevo en cada uno de los tres.
> El borrador de plan con IA que el SDD 1b dejó a la serie 5 se redacta aparte (SDD 5d, decisión de Fede del 2026-10-31).
> Este SDD cumple lo que 4a dejó a su cargo: el aviso por email o Telegram de «Sin dato reciente» (4a CA-2) y el disparo previo al check-in (4a CA-3). Los criterios nuevos CA-22 y CA-24 van tras CA-12 (H-1) y CA-23 tras CA-21 (H-2), sin reordenar.

## 1. Resumen
Define lo único que el agente hace por iniciativa propia: un **resumen diario**, cinco **avisos críticos** (fuente caída, puerta próxima o vencida, resultado clave en riesgo, gasto al 80 % y al 100 % del presupuesto) y el **check-in semanal** (conversación guiada de unos 10 minutos con el estado de cada objetivo). Reutiliza las preferencias de avisos, el silencio nocturno y los canales que ya existen, conserva los avisos propios actuales y sustituye el informe semanal por el check-in.

## 2. Problema y para quién
La torre de control (SDD 1a y 1b) muestra el estado, pero nadie le recuerda a Fede qué mirar, y hoy los mensajes salen de varios sitios sin una regla común (email diario, resumen de Telegram, informe semanal, avisos del piloto automático). Para Fede (Owner) y Flor (Sales leader). Los demás roles y el Consejo no reciben estos mensajes.

## 3. Evidencia y por qué ahora
- **Código (repo de Nokko, solo lectura, 2026-10-31):**
  - Preferencias de avisos por persona: Telegram «Solo lo importante» por defecto, silencio de 22 a 8 y zona Europe/Madrid, con cuatro niveles («Todo lo que termine», «Solo lo importante», «Solo lo que necesita mi decisión», «Nada por Telegram»); el silencio solo retiene los avisos de la tabla de avisos, que solo salen si tienen menos de 12 horas (`src/lib/jobs.ts`, `src/lib/notices.server.ts`); las sugerencias urgentes y el resumen de Telegram no leen las preferencias ni respetan el silencio (`src/routes/api/public/jobs/proactive.ts`).
  - Email diario por persona a las 8:00 por defecto, de su empresa activa, a todos los miembros (`src/lib/daily-email.server.ts`); resumen de Telegram y sugerencias urgentes con botones desde el trabajo proactivo (`src/routes/api/public/jobs/proactive.ts`); informe semanal de los lunes por Telegram y email al Owner y al Sales leader, con pipeline, deals, leads y segmentos (`src/lib/weekly-report.server.ts`); avisos de trabajo terminado y del piloto automático (`src/lib/notices.server.ts`).
  - El presupuesto de integraciones pausa el trabajo automático al 100 % y marca «Cerca del límite» al 80 % solo en el panel; hoy no se envía ningún aviso (`src/lib/orchestrator/planner.ts`).
- **Entrevista con Fede (2026-10-29 a 31):** avisos críticos (fuente caída, puerta próxima o vencida, resultado clave en riesgo y gasto al 80 % y 100 %) por Telegram y email, con resumen diario y silencio nocturno; check-in semanal (PRD §6.1).
- **Decisiones de Fede para este SDD (2026-10-31):** el agente solo habla por iniciativa propia en el check-in, el resumen diario y los avisos críticos; el check-in es una conversación guiada de unos 10 minutos, uno por persona, que cierra ella, los lunes a las 9:00 por defecto; los avisos críticos respetan siempre el silencio nocturno; el informe semanal se integra en el check-in y el resumen diario sustituye al email diario y al resumen de Telegram actuales; los avisos y el resumen son solo de Owner y Sales leader; un resumen diario por organización; se mantienen los avisos propios existentes.
- Uso real de los envíos actuales: **sin dato** [Por verificar].

## 4. Resultado buscado
- El check-in semanal le lleva a Fede menos de 10 minutos (G-7 del PRD). Medición: duración activa de cada check-in terminado (CA-17). Línea base: sin dato.
- Cada aviso crítico llega a quien puede verlo, una vez por episodio (G-7). Medición: avisos enviados por tipo (los registra el sistema al enviarlos). Línea base: sin dato.

## 5. Alcance
**Incluye:** H-1 y H-2.
**No incluye:**
- Agente, conversaciones, memoria y propuestas (SDD 5a); servidor para asistentes y Telegram (SDD 5c), salvo los avisos por Telegram que este SDD define.
- Fuentes de datos y su estado (SDD 4a); avisos de «momentos de dinero» (SDD `money-moment-notices`).
- Vista del Consejo, runway y gatillo de continuidad (SDD 7).
- Cualquier mensaje a personas distintas de la propia (PRD R-2).
- Amortiguación de avisos que entran y salen del mismo caso.

## 6. Cambios de comportamiento (delta)
**Añadido:** avisos críticos; check-in semanal con su medición; resumen diario único por organización; retención de email y Telegram durante el silencio nocturno para el resumen, los avisos críticos y el check-in.
**Modificado:** el email diario y el resumen de Telegram actuales pasan a ser un solo resumen diario por organización, solo para Owner y Sales leader con la fase activa; el informe semanal del lunes se integra en el check-in; el silencio nocturno pasa a retener también el email y los avisos retenidos dejan de caducar a las 12 horas para estos mensajes.
**Eliminado:** nada se borra (R-7); los avisos propios actuales se conservan (CA-2).

## 7. Historias y criterios de aceptación
Cada CA cita el objetivo G-n del PRD que cubre y el archivo de prueba (ruta por decidir en la implementación [Sugerencia]).

### H-1: Como Owner o Sales leader, quiero recibir solo el resumen diario y los avisos críticos, sin ruido.
- **CA-1** MIENTRAS la fase esté activa para mi rol, el sistema DEBE enviar mensajes nuevos del agente por iniciativa propia (en la app, por Telegram o por email) solo en el check-in semanal, el resumen diario y los avisos críticos, y DEBE abstenerse de enviar cualquier otro; los avisos propios que ya existen no son mensajes del agente y los regula CA-2, y los avisos dentro de la app que fijan otros SDD (SDD 5a CA-24) tampoco cuentan. · cubre G-7, G-10 · prueba: `agent-proactivity.test.ts`
- **CA-2** MIENTRAS la fase esté activa para mi rol, el sistema DEBE conservar sin cambios, tal como funcionan hoy, estos avisos propios que ya existen: trabajo terminado y resultado del piloto automático (con sus preferencias y su silencio nocturno), sugerencias urgentes por Telegram con sus botones, incluido el aviso de cuentas asignadas (que hoy no respetan el silencio nocturno y siguen sin hacerlo) y, cuando existan, los de momentos de dinero; esta lista es cerrada y las sugerencias que se ven dentro de la app no son mensajes; y DEBE dejar el email diario y el resumen diario de Telegram como el resumen de CA-3. · cubre G-7, G-10 · prueba: `existing-notices-regression.test.ts`
- **CA-3** MIENTRAS la fase esté activa para mi rol, el sistema DEBE enviar un resumen diario a cada Owner y Sales leader, uno por organización con la fase activa e indicando la organización, por email a la hora y según el interruptor del email diario actuales (a las 8:00 por defecto) y por Telegram en la tanda diaria y según el interruptor del resumen diario actuales, conservando cada canal su contenido actual (email: tareas, decisiones y trabajo automático; Telegram: «3 cosas para hoy» con sus botones), con el mismo filtro de tareas que el resto de resúmenes (SDD 1b CA-84) y sin el informe semanal (CA-21), sin botones en el resumen de Telegram de una organización que no es la activa de la app (SDD 5c CA-8); el email diario y el resumen diario de Telegram actuales son este resumen, no se envía otro. · cubre G-7 · prueba: `notifications-channels.test.ts`
- **CA-4** MIENTRAS esté en vigor el silencio nocturno de una persona, el sistema DEBE retener el resumen diario y todos los avisos críticos por email y Telegram, sin excepción por tipo, y enviarlos al terminar el silencio, según sus preferencias de avisos; SI el caso de un aviso retenido ya se resolvió, ENTONCES DEBE descartarlo en vez de enviarlo; el aviso dentro de la app (CA-12) no se retiene. · cubre G-7 · prueba: `notifications-channels.test.ts`
- **CA-5** El sistema DEBE avisar de una fuente caída, entendida como un resultado clave de un objetivo Activo que pasa a «Sin dato reciente» (SDD 4a CA-2) o una conexión de la organización que pasa a Error; las demás situaciones de una conexión (por ejemplo «Sin respuesta») y las conexiones personales de Google (SDD 4b) no avisan. · cubre G-7, G-10 · prueba: `critical-alerts.test.ts`
- **CA-6** El sistema DEBE enviar cada aviso crítico al momento, por Telegram solo a quien tenga el nivel «Todo lo que termine» o «Solo lo importante», por email solo a quien tenga el email diario activado, indicando la organización en el aviso por Telegram y por email, y siempre en la app (CA-12), según las preferencias de cada persona. · cubre G-7, G-10 · prueba: `critical-alerts.test.ts`
- **CA-7** El sistema DEBE enviar cada aviso crítico solo al Owner y al Sales leader con la fase activa que pueden ver el elemento afectado, DEBE excluir a los demás roles y al Consejo y DEBE abstenerse de incluir datos de clientes en su texto. · cubre G-10 · prueba: `critical-alerts.test.ts`
- **CA-8** El sistema DEBE enviar un solo aviso crítico por episodio y por persona, DEBE abstenerse de repetirlo mientras siga igual y DEBE registrar cada aviso enviado con su tipo, persona y episodio; un episodio empieza cuando el caso aparece y termina cuando deja de cumplirse, y si reaparece empieza otro; los casos ya abiertos al activar la fase o al pasar a un rol con la fase activa no avisan hasta que cambien de estado. · cubre G-7 · prueba: `critical-alerts.test.ts`
- **CA-9** El sistema DEBE avisar de una puerta próxima (sin confirmar, de un objetivo Activo y con fecha de evaluación en los próximos 14 días, PRD §6.1 «Puertas próximas») y de una puerta vencida (sin confirmar, de un objetivo Activo y con la fecha de evaluación pasada) al Owner y al Sales leader, DEBE terminar el episodio cuando el Owner la confirma y DEBE abstenerse de avisar de las puertas con evento de evaluación en vez de fecha. · cubre G-3, G-7 · prueba: `critical-alerts.test.ts`
- **CA-10** El sistema DEBE avisar cuando un resultado clave de un objetivo Activo pasa al estado «En riesgo» (SDD 1a CA-22), y DEBE terminar el episodio cuando deja de estarlo. · cubre G-7 · prueba: `critical-alerts.test.ts`
- **CA-11** El sistema DEBE avisar cuando el gasto mensual de integraciones llega al 80 % y, por separado, al 100 % del presupuesto de la organización, una vez por umbral y por mes aunque el Owner cambie el límite (esta regla prevalece sobre CA-8), DEBE enviar solo el aviso del umbral más alto si una lectura salta varios y contar el umbral saltado como avisado, DEBE terminar el episodio de gasto al acabar el mes, contado en UTC como la pausa actual, y DEBE abstenerse de avisar si la organización no tiene presupuesto fijado. · cubre G-6, G-7 · prueba: `critical-alerts.test.ts`
- **CA-12** El sistema DEBE mostrar cada aviso crítico también en la app, con independencia de que la persona tenga conectado Telegram o email, y DEBE marcarlo como resuelto cuando termina su episodio. · cubre G-7 · prueba: `critical-alerts.test.ts`
- **CA-22** DONDE el Owner active la fase para un rol distinto de Owner y Sales leader, el sistema DEBE dejar de enviarle el email diario y el resumen de Telegram actuales y DEBE abstenerse de enviarle resumen diario, avisos críticos y check-in. · cubre G-10 · prueba: `notifications-channels.test.ts`
- **CA-24** MIENTRAS la fase no esté activa para mi rol, el sistema DEBE mantener sin cambios el email diario, el resumen de Telegram y el informe semanal actuales (PRD R-9). · cubre G-10 · prueba: `notices-phase-guard.test.ts`

### H-2: Como Owner o Sales leader, quiero un check-in semanal guiado de unos 10 minutos.
- **CA-13** El sistema DEBE convocar el check-in de cada Owner y Sales leader con la fase activa cada lunes a las 9:00 en la zona horaria de la organización (Europe/Madrid por defecto), mientras el Owner no fije otro día u hora (SDD 2 CA-22 y CA-23), y DEBE convocar como máximo uno por persona, organización y semana (de lunes a domingo en la zona horaria de la organización), con el día y la hora vigentes al llegar el momento. · cubre G-7 · prueba: `weekly-checkin.test.ts`
- **CA-14** CUANDO llega el momento del check-in, el sistema DEBE haber lanzado 15 minutos antes la lectura de las fuentes automáticas (SDD 4a CA-3) y, SI alguna falla o no ha terminado, ENTONCES DEBE usar lo leído hasta ese momento y mostrar su último valor con su antigüedad y, solo si se cumple SDD 4a CA-2, «Sin dato reciente» (PRD R-6), sin retrasar el check-in. · cubre G-7 · prueba: `weekly-checkin.test.ts`
- **CA-15** El sistema DEBE preparar el check-in con, por cada objetivo Activo, su estado, cada resultado clave con su fuente y antigüedad (PRD R-1), las decisiones pendientes y las puertas que se evalúan en los próximos 14 días (PRD §6.1; solo informativas, con enlace a su pantalla), las fuentes en «Sin dato reciente», los recuerdos de ese objetivo (SDD 5a CA-14 y CA-16) y, de la persona, las tareas «Sin asignar» que ve y sus propuestas pendientes (excepción deliberada a SDD 1b CA-84, aprobada por Fede el 2026-10-31, solo para esta revisión), sin usar el calendario ni el correo de nadie (SDD 5a CA-28). · cubre G-7 · prueba: `weekly-checkin.test.ts`
- **CA-16** CUANDO abro el check-in, el sistema DEBE guiarme ítem a ítem: en una tarea «Sin asignar», confirmar es asignarla a una iniciativa y descartar es archivarla; en una propuesta, aprobarla o descartarla (SDD 5a CA-21 y CA-31), mostrando su coste previo cuando lo tenga (SDD 5a CA-29); las decisiones pendientes y las puertas son solo informativas; el sistema DEBE abstenerse de aplicar nada que yo no confirme, DEBE mostrar como ya asignada una tarea que otra persona asignó antes y DEBE dejar los ítems sin responder pendientes en sus pantallas sin repetirlos como aviso. · cubre G-7, G-10 · prueba: `weekly-checkin.test.ts`
- **CA-17** El sistema DEBE registrar la apertura y el cierre de cada check-in, con la persona, y la hora de cada ítem respondido; el cierre es «terminado» cuando la persona pulsa Terminar y «cerrado sin terminar» cuando llega el siguiente check-in sin que lo haya hecho; un check-in convocado y nunca abierto está «sin abrir», pasa a «cerrado sin terminar» al llegar el siguiente y ya no se puede abrir; DEBE medir la duración solo con los terminados, desde la apertura hasta Terminar, partida en tramos por cada vez que se abre (también si se retoma otro día), cada respuesta y Terminar, y descartando los tramos de más de 30 minutos, y DEBE abstenerse de reabrir un check-in terminado. · cubre G-7 · prueba: `weekly-checkin.test.ts`
- **CA-18** El sistema DEBE convocar el check-in a cada Owner y Sales leader con la fase activa (uno por persona y por organización), por la app y, con los mismos niveles de Telegram y de email que CA-6, por esos canales, indicando la organización, y DEBE hacer que su cierre no afecte al de otra persona. · cubre G-7 · prueba: `weekly-checkin.test.ts`
- **CA-19** MIENTRAS esté en vigor el silencio nocturno de una persona, el sistema DEBE retener su check-in por email y Telegram y enviarle el aviso al terminar el silencio, salvo que ya lo haya terminado en la app, en cuyo caso DEBE descartarlo; la convocatoria dentro de la app no se retiene. · cubre G-7 · prueba: `weekly-checkin.test.ts`
- **CA-20** CUANDO el Owner desactiva la fase para un rol, el sistema DEBE dejar de convocar su check-in y de enviarle el resumen diario nuevo y los avisos críticos, DEBE volver a enviarle el email diario, el resumen de Telegram y el informe semanal actuales (CA-24; SDD 1a CA-6), DEBE descartar sus avisos retenidos, DEBE cerrar como «cerrado sin terminar» su check-in abierto y, al reactivarla, DEBE volver a hacerlo sin repetir el aviso de los episodios que seguían abiertos. · cubre G-10 · prueba: `weekly-checkin.test.ts`
- **CA-21** El sistema DEBE enviar el informe semanal del lunes solo dentro del check-in, calculándolo al prepararlo, con el pipeline, los deals, los leads y los segmentos que hoy lleva; DEBE ocultar la tarjeta del informe semanal en Sugerencias e Inicio a quien tiene la fase activa, DEBE hacer que el botón «Informe de la semana ahora» prepare el informe dentro del check-in, DEBE excluirlo del resumen diario de esas personas y DEBE abstenerse de enviarlo aparte a quien tiene la fase activa. · cubre G-7, G-10 · prueba: `weekly-report-in-checkin.test.ts`
- **CA-23** CUANDO una persona pierde el rol que le da el check-in o sale de la organización, el sistema DEBE descartar sus avisos retenidos y cerrar como «cerrado sin terminar» su check-in abierto. · cubre G-10 · prueba: `weekly-checkin.test.ts`

## 8. Casos límite y errores
Cada caso remite al CA que lo cubre.
- Mensaje del agente fuera de check-in, resumen o avisos críticos → no se envía (CA-1).
- Check-in sin día ni hora cambiados por el Owner → lunes a las 9:00 (CA-13); check-in que cae en el silencio nocturno → retenido por email y Telegram (CA-19).
- Fuente que falla antes del check-in → último valor con su antigüedad y, solo si pasa el doble del intervalo, «Sin dato reciente» (CA-14).
- Ítems sin responder al cerrar el check-in → pendientes sin repetir (CA-16).
- Silencio nocturno → resumen y avisos retenidos hasta el final (CA-4).
- Mismo caso crítico en lecturas sucesivas → un solo aviso (CA-8).
- Persona sin canal conectado → recibe el aviso solo en la app (CA-12).
- Caso crítico que se resuelve durante el silencio → aviso descartado (CA-4).
- Presupuesto sin fijar o mes nuevo → sin aviso o episodios reiniciados (CA-11).
- Persona en dos organizaciones → un resumen diario por cada una (CA-3).
- Dos personas con la misma tarea «Sin asignar» en el check-in → la segunda la ve ya asignada (CA-16).
- Fase desactivada para un rol → sin check-in, resumen ni avisos críticos (CA-20).
- Informe semanal del lunes → solo dentro del check-in (CA-21).
- Persona sin Telegram o con nivel «Solo lo que necesita mi decisión» o «Nada por Telegram» → el aviso crítico solo le llega en la app y, si lo tiene activado, por email (CA-6).
- Conexión en «Sin respuesta» → no es fuente caída y no avisa (CA-5).
- Puerta con evento de evaluación → no avisa (CA-9).
- Fase desactivada con check-in abierto o persona que pierde el rol → check-in cerrado sin terminar y avisos retenidos descartados (CA-20, CA-23).
- Límite de gasto subido a mitad de mes o lectura que salta del 79 % al 100 % → un solo aviso por umbral y mes, el del umbral más alto (CA-11).
- Resultado clave «En riesgo» que pasa a «Sin dato reciente» → episodio de fuente caída (CA-5, CA-10).
- Rol distinto de Owner y Sales leader con la fase activa → sin resumen, avisos ni check-in (CA-22).
- Fase no activa → email diario, resumen de Telegram e informe semanal sin cambios (CA-24); fase desactivada → vuelven los actuales (CA-20).
- Check-in convocado y nunca abierto → «sin abrir» y, al llegar el siguiente, «cerrado sin terminar» (CA-17).
- Check-in terminado en la app durante el silencio → aviso retenido descartado (CA-19).
- Fase reactivada con episodios abiertos → sin repetir avisos (CA-20).
- Check-in cambiado de día a mitad de semana → uno solo por persona, organización y semana (CA-13).
- Persona con la fase activa en dos organizaciones → un check-in por cada una (CA-13, CA-18).
- Fase activada con casos críticos ya abiertos → sin aviso hasta que cambien de estado (CA-8).

## 9. Experiencia y copy
Sistema visual actual (Ink + Lima, versalitas con filete, sin iconos), textos en «tú».
- Los avisos críticos tienen un texto fijo por tipo («Hay una fuente sin datos recientes», «Hay una conexión con error», «Hay una puerta que se evalúa pronto», «Hay una puerta vencida», «Hay un resultado clave en riesgo», «El gasto en integraciones ha llegado al 80 %», «El gasto en integraciones ha llegado al 100 %: las acciones automáticas están en pausa») y apuntan a la pantalla; no llevan nombre de cuenta ni de persona (CA-7).
- **Pantallas:** el check-in guiado con una tarjeta por ítem y confirmar o descartar (CA-16); las preferencias de avisos (canales y silencio) y el día y la hora del check-in, que construye el SDD 2 (SDD 2 CA-23) y no se repiten aquí. Todos los avisos por Telegram y email indican la organización (CA-6, CA-18, CA-3).

## 10. Datos, permisos y privacidad
- **Conceptos nuevos:** registro de apertura, cierre y hora de cada ítem del check-in; registro de avisos críticos enviados por tipo, persona y episodio.
- **Acceso:** las estructuras nuevas llevan organización por defecto la actual, acceso filtrado por organización y permisos explícitos; el trabajo programado, que usa un cliente privilegiado, filtra por organización y persona explícitamente [Sugerencia — el gate valida].
- **Matriz de permisos:**

| Acción | Owner | Sales leader | Consejo | Otros roles |
|---|---|---|---|---|
| Recibir el resumen diario, los avisos críticos y el check-in | Sí | Sí | No | No (CA-7, CA-22) |
| Cambiar el día y la hora del check-in (SDD 2 CA-23) | Sí | No | No | No |
| Responder ítems del check-in | Los suyos | Los suyos | No | No |

- **Privacidad:** los avisos no llevan datos de clientes; el check-in no usa calendario ni correo (CA-15); ningún dato de clientes en pruebas ni ejemplos.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| Preparación del check-in y del resumen | Sin IA: salen de datos ya calculados | — | No |
| Check-in guiado | Sin IA: tarjetas con confirmar o descartar (CA-16) | — | No |

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero [Sugerencia] | Depende de |
|---|---|---|---|---|
| U-1 | Resumen diario, silencio nocturno, avisos críticos, avisos existentes y límite de mensajes por iniciativa | CA-1 a CA-12, CA-22, CA-24 | `agent-proactivity.test.ts`, `existing-notices-regression.test.ts`, `notices-phase-guard.test.ts`, `notifications-channels.test.ts`, `critical-alerts.test.ts` | SDD 1a U-1 (activación por rol), SDD 4a U-1 y U-2 (estado de fuentes), SDD 1a U-3 (resultados clave), SDD 1b U-5 y U-6 (tareas y puertas), SDD 2 U-1 (preferencias y zona horaria) |
| U-2 | Check-in semanal guiado, su medición, la pausa al desactivar la fase y el informe semanal integrado | CA-13 a CA-21, CA-23 | `weekly-checkin.test.ts`, `notices-phase-guard.test.ts`, `weekly-report-in-checkin.test.ts` | U-1, SDD 5a U-3 y U-4 (recuerdos y propuestas), SDD 1b U-5, SDD 1a U-7 (desactivación y decisiones), SDD 2 U-1, SDD 4a U-2 |

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- **Silencio y retención (CA-4, CA-19):** es comportamiento nuevo: hoy el silencio solo retiene Telegram y los avisos retenidos solo salen si tienen menos de 12 horas; retener también el email y los silencios largos exige cambiarlo. El aviso dentro de la app no se retiene.
- **Resumen diario (CA-3):** el email actual solo sale para la empresa activa de la persona (`daily-email.server.ts`); «uno por organización» obliga a recorrer todas sus membresías, no `current_org_id`. Sustituye al envío actual de Telegram y al email diario sin duplicarlos; el resumen de Telegram se dispara por un trabajo externo, sin hora por persona (`kind: "digest"`), y depende del interruptor `daily_digest`, no del nivel de Telegram. Una persona con la fase activa en A e inactiva en B recibe el resumen nuevo de A y, si B es su empresa activa, el email actual de B (dos correos, sin duplicado; PRD R-9).
- **Informe semanal (CA-21):** `weekly-report.server.ts` sale los lunes desde las 6:00 UTC; su contenido pasa al check-in.
- **Avisos existentes (CA-2):** `notifyUrgent` también empuja por Telegram «Te han asignado N cuentas» (detector `account_assigned`).
- **Avisos críticos:** se calculan sobre el estado de 4a y 1b en el trabajo horario que ya existe; reutilizan `NoticePrefs`, `telegramDecision` y `flushHeldNotices`.
- **Check-in:** el disparo previo es una lectura de fuentes (4a CA-3) justo antes de la convocatoria; el trabajo programado lo da Inngest o el cron horario actual.
- Migraciones aditivas con organización por defecto; las 0058 y 0059 siguen sin aplicar (`src/lib/AGENTS.md`).

## 14. Riesgos y dependencias
- Depende de 1a (activación y desactivación por rol), del SDD 5a (recuerdos y propuestas) y de 4a y 1b (estado de fuentes, resultados clave, puertas); si 5a no está activo no hay propuestas ni recuerdos que revisar en el check-in.
- **Excepción al SDD 2:** CA-11 cuenta el mes del presupuesto en UTC, como la pausa actual, aunque SDD 2 CA-22 pide la zona horaria de la organización para los plazos que dependen del día.
- **Valor del autor a confirmar:** la lectura previa de CA-14 se lanza 15 minutos antes; Fede no ha fijado ese plazo.
- **Aprobado sin cuarta pasada:** Fede aprobó 5a, 5b y 5c con los riesgos declarados (2026-10-31); no se han verificado el bot de Telegram en producción, el horario externo del resumen ni las reglas de acceso aplicadas.
- **Ruido:** un caso que entra y sale repetidamente genera un aviso cada vez (CA-8); no hay amortiguación. Un resultado clave «En riesgo» que pasa a «Sin dato reciente» cierra su episodio «En riesgo» y abre uno de fuente caída, y al volver el dato avisa otra vez de «En riesgo» (SDD 1a CA-24).
- **Fuente caída** agrupa dos situaciones (resultado clave sin dato reciente y conexión en Error): un mismo problema puede dar dos avisos de episodios distintos (CA-5).
- **Medición de G-7:** el check-in puede abrirse un día y terminarse otro; CA-17 registra la hora de cada ítem y descarta los tramos de más de 30 minutos (decisión de Fede).
- El SDD `money-moment-notices` (Borrador) usa la misma vía de avisos y preferencias; coordinar para no duplicar canales. Las sugerencias dentro de la app del SDD de Theory U (Borrador) y los avisos propios que ya existen (CA-2) no son mensajes nuevos del agente; CA-1 solo limita estos últimos.
- Los envíos actuales a todos los miembros (email diario y resumen de Telegram) dejan de llegar a los roles distintos de Owner y Sales leader cuando se les activa la fase (CA-3, CA-22) (decisión de Fede, 2026-10-31).
- Las puertas con evento de evaluación en vez de fecha no avisan (CA-9).
- Rotar claves de correo o Telegram (salida de Lovable B) puede interrumpir los envíos.

## 15. Preguntas para Fede y para la revisión técnica
- Resuelto por Fede (2026-10-31, tras la segunda pasada de 5b): el resumen de Telegram sigue el interruptor del resumen diario actual (CA-3); el informe del lunes se calcula al preparar el check-in y se excluye del resumen diario (CA-21); al reactivar la fase no se repite el aviso de episodios abiertos (CA-20); el Error de una conexión personal de Google no cuenta como fuente caída (CA-5).
- Resuelto por Fede (2026-10-31, tras la primera pasada del gate de 5b): la duración del check-in descarta los huecos de más de 30 minutos (CA-17); el aviso del 80 % y el del 100 % salen una vez por mes aunque cambie el límite (CA-11); cada canal conserva el contenido del resumen actual (CA-3); la tarjeta del informe semanal se oculta con la fase activa (CA-21).
- Resuelto por Fede (2026-10-31): lo indicado en el §3 y, tras la tercera pasada del SDD 5 original: se aprueba la excepción a 1b CA-84 solo en el check-in (CA-15); al activar la fase para otros roles dejan de recibir el email diario y el resumen de Telegram actuales (CA-3); el informe del lunes entra completo en el check-in (CA-21); el aviso crítico por email sale al momento (CA-6).
- Revisión técnica: ¿hay un bot de Telegram en producción y a qué hora se dispara hoy el resumen?

## 16. Pendiente de verificar
- Uso real de los envíos actuales y si hay un bot de Telegram en producción → Fede y datos de producción.
- Horario externo del trabajo que envía el resumen de Telegram (CA-3) → gate.
- Migraciones 0058 y 0059 sin aplicar → gate.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
**Primera pasada del gate (2026-10-31, sobre la v1).** Informe copiado sin editar. Los hallazgos de las tres pasadas del SDD 5 original que atañen a este SDD estaban aplicados en los criterios o declarados en el §14 y el §15.

**Veredicto:** Cambios menores

El 5b funciona como documento independiente. Los 21 CA están en EARS, con G-n y prueba, y cada uno está en una sola unidad (CA-1 a CA-12 en U-1, CA-13 a CA-21 en U-2). Las citas a 1a, 1b, 2 y 4a existen, están en las unidades que el 5b declara y dicen lo que el 5b afirma. Los bloqueantes de la tercera pasada que tocaban a este SDD están resueltos:
- El informe semanal pasa a CA-21, en U-2, con su contenido, y ya no hay dependencia hacia adelante.
- CA-14 se alinea con 4a CA-2.
- CA-6 fija una regla de canal común a los cinco tipos de aviso.

No he encontrado nada que bloquee la aprobación. Quedan una ambigüedad entre CA-8 y CA-11, citas erróneas a 5a, una corrección que el §15 da por hecha y no está aplicada, y varios huecos de ciclo de vida.

**Bloqueantes**

Ninguno.

**Cambios menores**

*Contradicciones y ambigüedades entre CA*
1. **CA-8 (L58) frente a CA-11 (L61).**
   - CA-8 dice que, si un caso reaparece, empieza otro episodio. CA-11 dice «una vez por umbral y por mes».
   - Si el Owner sube el límite a mitad de mes y el gasto vuelve a cruzar el 80 %, la prueba no sabe qué regla manda.
   - Tampoco está definido qué pasa si una sola lectura salta del 79 % al 100 %: ¿salen los dos avisos o solo el del 100 %?
   - Falta decir en qué zona horaria empieza el mes. Hoy el gasto se cuenta desde el día 1 a las 00:00 UTC (`orchestrator/runner.ts:25`).
   - Cómo resolverlo: en CA-11, «CA-11 prevalece sobre CA-8 para el gasto», qué se envía en el salto directo y «mes en UTC, como la pausa».
2. **CA-5 (L55) no filtra por objetivo Activo; CA-9 y CA-10 sí.** Un resultado clave de un objetivo Pausado que pasa a «Sin dato reciente» avisaría. Además, no dice si cuenta el Error de las conexiones personales de Google de 4b, que son por persona.
3. **CA-10 frente a 1a CA-24.** Un resultado clave «En riesgo» que pasa a «Sin dato reciente» deja de calcular su estado (1a CA-24). Eso cierra el episodio «En riesgo» y abre uno de «fuente caída»; al volver el dato, sale otro aviso «En riesgo». Conviene añadirlo al §14 (L135-136) como ruido conocido.

*Citas a 5a y dependencias*

4. **SDD 5a CA-36 no dice lo que el 5b le atribuye** (matriz §10, L106; §14, L139). 5a CA-36 no menciona resumen, avisos ni check-in: la frase «sin resumen ni avisos críticos» del CA-45 original se quedó fuera al dividir. Ningún CA dice ya que los otros roles con la fase activa pierden el email diario y el resumen de Telegram; solo se deduce de CA-2 más CA-3. Cómo resolverlo: decirlo en CA-3 y quitar la cita a 5a CA-36.
5. **Dependencia mal atribuida** (cabecera L5 y U-1 en L121): «SDD 5a U-1 (fase activa por rol)».
   - 5a U-1 es la guardia del agente. La activación por rol es 1a CA-5 (1a U-1) y la desactivación, 1a CA-6 (1a U-7).
   - CA-20 necesita 1a CA-6, y CA-15 las decisiones pendientes (1a U-7).
   - Ninguna está declarada. Hoy llegan solo de forma transitiva, vía 1b U-6.
   - Cómo resolverlo: U-1 depende de 1a U-1 y U-2 de 1a U-7, sin pasar por 5a U-1. Así U-1 deja de esperar al agente.
6. **La guardia R-9 de lo que el 5b cambia vive en 5c.** El 5b modifica el email diario, el resumen de Telegram y el informe semanal. La prueba de que no cambian con la fase inactiva es 5c CA-5 (`assistant-phase-guard.test.ts`), que además no cubre el informe semanal. Si el 5b se entrega antes que el 5c, nada lo prueba. Cómo resolverlo: un CA de guardia propio en U-1 (email diario y resumen de Telegram) y en U-2 (informe semanal).

*Corrección dada por hecha que no está aplicada*

7. **CA-6 (L56) no dice que el aviso por email sale al momento.** El §15 (L144) dice «el aviso crítico por email sale al momento (CA-6)» y el PRD §6.1 (L141) lo recoge, pero CA-6 no lo dice. El §17 (L154) afirma que todo lo de las pasadas está aplicado.

*CA-2 y el código actual*

8. **CA-2 (L52)** conserva las sugerencias urgentes «con sus mismas preferencias y silencio nocturno». Pero `notifyUrgent` y `sendDigests` (`proactive.ts:104-144`) no leen `notification_prefs` ni respetan el silencio: envían a cualquier hora a todo el que tenga Telegram vinculado.
   - Hay que decir que «sin cambios» manda, es decir, que siguen sin silencio.
   - Corregir el §3 (L22): el silencio solo retiene los avisos de la tabla `notifications`.
9. **El cierre de CA-2 no está claro.** CA-1 dice que los avisos existentes «los regula CA-2», pero CA-2 no dice si su lista es cerrada.
   - Quedan sin clasificar las Sugerencias de los detectores dentro de la app y la tarjeta del informe semanal. Esa tarjeta es una sugerencia con `user_id` nulo, visible a todos (`weekly-report.server.ts:50`).
   - CA-21 («solo dentro del check-in») no dice si esa tarjeta se oculta.
   - Tampoco se dice si el aviso en la app a quien aprobó un cambio deshecho (5a CA-24) entra en el límite de CA-1. La tercera pasada ya lo señaló.

*Lo que CA-3 deja sin definir*

10. **CA-3 (L53) no define el contenido del resumen.**
    - El email actual (tareas, decisiones, trabajo automático) y el resumen de Telegram («3 cosas para hoy», con botones Hecho y Posponer) son distintos. Hay que decir si cada canal conserva el suyo.
    - La «hora» del resumen de Telegram no existe hoy. El §9 (L97) dice que la construye SDD 2 CA-23, pero ese CA solo fija el día y la hora del check-in y de los rituales. Nadie la construye.

*Ciclo de vida del check-in*

11. **CA-17 (L69) y CA-20 (L72): falta definir:**
    - el estado «sin abrir»;
    - qué pasa con un check-in abierto cuando se desactiva la fase: como no llega el siguiente, no se cierra nunca, y no está claro si se puede responder con las propuestas congeladas (5a CA-34);
    - qué pasa si el Owner cambia el día a mitad de semana;
    - qué pasa con un aviso retenido o un check-in abierto de quien pierde el rol;
    - qué pasa con un episodio en curso al reactivar la fase.
12. **CA-16 (L68) no dice qué se hace con las decisiones pendientes** que CA-15 incluye. Hay que declararlas informativas, como las puertas. Además, al aprobar una propuesta con coste desde el check-in debería mostrarse el coste previo (5a CA-29, 4a CA-14) y aplicarse los estados de 5a CA-31, no solo CA-21.
13. **CA-13 (L65) y CA-18 (L70) se solapan** (los dos convocan a cada Owner y Sales leader). CA-18 dice «el canal de avisos que haya elegido» sin decir qué nivel de Telegram basta para la convocatoria.
14. **CA-14 (L66) llama «resumen» a la preparación del check-in**, y se confunde con el resumen diario. Tampoco fija con cuánta antelación se hace la lectura previa.

*Otros*

15. **Los avisos críticos por email no indican la organización.** 5c CA-9 solo cubre Telegram (R-10).
16. **El aviso en la app (CA-12, L62)** no dice si se cierra o se marca resuelto cuando termina el episodio.
17. **§4 (L31):** ningún CA obliga a registrar «avisos enviados por tipo». El §10 lo nombra como concepto nuevo, pero no hay prueba.
18. **§13 (L126), resuelve el «Por verificar» del §16 (L150), y es inexacto.** El email actual solo sale para la empresa activa (`daily-email.server.ts:71,82`):
    - Si la empresa activa es A (fase activa), recibe el resumen nuevo de A y nada de B.
    - Si es B (fase inactiva), recibe el email actual de B y el resumen nuevo de A. No hay duplicado, pero sí dos correos.
    - Además, «uno por organización» obliga a recorrer todas las membresías, no `current_org_id`. Es comportamiento nuevo y el §13 no lo dice.
19. **§3 (L24): hoy no se envía ningún aviso al 80 %.** Es solo una etiqueta del panel («Cerca del límite», `budget-panel.tsx:37`). También existe la columna `org_budgets.warn_pct` (por defecto 0.8, migración 0041), que nadie usa; CA-11 fija el 80 %.
20. **Coherencia menor:**
    - CA-15 escribe «objetivo activo» en minúscula; el estado es «Activo» (1a CA-11).
    - El PRD §8 asigna al 5b G-7 y G-10, pero CA-9 cubre G-3 y CA-11, G-6.
    - El §8 no tiene casos para: fase desactivada con check-in abierto, pérdida de rol, límite subido a mitad de mes, salto directo al 100 % y resultado clave «En riesgo» que pasa a «Sin dato reciente».

**Preguntas para Fede**

1. ¿Qué criterio descarta las pausas largas en la duración del check-in (CA-17)? Sin él, la medición de G-7, el único resultado medible de este SDD, queda en manos del brief.
2. Si subes el límite a mitad de mes y el gasto vuelve a pasar el 80 %, ¿avisamos otra vez?
3. ¿El resumen conserva en cada canal el contenido actual, o pasa a ser un resumen único?
4. Con la fase activa, la tarjeta del informe del lunes en Sugerencias, ¿se oculta?
5. ¿El Error de una conexión personal de Google (4b) cuenta como «fuente caída»?

**Hechos de código verificados / no verificados**

Verificados:
- `NoticePrefs`: «Solo lo importante» por defecto, silencio de 22 a 8, Europe/Madrid, y las cuatro etiquetas de nivel (`jobs.ts:100-108`).
- `telegramDecision` y `flushHeldNotices` con la ventana de 12 h (`notices.server.ts:48-50`). El silencio solo afecta a esos avisos de Telegram.
- Email diario por persona, a las 8:00 por defecto, de la empresa activa, a todos los miembros (`daily-email.server.ts:71-83`, `daily-email.ts:6`).
- Resumen de Telegram y sugerencias urgentes con botones, incluido `account_assigned` (`proactive.ts:104-144`, disparo `kind: "digest"`).
- Informe semanal: los lunes desde las 6:00 UTC, al Owner y al Sales leader, por Telegram (solo con `daily_digest`) y por email. Lleva deals, leads, segmentos y etapas (`weekly-report.server.ts:12-31,67-92`).
- Aviso del piloto automático (`notices.server.ts:54`).
- Umbrales del 80 % y 100 % en `orchestrator/planner.ts:62-66`.
- Estados de conexión «Error» y «Sin respuesta» (`connections.ts:38-45`).
- Referencias a Inngest en `proactive.ts`.
- Migraciones 0058 y 0059 sin aplicar (`src/lib/AGENTS.md`).

Inexactos: el §3 (L22) sobre el alcance del silencio (menor 8), el §3 (L24) sobre el aviso al 80 % (menor 19) y el §13 (L126) sobre dos organizaciones (menor 18).

No verificados:
- Si hay un bot de Telegram en producción, y el horario externo del cron `digest`.
- Si Inngest está activo en producción.
- Si las reglas de acceso de las migraciones están aplicadas así en producción.

**Límites de la revisión**

- Solo he leído documentos y código locales. No he consultado la base de datos ni ejecutado pruebas.
- De 1a, 1b, 2 y 4a leí los CA citados, las tablas de unidades y lo que dejaron al SDD 5. De 5a y 5c, solo lo que el 5b cita o que lo toca.
- De `money-moment-notices` solo revisé el solape de canales y del silencio.
- El documento no tiene datos de clientes. Sus cifras (10 minutos, 14 días, 80 % y 100 %, 9:00, 22 a 8, 12 horas) vienen del PRD §6.1 o del código.

**Respuesta del autor (v2, 2026-10-31).** El informe está copiado sin editar arriba (sin bloqueantes). Decisiones de Fede: la duración del check-in descarta huecos de más de 30 minutos (CA-17); el aviso del 80 % y el del 100 % salen una vez por mes aunque cambie el límite (CA-11); cada canal conserva el contenido del resumen actual (CA-3); la tarjeta del informe semanal se oculta (CA-21).

Cambios: CA-6 dice que el aviso por email sale al momento e indica la organización; CA-11 prevalece sobre CA-8, avisa del umbral más alto en un salto y cuenta el mes en UTC; CA-5 se limita a objetivos Activos y conexiones de la organización; CA-2 declara que las sugerencias urgentes no respetan el silencio y que su lista es cerrada; CA-3 define el contenido y la hora de cada canal; nuevos CA-22 (otros roles pierden el email y el resumen actuales, sin citar 5a CA-36), CA-23 (pérdida de rol) y CA-24 (guardia de fase propia); CA-8 registra los avisos; CA-12 marca resuelto; CA-14, CA-15, CA-16, CA-17, CA-18 y CA-20 precisados; dependencias corregidas (1a U-1 y U-7, no 5a U-1); §3, §9, §13, §14, §15 y §16 corregidos. No hay nueva pasada sobre esta v2.

**Segunda pasada del gate (2026-10-31, sobre la v2).** Informe copiado sin editar.

**Veredicto:** Cambios menores

He comprobado la respuesta del autor en el §17 contra la v2. Casi todo lo que dice está aplicado: CA-5, CA-6, CA-8, CA-11, CA-12, CA-22, CA-23, CA-24, las dependencias de 1a U-1 y U-7, el §3 y la tabla de PRD §8 (5b ya cubre G-3 y G-6). Los 24 CA están en una sola unidad y cada uno tiene su prueba. No queda ninguna cita a 5a CA-36. Hay tres cosas que la respuesta da por corregidas y no lo están del todo (menores 5, 7 y 8). Además he encontrado una contradicción nueva entre CA-3 y CA-21.

**Bloqueantes**

Ninguno.

**Cambios menores**

1. **CA-3 (L53) contradice CA-21 (L75).**
   - El informe del lunes se guarda como sugerencia pendiente de prioridad 2, visible para toda la organización (`weekly-report.server.ts:50`).
   - Tanto el email diario como el resumen de Telegram eligen sus 3 elementos de las sugerencias pendientes sin filtrar por detector (`daily-email.server.ts:58`, `proactive.ts:131-132`, `proactive/index.ts:28`).
   - Como CA-3 conserva ese contenido, el informe vuelve a salir aparte dentro del resumen, con botones Hecho y Posponer. Eso choca con «abstenerse de enviarlo aparte».
   - Cómo resolverlo: en CA-21, excluir el informe semanal del resumen diario de quien tiene la fase activa.

2. **CA-21 frente a CA-24 (L64): no se sabe a quién se le oculta la tarjeta.**
   - «Ocultar la tarjeta del informe semanal en Sugerencias» no dice para quién. El matiz «a quien tiene la fase activa» va solo con la última obligación.
   - La tarjeta es una sola fila compartida, y CA-24 exige que el informe siga igual para los roles sin la fase. El §15 (L152) dice «con la fase activa», pero el CA no.
   - Además, si el Owner mueve el check-in (CA-13), el informe se sigue generando el lunes desde las 6:00 UTC. Falta decir si se calcula al preparar el check-in.
   - Cómo resolverlo: «oculta la tarjeta a quien tiene la fase activa» y «el informe se calcula al preparar el check-in».

3. **CA-17 (L71): la duración no es medible sin ambigüedad.**
   - «Sumando los tramos entre una respuesta y la siguiente» deja fuera el tramo de la apertura a la primera respuesta y el de la última respuesta a Terminar. Un check-in con un solo ítem mediría 0.
   - Afecta a G-7, el único resultado medible del SDD.
   - Cómo resolverlo: medir de la apertura a Terminar, partido en tramos por la apertura, cada respuesta y Terminar, y descartar los tramos de más de 30 minutos.

4. **CA-11 frente a CA-8 y CA-12: queda abierto cuándo termina un episodio de gasto.**
   - «Prevalece sobre CA-8» no aclara si el episodio de gasto termina cuando el gasto baja (CA-8) o al acabar el mes. De eso depende cuándo CA-12 marca resuelto el aviso en la app.
   - Si una lectura salta directa al 100 % y luego el Owner sube el límite y el gasto queda en el 85 %, no se sabe si sale el aviso del 80 %, que ese mes no salió.
   - Cómo resolverlo: «el episodio de gasto dura hasta fin de mes» y «saltar un umbral cuenta como avisado».

5. **Ciclo de vida: tres huecos que la primera pasada (menor 11) ya señaló y siguen abiertos.**
   - **Cambio de día a mitad de semana.** El Owner cambia el día del check-in a mitad de semana: no se dice si hay dos convocatorias o ninguna esa semana.
   - **Episodio en curso al reactivar.** Al reactivar la fase (CA-20, L74), no se dice si un episodio que ya estaba en curso vuelve a avisar.
   - **Check-in «sin abrir».** No se dice si sigue «sin abrir» o pasa a «cerrado sin terminar» cuando llega el siguiente, ni si todavía se puede abrir.
   - Hay dos huecos más:
     - CA-20 no dice que se descarten los avisos retenidos al desactivar la fase, cosa que CA-23 sí dice para la pérdida de rol.
     - CA-19 (L73) no dice si el aviso retenido por email o Telegram sale igual cuando la persona ya terminó el check-in en la app durante el silencio.
   - Cómo resolverlo: una frase por caso en CA-17, CA-19 y CA-20, y sus líneas en el §8.

6. **Organización en los avisos (PRD R-10): 5b no la exige en todos sus canales.**
   - CA-3 indica la organización en los dos canales del resumen.
   - CA-6 (L56) la indica solo en el email.
   - CA-18 (L72) no la indica en la convocatoria.
   - Los textos fijos del §9 (L104) no la llevan.
   - Por Telegram la exige 5c CA-9, que se entrega después de 5b (PRD L224). Mientras tanto, una persona en dos organizaciones recibe avisos por Telegram sin saber de cuál son.
   - Cómo resolverlo: que CA-6 y CA-18 indiquen la organización en todos los canales y que el §9 añada la etiqueta.

7. **CA-3: la hora y la preferencia que se citan no son las que existen.**
   - «A su hora, SDD 2»: SDD 2 no define la hora del email diario. Esa hora ya existe por persona (`daily_email_hour`, por defecto las 8:00, con una ventana de 3 horas, `daily-email.ts:6-8`).
   - «Según sus preferencias de avisos»: hoy el resumen de Telegram depende de `channel_links.daily_digest`, no del nivel de Telegram (`proactive.ts:127`). Si pasa a depender del nivel, quien tiene «Nada por Telegram» y el resumen activado deja de recibirlo.
   - Cómo resolverlo: citar la preferencia actual y decir cuál de las dos manda.

8. **Restos de la v1 que contradicen la v2:**
   - §13 (L134): dice «"según su hora" es nuevo» para Telegram, pero CA-3 dice «en la tanda diaria actual».
   - §14 (L142): «Depende del SDD 5a (fase por rol…)». La fase por rol es de 1a U-1 y U-7, que es justo lo que el §17 da por corregido.
   - §14 (L145): «deja el criterio de descarte de pausas largas al brief». CA-17 ya fija los 30 minutos.
   - §8 (L98): «(CA-5, CA-9)» debe ser «(CA-5, CA-10)», porque CA-9 trata de puertas.
   - §8 (L82): «Fuente que falla → "Sin dato reciente"». CA-14 lo pone solo si se cumple 4a CA-2.
   - §9 (L105): «(CA-23)» debe ser «SDD 2 CA-23». El CA-23 propio de 5b es la pérdida de rol.

9. **CA-14 (L68): dos exigencias que pueden chocar.** «Leer antes de preparar» y «sin retrasar el check-in» chocan si la lectura tarda. Falta un tiempo máximo de espera o decir que el check-in usa lo que haya en ese momento.

10. **CA-24 (L64) está en U-1, pero el informe semanal cambia en U-2.** La prueba `notices-phase-guard.test.ts` pasa sin esfuerzo en U-1. Hay que añadirla a las pruebas de U-2 para que vigile el cambio de CA-21.

11. **Citas y cifras:**
    - CA-15 cita 5a CA-16 para los recuerdos del objetivo. Esa cita es correcta para el agente, pero lo que el check-in muestra se rige por 5a CA-14. Mejor citar las dos.
    - Los 14 días de CA-9 y CA-15 tienen fuente en PRD §6.1 (L113, «Puertas próximas»), pero los CA no la citan; solo aparece en el §17.

12. **Pendiente de la primera pasada (menor 9):**
    - El aviso en la app a quien aprobó un cambio deshecho (5a CA-24) no lo dispara el agente por iniciativa propia ni está en la lista cerrada de CA-2.
    - Ningún CA lo dice. Basta con una línea en CA-1 o en el §14.

**Preguntas para Fede**

1. ¿El resumen de Telegram depende del interruptor actual «resumen diario» o del nivel de Telegram (CA-3)?
2. Con la fase activa, ¿quitamos el informe del lunes del resumen diario, para que solo salga en el check-in?
3. Si mueves el check-in a otro día, ¿el informe se calcula en el momento del check-in?
4. Al reactivar la fase con un caso crítico todavía abierto, ¿avisamos otra vez?
5. Sigue abierta desde el §15: ¿el Error de una conexión personal de Google (4b) cuenta como fuente caída?

**Hechos de código verificados / no verificados**

Verificados:
- Preferencias de avisos: «Solo lo importante» por defecto, silencio de 22 a 8 (las 8 ya fuera del silencio), Europe/Madrid y los cuatro niveles (`jobs.ts:100-142`).
- `telegramDecision` y la ventana de 12 horas de `flushHeldNotices` (`notices.server.ts:50-53`).
- Las sugerencias urgentes y `account_assigned` no leen las preferencias ni respetan el silencio, y toman la empresa activa (`proactive.ts:104-122`).
- El resumen de Telegram depende de `daily_digest` y manda «3 cosas para hoy» con botones (`proactive.ts:124-144`).
- El email diario sale de la empresa activa, a las 8:00 con una ventana de 3 horas y con el interruptor `daily_email` (`daily-email.server.ts:72-100`, `daily-email.ts`). El asunto ya lleva el nombre de la organización.
- Informe semanal: los lunes desde las 6:00 UTC; Telegram solo con `daily_digest`; un solo email a todos los Owner y Sales leader; una sugerencia con `user_id` nulo (`weekly-report.server.ts`).
- Umbrales del 80 % y 100 % (`planner.ts:62-66`), mes contado en UTC (`runner.ts:25`) y la etiqueta «Cerca del límite» solo en el panel (`budget-panel.tsx:37`).
- Estados de conexión «Error» y «Sin respuesta» (`connections.ts`).
- Migraciones 0058 y 0059 sin aplicar (`src/lib/AGENTS.md:54,57`).
- Las citas «SDD 5a CA-16, CA-21, CA-28, CA-29, CA-31» y «5a U-3 y U-4» siguen siendo correctas tras la v2 de 5a.
- Son correctas también las citas a:
  - 1a: CA-5 (U-1), CA-6 (U-7), CA-11, CA-22 y CA-24;
  - 1b: CA-84 (U-5) y las puertas (U-6);
  - SDD 2: CA-22 a CA-24 (U-1);
  - 4a: CA-2 y CA-3 (U-1 y U-2).

No verificados:
- Si hay un bot de Telegram en producción y a qué hora se dispara hoy el resumen (`kind: "digest"`).
- Si Inngest está activo en producción.
- Si las reglas de acceso están aplicadas en producción.

**Límites de la revisión**

- Solo he leído documentos y código locales. No he consultado la base de datos ni ejecutado pruebas.
- De 5a solo revisé los CA y las unidades que 5b cita; de 5c, solo CA-5 y CA-9 por el solape de los avisos con organización.
- Sobre cifras y datos:
  - El documento no tiene datos de clientes.
  - Los 30 minutos tienen fuente: la decisión de Fede en el §15 y PRD L144.
  - 5b no usa ningún plazo de 7 días. El que hay en el check-in viene de la caducidad de las propuestas de 5a CA-31, que 5b no cita.
  - Los 14 días vienen de PRD L113.

**Respuesta del autor (v3, 2026-10-31).** El informe (sin bloqueantes) está copiado sin editar arriba. Decisiones de Fede: el resumen de Telegram sigue el interruptor actual del resumen diario; el informe del lunes se calcula al preparar el check-in y se excluye del resumen diario; al reactivar la fase no se repite el aviso de episodios abiertos; el Error de una conexión personal de Google no cuenta como fuente caída.

Cambios: CA-3 cita las preferencias y la hora que existen hoy y excluye el informe; CA-21 aclara a quién se oculta la tarjeta y cuándo se calcula; CA-17 mide de la apertura a Terminar en tramos y define «sin abrir»; CA-11 fija que el episodio de gasto dura hasta fin de mes y que saltar un umbral cuenta como avisado; CA-13 limita a una convocatoria por persona y semana; CA-14 usa lo leído hasta ese momento; CA-19 descarta el aviso si ya terminó el check-in; CA-20 descarta avisos retenidos y no repite episodios abiertos; CA-6 y CA-18 indican la organización en todos los canales; CA-1 excluye los avisos en la app de otros SDD; CA-9 y CA-15 citan las fuentes; §8, §9, §13 y §14 corregidos y U-2 prueba la guardia. No hay nueva pasada sobre esta v3.

**Tercera pasada del gate (2026-10-31, sobre la v3).** Informe copiado sin editar.

**Veredicto:** Bloqueado

Hay dos contradicciones entre CA que ninguna prueba puede satisfacer a la vez. Cada una se arregla con una línea; el resto del documento está casi listo. Las citas a 5a, 1a, 1b, 2 y 4a son correctas.

**Bloqueantes**

1. **CA-20 (L74) contradice CA-24 (L64) y 1a CA-6.**
   - CA-3 (L53) dice que el email diario y el resumen de Telegram actuales *son* el resumen diario. CA-20 manda «dejar de enviarle resumen diario» al desactivar la fase.
   - CA-24, en cambio, exige mantener sin cambios el email diario, el resumen de Telegram y el informe semanal mientras la fase no esté activa. 1a CA-6 exige «devolver el comportamiento anterior».
   - Tras desactivar, la prueba de CA-20 espera que no llegue el email de las 8:00 y la de CA-24 espera que llegue. Pasa lo mismo con los otros roles de CA-22 al desactivarles la fase.
   - Cómo resolverlo: en CA-20, «deja de enviarle el resumen diario nuevo, los avisos críticos y el check-in, y vuelve al email diario, al resumen de Telegram y al informe semanal actuales (CA-24, 1a CA-6)».

2. **CA-13 (L67) contradice CA-18 (L72) para una persona en dos organizaciones.**
   - CA-13 (cambiado en la v3) dice «como máximo un check-in por persona y semana».
   - CA-18 dice «uno por persona y por organización».
   - Con la fase activa en A y en B, una prueba no puede cumplir las dos.
   - Cómo resolverlo: en CA-13, «como máximo uno por persona, organización y semana». Además, definir la semana: de lunes a domingo en la zona horaria de la organización.

**Cambios menores**

1. **§8 no recoge los casos nuevos de la v3**, aunque el §17 (L407) dice «§8 corregidos» y la segunda pasada (menor 5) los pidió. Faltan:
   - el check-in «sin abrir» que pasa a «cerrado sin terminar» (CA-17);
   - el check-in terminado en la app durante el silencio, cuyo aviso se descarta (CA-19);
   - la reactivación sin repetir avisos (CA-20);
   - el cambio de día del check-in a mitad de semana (CA-13);
   - el check-in de una persona en dos organizaciones (CA-13 y CA-18).
2. **CA-3 frente a 5c CA-8: botones que siempre fallan.**
   - CA-3 manda un resumen de Telegram por organización con botones Hecho y Posponer.
   - 5c CA-8 rechaza aprobar desde Telegram «incluidas las sugerencias con botones» de una organización que no es la activa de la app.
   - Resultado: en el resumen de la organización que no está activa, los botones siempre se rechazan. Hoy no pasa, porque `sendDigests` solo envía la empresa activa (`proactive.ts:131-133`).
   - Cómo resolverlo: quitar los botones en los resúmenes de organizaciones no activas, o declarar este comportamiento en el §14.
3. **CA-14 (L68): sigue sin fijarse con cuánta antelación se lee.**
   - El disparo es «CUANDO llega el momento» y además «sin retrasar». Así, «lo leído hasta ese momento» puede ser nada.
   - El §13 dice «justo antes de la convocatoria», pero ningún CA da un plazo. Ya lo señalaron la primera pasada (menor 14) y la segunda (menor 9).
   - Cómo resolverlo: lanzar la lectura N minutos antes de la hora del check-in.
4. **CA-17 (L71): la duración infravalora un check-in que se retoma otro día.**
   - Los tramos solo se parten por «la apertura, cada respuesta y Terminar». Volver a abrirlo no parte tramo.
   - El tramo de la última respuesta del lunes a la primera del martes supera 30 minutos y se descarta entero, con los minutos reales del martes dentro.
   - Tampoco dice si «la apertura» es solo la primera.
   - Cómo resolverlo: que cada vez que se vuelva a abrir también parta tramo.
5. **Primera activación y entrada en el rol (CA-8, CA-10, CA-20).**
   - CA-20 solo regula la reactivación. Al activar la fase por primera vez, o cuando alguien pasa a ser Sales leader, ya hay casos abiertos: resultados clave En riesgo, puertas vencidas, gasto por encima del 80 %. No se dice si se avisa de todos de golpe.
   - CA-10 dice «pasa a», que sugiere que no.
   - Tampoco se dice si un episodio que empezó con la fase desactivada se avisa al reactivarla («sin repetir» solo cubre los ya avisados).
6. **CA-21 (L75): la tarjeta del informe se oculta solo en Sugerencias, pero también sale en Inicio.**
   - Inicio muestra las 5 primeras sugerencias pendientes (`home.tsx:40,68`), y el informe es una sugerencia con `user_id` nulo (`weekly-report.server.ts:50`).
   - Además, el botón «Informe de la semana ahora» (`inbox.tsx:31`) crea una tarjeta que a esa persona ya no se le muestra.
   - Cómo resolverlo: ocultarla también en Inicio y decir qué pasa con el botón.
7. **§11 (L124) frente a CA-16 y el §12.**
   - El §11 dice que la conversación del check-in es «el turno del agente del SDD 5a».
   - Pero CA-16 describe tarjetas con confirmar o descartar, sin IA, y U-2 no depende de 5a U-1 (el agente).
   - Cómo resolverlo: o el check-in no usa el agente (corregir el §11), o se añade la dependencia de 5a U-1 y un CA que lo diga.
8. **CA-11: mes en UTC frente a SDD 2 CA-22.**
   - SDD 2 CA-22 manda usar la zona horaria de la organización en «los plazos que dependen del día».
   - CA-11 cuenta el mes en UTC, como la pausa actual (`runner.ts:25`).
   - Es razonable, pero es una excepción a un SDD aprobado y debería declararse en el §14.
9. **§17 (L407) dice «CA-9 y CA-15 citan las fuentes», pero no es del todo así.** CA-15 sí cita 5a CA-14 y CA-16, pero no cita el PRD §6.1 para sus 14 días; CA-9 sí.

**Preguntas para Fede**

1. Al desactivar la fase, ¿Owner y Sales leader vuelven a recibir el email diario, el resumen de Telegram y el informe del lunes actuales? Es lo que dicen CA-24 y 1a CA-6, y CA-20 dice lo contrario.
2. Al activar la fase por primera vez, ¿se avisa de los casos críticos que ya estaban abiertos?
3. Con la fase activa para otros roles, la tarjeta del informe semanal se les oculta (CA-21) y no tienen check-in (CA-22), así que se quedan sin informe. ¿Es lo que quieres?
4. En el resumen de Telegram de una organización que no es la activa, ¿quitamos los botones o se rechazan con «qué pasó y qué hacer» (5c CA-8)?

**Hechos de código verificados / no verificados**

Verificados:
- Preferencias de avisos: «Solo lo importante» por defecto, silencio de 22 a 8, Europe/Madrid, los cuatro niveles; `telegramDecision`; la ventana de 12 horas de `flushHeldNotices` (`jobs.ts:100-140`, `notices.server.ts:48-50`).
- `notifyUrgent` y `sendDigests` no leen las preferencias, toman la empresa activa y el resumen depende de `daily_digest` (`proactive.ts:104-144`).
- `flushHeldNotices` corre en cada ejecución horaria, también con Inngest (`proactive.ts:27`).
- Email diario: empresa activa, `daily_email` activado por defecto, 8:00 con una ventana de 3 horas (`daily-email.ts:6-8`, `daily-email.server.ts:71-89`). Existe además «Envíamelo ahora», que es a petición y no por iniciativa propia.
- Informe semanal: lunes desde las 6:00 UTC, una sugerencia de prioridad 2 con `user_id` nulo, Telegram solo con `daily_digest` y un único email a Owner y Sales leader (`weekly-report.server.ts`).
- Presupuesto: aviso al 80 % y pausa al 100 %, sin límite = sin estado, «Cerca del límite» solo en el panel, mes en UTC (`planner.ts:62-66`, `budget-panel.tsx:37`, `runner.ts:24-32`).
- Estados de conexión «Error» y «Sin respuesta» (`connections.ts`).
- Migraciones 0058 y 0059 sin aplicar (`src/lib/AGENTS.md`).
- Citas a otros SDD:
  - 5a (v3): CA-14, CA-16, CA-21, CA-24, CA-28, CA-29, CA-31 y U-3 y U-4 existen y dicen lo afirmado.
  - 5c CA-9 es coherente con 5b: exige la organización en los avisos de 5b por Telegram y 5b ya la exige en todos los canales.
  - 1a CA-5 (U-1), CA-6 (U-7), CA-11, CA-22 y CA-24 (U-3): correctas.
  - 1b CA-78 y CA-84 (U-5) y las puertas (U-6, CA-42 a CA-48): correctas.
  - SDD 2 CA-22 a CA-24 (U-1): correctas.
  - 4a CA-2, CA-3 (U-2) y CA-14: correctas.
- Las unidades del §12 cuadran: cada CA está en una sola unidad y tiene su prueba.

No verificados:
- Si hay un bot de Telegram en producción y a qué hora se dispara el cron `digest` (no hay rastro en el repo).
- Si Inngest está activo en producción.
- Si las reglas de acceso están aplicadas así en producción.

**Límites de la revisión**

- Solo he leído documentos y código locales. No he consultado la base de datos ni ejecutado pruebas.
- De 5a y 5c solo revisé los CA que 5b cita o que lo tocan (5c CA-5, CA-8, CA-9, CA-12 y CA-13).
- No he releído el SDD 5 archivado más allá de lo que recogen las dos pasadas anteriores.
- El documento no contiene datos de clientes. Sus cifras (10 y 30 minutos, 14 días, 80 % y 100 %, 9:00, de 22 a 8, 12 horas, 8:00) tienen fuente en el PRD §6.1, en las decisiones de Fede o en el código.

**Respuesta del autor (v4, 2026-10-31).** El informe está copiado sin editar arriba. Fede aprobó el SDD con los riesgos declarados y sin cuarta pasada y aceptó mis recomendaciones: al desactivar la fase vuelven el email diario, el resumen de Telegram y el informe actuales; los casos ya abiertos al activar la fase no avisan hasta que cambien; los otros roles se quedan sin informe; los resúmenes de Telegram de una organización no activa no llevan botones.

Cambios: CA-20 deja de contradecir a CA-24 y 1a CA-6; CA-13 fija uno por persona, organización y semana; CA-3 quita los botones del resumen de una organización no activa; CA-14 fija 15 minutos de antelación (valor del autor, a confirmar); CA-17 parte tramos al retomar; CA-8 cubre la primera activación; CA-21 oculta la tarjeta también en Inicio y redirige el botón; CA-15 cita el PRD; §8 con los casos nuevos; §11 corregido (el check-in no usa IA); §14 declara la excepción de UTC, el valor del autor y la aprobación sin cuarta pasada.

## 18. Delta de implementación (lo rellena el agente al entregar)
(sin rellenar)
