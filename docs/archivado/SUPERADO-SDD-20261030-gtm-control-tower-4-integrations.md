# SDD-20261030-gtm-control-tower-4-integrations · [Feature] Integraciones de la torre de control: datos reales, calendario, correo, avisos y asistentes

**Tipo:** Feature · **Prioridad propuesta:** Alta
**Estado:** Borrador · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-10-30
**PRD:** `docs/prd/PRD-20261030-gtm-control-tower.md` · **Depende de:** SDD 1a (roles, resultados clave y activación por rol: U-1, U-2, U-3 y U-4), SDD 1b (tareas, para el calendario) y SDD 3 (diccionario de métricas y etapas de embudo: U-1 y U-4); del SDD-8 para Dani (vistas agregadas de la base de datos de Postin, pendiente de redactar); y de los SDD de salida de Lovable A, B y C para construir · **Coordinar con:** `SDD-20261025-connections-bring-your-own-account` (En curso: U-1 y U-2 entregadas sin proveedores habilitados), `SDD-20261025-drive-per-company-account` (Aprobado), `SDD-20261029-lovable-exit-b-servicios-y-corte` (CA-11 a CA-14: claves propias de correo, proveedores e IA) y `SDD-20261029-lovable-exit-c-mcp` (migra `/mcp`)

> Un SDD dice cómo se verifica que está bien hecho. Cada criterio de aceptación (CA-n) debe poder tener una prueba automática que lo nombre.
> Los criterios no nombran tecnología; lo técnico va en el §13 como [Sugerencia — la revisión del gate las valida].
> Las reglas transversales del PRD (§6.2, R-1 a R-10) aplican a todo este SDD. «Organización» es la empresa que usa Nokko; «cuenta» es una empresa prospecto o cliente. Las lecturas de LinkedIn por extracción automática se retiran en el SDD 1a (U-0): este SDD no las reintroduce.

## 1. Resumen
Conecta la torre de control con datos reales y con las herramientas de trabajo de la persona: **Stripe** (MRR, clientes y churn), **datos de producto** (PostHog y las vistas agregadas de la base de datos de Postin) como fuentes automáticas de resultados clave y de las etapas del embudo; **calendario** (las tareas con fecha como eventos y las reuniones ligadas a cuentas); **correo** (solo borradores, nunca envío); **transcripciones** de llamadas (importación sin nombres); **avisos** por email y Telegram; **Drive**; **importación de Sales Navigator por CSV**; los proveedores de **investigación y enriquecimiento** con coste previo visible; y un **servidor para asistentes** de solo lectura y propuestas. Define cómo se sincroniza cada fuente, qué se ve cuando falla y quién conecta qué.

## 2. Problema y para quién
Hoy los resultados clave de negocio solo pueden entrar a mano, las tareas no aparecen en el calendario de la persona, no hay forma de preparar seguimientos en el correo, y el servidor para asistentes expone herramientas de CRM, no el estado de la estrategia. Para Fede (Owner), Flor (Sales leader) y quien use Nokko desde un asistente.

## 3. Evidencia y por qué ahora
- **Código (repo de Nokko, solo lectura, 2026-10-30):**
  - El registro de proveedores tiene ocho entradas: Google Drive, Apollo, Clay, Parallel, Perplexity, Firecrawl, PostHog y Stripe (`src/lib/connections.ts`); Apify se usa pero no figura en el registro (`src/lib/apify-gateway.ts`).
  - Stripe ya existe: conexión, sincronización manual y una foto con MRR, clientes activos, bajas y churn (`src/lib/stripe.functions.ts`, tablas `stripe_connections` y `stripe_snapshots`).
  - PostHog ya existe: conexión, configuración de eventos y sincronización cada 6 horas de las pruebas (`src/lib/posthog-sync.server.ts`, `SYNC_EVERY_HOURS`).
  - **Google Calendar y Gmail no existen** en el código; sí existe la autorización de Drive como patrón.
  - El correo diario usa un proveedor de correo (`src/lib/email.server.ts`, `src/lib/daily-email.server.ts`); Telegram tiene el código listo pero el bot no está conectado (`src/lib/telegram.server.ts`, roadmap del repo).
  - El servidor `/mcp` lo genera el plugin de Lovable (`src/routes/mcp.ts`, `src/lib/mcp/`), con herramientas de agente, empresas y métricas.
  - Solo el Owner gestiona conexiones, y el almacén cifrado de credenciales de cuentas propias «no existe hasta que Dani lo diseñe» (`src/lib/connections.ts`, `src/lib/connections-core.ts`); sí existe el cifrado de claves de integración (`src/lib/secret-box.server.ts`).
  - Hay uso y presupuesto de integraciones (`integration_usage`, `org_budgets`).
- **Postin Core (Drive, solo lectura):** F0-11 v1.2 (LinkedIn solo por API oficial, sin herramientas de terceros; Sales Navigator manual) y el proceso de venta de octubre 2026.
- **Entrevista con Fede (2026-10-29/30):** alcance y uso de cada integración (PRD §6.1).
- Uso real de las integraciones actuales: **sin dato** [Por verificar].

## 4. Resultado buscado
- Los resultados clave de ingresos y activación se alimentan de una fuente automática cuando existe (G-6 del PRD). Medición: proporción de resultados clave con fuente automática. Línea base: sin dato.
- Ninguna integración sin estado visible, antigüedad del dato y responsable.

## 5. Alcance
**Incluye:** H-1 a H-12.
**No incluye:**
- Cambios en Stripe o en el producto de Postin, y la creación de las vistas de la base de datos de Postin (SDD-8, para Dani).
- Lectura o análisis de LinkedIn por extracción automática (SDD 1a, U-0).
- Envío de correos o invitaciones a terceros; publicación de contenido.
- Agente, chat y herramientas nuevas (SDD 5) y vigilancia de competidores (SDD 6).
- Conectores automáticos de herramientas de transcripción (la herramienta no está decidida).
- Sincronización con herramientas externas de tareas.
- Un almacén gestionado de credenciales (evolución futura; se reutiliza el cifrado actual).

## 6. Cambios de comportamiento (delta)
**Añadido:** fuentes automáticas de resultados clave; estado y antigüedad de cada fuente; conexión personal de Calendar y Gmail; borradores de correo; importación de notas de llamadas; avisos del check-in y de lo crítico; servidor para asistentes con lectura de la estrategia y propuestas; gasto visible por proveedor y por objetivo.
**Modificado:** la sincronización de Stripe y de los datos de producto pasa a diaria y previa a cada check-in; los fallos muestran el último valor con su antigüedad; Apify queda limitado a fuentes que no son LinkedIn.
**Eliminado:** nada. Las conexiones y datos importados se conservan al desconectar.

## 7. Historias y criterios de aceptación
Cada CA cita el objetivo G-n del PRD que cubre y el archivo de prueba (ruta por decidir en la implementación [Sugerencia]).

### H-1: Como Owner, quiero ver el estado de cada fuente y qué pasa cuando falla.
- **CA-1** El sistema DEBE mostrar, por cada integración, su estado (Conectada, Sin conectar, Error o Sin respuesta), la fecha de la última sincronización correcta y quién la conectó. · cubre G-6 · prueba: `integration-status.test.ts`
- **CA-2** SI una sincronización automática falla, ENTONCES el sistema DEBE mostrar el último valor con su antigüedad, DEBE pasar el resultado clave afectado a «Sin dato reciente» (SDD 1a, CA-24), DEBE avisar al Owner y DEBE abstenerse de inventar un valor. · cubre G-6, G-10 · prueba: `integration-status.test.ts`
- **CA-3** El sistema DEBE sincronizar cada fuente automática de resultados clave una vez al día y justo antes de preparar cada check-in semanal, e indicar la hora de la última lectura. · cubre G-6 · prueba: `sync-schedule.test.ts`
- **CA-4** El sistema DEBE permitir al Owner lanzar una sincronización manual de una fuente, con un intervalo mínimo entre lanzamientos. · cubre G-6 · prueba: `sync-schedule.test.ts`
- **CA-5** MIENTRAS una fuente automática no esté conectada, el sistema DEBE permitir la entrada manual del valor, marcada «Manual» con autor y fecha. · cubre G-6, G-10 · prueba: `integration-status.test.ts`

### H-2: Como Owner, quiero que Stripe alimente mis resultados clave de ingresos.
- **CA-6** DONDE Stripe esté conectado, el sistema DEBE traer el MRR, los clientes de pago y el churn y DEBE ofrecerlos como fuente automática al crear un resultado clave (SDD 1a, CA-17). · cubre G-6 · prueba: `stripe-source.test.ts`
- **CA-7** SI la clave de Stripe que se conecta permite escribir o no es de solo lectura, ENTONCES el sistema DEBE rechazarla y DEBE explicar cómo crear una clave de solo lectura. · cubre G-6, G-10 · prueba: `stripe-source.test.ts`
- **CA-8** El sistema DEBE calcular el valor de MRR de un resultado clave con la definición «MRR normalizado» del diccionario (SDD 3, CA-18) y, SI el dato de Stripe no permite aplicarla, ENTONCES DEBE mostrar la diferencia en vez de sustituir la definición. · cubre G-6, G-10 · prueba: `stripe-source.test.ts`
- **CA-9** El sistema DEBE guardar la clave de Stripe cifrada y DEBE evitar devolverla al navegador, escribirla en registros o mostrarla tras conectarla. · cubre G-10 · prueba: `credentials.test.ts`

### H-3: Como Owner, quiero datos de uso de producto para medir la activación.
- **CA-10** DONDE las pruebas de producto estén conectadas, el sistema DEBE actualizarlas con la misma cadencia de CA-3 y DEBE permitir usarlas como fuente de las etapas «Activa» y «Publicó» (SDD 3, CA-14 y CA-15). · cubre G-6 · prueba: `product-source.test.ts`
- **CA-11** DONDE exista la credencial de solo lectura de las vistas agregadas de la base de datos de Postin (SDD-8), el sistema DEBE traer de ellas la activación y el embudo de creado a publicado como fuente automática, y DEBE abstenerse de leer textos, perfiles de voz o datos personales de clientes. · cubre G-6, G-10 · prueba: `product-source.test.ts`
- **CA-12** MIENTRAS no exista ninguna fuente de producto, el sistema DEBE mantener las etapas «Activa», «Publicó» y «De pago» como entrada manual (CA-5). · cubre G-6 · prueba: `product-source.test.ts`

### H-4: Como persona de Nokko, quiero mis tareas en mi calendario y mis reuniones ligadas a cuentas.
- **CA-13** El sistema DEBE permitir a cada persona conectar su propio calendario con una autorización limitada a crear eventos propios y leer sus reuniones, y DEBE impedir que otra persona use esa conexión. · cubre G-6, G-10 · prueba: `calendar.test.ts`
- **CA-14** DONDE el calendario esté conectado, el sistema DEBE crear en él un evento por cada tarea asignada a esa persona con fecha límite (SDD 1b, CA-31), y DEBE mantenerlo al día cuando la tarea cambie o se complete. · cubre G-6 · prueba: `calendar.test.ts`
- **CA-15** El sistema DEBE abstenerse de añadir invitados a los eventos que crea. · cubre G-10 · prueba: `calendar.test.ts`
- **CA-16** El sistema DEBE ligar las reuniones leídas del calendario a una cuenta por coincidencia del dominio de los asistentes, y DEBE guardar solo la hora, el título y los dominios de los asistentes. · cubre G-6, G-10 · prueba: `calendar.test.ts`
- **CA-17** CUANDO una persona desconecta su calendario, el sistema DEBE dejar de sincronizar al instante y DEBE ofrecer eliminar los eventos que creó. · cubre G-10 · prueba: `calendar.test.ts`

### H-5: Como persona de Nokko, quiero preparar seguimientos en mi correo sin que se envíe nada.
- **CA-18** El sistema DEBE permitir a cada persona conectar su propio correo y DEBE exponer a Nokko solo la operación de crear borradores, sin leer su buzón. · cubre G-6, G-10 · prueba: `mail-drafts.test.ts`
- **CA-19** El sistema DEBE abstenerse de enviar ningún correo desde esa conexión; lo que prepare queda como borrador en la cuenta de la persona. · cubre G-10 · prueba: `mail-drafts.test.ts`
- **CA-20** SI se intenta una operación distinta de crear un borrador con esa conexión, ENTONCES el sistema DEBE rechazarla. · cubre G-10 · prueba: `mail-drafts.test.ts`
- **CA-21** CUANDO una persona desconecta su correo, el sistema DEBE dejar de crear borradores y conservar los ya creados en su buzón. · cubre G-10 · prueba: `mail-drafts.test.ts`

### H-6: Como Owner o Sales leader, quiero llevar a Nokko las notas de una llamada sin nombres.
- **CA-22** El sistema DEBE permitir pegar o subir el resumen o las notas de una llamada y asociarlos a una ficha de conversación (SDD 3, CA-26), con una revisión antes de guardar. · cubre G-6, G-10 · prueba: `call-notes-import.test.ts`
- **CA-23** SI las notas traen campos de nombre de persona o de empresa, ENTONCES el sistema DEBE descartarlos antes de guardar y DEBE avisarlo en la revisión. · cubre G-10 · prueba: `call-notes-import.test.ts`

### H-7: Como persona de Nokko, quiero recibir los avisos por el canal que elija.
- **CA-24** El sistema DEBE enviar por email el resumen diario y el aviso del check-in semanal a cada persona según sus preferencias, respetando el silencio nocturno. · cubre G-7, G-10 · prueba: `notifications-channels.test.ts`
- **CA-25** DONDE Telegram esté conectado y la persona vinculada, el sistema DEBE enviarle por Telegram los avisos críticos (una puerta cercana o un desvío grave) al momento. · cubre G-7 · prueba: `notifications-channels.test.ts`
- **CA-26** SI Telegram no está conectado o la persona no lo vinculó, ENTONCES el sistema DEBE enviar los avisos críticos por email. · cubre G-7 · prueba: `notifications-channels.test.ts`
- **CA-27** El sistema DEBE enviar avisos solo a los miembros de la organización, y DEBE contarlos como avisos propios, no como acciones externas (PRD R-2). · cubre G-10 · prueba: `notifications-channels.test.ts`

### H-8: Como Owner, quiero que Drive, Sales Navigator y los proveedores se usen con control.
- **CA-28** El sistema DEBE crear, mover, renombrar o archivar en Drive solo tras la aprobación explícita de una persona. · cubre G-10 · prueba: `drive-approval.test.ts`
- **CA-29** El sistema DEBE permitir importar por CSV las listas exportadas a mano desde Sales Navigator (con la misma revisión previa que el SDD 2, CA-19), y DEBE evitar cualquier conexión automática con LinkedIn. · cubre G-6, G-10 · prueba: `sales-navigator-csv.test.ts`
- **CA-30** CUANDO una acción de investigación o enriquecimiento va a gastar crédito de un proveedor, el sistema DEBE mostrar su coste previo antes de ejecutarla, y DEBE ejecutar las acciones pesadas solo cuando una persona las confirme. · cubre G-6, G-10 · prueba: `provider-cost.test.ts`
- **CA-31** El sistema DEBE abstenerse de revelar o exportar datos de contacto con crédito de un proveedor sin aprobación explícita (PRD R-2). · cubre G-10 · prueba: `provider-cost.test.ts`
- **CA-32** DONDE se use Apify, el sistema DEBE limitarlo a fuentes que no sean LinkedIn (reseñas de G2 y páginas públicas). · cubre G-10 · prueba: `provider-cost.test.ts`
- **CA-33** El sistema DEBE mostrar el gasto en proveedores por proveedor y periodo y, cuando la acción nace de una iniciativa o tarea, por objetivo, sin bloquear ninguna acción. · cubre G-6 · prueba: `provider-cost.test.ts`

### H-9: Como Owner, quiero administrar las conexiones con seguridad.
- **CA-34** El sistema DEBE permitir solo al Owner conectar, cambiar y desconectar las integraciones de la organización, y a cada persona las suyas personales (calendario y correo); los demás roles y el Consejo DEBEN verlas solo como estado, sin credenciales. · cubre G-10 · prueba: `connection-permissions.test.ts`
- **CA-35** El sistema DEBE guardar toda credencial cifrada, devolver al navegador solo su estado y una pista, y DEBE abstenerse de escribirla en registros o en la auditoría. · cubre G-10 · prueba: `credentials.test.ts`
- **CA-36** CUANDO se desconecta una integración, el sistema DEBE dejar de usarla al instante y DEBE conservar lo ya importado. · cubre G-10 · prueba: `connection-permissions.test.ts`
- **CA-37** El sistema DEBE registrar en la auditoría (SDD 1a, CA-68) cada conexión, cambio y desconexión, con quién y cuándo. · cubre G-10 · prueba: `connection-permissions.test.ts`

### H-10: Como persona que usa un asistente, quiero consultar mi estrategia y dejar propuestas.
- **CA-38** El sistema DEBE ofrecer, a través del servidor para asistentes, la lectura de objetivos, resultados clave, iniciativas, tareas y su estado, limitada a lo que el rol de la persona autenticada puede ver. · cubre G-7, G-10 · prueba: `assistant-server.test.ts`
- **CA-39** El sistema DEBE permitir a un asistente dejar propuestas (borradores de tareas o de decisiones) que se guardan como pendientes y que no se aplican hasta que una persona las apruebe en Nokko. · cubre G-7, G-10 · prueba: `assistant-server.test.ts`
- **CA-40** El sistema DEBE abstenerse de crear, editar o borrar objetivos, resultados clave, tareas o decisiones directamente desde un asistente. · cubre G-10 · prueba: `assistant-server.test.ts`
- **CA-41** El sistema DEBE negar al rol Consejo el acceso a las cuentas, personas, fichas y conversaciones a través del servidor para asistentes (SDD 1a, CA-3). · cubre G-9, G-10 · prueba: `assistant-server.test.ts`

### H-11: Como Owner, quiero introducir las integraciones por fases sin romper lo anterior.
- **CA-42** MIENTRAS la fase esté activa para el rol de la persona, el sistema DEBE aplicar los criterios de este SDD; para los demás roles, o mientras la fase no esté activa, DEBE mantener las integraciones actuales sin cambios (PRD R-9; SDD 1a, CA-6). · cubre G-10 · prueba: `integrations-phase-guard.test.ts`
- **CA-43** El sistema DEBE mantener funcionando sin cambios las conexiones actuales de Drive, Apollo, Clay, Parallel, Perplexity, Firecrawl, PostHog y Stripe. · cubre G-10 · prueba: `integrations-phase-guard.test.ts`

## 8. Casos límite y errores
Cada caso remite al CA que lo cubre.
- Una fuente falla o no responde → último valor con antigüedad y «Sin dato reciente» (CA-2).
- Fuente sin conectar (por ejemplo, sin cobro en Postin) → entrada manual marcada (CA-5, CA-12).
- Clave de Stripe con permisos de escritura → rechazada con instrucciones (CA-7).
- Una definición de MRR que Stripe no puede cumplir → se muestra la diferencia (CA-8).
- Persona desconecta calendario o correo → deja de sincronizar y conserva o elimina según CA-17 y CA-21.
- Tarea sin fecha o completada → sin evento o evento actualizado (CA-14).
- Notas de llamada con nombres → se descartan y se avisa (CA-23).
- Telegram sin conectar → los críticos van por email (CA-26).
- Acción de proveedor con coste → coste previo y confirmación (CA-30).
- Operación de correo distinta de borrador → rechazada (CA-20).
- Asistente intenta escribir directamente → rechazado; solo propuestas (CA-40).
- Consejo intenta leer CRM por el asistente → denegado (CA-41).
- Otra organización → nunca ve estos datos (PRD R-10).

## 9. Experiencia y copy
Sistema visual actual (Ink + Lima, versalitas con filete, sin iconos), textos en «tú».
- **Estados de integración:** Conectada, Sin conectar, Error, Sin respuesta; el dato, Actual o Sin dato reciente.
- **Mensajes sugeridos** (a validar con la guía de voz de marca): «No hay dato reciente de Stripe: mostramos el último valor, de hace X días.» · «Esta clave puede escribir en tu cuenta. Crea una clave de solo lectura y vuelve a conectar.» · «Nokko solo crea borradores: tú decides cuándo enviarlos.»
- **Pantalla:** Conexiones agrupa las de la organización (solo Owner) y las personales; cada tarjeta muestra estado, última lectura y quién la conectó.

## 10. Datos, permisos y privacidad
- **Conceptos nuevos:** fuente automática de un resultado clave, conexión personal (calendario y correo), evento sincronizado de una tarea, reunión ligada a una cuenta (hora, título y dominios), propuesta de asistente, aviso por canal.
- **Matriz de permisos:**

| Acción | Owner | Sales leader | Consejo | Otros roles |
|---|---|---|---|---|
| Conectar, cambiar y desconectar integraciones de la organización | Sí | No | No | No |
| Conectar el calendario y el correo propios | Sí | Sí | No | Los roles que usan Nokko |
| Ver el estado de las integraciones | Sí | Sí | No | Solo estado |
| Sincronización manual de una fuente | Sí | No | No | No |
| Aprobar acciones de proveedor con coste | Sí | Sí | No | No |
| Ver el gasto por proveedor y objetivo | Sí | Sí | No | No |
| Usar el servidor para asistentes | Lo que su rol ve | Lo que su rol ve | Sin CRM (CA-41) | Lo que su rol ve |

- **Privacidad:** las credenciales nunca vuelven al navegador ni a los registros; del calendario solo hora, título y dominios; del correo solo la creación de borradores; ningún dato de clientes en pruebas ni ejemplos.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| ninguna en esta fase | — | — | — |

Los borradores de correo y las propuestas del asistente los redacta el agente del SDD 5; este SDD solo da la conexión y las operaciones permitidas.

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero [Sugerencia] | Depende de |
|---|---|---|---|---|
| U-1 | Administración de conexiones: permisos, credenciales cifradas, estado y auditoría | CA-1, CA-34 a CA-37 | `integration-status.test.ts`, `connection-permissions.test.ts`, `credentials.test.ts` | SDD 1a U-1 y U-7 |
| U-2 | Cadencia de sincronización, fallos y entrada manual | CA-2 a CA-5 | `integration-status.test.ts`, `sync-schedule.test.ts` | U-1, SDD 1a U-3 |
| U-3 | Stripe como fuente de resultados clave | CA-6 a CA-9 | `stripe-source.test.ts`, `credentials.test.ts` | U-2, SDD 3 U-1 |
| U-4 | Datos de producto: PostHog y vistas de la base de datos de Postin | CA-10 a CA-12 | `product-source.test.ts` | U-2, SDD 3 U-4, SDD-8 |
| U-5 | Calendario | CA-13 a CA-17 | `calendar.test.ts` | U-1, SDD 1b U-5 |
| U-6 | Correo (solo borradores) | CA-18 a CA-21 | `mail-drafts.test.ts` | U-1 |
| U-7 | Notas de llamadas | CA-22, CA-23 | `call-notes-import.test.ts` | SDD 3 U-6 |
| U-8 | Avisos por email y Telegram | CA-24 a CA-27 | `notifications-channels.test.ts` | U-1 |
| U-9 | Drive, Sales Navigator y proveedores con coste | CA-28 a CA-33 | `drive-approval.test.ts`, `sales-navigator-csv.test.ts`, `provider-cost.test.ts` | U-1, SDD 2 U-6 |
| U-10 | Servidor para asistentes | CA-38 a CA-41 | `assistant-server.test.ts` | U-1, SDD 1a U-7, Lovable C |
| U-11 | Guardia de fase y conexiones actuales | CA-42, CA-43 | `integrations-phase-guard.test.ts` | U-1 |

**Orden:** U-1, U-2, U-3, U-4, U-5, U-6, U-7, U-8, U-9, U-10, U-11. Cada unidad añade a su prueba un caso de guardia de fase (CA-42) para sus criterios.

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- **Reutilizar:** el registro de proveedores (`src/lib/connections.ts`: «un proveedor nuevo es una entrada más»), la conexión de cuentas propias (`src/lib/connections-core.ts`, que declara que falta el almacén cifrado; `src/lib/secret-box.server.ts` ya cifra con AES-GCM), Stripe (`src/lib/stripe.functions.ts`, `stripe_snapshots`), PostHog (`src/lib/posthog-sync.server.ts`, cada 6 horas: ya es más frecuente que CA-3), el correo diario (`src/lib/daily-email.server.ts`), Telegram (`src/lib/telegram.server.ts`, `channel_links`), `integration_usage` y `org_budgets` para el gasto, y `agent_pending_actions` para las propuestas.
- **Stripe:** `stripe_connections` tiene `restricted` y `livemode`; comprobar si hoy se rechaza una clave con permisos de escritura [Por verificar]; la foto trae MRR, clientes activos y bajas, pero no se sabe cómo calcula el MRR frente a la definición del diccionario (CA-8).
- **Calendar y Gmail son nuevos.** Usar la autorización de Drive como patrón. El alcance de Gmail que permite crear borradores también permite enviar: la garantía de «solo borradores» (CA-18 a CA-20) debe estar en la capa de Nokko, exponiendo únicamente la operación de crear borradores, y requerirá la verificación de la aplicación del proveedor [Por verificar].
- **Servidor para asistentes:** `/mcp` lo genera el plugin de Lovable (`src/routes/mcp.ts`, banner «AUTO-GENERATED») y se reescribe en el SDD de salida C; este SDD añade herramientas de lectura y propuesta sobre ese servidor. El Consejo no entra en `org_members` (SDD 1a, §13): el servidor debe negarle el CRM (CA-41).
- **Lovable B:** su CA-11 a CA-14 ya mueve el correo, los proveedores y la IA a claves propias; este SDD no los duplica.
- **Apify:** no figura en el registro de proveedores; si se mantiene para reseñas de G2 (CA-32), registrarlo.
- Migraciones aditivas con organización por defecto; las 0058 y 0059 siguen sin aplicar (`src/lib/AGENTS.md`).
- Alternativa descartada: un almacén gestionado de credenciales (retrasa las integraciones y depende de Dani; evolución futura).

## 14. Riesgos y dependencias
- Depende de que los SDD de salida de Lovable A, B y C estén cerrados para construir; B y este SDD tocan los mismos proveedores.
- Depende del SDD-8 (vistas de la base de datos de Postin) para la activación automática; hasta entonces, entrada manual.
- Calendar y Gmail son integraciones nuevas con verificación de la aplicación por el proveedor y alcances que pueden ser más amplios que el uso permitido; el compromiso «solo borradores» se garantiza en la capa de Nokko, no por el alcance.
- El almacén cifrado de credenciales de cuentas propias sigue sin existir; se reutiliza el cifrado actual y rotar la clave obliga a reconectar todo.
- Un fallo de Stripe, de producto o de proveedor deja resultados clave en «Sin dato reciente»; el avance depende de que se restablezca.
- Un asistente con lectura de la estrategia puede exponer datos a clientes de terceros según su configuración; la lectura se limita al rol de la persona autenticada.

## 15. Preguntas para Fede y para la revisión técnica
- Fede: ¿se acepta la entrada manual de «Activa» y «Publicó» hasta que Dani entregue el SDD-8?
- Fede: ¿qué herramienta de transcripciones usas (CA-22 solo cubre pegar o subir notas)?
- Revisión técnica: ¿qué alcance mínimo de Gmail y de Calendar permite la verificación de la aplicación, y cómo se garantiza que Nokko solo exponga crear borradores?
- Revisión técnica: ¿Stripe rechaza hoy claves con permisos de escritura, y cómo calcula el MRR que guarda?
- Revisión técnica: ¿cómo se convive con el SDD de salida C si `/mcp` se reescribe?

## 16. Pendiente de verificar
- Existencia de billing y de Stripe en Postin, y de eventos de producto → Dani.
- Si el servidor MCP de Postin expone métricas agregadas o solo la cuenta del usuario (el SDD-8 lo decide) → Dani.
- Comportamiento actual de Stripe ante claves de escritura y cálculo del MRR (CA-7 y CA-8) → gate.
- Alcance mínimo y verificación de Calendar y Gmail → gate / proveedor.
- Herramienta de transcripciones de llamadas → Fede.
- Reparto con `connections-bring-your-own-account` (En curso) y con los SDD de salida B y C → gate.
- Uso real de las integraciones actuales → datos de producción.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Pendiente: el gate se lanza sobre este SDD en Borrador y su informe se copia aquí sin editar.

## 18. Delta de implementación (lo rellena el agente al entregar)
Sin entrega todavía.
