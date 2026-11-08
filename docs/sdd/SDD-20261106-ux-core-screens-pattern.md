# SDD-20261106-ux-core-screens-pattern · [Mejora] NK-0051 ampliado, C1: estados de pantalla en Conocimiento, Theory U y Métricas; sección en la URL, vacíos y pistas en Conocimiento y Theory U

**Tipo:** Mejora · **Prioridad propuesta:** Media
**Estado:** Aprobado por Fede el 2026-11-06 («OK a todo» en el chat, tras tres pasadas del gate y la revisión de coherencia) · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-11-06 · **Ticket:** NK-0051 (ampliación decidida por Fede: no se abre ticket aparte)
**PRD:** No aplica (mejora acotada; contexto en `docs/UX-INFORME-20261031.md`) · **Depende de:** `SDD-20261106-hub-search` (SDD-B: extrae `/hub` a `src/components/hub/hub-screen.tsx`, pasa su lectura a `fetchAll` y crea `src/components/hub/hub-screen.test.tsx`) y `SDD-20261106-metrics-honest-data` (SDD-A: cambia textos de los paneles de `/metrics` y crea sus tests); los dos se integran antes · **Coordinar con:** `SDD-20261106-agent-rules-reader` (SDD-D, se integra después de C1 y toca textos de `/hub`), `SDD-20261106-ux-metrics-data-state` (SDD-C2, se integra después; ver §14 sobre `listening.tsx:49`), los 4 SDD de NK-0051 según el ledger (`.factory/ledger.json:1381`): `SDD-20261031-ux-palette-graphite`, `SDD-20261031-ux-legibility-contrast` (su §13 permite poner `Kpi`/`Panel` en `src/components/page.tsx`, el mismo archivo que `ScreenState`), `SDD-20261031-ux-move-without-drag`, `SDD-20261031-deal-won-duplicate-approvals`; `SDD-20261025-theory-u-proactive-decision-support` (toca `src/components/theory-u/*`: C1 va antes, por ser más pequeño); PR #76 de Plays (`headlines.ts`, `nav.ts`, que no se tocan)

> Sprint 1 de mejoras en pantallas core, bloque C1. Nació al partir la v1 conjunta tras la primera pasada del gate (C2 está en `SDD-20261106-ux-metrics-data-state.md`). En la v3 asume también carga, error y vacío de `/metrics`, que no tenían dueño (objeción nueva 1 de la segunda pasada de C2).
> **Base:** la rama local de NK-0051 (`feat/ux-graphite-legibility-move`, «8 commits sobre 47ec72c» según el ledger) se perdió (confirmado por Fede, 2026-11-06). C1 parte de `main` @ `f76f639` y no depende de ella.
> **Números de línea:** todos son de `main` @ `f76f639`. B mueve el código de `src/routes/_authenticated/hub.tsx` a `src/components/hub/hub-screen.tsx` y A cambia los paneles de `/metrics`: el brief los vuelve a localizar sobre la rama integrada.

**Contrato entre los SDD del sprint (el mismo texto en A, B, C1, C2 y D):** A cambia datos y textos de datos de /metrics (las palabras de cada marca); B, la búsqueda de /hub; C1, estados de pantalla (carga, error, vacío) de /hub, /theory-u y /metrics, sección en la URL de /hub y /theory-u, vacíos y pistas de /hub y /theory-u; C2, el plegado de explicaciones en las tres pantallas y la forma visual (componente DataState) de las marcas de dato de /metrics. D toca la pantalla de /hub (`src/components/hub/` tras B) solo en los textos de la sección Reglas y de la casilla «obligatorio». Orden de integración: A → B → C1 → D → C2.

## 1. Resumen
En Conocimiento, Theory U y Métricas, la pantalla dice «vacío» o muestra contadores a 0 mientras carga, se traga los errores (o se queda en blanco), y en Conocimiento y Theory U pierde la pestaña al volver atrás o compartir el enlace y alguna pista nombra un sitio sin llevar a él. C1 añade un estado de pantalla común (carga, error con «Reintentar»), hace que las consultas del alcance lancen su error, pone la sección en la URL de `/hub` y `/theory-u`, da a cada vacío una acción y convierte las pistas en enlaces. No cambia datos ni textos de datos.

## 2. Problema y para quién
Cualquier persona del equipo que usa Conocimiento o Theory U: ve «Sin notas todavía» o «0 notas» cuando sí las hay, o no ve nada cuando algo falla. Owner y Sales Leader en Métricas: ven la pantalla en blanco mientras carga o cuando falla, y paneles que dicen «No hay segmentos» o «Ningún deal ganado» antes de que lleguen los datos.

## 3. Evidencia y por qué ahora
Leído en `main` @ `f76f639` (diff de `src/` contra `HEAD` de la rama de docs vacío) y revisado por el gate en dos pasadas (§17).

| # | Problema | Dónde |
|---|---|---|
| E-1 | Vacío falso mientras carga (por defecto `[]` y vacío pintado antes de responder) | `/hub`: `hub.tsx:58` + `:132`. Theory U: `journey.tsx:30` + `:69`; `sensing.tsx:36` + `:80`; `listening.tsx:43` + `:71`; `prototypes.tsx:50` + `:133` (sin selección). `/metrics`: `segment-coverage.tsx:54` + `:77` («No hay segmentos…»); `cac-panel.tsx:23` (`costs = []`) + `:34` («Aún no hay costes…»); `won-deals-panel.tsx:36` + `:83` («Ningún deal ganado…»); `budget-panel.tsx:30` + `:60` («No hay segmentos…») |
| E-1c | Contadores con número mientras carga (0 o «—» que parece dato) | `hub.tsx:112` (contador por sección); `sensing.tsx:77` («{n} notas»); `listening.tsx:59` (distribución por nivel), `:65` («Conversaciones valoradas»), `:66-67` («—» en nivel medio y escucha profunda); `prototypes.tsx:89` («(0)» por columna); `journey.tsx:135-136` (`counts?.notes ?? 0`, `counts?.experiments ?? 0`) |
| E-1b | Falta vacío de lista: sin clínicas, la columna solo muestra el botón | `case-clinic.tsx:56-64` (`:89` es correcto: «Selecciona o crea…») |
| E-1m | `/metrics` en blanco mientras carga y cuando falla: bajo la barra de secciones no se pinta nada hasta tener datos, y un error deja el mismo blanco | `metrics.tsx:229` (`{m && data && (…)}`); la consulta está desactivada hasta tener `orgId` (`:97`) |
| E-2 | Errores tragados: las consultas devuelven `.data ?? []` o `count ?? 0` y nunca lanzan | Theory U: `journey.tsx:32`, `journey.tsx:37-43` (`u_counts`: si falla, 0 notas y 0 experimentos como si fueran datos); `sensing.tsx:33`; `listening.tsx:40`; `prototypes.tsx:47`; `case-clinic.tsx:32`. `/metrics`: `metrics.tsx:110-116` (`quotas`, `org_members`, `profiles`; `deals` e historial ya lanzan vía `fetchAll`, `fetch-all.ts:15`, pero `:229` esconde ese error); `segment-coverage.tsx:27-43` (`useSegmentCoverageData`, que usa también `cac-panel.tsx:89`); `cac-panel.tsx:26`; `won-deals-panel.tsx:23-32`; `budget-panel.tsx:17-27`; `quarter-kpis-panel.tsx:32-43`; `pipeline-board-panel.tsx:25-36`; `self-service-funnel.tsx:29-33` (los segmentos; `trials` ya lanza en `:32`). `/hub`: `hub.tsx:60`, que **SDD-B ya resuelve** al pasar la lectura a `fetchAll` (B CA-9); C1 solo pinta ese error |
| E-3 | Sección fuera de la URL | `theory-u.tsx:21` (`Tabs defaultValue`, sin `validateSearch`, `:13-16`); `hub.tsx:53` (`useState("company")`). Modelo: `/metrics` con `?seccion=` (`metrics.tsx:55-57`, `:94`, `:219-226`) |
| E-4 | Pistas sin enlace | `listening.tsx:49` («en el planificador de reuniones de cada cuenta») y `:71` («Cuentas → Planificador de reuniones»). El Planificador no tiene ruta propia: es la pestaña `meetings` de `/accounts/$id` (`accounts.$id.tsx:21`, `:91`) |

**Comprobado y fuera de E-1/E-2 (cierra los [Por verificar] de las dos pasadas):**
- `DriveAccountsPanel` («Drive por cuenta») ya tiene carga y error propios (`drive-overview.tsx:25`, `:41-42`, con `errorText`). Su servidor lanza si falla la lista de carpetas (`drive-core.ts:205`) y devuelve el error de cada carpeta, que la pantalla muestra (`drive-core.ts:212-218`, `drive-overview.tsx:85`). Solo se traga el error de la lectura de resúmenes (`drive-core.ts:221`): fuera de C1 (§5, §15.5).
- `FinancePanel` ya tiene carga y error (`finance-panel.tsx:40-41`, `:54-55`).
- `LeadFunnelPanel` y la parte de leads de `PipelineBoardPanel` leen `useLeads` (`use-leads.ts:25`, `:29-54`), que comparte la pantalla Leads y su cargador de ruta (`screen-queries.ts:53-57`); varias de sus consultas no comprueban `error` (p. ej. `use-leads.ts:41-42`). `StripeMetricsPanel` lee `useStripe` (`stripe-panel.tsx:14-24`), que comparte Conexiones. Mientras cargan devuelven `null` (`lead-funnel-panel.tsx:18`, `:30`; `pipeline-board-panel.tsx:42`, `:59`), así que no pintan un vacío falso. Sus errores quedan fuera de C1 (§5, §15.5).
- Paneles de RevOps (`revops-panels.tsx`): reciben los datos de la consulta de la página; quedan cubiertos por E-1m.
- `/metrics` sin deals: los KPI muestran 0 porque es el dato real, no un vacío falso. No hay vacío de página en `/metrics`.

Uso de estas pantallas: sin dato.

## 4. Resultado buscado
Medible por código. Línea base en §3 y objetivo 0:
- Vacíos falsos en carga: 9 (1 en `/hub`, 4 en Theory U, 4 en `/metrics`).
- Contadores con número en carga: 6 sitios (1 en `/hub`, 5 en Theory U).
- Pantalla en blanco en carga o error: 1 (`/metrics`).
- Consultas que tragan el error: 14 (6 en Theory U, 8 en `/metrics`); la de `/hub` la cierra SDD-B.
- Secciones fuera de la URL: 2 pantallas. Pistas sin enlace: 2. Vacío de lista que falta: 1.

Uso o satisfacción: sin dato.

## 5. Alcance
**Incluye:**
- `ScreenState` en `src/components/page.tsx` (carga y error con «Reintentar»).
- `/hub` (sobre `src/components/hub/hub-screen.tsx` de SDD-B): carga y error de la consulta `["docs"]` que B ya pasa a `fetchAll`; contadores sin número hasta responder; vacío de sección solo tras responder; hereda de B (B §13, «C1 hereda…») el vacío de búsqueda de B CA-5, los contadores con búsqueda de B CA-4 y el aviso de truncado de B CA-9, sin cambiar sus textos, y los pinta dentro de `ScreenState`; `?seccion=`.
- `/theory-u`: la pantalla sale de la ruta a `src/components/theory-u/theory-u-screen.tsx` (regla «Big screens keep only route config…» de `AGENTS.md`, como B con `/hub`); las 6 consultas de E-2 lanzan; carga, error, contadores y vacíos de las cinco pestañas; `?seccion=`; pistas de E-4.
- `/metrics`: la consulta de la página (`metrics.tsx:95-124`) lanza si cualquier respuesta trae `error`; el contenido bajo la barra de secciones pasa por `ScreenState`; las 7 consultas de paneles de E-2 lanzan; los 4 vacíos de E-1 en `/metrics` solo tras responder; cada panel de la lista muestra carga y error.

**No incluye:**
- Sección de `/metrics` en la URL (ya existe), datos y textos de datos de `/metrics` (SDD-A), forma visual de las marcas de dato y plegado de explicaciones (C2).
- Los textos de los vacíos de `/metrics` (se mantienen; si SDD-A los cambia, C1 usa los de A).
- `useLeads` (`LeadFunnelPanel`, la parte de leads de `PipelineBoardPanel`), `useStripe` (`StripeMetricsPanel`) y los resúmenes de Drive (`drive-core.ts:221`): son lecturas compartidas con otras pantallas o del servidor; se proponen en §15.5.
- Paleta, tamaños y `Kpi`/`Panel` (otros SDD de NK-0051); titulares con conclusión (§15.2); botón «Llevar a GTM Lab» (Sprint 3); avisos proactivos de Theory U; `nav.ts`; esquema, RLS, IA.
- Que el enlace de `?doc=` cambie al seleccionar otro documento a mano (hoy no lo hace; sigue igual).

## 6. Cambios de comportamiento (delta)
**Añadido:** estado de carga y de error (con «Reintentar») en `/hub`, en las cinco pestañas de `/theory-u` y en `/metrics` (página y paneles de la lista); `?seccion=` en `/hub` y `/theory-u`; vacío de lista en clínicas.
**Modificado:** vacíos de E-1 solo tras responder; contadores de E-1c sin número hasta responder; `/metrics` deja de quedarse en blanco; texto y enlace de E-4; al cambiar de sección en `/hub` a mano, `?doc=` sale de la URL.
**Eliminado:** nada.

## 7. Historias y criterios de aceptación
### H-1: Como persona del equipo, quiero que la pantalla no me mienta mientras carga ni cuando falla.
- **CA-1** En `/hub` y en cada pestaña de `/theory-u`, mientras la consulta que decide el vacío o el contador no ha respondido, se ve el estado de carga: nunca el texto de vacío de E-1 ni un número en los contadores de E-1c (ni «0», ni «(0)», ni «—»). · prueba: `src/components/screen-state.test.tsx` (componente); `src/components/hub/hub-screen.test.tsx` y `src/components/theory-u/theory-u-screen.test.tsx` (render con Supabase simulado sin responder: ni vacío ni números; tras responder con listas vacías, el vacío y «0»)
- **CA-2** Si la consulta devuelve error (incluido `u_counts` de `journey.tsx:37-43`), se ve el mensaje de `errorText()` («qué pasó + qué hacer») y un botón «Reintentar» que vuelve a lanzar la consulta; no se ve el vacío ni números a 0. En `/hub` el error es el que ya lanza `fetchAll` tras SDD-B. · prueba: los mismos tres archivos, con Supabase simulado devolviendo `{ data: null, error }` (y, en `/hub`, `@/lib/fetch-all` simulado lanzando): aparece el texto de `errorText`, no el vacío, y pulsar «Reintentar» llama otra vez a la consulta

### H-2: Como persona del equipo, quiero volver atrás o compartir el enlace sin perder la pestaña.
- **CA-3** Con los ids de la propuesta por defecto (§15.1, decidido por Fede el 2026-11-06): `/hub?seccion=<id>` (`company`, `objections`, `playbooks`, `methodology`, `campaigns`, `skills`, `rules`, `drive`) y `/theory-u?seccion=<id>` (`journey`, `sensing`, `listening`, `clinic`, `prototypes`) abren esa sección; un id desconocido o ausente abre la de por defecto (`company`, `journey`). Cambiar de sección a mano llama a `navigate` con `replace: true` y una función que conserva los demás parámetros (`q`), quita `doc` y quita `seccion` si es la de por defecto. Al abrir la página con `?doc=X`, el documento se abre una vez (como hoy, `use-open-doc-from-url.ts:20`) y `seccion` pasa a la de ese documento, conservando `doc`; si `X` no está en la lista, se ignora y manda `seccion`. Así, tras abrir `?doc=X` y cambiar de sección, recargar o compartir conserva la sección elegida. · prueba: `src/lib/screen-sections.test.ts` (validación de ids, búsqueda siguiente: quita `doc`, conserva `q`, quita la de por defecto); `src/components/hub/hub-screen.test.tsx` (apertura con `seccion`, id desconocido, `?doc=` de otra sección reescribe `seccion`, cambio a mano: `navigate` con `replace` y búsqueda sin `doc` y con `q`); `src/components/theory-u/theory-u-screen.test.tsx` (apertura con `?seccion=listening`, id desconocido abre `journey`, cambio de pestaña: `navigate` con `replace` y `seccion`)

### H-3: Como persona del equipo, quiero que un vacío o una pista me digan qué hacer y me lleven allí.
- **CA-4** Cada vacío de E-1 en `/hub` y Theory U y el de E-1b dice qué es y ofrece la acción siguiente cuando existe, con el texto exacto de la lista cerrada de §9, y solo tras responder la consulta. · prueba: `src/components/hub/hub-screen.test.tsx` (vacío de sección y vacío de búsqueda de B CA-5), `src/components/theory-u/theory-u-screen.test.tsx` (los cinco de Theory U)
- **CA-5** Las pistas de E-4 son enlaces a `/accounts` con el texto de §9. · prueba: `src/components/theory-u/theory-u-screen.test.tsx` (`getByRole("link", { name })` con `href="/accounts"`)

### H-4: Como Owner o Sales Leader, quiero que Métricas no se quede en blanco ni me enseñe vacíos que no lo son.
- **CA-6** En `/metrics`, mientras la consulta de la página no ha respondido (incluido mientras no hay `orgId`), bajo la barra de secciones se ve el estado de carga; si cualquiera de sus respuestas trae error (`deals`, historial, `quotas`, `org_members`, `profiles`), se ve `errorText()` con «Reintentar». El título sigue siendo «Métricas» hasta tener datos (regla de titulares de `AGENTS.md`). · prueba: `src/components/metrics/metrics-states.test.tsx` (render del componente de la ruta con los paneles simulados: sin responder, estado de carga; con `quotas` devolviendo error, el texto de `errorText` y «Reintentar»)
- **CA-7** En cada panel de la lista cerrada (`SegmentCoverage`, `CacPanel`, `WonDealsPanel`, `BudgetPanel`, `QuarterKpisPanel`, `PipelineBoardPanel`, `SelfServiceFunnel`), mientras su consulta no ha respondido no aparece su vacío ni cifras a 0, y si falla se ve `errorText()` en el panel, no un vacío ni cifras a 0. Los textos de vacío no cambian. · prueba: `src/components/metrics/metrics-states.test.tsx` (un caso «sin responder» y uno «con error» por panel, con Supabase simulado)

## 8. Casos límite y errores
- Red caída o RLS con error: CA-2, CA-6, CA-7.
- Pestaña con varias consultas: el estado lo decide la consulta que pinta el vacío o el contador; en Theory U, cada pestaña tiene una y `journey.tsx` dos (la lista y `u_counts`, que solo afecta a la línea de contadores del editor).
- «Drive por cuenta» (`?seccion=drive`): conserva su carga y error propios (§3); C1 solo añade el id a la URL.
- `?seccion=drive&q=…`: la caja de búsqueda se oculta y `q` se conserva (SDD-B §8).
- `?doc=` de un documento borrado o de otra empresa: no está en la lista, se ignora y abre `seccion` (o la de por defecto), como hoy.
- Recarga en segundo plano tras guardar (`invalidateQueries`): no vuelve a mostrar el estado de carga si ya hay datos (`isPending` solo es verdadero en la primera carga).
- `/metrics` con Finanzas sin permiso: se mantiene el aviso actual (`metrics.tsx:405-411`).
- Panel con error y el resto bien: solo ese panel muestra el error; la página no.

## 9. Experiencia y copy
- Carga: esqueleto por tipo de bloque (lista, tarjetas o tabla); «Cargando…» solo como texto accesible (`aria-busy` y texto oculto). Los contadores no muestran número.
- Error: texto de `errorText()` y botón «Reintentar».
- Vacíos (lista cerrada; todos solo tras responder):
  - `/hub`, sección sin documentos (`hub.tsx:132`): se mantiene «Sin documentos todavía. Crea el primero con «+ Nuevo».».
  - `/hub`, búsqueda sin coincidencias: el texto de B CA-5, sin cambios («Nada coincide con «{texto}». Prueba con otra palabra o crea un documento con «+ Nuevo».»), pintado dentro de `ScreenState`.
  - `/hub`, aviso de truncado: el texto de B CA-9, sin cambios.
  - Clínicas sin ninguna (nuevo, E-1b): «Aún no hay clínicas de casos. Crea la primera con «+ Nueva clínica de casos».» (botón de `case-clinic.tsx:57`).
  - Sensing (`sensing.tsx:80`): se mantiene «Sin notas todavía. Habla con clientes, observa y anota.».
  - Escucha (`listening.tsx:71`): «Aún no hay reuniones con nivel de escucha. Ábrelas desde una cuenta, en su pestaña «Planificador de reuniones».», con «una cuenta» como enlace a `/accounts`.
  - Recorrido U (`journey.tsx:69`) y Prototipos (`prototypes.tsx:133`): se mantiene el texto actual.
  - `/metrics` (`segment-coverage.tsx:77`, `cac-panel.tsx:34`, `won-deals-panel.tsx:83`, `budget-panel.tsx:60`): se mantiene el texto (o el que fije SDD-A).
- Pista de `listening.tsx:49`: la frase «Valora tu nivel después de cada reunión en el planificador de reuniones de cada cuenta.» sale del párrafo de Scharmer a una línea propia, con «cada cuenta» como enlace a `/accounts`. El párrafo de Scharmer queda sin la frase (C2 puede plegarlo; la pista queda siempre a la vista).
- Español, «tú», sin iconos.

## 10. Datos, permisos y privacidad
Mismas tablas, columnas y RLS. Cambia el tratamiento del error: los `queryFn` del alcance lanzan si cualquier respuesta de Supabase trae `error`. Tests con datos ficticios.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| ninguna | — | — | — |

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | `ScreenState` en `src/components/page.tsx` junto a `Empty` (carga, error con «Reintentar») | CA-1, CA-2 (componente) | `src/components/screen-state.test.tsx` (falla al no existir el export) |
| U-2 | `/hub` sobre `src/components/hub/hub-screen.tsx`: `ScreenState` sobre la consulta `["docs"]` de B, contadores sin número hasta responder, vacío de sección y vacío de búsqueda de B dentro de `ScreenState` | CA-1, CA-2, CA-4 (`/hub`) | `src/components/hub/hub-screen.test.tsx`, casos nuevos «sin responder: ni vacío ni números» y «con error: `errorText` y Reintentar» (fallan con el código de B) |
| U-3 | Theory U: `src/components/theory-u/theory-u-screen.tsx` (la ruta queda con `head`, `validateSearch` y `component`), las 6 consultas de E-2 lanzan, `ScreenState`, contadores, vacíos de §9 y pistas de E-4 | CA-1, CA-2, CA-4, CA-5 (Theory U) | `src/components/theory-u/theory-u-screen.test.tsx` (falla al no existir el módulo; luego, casos de carga, error, vacíos y enlaces) |
| U-4 | `src/lib/screen-sections.ts` (ids de las dos pantallas, validación, búsqueda siguiente) y `?seccion=` en `/hub` y `/theory-u`, con `useOpenDocFromUrl` escribiendo `seccion` | CA-3 | `src/lib/screen-sections.test.ts`; después, los casos de URL de `src/components/hub/hub-screen.test.tsx` y `src/components/theory-u/theory-u-screen.test.tsx` |
| U-5 | `/metrics`: la consulta de la página lanza y su contenido pasa por `ScreenState`; las 7 consultas de paneles lanzan y cada panel de la lista usa `ScreenState` | CA-6, CA-7 | `src/components/metrics/metrics-states.test.tsx` (con `quotas` devolviendo error hoy no aparece nada: falla) |

No hay tests en `src/routes/`.

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- `ScreenState` recibe `{ isPending, error, refetch }` de `useQuery`, un tipo de esqueleto y `children`; pinta `children` solo con datos. Quitar el `= []` por defecto de las consultas afectadas (`journey.tsx:30`, `cac-panel.tsx:23`, y el que deje B en `hub-screen.tsx`).
- Lanzar el error: `const e = r1.error ?? r2.error ?? …; if (e) throw e;` antes de devolver, como `finance-panel.tsx:40-41`. En `journey.tsx:37-43`, también `n.error ?? e.error`.
- `/hub`: B deja la ruta con `validateSearch`, `head` y `component: HubScreen`, y `HubScreen` lee con `useSearch({ from: "/_authenticated/hub" })` y escribe con `useNavigate` (B §13). C1 añade `seccion` a `validateSearch` (`{ doc?, q?, seccion? }`) y cambia `setSection` por `navigate({ search: (prev) => nextSearchOnSectionChange(prev, id), replace: true })`. `useOpenDocFromUrl` abre una vez por valor de `doc` (`use-open-doc-from-url.ts:15-25`); su `onOpen` escribe `seccion: d.section` conservando `doc`.
- `/theory-u`: `TheoryUScreen` con `Tabs value` controlado desde `useSearch({ from: "/_authenticated/theory-u" })` y `onValueChange` → `navigate({ search: (prev) => …, replace: true })`. La ruta gana `validateSearch` con `seccion?`. En el test, Radix Tabs activa la pestaña en `mousedown` (no hay `@testing-library/user-event` en `package.json`): usar `fireEvent.mouseDown` sobre el disparador. El simulacro del router sigue `src/components/strategy-screens.test.tsx:12-51`.
- `/metrics` sin mover la pantalla (A y C2 tocan `metrics.tsx`): el test importa `Route` de `@/routes/_authenticated/metrics` y pinta `Route.options.component`, con `@tanstack/react-router` simulado (`createFileRoute` devuelve `(opts) => ({ options: opts, useSearch: () => ({}) })`, `Link` como `<a>`) y los paneles simulados. Si el gate prefiere extraer, la alternativa es `src/components/metrics/metrics-screen.tsx`, a decidir antes del brief porque choca con A y C2.
- Paneles de `/metrics`: un único archivo de test de estados, `src/components/metrics/metrics-states.test.tsx`, con una tabla de casos por panel. Los tests de texto de SDD-A (`segment-coverage.test.tsx`, `cac-panel.test.tsx`, `pipeline-board-panel.test.tsx`) no cambian: comprueban textos con datos, no estados.
- Los ids de `/hub` son los valores de `knowledge_docs.section` (estables) más `drive`, y los de `/theory-u` los `value` actuales de `theory-u.tsx:23-27`: evita una tabla de traducción (§15.1).

## 14. Riesgos y dependencias
- B se integra antes y mueve `hub.tsx` a `src/components/hub/`: C1 trabaja sobre ese archivo y amplía `src/components/hub/hub-screen.test.tsx` (lo crea B) con los mismos simulacros.
- A se integra antes y cambia textos de los paneles de `/metrics`: C1 solo envuelve estados y no toca textos; si A cambia un texto de vacío, C1 usa el de A.
- D se integra después y toca textos de la sección Reglas y de la casilla «obligatorio»; C1 no los toca.
- C2 se integra después y pliega explicaciones, entre ellas `listening.tsx:49`. C1 saca de ese párrafo la frase de la pista con enlace (§9), de modo que C2 pliega solo la explicación de Scharmer y el enlace nunca queda oculto. C2 debe recoger esto en su §14.
- `page.tsx` lo tocan también los SDD de legibilidad (`Kpi`/`Panel`): conflicto de archivo, no de función; lo resuelve el orden.
- Theory U proactivo toca los mismos componentes: C1 va antes.
- La rama local de NK-0051 se perdió: sus 8 commits hay que rehacerlos desde los 4 SDD de NK-0051 (en «Borrador»).

## 15. Preguntas para Fede y para la revisión técnica
1. **Decidido por Fede (2026-11-06, «OK a todo»): ids internos en inglés.** Ids de sección en la URL de `/hub` y `/theory-u`: propuesta por defecto, los internos (`company` … `rules`, `drive`; `journey` … `prototypes`), por estabilidad y sin tabla de traducción. CA-3 está escrito con esta propuesta. ¿Te valen, o prefieres español como en `/metrics` (`?seccion=objeciones`)? Si cambian, solo cambian las constantes de `src/lib/screen-sections.ts` y los casos de CA-3.
2. **Titulares con conclusión** para Conocimiento y Theory U: ¿los quieres? Irían en `headlines.ts` después de integrar el PR #76.
3. **Resumen de Métricas en 4-5 KPI** (punto 15 del informe UX): ¿SDD propio o se espera a tener uso real?
4. **Decidido (Fede, 2026-11-06): la rama local de NK-0051 se perdió.** C1 parte de `main` y no depende de ella; los 4 SDD de NK-0051 siguen en «Borrador» sin código.
5. **Decidido por Fede (2026-11-06): ticket aparte (NK-0072).** **Errores tragados fuera de C1:** `useLeads` (Leads y dos paneles de `/metrics`), `useStripe` (Conexiones y `/metrics`) y los resúmenes de Drive (`drive-core.ts:221`). ¿Abro ticket aparte? Tocan pantallas fuera de este sprint.

## 16. Pendiente de verificar
- ~~Si `DriveAccountsPanel` traga errores~~: no; tiene carga y error propios (§3).
- ~~Paneles de `/metrics` con consulta propia~~: revisados (§3, E-1, E-2).
- ~~Estado real de la rama local de NK-0051~~: perdida (Fede, 2026-11-06).
- Comportamiento de Radix Tabs controlado con la URL en jsdom: lo confirma el primer test de U-4.

**Versión 2 (2026-11-06):** partido tras el gate (objeción 11): este documento es C1; HowCalculated y DataState pasan a C2. Corregidos §8 Finanzas (sale de C1), CA-2 (consultas que lanzan, objeción 2), CA-1 con tests por pantalla (3), CA-3 con ids y precedencia (4), CA-5 con lista cerrada (5), ruta del Planificador y nombre del botón (6), contrato único entre SDD (9) y cabecera (10). No ha tenido segunda pasada del gate.

**Versión 3 (2026-11-06):** corregida tras la segunda pasada del gate. Nueva 1: `doc` solo gana al abrir la página; un cambio de sección a mano quita `doc` y lo prueba `hub-screen.test.tsx` (CA-3). Nueva 2 y primera 3: contadores de Theory U en E-1c, §4 y §6. Nueva 3: `u_counts` (`journey.tsx:37-43`) en E-2, CA-2 y U-3. Nueva 4: §9 cierra los vacíos de `/hub` (sección, búsqueda de B CA-5, aviso de B CA-9) y U-2 cita `hub-screen.test.tsx`. Nueva 5: en `/hub` la consulta ya lanza tras B y C1 solo pinta el error; un único test de pantalla, `src/components/hub/hub-screen.test.tsx`, que crea B (decisión del coordinador: no `-hub.test.tsx`); aviso de que las líneas de `hub.tsx` se mueven. Nueva 6 y primera 4: Theory U sale a `theory-u-screen.tsx` con test de URL propio. Nueva 7: ids marcados como propuesta pendiente de Fede (§15.1) y CA-3 escrito con ella. Nueva 8: §14 habla de los 4 SDD de NK-0051. Primera 9: contrato sustituido por el texto común y herencia de B CA-4, CA-5 y CA-9 recogida en §5 y §9. Objeción nueva 1 de la segunda pasada de C2: C1 asume carga, error y vacío de `/metrics` (E-1, E-1m, E-2, CA-6, CA-7, U-5) y cierra el [Por verificar] de los paneles con consulta propia y de `DriveAccountsPanel`. Objeción 4 de C2: la pista de `listening.tsx:49` sale del párrafo que C2 pliega. Cabecera: depende de A y B, coordina con D.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Informe de la primera pasada (sobre la v1 conjunta C1+C2, commit `f089708`), copiado sin editar:

Veredicto del gate: **Objeciones**

**CA sin prueba posible o sin G-n** (no hay PRD, así que no exijo G-n):
- **CA-1:** `screen-state.test.tsx` solo prueba el componente. No demuestra que las tres pantallas y las cinco pestañas lo usen.
- **CA-2:** no se cumple con las consultas actuales, porque se tragan el error (objeción 2).
- **CA-3:** un test puro en `src/lib/screen-sections.test.ts` no demuestra que «cambiar de sección actualiza la URL» ni que `?doc=` siga funcionando.
- **CA-5:** un test que busca patrones en el texto no es viable. Da falsos positivos y se le escapan casos (objeción 5).
- **CA-6:** «más de una línea» depende del ancho de pantalla, así que un test no puede comprobarlo. Además, su lista de paneles está incompleta.
- **CA-7:** «ningún «—» suelto representa la falta de un dato» es un juicio de significado sobre unas 50 líneas. Un test del componente no lo demuestra.

**[Por verificar] que sigue sin comprobarse:**
- Sin resolver:
  - Si existe la rama local de NK-0051 (lo decide Fede). Indicio: `.factory/ledger.json:1380-1381` registra NK-0051 como «4 SDD, 8 commits sobre 47ec72c», en estado LOGGED.
  - Si los paneles de `/metrics` con consulta propia (`FinancePanel`, `CacPanel`, `SegmentCoverage`, `LeadFunnelPanel`) también muestran vacíos falsos. No los leí.
- Resueltos:
  - **Vacíos falsos en Theory U:**
    - `sensing.tsx:36` + `:80`: sí. El vacío sale de `data?.notes ?? []` mientras carga.
    - `listening.tsx:43` + `:71`: sí.
    - `prototypes.tsx:50` + `:133`: sí, cuando no hay nada seleccionado.
    - `case-clinic.tsx`: no hay vacío falso. `:89` es «Selecciona o crea…», que es cierto también mientras carga. Lo que falta es un vacío de lista: si no hay clínicas, la columna de `:56-64` solo muestra el botón.
    - Confirmado también `journey.tsx:30` + `:69`.
  - **Planificador de reuniones:** no tiene ruta propia. Es la pestaña `meetings` de `/accounts/$id` (`accounts.$id.tsx:21`, `:26`, `:91`). Desde Theory U no hay cuenta concreta, así que el enlace solo puede ir a `/accounts`, o reescribir el texto. El patrón con cuenta está en `quick-actions.tsx:84`.
  - **Botón de nueva clínica:** se llama «+ Nueva clínica de casos» (`case-clinic.tsx:57`), no «Nueva clínica».
  - **Collapsible:** sí existe, `src/components/ui/collapsible.tsx` (Radix, `package.json:33`). Hoy no lo usa nadie; el código usa `<details>` en 10 sitios (p. ej. `briefing.tsx:65`, `strategy-evidence.tsx:24`).

**Contradicciones con el código o con decisiones previas:**
1. §8 dice que con Finanzas sin permiso «se abre Resumen, como hoy». Es falso: hoy se muestra el aviso «Las finanzas solo las ven el Owner y el Sales Leader…» (`metrics.tsx:405-411`).
2. CA-2 choca con el código y con §10 («sin cambios de consultas»):
   - `hub.tsx:60` y las consultas de Theory U (`sensing.tsx:33`, `listening.tsx:40`, `prototypes.tsx:47`, `case-clinic.tsx:32`, `journey.tsx:32`) devuelven `.data ?? []` y nunca lanzan el error.
   - En `metrics.tsx:110-121`, `quotas`, `org_members` y `profiles` tampoco lanzan; solo `fetchAll` lanza (`fetch-all.ts:15`).
3. CA-7 de este SDD choca con SDD-A:
   - Este SDD fija la forma «Estimado · motivo».
   - SDD-A CA-9 prueba el texto literal «estimado: punto medio del rango» en `segment-coverage.test.tsx`. Integrar C obligaría a cambiar una aserción de A.
   - Los contratos tampoco coinciden. SDD-A §13 dice que C solo cambia «clases y estructura visual». Este SDD (§13) dice que cambia «estructura, estados y presentación», y además reescribe textos (E-4, E-7, formato de «Sin dato»).
4. CA-5 duplica a SDD-A CA-10 en `/metrics`: dos tests (`metrics/hints.test.tsx` y `hints-are-links.test.ts`) para la misma regla.
5. El texto propuesto «Ningún deal perdido en {T}» solo tiene sentido después de SDD-A CA-1. Hoy `RevopsLost` recibe todos los deals, sin trimestre (`metrics.tsx:239-245`).
6. «Los tres SDD de NK-0051» no cuadra con el registro:
   - El ledger dice 4 SDD (incluye `deal-won-duplicate-approvals`).
   - Los tres SDD citados tienen «Ticket: por asignar» (`ux-palette-graphite.md:5`, `ux-legibility-contrast.md:5`, `ux-move-without-drag.md:6`).
7. Con `SDD-20261031-ux-legibility-contrast` no hay solape funcional: no crea esqueleto ni estado de carga (su §13, línea 119). Sí hay colisión de archivos:
   - Su §13 permite poner `Kpi`/`Panel` en `page.tsx`, el mismo archivo donde va `ScreenState`.
   - Su suelo de 12 px toca las mismas líneas que E-5 (p. ej. `segment-coverage.tsx:128`, en `text-[11px]`).
   - El orden ya declarado lo cubre.
8. SDD-B en disco, cambios aún sin commit en el momento de la revisión:
   - Ya da por hecho `?seccion=drive` (línea 80), pero este SDD no define los ids de sección de `/hub` ni de `/theory-u`, ni si «Drive por cuenta» es una sección.
   - Su CA-5 ya cubre «nunca vacío mientras carga» en la búsqueda de `/hub`, lo que solapa con CA-1 de este SDD.
   - Su CA-9 pasa la consulta de `/hub` a `fetchAll`.

**Lo que esta revisión NO demuestra:**
- No ejecuté `scripts/factory/gate.mjs`. El cambio es solo de documentación (código igual a `main` @ f76f639), y el script escribe evidencias en disco, cosa que el encargo prohíbe. No se ejecutó ningún test ni build, así que no aplica el protocolo de flakes.
- No se ejecutó en una segunda máquina ni en prueba larga (soak).
- Los vacíos falsos los deduzco leyendo el código; no los vi en un navegador.
- Los recuentos de E-5 los reproduje con el mismo `awk` del SDD (coinciden: 4, 3, 2, 1, 1, 1). Es una aproximación, no una medida de líneas visibles.
- No revisé las consultas propias de cada panel de `/metrics`.
- SDD-B estaba cambiando en disco durante la revisión, así que el punto 8 puede quedar desfasado.

## Objeciones detalladas

1. **§8, caso Finanzas, es falso.**
   - Evidencia: `metrics.tsx:405-411`.
   - Corrección: «se mantiene el aviso actual de permisos», o decidir explícitamente que pase a abrir Resumen.

2. **CA-2 no se puede cumplir sin cambiar las consultas.**
   - Evidencia: `hub.tsx:60`; `sensing.tsx:33`; `listening.tsx:40`; `prototypes.tsx:47`; `case-clinic.tsx:32`; `journey.tsx:32`; `metrics.tsx:110-121`.
   - Corrección: añadir a U-1 «los `queryFn` del alcance lanzan si cualquier respuesta de Supabase trae `error`», y matizar §10 («mismas tablas y columnas; cambia el tratamiento del error»).

3. **CA-1 y CA-2 se prueban solo con el componente.**
   - Corrección: un test de render por pantalla, con Supabase simulado sin responder (y otro con error): `/hub`, `/metrics` y las cinco pestañas de `/theory-u`. La infraestructura existe (`vitest.config.ts` con jsdom y RTL, `src/test/app-routing.test.tsx`).
   - Añadir a E-1 los contadores de `hub.tsx:112`, que muestran 0 mientras carga, y el vacío de lista que falta en `case-clinic.tsx:56-64`.
   - Quitar `case-clinic.tsx:89` de la lista de vacíos falsos.

4. **CA-3 no está especificado ni se puede probar como está.**
   - Faltan: la lista cerrada de ids de cada pantalla (¿`drive` en `/hub`? ¿ids en español como en `/metrics`, línea 61?) y quién gana si `?doc=` apunta a otra sección que `?seccion=` (`useOpenDocFromUrl` llama a `setSection`, `hub.tsx:65`).
   - Corrección:
     - `screen-sections.test.ts` solo para la validación.
     - Un test de ruta para «cambiar actualiza la URL con `replace`» y para la combinación `?doc=`/`?q=`/`?seccion=`.
     - Regla propuesta: `?doc=` gana y reescribe `seccion`.

5. **CA-5, el recorrido de archivos, no es viable sin falsos positivos.**
   - Falsos positivos: «→» con sentido de flujo, que no es una pista: `self-service-funnel.tsx:70`, `:100-101`; `pipeline-board-panel.tsx:94-95`; `metrics.tsx:305`; comentarios en `budget-panel.tsx:12`, `cac-panel.tsx:82`, `drive-overview.tsx:1`. También pistas que ya son `<Link>`: `budget-panel.tsx:45`, `quarter-kpis-panel.tsx:76`.
   - Falsos negativos: `listening.tsx:49` («en el planificador de reuniones de cada cuenta») y `metrics.tsx:258` («Define cuotas abajo», no «más abajo»).
   - Corrección: lista cerrada de pistas con archivo:línea en §3 (E-4 ampliado con `listening.tsx:49` y `metrics.tsx:258`) y un test de render que compruebe que cada una es un enlace con su destino. En `/metrics`, dejarlo a SDD-A CA-10 para no tener dos tests.

6. **E-4 y el texto de §9: la ruta del Planificador.**
   - Evidencia: no existe pantalla propia; es la pestaña `meetings` de `/accounts/$id` (`accounts.$id.tsx:21`, `:91`).
   - Corrección: texto propuesto «Ábrelas desde una cuenta, en su pestaña «Planificador de reuniones».» con enlace a `/accounts`.
   - Corregir también el botón: «+ Nueva clínica de casos» (`case-clinic.tsx:57`).

7. **CA-6 no es medible y E-5 está incompleto.**
   - El alcance incluye `/theory-u` y `/hub`, pero E-5 solo lista paneles de Métricas.
   - Párrafos largos fijos que confirmé leyendo: `listening.tsx:49`, `case-clinic.tsx:54`, `prototypes.tsx:80`.
   - El mismo `awk` también da coincidencias en `journey.tsx`, `sensing.tsx` y `hub.tsx`, y 4 en `leads/lead-funnel-panel.tsx` (montado en `/metrics`, línea 415).
   - Corrección: cambiar «más de una línea» por un umbral de caracteres, y que el test valide una lista cerrada de archivo:línea. U-4 la fija antes de empezar, y la aprueba Fede.
   - Usar `src/components/ui/collapsible.tsx` (existe) o `<details>`, según cuál cumpla mejor «anuncia su estado».

8. **CA-7 choca con SDD-A y no se puede probar como está escrito.**
   - Evidencia: SDD-A CA-9 (texto «estimado: …») y SDD-A §9; unas 50 líneas con «—» en 9 archivos de `/metrics`.
   - Además, «—» a veces significa «no aplica», no «falta el dato» (p. ej. `revops-panels.tsx:83`, `winRate == null` sin cerrados).
   - Corrección:
     - Fijar con Fede una sola forma («Estimado · motivo» o «estimado: motivo») y que SDD-A use esa desde el principio, para que su test no tenga que cambiar.
     - Definir cuándo «—» es «no aplica» y puede quedarse.
     - Lista cerrada de sitios con su test de render.

9. **Contratos entre SDD inconsistentes.**
   - SDD-A §13 y SDD-B §13 dicen que C toca «clases y estructura visual». C §13 dice «estructura, estados y presentación», y además cambia textos.
   - Corrección: un único contrato escrito en los tres SDD:
     - A: datos y textos de datos.
     - B: búsqueda.
     - C: estados de pantalla (carga, error, vacío), URL, plegado y la forma del estado de un dato.
   - Indicar qué textos reescribe C (E-4, E-7).

10. **Cabecera.**
    - Corregir «los tres SDD de NK-0051»: el ledger dice 4 SDD (`.factory/ledger.json:1381`), y los tres citados dicen «Ticket: por asignar».
    - Añadir la colisión de archivos con `SDD-20261025-theory-u-proactive-decision-support` (toca `src/components/theory-u/*`, su línea 105) y fijar el orden.

11. **Alcance: hay que partirlo, y no por pantalla.**
    - Hoy son 3 pantallas, unos 15 archivos, 5 U, unas 50 sustituciones de «—», dos dependencias de orden (A y B) y una de base (NK-0051, sin código en el remoto).
    - Propuesta de partición:
      - **C1:** `ScreenState` + sección en la URL + vacíos y pistas en `/hub` y `/theory-u` (U-1, U-2, U-3). Solo depende de B.
      - **C2:** `HowCalculated` + `DataState` en `/metrics` (U-4, U-5). Depende de A y de NK-0051 (`Kpi`/`Panel`, 12 px).
    - Partir por pantalla, como sugiere §14, deja el conflicto con A sin resolver.


Informe de la segunda pasada (sobre v2), copiado sin editar:

- Veredicto del gate (segunda pasada): **Objeciones**

- Objeciones de la primera pasada:
  1. Resuelta. El caso Finanzas sale de C1, porque `/metrics` queda fuera del alcance (§5, l.36; nota de versión, l.107).
  2. Resuelta. Las consultas del alcance lanzan su error (U-1, l.82) y §10 ya dice que cambia el tratamiento del error (l.72). Una consulta se quedó fuera: ver la objeción nueva 3.
  3. Parcial. Ya hay tests de render por pantalla (l.45), contadores de `/hub` (l.23), vacío de lista en clínicas (l.24) y `:89` fuera de la lista. Pero CA-1 prohíbe «contadores a 0» en todas las pestañas de Theory U, y E-1 y §6 solo citan los de `/hub`.
  4. Parcial. Ya fija ids y precedencia (l.49) y hay test de URL para `/hub`. Faltan tres cosas: un test de URL para `/theory-u`; la regla «`doc` gana» rompe H-2; y los ids dependen de §15.1, que sigue abierta.
  5. Resuelta para C1. E-4 es una lista cerrada (l.27) con test de render (l.53). `/metrics` queda en SDD-A CA-11 (`metrics-honest-data.md:93`).
  6. Resuelta. La ruta del Planificador está en l.27 y l.66, y el botón «+ Nueva clínica de casos» en l.64.
  7. No aplica a C1 (CA-6 pasa a C2). No la revisé.
  8. No aplica a C1. La forma única está fijada en SDD-A CA-10 (`metrics-honest-data.md:90`, «la que fija SDD-C2»).
  9. Parcial. El contrato es idéntico en A:134, B:109, C1:10 y C2:9, pero B:109 añade «C1 hereda el vacío de búsqueda de CA-5 en su `ScreenState`» y C1 no lo recoge.
  10. Resuelta. La cabecera cita 4 SDD y el SDD de Theory U proactivo, con el orden fijado (l.5).
  11. Resuelta. El SDD está partido: C1 solo depende de B (l.5).

- CA sin prueba posible o sin G-n (sin PRD no exijo G-n):
  - **CA-3 en `/theory-u`:** no tiene test que compruebe que cambiar de pestaña escribe `?seccion=` con `replace`. Solo se cita `hub-screen.test.tsx`, y U-2 solo `screen-sections.test.ts`.
  - **CA-4 en `/hub`:** dice «lista cerrada en §9», pero §9 no da texto para el vacío de `hub.tsx:132` ni para el vacío de búsqueda que B le deja a C1. No se puede escribir la aserción. Además, U-3 no lista `hub-screen.test.tsx` aunque CA-4 lo cita.

- [Por verificar] que sigue sin comprobarse:
  - Si `driveAccountsOverview` (`src/lib/drive.functions`) lanza o devuelve errores parciales por cuenta (`drive-overview.tsx:85`). No lo leí.
  - Lo que §16 deja pendiente se puede cerrar ya. A nivel de panel, `DriveAccountsPanel` no se traga el error: tiene carga y error propios (`drive-overview.tsx:25`, `:41-42`, con `errorText`).

- Contradicciones con el código o con decisiones previas:
  - CA-3 («conserva `doc`» y «`doc` gana») choca con H-2. Ver la objeción nueva 1.
  - `hub.tsx:60` queda cubierto dos veces. B, que se integra antes, pasa la lectura a `fetchAll` (B CA-9, B:108), que ya lanza (`fetch-all.ts:15`). Cuando llegue C1, E-2 en `/hub` ya está resuelto, y los números de línea de `hub.tsx` se habrán movido.
  - Dos tests de render para la misma pantalla: B usa `src/routes/_authenticated/-hub.test.tsx` (B:59, B:101) y C1 `src/components/hub-screen.test.tsx`.
  - B:109 dice que C1 hereda el vacío de búsqueda de B CA-5; C1 no lo menciona.
  - CA-3 fija los ids en inglés, pero §15.1 sigue abierta. Las decisiones de Fede del 2026-11-06 no la cubren: rotular (A), tope y enmiendas (D), bug de Telegram (D) y rama perdida (C1 §15.4).
  - §14 (l.95) dice «sus 8 commits hay que rehacerlos desde los SDD de paleta y legibilidad». El ledger habla de 4 SDD (`.factory/ledger.json:1381`), y la cabecera también los cita (l.5): faltan `move-without-drag` y `deal-won-duplicate-approvals`.

- Lo que esta revisión NO demuestra:
  - No ejecuté `scripts/factory/gate.mjs`, ni tests, ni build: es un cambio solo de documentación (código = `main` @ f76f639) y el encargo prohíbe escribir.
  - No miré nada en un navegador: los vacíos falsos y los contadores a 0 los deduzco leyendo el código.
  - No leí `drive.functions`.
  - No revisé C2 ni A a fondo; solo comprobé el contrato y los puntos que se les trasladaron.
  - No comprobé el comportamiento de `Tabs` controlado de Radix con la URL.
  - No hay segunda máquina ni prueba larga (soak).

**Objeciones nuevas**

1. **La precedencia de `?doc=` rompe H-2.**
   - Evidencia: CA-3 (l.49) conserva `doc` al cambiar de sección y además hace que `doc` gane. `useOpenDocFromUrl` abre una vez por valor de `doc` (`use-open-doc-from-url.ts:4`, `:20`) y llama a `setSection` (`hub.tsx:65`).
   - Caso: abres `/hub?doc=X` y cambias a otra sección. La URL queda `?doc=X&seccion=Y`. Al recargar, volver atrás o compartir, `doc` reescribe `seccion` y se pierde la pestaña.
   - Corrección: un cambio de sección hecho por la persona borra `doc` de la URL. `doc` solo gana al abrir la página. Probarlo en el test de ruta de `/hub`.

2. **Los contadores de Theory U están fuera de la lista, pero CA-1 los exige.**
   - Evidencia, contadores que hoy marcan 0 mientras carga:
     - `sensing.tsx:77` («{n} notas»)
     - `listening.tsx:59` y `:65-67` (distribución y «Conversaciones valoradas» a 0)
     - `prototypes.tsx:89` («(0)» por columna)
   - Corrección: añadirlos a E-1, a §6 y al recuento de §4, o acotar CA-1 a los vacíos de E-1 y a los contadores de `/hub`.

3. **Una consulta que se traga el error queda fuera de E-2.**
   - Evidencia: `journey.tsx:37-42` (`u_counts`, `n.count ?? 0`). Si falla, muestra 0 notas y 0 experimentos como si fueran datos.
   - Corrección: incluirla en E-2 y U-1, o excluirla de forma explícita en §5.

4. **§9 no cierra la lista de vacíos de `/hub`.**
   - Evidencia: E-1 incluye `hub.tsx:132` y CA-4 cita `hub-screen.test.tsx`, pero §9 no da su texto. Tampoco recoge el vacío de búsqueda que B le deja a C1 (B:109, B CA-5).
   - Corrección: añadir a §9:
     - `hub.tsx:132`: se mantiene «Sin documentos todavía. Crea el primero con «+ Nuevo».», solo tras responder.
     - Vacío de búsqueda: el texto de B CA-5, sin cambios, pintado con `ScreenState`.
     - Añadir `hub-screen.test.tsx` a U-3.

5. **Hay solape con B en la lectura y en los tests de `/hub`.**
   - Evidencia: B CA-9 y B:108 ya pasan `hub.tsx:60` a `fetchAll`, que lanza (`fetch-all.ts:15`). B:101 crea `-hub.test.tsx`.
   - Corrección:
     - E-2 y U-1: «en `/hub` la consulta ya lanza tras SDD-B; C1 solo pinta el error».
     - Usar `src/routes/_authenticated/-hub.test.tsx` en lugar de `src/components/hub-screen.test.tsx` (CA-1, CA-2, CA-3, CA-4 y U-1).
     - Avisar de que las líneas de `hub.tsx` son de `f76f639` y se mueven con B.

6. **CA-3 no tiene prueba en `/theory-u`.**
   - Evidencia: l.49 y U-2 (l.83) solo citan `screen-sections.test.ts` y `hub-screen.test.tsx`. Hoy `theory-u.tsx` no tiene `validateSearch` y usa `Tabs defaultValue` (`theory-u.tsx:13-21`).
   - Corrección: añadir a CA-3 y U-2 un test de ruta de `/theory-u` (apertura con `?seccion=`, id desconocido, cambio con `replace`).

7. **Los ids de CA-3 dependen de una pregunta abierta.**
   - Evidencia: CA-3 fija `objections`, etc. (l.49), y §15.1 (l.98) sigue sin decidir.
   - Corrección: que Fede responda §15.1 antes del brief, o marcar los ids de CA-3 como pendientes de esa decisión.

8. **§14 se queda corto con lo que hay que rehacer.**
   - Evidencia: l.95 frente a l.5 y `.factory/ledger.json:1381` (4 SDD).
   - Corrección: «sus 8 commits hay que rehacerlos desde los 4 SDD de NK-0051 (en «Borrador»)».


Informe de la tercera pasada (sobre v3), copiado sin editar:

- **Veredicto del gate (tercera pasada):** Sin objeciones. La v3 resuelve las 8 objeciones nuevas de la segunda pasada y las parciales que quedaban de la primera (3, 4 y 9). No he encontrado nada que haga un CA imposible de probar, que contradiga el código o que rompa otro SDD. Quedan notas para el brief.

- **Objeciones de la segunda pasada:**
  1. Resuelta. `doc` solo manda al abrir la página. Un cambio de sección hecho a mano quita `doc`, y se prueba en `hub-screen.test.tsx` (CA-3, l.76). Falta decir si la escritura de `seccion` al abrir `?doc=` usa `replace` (nota 1).
  2. Resuelta. Los contadores de Theory U están en E-1c (l.25), en §4 (l.44) y en §6 (l.67). El recuento de §4 no cuadra con E-1c (nota 4).
  3. Resuelta. `u_counts` (`journey.tsx:34-43`) está en E-2, CA-2, U-3 y §13.
  4. Resuelta. §9 cierra la lista de `/hub`: la sección sin documentos, el vacío de búsqueda de B CA-5 y el aviso de truncado de B CA-9. U-2 cita `hub-screen.test.tsx`.
  5. Resuelta. En `/hub` la consulta ya lanza el error tras B, y C1 solo lo pinta. Hay un único test, `src/components/hub/hub-screen.test.tsx`, el mismo que fija B (B:33, :112). Avisa de que las líneas de `hub.tsx` se mueven.
  6. Resuelta. Theory U pasa a `theory-u-screen.tsx`, con su propio test de URL (CA-3, U-3, U-4).
  7. Resuelta. Los ids están marcados como propuesta pendiente de Fede (§15.1). La pregunta sigue abierta, pero eso no es objeción.
  8. Resuelta. §14 habla ya de los 4 SDD de NK-0051.

- **CA sin prueba posible o sin G-n:** ninguno. No hay PRD, así que no exijo G-n.

- **[Por verificar] que sigue sin comprobarse:**
  - Si las `Tabs` de Radix controladas desde la URL funcionan en jsdom con `fireEvent.mouseDown`. Lo confirma el primer test de U-4.
  - Qué pasa en `/metrics` si `orgId` no llega nunca (persona sin empresa). La consulta desactivada deja `isPending` en verdadero, así que la carga no terminaría nunca. No comprobé si la ruta `_authenticated` lo impide.
  - Que los tests de SDD-A sigan pasando con los estados de C1. Hoy no se puede comprobar porque esos tests aún no existen.
  - Todo `hub-screen.tsx` y sus simulacros dependen de código de B que aún no existe. Las líneas citadas son de `f76f639`.

- **Contradicciones con el código o con decisiones previas:** ninguna bloqueante. Comprobé que todas las líneas de E-1, E-1c, E-1b, E-1m, E-2, E-3 y E-4 coinciden con `f76f639`, salvo:
  - U-5 dice que con `quotas` en error «hoy no aparece nada». Es falso: hoy la página se pinta igual, con `quotas = []` (`metrics.tsx:110`, `:120`). El test sigue fallando primero, porque no aparece `errorText`.
  - El contrato es idéntico en A, B, C1, C2 y D. Las decisiones de Fede del 2026-11-06 (rama de NK-0051 perdida) están recogidas. NK-0066 no afecta a C1.

- **Lo que esta revisión NO demuestra:**
  - No ejecuté tests, ni build, ni `scripts/factory/gate.mjs`: el cambio es solo de documentación y el encargo prohíbe escribir.
  - No miré nada en un navegador. Los vacíos falsos, los contadores y el blanco de `/metrics` los deduzco leyendo el código.
  - No revisé A, B, C2 ni D a fondo. Solo miré el contrato, las referencias cruzadas y los tests que A crea.
  - No comprobé el comportamiento de Radix ni del historial del navegador en jsdom.
  - No hay segunda máquina ni prueba larga (soak).

**Objeciones bloqueantes**

Ninguna.

**Notas para el brief**

1. **Escribir `seccion` al abrir `?doc=` debe usar `replace: true`.**
   - Evidencia: `use-open-doc-from-url.ts:20` no vuelve a abrir el documento mientras `doc` no cambie.
   - Problema: si `onOpen` añade una entrada al historial, «Atrás» vuelve a `/hub?doc=X` sin `seccion`. La lista mostraría `company` y el editor seguiría en X, de otra sección. Eso rompe H-2.
   - Corrección: añadirlo a CA-3 y a `hub-screen.test.tsx`, comprobando que `navigate` se llama con `replace: true` también en la apertura por `doc`.
2. **La lista de tests de A en §13 está incompleta.**
   - Evidencia: §13 (l.136) solo nombra `segment-coverage.test.tsx`, `cac-panel.test.tsx` y `pipeline-board-panel.test.tsx`. A crea además `budget-panel.test.tsx`, `quarter-kpis-panel.test.tsx`, `metrics/performance-panels.test.tsx`, `metrics/revops-panels.test.tsx` y `metrics/hints.test.tsx` (`metrics-honest-data.md:116`, `:160`, `:162`).
   - Corrección: un check en el brief, «los tests de A y de B pasan sin cambios» (`git diff` vacío en sus archivos de test), como hace C2 en su U-1.
3. **El test de CA-6 debe simular también lo que A extrae.**
   - Evidencia: tras A, `metrics.tsx` importa `src/components/metrics/performance-panels.tsx` (A U-2).
   - Corrección: simular también ese módulo, además de `useMe`, `useStages` y `useCurrency`.
   - Decisión pendiente en §13 (l.135): no hace falta extraer `metrics-screen.tsx`. Importar `Route.options.component` se puede probar y evita el choque con A y C2.
4. **El recuento de contadores de §4 no cuadra con E-1c.**
   - Evidencia: §4 dice «5 en Theory U», pero E-1c (l.25) da 6 o 7 sitios según cómo se agrupen: `sensing:77`, `listening:59`, `:65`, `:66-67`, `prototypes:89` y `journey:135-136`.
   - Corrección: fijar en el brief la lista cerrada que cuenta (línea base y objetivo 0).
5. **`PipelineBoardPanel` en CA-7.**
   - Hoy ya devuelve `null` mientras carga (`pipeline-board-panel.tsx:42`, `:59`), así que su caso «sin responder» no falla primero. Solo falla primero el caso «con error».
   - El test necesita simular `useLeads` (fuera de alcance). Con `ScreenState` sobre su consulta y `leadsData` aún sin llegar, debe seguir sin pintar cifras.
6. **El error de `fetchAll` pierde el `code` de Postgres.**
   - Evidencia: `fetch-all.ts:15` hace `throw new Error(error.message)`, así que `errorText` solo puede reconocer el error por su mensaje.
   - Impacto: los casos de RLS y JWT se siguen reconociendo por el mensaje; el resto cae en el texto genérico.
   - Corrección: en los tests de CA-2 y CA-6, usar un error que se reconozca por mensaje, o comprobar el texto genérico.
7. **Cambiar de trimestre vuelve a mostrar el estado de carga.**
   - La clave de las consultas de `/metrics` y de sus paneles cambia con el trimestre (p. ej. `["metrics", orgId]` y las de los paneles por `quarter`). Al cambiarlo, `isPending` vuelve a ser verdadero y se ve la carga, no los datos anteriores.
   - Es correcto (hoy enseña vacíos falsos), pero conviene decirlo en §8 para que el walkthrough no lo marque como fallo.
8. **Lo que se queda fuera.** `SelfServiceFunnel` muestra mientras carga «conecta tu PostHog en Conexiones» (`self-service-funnel.tsx:61`), porque `trials` está vacío. Es una pista que depende del dato. No entra en C1; anotarlo en §15.5 o como ticket aparte.
9. **Simulacros del test de Theory U.** Las pestañas usan funciones de servidor: `synth` en `journey.tsx:102`, `analyze` en `sensing.tsx:49` y `decideExperiment` en `prototypes.tsx:58`. Además, `TabsContent` desmonta las pestañas inactivas, así que cada caso de CA-1 y CA-2 por pestaña tiene que abrirse con su `?seccion=`.


Revisión de coherencia entre los cinco SDD del sprint: `docs/sdd/annex/sprint1-cross-sdd-gate-20261106.md`.

## 18. Delta de implementación (lo rellena el agente al entregar)
—
