# SDD-20261109-rls-price-suggestions-and-notices · [Bug] La base de datos aplica la regla de las sugerencias de precio y deja tocar de un aviso solo «leído»

**Tipo:** Bug (permisos, con una migración en el Sprint 3, U-2; U-1, aplazada, llevará la suya) · **Prioridad propuesta:** Media (NK-0044: hoy el servidor ya filtra; NK-0070: severidad baja según su gate)
**Estado:** Hecho — PR #117 (ccd37fb) (U-2); U-1 Aplazada — coordinador por delegación de Fede (2026-11-09), gate pasadas 1 y 2 (U-1: decisión de Fede del 2026-11-01, «hasta decidir el destino de la base»; fuera del Sprint 3) · **Pide:** Fede (Sprint 3) · **Aprueba:** Fede · **Fecha:** 2026-11-09
**Tickets:** NK-0044 (U-1) y NK-0070 (U-2), independientes entre sí
**PRD:** No aplica (bugs de permisos) · **Depende de:** NK-0042 (`SDD-20261101-price-suggestions-visibility-server.md`, en `main`: regla en código)
**Relación con:** `SDD-20261101-price-suggestions-rls.md` (Aplazado el 2026-11-01). La U-1 de este SDD es una propuesta para cuando NK-0044 se desbloquee: recoge los bloqueantes B-1, B-2 y los importantes I-1 a I-3 de aquel gate, pero no sustituye a aquel SDD ni entra en el Sprint 3. Solo U-2 se construye ahora.

> **En el Sprint 3 solo entra U-2 (NK-0070).** U-1 queda escrita como propuesta aplazada; no tiene número de migración ni brief.
> Nivel elegido: SDD corto con dos unidades. Las dos tocan RLS o GRANT (tabla de `nokko-shape`: exige SDD). Van juntas porque las dos son migraciones de permisos con la misma comprobación previa en la base viva; cada una se puede integrar, aplicar y revertir sola.
> Números de línea comprobados en `main` `1fef724`.

## 1. Resumen
**U-1 (NK-0044), aplazada.** La regla «una sugerencia de precio solo la ven y deciden Owner, Sales Leader y Deal Desk» vive solo en código (`canViewStrategy`). La migración propuesta (número por fijar cuando se desbloquee) la copiaría en la base: políticas restrictivas de lectura y actualización en `suggestions`, un disparador que descarta en silencio la inserción de una fila de precio hecha por quien no tiene esos roles (así la sincronización no falla, B-1 del gate anterior) y políticas restrictivas en `strategy_changes` y `strategy_links` que cuelgan de la sugerencia de origen, no del elemento (B-2).
**U-2 (NK-0070), Sprint 3.** Un miembro puede reescribir cualquier columna de sus avisos (`dedupe_key`, `title`, `body`, `link`, `org_id`…). La migración `0082` deja a `authenticated` actualizar solo `read_at` (permiso por columna), que es lo único que la aplicación cambia desde el navegador.

## 2. Problema y para quién
- U-1: un miembro sin rol de precios puede leer, con el cliente del navegador y su sesión, el título y el cuerpo de una sugerencia de precio, y aceptarla, aplazarla o descartarla con `decide_strategy_suggestion`, saltándose el filtro de la aplicación.
- U-2: cualquier miembro puede cambiar con su sesión el texto, el enlace, la clave de deduplicación o la empresa de sus propios avisos. Afecta solo a sus avisos (la política exige `user_id = auth.uid()`), pero la clave de deduplicación decide si llega un aviso de «Dinero» futuro (`0078:18-21`).

## 3. Evidencia y por qué ahora
**U-1, la regla en código (lo que la RLS debe copiar exactamente):**
- `src/lib/strategy-suggestions.ts:420-433`: `needsPriceAccess(r) = r.detector === "strategy_product_price" && (r.dedupe_key ?? "").startsWith("strategy_product_price:price:")`; `PRICE_ROLES = ["owner", "sales_leader", "deal_desk"]`; `canViewStrategy(r, roles) = !needsPriceAccess(r) || canSeePrices(roles)`.
- Usos: `src/lib/agent.functions.ts:291` (decidir), `src/lib/agent/tools/core-read.ts:445-449` (lista del agente), `src/components/suggestions.tsx:108`, `src/components/suggestion-board.tsx:71`, `src/lib/telegram-roles.ts:10` (Telegram filtra por el prefijo).
- Quién crea la clave: `src/lib/proactive/detectors/strategy-product.ts:42` (`cause: price:<key>:<producto>`).

**U-1, la base hoy:**
- `drizzle/migrations/0013_suggestions_team_visibility.sql:4-10`: «org read» y «org update» filtran por empresa, pertenencia y asignación; no miran precio.
- `0007_agent_proactive_channels.sql:99`: «org insert» solo exige `is_org_member(org_id)`.
- `decide_strategy_suggestion` (0068, reescrita en `0073_strategy_decisions_guard.sql:72`) actualiza con los permisos de quien llama (SECURITY INVOKER): si la fila no se ve, cambia 0 filas.
- `strategy_decisions` ya se oculta sola: su lectura exige `EXISTS (SELECT 1 FROM suggestions …)` (`0068:86-88`).
- `strategy_changes` y `strategy_links`: lectura de toda la empresa e inserción con `EXISTS` sobre la sugerencia (`0070_strategy_execution.sql:45-53`); los dos tienen `suggestion_id`.

**U-1, lo que rompió la propuesta anterior (gate del 2026-11-01, copiado en `SDD-20261101-price-suggestions-rls.md` §17):**
- B-1: con una política de lectura más estricta, `INSERT … ON CONFLICT DO NOTHING` de una fila de precio por un miembro sin rol da `42501` (la sonda del gate en PGlite 0.5.11 / PostgreSQL 18.6), y `syncStrategySuggestions` (`src/lib/strategy-core.ts:144`) pierde todo el lote sin comprobar el error, porque `refreshSuggestions` (`agent.functions.ts:246-250`) detecta sin filtrar por rol. La sonda probó que un disparador `BEFORE INSERT` que devuelve `NULL` para esas filas deja entrar el resto del lote sin error.
- B-2: ocultar `strategy_changes` por `element = 'product_price'` rompe «Aceptar» de `catalog:unsold`, que no es de precio según `needsPriceAccess` (`src/lib/proactive/detectors/strategy-product.ts:75`), porque `proposeChange` inserta con `RETURNING` (`src/lib/strategy-execute-core.ts:47-51`).
- I-2: `DROP POLICY` + `CREATE POLICY` sin transacción deja una ventana; I-3: numeración. Este SDD usa políticas **restrictivas nuevas** (no toca las de 0013) dentro de una transacción.

**U-2, la base hoy:**
- `drizzle/migrations/0049_notifications_center.sql:21`: `grant select, update on public.notifications to authenticated` (tabla entera).
- `0049:26-28`: «own mark read» `using (user_id = auth.uid() and is_org_member(org_id)) with check (user_id = auth.uid())`: nada limita las columnas ni `org_id`.
- Columnas añadidas después: `telegram_sent_at` (`0050_background_jobs_all_actions.sql:13`), `dedupe_key` con `unique (user_id, dedupe_key)` (`0078_money_moment_notices.sql:18-21`).
- Escrituras de la aplicación a `notifications` (búsqueda de `from("notifications")` en `src`): la única desde el navegador es `src/components/notification-center.tsx:139-142`, `update({ read_at })`. Las demás son de `src/lib/notices.server.ts` con el cliente admin (`:83` `telegram_sent_at`, `:97`, `:112`, `:148` lecturas e inserción con `db: Admin`) y de las funciones `security definer` `notify_job_end` (0049) y `money_notify` (0078/0079). No hay RPC ni herramienta del agente que escriba avisos.

**Uso real:** sin dato para las dos (el 2026-11-01 se midieron 0 sugerencias de precio; no se ha vuelto a medir).

**Por qué ahora:** U-2 entra en el Sprint 3. NK-0044 (U-1) sigue aplazado «hasta decidir el destino de la base» (decisión de Fede del 2026-11-01, confirmada por el coordinador el 2026-11-09).

## 4. Resultado buscado
- U-1: con la sesión del navegador, un miembro sin `owner`, `sales_leader` ni `deal_desk` no lee, no decide y no crea una sugerencia de precio, ni ve sus decisiones, cambios propuestos o enlaces; el resto de sugerencias y la sincronización funcionan igual.
- U-2: con la sesión del navegador, un miembro solo puede cambiar `read_at` de sus avisos.
- Medición: los CA en PGlite con las migraciones reales. Línea base: sin dato.

## 5. Alcance
**Incluye:**
- U-1 (**aplazada, no se construye en el Sprint 3**): migración de número por fijar, `src/lib/price-suggestions-rls.pg.test.ts` y una línea en `src/lib/AGENTS.md` y `docs/BASE-DE-DATOS.md`.
- U-2: `drizzle/migrations/0082_notifications_read_only.sql`, entrada en `meta/_journal.json`, `src/lib/notifications-grants.pg.test.ts` y una línea en `docs/BASE-DE-DATOS.md`.
- El guion de vuelta atrás comentado al final de la migración.

**No incluye** (el brief lo copia a «Movimientos prohibidos»):
- U-1 entera en el Sprint 3 (aplazada).
- Aplicar la migración en la base de Lovable: lo hace Fede, o el coordinador con su OK, tras las comprobaciones de §13.
- Cambiar código de la aplicación (`canViewStrategy`, `syncStrategySuggestions`, `proposeChange`, `notification-center.tsx`), salvo que el gate demuestre que hace falta; si hace falta, se para y se vuelve a este SDD.
- Ampliar la regla de precio a otras causas del detector (`review:`, `experiment:`, NK-0045) o a `catalog:unsold`.
- Cambiar `PRICE_ROLES`.
- Tocar las políticas permisivas existentes (`0013`, `0007:99`, `0070`, `0049:24-28`) o reescribir filas.
- Revisar los GRANT por defecto de Supabase en otras tablas (anexo de la 0080).
- Comprobar el error del `upsert` en `strategy-core.ts:144` (mejora aparte; con U-1 ya no falla por esta causa).

## 6. Cambios de comportamiento (delta)
**Añadido (U-1):** funciones `public.is_price_suggestion(text, text)` (inmutable), `public.can_see_prices(uuid)` (estable) y `public.suggestion_is_price(uuid)` (estable, `security definer`); políticas restrictivas «price read» y «price update» en `suggestions`, «price read» en `strategy_changes` y `strategy_links`; disparador `suggestions_price_insert_guard` (`BEFORE INSERT`).
**Añadido (U-2):** `grant update (read_at) on public.notifications to authenticated`.
**Modificado (U-2):** `authenticated` (y `anon`, si lo tuviera) pierde `UPDATE` sobre la tabla entera.
**Eliminado:** nada.

## 7. Historias y criterios de aceptación
### H-1 (U-1, aplazada): Como Owner, quiero que la base impida a un miembro sin rol de precios ver o decidir una sugerencia de precio, para no depender solo de la aplicación.
Prueba de todos: `src/lib/price-suggestions-rls.pg.test.ts` (nuevo, PGlite). Ejecuta los archivos reales `0068`, `0070`, `0073` y la migración de U-1 (número por fijar) sobre una tabla `suggestions` creada como en `strategy-f0.pg.test.ts:57-68` pero con la política «org update» **exacta** de `0013:7-10` (la de ese test no lo es, según el gate anterior); siembra un `ae`, un `sales_leader` y un `deal_desk` en la empresa A, más el `owner` del arnés.
- **CA-1** (lectura) Un `ae` no recibe las filas de precio (`detector = 'strategy_product_price'` y `dedupe_key` que empieza por `strategy_product_price:price:`) aunque estén sin asignar o asignadas a él; sí recibe una de `strategy_product_price` con `catalog:unsold:…` y las de otros detectores. Falla hoy.
- **CA-2** (roles que sí) `owner`, `sales_leader` y `deal_desk` leen las de precio como hoy, sujetos a la asignación de 0013 (un `deal_desk` no ve una de precio asignada a otra persona, igual que hoy con cualquier sugerencia). Guarda.
- **CA-3** (decidir) Un `ae` que llama a `decide_strategy_suggestion` sobre una de precio recibe `NULL`; no cambia el estado ni crea fila en `strategy_decisions`. Un `UPDATE` directo de esa fila afecta 0 filas. Falla hoy.
- **CA-4** (convertir en precio) Un `ae` no puede cambiar `dedupe_key` o `detector` de una sugerencia suya visible para que pase a ser de precio: error de RLS (o el de `suggestions_strategy_guard` si salta antes; la prueba acepta cualquiera de los dos y exige que la fila no cambie). Falla hoy salvo que 0073 ya lo bloquee [el autor lo comprueba al escribir el test].
- **CA-5** (inserción, B-1 e I-1) Un `ae` inserta con `ON CONFLICT (org_id, dedupe_key) DO NOTHING` un lote con una fila de precio nueva, una de precio cuya clave ya existe y una que no es de precio: no hay error, entra solo la que no es de precio y las de precio no cambian ni se duplican. Un `INSERT` simple de una fila de precio por un `ae`, con o sin clave existente, no da error (`23505` ni `42501`) y no inserta (sin oráculo de existencia). Falla hoy en la parte «no inserta».
- **CA-6** (cambios y enlaces, B-2) Un `ae` no ve en `strategy_changes` ni en `strategy_links` las filas cuyo `suggestion_id` es una sugerencia de precio; sí ve las de una `catalog:unsold` con elemento `product_price`, y `INSERT … RETURNING` en `strategy_changes` para esa `catalog:unsold` funciona (el flujo de `proposeChange`). Tampoco ve la fila de `strategy_decisions` de una de precio. Falla hoy en lo de precio.
- **CA-7** (rol revocado) Al pasar el `sales_leader` a `ae` en `org_members`, la siguiente consulta ya no devuelve las de precio. Falla hoy.
- **CA-8** (cliente privilegiado y empresas) `service_role` lee, inserta y decide filas de precio como hoy (el disparador no actúa sin `auth.uid()`); el `owner` de la empresa B no ve las de A. Guarda.
- **CA-9** (equivalencia con el código) Una tabla de casos compartida `src/test/price-suggestion-cases.ts` (detector, clave, roles → visible) da lo mismo con `canViewStrategy` en TS (`src/lib/strategy-suggestions.test.ts`, `describe` nuevo) que con las políticas en PGlite; incluye claves con `_` y `%` en posiciones de comodín (`strategy_product_priceXprice:…`), que deben ser **no** precio en los dos lados (la RLS usa `starts_with`, no `LIKE`).
- **CA-10** (migración) Aplicar la migración de U-1 dos veces no falla y no cambia ninguna fila de `suggestions`, `strategy_changes` ni `strategy_links` (huella `md5(string_agg(...))` antes y después). Y `src/lib/migrations-journal.test.ts` sigue en verde con la entrada nueva.

### H-2 (U-2): Como miembro, puedo marcar mis avisos como leídos y nada más.
Prueba de todos: `src/lib/notifications-grants.pg.test.ts` (nuevo, PGlite). Crea `notifications` con las columnas de 0049 + 0050 + 0078 (`dedupe_key` y su `unique`) y aplica tal cual los `grant` y políticas de `0049:21-28`, como `money-notices.pg.test.ts:41-53` (que hoy no copia «own mark read»), y luego `0082`. Cada CA se ejecuta en **dos variantes**: (a) los permisos del repo (`0049:21`); (b) los permisos por defecto de Supabase, con `grant all on public.notifications to anon, authenticated` y un permiso de columna extra antes de U-2 (como la sonda del gate, `probe-u2-column-grant.mjs`), para probar la configuración viva y no solo la del repo.
- **CA-11** Un miembro con su sesión actualiza `read_at` de su aviso (como `notification-center.tsx:139-142`, con `.in("id", ids)`): 1 fila cambiada. Guarda.
- **CA-12** Ese miembro no puede actualizar `dedupe_key`, `title`, `body`, `link`, `kind`, `job_id`, `org_id`, `user_id`, `telegram_sent_at` ni `created_at` de su aviso: `permission denied` (42501) y la fila sigue igual. Un `update` que mezcla `read_at` y otra columna también falla entero. Falla hoy.
- **CA-13** No puede insertar ni borrar avisos (como hoy: sin políticas de inserción ni borrado); `anon` no puede actualizar nada. Guarda.
- **CA-14** `service_role` sigue actualizando `telegram_sent_at` e insertando; `money_notify` y `notify_job_end` (security definer) siguen insertando. Guarda (la prueba ejecuta `0078`/`0079` como `money-notices.pg.test.ts`, o al menos un `insert` como `service_role`).
- **CA-15** Aplicar `0082` dos veces no falla; ninguna fila cambia; `src/lib/migrations-journal.test.ts` en verde.

## 8. Casos límite y errores
- **U-1, `deal_desk` y asignación:** `deal_desk` no es líder en 0013, así que solo ve las sin asignar o suyas. Es lo que hace hoy el código (`canActOnSuggestion` + `canViewStrategy`); no se amplía.
- **U-1, la sincronización de un `ae`:** su lote pierde en silencio las filas de precio (CA-5). Hoy esas filas ya las crea el detector; con U-1 las crea la siguiente sincronización de un rol con permiso o del cron (`service_role`). Sin efecto visible para el `ae`.
- **U-1, conteo «Detecté N asuntos» de Inicio:** sale del navegador y dejará de contar las de precio para un `ae`; el del correo diario no cambia (cliente admin, filtra por código). Aceptado: el número de cada persona refleja lo que puede ver.
- **U-1, Realtime:** el repo no publica `suggestions` en `supabase_realtime` [Por verificar en la base viva]; si lo estuviera, Realtime aplica la RLS de lectura.
- **U-1, `LIKE` con `_`:** se usa `starts_with(dedupe_key, 'strategy_product_price:price:')`, igual que `startsWith` en TS (CA-9).
- **U-2, la pantalla:** `markRead` (`notification-center.tsx:137-143`) no comprueba el error; si la base viva tuviera otra política o GRANT, fallaría en silencio. Lo cubre la comprobación previa de §13.
- **U-2, `org_id` del aviso:** hoy se puede mover un aviso propio a otra empresa (la `with check` no mira `org_id`); con U-2 deja de poderse por la columna. **Estado de la afirmación:** el autor de NK-0070 indica que no se reprodujo y que el RLS existente ya la bloqueaba. Releer `0049:26-28` no lo confirma: la `with check` solo exige `user_id = auth.uid()`, y no encontramos en la evidencia de NK-0070 ni en `sprint3-gate` el registro de esa reproducción. Queda **sin verificar**; no se afirma que el RLS existente la bloqueara. `0082` (permiso por columna, solo `read_at`) la corta igualmente, sin probar que fuera explotable antes.
- **Otra empresa:** la migración de U-2 (y la de U-1 cuando se desbloquee) mantiene el filtro por `org_id`/`current_org()` de las políticas existentes; CA-8 lo fija para U-1.

## 9. Experiencia y copy
Sin textos nuevos. Para quien no tiene el rol, una sugerencia de precio sigue sin existir en pantalla. Los avisos se marcan como leídos igual que hoy.

## 10. Datos, permisos y privacidad
**U-1, SQL propuesto (aplazado; ver §17 «pendiente para cuando se desbloquee», que lista lo que falta en este SQL):**
```sql
create or replace function public.is_price_suggestion(_detector text, _dedupe_key text)
returns boolean language sql immutable set search_path = public as $$
  select _detector = 'strategy_product_price' and starts_with(coalesce(_dedupe_key, ''), 'strategy_product_price:price:')
$$;
create or replace function public.can_see_prices(_org uuid)
returns boolean language sql stable set search_path = public as $$
  select public.has_org_role(_org, 'owner') or public.has_org_role(_org, 'sales_leader') or public.has_org_role(_org, 'deal_desk')
$$;
-- reads the origin suggestion without the caller's RLS (otherwise a hidden suggestion would look «not price»)
create or replace function public.suggestion_is_price(_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select public.is_price_suggestion(detector, dedupe_key) from public.suggestions where id = _id), false)
$$;
-- revoke from public, anon; grant execute to authenticated, service_role (the three)

create policy "price read" on public.suggestions as restrictive for select to authenticated
  using (not public.is_price_suggestion(detector, dedupe_key) or public.can_see_prices(org_id));
create policy "price update" on public.suggestions as restrictive for update to authenticated
  using (not public.is_price_suggestion(detector, dedupe_key) or public.can_see_prices(org_id))
  with check (not public.is_price_suggestion(detector, dedupe_key) or public.can_see_prices(org_id));
create policy "price read" on public.strategy_changes as restrictive for select to authenticated
  using (not public.suggestion_is_price(suggestion_id) or public.can_see_prices(org_id));
create policy "price read" on public.strategy_links  as restrictive for select to authenticated
  using (not public.suggestion_is_price(suggestion_id) or public.can_see_prices(org_id));

-- B-1 / I-1: a member without a price role never creates a price row; the row is dropped silently so the batch survives
create or replace function public.suggestions_price_insert_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null and public.is_price_suggestion(new.detector, new.dedupe_key)
     and not public.can_see_prices(new.org_id) then
    return null;
  end if;
  return new;
end $$;
create trigger suggestions_price_insert_guard before insert on public.suggestions
  for each row execute function public.suggestions_price_insert_guard();
```
- Los `drop policy if exists` / `drop trigger if exists` previos hacen la migración repetible (CA-10).
- Restrictivas y no reescribir 0013: no dependen de que la base viva tenga exactamente las permisivas del repo y no tocan lo que funciona (mismo criterio que `0081`, `SDD-20261109-rules-write-permissions.md` §13).
- `has_org_role` acepta `deal_desk` (`0070` ya lo usa en `strategy_changes`) [el test lo confirma].
- El disparador se llama `suggestions_price_insert_guard`, que en orden alfabético va antes de `suggestions_strategy_guard` (0073): si devuelve `NULL`, el otro no corre. Sin `security definer`: corre como quien inserta y solo lee `org_members` por `has_org_role`.

**U-2, SQL propuesto (`0082_notifications_read_only.sql`, sin `begin`/`commit` propios, como el resto de migraciones del repo):**
```sql
revoke update on public.notifications from authenticated, anon;
grant update (read_at) on public.notifications to authenticated;
```
El `revoke update` de tabla quita también cualquier permiso `UPDATE` por columna que hubiera (comprobado por el gate en PGlite).
La política «own mark read» no cambia; con el permiso por columna basta (un `UPDATE` que nombra otra columna falla con 42501 antes de mirar la política).

**Vuelta atrás (comentada al final de cada archivo):**
- U-1 (aplazada): `drop trigger if exists suggestions_price_insert_guard on public.suggestions; drop function if exists public.suggestions_price_insert_guard(); drop policy if exists "price read" on public.suggestions; drop policy if exists "price update" on public.suggestions; drop policy if exists "price read" on public.strategy_changes; drop policy if exists "price read" on public.strategy_links; drop function if exists public.suggestion_is_price(uuid); drop function if exists public.can_see_prices(uuid); drop function if exists public.is_price_suggestion(text, text);`. Deja la base como en `0081`; no hay datos que restaurar.
- `0082` (U-2): la vuelta atrás reaplica **exactamente lo que anotó la comprobación previa 3** para `authenticated` y `anon` (permisos de tabla y de columna), no el `0049:21` del repo. El guion comentado lo dice y deja como ejemplo el caso del repo: `revoke update (read_at) on public.notifications from authenticated; grant update on public.notifications to authenticated;`, más los `grant` que la comprobación 3 haya mostrado (por ejemplo `grant update on public.notifications to anon;` si `anon` lo tenía).

**Privacidad:** pruebas con empresas, personas y textos ficticios del arnés; nada de clientes.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| ninguna | — | — | — |

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 (**Aplazada**) | Migración de precio (número por fijar al desbloquear), tabla de casos `src/test/price-suggestion-cases.ts`, `describe` en `strategy-suggestions.test.ts`, línea en `src/lib/AGENTS.md` y `docs/BASE-DE-DATOS.md` | CA-1 a CA-10 | `src/lib/price-suggestions-rls.pg.test.ts` (sin la migración, un `ae` lee una de precio: CA-1 falla) |
| U-2 | `0082_notifications_read_only.sql` (+ journal, `when` mayor que 1794225600000), línea en `docs/BASE-DE-DATOS.md` | CA-11 a CA-15 (dos variantes de permisos) | `src/lib/notifications-grants.pg.test.ts` (sin la migración, un miembro cambia `dedupe_key`: CA-12 falla) |

En el Sprint 3 solo se construye U-2. U-1 no tiene brief hasta que Fede la desbloquee; entonces tomará el siguiente número libre.

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- **Numeración:** `main` termina en `0081_knowledge_binding_writers` (`idx` 80, `when` 1794225600000). En el Sprint 3: `0082` = U-2 (`0082_notifications_read_only.sql`, `when` 1794312000000) y `0083` = deals (`SDD-20261109-deals-no-source.md`, `when` mayor que el de U-2). U-1 no reserva número: cuando se desbloquee toma el siguiente libre, para que el journal no quede en orden 0083 → 0084 → 0082 (`src/lib/AGENTS.md:58`). Números y `when` se re-sellan al integrar; lo comprueba `src/lib/migrations-journal.test.ts`.
- **Aplicación:** el archivo no abre transacción propia; se aplica a mano en el editor SQL (lo hace Fede) o con el agente de Lovable.
- **Comprobación previa en la base viva (la ejecuta Fede, solo lectura, antes de aplicar; como la de la 0081). Para U-2 bastan la 3 y la 1 (fila de `notifications`); el resto queda para U-1:**
  1. `select polname, polpermissive, polcmd, pg_get_expr(polqual, polrelid), pg_get_expr(polwithcheck, polrelid) from pg_policy where polrelid in ('public.suggestions'::regclass, 'public.strategy_changes'::regclass, 'public.strategy_links'::regclass, 'public.notifications'::regclass);` → deben salir las de `0013`, `0007:99`, `0070` y `0049`, sin políticas «price …» ni otras.
  2. `select tgname from pg_trigger where tgrelid = 'public.suggestions'::regclass and not tgisinternal;` → no existe `suggestions_price_insert_guard`.
  3. `select grantee, privilege_type from information_schema.role_table_grants where table_name = 'notifications';` y `select grantee, column_name, privilege_type from information_schema.column_privileges where table_name = 'notifications' and privilege_type = 'UPDATE';` → anotar qué tiene `authenticated` y `anon` hoy.
  4. `select count(*) from suggestions where detector = 'strategy_product_price' and starts_with(dedupe_key, 'strategy_product_price:price:');` (solo el recuento).
  5. `select exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'suggestions');`
  6. `select proname from pg_proc where proname in ('is_price_suggestion','can_see_prices','suggestion_is_price');` → vacío.
- **Comprobación posterior (U-2):** repetir la 3 y la parte de `notifications` de la 1; dentro de una transacción que se descarta (`begin; set local role authenticated; select set_config('request.jwt.claim.sub', '<uuid de un usuario de prueba>', true); … rollback;`), comprobar que `update notifications set read_at = now()` sobre un aviso suyo funciona y que `update notifications set title = 'x'` falla, como en la 0073. El resto (2, 4, 5, 6 y la prueba de una sugerencia de precio) queda para cuando se desbloquee U-1.
- **Arnés:** `src/test/pg-harness.ts` no trae `deal_desk` ni `sales_leader` en `seed`; se añaden en el test (como `plays.pg.test.ts:27-29`). `strategy_changes`/`strategy_links` salen del archivo real `0070`.
- **Alternativa descartada (U-1):** cambio de código en `syncStrategySuggestions` para no enviar filas de precio sin rol (opción (a) del gate anterior). Deja la base abierta a quien inserte por la API; el disparador cubre las dos.
- **Alternativa descartada (U-2):** disparador `BEFORE UPDATE` que rechace cambios fuera de `read_at`. Más código; el permiso por columna es estándar en PostgreSQL y en PostgREST.

## 14. Riesgos y dependencias
- **El disparador descarta filas sin error:** un fallo del predicado podría descartar sugerencias que no son de precio. Lo cubren CA-5 (la fila que no es de precio entra) y CA-9 (equivalencia con TS).
- **`suggestion_is_price` es `security definer`:** solo devuelve un booleano sobre un id; quien llama ya ve el `suggestion_id` en la fila. Revela «esta id es de precio» solo a quien puede leer la fila de `strategy_changes`, que es justo lo que la política oculta.
- **Rendimiento:** `suggestion_is_price` se evalúa por fila de `strategy_changes`/`strategy_links` (tablas pequeñas; sin dato de tamaño real). `suggestions.id` es clave primaria.
- **U-2 y la base viva:** el `revoke` de tabla también quita los permisos de columna previos (comprobado por el gate en PGlite); la comprobación 3 sirve para anotar el punto de partida, que es lo que restaura la vuelta atrás.
- **Aplicación:** las migraciones no se aplican solas (`docs/BASE-DE-DATOS.md`); se entregan sin aplicar y la entrega dice si lo están.

## 15. Preguntas para Fede y para la revisión técnica
**Decisiones tomadas (autor):**
- **D-1.** La RLS copia exactamente `needsPriceAccess` y `PRICE_ROLES` (detector + prefijo `strategy_product_price:price:`; `owner`, `sales_leader`, `deal_desk`), sin ampliar a otras causas (NK-0045).
- **D-2.** B-1 se resuelve con un disparador que descarta la fila en silencio (opción (b) del gate anterior), no con cambio de código.
- **D-3.** B-2: `strategy_changes` y `strategy_links` se ocultan por la sugerencia de origen (`suggestion_is_price`), nunca por `element`.
- **D-4.** NK-0070 con permiso por columna, no con disparador.

**Decisión del coordinador (delegación de Fede, 2026-11-09):** NK-0044 (U-1) queda fuera del Sprint 3; sigue aplazada «hasta decidir el destino de la base», como decidió Fede el 2026-11-01. Solo U-2 entra. Las migraciones se escriben en el repo, pero solo Fede las aplica.

**Para Fede:**
1. ¿Aplicas tú `0082` (U-2) en la base viva tras el gate, con la comprobación previa 3 de §13 y su vuelta atrás? Recomiendo sí.

**Para la revisión técnica:**
3. Confirmar en PGlite que un `BEFORE INSERT` que devuelve `NULL` evita el `42501` de `ON CONFLICT` con la política restrictiva de lectura (lo vio la sonda del gate anterior, no una prueba del repo).
4. Confirmar que `supabase-js` `upsert(..., { ignoreDuplicates: true })` genera `ON CONFLICT DO NOTHING` sin `RETURNING` (si añadiera `RETURNING`, la fila descartada no afecta: no hay fila).

## 16. Pendiente de verificar
- [Por verificar] Políticas, disparadores y GRANT vivos de `suggestions`, `strategy_changes`, `strategy_links` y `notifications` (§13, comprobación previa; lo ejecuta Fede).
- [Por verificar] Publicación Realtime de `suggestions` en la base viva.
- [Por verificar] Número actual de sugerencias de precio (el 0 del 2026-11-01 no se ha vuelto a medir).
- [Por verificar] Que PostgreSQL de Supabase se comporta como PGlite 18.6 con restrictivas + `ON CONFLICT` + disparador `BEFORE INSERT` (versión viva: sin dato).

**Lo que NO se afirma:**
- No se afirma que la base viva tenga hoy exactamente las políticas del repo.
- No se protege el detector de precio de otras causas (`review:`, `experiment:`), ni la memoria del agente (NK-0042 ya no guarda las de precio).
- U-2 no impide que un miembro marque como leído un aviso suyo sin abrirlo, ni cambia quién recibe avisos.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Un agente `nokko-gate` con contexto fresco lee este SDD y el código, y devuelve su informe. El coordinador lo copia aquí sin editarlo. El gate no aprueba el SDD: informa; la aprobación es de Fede.
- Veredicto del gate (pasada 1, 2026-11-09, `.factory/evidence/sprint3-sdd-gate/gate-pass1.md`): CAMBIOS (0 bloqueantes, 1 mayor, 4 menores). **El gate solo revisó U-2**; U-1 está fuera del Sprint 3 y solo se anotó lo que bloquearía su gate.

### §17 Gate · pasada 1: hallazgos y resolución (U-2)
| Hallazgo | Resolución |
|---|---|
| **MAYOR R-M1** El SDD no refleja que U-1 está aplazada y numera como si entrara | Estado «U-1 Aplazada / U-2 Borrador»; quitado «Sustituye a» (ahora «Relación con»); P-1 cerrada con la decisión; U-2 = `0082_notifications_read_only.sql` (`when` > 1794225600000), deals = `0083`; U-1 tomará el siguiente número libre; esta sección dice que el gate solo cubrió U-2. |
| **MENOR R-m1** Afirmación falsa en §14 sobre permisos por columna | §14 corregido: el `revoke` de tabla también quita los permisos de columna; la comprobación 3 anota el punto de partida. |
| **MENOR R-m2** La vuelta atrás vuelve a `0049:21`, no al estado vivo | §10: la vuelta atrás reaplica exactamente lo anotado en la comprobación 3 para `authenticated` y `anon`, y el guion comentado lo dice. |
| **MENOR R-m3** `begin; … commit;` dentro de la migración | Quitado; §13 dice que el archivo no abre transacción propia y se aplica a mano. |
| **MENOR R-m4** CA-13 y CA-15 en PGlite no reproducen los permisos por defecto de Supabase | H-2: cada CA se ejecuta en dos variantes, la del repo y otra con `grant all ... to anon, authenticated` y un permiso de columna extra antes de U-2. |
| Decisión del coordinador: U-1 fuera del Sprint 3 | Registrada en §15 y en la cabecera. |

### Pendiente para cuando se desbloquee U-1 (notas del gate, no gateadas ahora)
1. El SQL de §10 no incluye los `drop policy if exists` ni el `drop trigger if exists` que el texto promete; `create trigger` sin `drop` hace fallar CA-10 en la segunda pasada.
2. El revoke y grant de las tres funciones nuevas va en un comentario, no en SQL. `suggestion_is_price` es `security definer` y, con los EXECUTE por defecto de Supabase, la podría llamar `anon`: tiene que ser SQL explícito, con su CA.
3. El brief debe fijar la versión viva de `has_org_role` con `deal_desk` (`0070:60` lo usa, pero solo en `strategy_changes`).
4. La pregunta 3 de §15 (PGlite frente a Supabase con disparador `BEFORE INSERT` que devuelve NULL y `ON CONFLICT`) sigue sin probarse en el repo.

### §17 Gate · pasada 2 (2026-11-09, `.factory/evidence/sprint3-sdd-gate/gate-pass2.md`): hallazgos y resolución
- Veredicto: APROBABLE con menores, solo U-2 (0/0/2).

| Hallazgo | Resolución |
|---|---|
| **MENOR R2-m1** Restos de «dos migraciones» (`:3`, `:106`) | Cabecera: «con una migración en el Sprint 3, U-2; U-1, aplazada, llevará la suya»; §8 habla de la migración de U-2 (y la de U-1 cuando se desbloquee). |
| **MENOR R2-m2** La comprobación posterior de §13 mezcla U-1 | Para U-2: repetir la 3 y la parte de `notifications` de la 1, `read_at` funciona y `title` falla; el resto queda para U-1. |

## 18. Delta de implementación (lo rellena el agente al entregar)
U-2 entregada en PR #117 (ccd37fb), integrada en db23383, gate PASS (NK-0070). U-1 sigue **Aplazada**.
**Migración 0082 (`0082_notifications_read_only.sql`): NO aplicada a ninguna base viva.** La aplica Fede tras la comprobación previa 3 (§13).
