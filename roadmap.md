# Roadmap
## Cola de Fede — 13-11-2026
Gate de entrada abierto tras cierre autorizado de F1–F11 y verificación sobre 734c202 (13-11-2026). Solo redactar NK-0176; no construir sin aprobación. Mandan docs/decisiones-fede-20261113.md; PRD aprobado no autoriza implementación. Un SDD en docs/sdd/ cada vez, aprobación de Fede antes de construir e informe antes del siguiente.
- [x] NK-0176: SDD corto redactado en docs/sdd/SDD-20261113-linkedin-blocker-d2.md; solo texto del bloqueador y cierre D2.
- [ ] NK-0176: implementar y emitir informe (bloqueado: aprobación de Fede del SDD y de las tres expectativas de texto protegidas).
- [ ] NK-0159: SDD corto, después de la entrega anterior.
- [ ] NK-0160: SDD corto, después de la entrega anterior.
- [ ] NK-0177: SDD para comportamiento personal/equipo, no solo redacción.
- [ ] NK-0173: SDD 1–3; no escribir 2b. Estado Apollo, regla graduada, gasto registrado y manual con coste sin pausa al límite.
- [ ] NK-0168: SDD 1 (registro, plantilla SDD, EXECUTION.md, nokko-shape), luego 2 y 3.
- [ ] NK-0167: SDD 1→2→3→4; migración de existentes bloqueada hasta cuatro conteos sobre copia y autorización.
- [ ] NK-0171: tanda 0 con parámetro opcional «solo contacto verificado».
- [ ] NK-0174: SDD 1; Workspace Internal, solo Fede hasta confirmación legal para otros buzones.
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
- Heredados NK-0159 y escáner NK-0160: siguen en la cola anterior; no iniciados. NK-0176 espera aprobación.

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
