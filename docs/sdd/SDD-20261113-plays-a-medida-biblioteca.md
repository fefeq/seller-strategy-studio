# SDD-20261113 · Plays a medida · Biblioteca «De NOKKO» (NK-0171, SDD 2)

**PRD:** `docs/prd/PRD-20261112-plays-a-medida.md` (§6.4, §7, §8 fila 2, P-7). **Depende de:** SDD 1 (modelo). **Autorización:** cola completa de Fede (sin aprobación entre entregas).

## Alcance
1. Biblioteca de referencia en código, solo lectura (`src/lib/plays/custom/library.ts`), con R-1, R-2 y R-3 (R-3 ajustada, decisión 18).
2. Etiquetas de origen P-7: «De NOKKO» / «Creado para tu empresa».
3. Selección de cuentas de §6.4: competidores declarados → cuentas cuyo `account_plans.competitors` o `deals.lost_competitor` lo nombran, con la regla «mismo» (≥ 95) de `match.ts`. Sin cuentas: lista vacía (el motor, SDD 4, entrega sugerencia de empresa con contacto «sin dato»).
4. `Need` nueva `reviews` (solo Apify, sin clave de registro) y fuente `reviews` en el registro del SDD 1. Sin `APIFY_API_KEY`, R-2 queda bloqueada para todas las empresas.
5. Huellas por fragmentos (`fingerprints.ts`: trigramas de palabras normalizados, umbral 0,34) y prueba anti-copia que lee el anexo en ejecución y compara slugs y hooks con títulos, hooks, mensajes e ids. Ningún texto del anexo en código ni en pruebas. La validación en producción la usa el SDD 3.

## Fuera de alcance
- Cambio de `searchBoth` para etiquetar el proveedor (va con el SDD 4, §8).
- Ejecución, guardado, activación y UI (SDD 3 y 4).
- [Por verificar] si los campos de competidores están lo bastante rellenos: se mide al ejecutar (SDD 4).

## Criterios de aceptación (prueba `library.test.ts`, 14 casos)
CA-1 etiquetas P-7 · CA-2 exactamente tres recetas congeladas · CA-3 diseño de prueba y ventana válidos · CA-4 R-2 usa `reviews` solo por Apify y se bloquea sin él · CA-5 ninguna receta usa Drive ni PostHog · CA-6 R-2 y R-3 nunca contactan al autor · CA-7..9 selección de cuentas sin inventar · CA-10..12 huellas · CA-13..14 anti-copia contra el anexo.

## Pruebas existentes
Ninguna modificada. Se añade una clave a `Need`/`SourceKey`; los registros exhaustivos se completan.
