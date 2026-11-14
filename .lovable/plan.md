# Ola 0 — arreglos pequeños (sin navegación, sin migraciones, sin publicar)

Cada pieza: prueba nueva primero, luego el cambio; un commit por pieza. Pruebas existentes no se tocan (incluida `src/lib/nav.test.ts`).

## 0.1 Texto de la tarjeta de Gmail
- Antes de escribir: leer `mailbox-card.tsx`, `src/lib/reply-inbox/*` (sync, clasificador, retención, desconexión) y la migración `0100_reply_inbox_classification`, y anotar en el informe con referencias a archivo:línea qué se lee (remitente, fecha, cuerpo), qué se guarda, la caducidad real y qué pasa al desconectar.
- Hoy la tarjeta dice «Solo lee remitente y fecha» y el diálogo de desconexión dice «borrará lo leído; conservará el contador». Se reescriben ambos textos para que coincidan exactamente con el código.
- Prueba: render de la tarjeta conectada que verifica que ya no promete «solo remitente y fecha» y menciona el cuerpo.

## 0.2 ⌘K abre el lead o la persona concretos
- Hoy, al elegir un Lead se va a `/leads` y una Persona a `/people`, sin abrir la ficha.
- Lead: navegar a `/leads` con `search: { lead: id }` (la pantalla ya abre el lead seleccionado por ese parámetro).
- Persona: añadir un parámetro opcional `persona` a `/people` que abra esa persona (sin pantalla nueva).
- Lógica de destino extraída a una función pura con prueba.

## 0.3 /replies y /onboarding en ⌘K
- Añadir «Respuestas» y «Onboarding» como acciones del buscador, sin tocar `src/lib/nav.ts`. Prueba sobre la lista de acciones.

## 0.4 Estado «sin permiso» en Asesor y Revisión estratégica
- Añadir variante `forbidden` a `DataState` con texto «Solo Owner o Sales Leader pueden …» (roles según `canUseAdvisor`). Usarla en `advisor.tsx` y `cycle.tsx` en lugar del estado actual. Pruebas nuevas en un archivo nuevo.

## 0.5 Memoria muestra el error
- En `memory.tsx`, si la carga falla, mostrar `DataState` de error con `errorText()` y «Reintentar», en vez de lista vacía. Prueba con consulta que falla.

## 0.6 Tooltips de MEDDPICC y ABM
- Añadir entradas en `field-help-data.ts` y mostrar el tooltip junto a esos términos en Deals y ABM. Prueba de que las entradas existen y no están vacías.

## 0.7 Tarjetas de CRM sin conexión → «Próximamente»
- Localizar las tarjetas de HubSpot/Pipedrive/Attio/Salesforce sin conexión real; mostrar etiqueta «Próximamente» y desactivar su acción. No se borran. Prueba de render.

## Calidad
- Iconos siempre con texto (IconText); glosario de AGENTS.md.
- Al final: tipos, lint, pruebas nuevas y suite completa en verde; informe corto en `docs/` y en el chat (cambios, pruebas, qué no se pudo verificar).

## Respuesta de solo lectura (AI_LOVABLE_FALLBACK)
- No existe ningún secreto `AI_LOVABLE_FALLBACK`: está sin definir. Sí existen `OPENROUTER_API_KEY` y `GEMINI_API_KEY`.
- Regla actual (`aiProviders` en `src/lib/gemini.ts`): con OpenRouter, Lovable AI solo se añade si vale «on» → hoy no se usa.
- Si falta la clave de OpenRouter: se usa Gemini y, como el respaldo no está en «off», Lovable AI vuelve a entrar como último recurso. Si faltan las dos, se usa solo Lovable AI.
- Eso contradice tu decisión «nunca». Cerrarlo es un cambio de código fuera de la Ola 0; no lo hago sin tu permiso.

## Fuera de alcance
Navegación/5 secciones, migraciones, permisos/RLS, pantallas nuevas, Drive, Gmail (salvo texto), Apollo, Clay, Apify/LinkedIn, publicar.
