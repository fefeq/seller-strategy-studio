# Arquitectura

Visión técnica de NOKKO. Todo lo que aquí aparece sale de leer el código del repo; lo que no se pudo comprobar va marcado como **[Por verificar]**.

## 1. Capas

```
Navegador (React 19, TanStack Router/Query)
   │  RLS con la sesión de la persona
   ▼
Supabase (Postgres + Auth + Realtime + Vault)  ◄───────────────┐
   ▲                                                            │
   │  cliente de la persona (RLS)   cliente admin (service role)│
Server functions (*.functions.ts) ── IA, jobs, integraciones ───┘
   ▲
Rutas /api/public/*  (leads, accounts, Telegram, Apollo, cron, Inngest)
Ruta /mcp            (asistentes externos con OAuth)
Inngest              (trabajos en segundo plano)
```

- **Lectura y escritura de datos de negocio**: desde el navegador, con RLS. Las consultas no pasan `org_id` (lo rellena la base por defecto con `current_org()`), salvo en objetivos de `upsert`.
- **Servidor**: solo para lo que no puede ir en el navegador: llamadas de IA, secretos, integraciones, trabajos pesados y canales (Telegram, MCP, cron).
- **Dos clientes de Supabase en servidor**:
  - Cliente de la persona (`requireSupabaseAuth`): RLS aplica. Es el camino normal.
  - Cliente admin (`client.server.ts`): sin RLS. Solo lo usan rutas públicas, Telegram, cron, Inngest y escrituras puntuales. Se carga por `import()` dinámico para que no llegue al bundle del cliente. En estos caminos la seguridad es de código (filtros por `org_id` y comprobación de cada id enlazado).

## 2. Stack y piezas

| Pieza | Detalle |
| --- | --- |
| Framework | TanStack Start 1.168 + TanStack Router 1.170 (rutas por archivo), React 19.2, TypeScript |
| Build | Vite 8 con `@lovable.dev/vite-tanstack-config` (incluye nitro; target Cloudflare por defecto en build). `src/server.ts` envuelve los errores de SSR |
| Estilos | Tailwind 4 (`@tailwindcss/vite`), 46 primitivas shadcn/Radix en `src/components/ui/`, tokens en `src/styles.css` |
| Datos cliente | `@tanstack/react-query` 5; `screen-queries.ts` y loaders que precargan |
| Backend de datos | Supabase (`@supabase/supabase-js` 2.118), proyecto gestionado por Lovable Cloud |
| IA | Vercel AI SDK (`ai` 5, `@ai-sdk/openai` 2) solo en servidor; cadena de proveedores en `src/lib/gemini.ts` |
| Segundo plano | Inngest 4 (`src/lib/inngest/`) + ruta cron `/api/public/jobs/proactive` |
| MCP | `@lovable.dev/mcp-js` (`/mcp`, autogenerado) |
| Tests | Vitest 4 + Testing Library + PGlite (Postgres en proceso) |
| Paquetes | Bun (`bun.lock` de texto) con guarda de 24 h en `bunfig.toml` |

### CSRF y autenticación
- `src/start.ts` activa `createCsrfMiddleware` para las server functions.
- Todas las server functions llevan `requireSupabaseAuth` (JWT Bearer validado con `auth.getClaims`) y un middleware global (`attachSupabaseAuth`) que añade el token desde el navegador.
- Los roles se vuelven a comprobar dentro de cada función (`mustOwner`, `currentOrg`…); la UI solo oculta, la seguridad real es RLS.

## 3. Estructura del código

```
src/
  routes/            Rutas por archivo. `_authenticated/` es la app (layout con sesión y empresa activa)
    api/public/      Entradas públicas: leads, accounts, telegram, apollo, cron, inngest
    mcp.ts           Servidor MCP (autogenerado)
  components/        ≈70 módulos sueltos + subcarpetas por pantalla
                     (account, discoveries, home, leads, metrics, onboarding,
                      orchestrator, setup, strategy, theory-u, ui)
  hooks/             Consultas y utilidades compartidas (use-me, screen-queries, use-leads…)
  lib/               Dominio. 380 archivos: ≈130 tests, 25 *.functions.ts, 24 *.server.ts
    agent/           Registro de herramientas del agente
    proactive/       23 detectores
    inngest/         Funciones de segundo plano
    orchestrator/    Planificador y ejecutor de gasto en integraciones
    mcp/             Contexto y utilidades del servidor MCP
    bmad/            Personas, workflows y fases del Ciclo GTM
    stripe/          Sincronización y métricas
  integrations/supabase/   Clientes y tipos generados (no editar a mano)
  test/              Arnés PGlite, setup de Vitest
drizzle/migrations/  75 migraciones SQL (0000–0076)
docs/                Esta documentación, PRD, SDD y la software factory
.claude/             Agentes y skills del flujo de trabajo
.lovable/            Manifest MCP y planes de Lovable
```

### Convención de módulos en `src/lib`
- `X.ts`: lógica **pura y con test**. Es donde viven reglas, cálculos y titulares.
- `X.server.ts` / `X-core.ts`: I/O (Supabase admin, proveedores).
- `X.functions.ts`: server functions (se empaquetan también para el cliente; el código de servidor entra por `import()` dinámico).
- Una herramienta del agente reutiliza la función pura o el core que usa la pantalla; nunca lógica paralela.

## 4. Decisiones de diseño relevantes

Recogidas de `AGENTS.md` y `src/lib/AGENTS.md`:

1. **Multitenant por `org_id`**, con la empresa activa en `profiles.current_org_id`. Roles por empresa en `org_members`; `user_roles` está retirada.
2. **Superadmins** (`platform_admins`): filas solo por migración; triggers los hacen Owner de todas las empresas, existentes y nuevas.
3. **Dinero** con la moneda de la empresa (`useCurrency()`); cambiar de moneda reetiqueta, no convierte.
4. **Errores al usuario** siempre por `errorText()` (en español: qué pasó + qué hacer); nunca `error.message` crudo.
5. **Sin `as any`**: tipos generados (`Tables`/`TablesUpdate`), `as unknown as Json` para jsonb, `jsonObject`/`actionTool` para leer jsonb.
6. **Confirmaciones** con `askConfirm`/`askText`, nunca `window.confirm/prompt`.
7. **Titulares de pantalla** calculados por funciones puras (`src/lib/headlines.ts`) con datos ya cargados; el fallback es el nombre de la sección, nunca una cifra inventada.
8. **Campos que nombran un registro** (cuenta, persona, partner, producto) usan `EntityCombobox`: enlazan por id, avisan de duplicados y nunca fusionan.
9. **Procedencia de campos**: cada valor guarda su origen (persona, IA, proveedor) y un registro de ediciones con plazo de deshacer de 24 h.
10. **Uso de LLM**: regla determinista → dato derivado o caché → modelo barato (`effort:"low"`) → modelo caro solo en modo «A fondo».
11. **Pantallas grandes** se dividen en `src/components/<pantalla>/`, una pestaña o panel por módulo.
12. **GTM diagnosis**, **RevOps**, **Theory U**, **self-service** y **navegación** son reglas puras con test.

## 5. Flujo típico de una petición

**Lectura/escritura desde una pantalla**: componente → `supabase` (navegador) → Postgres con RLS.
**IA desde una pantalla**: componente → server function (`*.functions.ts`, con JWT) → `ask()`/`aiProviders()` → proveedor → resultado validado con zod.
**Agente**: ver [AGENTE-Y-MCP.md](AGENTE-Y-MCP.md).
**Tiempo real**: `useLivePipeline(orgId)` escucha `postgres_changes` de `deals`, `leads` y `lead_events` y, con 600 ms de debounce, invalida 15 familias de claves de React Query.

## 6. Límites y riesgos conocidos

- Telegram, cron, Inngest y las rutas públicas usan el cliente admin: **no hay RLS**, solo filtros en código (con tests con cliente falso en `agent-tools.test.ts`).
- Conocido y documentado: el trigger `guard_approval` lee `auth.uid()`, así que `decide_approval` falla desde Telegram hasta que exista una migración.
- No hay limitador genérico por usuario ni IP en server functions, agente ni MCP; solo topes por recurso (ver [INTEGRACIONES-Y-SEGUNDO-PLANO.md](INTEGRACIONES-Y-SEGUNDO-PLANO.md)).
- Los trabajos periódicos tienen topes fijos sin paginar (100 empresas por ejecución horaria, 200 en el informe semanal, 2000 perfiles en el email diario).
- No hay CI en el repositorio (ver [PROCESO.md](PROCESO.md)).
