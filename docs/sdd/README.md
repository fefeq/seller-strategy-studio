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
| 7 | `SDD-20261025-minimum-fit-data-for-enrichment` | Feature | 1, 2; coordinar con 6 por competidores |
| 8 | `SDD-20261025-products-in-onboarding-autofill` | Mejora | 1, 2; encaja en onboarding (4) |
| 9 | `SDD-20261025-theory-u-proactive-decision-support` | Feature | 1, 2 |

Anexo: `annex/field-inventory-20261025.md` (inventario determinista del esquema: 84 tablas, 1043 columnas, 35 jsonb, 48 estados en texto).

## Principio de uso de LLM (aplica a los nueve)
Orden de preferencia: regla determinista → dato derivado/caché → modelo barato (`effort:"low"`) → modelo caro (solo A fondo). Cada SDD declara sus llamadas; los primeros no añaden ninguna salvo reformular textos con caché.

## Decisiones que necesito de Fede
1. Drive: ¿conexión por empresa, por usuario o ambas? ¿Una cuenta o varias por empresa?
2. ¿Cuántos días sin actividad antes de avisar (guía y onboarding)? Propuesta: 3.
3. Descubiertos: ¿la búsqueda manual debe dejar intacto el reloj semanal por defecto? (propuesto sí).
4. Descubiertos: ¿los competidores hallados deben pedir confirmación antes de entrar en el posicionamiento? (propuesto sí).
5. Campos: ¿empezamos el catálogo por Origen, País, Tamaño e Importe (mayor dispersión)?
6. Enriquecimiento: ¿validas la tabla de llave mínima (cuenta=dominio+nombre, persona=nombre+cuenta/LinkedIn/email, lead=persona+cuenta, competidor=nombre+dominio)?

## Límites del análisis
- `nokko.ai/discoveries` exige sesión: análisis hecho sobre el código de `main`, no sobre producción.
- Agrupación de campos por nombre, no por significado.
- Sin datos de uso: todas las líneas base figuran como «sin dato».
- Los SDD siguen la plantilla `postin-sdd` aunque el repo tiene convención BMAD (`sdd.config.json`); Dani decide si se convierten.
