# SDD-20261109-metrics-strategy-no-estimates · [Feature] Métricas y Estrategia sin cifras supuestas: «Sin dato» en todas las superficies y una sola fórmula de CAC y payback

**Tipo:** Feature · **Prioridad propuesta:** Alta
**Estado:** Borrador · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-11-09
**Ticket:** NK-0094
**PRD:** No aplica (continuación de NK-0068 con alcance aprobado por Fede el 2026-11-09: no añade capacidad nueva, cambia cómo se calculan y rotulan cifras que ya existen; ver §15.1) · **Depende de:** `SDD-20261106-metrics-honest-data` (NK-0068, Hecho) y `SDD-20261106-ux-metrics-data-state` (NK-0089, Hecho: `DataState`)
**Coordinar con:** NK-0029 / `SDD-20261030-gtm-control-tower-3-attribution-metrics` (aprobado, LOGGED; su CA-18 documenta en el diccionario las fórmulas de CAC, payback y win rate: con este SDD hay una de cada, §14); `SDD-20261030-gtm-control-tower-5c-assistant-server` (aprobado; CA-1: el asistente y MCP leen las mismas funciones; este SDD cambia la salida de `get_real_metrics`, `get_segment_coverage` y `get_funnel_diagnosis`, §14); NK-0091 (asesor: deal sin origen = Outbound, `advisor.ts:81`; mismo archivo); NK-0097 (tamaño de las marcas de dato; mismas marcas); NK-0096 (Reglas en MCP; mismo `.lovable/mcp/manifest.json`)

> Sprint 2 de mejoras en pantallas core. Resto de NK-0068: Sprint 1 rotuló los supuestos solo en `/metrics` sin cambiar ninguna cifra porque `/strategy` estaba congelada (NK-0068 §15.1). Ahora `/strategy` se descongela.

## 1. Resumen
Hoy un supuesto del código (margen del 100 % cuando falta, ACV de `mínimo × 1,5`, coste compartido repartido a partes iguales cuando nadie ganó, payback con el CAC objetivo) sigue produciendo una cifra en `/strategy`, Inicio, MCP y el asesor, y solo `/metrics` lo rotula. Este cambio hace que **un supuesto deje de producir cifra** y pase a «Sin dato · motivo» en todas las superficies, salvo los casos que este SDD decide mantener como «Estimado · motivo» declarado (tabla de decisiones, §6). Además, CAC y payback se calculan en **un solo módulo puro** (`src/lib/unit-economics.ts`) que usan todas las superficies, la red de congelación de NK-0068 (`src/lib/strategy-freeze.test.ts`) se sustituye por un test de coherencia entre superficies, y cada win rate dice su ventana.

## 2. Problema y para quién
Owner y Sales Leader (y sus asistentes por MCP) ven el payback y el CAC de un mismo segmento y trimestre con valores distintos según la pantalla, y en `/strategy`, Inicio y MCP ven cifras que salen de supuestos sin que nada lo diga. Deciden presupuesto y canal sobre esas cifras.

## 3. Evidencia y por qué ahora
Leído en `origin/main` @ `f59681f` (worktree `docs/sprint2-sdds-20261109`). No he ejecutado pruebas.

**Por qué ahora.** NK-0068 §15.1 dejó abierta la pregunta «¿abrimos en Sprint 2 el cambio a «Sin dato» en todas las superficies a la vez, junto con unificar CAC y payback?»; Fede aprobó el alcance del Sprint 2 el 2026-11-09. NK-0089 §15.4 añadió a este ticket los «—» de `/metrics` que significan «falta el dato» (decisión del coordinador del 2026-11-07).

**3.1 Fórmulas de CAC vivas (4 reales + 1 de plan)**
| # | Dónde | Regla | Superficies |
|---|---|---|---|
| C1 | `src/lib/cac.ts:31-60` (`segmentCac`) | (coste directo + parte del compartido) / ganados del segmento en el periodo, asignados con `assignSegment` | Cobertura y CAC real (`/metrics`), Payback real (`/strategy`) e Inicio vía `paybackByQuarter` (`segment-coverage.ts:184-221`), Presupuesto vs real y Presupuesto por segmento vía `periodBudget` (`segment-budget.ts:207-211`, `:246`), Diagnóstico (`funnel-diagnosis.ts:122`), `get_segment_coverage` (`mcp/tools/metrics.ts:55`, `:62`) |
| C2 | `src/lib/pipeline-real.ts:70-82` (`trailingCac`) | C1 sobre los costes de los últimos 4 trimestres y los ganados desde el inicio del más antiguo hasta hoy | Modelos de venta (`motions.tsx:146`, `:159`, `:444-447`, `:179-183`) |
| C3 | `src/lib/quarter-kpis.ts:75` (`kpiTotals`) | suma de la captación por segmento / suma de clientes nuevos por segmento; los ganados que no caen en ningún segmento no cuentan (`segment-budget.ts:196-205`) | KPI trimestral de `/metrics` (`quarter-kpis-panel.tsx`) |
| C4 | `src/lib/pipeline-board.ts:239-241` (`pipelineEconomics`) | coste total del trimestre / **todos** los ganados del trimestre (`pipeline-board-panel.tsx:91`, `:93`); proyectado con los abiertos que cierran × win rate de 365 días | Tablero de Rendimiento (`pipeline-board-panel.tsx:184`, `:190`) |
| C5 (plan) | `src/lib/segment-budget.ts:234` | captación presupuestada / clientes presupuestados | Presupuesto vs real, Presupuesto por segmento, KPI (lado plan) |

C3 y C4 dan dos «CAC real de empresa» del mismo trimestre en la misma pantalla, distintos cuando hay ganados sin segmento.
No encontré en NK-0068 §3 ni §14 una lista literal de «4 fórmulas de CAC y 2 de payback» (su §14 lista las tres ventanas de win rate; su §17 habla de «dos de payback, estricta y por defecto»). Esta tabla es mía y está comprobada en el código.

**3.2 Payback: una fórmula por segmento con cinco cadenas de entrada, y dos agregados de empresa**
La fórmula por segmento es una: `CAC / (ACV × margen / 12)` en `capacityPlan` (`src/lib/metrics.ts:95-96`), con `?? 100` cuando falta el margen. Lo que cambia es de dónde sale el margen y el ACV:
| Cadena de margen | Dónde | Superficies |
|---|---|---|
| M1: presupuesto real (trimestre → año) → deals ganados con líneas → plan → objetivo | `withPeriodMargin` (`segment-budget.ts:163-181`) | Cobertura (`segment-coverage.tsx:62-66`), CAC real (vía `useSegmentCoverageData`), Payback real e Inicio (`payback-quarters.tsx:60-71`), `get_segment_coverage` (`mcp/tools/metrics.ts:55`) |
| M2: presupuesto real (trimestre → año) → plan → objetivo, **sin** deals con líneas | `periodBudget` → `marginFor` (`segment-budget.ts:245`) | Presupuesto vs real (`budget-quarters.tsx:90`), Presupuesto por segmento, KPI trimestral (`quarter-kpis.ts:100`), `budget_quarter`/`budget_year` de MCP (`mcp/tools/metrics.ts:56`, `:65`, `:67`) |
| M3: presupuesto del año (real → plan) → objetivo | `motions.tsx:161-166` | Modelos de venta |
| M4: solo el margen objetivo del segmento | `funnel-diagnosis-data.ts:18`, `:28` (segmentos sin `withPeriodMargin`) | Diagnóstico AARRR y `get_funnel_diagnosis` (`agent/tools/strategy.ts:67`) |
| M5: margen real de empresa → deals con líneas → plan → media sin ponderar de márgenes objetivo | `boardMargin` (`pipeline-board.ts:204-224`) | Tablero |

ACV del payback: `segmentAcv` (`segment-coverage.ts:29-49`, con caída al rango) en Cobertura, Payback real y Presupuesto; `actuals` (`pipeline-real.ts:37-44`, sin rango) en el tablero; en Modelos de venta el payback real usa `segReal?.acv ?? acv` (`motions.tsx:181`), es decir, cae al ACV de la calculadora, que sin deals puede ser el valor de ejemplo 20.000 (`motions.tsx:156`, `:356`).
Agregados de empresa: P-a, media de paybacks por segmento ponderada por clientes (`quarter-kpis.ts:37-41`), en el KPI trimestral; P-b, CAC de empresa C4 / (ACV `actuals` × margen M5 / 12) (`pipeline-board.ts:242-245`), en el tablero (`pipeline-board-panel.tsx:200-226`). Ambos en `/metrics`, mismo trimestre, cifras distintas.
Consecuencia comprobada en código: con un deal ganado con líneas y sin margen real de presupuesto, el payback del mismo segmento y trimestre difiere entre Cobertura/Payback real/MCP (M1) y Presupuesto vs real/KPI (M2), y Diagnóstico (M4) usa otro margen distinto.

**3.3 Supuestos que siguen produciendo cifra fuera de `/metrics`** (A1-A7 de NK-0068 §3; ninguna de estas superficies importa `DataMark` ni `DataState`, comprobado con grep)
| Superficie | Supuestos que muestra sin decirlo |
|---|---|
| Payback real (`/strategy?tab=payback`, `payback-quarters.tsx:168-195`) | A2, A4 (ACV del rango), A5 (margen 100 %; con margen ≤ 0 pinta `Infinity` o un payback negativo en verde: `ok` sale `true`, `segment-coverage.ts:216` → `payback-quarters.tsx:178`) |
| Inicio, tarjeta de payback (`payback-card.tsx:78-106`, montada en `home.tsx:125`) | Los mismos que Payback real; además cuenta esos segmentos en «X de Y dentro del objetivo» (`segment-coverage.ts:240-241`) |
| Presupuesto vs real (`budget-quarters.tsx:153-162`, `:213-218`) | A2, A3 (gasto de captación por segmento), A4, A5 en plan (`segment-budget.ts:238`) y real; `pb()` pinta en verde un payback negativo |
| Modelos de venta (`motions.tsx`) | ACV de ejemplo 20.000 o media de puntos medios (`:149-156`); «margen bruto 100%» escrito cuando falta (`:521`); payback real con el ACV de la calculadora (`:181`); cabecera «Real (12 meses)» (`:416`) sobre un ACV de todo el histórico (`pipeline-real.ts:37-39`) |
| Diagnóstico AARRR (`funnel-diagnosis.ts:97-105`) | A5 con el margen objetivo (M4); con margen 0 el valor es `Infinity` y el veredicto «fuga»; con margen negativo, «en_objetivo» |
| `get_segment_coverage` (`mcp/tools/metrics.ts:34-71`) | A2-A5; payback con CAC objetivo (`payback.source: "objetivo"`, `segment-coverage.ts:127-129`); `Infinity` sale como `null` en el JSON (`mcp/context.ts:23`, `JSON.stringify`) y un payback negativo sale tal cual |
| `get_real_metrics` (`mcp/tools/metrics.ts:13-32`) | Descripción «últimos 12 meses» (`:16`), pero el ACV es de todo el histórico y puede ser la media de deals abiertos (`pipeline-real.ts:37-44`); sin ventana ni origen en la salida |
| Asesor y `get_overview` (`advisor.ts:80`, `:115`; `agent/tools/core-read.ts:29`, `:63`; `ai.functions.ts:129`) | Win rate de todo el histórico sin decirlo; 0 % cuando no hay cerrados (`metrics.ts:114-117`) |

**3.4 Ventanas de win rate** (NK-0068 §14): histórico (asesor, `advisor.ts:65`, `:80`, `:115`), 365 días (`actuals`, `pipeline-real.ts:30-33` → `get_real_metrics`, tablero, Modelos de venta) y trimestre (`segmentCoverage`, `segment-coverage.ts:114-124` → Cobertura, Diagnóstico, `get_segment_coverage`; win rates de `/metrics`, `src/lib/metrics-quarter.ts`). Rotuladas hoy: `/metrics` (NK-0068 CA-3) y la pista del tablero (`pipeline-board-panel.tsx:194-195`). Sin rotular: Cobertura, Modelos de venta (la cabecera mezcla ventanas), MCP y asesor.

**3.5 Red de congelación de NK-0068.** `src/lib/strategy-freeze.test.ts` (547 líneas) fija las cifras de 14 funciones y la salida de los dos handlers MCP sobre una fixture ficticia que recorre A2-A7 (`:488-541`). Su propósito era impedir lo que este SDD hace a propósito: cambiar cifras compartidas. Su fixture se reutiliza.

**3.6 «—» que significan «falta el dato».** El gate de NK-0089 contó unas 52 líneas con «—» en 11 archivos de `/metrics` (NK-0089 §3). Mi grep sobre las superficies de este SDD (líneas, no textos visibles, comentarios incluidos en la cuenta de prosa): `motions.tsx` 23, `budget-quarters.tsx` 10, `budget-panel.tsx` 9, `segment-coverage.tsx` 8, `cac-panel.tsx` 8, `finance-panel.tsx` 7, `revops-panels.tsx` 6, `quarter-kpis-panel.tsx` 6, `pipeline-board-panel.tsx` 5, `payback-card.tsx` 4. Sin clasificar entre «no aplica» y «falta el dato»: lo hace U-0.

**Uso:** sin dato (no hay analítica de `/metrics`, `/strategy` ni de llamadas MCP).

## 4. Resultado buscado
| Medida | Línea base (código, §3) | Objetivo |
|---|---|---|
| Implementaciones de CAC real | 4 (C1-C4) | 1 función (`cacOf`); las ventanas se pasan como dato y se rotulan |
| Agregados de payback de empresa | 2 (P-a, P-b) | 1 |
| Cadenas de margen que alimentan un payback | 5 (M1-M5) | 1 |
| Reglas de ACV que alimentan un payback | 3 (`segmentAcv`, `actuals`, ACV de la calculadora) | 1 |
| Superficies fuera de `/metrics` que muestran un supuesto sin marca | 8 (§3.3) | 0 |
| Sitios donde un margen ≤ 0 da `Infinity`, payback negativo o tono verde fuera de `/metrics` | 4 (Payback real, Inicio, Presupuesto vs real, Diagnóstico) + MCP | 0 |
| Superficies con win rate sin ventana dicha | 4 (Cobertura, Modelos de venta, MCP, asesor) | 0 |
| Payback del mismo segmento y trimestre distinto entre superficies | ≥ 1 pareja (M1 frente a M2, §3.2) | 0 (CA-3) |
| Uso o satisfacción | sin dato | sin dato |

## 5. Alcance
**Incluye:**
- Módulo puro `src/lib/unit-economics.ts` con la única fórmula de CAC, la única de payback, la única cadena de margen, la única regla de ACV para payback, el único agregado de empresa y las constantes de ventana de win rate (§13).
- Que las funciones compartidas (`segmentCac`, `segmentAcv`, `capacityPlan`, `segmentCoverage`, `paybackByQuarter`, `periodBudget`/`segmentBudget`/`quarterlyBudget`, `kpiTotals`/`quarterKpis`, `trailingCac`, `pipelineEconomics`, `funnelDiagnosis` vía `loadFunnelDiagnosis`) deleguen en ese módulo, con las decisiones de la tabla del §6.
- Superficies: `/metrics` (Cobertura, CAC real, Presupuesto por segmento, KPI trimestral, tablero de Rendimiento, win rates), `/strategy` (Modelos de venta, Diagnóstico AARRR, Payback real, Presupuesto vs real), Inicio (tarjeta de payback), MCP `get_real_metrics` y `get_segment_coverage`, herramientas del agente que leen estas cifras (`get_funnel_diagnosis`, `get_overview`) y el asesor (`buildSnapshot`, que comparten `get_overview` y `ai.functions.ts:129`).
- «—» que significan «falta el dato» en esas superficies, para CAC, payback, ACV, margen y win rate → «Sin dato · motivo».
- Ventana de win rate rotulada en cada superficie que lo muestra.
- Sustituir `src/lib/strategy-freeze.test.ts` por `src/lib/metrics-coherence.test.ts`.
- Actualizar las descripciones de las dos herramientas MCP y `.lovable/mcp/manifest.json` con el extractor (`src/lib/AGENTS.md`).

**No incluye:**
- Unificar las ventanas de win rate: siguen siendo tres, cada una rotulada (§15.5).
- `advisor.ts:81` (deal sin origen = Outbound): es NK-0091. Tampoco la asignación del win rate por segmento del asesor por `segment_id` sin `assignSegment` (`advisor.ts:112-116`) (§15.6).
- A8 (`revops.ts:26-27`, NK-0092) y A9.
- Diccionario de métricas, canal y público (NK-0029). Este SDD solo deja una fórmula que el diccionario documentará.
- Tamaño de letra de las marcas (NK-0097) y forma visual (`DataState`, ya entregado por NK-0089).
- Finanzas (`finance-dashboard.ts`, `finance-panel.tsx`): ROI y gasto, sin CAC ni payback; sus «—» quedan fuera.
- Ciclo de venta, cobertura de pipeline, Embudo, Perdidos, Cohortes y Tendencias.
- Esquema, migraciones, RLS y GRANT.
- `src/lib/headlines.ts` y `src/lib/nav.ts`.
- Informe semanal (`weekly-report*.ts`), detector proactivo (`proactive/detectors/strategy-segments.ts`), `stale.ts` y `deals.tsx` (solo leen ciclo o asignación, no CAC ni payback).

## 6. Cambios de comportamiento (delta)
**Decisiones caso por caso** (qué se elimina y qué se queda como «Estimado · motivo»):
| # | Supuesto | Decisión | Evidencia |
|---|---|---|---|
| D1 | A5: margen ausente = 100 % (`metrics.ts:95`) | **Se elimina.** Payback = «Sin dato · falta margen». | No hay fuente para 100 %; con M1 ya se agotan presupuesto real, deals con líneas, plan y objetivo antes de caer aquí (`segment-budget.ts:107-124`, `:178-179`). |
| D2 | Margen ≤ 0 (`metrics.ts:96`: `Infinity` o negativo) | **Se elimina en la función** (hoy solo en la pantalla de `/metrics`). Payback null, «Sin dato · margen 0 % o negativo»; `ok`, `planOk` y `realOk` null (nunca verde ni rojo). | `segment-coverage.ts:216`, `segment-budget.ts:278-279`, `funnel-diagnosis.ts:103`: hoy dan `true` o «en_objetivo» con payback negativo. |
| D3 | A4: ACV = `acv_min × 1,5` sin máximo (`segment-coverage.ts:40`) | **Se elimina.** ACV null, «Sin dato · falta el máximo del rango de ACV»; deals y oportunidades objetivo y payback, sin dato. | El factor 1,5 no tiene fuente en el repo ni en los datos de la empresa. |
| D4 | A4: sin rango ni deals → ACV 0 (`segment-coverage.ts:40-44`) | **Se elimina.** ACV null, «Sin dato · falta rango de ACV» (hoy 0, que el KPI y MCP leen como número). | `segment-coverage.ts:121` ya trata 0 como ausencia, pero `acv: 0` sale en la fila. |
| D5 | A4: punto medio del rango | **Se queda como «Estimado · punto medio del rango»** (§15.2). | Sale de un rango que la empresa ha escrito; Cobertura lo necesita para deals objetivo (`segment-coverage.ts:121-123`). |
| D6 | A4/A7: ACV = media de deals abiertos | **Se queda como «Estimado · media de deals abiertos».** | Importes reales del pipeline, no ganados. Misma regla en `segmentAcv` y `actuals`. |
| D7 | A3: compartido a partes iguales cuando nadie ganó (`cac.ts:46-50`) | **Se elimina.** Parte del compartido por segmento = 0; «Sin dato · nadie ganó: el compartido no se reparte»; el compartido sin repartir se suma aparte en el total de empresa, que no cambia. | El CAC del segmento ya es null en ese caso (`cac.ts:57`): el reparto solo alimentaba celdas de coste. |
| D8 | A2: deal asignado por importe (`segment-coverage.ts:70-74`) | **Se queda como «Estimado · N de M asignados por importe»**, ahora también en Payback real, Inicio, Presupuesto vs real, Diagnóstico y MCP. | Regla determinista sobre los rangos de la empresa; quitarla sacaría ganados de los denominadores del CAC. El detector `strategy-segments.ts:61-66` ya pide asignarlos. |
| D9 | Payback con CAC objetivo en Cobertura y MCP (`segment-coverage.ts:127-129`) | **Se elimina** (§15.3). Solo hay payback con CAC real; sin él, «Sin dato · falta CAC real». | `funnel-diagnosis.ts:97`: «with the target CAC it would compare the target with itself». |
| D10 | A6: margen = media sin ponderar de márgenes objetivo (tablero) | **Se elimina con P-b.** El tablero muestra el payback de empresa único (P-a) y deja de calcular el suyo (§15.4). | Dos paybacks de empresa en la misma pantalla (§3.2). |
| D11 | Ganados sin segmento fuera del CAC de empresa (C3) | **Se elimina.** CAC de empresa = coste del periodo / todos los ganados del periodo (regla de C4). | Coste gastado y cliente ganado aunque no tenga segmento. |
| D12 | Modelos de venta: ACV de ejemplo 20.000 (`motions.tsx:156`) | **Se elimina** (§15.7). Sin deals ni rangos, el campo queda vacío y los resultados dicen «Sin dato · falta ACV» hasta que lo escribas. | Cifra genérica sin fuente. |
| D13 | Modelos de venta: media de puntos medios de los rangos (`motions.tsx:149-154`) | **Se queda como «Estimado · media de los rangos de tus segmentos»** (ya lo dice el texto, `:355`; pasa a marca). | Rangos de la empresa. |
| D14 | Modelos de venta: «Payback estimado» con CAC y win rate objetivo (`motions.tsx:168-177`, `:505`) | **Se queda como «Estimado · con objetivos del segmento»**: es una calculadora de escenarios. | El rótulo «Payback estimado» ya existe; pasa a marca. |
| D15 | Margen de Modelos de venta (M3) y de Diagnóstico (M4) | **Se unifican en M1** (la cadena única). | §3.2. |

**Añadido:** `src/lib/unit-economics.ts`; marcas «Real», «Estimado · motivo» y «Sin dato · motivo» en Payback real, Inicio, Presupuesto vs real, Modelos de venta; campos de estado y motivo en MCP; ventana en cada win rate; `src/lib/metrics-coherence.test.ts` y `src/lib/metrics-formulas-single.test.ts`.
**Modificado:**
- Payback sin margen: cifra al 100 % → «Sin dato · falta margen», en todas las superficies.
- Payback con margen ≤ 0: `Infinity`/negativo (fuera de `/metrics`) → «Sin dato · margen 0 % o negativo», tono neutro.
- ACV `mínimo × 1,5` → «Sin dato · falta el máximo del rango de ACV»; ACV 0 sin rango → «Sin dato · falta rango de ACV».
- Compartido sin ganados: repartido → no repartido, con su marca; total de empresa igual.
- Cobertura y `get_segment_coverage`: payback con CAC objetivo → «Sin dato · falta CAC real».
- KPI trimestral: CAC = coste / todos los ganados; payback = P-a con la marca de cobertura parcial (§9).
- Tablero: «Payback real → proyectado» → «Payback real» igual al del KPI; el CAC proyectado queda como «Estimado · proyección con win rate de los últimos 365 días» (§15.4).
- Diagnóstico y `get_funnel_diagnosis`: margen M4 → M1.
- Modelos de venta: margen M3 → M1; CAC real con la fórmula única y ventana «Últimos 4 trimestres»; payback real con el ACV de `segmentAcv`, nunca el de la calculadora; cabecera «Real (12 meses)» → una ventana por fila.
- Asesor y `get_overview`: win rate 0 % sin cerrados → null con su motivo; ventana «todo el histórico» en la salida.
- «—» de falta de dato (CAC, payback, ACV, margen, win rate) en las superficies del alcance → «Sin dato · motivo».
**Eliminado:** los supuestos D1-D4, D7, D9-D12; `boardMargin` y el payback propio del tablero; las marcas de NK-0068 «Estimado · margen del 100 % supuesto (falta margen)», «Estimado · mínimo del rango × 1,5» y «Estimado · repartido a partes iguales (nadie ganó)»; `src/lib/strategy-freeze.test.ts`.

## 7. Historias y criterios de aceptación
Sin PRD: los CA no citan G-n. Marcas: la forma de NK-0068 CA-10 (`^(Real( · .+)?|Estimado · .+|Sin dato · .+)$`, atributo `data-mark`) pintada con `DataState` (NK-0089); la comprobación compartida `src/test/data-marks.ts` se reutiliza sin quitar aserciones. Fixture: la de `strategy-freeze.test.ts`, movida a `src/test/metrics-fixture.ts` y ampliada (§13). Ningún dato real.

### H-1: Como Owner o Sales Leader, quiero que el CAC y el payback de un segmento y trimestre sean el mismo número en cualquier pantalla o asistente, para no tener que elegir cuál creer.
- **CA-1** `src/lib/unit-economics.ts` exporta, puras: `cacOf({ cost, won })`, `paybackOf({ cac, acv, margin })`, `marginChain(seg, { quarter, year, deals })`, `acvFor(seg, deals)`, `companyCac({ cost, won })`, `companyPayback(rows)` y `WIN_RATE_WINDOWS`. Cada cifra es un `Figure = { value: number | null; state: "real" | "estimado" | "sin_dato"; reason: string | null }`. Reglas: `cacOf` da «Sin dato · sin costes en {periodo}» con coste null o 0 y «Sin dato · ningún deal ganado en {periodo}» con 0 ganados; `paybackOf` = CAC / (ACV × margen / 12), null con el motivo de la primera entrada «sin_dato» (orden CAC, ACV, margen), null con «margen 0 % o negativo» si margen ≤ 0, «estimado» si alguna entrada lo es (motivos unidos con «, »), y nunca devuelve `Infinity`, `NaN` ni un número negativo. · prueba: `src/lib/unit-economics.test.ts`
- **CA-2** Fuera de `src/lib/unit-economics.ts` (y de los tests) ningún archivo de `src/` calcula un CAC o un payback por su cuenta: el escaneo no encuentra `/ 12` aplicado a un ACV por margen, ni `cost / customers`, `cost / won`, `acquisition / newCustomers` o `planAcq / planNew`. Falla primero en la base por `metrics.ts:96`, `cac.ts:57`, `quarter-kpis.ts:75`, `pipeline-board.ts:239-241` y `segment-budget.ts:234`. · prueba: `src/lib/metrics-formulas-single.test.ts`
- **CA-3** Coherencia, con la fixture y un trimestre T: para cada segmento, el CAC real y el payback real (valor, estado y motivo) son iguales en `segmentCoverage` (Cobertura, CAC real), `paybackByQuarter` (Payback real, Inicio), `quarterlyBudget(...).byQuarter[T]` (Presupuesto vs real, KPI) y la salida de `segmentCoverageTool` (`get_segment_coverage`, tras el redondeo a un decimal de `:11`); el payback es igual en `funnelDiagnosis` (Diagnóstico, `get_funnel_diagnosis`); el margen usado es el mismo en todas. Para la empresa, CAC y payback de `quarterKpis` son iguales a los que muestra el tablero, y el gasto de captación de empresa es igual a la suma de todos los costes del trimestre (también con compartido y nadie ganado). La calculadora de Modelos de venta (`src/lib/strategy-calculator.ts`, §13), con su ventana de 4 trimestres, da lo mismo que `paybackOf(cacOf(costes y ganados de esa ventana), acvFor, marginChain del trimestre actual)`. Falla primero en la base (como mínimo por M1 frente a M2 y M4, y por C3 frente a C4). · prueba: `src/lib/metrics-coherence.test.ts`
- **CA-4** `src/lib/strategy-freeze.test.ts` desaparece en la misma unidad en que cambian las cifras (U-2), y `metrics-coherence.test.ts` guarda evidencia de que falla con dos mutaciones: (1) `quarterlyBudget` vuelve a la cadena M2; (2) `pipelineEconomics` vuelve a dividir por `p.won` propio con otra lista de ganados. · prueba: `src/lib/metrics-coherence.test.ts` (evidencia en `.factory/evidence/NK-0094/`)

### H-2: Como Owner o Sales Leader, quiero que un supuesto no se presente como cifra en ninguna superficie, para no decidir sobre él.
- **CA-5** Funciones compartidas, con la fixture: segmento sin margen en toda la cadena → payback null, «Sin dato · falta margen» (D1); margen ≤ 0 → null, «Sin dato · margen 0 % o negativo», y `payback.ok`, `planOk`, `realOk` y el veredicto de Diagnóstico null (D2); `acv_min` sin `acv_max` ni deals → ACV null, «Sin dato · falta el máximo del rango de ACV», y `won.target`, `opps.target` y payback null (D3); sin rango ni deals → ACV null, «Sin dato · falta rango de ACV» (D4); punto medio → «Estimado · punto medio del rango» (D5); solo abiertos → «Estimado · media de deals abiertos» (D6); compartido con nadie ganado → `shared` 0 por segmento y `sharedSplit: "sin_reparto"`, y el total de empresa de `kpiTotals` incluye ese compartido (D7); deals asignados por importe → los contadores de NK-0068 CA-5 también en `paybackByQuarter` y `funnelDiagnosis` (D8); Cobertura sin CAC real → payback null, «Sin dato · falta CAC real», sin `source: "objetivo"` (D9); CAC de empresa = coste / todos los ganados del periodo (D11). · prueba: `src/lib/unit-economics.test.ts`, `src/lib/segment-coverage.test.ts`, `src/lib/segment-budget.test.ts`, `src/lib/cac.test.ts`, `src/lib/quarter-kpis.test.ts`, `src/lib/pipeline-board.test.ts`, `src/lib/funnel-diagnosis.test.ts`
- **CA-6** `/metrics`: Cobertura, CAC real, Presupuesto por segmento, KPI trimestral y tablero pintan las marcas que dan los `Figure` (textos del §9). Ningún texto de `src/` contiene «margen del 100 % supuesto», «mínimo del rango × 1,5» ni «repartido a partes iguales». El tablero tiene una sola cifra de payback, igual a la del KPI, y su CAC proyectado lleva «Estimado · proyección con win rate de los últimos 365 días». · prueba: `src/components/segment-coverage.test.tsx`, `src/components/cac-panel.test.tsx`, `src/components/budget-panel.test.tsx`, `src/components/quarter-kpis-panel.test.tsx`, `src/components/pipeline-board-panel.test.tsx`, `src/lib/metrics-formulas-single.test.ts` (textos prohibidos)
- **CA-7** Payback real (`/strategy?tab=payback`) e Inicio: una celda sin payback muestra «Sin dato · motivo» (sin costes, ningún ganado, falta margen, margen 0 % o negativo, falta ACV), nunca «—» ni «sin costes» suelto; una celda con entradas estimadas lleva su marca «Estimado · …»; un payback solo es verde o rojo con estado «real» o «estimado» y objetivo; la tarjeta de Inicio cuenta como medidos solo los segmentos con payback no null. · prueba: `src/components/payback-quarters.test.tsx`, `src/components/payback-card.test.tsx`, `src/lib/segment-coverage.test.ts` (`paybackSummary`)
- **CA-8** Presupuesto vs real (`/strategy?tab=budget`): payback presupuestado y real, CAC real y gasto de captación siguen D1-D3, D7 y D8 con sus marcas; ningún payback negativo ni `Infinity`; un payback sin dato no tiene desvío (`Deviation` recibe null). La nota del pie (`budget-quarters.tsx:406-408`) describe la cadena única de margen. · prueba: `src/components/budget-quarters.test.tsx`
- **CA-9** Modelos de venta: sin deals ni rangos, el ACV queda vacío y deals, oportunidades y payback dicen «Sin dato · falta ACV» (D12); con rangos, «Estimado · media de los rangos de tus segmentos» (D13); el «Payback estimado» lleva «Estimado · con objetivos del segmento» (D14); el payback real usa `acvFor` y `marginChain` y, sin ACV real, dice «Sin dato · falta ACV del segmento», nunca usa el ACV de la calculadora; nunca se escribe «margen bruto 100%» si falta el margen. · prueba: `src/lib/strategy-calculator.test.ts`, `src/components/strategy/motions.test.tsx`
- **CA-10** Diagnóstico AARRR y `get_funnel_diagnosis`: el payback usa `marginChain` (D15); sin margen o con margen ≤ 0 la medida es «sin datos» con el motivo de CA-5 y sin veredicto. `loadFunnelDiagnosis` lee `segment_budget_quarters` del año y `deals.gross_margin` con `org_id` explícito (también por el cliente privilegiado del agente). · prueba: `src/lib/funnel-diagnosis.test.ts`, `src/lib/agent-tools.test.ts` (`expectScoped` sobre `get_funnel_diagnosis`)
- **CA-11** `get_segment_coverage`: cada segmento devuelve `acv: { value, state, reason }`, `cac: { …, state, reason }`, `payback: { real, state, reason, target, ok, window }` y `win_rate: { …, window: "trimestre" }`; ningún valor es negativo ni null por `Infinity`; desaparece `payback.source: "objetivo"`. `get_real_metrics` devuelve por total y por segmento `win_rate_window: "ultimos_365_dias"`, `acv_window: "todo_el_historico"` y `acv_source`. Sus descripciones lo dicen y `.lovable/mcp/manifest.json` coincide con ellas. · prueba: `src/lib/mcp/tools/metrics.test.ts`
- **CA-12** Asesor y `get_overview`: sin deals cerrados, `win_rate_global_pct` y el `win_rate_pct` de cada segmento son null (no 0); la salida lleva `ventana_win_rate: "todo el histórico"` en el pipeline y en cada segmento. · prueba: `src/lib/advisor.test.ts`
- **CA-13** «—» de falta de dato: en las superficies de §5 «Incluye», una cifra de CAC, payback, ACV, margen o win rate que falta se pinta como `[data-mark="sin_dato"]` con su motivo; un «—» solo queda donde U-0 lo clasificó «no aplica» (lista cerrada en el propio test). · prueba: los tests de componente de CA-6 a CA-9 llamando a `expectDataMarks` y a una aserción nueva `expectNoBareDash(root, allowed)` en `src/test/data-marks.ts`

### H-3: Como Owner o Sales Leader, quiero saber de qué periodo sale cada win rate.
- **CA-14** Cada win rate visible dice su ventana con los textos de `WIN_RATE_WINDOWS`: Cobertura «Trimestre {T}»; tablero «Últimos 365 días» junto a la cifra (no solo en la pista); Modelos de venta, por fila: ACV «Todo el histórico», win rate y ciclo «Últimos 365 días», CAC y payback «Últimos 4 trimestres»; los win rates de `/metrics` mantienen «{n} cerrados en {T}» (NK-0068 CA-3). · prueba: `src/components/segment-coverage.test.tsx`, `src/components/pipeline-board-panel.test.tsx`, `src/components/strategy/motions.test.tsx`, `src/lib/unit-economics.test.ts` (constantes)

## 8. Casos límite y errores
- Trimestre sin costes y sin ganados: CAC y payback «Sin dato · sin costes en {T}» (CA-1, CA-7).
- Costes sin ganados: «Sin dato · ningún deal ganado en {T}»; el compartido no se reparte (D7, CA-5).
- Ganado sin segmento que no cae en ningún rango: cuenta en el CAC de empresa (D11) y en ningún segmento; el KPI dice cuántos (§9).
- Deal que apunta a un segmento borrado: asignado por importe (D8). Los costes de un segmento borrado se borran en cascada (`drizzle/migrations/0015_cac_costs.sql:4`).
- Margen exactamente 0: «Sin dato · margen 0 % o negativo» (D2).
- `acv_min` 0 sin máximo: hoy da ACV 0 con `minimo_x1_5` (`segment-coverage.ts:41`); pasa a «Sin dato · falta el máximo del rango de ACV» (D3).
- KPI de empresa con unos segmentos con payback y otros sin dato: valor sobre los que tienen dato, con marca «Estimado · calculado sobre {k} de {m} segmentos con clientes» (§15.8). Ningún segmento con payback: «Sin dato · ningún segmento con payback».
- Multitenant: la única consulta nueva es la de `loadFunnelDiagnosis` (CA-10), con `org_id` explícito; el resto son las mismas consultas.
- Carga y error: sin cambios (SDD-C1, NK-0088).
- Asistentes externos que lean `payback.source` o un payback numérico: ver §14 y §16.

## 9. Experiencia y copy
Español, «tú», sin iconos; la palabra lleva el estado; forma visual de `DataState`. Textos nuevos o cambiados (lista cerrada):
- «Sin dato · falta margen»
- «Sin dato · margen 0 % o negativo» (ya existe)
- «Sin dato · falta el máximo del rango de ACV»
- «Sin dato · falta rango de ACV» (ya existe)
- «Sin dato · falta ACV» (calculadora) y «Sin dato · falta ACV del segmento» (payback real de la calculadora)
- «Sin dato · falta CAC real»
- «Sin dato · sin costes en {T}» y «Sin dato · ningún deal ganado en {T}» (en Payback real e Inicio sustituyen «sin costes» y «{importe} · 0 ganados», `payback-quarters.tsx:173`; el importe pasa a la pista)
- «Sin dato · nadie ganó: el compartido no se reparte»
- «Sin dato · ningún segmento con payback»
- «Estimado · punto medio del rango», «Estimado · media de deals abiertos», «Estimado · N de M asignados por importe» (ya existen)
- «Estimado · media de los rangos de tus segmentos», «Estimado · con objetivos del segmento»
- «Estimado · calculado sobre {k} de {m} segmentos con clientes» (sustituye «Estimado · supuestos en algún segmento (ver Cobertura)» y «Sin dato · un segmento tiene margen 0 % o negativo» del KPI)
- «Estimado · proyección con win rate de los últimos 365 días»
- Ventanas (texto plano, no marca): «Todo el histórico», «Últimos 365 días», «Trimestre {T}», «Últimos 4 trimestres».
- KPI de empresa con ganados sin segmento: pista «{n} ganados sin segmento cuentan en el CAC de empresa».
- Pies de Payback real (`payback-quarters.tsx:88-91`) y Presupuesto vs real (`budget-quarters.tsx:406-408`): «El margen sale, por este orden, del presupuesto real del trimestre o del año, de los deals ganados con líneas, del presupuesto planificado y del margen objetivo del segmento. Sin ninguno, no hay payback.»

## 10. Datos, permisos y privacidad
Sin tablas, columnas, RLS ni GRANT nuevos. Una lectura nueva: `loadFunnelDiagnosis` añade `segment_budget_quarters` del año y `deals.gross_margin`, con `.eq("org_id", orgId)` como el resto de sus lecturas (`funnel-diagnosis-data.ts:16-25`), porque el agente la ejecuta con el cliente privilegiado (`src/lib/AGENTS.md`, registro del agente). Finanzas sigue solo para Owner y Sales Leader. MCP de métricas sigue solo para Owner y Sales Leader (5c CA-1). Tests con datos ficticios; ningún dato de clientes en fixtures, evidencias ni logs.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| ninguna nueva | — | — | — |

El asesor (`ai.functions.ts:129`) recibe un snapshot con dos campos más y nulls donde antes había 0; su llamada no cambia. Coste del cambio de entrada: sin dato.

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-0 | Fixture movida a `src/test/metrics-fixture.ts` y ampliada (deal ganado con líneas y sin margen real de presupuesto; ganado sin segmento; compartido sin ganados; `acv_min` 0 sin máximo); test de coherencia; escaneo de fórmulas; inventario de «—» de §3.6 clasificado (no aplica / falta el dato) como lista cerrada en el test | CA-2, CA-3 (rojo), CA-13 (lista) | `src/lib/metrics-coherence.test.ts`, `src/lib/metrics-formulas-single.test.ts` (ambos fallan en la base) |
| U-1 | `src/lib/unit-economics.ts` | CA-1, CA-14 (constantes) | `src/lib/unit-economics.test.ts` |
| U-2 | Delegación de las funciones compartidas con D1-D11 y D15; borrar `strategy-freeze.test.ts`; mutaciones de CA-4 con evidencia; actualizar los tests de lib que fijaban los supuestos (cada aserción cambiada, citada en el PR con su decisión D-n) | CA-2, CA-3 (verde), CA-4, CA-5 | `src/lib/segment-coverage.test.ts`, `src/lib/segment-budget.test.ts`, `src/lib/cac.test.ts`, `src/lib/quarter-kpis.test.ts`, `src/lib/pipeline-board.test.ts`, `src/lib/funnel-diagnosis.test.ts` (aserciones nuevas de CA-5 en rojo) |
| U-3 | `/metrics`: marcas desde `Figure`, tablero con un solo payback, «—» de falta de dato, ventanas | CA-6, CA-13, CA-14 | `src/components/pipeline-board-panel.test.tsx`, `src/components/quarter-kpis-panel.test.tsx`, `src/components/segment-coverage.test.tsx`, `src/components/cac-panel.test.tsx`, `src/components/budget-panel.test.tsx` |
| U-4 | `/strategy` e Inicio: Payback real, Presupuesto vs real, Modelos de venta (extrae `src/lib/strategy-calculator.ts`), Diagnóstico; tarjeta de Inicio | CA-7, CA-8, CA-9, CA-10, CA-13, CA-14 | `src/components/payback-quarters.test.tsx`, `src/components/payback-card.test.tsx`, `src/components/budget-quarters.test.tsx`, `src/lib/strategy-calculator.test.ts`, `src/components/strategy/motions.test.tsx`, `src/lib/agent-tools.test.ts` |
| U-5 | MCP, asesor y `get_overview`; descripciones y manifiesto | CA-11, CA-12 | `src/lib/mcp/tools/metrics.test.ts`, `src/lib/advisor.test.ts` |

Orden: U-0 → U-1 → U-2 → (U-3, U-4, U-5). U-2 cambia cifras y borra la red de congelación en el mismo commit.

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- **Módulo.** `src/lib/unit-economics.ts`, sin dependencias de pantalla. `Figure` lleva estado y motivo; `mark-text.ts` (`src/components/metrics/mark-text.ts`) pasa a ser un adaptador `figureMark(f) → DataMarkProps` y deja de componer motivos por su cuenta. Como `/strategy` e Inicio no están en `src/components/metrics/`, el adaptador y `DataMark` se mueven a un sitio común (p. ej. `src/components/data-mark.tsx`) o se usa `DataState` directamente; `src/test/data-marks.ts` no cambia salvo la aserción nueva de CA-13.
- **Ventana como dato, fórmula única.** `trailingCac` pasa a ser `cacOf` con costes y ganados de la ventana de 4 trimestres; `segmentCac` reparte el compartido y llama a `cacOf` por segmento.
- **`capacityPlan`.** Mantiene `dealsPerYear`, `oppsPerYear` y `oppsPerMonth` (la calculadora los usa) y su `paybackMonths` delega en `paybackOf`; los campos `marginAssumed`/`marginNonPositive` de NK-0068 pueden quedarse como lectura del `Figure` o desaparecer (los consumidores están en `src/components/metrics/` y en `segment-coverage.ts:55-62`).
- **Cadena de margen única.** `marginChain(seg, { quarter, year, deals })` = `withPeriodMargin` actual (`segment-budget.ts:163-181`). `periodBudget` recibe los márgenes de deals (`wonDealsMargin(..., range.end, segments).bySegment`) como hacen ya Cobertura (`segment-coverage.tsx:62-66`) y Payback real (`payback-quarters.tsx:63-68`). El payback presupuestado sigue con el margen de plan y, sin él, el objetivo (`segment-budget.ts:238`).
- **Payback de empresa único.** `companyPayback(rows)` = la media ponderada actual (`quarter-kpis.ts:37-41`) más el recuento «k de m». El tablero lee `quarterKpis(...)[0].actual.payback`, que ya calcula (`pipeline-board-panel.tsx:86`), y `boardMargin` desaparece.
- **CAC de empresa.** `kpiTotals` necesita los ganados del periodo sin filtrar por segmento y el compartido no repartido: `periodBudget` puede devolverlos a nivel de periodo (no por fila) o `quarterKpis` contarlos aparte.
- **MCP.** Tras U-5, ejecutar `node node_modules/@lovable.dev/mcp-js/dist/cli/extract-manifest.cjs .` (`src/lib/AGENTS.md`). Las claves nuevas van dentro de `payback`, `cac`, `win_rate`: la regla de NK-0068 «nunca dentro de los objetos que MCP pasa enteros» era de la congelación y deja de aplicar.
- **Calculadora.** Extraer de `motions.tsx:145-190` a `src/lib/strategy-calculator.ts` lo que hoy es lógica en el componente (ACV usado, segmento, margen, `plan`, `paybackReal`, `missing`), para probarlo puro (CA-3, CA-9).
- **Tests de componente.** jsdom y Testing Library (`vitest.config.ts`), patrón de mocks de `src/test/metrics-mocks.tsx` y `src/components/strategy-screens.test.tsx`. Ningún test en `src/routes/`.
- **Test de MCP.** Mismo patrón que `strategy-freeze.test.ts` (mock de `@/lib/mcp/context` con una `db` falsa sobre la fixture), ahora sin golden: aserciones sobre forma y coherencia.
- **Alternativa descartada:** mantener las cifras y solo rotular en `/strategy` e Inicio (lo de NK-0068). No cumple el objetivo de Fede (un supuesto deja de producir cifra) ni cierra las cinco cadenas de margen.

## 14. Riesgos y dependencias
- **Cifras que desaparecen.** Segmentos sin margen, sin máximo de ACV o sin CAC real dejarán de tener payback en todas partes. Cuántos: sin dato (producción, §16). Mitigación: cada «Sin dato» dice qué falta.
- **Contrato con asistentes externos (5c).** `get_segment_coverage` cambia valores (nulls), quita `payback.source: "objetivo"` y añade claves. Un asistente que trate el payback como número siempre presente verá null. Hay que avisarlo en la descripción de la herramienta (CA-11).
- **NK-0029 CA-18.** El diccionario de métricas no existe aún en código (no hay `metrics-dictionary` en `src/lib/`). Cuando se haga, sus entradas de CAC, payback y win rate deben citar `unit-economics.ts` y `WIN_RATE_WINDOWS`: una fórmula de CAC, una de payback y tres ventanas de win rate. Se lo pasamos a NK-0029.
- **NK-0091** toca `advisor.ts:81`; este SDD toca `advisor.ts:80`, `:115` y añade claves. Conflicto de archivo, no de regla: integrar en orden.
- **NK-0097** cambia el tamaño de las marcas; este SDD cambia y añade marcas. Conflicto de archivo en los mismos componentes.
- **NK-0096** también regenera `.lovable/mcp/manifest.json`: regenerar tras integrar ambos.
- **Win rate trimestral por segmento** con pocos cerrados sigue siendo volátil (NK-0068 §14); solo se rotula.
- **`quarter-kpis.ts:2`** («las mismas cifras que Estrategia GTM → Presupuesto vs real») pasa a ser cierto también para Cobertura y MCP; el comentario se puede ampliar.
- **Riesgo de alcance:** U-2 toca seis módulos probados; el test de coherencia es la red que sustituye a la congelación.

## 15. Preguntas para Fede y para la revisión técnica
Las decide el coordinador por delegación de Fede. Cada una con recomendación.
1. **Nivel de documentación.** La tabla de `nokko-shape` pide PRD para una Feature. Propongo SDD sin PRD: no hay capacidad nueva ni usuario nuevo, el qué y el porqué los fijó NK-0068 §15.1 y el alcance lo aprobó Fede el 2026-11-09. Un PRD añadiría objetivos G-n medibles en uso, pero no hay analítica (sin dato). **Recomiendo SDD sin PRD.**
2. **Punto medio del rango (D5).** ¿«Estimado» o «Sin dato»? **Recomiendo «Estimado · punto medio del rango»**: es un rango que la empresa escribió y Cobertura lo necesita para deals objetivo. Si se pasa a «Sin dato», toda empresa sin ganados ni abiertos en un segmento pierde deals objetivo y payback.
3. **Payback con CAC objetivo en Cobertura y MCP (D9).** **Recomiendo eliminarlo**: compara el objetivo consigo mismo (`funnel-diagnosis.ts:97`) y ya hay un «Payback objetivo» a la vista. La alternativa es mantenerlo como «Estimado · con CAC objetivo».
4. **Payback proyectado del tablero (D10).** Para no inventar un ACV y un margen de empresa, **recomiendo quitar el payback proyectado** y dejar CAC real, CAC proyectado («Estimado · proyección…») y el payback de empresa del KPI. Alternativa: payback proyectado = payback real × (CAC proyectado / CAC real), declarado como «Estimado».
5. **Ventanas de win rate.** ¿Unificarlas? **Recomiendo no**: cada una responde a una pregunta distinta (trimestre para seguimiento, 365 días para planificar, histórico para el asesor). Solo se rotulan (H-3).
6. **Win rate por segmento del asesor** (`advisor.ts:112-116`, por `segment_id` sin `assignSegment`). **Recomiendo ticket aparte** (o ampliar NK-0091): cambia la entrada de la IA y no es CAC ni payback.
7. **ACV de ejemplo 20.000 en Modelos de venta (D12).** **Recomiendo eliminarlo**: la calculadora queda vacía hasta que escribas un ACV, con «Sin dato · falta ACV». Alternativa: mantenerlo como «Estimado · valor de ejemplo», pero es una cifra sin fuente.
8. **KPI de empresa con cobertura parcial.** **Recomiendo** mostrar la media sobre los segmentos con payback y la marca «Estimado · calculado sobre {k} de {m} segmentos con clientes». Alternativa más estricta: «Sin dato» en cuanto un segmento con clientes no tenga payback.
9. **CAC de empresa (D11).** **Recomiendo** coste / todos los ganados, con la pista de cuántos no tienen segmento. Alternativa: solo los ganados con segmento, como hoy el KPI; dejaría coste sin cliente.
10. **Diagnóstico AARRR** usa «sin datos» (vocabulario de `SDD-20261027-segment-motion-aarrr-diagnosis`) y no `DataState`. **Recomiendo no tocar su forma** en este SDD; solo su margen y sus motivos (CA-10).

**Decisiones del coordinador (2026-11-09, ejecución delegada por Fede: «sí, ese alcance, ejecuta todo tú»):** se aceptan las recomendaciones del autor para todas las preguntas: 1 SDD sin PRD; 2 punto medio del rango se mantiene como «Estimado»; 3 se elimina el payback con CAC objetivo en Cobertura y MCP; 4 se quita el payback proyectado del tablero; 5 las ventanas de win rate se rotulan, no se unifican; 6 el win rate por segmento del asesor va a ticket aparte; 7 se elimina el ACV de ejemplo 20.000; 8 KPI de empresa con «Estimado · calculado sobre {k} de {m} segmentos con clientes»; 9 CAC de empresa = coste entre todos los ganados, con pista de los que no tienen segmento; 10 el Diagnóstico AARRR mantiene su vocabulario.

## 16. Pendiente de verificar
- [Por verificar] Que `metrics-coherence.test.ts` y `metrics-formulas-single.test.ts` fallan en la base por las parejas y archivos que cito (§3.2, CA-2, CA-3): lo demuestra U-0 con evidencia. No he ejecutado pruebas.
- [Por verificar] Cuántos segmentos de producción no tienen margen en ninguna fuente, tienen `acv_min` sin `acv_max`, o trimestres con compartido y sin ganados; cuántos deals ganados no caen en ningún segmento: producción. Decide cuántas cifras pasan a «Sin dato».
- [Por verificar] Si algún asistente externo o integración depende de `payback.source: "objetivo"` o de un payback numérico en `get_segment_coverage`: registro de uso de MCP (no lo hay en el repo).
- [Por verificar] Clasificación exacta de los «—» (§3.6): mi recuento es por líneas con grep, incluye comentarios y no distingue «no aplica» de «falta el dato»; U-0.
- [Por verificar] La lista «4 fórmulas de CAC y 2 de payback» que el encargo atribuye a NK-0068 §3 y §14: no la encontré literal; la tabla del §3.1-3.2 es mía.
- [Por verificar] Que el extractor del manifiesto MCP corre en el worktree con `node_modules` enlazado: U-5.
- [Por verificar] Que la regla `matchSegment` de empate (`metrics.ts:64-75`) y `wonDealsMargin` con ventana de 12 meses antes del fin del periodo (`deal-lines.ts:94-101`) no introducen más diferencias entre superficies una vez unificada la cadena: lo cubre CA-3 con la fixture.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Un agente `nokko-gate` con contexto fresco lee este SDD y el código, y devuelve su informe. El coordinador lo copia aquí sin editarlo. El gate no aprueba el SDD: informa; la aprobación es de Fede.
- Veredicto del gate: No revisado
- CA sin prueba posible o sin G-n: —
- [Por verificar] que sigue sin comprobarse: —
- Contradicciones con el código o con decisiones previas: —
- Lo que esta revisión NO demuestra: —

## 18. Delta de implementación (lo rellena el agente al entregar)
—
