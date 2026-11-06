# SDD-20261106-ux-core-screens-pattern · [Mejora] NK-0051 ampliado: un mismo patrón de pantalla en Métricas, Theory U y Conocimiento

**Tipo:** Mejora · **Prioridad propuesta:** Media
**Estado:** Borrador · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-11-06 · **Ticket:** NK-0051 (ampliación decidida por Fede: no se abre ticket aparte)
**PRD:** No aplica (mejora acotada; contexto en `docs/UX-INFORME-20261031.md`) · **Depende de:** `SDD-20261031-ux-palette-graphite` y `SDD-20261031-ux-legibility-contrast` (tokens, `Kpi`/`Panel` compartidos y suelo de 12 px: este SDD los usa, no los redefine); `SDD-20261106-metrics-honest-data` (SDD-A) y `SDD-20261106-hub-search` (SDD-B) se integran **antes** · **Coordinar con:** PR #76 de Plays (toca `src/lib/headlines.ts` y `src/lib/nav.ts`), `SDD-20261025-theory-u-proactive-decision-support`

> Sprint 1 de mejoras en pantallas core, bloque C. Rehecho el 2026-11-06 tras perderse la versión anterior (no llegó a subirse).
> **Base de NK-0051:** la rama local `feat/ux-graphite-legibility-move` no está en el remoto (comprobado el 2026-11-06 con `git ls-remote`). Este SDD parte de `main` @ `f76f639`; si esa rama aparece, el brief tendrá que rebasar sobre ella.

## 1. Resumen
Los tres SDD de NK-0051 arreglan piezas transversales (paleta, contraste, piezas compartidas, mover sin arrastrar). Este cuarto SDD aplica, a nivel de pantalla, un mismo patrón en `/metrics`, `/theory-u` y `/hub`: la sección vive en la URL, no se muestra «vacío» mientras se carga, cada vacío dice qué hacer, las pistas son enlaces, las explicaciones largas se pliegan y el estado de un dato («Sin dato», «Estimado») tiene siempre la misma forma. No cambia ningún cálculo ni ningún dato.

## 2. Problema y para quién
Cualquier persona que usa estas tres pantallas: ve «Sin documentos todavía» cuando sí los hay, pierde la pestaña al volver atrás o al compartir un enlace, y lee párrafos de tres líneas antes de llegar a la cifra.

## 3. Evidencia y por qué ahora
Leído en `main` @ `f76f639`:

| # | Problema | Dónde |
|---|---|---|
| E-1 | Vacío falso mientras carga: la consulta usa `[]` por defecto y el vacío se pinta antes de tener datos | `src/routes/_authenticated/hub.tsx:58` + `:132`; `src/components/theory-u/journey.tsx:30` + `:69`. [Por verificar] el resto de pestañas de Theory U (`sensing.tsx:80`, `listening.tsx:71`, `prototypes.tsx:133`) |
| E-2 | Pantalla en blanco mientras carga | `src/routes/_authenticated/metrics.tsx:229` (`{m && data && …}` sin estado de carga) |
| E-3 | Sección fuera de la URL: volver atrás o compartir pierde la pestaña | `theory-u.tsx:21` (`Tabs defaultValue`), `hub.tsx:53` (`useState("company")`). `/metrics` ya lo hace con `?seccion=` (`metrics.tsx:94`, `:219-226`): es el modelo |
| E-4 | Pista sin enlace | `src/components/theory-u/listening.tsx:71` («Cuentas → Planificador de reuniones»). Las de `/metrics` las corrige SDD-A (CA-10) |
| E-5 | Explicaciones largas fijas (párrafos de más de 200 caracteres de código en texto secundario) | `self-service-funnel.tsx` 4, `segment-coverage.tsx` 3, `metrics/finance-panel.tsx` 2, `cac-panel.tsx` 1, `quarter-kpis-panel.tsx` 1, `budget-panel.tsx` 1 (recuento con `awk 'length>200'` sobre líneas con `muted-foreground` o `<Muted`; es una aproximación, el test de U-4 fija la lista) |
| E-6 | Estado de dato sin forma común: hoy «—» (`cac-panel.tsx:203-207`, `segment-coverage.tsx:121-122`), «estimado» (`segment-coverage.tsx:119`) y textos libres; SDD-A añade «Sin dato · …» y «estimado: …» | `/metrics` |
| E-7 | Vacíos que informan sin orientar | `metrics/revops-panels.tsx:53`, `:87`; `theory-u/case-clinic.tsx:89` |

Informe UX de origen: puntos 6 (carga y vacío), 7 (explicaciones bajo demanda) y 15 (Métricas) de `docs/UX-INFORME-20261031.md`.
Uso de estas pantallas: sin dato.

## 4. Resultado buscado
Medible por código (línea base en §3, objetivo 0): vacíos falsos en carga, pantallas en blanco en carga, secciones fuera de la URL, pistas sin enlace, explicaciones largas fijas y formas distintas de «sin dato» en las tres pantallas. Uso o satisfacción: sin dato.

## 5. Alcance
**Incluye:** en `/metrics`, `/theory-u` y `/hub`, y en los componentes que solo montan esas pantallas:
- P-1 Sección o pestaña en la URL (`?seccion=`).
- P-2 Estado de carga distinto del vacío.
- P-3 Vacío con frase de qué es y una acción siguiente cuando exista.
- P-4 Pistas que nombran otro sitio, como enlace.
- P-5 Explicaciones de más de una línea, detrás de «Cómo se calcula».
- P-6 Un componente único para el estado de un dato: «Sin dato», «Estimado», «Real».

**No incluye:**
- Valores de paleta, tokens, tamaño de letra, `Kpi`/`Panel`/`Stat` compartidos (los otros SDD de NK-0051).
- Cálculos, cifras y textos de datos de `/metrics` (SDD-A) y la búsqueda de `/hub` (SDD-B).
- Reorganizar el Resumen de Métricas en 4-5 KPI (punto 15 del informe): ver §15.
- Titulares con conclusión nuevos para Theory U y Conocimiento: tocarían `src/lib/headlines.ts`, que modifica el PR #76; ver §15.
- Botón «Llevar a GTM Lab» en Theory U (Sprint 3) y avisos proactivos de Theory U (`SDD-20261025-theory-u-proactive-decision-support`).
- `src/lib/nav.ts`, `/strategy`, `/memory` y cualquier otra pantalla.
- Esquema, RLS, IA.

## 6. Cambios de comportamiento (delta)
**Añadido:** `?seccion=` en `/hub` y `/theory-u`; estados de carga; botón «Cómo se calcula» en los paneles de E-5; componente de estado de dato.
**Modificado:** vacíos de E-1 solo tras cargar; textos de E-7 con acción; pista de E-4 como enlace; marcas de dato de E-6 con una sola forma.
**Eliminado:** nada visible salvo los párrafos fijos de E-5 (siguen accesibles plegados).

## 7. Historias y criterios de aceptación
### H-1: Como persona del equipo, quiero que la pantalla no me mienta mientras carga, para no creer que no hay nada.
- **CA-1** En `/hub`, `/theory-u` (todas las pestañas) y `/metrics`, mientras la consulta principal no ha respondido, la pantalla muestra el estado de carga y nunca el texto de vacío. · prueba: `src/components/screen-state.test.tsx`
- **CA-2** Si la consulta falla, la pantalla muestra el error con `errorText()` («qué pasó + qué hacer») y no el vacío. · prueba: `src/components/screen-state.test.tsx`

### H-2: Como persona del equipo, quiero volver atrás o compartir el enlace sin perder la pestaña.
- **CA-3** `/hub?seccion=<id>` y `/theory-u?seccion=<id>` abren esa sección; cambiar de sección actualiza la URL; un valor desconocido abre la sección por defecto. `?doc=` y `?q=` de `/hub` siguen funcionando. · prueba: `src/lib/screen-sections.test.ts`

### H-3: Como persona del equipo, quiero que un vacío o una pista me digan qué hacer y me lleven allí.
- **CA-4** Cada vacío de E-7 dice qué es y, si existe una acción en la pantalla o en otra, ofrece un botón o enlace a ella. · prueba: `src/components/empty-actions.test.tsx`
- **CA-5** En las tres pantallas, ningún texto nombra otra pantalla o sección («X → Y», «más abajo», «en «X»») sin ser un enlace. · prueba: `src/components/hints-are-links.test.ts` (recorre los archivos del alcance)

### H-4: Como Owner o Sales Leader, quiero ver la cifra antes que la explicación, y saber de un vistazo si es real.
- **CA-6** Ningún panel del alcance muestra fija una explicación de más de una línea: va detrás de «Cómo se calcula», que se abre con teclado y ratón y anuncia su estado a lectores de pantalla. · prueba: `src/components/how-calculated.test.tsx`
- **CA-7** Toda marca de estado de dato en `/metrics` usa el mismo componente con una de tres palabras («Real», «Estimado», «Sin dato») más el motivo; ningún «—» suelto representa la falta de un dato. · prueba: `src/components/data-state.test.tsx`

## 8. Casos límite y errores
- Red caída o RLS que devuelve error: CA-2.
- Sección en la URL que el rol no puede ver (Finanzas sin ser Owner ni Sales Leader, `metrics.tsx:218`): se abre Resumen, como hoy.
- Pestaña de Theory U con varias consultas: el estado de carga dura hasta que responde la que decide el vacío.
- Móvil: «Cómo se calcula» no puede tapar la cifra; se despliega debajo.

## 9. Experiencia y copy
- «Cargando…» solo como texto accesible del esqueleto; la forma la da el esqueleto (un tipo por bloque: lista, tarjetas, tabla).
- «Cómo se calcula» / «Ocultar cálculo».
- «Real», «Estimado», «Sin dato», cada una seguida de « · motivo» cuando lo hay. La palabra lleva el estado; el color solo acompaña.
- Vacíos (E-7), propuesta: «Ningún deal perdido en {T}. Cuando marques uno como perdido, verás aquí por qué.»; «Aún no hay deals. Crea el primero en Pipeline.» (enlace); «Elige una clínica de la lista o crea una con «Nueva clínica».» [Por verificar] el nombre exacto del botón en `case-clinic.tsx`.
- `listening.tsx:71`: «Planificador de reuniones» enlaza a su pantalla. [Por verificar] la ruta exacta.
- Español, «tú», sin iconos.

## 10. Datos, permisos y privacidad
Sin cambios de datos, consultas, RLS ni GRANT. Tests con datos ficticios.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| ninguna | — | — | — |

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | `ScreenState` (carga, error, vacío) en `src/components/page.tsx` junto a `Empty`, y su uso en las tres pantallas | CA-1, CA-2 | `src/components/screen-state.test.tsx` |
| U-2 | Sección en la URL en `/hub` y `/theory-u` (reglas puras de validación en `src/lib/screen-sections.ts`) | CA-3 | `src/lib/screen-sections.test.ts` |
| U-3 | Vacíos con acción y pistas como enlace | CA-4, CA-5 | `src/components/empty-actions.test.tsx`, `src/components/hints-are-links.test.ts` |
| U-4 | `HowCalculated` y paneles de E-5 | CA-6 | `src/components/how-calculated.test.tsx` |
| U-5 | `DataState` y su uso en `/metrics` (sustituye «—» y textos sueltos, incluidos los que añade SDD-A) | CA-7 | `src/components/data-state.test.tsx` |

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- `ScreenState` recibe el resultado de `useQuery` (`isPending`, `error`, `data`) y decide; quita el `= []` por defecto de las consultas afectadas para que «sin datos» y «cargando» no se confundan.
- `validateSearch` de `hub.tsx:23` pasa a `{ doc?, q?, seccion? }` (`q` lo añade SDD-B). En `theory-u.tsx`, `Tabs value` controlado desde la búsqueda, con `navigate({ replace: true })`.
- `DataState` debe estar disponible antes de que SDD-A se construya si se quiere evitar retocar dos veces sus textos. Alternativa (propuesta): SDD-A entrega solo textos y U-5 de este SDD los envuelve después. El brief fija el orden.
- `HowCalculated`: `Collapsible` de `src/components/ui` si existe [Por verificar]; si no, `<details>`/`<summary>` con estilo del sistema.
- Contrato con SDD-A y SDD-B (mismos archivos): A y B cambian comportamiento y textos; C cambia estructura, estados y presentación. Orden de integración: A → B → C.

## 14. Riesgos y dependencias
- Depende de que los SDD de paleta y legibilidad de NK-0051 estén integrados (o al menos `Kpi`/`Panel` compartidos); si no, U-1 y U-5 crearían piezas que esos SDD también crean. Mitigación: el brief comprueba la base.
- La rama local de NK-0051 (`feat/ux-graphite-legibility-move`) no está en el remoto: si existe en otra máquina, puede chocar con todo lo de arriba. [Por verificar] con Fede.
- Tres pantallas en un SDD: si el gate lo ve grande, se parte por pantalla sin cambiar los CA.

## 15. Preguntas para Fede y para la revisión técnica
1. **Resumen de Métricas en 4-5 KPI** (punto 15 del informe UX): ¿entra aquí, va a un SDD propio o se espera a tener uso real de la pantalla?
2. **Titulares con conclusión** para Conocimiento y Theory U (como Métricas o Memoria): ¿los quieres? Si sí, se añaden en `headlines.ts` después de integrar el PR #76.
3. **Rama local de NK-0051:** ¿existe en otra máquina o se perdió? Si se perdió, los SDD de paleta y legibilidad están en «Borrador» sin código, y este SDD queda detrás de ellos.

## 16. Pendiente de verificar
- Vacíos falsos en `sensing.tsx`, `listening.tsx`, `prototypes.tsx`, `case-clinic.tsx`: el gate, leyendo sus consultas.
- Ruta del Planificador de reuniones y nombre del botón de nueva clínica: el gate.
- Existencia de `Collapsible` en `src/components/ui`: el gate.
- Estado real de la rama local de NK-0051: Fede.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
- Veredicto del gate: No revisado
- CA sin prueba posible o sin G-n: —
- [Por verificar] que sigue sin comprobarse: —
- Contradicciones con el código o con decisiones previas: —
- Lo que esta revisión NO demuestra: —

## 18. Delta de implementación (lo rellena el agente al entregar)
—
