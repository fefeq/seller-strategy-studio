# SDD-20261030-gtm-control-tower-4a-data-sources · [Feature] Fuentes de datos de la torre de control: Stripe, producto, proveedores y estado de las conexiones (fase 4a)

**Tipo:** Feature · **Prioridad propuesta:** Alta
**Estado:** Aprobado por Fede el 2026-10-31 (v9, tras ocho pasadas del gate; sin una novena pasada sobre esta versión; con los riesgos declarados del §14), con enmienda del 2026-10-31 que añade Exa y FullEnrich como proveedores (CA-32 y CA-33, sin pasada del gate); se construye partido (D-2, decisión de Fede del 2026-11-06): U-1 a U-4 antes del SDD 8, y la U-5 la cierra el SDD 8 · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-10-31
**PRD:** `docs/prd/PRD-20261030-gtm-control-tower.md` · **Depende de:** SDD 1a (resultados clave, auditoría y activación por rol: U-0, U-1, U-3 y U-7; este SDD modifica su CA-17, que limitaba la fuente a manual en esa fase, y toca sus CA-22, CA-23 y CA-24 con dos estados nuevos del resultado clave), SDD 1b (iniciativas y tareas, de las que nace el gasto por objetivo: U-5), SDD 3 (diccionario de métricas y etapas de embudo: U-1, U-4 y U-5), SDD 2 (importación CSV, U-6), el SDD-8 para Dani (vistas agregadas de la base de datos de Postin, pendiente de redactar; solo para CA-10) y los SDD de salida de Lovable A y B para construir · **Coordinar con:** `SDD-20261025-connections-bring-your-own-account` (En curso: U-1 y U-2 entregadas sin proveedores habilitados; ya fija que solo el Owner gestiona conexiones, que la credencial no vuelve al navegador y que desconectar conserva lo importado), `SDD-20261025-drive-per-company-account` (Aprobado), `SDD-20261029-lovable-exit-b-servicios-y-corte` (CA-11 a CA-14: claves propias de correo, proveedores e IA) y `SDD-20261030-money-moment-notices` (Borrador, avisos) · **Continúa en:** `SDD-20261030-gtm-control-tower-4b-personal-tools-assistants.md`

> Un SDD dice cómo se verifica que está bien hecho. Cada criterio de aceptación (CA-n) debe poder tener una prueba automática que lo nombre.
> Los criterios no nombran tecnología; lo técnico va en el §13 como [Sugerencia — la revisión del gate las valida].
> La numeración de criterios se conserva de la versión anterior; los criterios retirados (CA-4, CA-5, CA-11 y CA-12, que ya se cumplen o duplican otros SDD) no se reutilizan; los nuevos (CA-22 en H-2, CA-21 en H-4, CA-23 a CA-31 y, por la enmienda del 2026-10-31, CA-32 y CA-33 tras CA-17 en H-4) se añadieron después y no siguen el orden numérico dentro de su historia.
> Las reglas transversales del PRD (§6.2, R-1 a R-10) aplican a todo este SDD. «Organización» es la empresa que usa Nokko; «cuenta» es una empresa prospecto o cliente. Las lecturas de LinkedIn por extracción automática se retiran en el SDD 1a (U-0): este SDD no las reintroduce.
> **Enmienda aprobada (2026-11-02)** por `SDD-20261031-gtm-control-tower-8-postin-views-nokko`: CA-10 y CA-31 y la unidad U-5 se sustituyen por los criterios de ese SDD (la fuente de «Activa» y «Publicó» pasa a ser el total agregado por periodo, no la fecha por recorrido), y CA-3 y CA-9 se leen con su cuadro de ediciones (§6). La prueba `postin-views.test.ts` se retira.

## 1. Resumen
Hace que los resultados clave de negocio puedan alimentarse de datos reales: **Stripe** (MRR, clientes y churn) y **datos de producto** (PostHog y, cuando existan, las vistas agregadas de la base de datos de Postin). Define cómo se muestra el estado de cada conexión, la cadencia de sincronización, qué se ve cuando una fuente falla y cómo se controlan los costes de los proveedores, la importación de Sales Navigator por CSV y los proveedores de investigación y enriquecimiento. Reutiliza las conexiones que ya existen; no crea integraciones nuevas con terceros (Calendar y Gmail van en el SDD 4b; los avisos y los asistentes, en el SDD 5).

## 2. Problema y para quién
Hoy los resultados clave de ingresos y activación solo pueden entrar a mano, y cuando una fuente automática falla no hay una regla común de qué se muestra. Para Fede (Owner) y Flor (Sales leader).

## 3. Evidencia y por qué ahora
- **Código (repo de Nokko, solo lectura, 2026-10-30):**
  - El registro de proveedores tiene ocho entradas: Google Drive, Apollo, Clay, Parallel, Perplexity, Firecrawl, PostHog y Stripe (`src/lib/connections.ts`); Apify se usa pero no figura en el registro (`src/lib/apify-gateway.ts`). Exa y FullEnrich no existen en el código ni en los SDD; los añade la enmienda del 2026-10-31 (decisión de Fede, a partir de la lista de herramientas de gtmstrategist.com/tools).
  - Stripe ya existe y **ya se sincroniza solo cada 6 horas** desde el trabajo horario (`src/lib/stripe/sync.server.ts`, `src/lib/inngest/tasks.server.ts`); la sincronización manual la permiten Owner y Sales leader con un mínimo de 2 minutos entre lanzamientos (`src/lib/stripe.functions.ts`). Guarda una foto con MRR, clientes activos, bajas y churn (`stripe_snapshots`).
  - **La clave de Stripe solo se valida por prefijo:** se rechaza una clave secreta completa y se acepta cualquier clave restringida; no hay comprobación de que sea de solo lectura (`src/lib/stripe/metrics.ts`). La clave se guarda en el almacén seguro de la base de datos, no con `secret-box` (`src/lib/stripe.functions.ts`).
  - El MRR actual de Stripe cuenta suscripciones activas y con pago pendiente, aplica descuentos recurrentes y deja sin valorar los precios por tramos o medidos (`src/lib/stripe/metrics.ts`).
  - PostHog ya existe y sincroniza las pruebas cada 6 horas (`src/lib/posthog-sync.server.ts`, `SYNC_EVERY_HOURS`).
  - Solo el Owner gestiona conexiones (`canManage`, `src/lib/connections.ts`), y el almacén cifrado de credenciales de cuentas propias «no existe hasta que Dani lo diseñe» (`src/lib/connections-core.ts`).
  - Drive va hoy por la pasarela de Lovable, no por una autorización propia de la persona (`src/lib/google-drive.ts`).
  - `last_synced_at` se escribe también cuando la sincronización falla y antes de leer (`src/lib/stripe/sync.server.ts`, `src/lib/inngest/tasks.server.ts`), y la lectura de PostHog borra `product_usage` antes de insertar (`src/lib/posthog-sync.server.ts`): ninguno sirve hoy para «última lectura correcta» ni para conservar el último valor.
  - `stripe_snapshots` solo lo leen Owner, Sales leader y deal desk (`drizzle/migrations/0027_*.sql`); «clientes de pago» cuenta hoy también suscripciones a 0 (`src/lib/stripe/metrics.ts`).
  - La pantalla de entrada de leads recomienda herramientas de automatización de LinkedIn de terceros (`src/routes/_authenticated/leads.entrada.tsx`), en tensión con PRD R-5.
  - Hay uso y presupuesto de integraciones (`integration_usage`, `org_budgets`), y el planificador pausa las acciones automáticas al llegar al 100 % del presupuesto (`src/lib/orchestrator/planner.ts`).
  - **Existen y este SDD no cambia:** el proveedor de correo, el trabajo en segundo plano, la API pública de leads y de cuentas con sus fuentes, el webhook de Telegram, las reuniones y sus notas (`meetings`), Jev y el proveedor de IA.
- **Postin Core (Drive, solo lectura):** F0-11 v1.2 (LinkedIn solo por API oficial y sin herramientas de terceros; Sales Navigator a mano).
- **Entrevista con Fede (2026-10-29/30):** alcance y uso de cada integración (PRD §6.1).
- Uso real de las integraciones actuales: **sin dato** [Por verificar].

## 4. Resultado buscado
- Los resultados clave de ingresos y activación se alimentan de una fuente automática cuando existe (G-6 del PRD). Medición: proporción de resultados clave con fuente automática. Línea base: sin dato.
- Ninguna fuente sin estado visible ni antigüedad del dato.
- La enmienda del 2026-10-31 no cambia la medición: Exa y FullEnrich son proveedores de investigación y enriquecimiento.

## 5. Alcance
**Incluye:** H-1 a H-5.
**No incluye:**
- Calendario, correo y notas de llamadas (SDD 4b); avisos y servidor para asistentes (SDD 5).
- El disparo de la lectura previa al check-in semanal y el contenido del check-in (SDD 5).
- La creación de las vistas de la base de datos de Postin (SDD-8, para Dani) y cambios en Stripe o en el producto de Postin.
- Lectura de LinkedIn por extracción automática (SDD 1a, U-0).
- Cambiar la pausa de las acciones automáticas al llegar al 100 % del presupuesto (se mantiene, decisión de Fede, 2026-10-30).
- Un almacén gestionado de credenciales (evolución futura) y la unificación de los dos almacenes actuales.
- Sincronización con herramientas externas de tareas.

## 6. Cambios de comportamiento (delta)
**Añadido:** fuentes automáticas de resultados clave (Stripe, producto); estado y antigüedad de cada fuente; regla común de fallo («Sin dato reciente»); verificación de que una clave de Stripe solo se usa para leer; gasto visible por proveedor; auditoría de conexiones.
**Modificado:** los resultados clave pueden elegir una fuente automática (modifica SDD 1a, CA-17, que limitaba la fuente a manual en esa fase; y añade a 1a CA-22, CA-23 y CA-24 y a 1b CA-57 los estados «Sin valorar» y «Sin fuente conectada»); Apify entra en el registro de proveedores; las acciones con coste muestran su coste previo junto al botón.
**Eliminado:** nada. Las conexiones y datos importados se conservan; sigue como hoy que desconectar PostHog borra `product_usage` (CA-26 no lo cambia, riesgo en §14).

## 7. Historias y criterios de aceptación
Cada CA cita el objetivo G-n del PRD que cubre y el archivo de prueba (ruta por decidir en la implementación [Sugerencia]).

### H-1: Como Owner, quiero ver el estado de cada fuente y qué pasa cuando falla.
- **CA-1** El sistema DEBE mostrar, por cada integración conectada, los estados de conexión que ya existen en Nokko, la fecha de la última lectura correcta (distinta de la última lectura intentada; en las integraciones sin lectura programada, la de la última acción correcta) y quién la conectó. · cubre G-6 · prueba: `integration-status.test.ts`
- **CA-2** CUANDO una lectura falla, el sistema DEBE conservar el último valor correcto y mostrarlo con su antigüedad; SI pasa más del doble del intervalo de lectura (SDD 1a, CA-24) desde la última lectura correcta (la de CA-1), ENTONCES el sistema DEBE dejar el resultado clave en «Sin dato reciente», mostrar un indicador visible en la ficha del resultado clave (SDD 1a, CA-86) y en la pantalla de Conexiones (el aviso por email o Telegram lo define el SDD 5) y abstenerse de inventar un valor. · cubre G-6, G-10 · prueba: `integration-failure.test.ts`
- **CA-3** El sistema DEBE sincronizar cada fuente automática con una cadencia no menos frecuente que la actual (el disparo previo al check-in lo define el SDD 5). · cubre G-6 · prueba: `sync-schedule.test.ts`
- **CA-25** CUANDO el Owner o el Sales leader escribe un valor a mano en un resultado clave con fuente automática, el sistema DEBE guardarlo como valor manual con su autor y fecha, DEBE mantener la fuente, y DEBE dejar que la siguiente lectura correcta lo reemplace, conservando ambos en el historial con su origen (automático o manual); el cambio de fuente de CA-29 no es una escritura de valor manual y sigue las reglas de edición del SDD 1a (CA-52). · cubre G-6, G-10 · prueba: `automatic-source.test.ts`
- **CA-26** CUANDO una persona desconecta una fuente, el sistema DEBE dejar los resultados clave que la usan en el estado «Sin fuente conectada»: conservan la fuente y su historial, admiten valor manual (CA-25) y vuelven solos a automático al reconectar; SI el proveedor la revoca (CA-2), ENTONCES DEBE tratarlo como fallo de lectura y NO como desconexión. El sistema NO DEBE cambiar por sí mismo la fuente de un resultado clave, ni siquiera de un objetivo ratificado, y NO DEBE hacer retroceder una etapa ya alcanzada (SDD 3, CA-13) cuando se desconecta PostHog. · cubre G-6, G-10 · prueba: `automatic-source.test.ts`
- **CA-30** CUANDO un resultado clave esté en «Sin valorar» o «Sin fuente conectada», el sistema DEBE calcular su estado con el valor manual vigente (el escrito después de la última lectura correcta, marcado «Manual»; SDD 1a, CA-22 y CA-23) y, si no hay ninguno, dejarlo en «Sin dato» (SDD 1a, CA-22); en «Sin dato reciente» DEBE mantener lo que define el SDD 1a (CA-24) con el último valor conservado (CA-2), y un valor manual vigente lo levanta hasta la siguiente lectura correcta; una lectura «Sin valorar» o fallida NO DEBE reemplazar un valor manual. DEBE mostrar esos estados con esas palabras en la tarjeta y la ficha del resultado clave (SDD 1b, CA-55 y CA-57; SDD 1a, CA-86). · cubre G-6 · prueba: `automatic-source.test.ts`

### H-2: Como Owner, quiero que Stripe alimente mis resultados clave de ingresos.
- **CA-6** MIENTRAS la fase esté activa para el rol de la persona y Stripe esté conectado, el sistema DEBE traer el MRR normalizado (SDD 3, CA-18) y DEBE ofrecerlo como fuente automática al crear un resultado clave (SDD 1a, CA-17) y al cambiarle la fuente (CA-29); los clientes de pago (suscripciones con importe mayor que cero) y el churn DEBEN mostrarse solo en la pantalla de Conexiones como datos de la fuente, con la etiqueta «Sin definición» (SDD 3, CA-20), sin ser métricas de la torre, hasta que el diccionario de métricas (SDD 3) los defina. · cubre G-6 · prueba: `stripe-source.test.ts`
- **CA-7** El sistema DEBE aceptar al conectar solo claves restringidas de Stripe, DEBE mostrar los permisos de lectura que necesita, DEBE usar con esa conexión únicamente operaciones de lectura, sin ninguna operación de escritura en Stripe, y NO DEBE ofrecer como fuente de un resultado clave una clave de prueba; las conexiones de prueba ya existentes siguen funcionando sin cambios (CA-20). · cubre G-6, G-10 · prueba: `stripe-source.test.ts`
- **CA-8** El sistema DEBE calcular el MRR de un resultado clave con la definición «MRR normalizado» del diccionario (SDD 3, CA-18), aplicando los descuentos recurrentes y excluyendo las suscripciones con pago pendiente o fallido (decisión de Fede, 2026-10-30), solo en la moneda de la organización (las demás se excluyen y se informa de ello), y DEBE mostrar junto al valor la diferencia, en importe, entre el MRR actual de Nokko (que cuenta también las de pago pendiente) y el MRR normalizado, calculada sobre las suscripciones valorables. · cubre G-6, G-10 · prueba: `stripe-source.test.ts`
- **CA-28** SI hay suscripciones que el sistema no puede valorar (precios por tramos o medidos, o más ítems de los que la lectura trae), ENTONCES DEBE poner el resultado clave en el estado «Sin valorar»: conserva la fuente, admite valor manual (CA-25), se reevalúa en cada lectura y vuelve solo a automático cuando todas se pueden valorar, indicando cuántas suscripciones afecta; SI la lectura de Stripe quedó incompleta (páginas o ítems sin leer), ENTONCES DEBE tratarla como lectura fallida (CA-2) y NO DEBE mostrarla como cifra exacta. SI Stripe no tiene suscripciones, ENTONCES DEBE mostrar 0, no «Sin dato». · cubre G-6, G-10 · prueba: `stripe-source.test.ts`
- **CA-29** El sistema DEBE permitir al Owner y al Sales leader cambiar la fuente de un resultado clave existente entre entrada manual y las fuentes automáticas ofrecidas, conservando el historial con el origen de cada valor; ese cambio es una edición del objetivo y, en uno ratificado, DEBE seguir las reglas del SDD 1a (CA-52), que solo exime los valores manuales. · cubre G-6, G-10 · prueba: `automatic-source.test.ts`
- **CA-22** El sistema DEBE mostrar el valor de un resultado clave alimentado por Stripe a cualquier rol que pueda ver ese resultado clave (SDD 1a), aunque la foto de Stripe sea hoy más restringida; es un desvío decidido por Fede el 2026-10-30. · cubre G-6, G-10 · prueba: `stripe-source.test.ts`

### H-3: Como Owner, quiero datos de uso de producto para medir la activación.
- **CA-9** El sistema DEBE permitir al Owner asignar eventos de producto de las pruebas conectadas a la etapa «De pago» (SDD 3, CA-14), DEBE dar la etapa por alcanzada en un recorrido cuando han ocurrido todos los eventos asignados, con la fecha del último, y DEBE mantener «Activa» y «Publicó» como entrada manual (SDD 3, CA-15) hasta que exista la fuente de CA-10, su única fuente automática (decisión de Fede, 2026-10-30). El evento de pago ya configurado se conserva como asignación inicial y, mientras el Owner no la confirme, la etapa sigue siendo manual; el evento de activación configurado no se usa. Los eventos de varias pruebas de un mismo recorrido cuentan juntos, y reasignar eventos no hace retroceder una etapa ya alcanzada. La fecha de entrada a una etapa es la más antigua entre la automática y cualquier entrada manual de etapa, y una etapa alcanzada no retrocede (SDD 3, CA-13). · cubre G-6 · prueba: `product-source.test.ts`
- **CA-23** DONDE la etapa «De pago» tenga fuente automática (CA-9), el sistema DEBE ofrecer como fuente automática de un resultado clave el número total de recorridos que han alcanzado esa etapa por cualquier vía (evento automático o entrada manual de etapa, cada recorrido una sola vez) entre la fecha de inicio y la de meta del resultado clave, ambas inclusive y en la zona horaria de la organización, según la fecha de entrada a la etapa (SDD 3, CA-22 y CA-37), incluidos los «Sin atribuir», de modo que una prueba sin vincular cuente como su propio recorrido; el desglose por canal sigue excluyendo los «Sin atribuir» (SDD 3, CA-6). SI la lectura de producto quedó incompleta, ENTONCES DEBE tratarla como lectura fallida (CA-2) y NO DEBE mostrarla como cifra exacta. · cubre G-6 · prueba: `product-source.test.ts`
- **CA-24** El sistema DEBE separar los datos de cada organización en las conexiones, lecturas y valores de las fuentes: una organización NO DEBE ver ni usar las conexiones, lecturas o valores de otra (PRD R-10). · cubre G-10 · prueba: `org-isolation.test.ts`
- **CA-10** DONDE exista la credencial de solo lectura de las vistas agregadas de la base de datos de Postin, cuyo contrato y almacenamiento fija el SDD-8, el sistema DEBE traer de ellas los datos de las etapas «Activa» y «Publicó» del diccionario (SDD 3, CA-18) como fuente automática; una entrada manual de etapa no suma de nuevo si el recorrido ya tiene dato automático, se conserva en el historial y no cambia la fecha de entrada más antigua (SDD 3, CA-13); y DEBE abstenerse de leer textos, perfiles de voz o datos personales de clientes. · cubre G-6, G-10 · prueba: `postin-views.test.ts`
- **CA-31** DONDE las etapas «Activa» o «Publicó» tengan fuente automática (CA-10), el sistema DEBE ofrecerla como fuente automática de un resultado clave con los mismos criterios de recorridos, periodo y «Sin atribuir» que CA-23. · cubre G-6 · prueba: `postin-views.test.ts`

### H-4: Como Owner, quiero usar Sales Navigator y los proveedores con control.
- **CA-13** El sistema DEBE permitir importar por CSV las listas de cuentas exportadas a mano desde Sales Navigator, mapeando las columnas de cuenta (nombre de la empresa, dominio o sitio web, sector y tamaño) a la importación de cuentas del SDD 2 (CA-19), descartando las columnas de persona y evitando cualquier conexión automática con LinkedIn; DEBE rechazar con un aviso un CSV vacío o con solo columnas de persona. · cubre G-6, G-10 · prueba: `sales-navigator-csv.test.ts`
- **CA-14** CUANDO una persona va a lanzar una acción de investigación o enriquecimiento que gasta crédito de un proveedor (revelar contactos con Apollo, enriquecer con Clay, buscar con Parallel, Perplexity, Firecrawl o Exa, enriquecer o revelar contactos con FullEnrich, o lanzar una ejecución de Apify), el sistema DEBE mostrar su coste previo estimado junto a la acción antes de ejecutarla, o «sin dato» si el proveedor no permite estimarlo, y el pulsado de esa acción es la aprobación humana (PRD R-2); no añade ninguna confirmación nueva. · cubre G-6, G-10 · prueba: `provider-cost.test.ts`
- **CA-15** El sistema DEBE abstenerse de revelar o exportar datos de contacto con crédito de un proveedor sin aprobación explícita de una persona (PRD R-2), por la pantalla, el agente, Telegram, el servidor para asistentes o un trabajo automático. · cubre G-10 · prueba: `provider-cost.test.ts`
- **CA-16** El sistema DEBE mostrar el gasto en proveedores por proveedor y por periodo, y por objetivo cuando la acción se asoció a una iniciativa (CA-27), sin añadir ningún bloqueo nuevo. · cubre G-6 · prueba: `provider-cost.test.ts`
- **CA-17** El sistema DEBE incluir Apify en el registro de proveedores con su estado de conexión, descrito solo con los usos que mantiene el SDD 1a (U-0), sin mencionar LinkedIn. · cubre G-6 · prueba: `integration-status.test.ts`
- **CA-32** (enmienda) El sistema DEBE incluir Exa y FullEnrich en el registro de proveedores con la credencial propia de la organización, su estado de conexión, su última lectura correcta y su auditoría, como los demás proveedores, sin devolver la credencial al navegador. · cubre G-6, G-10 · prueba: `integration-status.test.ts`
- **CA-33** (enmienda) El sistema DEBE usar Exa solo para buscar en fuentes públicas que no sean LinkedIn, DEBE usar FullEnrich solo con el nombre y la empresa o el dominio de la persona, sin enviar URLs de perfiles de LinkedIn como dato de entrada (PRD R-5), y DEBE exigir la aprobación explícita de CA-15 antes de revelar contactos con FullEnrich (PRD R-2). · cubre G-6, G-10 · prueba: `provider-cost.test.ts`
- **CA-27** CUANDO una persona lanza una acción de proveedor con coste, el sistema DEBE permitirle elegir opcionalmente la iniciativa a la que sirve (SDD 1b, U-5) y guardarla con el gasto; SI no elige ninguna, o la acción la lanza el agente, Telegram o un trabajo automático, ENTONCES DEBE contar el gasto como «Sin objetivo». Lo ven quienes ven hoy el gasto en proveedores. · cubre G-6 · prueba: `provider-cost.test.ts`
- **CA-21** MIENTRAS la fase esté activa para el rol de la persona y la pantalla de entrada de leads mencione herramientas externas que automatizan LinkedIn, el sistema DEBE advertir que automatizar LinkedIn incumple la regla de API oficial y que Nokko no usa esas herramientas (decisión de Fede, 2026-10-30). · cubre G-10 · prueba: `leads-entry-warning.test.ts`

### H-5: Como Owner, quiero auditar las conexiones y introducir los cambios por fases.
- **CA-18** El sistema DEBE registrar en la auditoría (SDD 1a, CA-68) cada conexión, cambio y desconexión de una integración, con quién y cuándo, y DEBE abstenerse de guardar en ella credenciales. · cubre G-10 · prueba: `connection-audit.test.ts`
- **CA-19** MIENTRAS la fase esté activa para el rol de la persona, el sistema DEBE aplicar los criterios de este SDD; para los demás roles, o mientras la fase no esté activa, DEBE mantener las integraciones actuales sin cambios (PRD R-9; SDD 1a, CA-6). · cubre G-10 · prueba: `integrations-phase-guard.test.ts`
- **CA-20** El sistema DEBE mantener funcionando sin cambios las conexiones actuales de Drive, Apollo, Clay, Parallel, Perplexity, Firecrawl, PostHog y Stripe. · cubre G-10 · prueba: `integrations-phase-guard.test.ts`

## 8. Casos límite y errores
Cada caso remite al CA que lo cubre.
- Una fuente falla o no responde → último valor con antigüedad y «Sin dato reciente» (CA-2).
- Fuente sin conectar (por ejemplo, sin cobro en Postin) → entrada manual marcada (SDD 1a, CA-19; SDD 3, CA-15).
- Clave de Stripe no restringida → rechazada con instrucciones (CA-7).
- Una definición de MRR que Stripe no puede cumplir (precios por tramos o medidos), lectura incompleta o sin suscripciones → entrada manual, «Sin dato reciente» o 0, nunca una cifra exacta falsa (CA-8, CA-28).
- Valor escrito a mano o cambio o pérdida de la fuente de un resultado clave → historial con origen (CA-25, CA-26, CA-29).
- Resultado clave «Sin valorar» o «Sin fuente conectada» → estado con el valor manual vigente o «Sin dato» (CA-30).
- Resultado clave automático antes de su primera lectura → «Sin dato» hasta la primera lectura correcta (CA-30).
- CSV de Sales Navigator vacío o solo con personas → rechazado con aviso (CA-13).
- Acción de proveedor con coste → coste previo junto a la acción (CA-14) y gasto sin objetivo contado aparte (CA-27).
- Revelar contactos sin aprobación → rechazado (CA-15).
- Persona sin la fase activa → integraciones como hoy (CA-19).
- Otra organización → nunca ve estos datos (CA-24).

## 9. Experiencia y copy
Sistema visual actual (Ink + Lima, versalitas con filete, sin iconos), textos en «tú».
- **Estados de resultado clave nuevos:** «Sin valorar» y «Sin fuente conectada» (CA-26, CA-28, CA-30).
- **Estados de conexión:** los existentes (Cuenta propia, Proporcionada por NOKKO, Sin conectar, Error, Sin respuesta, Solo proporcionada por NOKKO); del dato, Actual o Sin dato reciente.
- **Mensajes sugeridos** (a validar con la guía de voz de marca): «Sin valorar: hay suscripciones de Stripe con precios por tramos o medidos que Nokko no puede valorar. Escribe el valor a mano o revisa los precios.» · «Sin fuente conectada: vuelve a conectar la fuente para que se actualice sola.» · «No hay dato reciente de Stripe: mostramos el último valor, de hace X días. Revisa la conexión en Conexiones.» · «Conecta una clave restringida de Stripe con permisos de lectura. Nokko nunca escribe en tu cuenta.»

## 10. Datos, permisos y privacidad
- **Conceptos nuevos:** fuente automática de un resultado clave con su historial de valores y origen, asignación de eventos de producto a etapas, última lectura correcta de cada integración, y objetivo asociado al gasto de un proveedor. Cada tabla o columna nueva lleva organización por defecto la actual, acceso filtrado por organización y permisos explícitos [Sugerencia — el gate valida].
- **Matriz de permisos** («Solo estado» es el estado de conexión sin credenciales ni lecturas):

| Acción | Owner | Sales leader | Consejo | Otros roles |
|---|---|---|---|---|
| Conectar, cambiar y desconectar integraciones de la organización | Sí | No | No | No |
| Sincronización manual de una fuente | Sí | Sí | No | No |
| Ver el estado de las integraciones | Sí | Sí | No | Solo estado |
| Lanzar acciones de proveedor con coste | Como hoy | Como hoy | No | Como hoy |
| Ver el gasto por proveedor y por objetivo | Como hoy | Como hoy | No | Como hoy |
| Ver el valor de un resultado clave alimentado por Stripe | Sí | Sí | Sí | Sí (los roles que ven el resultado clave) |

- **Privacidad:** las credenciales nunca vuelven al navegador ni a los registros (ya garantizado por `connections-bring-your-own-account`); de las vistas de Postin solo se leen datos agregados (CA-10; la lectura actual de PostHog trae a las pruebas el correo y el identificador de cada persona); ningún dato de clientes en pruebas ni ejemplos.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| ninguna en esta fase | — | — | — |

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero [Sugerencia] | Depende de |
|---|---|---|---|---|
| U-1 | Extender `connections-bring-your-own-account` (U-1 y U-2) con Stripe, PostHog, Apify, Exa y FullEnrich: estado, última lectura correcta y auditoría; la guardia de fase y las pruebas de aislamiento entre organizaciones | CA-1, CA-17, CA-32, CA-18, CA-19, CA-24 | `integration-status.test.ts`, `connection-audit.test.ts`, `integrations-phase-guard.test.ts`, `org-isolation.test.ts` | SDD 1a U-0, U-1 y U-7 |
| U-2 | Fallos, cadencia de lectura y ciclo de vida de un valor automático (con una fuente de prueba hasta que U-3 y U-4 aporten las reales) | CA-2, CA-3, CA-25, CA-26, CA-29, CA-30 | `integration-failure.test.ts`, `sync-schedule.test.ts`, `automatic-source.test.ts` | U-1, SDD 1a U-3 y U-7 (ficha del resultado clave, CA-86; SDD 1b U-8, tarjeta del resultado clave) |
| U-3 | Stripe como fuente de resultados clave | CA-6 a CA-8, CA-22, CA-28 | `stripe-source.test.ts` | U-2, SDD 3 U-1 |
| U-4 | Eventos de producto asignados a etapas y como fuente de resultados clave | CA-9, CA-23 | `product-source.test.ts` | U-2, SDD 3 U-4 y U-5 |
| U-5 | Vistas agregadas de la base de datos de Postin (diferida hasta que exista el SDD-8) | CA-10, CA-31 | `postin-views.test.ts` | U-4, SDD-8 |
| U-6 | Sales Navigator y advertencia de entrada de leads | CA-13, CA-21 | `sales-navigator-csv.test.ts`, `leads-entry-warning.test.ts` | U-1, SDD 2 U-6 |
| U-7 | Regresión de las conexiones actuales | CA-20 | `integrations-phase-guard.test.ts` | U-1 |
| U-8 | Proveedores con coste: coste previo, aprobación y gasto por objetivo | CA-14 a CA-16, CA-27, CA-33 | `provider-cost.test.ts` | U-1, SDD 1b U-5 |

**Orden:** U-1, U-2, U-3, U-4, U-6, U-8, U-7, U-5 (U-5 espera al SDD-8). La guardia de fase (CA-19) y el aislamiento entre organizaciones (CA-24) se construyen en U-1 con su prueba, que falla primero, y cada unidad posterior añade a la suya un caso de guardia y uno de aislamiento para los datos que crea; U-7 solo conserva la regresión de las conexiones actuales (CA-20), que ya se cumplen.

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- **Reparto con BYO:** CA-1 reutiliza BYO CA-2, CA-18 reutiliza BYO CA-10 (tabla de eventos de conexión, en la migración 0059 sin aplicar) y CA-16 amplía BYO CA-12; las partes ya cumplidas (CA-3 con 6 h, CA-7 con prefijo `rk_`, CA-15 y CA-20) son regresión.
- **PostHog, varios eventos:** hoy solo hay un evento de alta, uno de activación y uno de pago por organización (`posthog_connections`); asignar varios eventos a «De pago» (CA-9) exige una lectura nueva.
- **Stripe:** la sincronización ya existe cada 6 horas (`src/lib/stripe/sync.server.ts`, `src/lib/inngest/tasks.server.ts`); CA-3 pide no empeorarla. La validación actual es solo por prefijo (`src/lib/stripe/metrics.ts`); Stripe no permite comprobar por consulta si una clave puede escribir, así que CA-7 se garantiza limitando la capa de Nokko a operaciones de lectura (un cliente que solo exponga lecturas), no por inspección de la clave. El MRR de Stripe frente a «MRR normalizado» (CA-8) hay que contrastarlo con `src/lib/stripe/metrics.ts` (cuenta suscripciones activas y con pago pendiente, aplica descuentos recurrentes, no valora precios por tramos o medidos).
- **PostHog:** `posthog_connections` solo guarda tres eventos configurables (alta, activación y pago) y no existe el de «Publicó»: PostHog solo alimenta «De pago» (CA-9); «Activa» y «Publicó» esperan a las vistas del SDD-8 (CA-10).
- **PostHog:** la lectura borra `product_usage` antes de insertar (`src/lib/posthog-sync.server.ts`); los resultados clave de producto salen de las pruebas (`trials`), que PostHog no borra, así que CA-2 se cumple conservando el último valor aparte.
- **Credencial de las vistas de Postin:** `org_connections` no tiene columna de credencial (`src/lib/connections-core.ts`); depende del almacén que decida el SDD-8.
- **Credenciales:** hay dos almacenes: la clave de Stripe va al almacén seguro de la base de datos (`src/lib/stripe.functions.ts`) y `src/lib/secret-box.server.ts` solo lo usa hoy PostHog (y `connections-core.ts` no tiene todavía operación de guardado de credenciales); CA-18 exige no registrarlas en la auditoría en ninguno de los dos.
- **Conexiones:** reutilizar `src/lib/connections.ts` (`STATE_LABEL`, `canManage`, un proveedor nuevo es una entrada más) y `connections-bring-your-own-account` (U-1 y U-2 entregadas: Owner gestiona, la credencial no vuelve al navegador, desconectar conserva lo importado); este SDD no repite esos criterios.
- **Gasto:** `integration_usage` y `org_budgets`; no hay referencia a objetivo, así que CA-16 exige añadirla (el gasto por proveedor y mes ya se muestra en `src/components/orchestrator/budget-panel.tsx`; faltan el selector de periodo y el objetivo; el presupuesto por segmento es otro panel, `src/components/budget-panel.tsx`; BYO CA-12 cubre parte). El planificador pausa lo automático al 100 % del presupuesto (`src/lib/orchestrator/planner.ts`): decisión de Fede sobre si eso cuenta como un tope (§15).
- **Drive:** va por la pasarela de Lovable (`src/lib/google-drive.ts`); el SDD de salida B (CA-12) lo mueve a clave propia.
- Migraciones aditivas con organización por defecto; las 0058 y 0059 siguen sin aplicar (`src/lib/AGENTS.md`).
- Alternativa descartada: un almacén gestionado de credenciales (retrasa las integraciones y depende de Dani).

## 14. Riesgos y dependencias
- Depende de que los SDD de salida de Lovable A y B estén cerrados; B y este SDD tocan los mismos proveedores (su CA-11 a CA-14).
- Depende del SDD-8 para la activación automática de «Activa» y «Publicó»; hasta entonces, entrada manual (CA-9). PostHog solo alimenta «De pago».
- Stripe no permite comprobar si una clave escribe: el compromiso «solo lectura» se garantiza en la capa de Nokko y no por la clave.
- Hay dos almacenes de credenciales distintos; rotar `INTEGRATION_KEYS_SECRET` obliga a reconectar todo lo cifrado con `secret-box`.
- El MRR de Stripe puede diferir de «MRR normalizado» (precios por tramos o medidos); se muestra la diferencia, no se corrige. La decisión de Fede (2026-10-30) es contar descuentos y excluir `past_due`: el código ya aplica los descuentos y lo que cambia es excluir `past_due`; la foto de Stripe no guarda ese desglose, así que hace falta un cálculo nuevo, y se muestra la diferencia.
- **R-5:** la pantalla de entrada de leads mantiene recomendaciones de herramientas que automatizan LinkedIn con una advertencia (decisión de Fede); sigue habiendo tensión con la regla de API oficial.
- La migración 0027 (visibilidad de `stripe_snapshots`) está sin verificar y la 0059 (conexiones de la organización) sin aplicar; U-1 y CA-22 dependen de ellas.
- Desconectar PostHog borra hoy `product_usage`, en tensión con «desconectar conserva lo importado» de BYO; no se cambia aquí.
- Coste previo (CA-14): hoy el coste se calcula después de revelar; el cálculo previo es trabajo nuevo y puede dar «sin dato».
- Un valor manual sobre una fuente automática dura hasta la siguiente lectura correcta (6 h en Stripe): es la intención de CA-25.
- Si cambia la moneda de la organización, los valores guardados se reetiquetan sin convertir (regla del repo) y el historial de un resultado clave en dinero puede quedar mal etiquetado; no se resuelve aquí.
- Las lecturas de un objetivo pausado, cerrado o archivado siguen el estado que defina SDD 1a; este SDD no las cambia.
- La lectura de PostHog limita a 365 días y 5.000 personas (`funnelQuery`): CA-23 la trata como incompleta.
- CA-22 (visibilidad del MRR) no se puede demostrar con una prueba unitaria si `stripe_snapshots` está bajo reglas de acceso de base de datos; se prueba con datos de prueba bajo esas reglas, y la 0027 sigue sin verificar. Las filas de la matriz de §10 se apoyan en BYO CA-11 y 1a CA-80.
- U-5 queda diferida hasta que el SDD-8 fije el contrato y el almacén de la credencial.
- Un fallo de Stripe, de producto o de proveedor deja resultados clave en «Sin dato reciente»; el avance depende de que se restablezca.

## 15. Preguntas para Fede y para la revisión técnica
- Resuelto por Fede (2026-10-30): el MRR de Stripe lo ve quien vea el resultado clave (CA-22); las recomendaciones de herramientas de automatización de LinkedIn se mantienen con advertencia (CA-21).
- Resuelto por Fede (2026-10-31): «Sin dato reciente» se marca al doble del intervalo de lectura, alineado con SDD 1a CA-24 (CA-2); antes, con el primer fallo se conserva el último valor.
- Resuelto por Fede (2026-10-30): el coste previo va junto a la acción, sin confirmación nueva (CA-14); el MRR normalizado cuenta descuentos y excluye pagos pendientes (CA-8; PRD §6.3); «Activa» y «Publicó» van en manual hasta el SDD-8 (CA-9); la pausa del planificador al 100 % del presupuesto se mantiene.
- Revisión técnica: ¿cómo convive CA-1 con el estado de conexión actual y con U-3 y U-4 de `connections-bring-your-own-account`?
- Revisión técnica: ¿Stripe de Postin tiene billing y qué eventos de PostHog existen?

## 16. Pendiente de verificar
- Existencia de billing y de Stripe en Postin, y de eventos de producto → Dani.
- Cálculo del MRR de Stripe frente a la definición del diccionario (CA-8) → gate.
- Reparto con `connections-bring-your-own-account`, `money-moment-notices` y los SDD de salida A y B → gate.
- Uso real de las integraciones actuales → datos de producción.
- Que Sales Navigator ofrezca exportación CSV nativa de listas de cuentas → Fede, a mano.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Ocho pasadas del gate; los informes de la cuarta a la octava (sobre las v4 a v8) se copian a continuación sin editar. Antes: la primera, sobre la versión única del SDD 4 (7 bloqueantes), llevó a dividirlo en 4a y 4b; la segunda, sobre el 4a v2, puso 7 bloqueantes (CA-2 frente a 1a CA-24, eventos de PostHog sin «Publicó», confirmación de gasto frente a R-2, Sales Navigator y R-5, gasto por objetivo, visibilidad del MRR de Stripe y credencial de las vistas) y menores de solapes con `connections-bring-your-own-account`. Se resolvieron en esta v3 con decisiones de Fede (2026-10-30). Una tercera pasada, sobre la v3, puso 2 bloqueantes (clientes de pago y churn fuera del diccionario de métricas; la activación de PostHog sin criterio que la ofrezca como fuente) y menores; se resuelven en esta v4. 

### Cuarta pasada del gate (sobre la v4)
Agente de contexto fresco con las reglas del gate (el agente nokko-gate no estaba registrado en la sesión)

**Veredicto:** Objeciones (1 bloqueante, el resto menores).

**Pasada previa**
- CA-6/CA-10 frente al diccionario: **Parcial**. CA-6 usa «MRR», no «MRR normalizado». «Informativos» no dice dónde se muestran, y SDD 3 CA-20 exige «Sin definición» en pantallas nuevas. CA-10 usa «activación» y «creado», que no están en el diccionario.
- Activación de PostHog como fuente: **Resuelta** (CA-23).
- §8 sin CA retirados: **Resuelta**. Drive en H-4: **Resuelta** (queda «con control Drive» en §1). Aviso en pantalla: **Resuelta** (CA-2). CA-8: **Resuelta**.
- CA-13: **Parcial**. No define columnas ni formato, y SDD 2 CA-19 importa solo cuentas.
- R-10: **No resuelta**. La línea de §8 no remite a ningún CA y no hay prueba con dos organizaciones; CA-22 amplía la visibilidad.
- U-7: **Parcial**. CA-20 es regresión y no puede fallar antes.

**Problemas nuevos**
- **Bloqueante:** CA-23 cuenta pruebas por etapa, mientras SDD 3 CA-22 cuenta recorridos. No dice cómo se relaciona con CA-9 ni con las pruebas sin vincular (SDD 3 CA-40). Sumado a lo parcial de CA-6/CA-10, puede dar cifras distintas para la misma etapa.
- **Menor:** U-2 usa la tarjeta de 1b CA-55 (U-8) sin declararla. U-6/CA-16 omite 1b U-5 en §12. El PRD §8 no lista 1b ni 2.
- **Menor:** CA-3 (6 h), CA-7 (solo `rk_`, ya cumplido en `checkStripeKey`) y el coste de CA-14 (`revealCost`) ya se cumplen: esas partes no fallan antes.
- **Menor:** ningún CA fija la fuente y el historial de un valor automático, ni qué pasa si una persona lo edita. CA-8 no define «no permiten» (una suscripción sin valorar) ni qué diferencia se muestra.
- **Menor:** CA-10 no dice dónde se guarda la credencial; `org_connections` no tiene columna de credencial. CA-19 está repartido entre unidades y U-7. La matriz tiene «Sí» frente a «Solo estado» sin definir, y falta quién ve el gasto por objetivo. §17 está resumido por el autor.
- **Menor:** la lectura de PostHog borra `product_usage` antes de insertar, y CA-2 exige conservar el último valor. §13 no lo recoge.

**Comprobaciones mecánicas (script):** sin CA duplicados; todos citan G-n y prueba; §7 y §12 coinciden (19 CA, 0 sin unidad ni sobrantes); §8 solo cita CA existentes; ningún [Por verificar] en un CA.

**¿Aprobable?** No todavía. Hay que cerrar el bloqueante y R-10. Riesgos declarados: R-5, migraciones 0027 y 0059, y SDD-8 pendiente.

**No demuestra:** que las pruebas fallen antes (no ejecuté nada), producción, la visibilidad real de datos (RLS), ni el contrato del SDD-8.

**Respuesta del autor (v5, 2026-10-30).** Bloqueante resuelto: CA-23 usa los recorridos del SDD 3 (CA-22 y CA-37), las mismas cifras que el KPI por canal. R-10 resuelto con CA-24. CA-6 y CA-10 usan los términos del diccionario; clientes de pago y churn quedan en Conexiones. Menores: dependencias de U-2 y U-6, credencial, PostHog y matriz. Los menores de cumplimiento previo de CA-3, CA-7 y CA-14 (partes ya cumplidas en el código) y el historial de valores automáticos se resuelven en el brief. **No hay nueva pasada sobre esta v5.** El gate informa; aprueba Fede.

### Quinta pasada del gate (sobre la v5)
Agente de contexto fresco con las reglas del gate (el agente nokko-gate no estaba registrado en la sesión).

**Veredicto:** Bloqueado (6 bloqueantes, todos de verificabilidad o de comportamiento sin criterio; ninguno exige rediseñar el SDD).

**Lo que está bien:** los 20 CA tienen «cubre G-n» y prueba nombrada; §7 y §12 coinciden (20 de 20, sin sobrantes ni huérfanos); los CA retirados (4, 5, 11 y 12) no se reutilizan; sin dependencias hacia adelante ni ciclos dentro del 4a; sin números de negocio inventados (6 h, 2 min, 8 proveedores, 100 % del presupuesto coinciden con el código); referencias cruzadas verificadas (SDD 1a CA-6, 17, 24, 68, 86 y U-3/U-7; SDD 1b U-5; SDD 2 CA-19 y U-6; SDD 3 CA-14, 15, 18, 22 y 37, y U-1/U-4); hechos del código verificados (8 proveedores y Apify ausente; Stripe cada 6 h con manual para Owner y Sales leader y 2 min de espera; `checkStripeKey` solo acepta `rk_`; MRR con `past_due` y descuentos, tramos o medidos sin valorar; `last_synced_at` se escribe antes de leer y también al fallar; PostHog borra `product_usage` antes de insertar; solo 3 eventos configurables; `stripe_snapshots` limitada a Owner, Sales leader y deal desk; el planificador pausa lo automático al 100 %; 0058 y 0059 sin aplicar).

**BLOQUEANTES**
1. **CA-23 y U-4: la cifra no está definida y falta una dependencia.** CA-23 no dice si el KR es total o por canal ni qué periodo cuenta. SDD 3 CA-6 excluye «Sin atribuir» de los KPI por canal: si «las mismas cifras» se hereda, el KR de activación se queda corto sin avisar. U-4 depende de SDD 3 U-4, pero CA-22 (recuento por etapa) se entrega en SDD 3 U-5. Arreglo: fijar agregación, periodo y tratamiento de «Sin atribuir», y añadir SDD 3 U-5 a U-4.
2. **CA-9: «Activa» no se puede decidir.** SDD 3 CA-14 la define como LinkedIn conectado y post creado (dos eventos). CA-9 no dice si se exigen todos o alguno, ni qué fecha se toma, ni qué pasa con los 3 eventos ya configurados. §13 lo deja como [Por verificar]. Arreglo: CA que fije la regla (alcanza la etapa cuando han ocurrido todos los eventos asignados, con la fecha del último) y la migración de la configuración actual.
3. **Falta un CA sobre el ciclo de vida de un KR con fuente automática.** Sin criterio: valor escrito a mano en un KR automático (1a CA-19 solo define «Manual»); cambio de fuente de un KR existente (CA-6 solo habla de «al crear»; en un objetivo ratificado entra 1a CA-52); desconexión o revocación de la fuente; historial que mezcla manual y automático. El §17 lo remitía «al brief», pero un brief no puede añadir comportamiento. «Eliminado: nada» (§6) es falso para PostHog: `disconnectPosthogFn` borra `product_usage`. Arreglo: 1 o 2 CA y corregir §6.
4. **CA-8 no es verificable.** Mezcla el cálculo con un caso especial; «la diferencia» no está definida; si hay una suscripción sin valorar todo el KR pasa a manual. El PRD §6.3 no dice nada de `past_due` ni de descuentos recurrentes y el código cuenta ambos: esa decisión es de Fede. La foto de Stripe solo guarda agregados y el MRR actual, así que el normalizado exige otro cálculo. Lecturas parciales (`MAX_PAGES` = 15, `details.truncated`) hoy producirían una cifra aparentemente exacta. Arreglo: separar el cálculo de la regla de «no valorable», fijar qué se muestra como diferencia y tratar la lectura parcial como «Sin dato reciente».
5. **CA-14: la premisa del código es falsa.** «La misma confirmación que se pide hoy» no existe en la pantalla de Apollo: el botón «Revelar y añadir» ejecuta directamente; `revealCost` se calcula después de revelar, solo para registrar el gasto. Con «sin añadir confirmaciones nuevas» el CA no se puede cumplir. Arreglo: decidir si el coste va en línea junto al botón o con confirmación nueva, y enumerar las acciones que cubre.
6. **CA-16: «por objetivo» no tiene vínculo definido.** Ningún CA dice cómo una acción «nace de una iniciativa o tarea»; SDD 1b no aporta ese mecanismo. Tampoco qué se muestra cuando no hay iniciativa, ni quién ve el gasto por objetivo. Arreglo: CA que fije cómo se asocia la acción a la iniciativa (por ejemplo, selector al lanzarla), el caso «Sin objetivo» y quién lo ve.

**MENORES**
1. §10 falso para PostHog: dice «de producto solo se leen datos agregados», pero la lectura trae email e id de persona a `trials` (`product-usage.ts`). Aclarar que CA-10 es la regla solo para las vistas de Postin.
2. §13 cita el archivo equivocado: `src/components/budget-panel.tsx` es el presupuesto por segmento; el gasto en integraciones está en `src/components/orchestrator/budget-panel.tsx` (ya muestra el gasto por proveedor del mes, incluido Apify; falta el selector de periodo y el objetivo). Solapa con BYO CA-12.
3. Propiedad de criterios repartida con `connections-bring-your-own-account`: CA-1 es BYO CA-2, CA-18 es BYO CA-10 (`org_connection_events`, en 0059 sin aplicar) y CA-16 es BYO CA-12.
4. CA-1 dice «por cada integración»: la «última lectura correcta» no está definida para proveedores sin lectura programada; los paneles de Stripe y PostHog usan estados distintos de los 6 de `connections.ts`.
5. CA-3 y CA-7: casi todo ya se cumple y «una vez al día» no tiene fuente; marcar en §12 qué parte es regresión. CA-7 acepta claves `rk_test_`, así que datos de prueba podrían alimentar un KR real.
6. Matriz de §10 sin CA para varias filas (Consejo sin estado, otros roles con «Solo estado», rol sin permiso); el deal desk lee hoy las fotos y la matriz lo deja en «Solo estado». Citar BYO CA-11 y 1a CA-80, o añadir un CA.
7. R-9 y orden de U-7: CA-19 se cierra en U-7, casi al final, pero §12 dice que cada unidad añade su guardia. Dejar un único responsable y que la guardia llegue desde U-1.
8. U-6 sobrecargada (5 CA, 3 funcionalidades, 3 dependencias externas): separar CA-13 y CA-21 de CA-14 a CA-16.
9. CA-13 sin columnas ni formato; no cubre CSV vacío ni solo con columnas de persona. Que Sales Navigator ofrezca exportación CSV nativa está sin verificar. `leads.entrada.tsx` hoy recomienda Evaboot y Phantombuster y R-5 prohíbe ese camino.
10. Casos límite sin CA: Stripe conectado sin suscripciones (0 frente a «Sin dato»); moneda del KR frente a la de la organización (otras monedas se separan sin convertir).
11. Drive en §1 y en el PRD §8 sin CA; el PRD §8 tampoco lista 1b ni 2 como dependencias del 4a. Quitar «con control Drive» o añadir el CA, y corregir el PRD.
12. El mensaje de §9 incumple R-8: dice qué pasó, pero no qué hacer.
13. CA-17 (Apify): 1a U-0 retira sus actores de LinkedIn y solo queda G2; la descripción no debe mencionar LinkedIn. Añadir coordinación con 1a U-0.
14. §10 sin datos nuevos: faltan tablas y columnas con `org_id` y RLS (origen del KR, historial, última lectura correcta, asignación evento→etapa, referencia a objetivo).
15. CA-10 y U-5: «cifrada como las demás» es ambiguo (hay dos almacenes y `connections-core.ts` no tiene `storeCredential`); el contrato del SDD-8 no existe: marcar U-5 como diferida o separarla.
16. §14: la migración 0027 dice estar ya en la base de datos; está sin verificar, no sin aplicar.
17. CA-2 frente a 1a CA-24: CA-2 se activa con cualquier fallo de lectura; 1a CA-24 solo a partir del doble del intervalo. R-6 lo respalda; confirmar y alinear 1a.
18. Nota de PostHog en §13: los KR salen de `trials`, que PostHog nunca borra; `product_usage` no alimenta KR.
19. CA-15 no lista las vías (pantalla, agente, Telegram, servidor para asistentes, trabajos automáticos); hoy se cumple y es regresión.

**Respuesta a los pendientes de §16 y a lo «resuelto» en §17:** MRR de Stripe frente al diccionario: las diferencias reales son que `past_due` cuenta como de pago, que se aplican descuentos recurrentes, que lo no valorable queda fuera de la suma, que otras monedas no se convierten y el riesgo de lectura truncada. Realmente resueltos: términos del diccionario en CA-6 y CA-10, R-10 con CA-24 y CA-23 a «recorridos». No resueltos pese al §17: columnas de CA-13, historial de valores automáticos, quién ve el gasto por objetivo y la parte falsa de «CA-14 ya cumplido».

**Límites de la revisión:** no se ejecutaron tests ni código; no se verificó producción, RLS real ni migraciones aplicadas; no existe el SDD-8, así que CA-10 y U-5 no son contrastables; no se comprobaron las capacidades de la API de Stripe ni de Sales Navigator, ni la guía de voz ni Drive Core; de los SDD 4b y `money-moment-notices` solo se leyó el encabezado y las referencias al 4a.

**Respuesta del autor (v6, 2026-10-30).** Bloqueante 1: CA-23 fija total, periodo del resultado clave y «Sin atribuir» incluido, y U-4 depende de SDD 3 U-5. 2: CA-9 fija «todos los eventos asignados» con la fecha del último y conserva activación y pago como asignaciones iniciales. 3: CA-25 y CA-26 (valor manual, cambio y pérdida de fuente, historial) y §6 corregido. 4: CA-8 solo calcula y muestra la diferencia; CA-28 trata lo no valorable, la lectura incompleta y la ausencia de suscripciones; si `past_due` y descuentos cuentan queda a decidir en el diccionario (§15). 5: CA-14 pasa a coste previo junto al botón, sin confirmación nueva, enumerando proveedores (§15 pregunta a Fede). 6: CA-27 (selector opcional de iniciativa, «Sin objetivo», quién lo ve). Menores: corregidos 1, 2, 3, 4, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18 y 19; el 5 y el 6 quedan declarados (regresión marcada en §13). **Riesgos declarados:** R-5, migraciones 0027 y 0059, SDD-8 pendiente (U-5 diferida), cálculo previo de coste, tensión de PostHog con BYO, y que la PRD §8 aún no lista 1b y 2 como dependencias del 4a (se corrige con el PRD). **No hay nueva pasada sobre esta v6.** El gate informa; aprueba Fede.

### Sexta pasada del gate (sobre la v6)
Agente de contexto fresco con las reglas del gate (el agente nokko-gate no estaba registrado en la sesión).

**Veredicto:** Bloqueado (3 bloqueantes, todos de coherencia interna). Los 6 bloqueantes de la pasada previa quedan resueltos o reducidos a menores; el problema está en la forma en que la v6 los cerró.

**Estado de los 6 bloqueantes previos:** 1. CA-23, cifra y dependencia: resuelto (total de recorridos, periodo del resultado clave, «Sin atribuir» incluidos, U-4 depende de SDD 3 U-5; verificados SDD 3 CA-22 y CA-37). 2. CA-9, regla de «Activa»: la regla está resuelta (todos los eventos asignados, fecha del último), pero introduce el B1. 3. Ciclo de vida CA-25/26: parcial (B2 y B3). 4. CA-8/CA-28, MRR: resuelto en lo esencial, con menores (M-4). 5. CA-14, coste previo: resuelto (la premisa ya es correcta: el botón «Revelar y añadir» ejecuta directo y `revealCost` se calcula después). 6. CA-27, gasto por objetivo: resuelto, con huecos menores (M-7).

**BLOQUEANTES**
1. **CA-9, CA-23, §14 y §15 frente a PRD §6.1 «Activación manual hasta el SDD-8».** CA-9 permite asignar eventos de PostHog a «Activa» y «Publicó» ya, y CA-23 los ofrece como fuente automática. Eso contradice la decisión de Fede (manual hasta que Dani entregue las vistas) y contradice §14 («hasta entonces, entrada manual»). §15 lo da por «resuelto (CA-9)» y no lo está. Además, CA-10 (vistas del SDD-8) y CA-9 alimentan las mismas etapas sin regla de precedencia, y «asignaciones iniciales pendientes de confirmar» no dice si la etapa está en automático o en manual mientras tanto. Arreglo: o CA-9 deja «Activa» y «Publicó» en manual hasta CA-10 y PostHog solo alimenta «De pago», o Fede confirma que PostHog cuenta antes del SDD-8 y se corrigen §14, §15 y el PRD; en ambos casos, añadir la precedencia y el estado de lo pendiente.
2. **CA-28, CA-26, CA-25 y CA-2: «entrada manual» no tiene semántica única.** CA-25 dice «mantener la fuente» cuando alguien escribe un valor a mano; CA-28 y CA-26 dicen «pasar a entrada manual», que según 1a CA-17 es cambiar la fuente. Si la fuente cambia, no hay vuelta a automático cuando las suscripciones pasan a ser valorables. En un objetivo ratificado, un cambio hecho por el sistema entraría en 1a CA-52 («alguien edita»). «Revocada» (la lectura devuelve 401, CA-2) y «deja de existir» (CA-26) se solapan. Arreglo: definir un estado del resultado clave («Sin valorar» o «Pendiente de entrada manual») que conserve la fuente, permita el valor manual y se reevalúe solo; reservar el cambio real de fuente para la acción de una persona, y distinguir «revocada» (CA-2) de «desconectada» (CA-26).
3. **CA-6 y CA-26 citan «SDD 1a, CA-17» para «cambiar su fuente», pero 1a CA-17 solo cubre la creación** (con fuente manual «en esta fase»). Ningún CA define quién cambia la fuente de un resultado clave existente ni cuándo. Arreglo: añadir un CA (Owner y Sales leader, con 1a CA-52 en objetivos ratificados) o corregir las citas, y declarar en §6 que se modifica 1a CA-17.

**MENORES**
1. CA-24 se cierra en U-1 pero cubre datos que nacen en U-2 a U-8 (historial de valores, asignación evento→etapa, gasto por objetivo): cada unidad añade su caso de aislamiento entre organizaciones.
2. Matriz de §10 y CA-16: cambio de visibilidad no declarado. El gasto solo para Owner y Sales leader contradice el código actual: `orchestratorStatus` y `BudgetPanel` lo muestran a cualquier miembro autenticado. §6 no lo declara, no hay CA y choca con CA-20 y PRD R-9.
3. Lectura de PostHog incompleta sin tratamiento: `funnelQuery` limita a 365 días y 5.000 personas; CA-28 solo trata Stripe, así que CA-23 puede infracontar sin avisar (PRD R-1 y R-6).
4. CA-8 y §14, el MRR: PRD §6.3 excluye el pago «pendiente o fallido» y CA-8 solo dice «pendiente»; el código ya aplica los descuentos recurrentes, así que lo único que cambia es `past_due` (§14 dice que «el cálculo actual cambia» al contar descuentos, impreciso); `stripe_snapshots` no guarda el desglose de `past_due` (hace falta un cálculo nuevo); si hay suscripciones sin valorar, la diferencia no está definida.
5. CA-9 frente a SDD 3 CA-13: «fecha del último evento» no encaja con «primera entrada, sin borrar por retroceso»; no dice cómo la etapa automática pasa a los recorridos ni qué pasa con entradas manuales previas; «Activa» son dos eventos y el código solo tiene un `activation_event`.
6. CA-21 y R-9: CA-19 solo habla de «integraciones»; no dice si la advertencia de la pantalla de leads solo sale con la fase activa.
7. CA-14, CA-16 y CA-27 solo cubren acciones lanzadas por una persona; `integration_usage` ya distingue el disparo `automatic`; el gasto del agente, de Telegram o de trabajos automáticos no tiene destino definido; «exportar contactos con Apollo» no existe en el código (solo revelar).
8. Documento: §17 dice que el PRD §8 aún no lista 1b y 2, y es falso (ya lista «1a, 1b, 2, 3, SDD-8»); la cabecera lista 1a U-0 como dependencia pero U-1 (donde está CA-17, Apify) no la incluye en §12; el aviso de numeración «los nuevos van al final de su historia» no se cumple (CA-28 antes de CA-22, CA-27 antes de CA-21, CA-23 y CA-24 antes de CA-10).
9. Sales Navigator: la exportación CSV nativa sigue sin verificar y no está en §16.
10. Casos sin CA: cambio de moneda de la organización (AGENTS.md: «relabels, never converts»); qué pasa con las lecturas si el objetivo está pausado, cerrado o archivado; quién es la «persona con permiso» de CA-25; un valor manual dura como mucho hasta la siguiente lectura (6 h en Stripe): confirmar que es la intención.
11. CA-2 salta con el primer fallo de lectura, sin esperar el doble del intervalo; puede parpadear con fallos transitorios. Declarado en §14; 1a no se ha alineado.
12. La pausa del planificador al 100 % solo figura en §13 y §15; ningún CA ni «No incluye» la protege explícitamente.

**Lo que está bien:** los 24 CA tienen «cubre G-n» y prueba nombrada; los CA retirados no se reutilizan; §7 y §12 coinciden (24 de 24); dependencias válidas, sin ciclos ni referencias hacia adelante; referencias a 1a, 1b, 2 y 3 existen y dicen lo afirmado (salvo el B3); hechos de código verificados (8 proveedores y Apify ausente, Stripe cada 6 h con manual a 2 minutos para Owner y Sales leader, `last_synced_at` también al fallar y antes de leer, PostHog borra `product_usage` antes de insertar, `checkStripeKey` solo valida `rk_`, MRR actual cuenta `active` y `past_due` y aplica descuentos, la pantalla de leads recomienda Evaboot y Phantombuster, el planificador pausa al 100 %); coherente con la decisión de coste previo, con la de MRR normalizado, con R-1 a R-10 y con la visibilidad de Stripe (CA-22); sin datos de clientes ni cifras inventadas; tamaño razonable.

**Límites:** no se ejecutaron tests ni código; no se verificaron producción, RLS ni migraciones aplicadas (el archivo 0027 tiene su SQL comentado, coherente con «sin verificar»); no existe el SDD-8, así que CA-10 y U-5 no son contrastables; de 4b y `money-moment-notices` solo se miró el encabezado y las referencias al 4a; no se comprobó la API de Stripe ni de Sales Navigator ni la guía de voz.

**Respuesta del autor (v7, 2026-10-31).** Bloqueante 1: CA-9 deja «Activa» y «Publicó» en manual hasta CA-10 (decisión de Fede), PostHog solo alimenta «De pago», CA-10 manda sobre CA-9 y CA-23 sigue a CA-9 y CA-10; se aclara qué pasa con la asignación pendiente. 2: estados «Sin valorar» (CA-28) y «Sin fuente conectada» (CA-26) conservan la fuente y vuelven solos; «revocada» es fallo de lectura y «desconectada» es CA-26; el sistema no cambia la fuente por sí mismo. 3: CA-29 define quién cambia la fuente y cómo (1a CA-52 en ratificados), y la cabecera declara que modifica 1a CA-17. Menores: 1 (aislamiento por unidad en §12), 2 (matriz «como hoy», sin cambio de visibilidad), 3 (CA-23 y CA-28 tratan lectura incompleta), 4 (CA-8 «pendiente o fallido» y §14 precisado), 5 (sin retroceso, SDD 3 CA-13), 6 (CA-21 con fase), 7 (CA-14 y CA-27 sin exportar, agente y automáticos como «Sin objetivo»), 8 y 9 (documento, §16), 10 y 12 (§14 y «No incluye»). **Declarado:** CA-2 salta con el primer fallo (11), asignación de «Activa» con dos eventos hasta el SDD-8, moneda y estado del objetivo en §14, y las migraciones 0027 y 0059. **No hay nueva pasada sobre esta v7.** El gate informa; aprueba Fede.

### Séptima pasada del gate (sobre la v7)
Agente de contexto fresco con las reglas del gate (el agente nokko-gate no estaba registrado en la sesión).

**Veredicto:** Bloqueado (2 bloqueantes, ambos por la forma en que la v7 cerró los 3 anteriores; el arreglo es pequeño y no rediseña nada).

**Resolución de los 3 bloqueantes previos:** Activa/Publicó manual hasta el SDD-8: resuelto en CA-9, CA-10, §14 y §15 (deja un resto en el bloqueante 2 y en el menor 3). Estados «Sin valorar» y «Sin fuente conectada»: resuelto solo a medias (bloqueante 1). Cambio de fuente (CA-29): resuelto (existe, usa 1a CA-52 y la cabecera declara que modifica 1a CA-17; menor 7).

**BLOQUEANTES**
1. **CA-26, CA-28, CA-25 y CA-2 frente a 1a CA-22/23/24, 1b CA-57 y §9: los dos estados nuevos no tienen efecto definido.** «Sin valorar» y «Sin fuente conectada» no están en el vocabulario de estados de 1a (§9) ni en 1b CA-57, y no dicen cómo entran en 1a CA-22/23, que calcula el estado del objetivo; 1a CA-24 solo contempla «Sin dato reciente». Con valor manual, ¿se calcula En ritmo, Atención o En riesgo? Sin valor manual, ¿es «Sin dato»? CA-25 dice que «la siguiente lectura correcta lo reemplaza»: ¿una lectura que da «Sin valorar» reemplaza el valor manual? Mientras el KR esté en «Sin dato reciente» por un fallo, ¿un valor manual lo saca de ese estado? §9 añade «Actual» como estado del dato, y tampoco figura en 1a ni 1b. Arreglo: una línea en CA-26/CA-28 que fije el efecto sobre 1a CA-22/23 (con valor manual se calcula con él, marcado «Manual»; sin él, «Sin dato»); añadir los términos nuevos a §6 como modificación de 1a CA-23 y 1b CA-57, y decir si un valor manual levanta «Sin dato reciente».
2. **CA-9, CA-10 y CA-23 frente a SDD 3 CA-13 y CA-15: la v7 perdió la regla de varios eventos y la precedencia choca con «primera entrada».** CA-9 permite asignar varios eventos a «De pago»; la v6 decía «todos, con la fecha del último» y la v7 la eliminó sin decir «todos» ni «alguno». CA-10 da precedencia a lo automático sobre «una entrada manual previa», pero SDD 3 CA-13 conserva la fecha de primera entrada y no la borra; no dice qué fecha manda si la manual es anterior a la automática ni si «entrada manual previa» es la de etapa (SDD 3 CA-15) o un valor manual de KR. Para «De pago», tras confirmar el Owner la asignación, falta la precedencia entre automático y manual. Arreglo: fijar en CA-9 la regla («alcanza la etapa al darse todos los eventos asignados o cualquiera de ellos», con una fecha concreta) y fijar en CA-9 y CA-10 qué fecha manda según SDD 3 CA-13 y a qué nivel actúa la precedencia (etapa o KR).

**MENORES**
1. §13, nota de PostHog: dice que CA-9 «exige poder asignar más eventos» y que «Activa» puede necesitar dos eventos combinados; contradice la v7 («Activa» y «Publicó» son manuales y PostHog solo alimenta «De pago»). En §17, la respuesta v7 sigue citando la «asignación de Activa con dos eventos hasta el SDD-8».
2. CA-10 dice «precedencia sobre cualquier asignación de eventos de CA-9»; CA-9 ya no asigna eventos a «Activa» ni «Publicó», así que la frase no tiene objeto. Quitarla o limitarla a la entrada manual.
3. CA-23 y U-4/U-5: U-4 cierra CA-23 con `product-source.test.ts`, pero la mitad de «Activa» y «Publicó» depende de CA-10 (U-5); U-5 solo nombra `postin-views.test.ts`. Dejar en U-4 solo «De pago» y mover a U-5 la parte de «Activa» y «Publicó» de CA-23.
4. U-2: CA-25, CA-26 y CA-29 se prueban en U-2, pero la primera fuente automática de KR llega en U-3. Indicar que U-2 usa una fuente de prueba, o mover esos CA a U-3 y U-4.
5. CA-7 frente a CA-20: «rechazar claves de prueba como fuente de un KR real» es ambiguo (¿al conectar o solo como fuente de KR?); `checkStripeKey` hoy acepta `rk_test_` y CA-20 exige que lo conectado siga igual; aclarar qué pasa con una conexión de prueba ya existente.
6. CA-26 y PostHog: sin criterio de qué pasa con la fuente de «De pago» si el Owner desconecta PostHog (se borra `product_usage`, ya declarado en §6 y §14); basta una línea de que las fechas de etapa ya alcanzadas no retroceden (SDD 3 CA-13).
7. Cabecera, §6 y CA-29: la cabecera cita 1a CA-17 como modificado pero §6 «Modificado» no lo lista; la nota de numeración dice «CA-21 y CA-22 en H-2 y H-4», con el orden invertido (CA-22 está en H-2 y CA-21 en H-4); CA-29 depende de que cambiar la fuente sea una edición del objetivo en 1a CA-52, que exime solo los valores manuales: decirlo explícitamente.
8. CA-6: «clientes de pago» pasa a contar solo suscripciones con importe mayor que cero y hoy cuenta también las de 0; es un cambio de cifra visible. Confirmar que queda bajo la guardia de fase (CA-19) y que no toca el panel actual.
9. §9: faltan textos de «qué hacer» para «Sin valorar» y «Sin fuente conectada» (R-8).

**Lo que está bien:** los 25 CA tienen «cubre G-n» y prueba nombrada, en EARS sin tecnología; los retirados no se reutilizan; §7 y §12 coinciden en los 25, sin huérfanos; §8 solo cita CA existentes; dependencias válidas, sin ciclos ni referencias hacia adelante; referencias cruzadas verificadas (1a CA-6, 17, 19, 24, 52, 68 y 86; 1b U-5 y CA-55; SDD 2 CA-19 y U-6; SDD 3 CA-6, 13, 14, 15, 18, 20, 22 y 37; dicen lo afirmado salvo el solape de CA-13 del bloqueante 2); decisiones de Fede coherentes con PRD §6.1; R-1 a R-10 se respetan (R-5 como riesgo declarado); hechos de código verificados (8 proveedores y Apify fuera del registro, 6 estados de conexión, `PAYING` cuenta `active` y `past_due`, `checkStripeKey` acepta `rk_live` y `rk_test`, PostHog cada 6 h con límite de 365 días y 5.000 personas y borrado de `product_usage` antes de insertar, la pantalla de leads recomienda Evaboot y Phantombuster, las herramientas del agente de tipo `write` requieren confirmación); sin datos de clientes ni cifras inventadas; tamaño razonable.

**Límites:** no se ejecutaron tests ni código; no se verificaron producción, RLS ni migraciones (0027, 0059); no existe el SDD-8, así que CA-10 y U-5 no son contrastables; no se comprobó la API de Stripe ni la exportación CSV de Sales Navigator (queda en §16); 4b y `money-moment-notices` solo de pasada; de 1b solo CA-55, CA-57 y U-5.

**Respuesta del autor (v8, 2026-10-31).** Bloqueante 1: CA-30 fija el efecto de los estados nuevos sobre el estado del objetivo (valor manual si existe, «Sin dato» si no; un valor manual levanta «Sin dato reciente»; «Sin valorar» no reemplaza un valor manual), §6 y §9 añaden los términos y textos. Bloqueante 2: CA-9 recupera «todos los eventos asignados, con la fecha del último» y fija la fecha más antigua con SDD 3 CA-13; CA-10 acota la precedencia al valor del resultado clave. Menores: 1 y 2 (nota de PostHog y CA-10), 3 (CA-31 para «Activa» y «Publicó» en U-5), 4 (U-2 con fuente de prueba), 5 (CA-7), 6 (CA-26, PostHog sin retroceso), 7 (§6, numeración y CA-29), 8 (CA-6 con fase) y 9 (§9). **Declarado:** las migraciones 0027 y 0059, el SDD-8 pendiente y lo ya listado en §14 (CA-2 salta al doble del intervalo por decisión de Fede, 2026-10-31). **No hay nueva pasada sobre esta v8.** El gate informa; aprueba Fede.

### Octava pasada del gate (sobre la v8)
Agente de contexto fresco con las reglas del gate (el agente nokko-gate no estaba registrado en la sesión).

**Veredicto:** Bloqueado (3 bloqueantes, todos en las zonas que cambió la v8; cada uno se arregla con una o dos líneas). El resto (numeración, §7↔§12, dependencias, referencias 1a/1b/2/3, hechos de código) está limpio.

**BLOQUEANTES**
1. **CA-30 contradice a CA-2 y a 1a CA-23/CA-24.** Un KR en «Sin dato reciente» sin valor manual pasa a «Sin dato» según CA-30; CA-2 dice lo contrario: se conserva y se muestra el último valor con su antigüedad bajo «Sin dato reciente». El estado «Sin dato reciente» (1a CA-23, 1b CA-57) quedaría inalcanzable salvo con valor manual, y el KR saldría del cálculo del objetivo por «Sin dato», no por «Sin dato reciente». CA-30 cita «SDD 1a, CA-24» para «Sin dato», pero esa es CA-22; CA-24 define «Sin dato reciente». «Valor manual si existe» no está definido: el valor inicial es manual (1a CA-17), así que existiría siempre; un manual anterior a la última lectura correcta ya está reemplazado (CA-25). Resolver: CA-30 solo para «Sin valorar» y «Sin fuente conectada»; para «Sin dato reciente», mantener el último valor (CA-2); definir «valor manual vigente» como el posterior a la última lectura correcta; corregir la cita a 1a CA-22.
2. **CA-28 y CA-23 chocan con la regla de CA-2 sobre cuándo salta «Sin dato reciente».** Ambas dicen «tratarlo como Sin dato reciente (CA-2)» ante una lectura incompleta, que se lee como salto inmediato; CA-2 solo lo marca al doble del intervalo, y mide «no se actualiza el valor», no «sin lectura correcta». Un contador de recorridos que no cambia no está obsoleto, y el código escribe `last_synced_at` también en fallo. Resolver: CA-2 debe medir el tiempo desde la última lectura correcta (la de CA-1); CA-28 y CA-23 deben decir «tratarlo como lectura fallida (CA-2)», sin mostrarla como cifra exacta.
3. **CA-10, CA-23 y CA-31: la regla «prevalece lo automático» no sirve para un recuento.** CA-10 dice que lo automático prevalece sobre una entrada manual de etapa «en el valor de un KR»; el valor de CA-23/CA-31 es un recuento de recorridos que alcanzaron la etapa. No se dice si un recorrido con etapa manual y sin evento automático cuenta o se excluye. Para «De pago» (CA-9) la fecha mínima entre automática y manual implica que cuenta; para «Activa» y «Publicó» (CA-10) la lectura contraria es plausible. Dos fuentes podrían dar cifras distintas para el mismo recuento y no hay prueba posible. Resolver: fijar en CA-23, aplicable también a CA-31, si cuentan las entradas manuales de etapa; reformular «prevalece» de CA-10 como regla de fecha e historial, o como «una entrada manual no suma si el recorrido ya tiene dato automático».

**MENORES**
1. §6 dice que añade estados a 1a CA-23 y 1b CA-57; CA-30 también modifica 1a CA-24 (el manual saca de «Sin dato reciente») y roza 1a CA-22. Declararlo en §6 y en la cabecera.
2. Ningún CA exige mostrar las palabras «Sin valorar» y «Sin fuente conectada» en la tarjeta (1b CA-55/CA-57) ni en la ficha; solo están en §9. U-2 no depende de 1b U-8, donde viven esas pantallas.
3. CA-9, multi-evento: el código solo guarda un evento de alta, uno de activación y uno de pago (`posthog_connections`); asignar varios eventos a «De pago» exige una lectura nueva, y §13 y §14 no lo dicen.
4. CA-9 no define el efecto de reasignar eventos tras haber alcanzado etapas (solo vale que «no retrocede») ni cómo cuentan eventos de varias pruebas dentro de un mismo recorrido.
5. CA-23 no fija qué fecha usa para el periodo (la de entrada a la etapa), si los límites son inclusivos, ni la zona horaria de la organización (Europe/Madrid, PRD).
6. §8 no cubre «cambio de fuente» (CA-29), CA-30, ni el KR automático antes de la primera lectura.
7. CA-3: «como mínimo una vez al día» no tiene fuente en el PRD, y «indicar la hora de la última lectura» duplica CA-1.
8. CA-28: el código también deja sin valorar los ítems cuando `items.has_more` (más de 10); añadirlo a «no puede valorar».
9. Matriz §10: las filas (Sales leader sin gestionar, Consejo sin estado, otros roles «Solo estado») no tienen CA propio y se apoyan en BYO CA-11; CA-22 (visibilidad) no se puede demostrar con un test unitario si `stripe_snapshots` está bajo RLS; la 0027 sigue sin verificar.
10. CA-13 debería declarar que reutiliza la revisión previa y el deshacer de SDD 2 CA-19, y la fase de ese SDD.
11. §17 (línea de «Declarado» de la v8) sigue diciendo «CA-2 con el primer fallo»; ya lo contradice §15. La cabecera lleva fecha 2026-10-30 aunque es v8 del 31.

**Lo que está bien:** 27 CA, cada uno con «cubre G-n» y prueba; §7 y §12 coinciden (27 de 27); los retirados no se reutilizan; dependencias sin ciclos ni saltos hacia adelante, coinciden con 1a U-0, U-1, U-3 y U-7, 1b U-5, 2 U-6 y 3 U-1, U-4 y U-5; referencias a 1a CA-17, CA-23, CA-52, CA-68 y CA-86, a 1b CA-57 y a 3 CA-13, CA-14, CA-15, CA-18, CA-20, CA-22 y CA-37 exactas (salvo la cita a 1a CA-24 del bloqueante 1); la decisión del doble del intervalo está en PRD §6.1 y en CA-2; cuadran con R-1 a R-10 y con las decisiones de Fede; hechos de código confirmados (ocho entradas del registro y Apify ausente, Stripe cada 6 h, `last_synced_at` antes de leer y en fallo, `PAYING` incluye `past_due`, `checkStripeKey` solo acepta `rk_`, `items.has_more` y `truncated`, solo tres eventos en PostHog); sin datos de clientes ni cifras inventadas.

**Límites:** no se ejecutaron pruebas; no se verificaron la RLS real, las migraciones 0027 y 0059 ni el contrato del SDD-8; no se comprobaron los SDD de salida de Lovable A y B ni `money-moment-notices` más allá de lo citado; no se leyeron en detalle las pasadas 4 a 7 de §17.

**Respuesta del autor (v9, 2026-10-31).** Bloqueante 1: CA-30 solo trata «Sin valorar» y «Sin fuente conectada», define el valor manual vigente, mantiene en «Sin dato reciente» el último valor (CA-2) y corrige la cita a 1a CA-22. 2: CA-2 mide desde la última lectura correcta y CA-23 y CA-28 tratan lo incompleto como lectura fallida. 3: CA-23 y CA-10 fijan que el recuento cuenta cada recorrido una vez por cualquier vía y que una entrada manual no suma de nuevo si ya hay dato automático. Menores: 1, 2 (cabecera, §6, CA-30 y U-2 con 1b U-8), 3 y 4 (§13 y CA-9), 5 (CA-23), 6 (§8), 7 (CA-3), 8 (CA-28), 9 (§14), 10 (CA-13) y 11. **No hay nueva pasada sobre esta v9.** El gate informa; aprueba Fede.

## 18. Delta de implementación (lo rellena el agente al entregar)
Sin entrega todavía.
