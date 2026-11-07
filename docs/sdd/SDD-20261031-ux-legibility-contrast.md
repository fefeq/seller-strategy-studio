# SDD-20261031-ux-legibility-contrast · [Mejora] Legibilidad, contraste y piezas compartidas

**Tipo:** Mejora · **Prioridad propuesta:** Alta
**Estado:** Borrador · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-10-31
**PRD:** No aplica (mejora acotada; contexto en `docs/UX-INFORME-20261031.md`) · **Depende de:** — (el SDD `ux-move-without-drag` se integra después de este, ver §14) · **Ticket:** por asignar
**Base de trabajo:** `origin/main` (decidido por Fede el 2026-10-31). Este SDD se leyó sobre `feat/software-factory`, que puede estar desfasada: **[Por verificar]** que los recuentos (83 usos de texto pequeño, 25 selectores, copias de `Kpi`/`Panel`) coincidan en `origin/main`.

> Un SDD dice cómo se verifica que está bien hecho. Cada criterio de aceptación (CA-n) debe poder tener una prueba automática que lo nombre.
> Al no haber PRD, los objetivos G-n se definen en §4 y cada CA cita el suyo.

## 1. Resumen
Hoy la información más útil de las pantallas (retrasos, «enfriado», origen, seguimiento) sale en texto de 10-11 px y en gris claro de contraste dudoso. Además, tarjetas de cifras, paneles y selectores están copiados con pequeñas diferencias entre pantallas. Esta mejora fija un tamaño mínimo y un contraste mínimo para el texto con significado, y deja una sola pieza compartida para cada patrón repetido. No cambia ninguna función ni ningún dato.

## 2. Problema y para quién
Cualquier miembro de una empresa que usa Nokko a diario tiene que forzar la vista (hipótesis de Fede, sin dato: se nota más en móvil y con poca luz) para leer lo que más importa. Las pantallas se ven casi iguales, pero no del todo (`p-5` en una, `px-4 py-3` en otra; `text-4xl` frente a `text-2xl` en la misma cifra), lo que resta coherencia y encarece cada cambio de diseño.

## 3. Evidencia y por qué ahora
Leído el 2026-10-31 en `seller-strategy-studio` (rama `feat/software-factory`; las líneas pueden moverse). Todo es lectura de código; **no se ha abierto la app en vivo** (exige sesión) y **no hay datos de uso**.
- Texto de 10 y 11 px (`text-[10px]`, `text-[11px]`): 83 usos en 42 archivos de `src/` en el checkout leído (36 y 47) y **87 usos en 43 archivos en `origin/main`** (comprobado con `git grep` el 2026-10-31); el recuento exacto lo fija el test de U-4. Los más cargados: `src/components/strategy/motions.tsx` (7), `segment-coverage.tsx` (5), `budget-quarters.tsx` (5). Ejemplos con significado: «Enfriado: N días sin actividad» en `deals.tsx:105`, retraso y fecha de seguimiento en `leads.index.tsx:194-195`.
- Colores secundarios en `src/styles.css`: `--ink-faint` es `#868a94` sobre `--paper` `#fafaf7` en claro (`:124`, `:117`) y `#737985` sobre `#0f1115` en oscuro (`:195`, `:188`). Con la fórmula de contraste WCAG a mano salen ≈3,3:1 en claro y ≈4,3:1 en oscuro. **[Por verificar]** con una herramienta; el primer test de U-1 lo mide.
- `ink-faint` se usa también en clases de pantallas (`text-ink-faint`, por ejemplo en el buscador de `route.tsx:193`). **[Por verificar]** el recuento exacto de usos con significado frente a decorativos.
- Selectores: `Pick` (`src/components/fields.tsx:8`) ya es un `<select>` nativo con el estilo del sistema (altura 40 px en móvil, 36 en escritorio). Hay otros 25 `<select>` sueltos (26 contando el de `Pick`), repartidos en 16 archivos (`leads.index.tsx:147`, `deals.tsx:231`, `team.tsx`, `integrations.tsx`, `people.tsx`…). El `Select` de la librería de interfaz (`src/components/ui/select.tsx`) solo se usa en una pantalla (`accounts.$id.tsx`, comprobado el 2026-10-31); los 26 `<select>` y los 16 archivos coinciden en el checkout y en `origin/main`, y hay 11 definiciones locales de `Kpi`/`Stat`/`Panel` en ambos, con alturas y bordes propios (p. ej. `h-8 rounded border … text-xs` frente a `h-10 rounded-md border … text-base`).
- Piezas copiadas: `Kpi` en `deals.tsx`, `metrics.tsx`, `leads.index.tsx`, `budget-quarters.tsx`, `self-service-funnel.tsx`, `metrics/finance-panel.tsx`; `Stat` en `home.tsx` y `pipeline-board-panel.tsx`; `Panel` en `home.tsx`, `metrics.tsx`, `leads.index.tsx`. Solo `Empty` y `HealthDot` están compartidos en `src/components/page.tsx`.
- Tamaños de cifra: `home.tsx:113` y `deals.tsx:124` usan `font-display text-4xl` con `p-5`; `leads.index.tsx:259` usa `text-2xl` con `px-4 py-3` y añade `hint`.
- El diseño de Nokko evita los iconos (plantilla `docs/factory/templates/sdd.md`, §9: «sin iconos, estados con palabra»); este SDD no los introduce.
- Líneas base de uso (qué pantallas se abren más, cuánta gente usa modo oscuro, dispositivos): **sin dato**.

## 4. Resultado buscado
- **G-1** Todo texto con significado se lee sin esfuerzo: tamaño y contraste por encima del mínimo, en claro y en oscuro.
- **G-2** Un solo aspecto para los selectores, y una sola pieza para tarjeta de cifra y para panel.
- **G-3** Nada cambia de función ni de datos.
- Métrica de éxito: ninguna de uso (**sin dato** de partida; no se estima ninguna). Medible por código: recuento de `text-[10px]`/`text-[11px]` con significado = 0; `<select>` fuera del componente compartido = 0; definiciones locales de `Kpi`/`Stat`/`Panel` = 0; contraste del texto secundario ≥ 4,5:1.

## 5. Alcance
**Incluye:**
- Suelo de tamaño de texto de 12 px para todo texto con significado en pantallas y componentes.
- Contraste mínimo 4,5:1 del texto secundario sobre los fondos de la app, en claro y en oscuro.
- Un único control de selección compartido (el actual `Pick`, ampliado), con dos densidades (normal y compacta para celdas de listados), que sustituye a los 25 selectores sueltos.
- Una única tarjeta de cifra y un único panel, con densidad normal y compacta, que sustituyen a las copias. «Stat» y «Kpi» son la misma pieza.
- Pruebas que impiden volver atrás (suelo, selectores sueltos, piezas locales).
- Definiciones usadas en este SDD: **texto con significado** = todo texto que se lee en pantalla (etiquetas, cifras, avisos, ayudas, cabeceras de tabla), salvo la lista cerrada de excepciones (cada una con archivo y motivo), que aprueba Fede; **texto secundario** = el que usa los tonos secundarios del sistema (`ink-faint`, `ink-mid`, `muted-foreground`).

**No incluye:**
- Iconos, cambios de tipografías o de esquinas, y cambios de paleta salvo ajustar la luminosidad de `ink-faint` (y de `ink-mid`/`muted-foreground` si la medición lo exige), con el valor aprobado por Fede tras U-1.
- Marca de estado con símbolo en `HealthDot` (queda para el siguiente SDD de accesibilidad).
- Mover o quitar contenido de Inicio, cabeceras o menús (SDD C y D).
- Mover deals y leads sin arrastrar (SDD B).
- Tablas en móvil, panel de deal, vistas guardadas.
- Cualquier cambio de datos, permisos, rutas o llamadas a IA.

## 6. Cambios de comportamiento (delta)
**Añadido:** una comprobación automática del suelo de texto, de los selectores y de las piezas compartidas.
**Modificado:**
- Texto de 10-11 px con significado → 12 px o más (la etiqueta que no cabe pasa a dos líneas o se abrevia; ver §8).
- `ink-faint` y los grises secundarios → tono con contraste ≥ 4,5:1 en claro y oscuro.
- Los 25 selectores sueltos → el control compartido (misma altura, borde, foco y tamaño de letra).
- `Kpi`/`Stat`/`Panel` locales → piezas compartidas (cada pantalla conserva su densidad: normal donde hoy es grande, compacta donde hoy es pequeña).
**Eliminado:** las definiciones locales de `Kpi`, `Stat` y `Panel`, y los `<select>` con estilo propio.

## 7. Historias y criterios de aceptación
### H-1: Como miembro de una empresa, quiero leer los avisos y datos secundarios sin forzar la vista.
- **CA-1** El sistema DEBE mostrar todo texto con significado a 12 px o más, sea cual sea la forma de declarar el tamaño (clases con px o rem, estilos en línea, utilidades de `styles.css`, texto de gráficos); las únicas excepciones son las de la lista cerrada y documentada (propuesta: etiquetas de atajo de teclado y marcas puramente decorativas) · cubre G-1 · prueba: `src/lib/ui-floor.test.ts`
- **CA-2** El sistema DEBE dar al texto secundario un contraste ≥ 4,5:1 sobre los tres fondos del sistema (`--paper`, `--paper-raised`, `--paper-sunk`), en tema claro y oscuro; los textos sobre fondos tintados o con transparencia quedan fuera de este CA y se listan en §16 · cubre G-1 · prueba: `src/lib/ui-contrast.test.ts`
- **CA-3** SI una etiqueta ya no cabe a 12 px en su tarjeta o en su etapa del tablero, ENTONCES el sistema DEBE partirla en dos líneas, sin recortarla (sin puntos suspensivos) ni crear scroll horizontal de página · cubre G-1 · prueba: automática (`src/lib/ui-floor.test.ts`: ninguna etiqueta migrada usa recorte) y **manual** con lista de comprobación a 375 px en U-4 (no automatizable sin navegador; declarado)
- **CA-4** El sistema DEBE seguir mostrando los mismos textos y datos que antes (solo cambian tamaño y color) · cubre G-3 · prueba: las pruebas existentes (`src/lib/headlines.test.ts`, `src/lib/nav.test.ts`) siguen pasando; **hueco declarado**: no hay prueba automática de los textos de selectores y piezas, se cubre con la lista de comprobación manual de U-3 y U-4

### H-2: Como miembro de una empresa, quiero que los selectores se vean y se comporten igual en todas las pantallas.
- **CA-5** El sistema DEBE usar un único control de selección compartido en toda la app, sin selectores con aspecto propio · cubre G-2 · prueba: `src/lib/ui-select.test.ts` (ningún selector nativo fuera del control compartido)
- **CA-6** El sistema DEBE ofrecer en el control de selección una densidad normal, con la altura que tiene hoy `Pick` (40 px en móvil y 36 px en escritorio), y una densidad compacta para celdas de listados cuya altura fija Dani en U-2 y aprueba Fede (§15) · cubre G-2 · prueba: `src/lib/ui-select.test.ts` (alturas por densidad)
- **CA-7** CUANDO un selector no tenga etiqueta visible, el sistema DEBE exigir una etiqueta accesible en su definición · cubre G-2 · prueba: `src/lib/ui-select.test.ts`
- **CA-8** El sistema DEBE conservar en cada selector el mismo valor, las mismas opciones y el mismo efecto al cambiar que hoy · cubre G-3 · prueba: pruebas existentes de cada pantalla donde las haya; **hueco declarado** donde no (lista en §16, a completar por Dani en U-2)

### H-3: Como miembro de una empresa, quiero que las cifras y paneles se vean iguales en todas las pantallas.
- **CA-9** El sistema DEBE tener una única tarjeta de cifra y un único panel, compartidos, sin copias locales en las pantallas · cubre G-2 · prueba: `src/lib/ui-pieces.test.ts` (ninguna definición local)
- **CA-10** El sistema DEBE ofrecer en la tarjeta de cifra dos densidades (normal y compacta) y admitir una pista opcional y un tono de alerta · cubre G-2 · prueba: `src/lib/ui-pieces.test.ts` (prueba de render de cada variante)
- **CA-11** El sistema DEBE conservar en cada pantalla la densidad que tiene hoy, según la lista siguiente, salvo que Fede decida unificarla (§15) · cubre G-3 · prueba: **manual** (lista de comprobación en U-3)

| Pantalla (pieza local actual) | Densidad de hoy |
|---|---|
| Inicio (`Stat`, `Panel`) | normal (`text-4xl`, `p-5`) |
| Pipeline (`Kpi`) | normal (`text-4xl`, `p-5`) |
| Leads (`Kpi`, `Panel`) | compacta (`text-2xl`, `px-4 py-3`, con pista) |
| Métricas (`Kpi`, `Panel`), presupuesto, embudo self-service, finanzas, tablero de pipeline | **[Por verificar]**: no leídas; Dani las completa en U-3 antes de tocarlas |

## 8. Casos límite y errores
- Tema oscuro: el contraste se comprueba también en oscuro (CA-2).
- Etiquetas largas en columnas estrechas del tablero a 375 px (CA-3).
- Un texto de 10-11 px que sea solo decoración (p. ej. un separador): va a la lista de excepciones con su motivo; sin motivo, no se exceptúa.
- Selectores deshabilitados: mantienen su aspecto atenuado pero con contraste legible del texto.
- Selector dentro de una tabla que ya hace scroll horizontal: no DEBE ampliar la página (regla de contención del sistema de diseño).

## 9. Experiencia y copy
- No cambia ningún texto. Una sola regla para etiquetas que no caben: primero se parten en dos líneas (CA-3); solo se abrevian si Fede aprueba la abreviatura en la revisión visual de U-4. Nada de copy nuevo sin su OK.
- Sin iconos. Los estados siguen siendo palabra.

## 10. Datos, permisos y privacidad
Sin tablas, columnas, políticas ni permisos nuevos. Sin datos de clientes en pruebas ni capturas: datos ficticios.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| ninguna | — | — | — |

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | Comprobación del contraste del texto secundario con la paleta ya entregada por `ux-palette-graphite` (sin cambiar colores aquí; si algún caso no llega, se propone ajuste a Fede) | CA-2 | `src/lib/ui-contrast.test.ts` |
| U-2 | Control de selección compartido y sustitución de los 25 selectores sueltos | CA-5, CA-6, CA-7, CA-8 | `src/lib/ui-select.test.ts` |
| U-3 | Tarjeta de cifra y panel compartidos; sustitución de las copias; lista de comprobación visual de CA-11 | CA-9, CA-10, CA-11 | `src/lib/ui-pieces.test.ts` |
| U-4 | Suelo de 12 px y lista de excepciones; arreglo de cada uso; lista de comprobación a 375 px y 1440 px | CA-1, CA-3, CA-4 | `src/lib/ui-floor.test.ts` |

Orden: U-1 → U-2 → U-3 → U-4. U-4 va al final porque las piezas compartidas ya recogen parte de los usos. Cada prueba se añade en la unidad que la cierra, para que la integración continua no quede en rojo entre unidades. U-4 toca unos 42 archivos: Dani puede partirla por carpetas (§15).

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- Ya existe `Pick` en `src/components/fields.tsx`; lo natural es ampliarlo (propiedad de densidad) en vez de crear otro, y repasar los 25 `<select>` sueltos.
- `Empty` y `HealthDot` ya viven en `src/components/page.tsx`; `Kpi` y `Panel` pueden vivir allí o en un archivo hermano.
- La prueba del suelo puede ser una búsqueda estática sobre el código fuente (como `src/lib/field-baseline.ts` hace para columnas) con una lista de excepciones.
- El contraste puede calcularse en una función pura a partir de los valores de `src/styles.css` (claro `:117-130`, oscuro `:188-201`), sin navegador.
- No hay `Skeleton` ni `Table` compartidos que tocar en este SDD (`src/components/ui/table.tsx` existe pero no se usa en las pantallas leídas; no se amplía el alcance).

## 14. Riesgos y dependencias
- Subir letra de 11 a 12 px puede desbordar tarjetas estrechas del tablero (CA-3).
- Cambiar el tono de `ink-faint` modifica el aspecto de toda la app: conviene revisarlo en claro y en oscuro antes de aprobar la entrega.
- Sustituir los 25 selectores sueltos toca 16 archivos; el riesgo es de regresión pequeña por archivo. Se mitiga con pruebas existentes y revisión visual.
- Conflictos con otras ramas que editan los mismos archivos (hay varias carpetas de trabajo de `seller-strategy-studio`): coordinar con el SDD B, que toca `deals.tsx` y `leads.index.tsx`. **Orden recomendado: A antes de B**, o B sobre la base ya con A integrado, para evitar conflictos.

- **Paleta (comentario de Fede, 2026-10-31: «la paleta de colores tampoco me gusta»).** **Decidido por Fede el 2026-10-31:** la paleta pasa a «Grafito e índigo», en el SDD propio `SDD-20261031-ux-palette-graphite`, que se entrega **antes** que este. Los nuevos grises (incluido `ink-faint`, `#646a74` en claro y `#8b919c` en oscuro) salen de ese SDD; este SDD ya **no cambia colores**: U-1 se limita a comprobar el contraste con la paleta entregada.

## 15. Preguntas para Fede y para la revisión técnica
1. ¿El mínimo es **12 px**? (Propuesta mía; sin dato que lo respalde, es criterio.)
2. ¿Unificar la densidad de `Kpi` (hoy `text-4xl` en Inicio y Pipeline, `text-2xl` en Leads; Métricas **[Por verificar]**) o conservar las dos? (Propuesta: conservar las dos, como dice CA-11.)
3. ¿Aprobar la lista de excepciones del suelo (solo `kbd` y decoración) o añadir otras?
4. Para el gate: ¿la prueba estática de selectores y del suelo de texto es aceptable (calculando el tamaño de cualquier forma de declararlo) o prefiere una regla de lint?
5. ¿Altura táctil mínima de **44 px** también en la densidad normal del selector (hoy 40 px)? Propuesta: no exigirlo en este SDD; queda para el de accesibilidad.
6. ~~Nuevo valor de `ink-faint`~~ **Resuelto:** lo fija el SDD de paleta (`#646a74` / `#8b919c`).
8. ~~Paleta~~ **Decidido por Fede (2026-10-31): Grafito e índigo**, en `SDD-20261031-ux-palette-graphite`.
7. Para Dani: ¿partir U-4 por carpetas? ¿El `Select` de la librería de interfaz cuenta como control compartido o se sustituye también?

## 16. Pendiente de verificar
- Contraste real de `ink-faint` en claro y oscuro (lo mide el primer test de U-1; mi 3,3:1 y 4,3:1 son cálculo a mano).
- Recuento de usos de `ink-faint` con significado frente a decorativos.
- Que ningún selector esté dentro de una librería de terceros que no se pueda sustituir, y si el `Select` de la librería de interfaz se usa en alguna pantalla.
- Qué pantallas tienen hoy prueba automática de sus textos o selectores (CA-4, CA-8): sin recuento; Dani lo completa en U-2.
- Textos secundarios sobre fondos tintados o con transparencia (fuera de CA-2): lista por hacer en U-1.
- Densidad actual de `Kpi`/`Panel` en Métricas, presupuesto, embudo self-service, finanzas y tablero de pipeline (CA-11).
- Visual real a 375 y 1440 px en claro y oscuro (necesita sesión en la app; no hecho).

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
- Veredicto del gate: PASS (`gate.mjs`, ticket NK-0051, commit 8ee3543f3b80; informe literal debajo)
- CA sin prueba posible o sin G-n: no revisado
- [Por verificar] que sigue sin comprobarse: ver §16
- Contradicciones con el código o con decisiones previas: no revisado
- Lo que esta revisión NO demuestra: el gate automático no evalúa los CA uno a uno, ni la app en vivo, ni claro/oscuro, táctil, Safari/Firefox ni lectores de pantalla; no hay segunda máquina ni soak (ver informe).

Informe del gate, sin editar:

```
PASS  clean tree on exact commit  8ee3543f3b80b0f6847f1ba1ae784a1735b52bee
PASS  canary: runner detects failure
PASS  guard: no `as any`
PASS  guard: no window.confirm/prompt
PASS  guard: no committed secrets
PASS  guard: no secret in VITE_ vars
PASS  guard: no .only/.skip in tests
PASS  guard: no raw error.message toasts
PASS  guard: .env untouched
PASS  guard: assertions not weakened
PASS  guard: no longer timeouts in tests
PASS  typecheck
PASS  lint (touched files, 75)
PASS  release build (outside network best-effort blocked)
PASS  full unit suite  2936/2936 passed; known failures 0; unexpected 0; files with no assertion run 0
PASS  touched test files, whole (10)
PASS  second-machine full run  NOT RUN: no second runner configured; canary + secret guard above are the local substitute
PASS  artifact size recorded  NOT A SOAK: file handles, memory and restarts are not measured here
PASS  extra: bunx vitest run src/lib/won-approval.pg.test.ts src/lib/board-move.pg.test.ts

VERDICT PASS on 8ee3543f3b80  evidence: /Users/fedecosentino/NOKKO GTM BRAIN/seller-strategy-studio/.factory/evidence/NK-0051/8ee3543f3b80
```

## 18. Delta de implementación (lo rellena el agente al entregar)
Pendiente.

---
Validación: pendiente. Auditoría 2026-10-31: linter con desajuste de plantilla (ver informe) y auditoría independiente ronda 1 «Bloqueado» (8 bloqueantes, corregidos) y ronda 2 **«Cambios menores»**. Quedan abiertas las decisiones de Fede: lista de excepciones del suelo (§15 · 3), el `Select` de la librería (§15 · 7), el nuevo valor de `ink-faint` (§15 · 6) y la base de trabajo. Otros menores del revisor (alcance exacto del suelo de texto, contraste de `disabled`, casos límite de selectores) los resuelve Dani en U-1 y U-2.
