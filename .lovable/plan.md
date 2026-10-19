# Conectar GTM Brain a Claude, ChatGPT, Codex y otros asistentes (MCP)

## Qué tendrá el usuario
- Una dirección de conexión de la app (`https://nokko.ai/mcp`) que puede añadir como conector en Claude, ChatGPT, Codex, Cursor, etc.
- Al conectar, el asistente abre una pantalla de GTM Brain: el usuario inicia sesión (email o Google) y ve «Conectar <asistente> a GTM Brain» con Aprobar / Cancelar.
- Desde ese momento el asistente actúa **como ese usuario**, en su empresa activa y con su rol: ve y hace lo mismo que vería y haría en la app, nada más.
- En Equipo, una tarjeta «Conectar con asistentes de IA» con la dirección, un botón de copiar y pasos breves para Claude, ChatGPT y Codex.

## Herramientas que expone (reutilizan las del agente actual)
Consultas, sin confirmación:
- Resumen de la empresa, buscar cuentas/personas/deals, ver una cuenta, listar deals y tareas, sugerencias, estado de configuración, buscar en conocimiento, estado del ciclo GTM y documentos.
- Nuevas: métricas reales (ACV, win rate y ciclo por segmento) y cobertura por segmento del trimestre.
- Listar empresas del usuario y cambiar de empresa activa.

Acciones (crear cuenta/deal/tarea/reunión, mover deal de etapa, completar tarea, registrar trial, experimento, posicionamiento, segmentos, ICP…):
- Por defecto se quedan **pendientes de confirmar en la app** (igual que hoy con el agente y Telegram), y el asistente devuelve el resumen y el enlace a Sugerencias.
- Se respetan los permisos por rol y la regla de que solo el Owner borra (no se expone ningún borrado).

## Fuera de alcance
- Borrar datos, pagos o envíos de emails desde el asistente.
- Herramientas dentro del navegador (WebMCP); se pueden añadir después.

## Requisito
- Funciona para asistentes externos **cuando publiques la app**. Hasta entonces queda configurado pero no accesible desde fuera.

## Detalles técnicos
- Activar el servidor OAuth gestionado de Lovable Cloud (`supabase--configure_oauth_server`), con registro dinámico de clientes.
- SDK `@lovable.dev/mcp-js` + `mcpPlugin()` en `vite.config.ts` (endpoint `/mcp`, metadata OAuth autogenerada). Nombre `seller-strategy-studio`, título «Seller Strategy Studio».
- `src/lib/mcp/index.ts` con `auth.oauth.issuer` (issuer directo `https://<ref>.supabase.co/auth/v1`, audiencia `authenticated`, check de `client_id` activo).
- `src/lib/mcp/supabase.ts`: cliente por usuario con su token (RLS como el usuario; sin service role).
- Un archivo por herramienta en `src/lib/mcp/tools/`, que delega en el registro `src/lib/agent/tools.ts` (`executeTool`) con un `ToolCtx` construido desde el token (userId, current_org_id, rol de `org_members`). Las escrituras siguen creando `agent_pending_actions` (channel `mcp`).
- Ruta de consentimiento `src/routes/[.]lovable.oauth.consent.tsx` con estados de carga, error, ya autorizado, aprobar/denegar.
- `src/routes/auth.tsx`: aceptar `next` validado (`oauthReturnPath`) en email, registro (`emailRedirectTo`) y Google (`redirect_uri`), para volver a la pantalla de consentimiento.
- Ejecutar `app_mcp_server--extract_mcp_manifest` y pruebas de las reglas nuevas (contexto/permisos por rol, validación del `next`).
- Registrar la decisión en `AGENTS.md`.
