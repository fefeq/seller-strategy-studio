# NOKKO

Estudio de estrategia para equipos comerciales: define tu estrategia go-to-market, gestiona cuentas, leads y pipeline, y trabaja con un agente de IA que propone y ejecuta (siempre tras tu confirmación).

**App**: https://nokko.ai · **Repositorio**: `fefeq/seller-strategy-studio` (privado)

## Qué incluye

- **Estrategia y posicionamiento**: ICP, segmentos, productos, competidores, Brief GTM, Modelos de venta, Theory U y GTM Advisor.
- **Cuentas, leads y pipeline**: cuentas con ABM, entrada de leads, calificación en segundo plano, deals con líneas y aprobaciones.
- **Métricas**: embudo conciliado, perdidos, cohortes, tendencias (RevOps), presupuesto, gasto real, margen y ROI, CAC y self-service.
- **Sugerencias**: mazo de tarjetas con gestos y plazo de deshacer.
- **Agente**: chat, Telegram y MCP. Las herramientas de lectura corren al momento; las de escritura crean una acción pendiente que se ejecuta solo con tu confirmación.
- **Descubiertos e investigación**: búsqueda web, novedades de competidores y research de personas, con proveedores de cuenta propia (Apollo, Clay, Parallel, Perplexity, Firecrawl).
- **Onboarding guiado**: lectura en segundo plano, aprobación por bloques y diagnóstico GTM.
- **Avisos**: centro de avisos, email diario y Telegram según preferencias de cada persona.
- **Multiempresa**: cada empresa tiene su espacio aislado y roles propios (Owner, Sales Leader, etc.).

El estado de lo hecho y lo pendiente está en [`roadmap.md`](roadmap.md).

## Stack

| Capa | Tecnología |
| --- | --- |
| App | TanStack Start + React 19 + TypeScript, Vite |
| Estilos | Tailwind CSS 4, shadcn/ui (Radix), tokens en `src/styles.css` |
| Datos | Supabase (Postgres + RLS + Auth); migraciones SQL en `drizzle/migrations` |
| IA | Vercel AI SDK (`ai`, `@ai-sdk/openai`), solo en funciones de servidor |
| Segundo plano | Inngest |
| Tests | Vitest + Testing Library (PGlite para pruebas de base de datos) |
| Hosting | Lovable Cloud (nokko.ai) |

## Desarrollo local

Requisitos: [Bun](https://bun.sh).

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

`.env` está versionado a propósito: Lovable Cloud lo genera y solo contiene valores públicos (URL y clave publicable de Supabase). **Nunca** añadas ahí claves secretas (`service_role`, `sb_secret_`, tokens de API ni variables `VITE_`); los secretos van en Lovable Cloud y solo se leen en funciones de servidor.

## Estructura

```
src/routes/        Rutas por archivo (TanStack Router); /_authenticated es la app
src/components/    Pantallas y paneles, un módulo por pestaña
src/lib/           Dominio puro y testeado; *.server.ts solo en servidor
src/lib/agent/     Registro de herramientas del agente
src/hooks/         Consultas compartidas (React Query)
drizzle/           Esquema y migraciones SQL
docs/              PRD, SDD y la software factory
.claude/           Agentes y skills del flujo de trabajo
```

## Reglas del proyecto

- Los datos se leen desde el navegador con RLS; solo las llamadas de IA van por funciones de servidor.
- Todo dato de empresa lleva `org_id` (por defecto `current_org()`); las migraciones nuevas incluyen GRANTs y RLS.
- Las convenciones de código viven en [`AGENTS.md`](AGENTS.md) y [`src/lib/AGENTS.md`](src/lib/AGENTS.md). Léelas antes de tocar esos archivos.
- Los cambios que afectan a código, datos o infraestructura parten de un SDD en [`docs/sdd`](docs/sdd) (plantilla en `docs/factory/templates/sdd.md`).
- El proyecto está conectado a Lovable: no reescribas el historial ya publicado (force push, rebase o squash de commits subidos).
