# SDD-20261109-metrics-sin-dato-rest · [Mejora] En Métricas, un «—» que significa «falta el dato» pasa a «Sin dato · motivo»

**Tipo:** Mejora (el ledger la registra como `feature`; ver §15) · **Prioridad propuesta:** Media
**Estado:** Hecho — PR #121 (268a2d3) · Aprobado por coordinador por delegación de Fede (2026-11-09), gate pasadas 1 y 2 · **Pide:** Fede (Sprint 3) · **Aprueba:** Fede · **Fecha:** 2026-11-09
**Ticket:** NK-0106
**PRD:** No aplica (cierra una regla ya aprobada: decisión 4 del §15 de NK-0089 y decisión 13 del §15 de `SDD-20261109-metrics-strategy-no-estimates.md`) · **Depende de:** `SDD-20261109-metrics-strategy-no-estimates.md` (Hecho: `DataMark`, `FigureValue`, `PlanValue`, `expectNoBareDash`, inventario CA-13) · **Coordina con:** `SDD-20261109-deals-no-source.md` (NK-0107/0108/0109): la clave `NO_SOURCE` («—») es una clave de agrupación, no un texto; este SDD la permite. **Se integra después de deals**, para que `METRICS_DASH_ALLOWED` nazca sin las claves K que deals elimina; la lista es un techo (máximo por fragmento), así que esas K no la rompen en ningún orden.

> Nivel elegido: SDD corto. Solo pantalla, sin esquema ni datos; lo pide el coordinador porque el ledger lo registra como `feature` y necesita SDD aprobado para promoverse.
> Números de línea comprobados en `main` `1fef724`.

## 1. Resumen
En `/metrics` quedan «—» sueltos donde falta el dato (Finanzas, Cohortes, Rendimiento, Autoservicio, Embudo de leads, Stripe, Cobertura, tablero, KPIs y presupuesto). Cada uno pasa a la forma ya aprobada en los Sprints 1 y 2: «Sin dato · motivo» con `DataMark`/`FigureValue`, «sin plan» con `PlanValue` cuando nadie escribió el plan, o la palabra «sin dato» dentro de un texto. Un «—» solo queda donde no falta nada (objetivo vacío, celda de entrada vacía, nombre que no existe, clave de agrupación), en una lista cerrada que un test de fuente comprueba.

## 2. Problema y para quién
Owner y Sales Leader leen en Métricas un «—» que puede significar «no hay datos», «no aplica» o «cero». No saben si falta información ni qué hacer para tenerla.

## 3. Evidencia y por qué ahora
**Formas existentes:** `src/components/metrics/data-mark.tsx:1-16` (`DataMark`, estados `real`, `estimado`, `sin_dato` con motivo), `src/components/metrics/figure.tsx:1-40` (`FigureValue`, `FigureNote`, `PlanValue` con «sin plan»), `src/components/data-state.tsx` (forma visual), `src/test/data-marks.ts:40-61` (`expectNoBareDash`), `src/lib/metrics-formulas-single.test.ts:89-190` (inventario CA-13 por archivo).

**Inventario completo** (búsqueda de `—` en los archivos que pinta `src/routes/_authenticated/metrics.tsx`, imports `:3-43`; sin comentarios ni título de página). Clasificación del autor: **F** = falta el dato → «Sin dato · motivo» (o «sin plan» si es un plan no escrito, o «sin dato» dentro de un texto); **N** = no aplica, se queda; **K** = clave de agrupación, se queda.

| Archivo:línea | Qué es | Clase | Cambia a |
|---|---|---|---|
| `metrics/finance-panel.tsx:96` | `money0` null: presupuesto (gasto, ingresos) o real (ingresos, margen) | F | plan → `PlanValue` «sin plan»; real → «Sin dato · sin ingresos del trimestre» (ingresos) / «Sin dato · falta el ingreso real» (margen) |
| `metrics/finance-panel.tsx:97` | `ratio` null: ROI real y presupuestado | F | «Sin dato · falta ingreso o gasto» (real); «sin plan» (presupuestado) |
| `metrics/finance-panel.tsx:204`, `:210`, `:215` | gasto real, captación, operativos = 0 | F | «Sin dato · sin costes apuntados» |
| `metrics/finance-panel.tsx:233` | margen % null | F | «Sin dato · falta el ingreso real» |
| `metrics/finance-panel.tsx:251` | cobrado = 0 | F | con `revenueSource === "facturas"` (hay facturas emitidas en el trimestre, `finance-dashboard.ts:90`, `:95`) es un 0 real → `money(0)`; si no, «Sin dato · sin cobros registrados» |
| `metrics/revops-panels.tsx:238` | win rate de cohorte null | F | «Sin dato · sin deals cerrados» |
| `metrics/revops-panels.tsx:240` | mediana de días a ganar null | F | «Sin dato · sin deals ganados» |
| `metrics/revops-panels.tsx:32`, `:207` | etiqueta y clave de «Sin origen» | K | sin cambio aquí (NK-0107/0109 lo mueve a `src/lib/deal-source.ts`) |
| `metrics/revops-panels.tsx:41`, `:208` | clave «Sin segmento» | K | sin cambio |
| `metrics/performance-panels.tsx:52` | cobertura de pipeline sin cuota | F | «Sin dato · sin cuota del trimestre» |
| `metrics/performance-panels.tsx:87` | win rate global null (la marca ya está en el `hint`) | F | la marca pasa al valor; el `hint` queda libre |
| `metrics/performance-panels.tsx:21` | etiqueta de la clave `NO_SOURCE` | K | sin cambio aquí (NK-0107/0109) |
| `routes/_authenticated/metrics.tsx:48`, `:50` | título de la página («Métricas RevOps — Nokko») | N | se quedan (título de página) |
| `routes/_authenticated/metrics.tsx:334` | cuota de un comercial que nadie escribió | N | se queda (objetivo vacío) |
| `self-service-funnel.tsx:26` (`dd`) | mediana de días null (compra, activación) | F | «Sin dato · sin compras» / «Sin dato · sin activaciones»; en el `hint` de texto, «sin dato» |
| `self-service-funnel.tsx:102`, `:108` | activación y prueba → pago sin registros | F | «Sin dato · sin registros en el periodo» |
| `self-service-funnel.tsx:109` | «activados → pago —» dentro de un texto | F | «activados → pago: sin activados» |
| `self-service-funnel.tsx:178` | celda activados → pago sin activados | F | «Sin dato · sin activados» |
| `leads/lead-funnel-panel.tsx:10` (`dd`) | mediana de días hasta MQL/SQL/oportunidad/ganado null | F | «Sin dato · ningún lead llegó a esta etapa» |
| `stripe-panel.tsx:266` (`pctText`) | churn null, dentro de un texto (`:309`) | F | «sin dato» |
| `segment-coverage.tsx:212` | cobertura del segmento sin objetivo | F | «Sin dato · sin objetivo de ventas del trimestre» |
| `segment-coverage.tsx:242`, `:282`, `:296`, `:356` | objetivo que nadie escribió («/ obj. —», «/ —») | N | se quedan |
| `cac-panel.tsx:71` (`cell`), `:360` | celdas de coste por canal sin valor (tabla de entrada) | N | se quedan |
| `cac-panel.tsx:415` | CAC objetivo vacío | N | se queda |
| `quarter-kpis-panel.tsx:98` (`money0`) | ingresos, coste de servir, captación null | F | real → `FigureValue` con «Sin dato · sin ingresos del trimestre» (ingresos), «Sin dato · sin coste de servir apuntado» (coste de servir), «Sin dato · sin gasto de captación apuntado» (captación); plan → `PlanValue` «sin plan» |
| `quarter-kpis-panel.tsx:120` | clientes nuevos null | F | real → «Sin dato · sin deals ganados en el trimestre»; plan → «sin plan» |
| `pipeline-board-panel.tsx:149` | gasto de captación del trimestre = 0 | F | «Sin dato · sin gasto de captación apuntado» (hoy `expectNoBareDash` permite «— Apúntalo en «CAC real»») |
| `pipeline-board-panel.tsx:112` | propietario sin nombre | N | se queda |
| `budget-panel.tsx:160-161` | ingresos real / plan null | F | real → «Sin dato · sin ingresos del trimestre»; plan → «sin plan» |
| `budget-panel.tsx:170-171` | captación real = 0 / plan null | F | real → «Sin dato · sin gasto de captación apuntado»; plan → «sin plan» |
| `won-deals-panel.tsx:63` | segmento que no existe | N | se queda |
| `src/lib/metrics-quarter.ts:22`, `src/lib/revops.ts:86-87` | claves `NO_SOURCE` y «—» de agrupación | K | sin cambio (deals sustituye el literal de `:87` por `NO_SOURCE`) |
| `src/lib/revops.ts:85` | `lostFrom ?? "—"`: etapa de pérdida desconocida; pasa por `stageLabel` (`metrics.tsx:124`, `stages.ts:45-47`) y se pinta tal cual («Donde más se pierden: —») | N | se queda; solo ocurre con el camino de etapas vacío (`revops.ts:27`), sin etapas no hay «dónde» que decir |

Total: 47 líneas con «—» en 15 archivos (13 de pantalla y 2 de `src/lib`); F = 26, N = 13 (incluye el título de página, `metrics.tsx:48`, `:50`, y `revops.ts:85`), K = 8, contadas por línea (`dd`, `money0`, `ratio`, `cell` y `pctText` cuentan una vez: la línea donde se definen). Los motivos exactos de cada F los fija la regla pura de su módulo cuando ya exista (p. ej. `figureMark`), o una constante del componente; la tabla da el texto a usar.

**Recuento sobre la rama de integración (deals primero):** la tabla y el recuento se hicieron sobre `1fef724`. Como `SDD-20261109-deals-no-source.md` se integra antes, el inventario y los números de línea **se vuelven a contar sobre la rama de integración con deals ya integrado**. Las cuatro entradas K que tras deals dejan de tener «—» (`revops-panels.tsx:32` y el literal de `:207`, `performance-panels.tsx:21` y el literal de `revops.ts:87`) **no se añaden** a `METRICS_DASH_ALLOWED`; la lista techo nace sin ellas.

**Conjunto de archivos de CA-1:** los imports directos de `metrics.tsx` bajo `src/components` (con sus subcarpetas) + `src/routes/_authenticated/metrics.tsx` + `src/lib/revops.ts` + `src/lib/metrics-quarter.ts`. Los imports directos de `src/lib` en `metrics.tsx` no tienen «—» hoy (comprobado por el gate).

**Fuera de `/metrics`** (Estrategia, Inicio): `motions.tsx`, `budget-quarters.tsx`, `payback-card.tsx`, `payback-quarters.tsx` siguen con el inventario de CA-13 del Sprint 2, sin cambios.

**Uso real:** sin dato.

## 4. Resultado buscado
- En `/metrics`, ningún «—» significa «falta el dato»; cada uno dice «Sin dato · motivo», «sin plan» o «sin dato».
- Línea base: 26 líneas F (tabla de §3). Meta: 0, comprobada por el test de fuente.

## 5. Alcance
**Incluye:** las líneas F de §3 en los 10 archivos que las tienen; un test de fuente nuevo; actualizar las listas permitidas existentes que dejen de ser ciertas (`metrics-formulas-single.test.ts` DASH_ALLOWED de `segment-coverage.tsx`, `cac-panel.tsx`, `quarter-kpis-panel.tsx`, `pipeline-board-panel.tsx`, `budget-panel.tsx`, y los `expectNoBareDash` de sus tests), **solo quitando** entradas. Las claves de archivo de `DASH_ALLOWED` se mantienen las 9 (el test comprueba `Object.keys(DASH_ALLOWED)` = 9 archivos): un archivo que se quede sin entradas, como `budget-panel.tsx`, conserva su clave con `[]`, como ya hace `payback-quarters.tsx`.
**No incluye** (el brief lo copia a «Movimientos prohibidos»):
- Cambiar cálculos, fuentes o funciones puras (`finance-dashboard.ts`, `revops.ts`, `self-service.ts`, `lead-funnel.ts`…).
- Cambiar las claves de agrupación ni las etiquetas de origen (NK-0107/0109).
- Superficies fuera de `/metrics` (Estrategia, Inicio, Pipeline, Leads).
- Textos nuevos que no sean los motivos de §3.
- Añadir entradas a una lista permitida existente.

## 6. Cambios de comportamiento (delta)
**Modificado:** las 26 líneas F: «—» → «Sin dato · motivo» / «sin plan» / «sin dato» según §3.
**Añadido:** `src/lib/metrics-no-bare-dash.test.ts`.
**Eliminado:** las entradas de listas permitidas que dejan de existir.

## 7. Historias y criterios de aceptación
### H-1: Como Owner o Sales Leader, quiero que Métricas me diga qué falta en vez de un guion.
- **CA-1** (fuente, lista cerrada) Para cada uno de los 15 archivos del conjunto definido en §3, toda línea con «—» está en la lista cerrada `METRICS_DASH_ALLOWED` del test con su clase (N o K) y un máximo de apariciones (techo); las F no están. El test calcula el conjunto a partir de los imports directos de `metrics.tsx` bajo `src/components` más `metrics.tsx`, `src/lib/revops.ts` y `src/lib/metrics-quarter.ts`, y falla si aparece un archivo nuevo de ese conjunto con «—» que no esté en la lista. · prueba: `src/lib/metrics-no-bare-dash.test.ts` (nuevo, mismo estilo que `metrics-formulas-single.test.ts:167-190`; falla hoy con las 26 F)
- **CA-2** (Finanzas) Con un trimestre sin presupuesto, sin facturas, sin costes ni cobros, el panel pinta `[data-mark="sin_dato"]` con los motivos de §3 y «sin plan» en las filas de presupuesto; `expectNoBareDash(container, [])`. · prueba: `src/components/metrics/finance-panel.test.tsx` (nuevo)
- **CA-3** (Cohortes y Rendimiento) Una cohorte sin cerrados y sin ganados pinta «Sin dato · sin deals cerrados» y «Sin dato · sin deals ganados»; sin cuota, Cobertura de pipeline pinta «Sin dato · sin cuota del trimestre»; el win rate global sin cerrados lleva la marca en el valor. · prueba: `src/components/metrics/revops-panels.test.tsx` y `src/components/metrics/performance-panels.test.tsx` (casos nuevos con `expectDataMarks` y `expectNoBareDash`)
- **CA-4** (Autoservicio, Embudo de leads, Stripe) Sin registros, sin activados y sin compras, y sin leads en una etapa, se ven las marcas de §3; el churn sin dato dice «sin dato» dentro del texto. · prueba: `src/components/self-service-funnel.test.tsx`, `src/components/leads/lead-funnel-panel.test.tsx`, `src/components/stripe-panel.test.tsx` (nuevos o casos nuevos)
- **CA-5** (Cobertura, KPIs, tablero, presupuesto) Las F de `segment-coverage.tsx`, `quarter-kpis-panel.tsx`, `pipeline-board-panel.tsx` y `budget-panel.tsx` pintan su marca; sus tests existentes quitan de `expectNoBareDash` las entradas que ya no existen («— Apúntalo en «CAC real»» incluida) y no añaden ninguna. · prueba: `src/components/segment-coverage.test.tsx`, `src/components/quarter-kpis-panel.test.tsx`, `src/components/pipeline-board-panel.test.tsx`, `src/components/budget-panel.test.tsx`
- **CA-6** (claves) `NO_SOURCE`, las claves de `revops.ts:86-87` y las de `revops-panels.tsx:41`, `:207-208` siguen agrupando igual y rotulándose «Sin origen»/«Sin segmento». Se comprueba **por valor**, no por la presencia del literal «—» en la fuente: `NO_SOURCE === "—"`, los deals sin origen y sin segmento agrupan bajo esa clave en `revops.test.ts` y los paneles pintan «Sin origen»/«Sin segmento». · prueba: `src/lib/revops.test.ts` (guarda) y los tests de los paneles (`revops-panels.test.tsx`, `performance-panels.test.tsx`)

## 8. Casos límite y errores
- **Cero real vs. falta:** gasto 0 se trata como «sin costes apuntados» (el gasto sale de lo que se apunta). Cobrado 0 con facturas emitidas en el trimestre es un 0 real; sin facturas, «Sin dato · sin cobros registrados». Se distingue con `revenueSource`: `quarterFinance` pone `"facturas"` si y solo si hay facturas emitidas en el trimestre (`finance-dashboard.ts:90`, `:95`).
- **Textos de una sola cadena** (`hint` de `Kpi`, Stripe): no admiten componentes; se usa «sin dato» en minúscula, sin guion.
- **Carga y error:** siguen como hoy (`ScreenState`); las marcas son para datos cargados.
- **Otra empresa:** sin cambios.

## 9. Experiencia y copy
Formas: «Sin dato · motivo» (marca), «sin plan» (plan no escrito, `PlanValue`), «sin dato» (dentro de un texto). Motivos en minúscula, de 2 a 6 palabras, que digan qué falta: los de la tabla de §3. Sin iconos, «tú» implícito.

## 10. Datos, permisos y privacidad
Sin cambios de datos ni permisos. Pruebas con la fixture ficticia `src/test/metrics-fixture.ts`.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| ninguna | — | — | — |

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | Test de fuente con la lista cerrada N/K de §3 | CA-1, CA-6 | `src/lib/metrics-no-bare-dash.test.ts` (falla con las 26 F) |
| U-2 | Finanzas | CA-2 | `src/components/metrics/finance-panel.test.tsx` |
| U-3 | Cohortes, Rendimiento | CA-3 | `revops-panels.test.tsx`, `performance-panels.test.tsx` |
| U-4 | Autoservicio, Embudo de leads, Stripe | CA-4 | `self-service-funnel.test.tsx`, `lead-funnel-panel.test.tsx`, `stripe-panel.test.tsx` |
| U-5 | Cobertura, KPIs, tablero, presupuesto (y quitar entradas de `metrics-formulas-single.test.ts` y de sus `expectNoBareDash`) | CA-5 | los cuatro tests de CA-5 con `expectNoBareDash` sin las entradas F |

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- Reutilizar `DataMark` y `PlanValue`; no crear otra forma. Para celdas de tabla, `DataMark` directamente.
- El test de fuente copia la mecánica de `metrics-formulas-single.test.ts:171-190` (fragmento más específico gana, máximo por fragmento) y añade la comprobación de «archivo nuevo de `/metrics`» a partir de los imports de `metrics.tsx`.
- Los cinco archivos ya inventariados en `metrics-formulas-single.test.ts` (`segment-coverage.tsx`, `cac-panel.tsx`, `quarter-kpis-panel.tsx`, `pipeline-board-panel.tsx`, `budget-panel.tsx`) quedan cubiertos por los dos tests; las entradas que este SDD convierte se quitan de los dos.

## 14. Riesgos y dependencias
- **NK-0107/0109** toca `revops-panels.tsx` y `performance-panels.tsx` (mapas de etiquetas y `:207`); este SDD toca `:238`, `:240`, `:52`, `:87`. Quien integre segundo resuelve; ninguno cambia las líneas del otro.
- **Motivos inexactos:** un motivo que no corresponda a la causa real sería peor que el guion; cada motivo se prueba con una fixture que produce esa causa.

## 15. Preguntas para Fede y para la revisión técnica
**Decisiones tomadas (autor):**
- **D-1.** Nivel: SDD corto sin PRD, aunque el ledger diga `feature`: es la aplicación de una regla ya aprobada a más superficies, sin objetivo de negocio nuevo.
- **D-2.** Un objetivo o plan que nadie escribió, una celda de entrada vacía y un nombre que no existe se quedan con «—» (N), como hizo CA-13 del Sprint 2.
- **D-3** (decisión del coordinador, delegación de Fede, 2026-11-09). Gasto 0 = «sin costes apuntados» (falta el dato), no «0 €».

**Decisión del coordinador (delegación de Fede, 2026-11-09):** D-3 confirmada; este SDD se integra después de `SDD-20261109-deals-no-source.md`.

**Para Fede:** ninguna.

## 16. Pendiente de verificar
- Resuelto (gate): `revenueSource === "facturas"` indica que hay facturas en el trimestre (§8).
- [Por verificar] Que no hay otro componente de `/metrics` cargado de forma diferida que no salga en los imports de `metrics.tsx` (el test de CA-1 lo detecta solo para imports directos).

**Lo que NO se afirma:**
- No se cambian números, solo cómo se dice que falta uno.
- No se toca ninguna superficie fuera de `/metrics`.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Un agente `nokko-gate` con contexto fresco lee este SDD y el código, y devuelve su informe. El coordinador lo copia aquí sin editarlo. El gate no aprueba el SDD: informa; la aprobación es de Fede.
- Veredicto del gate (pasada 1, 2026-11-09, `.factory/evidence/sprint3-sdd-gate/gate-pass1.md`): APROBABLE con menores (0 bloqueantes, 0 mayores, 5 menores). El gate confirmó el inventario (45 líneas; F 26, N 10, K 9) antes de las correcciones de abajo.

### §17 Gate · pasada 1: hallazgos y resolución
| Hallazgo | Resolución |
|---|---|
| **MENOR M-m1** Falta el título de página (`metrics.tsx:48`, `:50`) en la lista cerrada | Añadido a §3 como N («título de página»). |
| **MENOR M-m2** El conjunto de archivos de CA-1 no está bien definido | §3 y CA-1: imports directos de `metrics.tsx` bajo `src/components` + `metrics.tsx` + `src/lib/revops.ts` + `src/lib/metrics-quarter.ts`. |
| **MENOR M-m3** `revops.ts:85` clasificada K pero se pinta tal cual | Reclasificada N con su motivo (camino de etapas vacío); recuento: 47 líneas, F 26, N 13, K 8. |
| **MENOR M-m4** Faltan motivos de `quarter-kpis-panel.tsx:98`, `:120`; «Por verificar» de facturas | Motivos fijados en §3; «Cobrado» usa `revenueSource === "facturas"`; el «Por verificar» queda resuelto. |
| **MENOR M-m5** Mantener las 9 claves de `DASH_ALLOWED` del Sprint 2 | §5: las claves se mantienen; un archivo sin entradas conserva `[]`. |
| Coherencia con deals (gate §«Coherencia» 1) | Cabecera: este SDD se integra después de deals; la lista es un techo. |
| Decisión del coordinador: Métricas D-3 | Registrada en §15; pregunta a Fede retirada. |

### §17 Gate · pasada 2 (2026-11-09, `.factory/evidence/sprint3-sdd-gate/gate-pass2.md`): hallazgos y resolución
- Veredicto: APROBABLE con menores (0/0/1).

| Hallazgo | Resolución |
|---|---|
| **MENOR M2-m1** Con deals integrado antes, las K que deals elimina no deben entrar en la lista | §3: el inventario se vuelve a contar sobre la rama de integración con deals; las 4 entradas K que pierden «—» no se añaden a `METRICS_DASH_ALLOWED`; CA-6 se comprueba por valor (`NO_SOURCE === "—"`, etiquetas en `revops.test.ts` y paneles), no por el literal. |

## 18. Delta de implementación (lo rellena el agente al entregar)
Rama `feat/nk-0106-metrics-sin-dato` sobre `d3eeba1`. Recuento sobre la base con deals integrado: 47 líneas, F 26, N 13, K 4 (las cuatro K de deals no entran en `METRICS_DASH_ALLOWED`). Las 26 F pasan a «Sin dato · motivo», «sin plan» o «sin dato». Test nuevo `src/lib/metrics-no-bare-dash.test.ts` y casos nuevos en los tests de §12. Desvío: en Presupuesto, con costes compartidos sin repartir, el valor dice «Sin dato · nadie ganó: el compartido no se reparte» y no «sin gasto de captación apuntado» (sería falso). Evidencia en `.factory/evidence/NK-0106/result.md`.
