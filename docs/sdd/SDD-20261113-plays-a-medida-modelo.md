# SDD-20261113-plays-a-medida-modelo · NK-0171 SDD 1 (tanda 0)
**Estado:** En curso (entrega 1 de 2) · **PRD:** PRD-20261112-plays-a-medida (aprobado con decisiones-fede-20261113) · **Autoriza:** autorización general de Fede 13-11.

## Alcance
Molde puro del play a medida (sección 6.1/6.2 del PRD) más Q-7 (parámetro opcional «solo contacto verificado»).

## Unidades
- **U-1 (hecha):** `src/lib/plays/custom/model.ts` — prefijo `custom:` (P-4), fechas sin ambigüedad (ISO o mes escrito; 03/04/2026 = desconocida), ventana hacia atrás/adelante sobre la fecha del evento, puertas declarativas con listas cerradas compiladas a `GateDef` (dato ausente = unknown), diseño de prueba (base = n, 0 < k ≤ n), evidencia mínima (URL, cita ≤ 280, sin email/teléfono), mensaje citado, registro de fuentes derivado de `CAPABILITIES` con comprobación de disponibilidad (Drive exige carpeta, PostHog conexión de la empresa), `contactGate` (Q-7). Prueba `model.test.ts` (25), falló primero por import.
- **U-2 (hecha, migración 0092_custom_plays_storage, prueba custom-plays.pg.test.ts, falló primero sin la migración):** migración con tablas por empresa (`custom_plays`, `custom_play_evidence`, `custom_play_costs` sin cascada hacia el play), RLS de lectura por miembros, escritura solo cliente privilegiado, `verified_only boolean default false`, retención «mientras el play exista» sin plazo (decisión 21), prueba PGlite.

## Qué fecha es «el evento» por receta
Se define en el SDD 2 al escribir R-1..R-3; el molde solo exige que exista y sea comprobable.

## Riesgo que queda
Que el literal aparezca en la cita no prueba que sea la fecha del evento (q-3): lo cubre la verificación manual.
