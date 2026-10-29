# SDD-20261029-lovable-exit-a-rescate-y-datos · [Feature] NOKKO deja de depender de Lovable · A: rescate y datos

**Tipo:** Feature · **Prioridad propuesta:** Alta
**Estado:** Borrador · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-10-29
**PRD:** No aplica (heredado del SDD paraguas: migración de infraestructura sin cambio de producto; un PRD solo repetiría el resumen). · **Depende de:** — (no depende de B ni de C para el rescate; B y C dependen de este). A trae de B, con el mismo texto, CA-23 y la parte de datos de CA-26, porque U-0 y U-1 los necesitan antes de tocar nada. Es lo urgente: la base de datos está en pausa.
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
- Tras U-0 y U-1, todos los datos y usuarios de la base de Lovable están en un proyecto Supabase propio de Fede, verificados, sin haber tocado el origen y sin que nada envíe emails ni llame a proveedores desde él; B levanta la aplicación sobre ese proyecto.
- Medición: CA-5, CA-6, CA-7, CA-23, CA-26 (datos), CA-27 y CA-28 superados, con informes en `.factory/evidence/` (solo recuentos y hashes, nunca filas). Login, email, conectores, IA y `/mcp` son de B y C. Línea base de usuarios y empresas: sin dato (U-0).

## 5. Alcance
**Incluye:**
- Base de datos y login en un proyecto Supabase propio de Fede, con todos los datos y usuarios actuales.
- Volcado completo del origen (`public`, `auth`, `vault`, `drizzle`, extensiones, publicaciones, roles y GRANTs), no solo `public` y `auth`.
- Que cada empresa conserve una clave de Stripe utilizable (CA-28).

**Cuentas destino** (las crea Fede a su nombre y carga los secretos él mismo; nada a nombre del agente ni de terceros):

| Destino | Titular |
|---|---|
| Base de datos y login | Proyecto nuevo en la organización de Supabase de Fede |

**No incluye:**
- Cambios de producto, de diseño o de precios.
- Rediseño del esquema de datos ni cambiar migraciones ya aplicadas.
- Apagar o borrar el proyecto de Lovable (se conserva en solo lectura una semana tras el corte; nada se borra sin OK de Fede).
- Aplicar migraciones de `drizzle/migrations` en el destino, tampoco 0058 y 0059 (15.7): el destino parte del volcado tal cual.
- Levantar la aplicación, el hosting, el email o los conectores sobre el destino (SDD B).

## 6. Cambios de comportamiento (delta)
**Añadido:** nada visible para el usuario.
**Modificado (antes → después):**
- Datos y login: Lovable Cloud → proyecto propio.

## 7. Historias y criterios de aceptación

### H-2: Como Fede, quiero que ningún dato se pierda en la migración.
- **CA-5** El sistema DEBE contener, tras restaurar, el mismo número de filas por tabla y el mismo hash de contenido por tabla que el origen **en la misma instantánea del volcado** · prueba: `scripts/migration/verify-data.mjs` *(por crear)*. El hash es el md5 de las filas de la tabla ordenadas por clave primaria (sin clave primaria, por todas las columnas) y el manifiesto se genera en la misma transacción de lectura repetible que el volcado. Las escrituras que el origen reciba después no cuentan para CA-5 (las recoge el corte, SDD B). *[Propuesta — la nueva pasada del gate la valida]*
- **CA-6** El sistema DEBE conservar tras restaurar las relaciones, el aislamiento por empresa y los permisos por rol (políticas RLS, GRANTs y roles; con dos empresas ficticias, una no ve los datos de la otra), y el catálogo del origen: disparador `on_auth_user_created`, publicaciones de tiempo real y extensiones · prueba: `src/lib/rls-isolation.test.ts` *(por crear; necesita una base real de pruebas, sin datos de clientes)* y `scripts/migration/verify-data.mjs --catalog` *(por crear)*, que compara el catálogo de origen y destino
- **CA-7** El sistema DEBE guardar el volcado completo en dos copias cifradas (disco cifrado y almacenamiento de Fede, decisión 2) con un manifiesto del hash del volcado y de cada archivo cifrado, y DEBE detectar que una copia ha cambiado · prueba: `scripts/migration/verify-data.mjs --manifest` *(por crear)*, que recalcula los hashes de los archivos cifrados sin necesitar la clave. Que la copia se descifra lo comprueba Fede con su clave; borrar cualquier copia exige OK de Fede (CA-23).
- **CA-27** El sistema DEBE restaurar sin alterar las columnas cifradas con `INTEGRATION_KEYS_SECRET` (hoy, la clave de PostHog de cada empresa, `posthog-sync.server.ts`), y el inventario de U-0 DEBE registrar si Fede conserva el valor (sí o no, nunca el valor) · prueba: hash por columna cifrada en `scripts/migration/verify-data.mjs`. Que la aplicación descifre con la variable del hosting es de B.
- **CA-28** El sistema DEBE dejar, para cada empresa que tenía clave de Stripe en el origen, una clave utilizable en el destino: `stripe_key_for(org)` devuelve un valor no nulo exactamente para las mismas empresas, sin mostrar ni registrar ningún valor · prueba: `scripts/migration/verify-vault.mjs` *(por crear; la ejecuta Fede porque necesita la URL de la base)*. Restaurar el esquema `vault` puede no bastar: la clave que descifra el Vault es del proyecto de origen **[Por verificar en U-0]**; el método lo decide Fede (A-3).

### Seguridad transversal (texto copiado de B; A los necesita antes de tocar nada)
- **CA-23** CUANDO el siguiente paso sea irreversible, visible para usuarios o implique gasto o secretos (cambiar el DNS; cambiar direcciones de eventos entrantes de terceros, incluido reapuntar Telegram (solo admite una dirección); avisar a usuarios; enviar el primer email real desde el sistema nuevo; escribir en producción; cualquier cambio en el origen o borrado de volcados; recargar créditos o contactar con soporte del origen; rotar secretos; cambiar las direcciones de retorno del login de Google; usar claves en vivo de Stripe), el agente DEBE detenerse y esperar un OK explícito de Fede en el chat. «Producción» = el dominio nokko.ai, el proyecto de datos definitivo tras el corte y las cuentas de proveedores en vivo; restaurar el volcado en el proyecto nuevo antes del corte NO es producción · prueba: revisión del gate sobre el registro de la sesión
- **CA-26 (parte de datos)** MIENTRAS el proyecto de datos nuevo contenga datos restaurados y no haya OK de Fede para usarlo, el sistema DEBE no tener tareas programadas en la base, ni webhooks de base de datos, ni ninguna aplicación ni secreto de proveedor apuntando a él · prueba: `scripts/migration/check-preprod-safe.mjs` *(por crear; se ejecuta antes de restaurar; la parte de aplicación, emails y conectores es de B)*

## 8. Casos límite y errores
- La base de Lovable sigue pausada al empezar → parada hasta que Fede recargue créditos (U-0, CA-23).
- Soporte de Lovable entrega un volcado parcial → el agente no restaura; lista a Fede qué esquemas faltan y espera su decisión (CA-23).
- El origen reactivado sigue recibiendo escrituras durante el volcado → la instantánea única las deja fuera de forma consistente; lo posterior lo recoge el corte (B).
- La restauración choca con objetos ya existentes (p. ej. el disparador de `auth.users`) → no se aplican migraciones; se restaura sobre un proyecto vacío y se recrea solo lo que falte (U-1).
- Tareas programadas duplicadas durante el solape → `job_locks` (reserva por día del email diario) debe llegar en el volcado: entra en CA-5; su uso en el solape es CA-8, en B.
- Secretos que solo existen en Lovable Cloud → inventario en U-0 (nombre y si existe, nunca el valor); si falta alguno, Fede lo regenera con el proveedor; el síntoma en la aplicación es CA-16, en B.

## 9. Experiencia y copy
Sin cambios visibles.

## 10. Datos, permisos y privacidad
- Se mueve toda la base, incluidos datos de clientes de NOKKO, usuarios y contraseñas cifradas. El volcado y cualquier informe con datos reales se guardan cifrados fuera del repositorio. A `.factory/evidence/` (ignorada por git, pero no cifrada) solo van nombres de tabla, recuentos y hashes: nunca filas, emails, nombres ni valores. Ningún dato de clientes en código, pruebas, fixtures ni logs (las pruebas usan empresas ficticias).
- Sin tablas ni columnas nuevas. Se conserva `INTEGRATION_KEYS_SECRET` sin cambios (hoy cifra la clave de PostHog de cada empresa; rotarlo la inutiliza). Se conservan `org_id` con `current_org()`, las políticas RLS, los GRANTs y los roles por empresa tal como están.
- Secretos: nunca en `.env`, ni en variables `VITE_`, ni en el repo, el chat o este SDD. Propuesta (Fede confirma): Fede los carga directamente como variables de entorno en el hosting y en el proyecto de datos nuevo; el agente nunca los imprime ni los guarda en archivos, y los comandos que necesitan la URL de la base con contraseña los ejecuta Fede (decisión 10).
- Solo API oficial de LinkedIn; esta migración no cambia ningún acceso a LinkedIn.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| Ninguna en este SDD hijo. Las llamadas existentes cambian de camino en U-3 (SDD B) | — | — | — |

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-0 | Rescate e inventario (bloqueante). Fede recarga créditos una sola vez (parada, CA-23). Con la base reactivada, el agente prepara y Fede ejecuta: un volcado único y consistente de `public`, `auth`, `vault`, `drizzle`, extensiones, publicaciones, roles y GRANTs; manifiesto de recuentos y hashes (CA-5); dos copias cifradas con sus hashes (CA-7). Inventario sin valores: secretos (nombre y si existe, incluido `INTEGRATION_KEYS_SECRET`, CA-27), tablas, archivos, funciones, estado de 0058 y 0059 en el origen, lista de herramientas MCP congelada, usuarios, empresas y usuarios con contraseña. **Parada:** si la base no se reactiva, el agente se detiene; plan B = pedir a soporte de Lovable el volcado completo, con un solo intento por el chat de Lovable (decisión 9) y sin plazo de espera; si falla o llega parcial, no se restaura y se informa a Fede. Fede valida el informe antes de seguir y antes de tocar el origen | CA-7, CA-23, CA-27 (inventario) | `scripts/migration/verify-data.mjs --manifest` sobre un volcado de prueba (falla primero: el script no existe); el resto es operativo, con evidencia en `.factory/evidence/` |
| U-1 | Proyecto de datos propio: (1) comprobar CA-26 antes de restaurar; (2) restaurar el volcado en un proyecto vacío; (3) recrear lo que falte del catálogo con sentencias puntuales (disparador de `0000_migration.sql:47`, publicaciones de 0010, 0012, 0037, 0038 y 0049), **sin** aplicar migraciones; (4) verificar CA-5, CA-6, CA-27 y CA-28; (5) preparar una base de pruebas desechable con el mismo esquema y dos empresas ficticias para CA-6 | CA-5, CA-6, CA-26, CA-27, CA-28 | `verify-data.mjs` contra destino vacío; `check-preprod-safe.mjs`; `verify-vault.mjs`; `rls-isolation.test.ts` |

Reparto: CA-23 y CA-26 (parte de datos) vienen de B con el mismo texto, porque A los necesita antes de tocar nada; B conserva los suyos para la aplicación. CA-27 de A cubre solo que los datos cifrados llegan intactos; el descifrado en la aplicación es de B.

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- Destino acordado por Fede: proyecto Supabase propio. El hosting (Vercel o mantener Cloudflare) se decide tras U-0 (decidido el 2026-10-29).
- Volcado: una sola transacción de lectura repetible para el volcado y el manifiesto (misma instantánea); cifrado, fuera del repo, en el lugar y con la clave que Fede indique. *[Propuesta — Fede confirma]*
- Migraciones: U-1 **no** aplica `drizzle/migrations`. 0018–0029 y 0054 están comentadas (`0027_stripe.sql:1` dice «already in the database»), así que no construyen una base vacía; encima de un volcado restaurado chocarían (`0000_migration.sql:47`); y el registro de `drizzle-kit` vive en el esquema `drizzle`, de modo que sin él intentaría aplicar todo, incluidas 0058 y 0059 (comportamiento por defecto de drizzle-kit, no ejecutado). Se restaura sobre un proyecto vacío y se recrea solo lo que falte con sentencias puntuales.
- `drizzle.config.ts` usa `LOVABLE_DB_MIGRATION_URL`, que lleva contraseña: pasa a la URL del proyecto nuevo y solo la lee quien ejecuta (Fede, decisión 10); el agente no la ve.
- Mantener la regla de `AGENTS.md`: sin `as any` y errores por `errorText()`.

## 14. Riesgos y dependencias
- Depende de que Fede recargue créditos una vez y de que la base se reactive. Coste de los créditos: sin dato.
- Los hashes de contraseña y las identidades de Google deben restaurarse en el esquema de autenticación; si no encajan, los usuarios tendrían que restablecer la contraseña (impacto a medir en U-0).
- Hay otros worktrees de NOKKO con cambios sin integrar; esta migración parte de la base que indique Fede.
- División decidida (15.8): U-0 y U-1 son este SDD; U-2 a U-4, U-6 y U-7 son B; U-5 es C.
- Migraciones 0058 y 0059: decidido (15.7), no se aplican en la migración; U-0 registra si ya existen en el origen.
- La clave que descifra el Vault es del proyecto de origen **[Por verificar]**: si no hay método para llevar las claves de Stripe al destino (A-3), las empresas con Stripe tendrían que reconectarlo.
- El volcado de A es de rescate. Lo que se escriba en el origen después de la instantánea lo recoge el volcado final del corte (SDD B).

## 15. Preguntas para Fede y para la revisión técnica
**Decididas por Fede el 2026-10-29:**
1. Programador de tareas: Vercel Cron, con secreto propio. **Condicionado al runtime:** Vercel Cron solo funciona si el hosting es Vercel; si tras U-0 se mantiene Cloudflare, el programador será el de Cloudflare, y se confirma entonces. Depende del plan de Vercel **[Por verificar en U-0]**.
2. Volcado: disco cifrado y una segunda copia cifrada en un almacenamiento de Fede; la clave la guarda Fede y nunca va al repo.
3. Secretos: los carga Fede como variables de entorno del hosting y del proyecto de datos; el agente nunca los ve ni los toca.
4. Cuenta de Vercel: la cuenta personal de Fede (no el equipo Postin, que es otro producto). La primera mitad de la pregunta, runtime (hoy Worker de Cloudflare; pasar a Vercel cambia el contrato de ejecución), se decide tras U-0, cuando el inventario mida el coste real de cada opción.
5. `INTEGRATION_KEYS_SECRET`: se conserva sin cambios; en U-0 se comprueba (CA-27) que los tokens descifran *(CA-27 se reformuló tras el gate: A comprueba que los datos cifrados llegan intactos y B que la aplicación los descifra)*. Si Fede no pudiera recuperar el valor, habría que reconectar las integraciones de cada usuario.

7. Migraciones 0058 y 0059: se restaura el volcado tal cual está en producción y se aplican en el destino **después**, solo tras su verificación y los SDD de NK-0022 y escritores; no durante la migración.
8. Dividir el SDD en tres: decidido por Fede el 2026-10-29. Este es el SDD A. Los tres son: SDD A (`SDD-20261029-lovable-exit-a-rescate-y-datos.md`: U-0 y U-1, rescate y datos, lo urgente), SDD B (`SDD-20261029-lovable-exit-b-servicios-y-corte.md`: U-2 a U-4, U-6 y U-7) y SDD C (`SDD-20261029-lovable-exit-c-mcp.md`: U-5, `/mcp`). El SDD paraguas (`SDD-20261029-lovable-exit-migration.md`) queda como registro del conjunto.

9. Plan B (A-1): un solo intento desde el chat de Lovable para obtener el volcado completo, para no gastar créditos; sin plazo de espera. Si falla, decide Fede. El mensaje exacto lo apruebas tú antes de enviarlo (CA-23: contactar con el origen es un paso con gasto).
10. Comandos con la URL de la base (A-2): los ejecuta Fede en su terminal; el agente prepara los scripts y lee solo los informes de `.factory/evidence/`.
11. Vault de Stripe (A-3): el método se decide tras probar en U-0 si un Vault restaurado descifra.

**Siguen abiertas:**
- **A-3.** (Decidido que se resuelve tras U-0.) Método para llevar las claves de Stripe de cada empresa al destino (CA-28): re-crearlas con un script que ejecuta Fede, o que cada empresa reconecte Stripe. Se decide tras comprobar en U-0 si un Vault restaurado descifra.
- El runtime (Cloudflare o Vercel) sigue abierto en el SDD B y se decide tras U-0.

## 16. Pendiente de verificar
1. Estado y contenido de la base tras reactivarla (usuarios, empresas, tamaño): sin dato. Lo comprueba U-0 con la base reactivada.
2. Inventario de secretos que solo existen en Lovable Cloud. U-0.
3. Cuántos usuarios usan contraseña (el código lo permite: `auth.tsx:81,89`; el CA-2 de B cubre el login). U-0.
4. Verificado en el código el 2026-10-29: el disparador `on_auth_user_created` está en `0000_migration.sql:47` y las publicaciones de tiempo real en `0010:57-58`, `0012:113`, `0037:26`, `0038:26` y `0049:29`. Lo que no se sabe es si el volcado los recrea en un proyecto nuevo: U-1 lo comprueba con el catálogo (CA-6) y recrea solo lo que falte. No hay almacenamiento de archivos ni funciones de borde (`supabase/` solo tiene `config.toml`; no hay llamadas a `storage` ni a `functions.invoke`).
7. Si Lovable Cloud permite acceso directo a la base y a `auth` para el volcado, y cómo dejar el origen en solo lectura en el corte (alternativa: cerrar el acceso de usuarios). U-0 y soporte de Lovable.
9. Coste mensual del nuevo hosting y de la base: sin dato.
10. Si el origen tiene el esquema `drizzle` con su registro de migraciones y cuáles de 0058 y 0059 están aplicadas. U-0.
11. Si un Vault restaurado descifra en el proyecto nuevo (la clave del Vault es del proyecto de origen). U-0 y U-1; decide A-3.
12. Si `pg_dump` de `auth` conserva los hashes de contraseña, las identidades de Google y los clientes OAuth. U-1.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Un agente `nokko-gate` con contexto fresco lee este SDD y el código, y devuelve su informe. El coordinador lo copia aquí sin editarlo. El gate no aprueba el SDD: informa; la aprobación es de Fede.
- Veredicto del gate: Objeciones (primera pasada, 2026-10-29, copiada abajo). El texto se corrigió después; falta una segunda pasada.
- CA sin prueba posible o sin G-n: ver el informe copiado abajo
- [Por verificar] que sigue sin comprobarse: ver el informe copiado abajo
- Contradicciones con el código o con decisiones previas: ver el informe copiado abajo
- Lo que esta revisión NO demuestra: ver el informe copiado abajo

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

### Respuesta del autor a la primera pasada (2026-10-29)
Cada objeción del gate sobre A y dónde queda. Es texto del autor, no del gate: la nueva pasada decide si basta.

| Objeción | Dónde queda |
|---|---|
| U-1 restaura y aplica `drizzle/migrations` (0018–0029 y 0054 sin líneas activas; choque con `0000:47`; `drizzle-kit` reaplicaría todo, incluidas 0058 y 0059) | U-1 ya no aplica migraciones; recrea solo lo que falte del catálogo (secciones 12 y 13); 0058 y 0059 quedan fuera (15.7) |
| Vault de Stripe y volcado de solo `public` y `auth` | Volcado completo (secciones 5 y 12); CA-28; método abierto en A-3 |
| `drizzle.config.ts` lee la URL con contraseña; el agente la vería | Los comandos con la URL los ejecuta Fede (secciones 10 y 13); decidido (decisión 10) |
| Evidencias sin cifrar en `.factory/evidence/` | Solo recuentos, hashes y nombres de tabla (sección 10) |
| Plan B sin plazo ni caso parcial | Caso parcial resuelto (sección 8); un solo intento por el chat de Lovable, sin plazo (decisión 9) |
| CA-27 (variable del hosting, no falla primero, solo PostHog) | Reformulado sobre columnas cifradas y alcance real; el descifrado pasa a B (CA-27) |
| CA-5 (sin definir hash ni instantánea; U-0 sin destino) | CA-5 redefinido; se verifica en U-1, no en U-0 |
| CA-7 («hasta que Fede autorice» no es testeable; hash de la 2.ª copia) | CA-7 redefinido con manifiesto de hashes del archivo cifrado; el borrado lo cubre CA-23 |
| CA-6 sin base real | U-1 prepara una base de pruebas desechable con dos empresas ficticias |
| A:5 dice «no depende de B» pero B exige CA-26 antes de restaurar | CA-26 (parte de datos) y CA-23 se traen a A |
| CA-8 y CA-16 en B | Se quedan en B; A solo los cita (sección 8) |
| Contradicciones A:95/96/107/106, A:27-28 | Corregidas (secciones 4 y 14) |
| 16.4 ya comprobable | Verificado y reescrito (sección 16) |

**Pendiente de B, no editado aquí:** añadir en B un CA que compruebe que la aplicación descifra con `INTEGRATION_KEYS_SECRET` (el CA-27 de A solo cubre que los datos cifrados llegan intactos).

## 18. Delta de implementación (lo rellena el agente al entregar)
Sin entrega todavía.
