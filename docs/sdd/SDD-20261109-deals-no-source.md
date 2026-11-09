# SDD-20261109-deals-no-source · [Bug] Un deal sin origen se queda «Sin origen» en la base, en el formulario y en lo que lee el Asesor

**Tipo:** Bug (con migración: quita un valor por defecto) · **Prioridad propuesta:** Media (falsea el win rate por origen de Métricas y del Asesor)
**Estado:** Borrador · **Pide:** Fede (Sprint 3) · **Aprueba:** Fede · **Fecha:** 2026-11-09
**Tickets:** NK-0107 (valor por defecto `'outbound'`), NK-0108 (el formulario muestra y puede guardar «Outbound»), NK-0109 (el Asesor envía «—»)
**PRD:** No aplica (bug) · **Depende de:** — · **Coordina con:** NK-0106 (`SDD-20261109-metrics-sin-dato-rest.md`): allí «—» como texto en pantalla pasa a «Sin dato · motivo»; aquí `NO_SOURCE` («—») es una **clave de agrupación**, y `src/lib/deal-source.ts` la importa (nunca escribe el literal «—»). **Orden de integración: este SDD antes que NK-0106**, para que la lista cerrada de métricas nazca sin las claves K que este SDD elimina; no un texto, y la prueba de NK-0106 la permite.

> Nivel elegido: SDD corto. Lleva una migración (cambia el esquema de `deals`), así que según la tabla de `nokko-shape` exige SDD.
> Números de línea comprobados en `main` `1fef724`.

## 1. Resumen
Todo deal creado sin origen se guarda como `outbound` porque la columna tiene ese valor por defecto; el formulario de edición muestra «Outbound» cuando no hay origen y puede guardarlo; y el Asesor envía a la IA el grupo sin origen con la clave «—». Este SDD quita el valor por defecto (sin tocar filas existentes), añade «Sin origen» al formulario sin forzar ningún valor y hace que el Asesor diga «sin origen». Las pantallas de Métricas ya agrupan y rotulan «Sin origen»; se unifica su etiqueta en un solo módulo.

## 2. Problema y para quién
Owner y Sales Leader leen el win rate por origen en Métricas (Cohortes, Perdidos, Rendimiento) y en el Asesor. Hoy un deal creado desde «Nuevo deal», desde la ficha de cuenta o como ganado manual cuenta como Outbound aunque nadie lo eligiera, y el Asesor recibe «—» como nombre de grupo.

## 3. Evidencia y por qué ahora
**Base de datos:**
- `drizzle/migrations/0001_gtm_strategy_positioning_revops_abm.sql:84`: `alter table public.deals add column source text default 'outbound';`. Ninguna migración posterior cambia ese valor por defecto (búsqueda de `source` en `drizzle/migrations/*.sql` sobre `deals`).
- El disparador de leads a deal (`0012_lead_funnel.sql:78-79`) ya escribe `coalesce(new.source, 'Entrada de leads')`: no depende del valor por defecto.

**Quién crea deals sin `source`** (búsqueda de `from("deals")` con `insert`):
- «Nuevo deal» (`src/components/new-deal.tsx:72-82`) llama a la herramienta `create_deal` sin `source`; `create_deal` inserta `...deal` (`src/lib/agent/tools/core-write.ts:107-117`) y su esquema no tiene `source`. Igual desde el agente y MCP.
- Ficha de cuenta, pestaña Deals (`src/components/account/calls-deals-tabs.tsx:49`): inserta sin `source`.
- Ganados manuales (`src/components/won-deals-panel.tsx:332-342`): `common` sin `source`.
- Sí lo envían: `src/lib/leads-ingest.ts:152` (`lead.source ?? "Entrada de leads"`) y el disparador de 0012.

**Formulario de edición:**
- `src/routes/_authenticated/deals.tsx:556-569`: «Fuente» con `value={d.source ?? "outbound"}` y seis opciones; sin opción vacía.
- `deals.tsx:444-458`: «Guardar» envía siempre `source: d.source`. Con `source` nulo y sin tocar el campo se guarda nulo, pero la persona ve «Outbound»; si cambia otro campo del selector y vuelve, o lo toca, guarda `outbound`.
- `src/components/fields.tsx:24-44` (`Pick`): `NativeSelect` controlado; un valor que no está en las opciones (p. ej. «Entrada de leads», que escriben 0012 y `leads-ingest.ts`) no se muestra [Por verificar en navegador: qué opción pinta].

**Métricas y Asesor:**
- `src/lib/metrics-quarter.ts:21-22`: `NO_SOURCE = "—"`, «Key of a deal without source: shown as «Sin origen»»; se usa en `:85` y en `src/lib/advisor.ts:146`.
- `src/lib/revops.ts:87`: `bySource: tally((d) => d.source ?? "—")` con el literal, no con `NO_SOURCE`; `src/components/metrics/revops-panels.tsx:207` igual.
- Etiquetas duplicadas: `revops-panels.tsx:25-33` (`SOURCE`) y `src/components/metrics/performance-panels.tsx:14-22` (`SOURCE_LABEL`), las dos con `"—": "Sin origen"`.
- `src/lib/advisor.ts:106-116` y `:146`: `win_rate_por_fuente` lleva `grupo: "—"` para los deals sin origen; la IA lo recibe tal cual. `src/lib/advisor.test.ts:198-205` fija hoy `grupo: NO_SOURCE`.
- `src/lib/field-catalog.ts:141`: el catálogo declara los seis valores de `deals.source` como conjunto cerrado; la base guarda también texto libre (0012, `leads-ingest.ts`). Fuera de alcance (§5).

**Uso real:** sin dato (no se ha medido cuántos deals tienen `outbound` puesto por defecto).

## 4. Resultado buscado
- Un deal nuevo creado sin origen queda con `source` nulo y aparece como «Sin origen» en Métricas y en el formulario.
- Editar un deal nunca cambia su origen si la persona no lo cambia.
- El Asesor recibe «sin origen» como nombre de grupo.
- Línea base: sin dato.

## 5. Alcance
**Incluye:**
- Migración `drizzle/migrations/0083_deals_source_no_default.sql` (número provisional, §13) + entrada en `meta/_journal.json` + prueba PGlite.
- Módulo puro `src/lib/deal-source.ts` (con test): `DEAL_SOURCE_LABELS` (los seis de hoy), `NO_SOURCE` (importado y re-exportado desde `metrics-quarter.ts`; el módulo nunca escribe el literal «—»), `dealSourceLabel(key)` y `dealSourceOptions(current)`.
- `deals.tsx` (campo «Fuente»), `revops-panels.tsx` y `performance-panels.tsx` (etiquetas desde el módulo), `revops.ts:87` y `revops-panels.tsx:207` (usar `NO_SOURCE`), `advisor.ts:146` (etiqueta para la IA) y su test.

**No incluye** (el brief lo copia a «Movimientos prohibidos»):
- Reescribir filas existentes: un `outbound` puesto por defecto no se distingue de uno elegido (§8).
- Añadir el campo «Fuente» a «Nuevo deal», a la pestaña de la cuenta o a `create_deal`.
- Normalizar el texto libre de `deals.source` («Entrada de leads», orígenes de leads) ni cambiar `field-catalog.ts`.
- Cambiar la clave `NO_SOURCE` («—») o la de segmento sin asignar (`revops.ts:86`, `revops-panels.tsx:41`).
- Los «—» de pantalla que significan falta de dato (NK-0106).

## 6. Cambios de comportamiento (delta)
**Añadido:** opción «Sin origen» en «Fuente»; `src/lib/deal-source.ts`.
**Modificado:**
- `deals.source` por defecto: `'outbound'` → sin valor por defecto (nulo).
- «Fuente» con origen nulo: muestra «Outbound» → muestra «Sin origen»; con un texto que no es de los seis: no se ve → se ve tal cual como opción propia.
- Elegir «Sin origen» guarda `null` (nunca la cadena vacía).
- `win_rate_por_fuente` del Asesor: `grupo: "—"` → `grupo: "sin origen"`.
- Etiquetas de origen en Cohortes y Rendimiento: dos mapas → `dealSourceLabel`.
**Eliminado:** el valor por defecto `'outbound'`.

## 7. Historias y criterios de aceptación
### H-1: Como Owner o Sales Leader, quiero que un deal sin origen se vea y cuente como «Sin origen», para leer el win rate por origen sin un Outbound inventado.
- **CA-1** (base) El test crea `deals` con `source text default 'outbound'` y, **antes** de aplicar `0083`, comprueba que un `insert` sin `source` deja `outbound` (control: así el fallo en la base es de comportamiento, no de archivo ausente). Con `0083` aplicada, un `insert` sin `source` deja `source` nulo; con `source = 'inbound'` lo guarda; ninguna fila existente cambia (huella antes/después); aplicarla dos veces no falla. El disparador de 0012 queda fuera de esta prueba: la migración no toca la función y `coalesce(new.source, 'Entrada de leads')` no depende del valor por defecto. · prueba: `src/lib/deals-source-default.pg.test.ts` (nuevo; falla hoy en la aserción posterior a la migración: el `insert` deja `outbound`)
- **CA-2** (vuelta atrás) El guion comentado de `0083` devuelve `default 'outbound'` y la prueba lo ejecuta en la misma base. · prueba: mismo archivo
- **CA-3** (regla pura) `dealSourceLabel(null)` y `dealSourceLabel(NO_SOURCE)` = «Sin origen»; `dealSourceLabel("plg")` = «Producto (PLG)»; un texto desconocido se devuelve tal cual. `dealSourceOptions(null)` empieza por `{ "": "Sin origen" }` seguido de los seis; `dealSourceOptions("Entrada de leads")` añade esa opción con su texto; nunca devuelve una opción `outbound` elegida por defecto. · prueba: `src/lib/deal-source.test.ts` (nuevo; el módulo no existe)
- **CA-4a** (campo) `DealSourceField` con valor `null` muestra «Sin origen»; elegir «Inbound» llama a `onChange("inbound")`; volver a «Sin origen» llama a `onChange(null)`, nunca con `""`; con `"Entrada de leads"` muestra ese texto como opción propia y seleccionada. · prueba: `src/components/deal-source-field.test.tsx` (nuevo; `deals.tsx` no tiene prueba, así que el campo se extrae a `src/components/deal-source-field.tsx` y `deals.tsx:556-569` lo usa; falla hoy: el componente no existe)
- **CA-4b** (guardar) Lo que envía «Guardar» (`save()` de `deals.tsx:444-458`) no se prueba con un test unitario: «Guardar sin tocar Fuente envía `null`» ya pasa hoy y no fallaría primero. Lo comprueba el walkthrough (§16): deal sin origen → Guardar sin tocar «Fuente» → sigue nulo; elegir «Inbound» → guarda `inbound`; volver a «Sin origen» → guarda `null`; deal con «Entrada de leads» → Guardar lo conserva.
- **CA-5** (Asesor) `buildSnapshot` (`src/lib/advisor.ts:79`) agrupa los deals sin origen en `grupo: AI_NO_SOURCE` (`"sin origen"`) y nunca en `"—"` ni en `outbound`. Un deal con `source = "sin origen"` escrito a mano cae en el mismo grupo (límite aceptado, §8) y un caso lo fija. · prueba: `src/lib/advisor.test.ts`: cambian la aserción de `:200-201` y el título del `it` de `:198` («counts them under the same key /metrics uses…» → «groups them as «sin origen» for the AI, never as outbound»); la aserción de `outbound` (`:206-211`) y la comparación del resto del snapshot (`:215-216`) no se tocan (falla hoy)
- **CA-6** (Métricas, sin regresión) Cohortes por origen y Rendimiento siguen mostrando «Sin origen» para la clave `NO_SOURCE`; `revops.ts` agrupa con `NO_SOURCE` (no con un literal). · prueba: `src/lib/revops.test.ts` (añade el caso de origen nulo con `NO_SOURCE`) y `src/lib/metrics-quarter.test.ts` (guarda)

## 8. Casos límite y errores
- **Deals ya guardados con `outbound` por defecto:** se quedan como `outbound`. No hay forma de saber cuáles lo eligió una persona (la columna no tiene marca de origen y `deals_audit` [Por verificar si guarda el valor inicial] no se lee aquí). Se dice en la entrega; si Fede quiere revisarlos, es otra decisión (§15).
- **Texto libre en `source`:** se muestra y se guarda tal cual; no se normaliza.
- **Cadena vacía:** el formulario nunca envía `""`; «Sin origen» es `null`.
- **Texto libre «sin origen»:** un deal cuyo `source` escrito a mano sea literalmente «sin origen» se suma en el Asesor al grupo de los nulos. Límite aceptado (caso improbable; un caso de CA-5 fija el comportamiento).
- **IA:** «sin origen» en minúscula, como el resto de valores que lee el modelo (`origen`, `forecast`); no cambia el esquema JSON de la respuesta.
- **Otra empresa:** sin cambios (solo se quita un valor por defecto).

## 9. Experiencia y copy
- Opción del selector: «Sin origen» (misma palabra que Cohortes y Rendimiento).
- Sin textos nuevos más allá de esa opción.

## 10. Datos, permisos y privacidad
**Migración (`0084`):**
```sql
alter table public.deals alter column source drop default;
-- rollback: alter table public.deals alter column source set default 'outbound';
```
Sin columnas, políticas ni GRANT nuevos; no reescribe filas.
**Comprobación previa en la base viva** (solo lectura, la ejecuta Fede): `select column_default from information_schema.columns where table_schema = 'public' and table_name = 'deals' and column_name = 'source';` → `'outbound'::text`. Si sale otra cosa, se para y se vuelve a este SDD. Opcional, solo recuento: `select count(*) filter (where source = 'outbound'), count(*) filter (where source is null) from deals;` para anotar el punto de partida.
**Comprobación posterior:** la misma consulta → `null`.
**Privacidad:** pruebas con datos ficticios.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| Asesor GTM (existente, sin cambios de modelo) | sin cambios | sin cambios | sin dato |

Solo cambia un valor del snapshot (`grupo`), no la llamada.

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | `0083_deals_source_no_default.sql` + journal (`when` mayor que el de `0082`, U-2 de NK-0070) + prueba .pg (crea `deals` como `money-notices.pg.test.ts:55-58`, con `source text default 'outbound'`; sin el disparador de 0012) | CA-1, CA-2 | `src/lib/deals-source-default.pg.test.ts` |
| U-2 | `src/lib/deal-source.ts` + uso en `revops-panels.tsx`, `performance-panels.tsx`, `revops.ts:87`, `revops-panels.tsx:207` | CA-3, CA-6 | `src/lib/deal-source.test.ts` |
| U-3 | Campo «Fuente» extraído a `src/components/deal-source-field.tsx` con `dealSourceOptions` y `null` para «Sin origen»; `deals.tsx:556-569` lo usa | CA-4a (CA-4b en el walkthrough) | `src/components/deal-source-field.test.tsx` |
| U-4 | `advisor.ts:146` con la constante `AI_NO_SOURCE = "sin origen"` de `deal-source.ts` | CA-5 | `src/lib/advisor.test.ts` |

U-1 es independiente del resto. U-3 y U-4 usan U-2.

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- **Numeración:** `main` termina en `0081` (`when` 1794225600000). En el Sprint 3 solo hay dos migraciones: `0082` = NK-0070 (U-2 de `SDD-20261109-rls-price-suggestions-and-notices.md`; su U-1 está aplazada y no reserva número) y aquí `0083` (`when` mayor que el de `0082`, p. ej. 1794398400000). Se fija al integrar; lo comprueba `src/lib/migrations-journal.test.ts`.
- **Sin backfill (decisión D-1):** cualquier criterio para «adivinar» qué `outbound` vino del valor por defecto (fecha de creación, `created_by`, ausencia de lead) sería una estimación; la regla del proyecto lo prohíbe.
- **Clave vs. texto:** `NO_SOURCE` se queda «—» porque es la clave con la que agrupan `metrics-quarter.ts`, `revops.ts` y las pantallas; lo que cambia es dónde se traduce a texto. La prueba de NK-0106 debe permitir `NO_SOURCE` y las claves de agrupación, y no el «—» pintado. Su lista cerrada es un **techo** (máximo por fragmento), así que las entradas K que este SDD elimina (`revops-panels.tsx:32`, `performance-panels.tsx:21`, el literal de `revops.ts:87` y de `revops-panels.tsx:207`) no la rompen. `src/lib/deal-source.ts` no escribe el literal «—». Se integra antes que NK-0106.
- **Asesor:** cambiar la clave a «sin origen» solo en el snapshot del Asesor, no en `metrics-quarter.ts`, para no tocar Métricas.

## 14. Riesgos y dependencias
- **Otros escritores que contaban con el valor por defecto:** los tres de §3 pasan a guardar nulo, que es lo buscado. [Por verificar] que no hay escritor fuera del repo (funciones SQL vivas no versionadas) que dependa de él: lo revisa el gate en `docs/BASE-DE-DATOS.md` y la 0080.
- **Integraciones externas** que leen `deals.source` (MCP, CSV): verán nulos donde antes había `outbound`. Es la verdad; se dice en la entrega.
- **NK-0106:** toca `revops-panels.tsx` y `performance-panels.tsx` (otras líneas). Quien integre segundo resuelve; contrato: este SDD solo cambia los mapas de etiquetas y `:207`.

## 15. Preguntas para Fede y para la revisión técnica
**Decisiones tomadas (autor):**
- **D-1.** Sin backfill: los `outbound` existentes se quedan (no se distinguen los puestos por defecto).
- **D-2.** «Sin origen» se guarda como `null`, nunca como texto.
- **D-3.** El Asesor recibe «sin origen»; Métricas mantiene la clave «—» y su etiqueta «Sin origen».
- **D-4.** No se añade «Fuente» a «Nuevo deal» en este ticket.

**Decisión del coordinador (delegación de Fede, 2026-11-09):** pedir el origen en «Nuevo deal» es un ticket aparte (D-4 confirmada). Este SDD se integra antes que NK-0106.

**Para Fede:** ninguna.

## 16. Pendiente de verificar
- [Por verificar] Valor por defecto vivo de `deals.source` (§10).
- [Por verificar] Qué pinta `Pick` en el navegador con un valor que no está en las opciones (CA-4a lo fija en la prueba del campo).
- [Por verificar, walkthrough] CA-4b: lo que guarda «Guardar» en el detalle de un deal (sin origen, «Inbound», vuelta a «Sin origen», «Entrada de leads»).

**Lo que NO se afirma:**
- No se corrigen los `outbound` ya guardados ni se afirma cuántos son.
- No se normalizan los orígenes de texto libre.
- No se cambia ninguna otra métrica de Métricas.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Un agente `nokko-gate` con contexto fresco lee este SDD y el código, y devuelve su informe. El coordinador lo copia aquí sin editarlo. El gate no aprueba el SDD: informa; la aprobación es de Fede.
- Veredicto del gate (pasada 1, 2026-11-09, `.factory/evidence/sprint3-sdd-gate/gate-pass1.md`): CAMBIOS (0 bloqueantes, 1 mayor, 5 menores).

### §17 Gate · pasada 1: hallazgos y resolución
| Hallazgo | Resolución |
|---|---|
| **MAYOR D-M1** CA-4 no se puede probar con `deal-source-field.test.tsx` (el `update` vive en `save()`) y «Guardar sin tocar» ya pasa hoy | CA-4 partido: CA-4a (campo: `onChange("inbound")`, `onChange(null)` nunca `""`, texto libre visible) en `deal-source-field.test.tsx`; CA-4b (lo que envía «Guardar») pasa al walkthrough y se apunta en §16. |
| **MENOR D-m1** Numeración | `0084` → `0083` (`when` mayor que el de `0082`, NK-0070), en §5, §7, §10, §12 y §13. |
| **MENOR D-m2** CA-1 y U-1 se contradicen sobre el disparador de 0012 | Sacado de CA-1 y de U-1, con el motivo (la migración no toca la función; `coalesce` no depende del valor por defecto). |
| **MENOR D-m3** CA-1 «falla hoy» solo porque falta el archivo | CA-1 comprueba antes de la migración que el `insert` deja `outbound` (control) y después `null`. |
| **MENOR D-m4** El test del Asesor cambia de intención | CA-5 nombra el título del `it` de `:198` que cambia y deja intactas `:206-211` y `:215-216`. |
| **MENOR D-m5** Colisión con texto libre «sin origen» | §8 lo anota como límite aceptado; U-4 usa `AI_NO_SOURCE` y un caso de CA-5 fija el comportamiento. |
| Coherencia con NK-0106 (gate §«Coherencia» 1) | Cabecera y §13: `deal-source.ts` importa `NO_SOURCE` y no escribe «—»; la lista de métricas es un techo; este SDD se integra antes que NK-0106. |
| Decisión del coordinador: «Nuevo deal» pide origen = ticket aparte | Registrada en §15. |

## 18. Delta de implementación (lo rellena el agente al entregar)
Pendiente.
