# SDD-20261113-email-verification-model · [Feature] Modelo de verificación de email

**Tipo:** Feature · **Prioridad propuesta:** Media
**Estado:** En curso · **Pide:** Fede · **Aprueba:** Fede (autorización general) · **Fecha:** 2026-11-13
**PRD:** docs/prd/PRD-20261113-verificacion-de-email.md · **Depende de:** —

## 1. Resumen
Definir estados por dirección normalizada y empresa, caducidad de 90 días y puerta graduada compartida. Preparar almacenamiento privado de escritura exclusiva del servidor. No llamar a un proveedor de pago para verificar.

## 2. Problema y para quién
Miembros y asistentes necesitan distinguir email comprobado de email desconocido sin prometer seguridad ni enviar correo. PRD G-2 y G-4.

## 3. Evidencia y por qué ahora
ApolloMatch.email_status existe en src/lib/apollo.ts:223 y se copia a emailStatus:247. Documentación oficial consultada: https://docs.apollo.io/docs/enrich-people-data y https://docs.apollo.io/reference/get-complete-person-info (show enumera verified/extrapolated/unavailable; no demuestra lista exhaustiva de bulk_match). Sin datos de uso. Mapeo tolerante: solo verified se acepta como verificado; resto no verificable hasta evidencia específica, nunca asumir catch-all o inválido del proveedor.

## 4. Resultado buscado
G-2: ninguna puerta permite inválido/catch-all. G-4: caducidad y dirección nueva no conservan verificado. Línea base sin dato; pruebas deterministas.

## 5. Alcance
Incluye modelo puro, normalización, caducidad y puerta; diseño de tabla y RLS. No incluye revelados, cambios de presupuesto, interfaz, verificador independiente 2b, correo real ni activación de plays.

## 6. Cambios de comportamiento (delta)
Añadido: funciones puras reutilizables. Modificado/eliminado: ninguno en consumidores hasta SDD 2/3.

## 7. Historias y criterios de aceptación
H-1: Como miembro quiero un estado efectivo consistente.
- CA-1: normalización y ausencia de fila → sin verificar; dirección distinta no reutiliza estado · G-4 · src/lib/email-verification.test.ts.
- CA-2: ventana exacta de 90 días, fecha inválida/futura no verificada · G-4 · mismo test.
- CA-3: valor Apollo desconocido/ausente no verificable; solo verified reconocido · G-4 · mismo test.
H-2: Como miembro quiero una puerta que el modelo no pueda saltar.
- CA-4: inválido y catch-all bloqueados, incluso con solo-verificado desactivado · G-2 · mismo test.
- CA-5: sin verificar/no verificable pasan con marca; solo verificado opcional los bloquea · G-2 · mismo test.
H-3: Como miembro solo leo estados de mi empresa.
- CA-6: RLS de lectura y escritura solo service_role, retención cuando deja de usarse en las tres tablas · G-4 · prueba PGlite pendiente antes de esquema.

## 8. Casos límite y errores
Sin email no es destinatario; sin fila no verificado. Fechas inválidas/futuras cierran verificación. Desconocidos no se convierten en verificados. No log de dirección.

## 9. Experiencia y copy
Estados con palabra en español. Sin cambio visual en esta unidad. Decisión NK-0168 revoca la regla histórica sin iconos; no introducir iconos aquí. Error al usuario por errorText en futuros consumidores.

## 10. Datos, permisos y privacidad
Tabla propuesta email_verifications: org_id default current_org, email normalizado, status, provider_status corto, provider, source, checked_at, requested_by. FK organización con cascade; miembros SELECT de empresa activa, service_role escritura; ninguna política INSERT/UPDATE para authenticated. Q-5: eliminar fila huérfana al cambiar/borrar último contacto y al borrar organización. No aplicar en base compartida de producción: EXECUTION §5.2 exige local/pruebas; la herramienta disponible aplica a base compartida. Parada de esquema hasta aclarar destino permitido.

## 11. Llamadas a IA
Ninguna. Regla determinista, coste cero de esta unidad; no revelados de prueba.

## 12. Unidades de trabajo
U-1: modelo puro CA-1–5, src/lib/email-verification.test.ts falla primero.
U-2: esquema/retención/RLS CA-6, prueba PGlite falla primero; detenida por destino compartido no autorizado en EXECUTION.

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
Un módulo puro separado de I/O; futuros consumidores lo reutilizan. No tipos ni columnas manuales autogeneradas. Prefijo siguiente candidato 0089, aún no creado. Sin cambios de diario.

## 14. Riesgos y dependencias
Apollo show no demuestra lista bulk_match; desconocidos degradan. No afirma deliverability garantizada ni consentimiento. Vuelta atrás: eliminar módulo/prueba nuevos sin consumidores; esquema no aplicado, sin datos reinterpretados.

## 15. Preguntas para Fede y para la revisión técnica
Decisiones Q-1/3/4/5/6/7 en docs/decisiones-fede-20261113.md aplican; no reabrirlas. Falta aclarar destino de migraciones frente a EXECUTION local/pruebas. No publicar/desplegar.

## 16. Pendiente de verificar
RLS y retención por último contacto no implementados ni probados; schema live no aplicado. Tipos sin comprobar por restricción del entorno. Bulk_match exhaustivo no afirmado. No SDD 2b.

## 17. Revisión técnica independiente (la hace nokko-gate, no quien redactó)
No revisado; no se rellena veredicto independiente.

## 18. Delta de implementación
Pendiente: U-1 antes de U-2. No se declara SDD completo mientras CA-6 quede abierto.