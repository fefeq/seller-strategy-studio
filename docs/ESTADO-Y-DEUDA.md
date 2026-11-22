# Estado conocido y deuda documental

Hallazgos del análisis completo del repo (2026-11-06), revisados contra `main` el 2026-11-22. Cada punto cita su origen. Ordenado por impacto. Lo resuelto desde entonces está en la sección 8; el resto sigue abierto salvo que se indique.

## 1. Bloqueado por algo externo al código
| # | Qué | Qué falta | Quién |
| --- | --- | --- | --- |
| 1 | Drive por empresa (0105, `drive-company.ts`) | Crear el cliente OAuth de Google y enrutar las lecturas de Drive a la cuenta de la empresa | Fede |
| 2 | Telegram operativo | Conectar el token del bot y registrar el webhook (o decidir que no se usa). El código se desactiva solo | Fede |
| 3 | Webhook de Apollo sin secreto en la URL | Apollo no admite cabeceras propias; el endpoint ya acepta `X-Webhook-Secret`, pero Apollo sigue usando `?secret=` | Externo (Apollo) |
| 4 | Respuestas de Gmail para otros buzones | Revisión legal; hasta entonces solo el buzón de Fede y solo superadmin | Fede |
| 5 | LinkedIn por robots (Apify) | Revisión legal; hoy activo con aviso y pausa reservada al superadmin | Fede |

Fuente: `docs/plan/INFORME-FINAL-UX-20261115.md` §5 y §6, y `decisiones-fede-20261113.md`.

## 2. Riesgos técnicos y de seguridad
| # | Hallazgo | Dónde |
| --- | --- | --- |
| 1 | Telegram, cron, Inngest y rutas públicas usan el cliente admin (26 archivos fuera de tests): no hay RLS; la seguridad es de código | `src/lib/agent`, `src/routes/api/public/` |
| 2 | `decide_approval` falla desde Telegram: el trigger `guard_approval` lee `auth.uid()` | `src/lib/AGENTS.md` |
| 3 | `undo_field_edit` es `SECURITY DEFINER` y ejecuta SQL dinámico (`format` con `%I` sobre el nombre de tabla guardado en el log). Pendiente de revisión de seguridad | `drizzle/migrations/0060`, `0063`, `0066` |
| 4 | No hay limitador genérico por usuario ni IP (server functions, agente, MCP) | `src/lib`, `src/routes` |
| 5 | La clave de entrada de leads se acepta por `?key=` (logs e historiales) | `src/routes/api/public/leads.ts` |
| 6 | El cron real y el job `digest` no están definidos en el repo | `src/routes/api/public/jobs/proactive.ts` |
| 7 | Trabajos periódicos con topes fijos sin paginar (100 empresas, 200 en informe semanal, 2000 perfiles en email diario) | `src/lib` |
| 8 | `.env` versionado contiene variables `VITE_LOVABLE_CONNECTOR_*`; confirmar que son públicas por diseño | `.env`, `AGENTS.md` |
| 9 | Datos personales en archivos versionados: la migración 0075 siembra un superadmin con un email personal; `roadmap.md` repite ese email y nombra un buzón de empresa | `drizzle/migrations/0075…`, `roadmap.md` |
| 10 | `.bmad/sessions/mvp.json` contiene un error de API key inválida de Gemini (revisar que no incluya la clave) | `.bmad/` |
| 11 | Las 10 tablas versionadas en 0080 no fijan GRANT: heredan todos los privilegios por defecto (con RLS y sin políticas para `anon`). Recortarlos es decisión pendiente | `drizzle/migrations/0080…` |

## 3. Base de datos
1. Un replay de `drizzle/migrations` puede no reproducir la base real: siguen 6 tablas solo en SQL comentado y `accounts.country` solo en una migración comentada. **[Por verificar]** que un replay completo llegue hoy a 0108.
2. `create_organization` viva no está en el repo activo; `0056` fallaría en un replay.
3. Falta el número 0059. Hay 80 snapshots para 108 migraciones (sin snapshot: 0058–0074, 0077–0084, 0089, 0098, 0107, 0108). `0099_migration.sql` tiene un nombre genérico.
4. `src/lib/AGENTS.md` dice que 0071 no está aplicada; la nota de 2026-11-01 dice que sí. Las cabeceras de 0068–0073 dicen «Never applied».
5. `check-migration-journal.mjs` (citado en `src/lib/AGENTS.md` y en la skill `nokko-release`) no está en el repo; tampoco `APLICAR-MIGRACIONES-GUIA.md` ni `PLAN-orden-migraciones.md`. Existen en la carpeta de trabajo local, fuera del repo. La regla del journal sí está en `src/lib/migrations-journal.ts` con test.
6. No se ha comprobado `drizzle.__drizzle_migrations` en la base viva.

## 4. Documentación obsoleta o contradictoria
1. **Dos vías de construcción con seguimientos distintos**: desde el 2026-11-13 Lovable construye con commits directos a `main` y lo anota en `roadmap.md` y `.lovable/plan/`; Claude usa la factory y el ledger (`.factory/ledger.json`, 188 tickets a 2026-11-22). [`PROCESO.md`](PROCESO.md) solo describe la factory. Cruza ambos antes de dar algo por pendiente.
2. **`docs/sdd/README.md`**: título «SDD 2026-10-25» e índice de 13 SDD de los 96 que hay. `EXECUTION.md` §2 termina en el SDD 9/4.
3. **Cabeceras de SDD desfasadas** (a 2026-11-06): `strategic-suggestions-engine` dice «F4 en PR en borrador» pero la F4 se fusionó (PR #46); `field-write-paths-normalization` dice «Aprobado» y su cuerpo dice «Borrador»; el 7a original sigue «Borrador» aunque lo sustituye `…7a-revalidado`; `strategy-setup-guided-next-step` sigue «En curso» con `strategy-setup-closeout` aprobado; varios SDD de 2026-10-25 dicen «Para: Dani» y NOKKO no tiene a Dani.
4. **BMAD «archivado» pero no archivado**: `docs/factory/README.md` y `docs/sdd/README.md` dicen que está en `docs/archivado/bmad/`, que no existe. `tickets.toml`, `sdd.config.json`, `.bmad/`, `brainstorm-mvp/` y `architecture-`/`spec-auditoría técnica/` siguen en la raíz.
5. **`docs/factory/README.md`** dice que el ledger vive en el checkout principal; en la práctica se trabaja en un worktree limpio desde `origin/main` con `FACTORY_DIR`.
6. **Menú**: «Configuración» sigue en Diseñar aunque `/setup` redirige a `/onboarding/completar`, y Conocimiento sigue enlazando Reglas y voz, que redirigen a Estrategia. Quitarlo exige tocar pruebas protegidas (`nav-wave-one.test.ts` y la de Conocimiento).
7. **`worktree.mjs`** fija el directorio `../seller-strategy-studio-<slug>`: en un clon con otro nombre no coincide con el brief.
8. **`.lovable/plan/`**: 28 planes sin índice. **`.lovable/mcp/manifest.json`**: ningún test vigila su sincronía completa con `TOOLS` y `TITLES` (hoy coinciden: 138 + 5).
9. `package.json` conserva `"name": "tanstack_start_ts"` (plantilla de Lovable); se mantiene a propósito porque `bun.lock` lo referencia.
10. El cuerpo de los documentos de `docs/` se escribió el 2026-11-06; las cifras se recontaron el 2026-11-22, pero las descripciones de pantallas y conexiones pueden haberse quedado cortas tras la ronda UX. Lo no comprobado va marcado **[Por verificar]**.

## 5. Interfaz
- Faltan en `public/` los iconos PWA (`icon-192.png`, `icon-512.png`, `icon-maskable-512.png`), `apple-touch-icon.png` y `favicon.ico`. **[Por verificar]** si se sirven desde otro sitio.
- `robots.txt` no bloquea varias rutas de la app (riesgo bajo).
- `@fontsource/schibsted-grotesk` sin uso.
- La mayoría de pantallas sigue sin test de render propio.

## 6. Calidad
- Lint con miles de errores de Prettier en la base (el gate valida solo archivos tocados; el CI no pasa lint).
- El gate lanza ESLint sobre `scripts/*.mjs` tocados; `worktree.mjs` tiene líneas largas sin formatear y probablemente fallaría (no ejecutado).
- `eslint.config.js` no ignora `drizzle/` ni `.tanstack`.
- **[Por verificar]** que GitHub Actions esté activado en el repositorio (estuvo desactivado el 2026-11-15).

## 7. Preguntas abiertas
- ¿Quién programa el cron real (`/api/public/jobs/proactive`) y con qué frecuencia? ¿Y el `digest`?
- ¿Qué contiene `drizzle.__drizzle_migrations` en la base viva?
- ¿Se sirven los iconos PWA desde otro sitio?
- ¿Las claves `VITE_LOVABLE_CONNECTOR_*` son públicas por diseño?
- ¿Se archiva de verdad el flujo BMAD (`tickets.toml`, `.bmad/`, `sdd.config.json`) y los tickets de auditoría técnica?
- ¿Se recortan los GRANT de las tablas versionadas en 0080?
- Piloto automático: ¿acciones pendientes o autorización permanente por empresa? (hoy: umbral por acción, 0 por defecto).
- ¿Se puede deshacer un bloque de onboarding desde el chat?

## 8. Resuelto desde el 2026-11-06
- **CI**: existe `.github/workflows/ci.yml` (tipos, tests y build en cada push a `main` y PR).
- **Ledger en `main`**: `.factory/ledger.json` está en `main` (188 tickets: 126 SHIPPED, 55 LOGGED, 6 REJECTED, 1 PROMOTED).
- **`roadmap.md`** ya no está parado en 2026-10-24: es la cola viva de Lovable.
- **Tablas sin migración e `is_finance_member`**: versionadas en 0080.
- **Numeración de migraciones**: 0074 está en `main` y ya no hay prefijos repetidos; solo falta 0059.
- **`AGENTS.md`** ya no menciona el botón flotante ni «Más herramientas»; la navegación tiene cinco grupos.
