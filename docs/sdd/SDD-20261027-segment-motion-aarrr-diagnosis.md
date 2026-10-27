# SDD-20261027-segment-motion-aarrr-diagnosis · [Feature] Motion por segmento y diagnóstico AARRR

**Tipo:** Feature · **Prioridad propuesta:** Media-alta (desbloquea plantillas por motion)
**Estado:** Borrador (pendiente de aprobación de Fede) · **Pide:** Fede · **Para:** Claude Code (sin Dani) · **Fecha:** 2026-10-27

Copia en Drive: Postin Core → 02 — Producto → «SDD — Motion por segmento y diagnóstico AARRR (Nokko)».

## 1. Problema
NOKKO trata igual a todos los segmentos aunque se vendan de formas distintas (PLG, venta asistida, partners). Tampoco responde a «¿dónde se pierde negocio?» con los datos que ya tiene.

## 2. Alcance
1. Campo `motion` en el segmento.
2. Diagnóstico AARRR por segmento y trimestre, en pantalla y en el chat.

## 3. Fuera de alcance
- Ocultar o cambiar pantallas según el motion.
- Etapas posventa del Bowtie.
- Flywheel.
- Detector proactivo.
- Tablero Bullseye.

## 4. Requisitos y criterios de aceptación

### Motion
- **CA-1:** el segmento tiene `motion` con valores `plg`, `slg`, `marketing`, `partner` o vacío («sin definir»). Los segmentos existentes quedan vacíos; no se infiere.
- **CA-2:** se edita en Estrategia y desde el chat. Solo owner y sales_leader.
- **CA-3:** la plantilla de ticket bajo asigna `plg` a self-service y `slg` a venta asistida. La de enterprise asigna `slg`.
- **CA-4:** `get_segment_coverage` y `list_segments` devuelven el motion.

### Diagnóstico
- **CA-5:** una función pura calcula, por segmento y trimestre, cada fase con valor, denominador, fuente y estado (`ok`, `sin_datos`).
  - Acquisition: leads de entrada.
  - Activation: pruebas activadas sobre pruebas, con el evento de PostHog que la empresa haya configurado.
  - Retention: churn de clientes según Stripe.
  - Revenue: conversión de prueba a pago y deals ganados.
  - Referral: siempre «no medido» (no hay fuente).
- **CA-6:** sin datos o sin evento configurado, la fase sale «sin datos». Nunca 0 ni estimaciones.
- **CA-7:** el veredicto «fuga» solo aparece si el segmento tiene un objetivo contra el que comparar. Sin objetivo, se muestran valores sin juicio.
- **CA-8:** herramienta de chat y MCP `get_funnel_diagnosis`, de lectura, sin llamadas a proveedores externos (solo lee la base de datos) y filtrada por `org_id`.
- **CA-9:** una vista en Estrategia muestra lo mismo que la herramienta, con la misma función.

## 5. Decisiones
- **D-1. `motion` como columna con restricción de valores, no texto libre.** Evita variantes y permite filtrar. Se reconsidera si aparecen motions personalizados.
- **D-2. Diagnóstico calculado al vuelo, sin tabla nueva.** Cero migraciones de datos y siempre coherente con la fuente. Se reconsidera si el cálculo resulta lento.
- **D-3. Referral fuera de la medición.** No hay fuente fiable y no se inventa.

## 6. Tareas
| ID | Tarea | Cubre | Depende de |
|---|---|---|---|
| T-1 | Migración aditiva: columna `motion` nullable en segmentos | CA-1 | — |
| T-2 | Ampliar `upsert_segment`, pantalla de Estrategia, `list_segments` y `get_segment_coverage` | CA-2, CA-4 | T-1 |
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

## 11. Por verificar (primera tarea de quien implemente)
- Esquema real de segmentos, objetivos y trimestres.
- Dónde viven pruebas, eventos de PostHog y métricas de Stripe.
- Si `upsert_segment` admite campos nuevos sin romper el MCP.
- Número de migración siguiente y convenciones de `AGENTS.md` y `src/lib/AGENTS.md`.
- Si los tests corren en la sesión (la auditoría anterior encontró `bun.lock` bloqueado por el proxy).

## 12. Decisión
Pendiente: Aceptado / Cambios pedidos / Rechazado — Fede.

---
Autoauditoría: OK, con los puntos de «Por verificar» pendientes.
