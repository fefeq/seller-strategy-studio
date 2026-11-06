# SDD-20261106-ux-core-screens-pattern · [Mejora] NK-0051 ampliado, C1: estados, URL, vacíos y pistas en Conocimiento y Theory U

**Tipo:** Mejora · **Prioridad propuesta:** Media
**Estado:** Borrador (v2, partido tras el gate: este es C1; C2 está en `SDD-20261106-ux-metrics-data-state.md`) · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-11-06 · **Ticket:** NK-0051 (ampliación decidida por Fede: no se abre ticket aparte)
**PRD:** No aplica (mejora acotada; contexto en `docs/UX-INFORME-20261031.md`) · **Depende de:** `SDD-20261106-hub-search` (SDD-B) se integra antes · **Coordinar con:** los otros SDD de NK-0051 según el ledger (`.factory/ledger.json`, «4 SDD»): `SDD-20261031-ux-palette-graphite`, `SDD-20261031-ux-legibility-contrast` (su §13 permite poner `Kpi`/`Panel` en `src/components/page.tsx`, el mismo archivo que `ScreenState`), `SDD-20261031-ux-move-without-drag`, `SDD-20261031-deal-won-duplicate-approvals`; `SDD-20261025-theory-u-proactive-decision-support` (toca `src/components/theory-u/*`: C1 va antes, por ser más pequeño); PR #76 de Plays (`headlines.ts`, `nav.ts`, que no se tocan)

> Sprint 1 de mejoras en pantallas core, bloque C. Rehecho el 2026-11-06 tras perderse la versión anterior (no llegó a subirse).
> **Base:** la rama local de NK-0051 (`feat/ux-graphite-legibility-move`, «8 commits sobre 47ec72c» según el ledger) se perdió (confirmado por Fede, 2026-11-06). C1 parte de `main` @ `f76f639` y no depende de ella.

**Contrato entre los SDD del sprint (el mismo texto en A, B, C1 y C2):** A cambia datos y textos de datos de `/metrics`; B, la búsqueda de `/hub`; C1, estados de pantalla (carga, error, vacío), sección en la URL, vacíos y pistas de `/hub` y `/theory-u`; C2, el plegado de explicaciones en las tres pantallas y la forma del estado de un dato en `/metrics`. Orden de integración: A → B → C1 → C2.

## 1. Resumen
En Conocimiento y Theory U, la pantalla dice «vacío» mientras carga, se traga los errores, pierde la pestaña al volver atrás o compartir el enlace, y alguna pista nombra un sitio sin llevar a él. C1 añade un estado de pantalla común (carga, error, vacío), pone la sección en la URL, da a cada vacío una acción y convierte las pistas en enlaces. No cambia datos.

## 2. Problema y para quién
Cualquier persona del equipo que usa Conocimiento o Theory U: ve «Sin notas todavía» cuando sí las hay, o no ve nada cuando algo falla.

## 3. Evidencia y por qué ahora
Leído en `main` @ `f76f639` y revisado por el gate (§17).

| # | Problema | Dónde |
|---|---|---|
| E-1 | Vacío falso mientras carga (por defecto `[]` y vacío pintado antes de responder) | `hub.tsx:58` + `:132`, y los contadores de `:112` (0 mientras carga); `theory-u/journey.tsx:30` + `:69`; `sensing.tsx:36` + `:80`; `listening.tsx:43` + `:71`; `prototypes.tsx:50` + `:133` (sin selección) |
| E-1b | Falta vacío de lista: sin clínicas, la columna solo muestra el botón | `theory-u/case-clinic.tsx:56-64` (`:89` es correcto: «Selecciona o crea…») |
| E-2 | Errores tragados: las consultas devuelven `.data ?? []` y nunca lanzan | `hub.tsx:60`; `sensing.tsx:33`; `listening.tsx:40`; `prototypes.tsx:47`; `case-clinic.tsx:32`; `journey.tsx:32` |
| E-3 | Sección fuera de la URL | `theory-u.tsx:21` (`Tabs defaultValue`); `hub.tsx:53` (`useState("company")`). Modelo: `/metrics` con `?seccion=` (`metrics.tsx:94`, `:219-226`) |
| E-4 | Pistas sin enlace | `listening.tsx:49` («en el planificador de reuniones de cada cuenta») y `:71` («Cuentas → Planificador de reuniones»). El Planificador no tiene ruta propia: es la pestaña `meetings` de `/accounts/$id` (`accounts.$id.tsx:21`, `:91`) |

Uso de estas pantallas: sin dato.

## 4. Resultado buscado
Medible por código, línea base en §3 y objetivo 0: vacíos falsos en carga (6 sitios), errores tragados (6 consultas), secciones fuera de la URL (2 pantallas), pistas sin enlace (2). Uso o satisfacción: sin dato.

## 5. Alcance
**Incluye:** en `/hub` (todas sus secciones y «Drive por cuenta») y en las cinco pestañas de `/theory-u`: `ScreenState`, consultas que lanzan su error, `?seccion=`, vacíos con acción y pistas de E-4 como enlace.
**No incluye:** `/metrics` (estados de carga de `/metrics` y forma del dato van a C2; datos a SDD-A); plegado de explicaciones (C2); paleta, tamaños y `Kpi`/`Panel` (otros SDD de NK-0051); titulares con conclusión (§15); botón «Llevar a GTM Lab» (Sprint 3); avisos proactivos de Theory U; `nav.ts`; esquema, RLS, IA.

## 6. Cambios de comportamiento (delta)
**Añadido:** estado de carga y de error en `/hub` y `/theory-u`; `?seccion=` en las dos; vacío de lista en clínicas.
**Modificado:** vacíos de E-1 solo tras responder; contadores de `/hub` sin número hasta responder; texto y enlace de E-4.
**Eliminado:** nada.

## 7. Historias y criterios de aceptación
### H-1: Como persona del equipo, quiero que la pantalla no me mienta mientras carga ni cuando falla.
- **CA-1** En `/hub` y en cada pestaña de `/theory-u`, mientras la consulta que decide el vacío no ha respondido, se ve el estado de carga, nunca el texto de vacío ni contadores a 0. · prueba: `src/components/screen-state.test.tsx` (componente) y un test de render por pantalla con Supabase simulado sin responder: `src/components/hub-screen.test.tsx`, `src/components/theory-u/theory-u-screens.test.tsx`
- **CA-2** Si la consulta devuelve error, se ve el mensaje de `errorText()` («qué pasó + qué hacer») y no el vacío. · prueba: los mismos tests, con Supabase simulado devolviendo error

### H-2: Como persona del equipo, quiero volver atrás o compartir el enlace sin perder la pestaña.
- **CA-3** `/hub?seccion=<id>` (ids: `company`, `objections`, `playbooks`, `methodology`, `campaigns`, `skills`, `rules`, `drive`) y `/theory-u?seccion=<id>` (ids: `journey`, `sensing`, `listening`, `clinic`, `prototypes`) abren esa sección; un id desconocido abre la sección por defecto; cambiar de sección actualiza la URL con `replace` y conserva `q` y `doc`; si `?doc=` apunta a otra sección, gana `doc` y reescribe `seccion`. · prueba: `src/lib/screen-sections.test.ts` (validación y precedencia) y `src/components/hub-screen.test.tsx` (URL al cambiar)

### H-3: Como persona del equipo, quiero que un vacío o una pista me digan qué hacer y me lleven allí.
- **CA-4** Cada vacío de E-1 y E-1b dice qué es y ofrece la acción siguiente cuando existe (lista cerrada en §9). · prueba: `src/components/theory-u/theory-u-screens.test.tsx`, `src/components/hub-screen.test.tsx`
- **CA-5** Las pistas de E-4 son enlaces a `/accounts` con el texto de §9. · prueba: `src/components/theory-u/theory-u-screens.test.tsx`

## 8. Casos límite y errores
- Red caída o RLS con error: CA-2.
- «Drive por cuenta» (`?seccion=drive`): su panel tiene sus propias consultas (`DriveAccountsPanel`); [Por verificar] si también traga errores; si sí, entra en CA-2.
- Pestaña con varias consultas: decide la que pinta el vacío.
- `?seccion=drive&q=…`: la caja de búsqueda se oculta y `q` se conserva (SDD-B §8).

## 9. Experiencia y copy
- Carga: esqueleto por tipo de bloque (lista o tarjetas); «Cargando…» solo como texto accesible.
- Vacíos (lista cerrada):
  - Clínicas sin ninguna: «Aún no hay clínicas de casos. Crea la primera con «+ Nueva clínica de casos».» (botón de `case-clinic.tsx:57`).
  - Sensing: «Sin notas todavía. Habla con clientes, observa y anota.» (se mantiene; solo deja de salir en carga).
  - Escucha: «Aún no hay reuniones con nivel de escucha. Ábrelas desde una cuenta, en su pestaña «Planificador de reuniones».» con enlace a `/accounts`.
  - Recorrido U y Prototipos: texto actual, solo tras responder.
- Pista de `listening.tsx:49`: «… en el planificador de reuniones de cada cuenta» pasa a enlazar «cada cuenta» a `/accounts`.
- Español, «tú», sin iconos.

## 10. Datos, permisos y privacidad
Mismas tablas, columnas y RLS. Cambia el tratamiento del error: los `queryFn` del alcance lanzan si la respuesta trae `error`. Tests con datos ficticios.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| ninguna | — | — | — |

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | `ScreenState` en `src/components/page.tsx` junto a `Empty`; consultas del alcance que lanzan; uso en `/hub` y Theory U | CA-1, CA-2 | `src/components/screen-state.test.tsx`, `src/components/hub-screen.test.tsx`, `src/components/theory-u/theory-u-screens.test.tsx` |
| U-2 | `src/lib/screen-sections.ts` (ids, validación, precedencia de `doc`) y `?seccion=` en las dos rutas | CA-3 | `src/lib/screen-sections.test.ts` |
| U-3 | Vacíos y pistas de §9 | CA-4, CA-5 | `src/components/theory-u/theory-u-screens.test.tsx` |

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- `ScreenState` recibe `isPending`, `error` y `data` de `useQuery`; quitar el `= []` por defecto de las consultas afectadas.
- `validateSearch` de `hub.tsx:23` pasa a `{ doc?, q?, seccion? }` (`q` lo añade SDD-B). `useOpenDocFromUrl` llama hoy a `setSection` (`hub.tsx:65`): con la sección en la URL, debe escribir `seccion`. En `theory-u.tsx`, `Tabs value` controlado desde la búsqueda; `navigate({ search: (prev) => ({ ...prev, seccion }), replace: true })`.
- Tests de pantalla fuera de `src/routes/` (el generador de rutas los tomaría por rutas) o con prefijo `-`; infraestructura en `vitest.config.ts` y `src/test/app-routing.test.tsx`.
- Los ids de `/hub` son los valores de `knowledge_docs.section` (estables) y no ids en español como los de `/metrics`: evita una tabla de traducción. Ver §15.

## 14. Riesgos y dependencias
- `page.tsx` lo tocan también los SDD de legibilidad (`Kpi`/`Panel`): conflicto de archivo, no de función; lo resuelve el orden.
- Theory U proactivo toca los mismos componentes: C1 va antes.
- La rama local de NK-0051 se perdió: sus 8 commits hay que rehacerlos desde los SDD de paleta y legibilidad (en «Borrador»).

## 15. Preguntas para Fede y para la revisión técnica
1. **Ids en la URL de `/hub`:** propongo los internos en inglés (`?seccion=objections`), por estabilidad. ¿O prefieres español como en `/metrics` (`?seccion=objeciones`)?
2. **Titulares con conclusión** para Conocimiento y Theory U: ¿los quieres? Irían en `headlines.ts` después de integrar el PR #76.
3. **Resumen de Métricas en 4-5 KPI** (punto 15 del informe UX): ¿SDD propio o se espera a tener uso real?
4. **Decidido (Fede, 2026-11-06): la rama local de NK-0051 se perdió.** C1 parte de `main` y no depende de ella; los SDD de paleta y legibilidad siguen en «Borrador» sin código.

## 16. Pendiente de verificar
- Si `DriveAccountsPanel` traga errores: el brief.
- ~~Estado real de la rama local de NK-0051~~: perdida (Fede, 2026-11-06).

**Versión 2 (2026-11-06):** partido tras el gate (objeción 11): este documento es C1; HowCalculated y DataState pasan a C2. Corregidos §8 Finanzas (sale de C1), CA-2 (consultas que lanzan, objeción 2), CA-1 con tests por pantalla (3), CA-3 con ids y precedencia (4), CA-5 con lista cerrada (5), ruta del Planificador y nombre del botón (6), contrato único entre SDD (9) y cabecera (10). No ha tenido segunda pasada del gate.

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

## 18. Delta de implementación (lo rellena el agente al entregar)
—
