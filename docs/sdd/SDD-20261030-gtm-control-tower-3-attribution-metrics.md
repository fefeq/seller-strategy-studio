# SDD-20261030-gtm-control-tower-3-attribution-metrics · [Feature] Atribución por canal y público, embudos por modelo de venta y diccionario de métricas

**Tipo:** Feature · **Prioridad propuesta:** Alta
**Estado:** Aprobado por Fede el 2026-10-30 (v9, tras siete pasadas del gate; con los riesgos declarados del §14) · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-10-30
**PRD:** `docs/prd/PRD-20261030-gtm-control-tower.md` · **Depende de:** SDD 1a (canales y públicos mínimos, objetivos, versiones de objetivos ratificados, auditoría y roles: U-1, U-2, U-4 y U-7; hasta que el SDD 2 entregue el ajuste de zona horaria se usa Europe/Madrid), y de los SDD de salida de Lovable A y B para construir · **Coordinar con:** `SDD-20261025-fit-data-7a-llave-minima-y-completado` y `SDD-20261025-fit-data-7c-person-identity-and-third-party-results` (Borrador), que tocan los mismos registros de cuentas y personas

> Un SDD dice cómo se verifica que está bien hecho. Cada criterio de aceptación (CA-n) debe poder tener una prueba automática que lo nombre.
> Los criterios no nombran tecnología; lo técnico va en el §13 como [Sugerencia — la revisión del gate las valida].
> Las reglas transversales del PRD (§6.2, R-1 a R-10) aplican a todo este SDD. «Organización» es la empresa que usa Nokko; «cuenta» es una empresa prospecto o cliente.

> **Enmienda aprobada (2026-11-02)** por `SDD-20261031-gtm-control-tower-8-postin-views-nokko`: CA-15 y las menciones a «hasta el SDD 8» (§5 y §14) pasan a «MIENTRAS no exista una fuente automática por recorrido»: «Activa» y «Publicó» por recorrido se siguen registrando a mano, y la fuente automática de Postin es un total por periodo (CA-10 de ese SDD).

## 1. Resumen
Cada lead, cuenta, prueba y deal pasa a llevar **canal y público obligatorios** desde listas controladas, y el objetivo se deriva del público. Los canales ganan coste y resultados. Se **añaden dos embudos por modelo de venta** (asistida y autoservicio) que convergen en prueba → activa → publicó → de pago; el embudo actual (Nuevo, Contactado, MQL, SQL, Oportunidad) y las etapas de deals configurables siguen funcionando. Un **diccionario de métricas versionado** fija qué significa cada número, y el agente y las pantallas solo usan métricas definidas. Se añaden el KPI por canal, las ventas por público y la ficha de conversación sin nombres.

## 2. Problema y para quién
Hoy el origen de un lead, una cuenta, una prueba o un deal es un texto libre y no existe el canal como entidad, así que no se puede medir qué canal rinde ni cuánto aporta cada público al objetivo de ingresos. Tampoco hay una definición única de métricas como «activada» o «MRR». Para Fede (Owner), Flor (Sales leader) y los demás roles (lectura).

## 3. Evidencia y por qué ahora
- **Código (repo de Nokko, solo lectura, 2026-10-30):**
  - `leads`, `deals`, `people` y `trials` tienen `source` de texto libre; `leads`, `deals` y `trials` tienen `segment_id` (`people` no, y `accounts` tiene `segment_id` pero no `source`); `leads` y `deals` tienen `lead_source_id` (`src/integrations/supabase/types.ts`). El catálogo de campos ya define `deals.source` y `people.source` como «canal de entrada», un valor cerrado aprobado por Fede el 2026-10-25 (`src/lib/field-catalog.ts`).
  - Los registros se crean por muchos caminos: `ingestLead` (`src/lib/leads-ingest.ts`, que escribe `source` y a la que delegan la API pública de leads `src/routes/api/public/leads.ts` y la herramienta del agente de `src/lib/agent/tools/pipeline.ts`); la importación aprobada (`src/lib/imports.functions.ts`; `src/lib/leads.ts` solo normaliza); la sincronización de pruebas (`src/lib/posthog-sync.server.ts`, que escribe `source: "PostHog"` sin `segment_id`); altas manuales de leads, cuentas, pruebas y deals desde pantallas (`src/components/leads/lead-dialogs.tsx`, `src/routes/_authenticated/accounts.index.tsx`, `src/components/self-service-funnel.tsx`, `src/components/won-deals-panel.tsx`, `src/components/deal-lines.tsx`) y proveedores (`src/components/clay.tsx`, `apollo.tsx`, `parallel.tsx`); herramientas del agente (`src/lib/agent/tools/core-write.ts`, `tool-kit.ts`); detectores y descubrimientos (`src/lib/inngest/lead-tasks.server.ts`, `src/lib/discoveries.functions.ts`); la API pública de cuentas (`src/routes/api/public/accounts.ts`); y un disparador de la base de datos que crea cuenta y deal copiando `source`, `segment_id` y `lead_source_id` (`drizzle/migrations/0012_lead_funnel.sql`; la versión de 0023 está comentada, así que no se sabe cuál rige en producción) [Por verificar].
  - El embudo de leads son cinco etapas (Nuevo, Contactado, MQL, SQL, Oportunidad) más Ganado (`src/lib/lead-funnel.ts`).
  - La tabla `trials` tiene fechas de alta, activación y conversión y MRR (`activated_at`, `converted_at`, `mrr`), y el embudo de autoservicio las usa (`src/lib/self-service.ts`); `activated_at` viene hoy de un evento de PostHog configurable (`src/lib/product-usage.ts`), no de «LinkedIn conectado y post creado».
  - La tabla `cac_costs` ya guarda costes por segmento, canal en texto libre, importe y periodo; `segment_targets` guarda metas por segmento y periodo.
  - Las métricas se calculan en funciones puras (`src/lib/metrics.ts`, `src/lib/revops.ts`), sin un diccionario común; no existe una definición de MRR en esos módulos.
- **Postin Core (Drive, solo lectura):** ICP-06 (traducción del objetivo de ingresos a número de clientes, CA-25), F0-11 v1.2 §3 (puertas: respuestas de cualquier tipo, conversaciones registradas con origen frío o cálido) y §2.3 (anotar el origen), ICP-00 v2.4 §8, y el proceso de venta de octubre 2026 (activada = primer post publicado; el embudo de la puesta en marcha).
- **Entrevista con Fede (2026-10-29/30):** atribución obligatoria, dos embudos con salida común, «publicó» como etapa propia, activación como LinkedIn conectado y post creado, MRR normalizado (PRD §6.1 y §6.3).
- Uso real de los orígenes actuales de los registros: **sin dato** [Por verificar].

## 4. Resultado buscado
- Todo registro nuevo con canal y público (G-5 del PRD). Medición: proporción de registros nuevos sin atribuir. Línea base: sin dato.
- Cada métrica mostrada tiene una definición versionada.

## 5. Alcance
**Incluye:** H-1 a H-6.
**No incluye:**
- Conectar fuentes automáticas de producto, Stripe o PostHog (SDD 4) y las vistas de la base de datos de Postin (SDD 8): hasta entonces, «activa», «publicó» y «de pago» entran a mano o desde lo que ya existe, marcado.
- Runway y gatillo de continuidad (SDD 7); competidores y señales (SDD 6).
- Reclasificar datos anteriores: se conservan con su etapa original.
- Atribución de personas (contactos): solo leads, cuentas, pruebas y deals.

## 6. Cambios de comportamiento (delta)
**Añadido:** canal y público obligatorios en lead, cuenta, prueba y deal; cola «Sin atribuir»; coste y resultados por canal; dos embudos por modelo de venta con etapas nuevas; diccionario de métricas versionado; KPI por canal; ventas por público; ficha de conversación.
**Modificado:** el origen de texto libre pasa a ser dato de solo lectura de los registros anteriores; los dos embudos se añaden al embudo actual, que sigue funcionando; las pantallas y respuestas nuevas de esta iniciativa solo muestran métricas definidas.
**Eliminado:** nada se elimina; las etapas MQL, SQL y Oportunidad y el origen en texto libre se conservan como legado visible.

## 7. Historias y criterios de aceptación
Cada CA cita el objetivo G-n del PRD que cubre y el archivo de prueba (ruta por decidir en la implementación [Sugerencia]).

### H-1: Como Owner o Sales leader, quiero que cada canal tenga playbook, coste y resultados para decidir dónde invertir mis horas.
- **CA-1** El sistema DEBE permitir completar cada canal (SDD 1a, CA-28) con un playbook (descripción de sus tipos de tarea) y un coste por periodo; sus resultados por etapa se muestran en CA-22. · cubre G-5 · prueba: `channel-cost-results.test.ts`
- **CA-2** CUANDO existen costes anteriores con un canal escrito en texto libre, el sistema DEBE proponer vincularlos a un canal de la organización, y DEBE conservar su importe y su periodo sin cambios. · cubre G-5, G-10 · prueba: `channel-cost-results.test.ts`
- **CA-3** El sistema DEBE calcular el coste de un canal en un periodo sumando sus costes registrados, mostrando de cada coste quién lo registró y cuándo, con la marca «Manual» cuando no venga de una fuente (PRD R-1). · cubre G-5 · prueba: `channel-cost-results.test.ts`

### H-2: Como Owner o Sales leader, quiero que todo registro lleve canal y público para poder medir cada uno.
- **CA-4** MIENTRAS la fase esté activa para el rol de la persona, el sistema DEBE exigir un canal y un público elegidos de las listas de la organización cuando esa persona cree un lead, una cuenta, una prueba o un deal (los roles que ya pueden crearlos pueden elegirlos al crear), DEBE permitirle crear un público en el mismo paso si la organización aún no tiene ninguno y su rol puede crearlos, y, si no hay públicos y su rol no puede crearlos, DEBE guardar el registro como «Sin atribuir». · cubre G-5 · prueba: `attribution-required.test.ts`
- **CA-5** SI un registro llega por un camino automático (formulario, entrada externa, sincronización, importación, proveedor, detector o agente) sin canal o sin público reconocible, ENTONCES el sistema DEBE guardarlo como «Sin atribuir», visible en una cola para asignarle canal y público, y DEBE abstenerse de rechazarlo. · cubre G-5 · prueba: `attribution-required.test.ts`
- **CA-6** MIENTRAS un registro o un recorrido esté «Sin atribuir» o «Sin atribuir (anterior)», el sistema DEBE excluirlo de los KPI por canal y de las ventas por público, e indicarlo en pantalla. · cubre G-5, G-10 · prueba: `channel-kpis.test.ts`
- **CA-7** El sistema DEBE derivar los objetivos de un registro como los objetivos Activos que incluyen su público; SI no hay ninguno, ENTONCES DEBE mostrar «Sin objetivo». · cubre G-5 · prueba: `attribution-required.test.ts`
- **CA-8** El sistema DEBE conservar sin cambios el origen de texto libre y el «canal de entrada» ya existentes de los registros anteriores, y DEBE mostrar su canal de adquisición como «Sin atribuir (anterior)», sin reclasificarlos; «anterior» es todo registro creado antes de la primera activación de la fase para su organización, y reactivarla no cambia ese corte. Los registros que cree después del corte una persona cuyo rol no tiene la fase activa DEBEN mostrarse como «Sin atribuir», sin exigirles canal ni público. · cubre G-5, G-10 · prueba: `attribution-legacy.test.ts`
- **CA-32** El sistema DEBE permitir indicar en cada público su modelo de venta (asistida o autoservicio) y, MIENTRAS un público no lo tenga, DEBE mostrar sus registros como «Sin embudo» y excluirlos de los embudos. · cubre G-5 · prueba: `attribution-required.test.ts`
- **CA-9** El sistema DEBE permitir a Owner y Sales leader asignar o cambiar el canal y el público de un registro existente, y DEBE registrar en la auditoría (SDD 1a, CA-68) esos cambios. · cubre G-5, G-10 · prueba: `attribution-required.test.ts`
- **CA-39** CUANDO se crea una cuenta o un deal a partir de un lead, el sistema DEBE heredar el canal y el público del lead. · cubre G-5 · prueba: `attribution-required.test.ts`
- **CA-35** SI una importación o una sincronización trae un canal distinto del que una persona asignó a mano, ENTONCES el sistema DEBE conservar el asignado por la persona y DEBE mostrar el otro como propuesta pendiente. · cubre G-5, G-10 · prueba: `attribution-required.test.ts`
- **CA-36** El sistema DEBE registrar en la auditoría (SDD 1a, CA-68) los cambios de costes de canal, los de definiciones de métricas, los movimientos de etapa y los cambios de canal, público y vínculos de leads, cuentas, pruebas y deals. · cubre G-5, G-10 · prueba: `metrics-audit.test.ts`
- **CA-38** MIENTRAS la fase esté activa para el rol de la persona (o para la organización, en los caminos automáticos que no tienen rol), el sistema DEBE aplicar los criterios de atribución, embudos, KPI y diccionario de este SDD; para los demás roles, o mientras la fase no esté activa, DEBE mantener el comportamiento anterior sin cambios (PRD R-9; SDD 1a, CA-6). · cubre G-10 · prueba: `phase-guard.test.ts`

### H-3: Como Owner o Sales leader, quiero dos embudos con salida común para medir bien cada modelo de venta.
- **CA-10** El sistema DEBE ofrecer el embudo de venta asistida con las etapas Contactado, Respondió, Conversación (alcanzada por todo el recorrido cuando existe una ficha de conversación vinculada a uno de sus registros o a su cuenta, CA-26, con la fecha de la ficha como fecha de entrada), Demo, Prueba, Activa, Publicó y De pago. · cubre G-5 · prueba: `funnels.test.ts`
- **CA-11** El sistema DEBE ofrecer el embudo de autoservicio con las etapas Alta, Prueba, Activa, Publicó y De pago. · cubre G-5 · prueba: `funnels.test.ts`
- **CA-12** El sistema DEBE asignar cada recorrido al embudo del modelo de venta del público del primer registro atribuido (CA-32 y CA-37), y DEBE tratar Prueba, Activa, Publicó y De pago como etapas comunes a ambos. · cubre G-5 · prueba: `funnels.test.ts`
- **CA-13** El sistema DEBE guardar la fecha en que un recorrido entra por primera vez en cada etapa, sin que un retroceso la borre y conservando la fecha más antigua de cada etapa cuando se fusionan recorridos, y DEBE permitir moverlo a una etapa anterior solo indicando un motivo. · cubre G-5 · prueba: `funnels.test.ts`
- **CA-14** El sistema DEBE definir «Activa» como LinkedIn conectado y un post creado, «Publicó» como el primer post publicado, y «De pago» como una prueba convertida a un plan de pago (PRD §6.3). · cubre G-5 · prueba: `funnels.test.ts`
- **CA-15** MIENTRAS no exista una fuente automática para «Respondió», «Demo», «Activa», «Publicó» o «De pago», el sistema DEBE permitir registrarlas a mano, con la marca «Manual», su autor y su fecha. · cubre G-5, G-10 · prueba: `funnels.test.ts`
- **CA-16** El sistema DEBE conservar los registros con etapas anteriores (MQL, SQL, Oportunidad) en un legado visible con su etiqueta original y DEBE evitar convertirlos a las etapas nuevas. · cubre G-5, G-10 · prueba: `funnels-legacy.test.ts`
- **CA-31** El sistema DEBE mantener sin cambios las etapas actuales de leads, las etapas de deals configurables por organización, los plazos y los detectores que dependen de ellas, y DEBE mostrar la etapa de embudo nueva como una etapa adicional del registro. · cubre G-5, G-10 · prueba: `funnels-legacy.test.ts`
- **CA-37** El sistema DEBE agrupar en un recorrido el lead, la cuenta, la prueba y los deals que están vinculados entre sí (por el lead de origen, por la cuenta o por el deal asociado; un lead, una prueba o un deal sin vínculos forma su propio recorrido), DEBE tomar el canal y el público del registro atribuido más antiguo (por fecha de creación y, en empate, por este orden: lead, cuenta, prueba, deal), y CUANDO un vínculo nuevo une dos recorridos DEBE tomar el canal y el público del registro atribuido más antiguo del conjunto resultante. · cubre G-5 · prueba: `journeys.test.ts`
- **CA-40** El sistema DEBE permitir vincular una prueba a un lead o a una cuenta, proponiendo el vínculo por coincidencia exacta de correo (sin distinguir mayúsculas) o, solo si el dominio no figura en una única lista de dominios de correo gratuito, por dominio, ignorando los correos vacíos, y DEBE evitar vincular sin confirmación de una persona. · cubre G-5 · prueba: `journeys.test.ts`
- **CA-41** CUANDO se cambia el canal o el público de un registro, el modelo de venta de un público, un coste de canal o una versión vigente del diccionario, se confirma o se deshace un vínculo, o se unen o se separan recorridos, el sistema DEBE recalcular siempre con la atribución vigente los KPI y las ventas de todos los periodos y mostrar la fecha del cálculo, y DEBE dejar el cambio en la auditoría (SDD 1a, CA-68). · cubre G-5, G-10 · prueba: `recalculation.test.ts`
- **CA-42** El sistema DEBE permitir a Owner y Sales leader desvincular registros de un recorrido sin modificar los datos del CRM (la exclusión se guarda aparte), DEBE conservar para cada recorrido resultante las fechas de entrada de sus propios registros, y DEBE dejarlo en la auditoría. · cubre G-5, G-10 · prueba: `journeys.test.ts`
- **CA-43** SI un vínculo, nuevo o ya existente, uniría recorridos de cuentas distintas, ENTONCES el sistema DEBE guardarlo como propuesta pendiente (sin modificar los datos del CRM) hasta que Owner o Sales leader lo confirme o lo rechace, y DEBE seguir contando los recorridos por separado mientras tanto. · cubre G-5, G-10 · prueba: `journeys.test.ts`
- **CA-44** CUANDO se cambia el canal o el público de un registro que no es el más antiguo atribuido de su recorrido, o se crea un registro vinculado con un canal o un público distinto del recorrido, el sistema DEBE conservar el canal y el público del recorrido y DEBE indicarlo en pantalla. · cubre G-5 · prueba: `journeys.test.ts`

### H-4: Como Owner, quiero un diccionario de métricas versionado para que cada número signifique una sola cosa.
- **CA-17** El sistema DEBE guardar cada métrica con nombre, fórmula, unidad, fuente, dueño, versión y fecha de vigencia. · cubre G-5, G-10 · prueba: `metrics-dictionary.test.ts`
- **CA-18** El sistema DEBE incluir, desde el inicio, las definiciones de MRR normalizado, Activa, Publicó, De pago, Respuesta (cualquier contestación, incluido un no), Conversación (una ficha de conversación registrada), Coste por canal y, documentando las fórmulas que usa hoy el producto, coste de adquisición, payback y win rate (PRD §6.3 y F0-11 §3). · cubre G-5 · prueba: `metrics-dictionary.test.ts`
- **CA-19** CUANDO el Owner cambia una definición, el sistema DEBE crear una versión nueva y DEBE conservar la anterior, y los cálculos DEBEN usar la versión vigente e indicarla en pantalla. · cubre G-5 · prueba: `metrics-dictionary.test.ts`
- **CA-20** SI una pantalla o una respuesta del agente creadas por esta iniciativa tienen que mostrar una métrica que no está en el diccionario, ENTONCES el sistema DEBE mostrar «Sin definición» y DEBE abstenerse de calcularla; las pantallas y respuestas anteriores no cambian hasta que se migren. · cubre G-5, G-10 · prueba: `metrics-dictionary.test.ts`
- **CA-21** El sistema DEBE permitir solo al Owner editar el diccionario, y al Sales leader consultarlo. · cubre G-10 · prueba: `metrics-dictionary.test.ts`

### H-5: Como Owner o Sales leader, quiero ver el rendimiento por canal y las ventas por público.
- **CA-22** El sistema DEBE mostrar, por canal y periodo, el número de recorridos en cada etapa del embudo de su modelo de venta (las comunes y las de entrada), contando cada recorrido una sola vez por etapa, la conversión entre etapas (recorridos que entraron en la etapa actual en el periodo y alcanzaron la siguiente, entre los que entraron en la actual, o «Sin dato» si ninguno entró) y el coste por etapa (coste del canal en el periodo entre el total de recorridos del canal que alcanzan la etapa, sumando ambos embudos en las etapas comunes y sin repartirlo por embudo, o «Sin dato» si ninguno la alcanza o si el periodo del coste es más largo que el del KPI), con la fuente y la antigüedad de cada valor. · cubre G-5 · prueba: `channel-kpis.test.ts`
- **CA-23** El sistema DEBE mostrar, por público, la meta de MRR fijada en un objetivo, el MRR normalizado atribuido y el avance, contando el MRR de cada recorrido una sola vez: el de su suscripción de pago vigente si tiene una prueba convertida y, si no, el importe normalizado por mes de sus deals ganados, excluyendo los cobros puntuales y nunca sumando ambos. · cubre G-5 · prueba: `audience-sales.test.ts`
- **CA-24** SI un valor no tiene fuente, ENTONCES el sistema DEBE mostrar «Sin dato» y DEBE abstenerse de estimarlo. · cubre G-10 · prueba: `channel-kpis.test.ts`
- **CA-25** El sistema DEBE enlazar, desde la meta de MRR de un objetivo (guardando el enlace en esa meta), la traducción a número de clientes que vive en ICP-06 v1.3 §6, y DEBE evitar copiar sus cifras. · cubre G-5, G-10 · prueba: `audience-sales.test.ts`
- **CA-33** El sistema DEBE permitir al Owner fijar, dentro de un objetivo de ingresos, una meta de MRR por cada público del objetivo, y editarla en un objetivo ratificado DEBE crear una versión nueva (SDD 1a, CA-52). · cubre G-5 · prueba: `audience-sales.test.ts`
- **CA-34** MIENTRAS no exista una fuente de cobro, el sistema DEBE permitir registrar a mano el MRR de una prueba convertida o de un deal, marcado «Manual» con su autor y su fecha. · cubre G-5, G-10 · prueba: `audience-sales.test.ts`

### H-6: Como Owner o Sales leader, quiero registrar cada conversación sin nombres para aprender de ellas.
- **CA-26** El sistema DEBE permitir registrar una ficha de conversación con fecha, origen (frío, cálido o anterior), público, la señal que la precedió, el canal del primer toque, el número de toques y tres campos de texto (palabras que usa para el dolor, con qué compara, objeción que repite), sin campos de nombre de persona ni de empresa, y DEBE permitir vincularla a un lead, una cuenta, una prueba o un deal sin mostrar su nombre en la ficha. · cubre G-5, G-10 · prueba: `conversation-records.test.ts`
- **CA-27** El sistema DEBE advertir, junto a los campos de texto de la ficha, que no se incluyan nombres ni datos de clientes. · cubre G-10 · prueba: `conversation-records.test.ts`
- **CA-28** El sistema DEBE contar como conversaciones frías solo las fichas de origen frío, y DEBE contar las de origen cálido o anterior aparte. · cubre G-5 · prueba: `conversation-records.test.ts`
- **CA-29** El sistema DEBE ocultar al Consejo las fichas individuales y sus textos; la vista de recuentos agregados para el Consejo llega con el SDD 7. · cubre G-9, G-10 · prueba: `conversation-records.test.ts`
- **CA-30** El sistema DEBE permitir crear y editar fichas a Owner y Sales leader, y DEBE ocultarlas a los demás roles, incluido el Consejo. · cubre G-10 · prueba: `conversation-records.test.ts`

## 8. Casos límite y errores
Cada caso remite al CA que lo cubre.
- Registro externo sin canal o público → «Sin atribuir», no se rechaza (CA-5, CA-6).
- Público sin objetivo Activo → «Sin objetivo» (CA-7).
- Registros anteriores con origen libre y etapas MQL o SQL → legado intacto (CA-8, CA-16).
- Movimiento a una etapa anterior sin motivo → se rechaza explicando qué falta (CA-13).
- Fuente automática aún inexistente → entrada manual marcada (CA-15, CA-23).
- Métrica sin definición → «Sin definición» (CA-20).
- Cambio de definición con datos ya calculados → versión nueva; los cálculos usan la versión vigente y la indican (CA-19).
- Costes anteriores con canal en texto libre sin equivalente → propuesta de vínculo sin cambiar importes (CA-2).
- Ficha con nombres escritos en un campo libre → advertencia previa (CA-27).
- Otra organización → nunca ve estos datos (PRD R-10).

## 9. Experiencia y copy
Sistema visual actual (Ink + Lima, versalitas con filete, sin iconos), textos en «tú».
- **Estados de atribución:** Atribuido, Sin atribuir, Sin atribuir (anterior), Sin objetivo.
- **Etapas:** las de CA-10 y CA-11; las anteriores, con su etiqueta original.
- **Mensajes sugeridos** (a validar con la guía de voz de marca): «Este lead aún no tiene canal ni público: no cuenta en el rendimiento por canal hasta que se los asignes.» · «Esta métrica no tiene definición: no la mostramos hasta que se defina.»
- **Pantallas:** cola «Sin atribuir», embudos por modelo de venta, rendimiento por canal, ventas por público, diccionario de métricas y fichas de conversación.

## 10. Datos, permisos y privacidad
- **Conceptos nuevos:** coste y resultados del canal, atribución (canal, público y objetivos derivados) de leads, cuentas, pruebas y deals, etapa de embudo con fecha de entrada, definición de métrica (con versiones), ficha de conversación.
- **Permisos:**

| Acción | Owner | Sales leader | Consejo | Otros roles |
|---|---|---|---|---|
| Elegir canal y público al crear un registro | Sí | Sí | No | Los roles que ya pueden crearlo |
| Cambiar canal o público de un registro existente; ver la cola «Sin atribuir» | Sí | Sí | No | No |
| Ver el coste por canal, el KPI por canal y el MRR por público | Sí | Sí | No (vista agregada en SDD 7) | No |
| Crear y editar fichas de conversación | Sí | Sí | No | No |
| Ver fichas de conversación | Sí | Sí | No (recuentos en SDD 7) | No |
| Editar el diccionario de métricas | Sí | No | No | No |
| Ver el diccionario de métricas | Sí | Sí | No | No |
| Fijar la meta de MRR por público | Sí | No | No | No |
| Editar el playbook y el coste de un canal | Sí | Sí | No | No |
| Registrar a mano el MRR de una prueba o un deal; vincular una prueba a un lead o cuenta | Sí | Sí | No | No |
| Mover etapas y registrar a mano «Respondió», «Demo», «Activa», «Publicó» y «De pago»; desvincular registros de un recorrido | Sí | Sí | No | No |
| Confirmar o rechazar propuestas de vínculo (CA-43) y de atribución (CA-35) | Sí | Sí | No | No |
| Indicar el modelo de venta de un público | Sí | Sí | No | No |

- **Privacidad:** las fichas no contienen nombres de persona ni de empresa (PRD R-4); ningún dato de clientes en pruebas ni ejemplos. Los costes de canal los ven Owner y Sales leader; `canPrice` (`src/lib/agent/tool-kit.ts`) restringe hoy los costes de líneas de deal, pero no rige `cac_costs` [Por verificar con Fede si otros roles verán costes de canal]. El umbral mínimo de agregación para el Consejo se define en el SDD 7 [Por verificar con Fede].

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| ninguna en esta fase | — | — | — |

Todo el cálculo (atribución derivada, embudos, KPI, versiones de definiciones) es por reglas.

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero [Sugerencia] | Depende de |
|---|---|---|---|---|
| U-1 | Diccionario de métricas versionado y guardia de fase (cada unidad la aplica a sus criterios) | CA-17 a CA-21, CA-38 | `metrics-dictionary.test.ts`, `phase-guard.test.ts` | SDD 1a U-1 |
| U-2 | Canal con playbook, coste y resultados | CA-1 a CA-3 | `channel-cost-results.test.ts` | SDD 1a U-4 |
| U-3 | Atribución obligatoria, «Sin atribuir», modelo de venta del público, objetivos derivados y legado | CA-4, CA-5, CA-7 a CA-9, CA-32, CA-35, CA-39 | `attribution-required.test.ts`, `attribution-legacy.test.ts` | U-2, SDD 1a U-2 |
| U-4 | Dos embudos, etapas, fechas, movimientos y legado de etapas | CA-10 a CA-16, CA-31, CA-37, CA-40, CA-42 a CA-44 | `funnels.test.ts`, `funnels-legacy.test.ts`, `journeys.test.ts` | U-1, U-3, U-6 (la etapa Conversación exige fichas) |
| U-5 | KPI por canal y ventas por público | CA-6, CA-22 a CA-25, CA-33, CA-34, CA-36, CA-41 | `channel-kpis.test.ts`, `audience-sales.test.ts`, `metrics-audit.test.ts`, `recalculation.test.ts` | U-1, U-2, U-4, SDD 1a U-7 |
| U-6 | Ficha de conversación sin nombres | CA-26 a CA-30 | `conversation-records.test.ts` | U-3 |

Cada unidad añade a su prueba un caso de guardia de fase (CA-38) para sus criterios.

**Orden:** U-1, U-2, U-3, U-6, U-4, U-5. (U-6 antes de U-4 porque la etapa «Conversación» se alcanza con una ficha; U-5 al final porque cierra la auditoría de costes, definiciones y movimientos de etapa y los KPI sobre los embudos.)

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- **Caminos de creación a cubrir en CA-4 y CA-5:** `src/lib/leads-ingest.ts`, `src/routes/api/public/leads.ts`, `src/lib/leads.ts`, `src/lib/agent/tools/pipeline.ts` y `src/lib/posthog-sync.server.ts` (pruebas), además de las pantallas de alta de cuentas, deals y leads.
- **Datos:** añadir referencia a canal y público a `leads`, `accounts`, `trials` y `deals` sin eliminar `source`; reutilizar `cac_costs` (que ya tiene canal y segmento) para el coste por canal (CA-1 a CA-3) en vez de crear una tabla de costes nueva; `segment_targets` puede alimentar la meta por público (CA-23).
- **Embudos:** reutilizar `src/lib/lead-funnel.ts` y `src/lib/self-service.ts`; la tabla `trials` ya tiene `activated_at` y `converted_at`.
- **Diccionario:** módulo puro con pruebas, como `src/lib/metrics.ts`; sus definiciones documentan las fórmulas de `src/lib/revops.ts` y de los paneles; migrar esas pantallas al diccionario no entra en este SDD (CA-20).
- Migraciones aditivas con organización por defecto y políticas por organización; las 0058 y 0059 siguen sin aplicar (`src/lib/AGENTS.md`).
- **Etapas nuevas:** añadirlas como atributo propio del registro, sin tocar `leads.stage`, `deals.stage` ni `deal_stages` (configurables por organización, `src/lib/stages.ts`); el disparador de `0012_lead_funnel.sql`, los plazos (`src/lib/lead-funnel.ts`) y los detectores siguen leyendo las etapas actuales.
- **Canal frente a «canal de entrada»:** `src/lib/field-catalog.ts` ya define `deals.source` y `people.source` como «canal de entrada» (valor cerrado, 2026-10-25) y `lead_events.channel` es otro campo con ese nombre; el canal de este SDD es el de **adquisición** (de dónde viene el registro) y convive con el de entrada sin sustituirlo (decisión de Fede, 2026-10-30).
- **Recorrido:** `trials` no tiene vínculo a lead, cuenta ni deal (tiene `email` y `company`) y la sincronización con producto crea pruebas sin cuenta (`src/lib/posthog-sync.server.ts`): CA-40 añade el vínculo por confirmación; `leads.account_id` admite nulo; `deals.one_off_amount` permite excluir cobros puntuales (CA-23).
- **Correo gratuito:** el repo tiene cuatro listas de dominios de correo gratuito (`src/lib/lead-flow.ts`, `src/lib/leads.ts`, `src/lib/lead-qualification.ts` y `FREE_EMAIL_DOMAINS` en `src/lib/product-usage.ts`); CA-40 exige una sola y las demás deben leerla.
- **Costes:** `cac_costs` no tiene columna de fuente: la marca «Manual» y el autor (CA-3) exigen añadirla o registrarla aparte.
- **Dónde vive la etapa de embudo:** como atributo del lead, de la prueba y del deal (la cuenta muestra la más avanzada); el disparador de `0012_lead_funnel.sql`, que copia `source`, `segment_id` y `lead_source_id` al crear cuenta y deal, debe copiar también canal y público (CA-39).
- **Catálogo de campos:** las columnas nuevas fallan `src/lib/field-coverage.test.ts` (definiciones universales) si no se catalogan; el canal de adquisición no debe heredar la pista de `channel` hacia `canal_de_entrada`.
- Alternativa descartada: reclasificar automáticamente MQL y SQL a las etapas nuevas (se pierde la historia).

## 14. Riesgos y dependencias
- Los menores de la sexta pasada se resolvieron en la v8: disparadores del recálculo (CA-41), vincular fichas a cualquier registro y fecha de Conversación (CA-10 y CA-26), lista única de correo gratuito y coincidencia exacta sin distinguir mayúsculas (CA-40), registros de roles sin fase activa (CA-8), vínculos cruzados ya existentes, desvincular, propuestas y quién las confirma (CA-42, CA-43 y matriz), coste sin doble conteo en etapas comunes (CA-22) y creación con canal distinto al del recorrido (CA-44).
- **Menores de la séptima pasada, declarados:** (2) qué pasa con un registro «Sin atribuir» o anterior dentro de un recorrido atribuido (CA-6, CA-37, CA-8), con efecto en el MRR de CA-23; (3) definir «entrar» en una etapa si se salta alguna y el solape parcial entre periodos de coste (CA-22); (4) vincular una ficha a un registro permite reidentificarla: riesgo de privacidad a asumir frente a PRD R-4 (CA-26); (5) una ficha vinculada a una cuenta con recorridos separados de esa cuenta no tiene regla (CA-10, CA-42). Fila de matriz para las propuestas de CA-2 por completar.
- **Riesgo declarado:** el recálculo retroactivo (CA-41) cambia cifras que ya vieron decisiones o el Consejo; ningún CA de este SDD alimenta resultados clave, pero cuando los SDD 4 y 5 los conecten habrá que congelar lo visto.
- Los menores N-1 a N-6 de la quinta pasada se resolvieron en la v7: recálculo siempre con la atribución vigente (CA-41), fecha de entrada en fusiones (CA-13), desvincular y vínculos entre cuentas distintas (CA-42 y CA-43), canal de un registro que no es el más antiguo (CA-44), conversión y coste sin datos (CA-22), correos vacíos y gratuitos (CA-40), guardia en cada unidad (§12 y CA-38), dependencia de 1a U-7 (U-5) y conversación por cuenta (CA-10).
- Depende de que los SDD de salida de Lovable A y B estén cerrados para construir.
- Solape con 7a y 7c (cuentas y personas) y con el SDD de definiciones de campos (En curso): hay que coordinar las migraciones.
- «Activa», «Publicó» y «De pago» necesitan eventos de producto y cobro; si Postin no los expone o no existe billing, se registran a mano hasta el SDD 4 y el SDD 8 [Por verificar con Dani].
- Muchos puntos de creación de registros: el riesgo es dejar alguno sin exigir canal y público; CA-4, CA-5 y CA-39 deben probarse en todos.
- La definición de «Activa» (LinkedIn conectado y post creado) es anterior a publicar: se conserva «Publicó» como etapa propia para no perder esa señal.

## 15. Preguntas para Fede y para la revisión técnica
- Fede: ¿umbral mínimo de agregación de fichas para el Consejo (se decide en el SDD 7)?
- Fede: ¿el MRR atribuido cuenta una vez por recorrido (el de la suscripción vigente o, si no, el de los deals ganados), como propone CA-23?
- Fede: ¿«Respuesta» incluye cualquier contestación, también un no (F0-11 §3)? Se propone que sí.
- Revisión técnica: ¿qué hace `posthog-sync.server.ts` hoy con el origen de las pruebas, y cómo se atribuyen canal y público sin intervención?

## 16. Pendiente de verificar
- Umbral mínimo de agregación para el Consejo → Fede.
- Qué versión del disparador de leads rige en producción → datos de producción.
- Existencia de eventos de producto y de billing para «Activa», «Publicó» y «De pago» → Dani.
- Uso real de los orígenes actuales → datos de producción.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Siete pasadas del gate (agente de contexto fresco con las reglas del gate). Las cuatro primeras pusieron bloqueantes que se corrigieron (versiones v1 a v6); las tres últimas no encontraron bloqueantes. Se copian aquí sin editar los informes de la quinta, la sexta y la séptima pasada.

### Quinta pasada del gate (sobre la v6)
Agente de contexto fresco con las reglas del gate (el agente nokko-gate no estaba registrado en la sesión).

**Veredicto SDD 3:** Objeciones menores. 0 bloqueantes.

**Cuarta pasada**
- B-1 (trials sin vínculo): Resuelta. CA-40 crea el vínculo por correo o dominio con confirmación, y CA-37 lo usa.
- B-2 (orden, fusión y efecto de reasignar): Resuelta en lo escrito. CA-37 fija el orden por fecha, el desempate lead<cuenta<prueba<deal y la fusión. CA-41 recalcula periodos y audita. Quedan huecos en N-1 y N-2.
- CA-12: Resuelta (CA-12 y CA-37).
- CA-6: Resuelta.
- Fecha de «anterior»: Resuelta (CA-8). Queda la ambigüedad de N-5.
- Fecha de entrada repetida: Resuelta (CA-13).
- División entre cero: Parcial. CA-22 cubre el coste por etapa, pero no la conversión (N-3).
- Fuente de Respondió y Demo: Resuelta (CA-15).
- Guardia en la última unidad: Resuelta en el orden (CA-38 pasa a U-1). Queda N-5.
- Matriz sin CA-34: Resuelta, con el hueco de N-4.

**Problemas nuevos (todos Menor)**
- **N-1 (CA-37, CA-40, CA-41):**
  - Unir recorridos o confirmar un vínculo cambia canal, público y KPI pasados, pero CA-41 solo salta si cambia el canal de un registro.
  - Tampoco hay auditoría de vínculos, ni forma de desvincular o separar.
  - No define qué es un periodo «cerrado», ni cómo encaja con CA-19 (cálculos pasados sin cambios), ni qué fecha de entrada conserva un recorrido fusionado (CA-13).
  - No choca con PRD R-1, porque CA-22 muestra la antigüedad. Tampoco choca con 1b CA-43, que congela el valor de las puertas.
- **N-2 (CA-9, CA-41):** cambiar el canal de un registro que no es el más antiguo no cambia el del recorrido, y no se dice. 1a CA-68 no enumera leads, cuentas, pruebas ni deals.
- **N-3 (CA-22):** la conversión no tiene regla con denominador 0. Los periodos de `cac_costs` y los de KPI no se alinean.
- **N-4 (CA-37, CA-40, matriz):**
  - «Vinculados» no enumera los vínculos reales (`leads.account_id`, `leads.deal_id`, `deals.account_id`, todos nulables y sin restricción cruzada). Un lead y su deal en cuentas distintas fusionan recorridos sin avisar.
  - `trials.email` es `not null default ''`: la coincidencia debe ignorar vacíos y dominios de correo gratuito.
  - La fila de la matriz «mover etapas y registrar a mano» omite Respondió y Demo (CA-15).
- **N-5 (CA-38, CA-8, CA-5):**
  - La prueba de U-1 no puede ejercer la guardia sobre lo que nace en U-3 a U-6. Es el mismo patrón que 1a N-1.
  - CA-5 (caminos automáticos sin rol) y CA-8 («anterior» por organización, con fase por rol y reactivable) son ambiguos.
- **N-6 (U-5):** falta la dependencia de 1a U-7 (CA-33 usa 1a CA-52). Tampoco se dice si una ficha vinculada a la cuenta alcanza Conversación para todo el recorrido (CA-10, CA-26).

**Comprobaciones mecánicas (script de solo lectura)**
- SDD 3 CA 1..41: sin huecos ni duplicados (41 CA).
- SDD 2 CA 1..29: sin huecos ni duplicados (29 CA).
- Todos los CA de ambos SDD citan G-n y una prueba.
- §7 y §12 coinciden: cada CA está en una sola unidad, ninguna cita un CA ajeno y los tests de cada unidad son los de sus CA.
- El orden U-1, U-2, U-3, U-6, U-4, U-5 respeta las dependencias.
- Ningún [Por verificar] dentro de un CA (hay 4 fuera, en §3, §10 y §14).
- Ningún CA nombra tecnología.

**¿Aprobables?** Sí, por Fede para pasar a brief. Hay que declarar N-1 a N-6, o resolverlos en el brief.

**SDD 2:** sin bloqueantes nuevos.
- CA-8, CA-16 y CA-29 son coherentes con 1a y 1b.
- Menor: CA-16 admite una copia temporal en Drive, y la regla de Drive pide OK de Fede para crear.
- Menor: el §16 repite una línea.

**Lo que NO demuestra**
- No he ejecutado pruebas.
- No he comprobado qué disparador de leads rige en producción (0012 frente a 0023).
- No he leído `posthog-sync.server.ts` a fondo.
- Las columnas salen de `types.ts`, no de la base real.
- No he releído 1b entero.
- No he medido uso real.

**Respuesta del autor (v6, 2026-10-30).** Sin bloqueantes. Los menores N-1 a N-6 se declaran como riesgos (§14) y se resuelven en el brief; no se han reescrito para no abrir otra ronda sobre el recorrido. El gate informa; aprueba Fede.

**Respuesta del autor a la quinta pasada (v7, 2026-10-30).** Con las decisiones de Fede (recálculo con la atribución vigente, propuesta para vínculos entre cuentas distintas, correo exacto y dominio solo corporativo, conversación a todo el recorrido de la cuenta) se resolvieron N-1 a N-6. La pasada del gate sobre la v7 se copia a continuación sin editar.

### Sexta pasada del gate (sobre la v7)
Agente de contexto fresco con las reglas del gate (el agente nokko-gate no estaba registrado en la sesión).

**Veredicto:** Objeciones menores. 0 bloqueantes.

**N-1 a N-6**
- N-1: Resuelta. CA-41 recalcula todos los periodos con la atribución vigente, muestra la fecha del cálculo y audita. CA-13 cubre la fecha en fusiones y CA-42 desvincula. No choca con PRD R-1 (CA-22 conserva la antigüedad).
- N-2: Resuelta. CA-44 y CA-36 (que amplía el alcance de 1a CA-68).
- N-3: Resuelta. CA-22 define "Sin dato" para conversión y coste, y para periodos de coste más largos.
- N-4: Parcial. CA-43 solo cubre vínculos "nuevos" entre cuentas distintas. CA-40 ignora vacíos y correos gratuitos. La matriz ya incluye Respondió y Demo.
- N-5: Parcial. CA-38 pasa a cada unidad (§12) y CA-8 fija el corte. Queda la ambigüedad de problema 4.
- N-6: Resuelta. U-5 depende de 1a U-7, y CA-10 y CA-26 cubren la conversación por cuenta (con el matiz del problema 2).

**Problemas nuevos (todos Menor)**
1. CA-41 / 1b CA-43 / §14: el recálculo retroactivo cambia cifras que ya vieron decisiones o el Consejo, y no hay foto de lo visto. No hay choque hoy porque ningún CA de este SDD alimenta resultados clave. Falta declararlo en el §14. La lista de disparadores omite el cambio del modelo de venta de un público (CA-32, que mueve recorridos de embudo), los costes (CA-3) y las versiones del diccionario (CA-19).
2. CA-10 / CA-26: CA-10 habla de "uno de sus registros", pero CA-26 solo permite vincular fichas a lead o cuenta. Tampoco se dice qué fecha toma la entrada en Conversación (la de la ficha o la del vínculo).
3. CA-40: "correo gratuito" no tiene lista fija en el SDD. El repo tiene tres listas distintas (`lead-flow.ts`, `leads.ts`, `lead-qualification.ts`). Tampoco define si "exacto" distingue mayúsculas.
4. CA-38 / CA-8 / CA-5: no dice qué es un registro creado por un rol sin fase activa tras el corte de CA-8 (por ejemplo, un SDR). No es "anterior" ni se le exige canal.
5. CA-43 / CA-42: no cubre los vínculos cruzados que ya existen (`leads.account_id` y `deals.account_id` son nulables y sin restricción). CA-42 no dice qué fechas de entrada conserva cada recorrido tras separar, ni si desvincular toca la columna del CRM. CA-43 no aclara dónde vive una propuesta si el vínculo es una columna. Además, la matriz no dice quién confirma o rechaza propuestas (CA-43, CA-35, CA-2).
6. CA-22: el coste del canal se divide entre los recorridos de cada embudo por separado, así que el mismo coste se cuenta dos veces en las etapas comunes. CA-44 solo cubre cambios, no la creación con un canal distinto al del recorrido. CA-37 no cita pruebas ni deals sin vínculos.

**Comprobaciones mecánicas (script de solo lectura)**
- CA 1..44: sin huecos ni duplicados.
- Todos citan G-n y prueba.
- §7 y §12: cada CA está en una sola unidad, ninguna cita un CA ajeno y los tests coinciden.
- Orden U-1, U-2, U-3, U-6, U-4, U-5: respeta las dependencias.
- 0 [Por verificar] dentro de un CA (6 fuera). Ningún CA nombra tecnología.

**¿Aprobable?** Sí, por Fede para pasar a brief. Hay que declarar los problemas 1 a 6 como riesgos o resolverlos en el brief.

**Lo que NO demuestra**
- No he ejecutado pruebas.
- No he abierto `posthog-sync.server.ts` entero.
- No he comprobado qué disparador rige en producción (0012 o 0023).
- Las columnas salen de `types.ts`, no de la base real.
- No he releído 1a (líneas 391-476) ni el §17 del 1a más allá de lo copiado.
- No he medido uso real.

**Respuesta del autor (v7, 2026-10-30).** Sin bloqueantes. Los seis problemas nuevos (menores) se declararon como riesgos en el §14. A petición de Fede se resolvieron en la v8 (ver más abajo).

**Respuesta del autor a la sexta pasada (v8, 2026-10-30).** Resueltos los seis menores: CA-8, CA-10, CA-22, CA-26, CA-37, CA-40, CA-41, CA-42, CA-43 y CA-44 reescritos y fila nueva en la matriz. El informe de la séptima pasada, sobre la v8, se copia a continuación sin editar.

### Séptima pasada del gate (sobre la v8)
Agente de contexto fresco con las reglas del gate (el agente nokko-gate no estaba registrado en la sesión).

**Veredicto:** Objeciones menores. 0 bloqueantes.

**Sexta pasada**
1. Disparadores de CA-41: Resuelta.
2. CA-10 y CA-26 (ficha vinculable y fecha de entrada): Resuelta. Queda el riesgo de privacidad del nuevo problema 4.
3. CA-40 (correo exacto sin mayúsculas, lista única): Parcial. La regla está en el CA, pero §13 dice «tres listas» y el repo tiene cuatro. Falta `FREE_EMAIL_DOMAINS` en `src/lib/product-usage.ts`.
4. CA-8 (rol sin fase activa): Resuelta.
5. CA-42 y CA-43: Parcial. Desvincular, vínculos existentes y fila de matriz están resueltos. La matriz no cita las propuestas de CA-2.
6. CA-22, CA-44, CA-37: Resuelta.

**Problemas nuevos (todos Menor)**
1. CA-41 / §12: CA-41 recalcula KPI y ventas, pero cierra en U-4 y esos cálculos nacen en U-5. Es el patrón N-1 de 1a. Mover CA-41 a U-5 o acotar su prueba.
2. CA-6 / CA-37 / CA-8: no se dice qué pasa con un registro «Sin atribuir» o anterior dentro de un recorrido atribuido. CA-6 lo excluye, CA-37 lo agrupa. Afecta al MRR de CA-23 y puede reclasificar legado.
3. CA-22: no define «entrar» si se salta una etapa. Tampoco define el solape parcial entre periodos de coste.
4. CA-26 y R-4: vincular la ficha a un registro permite reidentificarla. Hay que declararlo.
5. CA-10 y CA-42: una ficha vinculada a la cuenta, con recorridos separados de esa misma cuenta, no tiene regla.
6. §17 dice «Cinco pasadas» y el PRD sigue hablando de N-1 a N-6. Son textos obsoletos.

**Comprobaciones mecánicas (script de solo lectura)**
- CA 1..44: sin huecos ni duplicados.
- Todos citan G-n y prueba.
- §7 y §12 coinciden: cada CA está en una sola unidad, ninguna cita un CA ajeno y los tests de cada unidad son los de sus CA.
- El orden U-1, U-2, U-3, U-6, U-4, U-5 respeta las dependencias declaradas.
- 0 [Por verificar] dentro de un CA (6 fuera).
- Tecnología en CA: ninguna. La coincidencia «SQL» en CA-16 es la etapa del embudo.

**¿Aprobable?** Sí, por Fede para pasar a brief. Declarar los problemas 1 a 6, o resolverlos en el brief. R-9 queda guardado por CA-38 y no choca con 1a, 1b ni 2.

**Lo que NO demuestra**
- No he ejecutado pruebas.
- No he comprobado qué disparador rige en producción (0012 o 0023).
- No he leído `posthog-sync.server.ts` a fondo.
- Las columnas salen de `types.ts`, no de la base real.
- No he releído 1b ni 2 enteros.
- No he medido uso real.

**Respuesta del autor (v9, 2026-10-30).** Sin bloqueantes. Corregido el problema 1 (CA-41 pasa a U-5 con su propia prueba), el 3 parcial (cuatro listas de correo gratuito, §13) y el 6 (textos obsoletos). Los problemas 2 a 5 se declaran como riesgos en el §14. Cada pasada nueva ha encontrado menores nuevos sobre el recorrido; el gate informa y aprueba Fede.

## 18. Delta de implementación (lo rellena el agente al entregar)
Sin entrega todavía.
