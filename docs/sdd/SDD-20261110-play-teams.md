# SDD-20261110-play-teams · [Feature] Catálogo de tareas, seis equipos de plays y vista en /plays

**Tipo:** Feature (sin cambio de esquema) · **Prioridad propuesta:** Media (es el paso entre el catálogo ordenado del SDD 1 y el diagnóstico del SDD 4; sin equipos, el diagnóstico no tiene qué proponer)
**Estado:** Borrador · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-11-10
**Ticket:** NK-0140 (NK-0126 iniciativa; este es su SDD 2)
**PRD:** `docs/prd/PRD-20261110-diagnostico-y-equipos-de-plays.md` (cubre G-1 en parte, G-2 y G-3; G-1 se mide en el SDD 4) · **Depende de:** `SDD-20261110-plays-phase-autonomy-deps.md` (NK-0127, Hecho en `main`: `phase`, `approval`, `dependsOn` y `recommendablePlays`) · **Coordina con:** SDD 4 de la iniciativa (`diagnosis-in-chat`), que consumirá los equipos; SDD 2 a 9 de plays y NK-0081 a NK-0083, que tocan `catalog.ts` (este SDD no lo toca)

> Un SDD dice cómo se verifica que está bien hecho. Cada criterio de aceptación (CA-n) tiene una prueba automática que lo nombra.
> Nivel elegido: SDD completo bajo un PRD de iniciativa ya aprobado (fila 2 del §8 del PRD); es una feature con pantalla y herramienta del agente, así que un SDD corto dejaría sin fijar la vista y el contrato MCP.
> Números de línea comprobados en `main` @ `f176ae4` (rama `docs/sprint6-sdd-play-teams`, sin cambios en `src/`), el 2026-11-10.

## 1. Resumen
Un **equipo de plays** es una tarea que una empresa quiere resolver («Reuniones», «Reactivar perdidos»…) con los plays que la resuelven. Este SDD añade el catálogo fijo de seis equipos en código (`src/lib/plays/teams.ts`, como el catálogo de plays), una función pura que ordena los plays de cada equipo con `recommendablePlays` y separa los que no se pueden recomendar con su motivo, una vista «Equipos de plays» dentro de `/plays` y una herramienta de lectura `list_play_teams` para el agente y MCP. No hay migración: el estado sigue siendo por play (`play_states`), así que un play que está en dos equipos se activa una vez y cuenta en los dos.

## 2. Problema y para quién
`/plays` enseña 28 plays con su estado, fase y nivel, pero no la tarea que resuelve cada uno ni cuáles van juntos. Owner y Sales Leader (quienes activan, decisión 16 del PRD) no saben por dónde empezar; el resto del equipo ve los equipos y no los activa. El diagnóstico (SDD 4) necesita un catálogo de tareas cerrado para proponer «equipos priorizados» (decisiones 5, 9, 17 y 21 del PRD).

## 3. Evidencia y por qué ahora
**Lo que ya existe (leído en `main` @ `f176ae4`):**
- `src/lib/plays/catalog.ts:84` `CATALOG` con 28 plays; `:44-50` `PHASES` y `APPROVALS`; `Play` (`:52-73`) ya tiene `phase`, `approval` y `dependsOn`. Comentario de cabecera (`:3-4`): el catálogo vive en código, no en la base de datos; el estado por empresa es lo único que se guarda (`play_states`).
- `src/lib/plays/recommend.ts:12` `recommendablePlays(catalog)`: devuelve `recommended` (orden por fase y dependencias, desempate por orden del catálogo) y `excluded` con motivo; recibe el catálogo como parámetro y no lee `play_states` (`:4-5`). Hoy **solo lo usan sus pruebas** (`grep` de `recommendablePlays` en `src/`: `recommend.ts` y `recommend.test.ts`).
- `src/lib/plays/status.ts:39` `canTogglePlays` (solo `owner` y `sales_leader`), `:61` `effectiveState`, `:69` `checkToggle`, `:84` `describePlay` (la única forma en que pantalla y agente describen un play).
- `src/lib/plays/view.ts:6-44` palabras de estado, motion, canal, fase y nivel; `:53` `filterPlays`.
- `src/components/plays/plays-panel.tsx:67-197` `PlaysPanel`: filtros (`:102-139`) y tarjeta de play con botón Activar/Pausar y «Ver actividad» (`:142-192`), que escribe vía `setPlayEnabled` (`src/lib/plays.functions.ts:10`) e invalida `PLAY_STATES_KEY` (`:86`). La tarjeta está dentro del `map`, no es un componente aparte.
- `src/components/plays/use-play-states.ts:8` `usePlayStates`: lee `play_states` con RLS de la empresa activa.
- `src/routes/_authenticated/plays.tsx:26-34`: la ruta solo pinta `Page` con `playsHeadline(rows)` y `PlaysPanel`; no tiene `validateSearch`. Precedente de secciones por parámetro: `src/routes/_authenticated/metrics.tsx:57-59` (`?seccion=`) y su barra de enlaces `:202-216`.
- `src/lib/agent/tools/plays.ts:11` `stateRows` (lectura de `play_states` filtrada por `c.orgId`; un fallo cuenta como sin filas), `:21` `list_plays`, `:38` `get_play`, `:48` `set_play_enabled`. Títulos MCP en `src/lib/mcp/tools/agent-tools.ts:109-111`; manifiesto en `.lovable/mcp/manifest.json:4425` (`list_plays`), `:4465`, `:4491`.
- `src/lib/agent/tools/plays.test.ts:280-301`: prueba que cada herramienta de plays tiene título en `TITLES`, está una vez en el registro y aparece en el manifiesto con su `readOnlyHint`.
- `src/lib/nav.ts:34`: entrada «Plays GTM» con `keywords: "jugadas señales automatizaciones"`; `src/lib/nav.ts:52`: «Equipo» es la pantalla de miembros (`/team`). Riesgo de confusión de nombre (abierta 4 del PRD).

**Estado real de los plays de los seis equipos** (lectura de `catalog.ts`): la composición tiene 13 entradas y 12 plays distintos (`signals-in-crm-with-decay` está en dos equipos); los 12 existen: 11 son `parcial` y `pain-qualified-segments` (`:168`) es `planificado`. Son exactamente los 12 plays que el SDD 1 llama construibles con datos propios; ningún `bloqueado` está en un equipo. Dependencias reales: `signal-activation` → `signals-in-crm-with-decay` (`:152`) y `pain-qualified-segments` → `call-transcript-signal-extraction` (`:178`); las dos quedan **dentro** de su equipo.

**Discrepancia con el PRD:** la composición aprobada dice que `multi-thread-inbound-leads` «se muestra como bloqueado» hasta tener el contacto adicional, pero en el catálogo es `parcial` sin `blockedBy` (`catalog.ts:234-247`, comentario en `:240`: «CA-3 reserva `blockedBy` para plays bloqueados: queda como necesidad»), y el SDD 1 prohíbe cambiar `status`. Este SDD no cambia el catálogo: el play se muestra con su estado real y su necesidad «Contacto adicional vía Apollo o Clay» (decisión P-1 del coordinador, §15).

**Uso real:** sin dato (no hay equipos todavía).

**Por qué ahora:** el SDD 1 dejó `recommendablePlays` hecho y sin consumidor; el SDD 4 (diagnóstico en chat) necesita un catálogo de tareas cerrado y una forma de leerlo desde el agente.

## 4. Resultado buscado
Referencia a los objetivos del PRD:
- **G-1** (diagnósticos terminados con al menos un equipo propuesto; se mide en el SDD 4). Este SDD lo prepara: seis equipos con sus plays ordenados por fase y dependencias, con el motivo de cada excluido. Indicador interno: equipos del catálogo válidos, 6 de 6; línea base 0 (no existen). Fuente: `src/lib/plays/teams.test.ts`.
- **G-2** (ningún envío automático = 0). Un equipo no tiene salidas propias ni acción propia: solo agrupa plays cuyas salidas ya están limitadas a `suggestion`, `task` y `draft` (`catalog.test.ts:129-142`). La herramienta nueva es de lectura. Medida: prueba.
- **G-3** (plays no recomendables recomendados = 0). Ningún equipo pone como paso un play `bloqueado`, `planificado` o que dependa de uno de ellos; se reutiliza `recommendablePlays`, sin lógica paralela. Medida: prueba.
- Uso de la vista: sin dato; no se instrumenta aquí.

## 5. Alcance
**Incluye:**
- `src/lib/plays/teams.ts` (nuevo, puro): tipo `PlayTeam` (`id`, `title`, `task`, `plays`), `PLAY_TEAMS` con los seis equipos de la composición aprobada (§13) y en ese orden, `teamPlan(team, catalog, rows)` y `validateTeams(teams, catalog)`.
- Palabras de la vista (§9) en `teams.ts`, un único juego de textos para pantalla y agente.
- `src/components/plays/play-card.tsx` (nuevo): la tarjeta de play que hoy está dentro de `PlaysPanel` (`plays-panel.tsx:142-192`), extraída **sin cambiar su comportamiento**, para que el catálogo y los equipos usen la misma. El estado `open` de «Ver actividad» sigue en el panel (una sola actividad abierta a la vez, como hoy, `plays-panel.tsx:73`, `:179-180`) y llega a la tarjeta como `open` y `onToggleOpen`.
- `src/components/plays/use-play-toggle.ts` (nuevo): hook `usePlayToggle` con la lógica de activación que hoy está en `flip` (`plays-panel.tsx:70`, `:72`, `:81-92`: `useServerFn(setPlayEnabled)`, `busy`, `toast` con `errorText`, invalidar `PLAY_STATES_KEY`). Lo usan `PlaysPanel` y `PlayTeamsPanel`; no hay dos copias de esa lógica.
- `src/components/plays/play-teams-panel.tsx` (nuevo): la vista «Equipos de plays».
- `src/routes/_authenticated/plays.tsx`: `validateSearch` con `vista?: "equipos"` y una barra con dos enlaces, «Todos los plays» (sin parámetro, la vista de hoy) y «Equipos de plays» (`?vista=equipos`), con el patrón de `metrics.tsx:202-216`. La ruta sigue teniendo solo configuración y disposición.
- Herramienta de lectura `list_play_teams` en `src/lib/agent/tools/plays.ts`, su título en `TITLES` y el manifiesto **regenerado con el extractor** (`node node_modules/@lovable.dev/mcp-js/dist/cli/extract-manifest.cjs .`), nunca a mano.
- `src/lib/nav.ts:34`: añadir «equipos» a `keywords` de «Plays GTM» para que ⌘K lo encuentre.
- Una línea en `src/lib/AGENTS.md` (párrafo de Plays GTM, `:68`) que diga dónde viven los equipos.

**No incluye** (el brief lo copia a «Movimientos prohibidos»):
- Migraciones, tablas, columnas, políticas o GRANTs; `play_states` y `play_runs` no cambian. No hay estado por equipo.
- Cambiar `CATALOG` (`status`, `blockedBy`, `phase`, `approval`, `dependsOn`, `needs`, `outputs`, `detectors`) ni `recommendablePlays`, `effectiveState`, `checkToggle` o `describePlay`.
- Un botón «Activar equipo» o cualquier activación en bloque: se activa play a play con el botón que ya existe (decisión 5: «no activa nada solo»; decisión P-2 del coordinador, §15).
- El diagnóstico, preguntas al usuario o priorizar equipos por empresa (SDD 4 y 5).
- Departamentos (Sales, Deals, Intelligence) como campo o filtro; equipos de Customer, Marketing u Operations (decisiones 6 y 11).
- Cambiar `list_plays`, `get_play` o `set_play_enabled` (entrada, salida o descripción) ni sus entradas en el manifiesto.
- Horas, dinero o puntuaciones; nuevos titulares en `headlines.ts` (la ruta sigue usando `playsHeadline`).
- Editar `.lovable/mcp/manifest.json` a mano.
- Usar la palabra «agente» para un equipo de plays (decisión 14).

## 6. Cambios de comportamiento (delta)
**Añadido:** catálogo `PLAY_TEAMS`; `teamPlan` y `validateTeams`; vista «Equipos de plays» en `/plays?vista=equipos`; herramienta `list_play_teams` (agente in-app, Telegram y MCP); palabra clave «equipos» en ⌘K.
**Modificado:** `/plays` muestra arriba la barra «Todos los plays» / «Equipos de plays»; sin parámetro se ve exactamente lo de hoy. La tarjeta de play pasa a un componente propio y la lógica de activar o pausar a `usePlayToggle`, con el mismo contenido y el mismo comportamiento (una sola actividad abierta a la vez).
**Eliminado:** nada.

## 7. Historias y criterios de aceptación
### H-1: Como Owner o Sales Leader, quiero ver los plays agrupados por la tarea que resuelven, en orden, para saber por dónde empezar.
- **CA-1** (catálogo de equipos) `PLAY_TEAMS` tiene exactamente seis equipos, con ids únicos en kebab-case ASCII y, en este orden, los títulos y plays de la tabla del §13 (comparación literal de ids). Cada equipo tiene `title` y `task` no vacíos en español · cubre G-1 · prueba: `src/lib/plays/teams.test.ts` (falla hoy: el módulo no existe)
- **CA-2** (validez) `validateTeams(PLAY_TEAMS, CATALOG)` devuelve `[]`. Con catálogos y equipos de prueba devuelve un error con palabras para: un id que no está en el catálogo, un play repetido dentro de un equipo, un equipo vacío, dos equipos con el mismo id y un play cuya dependencia (`dependsOn`) no está en su mismo equipo · cubre G-1, G-3 · prueba: `src/lib/plays/teams.test.ts`
- **CA-3** (orden) `teamPlan(team, catalog, rows)` devuelve `steps` (los plays del equipo que `recommendablePlays(catalog)` recomienda, en el **mismo orden relativo** que esa función, numerados desde 1) y `unavailable` (los demás plays del equipo, en el orden del equipo, con el `reason` de `recommendablePlays`). Sobre el catálogo real, `steps` de cada equipo es exactamente el de la tabla «Plan esperado» del §13 · cubre G-1 · prueba: `src/lib/plays/teams.test.ts`
- **CA-4** (nunca recomienda lo que no se puede) Con un catálogo de prueba, un play `bloqueado`, uno `planificado` y uno que depende de un `planificado` nunca aparecen en `steps` y sí en `unavailable` con el motivo de `recommendablePlays`; en el catálogo real, `pain-qualified-segments` está en `unavailable` de «Aprender de llamadas» con «todavía no está construido». `teamPlan` no define motivos propios (las cadenas salen de `recommendablePlays`) · cubre G-3 · prueba: `src/lib/plays/teams.test.ts`
- **CA-5** (estado compartido) `teamPlan` describe cada play con `describePlay(play, rows.get(id))`: el mismo play en dos equipos tiene el mismo `enabled` y `label` en los dos. `summary` = `{ available: steps.length, total: plays.length, enabled }`, donde `enabled` cuenta los plays del equipo con `enabled` true; con `rows` vacío cuenta los `defaultEnabled`. Cada play lleva `sharedWith`: los títulos de los otros equipos donde aparece (en el real, `signals-in-crm-with-decay` → «Señales de cuenta» desde «Reactivar perdidos» y al revés) · cubre G-1 · prueba: `src/lib/plays/teams.test.ts`
- **CA-6** (sin salidas propias, sin E/S) `PlayTeam` no tiene `outputs` ni acción; la unión de `outputs` de los plays de cada equipo está dentro de `OUTPUTS`. `teams.ts` no importa el cliente de Supabase, `play_states` ni ninguna función de servidor (guarda de fuente, como `recommend.test.ts:164`) · cubre G-2 · prueba: `src/lib/plays/teams.test.ts` (falla hoy solo porque el módulo no existe; después es guarda de regresión)

### H-2: Como miembro de la empresa, quiero ver los equipos de plays en `/plays` con su estado, y como Owner o Sales Leader, activar sus plays desde ahí.
- **CA-7** (vista) Con `useServerFn`, el cliente de Supabase y `usePlayStates` simulados (precedente: `src/components/strategy-screens.test.tsx`), `PlayTeamsPanel` pinta los seis equipos en el orden de `PLAY_TEAMS`, cada uno con su título, su tarea, el resumen en palabras (§9) y sus pasos numerados («Paso 1», «Paso 2»…) antes de los no disponibles («No disponible: <motivo>»). Ningún texto visible es solo un número, un icono o un color · cubre G-1 · prueba: `src/components/plays/play-teams-panel.test.tsx` (nuevo; falla hoy: el componente no existe)
- **CA-8** (activar una vez) Con una fila `{ play_id: "signals-in-crm-with-decay", enabled: true }`, ese play se ve «Activado» en «Reactivar perdidos» y en «Señales de cuenta», con «También en: <otro equipo>». Con rol `owner`, pulsar «Pausar» en uno de los dos llama a `setPlayEnabled` **una vez** con `{ play_id: "signals-in-crm-with-decay", enabled: false }` e invalida `PLAY_STATES_KEY`. Con rol `ae`, el botón está deshabilitado y se ve el motivo de `canTogglePlays` · cubre G-1, G-3 · prueba: `src/components/plays/play-teams-panel.test.tsx`
- **CA-9** (no activa lo que no se puede) En la vista de equipos, el botón de `pain-qualified-segments` está deshabilitado con el texto de `checkToggle` («No puedes activar este play todavía: …») también para `owner` · cubre G-3 · prueba: `src/components/plays/play-teams-panel.test.tsx`
- **CA-10** (sin regresión del catálogo; guarda) La prueba renderiza `PlaysPanel` con `useServerFn` (`setPlayEnabled`), el cliente de Supabase, `usePlayStates`, `toast` y `Activity`/`play_runs` simulados, y comprueba: los 28 plays; los tres filtros (`aria-label` «Filtrar por motion», «Filtrar por estado», «Filtrar por fase»); en un play `parcial` y uno `bloqueado`, título, estado, motion, canales, `label`, fase y nivel, «Necesita» y el motivo de bloqueo; y además:
  - (a) con `owner`, pulsar «Activar» en un `parcial` sin activar llama a `setPlayEnabled` **una vez** con `{ data: { play_id, enabled: true } }`, invalida `PLAY_STATES_KEY` y el botón está deshabilitado mientras la llamada no termina;
  - (b) si `setPlayEnabled` falla, `toast.error` recibe el texto de `errorText` del error;
  - (c) con `ae`, el botón está deshabilitado y se ve «Solo el Owner o el Sales Leader pueden activar o pausar plays.»;
  - (d) con `owner`, en un `bloqueado` el botón está deshabilitado y se ve el `error` de `checkToggle`;
  - (e) «Ver actividad» pone `aria-expanded` a `true` y cambia a «Ocultar actividad»; abrir la de otro play cierra la primera (solo una abierta).

  Se escribe y pasa sobre el código de hoy **en un commit anterior a la extracción** de `PlayCard` y `usePlayToggle`; el gate la ejecuta en ese commit y en el final · cubre G-3 · prueba: `src/components/plays/plays-panel.test.tsx` (nuevo; guarda de regresión, **no** fail-first: hoy ya pasa)
- **CA-11** (ruta) `validateSearch` de `/plays` acepta `vista: "equipos"` y descarta cualquier otro valor (`undefined`); sin parámetro se pinta `PlaysPanel`, con `?vista=equipos`, `PlayTeamsPanel`. La barra tiene `aria-label="Vistas de Plays GTM"` y dos enlaces, «Todos los plays» y «Equipos de plays» · cubre G-1 · `validateSearch` usa una función exportada `parsePlaysSearch`, que se prueba pura (`{ vista: 'equipos' }` → `{ vista: 'equipos' }`; `{ vista: 'otra' }` y `{}` → `{ vista: undefined }`). Además, un render de la ruta real con `RouterProvider`, `createRouter({ routeTree })` y `createMemoryHistory({ initialEntries: ['/plays?vista=equipos'] })`, con el patrón de `src/test/auth-no-bounce.test.tsx:6-8`, comprueba la barra (`aria-label` y los dos enlaces) y que se pinta `PlayTeamsPanel`; con `/plays`, `PlaysPanel` · prueba: `src/routes/_authenticated/plays.test.tsx` (nuevo; falla hoy: no hay `parsePlaysSearch` ni barra)
- **CA-12** (⌘K) La entrada «Plays GTM» de `nav.ts` incluye «equipos» en `keywords` · cubre G-1 · prueba: `src/lib/nav.test.ts` (caso nuevo junto a `:14`; falla hoy)

### H-3: Como Owner, quiero preguntar al agente (o a mi asistente por MCP) qué equipos de plays hay y en qué orden, sin abrir la pantalla.
- **CA-13** (herramienta) `list_play_teams` es `kind: "read"`, sin `roles`, con entrada `z.object({})`. `executeTool(ctx, "list_play_teams", {})` devuelve `{ teams }` con los seis equipos en orden; cada uno con `id`, `title`, `task`, `summary`, `steps` y `unavailable` tal como `teamPlan`, construidos con las filas de `play_states` **de `c.orgId`** (reutiliza `stateRows`, `plays.ts:11`); `expectScoped(log)` pasa y no hay escrituras (`writes(log)` vacío). Una lectura fallida de `play_states` devuelve los equipos con los valores por defecto, igual que `list_plays` (`plays.test.ts:151`) · cubre G-1, G-2 · prueba: `src/lib/agent/tools/plays.test.ts` (falla hoy: la herramienta no existe)
- **CA-14** (título y manifiesto) `TITLES.list_play_teams` = «Ver los equipos de plays»; la herramienta está una vez en `TOOLS`; en `.lovable/mcp/manifest.json` aparece una vez, con ese `title` y `readOnlyHint: true`. Que las entradas de `list_plays`, `get_play` y `set_play_enabled` no cambien lo comprueba CA-14b, no este test · cubre G-2 · prueba: `src/lib/agent/tools/plays.test.ts` (ampliando `:280-301`; falla hoy)
- **CA-14b** (sale del extractor) Ejecutar `node node_modules/@lovable.dev/mcp-js/dist/cli/extract-manifest.cjs .` sobre el árbol entregado no deja diff (`git diff --exit-code -- .lovable/mcp/manifest.json`), y las entradas de `list_plays`, `get_play` y `set_play_enabled` (`jq` por `name`) son iguales en `f176ae4` y en el commit final · prueba: comandos del gate (`--extra`) sobre el commit final; no es un test unitario
- **CA-15** (palabras) La `description` de `list_play_teams` dice que solo lee, que un equipo de plays agrupa plays por tarea, que un play puede estar en varios equipos y se activa una vez, y que para activar se usa `set_play_enabled`. Regla exacta sobre los textos de `teams.ts` (títulos, tareas y palabras del §9) y la `description` de la herramienta: (1) no aparece «Equipo» ni «Equipos» con **mayúscula inicial** que no vaya seguido de « de plays» (`/\bEquipos?\b(?! de plays)/`, distinguiendo mayúsculas), porque así se confunde con la pantalla de miembros (`nav.ts:52`); «equipo» y «equipos» en minúscula dentro de una frase sí se permiten (p. ej. «varios equipos», «Ningún equipo»); (2) los textos de `teams.ts` y el título de la herramienta no contienen «agente» ni «agentes» (`/\bagentes?\b/i`), y la `description` no llama «agente» a un equipo (`/equipos? de plays[^.]*\bagentes?\b/i` sin coincidencias) · cubre G-1 · prueba: `src/lib/plays/teams.test.ts` y `src/lib/agent/tools/plays.test.ts`

## 8. Casos límite y errores
- **Empresa sin filas en `play_states`:** todos los plays con su valor por defecto; el resumen cuenta `defaultEnabled` (CA-5).
- **Lectura de `play_states` fallida:** en pantalla, `usePlayStates` lanza el error y la vista se pinta con los valores por defecto, como el catálogo hoy (`plays-panel.tsx:69-74`); en el agente, igual que `list_plays` (CA-13).
- **Un play en dos equipos:** una sola fila en `play_states`; el cambio se ve en los dos tras invalidar la caché (CA-8).
- **Equipo sin pasos** (todos sus plays no disponibles): se pinta igual, con «0 de N plays disponibles» y la lista de no disponibles con su motivo. Hoy no ocurre con el catálogo real.
- **Id de equipo inexistente en el catálogo o dependencia fuera del equipo:** la prueba de `validateTeams` falla, la suite no pasa y el gate no deja integrar (CA-2); `vite build` no ejecuta pruebas, así que no es el build quien lo para. En ejecución, `teamPlan` ignora un id que no esté en el catálogo, sin romper la pantalla.
- **Play `parcial` que en la práctica necesita algo externo** (`multi-thread-inbound-leads`): se muestra recomendable con su necesidad (decisión P-1, §15).
- **Otra empresa (multitenant):** el catálogo de equipos es código común; la pantalla lee `play_states` con RLS de la empresa activa y la herramienta filtra por `c.orgId` (CA-13). Nada de otra empresa llega.
- **Miembro sin rol de líder:** ve los equipos y el estado; los botones, deshabilitados con el motivo (CA-8).

## 9. Experiencia y copy
Textos propuestos; Fede los revisa en la aprobación. Español, «tú», sin iconos, estados con palabra.
- Barra: «Todos los plays» · «Equipos de plays».
- Introducción de la vista: «Un equipo de plays agrupa los plays que resuelven una misma tarea, en el orden en que conviene activarlos. Un play puede estar en varios equipos: se activa una vez y cuenta en todos. Ningún equipo envía nada: solo sugerencias, tareas y borradores que tú confirmas.»
- Resumen de un equipo: «{available} de {total} plays disponibles · {enabled} activados» (singular «1 activado»).
- Paso: «Paso {n}» antes del título del play.
- No disponible: «No disponible: {motivo}» (motivo de `recommendablePlays`).
- Compartido: «También en: {títulos de los otros equipos}».
- Tareas de los seis equipos (propuesta de redacción; el campo `task`):
  - Reuniones: «Llegar preparado a cada reunión y no dejar ninguna sin seguimiento.»
  - Reactivar perdidos: «Volver a los deals perdidos cuando algo ha cambiado de verdad en la cuenta.»
  - Señales de cuenta: «Saber qué cuentas se mueven y actuar antes de que la señal se enfríe.»
  - Aprender de llamadas: «Sacar de las llamadas los dolores reales y agrupar las cuentas por ellos.»
  - Priorizar cuentas y limpiar CRM: «Decidir a qué cuentas dedicar tiempo y tener un CRM del que fiarte.»
  - Entrantes y producto: «Atender cada registro y cada lead entrante a tiempo y con las personas correctas.»
- Título MCP: «Ver los equipos de plays».
- Sin textos de error nuevos: el de `setPlayEnabled` pasa por `errorText`, como hoy (`plays-panel.tsx:88`).

## 10. Datos, permisos y privacidad
- **Sin migración.** Por qué no hace falta: los equipos son un catálogo fijo en código (decisión 17), igual que los plays (`catalog.ts:3-4`); el único estado es por play (decisión 18: «se activa una vez y se comparte»), y ya vive en `play_states` (migración 0077: `org_id`, RLS por empresa, escriben Owner y Sales Leader, leen los miembros, sin borrado; `src/lib/AGENTS.md:68`). Guardar un estado por equipo duplicaría el de sus plays y podría contradecirlo.
- Permisos sin cambios: leer equipos, cualquier miembro (pantalla y `list_play_teams`); activar o pausar, solo Owner y Sales Leader, a través de `setPlayEnabled`/`togglePlay`, que ya comprueban rol y bloqueo en servidor.
- `list_play_teams` lee `play_states` con `.eq("org_id", c.orgId)` (contexto de confianza), como `list_plays`.
- Datos de código, no de clientes. Pruebas con catálogos y filas ficticios.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| Ninguna | — | — | — |

`list_play_teams` es una herramienta que el modelo ya puede llamar como las demás; no añade llamadas de IA. El contexto del agente crece en una herramienta más del registro (sin dato de tokens).

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | `src/lib/plays/teams.ts`: `PlayTeam`, `PLAY_TEAMS`, `validateTeams`, `teamPlan`, palabras del §9 | CA-1, CA-2, CA-3, CA-4, CA-5, CA-6, CA-15 (parte de textos) | `src/lib/plays/teams.test.ts` |
| U-2 | (commit 1) Guarda de `PlaysPanel` en verde sobre el código de hoy; (commit 2) extracción de `PlayCard` y `usePlayToggle`, con `open` en el panel, sin cambio de comportamiento | CA-10 | `src/components/plays/plays-panel.test.tsx` (guarda; pasa en el commit 1, antes de extraer, y sigue pasando en el 2 y en el final) |
| U-3 | `PlayTeamsPanel` con `PlayCard` y `usePlayToggle` (y su propio `open`, uno a la vez); `parsePlaysSearch`, `validateSearch` y barra en `plays.tsx`; «equipos» en `nav.ts` | CA-7, CA-8, CA-9, CA-11, CA-12 | `src/components/plays/play-teams-panel.test.tsx`, `src/routes/_authenticated/plays.test.tsx`, `src/lib/nav.test.ts` |
| U-4 | `list_play_teams` en `plays.ts`, `TITLES`, manifiesto regenerado con el extractor; línea en `src/lib/AGENTS.md` | CA-13, CA-14, CA-14b, CA-15 (parte de la herramienta) | `src/lib/agent/tools/plays.test.ts` |

U-3 depende de U-1 y U-2. U-4 depende de U-1.

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- `teamPlan` llama a `recommendablePlays(catalog)` y filtra por los ids del equipo; no recalcula bloqueos ni orden. Como `validateTeams` exige que cada dependencia esté en el mismo equipo, el orden relativo global es válido dentro del equipo.
- `teamPlan(team, catalog = CATALOG, rows = new Map())`: el catálogo es parámetro para probar con catálogos de prueba, como `recommend.test.ts:10-26`.
- `sharedWith` se calcula de `PLAY_TEAMS` (no se escribe a mano), así la nota «También en» no se desincroniza.
- `PlayCard` recibe `play` (de `CATALOG`), la descripción (`describePlay`), `roles`, `busy`, `onToggle`, `open` y `onToggleOpen`. El estado `open` vive en cada panel (uno abierto a la vez, como hoy).
- `usePlayToggle()` devuelve `{ busy, flip }` y concentra `useServerFn(setPlayEnabled)`, `toast.success(r.mensaje)`, `toast.error(errorText(e))` e invalidar `PLAY_STATES_KEY`; lo usan los dos paneles (recomendación del gate, pasada 1, adoptada).
- La ruta sigue el patrón de `metrics.tsx:57-59` y `:202-216`. Alternativa descartada: pestañas de Radix dentro del panel, porque `?vista=` deja enlazar la vista desde el agente y el SDD 4.
- Ids de equipo propuestos: `reuniones`, `reactivar-perdidos`, `senales-de-cuenta`, `aprender-de-llamadas`, `priorizar-cuentas-y-crm`, `entrantes-y-producto`.
- Alternativa descartada: tabla `play_teams` en base de datos. No hay nada por empresa que guardar (§10) y el catálogo de plays ya fijó que estas listas viven en código y las vigilan las pruebas.
- Tras tocar herramientas: `node node_modules/@lovable.dev/mcp-js/dist/cli/extract-manifest.cjs .` y `TITLES`.

**Composición (aprobada por Fede en el PRD, decisión 27, «ok a todo», 2026-11-10)**
| Equipo de plays | Plays (en el orden del equipo) |
|---|---|
| Reuniones | `meeting-prep-and-follow-up`, `meeting-form-orchestration` |
| Reactivar perdidos | `closed-lost-revival`, `signals-in-crm-with-decay` |
| Señales de cuenta | `signals-in-crm-with-decay`, `signal-activation` |
| Aprender de llamadas | `call-transcript-signal-extraction`, `pain-qualified-segments` |
| Priorizar cuentas y limpiar CRM | `hubspot-account-tiering-scoring`, `crm-hygiene` |
| Entrantes y producto | `plg-to-sales`, `product-sign-up-outreach`, `multi-thread-inbound-leads` |

**Plan esperado sobre el catálogo real** (deducido de `phase`, `dependsOn` y orden de `catalog.ts`; CA-3 lo fija):
| Equipo | `steps` | `unavailable` |
|---|---|---|
| Reuniones | `meeting-form-orchestration` (captura), `meeting-prep-and-follow-up` (generación) | — |
| Reactivar perdidos | `signals-in-crm-with-decay` (captura), `closed-lost-revival` (generación) | — |
| Señales de cuenta | `signals-in-crm-with-decay` (captura), `signal-activation` (orquestación) | — |
| Aprender de llamadas | `call-transcript-signal-extraction` (captura) | `pain-qualified-segments` («todavía no está construido») |
| Priorizar cuentas y limpiar CRM | `hubspot-account-tiering-scoring` (fundación), `crm-hygiene` (captura) | — |
| Entrantes y producto | `plg-to-sales` (captura), `product-sign-up-outreach` (generación), `multi-thread-inbound-leads` (generación) | — |

## 14. Riesgos, dependencias y walkthrough
**Riesgos:**
- **Confusión con «Equipo» (miembros):** mitigado con «equipo de plays» siempre completo (CA-15); se revisa en el walkthrough (abierta 4 del PRD).
- **Promesa excesiva:** 11 de los 12 plays de los equipos son `parcial` y el otro, `planificado` (su lógica completa llega con los SDD 2 a 9 de plays). Un equipo «disponible» significa que sus plays se pueden activar, no que estén terminados; la introducción no dice más que eso.
- **`multi-thread-inbound-leads` sale como disponible** aunque el PRD lo esperaba bloqueado (decisión P-1, §15; bloquearlo en el catálogo es un ticket aparte).
- **Conflictos de rama:** este SDD no toca `catalog.ts`; si un SDD de plays cambia ids, fases o dependencias de los 12 plays, CA-2 y CA-3 fallan y obligan a revisar la composición. Es intencionado.
- **Manifiesto en caché** de asistentes MCP: no verán `list_play_teams` hasta refrescar; no rompe nada.

**Dependencias:** SDD 1 (Hecho). El PRD §8 solo deja empezar los SDD 1 y 3 mientras no se cierren NK-0009 y el sustituto de NK-0028. Este SDD no depende del onboarding y empieza antes por decisión informada de Fede (GO del Sprint 6, 2026-11-10; registrada en §15). El SDD 4 sigue esperando a NK-0009.

**Walkthrough** (`nokko-walkthrough`, móvil y escritorio, claro y oscuro, con un Owner y con un AE ficticios):
1. `/plays` sin parámetro → se ve lo de hoy (28 plays, tres filtros) y la barra «Todos los plays» / «Equipos de plays».
2. «Equipos de plays» → URL `?vista=equipos`; seis equipos en el orden del §13, cada uno con tarea, resumen y pasos como en «Plan esperado».
3. «Aprender de llamadas» → «Segmentos cualificados por dolor» como «No disponible: todavía no está construido», botón deshabilitado con su motivo.
4. Owner: activar «Señales en el CRM con caída en el tiempo» desde «Señales de cuenta» → aparece «Activado» también en «Reactivar perdidos» sin recargar; el resumen de los dos equipos sube en 1. Volver a «Todos los plays» → el mismo estado.
5. AE: los botones deshabilitados con «Solo el Owner o el Sales Leader pueden activar o pausar plays.»
6. Agente: «¿qué equipos de plays tengo y por cuál empiezo?» → responde con los seis y su orden, sin activar nada.
7. ⌘K: escribir «equipos» → aparece «Plays GTM», y no lleva a «Equipo» (`/team`) antes que a «Plays GTM»; anotar el orden.
8. Móvil por debajo de md: barra de vistas y tarjetas sin desplazamiento lateral; la barra inferior no tapa el último equipo (`pb-28`).
9. Consola y red sin errores; la única escritura es la de `setPlayEnabled` del paso 4.
10. Un play pausado de un equipo sigue saliendo como «Paso n» con la palabra «Pausado»: es lo esperado (recomendar no es activar, SDD 1), no un error.

## 15. Preguntas para Fede y para la revisión técnica
**Decisiones tomadas (autor, para que Fede las confirme o cambie):**
- **D-1.** Sin migración: equipos en código y estado solo por play (§10).
- **D-2.** Un equipo es una tarea (decisión 9 y 17): el «catálogo de tareas» y el de equipos son el mismo `PLAY_TEAMS`, con `task` como la frase de la tarea. No se añade un catálogo de tareas aparte.
- **D-3.** Orden de los equipos fijo (el de la composición aprobada); priorizarlos por empresa es del SDD 4.
- **D-4.** La vista vive en `/plays?vista=equipos`; por defecto `/plays` sigue mostrando el catálogo de hoy (confirmado por el coordinador, P-3).
- **D-5.** Se incluye `list_play_teams` (lectura) para que el agente y MCP vean los equipos ya, y el SDD 4 parta de ella; `list_plays` y `get_play` no cambian.
- **D-6.** Cada dependencia de un play debe estar en su mismo equipo (CA-2); hoy se cumple.

**Decisión del coordinador (delegación de Fede, GO Sprint 6, 2026-11-10):**
- **P-1.** `multi-thread-inbound-leads` se muestra con su estado real del catálogo (`parcial`) y su necesidad. Si se bloquea en el catálogo es un ticket aparte, fuera de este SDD.
- **P-2.** Sin botón «Activar los disponibles» por equipo (decisión 5 del PRD: no activa nada solo).
- **P-3.** `/plays` sigue abriendo por defecto en la lista de hoy (D-4); los equipos, en `?vista=equipos`.
- **P-4.** Textos del §9 tal como están redactados; Fede puede editarlos después.

**Decisión de Fede (GO del Sprint 6, 2026-11-10), sobre el orden del PRD §8:** la propuesta del coordinador para el Sprint 6 le dijo a Fede: «El PRD pone NK-0009 (onboarding) como requisito previo de la iniciativa, pero el SDD 2 no depende de él. Cuando lleguemos al SDD 4 tendremos que tratar NK-0009.» Fede respondió «GO» (2026-11-10). Por tanto, este SDD empieza antes de NK-0009 por decisión de Fede; el SDD 4 sigue esperando a NK-0009.

**Para Fede:** ninguna pregunta abierta.

## 16. Pendiente de verificar
- [Por verificar, gate] CA-14b: el extractor no deja diff en el manifiesto sobre el commit final, y las entradas de `list_plays`, `get_play` y `set_play_enabled` (`jq` por `name`) son iguales en `f176ae4` y en el commit final.
- [Por verificar, gate] CA-10: la guarda pasa en el commit anterior a la extracción y en el commit final.
- [Por verificar, gate] CA-11: el render de la ruta con `routeTree` y `createMemoryHistory` funciona con los mocks del patrón de `auth-no-bounce.test.tsx`.
- [Por verificar, walkthrough] Que «equipo de plays» no se confunda con «Equipo» (miembros) en el menú y en ⌘K.
- [Por verificar, walkthrough] Móvil sin desplazamiento lateral (paso 8).

**Lo que NO se afirma:**
- No se afirma que estos seis equipos sean la mejor agrupación de los plays: es la composición aprobada por Fede, no un resultado medido.
- No se afirma que un equipo «disponible» resuelva su tarea de principio a fin: 11 de sus 12 plays son `parcial` y uno está `planificado`.
- No se mide G-1 (diagnósticos con equipo): llega con el SDD 4.
- No se agrupan los 16 plays `bloqueado`: no están en ningún equipo y siguen visibles, con su motivo, en «Todos los plays» (decisión 15 del PRD).
- No se afirma el coste en tokens de añadir una herramienta al registro: sin dato.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Un agente `nokko-gate` con contexto fresco lee este SDD y el código, y devuelve su informe. El coordinador lo copia aquí sin editarlo. El gate no aprueba el SDD: informa; la aprobación es de Fede.
- Veredicto del gate: pasada 1, CAMBIOS (resueltos en el texto; ver la tabla de abajo). Pasada 2: pendiente.
- CA sin prueba posible o sin G-n: —
- [Por verificar] que sigue sin comprobarse: —
- Contradicciones con el código o con decisiones previas: —
- Lo que esta revisión NO demuestra: —

### §17 Gate · pasada 1: hallazgos y resolución
Informe: `.factory/evidence/sprint6-sdd-gate/gate-pass1.md` (2026-11-10, HEAD `c3eb3a2`). Veredicto: CAMBIOS (0 bloqueantes, 4 mayores, 4 menores). Todas las citas `archivo:línea` comprobadas correctas en `f176ae4`; el «Plan esperado» del §13 coincide con el `recommendablePlays` real.

| Hallazgo | Resolución |
|---|---|
| **MAYOR G-M1** El §14 contradice el orden del PRD §8 (solo SDD 1 y 3 antes de NK-0009) | §14 cita la regla del PRD y §15 registra la decisión informada de Fede (GO del Sprint 6, 2026-11-10) con la cita de la propuesta; el SDD 4 sigue esperando a NK-0009. |
| **MAYOR G-M2** La guarda CA-10 no cubre lo que se mueve al extraer | CA-10 añade (a) clic y llamada, deshabilitado mientras dura, (b) error por `errorText`, (c) rol sin permiso, (d) play bloqueado, (e) «Ver actividad»; se escribe y pasa en un commit anterior a la extracción (U-2 en dos commits). Se adopta el hook `usePlayToggle` compartido (§5, §13). |
| **MAYOR G-M3** Mover `open` a la tarjeta cambia el comportamiento | `open` sigue en el panel y llega a `PlayCard` por props; la guarda comprueba que abrir una actividad cierra la otra (CA-10 e). |
| **MAYOR G-M4** CA-15 contradice los textos aprobados | Regla exacta: solo falla «Equipo»/«Equipos» con mayúscula no seguido de « de plays» (`/\bEquipos?\b(?! de plays)/`); las minúsculas se permiten; «agente» con su expresión regular. |
| **MENOR G-m1** `validateTeams` no se ejecuta en el build | §8: lo paran la suite y el gate, no `vite build`. |
| **MENOR G-m2** CA-11 dejaba la prueba a elección | CA-11 fija `parsePlaysSearch` puro más un render de la ruta real con el patrón de `src/test/auth-no-bounce.test.tsx`. |
| **MENOR G-m3** CA-14 no podía comprobar que no cambian las otras entradas | La comparación base contra final (`jq` por `name`) pasa a CA-14b, comando del gate; CA-14 se queda con título, `readOnlyHint` y una aparición. |
| **MENOR G-m4** §16 no recogía lo nuevo | §16 añade la guarda en los dos commits, la comparación del manifiesto y el render de la ruta. |
| Observaciones (play pausado como «Paso n»; ⌘K «equipos» frente a `/team`) | Pasos 7 y 10 del walkthrough. |

## 18. Delta de implementación (lo rellena el agente al entregar)
—
