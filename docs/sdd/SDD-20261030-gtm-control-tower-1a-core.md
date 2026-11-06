# SDD-20261030-gtm-control-tower-1a-core · [Feature] Núcleo: roles, objetivos, resultados clave, públicos y canales, decisiones y retirada de LinkedIn (fase 1a)

**Tipo:** Feature · **Prioridad propuesta:** Alta
**Estado:** Aprobado por Fede el 2026-10-30 (v9, tras cinco pasadas del gate) · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-10-30
**PRD:** `docs/prd/PRD-20261030-gtm-control-tower.md` · **Depende de:** los SDD de salida de Lovable A y B (SDD-20261029-lovable-exit-a y -b) cerrados antes de construir las unidades U-1, U-2, U-3, U-4 y U-7; U-0 puede hacerse antes pero se coordina con el SDD B (su CA-12 reescribe las llamadas a Apify) · **Continúa en:** `SDD-20261030-gtm-control-tower-1b-tasks-gates-tower.md`

> Un SDD dice cómo se verifica que está bien hecho. Cada criterio de aceptación (CA-n) debe poder tener una prueba automática que lo nombre.
> Los criterios no nombran tecnología; lo técnico va en el §13 como [Sugerencia — la revisión del gate las valida].
> Las reglas transversales del PRD (§6.2, R-1 a R-10) aplican a todo este SDD. «Organización» es la empresa que usa Nokko; «cuenta» es una empresa prospecto o cliente.
> La numeración de criterios (CA-n) se conserva de la versión única anterior; por eso este SDD no es correlativo y los criterios que faltan están en el SDD 1b.

## 1. Resumen
Crea el núcleo del sistema: roles y activación por organización y rol (con el rol Consejo fuera de la lista de miembros), objetivos con estados y retro, resultados clave medibles con estado calculado por regla, públicos y canales mínimos, registro de decisiones con ratificación y versiones, y auditoría de los cambios de estrategia. Además retira cuanto antes la lectura de LinkedIn por extracción automática. En esta fase **todas las fuentes de datos de los resultados clave son manuales**: las automáticas llegan en SDD-4.

## 2. Problema y para quién
Fede no tiene un lugar donde definir qué quiere conseguir y ver si lo cumple: hoy hay tareas planas, experimentos y sugerencias sin vínculo, y ningún objetivo medible. Para Fede (Owner), Flor (Sales leader), el Consejo (lectura) y los demás roles actuales (lectura).

## 3. Evidencia y por qué ahora
- Código (repo de Nokko, solo lectura, 2026-10-30): tareas planas sin objetivo; experimentos y metas por segmento sin vínculo; un campo de texto «objectives» solo por cuenta (`account_plans.objectives`); Ciclo GTM con documentos aprobados pero sin objetivos medibles ni tareas; lectura de posts y ofertas de LinkedIn mediante un proveedor de extracción automática (herramientas del agente `linkedin_company_posts`, `linkedin_profile_posts`, `company_job_postings`).
- Documentos de Postin Core: F0-01 v6.3 (fuente del objetivo de 10.000 € MRR a 12 meses y de las 10 h/semana), F0-11 v1.2 (puertas de día 14 y 30: al menos 6 respuestas y 10 conversaciones, 4 de origen frío) e ICP-00 v2.4 (registro de decisiones con ID y dueño). Se usan como **ejemplos de la forma** de los datos, no como datos cargados por este SDD.
- Entrevista con Fede (2026-10-29/30): decisiones del PRD §6.
- Uso real de las pantallas actuales: **sin dato** [Por verificar].

## 4. Resultado buscado
- Fede crea un objetivo con resultados clave y ve su estado calculado. Medición: observación en la revisión de fase; línea base: sin dato.
- Cada decisión y su ratificación quedan registradas con ID, dueño y fecha (G-3 del PRD).
- Se deja de obtener LinkedIn por extracción automática (G-10 del PRD).

## 5. Alcance
**Incluye:** H-1, H-2 (sin CA-12 ni CA-15), H-3, H-4, H-7, H-10 y H-12.
**No incluye:**
- Iniciativas, tareas, puertas, torre de control, Plan, Inicio y menú nuevo (SDD 1b).
- Contexto estratégico y onboarding por bloques (SDD-2); atribución en leads y embudos (SDD-3); integraciones automáticas (SDD-4); chat y agente nuevos (SDD-5); señales y competidores (SDD-6); informe PDF y runway (SDD-7).
- Gráfico de evolución de resultados clave (se guarda el historial; su gráfico no se entrega ahora).
- Sincronización con herramientas externas de tareas; cualquier envío o publicación hacia el exterior.

## 6. Cambios de comportamiento (delta)
**Añadido:** rol Consejo (con alta y baja), lectura para los demás roles, pantallas Objetivos y Decisiones (ficha y lista), activación por organización y rol, objetivos, resultados clave con historial, públicos y canales mínimos, decisiones con ratificación y versiones, auditoría.
**Modificado:** nada de lo existente cambia de comportamiento; las pantallas nuevas se muestran solo a las organizaciones y roles con la fase activa.
**Eliminado:** la lectura de posts y ofertas de empleo de LinkedIn por extracción automática (los datos ya guardados se conservan).

## 7. Historias y criterios de aceptación
Cada CA cita el objetivo G-n del PRD que cubre y el archivo de prueba (ruta por decidir en la implementación [Sugerencia]).

### H-1: Como Owner, quiero roles claros y activar la fase por organización y rol para introducirla sin riesgo.
- **CA-1** El sistema DEBE aplicar la matriz de permisos del §10 por rol y por vista. · cubre G-9, G-10 · prueba: `roles-council-phase.test.ts`
- **CA-2** El sistema DEBE ofrecer el rol Consejo, guardado fuera de la lista de miembros de la organización, con acceso de solo lectura a objetivos, resultados clave, decisiones y retros, y con permiso para comentar decisiones; el SDD 1b amplía ese acceso a iniciativas (título y estado) y puertas. · cubre G-9, G-10 · prueba: `roles-council-phase.test.ts`
- **CA-3** El sistema DEBE ocultar al Consejo las tareas, cuentas, personas, fichas, llamadas y conversaciones, también cuando intente leerlas a través del agente, de Telegram o del servidor para asistentes. · cubre G-9, G-10 · prueba: `roles-council-phase.test.ts`
- **CA-4** SI un usuario solicita un elemento al que no tiene acceso, ENTONCES el sistema DEBE responder con un mensaje genérico, sin revelar si el elemento existe. · cubre G-9, G-10 · prueba: `roles-council-phase.test.ts`
- **CA-5** El sistema DEBE permitir al Owner activar o desactivar la fase por organización y, dentro de ella, por rol (primero Owner y Sales leader; después los demás roles de lectura y el Consejo). · cubre G-10 · prueba: `roles-council-phase.test.ts`
- **CA-6** CUANDO se desactiva la fase, el sistema DEBE devolver el comportamiento anterior, conservar y ocultar los datos creados, y CUANDO se reactiva DEBE mostrarlos de nuevo. · cubre G-10 · prueba: `roles-council-phase.test.ts`
- **CA-7** El sistema DEBE mantener funcionando sin cambios la configuración actual de segmentos, ICP y posicionamiento. · cubre G-10 · prueba: `roles-council-phase.test.ts`
- **CA-8** DONDE una organización tenga varios Owners, el sistema DEBE permitir a cualquiera de ellos ratificar decisiones y objetivos, y DEBE registrar cuál lo hizo. · cubre G-10 · prueba: `roles-council-phase.test.ts`
- **CA-76** MIENTRAS un usuario tenga un rol distinto de Owner, Sales leader o Consejo, el sistema DEBE darle solo lectura de objetivos, resultados clave y retros, y DEBE ocultarle decisiones, auditoría y toda edición (el SDD 1b extiende esta lectura a la hoja de ruta, las iniciativas y las tareas). · cubre G-10 · prueba: `roles-council-phase.test.ts`
- **CA-77** El sistema DEBE advertir, junto a cada campo de texto libre visible para el Consejo (retros, decisiones y comentarios), que no se incluyan datos de clientes. · cubre G-10 · prueba: `roles-council-phase.test.ts`
- **CA-81** CUANDO el Owner invita a una persona como miembro del Consejo con su correo, el sistema DEBE darle acceso solo a lo que la matriz de permisos del §10 permite al Consejo y DEBE evitar ofrecerle crear una organización. · cubre G-9, G-10 · prueba: `roles-council-phase.test.ts`
- **CA-82** CUANDO el Owner retira a un miembro del Consejo, el sistema DEBE revocar su acceso de inmediato y DEBE conservar sus comentarios con su autoría. · cubre G-9, G-10 · prueba: `roles-council-phase.test.ts`

### H-2: Como Owner o Sales leader, quiero crear y gestionar objetivos con un ciclo de vida para mantener el foco.
- **CA-9** CUANDO creo un objetivo, el sistema DEBE pedir nombre, tipo (ingresos, pipeline, activación y retención, marca) y, o bien fecha de inicio y fecha de fin (trimestre por defecto), o bien un evento de arranque y una duración, y guardarlo como Borrador. · cubre G-1 · prueba: `objectives-lifecycle.test.ts`
- **CA-10** CUANDO activo un objetivo, el sistema DEBE exigir al menos un público y al menos un resultado clave. · cubre G-1 · prueba: `objectives-lifecycle.test.ts`
- **CA-11** El sistema DEBE ofrecer los estados Borrador, Activo, Pausado, Cerrado y Archivado, con estas transiciones únicas: Borrador→Activo; Borrador→Archivado; Activo→Pausado; Activo→Cerrado; Pausado→Activo; Pausado→Cerrado; Cerrado→Archivado; y DEBE tratar un objetivo Archivado como de solo lectura. · cubre G-1 · prueba: `objectives-lifecycle.test.ts`
- **CA-13** CUANDO cierro un objetivo, el sistema DEBE exigir una retro con, por cada resultado clave, el valor final frente a la meta, y los campos «qué funcionó», «qué no» y «aprendizajes», y DEBE completar el cierre solo cuando estén rellenos. · cubre G-1 · prueba: `objectives-lifecycle.test.ts`
- **CA-14** CUANDO se completa una retro, el sistema DEBE mostrar los aprendizajes en la ficha del objetivo cerrado. · cubre G-1 · prueba: `objectives-lifecycle.test.ts`
- **CA-16** CUANDO el Owner marca un evento de arranque como ocurrido indicando su fecha, el sistema DEBE iniciar el objetivo en esa fecha y calcular su fin sumando la duración; MIENTRAS el evento no haya ocurrido, DEBE mostrar el objetivo como «Sin arrancar» (estado derivado) y DEBE omitir el cálculo de ritmo de sus resultados clave. · cubre G-1 · prueba: `objectives-lifecycle.test.ts`
- **CA-86** El sistema DEBE ofrecer una pantalla Objetivos con la lista de objetivos y su ficha (resultados clave, públicos, retro) y una pantalla Decisiones con la lista de CA-53, accesibles desde «Más herramientas» hasta que el SDD 1b entregue el menú nuevo, y DEBE mostrar en ellas la fuente y la antigüedad de cada valor de resultado clave (PRD R-1). · cubre G-1, G-3 · prueba: `objectives-lifecycle.test.ts`

### H-3: Como Owner o Sales leader, quiero resultados clave numéricos con estado calculado para saber si voy en ritmo.
- **CA-17** CUANDO creo un resultado clave, el sistema DEBE pedir nombre, unidad (texto libre), valor inicial, meta, fecha de inicio (por defecto la del objetivo), fecha meta (no posterior al fin del objetivo) y fuente, que en esta fase DEBE ser manual. · cubre G-1 · prueba: `key-results.test.ts`
- **CA-18** SI la meta es igual al valor inicial, o la fecha meta es anterior o igual a la fecha de inicio, ENTONCES el sistema DEBE rechazar el resultado clave y explicar qué corregir. · cubre G-1 · prueba: `key-results.test.ts`
- **CA-19** CUANDO se introduce un valor manual, el sistema DEBE guardarlo con fecha, autor y marca «Manual», y DEBE conservar el historial de todos los valores. · cubre G-1 · prueba: `key-results.test.ts`
- **CA-20** El sistema DEBE calcular el avance esperado a hoy como la interpolación lineal entre el valor inicial y la meta según la fecha, siendo 0 % antes de la fecha de inicio y 100 % desde la fecha meta. · cubre G-1 · prueba: `key-results.test.ts`
- **CA-21** El sistema DEBE calcular el avance real como (valor actual − valor inicial) / (meta − valor inicial), admitiendo valores negativos o superiores al 100 %, y DEBE funcionar igual cuando la meta es menor que el valor inicial. · cubre G-1 · prueba: `key-results.test.ts`
- **CA-22** El sistema DEBE asignar el estado En ritmo si el avance real alcanza al menos el 80 % del esperado (o la meta ya está alcanzada), Atención si está entre el 50 % (incluido) y el 80 % (excluido), En riesgo si es menor del 50 % o si el esperado es 0 y el real es negativo, y Sin dato si no hay valor; los umbrales (fuente: decisión de Fede) DEBEN ser fijos y estar visibles en la pantalla. · cubre G-1 · prueba: `key-results.test.ts`
- **CA-23** El sistema DEBE mostrar como estado del objetivo el del peor de sus resultados clave con dato reciente, y DEBE mostrar Sin dato reciente cuando todos sus resultados clave con dato están en ese estado, y Sin dato cuando ninguno tiene dato o no tiene resultados clave. · cubre G-1 · prueba: `key-results.test.ts`
- **CA-24** DONDE un resultado clave tenga fuente automática (SDD-4), SI su valor no se actualiza en más del doble de su intervalo de sincronización, ENTONCES el sistema DEBE mostrar el último valor con su antigüedad y el estado «Sin dato reciente», y DEBE omitir el cálculo de En ritmo, Atención y En riesgo. · cubre G-1 · prueba: `key-results.test.ts`

*Ejemplo de CA-20 a CA-22 (datos ficticios):* valor inicial 0, meta 100, fecha de inicio 1 de octubre, fecha meta 31 de diciembre; el 15 de noviembre el esperado es 50 %; con un valor actual de 30, el avance real es 30 % y representa el 60 % del esperado, así que el estado es Atención.

### H-4: Como Owner o Sales leader, quiero públicos y canales mínimos para que los objetivos tengan a quién y por dónde.
- **CA-25** El sistema DEBE permitir crear un público con nombre, descripción, nivel de evidencia (Verificado, Hipótesis o Falta) y, opcionalmente, un segmento existente. · cubre G-1 · prueba: `audiences-channels.test.ts`
- **CA-26** El sistema DEBE permitir asignar un mismo público a varios objetivos sin duplicarlo. · cubre G-1 · prueba: `audiences-channels.test.ts`
- **CA-27** MIENTRAS un público esté en Hipótesis, el sistema DEBE mostrar junto a él la regla «una hipótesis no justifica gasto comercial ni presupuesto de canal» como información, sin bloquear. · cubre G-1 · prueba: `audiences-channels.test.ts`
- **CA-28** El sistema DEBE ofrecer un catálogo de canales con LinkedIn orgánico, Outbound, Contenido y SEO, y Partners y eventos; DEBE permitir añadir otros con nombre único y descripción, y DEBE rechazar nombres duplicados (coste y resultados llegan en SDD-3). · cubre G-1 · prueba: `audiences-channels.test.ts`
- **CA-29** CUANDO se archiva un público usado por objetivos Activos, el sistema DEBE conservarlo en esos objetivos hasta que se cierren. · cubre G-1 · prueba: `audiences-channels.test.ts`

### H-7: Como Owner, quiero un registro de decisiones con ratificación para que lo acordado quede trazable.
- **CA-49** El sistema DEBE guardar cada decisión con un ID legible de la forma DEC-AAAAMMDD-n (la fecha en la zona horaria de la organización, por defecto Europe/Madrid, y n un contador del día dentro de la organización), título, dueño, estado, qué bloquea (objetivo, puerta, tarea o documento), fecha y nota, y DEBE crearla en estado Abierta, salvo las que se registran al confirmar una puerta (SDD 1b), que nacen en estado Cerrada (la decisión «Qué hacemos» de 1b CA-46 nace Abierta); DEBE garantizar IDs únicos dentro de la organización aunque haya altas simultáneas, y el ID ya asignado no cambia si después cambia la zona horaria. · cubre G-3 · prueba: `decisions-ratification.test.ts`
- **CA-50** El sistema DEBE permitir solo estas transiciones de una decisión: Abierta→Cerrada; Cerrada→Ratificada; desde cualquier estado →Reemplazada, indicando la decisión que la reemplaza; y desde cualquier estado →Archivada. · cubre G-3 · prueba: `decisions-ratification.test.ts`
- **CA-51** El sistema DEBE permitir solo al Owner ratificar decisiones y objetivos, y CUANDO lo hace DEBE fijar la fecha y un ID de ratificación de la forma RAT-AAAAMMDD-n. · cubre G-3 · prueba: `decisions-ratification.test.ts`
- **CA-52** CUANDO alguien edita un objetivo o una decisión ratificados, el sistema DEBE crear una versión nueva, conservar la anterior y marcar el elemento «Modificado tras ratificación» hasta que el Owner lo ratifique de nuevo (los valores manuales de resultados clave y las tareas no cuentan como edición del objetivo). · cubre G-3 · prueba: `decisions-ratification.test.ts`
- **CA-53** El sistema DEBE ofrecer una lista de decisiones filtrable por estado y por lo que bloquean, y DEBE permitir crear una decisión desde ella. · cubre G-3 · prueba: `decisions-ratification.test.ts`
- **CA-54** El sistema DEBE permitir al Owner, al Sales leader y al Consejo comentar decisiones, y DEBE impedir al Consejo ratificarlas. · cubre G-9 · prueba: `decisions-ratification.test.ts`

### H-10: Como Owner, quiero auditoría de la estrategia para saber quién cambió qué.
- **CA-68** El sistema DEBE registrar quién, qué, cuándo y si fue una persona o el agente, en los cambios de objetivos, resultados clave, iniciativas, tareas, públicos, canales, puertas y decisiones y, donde existan, de conexiones. · cubre G-3 · prueba: `roles-council-phase.test.ts`
- **CA-69** El sistema DEBE mostrar la auditoría solo al Owner. · cubre G-3 · prueba: `roles-council-phase.test.ts`
- **CA-70** DONDE el agente haga cambios de estrategia (SDD-5), el sistema DEBE permitir al Owner deshacerlos durante 24 horas (plazo decidido por Fede). · cubre G-3 · prueba: `roles-council-phase.test.ts`

### H-12: Como Owner, quiero retirar cuanto antes la lectura de LinkedIn por extracción automática para cumplir la regla de API oficial.
- **CA-73** El sistema DEBE dejar de obtener, en cualquier punto (pantallas, agente, tareas programadas, detectores de señales y servidor para asistentes), posts y ofertas de empleo de LinkedIn por extracción automática. · cubre G-10 · prueba: `linkedin-scrape-removal.test.ts`
- **CA-74** CUANDO se retira esa lectura, el sistema DEBE conservar los datos ya guardados y mostrarlos con su origen y su antigüedad. · cubre G-10 · prueba: `linkedin-scrape-removal.test.ts`
- **CA-75** El sistema DEBE mantener las reseñas de competidores obtenidas de fuentes que no son LinkedIn. · cubre G-10 · prueba: `linkedin-scrape-removal.test.ts`

## 8. Casos límite y errores
Cada caso remite al CA que lo cubre.
- Objetivo sin resultados clave → no se puede activar (CA-10); su estado es Sin dato (CA-23).
- Resultado clave sin valor → Sin dato (CA-22).
- Antes de la fecha de inicio o tras la fecha meta → esperado 0 % o 100 % (CA-20).
- Meta menor que el valor inicial, meta superada, avance negativo → CA-21 y CA-22.
- Dato automático desactualizado → CA-24 (cuando existan fuentes automáticas).
- Evento de arranque sin ocurrir → CA-16.
- Un público compartido se archiva → CA-29.
- Fase desactivada con datos creados → CA-6.
- Consejo o demás roles abren un enlace directo a algo que no ven → CA-4.
- Varios Owners → CA-8.
- Otra organización → nunca ve estos datos (PRD R-10).

## 9. Experiencia y copy
Sistema visual actual (Ink + Lima, versalitas con filete, sin iconos), textos en «tú».
- **Estados:** En ritmo, Atención, En riesgo, Sin dato, Sin dato reciente; Sin arrancar (solo objetivos); Borrador, Activo, Pausado, Cerrado, Archivado; Abierta, Cerrada, Ratificada, Reemplazada, Archivada.
- **Mensajes sugeridos** (a validar con la guía de voz de marca): «Esta meta no puede ser igual al valor inicial: cambia una de las dos.» · «No hay dato reciente de esta fuente. Mostramos el último valor, de hace X días.»

## 10. Datos, permisos y privacidad
- **Conceptos nuevos:** Objetivo, Resultado clave (con historial de valores), Evento de arranque, Público mínimo, Canal mínimo, Decisión (con versiones), Comentario, Retro, Entrada de auditoría, registro de los miembros del Consejo.
- **Matriz de permisos de este SDD** (el SDD 1b la completa con tareas y puertas):

| Acción | Owner | Sales leader | Consejo | Otros roles |
|---|---|---|---|---|
| Crear y editar objetivos, resultados clave, públicos y canales | Sí | Sí | No | No |
| Activar, pausar y cerrar objetivos | Sí | Sí | No | No |
| Ratificar decisiones y objetivos | Sí | No | No | No |
| Crear decisiones | Sí | Sí | No | No |
| Comentar decisiones | Sí | Sí | Sí | No |
| Ver objetivos, resultados clave, públicos, canales y retros | Sí | Sí | Sí | Sí |
| Ver decisiones | Sí | Sí | Sí | No |
| Invitar y retirar miembros del Consejo | Sí | No | No | No |
| Ver auditoría | Sí | No | No | No |
| Activar la fase por organización y rol | Sí | No | No | No |

- **Privacidad:** ningún dato de clientes en notas ni pruebas; ejemplos con datos ficticios. Los textos libres que ve el Consejo llevan advertencia (CA-77). Los datos de cada organización no se cruzan (PRD R-10).

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| ninguna en esta fase | — | — | — |

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero [Sugerencia] | Depende de |
|---|---|---|---|---|
| U-0 | Retirada de la lectura de LinkedIn por extracción automática | CA-73 a CA-75 | `linkedin-scrape-removal.test.ts` | — (coordinar con Lovable B) |
| U-1 | Roles, almacén del Consejo fuera de los miembros, aislamiento, activación por organización y rol, alta y baja del Consejo, y el mecanismo de auditoría | CA-3 a CA-5, CA-7, CA-69, CA-70 | `roles-council-phase.test.ts` | Lovable A y B |
| U-2 | Objetivos: creación y estados | CA-9, CA-11 | `objectives-lifecycle.test.ts` | U-1 |
| U-4 | Públicos y canales mínimos | CA-25 a CA-29 | `audiences-channels.test.ts` | U-2 |
| U-3 | Resultados clave, historial, estados 80/50; activar, cerrar con retro y evento de arranque | CA-10, CA-13, CA-14, CA-16 a CA-24 | `key-results.test.ts`, `objectives-lifecycle.test.ts` | U-2, U-4 |
| U-7 | Decisiones, ratificación, versiones y comentarios; lo que ve cada rol de solo lectura; pantallas Objetivos y Decisiones | CA-1, CA-2, CA-6, CA-8, CA-49 a CA-54, CA-68, CA-76, CA-77, CA-81, CA-82, CA-86 | `decisions-ratification.test.ts`, `roles-council-phase.test.ts`, `objectives-lifecycle.test.ts` | U-3, U-4 |

**Orden:** U-0, U-1, U-2, U-4, U-3, U-7. U-7 va al final porque cierra los criterios de permisos, ratificación y lectura que se refieren a objetivos, resultados clave, públicos, decisiones y retros de las unidades anteriores. CA-68 (auditoría) se completa para las entidades de 1b en el SDD 1b (CA-89). (U-0 primero porque la regla de API oficial no admite esperar; U-1 antes que el resto porque todo depende de roles y activación; U-2 antes de U-4 porque un público se asigna a objetivos; U-4 antes de U-3 porque activar un objetivo exige un público.)

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- **Rol del Consejo** (hallazgo del gate, decidido por Fede): no puede vivir en `org_members`, porque las políticas de unas 29 migraciones se basan en `is_org_member` y le darían lectura y escritura sobre todo el CRM (`drizzle/migrations/0002_multitenant_organizations.sql:120-123`). Decisión: tabla aparte con políticas solo sobre tablas y vistas nuevas, columnas limitadas en una vista (las políticas filtran filas, no columnas) y bloqueo explícito en el agente, Telegram y el servidor para asistentes (`src/lib/agent.functions.ts:15-19`, `src/lib/channel-ctx.server.ts:11-15`). Los siete roles actuales distintos de Owner y Sales leader ya están en el enum de 9 valores (`src/lib/roles.ts:1-11`) y el Consejo no entra en él (vive fuera de `org_members`), así que no hay que tocar el enum; `Object.keys(ROLES)` en `advisor.ts:165` e `index.tsx:77`, y `Object.entries` en `team.tsx:21`, no incluirán al Consejo. `use-me.ts` y `org_invites` solo conocen `org_members`: el alta del Consejo (CA-81) necesita su propio flujo para que un usuario sin pertenencia no caiga en el flujo de crear empresa.
- **Alta del Consejo fuera de `org_members`:** `guard_current_org` exige `org_members` para fijar `current_org_id` (`drizzle/migrations/0002_multitenant_organizations.sql:68-74`), `org_invites.role` es `app_role not null` (`0002:20`) y los valores por defecto `current_org()` no sirven a una tabla de miembros del Consejo; el alta, el acceso y el alcance por organización necesitan su propia comprobación.
- **Activación por organización y rol:** `organizations` no tiene columna de ajustes (`src/integrations/supabase/types.ts:3557-3567`); hace falta una tabla nueva.
- **Deshacer del agente:** `agent_pending_actions` no tiene caducidad ni deshacer; el deshacer actual solo borra lo creado y solo lo hace el Owner (`src/lib/agent.functions.ts:120-135`). El plazo de 24 horas de CA-70 es nuevo.
- **Retirada de LinkedIn** (más puntos que los previstos): `src/lib/agent/tools/linkedin.ts`, `src/components/linkedin.tsx`, `linkedinSignalItems` en `src/lib/web-research-core.ts:101-106` (job semanal y detector de señales), posts de stakeholders en `src/lib/ai-core.ts:99-104`, y las ramas de LinkedIn de `src/lib/apify.functions.ts`, `src/lib/inngest/job-runner.server.ts` y `src/lib/orchestrator/planner.ts`, además de `src/lib/mcp/tools/agent-tools.ts` y `.lovable/mcp/manifest.json`. **Conservar** el job de reseñas de competidores (`battlecard`, `src/lib/inngest/job-runner.server.ts:71`), `competitor_reviews` y `create_battlecard_from_reviews` (usan G2, no LinkedIn).
- Reglas puras con pruebas (como `revops.ts`, `headlines.ts`, `swipe.ts`).
- Migraciones aditivas con organización por defecto y políticas por organización; probar con dos organizaciones ficticias. Las migraciones 0058 y 0059 están sin aplicar (`src/lib/AGENTS.md`); CA-68 sobre conexiones depende de `org_connection_events`, que solo existe en 0059.
- Alternativa descartada: meter al Consejo como un rol más de `org_members` cambiando las políticas de todas las tablas (mucho riesgo).

## 14. Riesgos y dependencias
- Depende de que los SDD de salida de Lovable (A y B) estén cerrados. U-0 va primero y el SDD B reescribe las llamadas a Apify (su CA-12): si B se ejecuta antes, U-0 se aplica sobre su resultado. Las migraciones 0058 y 0059 no están aplicadas y la numeración de las nuevas migraciones de esta iniciativa está por fijar.
- Seguridad del Consejo: sin tabla aparte y bloqueo en el agente, Telegram y el servidor para asistentes, vería datos de clientes (CA-3); los textos libres que ve pueden filtrar datos (CA-77). Exige pruebas con dos organizaciones ficticias.
- En esta fase todo valor entra a mano: el avance depende de que se actualice.
- Los criterios condicionales (CA-24 y CA-70, que dependen de SDD-4 y SDD-5) se prueban con un doble de la función futura; su prueba definitiva se añade cuando existan.

## 15. Preguntas para Fede y para la revisión técnica
- Sin preguntas abiertas para Fede en este SDD (las decisiones de roles, plazo de deshacer, ID de decisión y zona horaria están cerradas en el PRD §6.1).
- Revisión técnica: qué tablas nuevas necesitan políticas distintas para el Consejo y para los demás roles de solo lectura.

## 16. Pendiente de verificar
- Uso real de las pantallas actuales → datos de producción.
- Compatibilidad de la migración con Lovable A y B y numeración de migraciones → gate (bloquea construir, no aprobar).
- Qué herramientas de reseñas de competidores dependen de LinkedIn (CA-75) → gate.
- Textos de interfaz contra la guía de voz de marca (§9) → Fede / guía.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Agente de contexto fresco con las reglas del gate (el agente `nokko-gate` no estaba registrado en la sesión).

Informe del gate sobre la v3 de este SDD y el PRD, copiado sin editar. Agente de contexto fresco con las reglas del gate (el agente `nokko-gate` no estaba registrado en la sesión).

**Veredicto del gate: Objeciones**

**CA sin prueba posible o sin G-n**
- Los 75 CA citan un G-n que existe (G-1, G-2, G-3, G-9, G-10) y un archivo de prueba. Ningún CA nombra tecnología.
- CA-70, CA-38 y CA-24 dependen de funcionalidad que no existe en esta fase (SDD-4 y SDD-5). La prueba solo puede simularla.
- CA-62 («se distinga qué bloquea a qué») no se responde con sí o no. CA-57 («evitar depender solo del color») tampoco.
- CA-59, CA-71 y CA-72 apuntan a `control-tower-headlines.test.ts`, que por su nombre no es el sitio de la hoja de ruta ni de la edición concurrente.
- CA-1 define permisos solo para Owner, Sales leader y Consejo. `app_role` tiene 9 roles (`roles.ts:1-11`, `0000_migration.sql:1`), así que los otros 7 quedan sin definir.

**[Por verificar] que sigue sin comprobarse**
- Uso real de las pantallas.
- Cantidad de tareas y experimentos a migrar (producción).
- Eventos de activación en Postin.
- Reglas CA-23, CA-24 y CA-49, el horizonte de 14 días y el umbral de agregación: decisiones de Fede.
- Contenido de F0-01, F0-11 e ICP-00 en Drive: no lo he leído.

**Contradicciones con el código o con decisiones previas**
1. **Plazo de 24 h (CA-70, §13).** El README (línea 36) y el SDD de acciones de campo (CA-5) lo fijan para borrar y guardar campos, no para cambios del agente. En el código no hay ventana de tiempo. El deshacer actual borra lo creado y solo lo hace el Owner (`src/lib/agent.functions.ts:120-135`). `agent_pending_actions` no tiene caducidad ni deshacer (`types.ts:485-500`).
2. **«Campo objectives» (PRD §3 y SDD §3).** Existe, pero solo en `account_plans.objectives`, por cuenta (`types.ts:75`). No es un campo de estrategia.
3. **Configuración de organización (§13).** `organizations` no tiene columna de ajustes (`types.ts:3557-3567`). La activación por organización y rol necesita una tabla nueva, no «apoyarse en la existente».
4. **Orden contra Lovable.** El SDD depende de que A y B estén cerrados, pero U-0 va primero «porque no admite esperar». Ambos siguen en Borrador. B reescribe las llamadas a Apify (CA-12), que U-0 retira.
5. **Migraciones 0058 y 0059** («NOT VERIFIED», no aplicadas; `src/lib/AGENTS.md`). A decide que se aplican después de verificar. CA-68 («conexiones donde existan») depende de `org_connection_events`, que solo existe en 0059. El SDD no lo menciona. Tampoco fija la numeración de sus migraciones.
6. **CA-71 frente a `mergeServerEdits`** (`src/lib/merge-edits.ts:5-10`). La función conserva lo que la persona ha cambiado sin guardar y descarta el valor del servidor. CA-71 pide lo contrario (conservar el último confirmado y avisar de lo perdido). La función no avisa de nada. No basta con fusionar.
7. **§13 y CA-41.** El §13 dice extender `gtm_experiments`; CA-41 dice convertir el experimento en iniciativa conservando el original.
8. **Orden de unidades.** U-2 exige público (U-4), resultado clave (U-3) y horas planificadas (U-5), que vienen después (CA-10, CA-12, CA-13, CA-15, CA-16). CA-54 (U-7, tramo A) cita puertas (U-6, tramo B). CA-68 se aplica a entidades de unidades posteriores.

**Hallazgos de código que cambian el diseño**
- **Rol Consejo en RLS.** Las políticas de unas 29 migraciones (88 usos) se basan en `is_org_member`. Ejemplos: `0002_multitenant_organizations.sql:120-123`, `0007_agent_proactive_channels.sql:19-22` para `tasks`, y `0003_theory_u.sql:80-83` para `gtm_experiments`. Un Consejo dentro de `org_members` leería y escribiría todas las tablas existentes, incluidas cuentas, personas, leads y llamadas. CA-3 solo se cumple si se cambia `is_org_member` o si el Consejo vive fuera de `org_members` (tabla aparte con políticas solo sobre tablas nuevas). §13 («migraciones aditivas») no lo ve. También hay que decidir el valor del enum (`ALTER TYPE ADD VALUE`) y los `Record<Role,…>` de `roles.ts`.
- **Otros accesos del Consejo.**
  - El agente, Telegram y MCP construyen contexto desde `org_members` (`agent.functions.ts:15-19`, `channel-ctx.server.ts:11-15`). Telegram usa el cliente privilegiado. Sin bloqueo explícito, el Consejo lee CRM por el agente.
  - Los textos libres de retro, decisión y comentario pueden filtrar datos de clientes al Consejo (R-4).
  - CA-2 pide ver iniciativas solo con título y estado. RLS filtra filas, no columnas.
- **Tareas.** `tasks` tiene `done boolean`, sin estado ni iniciativa (`types.ts:4764-4780`). Hay 8 puntos de inserción:
  - `quick-actions.tsx:68,152`
  - `debates.tsx:88`
  - `core-write.ts:186`
  - `create_task` de autopilot y de los detectores
  - MCP

  El SDD solo dice «la tarea nueva cuelga de una iniciativa» (§6). CA-31 y la G-2 del PRD («ninguna tarea sin iniciativa») chocan con R-3 (el agente crea tareas) y con R-9 (fase desactivada = comportamiento anterior). Los lectores de `done` son `briefing.tsx:33`, `daily-email.server.ts:32` y las herramientas del agente.
- **Retirada de LinkedIn (CA-73).** La extracción sale por más sitios que los del §13:
  - `web-research-core.ts:101-106`: `linkedinSignalItems` dentro de `refreshSignalsCore`, que corre en el job semanal y el detector `account_signal`.
  - `ai-core.ts:99-104`: posts de stakeholders.
  - `apify.functions.ts` y `job-runner.server.ts:71`.
  - `planner.ts:4` (servicio apify).
  - `mcp/tools/agent-tools.ts:10,22-25` y `.lovable/mcp/manifest.json`.

  CA-73 dice «pantallas y agente», así que la prueba puede pasar con el job semanal aún extrayendo.
- **Comprobado y correcto.**
  - Existen `secret-box.server.ts` (AES-GCM con `INTEGRATION_KEYS_SECRET`) y `connections-core.ts:65` (falta el almacén).
  - Existen `segment_targets`, `gtm_experiments` y `personas.ts`.
  - Las 3 herramientas están en `linkedin.ts:11,22,33`.
  - `competitor_reviews` y `create_battlecard_from_reviews` usan G2, no LinkedIn (`apify.ts:10`), así que CA-75 es viable.
  - Hay 101 herramientas del agente (PRD «orden de cien»).
  - `headlines.ts` existe.
  - `finance_settings` tiene `opening_cash` y `horizon_months` (`types.ts:1901-1909`).
- **PRD frente a la plantilla.** Falta el §9 Aprobación, y la tabla de decisiones no tiene la columna «Quién y cuándo».

**Lo que esta revisión NO demuestra**
- Nada sobre producción, datos reales, Drive ni Stripe.
- Que las políticas RLS del destino de Lovable coincidan con las migraciones.
- Que ningún CA choque con las pantallas, que no he abierto.
- Que los SDD 6, 7a y 7c, y los de Theory U y Drive, no choquen. Solo he contrastado A, B, el paraguas y 7b.
- Que el diseño de seguridad del Consejo sea suficiente: solo señalo los huecos.

### Segunda pasada del gate (sobre la v5)
Agente de contexto fresco con las reglas del gate (el agente nokko-gate no estaba registrado en la sesión).

**Veredicto del gate: Objeciones**

Comprobado en el texto y el código: CA-1 a CA-79 sin duplicados ni huecos (1a 40 CA, 1b 39). Todos citan un G-n existente en el PRD y una prueba nombrada. Las unidades de cada SDD cubren todos sus CA y ninguna cita un CA ajeno. Los nombres de archivos de prueba coinciden entre §7 y §12.

**Objeciones previas**
- CA-70, CA-38 y CA-24 sin funcionalidad que probar: **No resuelta**. Siguen en condicional («DONDE…») y dependen de SDD-4 o SDD-5. CA-70 sí cita la decisión de Fede de 24 h.
- CA-62 y CA-57 no verificables: **Resuelta**.
- Nombres de prueba de CA-59, CA-71 y CA-72: **Resuelta**. CA-60, CA-61 y CA-65 a CA-67 siguen en `control-tower-headlines.test.ts`.
- CA-1 con solo tres roles: **Parcial**. CA-76 y CA-79 cubren a los otros siete, pero chocan con la hoja de ruta (ver nuevo 1).
- Plazo de 24 h: **Parcial**. Hay decisión, pero el deshacer actual borra (`agent.functions.ts:120-135`) y R-7 y CA-40 exigen archivar.
- «objectives», tabla de activación y CA-71 frente a `mergeServerEdits`: **Resuelta**.
- §13 frente a CA-41 y tareas del agente (CA-31, CA-78): **Resuelta**.
- Retirada de LinkedIn (CA-73): **Parcial**. Ver nuevo 7.
- Orden de unidades: **Parcial**. CA-68 lo cierra U-1, pero ninguna unidad de 1b lo cierra para iniciativas, tareas y puertas.
- Orden con Lovable A y B: **Parcial**. La cabecera de 1a cita «U-1 a U-7», pero U-5 y U-6 son de 1b.
- Migraciones 0058 y 0059: **Parcial**. La dependencia de CA-68 está declarada, pero la numeración está por fijar.
- Rol Consejo en RLS: **Parcial**. El diseño es correcto, pero ver nuevo 3.

**Problemas nuevos**
1. **Roles de solo lectura.** CA-59 pone puertas en la hoja de ruta (1b:80), pero CA-76 (1a:54) y la matriz (1b:127) ocultan las puertas a los otros siete roles. CA-14 muestra aprendizajes de retros que la matriz de 1a (:132) oculta a esos roles. CA-55 y CA-63 mezclan tareas, puertas y decisiones sin decir qué ve cada rol. El Consejo no ve tareas (1b:128), pero la torre las muestra.
2. **Barra móvil (CA-66).** Incluye Decisiones, que los otros siete roles no ven (CA-76). Incluye Plan y Agente, que el Consejo no tiene. CA-65 dice «para mi rol», pero `src/lib/nav.ts` no tiene lógica por rol.
3. **Consejo sin ciclo de vida.** Ningún CA define cómo se invita, se alta o se retira a un miembro del Consejo, ni quién puede. `use-me.ts` y `org_invites` solo conocen `org_members` y `app_role`. Un usuario sin pertenencia caería en el flujo de crear empresa.
4. **1a sin pantallas.** CA-9, CA-14, CA-22 y CA-53 exigen pantallas, pero la torre, el menú y «Objetivos (torre y decisiones)» están solo en U-8 de 1b. Tras entregar 1a nadie llega a objetivos ni decisiones.
5. **1a exige cosas que solo entrega 1b.** CA-1, CA-2 y CA-76 (1a) piden ver iniciativas y puertas. CA-8 pide confirmar puertas. CA-77 pide la advertencia junto a los comentarios, y los comentarios nacen en CA-54 (1b).
6. **CA-40 (1b) choca con CA-11 y CA-50 (1a).** CA-40 manda archivar al «borrar» objetivo, resultado clave, decisión o público. CA-11 solo permite Cerrado→Archivado y CA-50 no tiene estado Archivada.
7. **Retirada de LinkedIn.** El §13 de 1a manda retirar `apify.functions.ts`, `job-runner.server.ts:71` y `planner.ts:4`. Ese `job-runner.server.ts:71` es el job `battlecard` (reseñas de G2), que CA-75 conserva. Falta la separación.
8. **Roles.** `src/lib/roles.ts` no contiene ningún `Record<Role,…>`, aunque 1a §13 lo cita. Solo hay `Object.keys(ROLES)` en `advisor.ts:165`, `team.tsx:21` e `index.tsx:77`. Los otros siete roles ya están en el enum de 9 valores y el Consejo no entra, así que no hay que tocar el enum. 1a §13 aún dice «Decidir».
9. **Tareas existentes.** `quick-actions.tsx:68,152` crea tareas de persona sin iniciativa. Ningún CA dice qué pasa con esas rutas cuando la fase está activa. Tampoco hay CA sobre cómo `briefing.tsx` y `daily-email.server.ts` tratan las propuestas «Sin asignar» y las archivadas.
10. **CA-23.** No define cómo cuenta un resultado clave con «Sin dato reciente» ni uno de un objetivo «Sin arrancar». El titular §9 hereda el hueco.
11. **DEC-AAAAMMDD-n.** No fija zona horaria ni unicidad por organización. CA-45 y CA-46 crean decisiones sin dueño definido.

**CA sin prueba posible o sin G-n**
Todos tienen G-n y prueba nombrada. Vacíos por depender de otro SDD: CA-24, CA-38 y CA-70. CA-58 («cifra de negocio») es ambiguo.

**[Por verificar] que bloquean la aprobación**
- Zona horaria de la organización: sin ella no hay prueba determinista de CA-37, CA-48 ni del ID DEC.
- Numeración de migraciones y estado de Lovable A y B: bloquea construir, no aprobar.
- Decisión del enum y de los roles (nuevo 8).

**Pueden esperar:** uso real de las pantallas; cantidad de tareas y experimentos; umbral de agregación de R-4; la regla «doble del intervalo» de CA-24 (hasta SDD-4); textos contra la guía de voz.

**Lo que esta revisión NO demuestra**
- Nada sobre producción, Drive, F0-01, F0-11 ni ICP-00.
- Que las políticas RLS reales coincidan con las migraciones.
- Que el Consejo sea seguro: no he ejecutado pruebas.
- No he abierto las pantallas ni revisado los SDD de Lovable A y B, más allá de que su CA-12 trata las llamadas a Apify.

**Respuesta del autor a la primera pasada (v5, 2026-10-30).** Cada objeción se ha tratado en el texto: plazo de 24 h confirmado por Fede (CA-70); «objectives» corregido; activación en tabla nueva (§13); coordinación de U-0 con Lovable B y migraciones 0058/0059 (cabecera, §13, §14); Consejo fuera de `org_members` con bloqueo en agente, Telegram y MCP (CA-2, CA-3, CA-77, §13); los demás roles con lectura (CA-76); retirada de LinkedIn ampliada a todos los puntos (CA-73); unidades reordenadas con sus dependencias (§12). Las objeciones sobre tareas, ediciones simultáneas y la torre (CA-31, CA-41, CA-57, CA-59, CA-62, CA-71) se tratan en el SDD 1b. El gate informa; aprueba Fede.

### Tercera pasada del gate (sobre la v6)
Agente de contexto fresco con las reglas del gate (el agente nokko-gate no estaba registrado en la sesión).

**Veredicto del gate: Objeciones**

**Segunda pasada (11 puntos)**
1. Roles de solo lectura: **Parcial**. Las matrices y CA-76, CA-79 y CA-80 ya son coherentes. Queda un hueco: CA-2 dice que 1b da al Consejo las iniciativas, pero 1b:131 le niega la hoja de ruta y no tiene CA ni fila para ello.
2. Barra móvil: **Resuelta** (CA-65, CA-66, CA-80). Reserva sobre §13: `BottomBar` en `route.tsx:241-275` tiene lista propia y «Agente» es un botón, así que no comparte `nav.ts`.
3. Ciclo de vida del Consejo: **Resuelta** (CA-81, CA-82 y matriz 1a). Ver problema 8.
4. Pantallas en 1a: **Resuelta** (CA-86). Ver problemas 2 y 5.
5. 1a exige lo de 1b: **Parcial**. CA-8 sigue con una mitad («confirmar puertas») sin prueba posible en 1a.
6. CA-40 contra CA-11 y CA-50: **Parcial**. Las decisiones ya tienen estado Archivada. Un objetivo en Borrador no puede archivarse, y los demás elementos no tienen estado Archivada definido.
7. Retirada de LinkedIn: **Resuelta** (§13 y CA-75).
8. Roles: **Resuelta** (§13).
9. Tareas existentes: **Parcial** (CA-83 y CA-84). Ver problema 4.
10. CA-23: **Resuelta** (CA-23, CA-16 y 1b §9).
11. DEC: **Resuelta** (CA-49, CA-45, CA-46).

**Problemas nuevos**
1. 1b §12:151 cita CA-68, que es de 1a. Ninguna unidad ni prueba de 1b lo cubre para iniciativas, tareas y puertas. La prueba `roles-council-phase.test.ts` de U-1 no puede probar entidades que aún no existen.
2. Orden en 1a (§12). U-1 cierra CA-1, 2, 3, 76 y 77, que se refieren a objetivos, decisiones y retros de U-2, U-3 y U-7. U-2 cierra CA-86, cuya lista de decisiones es CA-53 (U-7) y cuya ficha usa resultados clave y públicos (U-3, U-4).
3. Privacidad. CA-77 solo cubre retros, decisiones y comentarios. Los comentarios de puertas (CA-87) y su campo «consecuencia» (CA-42) los ve el Consejo y no tienen advertencia.
4. Tareas.
   - Activación: CA-5 solo activa Owner, Sales leader y Consejo, así que CA-76 y CA-79 (otros siete roles) no tienen cómo activarse.
   - Permisos: la matriz 1b:127 prohíbe a los otros roles crear tareas, y CA-83 más `quick-actions.tsx:68,152` es una regresión, porque hoy cualquier rol las crea.
   - Briefing y correo diario: CA-84 solo cuenta las tareas que cuelgan de una iniciativa. Las de legado (CA-41) desaparecerían de `briefing.tsx:33` y `daily-email.server.ts:32`, y no dice si se mantiene el filtro de vencimiento.
5. Faltan pantallas o CA para puertas (crear y ver), y para iniciativas del Consejo. «Decisiones» es pantalla propia en 1a (CA-86) pero va dentro de Objetivos en 1b §9, y CA-65 no la incluye. CA-86 dice «Herramientas» y `nav.ts` tiene «Más herramientas».
6. Las pantallas de 1a no muestran fuente y antigüedad (R-1); CA-58 está en 1b.
7. CA-24, CA-38 y CA-70 siguen condicionales, sin cambios desde la primera pasada.
8. Código no recogido en §13. `guard_current_org` (`0002:68-74`) exige `org_members` para fijar `current_org_id`. `org_invites.role` es `app_role not null` (`0002:20`). Los valores por defecto `current_org()` no sirven a un Consejo fuera de `org_members`.
9. Referencias inexactas: `job-runner.server.ts` está en `src/lib/inngest/`, y `team.tsx:21` usa `Object.entries`.

**Comprobaciones mecánicas**
- **Numeración:** 1a tiene 44 CA y 1b 42, 86 en total, sin duplicados ni huecos salvo CA-85.
- **G-n y prueba:** los 86 CA citan un G-n existente (G-1, G-2, G-3, G-9, G-10) y una prueba nombrada.
- **Pruebas §7 y §12:** coinciden en ambos documentos.
- **Cobertura de unidades:** las unidades cubren todos los CA de su documento y ninguna cita un CA ajeno, salvo CA-68 en 1b:151.
- **§12:** incluye todos los CA de cada documento.
- **Aviso:** `objectives-lifecycle.test.ts` lo comparten 1a y 1b.

**[Por verificar] que bloquean la aprobación**
Ninguno, y ninguno está dentro de un CA. Quedan abiertos:
- Uso real de las pantallas.
- Cantidad de tareas y experimentos.
- Eventos de activación.
- Umbral de agregación de R-4.
- Fórmula de runway.
- Conteo de herramientas del agente en PRD:27 (el gate previo ya contó 101).

Bloquean construir, no aprobar: Lovable A y B y la numeración de migraciones.

**Lo que esta revisión NO demuestra**
- Nada sobre producción, Drive o datos reales.
- Que las RLS reales coincidan con las migraciones.
- Que el Consejo sea seguro: no ejecuté pruebas ni abrí pantallas.
- No revisé los SDD de Lovable A y B.

**Respuesta del autor a la segunda pasada (v6, 2026-10-30).** Roles de solo lectura coherentes entre PRD, 1a y 1b (matrices, CA-2, CA-76, CA-80); alta y baja del Consejo (CA-81, CA-82); pantallas mínimas de objetivos y decisiones ya en 1a (CA-86); 1a deja de exigir lo que solo entrega 1b (CA-2, CA-8, CA-76) y los comentarios de decisiones nacen en 1a (CA-54); archivado de decisiones con estado Archivada (CA-40, CA-50); retirada de LinkedIn separa el job de reseñas de G2 (§13); enum de roles aclarado (§13); tareas existentes y resúmenes (CA-83, CA-84); estado del objetivo con Sin dato reciente (CA-23) y titular (1b §9); DEC con zona horaria y contador (CA-49) y dueño de las decisiones de puertas (CA-45, CA-46); CA-58 acotado; pruebas de lista de tareas y menú renombradas; cabecera de unidades corregida. La zona horaria de la organización queda fijada por Fede en Europe/Madrid por defecto (2026-10-30).

### Cuarta pasada del gate (sobre la v7)
Agente de contexto fresco con las reglas del gate (el agente nokko-gate no estaba registrado en la sesión).

**Veredicto del gate: Objeciones** (1 bloqueante, el resto menores)

**Tercera pasada (9 puntos)**
1. CA-68 y entidades de 1b: **Resuelta**. CA-89 está en U-8 con `audit-entities.test.ts`.
2. Orden de unidades en 1a: **Parcial**. CA-86 y CA-2/76/77 ya están en U-7, pero siguen mal CA-1, CA-8 y CA-82 (ver B-1).
3. Privacidad de puertas: **Resuelta** (CA-90). Los títulos de iniciativa que ve el Consejo no llevan advertencia (menor).
4. Tareas: **Parcial**. Activación resuelta (CA-5) y briefing resuelto (CA-84). Los permisos de los otros roles quedan solo declarados en 1b §14 y §16, y CA-84 no cubre las herramientas del agente (ver M-3 y M-4).
5. Pantallas de puertas e iniciativas del Consejo: **Parcial**. Resueltas en CA-91, CA-88 y CA-65. CA-67 sigue diciendo «Herramientas» (1b:98), no «Más herramientas».
6. R-1 en pantallas de 1a: **Resuelta** (CA-86).
7. CA-24, CA-38 y CA-70 condicionales: **No resuelta**. Es la tercera pasada sin cambios, solo mitigada con «doble» (1a §14).
8. Código del alta del Consejo (`guard_current_org`, `org_invites.role`): **Resuelta**. Comprobado en `0002:20` y `:68-74`.
9. Referencias inexactas: **Resuelta**.

**Problemas nuevos**
- **B-1 Bloqueante.** Orden de unidades:
  - U-1 cierra CA-1 (matriz sobre objetivos y decisiones), CA-8 (ratificar decisiones y objetivos) y CA-82 (conservar comentarios) (1a:152). Esas entidades nacen en U-2, U-3 y U-7, así que el test de U-1 no puede fallar primero ni pasar.
  - CA-40 está en U-5 (1b:151) pero incluye las puertas, que son de U-6 (1b:152).
  - Solución: mover CA-1, CA-8 y CA-82 a U-7, y el tramo de puertas de CA-40 a U-6.
- **M-1 Menor.** El titular §9 (1b:117-121) no define el caso con Atención, sin En riesgo y sin puertas próximas. La regla 4 dice «si no hay datos», así que el resultado esperado de CA-56 y CA-63 es indeterminado. La regla 2 también muestra puertas a roles que no las ven (choca con CA-80).
- **M-2 Menor.** CA-36 dice que «cada persona» registra su capacidad, pero la matriz (1b:137) lo niega a los otros roles.
- **M-3 Menor.** CA-83 dice «mientras la fase esté activa» sin precisar organización o rol, y CA-5 activa por rol. No dice qué pasa en un CRM sin iniciativas. La matriz sigue negando crear tareas a los otros roles, y eso depende de una decisión abierta de Fede.
- **M-4 Menor.** CA-84 solo cubre briefing y correo diario. Las tareas archivadas o «Sin asignar» seguirían saliendo en `core-read.ts:67,168` y `pipeline.ts:102`.
- **M-5 Menor.** CA-45 crea una decisión al confirmar una puerta, pero CA-49 obliga a crearla en estado Abierta, y nada define su estado final.
- **M-6 Menor.** CA-81 habla de «vista del Consejo», sin definirla. La matriz no recoge «ver públicos y canales», que sí aparecen en la ficha (CA-86). El Consejo con «Agente» en CA-66 no está definido.
- **M-7 Menor.** El Consejo ve iniciativas (PRD §2 y §6.1 no lo recogen como decisión de Fede; confirmar). CA-12 no precisa de qué persona y semana son las «horas planificadas».
- **M-8 Menor.** Textos obsoletos:
  - PRD:137 cita «SDD-1».
  - PRD:160 dice «nueve documentos».
  - 1a §15 y §16 conservan preguntas ya contestadas.
  - 1b §17 tiene la respuesta v7 antes que la v6.
  - 1a:70 cita README en el cuerpo de un CA.

**Comprobaciones mecánicas (resultado, con script)**
- CA: 44 en 1a y 46 en 1b, sin duplicados, 1-91 completo salvo CA-85.
- G-n y prueba: los 90 CA citan un G-n existente y una prueba nombrada.
- Pruebas: los archivos de §7 y §12 coinciden en ambos SDD.
- Cobertura: las unidades cubren todos los CA de su documento y ninguna cita un CA ajeno.
- Orden: viola dependencias en B-1.
- PRD §8: coincide con las cabeceras y los G-n.

**[Por verificar] que bloquean la aprobación:** ninguno, y no hay ninguno dentro de un CA.

**Lo que esta revisión NO demuestra**
- Nada sobre producción, Drive, Stripe ni los SDD de Lovable A y B.
- No recontó las herramientas del agente (PRD:27).
- No ejecuté pruebas ni abrí pantallas.
- Las políticas RLS reales no se han contrastado con las migraciones.
- La seguridad del Consejo no está probada.

**Respuesta del autor a la tercera pasada (v7, 2026-10-30).** Hueco de roles (CA-2 y CA-76 pasan a U-7 y 1b añade CA-88); CA-8 sin la mitad de puertas; CA-5 activa también a los demás roles; archivado desde Borrador (CA-11); unidades de 1a reordenadas por dependencias (§12); CA-86 con «Más herramientas» y con fuente y antigüedad; código del alta del Consejo y referencias corregidas (§13). Los puntos de 1b (privacidad de puertas, pantallas de puertas, tareas, briefing y auditoría de sus entidades) están en CA-88 a CA-91 y CA-84. CA-24, CA-38 y CA-70 siguen condicionales: se prueban con un doble hasta SDD-4 y SDD-5. **La cuarta pasada se lanzó sobre la v7 (informe arriba).**

### Quinta pasada del gate (sobre la v8)
Agente de contexto fresco con las reglas del gate (el agente nokko-gate no estaba registrado en la sesión)

**Veredicto del gate: Objeciones** (0 bloqueantes, 4 menores nuevos)

**Cuarta pasada**
- **B-1: Resuelta.** CA-1, CA-8 y CA-82 están en U-7 (1a §12). El tramo de puertas de CA-40 está en U-8 de 1b, que depende de U-5 y U-6.
- **M-1: Resuelta** (1b §9, reglas 2 a 5, con el caso de Atención y la condición por rol).
- **M-2: Resuelta** (CA-36 coincide con la matriz de 1b §10).
- **M-3: Parcial.** CA-83 ahora es por organización, pero CA-5 activa por rol (ver N-2). Tampoco dice qué pasa en una organización sin iniciativas.
- **M-4: Resuelta.** CA-84 cubre las herramientas del agente. Los lectores `core-read.ts:67,168` y `pipeline.ts:102` existen y son herramientas del agente.
- **M-5: Resuelta** (CA-49 y CA-45; ver N-3).
- **M-6: Resuelta** (CA-81 por matriz, públicos y canales en la matriz, CA-66 define lo que ve el Consejo).
- **M-7: Resuelta.** CA-12 está precisado y el Consejo con iniciativas queda en PRD §6.5 como decisión abierta declarada.
- **M-8: Resuelta.** Ya no queda «SDD-1», «nueve documentos», la cita al README en un CA ni respuestas desordenadas.

**Problemas nuevos**
- **N-1 Menor.** El orden de unidades sigue sin cumplir la regla «el test puede fallar primero con lo entregado antes», con la misma causa que B-1.
  - U-4 cierra CA-26 y CA-29 (público en varios objetivos; público archivado en objetivos Activos), pero los objetivos nacen en U-2, que va después (1a:153-154). Se arregla poniendo U-2 antes de U-4, porque CA-10 está en U-3.
  - U-1 cierra CA-6 (ocultar y mostrar datos creados), CA-81 (acceso del Consejo según la matriz) y CA-68 (auditoría de objetivos, resultados clave y decisiones). Esas entidades nacen en U-2, U-3 y U-7. Basta con acotar el test de U-1 a lo que ya existe, o mover esos CA a U-7.
- **N-2 Menor.** CA-83 (1b:64) exige iniciativa «para la organización», pero CA-5 activa por rol y PRD R-9 conserva el comportamiento anterior. Con el rollout escalonado, un SDR con rol aún inactivo tendría que elegir una iniciativa que no puede crear. Debería decir «para el rol del autor».
- **N-3 Menor.** CA-49 dice que las decisiones registradas «al confirmar una puerta» nacen Cerradas. CA-46 crea además una decisión Abierta en el mismo acto, y el texto admite leer que también debería nacer Cerrada. Precisa que CA-46 es la excepción.
- **N-4 Menor.** Hay dos huecos sin definir.
  - CA-49 no dice cómo evitar IDs duplicados con altas simultáneas ni qué pasa si cambia la zona horaria.
  - CA-52 no aclara si cada nuevo valor manual de un resultado clave (CA-19), hecho por Flor, cuenta como edición de un objetivo ratificado.

**Comprobaciones mecánicas (script de solo lectura)**
- 44 CA en 1a y 46 en 1b, sin duplicados; 1 a 91 completo salvo CA-85.
- Los 90 CA citan un G-n existente en el PRD y una prueba nombrada.
- Los archivos de prueba de §7 y §12 coinciden en ambos SDD, y el test de cada unidad coincide con el de sus CA.
- Cada unidad cubre solo CA de su documento, no hay CA sin unidad ni repetidos.
- PRD §8: 1a cubre G-1, G-3, G-9 y G-10, y 1b añade G-2. Eso coincide con los G-n citados por los CA de cada SDD y con las cabeceras.
- Ningún CA contiene [Por verificar].
- Orden de unidades: falla en N-1. Entre documentos, 1b depende de 1a U-3 y U-7 y es coherente.

**¿Aprobable?** Sí, con los menores corregidos durante la implementación o antes por una edición corta. N-1 es el más cercano a bloqueante: lo dejo como menor porque el arreglo es permutar U-2 y U-4 sin tocar ningún CA ni dependencia externa. Riesgos declarados:
- CA-24, CA-38 y CA-70 se prueban con un doble.
- Los roles distintos de Owner y Sales leader no pueden crear tareas (1b §16).
- El Consejo ve iniciativas y puertas (PRD §6.5).
- Con fuentes solo manuales, un dato obsoleto no pasa a «Sin dato reciente».
- Migraciones 0058 y 0059 sin aplicar, y coordinación con Lovable A y B.

**Lo que esta revisión NO demuestra**
- No contrasté las políticas RLS ni la seguridad del Consejo.
- No ejecuté pruebas ni abrí pantallas.
- No comprobé nada de producción, Drive, Stripe ni los SDD de Lovable.
- No recontó las herramientas del agente.
- Las rutas del código que cito son las que leí en esta sesión.

**Respuesta del autor a la cuarta pasada (v8, 2026-10-30).** Bloqueante B-1 resuelto: CA-1, CA-8 y CA-82 pasan a U-7 y el tramo de puertas de CA-40 se mueve a U-8 de 1b; CA-81 define el acceso del Consejo por la matriz; CA-49 aclara que las decisiones de puertas nacen Cerradas; matriz con públicos y canales; CA-70 sin cita en el cuerpo (fuente en §13); §15 y §16 depurados. Los menores restantes (titular, capacidad, briefing y herramientas del agente, CA-67, textos obsoletos) están tratados en el SDD 1b y el PRD. CA-24, CA-38 y CA-70 siguen condicionales: se prueban con un doble hasta SDD-4 y SDD-5 (decisión consciente, tercera vez señalada).

**Respuesta del autor a la quinta pasada (v9, 2026-10-30).** Sin bloqueantes. N-1: orden de unidades corregido (U-2 antes de U-4; CA-6, CA-68 y CA-81 pasan a U-7); N-3 y N-4: CA-49 y CA-52 precisados (CA-46 es la excepción abierta, IDs únicos y estables, valores manuales y tareas no cuentan como edición ratificada); N-2: CA-83 por rol (SDD 1b). El gate declaró los documentos aprobables; los riesgos declarados están en §14 y en el PRD §6.5 y §7.

## 18. Delta de implementación (lo rellena el agente al entregar)
Sin entrega todavía.
