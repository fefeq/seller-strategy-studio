# SDD-20261106-hub-search · [Mejora] Buscar en Conocimiento

**Tipo:** Mejora · **Prioridad propuesta:** Media
**Estado:** Borrador (v3, corregido tras la segunda pasada del gate) · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-11-06
**PRD:** No aplica (mejora acotada de una pantalla, sin esquema nuevo) · **Depende de:** — · **Coordinar con:** NK-0051 (SDD-C1 `SDD-20261106-ux-core-screens-pattern` y SDD-C2 `SDD-20261106-ux-metrics-data-state` de este sprint; C1 amplía el test de pantalla que crea este SDD), SDD-D `SDD-20261106-agent-rules-reader` (toca los textos de la sección Reglas y de la casilla «obligatorio», que este SDD mueve de archivo; ver §13), NK-0053 (`SDD-20261030-gtm-control-tower-5a-agent-memory`, toca `memory.tsx`)

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

No hay tests en `src/routes/`. C1 amplía `src/components/hub/hub-screen.test.tsx` con sus casos (carga, error, `?seccion=`) sobre los mismos simulacros.

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- **Extracción (U-0):** `HubScreen` lee la URL con `useSearch({ from: "/_authenticated/hub" })` y escribe con `useNavigate({ from: "/_authenticated/hub" })`, sin importar `Route` (evita el ciclo ruta ↔ componente). Hoy `hub.tsx:63` usa `Route.useSearch()`. El test simula `@tanstack/react-router` (`useSearch` devuelve el objeto del caso, `useNavigate` un `vi.fn()`), `@/integrations/supabase/client`, `@/hooks/use-me`, `@/components/background` (`useJob`), `@/components/drive`, `@/components/linkedin` y `@/components/drive-overview`, como `src/components/strategy-screens.test.tsx:12-51`. Para el caso «mientras carga» el simulacro de Supabase devuelve una promesa que no resuelve hasta que el test lo pide. Tras U-0, los textos de D (Reglas en `SECTIONS`, `hub.tsx:35`; casilla «obligatorio», `hub.tsx:163`) viven en `src/components/hub/hub-screen.tsx` y `src/components/hub/doc-editor.tsx`.
- `foldText(s: string | null | undefined)` en `src/lib/text-search.ts` (devuelve `""` para null); `match.ts` la importa en `:67` (con `.trim()`) y `:69`. Así el hub no arrastra `match.ts` → `leads.ts`. Sin cambio de comportamiento (CA-8).
- `searchDocs(docs, q)` devuelve `{ doc, section, inTitle, snippet }[]`; la pantalla solo la llama dentro de `useMemo`. Coincidencia con `includes` sobre texto normalizado, no `RegExp`.
- Fragmento: normalizar a NFC no basta (el gate lo comprobó con texto descompuesto y Hangul). Recorrer el original por puntos de código (`for…of`), plegar cada carácter con `foldText(ch)` y guardar, para cada unidad del texto plegado, su posición en el original; la coincidencia ocupa `[map[i], map[i + q.length])` en el original. Después, segmentar el original con `Intl.Segmenter(undefined, { granularity: "grapheme" })`, ampliar el inicio y el fin de la coincidencia al borde de grafema que los contiene, y añadir grafemas a cada lado hasta 120 en total. Diferencia conocida: la sigma final griega se pliega distinto carácter a carácter; el mapa se usa solo para el recorte.
- `validateSearch` de la ruta pasa a `{ doc?: string; q?: string }` y descarta `q` vacío. Escribir con `navigate({ search: (prev) => ({ ...prev, q: q || undefined }), replace: true })`: un objeto sin `prev` borraría `doc`.
- **Lectura y forma de la caché (CA-9):** `queryFn: () => fetchAll<Doc>((a, b) => supabase.from("knowledge_docs").select("*").order("updated_at", { ascending: false }).order("id").range(a, b))` (`src/lib/fetch-all.ts:8-21`, que devuelve `{ rows, truncated }` y lanza el error, `:15`). La caché `["docs"]` guarda ese objeto. Lectores que hoy esperan un array y pasan a `rows`: la lista de la sección (`hub.tsx:62`), `useOpenDocFromUrl` (`:65`), `openDoc` (`:69`, que pasa a `qc.getQueryData<{ rows: Doc[]; truncated: boolean }>(["docs"])?.rows.find(...)`), `missingPlays` (`:74`) y los contadores (`:112`). La clave `["docs"]` solo se usa en `hub.tsx` (`:59`, `:68`, `:69`, `:75`, `:93`, `:100`; comprobado con `git grep` en `f76f639`), así que no hay otros lectores. C1 quita el `= []` por defecto y usa `isPending`/`error` de esta misma consulta.
- **Contrato entre los SDD del sprint (el mismo texto en A, B, C1 y C2):** A cambia datos y textos de datos de /metrics (las palabras de cada marca); B, la búsqueda de /hub; C1, estados de pantalla (carga, error, vacío) de /hub, /theory-u y /metrics, sección en la URL de /hub y /theory-u, vacíos y pistas de /hub y /theory-u; C2, el plegado de explicaciones en las tres pantallas y la forma visual (componente DataState) de las marcas de dato de /metrics. D toca hub.tsx solo en los textos de la sección Reglas y de la casilla «obligatorio» (hub.tsx:163). Orden de integración: A → B → C1 → D → C2.
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

**Versión 3 (2026-11-06):** corregida tras la segunda pasada del gate. Nueva 1: la caché `["docs"]` guarda `{ rows, truncated }`, §13 enumera todos sus lectores y CA-9 prueba «abrir tras importar». Nueva 2: la pantalla sale a `src/components/hub/hub-screen.tsx` (U-0, CA-0) y el único test de pantalla es `src/components/hub/hub-screen.test.tsx`, que C1 amplía; desaparece `-hub.test.tsx`. Nueva 3: CA-4 con prueba de pantalla y C1 hereda los contadores. Nueva 4: D en «Coordinar con» y en el orden A → B → C1 → D → C2 (contrato del sprint sustituido por el texto común); NK-0066 no aplica (`core-read.ts:237` ya filtra en memoria). Nueva 5 y primera 6: `search_knowledge` citado en §3, §5 lo deja fuera como propuesta y §15.5 queda como pregunta abierta, con la razón de por qué `foldText` sobre los resultados no basta. Nueva 6: el fragmento se recorta por grafemas con `Intl.Segmenter`, con resultado esperado para emoji ZWJ y marca combinante, y degradación declarada en §8. Nueva 7: §3 reescrito en línea con CA-9. Añadida §15.6 (ids de sección, pendiente de Fede).

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

## 18. Delta de implementación (lo rellena el agente al entregar)
—
