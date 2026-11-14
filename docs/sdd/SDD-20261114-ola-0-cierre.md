# Ola 0 — cierre adicional autorizado

## Alcance
Autorización de Fede del 14/11/2026 a las 22:36 UTC: corregir el aviso de Respuestas y registrar exactamente los 23 campos pendientes del catálogo. No modificar pruebas existentes, lógica de Gmail, proveedores, respaldo de IA ni publicar.

## Entregas
1. Aviso honesto sobre lectura del texto de respuestas humanas, su uso para clasificación y borrador, no persistencia del original y retención de derivados durante 30 días. Reutilizar la constante existente.
2. Registrar los 23 campos con conceptos, clase de persistencia y localización; mantener el coste medido USD separado de importes en moneda de empresa. Baseline y prueba de cobertura intactos.

## Criterios de aceptación
- Pruebas nuevas fallan primero y pasan después; la prueba original de cobertura pasa sin cambios.
- Suite completa verde y compilación automática sin errores.
- Aviso comprobado con sesión, escritorio/móvil y claro/oscuro, sin leer Gmail ni realizar llamadas de pago.
- Informe identifica el estado real de lint y cualquier verificación no disponible, sin ampliar el alcance para resolver problemas globales.

## Resultado
Implementado y comprobado; evidencias y límites en `docs/ola-0-informe-20261114.md`.