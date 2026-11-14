# Roadmap
## Ola 0 — cierre adicional autorizado 14-11-2026
- [x] Corregir el aviso de Respuestas y catalogar únicamente los 23 campos pendientes: cuatro pruebas nuevas, suite 4729/4729 y compilación automática OK; aviso visto con sesión en escritorio/móvil claro/oscuro. Pruebas existentes, Gmail y respaldo de IA intactos; sin publicación. Informe actualizado; lint global con errores ajenos al alcance y tipos manuales sin comprobar.
## Cola de Fede — 13-11-2026
- [x] Pedido 14-11 00:58 UTC: NK-0167 SDD 2 U-1, núcleo de edición y escritura doble implementado; valida roles, ticket, tope y nombre; reintento de sesión no duplica líneas. Siete pruebas nuevas; suite 5852/5852, 368 archivos, build automático OK 00:59:43 UTC. Pruebas protegidas intactas. Sin pantalla ni cambios reales de datos en esta unidad, IA/gasto/publicación. Tipos sin ejecución manual por restricción del entorno.
- [ ] NK-0167 SDD 2 U-2/U-3: conectar hook miembro y pantalla de líneas, repetir copia administrativa y comprobar edición/guardado en empresa sintética escritorio/móvil claro/oscuro. Project monitoring señala altas cerradas: no reabrir registros sin autorización, cierre previo de Fede conservado; incidencia no reclamada ni resuelta porque este pedido no solicita cambiar las altas.
- [x] Pedido 14-11 00:44 UTC: U-2 aplicada (0095): integridad, RLS y RPC de principal/borrado; catálogo completo. Nueve pruebas nuevas, suite 5835/5835 y compilación automática OK 00:48:34 UTC. Lectura real confirma tabla vacía, RLS, cuatro políticas y enlace de segmentos; sin copia ni IA/publicación. Concurrencia real de dos conexiones y revisión independiente pendientes.
- [x] Pedido 14-11 00:51 UTC: continuar sin pedir permiso. NK-0167 U-3 implementada (0096), copia específica autorizada ejecutada: 1 principal, repetición 0 cambios; diagnóstico original conservado, segmentos sin enlaces. Siete pruebas nuevas; suite 5842/5842, 367 archivos y compilación automática OK 00:57:11 UTC. U-4 documentación actualizada; cierre técnico condicionado a concurrencia real y revisión independiente. Tipos sin comprobar por restricción del entorno. Sin IA, gasto ni publicación.
- [ ] NK-0167 SDD 1: concurrencia real de dos conexiones y revisión independiente pendientes; no hay conexión de prueba aislada suministrada ni revisión independiente realizada. SDD 2 (pantalla de líneas), SDD 3 (consumidores) y SDD 4 (agente/MCP) aún por entregar, en orden estricto; no iniciar cambios de pruebas protegidas sin autorización específica.
- [x] Pedido 14-11 00:27 UTC: checkpoints renombrados a 0094 (solo archivo/tag; idx/when/SQL/snapshots intactos), check y suite 5816/5816 verdes. U-5 visible en /plays: activar/pausar y resultado manual con rol/empresa comprobados, pausas de seguridad intactas, evidencia/sugerencias y costes separados. Navegador autenticado guardó/releyó resultado sintético y se restauró a null; Postin restaurada. Sin publicar ni gasto; revisión independiente pendiente, overflow de 6 px en barra móvil existente.
- [x] Pedido 14-11 07:55 UTC: clave OpenRouter renovada mediante formulario seguro, autenticación HTTP 200. Nueva ejecución R-1 expresamente autorizada: 6dbb089a-523b-46a9-abde-5e0cb22ac65b, estado done, 3/3 pasos committed, 0 evidencias y 0 sugerencias (sin señal válida seleccionada). IA medida 0,001716 USD, búsqueda estimada 0,01 EUR. Play dejado pausado sin bloqueo de proveedor. Sin envíos/publicación; comprobación visual de actividad pendiente tras dos fallos del selector de empresa, Postin no se cambió.
Gate de entrada abierto tras cierre autorizado de F1–F11 y verificación sobre 734c202 (13-11-2026). Autorización general de Fede recibida a las 14:08 UTC: guardar cada SDD y construir sin esperar confirmación entre entregas. Mantener las paradas obligatorias, ninguna prueba existente modificada y suite completa verde e informe antes de la siguiente entrega. La revisión independiente de NK-0176 sigue pendiente, pero la autorización permite continuar la cola.
- [x] NK-0176: SDD corto redactado en docs/sdd/SDD-20261113-linkedin-blocker-d2.md; solo texto del bloqueador y cierre D2.
- [x] NK-0176: implementar tras aprobación y emitir informe; 5573/5573, checker limpio, build automático OK y navegador verificado.
- [ ] NK-0176: revisión independiente y aceptación final de la entrega por Fede; SDD En curso, no se declara gate técnico.
- [x] NK-0159: SDD y proyección de contadores dentro del paso durable; prueba nueva falló primero y después pasa; pruebas existentes intactas, suite 5574/5574 y compilación automática OK.
- [x] NK-0159: bloqueo de tipos cerrado con resultado externo de Claude comunicado por Fede: main 47b0f81, tsc --noEmit limpio en Node 22. No ejecutado por Lovable; Inngest alojado sigue sin comprobar (no desplegar).
- Regla de continuación 14:25 UTC: tipos sin comprobar por restricción del entorno se informan, no detienen entregas; Fede verifica por lotes.
- [x] NK-0160: SDD y complemento AST de títulos/nombres, guardia nueva, escáner protegido intacto; suite 5584/5584, compilación automática OK e informe. Tipos sin comprobar por restricción del entorno.
- [x] NK-0177: filtro de equipo en consulta compartida, prueba nueva falló primero, 90/90 seleccionadas y 5585/5585 en suite, compilación automática OK e informe. Tipos sin comprobar por restricción del entorno; texto protegido conservado.
- [x] Bloque B: Fede autoriza plantilla del repositorio y guía documental de nokko-shape, sin activar ni ejecutar habilidad. SDD con estructura completa, PRD y decisiones enlazados.
- [x] NK-0173 SDD 1: modelo y esquema/retención autorizados, RLS y columnas reales leídas, pruebas nuevas, suite 5595/5595 y compilación OK. Herramienta generó 0088 duplicado, nuevo archivo/tag reparados a 0089; tipos sin comprobar por restricción del entorno.
- [x] NK-0173 SDD 2: estado de Apollo guardado al revelar (cliente privilegiado, org_id explícito), gasto registrado en los núcleos (pantalla, agente, MCP y orquestador), Q-6 aplicado (lo manual no se pausa y siempre registra), conservar y proponer en revealStakeholder; 3 pruebas nuevas fallaron primero, suite 5617/5617, build OK. Tipos sin comprobar por restricción del entorno. Aviso pendiente a NK-0171 (su PRD documenta lo contrario de Q-6).
- [ ] NK-0173 SDD 3: U-1–U-5 implementadas; catálogo completo, estado/fecha en las tres fichas, puerta y registro en agente/detector/followup durable, botón Verificar con coste existente. Suite 5648/5648 en 347 archivos y compilación automática OK 16:42:02 UTC; revisión visual CA-2/CA-8 pendiente porque navegador local solo muestra carga inicial y aborta módulos. Ninguna llamada de pago. Nunca 2b.
- [x] NK-0168 SDD 2: permiso acotado recibido para expectativa ✓ de strategy-screens.test.tsx:421; aún no modificada, no autoriza otras pruebas.
- [x] NK-0168: entregas 1 y 2 hechas (IconText, mazo, menú, Trash2/X en botones, guardias).
- [ ] Onboarding: presentación de hallazgos rediseñada (SDD-20261114-onboarding-hallazgos): propósito por fuente y guía de Confirmar/Editar/Descartar; guardado intacto. 21/21 regresiones, suite 5782/5783 (0093 heredado), build OK. Verificación visual pendiente: navegador con respuestas sintéticas no abrió la pantalla en dos intentos; gate independiente pendiente. Sin publicación.
- [ ] NK-0171: modelo, almacenamiento, biblioteca, propuesta y ejecución U-1..U-4b implementados; U-5 interfaz implementada y comprobada el 14-11. Pendientes revisión independiente, denegación OpenRouter y ejecución alojada sin publicar; herramientas del agente para activar/pausar a medida no incluidas en este pedido de interfaz.
  - [x] Pedido 23:43 UTC U-4b: adaptadores conectados; bloqueo del prefijo cerrado el 14-11 a 0094 sin reaplicar SQL, suite 5816/5816. Prueba real única R-1 previa detenida por denegación IA; no se repitió gasto.
  - [x] SDD 1 U-1: molde puro + Q-7 (model.ts, 25 pruebas).
  - [x] SDD 1 U-2: tablas por empresa con RLS y registro de coste; SDD 2 y 3 terminados. SDD 4 continúa arriba.
- [ ] NK-0167: SDD 1→2→3→4; conteos leídos y copia autorizada por Fede el 14-11. SDD 1 U-1/U-2 y catálogo implementados; copia repetible, cierre, pantalla y consumidores siguen pendientes, sin bloqueo externo de autorización.
- [x] NK-0174 SDD 1: Gmail de Fede conectado a Postin (somos@postinapp.com), solo lectura, puerta legal.
- [x] NK-0174 SDD 2: detección de respuestas (solo remitente y fecha), marca «respondió» y pausa de secuencia; pruebas OK. Pendiente: primera pasada real (corre en el trabajo horario publicado).
- [ ] NK-0174 SDD 3 (pedido de Fede 14-11 11:52 UTC): U-2 hecho 14-11 21:18 (docs/sdd/SDD-20261114-reply-inbox-3-u2.md): pasada horaria de hasta 10 respuestas, reserva antes de gastar sin replay, derivados privados con caducidad 30 días, recibos solo cifras, categoría y borrador en Respuestas; 9 pruebas nuevas. Pendiente: U-3 (resumen de estilo), revisión independiente y primera pasada real (corre solo publicado). U-1 núcleo aislado y adaptador privado Opus 5.5 entregados; 22 pruebas nuevas, suite 5941/5941 y compilación automática OK. Modelo elegido por Fede y confirmado en catálogo OpenRouter; sin respaldo, recogida de datos denegada y retención cero. U-2/U-3 pendientes: persistencia privada/retención, recibos durables e integración horaria, resumen de estilo y revisión independiente. Adaptador no conectado ni disponibilidad privada real probada. Sin publicación, envíos, lectura real ni gasto.
- [ ] NK-0174 SDD 4: U-1 hecho 14-11 — pantalla /replies de solo lectura (lead, fecha, persona/automática, filtros), enlace desde la tarjeta Gmail; 6 pruebas nuevas. Pendiente: categoría IA cuando SDD 3 U-2/U-3 se conecte, revisión visual.
- F12 decidido: documentos de onboarding-sources nunca se borran automáticamente. Sin publicar/desplegar; Torre de control GTM y Salida de Lovable aparcados.

## Verificación independiente (13-11-2026; prioridad antes de iniciativas nuevas)
- [x] F1: truncamiento de Drive visible y probado en el job.
- [x] F2: estado/políticas reales auditados; creación reproducible por API, no SQL; configuración real MIME sin restricción documentada.
- [x] F3: nuevas pruebas de RLS, referencias, presupuesto y fallos de Drive, sin editar pruebas existentes.
- [x] F4 (meQuery): devuelve null en la ventana de cierre; session-cache.test.ts sin cambios; prueba nueva me-session-ending.test.ts; useSetup/useLivePipeline probados. Fusionado con la solución de main.
- [x] F5: todos los archivos de producto permitidos pasan Prettier; cierre de alcance autorizado, sin formato de pruebas/autogenerados ni lint global declarado.
- [x] F6–F7: errores en español y notas de lectura fuera del recuento de hallazgos.
- [x] F8: subida, eliminación, límite y progreso indeterminado de fuentes.
- [x] F9: función UUID aplicada/probada; el prefijo 0087 duplicado se renombró a 0088_onboarding_source_uuid_guard (archivo y entrada del diario) al fusionar.
- [x] F10: validar source_status.
- [x] F11: documentación corregida y correspondencia de snapshots informada sin renombrarlos.
- [x] Checker de tipos permitido limpio; navegador real escritorio/375 px claro/oscuro e informe final. Servidor recompiló y sirve onboarding; build de producción no ejecutado (restricción del entorno).
- [x] Suite completa repetida sobre 734c202: 5570/5570 en Node 22.23.5; oj typecheck limpio. Node 26 y tsc literal no ejecutados.
- [x] F12: decisión documentada — los documentos de onboarding-sources nunca se borran automáticamente.
- Heredados NK-0159 y escáner NK-0160: siguen en la cola anterior. NK-0176 implementado y comprobado; revisión independiente pendiente.

## Segundo plano y avisos
- [x] Centro de avisos (En marcha / Avisos) y aviso automático al terminar cada tarea
- [x] «Completar datos» en segundo plano
- [x] Buscar personas clave, Buscar empresas por ICP y calificar leads en segundo plano
- [x] Resto de acciones pesadas: investigación web, novedades, research de personas, Descubiertos, piloto automático, informe semanal, PostHog, biblioteca de jugadas, debates, borradores, revisión a fondo, resúmenes de Drive en lote
- [x] Cancelar y reintentar; preferencias de avisos por persona (Equipo → Avisos)
- [x] Telegram: envío según preferencia y silencio nocturno (código listo)
- [ ] Telegram: conectar el bot y vincular cada persona (bloqueado: falta conectar Telegram)
- [x] Email diario 8:00 (Resend, avisos@nokko.ai, a cada miembro a su hora; requiere publicar para que salga solo)
- [x] Publicar para que el segundo plano de nokko.ai use el código nuevo

## Orden del código (plan aprobado 2026-10-24)
- [x] 1. Listas completas (fetchAll en Leads, Cuentas, Pipeline, Personas, Métricas, avisos)
- [x] 2. Errores visibles (Sugerencias, Parallel)
- [x] 3. Una regla de dominios y un formato de porcentaje
- [x] 4. Tablas antiguas marcadas como retiradas (borrarlas es un cambio que rompe y está bloqueado)
- [x] 5. Dividir archivos grandes
- [x] 6. Quitar `as any`
- [x] 7. Diseño: iconos, colores a mano, ventanas del navegador
- [x] 8. Precarga de pantallas

## Onboarding SDD
- [x] Esqueleto /onboarding con profundidad y reanudar
- [x] Diagnóstico GTM (5 arquetipos + filtro de etapa, tests)
- [x] Roadmap final y empresas nuevas entran al onboarding
- [x] Lectura en segundo plano con teletipo y coste previo
- [x] Aprobación por bloques con origen y nivel
- [x] Modo A fondo (mercado y competidores + opinión C-Levels por bloque), tarjeta en Inicio, versión corta para invitados
- [x] Umbrales de ticket: referencia de mercado 5K/50K (decidido)
- [x] Publicar nokko.ai, resincronizar el segundo plano y probar «Completar datos» en una cuenta real
- [x] Habilidad experto UX/UI B2B SaaS (auditoría → SDD → construir), con patrones de Clay, Maze, Notion, Linear, Attio, Stripe
- [x] Rediseño visual Ink + Lima (Space Grotesk + DM Sans, esquinas redondeadas)
- [x] P0-1 Menú corto + Más herramientas · P0-2 Inicio sin repeticiones
- [x] P1 ⌘K, Leads lista primero, tablas Estrategia, agente en barra, Sugerencias móvil
- [ ] P1 acciones masivas y vistas guardadas (espera decisión: ¿ahora o después?)
- [ ] P2 accesibilidad, cargas, ayudas

## Navegación simple y foco (plan aprobado 2026-10-24)
- [x] P0-2 Sugerencias tipo Tinder (mazo, gestos, deshacer)
- [x] P0-1 «Tu siguiente paso» en Inicio (mazo con sugerencias; falta sumar reuniones y deals en riesgo al orden)
- [ ] P0-2b Arrastrar en Pipeline, deslizar filas móvil, CSV arrastrable
- [ ] P0-3 Un botón principal por pantalla
- [ ] P1 Texto bajo demanda, Métricas/Estrategia en secciones, acciones en grupo + vistas guardadas, panel lateral
- [x] Guía «Primeros pasos» en Inicio (empresa, onboarding, búsqueda, Métricas)
- [ ] P2 Transiciones, foco guiado

## Integrar RevOps + Finance + Postin CRM (plan aprobado 2026-10-24)
- [x] Fase 1 RevOps en Métricas (embudo conciliado, perdidos, cohortes, tendencias) + Métricas por secciones
- [ ] Fase 1b herramientas de agente/MCP RevOps
- [x] Fase 2a Finanzas en Métricas: presupuesto, gasto real, margen y ROI (datos metidos en Nokko)
- [ ] Fase 2b Finanzas completa: previsión de caja, cierres mensuales, agente/MCP
- [ ] Fase 3 CRM: actividades, ofertas, plantillas, calendario, Deal Coach, equipos
- [ ] Fase 4 importar datos reales — espera CSV del usuario

## Empresas
- [x] Cualquier persona con sesión puede crear empresas (formulario «Nueva empresa», selector y paso de la guía)
- [x] Superadmin (cosentinofede@gmail.com) Owner de todas las empresas; Veta-i borrada
- [x] Verificación 14-11 (docs/verificacion-20261114.md): hallazgos onboarding vistos y corregido desbordamiento móvil de la barra superior; revisión independiente sin problemas en NK-0176, NK-0171, guía de hallazgos; NK-0174 SDD 1 enmendado y 2 menores corregidos; concurrencia real NK-0167 superada (PostgreSQL local, dos conexiones).
- [x] NK-0167: bloqueante de revisión corregido (paso de líneas se reinicia al cambiar de empresa, prueba nueva).
- [x] NK-0173: pase visual de los seis estados en la ficha de cuenta, claro/oscuro, escritorio/móvil (sin caso de email alternativo).
- [ ] Aceptación final de Fede: NK-0176, NK-0171, guía de hallazgos, NK-0174 SDD 1, NK-0167 SDD 1–3, NK-0173.
- [x] NK-0167 SDD 4: list_business_lines en Agente/MCP (proyección segura, nunca el ticket; probado).
- [x] NK-0171: list_custom_plays, activate_custom_play, pause_custom_play en Agente/MCP (mismas reglas que /plays; activar/pausar solo Owner/Sales Leader tras confirmación).

## Gate formal 14-11-2026
- [x] Pedido 15:07 UTC: Apollo limitado a 15 segundos, incluida lectura del cuerpo, sin reintento por timeout; 32/32 pruebas Apollo, compilación automática OK. R-1 Taplio c7f618a5 finalizó 3/3 pasos, 0 señales/sugerencias; IA medida 0,0011505 USD, búsqueda estimada 0,01 EUR. Jugada pausada y posicionamiento restaurado. Sin nuevo revelado ni publicación.
- [ ] Verificación residual de esta entrega: suite 5942/5943; safe-logs-notes.test.ts agota 5000 ms también en aislamiento, sin modificar la prueba protegida (parada tras dos fallos). Actividad real confirmada en base de datos; pase visual de esa ejecución pendiente: navegador abrió Postin, selector de empresa no se alcanzó.
- [x] NK-0176, guía de hallazgos, NK-0167 SDD 1–3 — aceptado por Fede
- [x] NK-0171 — R-1 Taplio ejecutado una vez, 0 señales válidas; requisito de aceptación de 1 señal real todavía no satisfecho. No repetir sin nueva autorización. Superado con Buffer.
- [ ] NK-0173 — contacto proporcionado y creado; revelado anterior quedó sin resultado confirmado. No reintentar: consumo Apollo incierto.
- [ ] NK-0174 SDD 1 — lead proporcionado y creado; revisión real previa devolvió 0 respuestas. Pendiente aceptación de Fede.

## Decisiones de Fede 2026-11-14 (plan completo)
- [x] NK-0173 aceptada tal cual (sin más revelados de Apollo).
- [x] Gmail: al desconectar se conservan los contadores (estado «disconnected», migración 0099).
- [x] Prueba lenta safe-logs-notes: el código de pruebas ya no llama a servicios externos reales (5,2 s → 0,2 s); prueba intacta.
- [x] NK-0171: búsqueda R-1 con Buffer hecha (ver abajo).
- [ ] NK-0174 SDD 3 U-2/U-3 y SDD 4 — pendientes.
- [ ] Telegram — falta el token del bot.
- [x] NK-0171 R-1 con Buffer (run 01d53a14, done): 4 señales reales válidas (retirada de Start Page y del API REST antiguo de Buffer), 4 sugerencias. Observado: las 4 sugerencias repiten las mismas 4 pruebas (una por cuenta) y no tienen borrador por falta de contacto. Jugada pausada, posicionamiento restaurado. Aceptada por Fede el 14-11; residuo: sugerencias repetidas por cuenta.
