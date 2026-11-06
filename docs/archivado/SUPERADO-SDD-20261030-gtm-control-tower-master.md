# SDD-20261030-gtm-control-tower-master · [Feature] Torre de control GTM: de herramientas sueltas a objetivos con hilo conductor (documento maestro de la serie)

**Tipo:** Feature (épica) · **Prioridad propuesta:** Alta
**Estado:** Borrador · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-10-30
**PRD:** No aplica (la entrevista con Fede, 29-30 oct 2026, hace de PRD; sus decisiones están en el §6 y el anexo A) · **Depende de:** SDD-20261029-lovable-exit-a-rescate-y-datos y SDD-20261029-lovable-exit-b-servicios-y-corte (la construcción espera a que A y B estén cerrados) · **Coordinar con:** SDD-20261025-fit-data-7b-competitors-entity (borrador)

> Este es el documento maestro de una serie de nueve (este más ocho). Fija el problema, las decisiones de producto, el modelo conceptual, las reglas transversales, el orden y los riesgos. Cada SDD hijo baja a historias y criterios de aceptación. Su única historia (H-1) reúne las reglas transversales que todos los hijos cumplen.
> Los requisitos no nombran tecnología. Lo técnico va en el §13 como [Sugerencia — la revisión del gate las valida].

## 1. Resumen
Hoy Nokko es una colección de herramientas comerciales (cuentas, leads, pipeline, métricas, ciclo GTM, sugerencias) sin un objeto que las una. Se convierte en el sistema de gestión del go-to-market de un founder: **Objetivo → Resultado clave → Iniciativa → Tarea**, cada objetivo con su público, sus canales y sus puertas, una torre de control que dice si la estrategia se cumple, un agente que ayuda a pensarla, planificarla y seguirla, y el mercado vigilado de forma continua. Postin es el primer caso real.

## 2. Problema y para quién
- **Problema (palabras de Fede):** «veo muchas cosas sueltas pero nada que tenga un hilo conductor que sea cumplir un objetivo». No hay un lugar donde se defina qué se quiere conseguir, para qué público, por qué canales, y se vea cómo va, con tareas, plazos y hoja de ruta.
- **Para quién:** Fede (founder, uso diario), Flor (puesta en marcha, rol sales leader) y el Consejo (solo lectura). Dani no usa Nokko: sus dependencias salen como SDD.

## 3. Evidencia y por qué ahora
Fuentes leídas el 2026-10-30. Lo no comprobado va marcado.
- **Código de Nokko (repo `seller-strategy-studio`, solo lectura):**
  - Existe una tabla de tareas plana (título, responsable, fecha, hecha o no) con vínculo opcional a cuenta o deal, y no hay concepto de objetivo: solo aparece un campo de texto suelto llamado «objectives». (`src/integrations/supabase/types.ts`).
  - Los experimentos (`gtm_experiments`), las metas por segmento (`segment_targets`) y las sugerencias no cuelgan de ningún objetivo.
  - El Ciclo GTM (`/cycle`) ya es una espina de fases con documentos aprobados (`gtm_artifacts`), pero el Plan es texto sin objetivos medibles ni tareas.
  - Leads, deals, personas y pruebas tienen un campo `source` de texto libre y `segment_id`; no hay canal como entidad (`src/integrations/supabase/types.ts`).
  - El agente tiene unas 100 herramientas de CRM y personas (Reid, Benioff, Ruth, Melanie…) (`src/lib/agent/tools/`, `src/lib/bmad/personas.ts`).
  - El cifrado de credenciales existe (`src/lib/secret-box.server.ts`) pero la conexión de cuentas propias declara que el almacén «no existe hasta que Dani lo diseñe» (`src/lib/connections-core.ts`).
- **Postin Core (Drive, solo lectura):** F0-01 v6.3 (objetivo de 10.000 € de MRR a 12 meses desde la salida a producción, 10 h/semana de captación (fuente: F0-01 v6.3), puertas de días 14 y 30), ICP-00 v2.4 (cuatro ICP en hipótesis, regla de no gastar en hipótesis, caducidad de 6 meses), F0-11 v1.2 (motor de captación, API oficial de LinkedIn sin herramientas de terceros), «Proceso de venta — guiones y puesta en marcha (oct 2026)» y el log del radar de marca personal.
- **Entrevista con Fede (2026-10-29/30):** decisiones del §6 y anexo A.
- **Uso real de Nokko por Fede o Flor:** **sin dato.** [Por verificar] contra datos de producción antes de decidir qué pantallas retirar.

## 4. Resultado buscado
Las tres señales de éxito que definió Fede. Línea base: **sin dato** (no se ha medido).

| Señal | Cómo se mide | Fuente |
|---|---|---|
| Fede deja de usar otras herramientas para planificar | Declarada por Fede en la revisión de cada fase | Fede (no instrumentable) |
| El check-in semanal le lleva menos de 10 minutos | Tiempo desde que abre el check-in hasta que lo cierra | Instrumentación propia de Nokko [Por verificar si se implementa o se declara] |
| Las puertas se evalúan solas con datos | Cada puerta muestra su valor calculado y si cumple, y Fede solo confirma | Estado de las puertas en Nokko |

Señal operativa de la serie: **ninguna tarea activa existe sin pertenecer a una iniciativa de un objetivo** (cero tareas huérfanas, salvo las del legado archivado).

## 5. Alcance
**Incluye (la serie completa):**
- El modelo Objetivo → Resultado clave → Iniciativa → Tarea (con subtareas y dependencias), públicos, canales, puertas y registro de decisiones.
- Torre de control en Objetivos y resumen en Inicio; hoja de ruta, lista de tareas y vista del Consejo con informe exportable.
- Contexto estratégico y onboarding por bloques con nivel de confianza; caducidad por tipo de dato; ajustes de empresa; importación de documentos MD y CSV.
- Atribución obligatoria de canal y público, dos embudos por modelo de venta, diccionario de métricas.
- Integraciones: Stripe, base de datos de Postin (vistas agregadas), PostHog, Calendar, Gmail (solo borradores), transcripciones, avisos, Sales Navigator por CSV, proveedores de investigación, Drive y servidor para asistentes.
- Agente único con modos, panel lateral, memoria editable, proactividad y check-in semanal.
- Mercado: alternativas y competidores, señales, integración del radar.
- Retirada de la lectura de LinkedIn por extracción automática de páginas.
- Roles nuevos (Consejo, solo lectura), auditoría, activación por fases con bandera por empresa.

**No incluye:**
- Sincronización con Plane u otra herramienta de tareas (las tareas viven solo en Nokko).
- Envío automático de mensajes a terceros, publicación o gasto sin aprobación humana.
- Lectura o análisis de perfiles de LinkedIn por extracción automática de páginas; Nokko nunca valora perfiles.
- Cambios en el cobro o la facturación de Postin (billing), ni en el producto Postin.
- Onboarding genérico para empresas de terceros (Postin es el primer caso; lo genérico se evalúa después).
- Borrar datos existentes: lo anterior se archiva.
- Cualquier cambio en Drive sin OK explícito de Fede.
- Tope de gasto en proveedores o IA (se muestra el gasto, sin bloquear).

## 6. Cambios de comportamiento (delta)
**Añadido:**
- Objetivos con estados (borrador, activo, pausado, cerrado, archivado), resultados clave numéricos (valor inicial, meta, fecha, fuente), iniciativas, tareas con subtareas, dependencias, ejecutor y horas.
- Públicos reutilizables con nivel de evidencia; canales con playbook, coste y resultados; puertas; registro de decisiones con ID; alternativas y competidores; señales de mercado; diccionario de métricas; memoria por objetivo; auditoría.
- Rol de solo lectura para el Consejo.
- Torre de control en Objetivos; resumen en Inicio; Plan (lista, detalle, hoja de ruta); Mercado; vista y PDF para el Consejo; runway y gatillo de continuidad como indicadores de empresa.
- Check-in semanal preparado por el agente e ideas proactivas (máximo 3 por semana).

**Modificado (antes → después):**
- Menú: Inicio, Sugerencias, Cuentas, Leads, Pipeline, Personas, Estrategia GTM, Métricas + «Más herramientas» → Inicio, Objetivos, Plan, Mercado, Comercial (Cuentas, Leads, Pipeline, Personas) y Métricas; el resto en Herramientas y Ajustes.
- Inicio: panel de pipeline y deals en riesgo → chat con resumen (titular que es una conclusión, una línea por objetivo, decisiones pendientes).
- Agente: personas distintas → un agente con modos, panel lateral contextual y ⌘K.
- Setup y medidor: ocho ítems de organización comercial → cuatro bloques con nivel de confianza por dato.
- Diagnóstico GTM: un solo modelo de venta → punto de partida que admite dos a la vez.
- Leads, cuentas, pruebas y deals: origen en texto libre → canal y público obligatorios desde listas controladas; el objetivo se deriva.
- Embudo de leads (Nuevo, Contactado, MQL, SQL, Oportunidad) → dos embudos por modelo de venta (asistida y autoservicio) que convergen en prueba → activa → publicó → de pago.
- Configuración de CRM (etapas, plazos de leads, cuotas por AE, reglas de asignación): sale del onboarding y se oculta en Ajustes avanzados, sin borrarse.
- Sugerencias: bandeja con tarjetas independientes → propuestas del agente ligadas a un objetivo, con el mazo de gestos para aceptarlas o descartarlas.

**Eliminado:**
- La lectura por extracción automática de páginas de posts y ofertas de empleo de LinkedIn (cumple la regla de API oficial).
- Las personas del agente como entrada de usuario (sus herramientas útiles se conservan).
- **Nada se borra de la base de datos:** las pantallas y datos de CRM anteriores se archivan o se ocultan.

## 7. Historias y criterios de aceptación

### H-1: Como Fede, quiero que toda la serie cumpla las mismas reglas para que el sistema sea coherente, seguro y no invente datos.
Estos criterios aplican a todos los SDD hijos (en ellos se citan como «maestro CA-n»).
- CA-1: El sistema DEBE mostrar, junto a cada cifra de negocio, su fuente y su antigüedad; si no hay fuente, DEBE mostrar «Sin dato» y no un valor.
- CA-2: El sistema DEBE tratar como propuesta pendiente de aprobación humana toda acción que salga al exterior (publicar, enviar, contactar a terceros, gastar), sin excepción por canal.
- CA-3: El sistema DEBE permitir que el agente cree sin aprobación únicamente elementos internos (investigar, borradores, tareas, sugerencias) y DEBE registrar que los creó el agente.
- CA-4: El sistema DEBE excluir los nombres de persona y de empresa de las fichas de conversaciones; el Consejo y el agente solo DEBEN ver agregados y citas anonimizadas.
- CA-5: El sistema DEBE obtener datos de LinkedIn únicamente por la API oficial, y DEBE abstenerse de extraer o valorar perfiles por otros medios, incluidas herramientas de terceros.
- CA-6: CUANDO una fuente de datos falle o esté desactualizada, el sistema DEBE mostrar el último valor con su antigüedad y estado neutro («Sin dato reciente»), y NO DEBE inventar ni suponer un valor.
- CA-7: El sistema DEBE archivar, y NO borrar, los datos que una fase deje de usar.
- CA-8: El sistema DEBE mostrar todos los textos en español, de «tú», con estados escritos en palabra y sin iconos, y los errores con «qué pasó y qué hacer».
- CA-9: MIENTRAS una empresa no tenga activada una fase, el sistema DEBE mostrarle el comportamiento anterior sin cambios.
- CA-10: El sistema DEBE separar los datos de cada empresa: ninguna empresa DEBE ver datos de otra.

## 8. Casos límite transversales
- Una fuente (Stripe, base de datos, PostHog) no existe todavía o falla → resultado clave en entrada manual, marcado como manual (CA-1, CA-6).
- Un objetivo se pausa o se cierra con tareas abiertas → las tareas pasan a archivadas con su motivo y no se pierden.
- Un cambio sobre algo ratificado → versión nueva marcada «modificado tras ratificación» (detalle en SDD-1).
- Dos personas editan lo mismo a la vez → gana la última confirmada y se avisa a la otra de que su cambio se perdió (patrón de combinación de ediciones ya existente).
- Una empresa nueva sin información → el onboarding por bloques (SDD-2) guía el primer objetivo.
- Datos antiguos en estados que ya no existen (MQL, SQL…) → se conservan visibles en el legado con su etiqueta original.

## 9. Experiencia y copy
Se mantiene el sistema visual actual: Ink + Lima, Space Grotesk y DM Sans, estados con una palabra en versalitas con un filete de color, titulares que son conclusiones calculadas, sin iconos. Principios nuevos (detalle en SDD-1 y SDD-5):
- Inicio = chat + resumen; la torre completa vive en Objetivos.
- El avance de un resultado clave se muestra como barra con valor inicial, actual, meta y marcador del ritmo esperado hoy. Estados: En ritmo, Atención, En riesgo, Sin dato.
- Hoja de ruta: línea de tiempo trimestral con una fila por objetivo; iniciativas como barras; puertas, hitos y plazos como marcadores.
- Móvil: barra inferior con Inicio, Plan, Agente y Decisiones.

## 10. Datos, permisos y privacidad
**Conceptos de datos nuevos** (los nombres de tablas son decisión de Dani/gate): Objetivo, Resultado clave, Iniciativa, Tarea (con subtarea y dependencia), Público, Canal, Alternativa/competidor, Puerta, Decisión, Señal, Memoria, Entrada de auditoría, Definición de métrica.

**Roles:**
| Rol | Qué puede |
|---|---|
| Owner (Fede) | Todo: editar, ratificar, conectar integraciones, ver auditoría |
| Sales leader (Flor) | Editar información estratégica y tareas directamente; ver cuentas en prueba; sin conectar integraciones de empresa ni ratificar |
| Consejo (rol nuevo) | Solo lectura de objetivos, puertas, decisiones, resultados y runway; sin cuentas, personas, fichas ni conversaciones; puede comentar; no ratifica |

**Privacidad:** fichas sin nombres; el Consejo recibe resúmenes sin textos literales; la base legacy entra solo como cifras agregadas hasta confirmar la base legal (la SL está en constitución) [Por verificar]; ningún dato de clientes en pruebas, fixtures, código ni logs.

## 11. Llamadas a IA
| Llamada | Orden de preferencia | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| Borrador de plan de un objetivo | regla → modelo barato → modelo caro solo en «A fondo» | [Por verificar en SDD-5] | sin dato |
| Check-in semanal | regla (cálculo del avance) → modelo barato (redacción y causa probable) | [Por verificar en SDD-5] | sin dato |
| Vigilancia semanal de mercado | regla (detección de cambios) → modelo barato (resumen) | [Por verificar en SDD-6] | sin dato |
| Ideas proactivas (máx. 3/semana) | modelo barato con evidencia citada | [Por verificar en SDD-5] | sin dato |

Cada SDD hijo declara las suyas; una llamada no declarada no se implementa. El gasto se muestra por proveedor y objetivo sin bloquear.

## 12. Serie de SDD y unidades de trabajo
| # | SDD hijo | Qué entrega | Depende de |
|---|---|---|---|
| 0 | Este maestro | Reglas, modelo, orden y riesgos | — |
| 1 | `…-1-objectives-tasks-home` | Objetivos, resultados clave, iniciativas, tareas, puertas, decisiones, torre en Objetivos, resumen en Inicio, menú, roles, auditoría y bandera por empresa | Salida de Lovable A y B |
| 2 | `…-2-context-onboarding` | Contexto estratégico y onboarding por bloques, nivel de confianza, caducidad, importación MD/CSV, ajustes | 1 |
| 3 | `…-3-attribution-metrics` | Canal y público obligatorios, embudos por modelo de venta, diccionario de métricas, etapa «publicó» | 1, 2 |
| 4 | `…-4-integrations` | Stripe, PostHog, Calendar, Gmail (borradores), transcripciones, avisos, Drive, Sales Navigator CSV, proveedores y saneamiento de LinkedIn | 1, 8 |
| 5 | `…-5-agent` | Agente único con modos, panel lateral, memoria, proactividad y check-in | 1, 3 |
| 6 | `…-6-market-competition` | Alternativas, competidores, señales, radar, vigilancia | 1, 5; coordinar con 7b |
| 7 | `…-7-board-finance` | Vista y PDF del Consejo, runway y gatillo de continuidad | 1, 4 |
| 8 | `…-8-postin-db-views` (para Dani) | Vistas agregadas de solo lectura de la base de datos de Postin | — |

**Orden de entrega recomendado:** 1 → 2 → 3 → (8 en paralelo, lo pide Dani) → 4 → 5 → 6 → 7.

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- Reutilizar: tabla de tareas y `gtm_experiments` (extender, no duplicar), `segment_targets` (metas por público), motor de sugerencias y `agent_pending_actions` (aprobación humana), `background_jobs` (tareas de fondo), `secret-box.server.ts` (credenciales), `finance_settings` (caja inicial, horizonte, escenarios: el esquema existe y la previsión de caja está pendiente en el roadmap), `notifications` y preferencias de avisos, `mergeServerEdits` (ediciones concurrentes), `provenance.ts` (origen del dato) y `headlines.ts` (titulares como conclusiones).
- Migraciones nuevas en `drizzle/migrations`, aditivas, con `org_id` por defecto `current_org()`, políticas por empresa y GRANTs; no cambiar migraciones aplicadas. Rol del Consejo: probar la seguridad con dos empresas ficticias.
- La bandera por empresa permite activar fase a fase (CA-9).
- Retirar la lectura de LinkedIn por Apify (`linkedin_company_posts`, `linkedin_profile_posts`, `company_job_postings`) en SDD-4.
- Alternativas descartadas: almacén gestionado de credenciales (retrasa las integraciones y depende de Dani; queda como evolución), sincronización con Plane (decisión explícita de Fede).

## 14. Riesgos y dependencias
- **Salida de Lovable (A y B):** la construcción espera; cambios de esquema antes pueden chocar con la migración de datos y servicios.
- **Alcance:** nueve documentos. Se mitiga entregando por fases con bandera por empresa y revisando tras cada una las señales de éxito (§4).
- **Clave única de cifrado:** rotar `INTEGRATION_KEYS_SECRET` obliga a reconectar todas las integraciones.
- **Billing de Postin:** si no existe, el MRR solo entra como dato manual marcado; el resultado clave de ingresos nace con poca automatización.
- **Edición directa por Flor sobre lo ratificado:** mitigada con versión nueva y marca «modificado tras ratificación».
- **Dependencia de Dani:** vistas agregadas (SDD-8) y cualquier cambio de la base de datos de Postin.
- **Base legacy:** solo agregados hasta confirmar base legal.
- **Definición de «activada»:** Fede eligió «LinkedIn conectado y post creado», anterior a publicar; se añade «publicó» como etapa propia para no perder la señal de la caída de creado a publicado (ICP-00 §8). El proceso de venta de octubre la define como primer post publicado: hay que alinearlo (propuesta de cambio en Drive, sin ejecutar).
- **Inicio como chat:** Fede lo eligió; para no perder la torre de control, esta vive en Objetivos.

## 15. Preguntas para Fede y preguntas para Dani (revisión técnica)
- ¿Se instrumenta el tiempo del check-in o se declara? (afecta a §4).
- Para Dani/gate: ¿el rol del Consejo se modela como rol por empresa nuevo o como permiso sobre vistas?
- Para el gate: orden de migraciones frente a Lovable A y B.

## 16. Pendiente de verificar
- Estado real de billing y Stripe en Postin → Dani.
- Lista de competidores directos de Postin → Fede (aún no existe).
- Resultados de las puertas ya vencidas → Fede.
- Herramienta de transcripciones de llamadas → Fede.
- Si el servidor MCP de Postin expone métricas agregadas o solo la cuenta del usuario → Dani.
- Uso real de las pantallas actuales de Nokko → datos de producción.
- Base legal para tratar la base legacy → Fede / asesoría.
- Alineación de «activada» entre este SDD y el proceso de venta de octubre → Fede.
- Instrumentación del tiempo del check-in → Fede/gate.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
- Veredicto del gate: No revisado
- CA sin prueba posible: pendiente · [Por verificar] sin comprobar: pendiente · Contradicciones con el código: pendiente
- Lo que esta revisión NO demuestra: pendiente

## 18. Delta de implementación (lo rellena el agente al entregar)
Sin entrega todavía.

---

## Anexo A. Decisiones de Fede (entrevista 2026-10-29/30)

| Tema | Decisión |
|---|---|
| Usuarios | Fede + agente; Flor (sales leader); Consejo (solo lectura). Dani sin acceso |
| Negocio | Postin primero |
| Arranque | Mezcla de tres entradas al mismo objeto Objetivo (escribirlo, entrevista guiada, desde los datos) |
| Autonomía | Por niveles: lo interno sin pedir permiso; lo que sale al exterior, siempre con OK |
| Tipos de objetivo | Ingresos, pipeline, activación y retención, marca |
| Objetivos activos | De 1 a 3 con foco; aviso con el trade-off al abrir otro |
| Horizonte | Trimestre con ciclos semanales |
| Público | Entidad reutilizable con nivel de evidencia |
| Canales | LinkedIn orgánico, outbound, contenido y SEO, partners y eventos; cada canal es entidad con playbook, coste y resultados |
| Medición | Stripe, base de datos de Postin, PostHog y entrada manual marcada |
| Tareas | Solo en Nokko; Objetivo > Resultado clave > Iniciativa > Tarea, con subtareas y dependencias; capacidad de 10 h solo de referencia |
| Vistas | Hoja de ruta trimestral por objetivo, lista con filtros y detalle, kanban, calendario; grafo de dependencias opcional |
| Plan con IA | Borrador completo editable aprobado por bloques |
| Pantallas actuales | Se integran bajo el objetivo; menú simplificado |
| Competencia | Lista global con relevancia por objetivo; precios, mensajes, producto y contenido; semanal más alertas críticas; cada cambio genera sugerencia ligada al objetivo; base ICP-00 §6.2 más propuestas del agente |
| Torre de control | Semáforo por objetivo con umbrales 80 % y 50 % (fuente: decisión de Fede); decisiones; tareas de la semana; señales; check-in semanal; avisos por app, email y Telegram |
| Foco y cierre | Aviso de trade-off; retro obligatoria al cerrar |
| Gasto | Se muestra por proveedor y objetivo; sin tope ni bloqueo |
| Datos | Empezar de cero en Postin; el agente propone desde Drive y Fede aprueba por bloques; datos anteriores archivados |
| Calendario | La construcción empieza tras cerrar Lovable A y B; primera entrega: Objetivos, tareas e Inicio |
| Resultado clave | Número con valor inicial, meta y fecha |
| Puertas | Manuales: Nokko calcula el valor y muestra si cumple; Fede confirma |
| Decisiones | Registro con ID, dueño, estado y qué bloquea; ratifica solo Fede |
| Ciclo de vida | Borrador, activo, pausado, cerrado, archivado |
| Privacidad | Fichas sin nombres; Consejo con resúmenes |
| Atribución | Canal y público obligatorios; objetivo derivado |
| Embudos | Dos por modelo de venta con salida común; «publicó» como etapa propia |
| Activación | LinkedIn conectado y post creado |
| MRR | Recurrente normalizado sin pruebas ni puntuales |
| Credenciales | Cifrado actual; migración a almacén gestionado como evolución |
| Consejo | Rol de solo lectura; informe exportable; ve también runway y gatillo |
| Auditoría | Cambios en estrategia, conexiones y decisiones; solo Owner |
| Integraciones | Alcance por integración en SDD-4; sincronización diaria y antes del check-in; datos antiguos con estado neutro; empresa la gestiona el Owner, Calendar y Gmail cada usuario |
| Base de datos de Postin | Vistas agregadas de solo lectura, preparadas por Dani (SDD-8) |
| MCP | Lectura más proponer |
| Agente | Un agente con modos; copiloto más proactivo; casos de uso de planificar, seguir, investigar y preparar; memoria por objetivo y empresa editable; conversaciones privadas con hallazgos compartidos; Consejo con resúmenes |
| UX | Inicio chat más resumen; barra de avance con marcador; hoja de ruta por objetivo; panel lateral; lista con detalle; barra móvil con Decisiones |
| Información obligatoria | Cuatro bloques (negocio y etapa; capacidad y restricciones; clientes y evidencia; activos y alternativas), cubiertos al menos con hipótesis declarada |
| Diagnóstico | Punto de partida con dos modelos de venta a la vez |
| Caducidad | Por tipo de dato con aviso; al caducar vuelve a hipótesis |
| CRM actual | Oculto en Ajustes avanzados |
| Importación | Hoja de calificación, fichas sin nombres, Excel del sprint, manuales MD y CSV, base legacy solo como agregados |
| Edición | Fede y Flor editan; lo ratificado crea versión y se marca «modificado tras ratificación» |

## Anexo B. Contradicciones resueltas durante la entrevista
1. **Tope de gasto:** primero «tope con aviso», luego «sin tope por ahora» → se muestra el gasto sin bloquear.
2. **Puertas:** «se evalúan solas» frente a «manuales» → Nokko calcula, Fede confirma.
3. **Inicio:** «chat y resumen» frente a «torre de control» → resumen en Inicio, torre en Objetivos.
4. **Objetivos:** cinco frentes frente a «1 a 3» → tres objetivos y dos como iniciativas o vista.
5. **Prueba de 14 días:** ICP-00 §5 dice sin tarjeta; el proceso de venta de octubre, con tarjeta; Fede confirmó **con tarjeta** → propuesta de corregir ICP-00 (sin ejecutar).
6. **Activación:** definición de Fede frente a la del proceso de venta → ver riesgos.

## 19. Sección de Dani (la completa quien implemente)
- Diseño técnico:
- Tareas:
- Estimación:
- Decisión: Aceptado / Cambios pedidos / Rechazado

---
Validación: pendiente de auditoría (`postin-sdd-audit`).
