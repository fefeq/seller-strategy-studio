# SDD-20261109-new-deal-source · [Mejora] Nuevo deal: pedir el origen al crear (Pipeline, cuenta, create_deal)

**Tipo:** Mejora (sin cambio de esquema) · **Prioridad propuesta:** Media (sin ella, todo deal nuevo nace «Sin origen» y el win rate por origen se vacía)
**Estado:** Hecho — PR #121 (268a2d3) · Aprobado por coordinador por delegación de Fede ("ok a todo", 2026-11-09), gate pasadas 1 y 2 · **Pide:** Fede (Sprint 4) · **Aprueba:** Fede · **Fecha:** 2026-11-09
**Ticket:** NK-0123
**PRD:** No aplica (mejora acotada) · **Depende de:** `SDD-20261109-deals-no-source.md` (Hecho, Sprint 3: `src/lib/deal-source.ts`, `src/components/deal-source-field.tsx`, migración `0083`) · **Coordina con:** —

> Nivel elegido: SDD corto. El ledger lo marca `feature`, pero es una mejora acotada de tres formularios que ya existen y reutiliza un campo hecho; un PRD no cambiaría el resultado (no hay objetivo de negocio nuevo que fijar). Si Fede quiere PRD, solo añadiría el objetivo «% de deals nuevos con origen», que hoy es «sin dato».
> Números de línea comprobados en `main` `d3eeba1`.

## 1. Resumen
Los tres caminos que crean un deal a mano («+ Nuevo deal» de Pipeline, «+ Nuevo deal» de la ficha de cuenta y la herramienta `create_deal` del agente y MCP) no envían `source`, así que el deal nace sin origen aunque la persona lo sepa. Este SDD añade el campo «Fuente» (el mismo `DealSourceField`, por defecto «Sin origen») a los dos formularios y un `source` opcional a `create_deal`, validado contra los seis valores de `deal-source.ts`. Los tres caminos envían `source` siempre de forma explícita (`null` para «Sin origen»), nunca `outbound` por defecto.

## 2. Problema y para quién
Owner y Sales Leader leen el win rate por origen en Métricas y en el Asesor. Desde el Sprint 3 un deal sin origen cuenta como «Sin origen» (correcto), pero no hay forma de ponerlo al crearlo: hay que abrir el detalle después. Quien crea deals (AE, SDR, el agente) no lo hace, y el grupo «Sin origen» crece.

## 3. Evidencia y por qué ahora
**Quién crea deals sin `source` hoy:**
- Pipeline, `src/components/new-deal.tsx:70-82`: arma `args` (nombre, cuenta, segmento, etapa, importe, producto, cierre) y llama a `applySetupItems` con `create_deal`; ni el estado `f` (`:40-48`) ni el formulario (`:106-154`) tienen origen.
- Ficha de cuenta, pestaña Deals, `src/components/account/calls-deals-tabs.tsx:92-103`: botón de un clic que inserta `{ account_id, name: "Nuevo deal", stage, owner_id }` con el cliente del navegador, sin formulario y sin `source`.
- `create_deal`, `src/lib/agent/tools/core-write.ts:55-142`: el esquema (`:60-76`) no tiene `source`; `run` hace `insert({ ...deal, … })` (`:109-116`). Como el objeto zod no es estricto, un `source` que mande hoy el agente se descarta sin aviso (`src/lib/agent/tools.ts:68`, `tool.input.parse`).
- El mismo `create_deal` lo usan el agente in-app, Telegram, MCP (`src/lib/mcp/tools/agent-tools.ts:140`, esquema generado del registro) y el asistente de configuración (`src/components/setup/wizard.tsx:141`).

**Lo que ya existe y se reutiliza:**
- `src/lib/deal-source.ts:12-19` `DEAL_SOURCE_LABELS` (los seis valores), `:28-32` `dealSourceOptions`.
- `src/components/deal-source-field.tsx:5-19` `DealSourceField`: `null` ↔ «Sin origen», nunca envía `""`. Lo usa el detalle, `src/routes/_authenticated/deals.tsx:557-558`, con la etiqueta «Fuente».
- Título MCP: `TITLES.create_deal = "Crear deal"` (`src/lib/mcp/tools/agent-tools.ts:55`); el manifiesto tiene `create_deal` en `.lovable/mcp/manifest.json:483` sin `source`.

**Valor por defecto vivo:** la `0083` (quita `default 'outbound'`) está integrada en `main` (`drizzle/migrations/meta/_journal.json:583`), pero `SDD-20261109-deals-no-source.md` §18 dice «NO aplicada a ninguna base viva». **[Por verificar]** si hoy la base viva ya no tiene el valor por defecto. Mientras lo tenga, un `insert` sin `source` sigue guardando `outbound`.

**Uso real:** sin dato (no se ha medido cuántos deals se crean por cada camino ni cuántos quedan sin origen).

## 4. Resultado buscado
- Al crear un deal desde Pipeline o desde la cuenta, la persona puede elegir el origen; si no lo toca, se guarda `null` («Sin origen»).
- El agente y los asistentes externos pueden pasar el origen a `create_deal`; un valor que no sea uno de los seis se rechaza con un mensaje claro.
- Ningún camino guarda `outbound` si nadie lo eligió, con o sin la `0083` aplicada.
- Línea base: sin dato.

## 5. Alcance
**Incluye:**
- `src/lib/deal-source.ts`: exportar `DEAL_SOURCE_KEYS` (tupla `as const` con las seis claves de `DEAL_SOURCE_LABELS`, en el mismo orden) para validar con `z.enum`.
- `create_deal`: `source` opcional y anulable (`z.enum(DEAL_SOURCE_KEYS).nullable().optional()`, con `describe` construido desde `Object.entries(DEAL_SOURCE_LABELS)`, nunca escrito a mano); `insert` con `source: a.source ?? null` siempre presente; `summarize` añade «, origen {etiqueta}» cuando lo hay.
- `src/components/deal-source-field.tsx`: **única ampliación permitida**, una prop opcional `aria-label` que se pasa tal cual a `Pick` (que ya la acepta, `src/components/fields.tsx:24-44`). Los llamadores actuales (`deals.tsx:557-558`) no cambian.
- `src/components/new-deal.tsx`: campo «Fuente» (dentro de `Field label="Fuente"`) con `DealSourceField aria-label="Fuente"` (estado `source: null` al abrir y tras crear) y `source` siempre en `args` (`null` incluido, sin pasar por el filtro de `undefined`).
- `src/components/account/calls-deals-tabs.tsx` (`DealsTab`): etiqueta visible «Fuente» y `DealSourceField aria-label="Fuente"` junto al botón «+ Nuevo deal» (por defecto «Sin origen»; vuelve a «Sin origen» tras crear) y `source` en el `insert`, que conserva `owner_id` del usuario validado.
- Manifiesto MCP regenerado con `node node_modules/@lovable.dev/mcp-js/dist/cli/extract-manifest.cjs .` (nunca a mano). `TITLES.create_deal` no cambia («Crear deal»).

**No incluye** (el brief lo copia a «Movimientos prohibidos»):
- Cambios de esquema, migraciones o backfill; aplicar la `0083` en una base viva.
- Aceptar texto libre en `create_deal` (orígenes de leads como «Entrada de leads» siguen escritos solo por `leads-ingest.ts` y el disparador de `0012`).
- Pedir el origen en Ganados manuales (`src/components/won-deals-panel.tsx:342`) o en el asistente de configuración (`wizard.tsx:141`); `update_deal` tampoco gana `source`.
- Cambiar `DealSourceField` más allá de la prop opcional `aria-label`; cambiar `dealSourceOptions`, `NO_SOURCE`, `AI_NO_SOURCE` o las etiquetas.
- Convertir el botón de la cuenta en el diálogo completo de «Nuevo deal» (D-3, §15).
- Editar `.lovable/mcp/manifest.json` a mano.

## 6. Cambios de comportamiento (delta)
**Añadido:** campo «Fuente» en «Nuevo deal» (Pipeline) y junto a «+ Nuevo deal» (cuenta), con nombre accesible «Fuente»; argumento `source` en `create_deal`; `DEAL_SOURCE_KEYS`; prop opcional `aria-label` en `DealSourceField`.
**Modificado:**
- `create_deal`: `source` enviado → antes se descartaba, ahora se guarda; `source` inválido → antes se descartaba, ahora error de validación; sin `source` → antes no iba en el `insert` (dependía del valor por defecto de la base), ahora va `null`.
- «Nuevo deal» y la pestaña Deals de la cuenta: `insert` sin `source` → con `source` explícito.
- Resumen de la acción pendiente (Sugerencias): añade el origen si lo hay.
**Eliminado:** nada.

## 7. Historias y criterios de aceptación
### H-1: Como AE o Sales Leader, quiero elegir el origen al crear un deal, para que cuente en el win rate por origen sin tener que editarlo después.
- **CA-1** (herramienta, guarda) `executeTool(ctx, "create_deal", { name, account_id, source: "inbound" })` inserta en `deals` un payload con `source: "inbound"`; con `source: null` y sin `source`, el payload tiene la clave `source` con valor `null` (no ausente). `expectScoped(log)` pasa. · prueba: `src/lib/agent-tools.test.ts` (nuevo `describe("create_deal source")`; falla hoy: zod descarta `source` y el payload no tiene la clave)
- **CA-2** (herramienta, valida) `source: "outbound "`, `"Sin origen"`, `"—"` o `"Entrada de leads"` hacen fallar `create_deal` sin escribir nada (`writes(log)` vacío). · prueba: mismo archivo (falla hoy: se aceptan y se descartan)
- **CA-3** (resumen) `summarizeAction("create_deal", { name: "Acme", source: "partner" })` contiene «origen Partner»; sin `source` no menciona el origen. · prueba: mismo archivo (falla hoy)
- **CA-4** (MCP, contenido) En `.lovable/mcp/manifest.json`, `create_deal.inputSchema.properties.source` existe y su `enum` (o `anyOf` con `null`) contiene exactamente las seis claves de `DEAL_SOURCE_KEYS`; su `description` es igual a la `description` de `source` en el registro (`create_deal.input.shape.source`), así que no hay texto escrito a mano en un solo sitio; `title` sigue «Crear deal»; `source` no está en `required`. · prueba: `src/lib/agent-tools.test.ts` (junto a los casos de manifiesto de `:1302` y `:1336`; falla hoy: no hay `source`)
- **CA-4b** (MCP, sale del extractor) Ejecutar `node node_modules/@lovable.dev/mcp-js/dist/cli/extract-manifest.cjs .` sobre el árbol entregado no deja diff en `.lovable/mcp/manifest.json` (`git diff --exit-code -- .lovable/mcp/manifest.json`). · prueba: comando del gate (`--extra`) sobre el commit final; no es un test unitario (falla en cuanto el registro tenga `source` y el manifiesto no se haya regenerado)
- **CA-5** (Pipeline) Con `useServerFn` (`@tanstack/react-start`), el cliente de Supabase, `useStages` (`@/components/stage-settings`), `useProducts` (`@/components/deal-lines`), `useCurrency` (`@/hooks/use-me`) y `EntityCombobox` simulados (precedente de mocks de `useServerFn` y Supabase: `src/components/strategy-screens.test.tsx`), abrir «Nuevo deal», escribir el nombre y pulsar «Crear deal» envía `items[0].args.source === null`; elegir «Inbound» en `getByRole("combobox", { name: "Fuente" })` antes envía `"inbound"`; tras crear y reabrir, ese campo vuelve a «Sin origen». · prueba: `src/components/new-deal.test.tsx` (nuevo; falla hoy: no hay campo «Fuente» y `args` no tiene `source`)
- **CA-6** (cuenta) `DealsTab` con `supabase.from("deals").insert` y `validatedUser` simulados: se ve la etiqueta «Fuente» y `getByRole("combobox", { name: "Fuente" })`; pulsar «+ Nuevo deal» sin tocarlo inserta `source: null`; con «Evento» elegido inserta `source: "event"`; en ambos casos el `insert` sigue llevando `owner_id` igual al id del usuario validado (`calls-deals-tabs.tsx:93-94`); tras crear, el campo vuelve a «Sin origen». · prueba: `src/components/account/deals-tab.test.tsx` (nuevo; falla hoy: no hay campo y el `insert` no tiene `source`)
- **CA-7** (regla, sin regresión) `DEAL_SOURCE_KEYS` tiene las mismas claves y orden que `Object.keys(DEAL_SOURCE_LABELS)`; la `description` de `source` en `create_deal` contiene cada clave y su etiqueta de `DEAL_SOURCE_LABELS`. · prueba: `src/lib/deal-source.test.ts` (claves; falla hoy: no existe la exportación) y `src/lib/agent-tools.test.ts` (descripción; falla hoy: no hay `source`)
- **CA-8** (nombre accesible) `DealSourceField` con `aria-label="Fuente"` se encuentra con `getByRole("combobox", { name: "Fuente" })`; sin la prop, su comportamiento actual no cambia (los tres casos existentes siguen pasando sin tocarlos). · prueba: `src/components/deal-source-field.test.tsx` (nuevo caso; falla hoy: la prop no se pasa a `Pick`)

## 8. Casos límite y errores
- **Sin tocar el campo:** se guarda `null`, nunca `outbound` ni `""` (CA-1, CA-5, CA-6).
- **Base viva con `default 'outbound'` todavía:** como los tres caminos envían `source: null` explícito, el valor por defecto no se aplica. Solo Ganados manuales (`won-deals-panel.tsx:342`), fuera de alcance, sigue dependiendo de él. El asistente (`wizard.tsx:141`) pasa por `create_deal` y queda en `null`.
- **Valor inválido desde el agente o MCP:** error de zod; `applySetupItems` lo pasa por `errorText` y la acción pendiente no se crea. [Por verificar en walkthrough] el texto que ve la persona en el chat del agente.
- **Texto libre:** `create_deal` no lo acepta (D-2); los formularios solo ofrecen «Sin origen» y los seis, porque `dealSourceOptions(null)` no añade más.
- **Otra empresa:** sin cambios; `create_deal` sigue con `org_id` explícito y la pestaña de cuenta con RLS.

## 9. Experiencia y copy
- Etiqueta del campo: «Fuente», igual que el detalle del deal (`deals.tsx:557`). Opciones las de `dealSourceOptions`: «Sin origen», «Outbound», «Inbound», «Partner», «Producto (PLG)», «Evento», «Referido».
- Nombre accesible: en los dos sitios nuevos el `select` lleva `aria-label="Fuente"` (`Field` pinta un `Label` sin `htmlFor`, `fields.tsx:6-21`, así que no lo asocia). En la cuenta, además, una etiqueta visible «Fuente» junto al selector. El detalle (`deals.tsx:557`) se queda como está.
- Resumen de acción pendiente: «Crear el deal «Acme», origen Partner».
- `describe` de `source` en `create_deal` (lo lee el modelo), construido desde `Object.entries(DEAL_SOURCE_LABELS)`: «Origen del deal. Uno de: {clave (Etiqueta)}, …. Si no lo sabes, no lo pases: queda «Sin origen».»
- Sin textos nuevos de error: el de zod pasa por `errorText`.

## 10. Datos, permisos y privacidad
Sin tablas, columnas, políticas ni GRANT nuevos; `deals.source` ya es `text` anulable. Permisos sin cambios. Pruebas con datos ficticios.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| ninguna nueva | — | — | — |

Solo cambia el esquema de una herramienta que el modelo ya ve (un argumento opcional más).

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | `DEAL_SOURCE_KEYS` en `deal-source.ts`; `source` en `create_deal` (esquema, `describe` desde `DEAL_SOURCE_LABELS`, `insert` explícito, `summarize`); manifiesto regenerado con el extractor | CA-1, CA-2, CA-3, CA-4, CA-4b, CA-7 | `src/lib/deal-source.test.ts`, `src/lib/agent-tools.test.ts` |
| U-2 | Prop opcional `aria-label` en `DealSourceField` | CA-8 | `src/components/deal-source-field.test.tsx` |
| U-3 | «Fuente» en `new-deal.tsx` con `DealSourceField aria-label="Fuente"` y `source` siempre en `args` | CA-5 | `src/components/new-deal.test.tsx` |
| U-4 | Etiqueta «Fuente» y `DealSourceField aria-label="Fuente"` en `DealsTab`; `source` en el `insert` | CA-6 | `src/components/account/deals-tab.test.tsx` |

U-3 depende de U-1 (los `args` pasan por la validación de `create_deal`) y de U-2. U-4 depende de U-2.

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- `new-deal.tsx:70-81` filtra `undefined`; `source` va fuera de ese filtro (`{ ...filtered, source: f.source }`) para que `null` llegue a `create_deal`.
- `DealSourceField` ya devuelve `null` para «Sin origen»; no se toca.
- `z.enum(DEAL_SOURCE_KEYS)` necesita la tupla `as const`; `DEAL_SOURCE_LABELS` sigue siendo la fuente de las etiquetas y CA-7 vigila que no diverjan.
- Alternativa descartada: inferir el origen (p. ej. `outbound` si el deal se crea desde una cuenta sin lead). Sería estimar; la regla del proyecto lo prohíbe.

## 14. Riesgos, dependencias y walkthrough
**Riesgos:**
- El agente podría empezar a poner `outbound` por costumbre. Mitigación: el `describe` dice que, si no lo sabe, no lo pase; la acción sigue pendiente de confirmación en Sugerencias, que ahora muestra el origen (CA-3).
- Asistentes MCP con el manifiesto viejo en caché no verán `source` hasta refrescar; no rompe nada (es opcional).

**Walkthrough** (`nokko-walkthrough`, móvil y escritorio, claro y oscuro):
1. Pipeline → «+ Nuevo deal» → «Fuente» muestra «Sin origen» → crear sin tocarla → el detalle del deal muestra «Sin origen».
2. Repetir eligiendo «Inbound» → el detalle muestra «Inbound»; reabrir el diálogo → vuelve a «Sin origen».
3. Cuenta → pestaña Deals → «Fuente» junto a «+ Nuevo deal» → elegir «Evento» → crear → el detalle muestra «Evento»; el campo vuelve a «Sin origen». En móvil (por debajo de md), etiqueta, selector y botón caben sin desplazamiento lateral de la página.
4. Agente: «crea un deal Acme con origen partner» → Sugerencias muestra «origen Partner» → confirmar → el detalle muestra «Partner».
5. Agente con un origen inventado («crea un deal Acme con origen feria») → no se crea la acción o el agente pide uno válido; anotar el texto.
6. Consola y red sin errores; en la petición de `insert` de los pasos 1 y 3 el cuerpo lleva `"source":null` / `"source":"event"`.

## 15. Preguntas para Fede y para la revisión técnica
**Decisiones tomadas (autor):**
- **D-1.** Los tres caminos envían `source` explícito (`null` incluido), para no depender de si la `0083` está aplicada en la base viva.
- **D-2.** `create_deal` solo acepta las seis claves o `null`; el texto libre sigue reservado a la entrada de leads.

**Decisión del coordinador (delegación de Fede, 2026-11-09):**
- **D-3.** En la pestaña Deals de la cuenta, un selector «Fuente» junto al botón de un clic, no el diálogo completo.
- **D-4.** Etiqueta «Fuente», como el detalle del deal.
- Se permite añadir a `DealSourceField` una prop opcional `aria-label` (G-M1) y un CA que ejecuta el extractor y exige que no quede diff en el manifiesto (G-M2, CA-4b).

**Para Fede:**
1. ¿Se aplica ya la `0083` en la base viva? No bloquea este SDD (D-1), pero sin ella Ganados manuales sigue guardando `outbound`.

## 16. Pendiente de verificar
- [Por verificar, Fede] Valor por defecto vivo de `deals.source` (consulta de `SDD-20261109-deals-no-source.md` §10).
- [Por verificar, walkthrough] Texto que ve la persona cuando el agente manda un origen inválido (§8, paso 5).
- [Por verificar, walkthrough] Selector y botón de la cuenta en móvil sin desplazamiento lateral (paso 3).
- [Por verificar, gate] CA-4b: el extractor no deja diff en el manifiesto sobre el commit final.

**Lo que NO se afirma:**
- No se afirma cuántos deals se crean sin origen ni que este cambio los reduzca en una cifra concreta.
- No se corrigen deals ya guardados (ni `null` ni `outbound`).
- No se cubren Ganados manuales ni el asistente de configuración (este último queda en `null`, sin campo).

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Un agente `nokko-gate` con contexto fresco lee este SDD y el código, y devuelve su informe. El coordinador lo copia aquí sin editarlo. El gate no aprueba el SDD: informa; la aprobación es de Fede.
- Veredicto del gate (pasada 1, 2026-11-09, `.factory/evidence/sprint4-sdd-gate/gate-pass1.md`): CAMBIOS (0 bloqueantes, 2 mayores, 5 menores). Todas las citas de `d3eeba1` comprobadas correctas.

### §17 Gate · pasada 1: hallazgos y resolución
| Hallazgo | Resolución |
|---|---|
| **MAYOR G-M1** El selector «Fuente» no tiene nombre accesible y §5 prohibía dárselo | §5 permite una sola ampliación de `DealSourceField`: prop opcional `aria-label` pasada a `Pick`. Los dos sitios nuevos usan `aria-label="Fuente"`; la cuenta lleva además etiqueta visible «Fuente». CA-5 y CA-6 buscan `getByRole("combobox", { name: "Fuente" })`; nuevo CA-8 y U-2; §9 lo explica; el detalle no cambia. |
| **MAYOR G-M2** Ningún CA comprueba que el manifiesto sale del extractor | Nuevo CA-4b: el extractor sobre el árbol entregado no deja diff (`git diff --exit-code`), ejecutado por el gate como `--extra`. CA-4 exige que la `description` de `source` en el manifiesto coincida con la del registro. |
| **MENOR G-m1** La `description` de `source` escrita a mano | Se construye desde `Object.entries(DEAL_SOURCE_LABELS)` (§5, §9); CA-7 comprueba que contiene cada clave y su etiqueta. |
| **MENOR G-m2** Frase contradictoria en §8 | Reescrita: solo Ganados manuales (`won-deals-panel.tsx:342`) sigue dependiendo del valor por defecto; el asistente pasa por `create_deal` y queda en `null`. |
| **MENOR G-m3** Registrar las decisiones del coordinador | §15: «Decisión del coordinador (delegación de Fede, 2026-11-09)» con D-3 y D-4; retiradas como preguntas. Queda solo la de la `0083`. |
| **MENOR G-m4** «Importación CSV» no apunta a un camino real | Quitada de §5 (comprobado: los `insert` en `deals` de `main` son `won-deals-panel.tsx:342`, `calls-deals-tabs.tsx:95`, `core-write.ts:109` y `leads-ingest.ts:144`). |
| **MENOR G-m5** Ajustes de CA-5, CA-6 y walkthrough | CA-5 nombra los mocks (`useServerFn`, Supabase, `useStages`, `useProducts`, `useCurrency`, `EntityCombobox`); CA-6 exige `owner_id` del usuario validado; paso 3 del walkthrough comprueba móvil sin desplazamiento lateral. |

### §17 Gate · pasada 2 (2026-11-09, `.factory/evidence/sprint4-sdd-gate/gate-pass2.md`): hallazgos y resolución
- Veredicto: APROBABLE (0 bloqueantes, 0 mayores, 0 menores). Los siete hallazgos de la pasada 1 constan resueltos en el texto final.

| Hallazgo | Resolución |
|---|---|
| Sin hallazgos. CA-4b verificado sobre la base `d3eeba1`: el extractor termina con código 0 y no deja diff en `.lovable/mcp/manifest.json` (`extractor-base-d3eeba1.log`) | Nada que cambiar. CA-4b queda como guarda del gate (`--extra`) sobre el commit final. |

## 18. Delta de implementación (lo rellena el agente al entregar)
—
