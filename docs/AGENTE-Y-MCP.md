# Agente de IA y servidor MCP

## 1. El agente

El agente conversa con la persona y actúa sobre sus datos. **Lee al momento; escribe solo tras confirmación explícita.**

### Arquitectura
- **Registro único** de herramientas: `src/lib/agent/tools.ts` concatena, en orden fijo, los módulos de `src/lib/agent/tools/`. Ese es el orden que ve el modelo. Tipos y helpers comunes en `tool-kit.ts` (`def`, `one`, `mustFind`, `mustBeMember`, `accountNames`, `isLeader`, `canPrice`).
- Cada herramienta declara `kind: "read" | "write"`, esquema zod de entrada, `roles?` opcional y `summarize` opcional.
- **Turno** (`agent.server.ts`): `streamText` del AI SDK con `stopWhen: stepCountIs(12)`; historial de los últimos 30 mensajes; solo se guarda texto plano de usuario y asistente en `agent_messages`, así todos los canales comparten núcleo.
- **Prompt**: persona y workflow BMAD, modo «Entrevista de configuración» y bloque de memoria (`memoryBlock`).
- **Memoria**: se aprende tras responder (`afterResponse`, con `waitUntil` en `src/server.ts`). Solo se aprende de lo que escribe la persona (`chatLearnText` en `learn-text.ts`); la respuesta del agente queda fuera para que una propuesta suya no se guarde como hecho.
- **Traza de herramientas**: cada llamada de un turno (chat, Telegram, cron y MCP) deja una fila en `agent_tool_calls` con herramienta, tipo, resultado (`ok`, `error`, `pending`), duración, proveedor y origen (`tool-trace.ts`, migración 0108). No guarda argumentos, resultados ni texto de error. Si la escritura falla, el turno sigue.
- **UI**: no tiene ruta. `AgentProvider` abre un panel lateral con ⌘J, desde la barra superior, la barra móvil o ⌘K. Con `docked` se queda junto a la página (lo usa Pipeline).

### Proveedores de IA (`aiProviders()` en `src/lib/gemini.ts`)
1. OpenRouter con BYOK (por defecto Gemini, luego Claude, luego GPT, o `OPENROUTER_MODEL`).
2. Gemini directo (`GEMINI_API_KEY`).
3. Lovable AI Gateway (queda fuera si hay OpenRouter, salvo `AI_LOVABLE_FALLBACK=on`).

El agente solo cae al siguiente proveedor si todavía no ha propuesto ninguna acción de escritura. Gemini necesita `fixGeminiStream` porque su stream no trae `tool_calls[].index`. Las claves **nunca** van en `.env` ni en variables `VITE_`.

### Herramientas (112)
53 de lectura y 59 de escritura. Solo 9 llevan `roles:` explícito (strategy 6, inbox 2, product 1); el resto comprueba el rol dentro del handler.

| Módulo | Total | Lectura | Escritura |
| --- | ---: | ---: | ---: |
| core-read | 13 | 13 | 0 |
| core-write | 12 | 0 | 12 |
| strategy | 8 | 2 | 6 |
| field-actions (incluye `delete_segment`, `delete_icp`, `delete_pillar`) | 9 | 2 | 7 |
| cycle | 3 | 2 | 1 |
| accounts | 11 | 4 | 7 |
| pipeline | 11 | 4 | 7 |
| meetings | 6 | 2 | 4 |
| inbox | 6 | 1 | 5 |
| clay | 3 | 3 | 0 |
| apollo | 5 | 3 | 2 |
| web | 3 | 2 | 1 |
| drive | 6 | 3 | 3 |
| linkedin | 5 | 4 | 1 |
| product | 2 | 1 | 1 |
| parallel | 5 | 3 | 2 |
| needs (`complete_account`, `find_key_people`, `find_icp_companies`, `integration_budget`) | 4 | 4 | 0 |

Reglas de implementación (de `src/lib/AGENTS.md`): cada handler filtra por `org_id` explícitamente, valida con `mustFind`/`mustBeMember` cada id que enlaza (cuenta, deal, segmento, miembro), lee nombres relacionados con el filtro de empresa (`accountNames`, nunca un join embebido) y replica las reglas que la app da por RLS o triggers (visibilidad de sugerencias con `canActOnSuggestion`, quién decide aprobaciones, quién reasigna un deal, precios y descuentos solo para `canPrice`, documentos personales solo para su autor).

### Confirmación de escrituras
1. La herramienta de escritura inserta una fila en `agent_pending_actions` (`tool`, `args`, `summary`) y responde «pendiente de confirmación».
2. La persona confirma en el chat, en Sugerencias o con los botones de Telegram.
3. `decidePending` busca la acción por `id` + `user_id` + `org_id` y la **reclama** con `update … where status='pending'` antes de ejecutar (evita el doble clic).
4. Si va bien, se añade «Hecho: …» al chat; si falla, la acción pasa a `failed`.
5. `update_deal` replica Pipeline: una etapa de tipo ganado crea una aprobación `stage_change`, el gate MEDDPICC avisa y el importe sigue a las líneas de producto.

### Canales
| Canal | Entrada | Cliente | Notas |
| --- | --- | --- | --- |
| Web | `sendAgentMessage` (server function) | Cliente de la persona (RLS) | Mensaje máx. 4000 caracteres |
| Telegram | `/api/public/telegram/webhook` | Admin + `channelCtx` | Enlace con código de un solo uso (6 caracteres, caduca a los 15 min, tabla `channel_links`). Comandos `/vincular`, `/start`, `/nueva`. Botones `a:<id>:c|x` (confirmar/cancelar) y `s:<id>:…` (sugerencias). Idempotente por `update_id` en `telegram_updates`. Respuestas en texto plano, cortadas a 4000 |
| Cron y trabajos | `jobCtx` (`job-runner.server.ts`) | Admin | Reconstruye roles con el cliente admin |
| MCP | `/mcp` | Cliente de la persona (RLS) | Ver abajo |

WhatsApp está anotado como futuro; no hay código.

### Límites conocidos
- `guard_approval` lee `auth.uid()`: `decide_approval` falla desde Telegram hasta que una migración permita el camino privilegiado.
- Telegram y cron no tienen RLS: la seguridad es de código. Hay tests con cliente falso (`agent-tools.test.ts`, `expectScoped`).
- Las lecturas devuelven errores como objeto `{error}`, no lanzan excepción.

## 2. Servidor MCP

Permite usar NOKKO desde ChatGPT, Claude, Claude Code u otros asistentes (pantalla `/connect`).

- **Endpoint**: `/mcp` (`src/routes/mcp.ts`, autogenerado por `@lovable.dev/mcp-js`; cabecera «AUTO-GENERATED», no editar a mano).
- **Metadatos OAuth**: `/.well-known/oauth-protected-resource`. **Consentimiento**: `/.lovable/oauth/consent` (requiere sesión; si no, redirige a `/auth?next=`).
- **Auth**: OAuth con issuer `https://<proyecto>.supabase.co/auth/v1` y audiencia `authenticated`.
- **Cliente**: `supabaseForUser` crea un cliente con la clave publicable y el Bearer del llamante, así RLS aplica como a esa persona. Nunca usa service role.
- **Contexto** (`mcpCtx`): lee `profiles.current_org_id` y roles en `org_members`; sin empresa activa o sin pertenecer a ella, lanza error.
- **Herramientas**: **116** en `.lovable/mcp/manifest.json` (verificado), versión del manifest `0.1.0`.
  - Las 112 del agente, generadas desde `TOOLS`.
  - `list_companies` (lectura), `switch_company` (escritura directa: cambia `profiles.current_org_id`), `get_real_metrics` y `get_segment_coverage`.
  - Las escrituras del agente **no ejecutan**: insertan en `agent_pending_actions` con `source:'mcp'` y se confirman en Sugerencias.
  - `canUseTool` aplica el rol; las salidas JSON se truncan a 60.000 caracteres.
- **Anotaciones**: `readOnlyHint`, `idempotentHint`, `openWorldHint` (una regex `EXTERNAL` marca las herramientas que salen a fuentes externas).

### Al tocar herramientas
1. Añade o cambia la herramienta en `src/lib/agent/tools/`.
2. Añade su título a `TITLES` en `src/lib/mcp/tools/agent-tools.ts` (hoy 112 entradas, no falta ninguna).
3. Regenera el manifest:
   ```sh
   node node_modules/@lovable.dev/mcp-js/dist/cli/extract-manifest.cjs .
   ```
4. No hay test que vigile que `manifest.json` y `TITLES` estén sincronizados: revísalo a mano.
