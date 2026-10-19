# GTM Brain: onboarding sin fricción, motor proactivo y agente (app + Telegram)

Lo construimos en tres fases. Cada una se puede usar por sí sola.

## Fase 1 — Onboarding con IA + agente en la app

**Onboarding en 3 vías (eliges la que quieras y puedes combinarlas)**
1. **Lo rellena la IA**: pegas la web de la empresa y/o subes documentos (PDF, deck, notas). La IA propone segmentos, ICP y anti-ICP, posicionamiento (Dunford), pilares, personas y moneda. Tú revisas cada propuesta con «Aceptar / Editar / Descartar».
2. **Entrevista con el agente**: una conversación guiada que pregunta solo lo que falta y lo va guardando.
3. **Asistente paso a paso**: formulario por bloques con valores sugeridos ya precargados.

Las tres vías escriben en el mismo sitio, con la misma lista de datos. Así, si añadimos un campo nuevo, aparece solo en las tres.

**Indicador de completitud** en Inicio y en cada página («Tu estrategia está al 62 %»). Muestra lo siguiente que falta y lo que desbloquea: por ejemplo, «Añade la cuota para activar la cobertura».

**Agente GTM (en la app)**
- Panel de chat siempre disponible (atajo de teclado + botón).
- **Consultar**: pipeline, métricas, funnel self-service, cuentas, stakeholders, conocimiento, Theory U.
- **Ejecutar**: crear o actualizar deals, cuentas, stakeholders, reuniones y tareas; mover etapas; registrar trials; crear prototipos; lanzar el Asesor GTM.
- Toda acción que cambie datos se muestra como **tarjeta de confirmación** («Voy a mover Acme a Propuesta · Confirmar / Cancelar»). Respeta los roles: lo que tú no puedes hacer, el agente tampoco.
- Las conversaciones se guardan por usuario y empresa.

## Fase 2 — Motor proactivo («sugiere, tú apruebas»)

- **Detectores** que se ejecutan cada hora y al guardar datos. Por ejemplo: deal sin actividad, fecha de cierre pasada, cobertura < 3x, MEDDPICC incompleto en etapas avanzadas, reunión mañana sin Call Prep, Account Plan sin stakeholder decisor, segmento con mala conversión de prueba a pago, datos de onboarding pendientes, registros de partners a punto de caducar (90 días).
- Cada detección genera una **sugerencia** con la acción ya preparada. Ejemplos: borrador del Call Prep, tarea creada, email redactado, recordatorio de cuota.
- **Bandeja de sugerencias** en la app, más un **resumen diario** en Inicio: «3 cosas que hacer hoy». Puedes aprobar, posponer o descartar cada sugerencia. Si descartas algo, deja de sugerirse.
- Nada se cambia sin tu aprobación.

## Fase 3 — Telegram

- En Equipo: «Conectar Telegram». Recibes un enlace o código para vincular tu cuenta con el bot (una persona = un usuario de la app, con sus permisos y su empresa activa).
- Desde Telegram puedes hablar con el **mismo agente** (mismas capacidades y mismas confirmaciones, con botones Sí/No). También recibes el resumen diario y las sugerencias urgentes, y puedes aprobarlas desde allí.
- WhatsApp queda preparado para más adelante: el agente no depende del canal.

## Qué necesitaremos de ti
- Fase 3: crear un bot en Telegram (@BotFather) y conectarlo cuando lleguemos. Te guiaré.
- Uso de IA: cada análisis y cada mensaje del agente consume créditos de IA del workspace.

---

## Detalles técnicos

**Mantenibilidad (núcleo común)**
- `src/lib/setup-schema.ts`: definición declarativa de los datos de onboarding (campo, tabla, peso, validación, dependencia «desbloquea X»). La usan el asistente, la entrevista, la extracción IA y el % de completitud. Pura y testeada.
- `src/lib/agent/tools/*`: un archivo por herramienta (nombre, descripción, esquema zod, `kind: read|write`, roles permitidos, handler). Un único registro alimenta el chat de la app, Telegram y el motor proactivo.
- `src/lib/proactive/detectors/*`: un detector puro por archivo `(snapshot) => Suggestion[]`, testeado; añadir una regla = añadir un archivo.

**Datos (migraciones, RLS por org)**
- `onboarding_drafts` (propuestas IA pendientes de revisión, por campo).
- `agent_conversations`, `agent_messages` (por usuario + org; canal app/telegram).
- `agent_pending_actions` (acción de escritura propuesta, payload, estado; se ejecuta solo al confirmar).
- `suggestions` (detector, entidad, prioridad, acción preparada, estado pending/approved/snoozed/dismissed, clave de deduplicación).
- `channel_links` (user_id, canal, chat_id, código de vinculación con caducidad).

**IA**
- Agente con AI SDK (`@ai-sdk/openai` `.responses`) por Lovable AI Gateway, modelo `openai/gpt-6-astra`, streaming, tool calling. Las herramientas de escritura no ejecutan nada: crean una `agent_pending_action`, y la confirmación del usuario la ejecuta con su sesión (RLS como el usuario).
- Extracción de onboarding: lectura de la web en el servidor + documentos subidos → salida con JSON schema estricto mapeado a `setup-schema`.
- Las llamadas IA existentes en `ai.functions.ts` no se tocan.

**Motor proactivo**
- Ruta `/api/public/jobs/proactive` con `authenticateCronRequest` y un schedule HTTP cada hora. Recorre las orgs, construye un snapshot y ejecuta los detectores; inserta las sugerencias con upsert por clave de deduplicación.
- El resumen diario se genera a partir de las sugerencias abiertas.

**Telegram**
- Connector de Telegram vía gateway; webhook `/api/public/telegram/webhook` verificado con secret token; registro de updates idempotente por `update_id`.
- Vinculación con un código de un solo uso generado en Equipo. El webhook resuelve el usuario por `channel_links` y ejecuta el agente con los permisos de ese usuario (cliente de servidor acotado a su user_id/org; las confirmaciones son botones inline).

**Tests**: setup-schema (completitud/desbloqueos), registro de herramientas (permisos por rol), cada detector, flujo de pending action (no se escribe sin confirmación).
