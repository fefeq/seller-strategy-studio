# SDD A3 — Contador atómico y secreto del webhook de Apollo
Estado: Aprobado por delegación general de Fede, 15-nov-2026.
- Migración `0103_intake_atomic_counters`: `reserve_intake_quota` (bloqueo de fila, mismas reglas que checkIntake) y `bump_intake_received` (incremento atómico); solo service_role. Reversible: borrar las dos funciones; el código vuelve al cálculo anterior si la RPC falla.
- Webhook de teléfonos: lee `X-Webhook-Secret` primero. Limitación del proveedor: Apollo solo llama a la `webhook_url` y no envía cabeceras, así que sus entregas siguen usando `?secret=` (nunca se registra la URL).
- Pruebas: `src/lib/intake-atomic.test.ts` (3), `apollo.test.ts` (+3). Sin pruebas existentes modificadas.
