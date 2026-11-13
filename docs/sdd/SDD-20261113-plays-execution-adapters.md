# SDD-20261113-plays-execution-adapters · Ejecución persistente NK-0171 U-4b

**Tipo:** Feature · **Prioridad:** Alta · **Estado:** En curso
**Pide y aprueba:** Fede (petición 23:43 UTC y autorización de cola) · **Fecha:** 2026-11-13
**PRD:** docs/prd/PRD-20261112-plays-a-medida.md · **Depende de:** SDD-20261113-plays-a-medida-ejecucion.md

## 1. Resumen
Conectar el coordinador a almacenamiento transaccional, fuentes reales y mantenimiento en segundo plano. Conservar evidencia, sugerencias y coste por paso sin devolver texto privado a Inngest. No activar ningún play ni probar con gasto real.
## 2. Problema y para quién
Los plays aprobados tienen definición pero el coordinador no tiene adaptadores reales.
## 3. Evidencia y por qué ahora
execution.ts solo expone puertos; custom_play_evidence carece del paso/proveedor y custom_play_costs de tokens/moneda/ejecución. Inngest y cron ya tienen mantenimiento por empresa.
## 4. Resultado buscado
G-5 fuentes reales; G-6 afirmaciones con evidencia; G-7 coste medido o sin dato. Línea base de uso: sin dato.
## 5. Alcance
Incluye almacenamiento, selección de fuente por Need, validación de relevancia con IA, ejecución de plays ya activos y sugerencias sin envío.
No incluye activación/pausa manual (U-5), resultados de prueba, publicación, envíos ni cambios de modelos existentes.
## 6. Cambios de comportamiento
Añadido: mantenimiento acotado (3 plays por empresa/hora, 8 pasos, 8 señales/paso). Cada paso se reserva antes de llamar; una llamada interrumpida no se repite automáticamente.
## 7. Historias y criterios de aceptación
- CA-1 (G-5): empresa archivada, no miembro o play inactivo no ejecutan; lease única y fuente disponible.
- CA-2 (G-7): recibo y resultados se guardan juntos; paso reservado sin resultado bloquea el reintento para evitar doble gasto. Prueba: custom-play-execution.pg.test.ts.
- CA-3 (G-6): IA solo selecciona señales ya leídas; nunca crea fechas ni citas; todos los hechos de un borrador tienen evidencia fresca y contacto permitido. Prueba: adapters.test.ts.
- CA-4 (G-7): tokens y coste USD medido/BYOK se conservan; ausencia se marca sin dato; estimaciones EUR de proveedores separadas. Prueba: measured-ai.test.ts.
- CA-5 (G-5): 401/402/403/429 o rechazo terminan y persisten pausa; ninguna sustitución ni reintento inmediato.
- CA-6 (G-1): Inngest y fallback cron usan el mismo núcleo; solo contadores durables. Prueba: adapters.test.ts.
## 8. Casos límite y errores
Sin cuentas: sugerencia de empresa, contacto sin dato. Señal sin fecha o con contacto: rechazada. Reserva incierta: requiere revisión, no repetir gasto. Borrado del play conserva costes. Duplicados conservan decisiones existentes.
## 9. Experiencia y copy
Resultados aparecen en Sugerencias con fuentes. No hay pantalla nueva. Los borradores son propuestas, no mensajes enviados.
## 10. Datos, permisos y privacidad
custom_play_runs y custom_play_steps: org_id, RLS y lectura de miembros; solo service_role escribe y ejecuta RPC. RPC comprueba pertenencia, play/empresa y lease. Pasos guardan payload privado en la base, nunca en historia durable. Costes sin FK hacia el play. Nuevas columnas catalogadas.
## 11. Llamadas a IA
| Llamada | Preferencia | Modelo | Coste previo |
|---|---|---|---|
| Selección de señales relevantes | reglas → señales leídas → IA | primer modelo OpenRouter ya configurado, sin fallbacks; esfuerzo low | sin dato; coste real de usage, nunca estimado |
No usa Lovable AI ni genera fechas o evidencia. Si no devuelve usage se registra sin dato. Ninguna llamada de verificación real autorizada.
## 12. Unidades de trabajo
U-1 pruebas nuevas fallando; U-2 RPC/tablas; U-3 proveedor medido y adaptadores; U-4 conexión mantenimiento y suite.
## 13. Notas técnicas
Reutilizar executeCustomPlay, runPlay, validateMessage, planFor, accountsForCompetitor y effectiveEmailStatus. RPC atómico con lease por play, recibo por ejecución/paso y dedupe de sugerencias. La reserva previa evita repetir una llamada cuyo resultado se perdió; no promete exactly-once en una API externa.
## 14. Riesgos y dependencias
Fuentes externas y el servicio alojado no verificados sin gasto/despliegue. Drive solo texto exportable, sin transcripciones ocultas. La selección de cuentas se limita a datos declarados, nunca autores de reseñas.
## 15. Preguntas para Fede
Ninguna necesaria para esta entrega. U-5 sigue independiente.
## 16. Pendiente de verificar
Llamadas reales y mantenimiento publicado; prohibidos en esta entrega. No se afirma ejecución alojada.
## 17. Revisión técnica independiente
No revisado; no se suplanta nokko-gate ni aceptación de Fede.
## 18. Delta de implementación
Pendiente de evidencia al entregar.