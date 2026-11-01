# SDD-20261101-strategy-setup-closeout · [Mejora] Cierre de «Configura tu estrategia» que guía al siguiente paso (NK-0008)

**Tipo:** Mejora · **Prioridad propuesta:** Media (lo grande ya está entregado; faltan un hueco de CA-5, la línea base y las firmas)
**Estado:** Borrador · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-11-01
**PRD:** `docs/prd/PRD-20261028-ux-onboarding-coherencia.md` (G-3) · **Depende de:** `SDD-20261025-strategy-setup-guided-next-step` (este SDD lo **extiende**; no lo sustituye ni lo edita)
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
| CA-2 nada pendiente → qué hace NOKKO y qué te toca | **Hecho, vigente** | `setup-guide.ts:152` y `COMPLETE_TEXT` en `:159-160` |
| CA-3 reglas fijas, igual en pantalla y Agente | **Hecho, vigente** | Orden de `SETUP_ITEMS` (`src/lib/setup-schema.ts:49-66`, `next` en `:74`); detector `src/lib/proactive/detectors/setup-incomplete.ts:11-12`; Agente `src/lib/agent/tools/core-read.ts:203-204` |
| CA-4 Completado/Pendiente/Pospuesto con una definición de «completo» | **Hecho; la premisa «definición única del SDD universal» está obsoleta** | `guideState` `setup-guide.ts:98-111`; la regla de «completo» vive solo en `setup-schema.ts:49-66`. El catálogo universal no tiene regla de «completo» (`src/lib/field-catalog.ts` no la contiene; el SDD universal la prometía en su §5 y sus U-1 a U-4 no la entregaron). Ver P-5 |
| CA-5 progreso al día sin recarga | **Parcial: hueco real en 3 pantallas** | Aviso de «paso pendiente de nuevo» y refresco: `src/hooks/use-setup-guide.ts:62-82`. Invalidan `["setup"]`: `icp-editor.tsx:227`, `strategy/motions.tsx:99,125`, `strategy/positioning.tsx:77,154`. **No lo hacen**: guardar la cuota (`src/routes/_authenticated/metrics.tsx:114-116`, solo `["metrics"]`), crear una cuenta (`src/routes/_authenticated/accounts.index.tsx:64-67`) y añadir un deal desde la ficha (`src/components/account/calls-deals-tabs.tsx:49-51`). El QueryClient no tiene valores por defecto propios (`src/router.tsx:6`): la barra lateral se queda con el dato viejo hasta que otro componente remonte la consulta o la ventana recupere el foco **[Por verificar en la app]** |
| CA-6 aviso tras 1 día sin actividad, en Agente e Inicio | **Hecho, vigente** | `INACTIVITY_MS` `setup-guide.ts:162`, `nudgeDue` `:165-167`; actividad solo de personas `src/lib/org-data.ts:68-90` con respaldo a la fecha de alta; Inicio `src/routes/_authenticated/home.tsx:73` y `src/components/onboarding/home-card.tsx:34`; Agente `src/components/agent.tsx:208` |
| CA-7 posponer hasta la fecha elegida | **Hecho, vigente** | `parseSnoozeDate` `setup-guide.ts:209`; tabla y políticas `drizzle/migrations/0062_setup_step_snoozes.sql:32-54`; clave nueva al vencer `setup-incomplete.ts:20-23`; reapertura `org-data.ts:138,162-163` |
| CA-8 quién puede completar el paso | **Hecho, vigente** | `STEP_ROLES` `setup-guide.ts:15-24`, `whoCanText` `:132`, `suggestionAssignee` `:180`; base de datos `0062…:32-46` |
| CA-9 Agente ofrece el siguiente paso | **Hecho; sin prueba de componente** | `agent.tsx:208`; herramienta `core-read.ts:193-209` |
| CA-10 Agente confirma y propone el siguiente | **Hecho; la parte del modelo solo se verifica a mano** | Panel: `use-setup-guide.test.tsx` «CA-10» (corre: ver 3.3); texto del modelo: sin prueba posible sin llamar al modelo |

### 3.2 Lo que cambió en `main` desde la aprobación (2026-10-27) y su efecto
- **Quitar la UI multiempresa (#53, `278159b`).** No choca. La guía lee `me.currentOrg` (`use-setup-guide.ts:33`) y todo es por empresa. #53 toca la tarjeta «Primeros pasos» (`src/lib/guide.ts`, `src/components/home/guide-card.tsx`), que es **otra guía** distinta de «Configura tu estrategia». El selector de empresa sigue montado (`src/routes/_authenticated/route.tsx:82`).
- **NK-0006/0018/0019/0020/0035 (país y tamaño).** No afectan. Normalizan `accounts.size` y `accounts.country`; el paso `icp` exige texto en `icp_profiles.company_size`, concepto `tamano_descripcion`, texto libre (`field-catalog.ts:299-302`, `setup-schema.ts:52-53`). El paso `accounts` solo cuenta filas (`setup-schema.ts:63`).
- **NK-0038/0040/0041/0042/0036 y el motor de sugerencias.** No afectan. `setup_incomplete` no es estratégica: se sincroniza aparte (`org-data.ts:142-155`) y `strategy-positioning.ts:16` ya cede ante `setup_incomplete:positioning`. Los cambios de aceptar con formulario son solo de `experiment` y `commercial_action`.
- **NK-0046 (módulo obsoleto).** Sin relación con la guía.
- **Ficheros de la guía desde `b4e4a4e`:** solo cambian por fusiones de las sugerencias estratégicas (`org-data.ts`) y por formato/lint del relleno con IA. Sin cambios de comportamiento de la guía **[leído en `git log`; no he comparado el diff línea a línea]**.
- **Base de datos.** El registro `APLICAR-MIGRACIONES-GUIA.md` (carpeta de trabajo, fuera del repo) dice que 0062 y 0064 a 0067 se aplicaron en producción el 2026-10-27 con comprobación posterior. El SDD NK-0041 midió el 2026-11-01 que 0068 a 0070 están aplicadas y 0071 a 0073 no. Eso encaja, pero **no he vuelto a medirlo** (ver CA-4).
- **Pruebas.** Sobre `origin/main` (`9feef64`) pasan los 7 archivos de la guía: `setup-guide`, `setup-snooze-suggestions`, `setup-activity`, `org-data-setup`, `proactive`, `use-setup-guide`, `field-coverage`: 117 pruebas. `agent-tools.test.ts`: 71 pruebas. `migrations.pg.test.ts` **no corre en este entorno** (falta `@electric-sql/pglite`); las migraciones 0062 a 0067 siguen sin esa comprobación aquí.

### 3.3 Qué queda realmente abierto
1. CA-5: tres pantallas sin refresco (3.1).
2. Línea base de la sección 4 original: sigue «sin dato», y una de las dos métricas no es medible tal como está escrita (sección 4).
3. Sección 14 del original (9 propuestas) y sección 16 (registro de decisiones) sin firmar. Están en producción.
4. Recorrido manual de CA-10 y de la app: no hecho (el original lo declara «no verificado»).
5. Sospecha sin comprobar sobre «Hecho» en la tarjeta (P-3).

**Apuesta declarada:** no hay datos de uso; la prioridad se apoya en el código de `main`.

## 4. Resultado buscado
Las dos métricas del SDD original, replanteadas para que se puedan medir:
- **M-1.** % de empresas activas (`organizations.archived_at is null`) con al menos 7 días de antigüedad que **hoy** tienen los 8 pasos completos. Fuente: base de datos, con la consulta de la sección 16. Línea base: **sin dato** (no medida). Sustituye a «completan en 7 días»: el estado «completo» se deriva de los datos y no guarda cuándo se completó cada paso, así que «en 7 días» no se puede reconstruir hacia atrás.
- **M-2.** «Tiempo desde terminar un paso hasta iniciar el siguiente»: **no medible hoy** (no hay registro de eventos de la guía; el original ya decía «no medido»). Propuesta: retirarla hasta que exista ese registro. No crear tabla solo para esto (P-2).

## 5. Alcance
**Incluye:** refresco del progreso en Métricas (cuota), Cuentas (nueva cuenta) y ficha de cuenta (nuevo deal); prueba de guarda para que no vuelva a pasar; medición de línea base y del estado de las migraciones con consultas de solo lectura; registro de las decisiones del original; recorrido manual.
**No incluye** (límite que el brief copia a «Movimientos prohibidos»):
- Migraciones, RLS, `drizzle/`, `BASELINE_MAX`.
- Cambiar el orden de los pasos, los textos de la guía, los roles o el umbral de 1 día.
- Fusionar o rediseñar las tarjetas de Inicio («Primeros pasos», `RoadmapCard`, `GuideOffer`): ver P-4.
- Una regla universal de «completo» para ICP, posicionamiento o empresa: ver P-5.
- Tabla de eventos de la guía y la métrica M-2.
- Cualquier cambio en Lovable ni migración de Lovable (salida pausada).

## 6. Cambios de comportamiento (delta)
**Añadido:** el progreso se actualiza al guardar la cuota, crear una cuenta o añadir un deal desde la ficha; una prueba de guarda.
**Modificado:** M-1 y M-2 del original (sección 4). La dependencia del SDD universal pasa a «consume `setupStatus`» (P-5).
**Eliminado:** nada.

## 7. Historias y criterios de aceptación
### H-1: Como founder, quiero que el progreso de «Configura tu estrategia» se actualice al instante cuando avanzo desde cualquier pantalla, para no pensar que no ha contado.
- **CA-1** CUANDO guardo la cuota del trimestre en Métricas, creo una cuenta en Cuentas o añado un deal desde la ficha de una cuenta, el sistema DEBE invalidar el estado de la guía (`["setup"]` y las consultas de la guía) en ese mismo gesto, sin recarga ni cambio de ventana · cubre G-3 (CA-5 del original) · prueba: `src/hooks/use-setup.test.tsx` (nuevo: el ayudante `invalidateSetup` invalida las claves de la guía) y `src/lib/setup-invalidation.test.ts` (nuevo: lee los tres archivos y exige que usen el ayudante).
- **CA-2** El sistema DEBE fallar la comprobación automática SI un componente escribe en una de las tablas que lee `loadSetupData` (`segments`, `icp_profiles`, `positioning`, `messaging_pillars`, `quotas`, `accounts`, `deals`) y no invalida la guía, salvo una lista de excepciones con motivo (el panel del Agente ya invalida todo: `agent.tsx:174`) · cubre G-3 · prueba: `src/lib/setup-invalidation.test.ts` (el mismo archivo; se escribe con las excepciones nombradas).

### H-2: Como Fede, quiero cerrar NK-0008 con una cifra de partida y las decisiones firmadas, para no arrastrar premisas sin medir.
- **CA-3** El ticket NO DEBE pasar a entrega mientras M-1 no tenga cifra medida con fuente y fecha, o «sin dato» con su motivo, anotado en la sección 18 · cubre G-3 · prueba: no automatizable; lo comprueba el gate al revisar la sección 18 (manual).
- **CA-4** El estado de las migraciones 0062 y 0064 a 0067 en la base de producción DEBE coincidir con lo esperado por las cinco consultas de solo lectura de `APLICAR-MIGRACIONES-GUIA.md` (tabla, función y 4 políticas; 7 columnas y 7 disparadores; `company_diagnosis`; los dos `md5` de las funciones; 7 índices), medido con fecha en la sección 18 · cubre G-3 · prueba: no automatizable (producción); consulta de solo lectura.
- **CA-5** Las decisiones 1 a 9 de la sección 14 del original DEBEN quedar registradas con fecha y «Aceptado / Cambios pedidos» en su sección 16 (la edita Fede) · cubre G-3 · prueba: no automatizable.

## 8. Casos límite y errores
- La cuota se guarda con error: no se invalida; solo en éxito (CA-1). Ya es el patrón de `metrics.tsx:115`.
- Crear una cuenta con duplicado confirmado: el refresco va tras el `insert` correcto, no tras el aviso (CA-1).
- Otra empresa: las claves llevan `orgId` (`use-setup.ts:11`); invalidar `["setup"]` por prefijo cubre la empresa actual sin tocar a otras (CA-1).
- Una escritura nueva en una de las 7 tablas que olvide invalidar: la prueba de guarda lo detecta (CA-2).
- Si M-1 sale con muy pocas empresas, se informa el número y no el porcentaje (CA-3).

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
| U-1 | Ayudante `invalidateSetup(qc)` en `src/hooks/use-setup.ts`, usado por `useSetupGuide.refresh` y por las tres pantallas | CA-1 | `src/hooks/use-setup.test.tsx` (falla: el ayudante no existe) y `src/lib/setup-invalidation.test.ts` (falla: las tres pantallas no lo usan) |
| U-2 | Prueba de guarda con lista de excepciones con motivo | CA-2 | `src/lib/setup-invalidation.test.ts` (falla hoy por las tres pantallas; pasa al cerrar U-1) |
| U-3 | Medición de M-1 y de las cinco comprobaciones de migraciones, con consulta de solo lectura ejecutada por quien tenga acceso a Lovable Cloud (no el agente que escribe código) | CA-3, CA-4 | No aplica (medición) |
| U-4 | Recorrido manual (`nokko-walkthrough`): CA-10 con el Agente, CA-5 en las tres pantallas, CA-9 | CA-1 | No aplica (manual) |

Orden: U-1 y U-2 juntas (misma rama); U-3 en paralelo; U-4 al final. Una prueba de guarda no puede «fallar antes» sin U-1 en el sentido estricto de CA nuevo: lo hace porque nombra las tres pantallas que hoy no cumplen.

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- `useSetupGuide.refresh` (`use-setup-guide.ts:82`) ya invalida `["setup"]` y las claves de la guía; extraerlo a un ayudante evita copiar claves en cada pantalla.
- `["setup"]` se invalida por prefijo; no hace falta pasar `orgId`.
- La prueba de guarda sigue el patrón de `field-coverage.test.ts` y `tracked-columns.test.ts` (leen archivos fuente con `readFileSync`).
- Alternativa descartada: invalidar todo con `qc.invalidateQueries()` en cada pantalla (lo hace el Agente en `agent.tsx:174`). Es más barato de escribir y repinta todas las pantallas por cada gesto.
- Alternativa descartada: `MutationCache` global con `onSuccess`. Cambia el contrato de todas las mutaciones del producto por un hueco de tres pantallas.

## 14. Riesgos y dependencias
- Una prueba que lee código fuente se rompe si se mueve el archivo; la lista de excepciones debe llevar su motivo.
- U-3 necesita acceso a Lovable Cloud (SQL editor, solo lectura). Si no se tiene, CA-3 y CA-4 quedan «sin dato».
- Número de pasos y orden: sin cambio. Un paso nuevo requiere su entrada en `STEP_ROLES` y `STEP_WHY` (`src/lib/AGENTS.md`).

## 15. Preguntas para Fede y para la revisión técnica
1. **P-1 · ¿Registras como «Aceptado» las decisiones 1 a 9 de la sección 14 del original tal y como están en `main`?** Recomiendo **sí**. Están en producción desde 2026-10-27 (migraciones) y deshacerlas cuesta más que aceptarlas. Las que son realmente tuyas: 14.4 (`BASELINE_MAX` 992, hoy `src/lib/field-baseline.ts:98`) y 14.5 (función `company_diagnosis`, usada en `onboarding/home-card.tsx:21`). La 14.9 queda resuelta si CA-4 confirma las cinco comprobaciones. Si prefieres otra opción en alguna, dímela y sale de este SDD como cambio aparte.
2. **P-2 · ¿Cambias M-1 y retiras M-2?** Recomiendo **sí**. «Completan en 7 días» no se puede reconstruir (el estado se deriva, no guarda fecha) y M-2 no tiene origen de datos. Crear una tabla de eventos solo para medir esto añade esquema y RLS por una métrica; si algún día quieres M-2, que sea otro SDD con su propio registro.
3. **P-3 · ¿Compruebo antes de tocar nada qué pasa con «Hecho» (deslizar a la derecha) en la tarjeta `setup_incomplete`?** Sospecha, **no comprobada**: esa decisión la deja `approved`; el paso sigue pendiente; la clave se reemite igual; el `upsert` la ignora por duplicada (`org-data.ts:155`) y solo se reabren las `resolved` (`org-data.ts:162-163`). Resultado posible: esa sugerencia no vuelve a salir, aunque la guía de la barra lateral sí sigue. Recomiendo **medir primero**: cuántas sugerencias `setup_incomplete` hay en `approved` con su paso aún pendiente (consulta 3 de la sección 16). Si son 0, no se toca (mismo criterio que NK-0043, aplazado con 0 casos). Si hay alguna, SDD aparte.
4. **P-4 · ¿Las dos guías de Inicio («Primeros pasos» y «Configura tu estrategia») se arreglan aquí?** Recomiendo **no**. Las dos recomiendan «tu siguiente paso» en la misma pantalla (`home.tsx:66,72,73`), pero la primera es de onboarding y la tocó #53. Ordenarlas es decisión de diseño de Inicio, no cierre de NK-0008. Que se recoja en el SDD de onboarding de la serie.
5. **P-5 · ¿Quitamos del original la dependencia dura del «SDD universal de campos (definición única de completo)»?** Recomiendo **sí**: el universal no entregó esa regla y `setup-schema.ts:49-66` es hoy la única definición de «completo» de los 8 pasos; NK-0008 la consume tal cual. La regla universal para ICP, posicionamiento y empresa se reabre en el ticket del SDD universal si Fede lo quiere. Dejar la dependencia escrita bloquearía NK-0008 por algo que no va a llegar.
6. **Para la revisión técnica:** ¿es suficiente una prueba de guarda por lectura de código fuente (CA-2) o prefieres una prueba por pantalla con `supabase` simulado? Mi recomendación es la primera por coste; la segunda prueba el comportamiento real.

## 16. Pendiente de verificar
Consultas **propuestas, no ejecutadas** (solo lectura, recuentos, sin datos de clientes; SQL editor de Lovable Cloud; el rol del editor ve todas las empresas, el cliente de la app con RLS solo vería la actual):

1. **Estado de migraciones (CA-4):** las cinco consultas de `APLICAR-MIGRACIONES-GUIA.md`, líneas 27 a 31, con los resultados esperados que ahí constan.
2. **Línea base M-1 (CA-3).** `:quarter` es el valor de `quarterOf(new Date())` (`src/lib/metrics.ts:63`) **[Por verificar su formato antes de ejecutar]**.
```sql
with o as (
  select id from organizations
  where archived_at is null and created_at <= now() - interval '7 days'
), s as (
  select o.id,
    exists (select 1 from positioning p where p.org_id = o.id and not exists (
      select 1 from unnest(array['best_customers','alternatives','differentiation','value','trend','target_customer','need','category','key_benefit','competitive_alternative','differentiator','one_liner','elevator_pitch']) k
      where coalesce(btrim(to_jsonb(p) ->> k), '') = '')) as positioning,
    exists (select 1 from icp_profiles i where i.org_id = o.id and coalesce(btrim(i.industries),'') <> '' and coalesce(btrim(i.company_size),'') <> '' and coalesce(btrim(i.why_fit),'') <> '' and coalesce(btrim(i.anti_icp),'') <> '') as icp,
    (exists (select 1 from segments g where g.org_id = o.id) and not exists (select 1 from segments g where g.org_id = o.id and g.acv_min is null and g.acv_max is null)) as segments,
    (exists (select 1 from segments g where g.org_id = o.id) and not exists (select 1 from segments g where g.org_id = o.id and (g.win_rate_target is null or g.ae_quota is null))) as benchmarks,
    ((select count(*) from messaging_pillars m where m.org_id = o.id and coalesce(btrim(m.title),'') <> '' and coalesce(btrim(m.message),'') <> '') >= 3) as pillars,
    exists (select 1 from quotas q where q.org_id = o.id and q.period = :quarter and q.amount > 0) as quota,
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
3. **P-3:** `select count(*) from suggestions s where s.detector = 'setup_incomplete' and s.status = 'approved';` y, de esas, cuántas tienen su paso aún pendiente (se cruza con la columna `p_<paso>` de la consulta 2; el paso es la segunda parte de `dedupe_key`).
4. **Que la app cargue sin error con la base actual** (Inicio y «Configura tu estrategia»): el registro de migraciones dice que no se comprobó. Lo cubre U-4.
5. **Efecto visible de CA-1 en el original:** que el dato viejo se vea de verdad en la barra lateral hasta recargar. Lo cubre U-4.
6. **Que `migrations.pg.test.ts` pase** en un entorno con PGlite; aquí no corre.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Un agente `nokko-gate` con contexto fresco lee este SDD y el código, y devuelve su informe. El coordinador lo copia aquí sin editarlo. El gate no aprueba el SDD: informa; la aprobación es de Fede.
- Veredicto del gate: pendiente
- CA sin prueba posible o sin G-n: pendiente
- [Por verificar] que sigue sin comprobarse: pendiente
- Contradicciones con el código o con decisiones previas: pendiente
- Lo que esta revisión NO demuestra: pendiente

## 18. Delta de implementación (lo rellena el agente al entregar)
Sin entrega todavía. Estado del ticket NK-0008 en el ledger: `LOGGED`; no lo promuevo (lo hace `nokko-tracker` tras la aprobación de Fede).
