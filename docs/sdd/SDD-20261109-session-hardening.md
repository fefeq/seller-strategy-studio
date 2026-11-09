# SDD-20261109-session-hardening · [Bug] Un fallo momentáneo al comprobar la sesión no te saca de la app, y todo el código usa el mismo usuario validado

**Tipo:** Bug (sesión; sin migración) · **Prioridad propuesta:** Alta (unidad A: hoy un fallo de red o un 5xx manda a iniciar sesión sin aviso) · Media (unidad B)
**Estado:** Borrador · **Pide:** Fede (Sprint 3, del walkthrough de `d0f4252`) · **Aprueba:** Fede · **Fecha:** 2026-11-09
**Tickets:** unidad A: NK-0112, NK-0113 · unidad B: NK-0110 (+ NK-0114, duplicado enlazado: añade el consentimiento OAuth), NK-0111, NK-0115
**PRD:** No aplica (bug) · **Depende de:** NK-0098 (Sprint 2, en `main`; sin SDD propio, garantías en los tests de §3)

> Nivel elegido: SDD corto. No toca esquema ni RLS, pero cambia una garantía ya entregada y probada en el Sprint 2 (dónde termina un fallo de comprobación, `src/test/auth-no-bounce.test.tsx`) y toca cinco puntos de entrada de sesión: el coordinador pidió SDD.
> Números de línea comprobados en `main` `1fef724`.

## 1. Resumen
**Unidad A.** Hoy la comprobación de sesión responde «sí» o «no»: un fallo de red o un 5xx cuenta como «no» y la app te manda a `/auth` con el formulario de inicio de sesión, sin explicación (NK-0112); y en `/auth` cualquier evento de sesión que no sea el inicial te devuelve a `/home` sin validar, con lo que un 5xx persistente produce un rebote por cada `TOKEN_REFRESHED` o `SIGNED_IN` (NK-0113). La comprobación pasa a tener tres respuestas (válida, sin sesión, sin poder comprobar); con «sin poder comprobar» la app muestra «No he podido comprobar tu sesión» con «Reintentar», sin redirigir ni cerrar la sesión; `/auth` solo te lleva dentro con un usuario validado.
**Unidad B.** Cuatro sitios piden el usuario al servidor por su cuenta (`getUser()`); pasan a usar el validador compartido (NK-0110/NK-0114). El cambio de usuario se detecta comparando con el último usuario validado y no con `me` en caché (NK-0111). `meQuery` lanza error en vez de guardar `null` si la sesión cambia a mitad de carga, y cerrar sesión limpia también la caché de mutaciones (NK-0115).

## 2. Problema y para quién
Cualquier persona con sesión abierta. Con la red inestable o un fallo momentáneo de Supabase Auth, parece que se ha cerrado la sesión: aparece el formulario de inicio de sesión aunque la sesión sigue guardada, y en `/auth` puede rebotar a `/home` y volver. Con dos cuentas en el mismo navegador, una pantalla puede servir un momento datos en caché del usuario anterior.

## 3. Evidencia y por qué ahora
**Unidad A:**
- `src/lib/session-check.ts:56-70`: la validación devuelve el usuario solo si no hay error; cualquier error (red, 5xx, 401/403) acaba en `null` (`:67`, y `:69` para una excepción). Solo 401/403 cierran la sesión local (`:61-66`, `isDefinitiveRejection` en `:19-22`).
- `src/lib/session-check.ts:83-86`: `createSessionCheck` lo reduce a booleano.
- `src/routes/_authenticated/route.tsx:34`, `:38-40`: `if (!(await isSignedIn())) throw redirect({ to: "/auth" })`. No hay `errorComponent` en esa ruta.
- `src/lib/session-check.ts:44-47`: un token renovado (`TOKEN_REFRESHED`) o distinto borra la respuesta guardada, así que la siguiente navegación vuelve a llamar a `/auth/v1/user` (correcto: una vez por token); con un 5xx persistente esa llamada falla y la guarda manda a `/auth`.
- `src/routes/auth.tsx:63-87` (efecto de entrada): `validatedUser()` solo sigue con usuario validado (`:70-75`), pero el oyente `onAuthStateChange` (`:76-82`) llama a `goOn()` con cualquier evento con sesión que no sea `INITIAL_SESSION`, **sin validar**. Con 5xx persistente: `/auth` → evento → `/home` → guarda falla → `/auth`, una vez por evento.
- `src/test/auth-no-bounce.test.tsx:108-120`: hoy fija que red caída, 503 persistente y 401 **terminan en `/auth`** con ≤3 llamadas a `/auth/v1/user` en 1 s. Esa aserción cambia para red y 503 (D-1, §15).

**Unidad B:**
- Llamadas directas a `getUser()` (búsqueda en `src`, sin tests): `src/components/org-create.tsx:36` (`enter`), `src/components/org-onboarding.tsx:11` (`pick`), `src/components/account/calls-deals-tabs.tsx:48` (`add`), `src/routes/[.]lovable.oauth.consent.tsx:26` (loader). Las tres primeras usan `user!.id` sin comprobar nulo. `src/hooks/use-me.ts` ya usa `validatedUser` (`:33`) desde NK-0098, aunque NK-0110 lo cita.
- `src/lib/session-cache.ts:14-21`: `otherUser` compara la sesión nueva con `me` en caché; sin `me` en caché (`cached === undefined`) no detecta el cambio, invalida (`:23-25`) en vez de borrar, y un loader con `ensureQueryData` puede servir datos del usuario anterior hasta el refetch (NK-0111).
- `src/hooks/use-me.ts:41-47`: si la sesión cambia a mitad de carga, `meQuery` devuelve `null`, que se guarda como respuesta «sin usuario» 5 minutos (`staleTime`, `:30`) (NK-0115).
- `src/lib/session-cache.ts:8-11`: `dropUserCache` cancela y borra consultas, no mutaciones (NK-0115).
- `src/routes/__root.tsx:153-159`: único oyente que llama a `handleAuthEvent`.

**Garantías del Sprint 2 (NK-0098) que este SDD mantiene, con los tests que las protegen:**
| Garantía | Tests |
|---|---|
| ≤1 `GET /auth/v1/user` por token y carga de página (guarda + `meQuery` comparten validación; concurrentes comparten la petición) | `src/lib/session-check.test.ts:56-101`, `:142-150`; `src/hooks/use-me.test.ts:69-105` |
| 401/403 definitivos → cierre de sesión local, sin bucle; un 403 de un token viejo no cierra la sesión de otro usuario | `src/lib/session-reject.test.ts:44-112`; `src/test/auth-no-bounce.test.tsx` caso «definitive 401» |
| Red o 5xx nunca cierran la sesión | `src/lib/session-reject.test.ts:64` |
| Una negativa nunca se guarda; se reintenta en la siguiente navegación | `src/lib/session-check.test.ts:152-197` |
| Cambio de usuario, `SIGNED_OUT` y `USER_UPDATED` invalidan la validación | `src/lib/session-check.test.ts:103-140` |
| Ningún consumidor de `me` ni loader recibe al usuario anterior tras `SIGNED_OUT` o `SIGNED_IN` de otro | `src/lib/session-cache.test.ts:84-155`; `src/hooks/use-me-failure.test.ts:90-111` |
| Cerrar sesión no deja ventana con sesión a medias | `src/lib/session-signout.test.ts:68-103` |
| La guarda no llama a `getUser()` en cada navegación (guarda de fuente) | `src/lib/session-check.test.ts:199-209` |
| Sin rebote `/home` ↔ `/auth` | `src/test/auth-no-bounce.test.tsx:108-120` |

**Uso real:** sin dato (no hay medición de fallos de `/auth/v1/user` en producción). Lo vio el walkthrough del Sprint 2 sobre `d0f4252` con fallos simulados.

## 4. Resultado buscado
- Con sesión guardada y la comprobación fallando por red o 5xx, nadie ve el formulario de inicio de sesión ni pierde la sesión: ve «No he podido comprobar tu sesión» con «Reintentar».
- Con 5xx persistente, ningún evento de sesión produce navegación de `/auth` a `/home` ni al revés.
- Ningún código de la app llama a `getUser()` fuera del validador.
- Línea base: sin dato.

## 5. Alcance
**Incluye:**
- Unidad A: `src/lib/session-check.ts` (respuesta de tres estados, sin cambiar `createSessionUser`/`createSessionCheck`), `src/lib/session.ts`, `src/routes/_authenticated/route.tsx` (guarda y estado «sin poder comprobar»), componente nuevo `src/components/session-unverified.tsx`, `src/routes/auth.tsx` (el oyente valida antes de seguir).
- Unidad B: `org-create.tsx`, `org-onboarding.tsx`, `calls-deals-tabs.tsx`, `[.]lovable.oauth.consent.tsx` (validador compartido), `src/lib/session-check.ts` (último usuario validado), `src/lib/session-cache.ts` (`handleAuthEvent`, `dropUserCache`), `src/hooks/use-me.ts:41-47`.
- Una guarda de fuente: ningún archivo de `src` fuera de `src/lib/session-check.ts` llama a `auth.getUser(`.
- Actualizar el comentario de `src/lib/session-check.ts:1-4` y una línea en `AGENTS.md` (sesión).

**No incluye** (el brief lo copia a «Movimientos prohibidos»):
- Reintentos automáticos ni temporizadores (solo «Reintentar» manual): evitan tormentas de llamadas.
- Cambiar cuándo se cierra la sesión local (sigue: solo 401/403 del token guardado).
- Cambiar RLS, `meQuery` más allá de `:41-47`, el formulario de `/auth` o Supabase.
- Modo sin conexión ni caché de datos durante la caída.
- Medir fallos de Auth en producción.

## 6. Cambios de comportamiento (delta)
**Añadido:** `checkSession()` con `{ status: "valid", user } | { status: "none" } | { status: "unverified" }`; `lastValidatedUserId()`; pantalla «No he podido comprobar tu sesión» con «Reintentar»; guarda de fuente de `getUser`.
**Modificado:**
- Guarda de `/_authenticated`: fallo de red/5xx → redirige a `/auth` → muestra el estado «sin poder comprobar» en la URL pedida, sin redirigir ni cerrar sesión. «Sin sesión» y 401/403 → `/auth` como hoy.
- `/auth`: cualquier evento con sesión (salvo `INITIAL_SESSION`) → `/home` → solo con `validatedUser()` no nulo.
- `handleAuthEvent`: «otro usuario» = distinto de `me` en caché → distinto del último usuario validado **o** de `me` en caché.
- `meQuery` con sesión cambiada a mitad de carga: `null` → error.
- `dropUserCache`: consultas → consultas y mutaciones.
- `org-create`, `org-onboarding`, `calls-deals-tabs`, consentimiento OAuth: `getUser()` → `validatedUser()`; sin usuario validado, mensaje en vez de `user!.id`.
- `src/test/auth-no-bounce.test.tsx`: red y 503 terminan en `/auth` → terminan en `/home` con el estado «sin poder comprobar» (D-1).
**Eliminado:** las cuatro llamadas directas a `getUser()`.

## 7. Historias y criterios de aceptación
### Unidad A. H-1: Como persona con sesión abierta, si no se puede comprobar mi sesión quiero saberlo y reintentar, sin perder la sesión.
- **CA-1** (tres estados) `checkSession()` devuelve `valid` con el usuario si el servidor lo valida; `none` sin sesión local, con 401/403 (y cierra la sesión local como hoy) o si el servidor devuelve otro usuario; `unverified` con error de red, 5xx, 429 o error sin `status`. `unverified` nunca se guarda. Comparte la misma respuesta guardada y la misma petición en vuelo que `createSessionUser`/`createSessionCheck` (una sola llamada por token). · prueba: `src/lib/session-check.test.ts` (`describe` nuevo; falla hoy: la función no existe)
- **CA-2** (guarda) Con sesión guardada y `/auth/v1/user` respondiendo red caída o 503 persistente, abrir `/home` termina en `/home` (no en `/auth`), se ve «No he podido comprobar tu sesión» y el botón «Reintentar», `signOut` no se llama, la sesión sigue guardada y hay ≤3 llamadas a `/auth/v1/user` en 1 s. Con 401 definitivo, termina en `/auth` como hoy. · prueba: `src/test/auth-no-bounce.test.tsx` (cambia la aserción `finalPath` de red y 503; falla hoy)
- **CA-3** (reintentar) Con el estado «sin poder comprobar» en pantalla, al volver el servidor y pulsar «Reintentar», la ruta pedida se carga (una llamada más a `/auth/v1/user`); si sigue fallando, se queda en el estado, sin bucle. · prueba: `src/test/auth-no-bounce.test.tsx` (caso nuevo)
- **CA-4** (rebote por eventos, NK-0113) En `/auth` con sesión guardada y 503 persistente, emitir 5 veces `TOKEN_REFRESHED` y 5 veces `SIGNED_IN` no produce ninguna navegación a `/home` y la ruta final es `/auth`; con validación correcta, un `SIGNED_IN` sí lleva a `/home` (o a `next`). · prueba: `src/test/auth-no-bounce.test.tsx` (caso nuevo; falla hoy)
- **CA-5** (garantías NK-0098) Todos los tests de la tabla de §3 siguen en verde sin cambiar sus aserciones, salvo `auth-no-bounce.test.tsx:118` (D-1) y la guarda de fuente `session-check.test.ts:204-208`, que se reescribe para exigir: `redirect({ to: "/auth" })` solo cuando el estado es `none`, y ningún `getUser(` en la ruta. · prueba: la suite (`npx vitest run src/lib/session-*.test.ts src/hooks/use-me*.test.ts src/test/auth-no-bounce.test.tsx`)

### Unidad B. H-2: Como persona con una o varias cuentas, quiero que la app use siempre el mismo usuario validado y nunca me sirva datos de otro.
- **CA-6** (sin `getUser` sueltos, NK-0110/NK-0114) Ningún archivo de `src` (excepto `src/lib/session-check.ts` y los tests) contiene `auth.getUser(`. · prueba: `src/lib/session-getuser-guard.test.ts` (nuevo; falla hoy con los cuatro archivos de §3)
- **CA-7** (comportamiento de los cuatro) `pick` de `OrgOnboarding` y `enter` de `OrgCreateForm` actualizan `profiles.current_org_id` con el id de `validatedUser()`; `add` de la pestaña Deals inserta con `owner_id` de `validatedUser()`; sin usuario validado los tres muestran «No he podido comprobar tu sesión. Vuelve a intentarlo.» y no escriben. El consentimiento OAuth toma el email de `validatedUser()`; sin usuario validado muestra su error con ese mismo texto. Ninguno llama a `/auth/v1/user` si la validación ya está guardada. · prueba: `src/components/session-consumers.test.tsx` (nuevo, con `@/lib/session` simulado)
- **CA-8** (cambio de usuario sin `me`, NK-0111) Con el usuario X validado, sin `["me"]` en caché y otras consultas de X en caché, un `SIGNED_IN` de Y borra esas consultas (no solo las invalida) y `ensureQueryData` de una de ellas no devuelve datos de X. Un `SIGNED_IN` del mismo X (foco) sigue sin borrar nada. · prueba: `src/lib/session-cache.test.ts` (`describe` nuevo; falla hoy)
- **CA-9** (último validado) `lastValidatedUserId()` es el id del último usuario validado por el validador compartido; sobrevive a `TOKEN_REFRESHED`; se sustituye solo tras validar otro usuario. · prueba: `src/lib/session-check.test.ts`
- **CA-10** (`meQuery` coherente, NK-0115) Si la sesión cambia de usuario o se cierra entre la validación y `accept_invites`, o entre `accept_invites` y la carga, `meQuery` rechaza con error y no deja `null` en `["me"]`. · prueba: `src/hooks/use-me-failure.test.ts` (caso nuevo; falla hoy)
- **CA-11** (mutaciones) Tras `dropUserCache` (y por tanto `signOutAndClear` y el cambio de usuario), `qc.getMutationCache().getAll()` está vacío. · prueba: `src/lib/session-signout.test.ts` (caso nuevo; falla hoy)

## 8. Casos límite y errores
- **Caída larga de Auth:** cada navegación dentro de la app vuelve a comprobar (la negativa no se guarda) y muestra el estado; no hay reintento automático (≤1 llamada por intento).
- **El estado «sin poder comprobar» en una URL profunda:** se queda en esa URL; «Reintentar» la carga entera (`router.invalidate()`).
- **401/403 mientras se ve el estado:** «Reintentar» recibe `none`, cierra la sesión local (como hoy) y lleva a `/auth`.
- **Otra pestaña cierra sesión:** `SIGNED_OUT` → `none` → `/auth`, como hoy.
- **Error de otra ruta hija:** la pantalla de «sin poder comprobar» solo aparece para el error propio de la guarda (`SessionUnverifiedError`); el resto de errores siguen su camino actual.
- **Consentimiento OAuth:** su `beforeLoad` sigue mirando la sesión local para mandar a `/auth?next=…`; el loader valida. Sin validación, su `errorComponent` actual muestra el texto.
- **Varias empresas:** sin cambios; `current_org_id` sigue saliendo de `profiles`.

## 9. Experiencia y copy
- Título: «No he podido comprobar tu sesión»
- Texto: «Puede ser la conexión o un fallo momentáneo. Tu sesión sigue abierta.»
- Botón: «Reintentar» (mientras comprueba: «Comprobando…», deshabilitado).
- Error en acciones (unidad B): «No he podido comprobar tu sesión. Vuelve a intentarlo.»
- Pantalla con los tokens del sistema de diseño (`src/styles.css`), sin colores fijos ni iconos, legible en móvil y escritorio, claro y oscuro.

## 10. Datos, permisos y privacidad
Sin tablas, columnas, RLS ni GRANT. La seguridad de los datos sigue en la RLS; el estado «sin poder comprobar» no muestra datos (la app no se monta). Pruebas con usuarios y tokens ficticios.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| ninguna | — | — | — |

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 (A) | `checkSession()` de tres estados en `session-check.ts`, compartiendo la respuesta guardada | CA-1 | `src/lib/session-check.test.ts` (`describe` «three states») |
| U-2 (A) | Guarda de `/_authenticated` con `checkSession()`: `none` → `/auth`; `unverified` → lanza `SessionUnverifiedError` y `errorComponent` con `src/components/session-unverified.tsx` | CA-2, CA-3, CA-5 | `src/test/auth-no-bounce.test.tsx` (red y 503 terminan hoy en `/auth`) |
| U-3 (A) | `/auth`: el oyente llama a `validatedUser()` y sigue solo con usuario | CA-4 | `src/test/auth-no-bounce.test.tsx` (caso de eventos) |
| U-4 (B) | `lastValidatedUserId()` y `handleAuthEvent` comparando con él; `dropUserCache` limpia mutaciones | CA-8, CA-9, CA-11 | `src/lib/session-cache.test.ts` (CA-8) y `src/lib/session-signout.test.ts` (CA-11) |
| U-5 (B) | `meQuery` lanza error al cambiar la sesión a mitad de carga | CA-10 | `src/hooks/use-me-failure.test.ts` |
| U-6 (B) | Cuatro sitios con `validatedUser()` + guarda de fuente | CA-6, CA-7 | `src/lib/session-getuser-guard.test.ts` |

Orden: U-1 → U-2 → U-3 (unidad A, una rama); U-4, U-5 y U-6 (unidad B) pueden ir en otra rama sobre `main`, pero U-4 toca `session-check.ts` como U-1: si van en paralelo, contrato: U-1 solo añade `checkSession`; U-4 solo añade `lastValidatedUserId`; ninguna cambia `createSessionUser` ni sus tests existentes. Quien integre segundo resuelve el archivo.

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- En `session-check.ts`, guardar en `saved.valid` un resultado (`{ user } | { reason: "none" | "unverified" }`) y que `createSessionUser` lo reduzca a `U | null`, para que los tests actuales sigan igual. `unverified` y `none` no se guardan (como hoy `:76`).
- La guarda de fuente actual (`session-check.test.ts:204-208`) busca el texto exacto `if (!(await \w+\(\)\)) throw redirect…`; se reescribe con la nueva forma, manteniendo «no `getUser(`» (`:201-203`).
- `SessionUnverifiedError` como clase exportada; `errorComponent` de `/_authenticated` comprueba `instanceof` y, si no lo es, re-lanza o pinta el error por defecto [Por verificar el comportamiento de TanStack Router con `errorComponent` en una ruta de diseño].
- `/auth`: el oyente puede reutilizar el mismo `validatedUser().then(...)` del montaje; cuidado con varias llamadas concurrentes: comparten la petición en vuelo por token.
- `lastValidatedUserId` vive en el cierre de `createSessionUser` (uno por cliente, `WeakMap` de `:24`), exportado desde `src/lib/session.ts` para `__root`.
- Unidad B: `calls-deals-tabs.tsx:48` puede tomar el id de `useMe()` en vez de validar; se prefiere `validatedUser()` por coherencia con los otros tres y porque es gratis con la validación guardada.
- Alternativa descartada (unidad A): seguir como el último usuario validado durante un fallo transitorio tras renovar el token («gracia»). Mantiene la app usable en una caída, pero muestra la app sin saber si la sesión sigue siendo válida; se deja como pregunta (§15).

## 14. Riesgos y dependencias
- **Cambia una aserción entregada en el Sprint 2** (`auth-no-bounce.test.tsx:118` para red y 503). Es un cambio de comportamiento decidido (D-1), no un relajamiento: se mantienen «sin bucle», «≤3 llamadas/s» y «sin cerrar sesión», y se añade «se ve el estado».
- **Walkthrough a repetir** (`nokko-walkthrough`, móvil y escritorio, claro y oscuro, consola y red): (1) entrar con sesión válida; (2) `/auth/v1/user` bloqueado (red) y luego 503 persistente al abrir `/home` → estado y «Reintentar», sin `/auth`; (3) servidor vuelve → «Reintentar» entra; (4) 401 → `/auth` y sesión local borrada; (5) en `/auth` con 503 persistente: volver el foco a la pestaña y forzar renovación de token → sin rebotes; (6) cerrar sesión y entrar con otro usuario en la misma pestaña y en otra → nunca datos del anterior; (7) crear empresa, elegir empresa en la pantalla sin empresa, añadir deal desde una cuenta, consentimiento OAuth: una sola llamada a `/auth/v1/user` por carga de página; (8) navegar N veces: una llamada por token (garantía NK-0098).
- **Archivos compartidos en el Sprint 3:** `calls-deals-tabs.tsx` no lo toca otro SDD del sprint; `AGENTS.md`, cada uno su línea.

## 15. Preguntas para Fede y para la revisión técnica
**Decisiones tomadas (autor, dentro del alcance del coordinador):**
- **D-1.** Con red caída o 5xx, la app no redirige a `/auth`: muestra el estado en la URL pedida. Se cambia la aserción `finalPath = "/auth"` de esos dos casos en `auth-no-bounce.test.tsx`.
- **D-2.** Sin reintento automático: solo «Reintentar».
- **D-3.** Sin «gracia» tras renovar el token: un fallo transitorio muestra el estado aunque el mismo usuario se validara antes en la misma carga.
- **D-4.** Un error sin `status` cuenta como «sin poder comprobar» (no cierra sesión ni manda a `/auth`).
- **D-5.** NK-0114 se trata dentro de NK-0110 (duplicado enlazado en el ledger); el consentimiento OAuth entra en U-6.

**Para Fede:**
1. ¿Te vale D-3, o prefieres que, si ya te validó en esta carga y solo falla la renovación, la app siga funcionando y avise de forma discreta? Recomiendo D-3 (más simple y honesto); la alternativa es un ticket aparte.
2. ¿Añadimos en el estado un enlace secundario «Cerrar sesión»? Recomiendo no en este ticket: el ticket pide conservar la sesión, y cerrar sesión ya está en el menú cuando la app carga.

**Para la revisión técnica:**
3. Confirmar que `supabase-js` devuelve `status` 5xx/0 (`AuthRetryableFetchError`) y 401/403 (`AuthApiError`) como asume `auth-no-bounce.test.tsx:28-34`.

## 16. Pendiente de verificar
- [Por verificar] Comportamiento de `errorComponent` en `/_authenticated` con errores de rutas hijas (TanStack Router).
- [Por verificar] Que `supabase-js` emite `TOKEN_REFRESHED` y `SIGNED_IN` al volver el foco como simula el walkthrough del Sprint 2.

**Lo que NO se afirma:**
- No se afirma con qué frecuencia falla `/auth/v1/user` en producción: sin dato.
- La app no funciona sin conexión; solo deja de parecer que se cerró la sesión.
- No se cambia la seguridad de los datos (RLS).

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Un agente `nokko-gate` con contexto fresco lee este SDD y el código, y devuelve su informe. El coordinador lo copia aquí sin editarlo. El gate no aprueba el SDD: informa; la aprobación es de Fede.
- Veredicto del gate: No revisado
- CA sin prueba posible o sin G-n: pendiente
- [Por verificar] que sigue sin comprobarse: pendiente
- Contradicciones con el código o con decisiones previas: pendiente
- Lo que esta revisión NO demuestra: pendiente

## 18. Delta de implementación (lo rellena el agente al entregar)
Pendiente.
