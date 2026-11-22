# Estado conocido y deuda documental

Hallazgos del análisis completo del repo (2026-11-06). Cada punto cita su origen. Ordenado por impacto. Nada de esto se ha corregido salvo que se indique.

## 1. Riesgos técnicos y de seguridad
| # | Hallazgo | Dónde |
| --- | --- | --- |
| 1 | Telegram, cron, Inngest y rutas públicas usan el cliente admin: no hay RLS; la seguridad es de código | `src/lib/agent`, `src/routes/api/public/` |
| 2 | `decide_approval` falla desde Telegram: el trigger `guard_approval` lee `auth.uid()` | `src/lib/AGENTS.md` |
| 3 | No hay limitador genérico por usuario ni IP (server functions, agente, MCP) | `src/lib`, `src/routes` |
| 4 | La clave de entrada de leads se acepta por `?key=` (logs e historiales) | `src/routes/api/public/leads.ts` |
| 5 | El cron real y el job `digest` no están definidos en el repo | `src/routes/api/public/jobs/proactive.ts` |
| 6 | Trabajos periódicos con topes fijos sin paginar (100 empresas, 200 en informe semanal, 2000 perfiles en email diario) | `src/lib` |
| 7 | `.env` versionado contiene variables `VITE_LOVABLE_CONNECTOR_*`; confirmar que son públicas por diseño | `.env`, `AGENTS.md` |
| 8 | La migración 0075 siembra un superadmin con un email personal escrito en el SQL; `roadmap.md` lo repite | `drizzle/migrations/0075…`, `roadmap.md` |
| 9 | `.bmad/sessions/mvp.json` contiene un error de API key inválida de Gemini (revisar que no incluya la clave) | `.bmad/` |
| 10 | No hay CI: el gate es manual | repo sin `.github/` |

## 2. Base de datos
1. Un replay de `drizzle/migrations` no reproduce la base real: 6 tablas solo en SQL comentado, 10 sin migración, `accounts.country` solo en SQL comentado, `is_finance_member` sin definición.
2. `create_organization` viva no está en el repo activo; `0056` fallaría en un replay.
3. Faltan 0059 y 0074 (están en ramas abiertas); 60 snapshots de 75; ninguno de 0058–0073.
4. `src/lib/AGENTS.md` dice que 0071 no está aplicada; la nota de 2026-11-01 dice que sí. Las cabeceras de 0068–0073 dicen «Never applied».
5. `check-migration-journal.mjs` (citado en `AGENTS.md` y en la skill `nokko-release`) no existe, ni `APLICAR-MIGRACIONES-GUIA.md` ni `PLAN-orden-migraciones.md`.
6. No se ha comprobado `drizzle.__drizzle_migrations` en la base viva.

## 3. Documentación obsoleta o contradictoria
1. **`docs/sdd/README.md`**: título «SDD 2026-10-25», dice «los diez» y omite 12 de los 25 SDD (los de 20261027 a 20261101). `EXECUTION.md` §2 termina en el SDD 9/4.
2. **Cabeceras de SDD desfasadas**: `strategic-suggestions-engine` dice «F4 en PR en borrador» pero la F4 se fusionó (PR #46); `field-write-paths-normalization` dice «Aprobado» y su cuerpo dice «Borrador»; el 7a original sigue «Borrador» aunque lo sustituye `…7a-revalidado`; `strategy-setup-guided-next-step` sigue «En curso» con `strategy-setup-closeout` aprobado; varios SDD de 2026-10-25 dicen «Para: Dani» y un commit afirma que NOKKO no tiene a Dani.
3. **BMAD «archivado» pero no archivado**: `docs/factory/README.md` y `docs/sdd/README.md` dicen que está en `docs/archivado/bmad/`, que no existe. `tickets.toml` (5 tickets `planned` = NK-0001 a NK-0005, aún `LOGGED`), `sdd.config.json`, `.bmad/`, `brainstorm-mvp/` (una sesión vacía de 2025) y `architecture-`/`spec-auditoría técnica/` siguen en la raíz.
4. **Ledger fuera de `main`**: `.factory/ledger.json` solo existe en `origin/feat/software-factory` (24 tickets: 20 LOGGED, 3 PROMOTED, 1 SHIPPED, parado en NK-0024), pero las skills lo dan por presente. Las ramas apuntan a tickets posteriores (NK-0037 a NK-0049).
5. **`roadmap.md`** se queda en 2026-10-24: no refleja el motor de sugerencias, los campos universales (0058–0067), los superadmins, hooks y `any`, ni la factory. Marca como hechos los puntos 5 y 6 del «Orden del código» mientras el SDD `no-explicit-any-cleanup` figura sin implementar. Tiene ítems abiertos sin fecha de revisión (acciones masivas, Fase 1b, 2b, 3 y 4, Telegram bot sin conectar).
6. **`AGENTS.md`**: menciona un botón flotante del agente que ya no existe; habla de «Más herramientas» pero `nav.ts` tiene 3 grupos (lista diaria, Estrategia, Ajustes).
7. **`worktree.mjs`** fija el directorio `../seller-strategy-studio-<slug>`: en un clon con otro nombre no coincide con el brief.
8. **`.lovable/plan/`**: 16 planes sin índice; `.lovable/mcp/manifest.json` debe reflejar `TITLES` y no hay test que lo vigile.
9. `package.json` conserva `"name": "tanstack_start_ts"` (plantilla de Lovable); se mantiene a propósito porque `bun.lock` lo referencia.

## 4. Interfaz
- Faltan en `public/` los iconos PWA (`icon-192.png`, `icon-512.png`, `icon-maskable-512.png`), `apple-touch-icon.png` y `favicon.ico`. **[Por verificar]** si se sirven desde otro sitio.
- `robots.txt` no bloquea 6 rutas de la app (riesgo bajo).
- `@fontsource/schibsted-grotesk` sin uso.
- Sin tests de render de pantallas de `src/routes/`.

## 5. Calidad
- Lint con miles de errores de Prettier en la base (gate valida solo archivos tocados).
- El gate lanza ESLint sobre `scripts/*.mjs` tocados; `worktree.mjs` tiene líneas largas sin formatear y probablemente fallaría (no ejecutado).
- `eslint.config.js` no ignora `drizzle/` ni `.tanstack`.
- No se han ejecutado la suite de tests, el build ni el lint durante este análisis.

## 6. Preguntas abiertas
- ¿Quién programa el cron real (`/api/public/jobs/proactive`) y con qué frecuencia? ¿Y el `digest`?
- ¿Qué migraciones anteriores a 0071 y cómo se aplicaron? ¿Qué contiene `drizzle.__drizzle_migrations`?
- ¿Se sirven los iconos PWA desde otro sitio?
- ¿Las claves `VITE_LOVABLE_CONNECTOR_*` son públicas por diseño?
- ¿Se retoma o se archiva el flujo BMAD y los tickets de auditoría técnica?
- ¿Se publica el ledger en `main` o se mantiene en la rama de la factory?


## Novedades desde 2026-11-06 (actualizado 2026-11-16)
- Resuelto: la numeración duplicada de migraciones (ya no hay prefijos repetidos) y roadmap.md desfasado (ahora es la cola viva).
- Abierto: Drive OAuth, token de Telegram, webhook de Apollo, revisión legal LinkedIn/Gmail, deshacer bloques de onboarding desde el chat.
