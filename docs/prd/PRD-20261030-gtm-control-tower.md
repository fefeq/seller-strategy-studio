# PRD-20261030-gtm-control-tower · [Iniciativa] Torre de control GTM: de herramientas sueltas a objetivos con hilo conductor

**Tipo:** Iniciativa · **Prioridad propuesta:** Alta (Fede lo pide como la dirección del producto; hoy el founder no tiene dónde definir y seguir sus objetivos de go-to-market)
**Estado:** Aprobado por Fede el 2026-10-30 · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-10-30
**SDD que lo desarrollan:** `docs/sdd/SDD-20261030-gtm-control-tower-1a-core.md` y `docs/sdd/SDD-20261030-gtm-control-tower-1b-tasks-gates-tower.md` (redactados y aprobados); SDD-2 (redactado y aprobado); SDD-3 (redactado y aprobado); SDD-4a y SDD-4b (redactados y aprobados el 2026-10-31); SDD-5a, SDD-5b y SDD-5c (redactados y aprobados el 2026-10-31); SDD-5d (plan con IA y herramientas de estrategia, aprobado por Fede el 2026-10-31); SDD-6, SDD-7 y el SDD-8 para Dani (pendientes, ver §8)

> Un PRD dice qué se quiere y por qué. No dice cómo se construye ni cómo se prueba: eso es del SDD.
> Origen: entrevista de 17 rondas con Fede (2026-10-29 y 30). Sus decisiones están en el §6.

## 1. Problema
Fede ve en Nokko «muchas cosas sueltas pero nada que tenga un hilo conductor que sea cumplir un objetivo». Hoy Nokko es una colección de herramientas comerciales (cuentas, leads, pipeline, métricas, ciclo GTM, sugerencias) sin un objeto que las una. No hay un lugar donde definir qué se quiere conseguir, para qué público y por qué canales, ver cómo va, y bajarlo a tareas con plazos y hoja de ruta. Tampoco hay vigilancia continua de competidores y alternativas.

## 2. Para quién
- Fede, founder (Owner), uso diario: pensar la estrategia, decidir y seguirla.
- Flor, puesta en marcha (rol Sales leader): ejecutar y editar el plan.
- El Consejo (rol nuevo, solo lectura): ver objetivos, puertas, decisiones y runway.
- Los demás roles actuales (marketing, SDR, AE, SE, CS, deal desk, enablement): lectura de objetivos, resultados clave, iniciativas, hoja de ruta y tareas.
- Dani (construcción) no usa Nokko; sus dependencias llegan como SDD.

## 3. Evidencia y por qué ahora
Fuentes leídas el 2026-10-30; lo no comprobado va marcado.
- **Código de Nokko (repo `seller-strategy-studio`, solo lectura):**
  - Tareas planas sin objetivo; solo un campo de texto «objectives» por cuenta (`account_plans.objectives`, `src/integrations/supabase/types.ts`).
  - Experimentos (`gtm_experiments`), metas por segmento (`segment_targets`) y sugerencias sin vínculo a un objetivo.
  - El Ciclo GTM (`src/routes/_authenticated/cycle.tsx`) tiene fases con documentos aprobados (`gtm_artifacts`), pero el Plan es texto sin objetivos medibles ni tareas.
  - Leads, deals, personas y pruebas tienen `source` de texto libre y `segment_id`; no hay canal como entidad.
  - El agente tiene del orden de cien herramientas de CRM y personas (`src/lib/agent/tools/`, `src/lib/bmad/personas.ts`) [Por verificar el conteo].
  - El cifrado de credenciales existe (`src/lib/secret-box.server.ts`), pero la conexión de cuentas propias declara que falta el almacén (`src/lib/connections-core.ts`).
  - La lectura de posts y ofertas de LinkedIn se hace con un proveedor de extracción automática (`src/lib/agent/tools/linkedin.ts`).
- **Postin Core (Drive, solo lectura):** F0-01 v6.3 (objetivo de 10.000 € MRR a 12 meses desde la salida a producción; 10 h/semana de captación), ICP-00 v2.4 (cuatro ICP en hipótesis; regla de no gastar en hipótesis; caducidad de 6 meses), F0-11 v1.2 (motor de captación; puertas de día 14 y 30; API oficial de LinkedIn sin herramientas de terceros), «Proceso de venta — guiones y puesta en marcha (oct 2026)» y el log del radar de marca personal.
- **Uso real de Nokko por Fede o Flor:** sin dato. Se declara la apuesta: la dirección viene de la decisión de Fede, no de datos de uso.

## 4. Objetivos
Todas las líneas base son **sin dato** (no se ha medido nada todavía).

| ID | Objetivo | Cómo se mide | Línea base | Fuente |
|---|---|---|---|---|
| G-1 | Un hilo conductor: cada objetivo con resultados clave medibles y estado calculado, visible en una torre de control | Fede ve el estado de todos sus objetivos en una sola pantalla sin cálculos manuales | sin dato | Declarada por Fede en la revisión de cada fase |
| G-2 | Bajar el objetivo a trabajo: iniciativas, tareas, plazos y hoja de ruta | Toda tarea nueva de una persona pertenece a una iniciativa de un objetivo; las que crea el agente quedan como propuestas «Sin asignar» hasta que alguien las asigne | sin dato | Datos de Nokko tras el lanzamiento |
| G-3 | Decisiones y puertas trazables: qué se decidió, quién, cuándo y con qué datos | Cada puerta muestra su valor calculado y su resultado confirmado; cada decisión tiene ID y estado | sin dato | Datos de Nokko tras el lanzamiento |
| G-4 | Información necesaria para diseñar la estrategia, con nivel de confianza y caducidad | Los cuatro bloques (negocio y etapa, capacidad y restricciones, clientes y evidencia, activos y alternativas) cubiertos al menos con hipótesis declarada | sin dato | Datos de Nokko tras el lanzamiento |
| G-5 | Atribución y métricas fiables: canal y público en cada lead, cuenta, prueba y deal, con definiciones únicas | Todo registro nuevo con canal y público; métricas con definición versionada | sin dato | Datos de Nokko tras el lanzamiento |
| G-6 | Datos reales conectados (Stripe, base de datos de Postin, PostHog, calendario, correo) sin pérdida de seguridad | Resultados clave de negocio alimentados por fuente automática cuando existe | sin dato | Datos de Nokko tras el lanzamiento |
| G-7 | Un agente copiloto y proactivo que ayuda a pensar, planificar y seguir | El check-in semanal le lleva a Fede menos de 10 minutos | sin dato | Instrumentación de Nokko o declaración de Fede [Por verificar] |
| G-8 | Mercado vigilado de forma continua, con cada cambio ligado a un objetivo | Cambios relevantes de competidores y alternativas llegan como sugerencia con fuente y fecha | sin dato | Datos de Nokko tras el lanzamiento |
| G-9 | El Consejo informado y la salud financiera visible (runway y gatillo de continuidad) | El Consejo ve su vista y un informe por pleno sin datos de clientes | sin dato | Datos de Nokko tras el lanzamiento |
| G-10 | Cumplir las reglas de producto: API oficial de LinkedIn, privacidad, ninguna cifra inventada, aprobación humana de lo que sale al exterior | Cada regla de §6.2 cumplida y probada | sin dato | Pruebas de cada SDD |

Señal de éxito global (palabras de Fede): deja de usar otras herramientas para planificar. Se declara en la revisión de cada fase.

## 5. No-objetivos
- Sincronizar tareas con Plane u otra herramienta (las tareas viven solo en Nokko). Única excepción, decidida por Fede el 2026-10-30: un espejo de solo salida de las tareas con fecha como eventos de día completo en el calendario personal de quien las ejecuta (SDD 4b); el calendario nunca modifica la tarea.
- Enviar, publicar o contactar a terceros sin aprobación humana.
- Leer o valorar perfiles de LinkedIn por extracción automática; Nokko nunca valora perfiles.
- Cambiar el cobro, la facturación o el producto de Postin.
- Onboarding genérico para empresas de terceros (Postin es el primer caso).
- Borrar datos existentes (se archivan), salvo supresión exigida por una persona titular o por la ley.
- Tope de gasto en proveedores o IA (se muestra el gasto, sin bloquear).
- Cambios en Drive sin OK explícito de Fede.
- Kanban y calendario de tareas en la primera fase (fases posteriores, sin SDD asignado).

## 6. Decisiones tomadas y abiertas

### 6.1 Decisiones de producto (Fede, 2026-10-29 y 30)
| Tema | Decisión | Quién y cuándo |
|---|---|---|
| Usuarios | Fede + agente; Flor (Sales leader); Consejo (solo lectura); Dani sin acceso | Fede, 2026-10-29/30 |
| Negocio | Postin primero | Fede, 2026-10-29/30 |
| Arranque | Tres entradas al mismo objeto Objetivo: escribirlo, entrevista guiada, partir de los datos | Fede, 2026-10-29/30 |
| Autonomía | Por niveles: lo interno sin pedir permiso; lo que sale al exterior, siempre con OK | Fede, 2026-10-29/30 |
| Tipos de objetivo | Ingresos, pipeline, activación y retención, marca | Fede, 2026-10-29/30 |
| Objetivos activos | De 1 a 3 con foco; aviso con el trade-off al abrir otro | Fede, 2026-10-29/30 |
| Horizonte | Trimestre con ciclos semanales | Fede, 2026-10-29/30 |
| Público | Entidad reutilizable con nivel de evidencia | Fede, 2026-10-29/30 |
| Canales | LinkedIn orgánico, outbound, contenido y SEO, partners y eventos; cada canal es entidad con playbook, coste y resultados | Fede, 2026-10-29/30 |
| Medición | Stripe, base de datos de Postin, PostHog y entrada manual marcada | Fede, 2026-10-29/30 |
| Tareas | Solo en Nokko; Objetivo > Resultado clave > Iniciativa > Tarea con subtareas y dependencias; capacidad de 10 h solo de referencia | Fede, 2026-10-29/30 |
| Vistas | Hoja de ruta trimestral por objetivo y lista con filtros y detalle; kanban y calendario después; grafo de dependencias opcional | Fede, 2026-10-29/30 |
| Plan con IA | Borrador completo editable, aprobado por bloques | Fede, 2026-10-29/30 |
| Pantallas actuales | Se integran bajo el objetivo; menú simplificado; las anteriores siguen accesibles hasta que Fede registre una decisión de retirarlas | Fede, 2026-10-29/30 |
| Competencia | Lista global con relevancia por objetivo; base de las alternativas de ICP-00 §6.2 más propuestas del agente; vigilancia semanal con alertas críticas; cada cambio genera una sugerencia ligada al objetivo | Fede, 2026-10-29/30 |
| Torre de control | Semáforo por objetivo con umbrales 80 % y 50 % (fuente: decisión de Fede); decisiones; tareas; señales; check-in semanal; avisos por app, email y Telegram | Fede, 2026-10-29/30 |
| Foco y cierre | Aviso de trade-off; retro obligatoria al cerrar | Fede, 2026-10-29/30 |
| Gasto | Se muestra por proveedor y objetivo; sin tope ni bloqueo | Fede, 2026-10-29/30 |
| Datos | Empezar de cero en Postin; el agente propone desde Drive y Fede aprueba por bloques; lo anterior se archiva | Fede, 2026-10-29/30 |
| Calendario | La construcción empieza tras cerrar Lovable A y B; primera entrega: objetivos, tareas e Inicio | Fede, 2026-10-29/30 |
| Resultado clave | Número con valor inicial, meta y fecha | Fede, 2026-10-29/30 |
| Puertas | Manuales: Nokko calcula el valor y muestra si cumple; Fede confirma | Fede, 2026-10-29/30 |
| Decisiones | Registro con ID, dueño, estado y qué bloquea; ratifica solo el Owner | Fede, 2026-10-29/30 |
| Ciclo de vida | Borrador, activo, pausado, cerrado, archivado | Fede, 2026-10-29/30 |
| Privacidad | Fichas sin nombres; el Consejo con resúmenes | Fede, 2026-10-29/30 |
| Atribución | Canal y público obligatorios; objetivo derivado | Fede, 2026-10-29/30 |
| Embudos | Dos por modelo de venta (asistida y autoservicio) con salida común; «publicó» como etapa propia | Fede, 2026-10-29/30 |
| Activación | LinkedIn conectado y post creado | Fede, 2026-10-29/30 |
| MRR | Recurrente normalizado, sin pruebas ni cobros puntuales | Fede, 2026-10-29/30 |
| Credenciales | Cifrado actual; migración a almacén gestionado como evolución | Fede, 2026-10-29/30 |
| Consejo | Rol de solo lectura; informe exportable; ve también runway y gatillo | Fede, 2026-10-29/30 |
| Auditoría | Cambios en estrategia, conexiones y decisiones; solo Owner | Fede, 2026-10-29/30 |
| Base de datos de Postin | Vistas agregadas de solo lectura, preparadas por Dani (SDD-8) | Fede, 2026-10-29/30 |
| Agente | Un agente con modos; copiloto y proactivo; memoria por objetivo y empresa editable; conversaciones privadas con hallazgos compartidos; el Consejo con resúmenes | Fede, 2026-10-29/30 |
| UX | Inicio chat más resumen, con la torre completa en Objetivos; barra de avance con marcador de ritmo; agente en panel lateral; barra móvil con Inicio, Plan, Agente y Decisiones | Fede, 2026-10-29/30 |
| Información obligatoria | Cuatro bloques cubiertos al menos con hipótesis declarada | Fede, 2026-10-29/30 |
| Diagnóstico | Punto de partida con dos modelos de venta a la vez | Fede, 2026-10-29/30 |
| Caducidad | Por tipo de dato con aviso; al caducar vuelve a hipótesis | Fede, 2026-10-29/30 |
| CRM actual | Oculto en Ajustes avanzados | Fede, 2026-10-29/30 |
| Importación | Hoja de calificación, fichas sin nombres, Excel del sprint, manuales MD y CSV; base legacy solo como agregados | Fede, 2026-10-29/30 |
| Edición | Fede y Flor editan; lo ratificado crea versión «modificado tras ratificación» | Fede, 2026-10-29/30 |
| Rol del Consejo | Guardado fuera de la lista de miembros, con vista de columnas limitadas y bloqueo en el agente, Telegram y el servidor para asistentes | Fede, 2026-10-30 |
| Otros roles | Lectura de objetivos, resultados clave, iniciativas, hoja de ruta y tareas | Fede, 2026-10-30 |
| Deshacer | 24 horas para el Owner, también en los cambios del agente | Fede, 2026-10-30 |
| Estado del objetivo | El del peor resultado clave con dato | Fede, 2026-10-30 |
| ID de decisión | DEC-AAAAMMDD-n; la ratificación, RAT-AAAAMMDD-n | Fede, 2026-10-30 |
| Puertas próximas | Horizonte de 14 días | Fede, 2026-10-30 |
| División del SDD 1 | Dos: 1a (núcleo) y 1b (tareas, puertas y torre), con la numeración de criterios conservada | Fede, 2026-10-30 |
| Zona horaria de la organización | Europe/Madrid por defecto; configurable | Fede, 2026-10-30 |
| Bloqueo de contexto | La falta de bloques cubiertos impide activar objetivos, no crearlos en Borrador | Fede, 2026-10-30 |
| Canal de adquisición | Convive con el «canal de entrada» ya aprobado (2026-10-25): son dos conceptos distintos | Fede, 2026-10-30 |
| Solape de onboarding | El SDD 2 define el contenido y cuándo está terminado; `onboarding-flow-end-to-end` conserva flujo, guía y experiencia; «Productos» entra en activos y alternativas | Fede, 2026-10-30 |
| Calendario y correo personales | Conexión de Google por persona; correo solo para crear borradores, nunca enviar; reuniones leídas en un registro personal solo del dueño, sin IA; notas de llamadas sin nombres | Fede, 2026-10-30 |
| Espejo de tareas en el calendario | Las tareas con fecha se copian como eventos de día completo al calendario de su ejecutor, solo de salida; excepción acotada al no-objetivo de sincronizar tareas | Fede, 2026-10-30 |
| MRR normalizado | Cuenta descuentos recurrentes y excluye suscripciones con pago pendiente; la cifra actual de Nokko, que las cuenta, se muestra como diferencia | Fede, 2026-10-30 |
| Coste previo de proveedores | Se muestra junto a la acción, sin confirmación nueva; pulsar es la aprobación | Fede, 2026-10-30 |
| Activación manual hasta el SDD-8 | «Activa» y «Publicó» se rellenan a mano, con origen marcado, por recorrido siempre; el total por periodo pasa a automático cuando Dani entregue las vistas (SDD-8, aprobado el 2026-11-02, enmienda de 4a CA-10) | Fede, 2026-10-30 |
| Pausa al 100 % del presupuesto | El planificador mantiene la pausa de acciones automáticas; no se considera el tope descartado | Fede, 2026-10-30 |
| Avisos críticos | Fuente caída, puerta próxima o vencida, resultado clave en rojo y gasto al 80 % y 100 % del presupuesto; Telegram y email, con resumen diario y silencio nocturno (Europe/Madrid) | Fede, 2026-10-31 |
| Autonomía del agente | Solo crea ítems internos como propuesta; nada sale ni cambia un objetivo ratificado sin aprobación | Fede, 2026-10-31 |
| Servidor para asistentes | Lectura y escritura completa, con las mismas reglas del agente: permisos por rol, auditoría, deshacer 24 h, ratificación solo del Owner, Consejo bloqueado | Fede, 2026-10-31 |
| Memoria del agente | Automática y editable; solo cargos y roles de las personas de una cuenta, nunca nombres | Fede, 2026-10-31 |
| Check-in semanal | Conversación guiada de unos 10 minutos; lunes a las 9:00 (Europe/Madrid) por defecto, cambiable por el Owner | Fede, 2026-10-31 |
| Avisos críticos y silencio | Siempre respetan el silencio nocturno; se retienen y salen al terminar | Fede, 2026-10-31 |
| Propuestas del agente | Las aprueba solo quien las pidió; caducan a los 7 días | Fede, 2026-10-31 |
| Memoria y conversaciones privadas | El texto de la conversación es privado; los recuerdos de empresa y cuenta que salen de ella se comparten solos, con origen visible y editables | Fede, 2026-10-31 |
| Agente ejecutor de tareas | Puede ser ejecutor de tareas internas (investigación y borradores), a petición | Fede, 2026-10-31 |
| Plan con IA y herramientas de estrategia | Van al SDD 5d, aparte de la serie 5a a 5c | Fede, 2026-10-31 |
| Tareas pesadas con coste del agente | Todas las herramientas con coste pasan a acción pendiente con el coste en la tarjeta; pulsar es la aprobación | Fede, 2026-10-31 |
| Memoria de otros roles | Con la fase activa, sus conversaciones solo generan recuerdos de ámbito persona | Fede, 2026-10-31 |
| Fase desactivada y memoria | El agente actual sigue usando los recuerdos de empresa y cuenta; se ocultan los de objetivo y los hallazgos | Fede, 2026-10-31 |
| Check-in: excepción de tareas sin asignar | Muestra las tareas «Sin asignar» y las propuestas pendientes de la persona, solo en el check-in (excepción a 1b CA-84) | Fede, 2026-10-31 |
| Informe semanal | Se integra completo en el check-in; el resumen diario sustituye al email diario y al resumen de Telegram | Fede, 2026-10-31 |
| Avisos críticos por email | Salen al momento, con retención solo durante el silencio nocturno | Fede, 2026-10-31 |
| Servidor para asistentes: empresa y coste | Tiene su propia empresa activa solo con la fase activa, con acceso privilegiado y filtro explícito; cambiarla desde un asistente no mueve la de la app ni la de Telegram; una propuesta de un asistente se ve con su organización y se ejecuta en ella; las lecturas con coste van con botón | Fede, 2026-10-31 |
| Recuerdos compartidos | Solo los ven Owner y Sales leader y los demás roles solo aprenden recuerdos personales (excepción a R-9); las herramientas con coste de proveedor llevan coste en la tarjeta, no los borradores con IA | Fede, 2026-10-31 |
| Herramientas de estrategia del agente | Las de propuesta de cambios de estrategia y de bloques de contexto van en el SDD 5d | Fede, 2026-10-31 |
| Check-in: duración y avisos de gasto | Descarta huecos de más de 30 minutos; el aviso del 80 % y del 100 % sale una vez por mes aunque cambie el límite | Fede, 2026-10-31 |
| Proveedores Exa y FullEnrich | Se añaden al registro de proveedores con las mismas reglas (credencial propia, coste previo y aprobación al revelar contactos); nunca se les envían URLs de perfiles de LinkedIn (R-5); enmienda de 4a (CA-32 y CA-33) | Fede, 2026-10-31 |
| Herramienta de transcripciones | Granola; importación manual de sus notas ahora, conector automático en un SDD posterior; enmienda de 4b | Fede, 2026-10-31 |
| Modo «plan» del agente | Con la fase activa abre «Generar plan»; el documento Plan GTM se genera después, a petición, desde el plan aprobado (SDD 5d CA-22) | Fede, 2026-10-31 |
| SDD-8: división y granularidad | El lado Nokko lo ejecuta nuestro agente y el lado Postin va a Dani; las vistas son recuentos por día y canal sin ninguna clave de persona; lectura cada 24 horas más sincronización manual; la atribución de «Activa» y «Publicó» es por canal, no por recorrido (enmienda de 4a CA-10 y CA-31) | Fede, 2026-10-31 |
| SDD-8 lado Nokko: acceso y lectura | El mismo acceso a Postin no se conecta en dos organizaciones (misma dirección normalizada); una vista que falla hace fallar la lectura entera; se lee al conectar sin esperar 24 horas; un campo de más o un tipo incorrecto hace fallar la lectura; el resultado clave usa solo el total, sin filtro de canal; solo HTTPS; recuentos pequeños aceptados | Fede, 2026-11-02 |
| Plan con IA: metas y aprobación | La IA propone meta, fecha meta, umbral y fecha de puerta como «Supuesto» con su motivo; valor inicial y actual solo medidos o «Sin dato»; confirmar es una acción explícita y activar con «Supuesto» sin confirmar solo avisa; un bloque se aprueba solo desde la pantalla del plan (SDD 5d) | Fede, 2026-10-31 |
| Plan con IA: tope y lectura | Máximo tres bloques por borrador; con tres objetivos vivos no genera ni cobra; los roles que SDD 2 CA-7 deja consultar leen los bloques con su agente en solo lectura (SDD 5d) | Fede, 2026-10-31 |
| Plan con IA: coste y entrevista | El coste previo del plan es una excepción a «los borradores con IA no llevan tarjeta de coste»; con la fase activa la entrevista guarda solo como propuesta de contexto y deja de ofrecer las herramientas de configuración anterior (SDD 5d) | Fede, 2026-10-31 |
| Plan con IA: segunda pasada | Las tareas del plan nacen sin fecha límite ni hora; editar un «Supuesto» lo confirma; un público nuevo compartido se resuelve por nombre y el deshacer solo archiva lo que nadie más usa; la persona elige los tipos de objetivo (máximo tres) con el coste visible; un bloque caducado, rechazado por cambio o fallido se copia sin nuevo gasto de IA; lo que la persona dice en la entrevista se guarda con origen persona (clientes y MRR incluidos); los recuerdos de empresa no se envían al modelo; el tope de elementos por bloque lo fija Fede tras una prueba de tamaño (SDD 5d) | Fede, 2026-10-31 |
| Plan con IA: informe paralelo | Las tareas de un bloque aprobado quedan fuera de resúmenes, avisos y horas planificadas mientras su objetivo esté en Borrador (enmienda a 1b CA-37 y CA-84); el tope de bloques es tres menos los objetivos vivos (sustituye a «máximo tres por borrador»); el deshacer de 24 horas no cubre las tareas del agente (SDD 5d) | Fede, 2026-10-31 |
| Aprobar un bloque del plan | Enmienda de SDD 5b CA-16, SDD 5a CA-32 y SDD 5c CA-7: un bloque del plan solo se aprueba desde la pantalla del plan; en el check-in, Telegram, Sugerencias y el panel solo se enlaza o se descarta (SDD 5d CA-26) | Fede, 2026-10-31 |
| Aviso de «Sin dato reciente» | Al doble del intervalo de lectura | Fede, 2026-10-31 |
| Baja de una persona | Se intentan borrar sus eventos de tareas antes de revocar su autorización de Google | Fede, 2026-10-31 |
| Fase desactivada y Google | Las autorizaciones se mantienen sin uso y el Owner puede revocarlas | Fede, 2026-10-31 |
| Reparto de integraciones | Avisos críticos y servidor para asistentes pasan al SDD 5; el SDD 4b construye el cliente de Google por persona | Fede, 2026-10-30 |
| MRR de Stripe | Lo ve quien vea el resultado clave que lo usa (desvío declarado de la visibilidad actual de la foto de Stripe) | Fede, 2026-10-30 |
| Herramientas de automatización de LinkedIn | La pantalla de entrada de leads las mantiene con una advertencia de que incumplen la regla de API oficial | Fede, 2026-10-30 |
| Tareas de CRM | Toda tarea nueva, también la ligada a una cuenta o a un deal, cuelga de una iniciativa | Fede, 2026-10-30 |

### 6.2 Reglas transversales (R-n; los SDD las citan como «PRD R-n»)
- **R-1** Cada cifra de negocio muestra su fuente y su antigüedad; sin fuente, «Sin dato».
- **R-2** Lo que sale al exterior requiere aprobación humana. Lista cerrada de acciones externas: publicar contenido; enviar mensajes o correos a personas distintas del usuario; invitar a terceros a eventos; revelar o exportar datos de contacto con crédito de un proveedor. **No** son acciones externas: los avisos propios (email o Telegram a los miembros de la organización), los borradores de correo, la generación del informe del Consejo y las propuestas del servidor para asistentes, que se guardan como propuestas pendientes. El gasto en proveedores o IA no requiere aprobación pero muestra su coste previo en las tareas pesadas.
- **R-3** El agente crea sin aprobación solo elementos internos (investigar, borradores, tareas, sugerencias) y deja registrado que los creó él. Las tareas que cree el agente o un detector sin iniciativa se guardan como propuestas «Sin asignar».
- **R-4** Las fichas de conversaciones (registros de cada conversación con una cuenta) no contienen nombres de persona ni de empresa. El agente puede leer fichas; el Consejo solo ve agregados y resúmenes sin textos literales. El umbral mínimo de agregación está [Por verificar].
- **R-5** LinkedIn solo por API oficial. Sales Navigator solo por exportación manual del usuario. Los proveedores de investigación solo sobre fuentes públicas que no sean LinkedIn.
- **R-6** Si una fuente falla o está desactualizada, se muestra el último valor con su antigüedad y el estado «Sin dato reciente»; nunca se inventa un valor.
- **R-7** Se archiva y no se borra, salvo supresión exigida por una persona titular de datos o por la ley.
- **R-8** Textos en español, de «tú», con estados en palabra y sin iconos; errores con «qué pasó y qué hacer».
- **R-9** Mientras una organización no tenga activada una fase, ve el comportamiento anterior sin cambios; las únicas excepciones son la retirada de la lectura de LinkedIn por extracción automática, que se hace en la primera entrega, y que los recuerdos compartidos del agente solo los ven Owner y Sales leader y los demás roles solo aprenden recuerdos de ámbito persona, incluidas las reuniones, las sugerencias decididas y los descubrimientos (SDD 5a CA-37).
- **R-10** Los datos de cada organización no se cruzan.

*Glosario:* «organización» es la empresa que usa Nokko; «cuenta» es una empresa prospecto o cliente; «fase» es la activación de un SDD hijo por organización y rol.

### 6.3 Definiciones de negocio
- **Activada:** cuenta con LinkedIn conectado y un post creado. El embudo añade «publicó» como etapa posterior para no perder la señal de la caída de creado a publicado (ICP-00 §8). El proceso de venta de octubre define «activada» como primer post publicado: hay que alinearlo (propuesta de cambio en Drive, sin ejecutar).
- **MRR normalizado:** suma mensual de las suscripciones de pago activas, con el pago anual dividido entre 12; aplica los descuentos recurrentes; excluye pruebas, plan gratuito, cobros puntuales y suscripciones con el pago pendiente o fallido. Fuente: Stripe o, mientras no exista, entrada manual marcada.
- **Inicio de los 12 meses del objetivo de ingresos:** según F0-01, desde la salida a producción de la nueva versión; Fede indicó que el día 0 ya ocurrió y no condiciona este diseño (fecha: sin dato).
- **Puerta:** criterio medible con fecha o evento de evaluación y consecuencia; el sistema calcula, Fede confirma. Campos y estados en los SDD 1a y 1b.
- **Runway y gatillo de continuidad:** insumos caja inicial, gasto mensual y MRR (el esquema de finanzas ya tiene caja inicial y horizonte); la fórmula exacta se define en SDD-7 [Por verificar con Fede]. El gatillo son las puertas de F0-11 §3.

### 6.4 Contradicciones resueltas en la entrevista
1. Tope de gasto: primero «tope con aviso», luego «sin tope por ahora» → se muestra el gasto sin bloquear.
2. Puertas: «se evalúan solas» frente a «manuales» → el sistema calcula y Fede confirma.
3. Inicio: «chat y resumen» frente a «torre de control» → resumen en Inicio, torre en Objetivos.
4. Objetivos: cinco frentes frente a «1 a 3» → tres objetivos; audiencia propia es un canal y «KPI por canal» una vista.
5. Prueba de 14 días: ICP-00 §5 dice sin tarjeta y el proceso de venta de octubre, con tarjeta; Fede confirmó **con tarjeta** → propuesta de corregir ICP-00 (sin ejecutar).
6. Activación: la definición de Fede frente a la del proceso de venta → ver §6.3.

### 6.5 Decisiones abiertas
| Tema | Estado | Quién |
|---|---|---|
| El Consejo ve iniciativas (título y estado) y puertas, y no ve tareas ni hoja de ruta (propuesta del autor, no decisión de Fede) | abierta, no bloquea | Fede |
| Lista de competidores directos de Postin | abierta; solo existen las alternativas de ICP-00 §6.2 | Fede |
| Estado real de billing y de Stripe en Postin | abierta | Dani |
| Resultados de las puertas ya vencidas | abierta | Fede |
| Herramienta de transcripciones de llamadas | abierta | Fede |
| Si el servidor MCP de Postin expone métricas agregadas o solo la cuenta del usuario | abierta | Dani |
| Base legal para tratar la base legacy (la SL está en constitución) | abierta; mientras tanto solo agregados | Fede / asesoría |

## 7. Riesgos y dependencias
- **Salida de Lovable (SDD A y B):** la construcción espera a que estén cerrados; esquema nuevo antes puede chocar con la migración. Coordinar con el SDD 7b de competidores como entidad (borrador).
- **Alcance:** nueve SDD (1a, 1b, 2 a 7 y 8). Se mitiga entregando por fases con activación por organización y rol, y revisando tras cada una la señal de éxito.
- **Clave única de cifrado:** rotar `INTEGRATION_KEYS_SECRET` obliga a reconectar todas las integraciones.
- **Billing de Postin:** si no existe, el MRR solo entra como dato manual y el resultado clave de ingresos nace con poca automatización.
- **Activación medible:** «conectado», «creado» y «publicó» necesitan eventos en Postin; si hoy no existen, el resultado clave de activación no es medible hasta que Dani los exponga [Por verificar].
- **Edición directa por Flor sobre lo ratificado:** mitigada con versión nueva y marca.
- **Rol del Consejo:** un fallo de seguridad expondría datos de clientes; exige pruebas con dos organizaciones ficticias.
- **Tareas de CRM:** al exigir iniciativa a toda tarea nueva, los roles que hoy las crean pierden esa capacidad mientras solo lean; pendiente decidir si crearán tareas dentro de iniciativas existentes (no bloquea la aprobación).
- **Dependencia de Dani:** vistas agregadas (SDD-8) y cualquier cambio en la base de datos de Postin.
- **Inicio como chat:** Fede lo eligió; para no perder la torre de control, esta vive en Objetivos.

## 8. Orden de entrega (iniciativa)
| # | SDD | Tipo | Depende de | Cubre |
|---|---|---|---|---|
| 1a | `SDD-20261030-gtm-control-tower-1a-core` (redactado): roles y rol Consejo, activación por organización y rol, objetivos, resultados clave, públicos y canales mínimos, decisiones, auditoría y retirada de la lectura de LinkedIn | Feature | Lovable A y B | G-1, G-3, G-9, G-10 |
| 1b | `SDD-20261030-gtm-control-tower-1b-tasks-gates-tower` (redactado): iniciativas, tareas, puertas, torre en Objetivos, Plan, Inicio y menú | Feature | 1a | G-1, G-2, G-3, G-9, G-10 |
| 2 | `SDD-20261030-gtm-control-tower-2-context-onboarding` (redactado y aprobado el 2026-10-30): contexto estratégico y onboarding por bloques, nivel de confianza, caducidad, importación MD y CSV, ajustes | Feature | 1 | G-4 |
| 3 | `SDD-20261030-gtm-control-tower-3-attribution-metrics` (redactado y aprobado el 2026-10-30): atribución, embudos por modelo de venta, diccionario de métricas, KPI por canal y ficha de conversación | Feature | 1, 2 | G-5 |
| 8 | Vistas agregadas de Postin, dividido en dos (decisión de Fede, 2026-10-31): lado Nokko (credencial, lector y fuente de «Activa» y «Publicó»; aprobado el 2026-11-02: `SDD-20261031-gtm-control-tower-8-postin-views-nokko`; sustituye a 4a CA-10 y CA-31 y cierra 4a U-5) y lado Postin para Dani (vistas y credencial de solo lectura; redactado, en Borrador, sin enviar: `SDD-20261031-nokko-aggregate-views`) | Feature | 4a, 3, 1a (el lado Nokko); Dani (el lado Postin) | G-6, G-10 |
| 4a | `SDD-20261030-gtm-control-tower-4a-data-sources` (redactado y aprobado el 2026-10-31): Stripe, producto, estado de las conexiones, Sales Navigator por CSV y proveedores con coste | Feature | 1a, 1b, 2, 3, SDD-8 | G-6, G-10 |
| 4b | `SDD-20261030-gtm-control-tower-4b-personal-tools-assistants` (redactado y aprobado el 2026-10-31): cliente de Google por persona, calendario, correo (borradores) y notas de llamadas | Feature | 4a, 1b, 3 | G-6, G-10 |
| 5a | `SDD-20261030-gtm-control-tower-5a-agent-memory` (redactado y aprobado el 2026-10-31): agente único con modos y panel lateral, conversaciones privadas y hallazgos, memoria, propuestas y autonomía | Feature | 1a, 1b, 3, 4a, 4b | G-7, G-10 |
| 5b | `SDD-20261030-gtm-control-tower-5b-notices-checkin` (redactado y aprobado el 2026-10-31): resumen diario, avisos críticos por email y Telegram y check-in semanal | Feature | 5a, 1a, 1b, 2, 4a | G-3, G-6, G-7, G-10 |
| 5c | `SDD-20261030-gtm-control-tower-5c-assistant-server` (redactado y aprobado el 2026-10-31): servidor para asistentes con lectura y escritura completa y las mismas reglas del agente, y Telegram | Feature | 5a, 5b, salida de Lovable C | G-7, G-10 |
| 5d | Plan con IA y herramientas del agente para proponer cambios de estrategia y leer o escribir los bloques de contexto, que sustituyen el doble de 5a CA-22 a CA-24 y de 1a CA-70: borrador completo editable, aprobado por bloques (aprobado por Fede el 2026-10-31: `SDD-20261030-gtm-control-tower-5d-plan-strategy-tools`) | Feature | 1a, 1b, 2, 3, 4a, 5a, 5b, 5c | G-2, G-3, G-4, G-7, G-10 |
| 6 | Mercado y competencia: alternativas, competidores, señales, radar (pendiente) | Feature | 1, 5a; coordinar con 7b | G-8 |
| 7 | Vista y PDF del Consejo, runway y gatillo de continuidad (pendiente) | Feature | 1, 4 | G-9 |

**Nota:** las referencias a «SDD 5» de los SDD aprobados (1a, 1b, 4a y 4b) se leen así: agente, memoria, propuestas, deshacer y ejecutor, SDD 5a; avisos, resumen y check-in, SDD 5b; servidor para asistentes y Telegram, SDD 5c.

**Orden recomendado:** 1a → 1b → 2 → 3 → (8 en paralelo) → 4a → 4b → 5a → 5b → 5c → 5d → 6 → 7.

**Funcionalidades fuera de la serie:** kanban y calendario de tareas (fase posterior, sin SDD); avisos por Telegram (dependen de conectar el bot, SDD-4); gráfico de evolución de resultados clave (fase posterior).

## 9. Aprobación
- Estado del PRD: Aprobado.
- Aprobación de Fede: 2026-10-30, en el chat («Apruebo»), sobre este PRD y los SDD 1a y 1b en su versión v9.
- Alcance de la aprobación: habilita la redacción de los SDD 2 a 7 y 8 y la estación `nokko-brief` de los SDD 1a y 1b. No incluye el GO para promover los tickets (ver el ledger).
