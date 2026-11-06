# SDD-20261030-gtm-control-tower-1-objectives-tasks-home · [Feature] Objetivos, resultados clave, tareas, puertas y torre de control (fase 1)

**Tipo:** Feature · **Prioridad propuesta:** Alta
**Estado:** Borrador (v4, tras el gate) · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-10-30
**PRD:** `docs/prd/PRD-20261030-gtm-control-tower.md` · **Depende de:** los SDD de salida de Lovable A y B (SDD-20261029-lovable-exit-a y -b) cerrados antes de construir las unidades U-1 a U-9; U-0 puede hacerse antes pero se coordina con el SDD B (su CA-12 reescribe las llamadas a Apify)

> Un SDD dice cómo se verifica que está bien hecho. Cada criterio de aceptación (CA-n) debe poder tener una prueba automática que lo nombre.
> Los criterios no nombran tecnología; lo técnico va en el §13 como [Sugerencia — la revisión del gate las valida].
> Las reglas transversales del PRD (§6.2, R-1 a R-10) aplican a todo este SDD. En este SDD, «organización» es la empresa que usa Nokko; «cuenta» es una empresa prospecto o cliente.
> **Propuesta de división (decisión de Fede):** este SDD tiene 12 historias. Se entrega en dos tramos (ver §12): tramo A (núcleo: saneamiento, roles, objetivos, resultados clave, públicos y canales, decisiones) y tramo B (tareas, puertas, torre, Plan, Inicio y menú). Puede mantenerse como un solo SDD o dividirse en 1a y 1b sin cambiar sus criterios.

## 1. Resumen
Crea el núcleo del sistema: roles y activación por organización, objetivos con estados y retro, resultados clave medibles con estado calculado por regla, públicos y canales mínimos, iniciativas, tareas con subtareas y dependencias, puertas con cálculo informativo y confirmación manual, registro de decisiones con ratificación, torre de control en Objetivos, hoja de ruta y lista de tareas en Plan, resumen en Inicio, menú nuevo y auditoría. Además retira cuanto antes la lectura de LinkedIn por extracción automática. En esta fase **todas las fuentes de datos de los resultados clave son manuales**: las automáticas llegan en SDD-4.

## 2. Problema y para quién
Fede no tiene un lugar donde definir qué quiere conseguir y ver si lo cumple: hoy hay tareas planas, experimentos y sugerencias sin vínculo, y ningún objetivo medible. Para Fede (Owner), Flor (Sales leader) y el Consejo (lectura).

## 3. Evidencia y por qué ahora
- Código (repo de Nokko, solo lectura, 2026-10-30): tareas planas sin objetivo; experimentos y metas por segmento sin vínculo; un campo de texto «objectives» solo por cuenta (`account_plans.objectives`); Ciclo GTM con documentos aprobados pero sin objetivos medibles ni tareas; lectura de posts y ofertas de LinkedIn mediante un proveedor de extracción automática (herramientas del agente `linkedin_company_posts`, `linkedin_profile_posts`, `company_job_postings`).
- Documentos de Postin Core: F0-01 v6.3 (fuente del objetivo de 10.000 € MRR a 12 meses y de las 10 h/semana), F0-11 v1.2 (puertas de día 14 y 30: al menos 6 respuestas y 10 conversaciones, 4 de origen frío) e ICP-00 v2.4 (registro de decisiones con ID y dueño). Se usan como **ejemplos de la forma** de los datos, no como datos cargados por este SDD.
- Entrevista con Fede (2026-10-29/30): decisiones del PRD §6.
- Uso real de las pantallas actuales: **sin dato** [Por verificar].

## 4. Resultado buscado
- Fede crea un objetivo con resultados clave, tareas y puertas en una sola sesión y ve su estado calculado. Medición: observación en la revisión de fase; línea base: sin dato.
- Cero tareas **nuevas** sin iniciativa (las anteriores quedan aparte como legado, CA-41).
- Las puertas muestran su valor calculado y si cumplen; Fede solo confirma (G-3 del PRD). En esta fase las métricas de una puerta son resultados clave de entrada manual; las automáticas llegan en SDD-3 y SDD-4.

## 5. Alcance
**Incluye:** H-1 a H-12 (CA-1 a CA-78).
**No incluye:**
- Contexto estratégico y onboarding por bloques (SDD-2); atribución en leads y embudos (SDD-3); integraciones automáticas (SDD-4); chat y agente nuevos (SDD-5); señales y competidores (SDD-6); informe PDF y runway (SDD-7).
- Kanban y calendario (fases posteriores, sin SDD asignado).
- Gráfico de evolución de resultados clave (se guarda el historial; su gráfico no se entrega ahora).
- Copiar un objetivo al trimestre siguiente, notificaciones de tareas y recordatorios (fases posteriores).
- Sincronización con herramientas externas de tareas.
- Cualquier envío o publicación hacia el exterior.

## 6. Cambios de comportamiento (delta)
**Añadido:** rol Consejo, activación por organización y rol, objetivos, resultados clave con historial, iniciativas, tareas con subtareas y dependencias, públicos y canales mínimos, puertas, decisiones con ratificación y versiones, torre en Objetivos, hoja de ruta, lista de tareas con detalle, resumen en Inicio, auditoría.
**Modificado:** menú principal; Inicio (de panel de pipeline a resumen con titular-conclusión); la tarea nueva pasa de «suelta» a colgar de una iniciativa.
**Eliminado:** la lectura de posts y ofertas de empleo de LinkedIn por extracción automática (los datos ya guardados se conservan). Nada más se elimina; lo anterior se conserva accesible o archivado.

## 7. Historias y criterios de aceptación
Cada CA cita el objetivo G-n del PRD que cubre y el archivo de prueba (ruta por decidir en la implementación [Sugerencia]).

### H-1: Como Owner, quiero roles claros y activar la fase por organización y rol para introducirla sin riesgo.
- **CA-1** El sistema DEBE aplicar la matriz de permisos del §10 por rol y por vista. · cubre G-9, G-10 · prueba: `roles-council-phase.test.ts`
- **CA-2** El sistema DEBE ofrecer el rol Consejo con acceso de solo lectura a objetivos, resultados clave, iniciativas (título y estado), puertas, decisiones y retros, y con permiso para comentar. · cubre G-9, G-10 · prueba: `roles-council-phase.test.ts`
- **CA-3** El sistema DEBE ocultar al Consejo las tareas, cuentas, personas, fichas, llamadas y conversaciones, también cuando intente leerlas a través del agente, de Telegram o del servidor para asistentes. · cubre G-9, G-10 · prueba: `roles-council-phase.test.ts`
- **CA-4** SI un usuario solicita un elemento al que no tiene acceso, ENTONCES el sistema DEBE responder con un mensaje genérico, sin revelar si el elemento existe. · cubre G-9, G-10 · prueba: `roles-council-phase.test.ts`
- **CA-5** El sistema DEBE permitir al Owner activar o desactivar la fase por organización y, dentro de ella, por rol (primero Owner y Sales leader; después Consejo). · cubre G-10 · prueba: `roles-council-phase.test.ts`
- **CA-6** CUANDO se desactiva la fase, el sistema DEBE devolver el comportamiento anterior, conservar y ocultar los datos creados, y CUANDO se reactiva DEBE mostrarlos de nuevo. · cubre G-10 · prueba: `roles-council-phase.test.ts`
- **CA-7** El sistema DEBE mantener funcionando sin cambios la configuración actual de segmentos, ICP y posicionamiento. · cubre G-10 · prueba: `roles-council-phase.test.ts`
- **CA-8** DONDE una organización tenga varios Owners, el sistema DEBE permitir a cualquiera de ellos ratificar y confirmar puertas, y DEBE registrar cuál lo hizo. · cubre G-10 · prueba: `roles-council-phase.test.ts`
- **CA-76** MIENTRAS un usuario tenga un rol distinto de Owner, Sales leader o Consejo, el sistema DEBE ocultarle las pantallas nuevas de esta fase. [Por verificar con Fede: los otros siete roles actuales quedan sin acceso.] · cubre G-10 · prueba: `roles-council-phase.test.ts`
- **CA-77** El sistema DEBE advertir, junto a cada campo de texto libre visible para el Consejo (retros, decisiones y comentarios), que no se incluyan datos de clientes. · cubre G-10 · prueba: `roles-council-phase.test.ts`

### H-2: Como Owner o Sales leader, quiero crear y gestionar objetivos con un ciclo de vida para mantener el foco.
- **CA-9** CUANDO creo un objetivo, el sistema DEBE pedir nombre, tipo (ingresos, pipeline, activación y retención, marca) y, o bien fecha de inicio y fecha de fin (trimestre por defecto), o bien un evento de arranque y una duración, y guardarlo como Borrador. · cubre G-1 · prueba: `objectives-lifecycle.test.ts`
- **CA-10** CUANDO activo un objetivo, el sistema DEBE exigir al menos un público y al menos un resultado clave. · cubre G-1 · prueba: `objectives-lifecycle.test.ts`
- **CA-11** El sistema DEBE ofrecer los estados Borrador, Activo, Pausado, Cerrado y Archivado, con estas transiciones únicas: Borrador→Activo; Activo→Pausado; Activo→Cerrado; Pausado→Activo; Pausado→Cerrado; Cerrado→Archivado; y DEBE tratar un objetivo Archivado como de solo lectura. · cubre G-1 · prueba: `objectives-lifecycle.test.ts`
- **CA-12** CUANDO activo un objetivo y ya hay tres Activos, el sistema DEBE mostrar los Activos con su estado y las horas planificadas de referencia, y DEBE permitirme continuar o cancelar sin bloquear la activación. · cubre G-1 · prueba: `objectives-lifecycle.test.ts`
- **CA-13** CUANDO cierro un objetivo, el sistema DEBE exigir una retro con, por cada resultado clave, el valor final frente a la meta, y los campos «qué funcionó», «qué no» y «aprendizajes», y DEBE completar el cierre solo cuando estén rellenos. · cubre G-1 · prueba: `objectives-lifecycle.test.ts`
- **CA-14** CUANDO se completa una retro, el sistema DEBE mostrar los aprendizajes en la ficha del objetivo cerrado. · cubre G-1 · prueba: `objectives-lifecycle.test.ts`
- **CA-15** CUANDO pauso o cierro un objetivo, el sistema DEBE archivar sus tareas no Hechas (con sus subtareas), con el motivo y la fecha, sin borrarlas, y CUANDO reactivo un objetivo pausado DEBE restaurarlas con su estado anterior. · cubre G-1 · prueba: `objectives-lifecycle.test.ts`
- **CA-16** CUANDO el Owner marca un evento de arranque como ocurrido indicando su fecha, el sistema DEBE iniciar el objetivo en esa fecha y calcular su fin sumando la duración; MIENTRAS el evento no haya ocurrido, DEBE mostrar el objetivo como «Sin arrancar» (estado derivado) y DEBE omitir el cálculo de ritmo de sus resultados clave. · cubre G-1 · prueba: `objectives-lifecycle.test.ts`

### H-3: Como Owner o Sales leader, quiero resultados clave numéricos con estado calculado para saber si voy en ritmo.
- **CA-17** CUANDO creo un resultado clave, el sistema DEBE pedir nombre, unidad (texto libre), valor inicial, meta, fecha de inicio (por defecto la del objetivo), fecha meta (no posterior al fin del objetivo) y fuente, que en esta fase DEBE ser manual. · cubre G-1 · prueba: `key-results.test.ts`
- **CA-18** SI la meta es igual al valor inicial, o la fecha meta es anterior o igual a la fecha de inicio, ENTONCES el sistema DEBE rechazar el resultado clave y explicar qué corregir. · cubre G-1 · prueba: `key-results.test.ts`
- **CA-19** CUANDO se introduce un valor manual, el sistema DEBE guardarlo con fecha, autor y marca «Manual», y DEBE conservar el historial de todos los valores. · cubre G-1 · prueba: `key-results.test.ts`
- **CA-20** El sistema DEBE calcular el avance esperado a hoy como la interpolación lineal entre el valor inicial y la meta según la fecha, siendo 0 % antes de la fecha de inicio y 100 % desde la fecha meta. · cubre G-1 · prueba: `key-results.test.ts`
- **CA-21** El sistema DEBE calcular el avance real como (valor actual − valor inicial) / (meta − valor inicial), admitiendo valores negativos o superiores al 100 %, y DEBE funcionar igual cuando la meta es menor que el valor inicial. · cubre G-1 · prueba: `key-results.test.ts`
- **CA-22** El sistema DEBE asignar el estado En ritmo si el avance real alcanza al menos el 80 % del esperado (o la meta ya está alcanzada), Atención si está entre el 50 % (incluido) y el 80 % (excluido), En riesgo si es menor del 50 % o si el esperado es 0 y el real es negativo, y Sin dato si no hay valor; los umbrales (fuente: decisión de Fede) DEBEN ser fijos y estar visibles en la pantalla. · cubre G-1 · prueba: `key-results.test.ts`
- **CA-23** El sistema DEBE mostrar como estado del objetivo el del peor de sus resultados clave con dato, y Sin dato cuando ninguno lo tiene o no tiene resultados clave. · cubre G-1 · prueba: `key-results.test.ts`
- **CA-24** DONDE un resultado clave tenga fuente automática (SDD-4), SI su valor no se actualiza en más del doble de su intervalo de sincronización, ENTONCES el sistema DEBE mostrar el último valor con su antigüedad y el estado «Sin dato reciente», y DEBE omitir el cálculo de En ritmo, Atención y En riesgo. · cubre G-1 · prueba: `key-results.test.ts`

*Ejemplo de CA-20 a CA-22 (datos ficticios):* valor inicial 0, meta 100, fecha de inicio 1 de octubre, fecha meta 31 de diciembre; el 15 de noviembre el esperado es 50 %; con un valor actual de 30, el avance real es 30 % y representa el 60 % del esperado, así que el estado es Atención.

### H-4: Como Owner o Sales leader, quiero públicos y canales mínimos para que los objetivos tengan a quién y por dónde.
- **CA-25** El sistema DEBE permitir crear un público con nombre, descripción, nivel de evidencia (Verificado, Hipótesis o Falta) y, opcionalmente, un segmento existente. · cubre G-1 · prueba: `audiences-channels.test.ts`
- **CA-26** El sistema DEBE permitir asignar un mismo público a varios objetivos sin duplicarlo. · cubre G-1 · prueba: `audiences-channels.test.ts`
- **CA-27** MIENTRAS un público esté en Hipótesis, el sistema DEBE mostrar junto a él la regla «una hipótesis no justifica gasto comercial ni presupuesto de canal» como información, sin bloquear. · cubre G-1 · prueba: `audiences-channels.test.ts`
- **CA-28** El sistema DEBE ofrecer un catálogo de canales con LinkedIn orgánico, Outbound, Contenido y SEO, y Partners y eventos; DEBE permitir añadir otros con nombre único y descripción, y DEBE rechazar nombres duplicados (coste y resultados llegan en SDD-3). · cubre G-1 · prueba: `audiences-channels.test.ts`
- **CA-29** CUANDO se archiva un público usado por objetivos Activos, el sistema DEBE conservarlo en esos objetivos hasta que se cierren. · cubre G-1 · prueba: `audiences-channels.test.ts`

### H-5: Como Owner o Sales leader, quiero iniciativas y tareas con subtareas y dependencias para bajar el objetivo a trabajo.
- **CA-30** El sistema DEBE permitir crear iniciativas dentro de un objetivo, cada una vinculada a uno o más de sus resultados clave y a un canal. · cubre G-2 · prueba: `tasks-dependencies.test.ts`
- **CA-31** El sistema DEBE permitir a una persona crear tareas solo dentro de una iniciativa, con título, ejecutor (persona), estado (Pendiente, En curso, Hecha o Bloqueada), fecha límite, horas estimadas y reales (opcionales) y notas. · cubre G-2 · prueba: `tasks-dependencies.test.ts`
- **CA-32** El sistema DEBE permitir subtareas hasta tres niveles de profundidad, y DEBE impedir marcar Hecha una tarea con subtareas sin hacer. · cubre G-2 · prueba: `tasks-dependencies.test.ts`
- **CA-33** El sistema DEBE permitir que una tarea dependa de otras (también de otros objetivos); MIENTRAS alguna dependencia no esté Hecha, DEBE mostrar la tarea como Bloqueada con el motivo «Bloqueada por: <tarea>», y DEBE permitir además marcarla Bloqueada a mano indicando un motivo. · cubre G-2 · prueba: `tasks-dependencies.test.ts`
- **CA-34** SI una dependencia crearía un ciclo, ENTONCES el sistema DEBE rechazarla e indicar la cadena que lo causa. · cubre G-2 · prueba: `tasks-dependencies.test.ts`
- **CA-35** MIENTRAS una tarea dependencia esté archivada, el sistema DEBE dejar de considerarla bloqueante y DEBE avisar en la tarea dependiente de que su dependencia está archivada. · cubre G-2 · prueba: `tasks-dependencies.test.ts`
- **CA-36** El sistema DEBE permitir registrar la capacidad semanal de cada persona en horas; el Owner DEBE poder registrarla para cualquiera y cada persona para sí. · cubre G-2 · prueba: `tasks-dependencies.test.ts`
- **CA-37** El sistema DEBE calcular las horas planificadas de una persona en una semana (de lunes a domingo, en la zona horaria de la organización) sumando las horas estimadas de sus tareas hoja no Hechas cuya fecha límite caiga en esa semana, y DEBE indicar cuántas tareas no tienen horas; el resultado DEBE mostrarse como dato informativo, sin avisos ni bloqueo. · cubre G-2 · prueba: `tasks-dependencies.test.ts`
- **CA-38** DONDE el ejecutor de una tarea sea el agente (SDD-5), el sistema DEBE mostrarlo en la tarea y toda acción externa asociada DEBE requerir aprobación humana (PRD R-2). · cubre G-2 · prueba: `tasks-dependencies.test.ts`
- **CA-39** DONDE una tarea dependa de un cambio técnico de Postin, el sistema DEBE permitir marcarla «Requiere SDD» y guardar un enlace o referencia al SDD, y DEBE abstenerse de enviar ninguna petición a Dani por sí mismo. · cubre G-2 · prueba: `tasks-dependencies.test.ts`
- **CA-40** CUANDO borro un objetivo, iniciativa, resultado clave, tarea, público, canal, puerta o decisión, el sistema DEBE archivarlo y DEBE conservar el registro, salvo cuando una persona titular de datos o la ley exijan su supresión (PRD R-7). · cubre G-10 · prueba: `tasks-dependencies.test.ts`
- **CA-41** El sistema DEBE conservar las tareas y experimentos existentes antes de la fase, mostrarlos como «Sin objetivo (anterior)» y permitir adoptarlos: una tarea se asigna a una iniciativa y un experimento se convierte en una iniciativa conservando el original. · cubre G-2 · prueba: `tasks-dependencies.test.ts`
- **CA-78** MIENTRAS la fase esté activa, el sistema DEBE guardar como propuestas «Sin asignar» las tareas que cree el agente o un detector sin iniciativa, y DEBE mantenerlas fuera de las tareas activas hasta que alguien las asigne a una iniciativa. · cubre G-2 · prueba: `tasks-dependencies.test.ts`

### H-6: Como Owner, quiero puertas con criterio medible para decidir con datos si algo funciona.
- **CA-42** El sistema DEBE permitir crear una puerta con nombre, objetivo, uno o más criterios (resultado clave, comparador mayor o igual, menor o igual o igual, y umbral), fecha o evento de evaluación y consecuencia descrita en texto, y DEBE considerar que cumple solo cuando todos sus criterios cumplen. · cubre G-3 · prueba: `gates.test.ts`
- **CA-43** El sistema DEBE mostrar el valor calculado de cada criterio con los datos actuales cada vez que se consulta la puerta, y CUANDO llega la fecha de evaluación DEBE congelar ese valor y mostrarlo como «a fecha de evaluación». · cubre G-3 · prueba: `gates.test.ts`
- **CA-44** El sistema DEBE ofrecer los estados Pendiente, Cumple, No cumple (calculados), Confirmada cumple y Confirmada no cumple, y DEBE abstenerse de confirmar el resultado por sí mismo. · cubre G-3 · prueba: `gates.test.ts`
- **CA-45** El sistema DEBE permitir solo al Owner confirmar el resultado de una puerta, y CUANDO lo confirma DEBE registrar una decisión con su ID (H-7). · cubre G-3 · prueba: `gates.test.ts`
- **CA-46** SI una puerta se confirma como no cumplida, ENTONCES el sistema DEBE crear una decisión Abierta «Qué hacemos» asociada a ella y DEBE abstenerse de modificar objetivos, iniciativas o tareas por sí mismo. · cubre G-3 · prueba: `gates.test.ts`
- **CA-47** SI no hay dato para calcular un criterio, ENTONCES el sistema DEBE mostrar Sin dato y DEBE permitir al Owner confirmar el resultado a mano indicando el valor y su fuente, marcado «Manual». · cubre G-3 · prueba: `gates.test.ts`
- **CA-48** SI al crear una puerta su fecha de evaluación ya pasó, ENTONCES el sistema DEBE evaluarla con los datos actuales y mostrarla como evaluada hoy. · cubre G-3 · prueba: `gates.test.ts`

### H-7: Como Owner, quiero un registro de decisiones con ratificación para que lo acordado quede trazable.
- **CA-49** El sistema DEBE guardar cada decisión con ID legible, título, dueño, estado, qué bloquea (objetivo, puerta, tarea o documento), fecha y nota, y DEBE crearla en estado Abierta. · cubre G-3 · prueba: `decisions-ratification.test.ts`
- **CA-50** El sistema DEBE permitir solo estas transiciones de una decisión: Abierta→Cerrada; Cerrada→Ratificada; y, desde cualquier estado, →Reemplazada, indicando la decisión que la reemplaza. · cubre G-3 · prueba: `decisions-ratification.test.ts`
- **CA-51** El sistema DEBE permitir solo al Owner ratificar decisiones y objetivos, y CUANDO lo hace DEBE fijar la fecha y un ID de ratificación. · cubre G-3 · prueba: `decisions-ratification.test.ts`
- **CA-52** CUANDO alguien edita un objetivo o una decisión ratificados, el sistema DEBE crear una versión nueva, conservar la anterior y marcar el elemento «Modificado tras ratificación» hasta que el Owner lo ratifique de nuevo. · cubre G-3 · prueba: `decisions-ratification.test.ts`
- **CA-53** El sistema DEBE ofrecer una lista de decisiones filtrable por estado y por lo que bloquean, y DEBE permitir crear una decisión desde ella. · cubre G-3 · prueba: `decisions-ratification.test.ts`
- **CA-54** El sistema DEBE permitir al Consejo comentar decisiones y puertas, y DEBE impedirle ratificar o confirmar. · cubre G-9 · prueba: `decisions-ratification.test.ts`

### H-8: Como Owner o Sales leader, quiero una torre de control y un plan para ver el estado y bajarlo a tareas.
- **CA-55** El sistema DEBE mostrar, en la pantalla Objetivos, una tarjeta por objetivo Activo con su estado, cada resultado clave con su barra (valor inicial, actual, meta y marcador del ritmo esperado hoy), qué lo bloquea (tareas Bloqueadas y puertas con evaluación en los próximos 14 días), decisiones pendientes y tareas de la semana. · cubre G-1 · prueba: `control-tower-headlines.test.ts`
- **CA-56** El sistema DEBE mostrar, en Objetivos e Inicio, un titular calculado según las reglas del §9 y, SI faltan datos, ENTONCES DEBE mostrar el nombre de la sección en vez de un número inventado. · cubre G-1 · prueba: `control-tower-headlines.test.ts`
- **CA-57** El sistema DEBE mostrar cada estado con su palabra además de su color (En ritmo, Atención, En riesgo, Sin dato, Sin dato reciente, y Sin arrancar en objetivos), sin iconos. · cubre G-1 · prueba: `control-tower-headlines.test.ts`
- **CA-58** El sistema DEBE mostrar, junto a cada cifra de negocio de las pantallas de esta fase, su fuente y su antigüedad (PRD R-1). · cubre G-1 · prueba: `control-tower-headlines.test.ts`
- **CA-59** El sistema DEBE mostrar, en la pantalla Plan, una hoja de ruta trimestral con una fila por objetivo, las iniciativas como barras y las puertas, hitos y fechas límite como marcadores. · cubre G-2 · prueba: `plan-roadmap.test.ts`
- **CA-60** El sistema DEBE mostrar, en la pantalla Plan, una lista de tareas agrupable por objetivo o por fecha y filtrable por objetivo, iniciativa, canal, ejecutor, estado y fecha. · cubre G-2 · prueba: `control-tower-headlines.test.ts`
- **CA-61** CUANDO elijo una tarea de la lista, el sistema DEBE abrir su detalle sin salir de la lista, con subtareas indentadas, dependencias, motivo de bloqueo y horas. · cubre G-2 · prueba: `control-tower-headlines.test.ts`
- **CA-62** DONDE el usuario pida ver el grafo de dependencias, el sistema DEBE mostrar cada dependencia como una arista dirigida desde la tarea de la que depende hasta la tarea que queda bloqueada. (Mejora opcional, ver U-9.) · cubre G-2 · prueba: `dependency-graph.test.ts`

### H-9: Como usuario, quiero un Inicio claro y un menú que refleje el modelo nuevo.
- **CA-63** El sistema DEBE mostrar en Inicio el titular del §9, una línea por objetivo Activo con su nombre y estado, y las decisiones pendientes. · cubre G-1 · prueba: `control-tower-headlines.test.ts`
- **CA-64** MIENTRAS el chat nuevo (SDD-5) no esté activo, el sistema DEBE mantener en Inicio la entrada actual al agente y DEBE evitar mostrar un chat vacío. · cubre G-1 · prueba: `control-tower-headlines.test.ts`
- **CA-65** MIENTRAS la fase esté activa para mi rol, el sistema DEBE mostrar en el menú principal Inicio, Objetivos, Plan, Comercial (Cuentas, Leads, Pipeline y Personas) y Métricas, y DEBE ubicar el resto en Herramientas y Ajustes. [Sugerencia: Mercado aparece cuando exista SDD-6.] · cubre G-1 · prueba: `control-tower-headlines.test.ts`
- **CA-66** MIENTRAS la pantalla sea estrecha (el punto de corte de móvil del sistema visual), el sistema DEBE mostrar en la barra inferior Inicio, Plan, Agente y Decisiones. · cubre G-1 · prueba: `control-tower-headlines.test.ts`
- **CA-67** El sistema DEBE mantener accesibles las pantallas anteriores (Sugerencias, Estrategia GTM, Ciclo GTM, Debates, Asesor y demás) desde Herramientas hasta que Fede registre una decisión que autorice retirarlas. · cubre G-1 · prueba: `control-tower-headlines.test.ts`

### H-10: Como Owner, quiero auditoría de la estrategia para saber quién cambió qué.
- **CA-68** El sistema DEBE registrar quién, qué, cuándo y si fue una persona o el agente, en los cambios de objetivos, resultados clave, iniciativas, tareas, públicos, canales, puertas y decisiones y, donde existan, de conexiones. · cubre G-3 · prueba: `roles-council-phase.test.ts`
- **CA-69** El sistema DEBE mostrar la auditoría solo al Owner. · cubre G-3 · prueba: `roles-council-phase.test.ts`
- **CA-70** DONDE el agente haga cambios de estrategia (SDD-5), el sistema DEBE permitir al Owner deshacerlos durante 24 horas. El plazo de 24 horas lo decidió Fede el 2026-10-25 para acciones sobre campos (`docs/sdd/README.md`); extenderlo a los cambios del agente es decisión de esta iniciativa [Por verificar con Fede]. · cubre G-3 · prueba: `roles-council-phase.test.ts`

### H-11: Como usuario, quiero que las ediciones simultáneas y los errores no me hagan perder trabajo.
- **CA-71** CUANDO guardo un elemento que otra persona modificó desde que lo abrí, el sistema DEBE avisarme de qué cambió y DEBE conservar mis cambios sin guardar para que yo decida. · cubre G-10 · prueba: `concurrent-edits.test.ts`
- **CA-72** SI falla guardar por un error o por falta de conexión, ENTONCES el sistema DEBE conservar lo escrito en pantalla y DEBE explicar qué pasó y qué hacer. · cubre G-10 · prueba: `save-errors.test.ts`

### H-12: Como Owner, quiero retirar cuanto antes la lectura de LinkedIn por extracción automática para cumplir la regla de API oficial.
- **CA-73** El sistema DEBE dejar de obtener, en cualquier punto (pantallas, agente, tareas programadas, detectores de señales y servidor para asistentes), posts y ofertas de empleo de LinkedIn por extracción automática. · cubre G-10 · prueba: `linkedin-scrape-removal.test.ts`
- **CA-74** CUANDO se retira esa lectura, el sistema DEBE conservar los datos ya guardados y mostrarlos con su origen y su antigüedad. · cubre G-10 · prueba: `linkedin-scrape-removal.test.ts`
- **CA-75** El sistema DEBE mantener las reseñas de competidores obtenidas de fuentes que no son LinkedIn. · cubre G-10 · prueba: `linkedin-scrape-removal.test.ts`

## 8. Casos límite y errores
Cada caso remite al CA que lo cubre.
- Objetivo sin resultados clave → no se puede activar (CA-10); en Borrador su estado es Sin dato (CA-23).
- Resultado clave sin valor → Sin dato (CA-22).
- Antes de la fecha de inicio o tras la fecha meta → esperado 0 % o 100 % (CA-20).
- Meta menor que el valor inicial, meta superada, avance negativo → CA-21 y CA-22.
- Dato automático desactualizado → CA-24 (cuando existan fuentes automáticas).
- Dependencias circulares → CA-34; dependencia archivada → CA-35.
- Objetivo pausado o cerrado con tareas abiertas → CA-15.
- Puerta con fecha ya pasada al crearla → CA-48; sin dato → CA-47.
- Evento de arranque sin ocurrir → CA-16.
- Ediciones simultáneas → CA-71; error o sin conexión → CA-72.
- Un público compartido se archiva → CA-29.
- Fase desactivada con datos creados → CA-6.
- Consejo abre un enlace directo a algo que no ve → CA-4.
- Varios Owners → CA-8.
- Otra organización → nunca ve estos datos (PRD R-10).

## 9. Experiencia y copy
Sistema visual actual (Ink + Lima, versalitas con filete, sin iconos), textos en «tú».
- **Estados:** En ritmo, Atención, En riesgo, Sin dato, Sin dato reciente; Sin arrancar (solo objetivos); Borrador, Activo, Pausado, Cerrado, Archivado; Pendiente, En curso, Bloqueada, Hecha; Abierta, Cerrada, Ratificada, Reemplazada.
- **Titular (CA-56, CA-63), por prioridad:**
  1. Si hay objetivos En riesgo: «<N> objetivo(s) en riesgo: <nombre del peor>».
  2. Si no, y hay puertas con evaluación en los próximos 14 días: «<nombre de la puerta> se evalúa el <fecha>».
  3. Si no, y todos los objetivos con dato están En ritmo: «Todo en ritmo».
  4. Si no hay datos: el nombre de la sección.
  [Por verificar con Fede: el horizonte de 14 días y los textos.]
- **Mensajes sugeridos** (a validar con la guía de voz de marca): «Esta meta no puede ser igual al valor inicial: cambia una de las dos.» · «Este objetivo ya tiene tres activos: si sigues, tendrás que repartir el tiempo entre cuatro.» · «No hay dato reciente de esta fuente. Mostramos el último valor, de hace X días.»
- **Pantallas:** Inicio (resumen), Objetivos (torre y decisiones), Plan (hoja de ruta, lista y detalle). En móvil se apilan en ese orden.

## 10. Datos, permisos y privacidad
- **Conceptos nuevos:** Objetivo, Resultado clave (con historial de valores), Evento de arranque, Iniciativa, Tarea (subtarea y dependencia), Capacidad semanal, Público mínimo, Canal mínimo, Puerta (con criterios), Decisión (con versiones), Comentario, Retro, Entrada de auditoría.
- **Matriz de permisos:**

| Acción | Owner | Sales leader | Consejo |
|---|---|---|---|
| Crear y editar objetivos, resultados clave, iniciativas, tareas, públicos, canales y puertas | Sí | Sí | No |
| Activar, pausar y cerrar objetivos | Sí | Sí | No |
| Confirmar el resultado de una puerta | Sí | No | No |
| Ratificar decisiones y objetivos | Sí | No | No |
| Crear decisiones | Sí | Sí | No |
| Comentar decisiones y puertas | Sí | Sí | Sí |
| Ver objetivos, resultados clave, iniciativas, puertas, decisiones y retros | Sí | Sí | Sí |
| Ver tareas | Sí | Sí | No |
| Registrar capacidad | De cualquiera | Solo la propia | No |
| Ver auditoría | Sí | No | No |
| Activar la fase por organización y rol | Sí | No | No |

- **Privacidad:** ningún dato de clientes en tareas, notas ni pruebas; ejemplos con datos ficticios. Los datos de cada organización no se cruzan (PRD R-10).

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| ninguna en esta fase | — | — | — |

El cálculo de avance, estados y titulares es por reglas. El borrador de plan con IA llega en SDD-5.

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero [Sugerencia] | Tramo | Depende de |
|---|---|---|---|---|---|
| U-0 | Retirada de la lectura de LinkedIn por extracción automática | CA-73 a CA-75 | `linkedin-scrape-removal.test.ts` | A | — (coordinar con Lovable B) |
| U-1 | Roles, rol Consejo, aislamiento, activación por organización y rol, y el mecanismo de auditoría (que cada unidad completa para sus entidades) | CA-1 a CA-8, CA-68 a CA-70, CA-76, CA-77 | `roles-council-phase.test.ts` | A | Lovable A y B |
| U-4 | Públicos y canales mínimos | CA-25 a CA-29 | `audiences-channels.test.ts` | A | U-1 |
| U-2 | Objetivos: creación y estados | CA-9, CA-11 | `objectives-lifecycle.test.ts` | A | U-1 |
| U-3 | Resultados clave, historial, estados 80/50; activar, cerrar con retro y evento de arranque | CA-10, CA-13, CA-14, CA-16 a CA-24 | `key-results.test.ts`, `objectives-lifecycle.test.ts` | A | U-2, U-4 |
| U-7 | Decisiones, ratificación y versiones | CA-49 a CA-53 | `decisions-ratification.test.ts` | A | U-1 |
| U-5 | Iniciativas, tareas, subtareas, dependencias, capacidad, legado; aviso de foco y archivado al pausar o cerrar | CA-12, CA-15, CA-30 a CA-41, CA-78 | `tasks-dependencies.test.ts`, `objectives-lifecycle.test.ts` | B | U-3 |
| U-6 | Puertas y comentarios del Consejo | CA-42 a CA-48, CA-54 | `gates.test.ts`, `decisions-ratification.test.ts` | B | U-3, U-7 |
| U-8 | Objetivos (torre), Plan (lista, detalle, hoja de ruta), Inicio, menú, ediciones y errores | CA-55 a CA-61, CA-63 a CA-67, CA-71, CA-72 | `control-tower-headlines.test.ts`, `plan-roadmap.test.ts`, `concurrent-edits.test.ts`, `save-errors.test.ts` | B | U-5, U-6 |
| U-9 | Grafo de dependencias (opcional) | CA-62 | `dependency-graph.test.ts` | B | U-5 |

**Orden:** U-0, U-1, U-4, U-2, U-3, U-7, U-5, U-6, U-8, U-9. (U-0 primero porque la regla de API oficial no admite esperar; U-1 antes que el resto porque todo depende de roles y activación; U-4 antes de U-3 porque activar un objetivo exige un público; U-7 antes de U-6 porque confirmar una puerta crea una decisión.)

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- **Tareas** (hallazgo del gate): la tabla existente tiene `done` (booleano) sin estado ni iniciativa (`src/integrations/supabase/types.ts:4764-4780`) y ocho puntos de creación (`quick-actions.tsx`, `debates.tsx`, `core-write.ts`, autopilot, detectores y servidor para asistentes). Hay que añadir estado e iniciativa sin romper a los lectores de `done` (`briefing.tsx`, `daily-email.server.ts` y las herramientas del agente). Conservar `gtm_experiments` sin cambios: CA-41 crea una iniciativa enlazada al experimento. `segment_targets` puede alimentar la meta por público.
- **Rol del Consejo** (hallazgo del gate): no puede vivir en `org_members`, porque las políticas de unas 29 migraciones se basan en `is_org_member` y le darían lectura y escritura sobre todo el CRM (`drizzle/migrations/0002_multitenant_organizations.sql:120-123`). Sugerencia: Consejo en una tabla aparte con políticas solo sobre tablas y vistas nuevas, columnas limitadas en una vista (RLS filtra filas, no columnas) y bloqueo explícito en el agente, Telegram y el servidor para asistentes (`src/lib/agent.functions.ts:15-19`, `src/lib/channel-ctx.server.ts:11-15`); decidir el valor del enum de roles y los `Record<Role,…>` de `src/lib/roles.ts`.
- **Deshacer del agente:** `agent_pending_actions` no tiene caducidad ni deshacer; el deshacer actual solo borra lo creado y solo lo hace el Owner (`src/lib/agent.functions.ts:120-135`). El plazo de 24 horas de CA-70 es nuevo.
- **Ediciones concurrentes:** `mergeServerEdits` conserva lo no guardado y descarta el valor del servidor sin avisar (`src/lib/merge-edits.ts`); CA-71 exige además el aviso.
- **Activación por organización y rol:** `organizations` no tiene columna de ajustes (`types.ts:3557-3567`); hace falta una tabla nueva.
- **Retirada de LinkedIn** (más puntos que los previstos): `src/lib/agent/tools/linkedin.ts`, `src/components/linkedin.tsx`, `linkedinSignalItems` en `src/lib/web-research-core.ts:101-106` (job semanal y detector de señales), posts de stakeholders en `src/lib/ai-core.ts:99-104`, `src/lib/apify.functions.ts`, `job-runner.server.ts:71`, `src/lib/orchestrator/planner.ts:4`, `src/lib/mcp/tools/agent-tools.ts` y `.lovable/mcp/manifest.json`. Conservar `competitor_reviews` y `create_battlecard_from_reviews` (usan G2, no LinkedIn).
- Reglas puras con pruebas (como `revops.ts`, `headlines.ts`, `swipe.ts`); titulares con el patrón de `src/lib/headlines.ts`.
- Migraciones aditivas con organización por defecto y políticas por organización; probar con dos organizaciones ficticias. Las migraciones 0058 y 0059 están sin aplicar (`src/lib/AGENTS.md`); CA-68 sobre conexiones depende de `org_connection_events`, que solo existe en 0059.
- Zona horaria de la organización: se define en los ajustes de SDD-2; mientras tanto, la del usuario [Por verificar].
- Alternativa descartada: reutilizar el Ciclo GTM como objeto «objetivo» (es un documento, no una entidad medible).

## 14. Riesgos y dependencias
- Depende de que los SDD de salida de Lovable (A y B) estén cerrados.
- Doce historias y diez unidades: riesgo de alcance; se mitiga con los tramos A y B, con pruebas por unidad y con activación por rol.
- Rol del Consejo: un fallo de seguridad expondría datos de clientes; exige pruebas específicas (CA-3, CA-4).
- Edición directa por Flor sobre lo ratificado: mitigada por CA-52.
- En esta fase todo valor entra a mano: el avance depende de que se actualice.
- Conflicto de orden con Lovable: U-0 va primero y el SDD B reescribe las llamadas a Apify (su CA-12); si B se ejecuta antes, U-0 se aplica sobre su resultado. Las migraciones 0058 y 0059 no están aplicadas y la numeración de las nuevas migraciones de esta iniciativa está por fijar.
- Seguridad del Consejo: sin tabla aparte y bloqueo en el agente, Telegram y el servidor para asistentes, vería datos de clientes (CA-3). Los textos libres que ve pueden filtrar datos (CA-77).
- Reglas pendientes de confirmar con Fede: regla del peor resultado clave (CA-23), umbral de dato antiguo (CA-24), formato del ID de decisión (CA-49).

## 15. Preguntas para Fede y para la revisión técnica
- Fede: ¿el rol Consejo vive fuera de `org_members` (tabla aparte)? ¿Los otros siete roles quedan sin acceso (CA-76)? ¿El plazo de 24 horas se extiende a los cambios del agente (CA-70)? ¿Regla del peor resultado clave para el estado del objetivo? ¿Formato del ID de decisión (por ejemplo DEC-AAAAMMDD-n)? ¿Horizonte de 14 días para puertas próximas? ¿Un SDD o dos (1a y 1b)?
- Gate: ¿las tareas y experimentos existentes pueden migrarse a iniciativas sin perder datos? ¿Cuántos hay? (sin dato).
- Gate: ¿qué hace hoy el agente actual sobre tareas, y cómo convive con el ejecutor «agente» de SDD-5?

## 16. Pendiente de verificar
- Regla del peor resultado clave (CA-23) → Fede.
- Umbral de dato antiguo: «más del doble del intervalo de sincronización» (CA-24) → Fede.
- Formato del ID de decisión (CA-49) → Fede.
- Horizonte de 14 días y textos del titular (§9) → Fede / guía de voz de marca.
- Zona horaria por defecto de la organización (CA-37) → Fede.
- Uso real de las pantallas actuales → datos de producción.
- Compatibilidad de la migración con Lovable A y B → gate.
- Cantidad de tareas y experimentos existentes a migrar → datos de producción.
- Qué herramientas de reseñas de competidores dependen de LinkedIn (CA-75) → gate.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
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

**Respuesta del autor (v4, 2026-10-30).** Cada objeción se ha tratado en el texto de este SDD y del PRD: plazo de 24 h reformulado y marcado [Por verificar] (CA-70); «objectives» corregido; activación en tabla nueva (§13); coordinación de U-0 con Lovable B y migraciones 0058/0059 (cabecera, §13, §14); CA-71 reescrito (avisa y conserva lo no guardado); CA-41 y §13 alineados; unidades reordenadas con sus dependencias (§12); Consejo fuera de `org_members` y bloqueo en agente, Telegram y MCP (CA-3, CA-77, §13); tareas del agente como propuestas «Sin asignar» (CA-78, R-3, G-2); retirada de LinkedIn ampliada a todos los puntos (CA-73, §13); roles restantes sin acceso (CA-76); CA-57 y CA-62 verificables; pruebas de CA-59, CA-71 y CA-72 renombradas. **Pendiente: segunda pasada del gate sobre la v4.** El gate informa; aprueba Fede.

## 18. Delta de implementación (lo rellena el agente al entregar)
Sin entrega todavía.

