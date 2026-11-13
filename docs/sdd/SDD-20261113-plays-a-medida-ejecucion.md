# SDD-20261113 · Plays a medida · Motor de ejecución (NK-0171, SDD 4)

**PRD:** §8 fila 4, §6.1, §6.5, P-3, C-12, q-6.

## Unidades
- **U-1 (hecha):** `searchTagged` en `web-search.ts`: misma búsqueda combinada, cada resultado con su proveedor real (`mergeTagged`, puro). `searchBoth` sin cambios.
- **U-2 (hecha):** `engine.ts` puro: fecha del evento comprobada contra la fuente (campo estructurado o literal en la cita; ambigua = desconocida), frescura, evidencia mínima sin contacto, sugerencias por cuenta con la regla graduada de email y «solo verificado»; sin cuentas, sugerencia de empresa con contacto «sin dato».
- **U-3 (hecha):** migración `0093_custom_plays_execution`: estado (aprobado/activo/pausado/archivado), primera activación, resultado de prueba, `cost_kind` (IA medido / IA sin dato / proveedor estimado). Prefijo duplicado 0092 → 0093, `drizzle-kit check` limpio.
- **U-4 (pendiente):** trabajo en segundo plano que ejecuta un play activo: busca con `searchTagged`/Apify, guarda evidencia y sugerencias con el cliente privilegiado, registra gasto en `integration_usage` y `custom_play_costs`.
- **U-5 (pendiente):** herramientas activar/pausar y registrar resultado de prueba (Owner y Sales Leader).

## Pruebas
`engine.test.ts` (9): falló primero. Ninguna prueba existente modificada. Catálogo de campos ampliado con las 6 columnas nuevas (no es una prueba).
