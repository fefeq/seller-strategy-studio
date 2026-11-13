# PRD-20261113-iconografia · [Iniciativa] Iconografía de NOKKO: un icono por concepto, siempre con su etiqueta

**Tipo:** Iniciativa · **Prioridad propuesta:** Media (mejora de comprensión y consistencia sin cambiar datos, esquema ni flujos; el coste es de ingeniería, de peso de bundle y de reglas de diseño; no hay dato de uso que diga cuánto duele hoy, es una apuesta declarada)
**Estado:** Borrador · **Pide:** Fede (2026-11-12) · **Aprueba:** Fede · **Fecha:** 2026-11-13
**Ticket:** NK-0168 (`.factory/ledger.json`, estado LOGGED, sin SDD ni PRD enlazados)
**SDD que lo desarrollan:** pendiente (sección 8). **No se redacta ninguno hasta que Fede responda la pregunta 1 de la sección 9** (revocar la regla «sin iconos»).

> Un PRD dice qué se quiere y por qué. No dice cómo se construye ni cómo se prueba: eso es del SDD.
> Hechos verificados sobre `origin/main` @ 36b4b1b, solo lectura, el 2026-11-13. Tras la pasada 1 del gate se contrastaron de nuevo contra `origin/main` @ 051ef2c: los archivos citados no cambiaron (los recuentos de §6 son de 051ef2c). Lo que no se ha podido comprobar va como **[Por verificar]**.

## 1. Problema
NOKKO es una interfaz de solo texto **a propósito**: el 2026-10-24 se quitaron los iconos del producto y desde entonces la regla del sistema visual es «sin iconos» (historia y citas en §3). El menú, la barra inferior móvil y la paleta ⌘K no tienen un solo icono, y las acciones repetidas (descartar, quitar, confirmar, importar…) se distinguen únicamente por la palabra. Donde hoy hay "iconos" son glifos de texto sueltos (`✕`, `☰`, `‹`, `›`, `→`, `×`, `↑`, `↓`, `✓`, `✗`, `▲`, `▼`, `+`/`−`) que no siguen ninguna regla (inventario en §3).

Fede quiere que la iconografía sea más intuitiva y represente la acción concreta (petición literal, 2026-11-12: «modifica toda la iconografía de NOKKO para que sea más intuitivo y represente correctamente a la acción concreta»). **Esa petición revierte la regla «sin iconos»**: no es un retoque sobre una frase suelta de `nokko-shape`, es un cambio del sistema visual. Por eso el PRD la trata como una decisión explícita de Fede (pregunta 1) y no la da por tomada.

## 2. Para quién
Todo miembro de una organización, en escritorio y móvil. Sin distinción de rol: los iconos no cambian permisos ni datos.

## 3. Evidencia y por qué ahora
Verificado en `origin/main` @ 36b4b1b:

| Hecho | Dónde |
|---|---|
| **Los iconos se quitaron a propósito.** El 2026-10-24 el plan «Ordenar el código de NOKKO sin cambiar lo que hace» incluyó, en «Diseño fiel a Nokko Edición»: «Quitar los iconos (la regla es «sin iconos») y poner en su lugar palabras o marcas tipográficas». Commits del 2026-10-24: `41d09e6` (el shell pierde `Brain, Home, Inbox, KanbanSquare, Menu, Users, X`), `a6868d0`, `3804ad7` y `eef339a` (se quitan `Sparkles`, `Send`, `Trash2`, `Check`, `ArrowUp/Down`, `Loader2`…). | `.lovable/plan/ordenar-el-código-de-nokko-sin-cambiar-lo-que-hace-2026-10-24.md:43-44`; `git show -s 41d09e6 a6868d0 3804ad7 eef339a` |
| **La regla está escrita en cuatro capas.** (a) La plantilla de SDD, que heredan todos los SDD: «Textos de producto en español, «tú», sin iconos, estados con palabra». (b) La instrucción del agente que implementa: «…siempre «tú», sin iconos, estados con palabra». (c) El PRD del GTM Control Tower: «R-8 … sin iconos». (d) El informe UX: «sin iconos: la plantilla de SDD de Nokko pide «sin iconos, estados con palabra»; **si Fede quiere iconos, es una decisión de diseño aparte**». Además la regla de `nokko-shape` §3 («sin iconos»), 45 archivos de `docs/sdd/` con la frase «sin iconos» y comentarios en código («No icons, «tú»»). | `docs/factory/templates/sdd.md:40`; `docs/sdd/EXECUTION.md:3`; `docs/prd/PRD-20261030-gtm-control-tower.md:174`; `docs/UX-INFORME-20261031.md:37`; `.claude/skills/nokko-shape/SKILL.md:36`; `grep -rl "sin iconos" docs/sdd \| wc -l` = 45 (p. ej. `SDD-20261025-field-actions-edit-delete-confirm.md:80`: «Acciones con palabra, sin iconos: «Editar», «Borrar», «Confirmar», «Deshacer»»; `SDD-20261031-ux-legibility-contrast.md:25`); `src/components/strategy-evidence.tsx:2`, `strategy-execute.tsx:3` |
| El menú lateral pinta solo `{n.label}` dentro de cada enlace, sin icono. Los grupos colapsables usan `+`/`−` como texto. | `src/routes/_authenticated/route.tsx:116-138` (glifo `+`/`−` en 127; `Link` del menú en 132-138) |
| La lista de menú es única y pura: 3 grupos (`daily`, `strategy`, `settings`; 6+13+5) y 24 entradas, sin ningún campo de icono. La leen el menú y la paleta. | `src/lib/nav.ts:4-58`; `src/lib/nav.test.ts:21` (comprueba que la paleta lee `NAV_GROUPS.map`) |
| La barra inferior móvil tiene 5 accesos (Inicio, Sugerencias, Leads, Pipeline, Agente), solo texto; la lista está duplicada a mano, no sale de `nav.ts`. Las 4 pestañas son `Link` (lista `tabs`); «Agente» es un `button` aparte. | `route.tsx:341-383` (componente); pestañas `345-350`; botón «Agente» `374-380` |
| La paleta ⌘K lista acciones y pantallas como texto; los tipos de registro (Cuenta, Lead, Persona, Deal) salen como texto en `CommandShortcut`. | `src/components/command-palette.tsx:70-94` |
| **Glifos de texto que hacen de icono (inventario completo, sin tests ni `ui/`).** Botones solo `×`: `deal-lines.tsx:177` (borrar línea, borrado directo), `suggestion-board.tsx:228` («Descartar»), `stage-settings.tsx:176` («Borrar {etapa}») y `accounts.assignment.tsx:216` («Quitar regla»): **cuatro**. Botones solo `↑`/`↓` («Subir»/«Bajar»): `stage-settings.tsx:174-175`, `accounts.assignment.tsx:214-215`. Botón solo `→`: enviar del agente (`agent.tsx:245`, `aria-label="Enviar"`). Menú móvil `☰`/`✕` (`route.tsx:186-193`, con `aria-label` «Abrir menú»/«Cerrar menú»); rail colapsado `›` (`route.tsx:212-224`); botón visible `‹ Plegar` (`route.tsx:96-102`) con `aria-label="Cerrar menú"`. `→` decorativos: `suggestion-board.tsx:160,188`, `suggestions.tsx:196`, `flow-strip.tsx:14`, `advisor.tsx:277`. `→` **dentro del nombre de un enlace que los tests comprueban**: `metrics/hints.test.tsx:58,113`, `explanation-fold-usage.test.tsx:104`. Estados `✓`/`✗`/`▲`/`▼`: `suggestion-board.tsx:206`, `home/guide-card.tsx:129`, `score.tsx:45`, `setup/ai-fill.tsx:344`, `payback-card.tsx:146`. Leyenda de teclado «← descartar · ↑ más tarde · → hacer · Z deshacer»: `swipe-deck.tsx:117`. | Búsqueda: `grep -rnE '[✕☰›‹→←×✓✗↑↓▲▼]' src --include=*.tsx` filtrando tests, comentarios y `components/ui/`; el script del gate (`.factory/evidence/NK-0168/prd-gate-pass1-glyphs.mjs`, local, no versionado) da 22 líneas |
| `lucide-react` (`^0.575.0`) ya está instalado y se usa en 18 archivos, **todos dentro de `src/components/ui/`** (shadcn): `ChevronRight`, `ChevronDown`, `Check`, `Circle`, `X`, `Search`, `Minus`, `MoreHorizontal`, `PanelLeft`, `GripVertical`, flechas. Lo usan para sus propios conceptos: `X` = cerrar en `dialog.tsx` y `sheet.tsx`; `Check` = marcado en `checkbox.tsx` y `select.tsx`; `Search` en `command.tsx`; `Minus` en `input-otp.tsx`. Ninguna pantalla ni componente de producto los usa. Desde 0.575, `Icon` pone `aria-hidden="true"` por defecto si el icono no recibe props de accesibilidad ni hijos. | `package.json:69`; `grep -rl 'from "lucide-react"' src` (18); `node_modules/lucide-react/dist/esm/Icon.js:33` |
| `Button` ya dimensiona cualquier `svg` hijo a `size-4` y no lo hace interactivo. Los botones `sm` miden 36 px en móvil y 28 px desde `md`; `icon`, 40/36 px. El botón del menú móvil sí mide 44 px (`size-11`). | `src/components/ui/button.tsx:8`, `:24-26`; `route.tsx:189` |
| Marcas: `Brace`, `Lockup`, `Isotipo`; «No redibujar». | `src/components/brand.tsx:1-3` (exporta `Brace` `:12`, `Lockup` `:22`, `Isotipo` `:36`) |
| Sistema de diseño: tokens en `src/styles.css` (p. ej. `--ink-faint` `#646a74` en claro y `#8b919c` en oscuro; tema oscuro con `.dark`); reglas: sin colores hardcodeados, 375 px sin scroll horizontal. | `src/styles.css:124`, `:186-195`; `AGENTS.md` |
| Las pruebas existentes localizan botones por su nombre accesible (p. ej. `"+ Nuevo"`, `"+ Nuevo deal"`, `"Importar de Drive"`, `"Descartar"`, `"Reintentar"`). Los 9 archivos de test afectados o citados (`nav`, `hub-screen`, `new-deal`, `session-consumers`, `deals-tab`, `strategy-screens`, `theory-u-screen`, `plays/view`, `hub-search`) pasan en `36b4b1b`: 160 tests. | `hub-screen.test.tsx`, `new-deal.test.tsx`, `session-consumers.test.tsx`, `deals-tab.test.tsx`, `strategy-screens.test.tsx`, `theory-u-screen.test.tsx`; informe del gate de la pasada 1 |

**Datos de uso: sin dato.** No se ha mirado qué pantallas se encuentran peor ni cuánto se usa la paleta; la prioridad es una apuesta declarada. **Por qué ahora:** el menú ya tiene 24 entradas; fijar la familia y la regla de un icono por concepto es más barato antes de que cada pantalla nueva elija su propio glifo (apuesta, sin dato de uso). Y la regla actual obliga a que cada SDD nuevo repita «sin iconos»: mientras no se decida, cada SDD del producto la sigue heredando.

## 4. Objetivos
Ninguno depende de una línea base de uso: son invariantes verificables por prueba, más una medida de peso. No se inventa ninguna métrica de usabilidad.

| ID | Objetivo | Cómo se mide | Línea base | Fuente |
|---|---|---|---|---|
| G-1 | Las 24 entradas de `nav.ts` tienen icono, visible junto a su etiqueta en menú lateral, cajón móvil, barra inferior (las que estén) y paleta ⌘K | Invariante: prueba que recorre `NAV` y exige concepto en el registro | 0 de 24 (hoy ninguna) | `src/lib/nav.ts`; prueba nueva |
| G-2 | Un concepto = un icono, y un icono = un concepto, en toda la app **de producto** | Tres invariantes. (a) **Unicidad por identidad del componente**, no por nombre: la prueba del registro compara los componentes importados por referencia (`House` y `Home`, `Funnel` y `Filter` son el mismo componente con dos nombres y cuentan como uno) y falla si dos conceptos comparten componente o un concepto tiene dos. (b) **Guarda de importación**: ningún archivo de producto importa de `lucide-react` (ni de sus subrutas) fuera del registro y de `src/components/ui/`; falla ante, por ejemplo, un `Trash2` importado directo en una pantalla. (c) **Decisión sobre `src/components/ui/`** (ver §6): se excluye de (a), con su lista de conceptos estructurales escrita. | Hoy: sin registro, sin guarda, 0 imports de lucide fuera de `ui/` | Pruebas nuevas; `grep -rl 'from "lucide-react"' src` |
| G-3 | Un icono nunca va solo: siempre acompaña a su etiqueta visible, salvo las excepciones listadas en el SDD. Incluye los botones que hoy son solo glifo (reordenar `↑`/`↓`, borrar/quitar `×`, enviar `→`): pasan a tener texto visible | Invariante: prueba que falla si un botón de producto contiene solo un icono sin etiqueta visible y no está en la lista de excepciones | Hoy hay 4 botones solo `×`, 4 solo `↑`/`↓`, 1 solo `→`, el `☰`/`✕` móvil y el `›` del rail, todos con `aria-label` (§3) | `route.tsx`, `agent.tsx`, `deal-lines.tsx`, `suggestion-board.tsx`, `stage-settings.tsx`, `accounts.assignment.tsx` |
| G-4 | Accesibilidad intacta: icono decorativo `aria-hidden`; el nombre accesible de cada control no cambia salvo lo decidido en §6 | Invariante: las pruebas existentes por `getByRole(..., { name })` siguen en verde; prueba nueva de `aria-hidden` (el comportamiento por defecto de lucide 0.575 ayuda, pero la prueba lo mantiene) | 160 tests en verde en 9 archivos en `36b4b1b` | Suite `vitest` |
| G-5 | Sin color hardcodeado: los iconos heredan `currentColor` y solo se tiñen con tokens | Invariante: prueba que falla ante hex, `rgb(`, `hsl(`, `oklch(`, `text-[#…]`, `fill=`/`stroke=` con valor literal y la prop `color=` de lucide, en el registro y sus componentes | Sin dato | Prueba nueva |
| G-6 | Peso de bundle conocido: importación individual, sin dependencia nueva | Delta gzip de `vite build` antes/después, informado en cada SDD. **Referencia, no tope:** el gate midió +10 439 B en crudo y +3 752 B gzip con los 46 iconos únicos propuestos importados uno a uno y pintados en el shell (166 chunks en los dos casos); no incluye el código del registro ni del componente. El tope, si lo hay, lo decide Fede tras medir el SDD 1 | 833 338 B gzip en total (base de la medida del gate) | `.factory/evidence/NK-0168/prd-gate-pass1-measure-*.log` (local, no versionado); `vite build` en el SDD |
| G-7 | Móvil a 375 px sin scroll horizontal con iconos en barra inferior y cajón, y sin truncar etiquetas ni contador | Comprobación en walkthrough (`nokko-walkthrough`), claro y oscuro | Sin render. Cálculo con métricas de DM Sans: ver §7 «Barra inferior» | Capturas del walkthrough |
| G-8 | (Usabilidad) saber si los iconos ayudan a encontrar antes | **[Por decidir]**: ver §7 «Medida de usabilidad» | Sin dato | — |

## 5. No-objetivos
- Un set de iconos propio o dibujado a medida. Se usa lucide tal cual.
- Cambiar el logo, `Brace`, `Lockup` o `Isotipo` (`brand.tsx` no se toca).
- Ilustraciones, estados vacíos ilustrados, emojis.
- Cambiar textos de producto (i18n de etiquetas) más allá de lo que decida §6.
- Cambiar rutas, permisos, datos, esquema o RLS.
- Rediseñar tokens, tipografía o layout. **Lo que SÍ cambia es el sistema de diseño en un punto: la regla «sin iconos» de Nokko Edición se revoca (si Fede lo decide) y pasa a ser «icono siempre con etiqueta, uno por concepto»; «estados con palabra» se mantiene.** Las reglas escritas (plantilla de SDD, `EXECUTION.md`, skill `nokko-shape`) cambian con el SDD 1.
- Que un icono sustituya a la etiqueta (ver pregunta abierta 3 para las excepciones actuales).
- Reescribir los SDD ya aprobados: quedan como históricos con su «sin iconos».
- Aplicar a Postin: NOKKO y Postin son productos separados.

## 6. Decisiones tomadas y abiertas
Propuesta del coordinador, aceptada por Fede como alcance del SDD (2026-11-12):

| Tema | Decisión | Quién y cuándo |
|---|---|---|
| Regla «sin iconos» del sistema visual | **Abierta, decide Fede (pregunta 1).** Su petición la contradice; hace falta un «sí, la revoco» explícito. Sin él no hay SDD | Fede |
| Familia | lucide (`lucide-react`, ya instalado) | Fede, 2026-11-12 |
| Etiqueta | El icono va SIEMPRE con su texto; nunca solo icono (no significa que toda acción lleve icono) | Fede, 2026-11-12 |
| Consistencia | UN icono por concepto en toda la app (mismo icono para «Cuentas» en menú, ⌘K y cabeceras) | Fede, 2026-11-12 |
| Orden | Primero navegación (grupos diario/estrategia/ajustes y barra inferior) y acciones repetidas; después estados y panel del agente | Fede, 2026-11-12 |
| Registro | Un único registro en código (concepto → icono) con prueba que impide dos iconos por concepto y un icono para dos conceptos, comparando por identidad del componente (G-2) | Propuesta; el SDD lo detalla |
| Importación | Individual (`import { X } from "lucide-react"`), sin `import *` ni cargador dinámico; solo desde el registro y `ui/` (guarda de G-2) | Propuesta |
| `src/components/ui/` | **Propuesta:** queda fuera del registro y de la unicidad. Sus iconos son estructurales del control, no conceptos de producto: `X` cerrar contenedor (`dialog`, `sheet`), `Check` marcado (`checkbox`, `select`), `Search` (`command`), `Minus` (`input-otp`), chevrons, `Circle`, `GripVertical`, `MoreHorizontal`, `PanelLeft`. Su lista se escribe en el SDD 1 y la guarda de importación la fija: un icono nuevo en `ui/` cambia la lista y se ve en la revisión. Choques a asumir: `Check` (marcado) y `Check` (Confirmar) son el mismo dibujo con dos significados, y `X` de cerrar y `X` de Cancelar coinciden; se acepta porque son estructurales, y el SDD 1 lo escribe | Propuesta; Fede decide en el SDD 1 |
| Tamaño y trazo del icono | Abierta (pregunta 2) | — |
| Rail colapsado y botón «‹ Plegar» | Abierta (pregunta 3) | — |
| Prefijo «+» de «+ Nuevo…» | Abierta (pregunta 4) | — |
| Glifos de texto existentes (`→`, `×`, `↑`, `↓`, `✕`, `☰`, `‹`, `›`, `✓`, `✗`, `▲`, `▼`, `+`/`−`) | Se sustituyen por iconos del registro cuando entre su SDD. Los botones solo glifo de reordenar y borrar (`↑`/`↓`/`×`) ganan texto visible («Subir», «Bajar», «Borrar», «Quitar regla»): lo asigna el SDD 2 (§8) | Propuesta |
| Consecuencia y símbolo | Un icono de acción que pierde datos nunca comparte dibujo con uno inocuo (pregunta 5) | Abierta |
| Barra inferior: contador de Sugerencias | Propuesta: el contador va sobre el icono (badge), no junto a la etiqueta (§7) | Propuesta; el SDD 1 la ajusta con capturas |

### Inventario 1: las 24 entradas de `src/lib/nav.ts` (propuesta)
**Nombres verificados el 2026-11-13 contra `lucide-react` 0.575.0 instalado (gate, pasada 1): existen los 50 nombres propuestos (25 de navegación incluido `Bot` y 25 de acciones; 46 únicos).** Siete son alias de otro nombre y apuntan al mismo componente: `House`=`Home`, `Funnel`=`Filter`, `UserRound`=`User2`, `ChartColumn`=`BarChart3`, `CircleCheck`=`CheckCircle2`, `CircleMinus`=`MinusCircle`, `SendHorizontal`=`SendHorizonal`. Se mantiene la lista; los alias van marcados con ‡. El registro importa un solo nombre por componente (el SDD 1 fija cuál) y G-2 compara por identidad.

| Grupo | Ruta · etiqueta | Icono lucide propuesto | Motivo |
|---|---|---|---|
| diario | `/home` · Inicio | `House` ‡ | Convención universal de «inicio». |
| diario | `/inbox` · Sugerencias | `Lightbulb` | Son sugerencias; la ruta se llama `inbox` pero la etiqueta no es «bandeja». Evita `Inbox`, que sugeriría correo. |
| diario | `/accounts` · Cuentas | `Building2` | Empresas cliente. |
| diario | `/leads` · Leads | `Funnel` ‡ | Entrada de prospectos. **Choque:** `Funnel` es el dibujo universal de «filtrar» (alias de `Filter`); gastarlo en «Leads» deja sin dibujo a cualquier filtro futuro. Ambiguo también con Pipeline. |
| diario | `/deals` · Pipeline | `Kanban` | La pantalla es un tablero por etapas; distingue de Leads. |
| diario | `/people` · Personas | `UserRound` ‡ | Persona individual; el plural «Equipo» usa otro. |
| estrategia | `/strategy` · Estrategia GTM | `Target` | **Choque:** «Marcar como objetivo» (`quick-actions.tsx:174`) también propone `Target`; ver Inventario 2. |
| estrategia | `/metrics` · Métricas | `ChartColumn` ‡ | Gráficos de CAC, payback, funnel. |
| estrategia | `/cycle` · Ciclo GTM | `Repeat` | Ciclo recurrente. Evita `RefreshCw`, que queda para «Actualizar». |
| estrategia | `/plays` · Plays GTM | `Workflow` | Jugadas y equipos de plays encadenados. |
| estrategia | `/debates` · Debates | `MessagesSquare` | Conversación entre posturas. |
| estrategia | `/theory-u` · Theory U | `Spline` | **Ambiguo:** no hay metáfora clara de «Theory U»; se propone una curva en U. Decide Fede o el SDD. |
| estrategia | `/advisor` · Asesor GTM (solo líderes) | `Compass` | Orientación y consejo. |
| estrategia | `/abm` · ABM y partners | `Handshake` | Cuentas objetivo y partners. |
| estrategia | `/products` · Productos | `Package` | Catálogo de productos. |
| estrategia | `/hub` · Conocimiento | `BookOpen` | Documentos, reglas y voz. |
| estrategia | `/memory` · Memoria | `Brain` | Lo que el agente recuerda. |
| estrategia | `/discoveries` · Descubiertos | `Telescope` | Empresas halladas por búsqueda ICP. |
| estrategia | `/approvals` · Aprobaciones | `ClipboardCheck` | Cola de cosas por aprobar. **Choque:** una versión anterior de este PRD ofrecía también `ClipboardCheck` para «Aprobar» (acción); una pantalla y una acción no pueden compartir dibujo, así que «Aprobar» usa `CircleCheck` (Inventario 2). Distinto de `Check` (confirmar una acción). |
| ajustes | `/company` · Empresa | `BriefcaseBusiness` | La propia empresa, distinta de «Cuentas» (`Building2`). |
| ajustes | `/team` · Equipo | `Users` | Miembros. |
| ajustes | `/integrations` · Conexiones | `Plug` | Integraciones externas. **Choque:** «Conectar» (acción) también usa `Plug`. |
| ajustes | `/setup` · Configuración | `Settings` | Convención universal. |
| ajustes | `/connect` · Conectar asistentes | `Cable` | Conectar asistentes externos por MCP; ambiguo con Conexiones (`Plug`). |

**Barra inferior móvil** (`route.tsx:345-350` y `374-380`): Inicio `House`, Sugerencias `Lightbulb` (con el contador actual), Leads `Funnel`, Pipeline `Kanban`, Agente `Bot` (concepto «agente», ver abajo). Sale de los mismos conceptos que el menú, no de una lista aparte.
**Paleta ⌘K** (`command-palette.tsx`): pantallas con el icono de su entrada de menú; tipos de registro con el icono del concepto (Cuenta `Building2`, Lead `Funnel`, Persona `UserRound`, Deal `Kanban`); acciones: Abrir/Preguntar al agente `Bot`, «Añadir o importar leads» (ver Inventario 2), «Buscar empresas por ICP» `Search`.

### Inventario 2: etiquetas de acción repetidas (primera pasada, **aproximada**)
**Método reproducible.** Por etiqueta, desde la raíz del repo en `origin/main` @ 051ef2c: líneas = `grep -rn -F -- "<etiqueta>" src | wc -l`; archivos = `grep -rl -F -- "<etiqueta>" src | wc -l`. Es **subcadena, sensible a mayúsculas, sobre todo `src/`**: incluye tests, comentarios, textos de ayuda, `aria-label` y etiquetas compuestas. «Importar» incluye «Importar de Drive». No distingue botón de texto. Sirve para priorizar, no es un censo exacto; el SDD 2 afina cada fila con lectura de código.

Escala de **consecuencia** (la usa la pregunta 5): **Pierde** = tira datos o cambios sin vuelta; **Reversible** = deshacer (p. ej. 24 h) o cambio de estado recuperable; **Sin efecto** = no hace nada (cerrar, cancelar, seguir editando); **[Por verificar]** = no se ha comprobado en código.

| Etiqueta | Ejemplo `archivo:línea` | Líneas (archivos) | Icono propuesto | Consecuencia y ambigüedad |
|---|---|---|---|---|
| Guardar | `theory-u/prototypes.tsx:253` | 73 (48) | `Save` | No ambiguo |
| Confirmar | `assistant-actions.tsx:36` | 14 (12) | `Check` | **Sí**: «Confirmar», «Aceptar» (`suggestion-board.tsx:169`) y «Aprobar» (`import-review.tsx:72`) son tres palabras para afirmar; ¿un concepto o tres? |
| Aceptar | `suggestion-board.tsx:169` | 32 (9) | `Check` | Ver «Confirmar». |
| Aprobar / Aprobar para uso externo | `import-review.tsx:72`, `strategy/positioning.tsx:294` | 25 (18) | `CircleCheck` ‡ | **Sí**: aprobar un lote ≠ aprobar para uso externo ≠ confirmar un campo. **No** `ClipboardCheck`: es el icono de «Aprobaciones» (menú). |
| Descartar (diálogo de cambios sin guardar) | `confirm-dialog.tsx:209` (`askUnsaved`: botones `save \| discard \| stay`, `:41-49,78-83`) | (dentro de «Descartar») | **No `X`**; propuesta `Eraser` | **Pierde**: es el botón que **tira los cambios sin guardar**. El que no hace nada es «stay» («Seguir editando», `:198-203`). |
| Descartar (otros usos) | `leads/lead-qualification.tsx:147` (descalificar un lead), `import-review.tsx:73` (lote), `suggestion-board.tsx:175,225`, `suggestions.tsx:227,255`, `agent.tsx:231`, `discoveries.tsx:239`… | 47 (28) en total | `Ban` para «descalificar o rechazar» | **Sí**: varios significados con una palabra. Consecuencia **[Por verificar]** por uso: descalificar un lead y descartar una sugerencia parecen cambios de estado, pero no se ha comprobado que se puedan deshacer. |
| Cancelar | `assistant-actions.tsx:37` | 26 (21) | `X` | **Sin efecto**: cancelar el diálogo no cambia nada. |
| Cerrar | `route.tsx:98,186` (menú), diálogos | 34 (18) | `X` | **Sin efecto.** Comparte `X` con Cancelar solo porque ambos son «no hacer nada»; coincide además con el `X` de `ui/dialog.tsx` (§6). |
| Quitar | `quick-actions.tsx:174` («Quitar de objetivo»), `clay.tsx:361` («Quitar selección»), `accounts.assignment.tsx:216` («Quitar regla») | 22 (17) | `Minus` o `CircleMinus` ‡ | **Sí**: quitar de una lista no es borrar. Consecuencia **[Por verificar]** por uso. |
| Borrar (piezas de estrategia: segmento, ICP, pilar) | `src/lib/delete-rules.ts:20-22,37-60`; `src/components/delete-element.tsx:58` | 52 (20) en total | `Trash2` | **Reversible**: «Borrar» y «Archivar» son la **misma operación**, con «Deshacer» durante 24 h; la etiqueta cambia según si algo depende de la pieza (`delete-rules.ts:21`: «same operation, undo for 24 hours»). Un solo concepto, no dos. |
| Archivar | `delete-rules.ts:21,57,60`; `delete-element.tsx:58` («archivado»); `company.tsx:113` («Archivar empresa») | 14 (6) | `Archive` o `Trash2` (uno solo para Borrar y Archivar de piezas) | **Reversible** en las piezas de estrategia. «Archivar empresa» (`company.tsx:58`, «Desaparece del selector…») es otro objeto: consecuencia **[Por verificar]**. El SDD 2 elige un solo icono para la operación «Borrar o archivar con deshacer 24 h». |
| Borrar (borrado directo) | `deal-lines.tsx:172-177` (solo `×`, `delete` directo a base de datos), `stage-settings.tsx:176` (solo `×`), `metrics/finance-panel.tsx:368-370,523` (con confirmación) | (dentro de las 52) | `Trash2` | **Pierde** en `deal-lines.tsx`; en `stage-settings.tsx` y `finance-panel.tsx` **[Por verificar]** si hay deshacer. **Un icono que pierde datos no comparte dibujo con ningún icono inocuo.** |
| Eliminar | `hub/doc-editor.tsx:110`; `strategy/motions.tsx:653,741-744` («Eliminar segmento», `aria-label="Eliminar {segmento}"`) | 4 (2) | `Trash2` | **Sí**: «Borrar», «Eliminar» y «Archivar» son tres palabras para retirar. Consecuencia **[Por verificar]**; el SDD 2 decide si es un concepto o más. |
| Editar | `onboarding/blocks.tsx:130` | 13 (10) | `Pencil` | No ambiguo |
| Añadir | `clay.tsx:226` es el `aria-label` de un combobox («Añadir país»), **no una acción**; el SDD 2 usa un botón real | 65 (31) | `Plus` | No ambiguo |
| + Nuevo / + Nuevo deal / + Nuevo lead / + Nuevo recorrido | **Cinco botones:** `hub/hub-screen.tsx:403`, `new-deal.tsx:114`, `account/calls-deals-tabs.tsx:116`, `leads/lead-dialogs.tsx:55`, `theory-u/journey.tsx:92`. **Cuatro textos que citan «+ Nuevo…»:** `hub-screen.tsx:474`, `calls-deals-tabs.tsx:119`, `leads.index.tsx:295`, `lib/hub-search.ts:32` (lo comprueba `hub-search.test.ts:108,111`) | 5 botones + 4 textos | `Plus` | **Sí**: el «+» ya está en el texto; ver pregunta 4. «Añadir» y «Nuevo» ¿mismo concepto? **Cuatro** archivos de test usan «+ Nuevo…» como nombre de botón (`hub-screen`, `new-deal`, `session-consumers`, `deals-tab`) y un quinto (`hub-search.test.ts`) comprueba el texto de ayuda si se cambia la etiqueta. |
| Importar de Drive | `drive.tsx:291` | 11 (3) | `HardDriveDownload` o `Download` | **Sí**: el icono de Google Drive no existe en lucide; un icono genérico de descarga lo confunde con «Descargar/Exportar» (0 coincidencias hoy). |
| Importar | varios | 25 (13) | `Upload` o `FileInput` | **Sí**: «importar» no es «subir un archivo» siempre. |
| Buscar | `route.tsx:176-181` | 79 (32) | `Search` | No ambiguo (ya existe en `ui/command.tsx`, estructural). |
| Reintentar | `data-state.tsx`, `theory-u-screen.test.tsx:135` | 50 (12) | `RotateCw` | **Sí**: choca con «Actualizar» (`RefreshCw`). |
| Actualizar | `drive.tsx:462`, `drive-overview.tsx:68`, `parallel.tsx:162` | 26 (13) | `RefreshCw` | **Sí** (ver Reintentar): volver a cargar ≠ reintentar tras error. |
| Deshacer | `onboarding/blocks.tsx:152`, `import-review.tsx:76` | 32 (18) | `Undo2` | No ambiguo |
| Copiar / Copiar de {trimestre} | `mcp-connect.tsx:17`, `cac-panel.tsx:313` | 7 (6) | `Copy` | **Sí**: copiar al portapapeles ≠ copiar datos de un trimestre. |
| Conectar | varios | 20 (13) | `Plug` | **Sí**: comparte `Plug` con el menú «Conexiones» (choque en Inventario 1). |
| Desconectar | `posthog-panel.tsx:181`, `stripe-panel.tsx:143` | 2 (2) | `Unplug` | Consecuencia **[Por verificar]**. Es el opuesto de «Conectar». |
| Rechazar | `abm.tsx:482` (decidir una sugerencia ABM), `cookie-banner.tsx:57` (cookies) | 2 (2) | `Ban` o ninguno | **Sí**: dos conceptos distintos con una palabra. |
| Invitar | `team.tsx:169` es un título (`<h3>`), **no una acción**; el SDD 2 localiza el botón real | 3 (2) | `UserPlus` | No ambiguo |
| Enviar | `agent.tsx:245` (hoy `→`) | 3 (3) | `SendHorizontal` ‡ | No ambiguo |
| Abrir (el agente, el menú) | `route.tsx:187`, `agent.tsx` | 33 (19) | Sin icono propio: el icono es el del objeto abierto | **Sí**: «Abrir» es un verbo genérico. |
| Marcar como objetivo | `quick-actions.tsx:174` | 4 (4) | `Crosshair` | **Sí**: `Target` está propuesto para «Estrategia GTM»; aquí se usa `Crosshair`. |
| Preguntar al agente / Agente | `command-palette.tsx:82-83`, barra inferior | — | `Bot` | **Sí**: la IA «mágica» (rellenar con IA, `setup/ai-fill.tsx`) pide otro icono distinto del agente. |

Sin coincidencias para «Descargar», «Exportar», «Compartir» y «Restaurar»: no entran en la primera pasada. Para «Duplicar» hay una (1).

## 7. Riesgos y dependencias
- **Ruido visual en una interfaz tipográfica y limpia.** 24 iconos en el menú más iconos en cada botón pueden recargar lo que hoy es sobrio. Mitigación: tamaño y trazo únicos (pregunta 2), color `currentColor` o tinta apagada, y empezar solo por navegación y acciones repetidas, no por todo.
- **Significado inconsistente o engañoso.** Varias etiquetas mezclan conceptos (Descartar, Quitar, Aprobar, Aceptar, Confirmar, Actualizar vs Reintentar). Si se resuelve mal, el registro bloquea (dos conceptos, un icono) o confunde (un concepto, dos iconos). El riesgo mayor: que una acción que pierde datos comparta dibujo con una inocua (p. ej. tirar cambios sin guardar con la `X` de cerrar). Mitigación: la pregunta 5 y decidir los ambiguos del Inventario 2 en el SDD 2 antes de dibujar.
- **Crecimiento del bundle.** Cada icono importado suma peso. Referencia medida por el gate (no es un tope): +3 752 B gzip con los 46 iconos únicos, sin contar registro ni componente. Mitigación: importación individual, medir el delta con `vite build` en cada SDD, sin dependencia nueva.
- **Romper pruebas por nombre accesible.** Si el icono o el «+» entran en el nombre del botón, fallan las pruebas que buscan `"+ Nuevo"` y similares (4 archivos de test usan `"+ Nuevo…"`; un quinto, `hub-search.test.ts`, comprueba el texto de ayuda). También hay nombres de enlace con `→` dentro que las pruebas comprueban (`metrics/hints.test.tsx:58,113`, `explanation-fold-usage.test.tsx:104`). Mitigación: icono `aria-hidden` y cambio de etiqueta solo si Fede lo decide (pregunta 4); el SDD que sustituya un `→` de enlace actualiza esas pruebas a propósito.
- **Barra inferior a 375 px.** Las celdas son `flex-1` sin padding: 75 px cada una (`route.tsx:351-352`). El icono va **encima** de la etiqueta (`flex-col`), así que no resta anchura; la altura calculada (6 + 20 + 2 + 15 = 43 px) cabe en los 58 px útiles de `h-[3.75rem]` con su borde. **El problema real ya existe hoy:** «Sugerencias» (67,8 px; 71,1 px en semibold) cabe, pero «Sugerencias 9+» ocupa unos 86-90 px y **ya se trunca** en el `span.truncate` (`route.tsx:364-369`). Es un **cálculo con las métricas reales de DM Sans 400/600 (sin kerning), no un render**: el gate no tuvo navegador. Propuesta para el SDD 1: poner el contador sobre el icono, como badge. El walkthrough lo confirma (G-7).
- **Objetivos táctiles.** `Button sm` mide 36 px móvil y 28 px desde `md` (`button.tsx:24`); un icono no los agranda. El requisito de 44 px se aplica a los controles de navegación nuevos; los botones `sm` existentes no entran en este PRD **[Por decidir si se corrige]** (fuera de alcance salvo que Fede lo pida).
- **La regla «sin iconos» está en muchos sitios y revocarla cuesta.** Si Fede la revoca (pregunta 1), el SDD 1 tiene que actualizar la plantilla de SDD (`docs/factory/templates/sdd.md:40`), `docs/sdd/EXECUTION.md:3` y la regla de `nokko-shape` (`.claude/skills/nokko-shape/SKILL.md:36`) y cualquier plantilla que la herede; si no, el agente implementador seguiría recibiendo «sin iconos» en su instrucción y revertiría el trabajo. Los 45 SDD que la citan quedan como históricos. Los comentarios en código (`strategy-evidence.tsx:2`, `strategy-execute.tsx:3`) se revisan al tocar esos archivos.
- **Accesibilidad de `‹ Plegar`.** El botón visible dice «‹ Plegar» pero su `aria-label` es «Cerrar menú» (`route.tsx:96-102`): el nombre accesible no contiene el texto visible (WCAG 2.5.3, «etiqueta en el nombre»). G-4 conservaría ese desajuste. Hay que decidirlo al sustituir el glifo (pregunta 3).
- **Dependencias:** ninguna de código ni de datos. Toca los mismos archivos que otros trabajos de UI en curso (`route.tsx`, `nav.ts`, `command-palette.tsx`); coordinar con lo que esté abierto **[Por verificar]** en el ledger antes de lanzar el SDD 1.
- **Medida de usabilidad (G-8) [Por decidir].** Medirla exigiría que la app registre eventos que hoy **[Por verificar]** no registra: por ejemplo, desde qué superficie se abre cada pantalla (menú, barra inferior o ⌘K) y cuánto tarda un usuario nuevo en llegar a ella en su primera sesión. Sin esos datos no hay línea base y no se afirma ninguna mejora. Alternativa sin instrumentar: revisión cualitativa con pruebas de uso a mano; no cuantificable.

## 8. Orden de entrega
| # | SDD | Tipo | Depende de | Cubre |
|---|---|---|---|---|
| 1 | `SDD-…-icon-registry-and-navigation`: **actualizar las reglas escritas** (plantilla de SDD, `EXECUTION.md`, skill `nokko-shape` y sus plantillas), registro concepto → icono, componente de icono, pruebas de unicidad por identidad, **guarda de importación de `lucide-react`**, `aria-hidden`, sin color, sin icono suelto, iconos en menú lateral, cajón móvil y barra inferior (que pasa a leer de `nav.ts`, con el contador sobre el icono), lista escrita de iconos de `ui/`, medida de bundle | Feature | Pregunta 1 de §9 respondida | G-1, G-2, G-3, G-4, G-5, G-6, G-7 |
| 2 | `SDD-…-icons-repeated-actions`: resolver los ambiguos del Inventario 2 (por consecuencia, pregunta 5) y aplicar el registro a las acciones repetidas (confirmar, descartar, editar, quitar, borrar/archivar, nuevo, importar de Drive, buscar, reintentar…), sustituyendo glifos de texto. **Incluye la regla «los botones que hoy son solo icono (reordenar `↑`/`↓`, borrar/quitar `×`, enviar `→`) pasan a tener texto visible»** y la decisión sobre `‹ Plegar` | Mejora | 1 | G-2, G-3, G-4, G-5, G-6 |
| 3 | `SDD-…-icons-states-agent-palette`: estados (carga, error, vacío, éxito; `✓`/`✗`/`▲`/`▼`), panel del agente y tipos de registro/acciones de ⌘K | Mejora | 1 (y 2 para los verbos) | G-2, G-3, G-4, G-7 |

Cada SDD mide el delta de bundle acumulado. El SDD 1 es el único que fija la línea base de G-6 y G-7.

## 9. Preguntas abiertas para Fede (con recomendación)
1. **Decisión de diseño: ¿revocas la regla «sin iconos» del sistema visual?** (antes pregunta 5; es la única que bloquea). El 2026-10-24 se quitaron los iconos a propósito (§3: commits `41d09e6`, `a6868d0`, `3804ad7`, `eef339a`; plan de Lovable «Quitar los iconos (la regla es «sin iconos»)»), la regla está en la plantilla de SDD, en `EXECUTION.md`, en el PRD del GTM Control Tower (R-8), en `nokko-shape` y en 45 SDD, y el informe UX dice que querer iconos es «una decisión de diseño aparte». Tu petición del 2026-11-12 la revierte. **Esta pregunta es esa decisión.** Consecuencia si respondes «sí»: el SDD 1 actualiza la plantilla de SDD, `EXECUTION.md` y el skill `nokko-shape` con sus plantillas (nueva regla propuesta: «icono siempre con su etiqueta, un icono por concepto, estados con palabra») y deja los SDD vivos como históricos; **§5 sí cambia el sistema de diseño**. Si respondes «no», la iniciativa se cierra o se reduce a lo que cabe sin iconos (p. ej. solo sustituir glifos de texto sueltos por palabras). Recomendación: sí, revocarla conscientemente, manteniendo «estados con palabra» y «nunca icono solo». Sin tu respuesta no se redacta ningún SDD.
2. **Tamaño y trazo.** ¿Un solo tamaño (16 px en botones, 20 px en navegación) y trazo 1.75? Recomendación: sí, 16 px en botones (ya es `size-4` en `button.tsx:8`), 20 px en menú y barra inferior, trazo por defecto de lucide o 1.75, todo en una constante del registro. Es el valor que menos ruido añade; los números exactos se afinan en el SDD 1 con capturas.
3. **Rail colapsado (`route.tsx:212-224`) y «‹ Plegar» (`route.tsx:96-102`).** Hoy el rail no tiene entradas de menú: solo Isotipo, `›` y el tema. Mostrar iconos de navegación ahí sería **icon-only con tooltip y rompería «el icono nunca va solo»**, y los glifos `›`, `→` y `×` ya son solo-glifo con `aria-label`. Recomendación: no añadir navegación al rail en esta iniciativa; mantener la regla estricta para los controles nuevos y registrar los solo-glifo actuales como excepciones listadas (con `aria-label`), que el SDD 2 sustituirá por icono + texto visible o por icono del registro con nombre accesible. Si quieres un rail con iconos, es una excepción explícita a la regla y va en un PRD aparte. Además: el botón «‹ Plegar» tiene `aria-label` «Cerrar menú»; recomendación: que su nombre accesible pase a «Plegar menú» (contiene el texto visible) al sustituir el glifo `‹` por un icono. Es un cambio de nombre accesible que G-4 permite porque está decidido aquí.
4. **Prefijo «+» en «+ Nuevo…».** Cambiar a icono `Plus` altera el nombre accesible y rompe pruebas (4 archivos de test, más `hub-search.test.ts` si cambian los 4 textos de ayuda). Recomendación: mantener la etiqueta exacta («+ Nuevo») y no poner icono en esos botones, porque el «+» ya cumple esa función. Es una excepción a «todo botón de acción lleva icono» (que no es una regla acordada), **no** a «el icono nunca va solo» (ahí no hay icono). Se documenta. Alternativa: cambiar a «Nuevo» + `Plus` y actualizar las pruebas y los 4 textos.
5. **Símbolo por consecuencia.** ¿Confirmar, Aceptar y Aprobar son un concepto o tres? ¿Borrar, Archivar y Eliminar son uno? Recomendación, separando por lo que pasa y no por la palabra: (a) **Pierde datos sin vuelta** (tirar cambios sin guardar con «Descartar» de `askUnsaved`, borrado directo como `deal-lines.tsx:172-177`): iconos propios (`Eraser` para tirar cambios, `Trash2` para borrar), **nunca** `X`. (b) **Reversible** (borrar/archivar piezas de estrategia con deshacer 24 h; descalificar o descartar si se confirma que se puede deshacer): un solo icono para «Borrar» y «Archivar» de piezas (misma operación) y `Ban` para descalificar/rechazar. (c) **Sin efecto** (Cancelar, Cerrar, «Seguir editando»): `X` y solo ellos. Regla: un icono de (a) no se comparte con ninguno de (b) ni (c), y `X` queda reservado para «no hacer nada». Confirmar un campo, aceptar y aprobar quedan como tres conceptos solo si la acción tiene consecuencias distintas (confirmar un campo ≠ aprobar para uso externo). Fede decide al aprobar el SDD 2.
6. **Theory U y Conectar asistentes.** No hay metáfora clara. Recomendación: aceptar `Spline` y `Cable` y revisar tras verlos.

## 10. Lo que NO se afirma
- **No se afirma que los iconos mejoren la usabilidad.** No hay dato de uso, ni línea base, ni medida declarada. G-1 a G-7 prueban que la iconografía es consistente y accesible, no que ayude a encontrar antes.
- **No se afirma el peso final del bundle.** Solo hay una referencia medida por el gate (+10 439 B crudo, +3 752 B gzip con 46 iconos importados uno a uno, sin registro ni componente); no es un tope y el peso real lo mide el SDD 1.
- **No se afirma la anchura real de la barra inferior a 375 px.** El 86-90 px de «Sugerencias 9+» es un cálculo con métricas de fuente, no un render; lo confirma el walkthrough.
- **No se afirma que los nombres lucide vayan a seguir existiendo tras actualizar `lucide-react`.** Los 50 propuestos existen en 0.575.0 (7 son alias, marcados con ‡); la prueba del SDD 1 debe importar cada uno.
- **No se afirma el recuento exacto de etiquetas.** El Inventario 2 es una primera pasada por subcadena sobre todo `src/` (incluye tests y textos de ayuda), con falsos positivos y sin cubrir etiquetas dinámicas o compuestas. El método está escrito y se puede repetir.
- **No se afirma qué acciones se pueden deshacer** salvo las de `delete-rules.ts` (24 h): el resto va como **[Por verificar]**.
- **No se afirma que las pruebas actuales estén en verde en `main` hoy:** el gate las pasó en `36b4b1b` (9 archivos, 160 tests) y no se han repetido en `051ef2c`.
- **No se ha leído** cada pantalla ni cada componente: la cobertura del inventario de acciones es de `grep`, no de lectura completa; los estados y el panel del agente (SDD 3) no se han inventariado.
- **No se ha comprobado** si la app registra hoy eventos de navegación (G-8).

## 11. Aprobación
- [ ] Fede aprueba el PRD (primer GO de dirección) y resuelve o delega las preguntas de §9, empezando por la 1 (revocar «sin iconos»). Fecha: {…}
- Al aprobar, el Estado pasa a «Aprobado». Después se redactan los SDD con `nokko-shape`.

## 12. Registro del gate
| Pasada | Resultado | Informe | Estado |
|---|---|---|---|
| 1 | FAIL: 0 BLOCKER, 3 MAJOR, 8 MINOR | `.factory/evidence/NK-0168/prd-gate-pass1.md` (local, no versionado) | Corregido en 6f9c273 |
| 2 | Pendiente | — | — |

pasada 1 FAIL → corregido en 6f9c273; pasada 2 pendiente.
