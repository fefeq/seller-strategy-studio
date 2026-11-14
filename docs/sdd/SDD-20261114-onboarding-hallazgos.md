# SDD-20261114-onboarding-hallazgos · Mejora de revisión de fuentes

**Tipo:** Mejora · **Prioridad:** Alta · **Estado:** En curso
**Pide y autoriza:** Fede, 14-11-2026 · **PRD:** No aplica, mejora acotada.

## 1. Resumen
Separar el propósito de las fuentes de la revisión de los hallazgos. Presentar los datos como interpretaciones por revisar, no como decisiones de estrategia ya aprobadas.
## 2. Problema y para quién
El founder no entiende qué está confirmando ni qué implica descartar.
## 3. Evidencia
Petición de Fede y ReadingStep actual; sin métricas de uso.
## 4. Resultado
Propósito visible por fuente y guía de decisiones junto a los hallazgos.
## 5. Alcance
Solo presentación de ReadingStep y ayuda local. Sin cambiar persistencia, permisos, lectura IA o aprobación de bloques.
## 6. Delta
Añadir título de revisión, instrucciones explícitas, contexto por fuente y etiquetas separadas para dato, procedencia y validación. Conservar las acciones y los estados de lectura existentes.
## 7. Historias y aceptación
- CA-1: confirmar sigue marcando solo el hallazgo seleccionado; prueba nueva reading-review-actions.test.tsx.
- CA-2: excluir sigue siendo reversible mediante Recuperar; misma prueba nueva.
- CA-3: cada fuente explica su propósito sin afirmar contenido que no se ha leído; revisión visual.
- CA-4: continuar no exige confirmar todo y no aprueba la estrategia; pruebas existentes y revisión visual.
## 8. Casos límite
Fuente desconocida: ayuda genérica. Web sin atribución fiable conserva su aviso. Lectura parcial conserva su estado. Sin hallazgos no se inventa una conclusión.
## 9. Experiencia y copy
«Revisa lo que Nokko entendió». Confirmar = validar ese dato; Editar = corregir y confirmar; Descartar = retirar de esta lista, sin recalcular la propuesta. Indicar recuperación durante 24 horas conforme a la regla existente.
## 10. Datos, permisos y privacidad
Sin nuevos datos ni permisos. Fixtures sintéticos. Ninguna modificación de empresa real.
## 11. IA
Ninguna llamada nueva.
## 12. Unidades
U-1: prueba nueva de acciones, ejecutada antes del cambio. U-2: presentación y guía de fuentes. U-3: regresiones y navegador.
## 13. Notas técnicas
Reutilizar FieldActions, summarizeSources y los handlers existentes; ayuda de copy en componente local, no lógica de dominio nueva.
## 14. Riesgos
No prometer que descartar recalcula la propuesta. No confundir origen con veracidad. Pruebas protegidas de textos y recuentos se conservan intactas.
## 15. Preguntas
Ninguna necesaria para este alcance.
## 16. Pendiente de verificar
Navegador autenticado y regresiones al entregar; suite global tiene bloqueo 0093 heredado.
## 17. Revisión independiente
Pendiente; no se declara aceptación del gate.
## 18. Delta de implementación
14-11-2026: nueva guía de decisiones, propósito por fuente, separación visual del dato y su procedencia, espaciado legible y aclaración de que continuar no aprueba la estrategia. Los helpers de persistencia y permisos no cambiaron. Las dos pruebas nuevas de comportamiento pasaron antes del cambio (son invariantes existentes, no se afirma fase roja). Regresiones de lectura 21/21. Suite completa 5782/5783: único fallo heredado por prefijo 0093 duplicado. Compilación automática OK 00:16:04 UTC. Pruebas existentes intactas. Navegador con sesión y respuestas sintéticas no pudo abrir la pantalla (límite de error «La página no se ha cargado»); dos intentos, verificación visual detenida y no declarada. No se publicó ni hubo gasto o cambios en datos reales. Sigue pendiente revisión visual y gate independiente.