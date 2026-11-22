# NOKKO

Estudio de estrategia go-to-market para equipos comerciales. Define tu estrategia (ICP, segmentos, posicionamiento, modelos de venta), gestiona cuentas, leads y pipeline, mide el embudo y trabaja con un agente de IA que **lee al momento y escribe solo tras tu confirmación**.

- **App**: https://nokko.ai
- **Repositorio**: `fefeq/seller-strategy-studio` (privado)
- **Idioma del producto**: español, tratamiento de «tú». El código y los commits, en inglés.
- **Documentación técnica completa**: [`docs/README.md`](docs/README.md)

> Este README es un resumen. Cada área tiene su documento en [`docs/`](docs/README.md). Lo que no se pudo comprobar leyendo el código va marcado como **[Por verificar]**.

## Qué hace

| Área | Qué incluye |
| --- | --- |
| **Estrategia** | ICP, segmentos, posicionamiento, mensajes, Modelos de venta por segmento, Diagnóstico AARRR, payback real, presupuesto vs real, revisión con IA, Brief GTM |
| **Pensamiento estratégico** | Theory U (recorrido, sensing, escucha, clínica de casos, prototipos), Asesor GTM, Debates multiagente, Ciclo GTM en 5 fases |
| **Cuentas y personas** | Cuentas con ABM y partners, ficha con plan, señales, stakeholders, reuniones y llamadas, Drive por empresa, base de personas |
| **Leads** | Entrada por webhook o CSV con cuarentena, cualificación en segundo plano, SLA, conversión por origen |
| **Pipeline** | Kanban con etapas configurables, MEDDPICC, líneas de producto, aprobaciones |
| **Métricas** | Embudo conciliado, perdidos, cohortes, tendencias (RevOps), CAC, finanzas (presupuesto, gasto, margen, ROI), Stripe, PostHog |
| **Sugerencias** | Mazo de tarjetas con gestos y 5 s para deshacer; motor de sugerencias estratégicas |
| **Agente** | Chat (con chips, listas y enlaces), dictado y lectura en voz, niveles Guiado/Copiloto/Autopilot por persona, Telegram (preparado, sin token) y servidor MCP. 143 herramientas en el manifest MCP |
| **Descubiertos e investigación** | Búsqueda de empresas, personas y competidores con Apollo, Clay, Parallel, Perplexity, Firecrawl y Apify |
| **Onboarding guiado** | Lectura en segundo plano, aprobación por bloques con origen, diagnóstico GTM, roadmap |
| **Avisos** | Centro de avisos, email diario a la hora de cada persona, informe semanal, Telegram con silencio nocturno |
| **Hoy y Conexiones** | Bandeja única en Hoy (sugerencias, aprobaciones, tareas, pendientes del agente), Respuestas de Gmail (solo superadmin hasta revisión legal), Conexiones con estado real y «Probar conexión», umbral de gasto del piloto automático (por defecto 0: todo gasto queda pendiente de confirmar) |
| **Multiempresa** | Cada empresa con espacio aislado (RLS) y roles propios; superadmins de plataforma |

Roles por empresa: `owner`, `sales_leader`, `marketing`, `sdr`, `ae`, `se`, `cs`, `deal_desk`, `enablement`. Solo el Owner borra, gestiona miembros e invitaciones.

## Cómo está construido

```
Navegador (React 19 · TanStack Router/Query) ──RLS──► Supabase (Postgres · Auth · Realtime · Vault)
        │                                                  ▲
        └── server functions (IA, secretos, integraciones) ┘
Rutas /api/public/*  (leads, accounts, Telegram, Apollo, cron, Inngest)
Ruta  /mcp           (asistentes externos con OAuth)
Inngest              (trabajos en segundo plano)
```

| Capa | Tecnología |
| --- | --- |
| App | TanStack Start 1.168 · TanStack Router 1.170 · React 19.2 · TypeScript · Vite 8 |
| Estilos | Tailwind CSS 4 · shadcn/ui (Radix) · tema «Ink + Lima» en `src/styles.css` |
| Datos | Supabase (Postgres + RLS + Auth + Realtime); migraciones SQL en `drizzle/migrations` |
| IA | Vercel AI SDK (`ai` 5) solo en servidor; OpenRouter (BYOK) → Gemini → Lovable AI Gateway |
| Segundo plano | Inngest 4 + ruta cron |
| MCP | `@lovable.dev/mcp-js` (143 herramientas en el manifest) |
| Tests | Vitest 4 · Testing Library · PGlite (445 archivos de test) |
| Paquetes | Bun, con guarda de 24 h (`bunfig.toml`) |
| Hosting | Lovable Cloud (nokko.ai) |

Detalle en [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).

## Inicio rápido

Requisitos: [Bun](https://bun.sh) y Node ≥ 20.11 (para los scripts de `scripts/factory`).

```sh
git clone git@github.com:fefeq/seller-strategy-studio.git
cd seller-strategy-studio
bun install
bun run dev
```

| Comando | Qué hace |
| --- | --- |
| `bun run dev` | Servidor de desarrollo |
| `bun run build` | Build de producción |
| `bun run test` | Tests (Vitest) |
| `bun run lint` | ESLint |
| `bun run format` | Prettier |
| `npx tsc --noEmit` | Tipos (no hay script) |

La interfaz arranca con el `.env` versionado. Las funciones de servidor que usan secretos (IA, integraciones, Telegram, Stripe) **no funcionan en local**: los secretos viven en Lovable Cloud. Más en [`docs/DESARROLLO.md`](docs/DESARROLLO.md).

### Sobre `.env`
Está versionado a propósito: Lovable Cloud lo genera y debe contener **solo valores públicos** (URL, project id y clave publicable de Supabase, y claves `VITE_` públicas). **Nunca** añadas claves secretas (`service_role`, `sb_secret_`, tokens de API) ni variables `VITE_` secretas. Los secretos van en Lovable Cloud y se leen solo en funciones de servidor.

## Estructura del repositorio

```
src/routes/          Rutas por archivo; _authenticated/ es la app; api/public/ entradas públicas; mcp.ts
src/components/      Pantallas y paneles; una subcarpeta por pantalla grande
src/hooks/           Consultas compartidas (React Query)
src/lib/             Dominio: lógica pura testeada, *.server.ts, *.functions.ts
src/lib/agent/       Registro de herramientas del agente
src/lib/proactive/   23 detectores proactivos
src/lib/inngest/     Funciones de segundo plano
src/integrations/    Clientes y tipos de Supabase (generados)
drizzle/migrations/  108 migraciones SQL (0000–0108)
docs/                Documentación técnica, PRD, SDD y software factory
.claude/             Agentes y skills del flujo de trabajo
.lovable/            Manifest MCP y planes de Lovable
scripts/factory/     Ledger, gate, fail-first, flake
```

## Reglas del proyecto

1. **Datos desde el navegador con RLS**; solo la IA, los secretos y las integraciones van por funciones de servidor.
2. **Multitenant**: toda tabla de negocio lleva `org_id` con valor por defecto `current_org()`. Las migraciones nuevas incluyen GRANTs y RLS.
3. **Escrituras del agente con confirmación**: crean una acción pendiente y se ejecutan solo tras confirmar.
4. **Sin cifras inventadas**: los titulares de pantalla se calculan con datos reales; el fallback es el nombre de la sección.
5. **Sin `as any`**, sin `window.confirm/prompt`, sin colores a mano, sin mostrar `error.message` crudo.
6. **Todo cambio que toque código, datos o infraestructura parte de un SDD aprobado** ([`docs/PROCESO.md`](docs/PROCESO.md)).
7. **No hagas push ni merge a `main` sin orden expresa**; nada de `reset --hard` ni force push.
8. **Conectado a Lovable**: no reescribas historial ya publicado (force push, rebase, amend o squash de commits subidos) y mantén la rama conectada en estado funcional.
9. **Sin datos de clientes** en ejemplos, prompts, tests ni documentación.

Las convenciones detalladas viven en [`AGENTS.md`](AGENTS.md) y [`src/lib/AGENTS.md`](src/lib/AGENTS.md). Léelas antes de tocar esas áreas.

## Documentación

| Documento | Contenido |
| --- | --- |
| [`docs/README.md`](docs/README.md) | Índice y mapa de la documentación |
| [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) | Capas, clientes de Supabase, convenciones de módulos y decisiones de diseño |
| [`docs/BASE-DE-DATOS.md`](docs/BASE-DE-DATOS.md) | Tablas por dominio, multitenant, roles, RLS, funciones, migraciones |
| [`docs/AGENTE-Y-MCP.md`](docs/AGENTE-Y-MCP.md) | Agente, 143 herramientas, confirmación de escrituras, canales y servidor MCP |
| [`docs/INTEGRACIONES-Y-SEGUNDO-PLANO.md`](docs/INTEGRACIONES-Y-SEGUNDO-PLANO.md) | Inngest, cron, informes, integraciones, variables de entorno y seguridad |
| [`docs/PANTALLAS.md`](docs/PANTALLAS.md) | Rutas, roles, navegación, pantallas, sistema de diseño y tests de UI |
| [`docs/PROCESO.md`](docs/PROCESO.md) | Software factory, gate, SDD y PRD |
| [`docs/DESARROLLO.md`](docs/DESARROLLO.md) | Puesta en marcha, calidad, migraciones, despliegue y resolución de problemas |
| [`docs/ESTADO-Y-DEUDA.md`](docs/ESTADO-Y-DEUDA.md) | Riesgos, incoherencias y preguntas abiertas detectadas |
| [`roadmap.md`](roadmap.md) | Cola de trabajo viva (encargos y tareas abiertas) |

## Estado

Cifras recontadas sobre el código el 2026-11-16 (manifest MCP, migraciones, archivos de test). Menú en cinco secciones: Hoy, Diseñar, Ejecutar, Medir y aprender, Ajustes (Ciclo GTM, Debates y Theory U en modo avanzado). Bloqueado o pendiente: Drive por empresa (faltan credenciales OAuth de Google), Telegram (sin token), webhook de Apollo, revisión legal de LinkedIn y Gmail. Informe de la última ronda: [`docs/plan/INFORME-FINAL-UX-20261115.md`](docs/plan/INFORME-FINAL-UX-20261115.md). Riesgos y preguntas abiertas: [`docs/ESTADO-Y-DEUDA.md`](docs/ESTADO-Y-DEUDA.md).
