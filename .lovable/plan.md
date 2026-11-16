# Actualizar README, documentación y configuración

## Objetivo
Que el README y `docs/` describan NOKKO tal como está hoy (16-11-2026), sin cambiar comportamiento de la app.

## Qué se actualiza
1. **README.md**: cifras reales (herramientas del agente/MCP: hoy 139, no 112), menú en cinco secciones (Hoy, Diseñar, Ejecutar, Medir y aprender, Ajustes), Conexiones con estado real, niveles del agente (Guiado/Copiloto/Autopilot), umbral del piloto automático, dictado/lectura en voz, Respuestas (Gmail solo superadmin), Drive por empresa (pendiente de credenciales), Telegram preparado sin token.
2. **docs/README.md**: fecha, mapa de carpetas real (plan/, ux-audit/, verificacion-*, informes de olas, lovable-run-report), número de SDD actual, y estado de `roadmap.md` (ya no «parado en 2026-10-24»).
3. **Documentos de área** (ARQUITECTURA, BASE-DE-DATOS, AGENTE-Y-MCP, INTEGRACIONES-Y-SEGUNDO-PLANO, PANTALLAS, DESARROLLO, ESTADO-Y-DEUDA): añadir lo entregado desde el 06-11 (migraciones hasta la última, nuevas herramientas, rutas `/onboarding/completar`, `/reset-password`, Conexiones, bandeja en Hoy) y mover a «deuda» lo bloqueado (Drive OAuth, Telegram, webhook Apollo, revisión legal LinkedIn/Gmail, duplicado de numeración de migraciones).
4. **Configuración** (solo si está desfasada y sin efecto en el build): metadatos de `package.json` (nombre/descripción), `sdd.config.json` (`updated_at`), comentarios de `drizzle.config.ts`/`vitest*.config.ts`. Las cifras se sacan del código, no se inventan; lo no comprobado se marca **[Por verificar]**.

## Qué NO se toca
- Nada de `.claude/` (agentes y skills de Claude), `tickets.toml`, `roadmap.md` (tareas abiertas), `.lovable/mcp/manifest.json`, migraciones ni su journal, pruebas, código de `src/`.
- `AGENTS.md` y `src/lib/AGENTS.md`: solo lectura (reglas de usuario/skills y límite de tamaño).
- Archivos generados (`.env`, `supabase/config.toml`, `types.ts`, `routeTree.gen.ts`, `bun.lock`), `tsconfig.json`, `vite.config.ts`, `eslint.config.js`: sin cambios de opciones.
- Sin dependencias nuevas, sin publicar.

## Verificación
- Ningún archivo de `src/`, pruebas ni configuración funcional cambia (diff limitado a `.md` y metadatos).
- Build sigue en «build OK»; enlaces internos de los `.md` comprobados con un script de solo lectura.

## Pregunta abierta
«Lo abierto desde Claude» se interpreta como `.claude/`, `tickets.toml`, `roadmap.md` y los informes/SDD en curso: se enlazan, no se editan. Si te referías a otra cosa (una rama o archivos concretos), dímelo.
