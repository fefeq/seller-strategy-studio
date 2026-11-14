# SDD-20261114 · NK-0174 SDD 1 · Conexión con Gmail (buzón de Fede)

**PRD:** docs/prd/PRD-20261113-bandeja-de-respuestas.md · **Decisiones:** docs/decisiones-fede-20261113.md (Q-1 Gmail, Q-4 condición legal, Q-5 Google Workspace, Q-10 a).
**Estado:** autorizado por Fede (cola completa, 2026-11-14).

## 1. Alcance
Conectar **un único buzón**: el de Fede (Workspace Internal) a una empresa, con permiso de solo lectura, y dejar listo un cliente cerrado que las SDD 2–4 reutilizan. Sin lectura de mensajes todavía, sin IA, sin pantalla de bandeja.

## 2. Decisión técnica (cambia el «cómo» del PRD, no el «qué»)
El PRD suponía un cliente OAuth propio por persona. Con la condición Q-4 (solo Fede hasta la revisión legal) basta la **conexión Gmail del constructor** de Lovable (cuenta de Fede, `gmail.readonly`), que pasa por la pasarela de conectores y no requiere guardar tokens ni verificar una app propia con Google. Cuando la revisión legal autorice buzones de compañeros, el SDD de apertura sustituirá esta conexión por conexiones por persona; el resto (ingesta, clasificación, pantalla) habla con un puerto y no cambia.

## 3. Reglas
- R-1 Solo un **superadmin** (platform_admins) puede vincular el buzón y solo si la dirección del perfil de Gmail coincide con su email de inicio de sesión (su propio buzón). Cualquier otro usuario recibe «Hasta la revisión legal solo puede conectarse el buzón de Fede».
- R-2 Un buzón vinculado por empresa como máximo en fase 1 (`mailbox_links`, único por org).
- R-3 Lista cerrada de operaciones Gmail en un solo módulo server-only: `profile`, `listMessages(q)`, `getMetadata(ids)` (lote ≤50), `getBody(id)`. Sin `history`, `watch`, envío ni modificación (PRD 6.3).
- R-4 La fila de vínculo guarda solo org, usuario, dirección y estado; ningún token. Todos los miembros ven **que** hay buzón conectado y su estado; nadie ve contenido.
- R-5 Desconectar borra el vínculo (Q-3; el borrado de lo derivado lo amplía SDD 2).
- R-6 Ningún módulo de agent/, mcp/ ni Telegram importa los módulos de Respuestas (Q-10 a; prueba estructural).

## 4. Unidades
- U-1 Pruebas nuevas: regla R-1 pura (`canLinkMailbox`), lista cerrada R-3, guarda R-6.
- U-2 Migración `mailbox_links` + RLS (miembros leen su org; escritura solo privilegiada).
- U-3 `src/lib/reply-inbox/gmail.server.ts` (cliente cerrado) + `mailbox.functions.ts` (estado, vincular, desconectar) + tarjeta en Conexiones.

## 5. Fuera de alcance
Sincronización, detección y pausa (SDD 2), clasificación (SDD 3), pantalla (SDD 4), Outlook (SDD 5), buzones de compañeros (bloqueado por Q-4).
