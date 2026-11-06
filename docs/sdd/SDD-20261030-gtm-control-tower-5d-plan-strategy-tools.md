# SDD-20261030-gtm-control-tower-5d-plan-strategy-tools · [Feature] Plan con IA y herramientas del agente para estrategia y contexto (fase 5d)

**Tipo:** Feature · **Prioridad propuesta:** Alta
**Estado:** Aprobado por Fede el 2026-10-31 (v3: corrige la segunda pasada del gate; sin tercera pasada, con los riesgos declarados en el §14) · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-10-31
**PRD:** `docs/prd/PRD-20261030-gtm-control-tower.md` · **Sustituye a:** `SDD-20261030-gtm-control-tower-5d-plan-ai` (archivado como [SUPERADO] el 2026-10-31 por decisión de Fede; su pasada del gate está en `docs/archivado/`) · **Depende de:** SDD 5a (agente, propuestas, memoria y fase por rol: U-1 a U-5), SDD 1a (objetivos: U-2; resultados clave: U-3; públicos y canales: U-4; ratificación, versiones y auditoría: U-7; deshacer de cambios del agente: U-1), SDD 1b (iniciativas y tareas: U-5; puertas: U-6), SDD 2 (bloques de contexto: U-2), SDD 3 (métricas y fuentes: U-1), SDD 4a (fuentes medidas: U-3 y U-4, con U-5 diferida hasta el SDD-8; coste previo: U-8) y los SDD de salida de Lovable A y B para construir · **Depende también de:** SDD 5b U-2 (el check-in enlaza los bloques pendientes) y SDD 5c U-1 y U-2 (el servidor para asistentes y Telegram reciben estas herramientas con sus reglas) · **Antes:** `SDD-20261030-gtm-control-tower-5a-agent-memory.md`

> Un SDD dice cómo se verifica que está bien hecho. Cada criterio de aceptación (CA-n) debe poder tener una prueba automática que lo nombre.
> Los criterios no nombran tecnología; lo técnico va en el §13 como [Sugerencia — la revisión del gate las valida].
> Las reglas transversales del PRD (§6.2, R-1 a R-10) aplican a todo este SDD. «Organización» es la empresa que usa Nokko; «cuenta» es una empresa prospecto o cliente.
> Este SDD recoge lo que el SDD 5a dejó a su cargo: las herramientas que proponen cambios de estrategia y leen o escriben los bloques de contexto, con las que dejan de probarse con un doble 5a CA-22 a CA-24 y 1a CA-70 (CA-4), y lo que el SDD 1b dejó a la serie 5: el borrador de plan con IA.

> **Enmienda aprobada (2026-11-02)** por `SDD-20261031-gtm-control-tower-8-postin-views-nokko`: «4a U-5» pasa a «SDD-8 lado Nokko», y el «valor medido» de §10 y CA-10 admite también el total de Postin como fuente medida.

## 1. Resumen
Da al agente herramientas para **leer los cuatro bloques de contexto** y para **proponer** (nunca aplicar) cambios sobre objetivos, resultados clave, iniciativas, públicos, canales, puertas, decisiones y datos de contexto, y añade el **plan con IA**: un borrador completo y editable, en **bloques por objetivo** que el Owner o el Sales leader aprueban uno a uno. Aprobar un bloque crea el objetivo en **Borrador** con sus elementos; activar y ratificar siguen siendo pasos aparte del Owner. El plan se genera con lo que haya, marca «Supuesto» lo que no está confirmado ni medido, no inventa cifras y muestra su coste previo junto al botón.

## 2. Problema y para quién
Hoy convertir una estrategia en objetivos, resultados clave, iniciativas y tareas es trabajo manual, y el agente no puede proponer nada sobre esa estructura ni leer los bloques de contexto del SDD 2. Para Fede (Owner) y Flor (Sales leader).

## 3. Evidencia y por qué ahora
- **Código (repo de Nokko, solo lectura, 2026-10-31):**
  - El agente no tiene herramientas que propongan cambios sobre objetivos, resultados clave, iniciativas, públicos, canales, puertas o decisiones, ni que lean o escriban los cuatro bloques del SDD 2; lo más parecido (`update_positioning`, `upsert_segment`, `create_icp`, `set_quota`) toca la configuración anterior, y la entrevista usa `get_setup_status` (`src/lib/agent/tools/`).
  - Existe el flujo «Plan GTM», que redacta un documento de siete secciones; guardarlo en Drive es un botón manual (`src/lib/bmad/workflows.ts`, `src/routes/_authenticated/cycle.tsx`); no crea objetivos, iniciativas ni tareas.
  - Las acciones pendientes del agente (`agent_pending_actions`) tienen hoy los estados pendiente, confirmada, cancelada y fallida, sin caducidad ni aprobador; la caducidad y el aprobador los añade 5a CA-31.
- **PRD:** «Plan con IA: borrador completo editable, aprobado por bloques» (§6.1) y «la falta de bloques cubiertos impide activar objetivos, no crearlos en Borrador».
- **SDD aprobados:** 1b §11 dejó el borrador de plan con IA a la serie 5; 5a CA-22 a CA-24 y 1a CA-70 se prueban con un doble hasta que existan estas herramientas.
- **Decisiones de Fede para este SDD (2026-10-31):**
  - un bloque por objetivo;
  - el borrador no exige los cuatro bloques cubiertos y marca «Supuesto» lo que falta;
  - aprobar un bloque crea el objetivo en Borrador con sus elementos;
  - generan y aprueban Owner y Sales leader, y ratifica el Owner;
  - el valor inicial de un resultado clave sale de una fuente medida o queda «Sin dato», y la meta y la fecha son «Supuesto»;
  - el agente escribe en los bloques de contexto como propuesta pendiente con nivel «Supuesto» o «Deducido»;
  - el coste previo se muestra junto al botón, sin confirmación;
  - si ya hay objetivos, «Generar plan» solo genera lo que falta y propone cambios.
- **Decisiones de Fede sobre la primera pasada del gate (2026-10-31, «recomendadas»):**
  - este SDD sustituye al otro 5d, que se archiva;
  - la IA propone metas, umbrales y fechas como «Supuesto» con su motivo; el valor inicial y el actual, solo medidos o «Sin dato»;
  - antes de activar un objetivo con datos «Supuesto» sin confirmar solo se avisa, no se bloquea;
  - el tope de tres bloques es por borrador, y con tres objetivos vivos «Generar plan» no genera;
  - un bloque se aprueba solo desde la pantalla del plan; el check-in y Telegram solo lo enlazan o lo descartan;
  - con la fase activa, los roles que SDD 2 CA-7 deja consultar los bloques los leen con su agente, en solo lectura; proponer y generar sigue siendo del Owner y del Sales leader;
  - el coste previo del plan es una excepción a «los borradores con IA no llevan tarjeta de coste» (PRD §6.1);
  - con la fase activa, la entrevista guarda solo como propuesta de contexto y deja de ofrecer las herramientas de configuración anterior.
- **Decisiones de Fede sobre la segunda pasada del gate (2026-10-31, «recomendadas»):**
  - las tareas del plan nacen sin fecha límite ni hora hasta que una persona las ponga;
  - editar un campo «Supuesto» lo confirma; la confirmación explícita queda para lo que no se toca;
  - un público nuevo compartido entre bloques se resuelve por nombre al aprobar, y el deshacer solo archiva lo que ningún otro objetivo usa;
  - la persona elige los tipos de objetivo que genera antes de pulsar, con el coste visible;
  - un bloque caducado, «rechazada por cambio» o «fallida» se puede copiar a uno nuevo sin nuevo gasto de IA;
  - lo que la persona dice en la entrevista se guarda con origen persona, incluidos clientes y MRR; el agente nunca los deduce;
  - los recuerdos de empresa no se envían al modelo hasta que exista un filtro de nombres: solo los campos estructurados de los bloques;
  - el tope de elementos por bloque se fija antes del brief, tras una prueba de tamaño (§15).
- **Decisiones de Fede sobre el informe paralelo de la segunda pasada (2026-10-31, «recomendadas»):**
  - las tareas de un bloque aprobado quedan fuera de resúmenes, avisos y horas planificadas mientras su objetivo esté en Borrador;
  - el tope de bloques es tres menos los objetivos vivos (no tres por borrador);
  - editar un campo «Supuesto» lo confirma (como en la decisión anterior);
  - el deshacer de 24 horas no cubre las tareas que crea o cambia el agente, porque 5a CA-24 no las incluye.
- Uso real del flujo «Plan GTM» actual: **sin dato** [Por verificar].

## 4. Resultado buscado
- Un plan completo se convierte en objetivos, resultados clave, iniciativas y tareas en Borrador sin tecleo manual (G-2 del PRD). Medición: bloques aprobados, descartados y caducados por plan (estados de 5a CA-31; CA-19). Línea base: sin dato.
- Ninguna cifra medida inventada y ningún cambio aplicado sin su aprobador (G-10). Medición: pruebas de CA-10 y CA-3.

## 5. Alcance
**Incluye:** H-1 a H-4.
**No incluye:**
- Activar objetivos, ratificar y el bloqueo de activación por contexto (SDD 1a y SDD 2): este SDD solo crea en Borrador y añade el aviso de CA-27 al activar.
- La siembra de contexto desde Drive y la importación de documentos (SDD 2).
- Agente, modos, memoria, propuestas y sus estados (SDD 5a); servidor para asistentes y Telegram (SDD 5c), que recibirá estas herramientas con sus reglas.
- Competidores y señales de mercado (SDD 6); vista del Consejo y runway (SDD 7).
- Crear canales nuevos: el plan usa solo el catálogo (1a CA-28).
- Cualquier acción externa o envío (PRD R-2).
- Replanificar a mitad de trimestre más allá de proponer cambios (CA-21).

## 6. Cambios de comportamiento (delta)
**Añadido:** herramientas del agente de lectura de contexto y de propuesta sobre contexto y estrategia; «Generar plan» con bloques por objetivo, edición y aprobación por bloque; coste previo de la generación; regeneración que solo completa lo que falta.
**Modificado:** con la fase activa, la entrevista del agente usa la cobertura de los cuatro bloques en lugar del medidor antiguo y guarda solo como propuesta de contexto (CA-6); el modo «plan» abre «Generar plan» (CA-22); 5a CA-22 a CA-24 y 1a CA-70 pasan de un doble a herramientas reales; al activar un objetivo con datos «Supuesto» sin confirmar sale un aviso que permite continuar (CA-27); las tareas de un bloque quedan fuera de resúmenes, avisos y horas planificadas mientras su objetivo esté en Borrador (CA-16, enmienda a 1b CA-37 y CA-84).
**Eliminado:** nada se borra (R-7).

## 7. Historias y criterios de aceptación
Cada CA cita el objetivo G-n del PRD que cubre y el archivo de prueba (ruta por decidir en la implementación [Sugerencia]).

### H-1: Como Owner o Sales leader, quiero que el agente lea mi contexto y proponga cambios de estrategia sin aplicarlos.
- **CA-1** MIENTRAS la fase esté activa para mi rol, el sistema DEBE dar al agente una herramienta de solo lectura sobre los cuatro bloques de contexto del SDD 2, con el nivel y el origen de cada dato y la cobertura de cada bloque (SDD 2 CA-1 a CA-3), a los roles que SDD 2 CA-7 deja consultarlos, y DEBE denegarla al Consejo (SDD 5a CA-36). · cubre G-4, G-10 · prueba: `agent-context-tools.test.ts`
- **CA-2** MIENTRAS la fase esté activa para mi rol, el sistema DEBE dar al agente una herramienta para proponer datos de los bloques de contexto y DEBE guardar cada dato como propuesta pendiente (SDD 5a CA-31) con uno de dos orígenes: lo que la persona dice en ese turno, con origen persona (SDD 2 CA-6), que puede incluir clientes y MRR; o lo que el agente deduce, con nivel «Supuesto» o «Deducido» y origen IA, que DEBE abstenerse de incluir clientes y MRR, que solo vienen de una persona, de la fuente de cobro o de la base de datos (SDD 2 CA-14). El sistema DEBE aplicar el dato solo cuando apruebe quien lo pidió, sin que aprobar convierta en confirmado un dato con origen IA (SDD 2 CA-6), DEBE conservar un dato escrito por una persona frente a una propuesta del agente (SI al aprobar el dato ya lo escribió una persona, ENTONCES la propuesta queda «rechazada por cambio», SDD 5a CA-31) y DEBE aplicar la capacidad de otra persona solo si aprueba el Owner (SDD 2 CA-7). · cubre G-4, G-10 · prueba: `agent-context-tools.test.ts`
- **CA-3** MIENTRAS la fase esté activa para mi rol, el sistema DEBE dar al agente las herramientas de propuesta del §10 para crear o cambiar objetivos, resultados clave, iniciativas, tareas, públicos, canales (solo del catálogo, SDD 1a CA-28), puertas y decisiones, DEBE guardar cada cambio como propuesta pendiente (SDD 5a CA-20 y CA-31), salvo la tarea sin iniciativa, que sigue SDD 5a CA-26 (directa y «Sin asignar»), sin aplicarlo por sí mismo y DEBE impedir que el agente ratifique (SDD 1a CA-51), proponga activar, pausar, cerrar o archivar un objetivo (SDD 1a CA-11) ni confirme el resultado de una puerta (SDD 1b CA-45), y DEBE limitar las propuestas de públicos al nivel Hipótesis, nunca Verificado (SDD 1a CA-25; SDD 2 CA-28). · cubre G-3, G-10 · prueba: `agent-strategy-tools.test.ts`
- **CA-4** El sistema DEBE aplicar a los cambios hechos con las herramientas de CA-3 la auditoría, el deshacer de 24 horas y la versión «Modificado tras ratificación» (SDD 5a CA-22 a CA-24; SDD 1a CA-52, CA-68 y CA-70), salvo las tareas que cree o cambie el agente, que 5a CA-24 no incluye en el deshacer. · cubre G-3, G-10 · prueba: `agent-strategy-tools.test.ts`
- **CA-5** El sistema DEBE ofrecer las herramientas de CA-2 y CA-3 solo al Owner y al Sales leader con la fase activa, DEBE ofrecer la de CA-1 solo a los roles allí indicados y DEBE denegar la llamada a cualquier otro rol y al Consejo (SDD 5a CA-36), también en el servidor para asistentes, que no oculta herramientas por rol y solo puede denegar al llamar, con un error que diga qué pasó y qué hacer (PRD R-8). · cubre G-10 · prueba: `agent-strategy-tools.test.ts`
- **CA-6** MIENTRAS la fase esté activa para mi rol, el sistema DEBE hacer que el modo entrevista del agente use la cobertura de los cuatro bloques (SDD 2 CA-3 y CA-4) en lugar del medidor antiguo, DEBE guardar lo que recoja solo con la herramienta de CA-2 como propuesta, con origen persona lo que yo diga, y DEBE dejar de ofrecerle las herramientas de configuración anterior (`update_positioning`, `create_icp`, `upsert_segment`, `create_pillar` y `set_quota`; `create_account` sigue ofrecida porque no toca los bloques); SI mi rol no tiene la herramienta de CA-2, ENTONCES DEBE decirme qué pasó y qué hacer en lugar de ofrecer la entrevista (PRD R-8); la extracción de recuerdos de cada turno no cambia (SDD 5a CA-12). · cubre G-4 · prueba: `agent-context-tools.test.ts`
- **CA-7** MIENTRAS la fase no esté activa para mi rol, también si lo estuvo antes (SDD 5c CA-12), el sistema DEBE mantener sin cambios el agente actual, su entrevista y sus herramientas, sin ofrecer ni dejar llamar a las de CA-1 a CA-3, en el panel del agente, en el servidor para asistentes y en Telegram (PRD R-9). · cubre G-10 · prueba: `agent-strategy-phase-guard.test.ts`

### H-2: Como Owner o Sales leader, quiero generar un borrador completo del plan con IA.
- **CA-8** MIENTRAS la fase esté activa para mi rol, CUANDO el Owner o el Sales leader pide «Generar plan», el sistema DEBE generar un borrador en bloques, uno por objetivo, de tipos distintos y elegidos por la persona antes de pulsar (CA-20), cada uno con su objetivo (SDD 1a CA-9), sus resultados clave (SDD 1a CA-17), sus públicos (SDD 1a CA-25), sus iniciativas vinculadas a resultados clave y a un canal (SDD 1b CA-30), las tareas dentro de cada iniciativa, sin fecha límite ni hora hasta que una persona las ponga (SDD 1b CA-31) y sus puertas (SDD 1b CA-42), y DEBE abstenerse de crear nada hasta que se apruebe un bloque. · cubre G-2 · prueba: `plan-generation.test.ts`
- **CA-9** El sistema DEBE generar el plan con lo que haya en los cuatro bloques de contexto (sin los recuerdos de la memoria, CA-28), sin exigir que estén cubiertos (SDD 2 CA-5 impide activar objetivos, no generar el plan), y DEBE marcar «Supuesto», con su motivo, cada campo marcable del §10 que no salga de un dato confirmado o medido, con un motivo que solo cite datos presentes en los bloques de contexto o en las mediciones (PRD R-1). · cubre G-2, G-4 · prueba: `plan-generation.test.ts`
- **CA-10** El sistema DEBE proponer como valor inicial de un resultado clave solo un valor medido por una fuente (§10; SDD 3, SDD 4a), con su fecha y antigüedad (si el objetivo arranca más tarde, el valor de hoy con su fecha) y con esa fuente en el resultado clave (SDD 4a CA-6 y CA-29), o «manual» si no hay fuente, o dejarlo en «Sin dato» (también si el último valor está «Sin dato reciente», PRD R-6), DEBE abstenerse de inventarlo (PRD R-1) y DEBE poder proponer la meta, la fecha meta, el umbral y la fecha de evaluación de una puerta solo como hipótesis marcadas «Supuesto», con su motivo. · cubre G-2, G-10 · prueba: `plan-numbers.test.ts`
- **CA-11** El sistema DEBE mostrar el coste previo estimado de cada generación junto al botón «Generar plan», o «sin dato» si no se puede estimar (SDD 4a CA-14), sin pedir una confirmación nueva: pulsar es la aprobación (PRD §6.1); es una excepción decidida por Fede a «los borradores con IA no llevan tarjeta de coste» (PRD §6.1). · cubre G-2, G-10 · prueba: `plan-cost.test.ts`
- **CA-12** El sistema DEBE ofrecer «Generar plan» solo al Owner y al Sales leader con la fase activa, DEBE mostrar cada borrador solo a quien lo pidió y DEBE denegar al Consejo y a los demás roles y DEBE ofrecerlo solo en la app, junto a su coste previo (CA-11), no en el servidor para asistentes ni en Telegram. · cubre G-10 · prueba: `plan-roles.test.ts`
- **CA-13** SI la generación falla, ENTONCES el sistema DEBE decirme qué pasó y qué hacer, y DEBE abstenerse de crear ningún elemento y de dejar bloques a medias: se descarta todo el borrador (PRD R-8). · cubre G-2 · prueba: `plan-generation.test.ts`
- **CA-22** MIENTRAS la fase esté activa para mi rol, el sistema DEBE hacer que el modo «plan» del agente abra «Generar plan» en lugar de redactar el flujo «plan» (los demás flujos de esa fase no cambian) y DEBE generar el documento Plan GTM solo a petición, a partir de los objetivos creados por bloques aprobados. · cubre G-2, G-7 · prueba: `plan-generation.test.ts`
- **CA-28** El sistema DEBE abstenerse de enviar al modelo, al generar el plan, texto libre de fichas, de conversaciones o de la memoria ni nombres de personas o de cuentas, y DEBE enviar solo los campos estructurados de los bloques de contexto, datos agregados, cargos y roles (PRD R-4). · cubre G-10 · prueba: `plan-privacy.test.ts`
- **CA-29** El sistema DEBE indicar al modelo que no proponga iniciativas ni tareas que obtengan o automaticen datos de LinkedIn por extracción, ni que valoren o puntúen perfiles (PRD R-5; SDD 1a CA-73). · cubre G-10 · prueba: `plan-privacy.test.ts`

### H-3: Como Owner o Sales leader, quiero revisar y aprobar el plan bloque a bloque.
- **CA-14** CUANDO reviso un bloque, el sistema DEBE permitirme editar cualquier campo, quitar elementos o descartar el bloque entero, DEBE sellar lo que edito como escrito por persona, dejando de marcar «Supuesto» el campo que edito (SDD 2 CA-6), y DEBE conservarlo frente a una propuesta posterior del agente sobre el mismo elemento (CA-3, CA-21). · cubre G-2, G-10 · prueba: `plan-blocks.test.ts`
- **CA-15** ANTES de aprobar un bloque, el sistema DEBE exigirme el valor inicial y la meta de cada resultado clave que estén vacíos o «Sin dato» (SDD 1a CA-17), contando como manual el valor que escribo (SDD 1a CA-19), y el ejecutor de cada tarea, que DEBE ser una persona miembro de la organización (SDD 1b CA-31), y DEBE marcar el bloque no aprobable mientras incumpla las validaciones de creación de SDD 1a CA-9, CA-17 y CA-18 y de SDD 1b CA-30, CA-31 y CA-42. · cubre G-2 · prueba: `plan-blocks.test.ts`
- **CA-16** CUANDO apruebo un bloque, el sistema DEBE crear el objetivo en Borrador (SDD 1a CA-9) y, colgando de él, sus resultados clave, iniciativas, tareas, puertas y públicos nuevos, todo marcado como generado por el plan con IA y por el bloque, DEBE mantener las tareas del bloque fuera de los resúmenes, los avisos y las horas planificadas mientras su objetivo siga en Borrador (enmienda a SDD 1b CA-37 y CA-84), con auditoría que diga que los generó el agente y quién aprobó (SDD 1a CA-68), y DEBE abstenerse de activar o ratificar nada (SDD 1a CA-10, CA-11 y CA-51). · cubre G-2, G-10 · prueba: `plan-blocks.test.ts`
- **CA-17** SI algún elemento de un bloque no se puede crear, ENTONCES el sistema DEBE abstenerse de crear ninguno de ese bloque, dejarlo «fallida» con sus ediciones visibles y decirme qué pasó y qué hacer (PRD R-8); y DEBE permitirme crear un bloque nuevo a partir de un bloque «fallida», «caducada» o «rechazada por cambio», con mis ediciones y sin nuevo gasto de IA. · cubre G-2 · prueba: `plan-blocks.test.ts`
- **CA-18** El sistema DEBE reutilizar los públicos existentes sin duplicarlos (SDD 1a CA-26), también el público nuevo que otro bloque ya aprobado creó, que resuelve por nombre al aprobar, DEBE crear los públicos nuevos en nivel Hipótesis y nunca Verificado (SDD 1a CA-25; SDD 2 CA-28), DEBE usar solo canales del catálogo y DEBE abstenerse de crear canales nuevos (SDD 1a CA-28). · cubre G-2, G-10 · prueba: `plan-blocks.test.ts`
- **CA-19** El sistema DEBE tratar cada bloque como una propuesta del SDD 5a, con sus estados y su caducidad (SDD 5a CA-31), aprobada solo por quien la pidió (SDD 5a CA-21), sin que editarlo reinicie su caducidad ni cambie su fecha, y congelada, sin admitir edición ni aprobación, si se desactiva la fase para su dueño (SDD 5a CA-34). · cubre G-2, G-10 · prueba: `plan-blocks.test.ts`
- **CA-23** CUANDO intento aprobar un bloque, el sistema DEBE rechazarlo como «rechazada por cambio» si algún público o canal que referencia se archivó o cambió (§10) desde la fecha del bloque, o si apareció un objetivo Borrador, Activo o Pausado del mismo tipo cuyo intervalo se solapa con el del bloque (un objetivo sin fechas cuenta como solapado, CA-20), y DEBE crear sus elementos una sola vez aunque se apruebe dos veces a la vez (SDD 5a CA-31). · cubre G-2, G-10 · prueba: `plan-blocks.test.ts`
- **CA-24** CUANDO el Owner deshace en 24 horas un bloque aprobado, el sistema DEBE deshacerlo entero o no hacer nada, DEBE negarse si algún elemento creado cambió después (§10) y DEBE archivar los elementos creados y solo desvincular, sin archivarlos, los públicos que ya existían o que otro objetivo usa (SDD 5a CA-24; SDD 1a CA-70). · cubre G-3, G-10 · prueba: `plan-undo.test.ts`
- **CA-25** El sistema DEBE guardar cada bloque con su organización, DEBE aprobarlo y crear sus elementos solo en ella aunque la app esté en otra empresa, DEBE comprobar al aprobar el rol y la pertenencia de la persona en esa organización y DEBE impedir que una organización vea o use los bloques de otra (PRD R-10; SDD 5c CA-14). · cubre G-10 · prueba: `org-isolation.test.ts`
- **CA-26** El sistema DEBE permitir aprobar un bloque solo desde la pantalla del plan; en el check-in, en Telegram, en Sugerencias y en las tarjetas del panel del agente DEBE limitarse a enlazarlo o descartarlo, como excepción declarada a SDD 5b CA-16, SDD 5a CA-32 y SDD 5c CA-7, que aprueban otras propuestas desde esas superficies. · cubre G-10 · prueba: `plan-blocks.test.ts`
- **CA-27** El sistema DEBE conservar la marca «Supuesto» en lo creado desde un bloque hasta que el Owner o el Sales leader lo confirme con una acción explícita, campo a campo, sin que aprobar el bloque confirme nada, y CUANDO se activa un objetivo con datos «Supuesto» sin confirmar, o cuya cobertura de contexto (SDD 2 CA-3) depende de datos «Supuesto» o «Deducido» sin confirmar o de un público en Hipótesis creado por el plan, DEBE avisar y permitir continuar. · cubre G-2, G-10 · prueba: `plan-assumptions.test.ts`

### H-4: Como Owner o Sales leader, quiero que, si ya tengo objetivos, el plan solo complete lo que falta y proponga cambios.
- **CA-20** El sistema DEBE hacer que «Generar plan» ofrezca un bloque por cada tipo de objetivo (ingresos, pipeline, activación y retención, marca) sin objetivo vivo (Borrador, Activo o Pausado) ni bloque pendiente de cualquier persona cuyo intervalo se solape con el trimestre natural en curso en la zona horaria de la organización (un objetivo sin fechas cuenta como solapado), DEBE dejar que la persona elija antes de pulsar cuáles de esos tipos generar, como máximo los que falten hasta tres objetivos vivos, con el coste previo visible (CA-11); DEBE abstenerse de generar y de gastar IA, diciéndolo, si ya hay tres objetivos vivos, si no falta ningún tipo o si ya hay una generación en curso en la organización; y DEBE abstenerse de aplicar ningún cambio sobre lo existente sin una propuesta del SDD 5a (CA-31). · cubre G-2 · prueba: `plan-regenerate.test.ts`
- **CA-21** SI un cambio propuesto afecta a un objetivo o una decisión ratificados, ENTONCES el sistema DEBE seguir SDD 5a CA-22: solo una propuesta, versión «Modificado tras ratificación» al aplicarla y ratificación solo del Owner. · cubre G-3, G-10 · prueba: `agent-strategy-tools.test.ts`

## 8. Casos límite y errores
Cada caso remite al CA que lo cubre.
- Contexto sin cubrir → el plan se genera con datos «Supuesto» y activar sigue bloqueado (CA-9; SDD 2 CA-5).
- Resultado clave sin valor medido → «Sin dato» y hay que dar el valor inicial antes de aprobar (CA-10, CA-15).
- Meta, fecha meta, umbral y fecha de evaluación del plan → «Supuesto» con su motivo hasta que alguien los confirme (CA-10, CA-27).
- Tarea sin ejecutor → hay que elegirlo antes de aprobar (CA-15).
- Falla la generación → nada creado y qué hacer (CA-13).
- Elemento inválido en un bloque (por ejemplo, un vínculo a un resultado clave que ya no existe al crear) → no se crea ninguno de ese bloque (CA-17).
- Público ya existente → se reutiliza; canal fuera del catálogo → no se crea (CA-18).
- Bloque editado → sellado como escrito por persona (CA-14).
- Bloque sin decidir 7 días → caducado (CA-19).
- Otra persona intenta aprobar mi bloque → denegado (CA-19).
- Deshacer lo creado dentro de 24 horas → se archiva (CA-24).
- Ya hay objetivos → solo lo que falta, y cambios como propuestas (CA-20); objetivo o decisión ratificados → versión y ratifica el Owner (CA-21).
- Modo «plan» del agente con la fase activa → abre «Generar plan»; el documento solo a petición (CA-22).
- Rol sin permiso o Consejo → denegado (CA-5, CA-12).
- Fase no activa → agente actual sin cambios (CA-7).
- El agente intenta ratificar → imposible (CA-3).
- El agente propone un dato de contexto sobre uno escrito por una persona → queda como propuesta y no lo pisa (CA-2).
- El agente propone clientes o MRR → no se propone (CA-2).
- Aprobar una propuesta de contexto → el dato conserva nivel e IA; no se confirma (CA-2).
- Aprobar un bloque cuyo público o canal cambió, o con un objetivo del mismo tipo ya vivo → «rechazada por cambio» (CA-23).
- Dos aprobaciones a la vez del mismo bloque → se crea una sola vez (CA-23).
- Fase desactivada con bloques pendientes → congelados (CA-19).
- Aprobar tras cambiar de empresa en la app → se crea en la organización del bloque (CA-25).
- Aprobar desde el check-in o Telegram → solo enlace o descarte (CA-26).
- Deshacer un bloque con elementos editados después → se niega entero; los públicos reutilizados se desvinculan (CA-24).
- Falla la creación de un bloque → «fallida», ediciones visibles y bloque nuevo a partir de él (CA-17).
- Activar un objetivo con datos «Supuesto» sin confirmar → aviso y se puede continuar (CA-27).
- Ya hay tres objetivos vivos o no falta ningún tipo → no genera ni cobra (CA-20).
- Otra persona tiene un bloque pendiente del mismo tipo → no se genera otro (CA-20).
- Texto de fichas o nombres de cuentas → no llega al modelo (CA-28).
- Rol que SDD 2 CA-7 deja consultar, con la fase activa → lee los bloques y no propone ni genera (CA-1, CA-5).
- Entrevista con la fase activa → solo propuestas de contexto, sin herramientas de configuración anterior (CA-6).
- Rol sin la herramienta de contexto con la fase activa → la entrevista no se ofrece y dice qué hacer (CA-6).
- Dato que la persona dice en la entrevista → propuesta con origen persona, también clientes y MRR (CA-2, CA-6).
- Una persona escribe un dato de contexto después de que el agente lo propusiera → la propuesta queda «rechazada por cambio» (CA-2).
- Tarea de un bloque → nace sin fecha límite ni hora (CA-8); la tarea sin iniciativa que crea el agente sigue 5a CA-26 (CA-3).
- Editar un campo «Supuesto» → deja de estar marcado (CA-14); lo no editado exige confirmación explícita (CA-27).
- Bloque caducado, «rechazada por cambio» o «fallida» → se puede crear uno nuevo a partir de él sin nuevo gasto de IA (CA-17).
- Dos bloques del mismo borrador comparten un público nuevo → el segundo lo reutiliza por nombre (CA-18); el deshacer no archiva un público que otro objetivo usa (CA-24).
- Pulsar «Generar plan» dos veces o con otra generación en curso → no se genera ni se gasta IA (CA-20).
- Elegir tipos de objetivo antes de generar → hasta tres, con el coste visible (CA-20, CA-11).
- Recuerdos de la memoria → no llegan al modelo (CA-28).
- Iniciativa o tarea que obtiene datos de LinkedIn por extracción o valora perfiles → el modelo recibe la instrucción de no proponerlas (CA-29).
- Coste que no se puede estimar → «sin dato» junto al botón y se puede generar igual (CA-11).
- Tareas de un bloque con el objetivo en Borrador → fuera de resúmenes, avisos y horas hasta activar (CA-16).
- El agente propone un público como Verificado → solo Hipótesis (CA-3).
- Con dos objetivos vivos → «Generar plan» ofrece como máximo un bloque más (CA-20).
- «Generar plan» desde el servidor para asistentes o Telegram → no se ofrece (CA-12).
- Activar un objetivo cuyo contexto depende de datos «Supuesto» o de un público en Hipótesis del plan → aviso y se puede continuar (CA-27).

## 9. Experiencia y copy
Sistema visual actual (Ink + Lima, versalitas con filete, sin iconos), textos en «tú».
- **Mensajes sugeridos** (a validar con la guía de voz de marca): «Este plan es un borrador. No se crea nada hasta que apruebes un bloque.» · «Supuesto: lo he estimado yo; confírmalo o cámbialo.» · «Falta el valor inicial de este resultado clave. Escríbelo para poder aprobar el bloque.»
- **Pantallas:** el botón «Generar plan» con su coste previo junto a él, en Plan y desde el agente (CA-8, CA-11); el borrador con una tarjeta por objetivo, editable, con la marca «Supuesto» y las acciones aprobar, editar y descartar (CA-14, CA-16); y la lista de bloques por estado (CA-19).

## 10. Datos, permisos y privacidad
- **Conceptos nuevos:** bloque del plan con su estado y su organización, marca de lo generado por el plan con IA y su bloque, motivo y confirmación de cada «Supuesto» y coste estimado de una generación.
- **Campos marcables «Supuesto» (lista cerrada):** meta y fecha meta de un resultado clave, fechas del objetivo, umbral y fecha de evaluación de una puerta. El resto del bloque (nombres, textos, vínculos) es propuesta que la persona revisa y no lleva marca. Meta y umbral son datos de plan, no cifras medidas (PRD R-1); el motivo de un «Supuesto» solo cita datos presentes en los bloques o en las mediciones.
- **Cambio de un elemento creado (CA-23, CA-24):** edición de un campo por una persona, activación o ratificación; no cuentan los valores medidos que se actualizan solos ni confirmar un «Supuesto».
- **Valor medido:** lectura automática o cálculo de las métricas del SDD 3 y del SDD 4a, con fuente y fecha; un valor manual escrito por una persona no lo propone el plan, y «Sin dato reciente» cuenta como «Sin dato».
- **Herramientas del agente (lista normativa, nombres definitivos los fija la implementación):** lectura `get_context_blocks`; propuesta de contexto `propose_context_data`; propuesta de estrategia `propose_objective_change`, `propose_key_result_change`, `propose_initiative_change`, `propose_task_change` (cambia tareas existentes o las crea dentro de una iniciativa; la tarea sin iniciativa sigue 5a CA-26), `propose_audience_change`, `propose_channel_change`, `propose_gate_change` y `propose_decision_change`. Ninguna aplica, ratifica, activa, pausa, cierra ni archiva.
- **Acceso (como exigen las reglas del repo):** las estructuras nuevas llevan organización por defecto la actual, acceso filtrado por organización y permisos explícitos; cada borrador lo ve solo quien lo pidió [Sugerencia — el gate valida].
- **Matriz de permisos:**

| Acción | Owner | Sales leader | Consejo | Otros roles |
|---|---|---|---|---|
| Generar el plan y aprobar sus bloques (los propios) | Sí | Sí | No | No |
| Proponer con las herramientas del agente (contexto y estrategia) | Sí | Sí | No | No |
| Leer los bloques de contexto con el agente (solo lectura) | Sí | Sí | No | Los roles que SDD 2 CA-7 deja consultarlos |
| Confirmar un dato «Supuesto» | Sí | Sí | No | No |
| Ratificar | Sí | No | No | No |
| Deshacer lo creado por un bloque (24 h) | Sí | No | No | No |

- **Privacidad:** el modelo recibe solo los campos estructurados de los bloques, datos agregados, cargos y roles, sin texto libre de fichas, conversaciones ni memoria, ni nombres de cuentas (CA-28); el texto libre de los bloques de contexto (por ejemplo, anti-ICP o alternativas) puede llevar nombres porque no hay detección automática (§14); el Consejo no ve el contenido de los bloques de contexto (SDD 2 CA-27); ningún dato de clientes en pruebas ni ejemplos.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| Generar el plan (un borrador con hasta tres bloques, o los que falten, CA-20) | Claves propias primero y, si fallan antes de actuar, la siguiente (cadena actual de proveedores) | Por decidir en el brief | Sí, junto al botón (CA-11) |
| Turno de entrevista y propuestas del agente | La misma cadena | El del agente de SDD 5a | No (conversación) |

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero [Sugerencia] | Depende de |
|---|---|---|---|---|
| U-1 | Herramientas del agente de lectura y propuesta de contexto y estrategia, deshacer y auditoría reales, entrevista con los cuatro bloques, guardia de fase y cambios sobre lo ratificado | CA-1 a CA-7, CA-21 | `agent-context-tools.test.ts`, `agent-strategy-tools.test.ts`, `agent-strategy-phase-guard.test.ts` | SDD 5a U-1 a U-5, SDD 1a U-1, U-2, U-3, U-4 y U-7, SDD 1b U-5 y U-6, SDD 2 U-2, SDD 5c U-1 y U-2 |
| U-2 | Generar el plan: borrador en bloques, contexto y supuestos, cifras, coste previo, permisos, errores, privacidad y regla de lo que falta | CA-8 a CA-13, CA-20, CA-28, CA-29 | `plan-generation.test.ts`, `plan-numbers.test.ts`, `plan-cost.test.ts`, `plan-roles.test.ts`, `plan-privacy.test.ts`, `plan-regenerate.test.ts` | U-1, SDD 1a U-0, SDD 3 U-1, SDD 4a U-3, U-4 y U-8 (U-5 opcional) |
| U-3 | Revisar y aprobar bloques: edición, datos obligatorios, creación en Borrador, atomicidad, reutilización, estados, organización, deshacer, supuestos y modo «plan» | CA-14 a CA-19, CA-22, CA-23 a CA-27 | `plan-blocks.test.ts`, `plan-generation.test.ts`, `plan-undo.test.ts`, `org-isolation.test.ts`, `plan-assumptions.test.ts` | U-2, SDD 5a U-2 y U-4, SDD 1a U-7, SDD 5b U-2 (superficies del CA-26) |

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- **Herramientas:** se añaden al registro único (`src/lib/agent/tools.ts`) con restricción de rol a Owner y Sales leader; las de escritura crean acciones pendientes como el resto (5a CA-31); el servidor para asistentes las recibe por el mismo registro con las reglas de 5c.
- **Contexto:** las herramientas de lectura y propuesta de bloques se apoyan en el almacén y el medidor de SDD 2 (U-2), no en `get_setup_status`.
- **Plan GTM actual:** el flujo «plan» de `src/lib/bmad/workflows.ts` sigue produciendo el documento para quien no tiene la fase; con la fase activa «Generar plan» es la entrada a los objetos y el modo «plan» del agente la abre (CA-22). Los flujos que declaran `requires: ["plan"]` (`validate_plan`, `architecture`, `readiness`, `account_breakdown`) no cambian.
- **Creación de un bloque:** debe ser atómica y única (CA-17, CA-23), por ejemplo en una sola operación de base de datos como las que el repo ya usa para otras altas, reutilizar las reglas de creación de 1a y 1b, guardar la marca del bloque y la organización (CA-25) y devolver al deshacer solo lo creado (CA-24). El contenido se valida con esquema estricto antes de guardarse como propuesta pendiente (patrón del asesor).
- **Cifras:** el valor inicial y el actual se leen de las métricas ya calculadas (SDD 3, SDD 4a) con su fuente y antigüedad; el modelo no genera cifras medidas, solo hipótesis marcadas (CA-10).
- **Deshacer:** el deshacer actual de la configuración (`undoSetupItems`) borra, así que no sirve para CA-24 (R-7); hace falta uno que archive. La aprobación de `decidePending` reclama la acción antes de ejecutar, lo que hace comprobable «una sola vez» (CA-23), pero no es transaccional (CA-17).
- **Pruebas que dejan el doble:** al entregar U-1, `agent-autonomy.test.ts` y `agent-undo.test.ts` (5a) y `roles-council-phase.test.ts` (1a) pasan a usar estas herramientas (§14).
- **Flujo `replan`:** existe en `src/lib/bmad/workflows.ts` y no cambia; solo el flujo «plan» se sustituye por «Generar plan» con la fase activa (CA-22).
- **Servidor para asistentes:** su lista de herramientas es estática y no puede ofrecer por rol o fase; solo deniega al llamar (CA-5, CA-7). Los títulos de las herramientas nuevas van en `TITLES` (`src/lib/mcp/tools/agent-tools.ts`) y en `.lovable/mcp/manifest.json`.
- Migraciones aditivas con organización por defecto; las 0058 y 0059 siguen sin aplicar (`src/lib/AGENTS.md`).

## 14. Riesgos y dependencias
- Depende de 5a (propuestas y fase por rol), de 1a, 1b y 2 (los objetos que crea) y de 3 y 4a (las cifras); si alguno no está activo, el plan no puede crear lo que le falta.
- **Calidad del plan:** un borrador con muchos «Supuesto» puede dar una falsa sensación de plan completo; CA-9 marca cada supuesto con su motivo y CA-15 obliga a dar los valores iniciales antes de aprobar.
- **Tamaño:** hasta tres bloques con iniciativas y tareas pueden ser grandes; no hay tope de elementos por bloque hasta que Fede lo fije tras una prueba de tamaño (§15); sin tope, el coste previo no tiene cota superior y la creación de un bloque grande puede fallar por tamaño.
- **Coste:** la estimación del coste de una generación con IA puede no ser exacta; CA-11 muestra la estimación y no pide confirmación.
- **Herramientas en el servidor:** las herramientas de CA-1 a CA-3 llegan a los asistentes externos por el registro común; toda escritura queda como propuesta (SDD 5c CA-2), y el deshacer y la auditoría de CA-4 valen para ellas.
- **Mientras 5d no esté:** 5a CA-22 a CA-24 y 1a CA-70 siguen probándose con un doble; al entregar 5d, ese doble se sustituye (CA-4).
- **Criterios con varias condiciones:** CA-1, CA-2, CA-3, CA-5, CA-6, CA-7, CA-8, CA-10, CA-11, CA-12, CA-13, CA-14, CA-15, CA-16, CA-17, CA-18, CA-19, CA-20, CA-22, CA-23, CA-24, CA-25, CA-26, CA-27 y CA-28 describen una regla con sus condiciones; el brief puede dividir sus pruebas.
- **Aprobar hipótesis de un clic cubre bloques:** un dato «Supuesto» o «Deducido» aprobado cuenta para la cobertura (SDD 2 CA-3) y desbloquea activar (SDD 2 CA-5) aunque nadie lo haya confirmado; CA-27 solo avisa al activar (también cuando la cobertura depende de esos datos o de públicos en Hipótesis del plan), por decisión de Fede.
- **Lectura de contexto por otros roles:** con la fase activa, los roles que SDD 2 CA-7 deja consultar leen también los bloques con su agente, incluido «Clientes y evidencia» (CA-1); es decisión de Fede.
- **Excepción de coste:** el coste previo del plan es una excepción a «los borradores con IA no llevan tarjeta de coste»; si se generan varias veces, la estimación puede quedar por debajo del coste real (CA-11).
- **Flujos que requieren plan:** con la fase activa el documento Plan GTM solo existe a petición; `validate_plan`, `architecture`, `readiness` y `account_breakdown` siguen avisando como hoy mientras no exista (CA-22).
- **Bloques pendientes de otra persona:** CA-20 cuenta un bloque pendiente que su dueño no ve; el aviso no revela quién lo pidió.
- **Texto libre y nombres:** sin detección automática de nombres, el texto libre de los bloques de contexto puede llevarlos; CA-28 limita lo que llega al modelo a campos estructurados, pero un campo estructurado de texto (anti-ICP, alternativas) sigue siendo riesgo residual.
- **Datos de contexto sin auditoría ni deshacer:** 5a CA-23 y CA-24 cubren los elementos de 1a CA-68, no los datos de contexto; estos solo guardan nivel y origen (SDD 2 CA-6).
- **Configuración anterior en otras superficies:** `update_positioning`, `create_icp`, `upsert_segment`, `create_pillar` y `set_quota` siguen disponibles en el chat, en Telegram y en el servidor; CA-6 solo las retira de la entrevista.
- **Valor inicial con arranque futuro:** si el objetivo empieza más tarde, el valor inicial es el de hoy con su fecha (CA-10).
- **Eventos de calendario:** al nacer las tareas sin fecha límite (CA-8), 4b CA-5 no crea eventos por aprobar un bloque; los crea cuando una persona pone la fecha.
- **Enmiendas a SDD aprobados:** un bloque no se aprueba desde el check-in, Telegram, Sugerencias ni el panel (CA-26, enmienda a 5b CA-16, 5a CA-32 y 5c CA-7); las tareas de un objetivo en Borrador quedan fuera de resúmenes, avisos y horas (CA-16, enmienda a 1b CA-37 y CA-84).
- **Tareas del agente sin deshacer:** el deshacer de 24 horas no cubre las tareas que crea o cambia el agente (5a CA-24), y CA-4 lo declara.
- **Tope de bloques:** es tres menos los objetivos vivos (CA-20); los objetivos vivos que ya pasan de tres no se tocan (1b CA-12).
- **Filtro de nombres:** CA-28 no filtra nombres de cuentas ni de contactos de forma determinista; se decidió no enviar los recuerdos y limitar el envío a campos estructurados, con el riesgo residual de arriba.
- **Excepción a 5b CA-16 y 5c CA-7:** un bloque no se aprueba desde el check-in ni Telegram (CA-26).
- Las etapas «Activa» y «Publicó» solo llegan de forma automática con el SDD-8 (SDD 4a CA-10); hasta entonces el plan propone «Sin dato» para ellas y la persona las escribe a mano.

## 15. Preguntas para Fede y para la revisión técnica
- Resuelto por Fede (2026-10-31): lo indicado en el §3.
- Resuelto por Fede (2026-10-31): con la fase activa el modo «plan» abre «Generar plan» y el documento Plan GTM se genera después, a petición, desde el plan aprobado (CA-22).
- Resuelto por Fede (2026-10-31): las ocho decisiones de la primera pasada del gate (§3); el deshacer de un bloque con elementos editados queda en CA-24.
- Resuelto por Fede (2026-10-31): las ocho decisiones de la segunda pasada del gate y las cuatro del informe paralelo (§3).
- **Antes del brief, Fede:** fija el tope de elementos por bloque tras una prueba de tamaño (CA-8); sin dato todavía, no se inventa.
- Revisión técnica: ¿cómo se estima el coste previo de la generación (CA-11)? El repo no tiene estimador de IA, así que sale «sin dato» hasta construir uno con precio por modelo, fuente y fecha. ¿Entra el gasto de IA en la vista de gasto (SDD 4a CA-16)?

## 16. Pendiente de verificar
- Uso real del flujo «Plan GTM» actual → datos de producción.
- Coste real y estimación de una generación con IA (CA-11) → proveedor de IA.
- Tope de elementos por bloque (CA-8) → gate.
- Que CA-23 y CA-24 se pueden probar con el almacén real de acciones pendientes: la reclamación previa de `decidePending` lo hace comprobable para «una sola vez»; la atomicidad y el deshacer que archiva hay que construirlos (§13) → implementación.
- Si SDD 1b CA-31 exige fecha límite al crear una tarea (lo lista sin decir si es opcional): CA-8 y CA-15 se ajustarían para que la persona la escriba antes de aprobar → 1b / implementación.
- Migraciones 0058 y 0059 sin aplicar → gate.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
**Primera pasada del gate (2026-10-31, sobre la v1).** Informe copiado sin editar.

**Veredicto:** Bloqueado

Bloquean seis puntos. Cuatro se arreglan con una o dos líneas cada uno: el doble archivo 5d, el modelo de cifras y «Supuesto», la regeneración y la organización del bloque. El ciclo de vida del bloque es el que más trabajo pide, y la guardia de fase fuera del panel es una línea por superficie. La parte mecánica está bien: cada uno de los 22 CA está en una sola unidad, las 9 pruebas del §7 coinciden con las del §12 y todas las remisiones del §8 existen.

Archivo revisado: `/Users/fedecosentino/NOKKO GTM BRAIN/seller-strategy-studio/docs/sdd/SDD-20261030-gtm-control-tower-5d-plan-strategy-tools.md`. En el informe lo llamo «5d-ST».

#### Bloqueantes

1. **Hay dos SDD 5d vivos y la numeración no cuadra.**
   - **Dónde:** cabecera L4 y L10, §17 L175, y el PRD (L5, L147 y la fila del §8, L221).
   - **Qué falla:**
     - Junto a este archivo existe `SDD-20261030-gtm-control-tower-5d-plan-ai.md`, también v1 en Borrador y con una pasada del gate «Bloqueado». El PRD apunta a ese otro archivo.
     - El PRD L147 cita «SDD 5d CA-22» para el modo «plan». En 5d-ST ese CA es el modo «plan»; en plan-ai, CA-22 es la guardia de fase.
     - 5d-ST se declara «v1, sin pasada del gate», pero recoge parte de aquel informe: CA-22, la guardia de fase y el `MIENTRAS` de las herramientas.
     - La nota «CA-22 se añade tras CA-13, sin reordenar» no tiene sentido en una primera versión.
   - **Cómo resolverlo:** declara 5d-ST como v2 que sustituye a plan-ai y cita aquella pasada en el §17. Propón archivar plan-ai como `[SUPERADO]` (con el OK de Fede) y actualiza el PRD L5, la fila del §8 (nombre, «Depende de»: falta 2, 3 y 4a) y L147.

2. **Cifras: CA-10 y el §13 se contradicen con CA-8 y CA-15, y la marca «Supuesto» no tiene modelo.**
   - **Qué falla:**
     - CA-10 (L72) prohíbe «inventar cifras» y el §13 (L148) dice «el modelo no genera cifras». Pero CA-10 deja la meta como «Supuesto», y una meta es una cifra.
     - CA-8 pide puertas con umbral (1b CA-42), fechas de evaluación y fechas meta. Las tareas también llevan horas (1b CA-31).
     - Una prueba no puede cumplir a la vez «el modelo no genera cifras» y «la meta es un número marcado Supuesto».
     - CA-15 solo exige el valor inicial, así que, si la meta queda vacía, el bloque no se puede crear (1a CA-17).
     - El §8 (L94) promete «Supuesto hasta que alguien los confirme», pero ningún CA define la acción de confirmar.
     - Tampoco dice dónde vive la marca tras crear en Borrador: 1a CA-17 y CA-19 no tienen campo para ella.
     - Ningún CA fija el nivel de evidencia de los públicos creados. Si salen «Verificado», cuentan como Confirmado (SDD 2 CA-28), cubren «Clientes y evidencia» y desbloquean activar (SDD 2 CA-5).
   - **Cómo resolverlo:**
     - Reescribe CA-10 así: «el valor inicial y el valor actual solo de fuente medida; la meta, la fecha meta, el umbral y la fecha de las puertas pueden proponerse como Supuesto con su motivo».
     - Añade un CA: la marca se conserva en lo creado y se confirma con una acción explícita del Owner o el Sales leader, campo a campo; aprobar el bloque no confirma.
     - Añade un CA: los públicos creados nacen en Hipótesis.
     - Si Fede quiere metas sin número, CA-15 debe exigir también la meta.

3. **El ciclo de vida del bloque no se puede probar** (CA-14, CA-17, CA-19; §15 L164; §16 L171).
   - **Qué falla:**
     - **«Rechazada por cambio» en una creación** (5a CA-31) no está definida: no hay «elemento afectado» con fecha previa.
     - **Editar un bloque (CA-14) cambia una propuesta pendiente,** y 5a CA-31 no lo prevé. No se dice si reinicia los 7 días ni si cambia la «fecha de la propuesta».
     - **«Fallida» es terminal.** 5a CA-31 no aplica una propuesta que no esté pendiente. Un fallo de CA-17 (fecha meta posterior al fin del objetivo, 1a CA-18, que CA-15 no valida antes) hace perder las ediciones sin poder reintentar.
     - **El deshacer de CA-19 «archiva lo creado»,** pero CA-18 reutiliza públicos que ya existían. Archivar un público reutilizado rompe otros objetivos; hay que desvincularlo.
     - **Elementos editados tras aprobar:** 5a CA-24 ya responde por elemento («SI el elemento cambió después, negarse»). Falta decir si el deshacer del bloque es todo o nada.
     - **Aprobar fuera de la pantalla del plan:** un bloque es una propuesta de 5a, y por eso aparece en el check-in (5b CA-15 y CA-16) y en Telegram (5c CA-8). Desde ahí se puede aprobar sin pasar por las exigencias de CA-15, porque no hay edición.
     - **Fase desactivada con bloques pendientes:** 5a CA-34 congela las propuestas, pero 5d no lo cita ni lo prueba.
   - **Cómo resolverlo:**
     - «Rechazada por cambio» al aprobar significa: un público o canal referenciado se archivó o cambió, o apareció un objetivo vivo del mismo tipo y periodo.
     - Editar no reinicia la caducidad.
     - Las validaciones de 1a CA-18 y 1b CA-42 pasan a ser condición de «aprobable», junto a CA-15.
     - El deshacer es todo o nada: se niega si cambió algún elemento creado, y desvincula (no archiva) los públicos reutilizados.
     - Un bloque solo se aprueba desde su pantalla; en el check-in y en Telegram, solo se enlaza o se descarta.
     - Añade al §8 la fase desactivada (5a CA-34).

4. **CA-20 no se puede probar** (L87).
   - **Qué falla:**
     - «El periodo» no está definido. Los objetivos pueden arrancar por evento y duración (1a CA-9).
     - Cuenta como existente un objetivo Cerrado («no archivado») pero no un bloque pendiente. Fede y Flor, o dos pulsaciones, generan dos bloques del mismo tipo, y CA-12 oculta cada borrador al otro.
     - Con los cuatro tipos libres, CA-8 permite tres bloques: ¿cuáles?
     - Si no falta nada, no dice qué hace.
     - Con tres objetivos activos, genera el cuarto contra «1 a 3 con foco» (PRD L72; 1b CA-12 solo avisa al activar).
     - «Proponer los cambios sobre lo existente» describe lo que hace el modelo, no una regla. Lo verificable es que ningún cambio sobre lo existente se aplique sin pasar por una propuesta.
   - **Cómo resolverlo:** «un bloque por tipo sin objetivo Borrador, Activo o Pausado ni bloque pendiente de cualquier persona cuyo intervalo de fechas se solape con el trimestre en curso; máximo tres; si no falta nada, lo dice y no genera ni cobra».

5. **El bloque no tiene organización (PRD R-10).**
   - **Qué falla:** ningún CA ata el bloque a su organización. Por `AGENTS.md`, `org_id` toma por defecto `current_org()`. Aprobar un bloque tras cambiar de empresa en la app crearía todo en la organización equivocada. El §10 L117 lo deja como [Sugerencia].
   - **Cómo resolverlo:** añade un CA como 5c CA-14: el bloque guarda su organización, se aprueba y se crea solo en ella, se comprueban el rol y la pertenencia al aprobar, y se prueba en `org-isolation.test.ts`.

6. **La guardia de fase solo cubre el panel del agente** (CA-7, L67).
   - **Qué falla:**
     - El registro filtra solo por rol: `toolsFor(roles)` en `agent.server.ts:105` y `canUseTool` en `mcp/tools/agent-tools.ts:117-129`. Por eso, según el §13 L144, las herramientas nuevas llegan solas al servidor para asistentes y a Telegram.
     - CA-7 dice «el agente», sin nombrar esas dos superficies.
     - 5c CA-5 y CA-13 usan «nunca activa», no «no activa». Tras desactivar la fase, el servidor sigue con el comportamiento nuevo y, sin una regla explícita, expondría estas herramientas.
   - **Cómo resolverlo:** amplía CA-7 a «también en el servidor para asistentes y en Telegram, aunque la fase estuviera activa antes (5c CA-12)».

#### Cambios menores

1. **CA-22 (L76): el modo «plan» de 5a CA-2 es una fase, no un flujo.**
   - La fase incluye `plan`, `validate_plan`, `unit_economics`, `messaging`, `journey` y `partner_plan` (`workflows.ts:30-55`). Hay que decir que solo cambia el flujo `plan`.
   - `validate_plan`, `architecture`, `readiness` y `account_breakdown` declaran `requires: ["plan"]` (L31, L32, L34 y L42). Falta decir qué pasa con ellos si el documento solo se genera a petición.
   - «Plan aprobado» no está definido (¿todos los bloques?, ¿alguno?).
   - El CA tiene dos obligaciones.

2. **CA-11: el coste del plan choca con una regla aprobada.** PRD L142 y 5a CA-29 dicen que «los borradores con IA no llevan tarjeta de coste».
   - Hay que declarar la excepción como decisión de Fede.
   - Falta el «sin dato» de 4a CA-14 cuando no se puede estimar. No encontré en `src` un estimador de coste de IA.
   - Falta decir si regenerar (CA-20) muestra coste.
   - «Cubre G-6» es incorrecto: G-6 son las fuentes de datos.

3. **CA-3 no enumera las herramientas.**
   - 5c y `TITLES` (que se replica en `.lovable/mcp/manifest.json`) dependen de sus nombres.
   - No excluye proponer activar, pausar, cerrar o archivar (1a CA-11; §5 L44) ni confirmar puertas (1b CA-45, solo el Owner).

4. **CA-2 omite tres restricciones.**
   - SDD 2 CA-14: los clientes y el MRR solo vienen de una persona o de una fuente.
   - No dice si aprobar la propuesta cuenta como «confirmar» (SDD 2 CA-6) y con qué nivel queda el dato.
   - Riesgo no declarado: aprobar hipótesis de un clic cubre bloques y desbloquea activar (SDD 2 CA-3 y CA-5).

5. **CA-6 (L66) no se puede probar tal como está.**
   - «Proponer lo que falta» es conducta del modelo.
   - No dice si la entrevista deja de usar `update_positioning`, `create_icp`, `upsert_segment`, `create_pillar` y `set_quota`. Hoy el prompt se lo pide (`agent.server.ts:44-46`); si sigue así, los bloques nunca se cubren.

6. **CA-14 cita SDD 2 CA-6, que trata de datos de contexto,** no de campos de un bloque. Usa una regla propia.

7. **CA-4 dice «se prueben con estas herramientas»,** pero nombra una prueba de 5d. Debería nombrar las de 5a (`agent-autonomy.test.ts`, `agent-undo.test.ts`) y la de 1a (`roles-council-phase.test.ts`) que dejan de usar el doble. CA-21 repite CA-3 y CA-4 en otra unidad (U-4).

8. **Privacidad (PRD R-4).** No hay CA. El §10 (L127) se apoya en 5a CA-19, que solo da una instrucción al extractor (5a §5: no hay detección de nombres).
   - El bloque «Clientes y evidencia» y la memoria de cuenta pueden llevar nombres. El Consejo ve los títulos de iniciativas y las puertas (1b CA-88).
   - Añade una regla de entrada: no enviar al modelo fichas ni nombres de cuentas, solo agregados.
   - Añade R-5: no proponer iniciativas de extracción de LinkedIn.

9. **CA-9 cita la «memoria del objetivo (5a CA-16)».** Ese CA la limita a conversaciones ligadas a un objetivo; un tipo nuevo no tiene objetivo, y la generación no es una conversación.

10. **CA-15: el ejecutor.** Falta decir si el agente puede ser ejecutor (5a CA-33) y si el bloque se puede aprobar con ejecutores que ya no son miembros.

11. **§3:** la línea L23 está bajo «Código» pero cita 5a CA-31. El código tiene `agent_pending_actions` con `pending`, `confirmed`, `cancelled` y `failed`, sin caducidad. El guardado en Drive del Plan GTM es un botón manual (`cycle.tsx:240`), no automático. Las decisiones del 2026-10-31 del §3, salvo L134, L143 y L147, no están en el PRD §6.1.

12. **§14 L158:** le faltan criterios con varias obligaciones: CA-3, CA-10, CA-12, CA-15, CA-19 y CA-22.

13. **Cabecera:** debería decir «Coordinar con 5b», porque los bloques salen en el check-in. A U-1 le falta 1a U-1 (CA-70), aunque llega por dependencia indirecta. U-2 cita 4a U-1, pero las fuentes medidas reales son 4a U-3 a U-5.

14. **§14 L159** cita 4a CA-10 como «métrica manual». 4a CA-10 es la lectura automática diferida al SDD-8; lo manual es una decisión del PRD (L123). Tampoco está claro si una entrada manual marcada cuenta como «valor medido» en CA-10.

#### Preguntas para Fede

1. ¿5d-ST sustituye a plan-ai? ¿Lo archivo como `[SUPERADO]` y actualizo el PRD?
2. ¿La IA propone metas, umbrales y fechas numéricas marcadas Supuesto, o los deja vacíos y obligatorios antes de aprobar?
3. Antes de activar un objetivo, ¿hay que confirmar los supuestos (bloquear) o solo se avisa?
4. Con tres objetivos vivos, ¿«Generar plan» no genera nada? ¿El tope de tres es por borrador o por objetivos vivos?
5. ¿Se puede aprobar un bloque desde el check-in o desde Telegram, o solo desde Plan?
6. Con la fase activa, ¿los demás roles leen los bloques de contexto con su agente? SDD 2 CA-7 les deja consultarlos y 5d CA-5 se lo niega.
7. ¿El plan con IA es una excepción a «los borradores con IA no llevan coste» (PRD L142)?
8. Con la fase activa, ¿la entrevista deja de ofrecer las herramientas de configuración antigua?

#### Hechos de código verificados / no verificados

**Verificados:**
- **Registro y guardia de fase:** el registro único `src/lib/agent/tools.ts` filtra solo por rol (`canUseTool`, `toolsFor`). `tool-kit.ts` no tiene campo de fase. `agent.server.ts:105` usa `toolsFor(ctx.roles)`. `mcp/tools/agent-tools.ts:117` construye el servidor desde `TOOLS`.
- **Herramientas actuales:** existen `update_positioning`, `upsert_segment`, `create_icp` y `set_quota` (`strategy.ts`) y `get_setup_status` (`core-read.ts:186`). El prompt de la entrevista las pide (`agent.server.ts:44-46`). No hay herramientas de objetivos, resultados clave, iniciativas, puertas, decisiones ni bloques de contexto.
- **Flujo Plan GTM:** está en `workflows.ts:17` y L30, con siete secciones. `requires: ["plan"]` aparece en L31, L32, L34 y L42. La fase «plan» agrupa seis flujos.
- **Acciones pendientes:** `agent_pending_actions` (`0007:56-75`) tiene estados `pending`, `confirmed`, `cancelled` y `failed`, sin caducidad. La política RLS solo deja leer y modificar a su dueño.
- **Migraciones:** 0058 y 0059 figuran sin aplicar (`src/lib/AGENTS.md` L54 y L57; SDD de salida de Lovable B).
- **Citas cruzadas que dicen lo que 5d afirma:**
  - 1a: CA-9, CA-10, CA-11, CA-17, CA-18, CA-25, CA-26, CA-28, CA-51, CA-52 y CA-70. CA-70 está en 1a U-1, no en las unidades que cita la cabecera.
  - 1b: CA-12, CA-30, CA-31 y CA-42.
  - SDD 2: CA-1 a CA-7 y CA-28.
  - 5a: CA-16, CA-19, CA-20, CA-21, CA-22, CA-23, CA-24, CA-31, CA-34 y CA-36.
  - 5c: CA-2, CA-5, CA-13 y CA-14.
  - 4a: CA-10, CA-14 y U-8.
  - Hay matices en SDD 2 CA-6 (citado en CA-14), 5a CA-16 (en CA-9) y 4a CA-10 (en el §14).

**No verificados:**
- Uso real del flujo Plan GTM.
- Si hay en algún sitio un estimador de coste de IA. No lo encontré en `src/lib`; solo coincidencias en `onboarding.ts` y `orchestrator/search.ts`, que no miré.
- Las reglas de acceso en producción.
- Las entidades de 1a, 1b, 2 y 4a no existen en código; son SDD sin construir.

#### Límites de la revisión

- Leí íntegros 5d-ST y el PRD, y el 5d plan-ai desde la L80 con su informe del gate.
- De 1a, 1b, 2, 4a, 5a, 5b y 5c leí los CA citados y las tablas de unidades; del SDD 3, las unidades. Algunas líneas largas salieron recortadas (1a CA-49, unidades de 4a).
- No leí 4b ni los SDD de salida de Lovable.
- No ejecuté pruebas ni consulté producción. No hay datos de clientes en este informe.

**Respuesta del autor (v2, 2026-10-31).** Fede decidió las ocho preguntas con las recomendaciones del gate y eligió este archivo como SDD 5d. Cambios por punto:

- **Bloqueante 1 (dos 5d):** este SDD sustituye al otro, archivado como `SUPERADO-SDD-20261030-gtm-control-tower-5d-plan-ai.md` con su pasada. Se quitó la nota de CA-22 y se actualizó el PRD (cabecera, fila del §8 y decisiones del §6.1).
- **Bloqueante 2 (cifras y «Supuesto»):** CA-10 distingue valor medido (inicial y actual) de hipótesis (meta, fecha meta, umbral y fecha de evaluación); §10 define «valor medido»; CA-15 exige también la meta; CA-27 define la confirmación explícita por campo y que activar solo avisa; CA-18 crea los públicos en Hipótesis.
- **Bloqueante 3 (ciclo de vida):** CA-23 define «rechazada por cambio» y la aprobación única; CA-19 fija que editar no reinicia la caducidad y que el bloque se congela con la fase desactivada; CA-17 deja el bloque «fallida» con ediciones y copia; CA-24 fija el deshacer entero o nada y desvincula los públicos reutilizados; CA-26 limita la aprobación a la pantalla del plan; CA-15 hace condición de «aprobable» las validaciones de 1a CA-18 y 1b CA-42.
- **Bloqueante 4 (CA-20):** reescrito con la regla del gate (tipo sin objetivo vivo ni bloque pendiente que se solape con el trimestre, máximo tres, no genera ni cobra si no hay nada o ya hay tres vivos).
- **Bloqueante 5 (organización):** CA-25 nuevo, según 5c CA-14.
- **Bloqueante 6 (guardia de fase):** CA-7 cubre panel, servidor para asistentes y Telegram, también si la fase estuvo activa antes.
- **Menores 1 a 14:**
  - CA-22 limita el cambio al flujo «plan» y el §13 y el §14 dicen qué pasa con los flujos que requieren plan; sigue como un solo CA y se declara en el §14.
  - CA-11 declara la excepción de coste, añade «sin dato» y corrige el objetivo cubierto.
  - CA-3 remite a la lista normativa del §10 y excluye activar, pausar, cerrar, archivar y confirmar puertas.
  - CA-2 añade clientes y MRR y que aprobar no confirma; el riesgo de aprobar de un clic va al §14.
  - CA-6 usa la herramienta de CA-2 como única vía y retira las cinco herramientas de configuración anterior.
  - CA-14 ya no cita SDD 2 CA-6.
  - CA-4 nombra las pruebas de 5a y 1a que dejan el doble.
  - CA-28 y CA-29 nuevos para privacidad (R-4) y LinkedIn (R-5).
  - CA-9 usa los recuerdos de empresa (5a CA-37) en vez de la memoria del objetivo.
  - CA-15 exige ejecutor persona y miembro.
  - §3 corregido (Drive manual, estados reales de las acciones, decisiones nuevas).
  - §14 amplía los criterios con varias condiciones.
  - Cabecera: coordina con 5b y 5c, añade 1a U-1 y las fuentes reales de 4a (U-3 a U-5).
  - §14 corrige la cita de 4a CA-10.
- **Sin cambio:** el tope de elementos por bloque, la estimación del coste y si el gasto de IA entra en la vista de gasto siguen como preguntas para la revisión técnica (§15).
- **Comprobación mecánica:** 29 CA únicos, cada uno en una sola unidad, pruebas del §7 y del §12 coinciden y todas las remisiones del §8 existen.

**Segunda pasada del gate (2026-10-31, sobre la v2).** Informe copiado sin editar; solo los títulos `##` pasan a `####` para no romper el esquema de 18 secciones (también en la primera pasada).

**Veredicto:** Bloqueado. Queda un bloqueante de resolución corta, la entrevista frente a CA-2. De la primera pasada, 6 de 6 bloqueantes y 13 de 14 cambios menores están resueltos o resueltos en lo esencial. Hay además un grupo de cambios menores de peso (§17 menores 1 a 6) que conviene cerrar antes del GO.

Ruta revisada: `/Users/fedecosentino/NOKKO GTM BRAIN/seller-strategy-studio/docs/sdd/SDD-20261030-gtm-control-tower-5d-plan-strategy-tools.md`. Lo llamo «5d». Cito líneas de ese archivo salvo que diga otra cosa. No he editado nada.

#### Bloqueantes

1. **CA-6 (L74) contradice CA-2 (L70): la entrevista no puede guardar lo que dice la persona.**
   - **Qué falla:** CA-6 manda guardar lo que recoja la entrevista «solo con la herramienta de CA-2».
     - CA-2 fuerza nivel «Supuesto» o «Deducido» y origen IA.
     - CA-2 prohíbe proponer clientes y MRR.
     - «Clientes y MRR, o 0» son datos obligatorios del bloque «Negocio y etapa» (SDD 2 §10, L116). La entrevista nunca podrá cubrir ese bloque.
     - Lo que la persona dice en el chat quedaría con origen IA, cuando SDD 2 CA-2 y CA-6 piden origen persona para lo que una persona escribe o confirma.
   - **Cómo resolverlo:** que la herramienta de CA-2 distinga «dicho por la persona en este turno» (origen persona, clientes y MRR permitidos) de «deducido por la IA» (origen IA, nivel Supuesto o Deducido, sin clientes ni MRR). Añade un caso al §8.

#### Cambios menores

Los seis primeros son los de más peso.

1. **CA-28 (L85) frente a CA-9 (L79): la regla de privacidad no se puede cumplir con texto libre.**
   - CA-9 manda enviar al modelo «los recuerdos de empresa». CA-28 prohíbe enviar «nombres de personas o de cuentas».
   - Sin detección de nombres (5a CA-19 y §5, que el propio §10 L161 reconoce), un recuerdo de empresa con un nombre rompe CA-28. Ninguna prueba lo detecta.
   - Los bloques de contexto son casi todos estructurados, así que el riesgo real son los recuerdos y el texto libre (anti-ICP, alternativas).
   - **Resolverlo:** redacta CA-28 como lista permitida de campos que llegan al modelo y decide si entran los recuerdos de empresa. Declara el riesgo residual en el §14.

2. **CA-14 (L89) frente a CA-27 (L99): editar un campo «Supuesto», ¿lo confirma?**
   - CA-14 sella lo editado como escrito por persona. CA-27 mantiene «Supuesto» hasta una acción explícita. Una prueba no sabe si la meta que tecleas sigue siendo «Supuesto».
   - Tampoco queda definido el alcance de la marca. CA-9 (L79) dice «cada dato del plan», CA-10 (L80) lista solo cuatro campos, y las fechas del objetivo, las fechas límite de tareas y las horas no están en ninguna lista.
   - CA-14 dice «conservarlo frente a cualquier propuesta posterior del agente», pero v2 ya no regenera bloques. ¿Qué propuesta es esa?
   - El «motivo» del Supuesto lo escribe el modelo y podría citar cifras externas sin fuente (PRD R-1).
   - **Resolverlo:** lista cerrada de campos marcables, «editar deja de ser Supuesto» (tu decisión, ver preguntas) y «el motivo solo cita datos presentes en los bloques o en las mediciones». Declara también que meta y umbral son datos de plan y no cifras medidas, porque R-1 literal dice «sin fuente, Sin dato».

3. **Tareas con fecha límite crean eventos en el calendario de otra persona.**
   - 4b CA-5 crea un evento de día completo por cada tarea con fecha límite asignada a una persona, sin mirar el estado del objetivo.
   - Aprobar un bloque crearía eventos con fechas «Supuesto», de un objetivo en Borrador, en calendarios ajenos. La pasada previa sobre el predecesor ya lo señaló (su menor 4 y su pregunta 7), y v2 no lo recoge.
   - **Resolverlo:** o las tareas del plan nacen sin fecha límite, o CA-16 dice qué pasa con 4b CA-5. Ver preguntas.

4. **CA-20 (L102) y CA-23 (L95) siguen con huecos.**
   - «Objetivos vivos» no está definido en CA-20 (¿Borrador, Activo y Pausado?).
   - «Trimestre en curso» no se define en 1a (L60), y un objetivo con evento de arranque y duración (1a CA-9) no tiene intervalo hasta que ocurre el evento.
   - Con los cuatro tipos libres, «como máximo tres» no dice cuáles.
   - CA-23 usa «mismo tipo y periodo» y CA-20 usa «intervalo que se solapa con el trimestre»: dos definiciones distintas.
   - «Cobrar» (L102) no es un concepto de producto. Quieres decir gastar IA.
   - Dos generaciones simultáneas pasan ambas la comprobación de CA-20 y duplican bloques y coste. Falta una regla de una generación a la vez por organización.
   - **Resolverlo:** define esos términos y alinea CA-23 con CA-20. Un objetivo sin fechas cuenta como solapado.

5. **Públicos nuevos compartidos entre bloques del mismo borrador, y qué es «cambió después».**
   - Los tres bloques salen de una generación y es normal que compartan un público nuevo. CA-18 y CA-23 no dicen si se resuelve por nombre al aprobar.
   - CA-24 archiva los públicos creados por el bloque. Si otro bloque aprobado ya lo usa, el deshacer rompe ese objetivo.
   - «Elemento creado cambió después» (L96) no excluye los valores de resultados clave (1a CA-52), que cambian solos con la lectura automática. Tampoco aclara si activar un objetivo o confirmar un «Supuesto» cuentan como cambio.
   - **Resolverlo:** el público nuevo se resuelve por nombre al aprobar, el deshacer solo archiva si ningún otro objetivo lo usa y si no lo desvincula, y define «cambió» (excluye valores medidos).

6. **Las ediciones se pierden al caducar o rechazar un bloque.** CA-17 solo ofrece «bloque nuevo a partir de él» para «fallida». Un bloque caducado (7 días, sin reinicio al editar) o «rechazada por cambio» obliga a regenerar con coste y perder el trabajo. Tampoco se dice si un bloque congelado (CA-19) admite edición. **Resolverlo:** extiende la copia a esos dos estados, sin nuevo coste de IA.

7. **CA-26 (L98) cita mal y contradice dos CA aprobados sin declararlo.**
   - 5b CA-16 permite aprobar una propuesta desde el check-in. 5c CA-7 hace lo mismo desde Telegram.
   - «5c CA-8» es la regla de organización, no la fuente de esta limitación.
   - **Resolverlo:** cita 5c CA-7 y declara CA-26 como excepción a 5b CA-16 y 5c CA-7, como hace el PRD con 4a y 4b («enmienda de…»). Añade la nota en el PRD §6.1.

8. **§8 con remisiones erróneas.**
   - L117 «Deshacer lo creado en 24 horas… (CA-19)» debe citar CA-24. CA-19 ya no trata el deshacer.
   - L112 pone «meta igual al valor inicial» como caso de CA-17, pero CA-15 lo hace no aprobable antes de crear. Cambia el ejemplo por un fallo de creación real.

9. **CA-6, restos.**
   - El prompt de la entrevista nombra seis herramientas y CA-6 retira cinco: falta `create_account` (`agent.server.ts` L46). Di si sigue ofrecida.
   - Las cuatro herramientas de configuración anterior que sí cita (`update_positioning`, `create_icp`, `upsert_segment`, `set_quota`) siguen disponibles en el modo chat, en Telegram y en el servidor. CA-6 solo cubre la entrevista.
   - Con la fase activa para un rol sin herramienta de CA-2 (por ejemplo marketing), la entrevista no puede guardar nada. Di qué ofrece.

10. **CA-2 (L70), restos.**
    - No dice qué pasa al aprobar una propuesta sobre un dato escrito por persona. «Conservar siempre» y «aplicar al aprobar» chocan.
    - No hay auditoría ni deshacer para los datos de contexto: 5a CA-23 y CA-24 y CA-4 cubren solo los elementos de 1a CA-68, que no incluyen datos de contexto.
    - La capacidad de otra persona solo la edita el Owner (SDD 2 CA-7), y 5d no lo prueba.

11. **CA-3 (L71) y 5a CA-26.** 5a CA-26 guarda directamente como «Sin asignar» las tareas que crea el agente. CA-3 manda guardar «cada cambio» como propuesta, tareas incluidas. Di que la tarea sin iniciativa sigue 5a CA-26 y la tarea dentro de una iniciativa pasa por propuesta.

12. **Orden y dependencias (§12 y cabecera).**
    - CA-5 (U-1) nombra «Generar plan», que llega en U-2.
    - CA-7 (U-1) exige la guardia en el servidor y en Telegram, y U-1 no depende de 5c U-1 ni U-2.
    - La cabecera y el PRD §8 dicen «coordinar con 5b y 5c», pero U-3 depende de 5b U-2 y 5c U-2.
    - CA-20 es la guarda de «Generar plan» y está en U-4. Entre U-2 y U-4 el botón puede duplicar objetivos y gastar IA.
    - **Resolverlo:** reubica o declara los puntos anteriores.

13. **U-2 depende de 4a U-5 (L173).** 4a U-5 está «diferida hasta que exista el SDD-8», que ni está redactado. El §14 L198 dice que, hasta entonces, el plan propone «Sin dato». Esa dependencia nació de la primera pasada (menor 13). **Resolverlo:** dependencia de U-3 y U-4 solamente, y U-5 como opcional.

14. **CA-10 (L80): resultado clave.**
    - «Valor actual» no existe al crear un resultado clave (1a CA-17 pide valor inicial, meta, fechas y fuente). Quítalo o defínelo como lectura de la fuente.
    - 1a CA-17 exige fuente, hoy «manual». Falta decir qué fuente lleva el resultado clave creado cuando hay una medida (4a CA-6, CA-29).
    - Si el objetivo arranca en el futuro, no se dice si vale el valor de hoy como inicial.

15. **CA-4 (L72) es un criterio de proceso.** Su prueba es `agent-strategy-tools.test.ts`, pero la obligación es que otras pruebas (5a, 1a) dejen de usar un doble. Separa el comportamiento (auditoría, deshacer y versión valen para las herramientas) de la tarea de retirar el doble, que va al §12 o §13.

16. **Citas imprecisas.**
    - CA-9 cita 5a CA-37 para «recuerdos de empresa». Cita 5a CA-12 y CA-14.
    - CA-11 cita R-2 para «pulsar es la aprobación». Eso sale del PRD §6.1 L122.
    - CA-16 cita SDD 2 CA-5 para «no activar». Mejor 1a CA-10 y CA-11.
    - CA-29 no incluye «nunca valorar perfiles» (PRD §5).

17. **CA-27 (L99) frente a §14 L193.**
    - El §14 dice que CA-27 avisa al activar cuando un dato de contexto aprobado por CA-2 es «Supuesto» o «Deducido». CA-27 solo habla de «lo creado desde un bloque».
    - Los públicos nuevos en Hipótesis (CA-18) cubren «Clientes y evidencia» (SDD 2 CA-28) y desbloquean activar sin aviso.
    - **Resolverlo:** o CA-27 cubre ambos, o el §14 deja de afirmarlo.

18. **Higiene.**
    - §14: faltan CA-1, CA-5, CA-6, CA-7, CA-14, CA-17, CA-18, CA-26 y CA-27 entre los criterios con varias obligaciones.
    - §4 L46 mide «editados» y ningún CA lo registra.
    - §5 L58 cita CA-20 para «proponer cambios»; ahora es CA-21.
    - §17: el informe copiado usa `##` y rompe el esquema de 18 secciones. Debería ser `###`.
    - Un servidor para asistentes con lista de herramientas estática no puede «ofrecer» por rol o fase: solo denegar al llamar. Usa «denegar» en CA-5 y CA-7 para ese caso.
    - Añade `TITLES` y `.lovable/mcp/manifest.json` al §13.

#### Preguntas para Fede

Todas cerradas, con mi recomendación.

1. **Las tareas del plan, ¿nacen sin fecha límite ni horas hasta que una persona las ponga?** Sí. Evita eventos de calendario con fechas «Supuesto» y datos inventados.
2. **Editar un campo «Supuesto», ¿cuenta como confirmarlo?** Sí, porque la persona lo escribió. La confirmación explícita queda para lo que no se toca.
3. **Un público nuevo compartido entre bloques, ¿se resuelve por nombre al aprobar y el deshacer solo archiva si nadie más lo usa?** Sí.
4. **Si faltan los cuatro tipos, ¿qué tres genera?** Que la persona elija los tipos antes de generar, con el coste visible.
5. **Bloque caducado o «rechazada por cambio», ¿se ofrece «crear bloque nuevo a partir de él» sin nuevo coste de IA?** Sí.
6. **Entrevista: lo que la persona dice, ¿se guarda con origen persona, incluidos clientes y MRR?** Sí. El agente nunca los deduce.
7. **¿Entran los recuerdos de empresa en lo que se envía al modelo?** No, hasta que exista un filtro de nombres. Se usan solo los bloques estructurados.
8. **Tope de elementos por bloque (§15, §16).** Fíjalo. Sin tope, la estimación de coste no tiene cota superior y un esquema estricto con todo o nada puede fallar por tamaño. El número lo decides tú tras una prueba de tamaño. No lo invento.

#### Estado de la primera pasada

**Bloqueantes**
- **B1 (dos 5d):** resuelto. El archivado existe en `docs/archivado/`, `sdd/` ya no tiene `plan-ai`, y el PRD (L5, §6.1 L147-150, §8 L224) apunta a este archivo.
- **B2 (cifras y «Supuesto»):** resuelto en lo esencial. CA-10, CA-15, CA-18 y CA-27 existen. Quedan los menores 2, 14 y 17.
- **B3 (ciclo de vida):** resuelto en lo esencial. Hay definición de «rechazada por cambio», caducidad sin reinicio, «fallida» con copia, deshacer entero o nada, aprobación solo en pantalla y congelación. Quedan los menores 5, 6 y 7.
- **B4 (CA-20):** parcial. Está la regla, pero faltan los huecos del menor 4.
- **B5 (organización):** resuelto con CA-25.
- **B6 (guardia de fase):** resuelto con CA-7, con el matiz del menor 18.

**Cambios menores 1 a 14**
- **Menor 1 (CA-22):** resuelto.
- **Menor 2 (CA-11):** resuelto, con un matiz de cita (menor 16).
- **Menor 3 (CA-3):** resuelto.
- **Menor 4 (CA-2):** parcial (menores 10 y 17).
- **Menor 5 (CA-6):** parcial, y con el bloqueante.
- **Menor 6 (CA-14):** resuelto, con la ambigüedad del menor 2.
- **Menor 7 (CA-4):** resuelto en nombres de prueba, pero queda el menor 15.
- **Menor 8 (privacidad y R-5):** parcial (menor 1).
- **Menor 9 (CA-9):** resuelto, con cita imprecisa.
- **Menor 10 (ejecutor):** resuelto.
- **Menor 11 (§3):** resuelto y verificado.
- **Menor 12 (§14):** parcial (menor 18).
- **Menor 13 (cabecera):** resuelto, con el problema nuevo del menor 13.
- **Menor 14 (cita de 4a CA-10):** resuelto.

**Preguntas 1 a 8:** las ocho decisiones están reflejadas en §3 L35-42 y en PRD L147-150.

**Comprobación mecánica propia**
- 29 CA únicos (1 a 29, sin huecos), cada uno en una sola unidad: U-1 con 7, U-2 con 9, U-3 con 11 y U-4 con 2.
- 13 archivos de prueba en §7 y los mismos 13 en §12.
- Las remisiones del §8 existen, salvo una mal apuntada (L117).
- PRD: cabecera L5, §6.1 y fila 5d del §8 coinciden con el SDD. «Cubre G-2, G-3, G-4, G-7, G-10» queda respaldado por los CA.
- Estructura de la fábrica: las 18 secciones están y el formato de CA con `cubre G-n · prueba:` es correcto.
- Tests de otros SDD que nombra CA-4: `agent-autonomy.test.ts`, `agent-undo.test.ts` y `roles-council-phase.test.ts` existen en 5a y 1a, y con el alcance que se les atribuye.

**Citas cruzadas contrastadas, una a una**
- **Correctas:**
  - 1a: CA-9, 10, 11, 17, 18, 25, 26, 28, 51, 52, 68, 70, 73.
  - 1b: CA-30, 31, 42, 45.
  - SDD 2: CA-1 a 7, 14, 28.
  - 5a: CA-20, 21, 22, 23, 24, 31, 34, 36.
  - 5c: CA-12, CA-14.
  - 4a: CA-14.
  - PRD: R-1, R-4, R-5, R-6, R-8, R-9, R-10.
- **Con matiz:** 5b CA-16 y 5c CA-8 (CA-26), 5a CA-37 (CA-9), PRD R-2 (CA-11), SDD 2 CA-5 (CA-16), SDD 2 CA-14 (aplica a siembra desde Drive).
- **Unidades citadas:**
  - Las unidades de 1a, 1b, 2, 4a y 5a que cita la cabecera existen y llevan los CA atribuidos.
  - 4a U-5 existe, pero está diferida (menor 13).

#### Hechos de código verificados / no verificados

**Verificados** (raíz `/Users/fedecosentino/NOKKO GTM BRAIN/seller-strategy-studio/`)
- `drizzle/migrations/0007_agent_proactive_channels.sql`:
  - `agent_pending_actions` tiene `status` con cuatro valores (`pending`, `confirmed`, `cancelled`, `failed`), `args` jsonb, `conversation_id` nulo, `org_id`.
  - No tiene caducidad ni aprobador. 0011 solo añade `source`.
  - Su política de actualización es solo de su dueño.
- `src/lib/agent.functions.ts` (`decidePending`):
  - Reclama con `update … eq("status","pending")` antes de ejecutar. Eso hace comprobable «una sola vez» en CA-23.
  - Marca `failed` si falla y no es transaccional, así que CA-17 necesita una operación única de base de datos.
  - Filtra por `ctx.orgId` (organización activa del perfil). Hoy «aprobar en otra empresa» da «Acción no encontrada»; CA-25 exige que cree en la organización del bloque.
- `src/routes/api/public/telegram/webhook.ts` aprueba con `decidePending` para cualquier acción, así que la regla de CA-26 en Telegram exige una excepción específica.
- `undoSetupItems` (`agent.functions.ts`) y `src/lib/setup-undo.ts` **borran** con `.delete()`. Chocan con R-7 y 5a CA-24, así que CA-24 no puede reutilizarlos.
- `src/lib/agent/tools.ts`:
  - El registro filtra solo por rol (`canUseTool`, `toolsFor`) y `ToolCtx` no tiene fase.
  - `agentMcpTools` es una lista estática (`src/lib/mcp/index.ts` L21).
  - `tool-kit.ts` ya tiene el campo `roles` por herramienta.
- El prompt de la entrevista (`agent.server.ts`) nombra `update_positioning`, `create_icp`, `upsert_segment`, `create_pillar`, `set_quota` y `create_account`. `get_setup_status` está en `core-read.ts` L186.
- `src/lib/bmad/workflows.ts`:
  - Las fases del agente agrupan los flujos. La fase «plan» contiene `plan`, `validate_plan`, `unit_economics`, `messaging`, `journey` y `partner_plan`.
  - `requires: ["plan"]` está en `validate_plan`, `architecture`, `readiness` y `account_breakdown`.
- `cycle.tsx` L240: guardar en Drive es un botón manual.
- No hay estimador de coste de IA en el código. Solo hay `integration_usage.cost` de proveedores. CA-11 devolverá «sin dato» hasta que se construya uno.
- `src/lib/AGENTS.md`: las migraciones 0058 y 0059 figuran «NOT VERIFIED, not applied».
- Existe `docs/factory/templates/sdd.md` con 18 secciones, y el 5d las respeta.

**No verificados**
- Entidades de 1a, 1b, 2, 3, 4a y 5a: son SDD sin construir. No he podido comprobar `updated_at` o archivado en públicos y canales para «rechazada por cambio».
- `expires_at`, aprobador y el estado «rechazada por cambio» no existen aún: los trae una migración de 5a CA-31.
- Comportamiento real de 4b CA-5, solo leído en el SDD.
- Reglas de acceso en producción y uso real del flujo «Plan GTM».

#### Límites de la revisión

- **Leído íntegro:** el 5d y el PRD.
- **Leído en parte:** de 1a, 1b, 2, 3, 4a, 4b, 5a, 5b y 5c, solo los CA citados por el 5d y las tablas de unidades. No he leído 1b CA-83 ni el cuerpo de 4b salvo CA-5.
- **No leído:** el predecesor archivado, que me pediste no revisar.
- No he ejecutado pruebas ni consultado producción. No hay datos de clientes en este informe.

**Respuesta del autor (v3, 2026-10-31).** Fede eligió «Corregir y aprobar»: se aplican las ocho recomendaciones, sin tercera pasada. Cambios por punto:

- **Bloqueante (entrevista frente a CA-2):** CA-2 distingue lo que la persona dice (origen persona, clientes y MRR permitidos) de lo que el agente deduce (origen IA, «Supuesto» o «Deducido», sin clientes ni MRR); CA-6 guarda la entrevista con esa distinción y dice qué pasa a un rol sin la herramienta; §8 recoge los casos.
- **Menor 1 (CA-28 y CA-9):** los recuerdos no se envían al modelo; solo campos estructurados; el texto libre de los bloques queda como riesgo residual en el §14.
- **Menor 2 (CA-14 y CA-27):** editar deja de marcar «Supuesto»; el §10 fija la lista cerrada de campos marcables y que meta y umbral son datos de plan (R-1); el motivo solo cita datos de los bloques o mediciones.
- **Menor 3:** las tareas nacen sin fecha límite ni hora (CA-8); sin eventos de calendario por aprobar.
- **Menor 4 (CA-20 y CA-23):** definidos «objetivo vivo», trimestre natural en la zona horaria de la organización y objetivo sin fechas como solapado; la persona elige los tipos (máximo tres); una generación a la vez por organización; CA-23 usa el mismo solape; «cobrar» pasa a «gastar IA».
- **Menor 5:** el público nuevo se resuelve por nombre al aprobar (CA-18); el deshacer solo archiva lo que ningún otro objetivo usa (CA-24); el §10 define «cambio» y excluye los valores medidos y confirmar un «Supuesto».
- **Menor 6:** CA-17 ofrece copia a un bloque nuevo desde «fallida», «caducada» y «rechazada por cambio», sin nuevo gasto; un bloque congelado no admite edición ni aprobación (CA-19).
- **Menor 7:** CA-26 cita 5c CA-7 y se declara excepción a 5b CA-16 y 5c CA-7; el PRD §6.1 lo recoge.
- **Menor 8:** §8 corrige la remisión del deshacer (CA-24) y el ejemplo de CA-17.
- **Menor 9:** CA-6 deja `create_account` ofrecida y el §14 declara que las otras cuatro herramientas siguen fuera de la entrevista.
- **Menor 10:** CA-2 rechaza por cambio una propuesta sobre un dato que una persona ya escribió y aplica la capacidad solo con el Owner; el §14 declara que los datos de contexto no tienen auditoría ni deshacer.
- **Menor 11:** CA-3 deja la tarea sin iniciativa con 5a CA-26.
- **Menor 12:** CA-5 ya no nombra «Generar plan»; CA-5 y CA-7 usan «denegar al llamar» para el servidor; CA-20 pasa a U-2 y CA-21 a U-1 (se elimina U-4); U-1 depende de 5c U-1 y U-2 y U-3 de 5b U-2; la cabecera y el PRD §8 lo reflejan.
- **Menor 13:** U-2 depende de 4a U-3, U-4 y U-8; U-5 queda opcional.
- **Menor 14:** CA-10 quita el valor actual, asigna la fuente del resultado clave y fija el valor de hoy para objetivos futuros.
- **Menor 15:** CA-4 queda como comportamiento; retirar el doble de las pruebas de 5a y 1a pasa al §13.
- **Menor 16:** citas corregidas en CA-9, CA-11 y CA-16; CA-29 añade no valorar perfiles.
- **Menor 17:** CA-27 cubre también la cobertura que depende de datos «Supuesto» o «Deducido» y los públicos en Hipótesis, como decía el §14.
- **Menor 18:** §14 completo; §4 mide aprobados, descartados y caducados; §5 cita CA-21; títulos del §17 en `####`; `TITLES` y `manifest.json` en el §13.
- **Preguntas 1 a 8:** aplicadas como en el §3; el tope de elementos por bloque sigue abierto hasta la prueba de tamaño (§15).
- **Riesgos declarados al aprobar:** sin tercera pasada; el tope de elementos y el estimador de coste no existen; el texto libre de los bloques puede llevar nombres; los datos de contexto no tienen deshacer; la configuración anterior sigue en el chat, Telegram y el servidor; aprobar hipótesis cubre bloques con aviso; la atomicidad y el deshacer que archiva hay que construirlos.
- **Comprobación mecánica:** 29 CA únicos, cada uno en una sola unidad (U-1: 8, U-2: 9, U-3: 12), pruebas del §7 y del §12 coinciden y las remisiones del §8 existen.

**Segunda pasada del gate, informe paralelo (2026-10-31, sobre la v2; lanzado desde otra sesión a la vez que el anterior).** Informe copiado sin editar.

**Veredicto:** Bloqueado

Las correcciones de la v2 se aplicaron y casi todas cumplen lo que dicen. Quedan dos contradicciones con reglas aprobadas (tareas del agente y aprobación en el check-in), tres huecos de ciclo de vida o de datos y dos dependencias mal declaradas en el §12. Cada punto se arregla con una o dos líneas.

Lo que comprobé y está bien:
- Hay 29 CA y cada uno está en una sola unidad.
- Las pruebas del §7 coinciden con las del §12.
- Las ocho decisiones del §3 coinciden con el PRD (L147 a L150).
- La cabecera y el archivo SUPERADO están al día.

**Bloqueantes**

1. **El agente no puede proponer crear tareas como propuesta pendiente** (CA-3, L71; §10, L148, `propose_task_change`).
   - **Qué falla:** CA-3 guarda «crear o cambiar … tareas» como propuesta pendiente. Pero PRD R-3, SDD 5a CA-20 y CA-26 y SDD 1b CA-78 dicen otra cosa: el agente crea las tareas directamente como «Sin asignar», sin ninguna propuesta que aprobar.
   - **Además:** 5a CA-24 no incluye las tareas en el deshacer, así que CA-4 no puede aplicarles el deshacer de 24 horas.
   - **Cómo resolverlo:** en CA-3, crear una tarea sigue 5a CA-26 y `propose_task_change` solo cambia tareas que ya existen. Hay que decir que el deshacer no cubre las tareas, o preguntárselo a Fede.

2. **«Elementos en estado Borrador» no existe salvo para el objetivo** (CA-16, L91).
   - **Qué falla:** solo el objetivo tiene el estado Borrador (1a CA-11). Las tareas tienen Pendiente, En curso, Hecha o Bloqueada (1b CA-31). Los resultados clave, las iniciativas, las puertas y los públicos no tienen estado de borrador.
   - **Efecto:** las tareas de un bloque aprobado llevan ejecutor y fecha límite. Por eso entran ya en los resúmenes y avisos (1b CA-84; 5b) y en las horas planificadas (1b CA-37), aunque el objetivo siga en Borrador.
   - **Cómo resolverlo:** que CA-16 diga que solo el objetivo nace en Borrador, y que una regla fije qué pasa hasta la activación con las tareas de un objetivo en Borrador (ver pregunta 1).

3. **CA-9 y CA-28 se contradicen** (L79 y L85).
   - **Qué falla:** CA-9 envía al modelo los bloques de contexto y los recuerdos de empresa, que son texto libre y pueden llevar nombres de cuentas o de personas. 5a CA-19 y su §5 dicen que no hay detección automática de nombres. Pero CA-28 exige enviar «solo datos agregados, cargos y roles». No se pueden cumplir los dos, y CA-28 no se puede probar tal como está.
   - **Cómo resolverlo:** que CA-28 enumere qué entra al modelo (bloques, recuerdos de empresa y agregados) y que se filtre de forma determinista contra los nombres de cuentas y contactos de la organización que hay en la base de datos. La prueba usa esa lista.

4. **Aprobar puede valer como confirmar, por la vía de los públicos** (CA-3 y CA-18; SDD 2 CA-28).
   - **Qué falla:** `propose_audience_change` no limita el nivel de evidencia. Un público propuesto como «Verificado» y aprobado de un clic cuenta como Confirmado (SDD 2 CA-28). Eso rompe la regla «aprobar no confirma» de CA-2 y CA-27.
   - **Además:** los públicos en Hipótesis que crea un bloque cubren por sí solos «Clientes y evidencia» (SDD 2 CA-28). El riesgo del §14 (L193) solo habla de los datos de contexto.
   - **Cómo resolverlo:** que CA-3 limite las propuestas de públicos a Hipótesis o Falta, nunca Verificado, y que el riesgo del §14 incluya los públicos del plan.

5. **CA-26 cambia SDD aprobados y los cita mal** (L98).
   - **Qué falla:** SDD 5b CA-16 permite aprobar cualquier propuesta en el check-in, y 5c CA-7 da a Telegram las mismas reglas que el panel. 5c CA-8 no dice «solo enlazar o descartar»: trata del rechazo cuando la organización no es la activa de la app.
   - **Qué falta:** las otras superficies donde una propuesta se puede aprobar, que son Sugerencias (5a CA-32; 5c CA-14) y la tarjeta del panel.
   - **Cómo resolverlo:** declarar CA-26 como excepción a 5b CA-16 y a 5c CA-7, nombrar Sugerencias y el panel, y registrar la enmienda en «Coordinar con» y en la fila 5d del PRD.

6. **Dependencia hacia adelante de CA-22** (U-2 en el §12).
   - **Qué falla:** CA-22 genera el documento «a partir de los objetivos creados por bloques aprobados». Para probarlo hace falta U-3, que depende de U-2.
   - **Cómo resolverlo:** mover CA-22 a U-3 o a U-4.

7. **U-2 depende de una unidad diferida** (cabecera y §12, «SDD 4a U-3 a U-5»).
   - **Qué falla:** 4a U-5 está diferida hasta que exista el SDD-8. El propio §14 (L198) dice que hasta entonces el plan propone «Sin dato».
   - **Cómo resolverlo:** que U-2 dependa de 4a U-3 y U-4, y que U-5 sea opcional o posterior.

**Cambios menores**

- **CA-15, condición de «aprobable» incompleta (L90):** solo incluye 1a CA-18 y 1b CA-42, más el valor inicial, la meta y el ejecutor. Faltan:
  - 1a CA-17: unidad y fecha meta no posterior al fin del objetivo, que es el ejemplo exacto de la primera pasada y sigue acabando en «fallida»;
  - 1a CA-9: fechas o evento y duración del objetivo;
  - 1b CA-30: canal y al menos un resultado clave por iniciativa;
  - 1b CA-31: fecha límite de cada tarea.
- **CA-14 frente a CA-27:** un campo que edita una persona queda «escrito por persona», pero ¿sigue siendo «Supuesto»? Lo mismo vale para el valor inicial que CA-15 obliga a escribir (¿cuenta como «Manual», 1a CA-19?). Sin esta definición, el aviso al activar de CA-27 salta también por cifras que tecleó el propio Owner.
- **CA-8:** no exige un tipo distinto por bloque ni dice qué tres tipos se eligen en la primera generación, porque CA-20 solo aplica cuando ya hay objetivos. Hoy se pueden generar dos objetivos de ingresos.
- **CA-23:** «mismo tipo y periodo» no está definido; conviene usar la regla de solape de CA-20. Además, un bloque «rechazado por cambio» o caducado pierde sus ediciones sin la copia que CA-17 da a «fallida». Esto será frecuente: basta con que alguien edite un público reutilizado.
- **CA-24:** «algún elemento creado cambió después» no excluye las lecturas automáticas de un resultado clave (4a) ni los cambios de estado calculados. Con eso, el deshacer queda casi siempre negado.
- **CA-6:** «guardar lo que recoja solo con la herramienta de CA-2» choca con la extracción automática de recuerdos de 5a CA-12 en cada turno. Hay que dejar dicho que esa extracción no cambia.
- **CA-7:** cita 5c CA-12 (5c U-2), pero U-1 no declara dependencia de 5c U-1 ni de U-2.
- **CA-29:** cita 1a CA-73 (1a U-0), que no está en las dependencias.
- **CA-12 duplica CA-5** (roles de «Generar plan») en otra unidad.
- **CA-21 repite 5a CA-22 y CA-3** en U-4. Viene del menor 7 de la primera pasada y no se corrigió.
- **CA-9 cita 5a CA-37 para los «recuerdos de empresa»:** CA-37 trata de ocultarlos; el ámbito empresa lo define 5a CA-12.
- **§5 frente a CA-27:** el §5 deja fuera «activar objetivos», pero CA-27 cambia la activación con un aviso. Hay que declararlo en el §6 como «Modificado».
- **§8:**
  - L117 remite el deshacer a CA-19; es CA-24.
  - El ejemplo de L112 («meta igual al valor inicial») ahora lo para CA-15, no CA-17.
  - Faltan casos para CA-29 y para el «sin dato» del coste (CA-11).
- **§14, L192:** a la lista de criterios con varias condiciones le faltan CA-1, CA-5, CA-6, CA-7, CA-11, CA-13, CA-14, CA-17, CA-18, CA-26, CA-27 y CA-28.
- **§13:** no dice que las herramientas nuevas van en `TITLES` y en su copia `.lovable/mcp/manifest.json`, como pide AGENTS.md. Tampoco dice si «Generar plan» se puede pedir desde el servidor para asistentes o desde Telegram, donde no hay un botón junto al que mostrar el coste.
- **CA-20:** «cobrar» es ambiguo. El gasto es de IA con las claves de la propia organización; mejor «gastar».

**Preguntas para Fede**

1. ¿Las tareas de un bloque aprobado quedan fuera de resúmenes, avisos y horas planificadas mientras su objetivo esté en Borrador?
2. Con dos objetivos vivos, ¿«Generar plan» puede proponer dos más y dejar cuatro? ¿O el tope es «tres menos los vivos»?
3. ¿Editar un campo «Supuesto» lo confirma, o la confirmación siempre es una acción aparte?
4. ¿El deshacer de 24 horas cubre las tareas que cambia el agente? (5a CA-24 no las incluye.)

**Hechos de código verificados / no verificados**

Verificados:
- `update_positioning`, `upsert_segment`, `create_icp`, `create_pillar` y `set_quota` están en `src/lib/agent/tools/strategy.ts` (L10 a L58), y `get_setup_status` en `core-read.ts:186`.
- El prompt de la entrevista las cita en `agent.server.ts:46`, junto con `create_account`, que CA-6 no nombra.
- El registro filtra solo por rol: `toolsFor` y `canUseTool` en `tools.ts:32-37`, y el servidor se construye desde `TOOLS` (`mcp/tools/agent-tools.ts:129`).
- `agent_pending_actions` tiene los estados `pending`, `confirmed`, `cancelled` y `failed` (`0007:64`).
- El flujo «Plan GTM» está en `workflows.ts:17` y L30. `requires: ["plan"]` aparece en L31, L32, L34 y L42.
- Existe también el flujo `replan` (L44), que el SDD no menciona.
- Guardar en Drive es un botón manual (`cycle.tsx:240`).
- Las migraciones 0058 y 0059 están «NOT VERIFIED, not applied» (`src/lib/AGENTS.md` L54 y L57).
- Telegram ya existe en código (`notices.server.ts`, `channel-ctx.server.ts`).

No verificados:
- Que exista algún estimador de coste de IA.
- El uso real del flujo Plan GTM.
- Las entidades de 1a, 1b, 2 y 4a, que no existen en código.

**Límites de la revisión**

- Leí entero el 5d. Del PRD leí las decisiones, R-1 a R-10, las metas y el §8.
- De 1a, 1b, 2, 4a, 5a, 5b y 5c leí los CA citados y las tablas de unidades; del SDD 3, solo las unidades.
- No revisé el archivo SUPERADO ni el 4b. No ejecuté pruebas ni consulté producción.
- No hay datos de clientes en este informe ni en el SDD.

**Respuesta del autor (v3, 2026-10-31, al informe paralelo).** Fede eligió «Corregir y aprobar» y las cuatro preguntas se resuelven con la recomendación. Cambios por punto:

- **Bloqueante 1 (tareas del agente):** CA-3 deja la tarea sin iniciativa con 5a CA-26 y `propose_task_change` solo cambia tareas existentes o crea dentro de una iniciativa (§10); CA-4 excluye del deshacer las tareas del agente, como 5a CA-24.
- **Bloqueante 2 («Borrador»):** CA-16 dice que solo el objetivo nace en Borrador y que las tareas del bloque quedan fuera de resúmenes, avisos y horas mientras tanto (enmienda a 1b CA-37 y CA-84).
- **Bloqueante 3 (CA-9 y CA-28):** resuelto por la decisión de no enviar los recuerdos y enviar solo campos estructurados; no hay filtro determinista de nombres y el §14 lo declara.
- **Bloqueante 4 (públicos Verificado):** CA-3 limita las propuestas de públicos a Hipótesis; CA-27 y el §14 cubren los públicos del plan.
- **Bloqueante 5 (CA-26):** nombra Sugerencias, panel y 5a CA-32 como superficies y se declara enmienda a 5b CA-16, 5a CA-32 y 5c CA-7 (§14 y PRD).
- **Bloqueante 6 (CA-22):** pasa a U-3, que ya tiene los bloques aprobados.
- **Bloqueante 7 (U-5 de 4a):** U-2 depende de 4a U-3, U-4 y U-8; U-5 es opcional.
- **Menores:** CA-15 completa las validaciones (1a CA-9, CA-17; 1b CA-30, CA-31) y cuenta como manual el valor que escribo; CA-8 y CA-20 exigen tipos distintos elegidos por la persona; CA-23 y CA-24 usan el solape y la definición de «cambio» del §10; CA-17 copia desde caducada y rechazada; CA-6 deja la extracción de recuerdos como está; U-1 depende de 5c U-1 y U-2; U-2 de 1a U-0; CA-12 limita «Generar plan» a la app; el §5 y el §6 declaran el aviso de CA-27; §8 y §14 completados; `TITLES`, `manifest.json` y `replan` en el §13; «cobrar» pasa a «gastar IA». CA-21 se mantiene como prueba con herramientas reales y CA-12 como regla propia de «Generar plan».
- **Pendiente declarado:** si 1b CA-31 exige fecha límite al crear una tarea, CA-8 y CA-15 se ajustan (§16).
- **Comprobación mecánica:** 29 CA únicos en una sola unidad (U-1: 8, U-2: 9, U-3: 12) y pruebas del §7 y del §12 coinciden.

## 18. Delta de implementación (lo rellena el agente al entregar)
(sin rellenar)
