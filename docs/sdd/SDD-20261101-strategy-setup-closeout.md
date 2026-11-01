# SDD-20261101-strategy-setup-closeout · [Mejora] Cierre de «Configura tu estrategia» que guía al siguiente paso (NK-0008)

**Tipo:** Mejora · **Prioridad propuesta:** Media (lo grande ya está entregado; faltan un hueco de CA-5, la línea base y las firmas)
**Estado:** Aprobado por Fede (2026-11-01) · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-11-01
**PRD:** `docs/prd/PRD-20261028-ux-onboarding-coherencia.md` (G-3) · **Depende de:** `SDD-20261025-strategy-setup-guided-next-step` (este SDD lo **extiende** y no lo reescribe; solo se tocan su cabecera, su §4, su §13 y su §16, y solo con aprobación de Fede)
**Ticket:** NK-0008 (hoy `LOGGED` en el ledger; el código del SDD original ya está en `origin/main`)

> Un SDD dice cómo se verifica que está bien hecho. Cada criterio de aceptación (CA-n) debe poder tener una prueba automática que lo nombre.
> Nivel elegido: **SDD corto, sin PRD nuevo.** El PRD de la iniciativa ya cubre G-3 y no hay feature nueva; sí hay un hueco de comportamiento en pantallas, estado de base de datos por comprobar y decisiones sin firmar, así que «solo ticket» se queda corto. Un PRD añadiría poco: lo que aportaría es la línea base, y esa es una consulta, no un documento.

## 1. Resumen
El SDD original de NK-0008 se implementó y se fusionó en `main` (PR #31, `b4e4a4e`, 2026-10-27, más los arreglos M-1 a M-6 de la auditoría). Revalidado contra `origin/main` (`9feef64`), **sigue vigente en lo que dice y casi todo está hecho**. Este SDD cubre solo lo que falta para cerrar el ticket: un hueco real de CA-5 en tres pantallas, la línea base de la sección 4 (que hoy es «sin dato»), y las decisiones de la sección 14 del original, que nadie ha firmado. No hay esquema nuevo ni llamadas a IA.

## 2. Problema y para quién
Founder con poco tiempo: cuando guarda su cuota, crea una cuenta o añade un deal, el progreso de «Configura tu estrategia» debe reflejarlo sin recargar. Y Fede necesita poder dar NK-0008 por cerrado con una cifra de partida y las decisiones registradas.

## 3. Evidencia y por qué ahora
Leído el 2026-11-01 sobre `origin/main` (`9feef64`). No he ejecutado la app ni consultado la base de datos de producción.

### 3.1 Revalidación CA por CA del SDD original
| CA original | Veredicto | Evidencia (archivo:línea) |
|---|---|---|
| CA-1 siguiente paso con motivo y botón | **Hecho, vigente** | `src/lib/setup-guide.ts:144-157` (`nextMessage`: «Siguiente: …», motivo, «Empezar»/«Más tarde»); motivos en `:27-36` |
| CA-2 nada pendiente → qué hace NOKKO y qué te toca | **Hecho, vigente** | `setup-guide.ts:151` y `COMPLETE_TEXT` en `:159-160` |
| CA-3 reglas fijas, igual en pantalla y Agente | **Hecho, vigente** | Orden de `SETUP_ITEMS` (`src/lib/setup-schema.ts:49-66`, `next` en `:74`); detector `src/lib/proactive/detectors/setup-incomplete.ts:11-12`; Agente `src/lib/agent/tools/core-read.ts:203-204` |
| CA-4 Completado/Pendiente/Pospuesto con una definición de «completo» | **Hecho; la premisa «definición única del SDD universal» está obsoleta** | `guideState` `setup-guide.ts:98-111`; la regla de «completo» vive solo en `setup-schema.ts:49-66`. El catálogo universal no tiene regla de «completo» (`src/lib/field-catalog.ts` no la contiene; el SDD universal la prometía en su §5 y sus U-1 a U-4 no la entregaron). Ver P-5 |
| CA-5 progreso al día sin recarga | **Parcial: hueco real en 3 pantallas** | Aviso de «paso pendiente de nuevo» y refresco: `src/hooks/use-setup-guide.ts:62-82`. Invalidan `["setup"]`: `icp-editor.tsx:227`, `strategy/motions.tsx:99,125`, `strategy/positioning.tsx:77,154`. **No lo hacen**: guardar la cuota (`src/routes/_authenticated/metrics.tsx:114-116`, solo `["metrics"]`) y crear cuentas con `insert` desde `src/routes/_authenticated/accounts.index.tsx:64-67` (no invalida nada: navega a la ficha), `src/components/apollo.tsx:122-133`, `src/components/clay.tsx:161-172`, `src/components/parallel.tsx:142-145` y `src/components/orchestrator/icp-companies.tsx:172-184` (estos cuatro invalidan solo `["accounts"]`), el gesto «Hacer» sobre una sugerencia con acción `create_account` (`suggestion-deck.tsx:51` invalida solo `["suggestions"]`; la acción corre en servidor, `agent.functions.ts:364-368`; ejemplo: `proactive/detectors/product-usage.ts:40`; `suggestions.tsx:131` y `suggestion-board.tsx:119` sí invalidan todo), aceptar un descubrimiento (`src/routes/_authenticated/discoveries.tsx:97-99`, crea la cuenta por `discoveries.functions.ts:49` **[comprobado por el autor: `discoveries.functions.ts:49` inserta en `accounts`]**) y **borrar el único ICP** (`src/components/icp-editor.tsx:461-467`, solo `["icp"]`: reabre el paso `icp` sin refresco). No revisé los flujos de `components/leads/` (lead a cuenta o deal). **Los deals sí quedan cubiertos** por tiempo real: `"setup"` está en `KEYS` de `src/hooks/use-live-pipeline.ts:6`, montado en `src/routes/_authenticated/route.tsx:44`, y `deals` está en la publicación (`drizzle/migrations/0010_lead_intake.sql:57`); con 600 ms de retraso y solo si el websocket funciona **[publicación viva no comprobada]**. `account-import.tsx:76` ya invalida todo. El QueryClient no tiene valores por defecto propios (`src/router.tsx:6`): la barra lateral se queda con el dato viejo hasta que otro componente remonte la consulta o la ventana recupere el foco **[Por verificar en la app]** |
| CA-6 aviso tras 1 día sin actividad, en Agente e Inicio | **Hecho, vigente** | `INACTIVITY_MS` `setup-guide.ts:162`, `nudgeDue` `:165-167`; actividad solo de personas `src/lib/org-data.ts:68-90` con respaldo a la fecha de alta; Inicio `src/routes/_authenticated/home.tsx:73` y `src/components/onboarding/home-card.tsx:34`; Agente `src/components/agent.tsx:208` |
| CA-7 posponer hasta la fecha elegida | **Hecho, vigente** | `parseSnoozeDate` `setup-guide.ts:209`; tabla y políticas `drizzle/migrations/0062_setup_step_snoozes.sql:32-54`; clave nueva al vencer `setup-incomplete.ts:20-23`; reapertura `org-data.ts:138,162-163` |
| CA-8 quién puede completar el paso | **Hecho, vigente** | `STEP_ROLES` `setup-guide.ts:15-24`, `whoCanText` `:132`, `suggestionAssignee` `:180`; base de datos `0062…:32-46` |
| CA-9 Agente ofrece el siguiente paso | **Hecho; sin prueba de componente** | `agent.tsx:208`; herramienta `core-read.ts:193-209` |
| CA-10 Agente confirma y propone el siguiente | **Hecho; la parte del modelo solo se verifica a mano** | Panel: `use-setup-guide.test.tsx` «CA-10» (corre: ver 3.2, última viñeta); texto del modelo: sin prueba posible sin llamar al modelo |

### 3.2 Lo que cambió en `main` desde la aprobación (2026-10-27) y su efecto
- **Quitar la UI multiempresa (#53, `278159b`).** No choca. La guía lee `me.currentOrg` (`use-setup-guide.ts:33`) y todo es por empresa. #53 toca la tarjeta «Primeros pasos» (`src/lib/guide.ts`, `src/components/home/guide-card.tsx`), que es **otra guía** distinta de «Configura tu estrategia». `OrgSwitcher` sigue montado (`src/routes/_authenticated/route.tsx:82`), reducido a un enlace a /company.
- **NK-0006/0018/0019/0020/0035 (país y tamaño).** No afectan. Normalizan `accounts.size` y `accounts.country`; el paso `icp` exige texto en `icp_profiles.company_size`, concepto `tamano_descripcion`, texto libre (`field-catalog.ts:299-302`, `setup-schema.ts:52-53`). El paso `accounts` solo cuenta filas (`setup-schema.ts:63`).
- **NK-0038/0040/0041/0042/0036 y el motor de sugerencias.** No afectan. `setup_incomplete` no es estratégica: se sincroniza aparte (`org-data.ts:142-155`) y `strategy-positioning.ts:16` ya cede ante `setup_incomplete:positioning`. Los cambios de aceptar con formulario son solo de `experiment` y `commercial_action`.
- **NK-0046 (módulo obsoleto).** Sin relación con la guía.
- **Ficheros de la guía desde `b4e4a4e`:** solo cambian por fusiones de las sugerencias estratégicas (`org-data.ts`) y por cambios del relleno con IA (`fec89c1` es un arreglo de comportamiento en `ai-fill.tsx`, que invalida todo y no afecta a la guía; `fe6bdc4`, formato). Sin cambios de comportamiento de la guía **[leído en `git log`; no he comparado el diff línea a línea]**.
- **Base de datos.** El registro `APLICAR-MIGRACIONES-GUIA.md` (carpeta de trabajo, fuera del repo) dice que 0062 y 0064 a 0067 se aplicaron en producción el 2026-10-27 con comprobación posterior. El SDD NK-0041 midió el 2026-11-01 que 0068 a 0070 están aplicadas y 0071 a 0073 no. Eso encaja, pero **no he vuelto a medirlo** (ver CA-4).
- **Pruebas.** Sobre `origin/main` (`9feef64`) pasan los 7 archivos de la guía: `setup-guide`, `setup-snooze-suggestions`, `setup-activity`, `org-data-setup`, `proactive`, `use-setup-guide`, `field-coverage`: 117 pruebas. `agent-tools.test.ts`: 71 pruebas. `migrations.pg.test.ts` **no corre en este entorno** (falta `@electric-sql/pglite`); las migraciones 0062 a 0067 siguen sin esa comprobación aquí.

### 3.3 Qué queda realmente abierto
1. CA-5: la cuota y cinco sitios que crean cuentas sin refrescar la guía (3.1). Los deals ya los cubre el tiempo real.
2. Línea base de la sección 4 original: sigue «sin dato», y una de las dos métricas no es medible tal como está escrita (sección 4). La fila G-3 del PRD (`docs/prd/PRD-20261028-ux-onboarding-coherencia.md:26`) repite esa métrica.
3. Sección 14 del original (9 propuestas) y sección 16 (registro de decisiones) sin firmar. Están en producción.
4. Recorrido manual de CA-10 y de la app: no hecho (el original lo declara «no verificado»).
5. Sospecha sin comprobar sobre «Hecho» en la tarjeta (P-3).

**Apuesta declarada:** no hay datos de uso; la prioridad se apoya en el código de `main`.

## 4. Resultado buscado
Las dos métricas del SDD original, replanteadas para que se puedan medir:
- **M-1.** % de empresas **no archivadas** (`organizations.archived_at is null`; quitar las internas, de demo y de prueba lo decide Fede, P-6) con al menos 7 días de antigüedad que tienen los 8 pasos completos **en la fecha de medición y con el trimestre de esa fecha** (el paso `quota` exige cuota del trimestre actual, `setup-schema.ts:60-61`: el 2027-01-01 el resultado cae en bloque sin que nadie haya hecho nada mal). Se anotan fecha y trimestre en la sección 18; siempre se informa N además del %. Fuente: base de datos, consulta de la sección 16. Línea base: **sin dato** (no medida). Sustituye a «completan en 7 días»: el estado «completo» se deriva de los datos y no guarda cuándo se completó cada paso, así que «en 7 días» no se puede reconstruir hacia atrás.
- **M-2.** «Tiempo desde terminar un paso hasta iniciar el siguiente»: **no medible hoy** (no hay registro de eventos de la guía; el original ya decía «no medido»). Propuesta: retirarla hasta que exista ese registro. No crear tabla solo para esto (P-2).

## 5. Alcance
**Incluye:** refresco del progreso al guardar la cuota, al crear cuentas (Métricas, Cuentas, Apollo, Clay, Parallel, empresas del ICP, Descubrimientos, «Hacer» sobre `create_account`) y al borrar el único ICP; prueba de guarda para que no vuelva a pasar; corrección de la fila G-3 del PRD y del comentario de cabecera de `setup-guide.ts:2` si Fede acepta P-2 y P-5; medición de línea base y del estado de las migraciones con consultas de solo lectura; registro de las decisiones del original; recorrido manual.
**No incluye** (límite que el brief copia a «Movimientos prohibidos»):
- Migraciones, RLS, `drizzle/`, `BASELINE_MAX`.
- Cambiar el orden de los pasos, los textos de la guía, los roles o el umbral de 1 día.
- Fusionar o rediseñar las tarjetas de Inicio («Primeros pasos», `RoadmapCard`, `GuideOffer`): ver P-4.
- Una regla universal de «completo» para ICP, posicionamiento o empresa: ver P-5.
- Tabla de eventos de la guía y la métrica M-2.
- Cualquier cambio en Lovable ni migración de Lovable (salida pausada).

## 6. Cambios de comportamiento (delta)
**Añadido:** el progreso se actualiza al guardar la cuota, crear cuentas desde esos ocho sitios o borrar el único ICP; una prueba de guarda.
**Modificado:** M-1 y M-2 del original y de la fila G-3 del PRD (sección 4, P-2). La dependencia del SDD universal pasa a «consume `setupStatus`» (P-5): esto edita el SDD original **solo en su cabecera (línea 5), su §13 (líneas 102 y 105, donde está la dependencia) y su §16 (donde Fede registra decisiones)**; su §4 no se reescribe: M-1 y M-2 se marcan allí como «superadas por `SDD-20261101-strategy-setup-closeout` §4». Todo con aprobación de Fede.
**Eliminado:** nada.

## 7. Historias y criterios de aceptación
### H-1: Como founder, quiero que el progreso de «Configura tu estrategia» se actualice al instante cuando avanzo desde cualquier pantalla, para no pensar que no ha contado.
- **CA-1** CUANDO guardo la cuota del trimestre en Métricas, creo cuentas desde Cuentas, Apollo, Clay, Parallel, las empresas del ICP o Descubrimientos, acepto con «Hacer» una sugerencia con acción `create_account`, o borro el único ICP, el sistema DEBE invalidar el estado de la guía (`["setup"]` y las claves de la guía) tras el éxito del guardado y NO tras un error, sin recarga ni cambio de ventana · cubre G-3 (CA-5 del original) · prueba: `src/hooks/setup-invalidation.test.ts` (nuevo; QueryClient real: el ayudante invalida `["setup", org]` y las claves de la guía), `src/lib/save-quota.test.ts` (cuota: invalida en éxito, no en error) y `src/lib/create-account.test.ts` (cuenta individual de `accounts.index.tsx`: la función extraída `createAccount(supabase, qc, input)` invalida en éxito, no en error). El resto (Apollo, Clay, Parallel, empresas del ICP, Descubrimientos, «Hacer», borrar ICP) queda por la guarda de CA-2, no por prueba de comportamiento. **Rojo real:** ver nota de §12.
- **CA-2** El sistema DEBE fallar la comprobación automática SI un archivo de `src/components`, `src/routes` (sin `api`) o `src/hooks` hace una escritura relevante y no contiene la **llamada** `invalidateSetup(`, `invalidateQueries({ queryKey: ["setup"] })` o `invalidateQueries()` sin argumentos (no basta el `import`). Escritura relevante: `insert`, `upsert` o `delete` sobre `accounts`, `deals`, `quotas`, `icp_profiles`, `segments`, `positioning` o `messaging_pillars`, y `update` solo sobre estas cinco últimas (un `update` de `accounts` o `deals` no cambia la guía: solo cuenta filas, `setup-schema.ts:63-65`). Además, un archivo que llame a una función de servidor que escribe (`decideDiscovery`, `decideSuggestion`, `applySetupItems`, `decideAgentAction`, `undoImport`) DEBE cumplir lo mismo. Excepciones con motivo: `deals` y `won-deals-panel.tsx`/`calls-deals-tabs.tsx` (cubiertos por tiempo real: `use-live-pipeline.ts:6`). Se excluye `src/lib` (escritores de servidor sin `qc`). · cubre G-3 · prueba: `src/lib/setup-write-guard.test.ts` (nuevo, lee fuentes con `readFileSync` y expresiones que cruzan líneas; falla hoy por los escritores de CA-1). **Es una red gruesa, no una garantía**: es por archivo, no por camino (`icp-editor.tsx` ya contiene `["setup"]` en `:227` aunque su borrado no invalide; por eso el inventario cerrado de CA-1 se cruza archivo a archivo con ancla), y no ve `.from(TABLE[kind])` (`delete-element.tsx:55`) ni escrituras en servidor llamadas desde otros sitios.

### H-2: Como Fede, quiero cerrar NK-0008 con una cifra de partida y las decisiones firmadas, para no arrastrar premisas sin medir.
- **CA-3** El ticket NO DEBE pasar a entrega mientras M-1 no tenga cifra medida con fuente y fecha, o «sin dato» con su motivo, anotado en la sección 18 · cubre G-3 · prueba: no automatizable; lo comprueba el gate al revisar la sección 18 (manual).
- **CA-4** El estado de las migraciones 0062 y 0064 a 0067 en la base de producción DEBE coincidir con lo esperado por las cinco consultas de solo lectura copiadas en la sección 16 (tabla, función y 4 políticas; 7 columnas y 7 disparadores; `company_diagnosis`; las dos funciones con `last_human_edit_at`; 7 índices), medido con fecha en la sección 18 · cubre G-3 · prueba: no automatizable (producción); consulta de solo lectura.
- **CA-5** Las decisiones 1 a 9 de la sección 14 del original DEBEN quedar registradas con fecha y «Aceptado / Cambios pedidos» en su sección 16 (la edita Fede) · cubre G-3 · prueba: no automatizable.

## 8. Casos límite y errores
- La cuota se guarda con error: no se invalida; solo en éxito (CA-1). Ya es el patrón de `metrics.tsx:115`.
- Crear una cuenta con duplicado confirmado: el refresco va tras el `insert` correcto, no tras el aviso (CA-1).
- Otra empresa: las claves llevan `orgId` (`use-setup.ts:11`); invalidar `["setup"]` por prefijo refresca las consultas en caché de cualquier empresa, lo que con una sola empresa por persona es inocuo (CA-1).
- Persona sin rol (`me.roles[0]` nulo): `canCompleteStep` devuelve `true` solo para los pasos abiertos a todos y `false` para el resto (`setup-guide.ts:68-72`); ve el camino «Lo que queda no es de tu rol» (`:153-155`). Sin cambio.
- Si `setupStatus` no se puede leer, `loadSetupData` lanza (`org-data.ts:29-31`) y la pantalla conserva el último estado; el refresco reintenta (`use-setup-guide.ts:82`). Sin cambio.
- Una escritura nueva en una de las 7 tablas que olvide invalidar: la prueba de guarda lo detecta (CA-2).
- M-1 se informa siempre con N (empresas elegibles) además del % (CA-3).

## 9. Experiencia y copy
Sin copy nuevo. El aviso «Paso pendiente de nuevo: …» ya existe (`setup-guide.ts:62-64` (`reopenedText`)) y sale cuando el refresco descompleta un paso.

## 10. Datos, permisos y privacidad
Sin tablas ni columnas nuevas, sin RLS nuevas. Las consultas de la sección 16 son de solo lectura y devuelven recuentos, nunca nombres, correos ni textos de clientes.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| ninguna | — | — | — |

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1a | Ayudante `invalidateSetup(qc)` en el módulo nuevo `src/hooks/setup-invalidation.ts` (no en `use-setup.ts`: `use-setup-guide.test.tsx:22` simula ese módulo) y su uso en `useSetupGuide.refresh` | CA-1 | `src/hooks/setup-invalidation.test.ts` |
| U-1b | Cuota: `saveQuota` extraída de `metrics.tsx:113-117` a `src/lib/save-quota.ts`, con el ayudante tras el éxito | CA-1 | `src/lib/save-quota.test.ts` |
| U-1c | Cuentas: `createAccount` extraída de `accounts.index.tsx:62-68` (solo ese sitio) a `src/lib/create-account.ts`; Apollo, Clay, Parallel, empresas del ICP, Descubrimientos, «Hacer» y borrar ICP llaman al ayudante en su sitio, sin extraer | CA-1 | `src/lib/create-account.test.ts` |
| U-2 | Prueba de guarda con lista de excepciones con motivo. **Depende de U-1a a U-1c** (misma rama; tras ellas pasa) | CA-2 | `src/lib/setup-write-guard.test.ts` (falla hoy por los escritores de CA-1) |
| U-3 | Medición de M-1, de P-3 y de las cinco comprobaciones de migraciones, **solo lectura, con orden de Fede en el chat para esa acción** (`GROUND-RULES.md`), ejecutada por quien tenga acceso a Lovable Cloud (no el agente que escribe código) | CA-3, CA-4 | No aplica (medición) |
| U-4 | Recorrido manual (`nokko-walkthrough`): CA-10 con el Agente, CA-1 en las pantallas, CA-9 | CA-1 | No aplica (manual) |
| U-5 | Documentación, con aprobación de Fede: comentario de cabecera de `setup-guide.ts:2`; fila G-3 y fila 3 del orden del PRD; cabecera, §13 y §16 del SDD original (P-2, P-5, CA-5) | CA-5 | No aplica |

**Sobre el rojo real (regla 5).** `scripts/factory/fail-first.mjs:20-25` copia solo el archivo de test sobre la base, así que las pruebas de comportamiento de U-1a a U-1c fallan por importación rota, que no cuenta. Decisión del autor, la más simple: **el rojo real de CA-1 y CA-2 es el de la guarda `setup-write-guard.test.ts`**, que lee el código actual y falla por aserción; las pruebas de comportamiento son de regresión, y no se declaran «fail-first». Descartada: un commit previo que extraiga `saveQuota` y `createAccount` sin cambiar el comportamiento para que la prueba falle por aserción; añade un commit y un refactor sin valor propio para un hueco de refresco.

Orden: U-1 y U-2 en la misma rama (U-2 depende de U-1); U-3 en paralelo; U-4 al final. Las pruebas de comportamiento de U-1 fallan antes por inexistencia del módulo; la guarda de U-2 falla antes por los escritores de CA-1 reales.

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- `useSetupGuide.refresh` (`use-setup-guide.ts:82`) ya invalida `["setup"]` y las claves de la guía; extraerlo a un ayudante evita copiar claves en cada pantalla. Va en un módulo nuevo porque `use-setup-guide.test.tsx:22` simula `@/hooks/use-setup`.
- `["setup"]` se invalida por prefijo; no hace falta pasar `orgId`.
- La prueba de guarda sigue el patrón de `field-coverage.test.ts` y `tracked-columns.test.ts` (leen archivos fuente con `readFileSync`).
- Alternativa descartada: invalidar todo con `qc.invalidateQueries()` en cada pantalla (lo hace el Agente en `agent.tsx:174`). Es más barato de escribir y repinta todas las pantallas por cada gesto.
- Alternativa descartada: `MutationCache` global con `onSuccess`. Cambia el contrato de todas las mutaciones del producto por un hueco de tres pantallas.

## 14. Riesgos y dependencias
- Una prueba que lee código fuente se rompe si se mueve el archivo; la lista de excepciones debe llevar su motivo.
- U-3 necesita acceso a Lovable Cloud (SQL editor, solo lectura) y orden de Fede para esa acción. Si no se tiene, CA-3 y CA-4 quedan «sin dato».
- Fuera de alcance, anotado: `src/routes/api/public/accounts.ts:74` inserta cuentas desde el servidor; no puede invalidar en el cliente y no lo cubre el tiempo real. Quien tenga la sesión abierta lo verá al recuperar el foco.
- Los deals dependen del tiempo real (600 ms, solo con websocket): el SDD no los cambia; si Fede quiere refresco inmediato sin websocket, se añade `calls-deals-tabs.tsx` a CA-1 (`new-deal.tsx:90` ya invalida todo).
- Número de pasos y orden: sin cambio. Un paso nuevo requiere su entrada en `STEP_ROLES` y `STEP_WHY` (`src/lib/AGENTS.md`).

## 15. Preguntas para Fede y para la revisión técnica
1. **P-1 · ¿Registras como «Aceptado» las decisiones 1 a 9 de la sección 14 del original tal y como están en `main`?** Recomiendo **sí**. Están en producción desde 2026-10-27 (migraciones) y deshacerlas cuesta más que aceptarlas. Las que son realmente tuyas: 14.4 (`BASELINE_MAX` 992, hoy `src/lib/field-baseline.ts:98`) y 14.5 (función `company_diagnosis`, usada en `onboarding/home-card.tsx:21`). La 14.9 queda resuelta si CA-4 confirma las cinco comprobaciones. Te ofrezco dos salidas: «aceptar las nueve» o «aceptar salvo N», con la lista de las que quieras cambiar (salen de este SDD como cambio aparte). El original pide decidir una por una.
2. **P-2 · ¿Cambias M-1 y retiras M-2, y corriges la fila G-3 del PRD (`PRD-20261028-ux-onboarding-coherencia.md:26`, que repite «completan en 7 días»)?** Recomiendo **sí a las tres cosas**: sin corregir el PRD, la métrica oficial seguiría siendo la que no se puede medir. «Completan en 7 días» no se puede reconstruir (el estado se deriva, no guarda fecha) y M-2 no tiene origen de datos. Crear una tabla de eventos solo para medir esto añade esquema y RLS por una métrica; si algún día quieres M-2, que sea otro SDD con su propio registro.
3. **P-3 · ¿Compruebo antes de tocar nada qué pasa con «Hecho» (deslizar a la derecha) en la tarjeta `setup_incomplete`?** Sospecha, **no comprobada**: esa decisión la deja `approved`; el paso sigue pendiente; la clave se reemite igual; el `upsert` la ignora por duplicada (`org-data.ts:155`) y solo se reabren las `resolved` (`org-data.ts:162-163`). Resultado posible: esa sugerencia no vuelve a salir, aunque la guía de la barra lateral sí sigue. Recomiendo **medir primero**: cuántas sugerencias `setup_incomplete` hay en `approved` con su paso aún pendiente (consulta 3 de la sección 16). Si son 0, no se toca (mismo criterio que NK-0043, aplazado con 0 casos). Si hay alguna, SDD aparte.
4. **P-4 · ¿Las dos guías de Inicio («Primeros pasos» y «Configura tu estrategia») se arreglan aquí?** Recomiendo **no**. Las dos recomiendan «tu siguiente paso» en la misma pantalla (`home.tsx:66,72,73`), pero la primera es de onboarding y la tocó #53. Ordenarlas es decisión de diseño de Inicio, no cierre de NK-0008. Que se recoja en el SDD de onboarding de la serie.
5. **P-5 · ¿Quitamos del original la dependencia dura del «SDD universal de campos (definición única de completo)»?** Recomiendo **sí**: el universal no entregó esa regla y `setup-schema.ts:49-66` es hoy la única definición de «completo» de los 8 pasos; NK-0008 la consume tal cual. La regla universal para ICP, posicionamiento y empresa se reabre en el ticket del SDD universal si Fede lo quiere. Dejar la dependencia escrita bloquearía NK-0008 por algo que no va a llegar.
6. **P-6 · ¿Cómo se excluyen de M-1 las empresas internas, de demo y de prueba?** «No archivada» las incluye. Recomiendo que me des la lista de ids (o un criterio) y que M-1 se informe **con y sin** ellas; no la invento. Sin lista, M-1 sale solo «sobre no archivadas» y lo dice.
7. **Para la revisión técnica:** resuelto en CA-1/CA-2: una prueba de guarda por lectura de fuentes más pruebas de comportamiento para cuota y cuenta. ¿Falta alguna prueba por escritor (Apollo, Clay, Parallel, ICP) o la guarda basta para esos cuatro?

**Decisiones de Fede (2026-11-01, en el chat):**
- P-1 a P-5: aceptadas con la recomendación del SDD.
- P-6: no hay lista de empresas internas, de demo o de prueba; M-1 se informa solo sobre «no archivadas» y lo dice.
- La aprobación es del SDD. El GO para construir (U-1 a U-2), la medición de producción de U-3 y la edición del SDD original de U-5 se piden aparte.

## 16. Pendiente de verificar
Consultas **propuestas, no ejecutadas** (solo lectura, recuentos, sin datos de clientes; SQL editor de Lovable Cloud; el rol del editor ve todas las empresas, el cliente de la app con RLS solo vería la actual):

1. **Estado de migraciones (CA-4).** Copiadas de `APLICAR-MIGRACIONES-GUIA.md` (carpeta de trabajo, fuera del repo, líneas 27-31) para que el gate las pueda leer. Esperado entre paréntesis:
```sql
-- 0062 (la tabla, la función y 4 políticas)
select to_regclass('public.setup_step_snoozes')::text, to_regprocedure('public.can_complete_setup_step(uuid,text)')::text, (select count(*) from pg_policies where tablename='setup_step_snoozes');
-- 0064 (7 y 7)
select (select count(*) from information_schema.columns where table_schema='public' and column_name='last_human_edit_at'), (select count(*) from pg_trigger where tgname like '%\_stamp\_human\_edit' and not tgisinternal);
-- 0065 (company_diagnosis(uuid))
select to_regprocedure('public.company_diagnosis(uuid)')::text;
-- 0066 (las dos funciones existen; true en las que mencionan last_human_edit_at; md5 del resumen del registro: log_field_edit 44c31f23163b4c57655296403a6133ad, undo_field_edit 59daf3b7a744ff535359325f2d7163b1)
select proname, prosrc like '%last_human_edit_at%', md5(prosrc) from pg_proc where proname in ('log_field_edit','undo_field_edit') order by 1;
-- 0067 (7)
select count(*) from pg_indexes where indexname like '%\_org\_human\_edit\_idx';
```
2. **Línea base M-1 (CA-3).** El trimestre sale de `quarterOf` (`src/lib/metrics.ts:63-65`, formato `AAAA-Qn`, hora local del navegador): para medir el 2026-11-01 es `'2026-Q4'`; **cámbialo y anota fecha y trimestre en la sección 18 si mides otro día**. Se usa `~ '\S'` y no `btrim` porque `filled` en JS (`setup-schema.ts:38`) también descarta tabuladores y saltos de línea. **Lectura de `p_segments`:** `create_organization` siembra segmentos con ACV (`0002_multitenant_organizations.sql:204`), así que ese paso nace completo y mide la plantilla, no el trabajo de la persona; `benchmarks` no se siembra. **Antes de ejecutar**, comprueba que el editor no aplica RLS: `select count(*) from organizations` debe devolver todas las empresas. La aplicación lee una sola fila de `positioning` por empresa (`org-data.ts:23`, `limit(1)`); el SQL usa `exists` sobre cualquiera: si hubiese filas duplicadas por empresa podrían diferir **[no encontré restricción única; se comprueba con `select org_id from positioning group by 1 having count(*) > 1`]**.
```sql
with o as (
  select id from organizations
  where archived_at is null and created_at <= now() - interval '7 days'
), s as (
  select o.id,
    exists (select 1 from positioning p where p.org_id = o.id and not exists (
      select 1 from unnest(array['best_customers','alternatives','differentiation','value','trend','target_customer','need','category','key_benefit','competitive_alternative','differentiator','one_liner','elevator_pitch']) k
      where to_jsonb(p) ->> k !~ '\S')) as positioning,
    exists (select 1 from icp_profiles i where i.org_id = o.id and i.industries ~ '\S' and i.company_size ~ '\S' and i.why_fit ~ '\S' and i.anti_icp ~ '\S') as icp,
    (exists (select 1 from segments g where g.org_id = o.id) and not exists (select 1 from segments g where g.org_id = o.id and g.acv_min is null and g.acv_max is null)) as segments,
    (exists (select 1 from segments g where g.org_id = o.id) and not exists (select 1 from segments g where g.org_id = o.id and (g.win_rate_target is null or g.ae_quota is null))) as benchmarks,
    ((select count(*) from messaging_pillars m where m.org_id = o.id and m.title ~ '\S' and m.message ~ '\S') >= 3) as pillars,
    exists (select 1 from quotas q where q.org_id = o.id and q.period = '2026-Q4' and q.amount > 0) as quota,
    exists (select 1 from accounts a where a.org_id = o.id) as accounts,
    exists (select 1 from deals d where d.org_id = o.id) as deals
  from o
)
select count(*) as empresas_elegibles,
  count(*) filter (where positioning and icp and segments and benchmarks and pillars and quota and accounts and deals) as con_los_8_completos,
  count(*) filter (where positioning) as p_positioning, count(*) filter (where icp) as p_icp, count(*) filter (where segments) as p_segments,
  count(*) filter (where benchmarks) as p_benchmarks, count(*) filter (where pillars) as p_pillars, count(*) filter (where quota) as p_quota,
  count(*) filter (where accounts) as p_accounts, count(*) filter (where deals) as p_deals
from s;
```
3. **P-3:** `select count(*) from suggestions s where s.detector = 'setup_incomplete' and s.status = 'approved';` y, de esas, cuántas tienen su paso aún pendiente. Una consulta propia: se repite el CTE `s` de la consulta 2 **sin** el filtro de 7 días y se une con `suggestions` por empresa y por paso, devolviendo solo un recuento:
```sql
-- tras el CTE s (con una fila por empresa y las booleanas por paso)
select count(*) as aprobadas_con_paso_pendiente
from suggestions g join s on s.id = g.org_id
where g.detector = 'setup_incomplete' and g.status = 'approved'
  and not (case split_part(g.dedupe_key, ':', 2)
    when 'positioning' then s.positioning when 'icp' then s.icp when 'segments' then s.segments when 'benchmarks' then s.benchmarks
    when 'pillars' then s.pillars when 'quota' then s.quota when 'accounts' then s.accounts when 'deals' then s.deals end);
```
`approved` mezcla lo que cerró la persona con lo que `syncSuggestions` cierra tras «Resolver» (`org-data.ts:166-167`); el recuento es una cota superior.
4. **Que la app cargue sin error con la base actual** (Inicio y «Configura tu estrategia»): el registro de migraciones dice que no se comprobó. Lo cubre U-4.
5. **Efecto visible de CA-1 en el original:** que el dato viejo se vea de verdad en la barra lateral hasta recargar. Lo cubre U-4.
6. **Que `migrations.pg.test.ts` pase** en un entorno con PGlite; aquí no corre.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Un agente `nokko-gate` con contexto fresco lee este SDD y el código, y devuelve su informe. El coordinador lo copia aquí sin editarlo. El gate no aprueba el SDD: informa; la aprobación es de Fede.
- Veredicto del gate: Cambios menores en las dos pasadas (2026-11-01): primera sobre `7b30db0`, 0 bloqueantes y 6 importantes; segunda sobre `8535261`, 0 bloqueantes y 4 importantes. No habrá tercera pasada salvo cambio material de alcance.
- CA sin prueba posible o sin G-n: ver las dos pasadas. CA-3, CA-4 y CA-5 son puertas de proceso sin prueba automática, etiquetadas; todos citan G-3.
- [Por verificar] que sigue sin comprobarse: ver las dos pasadas (producción, M-1, P-3, realtime viva, md5 contra la base, la app).
- Contradicciones con el código o con decisiones previas: ver las dos pasadas; las de la segunda están contestadas en su tabla.
- Lo que esta revisión NO demuestra: ver las dos pasadas. Ninguna ejecutó la suite completa ni `gate.mjs`.

### Primera pasada del gate (2026-11-01), copiada sin editar
Veredicto: Cambios menores. No hay bloqueantes. La medición y las decisiones son sólidas, pero la premisa central de CA-1 y CA-2 (el hueco está en «3 pantallas») está mal acotada, y hay un riesgo concreto en U-1.

1. Importante: el hueco de «añadir un deal desde la ficha» no existe tal como está descrito.
- El SDD lo lista entre los que «no invalidan» (§3.1 CA-5).
- `src/hooks/use-live-pipeline.ts:6` incluye "setup" en KEYS, y :18-21 invalida esas claves en cada cambio de la tabla deals.
- useLivePipeline está montado en `src/routes/_authenticated/route.tsx:44`.
- deals está en la publicación realtime (`drizzle/migrations/0010_lead_intake.sql:57`).
- `src/lib/AGENTS.md` lo dice expresamente: las claves basadas en deals deben estar en esa lista.
- Eso cubre un deal creado desde `calls-deals-tabs.tsx:49`, con 600 ms de retraso y solo si el websocket funciona.
- Cambio: quita el deal de CA-1/U-1, o redáctalo como «refresco inmediato sin depender del websocket». Si lo dejas, cita use-live-pipeline.ts y añade deals a las excepciones nombradas de CA-2.
- No he comprobado que esa publicación siga vigente en producción.

2. Importante: el hueco real es más ancho que «3 pantallas» (la auditoría de escritores quedó a medias).
- Estos componentes escriben en accounts e invalidan solo ["accounts"], no ["setup"]: `src/components/apollo.tsx:121,133`; `clay.tsx:160,172`; `parallel.tsx:142,145`; `src/components/orchestrator/icp-companies.tsx:172,184`.
- Con la lógica del propio SDD, crear cuentas desde ahí tampoco refresca el paso accounts (`setup-schema.ts:63`).
- `account-import.tsx:76` sí invalida todo. `won-deals-panel.tsx:177` inserta deals, pero lo cubre realtime.
- Consecuencia: la prueba de guarda de CA-2 fallará de entrada en al menos 4 archivos más. U-1 ya no es «tres pantallas» y se queda corta como unidad acotada.
- Cambio: haz el inventario completo con el mismo grep. Decide, uno por uno, si cada archivo se arregla o va a la lista de excepciones con motivo.
- Precisión adicional: un update en accounts no cambia el estado de la guía (solo cuenta filas). La guarda debería exigir insert/delete en accounts y deals. Ahora pide «escribe» y daría falsos positivos (`accounts.$id.tsx:71,75`, `fit-fields.tsx`, `abm.tsx:60`).

3. Importante: U-1 romperá un test existente si no se avisa.
- `src/hooks/use-setup-guide.test.tsx:22` mockea `@/hooks/use-setup` devolviendo solo useSetup.
- Si `use-setup-guide.ts` importa invalidateSetup desde ese módulo (§13), el mock no lo exporta.
- Cambio: o pones el ayudante en un módulo nuevo, o anotas en U-1 que el mock se actualiza. Hoy ese test, que da CA-5/CA-10, saldría rojo por motivos ajenos al cambio.

4. Importante: CA-1 se prueba solo por texto de código fuente, no por comportamiento.
- Las pruebas de CA-1 (use-setup.test.tsx y setup-invalidation.test.ts) comprueban que el ayudante existe y que los archivos lo importan.
- Nada demuestra que el progreso cambie sin recarga; eso queda en U-4 manual, sin test fail-first.
- La regla 5 de la fábrica dice que un test cuenta si falla antes. «Falla porque el import no existe» es un rojo trivial.
- Cambio: añade al menos una prueba de comportamiento. Por ejemplo, un QueryClient real con setQuota/create extraído a función pura que reciba qc, y que verifique la invalidación de ["setup"] en éxito y no en error.
- La pregunta técnica de §15.6 conviene resolverla así: recomiendo las dos, una de guarda y una por escritor.

5. Importante: el desglose de unidades no es independiente.
- U-2 usa el mismo archivo de test que U-1 (setup-invalidation.test.ts) y «pasa al cerrar U-1» (§12).
- Son una sola unidad con dos CA. Dilo así o separa los archivos de test.

6. Importante: M-1 tiene tres problemas de definición.
- (a) El trimestre cambia el resultado. El paso quota exige cuota del trimestre actual (`setup-schema.ts:61-62`). El 2027-01-01, M-1 caerá en bloque, sin que ninguna empresa haya hecho nada mal. El SDD no lo menciona. Cambio: fija fecha de medición y trimestre en §18, y dilo.
- (b) «Empresas activas» no es archived_at is null. Esa consulta incluye organizaciones de demo, de prueba y las de NOKKO. Cambio: llámalo «no archivadas» o define cómo excluir internas. Esa exclusión pertenece a la decisión de Fede.
- (c) El PRD sigue diciendo «completan en 7 días». G-3 en `docs/prd/PRD-20261028-ux-onboarding-coherencia.md:26` es la fuente de la métrica original. El SDD declara «sin PRD nuevo» pero sustituye esa métrica. Cambio: añade al alcance la corrección de la fila G-3 del PRD o la pregunta a Fede.
- Además, «si M-1 sale con muy pocas empresas, se informa el número» (§8) no tiene umbral, así que no es medible. Pon un número o «siempre informa N».

7. Menor: SQL de M-1.
- Los 13 campos de posicionamiento coinciden con POSITIONING_FIELDS (`setup-schema.ts:28-43`). Los criterios de ICP, segmentos, benchmarks, pilares y cuota coinciden con `setup-schema.ts:49-62`, y las columnas existen en types.ts.
- La app lee una sola fila de posicionamiento con .limit(1).maybeSingle() (`org-data.ts:22`). El SQL usa exists sobre cualquiera. Si hubiera filas duplicadas por empresa, difieren. No encontré restricción única en las migraciones que miré.
- :quarter no se puede pegar tal cual en el editor SQL. quarterOf devuelve YYYY-Qn (`src/lib/metrics.ts:62-64`). Quita el «[Por verificar]» y escribe el literal, p. ej. '2026-Q4'. El trimestre sale con la hora local del navegador, no la del servidor.

8. Menor: CA-4 describe mal una de sus cinco consultas.
- Dice «los dos md5 de las funciones». La fila 4 de APLICAR-MIGRACIONES-GUIA.md:27-31 usa prosrc like '%last_human_edit_at%'. Los md5 aparecen solo en el resumen de la línea 4 de ese archivo.
- Cambio: cita los md5 literales (44c31f23…, 59daf3b7…) o la comprobación like.
- APLICAR-MIGRACIONES-GUIA.md vive fuera del repo. Cualquier CA que lo cite no es verificable por el gate desde el worktree. Considera copiar las cinco consultas al propio SDD (§16).

9. Menor: contradicción de alcance sobre editar el SDD original.
- §5 dice que no lo edita. CA-5 hace que Fede escriba en la sección 16 del original, y P-5 propone quitarle la dependencia dura del universal.
- Aclara que CA-5/P-5 sí tocan el original, o muévelo a su §18.
- La propia cabecera de `setup-guide.ts:2` sigue diciendo «single definition of completo, SDD universal», un comentario obsoleto que P-5 deja sin arreglar.

10. Menor: P-1 agrupa nueve decisiones en un solo «Aceptado».
- Entre ellas están 14.4 (BASELINE_MAX 992, `field-baseline.ts:98`, confirmado) y 14.5 (company_diagnosis, `home-card.tsx:21`, confirmado).
- Tiene recomendación y porqué, y es razonable. Pero el original pide decidir una por una. Cambio: ofrece «aceptar todas» y «aceptar salvo N».

11. Menor: afirmaciones inexactas.
- §8, «Otra empresa», dice que invalidar ["setup"] por prefijo no toca a otras. Por prefijo se invalidan las consultas de todas las empresas en caché. Es inocuo con multiempresa quitada, pero la frase es falsa.
- §3.2 llama «selector de empresa» a `route.tsx:82`. org-switcher.tsx ahora es solo un Link a /company (PR #53, «paso 1»).
- §3.2 dice «ver 3.3» para las pruebas de CA-10. Es 3.2, última viñeta.

12. Menor: la hipótesis P-3 es coherente con el código, pero sigue sin probar (ignoreDuplicates del upsert en `org-data.ts:155`; solo se reabren las resolved `org-data.ts:162-163`; REOPENABLE en :138). No comprobó que «Hecho» deje la decisión en approved. El SDD lo declara hipótesis, correcto.

Huecos de alcance no tratados: qué ve un usuario sin rol (me.roles[0] nulo) en el aviso de CA-1 (canCompleteStep con role = null no mirado); si setupStatus falla, ¿se refresca igualmente?

No verificó: ejecución de tests, estado de migraciones ni datos de producción, publicación realtime viva, comportamiento en la app, que «Hecho» deje la sugerencia en approved, ni el tratamiento de role = null en canCompleteStep.

### Respuesta del autor a la primera pasada (2026-11-01)
Texto del autor, no del gate. Verificado por el autor antes de aceptar los hallazgos 1, 2 y 3.

| Hallazgo | Respuesta | Dónde queda |
|---|---|---|
| 1. Deals ya cubiertos por tiempo real | **Acepto.** Verificado: `"setup"` está en `KEYS` (`use-live-pipeline.ts:6`), el hook está montado en `route.tsx:44` y `deals` está en la publicación (`0010_lead_intake.sql:57`). Los deals salen de CA-1 y entran en las excepciones de CA-2. La publicación viva no la comprobé | §3.1 (fila CA-5), §5, CA-1, CA-2, §14 |
| 2. Hueco más ancho; la guarda debe mirar insert/delete | **Acepto.** Verificado el inventario: `apollo.tsx:122-133`, `clay.tsx:161-172`, `parallel.tsx:142-145`, `icp-companies.tsx:172-184` insertan cuentas e invalidan solo `["accounts"]`. La guarda pasa a `insert`/`delete` en `accounts` y `deals` y `upsert` en `quotas`; los `update` salen. No he revisado `abm.tsx:60`, `fit-fields.tsx` ni `accounts.$id.tsx` más allá del aviso del gate: quedan fuera por ser `update` | §3.1, §3.3, CA-1, CA-2, U-1 |
| 3. El mock de `use-setup-guide.test.tsx:22` rompería | **Acepto.** Verificado: el mock devuelve solo `useSetup`. El ayudante va en un módulo nuevo `src/hooks/setup-invalidation.ts` | U-1, §13 |
| 4. CA-1 solo se prueba por texto | **Acepto.** Pruebas de comportamiento con `QueryClient` real para el ayudante, la cuota y la cuenta (éxito invalida, error no); Apollo, Clay, Parallel e ICP quedan por la guarda, y lo digo en CA-1. Pregunta final a la revisión (§15.7) | CA-1, U-1, §15.7 |
| 5. U-1 y U-2 no independientes | **Acepto.** Archivos de test separados y «U-2 depende de U-1» escrito | §12 |
| 6a. El trimestre cambia M-1 | **Acepto** | §4 |
| 6b. «Activas» no es `archived_at is null` | **Acepto.** Pasa a «no archivadas» y nueva P-6 para Fede sobre internas y de demo; no invento la lista | §4, §15 (P-6) |
| 6c. Fila G-3 del PRD | **Acepto.** Entra en alcance y en P-2 | §3.3, §5, §6, P-2 |
| 6d. Umbral de §8 | **Acepto.** «Siempre informa N» | §4, §8 |
| 7. SQL de M-1 | **Acepto.** `:quarter` pasa a `'2026-Q4'` con el aviso de cambiar fecha y trimestre; nota y consulta sobre filas duplicadas de `positioning` | §16 |
| 8. CA-4 y md5; documento fuera del repo | **Acepto.** Las cinco consultas se copian en §16 con los md5 literales | CA-4, §16 |
| 9. Contradicción sobre editar el original | **Acepto.** §6 dice que CA-5, P-2 y P-5 sí tocan el original (su §16, su cabecera) y el comentario `setup-guide.ts:2`; §5 lo recoge | §5, §6 |
| 10. P-1 agrupa nueve | **Acepto.** Se ofrecen «aceptar las nueve» y «aceptar salvo N» | P-1 |
| 11. Frases inexactas | **Acepto** las tres: «otra empresa», `OrgSwitcher` como enlace a /company, referencia «3.2» | §3.1, §3.2, §8 |
| 12. P-3 sin probar | **Sin cambio**: ya estaba declarada hipótesis y se mide antes de tocar | P-3, §16.3 |
| Huecos: rol nulo y fallo de lectura | **Acepto.** Dos casos nuevos, sin CA: el comportamiento ya está en el código (`setup-guide.ts:68-72`, `org-data.ts:29-31`) | §8 |

### Segunda pasada del gate (2026-11-01), copiada sin editar
Sobre `8535261`.

Veredicto: Cambios menores. No hay bloqueantes. Los 12 hallazgos de la primera pasada están bien contestados, pero 3 quedaron mal cerrados y la segunda pasada encuentra una contradicción nueva y escritores que siguen sin cubrirse. No ejecutó la suite (sin node_modules). Citas comprobadas a mano.

A. Primera pasada: 1 correcta y aplicada; 2 aceptado pero a medias (ver B1–B3); 3 correcta y aplicada (nuevo módulo `src/hooks/setup-invalidation.ts` no simulado); 4 «aceptado» pero el rojo sigue siendo trivial (ver B4); 5 aplicado; 6a–6d aplicados; 7 aplicado (ver B7); 8 aplicado (la consulta 4 del SDD añade md5(prosrc), no estaba en el original; válido pero conviene decirlo); 9 aplicado a medias (ver B5); 10 aplicado; 11 aplicado; 12 sin cambio es correcto; huecos de rol nulo y lectura fallida en §8, respaldados por `setup-guide.ts:68-72` y `org-data.ts:29-31`.

B1 Importante: el inventario de escritores sigue incompleto (el grep por línea no basta: apollo, clay e icp-companies escriben con .from("accounts") y .insert( en líneas distintas). Tres casos más: `src/routes/_authenticated/discoveries.tsx:97-99` «Añadir a Cuentas» llama a decideDiscovery, que inserta en accounts (`discoveries.functions.ts:49`) e invalida ["discoveries"], ["accounts"], ["leads"], no ["setup"]; `src/components/suggestion-deck.tsx:51` gesto «Hacer» ejecuta la acción en servidor (`agent.functions.ts:364-368`), con create_account (`proactive/detectors/product-usage.ts:40`) crea cuenta e invalida solo ["suggestions"] (suggestions.tsx:131 y suggestion-board.tsx:119 sí invalidan todo); `accounts.index.tsx:64-67` no invalida nada y el SDD (§3.1) lo mete en «invalidan solo ["accounts"]» (inexacto: hace navigate a la ficha). Lista de escritores cliente sin cubrir: metrics, accounts.index, apollo, clay, parallel, icp-companies, discoveries y suggestion-deck (este solo para create_account). Cubiertos por invalidar todo: account-import, import-review, new-deal, assistant-actions, ai-fill, onboarding/blocks, agent.tsx:174. Cubierto por tiempo real: won-deals-panel.tsx:177 y calls-deals-tabs.tsx:49. abm.tsx:60,64, fit-fields.tsx y accounts.$id.tsx:71,75 son update. Escritores de servidor (leads-ingest, lead-tasks.server, api/public/accounts.ts:74) no pueden invalidar en cliente; los de leads los cubre realtime; `api/public/accounts.ts:74` no. Cambio: añadir discoveries.tsx y suggestion-deck.tsx a CA-1/U-1 o decidir uno por uno excepciones con motivo; corregir frase de accounts.index; anotar en §14 que api/public/accounts.ts:74 queda fuera.

B2 Importante: la guarda de CA-2 no detecta escritores por función de servidor y no define su alcance. `src/lib/*.ts` también hace insert en accounts/deals (leads-ingest.ts, imports.functions.ts, agent/tools/core-write.ts) sin qc: acotar la guarda a src/components, src/routes y src/hooks. Los patrones multilínea exigen regex que cruce líneas. Para cerrar discoveries y deck hace falta lista de funciones de servidor que escriben (decideDiscovery, decideSuggestion, applySetupItems, decideAgentAction, undoImport) y exigir que su llamador invalide la guía o invalide todo. Debe exigir la llamada invalidateSetup( o invalidateQueries() sin argumentos, no solo el import. La excepción agent.tsx:174 sobra (no hace insert); la de account-import.tsx se evita si la guarda acepta invalidateQueries() sin argumentos. Sobre §15.7: para Apollo, Clay, Parallel e ICP la guarda basta si comprueba la llamada y no solo el import.

B3 Menor: U-1 sigue siendo grande; partir en U-1a (ayudante y hook), U-1b (cuota), U-1c (cuentas). create-account.test.ts es ambiguo: los cuatro sitios de inserción tienen formas distintas (por lote con account_plans, por filas, individual con navigate); di qué función se extrae y cuáles la usan.

B4 Importante: el hallazgo 4 no está resuelto del todo. §12 reconoce que las pruebas de comportamiento «fallan antes por inexistencia del módulo». `scripts/factory/fail-first.mjs:23-25` copia solo el archivo de test sobre la base, así que falla por import roto. La regla 5 (`GROUND-RULES.md:9`) exige rojo real. Cambio: extraer primero saveQuota y createAccount con el comportamiento actual en un commit previo que sirve de base; luego la prueba falla por aserción (espera ["setup"] invalidado y no lo está). Si prefieres no hacerlo, declara que el rojo real de CA-1 es solo el de la guarda U-2, que lee el código actual y falla de verdad. Nombres: `src/hooks/setup-invalidation.test.ts` y `src/lib/setup-invalidation.test.ts` comparten nombre base; renombra uno (p. ej. setup-write-guard.test.ts).

B5 Importante: contradicción nueva sobre editar el SDD original. La cabecera (línea 5) dice «no lo sustituye ni lo edita»; §6 dice «sí edita el SDD original (su §16 y su cabecera) y es lo único que se toca»; la dependencia del SDD universal está en el §13 del original (líneas 102 y 105) y en su cabecera (línea 5), no en su §16; el §16 es donde CA-5 registra decisiones, así que «lo único» tampoco es cierto. §6 dice que M-1 y M-2 del original quedan «Modificados», pero están en el §4 del original (líneas 23-25); no dice si se edita o solo se sustituye. Cambio: reescribir la línea 5 («lo extiende; solo se tocan su cabecera, §4, §13 y §16, y solo con aprobación de Fede»), corregir «§16» por «§13», decidir si el §4 se edita o se declara superado aquí.

B6 Menor: ediciones sin unidad que las haga (comentario de `setup-guide.ts:2`, fila G-3 del PRD, §13 y cabecera del original, CA-5). Añade una U-5 de documentación o di que las hace Fede.

B7 Menor: referencias de línea desfasadas. La condición done del paso cuota está en `setup-schema.ts:60-61` (no :61-62); quarterOf empieza en `metrics.ts:63` (no :62-64); §3.2 llama «formato/lint» a los cambios del relleno con IA pero `fec89c1` es un fix de comportamiento en ai-fill.tsx; no afecta a la guía, reescríbelo.

B8 Menor: la consulta 3 de §16 (P-3) no se puede ejecutar como descrita: la consulta 2 devuelve recuentos agregados, no una fila por empresa. Hace falta una consulta que una suggestions con el CTE s por org_id y por el paso de dedupe_key, devolviendo solo un recuento.

B9 Menor: U-3 y las consultas de §16 leen producción por el editor SQL de Lovable. GROUND-RULES.md prohíbe tocar producción salvo orden explícita de Fede en el chat. Añade «con orden de Fede, solo lectura».

Lo que está bien: SQL de M-1 coherente con `setup-schema.ts:49-66`; sin datos de cliente; sin cifras inventadas; alcance sin migraciones, RLS ni BASELINE_MAX.
No verificó: ejecución de pruebas/tipos/lint, estado de migraciones y datos de producción, realtime viva, md5 contra la base, que decideSuggestion ejecute create_account en producción, diff línea a línea desde b4e4a4e, que leads esté en la publicación realtime.

### Respuesta del autor a la segunda pasada (2026-11-01)
Texto del autor, no del gate. Verificados por el autor antes de aceptar: B1 (`suggestion-deck.tsx:51`, `agent.functions.ts:364-368`, `product-usage.ts:40`, `discoveries.functions.ts:49`), B2 (el alcance en `src/lib` ya inserta en servidor, p. ej. `routes/api/public/accounts.ts:74`), B4 (`scripts/factory/fail-first.mjs:20-25` copia solo el archivo de test) y B5 (original: cabecera línea 5, §13 líneas 102 y 105, §4 líneas 23-25).

| Hallazgo | Respuesta | Dónde queda |
|---|---|---|
| A. Estado de los 12 de la primera pasada | Aceptado. Lo de la consulta 4 con `md5(prosrc)`: es una consulta mía añadida, no del registro original; los `md5` esperados salen del resumen de ese registro | §16 |
| B1. Escritores sin cubrir | **Acepto.** Se suman `discoveries.tsx` y «Hacer» sobre `create_account` (`suggestion-deck.tsx`) a CA-1, se corrige la frase de `accounts.index.tsx` (no invalida nada: navega) y `api/public/accounts.ts:74` se anota como fuera de alcance | §3.1, §5, §6, CA-1, §14 |
| B2. Alcance y forma de la guarda | **Acepto.** La guarda se acota a `src/components`, `src/routes` (sin `api`) y `src/hooks`; exige la llamada y no el import; acepta `invalidateQueries()` sin argumentos; incluye la lista de funciones de servidor que escriben; quito las excepciones de `agent.tsx` y `account-import.tsx`. Para Apollo, Clay, Parallel e ICP la guarda basta (respuesta a §15.7) | CA-2, §15 |
| B3. U-1 grande y ambigua | **Acepto.** U-1a, U-1b y U-1c. `createAccount` se extrae solo de `accounts.index.tsx:62-68`; los demás sitios solo llaman al ayudante | §12 |
| B4. Rojo trivial | **Acepto y elijo declarar**, no extraer antes: el rojo real de CA-1 y CA-2 es el de `setup-write-guard.test.ts`; las pruebas de comportamiento son de regresión. Razón: un commit previo de extracción añade un refactor sin valor propio. Renombrado el archivo de la guarda | §12 (nota), CA-1, CA-2 |
| B5. Contradicción sobre editar el original | **Acepto.** Cabecera reescrita; se tocan solo su cabecera, su §13 (no §16) y su §16 para decisiones; su §4 no se reescribe: M-1 y M-2 se marcan como superadas aquí | cabecera, §6 |
| B6. Ediciones sin unidad | **Acepto.** U-5 de documentación, con aprobación de Fede | §12 |
| B7. Líneas desfasadas y «formato/lint» | **Acepto.** `setup-schema.ts:60-61`, `metrics.ts:63-65`; `fec89c1` descrito como arreglo de comportamiento que no afecta a la guía | §3.2, §4, §16 |
| B8. Consulta de P-3 | **Acepto.** Consulta propia con unión por empresa y paso; el recuento es una cota superior | §16.3 |
| B9. Producción solo con orden de Fede | **Acepto** | U-3, §14 |

### Revisión del autor (no es informe del gate)
Mi propio subagente leyó `7b30db0` y no cuenta como gate, porque el autor no califica su trabajo. Sus hallazgos que verifiqué se aplicaron arriba (Descubrimientos, borrar ICP, SQL con `~ '\S'`, plantilla de segmentos sembrada en `0002_multitenant_organizations.sql:204`). Sin aplicar, para que Fede los pese: `FlowStrip` (#53, `flow-strip.tsx`) es una tercera superficie de «qué viene después» en `/leads`, `/accounts`, `/deals` y `/metrics` (P-4 solo cita dos guías de Inicio); `strategy-positioning.ts` repite la regla de «completo» de posicionamiento (**no la encontré con grep, no verificada**); el PRD mantiene «depende de 1» en la fila 3 de su orden (`PRD-20261028-ux-onboarding-coherencia.md:82`), que P-5 obliga a enmendar.

## 18. Delta de implementación (lo rellena el agente al entregar)
Sin entrega todavía. Estado del ticket NK-0008 en el ledger: `LOGGED`; no lo promuevo (lo hace `nokko-tracker` tras la aprobación de Fede).
