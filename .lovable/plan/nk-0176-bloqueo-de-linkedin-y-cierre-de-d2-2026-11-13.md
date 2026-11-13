# NK-0176 — bloqueo de LinkedIn y cierre de D2

F1–F11 cerrados en el alcance autorizado sobre `main` 734c202: 5570/5570 pruebas en Node 22.23.5 y checker de tipos limpio. Node 26, tsc literal y build completo de producción no ejecutados; límites detallados en el informe. F12: documentos nunca borrados automáticamente.

## Entrega propuesta para aprobación
SDD completo: `docs/sdd/SDD-20261113-linkedin-blocker-d2.md`.

- Cambiar únicamente las dos cadenas del bloqueador LinkedIn en `src/lib/plays/status.ts`.
- Cerrar D2 en el PRD: **solo API oficial; Nokko no analiza ni puntúa perfiles**. Mantener los plays bloqueados.
- Estado propuesto: **«Bloqueado: falta una integración con la API oficial de LinkedIn»**.
- No construir conexiones, modificar catálogo/permisos ni activar plays.

## Permiso específico necesario
La aprobación debe incluir solo tres expectativas del texto antiguo: dos en `src/lib/plays/status.test.ts` y una en `src/lib/agent/tools/plays.test.ts`. Mantener todas las comprobaciones de bloqueo, permisos, ausencia de escrituras y aislamiento. Ninguna otra prueba existente se modifica.

El cambio es solo textual/documental: nuevas pruebas de invariantes como regresión, revisión de copy en diff y navegador, sin inventar una prueba de comportamiento que falle antes por copy. Este ajuste de fail-first también necesita aprobación de Fede.

## Tras aprobar
Implementación mínima; checker permitido y suite completa; navegador con sesión válida en escritorio y 375 px, claro/oscuro; informe de entrega antes del siguiente SDD.

No publicar ni desplegar. Torre de control GTM y Salida de Lovable intactas. **Hasta la aprobación, no se cambia producto ni PRD.**