# Proceso de trabajo: SDD y software factory

Cómo se convierte una idea, mejora o bug en un cambio verificado. Fuentes: `docs/factory/README.md`, `docs/factory/GROUND-RULES.md`, `docs/sdd/EXECUTION.md` y las skills de `.claude/skills/nokko-*`.

## 1. Principio
Toda idea, mejora, feature o bug que toque código, datos o infraestructura parte de un **SDD** (spec) aprobado. Las personas aparecen dos veces: **GO** para empezar y **aprobación** para entregar.

## 2. La línea de la factory

| # | Estación | Skill / agente | Script o artefacto |
| --- | --- | --- | --- |
| 1 | Intake y ledger | `nokko-intake`, agente `nokko-tracker` | `scripts/factory/ledger.mjs log\|promote\|ship\|verify\|doc\|link\|show\|list` |
| 1b | PRD y SDD | `nokko-shape` | `docs/factory/templates/prd.md`, `sdd.md` (18 secciones) |
| 2 | Brief | `nokko-brief` | `.factory/briefs/<ticket>.md` |
| 3 | Fan-out | `nokko-fanout` | `worktree.mjs`; rama `feat/<slug>`; un worktree por sesión |
| 4 | Build contra test que falla | `nokko-build`, agente `nokko-author` | `fail-first.mjs`; `.factory/evidence/<ticket>/result.md` |
| 5 | Review e integración | `nokko-review`, agente `nokko-reviewer` | rama `integration/<fecha>`, un `merge --no-ff` por trabajo |
| 6 | Gate independiente | `nokko-gate` (agente sin Edit/Write), `nokko-walkthrough` | `gate.mjs`, `flake.mjs --runs 3` |
| 6b | Release | `nokko-release` | **No despliega**: prepara y verifica; `ledger.mjs ship --sha --approved-by` |
| 7 | Vigilancia | `nokko-watch` | `ledger.mjs verify --by watch --note` (solo lectura, sin programar) |

### Estados del ticket
`LOGGED → PROMOTED → SHIPPED → VERIFIED`, con IDs `NK-0001`, `NK-0002`… El ledger es `.factory/ledger.json`; solo `nokko-tracker` lo escribe. La evidencia está en `.factory/evidence/` (en `.gitignore`).

### Guardas del ledger
- `promote` exige `--go` y `--owner`; rechaza duplicados (similitud Jaccard ≥ 0.6) y tickets que no estén en `LOGGED`.
- Una `feature` sin SDD no se promueve; el SDD o PRD enlazado debe estar `Aprobado`, `En curso` o `Hecho`.
- `ship` exige `evidence/<NK>/gate-<sha12>.json` con veredicto PASS y `--approved-by`.
- `verify` exige `--note`.

### Gate (`scripts/factory/gate.mjs`)
En orden: árbol limpio sobre el commit exacto → canario (el runner detecta fallos) → guards del diff (solo líneas añadidas: sin `as any`, `window.confirm/prompt`, secretos, `VITE_*SECRET/SERVICE/PRIVATE/TOKEN`, `.only/.skip`, `toast(error.message)`; `.env` intacto; aserciones no debilitadas; sin timeouts de 4 dígitos en tests) → `npx tsc --noEmit` → ESLint solo sobre los archivos tocados → `npx vite build` con proxy muerto (red bloqueada en mejor esfuerzo) → suite completa de Vitest con `.factory/known-failures.json` → cada test tocado entero → segunda máquina («NOT RUN») → soak («NOT A SOAK», solo tamaño del artefacto). `flake.mjs` clasifica un fallo como FLAKE, REGRESSION o PASSES_ON_TIP.

## 3. Reglas base (`GROUND-RULES.md`)
1. Verifica antes de afirmar. 2. Declara supuestos y haz el cambio mínimo. 3. Retráctate al instante. 4. El autor no califica su propio trabajo. 5. Un test cuenta solo si falla antes sobre la base. 6. El gate se adapta, nunca se afloja. 7. Cada cifra apunta a evidencia y cada informe lista lo que no demuestra. 8. Paralelo, nunca compartido: un worktree, una rama y un contexto por sesión. 9. Las personas deciden dirección.

Reglas propias de NOKKO: nunca push o merge a `main`/`production` ni desplegar sin orden expresa; nunca `reset --hard` ni force push; sin datos de clientes; sin cifras inventadas; sin secretos en `.env` ni `VITE_`; textos de producto en español con «tú»; código y commits en inglés.

De `docs/sdd/EXECUTION.md`: una rama `feat/<slug-del-sdd>` por SDD; PR en borrador con tabla criterio de aceptación → prueba; la sección 17 del SDD la rellena `nokko-gate`; solo se ejecutan los SDD que el usuario nombre; ante cualquier `[Por verificar]` que no puedas comprobar, parar y preguntar.

## 4. Modelos por tipo de tarea
| Tarea | Modelo | Agente |
| --- | --- | --- |
| Coordinación, review y decisiones de release | El más fuerte, esfuerzo alto | `nokko-reviewer` |
| Arquitectura, RLS, seguridad, concurrencia | El más fuerte | `nokko-author` con opus |
| Gate y análisis de fallos | Razonamiento fuerte | `nokko-gate` |
| UI, arreglos acotados, tests | Modelo de código fuerte | `nokko-author` (sonnet) |
| Cambios mecánicos, docs, resúmenes de logs | Barato | `nokko-author` con haiku |
| Triage y ledger | Rápido | `nokko-tracker` (haiku) |

## 5. Brechas declaradas
Build con red bloqueada solo en mejor esfuerzo · sin segunda máquina · sin soak real · sin staging, promote ni rollback automáticos (los hace una persona) · sin Playwright ni emulación móvil · sin bus de mensajes · lint con deuda de prettier en la base (el gate valida solo lo que toca cada cambio) · release «Parcial».

## 6. SDD y PRD

`docs/sdd/` contiene 25 SDD (más `README.md`, `EXECUTION.md`, `AUDIT-20261025.md` y `rollback-strategic-suggestions.sql`), `docs/sdd/annex/` 6 anexos y `docs/prd/` 1 PRD (`PRD-20261028-ux-onboarding-coherencia`, Aprobado el 2026-10-28). El estado de cada SDD está en su cabecera, que es la fuente de verdad. Estados a la fecha de este análisis: 10 Aprobado, 7 Borrador, 5 En curso, 2 Aplazado y 1 Aceptado con cambios.

| SDD | Qué resuelve |
| --- | --- |
| `20261025-universal-field-definitions` | Catálogo único de conceptos de campo y origen/confirmación de cada valor (base; migración 0058) |
| `20261025-field-actions-edit-delete-confirm` | Editar, borrar y confirmar valores de campos |
| `20261025-strategy-setup-guided-next-step` | «Configura tu estrategia» con siguiente paso y aviso por inactividad (1 día) |
| `20261025-onboarding-flow-end-to-end` | Onboarding completo y proactivo |
| `20261025-drive-per-company-account` | Google Drive por empresa |
| `20261025-discoveries-scoped-manual-search` | Descubiertos con alcance y búsqueda manual acotada |
| `20261025-fit-data-7a`, `7b`, `7c` | Llave mínima de enriquecimiento · competidores como entidad · identidad de persona y resultados de terceros |
| `20261025-products-in-onboarding-autofill` | Productos en el onboarding, autocompletados desde la web |
| `20261025-theory-u-proactive-decision-support` | Theory U con IA proactiva |
| `20261025-connections-bring-your-own-account` | Conexiones con cuentas propias por empresa |
| `20261027-strategic-suggestions-engine` | Motor maestro de sugerencias estratégicas (fases F0–F7) |
| `20261027-segment-motion-aarrr-diagnosis` | Motion por segmento y diagnóstico AARRR |
| `20261028-field-write-paths-normalization` | Bug: tamaño y país se guardan sin la regla única en Clay, Apollo, IA web y Parallel |
| `20261028-field-sources-on-tracked-writers` | Los escritores rastreados envían su origen antes de aplicar la migración 0058 |
| `20261028-hooks-lint-hygiene` | Cero avisos de reglas de hooks |
| `20261028-no-explicit-any-cleanup` | Cero `any` explícitos |
| `20261031-board-accept-opens-execute-form` | Bug: «Aceptar» en el tablero no crea el experimento ni la tarea |
| `20261031-suggestion-accept-needs-form-outside-ui` | Bug: aceptar fuera de la app (Telegram, agente, MCP) no crea nada |
| `20261101-fit-data-7a-llave-minima-revalidado` | Llave mínima validada en un solo sitio |
| `20261101-strategy-setup-closeout` | Cierre de «Configura tu estrategia» |
| `20261101-price-suggestions-visibility-server` | Sugerencias de precio vistas por Telegram, decididas sin rol y con memoria visible |
| `20261101-price-suggestions-rls` | RLS de sugerencias de precio (migración 0074, aplazada) |
| `20261101-company-linkedin-reread-with-user-client` | Relee `companyLinkedin` con el cliente de la persona antes de escribir con el admin |

Anexos (`docs/sdd/annex/`): inventario de campos, propuesta de catálogo de conceptos, matriz de acciones de campo, verificación de la migración 0058, checklist de aplicación de migraciones y migraciones pendientes en Lovable.

**Principio de uso de LLM en todos los SDD**: regla determinista → dato derivado o caché → modelo barato (`effort:"low"`) → modelo caro solo en «A fondo». Cada SDD declara sus llamadas.

## 7. Decisiones registradas (2026-10-25)
Aviso por inactividad: 1 día · Drive: conexión por empresa desde Conexiones · el reloj semanal de Descubiertos queda intacto · los competidores hallados piden OK · clave mínima de enriquecimiento validada · plazo de deshacer: 24 h · alta manual de competidores en Onboarding, Estrategia y Agente · cuenta propia sin crédito usa la de NOKKO · proveedores con cuenta propia: Apollo, Clay, Parallel, Perplexity, Firecrawl (extensible).

## 8. Herramientas del repo
- `.claude/agents/`: `nokko-author`, `nokko-gate`, `nokko-reviewer`, `nokko-tracker`.
- `.claude/skills/`: `nokko-brief`, `nokko-build`, `nokko-factory` (entrada), `nokko-fanout`, `nokko-gate`, `nokko-intake`, `nokko-release`, `nokko-review`, `nokko-shape`, `nokko-walkthrough`, `nokko-watch`.
- `.bmad/`, `tickets.toml`, `sdd.config.json`, `brainstorm-mvp/` y las carpetas `*-auditoría técnica/`: restos del flujo BMAD anterior (ver [ESTADO-Y-DEUDA.md](ESTADO-Y-DEUDA.md)).
- `.lovable/plan/`: 16 planes de Lovable (2026-10-19 a 2026-10-24), sin referencia desde ningún índice.
