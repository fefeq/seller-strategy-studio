# SDD-20261030-gtm-control-tower-1b-tasks-gates-tower · [Feature] Tareas, puertas, torre de control, Plan, Inicio y menú (fase 1b)

**Tipo:** Feature · **Prioridad propuesta:** Alta
**Estado:** Aprobado por Fede el 2026-10-30 (v9, tras cinco pasadas del gate) · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-10-30
**PRD:** `docs/prd/PRD-20261030-gtm-control-tower.md` · **Depende de:** `SDD-20261030-gtm-control-tower-1a-core.md` (U-1, U-3 y U-7 entregadas) y los SDD de salida de Lovable A y B cerrados

> Un SDD dice cómo se verifica que está bien hecho. Cada criterio de aceptación (CA-n) debe poder tener una prueba automática que lo nombre.
> Los criterios no nombran tecnología; lo técnico va en el §13 como [Sugerencia — la revisión del gate las valida].
> Las reglas transversales del PRD (§6.2, R-1 a R-10) aplican a todo este SDD. «Organización» es la empresa que usa Nokko; «cuenta» es una empresa prospecto o cliente.
> La numeración de criterios (CA-n) se conserva de la versión única anterior; los criterios que faltan están en el SDD 1a. Los criterios CA-12, CA-15, CA-79 y CA-87 pertenecen a este SDD aunque su número sea de otro bloque.

## 1. Resumen
Baja los objetivos a trabajo y los hace visibles: iniciativas, tareas con subtareas y dependencias, capacidad semanal de referencia, puertas con cálculo informativo y confirmación manual, torre de control en Objetivos, hoja de ruta y lista de tareas en Plan, resumen en Inicio, menú nuevo, y el aviso de foco y el archivado de tareas al pausar o cerrar un objetivo. Hereda del SDD 1a los roles, los objetivos, los resultados clave, los públicos y canales y las decisiones.

## 2. Problema y para quién
Aunque existan objetivos, no hay forma de bajarlos a tareas con plazos, de decidir con datos si algo funciona (puertas) ni de ver el estado de todo de un vistazo. Para Fede (Owner), Flor (Sales leader), el Consejo (puertas) y los demás roles actuales (lectura de hoja de ruta y tareas).

## 3. Evidencia y por qué ahora
- Código (repo de Nokko, solo lectura, 2026-10-30): tareas planas sin objetivo; experimentos y metas por segmento sin vínculo; un campo de texto «objectives» solo por cuenta (`account_plans.objectives`); Ciclo GTM con documentos aprobados pero sin objetivos medibles ni tareas; lectura de posts y ofertas de LinkedIn mediante un proveedor de extracción automática (herramientas del agente `linkedin_company_posts`, `linkedin_profile_posts`, `company_job_postings`).
- Documentos de Postin Core: F0-01 v6.3 (fuente del objetivo de 10.000 € MRR a 12 meses y de las 10 h/semana), F0-11 v1.2 (puertas de día 14 y 30: al menos 6 respuestas y 10 conversaciones, 4 de origen frío) e ICP-00 v2.4 (registro de decisiones con ID y dueño). Se usan como **ejemplos de la forma** de los datos, no como datos cargados por este SDD.
- Entrevista con Fede (2026-10-29/30): decisiones del PRD §6.
- Uso real de las pantallas actuales: **sin dato** [Por verificar].

## 4. Resultado buscado
- Fede crea un objetivo con tareas y puertas en una sola sesión y ve su estado calculado en la torre de control. Medición: observación en la revisión de fase; línea base: sin dato.
- Cero tareas **nuevas** de una persona sin iniciativa; las que crea el agente quedan como propuestas «Sin asignar» (las anteriores quedan aparte como legado, CA-41). La regla alcanza también a las tareas ligadas a una cuenta o a un deal (decisión de Fede, 2026-10-30).
- Las puertas muestran su valor calculado y si cumplen; Fede solo confirma (G-3 del PRD). En esta fase las métricas de una puerta son resultados clave de entrada manual; las automáticas llegan en SDD-3 y SDD-4.

## 5. Alcance
**Incluye:** H-5, H-6, H-8, H-9, H-11 y H-13.
**No incluye:**
- Roles, objetivos, resultados clave, públicos, canales, decisiones y retirada de LinkedIn (SDD 1a).
- Contexto y onboarding (SDD-2); atribución y embudos (SDD-3); integraciones (SDD-4); chat y agente (SDD-5); señales y competidores (SDD-6); informe PDF y runway (SDD-7).
- Kanban y calendario (fases posteriores, sin SDD asignado).
- Copiar un objetivo al trimestre siguiente, notificaciones de tareas y recordatorios (fases posteriores).
- Sincronización con herramientas externas de tareas; cualquier envío o publicación hacia el exterior.

## 6. Cambios de comportamiento (delta)
**Añadido:** iniciativas, tareas con subtareas y dependencias, capacidad semanal, puertas con criterios, torre en Objetivos, hoja de ruta, lista de tareas con detalle, resumen en Inicio, aviso de foco.
**Modificado:** menú principal; Inicio (de panel de pipeline a resumen con titular-conclusión); la tarea nueva de una persona pasa de «suelta» a colgar de una iniciativa.
**Eliminado:** nada se elimina; las tareas y experimentos anteriores se conservan como legado.

## 7. Historias y criterios de aceptación
Cada CA cita el objetivo G-n del PRD que cubre y el archivo de prueba (ruta por decidir en la implementación [Sugerencia]).

### H-13: Como Owner o Sales leader, quiero que activar, pausar o cerrar un objetivo tenga en cuenta mi carga y mis tareas.
- **CA-12** CUANDO activo un objetivo y ya hay tres Activos, el sistema DEBE mostrar los Activos con su estado y, por cada persona con tareas asignadas, las horas planificadas de la semana en curso (CA-37), y DEBE permitirme continuar o cancelar sin bloquear la activación. · cubre G-1 · prueba: `objectives-lifecycle.test.ts`
- **CA-15** CUANDO pauso o cierro un objetivo, el sistema DEBE archivar sus tareas no Hechas (con sus subtareas), con el motivo y la fecha, sin borrarlas, y CUANDO reactivo un objetivo pausado DEBE restaurarlas con su estado anterior. · cubre G-1 · prueba: `objectives-lifecycle.test.ts`

### H-5: Como Owner o Sales leader, quiero iniciativas y tareas con subtareas y dependencias para bajar el objetivo a trabajo.
- **CA-30** El sistema DEBE permitir crear iniciativas dentro de un objetivo, cada una vinculada a uno o más de sus resultados clave y a un canal. · cubre G-2 · prueba: `tasks-dependencies.test.ts`
- **CA-31** El sistema DEBE permitir a una persona crear tareas solo dentro de una iniciativa, con título, ejecutor (persona), estado (Pendiente, En curso, Hecha o Bloqueada), fecha límite, horas estimadas y reales (opcionales) y notas. · cubre G-2 · prueba: `tasks-dependencies.test.ts`
- **CA-32** El sistema DEBE permitir subtareas hasta tres niveles de profundidad, y DEBE impedir marcar Hecha una tarea con subtareas sin hacer. · cubre G-2 · prueba: `tasks-dependencies.test.ts`
- **CA-33** El sistema DEBE permitir que una tarea dependa de otras (también de otros objetivos); MIENTRAS alguna dependencia no esté Hecha, DEBE mostrar la tarea como Bloqueada con el motivo «Bloqueada por: <tarea>», y DEBE permitir además marcarla Bloqueada a mano indicando un motivo. · cubre G-2 · prueba: `tasks-dependencies.test.ts`
- **CA-34** SI una dependencia crearía un ciclo, ENTONCES el sistema DEBE rechazarla e indicar la cadena que lo causa. · cubre G-2 · prueba: `tasks-dependencies.test.ts`
- **CA-35** MIENTRAS una tarea dependencia esté archivada, el sistema DEBE dejar de considerarla bloqueante y DEBE avisar en la tarea dependiente de que su dependencia está archivada. · cubre G-2 · prueba: `tasks-dependencies.test.ts`
- **CA-36** El sistema DEBE permitir registrar la capacidad semanal de cada persona en horas; el Owner DEBE poder registrarla para cualquiera y el Sales leader para sí. · cubre G-2 · prueba: `tasks-dependencies.test.ts`
- **CA-37** El sistema DEBE calcular las horas planificadas de una persona en una semana (de lunes a domingo, en la zona horaria de la organización, por defecto Europe/Madrid) sumando las horas estimadas de sus tareas hoja no Hechas cuya fecha límite caiga en esa semana, y DEBE indicar cuántas tareas no tienen horas; el resultado DEBE mostrarse como dato informativo, sin avisos ni bloqueo. · cubre G-2 · prueba: `tasks-dependencies.test.ts`
- **CA-38** DONDE el ejecutor de una tarea sea el agente (SDD-5), el sistema DEBE mostrarlo en la tarea y toda acción externa asociada DEBE requerir aprobación humana (PRD R-2). · cubre G-2 · prueba: `tasks-dependencies.test.ts`
- **CA-39** DONDE una tarea dependa de un cambio técnico de Postin, el sistema DEBE permitir marcarla «Requiere SDD» y guardar un enlace o referencia al SDD, y DEBE abstenerse de enviar ninguna petición a Dani por sí mismo. · cubre G-2 · prueba: `tasks-dependencies.test.ts`
- **CA-40** El sistema DEBE ofrecer archivar, y DEBE evitar borrar, objetivos (Archivado, SDD 1a CA-11), resultados clave, iniciativas, tareas, públicos, canales y puertas (indicador «Archivado» que los oculta de las vistas y conserva el registro) y decisiones (estado Archivada), salvo cuando una persona titular de datos o la ley exijan su supresión (PRD R-7). · cubre G-10 · prueba: `archive-not-delete.test.ts`
- **CA-41** El sistema DEBE conservar las tareas y experimentos existentes antes de la fase, mostrarlos como «Sin objetivo (anterior)» y permitir adoptarlos: una tarea se asigna a una iniciativa y un experimento se convierte en una iniciativa conservando el original. · cubre G-2 · prueba: `tasks-dependencies.test.ts`
- **CA-78** MIENTRAS la fase esté activa, el sistema DEBE guardar como propuestas «Sin asignar» las tareas que cree el agente o un detector sin iniciativa, y DEBE mantenerlas fuera de las tareas activas hasta que alguien las asigne a una iniciativa. · cubre G-2 · prueba: `tasks-dependencies.test.ts`
- **CA-83** MIENTRAS la fase esté activa para el rol de la persona que crea la tarea, el sistema DEBE pedir una iniciativa cuando una persona cree una tarea desde cualquier punto de la aplicación, incluidas las tareas ligadas a una cuenta o a un deal, y DEBE guardar sin iniciativa solo las propuestas de CA-78. · cubre G-2 · prueba: `tasks-dependencies.test.ts`
- **CA-84** El sistema DEBE excluir de los resúmenes y avisos (briefing y correo diario) y de las respuestas de las herramientas del agente que listan tareas las tareas archivadas y las propuestas «Sin asignar», y DEBE seguir contando como pendientes las demás tareas no Hechas, incluidas las anteriores «Sin objetivo», con el mismo filtro de vencimiento que hoy. · cubre G-2 · prueba: `tasks-dependencies.test.ts`

### H-6: Como Owner, quiero puertas con criterio medible para decidir con datos si algo funciona.
- **CA-42** El sistema DEBE permitir crear una puerta con nombre, objetivo, uno o más criterios (resultado clave, comparador mayor o igual, menor o igual o igual, y umbral), fecha o evento de evaluación y consecuencia descrita en texto, y DEBE considerar que cumple solo cuando todos sus criterios cumplen. · cubre G-3 · prueba: `gates.test.ts`
- **CA-43** El sistema DEBE mostrar el valor calculado de cada criterio con los datos actuales cada vez que se consulta la puerta, y CUANDO llega la fecha de evaluación DEBE congelar ese valor y mostrarlo como «a fecha de evaluación». · cubre G-3 · prueba: `gates.test.ts`
- **CA-44** El sistema DEBE ofrecer los estados Pendiente, Cumple, No cumple (calculados), Confirmada cumple y Confirmada no cumple, y DEBE abstenerse de confirmar el resultado por sí mismo. · cubre G-3 · prueba: `gates.test.ts`
- **CA-45** El sistema DEBE permitir solo al Owner confirmar el resultado de una puerta (a cualquiera de los Owners, si hay varios, registrando cuál) y CUANDO lo confirma DEBE registrar una decisión Cerrada con su ID cuyo dueño es ese Owner (SDD 1a, CA-49). · cubre G-3 · prueba: `gates.test.ts`
- **CA-46** SI una puerta se confirma como no cumplida, ENTONCES el sistema DEBE crear una decisión Abierta «Qué hacemos», con el Owner que confirmó como dueño, asociada a la puerta, y DEBE abstenerse de modificar objetivos, iniciativas o tareas por sí mismo. · cubre G-3 · prueba: `gates.test.ts`
- **CA-47** SI no hay dato para calcular un criterio, ENTONCES el sistema DEBE mostrar Sin dato y DEBE permitir al Owner confirmar el resultado a mano indicando el valor y su fuente, marcado «Manual». · cubre G-3 · prueba: `gates.test.ts`
- **CA-48** SI al crear una puerta su fecha de evaluación ya pasó, ENTONCES el sistema DEBE evaluarla con los datos actuales y mostrarla como evaluada hoy. · cubre G-3 · prueba: `gates.test.ts`
- **CA-87** El sistema DEBE permitir al Owner, al Sales leader y al Consejo comentar puertas, y DEBE impedir al Consejo confirmarlas. · cubre G-9 · prueba: `gates.test.ts`
- **CA-90** El sistema DEBE advertir, junto a los campos de texto libre de las puertas (consecuencia y comentarios) visibles para el Consejo, que no se incluyan datos de clientes. · cubre G-10 · prueba: `gates.test.ts`
- **CA-91** El sistema DEBE ofrecer una lista de puertas y una ficha de puerta con sus criterios, los valores calculados, el estado, la fecha de evaluación y los comentarios. · cubre G-3 · prueba: `gates.test.ts`

### H-8: Como Owner o Sales leader, quiero una torre de control y un plan para ver el estado y bajarlo a tareas.
- **CA-55** El sistema DEBE mostrar, en la pantalla Objetivos, una tarjeta por objetivo Activo con su estado, cada resultado clave con su barra (valor inicial, actual, meta y marcador del ritmo esperado hoy), qué lo bloquea (tareas Bloqueadas y puertas con evaluación en los próximos 14 días), decisiones pendientes y tareas de la semana. · cubre G-1 · prueba: `control-tower-headlines.test.ts`
- **CA-56** El sistema DEBE mostrar, en Objetivos e Inicio, un titular calculado según las reglas del §9 y, SI faltan datos, ENTONCES DEBE mostrar el nombre de la sección en vez de un número inventado. · cubre G-1 · prueba: `control-tower-headlines.test.ts`
- **CA-57** El sistema DEBE mostrar cada estado con su palabra además de su color (En ritmo, Atención, En riesgo, Sin dato, Sin dato reciente, y Sin arrancar en objetivos), sin iconos. · cubre G-1 · prueba: `control-tower-headlines.test.ts`
- **CA-58** El sistema DEBE mostrar, junto a cada valor de resultado clave y de criterio de puerta de las pantallas de esta fase, su fuente y su antigüedad (PRD R-1). · cubre G-1 · prueba: `control-tower-headlines.test.ts`
- **CA-59** El sistema DEBE mostrar, en la pantalla Plan, una hoja de ruta trimestral con una fila por objetivo, las iniciativas como barras y las puertas, hitos y fechas límite como marcadores. · cubre G-2 · prueba: `plan-roadmap.test.ts`
- **CA-60** El sistema DEBE mostrar, en la pantalla Plan, una lista de tareas agrupable por objetivo o por fecha y filtrable por objetivo, iniciativa, canal, ejecutor, estado y fecha. · cubre G-2 · prueba: `plan-task-list.test.ts`
- **CA-61** CUANDO elijo una tarea de la lista, el sistema DEBE abrir su detalle sin salir de la lista, con subtareas indentadas, dependencias, motivo de bloqueo y horas. · cubre G-2 · prueba: `plan-task-list.test.ts`
- **CA-62** DONDE el usuario pida ver el grafo de dependencias, el sistema DEBE mostrar cada dependencia como una arista dirigida desde la tarea de la que depende hasta la tarea que queda bloqueada. (Mejora opcional, ver U-9.) · cubre G-2 · prueba: `dependency-graph.test.ts`
- **CA-79** MIENTRAS un usuario tenga un rol distinto de Owner, Sales leader o Consejo, el sistema DEBE permitirle ver las iniciativas, la hoja de ruta y la lista de tareas en solo lectura. · cubre G-10 · prueba: `plan-roadmap.test.ts`
- **CA-80** El sistema DEBE omitir en la torre, el Plan, Inicio y el menú los elementos que el rol del usuario no puede ver, según las matrices de permisos de los SDD 1a y 1b (tareas para el Consejo; puertas y decisiones para los demás roles), incluidos los marcadores de puertas de la hoja de ruta. · cubre G-10 · prueba: `control-tower-headlines.test.ts`
- **CA-88** El sistema DEBE mostrar al Consejo las iniciativas (título y estado) en la ficha de cada objetivo y las puertas, y DEBE ocultarle las tareas y la hoja de ruta. · cubre G-9, G-10 · prueba: `control-tower-headlines.test.ts`
- **CA-89** El sistema DEBE registrar en la auditoría (SDD 1a, CA-68) los cambios de iniciativas, tareas y puertas. · cubre G-3 · prueba: `audit-entities.test.ts`

### H-9: Como usuario, quiero un Inicio claro y un menú que refleje el modelo nuevo.
- **CA-63** El sistema DEBE mostrar en Inicio el titular del §9, una línea por objetivo Activo con su nombre y estado, y las decisiones pendientes. · cubre G-1 · prueba: `control-tower-headlines.test.ts`
- **CA-64** MIENTRAS el chat nuevo (SDD-5) no esté activo, el sistema DEBE mantener en Inicio la entrada actual al agente y DEBE evitar mostrar un chat vacío. · cubre G-1 · prueba: `control-tower-headlines.test.ts`
- **CA-65** MIENTRAS la fase esté activa para mi rol, el sistema DEBE mostrar en el menú principal Inicio, Objetivos (que incluye la lista de Decisiones), Plan, Comercial (Cuentas, Leads, Pipeline y Personas) y Métricas, omitiendo lo que mi rol no puede ver, y DEBE ubicar el resto en «Más herramientas» y Ajustes. [Sugerencia: Mercado aparece cuando exista SDD-6.] · cubre G-1 · prueba: `nav-roles.test.ts`
- **CA-66** MIENTRAS la pantalla sea estrecha (el punto de corte de móvil del sistema visual), el sistema DEBE mostrar en la barra inferior Inicio, Plan, Agente y Decisiones, omitiendo lo que el rol del usuario no puede ver (el Consejo no ve Plan ni Agente). · cubre G-1 · prueba: `nav-roles.test.ts`
- **CA-67** El sistema DEBE mantener accesibles las pantallas anteriores (Sugerencias, Estrategia GTM, Ciclo GTM, Debates, Asesor y demás) desde «Más herramientas» hasta que Fede registre una decisión que autorice retirarlas. · cubre G-1 · prueba: `nav-roles.test.ts`

### H-11: Como usuario, quiero que las ediciones simultáneas y los errores no me hagan perder trabajo.
- **CA-71** CUANDO guardo un elemento que otra persona modificó desde que lo abrí, el sistema DEBE avisarme de qué cambió y DEBE conservar mis cambios sin guardar para que yo decida. · cubre G-10 · prueba: `concurrent-edits.test.ts`
- **CA-72** SI falla guardar por un error o por falta de conexión, ENTONCES el sistema DEBE conservar lo escrito en pantalla y DEBE explicar qué pasó y qué hacer. · cubre G-10 · prueba: `save-errors.test.ts`

## 8. Casos límite y errores
Cada caso remite al CA que lo cubre.
- Dependencias circulares → CA-34; dependencia archivada → CA-35.
- Objetivo pausado o cerrado con tareas abiertas → CA-15.
- Puerta con fecha ya pasada al crearla → CA-48; sin dato → CA-47.
- Tareas que crea el agente o un detector sin iniciativa → CA-78.
- Ediciones simultáneas → CA-71; error o sin conexión → CA-72.
- Roles de solo lectura que intentan editar → CA-79 y matriz del §10.
- Otra organización → nunca ve estos datos (PRD R-10).

## 9. Experiencia y copy
Sistema visual actual (Ink + Lima, versalitas con filete, sin iconos), textos en «tú».
- **Estados de tareas:** Pendiente, En curso, Bloqueada, Hecha; de objetivos y resultados clave, los del SDD 1a.
- **Titular (CA-56, CA-63), por prioridad:**
  1. Si hay objetivos En riesgo: «<N> objetivo(s) en riesgo: <nombre del peor>».
  2. Si no, y el rol puede ver puertas y hay puertas con evaluación en los próximos 14 días: «<nombre de la puerta> se evalúa el <fecha>».
  3. Si no, y hay objetivos Activos en Atención: «<N> objetivo(s) en atención».
  4. Si no, y todos los objetivos Activos tienen dato reciente y están En ritmo (los Sin arrancar y los Sin dato reciente no cuentan como En ritmo): «Todo en ritmo».
  5. En cualquier otro caso (por ejemplo, sin objetivos Activos o sin datos): el nombre de la sección.
- **Mensajes sugeridos** (a validar con la guía de voz de marca): «Este objetivo ya tiene tres activos: si sigues, tendrás que repartir el tiempo entre cuatro.»
- **Pantallas:** Inicio (resumen), Objetivos (torre y decisiones), Plan (hoja de ruta, lista y detalle). En móvil se apilan en ese orden.

## 10. Datos, permisos y privacidad
- **Conceptos nuevos:** Iniciativa, Tarea (subtarea y dependencia), Capacidad semanal, Puerta (con criterios).
- **Matriz de permisos** (se suma a la del SDD 1a):

| Acción | Owner | Sales leader | Consejo | Otros roles |
|---|---|---|---|---|
| Crear y editar iniciativas, tareas y puertas | Sí | Sí | No | No |
| Confirmar el resultado de una puerta | Sí | No | No | No |
| Comentar puertas | Sí | Sí | Sí | No |
| Ver puertas | Sí | Sí | Sí | No |
| Ver iniciativas (título y estado) | Sí | Sí | Sí | Sí |
| Ver tareas y hoja de ruta | Sí | Sí | No | Sí, solo lectura |
| Registrar capacidad | De cualquiera | Solo la propia | No | No |

- **Privacidad:** ningún dato de clientes en tareas, notas ni pruebas; ejemplos con datos ficticios. Los datos de cada organización no se cruzan (PRD R-10).

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| ninguna en esta fase | — | — | — |

El cálculo de estados y titulares es por reglas. El borrador de plan con IA llega en SDD-5.

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero [Sugerencia] | Depende de |
|---|---|---|---|---|
| U-5 | Iniciativas, tareas, subtareas, dependencias, capacidad, legado; aviso de foco y archivado al pausar o cerrar | CA-12, CA-15, CA-30 a CA-39, CA-41, CA-78, CA-83, CA-84 | `tasks-dependencies.test.ts`, `objectives-lifecycle.test.ts` | 1a: U-3 |
| U-6 | Puertas y comentarios del Consejo | CA-42 a CA-48, CA-87, CA-90, CA-91 | `gates.test.ts` | 1a: U-3 y U-7 |
| U-8 | Objetivos (torre), Plan (lista, detalle, hoja de ruta), Inicio, menú, lectura para otros roles, ediciones y errores | CA-40, CA-55 a CA-61, CA-63 a CA-67, CA-71, CA-72, CA-79, CA-80, CA-88, CA-89 | `archive-not-delete.test.ts`, `audit-entities.test.ts`, `control-tower-headlines.test.ts`, `plan-roadmap.test.ts`, `plan-task-list.test.ts`, `nav-roles.test.ts`, `concurrent-edits.test.ts`, `save-errors.test.ts` | U-5, U-6 |
| U-9 | Grafo de dependencias (opcional) | CA-62 | `dependency-graph.test.ts` | U-5 |

**Orden:** U-5, U-6, U-8, U-9. CA-89 (U-8) completa la auditoría del SDD 1a (CA-68) para iniciativas, tareas y puertas.

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- **Tareas** (hallazgo del gate): la tabla existente tiene `done` (booleano) sin estado ni iniciativa (`src/integrations/supabase/types.ts:4764-4780`) y ocho puntos de creación (`quick-actions.tsx`, `debates.tsx`, `core-write.ts`, autopilot, detectores y servidor para asistentes). Hay que añadir estado e iniciativa sin romper a los lectores de `done` (`briefing.tsx`, `daily-email.server.ts` y las herramientas del agente). Conservar `gtm_experiments` sin cambios: CA-41 crea una iniciativa enlazada al experimento. `segment_targets` puede alimentar la meta por público.
- **Ediciones concurrentes:** `mergeServerEdits` conserva lo no guardado y descarta el valor del servidor sin avisar (`src/lib/merge-edits.ts`); CA-71 exige además el aviso.
- Titulares con el patrón de `src/lib/headlines.ts`; reglas puras con pruebas.
- **Menú:** `src/lib/nav.ts` solo tiene el indicador `leadersOnly`, sin lógica por rol; CA-65, CA-66 y CA-80 exigen elementos visibles según el rol. La barra inferior (`BottomBar` en `src/routes/_authenticated/route.tsx:241-275`) tiene su propia lista y «Agente» es un botón, así que no comparte `nav.ts`: hay que alinear ambas listas.
- **Tareas existentes:** los puntos de creación (`quick-actions.tsx:68,152`, `debates.tsx:88`, `core-write.ts:186`, autopilot y detectores) deben pedir iniciativa (CA-83) o guardar propuestas «Sin asignar» (CA-78); `briefing.tsx:33` y `daily-email.server.ts:32` leen `done` y deben aplicar CA-84.
- Zona horaria de la organización: por defecto Europe/Madrid (decisión de Fede, 2026-10-30); configurable en los ajustes de SDD-2.
- Alternativa descartada: reutilizar el Ciclo GTM como objeto «objetivo» (es un documento, no una entidad medible).

## 14. Riesgos y dependencias
- Depende del SDD 1a (roles, objetivos, resultados clave y decisiones) y de los SDD de salida de Lovable A y B.
- Ocho unidades en dos SDD: riesgo de alcance menor que con un documento único, pero U-5 toca ocho puntos de creación de tareas y a los lectores de `done`.
- Consecuencia de la decisión de Fede: los roles distintos de Owner y Sales leader pierden la posibilidad de crear tareas de CRM mientras la fase esté activa (solo leen); queda por decidir si podrán crear tareas dentro de iniciativas existentes.
- Las tareas del agente sin iniciativa chocan con «toda tarea cuelga de una iniciativa»; se resuelve con CA-78 (propuestas «Sin asignar»).
- En esta fase todo valor entra a mano: el avance depende de que se actualice.
- Los criterios condicionales (CA-38, que depende de SDD-5) se prueban con un doble de la función futura.

## 15. Preguntas para Fede y para la revisión técnica
- Gate: ¿las tareas y experimentos existentes pueden migrarse a iniciativas sin perder datos? ¿Cuántos hay? (sin dato).
- Gate: ¿qué hace hoy el agente actual sobre tareas, y cómo convive con el ejecutor «agente» de SDD-5?

## 16. Pendiente de verificar
- Roles distintos de Owner y Sales leader: en esta fase solo leen tareas y hoy pueden crearlas (también las ligadas a cuenta o deal); confirmar si podrán crear tareas dentro de iniciativas existentes → Fede. No bloquea la aprobación.
- Cantidad de tareas y experimentos existentes a migrar → datos de producción.
- Textos del titular y mensajes (§9) contra la guía de voz de marca → Fede / guía.
- Uso real de las pantallas actuales → datos de producción.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
El informe del gate sobre la v3 (documento único previo a la división) está copiado sin editar en el §17 del SDD 1a. Los hallazgos que afectan a este SDD son los de tareas, ediciones simultáneas, orden de unidades, criterios no verificables (CA-57 y CA-62), pruebas mal nombradas (CA-59, CA-71 y CA-72) y la retirada de «ninguna tarea sin iniciativa» frente a R-3 y R-9.

**Respuesta del autor (v5, 2026-10-30).** CA-31 y CA-78 resuelven el choque de tareas con el agente; CA-41 y §13 quedan alineados; CA-57 y CA-62 reescritos; pruebas de CA-59, CA-71 y CA-72 renombradas; CA-71 reescrito (avisa y conserva lo no guardado); lectura de otros roles (CA-79). El gate informa; aprueba Fede.

**Respuesta del autor a la segunda pasada (v6, 2026-10-30).** El informe de la segunda pasada está copiado sin editar en el §17 del SDD 1a. Para este SDD: omitir por rol (CA-80), barra y menú por rol (CA-65, CA-66), tareas existentes (CA-83, CA-84), archivado de decisiones (CA-40), comentarios de puertas (CA-87), dueño de las decisiones de puertas (CA-45, CA-46), titular con Sin arrancar y Sin dato reciente (§9) y pruebas de lista de tareas y menú renombradas.

**Respuesta del autor a la tercera pasada (v7, 2026-10-30).** CA-88 (el Consejo ve iniciativas y puertas), CA-89 (auditoría de iniciativas, tareas y puertas), CA-90 (advertencia en puertas), CA-91 (pantallas de puertas), CA-84 (resúmenes siguen contando las tareas anteriores), CA-65 (Decisiones dentro de Objetivos y «Más herramientas»), CA-40 (archivar), CA-45 (varios Owners) y CA-79 (iniciativas para los demás roles); lista inferior y menú alineados en §13. Fede decidió el 2026-10-30 que la regla de iniciativa alcanza a todas las tareas nuevas, también las ligadas a una cuenta o a un deal (CA-83).

**Respuesta del autor a la cuarta pasada (v8, 2026-10-30).** El informe de la cuarta pasada está copiado sin editar en el §17 del SDD 1a. Para este SDD: CA-40 pasa a U-8 (incluye puertas); titular con casos de Atención y por rol (§9); CA-12 y CA-36 precisados; CA-45 y CA-49 alinean el estado de las decisiones de puertas (nacen Cerradas); CA-66 y CA-67 corregidos; CA-83 por organización; CA-84 cubre las herramientas del agente; respuestas ordenadas cronológicamente. Queda como pendiente no bloqueante si los roles distintos de Owner y Sales leader podrán crear tareas dentro de iniciativas existentes.

**Respuesta del autor a la quinta pasada (v9, 2026-10-30).** El informe está copiado sin editar en el §17 del SDD 1a. Para este SDD: CA-83 aplica por rol de la persona que crea la tarea (N-2) y CA-46 es la excepción abierta del ID de decisiones (N-3, en 1a CA-49).

## 18. Delta de implementación (lo rellena el agente al entregar)
Sin entrega todavía.
