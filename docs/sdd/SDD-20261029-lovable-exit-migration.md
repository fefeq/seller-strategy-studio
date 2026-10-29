# SDD-20261029-lovable-exit-migration · [Feature] NOKKO deja de depender de Lovable

**Tipo:** Feature · **Prioridad propuesta:** Alta
**Estado:** Borrador · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-10-29
**PRD:** No aplica (migración de infraestructura sin cambio de producto; un PRD solo repetiría el resumen. Si prefieres PRD, añadiría los objetivos G-n y la medición de adopción, que aquí no existen.) · **Depende de:** coordinar con `SDD-20261025-connections-bring-your-own-account` (En curso) y `SDD-20261025-drive-per-company-account`: ambos tocan las llamadas a proveedores que hoy pasan por la pasarela de Lovable.

> Un SDD dice cómo se verifica que está bien hecho. Cada criterio de aceptación (CA-n) debe poder tener una prueba automática que lo nombre. Los nombres marcados *(por crear)* son propuestas para el brief.
> Nota de términos: «plataforma de origen» = Lovable (Lovable Cloud y su pasarela de conectores y de IA). Se nombra porque es el objeto del cambio, no como fuente del estado del producto (la fuente es este repo).

## 1. Resumen
NOKKO deja de depender de Lovable para base de datos, login, hosting, tareas programadas, email, conectores e IA. El 2026-10-28 Lovable avisó de que la base de datos está en pausa por falta de créditos de Cloud: nadie puede entrar a nokko.ai y tampoco funcionan los datos, los avisos ni las tareas automáticas (el email de las 8:00 y las búsquedas semanales). La migración deja NOKKO funcionando sobre cuentas y claves de Fede, sin cambio visible para el usuario.

## 2. Problema y para quién
Un fallo de facturación ajeno al producto apaga NOKKO entero. Afecta a todo usuario de NOKKO y a Fede como propietario del negocio.

## 3. Evidencia y por qué ahora
Fuente: mensaje de Lovable del 2026-10-28 (pegado por Fede) y lectura del código de este repo el 2026-10-29. Sin datos de uso.
- Número de usuarios y empresas afectados: **sin dato** (se medirá en la base al reactivarla, U-0).
- Acoplamientos encontrados en el código:
  - Base de datos y login: `supabase/config.toml` (proyecto de Lovable Cloud), `src/integrations/lovable/index.ts` (`@lovable.dev/cloud-auth-js`, autogenerado), `src/integrations/supabase/previewAuthStorage.ts` (solo vista previa de Lovable).
  - Hosting y build: `vite.config.ts` usa `@lovable.dev/vite-tanstack-config` y `mcpPlugin`.
  - Tareas programadas: `src/integrations/supabase/cron-auth.ts` (`LOVABLE_CRON_SECRET`), ruta `/api/public/jobs/proactive`; Inngest en `/api/public/inngest`.
  - Pasarela de conectores (`connector-gateway.lovable.dev`, con `LOVABLE_API_KEY` más la clave del proveedor): `email.server.ts` (Resend), `apollo-gateway.ts`, `clay-gateway.ts`, `apify-gateway.ts`, `parallel-gateway.ts`, `perplexity.ts`, `google-drive.ts`.
  - IA: `gemini.ts` ya prioriza Gemini y OpenRouter propios; `jev.server.ts` llama a `ai.gateway.lovable.dev` como alternativa.
  - Stripe (`api.stripe.com`) y PostHog usan claves directas.
  - Menores: `__LOVABLE_PROJECT_ID` (base del webhook de Apollo), `VITE_LOVABLE_CONNECTOR_LOGO_DEV_API_KEY`, ruta `/.lovable/oauth/consent`, `.lovable/mcp/manifest.json`, `src/routes/mcp.ts` (autogenerado por el plugin), `LOVABLE_DB_MIGRATION_URL` en `drizzle.config.ts`.
- Acoplamientos que añadió la revisión técnica (sección 17): Telegram y el envío de eventos a Inngest también usan la pasarela (`telegram.server.ts`, `inngest/send.server.ts`); el agente de chat, Telegram y MCP llama a `ai.gateway.lovable.dev` (`agent/agent.server.ts`, `agent/run-id.ts`, `ai-gateway.ts` y `gemini.ts` con el proveedor «lovable»); URLs fijas `…lovable.app` para el webhook de Apollo (`apollo.ts`) y para detectar «sitio publicado» (`background.functions.ts`); `lovable-error-reporting.ts` y `__root.tsx`; `.env` con `VITE_LOVABLE_CONNECTOR_*`; `package.json` y `bunfig.toml`; textos «recárgalo en Lovable» (`errors.ts`, `parallel.ts`, `perplexity.ts`, `apollo.ts`); `src/lib/mcp/*` y `[.well-known]/oauth-protected-resource.ts` (autogenerado) con `@lovable.dev/mcp-js`.
- Hoy la app corre como Worker de Cloudflare (`src/server.ts` usa `waitUntil`; Nitro apunta a Cloudflare), no en Vercel: pasar a Vercel cambia el contrato de ejecución tras la respuesta, los trabajos sin Inngest y los límites de duración. **[Por verificar]**
- No hay ruta de eventos entrantes de Stripe en el código: Stripe se consulta, no recibe eventos.
- Hay usuarios con contraseña (`auth.tsx` usa `signInWithPassword`), un disparador sobre `auth.users` (`on_auth_user_created`) y publicaciones de tiempo real en `deals`, `lead_events`, `leads`, `research_runs`, `background_jobs` y `notifications`; no hay almacenamiento de archivos ni funciones de borde.
- `AGENTS.md` dice que `.env` lo genera y versiona Lovable Cloud y que Lovable construye desde él; esa regla cambia con la migración (ver sección 6).
- **[Por verificar]** cuáles de esos secretos solo existen dentro de Lovable Cloud (U-0 los inventaría).

## 4. Resultado buscado
- NOKKO funciona con Lovable desactivado: login, datos, email de las 8:00, búsqueda semanal, conectores, IA y `/mcp`.
- Medición: CA de H-1 a H-5 y CA-26 superados en preproducción; CA-19 a CA-25 en el corte; tras el corte, H-1 a H-4 en nokko.ai. Fuente: informes en `.factory/evidence/` y registros de ejecución del hosting. Línea base de usuarios y empresas: sin dato.

## 5. Alcance
**Incluye:**
- Base de datos y login en un proyecto Supabase propio de Fede, con todos los datos y usuarios actuales.
- Login con Google con credenciales propias.
- Hosting propio de la app y del dominio nokko.ai.
- Tareas programadas con secreto propio.
- Email por el proveedor directo con clave propia.
- IA con claves propias, sin la pasarela de Lovable.
- Conectores (Apollo, Clay, Apify, Parallel, Perplexity, Google Drive) sin pasarela de Lovable; Telegram e Inngest también; Stripe y PostHog solo verificar claves; eventos entrantes de Apollo y Telegram. El agente de chat, Telegram y MCP pasan a IA propia.
- Endpoint `/mcp` sin el plugin de Lovable, con las mismas herramientas.
- Actualizar `AGENTS.md` y `.env` a la nueva realidad.

**Cuentas destino** (las crea Fede a su nombre y carga los secretos él mismo; nada a nombre del agente ni de terceros):

| Destino | Titular |
|---|---|
| Base de datos y login | Proyecto nuevo en la organización de Supabase de Fede |
| Hosting de la app | Vercel, cuenta personal de Fede (decidido el 2026-10-29), si se confirma el cambio de runtime (sección 15, pregunta 4) |
| Login con Google | Credenciales de Google creadas por Fede |
| Email | Cuenta del proveedor de email de Fede |
| IA y conectores | Cuentas y claves de Fede en cada proveedor |
| DNS de nokko.ai | Fede |

**No incluye:**
- Cambios de producto, de diseño o de precios.
- Cambiar de proveedor de IA, email o conectores más allá de quitar la pasarela de Lovable.
- Rediseño del esquema de datos ni cambiar migraciones ya aplicadas.
- Las conexiones por empresa (cuenta propia de cada empresa): eso es `connections-bring-your-own-account`.
- Apagar o borrar el proyecto de Lovable (se conserva en solo lectura una semana tras el corte; nada se borra sin OK de Fede).

## 6. Cambios de comportamiento (delta)
**Añadido:** nada visible para el usuario.
**Modificado (antes → después):**
- Datos y login: Lovable Cloud → proyecto propio.
- Login con Google: broker de Lovable → credenciales propias; mismo botón y misma cuenta.
- Hosting y build: configuración de Lovable → configuración propia.
- Cron: secreto gestionado por Lovable → secreto propio con programador propio.
- Email, conectores e IA: pasarela de Lovable → llamadas directas con claves propias.
- `/mcp`: generado por el plugin → implementación propia con las mismas herramientas.
- `AGENTS.md`: se retiran el aviso «conectado a Lovable» y la regla de que `.env` lo genera Lovable; los secretos pasan a las variables del hosting y del proyecto de datos nuevos.
**Eliminado:** broker de sesión de vista previa, ruta `/.lovable/oauth/consent`, dependencias `@lovable.dev/*` y los mensajes que mandan a «conectar Supabase en Lovable Cloud».

## 7. Historias y criterios de aceptación

### H-1: Como miembro de una empresa, quiero entrar a NOKKO con mi cuenta de siempre para trabajar sin interrupciones.
- **CA-1** CUANDO un usuario existente inicia sesión con Google tras el cambio, el sistema DEBE abrirle su misma cuenta, empresa y datos · prueba: `scripts/migration/verify-auth.mjs` *(por crear)* + recorrido `nokko-walkthrough` del login
- **CA-2** CUANDO un usuario existente inicia sesión con email y contraseña, el sistema DEBE aceptar su contraseña actual sin pedirle restablecerla (obligatorio: el código permite registro y acceso con contraseña) · prueba: `scripts/migration/verify-auth.mjs`
- **CA-3** SI la sesión de un usuario estaba abierta antes del corte, ENTONCES el sistema DEBE pedirle iniciar sesión de nuevo y conservar sus datos · prueba: recorrido `nokko-walkthrough`
- **CA-4** El sistema DEBE iniciar sesión sin ninguna llamada a servicios de la plataforma de origen · prueba: recorrido `nokko-walkthrough` con captura de red

### H-2: Como Fede, quiero que ningún dato se pierda en la migración.
- **CA-5** El sistema DEBE contener, tras el cambio, el mismo número de registros por conjunto de datos que el origen en el momento del volcado y una suma de verificación de contenido que coincida · prueba: `scripts/migration/verify-data.mjs` *(por crear)*
- **CA-6** El sistema DEBE conservar las relaciones, el aislamiento por empresa y los permisos por rol de cada conjunto de datos (con dos empresas ficticias, una no ve los datos de la otra) · prueba: `src/lib/rls-isolation.test.ts` *(por crear)*
- **CA-7** El sistema DEBE conservar una copia completa e intacta del volcado original hasta que Fede autorice borrarla · prueba: `scripts/migration/verify-data.mjs` (hash del volcado)
- **CA-27** El sistema DEBE descifrar tras el cambio los tokens cifrados de integraciones de cada usuario (se conserva `INTEGRATION_KEYS_SECRET` sin cambios) · prueba: `src/lib/secret-box.test.ts` *(por crear o ampliar, con valores ficticios)*

### H-3: Como Fede, quiero que las tareas automáticas sigan funcionando.
- **CA-8** CUANDO llega la hora configurada de un miembro en su propia zona horaria (por defecto las 8:00 en la zona horaria de Madrid si no la ha configurado), el sistema DEBE enviarle el email diario una sola vez por día · prueba: `src/lib/daily-email.test.ts` (existe) + una prueba de integración de U-3
- **CA-9** El sistema DEBE ejecutar la tarea proactiva cada hora y la búsqueda semanal de descubrimientos una vez por semana, comprobado en los registros de ejecución durante la verificación previa al corte · prueba: informe en `.factory/evidence/`
- **CA-10** SI una llamada para lanzar las tareas programadas no lleva el secreto correcto, ENTONCES el sistema DEBE rechazarla · prueba: `src/integrations/supabase/cron-auth.test.ts` *(por crear)*

### H-4: Como usuario, quiero que email, conectores e IA sigan funcionando.
- **CA-11** El sistema DEBE enviar los emails de aviso con el mismo remitente que hoy, con clave propia del proveedor de email y sin pasar por la plataforma de origen · prueba: `src/lib/email.server.test.ts` *(por crear)*
- **CA-12** El sistema DEBE ejecutar las llamadas a Apollo, Clay, Apify, Parallel, Perplexity y Google Drive con claves propias · prueba: `src/lib/apollo.test.ts` (existe) y una prueba por proveedor *(por crear)*
- **CA-13** El sistema DEBE ejecutar las funciones de IA con proveedores propios, sin usar la pasarela de IA de la plataforma de origen · prueba: `src/lib/ai-fallback.test.ts` (existe, se amplía)
- **CA-14** SI un proveedor propio de IA falla, ENTONCES el sistema DEBE usar el siguiente en el orden de prioridad que ya define hoy la configuración de IA y, si no hay ninguno, mostrar un error en español con «qué pasó + qué hacer» · prueba: `src/lib/ai-fallback.test.ts`
- **CA-15** CUANDO Apollo o Telegram envíen eventos a la nueva dirección, el sistema DEBE recibirlos, validar su firma o secreto y procesarlos con el mismo resultado que en el origen (comprobado con un evento de prueba por proveedor) · prueba: `src/lib/apollo.test.ts` y una prueba de Telegram *(por crear)*
- **CA-16** SI falta la clave de un proveedor, ENTONCES el sistema DEBE mostrar un error en español que indique qué conector falta, sin afectar al resto de funciones · prueba: `src/lib/errors.test.ts` (ampliar)

### H-5: Como usuario de asistentes (Claude, ChatGPT…), quiero seguir conectando GTM Brain.
- **CA-17** El sistema DEBE exponer en `/mcp` las mismas herramientas que hoy (lista congelada en U-0 desde `.lovable/mcp/manifest.json`), con el mismo comportamiento y permisos · prueba: `src/lib/mcp/mcp-tools.test.ts` *(por crear)*
- **CA-18** SI una petición a `/mcp` no está autenticada, ENTONCES el sistema DEBE rechazarla · prueba: `src/lib/mcp/mcp-auth.test.ts` *(por crear)*

### H-6: Como Fede, quiero un corte controlado.
- **CA-19** CUANDO se cambie el DNS de nokko.ai, el sistema DEBE estar ya verificado en preproducción con los CA de H-1 a H-5 y CA-26 · prueba: informe en `.factory/evidence/`
- **CA-20** CUANDO se ejecute el corte, el sistema DEBE estar sin servicio como máximo la duración de la ventana que Fede fije por escrito antes de U-7 (propuesta: 1 hora, fuera de horario, con aviso previo); superarla activa CA-25 · prueba: registro del corte en `.factory/evidence/`
- **CA-21** CUANDO se prepare el corte, el sistema DEBE haber superado un ensayo de vuelta atrás en preproducción (volver a los datos y la dirección del origen) con resultado documentado · prueba: informe en `.factory/evidence/`
- **CA-22** CUANDO termine el corte, el sistema DEBE funcionar sin ninguna dependencia en tiempo de ejecución de la plataforma de origen (se comprueba buscando sus referencias en el código ejecutable y en las variables de entorno activas; se admiten menciones históricas en documentación y comentarios) · prueba: `scripts/migration/check-no-origin.mjs` *(por crear)*
- **CA-23** CUANDO el siguiente paso sea irreversible, visible para usuarios o implique gasto o secretos (cambiar el DNS; cambiar direcciones de eventos entrantes de terceros, incluido reapuntar Telegram (solo admite una dirección); avisar a usuarios; enviar el primer email real desde el sistema nuevo; escribir en producción; cualquier cambio en el origen o borrado de volcados; recargar créditos o contactar con soporte del origen; rotar secretos; cambiar las direcciones de retorno del login de Google; usar claves en vivo de Stripe), el agente DEBE detenerse y esperar un OK explícito de Fede en el chat. «Producción» = el dominio nokko.ai, el proyecto de datos definitivo tras el corte y las cuentas de proveedores en vivo; restaurar el volcado en el proyecto nuevo antes del corte NO es producción · prueba: revisión del gate sobre el registro de la sesión
- **CA-24** CUANDO empiece la ventana de corte, el sistema de origen DEBE quedar en solo lectura, DEBE hacerse un volcado final y el recuento y la suma de verificación del destino DEBEN coincidir con ese volcado · prueba: `scripts/migration/verify-data.mjs`
- **CA-25** SI tras el corte falla cualquier criterio de H-1 a H-4 y no se corrige dentro del plazo que Fede fije en U-7, ENTONCES el sistema DEBE volver al origen según el plan de vuelta atrás (decide Fede) y DEBE exportar los datos escritos en el destino desde el corte para reaplicarlos en el origen o conservarlos, sin perderlos · prueba: ensayo de CA-21
- **CA-26** MIENTRAS el sistema funcione en preproducción con datos restaurados, el sistema DEBE enviar emails solo a destinatarios de prueba definidos por Fede y DEBE tener desactivadas las tareas programadas y las llamadas con coste a conectores sobre datos reales, salvo las pruebas de CA-8, CA-9, CA-11 y CA-12, que se ejecutan únicamente con una empresa y destinatarios de prueba y con acceso a preproducción protegido · prueba: `scripts/migration/check-preprod-safe.mjs` *(por crear)*

## 8. Casos límite y errores
- La base de Lovable sigue pausada al empezar → parada hasta que Fede recargue créditos (U-0, CA-23).
- Un mismo email aparece como cuenta de Google y de contraseña, o el identificador de Google difiere entre origen y destino → una sola cuenta, sin duplicar datos (CA-1, CA-2).
- Datos escritos entre el volcado y el corte → origen en solo lectura y volcado final (CA-24).
- Tareas programadas duplicadas durante el solape entre sistema viejo y nuevo → la reserva por día del email diario (`job_locks`) debe sobrevivir al volcado (CA-8).
- Webhooks de terceros que apuntan a la dirección vieja → reapuntar cada uno antes del corte (CA-15, CA-23).
- Secretos que solo existen en Lovable Cloud → inventario en U-0; si falta alguno, Fede lo regenera con el proveedor (CA-16 cubre el síntoma).
- Telegram admite una sola dirección de eventos: la vuelta atrás exige reapuntarla (CA-25).

## 9. Experiencia y copy
Sin cambios visibles. Único texto a revisar: los mensajes de error que hoy dicen «Conecta Supabase en Lovable Cloud» (`src/integrations/supabase/client.ts`, `client.server.ts`, `auth-middleware.ts`); pasan a «No hemos podido conectar con la base de datos. Inténtalo de nuevo en unos minutos.» (en «tú», pasando por `errorText()`; Fede puede cambiarlo). También se cambian los textos «recárgalo en Lovable» de `errors.ts`, `parallel.ts`, `perplexity.ts` y `apollo.ts`.

## 10. Datos, permisos y privacidad
- Se mueve toda la base, incluidos datos de clientes de NOKKO, usuarios y contraseñas cifradas. Volcado e informes se guardan cifrados fuera del repositorio; ningún dato de clientes en código, pruebas, fixtures, logs ni evidencias (las pruebas usan empresas ficticias).
- Sin tablas ni columnas nuevas. Se conserva `INTEGRATION_KEYS_SECRET` sin cambios (cifra los tokens de integraciones; rotarlo los inutiliza). Se conservan `org_id` con `current_org()`, las políticas RLS, los GRANTs y los roles por empresa tal como están.
- Secretos: nunca en `.env`, ni en variables `VITE_`, ni en el repo, el chat o este SDD. Propuesta (Fede confirma): Fede los carga directamente como variables de entorno en el hosting y en el proyecto de datos nuevos; el agente nunca los imprime ni los guarda en archivos.
- Solo API oficial de LinkedIn; esta migración no cambia ningún acceso a LinkedIn.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| Ninguna nueva. Se cambia solo el camino de las existentes (sin la pasarela de IA de la plataforma de origen) | regla → caché → modelo barato → modelo caro (solo «A fondo»), sin cambios | Los que ya define `gemini.ts` (Gemini y OpenRouter propios) | sin dato |

`jev.server.ts` ya prueba proveedores propios (`askOwnJudgments`) antes que la pasarela, así que no depende de ella en exclusiva (revisión técnica). U-3 comprueba que cumple el mismo esquema, y el agente de chat (`agent.server.ts`) también pasa a proveedores propios.

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-0 | Rescate e inventario (bloqueante). Fede recarga créditos una sola vez; reactivar, volcar `public` y `auth`, inventariar secretos, tablas, archivos y funciones, congelar la lista de herramientas MCP, medir usuarios, empresas y usuarios con contraseña. **Parada:** si la base no se reactiva, el agente se detiene; plan B = pedir el volcado a soporte de Lovable. Fede valida el informe (incluido CA-5) antes de seguir y antes de tocar el origen | CA-7 | N/A (operativa): evidencia en `.factory/evidence/` |
| U-1 | Proyecto de datos propio: restaurar el volcado y aplicar `drizzle/migrations` | CA-5, CA-6 | `scripts/migration/verify-data.mjs` contra destino vacío |
| U-2 | Login: Google propio, contraseñas conservadas, retirar el broker de Lovable | CA-1 a CA-4 | `scripts/migration/verify-auth.mjs` contra destino vacío |
| U-3 | Email, cron e IA | CA-8 a CA-11, CA-13, CA-14 | `src/integrations/supabase/cron-auth.test.ts`, `src/lib/email.server.test.ts` |
| U-4 | Conectores y eventos entrantes (coordinar con SDD de conexiones y de Drive) | CA-12, CA-15, CA-16 | una prueba por proveedor |
| U-5 | `/mcp` sin el plugin: reescribe `defineTool` en `src/lib/mcp/*`, el consentimiento OAuth (emisor: Auth del proyecto nuevo) y `[.well-known]/oauth-protected-resource.ts`; es la unidad más pesada | CA-17, CA-18 | `src/lib/mcp/mcp-tools.test.ts` |
| U-6 | Modo seguro de preproducción (CA-26) antes de restaurar datos; build y hosting en preproducción; verificación completa | CA-19, CA-26 | `scripts/migration/check-preprod-safe.mjs` |
| U-7 | Corte: ventana y plazo de vuelta atrás fijados por Fede, DNS, eventos entrantes, aviso a usuarios, origen en solo lectura una semana, limpieza de referencias y de `AGENTS.md` | CA-20 a CA-25 | `scripts/migration/check-no-origin.mjs` |

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- Destino acordado por Fede: proyecto Supabase propio. El hosting (Vercel o mantener Cloudflare) se decide tras U-0 (decidido el 2026-10-29).
- Programador de tareas: Vercel Cron llamando a `/api/public/jobs/proactive` con secreto propio; Inngest ya existe y se mantiene. *[Propuesta — Fede confirma]*
- Volcado: cifrado, fuera del repo, en el lugar y con la clave que Fede indique. *[Propuesta — Fede confirma]*
- `drizzle.config.ts` usa `LOVABLE_DB_MIGRATION_URL`: pasa a la URL del proyecto nuevo.
- Reutilizar `src/lib/ai-gateway.ts`, `aiProviders()` de `gemini.ts` y `job_locks`; no tocar la lógica de negocio.
- Mantener la regla de `AGENTS.md`: sin `as any` y errores por `errorText()`.

## 14. Riesgos y dependencias
- Depende de que Fede recargue créditos una vez y de que la base se reactive. Coste de los créditos: sin dato.
- Depende de los accesos de Fede: DNS, cuentas de proveedores y credenciales de Google.
- Los hashes de contraseña y las identidades de Google deben restaurarse en el esquema de autenticación; si no encajan, los usuarios tendrían que restablecer la contraseña (impacto a medir en U-0).
- Solape con `connections-bring-your-own-account` y `drive-per-company-account`: ambos reescriben las llamadas por pasarela. Se coordina el orden para que no se pisen (un contrato escrito antes de tocar la misma interfaz).
- Hay otros worktrees de NOKKO con cambios sin integrar; esta migración parte de la base que indique Fede.
- La revisión técnica recomienda dividir al menos U-0 y U-1 (urgentes e independientes) y U-5 (`/mcp`, la más pesada). Decisión de Fede: de momento, un solo SDD; se revisa tras la aprobación.
- Cambio de runtime: hoy Cloudflare Worker; pasar a Vercel cambia la ejecución tras la respuesta y los límites de duración, y Vercel Cron depende del plan **[Por verificar]**. Alternativa de menor cambio: mantener Cloudflare. Decide Fede (pregunta 4).
- `src/lib/AGENTS.md` marca las migraciones 0058 y 0059 como no verificadas y no aplicadas: Fede decide si el destino las incluye (pregunta 7).
- `cron-auth.ts` figura como autogenerado: este SDD autoriza editarlo.

## 15. Preguntas para Fede y para la revisión técnica
**Decididas por Fede el 2026-10-29:**
1. Programador de tareas: Vercel Cron, con secreto propio. **Condicionado al runtime:** Vercel Cron solo funciona si el hosting es Vercel; si tras U-0 se mantiene Cloudflare, el programador será el de Cloudflare, y se confirma entonces. Depende del plan de Vercel **[Por verificar en U-0]**.
2. Volcado: disco cifrado y una segunda copia cifrada en un almacenamiento de Fede; la clave la guarda Fede y nunca va al repo.
3. Secretos: los carga Fede como variables de entorno del hosting y del proyecto de datos; el agente nunca los ve ni los toca.
4. Cuenta de Vercel: la cuenta personal de Fede (no el equipo Postin, que es otro producto). La primera mitad de la pregunta, runtime (hoy Worker de Cloudflare; pasar a Vercel cambia el contrato de ejecución), se decide tras U-0, cuando el inventario mida el coste real de cada opción.
5. `INTEGRATION_KEYS_SECRET`: se conserva sin cambios; en U-0 se comprueba (CA-27) que los tokens descifran. Si Fede no pudiera recuperar el valor, habría que reconectar las integraciones de cada usuario.
6. `/mcp`: se mantiene la misma dirección en nokko.ai con las mismas herramientas; el emisor OAuth pasa al Auth del proyecto nuevo, así que puede hacer falta reautorizar una vez.

7. Migraciones 0058 y 0059: se restaura el volcado tal cual está en producción y se aplican en el destino **después**, solo tras su verificación y los SDD de NK-0022 y escritores; no durante la migración.
8. Dividir el SDD en tres: SDD A (U-0 y U-1: rescate y datos, lo urgente), SDD B (U-2 a U-4, U-6 y U-7) y SDD C (U-5, `/mcp`). La división se hace como paso siguiente; hasta entonces este documento contiene todas las unidades.

**Siguen abiertas:** el runtime (Cloudflare o Vercel), que se decide tras U-0.

## 16. Pendiente de verificar
1. Estado y contenido de la base tras reactivarla (usuarios, empresas, tamaño): sin dato. Lo comprueba U-0 con la base reactivada.
2. Inventario de secretos que solo existen en Lovable Cloud. U-0.
3. Cuántos usuarios usan contraseña (el código lo permite; CA-2 aplica). U-0.
4. El disparador sobre `auth.users` y las publicaciones de tiempo real están en `drizzle/migrations`, pero un volcado de solo `public` y `auth` no los recrea: U-1 debe aplicarlos. No hay almacenamiento de archivos ni funciones de borde (revisión técnica).
5. Si las claves de Apollo, Clay, Apify, Parallel, Perplexity y Google Drive son de cuentas de Fede o están dentro de Lovable. Fede y cada proveedor.
6. Que `askOwnJudgments` (Jev) cumple el mismo esquema que la pasarela. U-3.
7. Si Lovable Cloud permite acceso directo a la base y a `auth` para el volcado, y cómo dejar el origen en solo lectura en el corte (alternativa: cerrar el acceso de usuarios). U-0 y soporte de Lovable.
8. Telegram con una sola dirección de eventos y TTL actual del DNS de nokko.ai. Fede.
9. Coste mensual del nuevo hosting y de la base: sin dato.
10. Contrato de ejecución en Vercel frente al Worker actual (trabajo tras la respuesta, duración máxima, plan de Vercel Cron). Fede y U-6.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Informe completo, copiado sin editar: `docs/sdd/annex/gate-lovable-exit-20261029.md`. Se hizo sobre la versión anterior a las correcciones de hechos; el autor corrigió después lo que señala como error de hecho (secciones 3, 5, 9, 10, 11, 14, 15 y 16; CA-2, CA-15, CA-23, CA-27; U-5 y U-6). Siguen abiertas las objeciones de decisión: runtime (Vercel o Cloudflare), división del SDD y orden con los SDD de conexiones y Drive.

- Veredicto del gate: Objeciones
- CA sin prueba posible o sin G-n: CA-15 (la parte de Stripe, no hay ruta de webhook de Stripe en el código). CA-3, CA-4, CA-19, CA-20, CA-21, CA-23 y CA-25 solo tienen prueba por evidencia manual o por revisión, no por test automático. CA-8 y CA-12 «existe»: los archivos existen, pero hay que comprobar que cubren lo que se les atribuye. Ningún CA cita G-n (el SDD declara «PRD: No aplica», coherente con la plantilla).
- [Por verificar] que sigue sin comprobarse: el contenido y el volumen de la base, los hashes de contraseña y las identidades de Google; cuáles secretos solo existen en Lovable; las claves de los proveedores; el TTL del DNS; el acceso directo a `auth` y el modo solo lectura del origen; los costes. Las secciones 11 y 16.6 (Jev) pueden resolverse con código, ver Detalle.
- Contradicciones con el código o con decisiones previas: (1) no hay webhook de Stripe. (2) El runtime hoy es Cloudflare Worker, no hay Vercel. (3) La sección 3 omite acoplamientos. (4) `/mcp` no puede ser «propia» sin reescribir las herramientas. (5) El orden con los SDD de conexiones y Drive está sin resolver.
- Lo que esta revisión NO demuestra: nada del comportamiento en el proveedor real, ni de los datos ni de producción; no se ejecutó ningún test; no se comprobó qué hay dentro del proyecto de Lovable ni en Cloudflare.


### Segunda pasada del gate (2026-10-29), copiada sin editar
Sobre el texto con las 6 decisiones de Fede de la sección 15 ya registradas.

**Veredicto del gate:** Objeciones

**Acoplamientos con Lovable que faltan o están mal descritos:**
- Las claves de Stripe de cada empresa se guardan en el Vault de Supabase (`stripe/sync.server.ts:76` con `stripe_key_for`, `stripe.functions.ts:28`, `field-baseline.ts:80` con `vault_secret_id`). El SDD dice que son «claves directas» y que basta con verificarlas (SDD:25, :46). El SDD de conexiones (línea 118) dice que están en Vault. Ningún CA comprueba que esas claves sigan funcionando después de restaurar.
- Telegram y Resend usan claves de la pasarela, no del proveedor: `telegram.server.ts:1` indica que el token del bot lo pone la pasarela, y `email.server.ts:1-3` llama a esa clave «gateway key» y dice que el dominio debe estar verificado en esa cuenta de Resend. El punto 16.5 no los incluye.
- `oauth-protected-resource.ts:18-21` se fía de X-Forwarded-Host, algo que el propio archivo da por seguro «solo en Lovable».
- Faltan además: `leads.entrada.tsx:43` (lovableproject.com), `jev.server.ts` con el texto «Añade créditos en Ajustes → Planes y créditos», y las reglas de `src/lib/AGENTS.md:7,17,21,26-34` y `GROUND-RULES.md:18`.

**CA sin prueba posible o con hueco:**
- CA-27 no lo cierra ninguna unidad (SDD:149-156), aunque 15.5 lo asigna a U-0. `secret-box.test.ts` no existe.
- Las pruebas que el SDD da por existentes no cubren lo que se les atribuye: `daily-email.test.ts:7-23` no prueba el «una sola vez» (eso está en `daily-email.server.ts:86`), y `apollo.test.ts:106` solo lee el contenido del webhook, sin validar el secreto.
- `scripts/migration/`, cron-auth, email, rls-isolation y los tests de MCP no existen. CA-2 no lleva la marca «por crear».
- `ai-fallback.test.ts:14` exige hoy `["lovable"]`: CA-13 obliga a reescribir esa aserción.
- Ningún CA cubre que haya que reautorizar MCP: el emisor sale del proyecto de datos (`mcp/index.ts:7,18`).
- Ningún CA cubre el orden de apagado del cron que gestiona Lovable: no está en el repo.
- Ningún CA cubre que haya que volver a registrar en Inngest la nueva dirección.
- CA-25 no tiene ensayo posible: CA-21 se ensaya sin escrituras posteriores al corte.

**Riesgos de seguridad, datos y corte:**
- U-1 propone «restaurar y aplicar `drizzle/migrations`», pero 0018–0029 y 0054 están completamente comentadas (`0027_stripe.sql:1` dice «already in the database»). En una base vacía faltarían objetos; encima de un volcado restaurado, chocarían (`0000_migration.sql:47`).
- `job_locks` no evita duplicados entre dos bases distintas (SDD:125).
- Los teléfonos de Apollo pendientes llegan al host antiguo (`apollo.ts:276-278`) y se pierden después del corte.
- CA-26 no cubre envíos por Telegram ni por Inngest. Además, `background.functions.ts:108` hace que la preproducción nunca use Inngest, así que CA-19 no lo verifica.

**Contradicciones con el código o con decisiones previas:**
- El punto 6:78 elimina `/.lovable/oauth/consent`, pero es la pantalla de consentimiento del OAuth de Supabase (`[.]lovable.oauth.consent.tsx:26`), y U-5 la mantiene.
- 13:159 da Vercel por acordado, cuando el runtime sigue abierto (15:182).
- U-1 aplica 0058 y 0059 (están en `_journal.json`), lo que contradice la pregunta 7, que sigue abierta. El código ya lee `org_connections` (`connections-panel.tsx:21`), aunque `src/lib/AGENTS.md:57` dice que 0059 no está aplicada.

**[Por verificar] que ya se puede comprobar:**
- §3:28: el código ya supone un Worker (`server.ts:66`, `after-response.server.ts:2`, `vite.config.ts:4`).
- 16.4: el disparador está en `0000:47` y las publicaciones de tiempo real en `0010:57-58`, `0012:113`, `0037:26`, `0038:26` y `0049:29`.
- 16.6: `askOwnJudgments` usa un esquema estricto (`jev.server.ts`).

**Siguen abiertas (no las resuelvo):** runtime Cloudflare o Vercel; si el destino incluye 0058 y 0059; si se divide el SDD.

**Lo que esta revisión NO demuestra:**
- No ejecuté nada: ni tests, ni Supabase, ni Lovable, ni Cloudflare.
- No comprobé si un Vault restaurado descifra en el proyecto nuevo, ni si `pg_dump` de `auth` conserva hashes, identidades de Google o clientes OAuth.
- No comprobé qué cron hay configurado dentro de Lovable, ni el estado de producción.
- No leí el contenido de los secretos.

## 18. Delta de implementación (lo rellena el agente al entregar)
{Pendiente. Estado a «En curso» al empezar; «Hecho» solo cuando el gate pase y Fede apruebe la entrega.}
