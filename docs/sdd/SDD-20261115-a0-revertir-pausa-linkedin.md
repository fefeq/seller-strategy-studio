# SDD A0 — Revertir la pausa de LinkedIn

Estado: Aprobado por delegación general de Fede, 15-nov-2026.

## Objetivo
Volver a la decisión del 27-oct: NOKKO extrae datos públicos de LinkedIn con robots (publicaciones, ofertas, búsqueda y guardado de páginas) en pantallas, agente, trabajos automáticos y plays, con aviso visible.

## Cambios
- `src/lib/linkedin-legal.ts`: `extractionPaused` pasa a fail-open (solo `paused = true` explícito detiene). Nuevo `LINKEDIN_ACTIVE_NOTICE`.
- `src/lib/linkedin-legal.server.ts` y `src/hooks/use-linkedin-legal.ts`: un fallo de lectura ya no bloquea.
- `src/components/linkedin-legal-card.tsx`: «Extracción de LinkedIn · Activa» + aviso legal; interruptor solo superadmin (ya existía, trivial).
- `src/components/linkedin.tsx`: vuelve «Ver ofertas abiertas»; el aviso «En pausa» solo aparece si un superadmin pausa.
- Datos: fila `linkedin_extraction` puesta a `paused = false` (sin borrar nada, reversible con el interruptor).

## Criterios con prueba
- Fila ausente / error de lectura / cliente roto → no bloquea (`linkedin-legal*.test.ts`).
- Pausa explícita sigue bloqueando `runActor` (`apify-core-legal-pause.test.ts`).
- El aviso contiene «mediante robots», «términos de LinkedIn», «Revisión legal pendiente».

## Riesgos y reversión
Riesgo legal asumido por Fede. Reversión: superadmin pulsa «Pausar extracción».
