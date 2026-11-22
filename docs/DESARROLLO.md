# Guía de desarrollo

## 1. Requisitos
- **Bun** (el repo usa `bun.lock` de texto con `saveTextLockfile = true`). No hay `engines`, `packageManager`, `.nvmrc` ni `.node-version`.
- **Node ≥ 20.11** para los scripts de `scripts/factory/` (usan `import.meta.dirname`) y `npx`.
- Acceso al proyecto de Lovable Cloud para ver la app desplegada y aplicar migraciones.

## 2. Primeros pasos
```sh
git clone git@github.com:fefeq/seller-strategy-studio.git
cd seller-strategy-studio
bun install
bun run dev
```

`.env` ya está en el repo (valores públicos de Supabase y claves `VITE_` públicas). No necesitas crear nada para arrancar la interfaz. Las funciones de servidor que usan secretos (IA, integraciones, Telegram, Stripe…) **no funcionan en local** sin esos secretos; viven en Lovable Cloud.

## 3. Scripts
| Comando | Qué hace |
| --- | --- |
| `bun run dev` | Servidor de desarrollo (`vite dev`) |
| `bun run build` / `build:dev` | Build de producción / de desarrollo |
| `bun run preview` | Sirve el build |
| `bun run test` / `test:watch` | Vitest |
| `bun run lint` | ESLint |
| `bun run format` | Prettier |
| `npx tsc --noEmit` | Comprobación de tipos (no hay script; lo usan el gate y el CI) |

## 4. Calidad y configuración
- **TypeScript**: `strict: true`, pero desactivados `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals` y `noUnusedParameters` (el código Supabase/formularios era demasiado ruidoso). Target ES2022, módulo Bundler, alias `@/*`. `tsconfig` no incluye `scripts/` ni `drizzle/`.
- **ESLint** (flat config): `typescript-eslint` recommended, `react-hooks` con `exhaustive-deps: error`, `react-refresh/only-export-components: warn`, `no-unused-vars: off`, prohíbe importar `server-only`, Prettier como regla.
- **Prettier**: `printWidth 100`, `semi`, comillas dobles, `trailingComma all`.
- **Vitest**: entorno `jsdom`, `globals`, `setupFiles ./src/test/setup.ts`, `include: src/**/*.{test,spec}.{ts,tsx}`. 445 archivos de test (2026-11-22); 28 son de Postgres (`*.pg.test.ts`, con PGlite vía `src/test/pg-harness.ts`). `vitest.eval.config.ts` es el runner de evaluación de GTM Lab: se lanza a mano y no entra en `vitest run` ni en el gate.
- **CI** (`.github/workflows/ci.yml`): en cada push a `main` y en cada PR, con Node 22 y Bun 1.4.0: `bun install --frozen-lockfile`, `npx tsc --noEmit`, `npx vitest run` y `npx vite build`. No pasa lint a propósito (deuda de formato). **[Por verificar]** que GitHub Actions esté activado en el repositorio.
- **Pruebas protegidas**: desde la ronda UX de 2026-11-15, las pruebas existentes no se modifican sin permiso escrito de Fede; si un cambio obliga a tocar una, se documenta en el informe con el antes y el después (ver `docs/plan/INFORME-FINAL-UX-20261115.md`).
- **shadcn**: estilo `new-york`, base `slate`, iconos lucide.
- **Guarda de suministro** (`bunfig.toml`): `minimumReleaseAge = 86400`; no instala versiones publicadas hace menos de 24 h. Excepciones solo para `@lovable.dev/*` ya listadas. Confirma con la persona responsable antes de añadir otra.
- **Lint con deuda**: la base arrastra errores de Prettier; el gate valida solo los archivos que toca cada cambio.

## 5. Convenciones de código (resumen)
Lee `AGENTS.md` y `src/lib/AGENTS.md` antes de tocar esas áreas. Lo esencial:
- Comentarios y commits en inglés; textos de producto en español con «tú».
- Sin `as any`; usa los tipos generados y `jsonObject`/`actionTool` para jsonb.
- Dinero con `useCurrency()`; nunca símbolos a mano.
- Errores al usuario con `errorText()`.
- Confirmaciones con `askConfirm`/`askText`.
- Sin colores a mano: usa tokens y clases semánticas.
- Datos desde el navegador con RLS; la IA solo en server functions.
- Una herramienta del agente reutiliza la lógica pura de la pantalla.
- Un parche de formato (Prettier) va en un commit aparte, sin cambios de comportamiento.

## 6. Flujo de cambios
Hay dos vías de construcción, con seguimientos distintos (ver [`decisiones-fede-20261113.md`](decisiones-fede-20261113.md)):
- **Lovable** (desde el 2026-11-13): commits directos a `main`, se autoverifica y deja informe; lo pendiente va en `roadmap.md` y `.lovable/plan/`.
- **Claude Code con la factory**: rama y PR, gate y ledger (`.factory/ledger.json`). Pasos:

1. Si toca código, datos o infraestructura: escribe o localiza el **SDD** ([PROCESO.md](PROCESO.md)). Ningún SDD se construye sin OK escrito de Fede.
2. Rama `feat/<slug>` desde `main`. PR en borrador.
3. Test que falla primero, luego el cambio.
4. Pasa el gate (`scripts/factory/gate.mjs`) antes de pedir entrega.
5. **No hagas push ni merge a `main` sin orden expresa.** No uses `reset --hard` ni force push.

> El repo está conectado a Lovable. Lo que llega a la rama conectada vuelve al editor de Lovable, así que mantenla en estado funcional y **no reescribas historial ya publicado** (force push, rebase, amend o squash de commits subidos).

## 7. Migraciones
- Archivos nuevos en `drizzle/migrations`, con GRANTs y RLS por empresa (`org_id` con valor por defecto `current_org()`). No cambies migraciones ya aplicadas ni toques datos reales.
- Pruébalas en local con PGlite (`*.pg.test.ts`).
- Las aplica una persona o el agente de Lovable contra la base de Lovable Cloud (no hay script). Consulta `docs/sdd/annex/apply-migrations-checklist-20261027.md`.
- Después de aplicar, regenera los tipos (`src/integrations/supabase/types.ts` es generado) y revisa los tests de cobertura de campos (`field-coverage.test`, `tracked-columns.test`), que fallan si el catálogo se desincroniza.
- Detalle y cautelas: [BASE-DE-DATOS.md](BASE-DE-DATOS.md#6-cómo-se-aplican-las-migraciones-y-qué-es-incoherente).

## 8. Despliegue
- Plataforma: Lovable Cloud (`nokko.ai`). Publicar es siempre decisión de Fede. El build usa `@lovable.dev/vite-tanstack-config` (nitro, target Cloudflare por defecto en build); `vite.config.ts` indica no duplicar plugins ya incluidos.
- No hay `wrangler.toml` ni `vercel.json`. No hay rama `production` ni `staging`; `main` es la única de integración. La preproducción y la publicación las hace una persona.
- Publicar es necesario para que el segundo plano y el email diario de `nokko.ai` usen el código nuevo.
- Historial (2026-11-22): 1495 de los 2622 commits de `main` son de `gpt-engineer-app[bot]` (Lovable); el resto, de las personas y de Claude.

## 9. Resolución de problemas
- **La interfaz carga pero las acciones de IA fallan en local**: faltan secretos de servidor; es esperado.
- **`bun install` rechaza un paquete recién publicado**: es la guarda de 24 h.
- **Un test de cobertura de campos falla tras una migración**: actualiza `src/lib/field-catalog.ts`.
- **El manifest MCP no refleja una herramienta**: regenéralo (ver [AGENTE-Y-MCP.md](AGENTE-Y-MCP.md)).
- **`routeTree.gen.ts`**: autogenerado; no lo edites.
