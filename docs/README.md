# Documentación de NOKKO

Índice de la documentación técnica. Se escribió leyendo el código del repo (2026-11-06; cuerpo actualizado el 2026-11-22 sobre `main`); lo no comprobado va marcado como **[Por verificar]**.

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
| Saber qué está roto, bloqueado o sin decidir | [`ESTADO-Y-DEUDA.md`](ESTADO-Y-DEUDA.md) |
| Saber quién construye hoy y con qué reglas | [`decisiones-fede-20261113.md`](decisiones-fede-20261113.md) |
| Ver qué entregó la última ronda | [`plan/INFORME-FINAL-UX-20261115.md`](plan/INFORME-FINAL-UX-20261115.md) |

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
  ESTADO-Y-DEUDA.md              Hallazgos, bloqueos y preguntas abiertas
  decisiones-fede-20261113.md    Reglas de construcción desde el 2026-11-13 (Lovable en main)
  UX-INFORME-20261031.md         Informe UX de octubre
  UX-IMPLEMENTACION-20261031.md  Implementación de ese informe
  business-lines-copy-operation.md  Procedimiento de la copia de líneas de negocio (0096)
  factory/                       Software factory: README, GROUND-RULES, plantillas (brief, prd, sdd, result)
  prd/                           PRD (11) y anexos
  sdd/                           SDD (96), README, EXECUTION.md, AUDIT, anexos
  plan/                          PLAN-UX-20261115 e INFORME-FINAL-UX-20261115
  ux-audit/                      AUDITORIA-UX-20261114
  verificacion-20261114.md       Informe de verificación del 2026-11-14
  verificacion-20261114/         Capturas de esa verificación
  ola-0-informe-20261114.md      Informe de la ola 0
  ola-1-informe-20261114.md      Informe de la ola 1
  r1-talpio-real-test-20261114.md  Prueba real R-1
  lovable-run-report.md          Informe de ejecuciones de Lovable
  gtm-lab/                       Evaluación de GTM Lab
  archivado/                     SDD superados (prefijo SUPERADO-)
```

## Archivos de reglas fuera de `docs/`
- [`../AGENTS.md`](../AGENTS.md): reglas de arquitectura y convenciones del repo (incluye el bloque de conexión con Lovable).
- [`../src/lib/AGENTS.md`](../src/lib/AGENTS.md): reglas del dominio (agente, MCP, métricas, Theory U, onboarding…). Léelo antes de tocar `src/lib/`.
- [`../roadmap.md`](../roadmap.md): cola de trabajo viva de Lovable (encargos y tareas abiertas, por fecha). Ya no está parado en 2026-10-24.
- `../.factory/ledger.json`: tickets de la factory de Claude (188 a 2026-11-22). Lo de Lovable no pasa por aquí: cruza ambos antes de dar algo por pendiente.
- `../.lovable/plan/`: 28 planes de Lovable, sin índice.

## Cómo mantener esta documentación
- Las cifras (herramientas, migraciones, tests, rutas) se cuentan sobre el código; **no las estimes**. Si cambian, recuéntalas.
- El estado de un SDD vive en su cabecera; los índices no lo repiten.
- Si algo contradice al código, gana el código: corrige el documento.
- No incluyas datos de clientes ni emails personales.
