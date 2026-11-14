# Ola 0 — informe (14/11/2026)

Sin migraciones, sin cambios de permisos/RLS, sin pantallas nuevas, sin tocar navegación ni `nav.test.ts`, sin publicar. Commits: los gestiona Lovable automáticamente; no pude separar uno por pieza.

## 0.1 Tarjeta de Gmail — qué hace el código hoy
- Lee: cabeceras de cada mensaje (remitente, asunto, fecha, In-Reply-To, cabeceras de respuesta automática) — `gmail.server.ts:41`. De las respuestas humanas lee también el mensaje completo (`format=full`, `gmail.server.ts:46`, usado en `classify-pass.server.ts:27`), solo en memoria.
- Guarda en `inbox_replies`: id de Gmail, hilo, lead, fecha de recepción y humana/automática (migración de `inbox_replies`). No guarda asunto ni texto.
- Guarda en `inbox_reply_derived`: categoría, confianza, freno, propuesta, borrador, persona/email referido, fecha de vuelta y avisos (`classify-pass.server.ts:46-52`). Caduca a los 30 días (`DERIVED_TTL_DAYS`, `classification.ts:11`; purga en `classify-pass.server.ts:56`).
- Recibos `inbox_reply_receipts`: operación, resultado, tokens y coste; sin texto.
- Al desconectar (`mailbox.functions.ts`): borra `inbox_replies` (y en cascada lo derivado), marca el buzón como desconectado; conserva marcas «respondió», contador y recibos.
- Cambio: textos en `mailbox-copy.ts` usados por `mailbox-card.tsx`. Prueba: `mailbox-copy.test.ts`.

## 0.2 ⌘K abre lead/persona — `src/lib/palette.ts` (`hitTarget`), `/people?persona=` filtra a esa persona con «Ver todas». Prueba: `palette.test.ts`.
## 0.3 Respuestas y Onboarding en ⌘K — `PALETTE_SCREENS`, sin tocar `nav.ts`. Prueba: `palette.test.ts`.
## 0.4 «Sin permiso» — `ScreenState forbidden` en `page.tsx`; Asesor y Revisión estratégica dicen que solo Owner y Sales Leader pueden. Prueba: `screen-state-forbidden.test.tsx`.
## 0.5 Memoria — `rowsOrThrow` y `ScreenState` con error y «Reintentar». Prueba: `query-result.test.ts`.
## 0.6 MEDDPICC y ABM — entradas en `field-help-data.ts` y `JargonTerm` (se abre con clic/toque) en Pipeline y ABM. Prueba: `field-help-jargon.test.ts`.
## 0.7 CRM «Próximamente» — HubSpot, Pipedrive, Attio, Salesforce en el plan de herramientas de Conexiones; no se borran. Prueba: `integration-availability.test.ts`.

## Estado
- Tipos limpios; 21 pruebas nuevas/relacionadas en verde; suite 4724/4725.
- Fallo previo, no causado por la Ola 0: `field-coverage.test.ts` pide catalogar 23 columnas de las tablas de la bandeja de Gmail (migración 0100). Arreglarlo toca `field-catalog.ts` del área Gmail: pendiente de permiso.
- Lint: archivos tocados limpios salvo avisos previos de formato en `replies-list.tsx` (Gmail, no tocado).
- Sin revisión visual en navegador.
