# SDD-20261031-ux-palette-graphite · [Mejora] Nueva paleta «Grafito e índigo»

**Tipo:** Mejora · **Prioridad propuesta:** Media (decisión de diseño de Fede, sin dato de uso detrás)
**Estado:** Borrador (valores de §6 aprobados por Fede el 2026-10-31; decisiones de §15 cerradas el 2026-10-31; falta el gate técnico) · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-10-31
**PRD:** No aplica (mejora acotada; contexto en `docs/UX-INFORME-20261031.md`) · **Depende de:** — (va **antes** que `SDD-20261031-ux-legibility-contrast`, ver §14) · **Ticket:** por asignar
**Base de trabajo:** `origin/main` (decidido por Fede el 2026-10-31). Este SDD se leyó sobre `feat/software-factory`: **[Por verificar]** que `src/styles.css` y los archivos citados coincidan en `origin/main`.

> Un SDD dice cómo se verifica que está bien hecho. Cada criterio de aceptación (CA-n) debe poder tener una prueba automática que lo nombre.
> Al no haber PRD, los objetivos G-n se definen en §4 y cada CA cita el suyo. Los CA que no admiten prueba automática lo dicen en su línea como **manual** y se listan en §16.

## 1. Resumen
Fede no está a gusto con la paleta actual («Ink + Lima»). El 2026-10-31 eligió, entre tres direcciones, **Grafito e índigo**: neutros fríos y un único acento índigo en lugar del lima, en tema claro y oscuro. Este SDD cambia los valores de color del sistema de diseño y los colores escritos a mano fuera de él (correos, página de error, color del navegador, favicon), sin tocar la estructura, el texto ni las funciones. De paso deja el contraste del texto y de los estados por encima de 4,5:1.

## 2. Problema y para quién
A Fede no le gusta la paleta. Además, el gris secundario no llega a 4,5:1 de contraste (medido: 3,05:1 en claro y 3,99:1 en oscuro), y los estados «Sano», «Atención» y «En riesgo» quedan por debajo de 4,5:1 en claro (entre 4,26:1 y 4,42:1). Afecta a todas las personas que usan Nokko.

## 3. Evidencia y por qué ahora
Leído el 2026-10-31 en `seller-strategy-studio` (`feat/software-factory`; las líneas pueden moverse). **No se ha visto la paleta aplicada en la app** (solo una maqueta) y **no hay datos de uso ni de percepción de marca**.
- Los colores viven en `src/styles.css`: tema claro `:root` (`--paper #fafaf7`, `--ink #0f1115`, `--ink-mid #5b5f6a`, `--ink-faint #868a94`, `--lime #c6f432`, `--blue #2b59ff` como señal, enfoque y enlace, estados `#13804b`/`#a35f00`/`#d92d20`, serie de gráficos `--series-1…5`) y `.dark` (`--paper #0f1115`, `--ink-faint #737985`…). Los estilos de pantallas usan clases semánticas, no colores a mano (regla de `AGENTS.md`).
- Lima: aparece como valor en `src/styles.css` (18 líneas con «c6f432» o «lime», sin distinguir mayúsculas; búsqueda del 2026-10-31) y en siete archivos de pantalla (`cycle.tsx` 6, `guide-card.tsx` 3, `swipe-deck.tsx` 2, `route.tsx` 1, `products.tsx` 1, `metrics.tsx` 1, `won-deals-panel.tsx` 1) y en `field-help-data.ts` (3) y `bmad/phases.ts` (2); **[Por verificar]** cuáles de esas son el color y cuáles son otra cosa (por ejemplo la palabra «lime» en texto). La barra lateral usa lima para el elemento activo (`route.tsx:101`, `data-[status=active]:bg-lime`).
- Colores escritos a mano fuera del sistema (comprobado con búsqueda de códigos hexadecimales en `src/`): `src/components/theme-toggle.tsx`, `src/routes/__root.tsx` (color del navegador `#fafaf7` y `#0f1115`), `src/lib/error-page.ts`, `src/lib/email.server.ts`, `src/lib/daily-email.ts`. Además `public/manifest.webmanifest` (`background_color` y `theme_color` `#fafaf7`) y `public/favicon.svg` (leído: fondo `#0f1115`, tres barras blancas y una curva lima `#c6f432`) y los tres iconos PNG de `public/manifest.webmanifest` (**[Por verificar]** que tengan también la curva lima: no se han abierto).
- Contrastes medidos el 2026-10-31 con la fórmula WCAG (script propio; no hay archivo de evidencia en el repo): la paleta actual da, como mínimo sobre los tres fondos, texto principal 16,7:1 / 15,7:1, gris medio 5,6:1 / 7,3:1, gris tenue 3,05:1 / 3,99:1 (claro / oscuro). La propuesta Grafito da 15,2:1 / 15,3:1, 6,8:1 / 8,0:1, 4,56:1 / 5,50:1, y estados entre 4,51:1 y 10,4:1.
- Opciones descartadas por Fede: «Crema y cobre» y «Bosque».
- Líneas base: preferencia por la paleta, tiempo de lectura o errores por contraste: **sin dato**.

## 4. Resultado buscado
- **G-1** Nokko usa la paleta Grafito e índigo en claro y oscuro, en pantallas, correos, página de error y color del navegador.
- **G-2** El texto y los estados cumplen 4,5:1 de contraste (WCAG AA) sobre los fondos del sistema, y los elementos gráficos significativos 3:1.
- **G-3** No cambia ninguna función, texto ni estructura.
- Métrica de éxito: sin métrica de uso (**sin dato** de partida; no se estima ninguna). Medible por código: contrastes ≥ 4,5:1 en las combinaciones de CA-2; referencias al lima antiguo = 0 en pantallas y correos.

## 5. Alcance
**Incluye:**
- Los valores de color del sistema de diseño en claro y oscuro (tabla de §6).
- Sustituir el lima de marca por el índigo en barra lateral, mazo de tarjetas, tarjeta de guía, ciclo y demás usos.
- Colores de las series de los gráficos acordes a la paleta (propuesta de Dani, §15 · 2).
- Colores de la página de error, correos (transaccional y diario), color del navegador, manifiesto, favicon y los tres iconos PNG de la app instalada (`icon-192.png`, `icon-512.png`, `icon-maskable-512.png`; la curva del logotipo pasa del lima al índigo).
- Los estados de interacción (al pasar el cursor, pulsado, deshabilitado, seleccionado) y el botón destructivo (texto sobre el rojo), que se derivan de los mismos valores.
- Una prueba que fije los valores y los contrastes, y que impida colores escritos a mano fuera de una lista de excepciones.

**No incluye:**
- Cambiar tipografías, tamaños, esquinas, espaciados ni la estructura de pantallas.
- Cambiar textos de producto.
- Texto mínimo de 12 px, selectores y piezas compartidas (SDD `ux-legibility-contrast`).
- Renombrar variables o clases (por ejemplo `lime`): lo decide Dani; el nombre no es un requisito.
- Logotipo, web pública y materiales fuera de la app (Fede los decide aparte).
- Contraste de bordes de campos de formulario (§16).
- Iconos.

## 6. Cambios de comportamiento (delta)
**Añadido:** una prueba de valores y contrastes de la paleta.
**Modificado:** los valores de color antes → después (propuesta de Fede, a aprobar; contrastes medidos el 2026-10-31):

| Elemento | Claro antes → después | Oscuro antes → después |
|---|---|---|
| Fondo (`paper`) | `#fafaf7` → `#f6f6f4` | `#0f1115` → `#101216` |
| Tarjeta (`paper-raised`) | `#ffffff` → `#ffffff` | `#171a20` → `#171a20` |
| Fondo hundido (`paper-sunk`) | `#f1f1ec` → `#ebebe7` | `#0a0c0f` → `#0b0c0f` |
| Texto (`ink`) | `#0f1115` → `#14161a` | `#f2f3f5` → `#eef0f3` |
| Texto medio (`ink-mid`) | `#5b5f6a` → `#4b5058` | `#a3a8b3` → `#aab0bb` |
| Texto tenue (`ink-faint`) | `#868a94` → `#646a74` | `#737985` → `#8b919c` |
| Línea fina (`hairline`) | `#e4e4de` → `#dddcd6` | `#262a32` → `#272b33` |
| Acento de marca | lima `#c6f432` → índigo `#3b45d6` (texto sobre él `#ffffff`) | lima `#c6f432` → índigo claro `#8e97ff` (texto sobre él `#101216`) |
| Enlace y enfoque (propuesta: mismo valor que el acento, §15 · 1) | `#2b59ff` → `#3b45d6` | `#6ea0ff` → `#8e97ff` |
| Fondo suave del acento (elemento activo del menú lateral, selección; texto de tinta encima) | lima suave `#eefbc4` → `#e8eaff` (tinta encima: 15,22:1) | `#26300b` → `#232852` (tinta encima: 12,29:1) |
| Series de gráficos 1 a 5 (propuesta, §15 · 2; contraste mínimo sobre los tres fondos) | `#14161a`, `#3b45d6`, `#0e7490`, `#c2410c`, `#7a7f89` (15,15 / 5,84 / 4,48 / 4,33 / 3,36) | `#eef0f3`, `#8e97ff`, `#22d3ee`, `#fb923c`, `#8b919c` (15,26 / 6,66 / 9,64 / 7,70 / 5,50) |
| Favicon e iconos de la app instalada (192, 512 y «maskable») | curva lima `#c6f432` → índigo `#8e97ff` sobre el fondo oscuro `#0f1115` actual | — |
| Estado sano | `#13804b` → `#0f7a46` | `#4ade80` → `#4ade80` |
| Estado atención | `#a35f00` → `#8f5200` | `#fbbf24` → `#fbbf24` |
| Estado en riesgo | `#d92d20` → `#c4261b` | `#f87171` → `#f87171` |

**Eliminado:** el color lima como acento de marca.

## 7. Historias y criterios de aceptación
### H-1: Como miembro de una empresa, quiero una paleta que se vea bien y se lea sin esfuerzo, en claro y en oscuro.
- **CA-1** El sistema DEBE usar, en tema claro y oscuro, los valores de color de §6 (los aprobados por Fede) para fondos, textos, líneas, acento y estados · cubre G-1 · prueba: `src/lib/palette.test.ts`
- **CA-2** El sistema DEBE dar un contraste ≥ 4,5:1 a texto principal, texto medio, texto tenue, enlaces y estados sobre los tres fondos (`paper`, `paper-raised`, `paper-sunk`), y al texto de los botones sobre el acento, en claro y oscuro · cubre G-2 · prueba: `src/lib/palette.test.ts` (función pura de contraste sobre los valores del sistema)
- **CA-3** El sistema DEBE dar un contraste ≥ 3:1 al acento sobre `paper` y `paper-raised` (anillo de enfoque, barra lateral activa) en claro y oscuro · cubre G-2 · prueba: `src/lib/palette.test.ts`
- **CA-4** El sistema DEBE mostrar el índigo como acento de marca y DEBE dejar de usar el lima antiguo en pantallas, menú lateral, tarjetas y gráficos, sea cual sea la forma de escribirlo (hexadecimal, `rgb`, `hsl`, `oklch` o clases de color) · cubre G-1 · prueba: `src/lib/palette.test.ts` (búsqueda del valor antiguo en todas sus formas fuera de la lista de excepciones) y comprobación **manual** en U-3
- **CA-5** El sistema DEBE mostrar los gráficos con series de contraste ≥ 3:1 sobre los tres fondos y con una distancia mínima de color entre series (que fija Dani y comprueba con una simulación de daltonismo), en claro y oscuro · cubre G-2 · prueba: `src/lib/palette.test.ts` (valores, contraste y distancia entre series; valores de partida en §6, ajustables por Dani con OK de Fede)
- **CA-6** El sistema DEBE usar la paleta nueva en la página de error, en los correos, en el color del navegador y en el manifiesto de la app, y NO DEBE dejar en ellos los valores antiguos · cubre G-1 · prueba: `src/lib/palette.test.ts`
- **CA-7** El sistema DEBE definir todos los colores de pantallas y componentes en el sistema de diseño (no escritos a mano como hexadecimal, `rgb`, `hsl`, `oklch` ni como clases de color por escala), con una lista cerrada de excepciones (correos, página de error, color del navegador, manifiesto, favicon), cada una con su motivo · cubre G-1 · prueba: `src/lib/palette.test.ts`

### H-2: Regresión
- **CA-8** El sistema DEBE conservar estructura, textos, tamaños y funciones; solo cambian los colores · cubre G-3 · prueba: pruebas existentes (`src/lib/headlines.test.ts`, `src/lib/nav.test.ts`) siguen pasando; **hueco declarado:** no hay prueba automática de aspecto, se cubre con la comprobación manual de U-3 a 375 y 1440 px
- **CA-9** El sistema DEBE seguir recordando y aplicando la elección de tema (claro, oscuro, del sistema) sin parpadeo al cargar · cubre G-3 · prueba: **manual** en U-3 (hoy se aplica con un script en la carga de `src/routes/__root.tsx`; **[Por verificar]** si hay prueba)

## 8. Casos límite y errores
- Tema oscuro: toda comprobación de contraste se hace también en oscuro (CA-2, CA-3, CA-5).
- Correos: muchos clientes de correo no admiten tema oscuro ni variables; los colores van fijos (CA-6) y se prueban en claro.
- Estados «En riesgo» y similares: siguen siendo palabra con filete, nunca solo color (no cambia).
- Color del navegador en móvil con tema del sistema (CA-6).
- Alto contraste y daltonismo: no se prueban en este SDD (§16).
- Elementos que usan el azul de señal y el acento a la vez (§15 · 1): si se unifican, dos elementos que hoy se distinguen por color pasan a distinguirse por otra cosa (peso o subrayado) o a ser el mismo.

## 9. Experiencia y copy
- No cambia ningún texto. Sin iconos.
- Maqueta de referencia: la comparativa «Grafito e índigo» del 2026-10-31 (tarjetas, estados, botones, muestras de color); **no es una captura de la app**.

## 10. Datos, permisos y privacidad
Sin tablas, columnas ni permisos. Ningún dato de clientes en pruebas ni capturas: datos ficticios.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| ninguna | — | — | — |

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | Valores del sistema (lista de §6) en claro y oscuro, y prueba de valores y contrastes | CA-1, CA-2, CA-3 | `src/lib/palette.test.ts` (bloque de valores y contrastes) |
| U-2 | Acento índigo en lugar del lima en pantallas; series de gráficos; lista de excepciones de colores a mano | CA-4, CA-5, CA-7 | `src/lib/palette.test.ts` (bloque de lima, series y colores a mano) |
| U-3 | Correos, página de error, color del navegador, manifiesto, favicon e iconos PNG; comprobación visual a 375 y 1440 px, claro y oscuro | CA-6, CA-8, CA-9 | `src/lib/palette.test.ts` (bloque de correos y metadatos) |

Orden: U-1 → U-2 → U-3. Cada bloque de la prueba se añade en la unidad que lo cierra, para que la integración continua no quede en rojo entre unidades.

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- Los valores están centralizados en `src/styles.css` (claro `:root`, oscuro `.dark`), y las pantallas usan clases semánticas; el cambio principal es de valores, no de pantallas.
- La prueba de contraste puede ser una función pura sobre los valores leídos de ese archivo, como se hizo para medir (fórmula WCAG).
- Los usos del lima en `cycle.tsx`, `guide-card.tsx`, `swipe-deck.tsx`, `products.tsx`, `metrics.tsx`, `won-deals-panel.tsx` y `route.tsx` hay que revisarlos uno a uno antes de cambiarlos (algunos pueden ser texto y no color).
- La variable que hoy se llama `lime` seguirá existiendo mientras no se renombre; renombrarla es opcional y de Dani.
- Correos y página de error escriben colores fijos en código de servidor (`src/lib/email.server.ts`, `src/lib/daily-email.ts`, `src/lib/error-page.ts`); no leen las variables de la hoja de estilos.

## 14. Riesgos y dependencias
- **Orden con `SDD-20261031-ux-legibility-contrast`:** este SDD va primero; el nuevo gris tenue (`#646a74` / `#8b919c`) sale de aquí y la U-1 de aquel SDD se reduce a comprobarlo.
- **Conflictos:** `src/styles.css` y varias pantallas se tocan también en otros SDD (`ux-legibility-contrast`, `ux-move-without-drag`); entregar este primero reduce los conflictos.
- Una paleta nueva cambia capturas, materiales y la coherencia con la web pública si esta usa el lima; fuera de alcance, pero Fede lo valora (§15 · 3).
- La paleta se ha visto solo en maqueta: puede no gustar aplicada a pantallas densas (Métricas, tablas). Mitigación: revisión visual en U-3 antes de aprobar la entrega.
- El índigo del acento y el azul de señal actual son parecidos: si conviven, se confunden (§15 · 1).

## 15. Preguntas para Fede y para la revisión técnica
1. ~~Azul de señal e índigo~~ **Decidido por Fede (2026-10-31): se unifican en un único acento índigo**; el enlace y el enfoque usan el valor del acento (`#3b45d6` claro, `#8e97ff` oscuro).
2. ~~Series de gráficos~~ **Decidido por Fede (2026-10-31): Dani propone el juego final de series y Fede lo aprueba mirando Métricas**; las de §6 son el punto de partida.
3. ~~Marca fuera de la app~~ **Decidido por Fede (2026-10-31): solo favicon e iconos de la app instalada entran en este SDD**; logotipo, web pública y materiales van aparte.
4. ~~Elemento activo del menú lateral~~ **Decidido por Fede (2026-10-31): fondo suave de índigo** (`#e8eaff` claro, `#232852` oscuro) con texto de tinta.
5. Para el gate: ¿la prueba de «ningún color a mano» es aceptable como búsqueda estática con lista de excepciones? **Propuesta aceptada por Fede (2026-10-31, respuesta «Sí» a un mensaje que la planteaba junto a la pregunta 2)**; el gate la valida.
6. ~~¿Aprobar los valores de §6?~~ **Aprobados por Fede el 2026-10-31, tal cual** (incluidas las series de partida de §6). Un ajuste posterior tras verlos aplicados en U-3 es un cambio aparte. Aviso: algunos pares tienen poco margen (estado «Sano» 4,51:1 y gris tenue 4,56:1 sobre el fondo hundido en claro, ambos sobre el mínimo de 4,5:1); cualquier retoque puede romperlos.
7. ~~Iconos PNG e imagen social~~ **Decidido por Fede (2026-10-31): los tres iconos PNG y el favicon se rehacen aquí; no existe imagen para redes sociales** (dicho por Fede; no comprobado en el código, ver §16).

## 16. Pendiente de verificar
- Paleta aplicada en la app real (claro y oscuro, 375 y 1440 px): no hecho.
- Contraste de bordes de campos de formulario (`--input` usa la línea firme `#c9cac3`, que parece muy clara sobre el fondo; WCAG 1.4.11 pide 3:1 para componentes): sin medir; posible SDD aparte.
- Colores de los iconos PNG de la app instalada (no abiertos), imagen para redes sociales (Fede dice que no existe; **[Por verificar]** que no haya una etiqueta de vista previa en las páginas públicas), y qué usos del lima son color y cuáles son texto.
- Texto sobre el botón destructivo (blanco sobre `#c4261b`): sin medir; lo mide el test de U-1.
- Alto contraste y daltonismo: sin pruebas.
- Prueba existente del arranque del tema (CA-9).
- Que `origin/main` coincida con los archivos leídos.
- Guía de voz y kit de marca de Nokko: no revisados.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
- Veredicto del gate: No revisado
- CA sin prueba posible o sin G-n: no revisado
- [Por verificar] que sigue sin comprobarse: ver §16
- Contradicciones con el código o con decisiones previas: no revisado
- Lo que esta revisión NO demuestra: todo; aún no hay revisión del gate ni auditoría independiente de este SDD.

## 18. Delta de implementación (lo rellena el agente al entregar)
Pendiente.

---
Validación: pendiente. Auditoría 2026-10-31: linter con falsos positivos de formato (corregidos los reales) y auditoría independiente ronda 1 «Bloqueado» por decisiones de Fede (enlace, fondo del menú, aprobación de la tabla); un revisor sin contexto recalculó los contrastes de la tabla y coinciden con los de §3. Se añadieron valores concretos para enlace, fondo suave, series e iconos. Sin segunda ronda ni gate.
