# NK-0159 — Salida de mantenimiento sin notas privadas

Estado: En curso. Autorizado por Fede el 13-11-2026, 14:08 UTC.

## Qué y por qué
El paso `autopilot` de Inngest retorna el resultado completo, incluidas notas con títulos y errores. El resultado final de `org-maintenance` vuelve a retornarlo. Eliminar las notas únicamente en esta frontera durable; conservar el contrato de `autopilotForOrg` y las notificaciones internas.

## Alcance
Una proyección con lista cerrada de tres contadores (`researched`, `prepped`, `cooling`) y recuento de notas, aplicada dentro del callback de `step.run` antes de su retorno. No registrar títulos, mensajes, arrays ni propiedades adicionales. No cambiar cores, pruebas existentes, envíos, permisos, catálogo o proveedores.

## Pruebas y comprobación
Primero una prueba nueva del handler con Inngest y todos los servicios simulados: la salida serializada del paso y de la función no puede contener testigos sintéticos de título/error ni propiedades extra; mantiene los contadores y las notas enviadas al notificador. Debe fallar por fuga de texto antes del cambio. Después, pruebas protegidas de notas intactas, checker permitido y suite completa con concurrencia limitada.

No activar cron ni gastar en proveedores. Navegador: no existe superficie visual que muestre esta salida de Inngest; no sustituir la prueba del callback real por inspección de una página no relacionada. Compilación automática cuando haya señal disponible.

## Riesgos y vuelta atrás
El historial nuevo pierde el detalle de las notas; los historiales ya existentes no se borran ni modifican. Revertir la proyección y su uso devuelve el comportamiento previo. Sin migración.

## Informe de ejecución
Prueba nueva del callback real: falla antes por fuga del testigo de error y pasa después; se conserva el resultado interno para el notificador. Pruebas protegidas intactas. Suite completa: 335 archivos, 5574 pruebas, todos pasan con cuatro workers, Node 22.23.5. Compilación automática OK posterior al cambio funcional.

Pendiente de cierre: checker de tipos manual prohibido por el entorno, sin señal separada automática comprobable. No se declara checker limpio. No se desplegó ni se consultó historial alojado; no hay cambio visual y no se recorrió una página ajena para suplir la comprobación durable. SDD En curso; informe completo en docs/lovable-run-report.md. Siguiente entrega no iniciada.