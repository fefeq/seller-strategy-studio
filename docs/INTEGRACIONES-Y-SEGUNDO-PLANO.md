# Integraciones, segundo plano y seguridad operativa

## 1. Segundo plano

### Cron y orquestación
- **No hay ningún cron definido en el repo.** `/api/public/jobs/proactive` exige `authenticateCronRequest`: Bearer comparado por SHA-256 con `LOVABLE_CRON_SECRET` (y `LOVABLE_CRON_SECRET_PREVIOUS`) con `timingSafeEqual`. El plan de Lovable (`.lovable/plan/…2026-10-19.md`) habla de «schedule HTTP cada hora».
- **[Por verificar]** quién programa el cron real y con qué frecuencia, sobre todo el `kind:"digest"` (resumen de Telegram para quien tiene `daily_digest`).

### Qué hace `/api/public/jobs/proactive`
1. Toma un lease `job_locks` `proactive:<kind>` de 5 min.
2. Vacía los avisos de Telegram retenidos por silencio nocturno y envía `ping` a Inngest.
3. Si el latido está fresco (< 3 h, `job_locks` `inngest:heartbeat`), encola un `org.maintenance` por empresa; si no, hace el trabajo en línea (Stripe, señales, PostHog, 3 leads por empresa para enriquecer, autopilot, Descubiertos; una empresa por ejecución).
4. Envía avisos urgentes (prioridad 1 y `account_assigned`, máx. 3 por persona), el informe semanal y los emails diarios.

### Funciones Inngest (`src/lib/inngest/functions.server.ts`, servidas en `/api/public/inngest`)
| Función | Disparador | Detalle |
| --- | --- | --- |
| `heartbeat` | `nokko/ping` | Marca el latido |
| `org-maintenance` | `nokko/org.maintenance` | Concurrencia 5, 3 reintentos, idempotente por empresa y hora. Sugerencias, Stripe y PostHog (cada 6 h), señales (máx. 3 cuentas objetivo), Descubiertos, autopilot, cola de leads |
| `lead-enrich` | `nokko/lead.created` | Espera 1 min y enriquece (una vez por lead) |
| `lead-followup` | `nokko/lead.contacted` | Seguimiento a los 3, 7, 14 y 21 días a las 9:00; se cancela si el lead cambia |
| `background-job` | `nokko/job.requested` | Concurrencia 4; solo el último intento escribe `failed` |
| `parallel-run` | `nokko/parallel.run` | Comprueba cada 30–60 s, hasta 120 veces |

`JOB_KINDS` (`inngest/events.ts`) define 19 tipos de trabajo pesado. Solo el sitio publicado los manda a Inngest; en preview o con Inngest mudo se ejecutan en la propia petición. El envío de eventos va por el gateway de Lovable (`INNGEST_API_KEY`), en lotes de 100.

### Informes y avisos
- **Informe semanal**: lunes desde las 06:00 UTC, una sugerencia por empresa y semana (`weekly_report:<org>:<lunes>`). Telegram para quien tiene `daily_digest` y email para `owner` y `sales_leader`. Se puede regenerar a mano sin reenviar.
- **Email diario**: una vez al día por persona, a su hora local (8:00 Europe/Madrid por defecto, hasta 2 h tarde), máx. 300 por ejecución. Remitente `Nokko <avisos@nokko.ai>` o `RESEND_FROM`. Usa las mismas palabras que el briefing de Inicio.
- **Autopilot**: `AUTOPILOT_LIMITS = {research: 2, prep: 5, cooling: 3}` por empresa y ejecución. Investiga cuentas nuevas (14 días), prepara reuniones de las próximas 36 h y revisa cuentas enfriadas (21 días por defecto).
- **Avisos**: `deliverJobNotice` envía por Telegram según `notification_prefs` y silencio nocturno; lo retenido sale cada hora.
- **Detectores proactivos**: 23 detectores en `src/lib/proactive/detectors/`, uno por archivo.

## 2. Integraciones

Casi todo va por `https://connector-gateway.lovable.dev/<servicio>` con `Authorization: Bearer LOVABLE_API_KEY` y `X-Connection-Api-Key`. Esa clave es **una por despliegue** (la del builder).

| Integración | Dónde | Modelo de cuenta | Notas |
| --- | --- | --- | --- |
| Supabase | `src/integrations/supabase/` | Proyecto propio | Archivos generados; no editar |
| IA | `gemini.ts`, `ai-gateway.ts`, `jev.server.ts` | OpenRouter BYOK / Gemini / Lovable AI Gateway | La cualificación de leads usa Jev (`/v1/systemone`) |
| Apollo | `apollo-gateway.ts` | Compartida | Los teléfonos llegan por webhook (`/api/public/apollo/phone-webhook`, secreto en la URL). Revelar contactos es escritura |
| Clay | `clay-gateway.ts` | Compartida | Páginas de hasta 25; solo lectura desde agente y MCP |
| Parallel | `parallel-gateway.ts`, `parallel-core.ts` | Compartida | Informes largos en `research_runs`; tercera fuente de `searchBoth` |
| Perplexity | `perplexity.ts` | Compartida | El gateway administrado solo permite `POST /search` |
| Firecrawl | `firecrawl.ts` | Compartida (`FIRECRAWL_API_KEY`) | API directa, sin gateway |
| Apify | `apify-gateway.ts`, `apify-core.ts` | Compartida | Cada robot con tope `maxItems` y `maxTotalChargeUsd` |
| Google Drive | `google-drive.ts`, `drive-core.ts` | Una cuenta (la del builder) | Cada empresa ve solo `Nokko / <empresa>`, comprobando los padres del archivo |
| PostHog | `posthog-sync.server.ts` | **Por empresa** | El Owner pega una clave `phx_` en Conexiones; se cifra con AES-GCM |
| Stripe | `stripe/sync.server.ts` | **Por empresa** | Clave restringida en Vault; sincroniza cada 6 h o cada 2 min a mano |
| Resend | `email.server.ts` | Compartida | Sin claves devuelve `{sent:false}` |
| Telegram | `telegram.server.ts` | Compartida | Un bot; cada persona se vincula con código |
| Logo.dev | `components/company-logo.tsx` | Clave pública `VITE_` | Solo navegador; siempre junto al nombre y con `fallback=404` |
| LinkedIn | `agent/tools/linkedin.ts` | — | Lee posts de página de empresa y de personas vía Apify. **No hay API de LinkedIn** |

### «Cuenta propia» (BYO) en el código
Es **parcial**. BYO real: PostHog, Stripe, el BYOK de OpenRouter y la clave de entrada de leads (por conexión). Compartidas del builder: Clay, Apollo, Parallel, Apify, Perplexity, Drive, Telegram, Resend, Inngest. El SDD `connections-bring-your-own-account` (En curso) apunta a Apollo, Clay, Parallel, Perplexity y Firecrawl con cuenta propia, con la cuenta de NOKKO como respaldo si no hay crédito.

### Gasto en integraciones
Todo gasto pasa por el orquestador (`src/lib/orchestrator/runner.ts`): respeta el presupuesto mensual `org_budgets` (aviso al 80 %, pausa al 100 % solo en lo automático) y registra en `integration_usage`.

### Entrada pública de datos
- `/api/public/leads` y `/api/public/accounts`: clave `gtm_…` por conexión (24–64 caracteres), guardada solo como SHA-256 en `lead_sources`. Máx. 256 KB y 200 registros por envío, límite diario con autopausa, modo `review` en cuarentena, `?test=1` no escribe, CORS `*`.
- La clave se acepta por cabecera, Bearer y `?key=`. **Evita `?key=`**: puede acabar en logs e historiales.

## 3. Variables de entorno y secretos (solo nombres)

Los secretos van en **Lovable Cloud** y se leen solo en funciones de servidor. Nunca en `.env` ni en variables `VITE_`.

| Grupo | Nombres |
| --- | --- |
| Supabase | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (solo `client.server.ts`), `SUPABASE_ANON_KEY` (alternativa en `mcp/supabase.ts`), `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` |
| Lovable | `LOVABLE_API_KEY`, `LOVABLE_CRON_SECRET`, `LOVABLE_CRON_SECRET_PREVIOUS`, `__LOVABLE_PROJECT_ID` |
| IA | `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_AGENT_MODEL`, `AI_PROVIDER`, `AI_LOVABLE_FALLBACK` |
| Proveedores | `CLAY_API_KEY`, `APOLLO_API_KEY`, `APOLLO_WEBHOOK_SECRET`, `PARALLEL_API_KEY`, `PERPLEXITY_API_KEY`, `FIRECRAWL_API_KEY`, `APIFY_API_KEY`, `GOOGLE_DRIVE_API_KEY` |
| Canales y correo | `TELEGRAM_API_KEY`, `RESEND_API_KEY`, `RESEND_FROM`, `APP_URL` |
| Inngest | `INNGEST_API_KEY`, `INNGEST_SIGNING_KEY` |
| Cifrado | `INTEGRATION_KEYS_SECRET` |
| Cliente (públicas) | `VITE_LOVABLE_CONNECTOR_LOGO_DEV_API_KEY`, `VITE_LOVABLE_CONNECTOR_POSTHOG_*` (en `.env`) |
| Migraciones | `LOVABLE_DB_MIGRATION_URL` (solo `drizzle.config.ts`) |

La lista sale de un `grep` sobre `src`; puede faltar alguna leída fuera de `src/`. Stripe no usa variable: la clave es por empresa en Vault.

> **Revisar**: `.env` está versionado a propósito y `AGENTS.md` dice que solo contiene valores públicos. Contiene variables `VITE_LOVABLE_CONNECTOR_*` (Logo.dev y PostHog). Al ser `VITE_`, acaban en el bundle del navegador: confirma que son claves públicas por diseño.

## 4. Seguridad

| Ruta pública | Protección |
| --- | --- |
| `/api/public/leads`, `/api/public/accounts` | Clave por conexión, límites y cuarentena (arriba) |
| `/api/public/telegram/webhook` | Secreto en cabecera derivado por SHA-256 de `TELEGRAM_API_KEY` + `timingSafeEqual`; idempotente por `update_id` |
| `/api/public/apollo/phone-webhook` | Secreto en la URL; máx. 1 MB |
| `/api/public/jobs/proactive` | Bearer de cron |
| `/api/public/inngest` | Firma del SDK; 503 si falta `INNGEST_SIGNING_KEY` |

- **Cifrado**: AES-GCM con IV aleatorio de 12 bytes (`secret-box.server.ts`, formato `v1:<iv>:<ct>`, clave derivada con SHA-256 de `INTEGRATION_KEYS_SECRET`). Stripe usa Vault.
- **Cliente admin** en 16 archivos fuera de tests (rutas públicas, Inngest, cores de Drive/Parallel/Apify y escrituras puntuales), siempre por `import()` dinámico.
- **Límites por recurso** (no hay limitador genérico por usuario ni IP): topes de entrada de leads, 2 min entre sincronizaciones manuales y 6 h entre automáticas, páginas pequeñas de Clay, topes de Apify, presupuesto mensual por empresa y `AUTOPILOT_LIMITS`.

### Puntos a vigilar
1. Telegram, cron y rutas públicas sin RLS: la seguridad es de código.
2. Clave de entrada aceptada en `?key=`.
3. Trabajos periódicos con topes fijos sin paginar (100 empresas por job horario, 200 en informe semanal, 2000 perfiles en email diario).
4. Borrar segmentos, ICP y pilares solo lo puede hacer el Owner; se comprueba en código porque los canales privilegiados no tienen RLS.
5. Cron real y `digest` sin definición en el repo.
