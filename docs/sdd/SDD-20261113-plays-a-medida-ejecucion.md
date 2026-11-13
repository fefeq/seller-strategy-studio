# SDD-20261113 · Plays a medida · Motor de ejecución (NK-0171, SDD 4)

**PRD:** §8 fila 4, §6.1, §6.5, P-3, C-12, q-6.

## Unidades
- **U-1 (hecha):** `searchTagged` en `web-search.ts`: misma búsqueda combinada, cada resultado con su proveedor real (`mergeTagged`, puro). `searchBoth` sin cambios.
- **U-2 (hecha):** `engine.ts` puro: fecha del evento comprobada contra la fuente (campo estructurado o literal en la cita; ambigua = desconocida), frescura, evidencia mínima sin contacto, sugerencias por cuenta con la regla graduada de email y «solo verificado»; sin cuentas, sugerencia de empresa con contacto «sin dato».
- **U-3 (hecha):** migración `0093_custom_plays_execution`: estado (aprobado/activo/pausado/archivado), primera activación, resultado de prueba, `cost_kind` (IA medido / IA sin dato / proveedor estimado). Prefijo duplicado 0092 → 0093, `drizzle-kit check` limpio.
- **U-4a (en verificación):** coordinador de ejecución con puertos tipados: comprobar play activo, pertenencia y fuentes; lease de base de datos; pasos secuenciales con recibos persistentes; releer pausa/cancelación/presupuesto antes de cada paso; parar ante denegación, falta de saldo, límite de peticiones o rechazo. Devuelve solo estado y contadores. Pruebas sin proveedores ni gasto real.
- **U-4b (pendiente):** adaptar los puertos a la base y al trabajo en segundo plano: busca con `searchTagged`/Apify, guarda evidencia y sugerencias con el cliente privilegiado, registra gasto en `integration_usage` y `custom_play_costs`. U-4a por sí sola no se ejecuta desde la app.
- **U-5 (pendiente):** herramientas activar/pausar y registrar resultado de prueba (Owner y Sales Leader).

## Pruebas
`engine.test.ts` (9): falló primero. Ninguna prueba existente modificada. Catálogo de campos ampliado con las 6 columnas nuevas (no es una prueba).

## Contrato técnico de U-4a
- Cada operación recibe empresa, play, ejecución y usuario; el adaptador valida pertenencia y empresa archivada con lecturas reales, nunca con roles inventados.
- `claim/release` son una lease persistente por empresa/play, no un bloqueo en memoria. El coordinador no libera una lease que no adquirió.
- `runStep` debe guardar resultados y recibo en la misma transacción. `checkpoint` solo devuelve recibos confirmados. Sin adaptador transaccional no se conecta a proveedores.
- Los pasos aprobados son el límite finito de trabajo. Cada adaptador limita sus resultados; no se crean llamadas por página ni cadenas recursivas.
- Q-6 prevalece: presupuesto pausa solo trabajo automático; lo manual sigue y registra coste. No se usa este permiso para probar con gasto real.
- Denegación y rechazo detienen la ejecución, persisten la pausa y no cambian proveedor. No hay reintento ni sonda automática. La futura interfaz de reanudación deberá exigir resolución y petición nueva cuando corresponda.
- Un paso sin recibo válido es un error, no un éxito. Las excepciones no clasificadas se propagan al centro de tareas.
- Vuelta atrás: retirar los dos módulos nuevos; ninguna migración, dato real, proveedor o pantalla cambia en U-4a.
