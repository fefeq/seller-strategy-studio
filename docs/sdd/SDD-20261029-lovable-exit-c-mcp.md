# SDD-20261029-lovable-exit-c-mcp · [Feature] NOKKO deja de depender de Lovable · C: /mcp

**Tipo:** Feature · **Prioridad propuesta:** Alta
**Estado:** Borrador · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-10-29
**PRD:** No aplica (heredado del SDD paraguas: migración de infraestructura sin cambio de producto; un PRD solo repetiría el resumen). · **Depende de:** SDD A (`SDD-20261029-lovable-exit-a-rescate-y-datos.md`: proyecto de datos restaurado) y U-2 del SDD B (`SDD-20261029-lovable-exit-b-servicios-y-corte.md`): el emisor OAuth de `/mcp` es el Auth del proyecto nuevo.
**SDD paraguas:** [`SDD-20261029-lovable-exit-migration`](SDD-20261029-lovable-exit-migration.md). La división en tres SDD (A, B y C) la decidió Fede el 2026-10-29; CA, H-n y U-n conservan la numeración del paraguas.

> Un SDD dice cómo se verifica que está bien hecho. Cada criterio de aceptación (CA-n) debe poder tener una prueba automática que lo nombre. Los nombres marcados *(por crear)* son propuestas para el brief.
> Nota de términos: «plataforma de origen» = Lovable (Lovable Cloud y su pasarela de conectores y de IA). Se nombra porque es el objeto del cambio, no como fuente del estado del producto (la fuente es este repo).

## 1. Resumen
NOKKO deja de depender de Lovable para base de datos, login, hosting, tareas programadas, email, conectores e IA. El 2026-10-28 Lovable avisó de que la base de datos está en pausa por falta de créditos de Cloud: nadie puede entrar a nokko.ai y tampoco funcionan los datos, los avisos ni las tareas automáticas (el email de las 8:00 y las búsquedas semanales). La migración deja NOKKO funcionando sobre cuentas y claves de Fede, sin cambio visible para el usuario.

## 2. Problema y para quién
Un fallo de facturación ajeno al producto apaga NOKKO entero. Afecta a todo usuario de NOKKO y a Fede como propietario del negocio.

## 3. Evidencia y por qué ahora
Fuente: mensaje de Lovable del 2026-10-28 (pegado por Fede) y lectura del código de este repo el 2026-10-29. Sin datos de uso.
- Acoplamientos encontrados en el código:
  - Hosting y build: `vite.config.ts` usa `@lovable.dev/vite-tanstack-config` y `mcpPlugin`.
  - Menores: `__LOVABLE_PROJECT_ID` (base del webhook de Apollo), `VITE_LOVABLE_CONNECTOR_LOGO_DEV_API_KEY`, ruta `/.lovable/oauth/consent`, `.lovable/mcp/manifest.json`, `src/routes/mcp.ts` (autogenerado por el plugin), `LOVABLE_DB_MIGRATION_URL` en `drizzle.config.ts`.
- Acoplamientos que añadió la revisión técnica (sección 17): Telegram y el envío de eventos a Inngest también usan la pasarela (`telegram.server.ts`, `inngest/send.server.ts`); el agente de chat, Telegram y MCP llama a `ai.gateway.lovable.dev` (`agent/agent.server.ts`, `agent/run-id.ts`, `ai-gateway.ts` y `gemini.ts` con el proveedor «lovable»); URLs fijas `…lovable.app` para el webhook de Apollo (`apollo.ts`) y para detectar «sitio publicado» (`background.functions.ts`); `lovable-error-reporting.ts` y `__root.tsx`; `.env` con `VITE_LOVABLE_CONNECTOR_*`; `package.json` y `bunfig.toml`; textos «recárgalo en Lovable» (`errors.ts`, `parallel.ts`, `perplexity.ts`, `apollo.ts`); `src/lib/mcp/*` y `[.well-known]/oauth-protected-resource.ts` (autogenerado) con `@lovable.dev/mcp-js`.

## 4. Resultado buscado
- NOKKO funciona con Lovable desactivado: login, datos, email de las 8:00, búsqueda semanal, conectores, IA y `/mcp`.
- Medición: CA de H-1 a H-5 y CA-26 superados en preproducción; CA-19 a CA-25 en el corte; tras el corte, H-1 a H-4 en nokko.ai. Fuente: informes en `.factory/evidence/` y registros de ejecución del hosting. Línea base de usuarios y empresas: sin dato.

## 5. Alcance
**Incluye:**
- Conectores (Apollo, Clay, Apify, Parallel, Perplexity, Google Drive) sin pasarela de Lovable; Telegram e Inngest también; Stripe y PostHog solo verificar claves; eventos entrantes de Apollo y Telegram. El agente de chat, Telegram y MCP pasan a IA propia.
- Endpoint `/mcp` sin el plugin de Lovable, con las mismas herramientas.

**No incluye:**
- Cambios de producto, de diseño o de precios.

## 6. Cambios de comportamiento (delta)
**Añadido:** nada visible para el usuario.
**Modificado (antes → después):**
- `/mcp`: generado por el plugin → implementación propia con las mismas herramientas.
**Eliminado:** broker de sesión de vista previa, ruta `/.lovable/oauth/consent`, dependencias `@lovable.dev/*` y los mensajes que mandan a «conectar Supabase en Lovable Cloud».

## 7. Historias y criterios de aceptación

### H-5: Como usuario de asistentes (Claude, ChatGPT…), quiero seguir conectando GTM Brain.
- **CA-17** El sistema DEBE exponer en `/mcp` las mismas herramientas que hoy (lista congelada en U-0 desde `.lovable/mcp/manifest.json`), con el mismo comportamiento y permisos · prueba: `src/lib/mcp/mcp-tools.test.ts` *(por crear)*
- **CA-18** SI una petición a `/mcp` no está autenticada, ENTONCES el sistema DEBE rechazarla · prueba: `src/lib/mcp/mcp-auth.test.ts` *(por crear)*

## 8. Casos límite y errores
El SDD paraguas no lista casos límite propios de U-5 (`/mcp`); los huecos que señaló el gate están en la sección 17.

## 9. Experiencia y copy
Sin cambios visibles.

## 10. Datos, permisos y privacidad
- Se mueve toda la base, incluidos datos de clientes de NOKKO, usuarios y contraseñas cifradas. Volcado e informes se guardan cifrados fuera del repositorio; ningún dato de clientes en código, pruebas, fixtures, logs ni evidencias (las pruebas usan empresas ficticias).
- Sin tablas ni columnas nuevas. Se conserva `INTEGRATION_KEYS_SECRET` sin cambios (cifra los tokens de integraciones; rotarlo los inutiliza). Se conservan `org_id` con `current_org()`, las políticas RLS, los GRANTs y los roles por empresa tal como están.
- Secretos: nunca en `.env`, ni en variables `VITE_`, ni en el repo, el chat o este SDD. Propuesta (Fede confirma): Fede los carga directamente como variables de entorno en el hosting y en el proyecto de datos nuevos; el agente nunca los imprime ni los guarda en archivos.
- Solo API oficial de LinkedIn; esta migración no cambia ningún acceso a LinkedIn.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| Ninguna en este SDD hijo. Las llamadas existentes cambian de camino en U-3 (SDD B) | — | — | — |

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-5 | `/mcp` sin el plugin: reescribe `defineTool` en `src/lib/mcp/*`, el consentimiento OAuth (emisor: Auth del proyecto nuevo) y `[.well-known]/oauth-protected-resource.ts`; es la unidad más pesada | CA-17, CA-18 | `src/lib/mcp/mcp-tools.test.ts` |

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- Mantener la regla de `AGENTS.md`: sin `as any` y errores por `errorText()`.

## 14. Riesgos y dependencias
- Hay otros worktrees de NOKKO con cambios sin integrar; esta migración parte de la base que indique Fede.
- La revisión técnica recomienda dividir al menos U-0 y U-1 (urgentes e independientes) y U-5 (`/mcp`, la más pesada). Decisión de Fede: de momento, un solo SDD; se revisa tras la aprobación.

## 15. Preguntas para Fede y para la revisión técnica
**Decididas por Fede el 2026-10-29:**
5. `INTEGRATION_KEYS_SECRET`: se conserva sin cambios; en U-0 se comprueba (CA-27) que los tokens descifran. Si Fede no pudiera recuperar el valor, habría que reconectar las integraciones de cada usuario.
6. `/mcp`: se mantiene la misma dirección en nokko.ai con las mismas herramientas; el emisor OAuth pasa al Auth del proyecto nuevo, así que puede hacer falta reautorizar una vez.

8. Dividir el SDD en tres: decidido por Fede el 2026-10-29. Este es el SDD C. Los tres son: SDD A (`SDD-20261029-lovable-exit-a-rescate-y-datos.md`: U-0 y U-1, rescate y datos, lo urgente), SDD B (`SDD-20261029-lovable-exit-b-servicios-y-corte.md`: U-2 a U-4, U-6 y U-7) y SDD C (`SDD-20261029-lovable-exit-c-mcp.md`: U-5, `/mcp`). El SDD paraguas (`SDD-20261029-lovable-exit-migration.md`) queda como registro del conjunto.

**Siguen abiertas:** ninguna propia de este hijo. El runtime (Cloudflare o Vercel) sigue abierto en el SDD B y se decide tras U-0.

## 16. Pendiente de verificar
1. Nada propio de U-5 en la lista del SDD paraguas; los [Por verificar] de `/mcp` que señaló el gate están en la sección 17.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Un agente `nokko-gate` con contexto fresco lee este SDD y el código, y devuelve su informe. El coordinador lo copia aquí sin editarlo. El gate no aprueba el SDD: informa; la aprobación es de Fede.
- Veredicto del gate: No revisado
- CA sin prueba posible o sin G-n: pendiente
- [Por verificar] que sigue sin comprobarse: pendiente
- Contradicciones con el código o con decisiones previas: pendiente
- Lo que esta revisión NO demuestra: pendiente

Los informes del gate del SDD paraguas (2026-10-28 y 2026-10-29, `annex/gate-lovable-exit-20261029.md` y la sección 17 del padre) revisaron el conjunto y sus objeciones siguen vigentes hasta que un gate nuevo revise este hijo.

### Objeciones del gate del paraguas que le afectan
Copiadas sin editar del SDD paraguas y de su anexo; los números de línea («SDD:149», «13:159»…) se refieren al SDD paraguas.

**Primer informe, resumen (anexo y sección 17 del paraguas):**
- Contradicciones con el código o con decisiones previas: (1) no hay webhook de Stripe. (2) El runtime hoy es Cloudflare Worker, no hay Vercel. (3) La sección 3 omite acoplamientos. (4) `/mcp` no puede ser «propia» sin reescribir las herramientas. (5) El orden con los SDD de conexiones y Drive está sin resolver.
- Lo que esta revisión NO demuestra: nada del comportamiento en el proveedor real, ni de los datos ni de producción; no se ejecutó ningún test; no se comprobó qué hay dentro del proyecto de Lovable ni en Cloudflare.

**Primer informe, Detalle (anexo):**

2. **Acoplamientos que faltan en el SDD.**
   - `agent/agent.server.ts:53,147-150` llama a `ai.gateway.lovable.dev` y `agent/run-id.ts` maneja cabeceras `X-Lovable-AIG-*`. Es el agente de chat, de Telegram y de MCP, no solo Jev.
   - `src/lib/mcp/{index,context,supabase}.ts` y los tres archivos de `tools/` importan `@lovable.dev/mcp-js`; `routes/mcp.ts` y `[.well-known]/oauth-protected-resource.ts` están autogenerados, este último con `trustForwardedHost` «solo seguro en Lovable» (líneas 18-22).
5. **MCP.** El OAuth de `/mcp` usa como emisor el propio Auth de Supabase (`mcp/index.ts:21`), así que depende de que el proyecto nuevo tenga ese servidor OAuth activo. La ruta `/.lovable/oauth/consent` sirve a eso: eliminarla sin sustituto rompe el consentimiento. «Implementación propia» (U-5) implica reescribir `defineTool` en los tres archivos de herramientas y `agent-tools.ts`; el SDD no lo dimensiona.
6. **Tests citados.** Existen: `daily-email.test.ts`, `apollo.test.ts`, `ai-fallback.test.ts`, `errors.test.ts`. No existen, y están marcados «por crear»: `cron-auth.test.ts`, `email.server.test.ts`, `rls-isolation.test.ts`, `mcp-tools.test.ts`, `mcp-auth.test.ts`. Esto es coherente. CA-6 exige dos empresas ficticias con RLS real: ese test necesita una base real y no es una prueba unitaria. CA-17 («mismas herramientas») sí es probable contra la lista congelada de `.lovable/mcp/manifest.json` (142 KB).
9. **Acciones irreversibles sin parada clara.** CA-23 las cubre bien en general. Faltan estos casos: reapuntar Telegram con `setWebhook` (solo admite una dirección; el SDD lo cita en la sección 8 pero no como parada); que el correo diario real salga antes del corte por el solape; y rotar `INTEGRATION_KEYS_SECRET` (pregunta 5 abierta, pero decisiva: sin esa clave se pierden los tokens cifrados, ver `secret-box.server.ts`). La restauración en preproducción puede mandar webhooks o emails reales si CA-26 se implementa tarde; debería ser lo primero que se compruebe.
10. **División.** Sí conviene dividir, por independencia comprobada en el código:
    - (a) U-0 y U-1 (rescate y datos) no dependen del resto, y la base está en pausa, así que es lo urgente.
    - (b) U-2 (login), U-3 (email, cron e IA) y U-4 (conectores) son independientes entre sí.
    - (c) U-4 colisiona con los SDD de Drive y de conexiones.
    - (d) U-5 (`/mcp`) es la más pesada y no bloquea el login ni los datos; sale bien como SDD aparte.
    - (e) U-6 y U-7 (hosting y corte) son un tercer bloque, con el cambio de runtime a Vercel como riesgo propio.

    La decisión de «un solo SDD» está en la sección 14; recomiendo al menos separar (a) y (d).

**Segunda pasada del gate (2026-10-29, sección 17 del paraguas):**

**Acoplamientos con Lovable que faltan o están mal descritos:**
- `oauth-protected-resource.ts:18-21` se fía de X-Forwarded-Host, algo que el propio archivo da por seguro «solo en Lovable».

**CA sin prueba posible o con hueco:**
- `scripts/migration/`, cron-auth, email, rls-isolation y los tests de MCP no existen. CA-2 no lleva la marca «por crear».
- Ningún CA cubre que haya que reautorizar MCP: el emisor sale del proyecto de datos (`mcp/index.ts:7,18`).

**Contradicciones con el código o con decisiones previas:**
- El punto 6:78 elimina `/.lovable/oauth/consent`, pero es la pantalla de consentimiento del OAuth de Supabase (`[.]lovable.oauth.consent.tsx:26`), y U-5 la mantiene.

**Siguen abiertas (no las resuelvo):** runtime Cloudflare o Vercel; si el destino incluye 0058 y 0059; si se divide el SDD.

**Lo que esta revisión NO demuestra:**
- No ejecuté nada: ni tests, ni Supabase, ni Lovable, ni Cloudflare.
- No comprobé si un Vault restaurado descifra en el proyecto nuevo, ni si `pg_dump` de `auth` conserva hashes, identidades de Google o clientes OAuth.
- No leí el contenido de los secretos.

## 18. Delta de implementación (lo rellena el agente al entregar)
Sin entrega todavía.
