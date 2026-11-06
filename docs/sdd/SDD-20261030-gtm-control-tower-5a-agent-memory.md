# SDD-20261030-gtm-control-tower-5a-agent-memory · [Feature] Agente único, conversaciones privadas, memoria y autonomía (fase 5a)

**Tipo:** Feature · **Prioridad propuesta:** Alta
**Estado:** Aprobado por Fede el 2026-10-31 (v4, tras tres pasadas del gate; sin cuarta pasada; con los riesgos declarados del §14) · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-10-31
**PRD:** `docs/prd/PRD-20261030-gtm-control-tower.md` · **Depende de:** SDD 1a (retirada de la lectura de LinkedIn: U-0; roles, Consejo y activación por rol: U-1; objetivos y resultados clave: U-2 y U-3; ratificación, versiones y auditoría: U-7), SDD 1b (tareas: U-5; puertas: U-6; Inicio y menú: U-8), SDD 3 (fichas de conversación sin nombres: U-6), SDD 4a (coste previo: U-8; estado de conexiones: U-1), SDD 4b (registro de reuniones y borradores de correo: U-1, U-2 y U-3) y los SDD de salida de Lovable A y B para construir · **Coordinar con:** `SDD-20261025-connections-bring-your-own-account` y `SDD-20261029-lovable-exit-b-servicios-y-corte` (claves propias de IA y correo) · **Continúa en:** `SDD-20261030-gtm-control-tower-5b-notices-checkin.md` y `SDD-20261030-gtm-control-tower-5c-assistant-server.md`

> Un SDD dice cómo se verifica que está bien hecho. Cada criterio de aceptación (CA-n) debe poder tener una prueba automática que lo nombre.
> Los criterios no nombran tecnología; lo técnico va en el §13 como [Sugerencia — la revisión del gate las valida].
> Las reglas transversales del PRD (§6.2, R-1 a R-10) aplican a todo este SDD. «Organización» es la empresa que usa Nokko; «cuenta» es una empresa prospecto o cliente.
> Este SDD nace de dividir el SDD 5 (v4), que reunía 62 criterios; el original, con las tres pasadas del gate, está archivado en `docs/archivado/SUPERADO-SDD-20261030-gtm-control-tower-5-agent.md`. La numeración de criterios empieza de nuevo en cada uno de los tres.
> **Enmienda 2026-11-06:** añade CA-38 (conservar el bloque de Reglas de Conocimiento en todos los modos), por `SDD-20261106-agent-rules-reader`; aprobada por Fede en el chat. No cambia ningún otro CA.
> El borrador de plan con IA que el SDD 1b dejó a la serie 5 se redacta aparte (SDD 5d, decisión de Fede del 2026-10-31).
> Este SDD cumple o prepara lo que los SDD 1a, 1b y 4b dejaron a su cargo: el deshacer de 24 horas (1a CA-70, que se completa con las herramientas del SDD 5d: 5d sustituye el doble de 5a CA-22 a CA-24 y de 1a CA-70), el ejecutor «agente» de las tareas (1b CA-38, con 5a CA-33), el chat de Inicio y el agente de la barra móvil (1b CA-64 y CA-66) y los límites de los borradores y del registro personal de reuniones (4b CA-7 y CA-9). Modifica 1a CA-6 (al desactivar la fase se conservan y ocultan los datos creados, salvo que el agente actual sigue usando los recuerdos de empresa y cuenta: CA-35) y declara una excepción a PRD R-9 (CA-37: los recuerdos de objetivo, empresa y cuenta se ocultan a los roles distintos de Owner y Sales leader, y esos roles solo aprenden recuerdos de ámbito persona). Los criterios nuevos (CA-37) se añaden tras CA-19, sin reordenar.

## 1. Resumen
Convierte el agente actual (varios personajes, flujos y una entrevista de configuración) en **un solo agente copiloto** en un panel lateral, con **modos que elige solo**, **conversaciones privadas con hallazgos que la persona decide compartir**, **memoria por objetivo y empresa** que se guarda sola y se puede editar, y **autonomía limitada a lo interno**: crea propuestas, nunca ejecuta nada hacia fuera ni cambia un objetivo ratificado sin aprobación. Define el ciclo de vida de las propuestas y qué pasa al desactivar la fase o activarla para otros roles. El check-in, el resumen diario y los avisos críticos van en el SDD 5b; el servidor para asistentes y Telegram, en el SDD 5c.

## 2. Problema y para quién
Hoy el agente es una lista de personajes y flujos sin memoria por objetivo y sin reglas claras de qué hace solo y qué necesita aprobación. Para Fede (Owner) y Flor (Sales leader). El Consejo no usa el agente.

## 3. Evidencia y por qué ahora
- **Código (repo de Nokko, solo lectura, 2026-10-31):**
  - El agente tiene personajes (`src/lib/bmad/personas.ts`), flujos agrupados por fase del Ciclo GTM (análisis, plan, arquitectura, ejecución y retro: `src/lib/bmad/workflows.ts`) y un modo «entrevista» de configuración (`src/lib/agent/agent.server.ts`).
  - Las herramientas de lectura corren al momento y las de escritura quedan como acción pendiente que decide quien la pidió (`decideAgentAction`, `src/lib/agent.functions.ts`); la acción pendiente guarda organización, origen (agente o servidor) y `decided_at`, no quién aprobó (`agent_pending_actions`, migraciones 0007 y 0011).
  - Ya existe una memoria con ámbitos empresa, persona y cuenta, que el agente aprende solo de las conversaciones y en la que se desactiva sin borrar (`src/lib/memory.server.ts`, migración 0042); no existe el ámbito objetivo ni el vínculo con la conversación. Cualquier miembro lee los recuerdos no personales y editan quien los creó, el Owner y el Sales leader.
  - Cada conversación guarda su dueño y organización (`agent_conversations`); la comprobación al continuarla filtra por organización y no por persona, pero la base de datos sí las aísla por persona (migración 0007; no comprobado en producción). El título es el principio del primer mensaje.
  - Hoy el chat solo aprende si el mensaje tiene 40 o más caracteres y no guarda recuerdos de cuenta.
  - `setup-undo.ts` deshace borrando lo creado (solo creaciones, cinco tablas).
- **Herramientas:** el registro actual no tiene herramientas que propongan cambios sobre objetivos, resultados clave, iniciativas, públicos, canales, puertas o decisiones, ni que lean o escriban los cuatro bloques del SDD 2 (`src/lib/agent/tools/`); las más parecidas (`update_positioning`, `upsert_segment`, `create_icp`, `set_quota`) tocan la configuración anterior.
- **Entrevista con Fede (2026-10-29 a 31):** un agente con modos; copiloto y proactivo; memoria por objetivo y empresa; conversaciones privadas con hallazgos compartidos; el Consejo bloqueado; agente en panel lateral; autonomía solo interna (PRD §6.1).
- **Decisiones de Fede para este SDD (2026-10-31):** modos detectados automáticamente; memoria automática y editable; los recuerdos de empresa y cuenta que salen de una conversación privada se comparten solos, con origen visible; los recuerdos solo nombran cargos y roles; solo aprueba quien pidió la propuesta, con caducidad a los 7 días; el agente puede ser ejecutor de tareas internas; las tareas pesadas con coste van con botón; el Owner ve en la auditoría las propuestas aplicadas; las propuestas pendientes se congelan al desactivar la fase; las herramientas de propuesta de cambios de estrategia van en el SDD 5d; los recuerdos de empresa y cuenta solo los ven Owner y Sales leader; llevan coste en la tarjeta las herramientas de proveedor, no los borradores con IA; los recuerdos existentes con nombres se dejan y se editan a mano.
- Uso real del agente actual: **sin dato** [Por verificar].

## 4. Resultado buscado
- Ninguna acción hacia terceros sin aprobación humana (G-10). Medición: pruebas de CA-25 y revisión de la auditoría.
- Cada propuesta termina decidida o caducada; ninguna se aplica sin su aprobador (G-10). Medición: propuestas por estado (CA-31). Línea base: sin dato.
- El agente cubre los flujos actuales sin personajes (G-7). Medición: modo guardado en cada conversación (CA-2). Línea base: sin dato.

## 5. Alcance
**Incluye:** H-1 a H-5.
**No incluye:**
- Check-in semanal, resumen diario y avisos críticos (SDD 5b).
- Servidor para asistentes, Telegram y la organización de cada aviso (SDD 5c).
- Fuentes de datos, conexiones y su estado (SDD 4a); calendario, correo y notas de llamadas (SDD 4b), salvo lo que el agente puede hacer con ellos (CA-27, CA-28 y CA-30).
- Mercado, competencia y radar semanal (SDD 6); vista del Consejo, runway y gatillo de continuidad, y cómo ve el Consejo los hallazgos (SDD 7); plan con IA (SDD 5d).
- Cualquier envío de mensajes o correos a personas distintas de la propia, publicación de contenido, invitaciones a terceros o revelado de contactos sin aprobación (PRD R-2).
- La detección automática de nombres en texto libre.
- Cambios de las pantallas de torre, Plan y Decisiones (SDD 1a y 1b); solo se añade el chat de Inicio y el panel.
- Las herramientas que proponen cambios de estrategia y las que leen o escriben los bloques de contexto (SDD 5d): hasta entonces, CA-22 a CA-24 se prueban con un doble; las demás herramientas se reutilizan del registro actual.

## 6. Cambios de comportamiento (delta)
**Añadido:** modos detectados automáticamente; panel lateral y chat de Inicio; hallazgos compartidos; memoria con ámbito objetivo; estados de las propuestas con caducidad; registro de qué crea el agente; deshacer de 24 horas; el agente como ejecutor de tareas internas; congelación de propuestas y ocultación de hallazgos al desactivar la fase.
**Modificado:** las herramientas con coste de proveedor (las del §13) pasan a acción pendiente con el coste en la tarjeta (las de lectura, de ejecutarse al momento; las de escritura, de ir sin coste); `create_task` y `draft_artifact`, hoy acciones pendientes, se crean directamente (CA-20 y CA-26); el agente deja de ofrecer personajes (sus flujos pasan a ser modos); los recuerdos de ámbito objetivo, empresa y cuenta dejan de ser visibles para los roles distintos de Owner y Sales leader (CA-37).
**Eliminado:** la elección de personaje como entrada del agente; nada se borra (R-7).

## 7. Historias y criterios de aceptación
Cada CA cita el objetivo G-n del PRD que cubre y el archivo de prueba (ruta por decidir en la implementación [Sugerencia]).

### H-1: Como Owner o Sales leader, quiero un único agente en un panel lateral que sepa en qué modo trabajar.
- **CA-1** MIENTRAS la fase esté activa para mi rol, el sistema DEBE ofrecer un único agente en un panel lateral abierto desde cualquier pantalla, y en Inicio como entrada de chat (en pantalla estrecha, desde el elemento «Agente» de la barra inferior, SDD 1b CA-66). · cubre G-7 · prueba: `agent-modes.test.ts`
- **CA-2** CUANDO escribo sin elegir modo, el sistema DEBE elegir el modo entre los flujos actuales agrupados por fase del Ciclo GTM (análisis, plan, arquitectura, ejecución y retro), la conversación libre y la entrevista de configuración, DEBE mostrar el modo activo y DEBE guardarlo en la conversación. · cubre G-7 · prueba: `agent-modes.test.ts`
- **CA-3** El sistema DEBE permitirme cambiar el modo en cualquier momento y DEBE usar el elegido hasta que lo cambie otra vez o abra una conversación nueva. · cubre G-7 · prueba: `agent-modes.test.ts`
- **CA-4** SI el sistema no puede determinar el modo, ENTONCES DEBE tratar la petición como conversación libre y preguntarme qué quiero, y DEBE abstenerse de iniciar un flujo que produce un documento sin que yo lo confirme. · cubre G-7 · prueba: `agent-modes.test.ts`
- **CA-5** MIENTRAS la fase esté activa para mi rol, el sistema DEBE conservar las conversaciones y los documentos creados con los personajes anteriores (PRD R-7) y, SI una petición todavía trae un personaje, ENTONCES DEBE tratarla como la misma petición sin personaje, sin error. · cubre G-7 · prueba: `agent-modes.test.ts`
- **CA-6** MIENTRAS la fase no esté activa para mi rol, el sistema DEBE mantener el agente actual con sus personajes y la entrada actual de Inicio, sin cambios (PRD R-9; SDD 1b CA-64), salvo lo que fijan CA-34, CA-35 y CA-37. · cubre G-7, G-10 · prueba: `agent-phase-guard.test.ts`
- **CA-38** (enmienda 2026-11-06, aprobada por Fede en el chat) En todos los modos y canales, el prompt del turno DEBE conservar el bloque de Reglas de Conocimiento definido en `SDD-20261106-agent-rules-reader` (CA-1a a CA-4); sustituir personajes y flujos por modos no lo elimina. · cubre G-7 · prueba: `agent-modes.test.ts`

### H-2: Como persona de Nokko, quiero que mis conversaciones con el agente sean privadas y poder compartir solo lo que decido.
- **CA-7** El sistema DEBE mostrar el texto y el título de cada conversación solo a la persona que la mantiene, sin excepción para otros roles ni para el Owner, y DEBE abstenerse de escribirlos en la auditoría; los recuerdos que el agente saca de ella (CA-12) no son la conversación y siguen sus propias reglas. · cubre G-10 · prueba: `agent-conversations-privacy.test.ts`
- **CA-8** CUANDO comparto un resultado de una conversación como hallazgo, el sistema DEBE guardar solo el texto que yo revisé (no la conversación), con autor, fecha y el objetivo, la cuenta o la empresa a los que se refiere, DEBE hacerlo visible solo al Owner y al Sales leader con la fase activa, y DEBE advertir antes de guardar que no incluyas datos de clientes. · cubre G-7, G-10 · prueba: `agent-findings.test.ts`
- **CA-9** El sistema DEBE permitir al agente proponerme compartir un hallazgo y DEBE abstenerse de compartirlo sin mi acción. · cubre G-10 · prueba: `agent-findings.test.ts`
- **CA-10** El sistema DEBE denegar al Consejo el agente de la app y DEBE ocultarle conversaciones y hallazgos (SDD 1a CA-3), y DEBE separar las conversaciones y los hallazgos por organización y por persona: una organización NO DEBE ver ni usar los de otra y una persona en dos organizaciones DEBE tener conversaciones independientes en cada una (PRD R-10). · cubre G-10 · prueba: `org-isolation.test.ts`
- **CA-11** El sistema DEBE permitir al autor de un hallazgo editarlo o retirarlo (archivar, PRD R-7) y al Owner retirarlo, y DEBE conservar quién lo hizo. · cubre G-10 · prueba: `agent-findings.test.ts`

### H-3: Como Owner o Sales leader, quiero que el agente recuerde lo que importa de cada objetivo y de la empresa, y poder corregirlo.
- **CA-12** MIENTRAS la fase esté activa para mi rol, CUANDO termina un turno de conversación, el sistema DEBE ejecutar la extracción de recuerdos y guardar sin pedir aprobación los que esta devuelva en los ámbitos objetivo y cuenta (los ligados a la conversación, CA-16), empresa y persona (solo persona para los demás roles, CA-36 y CA-37), DEBE abstenerse de guardar nada si no devuelve ninguno, DEBE marcar que los generó el agente, DEBE guardar de qué conversación proceden sin copiar su texto y DEBE avisar en el panel al Owner y al Sales leader de que lo aprendido sobre la empresa o una cuenta queda en la memoria compartida con ellos. · cubre G-7, G-10 · prueba: `agent-memory.test.ts`
- **CA-13** MIENTRAS la fase esté activa para mi rol, el sistema DEBE abstenerse de guardar como recuerdo el texto literal de las fichas de conversación, los datos de contacto y las credenciales. · cubre G-10 · prueba: `agent-memory.test.ts`
- **CA-14** El sistema DEBE permitir ver, editar y desactivar cada recuerdo: a la persona, los de ámbito persona propios; al Owner y al Sales leader con la fase activa, los de ámbito objetivo, empresa y cuenta, incluidos los que salieron de conversaciones de otras personas, con su origen visible como persona y fecha, nunca el título ni el texto de la conversación. Desactivar NO DEBE borrar (PRD R-7) y DEBE poder reactivarse. · cubre G-7, G-10 · prueba: `agent-memory.test.ts`
- **CA-15** SI un recuerdo nuevo contradice o actualiza uno activo, ENTONCES el sistema DEBE guardar el nuevo y desactivar el anterior conservándolo, enlazado al nuevo, y SI alguien reactiva un recuerdo sustituido, ENTONCES DEBE desactivar el que esté activo en su cadena de sustituciones. · cubre G-7 · prueba: `agent-memory.test.ts`
- **CA-16** El sistema DEBE usar en cada respuesta solo los recuerdos de la organización activa de esa conversación, DEBE reservar los de ámbito persona a su dueño y DEBE usar los de ámbito objetivo y cuenta solo del objetivo y de la cuenta a los que la conversación está ligada, que son los de la ficha desde la que se abrió o los que la persona elige en el panel; SI la persona cambia el objetivo o la cuenta a mitad, ENTONCES los recuerdos ya guardados conservan el suyo y los nuevos van al nuevo, y una conversación sin objetivo o sin cuenta no genera recuerdos de ese ámbito. · cubre G-7, G-10 · prueba: `agent-memory.test.ts`
- **CA-17** CUANDO se archiva un objetivo, el sistema DEBE dejar de usar sus recuerdos y conservarlos (PRD R-7); los de un objetivo Pausado o Cerrado se siguen usando solo en conversaciones sobre ese objetivo (CA-16). · cubre G-7 · prueba: `agent-memory.test.ts`
- **CA-18** MIENTRAS la fase esté activa para mi rol, SI la lectura de la memoria falla, ENTONCES el sistema DEBE responder sin recuerdos, DEBE decirme que no pudo consultarlos y qué hacer (reintentar) y DEBE abstenerse de inventar recuerdos. · cubre G-7 · prueba: `agent-memory.test.ts`
- **CA-19** MIENTRAS la fase esté activa para mi rol, el sistema DEBE indicar al extractor de recuerdos que no guarde cifras que Nokko ya calcula y que de las personas de una cuenta guarde solo su cargo o rol, nunca su nombre (PRD §6.1, «Memoria del agente»), y DEBE advertir en la lista de recuerdos que se revise que no haya nombres; no hay detección automática de nombres (§5). · cubre G-10 · prueba: `agent-memory.test.ts`
- **CA-37** El sistema DEBE ocultar los recuerdos de ámbito objetivo, empresa y cuenta a los roles distintos de Owner y Sales leader, en la pantalla de memoria y en el agente, también en Telegram y aunque no tengan la fase activa, y DEBE guardar de sus conversaciones, reuniones, sugerencias decididas y descubrimientos solo recuerdos de ámbito persona (excepción deliberada a PRD R-9, decidida por Fede el 2026-10-31). · cubre G-10 · prueba: `agent-memory.test.ts`

### H-4: Como Owner, quiero que el agente solo cree propuestas internas y que nada salga ni cambie lo ratificado sin mi aprobación.
- **CA-20** MIENTRAS la fase esté activa para mi rol, el sistema DEBE permitir al agente crear sin aprobación solo elementos internos que no cambian el negocio ni la estrategia y no tienen coste de proveedor (consultas de lectura, investigaciones sin coste, borradores de documentos, borradores de correo con CA-27, sugerencias, recuerdos y tareas como propuesta «Sin asignar» con CA-26), DEBE registrar que los creó el agente y DEBE tratar como propuesta pendiente (CA-21 y CA-31) todo lo demás que quiera cambiar, incluidos los datos del negocio y los cambios sobre objetivos, resultados clave, iniciativas, públicos, canales, puertas y decisiones (PRD R-3). · cubre G-7, G-10 · prueba: `agent-autonomy.test.ts`
- **CA-21** El sistema DEBE exigir que apruebe cada propuesta de cambio la persona que la pidió, siempre que su rol tenga permiso para esa acción, y DEBE denegar la aprobación a cualquier otra persona y a quien no tenga ese permiso. · cubre G-10 · prueba: `agent-autonomy.test.ts`
- **CA-22** DONDE el agente tenga una herramienta que proponga cambiar un objetivo o una decisión ratificados (la trae el SDD 5d), el sistema DEBE crear solo una propuesta; al aplicarla DEBE crear la versión «Modificado tras ratificación» (SDD 1a CA-52) y DEBE impedir que el agente ratifique: solo ratifica el Owner (SDD 1a CA-51). · cubre G-3, G-10 · prueba: `agent-autonomy.test.ts`
- **CA-23** MIENTRAS la fase esté activa para mi rol, el sistema DEBE registrar en la auditoría (SDD 1a, CA-68) cada cambio aplicado desde una propuesta (CA-31) sobre los elementos que ese criterio audita, con la persona que lo aprobó, el origen registrado de la propuesta y la hora. · cubre G-10 · prueba: `agent-autonomy.test.ts`
- **CA-24** DONDE el agente tenga herramientas que propongan cambios de estrategia (las trae el SDD 5d), el sistema DEBE permitir al Owner deshacer durante 24 horas cada cambio aplicado por una persona desde una propuesta del agente (sobre objetivos, resultados clave, iniciativas, públicos, canales, puertas o decisiones), también si la fase está desactivada para su rol y desde la auditoría; DEBE restaurar el estado anterior sin borrar nada (PRD R-7), como una versión nueva en objetivos y decisiones (SDD 1a CA-52), marcada «Modificado tras ratificación» hasta que el Owner ratifique de nuevo si estaba ratificado, como un cambio nuevo registrado en los demás elementos y archivando lo que el cambio creó; DEBE avisar en la app a quien aprobó el cambio y registrarlo en la auditoría (SDD 1a CA-68); SI el elemento cambió después, ENTONCES DEBE negarse y decirle qué pasó y qué hacer. El plazo de 24 horas es el de SDD 1a CA-70. · cubre G-3, G-10 · prueba: `agent-undo.test.ts`
- **CA-25** SI una petición implica una acción externa de la lista cerrada del PRD R-2 (publicar contenido, enviar mensajes o correos a otras personas, invitar a terceros a eventos, revelar o exportar contactos con crédito de un proveedor), ENTONCES el sistema DEBE prepararla como borrador o propuesta y DEBE abstenerse de ejecutarla sin la aprobación de la persona que la pidió, si su rol tiene permiso (SDD 4a, CA-15, para los contactos con crédito). · cubre G-10 · prueba: `agent-external-actions.test.ts`
- **CA-26** MIENTRAS la fase esté activa para mi rol, DONDE el agente cree una tarea, el sistema DEBE guardarla directamente como tarea «Sin asignar» (SDD 1b CA-78), sin otra propuesta que aprobar, DEBE mostrar en ella que la creó el agente y DEBE mantenerla fuera de las respuestas de las herramientas que listan tareas hasta que alguien la asigne a una iniciativa (SDD 1b CA-84). · cubre G-2, G-10 · prueba: `agent-autonomy.test.ts`
- **CA-27** CUANDO pido un seguimiento por correo y tengo conectado el correo personal, el sistema DEBE redactar el borrador sin leer mi buzón y DEBE crearlo solo como borrador en mi cuenta (SDD 4b CA-9 a CA-11), sin enviar nada y solo cuando yo lo pida. · cubre G-6, G-10 · prueba: `agent-mail-drafts.test.ts`
- **CA-28** El sistema DEBE abstenerse de que el agente lea o procese con IA el registro personal de reuniones, el contenido del calendario o el correo de una persona (SDD 4b CA-7 y CA-9). · cubre G-10 · prueba: `agent-no-personal-data.test.ts`
- **CA-29** MIENTRAS la fase esté activa para mi rol, CUANDO el agente propone una herramienta con coste de proveedor, de lectura o de escritura (las de la lista del §10), el sistema DEBE guardarla como acción pendiente, con los estados y la caducidad de CA-31 (una lectura no puede quedar «rechazada por cambio»), con su coste previo estimado en la tarjeta (SDD 4a, CA-14), DEBE ejecutarla solo cuando la persona que la pidió la pulse, que es la aprobación, y DEBE devolver el resultado de una lectura a su conversación; los borradores con IA no llevan tarjeta de coste. · cubre G-6, G-10 · prueba: `agent-cost-preview.test.ts`
- **CA-30** SI pido un seguimiento por correo y no tengo conectado el correo personal, ENTONCES el sistema DEBE abstenerse de crear el borrador y DEBE decirme qué pasó y cómo conectarlo (PRD R-8). · cubre G-6 · prueba: `agent-mail-drafts.test.ts`
- **CA-31** MIENTRAS la fase esté activa para mi rol, el sistema DEBE guardar cada propuesta de cambio con su organización, su origen, quién la decide y cuándo, y uno de estos estados: pendiente; aprobada; descartada (cuando quien la pidió la descarta); caducada (a los 7 días sin decisión); rechazada por cambio (cuando, al intentar aprobarla, el elemento afectado tiene una fecha de modificación posterior a la de la propuesta); o fallida (cuando aplicarla da error); DEBE comprobar el permiso de quien la pidió al aprobar, no al proponer; DEBE abstenerse de aplicar una propuesta que no esté pendiente; y DEBE dejar con el comportamiento anterior (PRD R-9) las acciones pendientes creadas por el agente actual, antes de la activación o mientras la fase esté desactivada. · cubre G-10 · prueba: `agent-proposals.test.ts`
- **CA-32** El sistema DEBE mostrar cada propuesta o acción con coste pendiente, fallida, descartada, caducada o rechazada solo a la persona que la pidió, junto con su conversación o, si la creó un asistente externo, en su bandeja de Sugerencias; DEBE mostrar las aprobadas a quien las pidió en su lista de propuestas por estado; y DEBE mostrar en la auditoría del Owner las que cambiaron los elementos que audita SDD 1a CA-68 (CA-23). · cubre G-10 · prueba: `agent-proposals.test.ts`
- **CA-33** DONDE una tarea tenga al agente como ejecutor, el sistema DEBE limitarlo a tareas internas (investigación y borradores), DEBE mostrarlo en la tarea (SDD 1b CA-38), DEBE ejecutarla solo cuando una persona con permiso sobre la tarea se lo pida, DEBE dejar el resultado como borrador en la tarea sin marcarla como Hecha, DEBE hacer pasar por CA-29 cualquier herramienta con coste que necesite y DEBE preparar como propuesta cualquier acción externa asociada (CA-25). · cubre G-2, G-10 · prueba: `agent-executor.test.ts`

### H-5: Como Owner, quiero que desactivar la fase o activarla para otros roles no deje accesos indebidos ni propuestas sin control.
- **CA-34** MIENTRAS la fase esté desactivada para un rol, el sistema DEBE congelar sus propuestas y acciones con coste pendientes creadas con la fase activa, sin permitir aprobarlas pero sí descartarlas, mostrándolas a su dueño, DEBE seguir contando su caducidad (CA-31) y DEBE permitir aprobarlas de nuevo al reactivarla. · cubre G-10 · prueba: `agent-proposals.test.ts`
- **CA-35** El sistema DEBE ocultar a un rol que no tiene la fase activa (porque nunca la tuvo o porque se le desactivó) los hallazgos y los recuerdos de ámbito objetivo, también en Telegram; CUANDO el Owner desactiva la fase para un rol, DEBE devolverle el agente actual (PRD R-9) y seguir permitiendo al Owner deshacer los cambios dentro de sus 24 horas, y al reactivarla DEBE volver a mostrar lo oculto. · cubre G-10 · prueba: `agent-phase-guard.test.ts`
- **CA-36** DONDE el Owner active la fase para otros roles (SDD 1a CA-5), el sistema DEBE ofrecerles el agente solo con las herramientas que su rol permite, solo con sus recuerdos de ámbito persona y sin hallazgos ni cambios de estrategia, DEBE guardar de sus conversaciones solo recuerdos de ámbito persona y DEBE denegar al Consejo el agente (SDD 1b CA-66; PRD §6.1). · cubre G-10 · prueba: `agent-phase-guard.test.ts`

## 8. Casos límite y errores
Cada caso remite al CA que lo cubre.
- Petición ambigua o sin modo claro → conversación libre y pregunta (CA-4).
- Conversación abierta con un personaje anterior → misma petición sin personaje (CA-5).
- Otra persona, incluido el Owner, intenta ver mi conversación → denegado (CA-7).
- Hallazgo con datos de clientes → advertencia antes de guardar (CA-8); el agente nunca lo comparte solo (CA-9).
- Consejo intenta usar el agente → denegado (CA-10); en Telegram y en el servidor, SDD 5c CA-7 y CA-3.
- Misma persona en dos organizaciones → conversaciones y hallazgos independientes (CA-10) y recuerdos de la organización activa (CA-16).
- Recuerdo erróneo → se edita o se desactiva sin borrar (CA-14); recuerdo contradictorio → el nuevo sustituye y el anterior queda enlazado (CA-15).
- Objetivo archivado → sus recuerdos dejan de usarse (CA-17).
- Falla la memoria → respuesta sin recuerdos con aviso y qué hacer (CA-18).
- Propuesta del agente sin permiso del aprobador → denegada (CA-21).
- Cambio sobre un objetivo ratificado → versión «Modificado tras ratificación» y solo el Owner ratifica (CA-22).
- Cambio del agente que el Owner quiere revertir → deshacer dentro de 24 horas (CA-24).
- Petición de enviar, publicar, invitar o revelar contactos → borrador o propuesta sin ejecutar (CA-25).
- Tarea creada por el agente sin iniciativa → propuesta «Sin asignar», marcada (CA-26).
- Seguimiento por correo sin conexión personal de correo → no se crea borrador y se indica cómo conectar (CA-30).
- Petición de leer el calendario o el correo de una persona → rechazada (CA-28, SDD 5c CA-4).
- Tarea pesada con coste → coste previo visible (CA-29).
- Propuesta sin decidir 7 días, o con el elemento cambiado → caducada o rechazada por cambio (CA-31).
- Otra persona intenta aprobar la propuesta de alguien → denegado (CA-21, CA-31).
- Tarea con el agente como ejecutor → solo interna y a petición (CA-33).
- Fase desactivada con propuestas pendientes → congeladas hasta reactivar o caducar (CA-34).
- Hallazgo propio o ajeno → editar o retirar (CA-11).
- Propuesta cuya aplicación falla → fallida, solo visible a quien la pidió (CA-31, CA-32).
- Deshacer con la fase desactivada para el Owner → posible desde la auditoría (CA-24).
- Rol sin la fase intenta ver recuerdos de empresa o cuenta → ocultos (CA-37).
- Herramienta con coste de proveedor → acción pendiente con coste en la tarjeta (CA-29).
- Rol sin la fase activa → agente actual sin cambios (CA-6); fase desactivada después de usarla → agente actual, hallazgos y recuerdos de objetivo ocultos, propuestas congeladas (CA-35, CA-34).
- Otros roles con la fase activa → agente solo con lo que su rol permite y recuerdos personales (CA-36).
- Persona que pierde el rol o sale de la organización con una propuesta pendiente → el permiso se comprueba al aprobar (CA-31).
- Acción pendiente creada antes de activar la fase → comportamiento anterior (CA-31).

## 9. Experiencia y copy
Sistema visual actual (Ink + Lima, versalitas con filete, sin iconos), textos en «tú».
- **Mensajes sugeridos** (a validar con la guía de voz de marca): «El texto de esta conversación es solo tuyo. Lo que aprendo sobre tu empresa queda en la memoria, donde puedes editarlo.» · «He guardado una propuesta. Nada cambia hasta que la apruebes.» · «No he podido consultar la memoria. Responderé sin ella; vuelve a intentarlo en unos minutos.»
- **Pantallas:** panel lateral del agente con el modo activo y selector (CA-1 a CA-3); chat de Inicio (CA-1); lista de recuerdos con ámbito, origen y editar o desactivar (CA-14; la pantalla actual de memoria ya edita y olvida: falta reactivar y mostrar los inactivos); lista de hallazgos (CA-8); lista de las propias propuestas por estado (CA-32); pantalla de deshacer del Owner (CA-24); tarjeta de acción pendiente con el coste previo y las acciones aprobar y descartar (CA-29).

## 10. Datos, permisos y privacidad
- **Conceptos nuevos:** ámbito objetivo de la memoria con el vínculo a la conversación de origen, objetivo ligado a una conversación, hallazgo compartido, aprobador, estados y caducidad de cada propuesta e instantánea del estado anterior al aplicar un cambio (para deshacer, CA-24).
- **Acceso (como exigen las reglas del repo):** las estructuras nuevas llevan organización por defecto la actual, acceso filtrado por organización y permisos explícitos; las conversaciones solo las lee su dueño por regla de base de datos [Sugerencia — el gate valida].
- **Matriz de permisos:**

| Acción | Owner | Sales leader | Consejo | Otros roles |
|---|---|---|---|---|
| Usar el agente | Sí | Sí | No | Fase no activa: el agente actual (CA-6). Fase activa: solo lo que su rol permite (CA-36) |
| Compartir y ver hallazgos, con la fase activa (CA-8) | Sí | Sí | No | No |
| Ver recuerdos de empresa y cuenta sin la fase activa (CA-37) | Sí | Sí | No | No |
| Ver recuerdos de objetivo sin la fase activa (CA-35) | No | No | No | No |
| Retirar un hallazgo ajeno | Sí | No | No | No |
| Ver y editar recuerdos de objetivo, empresa y cuenta con la fase activa (excepción a R-9, CA-37) | Sí | Sí | No | No, tampoco sin la fase |
| Ver en la auditoría las propuestas aplicadas que cambiaron la estrategia | Sí | No | No | No |
| Ver y editar recuerdos de ámbito persona | Solo los suyos | Solo los suyos | No | Solo los suyos |
| Aprobar propuestas | Solo las suyas, según permiso de la acción | Solo las suyas, según permiso de la acción | No | Solo las suyas, según permiso de su rol |
| Ratificar | Sí | No | No | No |
| Deshacer un cambio del agente (24 h) | Sí | No | No | No |

- **Herramientas con coste de proveedor (lista normativa de CA-29).** De lectura, hoy al momento: `research_account`, `competitor_reviews`, `clay_find_companies`, `clay_find_people`, `clay_enrich_account`, `apollo_find_companies`, `apollo_enrich_account`, `enrich_accounts_table`, `complete_account`, `find_key_people` y `find_icp_companies`. De escritura, hoy pendientes sin coste en la tarjeta: `start_account_report`, `start_icp_account_list`, `refresh_account_signals`, `create_battlecard_from_reviews`, `research_stakeholder`, `apollo_reveal_contacts` y `apollo_reveal_stakeholder`. Cuando existan herramientas del agente que usen Exa o FullEnrich (SDD 4a CA-32 y CA-33, enmienda del 2026-10-31), entran en esta lista. No entran `apollo_find_people` (gratuita), los borradores con IA (`draft_proposal`, `draft_followup`, `draft_artifact`) ni `linkedin_company_posts`, `linkedin_profile_posts` y `company_job_postings`, que retira SDD 1a CA-73 (1a U-0).
- **Privacidad:** el texto y el título de la conversación son solo de su dueño; el hallazgo compartido es solo el texto que la persona revisó; los recuerdos no copian fichas ni datos de contacto y guardan solo cargos y roles de las personas de una cuenta; el agente no lee calendario ni correo; ningún dato de clientes en pruebas ni ejemplos.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| Turno de conversación del agente | Claves propias primero y, si fallan antes de actuar, la siguiente (cadena actual de proveedores) | El modelo del agente actual; esfuerzo por decidir en el brief | No (conversación; PRD R-2) |
| Extracción de recuerdos | La misma cadena | Modelo más pequeño; por decidir en el brief | No |
| Tareas pesadas pedidas al agente (herramientas del §13) | Orquestador actual | El de cada servicio | Sí, en la tarjeta (CA-29) |

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero [Sugerencia] | Depende de |
|---|---|---|---|---|
| U-1 | Agente único con modos detectados, panel lateral, chat de Inicio, retirada de personajes y guardia de fase | CA-1 a CA-6 | `agent-modes.test.ts`, `agent-phase-guard.test.ts` | SDD 1a U-1 (fase por rol), SDD 1b U-8 (Inicio y menú) |
| U-2 | Conversaciones privadas, hallazgos compartidos, Consejo bloqueado y aislamiento por organización | CA-7 a CA-11 | `agent-conversations-privacy.test.ts`, `agent-findings.test.ts`, `org-isolation.test.ts` | U-1, SDD 1a U-2 (objetivos), SDD 4a U-1 y SDD 4b U-1 (`org-isolation.test.ts`, que este SDD amplía) |
| U-3 | Memoria con ámbito objetivo, automática y editable | CA-12 a CA-19, CA-37 | `agent-memory.test.ts` | U-1, U-2, SDD 1a U-2 y U-3 (objetivos y resultados clave), SDD 3 U-6 (fichas) |
| U-4 | Autonomía interna, propuestas y sus estados, aprobación, auditoría, deshacer, acciones externas, borradores, ejecutor y límites de datos personales | CA-20 a CA-33 | `agent-autonomy.test.ts`, `agent-undo.test.ts`, `agent-external-actions.test.ts`, `agent-mail-drafts.test.ts`, `agent-no-personal-data.test.ts`, `agent-cost-preview.test.ts`, `agent-proposals.test.ts`, `agent-executor.test.ts` | U-1, SDD 1a U-7 (ratificación, versiones y auditoría), SDD 1b U-5 y U-6 (tareas y puertas), SDD 4b U-2 y U-3 (registro de reuniones y borradores), SDD 4a U-8 (coste) |
| U-5 | Propuestas congeladas y ocultación al desactivar la fase, y otros roles con la fase activa | CA-34 a CA-36 | `agent-proposals.test.ts`, `agent-phase-guard.test.ts` | U-2, U-3, U-4 |

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- **Modos:** los flujos de `src/lib/bmad/workflows.ts` ya están agrupados por fase; el modo detectado puede ser un parámetro interno del turno que elige las instrucciones del flujo, y la elección de personaje desaparece de la entrada (`personaId` queda ignorado, CA-5). El modo «entrevista» se mantiene como hoy, con su medidor y sus herramientas actuales (`get_setup_status`, `update_positioning`, `create_icp`); adaptarlo a los bloques del SDD 2 es trabajo del SDD 5d.
- **Conversaciones:** la comprobación de pertenencia en `sendAgentMessage` filtra por organización; debe filtrar también por persona (CA-7).
- **Memoria:** el vínculo recuerdo-conversación (CA-12) y el ámbito objetivo son un cambio de modelo aditivo; las políticas actuales de borrado de recuerdos y conversaciones no deben usarse para retirar (CA-14). Hoy el aprendizaje exige 40 o más caracteres y no guarda recuerdos de cuenta en el chat; CA-12 los incluye. La pantalla actual de memoria (`src/routes/_authenticated/memory.tsx`) ya edita, fija y olvida; falta reactivar y mostrar los inactivos.
- **Costes:** la lista normativa de CA-29 está en el §10; para referencia, las herramientas que pasan a acción pendiente con el coste en la tarjeta (decisión de Fede, 2026-10-31: las de proveedor, no los borradores con IA) son, de lectura (hoy al momento): `research_account`, `competitor_reviews`, `clay_find_companies`, `clay_find_people`, `clay_enrich_account`, `apollo_find_companies`, `apollo_enrich_account`, `enrich_accounts_table`, `complete_account`, `find_key_people` y `find_icp_companies`. De escritura, hoy pendientes sin coste en la tarjeta: `start_account_report`, `start_icp_account_list`, `refresh_account_signals`, `create_battlecard_from_reviews`, `research_stakeholder`, `apollo_reveal_contacts` y `apollo_reveal_stakeholder`. `apollo_find_people` se describe como gratuita y no entra. Quedan fuera los borradores con IA (`draft_proposal`, `draft_followup`, `draft_artifact`).
- **Propuestas:** la organización ya se guarda (obligatoria); CA-31 añade los estados caducada y rechazada por cambio y el plazo de 7 días, y CA-23 y CA-31 exigen guardar quién aprobó. La acción pendiente creada desde el servidor para asistentes no tiene conversación (SDD 5c).
- **Deshacer:** `src/lib/setup-undo.ts` borra lo creado; no sirve tal cual para CA-24, que restaura sin borrar (PRD R-7). Las versiones (SDD 1a CA-52) solo existen para objetivos y decisiones; para los demás elementos se guarda una instantánea del estado anterior (§10).
- **Herramientas de estrategia:** crear las herramientas de propuesta de cambios de estrategia y adaptar la entrevista a los bloques del SDD 2 es trabajo del SDD 5d.
- **Filtro o instrucción:** CA-13 y CA-19 hoy son instrucciones al modelo (`memory.server.ts`, `SYSTEM`); solo el aviso y la edición son comprobables de forma determinista.
- **Lectura de la memoria (CA-18):** hoy `memoryBlock` traga el error y devuelve vacío sin avisar; el aviso es comportamiento nuevo.
- **Borrado en cascada:** `agent_pending_actions.conversation_id` es `on delete cascade` y `agent_conversations` tiene la política «own delete»; borrar una conversación puede perder propuestas auditadas, por lo que el vínculo recuerdo-conversación y las propuestas no deben borrarse en cascada (PRD R-7).
- **Rechazada por cambio (CA-31):** exige guardar la fecha de la propuesta y comparar con la de modificación del elemento; las acciones pendientes guardan hoy la herramienta y sus argumentos, sin foto del elemento.

## 14. Riesgos y dependencias
- Depende de los SDD 1a y 1b (fase por rol, ratificación, auditoría, tareas y puertas); si 1a o 1b no están activos, la guardia de cada fase manda.
- **Recuerdos fuera del extractor:** `decisionMemory` y los descubrimientos y reuniones guardan literalmente títulos de sugerencias que pueden llevar nombres (por ejemplo «Llamar al CFO de Acme»); CA-19 solo instruye al extractor y no hay detección automática de nombres (§5), por lo que esa vía queda sin cubrir.
- **Memoria automática y nombres:** el agente actual guarda hechos de cuentas con interlocutores; Fede decidió (2026-10-31) que los recuerdos solo nombren cargos y roles (CA-19). Que el agente evite nombres es una instrucción a un modelo: puede fallar; por eso se puede editar y desactivar (CA-14). Los recuerdos existentes con nombres no se migran: Fede lo decidió el 2026-10-31 y se corrigen a mano desde la lista de recuerdos.
- **Conversaciones privadas y memoria compartida:** el texto de la conversación es privado (CA-7), pero lo aprendido sobre empresa o cuenta queda compartido con el Owner y el Sales leader (CA-14) y lo usan las respuestas del agente a otras personas (CA-16). La persona lo ve avisado en el panel (CA-12).
- **Aprobación:** solo aprueba quien pidió la propuesta (CA-21); si no está disponible, la propuesta caduca a los 7 días (CA-31) y otra persona debe pedirla de nuevo.
- **Otros roles:** con la fase activa para ellos, el agente les da solo herramientas de su rol y recuerdos personales, y sus conversaciones solo generan recuerdos personales (CA-36); decisión de Fede del 2026-10-31.
- **Aprobado sin cuarta pasada:** Fede aprobó 5a, 5b y 5c con los riesgos declarados (2026-10-31). Los puntos sin verificar son: reglas de acceso en producción, recuerdos con nombres ya guardados, el coste real de cada herramienta y las vías de recuerdos de reuniones, sugerencias y descubrimientos (CA-37).
- **Herramientas de estrategia (SDD 5d):** hasta que 5d las traiga, CA-22 a CA-24 se prueban con un doble, como ya hace 1a CA-70; el SDD 5d sustituye ese doble (PRD §8); si 5d se retrasa, el deshacer de 24 horas y la auditoría de cambios del agente no tienen consumidor real.
- **Recuerdos visibles solo a Owner y Sales leader:** CA-37 cambia lo que ven hoy los demás miembros y el agente actual de los roles sin la fase (excepción a R-9, decisión de Fede).
- **Fase desactivada:** el agente actual sigue cargando todos los recuerdos activos de la organización (`memoryBlock`); CA-35 oculta solo los de ámbito objetivo y los hallazgos, y deja los de empresa, cuenta y persona aprendidos con la fase activa en uso por el agente actual de Owner y Sales leader (decisión de Fede, 2026-10-31); las conversaciones creadas con la fase activa siguen siendo suyas y visibles solo a su dueño.
- **Criterios con varias condiciones:** CA-1, CA-5, CA-8, CA-10, CA-12, CA-14, CA-20, CA-23, CA-24, CA-25, CA-26, CA-29, CA-31, CA-32, CA-33, CA-35, CA-36 y CA-37 describen una regla con sus condiciones; el brief puede dividir sus pruebas.
- **Agente ejecutor:** puede ejecutar tareas internas a petición (CA-33); no hay ejecución autónoma.
- Rotar claves de IA o de correo (salida de Lovable B) puede interrumpir el agente; se muestra el error con qué hacer (PRD R-8).
- Los cambios que el Owner deshace después de 24 horas no se pueden deshacer desde aquí (CA-24).
- El uso real del agente actual es **sin dato**.

## 15. Preguntas para Fede y para la revisión técnica
- Resuelto por Fede (2026-10-31, tras la primera pasada del gate de 5a): las herramientas de propuesta de cambios de estrategia van en el SDD 5d; los recuerdos de empresa y cuenta solo los ven Owner y Sales leader; llevan coste en la tarjeta las herramientas de proveedor y no los borradores con IA; los recuerdos con nombres ya existentes se dejan.
- Resuelto por Fede (2026-10-31): lo indicado en el §3 y, tras la tercera pasada del SDD 5 original: todas las herramientas con coste van con botón (CA-29); las conversaciones de otros roles solo generan recuerdos de ámbito persona (CA-36); al desactivar la fase el agente actual sigue usando los recuerdos de empresa y cuenta y se ocultan solo los de ámbito objetivo y los hallazgos (CA-35).
- Resuelto por Fede (2026-10-31, tras la segunda pasada de 5a): el modo entrevista se mantiene como hoy hasta 5d; los roles sin fase no aprenden recuerdos de empresa ni cuenta y CA-37 vale en Telegram; 5d sustituye el doble de CA-22 a CA-24 y de 1a CA-70.
- Resuelto: la restauración de elementos sin versiones usa la instantánea del estado anterior (§10).

## 16. Pendiente de verificar
- Uso real del agente → datos de producción.
- Si hay recuerdos con nombres de personas ya guardados (CA-19) → datos de producción (se dejan, decisión de Fede).
- `agent_pending_actions` no guarda quién aprobó (CA-23): verificado el 2026-10-31; es un cambio de modelo.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
**Primera pasada del gate (2026-10-31, sobre la v1).** Informe copiado sin editar. Los hallazgos de las tres pasadas del SDD 5 original que atañen a este SDD estaban aplicados en los criterios o declarados en el §14 y el §15.

**Veredicto:** Bloqueado

El 5a resuelve bien la mayoría de lo que se arrastraba del SDD 5. La cadena de deshacer está bien citada (1a CA-70 y CA-52). CA-31 define los estados de las propuestas, CA-34 y CA-35 recogen las decisiones de Fede y la matriz incluye retirar un hallazgo ajeno. Todas las citas a 1a, 1b, 2, 3, 4a y 4b existen y están en la unidad que se declara. Lo bloquean cuatro problemas.

**Bloqueantes**

1. **Los cambios de estrategia no se pueden probar porque no hay herramientas (CA-20, CA-22, CA-23, CA-24 y la entrevista de CA-2, frente al §5 L47).**
   - El §5 excluye herramientas nuevas: «se reutiliza el registro actual».
   - En `src/lib/agent/tools/*` no hay ninguna herramienta que proponga cambios sobre objetivos, resultados clave, iniciativas, públicos, canales, puertas o decisiones. Lo más parecido (`update_positioning`, `upsert_segment`, `create_icp`, `set_quota`) toca la configuración antigua.
   - Tampoco hay herramienta para leer o escribir los cuatro bloques del SDD 2. La entrevista solo tiene `get_setup_status`.
   - Consecuencia: CA-22, CA-23 y CA-24 no tienen nada que ejercitar, y la obligación de 1a CA-70 (condicional en 1a, «se prueba con un doble hasta el SDD 5») sigue sin ser verificable.
   - Cómo resolverlo: añadir en 5a las herramientas mínimas de propuesta sobre esas entidades y bloques, o que Fede asigne qué SDD las trae (¿el 5d?) y dejar CA-22 a CA-24 condicionales («DONDE exista…»), con esa dependencia declarada.

2. **La lista cerrada de herramientas con coste está incompleta (CA-29, §13 L175, §6 L51, PRD §6.1 L136 «Todas»).**
   - Falta `competitor_reviews` (`linkedin.ts`): es de lectura, se ejecuta al momento y «gasta saldo de Apify». 1a CA-75 la mantiene. Las otras tres de Apify sí desaparecen por 1a CA-73.
   - CA-29 solo trata las de lectura. Las de escritura con coste ya son acción pendiente, pero sin coste en la tarjeta: `start_account_report`, `start_icp_account_list` (Parallel), `refresh_account_signals` (Firecrawl), `create_battlecard_from_reviews` (Apify) y `research_stakeholder` (investigación con IA). Eso incumple 4a CA-14 («coste previo junto a la acción antes de ejecutarla», que incluye Parallel, Firecrawl y Apify).
   - CA-29 dice «coste de proveedor o de IA», pero la lista excluye las herramientas de IA que se ejecutan al momento: `draft_proposal`, `draft_followup` y `draft_artifact`. La prueba no puede decidir si llevan tarjeta.
   - Cómo resolverlo: que CA-29 diga «toda herramienta con coste de proveedor, de lectura o de escritura, muestra el coste en la tarjeta»; completar la lista del §13; y quitar «o de IA» o listar esas herramientas con decisión de Fede.

3. **Faltan guardias de fase, y eso contradice CA-6 y R-9 («agente actual sin cambios»).**
   - Cinco criterios no tienen «MIENTRAS la fase esté activa para mi rol» y cambian el agente actual:
     - CA-5: ignora el personaje, cuando CA-6 lo conserva.
     - CA-12: ámbito objetivo, vínculo con la conversación y aviso en el panel; además quita el umbral de 40 caracteres de `agent.server.ts:85`.
     - CA-20 y CA-26: `create_task` pasa a crearse directa. 1b CA-78 sí lleva guardia.
     - CA-29: las herramientas con coste pasan a pendientes.
   - CA-34 (no se pueden aprobar las propuestas congeladas) y CA-35 (se ocultan los recuerdos de objetivo) obligan a cambiar `decidePending` y `memoryBlock` del agente actual. CA-6 no las exceptúa.
   - Hueco: los recuerdos de ámbito objetivo se filtran a los roles que nunca tuvieron la fase. `memoryBlock` carga todos los activos que no son personales (`memory.server.ts:10-13`) y `memory.tsx:34` los lista. Solo CA-35 los oculta, y solo al desactivar.
   - CA-12 y CA-36 chocan: CA-12 extrae los cuatro ámbitos «cuando termina un turno», sin excepción, y CA-36 limita a los otros roles al ámbito persona. No se dice cuál manda.
   - Cómo resolverlo:
     - añadir la guardia a CA-5, CA-12, CA-20, CA-26 y CA-29;
     - escribir en CA-6 «salvo CA-34 y CA-35»;
     - un CA que oculte el ámbito objetivo a los roles sin la fase;
     - CA-12 con «salvo CA-36».

4. **Quién ve los recuerdos compartidos no cuadra entre la matriz, el §14 y el código.**
   - La matriz del §10 (L147) pone «No» para otros roles en ver recuerdos de objetivo, empresa y cuenta. El §14 (L183) dice que lo aprendido «queda compartido con el Owner y el Sales leader».
   - Hoy cualquier miembro los lee: política «read company/account or own» de `0042_memories.sql`, y la lista de `memory.tsx` muestra todos los activos. El agente actual de los otros roles (CA-6) también los usa.
   - Así, lo aprendido en la conversación privada de Fede llega a SDR o AE sin la fase, contra lo que se le avisa (CA-12). Con la fase activa, CA-36 solo limita el agente, no la pantalla de memoria.
   - Cómo resolverlo: que Fede decida el público de los recuerdos compartidos y convertirlo en CA (incluida la pantalla); si es solo Owner y Sales leader, declararlo como excepción a R-9.

**Cambios menores**

- **CA-6 frente a 1a CA-6.** 1a CA-6 obliga a «conservar y ocultar los datos creados» al desactivar, y CA-35 deja que el agente actual siga usando los recuerdos de empresa y cuenta. Es una decisión de Fede (PRD L138), pero la cabecera no declara que modifica 1a CA-6, como hizo el 4a con 1a CA-17. Tampoco se dice qué pasa con las conversaciones creadas con la fase activa (`agent.tsx:63` las lista).
- **Una acción con coste (CA-29), ¿es una «propuesta»?** Hay que decirlo para saber si caduca a los 7 días (CA-31), si se congela (CA-34) y dónde se ve (CA-32).
- **Ciclo de vida de las propuestas:**
  - CA-34 no dice si una propuesta congelada se puede descartar ni dónde se ve.
  - CA-31 no dice cómo se detecta «rechazada por cambio» en elementos sin versión (deals, cuentas). `agent_pending_actions` guarda `tool` y `args`, sin foto del elemento; falta en el §13.
  - CA-32 menciona un «historial» que el §9 no define.
- **CA-15, cadena de sustituciones.** Si A fue sustituido por B y B por C, reactivar A desactiva B (ya inactivo) y deja A y C activos a la vez.
- **CA-24 no dice cómo se deshace una creación** (¿archivar?). Lo señaló la tercera pasada y sigue abierto. Tampoco dice dónde deshace el Owner si la fase está desactivada para su propio rol (CA-35).
- **CA-20 frente a CA-27.** El borrador de correo no está en la lista de lo que se crea sin aprobación, así que por «todo lo demás» sería una propuesta. Hay que añadirlo («borradores de correo, CA-27»), como ya hace 5c CA-2.
- **CA-8 y CA-14** hacen visibles hallazgos y recuerdos al Sales leader aunque la fase solo esté activa para el Owner (1a CA-5 permite activarla por rol).
- **CA-33** no dice quién puede pedir la ejecución (¿el dueño de la tarea?), dónde deja el resultado ni si el agente puede marcar la tarea como Hecha.
- **CA-13** («texto literal de fichas, contacto, credenciales») solo se puede probar de forma determinista si es un filtro y no una instrucción al modelo. Hoy es una instrucción (`memory.server.ts`, `SYSTEM`). Conviene decirlo en el §13.
- **CA-18** es comportamiento nuevo: hoy `memoryBlock` traga el error y devuelve `""` sin avisar. El §13 no lo dice.
- **Criterios con varias obligaciones que el §14 no justifica:** CA-1, CA-8, CA-12 y CA-36.
- **§8:**
  - L110 remite los recuerdos de dos organizaciones a CA-10, pero es CA-16 (menor de la tercera pasada sin corregir).
  - Faltan casos para propuesta fallida y para deshacer con la fase desactivada.
- **§3 y §13:** `apollo_find_people` aparece como herramienta que gasta crédito, pero su descripción dice «Gratis» (`apollo.ts:18`).
- **§4:** «conversaciones por modo» no tiene CA que obligue a guardar el modo de cada conversación.
- **§9:** faltan la pantalla de deshacer del Owner (CA-24) y la lista de propuestas propias por estado (CA-32).
- **§10:** a la matriz le falta la fila «ver las propuestas aplicadas en la auditoría» (Owner, CA-32).
- **§13:** decir que el vínculo recuerdo-conversación no se borra en cascada. Hoy `agent_pending_actions.conversation_id` es `on delete cascade` y existe la política «own delete» en `agent_conversations`, lo que puede perder propuestas auditadas.
- **§16:** «Migraciones 0058 y 0059 sin aplicar → gate» ya está verificado (`src/lib/AGENTS.md`: «NOT VERIFIED, not applied anywhere»).
- **§14 L182:** si se migran los recuerdos que ya tienen nombres es decisión de Fede, no del gate.
- **Cabecera L12:** «1b CA-38, con CA-33» se puede leer como 1b CA-33 (dependencias de tareas); escribir «5a CA-33».
- **U-2:** amplía `org-isolation.test.ts` pero no declara la dependencia de 4a U-1 y 4b U-1. Solo lo menciona en el texto.
- **Cómo lo citan los otros:** 5b (§10, L106) usa 5a CA-36 para justificar que los otros roles no reciben el resumen ni los avisos, pero CA-36 no habla de eso. Es para el gate de 5b, o bien CA-36 debe decirlo.

**Preguntas para Fede**

1. Las herramientas del agente para proponer cambios sobre objetivos, resultados clave, iniciativas, puertas, decisiones y bloques de contexto, ¿van en 5a o en 5d? (bloqueante 1)
2. Los recuerdos de empresa y cuenta que salen de tu conversación privada, ¿los ven todos los miembros, como hoy, o solo tú y Flor? (bloqueante 4)
3. ¿También llevan botón con coste `competitor_reviews` y las herramientas de escritura que ya gastan crédito? ¿Y las de IA, como el borrador de propuesta o el de seguimiento? (bloqueante 2)
4. Los recuerdos que ya existen con nombres de personas, ¿se dejan o se revisan?

**Hechos de código verificados / no verificados**

Verificados:
- Hay 12 personajes. Las fases de los flujos son `analysis | plan | architecture | execution | retro` (`workflows.ts:4`).
- El modo es `chat` o `interview`, y la entrevista usa `get_setup_status`.
- Las herramientas de lectura se ejecutan al momento y las de escritura van a `agent_pending_actions` (`agent.server.ts`, `runWith`).
- La tabla de acciones pendientes tiene los estados pending, confirmed, cancelled y failed, `decided_at`, `org_id` obligatorio y `source` (desde 0011). No guarda quién aprobó.
- `decidePending` filtra por persona y organización, y ejecuta con los roles que tiene la persona al decidir.
- `sendAgentMessage` comprueba la conversación solo por organización. El título son los primeros 80 caracteres. La regla de acceso de 0007 aísla por persona.
- Memoria: ámbitos company, user y account, con `active` y `supersedes`. Cualquier miembro lee los que no son personales; edita quien lo creó o el Owner y el Sales leader; borra el Owner.
- Solo se aprende con 40 caracteres o más, y el chat no guarda recuerdos de cuenta.
- La pantalla de memoria edita, fija y «Olvida»; no permite reactivar ni muestra los inactivos.
- `setup-undo.ts`: cinco tablas, solo creaciones, y borra.
- Las 11 herramientas del §13 existen y son de lectura.
- Las migraciones 0058 y 0059 no están aplicadas, según `src/lib/AGENTS.md`.

Inexactos:
- `apollo_find_people` no gasta crédito según su descripción.
- La lista del §13 omite `competitor_reviews`.

No verificados:
- Si las reglas de acceso de 0007 y 0042 están aplicadas así en producción.
- Si hay recuerdos con nombres en la base de datos.
- El coste real de cada herramienta: me guío por las descripciones del código.

**Límites de la revisión**

- Solo he leído documentos y código local. No he consultado la base de datos de producción ni ejecutado pruebas.
- De 1a, 1b, 2, 3, 4a y 4b leí los CA citados, sus tablas de unidades y lo que dejaron a la serie 5. De 5b y 5c, solo cómo citan a 5a.
- No revisé el SDD de salida de Lovable C.
- El documento no contiene datos de clientes. Sus cifras (7 días, 24 horas, 40 y 80 caracteres) vienen del PRD §6.1 o del código.

**Respuesta del autor (v2, 2026-10-31).** El informe está copiado sin editar arriba. Decisiones de Fede que cierran sus cuatro preguntas: las herramientas de propuesta de cambios de estrategia van en el SDD 5d, así que CA-22 a CA-24 pasan a condicionales («DONDE exista…») y se prueban con un doble; los recuerdos de empresa y cuenta solo los ven Owner y Sales leader, con CA-37 como excepción declarada a R-9; llevan coste en la tarjeta las herramientas de proveedor (lectura y escritura, con la lista completa del §13) y no los borradores con IA; los recuerdos existentes con nombres se dejan.

Cambios: 1) CA-22 a CA-24 condicionales y §5, §13 y §14 declaran la dependencia de 5d. 2) CA-29 cubre toda herramienta de proveedor y la lista del §13 añade `competitor_reviews` y las cinco de escritura; `apollo_find_people` sale. 3) Guardias de fase en CA-5, CA-12, CA-20, CA-26 y CA-29; CA-6 exceptúa CA-34, CA-35 y CA-37; CA-12 remite a CA-36. 4) CA-37 oculta los recuerdos compartidos a los roles sin la fase. Menores: la cabecera declara que modifica 1a CA-6 y cita «5a CA-33»; CA-2 guarda el modo; CA-8 y CA-14 limitan a Owner y Sales leader con la fase activa; CA-15 cubre cadenas de sustituciones; CA-20 incluye los borradores de correo; CA-24 archiva lo creado y vale desde la auditoría; CA-31 define «rechazada por cambio» con la fecha de modificación; CA-32 sin «historial»; CA-33 fija quién la pide y dónde queda el resultado; CA-34 permite descartar; §3, §4, §8, §9, §10, §13, §14 y §16 corregidos y U-2 declara 4a U-1 y 4b U-1. No hay nueva pasada sobre esta v2.

**Segunda pasada del gate (2026-10-31, sobre la v2).** Informe copiado sin editar.

**Veredicto:** Bloqueado. Quedan dos bloqueantes y cada uno se arregla con una línea. La v2 aplica casi todo lo de la primera pasada. Lo que sí quedó bien, sin repetirlo abajo: las citas a otros SDD y sus unidades, CA-22 a CA-24 como condicionales sin dependencia hacia delante en el §12, y CA-6 con CA-37 frente a R-9, que el PRD §6.1 respalda.

**Bloqueantes**

1. **La lista cerrada de herramientas con coste sigue incompleta (CA-29 L94, §13 L182).**
   - Faltan `apollo_reveal_contacts` y `apollo_reveal_stakeholder` (`src/lib/agent/tools/apollo.ts:45-57`). Las dos son de escritura y su descripción dice que gastan créditos.
   - El 4a CA-14 nombra justo ese caso («revelar contactos con Apollo») y exige mostrar el coste antes de ejecutar. El PRD §6.1 dice «Todas las herramientas con coste».
   - Como CA-29 se limita a «las listadas en el §13», esas dos tarjetas saldrían sin coste. Con CA-25 piden aprobación, pero eso no basta para cumplir el 4a CA-14.
   - Es el mismo fallo que el bloqueante 2 de la primera pasada; el §17 L331 lo da por cerrado.
   - Cómo resolverlo: añadir las dos al grupo de escritura del §13. Mejor aún, sacar la lista del §13, que solo es [Sugerencia], y ponerla en el §10 o en el propio CA-29.

2. **Los recuerdos de ámbito objetivo siguen llegando a Owner o Sales leader cuando su rol no tiene la fase (CA-35 L102, CA-37 L82).**
   - CA-37 solo se los oculta a los demás roles. CA-35 solo los oculta cuando se desactiva la fase.
   - El 1a CA-5 permite activar la fase por rol. Si el Owner la activa solo para sí, el Sales leader, que nunca la tuvo, vería en la pantalla actual y en su agente actual los recuerdos de ámbito objetivo. El motivo es que `memoryBlock` carga todos los recuerdos activos que no son personales (`memory.server.ts:10-13`) y la regla de lectura de `0042_memories.sql` deja ver todo lo que no es de ámbito persona. Eso incumple R-9.
   - El bloqueante 3 de la primera pasada pedía «un CA que oculte el ámbito objetivo a los roles sin la fase», y solo se resolvió en parte.
   - Cómo resolverlo: que CA-35 diga «MIENTRAS la fase no esté activa para un rol (nunca activada o desactivada), ocultar a ese rol los hallazgos y los recuerdos de ámbito objetivo».

**Cambios menores**

- **La cabecera (L12) dice que el SDD «cumple» el deshacer de 24 horas del 1a CA-70, pero no es así.** CA-24 sigue condicional y se prueba con un doble, igual que en el 1a. La obligación pasa al SDD 5d sin que nada la recoja: ni la fila del 5d en el PRD §8 ni el §14 dicen que el 5d sustituye el doble de 5a CA-22 a CA-24 y del 1a CA-70. Hay que decirlo en los dos sitios, o quitar «cumple».
- **Con CA-23 condicional, ningún CA obliga a guardar quién aprobó.** El §13 L183 dice que CA-31 lo exige, pero CA-31 (L96) no lo menciona.
  - El 1a CA-68 pide registrar si un cambio en tareas lo hizo una persona o el agente, y `update_task` y `complete_task` ya existen hoy. Sin CA-23, eso queda sin cubrir en 5a.
  - Cómo resolverlo: que CA-31 guarde quién decide y cuándo, y que CA-23 cubra todo cambio aplicado desde una propuesta sobre los elementos del 1a CA-68, no solo las herramientas del 5d.
- **El §13 se contradice sobre la entrevista.**
  - L179 dice que, con la fase activa, la entrevista usa los bloques del SDD 2 (CA-2). L185 dice que adaptarla es trabajo del SDD 5d.
  - Si manda L185, la dependencia de U-1 con «SDD 2 U-2» (§12 L172) sobra. Además, la entrevista seguiría proponiendo `update_positioning` y `create_icp`, que tocan la configuración antigua.
  - Hay que decidir qué hace el modo entrevista en 5a mientras no exista el 5d.
- **El ciclo de vida de una acción con coste (CA-29) está incompleto.**
  - CA-29 hereda los estados de CA-31, pero CA-32 (dónde se ve) y CA-34 (congelada) hablan solo de «propuestas».
  - «Rechazada por cambio» no tiene sentido para una lectura.
  - No se dice adónde va el resultado de una lectura con coste que se ejecuta al pulsar: ¿a la tarjeta, o vuelve al agente?
- **CA-31: «anteriores a la activación» es ambiguo.** No queda claro qué pasa con las acciones pendientes creadas por el agente actual mientras la fase estuvo desactivada, una vez se reactiva.
- **CA-33 frente a CA-29.** Si una tarea con el agente como ejecutor necesita una herramienta con coste, no se dice si pasa por la tarjeta de coste.
- **CA-16: «cuando la conversación trata ese objetivo» no se puede probar.** Tampoco hay un mecanismo que ligue una conversación a un objetivo, y CA-12 lo necesita para saber a qué objetivo asignar los recuerdos de ese ámbito. Hay que definir el vínculo, por ejemplo una conversación abierta desde el objetivo o un objetivo elegido.
- **A CA-37 le falta concretar.**
  - Dice «en el agente» sin aclarar si incluye Telegram, que usa el mismo `runAgent`/`memoryBlock` con el cliente con privilegios, así que la regla de la base de datos no basta. El 5c CA-5 dice «sin cambios» para la fase nunca activa, y eso choca si Telegram cuenta como «el agente».
  - Tampoco dice si el agente actual de los demás roles sigue aprendiendo recuerdos de empresa que luego su autor no ve.
- **La cabecera (L12) y el §14 (L199) dicen que, con la fase desactivada, el agente actual sigue usando los recuerdos de empresa y cuenta.** Para los roles que no son Owner ni Sales leader, CA-37 lo impide. Hay que precisar «para Owner y Sales leader».
- **CA-19 solo instruye al extractor, pero hay recuerdos que no pasan por él.** `decisionMemory` (`memory.ts:76`) y `discoveries.functions.ts:39` guardan literalmente títulos de sugerencias, como «Llamar al CFO de Acme», que la prueba de `memory.test.ts:37` usa como ejemplo. Por esa vía pueden entrar nombres. Hay que declararlo en el §14 o extender la regla.
- **Pregunta del §15 sobre CA-24.** El 1a CA-68 registra quién, qué y cuándo, pero no el valor anterior. Para restaurar iniciativas, públicos, canales y puertas, 5a debe guardar una foto del estado anterior al aplicar la propuesta. Falta como «concepto nuevo» en el §10.
- **El §14 (L200) no lista todos los CA con varias obligaciones.** Faltan CA-5, CA-10, CA-20, CA-26, CA-29 y CA-33.
- **A la cabecera (L5) le faltan 4a U-1 y 4b U-1**, que U-2 sí declara.
- **El PRD R-9 (§6.2) sigue diciendo «la única excepción es la retirada de LinkedIn»**, cuando el §6.1 ya añade la de los recuerdos compartidos. Es para el PRD, no para 5a.
- **La frase del §13 L182 está rota:** «…son. De lectura…».
- **Matriz del §10 (L153):** falta «con la fase activa» para Owner y Sales leader, como dice CA-14.
- **Cómo lo citan los otros SDD:**
  - El 5c CA-2 se apoya en «5a CA-21 a CA-24» para la auditoría y el deshacer del servidor. CA-22 a CA-24 ahora solo aplican «DONDE el agente tenga herramientas» del 5d, así que no cubren lo que escribe el servidor.
  - El 5c §10 y el 5b (§10 L106, §14 L139) siguen citando 5a CA-36 para cosas que CA-36 no dice. Es para el gate del 5b y del 5c, o bien CA-36 debe ampliarse.

**Preguntas para Fede**

1. Mientras no exista el 5d, ¿el modo entrevista sigue proponiendo cambios en la configuración antigua o se desactiva con la fase activa?
2. Los roles sin la fase, ¿siguen aprendiendo recuerdos de empresa y cuenta con el agente actual aunque luego no los vean (CA-37)? ¿Y la regla de CA-37 vale también en Telegram?
3. ¿Quién recoge en el SDD 5d la obligación de sustituir el doble de CA-22 a CA-24 y del 1a CA-70?

**Hechos de código verificados / no verificados**

Verificados:
- Las fases de los flujos en `workflows.ts:4` y los 12 personajes.
- `sendAgentMessage` comprueba la conversación solo por organización (`agent.functions.ts:36`); el título son los primeros 80 caracteres.
- `decidePending` filtra por persona y organización.
- `agent_pending_actions`: estados pending, confirmed, cancelled y failed; `decided_at`; borrado en cascada con la conversación; sin columna de quién aprueba (0007).
- La política «own delete» de las conversaciones.
- El umbral de 40 caracteres (`agent.server.ts:85`) y que `memoryBlock` traga el error.
- Las reglas de acceso de 0042 y los ámbitos company, user y account, con `supersedes`.
- Las 16 herramientas del §13 existen y su tipo (lectura o escritura) coincide.
- `apollo_find_people` es «Gratis».
- Las dos de revelar de Apollo gastan créditos y no están en la lista.
- `research_stakeholder` usa búsqueda web y Apify.
- Las tablas de dominio tienen `updated_at`, así que «rechazada por cambio» es viable.
- Hay recuerdos que no pasan por el extractor (`decisionMemory`, descubrimientos y reuniones).
- No hay herramientas de estrategia ni de bloques de contexto.

No verificados:
- Si las reglas de acceso de 0007 y 0042 están aplicadas así en producción.
- Si hay recuerdos con nombres guardados.
- El coste real de cada herramienta: me guío por las descripciones del código.

**Límites de la revisión**

- Solo he leído documentos y código local: sin base de datos ni pruebas ejecutadas.
- De los SDD aprobados leí los CA citados y sus tablas de unidades. De 5b y 5c, solo cómo citan a 5a.
- No he podido comprobar que el informe del §17 esté copiado sin editar porque no tengo el original.
- Sin datos de clientes. Las cifras (7 días, 24 horas, 40 y 80 caracteres) vienen del PRD §6.1 o del código.

**Respuesta del autor (v3, 2026-10-31).** El informe está copiado sin editar arriba. Decisiones de Fede: el modo entrevista se mantiene como hoy hasta que 5d lo adapte; los roles sin la fase no aprenden recuerdos de empresa ni cuenta y CA-37 vale en Telegram; 5d sustituye el doble de CA-22 a CA-24 y de 1a CA-70 (anotado en el PRD).

Cambios: 1) CA-29 y el §13 incluyen `apollo_reveal_contacts` y `apollo_reveal_stakeholder`, definen el resultado de una lectura y excluyen «rechazada por cambio» para lecturas. 2) CA-35 oculta hallazgos y recuerdos de objetivo a los roles sin la fase (nunca activada o desactivada), también en Telegram; CA-37 limita lo que esos roles aprenden. Menores: la cabecera «prepara» el deshacer y declara que 5d sustituye el doble; CA-23 deja de ser condicional y audita todo cambio aplicado desde una propuesta; CA-31 guarda quién decide y cuándo y aclara las acciones del agente actual; CA-33 pasa las herramientas con coste por CA-29; CA-16 define el objetivo ligado a una conversación; el §13 ya no contradice la entrevista; el §10 añade la instantánea del estado anterior y la precisión de la fase; el §14 declara los recuerdos fuera del extractor y todos los criterios con varias condiciones; la cabecera declara 4a U-1 y 4b U-1; el PRD R-9 recoge la excepción. No hay nueva pasada sobre esta v3.

**Tercera pasada del gate (2026-10-31, sobre la v3).** Informe copiado sin editar.

**Veredicto:** Bloqueado. Quedan dos bloqueantes y cada uno se arregla con una línea. La v3 aplica casi todo lo de la segunda pasada y lo he comprobado en el texto, no en la respuesta del autor. Cuatro cosas están ya bien:
- CA-29 y la lista del §13 incluyen las dos herramientas de revelar de Apollo.
- CA-35 cubre ahora los roles que nunca tuvieron la fase.
- CA-23 audita todo cambio aplicado desde una propuesta, y CA-31 guarda quién decide.
- CA-16 define el objetivo ligado a la conversación, y la cabecera, el PRD R-9 y el PRD §8 (fila 5d) dicen que el 5d sustituye el doble.

**Bloqueantes**

1. **Hay criterios que cambian el agente actual sin la fase, sin guardia y fuera de las excepciones de CA-6 y del PRD R-9.**
   - CA-6 (L64) dice «sin cambios, salvo CA-34, CA-35 y CA-37». El PRD R-9 (L162) es una lista cerrada («las únicas excepciones…»). Una prueba de CA-6 choca con estos cuatro criterios, que no tienen guardia de fase:
     - CA-18 (L80): obliga a avisar si falla la memoria. Hoy `memoryBlock` traga el error (`memory.server.ts:26-29`), así que cambiaría el agente actual.
     - CA-19 (L81): instruye al extractor común a guardar solo cargos (hoy su texto pide «stakeholders», `memory.server.ts:75`). Además añade un aviso a la pantalla de memoria actual.
     - CA-13 (L75): cambia esa misma instrucción.
     - CA-23 (L88): obliga a auditar con aprobador «cada cambio aplicado desde una propuesta». Eso incluye las acciones del agente actual, que CA-31 (L96) manda dejar «con el comportamiento anterior».
   - CA-37 (L82) también hace que los roles sin la fase solo aprendan recuerdos de ámbito persona. El PRD R-9 y el §6.1 (L136, L142) solo recogen la parte de visibilidad: «solo los ven Owner y Sales leader». La parte de aprendizaje no está en ninguna excepción.
   - Cómo resolverlo: añadir «MIENTRAS la fase esté activa para mi rol» a CA-13, CA-18, CA-19 y CA-23, o meterlos en la excepción de CA-6 con la decisión de Fede. Además, ampliar en el PRD R-9 y el §6.1 la excepción de CA-37 al aprendizaje.

2. **5a CA-35 y CA-37 contradicen al 5c CA-13 sobre Telegram.**
   - 5a CA-35 (L102) oculta en Telegram los hallazgos y los recuerdos de ámbito objetivo a los roles que nunca tuvieron la fase. 5a CA-37 oculta en Telegram los recuerdos de empresa y cuenta a los demás roles, aunque no tengan la fase.
   - El 5c CA-13 (L65) dice: «MIENTRAS la fase no haya estado nunca activa para mi rol, … mantener sin cambios Telegram, salvo CA-3».
   - Telegram usa el mismo `runAgent` y `memoryBlock` (`src/routes/api/public/telegram/webhook.ts`), así que los dos criterios no pueden cumplirse a la vez.
   - Además, el 5c CA-12 (L64) resume 5a CA-35 como «vuelta al comportamiento actual» y omite la ocultación.
   - Cómo resolverlo, en el 5c: que CA-13 diga «salvo CA-3 y SDD 5a CA-35 y CA-37», y que CA-12 cite también la ocultación. Lo señalo aquí porque la contradicción la introduce la v3 del 5a.

**Cambios menores**

- **La cabecera (L12) y el §8 (L131) describen mal CA-37.** Dicen que CA-37 oculta los recuerdos compartidos «a los roles sin la fase». En realidad los oculta a los roles distintos de Owner y Sales leader, tengan o no la fase; un Owner o Sales leader sin la fase sí ve los de empresa y cuenta. La cabecera también dice que «el agente actual sigue usando los recuerdos de empresa y cuenta» sin añadir «de Owner y Sales leader»; el §14 (L200) ya lo precisa. Este menor viene de la segunda pasada.
- **CA-37 solo limita lo aprendido «de sus conversaciones».** Hay otras tres vías que guardan recuerdos de empresa o cuenta con cualquier rol:
  - las reuniones (`memory.functions.ts:18`, `learnFrom` con cuenta);
  - las sugerencias decididas, también desde Telegram (`agent.functions.ts:169` y `:187`, `rememberDecision`);
  - los descubrimientos (`discoveries.functions.ts:39`).

  Así, un SDR genera recuerdos que luego no puede ver. Esto contradice la decisión del §15 (L210): «los roles sin fase no aprenden recuerdos de empresa ni cuenta». Hay que extender CA-37 a esas vías o declararlas en el §14.
- **CA-12 (L74) incluye el ámbito cuenta, pero nada define cómo sabe una conversación a qué cuenta se refiere.** CA-16 sí lo define para el objetivo. Hoy el chat llama a `learnFrom` sin `accountId` y el ámbito cuenta se descarta (`memory.server.ts:90-91`). Además, el aviso de CA-12 («queda en la memoria compartida») es falso para los otros roles, que solo guardan recuerdos de ámbito persona.
- **El ciclo de vida de las acciones con coste sigue incompleto.** Este menor viene de la segunda pasada y la v3 lo resuelve solo en parte:
  - CA-29 hereda los estados de CA-31, pero CA-32 (dónde se ve) y CA-34 (congelación) siguen hablando solo de «propuestas».
  - El 5c CA-14 sí distingue «propuesta o acción con coste».
  - Falta decir si una acción con coste se congela al desactivar la fase.
- **La lista cerrada de CA-29 sigue en el §13, que es [Sugerencia].** El 5c CA-10 la cita igual. Conviene moverla a un sitio con fuerza normativa.
  - Tres herramientas de lectura que gastan saldo de Apify (`linkedin_company_posts`, `linkedin_profile_posts`, `company_job_postings`) no entran en la lista solo porque el 1a CA-73 las retira. Falta decirlo y declarar la dependencia de 1a U-0.
- **CA-20 y el §6 no nombran qué herramientas de escritura actuales pasan a creación directa como «borradores de documentos».** No queda claro si son `draft_artifact`, `drive_save_document` o `prepare_meeting_brief`. El 5c §6 sí nombra `draft_artifact`.
- **CA-32 (L97) limita la auditoría del Owner a las propuestas «que cambiaron la estrategia (CA-23)».** Pero CA-23 audita ahora todos los elementos del 1a CA-68, tareas incluidas. Lo mismo pasa en la matriz (L154).
- **El §14 (L201) no lista todos los criterios con varias obligaciones,** aunque el §17 lo da por hecho («todos»). Faltan CA-35 y CA-37, como mínimo, y también CA-23, CA-25 y CA-32.
- **El §15 (L211), el §16 (L216) y el §13 (L184, «[Por verificar con el gate]») siguen preguntando cómo restaurar los elementos sin versiones.** El §10 ya añade la instantánea del estado anterior, así que esas tres preguntas se pueden cerrar.
- **Matriz del §10:**
  - a la fila «Compartir y ver hallazgos» le falta «con la fase activa» (CA-8);
  - no dice qué ven Owner y Sales leader sin la fase: recuerdos de empresa y cuenta sí, de objetivo no (CA-35 y CA-37).
- **CA-16:** no dice qué pasa con los recuerdos ya guardados si la persona cambia el objetivo de una conversación a mitad, y el §8 no recoge el caso de una conversación sin objetivo.
- **Fuera del 5a:**
  - El PRD §8 (L215) sigue diciendo que el 5a depende del SDD 2; el 5a ya no.
  - El 5c CA-2 se apoya en «5a CA-21 a CA-24» para el deshacer de 24 horas. Pero 5a CA-24 solo cubre cambios «desde una propuesta del agente» con las herramientas del 5d, no lo que escribe el servidor. Esto viene de la segunda pasada y sigue igual.

**Citas de 5b y 5c a 5a, comprobadas**

Existen y dicen lo que se les atribuye:
- 5b: CA-1 (cita 5a CA-24), CA-15 (cita 5a CA-14, CA-16 y CA-28) y CA-16 (cita 5a CA-21, CA-29 y CA-31).
- 5c: CA-2 (cita 5a CA-20, CA-26, CA-27 y CA-31), CA-4 (5a CA-27 y CA-28), CA-7 (5a CA-21, CA-31 y CA-10), CA-10 (5a CA-29 y §13), CA-12 (5a CA-34), la pantalla del §9 (5a CA-32) y la fila de la matriz (5a CA-36).

Fallan dos, ya descritas arriba: el 5c CA-13 frente a 5a CA-35 y CA-37 (bloqueante 2) y el deshacer del 5c CA-2.

**Preguntas para Fede**

1. CA-18 (avisar si falla la memoria) y CA-19 (recuerdos solo con cargos, sin nombres), ¿aplican también al agente actual sin la fase? Si es así, son nuevas excepciones al R-9.
2. «Los roles sin la fase no aprenden recuerdos de empresa ni cuenta», ¿vale también para las reuniones, las sugerencias decididas y los descubrimientos, o solo para el chat?
3. Al desactivar la fase, una acción con coste que estaba pendiente, ¿se congela como las propuestas o vuelve al comportamiento actual?

**Hechos de código verificados / no verificados**

Verificados:
- `memoryBlock` carga todos los recuerdos activos que no son personales y traga el error (`memory.server.ts:10-30`).
- El umbral de 40 caracteres (`agent.server.ts:85`) y el chat aprende sin cuenta.
- Telegram usa `runAgent`.
- Reglas de acceso de `0042_memories.sql`: lee todo lo que no es personal cualquier miembro; editan el autor, el Owner y el Sales leader; borran el autor de un recuerdo personal y el Owner.
- `agent_pending_actions` (0007): cuatro estados, `decided_at`, borrado en cascada con la conversación, sin columna de quién aprueba; 0011 añade `source`.
- `sendAgentMessage` comprueba la conversación solo por organización (L36).
- Las 18 herramientas del §13 existen; `apollo_find_people` es «Gratis»; las tres de LinkedIn que gastan saldo de Apify son de lectura.
- Hay vías que guardan recuerdos sin pasar por el extractor (reuniones, sugerencias y descubrimientos).
- `setup-undo.ts` borra lo creado.
- El servidor para asistentes (`src/lib/mcp`) no expone recuerdos.
- Todas las citas a 1a (CA-3, 5, 6, 51, 52, 68, 70), 1b (CA-38, 64, 66, 78, 84), 4a (CA-14, 15) y 4b (CA-7, 9 a 11) existen, y su unidad está declarada directa o indirectamente.

No verificados:
- Si las reglas de acceso están aplicadas así en producción.
- Si hay recuerdos con nombres guardados.
- El coste real de cada herramienta.

**Límites de la revisión**

- Solo he leído documentos y código local: sin base de datos y sin ejecutar pruebas.
- De los SDD aprobados leí los criterios citados, sus tablas de unidades y lo que dejan a la serie 5. De 5b y 5c, solo sus citas al 5a.
- No he comparado el §17 con los informes originales. Del SDD 5 archivado solo he comprobado que existe.
- El documento no tiene datos de clientes. Las cifras que usa (7 días, 24 horas, 40 y 80 caracteres) vienen del PRD §6.1 o del código.

**Respuesta del autor (v4, 2026-10-31).** El informe está copiado sin editar arriba. Fede aprobó el SDD con los riesgos declarados y sin cuarta pasada, y aceptó mis recomendaciones: CA-18 y CA-19 llevan guardia de fase; CA-37 se extiende a reuniones, sugerencias decididas y descubrimientos; las acciones con coste pendientes se congelan al desactivar la fase.

Cambios: 1) Guardia de fase en CA-13, CA-18, CA-19 y CA-23; la excepción de R-9 de CA-37 incluye el aprendizaje (PRD actualizado). 2) CA-35, CA-37 y la cabecera describen bien a quién se oculta qué; el 5c CA-13 se alinea. Menores: lista de herramientas con coste movida al §10 (normativa) con la dependencia de 1a U-0; CA-12 avisa solo a Owner y Sales leader y define la cuenta ligada; CA-16 cubre el cambio de objetivo y la conversación sin objetivo; CA-32 y CA-34 incluyen las acciones con coste; matriz del §10 precisada; §6 nombra `create_task` y `draft_artifact`; §14 con todos los criterios de varias condiciones y el riesgo de aprobar sin cuarta pasada; preguntas de restauración cerradas con la instantánea del §10.

## 18. Delta de implementación (lo rellena el agente al entregar)
(sin rellenar)
