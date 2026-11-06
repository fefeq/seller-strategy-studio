# SDD-20261030-gtm-control-tower-5-agent · [Feature] Agente único, memoria, check-in semanal, avisos críticos y servidor para asistentes (fase 5)

**Tipo:** Feature · **Prioridad propuesta:** Alta
**Estado:** Borrador (v4: v3 más las correcciones de la segunda pasada del gate y las decisiones de Fede del 2026-10-31; sin tercera pasada) · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-10-31
**PRD:** `docs/prd/PRD-20261030-gtm-control-tower.md` · **Depende de:** SDD 1a (roles, Consejo y activación por rol: U-1; resultados clave: U-3; ratificación, versiones y auditoría: U-7), SDD 1b (tareas: U-5; puertas: U-6; Inicio y menú: U-8), SDD 2 (día y hora del check-in, zona horaria y bloques de contexto: U-1 y U-2), SDD 3 (fichas de conversación sin nombres: U-6), SDD 4a (estado de las fuentes y su cadencia: U-1 y U-2; coste previo: U-8), SDD 4b (borradores de correo: U-3), el SDD de salida de Lovable C (servidor para asistentes) y los de A y B para construir · **Coordinar con:** `SDD-20261030-money-moment-notices` (Borrador: avisos de «momentos de dinero» por la misma vía de avisos y preferencias), `SDD-20261025-theory-u-proactive-decision-support` (Borrador: sugerencias dentro de la app), `SDD-20261025-connections-bring-your-own-account` y `SDD-20261029-lovable-exit-b-servicios-y-corte` (claves propias de IA y correo)

> Un SDD dice cómo se verifica que está bien hecho. Cada criterio de aceptación (CA-n) debe poder tener una prueba automática que lo nombre.
> Los criterios no nombran tecnología; lo técnico va en el §13 como [Sugerencia — la revisión del gate las valida].
> Las reglas transversales del PRD (§6.2, R-1 a R-10) aplican a todo este SDD. «Organización» es la empresa que usa Nokko; «cuenta» es una empresa prospecto o cliente.
> La numeración de criterios se conserva de la v2; los criterios nuevos (CA-45 en adelante) se añaden al final de su historia, sin reordenar: CA-55 y CA-61 van en H-5 con el check-in (tras CA-54), CA-60 tras CA-10 (H-2), CA-58 tras CA-17 (H-3), CA-46, CA-49, CA-56 y CA-62 tras CA-27 (H-4), CA-47, CA-50 a CA-54, CA-55, CA-57 y CA-61 tras CA-39 (H-5), y CA-45, CA-48 y CA-59 tras CA-44 (H-6).
> El borrador de plan con IA que el SDD 1b dejó a este SDD se redacta aparte (SDD 5b, decisión de Fede del 2026-10-31).
> Este SDD cumple lo que los SDD 1a, 1b, 4a y 4b dejaron a su cargo: el deshacer de 24 horas (1a CA-70), el ejecutor «agente» de las tareas (1b CA-38, con CA-49), el chat de Inicio y el agente de la barra móvil (1b CA-64 y CA-66), el aviso de «Sin dato reciente» y el disparo previo al check-in (4a CA-2 y CA-3) y los límites de los borradores y del registro personal de reuniones (4b CA-7 y CA-9).

## 1. Resumen
Convierte el agente actual (varios personajes, flujos y una entrevista de configuración) en **un solo agente copiloto** en un panel lateral, con **modos que elige solo**, **conversaciones privadas con hallazgos que la persona decide compartir**, **memoria por objetivo y empresa** que se guarda sola y se puede editar, y **autonomía limitada a lo interno**: crea propuestas, nunca ejecuta nada hacia fuera ni cambia un objetivo ratificado sin aprobación. Añade lo único que el agente hace por iniciativa propia: el **check-in semanal** (conversación guiada de unos 10 minutos), el **resumen diario** y cinco **avisos críticos** por email y Telegram. Expone el mismo conjunto de herramientas, con las mismas reglas, al **servidor para asistentes** (lectura y escritura completa; toda escritura queda como propuesta pendiente).

## 2. Problema y para quién
Hoy el agente es una lista de personajes y flujos sin memoria por objetivo, sin check-in y sin avisos sobre el estado de los objetivos; la torre de control (SDD 1a y 1b) muestra el estado pero nadie le recuerda a Fede qué mirar. Para Fede (Owner) y Flor (Sales leader). El Consejo no usa el agente.

## 3. Evidencia y por qué ahora
- **Código (repo de Nokko, solo lectura, 2026-10-31):**
  - El agente tiene personajes (`src/lib/bmad/personas.ts`), flujos agrupados por fase del Ciclo GTM (análisis, plan, arquitectura, ejecución y retro: `src/lib/bmad/workflows.ts`) y un modo «entrevista» de configuración (`src/lib/agent/agent.server.ts`).
  - El mismo registro de herramientas sirve al agente de la app, a Telegram y al servidor para asistentes (`src/lib/agent/tools.ts`, `src/lib/mcp/tools/agent-tools.ts`); las herramientas de lectura corren al momento y las de escritura quedan como acción pendiente que la persona confirma (`decideAgentAction` en `src/lib/agent.functions.ts`).
  - Ya existe una memoria con ámbitos empresa, persona y cuenta, que el agente aprende solo de las conversaciones y en la que se desactiva sin borrar (`src/lib/memory.server.ts`); no existe el ámbito objetivo.
  - Cada conversación guarda su dueño y organización (`agent_conversations`), pero la comprobación al continuar una conversación filtra por organización y no por persona (`sendAgentMessage`); la base de datos sí las aísla por persona (verificado por el gate el 2026-10-31 en las reglas de acceso de la migración 0007; no comprobado en producción).
  - Ya hay preferencias de avisos por persona (nivel de Telegram, silencio nocturno por defecto de 22 a 8, zona Europe/Madrid: `src/lib/jobs.ts`), avisos retenidos durante el silencio (`src/lib/notices.server.ts`) y un email diario por persona a su hora (`src/lib/daily-email.server.ts`).
  - El presupuesto de integraciones ya avisa al 80 % y pausa solo el trabajo automático al 100 % (`src/lib/orchestrator/planner.ts`).
- **Entrevista con Fede (2026-10-29 a 31):** un agente con modos; copiloto y proactivo; memoria por objetivo y empresa; conversaciones privadas con hallazgos compartidos; el Consejo bloqueado; agente en panel lateral; avisos críticos (fuente caída, puerta próxima o vencida, resultado clave en rojo, gasto al 80 % y 100 %) por Telegram y email con resumen diario; autonomía solo interna; servidor para asistentes con lectura y escritura completa y las mismas reglas del agente (PRD §6.1).
- **Decisiones de Fede para este SDD (2026-10-31):** los modos se detectan automáticamente; la memoria es automática y editable; el agente solo habla por iniciativa propia en el check-in, el resumen diario y los avisos críticos; el check-in es una conversación guiada de unos 10 minutos, los lunes a las 9:00 por defecto; los recuerdos solo nombran cargos y roles, nunca personas; los avisos críticos respetan siempre el silencio nocturno; la visibilidad de los hallazgos para el Consejo la decide el SDD 7.
- Uso real del agente actual: **sin dato** [Por verificar].

## 4. Resultado buscado
- El check-in semanal le lleva a Fede menos de 10 minutos (G-7 del PRD). Medición: tiempo entre la apertura y el cierre de cada check-in terminado (CA-33). Línea base: sin dato.
- Ninguna acción hacia terceros sin aprobación humana (G-10). Medición: pruebas de CA-23 y revisión de la auditoría.
- Cada aviso crítico llega a quien puede verlo, una vez por episodio. Medición: avisos enviados y descartados por tipo. Línea base: sin dato.

## 5. Alcance
**Incluye:** H-1 a H-6.
**No incluye:**
- Fuentes de datos de resultados clave, conexiones y su estado (SDD 4a); calendario, correo y notas de llamadas (SDD 4b), salvo lo que el agente puede hacer con ellos (CA-25 y CA-26).
- Mercado, competencia y radar semanal (SDD 6); vista del Consejo, runway y gatillo de continuidad (SDD 7).
- Cualquier envío de mensajes o correos a personas distintas de la propia, publicación de contenido, invitaciones a terceros o revelado de contactos sin aprobación (PRD R-2).
- Un agente que aprenda de las fichas de conversación sin nombres más allá de leerlas (PRD R-4), y la detección automática de nombres en texto libre.
- Cambios de las pantallas de torre, Plan y Decisiones (SDD 1a y 1b); solo se añade el chat de Inicio y el panel.
- Resúmenes del Consejo y la forma en que ve hallazgos (SDD 7).
- Nuevas herramientas del agente: se reutiliza el registro actual; las que 4b y 4a añadan se incorporan al registrarse.

## 6. Cambios de comportamiento (delta)
**Añadido:** modos detectados automáticamente; panel lateral y chat de Inicio; hallazgos compartidos; memoria con ámbito objetivo; check-in semanal; resumen diario y avisos críticos por email y Telegram; registro de qué crea el agente y deshacer de 24 horas; guardia de fase.
**Modificado:** las tareas pesadas con coste pedidas por chat (completar cuentas con un proveedor) pasan de ejecutarse al momento a acción pendiente con el coste en la tarjeta (CA-27); el informe semanal del lunes se integra en el check-in (CA-47); el agente deja de ofrecer personajes (sus flujos pasan a ser modos); el servidor para asistentes pasa a respetar la fase y las reglas de aprobación del agente; el email diario respeta CA-84 de 1b.
**Eliminado:** la elección de personaje como entrada del agente; nada se borra (R-7).

## 7. Historias y criterios de aceptación
Cada CA cita el objetivo G-n del PRD que cubre y el archivo de prueba (ruta por decidir en la implementación [Sugerencia]).

### H-1: Como Owner o Sales leader, quiero un único agente en un panel lateral que sepa en qué modo trabajar.
- **CA-1** MIENTRAS la fase esté activa para mi rol, el sistema DEBE ofrecer un único agente en un panel lateral abierto desde cualquier pantalla, y en Inicio como entrada de chat (en pantalla estrecha, desde el elemento «Agente» de la barra inferior, SDD 1b CA-66). · cubre G-7 · prueba: `agent-modes.test.ts`
- **CA-2** CUANDO escribo sin elegir modo, el sistema DEBE elegir el modo entre los flujos actuales agrupados por fase del Ciclo GTM (análisis, plan, arquitectura, ejecución y retro), la conversación libre y la entrevista de configuración (que, con la fase activa, usa los cuatro bloques de contexto del SDD 2), y DEBE mostrar el modo activo. · cubre G-7 · prueba: `agent-modes.test.ts`
- **CA-3** El sistema DEBE permitirme cambiar el modo en cualquier momento y DEBE usar el elegido hasta que lo cambie otra vez o abra una conversación nueva. · cubre G-7 · prueba: `agent-modes.test.ts`
- **CA-4** SI el sistema no puede determinar el modo, ENTONCES DEBE tratar la petición como conversación libre y preguntarme qué quiero, y DEBE abstenerse de iniciar un flujo que produce un documento sin que yo lo confirme. · cubre G-7 · prueba: `agent-modes.test.ts`
- **CA-5** El sistema DEBE conservar las conversaciones y los documentos creados con los personajes anteriores (PRD R-7) y, SI una petición todavía trae un personaje, ENTONCES DEBE tratarla como la misma petición sin personaje, sin error. · cubre G-7 · prueba: `agent-modes.test.ts`
- **CA-6** MIENTRAS la fase no esté activa para mi rol, el sistema DEBE mantener el agente actual con sus personajes y la entrada actual de Inicio, sin cambios (PRD R-9; SDD 1b CA-64). · cubre G-7, G-10 · prueba: `agent-phase-guard.test.ts`

### H-2: Como persona de Nokko, quiero que mis conversaciones con el agente sean privadas y poder compartir solo lo que decido.
- **CA-7** El sistema DEBE mostrar el texto y el título de cada conversación solo a la persona que la mantiene, sin excepción para otros roles ni para el Owner, y DEBE abstenerse de escribirlos en la auditoría; los recuerdos que el agente saca de ella (CA-11) no son la conversación y siguen sus propias reglas. · cubre G-10 · prueba: `agent-conversations-privacy.test.ts`
- **CA-8** CUANDO comparto un resultado de una conversación como hallazgo, el sistema DEBE guardar solo el texto que yo revisé (no la conversación), con autor, fecha y el objetivo, la cuenta o la empresa a los que se refiere, DEBE hacerlo visible solo al Owner y al Sales leader, y DEBE advertir antes de guardar que no incluyas datos de clientes. · cubre G-7, G-10 · prueba: `agent-findings.test.ts`
- **CA-9** El sistema DEBE permitir al agente proponerme compartir un hallazgo y DEBE abstenerse de compartirlo sin mi acción. · cubre G-10 · prueba: `agent-findings.test.ts`
- **CA-10** El sistema DEBE denegar al Consejo el agente de la app y DEBE ocultarle conversaciones y hallazgos (SDD 1a CA-3), y DEBE separar las conversaciones y los hallazgos por organización y por persona: una organización NO DEBE ver ni usar los de otra y una persona en dos organizaciones DEBE tener conversaciones independientes en cada una (PRD R-10). · cubre G-10 · prueba: `org-isolation.test.ts`
- **CA-60** El sistema DEBE permitir al autor de un hallazgo editarlo o retirarlo (archivar, PRD R-7) y al Owner retirarlo, y DEBE conservar quién lo hizo. · cubre G-10 · prueba: `agent-findings.test.ts`

### H-3: Como Owner o Sales leader, quiero que el agente recuerde lo que importa de cada objetivo y de la empresa, y poder corregirlo.
- **CA-11** CUANDO termina un turno de conversación, el sistema DEBE ejecutar la extracción de recuerdos y guardar sin pedir aprobación los que esta devuelva en los ámbitos objetivo, empresa, persona y cuenta, DEBE abstenerse de guardar nada si no devuelve ninguno, DEBE marcar que los generó el agente, DEBE guardar de qué conversación proceden sin copiar su texto y DEBE avisar en el panel de que lo aprendido sobre la empresa o una cuenta queda en la memoria compartida. · cubre G-7, G-10 · prueba: `agent-memory.test.ts`
- **CA-12** El sistema DEBE abstenerse de guardar como recuerdo el texto literal de las fichas de conversación, los datos de contacto, las credenciales y las cifras que Nokko ya calcula. · cubre G-10 · prueba: `agent-memory.test.ts`
- **CA-13** El sistema DEBE permitir ver, editar y desactivar cada recuerdo: a la persona, los suyos y los de ámbito persona; al Owner y al Sales leader, los de ámbito objetivo, empresa y cuenta, incluidos los que salieron de conversaciones de otras personas, con su origen visible como persona y fecha, nunca el título ni el texto de la conversación. Desactivar NO DEBE borrar (PRD R-7) y DEBE poder reactivarse. · cubre G-7, G-10 · prueba: `agent-memory.test.ts`
- **CA-14** SI un recuerdo nuevo contradice o actualiza uno activo, ENTONCES el sistema DEBE guardar el nuevo y desactivar el anterior conservándolo, enlazado al nuevo, y SI alguien reactiva el anterior, ENTONCES DEBE desactivar el que lo sustituyó. · cubre G-7 · prueba: `agent-memory.test.ts`
- **CA-15** El sistema DEBE usar en cada respuesta solo los recuerdos de la organización activa de esa conversación, DEBE reservar los de ámbito persona a su dueño y DEBE usar los de ámbito objetivo solo cuando la conversación trata ese objetivo. · cubre G-7, G-10 · prueba: `agent-memory.test.ts`
- **CA-16** CUANDO se archiva un objetivo, el sistema DEBE dejar de usar sus recuerdos y conservarlos (PRD R-7). · cubre G-7 · prueba: `agent-memory.test.ts`
- **CA-17** SI la lectura o el guardado de la memoria falla, ENTONCES el sistema DEBE responder sin recuerdos, DEBE decirme que no pudo consultarlos y qué hacer (reintentar) y DEBE abstenerse de inventar recuerdos. · cubre G-7 · prueba: `agent-memory.test.ts`
- **CA-58** El sistema DEBE indicar al extractor de recuerdos que de las personas de una cuenta guarde solo su cargo o rol, nunca su nombre (PRD R-4), y DEBE advertir en la lista de recuerdos que se revise que no haya nombres; no hay detección automática de nombres (§5). · cubre G-10 · prueba: `agent-memory.test.ts`

### H-4: Como Owner, quiero que el agente solo cree propuestas internas y que nada salga ni cambie lo ratificado sin mi aprobación.
- **CA-18** El sistema DEBE permitir al agente crear sin aprobación solo elementos internos que no cambian el negocio ni la estrategia y no tienen coste de proveedor (consultas de lectura, investigaciones sin coste, borradores de documentos, sugerencias, recuerdos y tareas como propuesta «Sin asignar»), DEBE registrar que los creó el agente y DEBE tratar como propuesta pendiente (CA-19 y CA-46) todo lo demás que quiera cambiar, incluidos los datos del negocio y los cambios sobre objetivos, resultados clave, iniciativas, públicos, canales, puertas y decisiones (PRD R-3). · cubre G-7, G-10 · prueba: `agent-autonomy.test.ts`
- **CA-19** El sistema DEBE exigir que apruebe cada propuesta de cambio la persona que la pidió, siempre que su rol tenga permiso para esa acción, y DEBE denegar la aprobación a cualquier otra persona y a quien no tenga ese permiso. · cubre G-10 · prueba: `agent-autonomy.test.ts`
- **CA-20** CUANDO el agente propone cambiar un objetivo o una decisión ratificados, el sistema DEBE crear solo una propuesta; al aplicarla DEBE crear la versión «Modificado tras ratificación» (SDD 1a CA-52) y DEBE impedir que el agente ratifique: solo ratifica el Owner (SDD 1a CA-51). · cubre G-3, G-10 · prueba: `agent-autonomy.test.ts`
- **CA-21** El sistema DEBE registrar en la auditoría (SDD 1a, CA-68) cada cambio de estrategia aplicado desde una propuesta, con la persona que lo aprobó, el origen registrado de la propuesta y la hora. · cubre G-10 · prueba: `agent-autonomy.test.ts`
- **CA-22** El sistema DEBE permitir al Owner deshacer durante 24 horas cada cambio de estrategia aplicado por una persona desde una propuesta del agente (sobre objetivos, resultados clave, iniciativas, públicos, canales, puertas o decisiones), DEBE hacerlo restaurando el estado anterior como una versión nueva (SDD 1a CA-52), marcada «Modificado tras ratificación» hasta que el Owner ratifique de nuevo si el elemento estaba ratificado, sin borrar nada (PRD R-7), DEBE avisar a quien aprobó el cambio y DEBE registrarlo en la auditoría (SDD 1a CA-68); SI el elemento cambió después, ENTONCES DEBE negarse y decirle qué pasó y qué hacer. El plazo de 24 horas es el de SDD 1a CA-70. · cubre G-3, G-10 · prueba: `agent-undo.test.ts`
- **CA-23** SI una petición implica una acción externa de la lista cerrada del PRD R-2 (publicar contenido, enviar mensajes o correos a otras personas, invitar a terceros a eventos, revelar o exportar contactos con crédito de un proveedor), ENTONCES el sistema DEBE prepararla como borrador o propuesta y DEBE abstenerse de ejecutarla sin la aprobación de la persona que la pidió, si su rol tiene permiso (SDD 4a, CA-15, para los contactos con crédito). · cubre G-10 · prueba: `agent-external-actions.test.ts`
- **CA-24** DONDE el agente cree una tarea, el sistema DEBE guardarla directamente como tarea «Sin asignar» (SDD 1b CA-78), sin otra propuesta que aprobar, DEBE mostrar en ella que la creó el agente y DEBE mantenerla fuera de las respuestas de las herramientas que listan tareas hasta que alguien la asigne a una iniciativa (SDD 1b CA-84). · cubre G-2, G-10 · prueba: `agent-autonomy.test.ts`
- **CA-25** CUANDO pido un seguimiento por correo y tengo conectado el correo personal, el sistema DEBE redactar el borrador sin leer mi buzón y DEBE crearlo solo como borrador en mi cuenta (SDD 4b CA-9 a CA-11), sin enviar nada y solo cuando yo lo pida. · cubre G-6, G-10 · prueba: `agent-mail-drafts.test.ts`
- **CA-26** El sistema DEBE abstenerse de que el agente lea o procese con IA el registro personal de reuniones, el contenido del calendario o el correo de una persona (SDD 4b CA-7 y CA-9). · cubre G-10 · prueba: `agent-no-personal-data.test.ts`
- **CA-27** CUANDO el agente propone una tarea pesada con coste de proveedor o de IA (por ejemplo completar cuentas con un proveedor), el sistema DEBE guardarla como acción pendiente con su coste previo estimado en la tarjeta (SDD 4a, CA-14) y DEBE ejecutarla solo cuando la persona que la pidió la pulse, que es la aprobación. · cubre G-6, G-10 · prueba: `agent-cost-preview.test.ts`
- **CA-46** El sistema DEBE guardar cada propuesta de cambio con su organización, su origen y uno de estos estados: pendiente; aprobada; descartada (cuando quien la pidió la descarta); caducada (a los 7 días sin decisión); rechazada por cambio (cuando, al intentar aprobarla, el elemento ha cambiado respecto a su versión al proponer) o fallida (cuando aplicarla da error); DEBE comprobar el permiso de quien la pidió al aprobar, no al proponer; y DEBE abstenerse de aplicar una propuesta que no esté pendiente. · cubre G-10 · prueba: `agent-proposals.test.ts`
- **CA-49** DONDE una tarea tenga al agente como ejecutor, el sistema DEBE limitarlo a tareas internas (investigación y borradores), DEBE mostrarlo en la tarea (SDD 1b CA-38), DEBE ejecutarla solo cuando una persona se lo pida y DEBE preparar como propuesta cualquier acción externa asociada (CA-23). · cubre G-2, G-10 · prueba: `agent-executor.test.ts`
- **CA-56** SI pido un seguimiento por correo y no tengo conectado el correo personal, ENTONCES el sistema DEBE abstenerse de crear el borrador y DEBE decirme qué pasó y cómo conectarlo (PRD R-8). · cubre G-6 · prueba: `agent-mail-drafts.test.ts`
- **CA-62** El sistema DEBE mostrar cada propuesta pendiente solo a la persona que la pidió, junto con su conversación o, si la creó un asistente externo, en su bandeja de Sugerencias; DEBE mostrar las descartadas, caducadas y rechazadas solo a esa persona; y DEBE mostrar las aprobadas en la auditoría del Owner (CA-21). · cubre G-10 · prueba: `agent-proposals.test.ts`

### H-5: Como Owner o Sales leader, quiero que el agente me hable solo en el check-in, el resumen diario y los avisos críticos.
- **CA-28** MIENTRAS la fase esté activa para mi rol, el sistema DEBE enviar mensajes nuevos del agente por iniciativa propia (en la app, por Telegram o por email) solo en el check-in semanal, el resumen diario y los avisos críticos, y DEBE abstenerse de enviar cualquier otro; los avisos propios que ya existen no son mensajes del agente y los regula CA-47. · cubre G-7, G-10 · prueba: `agent-proactivity.test.ts`
- **CA-29** El sistema DEBE convocar el check-in de cada Owner y Sales leader con la fase activa cada lunes a las 9:00 en la zona horaria de la organización (Europe/Madrid por defecto), mientras el Owner no fije otro día u hora (SDD 2 CA-22 y CA-23). · cubre G-7 · prueba: `weekly-checkin.test.ts`
- **CA-30** CUANDO llega el momento del check-in, el sistema DEBE intentar leer las fuentes automáticas antes de preparar el resumen (SDD 4a CA-3) y, SI alguna falla, ENTONCES DEBE mostrarla con su antigüedad y «Sin dato reciente» (PRD R-6) sin retrasar el check-in. · cubre G-7 · prueba: `weekly-checkin.test.ts`
- **CA-31** El sistema DEBE preparar el check-in con, por cada objetivo activo, su estado, cada resultado clave con su fuente y antigüedad (PRD R-1), las decisiones pendientes y las puertas que se evalúan en los próximos 14 días (solo informativas, con enlace a su pantalla), las fuentes en «Sin dato reciente», los recuerdos de ese objetivo y las tareas «Sin asignar» y las propuestas pendientes de la persona (excepción deliberada a SDD 1b CA-84, solo para esta revisión), sin usar el calendario ni el correo de nadie (CA-26). · cubre G-7 · prueba: `weekly-checkin.test.ts`
- **CA-32** CUANDO abro el check-in, el sistema DEBE guiarme ítem a ítem: en una tarea «Sin asignar», confirmar es asignarla a una iniciativa y descartar es archivarla; en una propuesta, aprobarla o descartarla (CA-19); el sistema DEBE abstenerse de aplicar nada que yo no confirme, DEBE mostrar como ya asignada una tarea que otra persona asignó antes y DEBE dejar los ítems sin responder pendientes en sus pantallas sin repetirlos como aviso. · cubre G-7, G-10 · prueba: `weekly-checkin.test.ts`
- **CA-33** El sistema DEBE registrar la apertura y el cierre de cada check-in, con la persona; el cierre es «terminado» cuando la persona pulsa Terminar y «cerrado sin terminar» cuando llega el siguiente check-in sin que lo haya hecho; DEBE medir la duración solo con los terminados, y DEBE abstenerse de reabrir un check-in terminado. · cubre G-7 · prueba: `weekly-checkin.test.ts`
- **CA-34** MIENTRAS la fase esté activa para mi rol, el sistema DEBE enviar un resumen diario a cada Owner y Sales leader, uno por organización con la fase activa e indicando la organización, por email y por Telegram según sus preferencias de avisos (canal y hora), con el mismo filtro de tareas que el resto de resúmenes (SDD 1b CA-84); el email diario y el resumen diario de Telegram actuales son este resumen, no se envía otro. · cubre G-7 · prueba: `notifications-channels.test.ts`
- **CA-35** MIENTRAS esté en vigor el silencio nocturno de una persona, el sistema DEBE retener el resumen diario y todos los avisos críticos por email y Telegram, sin excepción por tipo, y enviarlos al terminar el silencio, según sus preferencias de avisos; SI el caso de un aviso retenido ya se resolvió, ENTONCES DEBE descartarlo en vez de enviarlo; el aviso dentro de la app (CA-53) no se retiene. · cubre G-7 · prueba: `notifications-channels.test.ts`
- **CA-36** El sistema DEBE avisar, según las preferencias de cada persona, de una fuente caída: un resultado clave que pasa a «Sin dato reciente» (SDD 4a CA-2) o una conexión que pasa a Error; por Telegram solo si su nivel es «Todo lo que termine» o «Solo lo importante», y por email si tiene el email diario activado. · cubre G-7, G-10 · prueba: `critical-alerts.test.ts`
- **CA-37** El sistema DEBE enviar cada aviso crítico solo al Owner y al Sales leader con la fase activa que pueden ver el elemento afectado, DEBE excluir a los demás roles y al Consejo y DEBE abstenerse de incluir datos de clientes en su texto. · cubre G-10 · prueba: `critical-alerts.test.ts`
- **CA-38** El sistema DEBE enviar un solo aviso crítico por episodio y por persona y DEBE abstenerse de repetirlo mientras siga igual; un episodio empieza cuando el caso aparece y termina cuando deja de cumplirse, y si reaparece empieza otro. · cubre G-7 · prueba: `critical-alerts.test.ts`
- **CA-39** El sistema DEBE aplicar en Telegram las mismas reglas de permisos, de aprobación y de Consejo bloqueado que en el panel, y DEBE aceptar la aprobación o el descarte de una propuesta solo de la persona que la pidió. · cubre G-10 · prueba: `telegram-agent-rules.test.ts`
- **CA-47** MIENTRAS la fase esté activa para mi rol, el sistema DEBE conservar sin cambios, con sus mismas preferencias y silencio nocturno, estos avisos propios que ya existen: trabajo terminado, resultado del piloto automático, sugerencias urgentes por Telegram con sus botones y, cuando existan, los de momentos de dinero; DEBE integrar el informe semanal del lunes en el check-in (CA-31) y DEBE abstenerse de enviarlo aparte; y DEBE dejar el email diario y el resumen diario de Telegram como el resumen de CA-34. · cubre G-7, G-10 · prueba: `existing-notices-regression.test.ts`
- **CA-50** El sistema DEBE avisar de una puerta próxima (sin confirmar, de un objetivo Activo y con fecha de evaluación en los próximos 14 días) y de una puerta vencida (sin confirmar, de un objetivo Activo y con la fecha de evaluación pasada) al Owner y al Sales leader, DEBE terminar el episodio cuando el Owner la confirma y DEBE abstenerse de avisar de las puertas con evento de evaluación en vez de fecha. · cubre G-3, G-7 · prueba: `critical-alerts.test.ts`
- **CA-51** El sistema DEBE avisar cuando un resultado clave de un objetivo Activo pasa al estado «En riesgo» (SDD 1a CA-22), y DEBE terminar el episodio cuando deja de estarlo. · cubre G-7 · prueba: `critical-alerts.test.ts`
- **CA-52** El sistema DEBE avisar cuando el gasto mensual de integraciones llega al 80 % y, por separado, al 100 % del presupuesto de la organización, una vez por umbral y por mes, DEBE reiniciar los episodios al empezar el mes y DEBE abstenerse de avisar si la organización no tiene presupuesto fijado. · cubre G-6, G-7 · prueba: `critical-alerts.test.ts`
- **CA-53** El sistema DEBE mostrar cada aviso crítico también en la app, con independencia de que la persona tenga conectado Telegram o email. · cubre G-7 · prueba: `critical-alerts.test.ts`
- **CA-54** El sistema DEBE convocar el check-in a cada Owner y Sales leader con la fase activa (uno por persona y por organización), por la app y por el canal de avisos que haya elegido, y DEBE hacer que su cierre no afecte al de otra persona. · cubre G-7 · prueba: `weekly-checkin.test.ts`
- **CA-55** CUANDO el Owner desactiva la fase para un rol, el sistema DEBE dejar de convocar su check-in y de enviarle resumen y avisos críticos, DEBE conservar sin usar sus recuerdos, hallazgos y conversaciones y DEBE devolverle el agente actual (PRD R-9); al reactivarla DEBE volver a usarlos. · cubre G-10 · prueba: `weekly-checkin.test.ts`
- **CA-57** MIENTRAS esté en vigor el silencio nocturno de una persona, el sistema DEBE retener su check-in y enviarle el aviso al terminar el silencio. · cubre G-7 · prueba: `weekly-checkin.test.ts`
- **CA-61** MIENTRAS la fase esté desactivada para un rol, el sistema DEBE congelar sus propuestas pendientes creadas con la fase activa, sin permitir aprobarlas, DEBE seguir contando su caducidad (CA-46) y DEBE permitir aprobarlas de nuevo al reactivarla. · cubre G-10 · prueba: `weekly-checkin.test.ts`

### H-6: Como Owner, quiero usar Nokko desde mis asistentes externos con las mismas reglas que el agente.
- **CA-40** DONDE la fase esté activa para mi rol, el sistema DEBE exponer a mis asistentes externos el mismo conjunto de herramientas que el agente, de lectura y de escritura, con los mismos permisos por rol, actuando en mi nombre y en mi organización activa. · cubre G-7, G-10 · prueba: `assistant-server.test.ts`
- **CA-41** El sistema DEBE dejar que un asistente externo cree directamente solo lo que el agente crea sin aprobación (consultas de lectura, investigaciones sin coste, tareas «Sin asignar» y borradores de correo, CA-18, CA-24 y CA-25) y DEBE guardar toda otra escritura como propuesta pendiente de aprobación en la app (PRD R-2; CA-46), con las mismas reglas de aprobación, auditoría, ratificación solo del Owner y deshacer de 24 horas que las del agente (CA-19 a CA-22). · cubre G-10 · prueba: `assistant-server.test.ts`
- **CA-42** El sistema DEBE denegar al Consejo el servidor para asistentes y DEBE devolver, a quien no tenga permiso, un error con qué pasó y qué hacer (PRD R-8). · cubre G-10 · prueba: `assistant-server.test.ts`
- **CA-43** El sistema DEBE abstenerse de exponer a los asistentes externos la lectura del registro personal de reuniones, del contenido del calendario y del correo (CA-26), y DEBE aplicar a los borradores de correo las mismas reglas que al agente (CA-25). · cubre G-10 · prueba: `assistant-server.test.ts`
- **CA-44** MIENTRAS la fase no esté activa para mi rol, el sistema DEBE mantener sin cambios el servidor para asistentes, Telegram y el email diario actuales (PRD R-9). · cubre G-10 · prueba: `assistant-phase-guard.test.ts`
- **CA-45** DONDE el Owner active la fase para otros roles (SDD 1a CA-5), el sistema DEBE ofrecerles el agente y el servidor para asistentes solo con las herramientas que su rol permite y solo con sus recuerdos de ámbito persona, sin hallazgos, sin resumen ni avisos críticos y sin cambios de estrategia, y DEBE denegar al Consejo el agente (SDD 1a CA-3). · cubre G-10 · prueba: `agent-phase-guard.test.ts`
- **CA-48** El sistema DEBE guardar con su organización cada conversación, propuesta y aviso, DEBE rechazar aprobar desde Telegram o desde un asistente externo una propuesta de una organización que no es la activa, diciendo qué pasó y qué hacer (cambiar de empresa), DEBE indicar en el aviso por Telegram a qué organización pertenece y DEBE hacer que cambiar de empresa afecte solo a las conversaciones nuevas, sin mover las existentes (PRD R-10). · cubre G-10 · prueba: `org-isolation.test.ts`
- **CA-59** El sistema DEBE indicar en cada aviso por Telegram a qué organización pertenece y DEBE hacer que cambiar de empresa afecte solo a las conversaciones nuevas, sin mover las existentes. · cubre G-10 · prueba: `org-isolation.test.ts`

## 8. Casos límite y errores
Cada caso remite al CA que lo cubre.
- Petición ambigua o sin modo claro → conversación libre y pregunta (CA-4).
- Conversación abierta con un personaje anterior → misma petición sin personaje (CA-5).
- Rol sin la fase activa → agente actual, servidor y avisos sin cambios (CA-6, CA-44).
- Otra persona, incluido el Owner, intenta ver mi conversación → denegado (CA-7).
- Hallazgo con datos de clientes → advertencia antes de guardar (CA-8); el agente nunca lo comparte solo (CA-9).
- Consejo intenta usar agente, Telegram o servidor → denegado (CA-10, CA-39, CA-42).
- Misma persona en dos organizaciones → conversaciones, recuerdos y hallazgos independientes (CA-10).
- Recuerdo erróneo → se edita o se desactiva sin borrar (CA-13); recuerdo contradictorio → el nuevo sustituye y el anterior queda enlazado (CA-14).
- Objetivo archivado → sus recuerdos dejan de usarse (CA-16).
- Falla la memoria → respuesta sin recuerdos con aviso y qué hacer (CA-17).
- Propuesta del agente sin permiso del aprobador → denegada (CA-19).
- Cambio sobre un objetivo ratificado → versión «Modificado tras ratificación» y solo el Owner ratifica (CA-20).
- Cambio del agente que el Owner quiere revertir → deshacer dentro de 24 horas (CA-22).
- Petición de enviar, publicar, invitar o revelar contactos → borrador o propuesta sin ejecutar (CA-23).
- Tarea creada por el agente sin iniciativa → propuesta «Sin asignar», marcada (CA-24).
- Seguimiento por correo sin conexión personal de correo → no se crea borrador y se indica cómo conectar (CA-56).
- Petición de leer el calendario o el correo de una persona → rechazada (CA-26, CA-43).
- Tarea pesada con coste → coste previo visible (CA-27).
- Mensaje del agente fuera de check-in, resumen o avisos críticos → no se envía (CA-28).
- Check-in sin día ni hora cambiados por el Owner → lunes a las 9:00 (CA-29); check-in que cae en el silencio nocturno → retenido (CA-35).
- Fuente que falla antes del check-in → «Sin dato reciente» con antigüedad (CA-30).
- Ítems sin responder al cerrar el check-in → pendientes sin repetir (CA-32).
- Silencio nocturno → resumen y avisos retenidos hasta el final (CA-35).
- Mismo caso crítico en lecturas sucesivas → un solo aviso (CA-38).
- Persona sin canal conectado → recibe el aviso solo en la app (CA-53).
- Asistente externo pide una escritura → propuesta pendiente en la app (CA-41).
- Otros roles con la fase activa → agente y servidor solo con lo que su rol permite (CA-45); fase desactivada → conservado sin usar (CA-55).
- Propuesta sin decidir 7 días, o con el elemento cambiado → caducada o rechazada por cambio (CA-46).
- Otra persona intenta aprobar la propuesta de alguien → denegado (CA-19, CA-46).
- Tarea con el agente como ejecutor → solo interna y a petición (CA-49).
- Seguimiento por correo sin conexión personal → sin borrador y cómo conectar (CA-56).
- Caso crítico que se resuelve durante el silencio → aviso descartado (CA-35).
- Presupuesto sin fijar o mes nuevo → sin aviso o episodios reiniciados (CA-52).
- Aprobar desde Telegram una propuesta de otra organización → rechazado (CA-48); aviso de otra organización → indica cuál (CA-59).
- Fase desactivada con propuestas pendientes → congeladas hasta reactivar o caducar (CA-61).
- Check-in que cae en el silencio nocturno → retenido (CA-57).
- Hallazgo propio o ajeno → editar o retirar (CA-60).
- Persona en dos organizaciones → un resumen diario por cada una (CA-34).
- Dos personas con la misma tarea «Sin asignar» en el check-in → la segunda la ve ya asignada (CA-32).

## 9. Experiencia y copy
Sistema visual actual (Ink + Lima, versalitas con filete, sin iconos), textos en «tú».
- **Mensajes sugeridos** (a validar con la guía de voz de marca): «El texto de esta conversación es solo tuyo. Lo que aprendo sobre tu empresa queda en la memoria, donde puedes editarlo.» · «He guardado una propuesta. Nada cambia hasta que la apruebes.» · «No he podido consultar la memoria. Responderé sin ella; vuelve a intentarlo en unos minutos.»
- **Pantallas:** panel lateral del agente con el modo activo y selector (CA-1 a CA-3); chat de Inicio (CA-1); lista de recuerdos con ámbito, origen y editar o desactivar (CA-13); lista de hallazgos (CA-8); check-in guiado con una tarjeta por propuesta y confirmar o descartar (CA-32); preferencias de avisos y, para el Owner, el día y la hora del check-in (CA-29, CA-34).
- Los avisos críticos tienen un texto fijo por tipo («Hay una fuente sin datos recientes», «Hay una puerta que se evalúa pronto», «Hay un resultado clave en riesgo», «El gasto en integraciones ha llegado al 80 %», «El gasto en integraciones ha llegado al 100 %: las acciones automáticas están en pausa», «Hay una conexión con error», «Hay una puerta vencida») y apuntan a la pantalla; no llevan nombre de cuenta ni de persona (CA-37).

## 10. Datos, permisos y privacidad
- **Conceptos nuevos:** ámbito objetivo de la memoria, hallazgo compartido, registro de apertura y cierre del check-in, origen y aprobador de cada propuesta; el día y la hora del check-in los fija el SDD 2 (CA-23).
- **Acceso (como exigen las reglas del repo):** las estructuras nuevas llevan organización por defecto la actual, acceso filtrado por organización y permisos explícitos; las conversaciones solo las lee su dueño por regla de base de datos; Telegram usa un cliente privilegiado y filtra por organización y persona explícitamente; el servidor para asistentes usa el cliente de la persona con las mismas reglas de acceso [Sugerencia — el gate valida].
- **Matriz de permisos:**

| Acción | Owner | Sales leader | Consejo | Otros roles |
|---|---|---|---|---|
| Usar el agente (panel, Telegram, servidor) | Sí | Sí | No | Fase no activa: el agente actual (CA-6). Fase activa: solo lo que su rol permite (CA-45) |
| Compartir un hallazgo | Sí | Sí | No | No |
| Ver y editar recuerdos de objetivo, empresa y cuenta | Sí | Sí | No | No |
| Aprobar propuestas del agente | Solo las suyas, según permiso de la acción | Solo las suyas, según permiso de la acción | No | Solo las suyas, según permiso de su rol |
| Ver hallazgos | Sí | Sí | No | No (CA-45) |
| Ver y editar recuerdos de ámbito persona | Solo los suyos | Solo los suyos | No | Solo los suyos |
| Recibir el check-in, el resumen diario y los avisos críticos | Sí | Sí | No | No (CA-45) |
| Ratificar | Sí | No | No | No |
| Deshacer un cambio del agente (24 h) | Sí | No | No | No |
| Fijar día y hora del check-in | Sí | No | No | No |

- **Privacidad:** la conversación es solo de su dueño; el hallazgo compartido es solo el texto que la persona revisó; los recuerdos no copian fichas ni datos de contacto; los avisos no llevan datos de clientes; el agente no lee calendario ni correo; ningún dato de clientes en pruebas ni ejemplos.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| Turno de conversación del agente | Claves propias primero y, si fallan antes de actuar, la siguiente (cadena actual de proveedores) | El modelo del agente actual; esfuerzo por decidir en el brief | No (conversación; PRD §6.2 R-2) |
| Extracción de recuerdos | La misma cadena | Modelo más pequeño; por decidir en el brief | No |
| Preparación del check-in | Sin IA: el resumen sale de datos ya calculados; la conversación usa el turno del agente | — | No |
| Tareas pesadas pedidas al agente (investigación, completar cuentas) | Orquestador actual | El de cada servicio | Sí, junto a la acción (CA-27) |

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero [Sugerencia] | Depende de |
|---|---|---|---|---|
| U-1 | Agente único con modos detectados, panel lateral, chat de Inicio, retirada de personajes y guardia de fase | CA-1 a CA-6 | `agent-modes.test.ts`, `agent-phase-guard.test.ts` | SDD 1a U-1 (fase por rol), SDD 1b U-8 (Inicio y menú), SDD 2 U-2 (bloques de contexto) |
| U-2 | Conversaciones privadas, hallazgos compartidos, Consejo bloqueado y aislamiento por organización | CA-7 a CA-10, CA-60 | `agent-conversations-privacy.test.ts`, `agent-findings.test.ts`, `org-isolation.test.ts` (ampliado: lo crean 4a U-1 y 4b U-1) | U-1 |
| U-3 | Memoria con ámbito objetivo, automática y editable | CA-11 a CA-17, CA-58 | `agent-memory.test.ts` | U-1, U-2, SDD 1a U-2 y U-3 (objetivos), SDD 3 U-6 (fichas) |
| U-4 | Autonomía interna, aprobación, auditoría, deshacer, acciones externas, borradores y límites de datos personales | CA-18 a CA-27, CA-46, CA-49, CA-56, CA-62 | `agent-autonomy.test.ts`, `agent-proposals.test.ts`, `agent-undo.test.ts`, `agent-external-actions.test.ts`, `agent-executor.test.ts`, `agent-mail-drafts.test.ts`, `agent-no-personal-data.test.ts`, `agent-cost-preview.test.ts` | U-1, SDD 1a U-7 (ratificación, versiones y auditoría), SDD 1b U-5 (tareas), SDD 4b U-2 y U-3 (registro de reuniones y borradores), SDD 4a U-8 (coste) |
| U-5 | Resumen diario, silencio nocturno, avisos críticos y límite de mensajes por iniciativa | CA-28, CA-34 a CA-38, CA-47, CA-50 a CA-53 | `agent-proactivity.test.ts`, `notifications-channels.test.ts`, `critical-alerts.test.ts`, `existing-notices-regression.test.ts` | U-1, SDD 4a U-1 y U-2 (estado de fuentes), SDD 1a U-3 (resultados clave), SDD 1b U-5 y U-6 (tareas y puertas), SDD 2 U-1 (preferencias y zona horaria) |
| U-6 | Check-in semanal guiado, su medición, la pausa y las propuestas congeladas al desactivar la fase | CA-29 a CA-33, CA-54, CA-55, CA-57, CA-61 | `weekly-checkin.test.ts` | U-1, U-2, U-3, U-4, U-5, SDD 2 U-1, SDD 4a U-2 |
| U-7 | Servidor para asistentes y Telegram con las mismas reglas, otros roles con la fase activa y organización de cada conversación, propuesta y aviso | CA-39 a CA-45, CA-48, CA-59 | `assistant-server.test.ts`, `telegram-agent-rules.test.ts`, `assistant-phase-guard.test.ts` | U-1, U-2, U-3, U-4, U-5, SDD de salida de Lovable C |

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- **Entrevista:** el modo «entrevista» usa hoy el medidor antiguo de configuración (`get_setup_status`); con la fase activa debe usar los bloques del SDD 2.
- **Modos:** los flujos de `src/lib/bmad/workflows.ts` ya están agrupados por fase; el modo detectado puede ser un parámetro interno del turno que elige las instrucciones del flujo, y la elección de personaje desaparece de la entrada (`personaId` queda ignorado, CA-5).
- **Memoria:** el vínculo recuerdo-conversación (CA-11) no existe hoy y es un cambio de modelo aditivo; las políticas actuales de borrado de recuerdos y conversaciones no deben usarse para retirar (CA-13). El almacén actual (`memories`, `src/lib/memory.server.ts`) tiene ámbitos empresa, persona y cuenta; añadir el ámbito objetivo y el vínculo con el objetivo es un cambio de modelo aditivo. La edición y desactivación ya existen (campo de activo y reemplazo); falta la pantalla.
- **Conversaciones:** la comprobación de pertenencia en `sendAgentMessage` filtra por organización; debe filtrar también por persona (CA-7).
- **Costes:** `enrich_accounts_table` y `apollo_enrich_account` son hoy herramientas de lectura que se ejecutan al momento; CA-27 las pasa a acción pendiente con el coste en la tarjeta.
- **Propuestas:** las herramientas de escritura ya crean acciones pendientes (`agent_pending_actions`, con origen `agent` o `mcp`, estados pending, confirmed, cancelled y failed, y solo `decided_at`) que decide quien las pidió (`decideAgentAction`); la organización ya se guarda (obligatoria); CA-46 añade los estados caducada y rechazada por cambio y el plazo de 7 días, y CA-21 y CA-46 exigen guardar quién aprobó.
- **Deshacer:** `src/lib/setup-undo.ts` deshace borrando lo creado (solo creaciones, cinco tablas); no sirve tal cual para CA-22, que restaura el estado anterior como versión nueva sin borrar (PRD R-7); el plazo de 24 horas y el alcance son nuevos.
- **Avisos:** CA-35 es comportamiento nuevo: hoy el silencio solo retiene Telegram y los avisos retenidos solo salen si tienen menos de 12 horas (`jobs.ts`, `notices.server.ts`); retener también el email y los silencios largos exige cambiarlo. El resumen diario sustituye al envío actual de Telegram y al email diario sin duplicarlos, y el informe semanal (`weekly-report.server.ts`) se integra en el check-in. Reutilizar las preferencias y los avisos retenidos existentes (`NoticePrefs`, `telegramDecision`, `flushHeldNotices` en `src/lib/jobs.ts` y `src/lib/notices.server.ts`) y el email diario (`daily-email.server.ts`); los avisos críticos se calculan sobre el estado de 4a y 1b en el trabajo horario que ya existe.
- **Servidor para asistentes:** hoy expone el mismo registro y las escrituras quedan pendientes (`src/lib/mcp/tools/agent-tools.ts`); ya actúa con el cliente de la persona y filtra por la empresa activa y su pertenencia (`src/lib/mcp/context.ts`); faltan la guardia de fase y el bloqueo explícito del Consejo. `switch_company` cambia la empresa activa del perfil, que comparten la app, Telegram y el servidor (CA-48). La salida de Lovable C cambia su autenticación y dirección.
- **Check-in:** el disparo previo es una lectura de fuentes (4a CA-3) justo antes de la convocatoria; el trabajo programado lo da Inngest o el cron horario actual.
- Migraciones aditivas con organización por defecto; las 0058 y 0059 siguen sin aplicar (`src/lib/AGENTS.md`).

## 14. Riesgos y dependencias
- Depende de los SDD 1a y 1b (fase por rol, ratificación, auditoría, tareas, puertas y torre) y de 4a (estado de las fuentes); si 1a o 1b no están activos, no hay objetivos ni puertas que revisar: la guardia de cada fase manda.
- **Memoria automática y nombres:** el agente actual guarda hechos de cuentas con interlocutores; Fede decidió (2026-10-31) que los recuerdos solo nombren cargos y roles (CA-12), lo que cambia ese comportamiento. Que el agente evite nombres es una instrucción a un modelo: puede fallar, por eso el usuario puede editar y desactivar (CA-13); los recuerdos existentes con nombres no se migran en este SDD [Por verificar con el gate].
- **Conversaciones privadas:** hoy la comprobación filtra por organización y no por persona (§3); si las reglas de la base de datos no aíslan por persona, CA-7 exige corregirlo antes de activar la fase.
- **Servidor para asistentes con escritura completa:** Fede lo eligió con las reglas del agente (2026-10-31) en vez de solo lectura con propuestas; el riesgo es el volumen de propuestas y que otro asistente tenga identidad de la persona; CA-41 las mantiene pendientes y CA-42 y CA-45 limitan los roles.
- **Avisos críticos:** pueden generar ruido; CA-38 limita a uno por episodio y CA-35 respeta el silencio. «Fuente caída» agrupa dos situaciones (resultado clave sin dato reciente y conexión en Error): un mismo problema puede dar dos avisos de episodios distintos.
- El SDD `money-moment-notices` (Borrador) usa la misma vía de avisos y preferencias; coordinar para no duplicar canales.
- Las sugerencias dentro de la app del SDD de Theory U (Borrador) y los avisos propios que ya existen (CA-47) no son mensajes nuevos del agente; CA-28 solo limita estos últimos.
- **Conversaciones privadas y memoria compartida:** por decisión de Fede (2026-10-31) los recuerdos de empresa y cuenta que salen de una conversación son compartidos, con origen visible y editables (CA-13); el texto de la conversación sigue privado (CA-7). Quien lo hable al agente debe saber que lo aprendido puede quedar en la memoria.
- **Aprobación:** solo aprueba quien pidió la propuesta (CA-19); si no está disponible, la propuesta caduca a los 7 días (CA-46) y otra persona debe pedirla de nuevo. El Owner ve las aplicadas en la auditoría (CA-62).
- **Otros roles:** con la fase activa para ellos, el agente solo les da herramientas de su rol y recuerdos personales (CA-45); es una propuesta del autor, no una decisión de Fede.
- **Criterios con varias obligaciones:** el gate señaló CA-13, CA-22, CA-32 y CA-46; se mantienen porque cada uno describe una sola regla de negocio con sus condiciones; el brief puede dividir sus pruebas.
- **Episodios de aviso:** si un caso entra y sale repetidamente genera un aviso cada vez (CA-38); no hay amortiguación.
- **Agente ejecutor:** el agente puede ejecutar tareas internas a petición (CA-49); no hay ejecución autónoma.
- La meta de G-7 («menos de 10 minutos») no tiene medición instrumentada hasta CA-33.
- Rotar claves de IA o de correo (salida de Lovable B) puede interrumpir el agente; se muestra el error con qué hacer (PRD R-8).
- Cambios del agente que el Owner deshace después de 24 horas no se pueden deshacer desde aquí (CA-22).
- El uso real del agente actual es **sin dato**; las pruebas de regresión usan el comportamiento descrito en el código, no medidas de uso.

## 15. Preguntas para Fede y para la revisión técnica
- Resuelto por Fede (2026-10-31, tras la segunda pasada del gate): el informe semanal se integra en el check-in y el resumen diario sustituye a los envíos actuales; los avisos y el resumen son solo de Owner y Sales leader; las tareas pesadas con coste van con botón; el Owner ve en la auditoría las propuestas aplicadas; las propuestas pendientes se congelan al desactivar la fase; un resumen diario por organización.
- Resuelto por Fede (2026-10-31, tras la primera pasada del gate): los recuerdos de empresa y cuenta de una conversación privada se comparten solos con origen visible; solo aprueba quien pidió la propuesta; el check-in es por persona y lo cierra ella; los avisos existentes se mantienen; el plan con IA va al SDD 5b; el agente puede ser ejecutor de tareas internas.
- Resuelto por Fede (2026-10-31): modos detectados automáticamente; memoria automática y editable; proactividad solo en check-in y avisos críticos; check-in como conversación guiada, lunes a las 9:00 por defecto; recuerdos solo con cargos y roles; avisos críticos siempre sujetos al silencio nocturno; los hallazgos para el Consejo los decide el SDD 7.
- Revisión técnica: ¿cómo se identifica a la persona que usa un asistente externo para aplicar sus permisos por rol y el bloqueo del Consejo?

## 16. Pendiente de verificar
- Si los recuerdos existentes con nombres de personas se migran o se dejan (CA-12) → gate.
- Uso real del agente, de Telegram y del servidor para asistentes → datos de producción.
- Si hay un bot de Telegram conectado en producción y cuántas personas lo han vinculado (los avisos por Telegram dependen de ello) → Fede.
- Si el cron horario y el trabajo programado corren en el hueco necesario para el disparo previo al check-in y los avisos retenidos (CA-30, CA-35) → gate.
- Qué detectores de `src/lib/proactive/` generan hoy mensajes fuera de la app (alcance exacto de CA-28) → gate.
- `agent_pending_actions` guarda el origen pero no quién aprobó (CA-21): verificado por el gate el 2026-10-31; es un cambio de modelo.
- Migraciones 0058 y 0059 sin aplicar → gate.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
**Primera pasada del gate (2026-10-31, sobre la v2).** Informe copiado sin editar.

**Veredicto:** Bloqueado

El SDD tiene buena forma (los 44 CA están en EARS, con G-n y prueba, y cada uno aparece en el §12), y casi todas las citas a otros SDD son correctas. Lo bloquean dos pares de CA que se contradicen, cuatro ciclos de vida sin definir, una dependencia hacia adelante en las unidades y dos obligaciones de otros SDD que se quedan sin cubrir.

**Bloqueantes**

1. **CA-11 (L69) contradice CA-18 y CA-19 (L78-79).** CA-11 guarda los recuerdos «sin pedir aprobación». CA-18 incluye «recuerdos» entre lo que se guarda como propuesta, y CA-19 exige aprobar cada propuesta antes de aplicarla. Lo mismo pasa con «investigaciones»: hoy las herramientas de lectura (búsqueda web, Parallel, `apollo_find_people`) se ejecutan al momento (`agent.server.ts:50,118`), y CA-27 dice que no hay confirmación nueva. Cómo resolverlo: separar en CA-18 lo que se crea sin aprobación (recuerdos, investigaciones) de lo que queda como propuesta (tareas, cambios de estrategia, hallazgos).

2. **CA-7 (L63) choca con CA-11, CA-13 y CA-15.** CA-7 dice que la conversación es privada «sin excepción». Pero los recuerdos que el agente saca de una conversación privada, en ámbito empresa o cuenta, quedan visibles para el Owner y el Sales leader (CA-13) y los usa el agente de otras personas (CA-15). Hoy cualquier miembro los lee: la política «read company/account or own» de `0042_memories.sql` lo permite. Así sale contenido de una conversación privada sin que la persona haga nada, contra el espíritu de CA-9. Cómo resolverlo: que Fede decida si los recuerdos compartidos que salen de una conversación privada necesitan la acción de su dueño o no. Va también en las preguntas.

3. **CA-42 (L106) contradice CA-44 (L108), y la matriz del §10 (L152, L155) contradice CA-6 y CA-44.** CA-42 deniega el servidor para asistentes a los roles sin la fase activa. CA-44 lo mantiene sin cambios para esos mismos roles (PRD R-9). La matriz pone «No (fase no activa)» para otros roles en usar el agente y aprobar propuestas, cuando CA-6 y R-9 les dejan el agente actual. Hoy cada uno decide sus propias acciones pendientes (`decideAgentAction` filtra por `user_id`). Además, SDD 1a CA-5 prevé activar la fase para los demás roles, y el SDD 5 no dice qué pasa entonces. Cómo resolverlo: CA-42 solo para el Consejo; la matriz con dos columnas para otros roles (fase activa / fase no activa); un CA para otros roles con la fase activa.

4. **Ciclo de vida de una propuesta y aprobador distinto del que la pidió (CA-19, CA-39, CA-41, CA-32).** CA-19 deja aprobar a cualquiera que tenga permiso. Pero hoy las acciones pendientes solo las ve y las decide quien las pidió: la RLS de `agent_pending_actions` filtra por `user_id = auth.uid()` (0007, L73-75) y `decideAgentAction` también. Además, las propuestas nacen dentro de conversaciones privadas. El SDD no dice:
   - dónde ve otro aprobador la propuesta;
   - qué estados tiene (hoy: pending, confirmed, cancelled, failed);
   - si caduca;
   - qué pasa si el objeto cambió desde que se propuso;
   - si una tarea del agente es una propuesta pendiente y además una tarea «Sin asignar», o solo lo segundo.

   Cómo resolverlo: un CA con los estados, la bandeja de propuestas visible para los aprobadores, la caducidad y el rechazo cuando el objeto ya cambió.

5. **CA-28 (L90) se contradice con el §14 (L199) y con el código actual.** CA-28 limita los mensajes por iniciativa propia «en la app, por Telegram o por email». El §14 dice que «solo limita lo que se envía fuera de la app». Hoy salen además:
   - el aviso de trabajo terminado (`deliverJobNotice`);
   - el aviso del piloto automático «Lo hice solo: investigué…» (`notifyAutopilot`, `notices.server.ts:54`), que el SDD no menciona en ningún sitio;
   - el resumen diario por Telegram (`channel_links.daily_digest`).

   Y `money-moment-notices` quedaría prohibido por CA-28. Cómo resolverlo: aclarar el canal en CA-28 y listar qué avisos existentes se conservan, se integran o se retiran (con CA de regresión).

6. **Avisos críticos no verificables (CA-36 L98, CA-38 L100, §8 L136).**
   - «Resultado clave en rojo» no es un estado: el estado es «En riesgo» (1b CA-57).
   - «Puerta vencida» no está definida en 1b (sus estados son Pendiente, Cumple, No cumple, Confirmada…), y «próxima» no cita los 14 días.
   - El episodio no dice:
     - si de 80 % a 100 % se sigue en el mismo episodio o empieza otro;
     - qué pasa cuando el presupuesto mensual (`org_budgets.monthly_limit`) se reinicia o no hay límite;
     - qué pasa si el estado va y viene;
     - si se envía un aviso retenido que se resolvió durante el silencio.
   - «Persona sin canal → solo en la app» (§8) no tiene CA: CA-36 y CA-37 no mencionan avisos dentro de la app.

   Cómo resolverlo: definir cada disparador y el inicio y fin del episodio por tipo, y añadir el CA del aviso en la app.

7. **Check-in sin ciclo de vida (CA-29 a CA-33).** Falta definir:
   - a quién se convoca (¿Owner y Sales leader, uno por persona o uno por organización?) y por qué canal;
   - cuándo se cierra (por la persona, al responder todos los ítems, por plazo, al llegar el siguiente); sin eso, CA-33 y G-7 no se pueden medir;
   - qué hace «confirmar» con una tarea «Sin asignar» (1b CA-78 exige asignarla a una iniciativa) o con una decisión pendiente (solo ratifica el Owner);
   - qué pasa si dos personas responden el mismo ítem;
   - qué pasa si la hora del check-in cae en el silencio nocturno personal (CA-35 no cubre el check-in; el check-in usa la zona horaria de la organización y el silencio la de cada persona, `NoticePrefs.timezone`).

   Cómo resolverlo: un CA de estados (convocado, abierto, cerrado, sin abrir) y de destinatarios.

8. **Organización activa compartida entre la app, Telegram y el servidor para asistentes (CA-10, CA-39, CA-40).** Telegram y el servidor resuelven la organización con `profiles.current_org_id` (`channel-ctx.server.ts`, `mcp/context.ts`). `switch_company` del servidor cambia también la empresa activa en la app. `channel_links` es único por (usuario, canal), sin organización. Sin CA quedan:
   - avisos de dos organizaciones que llegan a un mismo chat de Telegram;
   - aprobar desde Telegram una propuesta de una organización que no es la activa;
   - un cambio de organización a mitad de una conversación;
   - el resumen diario de una persona en dos organizaciones (hoy solo de la activa).

   Esto toca R-10. Cómo resolverlo: un CA que fije la organización de cada aviso, propuesta y conversación con independencia de la empresa activa, y que diga qué hace `switch_company`.

9. **Dependencias hacia adelante en el §12 (L174).** U-2 cierra CA-10, que exige aislar recuerdos (U-3) y bloquear al Consejo en Telegram y en el servidor (U-7). U-4 cierra CA-21 (origen «servidor para asistentes», U-7) y CA-26 (que el check-in no lea calendario, U-6; registro de reuniones de 4b U-2, que no está entre las dependencias). Cómo resolverlo: partir CA-10 por unidad o moverlo a U-7, y mover los tramos de CA-21 y CA-26.

10. **Obligaciones de otros SDD sin cubrir (cabecera L10).**
    - 1b §11 (L147) dice «El borrador de plan con IA llega en SDD-5» (PRD §6.1, «Plan con IA: borrador completo editable, aprobado por bloques»). El SDD 5 no lo incluye y ningún otro SDD lo cubre.
    - 1b CA-38 trata del agente como **ejecutor** de una tarea, y CA-24 solo cubre al agente como **creador**. La cabecera afirma cumplir CA-38.

    Cómo resolverlo: incluir el plan con IA o moverlo explícitamente con el OK de Fede; definir si el agente puede ser ejecutor o declarar CA-38 no aplicable.

**Cambios menores**

- **Unidades citadas de otros SDD (cabecera L5, U-4 L176):**
  - «SDD 1a U-3 (ratificación y auditoría)» es incorrecto: CA-51, CA-52 y CA-68 están en 1a U-7; U-3 son los resultados clave. U-0 (retirada de la lectura de LinkedIn) no viene al caso.
  - U-5 depende de «SDD 1b (puertas y torre)» sin unidad: son 1b U-6 y 1a U-3.
  - SDD 3 aparece en «Depende de» pero ninguna unidad depende de él.
- **CA-22 (L82):**
  - «cambio que el agente haya aplicado» no encaja con CA-19, porque siempre aplica una persona.
  - No cubre deshacer después de ediciones humanas posteriores, ni qué pasa con la marca «Modificado tras ratificación» (1a CA-52).
  - `setup-undo.ts` deshace **borrando** lo creado (5 tablas, solo creaciones). Reutilizarlo choca con R-7 y con «conservar el estado anterior».
- **CA-13 (L71):** hoy existen políticas de borrado en `memories` («owner deletes»), y en `agent_conversations` hay «own delete». Ninguna dice que se retiren (R-7, CA-5).
- **CA-14:** no dice qué pasa si se reactiva un recuerdo sustituido mientras el nuevo sigue activo.
- **CA-16:** no dice qué pasa con objetivos Cerrados o Pausados.
- **CA-11:** «datos duraderos» no se puede verificar. El vínculo con la conversación no existe en `memories` (es un cambio de modelo nuevo; el §13 no lo dice).
- **CA-8:** falta un hallazgo de empresa sin objetivo ni cuenta, y retirar o editar uno ya compartido.
- **CA-25 (L85):** el caso «sin conexión de correo → se indica cómo conectar» está en el §8 pero no en el CA.
- **CA-40 frente a CA-43:** no queda claro si crear borradores de correo se expone a los asistentes.
- **CA con varias obligaciones** (una sola prueba no las cubre): CA-1, CA-10, CA-25, CA-27 y CA-36.
- **CA-34:** le falta «MIENTRAS la fase esté activa».
- **Desactivar la fase (1a CA-6):** el SDD no dice qué pasa con recuerdos de objetivo, hallazgos, propuestas pendientes, el plazo de deshacer y el horario del check-in.
- **§9 (L143):** faltan los textos de los avisos al 100 %, de conexión en Error y de puerta vencida.
- **§10 (L147):** dice que el servidor usa un cliente privilegiado; es falso (ver hechos de código). A la matriz le faltan: ver hallazgos, recuerdos de ámbito persona, recibir avisos críticos, ver el gasto y recibir el check-in.
- **Pruebas:** `org-isolation.test.ts` ya lo crean 4a U-1 y lo amplía 4b; el SDD 5 debe decir que lo amplía.
- **Estado:** el §17 dice «v1» y la cabecera, v2.

**Preguntas para Fede**

1. Los recuerdos de empresa o cuenta que salen de una conversación privada, ¿se comparten solos o necesitan la acción de su dueño? (bloqueante 2)
2. ¿Puede aprobar una propuesta otra persona distinta de quien la pidió? Si sí, ¿dónde la ve? ¿Caducan las propuestas?
3. ¿Se convoca el check-in al Owner y al Sales leader por separado o uno por organización? ¿Cuándo se da por cerrado?
4. El aviso del piloto automático «Lo hice solo» y los avisos de trabajo terminado, ¿se mantienen con la fase activa?
5. El plan con IA que 1b le pasó a este SDD, ¿entra aquí o va a otro SDD?
6. ¿Puede el agente ser ejecutor de una tarea (1b CA-38)?

**Hechos de código verificados / no verificados**

Verificados:
- Los flujos están agrupados por fase `analysis | plan | architecture | execution | retro` (`bmad/workflows.ts:4`).
- Hay personajes (`personas.ts`) y el modo `interview` (`agent.server.ts:18`).
- El mismo registro de herramientas sirve a la app, a Telegram y al servidor (`agentMcpTools = TOOLS.map`), y las escrituras quedan pendientes en `agent_pending_actions`.
- `decideAgentAction` existe, y solo decide quien pidió la acción.
- La memoria tiene los ámbitos company, user y account, con `active`, `supersedes` y aprendizaje automático (`learnFrom` tras cada turno, y también desde reuniones en `memory.functions.ts`).
- `sendAgentMessage` filtra por organización.
- `NoticePrefs` existe (Telegram «important», silencio de 22 a 8, Europe/Madrid), junto con `telegramDecision` y `flushHeldNotices` (con una ventana de 12 h).
- El email diario es por persona, a las 8:00 por defecto, y solo de la empresa activa.
- El aviso al 80 % y la pausa del trabajo automático al 100 % existen, pero están en `orchestrator/planner.ts` (`budgetState`); `runner.ts` solo los usa.
- `src/lib/AGENTS.md` dice que las migraciones 0058 y 0059 no están aplicadas.

Resuelve los «Por verificar» del §3 y §16:
- Las conversaciones **sí están aisladas por persona** en la base de datos: la RLS de 0007 (L37-40) exige `user_id = auth.uid()`, y `sendAgentMessage` usa el cliente del usuario.
- `agent_pending_actions` **sí guarda el origen** (`source`, 'agent' o 'mcp', desde 0011). **No guarda quién aprobó**: solo `decided_at`.
- La identidad en el servidor para asistentes sale de `ctx.getUserId()` y los roles de `org_members` de la empresa activa (§15).

Falsos o inexactos:
- §10: el servidor para asistentes **no** usa cliente privilegiado; usa `supabaseForUser` con RLS. Telegram sí usa el cliente privilegiado.
- §13: «al servidor le falta el filtro por organización y persona» es falso en parte: `mcpCtx` ya filtra por empresa activa y pertenencia, y guarda `user_id`. Sí faltan la guardia de fase y el bloqueo explícito del Consejo.
- §13: que `setup-undo` «ya resuelve el deshacer» es inexacto: borra lo creado.

No verificados:
- Si Inngest es el planificador: aparecen referencias en el código, sin confirmar.
- La hora exacta del cron horario.
- Si hay bot de Telegram en producción y quién lo usa.
- Qué detectores de `src/lib/proactive/` generan mensajes: no envían nada directamente según grep; los envíos salen de `notices.server.ts` y del email diario.

**Límites de la revisión**

- Solo lectura de documentos y código local. No he consultado la base de datos de producción ni he ejecutado pruebas.
- Las políticas RLS las verifiqué en las migraciones 0007, 0011 y 0042; no comprobé si están aplicadas tal cual en producción.
- No revisé el SDD de salida de Lovable C ni `money-moment-notices` más allá de su mención.
- En los SDD aprobados solo leí los CA citados y lo que dejaron al SDD 5.
- El documento no tiene datos de clientes ni cifras sin fuente: los 10 minutos, los 14 días y el 80 % / 100 % vienen del PRD.

**Respuesta del autor (v3, 2026-10-31).** El informe de la primera pasada está copiado sin editar arriba. Decisiones de Fede que cierran sus seis preguntas: los recuerdos de empresa y cuenta de una conversación privada se comparten solos con origen visible (CA-7, CA-13); solo aprueba quien pidió la propuesta, con caducidad de 7 días (CA-19, CA-46); check-in por persona, cerrado por ella o al llegar el siguiente (CA-33, CA-54); los avisos existentes se mantienen (CA-28, CA-47); el plan con IA va al SDD 5b; el agente puede ser ejecutor de tareas internas (CA-49).

Cambios: 1) CA-18 y CA-19 separan lo que el agente crea sin aprobación de lo que es propuesta; CA-11 define la extracción como criterio verificable. 2) CA-7 aclara que el texto es privado y los recuerdos no son la conversación. 3) CA-42 solo para el Consejo; CA-45 (otros roles con la fase activa) y CA-55 (fase desactivada); matriz del §10 corregida. 4) CA-46 define los estados de las propuestas. 5) CA-28 limita solo los mensajes nuevos del agente y CA-47 conserva los existentes. 6) CA-36 y CA-50 a CA-53 definen cada aviso crítico, su episodio y el aviso en la app; CA-35 cubre el check-in y los avisos resueltos durante el silencio. 7) CA-29, CA-31 a CA-33 y CA-54 definen destinatarios, contenido y cierre del check-in. 8) CA-48 fija la organización de conversaciones, propuestas y avisos. 9) CA-10 se parte (Consejo en Telegram y servidor pasan a CA-39 y CA-42), CA-21 usa el origen registrado y CA-26 se limita al agente (check-in en CA-31, servidor en CA-43). 10) CA-49 cumple 1b CA-38; el plan con IA pasa al SDD 5b. Menores: citas de unidades de 1a y 1b corregidas, CA-22 restaura sin borrar, CA-13, CA-14, CA-15 y CA-8 completados, CA-1, CA-25, CA-27 y CA-36 partidos (CA-56 nuevo), CA-34 con guardia de fase, §9 con los textos que faltaban, §10 y §13 corregidos sobre el cliente del servidor y `setup-undo`, y §16 sin lo verificado. No hay nueva pasada sobre esta v3.

**Segunda pasada del gate (2026-10-31, sobre la v3).** Informe copiado sin editar.

**Veredicto:** Bloqueado

La v3 resuelve bien la mayoría de lo que señaló la primera pasada:
- CA-11 frente a CA-18 queda separado.
- CA-42 deniega el servidor solo al Consejo.
- CA-49 cumple 1b CA-38 y el plan con IA pasa al SDD 5b.
- CA-46 define los estados de las propuestas.
- Las citas a 1a, 1b, 4a y 4b son correctas salvo las que indico abajo.

Quedan cinco bloqueantes: dos son puntos de la primera pasada que se cerraron solo en parte (avisos existentes y dependencias del §12) y tres son contradicciones nuevas entre CA.

**Bloqueantes**

1. **CA-28 y CA-47 (L97, L109): la lista de avisos que se conservan está incompleta.** CA-28 prohíbe «cualquier otro» mensaje del agente por iniciativa propia, y CA-47 solo conserva el trabajo terminado, el piloto automático y los momentos de dinero. En el código salen además:
   - el informe semanal, los lunes, por Telegram y email al Owner y al Sales leader (`weekly-report.server.ts:35-89`). Choca con el check-in del lunes a las 9:00;
   - el resumen diario de Telegram «Buenos días… 3 cosas para hoy» (`routes/api/public/jobs/proactive.ts`, `sendDigests`);
   - el envío por Telegram de las sugerencias urgentes con botones «Aprobar y hacer» (mismo archivo, en torno a la L110-118);
   - el email diario (`daily-email.server.ts`). No queda claro si el resumen diario de CA-34 lo sustituye o se suma.

   Con el texto actual, la prueba de CA-28 no puede decidir si estos mensajes son legales. Cómo resolverlo: en CA-47, una lista cerrada que diga para cada mensaje existente si se conserva, se integra (el informe semanal en el check-in; el resumen de Telegram en CA-34) o se retira, con su prueba de regresión.

2. **CA-41 (L118) contradice CA-24, CA-25 y CA-43.**
   - CA-41 dice que toda escritura de un asistente externo queda como propuesta pendiente.
   - CA-40 y el PRD (§6.1, L128) piden «las mismas reglas del agente», y con esas reglas la tarea del agente se guarda directa como «Sin asignar» (CA-24) y el borrador de correo se crea directo (CA-25, que CA-43 aplica a los asistentes).
   - Lo mismo pasa con los recuerdos (CA-11).
   - Además, 1b (§13, L160) cuenta el servidor para asistentes entre los puntos que crean tareas.

   Cómo resolverlo: que CA-41 enumere qué crea directamente un asistente (tarea «Sin asignar», borrador de correo, recuerdos o ninguno) y qué queda como propuesta.

3. **CA-27 (L91), con CA-18, no se puede cumplir junto a 4a CA-14.** 4a CA-14 exige mostrar el coste «antes de ejecutarla», y que pulsar la acción sea la aprobación. Pero hay tareas pesadas que el agente ejecuta al momento, sin que nadie pulse nada: `enrich_accounts_table` (Parallel, `agent/tools/parallel.ts:64`) y `apollo_enrich_account` (`apollo.ts:35`) son herramientas de lectura, y `agent.server.ts:114` las corre en el acto. CA-18 además permite «investigaciones» sin aprobación, y CA-27 prohíbe una confirmación nueva. En el chat no hay ninguna acción junto a la que mostrar el coste antes de gastar. Cómo resolverlo: o las tareas pesadas con coste pasan a ser acción pendiente con el coste en la tarjeta (pulsar es la aprobación), o CA-27 dice explícitamente que el coste se muestra después, con el OK de Fede.

4. **Los destinatarios cuando la fase está activa para otros roles se contradicen.**
   - **Check-in:** CA-29 (L98) lo convoca a «cada persona con la fase activa»; CA-54 (L114) y la matriz (L181), solo al Owner y al Sales leader.
   - **Avisos críticos:** CA-37 (L106) los envía a quien tenga la fase activa y pueda ver el elemento. Los otros roles ven los resultados clave (PRD §2), así que recibirían «En riesgo», pero la matriz dice «No».
   - **Hallazgos:** CA-8 (L68) los hace visibles a «quienes ven ese objetivo», y CA-45 (L63) dice «sin hallazgos». La matriz remite a CA-45 (L179), así que la definición es circular.
   - **Recuerdos:** CA-45 habla de «los recuerdos que su rol permite» sin definirlo, así que no se puede verificar.
   - **Resumen diario:** CA-34 se lo envía a cualquier rol con la fase activa, y la matriz no tiene esa fila.

   Cómo resolverlo: decir «Owner y Sales leader» en CA-29 y CA-37; excluir a los otros roles en CA-8; definir en CA-45 qué recuerdos usan; añadir la fila del resumen diario a la matriz.

5. **El §12 tiene dependencias hacia adelante (era el bloqueante 9 de la primera pasada).**
   - U-1 cierra CA-45, que necesita el servidor (U-7), los recuerdos (U-3) y los hallazgos (U-2).
   - U-3 cierra CA-15, que habla del check-in (U-6).
   - U-5 cierra CA-35, que retiene el check-in (U-6).

   Faltan además dependencias que no están declaradas:
   - U-4: CA-26 cita 4b CA-7, que está en 4b U-2, no en U-3.
   - U-5: CA-34 cita 1b CA-84, que está en 1b U-5.
   - U-6: CA-55 conserva recuerdos y hallazgos (U-2 y U-3), y CA-29 usa el día y la hora del SDD 2 (U-1).
   - U-7: CA-48 guarda la organización de los avisos (U-5).

   Cómo resolverlo: mover CA-45 a U-7, partir o mover los tramos de check-in de CA-15 y CA-35 a U-6, y declarar el resto de dependencias.

**Cambios menores**

- **CA-29 repite un criterio de un SDD aprobado.** SDD 2 CA-23 ya da al Owner el día y la hora del check-in, y SDD 2 CA-22 y CA-24 la zona horaria. El SDD 5 no cita el SDD 2 ni depende de él, y el §10 (L169) presenta «el día y la hora del check-in» como concepto nuevo. Hay que citar 2 CA-23 y depender de 2 U-1.
- **Privacidad, CA-7 y CA-13:**
  - El título de cada conversación son los primeros 80 caracteres del mensaje del usuario (`agent.functions.ts:40`). Si el «origen visible» de CA-13 lo muestra, filtra texto privado. CA-13 debe decir que el origen muestra persona y fecha, nunca el título ni el texto.
  - El §14 (L226) dice que quien habla al agente «debe saber» que lo aprendido se comparte, pero ningún CA lo exige.
  - El texto sugerido «Esta conversación es solo tuya» (§9, L164) induce a error.
- **Ciclo de vida de las propuestas (CA-46):**
  - No dice cuándo ni cómo se detecta que una propuesta pasa a «rechazada por cambio» (¿al intentar aprobar?, ¿cualquier versión nueva cuenta?), ni qué significan «fallida» y «descartada» (¿quién descarta?).
  - «Solo a la persona que la pidió … hasta que esté decidida» deja abierto quién la ve después.
  - Las propuestas que crea un asistente no tienen conversación (`mcp/tools/agent-tools.ts:136`, sin `conversation_id`) y hoy se confirman en Sugerencias (`mcp/index.ts:15`); el CA no dice dónde se ven.
  - CA-31 incluye «propuestas pendientes» sin limitarlas a las propias: debe decir «las suyas».
  - Faltan dos casos: quien pidió la propuesta pierde el rol o sale de la organización (¿el permiso se comprueba al aprobar?), y se desactiva la fase con propuestas pendientes. En ese caso el agente actual (`decideAgentAction`) podría ejecutarlas sin las reglas de CA-20.
  - CA-55 tampoco trata las tareas «Sin asignar», el plazo de 24 horas para deshacer ni la reactivación (1a CA-6).
- **CA-22:**
  - Cita la auditoría como «SDD 1a CA-70»; es CA-68 (CA-70 es el deshacer).
  - No dice qué pasa con la marca «Modificado tras ratificación» al restaurar el estado anterior.
  - No dice si se avisa a quien aprobó cuando el Owner deshace su cambio, incluido el caso de otro Owner.
- **CA-23** pide la aprobación de «una persona con permiso», y CA-19 solo deja aprobar a quien pidió la propuesta. Hay que alinearlos.
- **CA-12:** «nunca su nombre» depende de las instrucciones al modelo, y el §5 excluye la detección automática de nombres. No hay prueba determinista posible. Conviene separar lo filtrable (contacto, credenciales) de lo que es instrucción al modelo más edición (CA-13).
- **CA-33 y §4:** si el check-in se cierra al llegar el siguiente, saldrán duraciones de 7 días y la medición de G-7 se rompe. Hay que definir «sin abrir» y «cerrado sin terminar» y excluirlos de la medición. Tampoco dice si se puede reabrir tras pulsar Terminar.
- **CA-35:**
  - Hoy los avisos retenidos solo se envían si tienen menos de 12 horas (`notices.server.ts:49`), y el silencio solo aplica a Telegram (`jobs.ts:137`). Retener emails y silencios de más de 12 horas es comportamiento nuevo, y conviene decirlo en el §13.
  - No aclara si el aviso dentro de la app (CA-53) también se retiene.
- **CA-36:** no dice cómo encajan los avisos críticos en los niveles de Telegram que ya existen («Todo», «Solo lo importante», «Solo lo que necesita mi decisión», «Nada»; `jobs.ts:100`).
- **CA-50 y CA-51:**
  - Una puerta con «evento de evaluación» (1b CA-42) nunca avisa.
  - Falta decir si avisan las puertas y los resultados clave de objetivos Pausados o Cerrados.
- **CA-48:** un asistente no puede aprobar propuestas (aprobar sería otra escritura, y CA-41 la deja pendiente), así que esa parte del criterio no tiene efecto. Además tiene cuatro obligaciones.
- **CA-2:** la entrevista de configuración usa el medidor antiguo (`get_setup_status`, `agent.server.ts:44`), que el SDD 2 sustituye por los cuatro bloques con la fase activa.
- **CA con varias obligaciones:** CA-8, CA-13, CA-22, CA-29, CA-32, CA-45, CA-46, CA-48 y CA-55.
- **Referencias y coherencia:**
  - La nota de cabecera (L10) dice que CA-48 va tras CA-10 (H-2), pero está en H-6 (L122).
  - El §8 (L141) remite a CA-25 para el caso de correo sin conexión; ahora es CA-56.
  - El texto de aviso del §9 dice «resultado clave en rojo»; debe decir «En riesgo» (1a CA-22, R-8).
  - U-3 depende de «SDD 3 (fichas)»; es SDD 3 U-6.
  - El §3 sitúa la regla del 80 % y el 100 % en `runner.ts`, pero está en `orchestrator/planner.ts:62-66`.
  - El §13 dice que «CA-46 añade la organización»: es falso, porque `agent_pending_actions.org_id` ya existe y es obligatoria (0007, L58).
  - El PRD (§8) no incluye entre las dependencias del SDD 5 ni el SDD 2 ni el de salida de Lovable C (que sigue en Borrador).

**Preguntas para Fede**

1. Con la fase activa, ¿el informe semanal del lunes, el resumen diario de Telegram y los envíos de sugerencias urgentes se mantienen, se integran en el check-in o el resumen, o se retiran?
2. Si activas la fase para otros roles, ¿reciben resumen diario y avisos críticos? ¿Ven hallazgos?
3. Las tareas pesadas con coste pedidas por chat, ¿se lanzan solas (y el coste se ve después) o con un botón en el que pulsar es la aprobación?
4. Una vez decidida una propuesta, ¿la ve alguien más que quien la pidió?
5. Una persona en dos organizaciones, ¿recibe un resumen diario por cada una o solo de la activa? (CA-34 frente a CA-48)
6. Al desactivar la fase con propuestas pendientes, ¿se congelan, caducan o se pueden aprobar desde el agente actual?

**Hechos de código verificados / no verificados**

Verificados:
- Personajes y flujos por fase: `bmad/personas.ts` y `workflows.ts`. El modo `interview` está en `agent.server.ts:18,41`.
- Las herramientas de lectura se ejecutan al momento y las de escritura crean una acción pendiente (`agent.server.ts:114-121`).
- El servidor para asistentes usa el mismo registro con origen `mcp` (`mcp/tools/agent-tools.ts:136`), y esas acciones se confirman en Sugerencias.
- `decideAgentAction` y `decidePending` filtran por `user_id` y `org_id` (`agent.functions.ts:58`). Telegram decide por la misma vía (`webhook.ts:53-56`).
- `sendAgentMessage` filtra solo por organización (L36), pero usa el cliente del usuario, y la regla de acceso de 0007 (L37) exige `user_id = auth.uid()`. Las migraciones están en `drizzle/migrations`, no en `supabase/migrations`.
- `agent_pending_actions` tiene `org_id` obligatorio, los estados pending, confirmed, cancelled y failed, y `decided_at` (0007, L56-68). El origen se añadió en 0011 (L3). No guarda quién aprobó.
- La memoria tiene los ámbitos company, user y account (0042, L4). Cualquier miembro lee los que no son personales (L25), el Owner y el Sales leader editan (L29) y el Owner borra (L31). No hay vínculo con la conversación (`learnFrom`, `memory.server.ts:82`). Hoy solo se aprende si el mensaje tiene 40 caracteres o más (`agent.server.ts:85`).
- Preferencias de avisos por defecto: «Solo lo importante», silencio de 22 a 8, Europe/Madrid (`jobs.ts:101-102`). Los avisos retenidos se envían si tienen menos de 12 horas (`notices.server.ts:49`). El aviso del piloto automático está en `notices.server.ts:54`.
- El informe semanal, el resumen diario de Telegram y el envío de sugerencias urgentes existen como se describe en el bloqueante 1.
- `switch_company` cambia `profiles.current_org_id`, que comparten la app, Telegram y el servidor (`mcp/tools/companies.ts`). El servidor resuelve la empresa activa y la pertenencia en `mcp/context.ts:11-18`. Telegram usa el cliente privilegiado (`channel-ctx.server.ts:7`).
- El deshacer de la configuración borra lo creado (`agent.functions.ts:129`, `UNDO_TABLES`).
- `create_task` es una herramienta de escritura. Los `start_*` de Parallel y los revelados de Apollo son de escritura; `enrich_accounts_table` y `apollo_enrich_account` son de lectura.

Inexacto: el §13 sobre la organización de las propuestas (ver menores) y el archivo del presupuesto en el §3.

No verificados:
- El horario externo del cron del resumen de Telegram y del cron horario.
- Si Inngest está activo en producción.
- Si hay un bot de Telegram en producción y quién lo usa.
- Si las reglas de acceso de las migraciones están aplicadas así en producción.
- Si «Error» existe como estado en todas las conexiones.

**Límites de la revisión**

- Solo he leído documentos y código local, sin base de datos de producción y sin ejecutar pruebas.
- De los SDD aprobados leí los CA citados, las tablas de unidades y lo que dejaron al SDD 5. Del SDD de salida de Lovable C y de `money-moment-notices` solo leí lo relacionado con el servidor y Telegram.
- El documento no tiene datos de clientes. Las cifras que usa (10 minutos, 14 días, 80 % y 100 %, 7 días, 9:00) vienen del PRD §6.1.

**Respuesta del autor (v4, 2026-10-31).** El informe de la segunda pasada está copiado sin editar arriba. Decisiones de Fede que cierran sus seis preguntas: informe semanal integrado en el check-in y resumen diario único (CA-47, CA-34); avisos y resumen solo para Owner y Sales leader (CA-37, CA-45); tareas pesadas con botón (CA-27); el Owner ve las propuestas aplicadas en la auditoría (CA-62); propuestas pendientes congeladas al desactivar la fase (CA-61); un resumen diario por organización (CA-34).

Cambios: 1) CA-47 es una lista cerrada de avisos existentes (conservados, integrados o sustituidos). 2) CA-41 enumera qué crea directamente un asistente y qué queda como propuesta. 3) CA-27 y CA-18 se alinean con 4a CA-14 (tareas con coste = acción pendiente). 4) Destinatarios: CA-29, CA-34, CA-37, CA-8 y CA-45 dicen Owner y Sales leader y definen lo que ven otros roles. 5) Dependencias del §12: CA-45 pasa a U-7, el check-in sale de CA-15 y CA-35 (CA-31, CA-57) y se declaran las dependencias que faltaban (4b U-2, 1b U-5, SDD 2 U-1). Menores: CA-29 cita SDD 2 CA-22 y CA-23; CA-7 y CA-13 excluyen título y texto del origen; CA-11 avisa de la memoria compartida; CA-46 define cómo se detecta «rechazada por cambio» y quién descarta; CA-22 cita CA-68, la marca «Modificado tras ratificación» y avisa a quien aprobó; CA-23 se alinea con CA-19; CA-12 se separa de la instrucción al modelo (CA-58); CA-33 distingue terminado y cerrado sin terminar; CA-35 aclara email, silencios largos y el aviso en la app (§13); CA-36 cita los niveles de Telegram; CA-50 y CA-51 excluyen eventos de evaluación y objetivos no Activos; CA-48 se limita a Telegram y CA-59 se separa; CA-2 usa los bloques del SDD 2; referencias y hechos de código del §3, §8, §9 y §13 corregidos; nuevos CA-55 (movido), CA-57 a CA-62. Se mantienen CA-13, CA-22, CA-32 y CA-46 con varias condiciones de una sola regla (§14). No hay nueva pasada sobre esta v4.

**Tercera pasada del gate (2026-10-31, sobre la v4).** Informe copiado sin editar.

**Veredicto:** Bloqueado

La v4 aplica bien casi todo lo que señaló la segunda pasada. Las citas a otros SDD son correctas en número y en unidad. Cada CA del 1 al 62 está en una sola unidad del §12. Los textos del §9 usan ya «En riesgo».

Bloquean la aprobación seis problemas: una dependencia hacia adelante, una contradicción con 4a, el coste de las herramientas sin cerrar, los canales de cuatro de los cinco avisos críticos sin definir, los recuerdos de otros roles y qué pasa con la memoria al desactivar la fase. Además, una corrección que el §17 da por hecha no está aplicada (CA-48, primer cambio menor).

**Bloqueantes**

1. **El §12 tiene una dependencia hacia adelante: U-5 → U-6 (CA-47, L110).**
   - CA-47 está en U-5 y obliga a integrar el informe semanal en el check-in (CA-31) y a no enviarlo aparte.
   - CA-31 está en U-6, que depende de U-5.
   - Si U-5 se entrega antes, el informe del lunes deja de enviarse y todavía no hay check-in.
   - Además, el contenido de CA-31 (L101) no incluye lo que hoy lleva el informe: pipeline, deals, leads y segmentos (`weekly-report.server.ts:17-31`). «Integrarlo» no se puede verificar.
   - Cómo resolverlo: mover a U-6 la parte de CA-47 sobre el informe semanal y decir en CA-31 qué parte del informe entra.

2. **CA-30 (L100) contradice 4a CA-2 y el PRD §6.1 («Sin dato reciente» al doble del intervalo).**
   - CA-30 dice: «SI alguna falla, ENTONCES DEBE mostrarla con su antigüedad y «Sin dato reciente»».
   - 4a CA-2 solo pone «Sin dato reciente» cuando pasa más del doble del intervalo desde la última lectura correcta. Un fallo aislado debe mostrar el último valor con su antigüedad.
   - Cómo resolverlo: «SI alguna falla, ENTONCES DEBE mostrar el último valor con su antigüedad y, si se cumple 4a CA-2, «Sin dato reciente»».

3. **El coste de las tareas pesadas sigue sin cerrar (CA-18 L82, CA-27 L91, §6 L50, §13 L222).** El bloqueante 3 de la segunda pasada está resuelto solo en parte.
   - CA-27 solo habla de «tarea pesada», sin definirla. El §13 nombra dos herramientas: `enrich_accounts_table` y `apollo_enrich_account`.
   - Hay al menos otras nueve herramientas de lectura que gastan crédito y se ejecutan al momento (`agent.server.ts:114-115`):
     - `research_account`: Firecrawl, «gasta créditos de lectura web».
     - `clay_find_companies`, `clay_find_people` y `clay_enrich_account`: «gasta cupo de Clay».
     - `apollo_find_people` y `apollo_find_companies`.
     - `complete_account`, `find_key_people` y `find_icp_companies`: el orquestador.
   - Por CA-18 («no tienen coste de proveedor… todo lo demás» es propuesta), todas pasarían a propuesta. Por CA-27 y el §13, solo dos.
   - 4a CA-14 exige el coste previo para «buscar con Parallel, Perplexity o Firecrawl». La prueba de CA-27 no puede decidir qué herramienta debe dar tarjeta.
   - Cómo resolverlo: una lista cerrada en CA-27 (o en el §13 con referencia desde CA-27) de las herramientas que pasan a acción pendiente con coste, y la misma lista en el §6 «Modificado».

4. **Solo el aviso de fuente caída tiene reglas de canal (CA-36 L106 frente a CA-50 a CA-52, L111-113).**
   - CA-36 fija el nivel de Telegram («Todo lo que termine» o «Solo lo importante») y el email («si tiene el email diario activado») solo para la fuente caída.
   - Puerta próxima o vencida, resultado clave en riesgo y gasto al 80 % o 100 % no tienen regla de canal. Ejemplo: quien tiene «Solo lo que necesita mi decisión» (`jobs.ts:105`), ¿recibe por Telegram una puerta vencida?
   - Tampoco se dice si el aviso por email es un correo inmediato o va dentro del resumen diario.
   - Cómo resolverlo: sacar la regla de canal a un CA común para los cinco tipos y decir si el email es inmediato.

5. **Recuerdos de otros roles con la fase activa: CA-13 (L74) contradice la matriz del §10 (L187), y CA-11 contradice CA-45.**
   - CA-11 (L72) extrae recuerdos de empresa y cuenta de cualquier turno, sin límite por rol.
   - CA-45 (L126) limita a los otros roles a usar solo sus recuerdos de ámbito persona, pero no limita lo que se escribe. Sus conversaciones alimentarían la memoria compartida que ven el Owner y el Sales leader.
   - CA-13 deja ver y editar «a la persona, los suyos», que incluye los recuerdos de empresa que esa persona generó. Es lo que ya permite la regla de edición de `0042_memories.sql:29` (`user_id = auth.uid() OR …`).
   - La matriz pone «No» para otros roles en «Ver y editar recuerdos de objetivo, empresa y cuenta».
   - Cómo resolverlo: que CA-11 limite la extracción de los otros roles al ámbito persona (o que Fede decida otra cosa) y que CA-13 diga «los de ámbito persona propios».

6. **Fase desactivada: CA-55 (L116) choca con CA-6 y CA-44 (agente actual sin cambios, R-9).**
   - CA-55 manda «conservar sin usar sus recuerdos, hallazgos y conversaciones» y devolver el agente actual.
   - El agente actual carga todos los recuerdos activos de la organización (`memoryBlock`, `memory.server.ts:10-13`) y lista las conversaciones de `agent_conversations`. Para no usar lo creado con la fase activa habría que cambiarlo, y eso choca con «sin cambios».
   - CA-55 tampoco trata las tareas «Sin asignar» ni el plazo de 24 horas para deshacer. La segunda pasada ya lo señaló.
   - Cómo resolverlo: decir qué se oculta (por ejemplo, solo los recuerdos de ámbito objetivo y los hallazgos) y qué sigue usando el agente actual, y añadir el plazo de deshacer.

**Cambios menores**

- **CA-48 (L127): la respuesta v4 (L545) dice «CA-48 se limita a Telegram y CA-59 se separa». No está aplicado.**
  - CA-48 sigue diciendo «desde Telegram o desde un asistente externo», cuando un asistente no puede aprobar propuestas.
  - CA-48 sigue conteniendo, palabra por palabra, las dos obligaciones de CA-59 (L128).
- **Faltan guardias de fase.** CA-46 (caducidad), CA-48 y CA-59 no tienen MIENTRAS. Con la fase inactiva cambiarían Telegram y las acciones pendientes, contra CA-44.
- **CA-59 y CA-47 se contradicen.** CA-59 pide la organización en «cada aviso por Telegram», incluidos los avisos existentes que CA-47 conserva «sin cambios».
- **Lista cerrada de CA-47 incompleta.** `notifyUrgent` también empuja por Telegram «Te han asignado N cuentas» (`detector account_assigned`, `proactive.ts:113`), que no es urgente.
- **CA-41 (L122) frente a CA-18.**
  - La lista de lo que un asistente crea directamente omite borradores de documentos, sugerencias y recuerdos, que CA-18 sí permite al agente.
  - CA-18 dice «borradores de documentos» y CA-41 «borradores de correo».
  - `switch_company` es una escritura directa del servidor y CA-41 no la exceptúa.
- **§6 «Modificado» incompleto.** No incluye que `create_task` y `draft_artifact`, hoy de escritura y pendientes, pasan a crearse directamente (CA-24, CA-18).
- **CA-62 (L95).**
  - No dice quién ve las propuestas «fallidas».
  - No dice si quien la pidió ve sus propias aprobadas.
  - «Aprobadas en la auditoría del Owner (CA-21)» excede CA-21 y 1a CA-68, que solo auditan la estrategia y las conexiones. Una aprobación de `update_deal` no llega a la auditoría.
- **CA-22 (L86).**
  - Las «versiones» (1a CA-52) solo existen para objetivos y decisiones. No se dice cómo se restaura una iniciativa, un canal o una puerta, ni cómo se deshace una creación (¿archivar?).
  - No dice por qué canal se avisa a quien aprobó, ni si ese aviso entra en el límite de CA-28.
- **CA-12 (L73).** «Las cifras que Nokko ya calcula» depende de las instrucciones al modelo, igual que los nombres. Hay que pasarlo a CA-58.
- **CA-58 cita R-4, que trata de las fichas, no de la memoria.** La fuente es el PRD §6.1, «Memoria del agente».
- **CA-17 (L78) mezcla dos fallos.** El guardado ocurre después de responder (`afterResponse`), así que «responder sin recuerdos» solo tiene sentido si falla la lectura.
- **CA-11 (L72) es comportamiento nuevo y el §13 no lo dice.** Hoy:
  - solo se aprende si el mensaje tiene 40 caracteres o más (`agent.server.ts:85`, `memory.server.ts:84`);
  - en el chat nunca se guardan recuerdos de cuenta, porque `learnFrom` se llama sin `accountId` y descarta ese ámbito (`memory.server.ts:90-91`).
- **CA-16** sigue sin decir qué pasa con los objetivos Pausados o Cerrados (menor de la primera pasada, sin tocar).
- **CA-33 y el §4.** La duración entre la apertura y «Terminar» cuenta días si alguien abre el check-in el lunes y lo termina el jueves. Así no se mide G-7.
- **CA-57 (L117).** No aclara si la convocatoria dentro de la app también se retiene.
- **CA-31 (L101).** «Las tareas «Sin asignar» y las propuestas pendientes de la persona» es ambiguo: las tareas «Sin asignar» de los detectores no tienen persona. El §8 (L170) da a entender que son comunes.
- **CA-34 (L104).**
  - El resumen de Telegram se dispara hoy por un cron externo, sin hora por persona (`kind: "digest"`). «Según su hora» es nuevo y no está en el §13.
  - Persona con la fase activa en la organización A e inactiva en la B: el email actual de la B (R-9) y el resumen nuevo de la A pueden solaparse. Ningún CA lo resuelve.
- **CA-36.** El estado de conexión «Sin respuesta» (`no_response`, `connections.ts:38`) no queda dentro ni fuera de «fuente caída».
- **CA-45 (L126).**
  - Cita 1a CA-3 para «denegar al Consejo el agente». 1a CA-3 oculta datos; la negación está en 1b CA-66 y en el PRD §6.1.
  - Sigue con siete obligaciones (y CA-55 con cuatro), y el §14 (L241) no los justifica.
- **CA-61** está en U-6 con `weekly-checkin.test.ts`, pero trata de propuestas (U-4). No hay CA para las acciones pendientes creadas antes de activar la fase.
- **§12, dependencias no declaradas:**
  - U-4 → 1b U-6: CA-18, CA-20 y CA-22 actúan sobre puertas.
  - U-2 → 1a U-2: los hallazgos se refieren a objetivos.
  - U-7 → U-6: la convocatoria del check-in por Telegram debe indicar la organización (CA-59).
- **§12, columna de pruebas de U-7.** Falta `agent-phase-guard.test.ts` (CA-45) y `org-isolation.test.ts` (CA-48, CA-59), que el §7 sí nombra.
- **Cabecera (L5).** «SDD 4b (borradores de correo: U-3)» omite U-2, que U-4 sí declara.
- **Cabecera (L10).** Menciona dos veces CA-55 y CA-61.
- **§8:**
  - L151 remite a CA-35 el check-in en silencio; ahora es CA-57, y L167 lo repite.
  - L147 y L162 son el mismo caso.
  - L138: el aislamiento de los recuerdos es CA-15, no CA-10.
  - Faltan casos para:
    - deshacer con la fase desactivada;
    - propuestas anteriores a la activación;
    - conexión «Sin respuesta».
- **§10.**
  - «Origen y aprobador» no es un concepto nuevo: el origen ya existe (0011).
  - A la matriz le faltan:
    - retirar un hallazgo ajeno (Owner, CA-60);
    - ver las aprobadas en la auditoría (CA-62).
  - La fila «Recibir el check-in…» remite a CA-45, que no habla del check-in.
- **§13 (L220): «falta la pantalla» es falso.** `src/routes/_authenticated/memory.tsx` ya permite editar, fijar y «Olvidar» (desactivar). Lo que falta es reactivar y mostrar los inactivos.
- **§9.** La pantalla de día y hora del check-in es la de SDD 2 CA-23 (U-1); hay que aclarar que no se construye dos veces.
- **§14 (L237).** «CA-28 solo limita estos últimos» se refiere, por la gramática, a los avisos existentes, que es justo lo contrario de lo que se quiere decir.
- **§15 y §16 con puntos ya resueltos.**
  - Se pueden cerrar (verificados por el gate):
    - la identidad en el servidor (`mcpCtx`);
    - las migraciones 0058 y 0059, sin aplicar según `src/lib/AGENTS.md`;
    - qué detectores generan mensajes: ninguno envía directamente; salen por `notifyUrgent`.
  - L256 (recuerdos con nombres) es una decisión de Fede, no del gate.
- **PRD sin actualizar.**
  - El §6.1 no recoge las decisiones de Fede posteriores a la segunda pasada:
    - tareas pesadas con botón;
    - avisos y resumen solo para Owner y Sales leader;
    - un resumen por organización;
    - propuestas congeladas;
    - el informe semanal dentro del check-in.
  - El §6.1 mantiene «MCP | Lectura más proponer», que contradice su propia fila «Servidor para asistentes».
- **§4.** «Avisos enviados y descartados por tipo» no tiene ningún CA que obligue a registrarlos.

**Preguntas para Fede**

1. ¿Apruebas la «excepción deliberada» a 1b CA-84 en el check-in (CA-31)? 1b está aprobado y no hay registro de esa decisión.
2. Hoy el email diario y el resumen de Telegram llegan a todos los miembros (`daily-email.server.ts:2`, `sendDigests`). Si activas la fase para otros roles, CA-45 y CA-47 se los quitan. ¿Es lo que quieres?
3. Las búsquedas sueltas con coste (Clay, Apollo, investigación web), ¿también van con botón o solo las masivas? (bloqueante 3)
4. Las conversaciones de otros roles con la fase activa, ¿pueden alimentar la memoria compartida de empresa y cuenta? (bloqueante 5)
5. Al desactivar la fase, ¿el agente actual sigue usando los recuerdos de empresa y cuenta aprendidos con la fase activa? (bloqueante 6)
6. ¿Qué parte del informe del lunes (pipeline, deals, leads) debe aparecer en el check-in?

**Hechos de código verificados / no verificados**

Verificados:
- `runAgent`: las herramientas de lectura se ejecutan al momento y las de escritura van a `agent_pending_actions` (`agent.server.ts:113-121`). El modo es «chat» o «interview» y la entrevista usa `get_setup_status` (L44, `core-read.ts:186`).
- `sendAgentMessage` filtra la conversación solo por organización (L36). El título son los primeros 80 caracteres del mensaje (L40). `decidePending` filtra por persona y organización (L58).
- La regla de acceso de 0007 aísla las conversaciones y las acciones pendientes por persona (L37-40 y L73-75). Los estados de las acciones son pending, confirmed, cancelled y failed, y `org_id` es obligatorio. `source` llega en 0011. No se guarda quién aprobó.
- `memories` (0042) tiene los ámbitos company, user y account, con `active` y `supersedes`. Cualquier miembro lee los recuerdos no personales (L25); edita quien lo creó, o el Owner y el Sales leader (L29); borra el Owner (L31).
- `NoticePrefs`: Telegram «Solo lo importante» por defecto, silencio de 22 a 8, Europe/Madrid. Las etiquetas de nivel coinciden con CA-36. Los avisos retenidos salen si tienen menos de 12 horas (`notices.server.ts:49`). El silencio solo afecta a Telegram.
- El email diario va a cada miembro, solo de su empresa activa, a las 8:00 por defecto. El informe semanal sale los lunes desde las 6:00 UTC, por Telegram y email, al Owner y al Sales leader. El resumen de Telegram y las sugerencias urgentes con botones salen en `proactive.ts`.
- Presupuesto: aviso al 80 % y pausa al 100 % en `orchestrator/planner.ts:62-66`.
- `setup-undo.ts` deshace creaciones en cinco tablas, borrando.
- Telegram usa el cliente privilegiado (`channel-ctx.server.ts`). El servidor para asistentes usa `supabaseForUser`. `switch_company` cambia `profiles.current_org_id`.
- `notifications` tiene `org_id`. El estado «Error» existe en las conexiones. `src/lib/AGENTS.md` dice que 0058 y 0059 no están aplicadas.

Falso o inexacto:
- §13 L220: la pantalla de memoria sí existe.
- §13 L222: no son dos, sino al menos once las herramientas de lectura con coste.

No verificados:
- Si Inngest está activo en producción y el horario externo del cron del resumen de Telegram.
- Si las reglas de acceso están aplicadas así en producción.
- Si hay un bot de Telegram en producción y quién lo usa.
- Si ya hay recuerdos con nombres en la base de datos.

**Límites de la revisión**

- Solo he leído documentos y código local. No he consultado la base de datos de producción ni ejecutado pruebas.
- De los SDD aprobados leí los CA citados, las tablas de unidades y lo que dejaron al SDD 5. No revisé el SDD de salida de Lovable C ni `money-moment-notices`.
- El documento no tiene datos de clientes. Sus cifras (10 minutos, 14 días, 80 % y 100 %, 7 días, 9:00, 24 horas) vienen del PRD §6.1; los 12 horas, 22 a 8 y 40 caracteres, del código.

**Respuesta del autor.** Pendiente: las seis preguntas para Fede y la decisión sobre dividir el SDD se cierran antes de corregir; no se ha aplicado ningún cambio tras este informe.

## 18. Delta de implementación (lo rellena el agente al entregar)
(sin rellenar)
