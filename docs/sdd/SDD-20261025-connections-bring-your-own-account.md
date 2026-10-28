# SDD-20261025-connections-bring-your-own-account · [Feature] Conexiones: conecta tus propias cuentas

**Tipo:** Feature · **Prioridad propuesta:** Alta
**Estado:** En curso (aprobado por Fede 2026-10-26; U-1 y U-2 entregadas sin proveedores habilitados) · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-10-25
**PRD:** docs/prd/PRD-20261028-ux-onboarding-coherencia.md (cubre G-6) · **Depende de:** SDD universal de campos (origen del dato); SDD de Drive por empresa (primer caso)

## 1. Resumen
La pantalla **Conexiones** es hoy un listado informativo de lo que NOKKO conecta con sus propios servicios. Se quiere que desde ahí **cada empresa conecte sus propias cuentas** (Google Drive, proveedores de datos y otros) y vea el estado, quién la conectó y cuánto se usa. Es la casa común de las conexiones; el SDD de Drive por empresa es su primer caso.

## 2. Problema y para quién
Founder o Owner que quiere que NOKKO use su Drive, su cuenta de Apollo o Clay, o su fuente de datos, y no una cuenta compartida; hoy no puede conectarlas desde un solo sitio ni saber con qué cuenta se está investigando.

## 3. Evidencia y por qué ahora
Fuente: código del repo `main` (2026-10-25) y petición de Fede. Sin datos de uso (sin dato).
- La pantalla `integrations.tsx` lista como «Lo que se conecta hoy»: webhooks y CSV, asistentes por MCP, Firecrawl, Logo.dev, Parallel, Apify, Google Drive, Perplexity, Apollo, Clay, Telegram y email del informe. Cada tarjeta enlaza a la pantalla donde se usa; no hay botón de «conectar mi cuenta».
- Ya existen paneles de conexión propia para **Stripe** y **PostHog** (`stripe-panel`, `posthog-panel`): hay un patrón en el producto.
- Los proveedores de datos se llaman con credenciales del entorno de la aplicación (ver SDD de Drive para el caso de Drive); **[Por verificar]** cuáles aceptan hoy una clave por empresa.
- Hay un panel de presupuesto por empresa (`BudgetPanel`) con orquestador de coste.
- Lista de «aún no construido» en la propia pantalla: sincronización nativa de HubSpot, Pipedrive, Attio y Salesforce; Google Calendar y Gmail; Gong y Fireflies.
- Telegram y el email del informe figuran con un paso pendiente (bot sin crear, dominio sin verificar).
**Apuesta declarada:** se medirá tras el lanzamiento con las métricas de la sección 4.

## 4. Resultado buscado
- % de empresas con al menos una cuenta propia conectada (fuente: base de datos). Línea base: sin dato.
- Peticiones de enriquecimiento que fallan por credencial inválida o caducada (fuente: registro de trabajos). Línea base: sin dato.
- Cubre el objetivo G-6 del PRD.

## 5. Alcance
**Incluye:** vista única de conexiones con estado (propia de la empresa / proporcionada por NOKKO / sin conectar / con error); conectar, cambiar y desconectar una cuenta propia por proveedor; ver quién la conectó y cuándo; uso y coste atribuido; roles; avisos cuando una conexión falla; entrada desde el onboarding y desde la guía de estrategia.
**No incluye:** construir los conectores que hoy figuran como «aún no» (HubSpot nativo, Gmail, Calendar, Gong); contratar proveedores nuevos; facturar el uso; guardar o mostrar credenciales a otros miembros.

## 6. Cambios de comportamiento (delta)
**Añadido:** acción «Conectar mi cuenta» por proveedor; estado y propietario de cada conexión; avisos de fallo.
**Modificado:** tarjetas de Conexiones (antes: solo informativas y enlazan a otra pantalla; después: informan, permiten conectar y muestran el estado); uso de los proveedores (antes: cuenta compartida; después: la cuenta de la empresa si la hay).
**Eliminado:** nada.

## 7. Historias y criterios de aceptación
### H-1: Como Owner, quiero ver todas mis conexiones y su estado en un sitio.
- CA-1: El sistema DEBE mostrar, por cada proveedor, uno de estos estados: Cuenta propia, Proporcionada por NOKKO, Sin conectar, Error · cubre G-6 · prueba: `src/lib/connections.test.ts`, `src/components/connections-panel.test.tsx`
- CA-2: El sistema DEBE mostrar, para cada cuenta propia, qué cuenta es (identificador visible, nunca la credencial), quién la conectó y desde cuándo · cubre G-6 · prueba: `src/lib/connections.test.ts`, `src/components/connections-panel.test.tsx`
- CA-3: El sistema DEBE indicar para qué se usa cada conexión dentro de NOKKO · cubre G-6 · prueba: `src/lib/connections.test.ts`, `src/components/connections-panel.test.tsx`

### H-2: Como Owner, quiero conectar mi propia cuenta.
- CA-4: CUANDO pulso «Conectar mi cuenta» en un proveedor, el sistema DEBE guiarme paso a paso según el tipo de conexión (autorizar con Google, pegar clave, etc.) · cubre G-6 · prueba: `src/lib/connections.test.ts`, `src/lib/connections-core.test.ts`, `src/components/connections-panel.test.tsx`
- CA-5: CUANDO termino, el sistema DEBE comprobar que la cuenta funciona y mostrar el resultado antes de guardarla · cubre G-6 · prueba: `src/lib/connections.test.ts`, `src/lib/connections-core.test.ts`, `src/components/connections-panel.test.tsx`
- CA-6: SI la comprobación falla, ENTONCES el sistema DEBE explicar el motivo y no guardar la conexión · cubre G-6 · prueba: `src/lib/connections.test.ts`, `src/lib/connections-core.test.ts`, `src/components/connections-panel.test.tsx`
- CA-7: El sistema DEBE permitirme cambiar de cuenta y desconectar en cualquier momento · cubre G-6 · prueba: `src/lib/connections-core.test.ts`, `src/components/connections-panel.test.tsx`
- CA-8: CUANDO desconecto, el sistema DEBE dejar de usar esa cuenta de inmediato y decir qué pasará con los datos ya importados · cubre G-6 · prueba: `src/lib/connections.test.ts`, `src/lib/connections-core.test.ts`, `src/components/connections-panel.test.tsx`

### H-3: Como Owner, quiero que mis credenciales estén protegidas.
- CA-9: CUANDO guardo una credencial, el sistema DEBE ocultarla a todos los miembros, incluido el Owner, y solo permitir sustituirla · cubre G-6 · prueba: por nombrar en el brief
- CA-10: El sistema DEBE registrar quién conectó, cambió o desconectó cada cuenta y cuándo · cubre G-6 · prueba: `src/lib/connections.test.ts`, `src/lib/connections-core.test.ts`
- CA-11: SI mi rol no es Owner, ENTONCES el sistema DEBE mostrar las conexiones en solo lectura y decir quién puede gestionarlas (decidido por Fede: solo el Owner) · cubre G-6 · prueba: `src/lib/connections.test.ts`, `src/lib/connections-core.test.ts`, `src/components/connections-panel.test.tsx`

### H-4: Como Owner, quiero controlar el uso y el coste.
- CA-12: DONDE la conexión sea una cuenta propia, el sistema DEBE mostrar el uso por proveedor del mes en curso · cubre G-6 · prueba: por nombrar en el brief
- CA-13: SI una cuenta propia se queda sin crédito o límite, ENTONCES el sistema DEBE avisarme y usar la cuenta proporcionada por NOKKO para no detener el trabajo (decidido por Fede) e indicarlo en el estado de la conexión · cubre G-6 · prueba: `src/lib/connections.test.ts`, `src/components/connections-panel.test.tsx` (parcial: solo la nota de cobertura, no el respaldo con la cuenta de NOKKO)
- CA-14: El sistema DEBE aplicar el presupuesto y las pausas automáticas de la empresa y descontar de él el uso de la cuenta de NOKKO cuando actúe como respaldo (decidido por Fede) · cubre G-6 · prueba: por nombrar en el brief

### H-5: Como founder, quiero llegar a conectar desde donde estoy.
- CA-15: CUANDO un paso del onboarding o de la guía necesita una conexión que no tengo, el sistema DEBE ofrecer conectarla sin salir del flujo · cubre G-6 · prueba: por nombrar en el brief
- CA-16: CUANDO la conexión se completa, el sistema DEBE devolverme al paso donde estaba · cubre G-6 · prueba: por nombrar en el brief

## 8. Casos límite y errores
- Credencial caducada o revocada por el proveedor: estado Error con aviso, y no perder lo importado (CA-1, CA-8).
- Cuenta ya conectada en otra empresa: informar y pedir confirmación (CA-5).
- Varias personas con permiso de gestión (solo el Owner, CA-11) intentan conectar a la vez: la última conexión confirmada manda y se avisa al resto (CA-10).
- Proveedor caído: no marcar como desconectada; mostrar «Sin respuesta» y reintentar (CA-1).
- Owner que deja la empresa: las conexiones quedan de la empresa, no de la persona (CA-2).
- Conector no disponible para cuenta propia: mostrar «Solo proporcionada por NOKKO» (CA-1).
- Rol sin permiso: ver CA-11.

## 9. Experiencia y copy
Tarjeta: nombre, para qué sirve, estado con palabra y botón «Conectar mi cuenta» o «Cambiar». Texto: «Usa tu propia cuenta de *Proveedor*. NOKKO solo hará lo que se indica aquí.» En «tú», sin iconos.

## 10. Datos, permisos y privacidad
- Se guardan credenciales y metadatos de conexión por empresa; solo el sistema las usa.
- Solo el Owner gestiona (decidido por Fede, 2026-10-25); todos los miembros ven el estado en solo lectura (CA-11).
- Datos de terceros leídos mediante la cuenta se guardan en la empresa con su origen.
- LinkedIn: solo API oficial; no se conectan cuentas de LinkedIn para extraer datos fuera de ella.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| Ninguna (el SDD declara «Uso de LLM: ninguno»: la comprobación de credenciales y los estados son deterministas) | no aplica | no aplica | sin dato |

Una llamada no declarada aquí no se implementa.

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | Vista de estado y estructura común de conexión (H-1, H-3) | CA-1, CA-2, CA-3, CA-9, CA-10, CA-11 | por nombrar en el brief |
| U-2 | Conectar, comprobar y desconectar (H-2) | CA-4, CA-5, CA-6, CA-7, CA-8 | por nombrar en el brief |
| U-3 | Google Drive como primer proveedor (SDD de Drive) | Los de `SDD-20261025-drive-per-company-account` | por nombrar en el brief |
| U-4 | Proveedores de datos con cuenta propia: Apollo, Clay, Parallel, Perplexity y Firecrawl primero; la estructura debe admitir cualquier proveedor disponible o nuevo sin rediseñar (H-2, H-4) | CA-4, CA-5, CA-6, CA-7, CA-8, CA-12, CA-13, CA-14 | por nombrar en el brief |
| U-5 | Uso, respaldo y presupuesto (H-4) | CA-12, CA-13, CA-14 | por nombrar en el brief |
| U-6 | Conectar desde onboarding y guía (H-5) | CA-15, CA-16 | por nombrar en el brief |

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- Código: `src/routes/_authenticated/integrations.tsx` (lista `WORKING`/`NOT_YET`), `src/components/stripe-panel.tsx` y `posthog-panel.tsx` (patrón existente), `src/components/orchestrator/budget-panel.tsx`, `src/lib/orchestrator/planner.ts` (servicios y coste), `src/lib/google-drive.ts`.
- El orquestador ya recibe qué servicios están conectados: se puede alimentar con las conexiones de la empresa.
- Almacenamiento de credenciales cifradas por empresa (diseño que valida la revisión del gate).
- **Uso de LLM:** ninguno. Comprobación de credenciales y estados son deterministas.

## 14. Riesgos y dependencias
- Seguridad: credenciales de terceros por empresa.
- Coste: cuentas propias sin presupuesto compartido pueden confundir el control de gasto.
- Algunos proveedores no ofrecen cuenta propia: se declara en CA-1.
- Depende del SDD de Drive (primer caso) y del universal (origen).

## 15. Preguntas para Fede y para la revisión técnica
1. ¿Qué proveedores aceptan hoy una clave por empresa sin cambios?
2. ¿Dónde guardar credenciales de forma segura en el stack actual?
3. ¿El orquestador puede elegir cuenta propia o compartida por empresa?

## 16. Pendiente de verificar
- [Por verificar] Proveedores con soporte de clave por empresa. Verificado en `main` (2026-10-26): ninguno la acepta hoy. Apollo, Clay, Parallel, Perplexity, Apify y Drive leen claves del entorno a través de la pasarela de conectores (`*-gateway.ts`, `google-drive.ts`; `runner.ts` solo comprueba variables de entorno) y Firecrawl usa `FIRECRAWL_API_KEY` directa. Si la pasarela admite una clave por empresa no consta en el repo: pregunta 1 de la sección 15, para la revisión técnica, sin suponer.
- [Por verificar] Qué hacen hoy los paneles de Stripe y PostHog con sus credenciales. Verificado en `main` (2026-10-26): PostHog guarda la clave cifrada con AES-GCM (`INTEGRATION_KEYS_SECRET`, `src/lib/secret-box.server.ts`) en `posthog_connections.api_key_enc`; Stripe la guarda en Supabase Vault (`vault_secret_id`, migración 0027). En ambos solo el servidor la lee y el navegador ve estado y pista por permisos de columna. Es el patrón para el almacén cifrado de las conexiones nuevas; la revisión del gate valida la decisión de diseño.
- [Por verificar] Estado en `production` (solo se leyó `main`).

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Un agente `nokko-gate` con contexto fresco lee este SDD y el código, y devuelve su informe. El coordinador lo copia aquí sin editarlo. El gate no aprueba el SDD: informa; la aprobación es de Fede.
Informe del gate recibido el 2026-10-28, copiado sin editar. El veredicto no aprueba el SDD: la aprobación es de Fede.
- **Veredicto del gate:** Objeciones
- **CA sin prueba posible o sin G-n:** todos los CA citan G-6, que es correcto (PRD:29 y PRD:79).
  - CA-9 dice «prueba: por nombrar» (SDD:51), pero U-1 figura como entregada y dice cerrarlo (SDD:92). Tampoco existe el almacén de credenciales (connections.functions.ts:26-27).
  - CA-8, «deja de usar de inmediato»: el test solo comprueba que se borra la fila (connections-core.test.ts:102-103). El runner usa variables de entorno (runner.ts:17-18), así que nada demuestra el cambio de uso.
  - CA-10, el «cuándo»: el almacén falso no guarda la hora (connections-core.test.ts:18).
  - CA-4 con OAuth: solo se prueba el texto de los pasos (connections.test.ts:60).
  - CA-12 y CA-14 a CA-16 siguen sin test.
- **[Por verificar] que sigue sin comprobarse:**
  - El estado en `production` (SDD:119).
  - Si la pasarela admite una clave por empresa (SDD:117).
  - La migración 0059 no está aplicada ni verificada (0059_org_connections.sql:2).
  - El Vault de Stripe solo consta en una migración comentada (0027_stripe.sql:1).
- **Contradicciones con el código o con decisiones previas:**
  - La sección 10 dice que los roles los decide Fede (SDD:78), pero CA-11 ya fija que solo gestiona el Owner (SDD:53).
  - La sección 8 habla de «varios miembros» conectando a la vez y de avisar al resto (SDD:67). Choca con CA-11, y no hay código ni test de ese aviso.
  - La sección 16 dice que Perplexity va por `*-gateway.ts`, pero va en perplexity.ts:16-17.
  - Las demás afirmaciones sobre el código las comprobé y son ciertas: archivos, `WORKING`/`NOT_YET` (integrations.tsx:23,40), `secret-box`, `api_key_enc` y los commits de la sección 18.
  - En la sección 11 no hay incoherencia: en connections.ts no vi ninguna llamada a IA. connections-core.ts no lo leí entero.
  - No encontré cifras sin fuente.
- **Lo que esta revisión NO demuestra:** que los tests pasen o fallen sobre el commit base (no los ejecuté), el comportamiento en la base de datos real o en `production`, la seguridad de RLS y GRANT aplicados, ni ningún flujo real con un proveedor.

## 18. Delta de implementación (lo rellena el agente al entregar)
Reconstruido el 2026-10-28 desde el historial de git; no es el informe de entrega de la sesión que lo implementó.
- U-1 y U-2 entregadas con cuentas propias todavía apagadas, según el Estado de la cabecera. Commits: `f7ebee9` (estados, reglas de conectar, comprobar y desconectar, con puertos probados con falsos), `0fef958` (tablas `org_connections` y de auditoría, catalogadas como metadatos de conexión, no verificadas), `2234f50` (panel «Tus cuentas» y funciones de servidor) y `a7d0361` (recorrido con datos ficticios).
- U-3 (SDD de Drive por empresa): sin entrega registrada.

---
Validación: migrado a la plantilla de NOKKO el 2026-10-28. Revisión técnica: ver sección 17. `AUDIT-20261025.md` es el registro histórico anterior.
