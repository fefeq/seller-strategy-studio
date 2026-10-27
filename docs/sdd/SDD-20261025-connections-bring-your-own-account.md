# SDD-20261025-connections-bring-your-own-account · [Feature] Conexiones: conecta tus propias cuentas

**Tipo:** Feature · **Prioridad propuesta:** Alta
**Estado:** En curso (aprobado por Fede, 2026-10-26; rama feat/connections-own-account-v2) · **Pide:** Fede · **Para:** Claude Code · **Fecha:** 2026-10-25
**Depende de:** SDD universal de campos (origen del dato); SDD de Drive por empresa (primer caso)

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

## 5. Alcance
**Incluye:** vista única de conexiones con estado (propia de la empresa / proporcionada por NOKKO / sin conectar / con error); conectar, cambiar y desconectar una cuenta propia por proveedor; ver quién la conectó y cuándo; uso y coste atribuido; roles; avisos cuando una conexión falla; entrada desde el onboarding y desde la guía de estrategia.
**No incluye:** construir los conectores que hoy figuran como «aún no» (HubSpot nativo, Gmail, Calendar, Gong); contratar proveedores nuevos; facturar el uso; guardar o mostrar credenciales a otros miembros.

## 6. Cambios de comportamiento (delta)
**Añadido:** acción «Conectar mi cuenta» por proveedor; estado y propietario de cada conexión; avisos de fallo.
**Modificado:** tarjetas de Conexiones (antes: solo informativas y enlazan a otra pantalla; después: informan, permiten conectar y muestran el estado); uso de los proveedores (antes: cuenta compartida; después: la cuenta de la empresa si la hay).
**Eliminado:** nada.

## 7. Historias y criterios de aceptación
### H-1: Como Owner, quiero ver todas mis conexiones y su estado en un sitio.
- CA-1: El sistema DEBE mostrar, por cada proveedor, uno de estos estados: Cuenta propia, Proporcionada por NOKKO, Sin conectar, Error.
- CA-2: El sistema DEBE mostrar, para cada cuenta propia, qué cuenta es (identificador visible, nunca la credencial), quién la conectó y desde cuándo.
- CA-3: El sistema DEBE indicar para qué se usa cada conexión dentro de NOKKO.

### H-2: Como Owner, quiero conectar mi propia cuenta.
- CA-4: CUANDO pulso «Conectar mi cuenta» en un proveedor, el sistema DEBE guiarme paso a paso según el tipo de conexión (autorizar con Google, pegar clave, etc.).
- CA-5: CUANDO termino, el sistema DEBE comprobar que la cuenta funciona y mostrar el resultado antes de guardarla.
- CA-6: SI la comprobación falla, ENTONCES el sistema DEBE explicar el motivo y no guardar la conexión.
- CA-7: El sistema DEBE permitirme cambiar de cuenta y desconectar en cualquier momento.
- CA-8: CUANDO desconecto, el sistema DEBE dejar de usar esa cuenta de inmediato y decir qué pasará con los datos ya importados.

### H-3: Como Owner, quiero que mis credenciales estén protegidas.
- CA-9: CUANDO guardo una credencial, el sistema DEBE ocultarla a todos los miembros, incluido el Owner, y solo permitir sustituirla.
- CA-10: El sistema DEBE registrar quién conectó, cambió o desconectó cada cuenta y cuándo.
- CA-17 [añadido tras la auditoría independiente, 2026-10-27; Fede lo acepta o lo quita]: CUANDO Google devuelve al Owner a NOKKO, el sistema DEBE completar la conexión solo en el mismo navegador que la inició y solo una vez; un enlace de retorno firmado, pero sin ese navegador o ya usado, DEBE rechazarse sin guardar nada.
- CA-11: SI mi rol no es Owner, ENTONCES el sistema DEBE mostrar las conexiones en solo lectura y decir quién puede gestionarlas (decidido por Fede: solo el Owner).

### H-4: Como Owner, quiero controlar el uso y el coste.
- CA-12: DONDE la conexión sea una cuenta propia, el sistema DEBE mostrar el uso por proveedor del mes en curso.
- CA-13: SI una cuenta propia se queda sin crédito o límite, ENTONCES el sistema DEBE avisarme y usar la cuenta proporcionada por NOKKO para no detener el trabajo (decidido por Fede) e indicarlo en el estado de la conexión.
- CA-14: El sistema DEBE aplicar el presupuesto y las pausas automáticas de la empresa y descontar de él el uso de la cuenta de NOKKO cuando actúe como respaldo (decidido por Fede).

### H-5: Como founder, quiero llegar a conectar desde donde estoy.
- CA-15: CUANDO un paso del onboarding o de la guía necesita una conexión que no tengo, el sistema DEBE ofrecer conectarla sin salir del flujo.
- CA-16: CUANDO la conexión se completa, el sistema DEBE devolverme al paso donde estaba.

## 8. Casos límite y errores
- Credencial caducada o revocada por el proveedor: estado Error con aviso, y no perder lo importado (CA-1, CA-8).
- Cuenta ya conectada en otra empresa: informar y pedir confirmación (CA-5).
- Varios miembros intentan conectar a la vez: la última conexión confirmada manda y se avisa al resto (CA-10).
- Proveedor caído: no marcar como desconectada; mostrar «Sin respuesta» y reintentar (CA-1).
- Owner que deja la empresa: las conexiones quedan de la empresa, no de la persona (CA-2).
- Conector no disponible para cuenta propia: mostrar «Solo proporcionada por NOKKO» (CA-1).
- Rol sin permiso: ver CA-11.

## 9. Experiencia y copy
Tarjeta: nombre, para qué sirve, estado con palabra y botón «Conectar mi cuenta» o «Cambiar». Texto: «Usa tu propia cuenta de *Proveedor*. NOKKO solo hará lo que se indica aquí.» En «tú», sin iconos.

## 10. Datos, permisos y privacidad
- Se guardan credenciales y metadatos de conexión por empresa; solo el sistema las usa.
- Solo roles autorizados gestionan; todos los miembros ven el estado (decisión de Fede sobre qué roles).
- Datos de terceros leídos mediante la cuenta se guardan en la empresa con su origen.
- LinkedIn: solo API oficial; no se conectan cuentas de LinkedIn para extraer datos fuera de ella.

## 11. Unidades de trabajo
- U-1: Vista de estado y estructura común de conexión (H-1, H-3).
- U-2: Conectar, comprobar y desconectar (H-2).
- U-3: Google Drive como primer proveedor (SDD de Drive).
- U-4: Proveedores de datos con cuenta propia: Apollo, Clay, Parallel, Perplexity y Firecrawl primero; la estructura debe admitir cualquier proveedor disponible o nuevo sin rediseñar (H-2, H-4).
- U-5: Uso, respaldo y presupuesto (H-4).
- U-6: Conectar desde onboarding y guía (H-5).

## 12. Notas técnicas [Sugerencia — se valida en la implementación]
- Código: `src/routes/_authenticated/integrations.tsx` (lista `WORKING`/`NOT_YET`), `src/components/stripe-panel.tsx` y `posthog-panel.tsx` (patrón existente), `src/components/orchestrator/budget-panel.tsx`, `src/lib/orchestrator/planner.ts` (servicios y coste), `src/lib/google-drive.ts`.
- El orquestador ya recibe qué servicios están conectados: se puede alimentar con las conexiones de la empresa.
- Almacenamiento de credenciales cifradas por empresa (diseño: lo propone Claude Code y lo aprueba Fede).
- **Uso de LLM:** ninguno. Comprobación de credenciales y estados son deterministas.

## 13. Riesgos y dependencias
- Seguridad: credenciales de terceros por empresa.
- Coste: cuentas propias sin presupuesto compartido pueden confundir el control de gasto.
- Algunos proveedores no ofrecen cuenta propia: se declara en CA-1.
- Depende del SDD de Drive (primer caso) y del universal (origen).

## 14. Decisiones abiertas (recomendación de Claude)
Las resuelve Claude Code comprobándolas en el código; lo que no pueda comprobar lo decide Fede con la recomendación de Claude. No hay revisor técnico externo.
1. ¿Qué proveedores aceptan hoy una clave por empresa sin cambios?
2. ¿Dónde guardar credenciales de forma segura en el stack actual?
3. ¿El orquestador puede elegir cuenta propia o compartida por empresa?

## 15. Pendiente de verificar
- [Por verificar] Proveedores con soporte de clave por empresa.
- [Por verificar] Qué hacen hoy los paneles de Stripe y PostHog con sus credenciales.
- [Por verificar] Estado en `production` (solo se leyó `main`).

## 16. Registro de decisiones (lo completa Fede)
- Decisiones tomadas:
- Fecha:
- Decisión: Aceptado / Cambios pedidos / Rechazado

---
Validación: OK (autorrevisión). Auditoría: solo linter; la independiente queda pendiente.
