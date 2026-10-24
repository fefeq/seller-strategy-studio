# Roadmap
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
- [ ] P2 Transiciones, foco guiado, primeros pasos

## Integrar RevOps + Finance + Postin CRM (plan aprobado 2026-10-24)
- [x] Fase 1 RevOps en Métricas (embudo conciliado, perdidos, cohortes, tendencias) + Métricas por secciones
- [ ] Fase 1b herramientas de agente/MCP RevOps
- [x] Fase 2a Finanzas en Métricas: presupuesto, gasto real, margen y ROI (datos metidos en Nokko)
- [ ] Fase 2b Finanzas completa: previsión de caja, cierres mensuales, agente/MCP
- [ ] Fase 3 CRM: actividades, ofertas, plantillas, calendario, Deal Coach, equipos
- [ ] Fase 4 importar datos reales — espera CSV del usuario
