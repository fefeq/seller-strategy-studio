# SDD-20261118-ux-legibilidad-pantallas-diarias · [Mejora] Legibilidad y objetivos táctiles en Leads, Cuentas y Métricas

**Tipo:** Mejora · **Prioridad propuesta:** Media
**Estado:** En curso, implementado el 2026-11-18 (aprobado por Fede ese día con las decisiones D-1 a D-4 tal como se recomendaron; gate con objeciones, sin aprobación de entrega; ver secciones 17 y 18) · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-11-18
**PRD:** No aplica (mejora acotada) · **Depende de:** —

> Un SDD dice cómo se verifica que está bien hecho. Cada criterio de aceptación (CA-n) debe poder tener una prueba automática que lo nombre.
> Cuando un CA es de geometría (solapes, tamaños), jsdom no puede medirlo: lo digo en la columna «prueba» y en la sección 17.

## 1. Resumen
Se corrigen seis defectos de legibilidad y de uso táctil detectados al revisar Leads, Cuentas y Métricas en la instancia local (escritorio, móvil de 375 px, claro y oscuro): una cadena repetida, un origen de lead partido en dos por una mayúscula, rejillas que se pisan en el ancho intermedio, una tabla trimestral difícil de leer, objetivos táctiles de menos de 44 px y una cabecera móvil apretada. No se cambia ningún dato, permiso, texto de «Sin dato» ni llamada a IA.

## 2. Problema y para quién
Fede (único usuario hoy) lee estas pantallas a diario, a menudo en móvil. Hay texto que se pisa o se repite, y botones y enlaces que cuestan de pulsar con el pulgar.

## 3. Evidencia y por qué ahora
Revisión del 2026-11-18 sobre `localhost:5173` (backend compartido, solo lectura; sin tocar datos) y lectura del código en `main`. Ningún dato de cliente se reproduce aquí.

| # | Qué se vio | Causa localizada en el código |
|---|---|---|
| E-1 | «Línea principal B2B mid-market / híbrido · arquetipo B, B2B mid-market / híbrido» (se repite en Estrategia y Métricas) | `src/components/primary-line-note.tsx:23-24` imprime `primary.label` y `primary.result.name`; cuando la línea se llama como el arquetipo, salen dos veces |
| E-2 | «Conversión por origen» lista «manual» y «Manual» como dos orígenes | `src/routes/_authenticated/leads.index.tsx:117` agrupa por `l.source` literal con `funnelBy` (`src/lib/lead-funnel.ts:258`) |
| E-3 | En «Conversión de los leads», «CONTACTADO» pisa a «MQL» y «OPORTUNIDAD» a «GANADO» con el panel de ~500 px (viewport 1106 px con el menú lateral) | `leads.index.tsx:613` usa `md:grid-cols-6`: el salto depende del viewport, no del ancho real del contenido, que el menú de 240 px recorta. Igual en `leads.index.tsx:218` (`md:grid-cols-4`). Hay 11 usos de `md:grid-cols-4…6` en `src` sin tests; solo 2 entran en el alcance |
| E-4 | Tabla trimestral de Métricas: cada celda ocupa 3–4 líneas; en «Margen bruto» se lee «plan Sin dato · falta margen» pegado | `quarter-kpis-panel.tsx:213-214` (`min-w-[680px]`, columnas sin ancho propio) y `PlanValue` (`src/components/metrics/figure.tsx:33`) devuelve la marca en línea tras la palabra «plan» |
| E-5 | A 375 px: 15 elementos interactivos de menos de 44 px en Leads y 30 en Métricas (enlaces de las migas ~16 px, «Avisos» ~20 px, pestañas 32 px, «Tablero/Listado» 36 px) | `flow-strip.tsx` (enlaces `text-xs`), `notification-center.tsx:154-159`, `ui/tabs.tsx` (`TabsTrigger` `h-8`) |
| E-6 | Cabecera móvil: «Buscar» pegado a «Avisos · 14» | `src/routes/_authenticated/route.tsx:208-212`: el botón mide `size-11` (44 px de ancho) pero la palabra «Buscar» es más ancha, así que se sale de su caja |

**Correcciones a mi revisión anterior (para que no se arrastren):**
- **No** conviene colapsar «Sin dato · motivo» a «—». El repo lo prohíbe: la prueba `quarter-kpis-panel.test.tsx` dice «NK-0106: no «—» is allowed any more» y fija los textos «Sin dato · sin ingresos del trimestre», etc. Mi recomendación anterior chocaba con esa decisión. Ver D-1 en la sección 15.
- «Margen bruto» **no** es un solape: son dos marcas (la real y la del plan) en la misma celda, con la del plan pegada a la palabra «plan».
- Las pestañas **sí** tienen indicador: `TabsList` desvanece el borde cuando hay más (`ui/tabs.tsx`). Queda abierto solo si la pestaña recomendada se ve al entrar **[Por verificar]**; no está en este SDD.
- El solape del embudo de Leads **no** ocurre en móvil (2 columnas); es de ancho intermedio.

## 4. Resultado buscado
| Medida | Línea base (2026-11-18, medida) | Objetivo |
|---|---|---|
| Etiquetas del embudo y de los KPI de Leads que se pisan, a anchos de contenido 320, 500, 640, 900 y 1100 px | 1 pantalla con solape a ~500 px (E-3) | 0 |
| Orígenes duplicados por mayúsculas/espacios en «Conversión por origen» | 1 par («manual»/«Manual») | 0 |
| Apariciones del nombre del arquetipo en la línea principal cuando coincide con el de la línea | 2 | 1 |
| Altura de los elementos nombrados en CA-8 a 375 px | 16–36 px | ≥ 44 px |
| Líneas por celda de la tabla trimestral con el texto de «Sin dato» actual | 3–4 (a 375 px) | ≤ 3 y la marca del plan en línea propia |

No se fija una meta global de «elementos bajo 44 px» por pantalla: quedarían otros fuera del alcance (sección 5).

## 5. Alcance
**Incluye:** U-1 a U-6 de la sección 12, solo en las rutas `/leads`, `/accounts` y `/metrics` y en los componentes compartidos que ellas usan (`PrimaryLineNote`, `FlowStrip`, `TabsTrigger`, `NotificationCenter`, cabecera móvil).

**No incluye** (límite que el brief copia a «Movimientos prohibidos»):
- Cambiar el texto, la palabra o el atributo `data-mark` de «Real», «Estimado» y «Sin dato · motivo», o sustituirlos por «—».
- Modificar o borrar pruebas existentes. Las nuevas pruebas son añadidos; las protegidas (`nav.test.ts`, titulares, `linkedin-legal*`) no se tocan.
- Datos, migraciones, RLS, permisos, rutas y menú.
- Llamadas a IA.
- Otros hallazgos de la revisión, que van aparte (sección 15): módulos repetidos en Inicio, estado vacío de Pipeline, cinco botones en la cabecera de Cuentas, «SANO» uniforme, menú lateral cortado en pantallas bajas, titulares grandes.

## 6. Cambios de comportamiento (delta)
**Añadido:** función pura `normalizeLeadSource` para agrupar orígenes; una prueba de guardia de rejillas.
**Modificado:**
- Línea principal: «arquetipo B, B2B mid-market / híbrido» → una sola vez cuando el nombre de la línea y el del arquetipo coinciden.
- «Conversión por origen» y el filtro «Comparar por» origen: un grupo por origen sin distinguir mayúsculas ni espacios.
- Rejillas del embudo y de los KPI de Leads: columnas según el ancho disponible, no según el viewport.
- Tabla trimestral: columnas con ancho mínimo; en cada celda, «plan» y su marca en líneas separadas; en pantalla estrecha, el trimestre actual aparece primero y la tabla indica que se desliza.
- En pantalla estrecha, altura táctil mínima de 44 px en los elementos de CA-8.
- Cabecera móvil: «Buscar» con ancho propio y separación fija con «Avisos».
**Eliminado:** nada.

## 7. Historias y criterios de aceptación
### H-1: Como Fede, quiero leer la línea principal sin repeticiones para entenderla de un vistazo.
- **CA-1** Si `label` y `result.name` coinciden (sin distinguir mayúsculas ni espacios), el texto contiene el nombre una sola vez y mantiene «arquetipo X». Si difieren, se muestran ambos como hoy. · prueba: `src/components/primary-line-note.test.tsx`
- **CA-2** Sin línea principal, el aviso y el enlace «Defínela» no cambian. · prueba: `src/components/primary-line-note.test.tsx`

### H-2: Como Fede, quiero que cada origen cuente una sola vez para que la conversión por origen no se parta.
- **CA-3** `normalizeLeadSource` iguala «manual», «Manual» y « manual » en una clave; vacío o nulo da «Sin origen». · prueba: `src/lib/lead-source.test.ts`
- **CA-4** «Conversión por origen» muestra una fila por clave con la suma de leads y de resultados; la etiqueta es la forma más frecuente y, en empate, la que lleva mayúscula inicial. · prueba: `src/lib/lead-source.test.ts`
- **CA-5** Los datos guardados no cambian: la tarjeta del lead sigue mostrando el origen tal como se guardó. · prueba: `src/lib/lead-source.test.ts` (la función es pura y no escribe)

### H-3: Como Fede, quiero que el embudo y los KPI de Leads no se pisen a ningún ancho.
- **CA-6** Ningún bloque del embudo ni de los KPI de Leads se superpone con otro a anchos de contenido de 320, 500, 640, 900 y 1100 px, en claro y oscuro. · prueba: evidencia en navegador (no automatizable en jsdom) + guardia `src/lib/layout-grids.test.ts`, que falla mientras `leads.index.tsx` use `md:grid-cols-4` o `md:grid-cols-6` en esos bloques

### H-4: Como Fede, quiero leer la tabla trimestral sin que se amontonen las marcas.
- **CA-7** Los textos de las marcas no cambian: las pruebas existentes de `quarter-kpis-panel.test.tsx`, `data-state.test.tsx` y `metrics/finance-panel.test.tsx` siguen en verde **sin modificarse**. · prueba: las suites existentes
- **CA-7b** En cada celda con plan, la palabra «plan» y su marca van en líneas distintas (la marca con `block`); «sin plan» se queda en línea. · prueba: `src/components/quarter-kpis-panel.layout.test.tsx`
- **CA-7c** Las celdas tienen ancho mínimo propio y ninguna marca ocupa más de 3 líneas a 375 px. · prueba: evidencia en navegador
- **CA-7d** En pantalla estrecha el contenedor muestra desvanecido en el borde con más contenido y, al montar, la columna del trimestre actual queda a la vista. · prueba: `src/components/quarter-kpis-panel.layout.test.tsx` (con `scrollIntoView` simulado)

### H-5: Como Fede, quiero pulsar con el pulgar sin fallar.
- **CA-8** A menos de 768 px, estos elementos miden al menos 44 px de alto: enlaces de `FlowStrip`, el disparador «Avisos», las pestañas (`TabsTrigger`), «Tablero/Listado» de Leads y «Editar líneas». Se usa `min-h-11 md:min-h-0`, como ya hacen `move-menu.tsx` y `quick-actions.tsx`. · prueba: `src/components/touch-targets.test.tsx` (clases) + medición en navegador a 375 px
- **CA-9** En escritorio (≥768 px) los tamaños actuales no cambian. · prueba: `src/components/touch-targets.test.tsx`

### H-6: Como Fede, quiero una cabecera móvil que no se apriete.
- **CA-10** «Buscar» no se sale de su caja (`min-w-11 px-1 text-sm` en vez de `size-11`), la página no es más ancha que la pantalla a 360 y 375 px (`scrollWidth` igual al ancho de la ventana) y entre los textos de «Buscar», «Avisos» y «Menú» hay al menos 8 px; ninguno queda truncado. *(Redactado de nuevo tras la medición del 2026-11-18: la versión original, «12 px a 375 px», hacía la cabecera más ancha que la pantalla; ver sección 18.)* · prueba: `src/routes/_authenticated/route.header.test.tsx` (clases) + medición en navegador a 375 px

## 8. Casos límite y errores
- Origen con espacios, mayúsculas mixtas o solo espacios: una clave; solo espacios cuenta como «Sin origen» (CA-3).
- Orígenes con la misma letra pero acento distinto («Reunión»/«Reunion»): **no** se unen; solo se normalizan mayúsculas y espacios.
- Línea sin arquetipo o con `extra` > 0: el sufijo «N líneas más» se conserva (CA-1).
- Trimestre actual fuera de los visibles: la tabla muestra el primero y no falla (CA-7d).
- Datos vacíos o una sola empresa: sin cambio. Varias empresas: sin cambio, nada se lee ni escribe nuevo.
- Pantalla de 320 px: es el ancho mínimo de la prueba de CA-6.

## 9. Experiencia y copy
No hay textos nuevos. Se conservan «Sin dato · …», «sin plan», «Buscar», «Avisos». No se añaden iconos (regla de la plantilla); la cabecera móvil se arregla con ancho y separación, no con un icono.

## 10. Datos, permisos y privacidad
Sin tablas, columnas, migraciones, RLS ni permisos nuevos. Solo se leen datos ya cargados. Ningún dato de cliente en pruebas: se usan orígenes y líneas ficticios («Origen A», «Línea ficticia»).

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| ninguna | — | — | — |

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | `PrimaryLineNote` sin repetir el nombre | CA-1, CA-2 | `src/components/primary-line-note.test.tsx` |
| U-2 | `normalizeLeadSource` y su uso en `leads.index.tsx` | CA-3, CA-4, CA-5 | `src/lib/lead-source.test.ts` |
| U-3 | Rejillas por ancho disponible en el embudo y KPI de Leads | CA-6 | `src/lib/layout-grids.test.ts` |
| U-4 | Tabla trimestral: ancho de columna, marca del plan en línea propia, borde desvanecido y trimestre actual a la vista | CA-7, CA-7b, CA-7c, CA-7d | `src/components/quarter-kpis-panel.layout.test.tsx` |
| U-5 | Altura táctil de 44 px a <768 px | CA-8, CA-9 | `src/components/touch-targets.test.tsx` |
| U-6 | Cabecera móvil: ancho de «Buscar» y separación | CA-10 | `src/routes/_authenticated/route.header.test.tsx` |

Orden sugerido: U-1, U-2 (puras, sin riesgo), U-6, U-5, U-3, U-4. Las U-3 a U-6 piden medir en navegador antes y después y guardar la evidencia.

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- U-1: comparar con una función `sameText(a, b)` (minúsculas, `trim`, espacios colapsados).
- U-2: `normalizeLeadSource(raw): { key, label }` en `src/lib/lead-source.ts`; `funnelBy` no cambia de firma: se le pasa `l => normalizeLeadSource(l.source).key` y la etiqueta se resuelve al pintar. Revisar los otros puntos que agrupan por origen: `lead-funnel-panel.tsx` («Comparar por») y `src/lib/agent/tools/core-read.ts` **[Por verificar]**.
- U-3: `grid-cols-[repeat(auto-fit,minmax(8.5rem,1fr))]` (o contenedor con `@container`). El mínimo exacto se ajusta al ancho de «OPORTUNIDAD» con el `eyebrow` real, medido en navegador.
- U-4: añadir `min-w-40` a las celdas; en `PlanValue` (o en la celda) pasar `className="block"` a la marca; no se toca `DataState`. Alternativa descartada: acortar el motivo o sustituirlo por «—» (D-1).
- U-5: `TabsList` hoy mide `h-10` con `TabsTrigger` `h-8`; con `min-h-11` hay que subir la lista a `h-14` en móvil para que quepan. Es un componente compartido por muchas pantallas (D-3).
- U-6: sustituir `size-11` por `min-w-11 px-1 text-sm` en el botón «Buscar»; por debajo de 400 px la barra queda con `gap-1 px-3` y solo desde 400 px crece a `gap-3 px-4`; «Menú» pasa a `px-1 -mr-1`. Comprobar a 360 y 375 px que `scrollWidth` del documento no supera el ancho de la ventana.

## 14. Riesgos y dependencias
- `TabsTrigger` y `Button` son primitivas compartidas: un cambio móvil se nota en todas las pantallas con pestañas. Se mitiga con `md:min-h-0` y revisando capturas de Estrategia y Métricas.
- La guardia de CA-6 es de código fuente, no de pantalla: puede pasar con un solape distinto. Por eso CA-6 exige además evidencia en navegador.
- U-4 se limita a presentación. Si Fede elige reducir los textos (D-1, opción b), habría que modificar pruebas protegidas, lo que requiere su autorización expresa y otro SDD.
- Sin dependencias de otras unidades fuera de este SDD.

## 15. Preguntas para Fede y para la revisión técnica
**Decisiones de Fede, 2026-11-18: aprobadas las recomendaciones de D-1, D-2, D-3 y D-4.** D-1 (a): se mantiene «Sin dato · motivo». D-2 (a): origen unificado solo al agrupar. D-3: altura táctil en las primitivas compartidas a <768 px. D-4: SDD de Inicio como siguiente, aún no redactado.

**D-1 · Tabla trimestral: ¿mantienes «Sin dato · motivo» tal cual, o lo acortamos?**
(a) **Mantener** y arreglar solo la presentación (esta propuesta). (b) Acortar los motivos repetidos o poner el motivo una vez bajo la fila; exige modificar pruebas de NK-0106 y tu autorización expresa.
*Recomiendo (a):* la regla vigente es que el estado se diga con palabras; y el ancho de columna más la marca del plan en su línea ya quitan el amontonamiento sin tocar el contrato.

**D-2 · Origen guardado como «manual»/«Manual»: ¿corregimos también los datos?**
(a) Solo al agrupar (esta propuesta). (b) Además, unificar lo ya guardado y normalizar al escribir (toca datos de producción, con comprobación previa).
*Recomiendo (a) ahora:* resuelve lo que ves sin tocar producción; el (b) va aparte si quieres que la tarjeta del lead muestre un único valor.

**D-3 · Altura táctil: ¿en las primitivas compartidas o solo en estas pantallas?**
*Recomiendo compartidas a <768 px:* es un único cambio y evita que cada pantalla lo repita; el riesgo (pestañas más altas en todas) se revisa con capturas.

**D-4 · Lo que queda fuera: ¿abro un SDD para Inicio (una sola tarjeta de «siguiente paso»)?**
*Recomiendo sí y como siguiente:* es el hallazgo de más peso en la pantalla que más abres, y es independiente de este SDD.

Para la revisión técnica: ¿el contenedor de la tabla trimestral debe seguir con `overflow-x-auto` o conviene tarjetas por KPI en móvil? Esta propuesta no las introduce.

## 16. Pendiente de verificar
- **[Por verificar]** Mi medición viene de `localhost` con el backend compartido, solo lectura. Producción (`nokko.ai`) no se miró.
- **[Por verificar]** Otros sitios que agrupan por origen (`lead-funnel-panel.tsx`, `core-read.ts`).
- **[Por verificar]** Si pruebas existentes comprueban clases de `TabsTrigger`, `TabsList` o la cabecera móvil (U-5, U-6); quien implemente lo comprueba antes de editar.
- **[Por verificar]** Modo oscuro en móvil de Leads, Cuentas y Métricas (visto antes solo en Estrategia).
- **[Por verificar]** Safari en iPhone real; solo se emuló un viewport de 375 px.
- **[Por verificar]** Si la pestaña recomendada de Estrategia queda a la vista al entrar (fuera de alcance).

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
*Informe de un agente de contexto fresco (2026-11-18), copiado sin editar su contenido; sobre el commit `8c300442`, base `5c646d0a`. No es la ejecución de `scripts/factory/gate.mjs`: ver «Qué ejecutó».*

- **Veredicto del gate: Objeciones.** Las suites pasan y las pruebas nuevas fallan sobre la base, pero el arreglo de «Conversión por origen» en las pantallas no lo protege ninguna prueba, y hay un desajuste real entre CA-7d y el comportamiento del código.
- **CA sin prueba posible o sin G-n:**
  - CA-6: solo la guardia de código fuente (`layout-grids.test.ts`); el solape real no es automatizable en jsdom.
  - CA-7c: solo en navegador.
  - CA-10: clases leídas del código fuente; los 12 px y la ausencia de recorte son solo navegador.
  - CA-8: la altura real es solo navegador, y tres de sus seis pruebas leen el código fuente en vez de renderizar (secciones de Métricas, «Avisos», cabecera).
  - CA-4 (cableado): la parte pura sí tiene prueba; el cableado en `leads.index.tsx` y `lead-funnel-panel.tsx` no (hallazgo 1).
  - CA-5: la prueba solo demuestra que la función pura no muta; nada comprueba que la tarjeta del lead siga pintando `l.source` literal.
  - No hay G-n (sin PRD); no cuenta.
- **[Por verificar] que sigue sin comprobarse:**
  - Producción (`nokko.ai`): no mirada. Modo oscuro en móvil: no mirado. Safari en iPhone real: no probado. Pestaña recomendada de Estrategia: fuera de alcance.
  - Mediciones en navegador de la sección 18 (CA-6, CA-7b, CA-7c, CA-7d, CA-8, CA-10, «Manual con 2 leads»): **no las reprodujo**.
  - Efecto de `Button sm` y `TabsTrigger` más altos fuera de Leads, Cuentas y Métricas.
  - Cabecera móvil a menos de 375 px (hallazgo 6).
  - Resueltos por el gate: las clases de `TabsTrigger`, `TabsList` y cabecera en pruebas existentes (los 439 archivos pasan, ninguna prueba existente modificada); y los otros sitios que agrupan por origen (solo hay dos `funnelBy` con origen, ambos cambiados; `core-read.ts` solo usa `funnelBySegment`).
- **Contradicciones con el código o con decisiones previas:**
  - SDD §6 («el trimestre actual aparece primero») frente a `src/components/scroll-fade.tsx:15-18`: el código lo centra y, como `quartersUpTo(quarter, 4)` (`quarter-kpis-panel.tsx:54`) pone el trimestre actual como última columna, la tabla queda desplazada al final y los trimestres anteriores quedan fuera de vista por la izquierda.
  - SDD §5 (lista cerrada de componentes compartidos) frente a `src/components/ui/button.tsx:27`: `Button size="sm"` pasa a `h-11` en móvil y no figura en esa lista, aunque sí en §13 y en D-3.
  - SDD CA-8 (`min-h-11 md:min-h-0`) frente a `ui/tabs.tsx` y `button.tsx`, que usan `h-11` más `md:h-8` o `md:h-7`: desvío de método no recogido en §18.
  - SDD §13 U-4 (`min-w-40`) frente a `min-w-44`: recogido en §18.
  - NK-0106 («no «—»»), contrato de `DataState`, `AGENTS.md` y `src/lib/AGENTS.md`: sin contradicción.
- **Hallazgos:**
  1. **Importante.** El cableado de CA-4 no tiene prueba. Con `leads.index.tsx:118` y `lead-funnel-panel.tsx:35` devueltos a `l.source || "Sin origen"` en un worktree temporal, pasaron 7 archivos y 63 pruebas; la prueba de CA-4 llama ella misma a `funnelBy(leads, [], sourceLabeler(leads))`. Cambiaría: una prueba de render de `LeadFunnelPanel` con «manual» y «Manual» que espere una fila; para `leads.index`, una guardia de código fuente como `layout-grids`.
  2. **Importante.** CA-7d no cubre el caso real. `scroll-fade.tsx:14` solo calcula «hay más a la derecha»; con el trimestre actual como última columna, tras centrar `more` es falso y no hay degradado, y el contenido oculto queda a la izquierda sin indicador. La prueba simula `scrollLeft` fijo en 0. Cambiaría: degradado también a la izquierda, como `TabsList` (`ui/tabs.tsx:40-45`), y una prueba con `scrollLeft` > 0; o aclarar en el SDD que el borde izquierdo no se señala.
  3. **Importante.** `Button size="sm"` cambia en las 199 apariciones de la app a `h-11` en móvil (`button.tsx:27`). Solo se midieron Leads, Cuentas y Métricas. Cambiaría: revisar capturas de las pantallas con más botones pequeños, o limitar el cambio a un tamaño nuevo aplicado en el alcance. Se decide con Fede (D-3 aprobó «primitivas compartidas»).
  4. **Importante.** `FlowStrip` crece en todas las pantallas con flujo. `flow-strip.tsx:13` pone `min-h-11` en cada `li` (también en el paso actual, que no es enlace) y el enlace «Después:» pasa a `inline-flex min-h-11` dentro de un `<p>` (línea 36); con `FlowStrip` en `page.tsx:22`, cada fila que se parte en móvil pasa de ~16 a 44 px. No hay medición del alto total. Cambiaría: `min-h-11` solo en el enlace, no en el `li`, y comprobar visualmente el «Después».
  5. **Menor.** Casos límite de §8 sin prueba: trimestre actual ausente, desmontaje (listeners y `ResizeObserver`), `sourceLabeler` con muchos orígenes, lead fuera de la cohorte; sin `ResizeObserver` solo cubierto de rebote.
  6. **Menor.** Cabecera móvil por debajo de 375 px: `route.tsx:197` quita `gap-1` por debajo de 400 px (ahora `gap-3`) y «Buscar» suma `px-2`: unos 32 px más de ancho en una barra donde NK-0179 ya tuvo un desbordamiento lateral. Cambiaría: medir a 320 y 360 px.
  7. **Menor.** `normalizeLeadSource` no unifica Unicode compuesto y descompuesto («Reunión» y «Reunión» dan claves distintas). Cambiaría: `.normalize("NFC")` y una prueba.
  8. **Menor.** `ScrollFade` centra al montar siempre que haya desborde, aunque el SDD dice «en pantalla estrecha»; duplica la lógica de `TabsList` y el `ResizeObserver` observa el contenedor, no la tabla.
  9. **Menor.** §17 seguía en «No revisado» y §18 decía «sin commit ni push» cuando ya existía el commit `8c300442`. Hay un archivo sin seguimiento ajeno a este cambio (`docs/prd/PRD-20261118-coherencia-y-continuidad.md`).
- **Qué ejecutó:**
  - `npx vitest run` con los 6 archivos nuevos y 3 suites de marcas: 9 archivos, 50 pruebas, en verde. Suite completa: **439 archivos, 6.392 pruebas, en verde** (87 s). `npx tsc --noEmit -p .`: salida 0. `npx eslint` sobre lo tocado: 0 errores y 1 aviso previo (`ui/button.tsx:54`).
  - Pruebas nuevas contra la base (`5c646d0a`, worktree temporal ya eliminado): 21 pruebas en 6 archivos, **18 fallan y 3 pasan**. Las 3 que pasan son de comportamiento ya existente (CA-2, «línea con otro nombre muestra ambos» y «las palabras de las marcas no cambian»). `lead-source.test.ts` falla por import no resuelto, lo que no prueba su lógica sobre la base; el resto falla por aserción (`expected 2 to be 1`, `expected [...] to include 'block'` o `'min-w-44'`).
  - Mutación (hallazgo 1): 63 pruebas en verde con el cableado revertido.
  - Diff: los 6 archivos de prueba son nuevos, ninguna existente modificada; sin `as any`, `.only/.skip`, `window.confirm/prompt`, `console.log`, URLs, correos ni secretos; datos ficticios.
  - `node scripts/factory/gate.mjs`: **NOT RUN** (no hay ticket NK para este SDD, no se inventó, y el árbol no estaba limpio por el PRD sin seguimiento). Segunda máquina y soak de recursos: **NOT RUN**. `git status` igual que al empezar; HEAD `8c3004429262f1101f949ef41d8849aca0968836`.
- **Lo que esta revisión NO demuestra:**
  - Nada visual ni geométrico: solape de CA-6, líneas por celda de CA-7c, 44 px reales de CA-8, separación de CA-10, modo oscuro, Safari, 320 px. No abrió navegador y no reprodujo las mediciones de la sección 18.
  - Que `Button sm`, `TabsTrigger`, `TabsList` o `FlowStrip` más altos no rompan otras pantallas.
  - Comportamiento con datos reales o con producción.
  - Que el protocolo de flakes esté limpio (no ejecutó `flake.mjs`).
  - Que el SDD esté libre de objeciones: eso lo decide Fede.

## 18. Delta de implementación (lo rellena el agente al entregar)
**2026-11-18 · Estado: En curso (implementado y medido; sin revisión del gate ni aprobación de entrega).** Rama local `sdd/ux-legibilidad-20261118`, desde `origin/main`; un commit local (`8c300442`, 22:49), sin push. Corregido a las 22:57: esta línea decía «sin commit ni push».

**Qué difiere de lo escrito**
- **Nombre de prueba (U-6):** `src/routes/_authenticated/-route-header.test.ts`, no `route.header.test.tsx`. El prefijo `-` evita que el router lo tome por una ruta.
- **Ubicación de `planIsMark` (U-4):** en `src/components/metrics/mark-text.ts`, no en `figure.tsx` (regla `react-refresh/only-export-components`). Nuevo componente `src/components/scroll-fade.tsx`.
- **Anchos mínimos medidos, no estimados (U-3, U-4):** KPI de Leads `minmax(9.5rem,1fr)` y embudo `minmax(7.5rem,1fr)` (con 10,5 y 8,5 rem los KPI quedaban en una sola columna en móvil); columnas de la tabla trimestral `min-w-44` (con `min-w-36` una marca llegaba a 4 líneas a 375 px).
- **Ampliación de CA-8:** los enlaces de sección de Métricas (`<nav aria-label="Secciones de Métricas">`, `metrics.tsx`) no son `TabsTrigger` y medían 32 px; ahora `min-h-11 md:min-h-0`. Prueba añadida en `touch-targets.test.tsx`.
- **Aviso de ESLint:** `button.tsx` conserva el aviso `react-refresh/only-export-components` que ya tenía (exporta `buttonVariants`). 0 errores.

**Verificación**
- Pruebas: 439 archivos, 6.392 pruebas en verde; `tsc` limpio. Ninguna prueba existente modificada.
- Cada prueba nueva se vio fallar antes del cambio (la de U-2, por no existir aún el módulo).

**Mediciones en navegador** (`localhost`, backend compartido, solo lectura, 2026-11-18)
| CA | Medida | Resultado |
|---|---|---|
| CA-6 | Bloques que se superponen o con etiqueta recortada, embudo y KPI de Leads, a viewport 375, 768, 900, 1106 y 1400 px (contenido 375, 528, 660, 866 y 1160 px) | 0 en los cinco anchos. A 375 px: KPI en 2 columnas y embudo en 2 |
| CA-6 | Contenido de 320 px | **No medido** (el panel no baja de 375 px) |
| CA-7c | Líneas de la marca más larga a 375 px | 4 → 2; ancho mínimo de celda 176 px |
| CA-7b | Marca del plan en bloque propio, escritorio | Sí, 28 marcas, todas con la del plan en su línea |
| CA-7d | Trimestre actual a la vista al cargar a 375 px | Sí (`scrollLeft` 486 de 786); sin degradado porque ya está al final |
| CA-10 | «Buscar», «Avisos», «Menú» | **Sustituido, ver «Correcciones tras el gate».** La primera medición (44 px de alto, 12 px de separación) se hizo con la página ya desbordada: el documento medía 406 px a 375 px |
| CA-8 | Enlaces de `FlowStrip`, «Editar líneas», «Avisos», «Buscar» y secciones de Métricas a 375 px | 44 px (antes 16–32) |
| CA-8 | Elementos interactivos bajo 44 px en `main`, cabecera y navegación a 375 px | Métricas 30 → 16, Leads 15 → 8 (no es la misma consulta que en el pase inicial: ahora se acota a `main`, cabecera y navegación) |
| CA-5 / CA-4 | «Conversión por origen» con datos reales | Una fila «Manual» con 2 leads |

**Lo que sigue bajo 44 px y no estaba en el alcance:** botones de tamaño normal (40 px) como «+ Nuevo lead» y «+ Nueva cuenta»; «Inicio» de la barra inferior (41 px); el selector de trimestre (40 px); enlaces en línea de texto («CAC real», «Define cuotas», 16 px); los «ACCIONES» y las casillas de las tarjetas de Cuentas y Leads (16 px); los interruptores (20 px).

**Sin comprobar:** modo oscuro en móvil tras los cambios; Safari en iPhone real; el efecto de `Button sm` y `TabsTrigger` más altos en pantallas distintas de Leads, Cuentas y Métricas (por ejemplo, el popover de «Avisos» usa `TabsTrigger`).

**Correcciones tras el gate (2026-11-18, mismo día)**
Hecho a petición de Fede («Sí, corrige»): hallazgos 1, 2, 4 y 7 del gate, y medir a 320 y 360 px (hallazgo 6).
- **Hallazgo 1 (cableado de CA-4):** nueva función `funnelBySource` en `src/lib/lead-source.ts`, usada por `leads.index.tsx` y `lead-funnel-panel.tsx`. Pruebas: `lead-source.test.ts` (función, muchos orígenes, cohorte vacía) y `src/lib/lead-source-wiring.test.ts` (guardia de código fuente: ambas pantallas la usan y ninguna agrupa por `l.source` literal). Las pruebas de cableado fallaban antes del cambio.
- **Hallazgo 7:** `normalizeLeadSource` aplica `.normalize("NFC")`; «Reunio\u0301n» y «Reunión» son el mismo origen. El espacio de no separación ya se plegaba y ahora tiene prueba.
- **Hallazgo 2 (CA-7d):** `ScrollFade` pone `data-start="true"` cuando hay contenido oculto a la izquierda y las celdas fijas de la primera columna dibujan un borde de sombra (`[[data-start=true]_&]:…`). No se usa degradado a la izquierda porque también desvanecería la columna fija. Prueba nueva en `quarter-kpis-panel.layout.test.tsx` con `scrollLeft` distinto de 0. La simulación de `scrollLeft` de esas pruebas ahora conserva el valor asignado.
- **Hallazgo 4 (`FlowStrip`):** el `li` ya no lleva `min-h-11`; los enlaces de las migas lo conservan. El enlace «Después:» llega a 44 px con un área táctil invisible (`before:absolute before:-inset-y-3`, solo en móvil) en lugar de crecer la línea. Las pruebas de `touch-targets.test.tsx` se reescribieron para exigir ese mecanismo; a 320 px el bloque mide 80 px y los enlaces de las migas 44 px (el área invisible de «Después» no se ve en el rectángulo del enlace, por eso mide 16 px).
- **Hallazgo 6 (regresión mía, ahora corregida):** con `gap-3` fijo, la cabecera medía 406 px a 360 y 375 px (`scrollWidth` 406 frente a 375): «Menú» quedaba ~39 px fuera de la pantalla y el navegador móvil ensanchaba la página. Mi medición anterior leyó «vw 406» sin verlo. Ahora: `gap-1 px-3` por debajo de 400 px, «Buscar» con `px-1 text-sm` y «Menú» con `px-1`. Medido: 375 px → documento 375, «Menú» termina en 367; 360 px → documento 360, termina en 352. `-route-header.test.ts` se reescribió para exigir esos valores (revisión de una prueba mía, no de una existente).
- **320 px:** la cabecera **sigue desbordando**: documento 359 px en una ventana de 320 (~39 px). El logo ocupa 147 px y las tres acciones ~197 px; no cabe sin quitar texto o el logo. No se midió sobre la base, así que no afirmo cuánto empeoró o mejoró; queda como pendiente fuera de este SDD.
- **Embudo y KPI de Leads a 320 px:** 1 columna cada uno, 0 solapes y 0 etiquetas recortadas.
- **Aún sin medir:** modo oscuro en móvil, Safari real y el efecto de `Button sm`/`TabsTrigger` fuera de las tres pantallas (hallazgo 3 del gate, decisión de Fede).
- **Verificación:** 440 archivos, 6.404 pruebas en verde; `tsc` limpio; ESLint sin errores; las pruebas nuevas se vieron fallar antes del código (10 fallos, más 2 en la cabecera).
