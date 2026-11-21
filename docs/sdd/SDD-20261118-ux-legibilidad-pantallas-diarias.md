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
**Incluye:** U-1 a U-6 de la sección 12, solo en las rutas `/leads`, `/accounts` y `/metrics` y en los componentes compartidos que ellas usan (`PrimaryLineNote`, `FlowStrip`, `Button` tamaño `sm`, `TabsList` y `TabsTrigger`, `NotificationCenter`, cabecera móvil). *(Corregido tras el gate: `Button sm` y `TabsList` ya estaban en §13 y D-3 pero no en esta lista.)*

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
- Tabla trimestral: columnas con ancho mínimo; en cada celda, «plan» y su marca en líneas separadas; en pantalla estrecha (menos de 768 px), la tabla se desplaza al cargar para centrar el trimestre actual, que es la última columna, y señala con un borde por la derecha o por la izquierda que hay más contenido. En pantallas más anchas no se desplaza. *(Texto original: «el trimestre actual aparece primero».)*
- En pantalla estrecha, altura táctil mínima de 44 px en los elementos de CA-8.
- Cabecera móvil: «Buscar» con ancho propio; por debajo de 400 px la barra queda más ajustada (`gap-1 px-2.5`). Por debajo de `sm`, la etiqueta de «Avisos» limita el número a «9+» («Avisos · 14» pasa a «Avisos · 9+»); desde `sm` y en el `aria-label` se conserva el número real. *(Cambio añadido durante la implementación, no estaba en la versión aprobada del SDD: Fede aceptó corregir la cabecera a 360 px el 2026-11-18 y el detalle del tope se le comunicó después.)*
**Eliminado:** nada.

## 7. Historias y criterios de aceptación
### H-1: Como Fede, quiero leer la línea principal sin repeticiones para entenderla de un vistazo.
- **CA-1** Si `label` y `result.name` coinciden (sin distinguir mayúsculas ni espacios), el texto contiene el nombre una sola vez y mantiene «arquetipo X». Si difieren, se muestran ambos como hoy. · prueba: `src/components/primary-line-note.test.tsx`
- **CA-2** Sin línea principal, el aviso y el enlace «Defínela» no cambian. · prueba: `src/components/primary-line-note.test.tsx`

### H-2: Como Fede, quiero que cada origen cuente una sola vez para que la conversión por origen no se parta.
- **CA-3** `normalizeLeadSource` iguala «manual», «Manual» y « manual » en una clave; vacío o nulo da «Sin origen». · prueba: `src/lib/lead-source.test.ts`
- **CA-4** «Conversión por origen» muestra una fila por clave con la suma de leads y de resultados; la etiqueta es la forma más frecuente y, en empate, la primera en orden de código (una mayúscula va antes que su minúscula: «Manual» gana a «manual»). «Sin origen» conserva siempre su etiqueta. · prueba: `src/lib/lead-source.test.ts`
- **CA-5** Los datos guardados no cambian: la tarjeta del lead sigue mostrando el origen tal como se guardó. · prueba: `src/lib/lead-source.test.ts` (la función es pura y no escribe)

### H-3: Como Fede, quiero que el embudo y los KPI de Leads no se pisen a ningún ancho.
- **CA-6** Ningún bloque del embudo ni de los KPI de Leads se superpone con otro a anchos de contenido de 320, 500, 640, 900 y 1100 px, en claro y oscuro. · prueba: evidencia en navegador (no automatizable en jsdom) + guardia `src/lib/layout-grids.test.ts`, que falla mientras `leads.index.tsx` use `md:grid-cols-4` o `md:grid-cols-6` en esos bloques

### H-4: Como Fede, quiero leer la tabla trimestral sin que se amontonen las marcas.
- **CA-7** Los textos de las marcas no cambian: las pruebas existentes de `quarter-kpis-panel.test.tsx`, `data-state.test.tsx` y `metrics/finance-panel.test.tsx` siguen en verde **sin modificarse**. · prueba: las suites existentes
- **CA-7b** En cada celda con plan, la palabra «plan» y su marca van en líneas distintas (la marca con `block`); «sin plan» se queda en línea. · prueba: `src/components/quarter-kpis-panel.layout.test.tsx`
- **CA-7c** Las celdas tienen ancho mínimo propio y ninguna marca ocupa más de 3 líneas a 375 px. · prueba: evidencia en navegador
- **CA-7d** En pantalla estrecha (menos de 768 px) el contenedor señala que hay más contenido (desvanecido en el borde derecho; a la izquierda, una sombra en las celdas de la primera columna, que es fija) y, al montar, la columna del trimestre actual queda a la vista. Solo se centra al montar: si cambia el trimestre sin volver a montar la tabla, no se recentra. · prueba: `src/components/quarter-kpis-panel.layout.test.tsx` (con `scrollIntoView` simulado)

### H-5: Como Fede, quiero pulsar con el pulgar sin fallar.
- **CA-8** A menos de 768 px, estos elementos miden al menos 44 px de alto: enlaces de `FlowStrip`, el disparador «Avisos», las pestañas (`TabsTrigger`), «Tablero/Listado» de Leads y «Editar líneas». Se usa `min-h-11 md:min-h-0` en los enlaces y el disparador de «Avisos», como ya hacen `move-menu.tsx` y `quick-actions.tsx`; las primitivas `Button sm`, `TabsList` y `TabsTrigger` usan `h-11`/`h-[3.25rem]` más su altura de escritorio (`md:h-7`, `md:h-10`, `md:h-8`). El enlace «Después:» de `FlowStrip`, que va dentro de una frase, llega a 44 px con un área táctil invisible (`before:-inset-y-4`, 47,5 px medidos) en vez de agrandar la línea. · prueba: `src/components/touch-targets.test.tsx` (clases) + medición en navegador a 375 px
- **CA-9** En escritorio (≥768 px) los tamaños actuales no cambian. · prueba: `src/components/touch-targets.test.tsx`

### H-6: Como Fede, quiero una cabecera móvil que no se apriete.
- **CA-10** «Buscar» no se sale de su caja (`min-w-11 px-1 text-sm` en vez de `size-11`), la página no es más ancha que la pantalla a 360 y 375 px (`scrollWidth` igual al ancho de la ventana) y entre los textos de «Buscar», «Avisos» y «Menú» hay al menos 8 px; ninguno queda truncado. *(Redactado de nuevo tras la medición del 2026-11-18: la versión original, «12 px a 375 px», hacía la cabecera más ancha que la pantalla; ver sección 18.)* · prueba: `src/routes/_authenticated/-route-header.test.ts` (clases) + medición en navegador a 375 px

## 8. Casos límite y errores
- Origen con espacios, mayúsculas mixtas o solo espacios: una clave; solo espacios cuenta como «Sin origen» (CA-3).
- Orígenes con la misma letra pero acento distinto («Reunión»/«Reunion»): **no** se unen; solo se normalizan mayúsculas y espacios.
- Línea sin arquetipo o con `extra` > 0: el sufijo «N líneas más» se conserva (CA-1).
- Trimestre actual fuera de los visibles: la tabla muestra el primero y no falla (CA-7d).
- Datos vacíos o una sola empresa: sin cambio. Varias empresas: sin cambio, nada se lee ni escribe nuevo.
- Pantalla de 320 px: es el ancho mínimo de la prueba de CA-6. La cabecera móvil sigue desbordando a ese ancho (el logo y las tres acciones suman más de 320 px); queda fuera de este SDD.
- `ScrollFade` sin `matchMedia` o con uno que lanza una excepción: se comporta como en pantalla estrecha y no rompe la tabla. Sin trimestre actual (`data-current`) y con desborde: no desplaza nada.

## 9. Experiencia y copy
No hay textos nuevos. Se conservan «Sin dato · …», «sin plan», «Buscar» y «Avisos», con una excepción: por debajo de `sm` el número de «Avisos» se muestra como «9+» a partir de 10 (sección 6). No se añaden iconos (regla de la plantilla); la cabecera móvil se arregla con ancho y separación, no con un icono.

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
| U-6 | Cabecera móvil: ancho de «Buscar» y separación | CA-10 | `src/routes/_authenticated/-route-header.test.ts` |

Orden sugerido: U-1, U-2 (puras, sin riesgo), U-6, U-5, U-3, U-4. Las U-3 a U-6 piden medir en navegador antes y después y guardar la evidencia.

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- U-1: comparar con una función `sameText(a, b)` (minúsculas, `trim`, espacios colapsados).
- U-2: `normalizeLeadSource(raw): { key, label }` en `src/lib/lead-source.ts`; `funnelBy` no cambia de firma: se le pasa `l => normalizeLeadSource(l.source).key` y la etiqueta se resuelve al pintar. Revisar los otros puntos que agrupan por origen: `lead-funnel-panel.tsx` («Comparar por») y `src/lib/agent/tools/core-read.ts` **[Por verificar]**.
- U-3: `grid-cols-[repeat(auto-fit,minmax(8.5rem,1fr))]` (o contenedor con `@container`). El mínimo exacto se ajusta al ancho de «OPORTUNIDAD» con el `eyebrow` real, medido en navegador.
- U-4: añadir `min-w-44` a las celdas (el texto original decía `min-w-40`; se midió y quedó en 44); en `PlanValue` (o en la celda) pasar `className="block"` a la marca; no se toca `DataState`. Alternativa descartada: acortar el motivo o sustituirlo por «—» (D-1).
- U-5: `TabsList` hoy mide `h-10` con `TabsTrigger` `h-8`; en móvil `TabsTrigger` pasa a `h-11` (con `md:h-8`) y la lista a `h-[3.25rem]` (con `md:h-10`) para que quepan; es el desvío de método respecto a `min-h-11 md:min-h-0` que usan los enlaces. Es un componente compartido por muchas pantallas (D-3).
- U-6: sustituir `size-11` por `min-w-11 px-1 text-sm` en el botón «Buscar»; por debajo de 400 px la barra queda con `gap-1 px-2.5` y solo desde 400 px crece a `gap-3 px-4`; «Menú» pasa a `px-1 -mr-2`; por debajo de `sm` la etiqueta de «Avisos» limita el número a «9+» (`noticeLabels`), y el `aria-label` conserva la cuenta real. Comprobar a 360 y 375 px que `scrollWidth` del documento no supera el ancho de la ventana.

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

### Segunda revisión independiente (2026-11-18), sobre el commit `f6ce7fb7`

*Informe de un agente de contexto fresco, copiado sin editar su contenido (solo se bajó un nivel de los encabezados para no romper la numeración de las secciones del SDD). A diferencia de la revisión anterior, este agente sí ejecutó `scripts/factory/gate.mjs` en un worktree limpio sobre el commit exacto; no hay ticket NK, así que la evidencia lleva la etiqueta `SDD-20261118-legibilidad`. Las rutas de evidencia son del directorio temporal de la sesión: no persisten en el repo.*


- **Veredicto del gate:** Objeciones, sobre el commit `f6ce7fb7`. El núcleo fijo pasa (PASS en los 18 checks), pero hay tres cosas: el enlace «Después» se queda en 39,5 px y no llega a los 44 px que pide CA-8; la cabecera a 360 px solo cabe según cuántos avisos haya sin leer (CA-10); y hay huecos de prueba que las mutaciones confirman (desmontaje y `ResizeObserver` de `ScrollFade`, `md:min-h-0` de CA-9, guardia de cableado de CA-4 que se puede esquivar).

#### Checks del núcleo fijo
`node scripts/factory/gate.mjs --ticket SDD-20261118-legibilidad --base 5c646d0a… --root <scratchpad>/gate2/gate-wt`. Lo ejecuté en un worktree desechable, con el árbol limpio y sobre el commit exacto `f6ce7fb7f6ff2412b179d91356abba495b3806a6`. Veredicto que escribe el script: **PASS** (exit 0).

| Check | Resultado |
|---|---|
| clean tree on exact commit | PASS (f6ce7fb7f6ff…) |
| canary: runner detects failure | PASS |
| guard: no `as any` | PASS |
| guard: no window.confirm/prompt | PASS |
| guard: no committed secrets | PASS |
| guard: no secret in VITE_ vars | PASS |
| guard: no .only/.skip in tests | PASS |
| guard: no raw error.message toasts | PASS |
| guard: .env untouched | PASS |
| guard: assertions not weakened | PASS |
| guard: no longer timeouts in tests | PASS |
| typecheck | PASS |
| lint (touched files, 21) | PASS (0 errores; 1 aviso previo en `ui/button.tsx:54`, `react-refresh/only-export-components`) |
| release build (red exterior bloqueada en mejor esfuerzo) | PASS |
| full unit suite | PASS: **440 archivos, 6404/6404 pruebas**; fallos conocidos 0; inesperados 0; archivos sin aserción 0 |
| touched test files, whole (7) | PASS: 7 archivos, 42 pruebas |
| second-machine full run | NOT RUN (el script da PASS pero dice «NOT RUN: no second runner configured») |
| artifact size recorded | «NOT A SOAK»: no mide recursos |

#### CA → prueba
Las 7 pruebas nuevas, copiadas a un worktree de la base `5c646d0a`: 26 pruebas fallan, 3 pasan y `lead-source.test.ts` no llega a ejecutarse (import sin resolver).

| CA | Prueba | ¿Falla sobre la base? | ¿Débil o frágil? |
|---|---|---|---|
| CA-1 | `primary-line-note.test.tsx` (render) | Sí: 3 de 4 fallan (`expected 2 to be 1`); la de «nombres distintos, ambos» pasa: es de no regresión | Sólida. La mutación M27 la tumba |
| CA-2 | `primary-line-note.test.tsx` | No (pasa en la base, como debe: el comportamiento no cambia) | Solo no regresión |
| CA-3 | `lead-source.test.ts` | Falla por import no resuelto, no por aserción | Lógica sólida (M28 la tumba), pero sobre la base no demuestra nada de la lógica |
| CA-4 (pura) | `lead-source.test.ts` | Igual que CA-3 | Sólida |
| CA-4 (cableado) | `lead-source-wiring.test.ts` (guardia de código fuente con regex) | Sí: 4 de 4 | **Frágil:** la mutación M1b agrupa por `x.source ?? "Sin origen"` sin pasar por `normalizeLeadSource` y la guardia sigue en verde |
| CA-5 | `lead-source.test.ts` «stored data is not changed» | Sin dato (el archivo no se ejecuta sobre la base) | **Débil:** solo prueba que no se muta la entrada; nada comprueba que la tarjeta del lead siga pintando `l.source` tal cual |
| CA-6 | `layout-grids.test.ts` (código fuente) + navegador | Sí: 2 de 2 | Solo guardia de clases. La geometría la medí en navegador (ver tabla) |
| CA-7 | Suites existentes (`quarter-kpis-panel.test.tsx`, `data-state.test.tsx`, `metrics/finance-panel.test.tsx`) | — (eran verdes y siguen verdes) | Ninguna prueba existente se modificó ni se borró: el diff de pruebas son 7 archivos nuevos (status A) |
| CA-7b | `quarter-kpis-panel.layout.test.tsx` (render, clase `block`) | Sí | Sólida: M6 y M7 la tumban. En navegador, «plan» y su marca comparten línea en 0 de 4 celdas |
| CA-7c | El mismo archivo (clase `min-w-44`) + navegador | Sí | Decorativa respecto a la geometría (solo mira la clase); la geometría se midió aparte |
| CA-7d | El mismo archivo (geometría simulada en jsdom) | Sí (4 de 4) | Correcta para el montaje. No cubre el desmontaje ni el `ResizeObserver` (M11 y M12 sobreviven) ni el contenido que crece después de montar (en navegador, el borde se queda sin máscara) |
| CA-8 | `touch-targets.test.tsx` (clases) + navegador | Sí (7 de 7) | Tres pruebas cortan el código fuente entre marcadores (Avisos y secciones de Métricas). La del «Después» exige `before:-inset-y-3`, que en navegador da **39,5 px**, no 44 |
| CA-9 | `touch-targets.test.tsx`, bloque CA-9 | Sí, pero por un motivo equivocado: la base no tenía las clases `md:h-8`/`md:h-10` y sus tamaños de escritorio eran los mismos | **Débil:** no cubre `md:min-h-0` de las migas ni de «Editar líneas», ni `md:before:hidden` (M17, M19 y M23 sobreviven) |
| CA-10 | `-route-header.test.ts` (corte del código fuente por desplazamientos fijos: −200/+300/+120 caracteres) + navegador | Sí (2 de 2) | **Frágil** por esos desplazamientos fijos; no cubre las clases de «Menú» (M26 sobrevive) |

#### Mutaciones
Cada mutación revierte una línea en el worktree desechable y ejecuta las 7 pruebas nuevas más las 3 suites de marcas.

| Línea revertida | Prueba que falla |
|---|---|
| M1 `leads.index.tsx`: `funnelBySource` → `funnelBy(…, l => l.source \|\| "Sin origen")` | `lead-source-wiring` (2) |
| M1b `leads.index.tsx`: se mantiene la llamada `funnelBySource(` pero se agrupa con `x.source ?? "Sin origen"` | **ninguna** |
| M2 `lead-funnel-panel.tsx`: vuelve a agrupar por el origen literal | `lead-source-wiring` (2) |
| M3 rejilla de KPI → `md:grid-cols-4` | `layout-grids` (2) |
| M4 rejilla del embudo → `md:grid-cols-6` | `layout-grids` (2) |
| M5 celda sin `min-w-44` | `layout.test` CA-7c |
| M6 «plan» sin `block` | `layout.test` CA-7b |
| M7 la marca del plan sin `block` | `layout.test` CA-7b |
| M8 `ScrollFade` → `div overflow-x-auto` (repetida con las etiquetas equilibradas) | `layout.test` CA-7d (4) |
| M9 `ScrollFade` sin centrado | `layout.test` CA-7d (2) |
| M10 `data-start` siempre falso | `layout.test` CA-7d «hidden to the left» |
| M11 `ScrollFade` sin limpieza (`removeEventListener` y `disconnect`) | **ninguna** |
| M12 `ScrollFade` sin `ro.observe` | **ninguna** |
| M13 `Button sm` `h-11` → `h-9` | `touch-targets` |
| M14 `TabsTrigger` `h-11` → `h-8` | `touch-targets` |
| M15 `TabsList` `h-[3.25rem]` → `h-10` | `touch-targets` |
| M16 migas sin `min-h-11` | `touch-targets` |
| M17 migas sin `md:min-h-0` (crecen en escritorio) | **ninguna** |
| M18 «Después» sin área táctil | `touch-targets` |
| M19 «Después» sin `md:before:hidden` | **ninguna** |
| M20 «Avisos» sin `min-h-11` | `touch-targets` |
| M21 secciones de Métricas sin `min-h-11` | `touch-targets` |
| M22 «Editar líneas» sin `min-h-11` | `touch-targets` |
| M23 «Editar líneas» sin `md:min-h-0` | **ninguna** |
| M24 «Buscar» vuelve a `size-11` | `-route-header` |
| M25 fila de la cabecera vuelve a `px-4` | `-route-header` |
| M26 «Menú» vuelve a `-mr-2 px-2` | **ninguna** |
| M27 `PrimaryLineNote` repite siempre el nombre | `primary-line-note` (3) |
| M28 `normalizeLeadSource` sin `.normalize("NFC")` | `lead-source` (NFC) |
| M29 `TabsTrigger` con `md:h-11` | `touch-targets` CA-9 |
| M30 `Button sm` con `md:h-11` | `touch-targets` CA-9 |

#### CA sin prueba posible o sin G-n
- CA-6, CA-7c y la parte geométrica de CA-7d, CA-8 y CA-10: jsdom no puede medirlas; solo las cubre la evidencia de navegador.
- CA-5 (parte de pantalla): ninguna prueba renderiza la tarjeta del lead.
- No hay G-n (no hay PRD).

#### [Por verificar] que sigue sin comprobarse
- Producción (`nokko.ai`): NOT RUN.
- Safari en un iPhone real: NOT RUN (solo emulación de Chromium).
- Popover de «Avisos» (usa `TabsTrigger`): NOT RUN, para no arriesgar que se marquen avisos como leídos.
- Pestaña recomendada de Estrategia: fuera de alcance, NOT RUN.
- Geometría de la base (antes) en navegador: NOT RUN, porque no había servidor de la base con sesión. El «antes» de `FlowStrip` lo calculé como contrafactual en mi pestaña.
- Resueltos aquí:
  - Modo oscuro en móvil de Leads, Cuentas y Métricas: medido.
  - Clases de `TabsTrigger`, `TabsList` y la cabecera en pruebas existentes: ninguna prueba existente cambió y la suite pasa.
  - Otros sitios que agrupan por origen: hay 2 en la UI y los dos usan `funnelBySource`.

#### Contradicciones con el código, con el SDD o con decisiones previas
1. **§18** dice que «el enlace «Después:» llega a 44 px con un área táctil invisible». Medido: 39,5 px. `before:-inset-y-3` suma 2 × 12 px a una línea de 15,5 px. Contradice CA-8.
2. **§6** dice que «el trimestre actual aparece primero». El código lo centra y la columna sigue siendo la última. Además centra también en escritorio: a 1106 px, `scrollLeft` vale 42,5 y queda tapado el inicio del primer trimestre. §18 no corrige el texto de §6.
3. **§13 U-5** dice `TabsList` `h-14` en móvil; se implementó `h-[3.25rem]` (52 px). **CA-8** pide `min-h-11 md:min-h-0`; `Button` y `Tabs` usan `h-11 md:h-7` y `h-11 md:h-8`. Ninguno de los dos desvíos está declarado en §18.
4. **§5** («componentes compartidos que ellas usan») no nombra `Button` ni `TabsList`. `Button size="sm"` aparece 199 veces en 71 archivos y `TabsTrigger` en 12 archivos fuera de `ui/`. D-3 lo aprueba, pero §5 no se actualizó.
5. **CA-3** («vacío o nulo da «Sin origen»») frente al etiquetado: con orígenes [«sin origen», «sin origen», null], la única fila muestra «sin origen» en minúscula. Los leads sin origen se pintan con la grafía del dato, no con «Sin origen».
6. NK-0106 (prohibido «—»), regla «sin iconos», `DataState` y textos en español con «tú»: **sin contradicción**. Ninguna marca cambió de texto; cada `[data-mark]` es un nodo de texto único; no aparece un «—» desnudo (prueba añadida). No hay iconos ni textos nuevos.

#### Hallazgos (por gravedad)
1. **Importante · `src/components/flow-strip.tsx:38`.** El área táctil del enlace «Después:» mide 39,5 px a 320, 360 y 375 px, en claro y oscuro, en /leads y /accounts (sondeo con `elementFromPoint` sobre el centro del enlace). CA-8 exige ≥ 44 px. Entrada: cualquier página con `pos.next` a < 768 px. Salida: 15,5 + 12 + 12 = 39,5 px. La prueba exige justo la clase que lo produce. No le roba toques a las migas (0 puntos de 385).
2. **Importante · `src/routes/_authenticated/route.tsx:197-224` con `notification-center.tsx:153-157`.** A 360 px la cabecera cabe por ~1 px, y depende del número de avisos sin leer. Simulé el texto en mi pestaña: «Avisos · 99» da documento de 363 px, «Avisos · 100» da 369 y «Avisos · 999» da 372 (pantalla de 360). Con el recuento actual da 360 y con «Avisos · 9» también. Una carga en frío a 360 midió una vez 363/360 de forma transitoria. CA-10 («`scrollWidth` igual al ancho a 360») queda condicionado a los datos. A 375 px caben hasta 3 dígitos. A 320 px desborda 39 px; el SDD ya lo declara en §18.
3. **Importante · `src/components/scroll-fade.tsx:27-28`.** El `ResizeObserver` observa el contenedor, no la tabla. Si la tabla crece después de montar, `more` no se recalcula. Reproducido a 1106 px: con `table.style.minWidth = 1400px`, `scrollWidth` pasa de 786 a 1400, hay contenido oculto a la derecha y `mask-image` sigue en `none`. Lo vi una vez de forma natural a 375 px (claro, tras redimensionar y navegar): `scrollLeft` 168,5, contenido oculto a la derecha sin máscara y el trimestre actual no entero a la vista. No se reprodujo en 7 cargas posteriores, que dieron `scrollLeft` 485,5 y el trimestre a la vista. Afecta a CA-7d.
4. **Importante · huecos de prueba.** Sobreviven las mutaciones M11 y M12 (desmontaje y `ResizeObserver`; §8 lo pide), M17, M19 y M23 (crecimiento en escritorio: CA-9) y M26. La guardia de cableado de CA-4 se esquiva con M1b.
5. **Menor · `src/lib/lead-source.ts:24-42`.** Un origen literal «sin origen» comparte clave con nulo y vacío, y la etiqueta elegida puede ser la minúscula. Entrada: [«sin origen», «sin origen», null]. Salida: una fila «sin origen» con 3 leads. En la base eran dos filas («sin origen» con 2 y «Sin origen» con 1). Lo confirma mi prueba `gate2-edges` (falla 3 de 3).
6. **Menor · `src/lib/lead-source.ts:15`.** `\s` no pliega el espacio de ancho cero (U+200B): «manual​» y «manual» quedan como orígenes distintos. Comportamiento documentado; el SDD no lo pide.
7. **Menor · `scripts/factory/flake.mjs`.** Un archivo de prueba que solo existe en el commit nuevo «falla» en la base porque no está, y se clasifica como `FLAKE` (`baseFails` 3, firma vacía). Le pasó a mi prueba `gate2-edges`, cuyo fallo es determinista: lo clasifico a mano como cambio de comportamiento (hallazgo 5), no como flake.
8. **Informativo.**
   - `/metrics` a 768 px: el documento mide 785 (17 px de desborde). La causa es `segment-coverage.tsx:211` (el bloque `shrink-0 text-right`) y un input de 128 px; ninguno de los dos está en el diff. No lo comparé con la base.
   - Embudo de Leads a 1106 px: 5 columnas más un bloque huérfano en la segunda fila; sin solape.
   - Medición: tras redimensionar sin recargar, el emulador dejó estilos obsoletos (pestañas a 44 px en escritorio). Un reflow o una recarga dan 32/40/28. No es un defecto del código.

#### Mediciones en navegador
Servidor `localhost:5174` verificado contra el commit: `flow-strip.tsx`, `route.tsx` y `scroll-fade.tsx` con `fetch ?raw` en el navegador (SHA-1 idéntico a `git show f6ce7fb7`); además `tabs.tsx`, `button.tsx`, `quarter-kpis-panel.tsx` y `leads.index.tsx` con curl, byte a byte. Usé una pestaña nueva (`tab-2`), la cerré al terminar y restauré el tamaño a `desktop`. Consola: 0 errores.

| CA | Ancho (px) | Tema | Medida | Resultado |
|---|---|---|---|---|
| CA-6 | 320 / 360 / 375 / 768 / 1106 / 1280 (contenido KPI 288–960) | claro y oscuro | Solapes de bloques y de texto, recortes, en KPI y embudo de /leads | 0/0/0 en todos; columnas KPI 1/2/2/2/4/4 y embudo 1/2/2/3/5/6 |
| CA-6 | 820 / 960 / 1440 (contenido KPI 500 / 640 / 1120) | oscuro | Igual | 0/0/0 |
| CA-7b | 320–1280 | claro y oscuro | «plan» y su marca en la misma línea | 0 de 4 celdas |
| CA-7c | 320–1280 | claro y oscuro | Máximo de líneas de una marca; celda mínima | 2 líneas (28 marcas); 176 px (203,8 a 1280) |
| CA-7d | 320 / 360 / 375 / 768 / 1106 | claro y oscuro | Trimestre actual a la vista; señal izquierda/derecha | A la vista; `data-start` y sombra cuando hay contenido oculto a la izquierda. Una carga a 375 falló (hallazgo 3) |
| CA-7d | 1280 | claro y oscuro | Sin desborde | Sin señales (correcto) |
| CA-8 | 320 / 360 / 375 | claro y oscuro | Migas, Avisos, Tablero/Listado, Editar líneas, secciones de Métricas, pestañas (Estrategia y onboarding), lista de pestañas | 44 px en todos; lista de pestañas 52 px; **«Después» 39,5 px** |
| CA-9 | 768 / 1106 / 1280 | claro y oscuro (carga en frío a 1280) | Mismos elementos | Migas 16, Avisos 20, `sm` 28, secciones 32, Editar líneas 20, pestañas 32, lista 40, FlowStrip 36 px |
| CA-10 | 375 | claro y oscuro | Documento / fila; separación entre textos; recorte | 375/375; 8 y 8 px; sin recorte; «Menú» termina en 367 |
| CA-10 | 360 | claro y oscuro | Igual | 360/360 con el recuento actual (fin 358,8); 363–372 con «Avisos · 99/100/999» (hallazgo 2) |
| CA-10 | 320 | claro y oscuro | Igual | Documento 359 (desborda; declarado en §18) |
| FlowStrip, alto total | 375 | claro | /accounts, /leads, /metrics | Antes 52 → después 80 px (contrafactual); escritorio 36 → 36 |
| Primitivas fuera del alcance | 375 | claro | /home (11 botones `sm`), /deals, /onboarding/completar, /strategy | Todo a 44 px; documento igual al ancho |

#### Lo que esta revisión NO demuestra
- Segunda máquina y soak de recursos: NOT RUN.
- Safari en un iPhone real; dispositivos táctiles reales: NOT RUN.
- Popover de «Avisos»: NOT RUN.
- Producción y datos de otras empresas: NOT RUN (solo backend compartido, solo lectura).
- Geometría de la base en navegador: NOT RUN. Los «antes» son el contrafactual de `FlowStrip` y los valores que da el SDD.
- Todas las pantallas que usan `Button sm` o `TabsTrigger`: solo medí /home, /deals, /strategy y /onboarding/completar.
- Que el fallo de CA-7d (hallazgo 3) sea frecuente: lo vi 1 vez de 8 cargas a 375 px.
- Aprobación de entrega: la decide Fede.

#### Evidencia (scratchpad `gate2`)
- Gate: `factory-evidence/evidence/SDD-20261118-legibilidad/f6ce7fb7f6ff/` (`gate.json`, `unit-summary.json`, `vitest.json`, `typecheck.log`, `lint.log`, `build-offline.log`, `unit-suite.log`, `touched-tests.log`) y `gate-run.log`.
- Pruebas nuevas contra la base: `base-newtests.json`, `base-newtests.log`.
- Casos límite: `extra-tests/gate2-edges.test.tsx`, `extra-edges.log`, `flake-src-__gate2__-gate2-edges-test-tsx.json`.
- Mutaciones: `mutate.mjs`, `mutations.tsv`, `mut-M8b.log`.
- Navegador: `browser-measurements.md`, `measure.js`, `measure-def.js`.
- Worktrees: `worktree-list-before.txt` y `worktree-list-after.txt`. Mis dos worktrees están eliminados. Aparecieron dos ajenos durante la revisión (`/private/tmp/claude-501/gate-wt/base` y `/head`); no los creé ni los toqué.

### Revisión independiente adicional (2026-11-18), sobre el commit `f6ce7fb7`

*Informe de un tercer agente de contexto fresco, lanzado desde la sesión principal a petición de Fede, copiado sin editar su contenido (solo se bajó un nivel de los encabezados y se corrigieron entidades HTML). Es independiente de la «Segunda revisión» de arriba. Este agente no ejecutó `gate.mjs` ni abrió el navegador.*

- **Veredicto del gate: Objeciones.** Las cuatro correcciones y la cabecera están en el código, y las pruebas, tipos, lint y build pasan. Pero tres CA se afirman sin demostrarlo: la altura real del enlace «Después:» (calculo ~40 px, no 44), el crecimiento de las filas de `FlowStrip` y la cláusula «sin plan» de CA-7b. Además el SDD sigue contradiciendo al código en tres puntos.

#### CA sin prueba posible o sin G-n (no hay PRD, G-n no cuenta)
- CA-6: solo la guardia de código fuente (`layout-grids.test.ts`). El solape real no es medible en jsdom.
- CA-7c, la geometría de CA-8 y la separación de CA-10: solo navegador, y no las reprodujo.
- CA-5: la prueba solo comprueba que una función pura no muta su entrada. Nada comprueba que la tarjeta del lead siga pintando `l.source` tal cual. Es testable y sigue sin prueba.
- CA-7b, cláusula «sin plan se queda en línea»: sin prueba (hallazgo 3).
- CA-8, «Después:» a 44 px: sin prueba ni medición (hallazgo 1).

#### [Por verificar] que sigue sin comprobarse
- Todo lo visual y geométrico de la sección 18 (CA-6, 7b a 7d, 8, 10 y «Manual con 2 leads»): no lo reprodujo.
- Cabecera a 320 px: sigue desbordando (admitido en el SDD) y no hay medición sobre la base, así que no sabe si empeoró.
- Efecto de `Button sm`, `TabsTrigger` y `TabsList` más altos fuera de las tres pantallas. Ejemplo: el popover de «Avisos» (`notification-center.tsx:177-182`) y `connect.tsx:89,188`, que usa `TabsList flex-wrap` con altura fija.
- `box-shadow` en celdas `th/td` pegajosas con `border-collapse: collapse` en Safari.
- Modo oscuro móvil, Safari real y producción: no mirados.

#### Contradicciones con el código o con decisiones previas
- SDD §6 (línea 61, «el trimestre actual aparece primero») frente a `scroll-fade.tsx:5-6,27-28`, que lo centra. El SDD no se corrigió, pese a que el informe anterior ya lo señaló.
- SDD CA-8 (línea 86, «se usa `min-h-11 md:min-h-0`») frente a `button.tsx:27`, `tabs.tsx:54,71`, que usan `h-11` más `md:h-*`. §18 no recoge ese desvío de método.
- SDD §5 (línea 46, lista cerrada) frente a `button.tsx:27` y `tabs.tsx:54`: `Button sm` y `TabsList` no figuran en la lista. Solo aparecen en §13/D-3 y en el PR.
- SDD CA-4 («en empate, la que lleva mayúscula inicial») frente a `lead-source.ts:35`, que prefiere «alguna mayúscula» y luego orden alfabético.
- NK-0106, el contrato de `DataState`, `AGENTS.md` y `src/lib/AGENTS.md`: ninguna contradicción. El texto de las marcas no cambia, no hay «—», y `mark-text.ts` solo añade `planIsMark`.

#### Los cuatro hallazgos del informe anterior y la regresión de la cabecera
1. **Cableado de CA-4: parcial.** Hecho: `funnelBySource` existe y lo usan `leads.index.tsx:117` y `lead-funnel-panel.tsx:36`. Mutación: con ambos archivos revertidos a la base, fallan 4 pruebas de `lead-source-wiring.test.ts` (más 2 de `layout-grids`, porque revertir el archivo también deshace las rejillas). Las 169 restantes de esa corrida pasan. Límite: la guardia es de código fuente, no de render; la regex `funnelBy\([^)]*source` no atrapa `funnelBy(c, d, (l) => l.source…)`, porque el `)` de `(l)` la corta. Falta una prueba de render de `LeadFunnelPanel` con «manual» y «Manual».
2. **CA-7d, señal a la izquierda: sí, con matiz.** `data-start` más `[[data-start=true]_&]:…` está en `scroll-fade.tsx` y `quarter-kpis-panel.tsx`. La prueba con `scrollLeft` distinto de 0 falla si se quita el centrado (dos fallos en la mutación). Matiz: `ScrollFade` sigue centrando también en escritorio con desborde, aunque el SDD dice «pantalla estrecha».
3. **`FlowStrip` creciendo: parcial.** El `li` ya no lleva `min-h-11`, pero cada enlace de las migas es `inline-flex min-h-11` dentro de un `li flex items-center`, así que el `li` sigue midiendo 44 px. La prueba «sus filas no crecen» solo mira la clase del `li` y pasaría igualmente con las filas a 44 px.
4. **NFC en `normalizeLeadSource`: sí.** `lead-source.ts:16` normaliza. Si se quita `.normalize("NFC")` falla 1 prueba, y la de acento distinto («Reunión»/«Reunion» separados) sigue verde.
5. **Regresión de la cabecera: sí, en el código.** `route.tsx:197` queda en `gap-1 px-3 min-[400px]:gap-3 min-[400px]:px-4`, con «Buscar» `min-w-11 px-1` y «Menú» `px-1 -mr-1`. La suma da 8 px entre textos, exactamente el mínimo de CA-10. Que a 360 y 375 px `scrollWidth` sea igual al ancho de la ventana es medición del implementador, no de este revisor.

#### Hallazgos nuevos
1. **Importante.** El área táctil de «Después:» no llega a 44 px por cálculo. Evidencia: `flow-strip.tsx:38`. `before:-inset-y-3` suma 24 px a la caja del enlace inline `text-xs`, que son unos 15-16 px, así que quedan ~40 px. El SDD (§18) dice «llega a 44 px» sin medir ese pseudoelemento. Cambiaría: `before:-inset-y-4` (o 14 px) y medirlo.
2. **Importante.** La prueba de `FlowStrip` no protege lo que dice. `touch-targets.test.tsx` («sus filas no crecen») lee solo la clase del `li`. Para no crecer habría que usar el mismo truco del pseudoelemento en las migas. Si el 44 px de las migas es intencional, la prueba y el texto del SDD deben decir que las filas crecen.
3. **Menor.** CA-7b «sin plan se queda en línea»: sin prueba. Mutación: `planIsMark` devolviendo `true` siempre deja `quarter-kpis-panel.layout.test.tsx` y `quarter-kpis-panel.test.tsx` en verde (15 de 15). Cambiaría: una prueba con una celda «sin plan».
4. **Menor.** La regla «mayúscula» del desempate (`lead-source.ts:35`) es código muerto. Quitarla deja las 14 pruebas en verde, porque el orden ASCII ya pone la mayúscula primero. Aun así, el criterio del código («alguna mayúscula») difiere del SDD («inicial»).
5. **Menor.** Casos límite de §8 sin prueba: desmontaje de `ScrollFade` (listeners y `ResizeObserver`); trimestre actual ausente (el código es seguro, pero no hay prueba); `ScrollFade` solo centra al montar (`[]`), no si cambia `quarter` sin remontar; un origen literal «sin origen» en minúscula y mayoritario sustituiría la etiqueta «Sin origen» por la minúscula. Cubiertos: `sourceLabeler` con 40 leads y 7 orígenes, y la ausencia de `ResizeObserver` (jsdom no lo trae).
6. **Menor.** `lead-source-wiring.test.ts` solo vigila el código fuente (ver hallazgo 1 de los cuatro).
7. **Menor, proceso.** Mientras revisaba, el checkout real avanzó a `9ccac7a7`, un commit de otra sesión que solo añade 162 líneas al SDD (la segunda revisión de arriba). Este agente revisó `f6ce7fb7`.

#### Alcance, privacidad y proceso
- **Alcance:** 22 archivos, 18 añadidos y 4 modificados, todos de `src` o del SDD. Ninguna prueba existente modificada. Todo está dentro de §5 salvo los dos archivos compartidos que §5 no lista: `ui/button.tsx` (`Button sm`) y `ui/tabs.tsx` (`TabsList`). Las tres pantallas y la ampliación de `metrics.tsx` sí están en §18.
- **Privacidad:** datos ficticios en pruebas, sin URLs, correos, `as any`, `.only/.skip`, `console.*` ni `confirm/prompt` en el diff (grep). La descripción del PR 161 y el SDD no tienen datos de cliente.
- **Estado del PR:** en borrador, 22 archivos, cabeza `f6ce7fb7`.
- **Prettier:** el SDD da aviso, como 99 archivos de `docs/sdd`, así que no es regresión.

#### Qué ejecutó y con qué resultado
- **Pruebas nuevas contra la base `5c646d0a`** (7 archivos copiados a un worktree temporal): 25 fallan y 3 pasan. Las 3 que pasan son CA-2, «línea con otro nombre» y «las palabras de las marcas no cambian». `lead-source.test.ts` falla por import no resuelto, no por lógica; para eso hizo mutaciones sobre la cabeza.
- **Suite completa en `f6ce7fb7`:** 440 archivos y 6.404 pruebas en verde (92 s). `npx tsc --noEmit -p .` sale con 0. `eslint` sobre los 21 archivos de `src` tocados: 0 errores y 1 aviso previo (`button.tsx:54`). `prettier --check` sobre esos archivos: limpio. `npx vite build`: sale con 0.
- **Tailwind 4.3.3:** compiló el CSS con `@tailwindcss/node` y lo confirmó en el CSS de la build. Las dos variantes del diff son sintaxis válida: `[[data-start=true]_&]:[box-shadow:6px_0_6px_-6px_var(--hairline-firm)]` genera `[data-start=true] .clase{box-shadow:…}` y `before:-inset-y-3` genera `inset-block:calc(var(--spacing) * -3)`. También generan las demás clases nuevas (`h-[3.25rem]`, `auto-fit`, `min-w-44`, `min-[400px]:*`, `md:before:hidden`).
- **Mutación pedida (cableado de `funnelBySource`):** revertidos `leads.index.tsx` y `lead-funnel-panel.tsx` a la base. Fallan 6 pruebas: 4 de `lead-source-wiring` y 2 de `layout-grids`. Las otras 169 de esa corrida pasan.
- **Otras mutaciones sobre `f6ce7fb7`:** quitar NFC, 1 fallo; clave sin `toLowerCase`, 8 fallos; plegar acentos, 2 fallos; quitar la regla de mayúscula, 0 fallos; `planIsMark` siempre `true`, 0 fallos; sin centrado en `ScrollFade`, 2 fallos.
- **Uso de `size="sm"` y tabs:** 199 usos de `size="sm"` y 13 `<TabsList`, 8 de ellos con `className`; `connect.tsx` usa `flex-wrap`. Solo encontró un botón con altura propia (`hub-screen.tsx:371`, `h-7`), que no se ve afectado.
- **No ejecutado:** `gate.mjs` (NOT RUN: pide ticket NK y no existe; no se inventó), segunda máquina y soak de recursos (NOT RUN), `flake.mjs` (NOT RUN). Worktrees temporales eliminados. No tocó el checkout real, el PR ni el ledger.

#### Lo que esta revisión NO demuestra
- Nada visual ni geométrico: no abrió el navegador. Solape de CA-6, líneas por celda de CA-7c, 44 px reales de CA-8, separación y desbordamiento de CA-10, modo oscuro, Safari y 320 px quedan sin reproducir.
- Que `Button sm`, `TabsTrigger`, `TabsList` o `FlowStrip` más altos no rompan otras pantallas.
- Comportamiento con datos reales o con producción.
- Que el gate fijo (`gate.mjs`) pase. Los guards del diff los repitió a mano con grep y `git diff --name-status`.
- Que el SDD esté libre de objeciones: eso lo decide Fede.

### Cuarta revisión independiente (2026-11-18), sobre el commit `2f431418`

*Informe de un agente de contexto fresco, lanzado desde la sesión principal a petición de Fede, copiado sin editar su contenido (se bajó un nivel de los encabezados y se corrigieron entidades HTML). Este agente sí ejecutó `gate.mjs` en un worktree limpio (etiqueta `SDD-20261118-legibilidad`, sin ticket NK real) y no abrió el navegador. Va después de la «Revisión independiente adicional» y es independiente de ella y de la «Segunda revisión».*

- **Veredicto del gate: Objeciones.** Las correcciones del último commit están en el código y las pruebas las atrapan. Quedan tres cosas sin protección: el cableado de «Avisos» a `noticeLabels`, el caso «trimestre actual ausente», y varios textos del SDD que ya no dicen lo que hace el código. `gate.mjs` devolvió PASS.

#### CA sin prueba posible o sin G-n (no hay PRD, G-n no cuenta)
- **CA-5 (tarjeta del lead):** solo hay prueba de una función pura que no muta su entrada. Ninguna prueba renderiza la tarjeta ni comprueba que pinte `l.source` tal cual. Es comprobable y sigue sin prueba.
- **CA-6:** solo la guardia de código fuente (`layout-grids.test.ts`). El solape real no es automatizable en jsdom.
- **CA-7c, parte geométrica de CA-8 y CA-10:** solo navegador, y no lo reprodujo.
- **CA-10, cableado de «Avisos»:** el tope «9+» tiene prueba en la función pura, pero nada prueba que `notification-center.tsx` la use ni que el `aria-label` conserve la cuenta real (hallazgo 1).
- **CA-1, 2, 3, 4, 7b, 7d y 9:** tienen prueba que nombra el CA y falla al revertir el código.

#### [Por verificar] que sigue sin comprobarse
- **Geometría:** el 47,5 px de «Después:», la cabecera a 360 y 375 px («Menú» justo en el borde a 360), el máximo de 3 líneas por celda, el solape de las rejillas a 320 px, el modo oscuro y Safari.
- **Hit-area de «Después:»:** sube de 12 a 16 px por arriba y el `<p>` solo tiene `mt-1` bajo las migas de 44 px. El área nueva podría quitarle toques a las migas.
- **Popover de «Avisos»:** usa `TabsTrigger`; no se ha visto con las pestañas más altas.
- **`Button sm` y `TabsList`:** `Button sm` pasa a `h-11` en móvil en unas 199 apariciones de la app, y solo se midieron cuatro pantallas. La decisión de Fede sigue abierta.
- **`box-shadow` en celdas pegajosas con `border-collapse: collapse`** en Safari.
- **Producción, otras empresas y dispositivos táctiles reales.**

#### Contradicciones con el código o con decisiones previas
Todas las líneas son del SDD.
- **Prueba de CA-10:** `SDD:90` y `SDD:119` dicen `route.header.test.tsx`. El archivo real es `-route-header.test.ts`, y solo §18 lo documenta.
- **U-5 de §13:** `SDD:128` dice `min-h-11` y `TabsList h-14`. El código usa `h-11` y `h-[3.25rem]`. CA-8 sí se corrigió, pero U-5 no. §18 afirma haber corregido «U-4/U-6 de §13», pero no U-5.
- **§6 y §9 frente a `notices-label.ts`:** §9 dice «se conservan Avisos» y §6 «Modificado» no lista el cambio. Por debajo de `sm`, «Avisos · 14» pasa a «Avisos · 9+» y se pierde información. Solo está declarado en §13 y §18 («Cambio visible»), sin una decisión de Fede registrada.
- **§18, primera línea (`SDD:439`):** dice «un commit local (8c300442), sin push». Hoy son 4 commits, ya subidos, con el PR 161 abierto.
- **Cuerpo del PR 161:** dice «440 archivos, 6.404 pruebas», «segundo gate en curso sobre f6ce7fb7» y «a 360 px no desborda». Todo desfasado: hoy son 444 archivos y 6.428 pruebas.
- **CA-7d (`SDD:83`):** dice «desvanecido en el borde con más contenido». A la izquierda el código dibuja una sombra en las celdas pegajosas, no un desvanecido. §6 sí lo describe bien.
- **Prueba de `FlowStrip` (`touch-targets.test.tsx`):** se llama «sus filas no crecen» y solo mira la clase del `li`. Cada enlace de las migas es `inline-flex min-h-11`, así que el `li` mide 44 px. El propio §18 reconoce el bloque de 80 px.
- El resto coincide: CA-1, CA-3, CA-4 (desempate), CA-8 (`-inset-y-4`), CA-9, §6 (centrado bajo 768 px), §13 U-4 y U-6 y CA-7b son coherentes con el código. §18 solo se puede comprobar en parte (la aritmética 15,5 + 32 = 47,5, que cada prueba nueva falla sobre la base y las mutaciones de `planIsMark`; no las mediciones en navegador).

#### Estado de los hallazgos de los informes anteriores
**Primer informe (sobre `8c300442`)**

| # | Hallazgo | Estado | Evidencia |
|---|---|---|---|
| 1 | Cableado de CA-4 sin prueba (importante) | Resuelto | `funnelBySource` y la prueba de render `lead-funnel-panel-source.test.tsx`. Revertir el panel a `l.source` falla 3 pruebas. En `leads.index.tsx` solo hay guardia de código fuente: quitar `funnelBySource(` falla 1. |
| 2 | CA-7d sin señal a la izquierda (importante) | Resuelto | `data-start` más sombra en celdas pegajosas, con prueba y `scrollLeft` > 0. Quitar el atributo o la sombra falla 1 prueba. Queda lo de Safari. |
| 3 | `Button sm` en las 199 apariciones (importante) | No | El propio §18 lo deja sin resolver. Decisión de Fede abierta. |
| 4 | `FlowStrip` crece en todas las pantallas (importante) | Parcial | El `li` ya no lleva `min-h-11` y «Después:» usa un pseudoelemento de 47,5 px (aritmética, sin medir por este revisor). Las migas siguen a 44 px y la prueba lleva un nombre engañoso. |
| 5 | Casos límite de §8 sin prueba (menor) | Parcial | Ahora hay prueba de desmontaje, de ausencia de `ResizeObserver`, de 40 leads con 7 orígenes, de cohorte vacía y de «sin origen» literal. Siguen sin prueba: trimestre actual ausente, `matchMedia` ausente o que lanza, lead fuera de la cohorte. |
| 6 | Cabecera por debajo de 375 px (menor) | Parcial | `px-2.5`, `-mr-2` y el tope «9+» están en el código y con prueba de clases. A 320 px desborda (declarado), a 360 px queda sin holgura, y el tope no tiene prueba de cableado. |
| 7 | NFC (menor) | Resuelto | Quitar `.normalize("NFC")` falla la prueba de NFC. |
| 8 | `ScrollFade` centra siempre y observa solo la caja (menor) | Resuelto | Quitar la condición estrecha falla 1 prueba. Invertir `matchMedia` falla 3. Quitar `observe(firstElementChild)` falla 1. |
| 9 | §17 y §18 desfasados (menor) | Parcial | §18 sigue con «commit local, sin push». El PRD sin seguimiento es ajeno. |

**Segunda revisión (sobre `f6ce7fb7`)**

| # | Hallazgo | Estado | Evidencia |
|---|---|---|---|
| 1 | «Después:» a 39,5 px (importante) | Resuelto en código | `-inset-y-4` en `flow-strip.tsx`. Medición no reproducida y solape con las migas sin sondear de nuevo. |
| 2 | Cabecera a 360 px depende de los avisos (importante) | Parcial | El tope «9+» acota el ancho. Sin holgura a 360 px. Cableado sin prueba. |
| 3 | `ResizeObserver` observa solo el contenedor (importante) | Resuelto | Ahora observa el contenido, con prueba. |
| 4 | Huecos de prueba (importante) | Resuelto | Las mutaciones de desmontaje, `ResizeObserver`, crecimiento en escritorio y `planIsMark` las atrapa ahora una prueba cada una. No se rehízo la mutación que esquiva la guardia con un agrupador propio y un `funnelBySource(` decorativo. |
| 5 | Etiqueta «Sin origen» en minúscula (menor) | Resuelto | La prueba falla si se quita la protección de la clave. |
| 6 | Ancho cero U+200B (menor) | Resuelto | La prueba falla si se quita la limpieza. |
| 7 | `flake.mjs` clasifica mal un archivo nuevo (menor) | No aplica | Es un defecto del script. No se tocó. |
| 8 | Informativo (768 px, embudo) | Sin cambio | No reproducido. |

**Revisión independiente adicional (sobre `f6ce7fb7`)**

| # | Hallazgo | Estado | Evidencia |
|---|---|---|---|
| 1 | «Después:» ~40 px (importante) | Resuelto en código | Igual que el hallazgo 1 de la segunda revisión. |
| 2 | La prueba de `FlowStrip` no protege lo que dice (importante) | No | El nombre sigue diciendo «sus filas no crecen» y las filas miden 44 px por el enlace. |
| 3 | Cláusula «sin plan» de CA-7b sin prueba (menor) | Resuelto | `planIsMark` siempre true falla 3 pruebas. Siempre false falla 3. |
| 4 | Regla de mayúscula del desempate, código muerto (menor) | Resuelto | Se eliminó y CA-4 se corrigió. |
| 5 | Casos límite sin prueba (menor) | Parcial | Igual que el hallazgo 5 del primer informe. |
| 6 | La guardia de cableado solo vigila el fuente (menor) | Parcial | El panel tiene prueba de render. `leads.index.tsx` solo guardia, endurecida con `not.toContain("funnelBy(")`. |
| 7 | Checkout avanzó durante la revisión (proceso) | No aplica | |

#### Hallazgos nuevos
1. **Importante. El tope «9+» y el `aria-label` de «Avisos» no están protegidos en pantalla.** Tres mutaciones sobre `notification-center.tsx` (ignorar `noticeLabels` y volver a las cadenas sin tope; cambiar el `aria-label` por «9+») dejaron las 83 pruebas en verde. Solo `notices-label.test.ts` cubre la función pura; ninguna prueba renderiza `NotificationCenter`. CA-10 depende de este cableado a 360 px y el SDD afirma que el `aria-label` conserva la cuenta real sin prueba. Cambiaría: una prueba de render de `NotificationCenter` con 14 avisos sin leer, que compruebe un `span` «Avisos · 9+» con `sm:hidden`, otro «Avisos · 14» y un `aria-label` con «14 sin leer».
2. **Menor. Dos casos límite de §8 y de `ScrollFade` siguen sin prueba.** Con trimestre actual ausente y desborde, sustituir `if (cur)` por `cur!` lanza un `TypeError` y las 83 pruebas pasan. Quitar `typeof window.matchMedia !== "function" ||` también las deja en verde, porque `src/test/setup.ts:19` define `matchMedia`. Cambiaría: dos pruebas (desborde sin `data-current`, y `matchMedia` borrado con `vi.stubGlobal`) y, si se quiere, un `try`.
3. **Menor. «Después:» con `-inset-y-4` puede solaparse con las migas.** `flow-strip.tsx:38` es un pseudoelemento posicionado, posterior en el DOM, a 16 px por encima y a 4 px de la fila de migas de 44 px. Podría quitarle toques a la parte baja de las migas. No lo midió. Cambiaría: repetir el sondeo con `elementFromPoint` a 320, 360 y 375 px, o reducir al mínimo que dé 44 px.
4. **Menor. «Editar líneas» usa `inline-flex min-h-11` dentro de un `<p>`.** `primary-line-note.tsx:37` es el mismo mecanismo que el diff evitó para «Después:». La línea de la nota crece de unos 20 a 44 px en móvil. §18 no mide esa altura. Cambiaría: medirlo y decidir si el crecimiento es aceptable, o usar el pseudoelemento.
5. **Menor. Cabecera sin holgura y arreglo que depende de pocos píxeles.** `route.tsx:197` y `route.tsx:219` dejan «Menú» a 2 px del borde de la pantalla. `-route-header.test.ts` corta el fuente por desplazamientos fijos de caracteres (`-200`/`+300`/`+250`/`+120`); una línea añadida a esas clases puede dar falso verde o falso rojo. Cambiaría: una prueba más robusta (extraer el `className` de forma estructural) y medir con fuentes distintas.
6. **Menor. `ScrollFade` solo centra al montar.** El efecto tiene `[]` de dependencias; si cambia `quarter` sin remontar, `data-current` se mueve y la tabla no se recentra. Es coherente con «al montar» en §6, pero §8 no lo menciona. Cambiaría: documentarlo o recentrar al cambiar `quarter`.
7. **Menor. Prueba de CA-7b que pasa sobre la base.** «Una celda sin plan se queda en línea» pasa sobre la base: es de no regresión y está bien, pero no demuestra el cambio.

#### Qué ejecutó
- **Preparación:** tres worktrees temporales bajo `/private/tmp/claude-501/gate3/` (`base` sobre `5c646d0a`, `head` y `gate` sobre `2f431418`), con `node_modules` enlazado; borrados al terminar. `FACTORY_DIR` fuera del repo.
- **`gate.mjs`:** `node scripts/factory/gate.mjs --ticket SDD-20261118-legibilidad --base 5c646d0a --root <worktree limpio>`. Veredicto **PASS**, exit 0. Checks: árbol limpio sobre el commit exacto, canario, los 9 guards del diff, `typecheck`, `lint` (26 archivos), build de release, suite completa (6.428 pruebas, 0 fallos, 0 conocidos, 0 sin aserción, 444 archivos), y los 11 archivos de prueba tocados enteros (63 pruebas). Segunda máquina: «NOT RUN: no second runner configured». Soak: «NOT A SOAK». `flake.mjs`: NOT RUN (no hubo fallos inesperados).
- **Pruebas nuevas contra la base (`5c646d0a`):** 11 archivos copiados; los 11 fallan; 32 pruebas fallan y 5 pasan, de 37 que llegan a ejecutarse. `lead-source.test.ts`, `notices-label.test.ts` y `scroll-fade.test.tsx` no cargan en la base (import sin resolver). Las 5 que pasan son de no regresión: CA-2, «línea con otro nombre», «palabras de las marcas», «lead sin origen cuenta bajo Sin origen» y «CAC sin plan en línea».
- **Mutaciones:** 28 sobre `2f431418` con 14 archivos de prueba (línea base 83 en verde). Atrapadas por una a tres pruebas: tope «9+», `md:before:hidden`, condición estrecha y `narrow = false` de `ScrollFade`, `observe(firstElementChild)`, cleanup, `planIsMark` (siempre true o false), `plan` siempre `block`, ancho cero, NFC, protección de «Sin origen», desempate invertido, cableado de `funnelBySource` en ambas pantallas, `md:min-h-0` (migas, «Editar líneas», Métricas), `gap-3`, `-mr-1`, `data-start` y sombra. **Sobreviven 4:** `notification-center` ignora `noticeLabels`, `aria-label` de «Avisos» con «9+», quitar el guard de `matchMedia` y quitar el guard de `cur`.
- **Resto:** `prettier --check` limpio sobre los 26 archivos de `src` tocados (el SDD da aviso, como otros 9 de `docs/sdd`); `eslint` 0 errores y 1 aviso previo (`ui/button.tsx:54`); alcance de 27 archivos, ninguna prueba existente modificada, todo dentro de §5; privacidad: sin `as any`, `.only`, `.skip`, `console.`, URLs ni correos, datos ficticios, y el cuerpo del PR y el SDD sin datos de cliente.

#### Lo que esta revisión NO demuestra
- Nada visual ni geométrico: 44 px reales, 47,5 px de «Después:», solape del embudo a 320 px, líneas por celda, ancho de la cabecera a 320, 360 y 375 px, modo oscuro, Safari, dispositivos reales. No abrió el navegador ni reprodujo ninguna medición de §18.
- Que `Button sm`, `TabsList`, `TabsTrigger`, `FlowStrip` o «Editar líneas» más altos no rompan otras pantallas.
- Ninguna lectura de producción ni de datos de otras empresas.
- El efecto real del popover de «Avisos» con pestañas más altas.
- Segunda máquina y soak: NOT RUN. `flake.mjs`: NOT RUN.
- Que el SDD esté libre de objeciones: lo decide Fede.

### Quinta revisión independiente (2026-11-21), sobre el commit `2f431418`

*Informe de un agente de contexto fresco, lanzado el 2026-11-21 a petición de Fede, copiado sin editar su contenido. Solo se bajó un nivel de los encabezados, se corrigieron las entidades HTML y se quitaron las rutas absolutas del scratchpad. Revisó `2f431418` tal como estaba subido: la «Tercera ronda» de §18 (2026-11-19) estaba entonces sin commit en otro checkout, así que no la vio. Su hallazgo 2 (cableado de «9+») ya lo cubría esa ronda con `notification-center.test.tsx`, y su hallazgo 1 («Cerrar» a 360 px) se corrigió en `5ecbcf6a` (ver la «Cuarta ronda» de §18). Es independiente de la «Cuarta revisión», que también fue sobre `2f431418`.*

- **Veredicto: Objeciones, sobre `2f431418`.** El núcleo fijo pasa entero, y los cuatro hallazgos Importantes de las revisiones sobre `f6ce7fb7` están resueltos en el código y los protegen pruebas que caen al mutarlas. Quedan tres huecos menores, ninguno bloqueante: una mutación del cableado de «9+» sobrevive; a 360 px, con el menú abierto y 10 o más avisos, la cabecera se pasa del ancho de pantalla unos 5 px; y la geometría de la app real no se pudo medir con sesión.

#### Checks del núcleo fijo
Comando: `FACTORY_DIR=<wt>/.factory node scripts/factory/gate.mjs --ticket SDD-20261118-legibilidad --base 5c646d0a --root <wt> --extra "npx prettier --check <11 archivos tocados>"`, en un worktree desechable, con el árbol limpio y sobre `2f4314189e67`. El script da **PASS** (exit 0).

| Check | Resultado |
|---|---|
| clean tree on exact commit | PASS (2f4314189e67…) |
| canary: runner detects failure | PASS |
| guards (`as any`, confirm/prompt, secretos, VITE_, `.only/.skip`, `error.message` en toasts, `.env`, aserciones, timeouts) | PASS (los 9) |
| typecheck | PASS |
| lint (touched files, 26) | PASS (0 errores; 1 aviso previo en `ui/button.tsx:54`) |
| release build (red exterior bloqueada en mejor esfuerzo) | PASS |
| full unit suite | PASS: **444 archivos, 6428/6428 pruebas**; fallos conocidos 0; inesperados 0; archivos sin aserción 0 |
| touched test files, whole (11) | PASS |
| extra: `prettier --check` sobre 11 archivos de `src` tocados | PASS |
| second-machine full run | **NOT RUN** (el script da PASS con «no second runner configured») |
| artifact size recorded | **NOT A SOAK** |

**Protocolo de flakes:** no hubo ningún fallo, así que `flake.mjs` no tuvo nada que clasificar (NOT RUN por falta de fallos).

**Pruebas nuevas contra la base `5c646d0a`** (11 archivos copiados a un worktree de la base): 32 fallan por aserción y 5 pasan. Las 5 que pasan son de no regresión: CA-2, «nombres distintos, ambos», «las palabras de las marcas no cambian», «en CAC "plan" y "sin plan" no son bloque» y «sin origen cuenta bajo "Sin origen"». `lead-source.test.ts`, `notices-label.test.ts` y `scroll-fade.test.tsx` no llegan a ejecutarse en la base porque el módulo que importan no existe; se comprueban con mutaciones sobre la cabeza, no se cuentan como fallo previo.

#### Estado de los hallazgos Importantes anteriores
| Hallazgo | Estado | Evidencia |
|---|---|---|
| «Después:» a 44 px (CA-8) | **Resuelto en código; geometría solo medida en un arnés** | `flow-strip.tsx:38` usa `before:-inset-y-4`. En un arnés a 360 px con el CSS real, `getComputedStyle(a,'::before').height` = **47,5 px** (línea de 15,5 px). La sonda con `elementFromPoint` no llegó a completarse porque el panel cambió de página a mitad. Al mutar a `-inset-y-3` cae `touch-targets`. |
| Cabecera a 360 px según el número de avisos (CA-10) | **Parcial** | Ver la tabla de abajo. Con el menú cerrado, la etiqueta más ancha posible («Avisos · 9+») deja «Menú» a 360,1 px con 0 px de desborde de fila. Con «Cerrar» (menú abierto) y 10 o más avisos, la fila desborda 5 px y el texto acaba en 361,5 px. En todas las combinaciones es mejor que la base. |
| `ResizeObserver` y desmontaje de `ScrollFade` (CA-7d) | **Resuelto** | `scroll-fade.tsx:31-37` observa la caja y su primer hijo, y limpia al desmontar. Las mutaciones J (sin observar el hijo), K (sin `removeEventListener`), L (sin `disconnect`), N (sin `observe(el)`) y W (sin listener de scroll) tumban cada una una prueba de `scroll-fade.test.tsx`. Centrar solo por debajo de 768 px: la mutación M («narrow siempre») cae. |
| Guardia y prueba de render del cableado de CA-4 | **Resuelto en el panel; en `leads.index` solo hay guardia de código fuente** | R (el panel vuelve a agrupar por `l.source`) tumba 3 pruebas, 2 de ellas de render de `lead-funnel-panel-source.test.tsx`. El atajo M1b de la revisión anterior ya no es posible: `leads.index.tsx` no contiene `funnelBy(`. Sobrevive S, una mutación artificial que altera `source` antes de llamar a `funnelBySource` (ver hallazgo 2). |
| Huecos de mutación M11, M12, M17, M19, M23 y M26 | **Resueltos** | Sus equivalentes K/L, J/N, C, B, D y E tumban cada uno una prueba. |
| CA-7b «sin plan» (Menor anterior) | **Resuelto** | T (`planIsMark` siempre `true`) tumba 3 pruebas. |
| `lead-source`: «sin origen» literal y ancho cero (Menores anteriores) | **Resuelto** | P y O tumban una prueba cada una; Q (sin NFC) también. |

**Cabecera a 360 px** (arnés con las clases exactas de `route.tsx` en HEAD y en la base, `Lockup` e `IconText` reales, DM Sans cargada). Cada celda da el borde derecho de la caja de «Menú/Cerrar» y, entre paréntesis, el desborde de la fila:

| Etiqueta corta | HEAD «Menú» | HEAD «Cerrar» | Base «Menú» | Base «Cerrar» |
|---|---|---|---|---|
| Avisos / Avisos · 9 | 358 (0) | 358 (0) | 352–358 (0) | 352–363 (0–3) |
| **Avisos · 9+** (máximo posible tras el tope) | **360,1 (0)** | **365,5 (5)** | 365,8 (6) | 371,2 (11) |
| Avisos · 14 (sin tope, referencia) | 358 (0) | 362,1 (2) | 362,5 (2) | 367,8 (8) |

La separación entre textos es de 8,0 px en todas las filas de HEAD (CA-10 pide ≥ 8). «9+» es 2 px **más ancho** que «14»: el tope fija un ancho máximo, pero no estrecha las cifras de dos dígitos.

#### Hallazgos nuevos (por gravedad)
1. **Menor · `route.tsx:216-223` con `notices-label.ts`.** Entrada: menú abierto (el texto pasa a «Cerrar») a 360 px con 10 o más avisos sin leer o 10 o más trabajos en marcha. Salida: la fila desborda 5 px y «Cerrar» acaba en 361,5 px, cortado 1,5 px. La medición de §18 solo cubre «Menú». Antes era peor (11 px). Qué cambiaría: medirlo en la app real y, si se confirma, ajustar el estado abierto o reservar el ancho de «Cerrar»; o documentarlo en §18.
2. **Menor · hueco de prueba en el cableado de «9+» (`notification-center.tsx:163`).** La mutación I (el `span` móvil pinta `{label}` en vez de `{short}`) deja las 83 pruebas en verde: el tope solo se prueba en la función pura y nadie renderiza el disparador. Qué cambiaría: una prueba de render de `NotificationCenter` con 14 avisos que espere «Avisos · 9+» en el `span` `sm:hidden` y el número real en el `aria-label`. La mutación S también sobrevive, pero es artificial; no pediría nada por ella.
3. **Menor · `scroll-fade.tsx:31-35`.** El `ResizeObserver` observa `firstElementChild` solo al montar; si el hijo se sustituyera, observaría un nodo suelto (hoy el hijo es siempre el `<table>`, así que no afecta). El centrado sigue haciéndose solo al montar: cambiar de trimestre sin remontar no vuelve a centrar. Es un caso límite de §8 ya anotado; lo del cambio de trimestre no se verificó en la app.
4. **Informativo.** `Button sm`, `TabsTrigger` y `TabsList`: `2f431418` no los toca (vienen de `8c300442`) y D-3 los aprobó. El texto «9+» es un cambio visible de copy, declarado en §18; desde `sm` y en el `aria-label` se mantiene el número real. CA-10 en §7 citaba `route.header.test.tsx`; el archivo real es `-route-header.test.ts` (declarado en §18).

#### Qué ejecutó
- `gate.mjs` con el `--extra` de prettier: PASS (444 archivos, 6428 pruebas).
- Pruebas nuevas contra la base: 37 pruebas, 32 fallan, 5 pasan, y 3 archivos no se ejecutan por import sin resolver.
- 23 mutaciones (A–W) sobre los 11 archivos de prueba nuevos más `quarter-kpis-panel.test.tsx`, `data-state.test.tsx` y `metrics/finance-panel.test.tsx` (83 pruebas): 21 caen y sobreviven 2 (I y S).
- Arnés de navegador: una ruta pública desechable con copias de las clases de la cabecera de HEAD y de la base, y del enlace «Después:». Sin datos, sin red y sin clics que guarden nada; medido a 360 px en su propio servidor local.
- Eliminó al acabar sus tres worktrees desechables, paró su servidor y dejó el navegador en tamaño de escritorio. No tocó otros checkouts, el PR ni GitHub.

#### Lo que esta revisión NO demuestra
- **La app real con sesión: NOT RUN.** Entrar con la contraseña real no le estaba permitido. No midió CA-6, CA-7c, CA-7d ni CA-8 sobre las pantallas reales, ni CA-10 con el disparador real de «Avisos». Las cifras de la cabecera y del «Después:» salen de un arnés que copia las clases, no del componente montado. *(La medición en la app real se hizo después, con la sesión de Fede: ver la «Cuarta ronda» de §18.)*
- La medición a 375 px y la sonda con `elementFromPoint` sobre «Después:» quedaron a medias: el panel cambió de página mientras medía.
- Segunda máquina y soak de recursos: NOT RUN. Safari o iPhone real, modo oscuro, el popover de «Avisos» y producción: NOT RUN.
- CA-5 (la tarjeta del lead pinta el origen tal cual se guardó) sigue sin prueba de render.
- La aprobación de entrega la decide Fede.

## 18. Delta de implementación (lo rellena el agente al entregar)
**2026-11-21 · Estado: En curso (implementado y medido en la app real; cinco revisiones de gate, todas con objeciones y `gate.mjs` en PASS; sin aprobación de entrega).** Rama `sdd/ux-legibilidad-20261118`, desde `origin/main`, subida a origin; PR #161 en borrador (el estado y los commits actuales están en el PR).

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

**Segunda ronda tras los gates (2026-11-18, mismo día)**
Hecho a petición de Fede («Sí, corrige») sobre el informe de la «Segunda revisión» y el de la «Revisión independiente adicional». Cada prueba nueva se vio fallar antes del código; las dos mutaciones de `planIsMark` ahora las atrapan 3 pruebas.
- **«Después:» a 44 px:** `before:-inset-y-3` → `before:-inset-y-4`. Medido a 360 y 375 px: el área táctil invisible mide 47,5 px (antes 39,5); las migas, 44 px; el bloque `FlowStrip`, 80 px.
- **Cabecera a 360 px:** con el contador real (14) y la etiqueta corta, la página medía 362 px en una ventana de 360. Ahora: `px-2.5` por debajo de 400 px, «Menú» `-mr-2`, y la etiqueta corta de «Avisos» capada a «9+» (`src/lib/notices-label.ts`, con prueba). Medido: 360 px → documento 360 (el borde de «Menú» queda justo en el borde de la pantalla, sin holgura); 375 px → documento 375, «Menú» termina en 373. **Cambio visible:** por debajo de `sm`, «Avisos · 14» pasa a «Avisos · 9+» (como la insignia de «Sugerencias» de la barra inferior); desde `sm` y el `aria-label` siguen con el número real.
- **`ScrollFade`:** observa también su contenido, no solo su caja (la tabla puede crecer después de montar), y centra el trimestre actual solo por debajo de 768 px; a 1106 px el centrado tapaba el inicio del primer trimestre. Pruebas nuevas: `scroll-fade.test.tsx` (desmontaje, sin `ResizeObserver`, sin desborde, ancho y estrecho).
- **CA-7b «sin plan»:** pruebas nuevas en `quarter-kpis-panel.layout.test.tsx` y `src/components/metrics/plan-is-mark.test.ts`.
- **CA-4:** prueba de render del panel (`lead-funnel-panel-source.test.tsx`: tres grafías, una fila) y guardia más estricta (`leads.index.tsx` no llama a `funnelBy(`). Se eliminó la regla de «mayúscula» del desempate, que era código muerto, y se documenta el criterio real.
- **`normalizeLeadSource`:** descarta caracteres de ancho cero (U+200B a U+200D, U+2060, U+FEFF); un «sin origen» literal en minúscula ya no sustituye la etiqueta «Sin origen».
- **CA-9:** las pruebas de `touch-targets.test.tsx` exigen también `md:min-h-0` y `md:before:hidden`.
- **SDD:** corregidos §5 (lista de componentes), §6 (centrado), CA-4 (desempate), CA-8 (mecanismo) y U-4/U-6 de §13.
- **Sin resolver:** cabecera a 320 px (sigue desbordando); decisión de Fede sobre `Button size="sm"`; CA-5 sin prueba de render de la tarjeta del lead; `box-shadow` en celdas fijas con `border-collapse: collapse` en Safari, modo oscuro en móvil y Safari real, sin comprobar.

**Tercera ronda tras los gates (2026-11-19)**
Hecho a petición de Fede («Sí, corrige») sobre la «Cuarta revisión independiente» (`2f431418`; `gate.mjs`: PASS).
- **Hallazgo 1 (cableado de «Avisos»):** nueva prueba de render `src/components/notification-center.test.tsx` (14 avisos: «Avisos · 9+» bajo `sm`, «Avisos · 14» desde `sm` y `aria-label` con «14 sin leer»; con trabajos en marcha; con pocos avisos; sin nada). Las dos mutaciones que sobrevivían (ignorar `noticeLabels`, tope en el `aria-label`) ahora las atrapan 2 pruebas cada una.
- **Hallazgo 2 (casos límite de `ScrollFade`):** pruebas de `matchMedia` ausente, `matchMedia` que lanza y desborde sin `data-current`. `ScrollFade` ya no depende de que `matchMedia` exista: lo llama dentro de `try`, y ante un fallo se comporta como en pantalla estrecha. La mutación que quita `if (cur)` ahora falla una prueba.
- **Texto del SDD alineado con el código:** nombre de la prueba de cabecera (`-route-header.test.ts`), U-5 de §13 (`h-11` y `h-[3.25rem]`), el cambio «Avisos · 9+» en §6 y §9, CA-7d (borde derecho y sombra a la izquierda), el caso de 320 px y de `ScrollFade` en §8, y la primera línea de esta sección. El cuerpo del PR #161 se actualizó con los números de esta ronda. *(Corrección del 2026-11-21: esta ronda quedó sin commit en otro checkout y el cuerpo del PR no se llegó a actualizar; se subió el 2026-11-21 en `4a1c9373`, ver la «Cuarta ronda».)*
- **Prueba de `FlowStrip`:** se renombró para decir lo que mide (los enlaces de las migas miden 44 px y el `li` no lleva `min-height`); las filas sí crecen a 44 px por el enlace, como ya constaba.
- **Sigue abierto (no pedido en esta ronda):** hallazgos 3 y 4 del gate (si el área táctil de «Después:» le quita toques a las migas, y si «Editar líneas» hace crecer su línea a 44 px; ninguno medido); hallazgo 5 (la prueba de cabecera corta el código fuente por posiciones fijas; «Menú» queda a 2 px del borde a 360 px); hallazgo 6 (`ScrollFade` solo centra al montar, ahora documentado); CA-5 sin prueba de render de la tarjeta del lead; cabecera a 320 px; `Button size="sm"` (decisión de Fede); Safari, modo oscuro en móvil y la geometría, que ningún gate reprodujo.

**Cuarta ronda (2026-11-21)**
Hecho a petición de Fede: medir en la app real con su sesión, corregir «Cerrar» a 360 px («Corrígelo») e incorporar la «Tercera ronda» del 2026-11-19, que estaba sin commit en otro checkout («Incorporarla»).
- **Commits:** `5ecbcf6a` (arreglo de «Cerrar»), `4a1c9373` (la «Tercera ronda» del 19-nov, aplicada tal cual) y el de esta actualización del SDD.
- **«Cerrar» a 360 px (hallazgo 1 de la «Quinta revisión», confirmado en la app real):** con el menú abierto y «Avisos · 9+», el documento medía 366 px en una ventana de 360 y «Cerrar» se leía cortado («Cerra|»); la caja acababa en 365,5 px. «Cerrar» es ~5 px más ancho que «Menú» y la barra no tenía holgura. Recortar márgenes no daba margen sin bajar de los 8 px entre textos de CA-10, y reducir el logo incumple su mínimo de 140 px (`brand.tsx`). Arreglo: por debajo de 400 px y solo con el menú abierto, «Buscar» se oculta (`hidden min-[400px]:flex`) y «Avisos» toma el margen automático para que las acciones sigan a la derecha; al cerrar el menú vuelve todo. ⌘K sigue abriendo la búsqueda. Prueba nueva en `-route-header.test.ts` (una añadida; las existentes sin tocar).
- **Medido tras el arreglo** (app real, sesión de Fede, solo lectura): a 360 px, documento 360 con el menú cerrado y abierto; «Cerrar» acaba en 358 y «Menú» en 360,1; Avisos y Cerrar a 44 px. A 412 px no cambia nada («Buscar» sigue visible con el menú abierto).

**Mediciones en la app real** (`localhost:5174` sobre `2f431418`, sesión de Fede, pestaña aparte, solo lectura, 2026-11-21)
| CA | Medida | Resultado |
|---|---|---|
| CA-8 | Área táctil de «Después:» a 360 y 375 px | 47,5 px (`::before`); caja del enlace 15,5 px |
| CA-8 | Migas (Cuentas, Pipeline, Métricas), «Tablero/Listado», «Buscar», «Avisos», «Menú» a 375 px | 44 px |
| CA-10 | Cabecera a 360 px, menú cerrado, «Avisos · 9+» | Documento 360; «Menú» termina en 360,1 |
| CA-10 | Cabecera a 360 px, menú abierto | **Antes del arreglo: documento 366, «Cerrar» cortado.** Después: documento 360 |
| CA-10 | Cabecera a 375 px, menú cerrado y abierto, modo oscuro | Documento 375; 8 px entre textos |
| CA-4 | «Conversión por origen» con datos reales («Manual» y «manual») | Una fila «Manual» con 2 leads |
| CA-5 | Tarjetas de los leads | Muestran el origen tal como se guardó |
| — | Desborde lateral de Leads, Cuentas y Métricas a 360 px | Ninguno (documento = ventana) |
| CA-6, CA-7c, CA-7d | Tabla de KPIs trimestrales | **No medido:** sin datos para que aparezca la tabla; no se crearon datos |

**Fuera del alcance, sin cambios respecto a la base:** botones de tamaño normal a 40 px («+ Nuevo lead», «Importar CSV», «Reparto»), interruptores a 20 px («Por puntuación», «Solo retrasados»), enlaces en línea de texto en Métricas (15–19 px). En escritorio, el tablero de Pipeline de leads se desplaza en horizontal sin señal de que hay más columnas (la de SQL queda cortada a 1010 px).

**Verificación:** 445 archivos, 6.436 pruebas en verde con las tres piezas juntas; `tsc` limpio; ESLint sin errores; prettier limpio en los archivos de `src` tocados.

**Sigue abierto:** gate sobre el commit final (ninguna revisión independiente ha visto `5ecbcf6a` ni `4a1c9373`); hallazgos 3 y 4 de la «Cuarta revisión» (solape del área de «Después:» con las migas, altura de «Editar líneas»); `ScrollFade` solo centra al montar; CA-5 sin prueba de render; cabecera a 320 px; `Button size="sm"` (decisión de Fede); geometría de la tabla trimestral con datos, Safari real.
