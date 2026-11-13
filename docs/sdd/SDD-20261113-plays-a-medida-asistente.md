# SDD-20261113 · Plays a medida · Herramienta del asistente (NK-0171, SDD 3)

**PRD:** §8 fila 3, §7 (q-5). **Depende de:** SDD 1 y 2.

## Alcance
1. `propose_custom_play` (escritura, Owner y Sales Leader): crea una acción pendiente; al confirmarla se vuelve a validar y se guarda en `custom_plays` con el cliente privilegiado y `org_id` explícito.
2. Reglas puras `checkProposal` (`src/lib/plays/custom/propose.ts`): nombre, disparador, ventana, fuentes del registro, hechos que citan pasos existentes, diseño de prueba, anti-copia.
3. Anti-copia en producción: lista de huellas en el repo **solo con hashes** (`fingerprints.data.ts`, FNV-1a de trigramas); una prueba exige que coincida con el anexo.
4. Coste de cada propuesta en `custom_play_costs`: el coste de IA no se mide todavía; se guarda `provider = "ai:sin_dato"`, importe 0 (la tabla no admite nulo). No se estima.
5. Título en TITLES y manifiesto MCP regenerado.

## Fuera de alcance / pendiente
- Medida G-2 (conversaciones borradas) y lectura de la estrategia como contexto: con el SDD 4.
- Coste de IA medido: requiere una columna «sin dato» o medición real; se propone para el SDD 4.

## Pruebas
`propose.test.ts` (8): falló primero (módulos inexistentes). Ninguna prueba existente modificada.
