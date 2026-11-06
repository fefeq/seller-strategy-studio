# SDD-20261030-money-moment-notices · [Mejora] Avisos por momentos de dinero

**Tipo:** Mejora · **Prioridad propuesta:** Media
**Estado:** Aprobado (v5.2, aprobada por Fede el 2026-10-31; la v5.2 no la ha revisado ningún gate: v5 más los parches de la quinta y la sexta revisión) · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-10-30
**Ticket:** NK-0030 · **PRD:** No aplica (mejora acotada; contexto en `docs/prd/PRD-20261030-gtm-control-tower.md`) · **Depende de:** — (respuestas y reservas dependen del SDD-4, aún sin redactar)
**Base de trabajo:** `origin/main`, no `feat/software-factory` (esta rama está desfasada y no tiene PGlite; ver §3 y §14).

> Un SDD dice cómo se verifica que está bien hecho. Cada criterio de aceptación (CA-n) debe poder tener una prueba automática que lo nombre.
> Al no haber PRD, los objetivos G-n se definen en §4 y cada CA cita el suyo.

## 1. Resumen
Hoy un aviso de NOKKO significa «terminó una tarea en segundo plano». Esta mejora añade un segundo tipo, «momento de dinero»: cuando un lead llega a SQL o un deal queda Ganado, por cualquier camino que lo escriba, un trigger en la base de datos (como el que ya existe para los trabajos, `notify_job_end`) crea un aviso para los líderes y el responsable.

Es deliberadamente pequeño:
- **El texto del aviso es fijo** («Hay leads nuevos en SQL», «Hay deals nuevos como Ganados») y apunta a la lista. No lleva nombre de empresa ni de deal, ni recuento.
- **Un aviso por persona, tipo y empresa en cada hora natural**: el primer evento avisa y los siguientes de esa misma hora no.
- **El aviso no se actualiza.** En la app sale al instante; en Telegram, en la tanda horaria que ya existe.

**Decisiones de Fede (2026-10-30):**
- Destinatarios: Owner, Sales Leader y el responsable del lead o deal.
- Va antes del SDD-4 como v1; el SDD-4 añadirá respuestas y reservas reutilizando `money`.
- Arquitectura: trigger en la base de datos para todos los caminos, con o sin aprobación; entrega a Telegram por la tanda horaria.
- Lotes: un aviso por hora, sin actualización ni recuento.
- «Reciente» son **24 horas** (no hay medición detrás, se eligió entre opciones) y **solo se aplica a los deals**: un deal con cierre de hace más de 24 h no avisa. Un lead que llega a SQL avisa siempre, aunque su fecha de alta sea antigua (decisión de Fede, 2026-10-31).
- «Deal en riesgo» sale de este SDD y pasa a NK-0031.
- Alcance mínimo propuesto por el gate (v5): triggers por fila con `WHEN`, título fijo, tanda de 12 h con comprobación de pertenencia.

## 2. Problema y para quién
Quien lleva ventas (Owner y Sales Leader) y el responsable de cada lead o deal reciben avisos por Telegram sobre el trabajo de NOKKO, no sobre el negocio. Un deal ganado o un lead que pasa a SQL solo se ve entrando a la app o en el email de las 8:00.

## 3. Evidencia y por qué ahora
Leído el 2026-10-30 en `seller-strategy-studio` (checkout `feat/software-factory`, desfasado de `origin/main`; las líneas pueden moverse). Las marcadas «(gate)» las comprobó la revisión técnica independiente (§17), no quien redactó. Lo no comprobado va marcado.
- `notifications.kind` solo admite `done`, `failed`, `needs_decision` y `autopilot` (CHECK en línea, `drizzle/migrations/0049_notifications_center.sql:13`); `title` ≤ 300, `body` ≤ 1000, `link` ≤ 500 (`:14-16`). `authenticated` solo tiene `select` y `update` (`:21`); insertar exige `service_role` o una función `security definer`. `notifications.user_id` no tiene clave ajena (gate).
- Precedente: `notify_job_end` es un trigger `security definer` que inserta en `notifications` (misma migración). `0050_background_jobs_all_actions.sql:1-8` es precedente del **método** (soltar y recrear un CHECK de `kind`), en otra tabla (`background_jobs`).
- Entrega a Telegram en `src/lib/notices.server.ts`: `deliver` (privada, envía en serie, marca `telegram_sent_at` solo si envía y no comprueba que la persona siga en la empresa, `:11-37`) y `flushHeldNotices` (`:48-50`: `telegram_sent_at` vacío, últimas 12 h, orden ascendente, máximo 300; la llama el trabajo proactivo, `src/routes/api/public/jobs/proactive.ts:27`). El silencio por defecto es 22→8 (10 h, `jobs.ts:102`), que cabe en las 12 h.
- `telegramWorthy` (`src/lib/jobs.ts:128-133`): `all` ya devuelve verdadero, `decisions` y `off` falso; en «Solo lo importante» entran `failed`, trabajos de una lista y `autopilot`. Los niveles se llaman «Todo lo que termine», «Solo lo importante», «Solo lo que necesita mi decisión» y «Nada por Telegram» (`jobs.ts:103-108`, gate). Las aserciones de `src/lib/jobs.test.ts:79-89` no mencionan `money`.
- La app escucha solo INSERT de `notifications`: `src/components/background.tsx:99-104` (toast de 15 s, también para quien hizo el cambio) y `src/components/notification-center.tsx:37`. La etiqueta de `kind` está en línea en `notification-center.tsx:17`; `notice-prefs.tsx:72` define «Solo lo importante» sin `money`.
- La ruta de escritura no es única: un lead llega a SQL por al menos nueve caminos y un deal queda Ganado también sin aprobación (`src/components/won-deals-panel.tsx:174-178`, `src/lib/leads-ingest.ts:134-157`) (gate). La importación escribe fila a fila, cada fila en su transacción (`src/lib/leads.functions.ts:30-34`, hasta 200 filas por `src/lib/leads.ts:330`; `src/lib/imports.functions.ts:68-73`).
- `leads_stage` (BEFORE por fila, `drizzle/migrations/0012_lead_funnel.sql:54-84`, trigger creado en `:85`) fija `stage_entered_at` (dato que el aviso ya no usa: los leads avisan sin mirar fechas, §7). La ingesta pasa `created_at` si el CSV trae fecha (`leads-ingest.ts:72,101`), por eso un lead puede llegar a SQL con alta antigua (§8) (gate).
- `deals_track` (AFTER por fila; el trigger se crea en `0001_gtm_strategy_positioning_revops_abm.sql:134` y el UPDATE de `closed_at` está en `0002_multitenant_organizations.sql:175`, dentro de la función) rellena `closed_at` solo si está vacío; nada lo borra al reabrir; un deal insertado ya como `won` por agente o MCP queda con `closed_at` nulo. `0023` y `0024` son comentarios y no demuestran qué hay en la base viva (gate).
- **Base viva (leída el 2026-10-31 por Claude, solo SELECT sobre el catálogo, con el conector de Lovable, proyecto «Seller Strategy Studio» `284b5305-78bc-41f2-a9bb-09c2b2fd1faf`; sin datos de clientes):**
  - PostgreSQL **17.11** (la réplica de PGlite del gate era la 18.6).
  - Triggers de `deals`: `deals_audit` (`set_audit`), `deals_lines_guard`, `deals_slip` (`count_slips`), `deals_stage_check` (BEFORE INSERT OR UPDATE OF stage), `deals_stamp_human_edit`, todos BEFORE por fila, y `deals_track` (AFTER por fila). De `leads`: `leads_audit` y `leads_stage`, ambos BEFORE. **`notifications` no tiene ningún trigger.** `deal_lines_sync` **no es** un trigger de `deals` ni de `leads` (no se comprobó en `deal_lines`).
  - `notifications_kind_check` existe con ese nombre: `CHECK (kind = ANY (ARRAY['done','failed','needs_decision','autopilot']))`; también `notifications_title_check` (≤300), `notifications_body_check` (≤1000) y `notifications_link_check` (≤500). `deals` no tiene un CHECK de etapa: la validación es el trigger `deals_stage_check`.
  - `deal_stages_check1` fija `CHECK (kind <> 'won' OR key = 'won')`: la clave `won` es fija en producción.
  - RLS de `leads` y `deals`: `SELECT` y `UPDATE` con `org_id = current_org() AND is_org_member(org_id)`, `INSERT` con `is_org_member(org_id)`, `DELETE` solo `owner`. Cualquier miembro de la empresa activa lee todo. `notifications` solo tiene `own read` y `own mark read`: **no hay política de INSERT**, así que insertar exige `service_role` o una función `security definer`.
  - `lead_stage_change` en producción **difiere de `0012`**: al pasar a `opportunity` crea el deal con `stage` y `probability` nulos (la `0012` usaba `'discovery'` y 10); el trigger `deals_stage_check` lo completa antes de que el nuestro lo vea. `track_deal_changes` coincide con `0002` salvo que escribe también `org_id` en `deal_stage_history`: sigue sin estampar `closed_at` en una inserción y solo lo rellena si estaba vacío.
- RLS: `leads` y `deals` dejan leer a todo miembro de la empresa activa (`0012:41-42`; bucle de `0002:119-125`). `app_role`: `owner`, `sales_leader`, `marketing`, `sdr`, `ae`, `se`, `cs`, `deal_desk`, `enablement` (`0000_migration.sql:1`) (gate). `leads.owner_id` está en `0012:16` y `deals.owner_id` en `0000:117`, sin clave ajena; `organizations.archived_at` existe (`0056_org_lifecycle.sql:2`).
- En `origin/main` hay PGlite: `package.json:86`, `src/test/pg-harness.ts` (trae `organizations`, `org_members`, `current_org`, `is_org_member`, `has_org_role`, `set_audit`, `auth.uid` y roles, `:21-22,120`; faltan `archived_at`, `leads`, `deals`, `deal_stage_history`, `notifications` y un usuario `sales_leader`) y 6 `*.pg.test.ts` en `src/lib/` que definen sus tablas dentro del propio test (p. ej. `strategy-f0.pg.test.ts`, con `// @vitest-environment node`) (gate). La réplica no es la base real.
- No hay ruta de lista filtrada: `/leads` acepta `lead`, `late`, `orden` y `vista` (`leads.index.tsx:29-34`); `/deals` solo `deal` (`deals.tsx:35-37`) (gate).
- `field-baseline.ts:2-3` exige catalogar toda columna nueva (`BASELINE` en `:95`, techo `BASELINE_MAX` en `:98`); `field-catalog.ts` no tiene concepto para `dedupe_key`. `types.ts` es un fichero generado (gate).
- NOKKO no recibe hoy respuestas de email ni reservas de calendario (`src/routes/api/public`: `accounts`, `apollo`, `inngest`, `jobs`, `leads`, `telegram`).
- Línea base de uso de Telegram, volumen de leads en SQL y deals ganados por semana: **sin dato**.
- Coste del trigger en producción: **sin medida**. El gate solo comprobó en PGlite que un lote de 20.000 filas llama a la función una vez por fila con transición y ninguna sin ella; no hay archivo de evidencia, así que no se cita ninguna cifra.

## 4. Resultado buscado
- **G-1** Quien lleva ventas y el responsable se entera, en la app y en Telegram, de que hay leads que llegaron a SQL.
- **G-2** Lo mismo para deals que quedan Ganados.
- **G-3** Sin ruido ni riesgo: un aviso por hora, respetando la preferencia de cada persona y el silencio nocturno, sin avisos de deals con cierre histórico, y sin ningún dato del lead o del deal en el texto.
- Métrica de éxito: por definir con Fede (**sin dato** de partida; no se estima ninguna cifra).

## 5. Alcance
**Incluye:**
- Tipo de aviso `money` y su regla en `telegramWorthy`.
- Triggers por fila con `WHEN` en `leads` (entra en SQL) y en `deals` (queda Ganado), por inserción y por actualización, desde cualquier camino.
- Un aviso por persona, tipo, empresa y hora, con texto fijo y enlace a la lista.
- Columna `dedupe_key` en `notifications`, y su alta en el catálogo de campos (`ConceptId`, binding y `SHOWN_IN`) y en `types.ts` (orden en §10).
- Comprobación de pertenencia en la tanda de Telegram (`org_id` en `COLS` y en el tipo `Notice`).
- Réplica de las tablas y funciones que falten, dentro del propio test de PGlite (U-1); no se toca `build()`.
- Cambios de texto sin criterio propio: etiqueta «Dinero» en `notification-center.tsx`, definición de «Solo lo importante» en `notice-prefs.tsx` y nota en `src/lib/AGENTS.md:47`.

**No incluye (límite del brief):**
- Deal en riesgo (`stale_deal`): NK-0031. No se toca `syncSuggestions`.
- Respuestas positivas, reservas y cancelaciones de llamadas: SDD-4.
- Nombre de empresa o de deal, recuento, actualización, reenvío o resumen en el aviso.
- Tablas de transición, funciones puras de etiqueta o de copy, enmascarado de datos de contacto.
- Cambiar la ventana de la tanda (se mantiene en 12 h), paginar hasta reunir 300 avisos o descartar por preferencia antes del límite.
- Lead que salta a `opportunity` sin detenerse en SQL: no avisa (CA-15).
- Filtrar leads antiguos: un lead que llega a SQL avisa aunque su fecha de alta sea antigua.
- Entrega inmediata a Telegram: un trigger no puede llamar a Telegram.
- Tabla de eventos aparte, preferencias nuevas por persona, llamadas a IA, cambios en el toast o en `background.tsx`.
- Cambiar el email de las 8:00, el briefing de Inicio o los detectores.
- Escrituras que desactivan triggers (`session_replication_role = replica`, `ALTER TABLE ... DISABLE TRIGGER`) o `TRUNCATE`: no avisan.

## 6. Cambios de comportamiento (delta)
**Añadido:** aviso `money` en el Centro de avisos y, según preferencia, por Telegram; columna `dedupe_key`; triggers de `leads` y `deals`; función auxiliar de aviso.
**Modificado:**
- `telegramWorthy`: en «Solo lo importante» entra `money` (una línea).
- La tanda de Telegram no envía a quien ya no es miembro de la empresa del aviso.
- Etiqueta «Dinero» y definición de «Solo lo importante» (texto).
- **Efecto declarado:** cada aviso `money` abre además un toast de 15 s en la app, también para quien hizo el cambio, porque `background.tsx` ya lo hace con cada INSERT de `notifications`. No se cambia.
**Eliminado:** nada.

## 7. Historias y criterios de aceptación
**Fecha de un evento.** Lead: no se mira ninguna fecha; entrar en SQL es el evento y avisa siempre (decisión de Fede, 2026-10-31). Deal: `closed_at` si la fila es una inserción con valor o si cambió y no es nulo; en cualquier otro caso, `now()`. Para los deals, «reciente» es de las últimas 24 horas.
**Hora de la clave.** La hora UTC de `now()` de la transacción (no la fecha del evento). La función auxiliar admite una hora explícita para que las pruebas no dependan del reloj.
**Todo CA negativo se prueba con un control positivo en el mismo test**, para que falle antes de la migración.

### H-1: Como Owner, Sales Leader o responsable, quiero saber que hay leads que llegaron a SQL.
- **CA-1** CUANDO un lead entra en etapa SQL (por inserción o actualización, desde cualquier camino, y aunque su fecha de alta sea antigua), el sistema DEBE crear un aviso `money` de texto fijo para cada Owner y Sales Leader de esa empresa y para el responsable del lead si es miembro · cubre G-1 · prueba: `src/lib/money-notices.pg.test.ts` (se ejecuta escribiendo como `authenticated` con `as(db, uid)` y como `service_role`, no solo como superusuario. **La pata `authenticated` es la que guarda la regresión de `security definer`**: con privilegios por defecto de función como los de Supabase, `service_role` avisaría aunque falte. La réplica hace `revoke insert` a `authenticated` sobre `notifications`, para no ser más permisiva que la base viva)
- **CA-2** El sistema NO DEBE avisar si el lead ya estaba en SQL y se actualiza otro campo, o si pasa a otra etapa · cubre G-3 · prueba: `src/lib/money-notices.pg.test.ts`
- **CA-3** Si la misma persona es Owner o Sales Leader y además responsable, DEBE recibir un único aviso · cubre G-3 · prueba: `src/lib/money-notices.pg.test.ts`

### H-2: Como Owner, Sales Leader o responsable, quiero saber que hay deals que quedaron Ganados.
- **CA-4** CUANDO un deal queda en etapa `won` (por inserción o actualización, con o sin aprobación de por medio) y su fecha de evento es reciente, el sistema DEBE crear un aviso `money` de texto fijo para los mismos destinatarios · cubre G-2 · prueba: `src/lib/money-notices.pg.test.ts`
- **CA-5** El sistema NO DEBE avisar cuando un deal ya Ganado se actualiza (incluida la reescritura de `closed_at`), ni cuando su cierre es de hace más de 24 horas (importación o registro histórico) · cubre G-3 · prueba: `src/lib/money-notices.pg.test.ts` (la aprobación pendiente o rechazada no cambia `deals.stage` y la réplica no incluye `approvals`, así que no tiene observable propio y se quita)
- **CA-6** Un deal que se reabre y vuelve a ganarse con el `closed_at` antiguo intacto DEBE avisar, porque su fecha de evento es `now()`; el primer ganado de la prueba es el de cierre antiguo, que no avisa, para no chocar con CA-7 (una hora, un aviso) · cubre G-2 · prueba: `src/lib/money-notices.pg.test.ts`

### H-3: Como persona, quiero un aviso por hora como máximo, también en un lote.
- **CA-7** Dentro de una misma hora, para una persona, un tipo y una empresa, el sistema DEBE crear como máximo un aviso `money`; en otra hora, uno nuevo. La prueba usa la función auxiliar con horas explícitas, sin depender del reloj · cubre G-3 · prueba: `src/lib/money-notices.pg.test.ts`
- **CA-8** El sistema NO DEBE crear dos avisos con la misma clave `(user_id, dedupe_key)` (restricción única; es la propia base de CA-7, se prueba con una inserción directa repetida) · cubre G-3 · prueba: `src/lib/money-notices.pg.test.ts` (la clave de una fila creada por el trigger se compara con `date_trunc('hour', now())` en la misma transacción; así falla si el trigger la deriva de la fecha del evento)

### H-4: Como persona, quiero decidir qué me llega por Telegram con los niveles que ya conozco.
- **CA-9** En «Solo lo importante» `telegramWorthy` DEBE devolver verdadero para `money`; en «Todo lo que termine» también; en «Solo lo que necesita mi decisión» y «Nada por Telegram», falso · cubre G-3 · prueba: `src/lib/jobs.test.ts` (solo la aserción de «Solo lo importante» puede fallar antes; las demás ya se cumplen)
- **CA-10** En «Solo lo importante», `telegramDecision` con `kind: "money"` en horas de silencio DEBE devolver `"hold"`; hoy devuelve `"skip"` · cubre G-3 · prueba: `src/lib/jobs.test.ts`
- **CA-11** La tanda DEBE enviar un aviso `money` elegible una sola vez y marcarlo como enviado, y NO DEBE enviarlo a quien ya no sea miembro de la empresa del aviso · cubre G-1, G-2, G-3 · prueba: `src/lib/notices.test.ts` (archivo nuevo; el cliente falso imita `from().select().is().gte().order().limit()` y se sustituye `@/lib/telegram.server`; con el positivo y el negativo en el mismo test)

### H-5: Como Owner, quiero que esto no cruce empresas, no filtre datos y no rompa lo que lo originó.
- **CA-12** Un evento de la empresa A NUNCA DEBE crear avisos para miembros de la empresa B, ni para una empresa archivada, ni para quien ya no es miembro; las filas sin `org_id` se IGNORAN (alcanzable solo por UPDATE con `service_role` o sin `leads_audit` en la réplica: con `set_audit` una inserción con `org_id` nulo falla antes del trigger) · cubre G-3 · prueba: `src/lib/money-notices.pg.test.ts`
- **CA-13** SI la inserción del aviso falla, la escritura del lead o del deal NO DEBE revertirse y el fallo DEBE quedar como advertencia de la base, sin datos de la fila; SI no hay destinatarios, la escritura sigue y no se crea ningún aviso (sin advertencia: no es un fallo) · cubre G-3 · prueba: `src/lib/money-notices.pg.test.ts` (la prueba fuerza el fallo del aviso y captura la advertencia con `onNotice`; el caso sin destinatarios comprueba 0 filas y 0 advertencias)
- **CA-14** El título y el cuerpo del aviso DEBEN ser de una lista cerrada de textos y NO DEBEN contener ningún dato del lead o del deal (nombre, email, teléfono, empresa) · cubre G-3 · prueba: `src/lib/money-notices.pg.test.ts` (inserta un lead con email en `email` y un teléfono en `notes` y `contact_name`, porque `leads` no tiene columna `phone`, y comprueba que no aparecen)
- **CA-15** El sistema NO DEBE avisar cuando un lead pasa a `opportunity` sin detenerse en SQL, ni cuando `lead_stage_change` crea el deal con etapa nula (el deal queda en su etapa inicial y no `won`) · cubre G-3 · prueba: `src/lib/money-notices.pg.test.ts` (con la réplica de `lead_stage_change` y el positivo de CA-1 en el mismo test)

## 8. Casos límite y errores
- **Varios triggers sobre la misma tabla:** `leads_stage`, `deals_slip` y `deals_stamp_human_edit` son BEFORE y no interfieren; `deals_track` es AFTER por fila y su UPDATE de `closed_at` no cambia la etapa. El nuevo es AFTER por fila con `WHEN`, así que no se ejecuta en actualizaciones sin cambio de etapa. Las definiciones vivas se leyeron el 2026-10-31 (§3); `deal_lines_sync` no es un trigger de `deals`. El deal que `lead_stage_change` crea al pasar a `opportunity` nace con etapa nula y `deals_stage_check` la completa en BEFORE, así que nuestro trigger AFTER ve la etapa final y no es `won`.
- **Primera victoria de un deal:** `closed_at` es nulo antes y después en la fila que ve el trigger (deals_track lo estampa en un UPDATE posterior, ya sin cambio de etapa), así que la fecha de evento es `now()` y avisa.
- **Deal importado con cierre antiguo:** `closed_at` pasa de nulo a la fecha antigua; el evento es antiguo y no avisa.
- **Casos aceptados que avisan** (los de deals con `now()` como fecha de evento; los de leads no tienen fecha de evento): un deal insertado ya `won` por agente o MCP sin `closed_at`; un reabierto que el panel vuelve a ganar con la misma fecha histórica; el re-sync de leads existentes por la ingesta, cuya ruta de actualización ignora la fecha de entrada; un lead nuevo que llega ya en SQL con fecha de alta antigua (CSV o CRM externo); una migración futura que actualice etapas en lote. Todos quedan acotados a un aviso por hora y destinatario.
- **Caso que no avisa:** el panel de deals ganados guarda el cierre al mediodía UTC del día elegido; un día de ayer puede quedar fuera de las 24 h. Si `closed_at` pasa a nulo en el mismo cambio, la fecha de evento es `now()` y sí avisa.
- **Lead con fecha de alta antigua que llega a SQL:** avisa (decisión de Fede, 2026-10-31). Es probablemente el camino de entrada más común desde CRMs externos; el volumen real es **sin dato** y el coste es una carga histórica que genera un aviso por hora y destinatario. Un CSV sin fecha se comporta igual.
- **Lead que pasa a `opportunity` sin detenerse en SQL, o deal creado por `lead_stage_change`:** no avisa (CA-15).
- **Segundo evento de la hora:** no avisa. Un lead caliente que llega a SQL a las 10:50 tras otro de las 10:05 no genera segundo aviso; se ve en Leads. Es el coste de la decisión de §1.
- **Cambio de hora entre dos eventos** produce dos avisos: la ventana es la hora natural, no deslizante.
- **Responsable que no es miembro** o ya no está: no recibe aviso; los líderes sí.
- **Rol Consejo:** vive fuera de `org_members` por diseño del SDD-1a (`docs/sdd/SDD-20261030-gtm-control-tower-1a-core.md:13`, que existe en este checkout pero no en `origin/main`), así que los destinatarios, que salen de `org_members`, no lo incluyen. **[Por verificar]** en ejecución cuando exista el rol.
- **Quien está en dos empresas** ve avisos de ambas; el enlace abre la empresa activa, no la del evento. Ya ocurre con los avisos de trabajos.
- **Aviso sin Telegram vinculado:** solo aparece en la app.
- **Fallo del aviso:** solo advertencia de Postgres, sin rastro propio (§14). Sin destinatarios no hay aviso ni advertencia.
- **Toast:** cada aviso abre un toast de 15 s en la app, también al autor del cambio (§6); no se cambia.
- **Ráfaga al acabar el silencio:** cada hora UTC con actividad deja una fila retenida y, al terminar el silencio, salen todas juntas con el mismo texto (hasta una por hora con actividad y por tipo). Es el coste de no actualizar el aviso (§14).

## 9. Experiencia y copy
Textos en español, «tú», sin iconos. Lista cerrada, no definitiva en su redacción:
- Lead: título «Hay leads nuevos en SQL.», cuerpo «Míralos en Leads.», enlace `/leads?vista=lista`.
- Deal: título «Hay deals nuevos como Ganados.», cuerpo «Míralos en Pipeline.», enlace `/deals` (la pantalla se llama «Pipeline», `nav.ts:14`, `deals.tsx:40`).
- Etiqueta del Centro de avisos: «Dinero».
- «Solo lo importante» pasa a incluir «y los avisos de dinero». Hoy `notice-prefs.tsx:72` dice «fallos, lo que necesita tu decisión y tareas grandes (Descubiertos, debates, informes, búsquedas)» y el texto vacío del Centro (`notification-center.tsx:94`) dice «Cuando Nokko termine algo, lo verás aquí.»; este último deja de ser exacto (gate, verificado en `origin/main`).

## 10. Datos, permisos y privacidad
- Migración nueva, **sobre `origin/main`**. Candidata 0074, con `idx` 73 y un `when` mayor que 1793749600000; el gate comprobó contra refs locales que está libre, **sin `git fetch`**; el `idx` no es estable si otra migración se funde antes (`../PLAN-orden-migraciones.md:118`). Contiene:
  - ampliar el CHECK de `notifications.kind` con `money`, nombre confirmado en producción (`notifications_kind_check`); se localiza igualmente por definición en `pg_constraint` por si difiere en otro entorno;
  - columna `dedupe_key text` y `unique (user_id, dedupe_key)` completo, sin índice parcial;
  - una función auxiliar `public.money_notify(...)` `security definer set search_path = public` que recibe empresa, tipo, id de la entidad, responsable y una hora (por defecto `now()`), y de la que `revoke execute` a `public`, `anon` y `authenticated` (el `revoke` de `seed_deal_stages` en `0023:55` está comentado, así que no es precedente de estado vivo);
  - dos funciones de trigger `public.money_lead_sql_trg()` y `public.money_deal_won_trg()`, **también `security definer set search_path = public`**: sin eso, con el `revoke` anterior fallan con `permission denied for function` al escribir como `authenticated` (y como `service_role` si no tiene `execute` por defecto), el bloque `exception` lo traga y la escritura sigue sin aviso (el arnés, que escribe como superusuario, no lo vería; de ahí la prueba de CA-1);
  - cuatro triggers AFTER por fila con `WHEN`, nombrados `money_lead_sql_ins`, `money_lead_sql_upd`, `money_deal_won_ins` y `money_deal_won_upd` (sin colisión con triggers existentes): `leads` (inserción con `new.stage = 'sql'`; actualización con `new.stage = 'sql'` y `old.stage` distinto) y `deals` (igual con `'won'`), con el bloque `begin ... exception when others then raise warning` para CA-13.
- Inserción de avisos con `insert ... select ... order by user_id ... on conflict (user_id, dedupe_key) do nothing`. Sin `DISTINCT`: con `DO NOTHING` las claves repetidas dentro de una sentencia no fallan (gate).
- `src/lib/field-catalog.ts` recibe un concepto nuevo para `dedupe_key`: la unión `ConceptId`, el binding y una entrada en el array `CONCEPTS` y en `SHOWN_IN` (un `Record<ConceptId, string[]>`). El binding exige `persistence`, y `field-catalog.test.ts` exige que cada concepto se use una vez y tenga un archivo existente en `SHOWN_IN`; `dedupe_key` es una clave técnica que no se muestra en ninguna pantalla. **Decisión de U-2 antes de escribir código:** o se define el concepto con su `persistence` y un archivo de `SHOWN_IN` válido, o se trata `notifications` como infraestructura (`INFRASTRUCTURE_TABLES`); la que elija el agente se declara en §18. `field-baseline.ts:58` hoy lista las columnas de `notifications` sin `dedupe_key`.
- **Orden de `types.ts`:** primero se aplica la migración y se actualiza `src/integrations/supabase/types.ts` con `notifications.dedupe_key`; después se añade el binding a `field-catalog.ts`, porque si no falla «every catalogued place is a real column» en `field-catalog.test.ts`. El agente no toca producción: quien aplica la migración (Fede, por Lovable) confirma antes la columna, y el agente edita `types.ts` en un commit normal, como hicieron las ramas previas, y declara en §18 de dónde salió.
- Destinatarios: `org_members` con rol `owner` o `sales_leader`, más el `owner_id` del lead o deal si es miembro; empresa no archivada.
- Clave: `money:<lead_sql|deal_won>:<org_id>:<hora UTC de now() de la transacción, truncada>`.
- Texto vivo de `lead_stage_change`, `track_deal_changes` y `deals_stage_check`: **no está guardado en el repo y no se lee de la base viva** (decisión de Fede, 2026-10-31). La réplica se reconstruye desde `0012` y `0002` más los deltas de §3 y se declara en §18 como reconstrucción.
- RLS de `notifications`: cada persona lee y marca solo las suyas; no cambia. Quien recibe el aviso ya puede leer esos leads y deals por RLS; no se amplía ningún permiso.
- Privacidad: el texto es fijo y no contiene nombres, emails ni teléfonos, así que a Telegram no viaja ningún dato del lead o del deal. Ningún dato de clientes en código, pruebas ni logs.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| ninguna | regla | — | — |

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | Extender el arnés de PGlite, dentro del propio test como hacen los demás: `archived_at` en `organizations`, `leads`, `deals`, `deal_stage_history`, `notifications`, usuario `sales_leader` y réplicas de `leads_stage` y `deals_track`. Prerrequisito cumplido: las definiciones vivas se leyeron el 2026-10-31 (§3). La réplica copia `lead_stage_change` y `track_deal_changes` reconstruidas desde `0012` y `0002` más los deltas de §3 (§10), no leídas de producción, y no desde las migraciones 0001, 0002 y 0012, y declara en §18 qué no replica (`deals_audit`, `deals_lines_guard`, `deals_stamp_human_edit` si no hacen falta). **`deals_stage_check` sí hace falta** para CA-15: `deals.stage` es `not null` y sin ese BEFORE el deal con etapa nula no se inserta; su texto vivo tampoco está guardado, así que la réplica lo reconstruye (completa la etapa inicial) y se declara en §18) | prerrequisito de U-2 | `src/lib/money-notices.pg.test.ts` (humo del arnés) |
| U-2 | Migración: `money`, `dedupe_key`, función auxiliar, dos funciones de trigger y cuatro triggers; `types.ts` y catálogo de campos (orden en §10) | CA-1 a CA-8, CA-12 a CA-15 | `src/lib/money-notices.pg.test.ts`, `src/lib/field-coverage.test.ts` |
| U-3 | `telegramWorthy` con `money` | CA-9, CA-10 | `src/lib/jobs.test.ts` |
| U-4 | Tanda de Telegram: no enviar a quien ya no es miembro; `org_id` en `COLS` y en `Notice` (`notices.server.ts:9,39`). Motivo: arregla un hueco previo, `deliver` no comprueba pertenencia para ningún tipo; si se hace dentro de `deliver` también cambia `deliverJobNotice` y `notifyAutopilot`. El cliente falso de la prueba imita además `channel_links`, `notification_prefs` y `org_members`, y un `update` con estado para probar «una sola vez» | CA-11 | `src/lib/notices.test.ts` |
| U-5 | Texto: etiqueta «Dinero», definición de «Solo lo importante», nota en `src/lib/AGENTS.md:47`. Sin test automático, se comprueba en el recorrido con `nokko-walkthrough` | ninguno | recorrido |

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- Un trigger por fila con `WHEN` no se ejecuta cuando no hay transición de etapa, así que el coste en actualizaciones masivas de `leads` o `deals` sin cambio de etapa es nulo, y por fila con transición es una función corta. Comprobar con volumen real (sin dato).
- La transición `old/new` en la propia cláusula `WHEN` es lo que evita duplicados al reintentar una escritura; no hace falta un id de transacción.
- Con `ON CONFLICT DO UPDATE` en el origen (p. ej. un upsert de importación) la fila insertada pasa por el trigger de inserción y la actualizada por el de actualización, con filas disjuntas (gate).
- Orden estable de inserción por `user_id` para reducir bloqueos entre transacciones; la espera por una clave en curso y el interbloqueo real no se pueden probar en PGlite (una sola conexión).
- `exception when others` no atrapa `QUERY_CANCELED` (según la documentación de PostgreSQL; no probado aquí). Consecuencia para H-5/CA-13: si otra transacción deja sin confirmar la misma clave y un `statement_timeout` corta la espera, la escritura del usuario sí falla. Es raro (scripts o migraciones largas); no se ha validado una alternativa menos arriesgada.
- El coste del lote es lineal en el número de filas con transición (el gate probó 20.000 llamadas en PGlite); en producción **sin medida**.
- La función de pertenencia en la tanda reutiliza el patrón de `deliver` (carga de mapas con `.in("user_id", …)`); con listas largas la URL crece (gate).
- Alternativas descartadas: tablas de transición con resumen (más superficie por título individual, recuento y enmascarado); actualizar el aviso con recuento (carrera con `deliver`, escucha de UPDATE, reenvíos); función de servidor desde cada pantalla (no cubre todos los caminos); outbox con job (retrasa el aviso en la app).
- Las pruebas pasan por una réplica en PGlite, no por la base real.

## 14. Riesgos y dependencias
- **Réplica frente a base real:** el arnés ya reconoce que la réplica no es la base. Los triggers vivos de `leads`, `deals` y `notifications` se leyeron el 2026-10-31 (§3), pero la réplica no copia todos y no replica `set_audit`; `deals_stage_check` se reconstruye para CA-15 (U-1).
- **Concurrencia y bloqueos reales** no se prueban en PGlite: sin comprobar.
- **Migraciones:** `check-migration-journal.mjs` falla contra esta rama porque parte de un main antiguo; contra `origin/main` pasa y hoy 0074 está libre, pero hace falta `git fetch` y recalcular `idx` al fusionar. Dos documentos se contradicen sobre la 0058 (`src/lib/AGENTS.md:54` en `origin/main` y `../PLAN-orden-migraciones.md:227`).
- **Aplicación en producción:** `../PLAN-orden-migraciones.md` indica que las migraciones se aplican por chat con Lovable (`:227`) y que el espacio estaba sin créditos el 2026-10-27, mientras que `:213` registra migraciones aplicadas el 2026-10-28. **[Por verificar]** el estado hoy.
- **Retraso en Telegram:** hasta una hora (el cron está fuera del repo, **[Por verificar]**), más el silencio nocturno. Con tanda de 12 h, un silencio configurado de 12 h o más pierde los avisos retenidos (un aviso creado en la hora anterior ya supera las 12 h al salir, suponiendo que el cron corre en punto). Con el silencio por defecto de 10 h cabe.
- **Tope de 300 en la tanda:** la consulta trae todos los tipos sin enviar de las últimas 12 h, en orden ascendente y con límite 300 (`notices.server.ts:48-50`), así que los `money`, que son los más nuevos, se quedan fuera primero si hay más de 300 avisos antiguos. `deliver` no marca (`continue`) a quien no tiene chat vinculado (`:27`) ni cuando la decisión no es `send` (`:29`), y esos avisos siguen ocupando huecos 12 h. Cota derivada del código: como máximo 26 filas `money` por persona y empresa en esa ventana (2 tipos × 13 franjas UTC). Riesgo real: **sin dato** (volumen de avisos y de personas con Telegram). Fuera de alcance: no se pagina ni se descarta por preferencia antes del límite.
- **Ráfaga al acabar el silencio:** ver §8.
- **Leads antiguos que avisan:** la decisión de Fede puede generar un aviso por hora y destinatario en cargas históricas (volumen **sin dato**).
- **Reenvío si falla el marcado de «enviado»:** `deliver` ignora ese error (`notices.server.ts:32`) y reenvía cada hora dentro de la ventana. Riesgo previo; este SDD no lo cambia.
- **Aviso perdido por simplicidad:** el segundo evento de la hora no avisa (§8).
- **Fallo del aviso sin rastro propio:** solo advertencia de Postgres. **[Por verificar]** dónde se leería en producción.
- **Toast** en cada aviso y también al autor del cambio (§6, §8).
- **`QUERY_CANCELED`:** ver §13.
- **Solape con el SDD-4:** si define su propio modelo de avisos, habrá que alinear `kind` y `dedupe_key`.
- **Valor real:** la v1 cubre solo lo que NOKKO ya ve. El título de NK-0030 en el ledger todavía habla de respuestas y reservas.

## 15. Preguntas para Fede y para la revisión técnica
**Respondidas por Fede en entrevista (2026-10-31); las cinco primeras confirman el valor por defecto de la v5; la 7 lo cambia:**
1. ~~¿Leads y deals, o solo deals Ganados?~~ **Leads a SQL y deals Ganados.** El segundo deal Ganado de una hora no avisa.
2. ~~¿Un lead que salta a `opportunity` sin detenerse en SQL debe avisar?~~ **No.**
3. ~~¿El autor del cambio recibe su propio aviso y toast?~~ **Sí.**
4. ~~¿Aceptas hasta una hora de retraso en Telegram?~~ **Sí.**
5. ~~¿El aviso puede no nombrar al lead ni al deal?~~ **Sí, texto fijo.**
7. ~~¿Un lead con fecha de alta de más de 24 h que llega a SQL debe avisar?~~ **Sí** (2026-10-31, tras la quinta pasada). La regla de 24 h queda solo para los deals; un lead avisa siempre al entrar en SQL, acotado a un aviso por hora y destinatario.

**Abierta:**
6. Revisión técnica: ¿hay algún camino de escritura que salte los triggers fuera de los listados en §5?

(El umbral de «reciente» está respondido: 24 horas.)

**Respuesta del autor a la cuarta pasada del gate (v5, 2026-10-30):**
| Objeción | Tratamiento |
|---|---|
| B-1 la clave horaria no dice de qué hora es | §7 y §10: hora de `now()` de la transacción; la función auxiliar admite hora explícita; CA-7 la prueba sin depender del reloj |
| B-2 base viva que ningún agente puede leer | Resuelta el 2026-10-31: se leyó el catálogo de producción con el conector de Lovable (§3); U-1 ya no depende de nadie |
| N-1 título desactualizado | Texto fijo sin nombre (CA-14); desaparece la regla del título individual |
| N-2 casos de fecha del deal | §8 separa los casos aceptados que avisan, el que no avisa y el de `closed_at` nulo (§7) |
| N-3 espera y bloqueo | Orden por `user_id`; sin `DISTINCT`; `revoke execute`; advertencia sin datos de la fila (§10, §13, CA-13) |
| N-4 `flushHeldNotices` | Alcance mínimo: solo pertenencia (CA-11); el resto se declara fuera de alcance y en §14 |
| N-5 ventana de 24 h | Se mantiene la actual de 12 h |
| N-6 toast y Centro de avisos | Declarado en §6, §8 y §14; no se cambia |
| N-7 CA-17 y CA-18 | Eliminados; el texto va como cambio sin CA (U-5) |
| N-8 redundancias y positivo que falta | CA reducidos de 20 a 14; positivo de envío en CA-11 |
| N-9 pruebas e infraestructura | U-1: tablas definidas dentro del test, sin tocar `build()` |
| N-10 migración | `idx` inestable y `types.ts` regenerado (§10) |
| N-11 privacidad | Texto fijo: ya no viaja ningún dato del lead o del deal; sin enmascarado |
| N-12 alcance mínimo | Aplicado: triggers por fila con `WHEN`, título fijo, 12 h con pertenencia, texto en vez de funciones puras |
| N-13 rol Consejo | §8, sigue [Por verificar] |
| N-14 documentación | Nota en `src/lib/AGENTS.md:47` (U-5) |
| Contradicciones y citas incorrectas | Corregidas en §3 (`owner_id`, 0050, `BASELINE_MAX`); toast declarado; CA-10 corrige la afirmación de `"skip"` |

**Respuesta del autor a la quinta pasada del gate (v5.1, 2026-10-31; sin sexta revisión):**
| Objeción | Tratamiento |
|---|---|
| N-1 funciones de trigger sin `security definer` | §10: funciones de trigger `security definer`; CA-1 se prueba como `authenticated` y como `service_role` |
| N-2 lead antiguo no avisa | Decisión de Fede: avisa. §1, §7 (fecha de evento), §8, CA-1, CA-2 y §14 |
| N-3 tope de 300 y avisos sin marcar | §14 |
| N-4 ráfaga al acabar el silencio | §8 y §14 |
| N-5 umbral «12 h o más» | §14 |
| N-6 toast | §8 (ya estaba en §6) |
| N-7 `types.ts` y catálogo | §10: orden, `ConceptId`, binding y `SHOWN_IN` |
| N-8 cobertura | CA-15 nuevo; CA-5 sin la cláusula de aprobación; CA-8 aclarado como base de CA-7; cliente falso de CA-11 en U-4 |
| N-9 texto vivo de las funciones | §10 y U-1: aún no guardado; se relee antes de U-1 o se reconstruye y se declara |
| N-10 CA-13 sin destinatarios | CA-13 reescrito: sin destinatarios, 0 avisos y 0 advertencias |
| N-11 `QUERY_CANCELED` | §13 y §14 |
| N-12 pertenencia en la tanda | U-4: motivo, `org_id` en `COLS` y `Notice`, efecto sobre `deliverJobNotice` y `notifyAutopilot` |
| N-13 pequeños | Copy «Pipeline» (§9), nombres de función y triggers (§10), migraciones en lote (§8), coste lineal (§13) |
| N-14 medida 106/323 ms | Quitada de §3 |
| Citas incorrectas | Corregidas en §3 (`deliver` `:11-37`, `leads_stage` `:54-84` y trigger en `:85`, `deals_track` en `0001:134`), §10 (`seed_deal_stages`) y §8 (SDD-1a no está en `origin/main`) |

**Respuesta del autor a la sexta pasada del gate (v5.2, 2026-10-31; sin séptima revisión):**
| Objeción | Tratamiento |
|---|---|
| N-1 catálogo de campos incompleto | §10: `CONCEPTS`, `persistence`, archivo de `SHOWN_IN` o `INFRASTRUCTURE_TABLES`; decisión declarada en §18 |
| N-2 guarda de `service_role` | CA-1 y §10: la pata `authenticated` guarda la regresión; `revoke insert` a `authenticated` en la réplica |
| N-3 restos de redacción | §3 (línea de `leads_stage`) y §8 (casos de leads fuera del paréntesis de fecha) |
| N-4 sustituto de `deals_stage_check` | U-1 y §14: necesario para CA-15, reconstruido y declarado en §18 |
| N-5 clave horaria y CA-6 | CA-8 compara con `date_trunc('hour', now())`; CA-6 empieza con el cierre antiguo |
| N-6 `phone` y `org_id` nulo | CA-14 usa `notes` y `contact_name`; CA-12 explica el alcance del caso sin `org_id` |

## 16. Pendiente de verificar
**Consultas de base viva: resueltas el 2026-10-31** (§3). Se ejecutaron cuatro consultas de catálogo más una sobre `deal_stages` y otra sobre las funciones `lead_stage_change` y `track_deal_changes`. Todas fueron SELECT; no se tocó ningún dato. El conector de Supabase de la sesión solo ve proyectos de Postin y no se usó; la base de NOKKO se leyó desde el proyecto de Lovable.

**Resto:**
- Políticas, triggers y funciones de `deal_lines` y de las tablas que `lead_stage_change` toca (`accounts`): no leídas.
- Siguiente número de migración libre, su `idx` y `when`, con `git fetch` y contra `origin/main`; que ninguna otra rama reclame 0074.
- Estado de la migración 0058: dos documentos se contradicen.
- Cron horario de la tanda y dónde se leerían las advertencias de CA-13.
- Concurrencia real (bloqueos) y que la migración pueda aplicarse hoy por el cauce de Lovable.
- Texto vivo de `lead_stage_change`, `track_deal_changes` y `deals_stage_check`: no leído; la réplica es una reconstrucción (§10, U-1).
- Que el enlace público comprueba `archived_at` (no leído en `src/routes/api/public/leads.ts` ni `intake.server.ts`) y los caminos del bot de Telegram, MCP y Stripe.
- Comportamiento del rol Consejo cuando exista.
- Uso real de Telegram, volumen de leads en SQL y deals ganados por semana (**sin dato**).

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
**Sexta pasada: sobre la v5.1, sin objeciones bloqueantes (6 no bloqueantes, N-1 a N-6, aplicadas en la v5.2 y anotadas en §15).** Los informes van de más reciente a más antiguo. Revisión de la v5.2: no existe.

### Sexta pasada (sobre la v5.1)
_Informe del agente gate (contexto fresco, solo lectura), copiado sin editar el 2026-10-31. Las líneas y los CA citados son los de la v5.1. No aprueba el SDD: informa._

## Informe del gate sobre la v5.1 del SDD NK-0030 (sexta revisión)

**Veredicto: Sin objeciones bloqueantes.** Los parches de la v5.1 son coherentes con el diseño y los experimentos en PGlite lo confirman. Quedan seis puntos no bloqueantes, sobre todo de redacción de CA y de precisión del arnés de pruebas (N-1 a N-6).

Base usada: `origin/main` en `dcea201`, mediante un worktree temporal que ya he retirado. No he tocado el checkout. Los scripts están en `/private/tmp/claude-501/-Users-fedecosentino-NOKKO-GTM-BRAIN/8193f42e-91c9-4b72-9e47-d93bfb065866/scratchpad/gate6/exp/` (`replica.mjs`, `run.mjs`, `run2.mjs`). No he leído el §17, para no anclarme en gates anteriores.

### Tabla de respuestas de la quinta pasada (§15)
Todos los tratamientos declarados están de verdad en el texto. Con matices en tres:
- **N-1:** el §10 pone `security definer` en las funciones de trigger y el CA-1 se prueba como `authenticated` y como `service_role`. El matiz es el de N-2 más abajo.
- **N-2:** está en §1, §7, §8, CA-1, CA-2 y §14. Quedan restos de redacción (N-3).
- **N-7:** el §10 nombra `ConceptId`, el binding y `SHOWN_IN`, pero está incompleto (N-1).
- **N-8, N-9, N-10, N-11, N-12, N-13 y N-14:** presentes en CA-15, CA-5, CA-8, U-4, §10/U-1, CA-13, §13/§14, §9 y §3. Las citas de §3 están corregidas.

### Consistencia de la regla nueva de leads
- No hay rastro de «24 h» aplicado a leads.
- Tampoco quedan `stage_entered_at` ni «fecha de evento» de leads con efecto. Sí quedan restos de redacción:
  - La línea 39 del §3 explica el mecanismo de `stage_entered_at`, que ya no se usa.
  - En el §8 (línea 128), «(con `now()` como fecha de evento)» encabeza una lista que ahora incluye dos casos de leads, que ya no tienen fecha de evento.
- El CA-2 es coherente: ya no tiene la cláusula de lead antiguo.
- Se cuadran CA ↔ U ↔ G. U-2 cierra CA-1 a CA-8 y CA-12 a CA-15, U-3 cierra CA-9 y CA-10, y U-4 cierra CA-11. Todos los CA citan un G.

### Experimentos (PGlite 0.5.14 en el scratchpad, PostgreSQL 18 de PGlite, roles reales `authenticated` y `service_role`)

| Caso | Resultado |
|---|---|
| (a) función de trigger sin `security definer` | Como `authenticated`: el lead se inserta, 0 avisos y warning `42501`. Como `service_role`: lo mismo en mi réplica. |
| (a) con `security definer` | 3 avisos (Owner, Sales Leader, responsable) en ambos roles, sin warnings. |
| (b) lead insertado en SQL con `created_at` de hace 30 días | Avisa: 3 avisos. Título, cuerpo y enlace son fijos, sin datos del lead. |
| (c) lote de 50 leads insertados en SQL | 3 avisos, uno por destinatario. |
| (c) update masivo mql→sql de 50 leads | 3 avisos. |
| (c) repetir sql→sql, o pasar a otra etapa | 0 avisos nuevos. |
| (d) deal a `won` con `closed_at` de hace 5 días | No avisa. |
| (d) reabrir ese deal y ganarlo con el `closed_at` antiguo intacto | Avisa. |
| (d) reescribir `closed_at` en un deal ya ganado | 0 avisos. |
| (d) insertar `won` con `closed_at` de hace 3 días | 0 avisos. |
| (d) insertar `won` sin `closed_at` | Avisa. |
| (d) primera victoria por UPDATE | Avisa: `deals_track` estampa `closed_at` después y nuestro trigger ve `closed_at` nulo, como dice el §8. |
| (e) lead mql→opportunity, y lead insertado ya en opportunity | 0 avisos. Los deals nacen en `discovery` gracias a un sustituto de `deals_stage_check`. |
| (e) deal creado con etapa nula | 0 avisos. |
| `ON CONFLICT DO UPDATE` en leads | La fila insertada pasa por el trigger de inserción y la actualizada por el de actualización. Una fila nueva en SQL más otra existente ya en SQL dio un aviso por destinatario, sin duplicados. |
| Empresa B | Solo avisa a su propio Owner. |
| Empresa archivada | 0 avisos. |
| Sin destinatarios | 0 avisos y 0 warnings. |
| CA-3 (responsable que también es Owner) | Un único aviso. |
| CA-7 (horas 10:05, 10:55, 11:00) | Dos horas distintas, dos avisos por destinatario. |
| CA-13 (fallo forzado con un `CHECK`) | El lead se guarda, 0 avisos y un warning con el código `23514`, sin datos de la fila. |
| `dedupe_key` NULL | Confirmado: varios avisos antiguos con clave NULL para el mismo usuario son válidos. |
| `money_notify` llamada como `authenticated` | `permission denied`, como se espera. |

**No he podido ejecutar:**
- Bloqueos y concurrencia reales: PGlite tiene una sola conexión.
- Coste de `exception when others` por fila, que abre una subtransacción por cada fila con transición. Por inferencia del código de PostgreSQL, el xid solo se asigna cuando hay inserción real. Con `DO NOTHING` y conflicto previo no debería asignarse, así que el desbordamiento de 64 subxids sería poco probable, pero no lo verifiqué.
- La base viva y `git fetch` remoto.

### CA sin prueba posible o sin G-n
Ninguno. Todos son comprobables y fallan antes del cambio, porque el trigger o la columna no existen. Cada CA negativo lleva su control positivo (§7).

### [Por verificar] que sigue sin comprobarse
Sin cambios respecto al §16. Pendientes:
- Cron horario de la tanda.
- Estado de la migración 0058.
- Concurrencia real.
- Aplicación de la migración por el cauce de Lovable.
- Rol Consejo.
- Texto vivo de `deals_stage_check`.
- Que el enlace público y el bot de Telegram comprueban `archived_at`.

### Contradicciones con el código o con decisiones previas
Ninguna bloqueante. Las dos de redacción son las del apartado «Consistencia de la regla nueva de leads».

### Citas incorrectas
Ninguna. He comprobado contra `origin/main` todas las de §3 a §14, incluidas `0049`, `0050`, `0012:54-85`, `0001:134`, `0002:119-125,175`, `0056:2`, `0023:55`, `notices.server.ts`, `jobs.ts`, `jobs.test.ts`, `background.tsx`, `notification-center.tsx`, `notice-prefs.tsx`, `leads-ingest.ts`, `won-deals-panel.tsx`, `pg-harness.ts`, `field-baseline.ts`, `package.json:86` y `proactive.ts:27`. `../PLAN-orden-migraciones.md` resuelve a la carpeta padre del repo, y existe. El SDD-1a no está en `origin/main`, como declara el §8. En el journal, 0074 con idx 73 y `when` > 1793749600000 es válido y `check-migration-journal.mjs` pasa; en refs locales no hay 0074.

### Objeciones no bloqueantes

**N-1 (§10, catálogo de campos incompleto).**
- Lo que falta, evidencia en `field-catalog.ts` y `field-catalog.test.ts`: hay que añadir también la entrada en el array `CONCEPTS`. Los tests «every concept is defined once and used» y «its concept exists» lo exigen. El `Binding` exige además `persistence`.
- El test «every concept has places» exige que `SHOWN_IN` apunte a un archivo existente, y una clave técnica no se muestra en ningún sitio.
- Pido nombrar en el §10 el concepto, su `persistence` y el archivo de `SHOWN_IN`, o decidir otra vía, como añadir `notifications` a `INFRASTRUCTURE_TABLES`.
- Hoy `field-baseline.ts:58` lista las columnas de `notifications` sin `dedupe_key`.

**N-2 (§10 y CA-1, el guarda de `service_role` depende del arnés).**
- Con privilegios por defecto de función como los de Supabase (los que da `alter default privileges ... grant execute on functions to service_role`), el escritor `service_role` SÍ avisa sin `security definer` (`run2.mjs`). Solo la pata `authenticated` detecta la falta de `security definer`.
- Afirmar que fallan «al escribir como `authenticated` o `service_role`» solo es cierto en el arnés actual. Pido decir que la pata `authenticated` es la que guarda esa regresión.
- Si el test usa los privilegios por defecto de tablas del arnés, que además haga `revoke insert` a `authenticated` sobre `notifications`. De lo contrario, la réplica es más permisiva que la base viva.

**N-3 (restos de redacción de la v5.1).** Quitar o reescribir la línea 39 del §3. En la línea 128 del §8, separar los casos de leads del paréntesis «fecha de evento».

**N-4 (U-1 y CA-15).**
- El CA-15 (deal creado con etapa nula) exige un sustituto de `deals_stage_check`. `deals.stage` es `not null` y sin ese BEFORE el insert falla. U-1 y §14 lo presentan como opcional.
- Pido declarar que el sustituto es una reconstrucción (el texto vivo no está en `NK-0030-live-functions.sql`) o guardarlo en esa evidencia.

**N-5 (CA-7 y CA-8 no atan la hora al `now()` de la transacción).** Ningún CA falla si el trigger deriva la clave de la fecha del evento en vez de `now()`. Pido que el CA-8 compare la clave de una fila creada por el trigger con `date_trunc('hour', now())` en la misma transacción. En el CA-6, el primer ganado debe ser el que no avisa (cierre antiguo) para no chocar con el CA-7.

**N-6 (CA-14 y CA-12).**
- `leads` no tiene columna `phone` en `types.ts`. Para el teléfono hay que usar `notes` o `contact_name`.
- Con `leads_audit` (`set_audit`) presente, una inserción con `org_id` nulo lanza excepción antes de llegar al trigger. El caso «sin `org_id`» solo es alcanzable por UPDATE con `service_role`, o sin `leads_audit` en la réplica.

### Lo que esta revisión NO demuestra
- Que la base de Lovable (PostgreSQL 17.11) se comporte igual que la réplica de PGlite (PostgreSQL 18).
- El comportamiento bajo concurrencia, el coste con volumen real y la cadencia del cron.
- Que ningún camino externo (Telegram, MCP, Stripe, enlace público) salte los triggers. En el código de la app he mirado `src/` en busca de `session_replication_role`, `DISABLE TRIGGER` y `TRUNCATE`, y no he encontrado ninguno.
- El texto vivo de `lead_stage_change`, `track_deal_changes` y `deals_stage_check`: las réplicas de `lead_stage_change` y `track_deal_changes` las reconstruí desde `0012`, `0002` y los deltas del §3.
- La migración real: probé un diseño equivalente, no el archivo definitivo, que no existe.

### Quinta pasada (sobre la v5)
_Informe del agente gate (contexto fresco, solo lectura), copiado sin editar el 2026-10-31. Las líneas y los CA citados son los de la v5. No aprueba el SDD: informa._

## Informe del gate sobre la v5 del SDD NK-0030 (quinta revisión)

**Refs leídas:**
- **Código:** `origin/main` = `dcea201e1ffe` (2026-10-29), con `git show`. Comparé el checkout `feat/software-factory` (`9e744cb`) con `origin/main`.
- **Idénticos en ambos:** `notices.server.ts`, `jobs.ts`, `jobs.test.ts`, `background.tsx`, `notification-center.tsx`, `notice-prefs.tsx`, `proactive.ts`, `leads-ingest.ts`, `leads.functions.ts`, `leads.ts`, `imports.functions.ts`, `won-deals.ts`.
- **Distintos:** `won-deals-panel.tsx` (una línea más en el checkout), `src/lib/AGENTS.md`, `field-baseline.ts`, `field-catalog.ts`, `package.json` y `pg-harness.ts`. De estos usé siempre `origin/main`.
- **SDD:** el del checkout (no está en `origin/main`), secciones 1 a 16. Ignoré el §17.
- **Experimentos:** PGlite 0.5.12 (PostgreSQL 18.6, wasm), sacado de un `node_modules` hermano. La base viva es 17.11 según el SDD y no la toqué.
- **Evidencia:** scripts desechables fuera del repo, en `/private/tmp/claude-501/-Users-fedecosentino-NOKKO-GTM-BRAIN/8193f42e-91c9-4b72-9e47-d93bfb065866/scratchpad/exp/` (`setup.mjs`, `t1.mjs` a `t7.mjs`). No creé ni toqué nada en el repo y no hice `git fetch`.
- **Réplica:** montada con un propietario no superusuario (`app_owner`), para que la RLS de `notifications` se aplique de verdad. La réplica no es la base real.

### Veredicto del gate: Sin objeciones bloqueantes

El diseño recortado funciona en la réplica en todos los apartados que pediste. Hay 14 objeciones no bloqueantes (N-1 a N-14). N-1, N-2 y N-3 conviene cerrarlas antes de aprobar.

### Verificación de la tabla de respuestas del §15 (§15, líneas 207-226)

- **B-1 clave horaria: confirmada.** §7 y §10 fijan la hora de `now()` de la transacción. CA-7 con hora explícita funciona (e). `12:05+02` y `10:50Z` caen en la misma clave UTC.
- **B-2 base viva: parcial.** Es un dato declarado por el autor que no puedo verificar. Es coherente con los comentarios de `0023_deal_stages.sql:138` y `0024_products_deal_lines.sql:168`.
  - U-1 pide copiar `lead_stage_change` y `track_deal_changes` «tal como están», pero el SDD solo da los dos deltas (§3). Se reconstruyen desde `0012` y `0002` más esos deltas; el texto vivo no queda guardado (N-9).
- **N-1 título: confirmada.** El texto es de lista cerrada. Probé con email y teléfono en el lead y no aparecen (CA-14).
- **N-2 casos de fecha: confirmada con un hueco.** Los casos que §8 declara se comportan como dice (puntos 1 y 2 del experimento).
  - Falta el caso de un lead con fecha de alta antigua que llega a SQL por primera vez desde la ingesta (N-2).
- **N-3 espera y bloqueo: parcial.** El orden por `user_id` y «sin `DISTINCT`» están verificados.
  - La espera y el interbloqueo siguen sin poder probarse en PGlite (una sola conexión).
  - La consecuencia sobre CA-13 queda sin decir (N-11).
- **N-4 `flushHeldNotices`: parcial.** La tabla dice «en §14», pero §14 no menciona el tope de 300 ni que los avisos sin Telegram vinculado no se marcan (N-4).
  - Solo lo menciona §5, como fuera de alcance. Lo confirmo en `notices.server.ts:27,29,49`.
- **N-5 ventana de 12 h: confirmada con matiz.** El umbral de pérdida es «silencio de 12 h o más», no «más de 12 h» (§14). Ver punto 3.
- **N-6 toast: parcial.** La tabla dice «§6, §8 y §14». §8 no menciona el toast (`grep` sobre el §8: cero). Sí está en §6, §14 y en la respuesta 3.
- **N-7 CA-17/18 eliminados: confirmada.** Quedan CA-1 a CA-14. U-5 declara «CA: ninguno».
- **N-8 redundancias y positivo: confirmada.** CA-11 lleva el positivo de envío. Quedan solapes menores (N-8).
- **N-9 pruebas e infraestructura: confirmada.** Las 6 `*.pg.test.ts` de `origin/main` definen sus tablas dentro del test (p. ej. `strategy-f0.pg.test.ts:1-9`). El arnés no tiene `archived_at`, y eso se resuelve con un `ALTER`.
- **N-10 migración: parcial.** `idx` 73 y `when` están bien. El tratamiento de `types.ts` queda sin ejecutar (N-7).
- **N-11 privacidad: confirmada.** A Telegram solo viajan `title`, `body` y `link` (`jobs.ts:143-145`), todos fijos. La clave de deduplicación no viaja.
- **N-12 alcance mínimo: confirmada.** Los cuatro triggers por fila con `WHEN` hacen lo que el SDD dice.
- **N-13 rol Consejo: no resuelta, y está declarada.** La cita `SDD-…1a-core.md:13` existe en el checkout pero no en `origin/main` (N-12).
- **N-14 documentación: confirmada.** `src/lib/AGENTS.md:47` existe en `origin/main` y es la viñeta de trabajos en segundo plano y Telegram.
- **Citas corregidas: parcial.** `owner_id` (`0012:16`, `0000:117`), `0050:1-8`, `BASELINE`/`BASELINE_MAX` (`:95/:98`) y la afirmación de `"skip"` están bien. Quedan tres citas inexactas (ver más abajo).

### Resultado de los experimentos

**Punto 1 (réplica completa).** Tablas `leads`, `deals`, `notifications`, `org_members` y `organizations` con `archived_at`. Réplicas de `lead_stage_change` (con el deal de stage y probabilidad nulos) y de `track_deal_changes`, más un BEFORE que completa la etapa. Cuatro triggers AFTER por fila con `WHEN`, función auxiliar `security definer` y bloque `exception when others then raise warning`. Las escrituras se hicieron como `authenticated` con RLS activa.

- **CA-1: OK.** Insertar en SQL da 3 avisos (Owner, Sales Leader y responsable). Pasar de nuevo a SQL por actualización da otros 3.
- **CA-2: OK.**
  - Otro campo con el lead ya en SQL: 0 avisos.
  - SQL a SQL: 0.
  - SQL a MQL: 0.
  - Inserción con `created_at` de hace 30 h: 0.
  - Inserción con `created_at` de hace 20 h: avisa a los líderes (el responsable no estaba informado en ese caso).
- **CA-3 y (d): OK.** Responsable que además es líder: un solo aviso por persona. Responsable que es Owner: 2 avisos.
- **CA-4 a CA-6: OK.** Primera victoria avisa. `closed_at` pasa de nulo a antiguo: no avisa. Reabierto y re-ganado con `closed_at` antiguo intacto: avisa. Reescribir `closed_at` en un deal ya ganado: 0.
- **CA-7 y (e): OK.** Con horas explícitas, la misma hora dos veces da 3 filas. La hora siguiente da 6, otro tipo 9 y otra empresa 10.
- **CA-8: OK.** Un duplicado directo falla con la restricción única (`23505`). Las filas de trabajos con `dedupe_key` nulo conviven.
- **CA-12: OK.**
  - Responsable miembro solo de B: 0 avisos para B.
  - `org_id` nulo: 0.
  - Empresa archivada: 0.
  - Miembro eliminado antes del evento: 0.
  - Responsable que no es miembro: solo reciben los líderes.
- **CA-13 y (f): OK.** Un fallo forzado, por un trigger que lanza excepción o por un CHECK de `kind`, no revierte el lead. Emite `money notice failed: … (código)` sin datos de la fila. Sin destinatarios no hay fallo y tampoco advertencia: CA-13 es ambiguo en ese punto (N-10).
- **CA-14: OK.** Título, cuerpo y enlace son fijos aunque el lead tenga email y teléfono.
- **(a) OK.**
  - Si un BEFORE cambia el stage de `discovery` a `won`, el AFTER INSERT con `WHEN (new.stage='won')` ve `won` y avisa.
  - Si el BEFORE cambia `won` a `discovery`, no avisa.
  - El deal creado por `lead_stage_change` (nulo, completado a `discovery`) no avisa.
- **(b) OK.** Un upsert en `leads` (una fila nueva y una actualizada de MQL a SQL) dispara 2 llamadas y deja 2 filas. Un upsert sobre un lead que ya estaba en SQL: 0 llamadas. En `deals` pasa lo mismo.
- **(c) Lote de 20.000 filas pasando a SQL.**
  - Llamadas a la función auxiliar: 20.000.
  - Inserciones intentadas: unas 80.000 (4 destinatarios por llamada).
  - Filas resultantes: 4.
  - Tiempo: 1.615 ms con el trigger, 610 ms con el trigger desactivado, 126 ms sin cambio de etapa (el `WHEN` evita la llamada).
  - Quitando el bloque `exception`: 1.560 ms, es decir, diferencia pequeña en este ruido.
  - Una sola ejecución, en wasm, no extrapolable a producción. No medí el coste en producción de las subtransacciones del bloque `exception`.
- **(g) OK.**
  - La función auxiliar `security definer`, propiedad del dueño de la tabla, inserta en `notifications` con RLS activa y sin política de INSERT, sin `set role` ni `bypassrls`. El dueño de la tabla se salta la RLS.
  - Un `authenticated` no puede insertar directamente (viola la RLS) ni llamar a la función auxiliar (permiso denegado).
  - Con `FORCE ROW LEVEL SECURITY` sí fallaría (advertencia, 0 avisos).
  - La escritura como `service_role` también avisa, siempre que la función de trigger sea `security definer`.
  - Como precedente real, `notify_job_end` (`0049:32-51`) funciona igual en producción.
  - Si la función de trigger **no** es `security definer`, falla en silencio (N-1).

**Punto 2 (fecha de evento).**
- **Primera victoria:** avisa. `closed_at` es nulo en la fila que ve el trigger y `deals_track` lo estampa después.
  - Probé el orden de disparo con nombres que van antes y después de `deals_track`. En ambos casos 1 solo conjunto de avisos.
- **Reabierto y re-ganado con `closed_at` antiguo:** avisa.
- **Importado con cierre antiguo:** no avisa, tanto por inserción como por actualización a `won`.
- **Insertado `won` sin `closed_at`:** avisa (aceptado en §8).
- **`closed_at` que pasa a nulo en el mismo cambio:** avisa.
- **Panel que reescribe la misma fecha histórica:** avisa (aceptado en §8).
- **`closed_at` futuro (+3 h):** avisa. Es lo que pasa con el panel si se guarda antes del mediodía UTC, porque guarda el cierre a las 12:00Z del día elegido (`won-deals.ts:15`).
- **Hueco que §8 no declara:** ver N-2.

### CA sin prueba posible o sin G-n

Ninguno sin G-n. Ninguno imposible. Dos son débiles:
- **CA-5:** la cláusula «aprobación pendiente o rechazada» no tiene observable. La réplica de U-1 no incluye `approvals`, así que esa parte sería vacía.
- **CA-13:** la parte «no hay destinatarios» no produce advertencia.

### [Por verificar] que sigue sin comprobarse

- **Base viva:** todo lo de §3 (versión 17.11, triggers, CHECKs, definiciones de funciones y RLS). No lo puedo verificar.
- **`deal_lines`/`accounts`:** triggers y políticas sin leer.
- **Cron horario:** sigue fuera del repo. Tampoco se puede comprobar dónde se leerían las advertencias en producción.
- **Aplicación en producción:** que la migración pueda aplicarse hoy por el cauce de Lovable.
- **Número 0074:** libre en todas las refs locales (revisé todas las ramas locales y las de `origin/*` que tengo). Sin `git fetch`, no sé si otra rama lo reclama.
- **Interbloqueo y esperas:** en producción, reales.
- **`QUERY_CANCELED` bajo `exception when others`:** no probado. PGlite no aplicó `statement_timeout`.
- **`vi.mock` de un import dinámico:** no ejecuté vitest.
- **Redacción de `notice-prefs.tsx:72` y del texto vacío del Centro: ya es verificable en `origin/main`, y lo verifiqué.**
  - `notice-prefs.tsx:72` dice que «Solo lo importante» son «fallos, lo que necesita tu decisión y tareas grandes (Descubiertos, debates, informes, búsquedas)».
  - `notification-center.tsx:94` dice «Cuando Nokko termine algo, lo verás aquí.».
  - Se pueden quitar de §16.
- **Enlace `/leads?vista=lista` desde el toast:** no comprobé el comportamiento de `navigate({to})` con un `?` (patrón ya usado en los avisos de trabajos).
- **Claims heredados del gate anterior:** «nueve caminos» y «agente o MCP inserta un deal ya ganado». No los reverifiqué.

### Contradicciones con el código o con decisiones previas

- `notification-center.tsx:17` y `:97`: sin etiqueta, el Centro muestra `money` en crudo (`KIND[n.kind] ?? n.kind`). No rompe nada, pero U-5 queda sin prueba automática.
- `field-catalog.ts` de `origin/main`: `SHOWN_IN` es un `Record<ConceptId, string[]>`. Un concepto nuevo exige también la unión `ConceptId` y una entrada en `SHOWN_IN`. El SDD no lo dice.
- `src/lib/AGENTS.md:47` de `origin/main` ya documenta el trabajo de avisos. La nota de U-5 encaja.
- `AGENTS.md`/`GROUND-RULES` regla 7 («cada cifra apunta a un archivo de evidencia»): la medida de 106/323 ms en §3 no apunta a ningún archivo.
- Fuera de eso, no encontré contradicciones entre §1, §5, §6, §7, §8, §10, §12, §13, §14, §15 y §16. Todos los CA tienen unidad: CA-1 a CA-8, 12, 13 y 14 en U-2; CA-9 y 10 en U-3; CA-11 en U-4. U-1 es prerrequisito y U-5 no tiene CA (declarado).

### Citas del SDD incorrectas

- `notices.server.ts:16-35` para `deliver`: la función ocupa `:11-37`.
- `0012_lead_funnel.sql:57-84` para `leads_stage`: la función es `:54-84` y el trigger se crea en `:85`.
- `0002_multitenant_organizations.sql:175` para el trigger `deals_track` AFTER: el trigger se crea en `0001_gtm_strategy_positioning_revops_abm.sql:134`. `0002:175` es el UPDATE de `closed_at` dentro de la función.
- `docs/sdd/SDD-20261030-gtm-control-tower-1a-core.md:13` existe en el checkout pero no en `origin/main`, que es la base declarada.
- `../PLAN-orden-migraciones.md:118` apoya el `idx` inestable solo de forma indirecta (es un paso de un WP).
- «como `seed_deal_stages`» (§10): el `revoke` de `0023:55` está comentado, así que no es precedente de estado vivo.
- La tabla del §15 dice que el toast está en §8. No está.
- Las demás citas que comprobé son correctas: `0049:13-16,21`, `jobs.ts:102-108,128-133`, `proactive.ts:27`, `background.tsx:99-104`, `leads-ingest.ts:72,87-93,101,134-157`, `leads.index.tsx:29-34`, `deals.tsx:35-37`, `field-baseline.ts:2-3,95,98`, `package.json:86`, `pg-harness.ts:18,21-22,120`, `0056:2`, `0000:1,117`, `0012:16,41-42`, `0002:119-125`.

### Objeciones no bloqueantes (N-n)

- **N-1 (alta).** El §10 no dice que las funciones de trigger deben ser también `security definer`.
  - Con `revoke execute` de la función auxiliar a `authenticated`, una función de trigger normal falla con `permission denied for function`.
  - El bloque `exception` lo traga: la escritura sigue, no hay aviso y solo queda una advertencia. Ocurre con `authenticated` y con `service_role` (el cliente admin de la ingesta).
  - El arnés escribe por defecto como superusuario y no lo vería. Añade al SDD la regla y que CA-1 se pruebe escribiendo con `as(db, uid)` y como `service_role`.
- **N-2 (decisión de Fede).** Un lead nuevo para NOKKO que llega ya en SQL, con una fecha de alta de más de 24 h, no avisa.
  - Pasa por `leads-ingest.ts:72,101` con `created_at`, y el normalizador (`leads.ts:64,305`) acepta alias como `date`, `created_at` o `createdate`. `lead_stage_change` fija `stage_entered_at = created_at` en la inserción (`0012:65`).
  - §8 solo lista el CSV sin fecha. Es probablemente el camino de entrada más común desde CRMs externos.
  - Volumen: **sin dato**. Pónlo en §8 como caso que no avisa, o decide la regla.
- **N-3.** §14 y la respuesta N-4 no recogen el tope de 300 ni los avisos sin marcar.
  - `deliver` hace `continue` sin marcar si no hay chat vinculado (`:27`) o si la decisión no es `send` (`:29`).
  - La consulta (`:49`) trae todos los tipos sin enviar de las últimas 12 h en orden ascendente, con tope 300. Los más nuevos, los `money`, son los primeros en quedarse fuera si hay más de 300 antiguos.
  - Cota derivada del código, sin cifras inventadas: como máximo 26 filas `money` por persona y empresa en esa ventana (2 tipos × 13 franjas horarias UTC).
  - No pasa por `deliverJobNotice` porque no tiene `job_id` (`:43`). Solo por la tanda.
  - Riesgo real: **sin dato** (volumen de avisos y de personas con Telegram).
- **N-4.** La deduplicación por hora no evita la ráfaga al terminar el silencio.
  - Cada hora UTC con actividad deja una fila retenida. Al terminar el silencio salen todas juntas con el mismo texto. Con el silencio por defecto de 10 h, son hasta una por hora con actividad y por tipo.
  - No lo dice ningún apartado.
- **N-5.** El umbral de pérdida por silencio es «12 h o más», no «más de 12 h» (§14).
  - Con silencio de 10 h por defecto y cron horario, la edad máxima al primer envío es inferior a 11 h, así que cabe en las 12 h.
  - Con 12 h exactas, un aviso creado en la hora anterior ya pasa de 12 h (12 h más hasta 1 h de espera).
  - Supone que el cron corre en punto, y eso no está en el repo.
- **N-6.** El aviso de un evento de hace 20 h no sale de la ventana de la tanda.
  - La ventana cuenta desde `created_at`, que es `now()`, no desde la fecha del evento. Es coherente.
  - El texto «nuevos» puede referirse a un evento de hasta 24 h, y no pasa nada.
- **N-7.** `types.ts`: «se regenera, no se edita a mano» no tiene responsable ni base de la que regenerar.
  - El agente no puede tocar producción. Las ramas previas editaron `types.ts` en commits normales (`git log origin/main -- src/integrations/supabase/types.ts`).
  - Si añades el binding a `field-catalog.ts` antes de que `types.ts` tenga `notifications.dedupe_key`, falla «every catalogued place is a real column» en `field-catalog.test.ts`.
  - Define quién actualiza `types.ts` y en qué orden.
- **N-8.** Cobertura.
  - Falta un CA para «lead a `opportunity` no avisa» y para el deal creado con etapa nula. §8 lo afirma y U-1 replica `lead_stage_change`, pero ningún CA lo usa.
  - CA-5 tiene la cláusula vacía de «aprobación».
  - CA-8 solapa con CA-7 (es la restricción única en sí).
  - `notices.test.ts`: el cliente falso necesita también `channel_links`, `notification_prefs` y `org_members`, y un `is(null)`/`update` con estado para probar «una sola vez». Es viable, pero el SDD solo describe la cadena de la consulta.
- **N-9.** U-1 no es ejecutable «tal como están en producción» (ver B-2). Guarda en el SDD el texto de `lead_stage_change` y `track_deal_changes` o di que se reconstruyen desde `0012`/`0002` más los dos deltas. Además §5 habla de «extender el arnés» y U-1 dice «sin tocar `build()`».
- **N-10.** CA-13: «si no hay destinatarios… el fallo DEBE quedar como advertencia» no se cumple (0 filas, 0 advertencias). Reescríbelo.
- **N-11.** H-5 promete que no se rompe lo que originó el aviso. `QUERY_CANCELED` no lo atrapa `exception when others` (documentado, no probado).
  - Si otra transacción deja sin confirmar la misma clave y un `statement_timeout` corta la espera, la escritura del usuario sí falla. Es raro (solo scripts o migraciones largas), pero §13 no lo conecta con CA-13.
  - Una alternativa menos arriesgada para el bloqueo no la validé.
- **N-12.** Pertenencia en la tanda (CA-11).
  - Con texto fijo ya no protege nada sensible; arregla un hueco previo de otros tipos.
  - Si se implementa dentro de `deliver`, también cambia `deliverJobNotice` y `notifyAutopilot`.
  - Declara el motivo. Faltaría añadir `org_id` a `COLS` y al tipo `Notice` (`notices.server.ts:9,39`).
- **N-13.** Pequeños.
  - El copy dice «Míralos en Deals» pero la pantalla se llama «Pipeline» (`nav.ts:14`, `deals.tsx:40`).
  - El SDD no nombra función ni triggers. El orden de disparo entre AFTER no importa (probado), pero conviene fijar nombres. No hay colisión con `money_` ni con los triggers existentes.
  - No menciona migraciones futuras que actualicen etapas en lote: avisarían, acotadas a un aviso por hora.
  - El coste del lote es lineal en el número de filas (probado: 20.000 llamadas) y no hay medida en producción.
- **N-14.** La medida «106 ms / 323 ms» de §3 no tiene archivo de evidencia (`GROUND-RULES` regla 7). Quítala o apunta a su evidencia.

### Lo que esta revisión NO demuestra

- Nada de la base viva (§3) ni que su estado coincida con la réplica.
- Concurrencia real, bloqueos, interbloqueos ni el comportamiento con `statement_timeout`.
- Coste en producción de las subtransacciones del bloque `exception` (un solo lote en wasm).
- Que las migraciones se puedan aplicar hoy por Lovable, ni que otra rama no reclame 0074.
- Cuándo corre el cron, ni dónde se verían las advertencias.
- El comportamiento real del toast ni de la navegación a `/leads?vista=lista`.
- Que `vi.mock` funcione con el `import()` dinámico de `telegram.server` (no ejecuté vitest).
- Los volúmenes reales (leads en SQL, deals ganados, Telegram vinculado). **Sin dato.**
- Que el nuevo concepto pase `field-catalog.test.ts` y `field-coverage.test.ts`: no los ejecuté. Solo leí sus reglas.

### Cuarta pasada (sobre la v4)
_Informe del agente gate (contexto fresco, solo lectura), copiado sin editar el 2026-10-30. Las líneas y los CA citados son los de la v4; la v5 responde a cada objeción en §15. No aprueba el SDD: informa._

## Informe del gate sobre la v4 del SDD NK-0030 (cuarta revisión)

**Refs leídas.** `origin/main` = `dcea201`, ref local sin `git fetch`, leída con `git show`, `ls-tree` y `git archive` a un directorio fuera del repo. El checkout `feat/software-factory` (`9e744cb`, 152 commits por detrás de `origin/main`) solo lo usé para el SDD y los documentos de la factory.

**Experimentos.** Los hice en PGlite 0.5.12, que es PostgreSQL 18.6. Los scripts están en `/private/tmp/claude-501/-Users-fedecosentino-NOKKO-GTM-BRAIN/8193f42e-91c9-4b72-9e47-d93bfb065866/scratchpad/` (`exp1.cjs`, `exp2.cjs`, `exp3.cjs`, `setup.sql`). Réplica mínima: `leads`, `deals`, `notifications` con `unique(user_id, dedupe_key)`, réplicas de `lead_stage_change` y `track_deal_changes` (con su `update ... closed_at` anidado), y el diseño completo de §13.

## Veredicto del gate
**Objeciones** (2 bloqueantes, 14 no bloqueantes). El diseño de triggers funciona en la réplica. Lo bloqueante es de especificación y de proceso, no de mecanismo.

## Verificación de la tabla de respuestas del §15
- **B-1 `coalesce(closed_at, now())`:** confirmada. Reabrir y re-ganar con el `closed_at` antiguo intacto avisa (CA-7). Un deal ganado por primera vez (open → won) con `closed_at` nulo avisa, y un importado con cierre antiguo no avisa (exp1). Queda un residuo: un reabierto que el panel vuelve a ganar con la misma fecha histórica también avisa, porque `closed_at` no cambia (N-2).
- **B-2 reenvío perdido en `deliver`:** confirmada. Ya no hay UPDATE del aviso. Queda un riesgo previo que no menciona (N-4).
- **B-3 UPDATE no visible y toast no-op:** confirmada para el UPDATE. Solo hay INSERT en `background.tsx:99` y `notification-center.tsx:37`. Efecto lateral no declarado: el toast sale igualmente en cada aviso (N-6).
- **N-1 «sin históricos» depende de fechas:** parcial. §8 cubre el CSV sin fecha, pero no la ruta de actualización de la ingesta (N-2).
- **N-2 destinatarios por fila:** confirmada. Con dos responsables en una sentencia, cada uno recibe título individual y los líderes el genérico. CA-4 da un único aviso (exp1).
- **N-3 orden de bloqueo:** parcial. `ORDER BY user_id` no ordena entre empresas de una misma persona, y el bloqueo real no se prueba en PGlite (N-3).
- **N-4 recuento:** confirmada.
- **N-5 catálogo de campos:** confirmada. `dedupe_key` no está catalogada y `notifications` solo está en la línea base (`field-baseline.ts:58`). Existen precedentes en la línea base (`:30` y `:85`), pero la regla `field-baseline.ts:2-3` obliga a catalogar la columna nueva.
- **N-6 límites de texto:** confirmada. Los límites reales son título ≤300, cuerpo ≤1000 y enlace ≤500 (`0049_notifications_center.sql:14-16`).
- **N-7 rastro de CA-20:** parcial. Es un límite reconocido, sin mitigación. La prueba sí puede capturar la advertencia con `onNotice` (exp1: la escritura del lead persiste y llega «money notice failed: boom»).
- **N-8 Telegram a quien dejó la empresa:** parcial. La comprobación de pertenencia es implementable, pero CA-14 no cubre todo (N-4).
- **N-9 CA-14 con cliente falso:** parcial. Un falso que implemente el filtro prueba el uso de la consulta, no la semántica de PostgREST. El falso necesita `.range`, y `deliver` importa `telegram.server` de forma dinámica, así que hay que simular ese módulo.
- **N-10 piezas sin CA:** parcial. CA-17 y CA-18 no fijan nombres ni firmas, y la unión con las pantallas no tiene prueba (N-7).
- **N-11 aplicación por Lovable:** parcial. `../PLAN-orden-migraciones.md:213` registra migraciones aplicadas el 2026-10-28, así que el bloqueo por créditos citado puede estar superado. Sigue [Por verificar].
- **N-12 sin ruta de lista filtrada:** confirmada. `leads.index.tsx:29-34` acepta `lead`, `late`, `orden` y `vista`. `deals.tsx:35-37` solo acepta `deal`.
- **N-13 reloj en tests:** parcial. Leer la clave de la fila resuelve CA-11, pero no CA-3 («otra hora») ni el cruce de hora en CA-8 y CA-9 (B-1).
- **N-14 triggers de `deals` no listados:** parcial. Las citas son correctas (`0001:144`, `0064:36`, `0002:175`). Faltan `deals_stage_check` y `deal_lines_sync`, solo visibles en migraciones comentadas, y `deal_lines_sync` hace UPDATE de `deals` desde una función anidada.
- **Contradicciones corregidas:** parcial. Arnés, niveles, CA-5/CA-6 y la cita de `AGENTS.md:12` están bien. Quedan dos citas de línea incorrectas (ver más abajo).
- **CA negativos con control positivo:** confirmada como diseño. Cada negativo falla antes si el positivo falla sin migración. CA-20 necesita positivo y fallo forzado en el mismo test.
- **CA-9 y toast sin prueba:** confirmada. CA-9 queda redundante con CA-8 y el toast sigue activo (N-6).

## CA sin prueba posible o sin G-n
Todos los CA citan G-n.
- **CA-3, parte «otra hora»:** sin técnica definida (B-1).
- **CA-17 y CA-18, parte de la unión con las pantallas:** sin prueba automática. El SDD lo declara, y choca con `EXECUTION.md` §4 (cada CA con prueba automática).
- **CA-12/CA-14 frente a G-1 «en Telegram»:** ningún CA prueba que un aviso `money` se envíe una vez y se marque enviado.
- **Unidades:** ninguna unidad de §12 queda sin CA y ningún CA queda sin unidad.

## [Por verificar] que sigue sin comprobarse
- Triggers vivos de `leads`, `deals` y `notifications` (`pg_trigger`), políticas vivas, nombre real del CHECK de `notifications.kind` y versión de PostgreSQL de producción.
- Clave fija `won`: solo consta en `0023_deal_stages.sql`, que está comentada.
- Cron horario y dónde se leerían las advertencias de CA-20.
- Concurrencia real, espera por clave en curso y `statement_timeout`. En PGlite `statement_timeout` no se aplicó, así que mi prueba (exp3) no concluye.
- Cauce de aplicación en producción hoy.
- Enlace público, bot de Telegram, MCP, Stripe y `intake.server.ts`: no los leí.
- Latencia real de Realtime («inmediato»).
- Estado de 0058.
- Coste del trigger en producción. Solo tengo una medida local (ver «Lo que esta revisión NO demuestra»).

## Contradicciones con el código o con decisiones previas
- §5 («no se toca el toast») frente a `background.tsx:99-104`: cada INSERT `money` lanza un toast de 15 s, también al autor (§15, P3). No se declara.
- `EXECUTION.md` §1 y §6 (parar ante un [Por verificar] no comprobable) frente a U-1 (leer `pg_trigger` en la base viva, que ningún agente puede hacer): un agente de la factory se detiene en U-1.
- CA-13 dice que hoy devuelve `"skip"`. Solo es cierto con el nivel `important` (`jobs.ts:128-139`). Con `all` ya devuelve `"hold"`.
- §10 afirma que quien recibe el aviso «ya ve esas filas». Es cierto, pero no por ser líder o responsable: la RLS de `leads` y `deals` deja leer a todo miembro de la empresa activa (`0012_lead_funnel.sql:41-42` y bucle de `0002_multitenant_organizations.sql:119-125`). Roles de `app_role`: `owner`, `sales_leader`, `marketing`, `sdr`, `ae`, `se`, `cs`, `deal_desk`, `enablement` (`0000_migration.sql:1`). Un Owner o Sales Leader ve siempre todo lo de su empresa activa. No hay fuga por RLS; el riesgo es el tercero (Telegram).
- Cifra sin fuente: el umbral de 7 dígitos de CA-15 no tiene origen documentado.

## Citas del SDD incorrectas
- `0012_lead_funnel.sql:22`: `owner_id` está en `:16`.
- `0000_migration.sql:114`: `deals.owner_id` está en `:117` (`:114` es `close_date`).
- `0050_background_jobs_all_actions.sql:1-8` como precedente de ampliar `notifications.kind`: ese rango amplía `background_jobs_kind_check`, otra tabla.
- `field-baseline.ts:95` es `BASELINE`. El techo es `BASELINE_MAX` en `:98`.
- Verificadas y correctas: `notices.server.ts:16-23`, `:25-35` y `:48-50`; `jobs.ts:103-108` y `:128-133`; `jobs.test.ts:79-89`; `notice-prefs.tsx:72`; `notification-center.tsx:17` y `:37`; `won-deals-panel.tsx:174-178`; `leads-ingest.ts:72,101,134-157`; `won-deals.ts:15`; `leads.index.tsx:29-34`; `deals.tsx:35-37`; `pg-harness.ts:21-22,120`; `package.json:86`; `proactive.ts:27`; `AGENTS.md:12`; `discoveries.functions.ts:67`; `leads.ts:330`; `imports.functions.ts:68-73`; `0056:2`; `0002:175`.
- Migración: 0074 está libre (ninguna ref local la reclama). `idx` 73 y `when` > 1793749600000 son correctos hoy. El comprobador pasa sin errores sobre `origin/main`, y contra este checkout da 16 errores, como dice §14.

## Objeciones bloqueantes

**B-1. La clave horaria no dice de qué hora es, y CA-3, CA-8 y CA-9 no pueden demostrarla.**
- §10 dice «hora UTC truncada» sin sujeto. Si es la hora del evento, un CSV con fechas de las últimas 24 h genera hasta 24 avisos por destinatario y rompe CA-9 sin que ninguna prueba lo detecte, porque CA-9 usa filas sin fecha.
- PGlite no permite fijar `now()`. «Re-entrada en otra hora» (CA-3) queda sin técnica de prueba.
- Dos inserciones seguidas que crucen el minuto :00 dan dos avisos y hacen fallar CA-9.
- Hay que especificar la hora de `now()` de la transacción (el repo ya usa clave horaria UTC en `inngest/events.ts:28`). Hay que definir cómo mover la hora en pruebas, por ejemplo reescribiendo el `dedupe_key` del aviso existente. Hay que decir cómo evitar la intermitencia al cruzar la hora.

**B-2. §16 y U-1 dependen de datos de la base viva que ningún agente puede leer, y el SDD no dice qué pedir.**
- `EXECUTION.md` §1 y §6 obligan a parar.
- Hay que listar las consultas para Fede o Dani: `pg_get_triggerdef` de los triggers no internos de `leads`, `deals` y `notifications`, `pg_get_constraintdef` del CHECK de `kind`, las políticas de esas tres tablas y `server_version`.
- Alternativa: aceptar la réplica desde las migraciones 0001, 0002 y 0012, y declarar como no replicados `deals_stage_check` y `deal_lines_sync`.

## Objeciones no bloqueantes

**N-1. Título individual desactualizado.**
- Con tres inserciones en la misma hora, los cuatro destinatarios reciben «Un lead de Primero ha llegado a SQL» y el enlace apunta solo al primero (exp1).
- No es falso, pero sí incompleto. Es peor para los líderes: la regla de CA-10 los trata distinto según el orden de llegada.
- Con `INSERT ... ON CONFLICT DO UPDATE` el trigger de inserción y el de actualización cuentan por separado. Los líderes ven «OC1» aunque la sentencia tuvo dos eventos.
- Recomendación: título siempre genérico, o añadir «puede haber más».

**N-2. Casos de fecha de evento (exp1, réplica).**
- Avisa de lo que no debería:
  - Un reabierto que el panel vuelve a ganar con la misma fecha histórica.
  - Un deal insertado ya `won` sin `closed_at` por agente o MCP (`track_deal_changes` no estampa en INSERT).
  - La ruta de actualización de `leads-ingest.ts:87-93` ignora `enteredAt` (`:72`). Un re-sync de un CRM con leads existentes que pasan a SQL avisa con `now()`.
- Deja de avisar de lo que debería:
  - Si `closed_at` cambia a `NULL`, la comparación da `NULL` y no avisa. La regla no cubre ese caso; usa `coalesce`.
  - El día de ayer del panel tras el mediodía UTC (ya está en §8).
- Comportamientos correctos que sí comprobé:
  - Primera victoria: la tabla de transición ve `closed_at` nulo en `old` y en `new`, aunque `deals_track` lo estampe después. El UPDATE anidado se dispara antes y ve won → won, así que no avisa.
  - Inserción con fecha antigua: no avisa.
  - Reescritura de `closed_at` en un deal ya `won`: no avisa.
  - Inserción de lead con `created_at` histórico: queda antiguo, porque `lead_stage_change` usa `coalesce(created_at, now())`.

**N-3. Bloqueo y espera.**
- `ON CONFLICT DO NOTHING` espera si otra transacción tiene sin confirmar la misma clave, y eso puede frenar la escritura del lead o del deal.
- Según la documentación de PostgreSQL (no probado aquí), `exception when others` no atrapa `QUERY_CANCELED`.
- Ordena por `(user_id, dedupe_key)`.
- `DISTINCT` sobra: con `DO NOTHING`, las claves duplicadas dentro de una sentencia no fallan (exp3).
- Si factorizas un helper `security definer`, hay que hacer `revoke execute`, como `seed_deal_stages`. La advertencia no debe incluir datos de la fila.

**N-4. `flushHeldNotices`.**
- Sí es implementable con supabase-js: no hay FK desde `notifications.user_id` (`0049:11`), así que no se puede embeber. Hay que cargar mapas de vínculos, preferencias y pertenencia, y paginar con `.range` filtrando en JS.
- `deliver` ya usa `.in("user_id", …)` (`notices.server.ts:17-19`). Con listas largas, la URL crece.
- Los avisos en `hold` (silencio actual de su destinatario) también consumen el límite de 300, y CA-14 solo habla de preferencia y vínculo. Define «enviable» como decisión `send`.
- `deliver` ignora el error al marcar enviado (`notices.server.ts:32`). Si falla, se reenvía cada hora durante la ventana; con 24 h la exposición se duplica. Los avisos `money` no pasan por `deliverJobNotice`, así que no hay carrera con `deliver`. La posible doble ejecución de la tanda está protegida por el arrendamiento de 5 minutos (`proactive.ts:16-22`).

**N-5. La ventana de 24 h no está justificada.**
- 12 h cubre el silencio por defecto 22 → 8 (10 h, `DEFAULT_PREFS`, `jobs.ts:102`). Solo hace falta más con silencios de más de 12 h.
- Cambia el comportamiento de todos los avisos y obliga a CA-18.

**N-6. Toast y Centro de avisos.**
- Cada INSERT lanza un `toast.success` de 15 s, incluido el autor.
- El texto vacío del centro («Cuando Nokko termine algo…») deja de ser exacto.
- El copy «Ganado» está fijo, pero la etiqueta de la etapa es editable por empresa.

**N-7. CA-17 y CA-18.**
- No tienen nombre ni firma de función. Las aserciones serían casi tautológicas («contiene 24», «dinero»).
- Añadir `money: "Dinero"` al mapa `KIND` es un cambio de una línea.

**N-8. Redundancias y falta de un positivo.**
- CA-9 y CA-11 repiten CA-8. CA-13 repite CA-12.
- Falta un positivo en `notices.test.ts`: un aviso `money` elegible se envía una vez y queda marcado.

**N-9. Pruebas e infraestructura.**
- El arnés trae `current_org`, `is_org_member`, `has_org_role`, `set_audit`, `auth.uid` y los roles. Faltan `leads`, `deals`, `deal_stage_history` (la usa `deals_track`), `notifications` (0049 no corre en PGlite por `alter publication` y `background_jobs`), `organizations.archived_at` y un usuario `sales_leader` en el seed.
- Las pruebas existentes definen sus tablas dentro del propio test (`strategy-f0.pg.test.ts`). Hacerlo así evita tocar `build()`, que comparten 6 pruebas.
- U-1 es realista salvo la lectura de la base viva (B-2).

**N-10. Migración.**
- `idx` 73 no es estable. `../PLAN-orden-migraciones.md:118` mueve la 0059 de Drive al final del diario, y esa tomaría el 73. Recalcula al fusionar.
- `types.ts` es generado: una edición a mano puede perderse.

**N-11. Privacidad.**
- CA-15 da falsos positivos (fechas dentro del nombre) y no cubre nombres de persona.
- Un título siempre genérico elimina el riesgo, CA-10, CA-15, la función de enmascarado y parte de CA-16.

**N-12. Alcance mínimo.** Sí se puede entregar menos con el mismo valor básico:
- Triggers por fila con cláusula `WHEN` (solo transición, sin tablas de transición) y título genérico. Coste cero en actualizaciones sin transición, y desaparecen CA-10, CA-15 y el recuento por destinatario.
- Mantener 12 h y añadir solo la comprobación de pertenencia (la parte con valor de CA-14), sin paginar hasta reunir 300.
- Dejar el copy de preferencias y la etiqueta como ediciones de texto, no como funciones puras.
- Opcional, decisión de Fede: empezar solo con deals Ganados (raros, sin riesgo de ráfaga), o dejar el primer evento de la hora solo para leads.
- Esto no cambia el hecho de que el segundo deal ganado de una hora no avisa (§15, P1 sigue abierta).

**N-13. Rol Consejo y recuento de transiciones.**
- Consejo vive fuera de `org_members` (SDD-1a, `SDD-20261030-gtm-control-tower-1a-core.md:13`). Coherente con §8; sigue siendo [Por verificar] hasta que exista el rol.

**N-14. Documentación.**
- Tras entregar, actualiza `src/lib/AGENTS.md:47` (avisos y Telegram), siguiendo la convención del repo.

## Lo que esta revisión NO demuestra
- No ejecuté `scripts/factory/gate.mjs`, `flake.mjs` ni ninguna prueba del repo.
- No leí la base viva, ni su versión de PostgreSQL, ni sus triggers ni políticas.
- Las réplicas son mías. No copian los triggers vivos de `deals` ni las políticas.
- PGlite tiene una sola conexión y no aplicó `statement_timeout`. No demuestro bloqueos, esperas ni concurrencia.
- La única medida de coste es local, en PGlite (wasm), con una réplica mía basada en `jsonb`. Sobre 20.000 filas, actualizar sin cambio de etapa tardó 112 ms sin triggers y 115 ms con ellos; pasar las 20.000 a SQL tardó 106 ms y 323 ms; 300 actualizaciones de una fila, 64 ms y 79 ms. No es extrapolable a producción.
- No probé supabase-js ni PostgREST reales: la viabilidad de N-4 sale de leer el código y los tipos.
- No verifiqué la latencia de Realtime ni el cron horario.
- No revisé el enlace público, `intake.server.ts`, el bot de Telegram, MCP ni Stripe.
- Dejé fuera el §17 y no revisé las pantallas más allá de las líneas citadas.

### Tercera pasada (sobre la v3)
_Informe del agente gate (contexto fresco, solo lectura), copiado sin editar el 2026-10-30. Las líneas y los CA citados son los de la v3; la v4 responde a cada objeción en §15. No aprueba el SDD: informa._

**Veredicto del gate: Objeciones**

Leí `origin/main` = `dcea201` con `git show` (sin `git fetch`). El SDD lo leí del checkout `feat/software-factory`. `notices.server.ts`, `jobs.ts`, `background.tsx` y `notification-center.tsx` son idénticos en ambos refs (`git diff` sin salida). Los experimentos fueron en memoria con PGlite 0.5.12 y réplicas mínimas. No creé nada en el repo.

## Verificación de la tabla del §15
- **B-1 resumen por sentencia: parcial.** La ventana horaria funciona si se agrupa por empresa y persona. Sin agrupar, PGlite devuelve «ON CONFLICT DO UPDATE command cannot affect row a second time» y se revierte el INSERT del lead. Con `exception when others` ese fallo se tragaría y se perderían los avisos. «Sin históricos» solo se cumple con fechas (N-1) y falla con el deal re-ganado (B-1).
- **B-2 clave por transacción: parcial.** Comparar old/new evita duplicados: en un upsert, lo insertado y lo actualizado son filas disjuntas (probado). Pero la clave por hora más `coalesce(closed_at, now())` rompe CA-7 (B-1).
- **B-3 premisa de PGlite: parcial.** `origin/main` sí tiene `src/test/pg-harness.ts` y 6 `*.pg.test.ts` en `src/lib/` (p. ej. `strategy-f0.pg.test.ts`, con `// @vitest-environment node`), y `vitest.config.ts` los incluye. Pero §3 dice que el arnés no tiene `org_members`, y sí lo tiene (`pg-harness.ts:21-22,120`, con `organizations`). Solo falta `archived_at`. Además U-1 pide «tras leer los triggers vivos», y ningún agente de la factory puede leer la base viva.
- **N-1 viabilidad: confirmada con matiz.** `set_audit` ya lanza excepción en un INSERT sin `org_id` (pg-harness.ts:27-33 replica el real). `RAISE WARNING` llega al cliente con `onNotice` en PGlite, así que CA-18 es probable. Ver N-6 y N-7.
- **N-2: confirmada.** El resumen por sentencia quedó reemplazado.
- **N-3 destinatarios: parcial.** Archivada y `org_id` nulo están en CA-17. Falta el miembro retirado (N-8).
- **N-4 `flushHeldNotices`: parcial.** CA-14 dice qué, pero no cómo filtrar antes del límite: `notifications.user_id` no tiene clave ajena y supabase-js no hace ese join. Además existe la carrera de B-2.
- **N-5 Centro de avisos: confirmada con matiz.** La etiqueta está en línea en `notification-center.tsx:17` (`KIND`). Una función pura en `jobs.ts` es posible. El SDD no nombra `notification-center.tsx` en §5, §6 ni §12, y CA-16 aparece en U-3 y en U-5.
- **N-6 migración: confirmada.**
  - La 0074 está libre en `origin/main`: los ficheros llegan a 0073 y el diario termina en idx 72 con `when` 1793749600000.
  - Ningún ref local tiene 007[4-9].
  - Es una comprobación solo de refs locales; no hay `fetch`.
  - El CHECK está en línea (`0049:13`) y ninguna migración posterior toca `notifications.kind`.
  - El script `../check-migration-journal.mjs` comprueba: un fichero por número, entrada de diario por cada `.sql`, `idx` igual a la posición, `when` creciente, que lo de main no se edite y que lo nuevo supere el `when` máximo de main.
- **N-7 types y catálogo: parcial.** Hace falta un CONCEPT nuevo (ver N-5).
- **N-8 teléfonos y nombres de persona: parcial.** Falta lo que se describe en N-6.
- **N-9 trabajo sin contar: parcial.** Hay dos piezas sin CA (N-10).
- **CA sin prueba: parcial.**
  - CA-7 se reformuló, pero su comportamiento es falso en el código (B-1).
  - CA-12 es correcto: solo falla antes la aserción de «important», contra `jobs.test.ts:79-89`.
  - CA-14 es posible con cliente falso, pero frágil (N-9).
- **Casos de §8 sin CA: confirmada.** Existen CA-4, CA-7, CA-17 y CA-18.
- **Contradicción `notice-prefs.tsx` y toast: parcial.** El copy está en §6 y U-5, pero «toast solo en inserciones» ya es el comportamiento actual (B-3).

## CA sin prueba posible o sin G-n
Todos los CA tienen G-n. Sin prueba posible tal como están redactados:
- **CA-9, parte del toast.** No existe ninguna «regla del toast» como función pura. El único toast sale del handler de INSERT en `background.tsx:99-104`. Un test en `jobs.test.ts` no tiene nada que probar y no falla antes (regla 5 de GROUND-RULES).
- **CA-2, CA-6, CA-17 (partes negativas) y CA-18 («no revierte»).** Pasan sin la migración, porque sin trigger no hay avisos. Hace falta un control positivo en el mismo test que sí falle antes.

## [Por verificar] que sigue sin comprobarse
- **Triggers vivos, nombre real del CHECK y versión de PostgreSQL de producción.** No comprobable. `0023` y `0024` están comentadas, así que la clave fija `won` tampoco está demostrada en la base viva.
- **Cron horario de la tanda** (`proactive.ts:17,27` solo prueba el endpoint). La hora exacta del cron cambia cuántos reenvíos hay.
- **Caminos de Telegram, MCP, Stripe y enlace público.** No leídos por mí.
- **Interbloqueo real.** PGlite tiene una sola conexión, así que no pude simular dos transacciones concurrentes sobre la misma clave.
- **Estado de la migración 0058.**
- **Rol Consejo.**
- **Aplicación en producción** (N-11).

Verificados por mí:
- Una actualización de `notifications` no abre toast (`background.tsx:99` solo escucha INSERT).
- No hay ruta de lista filtrada. `/leads` solo acepta `lead`, `late`, `orden` y `vista` (`leads.index.tsx:29-34`), y `/deals` solo `deal` (`deals.tsx:35-37`). Los enlaces `?lead=` y `?deal=` sí existen.

## Contradicciones con el código o decisiones previas
- **§3, línea 36 del SDD.** Dice que el arnés no tiene `org_members`; `pg-harness.ts:22,120` sí lo tiene.
- **§14.** Cita `AGENTS.md:54`, pero `AGENTS.md` tiene 31 líneas en ambos refs y no menciona 0058. La contradicción no es reproducible.
- **CA-12.** Usa «Todo» y «Apagado», pero los nombres reales son «Todo lo que termine» y «Nada por Telegram» (`jobs.ts:103-108`), y §9 promete usar los reales.
- **CA-6 frente a CA-5.** CA-6 habla de «cierre o la entrada» para deals, pero CA-5 solo define `closed_at`.
- **§1.** Dice «el aviso en la app es inmediato», pero el Centro no se actualiza con los cambios de recuento (B-3).
- **§14.** No menciona que `PLAN-orden-migraciones.md:227` dice que las migraciones se aplican por chat con Lovable y que el espacio estaba sin créditos el 2026-10-27 (N-11).

## Objeciones bloqueantes

**B-1. CA-7 es falso con `coalesce(closed_at, now())` (CA-5, CA-7, §8).**
- `deals_track` solo estampa `closed_at` si está vacío (`0002_multitenant_organizations.sql:175`) y nada lo borra al reabrir.
- La búsqueda de `closed_at: null` solo encuentra `stale-deal.ts:9`, un detector.
- Réplica: en la primera victoria la tabla de transición ve `closed_at` nulo, así que `now()` es correcto. En reabrir y volver a ganar ve `closed_at` antiguo (5 días en mi réplica), así que el deal no avisa.
- Es inconsistente según el camino:
  - `leads-ingest.ts:134` y `won-deals-panel.tsx:174` reescriben `closed_at`.
  - `approvals.tsx:32` y el tablero solo cambian `stage`.
- Un deal insertado ya como `won` tampoco recibe `closed_at`: el INSERT de `deals_track` no lo estampa, queda nulo y avisa.
- Además `won-deals-panel` guarda `closed_at` al mediodía UTC del día elegido (`won-deals.ts:15`). Un día elegido de ayer puede quedar fuera de las 24 h según la hora.
- Corrección posible: usar `closed_at` solo si cambió respecto a `old.closed_at`; si no, `now()`.

**B-2. Pérdida del reenvío de CA-10 en `deliver`.**
- `notices.server.ts:25-35` envía y después hace `update ... eq("id")` sin condición sobre el recuento.
- Si el trigger actualiza el aviso entre el SELECT y ese UPDATE, que son hasta 300 envíos secuenciales, el aviso queda con `telegram_sent_at` y el recuento nuevo nunca sale.
- Necesita un update condicionado (p. ej. por `event_count`), y U-4 no lo cubre. No medí la ventana.

**B-3. La app no ve las actualizaciones, y CA-9 no se puede probar en el toast.**
- `notification-center.tsx:37` y `background.tsx:99` escuchan solo INSERT. Un recuento que sube o un `read_at` que se limpia no se ve hasta el siguiente refetch, y el Centro sigue mostrando `created_at` de la primera vez.
- CA-9 exige un único toast, pero ya ocurre por la restricción única más la escucha de INSERT. U-5 «toast solo en inserciones» es un no-op, sin test que falle antes.
- Hay que añadir `notification-center.tsx` al alcance y decidir qué se prueba.

## Objeciones no bloqueantes
- **N-1. «Sin históricos» depende de que haya fechas.**
  - Leads: `leads-ingest.ts:72,101` solo pasa `created_at` si existe `enteredAt`. Sin él, `stage_entered_at` es `now()` (`0012:65-66`) y un CSV de SQL sin columna de fecha avisa.
  - Deals: `closedAt` es `closeDate` o `now()` (`leads-ingest.ts:128`), y `created_at` no se mira.
  - Reescribe CA-6 y G-3, o pide a Fede la decisión.
- **N-2. Destinatarios por fila, no por empresa.** En PGlite, un responsable de un solo lead recibió recuento 3 (lo correcto es 1) porque el join de destinatarios era por empresa. CA-1 necesita un test con dos leads de distinto responsable en una sentencia. CA-4 sí se cumple si agrupas por (empresa, persona) con `count(distinct id)` y destinatarios por unión.
- **N-3. Orden de bloqueo.** Sin `ORDER BY user_id` en el INSERT...SELECT puede haber interbloqueo entre transacciones. No pude demostrarlo (ver «NO demuestra»).
- **N-4. Recuento de eventos, no de leads o deals.** Una salida y reentrada en la misma hora cuenta 2 y el copy dice «2 leads» para uno solo. Cambia el copy o cuenta distintos.
- **N-5. Catálogo de campos.** `field-baseline.ts:2-3` prohíbe añadir columnas a la lista base y exige catalogarlas. No existe ningún concepto para `dedupe_key` ni `event_count`. La búsqueda en `field-catalog.ts` no encuentra `dedupe`, `count` ni `notif`. Hay que crear conceptos y puntuarlo en U-2.
- **N-6. Límites de texto.** `title` ≤300 y `body` ≤1000 (`0049:14-15`), pero `leads.company` y `deals.name` no tienen tope. Un nombre largo hace fallar el INSERT y CA-18 lo traga sin avisar: falta un `left(...)`.
- **N-7. Registro de CA-18.** Se registra solo como advertencia de Postgres, sin rastro duradero. Falta fijar dónde se lee en producción.
- **N-8. Telegram a quien dejó la empresa.** `deliver` (`notices.server.ts:16-23`) no comprueba pertenencia. Un aviso retenido llega a quien ya no es miembro, con el nombre de la empresa o del deal.
- **N-9. CA-14 con cliente falso.** Es posible (`vi.mock("@/lib/telegram.server")`; en el mismo fichero hay que imitar `from().select().is().gte().order().limit()`), pero solo prueba el límite si el falso implementa el filtro.
- **N-10. Piezas sin CA.** El copy de `notice-prefs.tsx` y el alta de tipos y catálogo (cubierta por `field-coverage.test.ts`, que no es un CA). CA-16 está en dos unidades.
- **N-11. Aplicación en producción.** Que se pueda aplicar la migración depende de Lovable y sus créditos. No comprobé si sigue así hoy.
- **N-12. Enlace de resumen (CA-8, §9).** No hay ruta filtrada por etapa ni por Ganado, así que el enlace solo puede apuntar a la lista sin filtrar (`/leads?vista=lista`, `/deals`).
- **N-13. Fallo de reloj.** La clave usa `now()` y los tests de «misma hora» pueden fallar al cruzar la hora. Hay que inyectar la hora o fijarla.
- **N-14. Triggers de `deals` no listados.** `deals` tiene más triggers aparte de `deals_track`: `deals_slip` (`0001:144`) y `deals_stamp_human_edit` (`0064:36`). Son BEFORE y probablemente inocuos, pero U-1 y §8 no los citan.

## Lo que esta revisión NO demuestra
- Que la migración funcione en la base real: ni versión de PostgreSQL, ni triggers vivos, ni nombre real del CHECK.
- Concurrencia real (bloqueos, interbloqueo, tiempo de espera) ni el coste en tablas calientes: PGlite tiene una sola conexión.
- Cuántos reenvíos habrá en Telegram: el cron no está en el repo.
- Que Realtime entregue o no el UPDATE en producción: leí el código del cliente, pero no ejecuté la app.
- Los caminos de Telegram, MCP, Stripe y enlace público, ni el volumen de uso (sin dato).
- Cobertura de refs remotos (no hay `fetch`).
- Las pruebas del SDD: no las ejecuté. Mis réplicas son juguetes con las funciones de `0002` y `0012` copiadas, no el esquema real.

Evidencia: las réplicas están en el scratchpad (`.../scratchpad/exp/t1.mjs` a `t4.mjs`, con `base.mjs`). No hay ficheros nuevos en el repo.

### Segunda pasada (sobre la v2)
_Informe del agente gate (contexto fresco, solo lectura), copiado sin editar el 2026-10-30. Las líneas y los CA citados son los de la v2; la v3 responde a cada objeción en §15. No aprueba el SDD: informa._

- **Veredicto del gate:** Objeciones. Hay 3 bloqueantes (B-1 a B-3) y 9 no bloqueantes (N-1 a N-9). No apruebo el SDD: informo.

**Base de la revisión.**
- Leí el checkout `feat/software-factory` (`HEAD` = 9e744cb) y lo contrasté con `origin/main` (dcea201, ref local, sin `git fetch`).
- `notices.server.ts`, `jobs.ts`, `jobs.test.ts` y `notification-center.tsx` no difieren entre ambos (`git diff HEAD origin/main --stat` sin salida).
- Hice un experimento desechable en memoria: PGlite 0.5.12 (PostgreSQL 18.6) con tablas de juguete, lanzado con `node -e` desde `node_modules` de un worktree hermano. No creé archivos, no toqué el repo ni ninguna base real, y no usé migraciones del repo.

## CA sin prueba posible o sin G-n

Todos los CA llevan G-n (§4). Estos tienen problemas de prueba:

- **CA-9 y CA-10.** La prueba SQL existe en `origin/main`, pero el CA no se cumple en el caso que importa (B-1) y CA-10 choca con la clave (B-2).
- **CA-15.** No se puede ejercitar por la superficie pública.
  - El trigger solo dispara una vez por transición. `INSERT ... ON CONFLICT DO UPDATE` dispara el trigger de inserción y el de actualización con filas disjuntas (comprobado).
  - La prueba solo puede insertar a mano dos filas con la misma clave, y eso prueba la restricción, no el comportamiento.
  - Un duplicado real solo ocurriría con un lead que sale de SQL y vuelve a entrar en la misma transacción, que es justo el caso en que CA-3 pide avisar (B-2).
- **CA-14.** Es posible, pero la prueba tiene que forzar el fallo del aviso (por ejemplo, un CHECK o un trigger que falla añadido en la réplica de prueba). El CA no lo dice.
- **CA-7.**
  - La parte de retener se prueba en `src/lib/jobs.test.ts` con `telegramDecision({kind:"money"}, null, DEFAULT_PREFS, <hora en silencio>)`. Hoy da `"skip"` (`jobs.ts:128-139`), así que falla antes.
  - La parte de soltar necesita `src/lib/notices.test.ts`, que **no existe**, con `vi.mock("@/lib/telegram.server")` y un cliente falso.
- **CA-8.** Solo se puede probar que el código pide la ventana de 24 h y el filtro. Un cliente falso no prueba la semántica de la base.
- **CA-12.** `src/components/notification-center.test.tsx` **no existe** y hay que crearlo. Hay precedente de prueba de componente con Supabase simulado en `src/components/connections-panel.test.tsx:1-30`. Haría falta simular además `useServerFn`, el router y el canal en tiempo real. Alternativa más barata: extraer la etiqueta a una función pura en `jobs.ts` y probarla en `jobs.test.ts`.
- **CA-6.** Coincido con el SDD: solo la aserción de «Solo lo importante» puede fallar antes.
  - Hoy `telegramWorthy` ya devuelve verdadero para `all` (`jobs.ts:130`) y falso para `decisions` y `off`.
  - Ninguna aserción existente de `jobs.test.ts:79-89` menciona `money` ni `all`, así que ninguna se rompe con el cambio.
  - Las que siguen en verde son:
    - `:80` (`failed`, importante: verdadero)
    - `:81` (`needs_decision`, importante: verdadero)
    - `:82` (`done` + `discover`, importante: verdadero)
    - `:83` (`done` + `complete_account`, importante: falso)
    - `:86` (`failed`, decisiones: falso)
    - `:87` (`needs_decision`, decisiones: verdadero)
    - `:88` (`needs_decision`, apagado: falso)
- **Casos de §8 sin CA:**
  - Deal reabierto y vuelto a ganar.
  - Responsable que no es miembro (CA-1 lo cubre solo a medias).
  - Persona que es Owner y responsable a la vez, que debe recibir un único aviso.
  - Lead insertado directamente en SQL.
  - El enlace del aviso lleva a algo abrible (CA-4 pide enlace al deal; CA-1 no lo pide, aunque §9 sí).

## [Por verificar] que sigue sin comprobarse

- **Triggers de `leads` y `deals` en la base viva.**
  - `drizzle/migrations/0023_deal_stages.sql` es íntegramente comentario (sus cambios «ya están en la base»). Contiene el `lead_stage_change` modificado (`:159-186`), `deals_stage_check` (`:138`) y la clave ajena `deals_stage_fkey`. `0024_products_deal_lines.sql:168` hace lo mismo con `deals_lines_guard`.
  - El repo no demuestra qué triggers tiene hoy la base. La interacción real con los triggers nuevos no está comprobada.
  - Hace falta una lectura de catálogo (`pg_trigger`) antes de implementar.
- **Nombre real del CHECK de `notifications.kind`.** Por la regla de Postgres sería `notifications_kind_check` (CHECK en línea en `0049_notifications_center.sql:13`). No lo comprobé en la base viva.
- **Versión de PostgreSQL de producción.** `supabase/config.toml` solo tiene `project_id`. La réplica PGlite es PG 18.6. Las tablas de transición existen desde PG 10, así que la funcionalidad no está en duda, pero la equivalencia no está demostrada.
- **Que la tanda horaria corre cada hora de verdad.** La ruta existe (`src/routes/api/public/jobs/proactive.ts:27`), pero el cron está fuera del repo.
- **Enlace público y bot de Telegram con empresas archivadas.** `src/lib/intake.server.ts` y `src/routes/api/public/telegram/webhook.ts` no comprueban `archived_at`. El trigger lo resuelve en SQL, pero la prueba de CA-13 debe cubrirlo. No leí el bucle completo de `src/routes/api/public/leads.ts:84`.
- **Rol Consejo.** Sigue pendiente (§8).
- **Cifras de uso:** volumen de leads en SQL, deals ganados por semana y uso de Telegram. Siguen sin dato.
- **Coste del trigger en cada `UPDATE` de leads y deals.** Sin dato: con tablas de transición no se admite lista de columnas ni `WHEN` sobre filas, así que se ejecuta en todas las actualizaciones.
- **Migración 0058.** `AGENTS.md:54` (checkout) dice que no está aplicada. `src/lib/AGENTS.md:54` en `origin/main` dice que sí. No afecta a `notifications`.

## Contradicciones con el código o con decisiones previas

- **§3 y §14** dicen «No hay pruebas de base de datos en el repo / no hay forma de probar SQL».
  - Es cierto solo en este checkout (`package.json` sin PGlite; sin `*.pg.test.ts`).
  - Es falso en `origin/main`:
    - `package.json:86` tiene `@electric-sql/pglite ^0.5.11`.
    - Existe `src/test/pg-harness.ts` (129 líneas).
    - Existen 6 pruebas `*.pg.test.ts`: `experiments`, `migrations`, `migrations-acquisition-motion`, `strategy-execute`, `strategy-f0` y `strategy-review`.
  - `vitest.config.ts` incluye `src/**/*.{test,spec}.{ts,tsx}`, así que se ejecutan con `npm test`.
  - Las pruebas `*.pg.test.ts` de `origin/main` empiezan con `// @vitest-environment node` (p. ej. `strategy-f0.pg.test.ts:1`).
- **Fede decidió «importación masiva: un único resumen» (§1 `:15`).** El código escribe fila a fila: `src/lib/imports.functions.ts:68-73` (aprobación de lote) y `src/lib/leads.functions.ts:30-34` (CSV). Ver B-1.
- **§8 `:99`** («los límites de 200 y 500 filas producen un resumen por sentencia») es falso para esos bucles. Cada fila es una sentencia.
  - El 200 viene de `src/lib/leads.ts:330` y el 500 de `src/lib/imports.functions.ts:53` en `origin/main`.
- **§10 `:117`** (clave por id de transacción) contradice CA-3 y CA-10 (B-2).
- **§5, última viñeta** («no cambiar funciones compartidas por varios llamadores») choca con §6. `telegramWorthy` llega a `deliver` desde tres llamadores: `deliverJobNotice`, `flushHeldNotices` y `notifyAutopilot`.
- **§5 «No incluye tabla de eventos»** limita el remedio de B-1, porque agregar entre sentencias necesita estado.
- **`src/components/notice-prefs.tsx:72`** dice «si no tiene más de 12 horas» y define «Solo lo importante» sin `money`. Con CA-8 y CA-6 ese texto pasa a ser falso. Ninguna unidad del SDD lo cambia.
- **`src/components/background.tsx:96-104`:** cada INSERT en `notifications` abre un toast de 15 s (`toast.success(n.title)`). Es el aviso «inmediato» en la app, pero no aparece en §9 ni en ningún CA, y sin B-1 resuelto produce una ráfaga de toasts.
- **Título de NK-0030** (`.factory/ledger.json:676`): «respuesta positiva, llamada reservada o cancelada y deal ganado». La v2 cubre «lead a SQL» y «Ganado», y deja respuestas y reservas para el SDD-4. Está declarado en §5, pero el ledger no refleja el recorte.
- **`leads_stage` estampa `sql_at` también al saltar a `opportunity`** (`0012_lead_funnel.sql:70`, `idx >= 4`). El embudo cuenta ese lead como llegado a SQL, pero v1 no avisa (§5). Es coherente con la pregunta 2 de §15, pero G-1 queda a medias.
- **`§3 AGENTS.md:12`** está bien citado (línea 12 del checkout).

## Objeciones bloqueantes

**B-1. El resumen por sentencia no cumple la decisión «un único resumen» en importaciones masivas.**
- `importLeads` (`src/lib/leads.functions.ts:30-34`), la aprobación de lotes (`src/lib/imports.functions.ts:68-73`) y, por lo que vi, el enlace público (`src/routes/api/public/leads.ts:84`) llaman a `ingestLead` fila a fila. Cada fila son varias sentencias de 1 fila en transacciones distintas.
- Con un trigger por sentencia, cada fila produce su propio aviso individual (CA-9 exige resumen solo con más de uno en la misma sentencia). Un CSV de hasta 200 filas en SQL o Ganado da hasta 200 avisos y 200 toasts por Owner y Sales Leader.
- Los límites de la tanda se agotan: `flushHeldNotices` máximo 300 (`notices.server.ts:49`), y `deliver` envía en serie.
- Una importación histórica con deals en `won` (`leads-ingest.ts:134-157`) avisa de ventas antiguas. `won-deals-panel.tsx:175-178` registra ganados con fecha de cierre pasada y avisaría igual.
- Hay que decidir una de estas tres cosas:
  - Un cambio de la decisión de Fede.
  - Agregar en el momento de entrega, o acumular en una fila por ventana.
  - Reescribir los bucles para insertar por lotes. Esto sale del alcance de §5 y del principio de «cambio mínimo».
- Además hay que decidir si los deals importados con `closed_at` antiguo avisan.

**B-2. La clave de idempotencia por id de transacción no es coherente con CA-3, CA-10 ni CA-15.**
- Experimento (tablas de juguete, `insert ... on conflict (user_id, key) do nothing`):
  - Dos sentencias en la misma transacción que llevan leads distintos a SQL: solo sale un resumen, con `n = 1`. Los otros 2 leads se pierden sin error.
  - `db.exec("a; b")` usa un único id de transacción (`txid_current()` devolvió 758 en ambas), así que una prueba ingenua de CA-10 con varias sentencias falla.
  - Un lead que sale de SQL y vuelve a entrar en la misma transacción quedaría bloqueado, lo contrario de CA-3.
- Reintentos desde la aplicación: cada llamada de PostgREST es una transacción nueva. Si el reintento repite una escritura que ya salió bien, `old.stage = new.stage` y no hay transición. No hay duplicado. Si la primera falló, el aviso se revierte con ella. En ambos casos el id de transacción no aporta nada. Lo que protege es la comparación `old/new`.
- Con `INSERT ... ON CONFLICT DO UPDATE` ya no hay duplicado posible, porque las filas insertadas y las actualizadas son disjuntas (comprobado).
- La clave de un resumen necesita un componente por sentencia (por ejemplo, el id mínimo del conjunto de filas movidas) o no tener clave única. La de avisos individuales puede usar `stage_entered_at` o `closed_at` de la fila.
- CA-3 y CA-15 tienen que decir en qué transacciones se prueban. CA-10 debe reescribirse: «sentencia» frente a «transacción».

**B-3. La pregunta 1 de §15 parte de una premisa falsa, y U-1 depende de ella.**
- La opción «PGlite» ya existe en `origin/main` (ver arriba).
- Si se implementa sobre esta rama, no existe. Hay que fijar que la base de trabajo sea `origin/main`, o rebasar.
- Qué falta construir:
  - `pg-harness.ts` no tiene `leads`, `deals`, `notifications`, `background_jobs`, `deal_stages` ni los triggers `leads_stage`, `deals_track`, `deals_slip`, `deals_audit`/`set_audit`.
  - Los otros tests ya admiten que «la réplica no es la base» (`strategy-f0.pg.test.ts:3-7`: «los deals reales tienen triggers que 0068 no usa»).
  - Para el SDD, la interacción con `leads_stage` y `deals_track` solo quedará probada si la réplica los incluye. Los triggers de `0023` y `0024` solo se pueden replicar tras leerlos en la base viva.
- La opción outbox queda innecesaria como alternativa. Fede decide con una premisa errónea.
- Las pruebas pasan por PGlite, no por la base real: eso debe quedar escrito en §14 y en el delta de §18.

## Objeciones no bloqueantes

**N-1. Viabilidad técnica del trigger (punto 1). Sin objeción de fondo.** Comprobado en PGlite (PG 18.6) con tablas de juguete:
- El `UPDATE` con `OLD TABLE` y `NEW TABLE` en un trigger por sentencia detecta la transición. El de inserción ve solo las filas insertadas.
- Con `INSERT ... ON CONFLICT DO UPDATE`, la fila insertada pasa por el trigger de inserción y la actualizada por el de actualización.
- Un trigger AFTER por sentencia convive con un AFTER por fila que hace un `UPDATE` del mismo `deals` (como `deals_track` en `0001:120-135`). El `UPDATE` anidado no cambia la etapa y no genera aviso. `closed_at` se estampó igual (`true`).
- Insertar desde el BEFORE de `leads` un deal en `discovery` (`0012_lead_funnel.sql:77-81`) no es `won` y no avisa.
- Postgres rechaza más de un evento por trigger («transition tables cannot be specified for triggers with more than one event»). Rechaza también la lista de columnas. §13 ya lo dice bien.
- Con `session_replication_role = replica` los triggers no disparan (0 avisos). `ALTER TABLE ... DISABLE TRIGGER` hace lo mismo.
  - No hay uso de esto ni de `COPY` en `src`, `drizzle/migrations` ni `supabase/`, pero «sea cual sea el camino» (§1) debería matizarse.
  - `TRUNCATE` no dispara triggers por fila.
- Un `begin ... exception when others then ... end` dentro del trigger traga el fallo y conserva la escritura (CA-14 viable). Loguea con `raise warning` para no perderlo en silencio.
- `leads.org_id` es nullable (`0012_lead_funnel.sql:4`). `set_audit` lo exige no nulo al insertar, pero un `UPDATE` a nulo no. El trigger debe ignorar filas sin `org_id`.

**N-2. Resumen por sentencia (punto 4).** Calcular por persona y empresa con tablas de transición es viable.
- Un único `INSERT ... SELECT` con CTE de destinatarios × filas, agrupado por `org_id`. En el experimento, un lote con dos empresas dio un resumen por empresa (`n = 2` y `n = 1`).
- El destinatario «responsable» ve un subconjunto. Si es de 1, recibe aviso individual; si es de 2 o más, resumen. Los líderes ven el total.
- Un lote con varios responsables y empresas funciona si agrupas por `org_id` y por persona.

**N-3. Destinatarios y multitenant (punto 5).**
- `leads.owner_id` existe (`0012_lead_funnel.sql:22`) y `deals.owner_id` también (`0000_migration.sql:114`). Ninguna tiene clave ajena, así que el responsable puede no ser miembro. Hay que unir con `org_members` (CA-1 ya lo dice).
- `app_role` incluye `owner` y `sales_leader` (`0002_multitenant_organizations.sql:12`).
- La función `security definer` que lee `org_members` y escribe en `notifications` sigue el precedente de `notify_job_end` (`0049_notifications_center.sql:32-34`).
- Empresa archivada: `organizations.archived_at` (`0056_org_lifecycle.sql:2`). El trigger puede filtrarla en SQL y no depende del camino de escritura.
- El Centro de avisos lee `notifications` solo por `user_id` (`notification-center.tsx`, consulta con `.eq("user_id", userId)`). La RLS exige ser miembro de la empresa, no que sea la actual. Quien está en dos empresas verá avisos de ambas y el enlace `/leads?lead=<id>` abrirá la empresa activa, no la del lead. Ya ocurre con los avisos de trabajos, pero `money` lo amplifica y CA-13 no lo cubre.

**N-4. `flushHeldNotices` (punto 6).** El cambio propuesto es correcto pero insuficiente.
- La consulta es `telegram_sent_at is null`, `created_at >= ahora − 12 h`, orden ascendente, límite 300 (`notices.server.ts:48-50`).
- `deliver` solo pone `telegram_sent_at` cuando envía (`:30-33`). Lo que decide `skip` (nivel «Solo lo que necesita mi decisión» o «Nada por Telegram», o un `done` no importante) queda con `telegram_sent_at` nulo y sigue ocupando huecos las 12 h, o 24 h con el cambio. Al ordenar por antigüedad, esos avisos van delante.
- Filtrar solo por «Telegram vinculado» no evita el problema para quien sí lo tiene vinculado con nivel `decisions` u `off`.
- La ventana de 24 h cubre cualquier silencio configurable (`quiet_from` y `quiet_to` van de 0 a 23, `0050_background_jobs_all_actions.sql:25-26`). Con 24 h, un aviso retenido sale hasta 24 h después y, pasado ese tiempo, se pierde.
- Hay que ampliar CA-8 (por nivel y vínculo, no solo vínculo) y decidir el orden o el marcado de `skip`. El volumen es sin dato.

**N-5. Centro de avisos (punto 7).** `KIND` (`notification-center.tsx:17`) y su uso (`:97`) muestran `money` en bruto sin la etiqueta. El SDD lo recoge (CA-12, U-4), pero el archivo de prueba no existe (ver CA).

**N-6. Migración (punto 8).**
- Contra `origin/main`:
  - El diario tiene 73 entradas, de `idx` 0 a 72. La última es `0072_strategy_reviews` con `when` 1793749600000.
  - `0073_strategy_decisions_guard` es `idx` 71 y va antes que `0072` en el diario.
  - Los ficheros llegan a 0073. No existe `0059` en `origin/main`.
  - Ningún ref local (heads y remotos) tiene 0074 u otra mayor.
- La entrada nueva necesita `idx` 73 (el comprobador exige `idx` = posición), número de fichero 0074 y un `when` mayor que 1793749600000 (`check-migration-journal.mjs`, reglas 3 y 5).
- `check-migration-journal.mjs` vive fuera del repo (`../check-migration-journal.mjs`). Contra `HEAD` da 16 errores porque la rama parte de un main antiguo, p. ej. `0059_org_connections` con `when` por debajo del máximo de main.
- El comprobador comprueba:
  - un fichero por número;
  - cada `.sql` con su entrada en el diario y al revés;
  - `idx` igual a la posición y `when` creciente;
  - que no se editen entradas ni ficheros de main;
  - que las entradas nuevas superen el `when` máximo de main.
- Las líneas de `origin/main` pueden estar desfasadas sin `git fetch`: confírmalo antes de reservar 0074.
- El CHECK conviene soltarlo con búsqueda por definición en `pg_constraint`, no solo por nombre. Si el nombre real difiere, `drop constraint if exists notifications_kind_check` no hace nada y la inserción de `money` falla.

**N-7. `types.ts` y el catálogo de campos.**
- La columna `dedupe_key` en `notifications` exige actualizar `src/integrations/supabase/types.ts`.
- `src/lib/field-coverage.test.ts:14-16` falla si una columna del tipo no está en el catálogo (`field-catalog.ts`) ni en la línea base. La línea base solo puede bajar (`field-baseline.ts:95`, `BASELINE_MAX = 980`). `field-baseline.ts:58` lista las columnas actuales de `notifications`.
- Hay que añadir el enlace en `field-catalog.ts`. §12 no lo cuenta como trabajo.

**N-8. Texto de los avisos y privacidad (CA-11).**
- «7 o más dígitos» consecutivos no atrapa teléfonos con espacios o guiones («+34 600 123 456»). Normaliza antes de contar.
- Las empresas que son nombres de persona (`src/lib/discoveries.functions.ts:67`, citado por la primera pasada) viajan a Telegram. CA-11 no lo cubre.
- El actor del cambio (quien mueve el lead) también recibe el aviso de su propia acción. §7 no lo excluye.

**N-9. Trabajo que §12 no cuenta.**
- `notice-prefs.tsx:72` (copy de 12 h y nivel «importante»).
- Toast de `background.tsx:96-104`.
- `types.ts` y el catálogo de campos (N-7).
- Una prueba en `jobs.test.ts` para CA-7 (retener).
- La réplica de PGlite con los triggers reales de `leads` y `deals`.

**Cifras sin fuente.** Ninguna inventada. Las de 200 y 500 filas, 300 avisos y 12 h tienen fuente en el código (citadas arriba). El umbral «más de uno» de CA-9 sigue siendo una decisión, no una medición.

## Lo que esta revisión NO demuestra

- **No ejecuté** `tsc`, lint, `vitest`, `gate.mjs`, `flake.mjs` ni ninguna prueba del repo. El resto fue lectura estática de código y de refs locales con `git show` y `git ls-tree`.
- **El experimento no usó el SQL del SDD ni de las migraciones.**
  - Fue una réplica en miniatura (PGlite 0.5.12, PostgreSQL 18.6), con tablas simplificadas y `org_id` como destinatario.
  - Demuestra el comportamiento de Postgres con tablas de transición, `ON CONFLICT`, `exception` y `session_replication_role`.
  - No demuestra nada sobre la base real de NOKKO ni sobre sus triggers vivos.
- **No consulté ninguna base viva:** ni el CHECK real, ni los triggers reales de `leads` y `deals`, ni la RLS efectiva, ni el volumen, ni qué migraciones están aplicadas.
- **No leí** `src/routes/api/public/telegram/webhook.ts`, las herramientas MCP ni Stripe. Revisé la lista de caminos de escritura solo con `grep` y por la primera pasada.
- **No comprobé** que todo camino pase por PostgREST: transacciones largas desde RPC, funciones SQL o importaciones desde el panel de Supabase no están revisadas.
- **No probé** el comportamiento de `ON CONFLICT` sobre índices parciales; el SDD ya usa `unique` completo.
- **No revisé** el resto de ramas abiertas ni versiones de PostgREST o Supabase.
- **Los refs de `origin/main` pueden estar desfasados** (sin `git fetch`): la numeración 0074 y el `when` mínimo son provisionales.
- **No aprueba el SDD.**

### Primera pasada (sobre la v1 del SDD)
_Informe del agente gate (contexto fresco, solo lectura), copiado sin editar el 2026-10-30. Las líneas y los CA citados son los de la v1; la v2 responde a cada objeción en §15. No aprueba el SDD: informa._

**Base de la revisión.** Leí el checkout `feat/software-factory`, que está desfasado de `origin/main`. Donde el código de `origin/main` difiere, lo indico. Los refs remotos son los locales, sin `git fetch`.

- **Veredicto del gate:** Objeciones. Hay 4 bloqueantes (B-1 a B-4).

- **CA sin prueba posible o sin G-n:**
  - Ningún CA lleva G-n. Con `PRD: No aplica` no puedo comprobar a qué objetivo apunta ninguno.
  - **CA-6** (la parte «Todo», «Decisiones» y «Apagado») ya se cumple en la base. `src/lib/jobs.ts:130-132` ya devuelve verdadero para `all` y falso para `decisions` y `off`. Solo cambia «Importante», en `jobs.ts:133`. Solo esa aserción puede fallar antes.
  - **CA-12** (`proactive.test.ts`) no puede fallar antes. Los detectores no crean avisos hoy (`src/lib/proactive/index.ts:21-25`). Solo prueba algo si el filtro `detector === "stale_deal"` es una función pura que el test llama.
  - **CA-2, CA-5, CA-7 (la parte de soltar) y CA-11** no se prueban con funciones puras. Dependen de:
    - un índice único en base de datos,
    - el cableado de la aprobación,
    - `flushHeldNotices` (`src/lib/notices.server.ts:48`).
  - No hay pruebas `*.pg.test.ts` en este checkout. Hace falta el patrón de puertos con dobles (`connections-core`, `src/lib/AGENTS.md:57`) o PGlite. El SDD solo nombra `money-notices.test.ts`.
  - Los casos límite de §8 no tienen CA-n: otra empresa, empresa archivada, sin destinatarios, fallo del aviso y responsable que no es miembro.

- **[Por verificar] que sigue sin comprobarse:**
  - Número de migración definitivo. Ver B-4. Falta un `git fetch` y confirmar con Fede que ninguna otra rama reclama 0074.
  - Nombre real del CHECK en la base viva. Sería `notifications_kind_check`, porque en `0049_notifications_center.sql:13` es un CHECK en línea. No lo comprobé en la base viva.
  - Rol Consejo. Parcial:
    - Los destinatarios salen de `org_members` (patrón `notices.server.ts:61`).
    - El SDD-1a:47 guarda al Consejo fuera de esa lista, así que por construcción no recibiría avisos.
    - El SDD-1a sigue en Borrador, así que no hay comprobación en ejecución.
  - Número de deals que superan hoy el umbral de `stale_deal`, uso real de Telegram y volumen de leads en SQL. Siguen sin dato.
  - Si el bot de Telegram escribe leads o deals por otra vía. No leí `src/routes/api/public/telegram`.

- **Contradicciones con el código o con decisiones previas:**
  - `AGENTS.md:12`: el acceso a datos va por el cliente del navegador con RLS. Las pantallas escriben leads y deals así (B-1).
  - §13 dice «reutilizar `deliver`», pero `src/lib/notices.server.ts:11` no lo exporta. Es una función privada.
  - §3 dice que la clave es `stale_deal:<deal>:<fecha de última actividad>`. En realidad es `updated_at` del deal (`src/lib/proactive/detectors/stale-deal.ts:17`; `src/lib/stale.ts:46`). Cualquier actualización de la fila lo reinicia.
  - El título de NK-0030 (`.factory/ledger.json:676`) habla de «respuesta positiva» y «llamada reservada o cancelada». El SDD v1 lo reduce a SQL, Ganado y riesgo.
  - `docs/prd/PRD-20261030-gtm-control-tower.md:189` dice que los avisos por Telegram dependen del SDD-4. El bot y `notices.server.ts` ya existen.
  - `AGENTS.md:54` dice que la 0058 no está aplicada. `../PLAN-orden-migraciones.md:227` dice que Fede la dio por aplicada en producción. Cuál es cierta no está comprobado.
  - `../PLAN-orden-migraciones.md` está desfasado respecto a `origin/main`. Reserva 0072 para `account_enrichment` y 0059 para Drive. En `origin/main`, 0072 ya es `strategy_reviews`.
  - Líneas citadas en el SDD:
    - Son del checkout, no de `origin/main`.
    - En `origin/main` se mueven así: `deals.tsx:66` pasa a `:109`, `core-write.ts:91` a `:275`, `org-data.ts:86` a `:155` y `won-deals-panel.tsx:175` a `:174`.
    - `inbox.ts:65` y `approvals.tsx:29` coinciden.

- **Caminos de escritura no cubiertos:**
  - **Lead a SQL.** U-2 nombra «entrada de leads, importación y pantallas». Se escapan o quedan sin concretar:
    - `update_lead` del agente, Telegram, MCP y Sugerencias: `src/lib/agent/tools/core-write.ts:110`, `src/lib/inngest/lead-tasks.server.ts:124` (acción `lead_enriched` con `stage: v.move`).
    - `create_lead` del agente: `src/lib/agent/tools/pipeline.ts:76`.
    - Aprobación de lotes en cuarentena: `src/lib/imports.functions.ts:73`.
    - Alta manual en el navegador: `src/components/leads/lead-dialogs.tsx:34-40`.
    - Edición en el navegador: `src/components/leads/lead-detail.tsx:40-46`.
    - Mover y «Pasar a»: `src/routes/_authenticated/leads.index.tsx:83`.
    - Aplicar la propuesta de calificación: `src/components/leads/lead-qualification.tsx:55,89`.
    - Entradas de `ingestLead` (actualización `src/lib/leads-ingest.ts:87-91`, alta `:97-102`). Se llama desde el enlace público `src/routes/api/public/leads.ts:84` (cliente admin), `src/lib/leads.functions.ts:34` (cliente del usuario), `imports.functions.ts:73` y `pipeline.ts:76`.
    - Un trigger sobre `leads` es el único punto que ve todos los caminos, también el SQL manual: `drizzle/migrations/0012_lead_funnel.sql:57-84` (`stage_entered_at` en `:66`, `sql_at` en `:70`).
  - **Deal en Ganado sin aprobación.** U-3 cubre solo aprobaciones (pantalla y agente):
    - `src/components/won-deals-panel.tsx:175-178` inserta o actualiza `stage: "won"` directamente.
    - `src/lib/leads-ingest.ts:134,140,144-157` deja un deal en Ganado desde el enlace público, el CSV y `create_lead`, con `closed_at`.
    - Nada en base de datos fuerza la aprobación: la regla vive en `deals.tsx:65-69`, `core-write.ts:90-92` y los permisos de esas pantallas.
  - **Deal en riesgo.** `syncSuggestions` se llama desde tres sitios:
    - `src/routes/api/public/jobs/proactive.ts:50` (ruta en línea, filtra `archived_at` en `:28`).
    - `src/lib/inngest/tasks.server.ts:17`.
    - `src/lib/agent.functions.ts:144` (`refreshSuggestions`, con el cliente del usuario, `agent.functions.ts:19`).
    - U-5 solo habla de «el trabajo proactivo».

- **Objeciones bloqueantes:**
  - **B-1. No hay camino para emitir desde las pantallas.**
    - Las pantallas de Leads y Aprobaciones escriben con el cliente del navegador (rutas de la sección anterior).
    - `notifications` solo concede `select` y `update` a `authenticated` (`0049_notifications_center.sql:21`). Insertar exige `service_role`.
    - `deliver` y las funciones de `notices.server.ts` toman un cliente admin.
    - U-2 y U-3 no definen la función de servidor ni el punto de llamada.
    - Hay que decidirlo antes de aprobar: una función de servidor por pantalla, o un trigger. §13 descarta el trigger con un argumento que no demuestra que sea imposible: los roles se consultan en SQL, y el lote se puede resolver con un trigger por sentencia. Un trigger tampoco llama a Telegram. La entrega iría por `flushHeldNotices`, cada hora (`notices.server.ts:48`).
  - **B-2. Los caminos de arriba contradicen la respuesta a §15.2.** La ruta de escritura no es única.
    - Hay que cerrar con Fede si Ganado incluye lo escrito sin aprobación (`won-deals-panel.tsx`, ingesta). §1 lo limita a «cuando la aprobación se aplica».
    - Hay que ampliar U-2 con todos los caminos de lead.
  - **B-3. U-5 no sabe qué Sugerencia es nueva.**
    - `src/lib/org-data.ts:86-89` hace `upsert` con `ignoreDuplicates: true` y no devuelve las filas insertadas.
    - La restricción única es `(org_id, dedupe_key)` (`0007_agent_proactive_channels.sql:92`).
    - Falta decidir cómo se devuelven las nuevas. Eso modifica una función compartida por los tres llamadores.
    - El destinatario «responsable del deal» es `user_id` de la Sugerencia (`stale-deal.ts:23`).
    - En `refreshSuggestions` el cliente es el del usuario. Con RLS no puede leer a los demás miembros.
  - **B-4. Migración.**
    - La rama no sirve de base para el comprobador. `check-migration-journal.mjs` da 16 errores sobre `HEAD` porque parte de un main antiguo (su diario acaba en la 0059).
    - Contra `origin/main`:
      - El diario llega a `idx` 72 (`0072_strategy_reviews`, `when` 1793749600000).
      - `0073_strategy_decisions_guard` está antes en el diario que la 0072.
      - Los ficheros llegan a 0073.
      - La nueva entrada necesita `idx` 73 y un `when` mayor que 1793749600000 (`check-migration-journal.mjs:56-57`).
    - La 0059 no está libre: es `org_connections` en esta rama y `drive_connections` en `origin/feat/connections-own-account-v2`.
    - Entre los refs locales no veo 0074 reclamada. Es candidata, no confirmada.
    - El orden frente a la 0058 no genera dependencia que yo encuentre. La 0058 no toca `notifications`.
    - Precedente de ampliar un CHECK: `0050_background_jobs_all_actions.sql:1-8`.

- **Objeciones no bloqueantes:**
  - **N-1. Índice parcial.**
    - §10 pide `(user_id, dedupe_key)` «donde no sea nulo». Con `upsert` e `ignoreDuplicates` de supabase-js, un índice parcial puede fallar con «no unique constraint matching ON CONFLICT». No lo ejecuté.
    - Un `unique (user_id, dedupe_key)` normal ya admite varios nulos en Postgres.
    - `notifyAutopilot` usa `insert` simple (`notices.server.ts:65`). Con un duplicado fallaría todo el lote.
    - Entrega solo las filas realmente insertadas, para no repetir Telegram.
  - **N-2. `ingestLead` no dice qué cambió.** `IngestResult` no trae etapa anterior ni nueva. Hay que ampliarlo (`leads-ingest.ts:164-172`) y leer `stage_entered_at` para la clave (`lead:<id>:sql:<stage_entered_at>`).
  - **N-3. CA-8 está sin cerrar.**
    - El umbral «más de uno» no encaja con «masiva».
    - El enlace público procesa un registro por petición.
    - Hay límites por operación: 200 filas en `src/lib/leads.ts:330` y 500 por lote aprobado (`imports.functions.ts:46`).
    - No hay clave de idempotencia ni destinatarios para el resumen.
  - **N-4. CA-9 no se puede garantizar solo con una prueba de la función pura.**
    - El nombre del deal es texto libre de hasta 200 caracteres (`won-deals-panel.tsx:178`).
    - Descubiertos usa el nombre de una persona como `company` (`src/lib/discoveries.functions.ts:67`).
    - Falta una regla que enmascare email y teléfono, o acotar el CA.
  - **N-5. Empresa archivada.**
    - El cron la filtra (`proactive.ts:28`).
    - El enlace público no comprueba `archived_at`. No comprobado en `leads.ts` ni `intake.server.ts`.
    - Los caminos de usuario dependen de las membresías que ve cada cliente.
  - **N-6. CA-7.**
    - `flushHeldNotices` solo mira las últimas 12 horas, con un límite de 300 (`notices.server.ts:49`).
    - Con un silencio nocturno de más de 12 horas, un aviso retenido no se suelta.
    - Los avisos de usuarios sin Telegram vinculado consumen esos 300 huecos.
    - No tengo cifras de volumen.
  - **N-7. Centro de avisos.** Sin etiqueta para `money`: `src/components/notification-center.tsx:17,97` mostrará el texto crudo `money`. Ninguna unidad lo cubre.
  - **N-8. Primer pase de `stale_deal`.** El volumen no se puede dimensionar sin consultar la base viva, y la clave se reinicia con cualquier actualización del deal.
  - **N-9. Etiquetas.** El SDD llama «Importante» y «Decisiones» a los niveles. En la interfaz son «Solo lo importante» y «Solo lo que necesita mi decisión» (`jobs.ts:104-107`).

- **Cifras sin fuente.** Ninguna inventada. El 8:00 coincide con el valor por defecto (`0055_daily_email_prefs.sql:2`). El umbral «más de un lead» del CA-8 es una decisión sin justificar.

- **Lo que esta revisión NO demuestra:**
  - No ejecuté `tsc`, lint, `vitest`, `gate.mjs`, `flake.mjs` ni pruebas que fallen antes. Fue lectura estática.
  - No consulté ninguna base viva: ni RLS efectiva de `approvals` y `deals`, ni el nombre del CHECK, ni volúmenes, ni migraciones aplicadas.
  - No ejecuté `upsert` contra Postgres con índice parcial.
  - Revisé la ausencia de otros caminos de escritura solo con `grep`. En `supabase/` y `drizzle/migrations/*.sql` buscaba `sql_at` y `stage_entered_at`, y en `src` las llamadas `from("leads")` y `from("deals")`. No leí `src/routes/api/public/telegram`, MCP ni Stripe. Lo escrito por SQL manual o desde Lovable queda fuera.
  - Los refs de `origin/main` pueden estar desfasados, y no revisé el resto de ramas abiertas.
  - Esta revisión no aprueba el SDD.

## 18. Delta de implementación (lo rellena el agente al entregar)
Implementado U-1 a U-5 el 2026-10-31 en el worktree `seller-strategy-studio-money-notices`, rama `feat/money-notices`, base `dcea201e1ffe56051dcd1c23d4682d204e36c9de`. **Cinco commits locales (`6a31423` feature, `6422fde` correcciones del gate sobre el test, `07f1c99` N-4, `d8c6c0a` N-5, `73a5863` N-6, `578ee60` estilo con prettier sobre los 9 archivos TS/TSX escritos a mano: solo formato, +1100/−262, eslint exit 0, suite 1148 en verde; `9302cae` merge de `origin/main` 9feef64 sin conflictos, 0074 sigue libre, NK-0042 no toca `notifications`, `tsc`, `build` y `vitest` 1358 en verde; N-7 es solo esta nota). Los dos primeros: sin `as any`, humo en `beforeAll`, prueba del `revoke execute` y ventana de 23,9 h / 24,1 h), sin push, sin aplicar en ninguna base viva.** Paquete de resultado: `.factory/evidence/NK-0030/result.md` de ese worktree.

- **Migración:** `drizzle/migrations/0074_money_moment_notices.sql`, `idx` 73, `when` 1793836000000 (mayor que 1793749600000, que era el máximo de `origin/main` en `dcea201`; 0074 estaba libre en `git ls-tree origin/main`). Contiene lo de §10: CHECK de `kind` localizado por definición en `pg_constraint` y recreado como `notifications_kind_check`, `dedupe_key` y `unique (user_id, dedupe_key)`, `money_notify` (revoke a `public`, `anon` y `authenticated`), `money_lead_sql_trg` y `money_deal_won_trg` (`security definer set search_path = public`) y los cuatro triggers con `WHEN`. Los avisos fallidos solo dejan `raise warning` con el SQLSTATE.
- **Reconstrucción, no definición viva:** la réplica de `lead_stage_change`, `track_deal_changes` y `deals_stage_check` (dentro de `src/lib/money-notices.pg.test.ts`) está **reconstruida** desde `0012` y `0002` más los deltas de §3, por decisión de Fede (2026-10-31); no se leyó ninguna base viva y **no se afirma que coincida con la definición viva**. `deals_stage_check` se reconstruye como `coalesce(stage,'discovery')` y `coalesce(probability,10)`: es la parte más supuesta (la viva puede leer `deal_stages`).
- **Qué no replica el arnés:** `deals_audit`, `deals_lines_guard`, `deals_slip`, `deals_stamp_human_edit`, `deal_lines`, `deal_stages`, `lead_sources`, `people`, `approvals`, claves ajenas de `owner_id`; las tablas `leads`, `deals`, `deal_stage_history` y `notifications` van reducidas a las columnas que toca 0074. Sí replica `leads_audit` (con `set_audit`), las políticas RLS de §3 y la ausencia de INSERT para `authenticated` en `notifications`. Añade los privilegios de función por defecto de Supabase (`execute` a `anon`, `authenticated` y `service_role`) para que el `revoke` no dependa del valor `public`.
- **Catálogo de campos (decisión §10):** `notifications` pasa a `INFRASTRUCTURE_TABLES` (`src/lib/field-coverage.ts`) en lugar de crear un concepto: `dedupe_key` es una clave técnica sin pantalla, y un concepto exigiría un archivo de `SHOWN_IN` falso. Se quita la línea `notifications` de `field-baseline.ts` (la baseline solo se encoge; las tablas de infraestructura no están en ella). Un efecto: las demás columnas de `notifications` dejan de vigilarse en la cobertura.
- **`types.ts`:** `notifications.dedupe_key` (`string | null` en Row, opcional en Insert y Update) **editado a mano**, no regenerado desde la base; **[Por verificar]** que coincida con lo que genere Lovable tras aplicar la migración.
- **Tanda (U-4):** la comprobación de pertenencia está dentro de `deliver`, así que también afecta a `deliverJobNotice` y `notifyAutopilot` (declarado en §12). El aviso de quien ya no es miembro no se marca como enviado y sigue ocupando hueco en la ventana de 12 h.
- **N-4 a N-7 (aplicados por orden de Fede, 2026-10-31):** N-4 (`07f1c99`): el `DO` de 0074 ya no borra todo CHECK que mencione `kind`, solo el CHECK de una sola columna `kind` en `notifications` (por tabla y `conkey`); test con el CHECK de `kind` renombrado y otro CHECK de dos columnas que menciona `kind` (falla antes, pasa después). N-5 (`d8c6c0a`): `BASELINE_MAX` 992 a 981, medido: con 980 `field-coverage.test.ts` falla («expected 981 to be less than or equal to 980»). N-6 (`73a5863`): `deliver` registra el error de `org_members` y no envía esa hora (antes lo ignoraba en silencio); los avisos quedan sin marcar para la hora siguiente; test con consulta fallida y control sano. N-7: **`external_id` queda nulo en la réplica de `lead_stage_change`** del arnés; la función viva puede rellenarlo, y ninguna prueba de NK-0030 depende de él.
- **Texto (U-5):** etiqueta «Dinero», frase de «Solo lo importante» y nota en `src/lib/AGENTS.md`. **No** se cambió el texto vacío del Centro («Cuando Nokko termine algo, lo verás aquí.»): el §9 lo marca como inexacto, pero U-5 no lo incluye; queda para decisión.
- **No verificado:** migración en PostgreSQL 17.11 vivo (las pruebas son PGlite 0.5.11, que es PostgreSQL 18.6, medido con `select version()`), concurrencia y bloqueos reales, `QUERY_CANCELED`, coste en producción, cron horario de la tanda, volúmenes (sin dato).
