# SDD-20261106-hub-search · [Mejora] Buscar en Conocimiento

**Tipo:** Mejora · **Prioridad propuesta:** Media
**Estado:** Aprobado por Fede el 2026-11-06 («OK a todo» en el chat, tras tres pasadas del gate y la revisión de coherencia) · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-11-06
**Ticket:** NK-0067
**PRD:** No aplica (mejora acotada de una pantalla, sin esquema nuevo) · **Depende de:** — · **Coordinar con:** NK-0051 (SDD-C1 `SDD-20261106-ux-core-screens-pattern` y SDD-C2 `SDD-20261106-ux-metrics-data-state` de este sprint; C1 amplía el test de pantalla que crea este SDD), SDD-D `SDD-20261106-agent-rules-reader` (toca los textos de la sección Reglas y de la casilla «obligatorio», que este SDD mueve de archivo; ver §13), NK-0053 (`SDD-20261030-gtm-control-tower-5a-agent-memory`, toca `memory.tsx`)

> **Renumeración (2026-11-08):** los tickets del sprint usan la numeración de `main` (reservada en la PR #111): A = NK-0068, B = NK-0067, D = NK-0087, C1 = NK-0088, C2 = NK-0089 (ampliaciones de NK-0051, ya entregado en PR #91), bug falso rechazado = NK-0090, seguimientos, Sprint 2 y hallazgos previos = NK-0091 a NK-0103. Fuera del §17 este documento ya usa la numeración nueva; los informes del gate del §17 son copias literales y conservan la numeración con la que se escribieron (primera: NK-0066→0090, 0067→0068, 0068→0067, 0069→0087, 0070…0075→0091…0096). Ramas, briefs y evidencias anteriores conservan los nombres de rama originales.

> Sprint 1 de mejoras en pantallas core, bloque B. Rehecho el 2026-11-06 tras perderse la versión anterior (no llegó a subirse).

## 1. Resumen
Conocimiento (`/hub`) no tiene buscador: para encontrar un documento hay que adivinar su sección y recorrer la lista. Se añade una caja de búsqueda que encuentra documentos por título y contenido en las siete secciones a la vez, sin distinguir mayúsculas ni acentos, y que se puede compartir por URL. Sin IA, sin esquema nuevo y sin consultas nuevas. Para poder probar la pantalla, su código sale de la ruta a `src/components/hub/` (regla «Big screens keep only route config…» de `AGENTS.md`).

## 2. Problema y para quién
Cualquier persona del equipo que busca una respuesta a una objeción, un playbook o una regla y no recuerda dónde está guardada.

## 3. Evidencia y por qué ahora
Leído en `main` @ `f76f639`:
- `src/routes/_authenticated/hub.tsx:58-62`: carga todos los `knowledge_docs` visibles (`select("*")`, sin paginar, `:60`) y filtra solo por sección (`:62`).
- `hub.tsx:28-36`: siete secciones (`company`, `objections`, `playbooks`, `methodology`, `campaigns`, `skills`, `rules`) en una constante local; `DRIVE_TAB` (`:39`) es otra pestaña que no son documentos de Conocimiento.
- `hub.tsx:23`: la URL ya admite `?doc=`; no admite búsqueda.
- `hub.tsx:50`: el componente `Hub` no se exporta y vive en la ruta junto con `Editor` (`:147-177`); hoy no hay forma de renderizarlo en un test, y no hay ningún test en `src/routes`.
- `hub.tsx:132`, `:138`: estados vacíos con `Empty` (`src/components/page`).
- `src/lib/match.ts:67` y `:69`: la normalización sin acentos (`normalize("NFD")` + quitar diacríticos + minúsculas) existe, pero repetida y como cierre local no exportado.
- `src/routes/_authenticated/memory.tsx:37-40`: patrón de filtro en cliente con `useMemo`, pero con `toLowerCase()` sin quitar acentos: buscar «decision» no encuentra «decisión».
- El buscador global (⌘K, `src/components/command-palette.tsx:40-43`) solo consulta accounts, leads, people y deals; no busca en `knowledge_docs`.
- Tercer buscador sobre `knowledge_docs`: la herramienta del agente `search_knowledge` (`src/lib/agent/tools/core-read.ts:236`) filtra en el servidor con `ilike` sobre título y cuerpo, que no ignora acentos: desde el agente «decision» no encuentra «Decisión», y desde la pantalla sí lo hará. Los documentos personales de otros ya se filtran en memoria (`:237`). Queda fuera de este SDD salvo que Fede diga otra cosa (§5, §15.5).
- Número de documentos por empresa: sin dato. Hoy la lectura sin paginar se queda en el tope de filas del backend sin avisar (`src/lib/fetch-all.ts:1-6`, regla de `src/lib/AGENTS.md:49`); con CA-9 la lectura pasa a `fetchAll` y, si aun así queda cortada, la pantalla lo dice. [Por verificar] el `max_rows` real en producción; el resultado de este SDD no depende de él.

## 4. Resultado buscado
- Encontrar un documento sin saber su sección. Línea base: imposible hoy (no hay búsqueda). Tiempo o frecuencia de búsqueda: sin dato.

## 5. Alcance
**Incluye:**
- Extraer la pantalla de `/hub` a `src/components/hub/` sin cambiar su comportamiento (U-0), con el único test de pantalla `src/components/hub/hub-screen.test.tsx`.
- Caja de búsqueda en `/hub` sobre título y contenido de los documentos de las 7 secciones.
- Normalización sin acentos ni mayúsculas, compartida y probada.
- `?q=` en la URL.
- Recuento de coincidencias por sección mientras hay búsqueda.
- Fragmento del contenido alrededor de la coincidencia.
- Lectura de documentos paginada con `fetchAll` y aviso de truncado (CA-9). C1 añade sobre esta misma consulta los estados de carga y error y el lanzar el error.

**No incluye:**
- Búsqueda semántica o con IA, ranking por relevancia más allá de «título antes que contenido».
- Buscar en «Drive por cuenta».
- Añadir Conocimiento al buscador global ⌘K.
- Cambiar el filtro de `/memory` (lo toca NK-0053; ver §15.1).
- Búsqueda en servidor.
- Unificar las otras ~15 copias de la misma normalización (`scoring.ts:50`, `discoveries.ts:15`, `stages.ts:32`, `provenance.ts:229`…): este SDD unifica solo `match.ts` y Conocimiento.
- La herramienta del agente `search_knowledge` (`core-read.ts:236`): divergencia conocida, propuesta fuera; la decisión es de Fede (§15.5). Si la deja fuera, no cambia nada más en este SDD.
- Estados de carga, error y vacío de la pantalla, sección en la URL y estilo visual (NK-0051: C1 y C2). Textos de la sección Reglas y de la casilla «obligatorio» (SDD-D).
- Esquema, RLS, migraciones.

## 6. Cambios de comportamiento (delta)
**Añadido:** caja «Buscar en Conocimiento»; parámetro `?q=`; fragmento del contenido; estado vacío de búsqueda; aviso de lectura truncada; función compartida de normalización y coincidencia.
**Modificado:** con búsqueda activa, la lista muestra coincidencias de todas las secciones, cada una con el nombre de su sección, y el número junto a cada sección pasa de «documentos de la sección» a «coincidencias en la sección». Sin búsqueda, todo igual que hoy. El código de la pantalla cambia de archivo (sin cambio visible).
**Eliminado:** nada.

## 7. Historias y criterios de aceptación
### H-0: Como responsable de la pantalla, quiero poder probar `/hub`, para que los cambios del sprint no la rompan.
- **CA-0** La ruta `src/routes/_authenticated/hub.tsx` solo conserva `validateSearch`, `head` y `component: HubScreen`; `HubScreen` se exporta desde `src/components/hub/hub-screen.tsx` y, sin búsqueda, se comporta igual que hoy: lista de la sección, contadores por sección, abrir con `?doc=`, «+ Nuevo» y abrir un documento tras importar. · prueba: `src/components/hub/hub-screen.test.tsx` («sin búsqueda, igual que antes»)

### H-1: Como miembro del equipo, quiero buscar en todo Conocimiento, para encontrar un documento sin saber dónde está.
- **CA-1** Al escribir un texto, la lista muestra los documentos de cualquiera de las 7 secciones cuyo título o contenido lo contiene, sin distinguir mayúsculas ni acentos («decision» encuentra «Decisión»), con coincidencia literal («C++», «(beta)»). · prueba: `src/lib/text-search.test.ts`
- **CA-2** Los resultados con coincidencia en el título van antes que los que solo coinciden en el contenido; dentro de cada grupo, el orden de la lectura (`updated_at` descendente, `id` como desempate). · prueba: `src/lib/text-search.test.ts`
- **CA-3** Cada resultado lleva el id de su sección y, si la coincidencia está solo en el contenido, un fragmento del texto original alrededor de ella de hasta 120 grafemas (contados con `Intl.Segmenter`, granularidad `grapheme`), con «…» en los extremos cortados (no cuentan en los 120). Los bordes del fragmento nunca parten un grafema: un emoji compuesto con ZWJ («👩‍💻») o una letra con marca combinante («e» + U+0301) en el borde queda entero dentro o entero fuera, nunca a medias. Casos de prueba con su resultado esperado: texto ya descompuesto («Decisión» buscado como «decision» devuelve «Decisión» entero), Hangul, «👩‍💻» en el borde (entero o ausente), «e» + U+0301 en el borde (entera o ausente), «C++», «(beta)». La pantalla muestra el nombre de la sección. · prueba: `src/lib/text-search.test.ts` (id y fragmento) y `src/components/hub/hub-screen.test.tsx` (nombre de sección visible en cada resultado)
- **CA-4** Con búsqueda activa, el número junto a cada sección es el de coincidencias en esa sección; al vaciar la caja, vuelve al total de documentos. · prueba: `src/lib/hub-search.test.ts` (recuentos) y `src/components/hub/hub-screen.test.tsx` (con «decision» y documentos ficticios en dos secciones, cada botón de sección muestra su número de coincidencias y, al borrar, su total)
- **CA-5** Sin coincidencias, y solo cuando la consulta de documentos ha respondido, la pantalla dice «Nada coincide con «{texto}». Prueba con otra palabra o crea un documento con «+ Nuevo».»; mientras carga, nunca. · prueba: `src/components/hub/hub-screen.test.tsx` (con Supabase simulado sin responder no aparece; tras responder, sí)

### H-2: Como miembro del equipo, quiero compartir una búsqueda, para enviar a un compañero lo que encontré.
- **CA-6** El texto se refleja en `?q=` sin borrar los demás parámetros (`doc`, y `seccion` cuando exista por SDD-C1); al abrir `/hub?q=texto` la búsqueda aparece ya aplicada; un `q` vacío o de solo espacios se descarta. · prueba: `src/lib/hub-search.test.ts` (validación de `q` y búsqueda siguiente) y `src/components/hub/hub-screen.test.tsx` (apertura con `q` y llamada a `navigate` con función que conserva `doc`)
- **CA-7** Escape o el botón «Borrar búsqueda» vacían la caja y quitan `?q=` sin tocar `doc`. · prueba: `src/lib/hub-search.test.ts` y `src/components/hub/hub-screen.test.tsx`

### H-3: Como responsable de la pantalla, quiero que la pantalla y los duplicados normalicen igual, para que no den resultados distintos.
- **CA-8** `src/lib/match.ts` (`:67` y `:69`) y la búsqueda de Conocimiento usan la misma función exportada `foldText` de `src/lib/text-search.ts`, que devuelve `""` para null; los tests existentes de `match.ts` pasan sin cambios y se añaden casos con `sub`/`domain` null y texto ya descompuesto. · prueba: `src/lib/match.test.ts` y `src/lib/text-search.test.ts`

### H-4: Como miembro del equipo, quiero que la búsqueda vea todos los documentos.
- **CA-9** Los documentos se leen paginados con `fetchAll` (regla de `src/lib/AGENTS.md:49`); la caché `["docs"]` guarda `{ rows, truncated }` y todos sus lectores usan `rows`; si `truncated` es verdadero, la pantalla dice «Se muestran los primeros {N} documentos; la búsqueda no incluye el resto.». Tras «Importar de Drive» o «Battlecard desde reseñas», el documento nuevo se abre igual que hoy. · prueba: `src/lib/hub-search.test.ts` (texto del aviso) y `src/components/hub/hub-screen.test.tsx` (con `@/lib/fetch-all` simulado devolviendo `truncated: true` aparece el aviso; y el caso «abrir tras importar»: el `DriveImportButton` simulado llama a `onImported("d2")`, la segunda lectura incluye `d2` y el editor muestra su título sin error)

## 8. Casos límite y errores
- Texto de solo espacios: no hay búsqueda.
- Texto de un carácter: busca (la lista es local, coste nulo). [Sugerencia] si el gate ve un problema de rendimiento con muchos documentos, mínimo 2 caracteres.
- Caracteres especiales de expresión regular («C++», «(beta)»): coincidencia literal, nunca expresión regular. Se cubre en CA-1.
- Grafemas en el borde del fragmento (emoji ZWJ, marcas combinantes, Hangul): enteros dentro o enteros fuera (CA-3). Si el navegador no tuviera `Intl.Segmenter` (disponible en todos los navegadores actuales y en Node, y tipado en `lib` ES2022 de `tsconfig.json:13`), se recorta por puntos de código: puede partir un emoji compuesto, nunca un par sustituto. Se acepta como degradación.
- Documento personal de otra persona: no llega al cliente (RLS actual); la búsqueda no cambia la consulta.
- Documento seleccionado que deja de coincidir: el editor sigue abierto; la lista no lo muestra.
- Pestaña «Drive por cuenta» con búsqueda: la caja se oculta en esa pestaña.
- Lectura cortada por el tope de `fetchAll`: CA-9.
- «+ Nuevo», «Importar de Drive» y «Battlecard desde reseñas» con búsqueda activa: siguen visibles y actúan sobre la sección seleccionada, que sigue marcada.
- `?q=` con la pestaña «Drive por cuenta» (o `?seccion=drive` de SDD-C1; ids de sección propuestos por C1, pendientes de Fede): la caja se oculta y `q` se conserva en la URL para cuando vuelvas a una sección.
- Plegado de la «ñ»: `foldText` mantiene el comportamiento actual de `match.ts` (quita la tilde de la ñ), así que «ano» encuentra «año». Decidido por Fede el 2026-11-06 (§15.4).

## 9. Experiencia y copy
- Placeholder: «Buscar en Conocimiento». Botón: «Borrar búsqueda». Vacío: CA-5. Aviso de truncado: CA-9. Etiqueta accesible del campo: «Buscar en Conocimiento».
- Español, «tú», sin iconos en el texto.
- Posición: encima de las secciones, a lo ancho de la columna izquierda en escritorio y de la pantalla en móvil. El estilo lo fijan los SDD de NK-0051.

## 10. Datos, permisos y privacidad
Sin tablas, columnas, RLS ni GRANT nuevos. Misma consulta (`hub.tsx:60`), ahora paginada y con `id` como desempate. El texto buscado no se guarda ni se envía a ningún servicio (solo vive en la URL). Tests con documentos ficticios.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| ninguna | — | — | — |

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-0 | Extracción sin cambio de comportamiento: `src/components/hub/hub-screen.tsx` (exporta `HubScreen`, con `SECTIONS`, `DRIVE_TAB`, `Doc`) y `src/components/hub/doc-editor.tsx` (`Editor`, hoy `hub.tsx:147-177`); la ruta queda con `validateSearch`, `head` y `component: HubScreen`. Commit propio, solo movimiento | CA-0 | `src/components/hub/hub-screen.test.tsx` (falla al no existir el módulo; pasa tras mover) |
| U-1 | `foldText` exportada (sale de `match.ts:67` y `:69`) y `searchDocs` pura en `src/lib/text-search.ts` (coincidencia literal, orden, id de sección, fragmento con mapa de posiciones y bordes por grafema) | CA-1, CA-2, CA-3, CA-8 | `src/lib/text-search.test.ts` |
| U-2 | Reglas puras de la pantalla en `src/lib/hub-search.ts`: limpieza de `q`, búsqueda siguiente conservando `doc`/`seccion`, recuentos por sección, texto de truncado | CA-4, CA-6, CA-7, CA-9 | `src/lib/hub-search.test.ts` |
| U-3 | `hub-screen.tsx`: lectura con `fetchAll` y caché `{ rows, truncated }`, caja, Escape, vacío solo tras responder, nombre de sección, contadores con búsqueda, aviso de truncado; `validateSearch` de la ruta con `q` | CA-3, CA-4, CA-5, CA-6, CA-7, CA-9 | `src/components/hub/hub-screen.test.tsx` |

El simulacro de `@tanstack/react-router` exporta además `Link` (como `strategy-screens.test.tsx:42-50`) y `useRouterState: ({ select }) => select({ location: { pathname: "/hub" } })`, porque `Page` monta `FlowStrip` (`src/components/page.tsx:7`, `src/components/flow-strip.tsx:1`, `:6`). No hay tests en `src/routes/`. C1 amplía `src/components/hub/hub-screen.test.tsx` con sus casos (carga, error, `?seccion=`) sobre los mismos simulacros.

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- **Extracción (U-0):** `HubScreen` lee la URL con `useSearch({ from: "/_authenticated/hub" })` y escribe con `useNavigate({ from: "/_authenticated/hub" })`, sin importar `Route` (evita el ciclo ruta ↔ componente). Hoy `hub.tsx:63` usa `Route.useSearch()`. El test simula `@tanstack/react-router` (`useSearch` devuelve el objeto del caso, `useNavigate` un `vi.fn()`), `@/integrations/supabase/client`, `@/hooks/use-me`, `@/components/background` (`useJob`), `@/components/drive`, `@/components/linkedin` y `@/components/drive-overview`, como `src/components/strategy-screens.test.tsx:12-51`. Para el caso «mientras carga» el simulacro de Supabase devuelve una promesa que no resuelve hasta que el test lo pide. Tras U-0, los textos de D (Reglas en `SECTIONS`, `hub.tsx:35`; casilla «obligatorio», `hub.tsx:163`) viven en `src/components/hub/hub-screen.tsx` y `src/components/hub/doc-editor.tsx`.
- `foldText(s: string | null | undefined)` en `src/lib/text-search.ts` (devuelve `""` para null); `match.ts` la importa en `:67` (con `.trim()`) y `:69`. Así el hub no arrastra `match.ts` → `leads.ts`. Sin cambio de comportamiento (CA-8).
- `searchDocs(docs, q)` devuelve `{ doc, section, inTitle, snippet }[]`; la pantalla solo la llama dentro de `useMemo`. Coincidencia con `includes` sobre texto normalizado, no `RegExp`.
- Fragmento: normalizar a NFC no basta (el gate lo comprobó con texto descompuesto y Hangul). Recorrer el original por puntos de código (`for…of`), plegar cada carácter con `foldText(ch)` y guardar, para cada unidad del texto plegado, su posición en el original; la coincidencia ocupa `[map[i], map[i + q.length])` en el original. Después, segmentar el original con `Intl.Segmenter(undefined, { granularity: "grapheme" })`, ampliar el inicio y el fin de la coincidencia al borde de grafema que los contiene, y añadir grafemas a cada lado hasta 120 en total. Diferencia conocida: la sigma final griega se pliega distinto carácter a carácter; el mapa se usa solo para el recorte.
- `validateSearch` de la ruta pasa a `{ doc?: string; q?: string }` y descarta `q` vacío. Escribir con `navigate({ search: (prev) => ({ ...prev, q: q || undefined }), replace: true })`: un objeto sin `prev` borraría `doc`.
- **Lectura y forma de la caché (CA-9):** `queryFn: () => fetchAll<Doc>((a, b) => supabase.from("knowledge_docs").select("*").order("updated_at", { ascending: false }).order("id").range(a, b))` (`src/lib/fetch-all.ts:8-21`, que devuelve `{ rows, truncated }` y lanza el error, `:15`). La caché `["docs"]` guarda ese objeto. Lectores que hoy esperan un array y pasan a `rows`: la lista de la sección (`hub.tsx:62`), `useOpenDocFromUrl` (`:65`), `openDoc` (`:69`, que pasa a `qc.getQueryData<{ rows: Doc[]; truncated: boolean }>(["docs"])?.rows.find(...)`), `missingPlays` (`:74`) y los contadores (`:112`). La clave `["docs"]` solo se usa en `hub.tsx` (`:59`, `:68`, `:69`, `:75`, `:93`, `:100`; comprobado con `git grep` en `f76f639`), así que no hay otros lectores. C1 quita el `= []` por defecto y usa `isPending`/`error` de esta misma consulta.
- **Contrato entre los SDD del sprint (el mismo texto en A, B, C1, C2 y D):** A cambia datos y textos de datos de /metrics (las palabras de cada marca); B, la búsqueda de /hub; C1, estados de pantalla (carga, error, vacío) de /hub, /theory-u y /metrics, sección en la URL de /hub y /theory-u, vacíos y pistas de /hub y /theory-u; C2, el plegado de explicaciones en las tres pantallas y la forma visual (componente DataState) de las marcas de dato de /metrics. D toca la pantalla de /hub (`src/components/hub/` tras B) solo en los textos de la sección Reglas y de la casilla «obligatorio». Orden de integración: A → B → C1 → D → C2.
- C1 hereda de este SDD el vacío de búsqueda de CA-5, los contadores de CA-4 (a los que añade «sin número hasta responder») y el aviso de CA-9, y los pone en su estado de pantalla.

## 14. Riesgos y dependencias
- Rendimiento con muchos documentos largos: la búsqueda recorre los cuerpos en cada pulsación. Mitigación: `useMemo` y texto normalizado calculado una vez por carga; el fragmento (mapa y segmentación) solo se calcula para los resultados visibles. Sin dato de tamaño real.
- Cambiar la forma de la caché `["docs"]` rompe cualquier lector que siga esperando un array; CA-9 lo prueba con «abrir tras importar», y §13 enumera los lectores.
- U-0 mueve todo el archivo: B se integra antes que C1 y D, que deben reescribir sus referencias a `hub.tsx` sobre `src/components/hub/`.

## 15. Preguntas para Fede y para la revisión técnica
1. **`/memory`:** tiene el mismo problema de acentos (`memory.tsx:39`). ¿Lo añado a NK-0053 (que ya toca `memory.tsx`) o va en este SDD como una línea más? Pendiente de Fede.
2. **Buscador global ⌘K:** ¿quieres que Conocimiento aparezca ahí en un paso posterior? Pendiente de Fede.
3. ¿Búsqueda también en «Drive por cuenta», más adelante? Pendiente de Fede.
4. **Decidido por Fede (2026-11-06): se acepta.** «ano» encuentra «año» (mismo plegado que los duplicados).
5. **Agente (`search_knowledge`, `core-read.ts:236`):** propuesta por defecto, la que recoge §5: queda fuera como divergencia conocida. Ojo: no basta con aplicar `foldText` a sus resultados, porque `ilike` ya filtra en el servidor y descarta «Decisión» antes de llegar; arreglarlo exige leer más filas y filtrar en memoria, o una función en la base de datos. ¿Lo dejas fuera (y, si quieres, como ticket aparte) o lo metes aquí? Pendiente de Fede.
6. **Ids de sección en la URL de `/hub`** (los define C1): propuesta por defecto, los internos (`company` … `rules`, `drive`). Este SDD solo los usa en §8 y CA-6. Pendiente de Fede.

## 16. Pendiente de verificar
- `max_rows` real de PostgREST en producción y número de documentos por empresa: producción (con CA-9 el resultado ya no depende de ello).
- Rendimiento con documentos reales: walkthrough.

**Versión 2 (2026-11-06):** corregida tras el gate. Cambian CA-3 a CA-9, §5, §8, §12 y §13 según sus objeciones 1 a 9. No ha tenido segunda pasada del gate.

**Versión 4 (2026-11-06):** tercera pasada del gate: el simulacro del router exporta `Link` y `useRouterState` (`Page` monta `FlowStrip`).

**Versión 3 (2026-11-06):** corregida tras la segunda pasada del gate. Nueva 1: la caché `["docs"]` guarda `{ rows, truncated }`, §13 enumera todos sus lectores y CA-9 prueba «abrir tras importar». Nueva 2: la pantalla sale a `src/components/hub/hub-screen.tsx` (U-0, CA-0) y el único test de pantalla es `src/components/hub/hub-screen.test.tsx`, que C1 amplía; desaparece `-hub.test.tsx`. Nueva 3: CA-4 con prueba de pantalla y C1 hereda los contadores. Nueva 4: D en «Coordinar con» y en el orden A → B → C1 → D → C2 (contrato del sprint sustituido por el texto común); NK-0090 no aplica (`core-read.ts:237` ya filtra en memoria). Nueva 5 y primera 6: `search_knowledge` citado en §3, §5 lo deja fuera como propuesta y §15.5 queda como pregunta abierta, con la razón de por qué `foldText` sobre los resultados no basta. Nueva 6: el fragmento se recorta por grafemas con `Intl.Segmenter`, con resultado esperado para emoji ZWJ y marca combinante, y degradación declarada en §8. Nueva 7: §3 reescrito en línea con CA-9. Añadida §15.6 (ids de sección, pendiente de Fede).

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Informe de la primera pasada (sobre v1, commit `2e4261e`), copiado sin editar:

**Veredicto del gate:** Objeciones

**CA sin prueba posible o sin G-n:**
- **CA-4 a CA-7:** tal como están escritos no se pueden probar. `src/routes/_authenticated/hub.test.tsx` caería dentro del directorio de rutas, el generador de TanStack lo trataría como una ruta, y además `Hub` no se exporta (`hub.tsx:50`). Ver objeción 1.
- **CA-3, parte «nombre de su sección»:** no se puede comprobar en `src/lib/text-search.test.ts`, porque los nombres de las secciones están en una constante local de `hub.tsx:28-36`.
- Sin PRD, no se exige G-n.

**[Por verificar] que sigue sin comprobarse:**
- **Tope de 1000 filas en producción:** sigue sin comprobarse. En local nada lo cambia: `supabase/config.toml:1` solo trae `project_id` y no hay `max_rows`. Pero el repo ya da el tope por hecho y obliga a esquivarlo (`src/lib/fetch-all.ts:1-6`, `src/lib/AGENTS.md:49`).
- **Número de documentos por empresa y tamaño de los cuerpos:** sin dato.

Resueltos:
- **¿Existe `hub.test.tsx`?** No. No hay ningún test en `src/routes` (`find src/routes -name "*.test.*"` no devuelve nada). Sí hay entorno para probar componentes: `vitest.config.ts` (jsdom, `src/test/setup.ts`) y `package.json:91-92` (`@testing-library/react` ^16). Hay precedentes con mocks en `src/components/strategy-screens.test.tsx:12-41` y `src/hooks/use-open-doc-from-url.test.tsx`.
- **Riesgo de índices con NFD (§13):** es real, comprobado ejecutando el código. Normalizar a NFC no basta (objeción 4).
- **RLS de documentos personales (§8):** se confirma en `drizzle/migrations/0002_multitenant_organizations.sql:127`: `scope = 'team' or created_by = auth.uid()`.
- **⌘K no busca en `knowledge_docs`:** se confirma. `src/components/command-palette.tsx:40-43` solo consulta accounts, leads, people y deals.
- **Citas de §3 y §13:** todas cuadran con `f76f639`: `hub.tsx:23`, `:28-36`, `:39`, `:58-62`, `:60`, `:132`, `:138`, `match.ts:69`, `memory.tsx:37-40` y `:39`.

**Contradicciones con el código o con decisiones previas:**
- La consulta sin paginar de `hub.tsx:60`, que el SDD mantiene a propósito, va contra la regla de `src/lib/AGENTS.md:49`: las listas que pueden crecer se leen con `fetchAll`, nunca con un select pelado.
- Con `?q=` en la URL, el SDD crea un nuevo «vacío falso mientras carga». Es justo el problema E-1 que SDD-C quiere eliminar (`SDD-20261106-ux-core-screens-pattern.md:21`, CA-1 en `:60`). B se integra antes que C.
- §13 dice que SDD-C solo cambia «clases y estructura visual», pero SDD-C también cambia comportamiento en `hub.tsx`: añade `?seccion=` y estados de carga y error (`:37-39`, `:107`). Los dos contratos son compatibles (C:110, orden A→B→C), pero la descripción que hace B es incompleta.
- No hay contradicciones con SDD aprobados. `SDD-20261028-hooks-lint-hygiene` (CA-11 a CA-14, `?doc=`) sigue en pie siempre que se respete la objeción 7.

**Lo que esta revisión NO demuestra:**
- No hay código de implementación, así que no se ejecutó `scripts/factory/gate.mjs`. Tampoco aplica el protocolo de flakes. Además no hay `node_modules` en el repo, y no lo instalé para no tocar el árbol.
- Segunda máquina y soak: NOT RUN.
- Lo que digo del generador de rutas sale de leer el código fuente de `@tanstack/router-generator@1.167.40` (la dependencia que declara `@tanstack/router-plugin@1.168.42`) y de `@lovable.dev/vite-tanstack-config@2.26.5`, descargados en el scratchpad. No arranqué el servidor de desarrollo.
- No demuestra el `max_rows` real de producción, ni el rendimiento con documentos reales, ni cómo quedará SDD-C, que sigue en Borrador.
- El script de índices (`/tmp/claude-0/-home-user/bacbba08-45c8-5e44-9362-83bc6a346bce/scratchpad/fold.mjs`) prueba 7 casos, no todo Unicode.

---

### Objeciones detalladas

**1. El test de CA-4 a CA-7 está en un sitio donde se convierte en ruta.**
- Evidencia: el generador solo excluye ficheros que empiezan por `.` o por `-` (`getRouteNodes.js:24-29`; `config.js:23`, prefijo `-` por defecto). La configuración de Lovable no fija `routeFileIgnorePattern`. Por tanto `hub.test.tsx` se trataría como ruta hija de `/hub` y cambiaría `src/routeTree.gen.ts`. Además `Hub` no se exporta (`hub.tsx:50`).
- Corrección: en U-2, sacar a funciones puras en `src/lib/` (por ejemplo `hub-search.ts`) la limpieza de `q`, los recuentos por sección y el cálculo de la búsqueda siguiente al borrar (manteniendo `doc`), con su test `.test.ts`. La interacción (Escape, «Borrar búsqueda», texto de vacío) se prueba renderizando con mocks de supabase y del router, como en `strategy-screens.test.tsx:12-41`. Ese test va en `src/routes/_authenticated/-hub.test.tsx` (el prefijo `-` lo excluye del generador y vitest lo sigue incluyendo con `src/**/*.test.tsx`) o en `src/components/`. Hay que actualizar la ruta del test en CA-4 a CA-7, §12 y §16.

**2. Vacío falso al abrir `/hub?q=texto`.**
- Evidencia: `hub.tsx:58` usa `docs = []` por defecto. Con `q` aplicado desde la URL (CA-6), CA-5 mostraría «Nada coincide…» antes de que lleguen los datos.
- Corrección: añadir a §8 y a CA-5: «el vacío de búsqueda solo se muestra cuando la consulta ha respondido (`isSuccess`)». Probarlo en el test de componente.

**3. Tope de 1000 filas.**
- Evidencia: `hub.tsx:60` hace select sin rango; el repo ya asume el tope y lo esquiva (`fetch-all.ts:3`, `src/lib/AGENTS.md:49`, usos en `use-leads.ts:33`, `screen-queries.ts:25`).
- Corrección: usar `fetchAll((a, b) => supabase.from("knowledge_docs").select("*").order("updated_at", { ascending: false }).order("id").range(a, b))`. Es la misma consulta paginada, no una nueva, y necesita `id` como desempate para que el orden sea estable. Si `truncated` es verdadero, avisar en pantalla. La otra opción es que Fede acepte por escrito la excepción a la regla. En cualquier caso, quitar «Paginación» de «No incluye» o matizarlo.

**4. El fragmento (CA-3): la corrección que propone §13 no basta.**
- Evidencia (`fold.mjs`, con la misma normalización que `plain`):
  - Texto ya descompuesto, `"Decisio\u0301n"`: 15 unidades de origen pasan a 14, y el recorte sale `"Decisió"`.
  - Hangul: el texto crece de 11 a 15, y el recorte sale `"sion"` en vez de `"decision"`.
  - Normalizar a NFC antes arregla el primer caso, pero no el Hangul ni las marcas que no tienen forma compuesta.
- Corrección: normalizar carácter a carácter con un mapa de posiciones. Se recorre el original por puntos de código (`for…of`), se normaliza cada carácter con `foldText(ch)` y se guarda, por cada unidad del texto normalizado, su posición en el original. Con ese mapa, `[map[i], map[i + q.length]]` recorta el original. En las pruebas, ese método dio el recorte correcto en los 7 casos.
- Diferencia conocida: con la sigma final griega (`"ΟΔΟΣ"`), normalizar carácter a carácter no da lo mismo que normalizar la cadena entera. Hay que declararla o usar el mapa solo para el recorte.
- Además: definir «120 caracteres» como puntos de código (no unidades UTF-16), decir si incluye «…», y recortar sin partir pares sustitutos (emojis).
- Casos de test: texto ya descompuesto, Hangul, un emoji en el borde, «C++» y «(beta)».

**5. CA-8 se queda corto. Mover `plain` es seguro, pero incompleto.**
- `plain` es un cierre local de `searchList`, solo se usa en `match.ts:70` y nadie fuera de `match.ts` puede usarlo. Los 13 ficheros que importan de `@/lib/match` solo usan `duplicateOf`, `markKnown`, `normName` y `searchList`.
- Pero `match.ts:67` repite la misma normalización sobre la consulta (más `.trim()`).
- Corrección:
  - `foldText(s: string | null | undefined)` debe devolver `""` para null, como hace `plain`.
  - `:67` pasa a `foldText(text).trim()`.
  - `foldText` va en `src/lib/text-search.ts` y `match.ts` la importa. Así el código del hub no arrastra `match.ts` → `leads.ts`.
  - Añadir a `match.test.ts` un caso con `sub` o `domain` null y otro con texto ya descompuesto. Es una adición, no un cambio de tests existentes.
  - Declarar en §5 que quedan otras ~15 copias de la misma normalización (`scoring.ts:50`, `discoveries.ts:15`, `stages.ts:32`, `provenance.ts:229`…). H-3 unifica dos, no «una sola regla» para todo.

**6. Falta en §3 un tercer buscador sobre `knowledge_docs`.**
- Evidencia: la herramienta del agente `search_knowledge` (`src/lib/agent/tools/core-read.ts:236`) busca con `ilike`, que no ignora acentos: «decision» no encontrará «Decisión» desde el agente y sí desde la pantalla. Es justo el problema que H-3 dice evitar, y `src/lib/AGENTS.md:7` pide que las herramientas reutilicen la lógica de la pantalla.
- Corrección: citarlo en §3. En §5 o §15, decidir si queda fuera, como divergencia conocida, o si se le pasa `foldText` a los resultados.

**7. CA-6: §13 puede romper `?doc=`.**
- `navigate({ search, replace: true })` con un objeto que solo lleve `q` borra `doc` (y el futuro `seccion` de SDD-C).
- Corrección: `navigate({ search: (prev) => ({ ...prev, q: q || undefined }), replace: true })`. `validateSearch` debe descartar un `q` vacío o de solo espacios. CA-7 debe quitar `q` sin tocar `doc`.

**8. CA-3: la prueba no puede ver el nombre de la sección.**
- Corrección: que `searchDocs` devuelva el `section` id y el test de componente compruebe la etiqueta. O mover las etiquetas de `SECTIONS` a `src/lib`, coordinándolo con SDD-C.

**9. Casos límite sin definir en §8.**
- Con búsqueda activa, ¿en qué sección crean documento «+ Nuevo» y `DriveImportButton` (`hub.tsx:78`, `:122-124`)? ¿Se muestra `BattlecardFromReviews`?
- `?q=` junto a `?seccion=drive` (SDD-C).
- Quitar diacríticos también convierte «ñ» en «n»: «ano» encuentra «año» (comprobado). Declararlo como comportamiento aceptado o excluir la ñ del plegado, de forma consistente en `foldText`.


Informe de la segunda pasada (sobre v2), copiado sin editar:

- **Veredicto del gate (segunda pasada):** Objeciones. Las 9 objeciones de la primera pasada están resueltas en lo esencial. La v2 introduce un riesgo real de rotura (objeción nueva 1) y deja un choque de archivos de test con C1 (objeción nueva 2).

- **Objeciones de la primera pasada:**
  1. **Resuelta.** El test pasa a `src/routes/_authenticated/-hub.test.tsx` y las reglas puras a `src/lib/hub-search.ts` (SDD:101, :100). No dice cómo se renderiza `Hub`, que sigue sin exportarse (`hub.tsx:50`). Ver objeción nueva 2.
  2. **Resuelta.** CA-5 dice «solo cuando la consulta de documentos ha respondido… mientras carga, nunca» (SDD:59).
  3. **Resuelta.** CA-9 lee con `fetchAll` y avisa del truncado (SDD:69, :108), y §5:42 lo matiza. La forma de los datos en caché queda sin resolver: ver objeción nueva 1.
  4. **Resuelta.** CA-3 define 120 puntos de código, que «…» no cuenta, los casos Hangul, texto ya descompuesto, emoji, «C++» y «(beta)», y el mapa de posiciones con la sigma declarada (SDD:57, :106).
  5. **Resuelta.** `foldText` devuelve `""` para null, está en `text-search.ts` y `match.ts` la usa en `:67` y `:69` con casos nuevos (SDD:66, :104). Las otras copias quedan declaradas fuera (SDD:43). Cuadra: hay 15 archivos con `normalize("NFD")`.
  6. **Parcial.** `search_knowledge` aparece en §5:44 y §15.5, pero no en §3 como pedía la corrección. Además §5 ya lo da por fuera mientras §15.5 sigue preguntando.
  7. **Resuelta.** `navigate({ search: (prev) => ({ ...prev, q: q || undefined }), replace: true })`, `validateSearch` descarta `q` vacío, y CA-6 y CA-7 conservan `doc` (SDD:107, :62-63).
  8. **Resuelta.** `searchDocs` devuelve el id de la sección y la etiqueta se comprueba en `-hub.test.tsx` (SDD:57, :105).
  9. **Resuelta.** §8:79-81 cubre «+ Nuevo», «Importar de Drive», Battlecard, `?q=` con Drive y la «ñ». La «ñ» la decidió Fede el 2026-11-06 (§15.4).

- **CA sin prueba posible o sin G-n:**
  - **CA-4:** solo se prueba la función pura (`hub-search.test.ts`). Nada comprueba que la pantalla pinte el recuento por sección, y C1 cambia esos mismos contadores (C1:40, «sin número hasta responder»).
  - **CA-3 (emoji en el borde):** «sin partir pares sustitutos» es redundante si se cuenta por puntos de código. Un emoji ZWJ o una letra con marca combinante pueden partirse igualmente, y el test no dice qué se espera.
  - Sin PRD no se exige G-n.

- **[Por verificar] que sigue sin comprobarse:**
  - `max_rows` real de PostgREST en producción. Con CA-9 ya no bloquea, pero §3:24 sigue redactado como si la lista y la búsqueda «serían incompletas sin aviso», lo que contradice CA-9 y §16:123.
  - Número de documentos por empresa y tamaño de los cuerpos (rendimiento): sin dato.
  - Cómo renderizar `Hub` en el test sin exportarlo.

- **Contradicciones con el código o con decisiones previas:**
  - `fetchAll` devuelve `{ rows, truncated }` (`src/lib/fetch-all.ts:11`). Sin embargo, `hub.tsx:69` lee la caché `["docs"]` como `Doc[]`, y `:65` y `:74` usan `docs` como array. Ver objeción nueva 1.
  - El test de render de `/hub` está en dos archivos distintos: B usa `src/routes/_authenticated/-hub.test.tsx` (SDD:101) y C1 usa `src/components/hub-screen.test.tsx` (C1:45, :49, :52, :82).
  - SDD-D (`SDD-20261106-agent-rules-reader.md:10`, U-4 en `:101`) también toca `hub.tsx`. B no lo cita en «Coordinar con», y el contrato y el orden de integración A → B → C1 → C2 (SDD:109) no lo incluyen.
  - NK-0066 (registrado en `.factory/ledger.json:1707`) toca la misma línea `core-read.ts:236` que §15.5 de B, y B no lo menciona.
  - No hay contradicciones con SDD aprobados. CA-11 a CA-14 de `SDD-20261028-hooks-lint-hygiene` sobre `?doc=` se mantienen con la corrección de la objeción 7.

- **Lo que esta revisión NO demuestra:**
  - No hay código, así que no se ejecutó `scripts/factory/gate.mjs` ni ningún test. Tampoco hay `node_modules`.
  - No vuelve a comprobar el comportamiento del generador de rutas: se apoya en la primera pasada.
  - No prueba el mapa de posiciones del fragmento más allá de lo que hizo la primera pasada.
  - No demuestra rendimiento ni `max_rows` real.
  - Segunda máquina y soak: NOT RUN.
  - No sé a qué preguntas corresponde exactamente la respuesta de Fede «1 rotular, 2 OK, 3 sí, 4 se perdió, 5 OK». En el SDD de B solo consta la decisión de §15.4. Las preguntas §15.1, §15.2, §15.3 y §15.5 siguen abiertas en el documento.
  - Las citas comprobadas sobre `main` @ `f76f639` cuadran todas (sin cambios en `src`): `hub.tsx:23`, `:28-36`, `:39`, `:58-62`, `:60`, `:132`, `:138`; `match.ts:67`, `:69`; `memory.tsx:37-40`; `core-read.ts:236`; `scoring.ts:50`, `discoveries.ts:15`, `stages.ts:32`, `provenance.ts:229`; `src/lib/AGENTS.md:49`; `strategy-screens.test.tsx:12-41`; y `vitest.config.ts`, que incluye `src/**/*.test.tsx`.

**Objeciones nuevas**

1. **CA-9 puede romper «abrir tras importar o generar».**
   - Evidencia: `fetch-all.ts:11` devuelve `{ rows, truncated }`. En cambio, `hub.tsx:69` hace `(qc.getQueryData<Doc[]>(["docs"]) ?? []).find(...)`. El genérico no avisa en TypeScript, y si la caché pasa a guardar el objeto, `.find` falla en ejecución tras «Importar de Drive» o «Battlecard». `hub.tsx:65` (`useOpenDocFromUrl(docParam, docs, …)`) y `:74` (`missingPlays(docs)`) también esperan un array.
   - Corrección: fijar en §13 la forma de la caché. Por ejemplo, que el `queryFn` devuelva `{ rows, truncated }` y que todos los lectores (`:58`, `:65`, `:69`, `:74`) usen `.rows`. Y añadir a `-hub.test.tsx` un caso de `openDoc` tras invalidar la caché.

2. **Dos tests de render para la misma pantalla, y sin forma de renderizarla.**
   - Evidencia: B usa `-hub.test.tsx` (SDD:101) y C1 usa `src/components/hub-screen.test.tsx` (C1:45, :82). `Hub` no se exporta (`hub.tsx:50`). `AGENTS.md` pide que las pantallas grandes saquen sus paneles a `src/components/<screen>/`.
   - Corrección: acordar en B y C1 un único archivo y un único método. O bien `Route.options.component` con el router simulado, o bien sacar la lista y la búsqueda a `src/components/hub/` y probar ese componente. Actualizar §12 de los dos SDD.

3. **CA-4 sin prueba de pantalla.**
   - Evidencia: SDD:58 solo cita `hub-search.test.ts`, y C1:40 cambia los mismos contadores (`hub.tsx:112`).
   - Corrección: añadir a `-hub.test.tsx` (o al archivo único de la objeción 2) que, con búsqueda activa, cada sección muestra su número de coincidencias. Y declarar que C1 hereda ese contador junto con su estado de carga.

4. **Falta coordinar con SDD-D y NK-0066.**
   - Evidencia: SDD:5 y el contrato en SDD:109 no incluyen D, que toca `hub.tsx` (agent-rules-reader:10, :101). NK-0066 (`ledger.json:1707`) corregirá `core-read.ts:236`, justo lo que plantea §15.5.
   - Corrección: añadir D y NK-0066 a «Coordinar con», situar D en el orden de integración, y que §15.5 diga que cualquier `foldText` en `search_knowledge` va con NK-0066 o después.

5. **§15.5 contradice §5.**
   - Evidencia: §5:44 da por fuera `search_knowledge`, mientras §15:120 todavía pregunta si se aplica `foldText` en este SDD.
   - Corrección: pedir a Fede que decida y anotarlo como en §15.4. Si lo deja fuera, citarlo también en §3 (pendiente de la objeción 6 de la primera pasada).

6. **Fragmento: puntos de código frente a grafemas.**
   - Evidencia: CA-3 (SDD:57) solo protege pares sustitutos. Un emoji ZWJ o «e» + marca combinante pueden partirse en el borde.
   - Corrección: o se recorta por grafemas con `Intl.Segmenter`, o se acepta y declara en §8 con el resultado esperado del caso «emoji en el borde».

7. **Texto desfasado en §3.**
   - Evidencia: SDD:24 mantiene «serían incompletas sin aviso» cuando CA-9 ya lo resuelve.
   - Corrección: reescribirlo en la línea de §16:123.


Informe de la tercera pasada (sobre v3; su bloqueante se corrige en v4), copiado sin editar:

- **Veredicto del gate (tercera pasada):** Objeciones. Queda una sola, menor y fácil de corregir (objeción bloqueante 1): el test de pantalla, montado tal como lo describe §13, no llega a renderizar `/hub`. Todas las objeciones de la segunda pasada están resueltas.

- **Objeciones de la segunda pasada:**
  1. **Resuelta.** La caché `["docs"]` guarda `{ rows, truncated }`. §13 enumera todos sus lectores (`:62`, `:65`, `:69`, `:74`, `:112`). La clave `["docs"]` solo aparece en `hub.tsx` (`git grep` en `f76f639`: `:59`, `:68`, `:69`, `:75`, `:93`, `:100`). CA-9 prueba el caso «abrir tras importar».
  2. **Resuelta.** Hay un único test de pantalla, `src/components/hub/hub-screen.test.tsx`, y para poder probarla U-0 la extrae a `src/components/hub/`. C1 está alineado (C1:5, :72, :123, :140).
  3. **Resuelta.** CA-4 tiene ya prueba de pantalla, y C1 hereda los contadores (C1:54).
  4. **Resuelta.** D aparece en «Coordinar con» y el orden A → B → C1 → D → C2 es el mismo texto en A, B, C1, C2 y D. NK-0066 queda descartado, coherente con su rechazo y con `core-read.ts:237`.
  5. **Resuelta.** `search_knowledge` aparece en §3:25, §5 lo deja fuera como propuesta y §15.5 sigue abierta, con la razón por la que no basta aplicar `foldText` a los resultados.
  6. **Resuelta.** El fragmento se recorta por grafemas con `Intl.Segmenter`, con resultado esperado para el emoji ZWJ y la marca combinante, y la degradación queda declarada en §8.
  7. **Resuelta.** §3:26 ya concuerda con CA-9 y §16.
  - La objeción 6 de la primera pasada (citar `search_knowledge` en §3) también queda resuelta.

- **CA sin prueba posible o sin G-n:**
  - **CA-0, parte de estructura:** nada lo comprueba automáticamente. Que la ruta solo conserve `validateSearch`, `head` y `component: HubScreen` se ve únicamente revisando el diff. Además, el test de U-0 solo «falla» porque el módulo no existe todavía, que es la forma más débil de fallar primero.
  - Sin PRD no se exige G-n.

- **[Por verificar] que sigue sin comprobarse:**
  - `max_rows` real de PostgREST en producción. Ya no bloquea.
  - Número de documentos por empresa y tamaño de los cuerpos, que deciden el rendimiento.
  - Que TypeScript 5.8 incluya los tipos de `Intl.Segmenter` en `lib` ES2022 (`tsconfig.json:13`, `package.json:109`). No hay `node_modules` para mirarlo.
  - El mapa de posiciones con recorte por grafema: no lo he ejecutado. Me apoyo en lo que probó la primera pasada.

- **Contradicciones con el código o con decisiones previas:**
  - Los simulacros que lista §13 no bastan para renderizar `HubScreen` (objeción bloqueante 1).
  - §14 dice que el fragmento «solo se calcula para los resultados visibles». En cambio, §13 hace que `searchDocs` devuelva `snippet` en todos los resultados, y la lista no tiene límite, así que todos son visibles.
  - SDD-D no sabe que B mueve `hub.tsx`. Pone «Depende de: —» y su U-4 cita `hub.tsx:35` y `:163`, que tras U-0 están en `src/components/hub/hub-screen.tsx` y `doc-editor.tsx`. B sí lo declara (§13, §14), así que el problema está en D, no en B.
  - No hay ninguna contradicción con las decisiones de Fede del 2026-11-06: «ano» encuentra «año», NK-0066 rechazado y la rama local de NK-0051 perdida.

- **Lo que esta revisión NO demuestra:**
  - No hay código ni `node_modules`. No he ejecutado tests, ni `scripts/factory/gate.mjs`, ni el compilador.
  - No he vuelto a comprobar el generador de rutas. Ya no aplica, porque el test vive en `src/components/hub/`.
  - Ni rendimiento ni `max_rows`.
  - Segunda máquina y soak: NOT RUN.
  - Solo he cotejado los otros SDD del sprint (A, C1, C2 y D) en sus referencias a `/hub`, al contrato y al orden.
  - Citas comprobadas sobre `f76f639` (en `src` solo ha cambiado `src/test/factory-ledger.test.ts`), y todas cuadran: `hub.tsx:23`, `:28-36`, `:39`, `:48`, `:50`, `:58-75`, `:112`, `:132`, `:138`, `:147-177`, `:163`; `match.ts:67`, `:69`; `fetch-all.ts:8-21`, `:15`; `memory.tsx:37-40`; `command-palette.tsx:40-43`; `core-read.ts:236-237`; `src/lib/AGENTS.md:49`; `tsconfig.json:13`; `AGENTS.md:25`. El id de ruta `/_authenticated/hub` existe en `routeTree.gen.ts:361`.

**Objeciones bloqueantes**

1. **El test de pantalla no llega a renderizar `HubScreen` con los simulacros de §13.**
   - Evidencia:
     - `HubScreen` pinta `Page` (`hub.tsx:10`, `:104`), y `Page` monta `FlowStrip` (`src/components/page.tsx:2`, `:7`).
     - `FlowStrip` usa `Link` y `useRouterState` de `@tanstack/react-router` (`src/components/flow-strip.tsx:1`, `:6`).
     - §13 dice que hay que simular `@tanstack/react-router` solo con `useSearch` y `useNavigate`. Con ese simulacro, `useRouterState` no existe y el render falla en todos los casos de `hub-screen.test.tsx`: CA-0, CA-3 a CA-7 y CA-9, más los que añade C1.
     - Ningún test del repo renderiza `Page` (`grep -rln "useRouterState|flow-strip|@/components/page"` sobre `*.test.tsx` no devuelve nada), así que el precedente `strategy-screens.test.tsx:41-51` no cubre este caso.
   - Corrección: añadir a §13 que el simulacro del router también exporta `Link` (como en `strategy-screens.test.tsx:42-50`) y `useRouterState: ({ select }) => select({ location: { pathname: "/hub" } })`. La alternativa es simular `@/components/flow-strip`. C1 lo hereda.

**Notas para el brief**

1. **Simulacro de `navigate`:** CA-6 y CA-7 comprueban llamadas a `navigate`, así que `useNavigate` debe devolver un mismo `vi.fn()` creado con `vi.hoisted`. No sirve `() => vi.fn()` como en `strategy-screens.test.tsx:51`, que devuelve uno nuevo en cada render y no deja comprobar nada.
2. **Un solo punto de simulación para la lectura:** CA-5 (y C1 CA-1) usan «Supabase simulado sin responder», pero CA-9 simula `@/lib/fetch-all`. Si `vi.mock("@/lib/fetch-all")` vale para todo el archivo, el simulacro de Supabase ya no controla la lectura de documentos. Hay que fijar uno de los dos:
   - `fetch-all` simulado con `importOriginal`, que deja pasar las llamadas y se sobreescribe solo en el caso de truncado;
   - o el estado pendiente controlado desde el propio simulacro de `fetchAll`.
3. **Escribir espacios en la caja:** §13 no dice si la caja la manda el estado local o `?q=`. Si la manda la URL, la limpieza de `q` (U-2) solo puede descartar un `q` vacío o de solo espacios, nunca recortar los bordes de uno que tiene texto. Si no, no se puede escribir «decision ventas»: el espacio desaparece al teclearlo. Hay que fijarlo en CA-6 y añadir un caso con «foo » en `hub-search.test.ts`.
4. **Pulsar una sección con búsqueda activa:** no está definido. Hoy hace `setSection(id); setSelected(null)` (`hub.tsx:111`), y con búsqueda la lista muestra todas las secciones. Falta decir si la lista se filtra por esa sección, si se conserva `q`, y si se cierra el editor. C1 CA-3 conserva `q` y quita `doc` al cambiar de sección, así que la respuesta tiene que encajar con eso.
5. **Fin de la coincidencia en el mapa:** `map[i + q.length]` se sale del array cuando la coincidencia acaba al final del texto. El mapa necesita una posición extra al final, igual a la longitud del original. `q.length` debe ser la longitud de `foldText(q)`, no la de `q`. Hay que añadir el caso «coincidencia al final del texto».
6. **Línea de `docs`:** `const { data: docs = [] }` (`hub.tsx:58`) tiene que pasar en B a `const docs = data?.rows ?? []`, no esperar a C1. Si no, `docs` sería el objeto `{ rows, truncated }`. §13 lo da a entender, pero no lo dice.
7. **§14 frente a §13:** quitar «solo para los resultados visibles» de §14, o limitar el cálculo del fragmento en `searchDocs`.
8. **Errores entre B y C1:** `fetchAll` lanza (`fetch-all.ts:15`) y B no pinta el error. Entre la integración de B y la de C1, una lectura fallida muestra «Sin documentos todavía» (`hub.tsx:132`), como ya pasa hoy, y React Query reintenta. No empeora nada, pero conviene declararlo.
9. **CA-0:** que la revisión de U-0 compruebe a mano que la ruta solo conserva `validateSearch`, `head` y `component: HubScreen`, y que el commit de U-0 no cambie más que el paso de `Route.useSearch()` a `useSearch({ from: "/_authenticated/hub" })`.
10. **Para SDD-D:** añadir a D la misma advertencia que tiene C1:9. Las líneas `hub.tsx:35` y `:163` de su U-4 pasan a `src/components/hub/hub-screen.tsx` y `src/components/hub/doc-editor.tsx` tras B. El texto común del contrato también sigue diciendo «hub.tsx».


Revisión de coherencia entre los cinco SDD del sprint: `docs/sdd/annex/sprint1-cross-sdd-gate-20261106.md`.

## 18. Delta de implementación (lo rellena el agente al entregar)
—
