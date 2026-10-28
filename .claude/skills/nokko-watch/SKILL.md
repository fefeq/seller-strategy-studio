---
name: nokko-watch
description: Estación 7 de la factory NOKKO. Vigilancia de producción en solo lectura, programada. Mide primero, no cambia nada hasta saber por qué, y convierte hallazgos en tickets con test fail-first. Úsala tras una entrega o en una revisión periódica.
---

# Vigilancia de producción

**Solo lectura.** Medir antes de tocar: nada de reinicios a ciegas, nada de cambios.

## Cada pasada
1. Salud y errores: logs de runtime y errores de Vercel/Cloudflare si están conectados; en Supabase `get_advisors` (seguridad y rendimiento) y `query_logs`.
2. Trabajo pendiente: `node scripts/factory/ledger.mjs list --state PROMOTED` y `--state SHIPPED`.
3. Sesiones paradas: `mcp__ccd_session_mgmt__list_sessions`.
4. Para cada ticket `SHIPPED` con evidencia suficiente en producción:
   ```bash
   node scripts/factory/ledger.mjs verify NK-xxxx --by watch --note "<qué mediste y dónde>"
   ```
5. Cada anomalía: `nokko-intake` con un ticket nuevo (`--kind alert`) y, tras el GO de Fede, un test fail-first que la reproduzca.

## Reglas
- Cada cifra con su origen. Si una herramienta no está conectada, dilo: «sin dato».
- Ninguna métrica de negocio estimada.
- Programar la pasada con `/schedule` o `/loop` solo si Fede lo pide.
