# SDD-20261106-metrics-honest-data · [Mejora] Métricas con datos honestos: el trimestre filtra y cada supuesto se ve

**Tipo:** Mejora · **Prioridad propuesta:** Alta
**Estado:** Borrador (v2, corregido tras el gate) · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-11-06
**PRD:** No aplica (mejora acotada de una pantalla, sin esquema nuevo) · **Depende de:** — · **Coordinar con:** NK-0051 / `SDD-20261106-ux-metrics-data-state` (SDD-C2: mismos archivos y forma de «Estimado · motivo» / «Sin dato · motivo»); NK-0029 / `SDD-20261030-gtm-control-tower-3-attribution-metrics` (aprobado; su CA-18 documenta las fórmulas vivas de CAC, payback y win rate: este SDD añade una ventana trimestral de win rate en `/metrics`); `SDD-20261030-gtm-control-tower-5c-assistant-server` (CA-1: el asistente y MCP leen las mismas funciones; con este SDD sus cifras no cambian); PR #76 de Plays (toca `src/lib/headlines.ts`, que este SDD no toca)

> Sprint 1 de mejoras en pantallas core, bloque A. Rehecho el 2026-11-06 tras perderse la versión anterior (no llegó a subirse).

## 1. Resumen
`/metrics` presenta como reales cifras que se apoyan en supuestos del código: deals sin origen sumados a «Outbound», ACV de `mínimo × 1,5`, payback con margen del 100 % cuando falta el margen, coste compartido repartido a partes iguales cuando nadie ganó y margen medio de objetivos usado como margen. Además, el trimestre no filtra Embudo, Perdidos ni los win rates. Este cambio hace que el trimestre filtre lo que parece filtrar y que cada cifra apoyada en un supuesto lo diga («Estimado · motivo»), **sin cambiar ninguna cifra calculada por las funciones compartidas**, de modo que `/metrics`, `/strategy`, el asistente y MCP sigan dando el mismo número.

## 2. Problema y para quién
Owner y Sales Leader deciden presupuesto, cuota y canal con números que la pantalla presenta como reales y en parte son supuestos. El problema es que los supuestos no se ven.

## 3. Evidencia y por qué ahora
Leído en `main` @ `f76f639` y revisado por el gate (§17).

**El trimestre no filtra**
- `src/routes/_authenticated/metrics.tsx:231-246`: Embudo y Perdidos reciben `data.deals` y `data.history` completos; el `quarter` del selector (`:93`, `:200-211`) no se les pasa.
- Cohortes usa todo el histórico (`src/components/metrics/revops-panels.tsx:77-78`, `src/lib/revops.ts:94`) sin decirlo. Tendencias ya rotula «Últimas 12 semanas» (`revops-panels.tsx:99`), pero no dice que no depende del trimestre.
- `metrics.tsx:147-155`, `:173-176`: win rate por origen, por rep y global con todos los cerrados de la historia; la pista del KPI (`:280`) habla de «deals creados este trimestre».

**Supuestos que la pantalla no dice**
| # | Dónde se calcula | Dónde se ve en `/metrics` | Qué hace |
|---|---|---|---|
| A1 | `metrics.tsx:163` (local) | Rendimiento › Win rate por fuente | `d.source ?? "outbound"`: un deal sin origen suma a «Outbound». En Perdidos y Cohortes el mismo caso ya se rotula «Sin origen» (`revops-panels.tsx:9`). |
| A2 | `src/lib/segment-coverage.ts:22-26` (`assignSegment`) → `src/lib/metrics.ts:25` (`matchSegment`) | Cobertura; CAC real («Deals ganados», `cac-panel.tsx:202-203`); margen por segmento (`deal-lines.ts:106`) | Un deal sin `segment_id` se asigna por importe, sin decirlo. |
| A3 | `src/lib/cac.ts:29` (`segmentCac`) | CAC real (`cac-panel.tsx:200-201`); Presupuesto por segmento («Gasto de captación», `budget-panel.tsx:82`, vía `segment-budget.ts:124`, `:156`) | Si nadie ganó en el trimestre, el compartido se reparte a partes iguales. El CAC ya es null en ese caso (`cac.ts:31`); cambian «+ Compartido asignado», «Coste total» y el gasto por segmento. |
| A4 | `segment-coverage.ts:9-19` (`segmentAcv`) | Cobertura (`segment-coverage.tsx:93`); Presupuesto por segmento (`segment-budget.ts:128`) | Sin ganados ni abiertos: punto medio del rango, o `acv_min × 1.5` si no hay máximo (`:17`). Los dos casos se rotulan «punto medio del rango» (`segment-coverage.tsx:17`). De ese ACV salen deals objetivo (`segment-coverage.ts:49`), oportunidades objetivo (`:50`) y payback (`:56`). |
| A5 | `metrics.ts:40` (`capacityPlan`, `grossMarginPct ?? 100`) | Cobertura (`segment-coverage.tsx:121`, `:126-129`: sin margen no se dice nada); Presupuesto por segmento (`budget-panel.tsx:78` muestra «margen en el payback: —» junto a un payback al 100 % en `:85`, vía `segment-budget.ts:136`, `:141-143`); KPI trimestral de empresa (`quarter-kpis.ts:49`) | Sin margen, payback como si el margen fuera 100 %. Con margen 0 sale `Infinity` y con margen negativo, un payback negativo (`metrics.ts:40-41`). |
| A6 | `src/components/pipeline-board-panel.tsx:47-48` (local) | Rendimiento › tablero («margen X %», `:96`) | Sin margen real, de deals ni de plan, usa la media sin ponderar de los márgenes objetivo de los segmentos, rotulada como margen. |
| A7 | `src/lib/pipeline-real.ts:30`, `:38-41` | Rendimiento › tablero («ACV real», `pipeline-board-panel.tsx:96`; win rate, `:90`) | «ACV real» puede ser la media de deals abiertos; el win rate es de 365 días dentro de un panel trimestral, sin ventana visible. |

**Pistas que llevan a ninguna parte**
- `src/components/quarter-kpis-panel.tsx:123`: «costes en «CAC real» (más abajo)»: está en Resumen; «CAC real» vive en «CAC y presupuesto» (`metrics.tsx:289-291`).
- `quarter-kpis-panel.tsx:76`: «Presupuesto vs real» enlaza a `/strategy` sin `tab`, y abre «Modelos de venta» (`strategy.tsx:47`); «CAC real» en la misma línea, sin enlace.
- `pipeline-board-panel.tsx:84`: «Apúntalo en «CAC real», más abajo», desde Rendimiento.
- `segment-coverage.tsx:128` («Presupuesto por segmento», que se apunta en `/strategy?tab=budget`, `budget-panel.tsx:44-45`), `:136`, `:137` («CAC real»): texto sin enlace.

**Código compartido** (`/strategy` está congelada en este sprint)
Consumidores fuera de `/metrics` de las funciones afectadas: `src/components/strategy/motions.tsx`, `payback-quarters.tsx`, `budget-quarters.tsx` (pestañas de `strategy.tsx:59-68`), `src/lib/funnel-diagnosis.ts:122` (Diagnóstico), `payback-card.tsx` (Inicio, `home.tsx:80`), `src/lib/mcp/tools/metrics.ts:55-56` (asistente y MCP), `src/lib/pipeline-real.ts:77`, y de `assignSegment`: `won-deals.ts:22`, `deal-lines.ts:106`, `stale.ts:43`, `proactive/detectors/strategy-segments.ts:37,61`. `quarter-kpis.ts:2` promete en un comentario que Métricas muestra «las mismas cifras que Estrategia GTM → Presupuesto vs real».

**Fuera de este SDD (listadas para no perderlas):** A8 `revops.ts:26-27` (etapa desconocida cuenta como la primera; perdido sin transición se imputa a la primera o a la más avanzada, y llega al titular de Perdidos, `revops-panels.tsx:64,66`); A9 `metrics.tsx:111-115`, `:165` (deals de ex miembros salen como «Sin asignar»). Ver §15.

**Uso:** sin dato (no hay analítica de `/metrics`).

## 4. Resultado buscado
- Supuestos sin rotular en `/metrics`: línea base medida en código, 7 (A1-A7). Objetivo: 0.
- Secciones que parecen depender del trimestre y no dependen, sin decirlo: línea base 3 (Embudo, Perdidos, Cohortes) + win rates. Objetivo: 0.
- Cifras de las funciones compartidas que cambian: objetivo 0 (CA-12).
- Uso o satisfacción: sin dato.

## 5. Alcance
**Incluye:**
- Embudo y Perdidos filtrados por el trimestre; Cohortes y Tendencias con su ventana dicha.
- Win rate global, por origen y por rep del trimestre seleccionado.
- A1 corregido (es local a `/metrics`): «Sin origen».
- A2-A7 rotulados en `/metrics` con «Estimado · motivo», a partir de **campos nuevos aditivos** que devuelven las funciones compartidas; ningún valor existente cambia.
- Payback con margen 0 o negativo mostrado como «Sin dato · margen 0 % o negativo» en `/metrics` (la función sigue devolviendo lo mismo).
- Pistas de `/metrics` como enlace a su destino correcto.

**No incluye:**
- Cambiar ninguna cifra que devuelvan `capacityPlan`, `matchSegment`, `assignSegment`, `segmentAcv`, `segmentCoverage`, `paybackByQuarter`, `segmentBudget`, `quarterlyBudget`, `quarterKpis`, `wonDealsMargin`, `segmentCac`, `actuals` o `funnelDiagnosis`.
- Cualquier cambio visible en `/strategy`, Inicio, el asistente o MCP.
- Pasar los supuestos a «Sin dato» (alternativa en §15, pregunta 1).
- Unificar las fórmulas de CAC y payback (§15).
- `src/lib/advisor.ts:81` y A8-A9 (§15).
- Canal de adquisición y diccionario de métricas (NK-0029).
- Estilo visual (SDD-C1 y C2), `src/lib/headlines.ts`, `src/lib/nav.ts` (PR #76).
- Esquema, migraciones, RLS.

## 6. Cambios de comportamiento (delta)
**Añadido (solo en `/metrics`):** «Sin origen» en win rate por origen; «Estimado · N de M deals asignados por importe»; «Estimado · punto medio del rango» / «Estimado · mínimo del rango × 1,5»; «Estimado · margen del 100 % supuesto (falta margen)»; «Estimado · compartido repartido a partes iguales (nadie ganó)»; «Estimado · media de márgenes objetivo»; «Estimado · media de deals abiertos» para el ACV del tablero; «Últimos 365 días» en su win rate; «Todo el histórico · no depende del trimestre» en Cohortes; «no depende del trimestre» en Tendencias.
**Modificado:** Embudo y Perdidos → del trimestre; win rates → del trimestre, con pista «{n} cerrados en {T}»; payback con margen ≤ 0 → «Sin dato · margen 0 % o negativo»; pistas → enlaces.
**Eliminado:** el supuesto «sin origen = Outbound» en `/metrics`.

## 7. Historias y criterios de aceptación
### H-1: Como Owner o Sales Leader, quiero que el trimestre que elijo filtre lo que parece filtrar, para comparar trimestres sin mezclar periodos.
- **CA-1** Con el trimestre T, Embudo cuenta solo deals con `created_at` en T, y Perdidos solo deals perdidos con `closed_at ?? updated_at` en T. · prueba: `src/lib/metrics-quarter.test.ts`
- **CA-2** Cohortes muestra «Todo el histórico · no depende del trimestre» y Tendencias «Últimas 12 semanas · no depende del trimestre». · prueba: `src/components/metrics/revops-panels.test.tsx`
- **CA-3** Win rate global, por origen y por rep cuentan solo deals cerrados en T; la pista del KPI global dice «{n} cerrados en {T}»; sin cerrados en T, cada panel dice «Sin deals cerrados en {T}». · prueba: `src/lib/metrics-quarter.test.ts` (cálculo) y `src/components/metrics/metrics-screen.test.tsx` (textos)

### H-2: Como Owner o Sales Leader, quiero ver qué cifra se apoya en un supuesto, para no decidir sobre él sin saberlo.
- **CA-4** Un deal con `source` null cuenta en «Sin origen», nunca en «Outbound». · prueba: `src/lib/metrics-quarter.test.ts`
- **CA-5** Las filas de cobertura y de CAC por segmento devuelven cuántos deals se asignaron por importe (M = deals del segmento usados en esa cifra: todo el histórico para el ACV, ganados en T para «Deals ganados»), y la pantalla muestra «Estimado · N de M deals asignados por importe» cuando N > 0. · prueba: `src/lib/segment-coverage.test.ts` y `src/components/segment-coverage.test.tsx`
- **CA-6** `segmentAcv` devuelve además la base exacta («ganados», «abiertos», «punto_medio», «minimo_x1_5»), y Cobertura y Presupuesto por segmento la rotulan («Estimado · punto medio del rango», «Estimado · mínimo del rango × 1,5»). · prueba: `src/lib/segment-coverage.test.ts` y `src/components/segment-coverage.test.tsx`
- **CA-7** `capacityPlan` devuelve además si supuso el margen; Cobertura, Presupuesto por segmento y el KPI trimestral rotulan esos paybacks «Estimado · margen del 100 % supuesto (falta margen)». Con margen ≤ 0 la pantalla muestra «Sin dato · margen 0 % o negativo», nunca «Infinity» ni un número negativo. · prueba: `src/lib/metrics.test.ts` y `src/components/segment-coverage.test.tsx`
- **CA-8** `segmentCac` devuelve además la base del reparto del compartido («clientes», «partes_iguales» o ninguna); CAC real y Presupuesto por segmento rotulan «Estimado · compartido repartido a partes iguales (nadie ganó)». El total de empresa no cambia. · prueba: `src/lib/cac.test.ts` y `src/components/cac-panel.test.tsx`
- **CA-9** El tablero de Rendimiento rotula el margen según su origen («real», «de deals con líneas», «de plan» o «Estimado · media de márgenes objetivo»), el ACV según su base («Estimado · media de deals abiertos» cuando lo es) y su win rate con «Últimos 365 días». · prueba: `src/components/pipeline-board-panel.test.tsx`
- **CA-10** Toda marca de esta historia usa la forma «Estimado · motivo» o «Sin dato · motivo» que fija SDD-C2. · prueba: los tests de componente de CA-5 a CA-9

### H-3: Como Owner o Sales Leader, quiero que una pista me lleve a donde se arregla.
- **CA-11** «CAC real» → `/metrics?seccion=economia`; «Presupuesto por segmento» y «Presupuesto vs real» → `/strategy?tab=budget`. Ningún texto de `/metrics` dice «más abajo» o «más arriba» para referirse a otra sección. · prueba: `src/components/metrics/hints.test.tsx`

### H-4: Como Fede, quiero que nada fuera de `/metrics` cambie en este sprint.
- **CA-12** Para un conjunto fijo de datos ficticios que recorre A2-A7, las funciones de §5 «No incluye» (primera línea) y `getMetrics` de MCP devuelven lo mismo que en `f76f639` una vez quitados solo los campos nuevos declarados en §13; los tests existentes de esos módulos pasan sin cambios. La prueba guarda evidencia de que falla si se altera un valor existente (mutación: cambiar el `?? 100` por `?? 50` debe romperla). · prueba: `src/lib/strategy-freeze.test.ts`

## 8. Casos límite y errores
- Trimestre sin deals: «Sin deals en {T}», no ceros que parezcan medidos.
- Deal cerrado sin `closed_at`: se usa `updated_at`, la regla vigente (`metrics.tsx:138`). [Por verificar] cuántos hay: producción.
- Segmento sin `acv_min` ni `acv_max` y sin deals: hoy ACV 0 (`segment-coverage.ts:15-17`); se rotula «Sin dato · falta rango de ACV».
- Margen 0 o negativo: CA-7.
- Compartido con clientes solo en un segmento: reparto por clientes, ya declarado (`cac-panel.tsx:146`); se rotula como «repartido por clientes ganados» solo en la línea del compartido.
- Multitenant: sin consultas nuevas.

## 9. Experiencia y copy
- Textos de §6. Español, «tú», sin iconos; la palabra lleva el estado.
- La forma visual de «Estimado · motivo» y «Sin dato · motivo» la fija SDD-C2 (`DataState`, su U-2). Si A se construye antes que C, A entrega los textos con un envoltorio mínimo y C2 los pasa al componente sin cambiar las palabras.
- «Sin origen» (el rótulo que ya usa `/metrics`), no «Sin fuente».

## 10. Datos, permisos y privacidad
Sin tablas, columnas, RLS ni GRANT nuevos. Mismas consultas. Tests con datos ficticios. Finanzas sigue solo para Owner y Sales Leader (`metrics.tsx:218`, `:405-412`).

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| ninguna | — | — | — |

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-0 | Red de congelación: fixture ficticia, salida de las funciones compartidas y de `getMetrics` en `f76f639`, prueba de mutación con evidencia | CA-12 | `src/lib/strategy-freeze.test.ts` (pasa en base a propósito; su fallo-primero es la mutación, con evidencia guardada) |
| U-1 | `src/lib/metrics-quarter.ts` puro: filtro de Embudo y Perdidos, win rates del trimestre, «Sin origen»; `metrics.tsx` lo usa | CA-1, CA-3, CA-4 | `src/lib/metrics-quarter.test.ts` |
| U-2 | Ventana de Cohortes y Tendencias; textos de win rate | CA-2, CA-3 | `src/components/metrics/revops-panels.test.tsx`, `src/components/metrics/metrics-screen.test.tsx` |
| U-3 | Campos aditivos en `segmentAcv`, `capacityPlan`, `segmentCac`, `segmentCoverage`, `segmentBudget`/`periodBudget`, `quarterKpis`, `actuals` | CA-5 a CA-8 (parte pura) | `src/lib/segment-coverage.test.ts`, `src/lib/metrics.test.ts`, `src/lib/cac.test.ts` |
| U-4 | Rótulos en Cobertura, CAC real, Presupuesto por segmento, KPI trimestral y tablero; pistas enlazadas | CA-5 a CA-11 (pantalla) | `src/components/segment-coverage.test.tsx`, `src/components/cac-panel.test.tsx`, `src/components/pipeline-board-panel.test.tsx`, `src/components/metrics/hints.test.tsx` |

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- **Rotular, no recalcular.** Campos nuevos, todos opcionales para los consumidores: `segmentAcv` → `basis: "ganados" | "abiertos" | "punto_medio" | "minimo_x1_5" | "sin_rango"`; `capacityPlan` → `marginAssumed: boolean`; `SegmentCac` → `sharedBasis: "clientes" | "partes_iguales" | null`; filas de `segmentCoverage` → `inferredDeals`, `inferredWon`; filas de `periodBudget`/`quarterKpis` → los mismos indicadores agregados (`anyMarginAssumed`, `anyAcvEstimated`, `sharedBasis`); `actuals` → `acvBasis`. Ningún campo existente cambia de valor ni de tipo (CA-12).
- **Por qué no la opción estricta:** cambiaría cifras solo en `/metrics` y rompería la coincidencia con `/strategy`, el asistente y MCP (`quarter-kpis.ts:2`, `segment-coverage.ts:1`, `cac.ts:1`, `segment-budget.ts:3`; SDD 5c CA-1). Queda como pregunta 1 de §15, para cuando `/strategy` se descongele y se pueda cambiar en todas las superficies a la vez.
- **Filtro trimestral:** en `src/lib/metrics-quarter.ts`, antes de llamar a `RevopsFunnel`/`RevopsLost`, sin tocar `src/lib/revops.ts` (portado y probado).
- **Margen ≤ 0:** se resuelve en la presentación (`Number.isFinite` y signo); `capacityPlan` no cambia.
- **Tests de componente:** jsdom y Testing Library ya están configurados (`vitest.config.ts:8`); patrón de mocks en `src/components/strategy-screens.test.tsx:12-41`. Ningún test en `src/routes/` (el generador de rutas lo tomaría por ruta); si hace falta, con prefijo `-`.
- **Contrato entre los SDD del sprint (el mismo texto en A, B, C1 y C2):** A cambia datos y textos de datos de `/metrics`; B, la búsqueda de `/hub`; C1, estados de pantalla (carga, error, vacío), sección en la URL, vacíos y pistas de `/hub` y `/theory-u`; C2, el plegado de explicaciones en las tres pantallas y la forma del estado de un dato en `/metrics`. Orden de integración: A → B → C1 → C2.

## 14. Riesgos y dependencias
- Win rate trimestral con pocos cerrados es volátil; se muestran los recuentos (`3G/1P`, `metrics.tsx:332`). El asistente y MCP siguen con el histórico: dos ventanas de win rate vivas, cada una rotulada (lo recoge NK-0029 CA-18).
- Campos aditivos en funciones ya cargadas: CA-12 protege la rama existente.
- Rotular un supuesto no lo corrige: el payback al 100 % sigue siendo el número. Es una decisión de este sprint (§15, pregunta 1).

## 15. Preguntas para Fede y para la revisión técnica
1. **Rotular (propuesta) o «Sin dato»:** este SDD rotula los supuestos y no cambia cifras, para no romper `/strategy`, el asistente y MCP mientras `/strategy` está congelada. ¿Te vale, y abrimos en Sprint 2 el cambio a «Sin dato» en todas las superficies a la vez (junto con unificar CAC y payback)?
2. **Cohortes:** propongo rotularla «Todo el histórico». ¿O prefieres que también filtre por trimestre?
3. **Win rate al trimestre (CA-3):** ¿de acuerdo, o «histórico» rotulado?
4. **Fuera de alcance, ¿ticket aparte?:** `advisor.ts:81` (el asesor y el agente reciben «sin origen = Outbound»); A8 (imputación de perdidos en `revops.ts`); A9 (ex miembros como «Sin asignar»).
5. **Comentario de `quarter-kpis.ts:2`:** sigue siendo cierto con este planteamiento (las cifras coinciden); con la opción estricta habría que reescribirlo.

## 16. Pendiente de verificar
- Deals cerrados sin `closed_at`, sin `source` y sin `segment_id`: producción.
- Paneles no leídos por el gate (`LeadFunnelPanel`, `SelfServiceFunnel`, `StripeMetricsPanel`, `FinancePanel`, `won-deals-panel.tsx`): pueden tener más supuestos. Revisión en la segunda pasada del gate.

**Versión 2 (2026-11-06):** reescrito tras el gate. Cambia el enfoque de «opción estricta» a «rotular sin recalcular» (objeción 1). Añade BudgetPanel (2), corrige A3 (3), añade A6-A7 y lista A8-A9 (4), mueve las pruebas a un módulo puro y a tests de componente (5), corrige Cohortes y Tendencias (6), los destinos de CA-11 (7), el margen ≤ 0 (8), CA-12 con mutación (9), los rótulos (10), las coordinaciones (11) y define M (12). Las citas del §3 se corrigen según el gate. No ha tenido segunda pasada del gate.

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

## 18. Delta de implementación (lo rellena el agente al entregar)
—
