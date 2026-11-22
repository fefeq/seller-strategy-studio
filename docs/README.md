# Documentación de NOKKO

Índice de la documentación técnica. Se escribió leyendo el código del repo (2026-11-06; actualizado 2026-11-16); lo no comprobado va marcado como **[Por verificar]**.

## Por dónde empezar

| Si quieres… | Lee |
| --- | --- |
| Entender qué es NOKKO y arrancarlo | [`../README.md`](../README.md) y [`DESARROLLO.md`](DESARROLLO.md) |
| Ver cómo encaja todo | [`ARQUITECTURA.md`](ARQUITECTURA.md) |
| Tocar el esquema, RLS o migraciones | [`BASE-DE-DATOS.md`](BASE-DE-DATOS.md) |
| Añadir o cambiar herramientas del agente o MCP | [`AGENTE-Y-MCP.md`](AGENTE-Y-MCP.md) |
| Trabajar con trabajos en segundo plano, integraciones o secretos | [`INTEGRACIONES-Y-SEGUNDO-PLANO.md`](INTEGRACIONES-Y-SEGUNDO-PLANO.md) |
| Cambiar una pantalla o el diseño | [`PANTALLAS.md`](PANTALLAS.md) |
| Proponer un cambio (SDD, factory, gate) | [`PROCESO.md`](PROCESO.md) |
| Saber qué está roto, obsoleto o sin decidir | [`ESTADO-Y-DEUDA.md`](ESTADO-Y-DEUDA.md) |

## Mapa de `docs/`

```
docs/
  README.md                      Este índice
  ARQUITECTURA.md                Capas, convenciones, decisiones
  BASE-DE-DATOS.md               Esquema, multitenant, RLS, migraciones
  AGENTE-Y-MCP.md                Agente y servidor MCP
  INTEGRACIONES-Y-SEGUNDO-PLANO.md  Inngest, cron, proveedores, secretos, seguridad
  PANTALLAS.md                   Rutas, navegación, pantallas, diseño
  PROCESO.md                     Factory, SDD, PRD
  DESARROLLO.md                  Guía de desarrollo y despliegue
  ESTADO-Y-DEUDA.md              Hallazgos y preguntas abiertas
  factory/                       Software factory: README, GROUND-RULES, plantillas
  prd/                           PRD (1)
  sdd/                           SDD (100), EXECUTION.md, AUDIT, anexos
  plan/                          Plan e informe final de la ronda UX (2026-11-15)
  ux-audit/                      Auditoría UX de 42 rutas
  verificacion-20261114/         Evidencias de verificación
  ola-*-informe-*.md             Informes de las olas UX
  lovable-run-report.md          Informe de ejecuciones de Lovable
```

## Archivos de reglas fuera de `docs/`
- [`../AGENTS.md`](../AGENTS.md): reglas de arquitectura y convenciones del repo (incluye el bloque de conexión con Lovable).
- [`../src/lib/AGENTS.md`](../src/lib/AGENTS.md): reglas del dominio (agente, MCP, métricas, Theory U, onboarding…). Léelo antes de tocar `src/lib/`.
- [`../roadmap.md`](../roadmap.md): cola de trabajo viva con los encargos y tareas abiertas.

## Cómo mantener esta documentación
- Las cifras (herramientas, migraciones, tests, rutas) se cuentan sobre el código; **no las estimes**. Si cambian, recuéntalas.
- El estado de un SDD vive en su cabecera; los índices no lo repiten.
- Si algo contradice al código, gana el código: corrige el documento.
- No incluyas datos de clientes ni emails personales.
