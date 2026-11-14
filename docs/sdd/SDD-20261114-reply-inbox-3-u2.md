# SDD NK-0174 SDD 3 · U-2 — Clasificación conectada a la revisión horaria

Autorizado por Fede en chat el 14-11 21:15 UTC («si» a seguir con la clasificación). Solo buzón de Fede (puerta legal vigente).

## Qué hace
- Tras la detección horaria, toma como máximo 10 respuestas «de persona» pendientes de los últimos 30 días.
- Reserva cada una (pending → reserved) ANTES de leer el cuerpo o llamar a la IA. Una reserva nunca se repite: si algo falla después, queda `failed` y no se reintenta (evita gasto doble).
- Lee el cuerpo con `getBody` (lista cerrada R-3), extrae texto plano en memoria, lo pasa al núcleo `prepareReply` con Opus 5.5 (sin respaldo, data_collection deny, zdr) y no lo guarda nunca.
- Guarda solo derivados (categoría, confianza, freno, propuesta, borrador, persona/correo derivados, fecha de vuelta) en una fila privada legible solo por el dueño del buzón; caducan a los 30 días y se purgan en cada pasada.
- Recibos: solo operación, resultado, tokens y coste; sin texto ni identidad del remitente.
- Respuestas automáticas: `skipped`, sin IA.
- Pantalla Respuestas: muestra la categoría cuando existe.

## Pruebas nuevas (antes de implementar)
`src/lib/reply-inbox/classify-pass.test.ts`: extracción de texto, reserva previa al gasto, no replay, automáticas sin IA, tope por pasada, recibos sin texto, caducidad 30 días.

## Fuera de alcance
U-3 (resumen de estilo), envío de borradores, cambios de etapa automáticos, publicación.
