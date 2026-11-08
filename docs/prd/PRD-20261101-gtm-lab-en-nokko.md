# PRD-20261101-gtm-lab-en-nokko · [Iniciativa] NOKKO evoluciona a GTM Lab: el recorrido de estrategia guiado como columna vertebral

**Tipo:** Iniciativa · **Prioridad propuesta:** Alta (Fede lo pide como la dirección del producto; hoy NOKKO tiene dos recorridos de estrategia, Ciclo GTM y el contexto del control tower, y ninguno lleva paso a paso hasta un plan y unas tareas)
**Estado:** Aprobado por Fede el 2026-11-01; el paso 8 se parte en 8a (Ciclo GTM y Debates fuera del menú en solo lectura, tras el paso 7) y 8b (archivar, tras el SDD 5a), y el SDD 2 de este orden enmienda la Torre 1b sin sustituirla (D-4 y D-1, decisión de Fede del 2026-11-06); enmendado el 2026-11-06 (lector de Reglas, `SDD-20261106-agent-rules-reader` §15.5, aprobado por Fede en el chat) · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-11-01
**SDD que lo desarrollan:** pendiente (orden en §8)

> Un PRD dice qué se quiere y por qué. No dice cómo se construye ni cómo se prueba: eso es del SDD.
> **Origen:** el PRD consolidado de GTM Lab (`gtm-lab/docs/prd/PRD-20261101-completo.md`, repo aparte) y las decisiones 0004 y 0005 de GTM Lab. Este documento es el anexo de encaje que pedía su D-8. Lo que GTM Lab hace (fases, pasos, calculadoras, documento y tablero) está descrito allí y no se repite aquí. Aquí solo va cómo entra en NOKKO.

## 1. Problema
NOKKO tiene piezas de estrategia sueltas, que no llevan en orden desde «tengo un producto» hasta «sé a quién vendo, por qué me elige y qué hago esta semana»:
- Ciclo GTM, con documentos BMAD;
- Debates;
- Estrategia, con ICP, segmentos, posicionamiento y mensajes;
- el contexto por bloques y el plan con IA del control tower, aprobados y sin construir.

GTM Lab ya resuelve ese recorrido, pero vive en una app aparte que nadie usa. Tener dos sitios significa dos verdades sobre la estrategia.

## 2. Para quién
- **Owner** (founder): define la estrategia, marca el proyecto principal y publica en la estrategia de la org.
- **Sales leader:** edita proyectos y ejecuta el tablero.
- **Resto de roles de la org:** leen los proyectos y ejecutan las tareas que tienen asignadas.
- **Consejo** (rol del control tower): sin acceso a GTM Lab. Ve lo que el control tower ya le enseña.

Sin nombres ni datos de clientes.

## 3. Evidencia y por qué ahora
Fuentes leídas el 2026-11-01:
- **GTM Lab** (`~/gtm-lab`, `main` local `44f385b`):
  - v1 completa, v2 con 3 de 5 tramos y v3 con 1 de 4 tramos, todo en local. 546 tests.
  - El núcleo (`packages/core`, unas 1.380 líneas sin tests) solo depende de `yaml` y `zod` y tiene un test que le prohíbe importar framework o BD.
  - Metodología en `methodology/framework.yaml` (7 fases, 23 pasos) y `methodology/tasks.yaml` (98 tareas, 12 categorías).
  - Eval de la v1: 4,17 en accionable y 22 de 24 casos pasan.
- **NOKKO** (`origin/main`):
  - Mismo stack: React 19, Tailwind 4, zod 4.6.7 y vitest 4.
  - Multitenant por `org_id` con `current_org()`. La IA va por `src/lib/ai-gateway.ts` sin registro de llamadas ni tope.
  - Ya hay `gtm_experiments` (prototipos de Theory U) y tablas de estrategia por org (`segments`, `icp_profiles`, `positioning`, `messaging_pillars`, todas con `field_sources`).
- **Uso real:** sin dato en GTM Lab (nunca desplegado) y sin dato en NOKKO para Ciclo GTM, Debates y Estrategia. No se mide, porque se empieza de cero (§6.1).
- **Dependencias de `segments`:** las tablas de metas, presupuestos, costes de CAC y asignaciones apuntan a `segments` con `on delete cascade`, y `deals`, `accounts` y los leads con `on delete set null`. Lo afectan las migraciones `0001`, `0006`, `0009`, `0012`, `0015`, `0016`, `0017` y `0029`. Borrar un segmento arrastra esos datos.

**Por qué ahora:** la construcción del control tower espera a la salida de Lovable A y B. Si se decide ya qué parte sustituye GTM Lab, no se construye dos veces.

## 4. Objetivos
Se heredan los objetivos G-1 a G-7 del PRD consolidado de GTM Lab §4, medidos ahora en NOKKO. Todas las líneas base son **sin dato**. Los de este PRD son de encaje:

| ID | Objetivo | Cómo se mide | Línea base | Fuente |
|---|---|---|---|---|
| E-1 | Un solo recorrido de estrategia en NOKKO | Ciclo GTM y Debates en solo lectura y fuera del menú; la estrategia nueva solo se hace en GTM Lab | sin dato | Menú y rutas de NOKKO tras F5 |
| E-2 | Una sola verdad de ICP, segmento, posicionamiento y mensaje | Lo publicado desde el proyecto principal coincide con lo que leen el scoring, los leads y las sugerencias | sin dato | Base de datos tras F4 |
| E-3 | La IA de GTM Lab no empeora al pasar por `ai-gateway` | El eval por la ruta de NOKKO alcanza el umbral de `criterio.md` §5 | v1 por Anthropic directo: accionable 4,17 y 22 de 24 | Eval de F1 |
| E-4 | El coste de IA queda medido por org | Cada sugerencia queda en `gtm_lab_ai_calls` con tokens y coste | sin dato | Base de datos tras F2 |

## 5. No-objetivos
- Abrir NOKKO o GTM Lab a usuarios fuera de Fede y su equipo (línea roja de la 0004).
- Reescribir la metodología o sus textos. Se llevan tal cual y luego evolucionan en NOKKO.
- Las tareas de CRM: la tabla `tasks` de cuentas y deals sigue como está.
- Kanban, subtareas y dependencias en el tablero. Si hacen falta, son un tramo posterior.
- Migrar datos de Ciclo GTM, Debates, `gtm_experiments` o Estrategia: se empieza de cero (§6.1).
- Borrar datos: lo anterior se archiva, nunca se borra.
- Mantener vivo el repo `gtm-lab`: queda congelado desde F1 (0005).

## 6. Decisiones tomadas y abiertas
### 6.1 Tomadas

| Tema | Decisión | Quién y cuándo |
|---|---|---|
| Encaje | NOKKO evoluciona a GTM Lab. Se diseña ya el estado final y no se hace un módulo aislado para fusionarlo después | Fede, 2026-11-01 |
| Proyecto | Varios por org, visibles para todos sus miembros, con enlace opcional a un producto. Borrar es solo del Owner | Fede, 2026-11-01 |
| Calendario | El núcleo entra ya, sin BD (F1). Tablas y pantallas tras la salida de Lovable A y B | Fede, 2026-11-01 |
| IA | Por `ai-gateway` con el modelo fijado a Sonnet 5.5, sin pasar a Gemini, y con registro propio de llamadas. Se repite el eval antes de enseñarlo | Fede, 2026-11-01 |
| Ciclo GTM y Debates | Los sustituye el recorrido de GTM Lab: primero quedan en solo lectura y luego se archivan | Fede, 2026-11-01 |
| Capa de tareas | El tablero de GTM Lab (98 tareas del catálogo más las que se añadan) | Fede, 2026-11-01 |
| Control tower | GTM Lab sustituye solo su parte de estrategia y tareas. El resto se mantiene (detalle en §6.2) | Fede, 2026-11-01 |
| Fuente de ICP y posicionamiento | La org marca un proyecto como principal. Sus pasos de segmento, cliente, propuesta, diferenciales y mensaje se publican en las tablas de NOKKO al marcarlos «hecho», con confirmación | Fede, 2026-11-01 |
| Datos existentes | **Se empieza de cero y no se migra nada.** Ciclo GTM, Debates y `gtm_experiments` quedan en solo lectura y luego se archivan. Los valores actuales de Estrategia (ICP, segmentos, posicionamiento y mensajes) también se archivan, y el proyecto principal los vuelve a escribir. No se borra nada (control tower R-7) | Fede, 2026-11-01 |
| Repo GTM Lab | Se congela y NOKKO es la casa (decisión 0005 de GTM Lab) | Fede, 2026-11-01 |

### 6.2 Qué pasa con el control tower (`PRD-20261030-gtm-control-tower`)

| Pieza | Qué pasa | Enmienda necesaria |
|---|---|---|
| **1a** · roles, objetivos, KR, públicos y canales, decisiones | **Se mantiene.** El paso «OKR de 90 días» del proyecto principal propone objetivos y KR del control tower | 1a: añadir el origen «GTM Lab» al crear un objetivo |
| **U-0** (dentro de 1a) · quitar la lectura de LinkedIn por scraping | **Se mantiene y se separa** como ticket propio: es cumplimiento y no depende del resto | Nuevo ticket NK |
| **1b** · iniciativas y tareas | **Se sustituye** por el tablero de GTM Lab. Una tarea puede enlazarse a un objetivo (opcional) | 1b: retirar iniciativas y tareas, y la regla «toda tarea cuelga de una iniciativa» |
| **1b** · puertas, torre de control, Inicio y menú | **Se mantiene.** La torre lee las tareas del tablero de GTM Lab | 1b: cambiar la fuente de las tareas |
| **2** · contexto por bloques y onboarding con nivel de confianza | **Se sustituye** por el perfil y los pasos obligatorios del proyecto principal | 2: se supera. La regla «sin contexto no se activa un objetivo» pasa a ser «sin los pasos obligatorios del proyecto principal hechos» |
| **3** · atribución y embudos | **Se mantiene** | Ninguna |
| **4a** · fuentes de datos | **Se mantiene** | Ninguna |
| **4b** · herramientas personales | **Se mantiene.** El espejo de tareas en el calendario lee el tablero de GTM Lab | 4b: cambiar la fuente de las tareas |
| **5a, 5b y 5c** · agente, avisos, check-in y servidor para asistentes | **Se mantienen.** El check-in y los avisos leen el tablero de GTM Lab. 5a conserva el bloque de Reglas de Conocimiento en todos los modos (enmienda 2026-11-06) | 5a: conservar el bloque de Reglas; 5b: cambiar la fuente de las tareas |
| **5d** · plan con IA y herramientas de estrategia | **Se sustituye** por los pasos «OKR», «Reparto de acciones» y «Revisión del plan» y por la ayuda de IA por paso. Las herramientas del agente para proponer cambios de estrategia pasan a trabajar sobre el proyecto principal | 5d: se supera. Las herramientas del agente se replantean en un SDD propio |
| **8** · vistas de Postin | **Se mantiene** | Ninguna |

**Tickets del ledger.** El ledger no tiene un estado de cancelado. Por eso:
- NK-0027 (1b) y NK-0028 (2) se enlazan a este PRD con `link`, con la nota «superado por PRD-20261101-gtm-lab-en-nokko».
- NK-0026 (1, PROMOTED) se replantea al enmendar 1a.
- NK-0030 y NK-0031 no son del control tower y no cambian.

### 6.3 Abiertas

| ID | Tema | Recomendación | Quién |
|---|---|---|---|
| A-1 | **Responsable de las tareas.** El tablero de GTM Lab no tiene responsable porque era para un solo usuario | Añadir `assignee` (miembro de la org, opcional) a las tareas del tablero en F3: es barato y el check-in lo necesita | Fede |
| A-2 | **Forma del KR.** En GTM Lab el KR es texto con «meta». En el control tower es un número con valor inicial, meta y fecha | Al publicar, el KR entra como «Supuesto» y se pide número y fecha. Cambiar el formulario del paso más adelante, con un eval | Fede |
| A-3 | **Nombre en el menú** | «Estrategia», sustituyendo a «Estrategia GTM», «Ciclo GTM» y «Debates». Lo que hoy es Estrategia pasa a pestañas del proyecto principal. **Bloqueado hasta que `SDD-20261106-agent-rules-reader` (NK-0087) esté entregado y verificado; lo mismo vale para 8a (sacar Ciclo GTM y Debates del menú), que espera además a este lector (decisión de Fede del 2026-11-06: Ciclo GTM no se retira hasta que exista):** hoy Ciclo GTM es el único sitio que trata las Reglas de Conocimiento como obligatorias (decisión de Fede, 2026-11-06) | Fede |
| A-4 | **Experimentos.** GTM Lab tiene experimentos con ICE y NOKKO tiene `gtm_experiments` (prototipos de Theory U) | Dejarlos separados en F3 y decidir en F5 con los datos medidos | Fede |
| A-6 | **Cómo se archiva Estrategia** | Guardar una instantánea por org (jsonb, en una tabla de archivo solo para el Owner). Después, vaciar los textos de `positioning` y `icp_profiles` y retirar `messaging_pillars`. Los `segments` **no se borran**: se marcan como archivados con una columna nueva y se ocultan, para no arrastrar metas, presupuestos ni el segmento de deals y cuentas | Fede |
| A-7 | **Hueco sin ICP** | El archivo de Estrategia se hace en el mismo SDD que la publicación (7), y solo cuando el proyecto principal tenga hechos los pasos que publica. Así el scoring y los leads nunca se quedan sin ICP | Fede |
| A-5 | **Tope diario de IA** | Por usuario y por org (por defecto 50 por usuario y día, como GTM Lab). Que se vea en el panel de gasto que ya existe | Fede |

## 7. Riesgos y dependencias
- **Línea roja de la 0004.** NOKKO es multitenant y admite invitaciones. Si en producción hay una org que no sea de Fede y su equipo, no vale la 0004 y se para todo. Se comprueba en F0.
- **Salida de Lovable A y B.** F2 en adelante depende de ella: hasta entonces GTM Lab no se ve en NOKKO.
- **Calidad y coste de la IA.** Pueden cambiar al pasar por OpenRouter (caché, esfuerzo, salida estructurada). Lo cubre el gate de eval (E-3). Si `ai-gateway` no permite fijar el modelo, se amplía en el SDD de IA.
- **Lector de Reglas.** Retirar Ciclo GTM sin lector de Reglas en el agente deja sin efecto la sección Reglas de Conocimiento (enmienda 2026-11-06).
- **Enmiendas a SDD aprobados** (1a, 1b, 4b, 5a y 5b, y dar por superados 2 y 5d). Hay que redactarlas y pasarlas por el gate antes de construir el control tower.
- **Catálogo de tareas.** Sigue la estructura de GTM Strategist, que solo se permite en uso interno. Falta atribuir el vocabulario de «motores».
- **Empezar de cero en Estrategia.** Mientras no se publique el proyecto principal, el scoring de ICP, los leads y las sugerencias se quedan sin datos de estrategia. Por eso el archivo va junto a la primera publicación (A-7). Un segmento borrado en vez de archivado arrastra metas, presupuestos y asignaciones (§3).
- **Doble escritura en las tablas de estrategia.** La publicación del proyecto principal y la edición manual en Estrategia escriben en las mismas filas. Hay que usar las rutas de escritura con `field_sources` (origen «gtm_lab») y nunca sobrescribir sin confirmar.
- **Campo nuevo, catálogo nuevo.** Cada columna nueva va a `src/lib/field-catalog.ts`, o falla `field-coverage.test.ts`.

## 8. Orden de entrega

| # | Pieza | Tipo | Depende de | Cubre |
|---|---|---|---|---|
| F0 | Comprobación de la línea roja y aprobación de este PRD | — | — | Todo |
| 1 | SDD · Núcleo y metodología de GTM Lab en NOKKO (`src/lib/gtm-lab/`), eval por `ai-gateway` | Feature (sin migraciones) | F0 | E-3 |
| 2 | Enmiendas al control tower: 1a y U-0 aparte, 1b, 4b, 5a (bloque de Reglas) y 5b; 2 y 5d dados por superados | Docs | Este PRD aprobado | — |
| 3 | SDD · Proyectos por org, perfil y recorrido (`gtm_lab_projects`, `gtm_lab_deliverables`) | Feature | Lovable A y B | G-1 |
| 4 | SDD · Ayuda de IA por paso con registro (`gtm_lab_ai_calls`) | Feature | 1 y 3 | G-3, G-4, G-5, E-3, E-4 |
| 5 | SDD · Calculadoras, experimentos con ICE y documento (Markdown, impresión y Drive) | Feature | 3 | G-2 |
| 6 | SDD · Tablero de tareas (`gtm_lab_project_tasks`, con responsable si A-1) | Feature | 3 | G-6, G-7 |
| 7 | SDD · Proyecto principal, archivo de la Estrategia actual (A-6, A-7) y publicación en la estrategia de la org (mapeo en el anexo A) | Feature | 3 y 5 | E-2 |
| 8 | SDD · Retirada: Ciclo GTM, Debates y `gtm_experiments` en solo lectura y luego archivados; menú nuevo | Mejora | 7; `SDD-20261106-agent-rules-reader` entregado; inventario de lo que importa `src/lib/bmad/` fuera de Ciclo GTM y Debates (biblioteca de playbooks, agente y modos de 5a, etapas de deals en `deals.tsx` y `agent/tools/core-write.ts`) con destino decidido para cada uno (enmienda 2026-11-06) | E-1 |
| 9 | Resto del PRD consolidado de GTM Lab §8: enseñarlo al equipo y medir, límites de calidad de la IA y tramos 4 y 5 de la v2 y 2 a 4 de la v3 | Varios | 8 | G-1…G-7 |

El control tower se construye después de 3 y 6, con sus enmiendas, porque lee las tareas del tablero.

## Anexo A · Publicación desde el proyecto principal (propuesta de mapeo)
Solo publica el proyecto marcado como principal, al marcar un paso como «hecho» y tras confirmar. Cada campo publicado guarda su origen en `field_sources` como «gtm_lab». La primera publicación cae sobre una Estrategia recién archivada (A-6), así que no hay valores previos. En las siguientes, si el campo de destino ya tiene valor, se enseña el antes y el después y no se sobrescribe sin confirmar.

| Entregable de GTM Lab | Campo | Destino en NOKKO |
|---|---|---|
| `entry-segment` | `segment` | `segments.name`. Se enlaza a un segmento existente con las reglas de `src/lib/match.ts`, o se crea uno |
| `entry-segment` | `why`, `discarded` | `segments.notes` (se añade, no se sustituye) |
| `customer-profile` | `company_size` | `icp_profiles.company_size` |
| `customer-profile` | `company_type` | `icp_profiles.industries` |
| `customer-profile` | `role` + `company_type` | `icp_profiles.name` |
| `customer-profile` | `trigger` | `icp_profiles.why_fit` |
| `customer-profile` | (enlace) | `icp_profiles.segment_id` → el segmento de entrada publicado |
| `competitor-map` | `alternatives[]` | `positioning.alternatives` (lista en texto) y `positioning.competitive_alternative` (la primera de tipo «Competidor directo») |
| `value-proposition` | `for_whom` | `positioning.target_customer` |
| `value-proposition` | `problem` | `positioning.need` |
| `value-proposition` | `how` | `positioning.value` |
| `value-proposition` | `result` | `positioning.key_benefit` |
| `differentiators` | `items[]` | `positioning.differentiation` (lista en texto). Cada diferencial también va a `messaging_pillars` (`title` = diferencial, `proof` = cómo se demuestra) |
| `core-message` | `headline` | `positioning.tagline` |
| `core-message` | `message` | `positioning.one_liner` |
| `customer-profile` | `pains[]` | `messaging_pillars.pain`, en el pilar que el usuario elija al publicar (opcional) |
| `okr` | `objective`, `key_results[]` | Objetivo y KR del control tower (1a), como «Supuesto» (A-2). Hasta que exista el control tower, no se publica |

**No se publican** (se quedan en GTM Lab): perfil, métrica norte, segmentos candidatos y su puntuación, supuestos y plan de validación, grupo de compra, precio, canales, plan de acciones y revisión del plan. NOKKO no tiene hoy un sitio equivalente por org para ellos, o lo tendrá con el control tower.

## Anexo B · Modelo de datos propuesto (el detalle va en los SDD 3 a 6)
- Todas las tablas son `gtm_lab_*`. El prefijo evita chocar con `gtm_experiments`.
- Todas siguen el patrón de NOKKO:
  - `org_id uuid not null default public.current_org() references organizations on delete cascade`;
  - revoke y grants mínimos;
  - RLS para leer y actualizar si `org_id = current_org() and is_org_member(org_id)`, para insertar si `is_org_member` y para borrar si `has_org_role(org_id,'owner')`.

| Tabla | Viene de GTM Lab | Cambios |
|---|---|---|
| `gtm_lab_projects` | `projects` | `owner_id` pasa a `org_id` + `created_by`. Se añaden `product_id` (opcional, a `products`) e `is_primary` (índice único parcial por org) |
| `gtm_lab_deliverables` | `project_deliverables` | Lleva `org_id` (para las RLS de NOKKO) y `updated_by` |
| `gtm_lab_experiments` | `experiments` | Lleva `org_id` |
| `gtm_lab_doc_exports` | `doc_exports` | Lleva `org_id` y `created_by` |
| `gtm_lab_project_tasks` | `project_tasks` | Lleva `org_id`. Se añaden `assignee` (A-1) y `objective_id` (opcional, cuando exista el control tower) |
| `gtm_lab_ai_calls` | `ai_calls` | Lleva `org_id` + `user_id` y el coste calculado. Solo escribe el servidor y el usuario solo actualiza `outcome` |

La metodología no va a la BD: se empaqueta con la app (`?raw`), como en GTM Lab.

## 9. Aprobación
- [x] Línea roja de la 0004 comprobada el 2026-11-01. Resultado de `F0-consultas-gtm-lab.sql` en producción:
  - a las 22:16 había 2 orgs, con 1 miembro cada una;
  - Fede borró en Lovable el usuario de la org `93148d06…` y dejó solo el suyo, miembro de `157a2e08…`;
  - a las 22:17 la org `93148d06…` tiene un miembro sin usuario en `auth.users`.
  - **No consta si el usuario borrado era del equipo o externo.**
  - Fede creó una org nueva el 2026-11-01 a las 21:45 UTC. A las 22:48 producción solo tiene **1 org** (la nueva, activa, con 1 miembro con usuario).
  - **Las dos orgs anteriores (`93148d06…` y `157a2e08…`) ya no existen: se borraron, no se archivaron, junto con sus datos en cascada.** No las borré yo. Solo podrían recuperarse restaurando un backup diario de toda la BD.
  - Con esto NOKKO arranca de cero y el archivo de Estrategia (A-6) no tiene datos anteriores que archivar.
- [x] Fede aprueba el PRD (primer GO de dirección). Fecha: 2026-11-01
- [ ] Fede resuelve A-1 a A-7, o las delega con fecha. Siguen abiertas; ninguna bloquea el SDD 1 (núcleo). A-6 y A-7 quedan casi vacías al haber empezado de cero (§9).
- Al aprobar, el Estado pasa a «Aprobado». Después se redactan los SDD con `nokko-shape`, empezando por el 1 (núcleo).
