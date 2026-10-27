# SDD 2026-10-25 · UX de estrategia, onboarding y coherencia de campos

Estado de todos: **Borrador** (ninguno aprobado, ninguno enviado a Dani). Rama: `sdd/ux-onboarding-coherencia-20261025`.

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
2. Resto de [Por verificar] que depende de Dani (ver sección 15 de cada SDD).

Decididas en la segunda ronda: coste del respaldo (se descuenta del presupuesto de la empresa), Theory U avisa a los 14 días en la misma fase, queda aparte y la guía lo sugiere, y el catálogo empieza por Origen, País, Tamaño e Importe.

## Límites del análisis
- `nokko.ai/discoveries` exige sesión: análisis hecho sobre el código de `main`, no sobre producción.
- Agrupación de campos por nombre, no por significado.
- Sin datos de uso: todas las líneas base figuran como «sin dato».
- Los SDD siguen la plantilla `postin-sdd` aunque el repo tiene convención BMAD (`sdd.config.json`); Dani decide si se convierten.
