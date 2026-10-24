# Todo en segundo plano, y Nokko te avisa de lo que pasó

## Objetivo
Ninguna acción pesada bloquea la pantalla. Al pulsar un botón, Nokko responde al momento («En marcha, te aviso»), trabaja en segundo plano y te notifica el resultado: qué hizo, qué encontró, cuánto costó y qué necesita de ti.

## Qué pasa a segundo plano
- Completar datos de cuenta (Apollo → Clay → web).
- Buscar personas clave y Buscar empresas por ICP.
- Investigar cuenta, refrescar señales y noticias (Firecrawl, Perplexity, Parallel).
- Calificar leads con Jev (lotes de hasta 25) y flujo de entrada de leads.
- Aprobar lotes de importación grandes.
- Redactar artefactos, revisión profunda y debates multiagente.
- Informe semanal, biblioteca de playbooks, búsqueda de Descubiertos y «Hazlo ahora» del piloto automático.
- Sincronizar PostHog y resúmenes de Drive en lote.

Las lecturas rápidas (consultas, guardar un campo) siguen siendo inmediatas.

## Experiencia de usuario
1. **Al lanzar:** el botón pasa a «En marcha» y aparece un aviso breve. Puedes salir de la pantalla.
2. **Mientras corre:** la ficha afectada (cuenta, lead, debate) muestra «Trabajando · paso actual». Se puede cancelar.
3. **Al terminar:** aviso con el resultado en palabras: «Completé Typeform: sector y tamaño (Apollo · 0,02 €). Encontré 4 personas clave.» Con enlace directo al resultado.
4. **Si falla:** qué pasó y qué hacer (mismo estilo que los errores actuales), con «Reintentar».
5. **Si necesita decisión:** el aviso enlaza a Sugerencias o a la cuarentena de importación.

## Centro de avisos
- Campana en la barra superior (escritorio y móvil) con contador de no leídos.
- Panel con dos pestañas: «En marcha» (trabajos activos con progreso) y «Avisos» (terminados, fallidos, necesitan decisión).
- Marcar como leído, leer todo, y filtrar por tipo.
- Cada persona ve los avisos de lo que lanzó y de sus cuentas; Owner y Sales Leader ven también los de toda la empresa en un filtro aparte.
- Los trabajos del piloto automático aparecen como «Lo hice solo», igual que en el resumen de Inicio.

## Canales
- **Fase 1:** dentro de la app, en tiempo real.
- **Fase 2:** Telegram para quien lo tenga enlazado (solo terminados importantes, fallos y decisiones), con preferencias por persona.
- **Fase 3:** resumen en el email diario de las 8:00, cuando exista el dominio de envío.

## Preferencias
En el perfil: qué avisos recibir y por qué canal (todos, solo importantes, solo decisiones). Silencio nocturno para Telegram.

## Fases
1. Centro de avisos en la app y migración de completar cuenta, buscar personas, buscar por ICP y calificar leads.
2. Migración del resto de acciones pesadas (investigación, debates, artefactos, informes, importaciones, PostHog, Drive).
3. Cancelación y reintento, preferencias por persona.
4. Telegram.
5. Email diario (bloqueado hasta tener dominio de envío).

## Detalles técnicos
- Reutilizar `background_jobs` y Inngest (ya sincronizado en `/api/public/inngest`). Ampliar con `kind`, `requested_by`, `target_type`/`target_id`, `step`, `progress`, `result` (jsonb con resumen, coste y enlace), `error`, `cancel_requested`.
- Nueva tabla `notifications` (`org_id` por defecto `current_org()`, `user_id`, `job_id`, `kind` done/failed/needs_decision/autopilot, `title`, `body`, `link`, `read_at`) con RLS: cada usuario lee las suyas; liderazgo lee las de la empresa. GRANT explícitos. Realtime activado.
- Un único `startJob({ kind, input })` en server function autenticada: valida rol y presupuesto, crea la fila y envía el evento Inngest; si Inngest no responde, ejecuta en `waitUntil` como respaldo y lo recoge el sweep horario.
- Cada función Inngest usa un envoltorio común que actualiza paso/progreso, escribe el resultado y crea la notificación; los mensajes pasan por `errorText()`.
- Lógica pura testeada en `src/lib/jobs.ts`: redactar el texto del aviso desde el resultado, decidir destinatarios por rol, deduplicar trabajos repetidos sobre la misma cuenta.
- Front: hook `useJob(target)` para el estado en fichas y `NotificationBell` en el shell con suscripción realtime; los botones existentes cambian la llamada directa por `startJob`.
- Agente y MCP: las herramientas pesadas devuelven «en marcha» con id de trabajo; nueva herramienta `job_status` y `list_notifications`.
- Tests: destinatarios por rol, texto con coste, dedup, y que un miembro no ve avisos de otros.
