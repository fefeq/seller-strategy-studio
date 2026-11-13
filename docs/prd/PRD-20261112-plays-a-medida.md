# PRD-20261112-plays-a-medida · [Iniciativa] Plays a medida

**Tipo:** Iniciativa · **Prioridad propuesta:** Media-alta (reutiliza catálogo, estado por empresa, puertas, herramientas del asistente y conectores que ya existen; el coste es de ingeniería y de IA por propuesta; no depende de proveedores nuevos en la tanda 0; sin datos de uso, es una apuesta declarada)
**Estado:** Borrador · **Pide:** Fede (entrevistas, 2026-11-12 y 2026-11-13) · **Aprueba:** Fede · **Fecha:** 2026-11-12
**Ticket:** NK-0171 (LOGGED, `.factory/ledger.json`, registrado el 2026-11-12)
**SDD que lo desarrollan:** pendientes (sección 8): cuatro en la tanda 0 (modelo, biblioteca, asistente, motor de ejecución) y uno por conector o vertical después
**Cola del sprint siguiente (decidida por Fede, 2026-11-12):** NK-0156, esta iniciativa, NK-0167, NK-0168

> Un PRD dice qué se quiere y por qué. No dice cómo se construye ni cómo se prueba: eso es del SDD.

## 1. Problema
Hoy NOKKO tiene 28 plays fijos en código, escritos de forma general. En `src/lib/plays/catalog.ts` (`main` @ d5e6a56) 16 están `bloqueado`, 11 `parcial` y 1 `planificado`: ninguno de los 28 se crea a medida de una empresa. Una empresa cuya estrategia pide otra cosa (otro nicho, otra señal, otra zona) no tiene dónde ponerlo: no puede pedir un play pensado para su ICP, su oferta y su mercado, ni sabe si la señal en la que se apoya es verificable, está fresca o se puede probar con una muestra pequeña antes de escalar.

Fede quiere replicar la **estructura** del catálogo público de plays de Glider (63 plays, cada uno con disparador, fuentes por paso, evidencia citada, entregable, verificación manual y prueba) y usarla como base para **crear plays nuevos alineados con la estrategia de cada empresa**, dentro del flujo de NOKKO. Límite duro: se replican estructura y patrones con palabras propias; no se copia ningún nombre, hook ni mensaje de ejemplo de Glider.

## 2. Para quién
- **Owner y Sales Leader** de cada empresa: proponen, aprueban, activan y pausan plays a medida (igual que hoy con `set_play_enabled`, `src/lib/agent/tools/plays.ts:75`, y la regla de roles `canTogglePlays`, `src/lib/plays/status.ts:39`).
- **Resto de miembros:** ven los plays y reciben sus sugerencias; no aprueban.
- Mercado global, con clientes de nicho y B2B general (decisión 7). No se diseña para un solo sector.

## 3. Evidencia y por qué ahora
**Qué se ha leído** (solo lectura; primera redacción sobre `main` @ 48f05ff, corregido tras el gate (pasadas 1 y 2) sobre `main` @ d5e6a56, 2026-11-13):
- Análisis de los 63 plays: `docs/prd/annex/glider-plays-analysis-20261112.md`. **Lo hizo un modelo pequeño resumiendo páginas**, no es lectura literal; solo se comprobó el texto en 2 páginas. Los recuentos de abajo son suyos y valen como orden de magnitud, no como dato.
- Código a reutilizar: `src/lib/plays/{types,catalog,teams,gating,gates,run-log,recommend,status}.ts`; migración `drizzle/migrations/0077_plays_library_core.sql` (`play_states`, `play_runs`); herramientas `src/lib/agent/tools/plays.ts`; reglas de `src/lib/AGENTS.md` (nunca inventar datos, cada handler filtra por `org_id`, la IA propone y el código puro valida y ordena, nada se envía solo).
- **Diagnóstico de plays** (`src/lib/plays/diagnosis.ts`, `src/lib/agent/tools/play-diagnosis.ts` con `diagnose_play_teams` y `save_play_plan`; SDD-20261112-diagnosis-in-chat; NK-0153): **ya está en `main`** (@ d5e6a56, comprobado). Deja de ser una dependencia pendiente; el asistente de plays a medida (SDD 3) se apoya en él.

**Lo que el análisis dice del formato de Glider (y por qué sirve):**
1. Cada play arranca de un **evento verificable** (un cambio público), no de un segmento.
2. Cada dato del mensaje lleva el **número del paso** donde se obtuvo: el mensaje es auditable.
3. Antes de escribir se construye un **artefacto útil** (una página, una comparativa, una lista); la petición es pequeña.
4. Hay un **paso de verificación manual** con riesgos concretos.
5. Hay un **test definido antes de enviar**, con muestra y umbral.

**Lo que el análisis dice que falla en Glider y aquí se corrige:**
- Solo 17 de 61 declaran una ventana de frescura; en 25 de 61 la muestra del test no coincide con la base del umbral; ninguna página da resultados reales (todo son metas). Son cifras de un resumen automático.
- Portabilidad: 17 de 63 plays serían portables tal cual a mercado hispanohablante o UE (grado A), 30 necesitan fuente local equivalente (B) y 16 son solo de EE. UU. (C). La portabilidad depende del tipo de fuente: web abierta, reseñas y foros salen A; registros oficiales salen B o C.

**Lo que NOKKO no tiene y esta iniciativa define** (comprobado en el código leído):
| Falta | Hoy | Consecuencia |
|---|---|---|
| Cadena de evidencia con cita por paso | `play_runs` guarda solo ids y un motivo corto de descarte (`run-log.ts:21`) | No se puede auditar de dónde sale cada afirmación de un mensaje |
| Quien ejecute un play a medida | En `main`, `runGates` y `runRow` no tienen llamador en producción y `play_runs` solo se lee (`components/plays/play-card.tsx:19`); las puertas son funciones en código (`plays/types.ts:9-12`) | Un play guardado en una tabla no haría nada: hace falta un intérprete de puertas declarativas y un motor que ejecute (SDD 4) |
| Entregable de una página como borrador | `OUTPUTS` = suggestion, task, draft (`catalog.ts`); no hay un tipo de borrador «página» | El valor previo al contacto no tiene dónde vivir |
| Verificación manual explícita | No existe como paso | Un humano aprueba el borrador, pero no hay lista de riesgos concretos por play |
| Diseño de prueba (muestra y umbral) | No existe | No hay forma de decidir qué es éxito antes de escalar |
| Parámetros por empresa (zona, oficio, umbrales) | `play_states.settings` es jsonb libre, sin validar | Un play general no se adapta |
| Ventana de frescura obligatoria, sobre la fecha del evento | Las señales de cuenta tienen fecha, pero ningún play obliga a declarar una; los datos de origen traen la fecha del evento solo a veces (Perplexity devuelve `date \| null`, `perplexity.ts:21,62`) | Una señal vieja puede parecer actual si solo se guarda cuándo se leyó |
| Comprobación de fuente contra lo que NOKKO puede leer | El estado `bloqueado` es una etiqueta fija en código (`BLOCKERS`, `catalog.ts:31`). El estado «conectado» de Clay, Apollo, Parallel, Firecrawl, Perplexity, Apify y Drive es de toda la plataforma: `connectedServices()` no recibe empresa y mira variables de entorno (`orchestrator/runner.ts:31-43`; `src/lib/AGENTS.md`); `integrations` **sí** tiene `org_id` y RLS (0002:96-99), pero su `status` (default `planned`, 0000:196-201) es una etiqueta que cada empresa cambia a mano en `/integrations` (`routes/_authenticated/integrations.tsx:125-131`): **no prueba** que la fuente esté disponible y no se usa para eso. Solo PostHog es por empresa | No se calcula contra nada: hace falta un registro en código de lo que NOKKO lee y con qué herramienta, más PostHog por empresa |
| Planes propios de la empresa | El catálogo es código y solo guarda estado por empresa | No se puede crear un play que no esté en el código |

**Por qué ahora:** el catálogo, el estado por empresa, las puertas y el diagnóstico ya existen; añadir el molde y la creación a medida es más barato antes de que se construya la lógica de cada uno de los 16 plays bloqueados y los 11 parciales. Sin datos de uso: todas las líneas base son «sin dato».

## 4. Objetivos
| ID | Objetivo | Cómo se mide | Línea base | Fuente |
|---|---|---|---|---|
| G-1 | Que las empresas tengan plays creados para ellas y en uso | Empresas con al menos un play «Creado para tu empresa» **activo en el momento de medir** (no «activado alguna vez»: la tabla nueva guarda el estado, no el historial). Se informan **aparte**, sin sumarlas, las que tienen una receta «De NOKKO» activa en la tabla nueva y las que tienen un play del catálogo activo en `play_states` (`enabled`) | Sin dato (no existe) | **Dos fuentes, contadas explícitamente (C-9):** tabla nueva (`origen`, estado activo, `org_id`) y `play_states.enabled` para los 28 del catálogo. El SDD 4 puede guardar la fecha de la primera activación si se quiere medir «alguna vez»; si no, no se mide |
| G-2 | Que las propuestas del asistente sean útiles | De las propuestas **decididas** (`status` en `confirmed` o `cancelled`), la parte confirmada, por empresa. Denominador: solo decididas. Las `pending` que nadie decide **y las `failed`** (Fede confirmó y la escritura falló: **no cuenta como aprobada**, no se creó el play) se cuentan aparte, no entran. Confirmar la acción **es** aprobar el play (P-3). **Filas perdidas:** `agent_pending_actions.conversation_id` es `ON DELETE CASCADE` y la RLS deja borrar conversaciones (0007:40,60), así que borrar una conversación borra sus propuestas y baja el denominador. Hoy ninguna pantalla las borra. Regla: la medida se **congela por periodo** (el recuento se guarda al cerrar cada periodo, antes de borrar nada) y se declara que un borrado posterior la reduce; el SDD 3 decide si basta con la congelación o si hay que añadir una columna de resultado a la tabla nueva | Sin dato (no existe) | `agent_pending_actions` (`tool`, `status`, `decided_at`, migración 0007) como única fuente. La tabla nueva no guarda «propuesto» ni «descartado» (P-3), así no hay dos fuentes. Lectura por consulta de producto, no por pantalla: la RLS de esa tabla es «own read» por usuario (0007) |
| G-3 | Que los plays se prueben antes de escalar | Plays activos con resultado de prueba registrado (muestra, éxitos, fecha), contando **los dos orígenes** (recetas «De NOKKO» y plays «Creado para tu empresa»), que viven en la misma tabla nueva (C-9). Los 28 del catálogo no usan el molde y no entran | Sin dato (no existe) | Tabla nueva (campos de prueba y resultado). Lo construye el SDD 4 (motor de ejecución): registrar el resultado es parte de ejecutar |
| G-4 | Que un play mal definido no se pueda guardar | Planes guardados con muestra y umbral incoherentes, sin ventana de frescura o con un paso sin fuente | Sin dato; se verifica por prueba: debe ser 0 | Prueba automática de la validación pura |
| G-5 | Que un play sin fuente disponible nunca finja | Plays activados o ejecutados con un paso cuya fuente no está en el registro de fuentes de NOKKO, no está disponible en la plataforma (`connectedServices`) o, si es PostHog, no está conectada en esa empresa. Cuenta plays de la tabla nueva (los del catálogo conservan su `GateDef` en código) | Sin dato; se verifica por prueba: debe ser 0 | Prueba automática de la comprobación de fuentes (SDD 1: función pura; SDD 4: se aplica al activar y en cada ejecución) |
| G-6 | Que ninguna afirmación de un mensaje salga sin cita | Borradores guardados con una afirmación sin paso de evidencia, que cita un paso inexistente, o cuyo hecho tiene **fecha del evento** fuera de la ventana o desconocida | Sin dato; se verifica por prueba: debe ser 0 | Prueba automática de la validación de borradores (SDD 1: validación pura; SDD 4: se aplica al guardar cada borrador) |
| G-7 | Que cada propuesta y cada ejecución dejen registrado su coste, para decidir un tope con datos y no con suposiciones (tanda 0 abierta y sin freno de IA: decisión 15) | Propuestas y ejecuciones con registro de coste, por empresa. Cada registro guarda tokens y coste cuando el proveedor los devuelve y «sin dato» cuando no. **Solo registrar: que el registro falle no impide guardar la propuesta ni ejecutar** | Sin dato: **hoy esto no se mide en ningún sitio** (ver 6.5) | **Registro nuevo**, instrumentado en el SDD 3 (propuestas) y el SDD 4 (ejecuciones). No se puede medir con las tablas actuales |

Nunca hay línea base estimada. G-4, G-5 y G-6 son invariantes de seguridad: se prueban, no se miden con datos de uso. G-7 es de instrumentación: su éxito es que el registro exista y se rellene (con «sin dato» cuando el proveedor no devuelve el coste), no una cifra. El coste que se registre se podrá cruzar con G-1 a G-3 por empresa cuando haya filas.

## 5. No-objetivos
- **Copiar texto de Glider:** nombres, hooks, mensajes de ejemplo y títulos quedan fuera. Solo estructura y patrones (decisión 9).
- **Enviar o publicar nada solo.** Un play produce sugerencia, tarea o borrador; lo aprueba una persona (reglas de `src/lib/AGENTS.md`).
- **Inventar la fuente que falta.** Si NOKKO no puede leer una fuente (no está en el registro de fuentes o no está disponible en la plataforma), el play queda bloqueado por fuente externa con el motivo.
- **Tabla de conexiones por empresa:** no se crea en esta iniciativa. Si algún día cada empresa debe traer sus propias claves de Clay, Apollo u otros, es un SDD aparte (ver C-1).
- **Tope o freno de coste de IA en la tanda 0:** Fede eligió solo registrar el coste, sin freno (decisión 15). No se inventa ninguna cifra; el tope, si llega, se decide después con el coste registrado. Esto es solo del coste de **IA**: los pasos con proveedor (Apify, Clay, Apollo, Firecrawl, Parallel) pasan por el runner del orquestador y `org_budgets` sigue pausando el trabajo **automático** al 100 % (`orchestrator/runner.ts`, `src/lib/AGENTS.md`); las claves de esos proveedores son de NOKKO y compartidas.
- **Motor de envío (decisión de posicionamiento confirmada por Fede, 2026-11-12):** NOKKO no construye un motor de envío. Decide y prepara; otras herramientas envían.
- **Plays basados en registros oficiales** (P1 a P7 del análisis) en la tanda 0: dependen de fuentes por país sin verificar. Son SDD 5+.
- **Cambiar los 28 plays existentes** ni migrarlos al molde nuevo.
- **Contacto verificado propio:** NOKKO sigue usando Clay y Apollo para encontrar contacto; no se construye un proveedor de contactos.
- **Pantalla nueva de creación** en la tanda 0: la propuesta y la aprobación ocurren en el asistente y en la vista de plays que ya existe.
- **Presentar una receta como análisis o puntuación de perfiles de personas:** nunca. Una receta trata de una señal pública y un motivo para escribir (decisión 12). Fede respondió «Sí, con las integraciones que ya usamos» a si entran recetas basadas en perfiles de LinkedIn (decisión 12), pero no están entre las tres de la tanda 0. Esa respuesta **cierra la D2** del PRD de plays (decisión 17); los seis plays del catálogo con `blockedBy: "linkedin_d2"` **siguen bloqueados** hasta que un SDD los construya.
- **Aplicar a Postin:** NOKKO y Postin son productos separados; las reglas de Postin no aplican a las recetas de NOKKO (decisión 16).

## 6. Decisiones tomadas y abiertas
Decididas por Fede en la entrevista del 2026-11-12 (origen: NK-0171):
| # | Tema | Decisión | Quién y cuándo |
|---|---|---|---|
| 1 | Almacenamiento | Tabla por empresa con `org_id` y RLS (migración). La biblioteca de referencia vive en código y es solo lectura | Fede, 2026-11-12 |
| 2 | Quién propone y aprueba | Owner y Sales Leader | Fede, 2026-11-12 |
| 3 | Fuente no conectada | El play queda bloqueado por fuente externa con el motivo; nunca finge | Fede, 2026-11-12 |
| 4 | Tanda 0 | Molde validado por código + 3 recetas horizontales con herramientas ya disponibles + herramienta del asistente para proponer y guardar un play con aprobación | Fede, 2026-11-12 |
| 5 | Coste de IA | Medir en la tanda 0 y poner un tope después; sin cifra inventada | Fede, 2026-11-12 |
| 6 | Éxito | Empresas con al menos un play a medida activado; propuestas aprobadas frente a descartadas; plays con resultado de prueba | Fede, 2026-11-12 |
| 7 | Mercado | Global, clientes de nicho y B2B general | Fede, 2026-11-12 |
| 8 | Vocabulario | Todo es «play». Se distingue solo por origen: «De la biblioteca» o «Creado para tu empresa» (la primera etiqueta queda sustituida por «De NOKKO», decisión 19). Sin nombres nuevos tipo «recetas» en la interfaz | Fede, 2026-11-12 |
| 9 | Texto de Glider | No se copia: solo estructura y patrones, con palabras propias (límite del coordinador, confirmado por Fede) | Fede / coordinador, 2026-11-12 |
| 10 | Cola | NK-0156, esta iniciativa, NK-0167, NK-0168 | Fede, 2026-11-12 |
| 11 (antes Q-1) | Pregunta: ¿confirmas las tres recetas de la tanda 0, R-1, R-2 y R-3? Respuesta literal de Fede: «Las tres (Recommended)». Consecuencia (coordinador): R-1, R-2 y R-3 quedan confirmadas tal como se propusieron; R-3 lleva un ajuste que Fede aceptó en la decisión 18 (ver 6.4) | Fede, 2026-11-12 |
| 12 (antes Q-2) | Pregunta: ¿entran recetas basadas en perfiles de LinkedIn? Respuesta literal de Fede: «Sí, con las integraciones que ya usamos». Alcance y cierre de D2: decisiones 16 y 17. Riesgo: ver 7.2 | Fede, 2026-11-12 |
| 13 (antes Q-3) | Pregunta: ¿se permite el contacto de personas de la UE (RGPD)? Respuesta literal de Fede: «Permitirlo con aviso en la verificación manual». Texto del coordinador, no de Fede: no hay interruptor por empresa (el aviso es la única barrera). Riesgo aceptado: ver 7.2 | Fede, 2026-11-12 |
| 14 (antes Q-4) | Pregunta: ¿se hace revisión legal (consentimiento en transcripciones y grabaciones públicas; uso de registros públicos)? Respuesta literal de Fede: «Sin acción legal por ahora». Recomendación del coordinador, no de Fede: una revisión legal antes de los conectores de registros públicos (SDD 5 en adelante); la decisión sigue siendo de Fede. Riesgo abierto aceptado: ver 7.2 | Fede, 2026-11-12 |
| 15 (antes Q-5) | Pregunta: alcance de la tanda 0 y coste de IA. Respuestas de Fede: la tanda 0 se abre a **todas las empresas** y, para el coste de IA, «Solo registrar el coste, sin freno» (frente a contarlo contra `org_budgets` y frente a limitar a solo bajo demanda). Sin tope y sin cifra inventada. Riesgo aceptado: ver 7.2 | Fede, 2026-11-12 |
| 16 (antes Q-6 y Q-7, LinkedIn) | Pregunta: ¿aplican a NOKKO las reglas de la organización Postin sobre LinkedIn («solo API oficial», no analizar ni puntuar perfiles)? Respuesta literal de Fede: «Esas reglas no aplican a NOKKO; tu respuesta cierra D2 (Recommended)». Consecuencia: las reglas de Postin no aplican a las recetas de NOKKO. Lo que sigue vigente (regla de redacción del molde, 6.1): una receta nunca se presenta como análisis o puntuación de personas | Fede, 2026-11-13 |
| 17 (antes Q-7, D2) | Misma respuesta de Fede que la decisión 16, leída sobre la decisión 12: «tu respuesta cierra D2 (Recommended)». Consecuencia: la **D2** de `PRD-20261110-diagnostico-y-equipos-de-plays.md` queda **cerrada por esta decisión**. Los seis plays del catálogo con `blockedBy: "linkedin_d2"` **siguen bloqueados** hasta que un SDD los construya; nada se desbloquea solo | Fede, 2026-11-13 |
| 18 (antes Q-8, R-3) | Pregunta: R-3 tal como se confirmó no es viable; ¿aceptas el ajuste del coordinador (6.4) o bajas R-3 a la tanda 1? Respuesta literal de Fede: «Sí, R-3 ajustada (Recommended)». Consecuencia: R-3 ajustada entra en la tanda 0 con fuentes que existen y entrega la señal y la cuenta, no a la persona del foro | Fede, 2026-11-13 |
| 19 (antes Q-9, etiqueta) | Pregunta: la etiqueta «De la biblioteca» se parece a «Biblioteca de jugadas» y «Biblioteca de playbooks»; ¿la cambiamos? Respuesta literal de Fede: «De NOKKO / Creado para tu empresa (Recommended)». Consecuencia: etiquetas de origen **«De NOKKO»** y **«Creado para tu empresa»**; sustituyen a «De la biblioteca» de la decisión 8 | Fede, 2026-11-13 |
| 20 (antes Q-10, alcance) | Pregunta: ¿se acepta que el motor de ejecución amplíe la tanda 0 de tres a cuatro SDD? Respuesta literal de Fede: «Sí, 4 SDD en la tanda 0 (Recommended)». Consecuencia: la tanda 0 tiene 4 SDD, incluido el motor de ejecución | Fede, 2026-11-13 |
| 21 (antes Q-11, retención) | Pregunta: ¿qué retención tiene la cadena de evidencia con datos personales públicos y quién puede pedir su borrado? Respuesta literal de Fede: «Mientras el play exista y borrado a petición (Recommended)». Consecuencia: la evidencia se guarda mientras el play exista y se borra con el play, con la empresa o a petición; el SDD 1 solo puede añadir un plazo si lo justifica | Fede, 2026-11-13 |

**Decisiones de diseño que propone este PRD** (Fede las confirma al aprobar; no están decididas):
| # | Tema | Propuesta |
|---|---|---|
| P-1 | Término interno | «Molde» es solo un término de ingeniería para la estructura común; en la interfaz no existe (decisión 8) |
| P-2 | Los 28 plays existentes | Se quedan como están en `catalog.ts` y se muestran con la etiqueta «De NOKKO» (decisiones 8 y 19). Las 3 recetas de la tanda 0 se escriben con el molde nuevo, se muestran también como «De NOKKO», pero **viven en la tabla nueva** (C-9), no en `catalog.ts` ni en `play_states`. Nada se migra |
| P-3 | Estado de un play del molde nuevo (receta o a medida) | En la tabla nueva (con `origen` = `biblioteca` o `a_medida`, C-9) solo existen: aprobado, activo, pausado y archivado. «Propuesto» y «descartado» viven solo en `agent_pending_actions` (`pending` y `cancelled`): confirmar la acción crea la fila (aprobado); cancelarla no crea nada. «Bloqueado» no se guarda: se calcula con la comprobación de fuentes. Activar y pausar son del motor (SDD 4), también para R-1 a R-3: `checkToggle` solo acepta un `Play` del catálogo con puertas en código (`status.ts:69-81`, `types.ts:9-12`), así que se necesita una versión para el molde nuevo que reutilice `canTogglePlays` y la comprobación de fuentes. Una receta de la biblioteca es una **plantilla**: activarla crea la fila en la tabla nueva con `origen = biblioteca` y los parámetros de la empresa |
| P-4 | Estado de los del catálogo | Los 28 siguen en `play_states` (por `play_id`) y con `checkToggle`. Los del molde nuevo **no** escriben en `play_states`. Como `play_states.play_id` no tiene CHECK (0077:2), el SDD 1 **debe impedir mezclar identificadores** (por ejemplo, un prefijo reservado para los del molde nuevo con una prueba que lo verifique, o un espacio de ids aparte) |
| P-5 | Cómo se mide G-2 | Con `agent_pending_actions` (`tool` de la propuesta), igual que la medida de G-1 del PRD de diagnóstico (decisión 33), con el denominador y la definición de «aprobar» de G-2 |
| P-6 | Datos personales en la evidencia | **La cadena de evidencia puede contener datos de una persona identificable** (una reseña o publicación citada). Regla: guardar el mínimo (URL de la fuente, fecha observada, fecha del evento, cita corta con tope de longitud), **sin datos de contacto en la fila de evidencia** (el contacto sigue en las tablas de contactos que ya existen), retención «mientras el play exista» y borrado con el play, con la empresa o a petición (decisión 21), **incluidas las copias** (7), y nunca en logs. Detalle en 7 |
| P-7 | Etiqueta de origen | La decisión 8 fijó «De la biblioteca» y «Creado para tu empresa». «De la biblioteca» se parecía a «Biblioteca de jugadas de Nokko» (`components/hub/hub-screen.tsx:321`) y «Biblioteca de playbooks» (`inngest/events.ts:51`), que son los guiones de venta, no estos plays. Fede decidió **«De NOKKO»** y **«Creado para tu empresa»** (decisión 19) |

**Decisiones del coordinador** (el coordinador las toma para corregir el gate de las pasadas 1 y 2. **Ninguna anula las decisiones 1 a 21 de Fede**, que siguen tal como él las dio; Fede las confirma o las revierte al aprobar):
| # | Tema | Decisión del coordinador | Por qué (gate) |
|---|---|---|---|
| C-1 | Qué es «fuente conectada» | Se redefine como: la fuente está **disponible en la plataforma** (`connectedServices()`) **y** figura en un **registro en código** de lo que NOKKO sabe leer, con la herramienta que la lee (6.2); y, solo donde existe por empresa (PostHog), **conectada en esa empresa**. Una receta cuya fuente la plataforma no tiene queda `bloqueado` por fuente externa con el motivo (decisión 3, sin cambio). No se crea una tabla de conexiones por empresa; si hiciera falta, es un SDD aparte | M-1: `connectedServices()` no recibe empresa y `integrations` no tiene `org_id`; la premisa «por empresa» era falsa |
| C-2 | Coste (G-7) | G-7 pasa a «instrumentar y registrar el coste de cada propuesta y ejecución». Solo registrar: un fallo del registro **no bloquea** guardar la propuesta (Fede: «solo registrar, sin freno»). Se retira la afirmación de que se puede medir con las tablas actuales (6.5) | M-2 |
| C-3 | Alguien ejecuta | Se añade a la tanda 0 un SDD «Motor de ejecución de plays a medida» (SDD 4). **Es una consecuencia de alcance de las decisiones de Fede, no una decisión nueva suya**: sin ejecutor, un play guardado no hace nada. Amplía el tamaño de la tanda 0 (ver 8) | M-3 |
| C-4 | Frescura | La ventana se aplica a la fecha del **evento o de publicación**, no a la de lectura (6.1) | M-4 |
| C-5 | Viabilidad de las recetas | R-1 y R-2 se apoyan en los competidores que la empresa ya declara y en fuentes públicas sobre ellos. R-3 se **ajusta por inviabilidad verificada** (6.4). Fede respondió «Las tres (Recommended)» (decisión 11): el texto original de R-3 sigue visible en 6.4 y Fede aceptó el ajuste: «Sí, R-3 ajustada (Recommended)» (decisión 18) | M-5 |
| C-6 | Datos personales en la evidencia | Se sustituye la afirmación de que la evidencia no guarda datos de personas por una regla de minimización, retención y borrado (6.1, P-6, 7) | M-6 |
| C-7 | Decisión 12 | Registrada literal. El choque con D2 y con las reglas de Postin lo resolvió Fede el 2026-11-13 (decisiones 16 y 17) | M-7 |
| C-8 | Etiqueta de origen | Se propuso una etiqueta que no choque con «Biblioteca de jugadas» ni «Biblioteca de playbooks» (P-7). Fede la aceptó (decisión 19) | m-7 |
| C-9 | Dónde viven el estado y la activación de R-1 a R-3 | Las recetas construidas con el molde nuevo viven en la **tabla nueva por empresa** (con `origen = biblioteca`) y las activa y pausa el motor de ejecución (SDD 4). **No** usan `play_states`, cuyo `checkToggle` solo acepta puertas en código. `play_states` queda para los 28 del catálogo. G-1 y G-3 cuentan **las dos fuentes** de forma explícita. El SDD 1 debe impedir mezclar ids (P-4) | Gate pasada 2, N-1 |
| C-10 | Registro de fuentes | Fija quién lo mantiene, su relación con `CAPABILITIES`/`Need`, la regla de fuentes compuestas y el caso de PostHog y de Drive (6.2) | Gate pasada 2, m-A y m-B |
| C-11 | Evidencia y borrado | La regla de borrado alcanza a las copias derivadas de la cita (7) | Gate pasada 2, m-F |

### 6.1 Qué define el molde (lo nuevo que falta)
Todo se valida con código puro antes de guardar. La IA solo propone; el código acepta o rechaza con el motivo en palabras.

| Parte del molde | Regla que debe cumplir |
|---|---|
| **Disparador** | Un evento verificable en una fuente nombrada, no un segmento |
| **Ventana de frescura** | **Obligatoria**: un número de días positivo. Si falta, el play no se guarda. **Se aplica a la fecha del evento o de publicación, nunca a la fecha de lectura**: un anuncio de hace dos años leído hoy no pasa. Si la fecha del evento es desconocida, no pasa (reutiliza el motor de puertas: un dato desconocido nunca pasa, `gates.ts:4,14-19`). Una señal fuera de la ventana se descarta con el motivo |
| **Pasos de evidencia** | Cada paso numerado declara una fuente (de una lista cerrada), qué pregunta y qué dato devuelve. Cada hecho guarda: número de paso, fuente, URL, **fecha observada** (cuándo lo leyó NOKKO), **fecha del evento** y **de dónde sale esa fecha** (dato de la fuente, fecha visible en la página, o desconocida) y una cita corta con tope de longitud. Sin datos de contacto en la fila (P-6) |
| **Entregable de una página** | Un borrador de un tipo nuevo («página») que se construye antes del contacto. Sigue siendo borrador: no se publica ni se envía. Lo crea el motor de ejecución (SDD 4) |
| **Verificación manual** | Lista explícita de comprobaciones que una persona hace antes de usar el borrador, con los riesgos concretos de ese play. Sin ella, no se puede activar |
| **Contacto** | Quién y por qué canal, resuelto con Clay o Apollo si el play lo pide; si no hay contacto, se dice «sin dato» |
| **Mensaje citado** | Tres bloques: hechos con su número de paso, lo construido para esa persona, una petición pequeña. Cada afirmación cita un paso que existe y entra en la ventana. Se rechaza el borrador que no cumple |
| **Diseño de prueba** | Muestra (n), éxito (k) y base. Se **rechaza** si la base no es la muestra, si k > n, si k es 0 o si falta cualquiera de los tres. Se declara antes de enviar. Sin cifras por defecto: las pone la empresa |
| **Parámetros por empresa** | Zona, oficio, competidores declarados y umbrales (n y k) como campos con tipo y rango, no un jsonb libre. Viven en la tabla nueva (C-9), no en `play_states.settings` |
| **Comprobación de fuentes** | Cada fuente de los pasos se contrasta con (a) el registro en código de lo que NOKKO sabe leer y la herramienta que lo lee, (b) su disponibilidad en la plataforma (`connectedServices()`, por entorno, igual para todas las empresas) y (c) solo para PostHog, la conexión de esa empresa (C-1). Reglas del registro en 6.2. Si falta una, el play queda `bloqueado` por fuente externa con el motivo (decisión 3); nunca se activa ni simula resultados. «Disponible» no garantiza saldo: si una llamada falla en la ejecución, el paso devuelve «sin dato» y se registra, no se rellena |
| **Salida** | Solo `suggestion`, `task` o `draft`. Nunca un envío automático |
| **Redacción** | La receta habla de una señal pública y de un motivo para escribir; nunca se presenta como análisis o puntuación de personas (decisiones 12 y 16) |
| **Aviso de UE** | Si el contacto es una persona de la UE, el paso de verificación manual incluye un aviso (decisión 13). No hay interruptor por empresa (texto del coordinador, no de Fede) |
| **Coste registrado** | Toda propuesta y toda ejecución intenta registrar sus tokens y su coste **por empresa**, con «sin dato» cuando el proveedor no lo devuelve. **El registro nunca bloquea**: si falla, la propuesta se guarda igual y el fallo se anota. No hay tope ni freno de IA en la tanda 0 (decisión 15) |
| **Puertas declarativas** | Las puertas del molde nuevo son datos con un formato cerrado (campo, operador, valor), interpretados por código puro; nunca código guardado. **Requisitos del SDD 1:** (a) una **lista cerrada de operadores** y una **lista cerrada de campos**, y los campos salen de lo que el registro de fuentes declara que devuelve cada paso; (b) qué hace un valor ausente: no pasa; (c) el intérprete **compila a `GateDef`** y reutiliza `runGates` y la regla «un dato desconocido nunca pasa» (`gates.ts:10-22`), con tests de tabla. El catálogo sigue con sus `GateDef` en código. Lo construyen los SDD 1 (formato, compilador y validación) y 4 (ejecución) |
| **Elegir cuentas** | Los competidores se **leen** de `account_plans.competitors` y `deals.lost_competitor` (para elegir cuentas) y de `positioning.competitive_alternative` (solo para saber **qué competidores vigilar**; es dato de la empresa, no de una cuenta). Son texto libre: el cruce con los nombres de cuentas se hace con las reglas de `src/lib/match.ts` (normalizar, avisar de casi-duplicados, nunca fusionar), no con igualdad exacta. Las tres columnas existen y pueden estar vacías (`deals.lost_competitor` es opcional): vacío = «sin dato» |

El diseño de prueba existe porque en el análisis 25 de 61 tests de Glider tenían muestra y base incoherentes (cifra de un resumen automático, confirmada en 2 páginas): aquí es una regla que el código aplica, no una convención.

### 6.2 Fuentes disponibles hoy y qué permiten
Comprobado en `src/lib/AGENTS.md` y `src/lib/agent/tools/` (lectura):
| Fuente | Qué hay | Límite relevante |
|---|---|---|
| Firecrawl | Lectura de páginas públicas y búsqueda (`firecrawl.ts`, `web-research.ts`); clave de plataforma `FIRECRAWL_API_KEY` | Solo URLs públicas |
| Perplexity | Solo `POST /search`, por pasarela gestionada (`perplexity.ts`); la fecha del resultado puede venir `null` | **No** admite chat ni investigación profunda: no sirve para preguntar a un buscador de IA y ver qué cita |
| Parallel | Búsqueda, tareas de investigación con citas y respuestas (`parallel.ts`, `parallel-gateway.ts`: solo `/v1/search`, `/v1/tasks/runs` y `/v1/responses`). No hay llamada de extracción | Ejecuciones largas en `research_runs`. El campo `technology` (`parallel.ts:258`) es enriquecimiento en texto libre, no detección de uso |
| Búsqueda web combinada | `searchBoth` (`web-search.ts:10-58`): en `main` @ d5e6a56 lanza **tres** búsquedas a la vez, Firecrawl, Perplexity y Parallel Search (esta última solo si se le pasan consultas y existe `PARALLEL_API_KEY`), y las fusiona sin duplicados. El gate describió dos porque `src/lib/AGENTS.md` aún dice «Firecrawl + Perplexity» en una línea y «tercera fuente» en otra: el código manda | Cualquiera puede fallar y las otras responden; `newsItems` puede dejar la fecha vacía |
| Apify | Cuatro robots: publicaciones de empresa y de persona en LinkedIn, ofertas de empleo, reseñas de G2 (`apify.ts`, `ACTORS`) | No hay robot de tiendas de apps; perfiles públicos de LinkedIn permitidos (decisión 12), con el riesgo de términos de uso de 7.2 |
| Clay y Apollo | Búsqueda y enriquecimiento de empresas y personas; revelado de contacto (escritura, gasta créditos) | Contacto en la UE permitido con aviso (decisión 13; riesgo en 7.2) |
| PostHog | Uso de producto por empresa, con clave del Owner | Solo para planes de producto |
| Google Drive | Carpeta «Nokko / empresa» | Solo lectura y escritura en esa carpeta |

**Respondido por el gate (pasadas 1 y 2) y verificado en `main`:** el estado «conectado» de Clay, Apollo, Parallel, Firecrawl, Perplexity, Apify y Drive **no es por empresa**: `connectedServices()` (`orchestrator/runner.ts:31-43`) mira variables de entorno y no recibe empresa. `integrations` **sí** tiene `org_id` y RLS (0002:96-99), pero su `status` es manual (`/integrations`, `integrations.tsx:125-131`) y **no prueba** que la fuente esté disponible: no se usa. Por eso la comprobación de fuentes usa un **registro en código** (fuente, herramienta que la lee, qué fecha de evento aporta) más PostHog por empresa (C-1). Lo ubica el SDD 1 como función pura sobre la lista de servicios disponibles.

**Requisitos del registro de fuentes para el SDD 1 (C-10):**
- **Quién lo mantiene:** el código, revisado en un SDD y con tests; nadie lo edita por empresa ni en datos.
- **Relación con `CAPABILITIES`/`Need`** (`orchestrator/planner.ts:17-28,51`): ya es el registro de qué servicio cubre cada necesidad y `AGENTS.md:39-40` exige que cada acción con integración pase por una `Need`. El SDD 1 debe **derivar el registro de fuentes de `CAPABILITIES`** o añadir una prueba que falle si se separan; no puede haber dos registros independientes.
- **Fuentes compuestas** (`searchBoth`: Firecrawl, Perplexity y Parallel Search): está **disponible si al menos uno** de sus tres proveedores lo está, y el paso **informa cuál usó**. Si solo hay uno, el resultado se marca con él.
- **Fuentes fuera de `connectedServices()`:** PostHog (no tiene entrada en `ENV`; se comprueba por empresa) y la carpeta de Drive por empresa (`drive_folders`, `AGENTS.md:30`; se comprueba por empresa). Cuentan como disponibles según su propia comprobación, no según `connectedServices()`.

### 6.3 Patrones de Glider frente a lo que NOKKO ya tiene
Los 12 patrones salen del análisis (§2.1, hechos suyos; la asignación a un patrón es opinión del analista). «Existente» = play del catálogo o regla proactiva de NOKKO.
| Patrón | Nº en Glider | Portabilidad (A/B/C) | Existente en NOKKO | Cabe en tanda 0 |
|---|---|---|---|---|
| P1 Contratación pública | 5 | 0 / 5 / 0 | `public-records-signals`, `public-filings-qualification` (bloqueados por decisión de GTM) | No: fuente por país sin verificar |
| P2 Caducidad u obligación regulatoria | 9 | 1 / 6 / 2 | `public-records-signals`. El detector `registration_expiring` es de registros de partners y no está relacionado | No |
| P3 Permiso, obra o inmueble | 7 | 0 / 5 / 2 | `public-records-signals`, `local-business-tam` | No |
| P4 Evento ambiental o desastre | 3 | 0 / 3 / 0 | Ninguno | No |
| P5 Presentación pública o concesión | 8 | 0 / 3 / 5 | `public-filings-qualification`, `funding-signal-scraping` (bloqueado por fuente externa) | No |
| P6 Sanción, recall o puntuación | 6 | 0 / 2 / 4 | `public-filings-qualification` | No |
| P7 Comercio e importación | 3 | 0 / 1 / 2 | Ninguno | No |
| P8 Fin de vida o desaparición de un proveedor | 5 | 4 / 1 / 0 | `tech-stack-signal-detection` (bloqueado) cubre cambios de tecnología de una cuenta, no la retirada de un producto | **Sí** |
| P9 Demanda expresada en reseñas, foros, medios | 7 | 7 / 0 / 0 | `review-site-intent-scoring` (bloqueado por proveedor de datos), `brand-mentions-monitoring` y `competitor-post-engagers` (LinkedIn, D2) | **Sí** |
| P10 Brecha de precio o de mercado | 5 | 1 / 3 / 1 | Ninguno | No |
| P11 Fuga por enlace roto | 3 | 3 / 0 / 0 | Ninguno | No: usa una herramienta de enlaces entrantes que NOKKO no tiene |
| P12 Emparejamiento de excedente con demanda | 2 | 1 / 1 / 0 | Ninguno | No |
La señal de contratación (`hiring-signal-monitoring`, bloqueado por D2) no es un patrón propio en el análisis, sino una señal secundaria que aparece en 9 plays.

### 6.4 Las tres recetas de la tanda 0 (propuesta, corregida tras el gate)
Criterio: grado A, fuentes que NOKKO ya tiene hoy, sin registro oficial, sin conectores nuevos, **y con una forma de elegir a quién escribir que funcione con datos que NOKKO ya guarda**. El gate (M-5) comprobó que «cuentas del ICP que usan el competidor X» no existe: `tech-stack-signal-detection` está `bloqueado` por `proveedor_datos` precisamente porque falta «Tecnología de cada cuenta y sus altas y bajas» (`plays/catalog.ts:320-326`). Por eso las recetas parten de los **competidores que la empresa ya declara** (`positioning.competitive_alternative`, que dice **qué competidores vigilar**, no a qué cuenta escribir) y, para llegar a una cuenta, usan solo lo que NOKKO ya tiene: el campo de competidores del plan de cuenta (`account_plans.competitors`, solo si la cuenta tiene plan) y el competidor de los negocios perdidos (`deals.lost_competitor`, opcional). Son texto libre: el cruce usa las reglas de `src/lib/match.ts`. [Por verificar en el SDD 2] que esos campos se rellenan lo bastante para elegir cuentas. Si no hay cuenta o persona que se pueda hallar, la receta entrega **la señal como sugerencia a nivel de empresa** y dice «sin dato» en contacto; nunca la inventa. Los nombres son provisionales y propios; no usan los de Glider.
| # | Play propuesto | Patrón | Fuentes de NOKKO | A quién | Por qué entra |
|---|---|---|---|---|---|
| R-1 | Un competidor tuyo retira o deja de mantener un producto o plan | P8 | Firecrawl y búsqueda combinada (`searchBoth`: Firecrawl, Perplexity y Parallel Search) sobre documentación, registro de cambios y prensa **de los competidores declarados**; fecha del evento de la propia publicación | Cuentas ya registradas cuyo plan o negocio perdido nombra a ese competidor; Clay o Apollo para el contacto de esas cuentas. Sin ellas: sugerencia de empresa con contacto «sin dato» | La señal es pública y fechable, vale en cualquier idioma y mercado, y no necesita ningún conector nuevo |
| R-2 | Clientes de un competidor tuyo explican por qué se van o qué les falta | P9 | Apify (robot de reseñas de G2, `apify.ts:10`, `automation-lab~g2-scraper`; ya con `motivo_cambio`, `apify-core.ts:305`) y, para el contexto, Firecrawl/Perplexity sobre sus páginas públicas | Las reseñas son anónimas o sin contacto: **no se contacta al autor**. La señal («motivo de cambio más repetido») se entrega como argumento y se aplica a las cuentas ya registradas que nombran a ese competidor (igual que R-1). Sin ellas: sugerencia de empresa | Ya existen `competitor_reviews` y `create_battlecard_from_reviews` (`agent/tools/linkedin.ts:44,54`); la receta añade evidencia citada, verificación y prueba |
| R-3 (ajustada, decisión 18) | Una empresa o un rol describe en público un problema que tu producto resuelve | P9 | Búsqueda combinada y lectura de páginas con texto de **publicaciones que nombran a una empresa o a una persona por su nombre real** (medios, blogs de empresa, notas de prensa, páginas de comunidades con firma). Sin transcripciones (NOKKO no tiene fuente de transcripciones) | La empresa que lo escribe o es citada: se busca en las cuentas y por Clay o Apollo. **No se intenta identificar a usuarios con seudónimo en foros**: si quien lo escribe no se puede nombrar, la señal va como sugerencia de empresa con contacto «sin dato» | Es el patrón más amplio y se adapta a nichos; sin registro oficial |

**R-3 original, tal como se confirmó (decisión 11, «Las tres (Recommended)»), que se mantiene visible:** «Un problema que tu producto resuelve se describe en público. Fuentes: búsqueda combinada y lectura de páginas con texto (foros, comunidades, medios, transcripciones publicadas); Clay o Apollo.»
**Ajuste del coordinador por inviabilidad verificada, aceptado por Fede con «Sí, R-3 ajustada (Recommended)» (decisión 18):** se quitan las transcripciones publicadas (NOKKO no tiene ninguna fuente de transcripciones de YouTube ni de podcasts) y se deja de depender de identificar a quien escribe en un foro (quien lo hace suele usar seudónimo y Clay o Apollo no lo resuelven). R-3 ajustada entra en la tanda 0 con fuentes que existen y entrega la señal y la cuenta, no a la persona del foro. (Ya no aplica la alternativa de bajarla a la tanda 1.)
**Descartadas con motivo:** `ai-search-cites-competitors` (la pasarela de Perplexity solo admite `/search`; no se puede preguntar a un buscador de IA); `reviews-say-app-crashes` (no hay robot de tiendas de apps; leerlas con Firecrawl es [Por verificar]); `redesign-threw-away-backlinks` (necesita una herramienta de enlaces entrantes y de historial de webs que NOKKO no tiene); los dos basados en LinkedIn (no están entre las tres confirmadas, decisión 11; la decisión 12 los permite en principio y los seis plays del catálogo bloqueados por LinkedIn siguen bloqueados hasta que un SDD los construya, decisión 17).
**Límite de la tanda 0:** cada receta queda `bloqueada` **para todas las empresas a la vez** si la plataforma no tiene la fuente (por ejemplo, sin `APIFY_API_KEY` R-2 no corre; sin Clay ni Apollo, el contacto es «sin dato» y la receta entrega sugerencia de empresa). Es el comportamiento previsto (decisión 3 con C-1). Solo PostHog sería por empresa y ninguna de las tres lo usa. R-2 necesita una `Need` de reseñas que **hoy no existe** (`planner.ts:17-28`): la añade el SDD 2 (decisión de asignación en 8).

### 6.5 Qué registra hoy el código sobre coste (comprobado en `main` @ d5e6a56)
Esto sustituye la afirmación anterior de que G-7 se medía con `integration_usage`.
- `integration_usage` guarda `org_id, user_id, service, need, trigger, cost, created_at` (migración 0041): **no tiene tokens**. Sus escritores son `orchestrator/runner.ts:70` (`logUsage`, un coste **estimado** por servicio; también lo usa `onboarding.server.ts`) y `strategy-review-db.ts:90` (un coste fijo estimado, «Rough cost» en `strategy-review-core.ts:17`).
- Las llamadas de IA de `ask()` (`ai-gateway.ts`) y del agente (`agent/agent.server.ts`) **no registran coste ni tokens**.
- El único coste de IA **medido** está en `askPinned` (`ai-pinned.ts`), en USD, y puede ser `null` (no se estima nunca). Solo lo usa GTM Lab.
- Las ejecuciones de Apify por `apify-core` no escriben en `integration_usage`.
- Consecuencia: el registro de coste de propuestas y ejecuciones **es una pieza nueva** (SDD 3 y SDD 4). Debe guardar: moneda, tokens cuando existan, coste medido o «sin dato», servicio, empresa y a qué propuesta o ejecución pertenece, y también el gasto de los proveedores de los pasos. **Dónde vive: una tabla nueva de registro de coste, definida por el SDD 1 junto con las demás tablas nuevas (§7 y §8); el SDD 3 y el SDD 4 solo escriben en ella.** `trackedRun` (`orchestrator/runner.ts:313-317`) solo registra Firecrawl y Perplexity: no el Parallel de `searchBoth` ni Apify, así que el SDD 4 añade su registro de gasto. Un coste `null` se guarda como «sin dato» y la operación sigue.

## 7. Riesgos y dependencias
- **Calidad del análisis de origen:** lo resumió un modelo pequeño; los recuentos (17/30/16, 17 de 61, 25 de 61) son orden de magnitud. Nada de lo que construyamos depende de esas cifras; sí lo declaramos aquí.
- **Copiar por accidente:** el anexo contiene 59 hooks literales de Glider y frases de su marketing. El repositorio es privado (comprobado por el gate), pero el texto lo ven Lovable y los agentes que construyan el SDD 2. Requisitos: (1) el anexo lleva un aviso «solo análisis interno, no reutilizable» (puesto en este cambio); (2) **ningún agente lo mete en un prompt ni lo usa como fuente de títulos, hooks o mensajes**; (3) el SDD 2 incluye un **test automático anti-copia** que lee el anexo en tiempo de ejecución y compara cadenas literales con los títulos, hooks y mensajes de la biblioteca, **sin incrustar texto de Glider en el código ni en el test**: normaliza (minúsculas, sin acentos) y compara por huella o por solapamiento de fragmentos de palabras, como la prueba del gate (59 hooks frente a los 28 títulos del catálogo: 0 coincidencias exactas y solapamiento máximo 0, `prd-gate-pass1-nocopy-probe.mjs`). **Límites del test, que se declaran:** no detecta traducciones (el catálogo está en español y los hooks en inglés) ni paráfrasis; y no cubre los plays que la IA genere para una empresa, que son datos de ejecución y no código. Para esos, el control es la validación de la herramienta del asistente (rechaza un texto con coincidencia literal con el anexo) más la revisión humana de Fede al aprobar. [Por verificar] si el anexo debe salir del repositorio a Drive (`Postin Core`/NOKKO) cuando termine el SDD 2.
- **Coste de IA:** cada propuesta y cada ejecución gasta IA y, en R-2, saldo de Apify. Sin tope ni freno de IA en la tanda 0 y abierta a todas las empresas (decisión 15): el gasto de IA por empresa no está acotado. Los pasos con proveedor sí pasan por el runner y `org_budgets` pausa el trabajo automático al 100 % (no el manual). Detalle en 7.2 y 6.5.
- **Datos personales en la evidencia (corrige la primera redacción):** la cadena de evidencia **sí** puede guardar datos de una persona identificable (una reseña o una publicación con firma citada). El riesgo RGPD aceptado en la decisión 13 cubre el contacto, no esto; si Fede quiere otro tratamiento, lo decide. Regla propuesta (P-6): guardar el mínimo (URL, fecha observada, fecha del evento, cita corta con tope de longitud); sin nombre cuando no haga falta; sin datos de contacto en la fila de evidencia; **retención: mientras el play exista (decisión 21); el SDD 1 solo añade un plazo si lo justifica**; borrado al borrar el play, al borrar la empresa y a petición de la persona o de la empresa; nunca en logs (`safeErrorLog`, regla de `src/lib/AGENTS.md`). **Alcance del borrado (C-11):** la cita corta acaba también en el borrador «página», en el mensaje citado, en sugerencias o tareas, y puede acabar en `agent_messages` y en `agent_pending_actions.args`. La regla es: **al borrar o a petición, se borra la fila de evidencia y se elimina la cita de sus copias derivadas** (borrador, mensaje citado, sugerencia o tarea creados por el motor, y los argumentos de la acción pendiente), y se rastrea cada copia por el id de la evidencia. Lo que el motor no pueda rastrear (texto de una conversación ya escrita en `agent_messages`) **no queda cubierto** y se declara así en el SDD 1 y en la ayuda de la empresa; el motor no escribe citas en `agent_messages` cuando pueda evitarlo (referencia al id en su lugar) El mensaje y el contacto siguen tratando datos de personas y el contacto en la UE sigue sujeto al RGPD, permitido con aviso (decisión 13).
- **Fuentes que cambian o se prohíben:** una fuente puede cambiar de formato o de términos de uso. La comprobación de fuentes se ejecuta al activar y en cada ejecución (SDD 4), no solo al guardar.
- **La IA propone con la estrategia de la empresa:** si la estrategia está vacía, la propuesta es genérica. La herramienta debe negarse a proponer sin ICP y posicionamiento (reutiliza el estado de onboarding, `companyOnboardingStatus`, `onboarding.ts:288`).
- **Dependencias:** el diagnóstico de plays ya está en `main` (NK-0153, PR #134): no bloquea. NK-0156 (onboarding leído) va antes en la cola y alimenta la estrategia que lee la herramienta; NK-0167 (varias líneas de negocio) puede cambiar cómo se lee el arquetipo. El SDD 3 se redacta cuando NK-0156 y NK-0167 estén integrados o con ese riesgo declarado.
- **Migración, retroceso y borrado:** las tablas nuevas (plays a medida, cadena de evidencia, resultado de prueba, registro de coste) van en migraciones que **solo añaden**: no cambian columnas de tablas existentes salvo que un SDD lo justifique. Retroceso: borrar las tablas nuevas en orden inverso de dependencia pierde únicamente datos de plays a medida; el catálogo en código no se toca. Todas las filas llevan `org_id` con `ON DELETE CASCADE` desde `organizations`, como el resto de tablas de empresa, así que borrar una empresa borra sus plays, su evidencia y su registro. La evidencia se borra también con su play, con la empresa y a petición, con el alcance de copias de arriba. La numeración (la siguiente libre tras `0085`) se fija en el SDD 1 y se contrasta con otras ramas. Nunca se aplica a una base real desde la rama de implementación (patrón de `0077`).
- **Alcance de la tanda 0:** al añadir el motor de ejecución (C-3) la tanda 0 crece de tres a cuatro SDD y de «definir y guardar» a «definir, guardar y ejecutar». Es el precio de que un play a medida haga algo (ver 8).
- **Solo lectura hasta aquí:** no he ejecutado nada de lo descrito; el gate ejecutó los tests de los módulos citados (320 verdes, `d5e6a56`) y no abrió páginas de Glider.

### 7.1 Lo que NO se afirma
- No se afirma que los plays a medida convertirán mejor o peor que los actuales: sin datos de uso ni resultados de prueba.
- No se afirma que Glider funcione: ninguna de sus páginas da resultados reales, solo metas (según el análisis, que es un resumen automático).
- No se afirma que los equivalentes españoles o europeos de los registros de EE. UU. (PLACSP, TED, BORME, CNMV, Catastro, etc.) existan con la cobertura, el formato, el coste y los términos de uso necesarios. Son hipótesis del análisis, por verificar.
- No se afirma que un cliente real pueda usar Clay, Apollo, Apify, Firecrawl, Perplexity, Parallel o Drive **por su cuenta**: son de la plataforma (C-1). Se comprueba que NOKKO tiene la fuente, no que la empresa la haya contratado. Solo PostHog es de cada empresa y se comprueba al activar y en cada ejecución. `integrations.status` es una etiqueta manual y no prueba disponibilidad.
- No se afirma ninguna conclusión legal (RGPD, grabación de llamadas, uso de registros públicos, precios de reventa, paridad de tarifas): son avisos para revisar con un abogado.
- No se afirma qué coste de IA tendrá una propuesta ni qué tope conviene: se registra en la tanda 0 y el tope, si llega, se decide después. Tampoco se afirma que hoy exista medida de coste de IA por propuesta (6.5).
- No se afirma que la etiqueta de origen de los plays del catálogo tenga un número concreto al lanzar: en la tanda 0 son 28 existentes y 3 nuevos, y se confirma en el SDD 2.
- No se afirma la calidad de los datos de contacto de Clay o Apollo (Glider declara los suyos; tampoco los hemos verificado).
- No se afirma que los campos de competidores (`positioning.competitive_alternative`, `account_plans.competitors`, `deals.lost_competitor`) estén rellenos en ninguna empresa: sin dato.
- No se afirma que las reseñas de G2 o las páginas de un competidor traigan la fecha del evento: cuando falta, el dato no pasa la ventana.

### 7.2 Riesgos aceptados por Fede
Fede decidió estos puntos en la entrevista del 2026-11-12 y aceptó sus consecuencias. Se listan para que nadie las lea mal más adelante. No se suavizan ni se anulan aquí.

| Decisión | Qué se aceptó | Consecuencia que debe quedar clara |
|---|---|---|
| 12, 16 y 17 (LinkedIn) | «Sí, con las integraciones que ya usamos»; «Esas reglas no aplican a NOKKO; tu respuesta cierra D2 (Recommended)» | **Riesgo de términos de uso** de los proveedores y de LinkedIn al apoyarse en Apify y en los proveedores que ya se usan. D2 queda cerrada; los seis plays bloqueados por LinkedIn siguen bloqueados hasta que un SDD los construya |
| 13 (contacto UE, RGPD) | «Permitirlo con aviso en la verificación manual». Texto del coordinador: sin interruptor por empresa | **Riesgo RGPD:** NOKKO puede proponer contacto en frío a personas de la UE sin revisión legal previa y sin poder desactivarlo por empresa. El aviso es la única barrera |
| 14 (legal) | «Sin acción legal por ahora» | **Riesgo abierto aceptado:** consentimiento al usar transcripciones o grabaciones públicas, y uso de registros públicos sin revisión legal. Recomendación del coordinador (no de Fede): una revisión legal antes de los conectores de registros públicos (SDD 5 en adelante). Sigue siendo decisión de Fede |
| 15 (tanda 0 abierta y sin freno) | Tanda 0 abierta a todas las empresas; «Solo registrar el coste, sin freno» | **Gasto de IA sin tope por empresa en la tanda 0.** Una empresa puede generar propuestas sin límite. Para poder decidir el tope después, cada propuesta y ejecución **intenta** registrar su coste por empresa (G-7); el registro no bloquea. «Sin freno» es solo de IA: los pasos con proveedor siguen bajo `org_budgets` para el trabajo automático. No se inventa ningún tope. Sugerencia del coordinador (no decidida): `org_budgets` ya existe si Fede quiere un freno de IA más adelante |

### 7.3 Preguntas abiertas para Fede
Las Q-1 a Q-11 están todas respondidas (decisiones 11 a 21). **No queda ninguna pregunta abierta que bloquee.** Quedan dos [Por verificar] para los SDD, no para Fede: que los campos de competidores se rellenen lo bastante (SDD 2) y si la medida de G-2 basta con congelarse por periodo (SDD 3).

**Ticket aparte propuesto (fuera de este PRD):** `src/lib/AGENTS.md:29` dice «Firecrawl + Perplexity» para `searchBoth`, pero el código (`web-search.ts:1-3,27-54`) combina tres fuentes, como dice `AGENTS.md:34`. Corregir esa línea de documentación.

## 8. Orden de entrega
Cola: tras NK-0156 y antes de NK-0167 y NK-0168. Cada SDD se redacta uno a uno con `nokko-shape` cuando apruebes este PRD. **Tamaño de la tanda 0: cuatro SDD (el cuarto lo añade C-3), confirmado por Fede en la decisión 20.** Los SDD 1 y 2 no dependen del diagnóstico (que ya está en `main`).

| # | SDD (propuesto) | Tipo | Depende de | Cubre |
|---|---|---|---|---|
| 1 | `SDD-…-plays-a-medida-modelo`: tablas por empresa con RLS (migración), tipos del molde, formato declarativo de puertas, validación pura (frescura sobre la fecha del evento, evidencia citada, mensaje citado, diseño de prueba, parámetros, registro de fuentes (derivado de `CAPABILITIES`, 6.2) y comprobación de fuentes, regla de ids que impide mezclar con `play_states` (P-4), **tabla de registro de coste**, regla de minimización, retención y borrado de la evidencia con sus copias | Feature | — (revisar con NK-0156) | G-4, G-5 (función pura), G-6 (validación pura) |
| 2 | `SDD-…-plays-a-medida-biblioteca`: biblioteca de referencia en código y solo lectura, etiqueta de origen (P-7), 3 recetas R-1, R-2, R-3 con la selección de cuentas de 6.4 (cruce con `match.ts`), **la `Need` de reseñas que R-2 necesita** y que no existe hoy, test anti-copia (7; compara también los slugs y nombres del anexo, no solo los hooks) | Feature | 1 | G-5, G-6 (contenido de las recetas) |
| 3 | `SDD-…-plays-a-medida-asistente`: herramienta del asistente para proponer y guardar un play con aprobación (Owner y Sales Leader), lectura de la estrategia, **escribe el coste de cada propuesta** en la tabla del SDD 1 (no bloquea), medida de G-2 con su regla de conversaciones borradas | Feature | 1, 2; diagnóstico de plays (ya en `main`) | G-2, G-7 (propuestas) |
| 4 | `SDD-…-plays-a-medida-motor`: **motor de ejecución** que interpreta la receta validada (ejecuta los pasos por el runner, escribe la cadena de evidencia, crea el borrador «página» y el mensaje citado, registra el resultado de la prueba, activa y pausa un play a medida, aplica la comprobación de fuentes y la ventana en cada ejecución) y **registra el coste de cada ejecución**, incluido el gasto de Parallel y Apify que `trackedRun` no registra hoy, y el borrado de la evidencia con sus copias | Feature | 1, 2, 3 | **G-1** (activar es del motor), G-3, G-5 (en ejecución), G-6 (al guardar borradores), G-7 (ejecuciones) |
| 5+ | Un SDD por conector o vertical: registros oficiales por país (P1 a P7), precios (P10), enlaces rotos (P11), LinkedIn de personas, apps; y, si algún día hace falta, conexiones por empresa | Feature | Resultados de la tanda 0; revisión legal recomendada por el coordinador (decisión 14, riesgo aceptado en 7.2) | G-1 |

Orden dentro de la iniciativa: 1, luego 2, luego 3 y 4. No se lanzan 2, 3 ni 4 sin 1 (el molde y la validación son el contrato). Sin el 4 un play a medida se guarda pero no se ejecuta.

## 9. Aprobación
- [ ] Fede aprueba el PRD (primer GO de dirección), incluidas las propuestas P-1 a P-7, las decisiones del coordinador C-1 a C-11 y las tres recetas R-1 a R-3 (con el ajuste de R-3, ya aceptado, decisión 18). Fecha: {…}
- Al aprobar, el Estado pasa a «Aprobado». Después se redactan los SDD con `nokko-shape`.

## 9.1 Registro del gate
| Pasada | Resultado | Evidencia | Estado |
|---|---|---|---|
| 1 | FAIL (0 BLOCKER, 7 MAJOR, 9 MINOR) sobre `4f143c3` | `.factory/evidence/NK-0171/prd-gate-pass1.md` | pasada 1 FAIL → corregido en fa7a87f; pasada 2 FAIL → corregido en <sha>; pasada 3 pendiente |

Qué se hizo con cada hallazgo (el coordinador verificó cada uno contra `origin/main` @ d5e6a56):
| Hallazgo | Veredicto | Dónde se corrigió |
|---|---|---|
| M-1 fuentes por empresa | De acuerdo (`runner.ts:31-43`) | Decisión 3 intacta; C-1; G-5; 6.1; 6.2; 6.4; 7.1; 8 |
| M-2 G-7 no medible | De acuerdo (`integration_usage` sin tokens; `ask()` y agente sin registro; escritores solo `runner.ts:70` y `strategy-review-db.ts:90`) | G-7; 6.1 «Coste registrado» (no bloquea); 6.5; C-2 |
| M-3 nadie ejecuta | De acuerdo | C-3; SDD 4; G-3, G-5, G-6, G-7; Q-10; puertas declarativas en 6.1 |
| M-4 frescura | De acuerdo | 6.1 (fecha del evento, origen de la fecha, desconocida no pasa); G-6; C-4 |
| M-5 viabilidad R-1/R-2/R-3 | De acuerdo | 6.4 (selección desde competidores declarados; R-3 ajustada, texto original visible); C-5; Q-8 |
| M-6 evidencia con personas | De acuerdo | P-6; 7; C-6; Q-11 |
| M-7 decisión 12 | De acuerdo | Decisión 12 literal; 7.2; Q-6; Q-7; C-7 |
| m-1 diagnóstico en `main` | De acuerdo (`diagnosis.ts`, `play-diagnosis.ts`) | 3; 7; 8 |
| m-2 recuento | De acuerdo: 16 `bloqueado`, 11 `parcial`, 1 `planificado` (`catalog.ts`) | 1; 3 |
| m-3 cita | De acuerdo: `agent/tools/plays.ts:75` | 2 |
| m-4 Parallel y `searchBoth` | **Parcialmente en desacuerdo.** Parallel no tiene extracción: de acuerdo. Pero `web-search.ts` en `d5e6a56` sí combina **tres** fuentes (Firecrawl, Perplexity y Parallel Search); es `src/lib/AGENTS.md` el que se contradice. Se mantiene la descripción del código y se anota la contradicción de la documentación | 6.2; 6.4 (R-1) |
| m-5 medida de G-2 | De acuerdo | G-2; P-3; P-5 |
| m-6 alcance de «sin freno» | De acuerdo | 5; 7; 7.2; C-2 |
| m-7 vocabulario | De acuerdo | P-7; C-8; Q-9 |
| m-8 anexo | De acuerdo | 7 (test anti-copia y límites); aviso en el anexo. No se quitó la columna de hooks (decisión del coordinador: marcarlo) |
| m-9 preguntas y retroceso | De acuerdo | 7.3 (Q-6 a Q-11); 7 (retroceso y borrado) |

Pasada 2 (FAIL: 0 BLOCKER, 2 MAJOR, 9 MINOR, sobre `9fae689`; informe `.factory/evidence/NK-0171/prd-gate-pass2.md`):
| Hallazgo | Veredicto | Dónde se corrigió |
|---|---|---|
| N-1 dónde viven estado y activación de R-1 a R-3 | De acuerdo | C-9; P-2, P-3, P-4; G-1, G-3, G-5; 6.1 (parámetros); 8 (G-1 pasa al SDD 4) |
| N-2 decisiones 11, 13 y 14 no literales | De acuerdo: la cita «Confirmo las tres» no la dijo Fede | Decisiones 11 a 15 con la respuesta literal y el texto del coordinador separado y rotulado; 6.4 y 7.2 |
| m-A `integrations` sí tiene `org_id` | De acuerdo (0002:96-99) | 3; 6.2; 7.1: la conclusión de C-1 se mantiene (`status` manual, no prueba) |
| m-B registro de fuentes a medias | De acuerdo | 6.2 (quién, relación con `CAPABILITIES`, `searchBoth`, PostHog y Drive); C-10 |
| m-C puertas «cerradas» sin cerrar | De acuerdo | 6.1 (operadores y campos cerrados, compila a `GateDef`, reutiliza `runGates`) |
| m-D orden y cobertura de SDD | De acuerdo | 8 (G-1 al SDD 4; coste en una tabla del SDD 1; `Need` de reseñas en el SDD 2; gasto de Parallel y Apify en el SDD 4); 6.5 |
| m-E `competitive_alternative` no elige cuentas | De acuerdo | 6.1 «Elegir cuentas»; 6.4 (`match.ts`, columnas pueden estar vacías) |
| m-F borrado no alcanza a las copias | De acuerdo | 7 (alcance del borrado); P-6; C-11 |
| m-G G-2 pierde filas y `failed` | De acuerdo | G-2 |
| m-H G-1 «alguna vez» o «ahora» | De acuerdo | G-1 (activo al medir) |
| m-I referencias | De acuerdo (`apify.ts:7-8`; slugs en el test anti-copia) | 8 (SDD 2); la cita de perfiles queda en 6.2 como `apify.ts` sin línea |
| m-4 (pasada 1) `AGENTS.md:29` | El gate da la razón al coordinador en `searchBoth` | Ticket aparte propuesto (7.3), no en este PRD |

## 10. Relacionado
- **NK-0174 (bandeja de respuestas):** Fede eligió «Conectar Gmail u Outlook» (lectura del buzón por OAuth) frente a una dirección de reenvío y a un webhook (2026-11-12). Pertenece al PRD propio de NK-0174, no a esta iniciativa: aquí no se define alcance. La lectura del buzón por OAuth tiene peso de privacidad y permisos que ese PRD debe resolver: reglas de datos de clientes (ningún texto de cliente en logs, ningún dato de una empresa visible para otra) y permisos (scopes) mínimos.
