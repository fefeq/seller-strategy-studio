# NK-0174 SDD 2 — Leer respuestas, detectarlas y pausar la secuencia

Alcance: solo el buzón de Fede conectado a Postin (puerta legal intacta). Sin IA, sin pantalla, sin herramientas del asistente/MCP/Telegram (Q-10 a). Clasificación = SDD 3; pantalla = SDD 4.

## Qué verá Fede
- Cuando un lead en «Contactado» responde desde su email exacto, NOKKO lo detecta en la siguiente pasada (cada hora) y su secuencia de seguimiento se detiene para siempre mientras siga en Contactado (Q-10 b = B). No se toca la fecha de contacto ni ningún dato del lead.
- Las respuestas automáticas (fuera de oficina, avisos) se guardan como «automática» y no pausan.
- En la tarjeta del buzón en Conexiones: «Última revisión: hace X · N respuestas detectadas».
- Al desconectar el buzón se borra todo lo leído; quedan solo contadores y la marca «respondió».

## Reglas (pruebas nuevas primero)
- R-1 Búsqueda solo por remitente (diseño B): `from:(a OR b …) newer_than:Nd`, en lotes, solo con emails de leads en Contactado de esa empresa. Nunca listados sin filtro, `history` ni `watch`.
- R-2 Emparejado exacto: el remitente normalizado debe coincidir con el email del contacto; si no, se ignora.
- R-3 Humano vs automática por cabeceras (Auto-Submitted, Precedence, X-Autoreply, X-Auto-Response-Suppress); `mailer-daemon` se descarta.
- R-4 Solo una respuesta humana crea la marca «respondió» (sin usuario, sin id de mensaje, con fecha); `followupStatus` devuelve «replied» mientras exista y el lead siga en Contactado; el bucle de Inngest se detiene.
- R-5 Filas privadas: solo quien conectó las lee (RLS `user_id = auth.uid()`); un Owner/superadmin distinto lee 0 (prueba PGlite).
- R-6 Nada de texto de correo en logs, sugerencias, tareas, memorias ni respuestas del agente; solo metadatos (id Gmail, hilo, fecha, tipo). El cuerpo no se descarga en SDD 2.
- R-7 Trabajo con límite por pasada, bloqueo único, progreso idempotente (único por empresa + id de mensaje) y pausa ante 401/403/429 repetidos.

## Detalles técnicos
- Migración `0098_reply_inbox_sync`: `inbox_replies` (org_id, user_id, gmail_id único por org, thread_id, lead_id, received_at, kind human|auto, created_at; RLS dueño), `lead_replied_marks` (org_id, lead_id único, replied_at; lectura miembros, escritura solo servidor), `mailbox_links` + `last_synced_at`, `replies_count`.
- `src/lib/reply-inbox/sync.ts` (puro, probado): construir consultas, emparejar remitentes, clasificar cabeceras, decidir marcas.
- `src/lib/reply-inbox/sync.server.ts`: pasada por empresa usando `gmail.server.ts` (listMessages + getMetadata con cabeceras Precedence/X-Autoreply añadidas a la lista cerrada).
- Disparo: dentro del trabajo horario existente `/api/public/jobs/proactive` (bloqueo `job_locks`), sin nueva ruta pública.
- `src/lib/followup.ts`: nuevo estado «replied» cuando existe marca; detector `followup_sequence` y Inngest `lead-followup` lo respetan.
- `unlinkMailbox`: borra `inbox_replies` de esa empresa, conserva contadores y marcas.
- Guardia R-6 existente ampliada a los nuevos módulos.

## Verificación
Pruebas nuevas + suite completa, build; una pasada real de solo lectura contra el buzón de Fede en Postin mostrando solo contadores (sin contenido). Sin publicar.
