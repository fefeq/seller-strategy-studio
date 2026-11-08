# SDD-20261030-gtm-control-tower-2-context-onboarding · [Feature] Contexto estratégico y onboarding por bloques con nivel de confianza

**Tipo:** Feature · **Prioridad propuesta:** Alta
**Estado:** SUPERADO por GTM Lab (PRD-20261101-gtm-lab-en-nokko §8 paso 2, aprobado por Fede el 2026-11-01); no ejecutar este texto (antes: Aprobado por Fede el 2026-10-30 (v6; incluye la copia temporal de Drive de CA-16, aceptada por Fede el 2026-10-30)) · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-10-30
**PRD:** `docs/prd/PRD-20261030-gtm-control-tower.md` · **Depende de:** SDD 1a (U-1, U-2, U-3, U-4 y U-7: roles, activación por rol, objetivos, resultados clave, públicos y decisiones) y SDD 1b (U-5: capacidad semanal, CA-36), y de los SDD de salida de Lovable A y B para construir · **Coordinar con:** `SDD-20261025-onboarding-flow-end-to-end` (Borrador, ticket NK-0009), `SDD-20261025-fit-data-7a-llave-minima-y-completado`, `SDD-20261025-fit-data-7b-competitors-entity`, `SDD-20261025-products-in-onboarding-autofill` (todos en Borrador) y `SDD-20261025-universal-field-definitions` (En curso: define los niveles y orígenes de dato que este SDD reutiliza)

> Un SDD dice cómo se verifica que está bien hecho. Cada criterio de aceptación (CA-n) debe poder tener una prueba automática que lo nombre.
> Los criterios no nombran tecnología; lo técnico va en el §13 como [Sugerencia — la revisión del gate las valida].
> Las reglas transversales del PRD (§6.2, R-1 a R-10) aplican a todo este SDD. «Organización» es la empresa que usa Nokko; «cuenta» es una empresa prospecto o cliente.

## 1. Resumen
Sustituye el medidor de completitud de ocho ítems de organización comercial por **cuatro bloques de contexto estratégico** (negocio y etapa; capacidad y restricciones; clientes y evidencia; activos y alternativas), cada dato con nivel de confianza y origen. Un bloque está cubierto cuando todos sus datos obligatorios tienen al menos una hipótesis declarada; hasta entonces no se puede activar ningún objetivo (crear Borradores sigue libre). Añade caducidad por tipo de dato, un diagnóstico de modelo de venta que admite dos a la vez, la siembra desde Drive con aprobación por bloques, la importación de documentos MD y listas CSV con revisión previa, los ajustes de la organización (zona horaria, día y hora del check-in y los rituales, avisos) y el paso de la configuración de CRM actual a Ajustes avanzados.

## 2. Problema y para quién
El setup actual mide ocho ítems pensados para un equipo comercial (cuota por AE, win rate, pilares, cuentas, deals) y no pregunta lo que un founder necesita para diseñar una estrategia: etapa, capacidad, restricciones, evidencia y activos. Para Fede (Owner) y Flor (Sales leader).

## 3. Evidencia y por qué ahora
- **Código (repo de Nokko, solo lectura, 2026-10-30):**
  - El setup se define en `src/lib/setup-schema.ts` con ocho ítems ponderados (posicionamiento, ICP, segmentos con ACV, win rate y cuota por AE, pilares, cuota trimestral, cuentas, deals).
  - El onboarding existente tiene seis bloques (`company`, `icp`, `segments`, `positioning`, `messages`, `goals`), tres profundidades (`express`, `standard`, `deep`) y tres niveles de dato (`confirmed`, `inferred`, `assumed`) (`src/lib/onboarding.ts`), con lectura en segundo plano y aprobación por bloques que reutiliza `applySetupItems`.
  - El nivel de dato se guarda hoy **por bloque** (`blockBasis` en `src/lib/onboarding.ts`), no por dato; el origen por campo (`src/lib/provenance.ts`: persona, fuente, IA, supuesto, sin dato) solo existe en `accounts`, y su ampliación a `icp_profiles` es la migración 0058, sin aplicar (`src/lib/AGENTS.md`).
  - El diagnóstico GTM elige un único arquetipo entre cinco (`src/lib/gtm-diagnosis.ts`).
  - La tabla `organizations` solo tiene nombre, empresa, web y moneda: no hay zona horaria de la organización ni ajustes (`src/integrations/supabase/types.ts`); sí existe una zona horaria por persona en las preferencias de avisos (`notification_prefs.timezone`).
  - Hay importación de cuentas en CSV (`src/lib/account-import.ts`, `src/lib/imports.functions.ts`) y una herramienta del agente que lleva documentos **desde Drive** al conocimiento (`drive_import_to_knowledge`); el onboarding actual no lee Drive y no existe filtro de Archivado ni [SUPERADO] en el código; no existe una sección «Ajustes avanzados».
- **Postin Core (Drive, solo lectura):** ICP-00 v2.4 §2 (nivel de evidencia, ICP en hipótesis) y §9.4 (caducidad a los 6 meses), F0-01 v6.3 (datos de partida y capacidad de 10 h/semana).
- **Entrevista con Fede (2026-10-29/30):** decisiones del PRD §6.1 (cuatro bloques, nivel de confianza, caducidad por tipo, diagnóstico híbrido, CRM oculto, importación MD/CSV, ajustes).
- Uso real del onboarding actual: **sin dato** [Por verificar].

## 4. Resultado buscado
- Los cuatro bloques cubiertos al menos con hipótesis declarada antes de activar un objetivo (G-4 del PRD). Medición: estado de los bloques en Nokko. Línea base: sin dato.
- Ningún dato estratégico sin nivel ni origen visibles.

## 5. Alcance
**Incluye:** H-1 a H-6.
**No incluye:**
- Atribución, embudos y diccionario de métricas (SDD 3); integraciones automáticas y su conexión (SDD 4); agente y chat (SDD 5); competidores como entidad y vigilancia (SDD 6 y SDD 7b); runway (SDD 7).
- Onboarding genérico para empresas de terceros.
- Cambios en Drive (solo lectura salvo OK explícito).
- Reescribir el onboarding existente de seis bloques: este SDD lo reutiliza y lo reasigna a los cuatro bloques (§12 y §13).

## 6. Cambios de comportamiento (delta)
**Añadido:** cuatro bloques de contexto con nivel y origen por dato; caducidad por tipo de dato; selección de dos modelos de venta; propuestas desde Drive con origen citado; importación de documentos MD; ajustes de organización (zona horaria, día y hora de rituales); bloqueo de la activación de objetivos hasta cubrir los bloques.
**Modificado:** el medidor de completitud pasa de ocho ítems a cuatro bloques; el diagnóstico GTM admite dos arquetipos y deja de descartar marcos; la configuración de CRM actual se ubica en una sección nueva de Ajustes avanzados.
**Eliminado:** nada se elimina. La configuración de CRM (etapas, plazos de leads, cuotas por AE, reglas de asignación) se conserva y se oculta en Ajustes avanzados.

## 7. Historias y criterios de aceptación
Cada CA cita el objetivo G-n del PRD que cubre y el archivo de prueba (ruta por decidir en la implementación [Sugerencia]).

### H-1: Como Owner, quiero cuatro bloques de contexto con nivel de confianza para saber qué sé de mi negocio y qué doy por supuesto.
- **CA-1** El sistema DEBE ofrecer el contexto estratégico en cuatro bloques: negocio y etapa; capacidad y restricciones; clientes y evidencia; activos y alternativas. · cubre G-4 · prueba: `context-blocks.test.ts`
- **CA-2** El sistema DEBE guardar cada dato de un bloque con su nivel (Confirmado, Deducido o Supuesto, o «Falta» cuando no hay dato) y su origen (persona, fuente, IA o supuesto), y MIENTRAS un dato no tenga nivel propio DEBE usar el nivel del bloque, como hoy. · cubre G-4, G-10 · prueba: `context-blocks.test.ts`
- **CA-3** El sistema DEBE considerar cubierto un bloque cuando todos sus datos obligatorios (tabla del §10) tienen nivel Confirmado, Deducido o Supuesto, y DEBE tratar «Falta» como no cubierto. · cubre G-4 · prueba: `context-blocks.test.ts`
- **CA-4** MIENTRAS la fase esté activa para el rol del usuario, el sistema DEBE mostrar cuántos de los cuatro bloques están cubiertos y con qué nivel, en lugar del medidor de ocho ítems, y DEBE conservar el medidor actual para los demás usuarios. · cubre G-4 · prueba: `context-blocks.test.ts`
- **CA-5** MIENTRAS la fase esté activa para el rol del usuario, SI la organización tiene algún bloque sin cubrir, ENTONCES el sistema DEBE impedir activar cualquier objetivo (SDD 1a, CA-10) y DEBE ofrecer completar los bloques que faltan, incluida la opción de declarar una hipótesis, que cubre el dato; crear objetivos en Borrador DEBE seguir permitido. · cubre G-4 · prueba: `context-gate.test.ts`
- **CA-6** CUANDO una persona escribe o confirma un dato, el sistema DEBE sellarlo como escrito por persona y DEBE conservar ese valor frente a cualquier propuesta automática posterior, que quedará como propuesta pendiente. · cubre G-4, G-10 · prueba: `context-blocks.test.ts`
- **CA-7** El sistema DEBE permitir a los roles Owner y Sales leader editar los datos de los bloques, salvo la capacidad de otra persona, que solo edita el Owner (SDD 1b, CA-36), y a los demás roles solo consultarlos. · cubre G-10 · prueba: `context-blocks.test.ts`
- **CA-27** El sistema DEBE ocultar al Consejo el contenido de los bloques de contexto. · cubre G-10 · prueba: `context-blocks.test.ts`
- **CA-28** El sistema DEBE mostrar el nivel de un público del SDD 1a como Confirmado si es Verificado, Supuesto si es Hipótesis y Falta si es Falta, y DEBE contar el bloque «Clientes y evidencia» como cubierto cuando hay al menos un público con nivel distinto de Falta. · cubre G-4 · prueba: `context-blocks.test.ts`
- **CA-29** MIENTRAS la fase no esté activa para el rol del usuario, el sistema DEBE mantener sin cambios el onboarding, el diagnóstico GTM, el medidor, la caducidad, las fechas y rituales y los ajustes anteriores (PRD R-9). · cubre G-10 · prueba: `context-phase-guard.test.ts`

### H-2: Como Owner, quiero que la información caduque para no decidir con datos viejos.
- **CA-8** El sistema DEBE aplicar a cada dato de los bloques que tenga nivel propio en este SDD (las filas de la tabla del §10, salvo el público y la capacidad, que se rigen por los SDD 1a y 1b) un plazo de caducidad que el Owner puede configurar, con 6 meses por defecto (ICP-00 §9.4). · cubre G-4 · prueba: `context-expiry.test.ts`
- **CA-9** CUANDO un dato supera su plazo sin revisarse, el sistema DEBE guardar su nivel previo, pasarlo a Supuesto y avisar a quien lo confirmó por última vez o, si no consta, a los Owners. · cubre G-4 · prueba: `context-expiry.test.ts`
- **CA-10** CUANDO una persona con rol Owner o Sales leader revisa un dato caducado y lo confirma, el sistema DEBE marcarlo Confirmado y reiniciar su plazo. · cubre G-4 · prueba: `context-expiry.test.ts`
- **CA-11** MIENTRAS un dato esté caducado, el sistema DEBE mostrarlo marcado como tal y DEBE seguir contándolo como cubierto, con nivel Supuesto. · cubre G-4 · prueba: `context-expiry.test.ts`

### H-3: Como Owner, quiero marcar dos modelos de venta a la vez porque mi negocio los combina.
- **CA-12** El sistema DEBE permitir seleccionar uno o dos de los cinco arquetipos de venta existentes como punto de partida (por ejemplo, el de bajo contacto o autoservicio y el de venta asistida de rango medio). · cubre G-4 · prueba: `gtm-diagnosis.test.ts`
- **CA-13** El sistema DEBE ofrecer los marcos de cada arquetipo seleccionado como sugerencias y DEBE dejar de descartar marcos del arquetipo seleccionado por el filtro de etapa. · cubre G-4 · prueba: `gtm-diagnosis.test.ts`

### H-4: Como Owner, quiero que el agente proponga el contexto desde Drive y yo lo apruebe por bloques.
- **CA-14** DONDE haya una carpeta de Drive conectada, el sistema DEBE leer sus documentos vigentes, ignorando la carpeta Archivado y los documentos marcados [SUPERADO], y DEBE proponer datos de los cuatro bloques con su origen citado, salvo clientes y MRR, que solo DEBEN venir de una persona, de la fuente de cobro o de la base de datos. · cubre G-4, G-10 · prueba: `context-seeding.test.ts`
- **CA-15** CUANDO el sistema propone datos, DEBE guardarlos como propuestas pendientes y DEBE aplicarlos solo cuando un Owner o un Sales leader apruebe el bloque, y DEBE permitir al Owner deshacer lo aplicado durante 24 horas. · cubre G-4, G-10 · prueba: `context-seeding.test.ts`
- **CA-16** El sistema DEBE abstenerse de dejar creado, movido, renombrado o archivado ningún documento en la carpeta de Drive del usuario tras la lectura, DEBE eliminar al terminar cualquier copia temporal que cree para leer formatos de Office y, SI no puede eliminarla, ENTONCES DEBE avisar al Owner. · cubre G-10 · prueba: `context-seeding.test.ts`
- **CA-17** SI un documento leído contradice a otro en un mismo dato, ENTONCES el sistema DEBE mostrar ambos valores con su origen y DEBE pedir a una persona que elija, sin resolver la contradicción por su cuenta. · cubre G-4, G-10 · prueba: `context-seeding.test.ts`

### H-5: Como Owner o Sales leader, quiero importar documentos y listas con revisión previa.
- **CA-18** El sistema DEBE permitir importar archivos Markdown como documentos de conocimiento, con su nombre y su fecha como origen, y DEBE mostrar una revisión antes de guardar. · cubre G-4 · prueba: `context-import.test.ts`
- **CA-19** El sistema DEBE permitir importar archivos CSV de cuentas objetivo (incluidas columnas de calificación) con revisión previa, plan de deshacer y el mismo tamaño máximo de archivo que ya aplica el onboarding actual. · cubre G-4 · prueba: `context-import.test.ts`
- **CA-20** SI un archivo importado trae un registro que ya existe según la regla de coincidencia de duplicados que ya usa Nokko, ENTONCES el sistema DEBE avisar del posible duplicado y DEBE evitar fusionarlos por su cuenta. · cubre G-4 · prueba: `context-import.test.ts`
- **CA-21** SI un archivo importado supera el tamaño permitido o tiene un formato no reconocido, ENTONCES el sistema DEBE rechazarlo explicando qué pasó y qué hacer. · cubre G-10 · prueba: `context-import.test.ts`

### H-6: Como Owner, quiero ajustes de organización y la configuración de CRM fuera del camino.
- **CA-22** El sistema DEBE permitir al Owner fijar la zona horaria de la organización, con Europe/Madrid por defecto, y DEBE usarla en las fechas, los plazos y los identificadores que dependen del día. · cubre G-4 · prueba: `org-settings.test.ts`
- **CA-23** El sistema DEBE permitir al Owner fijar el día y la hora del check-in semanal y de los rituales (repaso mensual y pleno trimestral). · cubre G-4 · prueba: `org-settings.test.ts`
- **CA-24** El sistema DEBE usar la zona horaria de la organización para las fechas, los plazos y los rituales de la organización, y DEBE conservar la zona horaria por persona y el silencio nocturno para los avisos a esa persona. · cubre G-10 · prueba: `org-settings.test.ts`
- **CA-25** MIENTRAS la fase esté activa para el rol del usuario, el sistema DEBE ofrecer una sección Ajustes avanzados con las etapas de deals, los plazos de leads, las cuotas por AE y las reglas de asignación, sin cambiar su funcionamiento, y DEBE excluirlas del onboarding y del medidor. · cubre G-4, G-10 · prueba: `advanced-settings.test.ts`
- **CA-26** SI el usuario no es Owner, ENTONCES el sistema DEBE mostrar los ajustes de organización en solo lectura. · cubre G-10 · prueba: `org-settings.test.ts`

## 8. Casos límite y errores
Cada caso remite al CA que lo cubre.
- Dato sin valor ni hipótesis → «Falta», bloque no cubierto (CA-3).
- Organización nueva sin ningún bloque → puede guardar objetivos en Borrador, no activarlos (CA-5).
- Dato escrito por persona y luego propuesto distinto por una lectura → se conserva el de la persona (CA-6).
- Dato caducado → Supuesto, avisado, sigue contando como cubierto (CA-9, CA-11).
- Dos documentos se contradicen → elige una persona (CA-17).
- Carpeta de Drive sin permisos o sin documentos vigentes → no hay propuestas y se explica qué hacer (CA-14, CA-21).
- Importación duplicada, vacía o demasiado grande → CA-20 y CA-21.
- Zona horaria cambiada → las fechas nuevas usan la nueva; los identificadores ya asignados no cambian (CA-22 y SDD 1a CA-49).
- Rol sin permiso → solo lectura (CA-7, CA-26).
- Otra organización → nunca ve estos datos (PRD R-10).

## 9. Experiencia y copy
Sistema visual actual (Ink + Lima, versalitas con filete, sin iconos), textos en «tú».
- **Niveles:** Confirmado, Deducido, Supuesto y Falta (estados con palabra y filete).
- **Mensajes sugeridos** (a validar con la guía de voz de marca): «Aún no puedes activar un objetivo: faltan datos en <bloque>. Puedes declarar una hipótesis y revisarla después.» · «Este dato caducó el <fecha>: lo tratamos como supuesto hasta que lo revises.»
- **Pantalla:** el onboarding se organiza por los cuatro bloques; cada dato muestra su nivel, su origen y su fecha de revisión.

## 10. Datos, permisos y privacidad
- **Equivalencia de niveles:** la función de este SDD hacia el vocabulario del SDD 1a (públicos) es Confirmado → Verificado; Deducido y Supuesto → Hipótesis; Falta → Falta. El bloque «Clientes y evidencia» queda cubierto cuando hay al menos un público con nivel distinto de Falta.
- **Capacidad:** las horas semanales las registra el SDD 1b (CA-36) sin nivel propio; para cubrir el bloque, una capacidad registrada por la propia persona o por el Owner cuenta como Confirmado. La fila «público» del bloque 3 no caduca en este SDD: su nivel pertenece al SDD 1a.
- **Datos obligatorios por bloque** (propuesta del autor, a confirmar con Fede):

| Bloque | Datos obligatorios |
|---|---|
| Negocio y etapa | Modelo de negocio; etapa; precio de referencia (enlazado a la web de precios, no copiado); datos de partida (clientes y MRR, o «0») |
| Capacidad y restricciones | Horas semanales de al menos una persona (SDD 1b, CA-36); al menos un anti-ICP; límites de plataforma (LinkedIn solo por la API oficial) |
| Clientes y evidencia | Al menos un público con su nivel de evidencia (SDD 1a, CA-25) |
| Activos y alternativas | Al menos una alternativa competitiva (alternativas de ICP-00 §6.2 como base) |

- **Permisos:** Owner y Sales leader editan; los demás roles consultan; el Consejo no ve este contenido.
- **Privacidad:** ningún dato de clientes en documentos importados de ejemplo ni en pruebas; los documentos de Drive se leen sin copiar datos de clientes a las propuestas.
- **Conceptos nuevos:** ajustes de organización (zona horaria, día y hora de rituales), plazo de caducidad por tipo de dato, revisión de dato.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| Lectura de Drive y propuesta de los cuatro bloques | regla (qué documentos vigentes leer) → modelo barato para extraer → modelo caro solo en «A fondo» | Reutiliza la lectura en segundo plano existente (`onboarding_read`) [Por verificar el modelo concreto] | sin dato (el coste previo ya se muestra en la lectura actual) |
| Resúmenes de documentos MD importados | modelo barato | [Por verificar] | sin dato |

Una llamada no declarada aquí no se implementa.

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero [Sugerencia] | Depende de |
|---|---|---|---|---|
| U-1 | Ajustes de organización (zona horaria, día y hora de rituales, avisos) y Ajustes avanzados de CRM | CA-22 a CA-26 | `org-settings.test.ts`, `advanced-settings.test.ts` | SDD 1a U-1 (los SDD 1a y 1b usan Europe/Madrid hasta que esta unidad entregue el ajuste) |
| U-2 | Cuatro bloques, niveles, origen, cobertura y medidor | CA-1 a CA-4, CA-6, CA-7, CA-27, CA-28 | `context-blocks.test.ts` | U-1, SDD 1a U-4 (públicos), SDD 1b U-5 (capacidad) |
| U-3 | Caducidad por tipo de dato | CA-8 a CA-11 | `context-expiry.test.ts` | U-2 |
| U-4 | Diagnóstico con dos modelos de venta | CA-12, CA-13 | `gtm-diagnosis.test.ts` | U-2 |
| U-5 | Siembra desde Drive con aprobación por bloques | CA-14 a CA-17 | `context-seeding.test.ts` | U-2 |
| U-6 | Importación de documentos MD y listas CSV | CA-18 a CA-21 | `context-import.test.ts` | U-2 |
| U-7 | Bloqueo de la activación de objetivos hasta cubrir los bloques y guardia de fase | CA-5, CA-29 | `context-gate.test.ts`, `context-phase-guard.test.ts` | U-2, SDD 1a U-3 |

**Orden:** U-1, U-2, U-3, U-4, U-5, U-6, U-7.

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- Reutilizar el onboarding existente (`src/lib/onboarding.ts`, `src/components/onboarding/`, `onboarding_sessions`) y reasignar sus seis bloques a los cuatro: `company` y `goals` → negocio y etapa; `icp` y `segments` → clientes y evidencia; `positioning` y `messages` → activos y alternativas; capacidad y restricciones es nuevo.
- Niveles y orígenes: reutilizar `Level` (`confirmed`, `inferred`, `assumed`) y `src/lib/provenance.ts`; añadir «Falta» como ausencia de valor, no como nivel guardado.
- Aprobación por bloques y deshacer: `applySetupItems` y `undoSetupItems`; protección de lo escrito por persona: `protectManual`.
- `setup-schema.ts` y su medidor: sustituir los ocho ítems por los datos obligatorios del §10; entre otros leen el medidor `src/lib/setup-guide.ts`, `src/hooks/use-setup.ts`, `src/lib/bmad/cycle-state.ts`, `src/lib/org-data.ts`, `src/components/setup/wizard.tsx`, `src/lib/agent/tools/strategy.ts`, `src/lib/agent/tools/core-read.ts` y el detector proactivo `setup-incomplete` con su `resolve`; el «terminado» del onboarding pasa a ser «cuatro bloques cubiertos» y la guía «Primeros pasos» (`src/lib/guide.ts`) se actualiza para leerlo.
- Nivel por dato: hoy es por bloque; un nivel por dato, su nivel previo, su responsable y su plazo necesitan almacenamiento nuevo (el origen por campo de `accounts` no sirve para capacidad, anti-ICP, alternativas ni datos de partida).
- Protección de lo escrito por persona: `protectManual` solo cubre posicionamiento, segmentos, cuota y moneda; hay que ampliarlo (CA-6).
- Diagnóstico: `diagnose()` ya descarta marcos (`src/lib/gtm-diagnosis.ts`) y se guarda por usuario; CA-13 lo cambia.
- Deshacer: `undoSetupItems` solo borra filas creadas y lo usa el Owner; el plazo de 24 horas de CA-15 es nuevo (PRD §6.1).
- «Productos» (SDD `products-in-onboarding`) se integra en el bloque de activos y alternativas; su reparto concreto se fija en el brief.
- Drive: `readFile` (`src/lib/drive-core.ts`) crea una copia temporal en Drive para leer formatos de Office y la borra después (CA-16).
- Importación de Markdown: `importToKnowledge` (`src/lib/drive-core.ts`) lee desde Drive; subir un archivo local es nuevo.
- Zona horaria: `notification_prefs.timezone` es por persona (`src/lib/jobs.ts`, `src/components/notice-prefs.tsx`); la de la organización es nueva y no la sustituye.
- Ajustes de organización: `organizations` no tiene columna de ajustes; hace falta una tabla nueva (misma observación que en el SDD 1a).
- Importación: reutilizar `src/lib/account-import.ts`, `src/lib/import-batch.ts` e `imports.functions.ts` (revisión, límites y deshacer); para MD, reutilizar la lectura de Drive al conocimiento.
- Solapes con SDD en Borrador: `onboarding-flow-end-to-end` (NK-0009), 7a, 7b y `products-in-onboarding`; hay que repartir qué entrega cada uno antes de construir.
- Migraciones aditivas; las 0058 y 0059 siguen sin aplicar (`src/lib/AGENTS.md`).

## 14. Riesgos y dependencias
- Solape con cuatro SDD en Borrador del 2026-10-25: `onboarding-flow-end-to-end` (dos definiciones de «terminado»: seis bloques aprobados o saltados frente a cuatro bloques cubiertos), `products-in-onboarding` (un séptimo bloque «Productos»), 7a (la importación de cuentas debe respetar la llave mínima y el aviso de duplicados) y 7b (la alternativa competitiva vive hoy como texto en posicionamiento). `universal-field-definitions` (En curso) depende de la migración 0058. Decisión de Fede (2026-10-30): este SDD define el contenido (cuatro bloques) y cuándo está terminado el onboarding; `onboarding-flow-end-to-end` conserva el flujo, la guía y la experiencia, y «Productos» entra en el bloque de activos y alternativas. Quedan por repartir 7a y 7b en el brief.
- Depende de que los SDD de salida de Lovable A y B estén cerrados para construir.
- Los datos obligatorios del §10 son una propuesta del autor: si Fede los cambia, cambian CA-3 y U-2.
- Bloquear la activación de objetivos (CA-5) frena a quien tenga prisa; se mitiga permitiendo declarar una hipótesis y guardar Borradores.

## 15. Preguntas para Fede y para la revisión técnica
- Fede: ¿confirmas los datos obligatorios del §10?
- Fede: ¿plazos de caducidad por tipo más cortos que 6 meses (por ejemplo, precios y competencia)? Hasta entonces, 6 meses para todo.
- Revisión técnica: ¿qué parte del onboarding existente se reutiliza tal cual y qué parte reescribe el SDD `onboarding-flow-end-to-end`?

## 16. Pendiente de verificar
- Datos obligatorios por bloque (§10) → Fede.
- Reparto de alcance con 7a y 7b → gate (decidido con NK-0009 y `products-in-onboarding`).
- Plazos de caducidad por tipo de dato → Fede.
- Reparto de alcance con NK-0009, 7a, 7b y `products-in-onboarding` → gate.
- Modelo concreto de las llamadas de IA (§11) → gate.
- Uso real del onboarding actual → datos de producción.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Pasadas del gate (agente de contexto fresco con las reglas del gate): la primera puso 3 bloqueantes y 8 menores, corregidos; las siguientes, sobre la v4, v5 y v6, no encontraron bloqueantes nuevos. El resultado de la última comprobación, sin editar:

- Sin bloqueantes nuevos.
- CA-8, CA-16 y CA-29 son coherentes con 1a y 1b.
- Menor: CA-16 admite una copia temporal en Drive, y la regla de Drive pide OK de Fede para crear.
- Menor: el §16 repite una línea.

**Respuesta del autor (v6, 2026-10-30).** La copia temporal de Drive la hace hoy `readFile` y se elimina al terminar; Fede la aceptó el 2026-10-30. El gate informa; aprueba Fede.

## 18. Delta de implementación (lo rellena el agente al entregar)
Sin entrega todavía.
