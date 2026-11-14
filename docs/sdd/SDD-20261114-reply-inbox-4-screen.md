# SDD NK-0174 SDD 4 — Pantalla «Respuestas» (U-1)

Alcance U-1: pantalla de solo lectura en /replies con las respuestas ya detectadas (lead, fecha, humana/automática) del buzón propio. Sin cuerpo, asunto ni IA: la categoría de SDD 3 aparecerá cuando U-2/U-3 se conecten.

Reglas (probadas en src/lib/reply-inbox/inbox-view.test.ts):
- R-1 Orden: más reciente primero.
- R-2 Filtro: todas / humanas / automáticas.
- R-3 Titular: «N respuestas de personas en 30 días» o, sin datos, el nombre de la sección.
- R-4 Solo lee filas propias (RLS user_id = auth.uid()); no hay escritura nueva ni migración.
- R-5 Agente, MCP y Telegram siguen sin importar la bandeja (guarda existente).

Fuera de alcance: clasificación, borradores, abrir el correo en Gmail, publicación.
