# SDD-20261106-ux-metrics-data-state · [Mejora] NK-0051 ampliado, C2: explicaciones plegadas y una sola forma para las marcas de dato

**Tipo:** Mejora · **Prioridad propuesta:** Media
**Estado:** Aprobado por Fede el 2026-11-06 («OK a todo» en el chat, tras tres pasadas del gate y la revisión de coherencia) · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-11-06 · **Ticket:** NK-0051 (ampliación)
**PRD:** No aplica (mejora acotada; contexto en `docs/UX-INFORME-20261031.md`, punto 7) · **Depende de:** `SDD-20261106-metrics-honest-data` (SDD-A: crea las marcas con `data-mark`, el envoltorio `DataMark` y la comprobación `src/test/data-marks.ts`) y `SDD-20261106-ux-core-screens-pattern` (C1: saca la pista de `listening.tsx:49` a una línea propia, su §9). C2 se integra el último. · **Coordinar con:** `SDD-20261106-agent-rules-reader` (SDD-D: reescribe el texto de `hub.tsx:161-164`, que hoy no llega al umbral, §14); `SDD-20261031-ux-legibility-contrast` (mismos archivos de `/metrics`; conflicto de archivo, no de función, §14); `SDD-20261025-theory-u-proactive-decision-support` (toca `src/components/theory-u/*`)

> Sprint 1 de mejoras en pantallas core, bloque C2.
> **Números de línea:** todos son de `main` @ `f76f639`. A, C1 y D cambian algunos de estos archivos antes que C2; U-1 vuelve a medir sobre la rama integrada (§12).

**Contrato entre los SDD del sprint (el mismo texto en A, B, C1, C2 y D):** «A cambia datos y textos de datos de /metrics (las palabras de cada marca); B, la búsqueda de /hub; C1, estados de pantalla (carga, error, vacío) de /hub, /theory-u y /metrics, sección en la URL de /hub y /theory-u, vacíos y pistas de /hub y /theory-u; C2, el plegado de explicaciones en las tres pantallas y la forma visual (componente DataState) de las marcas de dato de /metrics. D toca la pantalla de /hub (`src/components/hub/` tras B) solo en los textos de la sección Reglas y de la casilla «obligatorio». Orden de integración: A → B → C1 → D → C2.»

## 1. Resumen
Las explicaciones largas ocupan varias líneas fijas encima de las cifras, y cada marca de dato se pinta a su manera. C2 pliega las explicaciones de una lista cerrada detrás de un botón («Cómo se calcula» en `/metrics`, «Más sobre esto» en Theory U) y da una única forma visual, el componente `DataState`, a las marcas «Real · origen», «Estimado · motivo» y «Sin dato · motivo» que escribe SDD-A. C2 no cambia ninguna palabra: A pone las palabras de las marcas y C2 su forma.

## 2. Problema y para quién
Owner y Sales Leader en `/metrics`, y cualquier persona del equipo en Theory U: tienen que leer párrafos de método antes de ver la cifra o el formulario, y no distinguen de un vistazo si una cifra es real o estimada.

## 3. Evidencia y por qué ahora
Leído en `main` @ `f76f639`.

**Explicaciones largas fijas.** Medido con un recorrido del árbol de TypeScript (no con `awk`): para cada elemento JSX sin hijos de bloque, se junta su texto visible; cada expresión `{…}` cuenta como un carácter y los literales de texto cuentan enteros. Umbral: más de 160 caracteres visibles. Salen 12 bloques en las tres pantallas:

| # | Bloque | Visibles | Qué es |
|---|---|---|---|
| X-1 | `src/components/segment-coverage.tsx:68` | 174 | cálculo de cobertura |
| X-2 | `src/components/cac-panel.tsx:144-147` | 235 | cálculo de CAC y reparto |
| X-3 | `src/components/budget-panel.tsx:43-47` | 191 | contiene la pista con enlace de `:45` (A, CA-11) |
| X-4 | `src/components/quarter-kpis-panel.tsx:74-78` | 311 | contiene la pista con enlace de `:76` (A, CA-11) dentro de una frase de 227 |
| X-5 | `src/components/pipeline-board-panel.tsx:69-72` | 234 | cálculo de CAC y payback proyectados |
| X-6 | `src/components/self-service-funnel.tsx:233` | 163 | instrucciones del campo «Importar CSV» (`:232-234`) |
| X-7 | `src/components/won-deals-panel.tsx:55-58` | 263 | para qué sirve la lista y qué decide cada campo |
| X-8 | `src/components/stripe-panel.tsx:153-160` | 374 | cómo se cuenta (`:154`) más avisos que dependen de los datos (`:155-159`: conceptos sin precio, «las cifras son parciales», otras monedas) |
| X-9 | `src/components/theory-u/listening.tsx:49` | 311 | método (Scharmer) más la pista de C1 (E-4) |
| X-10 | `src/components/theory-u/case-clinic.tsx:54` | 264 | método |
| X-11 | `src/components/theory-u/prototypes.tsx:80` | 194 | método |
| X-12 | `src/components/theory-u/journey.tsx:69` | 169 | vacío (`<Empty>`), de C1 |

- `/hub`: ninguno. El bloque más largo es la casilla «obligatorio» (`hub.tsx:161-164`, 146 visibles), que reescribe D. El de `src/components/drive.tsx:176` (186) está en `AccountDriveTab` (`:155`), que no se monta en `/hub`.
- Las coincidencias del `awk` de la v2 en `journey.tsx:122`, `sensing.tsx:85` y `case-clinic.tsx:61` son líneas de código con 5 o 6 caracteres visibles: no son explicaciones.
- `src/components/ui/collapsible.tsx` existe (Radix, `package.json:33`) y nadie lo usa; el código usa `<details>` en 10 sitios (p. ej. `briefing.tsx:65`).

**Marcas de dato.** Hoy el origen de una cifra se escribe con palabras sueltas: `segment-coverage.tsx:17` («media de ganados», «punto medio del rango») y `:119` («Payback real» / «Payback estimado»). SDD-A v3 las sustituye por marcas con tres estados y el atributo `data-mark`, pintadas con su envoltorio `DataMark` (`src/components/metrics/data-mark.tsx`) y comprobadas por `src/test/data-marks.ts` en sus tests de componente (A §6, CA-10, §13). SDD-A fija todas las palabras, también las de «Real» («Real · media de ganados», «Real · de las cuentas», «Real · de deals con líneas»). El sistema de diseño ya tiene una forma para un estado: la palabra con un filete de color debajo (`HealthDot`, `src/components/page.tsx:24-32`).

**Uso:** sin dato.

## 4. Resultado buscado
- Explicaciones de más de 160 caracteres visibles fijas en pantalla: línea base 12 (§3: 8 en `/metrics`, 4 en Theory U, 0 en `/hub`). Se pliegan 9 (lista cerrada del §9). Quedan 3 fijas por regla (X-4, X-6, X-12, ver §9). Objetivo: 0 fuera de esas 3.
- Marcas de A pintadas con `DataState`: línea base 0 (el componente no existe). Objetivo: todas las `[data-mark]` que pintan los tests de componente de A.
- Uso o satisfacción: sin dato.

## 5. Alcance
**Incluye:**
- `ExplanationFold` (componente nuevo) y su uso en los 9 bloques de la lista cerrada del §9: 6 en `/metrics` y 3 en Theory U.
- `DataState` (componente nuevo); `DataMark` de A pasa a ser `DataState`; la comprobación compartida `src/test/data-marks.ts` exige además que cada `[data-mark]` sea un `DataState`.

**No incluye:**
- Ninguna palabra: ni de las marcas ni de las explicaciones. Las marcas son de A; los vacíos y las pistas, de A y de C1.
- Las ventanas de A («Últimos 365 días», «Todo el histórico · no depende del trimestre», «Últimas 12 semanas · no depende del trimestre»): no son marcas de dato, no llevan `data-mark` y no usan `DataState`.
- Los «—» de `/metrics` (unas 52 líneas en 11 archivos, según el gate). C2 no los toca: los que significan «no aplica» se quedan, y convertir los que significan «falta el dato» exige palabras nuevas, que son de A (§15.4).
- Estados de carga, error y vacío de `/hub`, `/theory-u` y `/metrics`, incluidos los paneles de `/metrics` con consulta propia: son de C1 (C1 §5, E-1, E-1m, E-2).
- Vacíos (X-12), pistas e instrucciones de formulario (X-6): no se pliegan.
- `src/routes/_authenticated/hub.tsx` y `src/components/hub/*`: la lista no tiene ningún bloque de `/hub`.
- Paleta, tamaños, `Kpi`/`Panel` (otros SDD de NK-0051); esquema, RLS, IA.

## 6. Cambios de comportamiento (delta)
**Añadido:** botón «Cómo se calcula» / «Ocultar cálculo» en 6 paneles de `/metrics`, y «Más sobre esto» / «Ocultar» en 3 pestañas de Theory U; forma común de las marcas de A.
**Modificado:** los 9 bloques del §9 pasan a estar cerrados por defecto (el texto no cambia). En X-3, la frase de la pista queda a la vista y el resto se pliega. En X-8, los avisos que dependen de los datos quedan a la vista.
**Eliminado:** nada (las explicaciones siguen a un clic).

## 7. Historias y criterios de aceptación
### H-1: Como Owner, Sales Leader o persona del equipo, quiero ver la cifra o el formulario antes que la explicación.
- **CA-1** `ExplanationFold({ kind: "calculo" | "metodo", children })` empieza cerrado. Su disparador es un `<button type="button">` nativo, sin `tabindex` negativo, con `aria-expanded="false"` y `aria-controls` igual al `id` del contenedor del contenido, también cerrado (`ExplanationFold` los pasa de forma explícita, porque Radix no pone `aria-controls` cerrado). El texto del botón es «Cómo se calcula» con `kind="calculo"` y «Más sobre esto» con `kind="metodo"`; abierto, «Ocultar cálculo» y «Ocultar». Cerrado, el contenido no está en el documento. Al hacer clic, `aria-expanded` pasa a `"true"` y el contenido aparece dentro del componente, justo después del botón y en el flujo de la página: no está en un portal ni lleva clases `absolute` o `fixed`, así que en móvil se abre debajo y no tapa la cifra. · prueba: `src/components/explanation-fold.test.tsx` «Fuera del documento» se refiere a los hijos, no al contenedor vacío de Radix.
- **CA-2** En `/metrics`, cada bloque de la lista cerrada del §9 (X-1, X-2, X-3, X-5, X-7, X-8) no se ve al pintar el panel con datos ficticios; su panel tiene un botón «Cómo se calcula» con `aria-expanded="false"`, y al pulsarlo el texto del bloque aparece completo y sin cambios. Lo que el §9 deja a la vista se ve sin abrir nada: en X-3, el enlace de la pista; en X-8, con una lectura ficticia que trae `truncated` y `unpriced_items`, sus dos avisos. X-4 y X-6 se ven completos sin botón. · prueba: `src/components/metrics/explanation-fold-usage.test.tsx`
- **CA-3** En Theory U, X-9 (sin la pista, que C1 ya ha sacado a su línea), X-10 y X-11 no se ven al pintar la pestaña; cada una tiene un botón «Más sobre esto», y al pulsarlo el texto aparece completo y sin cambios. La pista de C1 de `listening.tsx` («… de cada cuenta», con enlace a `/accounts`) se ve sin abrir nada. El vacío X-12 no se pliega. · prueba: `src/components/theory-u/explanation-fold-usage.test.tsx`

### H-2: Como Owner o Sales Leader, quiero saber de un vistazo si una cifra es real, estimada o no tiene dato.
- **CA-4** `DataState` pinta exactamente una de tres formas: «Real», o «Real · origen»; «Estimado · motivo»; «Sin dato · motivo». El tipo exige `reason` en «Estimado» y «Sin dato». El elemento lleva `data-mark` con el estado (`real`, `estimado`, `sin_dato`) y `data-slot="data-state"`, y su único hijo es un nodo de texto con la frase completa, de modo que `getByText("Estimado · punto medio del rango")` lo encuentra. La clase del color del texto es la misma en los tres estados: el estado lo dice la palabra, y el color solo acompaña en el filete. El filete sale de tokens del sistema (`state-ok`, `state-watch`, `hairline-firm`) y ninguna clase lleva un color literal (`#`, `rgb`, `hsl` o un valor entre corchetes). · prueba: `src/components/data-state.test.tsx`
- **CA-5** Cada `[data-mark]` que pintan los tests de componente de A es un `DataState`: lleva `data-slot="data-state"` y un único nodo de texto. Lo comprueba `src/test/data-marks.ts`, ampliada, en todos los tests de A que la llaman, sin cambiar ninguna línea de esos tests. · prueba: `src/test/data-marks.ts`, ejecutada por `src/components/metrics/performance-panels.test.tsx`, `src/components/segment-coverage.test.tsx`, `src/components/cac-panel.test.tsx`, `src/components/budget-panel.test.tsx`, `src/components/quarter-kpis-panel.test.tsx` y `src/components/pipeline-board-panel.test.tsx`

## 8. Casos límite y errores
- Un bloque de 160 caracteres visibles o menos no se pliega (umbral medido como en el §3, pendiente de Fede, §15.1).
- Pistas con enlace (A CA-11; C1 E-4) y avisos que dependen de los datos nunca quedan dentro del pliegue (CA-2, CA-3). Si un bloque es más largo que el umbral solo con la frase de la pista, no se pliega (X-4, §15.3).
- Una instrucción dentro de un párrafo de explicación se pliega con él (X-2, «Introduce lo que gastaste…»; X-7, «Revisa que cada uno…»). Un bloque que es solo la instrucción de un campo de formulario no se pliega (X-6). Ver §15.5.
- Teclado: el disparador es un botón nativo, que el navegador activa con Enter y Espacio. jsdom no reproduce esa activación: CA-1 comprueba el elemento y su `tabindex`, y el recorrido real con teclado lo hace `nokko-walkthrough`.
- Lectores de pantalla: el botón anuncia `aria-expanded`; la marca se lee como texto, sin depender del color (CA-4).
- Tema oscuro: los tokens de CA-4 se redefinen en `.dark` (`src/styles.css`); no hay colores literales.
- Buscar en la página (Ctrl+F) no encuentra el texto plegado, porque Radix lo saca del documento al cerrar (§14).

## 9. Experiencia y copy
- Botones: «Cómo se calcula» / «Ocultar cálculo» en `/metrics`; «Más sobre esto» / «Ocultar» en Theory U (propuesta, §15.2). Español, «tú», sin iconos.
- Marcas: las palabras de A, sin cambios. Forma: el texto entero en el color de texto secundario y un filete de color debajo, como `HealthDot`: verde (`state-ok`) para «Real», ámbar (`state-watch`) para «Estimado» y neutro (`hairline-firm`) para «Sin dato». La palabra lleva el estado.
- **Lista cerrada de explicaciones** (ids del §3; «a la vista» = lo que no se pliega, con sus mismas palabras):

| # | Botón | A la vista | Plegado |
|---|---|---|---|
| X-1 | Cómo se calcula | — | todo el párrafo |
| X-2 | Cómo se calcula | — | todo el párrafo |
| X-3 | Cómo se calcula | «Se apunta por trimestre en Estrategia GTM → Presupuesto vs real.» (con su enlace, el que deje A) | «Suma de los cuatro trimestres.» y «El margen real (…) en todos los paybacks.» |
| X-5 | Cómo se calcula | — | todo el párrafo |
| X-7 | Cómo se calcula | — | todo el párrafo |
| X-8 | Cómo se calcula | los avisos condicionados de `stripe-panel.tsx:155-159`, cuando salen | las cuatro frases fijas de `:154` |
| X-9 | Más sobre esto | la pista que C1 saca a su línea | las dos frases de Scharmer (223 visibles) |
| X-10 | Más sobre esto | — | todo el párrafo |
| X-11 | Más sobre esto | — | todo el párrafo |

- **Fuera por regla:** X-4 (la frase de la pista mide 227 sola, §15.3), X-6 (instrucciones del campo CSV), X-12 (vacío de C1).

## 10. Datos, permisos y privacidad
Sin cambios de datos, consultas ni permisos. Tests con datos ficticios.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| ninguna | — | — | — |

## 12. Unidades de trabajo
Base de cada U: la rama integrada tras A, B, C1 y D.

| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | Primero vuelve a medir con el método del §3 sobre la base; si la lista difiere del §9, lo para y se lo lleva a Fede antes de escribir código. Después, `src/components/explanation-fold.tsx` y su uso en los 9 bloques del §9. Verificación: los tests de A y de C1 pasan sin cambios (`git diff` vacío en sus archivos de test). | CA-1, CA-2, CA-3 | `src/components/explanation-fold.test.tsx` (el módulo no existe); `src/components/metrics/explanation-fold-usage.test.tsx` y `src/components/theory-u/explanation-fold-usage.test.tsx` (en la base el texto se ve sin abrir nada y no hay botón) |
| U-2 | `src/components/data-state.tsx`; `src/components/metrics/data-mark.tsx` conserva la firma de A (`DataMark({ state, reason? })`) y delega en `DataState`; no cambian sus props, sus palabras ni `data-mark`; amplía `src/test/data-marks.ts`. Verificación: los tests de A pasan sin cambiar ninguna línea y `npx tsc --noEmit` queda en 0 errores. | CA-4, CA-5 | `src/components/data-state.test.tsx` (el módulo no existe); los seis tests de A de CA-5 con la comprobación ampliada (en la base, el `DataMark` de A no lleva `data-slot="data-state"`) |

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- `ExplanationFold` sobre `src/components/ui/collapsible.tsx`. Su `CollapsibleTrigger` pone `aria-expanded`; `aria-controls` y el `id` del contenido se pasan de forma explícita (Radix solo pone `aria-controls` abierto, `@radix-ui/react-collapsible/dist/index.mjs:66`, y esparce las props del usuario después de las suyas, `:71`), y `CollapsibleContent` saca el contenido del documento al cerrar. Se descarta `<details>`, que no expone `aria-expanded` y no cumple CA-1.
- `DataState` va en su propio archivo, `src/components/data-state.tsx`, no en `page.tsx`, para no chocar con `ScreenState` (C1) ni con `Kpi`/`Panel` (legibilidad). Props: `{ state: "real"; reason?: string } | { state: "estimado" | "sin_dato"; reason: string }`, las mismas de `DataMark` (A §13). Pinta `<span data-mark={state} data-slot="data-state" className="border-b-2 pb-0.5 text-xs text-ink-mid {filete}">{texto}</span>`, con el texto construido como una sola cadena. `text-xs` son 12 px, así que la marca ya cumple el suelo que propone el SDD de legibilidad sin depender de él.
- `src/components/metrics/data-mark.tsx`: mantiene la firma de A y renderiza `<DataState …/>` dentro, de modo que las llamadas de A no cambian y los tipos siguen compilando.
- Tests de uso: el patrón de mocks de Supabase está en `src/components/strategy-screens.test.tsx:12-41`, y jsdom con Testing Library en `vitest.config.ts:8`. Ningún test en `src/routes/`. Theory U monta cada pestaña por su componente (`UJourney`, `Listening`, `CaseClinics`, `Prototypes`), sin pasar por la ruta.
- El script de medida del §3 no entra en el repositorio. Su método está escrito en el §3 para que U-1 lo repita.

## 14. Riesgos y dependencias
- **Sin dependencia de `Kpi`/`Panel`.** Ningún CA de C2 los usa, y `DataState` lleva su propio tamaño de 12 px. Con `SDD-20261031-ux-legibility-contrast` solo hay conflicto de archivos (`segment-coverage.tsx`, `cac-panel.tsx`, `budget-panel.tsx`, etc.), que resuelve el orden de integración. C2 ya no espera a ese SDD (en «Borrador», sin código: la rama local de NK-0051 se perdió, decisión de Fede del 2026-11-06).
- **De A:** `DataMark`, `data-mark` y `src/test/data-marks.ts`. C2 amplía esa comprobación (añade una aserción y no quita ninguna) y no cambia ningún test de A. A también cambia los enlaces de X-3 (`budget-panel.tsx:45`) y X-4 (`quarter-kpis-panel.tsx:76`); C2 los deja a la vista, así que el test de pistas de A (`src/components/metrics/hints.test.tsx`) no cambia.
- **De C1:** C1 saca la pista de X-9 a su propia línea (C1 §9 y §14). C2 pliega solo el párrafo de Scharmer, de modo que el enlace de C1 nunca queda oculto.
- **Con D:** D reescribe `hub.tsx:161-164` (146 visibles hoy). Si el texto nuevo pasa de 160, U-1 lo detecta al volver a medir y lo lleva a Fede antes de plegar nada en `/hub`.
- Con Radix, el texto plegado no aparece al buscar en la página. Se acepta, porque es un texto de método y está a un clic.

## 15. Preguntas para Fede y para la revisión técnica
1. **Umbral (abierta):** se pliega lo que pasa de 160 caracteres visibles. ¿Te vale? Con 160 se pliegan 9 bloques; si lo cambias, U-1 rehace la lista.
2. **Textos de los botones (abierta):** propongo «Cómo se calcula» / «Ocultar cálculo» en `/metrics` y «Más sobre esto» / «Ocultar» en Theory U, porque allí son explicaciones de método y no cálculos. ¿Los apruebas?
3. **X-4, KPI trimestrales (abierta):** la frase que contiene la pista mide 227 caracteres ella sola, así que el bloque no se pliega. ¿Lo dejamos visible, o le pedimos a A que separe en una frase propia de dónde sale cada cifra? Esas son palabras de A.
4. **«—» que significan «falta el dato» (abierta):** quedan fuera de C2 porque necesitan palabras nuevas, que son de A. ¿Abrimos un ticket para Sprint 2?
5. **Instrucciones dentro de explicaciones (abierta):** en X-2 y X-7 la instrucción se pliega con el párrafo. ¿O prefieres que quede a la vista? Eso cambiaría la lista del §9.

## 16. Pendiente de verificar
- La lista del §9 sobre la rama integrada (A, C1 y D cambian textos de esos archivos): U-1, antes de escribir código.
- Activación con teclado y apertura en móvil a 375 px: `nokko-walkthrough`.
- ~~Explicaciones largas en `journey.tsx`, `sensing.tsx` y `hub.tsx`~~: medido en el §3. La de `journey.tsx` es un vacío (X-12) y las otras no llegan al umbral.
- ~~Vacíos falsos en los paneles de `/metrics` con consulta propia~~: los recoge C1 (E-1, E-2).

**Versión 2 (2026-11-06):** nace al partir la v1 conjunta tras la primera pasada del gate (objeción 11). Este SDD es C2: `HowCalculated` y `DataState`. Añade un test de uso a cada CA (3), umbral de caracteres y lista por fijar (7), «no aplica» fuera y forma «Estimado · motivo» (8), y el contrato común (9). No tuvo segunda pasada.

**Versión 4 (2026-11-06):** tercera pasada del gate: `aria-controls` explícito también cerrado (bloqueante 1); `DataMark` conserva la firma de A y delega, con `tsc` en la verificación (2); contrato común actualizado.

**Versión 3 (2026-11-06):** corregida tras la segunda pasada del gate.
- **Nueva 1 y parcial 2:** carga, error y vacío de `/metrics`, con los paneles de consulta propia, son de C1 (§5).
- **Nueva 2 y parcial 8:** A fija todas las palabras, también «Real · origen». C2 solo da la forma a las `[data-mark]` de A. Las ventanas de A y los «—» quedan fuera (§5, §15.4), y «repartido por clientes ganados» ya no existe en A.
- **Nueva 3:** CA-4 exige un solo nodo de texto, de modo que `getByText` exacto sigue funcionando. CA-5 amplía `data-marks.ts` sin tocar los tests de A, y U-2 los ejecuta sin cambios.
- **Nueva 4:** las pistas de A y de C1 nunca se pliegan (X-3, X-4, X-9).
- **Nueva 5:** el botón depende del tipo de texto: «Cómo se calcula» o «Más sobre esto» (§15.2). El componente pasa a llamarse `ExplanationFold`.
- **Nueva 6 y parcial 7:** el §3 se vuelve a medir en caracteres visibles con el árbol de TypeScript, con una lista cerrada ya escrita (§9). El §8 usa el mismo umbral.
- **Nueva 7:** se fija `Collapsible` y se descarta `<details>`.
- **Nueva 8:** se quita la dependencia de `Kpi`/`Panel`, y la legibilidad pasa a «Coordinar con». C2 queda desbloqueado.
- **Nueva 9:** el §4 tiene línea base (12, 9 y 3; marcas 0) y se añade el párrafo de versión.
- **CA sin prueba:** la apertura en móvil se prueba como «en el flujo y sin portal» (CA-1), el teclado se comprueba en el walkthrough y el color tiene una aserción (CA-4).
- El contrato se sustituye por el texto común. El umbral sigue abierto (§15.1).

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
- Veredicto del gate: No revisado (la v1 conjunta la revisó; ver §17 de C1)


Informe de la segunda pasada (sobre v2), copiado sin editar:

- **Veredicto de la segunda pasada del gate:** Objeciones.

- **Objeciones de la primera pasada** (las de la v1 conjunta están en el §17 de C1, `SDD-20261106-ux-core-screens-pattern.md:109-232`; las que tocan a C2 son la 3, la 7, la 8, la 9 y la 11):
  - **1** (Finanzas en el §8): no aplica a C2. Salió con C1 y la sección de `/metrics` en la URL ya no está en ningún SDD.
  - **2** (consultas que no lanzan el error): parcial y huérfana para `/metrics`. C1 la arregla en `/hub` y `/theory-u`. En `/metrics` sigue igual: `quotas`, `org_members` y `profiles` siguen sin lanzar el error (`metrics.tsx:110-121`). C1 §5 manda «estados de carga de `/metrics`» a C2, pero C2 §5 los excluye («estados de carga y vacío (C1)»). Ver la objeción nueva 1.
  - **3** (tests solo del componente): resuelta para C2. CA-1 y CA-2 nombran ahora un test de uso además del test del componente (`ux-metrics-data-state.md:37`, `:40`).
  - **7** (CA-6 no medible y E-5 incompleto): parcial. Hay umbral de caracteres y lista cerrada (CA-1, `:37`), y E-5 suma Theory U y `/hub` (`:19`). Pero el §8 vuelve a «una sola línea» (`:44`), el §3 mide «200 caracteres de código» y no 160 visibles, y el umbral sigue pendiente de Fede (§15, `:72`).
  - **8** (choque de CA-7 con SDD-A y «—» que significa «no aplica»): parcial. La forma «Estimado · motivo» ya coincide con SDD-A (§6 y §9) y «no aplica» queda fuera (`:28`, `:40`). Pero «Real» se atribuye a SDD-A y SDD-A no la fija. Además, CA-9 de SDD-A usa rótulos que no caben en «una de tres palabras». Ver la objeción nueva 2.
  - **9** (contrato entre SDD): resuelta. El mismo texto aparece en A §13 (`metrics-honest-data.md:134`), en C1 (`:10`) y en C2 (`:9`).
  - **11** (partir el alcance): resuelta. C2 contiene `HowCalculated` y `DataState` en U-1 y U-2.
  - **10**: aplica a la cabecera de C1, no a C2.
  - **4, 5 y 6**: tratan de C1 y no se revisan aquí.

- **CA sin prueba posible o sin G-n** (no hay PRD, así que no exijo G-n):
  - **CA-1:** la lista cerrada no existe al aprobar el SDD; la fija U-1 después. El umbral de 160 no está decidido. El caso límite «se abre debajo, no tapa la cifra» (§8, `:43`) no tiene prueba posible en jsdom y no se declara manual.
  - **CA-2:** depende de una lista cerrada que tampoco existe todavía (U-2). «El color solo acompaña a la palabra» no tiene una aserción definida.
  - **CA-1 con `<details>`:** el §13 ofrece `<details>` como opción (`:65`), pero `<details>` no expone `aria-expanded`. Si se elige, CA-1 no se cumple tal como está escrito.

- **[Por verificar] que sigue sin comprobarse:**
  - Explicaciones largas en `journey.tsx`, `sensing.tsx` y `hub.tsx` (§16). Con el mismo `awk` (texto secundario de más de 200 caracteres) salen 1 en cada uno, y 2 en `case-clinic.tsx`, no 1.
  - Si los paneles de `/metrics` con consulta propia (`FinancePanel`, `CacPanel`, `SegmentCoverage`, `LeadFunnelPanel`) muestran vacíos falsos. Lo dejó abierto la primera pasada y ni C1 ni C2 lo recogen.
  - El umbral de 160 caracteres (§15.1): Fede no lo ha decidido. Sus respuestas del 2026-11-06 (1 rotular, 2 OK, 3 sí, 4 se perdió, 5 OK) no tocan esta pregunta.
  - Por qué C2 depende de `Kpi`/`Panel`: ningún CA de C2 los usa.

- **Contradicciones con el código o con decisiones previas:**
  - Carga, error y vacío de `/metrics` no tienen dueño: C1 §5 los manda a C2 y C2 §5 los manda a C1.
  - El §9 dice «Real… (palabras de SDD-A)», pero SDD-A no fija «Real». Su CA-9 rotula el margen como «real», «de deals con líneas» y «de plan» (`metrics-honest-data.md:89`), que no son ninguna de las tres palabras de CA-2. SDD-A también añade «Últimos 365 días», «Todo el histórico · no depende del trimestre» y «repartido por clientes ganados» (`:73`, `:103`) sin decir si son marcas de dato.
  - La ambigüedad sobre quién fija qué solo se resuelve si se separan forma y palabras: SDD-A CA-10 dice que la forma «la fija SDD-C2», y C2 §5 dice que las palabras «las fija SDD-A».
  - `listening.tsx:49` es a la vez una pista que C1 convierte en enlace (C1 §9, `ux-core-screens-pattern.md:68`) y una explicación que C2 pliega. El enlace de C1 quedaría oculto por defecto.
  - «Cómo se calcula» no describe los textos de Theory U (`listening.tsx:49`, `case-clinic.tsx:54`, `prototypes.tsx:80`): son explicaciones del método, no cálculos.
  - Las decisiones de Fede del 2026-11-06 sí están reflejadas: «rotular» en SDD-A §15.1 y la rama de NK-0051 perdida en C2 §14 (`:69`).

- **Lo que esta revisión NO demuestra:**
  - No ejecuté tests, build ni `scripts/factory/gate.mjs`. Es un cambio solo de documentación: el diff entre `f76f639` y `HEAD` en `src/` está vacío.
  - No probé en segunda máquina ni hice soak.
  - No miré nada en un navegador.
  - Los recuentos son aproximados. Con el `awk` del SDD coinciden en `/metrics` (4, 4, 3, 2, 1, 1, 1). Los «—» los conté con grep: unas 52 líneas en 11 archivos, frente a las ~50 en 9 que cita el SDD. No es una medida de texto visible.
  - No leí `journey.tsx`, `sensing.tsx` ni `hub.tsx` en detalle.
  - No miré datos de producción.

**Objeciones nuevas**

1. **Carga, error y vacío de `/metrics` se quedan sin SDD.**
   - Evidencia:
     - C1 §5: «`/metrics` (estados de carga de `/metrics` y forma del dato van a C2…)» (`docs/sdd/SDD-20261106-ux-core-screens-pattern.md:36`).
     - C2 §5 «No incluye: … estados de carga y vacío (C1)» (`docs/sdd/SDD-20261106-ux-metrics-data-state.md:28`).
     - `src/routes/_authenticated/metrics.tsx:110-121` sigue sin lanzar el error.
   - Corrección: asignarlos a uno de los dos SDD (C2 con `ScreenState` de C1, o C1 ampliado) con su CA y su test, o declararlos fuera del sprint en los dos SDD y abrir ticket. Recoger también el [Por verificar] de los paneles con consulta propia.

2. **CA-2 («una de tres palabras») no cuadra con los rótulos de SDD-A, y el §9 atribuye «Real» a SDD-A sin que SDD-A lo diga.**
   - Evidencia: `ux-metrics-data-state.md:40`, `:48`; `metrics-honest-data.md:73`, `:89`, `:103`.
   - Corrección:
     - Decir cómo se clasifican «real», «de deals con líneas», «de plan», «Últimos 365 días», «Todo el histórico · …» y «repartido por clientes ganados»: marca de dato, ventana o fuente fuera de `DataState`.
     - Si «Real» es una marca nueva, que la fije C2 (no «palabras de SDD-A») y que diga en qué cifras aparece.

3. **El §13 promete que «los tests de A no cambian», pero eso depende de cómo pinte `DataState` el texto.**
   - Evidencia: `ux-metrics-data-state.md:66`. Los CA-5 a CA-9 de SDD-A comprueban textos literales como «Estimado · punto medio del rango» (`metrics-honest-data.md:85-89`).
   - Si `DataState` parte «Estimado» y «· motivo» en elementos distintos, `getByText` con coincidencia exacta deja de encontrarlos.
   - Corrección: añadir a CA-2 que `DataState` pinte «Palabra · motivo» como un solo texto accesible, o que los tests de A comprueben `textContent`. Y que U-2 ejecute sin cambios los tests de A como parte de su verificación.

4. **C1 y C2 chocan en `listening.tsx:49`.**
   - Evidencia: C1 §9 enlaza «cada cuenta» dentro de ese párrafo (`ux-core-screens-pattern.md:68`). C2 lo lista para plegarlo (`ux-metrics-data-state.md:19`).
   - Corrección: sacar del plegado las pistas con enlace de C1, o separar la pista del párrafo antes de plegarlo. Declararlo en el §14 de los dos SDD.

5. **La etiqueta «Cómo se calcula» no sirve para Theory U ni para `/hub`.**
   - Evidencia: `src/components/theory-u/listening.tsx:49` (Scharmer), `case-clinic.tsx:54` (cómo funciona la clínica) y `prototypes.tsx:80` (qué es co-crear). Ninguno es un cálculo.
   - Corrección:
     - Etiqueta por tipo: «Cómo se calcula» en `/metrics` y algo como «Más sobre esto» en Theory U y `/hub`, con aprobación de Fede según la voz de marca.
     - O limitar C2 a `/metrics` y cambiar el contrato en los cuatro SDD.

6. **El §8 vuelve a un criterio que depende del ancho de pantalla, y el §3 mide otra cosa que CA-1.**
   - Evidencia:
     - «Una explicación de una sola línea no se pliega» (`:44`), frente a «más de 160 caracteres de texto visible» en CA-1 (`:37`).
     - La línea base del §3 está medida en «más de 200 caracteres de código» (`:19`).
   - Corrección: cambiar el §8 por «una explicación de 160 caracteres visibles o menos no se pliega», y que U-1 vuelva a medir la lista con el criterio de CA-1.

7. **`<details>` no cumple CA-1 tal como está escrito.**
   - Evidencia: CA-1 exige `aria-expanded` (`:37`) y el §13 admite `<details>` (`:65`), que no lo expone.
   - Ya existe `src/components/ui/collapsible.tsx` (Radix, cuyo disparador sí lo pone), y hoy nadie la usa.
   - Corrección: fijar `Collapsible` en el §13, o cambiar CA-1 a «anuncia su estado abierto o cerrado», con una aserción válida para `<details>`.

8. **La dependencia de `Kpi`/`Panel` no está justificada y bloquea C2 sin necesidad aparente.**
   - Evidencia: §14 (`:69`) bloquea C2 hasta que se apruebe y se entregue `SDD-20261031-ux-legibility-contrast`, que está en «Borrador» con «Ticket: por asignar» (`docs/sdd/SDD-20261031-ux-legibility-contrast.md:4-5`). Ningún CA de C2 usa `Kpi` ni `Panel`.
   - Ese SDD deja además sin leer los paneles de Métricas (`:83`, «[Por verificar]»).
   - Corrección: decir qué parte de C2 necesita `Kpi`/`Panel` o el suelo de 12 px. Si es solo un conflicto de archivo, pasarlo a «Coordinar con» y quitar el bloqueo.

9. **El §4 no tiene línea base y el §17 no contiene el informe.**
   - Evidencia:
     - «objetivo 0» sin número de partida para explicaciones ni para marcas (`:24`), aunque el §3 da recuentos.
     - §17 «No revisado (… ver §17 de C1)» (`:78`).
     - Falta el párrafo «Versión 2» que llevan A y C1.
   - Corrección:
     - Poner la línea base del §3 en el §4: 16 explicaciones en `/metrics` y 3 confirmadas en Theory U, y ~50 «—» por clasificar.
     - Copiar o enlazar en el §17 las objeciones 3, 7, 8, 9 y 11 de la primera pasada, y añadir esta segunda pasada.
     - Añadir el párrafo de versión.


Informe de la tercera pasada (sobre v3; sus bloqueantes se corrigen en v4), copiado sin editar:

- Veredicto del gate (tercera pasada): Objeciones
- Objeciones de la segunda pasada:
  - 1: resuelta. C2 §5 (`:60`) manda carga, error y vacío de `/metrics` a C1, y C1 v3 los asume (`ux-core-screens-pattern.md:7`, E-1 y E-2 en `:24`, `:28`).
  - 2: resuelta. A fija todas las palabras, también «Real · …» (A CA-6 y CA-9, `metrics-honest-data.md:111`, `:119`). Las ventanas y los «—» quedan fuera (C2 `:58-59`). «repartido por clientes ganados» ya no está en el texto vivo de A.
  - 3: resuelta en los tests. CA-4 exige un solo nodo de texto, CA-5 amplía `data-marks.ts` y U-2 ejecuta los tests de A sin tocarlos. Aparece un problema nuevo con los tipos (bloqueante 2).
  - 4: resuelta. C1 §9 y §14 sacan la pista de `listening.tsx:49` (`ux-core-screens-pattern.md:108`, `:143`), y C2 pliega solo las 223 visibles de Scharmer.
  - 5: resuelta. El botón dice «Más sobre esto» en Theory U y no se pliega nada en `/hub`. El texto sigue abierto (§15.2), que no es objeción.
  - 6: resuelta. El §8 usa «160 visibles o menos» (`:81`). Volví a contar X-1 (174), X-3 (191), la frase de X-4 (227), X-6 (163), X-9 (311 y 223), X-10 (264), X-11 (194) y X-12 (169): todas coinciden.
  - 7: parcial. `<details>` sale y se fija `Collapsible`, pero el Radix instalado no pone `aria-controls` mientras está cerrado (bloqueante 1).
  - 8: resuelta. Ya no depende de `Kpi`/`Panel`; la legibilidad pasa a «Coordinar con» (§14, `:132`).
  - 9: resuelta salvo un detalle. El §4 tiene línea base, el §17 tiene el informe y hay párrafo de versión, pero la línea del veredicto sigue diciendo «No revisado» (`:167`).
- CA sin prueba posible o sin G-n: CA-1, tal como está escrito, no puede pasar con `Collapsible` porque cerrado no hay `aria-controls` (bloqueante 1). El resto, ninguno. No hay PRD, así que no exijo G-n.
- [Por verificar] que sigue sin comprobarse:
  - El umbral de 160 caracteres (§15.1) y los textos de los botones (§15.2): abiertas, son de Fede.
  - Si la lista es completa. No repetí el recorrido del árbol de TypeScript. X-2, X-5, X-7 y X-8 solo los conté a ojo.
  - La lista del §9 sobre la rama integrada (lo hace U-1).
  - Teclado y móvil a 375 px (lo hace `nokko-walkthrough`).
  - Cómo pinta A su `DataMark` y cómo lo llama: A aún no tiene código.
- Contradicciones con el código o con decisiones previas:
  - CA-1 (`:72`) y §13 (`:125`) dicen que el disparador lleva `aria-controls`. Radix 1.1.20 solo lo pone abierto (`node_modules/@radix-ui/react-collapsible/dist/index.mjs:66`, versión fijada en `bun.lock:557`).
  - El tipo de `DataState` (§13, `:126-127`) dice ser «el mismo de `DataMark` (A §13)», pero A define `reason?` opcional en los tres estados (`metrics-honest-data.md:178`).
  - El §14 (`:135`) trata como hipótesis que D pase de 160 en `hub.tsx:161-164`. El texto que fija D (`agent-rules-reader.md:100`) da 181 visibles con el método del §3 (hoy 146), así que U-1 se va a parar seguro.
  - Las decisiones de Fede del 2026-11-06 están bien reflejadas: rama perdida en §14 `:132`. Las demás no tocan a C2.
- Lo que esta revisión NO demuestra:
  - No ejecuté tests, build ni `tsc`, ni miré nada en un navegador.
  - En `src/`, entre `f76f639` y `HEAD`, solo cambia `src/test/factory-ledger.test.ts`, que no tiene que ver con C2.
  - No escribí el recorrido de TypeScript. Las cuentas son a mano, con Python, sobre literales copiados.
  - Leí C1, A y D solo en lo que cruzan con C2.
  - Los tests de A no existen, así que la compatibilidad con `getByText` es teórica.
  - No miré datos de producción.

**Objeciones bloqueantes**

1. **CA-1 no puede pasar con `Collapsible` tal como está escrito.**
   - Evidencia: CA-1 (`ux-metrics-data-state.md:72`) exige, con el bloque cerrado, «`aria-expanded="false"` y `aria-controls` apuntando al contenido». El §13 (`:125`) dice que «`CollapsibleTrigger` pone `aria-expanded` y `aria-controls`». En el Radix instalado:
     - `node_modules/@radix-ui/react-collapsible/dist/index.mjs:66` tiene `"aria-controls": context.open ? context.contentId : void 0`: cerrado, no hay atributo.
     - El contenedor sí existe cerrado, con `id` y `hidden`, pero sin hijos (`:127-137`).
   - Corrección, una de dos:
     - Que CA-1 pida `aria-controls` solo abierto, igual al `id` del contenido.
     - O que el §13 diga que `ExplanationFold` pasa `aria-controls` y el `id` del contenido de forma explícita. Radix esparce las props del usuario después de las suyas (`:71`), así que se pueden sobrescribir.
   - Aclarar también en CA-1 que «el contenido no está en el documento» se refiere a los hijos, no al contenedor vacío de Radix.

2. **`DataState` cambia las props de `DataMark` de A, aunque U-2 promete lo contrario.**
   - Evidencia:
     - A §13 tiene `DataMark({ state: "real" | "estimado" | "sin_dato", reason? })` (`metrics-honest-data.md:178`), y A está aprobado.
     - C2 §13 (`:126-127`) fija la unión `{ state: "real"; reason?: string } | { state: "estimado" | "sin_dato"; reason: string }` y hace `export { DataState as DataMark }`.
     - U-2 (`:122`) dice «sin cambiar sus props».
   - Problema: si A llama `<DataMark state={m.state} reason={m.reason} />` con `state` de tipo unión y `reason: string | undefined`, TypeScript lo rechaza. Vitest no comprueba tipos, así que los tests de A pasarían y el fallo saldría en el build de Lovable.
   - Corrección, una de dos:
     - `data-mark.tsx` conserva la firma de A y delega en `DataState`.
     - O el brief permite cambiar las llamadas de A (no sus tests).
   - En los dos casos, U-2 añade `tsc --noEmit` (o el build) a su verificación.

**Notas para el brief**

- **D y la casilla de `/hub`.** El texto que fija D para la casilla «obligatorio» (`agent-rules-reader.md:100`) mide 181 visibles con el método del §3. U-1 se parará seguro. Mejor decidirlo ya: añadirlo como X-13 «fuera por regla» (descripción de un campo de formulario, como X-6) y corregir el §4, el §9 y el §14.
- **X-3 se pliega por debajo del umbral.**
  - Lo plegado mide 126 visibles, menos de 160, y no está seguido: son la primera y la tercera frase, con la pista en medio.
  - Esto choca con la lógica de X-4, que se mide por lo que quedaría.
  - Conviene llevárselo a Fede junto con el §15.1. Y en CA-2, cambiar «el texto del bloque aparece completo y sin cambios» por «el texto de la columna Plegado del §9», que es lo que vale para X-3 y X-8.
- **X-8 tiene tres avisos condicionados, no dos.** El tercero es `other_currencies` (`stripe-panel.tsx:157-159`), y CA-2 solo prueba `truncated` y `unpriced_items`. Hay que añadirlo a la lectura ficticia.
- **El método del §3 no ve el texto dentro de `{…}`**, porque lo cuenta como un carácter:
  - `src/components/leads/lead-funnel-panel.tsx:58` mide 179 visibles cuando sale el aviso de «Entrada directa». Es un aviso condicionado, así que se queda a la vista por regla.
  - `metrics.tsx:397` mide 159 con «EUR».
  - Que U-1 los declare para que no parezcan olvidos.
- **§17 desactualizado.** La línea del veredicto debería decir «Objeciones», que es el resultado de la segunda pasada, no «No revisado» (`:167`).
- **Cómo hacer los tests de uso.** El de `/metrics` puede pintar `StripeMetricsPanel` con el mock de Supabase: lee `stripe_snapshots.details` (`stripe-panel.tsx:20`, `:131`), sin `useServerFn`. Los de Theory U montan `Listening`, `CaseClinics` y `Prototypes`, que existen como exports, pero tras C1 pasan por su `ScreenState` y el mock debe devolver datos.


Revisión de coherencia entre los cinco SDD del sprint: `docs/sdd/annex/sprint1-cross-sdd-gate-20261106.md`.

## 18. Delta de implementación (lo rellena el agente al entregar)
—
