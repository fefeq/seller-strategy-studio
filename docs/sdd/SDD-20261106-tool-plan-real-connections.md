# SDD-20261106-tool-plan-real-connections · [Feature] Plan de herramientas: conexión real por fila y permisos de Owner

**Tipo:** Feature · **Prioridad propuesta:** Media
**Estado:** En curso (aprobado por Fede el 2026-11-06, rev. 5, corregida tras las cuatro revisiones del gate de la sección 17; implementado, pendiente de gate y de entrega) · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-11-06
**PRD:** `docs/prd/PRD-20261106-tool-plan-real-connections.md` (Aprobado 2026-11-06) · **Depende de:** —
**Base de implementación:** `origin/main` (comprobado en `0040239`; el gate lo vio ya en `a43200d`, sin cambios en `drizzle/`, `src/test`, `src/routes`, `src/components`, `src/hooks`, `save.ts` ni `errors.ts`), decidido por Fede el 2026-11-06. El commit base exacto se fija al promover el ticket. Toda cita de esta revisión se ha comprobado contra `origin/main`, no contra la rama `feat/software-factory`.

> Un SDD dice cómo se verifica que está bien hecho. Cada criterio de aceptación (CA-n) debe poder tener una prueba automática que lo nombre.
> Cada CA-n cita el objetivo G-n del PRD que cubre.

## 1. Resumen
Cada fila del «Plan de herramientas del equipo» muestra, junto al estado que marca el equipo, una segunda etiqueta con la conexión real de Nokko, calculada por una función pura y no guardada. La sección del plan pasa a su propio componente (convención de `AGENTS.md`). Una migración limita insertar y actualizar `integrations` al Owner de la organización activa. El estado del equipo no se bloquea.

## 2. Problema y para quién
Ver PRD §1-2: «Ya lo usamos» se lee como «Nokko lo lee», y la restricción a Owner existe solo en la interfaz.

## 3. Evidencia y por qué ahora
Todo en `origin/main` (`0040239`):
- `src/routes/_authenticated/integrations.tsx:19-39`: `STATUS`, `WORKING` (13 entradas con `what`, `to`, `hash` y `pending`) y `NOT_YET` (3 cadenas de texto libre, con Pipedrive y Salesforce, ausentes del seed). `:45` lee la tabla y `:48` la actualiza con `confirmed()`; es el único escritor de `integrations` en `src/` y `scripts/` (`git grep 'from("integrations")'`).
- El selector de estado solo se pinta si `isOwner` (misma pantalla, bloque del plan).
- **`src/lib/connections.ts` (`PROVIDERS`), `connections-panel.tsx` y la migración `0059` no existen en `origin/main`.** Esta pantalla no monta `ConnectionsPanel`. El mapa de «qué es nativo» no puede apoyarse en `PROVIDERS`.
- `drizzle/migrations/0002_multitenant_organizations.sql:119-123`: políticas `org read`, `org insert`, `org update` y `org delete owner`; el update exige `org_id = public.current_org()` (`:122`), el insert no (`:121`). `has_org_role(_org uuid, _role app_role)` en `:46`. Solo `0000`, `0002`, `0020` y `0028` mencionan `integrations` en `origin/main`: ninguna migración posterior cambia su RLS.
- Seed de `create_organization`: 15 herramientas en `0002_...sql:210-225`, idénticas en los comentarios de `0020:28-43` y `0028:39-54`. `create_organization` es `security definer` (`0002:195`); `org_members` (owner) y `profiles.current_org_id` se escriben antes del seed (`0002:201-202`). La definición vigente de `create_organization(_name, _segments)` no está como SQL ejecutable en el repo **[Por verificar]**; `0056_org_lifecycle.sql:5-10` solo define `create_organization_full`, que la llama.
- Migraciones: el último archivo es `0076_platform_admins_skip_creator.sql`; el journal (`drizzle/migrations/meta/_journal.json`) llega a idx 74, `when` 1793749600002. `src/lib/migrations-journal.ts` exige número único por archivo, entrada en el journal por archivo, `idx` igual a la posición y `when` estrictamente creciente.
- `src/lib/save.ts:5-16`: `confirmed()` lanza `NOT_SAVED` ante cualquier UPDATE con cero filas; su texto ya dice «Puede que tu rol no lo permita o que el registro ya no exista».
- `src/lib/errors.ts:14` traduce el rechazo de RLS a «Tu rol no permite hacer este cambio. Pídeselo al Owner o a un Sales Leader…».
- Vías de entrada por webhook, en `origin/main`: `leads.entrada.tsx:91,151,200` (HubSpot, CRM, Sales Navigator con Make/n8n), `src/routes/api/public/accounts.ts:3`, y, aparte, `src/components/account-import.tsx:93-97` (importación por CSV de Sales Navigator o CRM, no es un webhook).
- Pruebas de RLS: `origin/main` tiene `src/test/pg-harness.ts` (PGlite, `@electric-sql/pglite` en `package.json`) y seis `*.pg.test.ts` (por ejemplo `src/lib/migrations.pg.test.ts:42-71`, con dos empresas ficticias y roles `ownerA`, `aeA`, `ownerB`); `docs/DESARROLLO.md:61` manda probar así las migraciones. Corrige la premisa de las revisiones 2 y 3 de este SDD.
- Superadmins: `0075_platform_admins.sql` los hace Owner de todas las organizaciones en `org_members`; no altera `has_org_role` ni `current_org`.
- Uso del plan: sin dato.

## 4. Resultado buscado
G-1, G-2 y G-3 del PRD. Sin cifras.

## 5. Alcance
**Incluye:**
- Módulo puro `src/lib/tool-plan.ts`: `connectionFor(name)` con cuatro tipos (`native`, `webhook`, `not_yet`, `none`). La lista de nativos es propia del módulo (Apollo y Clay hoy).
- Componente `src/components/integrations/tool-plan.tsx` con la sección del plan; la ruta conserva configuración y composición.
- Etiqueta de conexión por fila, avisos bajo «Ya lo usamos», texto de sección en «tú» y mensaje de permisos de Owner.
- Migración de políticas a Owner con su entrada de journal, una prueba de políticas con PGlite (`*.pg.test.ts`, como las seis que ya existen) y una comprobación estática del texto y del journal.

**No incluye:** bloquear estados; columnas nuevas; nuevas conexiones; tocar `WORKING` ni `NOT_YET`; unificarlos con el mapa nuevo (decidido por Fede el 2026-11-06: conviven y se pide aparte); tocar el panel de conexiones; desplegar o aplicar la migración en producción; cambiar el texto genérico de `errorText` para el resto de la app.
(Es el límite que el brief copia a «Movimientos prohibidos».)

## 6. Cambios de comportamiento (delta)
**Añadido:** etiqueta de conexión por fila; avisos; mensaje de permisos de Owner; política de Owner en base de datos.
**Modificado:** la sección del plan sale de `integrations.tsx` a su componente; texto de la sección: «vosotros» → «tú».
**Eliminado:** nada.

## 7. Historias y criterios de aceptación
### H-1: Como Owner o miembro, quiero ver si Nokko se conecta de verdad a cada herramienta del plan para no suponerlo por el estado.
- **CA-1** `connectionFor(name)` devuelve un objeto `{ kind }` con `kind` en `native | webhook | not_yet | none`. Para los 15 nombres del seed, exactamente (la tabla va escrita en la prueba, sin depender del módulo):
  - `native`: Apollo, Clay.
  - `webhook`: HubSpot, Attio, LinkedIn Sales Navigator.
  - `not_yet`: Gmail, Google Calendar, Gong, Fireflies.
  - `none`: GitHub, Slack, Instantly, Lemlist, DocuSign, PandaDoc.
  - Cobertura: 2 + 3 + 4 + 6 = 15 · cubre G-1 · prueba: `src/lib/tool-plan.test.ts`
- **CA-2** Un nombre desconocido devuelve `none` sin lanzar error; la comparación ignora mayúsculas y espacios sobrantes; resuelven a `native`, mediante alias explícitos, los nombres que `WORKING` lista como disponibles y que un equipo puede añadir a mano: «Apollo.io», «Google Drive», «Firecrawl», «Parallel», «Perplexity» y «Apify» (el sufijo de dominio no lo cubre la normalización); «Pipedrive» y «Salesforce», listados en `NOT_YET` (`integrations.tsx:39`) aunque no estén en el seed, resuelven a `webhook` · cubre G-1 · prueba: `src/lib/tool-plan.test.ts`
- **CA-3** Cada fila muestra la etiqueta de su tipo, con cuatro textos distintos: «Conexión disponible», «Entra por webhook», «Sin conexión nativa todavía» y «Sin conexión conocida» · cubre G-1 · prueba: `src/components/integrations/tool-plan.test.tsx`
- **CA-3b** El texto de sección es el de §9, en «tú» y sin «vosotros» · cubre G-1 · prueba: `src/components/integrations/tool-plan.test.tsx`

### H-2: Como Owner, quiero marcar lo que el equipo usa sin que el plan parezca prometer una conexión.
- **CA-4** Una fila en «Ya lo usamos» muestra, según su tipo: `native`, ningún aviso; `webhook`, «El equipo la usa; Nokko recibe sus datos solo si montas el flujo por webhook.»; `not_yet`, «El equipo la usa, pero Nokko no tiene conexión con ella hoy.»; `none`, «El equipo la usa, pero no consta ninguna conexión de Nokko con ella.». En «Pendiente» y «Lo estamos montando» no hay aviso · cubre G-2 · prueba: `src/components/integrations/tool-plan.test.tsx`
- **CA-5** El selector de estado ofrece los tres estados y ninguno queda deshabilitado, sea cual sea el tipo de conexión. Es una **prueba de regresión**: se escribe y se ve en verde sobre el componente ya extraído, antes de añadir etiquetas (ver U-2), y no cuenta como prueba que falla primero · cubre G-2 · prueba: `src/components/integrations/tool-plan.test.tsx`

### H-3: Como Owner, quiero que solo yo pueda cambiar el plan, también fuera de la interfaz.
- **CA-6** Si `confirmed()` lanza `NOT_SAVED` o el servidor devuelve `42501`, el componente muestra un `toast.error` con «No se ha guardado. Solo el Owner puede cambiar el plan de herramientas; si ya lo eres, recarga la página y vuelve a intentarlo.» (cubre también el registro ya borrado, sin rotularlo mal) · cubre G-3 · prueba: `src/components/integrations/tool-plan.test.tsx`, con un mock de Supabase que soporte `select().order()` y `update().eq().select()` y que cada prueba pueda controlar para devolver `[]` o un error
- **CA-6b** Un miembro sin rol Owner ve las filas y las etiquetas pero no el selector de estado (con `useMe` mockeado a un rol no-Owner) · cubre G-3 · prueba: `src/components/integrations/tool-plan.test.tsx`
- **CA-7** Prueba de políticas con PGlite sobre `src/test/pg-harness.ts` (empresas y usuarios ficticios: `ownerA`, `aeA`, `ownerB`), en `src/lib/integrations-policies.pg.test.ts`. Montaje: primera línea `// @vitest-environment node`, timeout de `beforeAll` de `60_000`, tabla `integrations`, `enable row level security`, `grant` a `authenticated` y `service_role` y las cuatro políticas de `0002:119-123` (el harness no las aplica a `integrations`, `pg-harness.ts:91-101`). La migración se localiza por el patrón `*_integrations_owner_write.sql` con `readdirSync`, exigiendo que haya exactamente una (si no, es una aserción que falla, no un `ENOENT`; el número no se fija en la prueba).
  - **Bloque de control** (solo las políticas de `0002`): `aeA` actualiza 1 fila e inserta. Demuestra por aserción el comportamiento «antes».
  - **Bloque con la migración aplicada:** (a) `ownerA` actualiza una fila de su empresa y se escribe 1 fila; (b) `aeA`, miembro sin rol Owner de la misma empresa, actualiza y se escriben 0 filas, e inserta y recibe error de RLS; (c) `ownerB` no actualiza filas de la empresa A; (d) con `ownerA` añadido como Owner también de la empresa B (`org_members`) y su `profiles.current_org_id` en A, un insert con `org_id` de B recibe error de RLS (el harness no tiene trigger de guarda sobre `current_org_id`, así que se fija con `db.exec` fuera de `as()`, `pg-harness.ts:126-129`).
  - **Qué cuenta como fail-first:** (b) y (d); antes de la migración pasan (el bloque de control lo muestra con (b)) y después fallan por RLS. (a) y (c) son de no regresión y no cuentan · cubre G-3
- **CA-8** Prueba estática en `src/test/integrations-policies.test.ts`: la migración se localiza con `readdirSync` y debe haber exactamente una `*_integrations_owner_write.sql` (`toHaveLength(1)`); contiene `drop policy if exists` de `org insert` y `org update`, y políticas `to authenticated` cuyo `with check` y `using` exigen `org_id = public.current_org()` y `public.has_org_role(org_id, 'owner')`, sin tocar `org read` ni `org delete owner`. El journal (entrada al final, `idx` igual a su posición, `when` creciente, mismo nombre que el archivo) ya lo impone `src/lib/migrations-journal.test.ts` (existente; debe seguir en verde), sin repetir en esta prueba una constante de `when` que se rompería al llegar otra migración antes · cubre G-3

## 8. Casos límite y errores
- Plan vacío (organización sin seed): la sección no pinta filas, como hoy.
- Nombre editado o añadido a mano que no esté en el mapa: `none`, con la etiqueta «Sin conexión conocida» (no afirma que Nokko no pueda conectarse: dice que no consta).
- Miembro no-Owner: el selector no se pinta (como hoy); si alguien actualiza por API, la base lo rechaza. La página no inserta filas, así que no hay camino de INSERT rechazado en la interfaz.
- Con la política propuesta, un no-Owner recibe cero filas en el UPDATE, es decir `NOT_SAVED`; la rama `42501` queda como respaldo.
- Lectura entre organizaciones: ya aislada por `0002:120` y no cambia; no se añade un CA porque pasaría antes del cambio.
- Seed distinto en producción: el nombre no mapeado cae en `none` (CA-2).
- Superadmins de plataforma: `0075_platform_admins.sql` los hace Owner de todas las organizaciones en `org_members`, así que pasan la política nueva como Owner. Es el comportamiento actual de `has_org_role` y no cambia; queda anotado para que nadie lo lea como un hueco.

## 9. Experiencia y copy
- Etiquetas, avisos y mensaje de permisos: los de CA-3, CA-4 y CA-6.
- Texto de sección, en «tú» (sustituye al actual con «vosotros»): «Un tablero para que el equipo apunte qué herramientas usa o quiere usar. El estado lo marca el Owner y no significa que Nokko esté conectado; la etiqueta de conexión indica lo que Nokko conoce hoy de esa herramienta.»
- Grafía en pantalla: «Nokko», como el resto de la página; en el SDD y el código, «NOKKO». Decidido por Fede el 2026-11-06 (pregunta 4). Si cambiara, cambiarían las cadenas de CA-3, CA-4 y CA-6 y sus pruebas.
- Sin iconos, estados con palabra.

## 10. Datos, permisos y privacidad
- Sin tablas ni columnas nuevas. La conexión no se guarda: se deriva.
- Migración `drizzle/migrations/<siguiente número libre>_integrations_owner_write.sql`. Número: el siguiente por encima del máximo de `origin/main` en el momento de integrar (hoy `0077`); se confirma al integrar. SQL:

```sql
drop policy if exists "org insert" on public.integrations;
drop policy if exists "org update" on public.integrations;
create policy "org insert" on public.integrations for insert to authenticated
  with check (org_id = public.current_org() and public.has_org_role(org_id, 'owner'));
create policy "org update" on public.integrations for update to authenticated
  using (org_id = public.current_org() and public.has_org_role(org_id, 'owner'))
  with check (org_id = public.current_org() and public.has_org_role(org_id, 'owner'));
```

- Entrada nueva al final de `drizzle/migrations/meta/_journal.json`: `idx` = posición (hoy 75), `version` "7", `when` mayor que 1793749600002, `tag` igual al nombre del archivo, `breakpoints` true. Sin snapshot: en `origin/main` lo tienen `0056`, `0057`, `0075` y `0076` y no `0058`-`0073`, y ningún test lo exige (`migrations-journal.ts:9`); **[Por verificar]** con quien aplica la migración si lo necesita.
- `create_organization` inserta el seed como `security definer` (`0002:195`) y escribe antes `org_members` y `profiles.current_org_id` (`0002:201-202`): la política nueva la dejaría pasar en cualquier caso. CA-7 prueba la política, no la propiedad ni los privilegios reales del propietario de la función en la base de Lovable Cloud.
- Cómo deshacerla (se documenta en la cabecera del archivo, como hace `0071`): `drop policy if exists "org insert" on public.integrations; drop policy if exists "org update" on public.integrations;` y recrear las de `0002:121-122` (`with check (public.is_org_member(org_id))`; update con `using (org_id = public.current_org() and public.is_org_member(org_id)) with check (public.is_org_member(org_id))`), ambas `to authenticated`.
- Sin datos de clientes en código, pruebas ni logs; las pruebas usan nombres de herramientas y organizaciones ficticias.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| Ninguna | regla determinista | — | — |

## 12. Unidades de trabajo
Todas parten de `origin/main`.

| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | `src/lib/tool-plan.ts` con `connectionFor(name)` | CA-1, CA-2 | `src/lib/tool-plan.test.ts` (primero un stub de `connectionFor` que devuelve siempre `none`, para que la tabla de CA-1 falle por aserción y no por import roto) |
| U-2a | Extraer la sección del plan a `src/components/integrations/tool-plan.tsx` sin cambiar comportamiento; la ruta lo monta. Con la prueba de regresión CA-5 en verde | CA-5 (regresión) | — (no cuenta) |
| U-2b | Etiqueta de conexión, avisos, copy en «tú» y mensaje de Owner | CA-3, CA-4, CA-6 | `src/components/integrations/tool-plan.test.tsx`: las pruebas se escriben primero y fallan por comportamiento (el componente ya existe, la etiqueta y los avisos no) |
| U-3 | Prueba de políticas con PGlite, migración con su rollback documentado, entrada de journal y comprobación estática | CA-7, CA-8 | `src/lib/integrations-policies.pg.test.ts` (falla por comportamiento: sin la migración, un no-Owner actualiza e inserta) y `src/test/integrations-policies.test.ts` (falla porque el archivo de migración no existe) |

U-3 va en un commit aparte, revertible. No se aplica en producción sin orden de Fede. Las pruebas de U-2 siguen el patrón de los tests de componente de `origin/main` que mockean `@/integrations/supabase/client` (`src/components/icp-editor.test.tsx`, `src/components/strategy-screens.test.tsx`), `useMe` y `sonner`. No se crea ningún `*.test.*` dentro de `src/routes`.

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- El componente `tool-plan.tsx` trae su propio `useQuery(["integrations"])` y `useMe`, y conserva la clave `["integrations"]` y `invalidateQueries` de `integrations.tsx:45-52`.
- Para CA-7, el harness (`src/test/pg-harness.ts:91-101`) aplica `enable row level security`, los `grant` y las políticas de `0002` solo a unas tablas concretas: la prueba crea `integrations` (columnas en `src/integrations/supabase/types.ts`) y le aplica lo mismo, explícito, antes de la migración nueva. Los `grant` también los cubre `alter default privileges … grant all` (`pg-harness.ts:38`), pero se escriben igualmente.
- `native` es una lista propia de `tool-plan.ts` (Apollo, Clay y los alias de CA-2); si más adelante `PROVIDERS` llega a `main`, esa lista puede derivarse de él.
- `webhook` para HubSpot, Attio y Sales Navigator se apoya en `integrations.tsx:39` («hoy entran por webhook»; `NOT_YET` incluye también Pipedrive y Salesforce) y en `leads.entrada.tsx:200` (Sales Navigator), `:207-209` (HubSpot) y `:211-213` (CRM, Attio).
- Alternativas descartadas: columna `connection` en `integrations`; bloquear «Ya lo usamos» (PRD §6); sustituir `WORKING` por el mapa (13 entradas con datos propios).
- Extraer la sección a `src/components/integrations/` sigue la regla «big screens keep only route config and layout» de `AGENTS.md`; ya existen `account`, `discoveries`, `home`, `leads`, `metrics` y `onboarding`, y `@/components/integrations` no colisiona con `@/integrations/supabase`.

## 14. Riesgos y dependencias
- Dos fuentes para «qué se conecta» (`WORKING` y el mapa nuevo) pueden desalinearse. El PRD §7 pedía «unificar el criterio, no añadir un tercero»; este SDD añade el mapa y deja `WORKING` intacto. Decidido por Fede el 2026-11-06 (pregunta 6, anotado en el PRD §7): conviven y la unificación se pide aparte. Mitigación parcial: CA-1 fija la tabla exacta y CA-2 los alias de los nombres de `WORKING`.
- Una política permisiva extra en la base real (por ejemplo creada desde Lovable) anularía la restricción, porque las permisivas se suman con OR. Se comprueba con la verificación manual de §16.
- La migración restringe escrituras: hoy solo `integrations.tsx:48` escribe, pero no se ha buscado fuera de este repo (Lovable Cloud, otros servicios).
- Otra rama puede tomar el mismo número de migración: se resuelve al integrar, contra el máximo de `origin/main` de ese momento.
- `errorText` (`errors.ts:14`) mantiene «Owner o Sales Leader» para el resto de la app; este SDD solo lo esquiva en esta pantalla.

## 15. Preguntas para Fede y para la revisión técnica
**Respuesta de Fede, 2026-11-06: acepta las recomendaciones de las preguntas 2 a 7.** El PRD se actualizó en consecuencia (§6, §7 y G-3). **Corrección (rev. 4):** la pregunta 7 se apoyaba en una premisa falsa que escribí yo («el repo no tiene pruebas de RLS»): `origin/main` tiene PGlite y seis `*.pg.test.ts` (tercera revisión del gate, §17). La rev. 4 mide G-3 con una prueba automática (CA-7) y deja la decisión original del PRD; la pregunta 8 pide tu confirmación. Texto original de cada pregunta, para trazabilidad:

1. Resuelta: PRD aprobado sin bloquear «Ya lo usamos» (2026-11-06).
2. ¿Solo el Owner edita el plan o también el Sales Leader? **Recomendación: solo Owner**, como hoy la interfaz y `docs/sdd/README.md:41` para las conexiones. Si incluyes al Sales Leader, cambian CA-6, CA-7 y la política (`owner` o `sales_leader`, como `quotas` en `0002`).
3. ¿HubSpot, Attio y Sales Navigator cuentan como «Entra por webhook», con aviso propio si el equipo las marca «Ya lo usamos»? **Recomendación: sí**; es lo que dice la página y lo que hace el código.
4. ¿«Nokko» o «NOKKO» en pantalla? **Recomendación: «Nokko»**, como el resto de la página.
5. ¿Quién aplica la migración y cuándo? **Recomendación:** tú o el entorno con acceso a Supabase, primero en preproducción, y solo con CA-7 en verde y tras comprobar el comportamiento a mano en esa base.
6. ¿Aceptas que el mapa nuevo conviva con `WORKING` y `NOT_YET` (sin unificarlos) y que se anote en el PRD §7? **Recomendación: sí**; unificarlos es otro cambio (13 entradas con datos propios) y se puede pedir aparte. Si no, el alcance crece y hay que reescribir este SDD.
7. (Premisa falsa; ver la corrección de arriba.) PRD G-3 se medía con «Prueba de política RLS»; se propuso rebajarlo a estática más manual.
8. **Confirmado por Fede el 2026-11-06.** ¿Confirmas medir PRD G-3 con la prueba automática de políticas con PGlite (CA-7), como pedía el PRD original? **Recomendación: sí**: es una prueba que falla antes y pasa después, con el patrón que el repo ya usa.

## 16. Pendiente de verificar
- Políticas y seed reales de `integrations` en producción (Supabase): requiere acceso a la base. No hecho.
- Definición vigente de `create_organization(_name, _segments)`.
- Comportamiento de las políticas en la base real de Lovable Cloud (preproducción o producción): CA-7 demuestra la política en PGlite, no la base desplegada ni los privilegios reales del propietario de `create_organization`. Verificación manual al aplicar, con estos pasos y su informe en el delta (§18): (1) listar `pg_policies` de `integrations` y comprobar que solo hay las cuatro esperadas (sin políticas permisivas extra); (2) con una cuenta sin rol Owner, intentar actualizar el estado de una fila y comprobar que no se escribe; (3) con el Owner, cambiarlo y comprobar que sí. Es lo que PRD G-3 pide además de la prueba automática.
- Que `origin/main` no necesite snapshot para la migración nueva (precedente de migraciones recientes) y que el script de journal que cita `src/lib/migrations-journal.ts` (`check-migration-journal.mjs`) exista: no está en `origin/main`.
- Que el generador de rutas no se vea afectado por la carpeta nueva `src/components/integrations/` (no debería: no es de rutas).
- Escritores externos a este repo sobre `integrations`.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Informe del gate de 2026-11-06, copiado sin editar. Solo lectura; no ejecutó nada y el directorio no es un repositorio git.

- **Veredicto del gate: Objeciones.** Las citas son correctas, pero hay un error factual sobre `create_organization` y las pruebas de U-3 y U-2 están mal ubicadas. Además, CA-4, CA-5 (lectura) y CA-6 no fallarían antes del cambio.
- Citas comprobadas: correctas `integrations.tsx:23-40`, `:87-91`, `connections.ts:24-33` (los 8 PROVIDERS) y `field-baseline.ts:46`. `0002:117-124` es aproximada: la política va de `0002:119` a `:123`. `0002:210-225` (seed de 15 herramientas) es exacta.
- **CA sin prueba posible o sin G-n:** todos los CA citan un G-n, pero:
  - CA-5 y CA-6: la prueba nombrada no puede ejecutarse. `vitest.config.ts:9` solo incluye `src/**/*.{test,spec}.{ts,tsx}`, y `scripts/factory/gate.mjs:97` y `:149` solo vigilan `src|scripts`. No existe ninguna prueba de RLS en el repo ni una base local (`supabase/` solo tiene `config.toml`).
  - CA-6 incumple GROUND-RULES regla 5: el aislamiento entre organizaciones ya existe en `0002:120` y `:122`, así que pasa antes del cambio. Lo mismo la parte de lectura de CA-5.
  - CA-4 tampoco falla antes (`integrations.tsx:20,88-90`): es regresión, no feature.
  - CA-3 y CA-4: `src/routes/_authenticated/integrations.test.tsx` no tiene precedente (ningún `.test.*` en `src/routes`) y sin `routeFileIgnorePattern` (`vite.config.ts:8-17`) puede alterar `routeTree.gen.ts`. Convención: probar bajo `src/components/` (patrón de `connections-panel.test.tsx:12-40`).
  - CA-1 es casi vacuo: `none` es el valor por defecto. La prueba debe comparar contra una lista esperada de los 15 nombres del seed; el SDD no dice de dónde sale.
  - CA-2 depende de la pregunta 3 abierta; «`not_yet` y también `webhook`» no cabe en un enum de un valor.
- **[Por verificar] resueltos por esta revisión:** el seed es idéntico en `0002:210-225`, `0020:28-42` y `0028:39-53`; `create_organization` es `security definer` en `0002:195` (no probado que el seed no dependa de la política de insert); solo `integrations.tsx:49` escribe en la tabla (ni agente, ni MCP, ni importadores, ni funciones de servidor); ninguna migración posterior a 0002 cambia el RLS de `integrations`; `confirmed()` (`src/lib/save.ts:12-16`) lanza `NOT_SAVED` ante un UPDATE bloqueado.
- **[Por verificar] que sigue sin comprobarse:** políticas y seed reales en producción; `0059_org_connections.sql:2` dice «NOT VERIFIED, not applied anywhere», así que `0060` se apoya en un historial no confirmado; `confirmed()` no cubre un INSERT bloqueado por RLS (ese devuelve error, no cero filas).
- **Contradicciones con el código o con decisiones previas:**
  1. «`create_organization` se redefine en `0056`» es falso (§3 y §16): `0056:5-10` define `create_organization_full` y llama a `create_organization(_name, _segments)`, que solo existe comentada en `0020:1` y `0028:1`. La definición vigente no es comprobable desde el repo.
  2. «Sustituir WORKING por el mapa compartido» no cuadra: `WORKING` (`integrations.tsx:23-37`) tiene 13 entradas con `what`, `to`, `hash` y `pending`; solo Apollo, Clay, Parallel, Perplexity, Firecrawl y Google Drive están en `PROVIDERS`. Logo.dev, Apify, Telegram, MCP, webhooks, CSV y Email semanal no. `NOT_YET` (`:40`) son 3 cadenas e incluye Pipedrive y Salesforce, que no están en el seed. El PRD §7 pide unificar el criterio y el SDD añade `tool-plan.ts` sin resolverlo.
  3. `not_yet` y `none` se pintan igual («Sin conexión nativa»; 3 etiquetas para 4 tipos). GitHub, Slack, Sales Navigator, Instantly, Lemlist, DocuSign y PandaDoc no aparecen en WORKING ni en NOT_YET y no tienen código propio; el aviso «aún no se conecta» es engañoso para lo que no está previsto.
  4. La política de Owner debe llevar también `org_id = public.current_org()` (`0002:122` en update; el insert actual no lo tiene, `0002:121`); sin él, un Owner de dos organizaciones puede escribir en una que no es la activa y se debilita CA-6.
  5. `src/lib/errors.ts:14` mapea RLS (`42501`) a «Pídeselo al Owner o a un Sales Leader», que contradice «solo Owner»; el PRD §2 cita a Sales Leader y la pregunta 2 sigue abierta.
  6. Copy: el texto de sección que el SDD deja «sin cambios» usa «vosotros» (`integrations.tsx:75`), contra la regla de «tú»; «NOKKO» vs «Nokko» sin norma única.
  7. `AGENTS.md` pide módulos por pantalla bajo `src/components/<screen>/`; una prueba pegada a la ruta lo contradice.
  8. Compatibles: multitenant (`org_id`, `has_org_role`), roles por organización y «solo el Owner gestiona conexiones» (README docs/sdd:40).
- **Lo que esta revisión NO demuestra:** nada sobre producción (políticas, seed, `create_organization` vigente, si 0059 está aplicada); no ejecutó ninguna prueba, así que «tiene prueba posible» es juicio sobre el repo; no comprobó que `integrations.test.tsx` rompa el generador de rutas; no buscó fuera de este repo (Lovable Cloud, bases compartidas), así que no descarta escritores externos; no validó `confirmed()` ni `errorText` contra una base real; no evaluó si debe ser un solo SDD ni la prioridad.

### Segunda revisión del gate (sobre la rev. 2), 2026-11-06, copiada sin editar
Solo lectura; no ejecutó ninguna prueba.

- **Veredicto del gate: Objeciones.** Tres bloqueantes y varias correcciones menores: la base del SDD no es `origin/main`; CA-1 fija en una prueba una etiqueta falsa para LinkedIn Sales Navigator; las cadenas con «NOKKO» de CA-3 y CA-4 contradicen el §9 del propio SDD.
- **CA sin prueba posible o sin G-n:**
  - Todos los CA citan un G-n y las rutas de prueba entran en `vitest.config.ts:11`.
  - CA-8 no tiene prueba automática (declarado), pero PRD G-3 se mide con «Prueba de política RLS» (`PRD:27`), así que G-3 queda sin la medida que el PRD pide.
  - Regla 5: las pruebas de U-1, U-2 y U-3 fallan antes solo porque el módulo o el archivo no existe (el «import roto» que `gate.mjs` cuenta aparte). CA-5 se declara regresión, pero vive en un componente nuevo, así que «ya pasa hoy» no es comprobable con esa prueba.
  - CA-6: `confirmed()` lanza `NOT_SAVED` ante cualquier UPDATE con cero filas (`save.ts:15`) y su texto admite «o que el registro ya no exista» (`save.ts:6-7`); mapearlo a «Solo el Owner puede cambiar el plan» rotula mal el registro borrado. Con la política propuesta, un no-Owner recibe cero filas, así que la rama `42501` es prácticamente inalcanzable. El CA no dice si el mensaje es toast o inline, y `connections-panel.test.tsx:16-29` solo mockea `select`, no `update().eq().select()`.
  - CA-2 no fija la firma de retorno de `connectionFor`.
- **[Por verificar] que sigue sin comprobarse:**
  - «0060 es el siguiente número libre» queda resuelto en contra. Solo es cierto en este árbol (`drizzle/migrations` termina en `0059`; journal de 60 entradas). En `origin/main` (0040239, 2026-11-06) existen `0060_field_edit_log` a `0076_platform_admins_skip_creator` y el journal tiene 75 entradas. Esta rama (`feat/software-factory`, f39cd41) está 278 commits por detrás de `origin/main` y 28 por delante. `origin/main` tiene la guardia `src/lib/migrations-journal.ts`: número único por archivo y entradas nuevas por encima del máximo de `main` (0076).
  - Base real de la implementación: `src/lib/connections.ts` (`PROVIDERS`), `connections-panel.tsx` y `0059` existen en esta rama y no en `origin/main`. CA-2 depende de `PROVIDERS` (`SDD:5`). El ledger tiene `base_commit: null`.
  - Políticas y seed reales en producción; definición vigente de `create_organization(_name, _segments)` (solo comentada en `0020:1` y `0028:1`); escritores fuera del repo.
  - Comprobado: dentro del repo el único escritor es `integrations.tsx:49`; ninguna migración posterior a 0002 toca las políticas de `integrations`.
- **Contradicciones con el código o decisiones previas:**
  1. Base y numeración (bloqueante): si el trabajo va a `main`, `0060_integrations_owner_write` choca con `0060_field_edit_log`.
  2. CA-1 y Sales Navigator (bloqueante): la tabla cuadra con los 15 nombres del seed (`0002:211-225`: 2 `native`, 2 `webhook`, 4 `not_yet`, 7 `none`), pero asigna `none` a LinkedIn Sales Navigator y el código tiene entrada: `leads.entrada.tsx:91` y `:200`, `src/routes/api/public/accounts.ts:3`, `account-import.tsx:95`. Es la misma vía que el SDD llama `webhook` para HubSpot y Attio (`leads.entrada.tsx:207-212`, `onboarding/sources.tsx:65`). El resto de los `none` no tiene código propio; Slack solo aparece en texto de ayuda (`field-help-data.ts`).
  3. PRD G-2 contra CA-4: el PRD nombra HubSpot entre las herramientas «sin conexión nativa» (`PRD:20`) y pide que «Ya lo usamos» sin conexión nativa no sugiera que NOKKO la lee (`PRD:26`). CA-4 no avisa para `webhook`, así que HubSpot y Attio en «Ya lo usamos» quedan sin aviso, y `NOT_YET` ya los lista como «Aún sin conexión nativa» (`integrations.tsx:40`). «Entra por webhook» tampoco dice que el equipo debe montar el flujo.
  4. PRD §7 contra SDD §5 y §14: el PRD dice «unificar el criterio, no añadir un tercero» (`PRD:44`); el SDD añade `tool-plan.ts` junto a `WORKING` y `PROVIDERS` y deja la unificación fuera sin pedírselo a Fede.
  5. Copy: CA-3 y CA-4 fijan «NOKKO no se conecta a ella» y «NOKKO no tiene conexión con ella hoy.», pero el §9 dice «Nokko» en pantalla (`SDD:70`; pregunta 4 abierta).
  6. U-3 omite el journal: falta la entrada idx 60 en `drizzle/migrations/meta/_journal.json` con `when` mayor que 1792933820000 (`_journal.json:422`). 0058 y 0059 están en el journal sin snapshot, precedente para omitirlo.
  7. SQL del §10: nombres y `has_org_role(_org uuid, _role app_role)` coinciden con `0002:46` y `:121-122`; faltan `drop policy if exists … on public.integrations`, `to authenticated` y `for insert`/`for update` (sin `to authenticated` la política cubre `public`).
  8. Citas inexactas: `vitest.config.ts:9` debe ser `:11`; `0020:28-42` y `0028:39-53` omiten la última fila (PandaDoc en `0020:43` y `0028:54`); `connections-panel.test.tsx:12-40` es aproximada (mocks de `:7` a `:38`, el de `PROVIDERS` en `:40-43`). El resto de citas son correctas.
  9. `AGENTS.md` y el generador de rutas: `src/components/integrations/` no contradice `AGENTS.md` (ya existen `account`, `home`, `leads`, `metrics`, `discoveries`, `onboarding`) y no colisiona con `@/integrations/supabase`. El comportamiento del generador con un `.test.*` en `src/routes` no se pudo comprobar.
  10. `create_organization` es `security definer` (`0002:195`); `org_members` (owner) y `profiles.current_org_id` se escriben antes del insert del seed (`0002:201-202`), así que la política nueva la dejaría pasar. No probado contra una base real.
- **Lo que esta revisión NO demuestra:** nada sobre producción (políticas, seed, `create_organization` vigente, si `0059` está aplicada); no ejecutó pruebas ni el generador de rutas; no validó `confirmed()` ni `errorText` ni la respuesta de PostgREST contra una base real; no sabe cuál es la rama destino definitiva (comparó `HEAD` f39cd41 con `origin/main` 0040239, no miró `production` ni Supabase); no descarta escritores externos ni ramas como `backup/*`; no evalúa prioridad ni si debe ser un único SDD; no buscó datos de clientes en lo que revisó y no los vio.

### Tercera revisión del gate (sobre la rev. 3), 2026-11-06, copiada sin editar
Toda comprobación con `git show` y `git grep` sobre `origin/main` (0040239). No ejecutó pruebas ni migraciones.

- **Veredicto del gate: Objeciones.** Las citas y la tabla de CA-1 se sostienen casi en su totalidad. El bloqueante es que el SDD afirma «el repo no tiene base local ni pruebas de RLS» y en `origin/main` sí las hay.
- **CA sin prueba posible o sin G-n:** todos los CA citan un G-n y todas las rutas de prueba caen dentro de `include: src/**/*.{test,spec}.{ts,tsx}` (`vitest.config.ts:11`, origin/main).
  1. **CA-9 y CA-7: la premisa es falsa (bloqueante).**
     - El SDD dice «el repo no tiene base local ni pruebas de RLS» (§7 CA-9) y el PRD repite la idea en G-3 (§4).
     - En origin/main: `src/test/pg-harness.ts:7` importa PGlite y `package.json:88` declara `@electric-sql/pglite`; hay seis `*.pg.test.ts` (`src/lib/migrations.pg.test.ts`, `strategy-f0.pg.test.ts`, `strategy-review.pg.test.ts`, `strategy-execute.pg.test.ts`, `experiments.pg.test.ts`, `migrations-acquisition-motion.pg.test.ts`). Ejecutan RLS con dos empresas ficticias: `as(db, U.aeA, …)` y `U.ownerB` en `migrations.pg.test.ts:42-71`; el harness da `ownerA`, `aeA`, `ownerB` y el sales leader que añade la propia prueba (`pg-harness.ts:113-116`). `docs/DESARROLLO.md:61` manda probar las migraciones en local con PGlite y `:33` lo cuenta («6 son de Postgres»).
     - Efecto: CA-9 (miembro sin rol Owner, Owner de la organización activa y Owner de una organización no activa) es automatizable. El harness ya replica las políticas de `0002:119-123` con el mismo bucle (`pg-harness.ts:91-101`); solo habría que añadir la tabla `integrations`, cuyas columnas están en `src/integrations/supabase/types.ts:2549`. Esa prueba sí cumpliría la regla 5: antes de la migración, un no-Owner actualiza. La estática de CA-7 solo falla porque el archivo no existe.
     - El PRD pedía originalmente una «prueba de política RLS». El SDD la rebaja a «estática + manual» por una premisa errónea; la pregunta 7 y la decisión de Fede del 2026-11-06 se apoyaron en ella.
  2. **U-1: fail-first solo por import roto.** `scripts/factory/gate.mjs` cuenta aparte los archivos que fallan sin ejecutar ninguna aserción. Un stub `connectionFor → none` haría fallar la tabla de CA-1 por la razón correcta; el SDD dice «no hay otra forma».
  3. **CA-2 infraespecificado:** «ignora mayúsculas y espacios» no lleva «Apollo.io» a «Apollo»; hace falta un alias o quitar el sufijo `.io`. En `integrations.tsx:32` el nombre de WORKING es «Apollo.io».
  4. CA-5, CA-6, CA-4 y U-2a/U-2b: viables y coherentes. CA-5 es regresión y no cuenta como prueba que falla primero. CA-4 y la parte del toast de CA-6 fallarían de verdad sobre U-2a (hoy el toast es `errorText(e)`, `integrations.tsx:49`, y para `42501` da «Owner o Sales Leader», `errors.ts:14`). La parte de CA-6 «el estado vuelve al valor del servidor» no es fail-first: el `select` es controlado por `i.status` (`integrations.tsx:86`). Falta definir si el componente trae su propio `useQuery` y `useMe`; los mocks descritos lo suponen y `["integrations"]` debe conservarse.
- **[Por verificar] que sigue sin comprobarse:** políticas y seed reales en producción; definición vigente de `create_organization(_name, _segments)` (en origin/main solo como SQL comentado, `0020:7`, `0028:4`, y la versión de un argumento de `0002:194`, que `0020:5` dice haber eliminado; de las copias con comentario «security definer» —`0002:195`, `0020:8`, `0028:5`— cuelga la afirmación del §10 de que la política deja pasar el seed; el SDD ya la marca «no probado»); escritores fuera del repo (dentro del repo, único escritor: `integrations.tsx:48`, grep en `src`, `scripts`, `supabase` y `.lovable`).
  - Resueltos: `check-migration-journal.mjs` no existe en origin/main (`docs/BASE-DE-DATOS.md:162`, `docs/ESTADO-Y-DEUDA.md:24`, `src/lib/AGENTS.md:58`). Snapshot: origin/main no tiene snapshot para 0058-0073; sí lo tienen 0056, 0057, 0075 y 0076, y ningún test lo exige; el precedente es mixto y `journalProblems` (`migrations-journal.ts:9`) no lo comprueba.
- **Contradicciones con el código o decisiones previas:**
  1. PGlite (CA-9, CA-7 y PRD G-3): contradice `docs/DESARROLLO.md:61` y `:33`.
  2. Citas inexactas en las secciones 1-16: §13 «`integrations.tsx:40` («hoy entran por webhook»)» es `:39` en origin/main (la 40 está vacía); §13 «`leads.entrada.tsx:200`» apoya a HubSpot y Attio pero `:200` es solo el acordeón de Sales Navigator (HubSpot en `:207-209`, el CRM con Attio en `:211-213`); §15 pregunta 2 «`docs/sdd/README.md:40`» es `:41` («Quién gestiona conexiones»; en `:40` está «Proveedores con cuenta propia»); §3 agrupa `account-import.tsx:95` bajo «vías de entrada por webhook», pero ese texto es de CSV.
  3. Consistentes con el código: las líneas citadas de `integrations.tsx` (`:19-40`, `:45`, `:48`, `isOwner` en `:85`), `0002` (`:46`, `:119-123`, `:121`, `:122`, `:195`, `:201-202`, `:210-225`), `save.ts:5-16` y `errors.ts:14`; las ausencias de `PROVIDERS`, `connections-panel` y `0059`; último migration 0076, journal hasta idx 74 con `when` 1793749600002, y 0074 no existe como archivo ni entrada, así que «0077» es válido y el nuevo `idx` sería 75; `migrations-journal.ts` y su test; `icp-editor.test.tsx` y `strategy-screens.test.tsx` mockean supabase y `useMe` (y `sonner`); las tres rutas de entrada existen; `has_org_role`, `current_org` e `is_org_member` solo se definen en `0002` y ninguna migración posterior toca las políticas de `integrations`.
  4. CA-1 coincide con el seed: los 15 nombres de `0002:211-225` coinciden con la tabla, sin duplicados ni huecos; `0020:28-43` y `0028:39-54` son idénticos; 2+3+4+6 = 15; `webhook` para HubSpot y Attio y `not_yet` para Gmail, Calendar, Gong y Fireflies concuerdan con `NOT_YET` (`integrations.tsx:39`). Pipedrive y Salesforce están en `NOT_YET` y en `leads.entrada.tsx:212` pero no en el seed; si alguien los añade a mano, CA-2 los pinta «Nokko no se conecta a ella», que contradice `NOT_YET`; los CA no lo cubren.
  5. SQL del §10: válido y coherente con `0002` (nombres `org insert` y `org update`, `has_org_role(_org uuid, _role app_role)` en `:46`, `current_org()` en `:38`, `to authenticated`, `drop policy if exists`); `org read` se conserva, así que el `.select("id")` de `confirmed()` sigue funcionando; `useMe` deriva `roles` solo del rol de la organización actual (`use-me.ts`), igual que `org_id = current_org()`; la entrada de journal (`version "7"`, `breakpoints true`, `tag` igual al nombre del archivo) es válida contra `migrations-journal.ts:9-23`.
  6. Omisión: superadmins. `0075_platform_admins.sql` hace Owner a los superadmins de todas las organizaciones (existentes y futuras) en `org_members`; `has_org_role` les deja pasar con la política nueva. El SDD no lo menciona y CA-9 debería contemplarlo. `0075` y `0076` no alteran `has_org_role` ni `current_org`.
  7. Sin rollback: el SDD no describe cómo deshacer la migración; `0071` sí lo documenta en su cabecera.
  8. Restos anteriores a la decisión: PRD §6 conserva las filas «¿Bloquear?: Abierta» y «Quién cambia el plan: Propuesta, pendiente»; el título de NK-0064 en `.factory/ledger.json:1660` dice «avisar/bloquear» y «gate de owner solo en UI», contra el PRD aprobado. Ninguno es del SDD, pero conviene alinearlos.
  9. Copy y datos de clientes: español con «tú» en CA-3, CA-4, CA-6 y en el texto de §9 (el «vosotros» actual, `integrations.tsx:73`, se sustituye); las secciones 1-16 no contienen datos de clientes.
- **Lo que esta revisión NO demuestra:** nada sobre producción (políticas reales, seed real, `create_organization` vigente, qué migraciones están aplicadas; `src/lib/AGENTS.md` dice que `0071` no está aplicada en la base real); no ejecutó vitest, ni PGlite, ni el generador de rutas, así que «fallaría primero» y «es viable» son juicio sobre el código leído; no probó el mock de CA-6 ni validó `confirmed()` y `errorText` contra PostgREST real (solo que los patrones de `icp-editor.test.tsx:15-45` soportan `select().order()` y `update().eq().select()`); no demuestra que la migración deje pasar a `create_organization` (con PGlite se probaría la política, no la propiedad ni los privilegios reales del propietario de la función); no descarta escritores externos ni ramas distintas de `origin/main`; no evaluó prioridad ni si debe ser un solo SDD; no leyó las secciones 17 y 18 como evidencia, como se pidió.

### Cuarta revisión del gate (sobre la rev. 4), 2026-11-06, copiada sin editar
Solo lectura, todo contra `origin/main`. No ejecutó vitest, ni PGlite, ni el SQL del §10.

Nota previa del gate: `origin/main` ya no está en `0040239` sino en `a43200d` (`0040239` es ancestro). Comprobó que el diff entre ambos no toca `drizzle/`, `src/test`, `src/routes`, `src/components`, `src/hooks`, `save.ts` ni `errors.ts`, así que las citas siguen valiendo. El journal sigue en 75 entradas, idx 74, `when` 1793749600002.

- **Veredicto del gate: Objeciones.** Ninguna es bloqueante de diseño, pero tres cambian lo que el autor escribiría: CA-7 sin forma demostrable de fallar por la razón correcta, un montaje del harness incompleto en el §13 y restos de «decisión abierta» que contradicen el §15.
- **CA sin prueba posible o sin G-n:** los ocho CA citan un G-n y las rutas de prueba entran en `vitest.config.ts:11` (origin/main).
  1. **CA-7, «falla primero por comportamiento» no es demostrable tal como está escrito.** En el commit base no existe el archivo de migración; si la prueba lo aplica con `migrate(db, [...])`, que hace `readFileSync` (`pg-harness.ts:109-111`), el fallo en base es un `ENOENT` en `beforeAll`: fallo de montaje, no de aserción. El SDD no dice cómo se ve a `aeA` escribiendo antes de la migración. Salida: la prueba localiza el archivo por patrón `*_integrations_owner_write.sql` y lo exige con una aserción, y un bloque de control con solo las políticas de `0002` donde `aeA` actualiza 1 fila e inserta. La prueba no puede fijar «0077» en el nombre: el §10 dice que el número se confirma al integrar.
  2. **CA-7, montaje incompleto en el §13.** El «mismo bucle de `0002:119-123`» solo hace `create policy`; el harness además hace `enable row level security` y los `grant` a `authenticated` y `service_role` (`pg-harness.ts:93-95`). Sin `enable row level security` nadie queda bloqueado y la prueba falla después de la migración. Los `grant` quedan cubiertos por `alter default privileges … grant all` (`pg-harness.ts:38`), pero lo explícito es más seguro, como hace el bucle de `pg-harness.ts:94`. Falta también `// @vitest-environment node` (primera línea de `migrations.pg.test.ts`, `strategy-f0.pg.test.ts` y `experiments.pg.test.ts`; `src/test/setup.ts` protege `window`) y el timeout de `beforeAll` (`experiments.pg.test.ts:31`, `60_000`).
  3. **CA-8, parte estática.** Si `src/test/integrations-policies.test.ts` abre el archivo directo, falla por `ENOENT`; debe buscarlo con `readdirSync` y exigir `toHaveLength(1)`. La parte del journal ya la impone el test existente (`migrations-journal.ts:19-22`); repetir «mayor que 1793749600002» con una constante fija se romperá en cuanto otra migración llegue antes.
  4. **Sin CA ni prueba:** el texto de sección nuevo en «tú» (§9); que el no-Owner no vea el selector (§8, «como hoy»; CA-5 y CA-6 solo prueban Owner); la verificación manual en la base desplegada, que el PRD G-3 exige (`PRD:27`): el SDD la nombra (§10, §15 pregunta 5, §16) pero no define pasos, por ejemplo listar `pg_policies` de `integrations` y probar con una cuenta no Owner.
- **[Por verificar] que sigue sin comprobarse:** políticas reales de `integrations` en producción (una política permisiva extra, por ejemplo creada desde Lovable, anularía la restricción, porque las permisivas se suman con OR; el SDD declara el hueco pero no el riesgo concreto); definición vigente de `create_organization(_name, _segments)` (en origin/main solo `0002:194-195` y copias comentadas en `0020`/`0028`; `create_organization_full` la llama, `0056_org_lifecycle.sql:10`); que la política nueva deje pasar el seed (con `security definer` y un propietario con BYPASSRLS ni se evalúa, y si se evaluara pasaría, `0002:201-202`; no probado); escritores externos a este repo (dentro del repo solo escribe `integrations.tsx:48`, comprobado con `git grep` sobre `src`, `scripts`, `supabase` y `.lovable`); que no haga falta snapshot (existen para 0056, 0057, 0075 y 0076, no para 0058-0073; ningún test los exige); la confirmación de Fede de la pregunta 8 solo consta en texto del SDD y del PRD.
- **Contradicciones con el código o decisiones previas:**
  1. Restos stale en el SDD (§5, §9 y §14 contra §15 y PRD §6-§7): §5 deja «unificarlos» como «decisión abierta, pregunta 6»; §14 dice que el PRD §7 «pedía unificar» y que «necesita tu decisión (pregunta 6)»; §9 condiciona la grafía a la pregunta 4. El §15 dice que Fede aceptó las preguntas 2 a 7 y el PRD §7 ya recoge que no se unifica.
  2. «Nokko no se conecta a ella» para nombres no mapeados es falso en casos reales: CA-2 y §8 mandan `none` a todo nombre desconocido; si el equipo añade a mano Google Drive, Firecrawl, Parallel o Perplexity, que `WORKING` lista como «Disponible» (`integrations.tsx:26,28,30-31`), la misma página dice dos cosas opuestas. Apollo, Clay y Apollo.io sí están cubiertos; el resto del catálogo de `WORKING` no. Además el texto de sección promete que la etiqueta «sí refleja lo que Nokko hace hoy» (§9), lo que no se sostiene para los no mapeados: hay que acotar el copy de `none` («Sin conexión conocida») o añadir alias.
  3. CA-7 (d) está mal condicionado: `as(db, uid, fn)` solo fija el usuario (`pg-harness.ts:126-129`); la empresa activa sale de `profiles.current_org_id`, que se puede tocar con `db.exec` fuera de `as()` (no hay trigger de guarda en el harness). (d) se puede hacer siempre: añadir a `ownerA` como owner de B y probar un insert con `org_id` de B; antes de la migración pasa (`is_org_member(B)`) y después falla, así que (d) discrimina; conviene hacerlo incondicional.
  4. (a) y (c) de CA-7 no fallan antes; solo (b) y (d) discriminan. La prueba debe dejar claro que lo que cuenta como fail-first es (b)/(d).
  5. PRD §3 dice «0003-0059»; el SDD comprueba hasta 0076.
  6. `.factory/ledger.json:1660` en origin/main: NK-0064 sigue titulado «avisar/bloquear» y «gate de owner solo en UI», con `state: LOGGED` y `base_commit: null`; contradice el PRD aprobado. Hay que alinearlo antes de lanzar el brief.
  7. §3 agrupa mal `account-import.tsx:95`: lo pone bajo «Vías de entrada por webhook» y es texto de un CSV (`src/components/account-import.tsx:93-97`; no está en `src/routes`).
  8. El mensaje «Owner o Sales Leader» de `errors.ts:14` se sigue mostrando fuera de esta pantalla (§14 lo declara).
- **Lo que sí se sostiene:** citas verificadas en `origin/main` (`integrations.tsx:19-39`, `:44`, `:45`, `:48`, `:49`, `:85`; `0002:46`, `:119-123`, `:121-122`, `:140-141`, `:195`, `:201-202`, `:210-225`; `0020:28-43`; `0028:39-54`; `save.ts:5-16`; `errors.ts:14`; `leads.entrada.tsx:91,151,200,207-213`; `api/public/accounts.ts:3`; `migrations.pg.test.ts:42-71`; `docs/DESARROLLO.md:33,61`; `docs/sdd/README.md:41`; `pg-harness.ts:91-101`; `0071_segment_acquisition_motion.sql:10`). Tabla de CA-1: los 15 nombres coinciden, sin duplicados, 2+3+4+6 = 15; Pipedrive y Salesforce → `webhook` es coherente con `leads.entrada.tsx:212` y `NOT_YET`. Journal: 75 archivos `.sql` y 75 entradas; 0074 no existe, el máximo es 0076 y el nuevo sería 0077 / idx 75. SQL del §10 y rollback: nombres, `to authenticated` y el `with check` del update coinciden con `0002:121-122`; el rollback recrea exactamente esas políticas; `org read` y `org delete owner` no se tocan, así que `.select("id")` de `confirmed()` sigue funcionando. U-1 (stub), U-2a/U-2b y CA-5 son coherentes; CA-4 y la parte del toast de CA-6 fallan sobre U-2a (hoy `integrations.tsx:49` hace `errorText(e)`, que para `42501` da «Owner o Sales Leader»); los mocks de `icp-editor.test.tsx:15-58` y `strategy-screens.test.tsx:12-40` soportan `select().order()` y `update().eq().select()`, aunque falta que el mock sea controlable por prueba para devolver `[]` o un error; un componente con su propio `useQuery` y `useMe` es viable (`use-me.ts:35-37`). Sin datos de clientes en las secciones 1-16; copy en español con «tú».
- **Lo que esta revisión NO demuestra:** nada sobre producción (políticas reales, seed real, `create_organization` vigente, migraciones aplicadas); no ejecutó vitest, PGlite, el SQL del §10 ni el generador de rutas, así que «falla antes», «0 filas en vez de error» y «error RLS en el insert» son juicio sobre el harness y la semántica de Postgres; no validó `confirmed()` ni `errorText` contra PostgREST real; no descarta escritores fuera de este repo ni ramas distintas de `origin/main`; no evalúa prioridad, tamaño del SDD ni si G-2 se cumple con las pruebas automáticas (el PRD lo mide con walkthrough); no comprobó la confirmación de Fede en el chat, solo lo que dicen los documentos; no tocó ningún archivo.

## 18. Delta de implementación (lo rellena el agente al entregar)
Implementado el 2026-11-06 en `feat/tool-plan-real-connections` (base `a43200d0bb68c31ae5723a21f22338ad0d2f2895`). Paquete de resultado: `.factory/evidence/NK-0064/result.md`. Lo que difiere de lo escrito arriba:
- **Migración:** `0077_integrations_owner_write.sql`, entrada de journal idx 75 con `when` 1793836000002. No se aplicó en ninguna base.
- **CA-7, caso (d):** el insert se hace sin `RETURNING`. Con `RETURNING` la política de lectura oculta la fila de una empresa que no es la activa y el insert fallaba por esa razón también antes de la migración, sin probar nada de la política de insert. El bloque de control demuestra que, antes de la migración, `ownerA` inserta en B.
- **CA-7, política de lectura:** añadido un caso «members still read the plan of their active company, and only that one», de no regresión.
- **CA-8:** la parte estática también exige la palabra «rollback» en la cabecera de la migración.
- **Formato:** los archivos nuevos se formatearon con prettier; `integrations.tsx` no (deuda previa).
- **CA-5:** además del selector sin deshabilitar, una segunda prueba comprueba que el Owner puede marcar «Ya lo usamos» en una herramienta sin conexión.
- **Tras el gate (2026-11-06):** la prueba PGlite se hizo independiente del orden y se ampliaron sus casos: (e) update en una empresa que no es la activa, (f) mover una fila a otra empresa, borrado sin cambios y rollback de la cabecera ejecutado en PGlite. Lint: `gate.mjs` falla por la deuda previa de prettier de `integrations.tsx`; pendiente de decisión de Fede.
- **Visual:** el componente se vio con datos ficticios en escritorio claro y oscuro y en 375 px oscuro (sin desbordamiento horizontal; 375 px claro solo por DOM), no la pantalla real dentro de la app. **Base real:** sin verificar; ver el paquete de resultado.
