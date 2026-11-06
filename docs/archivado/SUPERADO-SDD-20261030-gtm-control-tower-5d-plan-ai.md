> **[SUPERADO]** El 2026-10-31 Fede eligió `docs/sdd/SDD-20261030-gtm-control-tower-5d-plan-strategy-tools.md` como SDD 5d vigente. Este archivo se conserva con su primera pasada del gate (§17).

# SDD-20261030-gtm-control-tower-5d-plan-ai · [Feature] Plan con IA y herramientas de estrategia del agente (fase 5d)

**Tipo:** Feature · **Prioridad propuesta:** Alta
**Estado:** Borrador (v1, sin pasada del gate) · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-10-31
**PRD:** `docs/prd/PRD-20261030-gtm-control-tower.md` · **Depende de:** SDD 5a (agente, propuestas y fase por rol: U-1 y U-4), SDD 1a (objetivos, resultados clave, públicos, canales, ratificación y versiones: U-2, U-3, U-4 y U-7), SDD 1b (iniciativas, tareas y puertas: U-5 y U-6), SDD 2 (bloques de contexto: U-2), SDD 3 (diccionario de métricas: U-1), SDD 4a (fuentes automáticas de resultados clave: U-1 y U-2) y los SDD de salida de Lovable A y B para construir · **Coordinar con:** `SDD-20261030-gtm-control-tower-5b-notices-checkin` (el check-in muestra las propuestas del plan) · **Antes:** SDD 5a, 5b y 5c (aprobados)

> Un SDD dice cómo se verifica que está bien hecho. Cada criterio de aceptación (CA-n) debe poder tener una prueba automática que lo nombre.
> Los criterios no nombran tecnología; lo técnico va en el §13 como [Sugerencia — la revisión del gate las valida].
> Las reglas transversales del PRD (§6.2, R-1 a R-10) aplican a todo este SDD. «Organización» es la empresa que usa Nokko; «cuenta» es una empresa prospecto o cliente.
> Este SDD cumple lo que la serie 5 le dejó: las herramientas del agente que proponen cambios de estrategia (5a CA-22 a CA-24 y 1a CA-70 dejan de probarse con un doble: CA-19), la adaptación de la entrevista de configuración a los bloques del SDD 2 (CA-20) y el borrador de plan con IA que 1b dejó a la serie 5.

## 1. Resumen
Da al agente dos capacidades. La primera es **generar un borrador de plan por objetivos** (hasta tres, cada uno con sus resultados clave, públicos, iniciativas, tareas y puertas) que la persona edita y **aprueba objetivo a objetivo**; al aprobar se crean elementos en Borrador, nunca activos ni ratificados. La segunda son **las herramientas para leer los bloques de contexto y proponer cambios de estrategia y de contexto**, siempre como propuestas de 5a. Nada se inventa: los valores iniciales salen de una fuente medida o quedan sin dato, y las metas son hipótesis marcadas «Supuesto».

## 2. Problema y para quién
Hoy el plan se escribe a mano o con el flujo «Plan GTM» del agente actual, que produce un documento de siete secciones sin objetivos, resultados clave, iniciativas ni tareas. Fede y Flor parten de una hoja en blanco para llevar la estrategia a la torre de control. Para Fede (Owner) y Flor (Sales leader).

## 3. Evidencia y por qué ahora
- **Código (repo de Nokko, solo lectura, 2026-10-31):**
  - El flujo «Plan GTM» del agente genera un documento con siete secciones (Objetivos del periodo, Segmentos y motion por ACV, Posicionamiento y mensajes, Canales y fuentes de pipeline, Cuotas y cobertura, Apuestas y experimentos, Fuera de alcance), sin entidades de objetivo (`src/lib/bmad/workflows.ts`).
  - No hay herramientas del agente sobre objetivos, resultados clave, iniciativas, públicos, canales, puertas o decisiones ni sobre los bloques de contexto; las más parecidas (`update_positioning`, `upsert_segment`, `create_icp`, `set_quota`) tocan la configuración anterior (`src/lib/agent/tools/`).
  - La entrevista de configuración usa el medidor antiguo (`get_setup_status`).
- **Decisiones del PRD §6.1 (Fede, 2026-10-29 a 31):** plan con IA como borrador completo editable aprobado por bloques; tres entradas al mismo objeto Objetivo (escribirlo, entrevista guiada, partir de los datos); la falta de bloques cubiertos impide activar objetivos, no crearlos en Borrador; de 1 a 3 objetivos activos con foco; resultado clave con valor inicial, meta y fecha; la IA solo crea elementos internos como propuesta.
- **Decisiones de Fede para este SDD (2026-10-31):** un bloque por objetivo; el borrador no exige los cuatro bloques de contexto cubiertos y marca los huecos como «Supuesto»; aprobar un bloque crea elementos en Borrador; Owner y Sales leader generan y aprueban, el Owner ratifica; el valor inicial es medido o «Sin dato» y la meta un «Supuesto»; el agente escribe en los bloques de contexto como propuesta pendiente; el coste previo del plan se muestra junto al botón sin confirmación; si ya hay objetivos, el agente genera solo lo que falta y propone cambios sobre lo existente.
- Uso real del flujo «Plan GTM» actual: **sin dato** [Por verificar].

## 4. Resultado buscado
- Fede parte de un borrador y no de una hoja en blanco (G-2 del PRD). Medición: objetivos creados desde un bloque aprobado frente a escritos a mano (CA-11 los marca). Línea base: sin dato.
- Ningún valor numérico inventado llega a un resultado clave (G-10 y R-1). Medición: pruebas de CA-2 y CA-3.

## 5. Alcance
**Incluye:** H-1 a H-4.
**No incluye:**
- Activar o ratificar objetivos (SDD 1a); la guardia de contexto que impide activar sin los bloques cubiertos (SDD 2 CA-5).
- Sembrar los bloques de contexto desde Drive y la importación MD o CSV (SDD 2).
- Las reglas generales de propuestas, aprobación, caducidad, auditoría y deshacer (SDD 5a), que este SDD aplica.
- Mercado, competencia y radar (SDD 6); vista del Consejo y runway (SDD 7).
- Capacidad y horas planificadas: el borrador no asigna horas ni reparte por capacidad (PRD §6.1: capacidad de 10 horas solo de referencia).
- Sincronizar el plan con herramientas externas de tareas.

## 6. Cambios de comportamiento (delta)
**Añadido:** generación del borrador de plan por objetivos; aprobación por bloques; herramientas del agente para leer los bloques de contexto y proponer cambios de contexto y de estrategia; marca «Supuesto» en lo no medido.
**Modificado:** la entrevista de configuración, con la fase activa, usa los cuatro bloques del SDD 2 (CA-20); el flujo «Plan GTM» actual de siete secciones se sustituye, con la fase activa, por el borrador por objetivos.
**Eliminado:** nada se borra (R-7).

## 7. Historias y criterios de aceptación
Cada CA cita el objetivo G-n del PRD que cubre y el archivo de prueba (ruta por decidir en la implementación [Sugerencia]).

### H-1: Como Owner o Sales leader, quiero pedir al agente un borrador de plan por objetivos y editarlo.
- **CA-1** MIENTRAS la fase esté activa para mi rol, CUANDO pido «Generar plan», el sistema DEBE generar un borrador con como máximo tres objetivos, cada uno como un bloque con tipo, fechas (trimestre por defecto, SDD 1a CA-9), resultados clave, públicos, un canal, iniciativas con sus tareas y, si procede, puertas. · cubre G-2 · prueba: `plan-draft.test.ts`
- **CA-2** El sistema DEBE proponer como valor inicial de un resultado clave solo un valor de una fuente medida (SDD 4a, SDD 3) y, SI no la hay, ENTONCES DEBE dejarlo en «Sin dato» sin inventar ninguno; la meta y la fecha meta DEBEN presentarse como hipótesis, nunca como medidas (PRD R-1). · cubre G-2, G-10 · prueba: `plan-draft-values.test.ts`
- **CA-3** El sistema DEBE marcar «Supuesto» cada meta, fecha y público en Hipótesis del borrador, y todo lo que se apoye en un bloque de contexto sin cubrir, y DEBE conservar esa marca hasta que una persona lo confirme. · cubre G-2, G-10 · prueba: `plan-draft-values.test.ts`
- **CA-4** SI algún bloque de contexto no está cubierto, ENTONCES el sistema DEBE generar igualmente el borrador y DEBE avisar de que activar un objetivo exigirá cubrirlos (SDD 2 CA-5). · cubre G-2, G-4 · prueba: `plan-draft.test.ts`
- **CA-5** CUANDO la persona está a punto de generar el plan, el sistema DEBE mostrar su coste previo estimado junto al botón, sin pedir otra confirmación: pulsar es la aprobación (PRD R-2). · cubre G-2, G-10 · prueba: `plan-draft-cost.test.ts`
- **CA-6** El sistema DEBE permitir editar cualquier campo de un bloque antes de aprobarlo y regenerar solo ese bloque, conservando lo que escribió una persona (SDD 2 CA-6). · cubre G-2 · prueba: `plan-draft-edit.test.ts`
- **CA-7** SI la IA falla al generar, ENTONCES el sistema DEBE decir qué pasó y qué hacer (PRD R-8) y DEBE abstenerse de dejar bloques a medias. · cubre G-2 · prueba: `plan-draft.test.ts`
- **CA-8** El sistema DEBE abstenerse de incluir en el borrador nombres de personas o de cuentas procedentes de fichas de conversación o de conversaciones (PRD R-4). · cubre G-10 · prueba: `plan-draft-privacy.test.ts`

### H-2: Como Owner o Sales leader, quiero aprobar el plan objetivo a objetivo.
- **CA-9** El sistema DEBE tratar cada bloque como una propuesta del SDD 5a (estados, caducidad y aprobación solo de quien la pidió: SDD 5a CA-21 y CA-31). · cubre G-10 · prueba: `plan-blocks.test.ts`
- **CA-10** SI un resultado clave de un bloque no tiene valor inicial, ENTONCES el sistema DEBE marcar el bloque «Falta valor inicial» y DEBE impedir aprobarlo hasta que una persona lo escriba (SDD 1a CA-17). · cubre G-2 · prueba: `plan-blocks.test.ts`
- **CA-11** CUANDO apruebo un bloque, el sistema DEBE crear su objetivo en Borrador con sus resultados clave, públicos, iniciativas, tareas y puertas (SDD 1a CA-9 y CA-11), todo o nada, y DEBE marcar que se crearon desde un bloque aprobado. · cubre G-2 · prueba: `plan-blocks.test.ts`
- **CA-12** El sistema DEBE crear las tareas de un bloque aprobado dentro de sus iniciativas (SDD 1b CA-31) con quien aprueba como ejecutor por defecto, editable antes de aprobar, y DEBE abstenerse de dejarlas como «Sin asignar». · cubre G-2 · prueba: `plan-blocks.test.ts`
- **CA-13** El sistema DEBE abstenerse de activar o ratificar un objetivo al aprobar su bloque: la activación y la ratificación siguen siendo pasos aparte (SDD 1a CA-10 y CA-51). · cubre G-3, G-10 · prueba: `plan-blocks.test.ts`
- **CA-14** CUANDO descarto un bloque o caduca, el sistema DEBE abstenerse de crear ningún elemento. · cubre G-2 · prueba: `plan-blocks.test.ts`

### H-3: Como Owner o Sales leader, quiero que el agente complete el plan sin pisar lo que ya existe.
- **CA-15** SI ya existen objetivos, ENTONCES «Generar plan» DEBE generar bloques solo para lo que no existe y DEBE proponer los cambios sobre lo existente como propuestas del SDD 5a, sin reemplazar nada en bloque. · cubre G-2 · prueba: `plan-existing.test.ts`
- **CA-16** CUANDO una propuesta cambia un objetivo o una decisión ratificados, el sistema DEBE aplicarla como versión «Modificado tras ratificación» (SDD 5a CA-22; SDD 1a CA-52). · cubre G-3, G-10 · prueba: `plan-existing.test.ts`

### H-4: Como Owner o Sales leader, quiero que el agente pueda leer mi contexto y proponer cambios de estrategia.
- **CA-17** El sistema DEBE permitir al agente leer los cuatro bloques de contexto del SDD 2 (negocio y etapa; capacidad y restricciones; clientes y evidencia; activos y alternativas) sin coste. · cubre G-4 · prueba: `context-tools.test.ts`
- **CA-18** El sistema DEBE permitir al agente proponer escribir datos de los bloques de contexto como propuesta pendiente del SDD 5a, con nivel Supuesto o Deducido y origen IA, y DEBE abstenerse de pisar un dato escrito por una persona (SDD 2 CA-2 y CA-6). · cubre G-4, G-10 · prueba: `context-tools.test.ts`
- **CA-19** El sistema DEBE permitir al agente proponer cambios sobre objetivos, resultados clave, iniciativas, públicos, canales, puertas y decisiones, solo como propuestas del SDD 5a con sus reglas de aprobación, auditoría y deshacer de 24 horas (SDD 5a CA-21, CA-23 y CA-24; SDD 1a CA-70). · cubre G-3, G-10 · prueba: `strategy-tools.test.ts`
- **CA-20** MIENTRAS la fase esté activa para mi rol, el sistema DEBE hacer que el modo entrevista de configuración use los cuatro bloques de contexto en lugar del medidor antiguo. · cubre G-4 · prueba: `context-tools.test.ts`
- **CA-21** El sistema DEBE denegar al Consejo y a los roles distintos de Owner y Sales leader el plan y las herramientas de este SDD (SDD 1a CA-3; SDD 5a CA-36). · cubre G-10 · prueba: `plan-phase-guard.test.ts`
- **CA-22** MIENTRAS la fase no esté activa para mi rol, el sistema DEBE mantener sin cambios el flujo «Plan GTM» y el modo entrevista actuales (PRD R-9). · cubre G-10 · prueba: `plan-phase-guard.test.ts`
- **CA-23** El sistema DEBE separar los borradores, los bloques y los elementos creados por organización: una organización NO DEBE ver ni usar los de otra (PRD R-10). · cubre G-10 · prueba: `org-isolation.test.ts`

## 8. Casos límite y errores
Cada caso remite al CA que lo cubre.
- Bloques de contexto sin cubrir → se genera igual, con «Supuesto» y aviso (CA-4, CA-3).
- Resultado clave sin fuente medida → «Sin dato» y bloque no aprobable hasta escribir el valor (CA-2, CA-10).
- Meta y fecha propuestas por la IA → siempre «Supuesto» (CA-2, CA-3).
- La IA falla al generar → qué pasó y qué hacer, sin bloques a medias (CA-7).
- Editar un campo antes de aprobar y regenerar el bloque → se conserva lo escrito (CA-6).
- Aprobar un bloque → objetivo en Borrador con todo lo suyo, o nada (CA-11).
- Aprobar un bloque no activa ni ratifica (CA-13).
- Descartar o dejar caducar un bloque → sin elementos (CA-14, CA-9).
- Otra persona intenta aprobar mi bloque → denegado (CA-9).
- Ya hay objetivos → solo bloques nuevos y propuestas de cambio (CA-15).
- Cambio sobre un objetivo ratificado → versión «Modificado tras ratificación» (CA-16).
- El agente intenta pisar un dato de contexto escrito por una persona → no se pisa (CA-18).
- Consejo u otros roles piden el plan → denegado (CA-21).
- Rol sin la fase → flujo «Plan GTM» actual sin cambios (CA-22).
- Persona en dos organizaciones → borradores y bloques independientes (CA-23).
- Texto del borrador con nombres de cuentas o personas → no se incluye (CA-8).

## 9. Experiencia y copy
Sistema visual actual (Ink + Lima, versalitas con filete, sin iconos), textos en «tú».
- **Mensajes sugeridos** (a validar con la guía de voz de marca): «He preparado un borrador de plan. Nada cambia hasta que apruebes cada objetivo.» · «Esta meta es una hipótesis. Confírmala o cámbiala antes de activar el objetivo.» · «Falta el valor inicial de un resultado clave. Escríbelo para poder aprobar este objetivo.»
- **Pantallas:** botón «Generar plan» con su coste previo (CA-5) en Plan y en el panel del agente; borrador con un bloque por objetivo y sus campos editables con la marca «Supuesto» (CA-1, CA-3, CA-6); aprobar, regenerar o descartar por bloque (CA-9, CA-11, CA-14).

## 10. Datos, permisos y privacidad
- **Conceptos nuevos:** bloque de plan (propuesta con su contenido hasta que se aprueba), marca de origen «desde un bloque aprobado» en los elementos creados y marca «Supuesto» por dato.
- **Acceso:** las estructuras nuevas llevan organización por defecto la actual, acceso filtrado por organización y permisos explícitos; el contenido de los bloques de contexto no lo ve el Consejo (SDD 2 CA-27) [Sugerencia — el gate valida].
- **Matriz de permisos:**

| Acción | Owner | Sales leader | Consejo | Otros roles |
|---|---|---|---|---|
| Generar plan y aprobar sus bloques | Sí | Sí | No | No |
| Ratificar lo creado | Sí | No | No | No |
| Leer los bloques de contexto con las herramientas del agente | Sí | Sí | No | No |

- **Privacidad:** el borrador no incluye nombres de personas ni de cuentas de fichas o conversaciones; el contenido de los bloques de contexto no lo ve el Consejo; ningún dato de clientes en pruebas ni ejemplos.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| Generar el borrador de plan | Claves propias primero y, si fallan antes de actuar, la siguiente (cadena actual de proveedores) | El del agente; esfuerzo por decidir en el brief | Sí, junto al botón (CA-5) |
| Regenerar un bloque | La misma cadena | El del agente | Sí, junto al botón (CA-5) |
| Propuestas de cambio y de contexto | El turno del agente de 5a | El del agente | No (conversación) |

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero [Sugerencia] | Depende de |
|---|---|---|---|---|
| U-1 | Herramientas del agente para leer los bloques de contexto, proponer escribir en ellos y entrevista con los cuatro bloques | CA-17, CA-18, CA-20 | `context-tools.test.ts` | SDD 5a U-1 y U-4, SDD 2 U-2 |
| U-2 | Herramientas del agente para proponer cambios de estrategia | CA-19 | `strategy-tools.test.ts` | SDD 5a U-4, SDD 1a U-2, U-3, U-4 y U-7, SDD 1b U-5 y U-6 |
| U-3 | Generación del borrador de plan: objetivos, valores, marcas «Supuesto», coste previo, edición y regeneración | CA-1 a CA-8 | `plan-draft.test.ts`, `plan-draft-values.test.ts`, `plan-draft-cost.test.ts`, `plan-draft-edit.test.ts`, `plan-draft-privacy.test.ts` | U-1, U-2, SDD 3 U-1, SDD 4a U-1 |
| U-4 | Aprobación por bloques, plan sobre lo existente, roles, guardia de fase y aislamiento | CA-9 a CA-16, CA-21, CA-22, CA-23 | `plan-blocks.test.ts`, `plan-existing.test.ts`, `plan-phase-guard.test.ts`, `org-isolation.test.ts` | U-2, U-3, SDD 5a U-4 y U-5 |

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- **Bloques como propuestas:** cada bloque de plan puede guardarse como una acción pendiente del SDD 5a con su contenido completo; los estados de 5a CA-31 funcionan, salvo «rechazada por cambio», que no tiene un elemento previo que comparar en una creación [Por verificar con el gate].
- **Herramientas:** hoy no hay herramientas de objetivos, resultados clave, iniciativas, públicos, canales, puertas, decisiones ni bloques de contexto; U-1 y U-2 las crean como escrituras que dejan una acción pendiente (`src/lib/agent/tools/`, `src/lib/agent/tool-kit.ts`).
- **Entrevista:** `get_setup_status` y el modo `interview` (`src/lib/agent/agent.server.ts`) pasan a los bloques del SDD 2 con la fase activa; sin la fase se conservan.
- **Valores iniciales:** salen de las fuentes medidas que definen el SDD 3 (diccionario) y el SDD 4a (lecturas automáticas); sin fuente conectada, «Sin dato».
- **Coste previo:** la estimación puede basarse en el tamaño del contexto enviado y el modelo elegido [Sugerencia].
- Migraciones aditivas con organización por defecto.

## 14. Riesgos y dependencias
- Depende de 5a (propuestas y fase), de 1a y 1b (entidades de objetivos, iniciativas, tareas y puertas) y del SDD 2 (bloques de contexto); sin ellos no hay a dónde escribir.
- **Metas inventadas por un modelo:** CA-2 y CA-3 mantienen la marca «Supuesto», pero un modelo puede proponer una meta que parece medida; la persona debe confirmarla antes de activar.
- **«Falta valor inicial» puede bloquear mucho:** hasta que 4a conecte las fuentes, casi ningún resultado clave tendrá valor inicial medido, y la persona tendrá que escribirlo a mano (CA-10).
- **Coste del plan con IA:** la estimación previa puede quedar por debajo del coste real si el borrador se regenera varias veces (CA-5, CA-6).
- **Dos fuentes de plan:** con la fase activa el flujo «Plan GTM» de siete secciones deja de ser la vía; los documentos ya creados se conservan (R-7).
- **Hasta que 5d se entregue**, el deshacer de 24 horas y la auditoría de cambios del agente de 5a y 1a CA-70 se prueban con un doble (CA-19 los sustituye).

## 15. Preguntas para Fede y para la revisión técnica
- Resuelto por Fede (2026-10-31): lo indicado en el §3.
- Revisión técnica: ¿cómo se guarda un bloque de plan antes de aprobarlo y cómo se detecta «rechazada por cambio» en una creación? (§13)
- Revisión técnica: ¿cómo se estima el coste previo de generar el plan?

## 16. Pendiente de verificar
- Uso real del flujo «Plan GTM» actual → datos de producción.
- Estados de un bloque de plan frente a 5a CA-31 → gate.
- Fuentes medidas disponibles para valores iniciales hasta que 4a conecte Stripe y producto → SDD 4a.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
### Primera pasada (sobre v1) — informe verbatim

**Veredicto:** Bloqueado. Hay cinco bloqueantes y cada uno se resuelve con una o dos líneas. Las citas cruzadas son correctas y la parte mecánica (CAs, unidades, pruebas) cuadra. Lo que falla es el comportamiento sin guardia de fase, el ciclo de vida de los bloques y el modelo de la marca «Supuesto».

Archivo revisado: `/Users/fedecosentino/NOKKO GTM BRAIN/seller-strategy-studio/docs/sdd/SDD-20261030-gtm-control-tower-5d-plan-ai.md` (aquí, «5d»).

## Bloqueantes

1. **«Sustituye el flujo Plan GTM» no tiene CA y choca con 5a** (5d L43 y L145; 5a CA-2 en L60 y CA-6).
   - 5a CA-2 hace que el agente elija el modo «entre los flujos actuales agrupados por fase», y el plan es una de esas fases. 5d CA-22 solo protege el caso sin fase.
   - En `src/lib/bmad/workflows.ts`, `validate_plan` (L31), `architecture` (L32), `readiness` (L34) y `account_breakdown` (L42) declaran `requires: ["plan"]`. `missingPrereqs` (L63) y `drafting.ts:66` lo usan; por lo que vi, hoy solo añade un aviso al prompt, no bloquea.
   - Resolución: quita «sustituye» y declara que el borrador por objetivos convive con el flujo (la opción que recomiendo). Si no, añade un CA que diga qué ofrece el modo Plan con la fase activa y de dónde leen los flujos que requieren plan (pregunta 1).

2. **CA-17, CA-18 y CA-19 no llevan guardia de fase** (L72-74), y R-9 lo exige.
   - Los dos tipos de herramienta nuevas (leer bloques y proponer cambios de estrategia) se generan desde el registro del agente. `src/lib/mcp/tools/agent-tools.ts` construye de él el servidor para asistentes, y `AGENTS.md` dice que Telegram usa el mismo `runAgent`. Sin guardia, esas herramientas aparecerían sin la fase, contra 5a CA-6, 5c CA-5 y CA-13.
   - CA-22 solo cubre el flujo Plan GTM y la entrevista.
   - Resolución: añade «MIENTRAS la fase esté activa para mi rol» a CA-17, CA-18 y CA-19, y amplía CA-22 con «y no ofrece estas herramientas, tampoco por el servidor ni por Telegram».
   - CA-6 (regenerar, con coste) tampoco tiene guardia.

3. **El ciclo de vida de los bloques sigue sin resolver** (CA-9, §13 L133, §15 L150, §16 L155). Ninguna prueba puede fijar el conjunto de estados con lo que hay.
   - **«Rechazada por cambio» en una creación** no está definida. Propongo que se evalúe al aprobar y signifique: un público, canal o fuente de resultado clave referenciado se modificó o archivó tras la fecha del bloque, o apareció un objetivo no archivado del mismo tipo y periodo. Fuera de eso, nunca ocurre.
   - **Editar o regenerar (CA-6) muta una propuesta pendiente**, y 5a CA-31 no lo prevé. Falta decir si reinicia los 7 días, si cambia la «fecha de la propuesta» (que 5a usa para detectar cambios), si el bloque regenerado sustituye al anterior (que pasaría a «descartada») y qué pasa con lo editado si el bloque caduca o falla.
   - **Duplicados y concurrencia:**
     - Dos generaciones (Fede y Flor, o dos pulsaciones) dejan dos juegos pendientes del mismo objetivo. Aprobar ambos duplica objetivo y públicos, aunque 1a CA-26 pide no duplicar un público.
     - La atomicidad de CA-11 y la doble aprobación no se prueban. 5a CA-31 impide aplicar lo que no está pendiente, pero 5d no exige una transacción única. El repo ya usa RPC para esto (`apply_account_assignment`, `create_organization`).
   - **Organización:** `AGENTS.md` dice que `org_id` toma por defecto `current_org()`. Aprobar un bloque tras cambiar de empresa en la app podría crear todo en la organización equivocada. Añade un CA como el de 5c CA-14: se ejecuta en la organización del bloque.

4. **CA-15 no se puede probar:** «lo que no existe» no define la unidad (L68).
   - No dice qué cuenta como existente: ¿tipo de objetivo? ¿periodo? ¿objetivos Cerrados o Archivados? ¿bloques pendientes?
   - Tampoco dice qué hace «Generar plan» con tres objetivos ya activos frente al máximo de tres de CA-1.
   - Resolución: «un bloque por cada tipo de objetivo sin objetivo vivo (Borrador, Activo o Pausado) ni bloque pendiente en el periodo; máximo tres en total; si no falta nada, lo dice y no genera».

5. **La marca «Supuesto» (CA-3, CA-14) no tiene modelo ni acción de confirmar** (L52, L101).
   - Hay tres vocabularios: público Verificado/Hipótesis/Falta (1a CA-25), dato Confirmado/Deducido/Supuesto/Falta (SDD 2 CA-2) y el «Supuesto» de 5d.
   - «Público en Hipótesis del borrador» es ambiguo.
   - La marca debe pasar al objetivo y a los resultados clave creados en Borrador. 1a CA-17 y CA-19 no tienen campo para ella.
   - «Hasta que una persona lo confirme» no define la acción de confirmar. ¿Aprobar el bloque cuenta?
   - El copy de L101 («Confírmala o cámbiala antes de activar el objetivo») promete un control que ningún CA impone, porque 1a CA-10 solo exige un público y un resultado clave.
   - Resolución:
     - aprobar un bloque no confirma;
     - confirmar es una acción explícita de Owner o Sales leader por campo;
     - los públicos creados nacen en Hipótesis y nunca en Verificado (Supuesto equivale a Hipótesis, SDD 2 CA-28);
     - decide si la activación se bloquea o solo avisa (pregunta 2).

## Cambios menores

1. **CA-8 (L57) no se puede probar de forma determinista.**
   - 5a §5 excluye la detección automática de nombres.
   - «Conversaciones» es ambiguo: fichas del SDD 3 o conversaciones privadas del agente (5a CA-7).
   - Reescríbelo como regla de entrada (no enviar al modelo el texto de las fichas, solo agregados).
   - Ampliarlo a nombres de clientes del bloque «Clientes y evidencia». El Consejo ve títulos de iniciativas (1b CA-88) y textos de puertas, y 1b CA-90 solo avisa.
2. **CA-19 es demasiado abierto.**
   - No enumera herramientas. 5a puso su lista normativa en el §10, y 5c CA-1 y el manifiesto MCP (`TITLES`) dependen de los nombres.
   - No excluye ratificar (1a CA-51), confirmar puertas (1b CA-45) ni activar, pausar o cerrar (1a CA-11; §5 L34 los excluye).
   - No dice qué hace con objetivos Archivados (solo lectura) ni con tareas, que CA-15 menciona.
   - Aplica «nada se inventa» solo al borrador: faltan el valor actual de un resultado clave (1a CA-19), el coste de canal (SDD 3 CA-1) y el umbral de una puerta.
   - La cabecera (L10) dice que CA-19 sustituye 5a CA-22 a CA-24, pero CA-19 cita solo CA-21, CA-23 y CA-24.
3. **CA-18 omite tres restricciones.**
   - SDD 2 CA-14: clientes y MRR solo vienen de una persona, la fuente de cobro o la base de datos.
   - SDD 2 CA-7 y 1b CA-36: la capacidad de otra persona solo la edita el Owner.
   - Qué pasa al aprobar: ¿cuenta como «escrito por persona» (SDD 2 CA-6)?
   - «Abstenerse de pisar» es ambiguo; 5a CA-31 («rechazada por cambio») ya lo resuelve si lo citas.
   - Riesgo no declarado en §14: hipótesis aprobadas de un clic cubren bloques y desbloquean activar (SDD 2 CA-3 y CA-5).
4. **CA-20 no dice qué escribe la entrevista.** `agent.server.ts:44-47` guarda con `update_positioning`, `create_icp`, `upsert_segment`, `create_pillar`, `set_quota` y `create_account`. Si solo cambia el medidor, preguntará por datos de bloques y escribirá en la configuración antigua, y los bloques nunca se cubrirán. Con la fase activa, que guarde solo por CA-18 (1a CA-7 mantiene la configuración antigua para los demás) (pregunta 6).
5. **CA-1 y CA-11 (L50, L62) no concuerdan con 1a y 1b.**
   - «Un canal» por bloque choca con 1b CA-30: el canal y el vínculo a resultados clave son por iniciativa.
   - CA-11 no menciona esos vínculos ni las validaciones de 1a CA-18 (meta distinta del valor inicial, fecha meta dentro del objetivo) y 1b CA-42 (criterios de puerta).
   - Convierte esas validaciones en condición de «aprobable», como CA-10. Si no, el «todo o nada» acabaría en «fallida».
6. **CA-2 (L51).**
   - «Fuente medida» no está definida. ¿Cuenta la entrada manual de Activa o Publicó? ¿Y «Sin dato reciente» (R-6)? ¿Sirve el valor de hoy si el objetivo arranca en el futuro?
   - Dependencia: la cabecera cita 4a U-1 y U-2, y el §12 U-3 solo 4a U-1. Las fuentes reales son 4a U-3, U-4 y U-5; U-2 aporta solo una fuente de prueba.
7. **CA-3 (L52)** marca meta, fecha y público, pero no los umbrales ni la fecha de evaluación de las puertas, ni el canal. Son números inventados por el modelo.
8. **CA-12 (L63) usa mal «Sin asignar».** En 1b CA-78 y 5a CA-26 significa «sin iniciativa», y las tareas de un bloque ya tienen iniciativa. Reescríbelo como «con ejecutor persona (1b CA-31), el aprobador por defecto».
9. **CA-11 no declara auditoría ni deshacer.**
   - Debe exigir auditoría con origen «agente» y aprobador (1a CA-68, 5a CA-23).
   - Debe exigir deshacer 24 h archivando lo creado (5a CA-24, 1a CA-70). Es el caso principal de 5a CA-24 y no tiene prueba.
   - Falta decir dónde se ve un bloque pedido desde el botón, sin conversación (5a CA-32).
10. **Coste (CA-5, CA-6, §11).**
    - §11 L121 dice que regenerar muestra coste, pero CA-5 solo cubre «Generar plan».
    - CA-5 no tiene el «sin dato» de 4a CA-14 si no se puede estimar.
    - No encontré en `src` una tabla de precios de modelo; el orquestador solo registra gasto estimado de servicios (`orchestrator/runner.ts`).
    - «Pulsar es la aprobación» viene de PRD §6.1 L122, no de R-2.
    - No se dice si el gasto de IA entra en la vista de gasto (4a CA-16).
11. **CA-6 cita SDD 2 CA-6, que habla de datos de contexto**, no de campos de un bloque. Tampoco dice si un bloque congelado (5a CA-34) se puede editar o regenerar.
12. **Casos límite sin CA ni §8.**
    - Fase desactivada con bloques pendientes. 5a CA-34 se hereda, pero no se prueba.
    - Cambio de rol.
    - Regeneración sin tope (§14 L144 lo admite).
    - Tope de iniciativas o tareas por bloque.
    - Fallo parcial: CA-7 no dice si es todo el borrador o por bloque. Sugerencia: validar con esquema estricto, patrón que ya usa el asesor.
    - Aprobar desde el check-in (5b CA-16) un bloque con «Falta valor inicial».
    - Aprobar desde Telegram.
13. **R-5.** Nada impide que el plan proponga iniciativas o tareas basadas en extraer o automatizar LinkedIn (1a CA-73). Es una regla de instrucción: decláralo.
14. **Matriz L113 frente a SDD 2 CA-7 y 5a CA-36.** Otros roles pueden consultar los bloques en la pantalla y su agente recibe «las herramientas que su rol permite». La matriz dice «No» (pregunta 4).
15. **§14.** Falta el punto «criterios con varias obligaciones» que sí tienen 5a y 5b: CA-1, CA-3, CA-6, CA-9, CA-11, CA-16, CA-19 y CA-21.
16. **Trazabilidad.**
    - La fila 5d del PRD §8 dice «depende de 1a, 1b y 5a» y «cubre G-2, G-3 y G-7». 5d depende también de 2, 3 y 4a, y ningún CA cita G-7 (usa G-4 y G-10).
    - U-4 debería declarar 5a U-2, que crea `org-isolation.test.ts`.
    - U-3 depende de U-2 sin usar herramientas.
    - CA-4 necesita SDD 2 U-7, y la cabecera solo cita U-2.
    - §4 L29 («ningún valor numérico inventado llega a un resultado clave») choca con CA-2 y CA-3, que dejan a la IA proponer metas. Dilo solo del valor inicial.
17. **El tope de tres objetivos del borrador** no es una decisión citada. El PRD fija 1 a 3 objetivos activos.

## Preguntas para Fede

1. ¿El flujo «Plan GTM» de siete secciones convive con el borrador por objetivos (recomiendo) o se retira con la fase? Si se retira, ¿los flujos que requieren plan leen los objetivos activos?
2. Antes de activar un objetivo, ¿hay que confirmar sus supuestos (bloquear), o solo se avisa? Recomiendo avisar.
3. ¿Puede la IA proponer una meta numérica sin base en un dato del contexto (marcada Supuesto), o debe dejarla vacía y no aprobable, como el valor inicial?
4. Con la fase activa para otros roles, ¿su agente puede leer los bloques de contexto? SDD 2 CA-7 les deja consultarlos.
5. El ejecutor por defecto de las tareas de un bloque, ¿es quien aprueba? 1b CA-31 exige una persona. PRD G-2 (L39) habla de «Sin asignar» para lo que crea el agente.
6. Con la fase activa, ¿la entrevista guarda solo en los bloques y deja de ofrecer las herramientas de configuración antigua?
7. El tope de tres, ¿es del borrador o solo de objetivos activos?

## Hechos de código verificados / no verificados

**Verificados**
- **Flujo Plan GTM:** las siete secciones están en `workflows.ts:17`. `requires: ["plan"]` está en L31, L32, L34 y L42; `missingPrereqs` en L63, usado en `bmad/drafting.ts:66`.
- **Herramientas:** el registro (`src/lib/agent/tools/*`, 108 herramientas) no tiene ninguna sobre objetivos, resultados clave, iniciativas, públicos, canales, puertas, decisiones ni bloques de contexto. Existen `update_positioning`, `upsert_segment`, `create_icp` y `set_quota`.
- **Entrevista:** `get_setup_status` está en `core-read.ts:186`. El modo `interview` está en `agent.server.ts:18` y L41-47, y usa las herramientas de configuración antigua.
- **Servidor para asistentes:** `src/lib/mcp/tools/agent-tools.ts` genera las herramientas desde el registro. `TITLES` está en L13 y existe `.lovable/mcp/manifest.json`.
- **Acciones pendientes:** `agent_pending_actions` (`drizzle/migrations/0007:56-68`, más `source` en 0011) tiene estados pending, confirmed, cancelled y failed. No tiene caducidad ni quién aprobó. `conversation_id` admite nulo, pero con borrado en cascada. Las migraciones están en `drizzle/migrations`.
- **Aislamiento por organización:** `AGENTS.md` confirma `org_id` por defecto `current_org()` y las operaciones atómicas por RPC.
- **Citas cruzadas:**
  - 5a: CA-21, CA-22, CA-23, CA-24, CA-31 y CA-36.
  - 1a: CA-3, CA-9, CA-10, CA-11, CA-17, CA-51, CA-52 y CA-70.
  - 1b: CA-31.
  - SDD 2: CA-2, CA-5 y CA-6, esta última con aplicación débil.
  - Hay citas con matiz: 5a CA-22 solo cubre objetivos y decisiones; CA-19 omite CA-22.
- **Mecánica:** hay 23 CAs únicos, cada uno en una sola unidad. Las 11 pruebas de §7 y §12 coinciden y todas las referencias de §8 existen. El formato de CA, las 18 secciones, los números de unidad de 1a y 1b y el §17 vacío son correctos.

**No verificados**
- Uso real del flujo Plan GTM.
- Reglas de acceso en producción.
- Si el «Aviso» de `drafting.ts` es solo texto de prompt (vi hasta L69, truncado).
- Las entidades de 1a, 1b, 2 y 4a son SDD sin código, así que no hay nada que comprobar.
- No hay estimador de coste de IA en el repo; no se descarta que viva fuera de `src`.

## Límites de la revisión

- Leí íntegros el 5d, el PRD y el 5a, con sus tres informes de gate.
- De 1a, 1b, 2, 3 y 4a leí las listas de CAs y las tablas de unidades. Algunas líneas largas salieron recortadas (por ejemplo 1a CA-49 y SDD 3 CA-22, que no afectan a 5d).
- Del 5b leí CA-15 y CA-16; del 5c, los CAs y el §15.
- No leí 4b, los SDD de salida de Lovable ni el SDD 5 archivado.
- No consulté producción, no ejecuté pruebas y no hay datos de clientes en este informe.

### Respuesta del autor (primera pasada)
Pendiente: Fede aún no ha decidido las 7 preguntas; sin corregir esta v1.

## 18. Delta de implementación (lo rellena el agente al entregar)
(sin rellenar)
