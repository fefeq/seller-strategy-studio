# Roadmap
## Cola de Fede — 13-11-2026
Gate de entrada abierto tras cierre autorizado de F1–F11 y verificación sobre 734c202 (13-11-2026). Autorización general de Fede recibida a las 14:08 UTC: guardar cada SDD y construir sin esperar confirmación entre entregas. Mantener las paradas obligatorias, ninguna prueba existente modificada y suite completa verde e informe antes de la siguiente entrega. La revisión independiente de NK-0176 sigue pendiente, pero la autorización permite continuar la cola.
- [x] NK-0176: SDD corto redactado en docs/sdd/SDD-20261113-linkedin-blocker-d2.md; solo texto del bloqueador y cierre D2.
- [x] NK-0176: implementar tras aprobación y emitir informe; 5573/5573, checker limpio, build automático OK y navegador verificado.
- [ ] NK-0176: revisión independiente y aceptación final de la entrega por Fede; SDD En curso, no se declara gate técnico.
- [x] NK-0159: SDD y proyección de contadores dentro del paso durable; prueba nueva falló primero y después pasa; pruebas existentes intactas, suite 5574/5574 y compilación automática OK.
- [x] NK-0159: bloqueo de tipos cerrado con resultado externo de Claude comunicado por Fede: main 47b0f81, tsc --noEmit limpio en Node 22. No ejecutado por Lovable; Inngest alojado sigue sin comprobar (no desplegar).
- Regla de continuación 14:25 UTC: tipos sin comprobar por restricción del entorno se informan, no detienen entregas; Fede verifica por lotes.
- [x] NK-0160: SDD y complemento AST de títulos/nombres, guardia nueva, escáner protegido intacto; suite 5584/5584, compilación automática OK e informe. Tipos sin comprobar por restricción del entorno.
- [ ] NK-0177: SDD para comportamiento personal/equipo, no solo redacción.
- [ ] NK-0173: SDD 1–3; no escribir 2b. Estado Apollo, regla graduada, gasto registrado y manual con coste sin pausa al límite.
- [ ] NK-0168: SDD 1 (registro, plantilla SDD, EXECUTION.md, nokko-shape), luego 2 y 3.
- [ ] NK-0171: tanda 0 con parámetro opcional «solo contacto verificado».
- [ ] NK-0167: SDD 1→2→3→4; migración de existentes bloqueada hasta cuatro conteos de lectura y autorización.
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
