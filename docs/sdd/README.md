# SDD 2026-10-25 · UX de estrategia, onboarding y coherencia de campos

Estado: **SDD 1, 2, 3 y 10 aprobados por Fede** (1 y 2 ya implementados; 3 y 10 con PR abiertos, aprobados el 2026-10-27). El resto en **Borrador**; Dani no interviene en NOKKO (decisión de Fede, 2026-10-27): flujo = Fede aprueba, Claude Code implementa, auditoría independiente revisa, Fede fusiona. Rama: `sdd/ux-onboarding-coherencia-20261025`.

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

## Estado a 2026-10-27 (según GitHub)
| SDD | Estado | PR |
|---|---|---|
| 1 Definiciones universales | Fusionado en `main` (U-1 a U-4); sin revisión externa | #34 |
| 2 Acciones sobre campos | Fusionado en `main` (U-1 a U-5) con correcciones | #34, #35 |
| 3 Guía de estrategia | En revisión; falta cambiar la base a `main` y renumerar la migración | #31 |
| 10 y 5 Conexiones y Drive | En revisión; entrega parcial (Drive propio, permiso `drive.file`) | #32 |
| 4, 6, 7a, 7b, 7c, 8, 9 | Sin empezar | — |

El PR #30 y la rama `feat/connections-own-account` quedan sustituidos por #32.

Anexos: `annex/fit-data-common.md` (contexto común de 7a/7b/7c) y `annex/field-inventory-20261025.md` (inventario determinista del esquema: 84 tablas, 1043 columnas, 35 jsonb, 48 estados en texto).

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
1. [Por verificar] que lo comprueba Claude Code en el código o lo decide Fede (ver sección 15 de cada SDD).

Decididas el 2026-10-27 (OK a las recomendaciones): dueño de «propuesta pendiente» = SDD universal (reutiliza `field_proposal`); moneda única por empresa en productos (otra moneda queda «Falta confirmar», varias monedas fuera); 7a/7b/7c recortados con anexo común `annex/fit-data-common.md`.

Decididas en la segunda ronda: coste del respaldo (se descuenta del presupuesto de la empresa), Theory U avisa a los 14 días en la misma fase, queda aparte y la guía lo sugiere, y el catálogo empieza por Origen, País, Tamaño e Importe.

## Orden de implementación recomendado
8 (productos) → 7b (competidores) → 6 (Descubiertos) → 7a (llave mínima) → 4 (onboarding) → 7c (identidad y terceros) → 9 (Theory U). Los SDD 1, 2, 3 y 10 (con el 5) van antes, ya en curso (ver tabla de estado).

## Entorno de pruebas (pendiente de Fede)
Las migraciones nuevas (0058, 0060, 0061, 0063 en `main`, más las de #31 y #32) no están verificadas en una base real. Antes de seguir implementando hay que crear un entorno de pruebas (rama de base de datos de pruebas) y aplicar ahí las migraciones; no se prueba en producción (nokko.ai). Hasta entonces, las pruebas son locales con datos ficticios.

## Límites del análisis
- `nokko.ai/discoveries` exige sesión: análisis hecho sobre el código de `main`, no sobre producción.
- Agrupación de campos por nombre, no por significado.
- Sin datos de uso: todas las líneas base figuran como «sin dato».
- Los SDD siguen la plantilla `postin-sdd` aunque el repo tiene convención BMAD (`sdd.config.json`); lo decide Fede.
