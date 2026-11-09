# SDD-20261109-new-deal-source · [Mejora] Nuevo deal: pedir el origen al crear (Pipeline, cuenta, create_deal)

**Tipo:** Mejora (sin cambio de esquema) · **Prioridad propuesta:** Media (sin ella, todo deal nuevo nace «Sin origen» y el win rate por origen se vacía)
**Estado:** Borrador · **Pide:** Fede (Sprint 4) · **Aprueba:** Fede · **Fecha:** 2026-11-09
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
- `create_deal`: `source` opcional y anulable (`z.enum(DEAL_SOURCE_KEYS).nullable().optional()`, con `describe` que lista claves y etiquetas); `insert` con `source: a.source ?? null` siempre presente; `summarize` añade «, origen {etiqueta}» cuando lo hay.
- `src/components/new-deal.tsx`: campo «Fuente» con `DealSourceField` (estado `source: null` al abrir y tras crear) y `source` siempre en `args` (`null` incluido, sin pasar por el filtro de `undefined`).
- `src/components/account/calls-deals-tabs.tsx` (`DealsTab`): `DealSourceField` junto al botón «+ Nuevo deal» (por defecto «Sin origen»; vuelve a «Sin origen» tras crear) y `source` en el `insert`.
- Manifiesto MCP regenerado con `node node_modules/@lovable.dev/mcp-js/dist/cli/extract-manifest.cjs .` (nunca a mano). `TITLES.create_deal` no cambia («Crear deal»).

**No incluye** (el brief lo copia a «Movimientos prohibidos»):
- Cambios de esquema, migraciones o backfill; aplicar la `0083` en una base viva.
- Aceptar texto libre en `create_deal` (orígenes de leads como «Entrada de leads» siguen escritos solo por `leads-ingest.ts` y el disparador de `0012`).
- Pedir el origen en Ganados manuales (`src/components/won-deals-panel.tsx`), en el asistente de configuración (`wizard.tsx:141`) o en la importación CSV; `update_deal` tampoco gana `source`.
- Cambiar `DealSourceField`, `dealSourceOptions`, `NO_SOURCE`, `AI_NO_SOURCE` o las etiquetas.
- Convertir el botón de la cuenta en el diálogo completo de «Nuevo deal» (alternativa en §15).
- Editar `.lovable/mcp/manifest.json` a mano.

## 6. Cambios de comportamiento (delta)
**Añadido:** campo «Fuente» en «Nuevo deal» (Pipeline) y junto a «+ Nuevo deal» (cuenta); argumento `source` en `create_deal`; `DEAL_SOURCE_KEYS`.
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
- **CA-4** (MCP) En `.lovable/mcp/manifest.json`, `create_deal.inputSchema.properties.source` existe y su `enum` (o `anyOf` con `null`) contiene exactamente las seis claves de `DEAL_SOURCE_KEYS`; `title` sigue «Crear deal»; `source` no está en `required`. · prueba: `src/lib/agent-tools.test.ts` (junto a los casos de manifiesto de `:1302` y `:1336`; falla hoy: no hay `source`)
- **CA-5** (Pipeline) Con `useServerFn` y el cliente de Supabase simulados, abrir «Nuevo deal», escribir el nombre y pulsar «Crear deal» envía `items[0].args.source === null`; elegir «Inbound» en «Fuente» antes envía `"inbound"`; tras crear y reabrir, «Fuente» vuelve a «Sin origen». · prueba: `src/components/new-deal.test.tsx` (nuevo; mocks como `src/components/strategy-screens.test.tsx`; falla hoy: no hay campo y `args` no tiene `source`)
- **CA-6** (cuenta) `DealsTab` con `supabase.from("deals").insert` y `validatedUser` simulados: pulsar «+ Nuevo deal» sin tocar «Fuente» inserta `source: null`; con «Evento» elegido inserta `source: "event"`; tras crear, el campo vuelve a «Sin origen». · prueba: `src/components/account/deals-tab.test.tsx` (nuevo; falla hoy: el `insert` no tiene `source`)
- **CA-7** (regla, sin regresión) `DEAL_SOURCE_KEYS` tiene las mismas claves y orden que `Object.keys(DEAL_SOURCE_LABELS)`. · prueba: `src/lib/deal-source.test.ts` (falla hoy: no existe la exportación)

## 8. Casos límite y errores
- **Sin tocar el campo:** se guarda `null`, nunca `outbound` ni `""` (CA-1, CA-5, CA-6).
- **Base viva con `default 'outbound'` todavía:** como los tres caminos envían `source: null` explícito, el valor por defecto no se aplica. El asistente de configuración y Ganados manuales, fuera de alcance, sí dependen de él; `wizard.tsx:141` pasa por `create_deal` y también queda en `null`.
- **Valor inválido desde el agente o MCP:** error de zod; `applySetupItems` lo pasa por `errorText` y la acción pendiente no se crea. [Por verificar en walkthrough] el texto que ve la persona en el chat del agente.
- **Texto libre:** `create_deal` no lo acepta (D-2); los formularios solo ofrecen «Sin origen» y los seis, porque `dealSourceOptions(null)` no añade más.
- **Otra empresa:** sin cambios; `create_deal` sigue con `org_id` explícito y la pestaña de cuenta con RLS.

## 9. Experiencia y copy
- Etiqueta del campo: «Fuente», igual que el detalle del deal (`deals.tsx:557`). Opciones las de `dealSourceOptions`: «Sin origen», «Outbound», «Inbound», «Partner», «Producto (PLG)», «Evento», «Referido».
- Resumen de acción pendiente: «Crear el deal «Acme», origen Partner».
- `describe` de `source` en `create_deal` (lo lee el modelo): «Origen del deal. Uno de: outbound (Outbound), inbound (Inbound), …. Si no lo sabes, no lo pases: queda «Sin origen».»
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
| U-1 | `DEAL_SOURCE_KEYS` en `deal-source.ts`; `source` en `create_deal` (esquema, `insert` explícito, `summarize`); manifiesto regenerado con el extractor | CA-1, CA-2, CA-3, CA-4, CA-7 | `src/lib/deal-source.test.ts`, `src/lib/agent-tools.test.ts` |
| U-2 | «Fuente» en `new-deal.tsx` con `DealSourceField` y `source` siempre en `args` | CA-5 | `src/components/new-deal.test.tsx` |
| U-3 | «Fuente» en `DealsTab` y `source` en el `insert` | CA-6 | `src/components/account/deals-tab.test.tsx` |

U-2 depende de U-1 (los `args` pasan por la validación de `create_deal`). U-3 es independiente.

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
3. Cuenta → pestaña Deals → «Fuente» junto a «+ Nuevo deal» → elegir «Evento» → crear → el detalle muestra «Evento»; el campo vuelve a «Sin origen».
4. Agente: «crea un deal Acme con origen partner» → Sugerencias muestra «origen Partner» → confirmar → el detalle muestra «Partner».
5. Agente con un origen inventado («crea un deal Acme con origen feria») → no se crea la acción o el agente pide uno válido; anotar el texto.
6. Consola y red sin errores; en la petición de `insert` de los pasos 1 y 3 el cuerpo lleva `"source":null` / `"source":"event"`.

## 15. Preguntas para Fede y para la revisión técnica
**Decisiones tomadas (autor):**
- **D-1.** Los tres caminos envían `source` explícito (`null` incluido), para no depender de si la `0083` está aplicada en la base viva.
- **D-2.** `create_deal` solo acepta las seis claves o `null`; el texto libre sigue reservado a la entrada de leads.
- **D-3.** En la cuenta, un selector «Fuente» junto al botón de un clic, no el diálogo completo.
- **D-4.** Etiqueta «Fuente», como el detalle.

**Para Fede:**
1. ¿D-3 te vale, o prefieres que «+ Nuevo deal» de la cuenta abra el mismo diálogo de Pipeline con la cuenta ya puesta (más coherente, más cambio)?
2. ¿«Fuente» u «Origen» como etiqueta? Métricas dice «Sin origen»; el detalle dice «Fuente». Este SDD no cambia el detalle.
3. ¿Se aplica ya la `0083` en la base viva? No bloquea este SDD (D-1), pero sin ella Ganados manuales sigue guardando `outbound`.

## 16. Pendiente de verificar
- [Por verificar, Fede] Valor por defecto vivo de `deals.source` (consulta de `SDD-20261109-deals-no-source.md` §10).
- [Por verificar, walkthrough] Texto que ve la persona cuando el agente manda un origen inválido (§8, paso 5).

**Lo que NO se afirma:**
- No se afirma cuántos deals se crean sin origen ni que este cambio los reduzca en una cifra concreta.
- No se corrigen deals ya guardados (ni `null` ni `outbound`).
- No se cubren Ganados manuales, el asistente de configuración ni el CSV.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Un agente `nokko-gate` con contexto fresco lee este SDD y el código, y devuelve su informe. El coordinador lo copia aquí sin editarlo. El gate no aprueba el SDD: informa; la aprobación es de Fede.
- Veredicto del gate: No revisado
- CA sin prueba posible o sin G-n: —
- [Por verificar] que sigue sin comprobarse: —
- Contradicciones con el código o con decisiones previas: —
- Lo que esta revisión NO demuestra: —

## 18. Delta de implementación (lo rellena el agente al entregar)
—
