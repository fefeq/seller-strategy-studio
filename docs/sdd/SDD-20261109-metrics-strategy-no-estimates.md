# SDD-20261109-metrics-strategy-no-estimates · [Feature] Métricas y Estrategia sin cifras supuestas: «Sin dato» en todas las superficies y una sola fórmula de CAC y payback

**Tipo:** Feature · **Prioridad propuesta:** Alta
**Estado:** Aprobado el 2026-11-09 por delegación de Fede («sí, ese alcance, ejecuta todo tú»), tras dos pasadas del gate · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-11-09
**Ticket:** NK-0094
**PRD:** No aplica (continuación de NK-0068 con alcance aprobado por Fede el 2026-11-09: no añade capacidad nueva, cambia cómo se calculan y rotulan cifras que ya existen; ver §15.1) · **Depende de:** `SDD-20261106-metrics-honest-data` (NK-0068, Hecho) y `SDD-20261106-ux-metrics-data-state` (NK-0089, Hecho: `DataState`)
**Coordinar con:** NK-0029 / `SDD-20261030-gtm-control-tower-3-attribution-metrics` (aprobado, LOGGED; su CA-18 documenta en el diccionario las fórmulas de CAC, payback y win rate: con este SDD hay una de cada, §14); `SDD-20261030-gtm-control-tower-5c-assistant-server` (aprobado; CA-1: el asistente y MCP leen las mismas funciones; este SDD cambia la salida de `get_real_metrics`, `get_segment_coverage` y `get_funnel_diagnosis`, §14); NK-0091 (asesor: deals sin origen aparte de Outbound; ya integrado en `integration/sprint2-20261109`, mismo archivo `advisor.ts`); NK-0093 (estado de carga y error de leads en `pipeline-board-panel.tsx`; ya integrado, mismo archivo); NK-0097 (tamaño de las marcas de dato; mismas marcas); NK-0096 (Reglas en MCP; mismo `.lovable/mcp/manifest.json`)

> Sprint 2 de mejoras en pantallas core. Resto de NK-0068: Sprint 1 rotuló los supuestos solo en `/metrics` sin cambiar ninguna cifra porque `/strategy` estaba congelada (NK-0068 §15.1). Ahora `/strategy` se descongela.

## 1. Resumen
Hoy un supuesto del código (margen del 100 % cuando falta, ACV de `mínimo × 1,5`, coste compartido repartido a partes iguales cuando nadie ganó, payback con el CAC objetivo) sigue produciendo una cifra en `/strategy`, Inicio, MCP y el asesor, y solo `/metrics` lo rotula. Este cambio hace que **un supuesto deje de producir cifra** y pase a «Sin dato · motivo» en todas las superficies, salvo los casos que este SDD decide mantener como «Estimado · motivo» declarado (tabla de decisiones, §6). Además, CAC y payback se calculan en **un solo módulo puro** (`src/lib/unit-economics.ts`) que usan todas las superficies, la red de congelación de NK-0068 (`src/lib/strategy-freeze.test.ts`) se sustituye por un test de coherencia entre superficies, y cada win rate dice su ventana.

## 2. Problema y para quién
Owner y Sales Leader (y sus asistentes por MCP) ven el payback y el CAC de un mismo segmento y trimestre con valores distintos según la pantalla, y en `/strategy`, Inicio y MCP ven cifras que salen de supuestos sin que nada lo diga. Deciden presupuesto y canal sobre esas cifras.

## 3. Evidencia y por qué ahora
Leído en `origin/main` @ `f59681f` (worktree `docs/sprint2-sdds-20261109`). No he ejecutado pruebas.

**Base de construcción: la rama `integration/sprint2-20261109`** (no `main`). Ya contiene NK-0091 (`src/lib/advisor.ts` y su test), NK-0098 (`src/routes/_authenticated/route.tsx`, `src/lib/session-check.ts`) y NK-0093 (`src/hooks/use-leads.ts`, `src/components/stripe-panel.tsx`, `src/lib/drive-core.ts`, `src/components/leads/lead-funnel-panel.tsx`, `src/routes/_authenticated/leads.index.tsx` y, en `src/components/pipeline-board-panel.tsx`, solo el estado de carga y error de leads, `:34` y `:113-130` de esa rama). De los archivos que toca este SDD, solo `advisor.ts`, `advisor.test.ts` y `pipeline-board-panel.tsx` difieren de `f59681f`; sus citas se dan con la línea de la rama de integración (en `pipeline-board-panel.tsx`, las líneas posteriores a la `:110` se desplazan +3 respecto a `main`). El resto de citas valen en las dos.

**Por qué ahora.** NK-0068 §15.1 dejó abierta la pregunta «¿abrimos en Sprint 2 el cambio a «Sin dato» en todas las superficies a la vez, junto con unificar CAC y payback?»; Fede aprobó el alcance del Sprint 2 el 2026-11-09. NK-0089 §15.4 añadió a este ticket los «—» de `/metrics` que significan «falta el dato» (decisión del coordinador del 2026-11-07).

**3.1 Fórmulas de CAC vivas (4 reales + 1 de plan)**
| # | Dónde | Regla | Superficies |
|---|---|---|---|
| C1 | `src/lib/cac.ts:31-60` (`segmentCac`) | (coste directo + parte del compartido) / ganados del segmento en el periodo, asignados con `assignSegment` | Cobertura y CAC real (`/metrics`), Payback real (`/strategy`) e Inicio vía `paybackByQuarter` (`segment-coverage.ts:184-221`), Presupuesto vs real y Presupuesto por segmento vía `periodBudget` (`segment-budget.ts:207-211`, `:246`), Diagnóstico (`funnel-diagnosis.ts:122`), `get_segment_coverage` (`mcp/tools/metrics.ts:55`, `:62`) |
| C2 | `src/lib/pipeline-real.ts:70-82` (`trailingCac`) | C1 sobre los costes de los últimos 4 trimestres y los ganados desde el inicio del más antiguo hasta hoy | Modelos de venta (`motions.tsx:146`, `:159`, `:444-447`, `:179-183`) |
| C3 | `src/lib/quarter-kpis.ts:75` (`kpiTotals`) | suma de la captación por segmento / suma de clientes nuevos por segmento; los ganados que no caen en ningún segmento no cuentan (`segment-budget.ts:196-205`) | KPI trimestral de `/metrics` (`quarter-kpis-panel.tsx`) |
| C4 | `src/lib/pipeline-board.ts:239-241` (`pipelineEconomics`) | coste total del trimestre / **todos** los ganados del trimestre (`pipeline-board-panel.tsx:91`, `:93`); proyectado `p.cost / expectedWins` con los abiertos que cierran × win rate de 365 días (`pipeline-board.ts:241`) | Tablero de Rendimiento (`pipeline-board-panel.tsx:187`, `:193`) |
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
Agregados de empresa: P-a, media de paybacks por segmento ponderada por clientes (`quarter-kpis.ts:37-41`), en el KPI trimestral; P-b, CAC de empresa C4 / (ACV `actuals` × margen M5 / 12) (`pipeline-board.ts:242-245`), en el tablero (`pipeline-board-panel.tsx:203-229`).
En Modelos de venta hay además un segundo payback en la misma pantalla: con base «real» y CAC real, el plan usa el CAC real y el win rate real (`motions.tsx:169-170`), se rotula «Payback real» (`:505`) y se calcula con el ACV de la calculadora (`:172`) y el margen M3 (`:176`); con base «objetivo» (o sin CAC real) se rotula «Payback estimado» y usa `cac_target` con el mismo ACV de la calculadora. Es distinto de `paybackReal` (`:179-183`, mostrado en `:454`). Ambos en `/metrics`, mismo trimestre, cifras distintas.
Consecuencia comprobada en código: con un deal ganado con líneas y sin margen real de presupuesto, el payback del mismo segmento y trimestre difiere entre Cobertura/Payback real/MCP (M1) y Presupuesto vs real/KPI (M2), y Diagnóstico (M4) usa otro margen distinto.

**3.3 Supuestos que siguen produciendo cifra fuera de `/metrics`** (A1-A7 de NK-0068 §3; ninguna de estas superficies importa `DataMark` ni `DataState`, comprobado con grep)
| Superficie | Supuestos que muestra sin decirlo |
|---|---|
| Payback real (`/strategy?tab=payback`, `payback-quarters.tsx:168-195`) | A2, A4 (ACV del rango), A5 (margen 100 %; con margen ≤ 0 pinta `Infinity` o un payback negativo en verde: `ok` sale `true`, `segment-coverage.ts:216` → `payback-quarters.tsx:178`) |
| Inicio, tarjeta de payback (`payback-card.tsx:78-106`, montada en `home.tsx:125`) | Los mismos que Payback real; además cuenta esos segmentos en «X de Y dentro del objetivo» (`segment-coverage.ts:240-241`) |
| Presupuesto vs real (`budget-quarters.tsx:153-162`, `:213-218`) | A2, A3 (gasto de captación por segmento), A4, A5 en plan (`segment-budget.ts:238`) y real; `pb()` pinta en verde un payback negativo |
| Modelos de venta (`motions.tsx`) | ACV de ejemplo 20.000 o media de puntos medios (`:149-156`); «margen bruto 100%» escrito cuando falta (`:521`); payback real con el ACV de la calculadora (`:181`) y fila «Payback real» del plan con ese mismo ACV (`:172`, `:505`); cabecera «Real (12 meses)» (`:416`) sobre un ACV de todo el histórico (`pipeline-real.ts:37-39`) |
| Diagnóstico AARRR (`funnel-diagnosis.ts:97-105`) | A5 con el margen objetivo (M4); con margen 0 el valor es `Infinity` y el veredicto «fuga»; con margen negativo, «en_objetivo» |
| `get_segment_coverage` (`mcp/tools/metrics.ts:34-71`) | A2-A5; payback con CAC objetivo (`payback.source: "objetivo"`, `segment-coverage.ts:127-129`); `Infinity` sale como `null` en el JSON (`mcp/context.ts:23`, `JSON.stringify`) y un payback negativo sale tal cual |
| `get_real_metrics` (`mcp/tools/metrics.ts:13-32`) | Descripción «últimos 12 meses» (`:16`), pero el ACV es de todo el histórico y puede ser la media de deals abiertos (`pipeline-real.ts:37-44`); sin ventana ni origen en la salida |
| Asesor y `get_overview` (`advisor.ts:139`, `:209` en la rama de integración; `agent/tools/core-read.ts:29`, `:63`; `ai.functions.ts:129`) | Win rate de todo el histórico sin decirlo; 0 % cuando no hay cerrados (`metrics.ts:114-117`) |

**3.4 Ventanas de win rate** (NK-0068 §14): histórico (asesor, rama de integración: `advisor.ts:112` por fuente, `:139` global, `:209` por segmento), 365 días (`actuals`, `pipeline-real.ts:30-33` → `get_real_metrics`, tablero, Modelos de venta) y trimestre (`segmentCoverage`, `segment-coverage.ts:114-124` → Cobertura, Diagnóstico, `get_segment_coverage`; win rates de `/metrics`, `src/lib/metrics-quarter.ts`). Rotuladas hoy: `/metrics` (NK-0068 CA-3) y la pista del tablero (`pipeline-board-panel.tsx:197-198`). Sin rotular: Cobertura, Modelos de venta (la cabecera mezcla ventanas; además «Win rate real» en las tarjetas de segmento, `motions.tsx:594`, y en la tabla, `:682`), MCP y asesor.

**3.5 Red de congelación de NK-0068.** `src/lib/strategy-freeze.test.ts` (547 líneas) fija las cifras de 14 funciones y la salida de los dos handlers MCP sobre una fixture ficticia que recorre A2-A7 (`:488-541`). Su propósito era impedir lo que este SDD hace a propósito: cambiar cifras compartidas. Su fixture se reutiliza.

**3.6 «—» que significan «falta el dato».** El gate de NK-0089 contó unas 52 líneas con «—» en 11 archivos de `/metrics` (NK-0089 §3). Mi grep sobre las superficies de este SDD (líneas, no textos visibles, comentarios incluidos en la cuenta de prosa): `motions.tsx` 23, `budget-quarters.tsx` 10, `budget-panel.tsx` 9, `segment-coverage.tsx` 8, `cac-panel.tsx` 8, `finance-panel.tsx` 7, `revops-panels.tsx` 6, `quarter-kpis-panel.tsx` 6, `pipeline-board-panel.tsx` 5, `payback-card.tsx` 4, `payback-quarters.tsx` 1 (`:171`, añadido por el gate). Sin clasificar entre «no aplica» y «falta el dato»: lo hace U-0.

**Uso:** sin dato (no hay analítica de `/metrics`, `/strategy` ni de llamadas MCP).

## 4. Resultado buscado
| Medida | Línea base (código, §3) | Objetivo |
|---|---|---|
| Implementaciones de CAC real | 4 (C1-C4) | 1 función (`cacOf`); las ventanas se pasan como dato y se rotulan |
| Agregados de payback de empresa | 2 (P-a, P-b) | 1 |
| Cadenas de margen que alimentan un payback | 5 (M1-M5) | 1 |
| Reglas de ACV que alimentan un payback rotulado «Real» | 3 (`segmentAcv`, `actuals`, ACV de la calculadora en «Payback real» de Modelos de venta, `motions.tsx:172`, `:181`, `:505`) | 1 (`acvFor`). El ACV que escribes en la calculadora solo alimenta su payback de escenario, rotulado «Estimado · con el ACV de la calculadora» (D14) |
| Herramientas MCP de métricas con costes, margen o CAC sin comprobar rol | 2 (`get_real_metrics`, `get_segment_coverage`: `mcp/tools/metrics.ts:19-20`, `:40-41`) | 0 (CA-15) |
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
- Guarda de rol en `get_real_metrics` y `get_segment_coverage`: solo Owner y Sales Leader (decisión 12 del §15, CA-15).
- Las tres consultas del navegador que pasan a leer `deals.gross_margin` para la cadena única de margen (§8, §10).

**No incluye:**
- Unificar las ventanas de win rate: siguen siendo tres, cada una rotulada (§15.5).
- Deals sin origen en el asesor: lo entregó NK-0091 (ya en la rama de integración). Tampoco la asignación del win rate por segmento del asesor por `segment_id` sin `assignSegment` (rama de integración, `advisor.ts:187-189`, `:209`) (§15.6).
- Los «—» de `/metrics` fuera de las superficies de CAC, payback, ACV, margen y win rate: Finanzas (`finance-panel.tsx`), paneles de RevOps (`revops-panels.tsx`), ciclo de venta, cobertura de pipeline, Embudo, Perdidos, Cohortes y Tendencias. La decisión 4 del §15 de NK-0089 (`SDD-20261106-ux-metrics-data-state.md:145`) los añadió a NK-0094; por la decisión 13 del §15 de este SDD pasan a un ticket nuevo que registra el coordinador. Este SDD no los clasifica ni los toca.
- A8 (`revops.ts:26-27`, NK-0092) y A9.
- Diccionario de métricas, canal y público (NK-0029). Este SDD solo deja una fórmula que el diccionario documentará.
- Tamaño de letra de las marcas (NK-0097) y forma visual (`DataState`, ya entregado por NK-0089).
- Finanzas (`finance-dashboard.ts`, `finance-panel.tsx`): ROI y gasto, sin CAC ni payback; sus «—» van al ticket nuevo de arriba.
- Ciclo de venta, cobertura de pipeline, Embudo, Perdidos, Cohortes y Tendencias (sus «—», al ticket nuevo de arriba).
- La guarda de rol del resto de herramientas MCP fuera de `src/lib/mcp/tools/metrics.ts`: sigue pendiente de 5c CA-1.
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
| D8 | A2: deal asignado por importe (`segment-coverage.ts:70-74`) | **Se queda como «Estimado · N de M asignados por importe»**, ahora también en Payback real, Inicio, Presupuesto vs real, Diagnóstico y MCP. | Regla determinista sobre los rangos de la empresa (`assignSegment`, `segment-coverage.ts:70-74`, compartida por todas las superficies); quitarla sacaría ganados de los denominadores del CAC. La marca ya existe en `/metrics` (NK-0068 CA-5). (El detector `strategy-segments.ts:61` solo pide asignar los deals abiertos que no caen en ningún segmento; no respalda esta decisión.) |
| D9 | Payback con CAC objetivo en Cobertura y MCP (`segment-coverage.ts:127-129`) | **Se elimina** (§15.3). Solo hay payback con CAC real; sin él, «Sin dato · falta CAC real». | `funnel-diagnosis.ts:97`: «with the target CAC it would compare the target with itself». |
| D10 | A6: margen = media sin ponderar de márgenes objetivo (tablero) | **Se elimina con P-b.** El tablero muestra el payback de empresa único (P-a) y deja de calcular el suyo (§15.4). | Dos paybacks de empresa en la misma pantalla (§3.2). |
| D11 | Ganados sin segmento fuera del CAC de empresa (C3) | **Se elimina.** CAC de empresa = coste del periodo / todos los ganados del periodo (regla de C4). | Coste gastado y cliente ganado aunque no tenga segmento. |
| D12 | Modelos de venta: ACV de ejemplo 20.000 (`motions.tsx:156`) | **Se elimina** (§15.7). Sin deals ni rangos, el campo queda vacío y los resultados dicen «Sin dato · falta ACV» hasta que lo escribas. | Cifra genérica sin fuente. |
| D13 | Modelos de venta: media de puntos medios de los rangos (`motions.tsx:149-154`) | **Se queda como «Estimado · media de los rangos de tus segmentos»** (ya lo dice el texto, `:355`; pasa a marca). | Rangos de la empresa. |
| D14 | Modelos de venta: fila de payback del plan (`motions.tsx:504-507`), calculada con el ACV de la calculadora (`:172`) y el margen M3 (`:176`). Con base «real» y CAC real usa CAC y win rate reales (`:169-170`) y se rotula «Payback real»; con base «objetivo» (o sin CAC real) usa `cac_target` y se rotula «Payback estimado» | **(a) Base «real»:** la fila «Payback real» muestra el mismo `Figure` que `paybackReal` (`acvFor` y `segmentMargin`, decisión 11 del §15), nunca el ACV de la calculadora; sin ACV real, «Sin dato · falta ACV del segmento». **(b) Base «objetivo»:** se queda como escenario, rotulado «Estimado · con el ACV de la calculadora», con el margen de `segmentMargin`. La línea «Dentro/Fuera del payback objetivo» (`:515-529`) juzga la cifra de la fila y solo con estado «real» o «estimado». | Hoy la misma pantalla enseña un «Payback real» con una segunda regla de ACV (§3.2). |
| D15 | Margen de Modelos de venta (M3) y de Diagnóstico (M4) | **Se unifican en M1** (la cadena única). | §3.2. |

**Añadido:** `src/lib/unit-economics.ts`; marcas «Real», «Estimado · motivo» y «Sin dato · motivo» en Payback real, Inicio, Presupuesto vs real, Modelos de venta; campos de estado y motivo en MCP; guarda de rol en las dos herramientas MCP de métricas (CA-15); ventana en cada win rate; `src/lib/metrics-coherence.test.ts` y `src/lib/metrics-formulas-single.test.ts`.
**Modificado:**
- Payback sin margen: cifra al 100 % → «Sin dato · falta margen», en todas las superficies.
- Payback con margen ≤ 0: `Infinity`/negativo (fuera de `/metrics`) → «Sin dato · margen 0 % o negativo», tono neutro.
- ACV `mínimo × 1,5` → «Sin dato · falta el máximo del rango de ACV»; ACV 0 sin rango → «Sin dato · falta rango de ACV».
- Compartido sin ganados: repartido → no repartido, con su marca; total de empresa igual.
- Cobertura y `get_segment_coverage`: payback con CAC objetivo → «Sin dato · falta CAC real».
- KPI trimestral: CAC = coste / todos los ganados; payback = P-a con la marca de cobertura parcial (§9).
- Tablero: «Payback real → proyectado» → «Payback real» igual al del KPI; el CAC proyectado queda como «Estimado · proyección con win rate de los últimos 365 días» (§15.4).
- Diagnóstico y `get_funnel_diagnosis`: margen M4 → M1.
- Modelos de venta: margen M3 → M1; CAC real con la fórmula única y ventana «Últimos 4 trimestres»; payback real (`:454`) y fila «Payback real» del plan (`:505`) con el mismo `Figure` (ACV de `acvFor`), nunca el de la calculadora; con base objetivo, «Payback estimado» → «Estimado · con el ACV de la calculadora» (D14); cabecera «Real (12 meses)» → una ventana por fila; «Win rate real» de `:594` y `:682` con su ventana.
- MCP `get_real_metrics` y `get_segment_coverage`: cualquier miembro → solo Owner y Sales Leader (CA-15).
- Asesor y `get_overview`: win rate 0 % sin cerrados → null con su motivo; ventana «todo el histórico» en la salida.
- «—» de falta de dato (CAC, payback, ACV, margen, win rate) en las superficies del alcance → «Sin dato · motivo».
**Eliminado:** los supuestos D1-D4, D7, D9-D12; `boardMargin` y el payback propio del tablero; las marcas de NK-0068 «Estimado · margen del 100 % supuesto (falta margen)», «Estimado · mínimo del rango × 1,5» y «Estimado · repartido a partes iguales (nadie ganó)»; `src/lib/strategy-freeze.test.ts`.

## 7. Historias y criterios de aceptación
Sin PRD: los CA no citan G-n. Marcas: la forma de NK-0068 CA-10 (`^(Real( · .+)?|Estimado · .+|Sin dato · .+)$`, atributo `data-mark`) pintada con `DataState` (NK-0089); la comprobación compartida `src/test/data-marks.ts` se reutiliza sin quitar aserciones. Fixture: la de `strategy-freeze.test.ts`, movida a `src/test/metrics-fixture.ts` y ampliada (§13). Ningún dato real.

### H-1: Como Owner o Sales Leader, quiero que el CAC y el payback de un segmento y trimestre sean el mismo número en cualquier pantalla o asistente, para no tener que elegir cuál creer.
- **CA-1** `src/lib/unit-economics.ts` exporta, puras: `cacOf({ cost, won, period })`, `paybackOf({ cac, acv, margin })`, `segmentMargin(seg, { quarter, year, deals })`, `acvFor(seg, deals)`, `companyCac({ cost, won, period })`, `companyPayback(rows)` y `WIN_RATE_WINDOWS`. `period` es el texto que entra en el motivo («2026-Q3», «los últimos 4 trimestres»). El nombre `segmentMargin` evita chocar con el parámetro `marginChain` de `periodBudget` (`segment-budget.ts:194`, `:245`). Cada cifra es un `Figure = { value: number | null; state: "real" | "estimado" | "sin_dato"; reason: string | null }`. Reglas: `cacOf` da «Sin dato · sin costes en {periodo}» con coste null o 0 y «Sin dato · ningún deal ganado en {periodo}» con 0 ganados; `paybackOf` = CAC / (ACV × margen / 12), null con el motivo de la primera entrada «sin_dato» (orden CAC, ACV, margen), null con «margen 0 % o negativo» si margen ≤ 0, «estimado» si alguna entrada lo es (motivos unidos con «, »), y nunca devuelve `Infinity`, `NaN` ni un número negativo. · prueba: `src/lib/unit-economics.test.ts`
- **CA-2** Fuera de `src/lib/unit-economics.ts` (y de los tests) ningún archivo de `src/` calcula un CAC o un payback por su cuenta: el escaneo no encuentra `/ 12` aplicado a un ACV por margen, ni `cost / customers`, `cost / won`, `cost / expectedWins`, `acquisition / newCustomers` o `planAcq / planNew`. El escaneo recorre `src/**/*.{ts,tsx}` y excluye `*.test.ts`, `*.test.tsx` y `src/test/`. El CAC proyectado del tablero no es excepción: `pipelineEconomics` lo calcula como `cacOf({ cost, won: expectedWins, period })` y lo devuelve con estado «estimado» y el motivo «proyección con win rate de los últimos 365 días» (CA-6). Falla primero en la base por `metrics.ts:96`, `cac.ts:57`, `quarter-kpis.ts:75`, `pipeline-board.ts:239-241` (incluido el proyectado de `:241`) y `segment-budget.ts:234`. · prueba: `src/lib/metrics-formulas-single.test.ts`
- **CA-3** Coherencia, con la fixture y un trimestre T: para cada segmento, el CAC real y el payback real (valor, estado y motivo) son iguales en `segmentCoverage` (Cobertura, CAC real), `paybackByQuarter` (Payback real, Inicio), `quarterlyBudget(...).byQuarter[T]` (Presupuesto vs real, KPI) y la salida de `segmentCoverageTool` (`get_segment_coverage`, tras el redondeo a un decimal de `:11`); el payback es igual en `funnelDiagnosis` (Diagnóstico, `get_funnel_diagnosis`); el margen usado es el mismo en todas. Para la empresa, CAC y payback de `quarterKpis` son iguales a los que muestra el tablero, y el gasto de captación de empresa es igual a la suma de todos los costes del trimestre (también con compartido y nadie ganado, y también en una empresa sin segmentos: ahí el KPI y el tablero dan el mismo CAC de empresa, coste / ganados del trimestre, aunque no haya filas de segmento). La calculadora de Modelos de venta (`src/lib/strategy-calculator.ts`, §13), con su ventana de 4 trimestres, da lo mismo que `paybackOf(cacOf(costes y ganados de esa ventana), acvFor, segmentMargin del trimestre actual)`, y con base «real» la fila de payback del plan es el mismo `Figure` que `paybackReal` (D14a). Falla primero en la base (como mínimo por M1 frente a M2 y M4, y por C3 frente a C4). · prueba: `src/lib/metrics-coherence.test.ts`
- **CA-4** `src/lib/strategy-freeze.test.ts` desaparece en la misma unidad en que cambian las cifras (U-2), y `metrics-coherence.test.ts` guarda evidencia de que falla con dos mutaciones: (1) `quarterlyBudget` vuelve a la cadena M2; (2) `pipelineEconomics` vuelve a dividir por `p.won` propio con otra lista de ganados. · prueba: `src/lib/metrics-coherence.test.ts` (evidencia en `.factory/evidence/NK-0094/`)

### H-2: Como Owner o Sales Leader, quiero que un supuesto no se presente como cifra en ninguna superficie, para no decidir sobre él.
- **CA-5** Funciones compartidas, con la fixture: segmento sin margen en toda la cadena → payback null, «Sin dato · falta margen» (D1); margen ≤ 0 → null, «Sin dato · margen 0 % o negativo», y `payback.ok`, `planOk`, `realOk` y el veredicto de Diagnóstico null (D2); `acv_min` sin `acv_max` ni deals → ACV null, «Sin dato · falta el máximo del rango de ACV», y `won.target`, `opps.target` y payback null (D3); sin rango ni deals → ACV null, «Sin dato · falta rango de ACV» (D4); punto medio → «Estimado · punto medio del rango» (D5); solo abiertos → «Estimado · media de deals abiertos» (D6); compartido con nadie ganado → `shared` 0 por segmento y `sharedSplit: "sin_reparto"`, y el total de empresa de `kpiTotals` incluye ese compartido (D7); deals asignados por importe → los contadores de NK-0068 CA-5 también en `paybackByQuarter` y `funnelDiagnosis` (D8); Cobertura sin CAC real → payback null, «Sin dato · falta CAC real», sin `source: "objetivo"` (D9); CAC de empresa = coste / todos los ganados del periodo (D11). · prueba: `src/lib/unit-economics.test.ts`, `src/lib/segment-coverage.test.ts`, `src/lib/segment-budget.test.ts`, `src/lib/cac.test.ts`, `src/lib/quarter-kpis.test.ts`, `src/lib/pipeline-board.test.ts`, `src/lib/funnel-diagnosis.test.ts`
- **CA-6** `/metrics`: Cobertura, CAC real, Presupuesto por segmento, KPI trimestral y tablero pintan las marcas que dan los `Figure` (textos del §9). Ningún archivo de `src/` que no sea test (se excluyen `*.test.ts`, `*.test.tsx` y `src/test/`) contiene «margen del 100 % supuesto», «mínimo del rango × 1,5» ni «repartido a partes iguales»; hoy están en `src/components/metrics/mark-text.ts:15`, `:23`, `:33`. El tablero tiene una sola cifra de payback, igual a la del KPI, y su CAC proyectado lleva «Estimado · proyección con win rate de los últimos 365 días». · prueba: `src/components/segment-coverage.test.tsx`, `src/components/cac-panel.test.tsx`, `src/components/budget-panel.test.tsx`, `src/components/quarter-kpis-panel.test.tsx`, `src/components/pipeline-board-panel.test.tsx`, `src/lib/metrics-formulas-single.test.ts` (textos prohibidos)
- **CA-7** Payback real (`/strategy?tab=payback`) e Inicio: una celda sin payback muestra «Sin dato · motivo» (sin costes, ningún ganado, falta margen, margen 0 % o negativo, falta ACV), nunca «—» ni «sin costes» suelto; una celda con entradas estimadas lleva su marca «Estimado · …»; un payback solo es verde o rojo con estado «real» o «estimado» y objetivo; la tarjeta de Inicio cuenta como medidos solo los segmentos con payback no null. · prueba: `src/components/payback-quarters.test.tsx`, `src/components/payback-card.test.tsx`, `src/lib/segment-coverage.test.ts` (`paybackSummary`)
- **CA-8** Presupuesto vs real (`/strategy?tab=budget`): payback presupuestado y real, CAC real y gasto de captación siguen D1-D3, D7 y D8 con sus marcas; ningún payback negativo ni `Infinity`; un payback sin dato no tiene desvío (`Deviation` recibe null). La nota del pie (`budget-quarters.tsx:406-409`) describe las dos cadenas con los textos del §9: la del real (cadena única) y la del presupuestado (margen de plan y, sin él, el objetivo del segmento, `segment-budget.ts:238`). · prueba: `src/components/budget-quarters.test.tsx`
- **CA-9** Modelos de venta: sin deals ni rangos, el ACV queda vacío y deals, oportunidades y payback dicen «Sin dato · falta ACV» (D12); con rangos, «Estimado · media de los rangos de tus segmentos» (D13); con base «real», la fila «Payback real» del plan (`motions.tsx:505`) muestra el mismo valor, estado y motivo que el payback real de la tabla (`:454`), los dos con `acvFor` y `segmentMargin`, y sin ACV real ambos dicen «Sin dato · falta ACV del segmento»: con un ACV de calculadora distinto del ACV real del segmento la cifra no cambia (D14a); con base «objetivo», la fila se rotula «Payback estimado» con la marca «Estimado · con el ACV de la calculadora» (D14b); «Dentro/Fuera del payback objetivo» solo aparece con una cifra «real» o «estimado»; nunca se escribe «margen bruto 100%» si falta el margen (`:521`). · prueba: `src/lib/strategy-calculator.test.ts`, `src/components/strategy/motions.test.tsx`
- **CA-10** Diagnóstico AARRR y `get_funnel_diagnosis`: el payback usa `segmentMargin` (D15); sin margen o con margen ≤ 0 la medida es «sin datos» con el motivo de CA-5 y sin veredicto. `loadFunnelDiagnosis` lee `segment_budget_quarters` del año y `deals.gross_margin` con `org_id` explícito (también por el cliente privilegiado del agente). La salida de `get_funnel_diagnosis` no lleva costes, margen ni CAC (solo meses de payback, objetivo, veredicto y motivo), por eso no se le pone guarda de rol (decisión 12 del §15); el test lo fija: ninguna clave `cost`, `gross_margin`, `margin` ni `cac` en su salida. · prueba: `src/lib/funnel-diagnosis.test.ts`, `src/lib/agent-tools.test.ts` (`expectScoped` sobre `get_funnel_diagnosis` y claves de la salida, en un `describe` propio de NK-0094)
- **CA-11** `get_segment_coverage`: cada segmento devuelve `acv: { value, state, reason }`, `cac: { …, state, reason }`, `payback: { real, state, reason, target, ok, window }` y `win_rate: { …, window: "trimestre" }`; ningún valor es negativo ni null por `Infinity`; desaparece `payback.source: "objetivo"`. `get_real_metrics` devuelve por total y por segmento `win_rate_window: "ultimos_365_dias"`, `acv_window: "todo_el_historico"` y `acv_source`. Sus descripciones lo dicen y `.lovable/mcp/manifest.json` coincide con ellas. · prueba: `src/lib/mcp/tools/metrics.test.ts`
- **CA-12** Asesor y `get_overview`: sin deals cerrados, `win_rate_global_pct` y el `win_rate_pct` de cada segmento son null (no 0); la salida lleva `ventana_win_rate: "todo el histórico"` en el pipeline (cubre `win_rate_global_pct` y `win_rate_por_fuente` de NK-0091) y en cada segmento. El null se pone en el asesor, no en `winRate` de `src/lib/metrics.ts:114-117`, que tiene otros llamadores. · prueba: `src/lib/advisor.test.ts` (rama de integración; `describe` propio de NK-0094)
- **CA-13** «—» de falta de dato: en las superficies de §5 «Incluye», una cifra de CAC, payback, ACV, margen o win rate que falta se pinta como `[data-mark="sin_dato"]` con su motivo; un «—» solo queda donde U-0 lo clasificó «no aplica» (lista cerrada en el propio test). · prueba: los tests de componente de CA-6 a CA-9 llamando a `expectDataMarks` y a una aserción nueva `expectNoBareDash(root, allowed)` en `src/test/data-marks.ts`

### H-3: Como Owner o Sales Leader, quiero saber de qué periodo sale cada win rate.
- **CA-14** Cada win rate visible dice su ventana con los textos de `WIN_RATE_WINDOWS`: Cobertura «Trimestre {T}»; tablero «Últimos 365 días» junto a la cifra (no solo en la pista); Modelos de venta, por fila: ACV «Todo el histórico», win rate y ciclo «Últimos 365 días», CAC y payback «Últimos 4 trimestres», y el «Win rate real» de las tarjetas de segmento (`motions.tsx:594`) y de la tabla (`:682`) con «Últimos 365 días»; los win rates de `/metrics` mantienen «{n} cerrados en {T}» (NK-0068 CA-3). · prueba: `src/components/segment-coverage.test.tsx`, `src/components/pipeline-board-panel.test.tsx`, `src/components/strategy/motions.test.tsx`, `src/lib/unit-economics.test.ts` (constantes)

### H-4: Como Owner, quiero que solo Owner y Sales Leader vean por MCP costes, margen y CAC, como en la app.
- **CA-15** `get_real_metrics` (`realMetrics`) y `get_segment_coverage` (`segmentCoverageTool`) comprueban, tras `mcpCtx`, que `c.roles` incluye `owner` o `sales_leader`; si no, lanzan `ToolError("Tu rol en esta empresa no permite esta acción")` (el mismo texto que `mcp/tools/agent-tools.ts:153`) sin leer ninguna tabla. Con `["owner"]` y con `["sales_leader"]` devuelven datos; con `["ae"]`, `["marketing"]` y `[]` rechazan, y la `db` falsa registra cero lecturas. Sus descripciones dicen «Solo Owner y Sales Leader» y `.lovable/mcp/manifest.json` coincide. Falla primero en la base: hoy no hay comprobación (`mcp/tools/metrics.ts:19-20`, `:40-41`) y `["ae"]` recibe datos. · prueba: `src/lib/mcp/tools/metrics.test.ts`

## 8. Casos límite y errores
- Trimestre sin costes y sin ganados: CAC y payback «Sin dato · sin costes en {T}» (CA-1, CA-7).
- Costes sin ganados: «Sin dato · ningún deal ganado en {T}»; el compartido no se reparte (D7, CA-5).
- Ganado sin segmento que no cae en ningún rango: cuenta en el CAC de empresa (D11) y en ningún segmento; el KPI dice cuántos (§9).
- Deal que apunta a un segmento borrado: asignado por importe (D8). Los costes de un segmento borrado se borran en cascada (`drizzle/migrations/0015_cac_costs.sql:4`).
- Margen exactamente 0: «Sin dato · margen 0 % o negativo» (D2).
- `acv_min` 0 sin máximo: hoy da ACV 0 con `minimo_x1_5` (`segment-coverage.ts:41`); pasa a «Sin dato · falta el máximo del rango de ACV» (D3).
- KPI de empresa con unos segmentos con payback y otros sin dato: valor sobre los que tienen dato, con marca «Estimado · calculado sobre {k} de {m} segmentos con clientes» (§15.8). Ningún segmento con payback: «Sin dato · ningún segmento con payback».
- Multitenant y consultas que cambian (todas leen tablas y columnas que RLS ya da a cualquier miembro):
  - Nueva por el servidor: `loadFunnelDiagnosis` (CA-10) añade `segment_budget_quarters` del año y `deals.gross_margin` (`funnel-diagnosis-data.ts:19`), con `.eq("org_id", orgId)` explícito porque el agente la ejecuta con el cliente privilegiado.
  - Ampliadas en el navegador, para que `periodBudget` use la cadena única de margen (que necesita el margen de los deals ganados con líneas): la lectura de `deals` de Presupuesto vs real (`src/components/budget-quarters.tsx:74`), del KPI trimestral (`src/components/quarter-kpis-panel.tsx:67`) y de Presupuesto por segmento (`src/components/budget-panel.tsx:45`) añade `gross_margin` a su `select`. Sin `org_id`: van por RLS como el resto de consultas del navegador.
  - Sin exposición nueva: `deals.gross_margin` ya lo leen en el navegador Payback real (`payback-quarters.tsx:31`) y Cobertura (`segment-coverage.tsx:53`), y `segment_budget_quarters` lo lee cualquier miembro (`drizzle/migrations/0017_segment_budget_quarters.sql:21-22`).
  - El resto son las mismas consultas.
- Rol en MCP: un miembro sin rol Owner ni Sales Leader que llame a `get_real_metrics` o `get_segment_coverage` recibe «Tu rol en esta empresa no permite esta acción» y no se lee nada (CA-15).
- Empresa sin segmentos: KPI y tablero dan el mismo CAC de empresa (coste / ganados del trimestre); el payback de empresa es «Sin dato · ningún segmento con payback» (CA-3).
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
- «Estimado · media de los rangos de tus segmentos», «Estimado · con el ACV de la calculadora» (payback de escenario con base objetivo, D14b)
- «Estimado · calculado sobre {k} de {m} segmentos con clientes» (sustituye «Estimado · supuestos en algún segmento (ver Cobertura)» y «Sin dato · un segmento tiene margen 0 % o negativo» del KPI)
- «Estimado · proyección con win rate de los últimos 365 días»
- Ventanas (texto plano, no marca): «Todo el histórico», «Últimos 365 días», «Trimestre {T}», «Últimos 4 trimestres».
- KPI de empresa con ganados sin segmento: pista «{n} ganados sin segmento cuentan en el CAC de empresa».
- Pies de Payback real (`payback-quarters.tsx:88-91`) y Presupuesto vs real (`budget-quarters.tsx:406-409`): «El margen sale, por este orden, del presupuesto real del trimestre o del año, de los deals ganados con líneas, del presupuesto planificado y del margen objetivo del segmento. Sin ninguno, no hay payback.»
- Solo en el pie de Presupuesto vs real, a continuación: «El payback presupuestado usa el margen presupuestado y, sin él, el margen objetivo del segmento.»
- Descripciones de `get_real_metrics` y `get_segment_coverage`: añaden «Solo Owner y Sales Leader.» (CA-15). Error de rol: «Tu rol en esta empresa no permite esta acción» (ya existe en `mcp/tools/agent-tools.ts:153`).

## 10. Datos, permisos y privacidad
Sin tablas, columnas, RLS ni GRANT nuevos.

**Lecturas que cambian (lista cerrada):**
- Nueva por el servidor: `loadFunnelDiagnosis` añade `segment_budget_quarters` del año y `deals.gross_margin`, con `.eq("org_id", orgId)` como el resto de sus lecturas (`funnel-diagnosis-data.ts:16-25`), porque el agente la ejecuta con el cliente privilegiado (`src/lib/AGENTS.md`, registro del agente).
- Ampliadas en el navegador: `select` de `deals` con `gross_margin` en `src/components/budget-quarters.tsx:74`, `src/components/quarter-kpis-panel.tsx:67` y `src/components/budget-panel.tsx:45`. Sin `org_id`: RLS.
- Sin exposición nueva: `deals.gross_margin` ya lo lee cualquier miembro en Payback real (`payback-quarters.tsx:31`) y Cobertura (`segment-coverage.tsx:53`); `segment_budget_quarters` tiene la política «org read» para cualquier miembro (`0017_segment_budget_quarters.sql:21-22`).

**Roles, estado real (verificado en `f59681f`; la rama de integración no toca estos archivos):**
- MCP de métricas: hoy **cualquier miembro** ve costes, margen y CAC por MCP. `realMetrics` y `segmentCoverageTool` no comprueban el rol (`mcp/tools/metrics.ts:19-20`, `:40-41`); `mcpCtx` devuelve `roles` (`mcp/context.ts:19`) pero no se usan; `canUseTool` solo se aplica a las herramientas del agente expuestas por MCP (`mcp/tools/agent-tools.ts:152`). El gate de 5c ya lo señaló (`SDD-20261030-gtm-control-tower-5c-assistant-server.md:323`) y 5c sigue sin implementar. **Este SDD añade la guarda** (Owner y Sales Leader) en esas dos herramientas (decisión 12 del §15, CA-15), porque amplía su salida.
- `get_funnel_diagnosis`: sin `roles` (`agent/tools/strategy.ts:66-83`), así que lo usa cualquier rol con el cliente privilegiado. Su salida no lleva costes, margen ni CAC (CA-10 lo fija) y sus lecturas nuevas no amplían lo que RLS ya da a cualquier miembro: no se le pone guarda.
- Finanzas sigue solo para Owner y Sales Leader.

Tests con datos ficticios; ningún dato de clientes en fixtures, evidencias ni logs.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| ninguna nueva | — | — | — |

El asesor (`ai.functions.ts:129`) recibe un snapshot con dos campos más y nulls donde antes había 0; su llamada no cambia. Coste del cambio de entrada: sin dato.

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-0 | Fixture movida a `src/test/metrics-fixture.ts` y ampliada (deal ganado con líneas y sin margen real de presupuesto; ganado sin segmento; compartido sin ganados; `acv_min` 0 sin máximo; empresa sin segmentos; un ACV de calculadora distinto del ACV real del segmento); test de coherencia; escaneo de fórmulas; inventario de «—» de §3.6 clasificado (no aplica / falta el dato) como lista cerrada en el test | CA-2, CA-3 (rojo), CA-13 (lista) | `src/lib/metrics-coherence.test.ts`, `src/lib/metrics-formulas-single.test.ts` (ambos fallan en la base) |
| U-1 | `src/lib/unit-economics.ts` | CA-1, CA-14 (constantes) | `src/lib/unit-economics.test.ts` |
| U-2 | Delegación de las funciones compartidas con D1-D11 y D15; borrar `strategy-freeze.test.ts`; mutaciones de CA-4 con evidencia; actualizar los tests de lib que fijaban los supuestos (cada aserción cambiada, citada en el PR con su decisión D-n) | CA-2, CA-3 (verde), CA-4, CA-5 | `src/lib/segment-coverage.test.ts`, `src/lib/segment-budget.test.ts`, `src/lib/cac.test.ts`, `src/lib/quarter-kpis.test.ts`, `src/lib/pipeline-board.test.ts`, `src/lib/funnel-diagnosis.test.ts` (aserciones nuevas de CA-5 en rojo) |
| U-3 | `/metrics`: marcas desde `Figure`, tablero con un solo payback y CAC proyectado vía `cacOf`, consultas de `deals` con `gross_margin` (`quarter-kpis-panel.tsx:67`, `budget-panel.tsx:45`), «—» de falta de dato, ventanas. Parte de `pipeline-board-panel.tsx` tal como lo dejó NK-0093 en la rama de integración y no cambia su bloque de leads (`:34`, `:113-130`) | CA-6, CA-13, CA-14 | `src/components/pipeline-board-panel.test.tsx`, `src/components/quarter-kpis-panel.test.tsx`, `src/components/segment-coverage.test.tsx`, `src/components/cac-panel.test.tsx`, `src/components/budget-panel.test.tsx` |
| U-4 | `/strategy` e Inicio: Payback real, Presupuesto vs real (con `gross_margin` en `budget-quarters.tsx:74`), Modelos de venta (extrae `src/lib/strategy-calculator.ts`; D14a y D14b), Diagnóstico; tarjeta de Inicio | CA-7, CA-8, CA-9, CA-10, CA-13, CA-14 | `src/components/payback-quarters.test.tsx`, `src/components/payback-card.test.tsx`, `src/components/budget-quarters.test.tsx`, `src/lib/strategy-calculator.test.ts`, `src/components/strategy/motions.test.tsx`, `src/lib/agent-tools.test.ts` |
| U-5 | MCP (salida nueva y guarda de rol), asesor y `get_overview`; descripciones y manifiesto | CA-11, CA-12, CA-15 | `src/lib/mcp/tools/metrics.test.ts` (rol `["ae"]` recibe datos en la base), `src/lib/advisor.test.ts` |

Orden: U-0 → U-1 → U-2 → (U-3, U-4, U-5). U-2 cambia cifras y borra la red de congelación en el mismo commit. Todas las U se construyen sobre `integration/sprint2-20261109` (§3).

**Tests existentes que este SDD autoriza a borrar o cambiar** (excepción expresa a GROUND-RULES regla 6 y al «solo añadir» de los briefs; cada cambio se cita en el PR con su D-n o CA; ninguna otra aserción existente se toca):
- **U-0:** editar `src/lib/strategy-freeze.test.ts` solo para importar la fixture desde `src/test/metrics-fixture.ts`, sin cambiar ninguna aserción.
- **U-2:** borrar `src/lib/strategy-freeze.test.ts` entero (CA-4), en el mismo commit que cambia las cifras. Cambiar: `src/lib/metrics.test.ts:101-114` (D1, D2: margen ausente y ≤ 0 dejan de dar 100 %, `Infinity` o negativo); `src/lib/cac.test.ts:50`, `:186` (D7: el compartido ya no se reparte a partes iguales); `src/lib/segment-coverage.test.ts:139`, `:150`, `:182` (D3: `minimo_x1_5` deja de dar ACV); `src/lib/pipeline-board.test.ts:107-108`, `:139` (D10: sin payback propio del tablero) y borrar su `describe("boardMargin (CA-9)")` (`:144-196`, D10: `boardMargin` desaparece). Si `segment-budget.test.ts`, `quarter-kpis.test.ts` o `funnel-diagnosis.test.ts` fijan una cifra que cambia por D1-D11 o D15, se cambia citando su D-n.
- **U-3:** cambiar `src/components/segment-coverage.test.tsx:97` (D3), `:108` (D1); `src/components/budget-panel.test.tsx:91` (D1), `:140` (D7); `src/components/cac-panel.test.tsx:55` (D7), `:86` (D1); y en `src/components/pipeline-board-panel.test.tsx` (rama de integración) las aserciones sobre «Payback real → proyectado» (`:63`, `:74`, `:90`, `:104`, `:112`, D10), y la espera por ese mismo texto en `src/components/metrics/explanation-fold-usage.test.tsx:118` (D10: pasa a esperar el rótulo nuevo, sin cambiar lo que comprueba). Los tests de leads de NK-0093 (`src/components/leads-stripe-states.test.tsx`, caso «PipelineBoardPanel (its leads half)», `:164`) no se tocan y deben seguir en verde.
- **U-4:** ninguna. Comprobado con grep: ningún test de `src/` fija «Payback estimado», el ACV 20.000, «margen bruto 100%», «sin costes» ni «0 ganados» de `/strategy` o Inicio; U-4 solo añade tests.
- **U-5:** ampliar en `src/lib/advisor.test.ts` el test de NK-0091 «changes nothing else in the snapshot» (`:214-222` de la rama de integración) si las claves nuevas de CA-12 lo rompen, citando CA-12.
- **Fuera de estas listas:** si un test existente no listado falla, se para y se informa; no se cambia.

**Cláusula de tests ampliada (decisión del coordinador tras la segunda pasada del gate, 2026-11-09):** además de las líneas listadas arriba, U-2 y U-3 pueden cambiar aserciones existentes de `src/lib/cac.test.ts`, `src/lib/segment-coverage.test.ts`, `src/lib/metrics.test.ts`, `src/lib/pipeline-board.test.ts`, `src/lib/segment-budget.test.ts`, `src/lib/quarter-kpis.test.ts`, `src/lib/funnel-diagnosis.test.ts` y `src/components/quarter-kpis-panel.test.tsx` **solo** cuando fijan una cifra, un texto o una forma que cambia por una D-n o un CA de este SDD; cada cambio cita su D-n o CA en el mensaje del commit, y ninguna comprobación de otra cosa se quita ni se afloja. Cualquier otro test existente que falle, se para y se explica.

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- **Módulo.** `src/lib/unit-economics.ts`, sin dependencias de pantalla. `Figure` lleva estado y motivo; `mark-text.ts` (`src/components/metrics/mark-text.ts`) pasa a ser un adaptador `figureMark(f) → DataMarkProps` y deja de componer motivos por su cuenta. Como `/strategy` e Inicio no están en `src/components/metrics/`, el adaptador y `DataMark` se mueven a un sitio común (p. ej. `src/components/data-mark.tsx`) o se usa `DataState` directamente; `DataMarkProps` vive hoy en `src/components/metrics/data-mark.tsx`, y si se mueve, la marca sigue pintando `data-slot="data-state"` y un solo nodo de texto, que es lo que comprueba `src/test/data-marks.ts`. Ese archivo no cambia salvo la aserción nueva de CA-13.
- **Ventana como dato, fórmula única.** `trailingCac` pasa a ser `cacOf({ cost, won, period: "los últimos 4 trimestres" })` con costes y ganados de esa ventana; `segmentCac` reparte el compartido y llama a `cacOf` por segmento con `period` = el trimestre. El CAC proyectado del tablero (`pipeline-board.ts:241`) llama a `cacOf({ cost, won: expectedWins, period })` y `pipelineEconomics` lo marca «estimado» con su motivo (CA-2, CA-6).
- **Guarda de rol en MCP (CA-15).** Un helper local en `src/lib/mcp/tools/metrics.ts`, p. ej. `requireFinanceRole(c)`, justo después de `mcpCtx` y antes de cualquier `c.db.from`. Reutilizar el texto de error de `mcp/tools/agent-tools.ts:153`. No tocar `mcpCtx` (lo usan todas las herramientas).
- **`capacityPlan`.** Mantiene `dealsPerYear`, `oppsPerYear` y `oppsPerMonth` (la calculadora los usa) y su `paybackMonths` delega en `paybackOf`; los campos `marginAssumed`/`marginNonPositive` de NK-0068 pueden quedarse como lectura del `Figure` o desaparecer (los consumidores están en `src/components/metrics/` y en `segment-coverage.ts:55-62`).
- **Cadena de margen única.** `segmentMargin(seg, { quarter, year, deals })` (no `marginChain`: ese nombre ya es el parámetro de `periodBudget`, `segment-budget.ts:194`, `:245`) = `withPeriodMargin` actual (`segment-budget.ts:163-181`). `periodBudget` recibe los márgenes de deals (`wonDealsMargin(..., range.end, segments).bySegment`) como hacen ya Cobertura (`segment-coverage.tsx:62-66`) y Payback real (`payback-quarters.tsx:63-68`). El payback presupuestado sigue con el margen de plan y, sin él, el objetivo (`segment-budget.ts:238`).
- **Payback de empresa único.** `companyPayback(rows)` = la media ponderada actual (`quarter-kpis.ts:37-41`) más el recuento «k de m». El tablero lee `quarterKpis(...)[0].actual.payback`, que ya calcula (`pipeline-board-panel.tsx:86`), y `boardMargin` desaparece.
- **CAC de empresa.** `kpiTotals` necesita los ganados del periodo sin filtrar por segmento y el compartido no repartido: `periodBudget` puede devolverlos a nivel de periodo (no por fila) o `quarterKpis` contarlos aparte.
- **MCP.** Tras U-5, ejecutar `node node_modules/@lovable.dev/mcp-js/dist/cli/extract-manifest.cjs .` (`src/lib/AGENTS.md`). Las claves nuevas van dentro de `payback`, `cac`, `win_rate`: la regla de NK-0068 «nunca dentro de los objetos que MCP pasa enteros» era de la congelación y deja de aplicar.
- **Calculadora.** Extraer de `motions.tsx:145-190` a `src/lib/strategy-calculator.ts` lo que hoy es lógica en el componente (ACV usado, segmento, margen, `plan`, `paybackReal`, `missing`), para probarlo puro (CA-3, CA-9). La función devuelve un único `Figure` para la fila de payback del plan: con base «real» y CAC real es el de `paybackReal` (D14a); si no, el escenario con el ACV de la calculadora y su marca (D14b).
- **Tests de componente.** jsdom y Testing Library (`vitest.config.ts`), patrón de mocks de `src/test/metrics-mocks.tsx` y `src/components/strategy-screens.test.tsx`. Ningún test en `src/routes/`.
- **Test de MCP.** Mismo patrón que `strategy-freeze.test.ts:458-464` (mock de `@/lib/mcp/context` con una `db` falsa sobre la fixture; allí `roles: ["owner"]`), ahora sin golden: aserciones sobre forma y coherencia, y una variante con `roles` configurable para CA-15 cuya `db` cuenta las lecturas.
- **Alternativa descartada:** mantener las cifras y solo rotular en `/strategy` e Inicio (lo de NK-0068). No cumple el objetivo de Fede (un supuesto deja de producir cifra) ni cierra las cinco cadenas de margen.

## 14. Riesgos y dependencias
- **Cifras que desaparecen.** Segmentos sin margen, sin máximo de ACV o sin CAC real dejarán de tener payback en todas partes. Cuántos: sin dato (producción, §16). Mitigación: cada «Sin dato» dice qué falta.
- **Contrato con asistentes externos (5c).** `get_segment_coverage` cambia valores (nulls), quita `payback.source: "objetivo"` y añade claves. Un asistente que trate el payback como número siempre presente verá null. Hay que avisarlo en la descripción de la herramienta (CA-11).
- **NK-0029 CA-18.** El diccionario de métricas no existe aún en código (no hay `metrics-dictionary` en `src/lib/`). Cuando se haga, sus entradas de CAC, payback y win rate deben citar `unit-economics.ts` y `WIN_RATE_WINDOWS`: una fórmula de CAC, una de payback y tres ventanas de win rate. Se lo pasamos a NK-0029.
- **NK-0091** ya está integrado en `integration/sprint2-20261109` (`advisor.ts` y `advisor.test.ts`, con `win_rate_por_fuente` en `:112` y el test «changes nothing else in the snapshot» en `advisor.test.ts:214-222`). Este SDD parte de esa versión: toca `advisor.ts:139`, `:209` y añade claves; U-5 puede ampliar ese test solo si CA-12 lo exige (§12).
- **NK-0093** ya está integrado: cambió en `pipeline-board-panel.tsx` solo el estado de carga y error de leads (`:34`, `:113-130` de la rama) y añadió `src/components/leads-stripe-states.test.tsx`. U-3 parte de esa versión, no toca ese bloque y mantiene verde ese test (contrato de la revisión de coherencia del sprint, objeción 2).
- **Orden de integración del sprint** (revisión de coherencia): NK-0098 → NK-0091 → NK-0093 → NK-0095 → NK-0096 → NK-0094 (U-0 a U-5, la última) → regenerar el manifiesto una vez → gate.
- **NK-0097** está fuera del sprint: si este SDD mueve `DataMark` y `figureMark` a un sitio común (§13), NK-0097 debe apuntar a la ruta nueva.
- **Ticket nuevo de «—» del resto de `/metrics`** (decisión 13 del §15): lo registra el coordinador; no depende de este SDD salvo por reutilizar `expectNoBareDash` de CA-13.
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
6. **Win rate por segmento del asesor** (rama de integración: `advisor.ts:187-189`, `:209`, por `segment_id` sin `assignSegment`). **Recomiendo ticket aparte** (o ampliar NK-0091): cambia la entrada de la IA y no es CAC ni payback.
7. **ACV de ejemplo 20.000 en Modelos de venta (D12).** **Recomiendo eliminarlo**: la calculadora queda vacía hasta que escribas un ACV, con «Sin dato · falta ACV». Alternativa: mantenerlo como «Estimado · valor de ejemplo», pero es una cifra sin fuente.
8. **KPI de empresa con cobertura parcial.** **Recomiendo** mostrar la media sobre los segmentos con payback y la marca «Estimado · calculado sobre {k} de {m} segmentos con clientes». Alternativa más estricta: «Sin dato» en cuanto un segmento con clientes no tenga payback.
9. **CAC de empresa (D11).** **Recomiendo** coste / todos los ganados, con la pista de cuántos no tienen segmento. Alternativa: solo los ganados con segmento, como hoy el KPI; dejaría coste sin cliente.
10. **Diagnóstico AARRR** usa «sin datos» (vocabulario de `SDD-20261027-segment-motion-aarrr-diagnosis`) y no `DataState`. **Recomiendo no tocar su forma** en este SDD; solo su margen y sus motivos (CA-10).

**Decisiones del coordinador (2026-11-09, ejecución delegada por Fede: «sí, ese alcance, ejecuta todo tú»):** se aceptan las recomendaciones del autor para todas las preguntas: 1 SDD sin PRD; 2 punto medio del rango se mantiene como «Estimado»; 3 se elimina el payback con CAC objetivo en Cobertura y MCP; 4 se quita el payback proyectado del tablero; 5 las ventanas de win rate se rotulan, no se unifican; 6 el win rate por segmento del asesor va a ticket aparte; 7 se elimina el ACV de ejemplo 20.000; 8 KPI de empresa con «Estimado · calculado sobre {k} de {m} segmentos con clientes»; 9 CAC de empresa = coste entre todos los ganados, con pista de los que no tienen segmento; 10 el Diagnóstico AARRR mantiene su vocabulario.

**Decisiones del coordinador tras el gate (2026-11-09, ejecución delegada por Fede):**

11. **Modelos de venta (objeción 1 del gate).** Con base «real», la fila «Payback real» de `motions.tsx:505` muestra el mismo cálculo que `paybackReal` (`acvFor` y la cadena única de margen, `segmentMargin`), nunca el ACV de la calculadora. Con base objetivo, su payback se rotula «Estimado · con el ACV de la calculadora». Aplicado en D14 (a y b), §3.2, §4, §6, CA-3, CA-9 y §9.
12. **MCP de métricas (objeción 2).** Se añade aquí la guarda de rol (solo Owner y Sales Leader) en `realMetrics` y `segmentCoverageTool`. `get_funnel_diagnosis` no expone costes ni margen (solo meses de payback, objetivo, veredicto y motivo), así que no lleva guarda; CA-10 fija que su salida no los lleve. El §10 dice el estado real. Aplicado en §4, §5, §6, §8, §9, §10, CA-15 (H-4), U-5 y §13.
13. **«—» del resto de `/metrics` (objeción 3).** Los de Finanzas, RevOps, ciclo, cobertura de pipeline, Embudo, Perdidos, Cohortes y Tendencias van a un ticket nuevo que registra el coordinador. Esto corrige, para esas superficies, la decisión 4 del §15 de NK-0089 (`SDD-20261106-ux-metrics-data-state.md:145`). Declarado en §5 «No incluye» y §14.
14. **Consultas ampliadas (objeción 4).** Se listan en §8 y §10 todas las consultas que cambian: `budget-quarters.tsx:74`, `quarter-kpis-panel.tsx:67` y `budget-panel.tsx:45` añaden `deals.gross_margin`, y `loadFunnelDiagnosis` añade `segment_budget_quarters` y `deals.gross_margin`. Ninguna da exposición nueva por RLS.
15. **Notas del gate que afectan a cómo se prueba.** (a) El §12 autoriza expresamente, por U, borrar `src/lib/strategy-freeze.test.ts` y cambiar las aserciones de tests existentes que cita el gate, cada una con su D-n. (b) CA-6 excluye los tests del escaneo de textos. (c) CA-2: el CAC proyectado pasa por `cacOf` y queda «Estimado»; no es una excepción del escaneo. (d) `cacOf` y `companyCac` reciben el periodo. (e) La cadena única se llama `segmentMargin`, para no chocar con `segment-budget.ts:194`, `:245`. (f) También: la evidencia de D8 se corrige, el pie de CA-8 describe también el margen del presupuestado, CA-14 cubre `motions.tsx:594` y `:682`, CA-3 cubre la empresa sin segmentos, y CA-12 deja el null en el asesor y no en `winRate`.
16. **Base de construcción.** Es la rama `integration/sprint2-20261109`, con NK-0091, NK-0098 y NK-0093 dentro. U-3 parte del `pipeline-board-panel.tsx` que dejó NK-0093.

## 16. Pendiente de verificar
- [Por verificar] Que `metrics-coherence.test.ts` y `metrics-formulas-single.test.ts` fallan en la base por las parejas y archivos que cito (§3.2, CA-2, CA-3): lo demuestra U-0 con evidencia. No he ejecutado pruebas.
- [Por verificar] Cuántos segmentos de producción no tienen margen en ninguna fuente, tienen `acv_min` sin `acv_max`, o trimestres con compartido y sin ganados; cuántos deals ganados no caen en ningún segmento: producción. Decide cuántas cifras pasan a «Sin dato».
- [Por verificar] Si algún asistente externo o integración depende de `payback.source: "objetivo"` o de un payback numérico en `get_segment_coverage`: registro de uso de MCP (no lo hay en el repo).
- [Por verificar] Clasificación exacta de los «—» (§3.6): mi recuento es por líneas con grep, incluye comentarios y no distingue «no aplica» de «falta el dato»; U-0.
- [Por verificar] La lista «4 fórmulas de CAC y 2 de payback» que el encargo atribuye a NK-0068 §3 y §14: no la encontré literal; la tabla del §3.1-3.2 es mía.
- [Por verificar] Que el extractor del manifiesto MCP corre en el worktree con `node_modules` enlazado: U-5.
- [Por verificar] Que la regla `matchSegment` de empate (`metrics.ts:64-75`) y `wonDealsMargin` con ventana de 12 meses antes del fin del periodo (`deal-lines.ts:94-101`) no introducen más diferencias entre superficies una vez unificada la cadena: lo cubre CA-3 con la fixture. Queda abierto (gate): `periodBudget` del año usará el fin de año como ventana de 12 meses y CA-3 solo compara `byQuarter[T]`.
- [Por verificar] Que ningún asistente externo use `get_real_metrics` o `get_segment_coverage` con un rol distinto de Owner o Sales Leader (CA-15 se lo cerrará): no hay registro de uso de MCP en el repo.

Versión 2 (2026-11-09): corregido tras el gate y la revisión de coherencia del sprint, con las decisiones 11-16 del §15. Resuelve las 4 objeciones bloqueantes: (1) la fila «Payback real» de Modelos de venta usa el mismo `Figure` que `paybackReal` y, con base objetivo, se rotula «Estimado · con el ACV de la calculadora» (D14a y D14b, CA-3, CA-9); (2) el §10 dice el estado real de los roles en MCP y se añade la guarda Owner y Sales Leader (CA-15, U-5); (3) los «—» del resto de `/metrics` pasan a un ticket nuevo (§5); (4) las consultas ampliadas quedan listadas (§8, §10). También incorpora las notas del gate sobre cómo se prueba (§12, autorizaciones de tests; CA-1, CA-2, CA-6; `segmentMargin`) y toma como base `integration/sprint2-20261109` (§3, §14). §17 sin tocar.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Informe de la primera pasada (v1), copiado sin editar:

- Veredicto del gate: Objeciones
- CA sin prueba posible o sin G-n: ninguno. Todos los CA nombran un archivo de prueba posible. No hay ninguno en `src/routes/`, y `vitest.config.ts:11` incluye `src/**/*.{test,spec}.{ts,tsx}`, así que también cubre los archivos nuevos (`src/components/strategy/motions.test.tsx`, `src/lib/mcp/tools/metrics.test.ts`, `payback-quarters.test.tsx`, `payback-card.test.tsx`, `budget-quarters.test.tsx`). No hay PRD, así que no se exige G-n. Hay dos CA incompletos: CA-9 (objeción 1) y CA-6 (nota 2).
- [Por verificar] que sigue sin comprobarse:
  - Sin resolver:
    - Datos de producción: segmentos sin margen o con `acv_min` sin `acv_max`, trimestres con compartido y sin ganados, y ganados que no caen en ningún segmento.
    - Uso externo de `payback.source: "objetivo"`. No hay registro de MCP en el repo.
    - Clasificación de los «—» entre «no aplica» y «falta el dato» (U-0).
  - Resuelto en parte: que falla primero en la base. Lo comprobé leyendo el código, no ejecutando:
    - CA-2: los patrones existen en `metrics.ts:96`, `cac.ts:57`, `quarter-kpis.ts:75`, `pipeline-board.ts:239` y `segment-budget.ts:234`.
    - CA-3, margen M1 frente a M2: `withPeriodMargin` añade el margen de los deals (`segment-budget.ts:178-179`) y `periodBudget` no lo añade (`segment-budget.ts:245`).
    - CA-3, C3 frente a C4: el KPI solo cuenta ganados asignados a un segmento (`segment-budget.ts:196-205`, `quarter-kpis.ts:75`); el tablero cuenta todos los ganados del rango (`pipeline-board.ts:151-152`, `pipeline-board-panel.tsx:93`).
    - La fixture de U-0 sigue siendo necesaria.
  - Resuelto: la lista «4 fórmulas de CAC y 2 de payback» no está literal en NK-0068. Solo aparecen «unificar las fórmulas de CAC y payback» (`SDD-20261106-metrics-honest-data.md:75`) y «dos de payback (estricta y por defecto)» (`:262`).
  - Resuelto en parte: el extractor existe en el worktree (`node_modules` enlaza a `…-integration/node_modules`; `extract-manifest.cjs` está). No lo he ejecutado.
  - Resuelto en parte, sobre `matchSegment` y `wonDealsMargin`:
    - Los tres usuarios actuales de M1 pasan el fin del trimestre: `segment-coverage.tsx:66`, `payback-quarters.tsx:67` y `mcp/tools/metrics.ts:55`.
    - `assignSegment` es compartido (`segment-coverage.ts:70-74`).
    - Queda abierto: `periodBudget` del año usará el fin de año como ventana de 12 meses, y CA-3 solo compara `byQuarter[T]`.
  - Recuentos de «—» del §3.6: confirmados con grep. Falta `payback-quarters.tsx:171`, que tiene 1.
- Contradicciones con el código o con decisiones previas:
  1. D14 y CA-9 contra `motions.tsx:168-177` y `:505` (Modelos de venta).
  2. §10 contra `mcp/tools/metrics.ts:19-20` y `:40-41` (rol en MCP).
  3. §5 «No incluye» contra la decisión 4 del §15 de NK-0089 (`SDD-20261106-ux-metrics-data-state.md:145`).
  4. §8 y §10 («la única consulta nueva») contra `budget-quarters.tsx:74`, `quarter-kpis-panel.tsx:67` y `budget-panel.tsx:45`.
  - Con los otros dos SDD del Sprint 2 no hay contradicción de regla. Solo hay conflictos de archivo, ya declarados en el §14.
- Lo que esta revisión NO demuestra:
  - No he ejecutado tests, fail-first, mutaciones ni el extractor.
  - No he visto ninguna pantalla renderizada.
  - No he consultado producción ni el uso de MCP.
  - No he comprobado una a una todas las citas del §3. Comprobé las de fórmulas, cadenas, superficies, MCP, asesor y diagnóstico, y salvo lo indicado son exactas.
  - No he revisado entero el CA-18 de NK-0029.

**Objeciones bloqueantes**
1. **Payback de Modelos de venta: el SDD describe mal el código y queda una segunda regla de ACV.**
   - Con `basis === "real"`, el plan usa el CAC real y el win rate real (`motions.tsx:169-170`). Su payback se rotula «Payback real» (`:505`) y se calcula con el ACV de la calculadora (`:172`) y el margen M3 (`:176`).
   - D14 dice que ese payback usa «CAC y win rate objetivo». CA-9 y CA-3 solo cubren `paybackReal` (`:179-183`, `:454`).
   - Resultado: tras el cambio, la misma pantalla sigue mostrando un «Payback real» con el ACV de la calculadora, en contra del §4 («Reglas de ACV que alimentan un payback: 1») y de H-1.
   - Corrección: decidir que con base «real» la fila de `:505` muestre el mismo `Figure` que `paybackReal` (`acvFor` y `marginChain`). La otra opción es rotularla «Estimado · con el ACV de la calculadora». Hay que añadirlo a CA-9 y a la tabla del §6, y corregir el texto de D14.
2. **§10 afirma un permiso que el código no tiene.**
   - El §10 dice: «MCP de métricas sigue solo para Owner y Sales Leader (5c CA-1)».
   - `realMetrics` y `segmentCoverageTool` no comprueban el rol (`mcp/tools/metrics.ts:19-20`, `:40-41`). `mcpCtx` devuelve `roles` (`mcp/context.ts:19`), pero nadie los usa. `canUseTool` solo se aplica en `agent-tools.ts:152`.
   - El gate de 5c ya lo detectó (`SDD-20261030-gtm-control-tower-5c-assistant-server.md:323`), y 5c sigue sin implementar.
   - Hoy cualquier miembro ve costes, margen y CAC por MCP. Este SDD amplía esa salida.
   - Corrección: escribir el estado real. Después, o bien añadir aquí la guardia de rol (Owner y Sales Leader) con un CA y su prueba en `src/lib/mcp/tools/metrics.test.ts`, o bien declararla fuera de alcance, pendiente de 5c CA-1, con decisión del coordinador en el §15.
3. **El alcance de los «—» es más estrecho que la decisión aprobada en NK-0089.**
   - La decisión 4 del §15 de NK-0089 dice: «se añade a NK-0094 … sin ticket nuevo». Abarca los «—» de `/metrics` que significan «falta el dato» (unas 52 líneas en 11 archivos).
   - Este SDD excluye Finanzas (`finance-panel.tsx`, 7 líneas), los paneles de RevOps (`revops-panels.tsx`, 6), ciclo, cobertura de pipeline, Embudo, Perdidos, Cohortes y Tendencias (§5). No los asigna a ningún ticket, así que se quedan sin dueño.
   - Corrección: o incluirlos en CA-13, o añadir una decisión del coordinador en el §15 con un ticket nuevo para lo que queda.
4. **Lecturas nuevas no declaradas.**
   - El §8 y el §10 dicen que la única consulta nueva es la de `loadFunnelDiagnosis`.
   - Pero la cadena única M1 en `periodBudget` (§13) necesita `deals.gross_margin`, y ni `budget-quarters.tsx:74`, ni `quarter-kpis-panel.tsx:67`, ni `budget-panel.tsx:45` lo seleccionan hoy.
   - No hay exposición nueva: todos los miembros ya pueden leer esa columna por RLS (`payback-quarters.tsx:31`, `segment-coverage.tsx:53`).
   - Corrección: listar las tres consultas ampliadas en el §8 y el §10. Las consultas del navegador no llevan `org_id`, por RLS.

**Notas para el brief**
- **D8, evidencia:** `strategy-segments.ts:61-66` pide asignar los deals abiertos que no tienen ningún segmento (`assignSegment == null`, `:61`). No pide asignar los que se asignan por importe. La cita no respalda D8.
- **CA-6, textos prohibidos:** «Ningún texto de `src/`» tiene que excluir los tests. Hoy contienen esos textos `segment-coverage.test.tsx:97`, `:108`, `budget-panel.test.tsx:91`, `:140` y `cac-panel.test.tsx:55`, `:86`, y el propio escáner los llevará. U-3 debe autorizar y citar el cambio de esas aserciones con su D-n. GROUND-RULES regla 6 y el «solo añadir» habitual de los briefs chocan con eso.
- **Tests que se borran o cambian:** el brief debe autorizar expresamente borrar `strategy-freeze.test.ts` y cambiar aserciones de lib, porque GROUND-RULES regla 6 lo prohíbe por defecto.
- **CA-2, escaneo:** no cubre el CAC proyectado `p.cost / expectedWins` (`pipeline-board.ts:241`), que sigue como «Estimado». Hay que decir si pasa por `cacOf` o si es una excepción listada.
- **CA-1:** `cacOf({ cost, won })` no recibe el periodo, pero sus textos usan `{periodo}`. Falta en la firma.
- **Nombre `marginChain`:** choca con el parámetro `marginChain` de `periodBudget` (`segment-budget.ts:194`, `:245`). Hay que renombrar uno.
- **CA-8, nota del pie:** el payback presupuestado sigue con margen de plan y, sin él, el objetivo (`segment-budget.ts:238`). El texto único del §9 solo describe la cadena del real.
- **CA-14:** Modelos de venta también muestra win rates en `motions.tsx:594` y `:682`, que no se mencionan.
- **CA-3, empresa sin segmentos:** el KPI da captación null (filas vacías) y el tablero suma todos los costes (`pipeline-board-panel.tsx:91`). Hay que cubrirlo en la fixture o excluirlo en el CA.
- **NK-0091:**
  - Su brief (`.factory/briefs/NK-0091.md`) fija un test de snapshot de `buildSnapshot` («salvo esa clave») y prohíbe cambiar tests existentes.
  - CA-12 cambia `win_rate_*` y añade claves.
  - El brief de U-5 debe autorizar actualizar ese test y fijar el orden de integración.
- **NK-0095:** su §14 (`SDD-20261109-rules-write-permissions.md:208`) dice que NK-0094 puede añadir migraciones, pero este SDD no tiene ninguna (§5). No afecta a este SDD.
- **`get_funnel_diagnosis`:** no tiene `roles` (`agent/tools/strategy.ts:66-83`), así que lo usa cualquier rol con el cliente privilegiado. Las lecturas nuevas (`segment_budget_quarters`, que por RLS lee cualquier miembro según `0017_segment_budget_quarters.sql:21-22`, y `deals.gross_margin`) no amplían lo que ya da RLS. Conviene escribirlo en el §10. `expectScoped` existe (`agent-tools.test.ts:66`).
- **§13, marcas:** `DataMarkProps` vive hoy en `src/components/metrics/data-mark.tsx`. Si se mueve a un sitio común, hay que mantener las aserciones de `src/test/data-marks.ts`: `data-slot="data-state"` y un solo nodo de texto.


Revisión de coherencia entre los SDD del Sprint 2: `docs/sdd/annex/sprint2-cross-sdd-gate-20261109.md`.


Informe de la segunda pasada (v2), copiado sin editar:

- **Veredicto del gate (segunda pasada):** Objeciones

- **Objeciones de la primera pasada:**
  - 1: resuelta. D14a y D14b, CA-3 y CA-9 cubren la fila de `motions.tsx:505`, que he comprobado en el código (`:168-183`, `:504-529`). Queda un hueco menor: base «real» sin CAC real (ver notas).
  - 2: resuelta. El §10 dice el estado real y CA-15 añade la guarda con prueba que falla primero (`mcp/tools/metrics.ts:19-20`, `:40-41`). Coincide con 5c CA-1 aprobado («métricas y cobertura solo para Owner y Sales leader», `SDD-20261030-gtm-control-tower-5c-assistant-server.md:50`).
  - 3: parcial. La decisión 13 del §15 asigna esos «—» a un ticket nuevo, pero ese ticket no existe en `.factory/ledger.json` (el último es NK-0105 y ninguno trata los «—» del resto de `/metrics`). No impide construir NK-0094.
  - 4: resuelta. Las tres consultas ampliadas y la nueva de `loadFunnelDiagnosis` están en §8 y §10. Lo he comprobado: `budget-quarters.tsx:74`, `quarter-kpis-panel.tsx:67` y `budget-panel.tsx:45` no leen hoy `gross_margin`; `pipeline-board-panel.tsx` (rama de integración, `:46`) y `motions.tsx:120` ya lo leen. No hay exposición nueva: `deals.gross_margin` ya lo leen Payback real y Cobertura, y `segment_budget_quarters` tiene la política «org read» (`0017_segment_budget_quarters.sql:21-22`).

- **CA sin prueba posible o sin G-n:** ninguno. No hay PRD, así que no se exige G-n. Dos CA tienen una prueba que no se puede escribir tal como están redactados:
  - CA-1: la firma `segmentMargin(seg, { quarter, year, deals })` no recibe las filas de presupuesto, la lista de segmentos ni el fin del periodo. `withPeriodMargin` los necesita (`segment-budget.ts:163-181`) y `wonDealsMargin` también (`deal-lines.ts:94`).
  - CA-15: «sin leer ninguna tabla» solo se cumple con `mcpCtx` simulado, porque `mcpCtx` ya lee `profiles`, `org_members` y `organizations` (`mcp/context.ts:11-16`).

- **[Por verificar] que sigue sin comprobarse:**
  - Datos de producción que pasan a «Sin dato».
  - Uso externo de `payback.source` y roles de quien usa el MCP de métricas.
  - Clasificación de los «—» (la hace U-0).
  - Que los dos tests nuevos fallan primero en la base.
  - Que el extractor del manifiesto corre en el worktree.
  - `periodBudget` del año con su ventana de 12 meses: CA-3 solo compara `byQuarter[T]`, así que sigue abierto.

- **Contradicciones con el código o con decisiones previas:**
  - §12, lista cerrada de tests que se pueden cambiar, contra los tests que existen: queda incompleta (objeción bloqueante 1).
  - H-4 dice «como en la app», pero en la app cualquier miembro ve CAC, costes y payback en Cobertura, CAC real, KPI y Presupuesto. Solo Finanzas está restringida (`metrics.tsx:85`, `:206`), y `cac_costs` tiene «org read» para cualquier miembro (`0015_cac_costs.sql`). La guarda es más estricta que la app. No es un riesgo de seguridad; el texto debe decirlo así (5c ya lo reconoce en la línea 482).
  - Decisión 13 contra NK-0089 §15.4 («sin ticket nuevo»): corrección tomada por delegación, pero falta el ticket.
  - Con NK-0095, NK-0096 y la revisión de coherencia del sprint no hay contradicciones. El orden de integración y el contrato del manifiesto coinciden. Las citas de la rama de integración (`advisor.ts:112`, `:139`, `:187-189`, `:209`; `advisor.test.ts:214-222`; `pipeline-board-panel.tsx`, desplazamiento de +3 desde `:110`; `leads-stripe-states.test.tsx:164`) son exactas.

- **Lo que esta revisión NO demuestra:**
  - No he ejecutado tests, fail-first, mutaciones ni el extractor.
  - No he visto ninguna pantalla renderizada.
  - No he consultado producción ni el uso del MCP.
  - No he vuelto a comprobar una a una todas las citas del §3: solo las de MCP, Modelos de venta, asesor, consultas, tablero, Diagnóstico y tests.
  - No he leído las ramas de NK-0095 ni de NK-0096.

**Objeciones bloqueantes**

1. **La lista cerrada de tests autorizados del §12 no incluye aserciones que U-2 y U-3 rompen con toda seguridad. Por la regla «si un test existente no listado falla, se para», la construcción se detiene.**
   - Sin listar en U-2:
     - `src/lib/cac.test.ts:64-67`: «falls back to the target CAC», `source: "objetivo"` (D9).
     - `src/lib/segment-coverage.test.ts:141-145`: `acv: 0` con `sin_rango` (D4).
     - `src/lib/segment-coverage.test.ts:192-217`: `supuesto_100`, `payback.real` 6 y `Infinity`, y las claves de `payback` `["ok","real","source","target"]` (D1, D2, D9 y CA-11).
     - `src/lib/segment-coverage.test.ts:220-227`: `sharedSplit` «partes_iguales» (D7).
     - `src/lib/pipeline-board.test.ts:104`, `:106`, `:119`, `:129`, si `realCac` o `projectedCac` pasan a ser `Figure` como pide el §13.
     - `src/lib/metrics.test.ts:115-120`, si cambian `marginAssumed` y `marginNonPositive`.
   - Sin listar en U-3:
     - `src/components/quarter-kpis-panel.test.tsx:60-84`: fija «Estimado · supuestos en algún segmento» y «Sin dato · un segmento tiene margen 0 % o negativo», que el §9 sustituye.
   - Corrección: añadir esas líneas a U-2 y U-3 con su D-n. También vale ampliar la cláusula de reserva que ya existe para `segment-budget.test.ts`, `quarter-kpis.test.ts` y `funnel-diagnosis.test.ts` a `cac.test.ts`, `segment-coverage.test.ts`, `metrics.test.ts`, `pipeline-board.test.ts` y `quarter-kpis-panel.test.tsx`, con la misma condición: solo aserciones que fijan una cifra, un texto o una forma que cambia por una D-n o un CA, citándolo.

**Notas para el brief**

- **Ticket de los «—» del resto de `/metrics`:** hay que registrarlo antes del GO y anotar la corrección en NK-0089 §15.4 (decisión 13).
- **D14, base «real» sin CAC real:** el §13 dice «si no, el escenario», pero CA-9 no lo cubre. Fijar en CA-9 que ese caso usa el escenario (D14b) con su marca.
- **D14b:** el escenario usa `cac_target`, y la marca solo declara el ACV. Valorar «Estimado · con el ACV de la calculadora y el CAC objetivo». El juicio Dentro/Fuera compara entonces contra un objetivo calculado con otro objetivo, el mismo problema que justificó D9.
- **CA-1:** completar la firma de `segmentMargin` (filas de presupuesto, segmentos, fin del periodo) y decidir cómo se calcula el CAC del plan. Hoy `planAcq / planNew` está prohibido fuera del módulo, y `cacOf` daría el motivo «ningún deal ganado» y el estado «real» a una cifra de plan.
- **CA-15:**
  - Reutilizar `isLeader` (`src/lib/agent/tool-kit.ts:37`) en vez de crear `requireFinanceRole`.
  - Precisar «cero lecturas en la `db` tras `mcpCtx` simulado».
  - Corregir en H-4 «como en la app».
- **Tests que reciben datos de `PipelineBoardPanel`:** si U-3 cambia sus consultas, hay que mantener en verde los mocks de `leads-stripe-states.test.tsx` y del test «metrics-states».
- **Citas de pies de texto:** el de `budget-quarters.tsx` está en `:406-408` y el de `payback-quarters.tsx` en `:87-91`. Diferencia de una línea.

## 18. Delta de implementación (lo rellena el agente al entregar)

- **2026-11-09 (construcción, decisiones del coordinador por delegación de Fede):** (1) CA-10: se autoriza cambiar la aserción de `agent-tools.test.ts` que fija las tablas de `get_funnel_diagnosis` para añadir `segment_budget_quarters`. (2) D9 frente a CA-1/CA-3/CA-7: prevalecen CA-1/CA-3/CA-7; Cobertura muestra el motivo del CAC («sin costes en {T}», «ningún deal ganado en {T}») en vez de «falta CAC real». (3) El texto del tablero se corrige para hablar solo del CAC proyectado (D10) y su aserción se actualiza. (4) Se aceptan textos fuera de la lista del §9: «sin plan de captación en {periodo}», «sin clientes presupuestados en {periodo}», «sin win rate de los últimos 365 días», «ningún deal cerrado en {ventana}», «falta CAC objetivo», «sin plan». El escaneo encontró 10 cálculos de CAC fuera del módulo (no 5): los «CAC medio» de `cac-panel` pasan por la regla común. La guarda de MCP es más estricta que la app.
—
