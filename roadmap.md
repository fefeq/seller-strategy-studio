# Roadmap

- [x] Fase 1a: esquema de datos de configuración + indicador de completitud
- [x] Fase 1b: onboarding con IA (web/documentos → propuestas revisables), entrevista y asistente
- [x] Fase 1c: agente GTM en la app (consultar + ejecutar con confirmación)
- [x] Fase 2: motor proactivo (detectores, bandeja de sugerencias, resumen diario, ejecución horaria)
- [ ] Fase 3: Telegram — código listo (vinculación, agente, avisos, resumen diario). Bloqueado: ver «Pendiente».
- [x] Ciclo GTM estilo BMAD: agentes con menú, fases y documentos, hub «¿Qué hago ahora?», camino por ACV, revisión profunda, retros
- [x] Debates multiagente por niveles (C-Levels, Sales, Marketing, Partners, Todos) con nombres de fundadores famosos
- [x] Entrada de leads reales: enlace seguro por empresa (formularios, Zapier/Make, CRMs vía webhook) + CSV → cuenta, persona y deal con etapa y fecha; calculadora con ACV, win rate y ciclo reales en vivo
- [x] Pantalla de Leads: pipeline Nuevo → Contactado → MQL → SQL → Oportunidad, retrasos (plazo por etapa + seguimiento vencido), conversión; embudo Lead → Ganado en Métricas por segmento/origen; agente y avisos proactivos
- [x] Panel de equipo en Sugerencias: estado, responsable, asignación y vencidas
- [x] Conexión MCP para Claude, ChatGPT, Codex (OAuth, herramientas del agente, escrituras confirmadas en Sugerencias). Activa para asistentes externos al publicar.
- [x] Panel de CAC real en Métricas: costes por canal, segmento y trimestre → payback real en la cobertura
- [x] Métricas: KPIs trimestrales (ingresos, coste de servir, margen, CAC y payback real vs plan, 4 trimestres) y panel de Pipeline (leads → oportunidades → deals en proceso → ganados, quién sigue en cada etapa, CAC y payback real y proyectado)
- [x] Nombre Nokko en toda la app (UI, agente, Telegram, MCP)
- [x] Móvil: todas las pantallas sin scroll lateral, menú ☰/✕, barra inferior (Inicio, Sugerencias, Leads, Pipeline, Agente), etapa del deal editable desde su ficha, tablas como tarjetas; menú lateral plegable en escritorio (⌘/Ctrl+B); instalable en la pantalla de inicio
- [x] Branding «Nokko — Edición»: Jost + Spline Sans Mono, llave, lockup e isotipo del design system, favicon e iconos
- [x] Papel blanco roto y modo claro/oscuro con interruptor (recuerda la elección o sigue al sistema)
- [x] Puntuación de leads y cuentas: encaje con el ICP (70 %) + actividad reciente (30 %), con los criterios explicados; ordena Leads y Cuentas y la lista de leads del agente; segmento, sector y tamaño editables en la ficha de la cuenta
- [x] Textos revisados con la guía de voz: sin exclamaciones ni emoji, sin inglés visible, vocabulario de producto, estados vacíos con qué hacer; la IA tutea y empieza por la conclusión
- [x] Clay: prospectar cuentas, buscar stakeholders, completar cuentas; también desde el agente y MCP
- [x] Página «Conectar asistentes» (/connect): dirección, pasos por asistente y cómo actualizar
- [x] Apollo.io: completar cuentas, buscar personas y empresas, revelar emails y móviles (estos tres requieren plan de pago de Apollo); también desde el agente y MCP
- [x] Firecrawl: configuración desde la web, investigar cuentas, señales y noticias, research de stakeholders con fuentes; agente y MCP
- [x] Perplexity (conexión de Lovable, solo búsqueda): segunda fuente para señales (noticias, nombramientos, casos de éxito), investigación de cuentas y research de stakeholders
- [ ] Perplexity: informe profundo de cuenta e informes financieros (SEC). Bloqueado: necesita conectar la clave propia de Perplexity (pplx-)

## Pendiente

Ordenado por quién lo desbloquea y, dentro de cada grupo, por impacto.

### Necesita una acción o una decisión de Fede

- [ ] Telegram: crear el bot en @BotFather y conectarlo en Lovable. Después: registrar el webhook y probar vinculación, avisos y resumen diario (Claude).
- [ ] Probar en el móvil con datos reales lo que no se pudo ver con datos de prueba: reuniones, mapa de stakeholders, perfiles ICP y el modo entrevista del agente.
- [x] Glosario de producto (decidido: mixto). Funciones en español —Planificador de reuniones, Preparación de llamada, Clínica de casos, Investigación de stakeholders, Brief GTM, Modelos de venta—; roles y siglas del sector en inglés (Owner, Sales Leader, Deal Desk, MEDDPICC, ICP, ACV, CAC, Win/Loss, Revenue). Antes: decidir si se traducen o se quedan en inglés Meeting Planner, Call Prep, Case Clinic, Stakeholder Research, GTM Brief, Motions, Revenue, Win/Loss y los roles (Owner, Sales Leader, Deal Desk).
- [x] Titulares de pantalla (decidido: en pantallas con datos). Inicio, Métricas, Pipeline, Leads, Cuentas y Sugerencias abren con una conclusión calculada (src/lib/headlines.ts); sin datos vuelven al nombre de la sección. Antes: la guía pide conclusiones con dato («31 cuentas llevan 21 días sin contacto») en vez de temas («Métricas», «Pipeline», «Cuentas»). Decidir si se hace y en qué pantallas primero.
- [x] Portada: reescritas sin promesas («El CRM se actualiza con evidencia», «el plan de la cuenta»). Antes: revisar frases que suenan a promesa («CRM que se mantiene solo», «el plan para ganar»).
- [x] Decidido: el proyecto de Lovable y el repo se quedan como «Seller Strategy Studio» (solo los ve el equipo; la app ya se llama Nokko). Propuesta original: renombrar a Nokko el proyecto de Lovable («Seller Strategy Studio») y, si se quiere, el repositorio de GitHub. Se hace en sus ajustes; comprobar después que Lovable sigue sincronizando.

### Lo puede hacer Claude sin decisiones previas

- [x] Errores: los «No se pudo: {mensaje}» (Telegram y acciones del asistente) dicen qué pasó pero no qué hacer; y los errores de Supabase llegan en inglés al usuario. Mapearlos a mensajes en español con siguiente paso.
- [x] Deals: al cambiar de etapa se pierden los cambios sin guardar de la ficha abierta.
- [x] MCP: los títulos de las herramientas que ven Claude y ChatGPT salen generados en inglés («get summary»). Darles título en español.
- [x] Móvil, pulido: los pasos del asistente de configuración ocupan unas 8 líneas; en Theory U el editor de la fase queda muy abajo; las pestañas que se desplazan de lado no lo indican.
- [x] Limpieza: quitar las dependencias de Bodoni Moda y Courier Prime (ya no se usan), la línea suelta del README («Implement exactly the screenshot…») y unificar el punto final de los avisos.

### Fase A (pipeline), un PR por pieza

- [x] 1. Puntuación de leads y cuentas.
- [x] 2. Umbral de enfriado según el ciclo real del segmento (un cuarto del ciclo, entre 14 y 60 días; ajustable por empresa en Pipeline); sustituye el umbral fijo de 14 días en el detector, la Pipeline y el agente.
- [x] 3. Informe semanal del lunes (quién avanzó, quién se enfrió, leads, qué hacer primero): en Sugerencias e Inicio, por Telegram y por email con Resend a Owner y Sales Leader; botón «Informe de la semana ahora». Falta de Fede: verificar nokko.ai en Resend y guardar RESEND_API_KEY (y RESEND_FROM si no es informes@nokko.ai) en los secretos de Lovable Cloud; sin la clave, el email se omite y lo demás funciona.
- [x] 4. Seguimientos día 3/7/14 para leads contactados sin respuesta: aviso en Sugerencias con borrador (posicionamiento y pilares de la empresa); al aprobar se apunta el envío y se programa el siguiente; el agente redacta una versión adaptada (draft_followup); la ficha del lead muestra en qué paso va. Nokko no envía: el comercial copia y manda.
- [x] 5. Biblioteca de jugadas: cinco playbooks base de Nokko (discovery, objeciones, demo, negociación, propuestas) que un botón en Conocimiento añade adaptados por la IA al contexto aprobado (o en versión base si no hay contexto o la adaptación no respeta la estructura); la Preparación de llamada los sigue.
- [x] 6. Notas de llamada en 5 líneas (qué les duele, qué les cuesta, quién decide y cómo, qué les frena, próximo paso acordado) en cada reunión, y desmontaje de la llamada por la IA (veredicto, qué funcionó, qué faltó, riesgos, próximo paso, qué actualizar en el deal con la frase que lo apoya); «Actualizar el deal con el agente» prepara MEDDPICC y la tarea del próximo paso como acciones a confirmar. Aviso en Sugerencias si una reunión pasada (2 h–7 días) no tiene notas; «Resolver» hace que el agente pregunte las 5 líneas y las guarde (save_call_notes). Migración 0025.
- [x] 7. Reparto de cuentas (Cuentas → Reparto): reglas segmento y/o país o región → personas (la primera que encaja gana; la IA puede proponerlas), cálculo fijo que equilibra la carga por tier (A 3, B 2, C 1) con máximo opcional por persona, la IA explica cada fila; tabla editable que aprueban Owner o Sales Leader; al aprobar, los deals y leads abiertos van con la cuenta y cada persona recibe «Te han asignado N cuentas» (Sugerencias y Telegram). País en la ficha de la cuenta (la región se deduce), columna Responsable en Cuentas y aviso de cuentas sin responsable. Migración 0029.

### Feedback de la configuración de Postin V2 (21 oct), una rama por fase

- [x] Fase 0 — Confianza en el guardado (rama feedback/fase-0-confianza): el win rate 0 se guarda (la base de datos lo rechazaba); segmentos que se pueden eliminar con el impacto a la vista; validación por celda que nombra el campo; los guardados solo dicen «Guardado» si el servidor confirma la fila; Conocimiento no crea documentos vacíos; el hito de posicionamiento exige el marco de Dunford y la IA lo rellena; una cuenta solo con nombre ya no puntúa 100. Pendiente de ver a mano: Ctrl+A en los campos (sin causa en el código).
- [x] Fase 1 — Una sola verdad en los datos (rama feedback/fase-1-datos): cobertura calculada en un solo sitio (src/lib/coverage.ts) para Métricas, la sugerencia y el Asesor, con los deals sin fecha aparte; las sugerencias abiertas actualizan su texto; el CSV enseña y deja cambiar qué campo rellena cada columna y avisa si los deals entran sin fecha de cierre; el embudo cuenta solo las etapas que el lead pasó de verdad («entrada directa»); todo deal nace con cuenta; fechas en día/mes/año; cuota con unidad y moneda; prioridad y nota del segmento en su campo; al crear la empresa se elige plantilla de segmentos o empezar de cero; el ACV de ejemplo sale de tus segmentos. Pendiente: juegos de benchmarks para ticket bajo (necesitan cifras con fuente).
- [x] Fase 2 — Configuración que se entiende (rama feedback/fase-2-configuracion): qué da cada vía y cuánto tarda; caja de texto grande con contador; progreso por etapas en la propuesta de la IA; las preguntas de la IA quedan en Sugerencias hasta que alguien las cierra; la revisión se actualiza al editar y dice qué se guardó; pasos en orden fijo y los completados no invitan a duplicar; tabla de segmentos en dos bloques; importar cuentas por CSV (Cuentas y configuración); «+ Nuevo deal» en Pipeline con cuenta, segmento y etapa; etapas Descubrimiento y Demo / prueba; nombre de la empresa para los documentos. Pendiente: etapas configurables y leer documentos de Drive o Notion (piezas grandes, después de la decisión de la Fase 4).
- [x] Fase 3 — Blindar la capa de IA (rama feedback/fase-3-ia): los documentos del Ciclo GTM leen ya Conocimiento (las Reglas y los documentos marcados como obligatorios) y guardan sus fuentes; revisiones y debates respetan las reglas; un documento aprobado se versiona (crear v2, retirar aprobación); progreso por etapas en borradores y revisión profunda; Retro y Win/Loss bloqueados sin deals cerrados; la frase de posicionamiento se arma con fragmentos limpios y cada campo dice dónde encaja; la IA rellena el pitch corto; los textos públicos son borrador interno hasta aprobarlos; avisos que se cierran solos; la conexión MCP visible desde la configuración. Pendiente de reproducir: el primer clic en «Borrador con IA» sin efecto.
- [x] Fase 4 — Lo que no espera a la decisión (rama feedback/fase-4-integraciones): «Integraciones» pasa a «Conexiones», separa lo que se conecta de verdad hoy (webhook, CSV, MCP; Telegram y email con su paso pendiente) del plan de herramientas que marca el equipo, y lista lo que aún no tiene conexión nativa (Stripe, CRMs). Pendiente de decisión de Fede: CRM propio, capa sobre el CRM del cliente o híbrido; y Stripe como primera integración nativa.
- [x] Etapas del pipeline por empresa (rama feature/configurable-stages; decisión de Fase 4: híbrido, CRM ligero propio + conectores): renombrar, reordenar, añadir y borrar etapas abiertas con su probabilidad y su bloque del tablero; Ganado y Perdido fijos pero renombrables; la base de datos impide borrar una etapa con deals o quedarse sin etapas abiertas, un deal sin etapa o con una que la empresa ya no tiene (también el que crea un lead al pasar a Oportunidad) nace en la primera etapa abierta con su probabilidad, y una clave foránea impide deals en etapas inexistentes. El webhook y el CSV reconocen por su nombre las etapas que crea la empresa. Pipeline, Inicio, Métricas, Asesor, informe semanal, avisos de MEDDPICC, agente y MCP usan las etapas de cada empresa. Diseño tomado del CRM de Postin en Lovable, reescrito con organización y permisos.
- [x] Productos y líneas de oferta con margen (rama feature/products-margin): catálogo en «Productos» (precio y coste por periodo, cobro mensual, anual o pago único, en la moneda de la empresa); cada deal lista qué incluye con cantidad, precio, descuento y coste copiados del catálogo; la base de datos recalcula el importe (ACV: las líneas recurrentes de un año) y el margen del deal, y suma aparte los pagos únicos, que no cuentan en el ACV; «+ Nuevo deal» y el agente pueden crear un deal con producto (list_products). En la cobertura por segmento, el payback por trimestre, el tablero de Inicio y la herramienta MCP de cobertura, el margen de los deals ganados con líneas en los últimos 12 meses se usa después del margen real del presupuesto y antes del presupuestado y del objetivo (el panel «Presupuesto vs real» sigue usando solo el presupuesto). Sin rol de precios (Owner, Sales Leader, Deal Desk) se añaden productos a precio de catálogo y solo se cambia la cantidad; los descuentos van por Deal Desk. Una pantalla, el agente o un webhook que escriben el importe de un deal con líneas no lo pisan. Diseño tomado del CRM de Postin en Lovable, reescrito con organización y una sola moneda.
- [x] Arreglos de la prueba de configuración desde cero (22 oct, rama fix/setup-test-findings): un panel o diálogo que se cierra ya no recibe clics (causa probable de F-35); F-25 era el atajo de Mac (Ctrl+A no selecciona, Cmd+A sí); la empresa nueva empieza sin segmentos salvo que se elija la plantilla, también desde el selector; el paso de segmentos dice cuáles faltan y cómo quitar los que no son tuyos; la IA propone la cuota del trimestre, el margen de sus segmentos y un ACV de precio único en vez de dejarlo vacío; los segmentos nuevos ya no nacen con un 80 % de margen que nadie ha puesto.
- [x] Stripe (rama feature/stripe-metrics): el Owner pega en Conexiones una clave restringida de solo lectura, que se guarda cifrada en Vault y solo el servidor puede leer; Nokko lee las suscripciones al conectar, al pulsar «Leer ahora» y cada 6 horas, y guarda MRR, ARR, clientes de pago, pruebas, altas, bajas y churn de 30 días. Métricas lo muestra con su fecha y el agente y MCP lo consultan (get_stripe_metrics); los ingresos solo los ven Owner, Sales Leader y Deal Desk. Solo se aceptan claves restringidas (nunca sk_). Una prueba cancelada no es baja, un cambio de plan no es alta ni baja, y otras monedas se muestran aparte, sin convertir.
- [x] Plantilla de ticket bajo (rama feature/low-ticket-template): al crear una empresa se puede empezar con Self-service (menos de 1.200 al año; sin win rate, la conversión de prueba se sigue en el embudo de pruebas) y Venta asistida (1.200–5.000, win rate 19 %, ciclo estimado de 60 días), ambos con payback de 12 meses y margen del 77 %, sin CAC fijado. Churn, NRR (85 %, ChartMogul) y las fuentes de cada cifra van en las notas del segmento, que Estrategia muestra en «Notas y fuentes de los segmentos» y el Asesor GTM recibe. Benchmarks aprobados por Fede el 22 de octubre de 2026.

### Fase B (necesita decisión de Fede)

- [ ] Elegir proveedor de datos para señales, cuentas similares y contactos. Comparativa hecha (ver el documento del proyecto); la decisión real es con quién firmar un acuerdo de embed: Apollo (Data Reseller Program) o Lusha (Lusha as a service). Clay no como backend.
- [ ] Descartado: señales de quién interactúa con posts de competidores o influencers en LinkedIn (sin API oficial, riesgo legal).

### Más adelante

- [ ] WhatsApp (el agente ya es independiente del canal).
- [ ] Lanzar el Asesor GTM desde el agente.
- [ ] Sincronización nativa con un CRM (HubSpot, Pipedrive, Attio, Salesforce) si el cliente lo usa; hoy entra por webhook/Zapier.
- [x] Google Drive (Drive de Fede, una carpeta por empresa y por cuenta): importar al hub y a la configuración, guardar plan/propuesta/documentos del ciclo/docs del hub, agente y MCP
- [x] Apify: LinkedIn (publicaciones de cuentas y stakeholders, ofertas de empleo) en Señales y research; battlecards desde reseñas de G2; agente y MCP
- [ ] n8n: avisar de eventos, lanzar flujos a mano, panel de flujos, agente/MCP (Owner y Sales Leader). Bloqueado: el usuario canceló la conexión y lo deja para más tarde
- [x] PostHog por empresa: funnel self-service, uso por cuenta, avisos de PQL y caída de uso, agente/MCP; medición de Nokko retirada
- [x] Inngest: procesos por empresa con reintentos, enriquecimiento de leads nuevos, tareas largas en segundo plano, secuencia de seguimiento con esperas
- [x] Inngest sincronizado con https://nokko.ai/api/public/inngest (24 oct); latido verificado. Volver a sincronizar (PUT a esa dirección) tras publicar cambios en las funciones
- [x] Parallel: informe profundo de cuenta, listas de cuentas por ICP, completar cuentas en tabla, tercera fuente de búsqueda; agente y MCP
- [x] Logo.dev: logos de empresa en Cuentas, ficha, Leads, Pipeline y listas por ICP
- [x] Calificación de leads con IA (Jev): encaje, intención, cargo, propuesta de etapa y segmento; pesos editables
- [x] Chat del agente sin respuesta: Gemini cambió el formato de las llamadas a herramientas; corregido
- [x] Logos de empresa en color (variante oscura en modo Tinta)
- [x] Conocimiento: pestaña «Drive por cuenta» con todos los documentos guardados en Drive, resumen y fecha

### Nokko decide, recuerda y se adelanta (plan aprobado 24 oct)
- [x] Fase 1a: menú en 5 bloques (Hoy, Vender, Estrategia, Conocimiento, Ajustes)
- [x] Fase 1b: reglas del orquestador (catálogo de necesidades, elección de servicios, límite 80/100 %) y tablas de gasto
- [x] Fase 1c: «Completar datos» por necesidad (Apollo→Clay), gasto registrado en investigación, panel de gasto y límite en Conexiones, herramientas complete_account e integration_budget (agente y MCP)
- [x] Fase 1d: «Buscar personas clave» (mapa de poder) y «Buscar empresas por ICP» (Cuentas, con búsqueda a fondo) por necesidad; agente/MCP find_key_people y find_icp_companies
- [x] Fase 2: memoria (negocio, usuario, cuenta, resultados, tareas); aprende de chats, notas de reunión y decisiones sobre sugerencias; el agente la lee; pantalla Memoria (Empresa, Mío, Cuentas)
- [x] Fase 3a: resumen en Inicio (lo que hice solo · necesita tu decisión · hoy)
- [x] Fase 3b: Descubiertos semanal (empresas con filtro de encaje por IA, contactos de cuentas objetivo, competidores; aceptar/descartar con motivo en memoria)
- [x] Fase 3c: piloto automático (investigar cuentas nuevas, preparar reuniones la víspera, repasar cuentas que se enfrían; «Hazlo ahora» en Inicio)
- [ ] Fase 3d: email diario 8:00 (necesita dominio de envío)
- [x] Flujo completo del lead nuevo: cuenta encontrada o creada → datos de la empresa (Apollo, luego Clay) → personas clave → propuesta de IA en Sugerencias; panel «Flujo de entrada» en la ficha con «Repetir el flujo»; funciona sin Inngest (al crear el lead y cada hora)
