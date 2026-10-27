# SDD-20261027-segment-motion-aarrr-diagnosis · [Feature] Motion por segmento y diagnóstico AARRR

**Tipo:** Feature · **Prioridad propuesta:** Media-alta (desbloquea plantillas por motion)
**Estado:** Aceptado con cambios (ver sección 12) · **Pide:** Fede · **Para:** Claude Code (sin Dani) · **Fecha:** 2026-10-27

Copia en Drive: Postin Core → 02 — Producto → «SDD — Motion por segmento y diagnóstico AARRR (Nokko)».

## 1. Problema
NOKKO trata igual a todos los segmentos aunque se vendan de formas distintas (PLG, venta asistida, partners). Tampoco responde a «¿dónde se pierde negocio?» con los datos que ya tiene.

## 2. Alcance
1. Campo `acquisition_motion` (motion de adquisición) en el segmento. `segments.motion` ya existe como modelo de venta por ACV y no se toca.
2. Diagnóstico AARRR por segmento y trimestre, en pantalla y en el chat.

## 3. Fuera de alcance
- Ocultar o cambiar pantallas según el motion.
- Etapas posventa del Bowtie.
- Flywheel.
- Detector proactivo.
- Tablero Bullseye.

## 4. Requisitos y criterios de aceptación

### Motion
- **CA-1:** el segmento tiene `acquisition_motion` con valores `plg`, `slg`, `marketing`, `partner` o vacío («sin definir»). Los segmentos existentes quedan vacíos; no se infiere. `segments.motion` (`plg/inside/field/strategic`, modelo de venta por ACV que alimenta la calculadora) no cambia.
- **CA-2:** se edita en Estrategia y desde el chat. Solo owner y sales_leader.
- **CA-3:** la plantilla de ticket bajo asigna `acquisition_motion` `plg` a Self-service y `slg` a Venta asistida. La plantilla por ACV asigna `slg` a su segmento Enterprise y deja el resto vacío.
- **CA-4:** `list_segments` (herramienta nueva, de lectura) y `get_segment_coverage` devuelven `motion` y `acquisition_motion`.

### Diagnóstico
- **CA-5:** una función pura calcula, por segmento y trimestre, cada fase con valor, denominador, fuente y estado (`ok`, `sin_datos`).
  - Acquisition: leads de entrada.
  - Activation: pruebas activadas sobre pruebas, con el evento de PostHog que la empresa haya configurado.
  - Retention: churn de clientes según Stripe, **solo a nivel empresa** (`stripe_snapshots` no tiene segmento); por segmento, «sin datos».
  - Revenue: conversión de prueba a pago y deals ganados.
  - Referral: siempre «no medido» (no hay fuente).
- **CA-6:** sin datos o sin evento configurado, la fase sale «sin datos». Nunca 0 ni estimaciones.
- **CA-7:** el veredicto «fuga» solo aparece si el segmento tiene un objetivo contra el que comparar. Sin objetivo, se muestran valores sin juicio.
  - Objetivo = solo lo que existe: `win_rate_target` (win rate) y `payback_months` (payback, solo con CAC real). No hay objetivos por fase AARRR.
  - «Fuga» = cualquier valor peor que el objetivo, sin tolerancia ni muestra mínima; siempre se muestra el denominador.
  - Revenue según `acquisition_motion`: `plg` = prueba a pago (sin objetivo, nunca veredicto); `slg` = deals ganados, win rate y payback (con veredicto); `marketing`, `partner` o sin definir = ambas fuentes sin juicio.
- **CA-8:** herramienta de chat y MCP `get_funnel_diagnosis`, de lectura, sin llamadas a proveedores externos (solo lee la base de datos) y filtrada por `org_id`.
- **CA-9:** una vista en Estrategia muestra lo mismo que la herramienta, con la misma función.

## 5. Decisiones
- **D-1. `motion` como columna con restricción de valores, no texto libre.** Evita variantes y permite filtrar. Se reconsidera si aparecen motions personalizados.
- **D-2. Diagnóstico calculado al vuelo, sin tabla nueva.** Cero migraciones de datos y siempre coherente con la fuente. Se reconsidera si el cálculo resulta lento.
- **D-3. Referral fuera de la medición.** No hay fuente fiable y no se inventa.

- **D-4. Columna separada `acquisition_motion`, no migrar `motion`.** `motion` ya existía (NOT NULL, default `inside`) y alimenta `capacityPlan`, el payback, la cobertura, `bmad/tracks.ts`, `advisor.ts` y el onboarding. Migrarlo al nuevo conjunto habría fundido `inside/field/strategic` en uno y perdido esa distinción.

## 6. Tareas
| ID | Tarea | Cubre | Depende de |
|---|---|---|---|
| T-1 | Migración aditiva: columna `acquisition_motion` nullable con CHECK en segmentos | CA-1 | — |
| T-2 | Ampliar `upsert_segment`, pantalla de Estrategia, crear `list_segments` y ampliar `get_segment_coverage` | CA-2, CA-4 | T-1 |
| T-3 | Plantillas de ticket bajo y enterprise con motion | CA-3 | T-1 |
| T-4 | Función pura de diagnóstico y sus tests | CA-5, CA-6, CA-7 | T-1 |
| T-5 | Herramienta `get_funnel_diagnosis` + título MCP + manifest | CA-8 | T-4 |
| T-6 | Vista de diagnóstico en Estrategia | CA-9 | T-4 |
| T-7 | Tests de aislamiento por empresa y test estructural del registro | CA-8 | T-5 |

T-2 y T-3 pueden ir en paralelo; T-5 y T-6 también.

## 7. Plan de pruebas
- Función pura con datos ficticios: fase completa, fase sin datos, segmento sin objetivo y segmento sin motion.
- Aislamiento: `expectScoped` con ids de otra empresa.
- Regresión: las plantillas existentes y `get_segment_coverage` no cambian salvo por el campo nuevo.

## 8. Despliegue y rollback
- La migración es aditiva y reversible (se quita la columna).
- Todo va en un PR pequeño en rama aparte, revisado antes de fusionar.
- Éxito: el segmento muestra motion y el diagnóstico sale «sin datos» en empresas sin uso, lo esperable con la foto de partida a cero.
- Las migraciones se prueban en Postgres local; no se crean proyectos de Supabase para pruebas.

## 9. Riesgos
- Sin eventos de PostHog configurados, la fase de activación queda vacía. Es correcto, pero puede parecer un fallo: la vista debe explicar qué falta.
- La auditoría del 24 oct sigue abierta. Este trabajo no la empeora, porque el diagnóstico no gasta créditos.

## 10. Preguntas abiertas
- Ninguna sobre el QUÉ. Pendiente solo la aprobación de Fede.

## 11. Verificado (2026-10-27, leyendo el código; ejecutado solo lo indicado)
- `segments.motion` ya existía (migración 0001, NOT NULL, default `inside`, sin CHECK). Por eso D-4.
- Objetivos y trimestres: trimestre como texto `AAAA-QN`; `segment_targets(segment_id, period, amount)`, `segment_budget_quarters`, y por segmento `win_rate_target`, `cac_target`, `payback_months`. No hay objetivos por fase AARRR: para CA-7 el «objetivo» será uno de estos (por decidir en T-4).
- Pruebas: tabla `trials` (`segment_id`, `signed_up_at`, `activated_at`, `converted_at`). PostHog por empresa en `posthog_connections` (`signup_event`, `activation_event`, `paid_event`); la sincronización escribe en `trials`.
- Stripe: solo `stripe_snapshots` por empresa; sin segmento.
- `upsert_segment` (`src/lib/agent/tools/strategy.ts`) admite campos nuevos ampliando su zod. `list_segments` no existía.
- Siguiente migración: `main` llega a 0063; otras ramas reservan 0059, 0062 y 0064–0070. T-1 usa 0071 (renumerar al fusionar).
- **Sin verificar:** los tests no corren en la sesión (`bun install` bloqueado por el proxy, 403); las políticas RLS de `segments` no están en el repo; `leads` tiene `segment_id` pero no se ha comprobado su RLS ni su volumen.

## 12. Decisión
Aceptado con cambios — Fede (2026-10-27): columna separada `acquisition_motion`, retención solo a nivel empresa, `list_segments` nueva; objetivo, umbral de «fuga» y Revenue por motion como en CA-7; la migración 0071 la aplica Lovable al sincronizar (no verificado).
- T-1 a T-3: PR #42, fusionado (tsc y 778 tests en una copia con dependencias de npmjs, no del lockfile).
- T-4 a T-7: PR #43, borrador. No probado en navegador.

---
Autoauditoría: OK; la sección 11 recoge lo verificado y lo que sigue sin verificar.
