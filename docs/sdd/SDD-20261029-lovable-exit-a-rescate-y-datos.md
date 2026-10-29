# SDD-20261029-lovable-exit-a-rescate-y-datos · [Feature] NOKKO deja de depender de Lovable · A: rescate y datos

**Tipo:** Feature · **Prioridad propuesta:** Alta
**Estado:** Borrador · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-10-29
**PRD:** No aplica (heredado del SDD paraguas: migración de infraestructura sin cambio de producto; un PRD solo repetiría el resumen). · **Depende de:** — (no depende de B ni de C; B y C dependen de este). Es lo urgente: la base de datos está en pausa.
**SDD paraguas:** [`SDD-20261029-lovable-exit-migration`](SDD-20261029-lovable-exit-migration.md). La división en tres SDD (A, B y C) la decidió Fede el 2026-10-29; CA, H-n y U-n conservan la numeración del paraguas.

> Un SDD dice cómo se verifica que está bien hecho. Cada criterio de aceptación (CA-n) debe poder tener una prueba automática que lo nombre. Los nombres marcados *(por crear)* son propuestas para el brief.
> Nota de términos: «plataforma de origen» = Lovable (Lovable Cloud y su pasarela de conectores y de IA). Se nombra porque es el objeto del cambio, no como fuente del estado del producto (la fuente es este repo).

## 1. Resumen
NOKKO deja de depender de Lovable para base de datos, login, hosting, tareas programadas, email, conectores e IA. El 2026-10-28 Lovable avisó de que la base de datos está en pausa por falta de créditos de Cloud: nadie puede entrar a nokko.ai y tampoco funcionan los datos, los avisos ni las tareas automáticas (el email de las 8:00 y las búsquedas semanales). La migración deja NOKKO funcionando sobre cuentas y claves de Fede, sin cambio visible para el usuario.

## 2. Problema y para quién
Un fallo de facturación ajeno al producto apaga NOKKO entero. Afecta a todo usuario de NOKKO y a Fede como propietario del negocio.

## 3. Evidencia y por qué ahora
Fuente: mensaje de Lovable del 2026-10-28 (pegado por Fede) y lectura del código de este repo el 2026-10-29. Sin datos de uso.
- Número de usuarios y empresas afectados: **sin dato** (se medirá en la base al reactivarla, U-0).
- Acoplamientos encontrados en el código:
  - Base de datos y login: `supabase/config.toml` (proyecto de Lovable Cloud), `src/integrations/lovable/index.ts` (`@lovable.dev/cloud-auth-js`, autogenerado), `src/integrations/supabase/previewAuthStorage.ts` (solo vista previa de Lovable).
  - Menores: `__LOVABLE_PROJECT_ID` (base del webhook de Apollo), `VITE_LOVABLE_CONNECTOR_LOGO_DEV_API_KEY`, ruta `/.lovable/oauth/consent`, `.lovable/mcp/manifest.json`, `src/routes/mcp.ts` (autogenerado por el plugin), `LOVABLE_DB_MIGRATION_URL` en `drizzle.config.ts`.
- Hay usuarios con contraseña (`auth.tsx` usa `signInWithPassword`), un disparador sobre `auth.users` (`on_auth_user_created`) y publicaciones de tiempo real en `deals`, `lead_events`, `leads`, `research_runs`, `background_jobs` y `notifications`; no hay almacenamiento de archivos ni funciones de borde.
- **[Por verificar]** cuáles de esos secretos solo existen dentro de Lovable Cloud (U-0 los inventaría).

## 4. Resultado buscado
- NOKKO funciona con Lovable desactivado: login, datos, email de las 8:00, búsqueda semanal, conectores, IA y `/mcp`.
- Medición: CA de H-1 a H-5 y CA-26 superados en preproducción; CA-19 a CA-25 en el corte; tras el corte, H-1 a H-4 en nokko.ai. Fuente: informes en `.factory/evidence/` y registros de ejecución del hosting. Línea base de usuarios y empresas: sin dato.

## 5. Alcance
**Incluye:**
- Base de datos y login en un proyecto Supabase propio de Fede, con todos los datos y usuarios actuales.

**Cuentas destino** (las crea Fede a su nombre y carga los secretos él mismo; nada a nombre del agente ni de terceros):

| Destino | Titular |
|---|---|
| Base de datos y login | Proyecto nuevo en la organización de Supabase de Fede |

**No incluye:**
- Cambios de producto, de diseño o de precios.
- Rediseño del esquema de datos ni cambiar migraciones ya aplicadas.
- Apagar o borrar el proyecto de Lovable (se conserva en solo lectura una semana tras el corte; nada se borra sin OK de Fede).

## 6. Cambios de comportamiento (delta)
**Añadido:** nada visible para el usuario.
**Modificado (antes → después):**
- Datos y login: Lovable Cloud → proyecto propio.

## 7. Historias y criterios de aceptación

### H-2: Como Fede, quiero que ningún dato se pierda en la migración.
- **CA-5** El sistema DEBE contener, tras el cambio, el mismo número de registros por conjunto de datos que el origen en el momento del volcado y una suma de verificación de contenido que coincida · prueba: `scripts/migration/verify-data.mjs` *(por crear)*
- **CA-6** El sistema DEBE conservar las relaciones, el aislamiento por empresa y los permisos por rol de cada conjunto de datos (con dos empresas ficticias, una no ve los datos de la otra) · prueba: `src/lib/rls-isolation.test.ts` *(por crear)*
- **CA-7** El sistema DEBE conservar una copia completa e intacta del volcado original hasta que Fede autorice borrarla · prueba: `scripts/migration/verify-data.mjs` (hash del volcado)
- **CA-27** El sistema DEBE descifrar tras el cambio los tokens cifrados de integraciones de cada usuario (se conserva `INTEGRATION_KEYS_SECRET` sin cambios) · prueba: `src/lib/secret-box.test.ts` *(por crear o ampliar, con valores ficticios)*

## 8. Casos límite y errores
- La base de Lovable sigue pausada al empezar → parada hasta que Fede recargue créditos (U-0, CA-23).
- Tareas programadas duplicadas durante el solape entre sistema viejo y nuevo → la reserva por día del email diario (`job_locks`) debe sobrevivir al volcado (CA-8).
- Secretos que solo existen en Lovable Cloud → inventario en U-0; si falta alguno, Fede lo regenera con el proveedor (CA-16 cubre el síntoma).

## 9. Experiencia y copy
Sin cambios visibles.

## 10. Datos, permisos y privacidad
- Se mueve toda la base, incluidos datos de clientes de NOKKO, usuarios y contraseñas cifradas. Volcado e informes se guardan cifrados fuera del repositorio; ningún dato de clientes en código, pruebas, fixtures, logs ni evidencias (las pruebas usan empresas ficticias).
- Sin tablas ni columnas nuevas. Se conserva `INTEGRATION_KEYS_SECRET` sin cambios (cifra los tokens de integraciones; rotarlo los inutiliza). Se conservan `org_id` con `current_org()`, las políticas RLS, los GRANTs y los roles por empresa tal como están.
- Secretos: nunca en `.env`, ni en variables `VITE_`, ni en el repo, el chat o este SDD. Propuesta (Fede confirma): Fede los carga directamente como variables de entorno en el hosting y en el proyecto de datos nuevos; el agente nunca los imprime ni los guarda en archivos.
- Solo API oficial de LinkedIn; esta migración no cambia ningún acceso a LinkedIn.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| Ninguna en este SDD hijo. Las llamadas existentes cambian de camino en U-3 (SDD B) | — | — | — |

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-0 | Rescate e inventario (bloqueante). Fede recarga créditos una sola vez; reactivar, volcar `public` y `auth`, inventariar secretos, tablas, archivos y funciones, congelar la lista de herramientas MCP, medir usuarios, empresas y usuarios con contraseña. **Parada:** si la base no se reactiva, el agente se detiene; plan B = pedir el volcado a soporte de Lovable. Fede valida el informe (incluido CA-5) antes de seguir y antes de tocar el origen | CA-7, CA-27 | N/A (operativa): evidencia en `.factory/evidence/` |
| U-1 | Proyecto de datos propio: restaurar el volcado y aplicar `drizzle/migrations` | CA-5, CA-6 | `scripts/migration/verify-data.mjs` contra destino vacío |

CA-27 se añade aquí a U-0: en el SDD paraguas no lo cerraba ninguna unidad y la sección 15, punto 5, lo asigna a U-0.

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- Destino acordado por Fede: proyecto Supabase propio. El hosting (Vercel o mantener Cloudflare) se decide tras U-0 (decidido el 2026-10-29).
- Volcado: cifrado, fuera del repo, en el lugar y con la clave que Fede indique. *[Propuesta — Fede confirma]*
- `drizzle.config.ts` usa `LOVABLE_DB_MIGRATION_URL`: pasa a la URL del proyecto nuevo.
- Mantener la regla de `AGENTS.md`: sin `as any` y errores por `errorText()`.

## 14. Riesgos y dependencias
- Depende de que Fede recargue créditos una vez y de que la base se reactive. Coste de los créditos: sin dato.
- Los hashes de contraseña y las identidades de Google deben restaurarse en el esquema de autenticación; si no encajan, los usuarios tendrían que restablecer la contraseña (impacto a medir en U-0).
- Hay otros worktrees de NOKKO con cambios sin integrar; esta migración parte de la base que indique Fede.
- La revisión técnica recomienda dividir al menos U-0 y U-1 (urgentes e independientes) y U-5 (`/mcp`, la más pesada). Decisión de Fede: de momento, un solo SDD; se revisa tras la aprobación.
- `src/lib/AGENTS.md` marca las migraciones 0058 y 0059 como no verificadas y no aplicadas: Fede decide si el destino las incluye (pregunta 7).

## 15. Preguntas para Fede y para la revisión técnica
**Decididas por Fede el 2026-10-29:**
1. Programador de tareas: Vercel Cron, con secreto propio. **Condicionado al runtime:** Vercel Cron solo funciona si el hosting es Vercel; si tras U-0 se mantiene Cloudflare, el programador será el de Cloudflare, y se confirma entonces. Depende del plan de Vercel **[Por verificar en U-0]**.
2. Volcado: disco cifrado y una segunda copia cifrada en un almacenamiento de Fede; la clave la guarda Fede y nunca va al repo.
3. Secretos: los carga Fede como variables de entorno del hosting y del proyecto de datos; el agente nunca los ve ni los toca.
4. Cuenta de Vercel: la cuenta personal de Fede (no el equipo Postin, que es otro producto). La primera mitad de la pregunta, runtime (hoy Worker de Cloudflare; pasar a Vercel cambia el contrato de ejecución), se decide tras U-0, cuando el inventario mida el coste real de cada opción.
5. `INTEGRATION_KEYS_SECRET`: se conserva sin cambios; en U-0 se comprueba (CA-27) que los tokens descifran. Si Fede no pudiera recuperar el valor, habría que reconectar las integraciones de cada usuario.

7. Migraciones 0058 y 0059: se restaura el volcado tal cual está en producción y se aplican en el destino **después**, solo tras su verificación y los SDD de NK-0022 y escritores; no durante la migración.
8. Dividir el SDD en tres: decidido por Fede el 2026-10-29. Este es el SDD A. Los tres son: SDD A (`SDD-20261029-lovable-exit-a-rescate-y-datos.md`: U-0 y U-1, rescate y datos, lo urgente), SDD B (`SDD-20261029-lovable-exit-b-servicios-y-corte.md`: U-2 a U-4, U-6 y U-7) y SDD C (`SDD-20261029-lovable-exit-c-mcp.md`: U-5, `/mcp`). El SDD paraguas (`SDD-20261029-lovable-exit-migration.md`) queda como registro del conjunto.

**Siguen abiertas:** ninguna propia de este hijo. El runtime (Cloudflare o Vercel) sigue abierto en el SDD B y se decide tras U-0.

## 16. Pendiente de verificar
1. Estado y contenido de la base tras reactivarla (usuarios, empresas, tamaño): sin dato. Lo comprueba U-0 con la base reactivada.
2. Inventario de secretos que solo existen en Lovable Cloud. U-0.
3. Cuántos usuarios usan contraseña (el código lo permite; CA-2 aplica). U-0.
4. El disparador sobre `auth.users` y las publicaciones de tiempo real están en `drizzle/migrations`, pero un volcado de solo `public` y `auth` no los recrea: U-1 debe aplicarlos. No hay almacenamiento de archivos ni funciones de borde (revisión técnica).
7. Si Lovable Cloud permite acceso directo a la base y a `auth` para el volcado, y cómo dejar el origen en solo lectura en el corte (alternativa: cerrar el acceso de usuarios). U-0 y soporte de Lovable.
9. Coste mensual del nuevo hosting y de la base: sin dato.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Un agente `nokko-gate` con contexto fresco lee este SDD y el código, y devuelve su informe. El coordinador lo copia aquí sin editarlo. El gate no aprueba el SDD: informa; la aprobación es de Fede.
- Veredicto del gate: No revisado
- CA sin prueba posible o sin G-n: pendiente
- [Por verificar] que sigue sin comprobarse: pendiente
- Contradicciones con el código o con decisiones previas: pendiente
- Lo que esta revisión NO demuestra: pendiente

Los informes del gate del SDD paraguas (2026-10-28 y 2026-10-29, `annex/gate-lovable-exit-20261029.md` y la sección 17 del padre) revisaron el conjunto y sus objeciones siguen vigentes hasta que un gate nuevo revise este hijo.

### Objeciones del gate del paraguas que le afectan
Copiadas sin editar del SDD paraguas y de su anexo; los números de línea («SDD:149», «13:159»…) se refieren al SDD paraguas.

**Primer informe, resumen (anexo y sección 17 del paraguas):**
- [Por verificar] que sigue sin comprobarse: el contenido y el volumen de la base, los hashes de contraseña y las identidades de Google; cuáles secretos solo existen en Lovable; las claves de los proveedores; el TTL del DNS; el acceso directo a `auth` y el modo solo lectura del origen; los costes. Las secciones 11 y 16.6 (Jev) pueden resolverse con código, ver Detalle.
- Contradicciones con el código o con decisiones previas: (1) no hay webhook de Stripe. (2) El runtime hoy es Cloudflare Worker, no hay Vercel. (3) La sección 3 omite acoplamientos. (4) `/mcp` no puede ser «propia» sin reescribir las herramientas. (5) El orden con los SDD de conexiones y Drive está sin resolver.
- Lo que esta revisión NO demuestra: nada del comportamiento en el proveedor real, ni de los datos ni de producción; no se ejecutó ningún test; no se comprobó qué hay dentro del proyecto de Lovable ni en Cloudflare.

**Primer informe, Detalle (anexo):**

6. **Tests citados.** Existen: `daily-email.test.ts`, `apollo.test.ts`, `ai-fallback.test.ts`, `errors.test.ts`. No existen, y están marcados «por crear»: `cron-auth.test.ts`, `email.server.test.ts`, `rls-isolation.test.ts`, `mcp-tools.test.ts`, `mcp-auth.test.ts`. Esto es coherente. CA-6 exige dos empresas ficticias con RLS real: ese test necesita una base real y no es una prueba unitaria. CA-17 («mismas herramientas») sí es probable contra la lista congelada de `.lovable/mcp/manifest.json` (142 KB).
7. **Contradicciones con AGENTS.md y con otros SDD.**
   - Las migraciones 0058 y 0059 figuran como «NOT VERIFIED, no aplicadas» (`src/lib/AGENTS.md`). Antes de restaurar, hay que decidir si el destino las incluye.
8. **[Por verificar] que sí puedes cerrar con código.**
   - Triggers y realtime: hay `on_auth_user_created` en `auth.users` (`0000_migration.sql:47`) y publicaciones realtime en `deals`, `lead_events`, `leads`, `research_runs`, `background_jobs` y `notifications` (migraciones 0010, 0012, 0026, 0037, 0038, 0049). Si el volcado es solo `public` y `auth`, ese trigger sobre `auth.users` y las publicaciones deben recrearse. El SDD dice «fuera de `drizzle/migrations`» pero ya están dentro.
   - Storage y funciones edge: no hay `supabase.storage` ni `functions.invoke` en `src` ni carpeta `supabase/functions`; solo `config.toml`.
   - Vault: aparece solo comentado en `0027_stripe.sql`.
   - Contraseñas: `auth.tsx:81,89` usa `signUp` y `signInWithPassword`, así que sí hay usuarios con contraseña; el CA-2 es obligatorio salvo que U-0 lo mida de otra forma.
9. **Acciones irreversibles sin parada clara.** CA-23 las cubre bien en general. Faltan estos casos: reapuntar Telegram con `setWebhook` (solo admite una dirección; el SDD lo cita en la sección 8 pero no como parada); que el correo diario real salga antes del corte por el solape; y rotar `INTEGRATION_KEYS_SECRET` (pregunta 5 abierta, pero decisiva: sin esa clave se pierden los tokens cifrados, ver `secret-box.server.ts`). La restauración en preproducción puede mandar webhooks o emails reales si CA-26 se implementa tarde; debería ser lo primero que se compruebe.
10. **División.** Sí conviene dividir, por independencia comprobada en el código:
    - (a) U-0 y U-1 (rescate y datos) no dependen del resto, y la base está en pausa, así que es lo urgente.
    - (b) U-2 (login), U-3 (email, cron e IA) y U-4 (conectores) son independientes entre sí.
    - (c) U-4 colisiona con los SDD de Drive y de conexiones.
    - (d) U-5 (`/mcp`) es la más pesada y no bloquea el login ni los datos; sale bien como SDD aparte.
    - (e) U-6 y U-7 (hosting y corte) son un tercer bloque, con el cambio de runtime a Vercel como riesgo propio.

    La decisión de «un solo SDD» está en la sección 14; recomiendo al menos separar (a) y (d).

**Segunda pasada del gate (2026-10-29, sección 17 del paraguas):**

**Acoplamientos con Lovable que faltan o están mal descritos:**
- Las claves de Stripe de cada empresa se guardan en el Vault de Supabase (`stripe/sync.server.ts:76` con `stripe_key_for`, `stripe.functions.ts:28`, `field-baseline.ts:80` con `vault_secret_id`). El SDD dice que son «claves directas» y que basta con verificarlas (SDD:25, :46). El SDD de conexiones (línea 118) dice que están en Vault. Ningún CA comprueba que esas claves sigan funcionando después de restaurar.

**CA sin prueba posible o con hueco:**
- CA-27 no lo cierra ninguna unidad (SDD:149-156), aunque 15.5 lo asigna a U-0. `secret-box.test.ts` no existe.
- `scripts/migration/`, cron-auth, email, rls-isolation y los tests de MCP no existen. CA-2 no lleva la marca «por crear».

**Riesgos de seguridad, datos y corte:**
- U-1 propone «restaurar y aplicar `drizzle/migrations`», pero 0018–0029 y 0054 están completamente comentadas (`0027_stripe.sql:1` dice «already in the database»). En una base vacía faltarían objetos; encima de un volcado restaurado, chocarían (`0000_migration.sql:47`).

**Contradicciones con el código o con decisiones previas:**
- 13:159 da Vercel por acordado, cuando el runtime sigue abierto (15:182).
- U-1 aplica 0058 y 0059 (están en `_journal.json`), lo que contradice la pregunta 7, que sigue abierta. El código ya lee `org_connections` (`connections-panel.tsx:21`), aunque `src/lib/AGENTS.md:57` dice que 0059 no está aplicada.

**[Por verificar] que ya se puede comprobar:**
- 16.4: el disparador está en `0000:47` y las publicaciones de tiempo real en `0010:57-58`, `0012:113`, `0037:26`, `0038:26` y `0049:29`.

**Siguen abiertas (no las resuelvo):** runtime Cloudflare o Vercel; si el destino incluye 0058 y 0059; si se divide el SDD.

**Lo que esta revisión NO demuestra:**
- No ejecuté nada: ni tests, ni Supabase, ni Lovable, ni Cloudflare.
- No comprobé si un Vault restaurado descifra en el proyecto nuevo, ni si `pg_dump` de `auth` conserva hashes, identidades de Google o clientes OAuth.
- No leí el contenido de los secretos.


### Primera pasada del gate sobre este hijo A (2026-10-29), copiada sin editar
Revisión del texto en `ee2b468`; el código se revisó en `d02114b`.

**Veredicto del gate:** Objeciones

**Objeciones previas que afectan a A:**
- Abierta: la que dice que U-1 restaura y aplica `drizzle/migrations`. El texto sigue igual en A:81. Las migraciones 0018, 0022, 0027 y 0029 no tienen ni una línea activa, y 0054 está vacía.
- Abierta: las claves de Stripe guardadas en el Vault. Fuera de la sección 17, A no nombra el Vault y ningún CA lo cubre (`stripe/sync.server.ts:76`).
- Abierta: 0058 y 0059 entran en U-1. Las dos están en `_journal.json`. La pregunta 15.7 lo aclara, pero U-1 (A:81) no se corrigió y A:96 dice que la pregunta sigue abierta.
- Cerrada solo en el papel: CA-27 tiene ya unidad (A:80), pero tiene un hueco (ver abajo).
- Abierta: el punto 16.4. A:115 lo da como pendiente, cuando ya se puede comprobar.
- Cerrada: separar U-0 y U-1. Pero A:95 todavía dice «un solo SDD».

**CA sin prueba posible o con hueco:**
- CA-27: `INTEGRATION_KEYS_SECRET` es una variable del entorno de la app (`secret-box.server.ts:8`), así que depende del hosting, que está en B. U-0 es anterior al cambio. Además, una prueba con valores ficticios ya pasa hoy y no falla primero (`GROUND-RULES.md:9`). Por último, cifra solo la clave de PostHog de cada empresa, no tokens «de cada usuario» (`posthog-sync.server.ts:58`).
- CA-5: A:80 pide validar CA-5 en U-0, cuando todavía no hay destino. No se define cómo se calcula la suma de verificación, ni que los recuentos salgan de la misma instantánea que el volcado. El origen ya reactivado sigue recibiendo escrituras.
- CA-7: «hasta que Fede autorice borrarla» no se puede probar con un test. Tampoco se puede comprobar el hash de la segunda copia, que está cifrada con la clave de Fede.
- CA-6: necesita una base real y ninguna unidad la prepara.

**Riesgos de seguridad, datos y rescate:**
- El volcado de U-0 incluye solo `public` y `auth` (A:80). Deja fuera `vault`, el esquema `drizzle`, las extensiones y las publicaciones. Las claves de Stripe de cada empresa se pierden, o no se pueden descifrar en el proyecto nuevo.
- El plan B (A:80) no dice qué hacer si soporte entrega un volcado parcial, ni cuál es el plazo.
- Las evidencias van a `.factory/evidence/` (A:80), que está ignorada por git pero no cifrada (`.factory/.gitignore`). Choca con A:67.
- `drizzle.config.ts:8` lee la URL de la base, con contraseña, del entorno local. Si el agente aplica las migraciones, ve el secreto, y eso contradice la decisión 3 (A:102).

**Choque con migraciones:**
- A no fija qué migraciones se aplican en el destino. 0000:47 vuelve a crear el disparador y chocaría con el volcado restaurado.
- `drizzle-kit migrate` lleva su registro en el esquema `drizzle`, que no se vuelca, así que intentaría aplicar todo, incluidas 0058 y 0059. Esto último es el comportamiento por defecto de drizzle-kit; no lo ejecuté.
- A:115 dice «U-1 debe aplicarlos» sin indicar el orden.

**Contradicciones con el código o con decisiones previas:**
- A:5 dice que A no depende de B. Pero B:139 exige el modo seguro (CA-26) «antes de restaurar datos», que es justo lo que hace U-1.
- A:95 (un solo SDD) contradice A:107. A:96 contradice A:106.
- A:27-28 describen el resultado del paraguas completo, no el de A.

**Lo que falta en A tras la división:**
- CA-23, la parada antes de recargar créditos, contactar con soporte o cambiar algo en el origen, está solo en B:104, aunque A:59 la cita.
- CA-26 está solo en B:107.
- CA-8 (`job_locks`, A:60) y CA-16 (A:61) están en B.
- Falta un CA o una unidad para el Vault de Stripe.

**[Por verificar] que ya se puede comprobar:**
- 16.4: el disparador está en `0000_migration.sql:47` y las publicaciones en `0010:57-58`, `0012:113`, `0037:26`, `0038:26` y `0049:29`.
- No hay almacenamiento ni funciones de borde: `supabase/` solo contiene `config.toml` y no hay ninguna llamada a `storage` ni a `functions.invoke`.

**Lo que esta revisión NO demuestra:**
- No ejecuté nada contra Supabase, Lovable ni drizzle, ni ningún test.
- No comprobé si `pg_dump` de `auth` conserva los hashes de contraseña ni las identidades de Google.
- No comprobé si un Vault restaurado se puede descifrar.
- No sé qué cron tiene Lovable configurado.
- No leí ningún secreto.
- La rama está en `ee2b468`; el código lo revisé en `d02114b`, que no es antecesor de esa rama.

## 18. Delta de implementación (lo rellena el agente al entregar)
Sin entrega todavía.
