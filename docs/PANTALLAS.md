# Pantallas, rutas y diseño

## 1. Rutas

`src/routes/` tiene 42 archivos (el layout autenticado es `_authenticated/route.tsx`: `ssr:false`; `beforeLoad` comprueba la sesión con `supabase.auth.getUser()` y redirige a `/auth`). Los roles que aparecen abajo son los que **activan acciones** en la UI; la seguridad real es RLS.

### Públicas y de sistema
| URL | Archivo | Qué hace |
| --- | --- | --- |
| `/` | `index.tsx` | Landing: 6 pilares, tarjetas de los 9 roles, CTA a `/auth`, JSON-LD |
| `/auth` | `auth.tsx` | Acceso y registro (también Google). `?next=` validado; `noindex` |
| `/.lovable/oauth/consent` | `[.]lovable.oauth.consent.tsx` | Consentimiento OAuth para asistentes MCP (requiere sesión) |
| `/mcp` | `mcp.ts` | Servidor MCP (autogenerado) |
| `/.well-known/oauth-protected-resource` | `[.well-known]/…` | Metadatos OAuth (autogenerado) |
| `/sitemap.xml` | `sitemap[.]xml.ts` | Desde `PUBLIC_PATHS` (hoy solo `/`) |

API pública en `src/routes/api/public/`: ver [INTEGRACIONES-Y-SEGUNDO-PLANO.md](INTEGRACIONES-Y-SEGUNDO-PLANO.md).

### App (`/_authenticated`)
| URL | Pantalla | Acciones por rol |
| --- | --- | --- |
| `/home` | Inicio | Leader (`owner`/`sales_leader`): «Deals en riesgo» y roadmap; el resto: «Mis deals» |
| `/inbox` | Sugerencias | «Informe de la semana ahora»: owner/sales_leader |
| `/accounts` | Cuentas | Reparto: leader |
| `/accounts/$id` | Ficha de cuenta | — |
| `/accounts/assignment` | Reglas de reparto | Lectura: owner/sales_leader; máximo por persona: owner |
| `/leads` | Leads | Ajustes: owner/sales_leader/marketing; borrar: owner |
| `/leads/entrada` | Fuentes de entrada, CSV | Gestionar: owner/sales_leader/marketing; modo directo: leader; borrar fuente: owner |
| `/deals` | Pipeline | Etapas y umbral de enfriado: owner/sales_leader |
| `/people` | Personas | — |
| `/strategy` | Estrategia GTM | Según RLS |
| `/metrics` | Métricas | «Finanzas»: owner/sales_leader |
| `/cycle` | Ciclo GTM | Borrar: owner |
| `/debates` | Debates | Convocar niveles altos: owner/sales_leader |
| `/theory-u` | Theory U | — |
| `/advisor` | Asesor GTM | Solo owner/sales_leader |
| `/abm` | ABM y partners | Decidir: owner/sales_leader/deal_desk |
| `/products` | Productos | Editar: owner/sales_leader/deal_desk |
| `/hub` | Conocimiento | Biblioteca de jugadas: owner/sales_leader; eliminar: owner |
| `/memory` | Memoria | Editar: autor, owner y sales_leader |
| `/discoveries` | Descubiertos | «Buscar ahora»: owner/sales_leader |
| `/approvals` | Aprobaciones | Decidir: owner/sales_leader/deal_desk |
| `/company` | Empresa | Editar nombre, web y moneda: owner |
| `/team` | Equipo | Roles, quitar e invitar: owner. Aloja Telegram, avisos y MCP (`#mcp`) |
| `/integrations` | Conexiones | Estado del plan: owner |
| `/setup` | Configuración guiada | — |
| `/onboarding` | Onboarding | Leader: wizard de 6 pasos; resto: versión de invitado |
| `/connect` | Conectar asistentes | ChatGPT, Claude, Claude Code, otros |

`/products` y `/onboarding` no están en el menú; `/accounts/assignment` y `/leads/entrada` cuelgan de sus padres.

## 2. Navegación (`src/lib/nav.ts`)

- **Lista diaria** (6, máx. 8 por test): Inicio, Sugerencias, Cuentas, Leads, Pipeline, Personas.
- **Estrategia** (12, colapsable): Estrategia GTM, Métricas, Ciclo GTM, Debates, Theory U, Asesor GTM (solo leaders), ABM y partners, Productos, Conocimiento, Memoria, Descubiertos, Aprobaciones.
- **Ajustes** (5, colapsable): Empresa, Equipo, Conexiones, Configuración, Conectar asistentes.
- Los grupos se abren si estás en una de sus páginas o si los dejaste abiertos (`localStorage["nokko-nav-groups"]`).
- **Escritorio**: sidebar de 240 px plegable a un rail de 56 px (botón o ⌘/Ctrl+B; `nokko-sidebar-collapsed`), selector de empresa, medidor «Estrategia completada», rol, cierre de sesión, `ThemeToggle`. La barra superior lleva buscador (⌘K), centro de avisos y «Agente ⌘J».
- **⌘K** (`command-palette.tsx`): busca con `ilike` (límite 5, desde 2 caracteres) en cuentas, leads, personas y deals; acciones («Preguntar al agente», «Añadir o importar leads», «Buscar empresas por ICP») y grupo «Ir a».
- **Móvil**: barra superior con ☰/✕ y drawer a la izquierda (se cierra al navegar, al tocar fuera, con Esc o con swipe izquierdo de más de 60 px) y barra inferior (Inicio, Sugerencias con badge, Leads, Pipeline, Agente). El contenido deja `pb-28` para librar la barra.

## 3. Pantallas principales

- **Inicio**: titular calculado (`homeHeadline`), guía «Primeros pasos», mazo «Tu siguiente paso» (máx. 5), briefing, KPI (pipeline abierto, forecast ponderado, deals en riesgo, aprobaciones), payback, próximos pasos, reuniones, deals, personas y cuentas.
- **Estrategia** (8 pestañas, `?tab=`): Modelos de venta por segmento, Diagnóstico AARRR, Payback real, Presupuesto vs real, ICP, Posicionamiento, Mensajes, Revisión con IA. Protegida contra pérdida de cambios (`useUnsavedGuard`).
- **Cuentas**: tabla con score, alta con aviso de duplicado, importación CSV, enriquecimiento. La ficha tiene 8 pestañas (plan, informe, señales, stakeholders, reuniones, llamadas, deals, Drive).
- **Pipeline**: kanban con etapas configurables, arrastrar y soltar, scroll con snap en móvil, panel del deal (`?deal=`) con MEDDPICC y `stageGate`, diálogo de pérdida.
- **Leads**: KPI, tablero o lista (`?vista=lista`), panel (`?lead=`), retrasos, conversión por origen, ajustes de cualificación y SLA. `/leads/entrada` gestiona fuentes con clave, CSV y revisión de importaciones.
- **Métricas** (9 secciones, `?seccion=`): resumen, embudo, rendimiento, perdidos, cohortes, tendencias, economía (CAC y presupuesto), finanzas, leads. Incluye Stripe, KPI trimestrales, CAC, deals ganados y RevOps.
- **Sugerencias**: «Para mí» y «Equipo»; vista Mazo o Lista; informe semanal.
- **Descubiertos**: filtro por ICP; pestañas empresas, personas y competidores; descartes con motivo.
- **Theory U** (5 pestañas): Recorrido U, Sensing, Escucha, Clínica de casos, Prototipos.
- **Asesor GTM**: objetivo con ejemplos, recomendaciones por rol y horizonte, historial.
- **Aprobaciones**: con evidencia; aplicar un `stage_change` mueve el deal.
- **Equipo**: miembros, roles, invitaciones, Telegram, preferencias de avisos y MCP.
- **Conexiones**: 13 tarjetas de lo que se conecta hoy (webhooks, CSV, MCP, Firecrawl, Logo.dev, Parallel, Apify, Drive, Perplexity, Apollo, Clay, Telegram, email semanal), Stripe, PostHog, lista de lo que aún no (HubSpot, Pipedrive, Attio, Salesforce nativos; Google Calendar y Gmail; Gong y Fireflies) y plan manual.
- **Configuración**: tres vías: «Lo rellena la IA», «Entrevista» y «Paso a paso».
- **Onboarding** (6 pasos): Profundidad, Tus fuentes, Nokko lee, Diagnóstico, Aprobar, Tu roadmap. La lectura corre como trabajo en segundo plano; la aprobación por bloques reutiliza `applySetupItems`/`undoSetupItems`.
- **Memoria** (Empresa / Mío / Cuentas), **Debates** (3 pasos; acciones que se convierten en tareas), **Ciclo GTM** (5 fases BMAD: Análisis, Plan, Arquitectura, Ejecución, Retro), **Conocimiento** (7 secciones más Drive), **ABM** (cuentas objetivo por tiers, partners, registro de deals; un conflicto de canal crea una aprobación).

## 4. Datos en el cliente
- `meQuery` (clave `["me"]`) llama a `accept_invites` y carga perfil y membresías; el resto de hooks cuelgan de `me.currentOrg.org_id`.
- `screen-queries.ts`: `homeQuery`, `accountsQuery`, `accountsScoreContextQuery`, `dealsQuery`; `settle()` evita que un fallo del loader bloquee la navegación. Solo `/home`, `/accounts`, `/deals` y `/leads` tienen loader; el router precarga por intención (`defaultPreload:"intent"`).
- Listas grandes con `fetchAll` (paginado con `range`).
- Tiempo real con `useLivePipeline` (ver [ARQUITECTURA.md](ARQUITECTURA.md)); trabajos en segundo plano con `BackgroundJobsWatcher` y `useJob(kind)`.
- El `QueryClient` no define opciones por defecto.

## 5. Sistema de diseño (`src/styles.css`)

- **Tema «Ink + Lima»**: papel `#fafaf7`, tinta `#0f1115`, lima `#c6f432`, azul `#2b59ff`. Estados `--state-ok/watch/alarm`, series `--series-1..5`. Radios de 4 a 24 px, sombras `xs`–`lg`.
- **Tipografía**: Space Grotesk (titulares) y DM Sans (texto, también `--font-mono`), de `@fontsource`; cifras con `tabular-nums`. Cuerpo de 15 px.
- **Utilidades propias**: `smallcaps`, `eyebrow`, `kicker`, `lede-*`, `head`, `figure`, `data`, `note`, `evidence`, `rule-section`, `rule-major`.
- **Tema oscuro**: clase `.dark` en `<html>`; `ThemeToggle` guarda en `localStorage["nokko-theme"]` o sigue al sistema; el script `THEME_BOOT` en `__root.tsx` evita el parpadeo.
- **Reglas base**: grids con `minmax(0,1fr)`, hijos y scrollers horizontales contienen su contenido (la página nunca scrollea de lado), campos a 16 px bajo `md` (evita el zoom de iOS).
- **Primitivas**: 46 componentes shadcn restilizados en `src/components/ui/`. Las pantallas usan clases semánticas y **no** colores a mano.
- **Patrones**: `EntityCombobox`, `SwipeDeck` (110 px o 600 px/s; derecha = hacer, izquierda = descartar, arriba = luego; deshacer 5 s), `askConfirm`/`askText`/`askUnsaved`, `Page`/`Empty`/`HealthDot`, `Field`/`Pick`, `useUnsavedGuard`, `errorText()`, `mergeServerEdits`.
- **PWA**: `public/manifest.webmanifest` («Nokko», `start_url:/home`, `display:standalone`). Sin service worker.

### Problemas conocidos en esta capa
- El manifest referencia `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` y el `<head>` enlaza `apple-touch-icon.png` y `favicon.ico`; **ninguno existe en `public/`** (solo hay `favicon.svg`, `llms.txt`, `manifest.webmanifest`, `robots.txt`). **[Por verificar]** si se sirven desde otro sitio.
- `public/robots.txt` no bloquea `/company`, `/connect`, `/discoveries`, `/memory`, `/onboarding` ni `/products` (riesgo bajo: son `ssr:false` bajo sesión).
- `@fontsource/schibsted-grotesk` está en `package.json` y no se importa.
- `AGENTS.md` habla de un «botón flotante del agente» que ya no existe.

## 6. Tests de interfaz
140 archivos de test en total (`src/lib` 130, `src/components` 5, `src/hooks` 3, `src/test` 2). Componentes con test: `icp-editor`, `strategy-review`, `strategy-screens`, `onboarding/sources`, `setup/ai-fill`. Cobertura de rutas: solo `app-routing.test.tsx` (comprueba que `/` no cae en «no encontrado»). **No hay tests de render de las pantallas de `src/routes/`.**


## Novedades desde 2026-11-06 (actualizado 2026-11-16)
- Hoy con bandeja única y siguiente mejor paso; /onboarding/completar sustituye a Configuración (rutas antiguas redirigen); /reset-password; Conexiones; deal por pestañas con un solo guardado; MEDDPICC con radios de 44 px; Cuentas, Leads y Personas sin scroll lateral a 390 px.
