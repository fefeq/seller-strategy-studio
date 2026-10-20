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
- [x] Textos revisados con la guía de voz: sin exclamaciones ni emoji, sin inglés visible, vocabulario de producto, estados vacíos con qué hacer; la IA tutea y empieza por la conclusión

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

- [ ] 1. Puntuación de leads y cuentas (PR #1).
- [x] 2. Umbral de enfriado según el ciclo real del segmento (un cuarto del ciclo, entre 14 y 60 días; ajustable por empresa en Pipeline); sustituye el umbral fijo de 14 días en el detector, la Pipeline y el agente.
- [ ] 3. Informe semanal del lunes en la app, por email con Resend y por Telegram.
- [ ] 4. Seguimientos día 3/7/14: detector + borrador del agente en Sugerencias.
- [ ] 5. Biblioteca de jugadas (discovery, objeciones, demo, negociación).
- [ ] 6. Notas de llamada en 5 líneas + desmontaje de la llamada por la IA.
- [ ] 7. Reparto de cuentas propuesto por la IA; el Owner aprueba.

### Más adelante

- [ ] WhatsApp (el agente ya es independiente del canal).
- [ ] Lanzar el Asesor GTM desde el agente.
- [ ] Sincronización nativa con un CRM (HubSpot, Pipedrive, Attio, Salesforce) si el cliente lo usa; hoy entra por webhook/Zapier.

