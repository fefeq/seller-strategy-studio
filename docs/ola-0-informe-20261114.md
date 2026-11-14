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
- Verificación inicial: tipos limpios y suite 4724/4725; faltaba permiso para registrar 23 columnas en el catálogo. Ese fallo queda resuelto en el cierre adicional de abajo.
- La revisión visual inicial de las piezas 0.2–0.7 sigue pendiente; no se declara verificada toda la Ola 0.

## Cierre adicional autorizado por Fede — 14/11/2026, 22:36 UTC

### 1. Aviso de Respuestas
- `replies-list.tsx` ahora explica que la IA lee el texto de las respuestas humanas para clasificarlas y proponer un borrador, pero no guarda ese texto. Explicita los derivados guardados y su caducidad de 30 días, reutilizando `DERIVED_TTL_DAYS`.
- El código también usa el texto leído al preparar el borrador (`classification-core.ts`); por eso el aviso no promete que se utiliza exclusivamente en la llamada de clasificación. No se cambió esa lógica.
- Prueba nueva: `replies-list-copy.test.tsx`, dos casos del aviso mostrado y la retención. Fallaron antes del cambio y pasan después. Ninguna prueba existente modificada.
- Formato de `replies-list.tsx` normalizado, sin alterar consultas, filtros ni acciones.

### 2. Catálogo de campos
- `field-catalog.ts`: registrados exactamente los 23 campos escalares que señalaba `field-coverage.test.ts`: 1 de `inbox_replies`, 14 de `inbox_reply_derived` y 8 de `inbox_reply_receipts`.
- Cada campo tiene concepto y persistencia. «Guardado» describe persistencia, no retención infinita: los derivados siguen caducando según la lógica existente. Los conceptos nuevos incluyen su localización en `SHOWN_IN`.
- `cost_usd` conserva un concepto específico de coste medido en USD, separado de importes en moneda de empresa; no convierte ni reetiqueta cifras.
- Prueba nueva: `reply-inbox-field-catalog.test.ts`, dos casos para los 23 registros y la separación del coste USD. Fallaron antes del cambio y pasan después.
- `field-coverage.test.ts`, el baseline, tipos generados, migraciones y lógica de Gmail intactos. El fallo original se reprodujo y se resolvió sin debilitar ninguna expectativa.

### Verificación y límites
- Suite completa: **4729/4729 pruebas, 389 archivos**, en verde. Selección de seis archivos relacionados: **38/38**.
- Compilación automática: **build OK**, última entrada consultada 22:38:35 UTC. Tipos no comprobados manualmente en este cierre por restricción del entorno; no se extrapola el resultado anterior.
- Lint de los cuatro archivos cambiados de código/pruebas: **0 errores**, dos avisos preexistentes de Fast Refresh en `replies-list.tsx`. Lint global ejecutado: **5529 errores y 45 avisos** en el repositorio; no está verde. No se corrigieron archivos ajenos al alcance autorizado.
- Navegador con sesión de Fede en `/replies`: aviso verificado en 1280 px y 375 px, claro/oscuro; sin desbordamiento horizontal ni errores de ejecución. Se revisó el aviso, no el contenido de correos ni una clasificación real.
- Sin publicación, lectura de Gmail, llamadas de IA, gasto, cambios de proveedores ni respaldo de Lovable AI. No se declara cierre global de pendientes visuales ni de lint.
