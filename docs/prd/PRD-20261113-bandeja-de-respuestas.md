# PRD-20261113-bandeja-de-respuestas · [Iniciativa] Bandeja de respuestas

**Tipo:** Iniciativa · **Prioridad propuesta:** Media (reutiliza voz y reglas de NK-0128, sugerencias, trabajos en segundo plano y el cifrado de claves que ya existen, y desbloquea un play del catálogo; pero es el punto del backlog que más datos personales toca, y una parte de su coste no es de ingeniería sino de verificación con Google y Microsoft; sin datos de uso, es una apuesta declarada)
**Estado:** Borrador · **Pide:** Fede (entrevistas, 2026-11-12 y 2026-11-13) · **Aprueba:** Fede · **Fecha:** 2026-11-13
**Ticket:** NK-0174 (LOGGED, `.factory/ledger.json`, registrado el 2026-11-12)
**SDD que lo desarrollan:** pendientes (sección 8): cuatro en el primer tramo (conexión, ingesta, clasificación y borradores, pantalla y play) y uno después (Outlook)
**Sprint:** sin decidir
**Base de lectura:** `origin/main` @ `36b4b1b` (2026-11-13), solo lectura

> Un PRD dice qué se quiere y por qué. No dice cómo se construye ni cómo se prueba: eso es del SDD.

## Resumen para aprobar (Fede)
- **Qué es:** cada persona de tu equipo conecta su Gmail u Outlook (tu decisión del 2026-11-13). NOKKO lee **solo** las respuestas a sus propios correos de venta, las clasifica, y para cada una **propone** una acción y un borrador con la voz y las reglas de la empresa (NK-0128). **Nunca envía y nunca cambia una etapa sola.** Desbloquea el play `automated-reply-enrichment`.
- **Lo que recomiendo (6.3):** leer solo mensajes cuyo remitente sea un contacto que NOKKO ya conoce y que estén en un hilo donde la persona escribió primero; permiso `gmail.readonly`; **no guardar el texto de la respuesta** (se muestra leyéndolo en el momento desde su propio correo); conexión **por persona**, y las respuestas las ve solo esa persona. Cada alternativa más estrecha y lo que pierde está en 6.3.
- **Lo que debes saber antes de aprobar (7.2):** esto es distinto de todo lo anterior. Leer un buzón da acceso técnico a correspondencia personal, y las respuestas contienen datos de terceros que no han dado su consentimiento a NOKKO. Para el PRD de plays aceptaste «sin acción legal por ahora»; aquí te propongo no heredar esa decisión sin que la tomes de nuevo. Es tuya.
- **Decisiones que te pido (7.3):** cuatro preguntas con mi recomendación: Gmail primero o los dos, diseño de lectura, plazo de retención y tratamiento legal.
- **Lo que no sé:** el coste y el plazo de la verificación de Google y de Microsoft, y qué proveedor de correo usa tu equipo. Son [Por verificar] (7.1).

## 1. Problema
NOKKO prepara y ordena la venta, pero otras herramientas envían los correos (decisión de posicionamiento, Fede, 2026-11-12: «NOKKO no construye un motor de envío; decide y prepara»). Cuando un contacto responde, esa respuesta llega al buzón de quien envió y **NOKKO no se entera**: el lead sigue en «Contactado» y la secuencia de seguimiento sigue proponiendo el día 3, 7 y 14 como si nadie hubiera contestado. Quien vende tiene que leer, clasificar a ojo (interesado, fuera de oficina, rebote, baja…), decidir y redactar sin el contexto ni la voz de la empresa.

## 2. Para quién
- **Quien envía outreach** (cualquier miembro con leads, normalmente Sales Rep o Sales Leader): conecta su propio buzón, ve sus respuestas y decide.
- **Owner:** activa la función para la empresa y ve **quién** la ha conectado y su estado; no ve el contenido de las respuestas de otros (6.2, P-3).
- Fase 1: solo la organización de Fede (uso interno). Abrirlo a empresas cliente exige la decisión legal de 7.3 y, probablemente, la verificación de Google y Microsoft (7.2). No se afirma que vaya a abrirse.

## 3. Evidencia y por qué ahora
Fuentes: código y documentos de `main` @ `36b4b1b` (leídos el 2026-11-13, solo lectura); entrevistas de Fede del 2026-11-12 y 2026-11-13; análisis de las funciones públicas de Glider (bandeja unificada de respuestas con clasificación por IA y borradores «en tu voz»), registrado como origen del ticket. **Es texto de marketing, sin verificar; no he revisado su página ni se afirma que funcione.** Sin datos de uso: todas las líneas base son «sin dato».

**Lo que NOKKO ya tiene y lo que falta**
| Necesidad | Ya existe | Falta |
|---|---|---|
| Play que lo pide | `automated-reply-enrichment`: `status: "bloqueado"`, `blockedBy: "fuente_externa"`, `needs: ["Bandeja de respuestas entrantes"]`, `detectors: []`, `sdd: 8` (`src/lib/plays/catalog.ts:404-416`). El texto del bloqueo dice «falta una fuente externa» (`src/lib/plays/status.ts:30-33`) | La fuente. Hoy el play no puede activarse (`status.ts:46-50`) |
| Recibir correo | Nada. `email.server.ts` es solo de **salida**: Resend por la pasarela de conectores, remitente `avisos@nokko.ai` (`src/lib/email.server.ts:1-4,12,39-70`). Las rutas públicas son leads, cuentas, Apollo, Inngest, trabajos y Telegram (`src/routes/api/public/`). No hay código de Gmail ni de Outlook; Conexiones lo lista como «aún no construido: Google Calendar y Gmail» (`src/routes/_authenticated/integrations.tsx:111-116`) | Todo |
| Conexión de Google | **Una sola** conexión de Drive, la del constructor, compartida por todas las empresas, por pasarela de conectores y con permisos `drive.readonly` + `drive.file` (`src/lib/AGENTS.md:30`; `src/lib/google-drive.ts:1-5`). El acceso con Google de la app es solo para iniciar sesión (`src/integrations/lovable/index.ts`) | Un permiso de **buzón**, por persona, con cliente OAuth propio. No encaja en la conexión compartida de Drive |
| Conexiones por cuenta propia | `SDD-20261025-connections-bring-your-own-account.md` (En curso; el PR #32 se cerró sin fusionar, y en `main` no hay `connections-core`). Conexiones hoy: paneles de Stripe y PostHog que gestiona solo el Owner (`integrations.tsx:121,201`). El SDD fija «solo el Owner gestiona» (CA-11) y llama a Gmail «aún no» (§5) | Un tipo de conexión **personal**. Contradice CA-11: requiere enmienda (sección 7) |
| Guardar un secreto | `seal`/`open`: AES-GCM con una clave derivada de `INTEGRATION_KEYS_SECRET` (`src/lib/secret-box.server.ts:1-23`); PostHog guarda `api_key_enc` y solo concede al navegador las columnas no secretas (`drizzle/migrations/0035_posthog_product_data.sql:3-24`; `src/lib/AGENTS.md:32`) | Los tokens de un buzón son mucho más sensibles que una clave de lectura de PostHog y hoy comparten la **misma única clave** sin rotación ni versión más allá de `v1` |
| Voz y reglas (NK-0128, SHIPPED) | `loadVoice` (hasta 3 mensajes del equipo, cada uno cortado a `VOICE_MAX_CHARS`; `src/lib/knowledge-voice.ts:10-12,49-76`) y `loadAgentRules` + `rulesBlock` con la regla «Escalar» (`src/lib/knowledge-rules.ts:143-170,180-205`). `draft_followup` ya los usa y **nunca envía** (`src/lib/agent/tools/core-read.ts:513-590`) | Un borrador de **respuesta** (hoy solo hay seguimientos) |
| Secuencia de seguimiento | `followupStatus` mira solo la etapa y `contacted_at`; corre mientras el lead está en «Contactado» (`src/lib/followup.ts:36-50`); el detector emite una sugerencia por lead y paso (`src/lib/proactive/detectors/followup-sequence.ts`) | Saber que el lead **respondió**: hoy no hay ningún campo ni regla para eso |
| Sugerencias y avisos | `suggestions` con `action`, `user_id`; las ve quien es dueño o sin asignar, y Owner y Sales Leader **todas** (`src/lib/suggestion-board.ts:7`); el mensaje urgente de Telegram manda `título + cuerpo` (`src/lib/telegram-suggestions.ts:17-30`) | Cuidar que una sugerencia de respuesta **no lleve texto de la respuesta**, porque el cuerpo llega a líderes y a Telegram |
| Trabajos y cron | `JOB_KINDS` (`src/lib/inngest/events.ts:31-36`); cron horario con arrendamiento en `job_locks` (`src/routes/api/public/jobs/proactive.ts:10-30`); trabajos con roles del lanzador (`src/lib/AGENTS.md:48`) | Un tipo de trabajo de lectura de buzón |
| Emparejar con leads y contactos | `likeness` da 100 si coincide el correo **o el dominio** (`src/lib/match.ts:49-60`); `findMatches`: ≥95 «igual», ≥70 «parecido» (`:72-84`); la entrada de leads busca por correo con `ilike` y toma el más reciente (`src/lib/leads-ingest.ts:23-29,57-62`); webmail no identifica empresa (`src/lib/free-mail.ts`). Correo en `leads`, `people` y `stakeholders` (`src/integrations/supabase/types.ts`) | Una regla de emparejado **solo por correo exacto** (6.5) |
| «No contactar» | No he encontrado ningún campo ni regla de baja o supresión en `src/` ni en `drizzle/` [Por verificar] | Una marca de «no contactar» para el caso «baja» (6.5) |
| Coste de IA | `ask()` no registra tokens ni coste (`src/lib/ai-gateway.ts:43-48`); `integration_usage` no tiene columna de tokens (`types.ts:2508-2518`) | Registro de coste por respuesta (G-6) |

**Por qué ahora:** NK-0128 (voz y reglas) ya está entregado, y este es el primer uso real de la voz fuera del seguimiento. Además la secuencia de seguimiento hoy se equivoca con quien ya respondió. **Apuesta declarada:** sin datos de uso, se mide tras el lanzamiento.

## 4. Objetivos
| ID | Objetivo | Cómo se mide | Línea base | Fuente |
|---|---|---|---|---|
| G-1 | Que cada respuesta de un contacto conocido llegue clasificada a quien la envió, con una acción propuesta | Respuestas clasificadas por empresa y periodo | Sin dato (no existe) | Base de datos, tras el lanzamiento |
| G-2 | Que los borradores sean útiles | Borradores usados, editados y descartados; y clasificaciones que la persona **corrige** (señal de error del clasificador) | Sin dato | Base de datos. «Usado» significa que la persona pulsó «usar», **no** que se enviara: NOKKO no envía y no puede saberlo |
| G-3 | Que se decida antes | Tiempo entre la fecha del mensaje (la del proveedor) y la decisión de la persona | Sin dato | Base de datos. Incluye el retraso de la lectura; se informa aparte |
| G-4 | Que NOKKO nunca envíe ni cambie una etapa o un dato por su cuenta | Envíos hechos por NOKKO; cambios de lead, persona o deal sin confirmación | Sin dato; se verifica por prueba: debe ser 0 | Pruebas automáticas (no se pide permiso de envío; ninguna ruta de clasificación escribe en leads) |
| G-5 | Mínimo acceso y mínimo rastro | Consultas al buzón sin filtro de contactos conocidos; texto de respuestas guardado o escrito en logs; tokens leídos desde el navegador; filas que sobreviven a desconectar | Sin dato; se verifica por prueba: debe ser 0 | Pruebas automáticas y revisión del gate |
| G-6 | Que cada respuesta procesada deje su coste de IA, para decidir un tope con datos | Registros de coste por empresa; tokens y coste medido cuando el proveedor los devuelve, «sin dato» cuando no. Solo registrar: un fallo del registro no bloquea | Sin dato: hoy no se mide (sección 3) | Registro nuevo, instrumentado en el SDD 3 |
| G-7 | Desbloquear `automated-reply-enrichment` sin prometer más de lo construido | Estado del play en el catálogo y su texto | `bloqueado` / `fuente_externa` (`catalog.ts:408-409`) | Código; prueba del catálogo |

Nunca hay línea base estimada. G-4 y G-5 son invariantes: se prueban, no se miden con datos de uso. G-6 es de instrumentación.

## 5. No-objetivos
- **Enviar.** Ni un correo, ni una respuesta, ni un borrador en la carpeta de borradores del buzón. No se pide ningún permiso de escritura ni de envío al proveedor.
- Leer correo que no sea una respuesta de un contacto conocido: ni el resto del buzón, ni buscar en él, ni «ver qué hay».
- Calendario (proponer o leer horas de reunión): fuera.
- Sincronizar con un CRM externo: fuera.
- Cambiar una etapa, descalificar un lead, crear una persona o mover un deal **sin confirmación**: siempre sugerencia.
- Mostrar a otro miembro, a un líder o a un asistente externo (MCP) el contenido de las respuestas de alguien.
- Hacer `reply-to`, seguimiento automático, secuencias nuevas o «autopiloto de respuestas».
- Analizar o puntuar a la persona que responde (regla 5 de la organización sobre perfiles; aquí tampoco hay perfil).
- Leer correos de cuentas que no sean Gmail u Outlook, o el reenvío a una dirección de NOKKO y el webhook de una herramienta de envío: descartados por Fede (6.1).
- Resolver la decisión legal (7.2): este PRD la expone y propone; no la toma.

## 6. Decisiones tomadas y abiertas
### 6.1 Decididas por Fede
| # | Tema | Decisión (literal o fiel) | Fecha |
|---|---|---|---|
| 1 | Cómo entran las respuestas | **Conectando Gmail u Outlook** (lectura del buzón por OAuth). Elegido frente a una dirección de reenvío y frente a un webhook de la herramienta de envío | 2026-11-13 |
| 2 | Posicionamiento | NOKKO no construye un motor de envío; decide y prepara, otras herramientas envían | 2026-11-12 |
| 3 | Alcance del ticket | Clasificar cada respuesta, proponer un borrador en la voz de la empresa (NK-0128) y desbloquear `automated-reply-enrichment`; nunca envía (título de NK-0174) | 2026-11-12 |
| 4 | Legal en el PRD de plays | «Sin acción legal por ahora» (PRD plays a medida, decisión 14). **No se hereda aquí:** ver 7.2 y Q-4 | 2026-11-12 |

### 6.2 Propuestas del coordinador (tú las confirmas o las cambias al aprobar)
| # | Tema | Propuesta | Por qué |
|---|---|---|---|
| P-1 | Permiso mínimo | `gmail.readonly` y su equivalente de Outlook (`Mail.Read`) **[Por verificar]**; nunca permisos de envío, modificación o borrado. Ver 6.3 para por qué no basta el permiso de solo metadatos | Es lo mínimo que permite buscar por remitente y leer el cuerpo para clasificar |
| P-2 | Lectura estrecha | Leer solo lo de 6.3 (contacto conocido + hilo iniciado por la persona), con un modo aún más estrecho opcional por etiqueta | Reduce lo que NOKKO procesa; **no** reduce lo que el token podría leer (6.3) |
| P-3 | Conexión y visibilidad | **Por persona y por empresa** (una persona en dos empresas conecta dos veces; cada una solo empareja con los leads de esa empresa). Las respuestas y borradores los ve **solo quien conectó**, sin excepción para Owner ni Sales Leader. El Owner ve una lista de quién conectó, proveedor, desde cuándo y estado, y puede **cortar** una conexión, no leerla | El buzón es personal; la regla de sugerencias (los líderes lo ven todo, `suggestion-board.ts:7`) no se puede aplicar a estas filas |
| P-4 | Qué se guarda | Sin texto de la respuesta (6.4) | Lo que no se guarda no se filtra ni se borra mal |
| P-5 | Interruptor de empresa | Apagada por defecto; la enciende el Owner y cada persona conecta por voluntad propia | Doble consentimiento interno |
| P-6 | Clasificación y acciones | Ocho clases cerradas, el código decide la acción, todo es sugerencia (6.5) | Regla de AGENTS.md: la IA propone, el código valida y ordena |
| P-7 | Nombre | La pantalla se llama «Respuestas», no «Bandeja»: `/inbox` ya es «Sugerencias» y su búsqueda ya usa la palabra «bandeja» (`src/lib/nav.ts:19`) | Evita dos «bandejas» |
| P-8 | Primera fase | Solo la organización de Fede, con el cliente OAuth en modo interno o de pruebas si el proveedor lo permite **[Por verificar]** | Permite medir y revisar la parte legal antes de abrirlo |

### 6.3 Qué se lee del buzón: de lo más ancho a lo más estrecho
Un hecho técnico que condiciona todo: **un permiso OAuth de Gmail u Outlook no se puede limitar a una etiqueta ni a unos remitentes** [Por verificar contra la documentación de cada proveedor]. Con `gmail.readonly` el token **podría** leer todo el buzón; la restricción la pone el código de NOKKO. Por eso cada diseño estrecho limita lo que NOKKO **procesa y guarda**, no lo que un fallo o una filtración del token expondría. Eso lo compensa el cifrado del token (6.4) y una prueba que impida cualquier consulta sin filtro (G-5).

| Diseño | Qué lee NOKKO | Qué pierde | Veredicto |
|---|---|---|---|
| A. Todo el buzón | Todo lo recibido | Nada | **Descartado**: lee correspondencia personal sin motivo |
| B. Contactos conocidos + hilo propio | Solo mensajes recibidos de un correo exacto que esté en `leads`, `people` o `stakeholders` de la empresa **y** en un hilo donde la persona envió un mensaje antes. NOKKO construye la búsqueda con esas direcciones; el resto del buzón no se lista ni se lee | Respuestas de otra dirección (un compañero, un alias, un reenvío); los rebotes, que llegan de `mailer-daemon` y no del contacto (su detección en el hilo es [Por verificar]); contactos que la persona aún no ha dado de alta en NOKKO; la herramienta de envío que no guarde el mensaje en el buzón de la persona | **Recomendado** |
| C. B + etiqueta | Además, solo hilos con una etiqueta (Gmail) o categoría/carpeta (Outlook) que la persona aplica, a mano o con su propio filtro | Todo lo que la persona no etiquete; exige configuración y disciplina | Modo opcional, **más estrecho**, por persona. Si Fede quiere la mínima huella desde el primer día, es el predeterminado (Q-2) |
| D. Solo cabeceras (`gmail.metadata` / `Mail.ReadBasic`) | Remitente, asunto, fechas, etiquetas. No el cuerpo, y en Gmail **no admite búsqueda** [Por verificar] | Casi todo: sin el cuerpo no se distingue «interesado» de «no interesado» ni se puede redactar. Solo rebote y fuera de oficina se detectan por cabeceras (`Auto-Submitted`, `mailer-daemon`; [Por verificar]) | **Insuficiente** para el producto; sirve de fallback de rebotes y como argumento de verificación |

**Recomendación:** B por defecto con `gmail.readonly`, y C como opción de quien quiera más estrecho. Fede decide si C es el predeterminado (Q-2).

### 6.4 Conexión, tokens y qué se guarda
**Tokens.** Cifrados con el mismo `seal`/`open` (`secret-box.server.ts`) y las mismas reglas de PostHog: columna `*_enc`, concesión de columnas que oculta el secreto al navegador, lectura solo en funciones de servidor y trabajos (`AGENTS.md`, regla del `.env`: nunca secretos en variables `VITE_`). **Recomiendo una clave propia para buzones** distinta de `INTEGRATION_KEYS_SECRET`, porque hoy una sola clave protege todas las integraciones y su filtración abriría los buzones; el SDD 1 decide. Se guarda el token de refresco cifrado; el de acceso, de vida corta, no se guarda o se guarda cifrado con su caducidad.

**Desconectar** (la persona, o el Owner para cortar): revocar el token en el proveedor, borrar el token cifrado y **borrar todas las filas de esa conexión** (identificadores, clasificaciones, borradores). Para no perder la medición, solo sobreviven **contadores agregados por empresa y día, sin identificadores ni texto** (propuesta, Q-3). También se borra al salir la persona de la empresa y al borrar la empresa.

**Por cada respuesta** se guarda: `org_id`, el usuario del buzón, proveedor, id del mensaje y del hilo, fecha del proveedor, id del lead o persona emparejado, clase y confianza, estado y decisión con su fecha. Y mientras esté pendiente de decidir: el borrador y los campos extraídos (6.5). **No se guarda:** el cuerpo, un extracto, el asunto, la dirección del remitente (ya está en el lead o la persona), adjuntos ni firmas. Para juzgar un borrador, la persona ve la respuesta **leída en ese momento** desde su propio buzón con su token (y un enlace «Abrir en Gmail» por el id del hilo). Coste: si el token caduca o la persona borró el correo, no se ve; no hay búsqueda de texto completo; y no se puede auditar la calidad del clasificador con textos (para eso están las correcciones de G-2).

**Retención.** Borrador y campos extraídos: se borran al decidir (usar, editar o descartar). Filas de identificadores: mientras exista la conexión, sin plazo numérico decidido (Q-3); se borran también **a petición** de la persona y al desconectar. **Alcance del borrado:** las copias derivadas (sugerencia o tarea creada, mensaje en `agent_messages`, `agent_pending_actions.args`) se rastrean por el id de la respuesta; el motor no escribe texto de la respuesta en ellas. Lo que no se pueda rastrear, o ya salió de NOKKO (un correo enviado desde otra herramienta), no queda cubierto y se dice. Nunca en logs: solo `safeErrorLog` y etiquetas fijas (`src/lib/agent/safe-error-log.ts:1-8`), como la voz y las reglas.

**Quién puede leer qué, de verdad.** Con RLS por `org_id` **y** `user_id = auth.uid()`, sin excepción de líder. Las rutas con cliente privilegiado (cron, Telegram, asistente) filtran por `org_id` y por usuario en código (`src/lib/AGENTS.md:7`). Lo que no se puede evitar y se dice: quien tenga acceso a la base de datos o a la clave de cifrado puede leer los tokens y las filas; por eso el diseño guarda lo mínimo.

**Fuera de NOKKO.** Para clasificar y redactar, el texto de la respuesta se envía al proveedor de IA de la cadena (`src/lib/AGENTS.md:38`: OpenRouter, Gemini u otros). Es un **encargado de tratamiento más** con datos de terceros; hay que fijar cuál y bajo qué condiciones (7.2).

### 6.5 Clasificación, emparejado y qué propone cada clase
**Emparejado.** Solo por **correo exacto** (sin mayúsculas) dentro de la empresa de la conexión, contra `leads`, `people` y `stakeholders`. No se usa el dominio (`likeness` da 100 por dominio, `match.ts:53`), ni nunca en dominios de webmail (`free-mail.ts`). Si el correo coincide con varios leads abiertos, no se vincula ninguno y se piden candidatos (hoy la entrada de leads toma el más reciente, `leads-ingest.ts:29`; aquí un error vincularía una respuesta a la persona equivocada). **Nunca se fusiona, ni se crea persona sin confirmación** (regla de `AGENTS.md`: «link by id, warn before creating a near-duplicate, never merge»).

**Clases (cerradas):** interesado, pide más información, fuera de oficina, no es la persona, no interesado, baja, rebote, otro. Se mantienen las ocho que pediste porque cada una lleva una acción distinta y ninguna se confunde con otra en lo que se hace después: «baja» y «no interesado» se separan porque la primera tiene consecuencia legal y de «no contactar»; «otro» es la salida segura cuando la confianza es baja.

**Quién decide.** La IA devuelve un objeto con esquema estricto: clase, confianza y los pocos campos de la tabla. El código valida: una clase fuera de la lista pasa a «otro»; una fecha de vuelta debe ser futura y estar en una ventana razonable; un correo extraído debe aparecer en el texto y tener forma válida; cualquier campo inválido se descarta. Las cabeceras mandan sobre la IA cuando dicen un hecho (rebote por `mailer-daemon`, respuesta automática). **La llamada de IA no tiene herramientas**: la respuesta es texto no fiable (puede traer instrucciones) y solo puede producir ese objeto y un borrador.

| Clase | Qué propone NOKKO (siempre sugerencia que confirma una persona) | Campos extraídos |
|---|---|---|
| Interesado | Responder con borrador; proponer mover el lead de etapa; pausar la secuencia de seguimiento | Ninguno |
| Pide más información | Responder con borrador apoyado en posicionamiento y pilares; sin inventar datos | Ninguno |
| Fuera de oficina | No redactar. Proponer posponer el siguiente paso (`next_step_at`) hasta la fecha de vuelta | Fecha de vuelta, validada |
| No es la persona | Proponer a quién dirigirse. Es el caso de «enriquecimiento» del play (6.7) | Nombre y correo de la persona indicada, solo si aparecen en el texto |
| No interesado | Proponer descalificar el lead con su motivo; borrador de cierre opcional | Ninguno |
| Baja | **Prioridad alta.** Proponer marcar «no contactar» y parar la secuencia. Regla «Escalar ante una queja, un asunto legal o una baja» (`default-rules.ts:42`) si la empresa la tiene | Ninguno |
| Rebote | Proponer marcar el correo como inválido y parar la secuencia. Sin borrador | Ninguno |
| Otro | Mostrar a la persona sin acción propuesta | Ninguno |

Hoy **no existe** una marca de «no contactar» (sección 3, [Por verificar]): el SDD 2 debe decidir dónde vive (cambio de esquema) y cómo la leen el detector de seguimiento y el resto. NOKKO no envía, así que la baja se cumple dejando de proponer contacto y avisando a la persona de que **su herramienta de envío** debe darla de baja; NOKKO no puede garantizarlo.

**La secuencia de seguimiento.** Una regla pura nueva: si un lead tiene una respuesta vinculada y sin decidir, o de clase distinta de «fuera de oficina» y «otro», el detector deja de proponer el siguiente paso (`followup-sequence.ts`). Solo suprime una sugerencia; no cambia datos. No cubre a quien responda desde una dirección que NOKKO no conoce (6.3).

### 6.6 El borrador en la voz de la empresa
Como `draft_followup` (`core-read.ts:541-577`): `loadAgentRules` y `loadVoice` (los lectores de NK-0128), `rulesBlock` y `VOICE_FORM_RULE`; la voz va como dato, nunca como instrucción de sistema, y copia la forma, no el contenido. Las reglas Nunca/Siempre aplican. Como se redacta **en un trabajo, sin nadie delante**, se usa `withPerson: false`: si se cumple una regla «Escalar», el resultado empieza por «Necesita a una persona: <condición>» (`knowledge-rules.ts:143-147`) y el código lo detecta: no se muestra borrador, solo el aviso (por ejemplo, precio o condiciones, o una baja). Si falla la lectura de reglas o de voz, el borrador lo dice (`RULES_READ_FAILED`, `VOICE_READ_FAILED`) y no se trata como «sin reglas». Una empresa **sin reglas** no tiene ese freno: se avisa. Idioma del borrador: el de la respuesta [propuesta, a confirmar en el SDD 3]. El borrador es texto en pantalla que la persona copia o edita; **no se escribe en su buzón**.

### 6.7 Desbloqueo del play y lo que sigue bloqueado
- `automated-reply-enrichment` deja `bloqueado`/`fuente_externa`. Como `catalog.test.ts:98-104` exige que un play bloqueado declare su bloqueo y que uno no bloqueado no lo declare, y `:123-127` que un play con detector sea `parcial`, el SDD 4 lo pasa a `parcial` con un detector de respuestas y actualiza ambas pruebas y el texto. `defaultEnabled` se calcula como «tiene detectores» (`catalog.ts:80`): el SDD 4 comprueba qué implica para `play_states` [Por verificar].
- **Qué hace el play:** el catálogo solo da el título y la necesidad (`catalog.ts:405,410`); su definición operativa es la de 6.5: respuesta clasificada, y para «no es la persona» una **propuesta** de contacto nuevo. No se extraen teléfonos, cargos ni firmas (datos de terceros no necesarios).
- **Sigue bloqueado o fuera:** el envío (el PRD de plays lista «Envío con Resend» entre sus necesidades, `PRD-20261106-plays-gtm.md:54`; NOKKO no envía); cualquier enriquecimiento con proveedor externo (Apollo, Clay); el resto de plays `fuente_externa` y `proveedor_datos`.

### 6.8 Coste
Cada respuesta puede costar hasta dos llamadas de IA: una de clasificación y, solo en las clases con borrador, otra de redacción. Rebotes y respuestas automáticas detectadas por cabecera no necesitan IA. **No se afirma ningún coste ni tope.** Como en el PRD de plays a medida (G-7): se registra por empresa y por respuesta, solo registrar, sin freno; el gasto de IA hoy no entra en `org_budgets`. El registro compartido de coste lo define quien llegue primero: si el SDD de plays a medida ya existe, se reutiliza; si no, el SDD 3 lo crea y plays lo adopta (dependencia, 7).

## 7. Riesgos y dependencias
### 7.1 Lo que NO se afirma
- No se afirma que Glider funcione ni que sus clasificaciones o borradores sean buenos: son textos de marketing.
- No se afirma ninguna tasa de acierto del clasificador ni calidad del borrador: sin datos.
- No se afirma que los plazos y costes de la **verificación de Google** (`gmail.readonly` es un permiso restringido; suele exigir verificación de la aplicación y una evaluación de seguridad externa si se guardan datos en servidor) y de **Microsoft** (verificación de editor; consentimiento del administrador en cuentas de trabajo) sean compatibles con abrir esto a clientes: [Por verificar] con la documentación vigente. Mientras tanto, solo uso interno (P-8).
- No se afirma que los términos de Google («Limited Use») permitan enviar el texto a un proveedor de IA externo; hay que revisar si prohíbe usar esos datos para entrenar modelos y qué exige a los subencargados [Por verificar].
- No se afirma ninguna conclusión legal (RGPD, base jurídica, secreto de las comunicaciones, relación laboral con el buzón): son avisos para un abogado.
- No se afirma qué proveedor de correo usa tu equipo ni qué herramienta envía: sin dato.
- No se afirma que la herramienta de envío deje el mensaje enviado en el buzón conectado: si no lo deja, el filtro «hilo iniciado por la persona» de 6.3 deja fuera esas respuestas.
- No se afirma que un rebote llegue en el mismo hilo que el mensaje original.
- No se afirma que haya una marca de «no contactar» en ningún sitio hoy: no la he encontrado.
- No se afirma qué hace `defaultEnabled` en `play_states` al pasar el play a `parcial`.

### 7.2 Privacidad y RGPD: el elemento más pesado del backlog
**Qué es distinto.** Hasta ahora NOKKO trataba datos que la empresa ya tenía (leads, cuentas). Aquí la empresa da acceso a su buzón, que contiene correspondencia personal de **la persona que conecta** (puede ser un empleado, no el titular de la empresa) y respuestas de **terceros** (contactos de venta) que escribieron a una persona, no a NOKKO ni a su proveedor de IA. El acceso técnico es mayor que el uso (6.3): el token puede leer más de lo que NOKKO usa.

**Lo que está en juego, dicho sin suavizar**
- Datos personales de terceros que no han dado su consentimiento a NOKKO ni al proveedor de IA, incluidos contactos de la UE.
- La base jurídica del tratamiento (por ejemplo, interés legítimo de quien vende, o consentimiento del titular del buzón) no está decidida ni revisada.
- Roles: la empresa cliente sería responsable del tratamiento y NOKKO encargado; hace falta un contrato de encargo y una lista de subencargados (proveedor de IA, alojamiento, Google o Microsoft).
- Una persona conecta **su** buzón: si trabaja para una empresa, esa empresa y no ella puede ser la responsable [Por verificar con un abogado].
- Un fallo de seguridad aquí es más grave que en cualquier otra integración (tokens de buzón).

**Lo que decidiste y lo que no.** Para el PRD de plays a medida aceptaste «Sin acción legal por ahora» (decisión 14) y «Permitirlo con aviso» para el contacto en frío en la UE (13). Aquellas decisiones trataban de contactar y de fuentes públicas; esta es de otra naturaleza: **leer un buzón privado**. **No las tomo como heredadas.** Tú decides si lo son (Q-4).

**Mitigaciones que propongo (no decido por ti)**
1. Una **revisión legal de este elemento antes de conectar el primer buzón que no sea tuyo**. Recomendación, no decisión.
2. Lo técnico de 6.3 y 6.4: lectura estrecha, sin guardar texto, por persona, sin lectura de otros miembros, revocación y borrado completos.
3. Función apagada por defecto y encendida por el Owner con un texto claro (qué se lee, qué no, qué se guarda); consentimiento explícito de cada persona al conectar, con el mismo texto.
4. Fase 1 solo con la organización de Fede (P-8).
5. Elegir un proveedor de IA que no entrene con los datos y fijarlo en esta ruta (el SDD 3 lo comprueba contra `aiProviders()`), y dejarlo escrito.
6. Una vía documentada para que un tercero pida el borrado de lo que NOKKO tenga de él (hoy: nada de su texto; solo ids).

### 7.3 Preguntas abiertas para Fede
| # | Pregunta | Recomendación |
|---|---|---|
| Q-1 | ¿Gmail primero o los dos proveedores a la vez? | **Gmail primero**, con la capa de proveedor diseñada desde el SDD 1 para que Outlook sea el SDD 5 sin rehacer nada. Dos verificaciones distintas (Google y Microsoft) duplican el riesgo de calendario. Depende de qué usa tu equipo (sin dato) |
| Q-2 | ¿La lectura predeterminada es B (contactos conocidos + hilo propio) o C (B + etiqueta)? | **B por defecto y C opcional.** C es más estrecho pero pierde todo lo que no se etiquete; si priorizas la mínima huella sobre la cobertura, elige C |
| Q-3 | ¿Cuánto se conservan las filas de identificadores y los contadores tras desconectar? | **Mientras exista la conexión; al desconectar se borra todo menos contadores agregados sin ids.** Un plazo numérico lo propone el SDD 2 y lo confirmas tú; no lo invento |
| Q-4 | ¿Heredas «sin acción legal por ahora» o pides una revisión de este elemento? | **Revisión antes de conectar buzones ajenos.** Hasta entonces, uso interno (P-8) |

## 8. Orden de entrega
Cada SDD se redacta uno a uno con `nokko-shape` cuando apruebes este PRD. Ninguno empieza sin la decisión Q-4. Dependen de NK-0128 (hecho) y de la enmienda a `SDD-20261025-connections-bring-your-own-account` (CA-11 «solo el Owner»; una conexión personal por persona).

| # | SDD (propuesto) | Tipo | Depende de | Cubre |
|---|---|---|---|---|
| 1 | `SDD-…-bandeja-conexion`: cliente OAuth de Google, flujo de autorización por persona y empresa, permisos mínimos (6.3, P-1), almacenamiento cifrado de tokens (clave propia, 6.4), tabla de conexiones con RLS, revocar y borrar, interruptor de empresa, lista del Owner. Incluye la capa de proveedor | Feature | NK-0128; enmienda de Conexiones; Q-1, Q-4 | G-5 |
| 2 | `SDD-…-bandeja-ingesta`: trabajo de lectura (`JOB_KINDS`, cron existente, `job_locks`), constructor de la búsqueda de contactos conocidos, emparejado por correo exacto (6.5), tabla de respuestas con RLS por usuario, retención y borrado, marca de «no contactar» (cambio de esquema), regla que detiene la secuencia | Feature | 1 | G-4, G-5 |
| 3 | `SDD-…-bandeja-clasificacion-borradores`: esquema estricto y validación en código, las ocho clases, acciones propuestas, borrador con `loadVoice` y `loadAgentRules`, regla «Escalar», registro de coste por respuesta | Feature | 2; NK-0128 | G-1, G-2, G-6 |
| 4 | `SDD-…-bandeja-pantalla-y-play`: pantalla «Respuestas», sugerencias sin texto de la respuesta, herramientas del asistente (solo para quien conectó; no por MCP), desbloqueo del play y su prueba, medida de G-2 y G-3 | Feature | 3 | G-1, G-2, G-3, G-7 |
| 5 | `SDD-…-bandeja-outlook`: Microsoft Graph con la misma capa | Feature | 1 a 4; Q-1 | Todos |

Orden: 1, 2, 3, 4 y después 5. Sin el 1 no hay nada que probar; sin el 2 el 3 no tiene entradas.

## 9. Aprobación
- [ ] Fede aprueba el PRD (primer GO de dirección), incluidas las propuestas P-1 a P-8 y las respuestas a Q-1 a Q-4. Fecha: {…}
- Al aprobar, el Estado pasa a «Aprobado». Después se redactan los SDD con `nokko-shape`.
