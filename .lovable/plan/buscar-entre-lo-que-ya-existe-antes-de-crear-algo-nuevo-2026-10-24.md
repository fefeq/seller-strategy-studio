# Buscar entre lo que ya existe antes de crear algo nuevo

## Objetivo
Cuando escribes una empresa, cuenta, persona o partner, Nokko te muestra lo que ya tienes guardado y te deja elegirlo. Solo crea algo nuevo si de verdad no existe, y te avisa de posibles duplicados (mismo dominio, mismo email o un nombre muy parecido).

## Un buscador común
Un campo «Buscar o crear»:
- Al escribir, sugiere lo que ya existe: logo, nombre y dominio en las cuentas; cargo y empresa en las personas.
- Encuentra parecidos aunque cambien mayúsculas, tildes, «S.L.», «Inc.», «www.» o el dominio.
- Si eliges una opción, queda enlazada. Si no hay coincidencias, muestra «Crear "Acme" como cuenta nueva».
- Si hay un parecido muy cercano, avisa antes de crear: «Ya existe Acme Logistics (acme.com). ¿Usar esa?».

## Dónde se aplica
1. **Nuevo lead y ficha de lead · Empresa.** Hoy es texto libre. Busca entre tus cuentas y deja el lead enlazado a la elegida. Si es nueva, el flujo de lead nuevo la crea igual que ahora.
2. **Nuevo deal · Cuenta.** Hoy usa una lista que aparece sola mientras escribes y no distingue nombres parecidos. Pasa al buscador común con aviso de duplicados.
3. **Nueva cuenta (Cuentas).** Antes de crearla, avisa si ya existe una con el mismo dominio o un nombre parecido y te lleva a ella.
4. **ABM · Registrar oportunidad de partner · Cuenta.** Hoy es texto libre. Busca entre tus cuentas, para que el aviso de «ya registrada por otro partner» funcione siempre.
5. **ABM · Contacto del partner.** Sugiere personas que ya tienes en Personas.
6. **Mapa de poder · «+ Persona».** Hoy crea «Nueva persona» directamente. Primero pregunta nombre y luego sugiere personas de Personas o stakeholders de la misma cuenta, para no repetir a nadie.
7. **Personas · nueva persona.** Ya detecta duplicados por email y LinkedIn. Se añade el aviso por nombre y empresa, y el campo Empresa usa el buscador de cuentas.
8. **Nuevo partner y nuevo producto.** Hoy crean «Nuevo partner» directamente. Antes de crear, avisan si ya existe uno con el mismo nombre.
9. **Añadir cuentas desde búsquedas** (Apollo, Clay, ICP, Parallel). Ya marcan «Ya está en Nokko» por dominio. Se amplía a nombres parecidos sin dominio, para que no entren duplicados.

## Lo que no cambia
- Las importaciones y las entradas de terceros siguen con su revisión y deduplicación actual.
- No se fusionan ni se borran registros existentes. Solo se avisa y se enlaza.

## Detalles técnicos
- Lógica pura y testeada en `src/lib/match.ts`: normalizar nombres de empresa (tildes, sufijos legales, puntuación), limpiar dominios, puntuar parecidos y decidir entre «igual», «parecido» o «nuevo». Reutiliza `cleanDomain` y `normEmail` y `normLinkedin` de `dedupe.ts`.
- Componente `EntityCombobox` (Popover + Command de shadcn) con búsqueda en el navegador contra las filas ya cargadas, o con `ilike` limitado a 20 para listas grandes, siempre dentro de la empresa activa por RLS.
- Leads: al elegir una cuenta, se guarda `account_id` además del texto `company`. El flujo de lead nuevo ya usa `account_id` si viene relleno.
- Tests: normalización, «S.L.» frente a sin sufijo, el mismo dominio con y sin «www.», y que un nombre distinto no se marque como duplicado.
