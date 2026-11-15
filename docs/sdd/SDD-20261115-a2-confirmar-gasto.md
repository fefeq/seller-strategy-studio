# SDD A2 — Confirmar antes de gastar y apuntar búsquedas web sueltas
Estado: Aprobado por delegación general de Fede, 15-nov-2026.

## Cambios
- `src/lib/agent/spend-confirm.ts`: lista de herramientas que gastan; las lecturas que gastan (Apollo empresas/consulta, Clay x3, LinkedIn x3, G2, Parallel tabla, investigar cuenta) pasan a propuesta (kind write). La tarjeta añade «gasta <proveedor> · coste aprox.: …» con la mediana de cargos medidos de esa herramienta en la empresa; sin historia, «sin dato». Monedas nunca se suman ni se convierten.
- Resultados tras confirmar: `decidePending` guarda el resultado completo (recortado a 6.000 caracteres) en la acción y en la conversación.
- Pantallas: `confirmSpend` (src/lib/confirm-spend.ts) antes de buscar/consultar en Apollo, Clay, Parallel, G2 (battlecard), ofertas de LinkedIn y revelar con Apollo.
- Búsquedas web sueltas: `searchBoth` acepta un pagador; señales, investigación por agente, investigación de stakeholder y búsqueda de página de LinkedIn apuntan una fila por proveedor con coste desconocido. Las llamadas envueltas en `trackedRun` no se duplican.
- USD/EUR: sin fuente, USD aparte y «Presupuesto incompleto» (ya existente).
## Decisiones
- La búsqueda de personas de Apollo es gratuita: sigue inmediata.
- Trabajos automáticos no piden confirmación (los frena el 100 %).
## Pruebas
`src/lib/agent/spend-confirm.test.ts` (9).
