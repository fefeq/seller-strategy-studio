# Informe del gate · SDD-20261029-lovable-exit-migration (2026-10-29)

Copiado sin editar del resultado de un agente `nokko-gate` con contexto limpio, sobre la versión del SDD anterior a las correcciones de hechos. Revisión en solo lectura con grep y lectura de archivos; no se ejecutó ningún test ni script (el repo no es git y `gate.mjs` no aplica a un SDD).

- Veredicto del gate: Objeciones
- CA sin prueba posible o sin G-n: CA-15 (la parte de Stripe, no hay ruta de webhook de Stripe en el código). CA-3, CA-4, CA-19, CA-20, CA-21, CA-23 y CA-25 solo tienen prueba por evidencia manual o por revisión, no por test automático. CA-8 y CA-12 «existe»: los archivos existen, pero hay que comprobar que cubren lo que se les atribuye. Ningún CA cita G-n (el SDD declara «PRD: No aplica», coherente con la plantilla).
- [Por verificar] que sigue sin comprobarse: el contenido y el volumen de la base, los hashes de contraseña y las identidades de Google; cuáles secretos solo existen en Lovable; las claves de los proveedores; el TTL del DNS; el acceso directo a `auth` y el modo solo lectura del origen; los costes. Las secciones 11 y 16.6 (Jev) pueden resolverse con código, ver Detalle.
- Contradicciones con el código o con decisiones previas: (1) no hay webhook de Stripe. (2) El runtime hoy es Cloudflare Worker, no hay Vercel. (3) La sección 3 omite acoplamientos. (4) `/mcp` no puede ser «propia» sin reescribir las herramientas. (5) El orden con los SDD de conexiones y Drive está sin resolver.
- Lo que esta revisión NO demuestra: nada del comportamiento en el proveedor real, ni de los datos ni de producción; no se ejecutó ningún test; no se comprobó qué hay dentro del proyecto de Lovable ni en Cloudflare.

## Detalle

1. **Sección 3, lo que es cierto.**
   - `vite.config.ts:7-8`, `drizzle.config.ts:8` (`LOVABLE_DB_MIGRATION_URL`), `cron-auth.ts:5` (`LOVABLE_CRON_SECRET`).
   - Pasarela de conectores en `email.server.ts:6`, `apollo-gateway.ts:12`, `clay-gateway.ts:11`, `apify-gateway.ts:5`, `parallel-gateway.ts:5`, `perplexity.ts:4`, `google-drive.ts:5`.
   - IA: `jev.server.ts:24`, `ai-gateway.ts:94`, `gemini.ts:36-42`.
   - `__LOVABLE_PROJECT_ID` en `apollo.functions.ts:19` y `orchestrator.functions.ts:50`.

2. **Acoplamientos que faltan en el SDD.**
   - `telegram.server.ts:2,5,12` y `inngest/send.server.ts:7,10,14` usan también la pasarela. El secreto del webhook de Telegram se deriva de `TELEGRAM_API_KEY` (`telegram.server.ts:41`).
   - `agent/agent.server.ts:53,147-150` llama a `ai.gateway.lovable.dev` y `agent/run-id.ts` maneja cabeceras `X-Lovable-AIG-*`. Es el agente de chat, de Telegram y de MCP, no solo Jev.
   - `ai-gateway.ts:94` y `gemini.ts` conservan el proveedor `"lovable"`; `ai-fallback.test.ts:6-12` fija ese comportamiento.
   - `apollo.ts:149-150`: URLs fijas `project--…lovable.app` para el webhook. Es crítico para CA-15.
   - `background.functions.ts:108`: la regex `seller-strategy-studio.lovable.app` decide si es «sitio publicado» y por tanto si se usa Inngest.
   - `leads.entrada.tsx:43` (`.lovableproject.com`).
   - `lovable-error-reporting.ts` y `__root.tsx:15,49`.
   - `.env:4-7` (`VITE_LOVABLE_CONNECTOR_*`, incluido PostHog).
   - `package.json:25,26,87` y `bunfig.toml:7`.
   - Textos «recárgalo en Lovable»: `errors.ts:22`, `parallel.ts:193`, `perplexity.ts:7`, `apollo.ts:164`.
   - `src/lib/mcp/{index,context,supabase}.ts` y los tres archivos de `tools/` importan `@lovable.dev/mcp-js`; `routes/mcp.ts` y `[.well-known]/oauth-protected-resource.ts` están autogenerados, este último con `trustForwardedHost` «solo seguro en Lovable» (líneas 18-22).

3. **Stripe.** `grep` de `webhook|constructEvent|whsec` en `src` no da nada y `routes/api/public/` no tiene ruta de Stripe (`leads`, `accounts`, `inngest`, `apollo/phone-webhook`, `jobs/proactive`, `telegram/webhook`). Stripe se consulta, no recibe eventos. CA-15 y la sección 5 («eventos entrantes de Stripe») no se corresponden con el código.

4. **Runtime.** `src/server.ts:66-68` usa `waitUntil` del Worker; hay `.wrangler` y nitro apunta a cloudflare según `vite.config.ts:2-4`. Pasar a Vercel cambia ese contrato: el aprendizaje de memoria tras la respuesta, los jobs inline sin Inngest y los límites de duración. Si Vercel Cron es por hora, depende del plan (no lo he comprobado). El SDD no lo menciona.

5. **MCP.** El OAuth de `/mcp` usa como emisor el propio Auth de Supabase (`mcp/index.ts:21`), así que depende de que el proyecto nuevo tenga ese servidor OAuth activo. La ruta `/.lovable/oauth/consent` sirve a eso: eliminarla sin sustituto rompe el consentimiento. «Implementación propia» (U-5) implica reescribir `defineTool` en los tres archivos de herramientas y `agent-tools.ts`; el SDD no lo dimensiona.

6. **Tests citados.** Existen: `daily-email.test.ts`, `apollo.test.ts`, `ai-fallback.test.ts`, `errors.test.ts`. No existen, y están marcados «por crear»: `cron-auth.test.ts`, `email.server.test.ts`, `rls-isolation.test.ts`, `mcp-tools.test.ts`, `mcp-auth.test.ts`. Esto es coherente. CA-6 exige dos empresas ficticias con RLS real: ese test necesita una base real y no es una prueba unitaria. CA-17 («mismas herramientas») sí es probable contra la lista congelada de `.lovable/mcp/manifest.json` (142 KB).

7. **Contradicciones con AGENTS.md y con otros SDD.**
   - `cron-auth.ts:1` dice «automatically generated»: el SDD debe permitir editarlo.
   - `AGENTS.md` pide no reescribir historial publicado.
   - Conexiones (En curso) y Drive (Aprobado) reescriben las mismas llamadas, y el SDD de conexiones documenta la pasarela (líneas 117 y 133). El SDD propone coordinación pero no fija el orden (sección 14).
   - Las migraciones 0058 y 0059 figuran como «NOT VERIFIED, no aplicadas» (`src/lib/AGENTS.md`). Antes de restaurar, hay que decidir si el destino las incluye.

8. **[Por verificar] que sí puedes cerrar con código.**
   - Jev: `jev.server.ts:12-14` ya prueba `askOwnJudgments` antes que la pasarela, así que no depende de un modelo exclusivo. Lo que sí hay que probar es que `askOwnJudgments` cumple el mismo esquema.
   - Triggers y realtime: hay `on_auth_user_created` en `auth.users` (`0000_migration.sql:47`) y publicaciones realtime en `deals`, `lead_events`, `leads`, `research_runs`, `background_jobs` y `notifications` (migraciones 0010, 0012, 0026, 0037, 0038, 0049). Si el volcado es solo `public` y `auth`, ese trigger sobre `auth.users` y las publicaciones deben recrearse. El SDD dice «fuera de `drizzle/migrations`» pero ya están dentro.
   - Storage y funciones edge: no hay `supabase.storage` ni `functions.invoke` en `src` ni carpeta `supabase/functions`; solo `config.toml`.
   - Vault: aparece solo comentado en `0027_stripe.sql`.
   - Contraseñas: `auth.tsx:81,89` usa `signUp` y `signInWithPassword`, así que sí hay usuarios con contraseña; el CA-2 es obligatorio salvo que U-0 lo mida de otra forma.

9. **Acciones irreversibles sin parada clara.** CA-23 las cubre bien en general. Faltan estos casos: reapuntar Telegram con `setWebhook` (solo admite una dirección; el SDD lo cita en la sección 8 pero no como parada); que el correo diario real salga antes del corte por el solape; y rotar `INTEGRATION_KEYS_SECRET` (pregunta 5 abierta, pero decisiva: sin esa clave se pierden los tokens cifrados, ver `secret-box.server.ts`). La restauración en preproducción puede mandar webhooks o emails reales si CA-26 se implementa tarde; debería ser lo primero que se compruebe.

10. **División.** Sí conviene dividir, por independencia comprobada en el código:
    - (a) U-0 y U-1 (rescate y datos) no dependen del resto, y la base está en pausa, así que es lo urgente.
    - (b) U-2 (login), U-3 (email, cron e IA) y U-4 (conectores) son independientes entre sí.
    - (c) U-4 colisiona con los SDD de Drive y de conexiones.
    - (d) U-5 (`/mcp`) es la más pesada y no bloquea el login ni los datos; sale bien como SDD aparte.
    - (e) U-6 y U-7 (hosting y corte) son un tercer bloque, con el cambio de runtime a Vercel como riesgo propio.

    La decisión de «un solo SDD» está en la sección 14; recomiendo al menos separar (a) y (d).
