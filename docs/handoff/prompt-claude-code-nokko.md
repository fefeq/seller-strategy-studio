# Prompt para Claude Code — cerrar el lanzamiento de NOKKO

Pega esto tal cual en Claude Code, abierto en el repo `fefeq/seller-strategy-studio`.

**Dónde están los archivos:** en el proyecto de Claude «Nokko GTM Brain», carpeta `nokko-handoff/` (los 15 parches, `LEEME.md` y `AUDITORIA-2.md` dentro de `nokko-handoff/patches/`, y `nokko-plan-claude-code-v2.md`). Si la sesión tiene la herramienta de Proyectos, léelos con `project_read`; si no, Fede te adjuntará `nokko-patches-olas-1-3.zip`. Cada parche es un `.patch` de texto: guárdalo en disco antes de `git am`.

---

Eres el ingeniero que cierra el lanzamiento de NOKKO. Trabaja en español con «tú» en textos de interfaz y mensajes para Fede; el código, los identificadores y los commits, en inglés. Fede es fundador no técnico: empieza cada informe por la conclusión y di qué falta.

## Contexto
- NOKKO es una app React/TanStack en Lovable Cloud (Supabase + RLS, multi-tenant por `org_id`), con funciones de servidor, Inngest, un servidor MCP en `/mcp` y un webhook de Telegram que usa el cliente privilegiado (se salta RLS: toda consulta debe filtrar por `org_id`).
- Es un producto aparte de Postin. No mezcles repos, datos ni proyectos de Supabase. Dani no interviene.
- Ya hay trabajo hecho en `patches/` (lee `LEEME.md` y `AUDITORIA-2.md`): 15 parches sobre `main` d0e4821 con su orden de aplicación. Ya tienen una auditoría independiente.

## Reglas
1. Un PR pequeño por pieza. Descripción del PR con: qué cambia, por qué (ID de la auditoría), cómo se probó y riesgos.
2. No reescribas historia publicada. No metas secretos en `.env` ni en variables `VITE_`.
3. Pruebas: `npx vitest run` y `npx tsc --noEmit` en cada PR. Para SQL usa PGlite (`src/test/pg-harness.ts`); no crees proyectos de Supabase para probar.
4. Las migraciones (0064 de F5, 0065 de F1a) se prueban primero en una rama o copia de la base de datos de NOKKO. Nunca las apliques a producción sin que Fede lo confirme.
5. Prohibido inventar métricas, precios, testimonios o cifras. Si falta un dato o dos fuentes se contradicen, pregunta a Fede y sigue con lo demás.
6. Nada se publica (web, email, LinkedIn) sin aprobación humana explícita.
7. Tras los PR de ola 1 y migraciones, pide una auditoría independiente (otro agente sin tus conclusiones) antes de que Fede haga merge.
8. Si una incoherencia no se reproduce, dilo en el PR de cierre; no inventes el arreglo.

## Paso 1 — Aplicar los parches, en este orden y en PRs separados
    git checkout -b fix/f6-create-lead-events main        && git am 01-f6-create-lead-events.patch
    git checkout -b fix/f4-business-day-sla main          && git am 02-f4-business-day-sla.patch
    git checkout -b fix/f2-anti-icp-phrase-match main     && git am 03-f2-anti-icp-clause.patch
    git checkout -b fix/f2b-fit-evidence-floor fix/f2-anti-icp-phrase-match && git am 08-f2b-fit-evidence-floor.patch
    git checkout -b fix/f1b-spend-guard main              && git am 04-f1b-spend-guard.patch
    git checkout -b fix/f1a-default-spend-caps fix/f1b-spend-guard && git am 05-f1a-default-caps.patch
    git checkout -b fix/f5-telegram-decide-approval main  && git am 06-f5-telegram-approvals.patch
    git checkout -b fix/f3-setup-data-quality main        && git am 07-f3-setup-data-quality.patch
    git checkout -b fix/f7-sales-navigator-import main    && git am 09-f7-sales-navigator-import.patch
    git checkout -b fix/f8-opps-created main              && git am 10-f8-11-opps-created.patch
    git checkout -b feat/f8-number-format-acv main        && git am 11-f8-number-format-acv-ranges.patch
    git checkout -b feat/w2-broad-icp-warning main        && git am 12-w2-5-broad-icp-warning.patch
    git checkout -b feat/w3a-read-tools main              && git am 13-w3a-read-lookup-tools.patch
    git checkout -b feat/w3b-product-stripe-tools feat/w3a-read-tools && git am 14-w3b-product-stripe-write-tools.patch
    git checkout -b test/w3c-integration-isolation main   && git am 15-w3c-integration-tools-isolation-test.patch

Si `git am` choca en `drizzle/migrations/meta/_journal.json`, conserva las dos entradas (0064 idx 62, 0065 idx 63). Si choca `.lovable/mcp/manifest.json`, regenéralo con `node node_modules/@lovable.dev/mcp-js/dist/cli/extract-manifest.cjs .` y deja `sdk_version` como en `main`. En cada rama corre tests y `tsc`, abre el PR y para antes de hacer merge.

Cuando tengas acceso a una base de datos de pruebas de NOKKO (no de Postin), verifica F5 (aprobar desde Telegram) y F1a (migración 0065) contra Supabase real, porque en los tests solo se probaron con PGlite.

## Paso 2 — Seguimientos técnicos que ya están identificados
Un PR cada uno, con tests:
1. F4: hueco en la deduplicación de avisos agrupados; aviso o migración para los plazos (SLA) guardados por empresa que siguen en días naturales; `followup.ts` aún usa días naturales.
2. Topes de gasto: el día se calcula en UTC; debe ser el día de Europe/Madrid.
3. Gasto de herramientas de escritura (revelar contactos, informes) sin registrar en `integration_usage`: regístralo y pásalo por el mismo control de tope.
4. F5: menores anotados en la auditoría 1.
5. `numbersIn("0.500")` lee 500; y migra a `formatNumber` los `toLocaleString("es-ES")` que queden.
6. F3: con cuentas incompletas el asistente sigue mostrando «añadir cuenta»; guía a completar las existentes.
7. Ampliar el test de aislamiento a `research_stakeholder`, `get_product_usage`, `prepare_meeting_brief` y `draft_*`; que la cobertura se calcule por la lista de herramientas y no por prefijo.
8. `list_trials` devuelve emails a cualquier rol: pregunta a Fede si se limita a líderes.

## Paso 3 — Incoherencias de la cuenta (F8). Reprodúcelas antes de tocar nada
Con la cuenta real de pruebas abierta (usa Claude in Chrome o el MCP de NOKKO), para cada una anota «reproducido / no reproducido» y la causa:
- F8-1 contadores «Avisos» (topbar), «Sugerencias pendientes» (sidebar) y API. Hallazgo previo: cuentan cosas distintas; propón a Fede unificar o renombrar, no cambies sin su OK.
- F8-2 dos versiones del informe semanal; F8-4 cuota distinta entre pantallas; F8-6 plantilla de ticket bajo (doc `benchmarks-ticket-bajo.md` del proyecto «Nokko GTM Brain»); F8-9 borradores superados del ciclo (archivar, nunca borrar); F8-10 texto de posicionamiento sin normalizar.
- F8-3 «preguntas abiertas de la IA» dentro de Sugerencias: es decisión de producto, propón 2 opciones con mockup y espera.
- F8-7 actividad sin toques: necesita la definición de «toque» de Fede (pregúntala).

## Paso 4 — Ola 2 (lo que necesita decisión o dato de Fede: pregunta primero)
Haz una sola ronda de preguntas a Fede con estas decisiones y trabaja mientras tanto en lo demás:
- W2-4 landing y `/precios`: pídele los precios reales y qué plan va en cada fila. No los inventes.
- W2-9 métrica de activación: pídele la definición exacta de «cliente activado».
- W2-2 datos de demo (etiquetados como demo y borrables), W2-3 copy de Inicio orientado a fundador, W2-8 estados vacíos neutros, W2-6 asistente guiado para conectar Stripe y PostHog: propón textos y diseño en una página de revisión (preview) para que Fede apruebe antes de implementar.
- W2-7 panel de gasto: ya hecho en parte con F1a; completa lo que falte (gasto del día, tope, pausa).

## Paso 5 — Ola 3
- Telegram: acuse inmediato y trabajo en segundo plano con Inngest. Escribe antes un SDD corto y espera el OK de Fede.
- `invite_member` / `set_member_role` por chat: no los implementes salvo que Fede decida lo contrario (recomendación: solo en pantalla; `get_link` ya lleva a Equipo). Si se aprueban, solo Owner, con confirmación y test de aislamiento.
- WhatsApp: solo especificación (SDD), sin implementar.
- Cada herramienta nueva del chat: lectura o escritura con confirmación (`agent_pending_actions`), filtro por `org_id`, rol permitido, título en `TITLES` y manifest regenerado, y test de aislamiento.

## Paso 6 — Decisiones de Fede que bloquean cosas (pregúntalas una vez y regístralas en el PR)
- D1: Apollo/Clay compartidos entre empresas. Recomendación: cuenta compartida solo durante la beta, con tope de gasto.
- D2: Apify/scraping de LinkedIn. Recomendación: apagado por defecto.
- D3: un solo Google Drive compartido o uno por empresa.

## Entrega final
Un informe corto a Fede con: tabla de PRs (rama, enlace, estado de tests, riesgo), qué se reprodujo y qué no, qué decisiones esperas de él y qué queda fuera. Cierra con la lista de comprobación del plan (`nokko-plan-claude-code-v2.md`) marcada. Pide la auditoría independiente antes de que Fede haga merge.
