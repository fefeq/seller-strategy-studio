# SDD-20261106-metrics-honest-data · [Mejora] Métricas con datos honestos: el trimestre filtra y cada supuesto se ve

**Tipo:** Mejora · **Prioridad propuesta:** Alta
**Estado:** Aprobado por Fede el 2026-11-06 (v4; «OK a todo» en el chat, tras tres pasadas del gate) · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-11-06
**Ticket:** NK-0068
**PRD:** No aplica (mejora acotada de una pantalla, sin esquema nuevo) · **Depende de:** — · **Coordinar con:** NK-0051 / `SDD-20261106-ux-metrics-data-state` (SDD-C2: pone la forma visual, `DataState`, a las palabras que fija este SDD); `SDD-20261106-ux-core-screens-pattern` (SDD-C1: estados de carga y error de `/metrics`); NK-0029 / `SDD-20261030-gtm-control-tower-3-attribution-metrics` (aprobado; su CA-18 documenta las fórmulas vivas de CAC, payback y win rate: hoy hay tres ventanas de win rate, ver §14); `SDD-20261030-gtm-control-tower-5c-assistant-server` (CA-1: el asistente y MCP leen las mismas funciones; con este SDD su salida no cambia, CA-12); PR #76 de Plays (toca `src/lib/headlines.ts`, que este SDD no toca)

> **Renumeración (2026-11-08):** los tickets del sprint usan la numeración de `main` (reservada en la PR #111): A = NK-0068, B = NK-0067, D = NK-0087, C1 = NK-0088, C2 = NK-0089 (ampliaciones de NK-0051, ya entregado en PR #91), bug falso rechazado = NK-0090, seguimientos, Sprint 2 y hallazgos previos = NK-0091 a NK-0103. Fuera del §17 este documento ya usa la numeración nueva; los informes del gate del §17 son copias literales y conservan la numeración con la que se escribieron (primera: NK-0066→0090, 0067→0068, 0068→0067, 0069→0087, 0070…0075→0091…0096). Ramas, briefs y evidencias anteriores conservan los nombres de rama originales.

> Sprint 1 de mejoras en pantallas core, bloque A. Rehecho el 2026-11-06 tras perderse la versión anterior (no llegó a subirse).

## 1. Resumen
`/metrics` presenta como reales cifras que se apoyan en supuestos del código: deals sin origen sumados a «Outbound», ACV de `mínimo × 1,5`, payback con margen del 100 % cuando falta el margen, coste compartido repartido a partes iguales cuando nadie ganó y la media de márgenes objetivo usada como margen. Además, el trimestre no filtra Embudo, Perdidos ni los win rates. Este cambio hace que el trimestre filtre lo que parece filtrar y que cada cifra diga de dónde sale con una de tres marcas («Real · origen», «Estimado · motivo», «Sin dato · motivo»), **sin cambiar ninguna cifra calculada por las funciones compartidas**, de modo que `/metrics`, `/strategy`, el asistente y MCP sigan dando el mismo número.

## 2. Problema y para quién
Owner y Sales Leader deciden presupuesto, cuota y canal con números que la pantalla presenta como reales y en parte son supuestos. El problema es que los supuestos no se ven.

## 3. Evidencia y por qué ahora
Leído en `main` @ `f76f639` (el código de la rama no cambia respecto a esa base) y revisado por el gate en dos pasadas (§17).

**El trimestre no filtra**
- `src/routes/_authenticated/metrics.tsx:231-246`: Embudo y Perdidos reciben `data.deals` y `data.history` completos; el `quarter` del selector (`:93`, `:200-211`) no se les pasa. Con el filtro, sus vacíos actuales dirían algo falso: «Aún no hay deals. El embudo aparece al crear el primero.» (`src/components/metrics/revops-panels.tsx:26`) y «Ningún deal perdido todavía.» (`:53`).
- Cohortes usa todo el histórico (`revops-panels.tsx:77-78`, `src/lib/revops.ts:94`) sin decirlo. Tendencias ya rotula «Últimas 12 semanas» (`revops-panels.tsx:99`), pero no dice que no depende del trimestre.
- `metrics.tsx:147-155`, `:173-176`: win rate por origen, por rep y global con todos los cerrados de la historia; la pista del KPI (`:280`) habla de «deals creados este trimestre». Sin cerrados, el KPI muestra 0 % (`winRate` devuelve 0 con total 0, `src/lib/metrics.ts:52-55`): un cero que parece medido.
- El panel se titula «Win rate por fuente» (`metrics.tsx:320`), mientras el resto de `/metrics` dice «origen» (`revops-panels.tsx:9`, `:68`).

**Supuestos que la pantalla no dice**
| # | Dónde se calcula | Dónde se ve en `/metrics` | Qué hace |
|---|---|---|---|
| A1 | `metrics.tsx:163` (local) | Rendimiento › Win rate por fuente | `d.source ?? "outbound"`: un deal sin origen suma a «Outbound». En Perdidos y Cohortes el mismo caso ya se rotula «Sin origen» (`revops-panels.tsx:9`). |
| A2 | `src/lib/segment-coverage.ts:22-26` (`assignSegment`) → `src/lib/metrics.ts:25` (`matchSegment`) | Cobertura: todas las cifras de la tarjeta salen de los deals asignados (`segment-coverage.ts:39`), y también el margen «de los deals ganados» (`src/lib/deal-lines.ts:106` → `src/components/segment-coverage.tsx:128`); CAC real («Deals ganados», `src/components/cac-panel.tsx:202`); Presupuesto por segmento (clientes y CAC, `src/lib/segment-budget.ts:120-124`) | Un deal con `segment_id` null, o que apunta a un segmento que ya no existe (`segment-coverage.ts:23`), se asigna por importe sin decirlo. `won-deals-panel.tsx` ya lo rotula «Automático (…)» (`won-deals.ts:23`, `:34`). |
| A3 | `src/lib/cac.ts:29` (`segmentCac`) | CAC real (`cac-panel.tsx:200-201`); Presupuesto por segmento («Gasto de captación», `src/components/budget-panel.tsx:82`, vía `segment-budget.ts:124`, `:151`) | Si nadie ganó en el trimestre, el compartido se reparte a partes iguales. El CAC ya es null en ese caso (`cac.ts:31`); cambian «+ Compartido asignado», «Coste total» y el gasto por segmento. El total de empresa no depende del reparto (`quarter-kpis.ts:39`). |
| A4 | `segment-coverage.ts:9-19` (`segmentAcv`) | Cobertura (`segment-coverage.tsx:93`); Presupuesto por segmento (`segment-budget.ts:128`) | Sin ganados ni abiertos con importe: punto medio del rango, o `acv_min × 1.5` si no hay máximo (`:17`); sin rango, 0. Los tres casos devuelven `source: "rango"` (`:18`) y se rotulan «punto medio del rango» (`segment-coverage.tsx:17`). De ese ACV salen deals objetivo (`segment-coverage.ts:49`), oportunidades objetivo (`:50`) y payback (`:56`). |
| A5 | `metrics.ts:40` (`capacityPlan`, `grossMarginPct ?? 100`) | Cobertura (`segment-coverage.tsx:121`; sin margen no se dice nada, `:125-130`); CAC real («Payback real», `cac-panel.tsx:205-210`); Presupuesto por segmento (`budget-panel.tsx:78` muestra «margen en el payback: —» junto a un payback al 100 % en `:85`, vía `segment-budget.ts:136`, `:141-143`); KPI trimestral de empresa (`quarter-kpis.ts:49`, `quarter-kpis-panel.tsx:57`, `:83`) | Sin margen, payback como si el margen fuera 100 %. Con margen 0 sale `Infinity` y con margen negativo un payback negativo (`metrics.ts:40-41`), que además se pinta en verde: `payback.ok` y `realOk` salen `true` (`segment-coverage.ts:67` → `segment-coverage.tsx:121`; `segment-budget.ts:157` → `budget-panel.tsx:88`; `cac-panel.tsx:208`). `weightedPayback` mezcla esos valores en la media del KPI (`quarter-kpis.ts:25-29`, `:49`) y el resultado puede ser finito y positivo. |
| A6 | `src/components/pipeline-board-panel.tsx:47-49` (local) | Rendimiento › tablero («margen X %», `:96`) | Cadena de margen: real de las cuentas → deals con líneas → plan → media sin ponderar de los márgenes objetivo de los segmentos; el resultado se rotula solo «margen». Con margen ≤ 0, el payback del tablero sale `Infinity` o negativo (`src/lib/pipeline-board.ts:94`, `:95`). |
| A7 | `src/lib/pipeline-real.ts:30`, `:37-44` (`actuals`) | Rendimiento › tablero («ACV real», `pipeline-board-panel.tsx:96`; win rate, `:90`) | «ACV real» puede ser la media de deals abiertos (`acvSource: "abiertos"`, `pipeline-real.ts:44`); el win rate es de 365 días dentro de un panel trimestral, sin ventana visible. |

**Pistas que llevan a ninguna parte**
- `src/components/quarter-kpis-panel.tsx:123`: «costes en «CAC real» (más abajo)»: está en Resumen; «CAC real» vive en «CAC y presupuesto» (`metrics.tsx:289-291`).
- `quarter-kpis-panel.tsx:76`: «Presupuesto vs real» enlaza a `/strategy` sin `tab`, y abre «Modelos de venta» (`src/routes/_authenticated/strategy.tsx:47`); «CAC real» en la misma línea, sin enlace.
- `pipeline-board-panel.tsx:84`: «Apúntalo en «CAC real», más abajo», desde Rendimiento.
- `segment-coverage.tsx:128` («Presupuesto por segmento», que se apunta en `/strategy?tab=budget`, `budget-panel.tsx:44-45`), `:136`, `:137` («CAC real»): texto sin enlace.
- `metrics.tsx:258`: «Define cuotas abajo» en Resumen; el panel de cuotas está en Rendimiento (`:370`).
- `budget-panel.tsx:45`: «Estrategia GTM → Presupuesto vs real» enlaza a `/strategy` sin `tab` y abre «Modelos de venta» (`strategy.tsx:47`).
- Se queda como está: «Añade facturas abajo» (`src/components/metrics/finance-panel.tsx:67`), porque las facturas están en el mismo panel.

**Código compartido** (`/strategy` está congelada en este sprint)
Consumidores fuera de `/metrics` de las funciones afectadas: `src/components/strategy/motions.tsx`, `payback-quarters.tsx`, `budget-quarters.tsx` (pestañas de `strategy.tsx:59-68`), `src/lib/funnel-diagnosis.ts:122` (Diagnóstico), `payback-card.tsx` (Inicio, `home.tsx:80`), `src/lib/pipeline-real.ts:77`, y de `assignSegment`: `won-deals.ts:22`, `deal-lines.ts:106`, `stale.ts:43`, `proactive/detectors/strategy-segments.ts:37,61`. Herramientas MCP (asistente): `realMetrics` (`get_real_metrics`, `src/lib/mcp/tools/metrics.ts:13`) y `segmentCoverageTool` (`get_segment_coverage`, `:34`). La segunda pasa objetos enteros: `won`, `opps` y `winRate` de la fila (`:61`), `plan` y `actual` de `budget_quarter` y `budget_year` (`:65`, `:67`) y `{...r.payback}` (`:66`); de `cac` elige campos uno a uno (`:62`). `quarter-kpis.ts:2` promete en un comentario que Métricas muestra «las mismas cifras que Estrategia GTM → Presupuesto vs real».

**Fuera de este SDD (listadas para no perderlas):** A8 `revops.ts:26-27` (etapa desconocida cuenta como la primera; perdido sin transición se imputa a la primera o a la más avanzada, y llega al titular de Perdidos, `revops-panels.tsx:64,66`); A9 `metrics.tsx:111-115`, `:165` (deals de ex miembros salen como «Sin asignar»). Ver §15.

**Uso:** sin dato (no hay analítica de `/metrics`).

## 4. Resultado buscado
- Supuestos sin marca en `/metrics`: línea base medida en código, 7 (A1-A7). Objetivo: 0.
- Sitios de `/metrics` donde un margen ≤ 0 da `Infinity`, un payback negativo o un tono verde: línea base 5 (Cobertura, CAC real, Presupuesto por segmento, KPI trimestral, tablero). Objetivo: 0.
- Secciones que parecen depender del trimestre y no dependen, sin decirlo: línea base 3 (Embudo, Perdidos, Cohortes) + win rates. Objetivo: 0.
- Pistas de `/metrics` que mandan a otra sección con «abajo» o sin enlace: línea base 9 (§3). Objetivo: 0.
- Cifras de las funciones compartidas que cambian, y diferencias en la salida de MCP: objetivo 0 (CA-12).
- Uso o satisfacción: sin dato.

## 5. Alcance
**Incluye:**
- Embudo y Perdidos filtrados por el trimestre, con sus textos de vacío del trimestre; Cohortes y Tendencias con su ventana dicha.
- Win rate global, por origen y por rep del trimestre seleccionado, extraídos a `src/components/metrics/performance-panels.tsx`; el panel pasa a llamarse «Win rate por origen».
- A1 corregido (es local a `/metrics`): «Sin origen».
- A2-A7 marcados en `/metrics` con «Real · origen», «Estimado · motivo» o «Sin dato · motivo», a partir de **campos nuevos aditivos en el nivel superior** de lo que devuelven las funciones compartidas (§13); ningún valor existente cambia.
- Payback con margen 0 o negativo: en `/metrics` se muestra «Sin dato · margen 0 % o negativo», en tono neutro (las funciones siguen devolviendo lo mismo).
- Pistas de `/metrics` como enlace a su destino correcto.

**No incluye:**
- Cambiar ninguna cifra que devuelvan `capacityPlan`, `matchSegment`, `assignSegment`, `segmentAcv`, `segmentCoverage`, `paybackByQuarter`, `segmentBudget`, `quarterlyBudget`, `quarterKpis`, `wonDealsMargin`, `segmentCac`, `actuals`, `pipelineEconomics` o `funnelDiagnosis`.
- Cualquier cambio en `/strategy`, Inicio o el asistente, y cualquier cambio en la salida de las herramientas MCP `get_real_metrics` y `get_segment_coverage` (CA-12 la compara sin quitar nada).
- Contar aparte qué deals del margen por segmento «de deals con líneas» (`deal-lines.ts:106`) se asignaron por importe: son un subconjunto de los M deals de la tarjeta, y la marca de tarjeta de CA-5 ya lo dice.
- Pasar los supuestos a «Sin dato» en todas las superficies, y unificar las fórmulas de CAC y payback (§15, pregunta 1).
- `src/lib/advisor.ts:81` y A8-A9 (§15, pregunta 4).
- Estados de carga y error de `/metrics` (SDD-C1) y forma visual de las marcas (`DataState`, SDD-C2).
- Canal de adquisición y diccionario de métricas (NK-0029).
- `src/lib/headlines.ts`, `src/lib/nav.ts` (PR #76).
- Esquema, migraciones, RLS.

## 6. Cambios de comportamiento (delta)
**Añadido (solo en `/metrics`):**
- «Sin origen» en win rate por origen.
- «Estimado · N de M deals asignados por importe» (tarjeta de Cobertura) y «Estimado · N de M asignados por importe» (Deals ganados de CAC real; clientes de Presupuesto por segmento).
- ACV: «Real · media de ganados», «Estimado · media de deals abiertos», «Estimado · punto medio del rango», «Estimado · mínimo del rango × 1,5», «Sin dato · falta rango de ACV».
- Margen: «Real · de las cuentas», «Real · de deals con líneas», «Estimado · margen de plan», «Estimado · margen objetivo», «Estimado · media de márgenes objetivo», «Estimado · margen del 100 % supuesto (falta margen)».
- Compartido: «Estimado · repartido a partes iguales (nadie ganó)».
- Win rate del tablero: «Últimos 365 días».
- «Todo el histórico · no depende del trimestre» en Cohortes; «Últimas 12 semanas · no depende del trimestre» en Tendencias.
- Vacíos con trimestre: «Sin deals creados en {T}» (Embudo), «Ningún deal perdido en {T}» (Perdidos), «Sin deals cerrados en {T}» (paneles de win rate).

**Modificado:**
- Embudo y Perdidos → del trimestre.
- Win rates → del trimestre; pista del KPI «{n} cerrados en {T}»; sin cerrados, el KPI muestra «—» con «Sin dato · sin deals cerrados en {T}» en vez de «0 %».
- «Win rate por fuente» → «Win rate por origen».
- Payback con margen ≤ 0 → «Sin dato · margen 0 % o negativo», en tono neutro (nunca verde).
- KPI trimestral de payback → marca según los segmentos que entran en su media (CA-7).
- Pistas → enlaces.

**Eliminado:** el supuesto «sin origen = Outbound» en `/metrics`; los «más abajo» y «abajo» que mandan a otra sección.

## 7. Historias y criterios de aceptación
Forma de las marcas (CA-10): exactamente tres estados, «Real» con origen opcional («Real · origen»), «Estimado · motivo» y «Sin dato · motivo». Un «—» que significa «no aplica» no es una marca. Hasta que C2 entregue `DataState`, A las pinta con un envoltorio mínimo que lleva el atributo `data-mark` (§13).

### H-1: Como Owner o Sales Leader, quiero que el trimestre que elijo filtre lo que parece filtrar, para comparar trimestres sin mezclar periodos.
- **CA-1** Con el trimestre T, Embudo cuenta solo deals con `created_at` en T (y su historial), y Perdidos solo deals perdidos con `closed_at ?? updated_at` en T. Sin deals, Embudo dice «Sin deals creados en {T}» y Perdidos «Ningún deal perdido en {T}». · prueba: `src/lib/metrics-quarter.test.ts` (filtro) y `src/components/metrics/revops-panels.test.tsx` (textos)
- **CA-2** Cohortes muestra «Todo el histórico · no depende del trimestre» y Tendencias «Últimas 12 semanas · no depende del trimestre». · prueba: `src/components/metrics/revops-panels.test.tsx`
- **CA-3** Win rate global, por origen y por rep cuentan solo deals cerrados (`closed_at ?? updated_at`) en T. La pista del KPI global dice «{n} cerrados en {T}». Sin cerrados en T, el KPI muestra «—» con «Sin dato · sin deals cerrados en {T}», nunca «0 %», y cada panel dice «Sin deals cerrados en {T}». El panel se titula «Win rate por origen». · prueba: `src/lib/metrics-quarter.test.ts` (cálculo) y `src/components/metrics/performance-panels.test.tsx` (textos)

### H-2: Como Owner o Sales Leader, quiero ver qué cifra se apoya en un supuesto, para no decidir sobre él sin saberlo.
- **CA-4** Un deal con `source` null cuenta en «Sin origen», nunca en «Outbound». · prueba: `src/lib/metrics-quarter.test.ts` y `src/components/metrics/performance-panels.test.tsx`
- **CA-5** «Asignado por importe» = deal con `segment_id` null o que apunta a un segmento que no existe (la regla de `won-deals.ts:23`). Cada fila de `segmentCoverage` devuelve `assignedDeals` (M: todos los deals asignados al segmento, los mismos de `segment-coverage.ts:39`, de los que salen todas las cifras de la tarjeta) e `inferredDeals` (N, los de M asignados por importe), y además `wonInQuarter` e `inferredWon` (ganados en T, los de `:36`). La tarjeta de Cobertura muestra una sola marca, bajo el nombre del segmento: «Estimado · N de M deals asignados por importe» cuando N > 0. La fila «Deals ganados» de CAC real muestra «Estimado · N de M asignados por importe» en la celda del segmento cuando `inferredWon` > 0. Las filas de `segmentBudget` devuelven los mismos `wonInQuarter`/`inferredWon` del periodo y la celda CAC de Presupuesto por segmento lleva la misma marca. · prueba: `src/lib/segment-coverage.test.ts`, `src/lib/segment-budget.test.ts`, `src/components/segment-coverage.test.tsx`, `src/components/cac-panel.test.tsx`, `src/components/budget-panel.test.tsx`
- **CA-6** Las filas de `segmentCoverage` y de `segmentBudget` devuelven `acvSource` (`"ganados" | "abiertos" | "rango"`, el valor que ya da `segmentAcv`, `segment-coverage.ts:18`) y `acvRangeBasis` (`"punto_medio" | "minimo_x1_5" | "sin_rango"` cuando `acvSource` es `"rango"`; null en otro caso). Cobertura (junto al ACV, `segment-coverage.tsx:93`) y Presupuesto por segmento (en la celda Payback) rotulan: ganados → «Real · media de ganados»; abiertos → «Estimado · media de deals abiertos»; punto_medio → «Estimado · punto medio del rango»; minimo_x1_5 → «Estimado · mínimo del rango × 1,5»; sin_rango → «Sin dato · falta rango de ACV». · prueba: `src/lib/segment-coverage.test.ts`, `src/lib/segment-budget.test.ts`, `src/components/segment-coverage.test.tsx`, `src/components/budget-panel.test.tsx`
- **CA-7** `capacityPlan` devuelve además `marginAssumed` (margen null) y `marginNonPositive` (margen ≤ 0). Las filas de `segmentCoverage` devuelven `paybackMarginBasis` y las de `segmentBudget` `paybackMarginBasis: { plan, actual }`, con valores `"dato" | "supuesto_100" | "no_positivo" | null` (null si no hay payback). `quarterKpis` devuelve `paybackBasis: { plan, actual }` con `"dato" | "estimado" | "sin_dato" | null`, calculado sobre los segmentos que entran en `weightedPayback` (payback no null y clientes > 0): `"sin_dato"` si alguno es `no_positivo`; `"estimado"` si alguno es `supuesto_100` o tiene `acvSource` `"rango"`. En pantalla:
  - `supuesto_100` → «Estimado · margen del 100 % supuesto (falta margen)» junto al payback, en Cobertura, CAC real («Payback real»), Presupuesto por segmento y el KPI trimestral.
  - `no_positivo` → la cifra se sustituye por «Sin dato · margen 0 % o negativo», en tono neutro (ni verde ni rojo), en Cobertura (`segment-coverage.tsx:121`), CAC real (`cac-panel.tsx:207-208`), Presupuesto por segmento (`budget-panel.tsx:85-88`) y el tablero (`pipeline-board-panel.tsx:95`, con el `marginNonPositive` de `boardMargin`, §13).
  - KPI trimestral (`quarter-kpis-panel.tsx:57`, `:83`): `"sin_dato"` → «—» con «Sin dato · un segmento tiene margen 0 % o negativo»; `"estimado"` → la cifra con «Estimado · supuestos en algún segmento (ver Cobertura)».
  - Nunca se ve «Infinity» ni un payback negativo en `/metrics`.
  · prueba: `src/lib/metrics.test.ts`, `src/lib/segment-coverage.test.ts`, `src/lib/segment-budget.test.ts`, `src/lib/quarter-kpis.test.ts`, `src/components/segment-coverage.test.tsx`, `src/components/cac-panel.test.tsx`, `src/components/budget-panel.test.tsx`, `src/components/quarter-kpis-panel.test.tsx`, `src/components/pipeline-board-panel.test.tsx`
- **CA-8** `sharedSplitBasis(costs, customersBySegment, segmentIds)` (nueva, en `cac.ts`) devuelve `"clientes"`, `"partes_iguales"` o null (sin compartido) con la misma regla de `cac.ts:29`; `segmentCac` no cambia. Las filas de `segmentCoverage` y de `segmentBudget` lo devuelven como `sharedSplit`. Con `"partes_iguales"`, CAC real marca «+ Compartido asignado» y «Coste total» (`cac-panel.tsx:200-201`) y Presupuesto por segmento marca «Gasto de captación» (`budget-panel.tsx:82`) con «Estimado · repartido a partes iguales (nadie ganó)». El total de empresa (`quarter-kpis.ts:39`, «coste total» de `cac-panel.tsx:151`) no cambia. · prueba: `src/lib/cac.test.ts`, `src/components/cac-panel.test.tsx`, `src/components/budget-panel.test.tsx`
- **CA-9** El tablero de Rendimiento marca el margen según `boardMargin(...).source` (§13): real → «Real · de las cuentas»; deals → «Real · de deals con líneas»; plan → «Estimado · margen de plan»; media_objetivos → «Estimado · media de márgenes objetivo». Marca el ACV según `actuals(...).acvSource` (`pipeline-real.ts:44`): ganados → «Real · media de ganados»; abiertos → «Estimado · media de deals abiertos». Su win rate lleva «Últimos 365 días». `boardMargin` devuelve el mismo `pct` que la cadena actual (`pipeline-board-panel.tsx:47-49`). · prueba: `src/lib/pipeline-board.test.ts` y `src/components/pipeline-board-panel.test.tsx`
- **CA-10** Cada marca que añade este SDD en `/metrics` lleva `data-mark` y su texto cumple exactamente `^(Real( · .+)?|Estimado · .+|Sin dato · .+)$`. · prueba: `src/test/data-marks.ts` (comprobación compartida) llamada desde cada test de componente de CA-3 a CA-9; falla primero porque en la base no hay ningún `[data-mark]` y la comprobación exige al menos uno por test.

### H-3: Como Owner o Sales Leader, quiero que una pista me lleve a donde se arregla.
- **CA-11** «CAC real» → `/metrics?seccion=economia`; «Presupuesto por segmento» y «Presupuesto vs real» (incluido `budget-panel.tsx:45`) → `/strategy?tab=budget`; «Define cuotas» → `/metrics?seccion=rendimiento`. Las pistas de la lista cerrada del §3 son enlaces con ese destino, y ningún texto de `/metrics` dice «más abajo», «más arriba» o «abajo» para referirse a otra sección («Añade facturas abajo», misma sección, queda fuera). · prueba: `src/components/metrics/hints.test.tsx`

### H-4: Como Fede, quiero que nada fuera de `/metrics` cambie en este sprint.
- **CA-12** Con un conjunto fijo de datos ficticios que recorre A2-A7 y el margen ≤ 0:
  - las funciones de la primera línea de §5 «No incluye» devuelven lo mismo que en `f76f639` una vez quitados solo los campos nuevos de la lista cerrada del §13;
  - los handlers MCP `realMetrics` (`get_real_metrics`) y `segmentCoverageTool` (`get_segment_coverage`) de `src/lib/mcp/tools/metrics.ts`, con `mcpCtx` simulado sobre esos datos, devuelven exactamente lo mismo que en `f76f639`, sin quitar nada (`toStrictEqual`);
  - los tests existentes de esos módulos pasan sin cambios.
  La prueba guarda evidencia de que falla si se altera un valor existente (mutación 1: `?? 100` → `?? 50` en `metrics.ts:40`) y si un campo nuevo cae dentro de un objeto que MCP pasa entero (mutación 2: añadir `paybackMarginBasis` dentro de `payback`). · prueba: `src/lib/strategy-freeze.test.ts`

## 8. Casos límite y errores
- Trimestre sin deals: textos de vacío del trimestre (CA-1 para Embudo y Perdidos; CA-3 para win rates), no ceros que parezcan medidos.
- Deal cerrado sin `closed_at`: se usa `updated_at`, la regla vigente (`metrics.tsx:138`). [Por verificar] cuántos hay: producción.
- Segmento sin `acv_min` ni `acv_max` y sin deals con importe: hoy ACV 0 (`segment-coverage.ts:15-17`); se rotula «Sin dato · falta rango de ACV» (CA-6).
- Margen 0 o negativo: CA-7, en los cinco sitios del §4.
- Compartido con clientes en algún segmento: reparto por clientes, ya declarado en el panel (`cac-panel.tsx:146`); no lleva marca nueva.
- Deal que apunta a un segmento borrado: cuenta como asignado por importe (CA-5).
- Multitenant: sin consultas nuevas; las funciones nuevas son puras.
- Carga y error de `/metrics`: SDD-C1.

## 9. Experiencia y copy
- Textos de §6. Español, «tú», sin iconos; la palabra lleva el estado.
- A pone las palabras de cada marca; C2 pone la forma visual (`DataState`, su U-2) y la aplica sin cambiar las palabras ni quitar `data-mark`.
- «Sin origen» (el rótulo que ya usa `/metrics`), no «Sin fuente».
- Los textos de vacío de Embudo, Perdidos y win rates con trimestre son de A porque dependen del filtro de A; el estado de carga y error de `/metrics` es de C1.

## 10. Datos, permisos y privacidad
Sin tablas, columnas, RLS ni GRANT nuevos. Mismas consultas. Tests con datos ficticios. Finanzas sigue solo para Owner y Sales Leader (`metrics.tsx:218`, `:405-412`).

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| ninguna | — | — | — |

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-0 | Red de congelación: fixture ficticia, salida de las funciones compartidas y de los handlers `realMetrics` y `segmentCoverageTool` en `f76f639`, mutaciones 1 y 2 con evidencia | CA-12 | `src/lib/strategy-freeze.test.ts` (pasa en base a propósito; su fallo-primero son las dos mutaciones, con evidencia guardada) |
| U-1 | `src/lib/metrics-quarter.ts` puro: `funnelInQuarter`, `lostInQuarter`, `quarterWinRates` (global, por origen con «—» para null, por rep); `metrics.tsx` lo usa | CA-1 (filtro), CA-3 (cálculo), CA-4 | `src/lib/metrics-quarter.test.ts` |
| U-2 | Extrae `src/components/metrics/performance-panels.tsx` (toda la fila de KPI de Resumen, `metrics.tsx:251-282`, para que `hints.test.tsx` pinte también «Define cuotas abajo» de `:258`, y paneles de `:320-351`, con `Kpi`, `Panel`, `Bar` y `Muted` de `:425-460`, sin cambiar su marcado); textos de win rate; vacíos y ventanas de `revops-panels.tsx`; envoltorio `DataMark` y la comprobación `src/test/data-marks.ts` | CA-1 (textos), CA-2, CA-3 (textos), CA-4 (pantalla), CA-10 | `src/components/metrics/performance-panels.test.tsx`, `src/components/metrics/revops-panels.test.tsx` |
| U-3 | Campos aditivos de nivel superior (lista cerrada del §13) y `sharedSplitBasis`, `boardMargin` | CA-5 a CA-9 (parte pura) | `src/lib/segment-coverage.test.ts`, `src/lib/segment-budget.test.ts`, `src/lib/metrics.test.ts`, `src/lib/cac.test.ts`, `src/lib/quarter-kpis.test.ts`, `src/lib/pipeline-board.test.ts` |
| U-4 | Marcas en Cobertura, CAC real, Presupuesto por segmento, KPI trimestral y tablero; tono neutro con margen ≤ 0; pistas enlazadas | CA-5 a CA-9 (pantalla), CA-11 | `src/components/segment-coverage.test.tsx`, `src/components/cac-panel.test.tsx`, `src/components/budget-panel.test.tsx`, `src/components/quarter-kpis-panel.test.tsx`, `src/components/pipeline-board-panel.test.tsx`, `src/components/metrics/hints.test.tsx` |

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- **Rotular, no recalcular.** Lista cerrada de campos nuevos, todos en el **nivel superior** de lo que devuelve cada función; nunca dentro de `payback`, `won`, `opps`, `winRate`, `cac`, `plan` o `actual` (los objetos que MCP pasa enteros o parcialmente, `mcp/tools/metrics.ts:61-67`):
  - `segmentAcv` → `rangeBasis: "punto_medio" | "minimo_x1_5" | "sin_rango" | null` (`source` ya existe, `segment-coverage.ts:12-18`; solo hace falta separar `"rango"`: `"sin_rango"` si el ACV resultante es 0, `"minimo_x1_5"` si no hay `acv_max`, `"punto_medio"` en otro caso).
  - `capacityPlan` → `marginAssumed: boolean`, `marginNonPositive: boolean`.
  - filas de `segmentCoverage` → `acvRangeBasis` (`acvSource` ya existe, `:59`), `assignedDeals`, `inferredDeals`, `wonInQuarter`, `inferredWon`, `paybackMarginBasis`, `sharedSplit`.
  - filas de `periodBudget` (y por tanto de `segmentBudget` y `quarterlyBudget`) → `acvSource`, `acvRangeBasis`, `wonInQuarter`, `inferredWon`, `paybackMarginBasis: { plan, actual }`, `sharedSplit`.
  - `quarterKpis` / `kpiTotals` → `paybackBasis: { plan, actual }`.
  - `actuals` → nada nuevo: `acvSource` ya existe (`pipeline-real.ts:10`, `:44`).
  - Funciones nuevas: `sharedSplitBasis` (`cac.ts`), `boardMargin(k, wonAll, segments) → { pct, source: "real" | "deals" | "plan" | "media_objetivos" | null, marginNonPositive }` (`pipeline-board.ts`, mueve la cadena de `pipeline-board-panel.tsx:47-49` sin cambiar el valor), `funnelInQuarter`, `lostInQuarter`, `quarterWinRates` (`src/lib/metrics-quarter.ts`).
  - Ningún campo existente cambia de valor ni de tipo (CA-12).
- **Por qué no la opción estricta:** cambiaría cifras solo en `/metrics` y rompería la coincidencia con `/strategy`, el asistente y MCP (`quarter-kpis.ts:2`, `segment-coverage.ts:1`, `cac.ts:1`, `segment-budget.ts:3`; SDD 5c CA-1). Queda para cuando `/strategy` se descongele (§15, pregunta 1).
- **Filtro trimestral:** en `src/lib/metrics-quarter.ts`, antes de llamar a `RevopsFunnel`/`RevopsLost` (`revops.ts:48`, `:74`), sin tocar `src/lib/revops.ts` (portado y probado). `RevopsFunnel` y `RevopsLost` reciben `quarter` solo para el texto de vacío.
- **Margen ≤ 0 y tono:** el valor no cambia; la pantalla lee `paybackMarginBasis` / `marginNonPositive` y no aplica `payback.ok` ni `realOk` cuando es `"no_positivo"`.
- **Envoltorio mínimo:** `DataMark({ state: "real" | "estimado" | "sin_dato", reason? })` en `src/components/metrics/data-mark.tsx`, que pinta la palabra y « · motivo» dentro de un `<span data-mark={state}>`. C2 lo sustituye o lo hace delegar en `DataState`, sin cambiar textos ni el atributo.
- **Tests de componente:** jsdom y Testing Library ya están configurados (`vitest.config.ts:8`); patrón de mocks en `src/components/strategy-screens.test.tsx:12-41`. Ningún test en `src/routes/` (el generador de rutas lo tomaría por ruta). Los paneles de win rate se prueban en `performance-panels.test.tsx`, no a través de la ruta.
- **Test MCP de CA-12:** `vi.mock("@/lib/mcp/context")` con un `mcpCtx` que devuelve una `db` falsa sobre la fixture y conserva `json`; la salida en `f76f639` queda guardada como golden en el propio test.
- **Contrato entre los SDD del sprint (el mismo texto en A, B, C1, C2 y D):** «A cambia datos y textos de datos de /metrics (las palabras de cada marca); B, la búsqueda de /hub; C1, estados de pantalla (carga, error, vacío) de /hub, /theory-u y /metrics, sección en la URL de /hub y /theory-u, vacíos y pistas de /hub y /theory-u; C2, el plegado de explicaciones en las tres pantallas y la forma visual (componente DataState) de las marcas de dato de /metrics. D toca la pantalla de /hub (`src/components/hub/` tras B) solo en los textos de la sección Reglas y de la casilla «obligatorio». Orden de integración: A → B → C1 → D → C2.»
- **Aplicación del contrato en A:** los textos de vacío de Embudo, Perdidos y win rates con trimestre (CA-1, CA-3) son «textos de datos» de A, porque solo existen con su filtro; el estado de carga y error de `/metrics` es de C1. Tras A, `Kpi`, `Panel`, `Bar` y `Muted` viven en `src/components/metrics/performance-panels.tsx`.

## 14. Riesgos y dependencias
- Win rate trimestral con pocos cerrados es volátil; se muestran los recuentos (`3G/1P`, `metrics.tsx:332`) y la pista «{n} cerrados en {T}».
- Ventanas de win rate vivas. Hoy hay tres: histórico (asesor y agente, `advisor.ts:80`; y los win rates de `/metrics`, `metrics.tsx:147-155`, `:173-176`), 365 días (`get_real_metrics` y el tablero de Rendimiento, `pipeline-real.ts:30`) y trimestre (Cobertura y `get_segment_coverage`, `segment-coverage.ts:44`, `:65`). Tras este SDD siguen siendo tres: los win rates de `/metrics` pasan del histórico al trimestre, y el histórico queda solo en el asesor. Cada una lleva su ventana dicha en `/metrics`. Se lo pasamos a NK-0029 CA-18.
- Campos aditivos en funciones ya cargadas: CA-12 protege las cifras existentes y la salida de MCP.
- Marcar un supuesto no lo corrige: el payback al 100 % sigue siendo el número. Es la decisión de este sprint (§15, pregunta 1).
- Orden de integración: A va primero. C2 debe conservar `data-mark` al aplicar `DataState`, o los tests de A dejan de encontrar las marcas.

## 15. Preguntas para Fede y para la revisión técnica
1. **Decidido por Fede (2026-11-06): rotular.** Este SDD marca los supuestos y no cambia cifras, para no romper `/strategy`, el asistente y MCP mientras `/strategy` está congelada.
   - **Pregunta abierta derivada:** ¿abrimos en Sprint 2 el cambio a «Sin dato» en todas las superficies a la vez, junto con unificar CAC y payback?
2. **Decidido por Fede (2026-11-06, «OK a todo»): Cohortes se rotula «Todo el histórico»** (CA-2).
3. **Decidido por Fede (2026-11-06): win rate del trimestre, con recuentos** (CA-3).
4. **Decidido por Fede (2026-11-06): dos tickets** — `advisor.ts:81` (NK-0091) y A8 (NK-0092); A9 sin ticket por ahora.
5. **Decidido por Fede (2026-11-06): se mantiene el comentario de `quarter-kpis.ts:2`.**

Nota: el «2 OK, 3 sí, 5 OK» de Fede del 2026-11-06 respondía a otra lista, no a estas preguntas. Por eso la 2, la 3 y la 5 siguen abiertas y los CA se escriben con la propuesta.

## 16. Pendiente de verificar
- Deals cerrados sin `closed_at`, sin `source` y sin `segment_id`, y deals que apuntan a un segmento borrado: producción.
- Paneles no leídos enteros (`LeadFunnelPanel`, `SelfServiceFunnel`, `StripeMetricsPanel`, `FinancePanel`): el gate no encontró supuestos numéricos con un grep, pero no los leyó enteros. `won-deals-panel.tsx` ya está comprobado (rotula «Automático (…)»).
- Ticket NK: SDD-A no tiene ticket en `.factory/ledger.json`. Lo decide el coordinador (`nokko-intake`) antes del brief.

**Versión 2 (2026-11-06):** reescrito tras el gate. Cambia el enfoque de «opción estricta» a «rotular sin recalcular» (objeción 1). Añade BudgetPanel (2), corrige A3 (3), añade A6-A7 y lista A8-A9 (4), mueve las pruebas a un módulo puro y a tests de componente (5), corrige Cohortes y Tendencias (6), los destinos de CA-11 (7), el margen ≤ 0 (8), CA-12 con mutación (9), los rótulos (10), las coordinaciones (11) y define M (12). Las citas del §3 se corrigen según el gate. No ha tenido segunda pasada del gate.

**Versión 4 (2026-11-06):** tercera pasada del gate: U-2 extrae toda la fila de KPI (`:251-282`) para que CA-11 pueda probar `:258`; `budget-panel.tsx:45` entra en la lista de pistas y en CA-11 (línea base 9).

**Versión 3 (2026-11-06):** corregido tras la segunda pasada del gate. Nueva 1: CA-12 nombra los handlers reales (`realMetrics`, `segmentCoverageTool`), compara la salida de MCP sin quitar nada y añade una mutación que mete un campo dentro de `payback`; los campos nuevos van en el nivel superior (§13). Nueva 2: margen ≤ 0 con tono neutro y «Sin dato» en Cobertura, CAC real (`cac-panel.tsx:207`), Presupuesto, tablero y KPI, con `marginNonPositive`, `paybackMarginBasis` y `paybackBasis` (CA-7). Nueva 3 (y parcial 2): `acvSource`/`acvRangeBasis` por fila de `periodBudget` y `budget-panel.test.tsx` en CA-5 a CA-8. Nueva 4 (y parcial 5): U-2 extrae `src/components/metrics/performance-panels.tsx` y CA-3 lo prueba. Nueva 5: vacíos del trimestre en CA-1 y CA-3, «Win rate por origen», y nota de aplicación del contrato (textos de vacío de A; carga y error de C1). Nueva 6 (y parcial 10): CA-10 con los tres estados («Real · origen», «Estimado · motivo», «Sin dato · motivo») y `data-mark`. Nueva 7 (y parcial 11): fuera `acvBasis` de `actuals`, `basis` solo separa `"rango"` (`rangeBasis`/`acvRangeBasis`), valores unificados, y §14 con las tres ventanas. Nueva 8 (y parcial 4): «asignado por importe» definido como `won-deals.ts:23`, una marca por tarjeta con M = deals asignados al segmento, margen de deals con líneas cubierto por esa marca, cita de A6 a `:47-49`. Nueva 9: §15.1 queda como decisión sin pregunta (la pregunta de Sprint 2 va aparte); la 2, 3 y 5 siguen abiertas porque el «2 OK, 3 sí, 5 OK» de Fede respondía a otra lista. Matiz de la 12: M ya no habla de «todo el histórico para el ACV». §8 sin CA: sus casos apuntan a CA-1, CA-3 y CA-6, y se quita la marca «repartido por clientes ganados». Se añade al §3 «Define cuotas abajo» (`metrics.tsx:258`) y el cero falso del KPI sin cerrados. Contrato del sprint sustituido por el texto común.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Informe de la primera pasada (sobre v1, commit `862d9c3`), copiado sin editar:

- Veredicto del gate: Objeciones
- CA sin prueba posible o sin G-n: no hay PRD, así que no exijo G-n. Tal como están escritos, estos CA no se pueden probar con el archivo que nombran:
  - **CA-1, CA-3 y CA-4.** Nombran pruebas en `src/lib/` (`revops-quarter.test.ts`, `metrics-quarter.test.ts`), pero el §13 pone el filtro y el `group` dentro de `metrics.tsx`, que es una ruta y no un módulo puro. Sin un módulo puro nuevo con nombre, esas pruebas no tienen qué importar. Además, en CA-1 y CA-3 la parte de pantalla («Sin deals cerrados en T») no se comprueba desde `src/lib`.
  - **CA-7 y CA-8.** Mezclan lógica pura y pantalla («la pantalla muestra…», «CAC real lo muestra…»), y las pruebas que nombran son de `src/lib`. La mitad de pantalla no tiene prueba.
  - **CA-2.** Se puede probar, pero lo que pide es falso para Cohortes (ver objeción 6).
  - **CA-11.** Según la regla base 5, no cuenta como prueba porque pasa sobre la base por diseño. Le falta una prueba de que detecta cambios (objeción 9).
  - **Faltan CA** para:
    - BudgetPanel: A3, A4 y A5 en «Presupuesto por segmento» (objeción 2).
    - Margen del 0 % o negativo (objeción 8).
    - Las atribuciones que el SDD no lista (objeción 4).
- [Por verificar] que sigue sin comprobarse:
  - **Sigue sin comprobarse:** cuántos deals cerrados no tienen `closed_at`, cuántos no tienen `source` y cuántos no tienen `segment_id`. Hacen falta datos de producción; no los he consultado.
  - **Resuelto (Sí): el payback de `quarterlyBudget` usa el margen del 100 % por defecto.**
    - Payback del plan: `capacityPlan({ …, grossMarginPct: planMargin ?? seg.gross_margin_pct })` (`src/lib/segment-budget.ts:136`). Si los dos son null, se aplica `?? 100` (`src/lib/metrics.ts:40`).
    - Payback real: `marginFor` devuelve `{ pct: null }` si no hay margen real, de plan ni objetivo (`segment-budget.ts:80`). Ese null entra en `capacityPlan` (`:141-143`) y acaba en el 100 %.
    - El mismo `periodBudget` toma el ACV de `segmentAcv` (`:128`, A4) y el coste de `segmentCac` (`:124`, A3).
    - `quarter-kpis.ts:49` pondera esos paybacks, así que el KPI trimestral de empresa hereda A4 y A5.
    - `BudgetPanel` también lo muestra: usa `segmentBudget` → `periodBudget` (`segment-budget.ts:167-170`) y enseña «margen en el payback: —» (`budget-panel.tsx:78`) junto a un payback calculado al 100 % (`:85`).
  - **Resuelto (Sí): `quarter-kpis.ts` solo lo usa `/metrics`.** Lo llaman `quarter-kpis-panel.tsx:46` y `pipeline-board-panel.tsx:45`, y los dos se montan solo en `metrics.tsx:285` y `:299`.
  - **Resuelto (Sí): `<SegmentCoverage` se monta solo en `metrics.tsx:286`.** Su hook `useSegmentCoverageData` lo usa también `cac-panel.tsx:89`, que se monta solo en `metrics.tsx:291`.
- Contradicciones con el código o con decisiones previas:
  - **Citas del §3 falsas o imprecisas:**
    - `segment-coverage.ts:52-53, :63` no son deals objetivo, oportunidades objetivo y payback; son `:49`, `:50` y `:56`.
    - «CAC objetivo como sustituto» no está en `segment-coverage.ts:61-63`, sino en `:53-55`.
    - El reparto a partes iguales está en `cac.ts:29`, no en `:30`.
    - En la lista de consumidores: `strategy.tsx` no llama a esas funciones; solo monta `Motions` (`:59`), `FunnelDiagnosisPanel` (`:62`), `PaybackQuarters` (`:65`) y `BudgetQuarters` (`:68`).
    - `payback-card.tsx` se monta en Inicio (`home.tsx:80`), no en `/strategy`.
    - La lista omite:
      - `src/lib/funnel-diagnosis.ts:122` (`segmentCoverage`, pestaña Diagnóstico de `/strategy`).
      - `src/lib/mcp/tools/metrics.ts:55-56`.
      - `pipeline-real.ts:77`.
      - Los consumidores de `assignSegment`: `won-deals.ts:22`, `deal-lines.ts:106`, `stale.ts:43` y `proactive/detectors/strategy-segments.ts:37,61`.
  - **Citas del §13 imprecisas:**
    - `pipeline-board-panel.tsx` no llama a ninguna función de A2-A5 de forma directa. `pipelineEconomics` ya protege el margen null (`pipeline-board.ts:94`), así que pasarle la opción estricta no cambia nada.
    - Falta `budget-panel.tsx` (`metrics.tsx:293`).
  - **CA-10 «Presupuesto vs real → `/strategy` (ya lo es)»:** `quarter-kpis-panel.tsx:76` enlaza a `/strategy` sin `tab`, y eso abre «Modelos de venta» (`strategy.tsx:47`).
  - **CA-10, destino de «Presupuesto por segmento»:** desde `segment-coverage.tsx:128` debe ser `/strategy?tab=budget`, no `/metrics?seccion=economia`. BudgetPanel es de solo lectura y él mismo dice que se apunta en Estrategia GTM (`budget-panel.tsx:44-45`).
  - **CA-2:** Cohortes no tiene ventana; usa todo el histórico (`revops-panels.tsx:77-78`, `revops.ts:94`). Tendencias ya rotula «Últimas 12 semanas» (`revops-panels.tsx:99`).
  - **Contrato de agregación roto:**
    - `quarter-kpis.ts:2` dice que Métricas muestra «las mismas cifras que Estrategia GTM → Presupuesto vs real», y `segment-coverage.ts:1`, `cac.ts:1` y `segment-budget.ts:3` dicen «dashboard, MCP y tests agree».
    - Con la opción estricta solo en `/metrics`, `/metrics` deja de coincidir con `/strategy` (`budget-quarters.tsx:49`) y con MCP/asistente (`mcp/tools/metrics.ts:55-56`, expuesto por el SDD 5c aprobado, CA-1).
  - **Rótulo de «sin fuente»:** `/metrics` ya usa «Sin origen» para `source` null (`revops-panels.tsx:9`, Perdidos y Cohortes). «Sin fuente» sería un tercer rótulo, junto a «Sin atribuir» de NK-0029.
  - **NK-0029** (aprobado; en el ledger sigue LOGGED):
    - Su CA-18 exige documentar en el diccionario «las fórmulas que usa hoy el producto» para CAC, payback y win rate.
    - Tras este SDD habría dos fórmulas vivas de win rate (`/metrics` por trimestre; asesor y MCP con todo el histórico) y dos de payback (estricta y por defecto), contra el objetivo de NK-0029 H-4 («una sola cosa»).
    - No bloquea, pero hay que declararlo en «Coordinar con».
  - **SDD-C (`SDD-20261106-ux-core-screens-pattern.md`):**
    - Su §9 y su CA-7 fijan la forma «Estimado · motivo», y su U-5 sustituye «los textos que añade SDD-A».
    - SDD-A §9 y CA-9 fijan «estimado: punto medio del rango». La prueba de CA-9 quedaría rota por C.
    - El SDD-C no existía en el commit revisado (862d9c3); entró en f089708 durante esta revisión.
- Lo que esta revisión NO demuestra:
  - **Pruebas:** no ejecuté ninguna. `npx vitest` falla al cargar porque no hay `node_modules` (no hay paquete `vitest`).
  - **Gate:** no ejecuté `scripts/factory/gate.mjs`. El cambio es solo de documentación (`git diff f76f639...HEAD`: dos `.md`) y SDD-A no tiene ticket NK.
  - **Flakes y otras comprobaciones:** como no hubo pruebas, no aplica el protocolo de flakes. Segunda máquina y soak: NOT RUN.
  - **Datos reales:** no consulté producción.
  - **Paneles no leídos:** `LeadFunnelPanel`, `SelfServiceFunnel`, `StripeMetricsPanel`, `FinancePanel` y `won-deals-panel.tsx` completo. Puede haber más atribuciones ahí.
  - **SDD-C:** solo lo hojeé.
  - **Cobertura de la búsqueda de consumidores:** se hizo con grep por nombre. No cubre importaciones dinámicas ni reexportaciones.

**Objeciones detalladas**

1. **El límite con `/strategy` se cumple a nivel de componente, pero no a nivel de cifra compartida.**
   - Ningún componente se monta a la vez en `/metrics` y en `/strategy`. Solo se comparte el componente visual `Deviation` (`budget-quarters.tsx` → `budget-panel.tsx:7`, `quarter-kpis-panel.tsx:9`), que no calcula.
   - Las claves de consulta tampoco chocan.
   - Pero `quarter-kpis.ts:2` promete las mismas cifras que Presupuesto vs real, y MCP y el asistente siguen con la opción por defecto.
   - **Corrección:** declarar en el §5 y el §14 que `/metrics` divergirá a propósito de `/strategy` y de MCP, y quitar o reescribir el comentario de `quarter-kpis.ts:2`. Otra opción: para el KPI trimestral, rotular en vez de pasar la opción estricta.

2. **BudgetPanel queda fuera del SDD y muestra A3, A4 y A5 en `/metrics`.**
   - Payback calculado al 100 % junto a un margen que se muestra como «—» (`budget-panel.tsx:78`, `:85`).
   - ACV × 1,5 (`segment-budget.ts:128`).
   - Reparto a partes iguales en «Gasto de captación» (`budget-panel.tsx:82`, `segment-budget.ts:124,156`).
   - **Corrección:** añadirlo a la tabla A, al §13 (opción estricta por `segmentBudget`) y a un CA con su prueba.

3. **El impacto de A3 está mal descrito y tiene un efecto secundario sin cubrir.**
   - Si nadie ganó, el CAC ya es null (`cac.ts:31`). El reparto solo cambia «+ Compartido asignado» y «Coste total» (`cac-panel.tsx:200-201`) y el gasto por segmento de BudgetPanel.
   - Si la opción estricta pasa por `quarterlyBudget`, `kpiTotals` (`quarter-kpis.ts:39`) dejaría de sumar el compartido en «Gasto de captación».
   - **Corrección:** CA-8 debe exigir que el total de empresa siga sumando `unassignedShared`.

4. **Atribuciones inventadas que el SDD no lista (todas en `/metrics`):**
   - (a) `pipeline-board-panel.tsx:47-49`: el margen cae a la media sin ponderar de los márgenes objetivo de los segmentos y se muestra como «margen X%» sin fuente (`:96`). Alimenta «Payback real → proyectado».
   - (b) `pipeline-board-panel.tsx:96` rotula «ACV real» aunque `actuals` puede usar la media de deals abiertos y de todo el histórico (`pipeline-real.ts:38-41`). El win rate es de 365 días (`:30`) y sale sin ventana en un panel trimestral (`:90`).
   - (c) `revops.ts:26-27`:
     - Un deal en una etapa desconocida cuenta como si hubiera entrado en la primera.
     - Un perdido sin transición registrada a `lost` se imputa a la primera etapa o a la más avanzada que alcanzó.
     - Eso llega al titular «Donde más se pierden» (`revops-panels.tsx:64,66`).
   - (d) `metrics.tsx:165`: los deals de alguien que ya no es miembro salen como «Sin asignar», porque solo se leen los perfiles de `org_members` (`:111-115`).
   - (e) La asignación por importe (A2) también reparte el margen de los deals (`deal-lines.ts:106`) y los «Deals ganados» y el CAC real por segmento (`cac-panel.tsx:202-203`). CA-5 solo lo cuenta en Cobertura.
   - **Corrección:** ampliar la tabla A con A6-A9 o declararlas fuera de alcance. Ajustar la línea base del §4 («5 atribuciones») en consecuencia.

5. **CA-1, CA-3 y CA-4 no tienen dónde probarse.**
   - **Corrección:** el §13 debe nombrar un módulo puro nuevo (por ejemplo `src/lib/metrics-quarter.ts`) con el filtro de Embudo y Perdidos y los grupos de win rate. Las partes de pantalla deben pasar a una prueba `.tsx` (jsdom y Testing Library ya están en `vitest.config.ts:8` y `package.json`).

6. **CA-2 es falso para Cohortes.** Cohortes usa todo el histórico (`revops-panels.tsx:77-78`), y Tendencias ya rotula «Últimas 12 semanas» (`:99`).
   - **Corrección:** Cohortes con «Todo el histórico · no depende del trimestre» (o filtrarla, según la pregunta 1 del §15), y en Tendencias solo añadir «no depende del trimestre». Ajustar también el §3, que dice que las cuatro secciones ignoran el trimestre sin distinguir el caso de Cohortes.

7. **CA-10 tiene destinos equivocados y la lista de pistas está incompleta.**
   - `segment-coverage.tsx:128` debe llevar a `/strategy?tab=budget`.
   - «Presupuesto vs real» (`quarter-kpis-panel.tsx:76`) debe llevar `tab=budget`.
   - Falta en el §3 y el §6 «CAC real» en `quarter-kpis-panel.tsx:76`.
   - **Corrección:** cambiar los destinos y añadir la pista.

8. **El margen del 0 % no está cubierto aunque el §8 diga que sí.** `capacityPlan` con margen 0 da `cac / 0 = Infinity` (`metrics.ts:40-41`; 0 no cae en `??`), y en pantalla saldría «Infinity m» (`segment-coverage.tsx:121`). Con margen negativo, el payback sale negativo.
   - **Corrección:** CA-7 debe incluir de forma explícita el margen ≤ 0 → null con su motivo.

9. **CA-11 contradice la regla base 5 sin compensarlo.** Además:
   - Lista funciones que no incluyen `matchSegment` ni `assignSegment`, aunque A2 añade la opción estricta en ese camino.
   - Dice «incluido A1-A5», pero A1 vive en `metrics.tsx` y no en una función compartida.
   - **Corrección:**
     - Añadir `assignSegment`, `segmentBudget` y `funnelDiagnosis` a la comparación.
     - Exigir en U-0 una prueba de mutación (forzar `strict: true` por defecto y que la prueba falle), con la evidencia guardada.
     - Quitar A1 de CA-11.

10. **Rótulos que chocan.**
    - «Sin fuente» frente al «Sin origen» que ya hay (`revops-panels.tsx:9`). **Corrección:** usar «Sin origen».
    - «estimado: …» frente a «Estimado · …» de SDD-C. **Corrección:** alinear con el §9 de SDD-C antes del brief.

11. **Faltan coordinaciones.** Añadir a «Coordinar con»:
    - NK-0029 CA-18: el diccionario tendrá dos fórmulas de win rate y de payback.
    - SDD 5c CA-1: el asistente y MCP verán las cifras no estrictas.
    - Proponer en el §15 un ticket para llevar la opción estricta a MCP y al asesor, además de `advisor.ts:81`.

12. **CA-5 y la pista del KPI son ambiguos.**
    - En «N de M deals», no se dice si M es todo el histórico del segmento (es lo que usa `segment-coverage.ts:39` para el ACV) o los deals del trimestre.
    - Tras CA-3, la pista del KPI «Win rate global» (`metrics.tsx:280`, «deals creados este trimestre») sigue hablando de deals creados mientras la cifra pasa a ser de cerrados.
    - **Corrección:** fijar M en CA-5 y el nuevo texto de la pista en CA-3.


Informe de la segunda pasada (sobre v2), copiado sin editar:

- Veredicto del gate (segunda pasada): **Objeciones**

- Objeciones de la primera pasada:
  1. **Resuelta.** El enfoque pasa a «rotular sin recalcular» (§5 «No incluye», §13 «Por qué no la opción estricta»). El comentario de `quarter-kpis.ts:2` sigue siendo cierto (§15.5).
  2. **Parcial.** BudgetPanel ya está en A3, A4 y A5 y en CA-6, CA-7 y CA-8. Pero ninguna U ni ningún CA nombra una prueba de `budget-panel.tsx`, y el §13 solo le da `anyAcvEstimated` (un booleano), que no basta para el rótulo exacto que pide CA-6 (nueva 3).
  3. **Resuelta.** A3 cita `cac.ts:29`, `:31` y `cac-panel.tsx:200-201`. CA-8 dice «el total de empresa no cambia».
  4. **Parcial.** Se añaden A6 y A7, y A8 y A9 quedan fuera de alcance. Línea base: 7. Pero la parte (e), el margen por segmento con asignación por importe (`deal-lines.ts:106`, que se ve en `segment-coverage.tsx:128` como «margen de los deals ganados»), está en la tabla y ningún CA la rotula. La cita de A6 (`pipeline-board-panel.tsx:47-48`) se queda corta: la cadena está en `:47-49`.
  5. **Parcial.** El módulo puro `src/lib/metrics-quarter.ts` ya tiene nombre. Pero la parte de pantalla de CA-3 vive inline en la ruta (`metrics.tsx:277-281`, `:320-351`), sin componente exportado que probar (nueva 4).
  6. **Resuelta.** CA-2 y §3 distinguen Cohortes (todo el histórico) de Tendencias.
  7. **Resuelta.** Los destinos de CA-11 son correctos y la pista «CAC real» de `quarter-kpis-panel.tsx:76` está en §3.
  8. **Parcial.** CA-7 cubre el texto «Sin dato», pero no el tono verde de un payback negativo, el KPI ponderado contaminado ni el panel CAC real (nueva 2).
  9. **Resuelta en el fondo:** se añaden `assignSegment`, `matchSegment`, `segmentBudget` y `funnelDiagnosis`, la mutación con evidencia, y A1 sale. Pero CA-12 nombra `getMetrics` de MCP, que no existe (nueva 1).
  10. **Resuelta.** Se usa «Sin origen» y la forma «Estimado · motivo». Queda el choque interno CA-9/CA-10 (nueva 6).
  11. **Resuelta.** «Coordinar con» ya incluye NK-0029 CA-18 y 5c CA-1. §15 cubre `advisor.ts:81` y el paso a Sprint 2. La descripción de las ventanas de win rate en §14 es inexacta (nueva 7).
  12. **Resuelta con matiz.** M está definido y la pista del KPI es «{n} cerrados en {T}». Pero «todo el histórico para el ACV» no coincide con el código: el ACV usa solo ganados con importe, o abiertos con importe (`segment-coverage.ts:11-14`), no todos los deals del segmento.

- CA sin prueba posible o sin G-n (sin PRD no exijo G-n):
  - **CA-3 (textos):** `metrics-screen.test.tsx` no tiene qué renderizar. El KPI y los paneles de win rate están inline en el componente `Metrics` de la ruta, que no se exporta (`metrics.tsx:83`), y U-2 no extrae ningún componente.
  - **CA-6, CA-7 y CA-8 (Presupuesto por segmento y KPI trimestral):** no hay `budget-panel.test.tsx` ni `quarter-kpis-panel.test.tsx` en U-4.
  - **CA-12:** «`getMetrics` de MCP» no existe (grep en `src`: 0 resultados).
  - **CA-10 frente a CA-9:** los rótulos de origen de margen («real», «de deals con líneas», «de plan») no tienen la forma «Estimado · motivo» ni «Sin dato · motivo», así que CA-10 los haría fallar.
  - **§8 sin CA:** «Sin deals en {T}», «Sin dato · falta rango de ACV» y «repartido por clientes ganados».

- [Por verificar] que sigue sin comprobarse:
  - Deals cerrados sin `closed_at`, sin `source` y sin `segment_id`: hace falta producción; no la consulté.
  - Paneles `LeadFunnelPanel`, `SelfServiceFunnel`, `StripeMetricsPanel` y `FinancePanel`: solo los recorrí con un grep superficial de valores por defecto; no salió ningún supuesto numérico evidente, pero no los leí enteros.
  - `won-deals-panel.tsx` ya está comprobado: ya rotula la asignación por importe como «Automático (…)» (`won-deals-panel.tsx:135`, con `segmentSource` en `won-deals.ts:23,34`).
  - SDD-A no tiene ticket NK en `.factory/ledger.json`; no sé si hace falta.

- Contradicciones con el código o con decisiones previas:
  - **Campos que ya existen.** `actuals` ya devuelve `acvSource: "ganados" | "abiertos" | null` (`pipeline-real.ts:44`), así que el `acvBasis` del §13 sobra. `segmentAcv` ya devuelve `source` (`segment-coverage.ts:12-18`) y `segmentCoverage` ya devuelve `acvSource` (`:59`); el campo nuevo solo hace falta para separar `"rango"`.
  - **Valores de `basis` incoherentes.** CA-6 lista 4 valores y el §13 lista 5 (incluye `"sin_rango"`).
  - **El §5 dice «ningún cambio visible en MCP», pero puede haberlo.** `get_segment_coverage` pasa objetos enteros: `won`, `opps`, `winRate`, `{...r.payback}`, y `plan`/`actual` de `budget_quarter` y `budget_year` (`mcp/tools/metrics.ts:61-67`). Si un campo nuevo cae dentro de esos objetos, el asistente lo verá. CA-12 lo esconde porque compara después de quitar los campos nuevos.
  - **El §14 dice que «el asistente y MCP siguen con el histórico», y no es así del todo.** El asesor sí usa el histórico (`advisor.ts:80-81`). Pero `get_real_metrics` usa 365 días (`pipeline-real.ts:30`) y `get_segment_coverage` ya usa el trimestre (`segment-coverage.ts:44`). Hoy conviven tres ventanas, no dos, y CA-18 de NK-0029 debe saberlo.
  - **Decisiones de Fede del 2026-11-06.** El SDD solo anota la 1 («rotular»), y el §15.1 sigue terminando con una pregunta. El relevo de Fede dice «2 OK, 3 sí, 5 OK»: Cohortes rotulada «Todo el histórico», win rate por trimestre y el comentario de `quarter-kpis.ts:2` se mantiene. No está escrito en el SDD. La respuesta a la 4 («se perdió») es ambigua: no sé si abre ticket para `advisor.ts:81`, A8 y A9. Hay que preguntárselo a Fede.

- Lo que esta revisión NO demuestra:
  - **Pruebas:** no ejecuté ninguna (no hay `node_modules`).
  - **Gate:** no ejecuté `scripts/factory/gate.mjs`; el cambio es solo de documentación.
  - **Datos reales:** no consulté producción.
  - **Paneles:** los cuatro de arriba no los leí enteros.
  - **Consumidores:** los busqué con grep por nombre; no cubre importaciones dinámicas.
  - **SDD-C1 y SDD-C2:** solo comprobé el contrato del sprint (idéntico en A, B, C1 y C2) y los puntos que tocan a A. En C2, «las palabras las fija SDD-A» (`ux-metrics-data-state.md:28`) encaja con el CA-10 de A.
  - **Segunda máquina y soak:** NOT RUN.

**Objeciones nuevas**

1. **CA-12 nombra una función que no existe, y la congelación tapa una fuga a MCP.**
   - **Evidencia:** `getMetrics` aparece solo en el SDD (`:96`, `:122`). Las herramientas reales son `realMetrics` (`get_real_metrics`) y `segmentCoverageTool` (`get_segment_coverage`), en `src/lib/mcp/tools/metrics.ts:13` y `:34`. La segunda pasa objetos enteros (`:61-67`).
   - **Corrección:**
     - En CA-12 y U-0, nombrar los dos handlers.
     - En el §13, fijar que los campos nuevos van en el nivel superior de la fila, nunca dentro de `payback`, `won`, `opps`, `winRate`, `plan` o `actual`.
     - En CA-12, comparar la salida de MCP sin quitar nada: tiene que ser idéntica.

2. **Margen 0 % o negativo: resolverlo solo en la presentación no basta.**
   - **Evidencia:**
     - Con margen negativo, `payback.ok` sale `true` y la cifra se pinta en verde (`segment-coverage.ts:67`, `segment-coverage.tsx:121`). Lo mismo pasa con `realOk` en BudgetPanel (`segment-budget.ts:157`, `budget-panel.tsx:88`).
     - `weightedPayback` mezcla un payback negativo o `Infinity` en la media del KPI (`quarter-kpis.ts:25-28,49`): el resultado puede ser finito y positivo, así que `Number.isFinite` y el signo no lo detectan.
     - El panel CAC real muestra «Payback real» con `toFixed` (`cac-panel.tsx:205-209`) y no está entre los sitios de A5.
   - **Corrección:**
     - Añadir `cac-panel.tsx:207` a A5 y a CA-7.
     - Exigir tono neutro cuando el margen es ≤ 0.
     - Que `quarterKpis` (o las filas de `periodBudget`) devuelvan un campo aditivo `marginNonPositive`, para que el KPI diga «Sin dato».
     - Probarlo en `cac-panel.test.tsx` y en `quarter-kpis-panel.test.tsx`.

3. **CA-6 en Presupuesto por segmento no se puede construir con el §13.**
   - **Evidencia:** `periodBudget` solo extrae `{ acv }` (`segment-budget.ts:128`), y el §13 solo da un `anyAcvEstimated` booleano «agregado». CA-6 pide distinguir «punto medio del rango» de «mínimo del rango × 1,5» en cada fila.
   - **Corrección:**
     - En el §13, añadir `acvBasis` a cada fila de `periodBudget`, en el nivel superior.
     - Añadir `src/components/budget-panel.test.tsx` a U-4 para CA-6, CA-7 y CA-8.

4. **Los textos de CA-3 no tienen componente que probar.**
   - **Evidencia:** el KPI global (`metrics.tsx:277-281`) y los paneles por origen y por rep (`:320-351`) están dentro de `function Metrics` (`:83`), que no se exporta. `AGENTS.md` pide un módulo por panel bajo `src/components/<pantalla>/`.
   - **Corrección:**
     - U-2 extrae `src/components/metrics/win-rate-panels.tsx`, con el KPI y los dos paneles.
     - CA-3 nombra `src/components/metrics/win-rate-panels.test.tsx`.

5. **Al filtrar por trimestre, los vacíos de Embudo y Perdidos dirían algo falso, y el §8 no tiene CA.**
   - **Evidencia:** sin deals en T, Embudo diría «Aún no hay deals. El embudo aparece al crear el primero.» (`revops-panels.tsx:26`) y Perdidos «Ningún deal perdido todavía.» (`:53`). Además, «Win rate por fuente» (`metrics.tsx:320`) choca con «Sin origen» y con el §9.
   - **Corrección:**
     - En CA-1, exigir «Sin deals creados en {T}» y «Ningún deal perdido en {T}», con su prueba en `revops-panels.test.tsx`.
     - Renombrar el panel a «Win rate por origen».
     - Añadir al contrato del sprint que estos vacíos de `/metrics` son de A, no de C1.

6. **CA-9 incumple CA-10.**
   - **Evidencia:** CA-9 rotula el margen como «real», «de deals con líneas» o «de plan». CA-10 exige que toda marca de H-2 tenga la forma «Estimado · motivo» o «Sin dato · motivo», y C2 añade «Real» como tercera palabra (`ux-metrics-data-state.md:40`).
   - **Corrección:** limitar CA-10 a las marcas «Estimado» y «Sin dato», o escribir los orígenes como «Real · margen de los libros», «Real · margen de deals con líneas» y «Estimado · margen de plan», según las palabras de C2.

7. **Hay campos «nuevos» que ya existen, y el §14 describe mal las ventanas de win rate.**
   - **Evidencia:** `pipeline-real.ts:44` (`acvSource`), `segment-coverage.ts:18,59` (`source` y `acvSource`). Las ventanas de win rate: `advisor.ts:80` (histórico), `pipeline-real.ts:30` (365 días), `segment-coverage.ts:44,65` (trimestre).
   - **Corrección:**
     - Quitar `acvBasis` de `actuals` y rotular A7 con el `acvSource` que ya existe.
     - Declarar que `basis` solo separa `"rango"`.
     - Unificar los valores entre CA-6 y el §13, incluido o no `"sin_rango"`.
     - En el §14 y en la coordinación con NK-0029 CA-18, listar las tres ventanas.

8. **A2 no tiene CA en todas las cifras que toca.**
   - **Evidencia:** la fila de Cobertura usa la asignación por importe para pipeline, ganados, oportunidades y win rate (`segment-coverage.ts:39-47`), no solo para el ACV. El margen «de los deals ganados» (`deal-lines.ts:106` → `segment-coverage.tsx:128`) no se rotula.
   - **Corrección:**
     - CA-5 fija en qué cifra de la tarjeta va la marca. Si va una sola por tarjeta, M son todos los deals asignados al segmento.
     - Definir «asignado por importe» como en `won-deals.ts:23`: `segment_id` null, o que apunta a un segmento que no existe.
     - Cubrir el margen de deals con líneas o declararlo fuera de alcance.

9. **El SDD no recoge las decisiones de Fede.**
   - **Evidencia:** §15.1 sigue con «¿Te vale…?», y las preguntas 2, 3 y 5 siguen abiertas, aunque el relevo de Fede dice «2 OK, 3 sí, 5 OK».
   - **Corrección:**
     - Anotar como decididas, el 2026-11-06, la 2 (Cohortes rotulada «Todo el histórico»), la 3 (win rate por trimestre) y la 5 (el comentario se mantiene).
     - Quitar la pregunta que queda en la 1.
     - Pedirle a Fede que aclare «4 se perdió»: ¿ticket aparte para `advisor.ts:81`, A8 y A9, o no?


Informe de la tercera pasada (sobre v3; sus dos bloqueantes se corrigen en v4), copiado sin editar:

- Veredicto del gate (tercera pasada): **Objeciones** (2 bloqueantes: pequeñas y fáciles de corregir).

- Objeciones de la segunda pasada:
  1. Resuelta. CA-12 y U-0 nombran `realMetrics` y `segmentCoverageTool` y comparan la salida de MCP con `toStrictEqual`. Los campos nuevos van en el nivel superior y la mutación 2 los vigila. Lo he comprobado en el código: `mcp/tools/metrics.ts:61-67` solo pasa enteros `won`, `opps`, `winRate`, `payback`, `plan` y `actual`.
  2. Resuelta. `marginNonPositive`, `paybackMarginBasis` y `paybackBasis`, tono neutro, `cac-panel.tsx:207-208` dentro de A5 y CA-7, y pruebas en `cac-panel.test.tsx` y `quarter-kpis-panel.test.tsx`. Queda un matiz de `Deviation` (ver notas).
  3. Resuelta. `acvSource` y `acvRangeBasis` en cada fila de `periodBudget`, y `budget-panel.test.tsx` en CA-5 a CA-8.
  4. Resuelta. U-2 extrae `performance-panels.tsx` y CA-3 lo prueba. Matiz en las notas: «sin cambiar su marcado» choca con que `Kpi.hint` es `string`.
  5. Resuelta. CA-1 y CA-3 tienen sus vacíos con trimestre, el panel pasa a «Win rate por origen» y el §13 aplica el contrato.
  6. Resuelta. CA-9 usa «Real · …» y CA-10 admite los tres estados, igual que C2 (`ux-metrics-data-state.md:42`).
  7. Resuelta. Sin `acvBasis` en `actuals`, los valores de CA-6 y del §13 coinciden y el §14 lista las tres ventanas. Lo he comprobado en `pipeline-real.ts:30`, `segment-coverage.ts:44` y `advisor.ts:80`.
  8. Resuelta. La regla es la de `won-deals.ts:23`, hay una marca por tarjeta con M igual a `segment-coverage.ts:39`, y el margen de deals con líneas queda declarado fuera de alcance (§5).
  9. Resuelta según las decisiones de Fede que me dieron: la §15.1 es una decisión y las preguntas 2, 3 y 5 siguen abiertas, lo que no es objeción. También quedan resueltas las parciales de la primera pasada (2, 4, 5 y 8) y el matiz de la 12.

- CA sin prueba posible o sin G-n (sin PRD no exijo G-n):
  - CA-11, pista «Define cuotas abajo» (`metrics.tsx:258`): está dentro de `function Metrics` de la ruta, que no se exporta (`:83`). U-2 solo extrae `:277-281` y `:320-351`, y el §13 prohíbe los tests en `src/routes/`. `hints.test.tsx` no tiene qué pintar. Es la objeción bloqueante 1.

- [Por verificar] que sigue sin comprobarse:
  - Deals cerrados sin `closed_at`, sin `source` o sin `segment_id`, y deals que apuntan a un segmento borrado: hace falta producción y no la he consultado.
  - Si el `defineTool` de `@lovable.dev/mcp-js` deja llamar a `.handler` desde un test (CA-12). No hay `node_modules` ni ningún test del repo que lo haga.
  - `LeadFunnelPanel`, `SelfServiceFunnel`, `StripeMetricsPanel` y `FinancePanel`: siguen sin leerse enteros.
  - SDD-A sigue sin ticket NK en `.factory/ledger.json` (grep: 0 resultados).

- Contradicciones con el código o con decisiones previas:
  - C2 da por hecho que A enlaza `budget-panel.tsx:45` (`ux-metrics-data-state.md:27`, `:98`, `:133`). Ni la lista cerrada del §3 de A ni CA-11 incluyen esa pista, y hoy abre «Modelos de venta» (enlace a `/strategy` sin `tab`). Es la objeción bloqueante 2.
  - Ninguna más. Las citas que he comprobado coinciden con `f76f639`: `segment-coverage.ts:9-19`, `:36-67`, `segment-budget.ts:116-160`, `quarter-kpis.ts:25-49`, `cac.ts:22-31`, `pipeline-board-panel.tsx:45-96`, `pipeline-board.ts:94`, `cac-panel.tsx:200-208`, `budget-panel.tsx:78-88`, `quarter-kpis-panel.tsx:57`, `:76`, `:83`, `:123`, `revops-panels.tsx:9`, `:26`, `:53`, `metrics.tsx:138`, `:147-176`, `:258`, `:280`, `:320`.

- Lo que esta revisión NO demuestra:
  - **Pruebas:** no he ejecutado ninguna (no hay `node_modules`).
  - **Gate:** no he ejecutado `scripts/factory/gate.mjs`; el cambio es solo de documentación.
  - **Producción:** no la he consultado.
  - **Consumidores:** los busqué con grep por nombre, que no cubre importaciones dinámicas.
  - **SDD-C1 y C2:** solo he cruzado los puntos que tocan a A, no los he revisado enteros.
  - **Herramientas de agente:** no he leído enteras las que llaman a estas funciones.
  - **Segunda máquina y soak:** NOT RUN.

**Objeciones bloqueantes**

1. **CA-11 no se puede probar para `metrics.tsx:258`.**
   - **Evidencia:**
     - El KPI «Cobertura de pipeline» con la pista «Define cuotas abajo» está en `src/routes/_authenticated/metrics.tsx:252-261`, dentro de `function Metrics` (`:83`), que no se exporta.
     - U-2 extrae solo el KPI de win rate (`:277-281`) y los paneles `:320-351`.
     - El §13 dice: «Ningún test en `src/routes/`».
   - **Corrección (una de las dos):**
     - Que U-2 extraiga toda la fila de KPI (`:251-282`) a `performance-panels.tsx`, de modo que `hints.test.tsx` la pinte.
     - O que el §13 adopte para `hints.test.tsx` la técnica de C1: pintar `Route.options.component` con el router simulado (`ux-core-screens-pattern.md:135`).

2. **A rompe una suposición de C2 sobre `budget-panel.tsx:45`.**
   - **Evidencia:**
     - El enlace de `budget-panel.tsx:45` es «Estrategia GTM → Presupuesto vs real» y va a `/strategy` sin `tab`. Con eso abre «Modelos de venta» (`strategy.tsx:47`), el mismo fallo que `quarter-kpis-panel.tsx:76`.
     - A no lo pone en la lista cerrada del §3; solo lo cita como evidencia del destino en `:39`. La línea base del §4 es 8.
     - C2 (X-3) da por hecho que A cambia ese enlace por CA-11, y deja a la vista «el enlace que deje A».
   - **Corrección:**
     - Añadir `budget-panel.tsx:45` a la lista cerrada del §3 y a CA-11, con destino `/strategy?tab=budget`.
     - Subir la línea base del §4 de 8 a 9.

**Notas para el brief**

- **KPI trimestral (CA-7):**
  - `paybackBasis` da `"estimado"` solo con `supuesto_100` o `acvSource` `"rango"`. Un payback que sale del ACV medio de deals abiertos queda sin marca en el KPI, aunque CA-6 lo marca como «Estimado · media de deals abiertos» en Cobertura y en Presupuesto. Eso choca con el objetivo del §4 («0 supuestos sin marca»). Hay que añadir `"abiertos"` a la regla.
  - El texto «(ver Cobertura)» puede llevar a una tarjeta que no tiene marca:
    - El KPI sale de `periodBudget`, con `marginFor` sin margen de deals (`segment-budget.ts:141`) y solo con CAC real.
    - Cobertura usa `withPeriodMargin` con margen de deals y CAC objetivo.
    - Hay que fijar el destino o un texto que no apunte a otro sitio.
- **«Infinity» que se cuela por `Deviation`:** con margen ≤ 0, `Deviation` sigue pintando «+Infinity%» o una desviación en verde en `budget-panel.tsx:87` y `quarter-kpis-panel.tsx:109`, y «plan Infinity m» en el lado del plan. La aserción general de CA-7 («nunca Infinity») lo cubre, pero el brief debe decir que se suprimen la desviación y el plan cuando su base es `no_positivo`.
- **Rótulo huérfano:** en el §6 aparece «Estimado · margen objetivo», pero no sale en ningún CA ni en el enum de `boardMargin`. Hay que quitarlo o asignarle un sitio.
- **Nombre de campo:** `wonInQuarter`/`inferredWon` en las filas de `segmentBudget`, que es anual (BudgetPanel pasa `year`, `budget-panel.tsx:30`). Mejor un nombre neutro, por ejemplo `wonInPeriod`.
- **Regla de `rangeBasis`:** con `acv_min = 0` y sin `acv_max`, el ACV es 0 y sale «Sin dato · falta rango de ACV», aunque el rango existe. Conviene decidirlo por los campos y no por el resultado.
- **Marcado que tiene que cambiar:**
  - `Kpi.hint` (`metrics.tsx:426`) es `string` y `SummaryRow.cells` (`cac-panel.tsx:243`) es `string[]`. Para meter `DataMark` hay que pasarlos a `ReactNode`, así que «sin cambiar su marcado» no se puede cumplir al pie de la letra.
  - `SOURCE_LABEL` vive en la ruta (`metrics.tsx:74-81`) y no tiene la clave `"—"`: hay que moverlo con el panel y añadir «Sin origen».
- **Consumidor omitido:** falta en la lista del §3 la herramienta de agente `get_funnel_diagnosis` (`src/lib/agent/tools/strategy.ts:67`, vía `funnel-diagnosis-data.ts`). Hoy no hay fuga porque elige campos uno a uno (`funnel-diagnosis.ts:86`, `:99`).
- **Las ventanas no son marcas:** «Últimos 365 días» y «… · no depende del trimestre» no llevan `data-mark` (C2 lo dice en `:58`). A debería escribirlo en CA-2 y CA-9; si no, la comprobación de CA-10 las rechazaría.
- **Ubicación de `Kpi`/`Panel`:** pasan a `performance-panels.tsx`, y el SDD de legibilidad permite ponerlos en `page.tsx` (`ux-core-screens-pattern.md:5`). Es un conflicto de archivo que el brief debe anotar.
- **Redacción de CA-12:** dice que «los tests existentes pasan sin cambios», pero U-3 añade casos a esos mismos archivos. Hay que precisar que no se modifica ningún caso existente. No hay `toEqual` sobre salidas afectadas (comprobado con grep) ni snapshots.
- **Ticket:** SDD-A necesita ticket NK (`nokko-intake`) antes del brief.


Revisión de coherencia entre los cinco SDD del sprint: `docs/sdd/annex/sprint1-cross-sdd-gate-20261106.md`.

## 18. Delta de implementación (lo rellena el agente al entregar)
—
