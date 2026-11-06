# SDD-20261030-gtm-control-tower-4b-personal-tools-assistants · [Feature] Herramientas personales: calendario, correo y notas de llamadas (fase 4b)

**Tipo:** Feature · **Prioridad propuesta:** Media
**Estado:** Aprobado por Fede el 2026-10-31 (v8, tras siete pasadas del gate; sin una octava pasada sobre esta versión; con los riesgos declarados del §14), con enmienda del 2026-10-31 que fija Granola como herramienta de transcripciones (sin cambios en los criterios, sin pasada del gate) · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-10-30
**PRD:** `docs/prd/PRD-20261030-gtm-control-tower.md` · **Depende de:** SDD 4a (U-1: estado y auditoría de conexiones), SDD 1a (roles, Consejo y auditoría), SDD 1b (tareas con fecha: U-5), SDD 3 (ficha de conversación: U-4 y U-6) y los SDD de salida de Lovable A y B para construir · **Coordinar con:** `SDD-20261025-drive-per-company-account` (decidió una única cuenta de empresa para Drive), `SDD-20261025-connections-bring-your-own-account` (una cuenta por proveedor y organización) y `SDD-20261029-lovable-exit-b-servicios-y-corte` (CA-12 mueve Drive a clave propia)

> Un SDD dice cómo se verifica que está bien hecho. Cada criterio de aceptación (CA-n) debe poder tener una prueba automática que lo nombre.
> Los criterios no nombran tecnología; lo técnico va en el §13 como [Sugerencia — la revisión del gate las valida].
> La numeración de criterios se conserva de la versión anterior; los criterios de avisos y servidor para asistentes (CA-16 a CA-24) pasan al SDD 5 y no se reutilizan. Los criterios nuevos (CA-26 en adelante) se añaden al final de su historia, sin reordenar: CA-26, CA-27 y CA-28 van tras CA-4 (H-1), CA-29 a CA-36 y CA-39 tras CA-8 (H-2), CA-37 tras CA-15 (H-4) y CA-38 tras CA-28 (H-1). No hay H-5 ni H-6 ni U-5 ni U-6 (pasaron al SDD 5).
> Las reglas transversales del PRD (§6.2, R-1 a R-10) aplican a todo este SDD. «Organización» es la empresa que usa Nokko; «cuenta» es una empresa prospecto o cliente.

## 1. Resumen
Da a cada persona herramientas propias: **calendario** (las tareas con fecha como eventos y las reuniones ligadas a cuentas), **correo** (solo crear borradores, nunca enviar) y **notas de llamadas** (importación a la ficha, sin nombres). Este SDD construye el cliente de autorización de Google por persona, que hoy no existe: una conexión por persona y organización con dos capacidades, calendario y correo, que se activan y desconectan por separado. Podrán reutilizarlo después Drive por empresa y el SDD de salida B (decisión de Fede, 2026-10-30). Los avisos críticos y el servidor para asistentes pasan al SDD 5.

## 2. Problema y para quién
Las tareas no aparecen en el calendario de quien las ejecuta, no hay forma de preparar un seguimiento en el correo sin salir de Nokko y las notas de las llamadas no llegan a las fichas. Para Fede (Owner) y Flor (Sales leader).

## 3. Evidencia y por qué ahora
- **Código (repo de Nokko, solo lectura, 2026-10-30):**
  - **Google Calendar y Gmail no existen** (figuran como «todavía no» en la pantalla de integraciones). Drive va por la pasarela de Lovable, sin autorización propia de la persona, y la autorización de Google propia está pendiente de decisión («Google OAuth and per-company keys wait for a decision», `src/lib/connections.functions.ts`): es una decisión, no solo trabajo.
  - Cada organización tiene una conexión por proveedor, gestionada por el Owner (`src/lib/connections-core.ts`, `connections-bring-your-own-account`); no existe un modelo de conexión por persona.
  - Las reuniones y sus notas ya existen en la tabla `meetings` (`call_notes`, con cinco campos, que pide el detector `meeting-no-notes`); la ficha de conversación de tres campos del SDD 3 convive con ellas y no las sustituye.
- **Entrevista con Fede (2026-10-29/30):** calendario y correo personales, correo solo borradores, espejo de tareas en el calendario y notas de llamadas sin nombres (PRD §6.1, filas añadidas el 2026-10-30).
- Uso real: **sin dato** [Por verificar].

## 4. Resultado buscado
- Cada persona ve sus tareas con fecha en su calendario y puede preparar seguimientos como borradores (G-6 del PRD). Medición: personas con calendario o correo conectado. Línea base: sin dato.
- Ninguna acción hacia terceros sin aprobación humana (G-10).

## 5. Alcance
**Incluye:** H-1 a H-4 y H-7. H-3 solo da la conexión y las operaciones permitidas: no tiene consumidor hasta el SDD 5, que redacta los borradores.
**No incluye:**
- Fuentes de datos de resultados clave, Stripe, producto, Drive, Sales Navigator y proveedores (SDD 4a).
- El agente, el chat, el check-in semanal, los avisos críticos y el servidor para asistentes (SDD 5, por decisión de Fede del 2026-10-30).
- Envío de correos o invitaciones a terceros; publicación de contenido.
- Conectores automáticos de herramientas de transcripción: la herramienta es Granola (decisión de Fede, 2026-10-31) y su exportación entra por la importación manual de CA-13 a CA-15; el conector automático queda para un SDD posterior.
- Detección automática de nombres en texto libre.
- Sincronización con herramientas externas de tareas, salvo el espejo de solo salida de CA-5 (PRD §5).
- Leer los correos de la persona; varias cuentas de Google por persona y organización.

## 6. Cambios de comportamiento (delta)
**Añadido:** conexión personal de Google (calendario y correo); eventos de tareas; reuniones ligadas a cuentas; borradores de correo; importación de notas de llamadas.
**Modificado:** nada de lo existente.
**Eliminado:** nada.

## 7. Historias y criterios de aceptación
Cada CA cita el objetivo G-n del PRD que cubre y el archivo de prueba (ruta por decidir en la implementación [Sugerencia]).

### H-1: Como persona de Nokko, quiero conectar mi cuenta de Google solo para mí.
- **CA-1** El sistema DEBE permitir a cada persona con rol Owner o Sales leader conectar su propio usuario de Google con una autorización limitada a lo que este SDD necesita, como una conexión por persona y organización con dos capacidades, calendario y correo, que se activan por separado, y DEBE asociarla a una persona y a una organización. · cubre G-6, G-10 · prueba: `google-connection.test.ts`
- **CA-38** El sistema DEBE impedir que otra persona use la conexión de Google de una persona, DEBE denegarla a los demás roles y al Consejo, y DEBE mostrar en una pantalla de conexiones personales, separada de las de la organización, el estado y la fecha de cada capacidad; como única excepción, el Owner DEBE ver en las conexiones de la organización qué personas tienen autorizaciones de Google y qué capacidades (sin credenciales) y poder revocarlas. · cubre G-6, G-10 · prueba: `google-connection.test.ts`
- **CA-2** El sistema DEBE guardar la autorización de cada persona cifrada, DEBE devolver al navegador solo su estado y DEBE abstenerse de escribirla en registros o en la auditoría. · cubre G-10 · prueba: `google-connection.test.ts`
- **CA-3** CUANDO una persona desconecta una capacidad, el sistema DEBE dejar de usarla al instante sin borrar reuniones ni fichas, y CUANDO no queda ninguna capacidad activa, DEBE revocar la autorización en el proveedor y dejar inutilizables las credenciales guardadas; SI la autorización ya no es válida, ENTONCES DEBE dejar la conexión en Error sin fallar. · cubre G-10 · prueba: `google-connection.test.ts`
- **CA-4** El sistema DEBE registrar en la auditoría (SDD 1a, CA-68) cada conexión y desconexión personal, con quién y cuándo. · cubre G-10 · prueba: `google-connection.test.ts`
- **CA-26** CUANDO una persona deja la organización o pierde el rol que permite la conexión, el sistema DEBE revocar la autorización en el proveedor, dejar inutilizables sus credenciales guardadas (son secretos, no datos de negocio) y registrarlo en la auditoría; SI la autorización ya no es válida, ENTONCES DEBE dejar la conexión en Error sin fallar. · cubre G-10 · prueba: `google-connection.test.ts`
- **CA-27** SI el proveedor revoca la autorización o esta caduca, ENTONCES el sistema DEBE marcar la conexión de esa persona y sus capacidades activas como Error y DEBE avisarla en pantalla con qué pasó y qué hacer (volver a conectar). · cubre G-6, G-10 · prueba: `google-connection.test.ts`

- **CA-28** El sistema DEBE separar las conexiones por organización y por persona: una organización NO DEBE ver ni usar las de otra, una persona que pertenece a dos organizaciones DEBE tener una conexión independiente en cada una, y desconectar o revocar en una NO DEBE borrar las credenciales guardadas de la otra (PRD R-10). SI una persona intenta conectar otro usuario de Google mientras tiene uno conectado en esa organización, ENTONCES el sistema DEBE pedirle que desconecte primero el anterior. · cubre G-10 · prueba: `org-isolation.test.ts`

### H-2: Como persona de Nokko, quiero mis tareas en mi calendario y mis reuniones ligadas a cuentas.
- **CA-5** DONDE la capacidad de calendario esté conectada, el sistema DEBE crear un evento de día completo por cada tarea (no subtarea) con fecha límite y en estado distinto de Hecha asignada a esa persona (SDD 1b, CA-31), también si la fecha ya venció, en su calendario principal, con solo el título de la tarea, su fecha y un enlace a ella, y sin notas ni invitados; DEBE marcar cada evento que crea con una marca propia (CA-31). · cubre G-6 · prueba: `calendar.test.ts`
- **CA-6** El sistema DEBE abstenerse de añadir invitados a los eventos que crea. · cubre G-10 · prueba: `calendar.test.ts`
- **CA-7** El sistema DEBE guardar las reuniones leídas del calendario en un registro personal visible solo para la persona dueña del calendario, en una pantalla «Mis reuniones» dentro de las conexiones personales, sin que lo procesen los detectores ni la IA, con la hora, el título, los dominios de los asistentes, la cuenta ligada (CA-32) y un identificador del evento; la cuenta ligada NO DEBE mostrarse en la ficha de la cuenta a ninguna otra persona ni a su dueña. · cubre G-6, G-10 · prueba: `calendar.test.ts`
- **CA-8** CUANDO una persona desconecta su calendario, el sistema DEBE ofrecerle eliminar antes los eventos que creó y, SI acepta, ENTONCES DEBE ejecutar esa eliminación antes de dejar de usar la conexión (excepción a CA-3); SI rechaza, ENTONCES los eventos quedan en su calendario; SI la eliminación falla porque la autorización ya no es válida, ENTONCES DEBE desconectar igualmente y avisar de que los eventos quedan en su calendario. · cubre G-10 · prueba: `calendar.test.ts`

- **CA-29** El sistema DEBE mantener el evento de cada tarea al día: actualizarlo cuando cambie el título o la fecha, y eliminarlo cuando la tarea pase a Hecha, se archive, pierda su fecha límite o deje de estar asignada a esa persona; DEBE conservarlo cuando la tarea pase a Bloqueada o En curso; y DEBE volver a crearlo cuando la tarea vuelva a un estado distinto de Hecha o se restaure al reactivar su objetivo (SDD 1b, CA-15). · cubre G-6 · prueba: `calendar.test.ts`
- **CA-30** El sistema DEBE abstenerse de crear eventos para las tareas anteriores a la fase que no se hayan adoptado (SDD 1b, CA-41) y para las propuestas «Sin asignar» (SDD 1b, CA-78), y DEBE tratar la copia como solo de salida: nada de lo que la persona haga en su calendario modifica la tarea ni recrea el evento hasta que la tarea cambie. MIENTRAS la fase no esté activa para su rol, NO DEBE actualizar ni eliminar eventos, y CUANDO se reactive DEBE reconciliarlos (CA-34). · cubre G-6, G-10 · prueba: `calendar.test.ts`
- **CA-31** El sistema DEBE tener como máximo un evento por tarea y persona, identificándolo con la marca propia de CA-5, de modo que repetir una sincronización o reconectar no duplique eventos, y DEBE excluir de la lectura de reuniones (CA-7) los eventos con esa marca. · cubre G-6 · prueba: `calendar.test.ts`
- **CA-32** El sistema DEBE ligar una reunión a una cuenta solo cuando exactamente una cuenta de la organización coincide con el dominio de algún asistente, comparando sin distinguir mayúsculas, sin «www.» ni subdominios y con la lista única de dominios de correo gratuito del SDD 3 (CA-40); DEBE ignorar el dominio del sitio web de la organización y no ligar (aunque guarde la reunión sin cuenta) los eventos cancelados o rechazados por la persona; y DEBE dejar sin ligar una cuenta sin dominio. · cubre G-6 · prueba: `calendar.test.ts`
- **CA-33** CUANDO una persona deja la organización o pierde el rol que permite la conexión, el sistema DEBE intentar eliminar los eventos que creó para esa persona antes de revocar su autorización (CA-26; decisión de Fede, 2026-10-31) y, SI falla por cualquier causa, ENTONCES DEBE conservarlos, registrarlo en la auditoría y revocar igualmente; DEBE conservar lo ya importado, archivar su registro personal de reuniones sin que nadie pueda verlo y restaurarlo solo para ella si vuelve a conectar en esa organización. · cubre G-10 · prueba: `calendar.test.ts`
- **CA-34** CUANDO una persona vuelva a conectar su calendario tras un error o una desconexión, el sistema DEBE reconciliar los eventos existentes sin duplicarlos, DEBE recrear los eventos que Nokko eliminó por petición de ella (CA-8) si la tarea no está Hecha y tiene fecha, y NO DEBE recrear los que la persona borró a mano hasta que la tarea cambie (título, fecha o estado); para distinguirlos DEBE guardar de cada evento si lo eliminó Nokko o la persona. · cubre G-6, G-10 · prueba: `calendar.test.ts`
- **CA-35** El sistema DEBE separar los eventos y las reuniones por organización y por persona: una organización NO DEBE ver ni usar los de otra, y una persona en dos organizaciones DEBE tener eventos y registros separados en cada una (PRD R-10). · cubre G-10 · prueba: `org-isolation.test.ts`
- **CA-36** SI Google rechaza o no responde al crear o actualizar un evento (cuota, red o falta de calendario principal), ENTONCES el sistema DEBE reintentar, mostrar el estado de ese evento en la pantalla de conexiones personales con qué pasó y qué hacer, y NO DEBE modificar la tarea. · cubre G-6 · prueba: `calendar.test.ts`
- **CA-39** El sistema DEBE leer del calendario las reuniones de la persona en una ventana y con una frecuencia que fija el brief, ignorando los eventos creados por Nokko (marca de CA-5). · cubre G-6 · prueba: `calendar.test.ts`

### H-3: Como persona de Nokko, quiero preparar seguimientos en mi correo sin que se envíe nada.
- **CA-9** El sistema DEBE exponer, con la conexión de correo de una persona, una lista cerrada de operaciones que contiene solo crear un borrador en su buzón, sin leer su correo. · cubre G-6, G-10 · prueba: `mail-drafts.test.ts`
- **CA-10** El sistema DEBE abstenerse de enviar ningún correo desde esa conexión: lo que prepare queda como borrador en el buzón de la persona. · cubre G-10 · prueba: `mail-drafts.test.ts`
- **CA-11** SI se intenta una operación distinta de crear un borrador con esa conexión, ENTONCES el sistema DEBE rechazarla. · cubre G-10 · prueba: `mail-drafts.test.ts`
- **CA-12** CUANDO una persona desconecta su correo, el sistema DEBE dejar de crear borradores y DEBE conservar los ya creados en su buzón. · cubre G-10 · prueba: `mail-drafts.test.ts`

### H-4: Como Owner o Sales leader, quiero llevar a una ficha las notas de una llamada sin nombres.
- **CA-13** El sistema DEBE permitir pegar un texto o subir un archivo con el resumen o las notas de una llamada y que la persona los asigne a mano, en una revisión antes de guardar, a los tres campos de texto de una ficha de conversación (SDD 3, CA-26 y CA-30), completando ella los demás campos de la ficha (fecha, origen, público, señal previa, canal del primer toque y número de toques); no hay asignación automática ni IA. DEBE guardar solo los campos revisados, sin conservar el archivo ni el texto original. · cubre G-6, G-10 · prueba: `call-notes-import.test.ts`
- **CA-14** SI un archivo estructurado importado trae columnas cuyo encabezado, sin distinguir mayúsculas ni acentos, contenga nombre, apellido, empresa, correo, teléfono, cargo, puesto, linkedin, name, company, email, phone o title, ENTONCES el sistema DEBE descartarlas antes de guardar y DEBE avisarlo en la revisión. · cubre G-10 · prueba: `call-notes-import.test.ts`
- **CA-15** El sistema DEBE advertir, junto al texto pegado, que no se incluyan nombres ni datos de clientes. · cubre G-10 · prueba: `call-notes-import.test.ts`
- **CA-37** SI el texto pegado o el archivo subido está vacío o no se puede leer, ENTONCES el sistema DEBE rechazarlo con un aviso que diga qué falta, sin crear ficha. · cubre G-6 · prueba: `call-notes-import.test.ts`

### H-7: Como Owner, quiero introducir estas herramientas por fases sin romper lo anterior.
- **CA-25** MIENTRAS la fase esté activa para el rol de la persona, el sistema DEBE aplicar los criterios de este SDD; para los demás roles, o mientras la fase no esté activa, DEBE mantener el comportamiento anterior sin cambios (PRD R-9; SDD 1a, CA-6). · cubre G-10 · prueba: `personal-tools-phase-guard.test.ts`
- **CA-40** CUANDO se desactive la fase para un rol, el sistema DEBE conservar las conexiones sin usarlas y sin revocar las autorizaciones, sin borrar reuniones ni fichas, y DEBE permitir al Owner revocarlas (CA-38). · cubre G-10 · prueba: `personal-tools-phase-guard.test.ts`

## 8. Casos límite y errores
Cada caso remite al CA que lo cubre.
- Persona desconecta Google, el calendario o el correo → deja de usarse al instante y no se borran reuniones ni fichas (CA-3, CA-8, CA-12).
- Tarea completada, archivada, reasignada, sin fecha o de nuevo pendiente → su evento se elimina, se actualiza o se recrea (CA-29); el evento no se duplica (CA-31).
- La persona borra o mueve el evento en su calendario → la tarea no cambia (CA-30).
- Tarea anterior a la fase o «Sin asignar» → sin evento (CA-30).
- Reunión sin dominio reconocible, con varias cuentas posibles o con solo dominios de correo gratuito → queda sin cuenta ligada (CA-32).
- Operación de correo distinta de borrador → rechazada (CA-11).
- Notas con columnas de nombre → se descartan y se avisa (CA-14).
- Rol sin la fase activa → comportamiento anterior (CA-25).
- Token de Google revocado → la conexión pasa a Error, se avisa en pantalla y al reconectar se reconcilia (CA-34); si falla eliminar eventos por ello, se desconecta igualmente (CA-8).
- Persona que pierde el rol → se revocan sus autorizaciones (CA-26).
- Una persona en dos organizaciones → conexiones, eventos y reuniones independientes (CA-28, CA-35).
- Consejo o rol sin permiso intenta conectar → denegado (CA-1).
- Tarea Bloqueada, En curso, ya Hecha o vencida al conectar, o subtarea → evento conservado, sin evento o con evento según CA-5 y CA-29; objetivo archivado → evento eliminado (CA-29).
- Evento cancelado o rechazado → reunión sin ligar (CA-32).
- Fase desactivada con eventos creados → se conservan sin actualizar, se reconcilian al reactivar y el Owner puede revocar (CA-30, CA-40, CA-38).
- Google falla al crear un evento → reintento y estado visible (CA-36).
- Texto o archivo de notas vacío o ilegible → rechazado con aviso (CA-37).
- Persona que deja la organización → intento de borrar sus eventos, revocación y registro archivado (CA-26, CA-33).
- Reconectar con un evento borrado por la persona → no se recrea hasta que la tarea cambie (CA-34).
- Conectar otro usuario de Google con uno ya conectado → se pide desconectar primero (CA-28).
- Otra organización → nunca ve estos datos (CA-28, CA-35).
- Notas con nombres en un texto pegado → solo se guardan los campos revisados y se advierte (CA-13, CA-15).

## 9. Experiencia y copy
Sistema visual actual (Ink + Lima, versalitas con filete, sin iconos), textos en «tú».
- **Mensajes sugeridos** (a validar con la guía de voz de marca): «Nokko solo crea borradores: tú decides cuándo enviarlos.» · «No añadimos invitados a tus eventos.»
- **Pantalla:** Conexiones personales (calendario y correo) separadas de las de la organización, con estado y fecha de cada capacidad (CA-1) y la pantalla «Mis reuniones» con el registro personal (CA-7). El texto de error dice qué pasó y qué hacer (CA-27).

## 10. Datos, permisos y privacidad
- **Conceptos nuevos:** conexión personal de Google con dos capacidades, evento sincronizado de una tarea, registro personal de reuniones (hora, título, dominios y cuenta ligada).
- **Acceso (como exigen las reglas del repo):** las tres tablas nuevas llevan organización por defecto la actual, acceso filtrado por organización y permisos explícitos; el registro de reuniones solo lo ve su dueño por regla de base de datos, y las columnas de credenciales no son legibles desde el navegador [Sugerencia — el gate valida].
- **Matriz de permisos:**

| Acción | Owner | Sales leader | Consejo | Otros roles |
|---|---|---|---|---|
| Conectar el calendario y el correo propios | Sí | Sí | No | No (fase no activa) |
| Importar notas de llamadas a una ficha | Sí | Sí | No | No |

- **Privacidad:** el título de una reunión puede contener nombres de clientes: queda solo en el registro de su dueño (R-4). Del calendario solo hora, título y dominios de las reuniones, y hacia el calendario solo título, fecha y enlace de la tarea; del correo solo la creación de borradores; ninguna credencial en registros; ningún dato de clientes en pruebas ni ejemplos.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| ninguna en esta fase | — | — | — |

Los borradores los redacta el agente del SDD 5; este SDD solo da la conexión y las operaciones permitidas.

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero [Sugerencia] | Depende de |
|---|---|---|---|---|
| U-1 | Cliente de autorización de Google por persona (autorización, almacenamiento, auditoría, baja, revocación y pantalla de conexiones personales), aislamiento de conexiones por organización y guardia de fase | CA-1 a CA-4, CA-25, CA-26, CA-27, CA-28, CA-38, CA-40 | `google-connection.test.ts`, `org-isolation.test.ts`, `personal-tools-phase-guard.test.ts` | SDD 4a U-1 (estado de conexiones), SDD 1a U-1 y U-7 |
| U-2 | Calendario: eventos, registro personal de reuniones, baja y reconexión | CA-5 a CA-8, CA-29 a CA-36, CA-39 | `calendar.test.ts`, `org-isolation.test.ts` | U-1, SDD 1b U-5, SDD 3 U-4 |
| U-3 | Correo (solo borradores) | CA-9 a CA-12 | `mail-drafts.test.ts` | U-1 |
| U-4 | Notas de llamadas | CA-13 a CA-15, CA-37 | `call-notes-import.test.ts` | SDD 3 U-6, U-1 |

**Orden:** U-1, U-2, U-3, U-4. `org-isolation.test.ts` amplía el archivo que crea el SDD 4a (U-1, CA-24). La guardia de fase (CA-25) se construye en U-1 con su propia prueba que falla primero, y cada unidad posterior añade a la suya un caso de guardia para sus criterios.

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- **Cliente de Google nuevo:** no hay autorización propia ni tokens por persona (`src/lib/google-drive.ts` va por la pasarela de Lovable); hay que construir el cliente, guardar los tokens por persona (con `src/lib/secret-box.server.ts`, que hoy solo usa PostHog) y pasar la verificación de la aplicación del proveedor [Por verificar]. Los tokens de varias capacidades comparten una conexión (CA-1).
- **«Solo borradores» no lo garantiza el alcance:** el alcance de Gmail que permite crear borradores también permite enviar; la garantía de CA-9 a CA-11 está en la capa de Nokko (un cliente que solo exponga crear borradores) y solo se prueba con un cliente falso.
- **Modelo de conexión por persona:** hoy hay una conexión por proveedor y organización; añadir conexiones por persona es un cambio de modelo (tabla nueva), distinto de `org_connections`.
- **Reuniones:** no se reutiliza la tabla `meetings`: la ve toda la organización y la procesan `meetingsToPrep` (`src/lib/autopilot.ts`) y los detectores `meeting-no-notes` y `meeting-no-prep` con IA y avisos; las reuniones leídas del calendario van a un registro personal nuevo, con acceso solo de su dueño (decisión de Fede, 2026-10-30).
- **Reutilización del cliente:** el SDD `drive-per-company-account` y el SDD de salida B (CA-12) podrán usar el cliente de Google de este SDD; no se cambia lo que decidieron.
- Migraciones aditivas con organización por defecto; las 0058 y 0059 siguen sin aplicar (`src/lib/AGENTS.md`).

## 14. Riesgos y dependencias
- Depende de que los SDD de salida de Lovable A y B estén cerrados.
- Calendar y Gmail exigen un cliente de autorización de Google nuevo, tokens por persona y verificación de la aplicación; el alcance de Gmail es más amplio que el uso permitido y la garantía «solo borradores» está en Nokko.
- Un modelo de conexión por persona exige una excepción explícita a `connections-bring-your-own-account` (CA-11: solo el Owner gestiona conexiones) y a `drive-per-company-account` (CA-9: solo cuenta de empresa); la decisión es de Fede (2026-10-30: conexiones personales) y debe quedar recogida en el brief de esos SDD.
- El calendario es una copia de solo salida de las tareas, a diferencia del no-objetivo del PRD de sincronizar tareas con herramientas externas: es un espejo, no un origen de datos.
- Rotar la clave de cifrado obliga a reconectar todas las conexiones personales.
- El alcance de Gmail que permite crear borradores es, según el proveedor, restringido, lo que puede exigir una evaluación de seguridad de terceros [Por verificar].
- El espejo del calendario es una excepción acotada, decidida por Fede (2026-10-30) y anotada en el PRD §5 y §6.1.
- La ventana de lectura del calendario (qué eventos entran: periódicos, privados) y su frecuencia se deciden en el brief; hasta entonces CA-7 solo fija qué se guarda de lo leído.
- Si falla eliminar los eventos de una persona que deja la organización, quedan en su calendario y se registra en la auditoría (CA-33). Con la fase desactivada las autorizaciones siguen válidas y el Owner puede revocarlas (CA-25).
- Un calendario principal compartido muestra a terceros los títulos de las tareas; la persona decide qué calendario comparte.
- Si 4b está activa y 1b o SDD 3 no, no hay tareas ni fichas que reflejar: la guardia de cada fase (CA-25) manda.
- U-2 cierra doce criterios y es la unidad más pesada; el brief puede dividirla en eventos y registro de reuniones sin cambiar los criterios.
- La dependencia de 4a U-1 sirve para reutilizar el estado de las conexiones en la pantalla de conexiones personales y para ampliar `org-isolation.test.ts`; 4a sigue en Borrador.
- La revocación de Google entre organizaciones con la misma cuenta no está verificada (§16).
- El resultado buscado del §4 (personas con calendario o correo conectado) no tiene medición instrumentada; sin dato.
- El SDD 5 DEBE respetar que el registro personal de reuniones no lo procesa la IA y que los borradores se redactan sin leer el correo (CA-7, CA-9); este SDD no puede hacerlo cumplir por sí solo.
- «Con hora» no existe: la fecha límite de las tareas no tiene hora (SDD 1b, CA-31), por eso los eventos son de día completo. La numeración de CA-26 a CA-37 va tras CA-4, CA-8 y CA-15 y es deliberada.
- Dos listas de dominios de correo gratuito conviven hoy en el repo; CA-32 usa la única que fija el SDD 3 (CA-40) y su unidad U-4.

## 15. Preguntas para Fede y para la revisión técnica
- Resuelto por Fede (2026-10-30): las reuniones leídas viven en un registro personal visible solo para su dueño.
- Resuelto por Fede (2026-10-30): el calendario es un espejo de solo salida de las tareas con fecha; anotado en el PRD §5 y §6.1.
- Resuelto por Fede (2026-10-31): la herramienta de transcripciones es Granola; la importación sigue siendo manual por ahora y el conector automático queda para un SDD posterior.
- Revisión técnica: ¿qué alcance mínimo de Gmail y de Calendar permite la verificación de la aplicación, y cómo se garantiza que Nokko solo exponga crear borradores?
- Revisión técnica: ¿cómo convive el modelo de conexión por persona con `connections-bring-your-own-account` y con la decisión de Drive?

## 16. Pendiente de verificar
- Alcance mínimo y verificación de Calendar y Gmail por el proveedor → gate / proveedor.
- Formato y tamaño de la exportación de Granola (CA-13 y CA-37) y si el conector automático futuro puede entregar notas sin nombres → proveedor y SDD posterior.
- Uso real de calendario y correo → datos de producción.
- Si revocar en una organización deja intactas las credenciales de la misma cuenta de Google en otra (CA-28) → proveedor.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Una pasada del gate sobre la v1 puso 6 bloqueantes (resumen diario y silencio nocturno, avisos críticos y Telegram, definición de aviso crítico, propuestas del asistente, herramientas de `/mcp` y Lovable C, y el cliente de Google); los cinco primeros se resuelven moviendo los avisos y el servidor para asistentes al SDD 5 (decisión de Fede, 2026-10-30) y el sexto asignando al 4b la construcción del cliente. Siete pasadas del gate; los informes de la tercera a la séptima (sobre las v3 a v7) se copian a continuación sin editar. Antes: una segunda pasada, sobre la v2, puso 1 bloqueante (las reuniones leídas del calendario iban a una tabla visible a toda la organización y procesada por detectores) y menores; se resuelven en esta v3 con la decisión de Fede (registro personal). 

### Tercera pasada del gate (sobre la v3)
Agente de contexto fresco con las reglas del gate (el agente nokko-gate no estaba registrado en la sesión).

**Veredicto:** Objeciones (0 bloqueantes, 8 menores).

**Pasada previa**
- Bloqueante CA-7: Resuelta. El registro es personal, sin `meetings`, detectores ni IA (CA-7, §13). El resto de menores sigue abajo.
- CA-3/CA-8: Resuelta.
- CA-1 y matriz: Resuelta.
- Baja y R-7 (CA-26): Parcial. Falta qué pasa con lo importado y con los eventos ya creados, y la «borrado» choca con R-7.
- CA-5 con reglas: Resuelta, salvo «con hora»: `due_date` es `date` (1b CA-31).
- Anteriores a la fase y «Sin asignar»: Resuelta.
- Desactivar fase: Parcial. No dice a quién se ofrece eliminar.
- Solo-salida frente al PRD: Parcial. Está en §14 como lectura del autor, sin decisión de Fede ni pregunta en §15.
- Solo borradores: Resuelta (§13, §14).
- CA-13: Resuelta.
- CA-14: Parcial. Lista cerrada en español; faltan «email», «name» y «company».
- U-7: No resuelta.
- Solapes BYO CA-11 y Drive CA-9: Resuelta (§14).

**Problemas nuevos (todos Menores)**
- Numeración: en H-1, CA-26 y CA-27 van tras CA-4 y antes de CA-5 (orden 1-4, 26, 27, 5…).
- U-7: cada unidad ya añade un caso de CA-25 a su prueba, así que `personal-tools-phase-guard.test.ts` no puede fallar primero.
- CA-3 depende de CA-8 (U-2), pero U-1 va antes.
- Ninguna unidad entrega la pantalla de «Conexiones personales» (§9), que CA-27 necesita.
- CA-7: no define la coincidencia de dominio (varias cuentas, dominio propio, webmail) y dice «solo» pero guarda también la cuenta ligada. El SDD 5 no queda obligado a respetar «sin IA» (§14).
- CA-1: no cubre el cambio de rol, y CA-26 tampoco cubre la baja por rol.
- §8 cita «CA-1 del SDD 4a» para el token revocado en vez de CA-27, y omite CA-26.
- R-2, R-4 y R-9: sin choque.

**Comprobaciones mecánicas (script de solo lectura)**
- CA sin duplicados: OK (18).
- Cada CA con G-n y prueba: OK.
- §7 y §12 coinciden: OK (tests y CA).
- Unidades que cubren todos los CA: OK.
- §8 con CA inexistentes: ninguno.
- `[Por verificar]` dentro de un CA: ninguno. Hay 2 en todo el documento (§3 y §13).
- Orden de numeración: falla (ver arriba).

**¿Aprobable?** Sí. Fede puede aprobarlo para brief si acepta tres riesgos: el espejo del calendario contra el no-objetivo del PRD, la excepción a BYO CA-11 y Drive CA-9, y «solo borradores» probado únicamente con cliente falso.

**Lo que NO demuestra:** el alcance mínimo de Gmail y Calendar ni la verificación de la aplicación; si el SDD 5 respetará el registro personal; que las pruebas fallen primero (no se ha ejecutado nada); el uso real.

**Respuesta del autor (v4, 2026-10-30).** Sin bloqueantes. Corregidos CA-7 (coincidencia de dominio), CA-14 (lista de encabezados), CA-26 (baja o pérdida de rol), desactivación de la fase, referencias de §8, pantalla de conexiones personales en U-1 y pregunta a Fede sobre el espejo del calendario en §15. Declarados como riesgos: la numeración con CA-26 y CA-27 tras CA-4, el caso de guardia de U-7 (cada unidad ya prueba el suyo), que «con hora» no existe porque la fecha límite de las tareas no tiene hora, y que el SDD 5 debe respetar el registro personal sin IA. **No hay nueva pasada sobre esta v4.** El gate informa; aprueba Fede.

### Cuarta pasada del gate (sobre la v4)
Agente de contexto fresco con las reglas del gate (el agente nokko-gate no estaba registrado en la sesión).

**Veredicto:** Bloqueado (3 bloqueantes, 14 menores).

**BLOQUEANTES**

1. **CA-5, CA-8 y §14/§15: el espejo de tareas a Google Calendar contradice el PRD aprobado.** El PRD §5 dice «no sincronizar tareas con Plane u otra herramienta» y §6.1 dice «Tareas: solo en Nokko». Ninguna fila del PRD §6.1 recoge una decisión de Fede sobre tareas como eventos; el SDD lo reconoce como pregunta abierta (§15), pero los CA ya lo implementan. Resolución: Fede decide y queda anotado en el PRD §6.1 y §5, o se retiran CA-5 y CA-8.
2. **R-10 (otra organización y una persona en dos organizaciones): sin CA ni prueba.** Dos líneas del §8 remiten a «PRD R-10», no a un CA. El 4a lo cerró con su CA-24 y `org-isolation.test.ts`. Aquí afecta a refresh tokens y al registro personal de reuniones, y el PRD §7 exige pruebas con dos organizaciones ficticias. Resolución: añadir un CA con prueba de dos organizaciones que cubra conexiones, eventos y reuniones, la misma persona con conexiones separadas por organización, y que revocar en una organización no deje sin acceso a la otra [a verificar con el proveedor].
3. **CA-1, CA-3, CA-8, CA-12 y CA-27: no queda claro si calendario y correo son una conexión o dos.** CA-1 conecta «su cuenta de Google» con una sola autorización; CA-3 desconecta «su cuenta de Google»; CA-8 desconecta «su calendario» y CA-12 «su correo»; CA-27 marca «la conexión» como Error. No se puede escribir la prueba sin saber si se puede conectar solo el calendario, si un fallo del correo marca también el calendario, ni si hay estado por capacidad. Resolución: fijar «una conexión por persona y organización con dos capacidades que se activan por separado» (o dos conexiones) y reescribir los CA en consecuencia.

**MENORES**

1. §17 dice haber declarado riesgos que no están en §14 (numeración, caso de guardia de U-7, «con hora», SDD 5 debe respetar el registro personal sin IA). Nada obliga hoy al SDD 5 a respetar «sin IA». Llevarlos a §14 y/o a «No incluye» de §5.
2. CA-26 cita PRD R-7 para borrar autorizaciones, pero R-7 dice «se archiva y no se borra». Justificar el borrado como credencial (secreto) con decisión de Fede, o reformular como revocar e inutilizar. CA-3 tampoco dice si desconectar revoca y borra el token; BYO sí lo hace con `discardCredential`.
3. CA-13 no dice qué se retiene del texto o archivo subido (un volcado con nombres es dato de cliente, R-4): solo los tres campos revisados, sin conservar el original. «Subir» no fija formatos y CA-14 solo cubre archivos estructurados. SDD 3 CA-26 enumera los campos de la ficha pero no los marca obligatorios (los obligatorios de canal y público están en SDD 3 CA-4 y CA-5). §3 omite que `meetings.call_notes` ya tiene 5 campos (`src/lib/call-notes.ts`) y que el detector `meeting-no-notes` los pide.
4. CA-5 mezcla unas ocho conductas: dividirlo en CA atómicos con prueba. La cláusula «de día completo si la fecha no tiene hora» es letra muerta (`tasks.due_date` es `date`). Faltan casos: la tarea pierde su fecha límite; vuelve de Hecha a Pendiente o se restaura al reactivar un objetivo (1b CA-15); la persona borra o mueve el evento; qué calendario se usa si hay varios; qué contiene el evento (propuesta: solo título, fecha y enlace). «Sin asignar» debe citar 1b CA-78 y «anteriores a la fase» 1b CA-41.
5. Desactivar la fase: CA-5 contradice CA-25 y 1a CA-6 (con la fase desactivada la decide el Owner, no la persona). Indicar qué superficie ofrece eliminar o conservar los eventos. CA-25 tampoco dice qué pasa con tokens y reuniones importadas.
6. Token revocado o reconexión (CA-27): no hay CA de reconciliación al reconectar ni de idempotencia, ni de cambiar a otra cuenta de Google, ni de qué pasa con CA-8 si la eliminación falla por token revocado. Falta el texto de error «qué pasó y qué hacer» (R-8).
7. CA-7 define poco la coincidencia de dominio: hay cuatro listas de correo gratuito en el repo (`FREE_EMAIL_DOMAINS` en `src/lib/product-usage.ts` entre ellas); SDD 3 CA-40 exige una sola, y SDD 3 U-4 debe entrar en las dependencias de U-2. Falta normalizar contra `accounts.domain` (nulo, mayúsculas, `www.`, subdominios) y excluir el dominio de la propia organización. No hay CA de qué eventos se leen (ventana, cancelados, rechazados, periódicos, privados) ni cada cuánto. CA-7 mezcla tres cosas (registro personal, sin IA, ligadura). Tras la baja (CA-26) el registro queda sin dueño con acceso.
8. §10: faltan tablas, `org_id` con `current_org()`, RLS y GRANTs de las tres tablas nuevas; «visible solo para su dueño» debe ser regla a nivel de base de datos; las columnas de token no deben ser legibles por el navegador.
9. Otros CA: CA-10 dice «cuenta de la persona» y CA-1 «cuenta de Google» mientras la cabecera define «cuenta» como empresa prospecto o cliente. CA-14 omite first name, last name, e-mail, teléfono y cargo y no se alinea con 4a CA-13. CA-13 cubre G-6 pero la ficha es G-5; PRD §8 mapea 4b a G-6 y G-10. CA-11 solo es comprobable si el cliente admite el nombre de una operación.
10. Unidades y numeración: CA-3 (U-1) cita CA-8 (U-2), referencia hacia adelante. U-7: cada unidad ya añade su caso de CA-25, así que su prueba no puede fallar primero. U-4 depende de 3 U-6 pero también necesita el mecanismo de fases de 1a U-1. U-1 es la más pesada. La pantalla de conexiones (§9) no tiene CA que la verifique. Faltan H-5, H-6, U-5 y U-6, y CA-26 y CA-27 van tras CA-4 y CA-25 al final.
11. Hechos del código: «El cliente de Google "no está construido"» no aparece literalmente en `src/lib/google-drive.ts` ni en `src/lib/connections.ts`; lo que hay es «Google OAuth and per-company keys wait for a decision» (`src/lib/connections.functions.ts:3`): es una decisión pendiente, no solo trabajo. Falta en §14: Google clasifica el alcance de Gmail que permite crear borradores como restringido, lo que implica una evaluación de seguridad de terceros (sin confirmar).
12. El 4a (§1 y §5) aún dice que «avisos y asistentes van en el SDD 4b», cuando el PRD §6.1 los mueve al SDD 5.
13. H-3 no tiene quien lo llame dentro de este SDD (crear un borrador es una operación sin consumidor hasta el SDD 5): decirlo en §5 o §14.
14. §3 cita «(PRD §6.1)» para calendario y correo personales, pero ahí no hay filas sobre calendario o correo personales ni sobre «solo borradores» (solo lo dice R-2).

**Lo que está bien:** los 18 CA tienen forma EARS, citan G-n y nombran su prueba; el §12 cubre los 18 CA sin duplicados y sin ciclos; referencias cruzadas verificadas (1a CA-68 y CA-6 en 1a U-7, 1b CA-31 y U-5, 3 CA-26, CA-30 y U-6, BYO CA-11, drive CA-9, lovable-exit-b CA-12); hechos del código verificados (Calendar y Gmail «todavía no» en `integrations.tsx:40`, Drive por la pasarela de Lovable, `secret-box.server.ts` solo lo usa PostHog, `canManage` solo Owner, `meetingsToPrep` y los detectores existen, `meetings.call_notes` existe, `org_connections` (0059, sin aplicar) tiene una conexión por proveedor y organización); sin datos de clientes ni cifras inventadas; 200 líneas es un tamaño razonable; R-2, R-9 y los demás no-objetivos sin choque salvo el bloqueante 1.

**Límites de la revisión:** no se ejecutaron tests (no puede confirmar que las pruebas fallen primero); no se verificó el alcance mínimo de Calendar y Gmail, la verificación del proveedor ni si revocar en una organización afecta a la otra; no se verificó RLS ni producción (migraciones 0058 y 0059 sin aplicar); no se leyeron los SDD 2, de salida A y C, ni `money-moment-notices`.

**Respuesta del autor (v5, 2026-10-30).** Bloqueante 1: Fede aceptó el espejo de solo salida; anotado en el PRD §5 y §6.1 y resuelto en §15. Bloqueante 2: CA-28 con `org-isolation.test.ts`. Bloqueante 3: una conexión con dos capacidades (CA-1, CA-3, CA-8, CA-12, CA-27). Menores: riesgos llevados a §14; CA-26 reformulado como revocar e inutilizar; CA-13 sin conservar el original; CA-5 dividido (CA-5, CA-29, CA-30, CA-31) con contenido mínimo del evento; CA-32 para la ligadura de dominio; fase desactivada conserva sin usar; reconciliación al reconectar; acceso en §10; CA-3 sin referencia hacia adelante; U-7 integrada en U-1; U-2 depende de SDD 3 U-4; CA-14 ampliado; pantalla cubierta por CA-1. Queda como riesgo: la ventana de lectura del calendario y la frecuencia se deciden en el brief; el menor 12 (referencia del 4a a avisos y asistentes) se corrige en la ronda del 4a; CA-13 cubre G-6 y G-10 según el mapa del PRD §8. **No hay nueva pasada sobre esta v5.** El gate informa; aprueba Fede.

### Quinta pasada del gate (sobre la v5)
Agente de contexto fresco con las reglas del gate (el agente nokko-gate no estaba registrado en la sesión).

**Veredicto:** Bloqueado (2 bloqueantes, con arreglo corto, y 11 menores). La v5 resuelve en lo sustancial los 3 bloqueantes de la pasada previa (espejo del calendario, aislamiento R-10, una conexión con dos capacidades). Dos cosas que dice haber resuelto no lo están: la ventana de lectura (§17 la declara riesgo, §14 no la recoge) y la salida limpia de Google en dos organizaciones (CA-28).

**BLOQUEANTES**
1. **§12 U-1 frente a U-2 (CA-26, CA-27, CA-28): dependencia hacia adelante.** U-1 cierra CA-26, CA-27 y CA-28, que exigen conservar eventos, archivar el registro de reuniones, reconciliar eventos sin duplicar y separar eventos y reuniones por organización. Esos eventos (CA-5, CA-29, CA-31) y ese registro (CA-7) los crea U-2, que va después: la prueba de U-1 no puede ejercitarlos. CA-3 («conservar lo ya importado») y CA-25 («los eventos ya creados») tienen un problema parecido. Arreglo: dejar en U-1 solo la parte de conexión y credenciales y mover las cláusulas de eventos, reuniones y reconciliación a CA propios de U-2, o cerrarlos «parcialmente» en U-2 como casos añadidos a `calendar.test.ts` y `org-isolation.test.ts`.
2. **CA-13: referencia cruzada falsa y criterio no verificable.** Dice que el «canal y el público» «los exigen» SDD 3 CA-4 y CA-5; esos CA regulan lead, cuenta, prueba y deal, no la ficha (SDD 3 CA-26 es la ficha). CA-26 del SDD 3 lista «público» y «canal del primer toque» como campos pero no los marca obligatorios, ni dice qué hacer con el origen (frío, cálido o anterior) ni con la fecha cuando el texto importado no los trae. «Asignarlos a los tres campos» no dice quién asigna: si lo hace un modelo, es una llamada a IA no declarada (§11 dice «ninguna»); si lo hace la persona en la revisión, hay que decirlo. Arreglo: citar solo SDD 3 CA-26 y CA-30, enumerar qué campos completa la persona a mano en la revisión (incluidos origen y fecha) y escribir «asignación manual, sin IA».

**MENORES**
1. CA-28 y §16: se perdió la verificación con el proveedor. La v4 llevaba «a verificar con el proveedor»; el CA exige que revocar en una organización no afecte a la otra con la misma cuenta de Google, y eso depende de cómo revoca el proveedor. Añadirlo a §14 y §16 y acotar el CA a «no invalida las credenciales guardadas de la otra organización».
2. §17 dice una cosa y §14 otra: §17 declara como riesgo la ventana de lectura y la frecuencia del calendario, pero §14, §15 y §16 no la recogen. Sin ella, CA-7 no dice qué eventos entran (periódicos, privados).
3. CA-7 mezcla tres cosas (registro personal, sin IA, ligadura) y no define dónde ve la persona ese registro (§9 solo lista la pantalla de conexiones). La ligadura a una cuenta no debe mostrarse en la ficha de la cuenta a toda la organización, o se rompe la privacidad.
4. CA-32: normalización incompleta. No cubre subdominios (`mail.acme.com` frente a `acme.com`) ni `accounts.domain` nulo; el «dominio propio de la organización» solo existe como `organizations.website`, que puede ser nulo (fijar su origen); es ambiguo si «ignorar cancelados y rechazados» significa no ligar o no guardar el evento.
5. CA-27 frente a CA-30/CA-31: reconectar con un evento borrado. CA-30 dice que lo que haga la persona en su calendario no recrea el evento; CA-27 dice reconciliar al reconectar. No se dice si un evento borrado por ella se recrea al reconectar, ni qué pasa si reconecta con otra cuenta de Google (§5 excluye varias cuentas pero no hay CA de rechazo o sustitución).
6. CA-26: los eventos quedan en el calendario de quien se va (títulos de tareas de la organización en el calendario personal de alguien que ya no pertenece a ella, y al revocar ya no se pueden borrar). Valorar intentar la eliminación antes de revocar, o declararlo como riesgo. Tampoco dice qué pasa con el registro archivado si la persona vuelve.
7. CA-25 frente a CA-3 y CA-8: con la fase desactivada para un rol se conservan las conexiones «sin usarlas», pero esa persona no ve la pantalla de conexiones personales; los tokens siguen válidos sin forma de revocarlos. Decidir si la desactivación los revoca. CA-3 tampoco dice qué pasa al revocar un token ya inválido.
8. Atomicidad y redacción: CA-1 y CA-30 agrupan varias conductas; CA-8 dice «DEBE ejecutar esa eliminación» siempre (debería ser «si la persona acepta»); CA-11 incrusta el método de prueba («cliente falso»); CA-14 usa encabezados exactos y deja pasar «apellidos», «nombre completo», «full name» y «linkedin».
9. Referencias y numeración: `org-isolation.test.ts` ya es el archivo de 4a U-1 (CA-24): declarar que 4b lo amplía o darle otro nombre; §14 dice «CA-26 a CA-32 tras CA-25» y en el texto van tras CA-4 y CA-8; la respuesta v5 dice que el menor 12 del 4a «se corrige en la ronda del 4a», pero el 4a v6 ya dice «SDD 5»; CA-13 cubre G-6 aunque la ficha es G-5 (PRD §8 asigna 4b a G-6 y G-10, defendible).
10. Dependencia dudosa de U-1 con SDD 4a U-1: el 4a es un borrador y 4b no usa su estado ni su auditoría (tiene su propio CA-4 con 1a CA-68). Justificarla o quitarla.
11. Varios: §4 «Medición» no tiene fuente ni CA que la instrumente; CA-5 no dice si las tareas «anteriores a la fase» (1b CA-41) reciben evento una vez adoptadas; CA-29 no dice qué pasa con «Bloqueada»; un calendario principal compartido muestra los títulos a terceros; falta decir qué pasa si 4b está activa y 1b o SDD 3 no; §8 no lista el caso «Consejo o rol sin permiso intenta conectar» (cubierto por CA-1).

**Lo que está bien:** los 23 CA (1–15 y 25–32) tienen forma EARS, G-n y prueba nombrada, sin duplicados ni huecos, y cada CA del §7 está en §12; sin ciclos entre unidades ni dependencias externas inexistentes; referencias cruzadas verificadas (1a CA-68 y CA-6, 1b CA-31, CA-15, CA-41 y CA-78, SDD 3 CA-26, CA-30 y CA-40, 1b U-5, 3 U-4 y U-6, BYO CA-11, Drive CA-9, lovable-exit-b CA-12); coherencia con PRD (espejo con §5 y §6.1, R-2, R-4, R-7, R-9; registro personal sin IA y SDD 5 obligado a respetarlo); hechos de código (Calendar y Gmail «todavía no» en `integrations.tsx:40`, Drive por la pasarela de Lovable, «Google OAuth and per-company keys wait for a decision» en `connections.functions.ts:3`, `secret-box.server.ts` solo lo usa PostHog, `meetings.call_notes`, `meetingsToPrep` y detectores, cuatro listas de correo gratuito, `tasks.due_date` es `date`); sin datos de clientes ni cifras inventadas; unas 250 líneas.

**Límites:** no se ejecutaron tests; no se verificaron los alcances de Gmail y Calendar ni cómo revoca Google; no se verificó RLS, migraciones (0058 y 0059 sin aplicar) ni producción; no se leyeron el SDD 2, los de salida A y C, `money-moment-notices` ni `lead-qualification.ts`.

**Respuesta del autor (v6, 2026-10-31).** Bloqueante 1: CA-26, CA-27 y CA-28 se limitan a conexión y credenciales (U-1); lo de eventos y reuniones pasa a CA-33, CA-34 y CA-35 (U-2) y CA-25 deja de citar eventos. Bloqueante 2: CA-13 cita solo SDD 3 CA-26 y CA-30 y fija la asignación manual sin IA. Menores: 1, 2 y 6 a 7 declarados en §14 y §16; 3 (pantalla «Mis reuniones», sin mostrar la ligadura en la ficha), 4 y 5 en CA-7, CA-32, CA-28 y CA-34; 8, 9 y 10 corregidos o justificados; 11: CA-29 y CA-30 cubren Bloqueada y adoptadas, §8 amplía casos. **Riesgos declarados:** ventana de lectura del calendario, eventos que quedan tras la baja, autorizaciones sin pantalla con la fase desactivada, revocación de Google entre organizaciones sin verificar, calendario compartido, medición sin instrumentar. **No hay nueva pasada sobre esta v6.** El gate informa; aprueba Fede.

### Sexta pasada del gate (sobre la v6)
Agente de contexto fresco con las reglas del gate (el agente nokko-gate no estaba registrado en la sesión).

**Veredicto:** Cambios menores. Sin bloqueantes: los dos bloqueantes de la quinta pasada están resueltos en lo sustancial, con restos y una laguna nueva en el calendario.

**Lo que la v6 dice resolver y sí lo está:** U-1 frente a U-2 (CA-26, CA-27 y CA-28 se limitan a conexión y credenciales y se pueden probar en U-1; lo de eventos y reuniones está en CA-33, CA-34 y CA-35, en U-2, con `calendar.test.ts` y `org-isolation.test.ts`; U-2 depende de U-1, 1b U-5 y SDD 3 U-4; sin referencias hacia adelante en esos CA ni ciclos). CA-13 (cita bien SDD 3 CA-26 y CA-30, fija la asignación manual sin IA, §11 dice «ninguna», no conserva el original). Referencias cruzadas exactas (1a CA-68 y CA-6 en 1a U-7; 1b CA-15, CA-31, CA-41 y CA-78 en 1b U-5; SDD 3 CA-26 y CA-30 en U-6 y CA-40 en U-4). Cobertura: los 26 CA (1–15 y 25–35) aparecen en §12 sin duplicados, con forma EARS (salvo CA-30, menor 6), «cubre G-n» y prueba nombrada; §7 y §12 coinciden; §8 solo cita CA existentes. Hechos de código comprobados (`integrations.tsx:40`, `connections.functions.ts:3`, `meetingsToPrep`, dos listas de correo gratuito en `product-usage.ts` y `lead-qualification.ts`, `tasks.due_date` es una fecha sin hora). Reglas del PRD: R-2, R-4 y R-10 respetados; la excepción del espejo está anotada en PRD §5 y §6.1; sin datos de clientes ni cifras inventadas.

**BLOQUEANTES:** ninguno.

**MENORES**
1. Resto de la dependencia hacia adelante en CA-3 y CA-25 (U-1): ambos hablan de «conservar lo ya importado», que crean U-2 (reuniones) y U-4 (notas); la v6 solo corrigió CA-26 a CA-28. Reducir CA-3 y CA-25 a «no borrar datos de otras historias» y probarlo con filas de prueba, o llevar la conservación a CA-33 y a un caso de la guardia en U-2.
2. Eventos de tareas importados como reuniones (CA-7, CA-32, CA-5): ningún CA excluye de «Mis reuniones» los eventos que crea Nokko; los eventos de día completo de las tareas volverían como «reuniones» con el título de la tarea. Añadir a CA-7 que se excluyen los eventos creados por el sistema, identificados por su identificador (el mismo de CA-31).
3. CA-34 frente a CA-8: no se puede escribir la prueba. CA-34 no recrea los eventos que «la persona haya borrado», pero si la persona aceptó en CA-8 que Nokko los eliminara, al reconectar no se sabe si se recrean. Precisar que los eliminados por CA-8 se recrean al reconectar si la tarea sigue pendiente con fecha, y que solo los borrados a mano no se recrean.
4. CA-3 frente a CA-8: CA-3 dice «dejar de usarla al instante», pero CA-8 usa la conexión para eliminar antes de dejar de usarla. En CA-3 añadir «salvo la eliminación aceptada en CA-8».
5. §14 desactualizado y respuesta v6 que dice más de lo que hay: la última viñeta dice «La numeración de CA-26 a CA-32 tras CA-25 es deliberada» (ahora son CA-26 a CA-35 y van tras CA-4 y CA-8; la cabecera sí está bien). La respuesta v6 afirma que «medición sin instrumentar» y «revocación de Google entre organizaciones» están declarados en §14, y no lo están: la revocación solo está en §16 y dentro del CA-28, y la medición del §4 no figura en §14 ni §16.
6. Redacción EARS: CA-30 «MIENTRAS la fase se desactive» debería ser «CUANDO se desactive la fase», y repite CA-25 (quitarlo de uno); CA-1 y CA-30 agrupan varias conductas; CA-28 lleva «[a verificar con el proveedor]» dentro del criterio (dejarlo solo en §16 y acotar el CA a lo que Nokko controla).
7. §8 incompleto. Faltan casos que ya cubre un CA: tarea Bloqueada (CA-29), subtarea (CA-5), objetivo pausado o cerrado (CA-29), fase desactivada con eventos (CA-30), evento cancelado o rechazado (CA-32) y «pierde el rol → CA-33». Faltan casos sin CA: fallo de Google al crear un evento o borrador (cuota, red o sin calendario principal), tarea vencida al conectar, archivo o texto de notas vacío o ilegible, y formatos de archivo y tamaño de «subir un archivo» (CA-13). Añadir un CA corto de «fallo al crear: reintento y estado visible», uno de «entrada vacía rechazada con aviso» y los casos al §8.
8. Dependencias con 4a: la dependencia de U-1 con 4a U-1 tiene dos justificaciones distintas (§12 la usa para ampliar `org-isolation.test.ts`; §14 dice «solo para reutilizar el estado»). 4a U-1 extiende las conexiones de organización con Stripe, PostHog y Apify, y CA-1 y CA-27 ya definen el estado de la conexión personal; 4a sigue en Borrador. La cabecera cita solo SDD 3 U-6 y omite U-4. Unificar el motivo o quitar la dependencia y que 4b cree su propio archivo de aislamiento.
9. CA-32 y CA-7: «sin subdominios» no dice qué pasa con sufijos como `co.uk`; si `organizations.website` es nulo, el dominio propio no se puede ignorar; el título de la reunión puede contener nombres de clientes (registro solo del dueño, pero anotarlo en §10 junto a R-4).
10. Menor del PRD: el §6.1 recoge el registro personal pero no «sin IA» ni «notas de llamadas sin nombres»; la decisión consta solo en este SDD (§13 y §15).

**Límites:** no se ejecutaron tests ni se comprobó RLS, migraciones (0058 y 0059 sin aplicar) o producción; no se verificaron los alcances de Gmail y Calendar ni cómo revoca Google entre organizaciones; no se leyó SDD 2 en detalle ni `money-moment-notices`; no se confirmó que SDD 3 fije físicamente la única lista de dominios gratuitos (CA-40 la exige).

**Respuesta del autor (v7, 2026-10-31).** Sin bloqueantes. Menores corregidos: 1 y 4 (CA-3 y CA-25 sin «conservar lo importado»; CA-3 salvo CA-8), 2 (CA-7 excluye los eventos de Nokko), 3 (CA-34 con los eliminados por CA-8), 5 (§14), 6 (CA-30 sin repetir CA-25; CA-28 sin la verificación dentro del criterio), 7 (CA-36 y CA-37, casos en §8), 8 (motivo unificado y cabecera con SDD 3 U-4) y 9 (§10). **Declarado:** `co.uk` y dominios compuestos, sitio web de la organización nulo, formatos de archivo y tamaño de las notas (se deciden en el brief), y el menor 10 (PRD §6.1 recoge la decisión de «sin IA» solo en este SDD). **No hay nueva pasada sobre esta v7.** El gate informa; aprueba Fede.

### Séptima pasada del gate (sobre la v7)
Agente de contexto fresco con las reglas del gate (el agente nokko-gate no estaba registrado en la sesión).

**Veredicto:** Cambios menores. Sin bloqueantes: la v7 resuelve en lo sustancial los 10 menores de la pasada previa y las dos decisiones de Fede del 2026-10-31 están en el texto.

**BLOQUEANTES:** ninguno.

**MENORES**
1. CA-26 y CA-3 (U-1) citan CA-33 y CA-8 (U-2): referencia hacia adelante. U-1 no puede probar «tras el intento de eliminar sus eventos» ni «salvo la eliminación aceptada», porque esos eventos los crea U-2. Resolución: quitar las citas de CA-26 y CA-3; CA-8 y CA-33 ya dicen que eliminan «antes» de dejar de usar o de revocar, y U-2 añade esos casos a `calendar.test.ts`, donde fallan primero.
2. CA-25 (revocación por el Owner): «poder revocarlas desde las conexiones de la organización» no tiene pantalla ni unidad que la entregue. CA-1 separa las conexiones personales de las de la organización y dice «impedir que otra persona la use»; 1a CA-6 dice «ocultar» lo creado. Añadir al CA qué lista ve el Owner (qué persona y capacidad, sin credenciales) y una excepción en CA-1 solo para revocar; partir CA-25 en dos: guardia de rol y fase, y revocación por el Owner.
3. §8 («Fase desactivada con eventos creados → se conservan sin actualizar», cita CA-30 y CA-25) no tiene CA que lo diga: CA-30 dejó de mencionarlo en la v7, CA-25 solo habla de conexiones y CA-29 sigue obligando a mantener los eventos al día. Una cláusula en CA-25 o CA-29 («CUANDO la fase no esté activa, NO DEBE actualizar ni eliminar eventos») y decir qué pasa al reactivarla (CA-34 o resincronizar).
4. §8 sobre CA-36: «Google falla al crear un evento o un borrador» atribuye a CA-36 los borradores, y CA-36 solo cubre eventos. Ampliar CA-36 a borradores o quitar «o un borrador» de §8. Además, H-3 no tiene CA positivo («crear un borrador solo con la capacidad de correo conectada»), solo prohibiciones.
5. §8, referencias imprecisas: «al reconectar se reconcilia (CA-27)» (la reconciliación es CA-34); «objetivo pausado o cerrado → evento conservado o actualizado» (por 1b CA-15 y CA-29, las tareas se archivan y el evento se elimina); «lo importado se conserva (CA-3…)» (CA-3 solo dice no borrar lo de otras historias).
6. CA-29 y CA-34 no cubren el estado «En curso»: los estados son Pendiente, En curso, Hecha y Bloqueada y dicen «vuelva a estar pendiente», sin decir qué pasa con Hecha → En curso. CA-5 crea evento para toda tarea con fecha, pero una tarea ya Hecha al conectar debería no tenerlo; la tarea con fecha vencida al conectar sigue sin caso y no está en §8. Usar «estado distinto de Hecha» en CA-5, CA-29 y CA-34, y definir «cambie» (título, fecha o estado).
7. CA-34 no define cómo distinguir un evento borrado a mano de uno eliminado por CA-8: hace falta guardar ese hecho (estado del evento sincronizado) y decirlo en el CA o en §10.
8. CA-7: «identificados por su identificador» no es verificable (CA-5 y CA-31 no definen ningún identificador); CA-7 sigue mezclando seis conductas; no dice cuándo lee el calendario (ventana y frecuencia están en §14, correcto) y deja ambiguo si el dueño ve la cuenta ligada en la ficha de la cuenta. Que el sistema marque los eventos que crea con una marca propia (CA-5, CA-31) y los excluya de la lectura; partir CA-7.
9. CA-3 y CA-25 usan «lo importado por otras historias», que no es verificable: «sin borrar reuniones ni fichas», probado con filas de prueba. CA-3 tampoco dice qué pasa si la revocación en el proveedor ya no es válida (CA-26 sí).
10. CA-26 y CA-33 duplican la regla «eliminar eventos antes de revocar» en dos unidades; si la eliminación falla por red y no por token inválido, no hay reintento antes de revocar: declararlo, o decir que se registra y se revoca igualmente.
11. Atomicidad EARS: CA-1 mezcla seis conductas; CA-25 mezcla «MIENTRAS» con «al desactivarse»; CA-27 dice «sus dos capacidades» aunque solo una esté activa; CA-8 no dice qué pasa si la persona rechaza eliminar (los eventos quedan, explícito).
12. Tamaño y carga: U-2 cierra 12 CA y es la más pesada (dividirla en eventos y registro/baja); son 28 CA y unas 325 líneas (unas 130 del §17); la dependencia de U-1 con 4a U-1 es débil (4a es Borrador y 4b usa su propio estado) y está justificada solo por `org-isolation.test.ts`: decirlo una vez.
13. Mínimos: CA-37 y CA-13 cubren «G-6», pero la ficha es G-5 (PRD §8 asigna 4b a G-6 y G-10; defendible); la matriz «Importar notas: otros roles No» no tiene CA propio en 4b (lo da 3 CA-30, que CA-13 ya cita); la respuesta del §17 dice que el PRD no recoge «sin IA», pero la fila del PRD §6.1 ya lo recoge.

**Lo que está bien:** los 28 CA (1–15 y 25–37) aparecen una vez en §7 y §12, con «cubre G-n» y prueba nombrada, sin duplicados; la numeración coincide con la cabecera; referencias cruzadas exactas (1a CA-68 y CA-6 en 1a U-7; 1b CA-15, CA-31, CA-41 y CA-78 en 1b U-5; SDD 3 CA-26 y CA-30 en U-6; CA-40 en U-4; 4a CA-24 y `org-isolation.test.ts` en 4a U-1); decisiones de Fede coinciden con el PRD §6.1; R-2, R-4, R-7, R-8 y R-10 respetados; sin ciclos entre unidades; hechos de código verificados (`connections.functions.ts:3`, `secret-box` solo lo usa `posthog-sync`, `due_date` es un string sin hora, `call_notes` y `google-drive.ts` existen); sin datos de clientes ni cifras inventadas, §11 declara que no hay IA.

**Límites:** no se ejecutaron tests; no se verificaron RLS, migraciones ni producción; no se verificaron los alcances de Gmail y Calendar ni cómo revoca Google entre organizaciones (§16); no se comprobó que SDD 3 U-4 unifique físicamente la lista de dominios gratuitos; SDD 2 y 1a solo en los CA citados.

**Respuesta del autor (v8, 2026-10-31).** Sin bloqueantes. Menores: 1 (CA-3 y CA-26 sin citas hacia adelante; el orden «borrar antes de revocar» vive en CA-33 y CA-8 con su prueba en U-2), 2 (CA-38 para la revocación del Owner, con su excepción a la separación de conexiones, y CA-25 partido con CA-40), 3 (CA-30 para la fase no activa), 4 y 5 (§8), 6 (estado distinto de Hecha, vencida al conectar, En curso), 7 (CA-34 guarda quién eliminó cada evento), 8 (marca propia en CA-5 y CA-31, exclusión en CA-39, CA-7 acotado), 9 (CA-3 sin «otras historias»), 10 (CA-33 revoca igualmente si falla), 11 (CA-1 partido en CA-1 y CA-38, CA-8 con rechazo, CA-27 con capacidades activas) y 12 (declarado en §14). **No hay nueva pasada sobre esta v8.** El gate informa; aprueba Fede.

## 18. Delta de implementación (lo rellena el agente al entregar)
Sin entrega todavía.
