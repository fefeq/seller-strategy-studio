# SDD-20261106-metrics-honest-data · [Mejora] Métricas con datos honestos: el trimestre filtra y ninguna cifra se inventa

**Tipo:** Mejora · **Prioridad propuesta:** Alta
**Estado:** Borrador · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-11-06
**PRD:** No aplica (mejora acotada de una pantalla, sin esquema nuevo) · **Depende de:** — · **Coordinar con:** NK-0051 (SDD-C de este sprint toca `metrics.tsx` y `src/components/metrics/*`), NK-0029 (`SDD-20261030-gtm-control-tower-3-attribution-metrics`, aprobado: canal de adquisición; su CA-24 «Sin dato» es el mismo principio), PR #76 de Plays (toca `src/lib/headlines.ts`, que este SDD no toca)

> Sprint 1 de mejoras en pantallas core, bloque A. Rehecho el 2026-11-06 tras perderse la versión anterior (no llegó a subirse).

## 1. Resumen
`/metrics` muestra cifras que no salen de ningún dato: deals sin fuente cuentan como «Outbound», un ACV sin máximo se multiplica por 1,5, el payback asume margen del 100 % si falta el margen, y el coste compartido se reparte a partes iguales cuando nadie ha ganado. Además, el selector de trimestre no afecta a cuatro secciones que parecen depender de él. Este cambio hace que cada cifra de `/metrics` diga de qué periodo y de qué dato sale, o diga «Sin dato», sin cambiar ninguna cifra de `/strategy`.

## 2. Problema y para quién
Owner y Sales Leader toman decisiones de presupuesto, cuota y canal con números que la pantalla presenta como reales y en parte son supuestos del código. El problema no es que haya supuestos, sino que no se ven.

## 3. Evidencia y por qué ahora
Leído en `main` @ `f76f639`:

**El trimestre no filtra**
- `src/routes/_authenticated/metrics.tsx:231-248`: Embudo, Perdidos, Cohortes y Tendencias reciben `data.deals` y `data.history` completos; el `quarter` del selector (`:93`, `:200-211`) no se les pasa.
- `src/lib/revops.ts:111`: `weeklyTrend` usa «últimas 12 semanas desde hoy», una ventana propia.
- `metrics.tsx:147-155` y `:173-176`: win rate por fuente, por rep y global usan todos los deals cerrados de la historia, mientras el KPI de `:277-281` pone en su pista «deals creados este trimestre».

**Cinco atribuciones sin dato**
| # | Dónde | Qué hace hoy |
|---|---|---|
| A1 | `metrics.tsx:163` | `d.source ?? "outbound"`: un deal sin fuente suma a «Outbound» en «Win rate por fuente». `deals.source` admite null (`src/integrations/supabase/types.ts`, tabla `deals`). |
| A2 | `src/lib/segment-coverage.ts:22-26` (`assignSegment`) → `src/lib/metrics.ts:25` (`matchSegment`) | Un deal sin `segment_id` se asigna al segmento cuyo rango de ACV cubre su importe. La pantalla no dice cuántos deals están asignados así. |
| A3 | `src/lib/cac.ts:22-34` (`segmentCac`) | El coste compartido se reparte por clientes ganados; si nadie ganó, a partes iguales (`:30`). El primer reparto está declarado en pantalla (`src/components/cac-panel.tsx:146`); el segundo no. |
| A4 | `segment-coverage.ts:9-19` (`segmentAcv`) | Sin ganados ni abiertos, ACV = punto medio del rango, o `acv_min × 1.5` si no hay máximo (`:17`). La pantalla rotula ambos casos «punto medio del rango» (`src/components/segment-coverage.tsx:17`, `:93`): el segundo caso está mal rotulado. De ese ACV salen deals objetivo, oportunidades objetivo y payback (`segment-coverage.ts:52-53`, `:63`). |
| A5 | `metrics.ts:40` (`capacityPlan`) | `grossMarginPct ?? 100`: sin margen, el payback se calcula como si el margen fuera 100 %. En `segment-coverage.tsx:126-129` no se muestra nada cuando falta el margen, así que el payback parece real. |

**Pistas que llevan a ninguna parte**
- `src/components/quarter-kpis-panel.tsx:123`: «costes en «CAC real» (más abajo)». El panel está en Resumen; «CAC real» está en la sección «CAC y presupuesto» (`metrics.tsx:289-291`).
- `src/components/pipeline-board-panel.tsx:84`: «Apúntalo en «CAC real», más abajo». Está en Rendimiento (`metrics.tsx:299`): mismo error.
- `src/components/segment-coverage.tsx:128`, `:136`, `:137`: remiten a «Presupuesto por segmento» y «CAC real» como texto, sin enlace, desde Resumen.

**Código compartido con `/strategy` (congelada en este sprint)**
`capacityPlan`, `matchSegment`, `segmentAcv`, `segmentCoverage`, `paybackByQuarter`, `quarterlyBudget`, `wonDealsMargin` y `segmentCac` alimentan también `src/components/strategy/motions.tsx`, `src/routes/_authenticated/strategy.tsx`, `src/components/payback-quarters.tsx`, `src/components/budget-quarters.tsx` y `src/components/payback-card.tsx`. Cambiar su comportamiento por defecto cambia Payback, Presupuesto y Diagnóstico de `/strategy`.

**CAC y payback no unificados (contexto, no se resuelve aquí):** CAC real por segmento (`cac.ts:31`), CAC medio de la tabla de 4 trimestres (`cac-panel.tsx:69`), CAC trimestral de empresa (`src/lib/quarter-kpis.ts:48`) y el CAC objetivo como sustituto (`segment-coverage.ts:61-63`); payback por segmento (`capacityPlan`) y payback de empresa ponderado por clientes (`quarter-kpis.ts:25-28`).

**Uso:** sin dato (no hay analítica de `/metrics`).

## 4. Resultado buscado
- Cero cifras en `/metrics` calculadas con un valor que no existe en los datos sin que la pantalla lo diga. Línea base medida en código: 5 atribuciones (tabla A1-A5) y 4 secciones que ignoran el trimestre. Objetivo: 0 y 0.
- Cero cambios en las cifras de `/strategy` (prueba de no regresión, CA-11).
- Uso o satisfacción: sin dato.

## 5. Alcance
**Incluye:**
- Embudo y Perdidos filtrados por el trimestre del selector; Cohortes y Tendencias con su ventana dicha en pantalla.
- Win rate (global, por fuente, por rep) del trimestre seleccionado.
- A1-A5 tratados en `/metrics` como «Sin dato» o como estimación rotulada, mediante opciones nuevas y opcionales en las funciones compartidas cuyo valor por defecto deja el comportamiento actual.
- Pistas de `/metrics` que remiten a otra sección: enlace a la sección correcta (`/metrics?seccion=…` o `/strategy`).

**No incluye:**
- Cualquier cambio de cifras, textos o comportamiento en `/strategy` y en sus componentes (`src/components/strategy/*`, `payback-quarters.tsx`, `budget-quarters.tsx`, `payback-card.tsx`).
- Cambiar el comportamiento por defecto de `capacityPlan`, `matchSegment`, `segmentAcv`, `segmentCoverage`, `paybackByQuarter`, `quarterlyBudget`, `wonDealsMargin` o `segmentCac`.
- Unificar las fórmulas de CAC y payback (propuesta aparte, ver §15).
- `src/lib/advisor.ts:81` (mismo `?? "outbound"` en el snapshot del asesor y del agente): fuera de `/metrics` (ver §15).
- Canal de adquisición, diccionario de métricas y embudos por modelo de venta (NK-0029).
- Paleta, legibilidad y patrón visual de `/metrics` (NK-0051, SDD-C).
- `src/lib/headlines.ts`, `src/lib/nav.ts` (PR #76 de Plays).
- Esquema, migraciones, RLS.

## 6. Cambios de comportamiento (delta)
**Añadido:**
- Grupo «Sin fuente» en «Win rate por fuente».
- Por segmento, en Cobertura: «N de M deals asignados por importe» cuando N > 0.
- Por segmento: motivo de «Sin dato» en ACV y payback («falta ACV máximo», «falta margen», «falta CAC»).
- Línea «Compartido sin repartir» en «CAC real» cuando nadie ganó en el trimestre.
- Texto de ventana en Cohortes y Tendencias.

**Modificado:**
- Embudo y Perdidos: todos los deals → deals del trimestre (ver §13 para la regla exacta).
- Win rate global, por fuente y por rep: historia completa → trimestre seleccionado.
- ACV de un segmento sin ganados, sin abiertos y sin máximo: `acv_min × 1.5` rotulado «punto medio del rango» → «Sin dato · falta ACV máximo»; deals objetivo, oportunidades objetivo y payback derivados → «Sin dato».
- ACV punto medio del rango (con máximo): rótulo → «estimado: punto medio del rango».
- Payback sin margen: calculado al 100 % sin aviso → «Sin dato · falta margen».
- Coste compartido sin clientes ganados: a partes iguales por segmento → sin repartir, en una línea propia.
- Pistas de `quarter-kpis-panel.tsx:123`, `pipeline-board-panel.tsx:84`, `segment-coverage.tsx:128/136/137`: texto → enlace a la sección correcta.

**Eliminado:** el supuesto «sin fuente = Outbound» y el multiplicador 1,5 en lo que se muestra en `/metrics`.

## 7. Historias y criterios de aceptación
### H-1: Como Owner o Sales Leader, quiero que el trimestre que elijo filtre lo que veo, para comparar trimestres sin mezclar periodos.
- **CA-1** Con el trimestre T seleccionado, Embudo cuenta solo deals creados en T, y Perdidos solo deals perdidos con fecha de cierre en T. · prueba: `src/lib/revops-quarter.test.ts`
- **CA-2** Cohortes y Tendencias muestran, junto al título, la ventana que usan y que no depende del trimestre («Últimas 12 semanas · no depende del trimestre»). · prueba: `src/components/metrics/revops-panels.test.tsx`
- **CA-3** Win rate global, por fuente y por rep cuentan solo deals cerrados en T; sin cerrados en T, cada panel dice «Sin deals cerrados en T». · prueba: `src/lib/metrics-quarter.test.ts`

### H-2: Como Owner o Sales Leader, quiero saber qué cifra es real y cuál estimada, para no decidir sobre un supuesto.
- **CA-4** Un deal con `source` null cuenta en «Sin fuente», nunca en «Outbound». · prueba: `src/lib/metrics-quarter.test.ts`
- **CA-5** Si un segmento tiene N > 0 deals sin `segment_id` asignados por importe, su tarjeta de Cobertura dice «N de M deals asignados por importe». · prueba: `src/lib/segment-coverage.test.ts`
- **CA-6** Con la opción estricta, un segmento sin ganados, sin abiertos y sin `acv_max` devuelve ACV null con motivo «falta ACV máximo», y sus deals objetivo, oportunidades objetivo y payback son null. · prueba: `src/lib/segment-coverage.test.ts`
- **CA-7** Con la opción estricta, un segmento con ACV y CAC pero sin margen devuelve payback null con motivo «falta margen»; la pantalla muestra «Sin dato · falta margen». · prueba: `src/lib/segment-coverage.test.ts`
- **CA-8** Con la opción estricta y cero clientes ganados en el trimestre, el coste compartido no se asigna a ningún segmento y se devuelve como total sin repartir; «CAC real» lo muestra en la línea «Compartido sin repartir». · prueba: `src/lib/cac.test.ts`
- **CA-9** El ACV calculado como punto medio del rango se rotula «estimado: punto medio del rango». · prueba: `src/components/segment-coverage.test.tsx`

### H-3: Como Owner o Sales Leader, quiero que una pista me lleve a donde se arregla, para no buscarlo.
- **CA-10** Cada pista que nombra otra sección es un enlace: «CAC real» → `/metrics?seccion=economia`; «Presupuesto por segmento» → `/metrics?seccion=economia`; «Presupuesto vs real» → `/strategy` (ya lo es). Ningún texto de `/metrics` dice «más abajo» o «más arriba» para referirse a otra sección. · prueba: `src/components/metrics/hints.test.tsx`

### H-4: Como Fede, quiero que `/strategy` no cambie en este sprint.
- **CA-11** Sin la opción estricta, `capacityPlan`, `segmentAcv`, `segmentCoverage`, `paybackByQuarter`, `quarterlyBudget`, `wonDealsMargin` y `segmentCac` devuelven exactamente lo mismo que en `f76f639` para un conjunto fijo de datos ficticios (comparación profunda, incluido A1-A5), y los tests existentes de esos módulos pasan sin cambios. · prueba: `src/lib/strategy-freeze.test.ts`

## 8. Casos límite y errores
- Trimestre sin deals: cada sección dice «Sin deals en T», no ceros que parezcan medidos (CA-1, CA-3).
- Deal cerrado sin `closed_at`: hoy se usa `updated_at` (`metrics.tsx:138`); se mantiene la misma regla en Perdidos para no crear una tercera. [Por verificar] cuántos deals cerrados no tienen `closed_at`: requiere datos reales.
- Segmento con `acv_min` null y `acv_max` null, sin deals: ACV null con motivo «falta rango de ACV» (variante de CA-6).
- Segmento con margen 0 %: es un dato, no falta; payback se calcula (división por cero → null con motivo «margen 0 %»). Se cubre en CA-7.
- Coste compartido con clientes ganados solo en un segmento: reparto por clientes, como hoy (ya declarado en `cac-panel.tsx:146`).
- Multitenant: no hay consultas nuevas; las existentes ya pasan por RLS.

## 9. Experiencia y copy
- «Sin fuente», «Sin dato · falta ACV máximo», «Sin dato · falta margen», «Sin dato · falta CAC», «estimado: punto medio del rango», «N de M deals asignados por importe», «Compartido sin repartir», «Últimas 12 semanas · no depende del trimestre», «Sin deals cerrados en {T}».
- Español, «tú», sin iconos; el estado lo dice la palabra, no el color.
- Patrón visual de «Sin dato» y estimado: lo fija SDD-C (NK-0051). Aquí solo el texto.

## 10. Datos, permisos y privacidad
Sin tablas, columnas, RLS ni GRANT nuevos. Mismas consultas. Tests con datos ficticios. Finanzas sigue visible solo para Owner y Sales Leader (`metrics.tsx:218`, `:405-412`).

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| ninguna | — | — | — |

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-0 | Congelar `/strategy`: fixture ficticia y salida de las funciones compartidas en `f76f639` | CA-11 | `src/lib/strategy-freeze.test.ts` (pasa en base; es la red, no un fail-first: debe seguir pasando tras U-2 a U-4) |
| U-1 | Filtro por trimestre en Embudo, Perdidos y win rates; ventana visible en Cohortes y Tendencias; «Sin fuente» | CA-1, CA-2, CA-3, CA-4 | `src/lib/revops-quarter.test.ts`, `src/lib/metrics-quarter.test.ts` |
| U-2 | Opción estricta en `segmentAcv`, `capacityPlan` y `segmentCoverage` (ACV y payback null con motivo; recuento de asignados por importe) | CA-5, CA-6, CA-7 | `src/lib/segment-coverage.test.ts` |
| U-3 | Opción estricta en `segmentCac` (compartido sin repartir si no hay clientes) | CA-8 | `src/lib/cac.test.ts` |
| U-4 | `/metrics` usa la opción estricta; rótulos de §9; pistas enlazadas | CA-9, CA-10 | `src/components/segment-coverage.test.tsx`, `src/components/metrics/hints.test.tsx` |

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- **Opción estricta, no cambio de valor por defecto.** Un parámetro opcional (`{ strict: true }`) en las funciones de A2-A5. Sin él, salida idéntica a hoy (CA-11). Solo los componentes que se montan en `/metrics` lo pasan: `segment-coverage.tsx` (montado solo en `metrics.tsx:286`), `cac-panel.tsx`, `pipeline-board-panel.tsx`. Alternativa descartada: copiar las funciones para `/metrics` (dos verdades que divergen).
- **Campos nuevos aditivos.** `acvSource` admite `"sin_dato"`; `payback.missing: "acv" | "margen" | "cac" | null`; `inferredDeals: number`; `SegmentCac.sharedBasis: "clientes" | "partes_iguales" | null` y un total `unassignedShared`. Los consumidores de `/strategy` no los leen.
- **Regla de filtro.** Embudo: deals con `created_at` en T (la cohorte que entra). Perdidos: `stage = "lost"` y `closed_at ?? updated_at` en T, la misma regla que `metrics.tsx:138`. Hacerlo en `metrics.tsx` antes de llamar a `RevopsFunnel`/`RevopsLost`, sin tocar `src/lib/revops.ts` (portado y probado).
- **KPI trimestral de empresa** (`quarter-kpis-panel.tsx`): su payback viene de `quarterlyBudget` (`src/lib/quarter-kpis.ts:62`), compartido con `/strategy`. [Por verificar] si allí también entra el margen del 100 % por defecto; si entra, la misma opción estricta se pasa desde `quarter-kpis.ts` (que solo usa `/metrics`) o se rotula. El gate lo confirma antes del brief.
- **Colisión con SDD-C (NK-0051):** los dos tocan `metrics.tsx` y `src/components/metrics/*`. Contrato: SDD-A cambia datos y textos; SDD-C cambia clases y estructura visual. Orden propuesto: A se integra antes que C.

## 14. Riesgos y dependencias
- Cambiar win rate al trimestre puede hacer que un trimestre con pocos cerrados muestre porcentajes volátiles. Mitigación: se muestran los recuentos (`3G/1P`, ya en `metrics.tsx:332`).
- La opción estricta añade una rama más en funciones ya cargadas de casos. Mitigación: CA-11 cubre la rama por defecto.
- NK-0029 añadirá un canal de adquisición; «Sin fuente» se refiere al canal de entrada actual (`deals.source`) y no lo sustituye.

## 15. Preguntas para Fede y para la revisión técnica
1. **Cohortes y Tendencias:** propongo dejar su ventana y decirla (CA-2). Alternativa: ocultar el selector de trimestre en esas secciones. ¿Cuál?
2. **Win rate al trimestre (CA-3):** ¿de acuerdo, o prefieres «histórico» rotulado como tal?
3. **Reparto del compartido por clientes ganados:** está declarado y se mantiene. ¿Lo das por bueno o también lo quieres «sin repartir»?
4. **`advisor.ts:81`** alimenta al asesor y al agente con el mismo «sin fuente = Outbound». ¿Lo abro como ticket aparte (bug de datos que llega a la IA)?
5. **Unificar CAC y payback** (4 y 2 fórmulas): ¿SDD propio en Sprint 2, una vez se descongele `/strategy`?

## 16. Pendiente de verificar
- Cuántos deals cerrados no tienen `closed_at`, cuántos no tienen `source` y cuántos no tienen `segment_id`: datos reales de producción (no consultados).
- Si el payback de `quarterlyBudget` usa el margen del 100 % por defecto: lectura de `src/lib/segment-budget.ts:113-140` por el gate.
- Que `segment-coverage.tsx` no se monta fuera de `/metrics`: comprobado por búsqueda de `<SegmentCoverage` (solo `metrics.tsx:286`); el gate lo repite.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
- Veredicto del gate: No revisado
- CA sin prueba posible o sin G-n: —
- [Por verificar] que sigue sin comprobarse: —
- Contradicciones con el código o con decisiones previas: —
- Lo que esta revisión NO demuestra: —

## 18. Delta de implementación (lo rellena el agente al entregar)
—
