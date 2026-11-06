# SDD 2026-10-25 · UX de estrategia, onboarding y coherencia de campos

Estado: el de cada SDD está en su cabecera (este índice no lo repite, para no quedarse desactualizado). Rama original: `sdd/ux-onboarding-coherencia-20261025`.
PRD de la iniciativa: `docs/prd/PRD-20261028-ux-onboarding-coherencia.md` (objetivos G-n; cada SDD dice cuál cubre). Plantilla vigente: `docs/factory/templates/sdd.md`, 18 secciones.

## Índice y orden recomendado
| # | SDD | Tipo | Depende de |
|---|---|---|---|
| 1 | `SDD-20261025-universal-field-definitions` | Feature | — (base) |
| 2 | `SDD-20261025-field-actions-edit-delete-confirm` | Feature | 1 |
| 3 | `SDD-20261025-strategy-setup-guided-next-step` | Mejora | 1 |
| 4 | `SDD-20261025-onboarding-flow-end-to-end` | Feature | 1, 2, 3 |
| 5 | `SDD-20261025-drive-per-company-account` | Feature | independiente |
| 6 | `SDD-20261025-discoveries-scoped-manual-search` | Mejora | 2 (confirmar competidores) |
| 7a | `SDD-20261025-fit-data-7a-llave-minima-y-completado` | Feature | 1, 2 |
| 7b | `SDD-20261025-fit-data-7b-competitors-entity` | Feature | 1, 2; coordinar con 6 |
| 7c | `SDD-20261025-fit-data-7c-person-identity-and-third-party-results` | Feature | 1, 2 |
| 8 | `SDD-20261025-products-in-onboarding-autofill` | Mejora | 1, 2; encaja en onboarding (4) |
| 9 | `SDD-20261025-theory-u-proactive-decision-support` | Feature | 1, 2 |
| 10 | `SDD-20261025-connections-bring-your-own-account` | Feature | 1; incluye el SDD 5 como primer caso |
| 11 | `SDD-20261027-strategic-suggestions-engine` | Feature (maestro, 8 fases) | 1, 2, 7b; usa 9 |

## Tanda 2026-11-06 · señales, hallazgos y reglas de outreach
**Requisito previo:** `feat/plays-library-core` (SDD 1 de Plays, migración 0077) fusionada en `main`; toca el mismo registro de herramientas, manifest, `proactive/` y `org-data.ts`. `signal-freshness` y la U-3 de `frontal-rules-integration` son los SDD 2 y 3 del PRD de Plays (`docs/prd/PRD-20261106-plays-gtm.md`).
Orden de ejecución (uno tras otro: comparten `proactive.test.ts` y `agent-tools.test.ts`). Los tres necesitan la aprobación explícita de Fede.
| # | SDD | Tipo | Depende de |
|---|---|---|---|
| 12 | `SDD-20261106-frontal-rules-integration`, solo U-1 (`draft-rules`) | Mejora | — |
| 13 | `SDD-20261106-signal-freshness` (sustituye a la U-2 del anterior) | Mejora | — |
| 14 | `SDD-20261106-proven-findings` | Mejora | — |
| 15 | `SDD-20261106-frontal-rules-integration`, U-3 (reactivación) y luego U-4 (jugadas) | Mejora | 12, 13 (U-4 también 14) |
Ramas: `feat/draft-rules`, `feat/signal-freshness`, `feat/proven-findings`, `feat/closed-lost-revival`, `feat/playbook-base-plays`. Ninguno tiene migración.
Decisiones de Fede (2026-11-06): una sola regla de vigencia de señales (`signal-freshness`); tope de 5 sugerencias de señal por ejecución y empresa; ventanas por tipo aceptadas como valores por defecto; seguimiento unificado en 60 palabras; mínimo de 3 pérdidas para un patrón, con experimentos descartados incluidos; tope de reactivaciones por empresa; «toque» = mensaje saliente, llamada o reunión registrada (el score de actividad sigue fuera de v1).

Anexo: `annex/field-inventory-20261025.md` (inventario determinista del esquema: 84 tablas, 1043 columnas, 35 jsonb, 48 estados en texto).

## Principio de uso de LLM (aplica a los diez)
Orden de preferencia: regla determinista → dato derivado/caché → modelo barato (`effort:"low"`) → modelo caro (solo A fondo). Cada SDD declara sus llamadas; los primeros no añaden ninguna salvo reformular textos con caché.

## Decisiones tomadas por Fede (2026-10-25)
| Tema | Decisión |
|---|---|
| Aviso por inactividad (guía y onboarding) | 1 día |
| Drive | Conexión por empresa, desde la sección Conexiones |
| Búsqueda manual y reloj semanal | El reloj queda intacto |
| Competidores hallados por Descubiertos | Piden tu OK |
| Clave mínima de enriquecimiento | Validada tal cual |
| SDD de datos mínimos | Dividido en 7a, 7b y 7c (hecho) |
| Plazo de deshacer | 24 horas |
| Alta manual de competidores | Onboarding (Posicionamiento), pantalla de Estrategia y Agente |
| Cuenta propia sin crédito | Usa la cuenta de NOKKO |
| Proveedores con cuenta propia | Apollo, Clay, Parallel, Perplexity, Firecrawl; extensible a cualquier proveedor presente o futuro |
| Quién gestiona conexiones | Solo el Owner |
| Theory U: aviso de sensing | 8 notas sin sintetizar |

## Decisiones que siguen abiertas
1. Productos: moneda y productos en varias monedas.
2. Resto de [Por verificar] que depende de producción, proveedores o datos reales (ver sección 16 de cada SDD).

Decididas en la segunda ronda: coste del respaldo (se descuenta del presupuesto de la empresa), Theory U avisa a los 14 días en la misma fase, queda aparte y la guía lo sugiere, y el catálogo empieza por Origen, País, Tamaño e Importe.

## Límites del análisis
- `nokko.ai/discoveries` exige sesión: análisis hecho sobre el código de `main`, no sobre producción.
- Agrupación de campos por nombre, no por significado.
- Sin datos de uso: todas las líneas base figuran como «sin dato».
- Desde 2026-10-28 los SDD siguen la plantilla propia de NOKKO (`docs/factory/templates/sdd.md`). BMAD quedó archivado en `docs/archivado/bmad/`.
