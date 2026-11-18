# SDD-20261118-ux-legibilidad-pantallas-diarias · [Mejora] Legibilidad y objetivos táctiles en Leads, Cuentas y Métricas

**Tipo:** Mejora · **Prioridad propuesta:** Media
**Estado:** En curso, implementado el 2026-11-18 (aprobado por Fede ese día con las decisiones D-1 a D-4 tal como se recomendaron; sin revisión del gate ni aprobación de entrega; ver sección 18) · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-11-18
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
- **CA-10** «Buscar» no se sale de su caja (`min-w-11 px-2` en vez de `size-11`) y entre «Buscar», «Avisos» y «Menú» hay al menos 12 px a 375 px; ninguno queda truncado. · prueba: `src/routes/_authenticated/route.header.test.tsx` (clases) + medición en navegador a 375 px

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
- U-6: sustituir `size-11` por `min-w-11 px-2` en el botón «Buscar» y fijar `gap-3` sin el salto de `min-[400px]`; comprobar que a 375 px caben logo, «Buscar», «Avisos» y «Menú».

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
- Veredicto del gate: No revisado
- CA sin prueba posible o sin G-n: CA-6, CA-7c y las mediciones de CA-8 y CA-10 se prueban en navegador, no en jsdom. No hay G-n (no hay PRD).
- [Por verificar] que sigue sin comprobarse: ver sección 16.
- Contradicciones con el código o con decisiones previas: la propuesta original de colapsar «Sin dato» chocaba con NK-0106 y se retiró (sección 3).
- Lo que esta revisión NO demuestra: que el SDD esté libre de objeciones; el gate aún no lo ha leído.

## 18. Delta de implementación (lo rellena el agente al entregar)
**2026-11-18 · Estado: En curso (implementado y medido; sin revisión del gate ni aprobación de entrega).** Rama local `sdd/ux-legibilidad-20261118`, desde `origin/main`; sin commit ni push.

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
| CA-10 | «Buscar», «Avisos», «Menú» a 375 px | 44 px de alto; separación 12 y 12 px; «Avisos» sin recorte |
| CA-8 | Enlaces de `FlowStrip`, «Editar líneas», «Avisos», «Buscar» y secciones de Métricas a 375 px | 44 px (antes 16–32) |
| CA-8 | Elementos interactivos bajo 44 px en `main`, cabecera y navegación a 375 px | Métricas 30 → 16, Leads 15 → 8 (no es la misma consulta que en el pase inicial: ahora se acota a `main`, cabecera y navegación) |
| CA-5 / CA-4 | «Conversión por origen» con datos reales | Una fila «Manual» con 2 leads |

**Lo que sigue bajo 44 px y no estaba en el alcance:** botones de tamaño normal (40 px) como «+ Nuevo lead» y «+ Nueva cuenta»; «Inicio» de la barra inferior (41 px); el selector de trimestre (40 px); enlaces en línea de texto («CAC real», «Define cuotas», 16 px); los «ACCIONES» y las casillas de las tarjetas de Cuentas y Leads (16 px); los interruptores (20 px).

**Sin comprobar:** modo oscuro en móvil tras los cambios; Safari en iPhone real; el efecto de `Button sm` y `TabsTrigger` más altos en pantallas distintas de Leads, Cuentas y Métricas (por ejemplo, el popover de «Avisos» usa `TabsTrigger`).
