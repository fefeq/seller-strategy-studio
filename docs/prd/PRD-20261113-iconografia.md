# PRD-20261113-iconografia · [Iniciativa] Iconografía de NOKKO: un icono por concepto, siempre con su etiqueta

**Tipo:** Iniciativa · **Prioridad propuesta:** Media (mejora de comprensión y consistencia sin cambiar datos, esquema ni flujos; el coste es de ingeniería y de peso de bundle; no hay dato de uso que diga cuánto duele hoy, es una apuesta declarada)
**Estado:** Borrador · **Pide:** Fede (2026-11-12) · **Aprueba:** Fede · **Fecha:** 2026-11-13
**Ticket:** NK-0168 (`.factory/ledger.json`, estado LOGGED, sin SDD ni PRD enlazados)
**SDD que lo desarrollan:** pendiente (sección 8)

> Un PRD dice qué se quiere y por qué. No dice cómo se construye ni cómo se prueba: eso es del SDD.
> Hechos verificados sobre `origin/main` @ 36b4b1b, solo lectura, el 2026-11-13. Lo que no se ha podido comprobar va como **[Por verificar]**.

## 1. Problema
NOKKO es una interfaz de solo texto: el menú, la barra inferior móvil y la paleta ⌘K no tienen un solo icono, y las acciones repetidas (descartar, quitar, confirmar, importar…) se distinguen únicamente por la palabra. Donde hoy hay "iconos" son glifos de texto sueltos (`✕`, `☰`, `›`, `→`, `×`, `+`/`−`) que no siguen ninguna regla. Fede quiere que la iconografía sea más intuitiva y represente la acción concreta (petición literal: «modifica toda la iconografía de NOKKO para que sea más intuitivo y represente correctamente a la acción concreta»).

## 2. Para quién
Todo miembro de una organización, en escritorio y móvil. Sin distinción de rol: los iconos no cambian permisos ni datos.

## 3. Evidencia y por qué ahora
Verificado en `origin/main` @ 36b4b1b:

| Hecho | Dónde |
|---|---|
| El menú lateral pinta solo `{n.label}` dentro de cada enlace, sin icono. Los grupos colapsables usan `+`/`−` como texto. | `src/routes/_authenticated/route.tsx:116-137` (enlace en 128-134; glifo en 127) |
| La lista de menú es única y pura: 3 grupos (`daily`, `strategy`, `settings`) y 24 entradas, sin ningún campo de icono. La leen el menú y la paleta. | `src/lib/nav.ts:4-58`; `src/lib/nav.test.ts` (comprueba que la paleta lee `NAV_GROUPS.map`) |
| La barra inferior móvil tiene 5 accesos (Inicio, Sugerencias, Leads, Pipeline, Agente), solo texto; la lista está duplicada a mano, no sale de `nav.ts`. | `src/routes/_authenticated/route.tsx:341-373` (tabs en 346-351) |
| La paleta ⌘K lista acciones y pantallas como texto; los tipos de registro (Cuenta, Lead, Persona, Deal) salen como texto en `CommandShortcut`. | `src/components/command-palette.tsx:76-94` |
| El botón del menú móvil y el rail colapsado usan glifos de texto: `✕`/`☰` y `›`. El enviar del agente es `→` con `aria-label="Enviar"`. Hay `×` en dos sitios. | `route.tsx:191-193`, `route.tsx:212-224`, `src/components/agent.tsx:245`, `src/components/deal-lines.tsx:177`, `src/components/suggestion-board.tsx:228` |
| `lucide-react` (`^0.575.0`) ya está instalado y se usa en 18 archivos, **todos dentro de `src/components/ui/`** (shadcn): `ChevronRight`, `ChevronDown`, `Check`, `Circle`, `X`, `Search`, `Minus`, `MoreHorizontal`, `PanelLeft`, `GripVertical`, flechas. Ninguna pantalla ni componente de producto los usa. | `package.json:69`; `grep lucide-react src` |
| `Button` ya dimensiona cualquier `svg` hijo a `size-4` y no lo hace interactivo. Los botones `sm` miden 36 px en móvil y 28 px desde `md`; `icon`, 40/36 px. El botón del menú móvil sí mide 44 px (`size-11`). | `src/components/ui/button.tsx:8`, `:24-26`; `route.tsx:189` |
| Marcas: `Brace`, `Lockup`, `Isotipo`; «No redibujar». | `src/components/brand.tsx:1-3` |
| Sistema de diseño: tokens en `src/styles.css` (p. ej. `--ink-faint` `#646a74` en claro y `#8b919c` en oscuro; tema oscuro con `.dark`); reglas: sin colores hardcodeados, 375 px sin scroll horizontal. | `src/styles.css:124`, `:186-195`; `AGENTS.md` |
| Las pruebas existentes localizan botones por su nombre accesible (p. ej. `"+ Nuevo"`, `"+ Nuevo deal"`, `"Importar de Drive"`, `"Descartar"`, `"Reintentar"`). | `hub-screen.test.tsx`, `new-deal.test.tsx`, `session-consumers.test.tsx`, `deals-tab.test.tsx`, `strategy-screens.test.tsx`, `theory-u-screen.test.tsx` |

**Datos de uso: sin dato.** No se ha mirado qué pantallas se encuentran peor ni cuánto se usa la paleta; la prioridad es una apuesta declarada. **Por qué ahora:** el menú ya tiene 24 entradas; fijar la familia y la regla de un icono por concepto es más barato antes de que cada pantalla nueva elija su propio glifo (apuesta, sin dato de uso).

## 4. Objetivos
Ninguno depende de una línea base de uso: son invariantes verificables por prueba, más una medida de peso. No se inventa ninguna métrica de usabilidad.

| ID | Objetivo | Cómo se mide | Línea base | Fuente |
|---|---|---|---|---|
| G-1 | Las 24 entradas de `nav.ts` tienen icono, visible junto a su etiqueta en menú lateral, cajón móvil, barra inferior (las que estén) y paleta ⌘K | Invariante: prueba que recorre `NAV` y exige concepto en el registro | 0 de 24 (hoy ninguna) | `src/lib/nav.ts`; prueba nueva |
| G-2 | Un concepto = un icono, y un icono = un concepto, en toda la app | Invariante: prueba del registro que falla si un concepto tiene dos iconos o un icono sirve a dos conceptos | Sin registro hoy | Prueba nueva |
| G-3 | Un icono nunca va solo: siempre acompaña a su etiqueta visible, salvo las excepciones listadas en el SDD | Invariante: prueba que falla si un botón de producto contiene solo un icono sin etiqueta visible y no está en la lista de excepciones | Hoy hay botones solo-glifo (`→`, `×`, `›`, `☰`) con `aria-label` | `route.tsx`, `agent.tsx`, `deal-lines.tsx`, `suggestion-board.tsx` |
| G-4 | Accesibilidad intacta: icono decorativo `aria-hidden`; el nombre accesible de cada control no cambia salvo lo decidido en §6 | Invariante: las pruebas existentes por `getByRole(..., { name })` siguen en verde; prueba nueva de `aria-hidden` | Pruebas actuales en verde (a confirmar en el SDD) | Suite `vitest` |
| G-5 | Sin color hardcodeado: los iconos heredan `currentColor` y solo se tiñen con tokens | Invariante: prueba que falla ante hex, `rgb(` o `text-[#…]` en el registro y sus componentes | Sin dato | Prueba nueva |
| G-6 | Peso de bundle conocido y acotado: importación individual, sin dependencia nueva | Delta gzip de `vite build` antes/después, informado en el SDD. Tope: **[Por decidir]** tras medir la línea base | Sin dato (no medido) | `vite build` en el SDD |
| G-7 | Móvil a 375 px sin scroll horizontal con iconos en barra inferior y cajón | Comprobación en walkthrough (`nokko-walkthrough`), claro y oscuro | Sin dato | Capturas del walkthrough |
| G-8 | (Usabilidad) saber si los iconos ayudan a encontrar antes | **[Por decidir]**: ver §7 «Medida de usabilidad» | Sin dato | — |

## 5. No-objetivos
- Un set de iconos propio o dibujado a medida. Se usa lucide tal cual.
- Cambiar el logo, `Brace`, `Lockup` o `Isotipo` (`brand.tsx` no se toca).
- Ilustraciones, estados vacíos ilustrados, emojis.
- Cambiar textos de producto (i18n de etiquetas) más allá de lo que decida §6.
- Cambiar rutas, permisos, datos, esquema o RLS.
- Rediseñar el layout o el sistema de diseño (tokens, tipografía).
- Que un icono sustituya a la etiqueta (ver pregunta abierta 2 para las excepciones actuales).
- Aplicar a Postin: NOKKO y Postin son productos separados.

## 6. Decisiones tomadas y abiertas
Propuesta del coordinador, aceptada por Fede como alcance del SDD (2026-11-12):

| Tema | Decisión | Quién y cuándo |
|---|---|---|
| Familia | lucide (`lucide-react`, ya instalado) | Fede, 2026-11-12 |
| Etiqueta | El icono va SIEMPRE con su texto; nunca solo icono | Fede, 2026-11-12 |
| Consistencia | UN icono por concepto en toda la app (mismo icono para «Cuentas» en menú, ⌘K y cabeceras) | Fede, 2026-11-12 |
| Orden | Primero navegación (grupos diario/estrategia/ajustes y barra inferior) y acciones repetidas; después estados y panel del agente | Fede, 2026-11-12 |
| Registro | Un único registro en código (concepto → icono) con prueba que impide dos iconos por concepto y un icono para dos conceptos | Propuesta; el SDD lo detalla |
| Importación | Individual (`import { X } from "lucide-react"`), sin `import *` ni cargador dinámico | Propuesta |
| Tamaño y trazo del icono | Abierta (pregunta 1) | — |
| Rail colapsado | Abierta (pregunta 2) | — |
| Glifos de texto existentes (`→`, `×`, `✕`, `☰`, `›`, `+`/`−`) | Se sustituyen por iconos del registro cuando entre su SDD | Propuesta |
| Prefijo «+» de «+ Nuevo…» | Abierta (pregunta 3) | — |

### Inventario 1: las 24 entradas de `src/lib/nav.ts` (propuesta; nombres lucide **[Por verificar]** contra la versión instalada en el SDD 1)
| Grupo | Ruta · etiqueta | Icono lucide propuesto | Motivo |
|---|---|---|---|
| diario | `/home` · Inicio | `House` | Convención universal de «inicio». |
| diario | `/inbox` · Sugerencias | `Lightbulb` | Son sugerencias; la ruta se llama `inbox` pero la etiqueta no es «bandeja». Evita `Inbox`, que sugeriría correo. |
| diario | `/accounts` · Cuentas | `Building2` | Empresas cliente. |
| diario | `/leads` · Leads | `Funnel` | Entrada de prospectos. Ambiguo con Pipeline (ver abajo). |
| diario | `/deals` · Pipeline | `Kanban` | La pantalla es un tablero por etapas; distingue de Leads. |
| diario | `/people` · Personas | `UserRound` | Persona individual; el plural «Equipo» usa otro. |
| estrategia | `/strategy` · Estrategia GTM | `Target` | Ojo: «Marcar como objetivo» (`quick-actions.tsx:174`) es otro concepto; ver ambiguos. |
| estrategia | `/metrics` · Métricas | `ChartColumn` | Gráficos de CAC, payback, funnel. |
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
| estrategia | `/approvals` · Aprobaciones | `ClipboardCheck` | Cola de cosas por aprobar. Distinto de `Check` (confirmar una acción). |
| ajustes | `/company` · Empresa | `BriefcaseBusiness` | La propia empresa, distinta de «Cuentas» (`Building2`). |
| ajustes | `/team` · Equipo | `Users` | Miembros. |
| ajustes | `/integrations` · Conexiones | `Plug` | Integraciones externas. |
| ajustes | `/setup` · Configuración | `Settings` | Convención universal. |
| ajustes | `/connect` · Conectar asistentes | `Cable` | Conectar asistentes externos por MCP; ambiguo con Conexiones (`Plug`). |

**Barra inferior móvil** (`route.tsx:346-351`): Inicio `House`, Sugerencias `Lightbulb` (con el contador actual), Leads `Funnel`, Pipeline `Kanban`, Agente `Bot` (concepto «agente», ver abajo). Sale de los mismos conceptos que el menú, no de una lista aparte.
**Paleta ⌘K** (`command-palette.tsx`): pantallas con el icono de su entrada de menú; tipos de registro con el icono del concepto (Cuenta `Building2`, Lead `Funnel`, Persona `UserRound`, Deal `Kanban`); acciones: Abrir/Preguntar al agente `Bot`, «Añadir o importar leads» (ver Inventario 2), «Buscar empresas por ICP» `Search`.

### Inventario 2: etiquetas de acción repetidas (primera pasada, **aproximada**)
Recuento por `grep` de la etiqueta como prefijo en `src/**/*.tsx|ts`, incluidos tests y textos de ayuda; sirve para priorizar, no es un censo exacto. Un SDD afina cada fila contra el código. La columna «Ambiguo» marca decisiones de significado, no de dibujo.

| Etiqueta | Ejemplo `archivo:línea` | Coincidencias (archivos) | Icono propuesto | Ambiguo |
|---|---|---|---|---|
| Guardar | `theory-u/prototypes.tsx:253` | 51 (32) | `Save` | No |
| Confirmar | `assistant-actions.tsx:36` | 9 (8) | `Check` | **Sí**: «Confirmar», «Aceptar» (`suggestion-board.tsx:169`) y «Aprobar» (`import-review.tsx:72`) son tres palabras para afirmar; ¿un concepto o tres? |
| Aprobar / Aprobar para uso externo | `import-review.tsx:72`, `strategy/positioning.tsx:294` | 12 (10) | `CircleCheck` o `ClipboardCheck` | **Sí**: aprobar un lote ≠ aprobar para uso externo ≠ confirmar un campo. |
| Descartar | `confirm-dialog.tsx:209`, `leads/lead-qualification.tsx:147` | 27 (16) | `X` | **Sí**: en el diálogo es «no hacer nada»; en `lead-qualification` es descalificar un lead. Dos conceptos con una palabra. |
| Cancelar | `assistant-actions.tsx:37` | 10 (8) | `X` | **Sí**: comparte `X` con Descartar y con «Cerrar»; la regla un-icono-por-concepto obliga a decidir si son el mismo concepto. |
| Cerrar | `route.tsx:187` (menú), diálogos | 19 (12) | `X` | **Sí** (ver Cancelar). |
| Quitar | `quick-actions.tsx:174` («Quitar de objetivo»), `clay.tsx:361` («Quitar selección»), `accounts.assignment.tsx:216` («Quitar regla») | 16 (11) | `Minus` o `CircleMinus` | **Sí**: quitar de una lista (reversible) ≠ borrar. |
| Borrar | `metrics/finance-panel.tsx:368-370`, `stage-settings.tsx:176` | 28 (11) | `Trash2` | **Sí**: «Borrar» vs «Quitar» vs «Eliminar» (1 coincidencia); el destructivo permanente debe distinguirse. |
| Editar | `onboarding/blocks.tsx:130` | 7 (4) | `Pencil` | No |
| Añadir | `clay.tsx:226` («Añadir país») | 42 (21) | `Plus` | No |
| + Nuevo / + Nuevo deal / + Nuevo lead / + Nuevo recorrido | `hub/hub-screen.tsx:403`, `new-deal.tsx:114`, `leads/lead-dialogs.tsx:55`, `theory-u/journey.tsx:92` | 2 literales + tests | `Plus` | **Sí**: el «+» ya está en el texto; ver pregunta 3. «Añadir» y «Nuevo» ¿mismo concepto? |
| Importar de Drive | `drive.tsx:291` | 7 (2) | `HardDriveDownload` o `Download` | **Sí**: el icono de Google Drive no existe en lucide; un icono genérico de descarga lo confunde con «Descargar/Exportar» (0 coincidencias hoy). |
| Importar | varios | 19 (9) | `Upload` o `FileInput` | **Sí**: «importar» no es «subir un archivo» siempre. |
| Buscar | `route.tsx:178-181`, 53 coincidencias | 53 (23) | `Search` | No (ya existe en `ui/command.tsx`) |
| Reintentar | `data-state.tsx`, `theory-u-screen.test.tsx:135` | 28 (8) | `RotateCw` | **Sí**: choca con «Actualizar» (`RefreshCw`). |
| Actualizar | `drive.tsx:462`, `drive-overview.tsx:68`, `parallel.tsx:162` | 24 (7) | `RefreshCw` | **Sí** (ver Reintentar): volver a cargar ≠ reintentar tras error. |
| Deshacer | `onboarding/blocks.tsx:152`, `import-review.tsx:76` | 13 (9) | `Undo2` | No |
| Copiar / Copiar de {trimestre} | `mcp-connect.tsx:17`, `cac-panel.tsx:313` | 3 (3) | `Copy` | **Sí**: copiar al portapapeles ≠ copiar datos de un trimestre. |
| Conectar | varios | 19 (12) | `Plug` | **Sí**: comparte `Plug` con el menú «Conexiones». |
| Invitar | `team.tsx:169` | 2 (2) | `UserPlus` | No |
| Enviar | `agent.tsx:245` (hoy `→`) | 2 (2) | `SendHorizontal` | No |
| Abrir (el agente, el menú) | `route.tsx:187`, `agent.tsx` | 24 (14) | Sin icono propio: el icono es el del objeto abierto | **Sí**: «Abrir» es un verbo genérico. |
| Marcar como objetivo | `quick-actions.tsx:174` | 1 | `Target` o `Crosshair` | **Sí**: `Target` está propuesto para «Estrategia GTM». |
| Preguntar al agente / Agente | `command-palette.tsx:82-83`, barra inferior | — | `Bot` | **Sí**: la IA «mágica» (rellenar con IA, `setup/ai-fill.tsx`) pide otro icono distinto del agente. |

Sin coincidencias en el código leído para «Rechazar», «Descargar», «Exportar», «Desconectar»: no entran en la primera pasada.

## 7. Riesgos y dependencias
- **Ruido visual en una interfaz tipográfica y limpia.** 24 iconos en el menú más iconos en cada botón pueden recargar lo que hoy es sobrio. Mitigación: tamaño y trazo únicos (pregunta 1), color `currentColor` o tinta apagada, y empezar solo por navegación y acciones repetidas, no por todo.
- **Significado inconsistente o engañoso.** Varias etiquetas mezclan conceptos (Descartar, Quitar, Aprobar, Aceptar, Confirmar, Actualizar vs Reintentar). Si se resuelve mal, el registro bloquea (dos conceptos, un icono) o confunde (un concepto, dos iconos). Mitigación: decidir los ambiguos del Inventario 2 en el SDD 2 antes de dibujar.
- **Crecimiento del bundle.** Cada icono importado suma peso. Mitigación: importación individual, medir el delta gzip con `vite build` antes y después, sin dependencia nueva. Tope **[Por decidir]**; no se fija sin línea base.
- **Romper pruebas por nombre accesible.** Si el icono o el «+» entran en el nombre del botón, fallan las pruebas que buscan `"+ Nuevo"` y similares (4 archivos de test usan `"+ Nuevo…"`). Mitigación: icono `aria-hidden` y cambio de etiqueta solo si Fede lo decide (pregunta 3).
- **Barra inferior a 375 px.** Cinco accesos con icono y etiqueta (`text-xs`) tienen que caber sin truncar «Sugerencias». **[Por verificar]** en el walkthrough.
- **Objetivos táctiles.** `Button sm` mide 36 px móvil y 28 px desde `md` (`button.tsx:24`); un icono no los agranda. El requisito de 44 px se aplica a los controles de navegación nuevos; los botones `sm` existentes no entran en este PRD **[Por decidir si se corrige]** (fuera de alcance salvo que Fede lo pida).
- **Regla de la factory «textos de producto sin iconos».** `nokko-shape` §3 dice «Textos de producto en español, «tú», sin iconos». Se entiende como «sin emojis ni glifos en el copy», no como «sin SVG en la interfaz». **[Por decidir]** (pregunta 5).
- **Dependencias:** ninguna de código ni de datos. Toca los mismos archivos que otros trabajos de UI en curso (`route.tsx`, `nav.ts`, `command-palette.tsx`); coordinar con lo que esté abierto **[Por verificar]** en el ledger antes de lanzar el SDD 1.
- **Medida de usabilidad (G-8) [Por decidir].** Medirla exigiría que la app registre eventos que hoy **[Por verificar]** no registra: por ejemplo, desde qué superficie se abre cada pantalla (menú, barra inferior o ⌘K) y cuánto tarda un usuario nuevo en llegar a ella en su primera sesión. Sin esos datos no hay línea base y no se afirma ninguna mejora. Alternativa sin instrumentar: revisión cualitativa con pruebas de uso a mano; no cuantificable.

## 8. Orden de entrega
| # | SDD | Tipo | Depende de | Cubre |
|---|---|---|---|---|
| 1 | `SDD-…-icon-registry-and-navigation`: registro concepto → icono, componente de icono, pruebas de unicidad/aria/sin color/sin icono suelto, iconos en menú lateral, cajón móvil y barra inferior (que pasa a leer de `nav.ts`), medida de bundle | Feature | — | G-1, G-2, G-3, G-4, G-5, G-6, G-7 |
| 2 | `SDD-…-icons-repeated-actions`: resolver los ambiguos del Inventario 2 y aplicar el registro a las acciones repetidas (confirmar, descartar, editar, quitar, borrar, nuevo, importar de Drive, buscar, reintentar…), sustituyendo glifos de texto | Mejora | 1 | G-2, G-3, G-4, G-5, G-6 |
| 3 | `SDD-…-icons-states-agent-palette`: estados (carga, error, vacío, éxito), panel del agente y tipos de registro/acciones de ⌘K | Mejora | 1 (y 2 para los verbos) | G-2, G-3, G-4, G-7 |

Cada SDD mide el delta de bundle acumulado. El SDD 1 es el único que fija la línea base de G-6 y G-7.

## 9. Preguntas abiertas para Fede (con recomendación)
1. **Tamaño y trazo.** ¿Un solo tamaño (16 px en botones, 20 px en navegación) y trazo 1.75? Recomendación: sí, 16 px en botones (ya es `size-4` en `button.tsx:8`), 20 px en menú y barra inferior, trazo por defecto de lucide o 1.75, todo en una constante del registro. Es el valor que menos ruido añade; los números exactos se afinan en el SDD 1 con capturas.
2. **Rail colapsado (`route.tsx:212-224`).** Hoy el rail no tiene entradas de menú: solo Isotipo, `›` y el tema. Mostrar iconos de navegación ahí sería **icon-only con tooltip y rompería «siempre con etiqueta»**, y los glifos `›`, `→` y `×` ya son solo-glifo con `aria-label`. Recomendación: no añadir navegación al rail en esta iniciativa; mantener la regla estricta para los controles nuevos y registrar los solo-glifo actuales como excepciones listadas (con `aria-label`), que el SDD 2 sustituirá por icono + etiqueta o por icono del registro con nombre accesible. Si quieres un rail con iconos, es una excepción explícita a la regla y va en un PRD aparte.
3. **Prefijo «+» en «+ Nuevo…».** Cambiar a icono `Plus` altera el nombre accesible y rompe pruebas (4 archivos). Recomendación: mantener la etiqueta exacta («+ Nuevo») y no poner icono en esos botones, porque el «+» ya cumple esa función; es la única excepción a «icono siempre» y se documenta. Alternativa: cambiar a «Nuevo» + `Plus` y actualizar las pruebas.
4. **Conceptos ambiguos del Inventario 2.** ¿Confirmar, Aceptar y Aprobar son un concepto o tres? ¿Descartar y Quitar son uno? Recomendación: tres conceptos de «afirmar» separados solo si la acción tiene consecuencias distintas (confirmar un campo ≠ aprobar para uso externo); «Descartar», «Cancelar» y «Cerrar» comparten `X` solo si significan «no hacer nada». Fede decide al aprobar el SDD 2.
5. **Regla «sin iconos» de la factory.** ¿Se aplica a emojis/glifos en el copy y no a iconos SVG? Recomendación: sí; actualizar el texto de la regla para que no choque con este PRD.
6. **Theory U y Conectar asistentes.** No hay metáfora clara. Recomendación: aceptar `Spline` y `Cable` y revisar tras verlos.

## 10. Lo que NO se afirma
- **No se afirma que los iconos mejoren la usabilidad.** No hay dato de uso, ni línea base, ni medida declarada. G-1 a G-7 prueban que la iconografía es consistente y accesible, no que ayude a encontrar antes.
- **No se afirma el peso final del bundle.** No se ha ejecutado `vite build` ni se ha medido ningún tamaño; el tope es **[Por decidir]**.
- **No se afirma que todos los nombres lucide propuestos existan en `lucide-react@^0.575.0`.** Son propuestas **[Por verificar]**; la prueba del SDD 1 debe importar cada uno.
- **No se afirma el recuento exacto de etiquetas.** El Inventario 2 es una primera pasada con `grep` por prefijo, con falsos positivos (tests, textos de ayuda) y sin cubrir etiquetas dinámicas o compuestas.
- **No se afirma que la lista de la barra inferior vaya a quedar sin duplicados** ni que 5 accesos con etiqueta quepan a 375 px: **[Por verificar]**.
- **No se afirma que las pruebas actuales estén en verde** ni cuántas fallarían: no se ha ejecutado `vitest` en esta sesión.
- **No se ha leído** cada pantalla ni cada componente: la cobertura del inventario de acciones es de `grep`, no de lectura completa; los estados y el panel del agente (SDD 3) no se han inventariado.
- **No se ha comprobado** si la app registra hoy eventos de navegación (G-8).

## 11. Aprobación
- [ ] Fede aprueba el PRD (primer GO de dirección) y resuelve o delega las preguntas de §9. Fecha: {…}
- Al aprobar, el Estado pasa a «Aprobado». Después se redactan los SDD con `nokko-shape`.
